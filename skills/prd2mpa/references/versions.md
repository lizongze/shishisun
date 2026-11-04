# 依赖版本与升级步骤

> 什么时候读：升级依赖、排查「为什么页面白屏/样式不对」怀疑版本问题时。日常写页面不用看。
> 一句话：**React 停在 18.3.1（19 起没有 UMD），其余库取最新**；版本只写在 `assets/template.html` 一处。

## 锁定版本（2026-11）

| 库 | 版本 | 为什么是这个版本 |
|---|---|---|
| React / ReactDOM | **18.3.1** | **不能再升**：React 19 起官方不再发布 UMD 构建（`umd/react.production.min.js` 已 404），而本方案靠全局 `React` 加载 antd 的 UMD 包；除非整体改 ESM + importmap（`file://` 离线会失效），否则停在 18.3.1 |
| antd | **6.6.8** | 当前最新；`dist/antd.min.js`（UMD）仍随包发布，peer 要求 React ≥18，实测与 18.3.1 兼容 |
| @ant-design/icons | **6.3.4** | 与 antd 6 配套，UMD 全局名仍是 `icons` |
| dayjs | **1.11.23** | antd 日期组件依赖全局 dayjs；**必须在 antd 之前引入**，顺序反了整页白屏 |
| @babel/standalone | **8.1.1** | Babel 8 的 preset-react 默认 automatic runtime，会编译出 `import` → classic script 白屏；模板里注册了 `react-classic` 预设，页面统一 `data-presets="react-classic"` |
| Node.js（只跑脚本用） | **≥ 18 直接用** | 脚本用到 `fetch`、`AbortSignal.timeout`、`fs.cp`，最低 18。**本地已有 18+ 就继续用，不为版本号升级**；只有缺失或低于 18 才装（新装用 24 LTS） |

## 升级步骤（四步，别只改一处）

1. 改 `assets/template.html` 头部的版本号（`data-presets` 若是 Babel 8 以后版本，确认 `react-classic` 预设还在）；
2. 重新生成骨架（`scaffold.mjs`），或把已有页面的头部替换成新模板的头部、保留 `PAGE CODE` 区域；
3. `verify.mjs` + `shot.mjs` 各跑一遍：静态契约 + 真实渲染；
4. `offline.mjs` 重新打包：`vendor/` 文件名会带新版本号，`SOURCE.md` 的哈希一起更新。

升级大版本（如 antd 6 → 7）时额外做两件事：

- 看 antd 的 breaking changes，确认 `THEME` 里用到的组件 token（`cellPaddingBlockMD`、`headerHeight`、`itemHeight` 等）没被改名；
- 用 `shot.mjs` 截一页对比升级前后的截图，重点看表头高度、圆角、主色、Tag 样式。

## 怎么查最新版本，以及能不能用

```bash
# 最新版本号
curl -s https://registry.npmjs.org/antd/latest | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).version))"

# UMD 是否还存在（本方案的前提）
curl -I -s https://cdn.jsdelivr.net/npm/antd@6/dist/antd.min.js | head -1
```

判断口径：

- **有 `dist/*.min.js` 且全局名对得上**（antd → `antd`，icons → `icons`，babel → `Babel`）才能用；
- React 只有 18.x 有 `umd/`，19 起没有——这条决定了原型的 React 上限；
- 拿不准就先在 `assets/template.html` 里换版本，跑一次 `shot.mjs`，能渲染再改页面。

## 版本相关的常见症状

| 症状 | 先查什么 |
|---|---|
| 页面白屏，控制台报 `Cannot use import statement` | Babel 8 的 automatic runtime：检查是否漏了 `react-classic` 预设 |
| 白屏但没有任何报错 | 依赖顺序：dayjs 是否在 antd 之前；React UMD 是否加载成功 |
| 样式整体偏移、行高不对 | antd 大版本升级后组件 token 改名，用 `shot.mjs` 对比截图 |
| 日期组件英文 | 语言包没加载（离线包检查 `vendor/antd-zh-cn-<版本>.js` 是否存在） |
| `vendor/` 里文件名版本和页面引用不一致 | 只改了页面没重新跑 `offline.mjs`，或反过来 |
