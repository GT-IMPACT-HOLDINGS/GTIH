import { promises as fsp } from 'fs';
import path from 'path';

export const SESSION_EVENTS_FILENAME = 'session_events.jsonl';
export const SESSION_EVENT_SCHEMA_V1 = 'lexiom_session_event.v1';

const ALLOWED_EVENT_TYPES = new Set([
  'l23_qa_turn',
  'l24_approved',
  'action_item_approved',
  'artifact_approved'
]);

/**
 * @param {object} body
 * @returns {{ ok: true } | { ok: false, detail: string }}
 */
export function validateSessionEventBody(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, detail: 'body must be a JSON object' };
  }
  if (body.schema_id !== SESSION_EVENT_SCHEMA_V1) {
    return { ok: false, detail: 'unsupported schema_id' };
  }
  if (!body.event_type || typeof body.event_type !== 'string') {
    return { ok: false, detail: 'event_type required' };
  }
  if (!ALLOWED_EVENT_TYPES.has(body.event_type)) {
    return { ok: false, detail: 'invalid event_type' };
  }
  if (!body.payload || typeof body.payload !== 'object') {
    return { ok: false, detail: 'payload object required' };
  }
  return { ok: true };
}

/**
 * @param {string} absDir - logs/<uuid>/
 */
export async function gameRecordDirHasSessionEvents(absDir) {
  const fp = path.join(absDir, SESSION_EVENTS_FILENAME);
  try {
    const st = await fsp.stat(fp);
    return st.isFile() && st.size > 0;
  } catch {
    return false;
  }
}

/**
 * Read and parse session_events.jsonl
 * @param {string} absDir
 * @returns {Promise<object[]>}
 */
export async function readSessionEvents(absDir) {
  const fp = path.join(absDir, SESSION_EVENTS_FILENAME);
  let raw = '';
  try {
    raw = await fsp.readFile(fp, 'utf-8');
  } catch {
    return [];
  }
  const events = [];
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      events.push(JSON.parse(t));
    } catch {
      /* skip bad line */
    }
  }
  return events;
}

/**
 * Group events for GT3 console (chronological order preserved in events array).
 * @param {object[]} events
 */
export function groupSessionEvents(events) {
  const l23_qa = [];
  const l24_approved = [];
  const action_items = [];
  const artifacts = [];

  for (const ev of events) {
    const t = ev && ev.event_type;
    const p = (ev && ev.payload) || {};
    if (t === 'l23_qa_turn') l23_qa.push(ev);
    else if (t === 'l24_approved') l24_approved.push(ev);
    else if (t === 'action_item_approved') action_items.push(ev);
    else if (t === 'artifact_approved') artifacts.push(ev);
  }

  return {
    l23_qa_turns: l23_qa,
    l24_approved: l24_approved,
    action_item_approved: action_items,
    artifact_approved: artifacts
  };
}

/**
 * Min/max event time from ts_server / ts_client (ISO strings for API consumers).
 * @param {object[]} events
 */
export function sessionEventTimeBounds(events) {
  if (!Array.isArray(events) || !events.length) {
    return { first_event_at: null, last_event_at: null };
  }
  let firstMs = null;
  let lastMs = null;
  for (const ev of events) {
    const raw = (ev && ev.ts_server) || (ev && ev.ts_client) || '';
    const t = Date.parse(String(raw));
    if (!Number.isFinite(t)) continue;
    if (firstMs === null || t < firstMs) firstMs = t;
    if (lastMs === null || t > lastMs) lastMs = t;
  }
  return {
    first_event_at: firstMs != null ? new Date(firstMs).toISOString() : null,
    last_event_at: lastMs != null ? new Date(lastMs).toISOString() : null
  };
}
