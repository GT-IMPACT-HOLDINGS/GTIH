/**
 * Server-side helpers for bolt_webcontainer CA (workspace sync + primary validation).
 * Product agent runs in the browser WebContainer — this module does not launch Docker.
 * CA secondary name: Hanuman (devotee of Ram / the player; see lexiom13CaNaming.js).
 */
import fsp from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { primaryArtifactForPlugin } from '../lexiom13CaPolicy.js';
import { CA_LOCATION_BROWSER_SESSION } from '../lexiom13CaSessionRegistry.js';

export const EXECUTOR_ID = 'bolt_webcontainer';
export const BUILDER_TIMEOUT_MS = 20 * 60 * 1000;
/** Evidence pass wall-clock (shorter than builder; still enough for large BrandLexiom plans). */
export const EVIDENCE_TIMEOUT_MS = 15 * 60 * 1000;

const TEXT_EXT = new Set([
  '.md',
  '.txt',
  '.json',
  '.yaml',
  '.yml',
  '.html',
  '.htm',
  '.css',
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.jsx',
  '.svg',
  '.csv',
  '.xml',
  '.toml',
  '.ini',
  '.sh',
  '.env',
  '.gitignore'
]);

const INLINE_TOP_LEVEL = [
  'HANDOFF.json',
  'AGENT_PROMPT.md',
  'EVIDENCE_AGENT_PROMPT.md',
  'EVIDENCE_PLAN.json',
  'EVIDENCE_MANIFEST.json',
  'OSNG_Basics_README.md',
  'BUILD_REPORT.md',
  'RUN_RESULT.json',
  'BUILD_PLAN.json',
  'SOURCE_MAP.json',
  'BUILD_MANIFEST.json',
  'PHASE_LEDGER.json'
];

const OSNG_ID_RE =
  /\b[\w.-]+\.osn\b|\.osn\.yaml\b|\bosng\/|output_spec|success_evidences|thematic_lenses|\bcompilation_root\b/i;
const IMMUTABLE_CONTROL_FILES = new Set([
  'agent_prompt.md',
  'evidence_agent_prompt.md',
  'evidence_plan.json',
  'handoff.json',
  'osng_basics_readme.md',
  'run_result.json',
  'build_plan.json',
  'source_map.json',
  'build_manifest.json',
  '.env'
]);
const MAX_ARTIFACT_FILES = 300;
const MAX_ARTIFACT_CHARS = 2_000_000;

/**
 * @param {string} outDir
 * @param {string} sessionId
 */
export async function buildSessionWorkspaceManifest(outDir, sessionId) {
  const root = path.resolve(outDir);
  const files = [];
  const paths = [];

  for (const name of INLINE_TOP_LEVEL) {
    const fp = path.join(root, name);
    try {
      const content = await fsp.readFile(fp, 'utf8');
      files.push({
        path: name,
        encoding: 'utf8',
        byte_length: Buffer.byteLength(content, 'utf8'),
        content
      });
      paths.push(name);
    } catch {
      /* optional */
    }
  }

  const osngDir = path.join(root, 'osng');
  try {
    await walkCollectPaths(osngDir, 'osng', paths);
  } catch {
    /* no osng */
  }

  const sourcesDir = path.join(root, 'sources');
  try {
    await walkCollectPaths(sourcesDir, 'sources', paths);
  } catch {
    /* no sources */
  }

  const nodesDir = path.join(root, 'nodes');
  try {
    await walkCollectPaths(nodesDir, 'nodes', paths);
  } catch {
    /* no prepared nodes */
  }

  const evidencesDir = path.join(root, 'evidences');
  try {
    await walkCollectPaths(evidencesDir, 'evidences', paths);
  } catch {
    /* no evidences yet */
  }

  // Other top-level text files (prompts already covered)
  try {
    const entries = await fsp.readdir(root, { withFileTypes: true });
    for (const ent of entries) {
      if (!ent.isFile()) continue;
      if (INLINE_TOP_LEVEL.includes(ent.name)) continue;
      const rel = ent.name;
      if (!isTexty(rel)) continue;
      if (!paths.includes(rel)) paths.push(rel);
    }
  } catch {
    /* ignore */
  }

  return {
    schema_version: 'lexiom13-ca-session-workspace/2',
    session_id: sessionId,
    ca_location: CA_LOCATION_BROWSER_SESSION,
    executor: EXECUTOR_ID,
    runtime: 'webcontainer',
    note:
      'Player WebContainer syncIn. Inline content for key top-level files; fetch others via file?path=. Canonical tree remains on GT3.',
    files,
    paths,
    canonical_roots: ['osng/', 'nodes/', 'sources/']
  };
}

