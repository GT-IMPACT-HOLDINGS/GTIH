/**
 * Lexiom 1.3 / GTIH — propose OSNG from SUD intent via browser Hanuman (CA).
 * SDK: gtih.osng.proposeFromIntent → POST /lexiom13/osn/propose (async start)
 *      gtih.osng.getProposeStatus → GET /lexiom13/osn/propose/status/:runId
 *
 * Labor: browser WebContainer CA (plugin lexiom13.osng_proposer) writes OSNG_PROPOSAL.json.
 * Draft only — never writes Lexiom_1_3 YAML / prepare / realize.
 */

import crypto from 'crypto';
import fsp from 'fs/promises';
import path from 'path';
import {
  issueCaJobTicket,
  dispatchCaJob,
  applySessionReport,
  BUILDER_TIMEOUT_MS,
  CA_LOCATION_BROWSER_SESSION,
  EXECUTOR_ID
} from './lexiom13CaDispatcher.js';
import { getCaSession } from './lexiom13CaSessionRegistry.js';
import { primaryArtifactForPlugin } from './lexiom13CaPolicy.js';

export const OSNG_PROPOSER_PLUGIN_ID = 'lexiom13.osng_proposer';
export const OSNG_PROPOSAL_PRIMARY = 'OSNG_PROPOSAL.json';

const pendingProposeJobs = new Map();

function httpError(statusCode, message, debug) {
  const err = new Error(message);
  err.statusCode = statusCode;
  if (debug && typeof debug === 'object') {
    err.debug = debug;
  }
  return err;
}

function clip(text, n) {
  const s = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '…';
}

function slugFromText(text) {
  const slug = String(text || 'outcome')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return slug || 'outcome';
}

function uniqueId() {
  return crypto.randomBytes(4).toString('hex');
}

function makeRunId() {
  return `${Date.now().toString(36)}_${uniqueId()}`;
}

export function buildNaiveSingleOsn(intent) {
  const desc = String(intent || '').trim();
  const id = `draft.${slugFromText(desc)}.${uniqueId()}.osn`;
  return {
    schema_version: 'osn/0.2',
    id,
    file_name: id,
    node_type: 'document',
    title: clip(desc, 80) || 'Untitled SUD',
    owner: {
      owner_id: 'draft',
      display_name: 'Draft proposer',
      role: 'Proposal owner'
    },
    graph: {
      parent_osn_ids: [],
      child_osn_ids: [],
      standard_ancestor_osn_ids: [],
      derived_from_lens_id: null
    },
    seed: desc,
    thematic_lenses: [
      {
        lens_id: 'lens.outcome.intent',
        name: 'Outcome Intent',
        description: 'Reads the SUD-describing narrative as the primary intention.',
        purpose: 'Reads the SUD-describing narrative as the primary intention.'
      }
    ],
    output_spec: [
      'Deliver a System Under Development (SUD) that realizes the following outcome:',
      '',
      desc,
      '',
      'A human must be able to inspect the delivered artifact and judge whether the outcome holds.'
    ].join('\n'),
    success_evidences: [
      {
        evidence_id: 'ev.direct.textual_snippet.1',
        kind: 'TEXTUAL_SNIPPET',
        direct: true,
        inspection_prompt:
          'Open the primary deliverable. Confirm the opening prose names the intended outcome from the seed and is readable enough for human approval as direct Success Evidence.'
      }
    ],
    compilation: {
      can_be_compilation_root: true,
      compilation_scope: 'self_only',
      target_tool_profile: 'document_agent'
    }
  };
}

/**
 * Coerce free-form / alternate lens drafts into Lexiom shape:
 * { lens_id, name, description, purpose? }
 */
