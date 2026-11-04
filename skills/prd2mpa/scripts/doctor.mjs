#!/usr/bin/env node
/**
 * prd2mpa · 环境自检
 *
 * 装完 skill 跑一次，逐项告诉你缺什么、怎么补。给非技术同学看也看得懂。
 *
 * 用法：
 *   node scripts/doctor.mjs
 */
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checks = [];
const add = (level, name, detail, fix) => checks.push({ level, name, detail, fix });

const hasNonAscii = (value) => /[^\x00-\x7F]/.test(value);

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

async function main() {
  console.log('prd2mpa · 环境自检\n');
  console.log(`系统：${process.platform} ${process.arch}｜Node：${process.version}\n`);

  /* 1. Node 版本：本地有 ≥18 就直接用，不为版本号升级；只有低于 18 才必须升 */
  const major = Number(process.versions.node.split('.')[0]);
  if (major >= 18) add('ok', 'Node.js 版本', `${process.version}（≥ 18 即可，本地已有的直接使用，不必升级）`);
  else add('fail', 'Node.js 版本', `${process.version} 太旧，脚本用了 fetch / AbortSignal.timeout`, '只有低于 18 才需要升级：winget install OpenJS.NodeJS.LTS，或到 nodejs.org 下 LTS 安装包');

  /* 2. skill 文件完整 */
  const missing = ['SKILL.md', 'assets/template.html', 'scripts/scaffold.mjs', 'scripts/verify.mjs', 'scripts/shot.mjs', 'scripts/offline.mjs'].filter(
    (file) => !existsSync(path.join(SKILL_DIR, file))
  );
  if (missing.length === 0) add('ok', 'skill 文件完整', `目录：${SKILL_DIR}`);
  else add('fail', 'skill 文件不全', `缺少：${missing.join('、')}`, '整个 skills/prd2mpa 目录一起复制，不要只拷 SKILL.md');

  /* 3. 当前目录可写（原型默认生成在这里） */
  try {
    const probe = await mkdtemp(path.join(process.cwd(), '.doctor-'));
    await rm(probe, { recursive: true, force: true });
    add('ok', '当前目录可写', process.cwd());
  } catch (error) {
    add('fail', '当前目录不可写', `${process.cwd()}（${error.code || error.message}）`, '换一个工作目录（例如 D:\\proto）再执行，或给该目录写权限');
  }

  /* 4. 浏览器（只影响截图自检，不影响出页面） */
  const browser = findBrowser();
  if (browser) add('ok', '浏览器', browser);
  else add('warn', '浏览器', '没有找到 Edge / Chrome', '装一个 Chrome，或设置环境变量 CHROME_PATH 指向浏览器可执行文件；不装也能生成页面，只是没法自动截图自检');

  /* 5. CDN 连通性（首次生成页面要联网） */
  const targets = [
    'https://unpkg.com/react@18.3.1/umd/react.production.min.js',
    'https://cdn.jsdelivr.net/npm/antd@6.6.8/dist/antd.min.js'
  ];
  const reach = [];
  for (const url of targets) {
    try {
      const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(8000) });
      reach.push(response.ok);
    } catch {
      reach.push(false);
    }
  }
  if (reach.every(Boolean)) add('ok', 'CDN 连通', 'unpkg.com、cdn.jsdelivr.net 均可访问');
  else if (reach.some(Boolean)) add('warn', 'CDN 部分可用', '有一个源访问失败', '换一个网络或代理重试；离线环境可以直接用已经带 vendor/ 的交付目录');
  else add('warn', 'CDN 不可达', '两个源都访问失败', '检查代理/网络；如果现场本就断网，让有网的同事跑一次 scripts/offline.mjs 做好离线包再拷过来');

  /* 6. git（可选，用于更新 skill） */
  const git = spawnSync('git', ['--version'], { encoding: 'utf8' });
  if (git.status === 0) add('ok', 'git', git.stdout.trim());
  else add('warn', 'git', '未安装或不在 PATH', '可选：装 Git for Windows 后用 git pull 更新 skill；不装就手动拷贝目录');

  /* 7. 路径字符（不阻塞，但提醒） */
  if (hasNonAscii(SKILL_DIR) || hasNonAscii(process.cwd())) {
    add('warn', '路径含中文/空格', `skill：${SKILL_DIR}｜当前目录：${process.cwd()}`, '脚本本身支持，但个别工具链会出问题；正式交付建议用纯英文路径');
  } else {
    add('ok', '路径字符', '纯英文，无空格');
  }

  /* 输出 */
  const mark = { ok: '✓', warn: '!', fail: '✗' };
  const displayWidth = (text) =>
    [...text].reduce((sum, char) => sum + (/[\u3000-\u9fff\uff00-\uffef]/.test(char) ? 2 : 1), 0);
  const padTo = (text, width) => text + ' '.repeat(Math.max(0, width - displayWidth(text)));
  const width = Math.max(...checks.map((item) => displayWidth(item.name)));
  for (const item of checks) {
    console.log(`${mark[item.level]} ${padTo(item.name, width)}  ${item.detail}`);
    if (item.fix) console.log(`  ${' '.repeat(width)}  → ${item.fix}`);
  }

  const fails = checks.filter((item) => item.level === 'fail').length;
  const warns = checks.filter((item) => item.level === 'warn').length;
  console.log(`\n${fails === 0 ? '✅ 必需项都通过' : `❌ ${fails} 项必需条件不满足`}（警告 ${warns} 项）`);

  if (fails === 0) {
    console.log('\n下一步（在当前工作目录执行）：');
    console.log('  node <skill>/scripts/scaffold.mjs --manifest ./prototype.json');
  }
  if (fails > 0) process.exit(1);
}

main().catch((error) => {
  console.error(`❌ 自检异常：${error.message}`);
  process.exit(1);
});

