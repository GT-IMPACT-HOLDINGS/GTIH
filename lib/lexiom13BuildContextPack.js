/**
 * Deterministic document node / source pack for Lexiom 1.3 context economy.
 * Emits nodes/<short-key>.json, BUILD_PLAN.json, SOURCE_MAP.json, and sources/<hash>.*
 */
import { promises as fsp } from 'fs';
import path from 'path';
import crypto from 'crypto';

export const PREPARED_NODES_DIR = 'nodes';
export const BUILD_PLAN_FILENAME = 'BUILD_PLAN.json';
export const SOURCE_MAP_FILENAME = 'SOURCE_MAP.json';
export const BUILD_MANIFEST_FILENAME = 'BUILD_MANIFEST.json';
export const PHASE_LEDGER_FILENAME = 'PHASE_LEDGER.json';

const COMMON_REQUIREMENT_MARKERS = [
  'classify capability, market, regulatory, numerical, and performance claims',
  'treat ai-generated interpretation and copy as proposals',
  'keep the result concrete, commercially usable',
  'consistent with ancestor osns',
  'do not publish unsupported certainty'
];

/**
 * @param {{
 *   staticRoot: string,
 *   outputDirectory: string,
 *   rootOsn: object,
 *   subgraphOsns: object[],
 *   byId: Map<string, object>,
 *   pathById: Map<string, string>,
 *   walkPlan: object,
 *   strategyId: string,
 *   pluginId: string,
 *   runId: string
 * }} opts
 */
export async function writeDocumentContextPack(opts) {
  const {
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
  } = opts;

  const includedIds = new Set(subgraphOsns.map((o) => o.id));
  const keyById = assignShortKeys(subgraphOsns, rootOsn.id);
  const idByKey = new Map([...keyById.entries()].map(([id, key]) => [key, id]));

  const sourcePack = await packageSourceDocuments({
    staticRoot,
    outputDirectory,
    subgraphOsns
  });

  const capsules = subgraphOsns.map((osn) =>
    buildCapsule(osn, {
      keyById,
      includedIds,
      sourcePack,
      rootId: rootOsn.id
    })
  );

  const policy = liftSharedPolicy(capsules);
  for (const capsule of capsules) {
    capsule.unique_requirements = filterUniqueRequirements(
      capsule.unique_requirements,
      policy.shared_requirement_markers
    );
  }

  const clusters = buildFillClusters(rootOsn.id, byId, includedIds, keyById);
  const preparedNodes = await packagePreparedNodes({
    staticRoot,
    outputDirectory,
    subgraphOsns,
    pathById,
    keyById,
    capsules
  });
  const outlineKeys = (walkPlan?.passes?.[0]?.osn_ids || [...includedIds]).map(
    (id) => keyById.get(id)
  );
  const clusterHeadKeys = new Set(clusters.map((cluster) => cluster.head_key));
  const rootKey = keyById.get(rootOsn.id);
  const outlineContextKeys = capsules
    .filter(
      (capsule) =>
        capsule.role === 'root' ||
        capsule.role === 'standard' ||
        clusterHeadKeys.has(capsule.key) ||
        (capsule.role === 'mid' &&
          Array.isArray(capsule.parent_keys) &&
          capsule.parent_keys.includes(rootKey))
    )
    .map((capsule) => capsule.key);

  const plan = {
    schema_version: 'lexiom13-build-plan/1',
    run_id: runId,
    plugin_id: pluginId,
    strategy_id: strategyId,
    compilation_root_key: keyById.get(rootOsn.id),
    compilation_root_osn_id: rootOsn.id,
    policy,
    outline: {
      ordered_keys: outlineKeys.filter(Boolean),
      context_keys: outlineContextKeys,
      required_artifact: 'OUTLINE.md'
    },
    nodes_dir: PREPARED_NODES_DIR,
    node_files: Object.fromEntries(
      preparedNodes.files.map((node) => [node.key, node])
    ),
    fill_clusters: clusters,
    section_files: clusters.map((c, i) => ({
      cluster_id: c.cluster_id,
      path: sectionPathForCluster(c, i),
      title: c.title,
      ordered_keys: c.ordered_keys
    })),
    assembly: {
      document_path: 'document.md',
      mode: 'ordered_sections',
      section_order: clusters.map((c, i) => sectionPathForCluster(c, i))
    },
    token_budgets: {
      target_prompt_tokens_per_crossing: 4500,
      max_prompt_tokens_per_crossing: 8000,
      max_reconcile_prompt_tokens: 24000,
      max_lm_crossings: 8,
      max_cumulative_prompt_tokens: 100000,
      max_tokens_by_phase: {
        outline: 2500,
        fill: 6000,
        reconcile: 4000,
        repair: 3000
      }
    },
    key_index: Object.fromEntries(keyById.entries()),
    prepared_at: new Date().toISOString()
  };

  await fsp.writeFile(
    path.join(outputDirectory, BUILD_PLAN_FILENAME),
    JSON.stringify(plan, null, 2),
    'utf8'
  );
  await fsp.writeFile(
    path.join(outputDirectory, SOURCE_MAP_FILENAME),
    JSON.stringify(
      {
        schema_version: 'lexiom13-source-map/1',
        sources: sourcePack.sources,
        osn_refs: sourcePack.osnRefs
      },
      null,
      2
    ),
    'utf8'
  );

  return {
    nodes_dir: PREPARED_NODES_DIR,
    node_files: preparedNodes.files,
    snapshotById: preparedNodes.snapshotById,
    build_plan_path: BUILD_PLAN_FILENAME,
    source_map_path: SOURCE_MAP_FILENAME,
    sources_dir: 'sources',
    capsule_count: capsules.length,
    cluster_count: clusters.length,
    source_count: sourcePack.sources.length,
    plan,
    capsules,
    keyById,
    idByKey
  };
}