export function normalizeThematicLenses(rawLenses, intent) {
  const fallback = buildNaiveSingleOsn(intent).thematic_lenses;
  if (!Array.isArray(rawLenses) || rawLenses.length === 0) {
    return fallback;
  }
  const out = [];
  rawLenses.forEach((item, index) => {
    if (typeof item === 'string' && item.trim()) {
      const name = item.trim();
      const slug = slugFromText(name);
      out.push({
        lens_id: `lens.${slug}`,
        name,
        description: `Perspective: ${name}`,
        purpose: `Perspective: ${name}`
      });
      return;
    }
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const name =
      (typeof item.name === 'string' && item.name.trim()) ||
      (typeof item.title === 'string' && item.title.trim()) ||
      (typeof item.label === 'string' && item.label.trim()) ||
      `Lens ${index + 1}`;
    const prose =
      (typeof item.description === 'string' && item.description.trim()) ||
      (typeof item.purpose === 'string' && item.purpose.trim()) ||
      (typeof item.summary === 'string' && item.summary.trim()) ||
      `Perspective: ${name}`;
    const lens_id =
      (typeof item.lens_id === 'string' && item.lens_id.trim()) ||
      `lens.${slugFromText(name)}`;
    out.push({
      lens_id,
      name,
      description: prose,
      purpose: typeof item.purpose === 'string' && item.purpose.trim() ? item.purpose.trim() : prose
    });
  });
  return out.length ? out : fallback;
}

/**
 * Coerce free-form / alternate evidence drafts into Lexiom shape:
 * { evidence_id, kind, direct, inspection_prompt }
 */
export function normalizeSuccessEvidences(rawEvidences, intent) {
  const fallback = buildNaiveSingleOsn(intent).success_evidences;
  if (!Array.isArray(rawEvidences) || rawEvidences.length === 0) {
    return fallback;
  }
  const out = [];
  rawEvidences.forEach((item, index) => {
    if (typeof item === 'string' && item.trim()) {
      out.push({
        evidence_id: `ev.direct.textual_snippet.${index + 1}`,
        kind: 'TEXTUAL_SNIPPET',
        direct: true,
        inspection_prompt: item.trim()
      });
      return;
    }
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;

    const kindRaw =
      (typeof item.kind === 'string' && item.kind.trim()) ||
      (typeof item.type === 'string' && item.type.trim()) ||
      'TEXTUAL_SNIPPET';
    const kind = String(kindRaw).toUpperCase().replace(/\s+/g, '_');

    const promptParts = [];
    if (typeof item.inspection_prompt === 'string' && item.inspection_prompt.trim()) {
      promptParts.push(item.inspection_prompt.trim());
    } else {
      if (typeof item.description === 'string' && item.description.trim()) {
        promptParts.push(item.description.trim());
      }
      if (typeof item.snippet === 'string' && item.snippet.trim()) {
        promptParts.push(
          `Confirm the primary deliverable contains this contiguous excerpt (or equivalent): ${item.snippet.trim()}`
        );
      }
      if (typeof item.quote === 'string' && item.quote.trim()) {
        promptParts.push(
          `Confirm the primary deliverable contains this quote: ${item.quote.trim()}`
        );
      }
    }
    const inspection_prompt =
      promptParts.join(' ').trim() ||
      'Open the primary deliverable and confirm the intended outcome from the seed is inspectable as direct Success Evidence.';

    const evidence_id =
      (typeof item.evidence_id === 'string' && item.evidence_id.trim()) ||
      (typeof item.id === 'string' && item.id.trim()) ||
      `ev.direct.${slugFromText(kind)}.${index + 1}`;

    const direct =
      typeof item.direct === 'boolean' ? item.direct : true;

    out.push({
      evidence_id,
      kind,
      direct,
      inspection_prompt
    });
  });
  return out.length ? out : fallback;
}

export function normalizeDraftOsn(raw, intent) {
  const fallback = buildNaiveSingleOsn(intent);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return fallback;
  }
  const id =
    typeof raw.id === 'string' && raw.id.trim()
      ? String(raw.id).trim()
      : fallback.id;
  const title =
    typeof raw.title === 'string' && raw.title.trim()
      ? String(raw.title).trim()
      : fallback.title;
  const seed =
    typeof raw.seed === 'string' && raw.seed.trim()
      ? String(raw.seed).trim()
      : fallback.seed;
  const output_spec =
    typeof raw.output_spec === 'string' && raw.output_spec.trim()
      ? String(raw.output_spec).trim()
      : fallback.output_spec;
  const thematic_lenses = normalizeThematicLenses(raw.thematic_lenses, intent);
  const success_evidences = normalizeSuccessEvidences(raw.success_evidences, intent);

  return {
    ...fallback,
    ...raw,
    schema_version: 'osn/0.2',
    id,
    file_name: typeof raw.file_name === 'string' ? raw.file_name : id,
    title,
    seed,
    output_spec,
    thematic_lenses,
    success_evidences,
    graph: {
      parent_osn_ids: Array.isArray(raw.graph?.parent_osn_ids)
        ? raw.graph.parent_osn_ids
        : [],
      child_osn_ids: Array.isArray(raw.graph?.child_osn_ids)
        ? raw.graph.child_osn_ids
        : [],
      standard_ancestor_osn_ids: [],
      derived_from_lens_id: null
    }
  };
}

