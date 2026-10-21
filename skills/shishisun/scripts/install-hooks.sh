#!/usr/bin/env bash
# 安装「事事顺每日同步」的 git 提交缓存 hook。
#
#   install-hooks.sh [仓库上级目录] [-e 邮箱]
#
# 只扫描该目录下 **一层** 子目录，把 post-commit 注入到其中的 git 仓库：
#   - 仓库没有 post-commit  -> 直接复制本 skill 的 hook
#   - 仓库已有 post-commit  -> 在末尾追加一行调用，保留原有逻辑（不覆盖）
#
# 邮箱用于区分「谁的提交算工作记录」，同事各自安装时填自己的邮箱即可。
# 不修改 core.hooksPath，也不动 init.templateDir —— 不会影响 husky / commit-msg 等仓库自有 hook。
# 新仓库需要再对这个目录跑一次本脚本。
set -euo pipefail

if [[ -n "${WSL_DISTRO_NAME:-}" ]]; then
  echo "检测到 WSL 的 bash；这些脚本要在 Git Bash 里运行（PowerShell/cmd 里的 bash 不是 Git Bash）。" >&2
  exit 1
fi

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_DIR="$(cd "$SKILL_DIR/../.." && pwd)"
HOME_DIR="${DSH_SHISHISUN_HOME:-$HOME/.dsh/shishisun}"
CONFIG="$HOME_DIR/config.sh"
HOOK_SRC="$SKILL_DIR/hooks/post-commit"
MARKER='shishisun:commit-journal'

usage() {
  cat <<'EOF'
用法:
  install-hooks.sh [仓库上级目录] [-e 邮箱]

  [仓库上级目录]       直接放着各个 git 仓库的那一层，例如 D:\gitData\codefree
                       （脚本只扫这一层的子目录，不递归更深层）
  -e, --email <邮箱>   填**你自己**的邮箱，只把该邮箱的提交计入工作记录
                       （不传则交互询问，默认取 git config --global user.email）
  -h, --help           显示帮助
EOF
}

parent=""
email=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    -e | --email) email="${2:-}"; shift 2 ;;
    -h | --help) usage; exit 0 ;;
    -*)
      echo "未知参数: $1" >&2
      usage
      exit 2
      ;;
    *)
      parent="$1"
      shift
      ;;
  esac
done

if [[ ! -f "$HOOK_SRC" ]]; then
  echo "找不到 hook 源文件: $HOOK_SRC" >&2
  exit 1
fi

if [[ -z "$parent" ]]; then
  if [[ -t 0 ]]; then
    printf '%s' '仓库上级目录（直接放着各个仓库的文件夹，例如 D:\gitData\codefree）: '
    read -r parent
  else
    echo "缺少仓库上级目录参数（例如 D:\gitData\codefree，非交互模式请直接传上级目录）" >&2
    usage
    exit 2
  fi
fi
if [[ ! -d "$parent" ]]; then
  echo "目录不存在: $parent" >&2
  exit 1
fi
parent="$(cd "$parent" && pwd)"

if [[ -z "$email" ]]; then
  default_email="$(git config --global user.email 2>/dev/null || true)"
  if [[ -t 0 ]]; then
    printf '同步哪个邮箱的提交（填你自己的邮箱，直接回车用 [%s]）: ' "$default_email"
    read -r email
  fi
  [[ -z "$email" ]] && email="$default_email"
fi
if [[ -z "$email" ]]; then
  echo "缺少邮箱：用 -e 填你自己的邮箱，或先设置 git config --global user.email" >&2
  exit 2
fi

configured_email="$(git config --global user.email 2>/dev/null || true)"
if [[ -n "$configured_email" && "$email" != "$configured_email" ]]; then
  echo "提示：$email 与 git config user.email（$configured_email）不一致，确认这是你自己的提交邮箱。"
fi

mkdir -p "$HOME_DIR/hooks" "$HOME_DIR/commits" "$HOME_DIR/state" "$HOME_DIR/digests"
cp "$HOOK_SRC" "$HOME_DIR/hooks/post-commit"
chmod +x "$HOME_DIR/hooks/post-commit" 2>/dev/null || true

new=0
appended=0
updated=0
skipped=0
found=0