/**
 * @param {string} outDir
 * @param {string} relPath
 */
export async function readWorkspaceFile(outDir, relPath) {
  const safe = normalizeRelPath(relPath);
  const fp = path.join(path.resolve(outDir), safe);
  if (!fp.startsWith(path.resolve(outDir))) {
    const err = new Error('Invalid path');
    err.statusCode = 400;
    throw err;
  }
  const content = await fsp.readFile(fp, 'utf8');
  return { path: safe, encoding: 'utf8', content };
}

/**
 * @param {string} outDir
 * @param {Array<{ path: string, content: string }>|undefined} files
 */
export async function applySessionArtifacts(outDir, files) {
  const root = path.resolve(outDir);
  const written = [];
  if (!Array.isArray(files)) return written;
  for (const f of files) {
    if (!f || !f.path || f.content == null) continue;
    const safe = assertWritableArtifactPath(String(f.path));
    const fp = path.join(root, safe);
    if (!fp.startsWith(root)) continue;
    await fsp.mkdir(path.dirname(fp), { recursive: true });
    await fsp.writeFile(fp, String(f.content), 'utf8');
    written.push(safe);
  }
  return written;
}

export async function stageSessionArtifacts(outDir, sessionId, files, opts = {}) {
  if (!Array.isArray(files)) return [];
  if (files.length > MAX_ARTIFACT_FILES) {
    throw httpError(413, `Artifact file count exceeds ${MAX_ARTIFACT_FILES}`);
  }
  const stageDir = sessionStageDirectory(outDir, sessionId);
  await fsp.rm(stageDir, { recursive: true, force: true });
  await fsp.mkdir(stageDir, { recursive: true });
  const evidencePass = opts.pass === 'evidence';
  const written = [];
  for (const file of files) {
    if (!file || file.path == null || file.content == null) continue;
    const safe = evidencePass
      ? assertEvidencePassWritablePath(file.path)
      : assertWritableArtifactPath(file.path);
    const content = String(file.content);
    if (content.length > MAX_ARTIFACT_CHARS) {
      throw httpError(413, `Artifact exceeds ${MAX_ARTIFACT_CHARS} characters: ${safe}`);
    }
    const target = path.join(stageDir, ...safe.split('/'));
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.writeFile(target, content, 'utf8');
    written.push(safe);
  }
  return written;
}

export async function promoteSessionArtifacts(outDir, sessionId) {
  const stageDir = sessionStageDirectory(outDir, sessionId);
  const files = [];
  await walkCollectPaths(stageDir, '', files);
  const root = path.resolve(outDir);
  for (const rel of files) {
    const safe = assertWritableArtifactPath(rel);
    const source = path.join(stageDir, ...safe.split('/'));
    const target = path.join(root, ...safe.split('/'));
    await fsp.mkdir(path.dirname(target), { recursive: true });
    const temporary = `${target}.ca-${sessionId}.tmp`;
    await fsp.copyFile(source, temporary);
    await fsp.rename(temporary, target);
  }
  await fsp.rm(stageDir, { recursive: true, force: true });
  return files;
}

export async function discardSessionArtifacts(outDir, sessionId) {
  await fsp.rm(sessionStageDirectory(outDir, sessionId), {
    recursive: true,
    force: true
  });
}

export function sessionStageDirectory(outDir, sessionId) {
  const safeSession = String(sessionId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeSession) throw httpError(400, 'Invalid session id');
  return path.join(path.resolve(outDir), '.ca-staging', safeSession);
}

/**
 * @param {string} outDir — staged or canonical directory containing candidate primary artifacts
 * @param {string} pluginId
 * @param {{ strategyId?: string|null, canonicalDir?: string|null }} [opts]
 */
/**
 * Evidence-pass writes only: evidences/**, EVIDENCE_MANIFEST.json, optional BUILD_REPORT.md.
 */
export function assertEvidencePassWritablePath(relPath) {
  const safe = normalizeRelPath(relPath);
  const lower = safe.toLowerCase();
  if (lower === 'evidence_manifest.json') {
    return safe;
  }
  if (lower === 'build_report.md') {
    return safe;
  }
  if (lower === 'evidences' || lower.startsWith('evidences/')) {
    return safe;
  }
  throw httpError(
    403,
    `Evidence pass may only write evidences/**, EVIDENCE_MANIFEST.json, or BUILD_REPORT.md (got: ${safe})`
  );
}

