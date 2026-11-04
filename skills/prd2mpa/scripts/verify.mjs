#!/usr/bin/env node
/**
 * prd2mpa · 原型自检
 *
 * 检查生成的多页原型是否满足「技术方案三 + UI 规范」的硬性约定：
 * 依赖与顺序、Babel 脚本类型、Design Token、应用壳、主题、导航链接、页面结构。
 * 只做静态检查（不启浏览器），用于每页写完后快速回归。
 *
 * 用法：
 *   node scripts/verify.mjs --dir ./prototype/001-设备与服务订购台
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--dir') args.dir = argv[++i];
    else if (token === '--help' || token === '-h') args.help = true;
    else throw new Error(`未知参数：${token}`);
  }
  return args;
}

/* 依赖可以来自 CDN，也可以来自离线打包后的 vendor/（文件名带版本号），所以只匹配库名与后缀 */
const REQUIRED_DEPS = [
  { name: 'React 18', pattern: /\/react[-\d.]*\.production\.min\.js/ },
  { name: 'ReactDOM 18', pattern: /\/react-dom[-\d.]*\.production\.min\.js/ },
  { name: 'dayjs', pattern: /\/dayjs[-\d.]*\.min\.js/ },
  { name: 'antd 6', pattern: /\/antd[-\d.]*\.min\.js/ },
  { name: 'antd reset.css', pattern: /reset\.css/ },
  { name: 'Babel Standalone', pattern: /\/babel[-\d.]*\.min\.js/ },
  { name: '@ant-design/icons', pattern: /(?:index|antd-icons)[-\d.]*\.umd\.min\.js/ }
];

const PAGE_CODE_START = 'PAGE CODE START';
const PAGE_CODE_END = 'PAGE CODE END';

function findIndexOrThrow(text, pattern, label) {
  const match = text.match(pattern);
  if (!match) throw new Error(`缺少 ${label}`);
  return match.index;
}

function extractBabelScript(html) {
  const match = html.match(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/);
  return match ? match[1] : '';
}

