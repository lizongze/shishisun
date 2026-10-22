#!/usr/bin/env bash
# 事事顺每日工作同步：读取 git 提交缓存，生成待归属清单 / 提交处理进度。
#
#   sync.sh prepare                读缓存 -> 过滤我的提交与已处理 -> 写 digest
#   sync.sh complete -d <digest>   把 digest 里的提交标记为已处理（幂等）
#   sync.sh status                 打印缓存与状态概览
#
# 可选参数：-s <ISO 时间>（只处理该时间之后）、-n <备注>（记入完成日志）
#
# 提交缓存由 post-commit hook 写入：
#   ~/.dsh/shishisun/commits/commits-YYYY-MM-DD.tsv
# 每行 7 列，制表符分隔：仓库路径、分支、短 hash、提交时间(ISO)、作者邮箱、作者名、提交说明。
set -euo pipefail

if [[ -n "${WSL_DISTRO_NAME:-}" ]]; then
  echo "检测到 WSL 的 bash；这些脚本要在 Git Bash 里运行（PowerShell/cmd 里的 bash 不是 Git Bash）。" >&2
  exit 1
fi

usage() {
  cat <<'EOF'
用法:
  sync.sh prepare                        生成待归属清单
  sync.sh complete -d <digest.md>        标记 digest 内提交为已处理
  sync.sh status                         查看状态
  sync.sh logmap get <itemId>            查当天该事项已写的日志 id
  sync.sh logmap set <itemId> <logId>    记录日志 id（后续用 update_log 合并工时）
参数:
  -d, --digest <path>   digest 文件（complete 必填）
  -s, --since <iso>     只处理该时间之后的提交（prepare 可选）
  -n, --note <text>     本次运行备注（complete 可选）
EOF
}

MODE="${1:-}"
case "$MODE" in
  prepare | complete | status | logmap) ;;
  *) usage; exit 2 ;;
esac
shift

DIGEST=""
SINCE=""
NOTE=""
LM_SUB=""
LM_ITEM=""
LM_LOG=""
if [[ "$MODE" == "logmap" ]]; then
  LM_SUB="${1:-}"
  LM_ITEM="${2:-}"
  LM_LOG="${3:-}"
else
  while [[ $# -gt 0 ]]; do
    case "$1" in
      -d | --digest) DIGEST="${2:-}"; shift 2 ;;
      -s | --since)  SINCE="${2:-}"; shift 2 ;;
      -n | --note)   NOTE="${2:-}"; shift 2 ;;
      -h | --help)   usage; exit 0 ;;
      *) echo "未知参数: $1" >&2; usage; exit 2 ;;
    esac
  done
fi

HOME_DIR="${DSH_SHISHISUN_HOME:-$HOME/.dsh/shishisun}"
CONFIG="$HOME_DIR/config.sh"
JOURNAL_DIR="$HOME_DIR/commits"
STATE_DIR="$HOME_DIR/state"
DIGEST_DIR="$HOME_DIR/digests"
TODAY="$(date +%Y-%m-%d)"

EMAIL="$(git config --global user.email 2>/dev/null || true)"
MAX_COMMITS=300
if [[ -f "$CONFIG" ]]; then
  # shellcheck disable=SC1090
  source "$CONFIG"
fi
EMAIL="${SHISHISUN_EMAIL:-$EMAIL}"
JOURNAL_DIR="${SHISHISUN_JOURNAL:-$JOURNAL_DIR}"
# DSH_SHISHISUN_HOME 是根目录级别覆盖，优先级高于配置文件里的 journal 路径
if [[ -n "${DSH_SHISHISUN_HOME:-}" ]]; then
  JOURNAL_DIR="$DSH_SHISHISUN_HOME/commits"
