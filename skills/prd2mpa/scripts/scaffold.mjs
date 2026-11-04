#!/usr/bin/env node
/**
 * prd2mpa · 页面骨架生成器
 *
 * 从 assets/template.html 生成一批自包含的 HTML 页面，保证所有页面的
 * 依赖顺序、Design Token、应用壳、主题配置完全一致。页面业务代码由
 * 后续步骤填到每页的 PAGE CODE 区域。
 *
 * 用法：
 *   node scripts/scaffold.mjs --manifest prototype.json
 *   node scripts/scaffold.mjs --manifest prototype.json --force
 *   node scripts/scaffold.mjs --manifest prototype.json --out ./dist/001-订购台
 *
 * manifest 结构见 assets/manifest.example.json。
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE = path.join(SKILL_DIR, 'assets', 'template.html');
const INDEX_TEMPLATE = path.join(SKILL_DIR, 'assets', 'index-template.html');
const README_TEMPLATE = path.join(SKILL_DIR, 'assets', 'readme-template.md');
const SHELL_TEMPLATE = path.join(SKILL_DIR, 'assets', 'shell.js');

function parseArgs(argv) {
  const args = { force: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--force') args.force = true;
    else if (token === '--manifest') args.manifest = argv[++i];
    else if (token === '--out') args.out = argv[++i];
    else if (token === '--template') args.template = argv[++i];
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

/** 页面文件名校验：平铺在输出目录，只用小写字母、数字和短横线。 */
function assertFileName(file) {
  if (!/^[a-z0-9][a-z0-9-]*\.html$/.test(file)) {
    throw new Error(`页面文件名不合法：${file}（要求小写字母/数字/短横线 + .html）`);
  }
  if (file === 'index.html') throw new Error('index.html 由脚本生成，不要在 pages 里重复声明');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.manifest) {
    console.log(`用法：node scripts/scaffold.mjs --manifest <prototype.json> [--template <模板.html>] [--out <目录>] [--force]

manifest 必填字段：
  app     应用全名，如「示例应用」
  short   侧栏/品牌区短名，2—4 字
  role    本原型当前扮演的角色，如「业务用户」
  pages   页面数组：[{ file, title, desc, menu?, activeKey?, roles?, priority? }]
          菜单默认按页面生成（每页一项），menu:false 的页面不进菜单；
          需要自定义顺序/图标/合并项时再写 nav：[{ key, label, icon, href, roles? }]
可选：projectName 交付目录里的项目名（默认同 app）；
      out 输出目录（默认 <当前工作目录>/<项目名>-产品原型页面生成版（支持离线））；
      page.role 覆盖该页顶栏显示的角色

--template 用于「用户自带 UI 规范」：把 assets/template.html 复制到项目里改好 Token 与 THEME，
           再用它生成页面，避免污染 skill 的公共模板（见 references/custom-ui-spec.md）`);
    process.exit(args.help ? 0 : 1);
  }

  const manifestPath = path.resolve(args.manifest);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

  for (const field of ['app', 'short', 'role', 'pages']) {
    if (!manifest[field]) throw new Error(`manifest 缺少字段：${field}`);
  }
  if (!Array.isArray(manifest.pages) || manifest.pages.length === 0) throw new Error('manifest.pages 不能为空');
  if (manifest.nav !== undefined && (!Array.isArray(manifest.nav) || manifest.nav.length === 0)) {
    throw new Error('manifest.nav 写了就必须是非空数组；想按页面自动生成菜单就不要写 nav');
  }

  const projectName = (manifest.projectName || manifest.app).replace(/[\\/:*?"<>|]/g, '-');
  const outDir = args.out
    ? path.resolve(args.out)
    : manifest.out
      ? path.resolve(path.dirname(manifestPath), manifest.out)
      : path.join(process.cwd(), `${projectName}-产品原型页面生成版（支持离线）`);
  const seen = new Set();
  const slugOf = (fileName) => path.basename(fileName, '.html');

  for (const page of manifest.pages) {
    if (!page.file || !page.title) throw new Error('pages 每项都需要 file 与 title');
    assertFileName(page.file);
    if (seen.has(page.file)) throw new Error(`页面文件重复：${page.file}`);
    seen.add(page.file);
  }

  /* 菜单：默认「每个页面一项」，写 menu:false 的页面不进菜单；
     想自定义顺序/图标/合并项，再显式写 nav（此时页面用 activeKey 归并到某个菜单项）。 */
  let nav;
  let activeKeyOf;
  if (Array.isArray(manifest.nav) && manifest.nav.length > 0) {
    nav = manifest.nav.map((item) => ({
      key: item.key,
      label: item.label,
      icon: item.icon || 'AppstoreOutlined',
      href: item.href || `${item.key}.html`,
      ...(Array.isArray(item.roles) && item.roles.length ? { roles: item.roles } : {}),
      ...(item.previewOnly ? { previewOnly: true } : {})
    }));
    const navKeys = new Set(nav.map((item) => item.key));
    for (const page of manifest.pages) {
      if (page.activeKey && !navKeys.has(page.activeKey)) {
        throw new Error(`页面 ${page.file} 的 activeKey「${page.activeKey}」不在 nav 里`);
      }
    }
    for (const item of nav) {
      if (!seen.has(item.href)) {
        console.warn(`⚠️  导航「${item.label}」指向 ${item.href}，但 pages 里没有这个文件`);
      }
    }
    const navByHref = new Map(nav.map((item) => [item.href, item.key]));
    activeKeyOf = (page) => page.activeKey || navByHref.get(page.file) || '';
    const covered = new Set(nav.map((item) => item.href));
    const uncovered = manifest.pages.filter((page) => !covered.has(page.file) && page.menu !== false);
    if (uncovered.length > 0) {
      console.warn(
        `⚠️  这些页面不在菜单里：${uncovered.map((page) => page.file).join('、')}（加 nav 项，或给页面设 "menu": false 明确排除）`
      );
    }
  } else {
    nav = manifest.pages
      .filter((page) => page.menu !== false)
      .map((page) => ({
        key: slugOf(page.file),
        label: page.title,
        icon: page.icon || 'AppstoreOutlined',
        href: page.file,
        ...(Array.isArray(page.roles) && page.roles.length ? { roles: page.roles } : {}),
        ...(page.menu === 'preview' ? { previewOnly: true } : {})
      }));
    activeKeyOf = (page) => (page.menu === false ? '' : slugOf(page.file));
  }

  const templatePath = args.template ? path.resolve(args.template) : TEMPLATE;
  if (!existsSync(templatePath)) throw new Error(`模板不存在：${templatePath}`);
  if (args.template) console.log(`使用自定义模板：${templatePath}`);

  const template = await readFile(templatePath, 'utf8');
  const indexTemplate = await readFile(INDEX_TEMPLATE, 'utf8');
  const readmeTemplate = await readFile(README_TEMPLATE, 'utf8');
  const shellTemplate = await readFile(SHELL_TEMPLATE, 'utf8');

  await mkdir(outDir, { recursive: true });
  const existing = existsSync(outDir) ? await readdir(outDir) : [];
  if (existing.length && !args.force) {
    const clash = manifest.pages.map((p) => p.file).filter((file) => existing.includes(file));
    if (clash.length) {
      throw new Error(`输出目录已有同名页面：${clash.join('、')}（确认可覆盖后加 --force）`);
    }
  }

  const written = [];
  for (const page of manifest.pages) {
    const html = template
      .replaceAll('__PAGE_TITLE__', htmlEscape(page.title))
      .replaceAll('__APP_TITLE__', htmlEscape(manifest.app))
      .replaceAll('__APP_TITLE_JS__', jsString(manifest.app))
      .replaceAll('__APP_SHORT__', jsString(manifest.short))
      .replaceAll('__ROLE__', jsString(page.role || manifest.role))
      .replaceAll('__PAGE_FILE__', jsString(page.file))
      .replaceAll('__ACTIVE_KEY__', jsString(activeKeyOf(page)))
      .replaceAll('__IN_MENU__', nav.some((item) => item.href === page.file) ? 'true' : 'false')
      .replaceAll('__NAV_JSON__', JSON.stringify(nav, null, 2));
    const target = path.join(outDir, page.file);
    await writeFile(target, html, 'utf8');
    written.push(page.file);
  }

  /* 共享壳与菜单：全站一份，写进输出目录，页面用 <script src="shell.js"> 引入 */
  await writeFile(path.join(outDir, 'shell.js'), shellTemplate
      .replace('__NAV_JSON__', JSON.stringify(nav, null, 2))
      .replace('__PREVIEW_DEFAULT__', manifest.preview === false ? 'false' : 'true'), 'utf8');
  written.push('shell.js');

  const cards = manifest.pages
    .map((page, index) => {
      const no = String(index + 1).padStart(2, '0');
      const role = page.role && page.role !== manifest.role ? page.role : '';
      const meta = [page.file, page.priority, role].filter(Boolean).join(' · ');
      return [
        `      <a class="card" href="${page.file}">`,
        `        <span class="no">${no}</span>`,
        `        <span class="title">${htmlEscape(page.title)}</span>`,
        `        <span class="desc">${htmlEscape(page.desc || '')}</span>`,
        `        <span class="file">${htmlEscape(meta)}</span>`,
        '      </a>'
      ].join('\n');
    })
    .join('\n');

  const indexHtml = indexTemplate
    .replaceAll('__APP_TITLE__', htmlEscape(manifest.app))
    .replaceAll('__APP_SHORT__', htmlEscape(manifest.short))
    .replaceAll('__ROLE__', htmlEscape(manifest.role))
    .replaceAll('__PAGE_COUNT__', String(manifest.pages.length))
    .replaceAll('__PAGES_HTML__', cards);
  await writeFile(path.join(outDir, 'index.html'), indexHtml, 'utf8');
  written.unshift('index.html');

  const rows = manifest.pages
    .map(
      (page, index) =>
        `| ${String(index + 1).padStart(2, '0')} | [${page.title}](${page.file}) | ${page.priority || '—'} | ${page.file} | ${page.activeKey || '—'} | ${page.desc || ''} |`
    )
    .join('\n');
  const readme = readmeTemplate
    .replaceAll('__APP_TITLE__', manifest.app)
    .replaceAll('__APP_SHORT__', manifest.short)
    .replaceAll('__ROLE__', manifest.role)
    .replaceAll('__PAGE_COUNT__', String(manifest.pages.length))
    .replaceAll('__PAGE_ROWS__', rows);
  await writeFile(path.join(outDir, 'README.md'), readme, 'utf8');
  written.push('README.md');

  console.log(`✅ 已生成 ${manifest.pages.length} 个页面 → ${outDir}`);
  for (const file of written) console.log(`   · ${file}`);
  console.log('\n下一步：逐页把 PAGE CODE 区域替换成真实页面代码，然后运行：');
  console.log(`   node ${path.relative(process.cwd(), path.join(SKILL_DIR, 'scripts', 'verify.mjs'))} --dir "${outDir}"`);
  console.log('\n自检通过后收尾（目录名标注了「支持离线」，交付前必须真实离线）：');
  console.log(`   node ${path.relative(process.cwd(), path.join(SKILL_DIR, 'scripts', 'offline.mjs'))} --dir "${outDir}"`);
}

main().catch((error) => {
  console.error(`❌ ${error.message}`);
  process.exit(1);
});



