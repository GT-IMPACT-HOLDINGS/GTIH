/**
 * Live smoke: Tegria cockpit happy path — tiny OSNG via async Hanuman propose.
 * Requires GT3 on :8080 and Tegria Vite on :5173.
 *
 *   $env:GT3_RUN_TEGRIA_PROPOSE_SMOKE='1'
 *   node scripts/smoke-tegria-osng-propose.mjs
 */
import { chromium } from '@playwright/test';
import { promises as fsp } from 'node:fs';
import path from 'node:path';

const enabled = process.env.GT3_RUN_TEGRIA_PROPOSE_SMOKE === '1';
if (!enabled) {
  console.log('SKIP Tegria propose smoke (set GT3_RUN_TEGRIA_PROPOSE_SMOKE=1)');
  process.exit(0);
}

const tegriaUrl = process.env.TEGRIA_SMOKE_URL || 'http://localhost:5173/';
const timeoutMs = Number(process.env.GT3_SMOKE_TIMEOUT_MS || 15 * 60 * 1000);
const intent =
  process.env.TEGRIA_SMOKE_INTENT ||
  'A tiny one-page FAQ that answers how to join a neighborhood community garden.';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('console', (message) =>
  console.log(`[browser:${message.type()}] ${message.text()}`)
);
page.on('pageerror', (err) => console.log(`[pageerror] ${err.message}`));

try {
  console.log(`goto ${tegriaUrl}`);
  await page.goto(tegriaUrl, { waitUntil: 'networkidle', timeout: 60000 });

  // Day-zero: empty garden — open Ask Anything via create-volume (+).
  const createVolume = page.getByRole('button', { name: /create a new volume/i });
  await createVolume.waitFor({ state: 'visible', timeout: 30000 });
  await createVolume.click();

  const textarea = page.locator('textarea[placeholder="Ask anything..."]');
  await textarea.waitFor({ state: 'visible', timeout: 30000 });
  await textarea.fill(intent);

  // Send button is the last button in the composer (circular green).
  const send = page.locator('button').filter({ has: page.locator('svg') }).last();
  await send.click();

  console.log('clicked send; waiting for Draft ready or error…');
  const status = page.locator('pre').first();
  await status.waitFor({ state: 'visible', timeout: 60000 });

  const deadline = Date.now() + timeoutMs;
  let lastText = '';
  while (Date.now() < deadline) {
    lastText = ((await status.textContent()) || '').trim();
    console.log(`[status] ${lastText.split('\n').slice(0, 4).join(' | ')}`);
    if (/^Draft ready:/m.test(lastText)) break;
    if (/OSNG propose failed|HTTP 5\d\d|Hanuman propose labor failed/i.test(lastText)) {
      throw new Error(`Tegria propose failed:\n${lastText}`);
    }
    await page.waitForTimeout(4000);
  }

  if (!/^Draft ready:/m.test(lastText)) {
    throw new Error(`Timed out waiting for Draft ready.\nLast status:\n${lastText}`);
  }

  const rootMatch = lastText.match(/Draft ready:\s*(\S+)/);
  const rootId = rootMatch ? rootMatch[1] : null;
  console.log(`UI root: ${rootId}`);

  // Confirm propose workspace on disk has OSNG_PROPOSAL.json from a recent run.
  const proposeRoot = path.join(process.cwd(), 'builds', 'lexiom13-propose');
  const runs = await fsp.readdir(proposeRoot).catch(() => []);
  if (!runs.length) {
    throw new Error('No builds/lexiom13-propose runs found');
  }
  const newest = (
    await Promise.all(
      runs.map(async (id) => {
        const st = await fsp.stat(path.join(proposeRoot, id));
        return { id, mtime: st.mtimeMs };
      })
    )
  ).sort((a, b) => b.mtime - a.mtime)[0];

  const runDir = path.join(proposeRoot, newest.id);
  const resultRaw = await fsp.readFile(path.join(runDir, 'RUN_RESULT.json'), 'utf8');
  const result = JSON.parse(resultRaw);
  const primary = await fsp.readFile(path.join(runDir, 'OSNG_PROPOSAL.json'), 'utf8');
  const proposal = JSON.parse(primary);

  if (result.status !== 'completed' && result.status !== 'ok') {
    throw new Error(
      `RUN_RESULT status=${result.status} reason=${result.reason} detail=${result.detail}`
    );
  }
  if (!proposal.nodes || proposal.nodes.length !== 1) {
    throw new Error(`Expected single-node OSNG, got ${JSON.stringify(proposal).slice(0, 400)}`);
  }
  if (result.envelope && result.envelope.meta && result.envelope.meta.labor !== 'hanuman_browser_ca') {
    throw new Error(`Unexpected labor: ${result.envelope.meta.labor}`);
  }

  console.log(
    `PASS Tegria happy path run_id=${newest.id} root=${proposal.root_osn_id || proposal.nodes[0].id}`
  );
} finally {
  await browser.close();
}
