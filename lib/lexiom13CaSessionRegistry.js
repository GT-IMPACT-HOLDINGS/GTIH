/**
 * Lexiom 1.3 CA session registry — browser_session leases (VAL Step 4).
 * CA secondary name: Hanuman (devotee of Ram / the player; see lexiom13CaNaming.js).
 */
import crypto from 'crypto';

export { CA_SECONDARY_NAME, caDisplayLabel } from './lexiom13CaNaming.js';

const MAX_SESSIONS = 80;
/** @type {Map<string, object>} */
const bySessionId = new Map();
/** @type {Map<string, string>} */
const sessionByRunId = new Map();
const TERMINAL_STATUSES = new Set([
  'completed',
  'failed',
  'unavailable',
  'cancelled',
  'expired'
]);

export const CA_LOCATION_BROWSER_SESSION = 'browser_session';

/**
 * @param {{
 *   runId: string,
 *   pluginId: string,
 *   outputDirectory: string,
 *   pass?: string,
 *   timeoutMs?: number
 * }} opts
 */
export function createCaSession(opts) {
  const sessionId = `cas_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();
  const timeoutMs = Math.max(1000, Number(opts.timeoutMs) || 20 * 60 * 1000);
  const entry = {
    session_id: sessionId,
    run_id: opts.runId,
    plugin_id: opts.pluginId,
    output_directory: opts.outputDirectory,
    pass: opts.pass === 'evidence' ? 'evidence' : 'builder',
    ca_location: CA_LOCATION_BROWSER_SESSION,
    status: 'leased',
    created_at: now,
    last_heartbeat_at: now,
    expires_at: new Date(nowMs + timeoutMs).toISOString(),
    capability_token: crypto.randomBytes(24).toString('base64url'),
    final_result: null,
    cancelled: false
  };
  bySessionId.set(sessionId, entry);
  sessionByRunId.set(opts.runId, sessionId);
  while (bySessionId.size > MAX_SESSIONS) {
    const oldest = bySessionId.keys().next().value;
    const old = bySessionId.get(oldest);
    bySessionId.delete(oldest);
    if (old && sessionByRunId.get(old.run_id) === oldest) {
      sessionByRunId.delete(old.run_id);
    }
  }
  return entry;
}

export function getCaSession(sessionId) {
  return bySessionId.get(String(sessionId || '')) || null;
}

export function getCaSessionByRunId(runId) {
  const sid = sessionByRunId.get(String(runId || ''));
  return sid ? getCaSession(sid) : null;
}

export function requireCaSessionAccess(
  sessionId,
  capabilityToken,
  { allowTerminal = false, allowExpired = false } = {}
) {
  const session = getCaSession(sessionId);
  if (!session) {
    throw sessionError('session_missing', 'CA session not found', 404);
  }
  if (!capabilityToken || capabilityToken !== session.capability_token) {
    throw sessionError('session_forbidden', 'CA session capability is invalid', 403);
  }
  if (!allowExpired && Date.now() > Date.parse(session.expires_at)) {
    session.status = 'expired';
    throw sessionError('session_expired', 'CA session expired', 410);
  }
  if (session.cancelled) {
    throw sessionError('session_cancelled', 'CA session cancelled', 409);
  }
  if (!allowTerminal && TERMINAL_STATUSES.has(session.status)) {
    throw sessionError('session_terminal', `CA session is already ${session.status}`, 409);
  }
  return session;
}

export function heartbeatCaSession(sessionId) {
  const s = getCaSession(sessionId);
  if (!s) return null;
  s.last_heartbeat_at = new Date().toISOString();
  return s;
}

export function cancelCaSession(sessionId) {
  const s = getCaSession(sessionId);
  if (!s) return null;
  s.cancelled = true;
  s.status = 'cancelled';
  s.last_heartbeat_at = new Date().toISOString();
  return s;
}

export function markCaSessionStatus(sessionId, status) {
  const s = getCaSession(sessionId);
  if (!s) return null;
  if (TERMINAL_STATUSES.has(s.status) && s.status !== status) return s;
  s.status = status;
  s.last_heartbeat_at = new Date().toISOString();
  return s;
}

export function isTerminalCaSession(session) {
  return !!session && TERMINAL_STATUSES.has(session.status);
}

function sessionError(code, message, statusCode) {
  return Object.assign(new Error(message), { code, statusCode });
}
