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
/** TRH modal LP/RP chat reply (conversation); primary finish gate stays OSNG_PROPOSAL.json. */
export const MODAL_CHAT_REPLY = 'CHAT_REPLY.md';
export const MODAL_CHAT_PRIOR_OSNG = 'PRIOR_OSNG.json';
export const MODAL_CHAT_FOCUS = 'FOCUS_SAMPLE.json';
export const MODAL_CHAT_FOCUS_CONTENT = 'FOCUS_CONTENT.md';
const MODAL_CHAT_FOCUS_CONTENT_MAX = 60000;
export const MODAL_CHAT_EVIDENCE = 'EVIDENCE_INDEX.json';
export const MODAL_CHAT_MODE = 'modal_chat';
export const MODAL_CHAT_CONTRACT_LINEAGE = 'lineage_readonly';
export const MODAL_CHAT_CONTRACT_EDIT = 'edit_osng';
/** Mid-method labor artifacts under builds/lexiom13-propose/<runId>/ (not on finished nodes). */
export const PROPOSE_SEED_ARTIFACT = 'SEED.md';
export const PROPOSE_LENSES_ARTIFACT = 'THEMATIC_LENSES.json';
/** TRH prism expansion: one refining child under one selected parent. */
export const EXPAND_MODE = 'expand';
export const EXPAND_PATH_OSNG = 'PATH_OSNG.json';
export const EXPAND_PRISM = 'PRISM.md';
export const EXPAND_CHILD_COUNT = 1;
/** Finished Hanuman OSN top-level allowlist (silent-drop everything else). */
export const OSNG_FINISHED_TOP_KEYS = Object.freeze([
  'schema_version',
  'id',
  'file_name',
  'owner',
  'graph',
  'output_spec',
  'success_evidences'
]);
/** Structural graph subkeys only on finished nodes. */
export const OSNG_FINISHED_GRAPH_KEYS = Object.freeze([
  'parent_osn_ids',
  'child_osn_ids',
  'standard_ancestor_osn_ids'
]);

/** Default finished-node owner for Hanuman drafts (simple string). */
export const DEFAULT_HANUMAN_OWNER = 'Ram';

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

/** Opaque Hanuman finished-node id: `{uuid}.osn` (not path-shaped; canon garden ids unchanged). */
export function makeHanumanOsnId() {
  const uuid =
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : [
          uniqueId() + uniqueId(),
          uniqueId().slice(0, 4),
          `4${uniqueId().slice(0, 3)}`,
          `a${uniqueId().slice(0, 3)}`,
          uniqueId() + uniqueId() + uniqueId().slice(0, 4)
        ].join('-');
  return `${uuid}.osn`;
}

const HANUMAN_OSN_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.osn$/i;

export function isHanumanOsnId(value) {
  return HANUMAN_OSN_ID_RE.test(String(value || '').trim());
}

/**
 * Finished Hanuman nodes mandate a simple string owner (default "Ram").
 * Objects / ceremony blobs (raised_by, laborer, …) are coerced or replaced.
 */
export function normalizeHanumanOwner(rawOwner) {
  if (typeof rawOwner === 'string' && rawOwner.trim()) {
    return rawOwner.trim();
  }
  if (rawOwner && typeof rawOwner === 'object' && !Array.isArray(rawOwner)) {
    const fromDisplay =
      typeof rawOwner.display_name === 'string' && rawOwner.display_name.trim()
        ? rawOwner.display_name.trim()
        : '';
    if (fromDisplay && !/^(draft|draft proposer)$/i.test(fromDisplay)) {
      return fromDisplay;
    }
  }
  return DEFAULT_HANUMAN_OWNER;
}

function naiveThematicLensesFallback() {
  return [
    {
      lens_id: 'lens.outcome.intent',
      name: 'Outcome Intent',
      description: 'Reads the SUD-describing narrative as the primary intention.',
      purpose: 'Reads the SUD-describing narrative as the primary intention.'
    }
  ];
}

/** Allowlist-only finished OSN projector (fallback when draft is missing/invalid). */
export function buildNaiveSingleOsn(intent) {
  const desc = String(intent || '').trim();
  const id = makeHanumanOsnId();
  return {
    schema_version: 'osn/0.2',
    id,
    file_name: id,
    owner: DEFAULT_HANUMAN_OWNER,
    graph: {
      parent_osn_ids: [],
      child_osn_ids: [],
      standard_ancestor_osn_ids: []
    },
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
        inspection_prompt: 'The opening passage of the delivered outcome, where its intended subject appears'
      }
    ]
  };
}

/**
 * Coerce free-form / alternate lens drafts into Lexiom shape:
 * { lens_id, name, description, purpose? }
 */
export function normalizeThematicLenses(rawLenses, _intent) {
  const fallback = naiveThematicLensesFallback();
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
          `The passage of the delivered outcome containing this excerpt (or equivalent): ${item.snippet.trim()}`
        );
      }
      if (typeof item.quote === 'string' && item.quote.trim()) {
        promptParts.push(
          `The passage of the delivered outcome containing this quote: ${item.quote.trim()}`
        );
      }
    }
    const inspection_prompt =
      promptParts.join(' ').trim() ||
      'The passage of the delivered outcome that best shows the intended outcome';

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

/**
 * Proposed OSNs carry exactly one direct success evidence (attestation budget).
 * Keeps the first direct evidence (else the first one) and re-ids it as the sole direct evidence.
 */
export function singleDirectEvidence(evidences, intent) {
  const list = normalizeSuccessEvidences(evidences, intent);
  const pick = list.find((ev) => ev && ev.direct === true) || list[0];
  return [
    {
      ...pick,
      evidence_id: 'ev.direct.textual_snippet.1',
      kind: pick.kind || 'TEXTUAL_SNIPPET',
      direct: true
    }
  ];
}

