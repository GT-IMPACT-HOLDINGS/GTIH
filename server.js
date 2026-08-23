// =============================================================
// GT3 POC Node.js Server
// Version: v.poc.017
// (ESM, +Ollama, +OpenAI GPT-4o-mini,
//  dual/single flag, GT2 static serve, training-example storage,
//  ops summary with total traffic counters, enhanced error logging,
//  per-request API-key overrides for OpenRouter/OpenAI,
//  /inferences endpoint + static log-file serving,
//  /training-examples listing + static training_examples serving,
//  root static (including /favicon.ico from public),
//  builds/ static on a dedicated port (default 8081))
// =============================================================

// Load repo-root `.env` before any process.env reads below (dotenv is a declared dependency).
import 'dotenv/config';

import fs from 'fs';
import { promises as fsp } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import crypto from 'crypto';
import ollama from 'ollama'; // local LLM client
import { LEXIOM_NARRATIVE_CONTRACT_VERSION } from './lib/lexiomNarrativeContract.js';
import {
  SESSION_EVENTS_FILENAME,
  SESSION_EVENT_SCHEMA_V1,
  validateSessionEventBody,
  gameRecordDirHasSessionEvents,
  readSessionEvents,
  groupSessionEvents,
  sessionEventTimeBounds
} from './lib/lexiomSessionEvents.js';
import {
  reloadAllDistilledFiles,
  buildLovingUserMessage,
  getDistilledMeta,
  buildValidExpressionProfileSet,
  normalizeExpressionProfileId,
  listExpressionSkillsForOps,
  getExpressionSkillsDir
} from './lib/gt3ExpressionProfiles.js';
import { mockOddGraphicsPngBase64 } from './lib/oddMockPng128.js';
import {
  GT3_DEFAULT_OPENROUTER_IMAGE_MODEL,
  openRouterGenerateImage
} from './lib/gt3OpenRouterImage.js';
import {
  canonizeLexiom13Osn,
  listLexiom13OsnYamlPaths,
  saveLexiom13Osn
} from './lib/lexiom13OsnPersist.js';
import {
  prepareLexiom13Build,
  runLexiom13Build,
  readLexiom13BuildStatus,
  listRecentAgentRuns,
  readSessionWorkspace,
  readSessionWorkspaceFile,
  writeSessionArtifacts,
  reportLexiom13CaSession,
  heartbeatCaSession,
  cancelCaSession,
  CA_LOCATION_BROWSER_SESSION,
  EXECUTOR_ID
} from './lib/lexiom13BuildPlugins.js';
import { readAgentRuntimeBringup } from './lib/gt3AgentRuntimeBringup.js';
import {
  DEFAULT_AGENT_OPENROUTER_MODEL,
  handleAgentChatCompletions
} from './lib/gt3AgentOpenAiProxy.js';
import {
  isValidExchangeId,
  readLmExchange
} from './lib/gt3LmExchangeObservability.js';
import {
  listFocusEvidenceCollections,
  resolveEvidenceArtifactFile
} from './lib/lexiom13EvidenceCockpitSync.js';
import {
  resolveBudArtifactFile,
  resolveBudPreviewFile
} from './lib/lexiom13BudServe.js';
import { createLexiom14Router, applyLexiom14Cors } from './lib/lexiom14Routes.js';

// ---- ESM __dirname shim ----
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- Config ----------
// Defaults when env vars are not set:
//   Provider: openrouter
//   Model:   openai/gpt-4o-mini (via OpenRouter)
//   Inference: GT3_INFERENCE_MODE single|dual|loving_only (legacy: GT3_DUAL_INFERENCE)
//              default fallback is loving_only
//   Expression profile: GT3_EXPRESSION_PROFILE (default fallback is shefa)
//   Builds static: GT3_BUILDS_PORT (default 8081; set 0 to disable)
const PORT = parseInt(process.env.PORT || '8080', 10);
const BUILDS_PORT = parseInt(process.env.GT3_BUILDS_PORT || '8081', 10);

// OpenRouter config
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
// ODD / image generation via OpenRouter (Seedream 4.5 default)
const GT3_OPENROUTER_IMAGE_MODEL =
  process.env.GT3_OPENROUTER_IMAGE_MODEL || GT3_DEFAULT_OPENROUTER_IMAGE_MODEL;

// OpenAI config (GPT-4o-mini)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// Lexiom demo key (used only for tenant gt2-lexiom-demo when no client key is provided)
const GT3_LEXIOM_DEMO_KEY = process.env.GT3_LEXIOM_DEMO_KEY || '';

// Agent broker (VAL /v1) — separate OpenRouter key for build/evidence cost tracking
const GT3_LEXIOM_AGENT_KEY = process.env.GT3_LEXIOM_AGENT_KEY || '';
const GT3_AGENT_OPENROUTER_MODEL =
  process.env.GT3_AGENT_OPENROUTER_MODEL || DEFAULT_AGENT_OPENROUTER_MODEL;
const GT3_AGENT_OBSERVABILITY_MAX_CHARS = Math.max(
  10_000,
  parseInt(process.env.GT3_AGENT_OBSERVABILITY_MAX_CHARS || '2000000', 10) ||
    2_000_000
);
const GT3_AGENT_LM_DESTINATION = Object.freeze({
  id: 'openrouter',
  label: 'OpenRouter',
  transport: 'openai_compatible_http',
  locality: 'remote',
  endpoint_kind: 'chat_completions',
  endpoint_url: 'https://openrouter.ai/api/v1/chat/completions'
});

reloadAllDistilledFiles();

const GT3_VALID_INFERENCE_MODES = new Set(['single', 'dual', 'loving_only']);

function parseInitialInferenceMode() {
  const fromEnv = (process.env.GT3_INFERENCE_MODE || '').trim().toLowerCase();
  if (GT3_VALID_INFERENCE_MODES.has(fromEnv)) return fromEnv;
  if ((process.env.GT3_DUAL_INFERENCE || 'false').toLowerCase() === 'true') {
    return 'dual';
  }
  return 'loving_only';
}

/** Mutable LLM settings (env seeds; POST /ops/config may update). */
const gt3RuntimeLlm = {
  provider: (process.env.LLM_PROVIDER || 'openrouter').toLowerCase(),
  inferenceMode: parseInitialInferenceMode(),
  openrouterModel: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  ollamaModel: process.env.OLLAMA_MODEL || 'llama3.1',
  expressionProfile: (() => {
    const e = normalizeExpressionProfileId(
      process.env.GT3_EXPRESSION_PROFILE || 'shefa'
    );
    const valid = buildValidExpressionProfileSet();
    if (!valid.has(e)) {
      if (
        process.env.GT3_EXPRESSION_PROFILE &&
        String(process.env.GT3_EXPRESSION_PROFILE).trim()
      ) {
        console.warn(
          `[gt3] Invalid GT3_EXPRESSION_PROFILE="${process.env.GT3_EXPRESSION_PROFILE}", using none`
        );
      }
      return 'none';
    }
    return e;
  })()
};

const CORS_ORIGINS = (process.env.CORS_ORIGINS || '*')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const LEDGER_PATH = process.env.LEDGER_PATH || 'ledger.jsonl';
const SERVER_VERSION = 'v.poc.017';

// Server start timestamp (for uptime)
const PROCESS_START_TS = Date.now();

// ---------- Startup: ensure ledger + dirs ----------
try {
  if (!fs.existsSync(LEDGER_PATH)) {
    fs.writeFileSync(LEDGER_PATH, '', 'utf-8');
  }
} catch {}
const LOG_DIR = path.join(__dirname, 'logs');
await fsp.mkdir(LOG_DIR, { recursive: true }).catch(() => {});

// Directory for persisted training examples
const TRAINING_DIR = path.join(__dirname, 'training_examples');
await fsp.mkdir(TRAINING_DIR, { recursive: true }).catch(() => {});

// Lexiom 1.3 (and future) build outputs — served on BUILDS_PORT, not on PORT
const BUILDS_ROOT = path.join(__dirname, 'builds');
await fsp.mkdir(BUILDS_ROOT, { recursive: true }).catch(() => {});

/** Cached agent-runtime bringup (VAL Step 2). Missing/failed never blocks HTTP listen. */
let agentRuntimeBringup = await readAgentRuntimeBringup(__dirname).catch((e) => ({
  bringup_status: 'unknown',
  detail: e && e.message ? String(e.message) : String(e),
  docker: null,
  image: null,
  agentfs: null,
  aider: null,
  runtime_dir: path.join(__dirname, '.gt3-agent-runtime'),
  status_path: path.join(__dirname, '.gt3-agent-runtime', 'BRINGUP_STATUS.json'),
  manifest_path: path.join(__dirname, '.gt3-agent-runtime', 'manifest.json'),
  read_at: new Date().toISOString()
}));

// In-memory ops events buffer (for /ops/summary)
const OPS_EVENTS = [];

// Total counters since process start (for traffic_total)
let TOTAL_INFERENCE = 0;
let TOTAL_TRAINING = 0;

/** Agent broker lane counters (VAL Step 3) — separate from product inference. */
let TOTAL_AGENT_BROKER_OK = 0;
let TOTAL_AGENT_BROKER_ERROR = 0;
let LAST_AGENT_ERROR_DETAIL = null;

