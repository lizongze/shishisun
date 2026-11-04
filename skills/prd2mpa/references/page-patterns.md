# 页面模板：六类骨架的可复制 JSX

写页面之前先在这里选一个模板，把骨架抄进 `PAGE CODE` 区域，再替换业务字段。
骨架已经按 UI 规范 4.2 的页面结构与 5/6/7/8 章的尺寸、状态要求写好，**不要即兴改布局**。

约定（全文通用）：

- **组件一律箭头函数**：`const Page = () => …`、`const OrderDetail = ({ order }) => …`；单一 `return` 用表达式体，有 hooks/局部变量用块体。不要写 `function Page()`。
- `Shell / money / num / fmtDate / ToneTag / AntApp / STATE` 由模板共享层提供，直接用。
- 共享层没解构的组件写 `<antd.Xxx />`；图标写 `<icons.XxxOutlined />`。
- 表格统一 `size="middle"`（对应规范「中」：表头 36、数据行 37、padding 7px 16px）。
- 金额/数字列：`align: 'right'` + `className="ui-numeric"` + `money()`。
- 时间基准写死一个日期（示例里是 2026-11-04），不写 `new Date()`。
- 按钮文案用具体动词：`提交订单`、`确认派单`、`保存修改`，不用裸「确定」。

---

## 1. 列表页（最高频）

要素：页头 → 筛选区（≤4 项常驻）→ 批量条（选中后出现，在表格上方）→ 表格（四态）→ 分页（右下）。
有「查询」按钮时，筛选条件必须**点查询才生效**（草稿态与已应用态分开），否则用户会觉得条件没生效。

```jsx
const ORDER_STATE = {
  CREATED: { text: '待支付', tone: 'warning' },
  PAID: { text: '已支付待履约', tone: 'primary' },
  SERVICING: { text: '施工中', tone: 'primary' },
  COMPLETED: { text: '已完成', tone: 'success' }
};
const MOCK_ORDERS = [
  { no: 'SO20261104001', customer: '成都锦江智联科技有限公司', pkg: '智能看家', amount: 499, status: 'PAID', createdAt: '2026-11-04 09:12' }
];

const Page = () => {
  const { message } = AntApp.useApp();
  const [draft, setDraft] = useState({ keyword: '', status: undefined, range: null });
  const [query, setQuery] = useState({ keyword: '', status: undefined, range: null });
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState([]);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);
  useEffect(load, [load]);

  const rows = useMemo(() => MOCK_ORDERS.filter((row) => {
    const hitKeyword = !query.keyword || row.no.includes(query.keyword) || row.customer.includes(query.keyword);
    const hitStatus = !query.status || row.status === query.status;
    return hitKeyword && hitStatus;
  }), [query]);

  const searched = Boolean(query.keyword || query.status || query.range);

  const columns = [
    { title: '订单号', dataIndex: 'no', width: 180 },
    { title: '客户名称', dataIndex: 'customer', ellipsis: true },
    { title: '套餐', dataIndex: 'pkg', width: 120 },
    { title: '订单金额', dataIndex: 'amount', width: 140, align: 'right', render: (v) => <span className="ui-numeric">{money(v)}</span> },
    { title: '状态', dataIndex: 'status', width: 140, render: (v) => <ToneTag tone={ORDER_STATE[v].tone}>{ORDER_STATE[v].text}</ToneTag> },
    { title: '下单时间', dataIndex: 'createdAt', width: 140, render: (v) => <span className="ui-numeric">{fmtDate(v, 'MM-DD HH:mm')}</span> },
    {
      title: '操作', key: 'action', width: 120, fixed: 'right',
      render: (_, row) => (
        <Space size={8}>
          <Button type="link" size="small" style={{ padding: 0 }} onClick={() => setEditing(row)}>编辑</Button>
          <Button type="link" size="small" danger style={{ padding: 0 }} onClick={() => message.warning('原型未实现该操作')}>取消</Button>
        </Space>
      )
    }
  ];

  return (
    <Shell title="我的订单" desc="共 5 笔订单，最近一单 2026-11-04 10:03"
      extra={<Button icon={<icons.ReloadOutlined />} onClick={load}>刷新</Button>}>
      <Card style={{ marginBottom: 20 }}>
        <Space size={12} wrap>
          <Input allowClear placeholder="搜索订单号 / 客户名称" style={{ width: 240 }} value={draft.keyword} onChange={(e) => setDraft({ ...draft, keyword: e.target.value })} />
          <Select allowClear placeholder="全部状态" style={{ width: 160 }} value={draft.status} onChange={(v) => setDraft({ ...draft, status: v })}
            options={Object.entries(ORDER_STATE).map(([value, item]) => ({ value, label: item.text }))} />
          <DatePicker.RangePicker style={{ width: 260 }} value={draft.range} onChange={(v) => setDraft({ ...draft, range: v })} />
          <Button type="primary" onClick={() => { setQuery(draft); message.success('已按当前条件查询'); }}>查询</Button>
          <Button onClick={() => { const empty = { keyword: '', status: undefined, range: null }; setDraft(empty); setQuery(empty); }}>重置</Button>
        </Space>
      </Card>

      {selected.length > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', marginBottom: 12, background: 'var(--ui-primary-1)', borderRadius: 'var(--ui-radius-card)' }}>
          <span>已选 {selected.length} 项（当前页）</span>
          <Button size="small" onClick={() => message.success(`已批量处理 ${selected.length} 项`)}>批量通过</Button>
          <Button size="small" type="text" onClick={() => setSelected([])}>取消选择</Button>
        </div>
      ) : null}

      <Card styles={{ body: { padding: failed ? 32 : 0 } }}>
        {failed ? (
          <Result status="warning" title="加载失败" subTitle="网络连接失败，请稍后重试" extra={<Button type="primary" onClick={load}>重试</Button>} />
        ) : (
          <Table
            rowKey="no"
            size="middle"
            loading={loading}
            columns={columns}
            dataSource={rows}
            rowSelection={{ selectedRowKeys: selected, onChange: setSelected }}
            locale={{
              emptyText: searched
                ? <Empty description="没有找到符合条件的订单"><Button type="link" onClick={() => { const empty = { keyword: '', status: undefined, range: null }; setDraft(empty); setQuery(empty); }}>重置筛选</Button></Empty>
                : <Empty description="暂无订单"><Button type="primary" onClick={() => message.info('去选购套餐')}>去选购</Button></Empty>
            }}
            scroll={{ x: 960 }}
            pagination={{ current: page, pageSize: 10, total: rows.length, onChange: setPage, showTotal: (t) => `共 ${t} 条` }}
          />
        )}
      </Card>

      <Modal open={!!editing} title="编辑订单" width={520} onCancel={() => setEditing(null)}
        okText="保存修改" cancelText="取消" onOk={() => { setEditing(null); message.success('已保存修改（演示）'); }}>
        {/* 列表内单对象基础信息编辑默认走 Modal M520，见 ui-interaction 3.3 */}
        <Form layout="vertical">{/* 字段见模板 3 */}</Form>
      </Modal>
    </Shell>
  );
};
```