function withSingleDirectEvidence(nodes, intent) {
  return nodes.map((node) => ({
    ...node,
    success_evidences: singleDirectEvidence(node.success_evidences, intent)
  }));
}

/**
 * Newly proposed nodes get host-minted `{uuid}.osn` ids: model-written ids are not trusted
 * to be unique (stock UUIDs recur across runs and collide in per-OSN lookups such as
 * evidence listings). Graph links inside the batch follow the new ids; links to ids
 * outside the batch (e.g. an expansion parent) are kept. Ids listed in `keepIds`
 * (nodes that already existed before a revision) are left untouched.
 * @param {object[]} nodes
 * @param {{ keepIds?: Iterable<string> }} [opts]
 * @returns {{ nodes: object[], idMap: Map<string, string> }}
 */
export function remintProposedOsnIds(nodes, { keepIds } = {}) {
  const list = Array.isArray(nodes) ? nodes : [];
  const keep = new Set(keepIds ? Array.from(keepIds, String) : []);
  const idMap = new Map();
  const seenKept = new Set();
  const freshIds = list.map((node) => {
    const oldId = String((node && node.id) || '').trim();
    if (oldId && keep.has(oldId) && !seenKept.has(oldId)) {
      seenKept.add(oldId);
      return oldId;
    }
    const fresh = makeHanumanOsnId();
    if (oldId && !idMap.has(oldId) && !keep.has(oldId)) idMap.set(oldId, fresh);
    return fresh;
  });
  const relink = (ids) =>
    Array.isArray(ids) ? ids.map((id) => idMap.get(String(id)) || id) : [];
  const out = list.map((node, i) => {
    const graph = (node && node.graph) || {};
    return {
      ...node,
      id: freshIds[i],
      file_name: freshIds[i],
      graph: {
        ...graph,
        parent_osn_ids: relink(graph.parent_osn_ids),
        child_osn_ids: relink(graph.child_osn_ids),
        standard_ancestor_osn_ids: relink(graph.standard_ancestor_osn_ids)
      }
    };
  });
  return { nodes: out, idMap };
}
/**
 * Project a draft into the finished-node allowlist only.
 * Silently drops title, seed, thematic_lenses, compilation, node_type, and any other extras.
 */
export function normalizeDraftOsn(raw, intent) {
  const fallback = buildNaiveSingleOsn(intent);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return fallback;
  }
  const id =
    typeof raw.id === 'string' && raw.id.trim()
      ? String(raw.id).trim()
      : fallback.id;
  const output_spec =
    typeof raw.output_spec === 'string' && raw.output_spec.trim()
      ? String(raw.output_spec).trim()
      : fallback.output_spec;
  const success_evidences = normalizeSuccessEvidences(raw.success_evidences, intent);
  const owner = normalizeHanumanOwner(raw.owner);
  const file_name =
    typeof raw.file_name === 'string' && raw.file_name.trim()
      ? String(raw.file_name).trim()
      : id;
  const g = raw.graph && typeof raw.graph === 'object' ? raw.graph : {};

  return {
    schema_version: 'osn/0.2',
    id,
    file_name,
    owner,
    graph: {
      parent_osn_ids: Array.isArray(g.parent_osn_ids) ? g.parent_osn_ids : [],
      child_osn_ids: Array.isArray(g.child_osn_ids) ? g.child_osn_ids : [],
      standard_ancestor_osn_ids: Array.isArray(g.standard_ancestor_osn_ids)
        ? g.standard_ancestor_osn_ids
        : []
    },
    output_spec,
    success_evidences
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
  if (metaHints.any_node_count !== true && effectiveMax === 0 && nodesRaw.length !== 1) {
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
    nodes
  };
}

/** How a direct evidence's inspection_prompt is phrased: what to retrieve, never how to verify. */
function directEvidencePromptLines() {
  return [
    '   `inspection_prompt` is a **retrieval statement**: a short noun phrase naming the fragment of the delivered SUD to pull out and show for first-hand inspection — e.g. "A phrase which relates the poem to Berlin", "The closing stanza of the poem", "The paragraph describing the arrival day".',
    '   Reading the retrieved fragment alone must let a human judge that the outcome became real — the fragment *is* the evidence.',
    '   Never an instruction or procedure: no "count", "verify", "confirm", "check", "ensure", or "measure", and no thresholds or tallies. "Count the words in the delivered poem and verify it contains exactly 30 words" is derivative, not direct.',
    '   If a requirement can only be judged by counting or measuring, attest a different requirement that a retrieved fragment shows directly.'
  ];
}

