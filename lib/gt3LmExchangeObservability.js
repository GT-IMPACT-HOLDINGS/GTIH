/**
 * Provider-agnostic LM exchange capture for GT3 Ops.
 *
 * The exchange shape describes a CA → GT3 → LM crossing without binding the
 * observability plane to OpenRouter. Credentials and sensitive header-like
 * values are never written.
 * CA secondary name: Hanuman (devotee of Ram / the player; see lexiom13CaNaming.js).
 */
import fsp from 'fs/promises';
import path from 'path';

export const LM_EXCHANGE_SCHEMA = 'gt3-lm-exchange/1';
export const DEFAULT_LM_CAPTURE_MAX_CHARS = 2_000_000;

const SENSITIVE_KEY_RE =
  /^(authorization|proxy-authorization|cookie|set-cookie|password|secret|credential|token|access[-_]?token|refresh[-_]?token|auth[-_]?token|bearer[-_]?token|broker[-_]?token|api[-_]?key|.*[-_]api[-_]?key)$/i;
const SECRET_TEXT_PATTERNS = [
  [/\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi, 'Bearer [REDACTED]'],
  [/\bsk-(?:or-v1-)?[A-Za-z0-9_-]{12,}/g, '[REDACTED_API_KEY]'],
  [
    /\b(OPENROUTER_API_KEY|GT3_LEXIOM_AGENT_KEY|OPENAI_API_KEY)\s*[:=]\s*["']?[^"'\s,}]+/gi,
    '$1=[REDACTED]'
  ]
];

export function redactSensitiveText(value) {
  let text = String(value == null ? '' : value);
  for (const [pattern, replacement] of SECRET_TEXT_PATTERNS) {
    text = text.replace(pattern, replacement);
  }
  return text;
}

export function redactLmPacket(value, key = '') {
  if (SENSITIVE_KEY_RE.test(String(key))) return '[REDACTED]';
  if (typeof value === 'string') return redactSensitiveText(value);
  if (Array.isArray(value)) {
    return value.map((item) => redactLmPacket(item));
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      out[childKey] = redactLmPacket(childValue, childKey);
    }
    return out;
  }
  return value;
}

export function captureLmPacket(
  value,
  maxChars = DEFAULT_LM_CAPTURE_MAX_CHARS
) {
  const truncations = [];

  function visit(current, key, packetPath) {
    if (SENSITIVE_KEY_RE.test(String(key))) return '[REDACTED]';
    if (typeof current === 'string') {
      const redacted = redactSensitiveText(current);
      if (redacted.length <= maxChars) return redacted;
      truncations.push({
        path: packetPath,
        captured_chars: maxChars,
        original_chars: redacted.length
      });
      return redacted.slice(0, maxChars);
    }
    if (Array.isArray(current)) {
      return current.map((item, index) =>
        visit(item, '', `${packetPath}[${index}]`)
      );
    }
    if (current && typeof current === 'object') {
      const out = {};
      for (const [childKey, childValue] of Object.entries(current)) {
        out[childKey] = visit(
          childValue,
          childKey,
          `${packetPath}.${childKey}`
        );
      }
      return out;
    }
    return current;
  }

  return {
    packet: visit(value, '', '$'),
    truncations
  };
}

export function boundedText(value, maxChars = DEFAULT_LM_CAPTURE_MAX_CHARS) {
  const text = redactSensitiveText(value);
  if (text.length <= maxChars) {
    return { text, captured_chars: text.length, original_chars: text.length, truncated: false };
  }
  return {
    text: text.slice(0, maxChars),
    captured_chars: maxChars,
    original_chars: text.length,
    truncated: true
  };
}

export function summarizeMessages(messages) {
  const rows = Array.isArray(messages) ? messages : [];
  return rows.map((message, index) => {
    const content =
      typeof message?.content === 'string'
        ? message.content
        : JSON.stringify(message?.content ?? '');
    return {
      index,
      role: message?.role || 'unknown',
      name: message?.name || null,
      content_chars: content.length
    };
  });
}

export function extractAssistantContent(packet) {
  const content = packet?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (content == null) return '';
  return JSON.stringify(content);
}

