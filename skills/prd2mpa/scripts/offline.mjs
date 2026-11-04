#!/usr/bin/env node
/**
 * prd2mpa · 离线打包
 *
 * 把页面引用的 CDN 资源下载到本地 `vendor/`，并把页面里的地址改成相对路径，
 * 让整份原型在断网、内网或 U 盘里双击也能打开。
 *
 * 用法：
 *   node scripts/offline.mjs --dir ./prototype/001-设备与服务订购台
 *   node scripts/offline.mjs --dir ./prototype/001-设备与服务订购台 --out ./prototype/001-offline
 *   node scripts/offline.mjs --dir ./prototype/001-设备与服务订购台 --force
 *
 * 做的事：
 *   1. 扫描每个页面的 <script src> / <link href>，按「库名-版本.文件名」的规则下载到 vendor/
 *      （如 react-18.3.1.production.min.js、antd-6.6.8.min.js，一眼能看出用的哪版）
 *   2. 页面里的 CDN 地址改成 vendor/xxx 相对路径，并去掉本地脚本上的 crossorigin
 *   3. 把「异步 import esm.sh 语言包」那段换成加载本地 vendor/antd-zh-cn-<版本>.js
 *   4. 写 vendor/SOURCE.md（来源 / 大小 / sha256），并在 README 补「离线查看」一节
 */
