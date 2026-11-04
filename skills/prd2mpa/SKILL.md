---
name: prd2mpa
description: 把产品需求文档（PRD）+ UI 规范文档，转成一套可直接双击打开、能点能改的多页 HTML 交互原型（每页自包含：CDN React 18 + antd 6 + Babel Standalone 实时编译 JSX，页面内用 Design Token 对齐 UI 规范）。当用户要做「原型」「多页原型」「demo 页面」「把方案做成能看到的东西」「给评审/客户看的交互演示」「PRD 转页面」「按 UI 规范出页面」，或者给出需求/方案文档并要求出界面、出页面时，都用这个 skill；用户没提 React/antd/CDN 时同样适用——这是团队约定的原型技术方案。
---

# PRD → 多页交互原型（CDN React + antd + Babel）

## 0. 这个 skill 做什么

把「产品需求文档（PRD）+ UI 规范文档」变成一套多页 HTML 原型：**每页自包含**，双击就能打开、能点、能改。

技术方案是固定的：CDN 引入 React 18 全家桶与 antd 6，用 Babel Standalone 在浏览器里实时编译 JSX。所以页面里写的就是真正的 JSX 源码，不是拖拽工具导出的死图。

> **第一次用、或换了台机器**：先按 [`INSTALL.md`](INSTALL.md) 把环境准备好（Node ≥ 18、浏览器、技能目录），装完跑一次 `node scripts/doctor.mjs` 自检，全绿再往下走。环境已经能用就直接跳下一步。

```text
<当前工作目录>/
└── {项目名称}-产品原型页面生成版（支持离线）/
    ├── index.html       原型目录（自动生成，评审入口，零依赖）
    ├── shell.js         ★ 共享壳：菜单 + 主题 + 顶栏/侧栏 + 状态标签（全站唯一一份）
    ├── login.html       产品页面：依赖 + Token + 页面代码（壳从 shell.js 引入）
    ├── orders.html
    ├── ...
    ├── vendor/          Step 5 生成的本地依赖（离线用，5—6MB）
    └── README.md        页面清单 / 演示数据口径 / 已知假设 / 依赖版本
```

### 共享壳与菜单（shell.js）

多页应用最容易出现的问题是**每页复制一份菜单**，改一个菜单项要改 N 个文件，漏一页就出现两套导航。所以壳和菜单只有一份：

- **`shell.js` 是唯一来源**：NAV 由 `scaffold.mjs` 从 manifest 的 `nav` 注入，顶栏、侧栏、菜单、主题、`ToneTag`、`PageHeader`、`money/fmtDate` 等助手都在这里；
- 每个页面只写 `<script src="shell.js"></script>` + 自己的 `PAGE CODE`；页面通过 `window.APP_META`（标题/短名/角色）和 `window.PAGE_ACTIVE`（当前菜单项）告诉它"这页是谁"；
- 角色差异在 `shell.js` 里按 `nav[].roles` 过滤，不用给每个角色复制一套菜单；
- **改菜单/配色只改 `shell.js` 一处**（配色还要同步页面里的 `TOKENS` 块），不要往页面里复制壳代码——`verify.mjs` 会拦。

> 为什么是普通 `.js` 而不是 `.jsx`：`file://` 下 Babel Standalone 读不到外部脚本（XHR/CORS 限制），`<script type="text/babel" src="shell.jsx">` 会直接失败。所以共享组件用 `React.createElement` 写成普通 JS，页面里的 JSX 照旧走 Babel。

### 依赖版本

版本表、为什么这么锁、升级四步、怎么判断某个版本能不能用，都在 [`references/versions.md`](references/versions.md)。这里只留一条要记住的：**React 停在 18.3.1（19 起没有 UMD），其余库取最新**；版本只在 `assets/template.html` 一处维护。

**这个 skill 不做什么**（先说清边界，避免返工）：

