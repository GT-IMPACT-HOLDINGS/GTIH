/**
 * GT3 OpenAI-compatible agent broker → OpenRouter only (VAL Step 3).
 * Never calls Anthropic directly. Product `/inference` is a separate lane.
 *
 * Auth (first match): X-GT3-OpenRouter-Key → GT3_LEXIOM_AGENT_KEY → OPENROUTER_API_KEY
 * Model: always GT3_AGENT_OPENROUTER_MODEL (default anthropic/claude-haiku-4.5)
 */
import crypto from 'crypto';
import {
  boundedText,
  captureLmPacket,
  createLmExchange,
  DEFAULT_LM_CAPTURE_MAX_CHARS,
  extractAssistantContent,
  extractAssistantContentFromSse,
  patchLmExchange,
  redactLmPacket,
  writeLmExchange
} from './gt3LmExchangeObservability.js';

export const DEFAULT_AGENT_OPENROUTER_MODEL = 'anthropic/claude-haiku-4.5';

/**
 * @param {import('express').Request} req
 * @param {{
 *   agentKey: string,
 *   openrouterKey: string,
 *   agentModel: string,
 *   logDir: string,
 *   ledgerLog: (event: object) => Promise<void>,
 *   recordOpsEvent: (kind: string, headers?: object, extra?: object) => void,
 *   onComplete: (outcome: { ok: boolean, detail?: string | null }) => void,
 *   httpReferer?: string | null,
 *   destination?: {
 *     id: string, label: string, transport: string, locality: string,
 *     endpoint_kind: string, endpoint_url: string
 *   },
 *   observabilityMaxChars?: number
 * }} deps
 */