// ---------- App ----------
const app = express();
// Larger body for append-only CA tool history; product routes keep 1mb.
app.use('/v1', express.json({ limit: '8mb' }));
app.use('/lexiom13/build/session', express.json({ limit: '12mb' }));
app.use(express.json({ limit: '1mb' }));
// Lexiom 1.4 CORS must run before global cors() so OPTIONS is not answered with *.
app.use('/lexiom14', (req, res, next) => {
  applyLexiom14Cors(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});
if (CORS_ORIGINS.includes('*')) app.use(cors());
else app.use(cors({ origin: CORS_ORIGINS, credentials: true }));
app.use(morgan('dev'));

/** WebContainers require COOP/COEP for SharedArrayBuffer on Lexiom 1.3 SPA. */
function lexiom13CrossOriginIsolation(req, res, next) {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  next();
}
app.use('/gt2/Lexiom_1_3', lexiom13CrossOriginIsolation);
app.use('/gt2/lexiom_1_3', lexiom13CrossOriginIsolation);

// Lexiom 1.4 embedded-SaaS API (vertical SDK / TRH). Does not modify Lexiom 1.3.
app.use('/lexiom14', createLexiom14Router());

// =============================================================
// STATIC SERVE for GT2 vertical apps (Legato, QuoteMe) and GT3 console
// Folder structure (relative to this server file):
//   public/favicon.ico
//   public/gt2/legato/index.html          (Legato - legal-tech vertical)
//   public/gt2/legato/case-lifecycle.html
//   public/gt2/legato/ep.html
//   public/gt2/QuoteMe/index.html        (QuoteMe - sales proposal vertical)
//   public/gt2/QuoteMe/profile.html
//   public/gt2/QuoteMe/opportunity.html
//   public/gt2/QuoteMe/ep.html
//   public/gt2/QuoteMe/pa.html
//   public/gt2/QuoteMe/admin.html
//   public/gt3/gt3.html (ops console)
//
// URLs (same origin as /inference):
//   http://localhost:8080/                    (root static, incl. /favicon.ico)
//   http://localhost:8080/gt2/legato/         (Legato SPA)
//   http://localhost:8080/gt2/QuoteMe/        (QuoteMe SPA)
//   http://localhost:8080/gt3/gt3.html        (GT3 Ops Console)
//   http://localhost:8080/logs/....txt       (per-inference debug logs)
//   http://localhost:8080/training_examples/....json (training example records)
// =============================================================
const STATIC_ROOT = path.join(__dirname, 'public');
const LEXIOM_LANDING_PATH = path.join(STATIC_ROOT, 'gt2', 'Lexiom', 'landing.html');
const LEXIOM_STATIC_ROOT = path.join(STATIC_ROOT, 'gt2', 'Lexiom');

function lexiomPublishedResourceIdOk(id) {
  return typeof id === 'string' && /^\d{13,22}$/.test(id);
}

async function findLexiomApprovedFilePath(resourceId) {
  if (!lexiomPublishedResourceIdOk(resourceId)) return null;
  const accordsDir = path.join(STATIC_ROOT, 'gt2', 'Lexiom', 'Accords');
  let names;
  try {
    names = await fsp.readdir(accordsDir);
  } catch {
    return null;
  }
  const suffix = `.${resourceId}.md`;
  const hit = names.find(
    (n) => typeof n === 'string' && n.startsWith('lexiom_approved_') && n.endsWith(suffix)
  );
  return hit ? path.join(accordsDir, hit) : null;
}

function escapeHtmlText(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function markdownToPdfPlainText(md) {
  return String(md || '')
    .replace(/\r\n/g, '\n')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

// Lexiom seed file: always no-store so editing the file and refreshing loads fresh content
const LEXIOM_SEED_PATH = path.join(STATIC_ROOT, 'gt2', 'Lexiom', 'meeting_with_client.md');
app.get('/gt2/Lexiom/meeting_with_client.md', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.sendFile(LEXIOM_SEED_PATH, (err) => {
    if (err) res.status(err.status || 500).end();
  });
});
// Lowercase alias for Linux/EB case-sensitive filesystems.
app.get('/gt2/lexiom/meeting_with_client.md', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.sendFile(LEXIOM_SEED_PATH, (err) => {
    if (err) res.status(err.status || 500).end();
  });
});

// Canonicalize Lexiom entry URLs so relative asset paths resolve under /gt2/.../ (with trailing slash).
app.get('/gt2/Lexiom', (req, res) => {
  res.redirect(301, '/gt2/Lexiom/');
});
app.get('/gt2/lexiom', (req, res) => {
  res.redirect(301, '/gt2/lexiom/');
});

// Lexiom newcomer entry: pre-SPA landing page
app.get('/gt2/Lexiom/', (req, res) => {
  res.sendFile(LEXIOM_LANDING_PATH, (err) => {
    if (err) res.status(err.status || 500).end();
  });
});
app.get('/gt2/lexiom/', (req, res) => {
  res.sendFile(LEXIOM_LANDING_PATH, (err) => {
    if (err) res.status(err.status || 500).end();
  });
});

// Serve everything under /public at the root (including /favicon.ico)
app.use(express.static(STATIC_ROOT));

app.use('/gt2', express.static(path.join(STATIC_ROOT, 'gt2')));
// Lowercase Lexiom alias for assets requested under /gt2/lexiom/*.
app.use('/gt2/lexiom', express.static(LEXIOM_STATIC_ROOT));
app.use('/gt3', express.static(path.join(STATIC_ROOT, 'gt3')));

// Raw inference + session files under /logs/<uuid>/…
// express.static uses `send`, which sets Content-Security-Policy: default-src 'none' on
// directory redirects and small HTML error bodies. That CSP blocks the browser's
// automatic favicon fetch and surfaces noisy console errors when opening /logs/…/ in a tab.
// We still serve the same responses; we only omit CSP for this mount so admins can browse.
function stripSendStaticCspForLogs(req, res, next) {
  if (!req.originalUrl.startsWith('/logs')) {
    return next();
  }
  const origSetHeader = res.setHeader.bind(res);
  res.setHeader = function stripCsp(name, value) {
    if (String(name).toLowerCase() === 'content-security-policy') {
      return;
    }
    return origSetHeader(name, value);
  };
  next();
}

// Expose raw training-example JSON files for GT3 training tab hyperlinks
app.use('/training_examples', express.static(TRAINING_DIR));

// Optional convenience redirect: root → GT2 Legato
app.get('/', (req, res) => {
  res.redirect('/gt2/legato/');
});

// ---------- Helpers ----------
function nowIso() {
  return new Date().toISOString();
}

// NOTE: now logs both ts and ts_iso for easier consumption by GT3 UI
async function ledgerLog(event) {
  const ts = nowIso();
  const line = JSON.stringify({ ts, ts_iso: ts, ...event }) + '\n';
  await fsp.appendFile(LEDGER_PATH, line, 'utf-8').catch(e =>
    console.error('ledger_error', e)
  );
}

async function appendLog(file, section, content) {
  const line = `=== ${section} ===\n${content}\n\n`;
  await fsp.appendFile(file, line, 'utf-8').catch(e =>
    console.error('logfile_error', e)
  );
}

// Rough token estimator (4 chars ≈ 1 token)
function estimateTokens(text) {
  const s = (text || '').toString();
  if (!s.length) return 0;
  return Math.ceil(s.length / 4);
}

function safePreview(text, max = 300) {
  if (!text) return '';
  const s = String(text);
  return s.length <= max ? s : s.slice(0, max) + '...';
}

/** Single path segment, UUID shape — used for logs/<uuid>/ inference folders. */
function sanitizeGameRecordId(raw) {
  if (raw == null || typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s || s.includes('..') || s.includes('/') || s.includes('\\')) return null;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
  ) {
    return null;
  }
  return s;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** For inference log filenames (phrase.uuid.txt), return HTML with the phrase in bold. */
function formatLogFileNameWithBoldPhrase(name) {
  const m = name.match(
    /^(.+?)\.([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.txt$/i
  );
  if (!m) return escapeHtml(name);
  return '<strong>' + escapeHtml(m[1]) + '</strong>' + escapeHtml('.' + m[2] + '.txt');
}

/** In-band phrases to exclude from log rename (e.g. instruction examples LM may copy). */
const PHRASE_RENAME_BLOCKLIST = new Set([
  '_L23_Clarify_dispute_summary_key_claims',
  '_L24_Draft_dispute_summary_key_claims',
  '_L24_Draft_goals_draft_strategy_proposal',
  '_LP_Draft_dispute_summary_key_claims',
  '_RP_Draft_dispute_summary_key_claims'
]);

/**
 * Extract and strip the in-band phrase (last continuous non-whitespace token).
 * Deterministic: the phrase is everything beyond the last whitespace. Only strip when
 * the last token begins with underscore "_" (the in-band signaling mark).
 * @param {string} text - Raw LM response
 * @returns {{ phrase: string|null, displayText: string }}
 */
function extractAndStripInBand(text) {
  if (!text || typeof text !== 'string') return { phrase: null, displayText: text || '' };
  const trimmed = String(text).trimEnd();
  // #region agent log
  if (trimmed.includes('_L24_Draft_') || trimmed.includes('_L23_Clarify_') || trimmed.includes('_LP_Draft_') || trimmed.includes('_RP_Draft_')) {
    fetch('http://127.0.0.1:7318/ingest/66b2ba87-3e5b-4e81-97da-c0fb8e5eb34d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8974af'},body:JSON.stringify({sessionId:'8974af',runId:'pre-fix',hypothesisId:'H1',location:'server.js:extractAndStripInBand:entry',message:'in-band marker seen in rawText',data:{tail:trimmed.slice(Math.max(0, trimmed.length - 180))},timestamp:Date.now()})}).catch(()=>{});
  }
  // #endregion
  const normalizeEdgePunctuation = (token) =>
    String(token || '')
      .replace(/^[`"'“”‘’()[\]{}<>]+/, '')
      .replace(/[`"'“”‘’()[\]{}<>.,;:!?]+$/, '');

  // Fast path: last whitespace token starts with underscore.
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (!tokens.length) return { phrase: null, displayText: trimmed };
  const lastToken = tokens[tokens.length - 1];
  const normalizedLast = normalizeEdgePunctuation(lastToken);
  if (normalizedLast && normalizedLast.startsWith('_')) {
    // Compute how much of the string belongs to the last token.
    const displayText = trimmed.slice(0, trimmed.lastIndexOf(lastToken)).trimEnd();
    // #region agent log
    fetch('http://127.0.0.1:7318/ingest/66b2ba87-3e5b-4e81-97da-c0fb8e5eb34d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8974af'},body:JSON.stringify({sessionId:'8974af',runId:'pre-fix',hypothesisId:'H1',location:'server.js:extractAndStripInBand:fastPath',message:'fast-path strip applied',data:{lastToken,normalizedLast,displayTail:displayText.slice(Math.max(0, displayText.length - 120))},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return {
      phrase: normalizedLast.length > 120 ? null : normalizedLast,
      displayText
    };
  }

  // Recovery: if the last token doesn't start with '_', but an earlier token does,
  // attempt to stitch from the last underscore-prefixed token to the end using '_' instead of whitespace.
  // This prevents log renaming failures when the model emits accidental spaces inside the in-band phrase.
  for (let i = tokens.length - 2; i >= 0; i--) {
    const t = tokens[i];
    const normalized = normalizeEdgePunctuation(t);
    if (!normalized || !normalized.startsWith('_')) continue;
    const pos = trimmed.lastIndexOf(t);
    if (pos < 0) break;
    const rawPhrase = trimmed.slice(pos);
    const stitched = rawPhrase
      .split(/\s+/)
      .map(normalizeEdgePunctuation)
      .filter(Boolean)
      .join('_');
    const displayText = trimmed.slice(0, pos).trimEnd();
    // #region agent log
    fetch('http://127.0.0.1:7318/ingest/66b2ba87-3e5b-4e81-97da-c0fb8e5eb34d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8974af'},body:JSON.stringify({sessionId:'8974af',runId:'pre-fix',hypothesisId:'H1',location:'server.js:extractAndStripInBand:recoveryPath',message:'recovery-path strip applied',data:{pivotToken:t,normalizedPivot:normalized,stitched,displayTail:displayText.slice(Math.max(0, displayText.length - 120))},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return {
      phrase: stitched.length > 120 ? null : stitched,
      displayText
    };
  }

  return { phrase: null, displayText: trimmed };
}

/** Human-readable local time for HTML admin pages (server has no user locale). */
function formatHumanLocalTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'medium'
  });
}

// express.static does not generate directory listings; a bare /logs/<uuid>/ URL 404s
// unless an index file exists. This route provides an admin-friendly file list.
app.get('/logs/browse/:id', async (req, res) => {
  const id = sanitizeGameRecordId(req.params.id);
  if (!id) {
    return res.status(400).type('text').send('Invalid game record id');
  }
  const absDir = path.join(LOG_DIR, id);
  let dirStat;
  try {
    dirStat = await fsp.stat(absDir);
    if (!dirStat.isDirectory()) {
      return res.status(404).type('text').send('Not found');
    }
  } catch {
    return res.status(404).type('text').send('Not found');
  }
  let entries;
  try {
    entries = await fsp.readdir(absDir, { withFileTypes: true });
  } catch (e) {
    console.error('logs_browse_readdir', e);
    return res.status(500).type('text').send('Failed to read directory');
  }
  const fileEntries = entries.filter(e => e.isFile());
  const fileStats = await Promise.all(
    fileEntries.map(async (e) => {
      let mtime = 0;
      try {
        const st = await fsp.stat(path.join(absDir, e.name));
        mtime = st.mtimeMs || st.mtime.getTime();
      } catch {
        /* keep 0 */
      }
      return { name: e.name, mtime };
    })
  );
  fileStats.sort((a, b) => b.mtime - a.mtime);

  const subdirs = entries
    .filter(e => e.isDirectory())
    .map(e => e.name)
    .sort((a, b) => a.localeCompare(b));

  const folderMtimeHuman = formatHumanLocalTime(dirStat.mtime);

  const accordionItems = [];
  fileStats.forEach(({ name, mtime }, i) => {
    const mtimeHuman = mtime ? formatHumanLocalTime(new Date(mtime)) : '—';
    const fileUrl = '/logs/' + encodeURIComponent(id) + '/' + encodeURIComponent(name);
    const collapseId = 'collapse-' + i;
    accordionItems.push(
      '<div class="accordion-item">' +
        '<h2 class="accordion-header">' +
        '<button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#' +
        collapseId +
        '" aria-expanded="false" aria-controls="' +
        collapseId +
        '" data-file-url="' +
        escapeHtml(fileUrl) +
        '">' +
        formatLogFileNameWithBoldPhrase(name) +
        ' <span class="text-muted ms-2" style="font-size:0.85em">· ' +
        escapeHtml(mtimeHuman) +
        '</span></button></h2>' +
        '<div id="' +
        collapseId +
        '" class="accordion-collapse collapse" data-bs-parent="#logsAccordion" data-file-url="' +
        escapeHtml(fileUrl) +
        '">' +
        '<div class="accordion-body p-2">' +
        '<pre class="log-content mb-0 small" style="white-space:pre-wrap;max-height:50vh;overflow:auto">Loading…</pre>' +
        '</div></div></div>'
    );
  });

  let body = '';
  if (fileStats.length) {
    body +=
      '<div class="accordion" id="logsAccordion">' +
      accordionItems.join('') +
      '</div>';
  }
  if (subdirs.length) {
    body +=
      '<p class="mt-3 mb-1"><strong>Subfolders:</strong></p><ul class="list-unstyled">' +
      subdirs
        .map(
          (n) =>
            '<li><span class="text-muted">' + escapeHtml(n) + '/</span> <em>(subfolder)</em></li>'
        )
        .join('') +
      '</ul>';
  }
  if (!body) body = '<p><em>Empty folder.</em></p>';

  const html =
    '<!DOCTYPE html>\n' +
    '<html lang="en">\n' +
    '<head>\n' +
    '<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<title>Logs — ' +
    escapeHtml(id) +
    '</title>\n' +
    '<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">\n' +
    '</head>\n' +
    '<body class="p-4">\n' +
    '<h1>Case log folder</h1>\n' +
    '<p class="text-muted">Game record <code>' +
    escapeHtml(id) +
    '</code></p>\n' +
    '<p class="text-muted small">Folder last modified: <strong>' +
    escapeHtml(folderMtimeHuman) +
    '</strong></p>\n' +
    body +
    '\n<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>\n' +
    '<script>\n' +
    'document.getElementById("logsAccordion")?.addEventListener("shown.bs.collapse", function(e) {\n' +
    '  const panel = e.target;\n' +
    '  const url = panel.dataset.fileUrl;\n' +
    '  const pre = panel.querySelector(".log-content");\n' +
    '  if (!url || !pre || pre.dataset.loaded) return;\n' +
    '  pre.dataset.loaded = "1";\n' +
    '  fetch(url).then(r=>r.text()).then(t=>{ pre.textContent = t || "(empty)"; }).catch(()=>{ pre.textContent = "Failed to load."; });\n' +
    '});\n' +
    '</script>\n' +
    '</body>\n</html>\n';

  res.type('html').send(html);
});

app.use('/logs', stripSendStaticCspForLogs, express.static(LOG_DIR));

// Helper to log structured inference errors to the terminal
function logInferenceError({
  variant,
  mode,
  headers,
  narrative,
  provider,
  model,
  error,
  latencyMs
}) {
  const narrativeStr = (narrative || '').toString();
  const base = {
    event: 'inference_error',
    ts: nowIso(),
    server_version: SERVER_VERSION,
    mode: mode || null, // 'single' | 'dual'
    variant: variant || null, // 'loving' | 'original' | 'original_single'
    provider: provider || null,
    model: model || null,
    latency_ms: typeof latencyMs === 'number' ? latencyMs : null,
    tenant: headers?.tenant || null,
    track: headers?.track || null,
    consent: headers?.consent || null,
    idempotency: headers?.idempotency || null,
    narrative_len: narrativeStr.length,
    narrative_token_estimate: estimateTokens(narrativeStr),
    error_name: error?.name || null,
    error_message: error
      ? String(error.message || error)
      : null
  };

  // Optional upstream details if present on the Error object
  if (error && typeof error === 'object') {
    if (error.upstreamStatus) {
      base.upstream_status = error.upstreamStatus;
    }
    if (error.upstreamBodyPreview) {
      base.upstream_body_preview = safePreview(
        error.upstreamBodyPreview,
        300
      );
    }
  }

  console.error(JSON.stringify(base));
}

// Helper to report the model ID used by the current provider
function currentModelId() {
  if (gt3RuntimeLlm.provider === 'ollama') return gt3RuntimeLlm.ollamaModel;
  if (gt3RuntimeLlm.provider === 'openrouter')
    return gt3RuntimeLlm.openrouterModel;
  if (gt3RuntimeLlm.provider === 'openai') return gt3RuntimeLlm.openaiModel;
  return '';
}

// Record an ops event in memory for summary metrics
function recordOpsEvent(kind, headers = {}, extra = {}) {
  const ts = Date.now();
  const tenant = headers.tenant || null;
  const track = headers.track || extra.track || null;

  OPS_EVENTS.push({ ts, kind, tenant, track });

  // Keep only last 1 hour of events to bound memory
  const oneHourAgo = ts - 60 * 60 * 1000;
  while (OPS_EVENTS.length && OPS_EVENTS[0].ts < oneHourAgo) {
    OPS_EVENTS.shift();
  }
}

// ---------- LLM provider router ----------
const DEFAULT_LLM_SYSTEM =
  'You are a concise assistant responding to a single narrative. Output clean, ready-to-display text.';

/** Appended to the system message for loving-variant calls (before user content with expression skills). */
const LOVING_SYSTEM_GT3_NAME_HINT =
  'If the user asks for the name of the language model or assistant used for this inference, say you are GT3 (Generative Team Trained Transformer).';

function mergeLovingSystemPrompt(llmOpts) {
  const base =
    typeof llmOpts.system === 'string' && llmOpts.system.trim()
      ? llmOpts.system.trim()
      : DEFAULT_LLM_SYSTEM;
  return {
    ...llmOpts,
    system: `${base}\n\n${LOVING_SYSTEM_GT3_NAME_HINT}`
  };
}

const LLM_CHAT_DEFAULTS = { temperature: 0.3, max_tokens: 2048 };

/** Same system/user resolution as `llmGenerate` (single source of truth for logs + upstream). */
function resolveEffectiveLlmChat(llmOptions, userNarrative) {
  const systemContent =
    typeof llmOptions.system === 'string' && llmOptions.system.trim()
      ? llmOptions.system.trim()
      : DEFAULT_LLM_SYSTEM;
  const userContent = String(userNarrative ?? '');
  return {
    systemContent,
    messages: [
      { role: 'system', content: systemContent },
      { role: 'user', content: userContent }
    ],
    temperature: LLM_CHAT_DEFAULTS.temperature,
    max_tokens: LLM_CHAT_DEFAULTS.max_tokens
  };
}

/**
 * Append the exact chat payload GT3 sends upstream (no API keys).
 * Call immediately before each `llmGenerate` so logs exist during live inference.
 */
async function appendLlmOutboundDebugLog(logFile, variantTitle, llmOpts, userNarrative) {
  const { messages, temperature, max_tokens } = resolveEffectiveLlmChat(
    llmOpts,
    userNarrative
  );
  const p = gt3RuntimeLlm.provider;
  const model = currentModelId();
  let endpoint = null;
  if (p === 'openrouter') {
    endpoint = 'https://openrouter.ai/api/v1/chat/completions';
  } else if (p === 'openai') {
    endpoint = 'https://api.openai.com/v1/chat/completions';
  } else if (p === 'ollama') {
    endpoint = `ollama-js chat (local) model=${gt3RuntimeLlm.ollamaModel}`;
  } else if (p === 'mock') {
    endpoint = 'mock (no HTTP)';
  }
  const record = {
    logged_at: nowIso(),
    variant: variantTitle,
    provider: p,
    model,
    endpoint,
    temperature,
    max_tokens,
    messages
  };
  await appendLog(
    logFile,
    `LM outbound — ${variantTitle}`,
    JSON.stringify(record, null, 2)
  );
}

// Note: apiKeyOverrides = { openrouter?: string | null, openai?: string | null }
// Keys here override env vars **only for this call**.
// llmOptions.system — when non-empty, replaces DEFAULT_LLM_SYSTEM for this call only.
// llmOptions.oddGraphics — when true, mock returns 128×128 PNG base64; used with X-GT3-ODD-Graphics handler.
async function llmGenerate(narrative, apiKeyOverrides = {}, llmOptions = {}) {
  const openrouterKeyOverride = apiKeyOverrides.openrouter || null;
  const openaiKeyOverride = apiKeyOverrides.openai || null;
  const { systemContent, messages, temperature, max_tokens } =
    resolveEffectiveLlmChat(llmOptions, narrative);

  // 1) MOCK
  if (gt3RuntimeLlm.provider === 'mock') {
    if (llmOptions.oddGraphics) {
      return mockOddGraphicsPngBase64(narrative);
    }
    const summary = (narrative || '').replace(/\s+/g, ' ').slice(0, 400);
    const sysNote =
      systemContent !== DEFAULT_LLM_SYSTEM
        ? `\nCustom system (len=${systemContent.length}).\n`
        : '';
    return `POC-MOCK RESPONSE${sysNote}\n\n- Insight 1\n- Insight 2\n- Next steps\n\nEcho (truncated): ${summary}...`;
  }

  // 2) OLLAMA (local LLM)
  if (gt3RuntimeLlm.provider === 'ollama') {
    const res = await ollama.chat({
      model: gt3RuntimeLlm.ollamaModel,
      messages
    });
    const text = res?.message?.content;
    if (!text) {
      throw new Error(
        `Ollama returned no content (model=${gt3RuntimeLlm.ollamaModel}, raw=${JSON.stringify(
          res
        )})`
      );
    }
    return text;
  }

  // 3) OPENROUTER (remote LLM) – key can come from env or per-request override
  if (gt3RuntimeLlm.provider === 'openrouter') {
    const apiKey = openrouterKeyOverride || OPENROUTER_API_KEY;
    if (!apiKey) {
      const err = new Error(
        'OPENROUTER_API_KEY env or X-GT3-OpenRouter-Key header is required for openrouter provider'
      );
      err.name = 'ConfigError';
      err.provider = 'openrouter';
      throw err;
    }

    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        // HTTP-Referer is optional; use env var if available, otherwise omit
        ...(process.env.GT3_HTTP_REFERER ? { 'HTTP-Referer': process.env.GT3_HTTP_REFERER } : {}),
        'X-Title': 'GT3 POC',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: gt3RuntimeLlm.openrouterModel,
        messages,
        temperature,
        max_tokens
      })
    });

    if (!resp.ok) {
      const bodyText = await resp.text();
      const err = new Error(
        `LLM upstream error (provider=openrouter, status=${resp.status})`
      );
      err.name = 'LlmUpstreamError';
      err.provider = 'openrouter';
      err.upstreamStatus = resp.status;
      err.upstreamBodyPreview = safePreview(bodyText, 600);
      throw err;
    }
    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) {
      const err = new Error(
        `Unexpected LLM response shape from openrouter: ${JSON.stringify(
          data
        )}`
      );
      err.name = 'LlmShapeError';
      err.provider = 'openrouter';
      throw err;
    }
    return text;
  }

  // 4) OPENAI (GPT-4o-mini) – key can come from env or per-request override
  if (gt3RuntimeLlm.provider === 'openai') {
    const apiKey = openaiKeyOverride || OPENAI_API_KEY;
    if (!apiKey) {
      const err = new Error(
        'OPENAI_API_KEY env or X-GT3-OpenAI-Key header is required for openai provider'
      );
      err.name = 'ConfigError';
      err.provider = 'openai';
      throw err;
    }

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: gt3RuntimeLlm.openaiModel, // default: gpt-4o-mini
        messages,
        temperature,
        max_tokens
      })
    });

    if (!resp.ok) {
      const bodyText = await resp.text();
      const err = new Error(
        `LLM upstream error (provider=openai, status=${resp.status})`
      );
      err.name = 'LlmUpstreamError';
      err.provider = 'openai';
      err.upstreamStatus = resp.status;
      err.upstreamBodyPreview = safePreview(bodyText, 600);
      throw err;
    }
    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) {
      const err = new Error(
        `Unexpected LLM response shape from openai: ${JSON.stringify(
          data
        )}`
      );
      err.name = 'LlmShapeError';
      err.provider = 'openai';
      throw err;
    }
    return text;
  }

  const err = new Error(
    `Unsupported LLM provider: ${gt3RuntimeLlm.provider}. Valid values: mock, ollama, openrouter, openai`
  );
  err.name = 'ConfigError';
  err.provider = gt3RuntimeLlm.provider;
  throw err;
}