- **产物是可运行的原型，不是可构建的工程。** 原型用 React 18 + antd 6（CDN + 浏览器内 Babel 编译），没有构建、没有路由表、没有接口层；正式工程前端基线同为 React 18 + TypeScript + antd 6 + Vite（见产品需求文档里的工程基线章节，通常落在 `docs/工程基线.md`），所以页面能整页迁过去（见 `references/migrate-to-production.md`）。换到别的项目时以那个项目的工程基线为准——基线不是 React 就只搬结构、文案与交互，组件按 `references/antd-mapping.md` 换算。
- **不接真实接口**，不建后端、不做真实鉴权。数据一律页面内虚构，按钮只驱动前端状态。
- **覆盖全部需求，优先级只决定顺序。** 需求文档里的每个页面、菜单、流程、状态、异常和按钮级功能都要实现；P0/P1/P2 只表示先做哪一批、后做哪一批，不代表可以少做或降级。设计排期按「时间充裕」的前提走，不存在「这期先不做」的默认项。
- **不替业务做减法。** 只有需求文档自己明确排除的范围（如「本期不建设」章节）才可以不实现，并在覆盖矩阵里标「文档明确不做 + 出处」；其余一项都不能丢、不能降级。

评价一份原型好不好，看两件事：**评审的人能不能自己点着走完主流程**，以及**需求覆盖矩阵里每一行都能在页面上找到落点**（只有文档明确排除的项才允许空着，且要标出处）。

---

## 1. 开工前：先读什么

| 输入 | 从哪找 | 怎么读 |
|---|---|---|
| 产品需求文档（PRD / 需求说明 / 方案） | 用户给的路径；没给就问 | 先扫标题列表定结构，再精读：角色 → 主流程 → 业务对象与状态 → 规则与异常 → 页面/菜单描述 |
| UI 规范文档 | 同上；本 skill 自带一份可参考的 `UI规范文档.md` | 用户给了自己的规范就**以用户的为准**，按 `references/custom-ui-spec.md` 处理（换 Token、换主题、重做摘要）；没给就用自带的，并先读 `references/ui-interaction.md`、`references/ui-data-copy.md`，需要精确值时再回原文对应章节 |
| 已有原型 / 截图 / 竞品 | 用户给 | 只用于对齐信息密度和交互习惯，不照抄配色 |

> 用户自带 UI 规范时：不要直接套 skill 自带的 Token，按 [`references/custom-ui-spec.md`](references/custom-ui-spec.md) 的四步走（抽值 → 对照表 → `--template` 改模板 → 重做摘要）。

读文档时要顺手把这几件事记下来，它们是页面清单的原料：

1. **角色**：谁登录、能看什么、能做什么（原型里每个页面标一个「当前角色」）。
2. **主流程**：从进入系统到业务终态，一共几步，每步对应哪个页面。
3. **业务对象与状态**：订单、工单、任务… 各自的状态枚举和流转方向 → 直接决定状态标签和筛选器。
4. **规则与异常**：金额、时间、校验、容量、权限 → 决定表单校验和失败提示。
5. **硬事实**：名称、价格、区域、时段、字段名、术语 → 必须原样出现在原型里，不要自己另起一套叫法。

文档之间冲突时，**业务事实以项目文档为准，视觉与交互以 UI 规范为准**，并在 README 的「已知假设」里记一行。

---

## 2. Step 1：定页面清单与需求覆盖矩阵

先出清单，再写代码。**目标是覆盖需求文档里的全部页面与功能**——不是挑一条主流程做 demo；顺序按优先级排，不按「能不能省」排。

### 2.1 页面清单

| 页面 | 文件 | 优先级 | 角色 | 入口 | 用户进来要完成什么 | 关键区块 | 关键状态 |
|---|---|---|---|---|---|---|---|
| 记录列表 | `list.html` | P0 | 业务用户 | 侧栏 | 按条件找到记录并进入详情 | 筛选条、列表、分页 | 加载/空/失败 |
| 记录详情 | `detail.html` | P0 | 业务用户 | 列表点击 | 看清一条记录的完整信息并做操作 | 状态标签、基本信息、处理记录 | 正常/只读/无权限 |
| 新建记录 | `form.html` | P0 | 业务用户 | 侧栏 | 填完必填项并提交成功 | 分组表单、校验、操作区 | 校验中/提交中/失败 |
| 数据看板 | `dashboard.html` | P1 | 管理员 | 侧栏 | 一眼看到关键指标与待处理 | 指标卡、待办、趋势 | 有数据/无数据 |

优先级只表示**实现顺序**，不表示取舍：**P0** 先做（主流程闭环，能走完一条业务主线）；**P1** 第二批（关键异常、次要角色、次要流程）；**P2** 第三批（长尾功能、配置、展示类）。三批全部做完才算交付，没有「这期先不做」的默认项。

