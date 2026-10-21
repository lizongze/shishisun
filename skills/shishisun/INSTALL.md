# 安装说明

Windows + Git for Windows + DSH，每台机器装一次，约 1 分钟。

## 本页导航

**安装**

1. [安装 hook](#1-安装-hook注入提交缓存)
2. [验证](#2-验证)
3. [定时任务](#3-定时任务)
4. [配置](#4-配置)
5. [分享给同事](#5-分享给同事)

**维护与诊断**

6. [升级](#6-升级)
7. [卸载](#7-卸载)
8. [诊断与排查](#诊断与排查)

## 命令约定

所有命令都在**本项目根目录**、用 **Git Bash** 执行，脚本一律用相对路径；尖括号是占位符，换成你自己的：

```bash
cd <项目根目录>
```

> 本机参考：项目根 `D:\gitData\codefree\ai-tools`。别照抄，按你的实际克隆位置来。
>
> PowerShell / cmd 里的 `bash` 不是 Git Bash（Windows 上它指向 WSL），不要用它执行这些脚本。
> 脚本开头会检测 WSL 并直接报错退出，避免把数据写到 WSL 的家目录里。

**路径写法**

| 平台 | 项目根 | 仓库上级目录 |
|------|--------|--------------|
| Windows | `D:\code\ai-tools`（Git Bash 里也可写 `/d/code/ai-tools`） | `D:\gitData\codefree` 或 `/d/gitData/codefree` |
| Linux | `~/code/ai-tools` 或 `/home/leo/code/ai-tools` | `~/code` 或 `/home/leo/code` |
| macOS | `~/code/ai-tools` 或 `/Users/leo/code/ai-tools` | `~/code` 或 `/Users/leo/code` |

脚本内部会把 Windows 盘符路径转成 POSIX 路径再处理，两种写法都接受。

## 0. 前置检查

| 依赖 | 检查 | 说明 |
|------|------|------|
| Git | `git --version` | 提交缓存依赖 git；macOS 首次会提示装 Command Line Tools |
| bash | Windows：用 Git 自带的 Git Bash；Linux / macOS：系统 bash | 脚本用 bash / awk / sed，兼容 bash 3.2 |
| 事事顺 MCP | 能在 DSH 里调用 `list_items` | 没连先在设置 → 技能与 MCP 里加 |
| **你自己的邮箱** | `git config --global user.email` | 必填，决定「哪些提交算你的工作记录」。不要填公共邮箱或别人的 |

## 1. 安装 hook（注入提交缓存）

**先把下面两个占位符换成你自己的值**，再执行：

```bash
cd <项目根目录>
bash skills/shishisun/scripts/install-hooks.sh '<仓库上级目录>' -e '<你的邮箱>'
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

> ⚠️ 邮箱是「谁的工作记录」的唯一依据。填错或照抄示例邮箱，结果是一条提交都匹配不到，日终同步永远是空的。
> 不确定的话先跑 `git config --global user.email` 看本机提交用的地址，填同一个。

### 「仓库上级目录」指哪一层？

填**直接放着各个仓库**的那一层，脚本只扫它下面的子目录，不会递归：

```
D:\gitData
├── bell\                   ← 容器：对它跑
│   ├── oaWeb\              ← 仓库
│   └── project-schedule\   ← 仓库
├── codefree\               ← 容器：对它跑
│   ├── aiFlow\             ← 仓库
│   └── sc-rcs-web\         ← 仓库
└── github\                 ← 容器：对它跑
```

Linux / macOS 下结构一样，如 `~/code/{project-a,project-b}`，上级目录就是 `~/code`。

填 `D:\gitData` 是**错的**——它下面没有直接挂着仓库。每层分别跑（上面的树只是示例结构）：

```bash
cd <项目根目录>
for dir in '<仓库上级目录1>' '<仓库上级目录2>'; do
  bash skills/shishisun/scripts/install-hooks.sh "$dir" -e '<你的邮箱>'
done
```

> 本机示例：`'D:\gitData\bell' 'D:\gitData\codefree' 'D:\gitData\github'`。

Linux 同理，`~/code/{project-a,project-b}` 的上级目录是 `~/code`：

```bash
cd ~/code/ai-tools
for dir in ~/code/project-a ~/code/project-b; do
  bash skills/shishisun/scripts/install-hooks.sh "$dir" -e 'you@company.com'
done
```

`D:\gitData\ext` 下仓库层级更深（如 `ext\ACS\trunk\acs-admin`），对最靠近仓库的那层跑。

层级填错时脚本会提示：`这个目录下没有「一层子目录 + .git」`。

| 参数 | 说明 |
|------|------|
| 第一个位置参数 | 直接放着仓库的那一层（如 `D:\gitData\codefree`），脚本只扫它下面**一层**子目录 |
| `-e, --email` | 填**你自己**的邮箱；不传则交互询问，提示语会说明填自己的，默认取 `git config --global user.email` |

交互式用法：`bash skills/shishisun/scripts/install-hooks.sh`，依次提示上级目录和邮箱（提示语：`仓库上级目录（直接放着各个仓库的文件夹…）`、`同步哪个邮箱的提交（填你自己的邮箱…）`）。

脚本做四件事：

1. 把 `hooks/post-commit` 复制到 `~/.dsh/shishisun/hooks/`
2. 逐个仓库注入：没有 `post-commit` 就复制；已有就在末尾追加调用，**保留原有逻辑**
3. 写入 / 更新 `~/.dsh/shishisun/config.sh` 里的 `SHISHISUN_EMAIL`
4. 尽力创建 `.agents/skills/shishisun` 目录联接，让 DSH 技能目录能发现本 skill

**不做**：不改 `core.hooksPath`、不动 `init.templateDir`、不碰仓库其它 hook。所以 husky、`commit-msg` 等都照常工作。

重复执行是幂等的：本 skill 复制的 hook 会按新版本更新；追加过调用的仓库保持不动。

## 2. 验证

```bash
cd <项目根目录>
bash skills/shishisun/scripts/sync.sh status
```

应看到 `home` / `email` / `journal` 三行，`pending 0 条`。

**重点看 `email` 一行**：必须是你自己的邮箱。如果显示的是示例地址、作者邮箱或别人的地址，说明安装时填错了，重跑第 1 步换成你的即可（会覆盖旧值）。然后：

```bash
bash skills/shishisun/scripts/sync.sh prepare
```

输出 `count=0` 且没有 `digest=` 行是正常的（还没有未同步的提交）。

**真实提交验证**：在任意被注入的仓库提交一次，再跑 `status`，「今天 N 行」应该 +1。若没变，检查该仓库 `.git/hooks/post-commit` 是否含 `shishisun`。

## 3. 定时任务

已在本会话创建：工作日 9:00–19:00 每 2 小时（cron `0 9-19/2 * * 1-5`，Asia/Shanghai）。

- 查看：`schedule_list`
- 调整：`schedule_update`，例如改成每天 18:30：`30 18 * * *`
- 限制：DSH 的 schedule 属于**当前会话**，应用或会话关闭后不会触发；**新会话需要重建一次**，参数见 `SKILL.md` 的「定时任务」一节

## 4. 配置

`~/.dsh/shishisun/config.sh`，改完下一轮立即生效，无需重装：

| 变量 | 默认 | 说明 |
|------|------|------|
| `SHISHISUN_EMAIL` | 安装时输入 | 只同步该邮箱的提交，必须是**你自己**的地址 |
| `SHISHISUN_JOURNAL` | `$HOME/.dsh/shishisun/commits` | 提交缓存目录 |
| `SHISHISUN_MAX_COMMITS` | `300` | 单次 digest 条数上限，超出留到下一轮 |
| `SHISHISUN_GAP_MINUTES` | `45` | 相邻提交间隔超过多少分钟就不再累加工时（休息/会议空档） |
| `SHISHISUN_WORK_START` | `09:00` | 当天第一轮的工时从几点开始起算 |
| `SHISHISUN_LUNCH_START` | `11:30` | 午休开始，区间内不计工时 |
| `SHISHISUN_LUNCH_END` | `13:30` | 午休结束 |
| `shishisun_repo_project()` | 空 | 仓库名 → 事事顺项目名，归属判定优先级最高 |

```bash
shishisun_repo_project() {
  case "$1" in
    sc-rcs-web) echo "天空地水工智能监测感知平台" ;;
    oaWeb)      echo "融合通信" ;;
    *) echo "" ;;
  esac
}
```

## 5. 分享给同事

1. 把 `skills/shishisun` 整个目录拷给对方，或让对方拉这个仓库
2. 对方进入项目根目录后执行，**`-e` 后面换成 ta 自己的邮箱**（不是你的，也不是示例地址）：

   ```bash
   cd <项目根目录>
   bash skills/shishisun/scripts/install-hooks.sh '<对方的仓库上级目录>' -e 'ta@company.com'
   ```

3. 建议对方跑一次 `sync.sh status`，确认 `email` 一行是 ta 自己的地址
4. 建议把同一份 `repoProjects` 配置发给对方，保证仓库到项目的映射一致

每个人的配置、缓存都在各自机器的 `~/.dsh/shishisun/` 下，互不影响。`config.sh` 里的 `SHISHISUN_EMAIL` 是唯一判定依据，多人共用一台机器时，谁跑安装就是谁。

## 6. 升级

覆盖或拉取新版本后，重跑一次安装命令即可：

- 复制模式的仓库：hook 自动更新成新版本
- 追加模式的仓库：调用的是 `~/.dsh/shishisun/hooks/post-commit` 这个 master 副本，无需处理

## 7. 卸载

```bash
cd <项目根目录>

# 只撤 hook（复制的删除，追加的还原）
bash skills/shishisun/scripts/uninstall-hooks.sh '<仓库上级目录>'

# 连配置、缓存、状态一起删（不可恢复）
bash skills/shishisun/scripts/uninstall-hooks.sh '<仓库上级目录>' --purge --yes
```

## 诊断与排查

排查顺序：先 `bash skills/shishisun/scripts/sync.sh status` 看缓存和待处理，再看下面这张表。

| 现象 | 原因 / 处理 |
|------|-------------|
| 报 `检测到 WSL 的 bash` | 用了 PowerShell/cmd 里的 bash；换 Git Bash 终端 |
| 提交没被记录 | 该仓库是否被扫到？只扫一层子目录；目录多一层就单独对那层再跑一次 |
| hook 存在但没写入 | 检查 `~/.dsh/shishisun/commits/` 权限；hook 的所有失败路径都静默退出 |
| 记录了但同步时不出现 | `config.sh` 的 `SHISHISUN_EMAIL` 与提交作者邮箱不一致 |
| 重复写日志 | 通常是 `complete` 没执行；补跑一次即可，按 key 去重 |
| 时间对不上 | 缓存按本地时间分文件（`date +%F`），跨时区提交按本地日期归日 |
| `count=0` 但明明有提交 | 删除 `~/.dsh/shishisun/state/last-run` 可回退到当天重新扫描 |
