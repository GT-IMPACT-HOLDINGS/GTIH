/**
 * Lexiom 1.3 — Option E evidence collection.
 * Compact target metadata + SUD → one (or section-batched) LM call returning quote spans;
 * host slices the SUD and writes evidences/ + EVIDENCE_MANIFEST.json.
 * No host-heuristic fallback: invalid / missing spans fail the evidence pass (except
 * non-span kinds which are recorded as deferred).
 *
 * Specs: Build Plugin Contract §8; VAL evidence hemisphere.
 */

import { promises as fsp } from 'fs';
import path from 'path';
import {
  EVIDENCE_ARTIFACTS_DIR,
  EVIDENCE_MANIFEST_FILENAME,
  EVIDENCE_MANIFEST_SCHEMA,
  EVIDENCE_PLAN_FILENAME,
  canonicalizeEvidenceKind,
  loadEvidencePlanFromBuildDir,
  validateEvidenceManifestAfterSync
} from './lexiom13BuildEvidence.js';
import { DEFAULT_AGENT_OPENROUTER_MODEL } from './gt3AgentOpenAiProxy.js';
import { BUILD_PLAN_FILENAME } from './lexiom13BuildContextPack.js';
import { primaryArtifactForPlugin } from './lexiom13CaPolicy.js';

const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
/** Soft budget before section-batching the SUD (UTF-16 code units ≈ JS string length). */
const MAX_SINGLE_PACKET_CHARS = 110_000;
const SPAN_KINDS = new Set(['TEXTUAL_SNIPPET']);

/**
 * @param {object} handoff
 * @param {{
 *   completeChat?: (args: { messages: object[], model?: string, max_tokens?: number, metadata?: object }) => Promise<object>,
 *   apiKey?: string,
 *   model?: string
 * }} [opts]
 */