function buildAgentPrompt({ intent, requestedMax, effectiveMax, clamped }) {
  return [
    '# OSNG propose Job (Hanuman / CA)',
    '',
    '**Beloved Hanuman:** Ram — White authority, throne of consent — has raised this request for an **OSNG proposition**.',
    'The intent in `INTENT.md` is the outcome Ram wishes to see made real (Job ceremony). You draft a **proposal OSNG** only. Ram alone seats gardens on the White throne; this Job does not canonize.',
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
    '## Outcome-facing language (constitutional PRD — mandatory)',
    'Ram / Hanuman / GT3 / White throne / laborer / raised_by belong **only** in Job ceremony (`PROPOSE_BRIEF.json`, this prompt’s greeting, and the `owner` string field).',
    '**Never** put those names (or “the devotee”, “the sun”, “throne of consent”) into:',
    `- \`${PROPOSE_SEED_ARTIFACT}\`, \`${PROPOSE_LENSES_ARTIFACT}\``,
    '- finished `output_spec`',
    '- any `success_evidences[].inspection_prompt` (or other evidence prose)',
    'Write seed, lenses, output_spec, and evidences as a clean SUD contract: describe the **deliverable and how to inspect it**.',
    'Preserve first/second person from INTENT.md when present (“my trip” → the traveler’s trip / the author’s trip — not “Ram’s trip”). Prefer neutral outcome nouns over ceremony roles.',
    '',
    '## Method (mandatory mid-method chain of thought)',
    'Work in this order. Seed and the three lenses are **mid-method labor** — write them to workspace scratch files, then fold into the finished node.',
    'Keep INTENT.md, the mid-method seed/lenses, and draft evidences in mind on every GT3 consult turn.',
    '',
    `1. **Seed** — Write \`${PROPOSE_SEED_ARTIFACT}\`: a faithful **outcome-facing** paraphrase of INTENT.md (do not invent a different outcome; do not name Ram/Hanuman/GT3).`,
    `2. **Expand into exactly 3 thematic lenses** — Write \`${PROPOSE_LENSES_ARTIFACT}\` as a JSON array of **exactly 3** Lexiom lens objects.`,
    '   Prefer distinct angles (e.g. end-user experience, technical/delivery shape, verification/governance) when they fit the seed.',
    '   Each lens object: `{ "lens_id": "lens.<slug>", "name": "<short>", "description": "<what this lens sees in the seed>", "purpose": "<how this lens constrains the SUD>" }`.',
    '   Description and purpose must stay outcome-facing — no ceremony names.',
    '   Do NOT emit bare strings. Consult GT3 if unsure how to split the seed into three honest lenses.',
    '3. **Fold into output_spec** — Compose one `output_spec` string that describes the required SUD as seen through all three lenses.',
    '   Structure the contract so a builder could realize it; reference each lens’s concern without dumping OSN ids or ceremony names into the PRD.',
    '4. **Compose the success evidence** — From seed + lenses + output_spec, add **exactly one** direct TEXTUAL_SNIPPET evidence: the single inspection that best attests the whole output_spec as seen through all three lenses (keep attestation light — never more than one).',
    '   Shape: `{ "evidence_id": "ev.direct.textual_snippet.1", "kind": "TEXTUAL_SNIPPET", "direct": true, "inspection_prompt": "<what to retrieve from the delivered SUD>" }`.',
    ...directEvidencePromptLines(),
    '   Inspection prompts point at the delivered SUD, not restatements of the seed alone, and must not name Ram/Hanuman/GT3.',
    '   Do NOT use type/description/snippet instead of kind/inspection_prompt.',
    '',
    'When consulting GT3, bring the current seed, the three lenses, and draft evidences into the question so the sun can refine the next loving step — still keep consult *artifacts* outcome-facing.',
    '',
    '## Primary deliverable (finished-node allowlist only)',
    `Write \`${OSNG_PROPOSAL_PRIMARY}\` as JSON:`,
    '```json',
    '{',
    '  "root_osn_id": "<{uuid}.osn>",',
    '  "nodes": [ { /* one OSN draft — allowlisted keys only */ } ]',
    '}',
    '```',
    '',
    '## Finished OSN field contract (required — nothing else)',
    '- schema_version: "osn/0.2"',
    '- id, file_name: opaque `{uuid}.osn` (example: `a1b2c3d4-e5f6-7890-abcd-ef1234567890.osn`). Do **not** encode outcome words, titles, or path stems in the id.',
    '- owner: string — default `"Ram"` (metadata only). Do **not** put raised_by, laborer, authority, or other ceremony fields inside owner (those live only in PROPOSE_BRIEF.json). Do **not** repeat the owner name inside output_spec or evidences.',
    '- output_spec: string folded from the three lenses (Method step 3) — outcome-facing only',
    '- success_evidences: an array with exactly one direct Lexiom evidence object (Method step 4) — outcome-facing inspection prompt only',
    '- graph.parent_osn_ids: []; graph.child_osn_ids: []; graph.standard_ancestor_osn_ids: []',
    '- Set file_name equal to id. Set root_osn_id to that same id.',
    '',
    '**Do not** put `title`, `seed`, `thematic_lenses`, `node_type`, `discipline`, `compilation`, or `graph.derived_from_lens_id` on the finished node.',
    `Those mid-method artifacts belong only in \`${PROPOSE_SEED_ARTIFACT}\` / \`${PROPOSE_LENSES_ARTIFACT}\`.`,
    '',
    `Read INTENT.md and PROPOSE_BRIEF.json first. Write mid-method files, then the primary. Use tools only. Call finish when \`${OSNG_PROPOSAL_PRIMARY}\` is complete.`,
    '',
    '## Intent (outcome to realize)',
    clip(intent, 2000)
  ].join('\n');
}

/**
 * Shared AGENT_PROMPT for TRH LP/RP modal Hanuman Jobs.
 * Same structure for both panels; only the contract block differs.
 */