---

## 2. 详情页

要素：返回（左上，带图标）→ 标题 + 状态 Tag → Descriptions（1—3 列，标签 text-3）→ Tabs（≤6）→ 内容。
详情页**默认只读**；编辑走 Modal（单对象基础信息）或独立页（复杂任务），不要把详情页的字段直接变成输入框。

```jsx
const Page = () => {
  const [tab, setTab] = useState('detail');
  const order = MOCK_ORDERS[0];

  return (
    <Shell title={`订单 ${order.no}`} desc="创建于 2026-11-04 09:12 · 客户 成都锦江智联科技有限公司"
      extra={<Space>
        <ToneTag tone="primary">已支付待履约</ToneTag>
        <Button type="primary">派单</Button>
      </Space>}>
      <Card style={{ marginBottom: 20 }}>
        <Descriptions column={2} size="small" items={[
          { key: 'pkg', label: '套餐', children: '智能看家' },
          { key: 'amount', label: '订单金额', children: <span className="ui-numeric">{money(499)}</span> },
          { key: 'region', label: '施工区域', children: '锦江区' },
          { key: 'slot', label: '施工时段', children: '2026-11-05 上午' },
          { key: 'contact', label: '联系人', children: '张明 138****6621' },
          { key: 'address', label: '详细地址', children: '成都市锦江区东大街 88 号 3 栋 2 单元 1702' }
        ]} />
      </Card>

      <Card>
        <Tabs activeKey={tab} onChange={setTab} items={[
          { key: 'detail', label: '明细', children: <Table size="middle" pagination={false} rowKey="name" dataSource={[
            { name: '摄像头', spec: '智能摄像头标准版', price: 299 },
            { name: '观看账号', spec: '在线观看账号', price: 50 },
            { name: '云存储', spec: '云存储 30 天', price: 50 },
            { name: 'AI 看家包', spec: '智能看家专属', price: 100 }
          ]} columns={[
            { title: '项目', dataIndex: 'name' },
            { title: '规格', dataIndex: 'spec' },
            { title: '金额', dataIndex: 'price', align: 'right', width: 140, render: (v) => <span className="ui-numeric">{money(v)}</span> }
          ]} /> },
          { key: 'log', label: '操作日志', children: <Timeline items={[
            { children: '2026-11-04 09:12 客户创建订单' },
            { color: 'green', children: '2026-11-04 09:15 支付成功，预占库存 1 套' }
          ]} /> }
        ]} />
      </Card>
    </Shell>
  );
};
```