export function assignShortKeys(subgraphOsns, rootId) {
  const ordered = [...subgraphOsns].sort((a, b) => {
    if (a.id === rootId) return -1;
    if (b.id === rootId) return 1;
    return String(a.id).localeCompare(String(b.id));
  });
  const keyById = new Map();
  ordered.forEach((osn, i) => {
    keyById.set(osn.id, `n${String(i + 1).padStart(2, '0')}`);
  });
  return keyById;
}

export function buildFillClusters(rootId, byId, includedIds, keyById) {
  const root = byId.get(rootId);
  const rootChildren = childIds(root).filter((id) => includedIds.has(id));
  const clusters = [];

  for (const childId of rootChildren) {
    const child = byId.get(childId);
    const grands = childIds(child).filter((id) => includedIds.has(id));
    if (grands.length >= 2) {
      for (const grandId of grands) {
        clusters.push(makeCluster(grandId, byId, includedIds, keyById, clusters.length));
      }
    } else {
      clusters.push(makeCluster(childId, byId, includedIds, keyById, clusters.length));
    }
  }

  if (!clusters.length) {
    clusters.push(makeCluster(rootId, byId, includedIds, keyById, 0));
  }
  return clusters;
}

export function assembleDocumentFromSections(sectionContents) {
  const parts = [];
  for (const section of sectionContents) {
    const body = String(section?.content || '').trim();
    if (!body) continue;
    parts.push(body);
  }
  return `${parts.join('\n\n')}\n`;
}

export function estimateTokensFromText(text) {
  const chars = String(text || '').length;
  return Math.ceil(chars / 4);
}

export function estimateMessagesTokens(messages) {
  return estimateTokensFromText(JSON.stringify(messages || []));
}

export async function loadBuildPlan(outputDirectory) {
  const raw = await fsp.readFile(path.join(outputDirectory, BUILD_PLAN_FILENAME), 'utf8');
  return JSON.parse(raw);
}

export async function loadPreparedNode(outputDirectory, relativePath) {
  const raw = await fsp.readFile(
    path.join(outputDirectory, ...String(relativePath || '').split('/')),
    'utf8'
  );
  return JSON.parse(raw);
}

export async function loadSourceMap(outputDirectory) {
  const raw = await fsp.readFile(path.join(outputDirectory, SOURCE_MAP_FILENAME), 'utf8');
  return JSON.parse(raw);
}