// ---------- Routes ----------

// Health endpoint (used by GT3 dashboard)
app.get('/healthz', (req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - PROCESS_START_TS) / 1000);
  res.json({
    status: 'ok',
    server_version: SERVER_VERSION,
    uptime_seconds: uptimeSeconds
  });
});

/**
 * OpenAI-compatible agent broker (VAL Step 3).
 * Always OpenRouter → Claude (default GT3_AGENT_OPENROUTER_MODEL). Never Anthropic direct.
 */
app.post('/v1/chat/completions', async (req, res) => {
  await handleAgentChatCompletions(req, res, {
    agentKey: GT3_LEXIOM_AGENT_KEY,
    openrouterKey: OPENROUTER_API_KEY,
    agentModel: GT3_AGENT_OPENROUTER_MODEL,
    logDir: LOG_DIR,
    ledgerLog,
    recordOpsEvent,
    httpReferer: process.env.GT3_HTTP_REFERER || null,
    destination: GT3_AGENT_LM_DESTINATION,
    observabilityMaxChars: GT3_AGENT_OBSERVABILITY_MAX_CHARS,
    onComplete: ({ ok, detail }) => {
      if (ok) TOTAL_AGENT_BROKER_OK += 1;
      else {
        TOTAL_AGENT_BROKER_ERROR += 1;
        if (detail) LAST_AGENT_ERROR_DETAIL = String(detail).slice(0, 500);
      }
    }
  });
});

/**
 * OpenAI-compatible CA broker path. Inject run_id + pass for Ops AGENT rows.
 */
app.post('/v1/agent/:runId/:pass/chat/completions', async (req, res) => {
  const runId = req.params.runId;
  const pass = req.params.pass === 'evidence' ? 'evidence' : 'builder';
  if (!req.body || typeof req.body !== 'object') {
    req.body = {};
  }
  req.body.metadata = {
    ...(req.body.metadata && typeof req.body.metadata === 'object'
      ? req.body.metadata
      : {}),
    run_id: runId,
    pass
  };
  await handleAgentChatCompletions(req, res, {
    agentKey: GT3_LEXIOM_AGENT_KEY,
    openrouterKey: OPENROUTER_API_KEY,
    agentModel: GT3_AGENT_OPENROUTER_MODEL,
    logDir: LOG_DIR,
    ledgerLog,
    recordOpsEvent,
    httpReferer: process.env.GT3_HTTP_REFERER || null,
    destination: GT3_AGENT_LM_DESTINATION,
    observabilityMaxChars: GT3_AGENT_OBSERVABILITY_MAX_CHARS,
    onComplete: ({ ok, detail }) => {
      if (ok) TOTAL_AGENT_BROKER_OK += 1;
      else {
        TOTAL_AGENT_BROKER_ERROR += 1;
        if (detail) LAST_AGENT_ERROR_DETAIL = String(detail).slice(0, 500);
      }
    }
  });
});

// Accord shared-md creation endpoint (no GT3 key needed in browser).
// Used by Lexiom Accord instructions screen to create `accord_shared_playfield.<id>.md` under:
//   public/gt2/Lexiom/Accords/
// and return a shareable deep-link URL to the other human collaborator.
app.post('/lexiom/accord/create', async (req, res) => {
  try {
    const body = req.body || {};
    const seedContent = typeof body.seedContent === 'string' ? body.seedContent : '';
    if (!seedContent.trim()) {
      return res.status(400).json({ detail: 'seedContent must be a non-empty string' });
    }

    const resourceId = `${Date.now()}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
    const filename = `accord_shared_playfield.${resourceId}.md`;

    const accordsDir = path.join(STATIC_ROOT, 'gt2', 'Lexiom', 'Accords');
    await fsp.mkdir(accordsDir, { recursive: true });

    const filePath = path.join(accordsDir, filename);
    await fsp.writeFile(filePath, String(seedContent), 'utf-8');

    const origin =
      req.get('Origin') ||
      (req.protocol && req.get('host') ? `${req.protocol}://${req.get('host')}` : '');
    const shareLink = origin
      ? `${origin}/gt2/Lexiom/index.html?accord=${encodeURIComponent(resourceId)}`
      : `/gt2/Lexiom/index.html?accord=${encodeURIComponent(resourceId)}`;

    return res.json({
      status: 'ok',
      resourceId,
      filename,
      shareLink
    });
  } catch (e) {
    console.error('lexiom_accord_create_failed', e);
    return res.status(500).json({ detail: 'Failed to create accord shared markdown' });
  }
});

