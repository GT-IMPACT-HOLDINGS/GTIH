/**
 * OpenRouter app attribution for GT3 traffic.
 *
 * OpenRouter keys its "App" column off `HTTP-Referer` and uses `X-Title` as that
 * app's display name. Without a referer every row reads "Unknown", so both GT3
 * lanes declare one here and differ by path, which is what makes build traffic
 * distinguishable from evidence collection in the OpenRouter logs.
 *
 * Ogun is the application, owned by GTIH.pbc. Hanuman is the agent that runs the
 * build inside it. Evidence collection is a host-side pass, not Hanuman's work.
 */

export const OPENROUTER_APP_NAME = 'Ogun';
export const OPENROUTER_APP_OWNER = 'GTIH.pbc';
export const OPENROUTER_AGENT_NAME = 'Hanuman';

/** Lane ids. */
export const ATTRIBUTION_LANE_BUILD = 'hanuman_build';
export const ATTRIBUTION_LANE_EVIDENCE = 'evidence_collection';

const DEFAULT_APP_BASE_REFERER = 'https://gtih.pbc/ogun';

/**
 * Base app URL. `GT3_HTTP_REFERER` lets an operator point attribution at a real
 * install URL; lane paths are appended to whatever it resolves to.
 */
export function openRouterAppBaseReferer() {
  const fromEnv = String(process.env.GT3_HTTP_REFERER || '').trim();
  return (fromEnv || DEFAULT_APP_BASE_REFERER).replace(/\/+$/, '');
}

/**
 * Attribution headers for one OpenRouter call.
 * @param {{ lane: string, pass?: string | null }} opts
 * @returns {{ 'HTTP-Referer': string, 'X-Title': string }}
 */
export function openRouterAttributionHeaders(opts) {
  const lane =
    opts && opts.lane === ATTRIBUTION_LANE_EVIDENCE
      ? ATTRIBUTION_LANE_EVIDENCE
      : ATTRIBUTION_LANE_BUILD;
  const base = openRouterAppBaseReferer();

  // Title reads coarsest-last: what | who | app | owner. ASCII only, since the
  // separator surfaces in terminals and OpenRouter's App column.
  if (lane === ATTRIBUTION_LANE_EVIDENCE) {
    return {
      'HTTP-Referer': `${base}/evidence-collection`,
      'X-Title': `Evidence collection | ${OPENROUTER_APP_NAME} | ${OPENROUTER_APP_OWNER}`
    };
  }

  const pass = opts && opts.pass ? String(opts.pass) : null;
  const what = pass && pass !== 'builder' ? `Evidence pass` : 'Build';
  return {
    'HTTP-Referer': `${base}/${OPENROUTER_AGENT_NAME.toLowerCase()}-build`,
    'X-Title': `${what} | ${OPENROUTER_AGENT_NAME} | ${OPENROUTER_APP_NAME} | ${OPENROUTER_APP_OWNER}`
  };
}
