/**
 * Lexiom 1.3 — evidence collection hemisphere (prepare + host validation).
 * Lean plan + sibling EVIDENCE_AGENT_PROMPT.md; no OSN body echo.
 * Specs: public/gt2/Lexiom_1_3/BuildPlugins/Lexiom_1_3_Build_Plugin_Contract_1_0.md
 */

import { promises as fsp } from 'fs';
import path from 'path';

export const EVIDENCE_COLLECTION_SCHEMA = 'lexiom13-evidence-collection/1';
export const EVIDENCE_MANIFEST_SCHEMA = 'lexiom13-evidence-manifest/1';
export const EVIDENCE_PLAN_FILENAME = 'EVIDENCE_PLAN.json';
export const EVIDENCE_MANIFEST_FILENAME = 'EVIDENCE_MANIFEST.json';
export const EVIDENCE_AGENT_PROMPT_FILENAME = 'EVIDENCE_AGENT_PROMPT.md';
export const EVIDENCE_ARTIFACTS_DIR = 'evidences';
export const EVIDENCE_COLLECTION_VERSION = 'v1';

/** Statuses that satisfy Contract §8.8 coverage without requiring a collected file. */
export const EVIDENCE_NON_COLLECTED_STATUSES = Object.freeze([
  'deferred',
  'failed',
  'not_applicable'
]);

const PRIMARY_ARTIFACT_ALLOWLIST = new Set(['document.md', 'index.html']);

/** Align with Lexiom_1.3.3_System_Description.md §4.4 enumerators. */
export const SUPPORTED_DIRECT_EVIDENCE_KINDS = [
  'TEXTUAL_SNIPPET',
  'SCREEN-SHOT',
  'VIDEO-CLIP'
];

const LEGACY_DIRECT_KIND_ALIASES = {
  direct_code_snippet: 'TEXTUAL_SNIPPET',
  direct_document_review: 'TEXTUAL_SNIPPET',
  screenshot: 'SCREEN-SHOT',
  video_clip: 'VIDEO-CLIP',
  textual_snippet: 'TEXTUAL_SNIPPET',
  'screen-shot': 'SCREEN-SHOT',
  'video-clip': 'VIDEO-CLIP'
};

const KIND_EXTENSION_MAP = {
  TEXTUAL_SNIPPET: 'md',
  'SCREEN-SHOT': 'png',
  'VIDEO-CLIP': 'webm',
  markdown_brief: 'md',
  screenshot: 'png',
  video_clip: 'webm',
  direct_code_snippet: 'js',
  direct_document_review: 'md'
};

export function canonicalizeEvidenceKind(kind) {
  const raw = String(kind || '').trim();
  if (!raw) {
    return '';
  }
  if (SUPPORTED_DIRECT_EVIDENCE_KINDS.includes(raw)) {
    return raw;
  }
  const lower = raw.toLowerCase();
  if (LEGACY_DIRECT_KIND_ALIASES[lower]) {
    return LEGACY_DIRECT_KIND_ALIASES[lower];
  }
  if (LEGACY_DIRECT_KIND_ALIASES[raw]) {
    return LEGACY_DIRECT_KIND_ALIASES[raw];
  }
  return raw;
}

export function isSupportedDirectEvidenceKind(kind) {
  return SUPPORTED_DIRECT_EVIDENCE_KINDS.includes(canonicalizeEvidenceKind(kind));
}

export function extensionForEvidenceKind(kind) {
  const canonical = canonicalizeEvidenceKind(kind);
  if (KIND_EXTENSION_MAP[canonical]) {
    return KIND_EXTENSION_MAP[canonical];
  }
  const raw = String(kind || '').trim();
  if (KIND_EXTENSION_MAP[raw]) {
    return KIND_EXTENSION_MAP[raw];
  }
  return KIND_EXTENSION_MAP[raw.toLowerCase()] || 'txt';
}

function toPosix(p) {
  return String(p || '').split(path.sep).join('/');
}

export function evidenceTargetId(osnId, evidenceId) {
  return `${osnId}::${evidenceId}`;
}