fi
MAX_COMMITS="${SHISHISUN_MAX_COMMITS:-$MAX_COMMITS}"
GAP_MINUTES="${SHISHISUN_GAP_MINUTES:-45}"
GAP_SECONDS=$((GAP_MINUTES * 60))
# 当天第一轮从「上班时间」起算工时；之后各轮从首条提交起算
WORK_START="${SHISHISUN_WORK_START:-09:00}"
WS_H="${WORK_START%%:*}"
WS_M="${WORK_START##*:}"
WORK_START_SECONDS=$((10#$WS_H * 3600 + 10#$WS_M * 60))

# 午休时段不计入工时；留空则关闭
LUNCH_START="${SHISHISUN_LUNCH_START-11:30}"
LUNCH_END="${SHISHISUN_LUNCH_END-13:30}"
LUNCH_ENABLED=0
if [[ -n "$LUNCH_START" && -n "$LUNCH_END" ]]; then
  LS_H="${LUNCH_START%%:*}"
  LS_M="${LUNCH_START##*:}"
  LE_H="${LUNCH_END%%:*}"
  LE_M="${LUNCH_END##*:}"
  LUNCH_START_SECONDS=$((10#$LS_H * 3600 + 10#$LS_M * 60))
  LUNCH_END_SECONDS=$((10#$LE_H * 3600 + 10#$LE_M * 60))
  if ((LUNCH_END_SECONDS > LUNCH_START_SECONDS)); then LUNCH_ENABLED=1; fi
fi

mkdir -p "$JOURNAL_DIR" "$STATE_DIR" "$DIGEST_DIR"

PROCESSED="$STATE_DIR/processed-$TODAY.tsv"
touch "$PROCESSED"
# 当天第一轮（还没有任何已处理记录）
FIRST_RUN_TODAY=0
if [[ ! -s "$PROCESSED" ]]; then FIRST_RUN_TODAY=1; fi

# 事项 -> 当天已写日志 id 的映射，用于把多轮工时合并进同一条日志
LOGMAP="$STATE_DIR/logmap-$TODAY.tsv"

if [[ "$MODE" == "logmap" ]]; then
  case "$LM_SUB" in
    get)
      if [[ -n "$LM_ITEM" && -f "$LOGMAP" ]]; then
        awk -F'\t' -v id="$LM_ITEM" '$1 == id { print $2; exit }' "$LOGMAP"
      fi
      ;;
    set)
      if [[ -z "$LM_ITEM" || -z "$LM_LOG" ]]; then
        echo "用法: sync.sh logmap set <itemId> <logId>" >&2
        exit 2
      fi
      tmp="$(mktemp)"
      if [[ -f "$LOGMAP" ]]; then
        awk -F'\t' -v id="$LM_ITEM" '$1 != id' "$LOGMAP" >"$tmp"
      fi
      printf '%s\t%s\n' "$LM_ITEM" "$LM_LOG" >>"$tmp"
      sort -t$'\t' -k1,1 "$tmp" -o "$LOGMAP"
      rm -f "$tmp"
      echo "ok"
      ;;
    del)
      if [[ -n "$LM_ITEM" && -f "$LOGMAP" ]]; then
        tmp="$(mktemp)"
        awk -F'\t' -v id="$LM_ITEM" '$1 != id' "$LOGMAP" >"$tmp"
        mv "$tmp" "$LOGMAP"
      fi
      echo "ok"
      ;;
    *)
      echo "用法: sync.sh logmap get <itemId> | set <itemId> <logId>" >&2
      exit 2
      ;;
  esac
  exit 0
fi

to_posix() {
  case "$1" in
    [A-Za-z]:[\\/]*) cygpath -u "$1" ;;
    *) printf '%s' "$1" ;;
  esac
}

to_windows() {
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -w "$1"
  else
    printf '%s' "$1"
  fi
}

repo_project() {
  if declare -F shishisun_repo_project >/dev/null 2>&1; then
    shishisun_repo_project "$1"
  fi
}

# ---------------------------------------------------------------- 过滤提交

since_date="$TODAY"
if [[ -n "$SINCE" ]]; then
  since_date="${SINCE:0:10}"
elif [[ -f "$STATE_DIR/last-run" ]]; then
  ld="$(head -n 1 "$STATE_DIR/last-run" || true)"
  [[ -n "$ld" ]] && since_date="${ld:0:10}"
fi
[[ "$since_date" > "$TODAY" ]] && since_date="$TODAY"

files=()
if [[ -d "$JOURNAL_DIR" ]]; then
  while IFS= read -r f; do
    [[ -f "$f" ]] || continue
    d="${f##*/}"
    d="${d#commits-}"
    d="${d%.tsv}"
    if [[ "$d" < "$since_date" || "$d" > "$TODAY" ]]; then
      continue
    fi
    files+=("$f")
  done < <(find "$JOURNAL_DIR" -maxdepth 1 -name 'commits-*.tsv' -print | sort)
