# 用户自带 UI 规范时怎么处理

> 什么时候读：用户提供了自己的 UI 规范（设计稿、规范文档、Ant Design/Fusion 主题包、品牌手册）时。
> 结论：**以用户的规范为准，按它重新处理一遍**；skill 自带的 `UI规范文档.md` 只是默认值。
> 处理不好，原型一眼就不是他家的产品——评审会先注意到配色和圆角，而不是你的流程。

## 四步

### 1. 抽值（只抽会进代码的）

从用户规范里提这几类，别抄整份文档：

| 类别 | 要拿到的值 | 落到哪 |
|---|---|---|
| 主色 | 主色 + hover/active/浅底色阶（至少 1/3/5/6/7 五档） | `--ui-primary-*` + `UI.primary*` |
| 语义色 | success / warning / danger 的主色与浅底色 | `--ui-success-*` 等 + `UI.success*` |
| 中性色 | 文字 4 级、描边 2—3 级、填充 1—3 级、页面底色 | `--ui-text-*` / `--ui-border-*` / `--ui-fill-*` |
| 字体 | 字号与行高（标题/正文/辅助）、字体族 | `--ui-font-size-*` / `--ui-line-height-*` + THEME `fontSize/lineHeight/fontFamily` |
| 间距 | 间距阶梯（4/8/12/16/20/24/32 之类） | `--ui-space-*` |
| 圆角 | 控件圆角、卡片/弹窗圆角 | `--ui-radius-control/card/modal` + THEME `borderRadius*` |
| 控件高 | 默认/小/大控件高度 | `--ui-*` + THEME `controlHeight*` |
| 布局 | 顶栏高、侧栏宽、内容边距、表单最大宽 | `--ui-header-height` 等 + `UI.headerHeight/siderWidth` |
| 表格密度 | 表头高、数据行高 | THEME `cellPaddingBlockMD` 等 |

规范里没写的项，**沿用 skill 自带的值**，并在对照表里标「沿用默认」。

### 2. 建对照表

写进项目 README 或 `docs/ui-adapt.md`，三列就够：`规范值 → --ui-* 变量 → antd THEME 字段`。映射不上的单独列「差异」，别硬凑——比如规范用 28px 标签高度，antd 的 Tag 天然 22px，就写「按 antd 自然高度，接受差异」。

### 3. 改模板（不要改 skill 里的公共模板）

```bash
# 1) 复制一份到项目里
cp <skill>/assets/template.html ./prototype/template.html

# 2) 只改两处：
#    · TOKENS START / END 之间的变量值
#    · 脚本里 const UI = { … } 这个调色板（THEME、ToneTag、侧栏宽度都引用它）

# 3) 用它生成页面
node <skill>/scripts/scaffold.mjs --manifest ./prototype/prototype.json --template ./prototype/template.html
```

公共模板（`assets/template.html`）是其他项目在用的，**不要为了一个项目改它**；`--template` 参数就是为了避免这种污染。

依赖顺序、脚本类型、壳结构（顶栏 + 侧栏 + 内容区）都不要动——那是技术方案的一部分，不是视觉。

### 4. 重做摘要

把用户规范的「页面模板、容器决策、表单规则、表格规则、文案规则」重写成本项目的：

- `docs/ui-interaction.md`（骨架照 `references/ui-interaction.md`）
- `docs/ui-data-copy.md`（骨架照 `references/ui-data-copy.md`）

并在 README 记一行：**规范来源（文件名/版本/日期）+ 与默认规范的差异**。

## 注意

- 用户的规范是别家设计系统（Ant Design、Fusion、自研）时，**按语义映射，不逐像素复刻**；映射不上的登记差异，不要造一套假组件。
- 只给了视觉稿、没有文字规则：交互与文案沿用 `references/ui-interaction.md`、`references/ui-data-copy.md`，README 标「交互/文案沿用默认规范」。
- 改完必须重跑 `verify.mjs` + `shot.mjs`。`verify` 只校验 Token **结构**（变量存在、块没被删），不锁具体色值，所以自定义规范不会被误判；`shot` 用来确认换色后没有对比度/可读性问题。
- 用户规范与 PRD 冲突时（比如规范要求的状态色与业务语义不符），按「业务事实看 PRD、视觉看规范」处理，冲突登记在 README。