export function extractAssistantContentFromSse(raw) {
  const chunks = [];
  for (const line of String(raw || '').split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue;
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') continue;
    try {
      const packet = JSON.parse(data);
      const content =
        packet?.choices?.[0]?.delta?.content ??
        packet?.choices?.[0]?.message?.content ??
        '';
      if (typeof content === 'string') chunks.push(content);
    } catch {
      /* Keep raw stream available even if one frame is malformed. */
    }
  }
  return chunks.join('');
}

export function createLmExchange({
  exchangeId,
  lane,
  runId,
  pass,
  pluginId,
  tenant,
  track,
  source,
  destination,
  model,
  stream,
  requestPacket,
  maxChars = DEFAULT_LM_CAPTURE_MAX_CHARS,
  createdAt = new Date().toISOString()
}) {
  const capturedRequest = captureLmPacket(requestPacket || {}, maxChars);
  const packet = capturedRequest.packet;
  const packetJson = JSON.stringify(packet);
  return {
    schema_version: LM_EXCHANGE_SCHEMA,
    exchange_id: exchangeId,
    lane: lane || 'agent_broker',
    created_at: createdAt,
    completed_at: null,
    route: {
      source: {
        kind: source?.kind || 'containerized_agent',
        ca_location: source?.ca_location || null,
        executor: source?.executor || null,
        run_id: runId || null,
        pass: pass || null,
        plugin_id: pluginId || null,
        tenant: tenant || null,
        track: track || null
      },
      gateway: { id: 'gt3', role: 'lm_control_plane' },
      destination: {
        id: destination?.id || 'unknown',
        label: destination?.label || destination?.id || 'Unknown LM',
        transport: destination?.transport || 'openai_compatible_http',
        locality: destination?.locality || 'remote',
        endpoint_kind: destination?.endpoint_kind || 'chat_completions'
      },
      model: model || null
    },
    request: {
      captured_at: createdAt,
      stream: !!stream,
      message_index: summarizeMessages(packet.messages),
      message_count: Array.isArray(packet.messages) ? packet.messages.length : 0,
      packet_chars: packetJson.length,
      truncations: capturedRequest.truncations,
      packet
    },
    response: null,
    outcome: { status: 'in_flight', ok: null },
    redaction: {
      applied: true,
      credential_headers_stored: false,
      note: 'Credential-shaped keys and values are redacted before persistence.'
    }
  };
}

export async function writeLmExchange(logDir, exchange) {
  const dir = exchangeDirectory(logDir, exchange.exchange_id);
  await fsp.mkdir(dir, { recursive: true });
  await writeJsonAtomic(path.join(dir, 'exchange.json'), exchange);
  return `/ops/agent-exchanges/${encodeURIComponent(exchange.exchange_id)}`;
}

export async function patchLmExchange(logDir, exchangeId, patch) {
  const file = exchangeFilePath(logDir, exchangeId);
  let current = {};
  try {
    current = JSON.parse(await fsp.readFile(file, 'utf8'));
  } catch {
    current = {
      schema_version: LM_EXCHANGE_SCHEMA,
      exchange_id: exchangeId,
      redaction: { applied: true, credential_headers_stored: false }
    };
  }
  const next = {
    ...current,
    ...redactLmPacket(patch || {})
  };
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await writeJsonAtomic(file, next);
  return next;
}

export async function readLmExchange(logDir, exchangeId) {
  if (!isValidExchangeId(exchangeId)) return null;
  try {
    const raw = await fsp.readFile(exchangeFilePath(logDir, exchangeId), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function isValidExchangeId(value) {
  return /^[a-f0-9-]{20,80}$/i.test(String(value || ''));
}

function exchangeDirectory(logDir, exchangeId) {
  return path.join(logDir, 'agent_broker', String(exchangeId));
}

function exchangeFilePath(logDir, exchangeId) {
  return path.join(exchangeDirectory(logDir, exchangeId), 'exchange.json');
}

async function writeJsonAtomic(file, value) {
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fsp.writeFile(temp, JSON.stringify(value, null, 2), 'utf8');
  await fsp.rename(temp, file);
}
