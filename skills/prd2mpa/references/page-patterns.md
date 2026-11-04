# 页面模板：六类骨架的可复制 JSX

写页面之前先在这里选一个模板，把骨架抄进 `PAGE CODE` 区域，再替换业务字段。
骨架已经按 UI 规范 4.2 的页面结构与 5/6/7/8 章的尺寸、状态要求写好，**不要即兴改布局**。

示例用一个中性的「申请单」场景（单号 `REQ-…`、申请人、类型、金额、状态、提交时间），照抄时把字段换成你需求文档里的对象即可。

约定（全文通用）：

- **组件一律箭头函数**：`const Page = () => …`、`const DetailCard = ({ record }) => …`；单一 `return` 用表达式体，有 hooks/局部变量用块体。不要写 `function Page()`。
- `Shell / ToneTag / PageHeader / money / num / fmtDate` 由 `shell.js` 提供（页面顶部 `const { AppShell: Shell, … } = window;` 取用），直接用；菜单也在 `shell.js`，不要在页面里复制。
- 共享层没解构的组件写 `<antd.Xxx />`；图标写 `<icons.XxxOutlined />`。
- 表格统一 `size="middle"`（对应规范「中」：表头 36、数据行 37、padding 7px 16px）。
- 金额/数字列：`align: 'right'` + `className="ui-numeric"` + `money()`。
- 时间基准写死一个日期（示例里是 2026-11-04），不写 `new Date()`。
- 按钮文案用具体动词：`提交申请`、`保存修改`、`确认删除`，不用裸「确定」。

---

## 1. 列表页（最高频）

要素：页头 → 筛选区（≤4 项常驻）→ 批量条（选中后出现，在表格上方）→ 表格（四态）→ 分页（右下）。
有「查询」按钮时，筛选条件必须**点查询才生效**（草稿态与已应用态分开），否则用户会觉得条件没生效。