export async function collectEvidenceByQuoteSpans(handoff, opts = {}) {
  const outDir = handoff.output_directory;
  if (!outDir) {
    return { ok: false, reason: 'evidence_span_no_outdir', detail: 'Missing handoff.output_directory' };
  }

  let plan;
  try {
    plan = await loadEvidencePlanFromBuildDir(outDir);
  } catch (error) {
    return {
      ok: false,
      reason: 'evidence_plan_missing',
      detail: error?.message || 'EVIDENCE_PLAN.json missing'
    };
  }

  const targets = Array.isArray(plan.targets) ? plan.targets : [];
  if (targets.length === 0) {
    return { ok: true, summary: { total: 0, collected: 0, deferred: 0 }, detail: 'No evidence targets' };
  }

  const sudPath = primaryArtifactForPlugin(handoff.plugin_id);
  let sudText;
  try {
    sudText = await fsp.readFile(path.join(outDir, sudPath), 'utf8');
  } catch {
    return {
      ok: false,
      reason: 'evidence_sud_missing',
      detail: `SUD missing for span extraction: ${sudPath}`
    };
  }
  if (!String(sudText).trim()) {
    return {
      ok: false,
      reason: 'evidence_sud_empty',
      detail: `SUD empty: ${sudPath}`
    };
  }

  const buildPlan = await readJsonIfExists(path.join(outDir, BUILD_PLAN_FILENAME));
  const sectionOffsets = await buildSectionOffsetsInSud(outDir, sudText, buildPlan);
  const metaTargets = [];
  const deferredEntries = [];

  for (const target of targets) {
    const kind = canonicalizeEvidenceKind(target.kind) || String(target.kind || '');
    if (!SPAN_KINDS.has(kind)) {
      deferredEntries.push(
        manifestEntry(target, {
          status: 'deferred',
          notes: `Kind ${kind || '(empty)'} is outside quote-span extraction (Option E); human capture required.`,
          collected_by: 'host_span'
        })
      );
      continue;
    }
    const hint = await loadHintForTarget(outDir, target);
    const preferred = preferredWindowForOsn(target.osn_id, buildPlan, sectionOffsets);
    metaTargets.push({
      target_id: target.target_id,
      osn_id: target.osn_id,
      evidence_id: target.evidence_id,
      kind,
      direct: target.direct === true,
      hint,
      preferred_window: preferred,
      expected_relative_path: target.expected_relative_path
    });
  }

  /** @type {Map<string, { start: number, end: number }>} */
  const spanByTarget = new Map();
  let lmBatchCount = 0;

  if (metaTargets.length > 0) {
    const batches = planSpanBatches(sudText, metaTargets, sectionOffsets);
    lmBatchCount = batches.length;
    const completeChat = opts.completeChat || testCompleteChat || defaultOpenRouterComplete;
    for (const batch of batches) {
      const lm = await completeChat({
        messages: buildSpanPromptMessages({
          sudPath,
          sudText: batch.sudText,
          sudCharBase: batch.sudCharBase,
          targets: batch.targets
        }),
        model: opts.model,
        max_tokens: Math.min(8000, 800 + batch.targets.length * 80),
        apiKey: opts.apiKey,
        metadata: {
          run_id: handoff.run_id,
          pass: 'evidence',
          plugin_id: handoff.plugin_id,
          evidence_mode: 'quote_spans'
        }
      });
      if (!lm.ok) {
        return {
          ok: false,
          reason: lm.reason || 'evidence_span_lm_failed',
          detail: lm.detail || 'Quote-span LM call failed'
        };
      }
      const parsed = parseSpanResponse(lm.content);
      if (!parsed.ok) {
        return {
          ok: false,
          reason: parsed.reason,
          detail: parsed.detail
        };
      }
      for (const quote of parsed.quotes) {
        spanByTarget.set(String(quote.target_id), {
          start: Number(quote.start) + batch.sudCharBase,
          end: Number(quote.end) + batch.sudCharBase
        });
      }
    }
  }

  const collectedEntries = [];
  const missing = [];
  await fsp.mkdir(path.join(outDir, EVIDENCE_ARTIFACTS_DIR), { recursive: true });

  for (const target of metaTargets) {
    const span = spanByTarget.get(String(target.target_id));
    if (!span) {
      missing.push(target.target_id);
      continue;
    }
    const start = Math.floor(Number(span.start));
    const end = Math.floor(Number(span.end));
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      end > sudText.length ||
      end <= start
    ) {
      return {
        ok: false,
        reason: 'evidence_span_invalid',
        detail: `Invalid span for ${target.target_id}: [${start}, ${end}) sudLen=${sudText.length}`
      };
    }
    const excerpt = sudText.slice(start, end);
    if (!excerpt.trim()) {
      return {
        ok: false,
        reason: 'evidence_span_empty',
        detail: `Empty excerpt for ${target.target_id}`
      };
    }
    const rel = String(target.expected_relative_path || '').replace(/\\/g, '/');
    if (!rel.startsWith(`${EVIDENCE_ARTIFACTS_DIR}/`)) {
      return {
        ok: false,
        reason: 'evidence_path_invalid',
        detail: `expected_relative_path must be under evidences/: ${rel}`
      };
    }
    const abs = path.join(outDir, ...rel.split('/'));
    await fsp.mkdir(path.dirname(abs), { recursive: true });
    const body = formatExcerptArtifact(excerpt, { start, end, sudPath });
    await fsp.writeFile(abs, body, 'utf8');
    collectedEntries.push(
      manifestEntry(target, {
        status: 'collected',
        artifact_paths: [rel],
        source_artifact_paths: [sudPath],
        notes: `host_span [${start},${end})`,
        collected_by: 'host_span'
      })
    );
  }

  if (missing.length) {
    return {
      ok: false,
      reason: 'evidence_span_incomplete',
      detail: `LM omitted spans for: ${missing.slice(0, 12).join(', ')}${missing.length > 12 ? '…' : ''}`
    };
  }

  const manifest = {
    schema_version: EVIDENCE_MANIFEST_SCHEMA,
    run_id: handoff.run_id || plan.run_id || null,
    plugin_id: handoff.plugin_id || plan.plugin_id || null,
    collected_at: new Date().toISOString(),
    collection_mode: 'quote_spans',
    sud_path: sudPath,
    entries: [...collectedEntries, ...deferredEntries]
  };
  await fsp.writeFile(
    path.join(outDir, EVIDENCE_MANIFEST_FILENAME),
    JSON.stringify(manifest, null, 2),
    'utf8'
  );

  const gate = await validateEvidenceManifestAfterSync(outDir, { canonicalDir: outDir });
  if (!gate.ok) {
    return {
      ok: false,
      reason: gate.reason || 'evidence_coverage_incomplete',
      detail: gate.detail || 'Span collection failed host validation'
    };
  }

  return {
    ok: true,
    summary: {
      total: targets.length,
      span_targets: metaTargets.length,
      collected: collectedEntries.length,
      deferred: deferredEntries.length,
      lm_batches: lmBatchCount
    },
    detail: `Evidence quote-span collection complete (${collectedEntries.length} collected, ${deferredEntries.length} deferred).`
  };
}

