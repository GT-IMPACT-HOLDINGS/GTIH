/**
 * Live smoke: TRH propose → realize (OSNG + SUD).
 * Requires GT3 on :8080 with COOP/COEP on /TRH frontend.
 *
 *   $env:GT3_RUN_TRH_PROPOSE_REALIZE_SMOKE='1'
 *   node scripts/smoke-trh-propose-realize.mjs
 */
import { chromium } from '@playwright/test';
import { promises as fsp } from 'node:fs';
import path from 'node:path';

const enabled = process.env.GT3_RUN_TRH_PROPOSE_REALIZE_SMOKE === '1';
if (!enabled) {
  console.log('SKIP TRH propose→realize smoke (set GT3_RUN_TRH_PROPOSE_REALIZE_SMOKE=1)');
  process.exit(0);
}

const trhUrl =
  process.env.TRH_SMOKE_URL || 'http://localhost:8080/TRH%20frontend/';
const timeoutMs = Number(process.env.GT3_SMOKE_TIMEOUT_MS || 25 * 60 * 1000);
const intent =
  process.env.TRH_SMOKE_INTENT ||
  'A one-page FAQ that answers how to join a neighborhood community garden.';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('console', (message) =>
  console.log(`[browser:${message.type()}] ${message.text()}`)
);
page.on('pageerror', (err) => console.log(`[pageerror] ${err.message}`));

try {
  console.log(`goto ${trhUrl}`);
  await page.goto(trhUrl, { waitUntil: 'networkidle', timeout: 60000 });

  const gtihOk = await page.evaluate(
    () =>
      !!(
        window.gtih &&
        window.gtih.osng &&
        typeof window.gtih.osng.proposeThenRealizeUntilDone === 'function'
      )
  );
  if (!gtihOk) throw new Error('window.gtih.osng.proposeThenRealizeUntilDone missing');

  const baseUrl = await page.evaluate(() =>
    window.gtih.getBaseUrl ? window.gtih.getBaseUrl() : ''
  );
  console.log(`gtih baseUrl=${baseUrl || '(same-origin relative)'}`);

  const intentBox = page.locator('#intent');
  await intentBox.waitFor({ state: 'visible', timeout: 30000 });
  await intentBox.fill(intent);
  await intentBox.press('Enter');

  console.log('started propose→realize; waiting for SUD…');
  const sudPane = page.locator('#sudPane');
  const out = page.locator('#out');
  const deadline = Date.now() + timeoutMs;
  let lastOut = '';
  let sudText = '';

  while (Date.now() < deadline) {
    lastOut = ((await out.textContent()) || '').trim();
    sudText = ((await sudPane.textContent()) || '').trim();
    console.log(`[hanuman] ${lastOut.split('\n').slice(-3).join(' | ')}`);
    if (/failed|error|HTTP 5\d\d/i.test(lastOut) && /propose|realize|labor/i.test(lastOut)) {
      // keep waiting unless sud never appears and we see terminal fail
    }
    if (sudText.length > 40 && !/Waiting for realization/i.test(sudText)) {
      break;
    }
    if (/Hanuman realize failed|OSNG propose failed|proposeThenRealizeUntilDone/i.test(lastOut)) {
      const fatal = /failed|error/i.test(lastOut);
      if (fatal && Date.now() > deadline - timeoutMs + 120000) {
        /* allow early labor noise */
      }
    }
    await page.waitForTimeout(5000);
  }

  sudText = ((await sudPane.textContent()) || '').trim();
  lastOut = ((await out.textContent()) || '').trim();
  if (sudText.length < 40 || /Waiting for realization/i.test(sudText)) {
    throw new Error(
      `Timed out waiting for SUD.\nLast Hanuman log:\n${lastOut}\nSUD:\n${sudText}`
    );
  }

  const osngView = ((await page.locator('#osngView').textContent()) || '').trim();
  if (osngView.length < 20) {
    throw new Error(`OSNG view empty after run:\n${osngView}`);
  }

  // Confirm a recent realize run wrote under builds/lexiom13
  const buildRoot = path.join(process.cwd(), 'builds', 'lexiom13');
  const runs = await fsp.readdir(buildRoot).catch(() => []);
  if (!runs.length) {
    throw new Error('No builds/lexiom13 runs found after TRH realize');
  }
  const newest = (
    await Promise.all(
      runs.map(async (id) => {
        const st = await fsp.stat(path.join(buildRoot, id));
        return { id, mtime: st.mtimeMs };
      })
    )
  ).sort((a, b) => b.mtime - a.mtime)[0];

  console.log(
    `PASS TRH propose→realize run_id=${newest.id} sud_chars=${sudText.length} osng_chars=${osngView.length}`
  );
} finally {
  await browser.close();
}