```jsx
const APPLY_STATE = {
  DRAFT: { text: '草稿', tone: 'info' },
  SUBMITTED: { text: '已提交', tone: 'primary' },
  PROCESSING: { text: '处理中', tone: 'primary' },
  DONE: { text: '已完成', tone: 'success' },
  REJECTED: { text: '已驳回', tone: 'danger' }
};
const MOCK_APPLIES = [
  { no: 'REQ-20261104001', applicant: '张三', type: '标准类型', amount: 100, status: 'SUBMITTED', createdAt: '2026-11-04 09:12' },
  { no: 'REQ-20261103002', applicant: '李四', type: '高级类型', amount: 260, status: 'PROCESSING', createdAt: '2026-11-03 16:40' }
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

  const rows = useMemo(() => MOCK_APPLIES.filter((row) => {
    const hitKeyword = !query.keyword || row.no.includes(query.keyword) || row.applicant.includes(query.keyword);
    const hitStatus = !query.status || row.status === query.status;
    return hitKeyword && hitStatus;
  }), [query]);

  const searched = Boolean(query.keyword || query.status || query.range);

  const columns = [
    { title: '单号', dataIndex: 'no', width: 180 },
    { title: '申请人', dataIndex: 'applicant', ellipsis: true },
    { title: '类型', dataIndex: 'type', width: 120 },
    { title: '金额', dataIndex: 'amount', width: 140, align: 'right', render: (v) => <span className="ui-numeric">{money(v)}</span> },
    { title: '状态', dataIndex: 'status', width: 120, render: (v) => <ToneTag tone={APPLY_STATE[v].tone}>{APPLY_STATE[v].text}</ToneTag> },
    { title: '提交时间', dataIndex: 'createdAt', width: 140, render: (v) => <span className="ui-numeric">{fmtDate(v, 'MM-DD HH:mm')}</span> },
    {
      title: '操作', key: 'action', width: 120, fixed: 'right',
      render: (_, row) => (
        <Space size={8}>
          <Button type="link" size="small" style={{ padding: 0 }} onClick={() => setEditing(row)}>编辑</Button>
          <Button type="link" size="small" danger style={{ padding: 0 }} onClick={() => message.warning('原型未实现该操作')}>撤回</Button>
        </Space>
      )
    }
  ];

  return (
    <Shell title="申请单列表" desc="共 2 条，最近提交 2026-11-04 09:12"
      extra={<Button icon={<icons.ReloadOutlined />} onClick={load}>刷新</Button>}>
      <Card style={{ marginBottom: 20 }}>
        <Space size={12} wrap>
          <Input allowClear placeholder="搜索单号 / 申请人" style={{ width: 240 }} value={draft.keyword} onChange={(e) => setDraft({ ...draft, keyword: e.target.value })} />
          <Select allowClear placeholder="全部状态" style={{ width: 160 }} value={draft.status} onChange={(v) => setDraft({ ...draft, status: v })}
            options={Object.entries(APPLY_STATE).map(([value, item]) => ({ value, label: item.text }))} />
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
                ? <Empty description="没有找到符合条件的申请单"><Button type="link" onClick={() => { const empty = { keyword: '', status: undefined, range: null }; setDraft(empty); setQuery(empty); }}>重置筛选</Button></Empty>
                : <Empty description="还没有申请单"><Button type="primary" onClick={() => message.info('去新建申请单')}>去新建</Button></Empty>
            }}
            scroll={{ x: 960 }}
            pagination={{ current: page, pageSize: 10, total: rows.length, onChange: setPage, showTotal: (t) => `共 ${t} 条` }}
          />
        )}
      </Card>

      <Modal open={!!editing} title="编辑申请单" width={520} onCancel={() => setEditing(null)}
        okText="保存修改" cancelText="取消" onOk={() => { setEditing(null); message.success('已保存修改（演示）'); }}>
        {/* 列表内单对象基础信息编辑默认走 Modal M520，见 antd-mapping 容器选择 */}
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
  const record = MOCK_APPLIES[0];

  return (
    <Shell title={`申请单 ${record.no}`} desc="提交于 2026-11-04 09:12 · 申请人 张三"
      extra={<Space>
        <ToneTag tone="primary">已提交</ToneTag>
        <Button type="primary">审核</Button>
      </Space>}>
      <Card style={{ marginBottom: 20 }}>
        <Descriptions column={2} size="small" items={[
          { key: 'type', label: '类型', children: '标准类型' },
          { key: 'amount', label: '金额', children: <span className="ui-numeric">{money(100)}</span> },
          { key: 'region', label: '所属区域', children: '华东区' },
          { key: 'expect', label: '期望完成', children: '2026-11-05 上午' },
          { key: 'contact', label: '联系人', children: '张三 138****6621' },
          { key: 'note', label: '说明', children: '示例说明文本' }
        ]} />
      </Card>

      <Card>
        <Tabs activeKey={tab} onChange={setTab} items={[
          { key: 'detail', label: '明细', children: <Table size="middle" pagination={false} rowKey="name" dataSource={[
            { name: '项目 A', spec: '标准规格', price: 60 },
            { name: '项目 B', spec: '增值项', price: 40 }
          ]} columns={[
            { title: '项目', dataIndex: 'name' },
            { title: '规格', dataIndex: 'spec' },
            { title: '金额', dataIndex: 'price', align: 'right', width: 140, render: (v) => <span className="ui-numeric">{money(v)}</span> }
          ]} /> },
          { key: 'log', label: '处理记录', children: <Timeline items={[
            { children: '2026-11-04 09:12 张三提交申请' },
            { color: 'green', children: '2026-11-04 09:15 审核通过，进入处理队列' }
          ]} /> }
        ]} />
      </Card>
    </Shell>
  );
};
```

