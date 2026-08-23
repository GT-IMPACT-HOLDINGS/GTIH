/**
 * Lexiom 1.3 — Bud Center preview / artifact path resolution (Phase B).
 * Never expose osng/, nodes/, prompts, or control-plane files via Bud URLs.
 */

import { promises as fsp } from 'fs';
import path from 'path';
import { primaryArtifactForPlugin } from './lexiom13CaPolicy.js';

const CONTROL_FILE_NAMES = new Set([
  'AGENT_PROMPT.md',
  'EVIDENCE_AGENT_PROMPT.md',
  'EVIDENCE_PLAN.json',
  'EVIDENCE_MANIFEST.json',
  'HANDOFF.json',
  'BUILD_PLAN.json',
  'BUILD_MANIFEST.json',
  'BUILD_REPORT.md',
  'BUILD_NOTES.md',
  'PHASE_LEDGER.json',
  'SOURCE_MAP.json',
  'RUN_RESULT.json',
  'OSNG_Basics_README.md'
]);

const DENY_DIR_PREFIXES = [
  'osng/',
  'nodes/',
  'sources/',
  'evidences/',
  'sections/',
  '.gt3/',
  'ca/'
];

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function toPosix(p) {
  return String(p || '').split(path.sep).join('/');
}

export function getLexiom13BuildsRoot(repoRoot) {
  return path.join(repoRoot, 'builds', 'lexiom13');
}

function assertSafeRunId(runId) {
  const id = String(runId || '').trim();
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw httpError(400, 'Invalid runId');
  }
  return id;
}

function resolveUnderRun(runDir, relativePosix) {
  const cleaned = toPosix(relativePosix).replace(/^\/+/, '');
  if (!cleaned || cleaned.includes('\0')) {
    return null;
  }
  const parts = cleaned.split('/').filter((p) => p && p !== '.');
  if (parts.some((p) => p === '..')) {
    return null;
  }
  const abs = path.resolve(runDir, ...parts);
  const rootResolved = path.resolve(runDir);
  if (abs !== rootResolved && !abs.startsWith(rootResolved + path.sep)) {
    return null;
  }
  return { abs, posixRel: toPosix(path.relative(rootResolved, abs)) || '' };
}

function isDeniedBudPath(posixRel) {
  const rel = String(posixRel || '');
  if (!rel) return false;
  const lower = rel.toLowerCase();
  if (DENY_DIR_PREFIXES.some((p) => lower === p.slice(0, -1) || lower.startsWith(p))) {
    return true;
  }
  const base = path.posix.basename(rel);
  if (CONTROL_FILE_NAMES.has(base)) {
    return true;
  }
  return false;
}

/**
 * Document primary (or allowlisted entry) under the run directory.
 */
export async function resolveBudArtifactFile(repoRoot, runId, entryFileName) {
  const id = assertSafeRunId(runId);
  const runDir = path.join(getLexiom13BuildsRoot(repoRoot), id);
  const entry = String(entryFileName || '').trim() || 'document.md';
  if (entry.includes('/') || entry.includes('\\') || entry.includes('..')) {
    throw httpError(400, 'Invalid artifact entry');
  }
  if (isDeniedBudPath(entry) && entry !== 'document.md' && entry !== 'index.html') {
    throw httpError(403, 'Artifact path not allowed');
  }
  // Only primary deliverables for the artifact endpoint.
  if (entry !== 'document.md' && entry !== 'index.html') {
    throw httpError(403, 'Artifact entry must be document.md or index.html');
  }
  const resolved = resolveUnderRun(runDir, entry);
  if (!resolved) {
    throw httpError(403, 'Artifact path not allowed');
  }
  try {
    const st = await fsp.stat(resolved.abs);
    if (!st.isFile()) {
      throw httpError(404, 'Artifact not found');
    }
  } catch (e) {
    if (e && e.statusCode) throw e;
    throw httpError(404, 'Artifact not found');
  }
  return resolved.abs;
}

/**
 * Software preview file under the run directory (SPA assets).
 * Empty relative path → index.html.
 */
export async function resolveBudPreviewFile(repoRoot, runId, relativeParts) {
  const id = assertSafeRunId(runId);
  const runDir = path.join(getLexiom13BuildsRoot(repoRoot), id);
  try {
    const st = await fsp.stat(runDir);
    if (!st.isDirectory()) {
      throw httpError(404, 'Build run not found');
    }
  } catch (e) {
    if (e && e.statusCode) throw e;
    throw httpError(404, 'Build run not found');
  }

  let rel = (Array.isArray(relativeParts) ? relativeParts : [])
    .map((p) => String(p || ''))
    .filter(Boolean)
    .join('/');
  if (!rel || rel.endsWith('/')) {
    rel = (rel || '') + 'index.html';
  }

  if (isDeniedBudPath(rel)) {
    throw httpError(403, 'Preview path not allowed');
  }

  const resolved = resolveUnderRun(runDir, rel);
  if (!resolved) {
    throw httpError(403, 'Preview path not allowed');
  }

  try {
    const st = await fsp.stat(resolved.abs);
    if (st.isDirectory()) {
      const indexAbs = path.join(resolved.abs, 'index.html');
      await fsp.access(indexAbs);
      if (isDeniedBudPath(toPosix(path.relative(runDir, indexAbs)))) {
        throw httpError(403, 'Preview path not allowed');
      }
      return indexAbs;
    }
    if (!st.isFile()) {
      throw httpError(404, 'Preview file not found');
    }
  } catch (e) {
    if (e && e.statusCode) throw e;
    throw httpError(404, 'Preview file not found');
  }
  return resolved.abs;
}

export function defaultBudEntryForPlugin(pluginId) {
  return primaryArtifactForPlugin(pluginId);
}