/** @type {null | ((args: object) => Promise<object>)} */
let testCompleteChat = null;

/** Test-only hook for host quote-span LM calls. Pass null to clear. */
export function setEvidenceSpanCompleteChatForTests(fn) {
  testCompleteChat = typeof fn === 'function' ? fn : null;
}

export function buildCompactEvidenceMetadata({ sudPath, sudText, targets }) {
  return {
    sud_path: sudPath,
    sud_char_count: sudText.length,
    encoding: 'js_utf16_code_units',
    targets
  };
}

export function buildSpanPromptMessages({ sudPath, sudText, sudCharBase = 0, targets }) {
  const meta = buildCompactEvidenceMetadata({
    sudPath,
    sudText,
    targets: targets.map((t) => ({
      target_id: t.target_id,
      osn_id: t.osn_id,
      evidence_id: t.evidence_id,
      kind: t.kind,
      direct: t.direct,
      hint: t.hint,
      preferred_window: t.preferred_window
        ? {
            section_path: t.preferred_window.section_path || null,
            // Offsets relative to the SUD slice in this packet
            sud_char_start:
              t.preferred_window.sud_char_start == null
                ? null
                : Math.max(0, t.preferred_window.sud_char_start - sudCharBase),
            sud_char_end:
              t.preferred_window.sud_char_end == null
                ? null
                : Math.max(0, t.preferred_window.sud_char_end - sudCharBase)
          }
        : null
    }))
  });

  const system = [
    'You select verbatim quote spans inside a System Under Development (SUD) document.',
    'Return ONLY JSON (no markdown fences) with shape:',
    '{ "quotes": [ { "target_id": string, "start": number, "end": number } ] }',
    'Offsets are 0-based half-open [start, end) into the SUD text provided in the user message,',
    'counted as JavaScript string length (UTF-16 code units).',
    'Rules:',
    '- Every target_id in the metadata must appear exactly once in quotes[].',
    '- Excerpt must be contiguous verbatim SUD text; never invent or paraphrase.',
    '- Prefer preferred_window when present; otherwise use hint against the whole SUD slice.',
    '- Prefer a short readable paragraph or section (roughly 40–800 characters) when possible.',
    '- Do not quote OSN ids, schema field names, or build-process vocabulary.'
  ].join('\n');

  const user = [
    `## Compact evidence metadata\n${JSON.stringify(meta, null, 2)}`,
    '',
    `## SUD (${sudPath}) — length ${sudText.length} (offsets relative to this block; absolute base ${sudCharBase})`,
    sudText
  ].join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];
}