> 返回入口：`<Button type="text" icon={<icons.ArrowLeftOutlined />} onClick={() => window.location.href = 'orders.html'}>返回订单列表</Button>`，放在标题区左侧或说明行上方。

---

## 3. 新建 / 编辑页（表单）

要素：页头 → 单列表单（最大宽 640，靠左）→ 操作组（左对齐，次操作在左、主操作在右）。
标签在上、与控件间距 12；分组标题 16/24 Medium，分组之间 32；字段之间 24。

```jsx
const Page = () => {
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const submit = async (values) => {
    setSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setSubmitting(false);
    message.success('订单已创建，订单号 SO20261104002');
    window.location.href = 'orders.html';
  };

  return (
    <Shell title="填写结算信息" desc="创建订单后进入模拟收银台，不会真实扣款">
      <Card>
        <Form form={form} layout="vertical" requiredMark onFinish={submit}
          style={{ maxWidth: 'var(--ui-form-max-width)' }}
          initialValues={{ region: '锦江区', slot: '上午' }}>
          <div className="ui-section-title" style={{ marginBottom: 16 }}>安装信息</div>
          <Form.Item name="region" label="施工区域" rules={[{ required: true, message: '请选择施工区域' }]}>
            <Select placeholder="请选择施工区域" options={[{ value: '锦江区', label: '锦江区' }, { value: '高新区', label: '高新区' }]} />
          </Form.Item>
          <Form.Item name="address" label="详细地址" rules={[{ required: true, message: '请填写详细地址' }, { max: 60, message: '详细地址不超过 60 个字' }]}>
            <Input.TextArea rows={3} placeholder="街道、门牌号、楼栋单元房号" showCount maxLength={60} />
          </Form.Item>
          <Form.Item name="contact" label="联系人" rules={[{ required: true, message: '请填写联系人姓名' }]}>
            <Input placeholder="现场接收设备的联系人" style={{ width: 240 }} />
          </Form.Item>
          <Form.Item name="phone" label="手机号" rules={[
            { required: true, message: '请填写 11 位手机号' },
            { pattern: /^1\d{10}$/, message: '手机号应为 11 位数字，且以 1 开头' }
          ]}>
            <Input placeholder="11 位手机号" maxLength={11} style={{ width: 240 }} />
          </Form.Item>
          <Form.Item name="date" label="施工日期" rules={[{ required: true, message: '请选择施工日期' }]}
            extra="可选范围为下单次日之后，例如 2026-11-05">
            <DatePicker style={{ width: 240 }} format="YYYY-MM-DD" disabledDate={(current) => current && current.isBefore(dayjs('2026-11-05'))} />
          </Form.Item>
          <Form.Item name="slot" label="施工时段">
            <Radio.Group options={[{ value: '上午', label: '上午 09:00—12:00' }, { value: '下午', label: '下午 14:00—18:00' }]} />
          </Form.Item>

          <Divider style={{ margin: '32px 0 24px' }} />
          <Space size={12}>
            <Button onClick={() => window.location.href = 'packages.html'}>返回</Button>
            <Button type="primary" htmlType="submit" loading={submitting}>{submitting ? '提交中…' : '创建订单'}</Button>
          </Space>
        </Form>
      </Card>
    </Shell>
  );
};
```

---

## 4. 工作台首页

要素：指标卡（一行 ≤4）→ 待办 + 通知两栏 → 快捷入口。
指标卡：标题 14、数值 24—28（`tabular-nums`）、口径与时间范围写在卡上；卡片圆角 4、内边距 16。

