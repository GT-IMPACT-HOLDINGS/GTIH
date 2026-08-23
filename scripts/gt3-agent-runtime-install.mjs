#!/usr/bin/env node
/**
 * GT3 agent-runtime bringup — verify Docker + pull Aider image into status under `.gt3-agent-runtime/`.
 *
 * Invoked from package.json postinstall. Writes:
 *   .gt3-agent-runtime/manifest.json
 *   .gt3-agent-runtime/BRINGUP_STATUS.json
 *
 * Env:
 *   GT3_SKIP_AGENT_RUNTIME_INSTALL=1  — skip; write status unknown; exit 0
 *   GT3_AGENT_RUNTIME_STRICT=1        — exit non-zero on failure
 *   GT3_AIDER_DOCKER_IMAGE            — default paulgauthier/aider
 */
import { spawnSync } from 'child_process';
import fsp from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RUNTIME_DIR = path.join(ROOT, '.gt3-agent-runtime');
const MANIFEST_PATH = path.join(RUNTIME_DIR, 'manifest.json');
const STATUS_PATH = path.join(RUNTIME_DIR, 'BRINGUP_STATUS.json');
const IS_WIN = process.platform === 'win32';
export const DEFAULT_AIDER_DOCKER_IMAGE =
  process.env.GT3_AIDER_DOCKER_IMAGE || 'paulgauthier/aider';

function log(msg) {
  console.log(`[gt3-agent-runtime] ${msg}`);
}

function runCapture(command, args, opts = {}) {
  const r = spawnSync(command, args, {
    encoding: 'utf8',
    shell: opts.shell === true,
    windowsHide: true,
    env: { ...process.env, ...(opts.env || {}) },
    cwd: opts.cwd || ROOT,
    timeout: opts.timeout || 30 * 60 * 1000
  });
  return {
    status: r.status,
    error: r.error,
    stdout: (r.stdout || '').trim(),
    stderr: (r.stderr || '').trim()
  };
}

async function writeJson(filePath, obj) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function dockerVersion() {
  const r = runCapture('docker', ['version', '--format', '{{.Server.Version}}'], {
    timeout: 30 * 1000
  });
  if (r.status === 0 && r.stdout) return r.stdout.split(/\r?\n/)[0];
  const r2 = runCapture('docker', ['version'], { timeout: 30 * 1000 });
  if (r2.status === 0) {
    const m = (r2.stdout || '').match(/Server:\s*[\s\S]*?Version:\s*(\S+)/i);
    return m ? m[1] : (r2.stdout || '').slice(0, 120);
  }
  return null;
}

function dockerInfoOk() {
  const r = runCapture('docker', ['info'], { timeout: 60 * 1000 });
  return r.status === 0;
}

function imageInspect(image) {
  const r = runCapture(
    'docker',
    ['image', 'inspect', image, '--format', '{{.Id}}'],
    { timeout: 60 * 1000 }
  );
  if (r.status === 0 && r.stdout) {
    return { id: r.stdout.split(/\r?\n/)[0], name: image };
  }
  return null;
}

function pullImage(image) {
  log(`Pulling ${image}…`);
  const r = runCapture('docker', ['pull', image], { timeout: 45 * 60 * 1000 });
  if (r.status !== 0) {
    throw new Error(
      `docker pull failed: ${(r.stderr || r.stdout || r.error || '').toString().slice(0, 800)}`
    );
  }
}

async function main() {
  const skip = process.env.GT3_SKIP_AGENT_RUNTIME_INSTALL === '1';
  const strict =
    process.env.GT3_AGENT_RUNTIME_STRICT === '1' ||
    process.env.GT3_AGENT_RUNTIME_STRICT === 'true';
  const image = DEFAULT_AIDER_DOCKER_IMAGE;

  await fsp.mkdir(RUNTIME_DIR, { recursive: true });

  if (skip) {
    await writeJson(STATUS_PATH, {
      status: 'unknown',
      detail: 'Skipped (GT3_SKIP_AGENT_RUNTIME_INSTALL=1).',
      completed_at: new Date().toISOString(),
      platform: process.platform,
      docker: null,
      image: null
    });
    await writeJson(MANIFEST_PATH, {
      schema_version: 'gt3-agent-runtime/docker/1',
      skipped: true,
      docker: null,
      image: null
    });
    log('Skipped agent runtime install.');
    process.exit(0);
  }

  const errors = [];
  let docker = null;
  let imageInfo = null;

  try {
    if (!dockerInfoOk()) {
      throw new Error(
        'Docker daemon not reachable (`docker info` failed). Install Docker Engine / Docker Desktop and ensure it is running.'
      );
    }
    const ver = dockerVersion();
    docker = { ok: true, version: ver || 'unknown' };
    log(`Docker ok: ${docker.version}`);
  } catch (e) {
    errors.push(e && e.message ? e.message : String(e));
    log(`Docker FAILED: ${errors[errors.length - 1]}`);
  }

  if (docker && docker.ok) {
    try {
      imageInfo = imageInspect(image);
      if (!imageInfo) {
        pullImage(image);
        imageInfo = imageInspect(image);
      }
      if (!imageInfo) {
        throw new Error(`Image ${image} not found after pull.`);
      }
      log(`Image ok: ${imageInfo.name} (${imageInfo.id})`);
    } catch (e) {
      errors.push(e && e.message ? e.message : String(e));
      log(`Image FAILED: ${errors[errors.length - 1]}`);
    }
  }

  const ok = !!(docker && docker.ok && imageInfo && imageInfo.id);
  const manifest = {
    schema_version: 'gt3-agent-runtime/docker/1',
    completed_at: new Date().toISOString(),
    platform: process.platform,
    arch: process.arch,
    docker,
    image: imageInfo
      ? { name: imageInfo.name || image, id: imageInfo.id }
      : { name: image, id: null }
  };
  const status = {
    status: ok ? 'ok' : 'failed',
    detail: ok
      ? null
      : errors.join(' | ') || 'Docker agent-runtime bringup incomplete.',
    completed_at: manifest.completed_at,
    platform: process.platform,
    docker: manifest.docker,
    image: manifest.image
  };

  await writeJson(MANIFEST_PATH, manifest);
  await writeJson(STATUS_PATH, status);
  log(`Wrote ${STATUS_PATH} status=${status.status}`);

  if (!ok && strict) process.exit(1);
  process.exit(0);
}

main().catch(async (e) => {
  const detail = e && e.message ? e.message : String(e);
  log(`Fatal: ${detail}`);
  try {
    await fsp.mkdir(RUNTIME_DIR, { recursive: true });
    await writeJson(STATUS_PATH, {
      status: 'failed',
      detail,
      completed_at: new Date().toISOString(),
      platform: process.platform,
      docker: null,
      image: null
    });
  } catch {
    /* ignore */
  }
  process.exit(process.env.GT3_AGENT_RUNTIME_STRICT === '1' ? 1 : 0);
});
