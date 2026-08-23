/**
 * Lexiom 1.3 build plugins — shared contract runtime.
 * Specs: public/gt2/Lexiom_1_3/BuildPlugins/
 */

import { promises as fsp } from 'fs';
import path from 'path';
import crypto from 'crypto';
import yaml from 'js-yaml';
import {
  getLexiom13OsnDir,
  listLexiom13OsnYamlPaths
} from './lexiom13OsnPersist.js';
import {
  EVIDENCE_AGENT_PROMPT_FILENAME,
  EVIDENCE_PLAN_FILENAME,
  EVIDENCE_MANIFEST_FILENAME,
  buildEvidenceCollectionPlan,
  loadEvidencePlanFromBuildDir,
  packageEvidenceAgentPrompt,
  slimEvidenceTargetsFromPlan,
  writeEvidencePlan
} from './lexiom13BuildEvidence.js';
import { collectEvidenceByQuoteSpans } from './lexiom13EvidenceSpanCollect.js';
import { writeBudAfterSuccessfulRun } from './lexiom13BudPersist.js';
import {
  EXECUTOR_ID,
  BUILDER_TIMEOUT_MS,
  CA_LOCATION_BROWSER_SESSION,
  issueCaJobTicket,
  dispatchCaJob,
  readSessionWorkspace,
  readSessionWorkspaceFile,
  writeSessionArtifacts,
  applySessionReport,
  heartbeatSession,
  cancelSession
} from './lexiom13CaDispatcher.js';
import { primaryArtifactForPlugin } from './lexiom13CaPolicy.js';
import { upsertAgentRun, getAgentRun } from './lexiom13AgentRunRegistry.js';
import { getCaSession } from './lexiom13CaSessionRegistry.js';
import {
  BUILD_MANIFEST_FILENAME,
  BUILD_PLAN_FILENAME,
  PHASE_LEDGER_FILENAME,
  PREPARED_NODES_DIR,
  SOURCE_MAP_FILENAME,
  renderDeterministicBuildReport,
  writeDocumentContextPack
} from './lexiom13BuildContextPack.js';
export { getAgentRun, listRecentAgentRuns } from './lexiom13AgentRunRegistry.js';
export {
  readSessionWorkspace,
  readSessionWorkspaceFile,
  writeSessionArtifacts,
  issueCaJobTicket,
  CA_LOCATION_BROWSER_SESSION,
  EXECUTOR_ID
};
export {
  heartbeatSession as heartbeatCaSession,
  cancelSession as cancelCaSession,
  getCaSession
};

export const PLUGIN_IDS = {
  DOCUMENT: 'lexiom13.document_builder',
  SOFTWARE: 'lexiom13.software_coding_builder'
};

export const STRATEGY_IDS = {
  ANCESTOR_FIRST: 'ancestor_first_dfs',
  DESCENDANT_FIRST: 'descendant_first_dfs',
  OUTLINE_THEN_FILL: 'outline_then_fill'
};

const PROFILE_TO_PLUGIN = {
  document_agent: PLUGIN_IDS.DOCUMENT,
  brand_document_agent: PLUGIN_IDS.DOCUMENT,
  software_coding_agent: PLUGIN_IDS.SOFTWARE,
  static_spa_coding_agent: PLUGIN_IDS.SOFTWARE,
  cursor_static_spa_prompt: PLUGIN_IDS.SOFTWARE,
  ux_prompt_for_static_spa: PLUGIN_IDS.SOFTWARE
};

const DEFAULT_STRATEGY_BY_PLUGIN = {
  [PLUGIN_IDS.DOCUMENT]: STRATEGY_IDS.OUTLINE_THEN_FILL,
  [PLUGIN_IDS.SOFTWARE]: STRATEGY_IDS.ANCESTOR_FIRST
};

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function toPosix(p) {
  return String(p || '').split(path.sep).join('/');
}

export function mapTargetToolProfileToPluginId(profile) {
  const key = String(profile || '').trim();
  if (!key) {
    return null;
  }
  return PROFILE_TO_PLUGIN[key] || null;
}

export function defaultStrategyForPlugin(pluginId) {
  return DEFAULT_STRATEGY_BY_PLUGIN[pluginId] || STRATEGY_IDS.ANCESTOR_FIRST;
}

function publicPathToAbsolute(staticRoot, publicPath) {
  const rel = String(publicPath || '').replace(/^\/+/, '');
  return path.join(staticRoot, ...rel.split('/'));
}

async function loadAllOsns(staticRoot) {
  const publicPaths = await listLexiom13OsnYamlPaths(staticRoot);
  const byId = new Map();
  const pathById = new Map();

  for (const publicPath of publicPaths) {
    const abs = publicPathToAbsolute(staticRoot, publicPath);
    const raw = await fsp.readFile(abs, 'utf8');
    const parsed = yaml.load(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.id) {
      continue;
    }
    byId.set(parsed.id, parsed);
    pathById.set(parsed.id, publicPath);
  }

  return { byId, pathById };
}

function collectDescendants(rootId, byId, seen, results) {
  if (!rootId || seen.has(rootId)) {
    return;
  }
  const osn = byId.get(rootId);
  if (!osn) {
    return;
  }
  seen.add(rootId);
  results.push(osn);
  const childIds = Array.isArray(osn.graph && osn.graph.child_osn_ids)
    ? osn.graph.child_osn_ids
    : [];
  for (const childId of childIds) {
    collectDescendants(childId, byId, seen, results);
  }
}

function resolveSubgraphOsns(rootOsn, byId) {
  const scope =
    (rootOsn.compilation && rootOsn.compilation.compilation_scope) || 'self_only';
  const results = [];
  const seen = new Set();

  const standardIds = Array.isArray(rootOsn.graph && rootOsn.graph.standard_ancestor_osn_ids)
    ? rootOsn.graph.standard_ancestor_osn_ids
    : [];

  // Also include primary-parent chain as standard-like context when walking product branches
  // whose organizational standard is the graph root (parent with empty parents).
  const parentIds = Array.isArray(rootOsn.graph && rootOsn.graph.parent_osn_ids)
    ? rootOsn.graph.parent_osn_ids
    : [];
  for (const parentId of parentIds) {
    const parent = byId.get(parentId);
    if (!parent) {
      continue;
    }
    const grand = Array.isArray(parent.graph && parent.graph.parent_osn_ids)
      ? parent.graph.parent_osn_ids
      : [];
    if (grand.length === 0 && !seen.has(parent.id)) {
      seen.add(parent.id);
      results.push(parent);
    }
  }

  for (const stdId of standardIds) {
    const std = byId.get(stdId);
    if (std && !seen.has(std.id)) {
      seen.add(std.id);
      results.push(std);
    }
  }

  if (scope === 'self_and_approved_descendants') {
    collectDescendants(rootOsn.id, byId, seen, results);
    return results;
  }

  if (scope === 'self_plus_parent_context') {
    for (const parentId of parentIds) {
      const parent = byId.get(parentId);
      if (parent && !seen.has(parent.id)) {
        seen.add(parent.id);
        results.push(parent);
      }
    }
    if (!seen.has(rootOsn.id)) {
      seen.add(rootOsn.id);
      results.push(rootOsn);
    }
    return results;
  }

  if (!seen.has(rootOsn.id)) {
    results.push(rootOsn);
  }
  return results;
}