/**
 * Parse OSNG_PROPOSAL.json content into a public envelope.
 * Hard-fails on malformed JSON / missing nodes (no silent deterministic draft).
 */
export function envelopeFromOsngProposalFile(content, intent, metaHints = {}) {
  let parsed;
  try {
    parsed = JSON.parse(String(content || ''));
  } catch (e) {
    throw httpError(502, 'osng_proposal_not_json', {
      phase: 'parse_osng_proposal',
      error_message: e && e.message ? e.message : String(e),
      response_preview: clip(content, 400)
    });
  }

  let nodesRaw;
  let rootId;
  if (parsed && typeof parsed === 'object' && Array.isArray(parsed.nodes)) {
    nodesRaw = parsed.nodes;
    rootId =
      typeof parsed.root_osn_id === 'string' && parsed.root_osn_id.trim()
        ? parsed.root_osn_id.trim()
        : null;
  } else if (parsed && typeof parsed === 'object' && typeof parsed.id === 'string') {
    nodesRaw = [parsed];
    rootId = parsed.id.trim();
  } else {
    throw httpError(502, 'osng_proposal_missing_nodes', {
      phase: 'parse_osng_proposal',
      parsed_keys: parsed && typeof parsed === 'object' ? Object.keys(parsed) : []
    });
  }

  if (!nodesRaw.length) {
    throw httpError(502, 'osng_proposal_empty_nodes', {
      phase: 'parse_osng_proposal'
    });
  }

  const effectiveMax =
    metaHints.max_descendants_effective != null
      ? Number(metaHints.max_descendants_effective)
      : 0;
  if (effectiveMax === 0 && nodesRaw.length !== 1) {
    throw httpError(502, 'osng_proposal_expected_single_node', {
      phase: 'validate_osng_proposal',
      nodes_length: nodesRaw.length
    });
  }

  const nodes = nodesRaw.map((n) => normalizeDraftOsn(n, intent));
  if (!rootId) rootId = nodes[0].id;
  const root = nodes.find((n) => n.id === rootId) || nodes[0];
  if (!root || !root.id) {
    throw httpError(502, 'normalized_osn_invalid', {
      phase: 'normalize_osn'
    });
  }

  return {
    status: 'ok',
    root_osn_id: root.id,
    nodes,
    meta: {
      mode: effectiveMax === 0 ? 'naive_single' : 'multi_pending',
      schema: 'osn/0.2',
      max_descendants_requested: metaHints.max_descendants_requested,
      max_descendants_effective: effectiveMax,
      clamped: metaHints.clamped === true,
      labor: 'hanuman_browser_ca',
      note:
        'Draft OSNG only via browser Hanuman. No canon YAML. Multi-node when max_descendants>0 is Follow-up.'
    }
  };
}