### 2.2 需求覆盖矩阵（防漏需求）

文档里每一条页面、菜单、流程、状态、异常、按钮级功能都要在矩阵里有一行；没有落点就是漏需求。

| 需求 / 规则 | 出处 | 落点页面 | 交付形态 | 优先级 |
|---|---|---|---|---|
| 提交成功后才占用额度，失败保持未提交 | §x.x | `form.html` + `detail.html` | 提交结果提示 + 状态标签 | P0 |
| 列表四类数量之和等于总数 | §x.x | `dashboard.html` | 指标卡 + 校验提示 | P1 |
| 导出当前筛选结果 | §x.x | `list.html` | 列表右上角按钮 + 结果提示 | P2 |
| 批量删除 | §x.x 明确不做 | — | 不提供入口 | 不做 |

清单规则：

- **页面数量由需求决定，不设上限。** 页面多不是问题；按 P0 → P1 → P2 推进，每轮 6—10 页便于自检和交接，但轮次只是节奏，不是范围。
- **不许删需求，也不许降级**：P0/P1/P2 只排先后，不排取舍。一轮做不完就分几轮，每一条最终都要落成页面或交互，并在 README 标「已完成」；不能从清单里消失，也不能悄悄降成「待确认」。
- 文档没画页面但明确有功能的（导出、字典维护、审批、消息），也要给落点：弹窗 / 抽屉 / 独立页三选一，写进矩阵。
- 只有文档自己明确「本期不建设」的条目，才写一行「不做 + 出处」，让评审知道是文档排除而不是我们漏了。
- 每个页面必须能回答「用户进来要完成什么」。答不上来的是「信息管理」式空页，合并或删掉。
- 页面 = 用户看到的一个完整任务单元，不是接口清单。一个列表页可以同时承载筛选、批量操作和详情抽屉。
- 登录、结果页、404 这类页面按需要给，不要为了凑数量硬加。
- 多角色应用：同一套页面用「当前角色」标注 + 菜单裁剪来表达；不要为每个角色复制一套页面。

---

## 3. Step 2：生成骨架（别手写 head）

依赖、Design Token、应用壳、antd 主题都已在 `assets/template.html` 里固定好。**手写 head 是这类原型最常见的翻车点**（顺序错、版本飘、Token 漏），所以先用脚本批量生成骨架：

1. 写一份 manifest，放在 `./prototype/prototype-001.json`（完整结构抄 `assets/manifest.example.json`，下面是节选）：

```json
{
  "app": "示例应用",
  "short": "示例",
  "role": "业务用户",
  "nav": [
    { "key": "list", "label": "记录列表", "icon": "ProfileOutlined", "href": "list.html" },
    { "key": "form", "label": "新建记录", "icon": "FormOutlined", "href": "form.html" }
  ],
  "pages": [
    { "file": "list.html", "title": "记录列表", "activeKey": "list", "desc": "按条件筛选并进入详情", "priority": "P0" },
    { "file": "form.html", "title": "新建记录", "activeKey": "form", "desc": "必填校验与提交", "priority": "P0" }
  ]
}
```

2. 生成（默认输出到**当前工作目录**下、以项目名命名的交付目录）：

```bash
node <SKILL_DIR>/scripts/scaffold.mjs --manifest ./prototype/prototype-001.json
# → ./示例应用-产品原型页面生成版（支持离线）/
```

3. 脚本会产出 `index.html`、每个页面的骨架、`README.md`。**再跑一次自检**：

```bash
node <SKILL_DIR>/scripts/verify.mjs --dir "./示例应用-产品原型页面生成版（支持离线）"
```

交付目录规则：

- **默认位置 = 当前会话的工作目录**，目录名固定为 `{项目名称}-产品原型页面生成版（支持离线）`；项目名默认取 manifest 的 `app`，多应用时可以用 `projectName` 明确写成「项目A-示例应用」，避免两个目录撞名。
- 目录名里的「支持离线」是**交付承诺**：里面最终必须包含 `vendor/`、断网可开（Step 5）。开发中途它还是在线态，`verify.mjs` 会提醒你收尾。
- 想换位置就写 manifest 的 `out`（相对 manifest 所在目录）或命令加 `--out`；一个应用一个目录，不要写进 skill 目录。