export async function handleAgentChatCompletions(req, res, deps) {
  const started = Date.now();
  const eventId = crypto.randomUUID();
  const runId =
    headerFirst(req, 'x-gt3-run-id', 'x-gt3-agent-run-id') ||
    (typeof req.body?.metadata?.run_id === 'string' ? req.body.metadata.run_id : null) ||
    null;
  const passRaw =
    headerFirst(req, 'x-gt3-agent-pass', 'x-gt3-pass') ||
    (typeof req.body?.metadata?.pass === 'string' ? req.body.metadata.pass : null) ||
    null;
  const pass =
    passRaw === 'builder' || passRaw === 'evidence' ? passRaw : passRaw ? String(passRaw) : null;
  const tenant = headerFirst(req, 'x-gt3-tenant') || null;
  const track = headerFirst(req, 'x-gt3-data-track') || null;

  const apiKey =
    headerFirst(req, 'x-gt3-openrouter-key') ||
    deps.agentKey ||
    deps.openrouterKey ||
    '';

  const model = deps.agentModel || DEFAULT_AGENT_OPENROUTER_MODEL;
  const wantStream = !!(req.body && req.body.stream === true);
  const destination = {
    id: deps.destination?.id || 'openrouter',
    label: deps.destination?.label || 'OpenRouter',
    transport: deps.destination?.transport || 'openai_compatible_http',
    locality: deps.destination?.locality || 'remote',
    endpoint_kind: deps.destination?.endpoint_kind || 'chat_completions',
    endpoint_url:
      deps.destination?.endpoint_url ||
      'https://openrouter.ai/api/v1/chat/completions'
  };
  const captureMaxChars =
    Number.isFinite(deps.observabilityMaxChars) && deps.observabilityMaxChars > 0
      ? deps.observabilityMaxChars
      : DEFAULT_LM_CAPTURE_MAX_CHARS;

  const baseMeta = {
    id: eventId,
    lane: 'agent_broker',
    run_id: runId,
    pass,
    plugin_id:
      headerFirst(req, 'x-gt3-plugin-id') ||
      (typeof req.body?.metadata?.plugin_id === 'string'
        ? req.body.metadata.plugin_id
        : null),
    upstream: destination.id,
    destination: destination.id,
    transport: destination.transport,
    destination_locality: destination.locality,
    model,
    tenant,
    track,
    stream: wantStream
  };

  // Rewrite model; strip control metadata before the packet crosses GT3.
  const outbound = {
    ...(req.body && typeof req.body === 'object' ? req.body : {}),
    model,
    stream: wantStream
  };
  const cacheSticky =
    headerFirst(req, 'x-gt3-cache-sticky') ||
    (typeof req.body?.metadata?.cache_sticky_key === 'string'
      ? req.body.metadata.cache_sticky_key
      : null);
  const buildPhase =
    headerFirst(req, 'x-gt3-build-phase') ||
    (typeof req.body?.metadata?.phase === 'string' ? req.body.metadata.phase : null);
  delete outbound.metadata;
  applyOptionalPromptCaching(outbound, {
    enabled: isPromptCachingEnabled(deps),
    stickyKey: cacheSticky,
    phase: buildPhase,
    runId
  });
  baseMeta.request_message_count = Array.isArray(outbound.messages)
    ? outbound.messages.length
    : 0;
  baseMeta.request_chars = JSON.stringify(redactLmPacket(outbound)).length;
  baseMeta.prompt_cache_enabled = isPromptCachingEnabled(deps);
  baseMeta.build_phase = buildPhase;
  baseMeta.cache_sticky_key = cacheSticky;

  const exchange = createLmExchange({
    exchangeId: eventId,
    lane: baseMeta.lane,
    runId,
    pass,
    pluginId: baseMeta.plugin_id,
    tenant,
    track,
    source: {
      kind: 'containerized_agent',
      ca_location: headerFirst(req, 'x-gt3-ca-location') || 'browser_session',
      executor: headerFirst(req, 'x-gt3-ca-executor') || null
    },
    destination,
    model,
    stream: wantStream,
    requestPacket: outbound,
    maxChars: captureMaxChars
  });
  const logUrl = await writeLmExchange(deps.logDir, exchange).catch(() => null);
  await deps.ledgerLog({
    ...baseMeta,
    event: 'agent_broker_request',
    ok: null,
    latency_ms: 0,
    upstream_status: null,
    detail: null,
    log_file: logUrl,
    log_url: logUrl
  });

  if (!apiKey) {
    const detail =
      'Agent broker requires GT3_LEXIOM_AGENT_KEY or OPENROUTER_API_KEY (or X-GT3-OpenRouter-Key).';
    await finishError({
      req,
      res,
      deps,
      baseMeta,
      started,
      detail,
      upstreamStatus: null,
      httpStatus: 503,
      logUrl
    });
    return;
  }

  if (!req.body || !Array.isArray(req.body.messages)) {
    const detail = 'Request body must include OpenAI-format messages[].';
    await finishError({
      req,
      res,
      deps,
      baseMeta,
      started,
      detail,
      upstreamStatus: null,
      httpStatus: 400,
      logUrl
    });
    return;
  }

  const orHeaders = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'X-Title': 'GT3 Agent Broker'
  };
  if (deps.httpReferer) {
    orHeaders['HTTP-Referer'] = deps.httpReferer;
  }
  if (isPromptCachingEnabled(deps) && cacheSticky) {
    // Best-effort sticky routing for cache reuse when OpenRouter supports it.
    orHeaders['X-GT3-Cache-Sticky'] = cacheSticky;
  }

  let upstream;
  try {
    upstream = await fetch(destination.endpoint_url, {
      method: 'POST',
      headers: orHeaders,
      body: JSON.stringify(outbound)
    });
  } catch (e) {
    const detail = `${destination.label} fetch failed: ${e && e.message ? e.message : String(e)}`;
    await finishError({
      req,
      res,
      deps,
      baseMeta,
      started,
      detail,
      upstreamStatus: null,
      httpStatus: 502,
      logUrl
    });
    return;
  }

  if (!upstream.ok) {
    const bodyText = await upstream.text().catch(() => '');
    const detail = `${destination.label} error status=${upstream.status}: ${safePreview(bodyText, 400)}`;
    await finishError({
      req,
      res,
      deps,
      baseMeta,
      started,
      detail,
      upstreamStatus: upstream.status,
      httpStatus: 502,
      upstreamBody: bodyText,
      logUrl
    });
    return;
  }

  if (wantStream) {
    res.status(200);
    res.setHeader(
      'Content-Type',
      upstream.headers.get('content-type') || 'text/event-stream; charset=utf-8'
    );
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    let capturedStream = '';
    let streamOriginalChars = 0;
    try {
      if (!upstream.body) {
        throw new Error(`${destination.label} returned empty stream body`);
      }
      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text =
          typeof value === 'string' ? value : decoder.decode(value, { stream: true });
        streamOriginalChars += text.length;
        if (capturedStream.length < captureMaxChars) {
          capturedStream += text.slice(0, captureMaxChars - capturedStream.length);
        }
        res.write(text);
      }
      res.end();
      const assistantContent = extractAssistantContentFromSse(capturedStream);
      baseMeta.response_chars = assistantContent.length;
      await patchLmExchange(deps.logDir, eventId, {
        response: {
          captured_at: new Date().toISOString(),
          format: 'openai_sse',
          upstream_status: upstream.status,
          assistant_content: assistantContent,
          raw_stream: capturedStream,
          captured_chars: capturedStream.length,
          original_chars: streamOriginalChars,
          truncated: streamOriginalChars > capturedStream.length
        }
      });
    } catch (e) {
      const detail = `Stream relay failed: ${e && e.message ? e.message : String(e)}`;
      await patchLmExchange(deps.logDir, eventId, {
        response: {
          captured_at: new Date().toISOString(),
          format: 'openai_sse',
          upstream_status: upstream.status,
          assistant_content: extractAssistantContentFromSse(capturedStream),
          raw_stream: capturedStream,
          captured_chars: capturedStream.length,
          original_chars: streamOriginalChars,
          truncated: streamOriginalChars > capturedStream.length,
          relay_error: detail
        }
      });
      if (!res.headersSent) {
        await finishError({
          req,
          res,
          deps,
          baseMeta,
          started,
          detail,
          upstreamStatus: upstream.status,
          httpStatus: 502,
          logUrl
        });
      } else {
        try {
          res.end();
        } catch {
          /* ignore */
        }
        await recordOutcome({
          deps,
          baseMeta,
          started,
          ok: false,
          detail,
          upstreamStatus: upstream.status,
          logUrl,
          eventName: 'agent_broker_error'
        });
      }
      return;
    }

    await recordOutcome({
      deps,
      baseMeta,
      started,
      ok: true,
      detail: null,
      upstreamStatus: upstream.status,
      logUrl,
      eventName: 'agent_broker_complete'
    });
    return;
  }

  // Non-streaming JSON
  let data;
  try {
    data = await upstream.json();
  } catch (e) {
    const detail = `${destination.label} JSON parse failed: ${e && e.message ? e.message : String(e)}`;
    await finishError({
      req,
      res,
      deps,
      baseMeta,
      started,
      detail,
      upstreamStatus: upstream.status,
      httpStatus: 502,
      logUrl
    });
    return;
  }

  const capturedResponse = captureLmPacket(data, captureMaxChars);
  const redactedResponse = capturedResponse.packet;
  const assistantContent = extractAssistantContent(redactedResponse);
  const boundedAssistant = boundedText(assistantContent, captureMaxChars);
  baseMeta.response_chars = assistantContent.length;
  const usage = redactedResponse?.usage || null;
  baseMeta.usage = usage;
  baseMeta.prompt_tokens = usage?.prompt_tokens ?? usage?.input_tokens ?? null;
  baseMeta.completion_tokens = usage?.completion_tokens ?? usage?.output_tokens ?? null;
  baseMeta.cached_tokens =
    usage?.prompt_tokens_details?.cached_tokens ??
    usage?.cached_tokens ??
    usage?.cache_read_input_tokens ??
    null;
  await patchLmExchange(deps.logDir, eventId, {
    response: {
      captured_at: new Date().toISOString(),
      format: 'openai_json',
      upstream_status: upstream.status,
      assistant_content: boundedAssistant.text,
      assistant_content_chars: boundedAssistant.original_chars,
      assistant_content_truncated: boundedAssistant.truncated,
      truncations: capturedResponse.truncations,
      finish_reason: redactedResponse?.choices?.[0]?.finish_reason || null,
      usage: redactedResponse?.usage || null,
      packet: redactedResponse
    }
  });

  await recordOutcome({
    deps,
    baseMeta,
    started,
    ok: true,
    detail: null,
    upstreamStatus: upstream.status,
    logUrl,
    eventName: 'agent_broker_complete'
  });

  res.status(200).json(data);
}