export async function validatePrimaryAfterSync(outDir, pluginId, opts = {}) {
  const primary = primaryArtifactForPlugin(pluginId);
  const fp = path.join(path.resolve(outDir), primary);
  const controlDir = path.resolve(opts.canonicalDir || outDir);
  let content;
  try {
    content = await fsp.readFile(fp, 'utf8');
  } catch {
    return {
      ok: false,
      reason: 'primary_missing',
      detail: `Builder finished but primary artifact missing: ${primary}`
    };
  }
  if (!String(content).trim()) {
    return {
      ok: false,
      reason: 'primary_empty',
      detail: `Primary artifact empty: ${primary}`
    };
  }
  if (pluginId === 'lexiom13.document_builder') {
    if (OSNG_ID_RE.test(content)) {
      return {
        ok: false,
        reason: 'primary_dirty',
        detail:
          'document.md failed outcome cleanliness (§3.5): OSNG/OSN process traces or schema vocabulary detected'
      };
    }

    let plan = null;
    try {
      plan = JSON.parse(await fsp.readFile(path.join(controlDir, 'BUILD_PLAN.json'), 'utf8'));
    } catch {
      plan = null;
    }

    const strategyId = opts.strategyId || plan?.strategy_id || null;
    const requireOutline =
      strategyId == null || strategyId === 'outline_then_fill' || Boolean(plan?.outline);
    if (requireOutline) {
      try {
        await fsp.access(path.join(outDir, 'OUTLINE.md'));
      } catch {
        try {
          await fsp.access(path.join(controlDir, 'OUTLINE.md'));
        } catch {
          return {
            ok: false,
            reason: 'outline_missing',
            detail: 'OUTLINE.md is required by outline_then_fill before document completion'
          };
        }
      }
    }

    if (plan?.section_files?.length) {
      const assembledParts = [];
      for (const section of plan.section_files) {
        const rel = String(section.path);
        let sectionContent = null;
        try {
          sectionContent = await fsp.readFile(path.join(outDir, ...rel.split('/')), 'utf8');
        } catch {
          try {
            sectionContent = await fsp.readFile(path.join(controlDir, ...rel.split('/')), 'utf8');
          } catch {
            sectionContent = null;
          }
        }
        if (sectionContent == null) {
          return {
            ok: false,
            reason: 'section_missing',
            detail: `Required section missing: ${section.path}`
          };
        }
        if (!String(sectionContent).trim()) {
          return {
            ok: false,
            reason: 'section_empty',
            detail: `Required section empty: ${section.path}`
          };
        }
        if (OSNG_ID_RE.test(sectionContent)) {
          return {
            ok: false,
            reason: 'section_dirty',
            detail: `Section failed cleanliness: ${section.path}`
          };
        }
        assembledParts.push(String(sectionContent).trim());
      }
      const expected = `${assembledParts.join('\n\n')}\n`;
      if (normalizeNewlines(content) !== normalizeNewlines(expected)) {
        return {
          ok: false,
          reason: 'document_assembly_mismatch',
          detail: 'document.md does not equal deterministic ordered section assembly'
        };
      }
    }

    if (plan) {
      try {
        await fsp.access(path.join(controlDir, 'SOURCE_MAP.json'));
      } catch {
        return {
          ok: false,
          reason: 'context_pack_missing',
          detail: 'Document context pack artifacts are required (prepared nodes/SOURCE_MAP)'
        };
      }
      const nodeValidation = await validatePreparedNodes(controlDir, plan);
      if (!nodeValidation.ok) return nodeValidation;
    }
  } else if (pluginId === 'lexiom13.software_coding_builder') {
    const missing = await missingLocalHtmlAssets(outDir, content);
    if (missing.length) {
      return {
        ok: false,
        reason: 'software_assets_missing',
        detail: `index.html references missing local assets: ${missing.join(', ')}`
      };
    }
  }
  return { ok: true, primary };
}

