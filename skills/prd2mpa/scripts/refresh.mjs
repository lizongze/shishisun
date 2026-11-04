#!/usr/bin/env node
/**
 * prd2mpa · 批量刷新页面外壳（保留页面代码）
 *
 * 场景：模板升级了（依赖版本、壳样式、bootstrap 改了），但页面代码不能丢。
 * 做法：把每页「PAGE CODE」区域原样搬进新模板，只替换外壳；shell.js 不动（菜单配置保留）。
 *
 * 用法：
 *   node scripts/refresh.mjs --dir ./示例应用-产品原型页面生成版（支持离线）
 *   node scripts/refresh.mjs --dir <目录> --template ./prototype/template.html
 *   node scripts/refresh.mjs --dir <目录> --dry-run
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_TEMPLATE = path.join(SKILL_DIR, 'assets', 'template.html');

function parseArgs(argv) {
  const args = { dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--dir') args.dir = argv[++i];
    else if (token === '--template') args.template = argv[++i];
    else if (token === '--dry-run') args.dryRun = true;
    else if (token === '--no-offline') args.noOffline = true;
    else if (token === '--help' || token === '-h') args.help = true;
    else throw new Error(`未知参数：${token}`);
  }
  return args;
}

const htmlEscape = (text) =>
  String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const jsString = (text) => String(text ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

/** 取出页面里的 PAGE CODE 与外壳需要的元信息 */
function inspect(html, file) {
  const start = html.indexOf('PAGE CODE START');
  const end = html.indexOf('PAGE CODE END');
  if (start < 0 || end < 0) throw new Error('找不到 PAGE CODE 标记（不是本 skill 生成的页面？）');

  const bodyStart = html.indexOf('*/', start) + 2;
  const bodyEnd = html.lastIndexOf('/*', end);
  const body = html.slice(bodyStart, bodyEnd);

  const metaMatch = html.match(/window\.APP_META\s*=\s*\{([\s\S]*?)\};/);
  const meta = {};
  if (metaMatch) {
    for (const item of metaMatch[1].matchAll(/(\w+)\s*:\s*'((?:[^'\\]|\\.)*)'/g)) {
      meta[item[1]] = item[2].replace(/\\'/g, "'").replace(/\\\\/g, '\\');
    }
  }
  const active = (html.match(/window\.PAGE_ACTIVE\s*=\s*'([^']*)'/) || [])[1] || '';
  const inMenu = /window\.PAGE_IN_MENU\s*=\s*true/.test(html);
  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/);
  const pageTitle = titleMatch ? titleMatch[1].split('·')[0].trim() : meta.file || file;

  return {
    body,
    pageTitle,
    appTitle: meta.title || '',
    short: meta.short || '',
    role: meta.role || '',
    file: meta.file || file,
    active,
    inMenu
  };
}

function render(template, page) {
  const filled = template
    .replaceAll('__PAGE_TITLE__', htmlEscape(page.pageTitle))
    .replaceAll('__APP_TITLE__', htmlEscape(page.appTitle))
    .replaceAll('__APP_TITLE_JS__', jsString(page.appTitle))
    .replaceAll('__APP_SHORT__', jsString(page.short))
    .replaceAll('__ROLE__', jsString(page.role))
    .replaceAll('__PAGE_FILE__', jsString(page.file))
    .replaceAll('__ACTIVE_KEY__', jsString(page.active))
    .replaceAll('__IN_MENU__', page.inMenu ? 'true' : 'false');

  const start = filled.indexOf('PAGE CODE START');
  const end = filled.indexOf('PAGE CODE END');
  if (start < 0 || end < 0) throw new Error('模板缺少 PAGE CODE 标记');
  const bodyStart = filled.indexOf('*/', start) + 2;
  const bodyEnd = filled.lastIndexOf('/*', end);
  return filled.slice(0, bodyStart) + page.body + filled.slice(bodyEnd);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.dir) {
    console.log(`用法：node scripts/refresh.mjs --dir <交付目录> [--template <模板.html>] [--dry-run]

作用：模板升级后，把各页面「PAGE CODE」区域搬进新模板，保留页面代码与 shell.js（菜单配置）。
注意：不要用 scaffold --force 覆盖成品页，那会清空页面代码。`);
    process.exit(args.help ? 0 : 1);
  }

  const dir = path.resolve(args.dir);
  const templatePath = args.template ? path.resolve(args.template) : DEFAULT_TEMPLATE;
  if (!existsSync(dir)) throw new Error(`目录不存在：${dir}`);
  if (!existsSync(templatePath)) throw new Error(`模板不存在：${templatePath}`);

  const template = await readFile(templatePath, 'utf8');
  const pages = (await readdir(dir)).filter((file) => file.endsWith('.html') && file !== 'index.html');
  if (pages.length === 0) throw new Error('目录里没有页面');

  let changed = 0;
  for (const file of pages) {
    const target = path.join(dir, file);
    const html = await readFile(target, 'utf8');
    const page = inspect(html, file);
    const next = render(template, page);
    if (next === html) {
      console.log(`= ${file}（已是最新外壳）`);
      continue;
    }
    if (!args.dryRun) await writeFile(target, next, 'utf8');
    changed += 1;
    console.log(`↑ ${file}（保留 ${page.body.trim().split('\n').length} 行页面代码）`);
  }

  console.log(
    `\n${args.dryRun ? '试运行：' : ''}刷新 ${changed}/${pages.length} 页，模板：${path.relative(process.cwd(), templatePath)}`
  );
  if (args.dryRun) return;

  /* 离线版目录：刷新会把依赖标签换回 CDN 引用，紧接着重新打包，避免「看着是离线版、断网却打不开」 */
  if (!args.noOffline && existsSync(path.join(dir, 'vendor'))) {
    console.log('\n检测到 vendor/（离线版），自动重新打包依赖…');
    const result = spawnSync(process.execPath, [path.join(SKILL_DIR, 'scripts', 'offline.mjs'), '--dir', dir], {
      stdio: 'inherit'
    });
    if (result.status !== 0) {
      console.warn('⚠️  离线打包失败：页面现在引用 CDN，请手动跑 offline.mjs 后再交付。');
    }
  } else if (changed > 0) {
    console.log('下一步：node scripts/verify.mjs --dir <目录>');
  }
}

main().catch((error) => {
  console.error(`❌ ${error.message}`);
  process.exit(1);
});