function buildAgentPrompt({ intent, requestedMax, effectiveMax, clamped }) {
  return [
    '# OSNG propose Job (Hanuman / CA)',
    '',
    '**Beloved Hanuman:** Ram — White authority, throne of consent — has raised this request for an **OSNG proposition**.',
    'The intent in `INTENT.md` is Ram’s voice naming the outcome he wishes to see made real.',
    'You draft a **proposal OSNG** only. Ram alone seats gardens on the White throne; this Job does not canonize.',
    'Consult only **GT3** — the one sun — for how to shape each loving step. Do not invent a second heaven.',
    '',
    'This is **not** a realize / SUD-composition Job. Do not write document.md or index.html.',
    '',
    '## Caps',
    `- max_descendants requested: ${requestedMax}`,
    `- max_descendants effective (day-zero): ${effectiveMax}${clamped ? ' (clamped)' : ''}`,
    effectiveMax === 0
      ? '- Produce a **single-OSN** garden (root only; empty child_osn_ids).'
      : '- Higher caps are not fully implemented; still prefer a coherent root-first draft.',
    '',
    '## Method (consult the GT3 sun with this labor)',
    'Keep INTENT.md / seed, thematic_lenses, and success_evidences in mind on every GT3 consult turn.',
    'Work in this order — use tools to read, then write the primary when the draft is whole:',
    '',
    '1. **Seed** — Set `seed` to Ram’s intent from INTENT.md (faithful paraphrase allowed; do not invent a different outcome).',
    '2. **Expand into exactly 3 thematic lenses** — From the seed, name three complementary professional perspectives that together cover the outcome.',
    '   Prefer distinct angles (e.g. end-user experience, technical/delivery shape, verification/governance) when they fit the seed.',
    '   Each lens object: `{ "lens_id": "lens.<slug>", "name": "<short>", "description": "<what this lens sees in the seed>", "purpose": "<how this lens constrains the SUD>" }`.',
    '   Do NOT emit bare strings. Consult GT3 if unsure how to split the seed into three honest lenses.',
    '3. **Compose output_spec from the lenses** — Write one `output_spec` string that describes the required SUD as seen through all three lenses.',
    '   Structure the contract so a builder could realize it; reference each lens’s concern without dumping OSN ids into reader-facing fluff.',
    '4. **Compose success_evidences from seed + lenses + output_spec** — Add ≥3 direct TEXTUAL_SNIPPET evidences (one that strongly serves each lens is a good default).',
    '   Each: `{ "evidence_id": "ev.direct.textual_snippet.N", "kind": "TEXTUAL_SNIPPET", "direct": true, "inspection_prompt": "<how a human inspects the future SUD>" }`.',
    '   Inspection prompts must be actionable against the delivered SUD, not restatements of the seed alone.',
    '   Do NOT use type/description/snippet instead of kind/inspection_prompt.',
    '',
    'When consulting GT3, bring the current seed, the three lenses, and draft evidences into the question so the sun can refine the next loving step for Ram.',
    '',
    '## Primary deliverable',
    `Write \`${OSNG_PROPOSAL_PRIMARY}\` as JSON:`,
    '```json',
    '{',
    '  "root_osn_id": "<id ending in .osn>",',
    '  "nodes": [ { /* one OSN draft */ } ]',
    '}',
    '```',
    '',
    '## Lexiom OSN field contract (required)',
    '- schema_version: "osn/0.2"',
    '- id, title, seed (strings); id ends with .osn',
    '- thematic_lenses: **exactly 3** Lexiom lens objects (see Method step 2)',
    '- output_spec: string composed from the three lenses (Method step 3)',
    '- success_evidences: Lexiom evidence objects (Method step 4)',
    '- graph.parent_osn_ids: []; graph.child_osn_ids: []',
    '',
    'Read INTENT.md and PROPOSE_BRIEF.json first. Use tools only. Call finish when the primary is complete.',
    '',
    '## Intent (Ram’s echo)',
    clip(intent, 2000)
  ].join('\n');
}

function caSessionFromTicket(ticket) {
  return {
    session_id: ticket.session_id,
    run_id: ticket.run_id,
    pass: ticket.pass,
    ca_location: ticket.ca_location,
    executor: ticket.executor,
    runtime: ticket.runtime,
    broker_path: ticket.broker_path,
    broker_token: ticket.broker_token,
    gt3_consult_path: ticket.gt3_consult_path || ticket.broker_path,
    gt3_consult_credential: ticket.gt3_consult_credential || ticket.broker_token,
    capability_token: ticket.capability_token,
    workspace_manifest_url: ticket.workspace.manifest_path,
    file_path_template: ticket.workspace.file_path_template,
    artifacts_url: ticket.artifacts_path,
    report_url: ticket.report_path,
    heartbeat_url: `/lexiom13/build/session/${encodeURIComponent(ticket.session_id)}/heartbeat`,
    cancel_url: `/lexiom13/build/session/${encodeURIComponent(ticket.session_id)}/cancel`,
    timeout_ms: ticket.timeout_ms,
    plugin_id: ticket.plugin_id
  };
}