manifest 写法要点：

- `page.priority` 写 `P0` / `P1` / `P2`，只表示实现顺序，会出现在 README 页面清单和目录页卡片上；不写就是 `—`，评审看不出先做哪批。
- **菜单默认覆盖所有页面**：不写 `nav` 时，`scaffold` 按 `pages` 逐个生成菜单项（顺序 = 页面顺序，图标可用 `page.icon`）。登录页、流程页、详情页这类不想进菜单的，标 `"menu": false`——页面会以 `PAGE_IN_MENU=false` 生成，`verify` 据此判断，不会误报漏页。
- 需要自定义顺序、图标或合并菜单项时再写 `nav`：此时页面用 `activeKey` 归并到某个菜单项（如详情页 `activeKey: "list"` 高亮列表项）；`activeKey` 必须存在，`verify` 会检查。写了 `nav` 但漏掉某些页面，`scaffold` 会警告，`verify` 也会提示「页面不在菜单里」。
- `page.role` 可以覆盖该页顶栏的角色；管理员看的页面标「管理员」，业务用户看的标「业务用户」。
- `nav[].roles`（可选）限定菜单项只对某些角色显示，例如 `"roles": ["管理员"]`；自动生成的菜单也可以用 `page.roles` 达到同样效果。多角色应用用它裁侧栏，不要每页手改 `NAV`。
- 图标名用 `@ant-design/icons` 的真实名字（`AppstoreOutlined`、`ProfileOutlined`、`DatabaseOutlined`、`DeploymentUnitOutlined`、`ToolOutlined`、`FileDoneOutlined`…），写错会静默回落到默认图标。

---

## 4. Step 3：逐页实现

每个页面只改 `PAGE CODE START` 到 `PAGE CODE END` 之间的内容。其余部分（依赖、Token、主题、壳）由模板统一维护，**改一处会影响全部页面，别动**。

### 4.1 单页代码结构

固定按这个顺序写，读的人一眼能找到东西：

```jsx
/* 1. 数据：本页用到的演示数据（按业务对象分组，字段名对齐需求文档） */
const STATUS = { SUBMITTED: { text: '已提交', tone: 'primary' }, ... };
const MOCK_RECORDS = [ { no: 'REQ-2026-0001', applicant: '…', amount: 100, status: 'SUBMITTED', createdAt: '2026-11-04 09:12' } ];

/* 2. 子组件：一个有独立职责的块（工具栏、详情抽屉、状态标签组）。单一 return 用表达式体 */
const RecordDetail = ({ record, onClose }) => (
  <Card>…</Card>
);

/* 3. 主组件：状态 → 派生数据 → 布局。超过 120 行就拆子组件；有 hooks/局部变量用块体 */
const Page = () => {
  const { message } = AntApp.useApp();
  const [keyword, setKeyword] = useState('');
  const rows = useMemo(() => MOCK_RECORDS.filter(...), [keyword]);
  return <Shell title="记录列表" desc="共 5 条记录" extra={<Button>刷新</Button>}>...</Shell>;
};
```

### 4.1.1 代码风格：组件一律箭头函数

团队约定：所有 React 组件都写成 `const Xxx = (props) => …`，**不用 `function Xxx()` 声明**。这不是审美偏好：

- 正式工程里的组件也是箭头函数，原型整页搬过去时不用先做一轮语法改写；
- `const` 声明不会被提升，组件必须先定义后使用——顺序一目了然，也避免了「在文件底部定义的组件被前面的代码悄悄调用到」这类隐性问题；
- 与 hooks 的写法一致（`const Page = () => { const [x, setX] = useState() … }`），读起来和真实源码是同一种形状。

具体约定：

| 场景 | 写法 |
|---|---|
| 只有一个 `return`（纯展示组件） | `const Tag = ({ text }) => <span>{text}</span>;` |
| 有 hooks、局部变量或多段逻辑 | `const Page = () => { … return (…); };` |
| 事件回调 / 渲染函数 | 同样用箭头：`onClick={() => setOpen(true)}`、`render: (v) => money(v)` |
| 普通工具函数 | 也用箭头 `const money = (n) => …`；需要提升或在定义前调用的，才用 `function` |

`verify.mjs` 会检查这一点：页面里出现 `function Xxx(` 形式的大写组件声明会直接报错。

