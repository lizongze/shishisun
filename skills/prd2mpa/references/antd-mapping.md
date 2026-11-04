# UI 规范（Arco）→ antd 6 落地映射

规范文档以 Arco Design 为底座，原型用 antd 6。**按语义映射，不逐像素复刻**：能对齐的对齐（尺寸、颜色、密度、交互位置），对不齐的记在最后一节，别为了「像」造一套假组件。

所有映射已经在 `assets/template.html` 的 `THEME` 里配置好了。页面里不要重复配置主题，也不要把十六进制色值写进样式——用 `var(--ui-*)`。

---

## 1. 尺寸与字号

| 规范项 | 规范值 | antd 落地 |
|---|---|---|
| 控件高（中/默认） | 32 | `controlHeight: 32`（antd 默认即 32，`size` 不传就是它） |
| 控件高（大） | 36 | `controlHeightLG: 36`，用 `size="large"` |
| 控件高（小） | 28 | `controlHeightSM: 28`，用 `size="small"`（antd 默认 small 是 24，已被覆盖） |
| 控件高（迷你） | 24 | 无对应档位：`size="small"` + `style={{ height: 24 }}`，仅表格行内用 |
| 圆角（控件/按钮/输入） | 2 | `borderRadius: 2 / borderRadiusSM: 2` |
| 圆角（卡片/弹窗） | 4 | `borderRadiusLG: 4` |
| 页面标题 | 20/28 Medium | 标题区组件 `PageHeader`（模板里已实现），不要用 `Typography.Title` 改层级 |
| 正文 / 说明 | 14/22 · 13/22 | `fontSize: 14`、`lineHeight: 22/14`；说明文字用 `13px` 或 `var(--ui-text-3)` |
| 间距阶梯 | 4/8/12/16/20/24/32 | `var(--ui-space-xs…)` 或 antd `Space size`／`Row gutter` |
| 顶栏 / 侧栏 | 54 / 200（折叠 56） | `components.Layout.headerHeight: 54`、`Shell` 里 `Sider width={200}` |
| 内容边距 | 24（1024—1279 为 16） | `var(--ui-content-padding)`，模板已带媒体查询 |
| 表头 / 数据行 | 36 / 37（中密度） | `Table size="middle"` + `cellPaddingBlockMD: 7` |
| 弹窗宽度 | S400 / M520 / L720 / XL960 | `Modal width={520}`（默认档）；不要留空用 antd 默认 520 以外的值 |
| 抽屉宽度 | S320 / M480 / L720 / XL960 | `Drawer width={480}` 显式传；antd 默认 378 不在档位上 |

字号别用 `<Typography.Title level={5}>` 去凑 20px——层级语义和视觉尺寸不是一回事，直接用内联样式或 `PageHeader`。

---

## 2. 组件映射

| 规范里的组件 | antd 6 | 关键写法与注意 |
|---|---|---|
| Button（主要/次要/虚框/线框/文本） | `Button` | `type="primary"｜"default"｜"dashed"｜"text"｜"link"`；危险用 `danger`；链接型行内操作 `type="link" size="small" style={{padding:0}}` |
| Button-group | `Space` / `Button.Group` | 只表示相关动作集合，不表达互斥；互斥视图切换用 `Segmented` |
| Input / Textarea | `Input` / `Input.TextArea` | 长文本加 `showCount maxLength` |
| InputNumber | `InputNumber` | 带单位用 `addonAfter`，不要塞进 placeholder |
| Select（含搜索） | `Select` | `showSearch optionFilterProp="label"`；可清空 `allowClear`；选项多时配 `filterOption` |
| Cascader / TreeSelect | `Cascader` / `TreeSelect` | 省市区、组织架构 |
| Radio / Checkbox / Switch | 同名 | 互斥且需一眼比较用 `Radio.Group`；立即生效用 `Switch`，随表单提交用 `Checkbox` |
| DatePicker / RangePicker / TimePicker | 同名 | 值必须是 `dayjs` 对象；显式传 `format="YYYY-MM-DD"`；`disabledDate` 用 `current.isBefore(dayjs('…'))` |
| Form | `Form` | `layout="vertical"`、`requiredMark`、`form={form}`；错误文案写在 `rules[].message` |
| Table | `Table` | `size="middle"`、`rowKey`、`pagination`、`locale.emptyText`、`scroll={{x}}` |
| Tabs | `Tabs` | `items` 数组，不要 `TabPane` |
| Steps | `Steps` | `items` + `current`，进度型流程 |
| Descriptions | `Descriptions` | `items` + `column={2}`，标签色已在主题里设成 text-3 |
| Tag（状态标签） | `Tag` + 自定义色 | 用 `ToneTag`，不用 antd 预设 `color="success"`（预设色不是规范色） |
| Modal | `Modal` | `open`（不是 `visible`）；`width`；`okText`/`cancelText` 必须写中文 |
| Drawer | `Drawer` | `open`；`width` 显式；底部操作放 `footer` |
| Popconfirm | `Popconfirm` | 二次确认；`okText`/`cancelText` 中文；危险确认 `okButtonProps={{danger:true}}` |
| Message / Notification | `message` / `notification` | 必须 `const { message, notification } = AntApp.useApp();` |
| Alert | `Alert` | 区块级持续状态/表单级错误 |
| Empty / Result | 同名 | 四种空态文案不同；结果页最多 2 个操作 |
| Skeleton / Spin | 同名 | 首屏整块用 Skeleton，局部刷新用 Spin |
| Progress | `Progress` | 只有确定进度才用百分比 |
| Upload | `Upload` | 原型无后端：`beforeUpload={() => false}` + 本地 `fileList` 模拟 |
| Tooltip / Popover | 同名 | 纯文字解释用 Tooltip（≤20 字、不可操作）；要能点用 Popover；禁止 Tooltip 放链接 |
| Timeline / Collapse / List / Badge / Avatar | 同名 | 日志用 Timeline，分组用 Collapse，卡片列表用 List |
| Anchor | `Anchor` | 设置页左侧锚点导航（160px） |
| 图标 | `icons.XxxOutlined` | 来自 `@ant-design/icons` 全局对象，不是 `@ant-design/icons` 的 ESM 导入 |

