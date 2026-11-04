/*
 * 共享应用壳 —— 所有页面共用这一份（菜单、主题、页面标题区、状态标签、格式化助手）
 *
 * · 由 scripts/scaffold.mjs 从 assets/shell.js 复制并注入 NAV，改菜单只改这里；
 * · 纯 JS（不用 JSX），因为 file:// 下 Babel 不能读外部脚本，只能当普通 <script> 引入；
 * · 页面在 <script src="shell.js"> 之后用 `const { AppShell: Shell } = window;` 取用；
 * · 页面用 window.APP_META / window.PAGE_ACTIVE 告诉它「这页是谁、菜单选中哪一项」。
 */
(function () {
  const { Layout, Menu, Dropdown, Avatar, Tag, Space } = antd;
  const { Header, Sider, Content } = Layout;
  const h = React.createElement;
  const antdIcons = window.icons || {};

  /* ---------- 调色板：换项目 UI 规范时，改这里 + 页面里的 TOKENS 块（两处保持一致） ---------- */
  const UI = {
    primary1: '#E8F3FF',
    primary2: '#BEDAFF',
    primary3: '#94BFFF',
    primary5: '#4080FF',
    primary6: '#165DFF',
    primary7: '#0E42D2',
    success1: '#E8FFEA',
    success6: '#00B42A',
    warning1: '#FFF7E8',
    warning6: '#FF7D00',
    danger1: '#FFECE8',
    danger6: '#F53F3F',
    text1: '#1D2129',
    text2: '#4E5969',
    text3: '#86909C',
    text4: '#C9CDD4',
    border1: '#F2F3F5',
    border2: '#E5E6EB',
    fill1: '#F7F8FA',
    fill2: '#F2F3F5',
    white: '#FFFFFF',
    headerHeight: 54,
    siderWidth: 200
  };

  /* ---------- antd 主题：把 UI 规范 Token 映射到 antd 6（值来自上面的 UI 调色板） ---------- */
  const APP_THEME = {
    token: {
      colorPrimary: UI.primary6,
      colorPrimaryHover: UI.primary5,
      colorPrimaryActive: UI.primary7,
      colorPrimaryBg: UI.primary1,
      colorPrimaryBgHover: UI.primary2,
      colorPrimaryBorder: UI.primary3,
      colorSuccess: UI.success6,
      colorWarning: UI.warning6,
      colorError: UI.danger6,
      colorInfo: UI.primary6,
      colorLink: UI.primary6,
      colorLinkHover: UI.primary5,
      colorText: UI.text1,
      colorTextSecondary: UI.text2,
      colorTextTertiary: UI.text3,
      colorTextQuaternary: UI.text4,
      colorTextDescription: UI.text3,
      colorBorder: UI.border2,
      colorBorderSecondary: UI.border1,
      colorBgLayout: UI.fill1,
      colorBgContainer: UI.white,
      colorFillSecondary: UI.fill2,
      colorFillTertiary: UI.fill1,
      colorFillQuaternary: UI.fill1,
      borderRadius: 2,
      borderRadiusSM: 2,
      borderRadiusLG: 4,
      borderRadiusXS: 2,
      controlHeight: 32,
      controlHeightSM: 28,
      controlHeightLG: 36,
      fontSize: 14,
      fontSizeSM: 12,
      fontSizeLG: 16,
      lineHeight: 22 / 14,
      fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif",
      boxShadow: '0 2px 5px rgba(0,0,0,.1)',
      boxShadowSecondary: '0 2px 5px rgba(0,0,0,.1)',
      motionDurationFast: '0.1s',
      motionDurationMid: '0.2s',
      motionDurationSlow: '0.3s',
      padding: 16,
      paddingLG: 24,
      paddingSM: 12,
      paddingXS: 8,
      margin: 16,
      marginLG: 24,
      marginSM: 12,
      marginXS: 8
    },
    components: {
      Layout: {
        headerHeight: UI.headerHeight,
        headerPadding: '0 24px',
        headerBg: UI.white,
        siderBg: UI.white,
        bodyBg: UI.fill1,
        triggerBg: UI.white,
        triggerColor: UI.text2
      },
      Menu: {
        itemHeight: 40,
        itemMarginInline: 8,
        itemMarginBlock: 2,
        itemBorderRadius: 2,
        itemColor: UI.text2,
        itemHoverBg: UI.fill2,
        itemHoverColor: UI.text1,
        itemSelectedBg: UI.primary1,
        itemSelectedColor: UI.primary6,
        subMenuItemBg: UI.white,
        iconSize: 16,
        collapsedIconSize: 16
      },
      Table: {
        headerBg: UI.fill2,
        headerColor: UI.text1,
        headerSplitColor: UI.border2,
        borderColor: UI.border2,
        rowHoverBg: UI.fill1,
        cellPaddingBlock: 12,
        cellPaddingBlockMD: 7,
        cellPaddingBlockSM: 4,
        cellPaddingInline: 16,
        headerBorderRadius: 0
      },
      Card: { borderRadiusLG: 4, paddingLG: 16, headerFontSize: 16, headerHeight: 48 },
      Button: { paddingInline: 16, primaryShadow: 'none', defaultShadow: 'none', dangerShadow: 'none', fontWeight: 400 },
      Modal: { borderRadiusLG: 4, titleFontSize: 16 },
      Drawer: { paddingLG: 24 },
      Form: { labelColor: UI.text2, itemMarginBottom: 24, verticalLabelPadding: '0 0 12px' },
      Tabs: { horizontalItemPadding: '12px 0', horizontalItemGutter: 24, titleFontSize: 14 },
      Tag: { defaultBg: UI.fill2, defaultColor: UI.text2 },
      Descriptions: { labelColor: UI.text3, contentColor: UI.text1 },
      Pagination: { itemSize: 32, itemSizeSM: 28 }
    }
  };

  /* ---------- 菜单：唯一来源，由 scaffold 从 manifest 注入 ---------- */
  const NAV = __NAV_JSON__;

  /* ---------- 格式化助手（数值/日期口径） ---------- */
  const money = (value) => '¥' + Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const num = (value) => Number(value || 0).toLocaleString('zh-CN');
  const fmtDate = (value, pattern) => (value ? dayjs(value).format(pattern || 'YYYY-MM-DD') : '—');
  const fmtDateTime = (value) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '—');

  /* ---------- 业务状态色（浅底 + 深色字，颜色不是唯一编码） ---------- */
  const TONE = {
    primary: { color: UI.primary6, bg: UI.primary1 },
    success: { color: UI.success6, bg: UI.success1 },
    warning: { color: UI.warning6, bg: UI.warning1 },
    danger: { color: UI.danger6, bg: UI.danger1 },
    info: { color: UI.text2, bg: UI.fill2 }
  };

  const ToneTag = (props) => {
    const tone = TONE[props.tone] || TONE.info;
    return h(
      Tag,
      { style: { color: tone.color, background: tone.bg, borderColor: 'transparent', marginInlineEnd: 0 } },
      props.children
    );
  };

  /* ---------- 导航图标：按名称取 @ant-design/icons，缺省回落 ---------- */
  const IconOf = (name) => {
    const Cmp = antdIcons[name] || antdIcons.AppstoreOutlined;
    return Cmp ? h(Cmp, { style: { fontSize: 16 } }) : null;
  };

  /* ---------- 页面标题区：标题 20/28 + 说明 text-3 + 右上角操作区 ---------- */
  const PageHeader = (props) =>
    h(
      'div',
      { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20 } },
      h(
        'div',
        { style: { minWidth: 0 } },
        h('div', { style: { fontSize: 20, lineHeight: '28px', fontWeight: 500, color: 'var(--ui-text-1)' } }, props.title),
        props.desc
          ? h('div', { style: { fontSize: 14, lineHeight: '22px', color: 'var(--ui-text-3)', marginTop: 4 } }, props.desc)
          : null
      ),
      props.extra ? h(Space, { size: 8, style: { flex: 'none' } }, props.extra) : null
    );

  /* ---------- 应用壳：顶栏 54 + 侧栏 200 + 内容区（框架 A） ---------- */
  const AppShell = (props) => {
    const { message } = antd.App.useApp();
    const meta = window.APP_META || {};
    const active = window.PAGE_ACTIVE || '';
    const visibleNav = NAV.filter((item) => !item.roles || item.roles.includes(meta.role));

    const items = visibleNav.map((item) => ({
      key: item.key,
      icon: IconOf(item.icon),
      label: item.label
    }));

    const go = ({ key }) => {
      const target = NAV.find((item) => item.key === key);
      if (target && target.href) window.location.href = target.href;
    };

    return h(
      Layout,
      { style: { minHeight: '100vh' } },
      h(
        Header,
        { className: 'ui-header', style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
        h(
          'div',
          { className: 'ui-brand' },
          h('span', { className: 'ui-brand-mark' }, (meta.short || '原').slice(0, 1)),
          h('span', null, meta.title),
          h(
            Tag,
            { style: { marginInlineStart: 4, color: 'var(--ui-text-3)', background: 'var(--ui-fill-2)', borderColor: 'transparent' } },
            '原型'
          )
        ),
        h(
          Space,
          { size: 12 },
          h('span', { style: { fontSize: 13, color: 'var(--ui-text-3)' } }, '当前角色：' + meta.role),
          h(
            Dropdown,
            {
              menu: {
                items: [
                  { key: 'profile', label: '个人信息' },
                  { key: 'logout', label: '退出登录（回原型目录）' }
                ],
                onClick: ({ key }) => {
                  if (key === 'logout') window.location.href = 'index.html';
                  else message.info('原型未实现个人信息');
                }
              },
              trigger: ['click']
            },
            h(Avatar, { size: 28, style: { background: 'var(--ui-primary-6)', cursor: 'pointer' } }, (meta.role || '用').slice(0, 1))
          )
        )
      ),
      h(
        Layout,
        null,
        h(
          Sider,
          { className: 'ui-sider', width: UI.siderWidth, theme: 'light' },
          h(Menu, {
            mode: 'inline',
            selectedKeys: [active],
            items,
            onClick: go,
            style: { borderInlineEnd: 'none', paddingTop: 8, flex: '1 1 auto', overflowY: 'auto' }
          }),
          h('div', { className: 'ui-sider-foot' }, h('a', { href: 'index.html' }, '← 返回原型目录'))
        ),
        h(
          Content,
          { style: { padding: 'var(--ui-content-padding)', background: 'var(--ui-page-bg)', overflow: 'auto' } },
          h(
            'div',
            { style: { maxWidth: 'var(--ui-reading-max-width)' } },
            h(PageHeader, { title: props.title, desc: props.desc, extra: props.extra }),
            props.children
          )
        )
      )
    );
  };

  /* ---------- 暴露给页面（页面里 `const { AppShell: Shell } = window` 即可） ---------- */
  window.UI = UI;
  window.APP_THEME = APP_THEME;
  window.NAV = NAV;
  window.TONE = TONE;
  window.ToneTag = ToneTag;
  window.PageHeader = PageHeader;
  window.AppShell = AppShell;
  window.money = money;
  window.num = num;
  window.fmtDate = fmtDate;
  window.fmtDateTime = fmtDateTime;
})();