// Lexiom 1.3 OSN graph: list canonical YAML files and canonize immature branches after full maturation.
app.get('/lexiom13/osn/list', async (req, res) => {
  try {
    const paths = await listLexiom13OsnYamlPaths(STATIC_ROOT);
    return res.json({ status: 'ok', paths });
  } catch (e) {
    console.error('lexiom13_osn_list_failed', e);
    return res.status(500).json({ detail: 'Failed to list Lexiom 1.3 OSN files' });
  }
});

app.post('/lexiom13/osn/canonize', async (req, res) => {
  try {
    const result = await canonizeLexiom13Osn(STATIC_ROOT, req.body || {});
    return res.json(result);
  } catch (e) {
    const status = e && e.statusCode ? e.statusCode : 500;
    if (status >= 500) {
      console.error('lexiom13_osn_canonize_failed', e);
    }
    return res.status(status).json({
      detail: e && e.message ? e.message : 'Failed to canonize OSN'
    });
  }
});

app.post('/lexiom13/osn/save', async (req, res) => {
  try {
    const result = await saveLexiom13Osn(STATIC_ROOT, req.body || {});
    return res.json(result);
  } catch (e) {
    const status = e && e.statusCode ? e.statusCode : 500;
    if (status >= 500) {
      console.error('lexiom13_osn_save_failed', e);
    }
    return res.status(status).json({
      detail: e && e.message ? e.message : 'Failed to save OSN'
    });
  }
});

// Lexiom 1.3 build plugins: prepare handoff (no agent) and run (agent when available).
app.post('/lexiom13/build/prepare', async (req, res) => {
  try {
    const result = await prepareLexiom13Build(STATIC_ROOT, __dirname, req.body || {});
    return res.json({ status: 'ok', ...result });
  } catch (e) {
    const status = e && e.statusCode ? e.statusCode : 500;
    if (status >= 500) {
      console.error('lexiom13_build_prepare_failed', e);
    }
    return res.status(status).json({
      detail: e && e.message ? e.message : 'Failed to prepare Lexiom 1.3 build'
    });
  }
});

app.post('/lexiom13/build/run', async (req, res) => {
  try {
    const headerKey = String(req.get('X-GT3-OpenRouter-Key') || '').trim();
    if (!(GT3_LEXIOM_AGENT_KEY || OPENROUTER_API_KEY || headerKey)) {
      return res.status(503).json({
        detail:
          'Agent broker requires GT3_LEXIOM_AGENT_KEY or OPENROUTER_API_KEY (or X-GT3-OpenRouter-Key). ' +
          'Copy .env.example to .env, set OPENROUTER_API_KEY (or GT3_LEXIOM_AGENT_KEY), restart npm start. ' +
          'Ops: /ops/summary → agent_broker.key_configured.'
      });
    }
    const result = await runLexiom13Build(STATIC_ROOT, __dirname, req.body || {});
    return res.json({ status: 'ok', ...result });
  } catch (e) {
    const status = e && e.statusCode ? e.statusCode : 500;
    if (status >= 500) {
      console.error('lexiom13_build_run_failed', e);
    }
    return res.status(status).json({
      detail: e && e.message ? e.message : 'Failed to run Lexiom 1.3 build'
    });
  }
});

app.get('/lexiom13/build/status/:runId', async (req, res) => {
  try {
    const result = await readLexiom13BuildStatus(__dirname, req.params.runId);
    return res.json({ status: 'ok', ...result });
  } catch (e) {
    const status = e && e.statusCode ? e.statusCode : 500;
    if (status >= 500) {
      console.error('lexiom13_build_status_failed', e);
    }
    return res.status(status).json({
      detail: e && e.message ? e.message : 'Failed to read Lexiom 1.3 build status'
    });
  }
});

app.get('/lexiom13/build/session/:sessionId/workspace', async (req, res) => {
  try {
    const manifest = await readSessionWorkspace(
      req.params.sessionId,
      req.get('X-GT3-CA-Capability')
    );
    return res.json({ status: 'ok', ...manifest });
  } catch (e) {
    const status = e && e.statusCode ? e.statusCode : 500;
    return res.status(status).json({
      detail: e && e.message ? e.message : 'Failed to read CA session workspace'
    });
  }
});

app.get('/lexiom13/build/session/:sessionId/file', async (req, res) => {
  try {
    const rel =
      typeof req.query.path === 'string'
        ? req.query.path
        : typeof req.query.p === 'string'
          ? req.query.p
          : '';
    const file = await readSessionWorkspaceFile(
      req.params.sessionId,
      rel,
      req.get('X-GT3-CA-Capability')
    );
    return res.json({ status: 'ok', ...file });
  } catch (e) {
    const status = e && e.statusCode ? e.statusCode : e && e.code === 'ENOENT' ? 404 : 500;
    return res.status(status).json({
      detail: e && e.message ? e.message : 'Failed to read CA session file'
    });
  }
});

app.post('/lexiom13/build/session/:sessionId/artifacts', async (req, res) => {
  try {
    const result = await writeSessionArtifacts(
      req.params.sessionId,
      req.body || {},
      req.get('X-GT3-CA-Capability')
    );
    return res.json({ status: 'ok', ...result });
  } catch (e) {
    const status = e && e.statusCode ? e.statusCode : 500;
    return res.status(status).json({
      detail: e && e.message ? e.message : 'Failed to write CA session artifacts'
    });
  }
});

app.post('/lexiom13/build/session/:sessionId/report', async (req, res) => {
  try {
    const result = await reportLexiom13CaSession(
      req.params.sessionId,
      req.body || {},
      req.get('X-GT3-CA-Capability')
    );
    return res.json({ status: 'ok', ...result });
  } catch (e) {
    const status = e && e.statusCode ? e.statusCode : 500;
    if (status >= 500) console.error('lexiom13_ca_report_failed', e);
    return res.status(status).json({
      detail: e && e.message ? e.message : 'Failed to apply CA session report'
    });
  }
});

app.post('/lexiom13/build/session/:sessionId/heartbeat', (req, res) => {
  try {
    const session = heartbeatCaSession(
      req.params.sessionId,
      req.get('X-GT3-CA-Capability')
    );
    return res.json({
      status: 'ok',
      session_id: session.session_id,
      ca_location: session.ca_location,
      last_heartbeat_at: session.last_heartbeat_at,
      cancelled: !!session.cancelled
    });
  } catch (e) {
    return res.status(e?.statusCode || 500).json({
      detail: e?.message || 'CA session heartbeat failed'
    });
  }
});

app.post('/lexiom13/build/session/:sessionId/cancel', (req, res) => {
  try {
    const session = cancelCaSession(
      req.params.sessionId,
      req.get('X-GT3-CA-Capability')
    );
    return res.json({
      status: 'ok',
      session_id: session.session_id,
      ca_location: session.ca_location,
      cancelled: true
    });
  } catch (e) {
    return res.status(e?.statusCode || 500).json({
      detail: e?.message || 'CA session cancel failed'
    });
  }
});

// Lexiom 1.3 evidence cockpit sync: Focus-closure collections + safe artifact serve.
app.get('/lexiom13/evidence/collections', async (req, res) => {
  try {
    const osnId = typeof req.query.osn_id === 'string' ? req.query.osn_id : '';
    const result = await listFocusEvidenceCollections(__dirname, osnId);
    return res.json({ status: 'ok', ...result });
  } catch (e) {
    const status = e && e.statusCode ? e.statusCode : 500;
    if (status >= 500) {
      console.error('lexiom13_evidence_collections_failed', e);
    }
    return res.status(status).json({
      detail: e && e.message ? e.message : 'Failed to list evidence collections'
    });
  }
});

