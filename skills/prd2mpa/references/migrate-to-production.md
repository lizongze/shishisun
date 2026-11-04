# 原型搬进正式工程（React）

> 什么时候读：原型评审通过、要把它变成正式工程代码时。日常写原型不用看。
> 前提：正式工程前端基线是 React 18 + TypeScript + antd 6 + Vite（见产品需求文档的工程基线章节，通常落在 `docs/工程基线.md`）。基线不是 React 的话，只搬结构、文案与交互，组件按 `antd-mapping.md` 换算。

原型和生产工程用的是同一套 UI 技术（React 18 + antd 6）。基线一致时，页面能**整页搬**：把「浏览器里的那层胶水」换成工程设施即可，页面结构和样式基本不动。

## 逐项替换

| 原型里的写法 | 正式工程里换成 |
|---|---|
| `const { Button } = antd`（全局解构） | `import { Button } from 'antd'` |
| `<script type="text/babel" data-presets="react-classic">` | `.tsx` 文件，交给 Vite 等构建工具编译 |
| 页面里的 `MOCK_*` 常量 | api-client 请求 + 数据层（真实 loading / 失败分支） |
| `<a href>` / `window.location.href` | 路由（React Router 或团队已有方案），带 query / params |
| `localStorage` 的演示状态 | 服务端状态；本地持久化按团队约定 |
| `APP.role` 模拟的角色 | 登录态 + 权限组件 / 路由守卫 |
| `THEME` 常量 | 工程的 antd 主题配置（同一套 Token 值） |
| 页面里的 `var(--ui-*)` | 同一套 CSS 变量（把 Token 块搬进工程主题文件） |
| 手写的 `MOCK` 时间基准 | 真实时间与时区（`Asia/Shanghai`），不要再写死某一天 |

## 搬的时候不能变的

**页面结构与信息层级、状态文案、交互反馈路径**——这三样不变，评审时得出的结论才继续成立。可以变的是数据来源、路由、权限和类型。

## 新增工作量（原型里没有）

- 类型定义（Props、接口出入参）；
- 接口错误码与失败分支（原型里只有「失败态」的皮）；
- 权限边界（后端校验，前端只做入口显隐）；
- 真实文件上传、分页、排序的服务端参数。

别指望原型里有这些，也别因为「原型就是这么写的」而跳过它们。

## React 18 → 19

正式工程如果已经升级到 React 19：**页面代码基本不用改**（原型只用函数组件 + hooks + `createRoot`）。已移除 API、旧 context 改法、`ref`/`forwardRef` 变化、迁移检查清单见 [`react-18-19.md`](react-18-19.md)。

一句话：原型跑 18 是因为 19 不再发 UMD，**页面代码本身可以整页搬进 19**。
