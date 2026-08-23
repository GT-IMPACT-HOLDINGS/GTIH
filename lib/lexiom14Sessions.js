/**
 * Lexiom 1.4 — in-memory session replicas + SSE fan-out.
 */
import crypto from 'crypto';
import { LEXIOM14_API_VERSION } from './lexiom14Auth.js';

/** @type {Map<string, object>} */
const sessions = new Map();

/** @type {Map<string, Set<import('express').Response>>} */
const sseClients = new Map();

export function createSessionId() {
  return 'sess_' + crypto.randomBytes(10).toString('hex');
}

export function provenanceId() {
  return 'prov_' + crypto.randomBytes(8).toString('hex');
}

/**
 * @param {object} init
 */
export function createSession(init) {
  const session_id = createSessionId();
  const now = new Date().toISOString();
  const session = {
    session_id,
    created_at: now,
    identity: init.identity || null,
    seed_snapshot: init.seed_snapshot || null,
    case_label: init.case_label || null,
    messages: [],
    structure: {
      nodes: [],
      hemispheres: {
        output_spec_ready: false,
        success_evidence_ready: false,
        output_spec_summary: '',
        success_evidence_summary: ''
      },
      revision: 'rev_0'
    },
    build_readiness: {
      ready: false,
      reasons: ['Awaiting a single outcome description (generateOsn)'],
      hemispheres: {
        output_spec_ready: false,
        success_evidence_ready: false
      }
    },
    status: 'accepted',
    osn: null,
    osn_yaml: null,
    osn_source: null,
    realization: null,
    package: null,
    event_seq: 0
  };
  sessions.set(session_id, session);
  return session;
}

export function getSession(sessionId) {
  return sessions.get(sessionId) || null;
}

export function conversationState(session) {
  return {
    session_id: session.session_id,
    messages: session.messages,
    structure: session.structure,
    build_readiness: session.build_readiness,
    status: session.status,
    osn_yaml: session.osn_yaml || null
  };
}

/**
 * @param {string} sessionId
 * @param {string} type
 * @param {object} payload
 */
export function emitSessionEvent(sessionId, type, payload) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  session.event_seq += 1;
  const envelope = {
    api_version: LEXIOM14_API_VERSION,
    type,
    session_id: sessionId,
    occurred_at: new Date().toISOString(),
    provenance_id: provenanceId(),
    payload,
    id: String(session.event_seq)
  };
  const set = sseClients.get(sessionId);
  if (set) {
    const data = `id: ${envelope.id}\ndata: ${JSON.stringify(envelope)}\n\n`;
    for (const res of set) {
      try {
        res.write(data);
      } catch {
        set.delete(res);
      }
    }
  }
  return envelope;
}

/**
 * @param {string} sessionId
 * @param {import('express').Response} res
 */
export function addSseClient(sessionId, res) {
  if (!sseClients.has(sessionId)) sseClients.set(sessionId, new Set());
  sseClients.get(sessionId).add(res);
  res.on('close', () => {
    const set = sseClients.get(sessionId);
    if (set) {
      set.delete(res);
      if (!set.size) sseClients.delete(sessionId);
    }
  });
}

export function bumpStructureRevision(session) {
  const n = Number(String(session.structure.revision).replace(/\D/g, '') || '0') + 1;
  session.structure.revision = 'rev_' + n;
}