function walkAncestorFirst(rootId, byId, includedIds) {
  const order = [];
  const visited = new Set();

  function visit(id) {
    if (!id || visited.has(id) || !includedIds.has(id)) {
      return;
    }
    visited.add(id);
    order.push(id);
    const osn = byId.get(id);
    const childIds = Array.isArray(osn && osn.graph && osn.graph.child_osn_ids)
      ? osn.graph.child_osn_ids
      : [];
    for (const childId of childIds) {
      visit(childId);
    }
  }

  // Standards (no parents in included set, or listed before root) first by included order
  for (const id of includedIds) {
    const osn = byId.get(id);
    const parents = Array.isArray(osn && osn.graph && osn.graph.parent_osn_ids)
      ? osn.graph.parent_osn_ids
      : [];
    const hasIncludedParent = parents.some((p) => includedIds.has(p));
    if (!hasIncludedParent && id !== rootId) {
      visit(id);
    }
  }
  visit(rootId);
  for (const id of includedIds) {
    visit(id);
  }
  return order;
}

function walkDescendantFirst(rootId, byId, includedIds) {
  const order = [];
  const visited = new Set();

  function visit(id) {
    if (!id || visited.has(id) || !includedIds.has(id)) {
      return;
    }
    visited.add(id);
    const osn = byId.get(id);
    const childIds = Array.isArray(osn && osn.graph && osn.graph.child_osn_ids)
      ? osn.graph.child_osn_ids
      : [];
    for (const childId of childIds) {
      visit(childId);
    }
    order.push(id);
  }

  visit(rootId);
  for (const id of includedIds) {
    if (!visited.has(id)) {
      visit(id);
    }
  }
  return order;
}

function buildWalkPlan(strategyId, rootId, byId, includedIds) {
  if (strategyId === STRATEGY_IDS.DESCENDANT_FIRST) {
    return {
      strategy_id: strategyId,
      passes: [{ pass: 1, name: 'post_order', osn_ids: walkDescendantFirst(rootId, byId, includedIds) }]
    };
  }
  if (strategyId === STRATEGY_IDS.OUTLINE_THEN_FILL) {
    return {
      strategy_id: strategyId,
      passes: [
        {
          pass: 1,
          name: 'outline_ancestor_first',
          osn_ids: walkAncestorFirst(rootId, byId, includedIds)
        },
        {
          pass: 2,
          name: 'fill_descendant_first',
          osn_ids: walkDescendantFirst(rootId, byId, includedIds)
        },
        {
          pass: 3,
          name: 'reconcile_root',
          osn_ids: [rootId]
        }
      ]
    };
  }
  return {
    strategy_id: STRATEGY_IDS.ANCESTOR_FIRST,
    passes: [{ pass: 1, name: 'pre_order', osn_ids: walkAncestorFirst(rootId, byId, includedIds) }]
  };
}

function sectionStatus(osn, key) {
  const value = osn[key];
  const hasContent =
    key === 'thematic_lenses' || key === 'success_evidences'
      ? Array.isArray(value) && value.length > 0
      : String(value || '').trim().length > 0;
  // Canonical YAML on disk is treated as approved for build purposes
  return { key, hasContent, approved: hasContent };
}

function summarizeOsnForHandoff(osn, publicPath) {
  const sections = ['seed', 'thematic_lenses', 'output_spec', 'success_evidences'].map((key) =>
    sectionStatus(osn, key)
  );
  return {
    id: osn.id,
    file_name: osn.file_name || osn.id,
    title: osn.title || null,
    node_type: osn.node_type || null,
    discipline: osn.discipline || null,
    public_path: publicPath || null,
    sections,
    success_evidence_ids: (Array.isArray(osn.success_evidences) ? osn.success_evidences : [])
      .map((ev) => ev && ev.evidence_id)
      .filter(Boolean),
    compilation: osn.compilation || null
  };
}

function getBuildsRoot(repoRoot) {
  return path.join(repoRoot, 'builds', 'lexiom13');
}

