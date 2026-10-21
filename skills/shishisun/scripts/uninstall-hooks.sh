#!/usr/bin/env bash
# 卸载「事事顺每日同步」的 git 提交缓存 hook。
#
#   uninstall-hooks.sh [仓库上级目录] [--purge] [--yes]
#
# 只扫描该目录下一层子目录：
#   - 本 skill 复制的 post-commit        -> 删除
#   - 原有 post-commit 里追加的调用块    -> 去掉那几行，保留原有逻辑
#
# --purge 额外删除 ~/.dsh/shishisun 下的配置、缓存、状态（不可恢复）。
set -euo pipefail

if [[ -n "${WSL_DISTRO_NAME:-}" ]]; then
  echo "检测到 WSL 的 bash；这些脚本要在 Git Bash 里运行（PowerShell/cmd 里的 bash 不是 Git Bash）。" >&2
  exit 1
fi

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOME_DIR="${DSH_SHISHISUN_HOME:-$HOME/.dsh/shishisun}"
HOOK_SRC="$SKILL_DIR/hooks/post-commit"
MARKER='shishisun:commit-journal'

usage() {
  cat <<'EOF'
用法:
  uninstall-hooks.sh [仓库上级目录] [--purge] [--yes]

  --purge   同时删除 ~/.dsh/shishisun（配置 / 缓存 / 状态）
  --yes     跳过 --purge 的确认
EOF
}

parent=""
purge=0
yes=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --purge) purge=1; shift ;;
    --yes)   yes=1; shift ;;
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

removed=0
stripped=0
untouched=0

for repo in "$parent"/*/; do
  dest="${repo}.git/hooks/post-commit"
  [[ -f "$dest" ]] || continue

  if ! grep -q "$MARKER" "$dest" 2>/dev/null; then
    untouched=$((untouched + 1))
    continue
  fi

  if head -n 3 "$dest" | grep -q 'shishisun:commit-journal -- cache every commit' 2>/dev/null; then
    # 本 skill 复制过去的 hook（可能是旧版本），直接删除
    rm -f "$dest"
    removed=$((removed + 1))
    continue
  fi

  # 去掉追加的调用块，保留仓库原有 post-commit
  awk '
    BEGIN { skip = 0 }
    /# shishisun:commit-journal/ { skip = 1; next }
    skip == 1 { if ($0 ~ /\|\| true$/) { skip = 0 }; next }
    { print }
  ' "$dest" >"$dest.shishisun.tmp"
  mv "$dest.shishisun.tmp" "$dest"
  stripped=$((stripped + 1))
done

echo "扫描 $parent"
echo "  删除 $removed, 还原 $stripped, 未涉及 $untouched"

if [[ $purge -eq 1 ]]; then
  if [[ $yes -eq 0 ]]; then
    if [[ -t 0 ]]; then
      printf '删除 %s 下的配置与缓存？不可恢复 [y/N]: ' "$HOME_DIR"
      read -r ans
      [[ "$ans" == y* || "$ans" == Y* ]] || {
        echo "已跳过 purge"
        exit 0
      }
    else
      echo "非交互模式执行 --purge 需要同时传 --yes" >&2
      exit 2
    fi
  fi
  rm -rf "$HOME_DIR"
  echo "  已删除 $HOME_DIR"
fi