export function buildModalChatAgentPrompt({
  contract,
  question,
  thread,
  focusSample,
  evidenceSummary,
  focusOsnId
}) {
  const isReadonly = String(contract) === MODAL_CHAT_CONTRACT_LINEAGE;
  const targetId = String(focusOsnId || '').trim();
  const contractBlock = isReadonly
    ? [
        '## Contract: lineage_readonly (mandatory)',
        'You are counsel only. Answer questions about the focused sample and its lineage in the packed garden.',
        `- Write your answer in \`${MODAL_CHAT_REPLY}\` (markdown). This is the only file you write.`,
        `- Do **not** write \`${OSNG_PROPOSAL_PRIMARY}\` or any other file — the garden is read-only for you.`,
        `- When the question is about the sample itself (its words, lines, content), answer from \`${MODAL_CHAT_FOCUS_CONTENT}\` — the actual delivered text — not from what output_spec says it should be.`,
        'Do not propose garden edits. Do not invent canon.',
        `Call finish once \`${MODAL_CHAT_REPLY}\` is written.`
      ].join('\n')
    : [
        '## Contract: edit_osng (mandatory)',
        'Ram asks you to revise the draft OSNG so the SUD can improve (edit-my-OSNG).',
        `- \`${OSNG_PROPOSAL_PRIMARY}\` already holds a copy of \`${MODAL_CHAT_PRIOR_OSNG}\`. Overwrite it with the revised lean envelope \`{ "root_osn_id": …, "nodes": [ … ] }\` — raw OSNG JSON only, never a tool-result wrapper.`,
        ...(targetId
          ? [
              `- The node \`${targetId}\` is the **main target** of this revision. Revise it first; change other nodes only where the request or consistency with it requires.`,
              '- Keep the ids of nodes you keep. New nodes get new opaque `{uuid}.osn` ids linked through graph.parent_osn_ids / child_osn_ids.'
            ]
          : []),
        '- A non-root node\'s output_spec is a **delta** on top of its ancestors (the realizer folds the whole path into one SUD): it states only what that node adds or narrows. Never restate ancestor constraints (form, length / word count, subject, tone, presentation) in a descendant; to change such a constraint, change it on the ancestor that owns it — do not copy it down. A descendant that must override an ancestor says so explicitly ("Overrides the parent\'s …: …").',
        `- Write a short explanation of what changed (and why) in \`${MODAL_CHAT_REPLY}\` (markdown).`,
        'Finished nodes: allowlist only (schema_version, id, file_name, owner, graph, output_spec, success_evidences). Each node keeps exactly one direct success evidence.',
        'When you touch an evidence, its `inspection_prompt` states what to retrieve from the delivered SUD (e.g. "A phrase which relates the poem to Berlin") — never a count/verify procedure.',
        'Outcome-facing language only in output_spec / evidences — no Ram/Hanuman/GT3 ceremony names.',
        'Do not write document.md or index.html. Do not auto-canonize Lexiom YAML.',
        `Call finish when both \`${OSNG_PROPOSAL_PRIMARY}\` and \`${MODAL_CHAT_REPLY}\` are ready.`
      ].join('\n');

  const threadLines = [];
  const turns = Array.isArray(thread) ? thread.slice(-12) : [];
  for (const t of turns) {
    if (!t || !t.role) continue;
    const role = String(t.role);
    const content = clip(t.content, 800);
    if (!content) continue;
    threadLines.push(`- **${role}:** ${content}`);
  }

  const focus =
    focusSample && typeof focusSample === 'object'
      ? JSON.stringify(focusSample, null, 2).slice(0, 2500)
      : '(none)';
  const evidence =
    evidenceSummary != null
      ? typeof evidenceSummary === 'string'
        ? clip(evidenceSummary, 2000)
        : JSON.stringify(evidenceSummary, null, 2).slice(0, 2500)
      : '(none)';

  return [
    'Beloved Hanuman — Ram has raised a **TRH modal chat** Job under GT3, the only sun.',
    'This is not a greenfield propose-from-intent Job and not a realize / SUD Job.',
    '',
    contractBlock,
    '',
    '## Workspace (read first)',
    `- \`${MODAL_CHAT_PRIOR_OSNG}\` — lean OSNG envelope { root_osn_id, nodes }`,
    `- \`${MODAL_CHAT_FOCUS}\` — current TP sample identity / summary`,
    `- \`${MODAL_CHAT_FOCUS_CONTENT}\` — the focused sample's actual content (SUD or evidence text) as shown in TP`,
    `- \`${MODAL_CHAT_EVIDENCE}\` — evidence listing summary (ids/kinds/status)`,
    '- INTENT.md — the latest user question',
    '',
    '## Focus sample',
    '```json',
    focus,
    '```',
    '',
    '## Evidence index',
    '```',
    evidence,
    '```',
    '',
    '## Recent thread',
    threadLines.length ? threadLines.join('\n') : '(empty)',
    '',
    '## User question',
    clip(question, 4000),
    '',
    'Use tools only. Consult only GT3. Prose alone cannot change the workspace.'
  ].join('\n');
}

/**
 * A descendant's output_spec is read on top of its ancestors (merged realize folds the
 * whole path), so it must carry only its own delta.
 */
function deltaOutputSpecPromptLines() {
  return [
    '   - Everything stated on the path (root → parent) is already inherited: the realizer folds all ancestor output_specs into one SUD.',
    '   - Never restate an ancestor\'s constraints (form, length / word count, subject, tone, presentation, verifiability) — not paraphrased, not as "remains" or "still".',
    '   - Write it so it reads correctly only on top of the parent, in 1–3 sentences (e.g. "The poem\'s imagery is saturated with specific colors and tactile textures of the city.").',
    '   - If the prism contradicts an ancestor constraint, state the override explicitly ("Overrides the parent\'s …: …") instead of copying and altering it.'
  ];
}

/**
 * AGENT_PROMPT for prism expansion: one refining child under the last path node.
 */
