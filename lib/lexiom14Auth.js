/**
 * Lexiom 1.4 — delegated credential mint/verify (POC).
 * HMAC-signed JSON tokens; not a production JWT stack.
 */
import crypto from 'crypto';

const API_VERSION = 'lexiom14/1.0';
const DEFAULT_SECRET = 'lexiom14-dev-secret';

function secret() {
  return process.env.GT3_LEXIOM14_DEMO_SECRET || DEFAULT_SECRET;
}

function b64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromB64url(s) {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

/**
 * @param {object} claims
 * @param {number} [ttlSec]
 */
export function mintLexiom14Credential(claims, ttlSec = 3600) {
  const now = Math.floor(Date.now() / 1000);
  const body = {
    api_version: API_VERSION,
    iat: now,
    exp: now + ttlSec,
    vertical_id: claims.vertical_id || 'trh',
    tenant_pseudonym: claims.tenant_pseudonym || 'tenant_demo',
    app_id: claims.app_id || 'trh_portal',
    env: claims.env || 'dev',
    actor_pseudonym: claims.actor_pseudonym || 'actor_demo',
    actor_kind: claims.actor_kind || 'human',
    scopes: Array.isArray(claims.scopes)
      ? claims.scopes
      : ['conversation', 'realization', 'embed', 'metering.read'],
    session_id: claims.session_id || null
  };
  const payload = b64url(JSON.stringify(body));
  const sig = b64url(crypto.createHmac('sha256', secret()).update(payload).digest());
  return {
    token: `${payload}.${sig}`,
    expires_at: new Date(body.exp * 1000).toISOString(),
    scopes: body.scopes,
    identity: {
      vertical_id: body.vertical_id,
      tenant_pseudonym: body.tenant_pseudonym,
      app_id: body.app_id,
      env: body.env,
      actor_pseudonym: body.actor_pseudonym,
      actor_kind: body.actor_kind
    },
    session_id: body.session_id
  };
}

/**
 * @param {string} token
 * @returns {{ ok: true, claims: object } | { ok: false, error: string }}
 */
export function verifyLexiom14Credential(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return { ok: false, error: 'missing_or_malformed_token' };
  }
  const [payload, sig] = token.split('.');
  const expected = b64url(crypto.createHmac('sha256', secret()).update(payload).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, error: 'invalid_signature' };
  }
  let claims;
  try {
    claims = JSON.parse(fromB64url(payload).toString('utf8'));
  } catch {
    return { ok: false, error: 'invalid_payload' };
  }
  const now = Math.floor(Date.now() / 1000);
  if (claims.exp && now > claims.exp) {
    return { ok: false, error: 'token_expired' };
  }
  return { ok: true, claims };
}

export function requireScope(claims, scope) {
  const scopes = Array.isArray(claims.scopes) ? claims.scopes : [];
  return scopes.includes(scope);
}

export { API_VERSION as LEXIOM14_API_VERSION };