app.get('/lexiom13/evidence/artifact/:runId/*', async (req, res) => {
  try {
    const runId = req.params.runId;
    // Express 4 splat: remaining path in req.params[0]
    const wildcard =
      (typeof req.params[0] === 'string' && req.params[0]) ||
      String(req.path || '')
        .replace(/^\/lexiom13\/evidence\/artifact\/[^/]+\//, '')
        .replace(/^\/+/, '');
    const parts = String(wildcard)
      .split('/')
      .map((p) => {
        try {
          return decodeURIComponent(p);
        } catch (_e) {
          return p;
        }
      })
      .filter(Boolean);
    const abs = await resolveEvidenceArtifactFile(__dirname, runId, parts);
    return res.sendFile(abs);
  } catch (e) {
    const status = e && e.statusCode ? e.statusCode : 500;
    if (status >= 500) {
      console.error('lexiom13_evidence_artifact_failed', e);
    }
    return res.status(status).json({
      detail: e && e.message ? e.message : 'Failed to serve evidence artifact'
    });
  }
});

// Lexiom 1.3 Bud Center hosts (Phase B): product-port preview + document artifact.
app.get('/lexiom13/preview/:runId', async (req, res) => {
  try {
    const abs = await resolveBudPreviewFile(__dirname, req.params.runId, []);
    return res.sendFile(abs);
  } catch (e) {
    const status = e && e.statusCode ? e.statusCode : 500;
    if (status >= 500) console.error('lexiom13_bud_preview_failed', e);
    return res.status(status).json({
      detail: e && e.message ? e.message : 'Failed to serve bud preview'
    });
  }
});

app.get('/lexiom13/preview/:runId/*', async (req, res) => {
  try {
    const runId = req.params.runId;
    const wildcard =
      (typeof req.params[0] === 'string' && req.params[0]) ||
      String(req.path || '')
        .replace(/^\/lexiom13\/preview\/[^/]+\//, '')
        .replace(/^\/+/, '');
    const parts = String(wildcard)
      .split('/')
      .map((p) => {
        try {
          return decodeURIComponent(p);
        } catch (_e) {
          return p;
        }
      })
      .filter(Boolean);
    const abs = await resolveBudPreviewFile(__dirname, runId, parts);
    return res.sendFile(abs);
  } catch (e) {
    const status = e && e.statusCode ? e.statusCode : 500;
    if (status >= 500) console.error('lexiom13_bud_preview_failed', e);
    return res.status(status).json({
      detail: e && e.message ? e.message : 'Failed to serve bud preview'
    });
  }
});

app.get('/lexiom13/build/:runId/artifact/:entry', async (req, res) => {
  try {
    const abs = await resolveBudArtifactFile(
      __dirname,
      req.params.runId,
      req.params.entry
    );
    const entry = String(req.params.entry || '');
    if (entry.toLowerCase().endsWith('.md')) {
      res.type('text/markdown; charset=utf-8');
    }
    return res.sendFile(abs);
  } catch (e) {
    const status = e && e.statusCode ? e.statusCode : 500;
    if (status >= 500) console.error('lexiom13_bud_artifact_failed', e);
    return res.status(status).json({
      detail: e && e.message ? e.message : 'Failed to serve bud artifact'
    });
  }
});

// Lexiom approved-artifact snapshot: write markdown under public/gt2/Lexiom/Accords/ (same static tree as Accord seeds).
// Invoked when the user approves a right-panel artifact; share copies fileUrl (raw .md on this server).
app.post('/lexiom/artifact/publish', async (req, res) => {
  try {
    const body = req.body || {};
    const content = typeof body.content === 'string' ? body.content : '';
    if (!content.trim()) {
      return res.status(400).json({ detail: 'content must be a non-empty string' });
    }

    const rawBase =
      typeof body.baseName === 'string' && body.baseName.trim()
        ? body.baseName.trim()
        : 'artifact';
    const safeBase = rawBase
      .replace(/\.md$/i, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80) || 'artifact';

    const resourceId = `${Date.now()}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
    const filename = `lexiom_approved_${safeBase}.${resourceId}.md`;

    const accordsDir = path.join(STATIC_ROOT, 'gt2', 'Lexiom', 'Accords');
    await fsp.mkdir(accordsDir, { recursive: true });

    const filePath = path.join(accordsDir, filename);
    await fsp.writeFile(filePath, String(content), 'utf-8');

    const origin =
      req.get('Origin') ||
      (req.protocol && req.get('host') ? `${req.protocol}://${req.get('host')}` : '');
    const pathPart = `/gt2/Lexiom/Accords/${encodeURIComponent(filename)}`;
    const fileUrl = origin ? `${origin}${pathPart}` : pathPart;
    const sharePath = `/lexiom/artifact/share/${encodeURIComponent(resourceId)}`;
    const sharePortalUrl = origin ? `${origin}${sharePath}` : sharePath;

    return res.json({
      status: 'ok',
      resourceId,
      filename,
      fileUrl,
      sharePortalUrl,
    });
  } catch (e) {
    console.error('lexiom_artifact_publish_failed', e);
    return res.status(500).json({ detail: 'Failed to publish artifact markdown' });
  }
});

// Published artifact JSON (cockpit inbound handoff; optional API consumers).
app.get('/lexiom/artifact/content/:resourceId', async (req, res) => {
  try {
    const resourceId = req.params.resourceId || '';
    const fp = await findLexiomApprovedFilePath(resourceId);
    if (!fp) return res.status(404).json({ detail: 'Artifact not found' });
    const content = await fsp.readFile(fp, 'utf-8');
    const filename = path.basename(fp);
    return res.json({
      status: 'ok',
      resourceId,
      filename,
      content: String(content),
    });
  } catch (e) {
    console.error('lexiom_artifact_content_failed', e);
    return res.status(500).json({ detail: 'Failed to read artifact' });
  }
});

app.get('/lexiom/artifact/meta/:resourceId', async (req, res) => {
  try {
    const resourceId = req.params.resourceId || '';
    const fp = await findLexiomApprovedFilePath(resourceId);
    if (!fp) return res.status(404).json({ detail: 'Artifact not found' });
    const content = await fsp.readFile(fp, 'utf-8');
    const filename = path.basename(fp);
    const firstLine = String(content).split(/\r?\n/)[0]?.trim() || filename;
    return res.json({
      status: 'ok',
      resourceId,
      filename,
      title: firstLine.replace(/^#+\s*/, '') || filename,
    });
  } catch (e) {
    console.error('lexiom_artifact_meta_failed', e);
    return res.status(500).json({ detail: 'Failed to read artifact meta' });
  }
});

// Receiver portal: PDF download (attachment) from approved snapshot.
app.get('/lexiom/artifact/share/:resourceId/pdf', async (req, res) => {
  try {
    const resourceId = req.params.resourceId || '';
    const fp = await findLexiomApprovedFilePath(resourceId);
    if (!fp) return res.status(404).end();
    const raw = await fsp.readFile(fp, 'utf-8');
    const plain = markdownToPdfPlainText(raw);
    const base = path.basename(fp, '.md');
    const safePdfName = `${base.replace(/[^a-zA-Z0-9._-]+/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safePdfName}"`);
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    doc.pipe(res);
    doc.fontSize(11);
    doc.text(plain || '(empty)', { width: 500 });
    doc.end();
  } catch (e) {
    console.error('lexiom_artifact_pdf_failed', e);
    if (!res.headersSent) res.status(500).end();
  }
});

// Receiver portal (canonical human link): disclosure + Open in Lexiom + Download PDF.
app.get('/lexiom/artifact/share/:resourceId', async (req, res) => {
  try {
    const resourceId = req.params.resourceId || '';
    const fp = await findLexiomApprovedFilePath(resourceId);
    if (!fp) {
      return res.status(404).type('html').send('<p>Artifact not found.</p>');
    }
    const content = await fsp.readFile(fp, 'utf-8');
    const filename = path.basename(fp);
    const title =
      String(content)
        .split(/\r?\n/)[0]
        ?.trim()
        .replace(/^#+\s*/, '') || filename;
    const origin =
      req.get('Origin') ||
      (req.protocol && req.get('host') ? `${req.protocol}://${req.get('host')}` : '');
    const pdfHref = origin
      ? `${origin}/lexiom/artifact/share/${encodeURIComponent(resourceId)}/pdf`
      : `/lexiom/artifact/share/${encodeURIComponent(resourceId)}/pdf`;
    const openHref = `${origin ? origin : ''}/gt2/Lexiom/index.html?inboundArtifact=${encodeURIComponent(
      resourceId
    )}&skipIntro=1`;
    const safeTitle = escapeHtmlText(title);
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${safeTitle} — Lexiom</title>
  <style>
    :root { font-family: system-ui, sans-serif; line-height: 1.5; }
    body { max-width: 36rem; margin: 2rem auto; padding: 0 1rem; }
    h1 { font-size: 1.25rem; }
    .actions { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1.5rem; }
    a.btn { display: inline-block; padding: 0.6rem 1rem; border-radius: 6px; text-decoration: none; font-weight: 600; }
    .primary { background: #1a56b0; color: #fff; }
    .secondary { background: #e8eef6; color: #142; }
    .note { font-size: 0.9rem; color: #444; margin-top: 1.25rem; }
  </style>
</head>
<body>
  <h1>${safeTitle}</h1>
  <p>You received a shared Lexiom artifact. Choose how to proceed.</p>
  <div class="actions">
    <a class="btn primary" href="${escapeHtmlText(pdfHref)}">Download PDF</a>
    <a class="btn secondary" href="${escapeHtmlText(openHref)}">Open in Lexiom</a>
  </div>
  <p class="note">Downloading the PDF creates a copy outside Lexiom. Opening in Lexiom stages the artifact in Shared Harmony for your review (Accept / Ignore).</p>
</body>
</html>`;
    res.type('html').send(html);
  } catch (e) {
    console.error('lexiom_artifact_share_page_failed', e);
    res.status(500).type('html').send('<p>Unable to load share page.</p>');
  }
});

// Inference endpoint
// Per-request API keys are accepted via HTTP headers:
//   X-GT3-OpenRouter-Key  – for provider=openrouter
//   X-GT3-OpenAI-Key      – for provider=openai
//
// If present, they override the env variable only for THIS call.
//
// Optional JSON body field `system` (string): when non-empty after trim, replaces the
// default LM system message for this request only (single and dual inference).
app.post('/inference', async (req, res) => {
  console.log(`\n`); // simple separator between requests
  const narrative = (req.body?.narrative || '').trim();
  if (!narrative)
    return res.status(400).json({ detail: 'narrative must be non-empty' });

  const customSystemRaw = req.body?.system;
  const customSystem =
    typeof customSystemRaw === 'string' ? customSystemRaw.trim() : '';
  const llmGenerateOpts = customSystem ? { system: customSystem } : {};

  // Log delta context payload structure (if present) for iterative workflow tracking
  if (req.body?.latestApprovedStatus !== undefined || req.body?.newlyApprovedStatus !== undefined || req.body?.latestWorkplan !== undefined) {
    console.log('[inference] Status delta context detected:', {
      hasLatestApprovedStatus: req.body.latestApprovedStatus !== undefined,
      latestApprovedStatusLength: req.body.latestApprovedStatus?.length || 0,
      hasNewlyApprovedStatus: req.body.newlyApprovedStatus !== undefined,
      newlyApprovedStatusLength: req.body.newlyApprovedStatus?.length || 0,
      hasLatestWorkplan: req.body.latestWorkplan !== undefined,
      latestWorkplanLength: req.body.latestWorkplan?.length || 0,
      narrativeLength: narrative.length
    });
  }

  const gameRecordRaw =
    req.get('X-GT3-Game-Record') || req.body?.game_record || null;
  const gameRecord = sanitizeGameRecordId(gameRecordRaw);

  const headers = {
    tenant: req.get('X-GT3-Tenant') || null,
    track: req.get('X-GT3-Data-Track') || null,
    consent:
      req.get('X-GT3-Consent-Version') || req.get('X-Consent-Version') || null,
    idempotency: req.get('Idempotency-Key') || null,
    game_record: gameRecord
  };

  // Per-request API key overrides (do NOT persist)
  const apiKeyOverrides = {
    openrouter: req.get('X-GT3-OpenRouter-Key') || null,
    openai: req.get('X-GT3-OpenAI-Key') || null
  };

  const tenantLower = (headers.tenant || '').toLowerCase();
  // Lexiom GT3 demo key strategy (temporary):
  // If no client key is provided and the request comes from the Lexiom
  // demo tenant, inject a server-side demo key for this call only.
  if (
    tenantLower === 'gt2-lexiom-demo' &&
    !apiKeyOverrides.openrouter &&
    !apiKeyOverrides.openai &&
    GT3_LEXIOM_DEMO_KEY
  ) {
    if (gt3RuntimeLlm.provider === 'openrouter') {
      apiKeyOverrides.openrouter = GT3_LEXIOM_DEMO_KEY;
    } else if (gt3RuntimeLlm.provider === 'openai') {
      apiKeyOverrides.openai = GT3_LEXIOM_DEMO_KEY;
    }
    // ollama and mock need no API key injection for Lexiom demo.
  }

  // Demo tenant (Lexiom, ODD, etc.): explicit config error when no key path exists
  if (
    tenantLower === 'gt2-lexiom-demo' &&
    (gt3RuntimeLlm.provider === 'openrouter' || gt3RuntimeLlm.provider === 'openai')
  ) {
    const resolvedKey =
      gt3RuntimeLlm.provider === 'openrouter'
        ? apiKeyOverrides.openrouter || OPENROUTER_API_KEY
        : apiKeyOverrides.openai || OPENAI_API_KEY;
    if (!resolvedKey) {
      return res.status(503).json({
        detail:
          'Tenant gt2-lexiom-demo: set GT3_LEXIOM_DEMO_KEY on the server for browser-only access, or set OPENROUTER_API_KEY (openrouter) / OPENAI_API_KEY (openai). None are configured.'
      });
    }
  }

  // Record inference for ops summary (event + total)
  recordOpsEvent('inference', headers);
  TOTAL_INFERENCE += 1;

  const originalPrompt = narrative;
  const inferenceMode = gt3RuntimeLlm.inferenceMode;
  const lovingPrompt =
    inferenceMode === 'dual' || inferenceMode === 'loving_only'
      ? buildLovingUserMessage(narrative, gt3RuntimeLlm.expressionProfile)
      : null;

  // Per-inference debug log file (optional subdirectory per Lexiom game record)
  // Filename may be updated to <4_words>.<uuid>.txt after successful LM response
  // (phrase first; dot separates from uuid; version may be inserted later as <phrase>.<version>.<uuid>.txt)
  const uuid = crypto.randomUUID();
  const logFileName = `inference.${SERVER_VERSION}.${uuid}.txt`;
  let logRelative = gameRecord
    ? path.join(gameRecord, logFileName)
    : logFileName;
  let logFile = path.join(LOG_DIR, logRelative);
  let logFileUrl = '/logs/' + logRelative.split(path.sep).join('/');
  let logFileRenamed = false;

  function maybeRenameLogWithPhrase(phrase, currentLogFile) {
    if (logFileRenamed) return;
    if (!phrase || phrase.length > 120) return;
    const base = phrase.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+$/, '');
    if (!base || !base.startsWith('_')) return;
    if (PHRASE_RENAME_BLOCKLIST.has(phrase)) return;
    const newFileName = `${base}.${uuid}.txt`;
    const newRelative = gameRecord
      ? path.join(gameRecord, newFileName)
    : newFileName;
    const newLogFile = path.join(LOG_DIR, newRelative);
    try {
      fs.renameSync(currentLogFile, newLogFile);
      logFile = newLogFile;
      logRelative = newRelative;
      logFileUrl = '/logs/' + newRelative.split(path.sep).join('/');
      logFileRenamed = true;
    } catch (e) {
      console.error('inference_log_rename', e);
    }
  }
  await fsp
    .mkdir(path.dirname(logFile), { recursive: true })
    .catch(() => {});

  // Build log content with delta context info if present
  let logContent = `=== Inference Debug Log (${SERVER_VERSION}) ===\nUUID: ${uuid}\nTimestamp: ${nowIso()}\n`;
  if (tenantLower === 'gt2-lexiom-demo') {
    logContent += `LexiomNarrativeContract: ${LEXIOM_NARRATIVE_CONTRACT_VERSION}\n`;
  }
  logContent += `\n`;
  
  if (req.body?.latestApprovedStatus !== undefined || req.body?.newlyApprovedStatus !== undefined || req.body?.latestWorkplan !== undefined) {
    logContent += `=== Status Delta Context ===\n`;
    if (req.body.latestApprovedStatus !== undefined) {
      logContent += `Latest Approved Status Length: ${req.body.latestApprovedStatus.length}\n`;
    }
    if (req.body.newlyApprovedStatus !== undefined) {
      logContent += `Newly Approved Status Length: ${req.body.newlyApprovedStatus.length}\n`;
    }
    if (req.body.latestWorkplan !== undefined) {
      logContent += `Latest Workplan Length: ${req.body.latestWorkplan.length}\n`;
    }
    logContent += `\n`;
  }

  if (customSystem) {
    logContent += `Custom system prompt: yes (length ${customSystem.length})\n\n`;
  }

  logContent += `Expression profile: ${gt3RuntimeLlm.expressionProfile}\n`;
  const distMeta = getDistilledMeta(gt3RuntimeLlm.expressionProfile);
  if (distMeta) {
    logContent += `full_spec_ref (human): ${distMeta.fullSpecRef || 'n/a'}\n`;
    logContent += `distilled_sha256: ${distMeta.sha256}\n`;
    logContent += `distilled_byte_length: ${distMeta.byteLength}\n`;
  }
  logContent += `Inference mode: ${inferenceMode}\n`;
  logContent +=
    '\n=== LM outbound logging ===\n' +
    'Immediately before each upstream LM call, GT3 appends an "LM outbound" section with the full messages array (system + user), provider, model, endpoint, temperature, and max_tokens — matching the payload sent to the provider (API keys are never written).\n\n';
  logContent += `=== Client narrative (HTTP body) ===\n${originalPrompt}\n\n`;

  if (inferenceMode === 'dual' && lovingPrompt != null) {
    logContent += `=== Loving user message (to LM) ===\n${lovingPrompt}\n\n`;
    logContent += `=== Original user message (to LM) ===\n${originalPrompt}\n\n`;
  } else if (inferenceMode === 'loving_only' && lovingPrompt != null) {
    logContent += `=== LM user message (to LM) — loving-only single call ===\n${lovingPrompt}\n\n`;
  } else {
    logContent += `=== LM user message (to LM) ===\n${originalPrompt}\n\n`;
  }

  await fsp.writeFile(logFile, logContent, 'utf-8');

  const oddGraphics = (req.get('X-GT3-ODD-Graphics') || '').trim() === '1';
  const oddDirect = (req.get('X-GT3-ODD-Direct') || '').trim() === '1';

  // -----------------------------
  // ODD GRAPHICS: OpenRouter image model (default bytedance-seed/seedream-4.5)
  // -----------------------------
  if (oddGraphics) {
    const t0 = Date.now();
    try {
      let pngBase64;
      let imageModel = GT3_OPENROUTER_IMAGE_MODEL;

      if (gt3RuntimeLlm.provider === 'mock') {
        pngBase64 = mockOddGraphicsPngBase64(originalPrompt);
        imageModel = 'mock/odd-png128';
      } else {
        const openrouterKey = apiKeyOverrides.openrouter || OPENROUTER_API_KEY;
        if (!openrouterKey) {
          return res.status(503).json({
            detail:
              'ODD graphics requires OPENROUTER_API_KEY (or X-GT3-OpenRouter-Key) for image generation via OpenRouter.'
          });
        }
        const graphicsSystem =
          typeof customSystem === 'string' && customSystem ? customSystem : '';
        const imageResult = await openRouterGenerateImage({
          apiKey: openrouterKey,
          system: graphicsSystem,
          prompt: originalPrompt,
          model: GT3_OPENROUTER_IMAGE_MODEL,
          imageConfig: { aspect_ratio: '1:1', image_size: '1K' }
        });
        pngBase64 = imageResult.pngBase64;
        imageModel = imageResult.model;
        await appendLog(
          logFile,
          'ODD graphics OpenRouter outbound',
          JSON.stringify(
            {
              model: imageModel,
              modalities: ['image'],
              narrative_len: originalPrompt.length,
              system_len: graphicsSystem.length
            },
            null,
            2
          )
        );
      }

      const latency = Date.now() - t0;
      const result = {
        label: 'odd_graphics',
        ok: true,
        text: pngBase64,
        latency_ms: latency
      };
      await ledgerLog({
        event: 'inference_odd_graphics',
        ...headers,
        ...result,
        narrative_len: originalPrompt.length,
        provider: gt3RuntimeLlm.provider,
        model: imageModel,
        response_len: pngBase64.length,
        log_file: logFileUrl
      });
      await appendLog(
        logFile,
        'ODD graphics response (png base64 length)',
        String(pngBase64.length)
      );
      return res.json({ response: pngBase64 });
    } catch (e) {
      const latency = Date.now() - t0;
      logInferenceError({
        variant: 'odd_graphics',
        mode: 'odd_graphics_openrouter',
        headers,
        narrative: originalPrompt,
        provider: gt3RuntimeLlm.provider,
        model: GT3_OPENROUTER_IMAGE_MODEL,
        error: e,
        latencyMs: latency
      });
      await appendLog(logFile, 'ODD graphics error', String(e));
      return res.status(502).json({
        detail: `ODD graphics inference failed: ${String(e)}`
      });
    }
  }

  // -----------------------------
  // ODD ADVISOR DIRECT: text LM (default openrouter → openai/gpt-4o-mini)
  // -----------------------------
  if (oddDirect) {
    const t0 = Date.now();
    try {
      const oddOpts = { ...llmGenerateOpts };
      await appendLlmOutboundDebugLog(
        logFile,
        'odd_advisor / direct',
        oddOpts,
        originalPrompt
      );
      const rawText = await llmGenerate(
        originalPrompt,
        apiKeyOverrides,
        oddOpts
      );
      const latency = Date.now() - t0;
      const { phrase, displayText } = extractAndStripInBand(rawText);
      if (phrase) maybeRenameLogWithPhrase(phrase, logFile);
      const result = {
        label: 'odd_advisor',
        ok: true,
        text: displayText,
        latency_ms: latency
      };
      await ledgerLog({
        event: 'inference_odd_advisor',
        ...headers,
        ...result,
        narrative_len: originalPrompt.length,
        provider: gt3RuntimeLlm.provider,
        model: currentModelId(),
        response_len: displayText.length,
        log_file: logFileUrl
      });
      await appendLog(logFile, 'ODD advisor response', rawText);
      return res.json({ response: displayText });
    } catch (e) {
      const latency = Date.now() - t0;
      logInferenceError({
        variant: 'odd_advisor',
        mode: 'odd_direct',
        headers,
        narrative: originalPrompt,
        provider: gt3RuntimeLlm.provider,
        model: currentModelId(),
        error: e,
        latencyMs: latency
      });
      await appendLog(logFile, 'ODD odd_advisor error', String(e));
      return res.status(502).json({
        detail: `ODD odd_advisor inference failed: ${String(e)}`
      });
    }
  }

  // -----------------------------
  // MODE: SINGLE (original user message only)
  // -----------------------------
  if (inferenceMode === 'single') {
    const t0 = Date.now();
    try {
      await appendLlmOutboundDebugLog(
        logFile,
        'single / original',
        llmGenerateOpts,
        originalPrompt
      );
      const rawText = await llmGenerate(
        originalPrompt,
        apiKeyOverrides,
        llmGenerateOpts
      );
      const latency = Date.now() - t0;
      const { phrase, displayText } = extractAndStripInBand(rawText);
      if (phrase) maybeRenameLogWithPhrase(phrase, logFile);
      const result = {
        label: 'original_single',
        ok: true,
        text: displayText,
        latency_ms: latency
      };
      await ledgerLog({
        event: 'inference_single',
        ...headers,
        ...result,
        narrative_len: originalPrompt.length,
        provider: gt3RuntimeLlm.provider,
        model: currentModelId(),
        response_len: displayText.length,
        log_file: logFileUrl
      });
      await appendLog(logFile, 'Single original response', rawText);
      return res.json({ response: displayText });
    } catch (e) {
      const latency = Date.now() - t0;
      const result = {
        label: 'original_single',
        ok: false,
        error: String(e),
        latency_ms: latency
      };

      // Terminal structured log
      logInferenceError({
        variant: 'original_single',
        mode: 'single',
        headers,
        narrative: originalPrompt,
        provider: gt3RuntimeLlm.provider,
        model: currentModelId(),
        error: e,
        latencyMs: latency
      });

      await ledgerLog({
        event: 'inference_single',
        ...headers,
        ...result,
        narrative_len: originalPrompt.length,
        provider: gt3RuntimeLlm.provider,
        model: currentModelId(),
        response_len: 0,
        log_file: logFileUrl
      });
      await appendLog(logFile, 'Single original error', String(e));
      return res.status(502).json({
        detail: `Single inference failed: original=${String(e)}`
      });
    }
  }

  // -----------------------------
  // MODE: LOVING-ONLY (single LM call with loving user message)
  // -----------------------------
  if (inferenceMode === 'loving_only') {
    const t0 = Date.now();
    try {
      const lovingLlmOpts = mergeLovingSystemPrompt(llmGenerateOpts);
      await appendLlmOutboundDebugLog(
        logFile,
        'loving_only',
        lovingLlmOpts,
        lovingPrompt
      );
      const rawText = await llmGenerate(
        lovingPrompt,
        apiKeyOverrides,
        lovingLlmOpts
      );
      const latency = Date.now() - t0;
      const { phrase, displayText } = extractAndStripInBand(rawText);
      if (phrase) maybeRenameLogWithPhrase(phrase, logFile);
      const result = {
        label: 'loving_only',
        ok: true,
        text: displayText,
        latency_ms: latency
      };
      await ledgerLog({
        event: 'inference_single',
        ...headers,
        ...result,
        narrative_len: lovingPrompt.length,
        provider: gt3RuntimeLlm.provider,
        model: currentModelId(),
        response_len: displayText.length,
        log_file: logFileUrl
      });
      await appendLog(logFile, 'Loving-only response', rawText);
      return res.json({ response: displayText });
    } catch (e) {
      const latency = Date.now() - t0;
      const result = {
        label: 'loving_only',
        ok: false,
        error: String(e),
        latency_ms: latency
      };

      logInferenceError({
        variant: 'loving_only',
        mode: 'loving_only',
        headers,
        narrative: lovingPrompt,
        provider: gt3RuntimeLlm.provider,
        model: currentModelId(),
        error: e,
        latencyMs: latency
      });

      await ledgerLog({
        event: 'inference_single',
        ...headers,
        ...result,
        narrative_len: lovingPrompt.length,
        provider: gt3RuntimeLlm.provider,
        model: currentModelId(),
        response_len: 0,
        log_file: logFileUrl
      });
      await appendLog(logFile, 'Loving-only error', String(e));
      return res.status(502).json({
        detail: `Loving-only inference failed: ${String(e)}`
      });
    }
  }

  // -----------------------------
  // MODE: DUAL INFERENCE (LOVING + DELAYED ORIGINAL)
  // -----------------------------
  if (inferenceMode !== 'dual') {
    return res.status(500).json({
      detail: `Unsupported inference_mode: ${inferenceMode}`
    });
  }

  let responded = false;
  let lovingError = null; // remember loving error for combined summary if both fail

  // LOVING variant: starts immediately, responds as soon as it returns
  (async () => {
    const t0 = Date.now();
    try {
      const lovingLlmOpts = mergeLovingSystemPrompt(llmGenerateOpts);
      await appendLlmOutboundDebugLog(
        logFile,
        'dual / loving',
        lovingLlmOpts,
        lovingPrompt
      );
      const rawText = await llmGenerate(
        lovingPrompt,
        apiKeyOverrides,
        lovingLlmOpts
      );
      const latency = Date.now() - t0;
      const { phrase, displayText } = extractAndStripInBand(rawText);
      if (phrase) maybeRenameLogWithPhrase(phrase, logFile);
      const result = {
        label: 'loving',
        ok: true,
        text: displayText,
        latency_ms: latency
      };
      await ledgerLog({
        event: 'inference_variant',
        ...headers,
        ...result,
        narrative_len: lovingPrompt.length,
        provider: gt3RuntimeLlm.provider,
        model: currentModelId(),
        error: null,
        response_len: displayText.length,
        log_file: logFileUrl
      });
      await appendLog(logFile, 'Loving response', rawText);
      if (!responded) {
        responded = true;
        res.json({ response: displayText });
      }
    } catch (e) {
      const latency = Date.now() - t0;
      lovingError = e;

      // Terminal structured log
      logInferenceError({
        variant: 'loving',
        mode: 'dual',
        headers,
        narrative: lovingPrompt,
        provider: gt3RuntimeLlm.provider,
        model: currentModelId(),
        error: e,
        latencyMs: latency
      });

      const result = {
        label: 'loving',
        ok: false,
        error: String(e),
        latency_ms: latency
      };
      await ledgerLog({
        event: 'inference_variant',
        ...headers,
        ...result,
        narrative_len: lovingPrompt.length,
        provider: gt3RuntimeLlm.provider,
        model: currentModelId(),
        response_len: 0,
        log_file: logFileUrl
      });
      await appendLog(logFile, 'Loving error', String(e));
      // no response yet; original will run after 31s and may succeed
    }
  })();

  // ORIGINAL variant: scheduled 31s later, always logged, may respond if loving failed
  setTimeout(async () => {
    const t0 = Date.now();
    try {
      await appendLlmOutboundDebugLog(
        logFile,
        'dual / original (delayed)',
        llmGenerateOpts,
        originalPrompt
      );
      const rawText = await llmGenerate(
        originalPrompt,
        apiKeyOverrides,
        llmGenerateOpts
      );
      const latency = Date.now() - t0;
      const { phrase, displayText } = extractAndStripInBand(rawText);
      if (phrase) maybeRenameLogWithPhrase(phrase, logFile);
      const result = {
        label: 'original',
        ok: true,
        text: displayText,
        latency_ms: latency
      };
      await ledgerLog({
        event: 'inference_variant',
        ...headers,
        ...result,
        narrative_len: originalPrompt.length,
        provider: gt3RuntimeLlm.provider,
        model: currentModelId(),
        error: null,
        response_len: displayText.length,
        log_file: logFileUrl
      });
      await appendLog(logFile, 'Original response', rawText);
      if (!responded) {
        responded = true;
        res.json({ response: displayText });
      }
    } catch (e) {
      const latency = Date.now() - t0;
      const result = {
        label: 'original',
        ok: false,
        error: String(e),
        latency_ms: latency
      };

      // Terminal structured log for original error
      logInferenceError({
        variant: 'original',
        mode: 'dual',
        headers,
        narrative: originalPrompt,
        provider: gt3RuntimeLlm.provider,
        model: currentModelId(),
        error: e,
        latencyMs: latency
      });

      await ledgerLog({
        event: 'inference_variant',
        ...headers,
        ...result,
        narrative_len: originalPrompt.length,
        provider: gt3RuntimeLlm.provider,
        model: currentModelId(),
        response_len: 0,
        log_file: logFileUrl
      });
      await appendLog(logFile, 'Original error', String(e));

      // If both variants failed, log a summarized combined error once
      if (!responded) {
        responded = true;

        const combined = {
          event: 'dual_inference_both_failed',
          ts: nowIso(),
          server_version: SERVER_VERSION,
          provider: gt3RuntimeLlm.provider,
          model: currentModelId(),
          tenant: headers.tenant,
          track: headers.track,
          consent: headers.consent,
          idempotency: headers.idempotency,
          narrative_len: originalPrompt.length,
          narrative_token_estimate: estimateTokens(originalPrompt),
          loving_error_message: lovingError
            ? String(lovingError.message || lovingError)
            : 'loving variant failed previously (no error object captured)',
          original_error_message: String(e.message || e)
        };
        console.error(JSON.stringify(combined));

        res.status(502).json({
          detail: `Both inference variants failed: loving failed previously; original=${String(
            e
          )}`
        });
      }
    }
  }, 31_000);
});

// Training-example ingestion endpoint
// Expects a generic fine-tuning example payload from GT2/Legato, e.g.:
// {
//   tenant_id: "gt2-spa-dev",
//   use_case: "workplan_status",
//   schema_id: "gt2.workplan.v1",
//   track: "green",
//   channels: {
//     input: {...},
//     model_candidate: {...},
//     authoritative: {...}
//   },
//   meta: {...}
// }
app.post('/training-example', async (req, res) => {
  const body = req.body || {};
  const headers = {
    tenant: req.get('X-GT3-Tenant') || body.tenant_id || null,
    track: req.get('X-GT3-Data-Track') || body.track || null
  };

  const exampleId = crypto.randomUUID();
  const record = {
    id: exampleId,
    ts: nowIso(),
    headers,
    body
  };

  // Log to ledger
  await ledgerLog({
    event: 'training_example',
    tenant: headers.tenant,
    track: headers.track,
    use_case: body.use_case || null,
    schema_id: body.schema_id || null
  });

  // Persist to file for future fine-tuning pipeline
  const filePath = path.join(TRAINING_DIR, `training_example.${exampleId}.json`);
  try {
    await fsp.writeFile(filePath, JSON.stringify(record, null, 2), 'utf-8');
  } catch (e) {
    console.error('training_example_write_error', e);
    // Non-fatal: we still respond 200 but flag error in meta if needed later
  }

  // Record for ops summary (event + total)
  recordOpsEvent('training_example', headers, { track: body.track });
  TOTAL_TRAINING += 1;

  res.json({ status: 'ok', id: exampleId });
});

// Feedback endpoint
app.post('/feedback', async (req, res) => {
  const body = req.body || {};
  const headers = {
    tenant: req.get('X-GT3-Tenant') || null,
    track: req.get('X-GT3-Data-Track') || null
  };
  await ledgerLog({
    event: 'feedback',
    ...headers,
    accepted:
      typeof body.accepted === 'boolean' ? body.accepted : null,
    edited_len:
      typeof body.edited_text === 'string'
        ? body.edited_text.length
        : 0,
    meta: body.meta || null
  });

  // Optionally also track feedback events for tenant/track stats
  recordOpsEvent('feedback', headers);

  res.json({ status: 'ok' });
});

// Ops summary endpoint (used by gt3.html Dashboard)
app.get('/ops/summary', async (req, res) => {
  // Re-read bringup so Dashboard Refresh reflects postinstall without process restart.
  try {
    agentRuntimeBringup = await readAgentRuntimeBringup(__dirname);
  } catch (e) {
    agentRuntimeBringup = {
      bringup_status: 'unknown',
      detail: e && e.message ? String(e.message) : String(e),
      docker: null,
      image: null,
      agentfs: null,
      aider: null,
      read_at: new Date().toISOString()
    };
  }

  const now = Date.now();
  const uptimeSeconds = Math.floor((now - PROCESS_START_TS) / 1000);

  const last5m = now - 5 * 60 * 1000;
  const last1h = now - 60 * 60 * 1000;

  let inferenceCount = 0;
  let trainingCount = 0;
  let agentBrokerOk5m = 0;
  let agentBrokerErr5m = 0;

  const trackCounts = {
    green: 0,
    orange: 0,
    red: 0
  };

  const tenantCounts = new Map();

  for (const ev of OPS_EVENTS) {
    if (ev.ts >= last5m) {
      if (ev.kind === 'inference') inferenceCount += 1;
      if (ev.kind === 'training_example') trainingCount += 1;
      if (ev.kind === 'agent_broker_ok') agentBrokerOk5m += 1;
      if (ev.kind === 'agent_broker_error') agentBrokerErr5m += 1;
    }
    if (ev.ts >= last1h) {
      const track = (ev.track || '').toLowerCase();
      if (track === 'green') trackCounts.green += 1;
      else if (track === 'orange') trackCounts.orange += 1;
      else if (track === 'red') trackCounts.red += 1;

      const tenant = ev.tenant || 'unknown';
      tenantCounts.set(tenant, (tenantCounts.get(tenant) || 0) + 1);
    }
  }

  const topTenants = Array.from(tenantCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tenant_id, events]) => ({ tenant_id, events }));

  const summaryDist = getDistilledMeta(gt3RuntimeLlm.expressionProfile);
  res.json({
    server_version: SERVER_VERSION,
    uptime_seconds: uptimeSeconds,
    llm_provider: gt3RuntimeLlm.provider,
    model_id: currentModelId(),
    inference_mode: gt3RuntimeLlm.inferenceMode,
    dual_inference: gt3RuntimeLlm.inferenceMode === 'dual',
    expression_profile: gt3RuntimeLlm.expressionProfile,
    expression_skills: listExpressionSkillsForOps(),
    expression_skills_dir: getExpressionSkillsDir(),
    expression_distilled: summaryDist
      ? {
          sha256: summaryDist.sha256,
          byte_length: summaryDist.byteLength,
          full_spec_ref: summaryDist.fullSpecRef
        }
      : null,
    traffic_total: {
      inference: TOTAL_INFERENCE,
      training_example: TOTAL_TRAINING
    },
    traffic_last_5m: {
      inference: inferenceCount,
      training_example: trainingCount
    },
    tracks_last_1h: trackCounts,
    top_tenants_last_1h: topTenants,
    agent_runtime: {
      bringup_status:
        GT3_LEXIOM_AGENT_KEY || OPENROUTER_API_KEY ? 'ok' : 'failed',
      detail:
        GT3_LEXIOM_AGENT_KEY || OPENROUTER_API_KEY
          ? 'CA bolt_webcontainer ready (browser WebContainer + broker). Docker/Aider is Follow-up only.'
          : 'Agent broker key missing (GT3_LEXIOM_AGENT_KEY or OPENROUTER_API_KEY).',
      ca_location: CA_LOCATION_BROWSER_SESSION,
      executor: EXECUTOR_ID,
      docker: agentRuntimeBringup.docker || null,
      image: agentRuntimeBringup.image || null,
      agentfs: null,
      aider: null,
      read_at: new Date().toISOString()
    },
    agent_broker: {
      openrouter_model_id: GT3_AGENT_OPENROUTER_MODEL,
      agent_model_id: GT3_AGENT_OPENROUTER_MODEL,
      destination: {
        id: GT3_AGENT_LM_DESTINATION.id,
        label: GT3_AGENT_LM_DESTINATION.label,
        transport: GT3_AGENT_LM_DESTINATION.transport,
        locality: GT3_AGENT_LM_DESTINATION.locality,
        endpoint_kind: GT3_AGENT_LM_DESTINATION.endpoint_kind
      },
      observability: {
        schema_version: 'gt3-lm-exchange/1',
        packet_capture: 'redacted_full',
        max_chars_per_text_surface: GT3_AGENT_OBSERVABILITY_MAX_CHARS
      },
      traffic_total: {
        ok: TOTAL_AGENT_BROKER_OK,
        error: TOTAL_AGENT_BROKER_ERROR
      },
      traffic_last_5m: {
        ok: agentBrokerOk5m,
        error: agentBrokerErr5m
      },
      last_error_detail: LAST_AGENT_ERROR_DETAIL,
      key_configured: !!(GT3_LEXIOM_AGENT_KEY || OPENROUTER_API_KEY)
    },
    recent_agent_runs: listRecentAgentRuns(20)
  });
});

app.get('/ops/expression-skills', (req, res) => {
  res.json({
    dir: getExpressionSkillsDir(),
    skills: listExpressionSkillsForOps()
  });
});

app.post('/ops/reload-expression-skills', (req, res) => {
  try {
    reloadAllDistilledFiles();
    const valid = buildValidExpressionProfileSet();
    if (!valid.has(gt3RuntimeLlm.expressionProfile)) {
      console.warn(
        `[ops/reload-expression-skills] current expression_profile=${gt3RuntimeLlm.expressionProfile} no longer valid; resetting to none`
      );
      gt3RuntimeLlm.expressionProfile = 'none';
    }
    res.json({
      status: 'ok',
      dir: getExpressionSkillsDir(),
      skills: listExpressionSkillsForOps(),
      expression_profile: gt3RuntimeLlm.expressionProfile
    });
  } catch (e) {
    res.status(500).json({
      status: 'error',
      detail: e && e.message ? String(e.message) : String(e)
    });
  }
});

const VALID_OPS_LLM_PROVIDERS = new Set([
  'mock',
  'ollama',
  'openrouter',
  'openai'
]);

// Runtime LLM / dual-inference config (GT3 ops console — gt3.html)
app.post('/ops/config', (req, res) => {
  const body = req.body || {};
  const llm_provider =
    typeof body.llm_provider === 'string'
      ? body.llm_provider.trim().toLowerCase()
      : '';
  if (!VALID_OPS_LLM_PROVIDERS.has(llm_provider)) {
    return res.status(400).json({
      detail:
        'llm_provider must be one of: mock, ollama, openrouter, openai'
    });
  }

  const model_id =
    typeof body.model_id === 'string' ? body.model_id.trim() : '';

  if (llm_provider !== 'mock' && !model_id) {
    return res.status(400).json({
      detail:
        'model_id is required (non-empty) when llm_provider is not mock'
    });
  }

  gt3RuntimeLlm.provider = llm_provider;

  if (body.inference_mode !== undefined && body.inference_mode !== null) {
    const im = String(body.inference_mode).trim().toLowerCase();
    if (!GT3_VALID_INFERENCE_MODES.has(im)) {
      return res.status(400).json({
        detail: `inference_mode must be one of: ${[...GT3_VALID_INFERENCE_MODES].sort().join(', ')}`
      });
    }
    gt3RuntimeLlm.inferenceMode = im;
  } else if (body.dual_inference !== undefined) {
    gt3RuntimeLlm.inferenceMode = body.dual_inference ? 'dual' : 'single';
  }

  if (body.expression_profile !== undefined && body.expression_profile !== null) {
    const ep = normalizeExpressionProfileId(body.expression_profile);
    const validEp = buildValidExpressionProfileSet();
    if (!validEp.has(ep)) {
      return res.status(400).json({
        detail: `expression_profile must be one of: ${[...validEp].sort().join(', ')}`
      });
    }
    gt3RuntimeLlm.expressionProfile = ep;
  }

  if (llm_provider === 'openrouter') {
    gt3RuntimeLlm.openrouterModel = model_id;
  } else if (llm_provider === 'openai') {
    gt3RuntimeLlm.openaiModel = model_id;
  } else if (llm_provider === 'ollama') {
    gt3RuntimeLlm.ollamaModel = model_id;
  }

  const cfgDist = getDistilledMeta(gt3RuntimeLlm.expressionProfile);
  console.log(
    `[ops/config] provider=${gt3RuntimeLlm.provider} model=${currentModelId()} inference_mode=${gt3RuntimeLlm.inferenceMode} expression_profile=${gt3RuntimeLlm.expressionProfile}`
  );

  res.json({
    llm_provider: gt3RuntimeLlm.provider,
    model_id: currentModelId(),
    inference_mode: gt3RuntimeLlm.inferenceMode,
    dual_inference: gt3RuntimeLlm.inferenceMode === 'dual',
    expression_profile: gt3RuntimeLlm.expressionProfile,
    expression_distilled: cfgDist
      ? {
          sha256: cfgDist.sha256,
          byte_length: cfgDist.byteLength,
          full_spec_ref: cfgDist.fullSpecRef
        }
      : null
  });
});

// Lexiom session essence: client-emitted events in logs/<uuid>/session_events.jsonl
app.post('/lexiom-session/event', async (req, res) => {
  const gameRecordRaw =
    req.get('X-GT3-Game-Record') ||
    req.body?.game_record_id ||
    null;
  const gameRecord = sanitizeGameRecordId(gameRecordRaw);
  if (!gameRecord) {
    return res
      .status(400)
      .json({ detail: 'Invalid or missing game record id (header X-GT3-Game-Record or body.game_record_id)' });
  }

  const v = validateSessionEventBody(req.body);
  if (!v.ok) {
    return res.status(400).json({ detail: v.detail });
  }

  const absDir = path.join(LOG_DIR, gameRecord);
  try {
    await fsp.mkdir(absDir, { recursive: true });
  } catch (e) {
    console.error('lexiom_session_event_mkdir', e);
    return res.status(500).json({ detail: 'Failed to prepare session directory' });
  }

  const record = {
    ts_server: nowIso(),
    game_record_id: gameRecord,
    schema_id: req.body.schema_id,
    event_type: req.body.event_type,
    seq_client: typeof req.body.seq === 'number' ? req.body.seq : null,
    idempotency_key:
      typeof req.body.idempotency_key === 'string' ? req.body.idempotency_key : null,
    ts_client: typeof req.body.ts_client === 'string' ? req.body.ts_client : null,
    payload: req.body.payload
  };

  const line = JSON.stringify(record) + '\n';
  const filePath = path.join(absDir, SESSION_EVENTS_FILENAME);
  try {
    await fsp.appendFile(filePath, line, 'utf-8');
  } catch (e) {
    console.error('lexiom_session_event_append', e);
    return res.status(500).json({ detail: 'Failed to persist event' });
  }

  await ledgerLog({
    event: 'lexiom_session_event',
    tenant: req.get('X-GT3-Tenant') || null,
    track: req.get('X-GT3-Data-Track') || null,
    game_record: gameRecord,
    session_event_type: req.body.event_type
  });

  res.json({ ok: true });
});

// Game-record folders: only sessions with non-empty session_events.jsonl
app.get('/game-records', async (req, res) => {
  try {
    const entries = await fsp.readdir(LOG_DIR, { withFileTypes: true });
    const records = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (!sanitizeGameRecordId(e.name)) continue;
      const absDir = path.join(LOG_DIR, e.name);
      if (!(await gameRecordDirHasSessionEvents(absDir))) continue;
      const fp = path.join(absDir, SESSION_EVENTS_FILENAME);
      let last_activity_at = null;
      try {
        const st = await fsp.stat(fp);
        last_activity_at = st.mtime.toISOString();
      } catch {
        /* keep null */
      }
      records.push({ id: e.name, last_activity_at });
    }
    records.sort((a, b) => {
      const ta = a.last_activity_at ? Date.parse(a.last_activity_at) : 0;
      const tb = b.last_activity_at ? Date.parse(b.last_activity_at) : 0;
      if (tb !== ta) return tb - ta;
      return a.id.localeCompare(b.id);
    });
    res.json({
      records: records.map(r => ({
        id: r.id,
        last_activity_at: r.last_activity_at,
        essence_path: `/game-records/${encodeURIComponent(r.id)}/essence`
      }))
    });
  } catch (e) {
    console.error('game_records_list_error', e);
    res.status(500).json({ detail: 'Failed to list game records' });
  }
});

app.get('/game-records/:id/essence', async (req, res) => {
  const id = sanitizeGameRecordId(req.params.id);
  if (!id) {
    return res.status(400).json({ detail: 'Invalid game record id' });
  }
  const absDir = path.join(LOG_DIR, id);
  try {
    const st = await fsp.stat(absDir);
    if (!st.isDirectory()) {
      return res.status(404).json({ detail: 'Not found' });
    }
  } catch {
    return res.status(404).json({ detail: 'Not found' });
  }
  try {
    const events = await readSessionEvents(absDir);
    const grouped = groupSessionEvents(events);
    const bounds = sessionEventTimeBounds(events);
    res.json({
      id,
      schema: SESSION_EVENT_SCHEMA_V1,
      event_count: events.length,
      first_event_at: bounds.first_event_at,
      last_event_at: bounds.last_event_at,
      events,
      grouped
    });
  } catch (e) {
    console.error('game_record_essence_error', e);
    res.status(500).json({ detail: 'Failed to read session essence' });
  }
});

app.get('/ops/agent-exchanges/:exchangeId', async (req, res) => {
  const exchangeId = String(req.params.exchangeId || '');
  if (!isValidExchangeId(exchangeId)) {
    return res.status(400).json({ detail: 'Invalid LM exchange id.' });
  }
  const exchange = await readLmExchange(LOG_DIR, exchangeId);
  if (!exchange) {
    return res.status(404).json({ detail: 'LM exchange not found.' });
  }
  res.setHeader('Cache-Control', 'no-store');
  res.json(exchange);
});

// Inference logs endpoint (used by gt3FetchLogs in GT3.html)
app.get('/inferences', async (req, res) => {
  try {
    const raw = await fsp.readFile(LEDGER_PATH, 'utf-8');
    const lines = raw.split('\n').filter(Boolean);

    const events = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let rec;
      try {
        rec = JSON.parse(line);
      } catch {
        continue;
      }
      if (!rec || !rec.event) continue;
      const isProduct =
        rec.event === 'inference_single' || rec.event === 'inference_variant';
      const isAgent =
        rec.event === 'agent_broker_complete' ||
        rec.event === 'agent_broker_error' ||
        rec.event === 'agent_broker_request';
      if (!isProduct && !isAgent) {
        continue;
      }

      const tsIso = rec.ts_iso || rec.ts || null;

      if (isAgent) {
        events.push({
          id: rec.id ? `${rec.id}:${rec.event}` : String(i),
          exchange_id: rec.id || null,
          ts_iso: tsIso,
          lane: 'agent_broker',
          event: rec.event,
          label: rec.event,
          ok: typeof rec.ok === 'boolean' ? rec.ok : null,
          latency_ms:
            typeof rec.latency_ms === 'number' ? rec.latency_ms : null,
          upstream: rec.upstream || 'openrouter',
          destination: rec.destination || rec.upstream || 'openrouter',
          transport: rec.transport || 'openai_compatible_http',
          destination_locality: rec.destination_locality || 'remote',
          model: rec.model || null,
          run_id: rec.run_id || null,
          pass: rec.pass || null,
          plugin_id: rec.plugin_id || null,
          upstream_status:
            typeof rec.upstream_status === 'number'
              ? rec.upstream_status
              : null,
          detail: rec.detail || null,
          request_message_count:
            typeof rec.request_message_count === 'number'
              ? rec.request_message_count
              : null,
          request_chars:
            typeof rec.request_chars === 'number' ? rec.request_chars : null,
          response_chars:
            typeof rec.response_chars === 'number' ? rec.response_chars : null,
          tenant: rec.tenant || null,
          track: rec.track || null,
          log_file: rec.log_file || null,
          log_url: rec.log_url || rec.log_file || null,
          exchange_url:
            rec.log_url ||
            rec.log_file ||
            (rec.id
              ? `/ops/agent-exchanges/${encodeURIComponent(rec.id)}`
              : null)
        });
        continue;
      }

      events.push({
        id: rec.id || rec.log_file || String(i),
        ts_iso: tsIso,
        lane: 'product_inference',
        event: rec.event,
        label: rec.label ?? null,
        ok: typeof rec.ok === 'boolean' ? rec.ok : null,
        latency_ms:
          typeof rec.latency_ms === 'number' ? rec.latency_ms : null,
        provider: rec.provider || null,
        model: rec.model || null,
        tenant: rec.tenant || null,
        track: rec.track || null,
        consent: rec.consent || null,
        narrative_len:
          typeof rec.narrative_len === 'number' ? rec.narrative_len : null,
        response_len:
          typeof rec.response_len === 'number' ? rec.response_len : null,
        log_file: rec.log_file || null,
        game_record: rec.game_record || null
      });
    }

    // Sort newest first by ts_iso
    events.sort((a, b) => {
      const ta = Date.parse(a.ts_iso || '') || 0;
      const tb = Date.parse(b.ts_iso || '') || 0;
      return tb - ta;
    });

    // Optionally limit the number of events (GT3.html will slice again)
    const MAX_EVENTS = 1000;
    const sliced = events.slice(0, MAX_EVENTS);

    res.json({ events: sliced });
  } catch (e) {
    console.error('inferences_read_error', e);
    res
      .status(500)
      .json({ detail: 'Failed to read inference logs from ledger.jsonl' });
  }
});

// Training examples listing endpoint (for GT3 "Training examples" tab)
app.get('/training-examples', async (req, res) => {
  try {
    const files = await fsp.readdir(TRAINING_DIR);
    const examples = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const fullPath = path.join(TRAINING_DIR, file);
      try {
        const raw = await fsp.readFile(fullPath, 'utf-8');
        const rec = JSON.parse(raw);

        const tsIso = rec.ts || rec.ts_iso || null;
        const headers = rec.headers || {};
        const body = rec.body || {};

        const idFromFile = file
          .replace(/^training_example\./, '')
          .replace(/\.json$/, '');

        examples.push({
          id: rec.id || idFromFile,
          ts_iso: tsIso,
          tenant: headers.tenant || null,
          track: headers.track || null,
          use_case: body.use_case || null,
          schema_id: body.schema_id || null,
          file_url: `/training_examples/${file}`
        });
      } catch (e) {
        console.error('training_examples_parse_error', file, e);
        continue;
      }
    }

    // Newest first
    examples.sort((a, b) => {
      const ta = Date.parse(a.ts_iso || '') || 0;
      const tb = Date.parse(b.ts_iso || '') || 0;
      return tb - ta;
    });

    const MAX = 1000;
    res.json({ examples: examples.slice(0, MAX) });
  } catch (e) {
    console.error('training_examples_list_error', e);
    res
      .status(500)
      .json({ detail: 'Failed to list training examples from training_examples directory' });
  }
});

// ---------- Builds static (dedicated port) ----------
// Product UIs live under ./public on PORT. Build-plugin outputs under ./builds
// are served on GT3_BUILDS_PORT (default 8081) so experimental artifacts stay
// off the product URL space and cannot collide with /gt2, /gt3, etc.
// Example: http://localhost:8081/lexiom13/<runId>/
function startBuildsStaticServer() {
  if (!Number.isFinite(BUILDS_PORT) || BUILDS_PORT <= 0) {
    console.log('Builds static server: disabled (GT3_BUILDS_PORT<=0)');
    return null;
  }
  const buildsApp = express();
  if (CORS_ORIGINS.includes('*')) buildsApp.use(cors());
  else buildsApp.use(cors({ origin: CORS_ORIGINS, credentials: true }));
  buildsApp.use(morgan('dev'));
  buildsApp.use(
    express.static(BUILDS_ROOT, {
      etag: false,
      lastModified: false,
      setHeaders(res) {
        // Build previews change often during agent runs; avoid stale HTML/JS.
        res.set('Cache-Control', 'no-store');
      }
    })
  );
  buildsApp.get('/', (_req, res) => {
    res
      .type('text/plain')
      .send(
        [
          'GT3 builds static server',
          `Root: ${BUILDS_ROOT}`,
          'Browse a run, e.g. /lexiom13/<runId>/',
          ''
        ].join('\n')
      );
  });
  const server = buildsApp.listen(BUILDS_PORT, '0.0.0.0', () => {
    console.log(
      `Builds static: http://0.0.0.0:${BUILDS_PORT}/  (./builds → e.g. /lexiom13/<runId>/)`
    );
  });
  server.on('error', (err) => {
    console.error(
      `Builds static server failed to bind 0.0.0.0:${BUILDS_PORT}:`,
      err && err.message ? err.message : err
    );
  });
  return server;
}

// ---------- Listen ----------
// Listen on 0.0.0.0 to accept connections from Elastic Beanstalk load balancer
// When running locally, this still works fine (0.0.0.0 includes localhost)
app.listen(PORT, '0.0.0.0', () => {
  let modelInfo = '';
  if (gt3RuntimeLlm.provider === 'openrouter') modelInfo = `, model: ${gt3RuntimeLlm.openrouterModel}`;
  else if (gt3RuntimeLlm.provider === 'ollama') modelInfo = `, model: ${gt3RuntimeLlm.ollamaModel}`;
  else if (gt3RuntimeLlm.provider === 'openai') modelInfo = `, model: ${gt3RuntimeLlm.openaiModel}`;

  console.log(
    `GT3 POC Node server (${SERVER_VERSION}) listening on 0.0.0.0:${PORT}`
  );
  console.log(
    `Provider: ${gt3RuntimeLlm.provider}${modelInfo}, inference_mode=${gt3RuntimeLlm.inferenceMode}, expression_profile=${gt3RuntimeLlm.expressionProfile}`
  );
  console.log(`ODD image model (OpenRouter): ${GT3_OPENROUTER_IMAGE_MODEL}`);
  const ar = agentRuntimeBringup || {};
  console.log(
    `Agent runtime bringup: bolt_webcontainer @ browser_session` +
      (GT3_LEXIOM_AGENT_KEY || OPENROUTER_API_KEY
        ? ' — broker key present'
        : ' — broker key MISSING (set OPENROUTER_API_KEY or GT3_LEXIOM_AGENT_KEY in .env, then restart)') +
      (ar.docker && ar.docker.version
        ? `; legacy_docker=${ar.docker.version}`
        : '')
  );
  console.log(
    `Agent broker: POST /v1/chat/completions → OpenRouter model=${GT3_AGENT_OPENROUTER_MODEL}` +
      `; agent_key=${GT3_LEXIOM_AGENT_KEY ? 'set' : 'unset'}` +
      `; openrouter_key=${OPENROUTER_API_KEY ? 'set' : 'unset'}`
  );
  console.log(
    `GT2 / Legato SPA: /gt2/legato/`
  );
  console.log(
    `GT2 / QuoteMe SPA: /gt2/QuoteMe/`
  );
  console.log(
    `GT3 Ops Console: /gt3/gt3.html`
  );
  console.log(
    `Inference logs: /logs/… (also listed via /inferences)`
  );
  console.log(
    `Training examples: /training_examples/… (also listed via /training-examples)`
  );
  startBuildsStaticServer();
});
