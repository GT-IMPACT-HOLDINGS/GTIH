/**
 * Lexiom 1.4 — single-YAML-OSN generation (POC).
 * Lexiom owns osn/0.2 skeleton, hemisphere rules, and GT3 inference prompt.
 * Verticals send only an outcome description.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import {
  bumpStructureRevision,
  emitSessionEvent
} from './lexiom14Sessions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OSN_DIR = path.join(ROOT, 'public', 'gt2', 'Lexiom_1_4', 'osn');
const SKELETON_PATH = path.join(OSN_DIR, 'document.skeleton.osn.yaml');
const SYSTEM_PROMPT_PATH = path.join(OSN_DIR, 'generate-system-prompt.md');

const INFERENCE_TIMEOUT_MS = 25000;

function msg(role, text) {
  return {
    id: 'msg_' + crypto.randomBytes(6).toString('hex'),
    role,
    text,
    created_at: new Date().toISOString()
  };
}

function loadSkeletonObject() {
  const raw = fs.readFileSync(SKELETON_PATH, 'utf8');
  return yaml.load(raw);
}

function loadSystemPrompt() {
  const intro = fs.readFileSync(SYSTEM_PROMPT_PATH, 'utf8').trim();
  const skeleton = fs.readFileSync(SKELETON_PATH, 'utf8').trim();
  return `${intro}\n\n${skeleton}\n`;
}

function slugFromText(text) {
  const slug = String(text || 'outcome')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
  return slug || 'outcome';
}

function uniqueId() {
  return crypto.randomBytes(4).toString('hex');
}

function dumpOsn(osn) {
  return yaml.dump(osn, {
    lineWidth: 88,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false
  });
}

function clip(text, n) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '…';
}

function firstDirectEvidence(osn) {
  const list = Array.isArray(osn?.success_evidences) ? osn.success_evidences : [];
  return list.find((e) => e && e.direct) || list[0] || null;
}

/**
 * @param {object} osn
 * @returns {string|null} error code
 */
export function validateGeneratedOsn(osn) {
  if (!osn || typeof osn !== 'object' || Array.isArray(osn)) return 'osn_not_object';
  if (!String(osn.output_spec || '').trim()) return 'missing_output_spec';
  const evidences = osn.success_evidences;
  if (!Array.isArray(evidences) || !evidences.length) return 'missing_success_evidences';
  const direct = evidences.find(
    (e) => e && e.direct === true && String(e.kind || '').toUpperCase() === 'TEXTUAL_SNIPPET'
  );
  if (!direct) return 'missing_direct_textual_snippet';
  if (!String(direct.inspection_prompt || '').trim()) return 'missing_inspection_prompt';
  return null;
}

/**
 * Fill Lexiom-owned skeleton from a single outcome description (no LM).
 * @param {string} outcomeDescription
 */
export function fillSkeletonFromPrompt(outcomeDescription) {
  const osn = loadSkeletonObject();
  const desc = String(outcomeDescription || '').trim();
  const id = `TRH.Outcome.${slugFromText(desc)}.${uniqueId()}.osn`;
  osn.schema_version = 'osn/0.2';
  osn.id = id;
  osn.file_name = id;
  osn.node_type = 'document';
  osn.title = clip(desc, 80) || 'Untitled outcome';
  osn.seed = desc;
  osn.output_spec = [
    `Deliver a readable markdown document that realizes the following outcome:`,
    '',
    desc,
    '',
    'The document must state purpose, the intended outcome, and how a human can inspect success from the delivered prose.'
  ].join('\n');
  const ev = Array.isArray(osn.success_evidences) ? osn.success_evidences[0] : null;
  if (ev) {
    ev.kind = 'TEXTUAL_SNIPPET';
    ev.direct = true;
    ev.inspection_prompt =
      'Open the delivered document.md. Confirm the opening prose names the intended outcome and is readable enough for a human to approve as direct Success Evidence.';
  }
  osn.compilation = osn.compilation || {};
  osn.compilation.target_tool_profile = 'document_builder';
  return osn;
}