### 4.2 已经准备好了什么（直接用，别重复造）

| 能力 | 怎么用 |
|---|---|
| 应用壳 | `<Shell title desc extra>{children}</Shell>`：顶栏 54 + 侧栏 200 + 内容边距 24，标题 20/28 + 说明 text-3 + 右上角操作区。**来自 `shell.js`，不要在页面里再写一遍** |
| 菜单 | 由 `shell.js` 从 manifest 的 `nav` 生成，全站一份；页面只声明 `window.APP_META`（标题/短名/角色）和 `window.PAGE_ACTIVE`（选中项） |
| 主题 | `shell.js` 的 `UI` 调色板 → `APP_THEME` → `ConfigProvider`（主色/圆角/控件高/表头底色/字体…）。**不要在页面里写死十六进制色值**，用 `var(--ui-*)` |
| 状态标签 | `<ToneTag tone="success|warning|danger|primary|info">已完成</ToneTag>`：浅底 + 深色字，圆角 2 |
| 金额/数字/日期 | `money(499)` → `¥499.00`；`num(1200)` → `1,200`；`fmtDate(v)` / `fmtDateTime(v)`；数字列加 `className="ui-numeric"` |
| antd 组件 | 页面脚本顶部已解构 P0/P1 组件（Button/Input/Select/Table/Form/DatePicker/Modal/Drawer/Tabs/Steps/Descriptions/Tag/Card/Result/Empty/Skeleton…）。缺的直接写 `<antd.Xxx />`，**别在页面里再 `const { Xxx } = antd`**（会重复声明报错） |
| 图标 | `<icons.ReloadOutlined />`；`icons` 是 `@ant-design/icons` 全局对象 |
| 消息/弹窗 | `const { message, modal } = AntApp.useApp();` 再 `message.success('…')`。静态 `antd.message.xxx` 能跑但拿不到主题上下文 |

### 4.3 页面怎么写才算「质量贴近真源码」

- **布局先定骨架，再填内容**：按 UI 规范 4.2 的页面模板选一个（列表 / 详情 / 表单 / 工作台 / 结果 / 多步骤；设置页用锚点导航自建），骨架照 `references/page-patterns.md` 抄，别即兴发挥。
- **交互必须真能点**：筛选真的过滤、分页真的翻页、表单真的校验、提交有 loading → 成功/失败、危险操作有二次确认、状态流转有反馈。演示用的「假按钮」一律改成真实前端行为，或明确标注「原型未实现」。
- **四态至少覆盖主列表**：加载（`loading`）、空（首次为空 / 筛选无结果，两种文案不同）、失败（可重试）、无权限（说明范围 + 返回）。骨架屏只在首屏或整块替换时用，局部刷新用 loading。
- **文案按规范写**：用「你」不用「您」；按钮用具体动词（「提交订单」不是「确定」）；错误文案说「怎么改」不说「你错了」；金额两位小数 + 千分位；日期 `YYYY-MM-DD`，时间 `YYYY-MM-DD HH:mm`。
- **数据要像真的**：用需求文档里的名称、区域、价格、字段名；单号、设备编号有稳定命名规则；时间基准固定成某一天（写进 README），别用 `new Date()` 让每个人看到的日期都不一样。
- **单页代码控制在 400 行以内**。超了先拆子组件；还超就说明这一页承担了多个任务，回 Step 1 拆页。

### 4.4 跨页的一致性

页面之间不共享代码，所以一致性靠「约定」而不是「引用」：

- 先把**演示数据字典**写进 README（申请人、联系人、类型、单号规则、时间基准），每页的 `MOCK` 都从这里取同一批值。
- 跳转用 `window.location.href = 'list.html'` 或 `<a href>`；**不要**用 `history.pushState` 做假路由（file:// 下会乱）。
- 需要跨页保持的状态（比如刚提交的记录要出现在列表里）用 `localStorage`，key 固定成 `proto:<app>:<object>`，并在页面里做「取不到就用种子数据」的兜底。不需要连续感就别做，静态种子更省事。
- **每页都要能直接打开**——评审人常从 `index.html` 直接点进第 5 页，不会先走一遍流程。所以跨页状态只能当增强：取不到就用一个合理的默认值继续，把「按默认条件准备数据」这类话写进页头说明，**不要弹警告 Alert**（直开就报警会让人以为页面坏了）。
- 带参数的页面（`detail.html?id=…`、`confirm.html?no=…`）同样要能直开：没有参数时落到种子数据里的一条记录、渲染**正常态**，并在页头小字说明「演示：已按 REQ-20261104001 准备」；真正的「找不到」错误态只留给传了非法参数的情况。