function headerFirst(req, ...names) {
  for (const n of names) {
    const v = req.get(n);
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return null;
}

function isPromptCachingEnabled(deps) {
  if (typeof deps.promptCachingEnabled === 'boolean') return deps.promptCachingEnabled;
  const raw = String(process.env.GT3_AGENT_PROMPT_CACHE || '')
    .trim()
    .toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

/**
 * Provider-capability adapter: mark stable system text for Anthropic-style
 * ephemeral prompt caching when enabled. No-op otherwise.
 */
export function applyOptionalPromptCaching(outbound, { enabled, stickyKey, phase, runId }) {
  if (!enabled || !outbound || !Array.isArray(outbound.messages)) return outbound;
  const messages = outbound.messages.map((message, index) => {
    if (index !== 0 || message?.role !== 'system') return message;
    const text =
      typeof message.content === 'string'
        ? message.content
        : Array.isArray(message.content)
          ? message.content
              .map((part) => (typeof part === 'string' ? part : part?.text || ''))
              .join('\n')
          : '';
    if (!text.trim()) return message;
    return {
      ...message,
      content: [
        {
          type: 'text',
          text,
          cache_control: { type: 'ephemeral' }
        }
      ]
    };
  });
  outbound.messages = messages;
  // Keep provider hints additive and optional; never required for correctness.
  if (stickyKey || runId || phase) {
    if (!outbound.provider || typeof outbound.provider !== 'object') {
      outbound.provider = {};
    }
  }
  return outbound;
}

function safePreview(text, max = 300) {
  if (!text) return '';
  const s = String(text);
  return s.length <= max ? s : s.slice(0, max) + '...';
}

async function recordOutcome({
  deps,
  baseMeta,
  started,
  ok,
  detail,
  upstreamStatus,
  logUrl,
  eventName
}) {
  const latency_ms = Date.now() - started;
  const completedAt = new Date().toISOString();
  await patchLmExchange(deps.logDir, baseMeta.id, {
    completed_at: completedAt,
    outcome: {
      status: ok ? 'completed' : 'error',
      ok,
      latency_ms,
      upstream_status: upstreamStatus,
      detail: detail || null
    }
  }).catch(() => null);
  const event = {
    ...baseMeta,
    event: eventName,
    ok,
    latency_ms,
    upstream_status: upstreamStatus,
    detail: detail || null,
    log_file: logUrl || null,
    log_url: logUrl || null
  };
  await deps.ledgerLog(event);
  deps.recordOpsEvent(ok ? 'agent_broker_ok' : 'agent_broker_error', {
    tenant: baseMeta.tenant,
    track: baseMeta.track
  });
  deps.onComplete({ ok, detail: detail || null });
}

async function finishError({
  req,
  res,
  deps,
  baseMeta,
  started,
  detail,
  upstreamStatus,
  httpStatus,
  upstreamBody,
  logUrl: existingLogUrl
}) {
  let logUrl = existingLogUrl || null;
  if (!logUrl) {
    logUrl = `/ops/agent-exchanges/${encodeURIComponent(baseMeta.id)}`;
  }
  const boundedUpstream = upstreamBody
    ? boundedText(upstreamBody, deps.observabilityMaxChars)
    : null;
  await patchLmExchange(deps.logDir, baseMeta.id, {
    response: {
      captured_at: new Date().toISOString(),
      format: upstreamBody ? 'upstream_error_text' : 'gt3_error',
      upstream_status: upstreamStatus,
      error: detail,
      raw_error_body: boundedUpstream ? boundedUpstream.text : null,
      captured_chars: boundedUpstream ? boundedUpstream.captured_chars : 0,
      original_chars: boundedUpstream ? boundedUpstream.original_chars : 0,
      truncated: boundedUpstream ? boundedUpstream.truncated : false
    }
  }).catch(() => null);
  await recordOutcome({
    deps,
    baseMeta,
    started,
    ok: false,
    detail,
    upstreamStatus,
    logUrl,
    eventName: 'agent_broker_error'
  });
  if (!res.headersSent) {
    res.status(httpStatus).json({
      error: {
        message: detail,
        type: 'agent_broker_error',
        code: upstreamStatus || httpStatus,
        param: null
      },
      // GT3 extras (non-secret) for operators / curl debugging
      gt3: {
        lane: 'agent_broker',
        upstream: baseMeta.upstream,
        model: baseMeta.model,
        run_id: baseMeta.run_id,
        pass: baseMeta.pass,
        log_url: logUrl
      }
    });
  }
}