for repo in "$parent"/*/; do
  [[ -d "${repo}.git" ]] || continue
  found=$((found + 1))

  hooks="${repo}.git/hooks"
  mkdir -p "$hooks"
  dest="$hooks/post-commit"

  if [[ -f "$dest" ]]; then
    if grep -q "$MARKER" "$dest" 2>/dev/null; then
      # 本 skill 复制过去的 hook：脚本升级后直接覆盖
      if head -n 3 "$dest" | grep -q 'shishisun:commit-journal -- cache every commit' 2>/dev/null; then
        if diff -q "$dest" "$HOOK_SRC" >/dev/null 2>&1; then
          skipped=$((skipped + 1))
        else
          cp "$HOOK_SRC" "$dest"
          chmod +x "$dest" 2>/dev/null || true
          updated=$((updated + 1))
        fi
      else
        # 原有 hook + 追加调用：hook 更新走 master 副本，无需改仓库文件
        skipped=$((skipped + 1))
      fi
      continue
    fi
    # 保留仓库原有 post-commit，在末尾追加一次调用
    if [[ -n "$(tail -c 1 "$dest" 2>/dev/null)" ]]; then
      printf '\n' >>"$dest"
    fi
    cat >>"$dest" <<'EOF'

# shishisun:commit-journal
p="${DSH_SHISHISUN_HOME:-$HOME/.dsh/shishisun}/hooks/post-commit"
[ -f "$p" ] && sh "$p" >/dev/null 2>&1 || true
EOF
    appended=$((appended + 1))
  else
    cp "$HOOK_SRC" "$dest"
    chmod +x "$dest" 2>/dev/null || true
    new=$((new + 1))
  fi
done

# 配置：不存在则新建；已存在则只更新邮箱，保留其它设置
if [[ -f "$CONFIG" ]]; then
  current_email="$(sed -n 's/^SHISHISUN_EMAIL="\(.*\)"$/\1/p' "$CONFIG" | head -n 1)"
  if [[ "$current_email" != "$email" ]]; then
    # 不用 sed -i：BSD sed 的 -i 需要额外参数，改成临时文件替换
    config_tmp="$(mktemp)"
    sed "s|^SHISHISUN_EMAIL=.*|SHISHISUN_EMAIL=\"$email\"|" "$CONFIG" >"$config_tmp"
    mv "$config_tmp" "$CONFIG"
    echo "配置邮箱: ${current_email:-<空>} -> $email"
  fi
else
  cat >"$CONFIG" <<EOF
# 事事顺每日同步配置（由 sync.sh source）
SHISHISUN_EMAIL="$email"
SHISHISUN_JOURNAL="\${DSH_SHISHISUN_HOME:-\$HOME/.dsh/shishisun}/commits"
SHISHISUN_MAX_COMMITS=300
# 相邻提交间隔超过多少分钟就不再累加工时（休息/会议空档）
SHISHISUN_GAP_MINUTES=45
# 当天第一轮的工时从几点起算
SHISHISUN_WORK_START="09:00"
# 午休时段不计入工时；留空则关闭
SHISHISUN_LUNCH_START="11:30"
SHISHISUN_LUNCH_END="13:30"

# 仓库名 -> 事事顺项目名；归属判定时优先级最高。返回空表示不限定。
shishisun_repo_project() {
  case "\$1" in
    # sc-rcs-web) echo "天空地水工智能监测感知平台" ;;
    # oaWeb)      echo "融合通信" ;;
    *) echo "" ;;
  esac
}
EOF
  echo "配置 -> $CONFIG"
fi

# 让 DSH 发现这个 skill：项目级 + 用户级各一个软链，失败不影响使用
link_skill() {
  local link="$1"
  [[ -e "$link" ]] && return 0
  mkdir -p "$(dirname "$link")"
  if command -v cygpath >/dev/null 2>&1; then
    powershell -NoProfile -Command "New-Item -ItemType Junction -Path '$(cygpath -w "$link")' -Target '$(cygpath -w "$SKILL_DIR")' | Out-Null" >/dev/null 2>&1 || \
      echo "提示：目录联接创建失败，不影响 hook 与定时任务（技能按绝对路径调用）"
  else
    ln -sfn "$SKILL_DIR" "$link" 2>/dev/null || \
      echo "提示：软链创建失败，不影响 hook 与定时任务（技能按绝对路径调用）"
  fi
}

link_skill "$PROJECT_DIR/.agents/skills/shishisun"
link_skill "$HOME/.dsh/skills/shishisun"

echo "扫描 $parent：发现 $found 个仓库"
if [[ $found -eq 0 ]]; then
  echo "  ⚠ 这个上级目录下没有「一层子目录 + .git」，确认上级目录对不对："
  echo "    要填直接放着仓库的那一层（例如 D:\gitData\codefree），不是它的上一层 D:\gitData。"
fi
echo "  新装 $new, 追加 $appended, 更新 $updated, 已存在 $skipped"
echo "  同步邮箱: $email （之后只记录这个邮箱的提交）"
echo "hook 副本 -> $HOME_DIR/hooks/post-commit"
echo "下一步: bash $SKILL_DIR/scripts/sync.sh status"
