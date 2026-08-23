/**
 * Lexiom 1.3 — Evidence Cockpit Sync (Focus-closure poll).
 * Spec: public/gt2/Lexiom_1_3/BuildPlugins/Lexiom_1_3_Evidence_Cockpit_Sync_1_0.md
 */

import { promises as fsp } from 'fs';
import path from 'path';
import {
  EVIDENCE_ARTIFACTS_DIR,
  EVIDENCE_MANIFEST_FILENAME,
  EVIDENCE_PLAN_FILENAME
} from './lexiom13BuildEvidence.js';

export const EVIDENCE_COCKPIT_SYNC_SCHEMA = 'lexiom13-evidence-cockpit-sync/1';

const HANDOFF_FILENAME = 'HANDOFF.json';
const PRIMARY_ARTIFACT_ALLOWLIST = new Set(['document.md', 'index.html']);

const MEDIA_BY_EXT = {
  md: 'markdown',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  webm: 'video',
  mp4: 'video',
  js: 'code',
  ts: 'code',
  txt: 'text',
  html: 'text'
};

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

function inferMediaType(fileName) {
  const ext = String(fileName || '')
    .split('.')
    .pop()
    .toLowerCase();
  return MEDIA_BY_EXT[ext] || 'text';
}

function artifactPublicUrl(runId, relativePosixPath) {
  const cleaned = toPosix(relativePosixPath).replace(/^\/+/, '');
  return `/lexiom13/evidence/artifact/${encodeURIComponent(runId)}/${cleaned
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
}

async function readJsonIfExists(absPath) {
  try {
    const raw = await fsp.readFile(absPath, 'utf8');
    const trimmed = String(raw || '').trim();
    if (!trimmed) {
      return null;
    }
    return JSON.parse(trimmed);
  } catch (e) {
    if (e && (e.code === 'ENOENT' || e.code === 'ENOTDIR')) {
      return null;
    }
    // Truncated / corrupt control JSON must not take down Focus evidence polling.
    if (e instanceof SyntaxError) {
      console.warn('lexiom13_evidence_json_skip', absPath, e.message);
      return null;
    }
    throw e;
  }
}

async function listRunDirectories(buildsRoot) {
  let entries;
  try {
    entries = await fsp.readdir(buildsRoot, { withFileTypes: true });
  } catch (e) {
    if (e && e.code === 'ENOENT') {
      return [];
    }
    throw e;
  }
  const runs = [];
  for (const ent of entries) {
    if (!ent.isDirectory()) {
      continue;
    }
    const runId = ent.name;
    if (!runId || runId.startsWith('.')) {
      continue;
    }
    const runDir = path.join(buildsRoot, runId);
    let mtimeMs = 0;
    try {
      const st = await fsp.stat(runDir);
      mtimeMs = st.mtimeMs || 0;
    } catch (_e) {
      continue;
    }
    runs.push({ runId, runDir, mtimeMs });
  }
  return runs;
}

function planTargetsForOsn(plan, osnId) {
  const targets = plan && Array.isArray(plan.targets) ? plan.targets : [];
  return targets.filter((t) => t && String(t.osn_id || '') === String(osnId));
}

function handoffTargetsForOsn(handoff, osnId) {
  const targets = handoff && Array.isArray(handoff.success_evidence_targets)
    ? handoff.success_evidence_targets
    : [];
  return targets.filter((t) => t && String(t.osn_id || '') === String(osnId));
}

function runCoversOsn(plan, handoff, osnId) {
  return (
    planTargetsForOsn(plan, osnId).length > 0 ||
    handoffTargetsForOsn(handoff, osnId).length > 0
  );
}

function manifestEntriesByTargetId(manifest) {
  const map = new Map();
  const entries = manifest && Array.isArray(manifest.entries) ? manifest.entries : [];
  for (const entry of entries) {
    if (!entry || !entry.target_id) {
      continue;
    }
    map.set(String(entry.target_id), entry);
  }
  return map;
}

function pickArtifactRelativePath(entry, planTarget) {
  const paths = [];
  if (entry && Array.isArray(entry.artifact_paths)) {
    for (const p of entry.artifact_paths) {
      if (p) {
        paths.push(toPosix(p));
      }
    }
  }
  if (planTarget && planTarget.expected_relative_path) {
    paths.push(toPosix(planTarget.expected_relative_path));
  }
  if (entry && Array.isArray(entry.source_artifact_paths)) {
    for (const p of entry.source_artifact_paths) {
      const rel = toPosix(p);
      const base = path.posix.basename(rel);
      if (PRIMARY_ARTIFACT_ALLOWLIST.has(base) && !rel.includes('/')) {
        paths.push(rel);
      }
    }
  }
  // Prefer evidences/ paths first
  paths.sort((a, b) => {
    const aEv = a.startsWith(`${EVIDENCE_ARTIFACTS_DIR}/`) ? 0 : 1;
    const bEv = b.startsWith(`${EVIDENCE_ARTIFACTS_DIR}/`) ? 0 : 1;
    return aEv - bEv;
  });
  return paths.length ? paths[0] : null;
}

async function fileExistsUnderRun(runDir, relativePosix) {
  if (!relativePosix) {
    return false;
  }
  const resolved = resolveSafeRunPath(runDir, relativePosix);
  if (!resolved) {
    return false;
  }
  try {
    const st = await fsp.stat(resolved);
    return st.isFile();
  } catch (_e) {
    return false;
  }
}

/**
 * Resolve a relative path under runDir; return absolute path or null if unsafe.
 */
export function resolveSafeRunPath(runDir, relativePosix) {
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

  const posixRel = toPosix(path.relative(rootResolved, abs));
  if (posixRel.startsWith(`${EVIDENCE_ARTIFACTS_DIR}/`) || posixRel === EVIDENCE_ARTIFACTS_DIR) {
    return abs;
  }
  // Primary deliverable at run root only
  if (!posixRel.includes('/') && PRIMARY_ARTIFACT_ALLOWLIST.has(posixRel)) {
    return abs;
  }
  return null;
}

function rankTimeMs(manifest, mtimeMs) {
  if (manifest && manifest.collected_at) {
    const t = Date.parse(manifest.collected_at);
    if (!Number.isNaN(t)) {
      return t;
    }
  }
  return mtimeMs || 0;
}

/**
 * Focus-closure: list collection status for one OSN across covering build runs.
 */
export async function listFocusEvidenceCollections(repoRoot, osnId) {
  const focusId = String(osnId || '').trim();
  if (!focusId) {
    throw httpError(400, 'osn_id is required');
  }

  const buildsRoot = getLexiom13BuildsRoot(repoRoot);
  const runDirs = await listRunDirectories(buildsRoot);
  const covering = [];

  for (const run of runDirs) {
    const plan = await readJsonIfExists(path.join(run.runDir, EVIDENCE_PLAN_FILENAME));
    const handoff = await readJsonIfExists(path.join(run.runDir, HANDOFF_FILENAME));
    if (!runCoversOsn(plan, handoff, focusId)) {
      continue;
    }
    const manifest = await readJsonIfExists(path.join(run.runDir, EVIDENCE_MANIFEST_FILENAME));
    const hasManifest = !!(manifest && Array.isArray(manifest.entries));
    const rank = rankTimeMs(manifest, run.mtimeMs);
    covering.push({
      runId: run.runId,
      runDir: run.runDir,
      plugin_id:
        (manifest && manifest.plugin_id) ||
        (plan && plan.plugin_id) ||
        (handoff && handoff.plugin_id) ||
        null,
      has_manifest: hasManifest,
      rank_time: new Date(rank).toISOString(),
      rankMs: rank,
      plan,
      handoff,
      manifest
    });
  }

  // Newest first; prefer has_manifest when rank equal
  covering.sort((a, b) => {
    if (b.rankMs !== a.rankMs) {
      return b.rankMs - a.rankMs;
    }
    if (a.has_manifest !== b.has_manifest) {
      return a.has_manifest ? -1 : 1;
    }
    return String(b.runId).localeCompare(String(a.runId));
  });

  /** @type {Map<string, object>} */
  const bestByTarget = new Map();

  for (const run of covering) {
    const planTargets = planTargetsForOsn(run.plan, focusId);
    const planByEvidenceId = new Map();
    for (const t of planTargets) {
      planByEvidenceId.set(String(t.evidence_id), t);
    }
    // Also seed from handoff slim targets if plan missing a row
    for (const t of handoffTargetsForOsn(run.handoff, focusId)) {
      const eid = String(t.evidence_id || '');
      if (eid && !planByEvidenceId.has(eid)) {
        planByEvidenceId.set(eid, {
          target_id: `${focusId}::${eid}`,
          osn_id: focusId,
          evidence_id: eid,
          kind: t.kind,
          direct: t.direct === true,
          expected_relative_path: t.expected_relative_path
        });
      }
    }

    const entryMap = manifestEntriesByTargetId(run.manifest);

    for (const [evidenceId, planTarget] of planByEvidenceId) {
      const targetId = String(planTarget.target_id || `${focusId}::${evidenceId}`);
      const entry = entryMap.get(targetId) || null;
      let status = 'pending';
      let notes = null;
      let artifact = null;

      if (entry) {
        status = String(entry.status || 'pending');
        notes = entry.notes ? String(entry.notes) : null;
        if (status === 'collected') {
          const rel = pickArtifactRelativePath(entry, planTarget);
          if (rel && (await fileExistsUnderRun(run.runDir, rel))) {
            const fileName = path.posix.basename(toPosix(rel));
            artifact = {
              url: artifactPublicUrl(run.runId, rel),
              file_name: fileName,
              media_type: inferMediaType(fileName)
            };
          } else if (rel) {
            // Status claims collected but file missing — treat as failed for cockpit
            status = 'failed';
            notes = (notes ? notes + ' ' : '') + 'Declared collected but artifact file missing.';
          }
        }
      }

      const candidate = {
        target_id: targetId,
        evidence_id: evidenceId,
        kind: (entry && entry.kind) || planTarget.kind || null,
        direct:
          entry && typeof entry.direct === 'boolean'
            ? entry.direct
            : planTarget.direct === true,
        status,
        artifact,
        notes,
        run_id: run.runId
      };

      const existing = bestByTarget.get(targetId);
      if (!existing) {
        bestByTarget.set(targetId, { ...candidate, _rankMs: run.rankMs });
        continue;
      }
      // Per-target latest wins: prefer collected+artifact from newer run
      const existingCollected = existing.status === 'collected' && existing.artifact;
      const candidateCollected = candidate.status === 'collected' && candidate.artifact;
      if (candidateCollected && !existingCollected) {
        bestByTarget.set(targetId, { ...candidate, _rankMs: run.rankMs });
      } else if (candidateCollected && existingCollected && run.rankMs > existing._rankMs) {
        bestByTarget.set(targetId, { ...candidate, _rankMs: run.rankMs });
      } else if (!existingCollected && !candidateCollected && run.rankMs > existing._rankMs) {
        bestByTarget.set(targetId, { ...candidate, _rankMs: run.rankMs });
      }
    }
  }

  const targets = Array.from(bestByTarget.values()).map((row) => {
    const { _rankMs, ...rest } = row;
    return rest;
  });
  targets.sort((a, b) => String(a.evidence_id).localeCompare(String(b.evidence_id)));

  return {
    schema_version: EVIDENCE_COCKPIT_SYNC_SCHEMA,
    osn_id: focusId,
    polled_at: new Date().toISOString(),
    source_runs: covering.map((r) => ({
      run_id: r.runId,
      plugin_id: r.plugin_id,
      has_manifest: r.has_manifest,
      rank_time: r.rank_time
    })),
    targets
  };
}

/**
 * Resolve an artifact path for GET /lexiom13/evidence/artifact/:runId/*
 */
export async function resolveEvidenceArtifactFile(repoRoot, runId, relativeParts) {
  const safeRunId = String(runId || '').trim();
  if (!safeRunId || safeRunId.includes('..') || safeRunId.includes('/') || safeRunId.includes('\\')) {
    throw httpError(400, 'Invalid runId');
  }
  const buildsRoot = getLexiom13BuildsRoot(repoRoot);
  const runDir = path.join(buildsRoot, safeRunId);
  try {
    const st = await fsp.stat(runDir);
    if (!st.isDirectory()) {
      throw httpError(404, 'Build run not found');
    }
  } catch (e) {
    if (e && e.statusCode) {
      throw e;
    }
    throw httpError(404, 'Build run not found');
  }

  const rel = (Array.isArray(relativeParts) ? relativeParts : [])
    .map((p) => String(p || ''))
    .filter(Boolean)
    .join('/');
  const abs = resolveSafeRunPath(runDir, rel);
  if (!abs) {
    throw httpError(403, 'Artifact path not allowed');
  }
  try {
    const st = await fsp.stat(abs);
    if (!st.isFile()) {
      throw httpError(404, 'Artifact not found');
    }
  } catch (e) {
    if (e && e.statusCode) {
      throw e;
    }
    throw httpError(404, 'Artifact not found');
  }
  return abs;
}
