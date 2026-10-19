/**
 * OpenRouter fetch with wait+retry for transient rate / admission limits.
 *
 * Honors Retry-After (response header or OpenRouter error metadata), then
 * falls back to a bounded exponential backoff. Used by the agent broker and
 * other GT3 → OpenRouter call sites.
 */

const DEFAULT_MAX_ATTEMPTS = Math.max(
  1,
  Number.parseInt(process.env.GT3_OPENROUTER_MAX_ATTEMPTS || '4', 10) || 4
);
const DEFAULT_RETRY_AFTER_MS = Math.max(
  250,
  Number.parseInt(process.env.GT3_OPENROUTER_RETRY_DEFAULT_MS || '10000', 10) ||
    10000
);
const MAX_RETRY_AFTER_MS = Math.max(
  DEFAULT_RETRY_AFTER_MS,
  Number.parseInt(process.env.GT3_OPENROUTER_RETRY_MAX_MS || '60000', 10) ||
    60000
);

/** HTTP statuses worth waiting and retrying. */
const RETRYABLE_STATUSES = new Set([429, 502, 503]);

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleepMs(ms) {
  const n = Math.max(0, Number(ms) || 0);
  return new Promise((resolve) => setTimeout(resolve, n));
}

/**
 * Parse Retry-After as delay-seconds or HTTP-date → ms.
 * @param {unknown} value
 * @returns {number | null} delay in ms
 */
function parseRetryAfterDelayMs(value) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d+(\.\d+)?$/.test(raw)) {
    return Math.round(Number(raw) * 1000);
  }
  const asDate = Date.parse(raw);
  if (!Number.isNaN(asDate)) {
    return Math.max(0, asDate - Date.now());
  }
  return null;
}

/**
 * Parse X-RateLimit-Reset style values (unix seconds/ms or delay-seconds) → ms.
 * @param {unknown} value
 * @returns {number | null}
 */
function parseRateLimitResetDelayMs(value) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw || !/^\d+(\.\d+)?$/.test(raw)) {
    return parseRetryAfterDelayMs(value);
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  // Absolute unix ms (~1e12+) or unix seconds (~1e9+).
  if (n > 1e12) return Math.max(0, Math.round(n - Date.now()));
  if (n > 1e9) return Math.max(0, Math.round(n * 1000 - Date.now()));
  // Otherwise treat as delay-seconds (same as Retry-After).
  return Math.round(n * 1000);
}

/**
 * Pick wait time from OpenRouter response headers / body, else backoff.
 * @param {Response} resp
 * @param {string} bodyText
 * @param {number} attempt 1-based attempt that just failed
 * @returns {number} ms to wait before next attempt
 */
export function resolveOpenRouterRetryDelayMs(resp, bodyText, attempt) {
  const headerRetry =
    parseRetryAfterDelayMs(resp.headers?.get?.('retry-after')) ??
    parseRetryAfterDelayMs(resp.headers?.get?.('Retry-After'));
  const headerReset =
    parseRateLimitResetDelayMs(resp.headers?.get?.('x-ratelimit-reset')) ??
    parseRateLimitResetDelayMs(resp.headers?.get?.('X-RateLimit-Reset'));

  let bodyRetry = null;
  if (bodyText) {
    try {
      const parsed = JSON.parse(bodyText);
      const metaHeaders = parsed?.error?.metadata?.headers;
      if (metaHeaders && typeof metaHeaders === 'object') {
        bodyRetry =
          parseRetryAfterDelayMs(metaHeaders['Retry-After']) ??
          parseRetryAfterDelayMs(metaHeaders['retry-after']) ??
          parseRateLimitResetDelayMs(metaHeaders['X-RateLimit-Reset']) ??
          parseRateLimitResetDelayMs(metaHeaders['x-ratelimit-reset']);
      }
    } catch {
      /* ignore non-JSON error bodies */
    }
  }

  const explicit = headerRetry ?? bodyRetry ?? headerReset;
  if (explicit != null && explicit >= 0) {
    return Math.min(MAX_RETRY_AFTER_MS, Math.max(250, explicit));
  }

  const exp = DEFAULT_RETRY_AFTER_MS * Math.pow(2, Math.max(0, attempt - 1));
  const jitter = Math.floor(Math.random() * 250);
  return Math.min(MAX_RETRY_AFTER_MS, exp + jitter);
}

/**
 * @param {number} status
 * @returns {boolean}
 */
export function isRetryableOpenRouterStatus(status) {
  return RETRYABLE_STATUSES.has(Number(status));
}

/**
 * fetch() wrapper: retries transient OpenRouter failures (429 admission /
 * rate limit, 502/503) and network errors. Intermediate response bodies are
 * drained; the final Response is returned untouched for the caller to read.
 *
 * @param {string} url
 * @param {RequestInit} init
 * @param {{
 *   maxAttempts?: number,
 *   label?: string,
 *   onRetry?: (info: {
 *     attempt: number,
 *     maxAttempts: number,
 *     status: number | null,
 *     retryAfterMs: number,
 *     detail: string
 *   }) => void
 * }} [opts]
 * @returns {Promise<Response>}
 */
export async function openRouterFetchWithRetry(url, init, opts = {}) {
  const maxAttempts = Math.max(
    1,
    Number.isFinite(opts.maxAttempts) ? opts.maxAttempts : DEFAULT_MAX_ATTEMPTS
  );
  const label = opts.label || 'OpenRouter';
  let lastNetworkError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let resp;
    try {
      resp = await fetch(url, init);
      lastNetworkError = null;
    } catch (e) {
      lastNetworkError = e;
      if (attempt >= maxAttempts) throw e;
      const retryAfterMs = Math.min(
        MAX_RETRY_AFTER_MS,
        DEFAULT_RETRY_AFTER_MS * Math.pow(2, attempt - 1)
      );
      const detail = e && e.message ? e.message : String(e);
      if (typeof opts.onRetry === 'function') {
        opts.onRetry({
          attempt,
          maxAttempts,
          status: null,
          retryAfterMs,
          detail: `${label} network error: ${detail}`
        });
      }
      await sleepMs(retryAfterMs);
      continue;
    }

    if (resp.ok || !isRetryableOpenRouterStatus(resp.status) || attempt >= maxAttempts) {
      return resp;
    }

    const bodyText = await resp.text().catch(() => '');
    const retryAfterMs = resolveOpenRouterRetryDelayMs(resp, bodyText, attempt);
    if (typeof opts.onRetry === 'function') {
      opts.onRetry({
        attempt,
        maxAttempts,
        status: resp.status,
        retryAfterMs,
        detail: `${label} status=${resp.status}`
      });
    }
    await sleepMs(retryAfterMs);
  }

  if (lastNetworkError) throw lastNetworkError;
  // Unreachable when maxAttempts >= 1; keep a defensive throw.
  throw new Error(`${label} fetch exhausted retries without a response`);
}