import { readFile, writeFile, mkdir, readdir, stat, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCALE_ASSET = path.join(SKILL_DIR, 'assets', 'antd-zh-cn.js');
/** 语言包快照对应的 antd 版本；文件名里带上，跟其他 vendor 文件保持同一套命名规则 */
const LOCALE_VERSION = '6.6.8';
const LOCALE_NAME = `antd-zh-cn-${LOCALE_VERSION}.js`;

/** CDN 地址 → 本地文件名（带版本号，一眼能看出用的是哪版）。顺序有意义（先匹配嵌套更深的）。 */
const ASSET_MAP = [
  [/react-dom@([\d.]+)\/umd\/react-dom\.production\.min\.js/, (v) => `react-dom-${v}.production.min.js`],
  [/react@([\d.]+)\/umd\/react\.production\.min\.js/, (v) => `react-${v}.production.min.js`],
  [/dayjs@([\d.]+)\/locale\/zh-cn\.js/, (v) => `dayjs-${v}.zh-cn.js`],
  [/dayjs@([\d.]+)\/dayjs\.min\.js/, (v) => `dayjs-${v}.min.js`],
  [/@ant-design\/icons@([\d.]+)\/dist\/index\.umd\.min\.js/, (v) => `antd-icons-${v}.umd.min.js`],
  [/antd@([\d.]+)\/dist\/reset\.css/, (v) => `antd-${v}.reset.css`],
  [/antd@([\d.]+)\/dist\/antd\.min\.js/, (v) => `antd-${v}.min.js`],
  [/@babel\/standalone@([\d.]+)\/babel\.min\.js/, (v) => `babel-${v}.min.js`]
];

function parseArgs(argv) {
  const args = { force: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--dir') args.dir = argv[++i];
    else if (token === '--out') args.out = argv[++i];
    else if (token === '--force') args.force = true;
    else if (token === '--help' || token === '-h') args.help = true;
    else throw new Error(`未知参数：${token}`);
  }
  return args;
}

function fileNameFor(url, used) {
  for (const [pattern, build] of ASSET_MAP) {
    const match = url.match(pattern);
    if (match) return build(match[1] || 'unknown');
  }
  const base = url.split('?')[0].split('/').pop() || 'asset';
  let name = `asset-${base.replace(/[^\w.-]/g, '_')}`;
  let index = 2;
  while (used.has(name)) name = `asset-${index++}-${base.replace(/[^\w.-]/g, '_')}`;
  return name;
}

async function download(url, target) {
  const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`下载失败 ${response.status} ${url}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 100) throw new Error(`下载内容异常（${buffer.length} 字节）：${url}`);
  await writeFile(target, buffer);
  return {
    url,
    bytes: buffer.length,
    sha256: createHash('sha256').update(buffer).digest('hex')
  };
}

/** 把「异步 import esm.sh 语言包」替换成本地 script（已经是本地引用的页面跳过，保证可重复执行）。 */
function inlineLocale(html) {
  if (html.includes('vendor/antd-zh-cn')) return html;
  const anchor = html.indexOf('window.__ANTD_LOCALE_READY');
  if (anchor < 0) return html;
  const start = html.lastIndexOf('<script', anchor);
  const end = html.indexOf('</script>', anchor);
  if (start < 0 || end < 0) return html;
  const replacement = [
    `<script src="vendor/${LOCALE_NAME}"></script>`,
    '<script>',
    `/* 离线版：语言包来自本地 vendor/${LOCALE_NAME}，不再请求 esm.sh */`,
    'window.__ANTD_LOCALE_READY = Promise.resolve(window.__ANTD_ZH_CN__ || null);',
    '</script>'
  ].join('\n');
  return html.slice(0, start) + replacement + html.slice(end + '</script>'.length);
}

const OFFLINE_README = `## 离线查看

本目录已打包成离线版：页面引用的前端库都在 \`vendor/\` 里，断网也能直接打开。

- 双击 \`index.html\` 即可，不需要本地服务器、不需要联网。
- 语言包已本地化（\`vendor/${LOCALE_NAME}\`），日期组件仍是中文。
- 依赖来源、大小与 sha256 见 \`vendor/SOURCE.md\`。
- 整个目录一起拷走或压缩发送，不要只拷 \`*.html\`。
`;

function withOfflineSection(readme) {
  const marker = '## 离线查看';
  const index = readme.indexOf(marker);
  if (index >= 0) {
    const next = readme.indexOf('\n## ', index + marker.length);
    return readme.slice(0, index) + OFFLINE_README + (next >= 0 ? readme.slice(next + 1) : '');
  }
  return `${readme.replace(/\s*$/, '')}\n\n${OFFLINE_README}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.dir) {
    console.log(`用法：node scripts/offline.mjs --dir <原型目录> [--out <新目录>] [--force]`);
    process.exit(args.help ? 0 : 1);
  }

  let dir = path.resolve(args.dir);
  if (!existsSync(dir)) throw new Error(`目录不存在：${dir}`);

  if (args.out) {
    const out = path.resolve(args.out);
    if (existsSync(out)) {
      if (!args.force) throw new Error(`输出目录已存在：${out}（确认可覆盖后加 --force）`);
      await cp(dir, out, { recursive: true, force: true });
    } else {
      await cp(dir, out, { recursive: true });
    }
    dir = out;
    console.log(`已复制到 ${out}`);
  }

  const files = (await readdir(dir)).filter((file) => file.endsWith('.html') && file !== 'index.html');
  if (files.length === 0) throw new Error(`目录里没有产品页面：${dir}`);

  const vendorDir = path.join(dir, 'vendor');
  await mkdir(vendorDir, { recursive: true });

  /* 1. 收集所有外部引用（同一 URL 只下一次） */
  const pages = new Map();
  const urls = new Map();
  for (const file of files) {
    const html = await readFile(path.join(dir, file), 'utf8');
    pages.set(file, html);
    for (const match of html.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)) {
      if (!urls.has(match[1])) urls.set(match[1], null);
    }
  }

  if (urls.size === 0) {
    console.log('页面里没有外部引用，已经是离线状态；只检查语言包。');
  }

  /* 2. 下载 */
  const used = new Set();
  const manifest = [];
  for (const url of urls.keys()) {
    const name = fileNameFor(url, used);
    used.add(name);
    const target = path.join(vendorDir, name);
    process.stdout.write(`↓ ${name}  ←  ${url}\n`);
    const info = await download(url, target);
    urls.set(url, name);
    manifest.push({ ...info, file: name });
  }

  /* 3. 语言包（本地快照，不走网络） */
  const localeTarget = path.join(vendorDir, LOCALE_NAME);
  await cp(LOCALE_ASSET, localeTarget, { force: true });
  const localeBuffer = await readFile(localeTarget);
  manifest.push({
    url: `skill 内置：assets/antd-zh-cn.js（antd ${LOCALE_VERSION} locale/zh_CN 快照）`,
    file: LOCALE_NAME,
    bytes: localeBuffer.length,
    sha256: createHash('sha256').update(localeBuffer).digest('hex')
  });

  /* 4. 改页面 */
  let rewritten = 0;
  for (const [file, original] of pages) {
    let html = original;
    for (const [url, name] of urls) {
      if (name) html = html.split(url).join(`vendor/${name}`);
    }
    /* 本地文件不需要（也不允许）走 CORS：file:// 下带 crossorigin 的脚本会被浏览器拦掉，整页白屏 */
    html = html.replace(/<script\b[^>]*>/g, (tag) =>
      tag.includes('src="vendor/') ? tag.replace(/\s+crossorigin(?:="[^"]*")?/g, '') : tag
    );
    html = inlineLocale(html);
    if (html !== original) {
      await writeFile(path.join(dir, file), html, 'utf8');
      rewritten += 1;
    }
  }

  /* 5. 清单（重复执行时只补语言包，不要把已有清单覆盖成一行） */
  const sourcePath = path.join(vendorDir, 'SOURCE.md');
  if (manifest.length > 1 || !existsSync(sourcePath)) {
    const rows = manifest
      .map((item) => `| \`${item.file}\` | ${(item.bytes / 1024).toFixed(0)} KB | \`${item.sha256.slice(0, 16)}…\` | ${item.url} |`)
      .join('\n');
    const source = `# vendor 依赖清单

离线版原型引用的前端库，全部是从 CDN 下载后落到本地的副本。
页面里的 \`<script src>\` / \`<link href>\` 都指向 \`vendor/\`，断网可用。

| 文件 | 大小 | sha256 | 来源 |
|---|---|---|---|
${rows}

- 语言包 \`${LOCALE_NAME}\` 是 skill 内置的 antd ${LOCALE_VERSION} \`locale/zh_CN\` 快照（MIT），由 \`scripts/offline.mjs\` 复制，避免离线时去请求 esm.sh。
- 升级 React / antd / Babel 版本后请重新执行离线打包，哈希与清单会一起更新。
- 整个目录一起分发；只拷 \`*.html\` 会丢掉这些依赖。
`;
    await writeFile(sourcePath, source, 'utf8');
  }

  /* 6. README 补一节 */
  const readmePath = path.join(dir, 'README.md');
  if (existsSync(readmePath)) {
    const readme = await readFile(readmePath, 'utf8');
    await writeFile(readmePath, withOfflineSection(readme), 'utf8');
  }

  /* 7. 验收：页面里不能再有外链 */
  const leftover = [];
  for (const file of files) {
    const html = await readFile(path.join(dir, file), 'utf8');
    for (const match of html.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)) leftover.push(`${file} → ${match[1]}`);
    if (/\bimport\(['"]https?:/.test(html)) leftover.push(`${file} → 仍有远程 import()`);
  }

  const vendorFiles = (await readdir(vendorDir)).filter((file) => file !== 'SOURCE.md');
  let totalBytes = 0;
  for (const file of vendorFiles) totalBytes += (await stat(path.join(vendorDir, file))).size;

  console.log(
    `\n✅ 离线打包完成：本次下载 ${manifest.length - 1} 个资源，改写 ${rewritten} 个页面；vendor/ 共 ${vendorFiles.length} 个文件、${(totalBytes / 1024).toFixed(0)} KB`
  );
  console.log(`   目录：${dir}`);
  console.log(`   断网自检：${leftover.length === 0 ? '页面无任何外链 ✓' : '仍有外链 ✗'}`);
  for (const item of leftover) console.log(`   ✗ ${item}`);

  if (leftover.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(`❌ ${error.message}`);
  process.exit(1);
});

