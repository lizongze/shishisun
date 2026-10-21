# 事事顺 · 每日工作同步（skill）

把每天散落在各个仓库的 git 提交，自动归集到「事事顺」事项上：写跟进日志、必要时更新自由笔记，日终给出总结。

```
git commit ──► post-commit hook ──► ~/.dsh/shishisun/commits/commits-YYYY-MM-DD.tsv
                                             │
                    DSH 定时任务（工作日 9:00-19:00 每 2 小时）
                                             │
                 ┌───────────────────────────┴──────────────────────────┐
                 │ sync.sh prepare                                      │
                 │   过滤「我的提交」-「已处理」→ 生成 digest md         │
                 │                                                      │
                 │ 代理读 digest + 事事顺 list_items(mine=true)          │
                 │   归属 → add_log / 必要时改 notesMd                   │
                 │                                                      │
                 │ sync.sh complete -d <md>                              │
                 │   记为已处理，下一轮不重复                            │
                 └──────────────────────────────────────────────────────┘
```

## 相关文档

- [项目说明](../../README.md)：ai-tools 仓库总览
- [事事顺任务卡片编写规范](../../doc/shishisun.md)：标题、验收标准、跟进日志、长期任务的团队写法
- [INSTALL.md](INSTALL.md)：安装、升级、卸载、排查
- [SKILL.md](SKILL.md)：代理执行的完整流程与写回规则

## 快速开始

全部在 **bash** 里、项目根目录下执行（Windows 用 Git Bash，Linux / macOS 用系统 bash；尖括号是占位符，换成你自己的）：

```bash
# 先进本项目根目录（换成你的克隆位置）
cd <项目根目录>

# 1. 注入 hook（每台机器一次）
#    <仓库上级目录>：填「直接放着仓库的那一层」，不是仓库本身，也不是它的上一层
#    <你的邮箱>：你自己的 git 邮箱
bash skills/shishisun/scripts/install-hooks.sh '<仓库上级目录>' -e '<你的邮箱>'

# 2. 确认 email 一行显示的是你自己的邮箱
bash skills/shishisun/scripts/sync.sh status
```

路径示例（只作参考，换成你自己的目录和邮箱）：

```bash
# Windows · Git Bash
cd /d/gitData/codefree/ai-tools
bash skills/shishisun/scripts/install-hooks.sh 'D:\gitData\codefree' -e 'you@company.com'

# Linux / macOS
cd ~/code/ai-tools
bash skills/shishisun/scripts/install-hooks.sh ~/code -e 'you@company.com'
```

「仓库上级目录」填**直接放着仓库的那一层**；你本机的仓库分在 `D:\gitData\bell`、`codefree`、`github`，三层各跑一次。

Windows 路径写 `D:\gitData\codefree`（Git Bash 里也认 `/d/gitData/codefree`），Linux / macOS 写 `~/code` 或 `/home/leo/code`，脚本都能处理。

完整步骤（验证、配置、分享、升级、卸载）见 [INSTALL.md](INSTALL.md)。

## 命令

### 安装 / 卸载

| 命令 | 作用 |
|------|------|
| `bash skills/shishisun/scripts/install-hooks.sh [仓库上级目录] [-e 邮箱]` | 注入或更新 post-commit hook（首次安装、加仓库、升级都用它） |
| `bash skills/shishisun/scripts/uninstall-hooks.sh [仓库上级目录]` | 撤销 hook（`--purge` 连配置缓存一起删） |

### 日常同步 / 诊断

| 命令 | 作用 |
|------|------|
| `bash skills/shishisun/scripts/sync.sh status` | 看缓存、已处理、待处理——排查先跑这个 |
| `bash skills/shishisun/scripts/sync.sh prepare` | 生成待归属 digest，输出 `count=` / `digest=` |
| `bash skills/shishisun/scripts/sync.sh complete -d <digest>` | 标记这批提交已处理（幂等，补跑安全） |

## 文件布局

```
skills/shishisun/
├── SKILL.md                 # 代理执行的流程与写回规则
├── INSTALL.md               # 安装说明（含升级 / 卸载 / 排查）
├── README.md                # 本文件
├── config.example.sh        # 配置样例
├── hooks/post-commit        # hook 源文件（复制 / 追加调用）
└── scripts/
    ├── install-hooks.sh     # 安装：扫一层子目录、注入 post-commit
    ├── uninstall-hooks.sh   # 卸载：删除或还原
    └── sync.sh              # prepare / complete / status
```