export function buildEvidenceExpectedRelativePath(osnFileName, evidenceId, kind) {
  const fileName = String(osnFileName || '').trim();
  const id = String(evidenceId || '').trim();
  const ext = extensionForEvidenceKind(kind);
  return toPosix(
    path.join(
      EVIDENCE_ARTIFACTS_DIR,
      `${fileName}.${id}.${EVIDENCE_COLLECTION_VERSION}.${ext}`
    )
  );
}

/**
 * Build a pointer-only evidence plan from closure OSNs.
 * Does not copy inspection_prompt, seed, or output_spec into the plan.
 */
export function buildEvidenceCollectionPlan({
  runId,
  pluginId,
  subgraphOsns,
  snapshotById
}) {
  const seenTargetIds = new Set();
  const targets = [];

  for (const osn of subgraphOsns || []) {
    if (!osn || !osn.id) {
      continue;
    }
    const osnFileName = String(osn.file_name || osn.id).trim();
    const snap = snapshotById && snapshotById.get(osn.id);
    const snapshotPath = snap && snap.snapshot_path ? toPosix(snap.snapshot_path) : null;
    const evidences = Array.isArray(osn.success_evidences) ? osn.success_evidences : [];

    for (const ev of evidences) {
      if (!ev || typeof ev !== 'object') {
        continue;
      }
      const evidenceId = String(ev.evidence_id || '').trim();
      if (!evidenceId) {
        const err = new Error(`OSN ${osn.id} has a success_evidence entry without evidence_id`);
        err.statusCode = 400;
        throw err;
      }
      const targetId = evidenceTargetId(osn.id, evidenceId);
      if (seenTargetIds.has(targetId)) {
        const err = new Error(`Duplicate evidence target in closure: ${targetId}`);
        err.statusCode = 400;
        throw err;
      }
      seenTargetIds.add(targetId);

      const kind = String(ev.kind || '').trim() || 'txt';
      const preferredExtension = `.${extensionForEvidenceKind(kind)}`;
      targets.push({
        target_id: targetId,
        osn_id: osn.id,
        osn_file_name: osnFileName,
        snapshot_path: snapshotPath,
        evidence_id: evidenceId,
        kind: canonicalizeEvidenceKind(kind) || kind,
        direct: ev.direct === true,
        expected_relative_path: buildEvidenceExpectedRelativePath(
          osnFileName,
          evidenceId,
          kind
        ),
        preferred_extension: preferredExtension
      });
    }
  }

  const direct = targets.filter((t) => t.direct).length;
  const firstSnapshotPath = targets.find((target) => target.snapshot_path)?.snapshot_path || '';
  const instructionDir = firstSnapshotPath.startsWith('nodes/') ? 'nodes' : 'osng';
  return {
    schema_version: EVIDENCE_COLLECTION_SCHEMA,
    run_id: runId,
    plugin_id: pluginId || null,
    artifacts_directory: EVIDENCE_ARTIFACTS_DIR,
    plan_path: EVIDENCE_PLAN_FILENAME,
    manifest_path: EVIDENCE_MANIFEST_FILENAME,
    evidence_agent_prompt_path: EVIDENCE_AGENT_PROMPT_FILENAME,
    instruction_dir: instructionDir,
    targets,
    summary: {
      total: targets.length,
      direct,
      derivative: targets.length - direct,
      osns_with_targets: new Set(targets.map((t) => t.osn_id)).size
    }
  };
}

export function slimEvidenceTargetsFromPlan(plan) {
  return (plan && Array.isArray(plan.targets) ? plan.targets : []).map((t) => ({
    osn_id: t.osn_id,
    evidence_id: t.evidence_id,
    direct: t.direct === true,
    kind: t.kind,
    expected_relative_path: t.expected_relative_path
  }));
}

/**
 * Lean sibling prompt: protocol + paths only. Agents open immutable prepared nodes for content.
 */