```jsx
const MetricCard = ({ label, value, hint, tone }) => {
  return (
    <Card style={{ height: '100%' }}>
      <div style={{ fontSize: 14, lineHeight: '22px', color: 'var(--ui-text-2)' }}>{label}</div>
      <div className="ui-numeric" style={{ fontSize: 28, lineHeight: '36px', fontWeight: 600, marginTop: 4, color: tone ? `var(${tone})` : 'var(--ui-text-1)' }}>{value}</div>
      <div style={{ fontSize: 12, lineHeight: '20px', color: 'var(--ui-text-3)', marginTop: 4 }}>{hint}</div>
    </Card>
  );
};

const Page = () => {
  return (
    <Shell title="工作台" desc="数据截至 2026-11-04 09:00">
      <Row gutter={20} style={{ marginBottom: 20 }}>
        {[
          { label: '今日新单', value: '12', hint: '含 3 笔待支付' },
          { label: '待派单', value: '4', hint: '最早 2 小时前', tone: '--ui-warning-6' },
          { label: '施工中', value: '7', hint: '占用 5 个班组名额' },
          { label: '待验收', value: '2', hint: '已提交回单' }
        ].map((item) => (
          <Col span={6} key={item.label}><MetricCard {...item} /></Col>
        ))}
      </Row>
      <Row gutter={20}>
        <Col span={14}>
          <Card title="待处理" extra={<Button type="link" style={{ padding: 0 }} onClick={() => window.location.href = 'orders.html'}>查看全部</Button>}>
            <List dataSource={[
              { title: '订单 SO20261104001 待派单', time: '今天 09:12', urgent: true },
              { title: '施工单 CO20261103007 回单待审核', time: '昨天 18:20' }
            ]} renderItem={(item) => (
              <List.Item>
                <Space>
                  {item.urgent ? <ToneTag tone="danger">逾期</ToneTag> : null}
                  <span>{item.title}</span>
                </Space>
                <span style={{ color: 'var(--ui-text-3)', fontSize: 13 }}>{item.time}</span>
              </List.Item>
            )} />
          </Card>
        </Col>
        <Col span={10}>
          <Card title="通知">
            <List dataSource={[{ title: '锦江区班组容量已用满', time: '11-03' }]} renderItem={(item) => (
              <List.Item><span>{item.title}</span><span style={{ color: 'var(--ui-text-3)', fontSize: 13 }}>{item.time}</span></List.Item>
            )} />
          </Card>
        </Col>
      </Row>
    </Shell>
  );
};
```

---

## 5. 结果页 / 流程终态

最多 2 个操作；无权限也走这个模板，但必须给真实可用的申请或返回路径。

```jsx
const Page = () => {
  return (
    <Shell title="支付完成">
      <Card styles={{ body: { padding: '48px 24px' } }}>
        <Result
          status="success"
          title="支付成功，订单已进入待履约"
          subTitle="订单号 SO20261104001 · 已预占库存 1 套 · 施工时段 2026-11-05 上午"
          extra={[
            <Button key="orders" type="primary" onClick={() => window.location.href = 'orders.html'}>查看订单</Button>,
            <Button key="packages" onClick={() => window.location.href = 'packages.html'}>继续选购</Button>
          ]}
        />
      </Card>
    </Shell>
  );
};
```

---

## 6. 多步骤流程（派单 → 接单 → 领料 → 到场 → 回单）

要素：Steps（当前步高亮）→ 当前步内容 → 底部操作（上一步 / 下一步，主操作在右）。
步骤状态要能回看：已完成步可点回，未到的步不可跳。

```jsx
const STEPS = [
  { title: '派单', desc: '2026-11-04 09:20' },
  { title: '接单', desc: '2026-11-04 09:35' },
  { title: '领料', desc: '2026-11-04 10:10' },
  { title: '到场施工', desc: '进行中' },
  { title: '回单验收', desc: '待开始' }
];

const Page = () => {
  const [current, setCurrent] = useState(3);
  return (
    <Shell title="施工单 CO20261104001" desc="锦江区 · 智能看家 · 指派班组 锦江一组">
      <Card style={{ marginBottom: 20 }}>
        <Steps current={current} items={STEPS} size="small" />
      </Card>
      <Card title="到场施工" style={{ marginBottom: 20 }}>
        <Form layout="vertical" style={{ maxWidth: 'var(--ui-form-max-width)' }}>
          <Form.Item label="设备 SN" required><Input placeholder="扫码或输入设备 SN" /></Form.Item>
          <Form.Item label="安装结果"><Radio.Group options={['安装合格', '需返工']} /></Form.Item>
          <Form.Item label="安装前照片" required><antd.Upload listType="picture-card"><div>上传</div></antd.Upload></Form.Item>
        </Form>
      </Card>
      <Space size={12}>
        <Button onClick={() => setCurrent(Math.max(0, current - 1))}>上一步</Button>
        <Button type="primary" onClick={() => setCurrent(Math.min(STEPS.length - 1, current + 1))}>提交并进入回单</Button>
      </Space>
    </Shell>
  );
};
```