export function buildExpandAgentPrompt({ pathNodes, prism }) {
  const nodes = Array.isArray(pathNodes) ? pathNodes : [];
  const parent = nodes[nodes.length - 1] || {};
  const pathLines = nodes.map((n, i) => {
    const label = i === 0 ? 'root' : i === nodes.length - 1 ? 'parent' : `G${i}`;
    return `- ${label}: ${clip(n && n.output_spec, 600)}`;
  });
  return [
    '# OSNG expansion Job (Hanuman / CA)',
    '',
    '**Beloved Hanuman:** Ram has selected one node of the draft OSNG and named a direction in which to expand it.',
    'That direction is a **thematic prism**: refine the selected node through it into exactly **one** descendant OSN.',
    'Consult only **GT3** — the one sun. This is not a realize / SUD-composition Job and does not canonize.',
    '',
    '## Workspace (read first)',
    `- \`${EXPAND_PATH_OSNG}\` — lean envelope of the path root → selected parent (last node is the parent). Read-only.`,
    `- \`${EXPAND_PRISM}\` — the prism (the direction Ram wants the parent expanded in).`,
    '- PROPOSE_BRIEF.json — Job ceremony (parent_osn_id).',
    '',
    '## Method',
    '1. Read the path to understand how the outcome has been refined so far, ending at the parent.',
    '2. Through the prism, compose **exactly one** child that **narrows or deepens** the parent along the prism. The parent may already have other children; yours is an independent refinement of the parent (not a part of a sibling, not a variant of one).',
    '3. Write the child\'s outcome-facing `output_spec` as a **delta**: only what this refinement adds or narrows along the prism.',
    ...deltaOutputSpecPromptLines(),
    '4. Write **exactly one** direct TEXTUAL_SNIPPET success evidence `{ "evidence_id": "ev.direct.textual_snippet.1", "kind": "TEXTUAL_SNIPPET", "direct": true, "inspection_prompt" }` — the single retrieved fragment that best attests the delta, not ancestor constraints already attested above it.',
    ...directEvidencePromptLines(),
    '',
    '## Primary deliverable',
    `Write \`${OSNG_PROPOSAL_PRIMARY}\` as JSON \`{ "root_osn_id": "<child id>", "nodes": [ <the one child> ] }\` — the new child only, never the path nodes.`,
    'The child (finished allowlist only): schema_version "osn/0.2"; id and file_name an opaque new `{uuid}.osn`; owner "Ram";',
    `graph.parent_osn_ids: ["${parent.id || '<parent id>'}"]; graph.child_osn_ids: []; graph.standard_ancestor_osn_ids: []; output_spec; success_evidences.`,
    'No ceremony names (Ram/Hanuman/GT3) in output_spec or evidences.',
    '',
    `Use tools only. Call finish when \`${OSNG_PROPOSAL_PRIMARY}\` is complete.`,
    '',
    '## Path (root → parent)',
    pathLines.length ? pathLines.join('\n') : '(empty)',
    '',
    '## Prism',
    clip(prism, 2000)
  ].join('\n');
}

