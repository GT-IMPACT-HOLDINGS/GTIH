/**
 * MBTS (Model Behind The Scene) catalog for the GT3 agent lane.
 *
 * GT3 remains Hanuman's only sun: the CA always sends a placeholder model id and
 * the broker overwrites it. This module is the single place where the human GT3
 * admin's allowed choices live, plus the provider-shape hints each choice needs.
 */

export const MBTS_FAMILY_ANTHROPIC = 'anthropic';
export const MBTS_FAMILY_OPENAI_REASONING = 'openai_reasoning';
export const MBTS_FAMILY_GENERIC = 'generic';

export const DEFAULT_AGENT_MBTS_ID = 'claude-haiku-4.5';

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   openrouter_slug: string,
 *   family: string,
 *   reasoning_effort: string | null,
 *   prompt_cache: 'anthropic_ephemeral' | 'implicit' | 'none',
 *   in_catalog: boolean
 * }} MbtsEntry
 */

/** @type {ReadonlyArray<MbtsEntry>} */
export const GT3_AGENT_MBTS_CATALOG = Object.freeze([
  Object.freeze({
    id: DEFAULT_AGENT_MBTS_ID,
    label: 'Claude Haiku 4.5',
    openrouter_slug: 'anthropic/claude-haiku-4.5',
    family: MBTS_FAMILY_ANTHROPIC,
    reasoning_effort: null,
    prompt_cache: 'anthropic_ephemeral',
    in_catalog: true
  }),
  Object.freeze({
    id: 'gpt-5.5-medium',
    label: 'GPT-5.5 (medium reasoning)',
    openrouter_slug: 'openai/gpt-5.5',
    family: MBTS_FAMILY_OPENAI_REASONING,
    reasoning_effort: 'medium',
    prompt_cache: 'implicit',
    in_catalog: true
  })
]);

export const DEFAULT_AGENT_OPENROUTER_MODEL =
  GT3_AGENT_MBTS_CATALOG[0].openrouter_slug;

/** @returns {Array<MbtsEntry>} */
export function listAgentMbts() {
  return GT3_AGENT_MBTS_CATALOG.map((entry) => ({ ...entry }));
}

/**
 * @param {string} id
 * @returns {MbtsEntry | null}
 */
export function getAgentMbtsById(id) {
  const wanted = String(id || '').trim();
  if (!wanted) return null;
  const found = GT3_AGENT_MBTS_CATALOG.find((entry) => entry.id === wanted);
  return found ? { ...found } : null;
}

/**
 * @param {string} slug
 * @returns {MbtsEntry | null}
 */
export function getAgentMbtsBySlug(slug) {
  const wanted = String(slug || '').trim();
  if (!wanted) return null;
  const found = GT3_AGENT_MBTS_CATALOG.find(
    (entry) => entry.openrouter_slug === wanted
  );
  return found ? { ...found } : null;
}

/**
 * Infer provider shape for a slug that predates or sits outside the catalog,
 * so an operator-supplied GT3_AGENT_OPENROUTER_MODEL never breaks the lane.
 * @param {string} slug
 */
function inferFamily(slug) {
  const s = String(slug || '').toLowerCase();
  if (s.startsWith('anthropic/')) return MBTS_FAMILY_ANTHROPIC;
  if (/^openai\/(gpt-5|o\d)/.test(s)) return MBTS_FAMILY_OPENAI_REASONING;
  return MBTS_FAMILY_GENERIC;
}

/**
 * Resolve a catalog id or a raw OpenRouter slug into a usable MBTS entry.
 * Unknown slugs are honored (in_catalog: false) rather than rejected.
 * @param {string} idOrSlug
 * @returns {MbtsEntry | null}
 */
export function resolveAgentMbts(idOrSlug) {
  const raw = String(idOrSlug || '').trim();
  if (!raw) return null;
  const byId = getAgentMbtsById(raw);
  if (byId) return byId;
  const bySlug = getAgentMbtsBySlug(raw);
  if (bySlug) return bySlug;
  const family = inferFamily(raw);
  return {
    id: raw,
    label: raw,
    openrouter_slug: raw,
    family,
    reasoning_effort: family === MBTS_FAMILY_OPENAI_REASONING ? 'medium' : null,
    prompt_cache:
      family === MBTS_FAMILY_ANTHROPIC ? 'anthropic_ephemeral' : 'implicit',
    in_catalog: false
  };
}

/**
 * Seed the runtime MBTS from env. Falls back to the catalog default.
 * @param {string} [envSlug] value of GT3_AGENT_OPENROUTER_MODEL
 * @returns {MbtsEntry}
 */
export function seedAgentMbtsFromEnv(envSlug) {
  return (
    resolveAgentMbts(envSlug) ||
    /** @type {MbtsEntry} */ (getAgentMbtsById(DEFAULT_AGENT_MBTS_ID))
  );
}

/**
 * Live MBTS chosen by the GT3 admin. Runtime-only: a restart re-seeds from env.
 * Held here (not in server.js) so the build lane can freeze it onto a CA job
 * ticket without importing the server.
 * @type {MbtsEntry}
 */
let runtimeAgentMbts = seedAgentMbtsFromEnv(
  process.env.GT3_AGENT_OPENROUTER_MODEL
);

/** @returns {MbtsEntry} */
export function getRuntimeAgentMbts() {
  return runtimeAgentMbts;
}

/**
 * @param {MbtsEntry} entry
 * @returns {MbtsEntry}
 */
export function setRuntimeAgentMbts(entry) {
  if (entry && entry.openrouter_slug) runtimeAgentMbts = entry;
  return runtimeAgentMbts;
}