export function parseSpanResponse(content) {
  const raw = String(content || '').trim();
  if (!raw) {
    return { ok: false, reason: 'evidence_span_empty_response', detail: 'LM returned empty content' };
  }
  let jsonText = raw;
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) jsonText = fence[1].trim();
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    const start = jsonText.indexOf('{');
    const end = jsonText.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        parsed = JSON.parse(jsonText.slice(start, end + 1));
      } catch (error) {
        return {
          ok: false,
          reason: 'evidence_span_parse_failed',
          detail: error?.message || 'Could not parse span JSON'
        };
      }
    } else {
      return {
        ok: false,
        reason: 'evidence_span_parse_failed',
        detail: 'Could not parse span JSON'
      };
    }
  }
  const quotes = Array.isArray(parsed?.quotes) ? parsed.quotes : null;
  if (!quotes) {
    return {
      ok: false,
      reason: 'evidence_span_parse_failed',
      detail: 'Response JSON missing quotes[]'
    };
  }
  return { ok: true, quotes };
}

function planSpanBatches(sudText, metaTargets, sectionOffsets) {
  const packetChars =
    sudText.length + JSON.stringify(metaTargets).length + 4000;
  if (packetChars <= MAX_SINGLE_PACKET_CHARS || sectionOffsets.length === 0) {
    return [
      {
        sudText,
        sudCharBase: 0,
        targets: metaTargets
      }
    ];
  }

  /** @type {Array<{ sudText: string, sudCharBase: number, targets: object[] }>} */
  const batches = [];
  for (const section of sectionOffsets) {
    const inSection = metaTargets.filter((t) => {
      const w = t.preferred_window;
      if (!w || w.sud_char_start == null) return false;
      return w.sud_char_start >= section.start && w.sud_char_start < section.end;
    });
    if (!inSection.length) continue;
    batches.push({
      sudText: sudText.slice(section.start, section.end),
      sudCharBase: section.start,
      targets: inSection
    });
  }
  const assigned = new Set(batches.flatMap((b) => b.targets.map((t) => t.target_id)));
  const rest = metaTargets.filter((t) => !assigned.has(t.target_id));
  if (rest.length) {
    // Root / unmapped targets: full SUD (may be large; still required — no heuristic fallback).
    batches.push({ sudText, sudCharBase: 0, targets: rest });
  }
  return batches.length ? batches : [{ sudText, sudCharBase: 0, targets: metaTargets }];
}

async function buildSectionOffsetsInSud(outDir, sudText, buildPlan) {
  const sectionFiles = Array.isArray(buildPlan?.section_files) ? buildPlan.section_files : [];
  if (!sectionFiles.length) return [];
  const offsets = [];
  let cursor = 0;
  for (const section of sectionFiles) {
    const rel = String(section.path || '').replace(/\\/g, '/');
    let start = -1;
    try {
      const body = await fsp.readFile(path.join(outDir, ...rel.split('/')), 'utf8');
      const needle = String(body || '').trim();
      if (needle) {
        const idx = sudText.indexOf(needle, cursor);
        if (idx >= 0) start = idx;
      }
    } catch {
      // fall through to heading search
    }
    if (start < 0) {
      const title = String(section.title || section.cluster_id || '').trim();
      start = cursor;
      if (title) {
        const heading = `# ${title}`;
        const idx = sudText.indexOf(heading, cursor);
        if (idx >= 0) start = idx;
      }
    }
    offsets.push({
      cluster_id: section.cluster_id,
      section_path: rel,
      start,
      end: sudText.length
    });
    cursor = Math.max(cursor, start + 1);
  }
  for (let i = 0; i < offsets.length; i++) {
    offsets[i].end = i + 1 < offsets.length ? offsets[i + 1].start : sudText.length;
  }
  return offsets;
}

function preferredWindowForOsn(osnId, buildPlan, sectionOffsets) {
  const fill = Array.isArray(buildPlan?.fill_clusters) ? buildPlan.fill_clusters : [];
  const id = String(osnId || '');
  for (let i = 0; i < fill.length; i++) {
    const cluster = fill[i];
    const members = Array.isArray(cluster.member_osn_ids) ? cluster.member_osn_ids : [];
    if (cluster.head_osn_id === id || members.includes(id)) {
      const off =
        sectionOffsets.find((s) => s.cluster_id === cluster.cluster_id) || sectionOffsets[i];
      if (!off) {
        return {
          section_path: buildPlan?.section_files?.[i]?.path || null,
          sud_char_start: null,
          sud_char_end: null
        };
      }
      return {
        section_path: off.section_path || buildPlan?.section_files?.[i]?.path || null,
        sud_char_start: off.start,
        sud_char_end: off.end
      };
    }
  }
  return null;
}