> 原型评审通过、要变成正式工程代码时，按 [`references/migrate-to-production.md`](references/migrate-to-production.md) 走：逐项替换表、搬的时候不能变的三件事、新增工作量清单；React 18→19 的差异见 [`references/react-18-19.md`](references/react-18-19.md)。

---

## 5. Step 4：自检（交付前必跑）

```bash
# 1) 静态契约检查：依赖顺序、Babel 脚本、Token、壳、主题、导航链接、占位符
node <SKILL_DIR>/scripts/verify.mjs --dir "./示例应用-产品原型页面生成版（支持离线）"

# 2) 渲染检查（可选，需要本机 Edge/Chrome）：每页截图 + 判断是否白屏
node <SKILL_DIR>/scripts/shot.mjs --dir "./示例应用-产品原型页面生成版（支持离线）"
```

`verify.mjs` 失败项都是硬伤，必须清零；`shot.mjs` 报 `#root 为空` 基本等于 JSX 编译失败或组件名写错。

然后人工走一遍（这一步不能省）：

- [ ] 双击 `index.html`，每个卡片都能进；每页侧栏能互跳，能回到目录。
- [ ] **菜单在每一页完全一致**（顺序、文案、图标、选中态），且覆盖全部页面；流程页/登录页用 `menu: false` 明确排除。改 `shell.js` 一处后所有页面同步变化，`verify.mjs` 会检查「页面在不在菜单、高亮对不对」。
- [ ] **从目录逐个点开每一页**：首屏必须是正常内容（有数据的表格/表单/详情），不是错误态、不是空表、不是「请先选择…」。这一步最容易发现问题——页面自己按流程走一遍是通的，评审人直开却是坏的。
- [ ] 主流程从第一步走到终态，中间不出现死路（按钮点了没反应、返回没有入口）。
- [ ] 主列表：筛选有结果 / 筛选无结果 / 首次为空，三种画面文案不同。
- [ ] 表单：必填留空能拦住、手机号/日期格式错误有提示、提交后失败能重试。
- [ ] 危险操作有确认，确认文案里有对象和后果。
- [ ] 每个页面的角色标注和它能做的操作对得上（业务用户看不到管理员的入口）。
- [ ] 任意一页改坏（比如删掉一个组件）只影响这一页，其他页正常。
- [ ] **需求覆盖矩阵逐行核对**：每行都有落点页面；只有文档明确排除的项才允许空着，且要标出处。
- [ ] README 的「实现顺序与状态」里每一项都是「已完成」——还有「待做」就说明这轮没交付完，不能宣布完成。
- [ ] 交付目录名含「支持离线」→ 已经跑过 `offline.mjs`，`vendor/` 齐全，`shot.mjs --offline` 全绿。

---

## 6. Step 5：离线化（交付前必做）

交付目录名里写着「**支持离线**」，所以这一步不是可选项：把页面引用的 CDN 资源全部下到本地 `vendor/`，页面改成相对路径，整份目录拷进内网、U 盘或断网会议室都能双击打开。

```bash
# 就地离线化（默认交付目录）
node <SKILL_DIR>/scripts/offline.mjs --dir "./示例应用-产品原型页面生成版（支持离线）"

# 想额外留一份在线版对照，再复制一份出去
node <SKILL_DIR>/scripts/offline.mjs --dir "./示例应用-产品原型页面生成版（支持离线）" --out ./示例应用-在线版
```

它按顺序做五件事：