---

## 3. 容器选择（直接对应规范 6.1/6.2）

判定顺序照抄，别按字段数拍脑袋：

| 场景 | 用什么 |
|---|---|
| 单对象局部微编辑 | 行内编辑 / `Popover` |
| 可撤销的轻操作 | 直接执行 + `message` 里带「撤销」 |
| 短任务、闭合、无回访需求 | `Modal width={520}` |
| 列表内单对象基础信息编辑 | `Modal width={520}`（默认档），保存后保留筛选/页码/滚动 |
| 需持续对照列表、连续切对象 | `Drawer width={480}` |
| 多分组、复杂校验、独立链接/草稿/多步 | 独立页面（`checkout.html` 这种） |
| 必须阻断的决策 | `Modal` + 明确后果 + 危险按钮不默认聚焦 |
| 后台完成的结果 | `notification`，而不是 `message` |

---

## 4. 表格落地要点

```jsx
<Table
  rowKey="no"
  size="middle"
  columns={columns}
  dataSource={rows}
  loading={loading}
  scroll={{ x: 960 }}
  locale={{ emptyText: searched ? <Empty description="没有找到符合条件的订单" /> : <Empty description="暂无订单" /> }}
  pagination={{ current, pageSize: 10, total, onChange: setPage, showTotal: (t) => `共 ${t} 条` }}
/>
```

- 列顺序：标识列 → 对象/客户 → 关键业务列 → 金额/数量 → 状态 → 时间 → 操作。
- 对齐：文本左对齐；金额/数量右对齐 + `className="ui-numeric"`；状态居中或左对齐一致即可，别混。
- 列宽：给关键列固定 `width`，其余让它自适应 + `ellipsis: true`；总宽超过 960 就开 `scroll.x`。
- **表格放进窄容器**（两栏布局的一栏、抽屉、卡片内）时必须给 `scroll={{ x: 列宽总和 }}`，否则列会被裁掉一截——这是最容易被忽略、又一眼可见的布局缺陷。
- 操作列 ≤2 个文字按钮，更多收进 `Dropdown`（`menu={{ items }}`）。
- 固定列：`fixed: 'right'` 只给操作列；横向无溢出时不要留阴影（antd 自动处理）。
- 加载：`loading` 会盖住表体但保留表头 ✓；首屏可用 `Skeleton active` 代替整表 loading。
- 空态与筛选无结果必须是两种文案：前者引导「新建」，后者引导「重置筛选」。

---

## 5. 表单落地要点

```jsx
<Form layout="vertical" requiredMark form={form} onFinish={submit}
  style={{ maxWidth: 'var(--ui-form-max-width)' }}>
  <Form.Item name="phone" label="手机号" rules={[
    { required: true, message: '请填写 11 位手机号' },
    { pattern: /^1\d{10}$/, message: '手机号应为 11 位数字，且以 1 开头' }
  ]}>
    <Input placeholder="11 位手机号" maxLength={11} />
  </Form.Item>
</Form>
```

