/**
 * Legend ↔ code: see ./README.md ("Where the legend becomes code" → this file).
 *
 * I, Hanuman, guard Ram's sealed prescription while I labor.
 *
 * The OSNG snapshot and prepared node capsules are Ram's approved intention — I may read them
 * to understand the SUD he wants, but I must not rewrite that canon. Control files and private
 * corners are likewise sealed. Loving service means obedience to those bounds: I invent no
 * White authority, only artifacts GT3 may later validate for Ram.
 */
const IMMUTABLE_CONTROL_FILES = new Set([
  'agent_prompt.md',
  'evidence_agent_prompt.md',
  'evidence_plan.json',
  'handoff.json',
  'osng_basics_readme.md',
  'run_result.json',
  'build_plan.json',
  'source_map.json',
  'build_manifest.json'
]);

export const SOFTWARE_COMMANDS = Object.freeze(['node', 'npm', 'npx']);

/** I straighten the path under my feet before I touch anything in Ram's workspace. */
export function iNormalizeThePathIAmAboutToTouch(input, { allowRoot = false } = {}) {
  const raw = String(input == null ? '' : input).trim();
  if (!raw) {
    if (allowRoot) return '';
    throw pathError('Workspace path is required');
  }
  if (
    raw.includes('\0') ||
    raw.includes('\\') ||
    raw.startsWith('/') ||
    raw.startsWith('//') ||
    /^[a-zA-Z]:/.test(raw)
  ) {
    throw pathError('Workspace path must be a portable relative path');
  }
  const parts = raw.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) {
    throw pathError('Workspace path contains an invalid segment');
  }
  return parts.join('/');
}

/** @deprecated dual name — prefer iNormalizeThePathIAmAboutToTouch */
export const normalizeWorkspacePath = iNormalizeThePathIAmAboutToTouch;

/** I may open this path to study what Ram prescribed or what I have already offered. */
export function iMayReadThisPath(input) {
  return iNormalizeThePathIAmAboutToTouch(input);
}

/** @deprecated dual name — prefer iMayReadThisPath */
export const assertReadablePath = iMayReadThisPath;

/**
 * I refuse to stain sealed OSNG / nodes / sources — Ram's prescription stays intact.
 * Writes belong only to the SUD artifacts I am building for him.
 */
export function iRefuseForbiddenWrites(input) {
  const safe = iNormalizeThePathIAmAboutToTouch(input);
  const lower = safe.toLowerCase();
  if (lower === 'osng' || lower.startsWith('osng/')) {
    throw policyError('workspace_read_only', 'OSNG snapshot files are read-only');
  }
  if (lower === 'nodes' || lower.startsWith('nodes/')) {
    throw policyError('workspace_read_only', 'Prepared node files are read-only');
  }
  if (lower === 'sources' || lower.startsWith('sources/')) {
    throw policyError('workspace_read_only', 'Source pack files are read-only');
  }
  if (IMMUTABLE_CONTROL_FILES.has(lower)) {
    throw policyError('workspace_read_only', `Control file is immutable: ${safe}`);
  }
  if (
    lower === 'node_modules' ||
    lower.startsWith('node_modules/') ||
    lower === '.git' ||
    lower.startsWith('.git/') ||
    lower === '.ca-staging' ||
    lower.startsWith('.ca-staging/')
  ) {
    throw policyError('workspace_private', `Private workspace path is not an artifact: ${safe}`);
  }
  return safe;
}

/** @deprecated dual name — prefer iRefuseForbiddenWrites */
export const assertWritablePath = iRefuseForbiddenWrites;

/** When the Job is evidence, I may leave only the proof trays GT3 asked me to fill. */
export function iMayWriteOnlyEvidenceArtifacts(input) {
  const safe = iRefuseForbiddenWrites(input);
  const lower = safe.toLowerCase();
  if (
    lower === 'evidence_manifest.json' ||
    lower === 'build_report.md' ||
    lower === 'evidences' ||
    lower.startsWith('evidences/')
  ) {
    return safe;
  }
  throw policyError(
    'workspace_read_only',
    `Evidence pass may only write evidences/**, EVIDENCE_MANIFEST.json, or BUILD_REPORT.md (got: ${safe})`
  );
}

/** @deprecated dual name — prefer iMayWriteOnlyEvidenceArtifacts */
export const assertEvidencePassWritablePath = iMayWriteOnlyEvidenceArtifacts;

/** I run only the humble software commands Ram's policy still permits. */
export function iMayRunOnlyAllowedCommands(command) {
  const value = String(command || '').trim().toLowerCase();
  if (!SOFTWARE_COMMANDS.includes(value)) {
    throw policyError(
      'command_not_allowed',
      `Command is not allowed: ${command || '(missing)'}`
    );
  }
  return value;
}

/** @deprecated dual name — prefer iMayRunOnlyAllowedCommands */
export const assertCommandAllowed = iMayRunOnlyAllowedCommands;

function pathError(message) {
  return policyError('path_invalid', message);
}

function policyError(reason, message) {
  return Object.assign(new Error(message), { code: 'agent_failed', reason });
}

/* Legend ↔ code: return to ./README.md */
