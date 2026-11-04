# 安装说明（PRD → 多页原型 skill）

> **给产品同学**：这份文档不用全看懂。把 [§1](#1-让-ai-帮你装推荐) 那段话整段贴给你的 AI，它会自己检查环境、装 Node、放好 skill；装完让 AI 跑 [§5](#5-装完自检) 的自检就行。全程约 5 分钟。

## 0. 这东西需要什么

| 依赖 | 必需 | 用来做什么 | 没有会怎样 |
|---|---|---|---|
| **Node.js ≥ 18** | ✅ 必需 | 跑脚本：生成骨架、自检、截图、离线打包 | 页面能写，但没法批量建骨架、没法打包离线版 |
| **网络**（能访问 unpkg / jsdelivr） | ✅ 首次必需 | 原型运行时从 CDN 加载 React / antd；离线打包时把它们下到本地 | 页面打不开；离线包也做不出来 |
| **浏览器**（Edge 或 Chrome） | 建议 | 无头渲染自检 + 截图 | 少一道验收；页面本身照样能双击看 |
| **Git** | 可选 | 拉取/更新 skill | 直接拷目录也能用，只是更新要手动 |

**重要**：这个 skill **不需要 npm install、不需要构建、不装任何第三方包**。所有脚本都是单文件 Node 脚本，零依赖。

## 1. 让 AI 帮你装（推荐）

把下面整段贴给任意编码 AI（DSH / Claude Code / Cursor 都行），它会在你的机器上执行：

```text
帮我安装「prd2mpa」技能（PRD 转多页 HTML 原型）。我可能没有 Node 环境，请全程代我执行命令，不要让我自己敲。

要求：
1. 先检查环境：node -v、git --version、是否存在 Edge 或 Chrome，把结果列出来；
2. 如果本地已有 node 且 ≥ v18，直接用，不要升级；只有缺失或低于 v18 才装（新装用 24 LTS）：Windows 优先 `winget install OpenJS.NodeJS.LTS`；
   没有 winget 就去 https://nodejs.org 下 LTS 的安装包（.msi）；
   没有管理员权限时，下载 node-v24.x-win-x64.zip 解压到 D:\tools\node，
   把 D:\tools\node 加进用户 PATH，然后重开终端确认；
3. 确认 node -v ≥ v18（不满足才装，满足就不要动版本）之后，把仓库里的 skills/prd2mpa 整个目录放到我的技能目录：
   Windows 用目录联接（不需要管理员）：
   New-Item -ItemType Junction -Path "$env:USERPROFILE\.dsh\skills\prd2mpa" -Target "<仓库>\skills\prd2mpa"
   macOS/Linux 用软链：ln -s <仓库>/skills/prd2mpa ~/.dsh/skills/prd2mpa
4. 跑自检：node <技能目录>/scripts/doctor.mjs，把失败的项按它给的提示修掉，再跑一次直到「必需项都通过」；
5. 最后把每一步的命令和输出贴给我，并告诉我：技能装在哪、还差什么。
```

> 如果你的 AI 不能执行本机命令（只能在网页里聊天），那就按 §2—§4 手动做，或让 IT/开发同事帮你装。

## 2. 手动检查（30 秒）

打开 **PowerShell**（Windows）或 **终端**（macOS），粘贴：

```powershell
node -v
git --version
Test-Path "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
```

```bash
# macOS / Linux
node -v && git --version && ls /Applications/Google\ Chrome.app >/dev/null 2>&1 && echo chrome-ok
```

判定：`node -v` 输出 **v18.x 及以上**就算合格——**本地已有就继续用，不要为了版本号升级**；只有缺失或低于 v18 才按 §3 装（新装推荐 24 LTS）。其它项缺了按 §4 补。

## 3. 装 Node.js（三选一）

### A. 有 winget（Win10 1809 及以上最常见）

```powershell
winget install OpenJS.NodeJS.LTS
```

### B. 官网安装包（最稳）

打开 <https://nodejs.org> → 下载 **LTS** 的 `.msi`（Windows）或 `.pkg`（macOS）→ 一路下一步。
Windows 安装时保持默认勾选「Add to PATH」。

### C. 免安装版（没有管理员权限时用）

1. 打开 <https://nodejs.org/dist/> → 选 `v24.x.x/` → 下载 `node-v24.x.x-win-x64.zip`；
2. 解压到 **纯英文路径**，例如 `D:\tools\node`（解压后该目录里应直接能看到 `node.exe`）；
3. 把这个目录加进用户 PATH：

```powershell
# 只影响当前用户，不需要管理员；执行后必须重开终端
[Environment]::SetEnvironmentVariable("Path", [Environment]::GetEnvironmentVariable("Path","User") + ";D:\tools\node", "User")
```

4. 重开 PowerShell，`node -v` 应输出 `v24.x.x`。

### macOS

```bash
brew install node@24        # 有 Homebrew
# 或用官网 .pkg 安装包
```

> 装完 **一定要重开终端**（PATH 才会生效）；用 VS Code 的话要重启整个窗口，不只是新建标签页。

## 4. 把 skill 放到技能目录

skill 不是一个安装包，就是**一个目录**。不同宿主的技能目录不一样（DSH 是 `~/.dsh/skills`，Claude Code 是 `~/.claude/skills`，其他工具看它自己的设置）；不确定就让 AI 帮你找当前宿主的技能目录。

推荐做**目录联接**（改仓库、技能同步生效，不用反复拷）：

```powershell
# Windows（Junction 不需要管理员权限）
New-Item -ItemType Junction -Path "$env:USERPROFILE\.dsh\skills\prd2mpa" -Target "D:\gitData\codefree\ai-tools\skills\prd2mpa"
```

```bash
# macOS / Linux
ln -s /path/to/ai-tools/skills/prd2mpa ~/.dsh/skills/prd2mpa
```

没有技能目录就新建：`New-Item -ItemType Directory -Force "$env:USERPROFILE\.dsh\skills"`。

**备用方案**：直接把 `skills/prd2mpa` 整个目录复制过去。缺点是不随 `git pull` 更新，下次要重新拷。

**检查是否放对**：目录里应该直接看到 `SKILL.md`、`assets/`、`references/`、`scripts/` 四样；只拷了 `SKILL.md` 等于没装。

## 5. 装完自检

```powershell
node "$env:USERPROFILE\.dsh\skills\prd2mpa\scripts\doctor.mjs"
```

它会逐项检查并给出修复建议，正常长这样：

```text
prd2mpa · 环境自检
系统：win32 x64｜Node：v24.15.0

✓ Node.js 版本  v24.15.0（要求 ≥ 18，推荐 24 LTS）
✓ skill 文件完整  目录：C:\Users\you\.dsh\skills\prd2mpa
✓ 当前目录可写    D:\proto
✓ 浏览器         C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe
✓ CDN 连通      unpkg.com、cdn.jsdelivr.net 均可访问
✓ git         git version 2.43.0.windows.1
✓ 路径字符        纯英文，无空格

✅ 必需项都通过（警告 0 项）
```

- `✗` 是**必须修**（不修就跑不起来）；`!` 是**建议修**（不修也能出页面，少一点便利）。
- 修完再跑一次，直到「必需项都通过」。

**可选冒烟测试**（确认整条链路通，约 6 MB 下载）：

```powershell
cd D:\proto
node "$env:USERPROFILE\.dsh\skills\prd2mpa\scripts\scaffold.mjs" --manifest "$env:USERPROFILE\.dsh\skills\prd2mpa\assets\manifest.example.json"
```

生成成功会打印 6 个页面和一个目录名；双击里面的 `index.html` 能打开就说明环境没问题（页面内容是占位，正常）。

## 6. 常见问题

| 现象 | 原因 | 怎么办 |
|---|---|---|
| `node` 版本是 18/20/22 但脚本能跑 | 团队以 24 LTS 为参考，但不是硬要求 | **不要升级**，能跑就用；只有脚本报缺 API（低于 18）才装新版 |
| `node` 不是内部或外部命令 | 没装，或 PATH 没生效 | 重开终端；还不行按 §3-C 检查 PATH，`where node` 看能不能找到 |
| `winget` 不存在 | 系统版本较早/精简版 | 走 §3-B 官网安装包，或 §3-C 免安装版 |
| 安装被拦（无管理员/软件白名单） | 公司策略 | 用 §3-C 免安装版解压到用户目录，不写系统目录 |
| `npm install` 超时 | 公司代理 | **本 skill 不需要 npm**，直接跳过；CDN 慢就走离线包 |
| 页面打开一片空白 | 拿不到 CDN（代理/断网） | 让有网的机器跑 `scripts/offline.mjs` 生成离线版，整个目录拷过来 |
| `doctor` 报「CDN 不可达」 | 代理或防火墙 | 配代理后重试；现场断网则直接用离线包交付 |
| 中文/空格路径下报错 | 个别工具链对路径敏感 | 把仓库和产出目录放到纯英文路径，例如 `D:\proto` |
| PowerShell 提示「无法加载脚本」 | 执行策略限制 | 我们用 `node xxx.mjs` 直接跑，不经过 `.ps1`；无需改执行策略 |
| 没有 Edge/Chrome | 精简系统 | 装 Chrome；或用 `CHROME_PATH` 指向浏览器（截图自检才需要） |
| `doctor` 通过但 AI 说找不到 skill | 放错目录/只拷了单文件 | 见 §4 的「检查是否放对」；目录联接断开就重建 |

## 7. 更新与卸载

- **更新**：在仓库里 `git pull`，用目录联接的机器自动生效；复制安装的需要重新拷一次。
- **升级 Node**：直接装新版覆盖即可；装完重开终端、重跑 `doctor`。
- **卸载**：删掉 `%USERPROFILE%\.dsh\skills\prd2mpa` 这个联接/目录即可，不会影响仓库和其他技能。

---

装完回到 [SKILL.md](SKILL.md) 开始用；第一次做原型建议直接说：「按 `项目实施方案.md` 和 UI 规范，给我做 001 的设备与服务订购台原型」。



