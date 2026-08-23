/**
 * Read GT3 agent-runtime bringup status from `.gt3-agent-runtime/`.
 * Docker + Aider image (VAL). Never throws for missing files.
 */
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

export const AGENT_RUNTIME_DIRNAME = '.gt3-agent-runtime';
export const BRINGUP_STATUS_FILENAME = 'BRINGUP_STATUS.json';
export const MANIFEST_FILENAME = 'manifest.json';

/**
 * @param {string} repoRoot absolute path to GT3 repo root
 */
export async function readAgentRuntimeBringup(repoRoot) {
  const runtimeDir = path.join(repoRoot, AGENT_RUNTIME_DIRNAME);
  const statusPath = path.join(runtimeDir, BRINGUP_STATUS_FILENAME);
  const manifestPath = path.join(runtimeDir, MANIFEST_FILENAME);
  const readAt = new Date().toISOString();

  const base = {
    bringup_status: /** @type {'ok' | 'failed' | 'unknown'} */ ('unknown'),
    detail:
      'Agent runtime bringup has not run yet (no BRINGUP_STATUS.json). Run npm install or node scripts/gt3-agent-runtime-install.mjs (requires Docker).',
    docker: null,
    image: null,
    // Legacy keys kept null so old Ops UI does not crash; prefer docker/image.
    agentfs: null,
    aider: null,
    runtime_dir: runtimeDir,
    status_path: statusPath,
    manifest_path: manifestPath,
    read_at: readAt
  };

  let status = null;
  let manifest = null;

  try {
    status = JSON.parse(await fsp.readFile(statusPath, 'utf8'));
  } catch {
    /* missing */
  }
  try {
    manifest = JSON.parse(await fsp.readFile(manifestPath, 'utf8'));
  } catch {
    /* missing */
  }

  if (!status && !manifest) {
    return base;
  }

  const bringupStatus =
    status && typeof status.status === 'string'
      ? String(status.status).toLowerCase()
      : manifest && manifest.docker && manifest.image && manifest.image.id
        ? 'ok'
        : 'unknown';

  const normalized =
    bringupStatus === 'ok' || bringupStatus === 'failed' || bringupStatus === 'unknown'
      ? bringupStatus
      : 'unknown';

  const docker =
    (manifest && manifest.docker) || (status && status.docker) || null;
  const image =
    (manifest && manifest.image) || (status && status.image) || null;

  return {
    bringup_status: normalized,
    detail:
      (status && typeof status.detail === 'string' && status.detail) ||
      (normalized === 'ok' ? null : base.detail),
    docker: docker
      ? {
          ok: !!(docker.ok || docker.version),
          version: docker.version || null
        }
      : null,
    image: image
      ? {
          name: image.name || null,
          id: image.id || null
        }
      : null,
    agentfs: null,
    aider: image
      ? {
          version: image.name || null,
          path: image.id || null
        }
      : null,
    runtime_dir: runtimeDir,
    status_path: statusPath,
    manifest_path: manifestPath,
    read_at: readAt
  };
}

export function readAgentRuntimeBringupSync(repoRoot) {
  const runtimeDir = path.join(repoRoot, AGENT_RUNTIME_DIRNAME);
  const statusPath = path.join(runtimeDir, BRINGUP_STATUS_FILENAME);
  const manifestPath = path.join(runtimeDir, MANIFEST_FILENAME);
  try {
    if (!fs.existsSync(statusPath) && !fs.existsSync(manifestPath)) {
      return {
        bringup_status: 'unknown',
        detail:
          'Agent runtime bringup has not run yet. Run npm install (requires Docker).',
        docker: null,
        image: null,
        agentfs: null,
        aider: null
      };
    }
    const status = fs.existsSync(statusPath)
      ? JSON.parse(fs.readFileSync(statusPath, 'utf8'))
      : null;
    const manifest = fs.existsSync(manifestPath)
      ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      : null;
    const st = status && status.status ? String(status.status).toLowerCase() : 'unknown';
    return {
      bringup_status: st === 'ok' || st === 'failed' ? st : 'unknown',
      detail: (status && status.detail) || null,
      docker: (manifest && manifest.docker) || (status && status.docker) || null,
      image: (manifest && manifest.image) || (status && status.image) || null,
      agentfs: null,
      aider: null
    };
  } catch (e) {
    return {
      bringup_status: 'failed',
      detail: e && e.message ? String(e.message) : String(e),
      docker: null,
      image: null,
      agentfs: null,
      aider: null
    };
  }
}