---

## 7. 四态与反馈片段（任何页面都用得上）

```jsx
{/* 加载：首屏整块用骨架，局部刷新用 Spin */}
<Card>{loading ? <Skeleton active paragraph={{ rows: 6 }} /> : <Content />}</Card>

{/* 失败：区块级错误态，必须给重试 */}
<Result status="warning" title="加载失败" subTitle="网络连接失败，请稍后重试"
  extra={<Button type="primary" onClick={reload}>重试</Button>} />

{/* 空：两种空态文案不同，筛选无结果引导“重置筛选” */}
<Empty description={searched ? '没有找到符合条件的订单' : '暂无订单'} />

{/* 操作反馈：结果已在界面上可见时不弹成功提示；不可见时才用 message */}
message.success('已导出，请到下载中心查看');

{/* 危险操作：写明对象、数量与后果，危险按钮不默认聚焦 */}
<Popconfirm title="取消订单 SO20261104001？" description="取消后库存预占会释放，订单不可恢复。" okText="取消订单" cancelText="再想想"
  okButtonProps={{ danger: true }} onConfirm={cancelOrder}>
  <Button type="link" size="small" danger style={{ padding: 0 }}>取消订单</Button>
</Popconfirm>

{/* 重命名等轻损失操作走二次确认；可撤销操作直接做，再给撤销入口 */}
message.success({ content: '已归档', btn: <Button type="link" size="small" onClick={undo}>撤销</Button>, duration: 10 });
```

---

## 8. 登录 / 独立居中页

登录页不套 `Shell`（没有侧栏导航），独立居中卡片 400px；登录后直接跳主流程第一页。
`verify.mjs` 对这类页面会提示「没有使用 Shell」，属预期，不用改。

```jsx
const Page = () => {
  const { message } = AntApp.useApp();
  const submit = () => {
    message.success('登录成功');
    window.location.href = 'packages.html';
  };
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--ui-page-bg)', padding: 24 }}>
      <Card style={{ width: 400 }}>
        <div className="ui-brand" style={{ marginBottom: 4 }}>
          <span className="ui-brand-mark">订</span>
          <span>设备与服务订购台</span>
        </div>
        <div style={{ color: 'var(--ui-text-3)', fontSize: 13, lineHeight: '20px', marginBottom: 24 }}>客户登录后可以选购套餐、下单支付</div>
        <Form layout="vertical" onFinish={submit} initialValues={{ account: 'customer01' }}>
          <Form.Item name="account" label="账号" rules={[{ required: true, message: '请填写账号' }]}>
            <Input placeholder="手机号或账号" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请填写密码' }]}>
            <Input.Password placeholder="输入密码" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>登录</Button>
        </Form>
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--ui-text-3)' }}>演示账号 customer01，原型不校验真实身份</div>
      </Card>
    </div>
  );
};
```

---

## 9. 交付前逐页抄一遍这张表

| 检查 | 通过标准 |
|---|---|
| 模板匹配 | 每页都能对应到上面 6 个模板之一；不能对应就说明页面职责没想清 |
| 标题区 | 标题是具体名词；说明一句；操作在右上角，主操作最右 |
| 操作区 | 每页主操作只有 1 个；次操作 ≤2；危险操作带 danger + 后果 |
| 四态 | 主列表四种状态都实现；加载态行数≈页容量，不整页长期转圈 |
| 表格 | 中密度；金额右对齐 + 千分位；状态用 ToneTag；操作列 ≤2；窄容器里给 `scroll={{x}}` 不被裁 |
| 表单 | 标签在上；必填有 `*`；错误在字段下方；提交期间按钮 loading + 禁用 |
| 弹窗 | 宽度按 520/720 档；有标题；按钮中文；次左主右；关闭不丢输入 |
| 文案 | 用「你」；按钮是动词；金额两位小数；日期 `YYYY-MM-DD` |
| 死路 | 每个出口都能走（返回、取消、关闭、重试至少有一个） |