async function validatePreparedNodes(controlDir, plan) {
  const descriptors = Object.values(plan?.node_files || {});
  if (!descriptors.length) {
    return {
      ok: false,
      reason: 'context_nodes_missing',
      detail: 'BUILD_PLAN contains no prepared node descriptors'
    };
  }
  for (const descriptor of descriptors) {
    const rel = normalizeRelPath(descriptor.path);
    let raw;
    try {
      raw = await fsp.readFile(path.join(controlDir, ...rel.split('/')), 'utf8');
    } catch {
      return {
        ok: false,
        reason: 'context_node_missing',
        detail: `Prepared node missing: ${rel}`
      };
    }
    const actualHash = crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
    if (actualHash !== descriptor.artifact_sha256) {
      return {
        ok: false,
        reason: 'context_node_hash_mismatch',
        detail: `Prepared node hash mismatch: ${rel}`
      };
    }
    let node;
    try {
      node = JSON.parse(raw);
    } catch {
      return {
        ok: false,
        reason: 'context_node_invalid',
        detail: `Prepared node is not valid JSON: ${rel}`
      };
    }
    if (
      node.schema_version !== 'lexiom13-prepared-node/1' ||
      node.key !== descriptor.key ||
      node.source?.osn_id !== descriptor.osn_id ||
      node.source?.yaml_sha256 !== descriptor.source_yaml_sha256
    ) {
      return {
        ok: false,
        reason: 'context_node_identity_mismatch',
        detail: `Prepared node identity mismatch: ${rel}`
      };
    }
  }
  return { ok: true };
}

function normalizeNewlines(text) {
  return String(text || '').replace(/\r\n/g, '\n');
}

export function normalizeRelPath(relPath, { allowRoot = false } = {}) {
  const raw = String(relPath == null ? '' : relPath).trim();
  if (!raw) {
    if (allowRoot) return '';
    throw httpError(400, 'Relative path is required');
  }
  if (
    raw.includes('\0') ||
    raw.includes('\\') ||
    raw.startsWith('/') ||
    raw.startsWith('//') ||
    /^[a-zA-Z]:/.test(raw)
  ) {
    throw httpError(400, 'Path must be a portable relative path');
  }
  const parts = raw.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) {
    throw httpError(400, 'Path contains an invalid segment');
  }
  return parts.join('/');
}

export function assertWritableArtifactPath(relPath) {
  const safe = normalizeRelPath(relPath);
  const lower = safe.toLowerCase();
  if (lower === 'osng' || lower.startsWith('osng/')) {
    throw httpError(403, 'OSNG snapshot files are read-only');
  }
  if (lower === 'nodes' || lower.startsWith('nodes/')) {
    throw httpError(403, 'Prepared node files are read-only');
  }
  if (lower === 'sources' || lower.startsWith('sources/')) {
    throw httpError(403, 'Source pack files are read-only');
  }
  if (
    IMMUTABLE_CONTROL_FILES.has(lower) ||
    lower === 'node_modules' ||
    lower.startsWith('node_modules/') ||
    lower === '.git' ||
    lower.startsWith('.git/') ||
    lower === '.ca-staging' ||
    lower.startsWith('.ca-staging/')
  ) {
    throw httpError(403, `Control path is immutable: ${safe}`);
  }
  return safe;
}

function isTexty(rel) {
  const ext = path.extname(rel).toLowerCase();
  return !ext || TEXT_EXT.has(ext);
}

async function walkCollectPaths(absDir, relBase, paths) {
  const entries = await fsp.readdir(absDir, { withFileTypes: true });
  for (const ent of entries) {
    const rel = relBase ? `${relBase}/${ent.name}` : ent.name;
    if (ent.isDirectory()) {
      await walkCollectPaths(path.join(absDir, ent.name), rel, paths);
    } else if (ent.isFile() && isTexty(ent.name)) {
      paths.push(rel);
    }
  }
}

async function missingLocalHtmlAssets(outDir, html) {
  const missing = [];
  const refs = String(html).matchAll(/\b(?:src|href)=["']([^"'#?]+)["']/gi);
  for (const match of refs) {
    const ref = match[1];
    if (
      /^(?:[a-z]+:|\/\/|#|data:)/i.test(ref) ||
      ref.startsWith('/') ||
      ref.endsWith('.html')
    ) {
      continue;
    }
    let safe;
    try {
      safe = normalizeRelPath(ref);
    } catch {
      missing.push(ref);
      continue;
    }
    try {
      await fsp.access(path.join(outDir, ...safe.split('/')));
    } catch {
      missing.push(safe);
    }
  }
  return [...new Set(missing)];
}

function httpError(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}