async function writeRunResult(outDir, payload) {
  await fsp.writeFile(
    path.join(outDir, 'RUN_RESULT.json'),
    JSON.stringify(payload, null, 2),
    'utf8'
  );
}

async function armPendingProposeJob(sessionId, handoff, timeoutMs, timeoutDetail) {
  const timer = setTimeout(() => {
    if (!pendingProposeJobs.has(sessionId)) return;
    pendingProposeJobs.delete(sessionId);
    reportLexiom13OsngProposeSession(sessionId, {
      status: 'agent_failed',
      reason: 'timeout',
      detail: timeoutDetail
    }).catch((e) => console.error('lexiom13_osng_propose_timeout_finalize', e));
  }, timeoutMs);
  if (typeof timer.unref === 'function') timer.unref();
  pendingProposeJobs.set(sessionId, { handoff, timer });
}

/**
 * Start async propose: prepare workspace + CA ticket. Browser must run Hanuman.
 */
export async function startLexiom13OsngPropose(repoRoot, body = {}, opts = {}) {
  const intent = String(body.intent || body.narrative || '').trim();
  if (!intent) {
    throw httpError(400, 'intent must be non-empty', {
      phase: 'validate',
      reason: 'empty_intent'
    });
  }

  let maxDescendants = body.max_descendants;
  if (maxDescendants === undefined || maxDescendants === null) {
    maxDescendants = 0;
  }
  maxDescendants = Number(maxDescendants);
  if (!Number.isFinite(maxDescendants) || maxDescendants < 0) {
    throw httpError(400, 'max_descendants must be a non-negative number', {
      phase: 'validate',
      reason: 'invalid_max_descendants',
      max_descendants: body.max_descendants
    });
  }

  const requestedMax = maxDescendants;
  const effectiveMax = 0;
  const clamped = requestedMax > 0;

  const runId = makeRunId();
  const outputDirectory = path.join(repoRoot, 'builds', 'lexiom13-propose', runId);
  await fsp.mkdir(outputDirectory, { recursive: true });

  const brief = {
    schema: 'osn/0.2',
    raised_by: 'ram',
    authority: 'white_throne_consent',
    laborer: 'hanuman',
    sun: 'gt3',
    request: 'osng_proposition',
    max_descendants_requested: requestedMax,
    max_descendants_effective: effectiveMax,
    clamped,
    primary: OSNG_PROPOSAL_PRIMARY,
    plugin_id: OSNG_PROPOSER_PLUGIN_ID,
    labor: 'hanuman_browser_ca',
    method: {
      steps: [
        'seed_from_intent',
        'expand_three_thematic_lenses',
        'compose_output_spec_from_lenses',
        'compose_success_evidences_from_seed_lenses_output_spec'
      ],
      thematic_lenses_count: 3,
      consult_carries: ['seed', 'thematic_lenses', 'success_evidences']
    }
  };

  const handoff = {
    run_id: runId,
    plugin_id: OSNG_PROPOSER_PLUGIN_ID,
    output_directory: outputDirectory,
    intent_preview: clip(intent, 160),
    max_descendants_requested: requestedMax,
    max_descendants_effective: effectiveMax,
    clamped,
    primary: OSNG_PROPOSAL_PRIMARY,
    _started_at: new Date().toISOString(),
    _repo_root: repoRoot
  };

  await fsp.writeFile(path.join(outputDirectory, 'INTENT.md'), intent, 'utf8');
  await fsp.writeFile(
    path.join(outputDirectory, 'PROPOSE_BRIEF.json'),
    JSON.stringify(brief, null, 2),
    'utf8'
  );
  await fsp.writeFile(
    path.join(outputDirectory, 'AGENT_PROMPT.md'),
    buildAgentPrompt({ intent, requestedMax, effectiveMax, clamped }),
    'utf8'
  );
  await fsp.writeFile(
    path.join(outputDirectory, 'HANDOFF.json'),
    JSON.stringify(
      {
        run_id: runId,
        plugin_id: OSNG_PROPOSER_PLUGIN_ID,
        primary: OSNG_PROPOSAL_PRIMARY,
        max_descendants_requested: requestedMax,
        max_descendants_effective: effectiveMax,
        clamped,
        intent_preview: handoff.intent_preview,
        output_directory: outputDirectory
      },
      null,
      2
    ),
    'utf8'
  );

  const ticket = issueCaJobTicket({
    runId,
    pluginId: OSNG_PROPOSER_PLUGIN_ID,
    outputDirectory,
    productPort: parseInt(process.env.PORT || '8080', 10),
    pass: 'builder',
    caLocation: body.ca_location || CA_LOCATION_BROWSER_SESSION,
    timeoutMs: opts.timeoutMs || BUILDER_TIMEOUT_MS
  });

  await dispatchCaJob({ sessionId: ticket.session_id });
  const caSession = caSessionFromTicket(ticket);

  const started = {
    status: 'awaiting_browser',
    run_id: runId,
    session_id: ticket.session_id,
    executor: EXECUTOR_ID,
    ca_location: CA_LOCATION_BROWSER_SESSION,
    runtime: 'webcontainer',
    pass: 'builder',
    ca_session: caSession,
    ca_job: { ...ticket, mbts_id: undefined },
    plugin_id: OSNG_PROPOSER_PLUGIN_ID,
    primary: OSNG_PROPOSAL_PRIMARY,
    output_directory: outputDirectory,
    started_at: handoff._started_at,
    meta: {
      mode: 'naive_single',
      schema: 'osn/0.2',
      max_descendants_requested: requestedMax,
      max_descendants_effective: effectiveMax,
      clamped,
      labor: 'hanuman_browser_ca',
      note:
        'Awaiting browser Hanuman. Call gtih.hanuman.serveProposeSession(ca_session), then poll status.'
    },
    detail: `OSNG propose Job issued for bolt_webcontainer. Poll GET /lexiom13/osn/propose/status/${runId}.`
  };

  await writeRunResult(outputDirectory, started);
  await armPendingProposeJob(
    ticket.session_id,
    handoff,
    ticket.timeout_ms || BUILDER_TIMEOUT_MS,
    `OSNG propose timed out after ${Math.round((ticket.timeout_ms || BUILDER_TIMEOUT_MS) / 60000)} minutes (browser CA)`
  );

  return started;
}

