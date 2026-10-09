/**
 * Builds the site, serves the build with `astro preview`, waits until it answers, runs Lighthouse
 * on a few representative pages (mobile and desktop) and stops the server again.
 *
 *   npm run lighthouse                         # the default pages
 *   npm run lighthouse -- /gratuity-calculator # just these paths
 *
 * Reports land in lighthouse-reports/ (git-ignored). Needs Chrome or Chromium installed; set
 * CHROME_PATH if Lighthouse cannot find it. Everything runs through `node` directly, because
 * spawning npm/npx can fail on Windows.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const PORT = 4325;
const BASE = `http://localhost:${PORT}`;
const OUT = 'lighthouse-reports';
const PAGES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['/', '/in-hand-salary/12-lpa', '/gratuity-calculator'];
const node = process.execPath;
const astro = join('node_modules', 'astro', 'bin', 'astro.mjs');
const lighthouse = join('node_modules', 'lighthouse', 'cli', 'index.js');

const build = spawnSync(node, [astro, 'build'], { stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);

const preview = spawn(node, [astro, 'preview', '--port', String(PORT)], { stdio: 'ignore' });
const stop = () => preview.kill();
process.on('exit', stop);
process.on('SIGINT', () => process.exit(130));

async function waitForServer(timeoutMs = 30_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      if ((await fetch(BASE)).ok) return;
    } catch {
      /* not listening yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`astro preview did not start on ${BASE}`);
}

await waitForServer();
mkdirSync(OUT, { recursive: true });

const rows = [];
for (const path of PAGES) {
  for (const preset of ['mobile', 'desktop']) {
    const name = `${path.replace(/\W+/g, '-').replace(/^-|-$/g, '') || 'home'}-${preset}`;
    const args = [
      lighthouse,
      `${BASE}${path}`,
      '--quiet',
      '--output=json',
      '--output=html',
      `--output-path=${join(OUT, name)}`,
      '--chrome-flags=--headless=new',
      ...(preset === 'desktop' ? ['--preset=desktop'] : []),
    ];
    // With two outputs Lighthouse writes <name>.report.json and <name>.report.html. On Windows it
    // often exits with an error after writing them, when Chrome is slow to release its temporary
    // profile, so a fresh report file (not the exit code) is what counts as success.
    const reportFile = join(OUT, `${name}.report.json`);
    rmSync(reportFile, { force: true });
    const run = spawnSync(node, args, { stdio: 'inherit' });
    if (!existsSync(reportFile)) {
      rows.push({ page: path, preset, error: `no report (lighthouse exited with ${run.status})` });
      continue;
    }
    const report = JSON.parse(readFileSync(reportFile, 'utf-8'));
    const score = (id) => Math.round((report.categories[id]?.score ?? 0) * 100);
    rows.push({
      page: path,
      preset,
      performance: score('performance'),
      accessibility: score('accessibility'),
      'best-practices': score('best-practices'),
      seo: score('seo'),
    });
  }
}

console.table(rows);
console.log(`Full reports in ${OUT}/`);