export function buildEvidenceAgentPromptText(handoff, plan) {
  const outDir = toPosix(handoff.output_directory || '.');
  const instructionDir =
    handoff.nodes_dir || handoff.osng_dir || plan?.instruction_dir || 'osng';
  const usesPreparedJson = instructionDir === 'nodes';
  const basicsRel = handoff.osng_basics_path || 'OSNG_Basics_README.md';
  const pluginId = handoff.plugin_id || 'unknown';
  const summary = (plan && plan.summary) || { total: 0, direct: 0, derivative: 0 };
  const isDocument = pluginId === 'lexiom13.document_builder';

  const lines = [];
  lines.push('# Lexiom evidence-collection agent');
  lines.push('');
  lines.push('## Project setup (CA / Real Bolt)');
  lines.push(`- Workspace root (cwd): \`${outDir}\` — already synced into the CA WebContainer.`);
  lines.push(
    `- Frozen instruction snapshot (read-only): \`./${instructionDir}/\` (${usesPreparedJson ? 'normalized JSON nodes' : 'OSN YAML'}).`
  );
  lines.push(`- OSNG primer: \`./${basicsRel}\``);
  lines.push(`- Evidence index (pointers only): \`./${EVIDENCE_PLAN_FILENAME}\``);
  lines.push('- Optional audit: `./HANDOFF.json` (run_id / plugin_id / membership).');
  lines.push(
    '- Primary deliverables from the builder pass live at this project root — inspect them; do **not** rewrite them.'
  );
  lines.push(
    '- Tools: `list_files`, `read_file`, `write_file`, and explicit `finish`. No `run_command` in this pass.'
  );
  lines.push('');
  lines.push('## Role and privileges');
  lines.push('- You are an **evidence collector** for this build run — not an OSN editor and not a second product author.');
  lines.push(
    `- Read prepared OSN semantics only under \`./${instructionDir}/\` (do **not** modify \`./${instructionDir}/\`).`
  );
  lines.push(
    `- Write only under \`./${EVIDENCE_ARTIFACTS_DIR}/\` and \`./${EVIDENCE_MANIFEST_FILENAME}\` (optional short evidence notes may be appended in \`BUILD_REPORT.md\`).`
  );
  lines.push('- Do not invent OSN content; open the immutable snapshot files named in the plan.');
  lines.push('');
  lines.push('## Scope');
  lines.push(`- plugin_id: ${pluginId}`);
  lines.push(
    `- Targets in plan: ${summary.total} (direct: ${summary.direct}, derivative: ${summary.derivative})`
  );
  lines.push(
    `- Process **every** entry in \`./${EVIDENCE_PLAN_FILENAME}\` → \`targets[]\` independently (direct and derivative).`
  );
  lines.push('');
  lines.push('## How to learn each target (authoritative — do not skip)');
  lines.push(`1. Open \`./${EVIDENCE_PLAN_FILENAME}\` and take the next \`targets[]\` row.`);
  lines.push(
    '2. Open that row\'s `snapshot_path` under this project. Find the matching `success_evidences` entry by `evidence_id`.'
  );
  lines.push(
    '3. Read `kind`, `direct`, and `inspection_prompt` **from that immutable node entry** — do not rely on this prompt for those fields (they are intentionally not copied here).'
  );
  lines.push(
    '4. Write the artifact to exactly `expected_relative_path` from the plan (or record `failed` / `deferred` in the manifest if you cannot).'
  );
  lines.push(
    `5. Filename association: \`{osn.file_name}.{evidence_id}.${EVIDENCE_COLLECTION_VERSION}.{ext}\` under \`./${EVIDENCE_ARTIFACTS_DIR}/\` — recoverable from the name alone (see \`./${basicsRel}\`).`
  );
  lines.push('');
  lines.push('## Status vocabulary (manifest)');
  lines.push('- `collected` — file exists at the expected path (or an allowed primary-artifact reference is recorded); **not** owner approval.');
  lines.push('- `deferred` — cannot collect now; include concrete human-capture / follow-up notes.');
  lines.push('- `failed` — attempted but did not produce a usable artifact.');
  lines.push('- `not_applicable` — only when the delivered SUD truly cannot host this inspection (explain why).');
  lines.push('');
  lines.push('## Hard bans');
  lines.push('- Do not fabricate screenshots, videos, metrics, or passing test results.');
  lines.push('- Do not use OSN specification text (seed, lenses, output_spec, evidence definitions) as **direct** evidence.');
  lines.push('- Do not claim human approval or mutate canonical Lexiom state outside this build directory.');
  lines.push('- Do not paste or paraphrase OSN bodies into the manifest; point at paths and statuses.');
  lines.push('- Do not rewrite primary deliverables (`document.md`, `index.html`, or the software tree).');
  lines.push('');
  lines.push('## Plugin-specific capture hints');
  if (isDocument) {
    lines.push(
      '- Document builder: for each `TEXTUAL_SNIPPET`, write a thin excerpt markdown at `expected_relative_path` quoting the delivered `document.md` (verbatim contiguous passage). Also list `document.md` in `source_artifact_paths` when that file is the SUD outcome.'
    );
    lines.push(
      '- Derivative briefs (e.g. markdown_brief): write under `./evidences/` only when the plan requests them; derive from the delivered document + OSNG, not from inventing claims.'
    );
    lines.push(
      '- `SCREEN-SHOT` / `VIDEO-CLIP`: mark `deferred` with a concrete human-capture procedure — do not invent media files.'
    );
  } else {
    lines.push(
      '- Software builder: prefer excerpts from the delivered tree for `TEXTUAL_SNIPPET`; write them under `./evidences/` at `expected_relative_path`.'
    );
    lines.push(
      '- If automated capture is unavailable, mark `SCREEN-SHOT` / `VIDEO-CLIP` targets `deferred` with a concrete human-capture procedure — do not invent media files.'
    );
    lines.push(
      '- Derivative briefs: write under `./evidences/` from delivered behavior + OSNG; never substitute them for missing direct evidence.'
    );
  }
  lines.push('');
  lines.push('## Required output');
  lines.push(
    `- Write \`./${EVIDENCE_MANIFEST_FILENAME}\` with schema \`${EVIDENCE_MANIFEST_SCHEMA}\` covering **every** \`target_id\` from the plan.`
  );
  lines.push('- Top-level shape:');
  lines.push('  `{ "schema_version", "run_id", "collected_at" (ISO), "entries": [ ... ] }`');
  lines.push(
    '- Each `entries[]` row: `target_id`, `osn_id`, `evidence_id`, `direct`, `kind`, `status`,'
  );
  lines.push(
    '  `artifact_paths` (relative to project root), `source_artifact_paths` (optional), `notes`, `collected_by: "agent"`.'
  );
  lines.push(
    `- Call \`finish\` only after \`./${EVIDENCE_MANIFEST_FILENAME}\` exists and covers every plan target.`
  );
  lines.push('');

  return lines.join('\n');
}