export async function readLexiom13OsngProposeStatus(repoRoot, runId) {
  const id = String(runId || '').trim();
  if (!id || id.includes('..') || id.includes('/') || id.includes('\\')) {
    throw httpError(400, 'Invalid run_id', { phase: 'validate', reason: 'bad_run_id' });
  }
  const resultPath = path.join(repoRoot, 'builds', 'lexiom13-propose', id, 'RUN_RESULT.json');
  try {
    const raw = await fsp.readFile(resultPath, 'utf8');
    const parsed = JSON.parse(raw);
    return mapProposeStatusPayload(parsed, id);
  } catch (e) {
    if (e && e.code === 'ENOENT') {
      throw httpError(404, `No propose RUN_RESULT for run_id=${id}`, {
        phase: 'status',
        run_id: id
      });
    }
    throw e;
  }
}

function mapProposeStatusPayload(parsed, runId) {
  const rawStatus = String(parsed.status || '');
  let status = rawStatus;
  if (rawStatus === 'completed' || rawStatus === 'ok') status = 'ok';
  else if (
    rawStatus === 'agent_failed' ||
    rawStatus === 'failed' ||
    rawStatus === 'agent_unavailable' ||
    rawStatus === 'unavailable'
  ) {
    status = 'failed';
  } else if (rawStatus === 'running') status = 'running';
  else if (rawStatus === 'awaiting_browser') status = 'awaiting_browser';

  const out = {
    status,
    run_id: parsed.run_id || runId,
    session_id: parsed.session_id || null,
    detail: parsed.detail || null,
    reason: parsed.reason || null,
    meta: parsed.meta || null,
    ca_session: parsed.ca_session || undefined,
    debug: parsed.debug || undefined
  };

  if (status === 'ok' && parsed.envelope) {
    out.envelope = parsed.envelope;
    out.root_osn_id = parsed.envelope.root_osn_id;
    out.nodes = parsed.envelope.nodes;
  } else if (status === 'failed') {
    out.debug =
      parsed.debug ||
      {
        phase: 'propose_failed',
        reason: parsed.reason || null,
        detail: parsed.detail || null,
        log_tail: parsed.log_tail || null,
        latency_ms: parsed.latency_ms || null
      };
  }

  return out;
}