- 标签在上（`layout="vertical"`），与控件间距 12px（主题里 `verticalLabelPadding: '0 0 12px'`）；字段间距 24（`itemMarginBottom: 24`）。
- 单列最大宽 640；双列最大宽 880（`Row gutter={24}` + `Col span={12}`），同一表单标签位置统一。
- 校验：`required` 用必填，格式用 `pattern`/`type`；错误文案说「怎么改」，例如「手机号应为 11 位数字，且以 1 开头」。
- 提交：`loading={submitting}` + `disabled`，`onFinish` 里先 `setSubmitting(true)`；失败保留输入。
- 只读用 `readOnly` 或 `Descriptions` 展示，**不要**用 `disabled` 假装只读。

---

## 6. antd 4 → 5 的 API 陷阱（写错就是白屏或警告）

| 旧写法（antd 4） | antd 6 写法 |
|---|---|
| `Modal visible` / `Drawer visible` / `Tooltip visible` | `open` |
| `bodyStyle` / `headerStyle` / `maskStyle` | `styles.body` / `styles.header` / `styles.mask` |
| `Tabs.TabPane` | `Tabs items=[{key,label,children}]` |
| `Menu` 的 JSX children | `items` |
| `Dropdown overlay={...}` | `menu={{ items }}` |
| `dropdownRender` | `popupRender` |
| `dropdownClassName` | `popupClassName` |
| `onDropdownVisibleChange` | `onOpenChange` |
| `Table.filterDropdownVisible` | `Table.filterDropdownOpen` |
| `Collapse.Panel` | `items` |
| `Descriptions.Item` | `items`（两者都可用，统一用 `items`） |
| `Steps.Step` | `items` |
| `Spin tip` 无内容 | 需要包裹内容或改用 `Skeleton` |
| 静态 `message.xxx` / `Modal.confirm` | `AntApp.useApp()` 取 `message` / `modal`，才有主题上下文 |

---

## 7. CDN + Babel 环境的硬约束

| 约束 | 说明 |
|---|---|
| 全局对象 | `window.React`、`window.ReactDOM`、`window.dayjs`、`window.antd`、`window.icons`；页面里不写 `import` |
| 依赖顺序 | React → ReactDOM → dayjs → icons → antd → Babel。**dayjs 必须在 antd 之前**，antd 的 UMD 包一加载就要读全局 dayjs |
| 脚本类型 | JSX 只能写在 `<script type="text/babel" data-presets="react">` 里，且每页只放一个 |
| 无模块系统 | 没有 `import` / `export` / `require`；组件靠 `antd` 全局取 |
| 语言包 | antd UMD 不含语言包，模板里用 esm.sh 异步取 `zh_CN`，失败自动退英文（页面仍可用） |
| 图标 | `@ant-design/icons` 是独立 UMD，全局名是 `icons`；`antd` 里没有 `Icon` 组件 |
| file:// 限制 | 不能 fetch 本地文件、不能加载本地 ES module；页面之间只靠 `<a>` / `location.href` 跳转 |
| 持久化 | 需要跨页记忆时用 `localStorage`（file:// 下可用），key 统一 `proto:<app>:<object>` |

---

## 8. 已知差异（原型接受，不要硬凑）

| 项 | Arco 规范 | antd 6 实际 | 处理 |
|---|---|---|---|
| Tag 高度 | 中档 28px、14/22 字 | 默认 22px、12px 字 | 用 antd 自然尺寸（`ToneTag` 已加浅底 + 深字 + 圆角 2），避免标签比按钮高 |
| 表头分隔线 | 表头单元格间有 border/2 分隔 | 默认有 `headerSplitColor` 分隔 | 保持默认，颜色已设 `#E5E6EB` |
| 按钮内距 | 5px 16px | 主题 `paddingInline: 16` | 视觉基本一致 |
| 弹窗头部 | header 48 / footer 64 | header ≈56 / footer ≈64 | 不强行压缩，避免文字被裁 |
| Select 箭头 | 12×12，右侧 12px | 默认 12px，位置接近 | 可接受 |
| Steps 样式 | 细线 + 数字 | 圆点图标 + 连接线 | 用 `size="small"`，语义一致 |
| 空状态插画 | Arco 插画 | antd Empty 插图 | 可接受 |
| 字体 | PingFang SC / Inter | 同一套回退栈 | 主题里已写入 `--ui-font-family-base` |

差异如果影响评审判断（比如客户要求像素级还原），在 README 的「已知假设」里写清楚，而不是偷偷改 Token。