export function renderDeterministicBuildReport({
  handoff,
  plan,
  phaseLedger,
  status,
  detail,
  validation,
  tokenTotals
}) {
  const lines = [
    '# BUILD_REPORT',
    '',
    `plugin_id: ${handoff.plugin_id}`,
    `strategy_id: ${handoff.strategy_id}`,
    `compilation_root: ${handoff.compilation_root_osn_id}`,
    `run_id: ${handoff.run_id}`,
    `status: ${status}`,
    detail ? `detail: ${detail}` : null,
    '',
    '## Context economy',
    `- prepared_nodes: ${PREPARED_NODES_DIR}/`,
    `- build_plan: ${BUILD_PLAN_FILENAME}`,
    `- source_map: ${SOURCE_MAP_FILENAME}`,
    `- fill_clusters: ${plan?.fill_clusters?.length || 0}`,
    '',
    '## Phases',
    ...(Array.isArray(phaseLedger?.phases)
      ? phaseLedger.phases.map(
          (p) =>
            `- ${p.phase_id}: status=${p.status}; crossings=${p.crossings || 0}; prompt_tokens=${p.prompt_tokens || 0}`
        )
      : ['- (none)']),
    '',
    '## Token totals',
    `- prompt_tokens: ${tokenTotals?.prompt_tokens || 0}`,
    `- completion_tokens: ${tokenTotals?.completion_tokens || 0}`,
    `- cached_tokens: ${tokenTotals?.cached_tokens || 0}`,
    `- crossings: ${tokenTotals?.crossings || 0}`,
    '',
    '## Validation',
    `- ok: ${validation?.ok !== false}`,
    validation?.detail ? `- detail: ${validation.detail}` : null,
    '',
    '## Included OSNs',
    ...(handoff.subgraph || []).map((n) => `- ${n.id}`),
    '',
    '## Section ownership',
    ...(plan?.section_files || []).map(
      (s) => `- ${s.path}: ${s.title} (${(s.ordered_keys || []).join(', ')})`
    ),
    ''
  ].filter((x) => x !== null);
  return lines.join('\n');
}

function makeCluster(headId, byId, includedIds, keyById, index) {
  const head = byId.get(headId);
  const memberIds = [];
  collectIncludedDescendants(headId, byId, includedIds, new Set(), memberIds);
  const ordered_keys = memberIds.map((id) => keyById.get(id)).filter(Boolean);
  const slug = slugify(head?.title || headId || `cluster_${index + 1}`);
  return {
    cluster_id: `c${String(index + 1).padStart(2, '0')}`,
    head_key: keyById.get(headId),
    head_osn_id: headId,
    title: head?.title || headId,
    slug,
    ordered_keys,
    member_osn_ids: memberIds
  };
}

function collectIncludedDescendants(id, byId, includedIds, seen, out) {
  if (!id || seen.has(id) || !includedIds.has(id)) return;
  seen.add(id);
  out.push(id);
  const osn = byId.get(id);
  for (const childId of childIds(osn)) {
    collectIncludedDescendants(childId, byId, includedIds, seen, out);
  }
}

function buildCapsule(osn, { keyById, includedIds, sourcePack, rootId }) {
  const parents = childLike(osn?.graph?.parent_osn_ids)
    .filter((id) => includedIds.has(id))
    .map((id) => keyById.get(id))
    .filter(Boolean);
  const children = childIds(osn)
    .filter((id) => includedIds.has(id))
    .map((id) => keyById.get(id))
    .filter(Boolean);
  const lenses = (Array.isArray(osn.thematic_lenses) ? osn.thematic_lenses : []).map((lens) => ({
    name: lens?.name || null,
    purpose: compactText(lens?.purpose || '', 180)
  }));
  const sourceRef = sourcePack.osnRefs[osn.id] || null;
  const requirements = extractRequirementBullets(osn.output_spec);
  return {
    key: keyById.get(osn.id),
    osn_id: osn.id,
    title: osn.title || null,
    role: inferRole(osn, rootId),
    node_type: osn.node_type || null,
    discipline: osn.discipline || null,
    parent_keys: parents,
    child_keys: children,
    seed: compactText(osn.seed || '', 600),
    lenses,
    unique_requirements: requirements,
    source: sourceRef,
    claim_constraints: extractClaimConstraints(osn),
    approved: {
      seed: Boolean(String(osn.seed || '').trim()),
      output_spec: Boolean(String(osn.output_spec || '').trim()),
      thematic_lenses: Array.isArray(osn.thematic_lenses) && osn.thematic_lenses.length > 0
    }
  };
}