1. 扫描每个页面的 `<script src>` / `<link href>`，按「**库名-版本.后缀**」下载到 `vendor/`：`react-18.3.1.production.min.js`、`react-dom-18.3.1.production.min.js`、`dayjs-1.11.23.min.js`、`dayjs-1.11.23.zh-cn.js`、`antd-icons-6.3.4.umd.min.js`、`antd-6.6.8.min.js`、`antd-6.6.8.reset.css`、`babel-8.1.1.min.js`——版本写在文件名里，评审/交接时一眼看出用的哪版；
2. 页面里的 CDN 地址改成 `vendor/xxx` 相对路径；
3. **去掉这些脚本上的 `crossorigin` 属性**——`file://` 下带 crossorigin 的脚本会被浏览器按 CORS 拦掉，整页白屏（这是最容易踩的坑）；
4. 把「异步 import esm.sh 语言包」那段换成本地 `<script src="vendor/antd-zh-cn-6.6.8.js">`（`assets/antd-zh-cn.js` 是 antd 6.6.8 官方 locale 的快照，所以离线时日期组件仍是中文）；
5. 写 `vendor/SOURCE.md`（来源 URL、大小、sha256），并在 README 追加「离线查看」一节。

跑完它会自检：**页面里不允许残留任何 `http(s)://` 的 src/href 或远程 `import()`**，有就报错退出。

再补一次真离线渲染（屏蔽所有域名解析，只有本地文件能加载）：

```bash
node <SKILL_DIR>/scripts/shot.mjs --dir "./示例应用-产品原型页面生成版（支持离线）" --offline
```

离线版必须 7/7 全绿；用同一个命令跑**在线版**会白屏——那是正常的，正好说明这条检查确实能发现问题。

注意：

- 离线化是**就地**改写（同一个目录，名字不变），跑完这个目录才真正对得起「支持离线」四个字；`verify.mjs` 会在目录名含「支持离线」但页面还在引用 CDN 时提醒你。
- `file://` 下不能 `fetch` 本地文件、不能加载本地 ES module，所以语言包必须是普通 `<script>`；不要自己改回 `import './vendor/...'`。
- `vendor/` 由整目录共用，页面平铺在同一层时路径就是 `vendor/xxx.js`；页面挪进子目录要跟着改路径。
- 体积约 5.5 MB（antd + Babel 占大头），发给客户时连 `vendor/` 一起压缩，别只发 `*.html`。
- 离线后 `verify.mjs` 依然通过：依赖检查同时认 CDN 地址和 `vendor/` 文件名。
- 升级 React / antd / Babel 后重新跑一次，`vendor/SOURCE.md` 的哈希会一起更新；不要只手改文件名。

---

## 7. 红线（评审会当场指出来的那种）

1. **改共享层**（依赖、Token、`shell.js` 里的 `UI` 调色板 / `APP_THEME` / `AppShell`）——一处改错全部页面一起坏；改完重新生成或重新离线打包。
2. **写死颜色/圆角/字号**——除了 Token 块和 `TONE` 表，页面里只允许 `var(--ui-*)`。
3. **用 antd 4 的 API**：`visible` → `open`、`bodyStyle` → `styles.body`、`dropdownRender` → `popupRender`、`onDropdownVisibleChange` → `onOpenChange`。
4. **页面里 `import` / `export` / `require`**——浏览器内编译没有打包器，直接白屏。
5. **用 `function` 声明组件**（`function Page() {}`）——团队约定组件一律箭头函数 `const Page = () => …`，`verify.mjs` 会报错。
6. **一个页面塞两个 `type="text/babel"` 脚本**——只有第一个会被可靠执行。
7. **`new Date()` 当业务时间**——每次打开数据都在变，演示对不上口径。
8. **把真实业务规则编出来**：文档没写的金额、审批条件、权限，宁可标「待确认」，不要自己发明一套。
9. **在每个页面里复制壳或菜单**——壳、菜单、主题只在 `shell.js` 里，页面复制一份就会出现两套导航，`verify.mjs` 会拦。
10. **用「演示够用」砍需求或降级**：范围由需求文档和用户定，全部都要实现；P0/P1/P2 只排先后，不排取舍。只有文档自己写明「本期不建设」的才可以不做，并标出处。
11. **抄一份别的页面进来当「复用」**——重复代码会立刻分叉；要复用就抽子组件写在同一个页面里，或接受重复并在 README 记录。

---

## 8. 常见故障排查