function checkPage(file, html, nav) {
  const fails = [];
  const warns = [];
  const fail = (message) => fails.push(message);
  const warn = (message) => warns.push(message);

  /* 1. 依赖齐全且顺序正确（dayjs 必须在 antd 之前，否则 antd UMD 初始化失败） */
  const positions = {};
  for (const dep of REQUIRED_DEPS) {
    try {
      positions[dep.name] = findIndexOrThrow(html, dep.pattern, `依赖 ${dep.name}`);
    } catch (error) {
      fail(error.message);
    }
  }
  if (positions['dayjs'] !== undefined && positions['antd 6'] !== undefined && positions['dayjs'] > positions['antd 6']) {
    fail('dayjs 必须在 antd 之前引入（antd 的 UMD 包依赖全局 dayjs）');
  }
  if (positions['React 18'] !== undefined && positions['antd 6'] !== undefined && positions['React 18'] > positions['antd 6']) {
    fail('React 必须在 antd 之前引入');
  }

  /* 2. JSX 脚本必须交给 Babel，且不能是外链脚本（file:// 下会被 CORS 拦掉） */
  const babelTags = html.match(/<script type="text\/babel"[^>]*>/g) || [];
  if (babelTags.length === 0) fail('缺少 <script type="text/babel">：JSX 不会被编译');
  if (babelTags.length > 1) fail(`发现 ${babelTags.length} 个 text/babel 脚本，约定每页只有 1 个`);
  for (const tag of babelTags) {
    if (!/data-presets="(?:react|react-classic)"/.test(tag)) fail('text/babel 脚本缺少 data-presets="react-classic"');
    if (/\bsrc=/.test(tag)) fail('text/babel 不能使用 src 外链脚本（Babel 在 file:// 下取不到内容）');
  }
  if (/data-presets="react-classic"/.test(html) && !/registerPreset\(\s*['"]react-classic['"]/.test(html)) {
    fail("用了 react-classic 预设但没有注册：Babel 8 需要先跑 Babel.registerPreset('react-classic', …)，否则 JSX 会编译成 import 而白屏");
  }

  /* 3. Babel 脚本里不能出现模块语法，浏览器内没有打包器 */
  const babel = extractBabelScript(html);
  if (/^\s*import\s+[\w{*]/m.test(babel) || /^\s*export\s+(default|const|function|\{)/m.test(babel)) {
    fail('PAGE CODE 里出现了 import/export：浏览器内编译不支持模块语法，请用全局 antd/icons');
  }
  if (/\brequire\s*\(/.test(babel)) fail('PAGE CODE 里出现了 require()：浏览器内没有 CommonJS');
  if (/ReactDOM\.render\s*\(/.test(babel)) fail('使用了 ReactDOM.render：React 18 请用 createRoot');
  if (!/ReactDOM\.createRoot\s*\(/.test(babel)) fail('缺少 ReactDOM.createRoot 挂载');

  /* 3.0 React 19 已移除的 API：原型跑 18，但代码要能整页搬到 19 */
  const removedIn19 = [
    [/\.defaultProps\s*=/, '给函数组件挂 defaultProps（19 已移除，改用默认参数）'],
    [/contextTypes\s*=/, '旧版 contextTypes（19 已移除）'],
    [/findDOMNode\s*\(/, 'findDOMNode（19 已移除，改用 ref）'],
    [/React\.createFactory\s*\(/, 'React.createFactory（19 已移除）'],
    [/<[A-Za-z][^>]*\bref\s*=\s*["']/, '字符串 ref（19 已移除，改用 useRef）']
  ];
  for (const [pattern, label] of removedIn19) {
    if (pattern.test(babel)) warn(`${label}：原型与正式工程（React 19）都要避免`);
  }

  /* 3.1 共享层重复定义：解构两次会 SyntaxError，主题重定义会覆盖 Token 映射 */
  const destructures = babel.match(/const\s*\{[^}]*\}\s*=\s*antd/g) || [];
  if (destructures.length > 1) {
    fail(`出现了 ${destructures.length} 次 const { … } = antd：共享层已解构，页面里请用 <antd.Xxx /> 或 icons`);
  }
  const themeDefs = babel.match(/(const|let|var)\s+THEME\s*=/g) || [];
  if (themeDefs.length > 1) fail('页面里重复定义了 THEME：主题只在共享层配置一次');

  /* 4. 挂载点 */
  if (!/<div id="root"><\/div>/.test(html)) fail('缺少 <div id="root"></div> 挂载点');

  /* 5. Design Token：块必须在、关键变量必须存在。具体色值/尺寸随项目规范走，这里不锁死 */
  if (!html.includes('TOKENS START') || !html.includes('TOKENS END')) fail('Design Token 块被删除或标记缺失');
  for (const token of ['--ui-primary-6', '--ui-text-1', '--ui-border-2', '--ui-header-height', '--ui-sidebar-width']) {
    if (!new RegExp(`${token}\\s*:`).test(html)) fail(`缺少 Token ${token}（页面不应改写 Token 块）`);
  }

  /* 6. 主题与语言：antd 必须接 ConfigProvider 主题，不能裸用默认主题 */
  if (!/ConfigProvider/.test(babel)) fail('缺少 ConfigProvider：antd 会用默认主题，颜色/圆角全不对');
  if (!/theme=\{(?:APP_)?THEME\}/.test(babel)) fail('ConfigProvider 未接入 theme={APP_THEME}（主题由 shell.js 提供）');

  /* 7. 页面结构：壳 + 页面代码区 */
  if (!html.includes(PAGE_CODE_START) || !html.includes(PAGE_CODE_END)) fail('缺少 PAGE CODE 起止标记');
  if (/页面待实现/.test(html)) warn('页面代码区仍是模板占位（页面未实现）');
  if (!/<script src="shell\.js"><\/script>/.test(html)) {
    fail('缺少 <script src="shell.js"></script>：壳与菜单要从共享文件引入，不要每页复制一份');
  }
  if (/const\s+NAV\s*=/.test(babel) || /const\s+Shell\s*=\s*(?:props|\(\s*\{)/.test(babel) || /function\s+Shell\s*\(/.test(babel)) {
    fail('页面里不要自己定义 NAV / Shell：它们只在 shell.js 里维护，页面用 <Shell> 即可');
  }
  if (!/<Shell\b|Shell\s*\(/.test(babel)) warn('页面没有使用 Shell 组件');
  if (!/<Page\s*\/>/.test(babel)) fail('缺少 <Page /> 渲染入口');

  /* 7.1 代码风格：组件一律箭头函数，不用 function 声明（与正式工程写法一致，迁移时零改动） */
  if (!/const\s+Page\s*=/.test(babel)) fail('主组件要写成 const Page = () => …（箭头函数）');
  const functionComponents = babel.match(/^\s*function\s+[A-Z]\w*\s*\(/gm) || [];
  if (functionComponents.length > 0) {
    fail(`组件请用箭头函数：发现 ${functionComponents.length} 处 function 声明（如 function Page()），改成 const Xxx = (props) => …`);
  }

  /* 8. 模板占位符必须全部替换（__ANTD_ZH_CN__ 是离线语言包的运行时全局变量，不是占位符） */
  const leftovers = (html.match(/__[A-Z][A-Z0-9_]*__/g) || []).filter((token) => token !== '__ANTD_ZH_CN__');
  if (leftovers.length > 0) fail(`仍有未替换的模板占位符：${[...new Set(leftovers)].join('、')}`);

  /* 8.5 菜单覆盖：页面要么在菜单里且高亮有效，要么显式说明不进菜单 */
  if (Array.isArray(nav)) {
    const activeMatch = html.match(/window\.PAGE_ACTIVE\s*=\s*'([^']*)'/);
    const active = activeMatch ? activeMatch[1] : '';
    const inMenu = /window\.PAGE_IN_MENU\s*=\s*true/.test(html);
    const hidden = /window\.PAGE_IN_MENU\s*=\s*false/.test(html);
    const listed = nav.some((item) => item.href === file);

    if (inMenu) {
      if (!nav.some((item) => item.key === active)) {
        fail(`PAGE_ACTIVE「${active}」不在 shell.js 的菜单里：菜单项被改过，或页面用错了 key`);
      }
      if (!listed) warn('这页声明在菜单里，但 shell.js 没有指向它的菜单项');
    } else if (!hidden) {
      warn('页面既不在菜单里、也没标 menu:false：确认它是流程页/登录页，否则在 manifest 里补菜单项');
    } else if (listed) {
      warn('这页标了不进菜单（menu:false），但 shell.js 里仍有指向它的菜单项');
    }
  }

  /* 9. 语言与标题 */
  if (!/<html lang="zh-CN">/.test(html)) fail('<html lang="zh-CN"> 缺失');
  if (!/<title>[^<]*<\/title>/.test(html)) fail('缺少 <title>');
  if (/<title>\s*<\/title>/.test(html)) fail('<title> 为空');

  /* 10. 本地链接必须指向真实文件（后面统一校验，这里只收集） */
  const links = [...html.matchAll(/href="([^"#]+\.html)"/g)].map((m) => m[1]);

  return { file, fails, warns, links };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.dir) {
    console.log('用法：node scripts/verify.mjs --dir <原型目录>');
    process.exit(args.help ? 0 : 1);
  }

  const dir = path.resolve(args.dir);
  const files = (await readdir(dir)).filter((file) => file.endsWith('.html')).sort();
  if (files.length === 0) {
    console.error(`❌ 目录里没有 html 文件：${dir}`);
    process.exit(1);
  }
  if (!files.includes('index.html')) {
    console.error('❌ 缺少 index.html（原型目录页）');
    process.exit(1);
  }
  if (!(await readdirSafe(dir)).includes('shell.js')) {
    console.error('❌ 缺少 shell.js（共享壳与菜单）：用 scaffold.mjs 重新生成，不要手工拼页面');
    process.exit(1);
  }
  if (!(await readdirSafe(dir)).includes('README.md')) {
    console.warn('⚠️  缺少 README.md（交付说明：页面清单、演示数据口径、已知假设）');
  }

  const pages = files.filter((file) => file !== 'index.html');
  if (pages.length === 0) {
    console.error('❌ 除 index.html 外没有产品页面');
    process.exit(1);
  }

  let navItems = null;
  try {
    const shell = await readFile(path.join(dir, 'shell.js'), 'utf8');
    if (!/PREVIEW_DEFAULT/.test(shell)) console.warn('⚠️  shell.js 缺少预览版开关（旧版生成物），建议用最新模板重新 scaffold');
    const navMatch = shell.match(/const NAV = (\[[\s\S]*?\]);/);
    if (navMatch) navItems = JSON.parse(navMatch[1]);
  } catch {
    navItems = null;
  }
  if (!Array.isArray(navItems)) {
    console.warn('⚠️  读不到 shell.js 里的 NAV，跳过菜单覆盖检查');
  }

  const results = [];
  for (const file of pages) {
    const html = await readFile(path.join(dir, file), 'utf8');
    results.push(checkPage(file, html, navItems));
  }

  /* 链接完整性：产品页互链 + index 覆盖所有页面 */
  const fileSet = new Set(files);
  const indexHtml = await readFile(path.join(dir, 'index.html'), 'utf8');
  const indexLinks = [...indexHtml.matchAll(/href="([^"#]+\.html)"/g)].map((m) => m[1]);
  const missingFromIndex = pages.filter((file) => !indexLinks.includes(file));

  const render = (result) => {
    const status = result.fails.length ? 'FAIL' : 'PASS';
    console.log(`\n${status}  ${result.file}`);
    for (const item of result.fails) console.log(`   ✗ ${item}`);
    for (const item of result.warns) console.log(`   ! ${item}`);
    for (const link of result.links) {
      if (!fileSet.has(link)) console.log(`   ✗ 链接指向不存在的文件：${link}`);
    }
  };

  console.log(`检查目录：${dir}`);
  console.log(`页面 ${pages.length} 个：${pages.join('、')}`);
  results.forEach(render);

  if (missingFromIndex.length) {
    console.log('\nFAIL  index.html');
    for (const file of missingFromIndex) console.log(`   ✗ 目录页没有列出：${file}`);
  }

  const brokenLinks = results.flatMap((result) => result.links.filter((link) => !fileSet.has(link)));
  const totalFails =
    results.reduce((sum, result) => sum + result.fails.length, 0) + brokenLinks.length + missingFromIndex.length;
  const totalWarns = results.reduce((sum, result) => sum + result.warns.length, 0);

  /* 目录名标注了「支持离线」，但页面还在引用 CDN：提醒收尾要跑 offline.mjs */
  if (path.basename(dir).includes('支持离线')) {
    const stillOnline = [];
    for (const file of pages) {
      const html = await readFile(path.join(dir, file), 'utf8');
      if (/(?:src|href)="https?:\/\//.test(html)) stillOnline.push(file);
    }
    if (stillOnline.length > 0) {
      console.log(
        `\n⚠️  目录名标注「支持离线」，但 ${stillOnline.length} 个页面仍引用 CDN（${stillOnline.join('、')}）：交付前跑 scripts/offline.mjs 收尾`
      );
    }
  }

  console.log(
    `\n${totalFails === 0 ? '✅ 全部通过' : `❌ ${totalFails} 项失败`}（${pages.length} 页，警告 ${totalWarns} 项）`
  );
  if (totalFails > 0) process.exit(1);
}

async function readdirSafe(dir) {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

main().catch((error) => {
  console.error(`❌ ${error.message}`);
  process.exit(1);
});




