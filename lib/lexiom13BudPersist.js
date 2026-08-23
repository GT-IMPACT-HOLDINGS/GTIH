/**
 * Lexiom 1.3 — Phase B bud bloom persist.
 * After successful builder (+ evidence when planned), Lexiom/GT3 writes top-level `bud`
 * on the requesting compilation-root OSN YAML. Agents never write this field.
 *
 * Spec: Lexiom_1_3_Center_Playfield_Build_Artifact_Review_UX_Spec_1_0.md
 */

import { promises as fsp } from 'fs';
import path from 'path';
import {
  EVIDENCE_MANIFEST_FILENAME,
  EVIDENCE_PLAN_FILENAME,
  loadEvidencePlanFromBuildDir
} from './lexiom13BuildEvidence.js';
import {
  loadOsnGraphIndex,
  serializeLexiom13OsnYaml,
  stripRuntimeOsnFields
} from './lexiom13OsnPersist.js';
import { primaryArtifactForPlugin } from './lexiom13CaPolicy.js';

export const BUD_SCHEMA_VERSION = 'lexiom13-bud/1';

/**
 * @param {object} handoff
 * @param {{ completedAt?: string }} [opts]
 */
export function buildBudRecord(handoff, opts = {}) {
  const runId = String(handoff?.run_id || '').trim();
  const pluginId = String(handoff?.plugin_id || '').trim();
  const isDocument = pluginId === 'lexiom13.document_builder';
  const entry = primaryArtifactForPlugin(pluginId);
  const record = {
    schema_version: BUD_SCHEMA_VERSION,
    run_id: runId,
    plugin_id: pluginId,
    media_kind: isDocument ? 'document' : 'software',
    entry_file_name: entry,
    status: 'ready',
    completed_at: opts.completedAt || new Date().toISOString()
  };
  if (isDocument) {
    record.artifact_path = `/lexiom13/build/${encodeURIComponent(runId)}/artifact/${entry}`;
    record.preview_path = null;
  } else {
    record.preview_path = `/lexiom13/preview/${encodeURIComponent(runId)}/`;
    record.artifact_path = `/lexiom13/preview/${encodeURIComponent(runId)}/${entry}`;
  }
  return record;
}

/**
 * Evidence collection is "readable" when there is no plan, an empty plan, or a
 * present EVIDENCE_MANIFEST.json (coverage already gated before completed).
 */
export async function isEvidenceCollectionReadable(outputDirectory) {
  const outDir = String(outputDirectory || '');
  if (!outDir) return false;
  try {
    const plan = await loadEvidencePlanFromBuildDir(outDir);
    const targets = Array.isArray(plan?.targets) ? plan.targets : [];
    if (targets.length === 0) return true;
  } catch {
    // Missing plan: treat as readable only if no plan file was expected.
    try {
      await fsp.access(path.join(outDir, EVIDENCE_PLAN_FILENAME));
      return false;
    } catch {
      return true;
    }
  }
  try {
    await fsp.access(path.join(outDir, EVIDENCE_MANIFEST_FILENAME));
    return true;
  } catch {
    return false;
  }
}

/**
 * Write/replace `bud` on the live requesting OSN YAML.
 * @param {string} staticRoot
 * @param {string} osnId
 * @param {object} bud
 */
export async function persistBudOnRequestingOsn(staticRoot, osnId, bud) {
  const id = String(osnId || '').trim();
  if (!id) {
    return { ok: false, reason: 'bud_osn_missing', detail: 'compilation_root_osn_id required' };
  }
  if (!bud || typeof bud !== 'object') {
    return { ok: false, reason: 'bud_invalid', detail: 'bud record required' };
  }

  const index = await loadOsnGraphIndex(staticRoot);
  const entry = index.get(id);
  if (!entry) {
    return {
      ok: false,
      reason: 'bud_osn_not_found',
      detail: `Requesting OSN not found on disk: ${id}`
    };
  }

  const next = stripRuntimeOsnFields(entry.parsed) || { ...entry.parsed };
  next.bud = {
    schema_version: bud.schema_version || BUD_SCHEMA_VERSION,
    run_id: bud.run_id,
    plugin_id: bud.plugin_id,
    media_kind: bud.media_kind,
    entry_file_name: bud.entry_file_name,
    preview_path: bud.preview_path ?? null,
    artifact_path: bud.artifact_path ?? null,
    status: bud.status || 'ready',
    completed_at: bud.completed_at || new Date().toISOString()
  };

  await fsp.writeFile(entry.filePath, serializeLexiom13OsnYaml(next), 'utf8');

  return {
    ok: true,
    osn_id: id,
    source_path: entry.relativePath
      ? `/gt2/Lexiom_1_3/${String(entry.relativePath).split(path.sep).join('/')}`
      : null,
    bud: next.bud
  };
}

/**
 * Full Phase B write after a successful completed run.
 * @param {{
 *   staticRoot: string,
 *   handoff: object,
 *   completedAt?: string
 * }} args
 */
export async function writeBudAfterSuccessfulRun(args) {
  const handoff = args.handoff;
  const staticRoot = args.staticRoot;
  if (!handoff || !staticRoot) {
    return { ok: false, reason: 'bud_context_missing', detail: 'staticRoot and handoff required' };
  }

  const primary = primaryArtifactForPlugin(handoff.plugin_id);
  try {
    const content = await fsp.readFile(path.join(handoff.output_directory, primary), 'utf8');
    if (!String(content).trim()) {
      return { ok: false, reason: 'bud_primary_empty', detail: `Primary empty: ${primary}` };
    }
  } catch {
    return {
      ok: false,
      reason: 'bud_primary_missing',
      detail: `Primary missing for bud: ${primary}`
    };
  }

  if (!(await isEvidenceCollectionReadable(handoff.output_directory))) {
    return {
      ok: false,
      reason: 'bud_evidence_unreadable',
      detail: 'Evidence collection not readable; refusing to write bud'
    };
  }

  const bud = buildBudRecord(handoff, { completedAt: args.completedAt });
  return persistBudOnRequestingOsn(staticRoot, handoff.compilation_root_osn_id, bud);
}