function inferRole(osn, rootId) {
  if (osn.id === rootId) return 'root';
  const parents = childLike(osn?.graph?.parent_osn_ids);
  if (!parents.length) return 'standard';
  const children = childIds(osn);
  if (!children.length) return 'leaf';
  return 'mid';
}

function extractRequirementBullets(outputSpec) {
  const text = String(outputSpec || '');
  const bullets = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('-')) continue;
    const body = trimmed.replace(/^-\s*/, '').replace(/\s+/g, ' ').trim();
    if (body) bullets.push(body);
  }
  if (!bullets.length && text.trim()) {
    bullets.push(compactText(text, 500));
  }
  return bullets;
}

function extractClaimConstraints(osn) {
  const requirements = extractRequirementBullets(osn.output_spec).filter((line) =>
    /claim|unsupported|approv|evidence|regulat|numerical|pricing|market/i.test(line)
  );
  const lensEvidence = (Array.isArray(osn.thematic_lenses) ? osn.thematic_lenses : [])
    .filter((l) => /evidence|claim/i.test(`${l?.name || ''} ${l?.purpose || ''}`))
    .map((l) => compactText(l.purpose || l.name || '', 160));
  return [...new Set([...requirements, ...lensEvidence])].slice(0, 8);
}

function liftSharedPolicy(capsules) {
  const markerHits = new Map();
  for (const capsule of capsules) {
    for (const req of capsule.unique_requirements || []) {
      const lower = req.toLowerCase();
      for (const marker of COMMON_REQUIREMENT_MARKERS) {
        if (lower.includes(marker)) {
          if (!markerHits.has(marker)) markerHits.set(marker, []);
          markerHits.get(marker).push(capsule.key);
        }
      }
    }
  }
  const shared = [...markerHits.entries()]
    .filter(([, keys]) => keys.length >= Math.max(3, Math.ceil(capsules.length * 0.35)))
    .map(([marker, keys]) => ({
      marker,
      originating_keys: [...new Set(keys)].slice(0, 12)
    }));
  return {
    shared_invariants: [
      'Write finished reader-facing prose only.',
      'Do not invent unsupported capability, regulatory, numerical, market, or pricing claims.',
      'Preserve product identity and category from Root/Standard capsules and source excerpts.',
      'Do not emit OSN ids, schema field names, or build-process vocabulary in document.md / sections/**.'
    ],
    shared_requirement_markers: shared
  };
}

function filterUniqueRequirements(requirements, sharedMarkers) {
  const markers = (sharedMarkers || []).map((m) => m.marker);
  return (requirements || []).filter((req) => {
    const lower = req.toLowerCase();
    return !markers.some((marker) => lower.includes(marker));
  });
}

async function packagePreparedNodes({
  staticRoot,
  outputDirectory,
  subgraphOsns,
  pathById,
  keyById,
  capsules
}) {
  const nodesDir = path.join(outputDirectory, PREPARED_NODES_DIR);
  await fsp.mkdir(nodesDir, { recursive: true });
  const capsuleByKey = new Map(capsules.map((capsule) => [capsule.key, capsule]));
  const files = [];
  const snapshotById = new Map();

  for (const osn of subgraphOsns) {
    const key = keyById.get(osn.id);
    const publicPath = pathById.get(osn.id) || null;
    let sourceYamlSha256 = null;
    if (publicPath) {
      const sourceAbsolute = path.join(
        staticRoot,
        ...String(publicPath).replace(/^\/+/, '').split('/')
      );
      const sourceYaml = await fsp.readFile(sourceAbsolute, 'utf8');
      sourceYamlSha256 = crypto
        .createHash('sha256')
        .update(sourceYaml, 'utf8')
        .digest('hex');
    }

    const prepared = canonicalizeJsonValue({
      schema_version: 'lexiom13-prepared-node/1',
      key,
      source: {
        osn_id: osn.id,
        public_path: publicPath,
        yaml_sha256: sourceYamlSha256
      },
      context: stableCapsule(capsuleByKey.get(key)),
      osn
    });
    const serialized = `${JSON.stringify(prepared, null, 2)}\n`;
    const artifactSha256 = crypto
      .createHash('sha256')
      .update(serialized, 'utf8')
      .digest('hex');
    const relativePath = `${PREPARED_NODES_DIR}/${key}.json`;
    await fsp.writeFile(
      path.join(outputDirectory, ...relativePath.split('/')),
      serialized,
      'utf8'
    );
    const descriptor = {
      key,
      osn_id: osn.id,
      path: relativePath,
      artifact_sha256: artifactSha256,
      source_yaml_sha256: sourceYamlSha256,
      byte_length: Buffer.byteLength(serialized, 'utf8')
    };
    files.push(descriptor);
    snapshotById.set(osn.id, {
      id: osn.id,
      key,
      snapshot_path: relativePath,
      source_public_path: publicPath,
      source_yaml_sha256: sourceYamlSha256,
      artifact_sha256: artifactSha256
    });
  }

  return {
    files: files.sort((a, b) => a.key.localeCompare(b.key)),
    snapshotById
  };
}

