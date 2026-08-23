/**
 * Lexiom 1.4 Express router — /lexiom14/v1/*
 */
import express from 'express';
import fs from 'fs';
import {
  LEXIOM14_API_VERSION,
  mintLexiom14Credential,
  verifyLexiom14Credential,
  requireScope
} from './lexiom14Auth.js';
import {
  createSession,
  getSession,
  conversationState,
  addSseClient
} from './lexiom14Sessions.js';
import { postConversationMessage } from './lexiom14Conversation.js';
import { generateOsnForSession } from './lexiom14OsnGenerate.js';
import {
  startDocumentRealization,
  getArtifactRecord,
  getEvidenceRecord
} from './lexiom14Realization.js';
import {
  appendLexiom14ConsumptionEvent,
  listLexiom14ConsumptionEvents
} from './lexiom14Metering.js';

const DEFAULT_CORS = [
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8080',
  'http://127.0.0.1:8080'
];

function corsAllowlist() {
  const raw = process.env.GT3_LEXIOM14_CORS_ORIGINS;
  if (raw && String(raw).trim()) {
    return String(raw)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return DEFAULT_CORS;
}

function applyLexiom14Cors(req, res) {
  const origin = req.headers.origin;
  const list = corsAllowlist();
  if (origin && list.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  } else if (!origin) {
    // same-origin / curl
    res.setHeader('Access-Control-Allow-Origin', list[0] || '*');
  }
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Authorization, Content-Type, Last-Event-ID'
  );
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

function setCorp(res) {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
}

function parseBearer(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : '';
}

function authMiddleware(requiredScope) {
  return (req, res, next) => {
    const token = parseBearer(req);
    const verified = verifyLexiom14Credential(token);
    if (!verified.ok) {
      return res.status(401).json({
        error: { code: verified.error, message: 'Unauthorized' }
      });
    }
    const scopes = Array.isArray(requiredScope) ? requiredScope : [requiredScope];
    const ok = scopes.some((s) => requireScope(verified.claims, s));
    if (requiredScope && !ok) {
      return res.status(403).json({
        error: {
          code: 'insufficient_scope',
          message: `Requires scope ${scopes.join(' or ')}`
        }
      });
    }
    req.lexiom14 = { claims: verified.claims };
    next();
  };
}

function identityFromClaims(claims) {
  return {
    vertical_id: claims.vertical_id,
    tenant_pseudonym: claims.tenant_pseudonym,
    app_id: claims.app_id,
    env: claims.env,
    actor_pseudonym: claims.actor_pseudonym,
    actor_kind: claims.actor_kind
  };
}

export function createLexiom14Router() {
  const router = express.Router();

  router.use((req, res, next) => {
    applyLexiom14Cors(req, res);
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    next();
  });

  router.get('/v1/version', (_req, res) => {
    res.json({ api_version: LEXIOM14_API_VERSION });
  });

  /** POC demo mint — vertical-owned in product; hosted here for smoke/TRH stubs. */
  router.post('/v1/demo/mint', express.json(), (req, res) => {
    const body = req.body || {};
    const cred = mintLexiom14Credential(body);
    res.json(cred);
  });

  router.post('/v1/sessions', authMiddleware('conversation'), express.json(), (req, res) => {
    const claims = req.lexiom14.claims;
    const session = createSession({
      identity: identityFromClaims(claims),
      seed_snapshot: req.body?.seed_snapshot,
      case_label: req.body?.case_label
    });
    appendLexiom14ConsumptionEvent({
      service: 'lexiom14.conversation.session_create',
      session_id: session.session_id,
      ...identityFromClaims(claims),
      provenance_id: null
    });
    res.status(201).json({ session_id: session.session_id, api_version: LEXIOM14_API_VERSION });
  });

  router.get('/v1/sessions/:sessionId', authMiddleware('conversation'), (req, res) => {
    const session = getSession(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: { code: 'session_not_found', message: 'Unknown session' } });
    }
    res.json(conversationState(session));
  });

  router.post(
    '/v1/sessions/:sessionId/osn',
    authMiddleware('conversation'),
    express.json(),
    async (req, res) => {
      const session = getSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ error: { code: 'session_not_found', message: 'Unknown session' } });
      }
      try {
        const result = await generateOsnForSession(session, req.body || {});
        appendLexiom14ConsumptionEvent({
          service: 'lexiom14.osn.generate',
          session_id: session.session_id,
          ...identityFromClaims(req.lexiom14.claims)
        });
        res.status(200).json({
          api_version: LEXIOM14_API_VERSION,
          structure: result.structure,
          build_readiness: result.build_readiness,
          osn_yaml: result.osn_yaml
        });
      } catch (e) {
        res.status(400).json({
          error: {
            code: e.code || 'osn_generate_failed',
            message: e.message || String(e)
          }
        });
      }
    }
  );

  router.post(
    '/v1/sessions/:sessionId/messages',
    authMiddleware('conversation'),
    express.json(),
    (req, res) => {
      const session = getSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ error: { code: 'session_not_found', message: 'Unknown session' } });
      }
      try {
        postConversationMessage(session, req.body || {});
        appendLexiom14ConsumptionEvent({
          service: 'lexiom14.conversation.message',
          session_id: session.session_id,
          ...identityFromClaims(req.lexiom14.claims)
        });
        res.status(202).json({ ok: true });
      } catch (e) {
        res.status(400).json({
          error: { code: e.code || 'bad_request', message: e.message || String(e) }
        });
      }
    }
  );

  router.get('/v1/sessions/:sessionId/events', authMiddleware('conversation'), (req, res) => {
    const session = getSession(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: { code: 'session_not_found', message: 'Unknown session' } });
    }
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    res.write(`: lexiom14 sse connected\n\n`);
    addSseClient(session.session_id, res);
    const ping = setInterval(() => {
      try {
        res.write(`: ping\n\n`);
      } catch {
        clearInterval(ping);
      }
    }, 15000);
    req.on('close', () => clearInterval(ping));
  });

  router.post(
    '/v1/sessions/:sessionId/realization',
    authMiddleware('realization'),
    express.json(),
    async (req, res) => {
      const session = getSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ error: { code: 'session_not_found', message: 'Unknown session' } });
      }
      const profile = req.body?.profile || 'document';
      if (profile !== 'document') {
        return res.status(400).json({
          error: {
            code: 'unsupported_profile',
            message: 'MVP supports profile "document" only'
          }
        });
      }
      try {
        const { realization_id } = await startDocumentRealization(
          session,
          identityFromClaims(req.lexiom14.claims)
        );
        res.status(202).json({ realization_id });
      } catch (e) {
        res.status(400).json({
          error: { code: e.code || 'bad_request', message: e.message || String(e) }
        });
      }
    }
  );

  router.get(
    '/v1/sessions/:sessionId/realization/package',
    authMiddleware('realization'),
    (req, res) => {
      const session = getSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ error: { code: 'session_not_found', message: 'Unknown session' } });
      }
      if (!session.package) {
        return res.status(404).json({ error: { code: 'package_not_ready', message: 'No package yet' } });
      }
      res.json(session.package);
    }
  );

  router.get(
    '/v1/sessions/:sessionId/realization/events',
    authMiddleware('realization'),
    (req, res) => {
      // Multiplex: same SSE bus as session events
      req.url = `/v1/sessions/${req.params.sessionId}/events`;
      // Re-use conversation SSE (same fan-out)
      const session = getSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ error: { code: 'session_not_found', message: 'Unknown session' } });
      }
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();
      res.write(`: lexiom14 realization sse\n\n`);
      addSseClient(session.session_id, res);
    }
  );

  router.get('/v1/artifacts/:artifactId', authMiddleware(['realization', 'embed']), (req, res) => {
    const rec = getArtifactRecord(req.params.artifactId);
    if (!rec || !rec._abs_path || !fs.existsSync(rec._abs_path)) {
      return res.status(404).json({ error: { code: 'not_found', message: 'Artifact not found' } });
    }
    setCorp(res);
    res.setHeader('Content-Type', rec.content_type || 'text/markdown; charset=utf-8');
    fs.createReadStream(rec._abs_path).pipe(res);
  });

  router.get('/v1/evidences/:evidenceId', authMiddleware(['realization', 'embed']), (req, res) => {
    const rec = getEvidenceRecord(req.params.evidenceId);
    if (!rec || !rec._abs_path || !fs.existsSync(rec._abs_path)) {
      return res.status(404).json({ error: { code: 'not_found', message: 'Evidence not found' } });
    }
    setCorp(res);
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    fs.createReadStream(rec._abs_path).pipe(res);
  });

  router.get('/v1/metering/events', authMiddleware('metering.read'), (req, res) => {
    const vertical = req.lexiom14.claims.vertical_id;
    const events = listLexiom14ConsumptionEvents(vertical, 200);
    res.json({ events });
  });

  return router;
}

export { corsAllowlist, applyLexiom14Cors };
