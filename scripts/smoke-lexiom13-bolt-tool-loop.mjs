import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const enabled = process.env.GT3_RUN_HAIKU_SMOKE === '1';
if (!enabled) {
  console.log('SKIP real Haiku smoke (set GT3_RUN_HAIKU_SMOKE=1)');
  process.exit(0);
}

const baseUrl = process.env.GT3_SMOKE_BASE_URL || 'http://127.0.0.1:8080';
const appUrl = `${baseUrl}/gt2/Lexiom_1_3/index.html?welcome=1`;
const rootId =
  process.env.GT3_SMOKE_OSN_ID || 'GT_Philosophy.BrandLexiom.a1000005.osn';
const timeoutMs = Number(process.env.GT3_SMOKE_TIMEOUT_MS || 20 * 60 * 1000);

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  page.on('console', (message) => console.log(`[browser:${message.type()}] ${message.text()}`));
  await page.goto(appUrl, { waitUntil: 'networkidle', timeout: 60000 });
  const running = await page.evaluate(async (compilationRoot) => {
    async function post(url, body) {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || `${url} failed`);
      return payload;
    }
    const handoff = await post('/lexiom13/build/prepare', {
      compilation_root_osn_id: compilationRoot
    });
    const run = await post('/lexiom13/build/run', {
      compilation_root_osn_id: compilationRoot,
      strategy_id: handoff.strategy_id,
      run_id: handoff.run_id,
      handoff
    });
    const worker = await import('/gt2/Lexiom_1_3/ca/serveRamUnderGt3.js');
    window.__gt3SmokeWorker = worker
      .runBoltWebContainerCa(run.ca_session, {
        onLog: (line) => console.log(`[smoke-ca] ${line}`)
      })
      .then((value) => {
        window.__gt3SmokeWorkerResult = value;
        return value;
      })
      .catch((error) => {
        window.__gt3SmokeWorkerError = error?.message || String(error);
        return null;
      });
    return run;
  }, rootId);
  if (!running?.handoff?.run_id) {
    throw new Error(`Build did not start: ${JSON.stringify(running)}`);
  }
  const runId = running.handoff.run_id;
  console.log(`RUN ${runId}`);

  const deadline = Date.now() + timeoutMs;
  let result = running;
  while (Date.now() < deadline) {
    await page.waitForTimeout(3000);
    result = await page.evaluate(async (id) => {
      const response = await fetch(`/lexiom13/build/status/${encodeURIComponent(id)}`, {
        cache: 'no-store'
      });
      return response.json();
    }, runId);
    if (result.status !== 'running') break;
  }
  if (result.status !== 'completed') {
    throw new Error(
      `Build ${runId} ended ${result.status}: ${result.reason || ''} ${result.detail || ''}`
    );
  }
  const documentPath = path.join(
    process.cwd(),
    'builds',
    'lexiom13',
    runId,
    'document.md'
  );
  const document = await fsp.readFile(documentPath, 'utf8');
  if (!/\bOgun\b/.test(document)) {
    throw new Error(`Build ${runId} completed without preserving Ogun`);
  }
  console.log(`PASS ${runId} document.md contains Ogun`);
} finally {
  await browser.close();
}
