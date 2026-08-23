/**
 * Lexiom 1.4 — append-only consumption events (POC metering).
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const STORE_PATH = path.join(ROOT, 'logs', 'lexiom14_consumption.jsonl');

function ensureDir() {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
}

/**
 * @param {object} partial
 */
export function appendLexiom14ConsumptionEvent(partial) {
  ensureDir();
  const event = {
    schema: 'gtih_consumption_event.v1',
    event_id: 'mtr_' + crypto.randomBytes(8).toString('hex'),
    occurred_at: new Date().toISOString(),
    service: partial.service,
    session_id: partial.session_id,
    vertical_id: partial.vertical_id,
    tenant_pseudonym: partial.tenant_pseudonym,
    app_id: partial.app_id,
    env: partial.env,
    actor_pseudonym: partial.actor_pseudonym,
    measurement: partial.measurement || { unit: 'call', quantity: 1 },
    provenance_id: partial.provenance_id || null,
    tariff_stub: partial.tariff_stub || 'poc.unmetered',
    ip_assets: partial.ip_assets || ['lexiom14.capability'],
    hmac_note: 'poc_unsigned'
  };
  fs.appendFileSync(STORE_PATH, JSON.stringify(event) + '\n', 'utf8');
  return event;
}

/**
 * @param {string} verticalId
 * @param {number} [limit]
 */
export function listLexiom14ConsumptionEvents(verticalId, limit = 100) {
  ensureDir();
  if (!fs.existsSync(STORE_PATH)) return [];
  const lines = fs.readFileSync(STORE_PATH, 'utf8').split('\n').filter(Boolean);
  const out = [];
  for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
    try {
      const ev = JSON.parse(lines[i]);
      if (!verticalId || ev.vertical_id === verticalId) out.push(ev);
    } catch {
      /* skip */
    }
  }
  return out;
}
