#!/usr/bin/env node
/**
 * prd2mpa · 渲染自检（可选）
 *
 * 用本机 Chromium 内核浏览器（Edge / Chrome）无头打开每个页面，检查：
 *   1. #root 里真的渲染出了节点（Babel 编译失败、组件写错时这里会是空的）
 *   2. 页面里没有残留「页面待实现」占位
 *   3. 输出整页截图，便于人工看版式
 *
 * 用法：
 *   node scripts/shot.mjs --dir ./prototype/001-设备与服务订购台
 *   node scripts/shot.mjs --dir <目录> --out ./shots --width 1440
 *   CHROME_PATH="C:\\...\\msedge.exe" node scripts/shot.mjs --dir <目录>
 */
import { readdir, mkdir, stat, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

function parseArgs(argv) {
  const args = { width: 1440, height: 900, wait: 10000, offline: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--dir') args.dir = argv[++i];
    else if (token === '--out') args.out = argv[++i];
    else if (token === '--width') args.width = Number(argv[++i]);
    else if (token === '--height') args.height = Number(argv[++i]);
    else if (token === '--wait') args.wait = Number(argv[++i]);
    else if (token === '--offline') args.offline = true;
    else throw new Error(`未知参数：${token}`);
  }
  return args;
}

/** 找一个可用的 Chromium 内核浏览器（Edge 在 Windows 上是默认存在的）。 */
function findBrowser() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const candidates = [];
  if (process.platform === 'win32') {
    for (const root of [process.env['PROGRAMFILES(X86)'], process.env.PROGRAMFILES, process.env.LOCALAPPDATA]) {
      if (!root) continue;
      candidates.push(
        path.join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        path.join(root, 'Google', 'Chrome', 'Application', 'chrome.exe')
      );
    }
  } else if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    );
  } else {
    candidates.push('/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge');
  }
  return candidates.find((candidate) => existsSync(candidate)) || null;
}

const toFileUrl = (file) => 'file:///' + path.resolve(file).replace(/\\/g, '/');

function runBrowser(browser, args) {
  return spawnSync(browser, args, { encoding: 'utf8', timeout: 90_000, maxBuffer: 64 * 1024 * 1024 });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.dir) {
    console.log('用法：node scripts/shot.mjs --dir <原型目录> [--out <截图目录>] [--width 1440] [--height 900]');
    process.exit(1);
  }
  const browser = findBrowser();
  if (!browser) {
    console.error('❌ 没找到 Edge/Chrome。设置环境变量 CHROME_PATH 指向浏览器可执行文件后重试。');
    process.exit(2);
  }

  const dir = path.resolve(args.dir);
  const outDir = path.resolve(args.out || path.join(dir, 'shots'));
  await mkdir(outDir, { recursive: true });
  const pages = (await readdir(dir)).filter((file) => file.endsWith('.html')).sort();
  if (pages.length === 0) {
    console.error(`❌ 目录里没有 html：${dir}`);
    process.exit(1);
  }

  console.log(`浏览器：${browser}`);
  console.log(`输出：${outDir}`);
  if (args.offline) console.log('模式：离线（屏蔽所有域名解析，只有本地文件能加载）');
  console.log('');

  let failed = 0;
  for (const file of pages) {
    const url = toFileUrl(path.join(dir, file));
    const png = path.join(outDir, file.replace(/\.html$/, '.png'));
    const profile = path.join(tmpdir(), `prd2mpa-shot-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);
    const common = [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      `--virtual-time-budget=${args.wait}`,
      `--user-data-dir=${profile}`,
      ...(args.offline ? ['--host-resolver-rules=MAP * ~NOTFOUND'] : [])
    ];

    runBrowser(browser, [...common, `--window-size=${args.width},${args.height}`, `--screenshot=${png}`, url]);
    const dom = runBrowser(browser, [...common, '--dump-dom', url]).stdout || '';

    const isIndex = file === 'index.html';
    const rootMatch = dom.match(/<div id="root">([\s\S]*?)<\/div>\s*(?:<script|<noscript|<\/body>)/);
    const rendered = isIndex
      ? dom.includes('class="card"')
      : /<div id="root"><[a-zA-Z]/.test(dom.replace(/\s+/g, ' ')) || (rootMatch ? rootMatch[1].trim().length > 0 : false);
    const placeholder = dom.includes('页面待实现');
    let size = 0;
    try {
      size = (await stat(png)).size;
    } catch {
      size = 0;
    }

    const problems = [];
    if (!rendered) problems.push('#root 为空：脚本没跑起来（Babel 编译错误或组件名写错）');
    if (placeholder) problems.push('仍是模板占位页面');
    if (size < 8000) problems.push(`截图仅 ${size} 字节，疑似白屏`);
    if (problems.length) failed += 1;

    console.log(`${problems.length ? 'FAIL' : 'OK  '}  ${file}  ${(size / 1024).toFixed(0)}KB  → ${path.relative(process.cwd(), png)}`);
    for (const problem of problems) console.log(`      ✗ ${problem}`);

    // 记录页面自身抛出的运行时错误提示（仅文本层面，用于快速定位）
    const errorText = dom.includes('__DSH_RENDER_ERROR__');
    if (errorText) console.log('      ! 页面记录了渲染错误标记 __DSH_RENDER_ERROR__');
  }

  console.log(`\n${failed === 0 ? '✅ 全部页面渲染正常' : `⚠️ ${failed} 个页面需要修复`}：${pages.length} 页，截图在 ${outDir}`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(`❌ ${error.message}`);
  process.exit(1);
});