/** Strip /gt2/Lexiom_1_3/ prefix from a public OSN path → relative under snapshot osng/. */
function publicPathToOsngRelative(publicPath) {
  const cleaned = String(publicPath || '')
    .replace(/^\/+/, '')
    .replace(/^gt2\/Lexiom_1_3\//i, '');
  return cleaned || null;
}

function publicPathToAbsoluteUnderStatic(staticRoot, publicPath) {
  const cleaned = String(publicPath || '').replace(/^\/+/, '');
  return path.join(staticRoot, ...cleaned.split('/'));
}

/**
 * Copy the compilation-closure OSNs (+ OSNG_Basics README) into the build
 * directory so the folder can be opened as a standalone Cursor project.
 */
async function snapshotOsngIntoBuildDir(staticRoot, outputDirectory, subgraphOsns, pathById) {
  const osngDir = path.join(outputDirectory, 'osng');
  await fsp.mkdir(osngDir, { recursive: true });

  const copied = [];
  for (const osn of subgraphOsns) {
    const publicPath = pathById.get(osn.id);
    if (!publicPath) {
      continue;
    }
    const relUnderOsng = publicPathToOsngRelative(publicPath);
    if (!relUnderOsng) {
      continue;
    }
    const srcAbs = publicPathToAbsoluteUnderStatic(staticRoot, publicPath);
    const destAbs = path.join(osngDir, ...relUnderOsng.split('/'));
    await fsp.mkdir(path.dirname(destAbs), { recursive: true });
    await fsp.copyFile(srcAbs, destAbs);
    copied.push({
      id: osn.id,
      snapshot_path: toPosix(path.join('osng', relUnderOsng)),
      source_public_path: publicPath
    });
  }

  const basicsSrc = path.join(getLexiom13OsnDir(staticRoot), 'OSNG_Basics_README.md');
  const basicsDest = path.join(outputDirectory, 'OSNG_Basics_README.md');
  try {
    await fsp.copyFile(basicsSrc, basicsDest);
  } catch (error) {
    if (!(error && error.code === 'ENOENT')) {
      throw error;
    }
  }

  return {
    osng_dir: 'osng',
    osng_basics_path: 'OSNG_Basics_README.md',
    copied
  };
}

async function copyOsngBasicsIntoBuildDir(staticRoot, outputDirectory) {
  const basicsSrc = path.join(getLexiom13OsnDir(staticRoot), 'OSNG_Basics_README.md');
  const basicsDest = path.join(outputDirectory, 'OSNG_Basics_README.md');
  try {
    await fsp.copyFile(basicsSrc, basicsDest);
  } catch (error) {
    if (!(error && error.code === 'ENOENT')) {
      throw error;
    }
  }
  return 'OSNG_Basics_README.md';
}

export async function prepareLexiom13Build(staticRoot, repoRoot, body = {}) {
  const compilationRootOsnId = String(body.compilation_root_osn_id || '').trim();
  if (!compilationRootOsnId) {
    throw httpError(400, 'compilation_root_osn_id is required');
  }

  const { byId, pathById } = await loadAllOsns(staticRoot);
  const rootOsn = byId.get(compilationRootOsnId);
  if (!rootOsn) {
    throw httpError(404, `OSN not found: ${compilationRootOsnId}`);
  }

  if (!(rootOsn.compilation && rootOsn.compilation.can_be_compilation_root)) {
    throw httpError(400, `OSN is not a compilation root: ${compilationRootOsnId}`);
  }

  const profile = rootOsn.compilation && rootOsn.compilation.target_tool_profile;
  const pluginId = mapTargetToolProfileToPluginId(profile);
  if (!pluginId) {
    throw httpError(
      400,
      `No build plugin associated for target_tool_profile: ${profile || 'null'}`
    );
  }

  const strategyId = String(body.strategy_id || '').trim() || defaultStrategyForPlugin(pluginId);
  if (!Object.values(STRATEGY_IDS).includes(strategyId)) {
    throw httpError(400, `Unknown strategy_id: ${strategyId}`);
  }

  const subgraphOsns = resolveSubgraphOsns(rootOsn, byId);
  const includedIds = new Set(subgraphOsns.map((o) => o.id));
  const walkPlan = buildWalkPlan(strategyId, rootOsn.id, byId, includedIds);

  const runId =
    String(body.run_id || '').trim() ||
    `${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
  if (!/^[a-zA-Z0-9_-]+$/.test(runId)) {
    throw httpError(400, 'Invalid run_id');
  }

  const outputDirectory = path.join(getBuildsRoot(repoRoot), runId);
  await fsp.mkdir(outputDirectory, { recursive: true });

  let contextPack = null;
  let snapshot;
  if (pluginId === PLUGIN_IDS.DOCUMENT) {
    contextPack = await writeDocumentContextPack({
      staticRoot,
      outputDirectory,
      rootOsn,
      subgraphOsns,
      byId,
      pathById,
      walkPlan,
      strategyId,
      pluginId,
      runId
    });
    const basicsPath = await copyOsngBasicsIntoBuildDir(staticRoot, outputDirectory);
    snapshot = {
      format: 'normalized_json_nodes',
      nodes_dir: contextPack.nodes_dir,
      osng_dir: null,
      osng_basics_path: basicsPath,
      copied: [...contextPack.snapshotById.values()]
    };
  } else {
    snapshot = await snapshotOsngIntoBuildDir(
      staticRoot,
      outputDirectory,
      subgraphOsns,
      pathById
    );
    snapshot.format = 'osn_yaml';
  }
  const snapshotById = new Map(snapshot.copied.map((c) => [c.id, c]));

  const subgraph = subgraphOsns.map((osn) => {
    const summary = summarizeOsnForHandoff(osn, pathById.get(osn.id) || null);
    const snap = snapshotById.get(osn.id);
    if (snap) {
      summary.snapshot_path = snap.snapshot_path;
    }
    return summary;
  });

  const evidencePlan = buildEvidenceCollectionPlan({
    runId,
    pluginId,
    subgraphOsns,
    snapshotById
  });
  await writeEvidencePlan(outputDirectory, evidencePlan);

  const handoff = {
    status: 'prepared',
    run_id: runId,
    plugin_id: pluginId,
    strategy_id: strategyId,
    compilation_root_osn_id: rootOsn.id,
    target_tool_profile: profile || null,
    compilation_scope: (rootOsn.compilation && rootOsn.compilation.compilation_scope) || 'self_only',
    output_directory: outputDirectory,
    output_directory_posix: toPosix(outputDirectory),
    snapshot_mode: true,
    snapshot_format: snapshot.format,
    osng_dir: snapshot.osng_dir,
    nodes_dir: snapshot.nodes_dir || null,
    osng_basics_path: snapshot.osng_basics_path,
    instruction_read_roots: [snapshot.nodes_dir || snapshot.osng_dir],
    osng_read_roots: snapshot.osng_dir ? [snapshot.osng_dir] : [],
    subgraph,
    walk_plan: walkPlan,
    context_economy: contextPack
      ? {
          mode: 'prepared_nodes',
          nodes_dir: contextPack.nodes_dir,
          node_count: contextPack.node_files.length,
          build_plan_path: contextPack.build_plan_path,
          source_map_path: contextPack.source_map_path,
          sources_dir: contextPack.sources_dir,
          capsule_count: contextPack.capsule_count,
          cluster_count: contextPack.cluster_count,
          source_count: contextPack.source_count
        }
      : null,
    success_evidence_targets: slimEvidenceTargetsFromPlan(evidencePlan),
    evidence_collection: {
      schema_version: evidencePlan.schema_version,
      plan_path: evidencePlan.plan_path,
      manifest_path: evidencePlan.manifest_path,
      evidence_agent_prompt_path: evidencePlan.evidence_agent_prompt_path,
      artifacts_directory: evidencePlan.artifacts_directory,
      summary: evidencePlan.summary
    },
    prepared_at: new Date().toISOString()
  };

  await fsp.writeFile(
    path.join(outputDirectory, 'HANDOFF.json'),
    JSON.stringify(handoff, null, 2),
    'utf8'
  );

  // Package lean builder + evidence prompts at prepare so the folder is
  // reviewable for manual Cursor experiments even before / without agent launch.
  await packagePromptForHandoff(staticRoot, handoff, repoRoot);

  return handoff;
}

function resolveSnapshotPath(handoff, osnId) {
  const node = (handoff.subgraph || []).find((n) => n.id === osnId);
  if (node && node.snapshot_path) {
    return toPosix(node.snapshot_path);
  }
  return null;
}

function strategyWalkInstructions(strategyId) {
  if (strategyId === STRATEGY_IDS.DESCENDANT_FIRST) {
    return [
      '- Walk **post-order (descendant-first)**: for each node, fully process `graph.child_osn_ids` (in listed order) before extracting/emitting that node’s contribution.',
      '- After the descendant closure is done, synthesize Root (and Standard ancestors if in scope).'
    ];
  }
  if (strategyId === STRATEGY_IDS.OUTLINE_THEN_FILL) {
    return [
      '- **Pass 1 (outline, ancestor-first):** walk Root then `graph.child_osn_ids` pre-order; write OUTLINE.md / FILE_PLAN.md only (titles + owning OSN ids) — no full body yet.',
      '- **Pass 2 (fill, descendant-first):** walk children before parents within each chapter/module; fill artifact bodies from leaf `output_spec` text.',
      '- **Pass 3 (reconcile):** re-open Root (+ Standard if in scope); fix global consistency against success evidences.'
    ];
  }
  return [
    '- Walk **pre-order (ancestor-first):** visit the current node, then recurse each `graph.child_osn_ids` entry in listed order.',
    '- Open Standard / primary-parent ancestors in scope before deep leaf work when the strategy reaches them via `graph.parent_osn_ids` / `standard_ancestor_osn_ids`.'
  ];
}

/**
 * Shared location-neutral traversal protocol; OSNs live under ./osng/.
 */
function buildTraversalProtocolPrompt(handoff, repoRoot, options) {
  const osngDir = handoff.osng_dir || 'osng';
  const basicsRel = handoff.osng_basics_path || 'OSNG_Basics_README.md';
  const rootId = handoff.compilation_root_osn_id;
  const rootRel =
    resolveSnapshotPath(handoff, rootId) ||
    `${osngDir}/(resolve ${rootId}.yaml via file_name)`;
  const subgraphCount = Array.isArray(handoff.subgraph) ? handoff.subgraph.length : 0;

  const lines = [];
  lines.push(`# Lexiom ${options.title}`);
  lines.push('');
  lines.push('## Prepared workspace');
  lines.push('- The CA mounts this prepared build directory as its workspace root.');
  lines.push(`- Frozen OSNG snapshot for this run: \`./${osngDir}/\` (${subgraphCount} OSN files).`);
  lines.push(`- OSNG primer (copied): \`./${basicsRel}\``);
  lines.push('- Optional Lexiom audit index: `./HANDOFF.json` (membership / strategy metadata).');
  lines.push('');
  lines.push('## Role and privileges');
  lines.push(`- ${options.roleLine}`);
  lines.push(`- Read OSN YAML only under \`./${osngDir}/\` (read-only snapshot). Do **not** modify files under \`./${osngDir}/\`.`);
  lines.push('- Write deliverables at this project root (e.g. document.md, index.html, BUILD_REPORT.md, OUTLINE.md / FILE_PLAN.md) — not into `./osng/`.');
  lines.push('- Do not reach outside this project for OSN sources; the snapshot is the closed universe for this build.');
  lines.push(
    `- **Evidence collection is out of scope for this file.** After primary deliverables exist, use the sibling \`${EVIDENCE_AGENT_PROMPT_FILENAME}\` (index: \`./${EVIDENCE_PLAN_FILENAME}\`).`
  );
  lines.push('');
  lines.push('## How to learn OSN structure (authoritative — do not skip)');
  lines.push(
    '- Open the compilation-root `*.osn.yaml` under `./osng/` and read its leading `#` comment header first. That header is the primary description of OSN fields and `graph.parent_osn_ids` / `graph.child_osn_ids` / `standard_ancestor_osn_ids` linking.'
  );
  lines.push(
    '- Treat that header as future-ready schema documentation: if headers evolve, follow the file you opened — do not invent a parallel schema from this prompt.'
  );
  lines.push(`- For filesystem identity and header/README pairing, also read: \`./${basicsRel}\``);
  lines.push(
    '- When path prefixes and `graph.*` disagree, `graph.*` is authoritative (as stated in the OSN header).'
  );
  lines.push('');
  lines.push('## Compilation root and scope');
  lines.push(`- Compilation root OSN id: ${rootId}`);
  lines.push(`- Compilation root path (in this project): \`./${rootRel}\``);
  lines.push(
    '- Open that root file first (after reading its header). Use its `seed` + `output_spec` as the primary outcome contract for this build.'
  );
  lines.push(
    `- Scope: ${handoff.compilation_scope || 'self_only'}; profile: ${handoff.target_tool_profile || 'unspecified'}`
  );
  lines.push(
    `- **Closure rule:** only files present under \`./${osngDir}/\` participate. Discover them via \`graph.*\` links. Sibling branches that were not snapshotted are simply absent — do not invent or fetch them from elsewhere.`
  );
  lines.push('');
  lines.push('## Strategy (how to traverse via graph.*)');
  lines.push(`strategy_id: ${handoff.strategy_id}`);
  lines.push(options.strategyGuidance);
  for (const bullet of strategyWalkInstructions(handoff.strategy_id)) {
    lines.push(bullet);
  }
  lines.push(
    '- At each node: open the YAML under `./osng/`, read the header if needed, then extract `seed`, `output_spec`, `thematic_lenses`, `success_evidences`, and `graph` as needed for the artifact.'
  );
  lines.push(
    '- Resolve `id` / `file_name` to a snapshotted `*.osn.yaml` under `./osng/` (directory layout mirrors Lexiom_1_3; `graph.*` remains authoritative).'
  );
  lines.push('- Do not paste or assume OSN bodies from memory; pull requirements from the files you open.');
  lines.push('');
  lines.push('## Artifact contract');
  for (const bullet of options.artifactBullets) {
    lines.push(`- ${bullet}`);
  }
  if (handoff.strategy_id === STRATEGY_IDS.OUTLINE_THEN_FILL) {
    for (const bullet of options.outlineBullets || []) {
      lines.push(`- ${bullet}`);
    }
  }
  lines.push(
    '- Always write BUILD_REPORT.md listing included OSN ids you actually used, strategy, primary files, gaps, and which OSN supplied each major decision.'
  );
  lines.push('');
  lines.push('## Non-goals');
  for (const bullet of options.nonGoals) {
    lines.push(`- ${bullet}`);
  }
  lines.push('');
  lines.push('## Conflict precedence (when Concordance is unavailable)');
  for (const bullet of options.precedence) {
    lines.push(`- ${bullet}`);
  }
  lines.push('- Record unresolved conflicts in BUILD_REPORT.md rather than inventing a silent merge.');
  lines.push('');
  lines.push('## Extraction protocol');
  lines.push('1. Read compilation-root header + `./OSNG_Basics_README.md`.');
  lines.push('2. Traverse via graph.* among files under `./osng/`, using strategy_id walk rules above.');
  lines.push(
    '3. For each visited OSN, extract only what the artifact needs (prefer `output_spec`; use `seed` for intent). Do not collect evidence files here.'
  );
  lines.push('4. Produce the artifact at the project root.');
  lines.push('5. Write BUILD_REPORT.md with provenance (OSN id → contribution).');
  lines.push('');
  lines.push('## Agent execution');
  lines.push('- Inspect source files through the CA workspace tools; do not assume contents from filenames.');
  lines.push('- Write primary artifacts through the CA workspace tools and finish only after verification.');
  lines.push(
    `- Evidence generation remains a separate Step 5 pass described by \`${EVIDENCE_AGENT_PROMPT_FILENAME}\`.`
  );
  lines.push('');

  return lines.join('\n');
}

export async function packageSoftwareCodingPrompt(staticRoot, handoff, repoRoot) {
  const root = repoRoot || path.dirname(staticRoot);
  const outDir = handoff.output_directory;
  const prompt = buildTraversalProtocolPrompt(handoff, root, {
    title: 'software-coding builder',
    roleLine: 'You are a software coding agent.',
    strategyGuidance:
      'Honor Standard → Root → Experience → Implementation precedence on conflicts (roles from node_type / discipline / output_spec, not fixed names).',
    artifactBullets: [
      'Produce a runnable software tree matching the compilation root and descendant output_specs you extract from disk.',
      'Default when unspecified: static web client (index.html + script + stylesheet or equivalent).'
    ],
    outlineBullets: [
      'Pass 1: write FILE_PLAN.md only (no production code).',
      'Pass 2: implement modules per FILE_PLAN.',
      'Pass 3: reconcile against Root scope and success evidences.'
    ],
    nonGoals: [
      'No inventing backends/auth/billing/DB unless OSNs require them.',
      'Do not modify files under ./osng/ (snapshot is read-only).',
      'Do not copy OSN YAML into deliverables as a substitute for reading ./osng/.'
    ],
    precedence: [
      'Standard ancestor invariants (governance, approval, evidence)',
      'Compilation root product outcome / in-scope list',
      'Experience / interaction discipline OSNs',
      'Implementation / code-shape discipline OSNs'
    ]
  });

  await fsp.writeFile(path.join(outDir, 'AGENT_PROMPT.md'), prompt, 'utf8');
  return { promptPath: path.join(outDir, 'AGENT_PROMPT.md'), prompt };
}

export async function packageDocumentBuilderPrompt(staticRoot, handoff, repoRoot) {
  const outDir = handoff.output_directory;
  const economy = handoff.context_economy || {};
  const lines = [
    '# Lexiom document builder (context economy)',
    '',
    '## Prepared workspace',
    `- Deterministic node snapshots: \`./${economy.nodes_dir || PREPARED_NODES_DIR}/\` (${economy.node_count || 0} immutable JSON files).`,
    `- The host has already resolved \`./${economy.build_plan_path || BUILD_PLAN_FILENAME}\`, \`./${economy.source_map_path || SOURCE_MAP_FILENAME}\`, and \`./${economy.sources_dir || 'sources'}/\` into the bounded phase packet; do not reopen them during composition.`,
    `- Primer: \`./${handoff.osng_basics_path || 'OSNG_Basics_README.md'}\``,
    '',
    '## Role',
    '- You are a document author operating in bounded phases.',
    '- Do **not** rediscover the graph or list/read every prepared node.',
    '- Consume only the assigned phase packet (capsules + source excerpts + outline slice).',
    '',
    '## Phase contract',
    '- Phase `outline`: write `OUTLINE.md` (TOC + owning short keys / OSN ids as scaffold). No body prose.',
    '- Phase `fill:<cluster>`: write exactly one `sections/<NN-slug>.md` in reader-facing prose.',
    '- Host assembly produces `document.md` from ordered sections; do not rewrite the whole manuscript unless a repair phase asks.',
    '- Submit the required artifact with `write_file`; the host validates it and completes the phase atomically.',
    '',
    '## Outcome cleanliness (required)',
    '- `document.md` and `sections/**` must contain finished domain prose only.',
    '- Forbidden in outcome bodies: OSN ids, `*.osn.yaml` paths, schema field names (`output_spec`, `seed`, `graph.*`, `success_evidences`, …), build/process meta, or “compiled from OSN…” language.',
    '- Provenance belongs in machine `BUILD_MANIFEST.json` / deterministic `BUILD_REPORT.md`, not in reader prose.',
    '',
    '## Fidelity rules',
    '- Honor Root/Standard capsules, shared policy invariants, and snapshotted source excerpts.',
    '- Do not invent unsupported capability, regulatory, numerical, market, or pricing claims.',
    '- Preserve product identity, category, naming hierarchy, and foundational promise from the provided capsules/sources.',
    '',
    '## Non-goals',
    '- Not a coding agent.',
    '- Do not modify `./nodes/`, build-plan, source-map, or `sources/**`.',
    '- Evidence collection remains a separate Step 5 pass.',
    ''
  ];
  const prompt = lines.join('\n');
  await fsp.writeFile(path.join(outDir, 'AGENT_PROMPT.md'), prompt, 'utf8');
  return { promptPath: path.join(outDir, 'AGENT_PROMPT.md'), prompt };
}

async function packagePromptForHandoff(staticRoot, handoff, repoRoot) {
  const builder =
    handoff.plugin_id === PLUGIN_IDS.DOCUMENT
      ? await packageDocumentBuilderPrompt(staticRoot, handoff, repoRoot)
      : await packageSoftwareCodingPrompt(staticRoot, handoff, repoRoot);

  let plan = null;
  try {
    plan = await loadEvidencePlanFromBuildDir(handoff.output_directory);
  } catch (error) {
    if (!(error && error.code === 'ENOENT')) {
      throw error;
    }
  }
  if (!plan && handoff.evidence_collection) {
    // Minimal stub so the evidence prompt still packages if plan file is missing.
    plan = {
      summary: handoff.evidence_collection.summary || {
        total: 0,
        direct: 0,
        derivative: 0
      }
    };
  }
  const evidence = await packageEvidenceAgentPrompt(handoff, plan || { summary: {} });

  return {
    promptPath: builder.promptPath,
    prompt: builder.prompt,
    evidencePromptPath: evidence.promptPath,
    evidencePrompt: evidence.prompt
  };
}

async function writeRunResult(outDir, result) {
  await fsp.writeFile(
    path.join(outDir, 'RUN_RESULT.json'),
    JSON.stringify(result, null, 2),
    'utf8'
  );
}

async function writeBuildReport(handoff, status, detail, extras = {}) {
  let plan = extras.plan || null;
  let phaseLedger = extras.phaseLedger || null;
  let tokenTotals = extras.tokenTotals || null;
  let validation = extras.validation || null;
  const outDir = handoff.output_directory;

  if (!plan && handoff.plugin_id === PLUGIN_IDS.DOCUMENT) {
    try {
      plan = JSON.parse(await fsp.readFile(path.join(outDir, BUILD_PLAN_FILENAME), 'utf8'));
    } catch {
      plan = null;
    }
  }
  if (!phaseLedger) {
    try {
      phaseLedger = JSON.parse(await fsp.readFile(path.join(outDir, PHASE_LEDGER_FILENAME), 'utf8'));
    } catch {
      phaseLedger = null;
    }
  }
  if (!tokenTotals && phaseLedger?.token_totals) {
    tokenTotals = phaseLedger.token_totals;
  }

  const notesPath = path.join(outDir, 'BUILD_NOTES.md');
  let agentNotes = '';
  try {
    agentNotes = await fsp.readFile(notesPath, 'utf8');
  } catch {
    agentNotes = '';
  }

  const report = renderDeterministicBuildReport({
    handoff,
    plan,
    phaseLedger,
    status,
    detail,
    validation,
    tokenTotals
  });
  const withNotes = agentNotes.trim()
    ? `${report}\n## Agent notes\n\n${agentNotes.trim()}\n`
    : report;
  await fsp.writeFile(path.join(outDir, 'BUILD_REPORT.md'), withNotes, 'utf8');

  if (handoff.plugin_id === PLUGIN_IDS.DOCUMENT) {
    const manifest = {
      schema_version: 'lexiom13-build-manifest/1',
      run_id: handoff.run_id,
      status,
      detail: detail || null,
      plugin_id: handoff.plugin_id,
      strategy_id: handoff.strategy_id,
      nodes_dir: PREPARED_NODES_DIR,
      node_files: plan?.node_files || {},
      build_plan_path: BUILD_PLAN_FILENAME,
      source_map_path: SOURCE_MAP_FILENAME,
      phase_ledger_path: PHASE_LEDGER_FILENAME,
      validation: validation || null,
      token_totals: tokenTotals || null,
      section_files: plan?.section_files || [],
      completed_at: new Date().toISOString()
    };
    await fsp.writeFile(
      path.join(outDir, BUILD_MANIFEST_FILENAME),
      JSON.stringify(manifest, null, 2),
      'utf8'
    );
  }
}

/** @type {Map<string, { handoff: object, timer: NodeJS.Timeout }>} */
const pendingBrowserJobs = new Map();

async function finishBuilderJobFromReport(handoff, sessionId, reportResult) {
  const outDir = handoff.output_directory;
  const runId = handoff.run_id;
  const primaryName = primaryArtifactForPlugin(handoff.plugin_id);
  const status = reportResult.status || 'agent_failed';
  const detail = reportResult.detail || null;
  const reason = reportResult.reason || null;
  const pass = reportResult.pass || 'builder';

  let entries = [];
  try {
    entries = await fsp.readdir(outDir);
  } catch {
    entries = [];
  }

  const completed = status === 'completed';
  let budWritten = false;
  let budRecord = null;
  let budDetailSuffix = '';

  if (completed) {
    attachInternalRoots(handoff);
    try {
      const budResult = await writeBudAfterSuccessfulRun({
        staticRoot: handoff._static_root,
        handoff,
        completedAt: new Date().toISOString()
      });
      if (budResult.ok) {
        budWritten = true;
        budRecord = budResult.bud;
      } else {
        budDetailSuffix = ` Bud not written (${budResult.reason || 'bud_failed'}).`;
        console.warn('lexiom13_bud_persist_skipped', budResult);
      }
    } catch (error) {
      budDetailSuffix = ` Bud not written (${error?.message || 'bud_error'}).`;
      console.error('lexiom13_bud_persist_failed', error);
    }
  }

  const finalDetail = detail
    ? `${detail}${budDetailSuffix}`
    : budWritten
      ? 'Build completed; bud written on requesting OSN.'
      : detail;

  const result = {
    status,
    executor: EXECUTOR_ID,
    ca_location: CA_LOCATION_BROWSER_SESSION,
    runtime: 'webcontainer',
    session_id: sessionId,
    pass,
    reason,
    detail: finalDetail,
    handoff: stripInternalHandoff(handoff),
    agent: {
      launched: true,
      status,
      reason,
      pass,
      latency_ms: reportResult.latency_ms || null,
      ca_location: CA_LOCATION_BROWSER_SESSION,
      executor: EXECUTOR_ID
    },
    primary_artifacts: completed
      ? [
          ...new Set([
            'AGENT_PROMPT.md',
            EVIDENCE_AGENT_PROMPT_FILENAME,
            EVIDENCE_PLAN_FILENAME,
            EVIDENCE_MANIFEST_FILENAME,
            'BUILD_REPORT.md',
            'HANDOFF.json',
            primaryName,
            ...entries
          ])
        ]
      : [
          'AGENT_PROMPT.md',
          EVIDENCE_AGENT_PROMPT_FILENAME,
          EVIDENCE_PLAN_FILENAME,
          'BUILD_REPORT.md',
          'HANDOFF.json'
        ],
    output_directory: outDir,
    bud_written: budWritten,
    bud: budRecord,
    bud_preview_path: budRecord?.preview_path || budRecord?.artifact_path || null,
    agent_metrics: reportResult.metrics || null,
    evidence_mode: reportResult.evidence_mode || null,
    evidence_collection: reportResult.evidence_collection || null,
    completed_at: new Date().toISOString(),
    log_tail: reportResult.log_tail || null
  };

  await writeBuildReport(handoff, status, finalDetail, {
    tokenTotals: reportResult.metrics?.token_totals || null,
    phaseLedger: reportResult.metrics?.phase_ledger || null,
    validation: reportResult.validation || null
  });
  await writeRunResult(outDir, result);
  upsertAgentRun({
    run_id: runId,
    compilation_root_osn_id: handoff.compilation_root_osn_id,
    status,
    executor: EXECUTOR_ID,
    ca_location: CA_LOCATION_BROWSER_SESSION,
    session_id: sessionId,
    detail: finalDetail,
    reason,
    bud_written: budWritten,
    bud_preview_path: result.bud_preview_path,
    plugin_id: handoff.plugin_id,
    started_at: handoff._started_at || null
  });
  return result;
}

function caSessionFromTicket(ticket) {
  return {
    session_id: ticket.session_id,
    run_id: ticket.run_id,
    pass: ticket.pass,
    ca_location: ticket.ca_location,
    executor: ticket.executor,
    runtime: ticket.runtime,
    broker_path: ticket.broker_path,
    broker_token: ticket.broker_token,
    gt3_consult_path: ticket.gt3_consult_path || ticket.broker_path,
    gt3_consult_credential: ticket.gt3_consult_credential || ticket.broker_token,
    capability_token: ticket.capability_token,
    workspace_manifest_url: ticket.workspace.manifest_path,
    file_path_template: ticket.workspace.file_path_template,
    artifacts_url: ticket.artifacts_path,
    report_url: ticket.report_path,
    heartbeat_url: `/lexiom13/build/session/${encodeURIComponent(ticket.session_id)}/heartbeat`,
    cancel_url: `/lexiom13/build/session/${encodeURIComponent(ticket.session_id)}/cancel`,
    timeout_ms: ticket.timeout_ms,
    plugin_id: ticket.plugin_id
  };
}

async function armPendingBrowserJob(sessionId, handoff, timeoutMs, timeoutDetail) {
  const timer = setTimeout(() => {
    if (!pendingBrowserJobs.has(sessionId)) return;
    pendingBrowserJobs.delete(sessionId);
    reportLexiom13CaSession(sessionId, {
      status: 'agent_failed',
      reason: 'timeout',
      detail: timeoutDetail
    }).catch((e) => console.error('lexiom13_ca_timeout_finalize', e));
  }, timeoutMs);
  if (typeof timer.unref === 'function') timer.unref();
  pendingBrowserJobs.set(sessionId, { handoff, timer });
}

/**
 * After successful builder validation, run Option E host quote-span evidence collection.
 * No browser CA evidence Job and no heuristic fallback.
 * Returns null when the plan is empty (evidence pass skipped).
 */
async function collectHostEvidenceSpansAfterBuilder(handoff, builderSessionId, builderResult) {
  let plan = null;
  try {
    plan = await loadEvidencePlanFromBuildDir(handoff.output_directory);
  } catch {
    plan = null;
  }
  const targetCount = Array.isArray(plan?.targets) ? plan.targets.length : 0;
  if (targetCount === 0) {
    return null;
  }

  const detail =
    `Builder primary validated; collecting evidences via host quote-span extraction (${targetCount} plan targets).`;

  const running = {
    status: 'running',
    executor: EXECUTOR_ID,
    ca_location: CA_LOCATION_BROWSER_SESSION,
    runtime: 'webcontainer',
    session_id: builderSessionId,
    pass: 'evidence',
    evidence_mode: 'quote_spans',
    builder_session_id: builderSessionId,
    builder_pass_status: 'completed',
    evidence_ca_session: null,
    handoff: stripInternalHandoff(handoff),
    agent: {
      launched: true,
      status: 'running',
      pass: 'evidence',
      evidence_mode: 'quote_spans',
      ca_location: CA_LOCATION_BROWSER_SESSION,
      executor: EXECUTOR_ID
    },
    primary_artifacts: [
      'AGENT_PROMPT.md',
      EVIDENCE_AGENT_PROMPT_FILENAME,
      EVIDENCE_PLAN_FILENAME,
      'HANDOFF.json',
      primaryArtifactForPlugin(handoff.plugin_id)
    ],
    output_directory: handoff.output_directory,
    bud_written: false,
    started_at: handoff._started_at || null,
    builder_completed_at: new Date().toISOString(),
    builder_metrics: builderResult.metrics || null,
    detail
  };

  await writeBuildReport(handoff, 'running', detail);
  await writeRunResult(handoff.output_directory, running);
  upsertAgentRun({
    run_id: handoff.run_id,
    compilation_root_osn_id: handoff.compilation_root_osn_id,
    status: 'running',
    executor: EXECUTOR_ID,
    ca_location: CA_LOCATION_BROWSER_SESSION,
    session_id: builderSessionId,
    detail,
    bud_written: false,
    plugin_id: handoff.plugin_id,
    started_at: handoff._started_at || null
  });

  const collected = await collectEvidenceByQuoteSpans(handoff);
  return {
    ok: collected.ok === true,
    reason: collected.reason || null,
    detail: collected.detail || detail,
    summary: collected.summary || null,
    evidence_mode: 'quote_spans'
  };
}

/**
 * Browser CA worker final report (syncOut already applied via artifacts endpoint).
 */
export async function reportLexiom13CaSession(
  sessionId,
  report = {},
  capabilityToken = null
) {
  const pending = pendingBrowserJobs.get(sessionId);
  const session = getCaSession(sessionId);
  if (!session) {
    const err = new Error('CA session not found');
    err.statusCode = 404;
    throw err;
  }
  const handoff =
    (pending && pending.handoff) ||
    (await loadHandoffForSession(session));

  if (pending && pending.timer) {
    clearTimeout(pending.timer);
  }
  pendingBrowserJobs.delete(sessionId);

  return applySessionReport(
    sessionId,
    report,
    async (result, reportedSession) => {
      const pass = reportedSession?.pass || result.pass || 'builder';
      result.pass = pass;

      if (pass === 'builder' && result.status === 'completed') {
        const spanPass = await collectHostEvidenceSpansAfterBuilder(
          handoff,
          sessionId,
          result
        );
        if (spanPass) {
          result.pass = 'evidence';
          result.evidence_mode = 'quote_spans';
          result.evidence_ca_session = null;
          result.next_pass = null;
          if (!spanPass.ok) {
            result.status = 'agent_failed';
            result.reason = spanPass.reason || 'evidence_span_failed';
            result.detail = spanPass.detail;
            if (result.agent) {
              result.agent.status = 'agent_failed';
              result.agent.reason = result.reason;
              result.agent.pass = 'evidence';
            }
          } else {
            result.detail = spanPass.detail;
            result.evidence_collection = spanPass.summary;
            if (result.agent) {
              result.agent.pass = 'evidence';
              result.agent.status = 'completed';
            }
          }
        }
      }

      await finishBuilderJobFromReport(handoff, sessionId, result).then((finished) => {
        if (!finished || typeof finished !== 'object') return;
        result.bud_written = finished.bud_written === true;
        result.bud = finished.bud || null;
        result.bud_preview_path = finished.bud_preview_path || null;
        if (finished.detail != null) result.detail = finished.detail;
      });
    },
    capabilityToken
  );
}

async function loadHandoffForSession(session) {
  const handoffPath = path.join(session.output_directory, 'HANDOFF.json');
  const raw = await fsp.readFile(handoffPath, 'utf8');
  const handoff = JSON.parse(raw);
  handoff.output_directory = handoff.output_directory || session.output_directory;
  handoff._started_at = handoff._started_at || null;
  return attachInternalRoots(handoff);
}

async function loadPreparedHandoff(repoRoot, runId) {
  const id = String(runId || '').trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw httpError(400, 'Invalid prepared run_id');
  }
  const outputDirectory = path.join(repoRoot, 'builds', 'lexiom13', id);
  const raw = await fsp.readFile(path.join(outputDirectory, 'HANDOFF.json'), 'utf8');
  const handoff = JSON.parse(raw);
  if (handoff.run_id !== id || !Object.values(PLUGIN_IDS).includes(handoff.plugin_id)) {
    throw httpError(409, 'Prepared HANDOFF identity is invalid');
  }
  return attachInternalRoots({ ...handoff, output_directory: outputDirectory, _repo_root: repoRoot });
}