> 返回入口：`<Button type="text" icon={<icons.ArrowLeftOutlined />} onClick={() => window.location.href = 'list.html'}>返回列表</Button>`，放在标题区左侧或说明行上方。

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
    message.success('申请单已提交，单号 REQ-20261104002');
    window.location.href = 'list.html';
  };

  return (
    <Shell title="新建申请单" desc="提交后进入审核队列，可在列表页跟进状态">
      <Card>
        <Form form={form} layout="vertical" requiredMark onFinish={submit}
          style={{ maxWidth: 'var(--ui-form-max-width)' }}
          initialValues={{ region: '华东区', priority: '普通' }}>
          <div className="ui-section-title" style={{ marginBottom: 16 }}>基本信息</div>
          <Form.Item name="type" label="类型" rules={[{ required: true, message: '请选择类型' }]}>
            <Select placeholder="请选择类型" options={[{ value: '标准类型', label: '标准类型' }, { value: '高级类型', label: '高级类型' }]} />
          </Form.Item>
          <Form.Item name="note" label="说明" rules={[{ required: true, message: '请填写说明' }, { max: 60, message: '说明不超过 60 个字' }]}>
            <Input.TextArea rows={3} placeholder="写清申请的目的和范围" showCount maxLength={60} />
          </Form.Item>
          <Form.Item name="contact" label="联系人" rules={[{ required: true, message: '请填写联系人姓名' }]}>
            <Input placeholder="负责跟进的联系人" style={{ width: 240 }} />
          </Form.Item>
          <Form.Item name="phone" label="手机号" rules={[
            { required: true, message: '请填写 11 位手机号' },
            { pattern: /^1\d{10}$/, message: '手机号应为 11 位数字，且以 1 开头' }
          ]}>
            <Input placeholder="11 位手机号" maxLength={11} style={{ width: 240 }} />
          </Form.Item>
          <Form.Item name="expectDate" label="期望完成日期" rules={[{ required: true, message: '请选择期望完成日期' }]}
            extra="可选范围为提交次日之后，例如 2026-11-05">
            <DatePicker style={{ width: 240 }} format="YYYY-MM-DD" disabledDate={(current) => current && current.isBefore(dayjs('2026-11-05'))} />
          </Form.Item>
          <Form.Item name="priority" label="优先级">
            <Radio.Group options={[{ value: '普通', label: '普通' }, { value: '紧急', label: '紧急' }]} />
          </Form.Item>

          <Divider style={{ margin: '32px 0 24px' }} />
          <Space size={12}>
            <Button onClick={() => window.location.href = 'list.html'}>返回</Button>
            <Button type="primary" htmlType="submit" loading={submitting}>{submitting ? '提交中…' : '提交申请'}</Button>
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
          { label: '今日新建', value: '12', hint: '含 3 条草稿' },
          { label: '待审核', value: '4', hint: '最早 2 小时前', tone: '--ui-warning-6' },
          { label: '处理中', value: '7', hint: '平均 1.5 天完成' },
          { label: '本周完成', value: '23', hint: '较上周 +4' }
        ].map((item) => (
          <Col span={6} key={item.label}><MetricCard {...item} /></Col>
        ))}
      </Row>
      <Row gutter={20}>
        <Col span={14}>
          <Card title="待处理" extra={<Button type="link" style={{ padding: 0 }} onClick={() => window.location.href = 'list.html'}>查看全部</Button>}>
            <List dataSource={[
              { title: '申请单 REQ-20261104001 待审核', time: '今天 09:12', urgent: true },
              { title: '申请单 REQ-20261103002 待补充材料', time: '昨天 18:20' }
            ]} renderItem={(item) => (
              <List.Item>
                <Space>
                  {item.urgent ? <ToneTag tone="danger">超时</ToneTag> : null}
                  <span>{item.title}</span>
                </Space>
                <span style={{ color: 'var(--ui-text-3)', fontSize: 13 }}>{item.time}</span>
              </List.Item>
            )} />
          </Card>
        </Col>
        <Col span={10}>
          <Card title="通知">
            <List dataSource={[{ title: '本周处理组容量已用满', time: '11-03' }]} renderItem={(item) => (
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
    <Shell title="提交完成">
      <Card styles={{ body: { padding: '48px 24px' } }}>
        <Result
          status="success"
          title="提交成功，申请单已进入审核队列"
          subTitle="单号 REQ-20261104001 · 类型 标准类型 · 期望完成 2026-11-05 上午"
          extra={[
            <Button key="list" type="primary" onClick={() => window.location.href = 'list.html'}>查看申请单</Button>,
            <Button key="new" onClick={() => window.location.href = 'form.html'}>继续新建</Button>
          ]}
        />
      </Card>
    </Shell>
  );
};
```

---

## 6. 多步骤流程（提交 → 审核 → 处理 → 完成）

要素：Steps（当前步高亮）→ 当前步内容 → 底部操作（上一步 / 下一步，主操作在右）。
步骤状态要能回看：已完成步可点回，未到的步不可跳。

```jsx
const STEPS = [
  { title: '提交', desc: '2026-11-04 09:20' },
  { title: '审核', desc: '2026-11-04 09:35' },
  { title: '处理', desc: '进行中' },
  { title: '完成', desc: '待开始' }
];

