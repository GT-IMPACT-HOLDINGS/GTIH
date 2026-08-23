import { promises as fsp } from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { isSupportedDirectEvidenceKind } from './lexiom13BuildEvidence.js';

const OSN_YAML_SUFFIX = '.osn.yaml';
const OSN_TOMB_YAML_SUFFIX = '.tomb.osn.yaml';

// Shared comment header written to every created/updated OSN YAML (must stay in
// sync with the header on live *.osn.yaml files under public/gt2/Lexiom_1_3/).
const OSN_YAML_COMMENT_HEADER = `# Outcome Specification Node (OSN)
#
# See also: OSNG_Basics_README.md at the Lexiom_1_3 root — filename conventions
# for reconstructing the OSN Graph and linking evidentiary artifacts from names.
#
# An OSN is a human-owned semantic source file. Core fields: id and file_name
# (must match the on-disk stem), owner, seed, thematic_lenses, output_spec,
# success_evidences, compilation, and graph. Optional post-build bud is a
# bloom pointer written only by Lexiom/GT3 after a successful VAL run — never
# by agents. The seed states intention; thematic_lenses name professional
# perspectives; output_spec states the outcome contract; success_evidences
# name how fulfillment will be inspected.
#
# Graph links: set graph.parent_osn_ids to the parent OSN id(s) and list this
# node in each parent's graph.child_osn_ids (reciprocal). Optional
# standard_ancestor_osn_ids reference organizational standards beyond the
# local parent chain. On disk, prefer hierarchical stems
# {ancestor.path}.{leaf}.{unique_id}.osn.yaml so filenames sketch ancestry;
# when path prefixes and graph.* disagree, graph.* is authoritative.
`;

// Tombstoned OSNs use *.tomb.osn.yaml and are excluded from the live OSNG index.

export function getLexiom13OsnDir(staticRoot) {
  return path.join(staticRoot, 'gt2', 'Lexiom_1_3');
}

function isSafeOsnFileName(fileName) {
  return (
    typeof fileName === 'string' &&
    /^[A-Za-z0-9._-]+\.osn$/.test(fileName.trim()) &&
    !fileName.includes('..') &&
    !fileName.includes('/') &&
    !fileName.includes('\\')
  );
}

function toPosixPath(filePath) {
  return String(filePath || '').split(path.sep).join('/');
}

function toPublicOsnPath(relativeFilePath) {
  return `/gt2/Lexiom_1_3/${toPosixPath(relativeFilePath)}`;
}

function toYamlFileName(osnFileName) {
  return `${String(osnFileName || '').trim()}.yaml`;
}

function isLiveOsnYamlFileName(fileName) {
  return (
    typeof fileName === 'string' &&
    fileName.endsWith(OSN_YAML_SUFFIX) &&
    !fileName.endsWith(OSN_TOMB_YAML_SUFFIX)
  );
}

function toTombYamlFileName(liveYamlFileName) {
  const name = String(liveYamlFileName || '').trim();
  if (name.endsWith(OSN_YAML_SUFFIX)) {
    return name.slice(0, -OSN_YAML_SUFFIX.length) + OSN_TOMB_YAML_SUFFIX;
  }
  return `${name}${OSN_TOMB_YAML_SUFFIX}`;
}

export function stripRuntimeOsnFields(osn) {
  if (!osn || typeof osn !== 'object') {
    return null;
  }
  const copy = structuredClone(osn);
  delete copy.__canonical;
  delete copy.__sourcePath;
  delete copy.__fileLabel;
  delete copy.maturity;
  return copy;
}

export async function listLexiom13OsnYamlPaths(staticRoot) {
  const osnDir = getLexiom13OsnDir(staticRoot);
  const relativePaths = [];

  async function walk(currentDir, relativeDir = '') {
    let entries;
    try {
      entries = await fsp.readdir(currentDir, { withFileTypes: true });
    } catch (error) {
      if (error && error.code === 'ENOENT' && !relativeDir) {
        return;
      }
      throw error;
    }

    for (const entry of entries) {
      const relativePath = path.join(relativeDir, entry.name);
      if (entry.isDirectory()) {
        await walk(path.join(currentDir, entry.name), relativePath);
      } else if (entry.isFile() && isLiveOsnYamlFileName(entry.name)) {
        relativePaths.push(relativePath);
      }
    }
  }

  await walk(osnDir);
  return relativePaths
    .sort((a, b) => a.localeCompare(b))
    .map((relativePath) => toPublicOsnPath(relativePath));
}

export function serializeLexiom13OsnYaml(osn) {
  const body = yaml.dump(osn, {
    lineWidth: 100,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false,
  });
  return OSN_YAML_COMMENT_HEADER + body;
}

