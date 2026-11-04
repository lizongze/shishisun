# React 18 ↔ 19 差异（升级正式工程时看）

> 什么时候读：把原型代码搬进正式工程、或团队升级 React 版本时。日常写原型不需要看。
> 结论先放这里：**原型的页面代码可以整页搬进 React 19**，唯一不能搬的是「CDN + 全局变量」那层加载方式。

## 为什么原型停在 18.3.1

**React 19 起不再发布 UMD 构建**（`umd/react.production.min.js` 已 404）。技术方案三靠全局 `React` 加载 antd 的 UMD 包，所以原型只能停在 18.3.1；正式工程用构建工具，不受这个限制，直接上 19 没问题（antd 6 的 peer 是 `react >= 18`）。

页面代码本身几乎无差异——我们用到的 `createRoot`、`useState/useEffect/useMemo/useCallback/useRef` 在两个版本里行为一致。

## 差异对照

| 19 的变化 | 对原型代码的影响 | 搬到 19 时怎么做 |
|---|---|---|
| 移除 `ReactDOM.render` / `hydrate` / `unmountComponentAtNode` | 无（只用 `createRoot`） | 保持 `createRoot` |
| 移除函数组件上的 `defaultProps` | 无（用默认参数） | 改 `({ size = 'middle' }) => …` |
| 移除 `propTypes`、旧 context（`contextTypes` / `childContextTypes` / `getChildContext`） | 无（页面全是函数组件） | `propTypes` 换 TypeScript 类型；旧 context 改写见下 |
| 移除 `findDOMNode` / `React.createFactory` / 字符串 ref | 无 | 用 `useRef` |
| `ref` 可直接作为 prop（`forwardRef` 变成非必需） | 无（当前没用 `forwardRef`） | 新组件不必再包 `forwardRef`，旧的仍能跑 |
| ref 回调可以返回清理函数 | 无 | 18 里返回的函数会被忽略，别依赖它 |
| 新增 `use()` / `useActionState` / `useOptimistic` / Actions / Server Components | 用不上（原型无后端、无请求） | 真做表单提交时再用 |
| `createRoot` 新增 `onUncaughtError` 等选项 | 无 | 按需接错误上报 |

## 旧 context 怎么改

React 没有为旧 context 提供「19 版替代 API」——它早在 16.3 就被 `createContext` 取代了，19 只是把老的那套删干净。

```jsx
// ❌ 旧：class + contextTypes / childContextTypes（19 里直接移除，写了也被忽略）
class ThemeProvider extends React.Component {
  static childContextTypes = { color: PropTypes.string };
  getChildContext() { return { color: '#165DFF' }; }
}
class Label extends React.Component {
  static contextTypes = { color: PropTypes.string };
  render() { return <span style={{ color: this.context.color }} />; }
}

// ✅ 新：createContext + Provider + useContext
const ThemeContext = React.createContext('#1D2129');

const App = () => (
  <ThemeContext.Provider value="#165DFF">
    <Label />
  </ThemeContext.Provider>
);

const Label = () => {
  const color = React.useContext(ThemeContext);
  return <span style={{ color }}>标签</span>;
};
```

消费方三种写法：

| 消费方 | 写法 |
|---|---|
| 函数组件 | `const v = useContext(Ctx)` |
| class 组件 | `static contextType = Ctx;` → `this.context`（16.3 起，19 保留） |
| 需要在 JSX 里拿值 | `<Ctx.Consumer>{v => …}</Ctx.Consumer>` |

React 19 的两个新语法（可选）：

- 省掉 `.Provider`：`<ThemeContext value={…}>` 直接当 Provider（`.Provider` 仍兼容）；
- `use(Context)`：可以在 `if` / 循环里读，`useContext` 受 hooks 规则限制。

**唯一的坑**：提供方和消费方必须成对改。只删 `childContextTypes` 不换实现，下游 `this.context` 会变成 `undefined`，**不报错、静默取默认值**，表现成「主题/权限突然不对」。迁移时全局搜 `contextTypes`、`childContextTypes`、`getChildContext` 三个词，搜到一处就整组改。

## 原型侧要做什么

不用做任何事：页面全是函数组件，antd 的 `ConfigProvider`（主题、语言包）走的本来就是新 context。只要别在页面里写 `defaultProps`、`contextTypes`、`findDOMNode`、字符串 ref——`verify.mjs` 会对这几项报警告，`ReactDOM.render` 直接报错。
