# ai-tools

团队 AI 工具与技能集合：把日常协作里重复的部分沉淀成可复用的 skill。

## 文档与技能

| 路径 | 说明 |
|------|------|
| [skills/shishisun](skills/shishisun/README.md) | 事事顺每日工作同步技能：把 git 提交自动写进跟进日志 |
| [skills/srd](skills/srd/SKILL.md) | 研发云 MCP 便捷调用：项目名模糊搜索 |
| [skills/prd2mpa](skills/prd2mpa/SKILL.md) | PRD + UI 规范 → 多页 HTML 交互原型（CDN React 18 + antd 6 + Babel） |
| [doc/shishisun.md](doc/shishisun.md) | 事事顺任务卡片编写规范（标题 / 验收标准 / 跟进日志） |
| [doc/ai-collaboration.md](doc/ai-collaboration.md) | 这套体系如何与 AI 协作：分工、边界、改进路线 |

### 事事顺技能

- [技能说明](skills/shishisun/README.md)：做什么、怎么跑
- [安装说明](skills/shishisun/INSTALL.md)：hook 注入、配置、升级、卸载
- [执行规则](skills/shishisun/SKILL.md)：代理每次运行遵循的流程
- [任务卡片规范](doc/shishisun.md)：团队写作口径
- [AI 协作说明](doc/ai-collaboration.md)：谁负责什么、哪里会失真、怎么改

### PRD → 多页原型技能（prd2mpa）

把项目文档与 UI 规范文档转成一套能双击打开、能点能改的多页 HTML 原型：每页自包含，依赖全走 CDN，页面内用 Design Token 对齐 UI 规范。

- [安装说明](skills/prd2mpa/INSTALL.md)：Node、浏览器、技能目录联接、`doctor.mjs` 自检（给产品同学的版本）
- [执行规则](skills/prd2mpa/SKILL.md)：输入 → 页面清单 → 生成骨架 → 逐页实现 → 自检 → 离线化
- [页面模板](skills/prd2mpa/references/page-patterns.md)：六类页面的可复制 JSX 骨架
- [组件映射](skills/prd2mpa/references/antd-mapping.md)：Arco 规范 → antd 6 的尺寸、组件与 API 陷阱
- [交互摘要](skills/prd2mpa/references/ui-interaction.md) / [数据与文案摘要](skills/prd2mpa/references/ui-data-copy.md)：UI 规范的可执行压缩版
- [依赖版本与升级](skills/prd2mpa/references/versions.md) / [React 18→19 迁移](skills/prd2mpa/references/react-18-19.md)：升级依赖、把原型代码搬进正式工程时看
- [自带 UI 规范的处理](skills/prd2mpa/references/custom-ui-spec.md)：用户提供自己的 UI 规范时，换 Token、换主题、重做摘要
- [搬进正式工程](skills/prd2mpa/references/migrate-to-production.md)：原型代码转成 React 工程时的逐项替换与新增工作量
- [页面骨架生成器](skills/prd2mpa/scripts/scaffold.mjs) / [自检](skills/prd2mpa/scripts/verify.mjs) / [渲染检查](skills/prd2mpa/scripts/shot.mjs) / [离线打包](skills/prd2mpa/scripts/offline.mjs) / [环境体检](skills/prd2mpa/scripts/doctor.mjs)

## 目录结构

```
ai-tools/
├── doc/                 # 团队规范文档
│   ├── shishisun.md
│   └── ai-collaboration.md
└── skills/
    ├── shishisun/       # 每日工作同步技能
    ├── srd/             # 研发云 MCP 工具集
    └── prd2mpa/         # PRD → 多页 HTML 原型
```



