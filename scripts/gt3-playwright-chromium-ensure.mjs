#!/usr/bin/env node
/**
 * GT3 Playwright Chromium ensure — install Chromium if the browser binary is missing.
 *
 * Invoked from package.json `prestart` / `playwright:chromium`. Idempotent: if the
 * executable already exists, exits immediately without re-downloading.
 *
 * Env:
 *   GT3_SKIP_PLAYWRIGHT_CHROMIUM=1     — skip; exit 0
 *   GT3_PLAYWRIGHT_CHROMIUM_STRICT=1   — exit non-zero on failure
 *
 * Soft-fails by default so `npm start` still boots; SCREEN-SHOT evidence soft-defers
 * when Chromium remains unavailable.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const INSTALL_TIMEOUT_MS = 30 * 60 * 1000;

function log(msg) {
  console.log(`[gt3-playwright-chromium] ${msg}`);
}

function warn(msg) {
  console.warn(`[gt3-playwright-chromium] ${msg}`);
}

function isTruthyEnv(name) {
  const v = process.env[name];
  return v === '1' || v === 'true';
}

/**
 * @returns {Promise<{ ok: boolean, path?: string, detail?: string }>}
 */
async function resolveChromiumExecutable() {
  let chromium;
  try {
    ({ chromium } = await import('@playwright/test'));
  } catch (error) {
    return {
      ok: false,
      detail: error?.message || '@playwright/test not available'
    };
  }
  let exe;
  try {
    exe = chromium.executablePath();
  } catch (error) {
    return {
      ok: false,
      detail: error?.message || 'chromium.executablePath() failed'
    };
  }
  if (!exe || !fs.existsSync(exe)) {
    return {
      ok: false,
      path: exe || undefined,
      detail: exe
        ? `Executable does not exist: ${exe}`
        : 'chromium.executablePath() returned empty'
    };
  }
  return { ok: true, path: exe };
}

function installChromium() {
  log('Chromium missing — running: npx playwright install chromium');
  const r = spawnSync('npx', ['playwright', 'install', 'chromium'], {
    encoding: 'utf8',
    cwd: ROOT,
    shell: true,
    windowsHide: true,
    timeout: INSTALL_TIMEOUT_MS,
    env: process.env
  });
  return {
    status: r.status,
    error: r.error,
    stdout: (r.stdout || '').trim(),
    stderr: (r.stderr || '').trim(),
    signal: r.signal
  };
}

function failOrContinue(detail, strict) {
  warn(detail);
  if (strict) {
    process.exit(1);
  }
  warn('Continuing without Chromium (SCREEN-SHOT evidences may defer).');
  process.exit(0);
}

async function main() {
  const skip = isTruthyEnv('GT3_SKIP_PLAYWRIGHT_CHROMIUM');
  const strict = isTruthyEnv('GT3_PLAYWRIGHT_CHROMIUM_STRICT');

  if (skip) {
    log('Skipped (GT3_SKIP_PLAYWRIGHT_CHROMIUM=1).');
    process.exit(0);
  }

  const before = await resolveChromiumExecutable();
  if (before.ok) {
    log(`Already installed: ${before.path}`);
    process.exit(0);
  }

  log(`Not installed (${before.detail || 'unknown'}).`);
  const result = installChromium();
  if (result.error) {
    failOrContinue(
      `Install spawn failed: ${result.error.message || result.error}`,
      strict
    );
  }
  if (result.status !== 0) {
    const tail = [result.stderr, result.stdout]
      .filter(Boolean)
      .join('\n')
      .slice(-800);
    failOrContinue(
      `npx playwright install chromium failed (status=${result.status}${
        result.signal ? ` signal=${result.signal}` : ''
      }): ${tail || '(no output)'}`,
      strict
    );
  }

  const after = await resolveChromiumExecutable();
  if (after.ok) {
    log(`Installed: ${after.path}`);
    process.exit(0);
  }

  failOrContinue(
    `Install finished but Chromium still missing: ${after.detail || 'unknown'}`,
    strict
  );
}

main().catch((e) => {
  const detail = e && e.message ? e.message : String(e);
  failOrContinue(`Fatal: ${detail}`, isTruthyEnv('GT3_PLAYWRIGHT_CHROMIUM_STRICT'));
});