fi

pending_file="$(mktemp)"
raw_file="$(mktemp)"
proc_all="$(mktemp)"
trap 'rm -f "$pending_file" "$raw_file" "$proc_all"' EXIT

# 已处理记录按天分文件；回看窗口可能跨天，先合并全部再按 key 去重
: >"$proc_all"
for f in "$STATE_DIR"/processed-*.tsv; do
  [[ -f "$f" ]] || continue
  cat "$f" >>"$proc_all"
done

if [[ ${#files[@]} -gt 0 ]]; then
  awk -F'\t' -v email="$EMAIL" -v since="$since_date" -v today="$TODAY" -v proc="$proc_all" '
    BEGIN { while ((getline line < proc) > 0) if (line != "") done[line] = 1 }
    {
      date = substr($4, 1, 10)
      if (date < since || date > today) next
      if (tolower($5) != tolower(email)) next
      key = tolower($1) "|" tolower($3)
      if (key in done) next
      if (key in seen) next
      seen[key] = 1
      print key "\t" $4 "\t" $1 "\t" $2 "\t" $3 "\t" $7
    }
  ' "${files[@]}" | sort -t$'\t' -k2,2 >"$raw_file"

  head -n "$MAX_COMMITS" "$raw_file" >"$pending_file"
fi

count="$(wc -l <"$pending_file" | tr -d ' ')"

# ---------------------------------------------------------------- 命令

case "$MODE" in

prepare)
  digest=""
  if [[ "$count" -gt 0 ]]; then
    ddir="$DIGEST_DIR/$TODAY"
    mkdir -p "$ddir"
    digest="$ddir/$(date +%H%M%S).md"

    {
      echo "# 事事顺增量同步 · $(date '+%Y-%m-%d %H:%M')"
      echo
      echo "共 $count 条我的提交待归属（按仓库分组，时间为本地时间）。"
      echo "按功能点分组，一个功能点一条日志（≤20 字）；工时按功能点分摊，合计接近下面的参考工时。"
      echo "每个仓库末尾的「参考工时」可直接相加后填入 add_log 的 hours。"
      echo
      echo '<!-- shishisun-pending'
      cut -f1 "$pending_file"
      echo '-->'
      echo
    } >"$digest"

    last=""
    repo_commits=0
    repo_seconds=0
    prev_seconds=0

    # 把 [a,b] 与午休的重叠秒数写进 OVERLAP
    lunch_overlap() {
      local a="$1" b="$2" s e
      OVERLAP=0
      if ((LUNCH_ENABLED == 1)) && ((b > a)); then
        s=$a
        if ((s < LUNCH_START_SECONDS)); then s=$LUNCH_START_SECONDS; fi
        e=$b
        if ((e > LUNCH_END_SECONDS)); then e=$LUNCH_END_SECONDS; fi
        if ((e > s)); then OVERLAP=$((e - s)); fi
      fi
    }

    finish_repo() {
      if [[ -n "$last" ]]; then
        units=$(((repo_seconds * 2 + 1800) / 3600))
        if ((units < 1)); then units=1; fi
        if ((units > 16)); then units=16; fi
        echo "" >>"$digest"
        if ((units % 2 == 1)); then
          echo "参考工时：$((units / 2)).5h（$repo_commits 次提交）" >>"$digest"
        else
          echo "参考工时：$((units / 2)).0h（$repo_commits 次提交）" >>"$digest"
        fi
        echo "" >>"$digest"
      fi
    }

    while IFS=$'\t' read -r key time repo branch hash subject; do
      name="${repo##*[/\\]}"
      cdate="${time:0:10}"
      # 只用 HH:MM:SS 算秒，避免跨平台 date 解析差异
      seconds=$((10#${time:11:2} * 3600 + 10#${time:14:2} * 60 + 10#${time:17:2}))
      if ((seconds < WORK_START_SECONDS)); then seconds=$WORK_START_SECONDS; fi
      if [[ "$name" != "$last" ]]; then
        finish_repo
        last="$name"
        repo_commits=1
        # 当天第一轮：从上班时间起算；其余轮次或非当天提交：首条按 0.5h 打底
        if ((FIRST_RUN_TODAY == 1)) && [[ "$cdate" == "$TODAY" ]] && ((seconds > WORK_START_SECONDS)); then
          lunch_overlap "$WORK_START_SECONDS" "$seconds"
          repo_seconds=$((seconds - WORK_START_SECONDS - OVERLAP))
        else
          lunch_overlap "$((seconds - 1800))" "$seconds"
          repo_seconds=$((1800 - OVERLAP))
        fi
        if ((repo_seconds < 0)); then repo_seconds=0; fi
        prev_seconds=$seconds
        {
          echo ""
          echo "## $name"
          project="$(repo_project "$name")"
          if [[ -n "$project" ]]; then echo "映射项目：$project"; fi
          echo "\`$repo\`"
          echo ""
        } >>"$digest"
      else
        gap=$((seconds - prev_seconds))
        if ((gap < 0)); then gap=0; fi
        lunch_overlap "$prev_seconds" "$seconds"
        gap=$((gap - OVERLAP))
        if ((gap < 0)); then gap=0; fi
        if ((gap > GAP_SECONDS)); then gap=$GAP_SECONDS; fi
        repo_seconds=$((repo_seconds + gap))
        repo_commits=$((repo_commits + 1))
        prev_seconds=$seconds
      fi
      if [[ "$cdate" == "$TODAY" ]]; then
        echo "- ${time:11:5} \`$hash\` [$branch] $subject" >>"$digest"
      else
        echo "- ${time:5:5} ${time:11:5} \`$hash\` [$branch] $subject" >>"$digest"
      fi
    done < <(sort -t$'\t' -k3,3 -k2,2 "$pending_file")
    finish_repo
  fi

  echo "count=$count"
  if [[ "$count" -gt 0 ]]; then echo "digest=$(to_windows "$digest")"; fi
  echo "since=$since_date"
  echo "email=$EMAIL"
  ;;

complete)
  if [[ -z "$DIGEST" ]]; then
    echo "complete 需要 -d <digest 文件>" >&2
    exit 2
  fi
  DIGEST="$(to_posix "$DIGEST")"
  if [[ ! -f "$DIGEST" ]]; then
    echo "digest 不存在: $DIGEST" >&2
    exit 2
  fi

  keys="$(sed -n '/<!-- shishisun-pending/,/-->/p' "$DIGEST" | grep -v '<!--' | grep -v -e '-->' | sed '/^$/d' || true)"
  if [[ -z "$keys" ]]; then
    echo "digest 里没有待处理清单: $DIGEST" >&2
    exit 1
  fi

  printf '%s\n' "$keys" >>"$PROCESSED"
  sort -u "$PROCESSED" -o "$PROCESSED"
  date +%Y-%m-%dT%H:%M:%S%z >"$STATE_DIR/last-run"
  if [[ -n "$NOTE" ]]; then
    printf '%s\t%s\t%s\n' "$(date +%Y-%m-%dT%H:%M:%S%z)" "$(printf '%s\n' "$keys" | wc -l | tr -d ' ')" "$NOTE" >>"$STATE_DIR/runs.tsv"
  fi

  echo "marked=$(printf '%s\n' "$keys" | wc -l | tr -d ' ')"
  echo "processed_on=$TODAY"
  ;;

status)
  journal_count=0
  today_lines=0
  if [[ -f "$JOURNAL_DIR/commits-$TODAY.tsv" ]]; then
    today_lines="$(wc -l <"$JOURNAL_DIR/commits-$TODAY.tsv" | tr -d ' ')"
  fi
  journal_count="$(find "$JOURNAL_DIR" -maxdepth 1 -name 'commits-*.tsv' 2>/dev/null | wc -l | tr -d ' ')"
  processed_today="$(wc -l <"$PROCESSED" | tr -d ' ')"
  last_run=""
  [[ -f "$STATE_DIR/last-run" ]] && last_run="$(head -n 1 "$STATE_DIR/last-run")"

  echo "home       : $HOME_DIR"
  echo "email      : $EMAIL"
  echo "journal    : $JOURNAL_DIR"
  echo "journal    : $journal_count 个文件, 今天 $today_lines 行"
  echo "lastRunAt  : $last_run"
  echo "processed  : $processed_today 条（今天）"
  echo "pending    : $count 条"
  echo "since      : $since_date"
  ;;
esac