function leanEnvelopeOrThrow(raw, label) {
  const env = raw && typeof raw === 'object' ? raw : null;
  if (!env || !Array.isArray(env.nodes) || !env.nodes.length) {
    throw httpError(400, `${label} must be a lean envelope { root_osn_id, nodes }`, {
      phase: 'validate',
      reason: 'missing_osng_envelope'
    });
  }
  return {
    root_osn_id:
      typeof env.root_osn_id === 'string' && env.root_osn_id.trim()
        ? env.root_osn_id.trim()
        : String(env.nodes[0].id || '').trim(),
    nodes: env.nodes
  };
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
 * TRH modal LP/RP: same propose CA plugin; contract only differs in AGENT_PROMPT.
 */
export async function startLexiom13ModalChat(repoRoot, body = {}, opts = {}) {
  const question = String(body.question || body.intent || body.narrative || '').trim();
  if (!question) {
    throw httpError(400, 'question must be non-empty', {
      phase: 'validate',
      reason: 'empty_question'
    });
  }
  const contract = String(body.contract || '').trim();
  if (
    contract !== MODAL_CHAT_CONTRACT_LINEAGE &&
    contract !== MODAL_CHAT_CONTRACT_EDIT
  ) {
    throw httpError(
      400,
      `contract must be ${MODAL_CHAT_CONTRACT_LINEAGE} or ${MODAL_CHAT_CONTRACT_EDIT}`,
      { phase: 'validate', reason: 'bad_contract', contract }
    );
  }

  const prior = leanEnvelopeOrThrow(
    body.osng_envelope || body.prior_osng || body.envelope,
    'osng_envelope'
  );
  const focusSample =
    body.focus_sample && typeof body.focus_sample === 'object'
      ? body.focus_sample
      : { serial: null, type: null, status: null };
  const evidenceSummary = body.evidence_summary != null ? body.evidence_summary : [];
  const thread = Array.isArray(body.thread) ? body.thread : [];
  const focusOsnId =
    contract === MODAL_CHAT_CONTRACT_EDIT && typeof body.focus_osn_id === 'string'
      ? body.focus_osn_id.trim()
      : '';

  const runId = makeRunId();
  const outputDirectory = path.join(repoRoot, 'builds', 'lexiom13-propose', runId);
  await fsp.mkdir(outputDirectory, { recursive: true });

  const brief = {
    schema: 'osn/0.2',
    mode: MODAL_CHAT_MODE,
    contract,
    raised_by: 'ram',
    laborer: 'hanuman',
    sun: 'gt3',
    request: 'trh_modal_chat',
    primary: OSNG_PROPOSAL_PRIMARY,
    chat_reply: MODAL_CHAT_REPLY,
    plugin_id: OSNG_PROPOSER_PLUGIN_ID,
    labor: 'hanuman_browser_ca',
    prior_artifact: MODAL_CHAT_PRIOR_OSNG,
    focus_artifact: MODAL_CHAT_FOCUS,
    evidence_artifact: MODAL_CHAT_EVIDENCE,
    ...(focusOsnId ? { focus_osn_id: focusOsnId } : {})
  };

  const handoff = {
    run_id: runId,
    plugin_id: OSNG_PROPOSER_PLUGIN_ID,
    output_directory: outputDirectory,
    intent_preview: clip(question, 160),
    mode: MODAL_CHAT_MODE,
    contract,
    max_descendants_requested: 0,
    max_descendants_effective: 0,
    clamped: false,
    primary: OSNG_PROPOSAL_PRIMARY,
    _started_at: new Date().toISOString(),
    _repo_root: repoRoot
  };

  await fsp.writeFile(path.join(outputDirectory, 'INTENT.md'), question, 'utf8');
  await fsp.writeFile(
    path.join(outputDirectory, MODAL_CHAT_PRIOR_OSNG),
    JSON.stringify(prior, null, 2),
    'utf8'
  );
  await fsp.writeFile(
    path.join(outputDirectory, MODAL_CHAT_FOCUS),
    JSON.stringify(focusSample, null, 2),
    'utf8'
  );
  await fsp.writeFile(
    path.join(outputDirectory, MODAL_CHAT_EVIDENCE),
    JSON.stringify(evidenceSummary, null, 2),
    'utf8'
  );
  const focusContentRaw =
    typeof body.focus_content === 'string' ? body.focus_content : '';
  const focusContent = focusContentRaw.trim()
    ? focusContentRaw.length > MODAL_CHAT_FOCUS_CONTENT_MAX
      ? focusContentRaw.slice(0, MODAL_CHAT_FOCUS_CONTENT_MAX) + '\n\n[…truncated]'
      : focusContentRaw
    : '(No text content available for the focused sample — it may be a software/HTML artifact or still loading.)';
  await fsp.writeFile(
    path.join(outputDirectory, MODAL_CHAT_FOCUS_CONTENT),
    focusContent,
    'utf8'
  );
  // Host-seeded proposal: LP never has to reproduce the garden; RP overwrites it only when revising.
  await fsp.writeFile(
    path.join(outputDirectory, OSNG_PROPOSAL_PRIMARY),
    JSON.stringify(prior, null, 2),
    'utf8'
  );
  await fsp.writeFile(
    path.join(outputDirectory, 'PROPOSE_BRIEF.json'),
    JSON.stringify(brief, null, 2),
    'utf8'
  );
  await fsp.writeFile(
    path.join(outputDirectory, 'AGENT_PROMPT.md'),
    buildModalChatAgentPrompt({
      contract,
      question,
      thread,
      focusSample,
      evidenceSummary,
      focusOsnId
    }),
    'utf8'
  );
  await fsp.writeFile(
    path.join(outputDirectory, 'HANDOFF.json'),
    JSON.stringify(
      {
        run_id: runId,
        plugin_id: OSNG_PROPOSER_PLUGIN_ID,
        primary: OSNG_PROPOSAL_PRIMARY,
        mode: MODAL_CHAT_MODE,
        contract,
        intent_preview: handoff.intent_preview,
        output_directory: outputDirectory,
        max_descendants_requested: 0,
        max_descendants_effective: 0,
        clamped: false
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
      mode: MODAL_CHAT_MODE,
      contract,
      schema: 'osn/0.2',
      labor: 'hanuman_browser_ca',
      note:
        'TRH modal chat. Call gtih.hanuman.serveProposeSession(ca_session), then poll status.'
    },
    detail: `Modal chat Job (${contract}) issued. Poll GET /lexiom13/osn/propose/status/${runId}.`
  };

  await writeRunResult(outputDirectory, started);
  await armPendingProposeJob(
    ticket.session_id,
    handoff,
    ticket.timeout_ms || BUILDER_TIMEOUT_MS,
    `Modal chat timed out after ${Math.round((ticket.timeout_ms || BUILDER_TIMEOUT_MS) / 60000)} minutes (browser CA)`
  );

  return started;
}

/**
 * TRH prism expansion: Hanuman receives only the root → parent path plus the prism,
 * and proposes one refining child (same propose CA plugin).
 */
export async function startLexiom13OsnExpand(repoRoot, body = {}, opts = {}) {
  const prism = String(body.prism || '').trim();
  if (!prism) {
    throw httpError(400, 'prism must be non-empty', {
      phase: 'validate',
      reason: 'empty_prism'
    });
  }
  const rawPath = Array.isArray(body.path_nodes) ? body.path_nodes : [];
  if (!rawPath.length) {
    throw httpError(400, 'path_nodes must list the root → selected parent chain', {
      phase: 'validate',
      reason: 'missing_path_nodes'
    });
  }
  for (const n of rawPath) {
    if (!n || typeof n !== 'object' || typeof n.id !== 'string' || !n.id.trim()) {
      throw httpError(400, 'every path node needs an id', {
        phase: 'validate',
        reason: 'bad_path_node'
      });
    }
  }
  const pathNodes = rawPath.map((n) => normalizeDraftOsn(n, prism));
  const parent = pathNodes[pathNodes.length - 1];
  const pathEnvelope = { root_osn_id: pathNodes[0].id, nodes: pathNodes };

  const runId = makeRunId();
  const outputDirectory = path.join(repoRoot, 'builds', 'lexiom13-propose', runId);
  await fsp.mkdir(outputDirectory, { recursive: true });

  const brief = {
    schema: 'osn/0.2',
    mode: EXPAND_MODE,
    raised_by: 'ram',
    laborer: 'hanuman',
    sun: 'gt3',
    request: 'osng_prism_expansion',
    parent_osn_id: parent.id,
    child_count: EXPAND_CHILD_COUNT,
    primary: OSNG_PROPOSAL_PRIMARY,
    path_artifact: EXPAND_PATH_OSNG,
    prism_artifact: EXPAND_PRISM,
    plugin_id: OSNG_PROPOSER_PLUGIN_ID,
    labor: 'hanuman_browser_ca'
  };
  const handoffFile = {
    run_id: runId,
    plugin_id: OSNG_PROPOSER_PLUGIN_ID,
    primary: OSNG_PROPOSAL_PRIMARY,
    mode: EXPAND_MODE,
    parent_osn_id: parent.id,
    path_osn_ids: pathNodes.map((n) => n.id),
    intent_preview: clip(prism, 160),
    output_directory: outputDirectory,
    max_descendants_requested: EXPAND_CHILD_COUNT,
    max_descendants_effective: EXPAND_CHILD_COUNT,
    clamped: false
  };
  const handoff = {
    ...handoffFile,
    _started_at: new Date().toISOString(),
    _repo_root: repoRoot
  };

  await fsp.writeFile(
    path.join(outputDirectory, 'INTENT.md'),
    `${prism}\n\n(Refine parent ${parent.id})`,
    'utf8'
  );
  await fsp.writeFile(path.join(outputDirectory, EXPAND_PRISM), prism, 'utf8');
  await fsp.writeFile(
    path.join(outputDirectory, EXPAND_PATH_OSNG),
    JSON.stringify(pathEnvelope, null, 2),
    'utf8'
  );
  await fsp.writeFile(
    path.join(outputDirectory, 'PROPOSE_BRIEF.json'),
    JSON.stringify(brief, null, 2),
    'utf8'
  );
  await fsp.writeFile(
    path.join(outputDirectory, 'AGENT_PROMPT.md'),
    buildExpandAgentPrompt({ pathNodes, prism }),
    'utf8'
  );
  await fsp.writeFile(
    path.join(outputDirectory, 'HANDOFF.json'),
    JSON.stringify(handoffFile, null, 2),
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
    parent_osn_id: parent.id,
    meta: {
      mode: EXPAND_MODE,
      schema: 'osn/0.2',
      labor: 'hanuman_browser_ca',
      note: 'Prism expansion. Call gtih.hanuman.serveProposeSession(ca_session), then poll status.'
    },
    detail: `OSN expansion Job issued for ${parent.id}. Poll GET /lexiom13/osn/propose/status/${runId}.`
  };

  await writeRunResult(outputDirectory, started);
  await armPendingProposeJob(
    ticket.session_id,
    handoff,
    ticket.timeout_ms || BUILDER_TIMEOUT_MS,
    `OSN expansion timed out after ${Math.round((ticket.timeout_ms || BUILDER_TIMEOUT_MS) / 60000)} minutes (browser CA)`
  );

  return started;
}

/**
 * Start async propose: prepare workspace + CA ticket. Browser must run Hanuman.
 * When body.mode === 'modal_chat', seeds PRIOR_OSNG + focus and uses contract-specific AGENT_PROMPT
 * (LP lineage_readonly vs RP edit_osng) — same CA plugin / labor loop.
 */
export async function startLexiom13OsngPropose(repoRoot, body = {}, opts = {}) {
  const mode = String(body.mode || '').trim();
  if (mode === MODAL_CHAT_MODE) {
    return startLexiom13ModalChat(repoRoot, body, opts);
  }
  if (mode === EXPAND_MODE) {
    return startLexiom13OsnExpand(repoRoot, body, opts);
  }

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
        'fold_lenses_into_output_spec',
        'compose_success_evidences_from_seed_lenses_output_spec'
      ],
      thematic_lenses_count: 3,
      success_evidences_per_node: 1,
      mid_method_artifacts: [PROPOSE_SEED_ARTIFACT, PROPOSE_LENSES_ARTIFACT],
      finished_node_allowlist: [...OSNG_FINISHED_TOP_KEYS],
      finished_graph_allowlist: [...OSNG_FINISHED_GRAPH_KEYS],
      consult_carries: [
        PROPOSE_SEED_ARTIFACT,
        PROPOSE_LENSES_ARTIFACT,
        'success_evidences'
      ]
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

  if (parsed.reply != null) out.reply = parsed.reply;
  if (parsed.contract != null) out.contract = parsed.contract;
  if (parsed.mode != null) out.mode = parsed.mode;
  if (parsed.proposal_warning != null) out.proposal_warning = parsed.proposal_warning;
  if (status === 'ok' && Array.isArray(parsed.children)) out.children = parsed.children;
  if (parsed.parent_osn_id != null) out.parent_osn_id = parsed.parent_osn_id;

  return out;
}

/**
 * Modal chat finalize: CHAT_REPLY.md is required; the envelope is best-effort.
 * LP returns no envelope (nothing to Apply). RP returns the revised envelope only
 * when it normalizes; otherwise the reply still lands with a proposal_warning.
 */
export async function finalizeModalChatResult(result, handoff, outDir, intent, metaHints = {}) {
  const contract = handoff.contract || null;
  let chatReply = '';
  try {
    chatReply = await fsp.readFile(path.join(outDir, MODAL_CHAT_REPLY), 'utf8');
  } catch {
    chatReply = '';
  }
  if (!chatReply.trim()) {
    result.status = 'agent_failed';
    result.reason = 'chat_reply_missing';
    result.detail = `Modal chat requires ${MODAL_CHAT_REPLY}`;
    result.debug = { phase: 'finalize_modal_chat', reason: 'chat_reply_missing' };
    return;
  }

  let proposalWarning = result.gate_warning ? { ...result.gate_warning } : null;
  let envelope = null;
  if (contract === MODAL_CHAT_CONTRACT_EDIT && !proposalWarning) {
    try {
      const content = await fsp.readFile(path.join(outDir, OSNG_PROPOSAL_PRIMARY), 'utf8');
      // A revision returns the whole tree, whatever its size — never the day-zero single-node cap.
      const normalized = envelopeFromOsngProposalFile(content, intent, {
        ...metaHints,
        any_node_count: true
      });
      let priorIds = [];
      try {
        const prior = JSON.parse(
          await fsp.readFile(path.join(outDir, MODAL_CHAT_PRIOR_OSNG), 'utf8')
        );
        priorIds = (Array.isArray(prior && prior.nodes) ? prior.nodes : [])
          .map((n) => n && n.id)
          .filter(Boolean);
      } catch {
        priorIds = [];
      }
      const reminted = remintProposedOsnIds(
        withSingleDirectEvidence(normalized.nodes, intent),
        { keepIds: priorIds }
      );
      envelope = {
        root_osn_id:
          reminted.idMap.get(String(normalized.root_osn_id)) || normalized.root_osn_id,
        nodes: reminted.nodes
      };
    } catch (e) {
      proposalWarning = {
        reason: e && e.message ? e.message : 'envelope_invalid',
        detail: e && e.message ? e.message : 'Failed to normalize revised OSNG'
      };
    }
  }

  result.status = 'completed';
  result.reply = chatReply.trim();
  result.mode = MODAL_CHAT_MODE;
  result.contract = contract;
  result.envelope = envelope;
  result.proposal_warning = proposalWarning;
  result.detail = result.detail || `Modal chat (${contract || 'unknown'}) reply ready`;
  result.meta = {
    mode: MODAL_CHAT_MODE,
    contract,
    schema: 'osn/0.2',
    labor: 'hanuman_browser_ca',
    note:
      contract === MODAL_CHAT_CONTRACT_LINEAGE
        ? 'Lineage counsel only — no envelope returned; nothing to Apply.'
        : 'Edit-my-OSNG draft — TRH Apply may accept envelope; no auto-canon.'
  };
}

/**
 * Prism expansion finalize: exactly EXPAND_CHILD_COUNT new children, linked to the parent only.
 * Children get host-minted ids; draft siblings must still carry distinct ids.
 * Mutates `result` in place (status, children, …).
 */
export async function finalizeExpandResult(result, handoff, outDir) {
  const parentId = String(handoff.parent_osn_id || '').trim();

  const fail = (reason, detail) => {
    result.status = 'agent_failed';
    result.reason = reason;
    result.detail = detail;
    result.debug = { phase: 'finalize_expand', reason, parent_osn_id: parentId || null };
  };

  let prism = '';
  try {
    prism = await fsp.readFile(path.join(outDir, EXPAND_PRISM), 'utf8');
  } catch {
    prism = '';
  }
  let content = '';
  try {
    content = await fsp.readFile(path.join(outDir, OSNG_PROPOSAL_PRIMARY), 'utf8');
  } catch {
    fail('primary_missing', `Expansion finished without ${OSNG_PROPOSAL_PRIMARY}`);
    return;
  }

  let envelope;
  try {
    envelope = envelopeFromOsngProposalFile(content, prism, {
      max_descendants_effective: EXPAND_CHILD_COUNT
    });
  } catch (e) {
    fail(e && e.message ? e.message : 'envelope_invalid', 'Failed to normalize expansion children');
    return;
  }

  if (envelope.nodes.length !== EXPAND_CHILD_COUNT) {
    fail(
      'expand_child_count',
      `Expansion must propose exactly ${EXPAND_CHILD_COUNT} child${EXPAND_CHILD_COUNT === 1 ? '' : 'ren'} (got ${envelope.nodes.length})`
    );
    return;
  }
  const seen = new Set();
  for (const node of envelope.nodes) {
    if (seen.has(node.id)) {
      fail('expand_id_reused', `Child id ${node.id} is used by more than one sibling`);
      return;
    }
    seen.add(node.id);
  }

  const reminted = remintProposedOsnIds(withSingleDirectEvidence(envelope.nodes, prism));
  const children = reminted.nodes.map((node) => ({
    ...node,
    graph: {
      ...node.graph,
      parent_osn_ids: parentId ? [parentId] : [],
      child_osn_ids: []
    }
  }));

  result.status = 'completed';
  result.mode = EXPAND_MODE;
  result.children = children;
  result.parent_osn_id = parentId || null;
  result.detail = result.detail || `Expansion ready: ${children.length} children under ${parentId}`;
  result.meta = {
    mode: EXPAND_MODE,
    schema: 'osn/0.2',
    labor: 'hanuman_browser_ca',
    note: 'Prism expansion draft — TRH grafts children under the parent; no auto-canon.'
  };
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

      const isModalChat = handoff.mode === MODAL_CHAT_MODE;
      const isExpand = handoff.mode === EXPAND_MODE;
      if (result.status === 'completed' && isModalChat) {
        await finalizeModalChatResult(result, handoff, outDir, intent, metaHints);
      } else if (result.status === 'completed' && isExpand) {
        await finalizeExpandResult(result, handoff, outDir);
      } else if (result.status === 'completed') {
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
            const reminted = remintProposedOsnIds(
              withSingleDirectEvidence(envelope.nodes, intent)
            );
            const rootId =
              reminted.idMap.get(String(envelope.root_osn_id)) ||
              (reminted.nodes[0] && reminted.nodes[0].id);
            result.envelope = { root_osn_id: rootId, nodes: reminted.nodes };
            result.status = 'completed';
            result.detail = result.detail || `OSNG proposal ready: ${rootId}`;
            const effectiveMax =
              metaHints.max_descendants_effective != null
                ? Number(metaHints.max_descendants_effective)
                : 0;
            result.meta = {
              mode: effectiveMax === 0 ? 'naive_single' : 'multi_pending',
              schema: 'osn/0.2',
              max_descendants_requested: metaHints.max_descendants_requested,
              max_descendants_effective: effectiveMax,
              clamped: metaHints.clamped === true,
              labor: 'hanuman_browser_ca',
              note:
                'Draft OSNG only via browser Hanuman. No canon YAML. Multi-node when max_descendants>0 is Follow-up.'
            };
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
        reply: result.reply != null ? result.reply : null,
        mode: result.mode || handoff.mode || null,
        contract: result.contract || handoff.contract || null,
        proposal_warning: result.proposal_warning || null,
        children: result.children || null,
        parent_osn_id: result.parent_osn_id || handoff.parent_osn_id || null,
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