function serializeOsnYaml(osn) {
  return serializeLexiom13OsnYaml(osn);
}

async function readOsnYamlFile(filePath) {
  const raw = await fsp.readFile(filePath, 'utf8');
  const parsed = yaml.load(raw);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Invalid OSN YAML in ${path.basename(filePath)}`);
  }
  return { raw, parsed };
}

export async function loadOsnGraphIndex(staticRoot) {
  const osnDir = getLexiom13OsnDir(staticRoot);
  const paths = await listLexiom13OsnYamlPaths(staticRoot);
  const index = new Map();

  for (const publicPath of paths) {
    const publicPrefix = '/gt2/Lexiom_1_3/';
    const relativePublicPath = publicPath.startsWith(publicPrefix)
      ? publicPath.slice(publicPrefix.length)
      : '';
    const relativePath = decodeURIComponent(relativePublicPath).split('/').join(path.sep);
    const fileName = path.basename(relativePath);
    const filePath = path.join(osnDir, relativePath);
    const { parsed } = await readOsnYamlFile(filePath);
    if (parsed && parsed.id) {
      index.set(parsed.id, { filePath, fileName, relativePath, parsed });
    }
  }

  return index;
}

async function findOsnYamlFileById(staticRoot, osnId) {
  const index = await loadOsnGraphIndex(staticRoot);
  return index.get(osnId) || null;
}

async function ensureUniqueYamlFileName(directoryPath, desiredYamlFileName) {
  let candidate = desiredYamlFileName;
  let suffix = 1;
  while (true) {
    try {
      await fsp.access(path.join(directoryPath, candidate));
      const base = desiredYamlFileName.replace(/\.yaml$/i, '');
      candidate = `${base}_${suffix}.yaml`;
      suffix += 1;
    } catch {
      return candidate;
    }
  }
}

function validateOsnCoreSections(osn) {
  const errors = [];
  if (!osn || typeof osn !== 'object') {
    return ['osn must be an object'];
  }
  if (!String(osn.id || '').trim()) {
    errors.push('osn.id is required');
  }
  if (!isSafeOsnFileName(osn.file_name)) {
    errors.push('osn.file_name must be a safe *.osn filename');
  }
  if (!String(osn.seed || '').trim()) {
    errors.push('osn.seed must be non-empty');
  }
  if (!Array.isArray(osn.thematic_lenses) || osn.thematic_lenses.length < 1) {
    errors.push('osn.thematic_lenses must contain at least one lens');
  }
  if (!String(osn.output_spec || '').trim()) {
    errors.push('osn.output_spec must be non-empty');
  }
  const evidences = Array.isArray(osn.success_evidences) ? osn.success_evidences : [];
  if (!evidences.length) {
    errors.push('osn.success_evidences must contain at least one entry');
  }
  const hasDirect = evidences.some(
    (entry) => entry && entry.direct === true && isSupportedDirectEvidenceKind(entry.kind)
  );
  if (!hasDirect) {
    errors.push(
      'osn.success_evidences must include at least one entry with direct: true and kind in TEXTUAL_SNIPPET | SCREEN-SHOT | VIDEO-CLIP'
    );
  }
  for (const evidence of evidences) {
    if (!evidence || !String(evidence.evidence_id || '').trim()) {
      errors.push('each success evidence must include evidence_id');
      break;
    }
    if (!String(evidence.kind || '').trim()) {
      errors.push('each success evidence must include kind');
      break;
    }
    if (evidence.direct === true && !isSupportedDirectEvidenceKind(evidence.kind)) {
      errors.push(
        `direct success evidence kind must be one of TEXTUAL_SNIPPET | SCREEN-SHOT | VIDEO-CLIP (got: ${evidence.kind})`
      );
      break;
    }
    if (!String(evidence.inspection_prompt || '').trim()) {
      errors.push('each success evidence must include inspection_prompt');
      break;
    }
  }
  return errors;
}

export function validateOsnForCanonize(osn) {
  const errors = validateOsnCoreSections(osn);
  const parentIds = Array.isArray(osn.graph && osn.graph.parent_osn_ids) ? osn.graph.parent_osn_ids : [];
  if (!parentIds.length) {
    errors.push('osn.graph.parent_osn_ids must name at least one parent for a branched OSN');
  }
  return errors;
}

export function validateOsnForUpdate(osn) {
  return validateOsnCoreSections(osn);
}

function isRuntimeDraftOsnId(osnId) {
  // Legacy immature ids; new branches use path+uid file names as id.
  return typeof osnId === 'string' && osnId.startsWith('osn.draft.');
}

export function validateOsnGraphIntegrity(osn, index, operation) {
  const errors = [];
  if (!osn || !osn.graph) {
    errors.push('osn.graph is required');
    return errors;
  }

  const parentIds = Array.isArray(osn.graph.parent_osn_ids) ? osn.graph.parent_osn_ids : [];
  const childIds = Array.isArray(osn.graph.child_osn_ids) ? osn.graph.child_osn_ids : [];

  if (operation === 'create' && !parentIds.length) {
    errors.push('create requires at least one parent_osn_id');
  }

  for (const parentId of parentIds) {
    const parentEntry = index.get(parentId);
    if (!parentEntry) {
      errors.push(`parent OSN not found on disk: ${parentId}`);
      continue;
    }
    const parentChildren = Array.isArray(parentEntry.parsed.graph && parentEntry.parsed.graph.child_osn_ids)
      ? parentEntry.parsed.graph.child_osn_ids
      : [];
    if (operation === 'update' && !parentChildren.includes(osn.id)) {
      errors.push(`parent ${parentId} does not list child ${osn.id} in child_osn_ids`);
    }
  }

  for (const childId of childIds) {
    if (isRuntimeDraftOsnId(childId)) {
      continue;
    }
    if (!index.has(childId)) {
      errors.push(`child OSN not found on disk: ${childId}`);
    }
  }

  return errors;
}

async function updateParentChildLink(staticRoot, parentOsnId, childOsnId) {
  const parentMatch = await findOsnYamlFileById(staticRoot, parentOsnId);
  if (!parentMatch) {
    throw new Error(`Parent OSN not found on disk: ${parentOsnId}`);
  }

  const parent = parentMatch.parsed;
  if (!parent.graph || typeof parent.graph !== 'object') {
    parent.graph = {};
  }
  if (!Array.isArray(parent.graph.child_osn_ids)) {
    parent.graph.child_osn_ids = [];
  }
  if (!parent.graph.child_osn_ids.includes(childOsnId)) {
    parent.graph.child_osn_ids.push(childOsnId);
    await fsp.writeFile(parentMatch.filePath, serializeOsnYaml(parent), 'utf8');
  }
}

export async function removeChildLink(staticRoot, parentOsnId, childOsnId) {
  const parentMatch = await findOsnYamlFileById(staticRoot, parentOsnId);
  if (!parentMatch) {
    throw new Error(`Parent OSN not found on disk: ${parentOsnId}`);
  }

  const parent = parentMatch.parsed;
  if (!parent.graph || typeof parent.graph !== 'object') {
    parent.graph = {};
  }
  if (!Array.isArray(parent.graph.child_osn_ids)) {
    parent.graph.child_osn_ids = [];
  }
  const nextChildren = parent.graph.child_osn_ids.filter((id) => id !== childOsnId);
  if (nextChildren.length !== parent.graph.child_osn_ids.length) {
    parent.graph.child_osn_ids = nextChildren;
    await fsp.writeFile(parentMatch.filePath, serializeOsnYaml(parent), 'utf8');
  }
}

/** DFS post-order walk of a live OSN branch on disk (children before parents). */
export function collectBranchSubtreeIds(index, rootOsnId) {
  const postOrder = [];
  const visited = new Set();

  function walk(osnId) {
    if (!osnId || visited.has(osnId)) {
      return;
    }
    visited.add(osnId);
    const entry = index.get(osnId);
    if (!entry) {
      return;
    }
    const children = Array.isArray(entry.parsed.graph && entry.parsed.graph.child_osn_ids)
      ? entry.parsed.graph.child_osn_ids
      : [];
    for (const childId of children) {
      if (isRuntimeDraftOsnId(childId)) {
        continue;
      }
      if (index.has(childId)) {
        walk(childId);
      }
    }
    postOrder.push(osnId);
  }

  walk(rootOsnId);
  return postOrder;
}

async function tombstoneLiveOsnFile(staticRoot, entry, rootOsnId, prunedAt) {
  const osn = structuredClone(entry.parsed);
  if (!osn.graph || typeof osn.graph !== 'object') {
    osn.graph = {};
  }
  osn.graph.tombstone = {
    status: 'pruned',
    pruned_at: prunedAt,
    prune_root: rootOsnId,
  };

  const tombFileName = toTombYamlFileName(entry.fileName);
  const tombPath = path.join(path.dirname(entry.filePath), tombFileName);
  await fsp.writeFile(tombPath, serializeOsnYaml(osn), 'utf8');
  await fsp.unlink(entry.filePath);
  return toPosixPath(path.relative(getLexiom13OsnDir(staticRoot), tombPath));
}

export async function pruneLexiom13OsnBranch(staticRoot, body) {
  const payload = body && typeof body === 'object' ? body : {};
  const rootOsnId = String(payload.rootOsnId || '').trim();
  if (!rootOsnId) {
    const error = new Error('rootOsnId is required');
    error.statusCode = 400;
    throw error;
  }

  const index = await loadOsnGraphIndex(staticRoot);
  const rootEntry = index.get(rootOsnId);
  if (!rootEntry) {
    const error = new Error(`OSN not found on disk: ${rootOsnId}`);
    error.statusCode = 404;
    throw error;
  }

  const rootParents = Array.isArray(rootEntry.parsed.graph && rootEntry.parsed.graph.parent_osn_ids)
    ? rootEntry.parsed.graph.parent_osn_ids
    : [];
  const isGraphRoot = rootParents.length === 0;
  if (isGraphRoot && !payload.confirmRootPrune) {
    const error = new Error('confirmRootPrune is required when pruning an OSN graph root');
    error.statusCode = 400;
    throw error;
  }

  const subtreeIds = collectBranchSubtreeIds(index, rootOsnId);
  if (!subtreeIds.length) {
    const error = new Error(`No live branch found for ${rootOsnId}`);
    error.statusCode = 404;
    throw error;
  }

  const subtreeSet = new Set(subtreeIds);
  for (const nodeId of subtreeIds) {
    const entry = index.get(nodeId);
    const parentIds = Array.isArray(entry.parsed.graph && entry.parsed.graph.parent_osn_ids)
      ? entry.parsed.graph.parent_osn_ids
      : [];
    if (parentIds.length > 1) {
      const error = new Error(
        `Cannot prune ${nodeId}: multi-parent OSNs are not supported for pruning yet`
      );
      error.statusCode = 409;
      throw error;
    }
  }

  for (const nodeId of subtreeIds) {
    const entry = index.get(nodeId);
    const parentIds = Array.isArray(entry.parsed.graph && entry.parsed.graph.parent_osn_ids)
      ? entry.parsed.graph.parent_osn_ids
      : [];
    for (const parentId of parentIds) {
      if (!subtreeSet.has(parentId)) {
        await removeChildLink(staticRoot, parentId, nodeId);
      }
    }
  }

  const prunedAt = new Date().toISOString();
  const tombstonedFiles = [];
  for (const nodeId of subtreeIds) {
    const entry = index.get(nodeId);
    if (!entry) {
      continue;
    }
    tombstonedFiles.push(await tombstoneLiveOsnFile(staticRoot, entry, rootOsnId, prunedAt));
    index.delete(nodeId);
  }

  return {
    status: 'ok',
    operation: 'prune',
    rootOsnId,
    prunedIds: subtreeIds,
    tombstonedFiles,
  };
}

export async function tombstoneOsn(staticRoot, osnId) {
  return pruneLexiom13OsnBranch(staticRoot, { rootOsnId: osnId, confirmRootPrune: true });
}

async function createLexiom13Osn(staticRoot, body) {
  const osn = stripRuntimeOsnFields(body.osn);
  const parentOsnId =
    typeof body.parentOsnId === 'string' && body.parentOsnId.trim()
      ? body.parentOsnId.trim()
      : Array.isArray(osn && osn.graph && osn.graph.parent_osn_ids)
        ? String(osn.graph.parent_osn_ids[0] || '').trim()
        : '';

  const errors = validateOsnForCanonize(osn);
  if (!parentOsnId) {
    errors.push('parentOsnId is required');
  }
  if (errors.length) {
    const error = new Error(errors.join('; '));
    error.statusCode = 400;
    throw error;
  }

  const parentIds = osn.graph.parent_osn_ids.map((id) => String(id));
  if (!parentIds.includes(parentOsnId)) {
    const error = new Error('parentOsnId must be listed in osn.graph.parent_osn_ids');
    error.statusCode = 400;
    throw error;
  }

  const index = await loadOsnGraphIndex(staticRoot);
  const graphErrors = validateOsnGraphIntegrity(osn, index, 'create');
  if (graphErrors.length) {
    const error = new Error(graphErrors.join('; '));
    error.statusCode = 400;
    throw error;
  }

  const osnDir = getLexiom13OsnDir(staticRoot);
  const parentEntry = index.get(parentOsnId);
  const targetDir = path.dirname(parentEntry.filePath);
  await fsp.mkdir(targetDir, { recursive: true });

  const desiredYamlFileName = toYamlFileName(osn.file_name);
  const yamlFileName = await ensureUniqueYamlFileName(targetDir, desiredYamlFileName);
  const filePath = path.join(targetDir, yamlFileName);
  const relativePath = path.relative(osnDir, filePath);

  if (index.has(osn.id)) {
    const error = new Error(`An OSN with id ${osn.id} is already canonical on disk`);
    error.statusCode = 409;
    throw error;
  }

  if (!Array.isArray(osn.graph.child_osn_ids)) {
    osn.graph.child_osn_ids = [];
  }
  if (!osn.compilation || typeof osn.compilation !== 'object') {
    osn.compilation = {
      can_be_compilation_root: false,
      compilation_scope: 'self_only',
      target_tool_profile: null,
    };
  }

  await fsp.writeFile(filePath, serializeOsnYaml(osn), 'utf8');
  await updateParentChildLink(staticRoot, parentOsnId, osn.id);

  index.set(osn.id, { filePath, fileName: yamlFileName, relativePath, parsed: osn });

  return {
    status: 'ok',
    operation: 'create',
    osnId: osn.id,
    fileName: yamlFileName,
    sourcePath: toPublicOsnPath(relativePath),
    parentOsnId,
  };
}

async function updateLexiom13Osn(staticRoot, body) {
  const osn = stripRuntimeOsnFields(body.osn);
  const errors = validateOsnForUpdate(osn);
  if (errors.length) {
    const error = new Error(errors.join('; '));
    error.statusCode = 400;
    throw error;
  }

  const existing = await findOsnYamlFileById(staticRoot, osn.id);
  if (!existing) {
    const error = new Error(`OSN not found on disk: ${osn.id}`);
    error.statusCode = 404;
    throw error;
  }

  if (existing.parsed.id !== osn.id) {
    const error = new Error('osn.id is immutable on update');
    error.statusCode = 400;
    throw error;
  }

  const index = await loadOsnGraphIndex(staticRoot);
  const graphErrors = validateOsnGraphIntegrity(osn, index, 'update');
  if (graphErrors.length) {
    const error = new Error(graphErrors.join('; '));
    error.statusCode = 400;
    throw error;
  }

  const desiredYamlFileName = toYamlFileName(osn.file_name);
  let targetFilePath = existing.filePath;
  let yamlFileName = existing.fileName;

  const previousFileName =
    typeof body.previousFileName === 'string' && body.previousFileName.trim()
      ? body.previousFileName.trim()
      : String(existing.parsed.file_name || '');

  if (osn.file_name !== previousFileName && osn.file_name !== existing.parsed.file_name) {
    const collisionPath = path.join(path.dirname(existing.filePath), desiredYamlFileName);
    if (collisionPath !== existing.filePath) {
      try {
        await fsp.access(collisionPath);
        const error = new Error(`Target YAML file already exists: ${desiredYamlFileName}`);
        error.statusCode = 409;
        throw error;
      } catch (accessError) {
        if (accessError && accessError.statusCode === 409) {
          throw accessError;
        }
      }
    }
    await fsp.rename(existing.filePath, collisionPath);
    targetFilePath = collisionPath;
    yamlFileName = desiredYamlFileName;
    const relativePath = path.relative(getLexiom13OsnDir(staticRoot), targetFilePath);
    index.delete(osn.id);
    index.set(osn.id, {
      filePath: targetFilePath,
      fileName: yamlFileName,
      relativePath,
      parsed: osn,
    });
  }

  if (!Array.isArray(osn.graph.child_osn_ids)) {
    osn.graph.child_osn_ids = [];
  }

  await fsp.writeFile(targetFilePath, serializeOsnYaml(osn), 'utf8');

  return {
    status: 'ok',
    operation: 'update',
    osnId: osn.id,
    fileName: yamlFileName,
    sourcePath: toPublicOsnPath(
      path.relative(getLexiom13OsnDir(staticRoot), targetFilePath)
    ),
  };
}

export async function saveLexiom13Osn(staticRoot, payload) {
  const body = payload && typeof payload === 'object' ? payload : {};
  const operation = String(body.operation || '').trim().toLowerCase();

  if (operation === 'prune' || operation === 'delete') {
    return pruneLexiom13OsnBranch(staticRoot, body);
  }

  if (operation === 'create') {
    return createLexiom13Osn(staticRoot, body);
  }

  if (operation === 'update') {
    return updateLexiom13Osn(staticRoot, body);
  }

  const error = new Error('operation must be "create", "update", or "prune"');
  error.statusCode = 400;
  throw error;
}

export async function canonizeLexiom13Osn(staticRoot, payload) {
  return saveLexiom13Osn(staticRoot, {
    ...(payload || {}),
    operation: 'create',
  });
}