async function loadHintForTarget(outDir, target) {
  const snap = String(target.snapshot_path || '').replace(/\\/g, '/');
  if (!snap) {
    return String(target.evidence_id || target.target_id || '');
  }
  try {
    const raw = await fsp.readFile(path.join(outDir, ...snap.split('/')), 'utf8');
    if (snap.endsWith('.json')) {
      const node = JSON.parse(raw);
      const osn = node.osn || node;
      const seed = String(osn.seed || '').replace(/\s+/g, ' ').trim();
      const title = String(osn.title || '').trim();
      const evidences = Array.isArray(osn.success_evidences) ? osn.success_evidences : [];
      const match = evidences.find(
        (e) => String(e.evidence_id || '').trim() === String(target.evidence_id || '').trim()
      );
      const prompt = String(match?.inspection_prompt || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 280);
      const parts = [title, seed.slice(0, 220), prompt].filter(Boolean);
      return parts.join(' — ').slice(0, 400);
    }
    // YAML snapshot: use evidence_id only (avoid pulling full bodies).
    return String(target.evidence_id || target.target_id || '');
  } catch {
    return String(target.evidence_id || target.target_id || '');
  }
}

function formatExcerptArtifact(excerpt, { start, end, sudPath }) {
  const trimmed = excerpt.replace(/^\s+/, '').replace(/\s+$/, '');
  return [
    '<!-- lexiom13-evidence-span host_slice -->',
    `<!-- source: ${sudPath} [${start},${end}) -->`,
    '',
    trimmed,
    ''
  ].join('\n');
}

function manifestEntry(target, extra) {
  return {
    target_id: target.target_id,
    osn_id: target.osn_id,
    evidence_id: target.evidence_id,
    direct: target.direct === true,
    kind: canonicalizeEvidenceKind(target.kind) || target.kind,
    status: extra.status,
    artifact_paths: extra.artifact_paths || [],
    source_artifact_paths: extra.source_artifact_paths || [],
    notes: extra.notes || null,
    collected_by: extra.collected_by || 'host_span'
  };
}

async function readJsonIfExists(abs) {
  try {
    return JSON.parse(await fsp.readFile(abs, 'utf8'));
  } catch {
    return null;
  }
}

async function defaultOpenRouterComplete({ messages, model, max_tokens, apiKey, metadata }) {
  const key =
    apiKey ||
    process.env.GT3_LEXIOM_AGENT_KEY ||
    process.env.OPENROUTER_API_KEY ||
    '';
  if (!key) {
    return {
      ok: false,
      reason: 'evidence_span_no_key',
      detail: 'Agent broker key missing (GT3_LEXIOM_AGENT_KEY or OPENROUTER_API_KEY)'
    };
  }
  const resolvedModel = model || process.env.GT3_AGENT_OPENROUTER_MODEL || DEFAULT_AGENT_OPENROUTER_MODEL;
  const res = await fetch(OPENROUTER_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://gt3.local',
      'X-Title': 'GT3 Lexiom evidence quote-spans'
    },
    body: JSON.stringify({
      model: resolvedModel,
      temperature: 0,
      max_tokens: max_tokens || 4000,
      messages,
      metadata: metadata || undefined
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail =
      typeof data?.error === 'object'
        ? data.error.message || JSON.stringify(data.error)
        : data?.error || data?.message || `OpenRouter HTTP ${res.status}`;
    return {
      ok: false,
      reason: 'evidence_span_lm_failed',
      detail: `OpenRouter error status=${res.status}: ${detail}`
    };
  }
  const content = data?.choices?.[0]?.message?.content;
  return { ok: true, content: content == null ? '' : String(content), raw: data };
}