/**
 * Host gate after evidence-pass syncOut (Contract §8.8).
 * @param {string} stageOrCanonicalDir — staged dir preferred; falls back to canonical for plan
 * @param {{ canonicalDir?: string|null }} [opts]
 */
export async function validateEvidenceManifestAfterSync(stageOrCanonicalDir, opts = {}) {
  const stageDir = path.resolve(stageOrCanonicalDir);
  const canonicalDir = path.resolve(opts.canonicalDir || stageDir);

  let plan;
  try {
    plan = JSON.parse(
      await fsp.readFile(path.join(canonicalDir, EVIDENCE_PLAN_FILENAME), 'utf8')
    );
  } catch {
    return {
      ok: false,
      reason: 'evidence_plan_missing',
      detail: `${EVIDENCE_PLAN_FILENAME} missing from build directory`
    };
  }

  const planTargets = Array.isArray(plan.targets) ? plan.targets : [];
  if (planTargets.length === 0) {
    return { ok: true, reason: null, detail: null, summary: { total: 0, covered: 0 } };
  }

  let manifestRaw;
  try {
    manifestRaw = await fsp.readFile(path.join(stageDir, EVIDENCE_MANIFEST_FILENAME), 'utf8');
  } catch {
    try {
      manifestRaw = await fsp.readFile(
        path.join(canonicalDir, EVIDENCE_MANIFEST_FILENAME),
        'utf8'
      );
    } catch {
      return {
        ok: false,
        reason: 'evidence_manifest_missing',
        detail: `${EVIDENCE_MANIFEST_FILENAME} missing after evidence pass`
      };
    }
  }

  let manifest;
  try {
    manifest = JSON.parse(manifestRaw);
  } catch {
    return {
      ok: false,
      reason: 'evidence_manifest_invalid',
      detail: `${EVIDENCE_MANIFEST_FILENAME} is not valid JSON`
    };
  }

  const entries = Array.isArray(manifest.entries) ? manifest.entries : null;
  if (!entries) {
    return {
      ok: false,
      reason: 'evidence_manifest_invalid',
      detail: `${EVIDENCE_MANIFEST_FILENAME} must include an entries[] array`
    };
  }

  /** @type {Map<string, object>} */
  const byTarget = new Map();
  for (const entry of entries) {
    if (!entry || !entry.target_id) continue;
    byTarget.set(String(entry.target_id), entry);
  }

  const missing = [];
  const collectedBad = [];
  for (const target of planTargets) {
    const targetId = String(target.target_id || '');
    const entry = byTarget.get(targetId);
    if (!entry) {
      missing.push(targetId);
      continue;
    }
    const status = String(entry.status || '').trim();
    if (status === 'collected') {
      const paths = [];
      if (Array.isArray(entry.artifact_paths)) {
        for (const p of entry.artifact_paths) {
          if (p) paths.push(toPosix(p));
        }
      }
      if (target.expected_relative_path) {
        paths.push(toPosix(target.expected_relative_path));
      }
      if (Array.isArray(entry.source_artifact_paths)) {
        for (const p of entry.source_artifact_paths) {
          const rel = toPosix(p);
          const base = path.posix.basename(rel);
          if (PRIMARY_ARTIFACT_ALLOWLIST.has(base) && !rel.includes('/')) {
            paths.push(rel);
          }
        }
      }
      let found = false;
      for (const rel of paths) {
        if (await fileExistsReadable(stageDir, rel)) {
          found = true;
          break;
        }
        if (await fileExistsReadable(canonicalDir, rel)) {
          found = true;
          break;
        }
      }
      if (!found) {
        collectedBad.push(targetId);
      }
    } else if (!EVIDENCE_NON_COLLECTED_STATUSES.includes(status)) {
      missing.push(`${targetId} (invalid status: ${status || '(empty)'})`);
    }
  }

  if (missing.length || collectedBad.length) {
    const parts = [];
    if (missing.length) {
      parts.push(`uncovered targets: ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? '…' : ''}`);
    }
    if (collectedBad.length) {
      parts.push(
        `collected without resolvable artifact: ${collectedBad.slice(0, 8).join(', ')}${collectedBad.length > 8 ? '…' : ''}`
      );
    }
    return {
      ok: false,
      reason: 'evidence_coverage_incomplete',
      detail: parts.join('; ')
    };
  }

  return {
    ok: true,
    reason: null,
    detail: null,
    summary: { total: planTargets.length, covered: planTargets.length }
  };
}

async function fileExistsReadable(rootDir, relPosix) {
  try {
    const abs = path.join(path.resolve(rootDir), ...String(relPosix).split('/'));
    const st = await fsp.stat(abs);
    return st.isFile() && st.size > 0;
  } catch {
    return false;
  }
}

export async function writeEvidencePlan(outputDirectory, plan) {
  const abs = path.join(outputDirectory, EVIDENCE_PLAN_FILENAME);
  await fsp.writeFile(abs, JSON.stringify(plan, null, 2), 'utf8');
  return abs;
}

export async function packageEvidenceAgentPrompt(handoff, plan) {
  const outDir = handoff.output_directory;
  const prompt = buildEvidenceAgentPromptText(handoff, plan);
  const promptPath = path.join(outDir, EVIDENCE_AGENT_PROMPT_FILENAME);
  await fsp.writeFile(promptPath, prompt, 'utf8');
  return { promptPath, prompt };
}

/**
 * Load plan from disk when handoff only carries a summary (e.g. re-package).
 */
export async function loadEvidencePlanFromBuildDir(outputDirectory) {
  const abs = path.join(outputDirectory, EVIDENCE_PLAN_FILENAME);
  const raw = await fsp.readFile(abs, 'utf8');
  return JSON.parse(raw);
}
