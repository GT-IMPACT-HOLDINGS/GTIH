/**
 * Expression skills: distilled LM instructions loaded from repo-root Expression_skills/
 * (scanned at startup and on POST /ops/reload-expression-skills).
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IGNORED_BASENAMES = new Set(['readme.md', '_meta.json']);
const SAFE_ID = /^[a-z0-9][a-z0-9_-]*$/;

/** @type {Map<string, string>} id -> distilled body */
const distilledCache = new Map();

/** @type {Map<string, { label?: string, full_spec_ref?: string }>} */
const skillMetaById = new Map();

let skillsDirResolved = '';

function resolveExpressionSkillsDir() {
  const candidates = [
    path.join(__dirname, '..', 'Expression_skills'),
    path.join(__dirname, '..', '..', 'Expression_skills')
  ];
  for (const d of candidates) {
    try {
      if (fs.existsSync(d) && fs.statSync(d).isDirectory()) {
        return d;
      }
    } catch {
      /* continue */
    }
  }
  return candidates[0];
}

function ensureSkillsDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    /* ignore */
  }
}

function loadSkillMetaFile(dir) {
  skillMetaById.clear();
  const metaPath = path.join(dir, '_meta.json');
  try {
    if (!fs.existsSync(metaPath)) return;
    const raw = fs.readFileSync(metaPath, 'utf8');
    const parsed = JSON.parse(raw);
    const skills = parsed && typeof parsed === 'object' && parsed.skills;
    if (!skills || typeof skills !== 'object') return;
    for (const [id, v] of Object.entries(skills)) {
      if (!v || typeof v !== 'object') continue;
      skillMetaById.set(String(id).toLowerCase(), {
        label: typeof v.label === 'string' ? v.label : undefined,
        full_spec_ref: typeof v.full_spec_ref === 'string' ? v.full_spec_ref : undefined
      });
    }
  } catch (e) {
    console.warn('[expression-skills] _meta.json parse failed:', e && e.message ? e.message : e);
  }
}

/**
 * Scan Expression_skills/ for *.md and *.txt; refill distilledCache.
 */
export function reloadAllDistilledFiles() {
  const dir = resolveExpressionSkillsDir();
  skillsDirResolved = dir;
  ensureSkillsDir(dir);
  loadSkillMetaFile(dir);
  distilledCache.clear();

  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    console.warn('[expression-skills] cannot read directory:', dir, e && e.message ? e.message : e);
    return;
  }

  for (const ent of entries) {
    if (!ent.isFile()) continue;
    const name = ent.name;
    const lower = name.toLowerCase();
    if (name.startsWith('.')) continue;
    if (IGNORED_BASENAMES.has(lower)) continue;
    const ext = path.extname(name).toLowerCase();
    if (ext !== '.md' && ext !== '.txt') continue;

    const id = path.basename(name, ext).toLowerCase();
    if (!SAFE_ID.test(id)) {
      console.warn('[expression-skills] skip invalid skill id from filename:', name);
      continue;
    }

    const fullPath = path.join(dir, name);
    try {
      const body = fs.readFileSync(fullPath, 'utf8').trim();
      distilledCache.set(id, body);
    } catch (e) {
      console.warn('[expression-skills] cannot read:', fullPath, e && e.message ? e.message : e);
    }
  }

  console.log(
    '[expression-skills] loaded',
    distilledCache.size,
    'skill(s) from',
    dir
  );
}

reloadAllDistilledFiles();

export function getExpressionSkillsDir() {
  return skillsDirResolved || resolveExpressionSkillsDir();
}

/**
 * @returns {{ id: string, label: string, full_spec_ref?: string }[]}
 */
export function listExpressionSkillsForOps() {
  const out = [];
  const ids = [...distilledCache.keys()].sort();
  for (const id of ids) {
    const meta = skillMetaById.get(id) || {};
    out.push({
      id,
      label: meta.label || id,
      ...(meta.full_spec_ref ? { full_spec_ref: meta.full_spec_ref } : {})
    });
  }
  return out;
}

export function buildValidExpressionProfileSet() {
  const s = new Set(['none']);
  for (const id of distilledCache.keys()) {
    s.add(id);
  }
  return s;
}

export function normalizeExpressionProfileId(raw) {
  if (raw == null) return 'none';
  const s = String(raw).trim().toLowerCase();
  if (!s || s === 'none') return 'none';
  return s;
}

/**
 * @returns {{ profile: string, label: string, fullSpecRef: string|null, sha256: string, byteLength: number }|null}
 */
export function getDistilledMeta(profile) {
  if (!profile || profile === 'none') return null;
  const body = distilledCache.get(profile);
  if (!body) return null;
  const meta = skillMetaById.get(profile) || {};
  const sha256 = crypto.createHash('sha256').update(body, 'utf8').digest('hex');
  return {
    profile,
    label: meta.label || profile,
    fullSpecRef: meta.full_spec_ref || null,
    sha256,
    byteLength: Buffer.byteLength(body, 'utf8')
  };
}

function lovingWrapAlreadyApplied(t) {
  const firstLine = (t.split(/\r?\n/, 1)[0] || '').trim();
  if (firstLine.startsWith('GT3_EXPR:')) return true;
  if (firstLine === '---TASK---') return true;
  return false;
}

/** Profile `none`: legacy `Love, ` framing (see GT3_Narrative_Expression_Ingress_Spec). */
function buildNoneProfileLovingUserMessage(t) {
  if (lovingWrapAlreadyApplied(t)) return t;
  if (t.toLowerCase().startsWith('love,')) return t;
  return 'Love, ' + t;
}

/**
 * @param {string} narrative trimmed client narrative
 * @param {string} profile expression profile id (e.g. shefa, none)
 */
export function buildLovingUserMessage(narrative, profile) {
  const t = String(narrative || '');
  const p = normalizeExpressionProfileId(profile);
  if (!p || p === 'none') {
    return buildNoneProfileLovingUserMessage(t);
  }
  if (lovingWrapAlreadyApplied(t)) return t;
  const distillate = distilledCache.get(p);
  if (!distillate) {
    return buildNoneProfileLovingUserMessage(t);
  }
  return (
    'Beloved lover, follow for tone and stance; then address the task below.\n\n' +
    distillate +
    '\n\n---TASK---\n\n' +
    t
  );
}