const Page = () => {
  const [current, setCurrent] = useState(2);
  return (
    <Shell title="申请单 REQ-20261104001" desc="华东区 · 标准类型 · 处理人 李四">
      <Card style={{ marginBottom: 20 }}>
        <Steps current={current} items={STEPS} size="small" />
      </Card>
      <Card title="处理" style={{ marginBottom: 20 }}>
        <Form layout="vertical" style={{ maxWidth: 'var(--ui-form-max-width)' }}>
          <Form.Item label="处理结论" required><Radio.Group options={['同意', '驳回']} /></Form.Item>
          <Form.Item label="处理说明"><Input.TextArea rows={3} placeholder="写清处理结果和依据" /></Form.Item>
          <Form.Item label="附件"><antd.Upload listType="picture-card"><div>上传</div></antd.Upload></Form.Item>
        </Form>
      </Card>
      <Space size={12}>
        <Button onClick={() => setCurrent(Math.max(0, current - 1))}>上一步</Button>
        <Button type="primary" onClick={() => setCurrent(Math.min(STEPS.length - 1, current + 1))}>提交并完成</Button>
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
<Empty description={searched ? '没有找到符合条件的申请单' : '还没有申请单'} />

{/* 操作反馈：结果已在界面上可见时不弹成功提示；不可见时才用 message */}
message.success('已导出，请到下载中心查看');

{/* 危险操作：写明对象、数量与后果，危险按钮不默认聚焦 */}
<Popconfirm title="撤回申请单 REQ-20261104001？" description="撤回后需要重新提交，已处理的部分不会回退。" okText="撤回申请单" cancelText="再想想"
  okButtonProps={{ danger: true }} onConfirm={withdraw}>
  <Button type="link" size="small" danger style={{ padding: 0 }}>撤回</Button>
</Popconfirm>

{/* 可撤销操作：直接做，再给撤销入口 */}
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
    window.location.href = 'list.html';
  };
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--ui-page-bg)', padding: 24 }}>
      <Card style={{ width: 400 }}>
        <div className="ui-brand" style={{ marginBottom: 4 }}>
          <span className="ui-brand-mark">示</span>
          <span>示例应用</span>
        </div>
        <div style={{ color: 'var(--ui-text-3)', fontSize: 13, lineHeight: '20px', marginBottom: 24 }}>登录后进入申请单列表</div>
        <Form layout="vertical" onFinish={submit} initialValues={{ account: 'user01' }}>
          <Form.Item name="account" label="账号" rules={[{ required: true, message: '请填写账号' }]}>
            <Input placeholder="手机号或账号" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请填写密码' }]}>
            <Input.Password placeholder="输入密码" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>登录</Button>
        </Form>
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--ui-text-3)' }}>演示账号 user01，原型不校验真实身份</div>
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