| 现象 | 原因 | 处理 |
|---|---|---|
| 整页白屏 | JSX 语法错、组件名写错、`import` 混进来 | F12 Console 看第一条报错；`shot.mjs` 也会报 `#root 为空` |
| 组件没渲染但没报错 | 用了没解构的组件名（如 `DatePicker` 拼错），或 `<antd.Xxx>` 对象名不对 | 用 `<antd.Xxx />` 或检查大小写 |
| 颜色/圆角全不对 | 页面自建了 `ConfigProvider` 覆盖 `THEME`，或主题 token 被改 | 页面只渲染 `<Shell>`，ConfigProvider 只在模板出口用一次 |
| 日期组件是英文 | `zh_CN` 语言包没加载（离线/CDN 被拦） | 属预期降级：页面仍可用；需要固定中文时给 DatePicker 显式传中文 `placeholder` |
| 字体/表格行高离谱 | 用了 `size="small"` 又叠加自定义 padding | 表格统一 `size="middle"`；行高由 `THEME` 的 `cellPaddingBlockMD` 控制 |
| 弹窗按钮是英文 OK/Cancel | 没传 `okText`/`cancelText` | 所有 Modal/Popconfirm 显式写中文按钮 |
| 页面间跳转 404 | 文件名大小写不一致，或 `href` 写成 `./pages/x.html` | 全部平铺在同一目录，文件名小写短横线 |
| `.html` 打开后一片空白且没有任何请求 | 用了 `type="module"` 包 JSX | 只允许 `<script type="text/babel" data-presets="react-classic">` |
| 某个页面不在菜单里 | 没写 nav 时会自动生成；写了 nav 就漏了这项，或该页该标 `menu: false` | 补 nav 项，或给页面加 `"menu": false`；`verify` 会提示缺哪页 |
| 某页菜单和高亮项不对 | 页面没声明 `window.APP_META` / `window.PAGE_ACTIVE`，或用了旧的页面级 NAV | 这两项由模板注入，别在页面里改；菜单本身只改 `shell.js` |
| 断网 / 内网现场打开白屏 | 还没打包离线版，CDN 拿不到 | 跑 `scripts/offline.mjs`；它会把 `crossorigin` 去掉、语言包换成本地快照 |
| 离线版双击白屏但 DOM 里有内容 | 残留 `crossorigin` 或写成 `import './vendor/...'` | 重新跑 `offline.mjs`；本地脚本不要带 `crossorigin`、不要用 ES module |

---

## 9. 参考文件

| 文件 | 什么时候读 |
|---|---|
| `INSTALL.md` | 环境还没装好时先看这个：Node、浏览器、技能目录、`doctor.mjs` 自检 |
| `assets/shell.js` | 共享壳与菜单的唯一来源：改菜单、改配色、改顶栏/侧栏尺寸时 |
| `assets/template.html` | 单页模板：依赖、Token、页面骨架；**壳与菜单不在这里**（在 `shell.js`） |
| `assets/manifest.example.json` | 写 manifest 时抄结构（nav 会被注入 `shell.js`） |
| `assets/antd-zh-cn.js` | 离线版用的 antd 语言包快照（`offline.mjs` 自动复制，不用手改） |
| `references/page-patterns.md` | 写每一页之前：六类页面模板的可复制 JSX 骨架 |
| `references/antd-mapping.md` | 选组件、查尺寸、避开 antd API 陷阱时 |
| `references/ui-interaction.md` | UI 规范第 4/5/6/9 章压缩版：框架尺寸、页面模板、容器决策、状态与异常 |
| `references/ui-data-copy.md` | UI 规范第 7/8/10 章压缩版：表单、表格、数字格式、文案 |
| `references/react-18-19.md` | 把原型代码搬进 React 19 的正式工程时：已移除 API、旧 context 改法、迁移检查清单 |
| `references/custom-ui-spec.md` | 用户自带 UI 规范时：抽值、对照表、`--template` 改模板、重做摘要 |
| `references/migrate-to-production.md` | 原型评审通过、要变成正式工程代码时：逐项替换表、不能变的三件事、新增工作量 |
| `references/versions.md` | 升级依赖时：锁定版本表、升级四步、怎么判断新版本还能不能用 |
| `UI规范文档.md` | 需要精确数值/条款原文时，按章节号回查 |
| `scripts/offline.mjs` | 交付前打成离线版：把 CDN 资源下到 `vendor/`、去 `crossorigin`、换本地语言包 |
| `scripts/doctor.mjs` | 装完环境跑一次：Node 版本、文件完整性、目录可写、浏览器、CDN 连通性 |

> 产品需求文档、原型截图、竞品由用户提供，不随 skill 分发；skill 自带的是 UI规范文档.md（UI 口径原文）与上表这些执行用文件。