function stripYamlFences(text) {
  let s = String(text || '').trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:yaml|yml)?\s*/i, '').replace(/```\s*$/, '');
  }
  return s.trim();
}

function parseOsnYaml(text) {
  const stripped = stripYamlFences(text);
  const parsed = yaml.load(stripped);
  const code = validateGeneratedOsn(parsed);
  if (code) {
    const err = new Error(code);
    err.code = 'osn_generate_failed';
    err.details = { reason: code };
    throw err;
  }
  return { osn: parsed, yamlText: dumpOsn(parsed) };
}

function inferenceLikelyAvailable() {
  const provider = String(process.env.LLM_PROVIDER || 'openrouter').toLowerCase();
  if (provider === 'mock' || provider === 'ollama') return true;
  return Boolean(
    process.env.OPENROUTER_API_KEY ||
      process.env.GT3_LEXIOM_DEMO_KEY ||
      process.env.OPENAI_API_KEY
  );
}

async function callGt3Inference(outcomeDescription) {
  const port = parseInt(process.env.PORT || '8080', 10);
  const url = `http://127.0.0.1:${port}/inference`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), INFERENCE_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GT3-Tenant': 'gt2-lexiom-demo'
      },
      body: JSON.stringify({
        narrative: outcomeDescription,
        system: loadSystemPrompt()
      }),
      signal: controller.signal
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(body.detail || `inference_http_${res.status}`);
      err.code = 'inference_unavailable';
      throw err;
    }
    const text = typeof body.response === 'string' ? body.response : '';
    if (!text.trim()) {
      const err = new Error('empty_inference_response');
      err.code = 'inference_unavailable';
      throw err;
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
}

function applyOsnStructure(session, osn) {
  const title = String(osn.title || session.case_label || 'outcome').trim();
  const outputSpec = String(osn.output_spec || '').trim();
  const ev = firstDirectEvidence(osn);
  const evidenceSummary = String(ev?.inspection_prompt || '').trim();

  session.structure.nodes = [
    { id: 'node_root', title, kind: 'outcome', parent_ids: [] },
    {
      id: 'node_output',
      title: 'Output specification',
      kind: 'output_spec',
      parent_ids: ['node_root']
    },
    {
      id: 'node_evidence',
      title: 'Success evidences',
      kind: 'success_evidence',
      parent_ids: ['node_root']
    }
  ];
  session.structure.hemispheres = {
    output_spec_ready: true,
    success_evidence_ready: true,
    output_spec_summary: clip(outputSpec, 280),
    success_evidence_summary: clip(evidenceSummary, 280)
  };
  bumpStructureRevision(session);
  session.build_readiness = {
    ready: true,
    reasons: [],
    hemispheres: {
      output_spec_ready: true,
      success_evidence_ready: true
    }
  };
}

function emitStructureEvents(session, intent) {
  emitSessionEvent(session.session_id, 'structureUpdated', {
    structure: session.structure
  });
  emitSessionEvent(session.session_id, 'intentUpdated', { summary: intent });
  emitSessionEvent(session.session_id, 'buildReadinessChanged', {
    readiness: session.build_readiness
  });
}

/**
 * @param {object} session
 * @param {{ outcome_description: string }} body
 */
export async function generateOsnForSession(session, body) {
  const description = String(body?.outcome_description || '').trim();
  if (!description) {
    const err = new Error('empty_outcome_description');
    err.code = 'empty_outcome_description';
    throw err;
  }

  session.status = 'running';

  const userMessage = msg('user', description);
  session.messages.push(userMessage);
  emitSessionEvent(session.session_id, 'messageAccepted', {
    client_message_id: body.client_message_id || null,
    message: userMessage
  });

  let osn;
  let yamlText;
  let source = 'template';

  const tryParse = (text) => parseOsnYaml(text);

  if (inferenceLikelyAvailable()) {
    try {
      let raw = await callGt3Inference(description);
      try {
        ({ osn, yamlText } = tryParse(raw));
        source = 'inference';
      } catch {
        raw = await callGt3Inference(description);
        ({ osn, yamlText } = tryParse(raw));
        source = 'inference';
      }
    } catch (e) {
      emitSessionEvent(session.session_id, 'warning', {
        warning: {
          code: e.code || 'inference_unavailable',
          message:
            e.code === 'osn_generate_failed'
              ? 'GT3 inference YAML was not a valid OSN; Lexiom filled the document skeleton from the outcome description'
              : 'GT3 inference unavailable; Lexiom filled the document OSN skeleton from the outcome description',
          retryable: false
        }
      });
    }
  }

  if (!osn) {
    osn = fillSkeletonFromPrompt(description);
    yamlText = dumpOsn(osn);
    source = 'template';
  }

  session.osn = osn;
  session.osn_yaml = yamlText;
  session.osn_source = source;

  applyOsnStructure(session, osn);

  const assistantMessage = msg(
    'assistant',
    'Outcome structure is ready. You can Realize a document package when you wish. Output Specifications and Success Evidences were shaped from your description.'
  );
  session.messages.push(assistantMessage);
  emitSessionEvent(session.session_id, 'questionGenerated', {
    message: assistantMessage
  });
  emitStructureEvents(session, String(osn.title || description));

  session.status = 'completed';
  return {
    structure: session.structure,
    build_readiness: session.build_readiness,
    osn_yaml: session.osn_yaml
  };
}