function attachInternalRoots(handoff) {
  if (!handoff || typeof handoff !== 'object') {
    return handoff;
  }
  if (!handoff._repo_root && handoff.output_directory) {
    handoff._repo_root = path.resolve(handoff.output_directory, '..', '..', '..');
  }
  if (!handoff._static_root && handoff._repo_root) {
    handoff._static_root = path.join(handoff._repo_root, 'public');
  }
  return handoff;
}

function stripInternalHandoff(handoff) {
  const { _repo_root, _static_root, _started_at, ...rest } = handoff || {};
  return rest;
}

/**
 * Prepare prompts and start builder asynchronously (CA browser_session + bolt_webcontainer).
 * Returns immediately with status: running; SPA WebContainer worker owns the agent loop.
 */
export async function runLexiom13Build(staticRoot, repoRoot, body = {}) {
  let handoff;
  if (body.handoff && body.handoff.run_id) {
    handoff = await loadPreparedHandoff(repoRoot, body.handoff.run_id);
  } else {
    handoff = await prepareLexiom13Build(staticRoot, repoRoot, body);
  }

  handoff._repo_root = repoRoot;
  handoff._static_root = staticRoot;
  handoff._started_at = new Date().toISOString();

  await packagePromptForHandoff(staticRoot, handoff, repoRoot);

  const ticket = issueCaJobTicket({
    runId: handoff.run_id,
    pluginId: handoff.plugin_id,
    outputDirectory: handoff.output_directory,
    productPort: parseInt(process.env.PORT || '8080', 10),
    pass: 'builder',
    caLocation: body.ca_location || CA_LOCATION_BROWSER_SESSION
  });

  await dispatchCaJob({ sessionId: ticket.session_id });

  const caSession = caSessionFromTicket(ticket);
  const running = {
    status: 'running',
    executor: EXECUTOR_ID,
    ca_location: CA_LOCATION_BROWSER_SESSION,
    runtime: 'webcontainer',
    session_id: ticket.session_id,
    pass: 'builder',
    ca_session: caSession,
    ca_job: ticket,
    handoff: stripInternalHandoff(handoff),
    agent: {
      launched: true,
      status: 'running',
      pass: 'builder',
      ca_location: CA_LOCATION_BROWSER_SESSION,
      executor: EXECUTOR_ID
    },
    primary_artifacts: [
      'AGENT_PROMPT.md',
      EVIDENCE_AGENT_PROMPT_FILENAME,
      EVIDENCE_PLAN_FILENAME,
      'HANDOFF.json'
    ],
    output_directory: handoff.output_directory,
    bud_written: false,
    started_at: handoff._started_at,
    detail: `Builder pass started (CA bolt_webcontainer; timeout ${Math.round(BUILDER_TIMEOUT_MS / 60000)} min). Lexiom SPA runs the WebContainer worker. Poll GET /lexiom13/build/status/${handoff.run_id}.`
  };

  await writeBuildReport(handoff, 'running', running.detail);
  await writeRunResult(handoff.output_directory, running);
  upsertAgentRun({
    run_id: handoff.run_id,
    compilation_root_osn_id: handoff.compilation_root_osn_id,
    status: 'running',
    executor: EXECUTOR_ID,
    ca_location: CA_LOCATION_BROWSER_SESSION,
    session_id: ticket.session_id,
    detail: running.detail,
    bud_written: false,
    plugin_id: handoff.plugin_id,
    started_at: handoff._started_at
  });

  await armPendingBrowserJob(
    ticket.session_id,
    handoff,
    BUILDER_TIMEOUT_MS,
    `Builder pass timed out after ${Math.round(BUILDER_TIMEOUT_MS / 60000)} minutes (browser CA)`
  );

  return running;
}

/** Read RUN_RESULT.json for polling. */
export async function readLexiom13BuildStatus(repoRoot, runId) {
  const id = String(runId || '').trim();
  if (!id || id.includes('..') || id.includes('/') || id.includes('\\')) {
    throw httpError(400, 'Invalid run_id');
  }
  const mem = getAgentRun(id);
  const resultPath = path.join(repoRoot, 'builds', 'lexiom13', id, 'RUN_RESULT.json');
  try {
    const raw = await fsp.readFile(resultPath, 'utf8');
    const parsed = JSON.parse(raw);
    return { ...parsed, ops_mirror: mem || null };
  } catch (e) {
    if (mem) return { status: mem.status, ...mem, run_id: id };
    if (e && e.code === 'ENOENT') {
      throw httpError(404, `No RUN_RESULT for run_id=${id}`);
    }
    throw e;
  }
}