/**
 * Finalize propose CA report (same session HTTP as builds; no evidence/bud).
 */
export async function reportLexiom13OsngProposeSession(
  sessionId,
  report = {},
  capabilityToken = null
) {
  const pending = pendingProposeJobs.get(sessionId);
  const session = getCaSession(sessionId);
  if (!session) {
    throw httpError(404, 'CA session not found', { phase: 'report', session_id: sessionId });
  }
  if (session.plugin_id !== OSNG_PROPOSER_PLUGIN_ID) {
    throw httpError(409, 'Session is not an OSNG propose Job', {
      phase: 'report',
      plugin_id: session.plugin_id
    });
  }

  let handoff = pending && pending.handoff;
  if (!handoff) {
    const handoffPath = path.join(session.output_directory, 'HANDOFF.json');
    const raw = await fsp.readFile(handoffPath, 'utf8');
    handoff = JSON.parse(raw);
    handoff.output_directory = handoff.output_directory || session.output_directory;
  }

  if (pending && pending.timer) clearTimeout(pending.timer);
  pendingProposeJobs.delete(sessionId);

  return applySessionReport(
    sessionId,
    report,
    async (result) => {
      const outDir = handoff.output_directory || session.output_directory;
      let intent = '';
      try {
        intent = await fsp.readFile(path.join(outDir, 'INTENT.md'), 'utf8');
      } catch {
        intent = '';
      }

      const metaHints = {
        max_descendants_requested: handoff.max_descendants_requested,
        max_descendants_effective: handoff.max_descendants_effective,
        clamped: handoff.clamped
      };

      if (result.status === 'completed') {
        const primary = primaryArtifactForPlugin(OSNG_PROPOSER_PLUGIN_ID);
        let content = '';
        try {
          content = await fsp.readFile(path.join(outDir, primary), 'utf8');
        } catch (e) {
          result.status = 'agent_failed';
          result.reason = 'primary_missing';
          result.detail = `Primary missing after promote: ${primary}`;
          result.debug = {
            phase: 'finalize_propose',
            error_message: e && e.message ? e.message : String(e)
          };
        }

        if (result.status === 'completed') {
          try {
            const envelope = envelopeFromOsngProposalFile(content, intent, metaHints);
            result.envelope = envelope;
            result.status = 'completed';
            result.detail = result.detail || `OSNG proposal ready: ${envelope.root_osn_id}`;
            result.meta = envelope.meta;
          } catch (e) {
            result.status = 'agent_failed';
            result.reason = e && e.message ? e.message : 'envelope_invalid';
            result.detail = e && e.message ? e.message : 'Failed to normalize OSNG proposal';
            result.debug = (e && e.debug) || {
              phase: 'finalize_propose',
              error_message: String(e && e.message ? e.message : e)
            };
          }
        }
      } else {
        result.debug = result.debug || {
          phase: 'propose_agent_report',
          reason: result.reason,
          detail: result.detail,
          log_tail: result.log_tail
        };
      }

      const runPayload = {
        status:
          result.status === 'completed'
            ? 'completed'
            : result.status === 'agent_unavailable'
              ? 'agent_unavailable'
              : 'agent_failed',
        run_id: handoff.run_id || session.run_id,
        session_id: session.session_id,
        plugin_id: OSNG_PROPOSER_PLUGIN_ID,
        reason: result.reason || null,
        detail: result.detail || null,
        debug: result.debug || null,
        envelope: result.envelope || null,
        meta: result.meta || metaHints,
        latency_ms: result.latency_ms,
        log_tail: result.log_tail,
        agent: result.agent,
        executor: result.executor,
        ca_location: result.ca_location,
        finished_at: new Date().toISOString()
      };
      await writeRunResult(outDir, runPayload);
    },
    capabilityToken
  );
}

/** @deprecated sync inference path removed — use startLexiom13OsngPropose */
export async function proposeLexiom13OsngFromIntent() {
  throw httpError(
    410,
    'Sync proposeFromIntent inference path removed. Use async start + browser Hanuman.',
    { phase: 'gone', labor: 'hanuman_browser_ca' }
  );
}