async function packageSourceDocuments({ staticRoot, outputDirectory, subgraphOsns }) {
  const sourcesDir = path.join(outputDirectory, 'sources');
  await fsp.mkdir(sourcesDir, { recursive: true });
  const byHash = new Map();
  const osnRefs = {};

  for (const osn of subgraphOsns) {
    const spec = osn.source_spec;
    if (!spec || typeof spec !== 'object') continue;
    const document = String(spec.document || '').trim();
    if (!document) continue;
    const abs = resolveSourceDocumentPath(staticRoot, document);
    let content;
    try {
      content = await fsp.readFile(abs, 'utf8');
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        const err = new Error(
          `source_spec document missing for ${osn.id}: ${document}`
        );
        err.statusCode = 400;
        throw err;
      }
      throw error;
    }
    const hash = crypto.createHash('sha256').update(content, 'utf8').digest('hex').slice(0, 16);
    const ext = path.extname(document) || '.md';
    const rel = `sources/${hash}${ext}`;
    if (!byHash.has(hash)) {
      await fsp.writeFile(path.join(outputDirectory, ...rel.split('/')), content, 'utf8');
      byHash.set(hash, {
        hash,
        path: rel,
        document,
        byte_length: Buffer.byteLength(content, 'utf8'),
        section_index: indexMarkdownSections(content)
      });
    }
    osnRefs[osn.id] = {
      hash,
      path: rel,
      document,
      sections: String(spec.sections || '').trim() || null
    };
  }

  return {
    sources: [...byHash.values()].sort((a, b) => a.hash.localeCompare(b.hash)),
    osnRefs
  };
}

function indexMarkdownSections(content) {
  const matches = [];
  const pattern = /^##\s+(\d+)(?:[.\s]|$).*$/gm;
  let match;
  while ((match = pattern.exec(String(content || ''))) !== null) {
    matches.push({
      number: Number(match[1]),
      title: match[0].replace(/^##\s+/, '').trim(),
      start: match.index
    });
  }
  return matches.map((section, index) => ({
    ...section,
    end: matches[index + 1]?.start ?? String(content || '').length
  }));
}

function resolveSourceDocumentPath(staticRoot, document) {
  const cleaned = String(document || '')
    .replace(/^\/+/, '')
    .replace(/^gt2\/Lexiom_1_3\//i, '');
  return path.join(staticRoot, 'gt2', 'Lexiom_1_3', ...cleaned.split('/'));
}

function sectionPathForCluster(cluster, index) {
  const n = String(index + 1).padStart(2, '0');
  return `sections/${n}-${cluster.slug || cluster.cluster_id}.md`;
}

function slugify(value) {
  return String(value || 'section')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'section';
}

function childIds(osn) {
  return childLike(osn?.graph?.child_osn_ids);
}

function childLike(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function compactText(value, max) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function canonicalizeJsonValue(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalizeJsonValue);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalizeJsonValue(value[key])])
    );
  }
  return value;
}

function stableCapsule(capsule) {
  return {
    key: capsule.key,
    osn_id: capsule.osn_id,
    title: capsule.title,
    role: capsule.role,
    node_type: capsule.node_type,
    discipline: capsule.discipline,
    parent_keys: capsule.parent_keys,
    child_keys: capsule.child_keys,
    seed: capsule.seed,
    lenses: capsule.lenses,
    unique_requirements: capsule.unique_requirements,
    source: capsule.source,
    claim_constraints: capsule.claim_constraints,
    approved: capsule.approved
  };
}
