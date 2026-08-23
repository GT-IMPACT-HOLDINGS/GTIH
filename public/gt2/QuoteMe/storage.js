// =============================================================
// QuoteMe v1 Storage Module
// localStorage schema and data utilities
// =============================================================

const STORAGE_KEY = 'quoteme.v1';
const SCHEMA_VERSION = 1;

// ---------- Timestamp helpers ----------
function nowIso() {
  return new Date().toISOString();
}

// UUID generator with fallback for non-secure contexts (HTTP)
function uuid() {
  try {
    // Try crypto.randomUUID() first (works in HTTPS/secure contexts)
    if (crypto && crypto.randomUUID) {
  return crypto.randomUUID();
    }
  } catch (e) {
    // crypto.randomUUID() not available (non-secure context)
  }
  // Fallback: UUID v4 generator using Math.random() (works in all contexts)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ---------- Root data structure ----------
function createDefaultData() {
  return {
    schemaVersion: SCHEMA_VERSION,
    profile: null,
    pa: null,
    opportunities: []
  };
}

// ---------- Load/Save ----------
function loadQuoteMeData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createDefaultData();
    }
    const parsed = JSON.parse(raw);
    
    // Validate schema version
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      console.warn(`[storage] Schema version mismatch: expected ${SCHEMA_VERSION}, got ${parsed.schemaVersion}`);
      // v1 doesn't require migrations, but log warning
    }
    
    // Ensure required fields exist
    if (!parsed.opportunities) parsed.opportunities = [];
    if (parsed.profile === undefined) parsed.profile = null;
    if (parsed.pa === undefined) parsed.pa = null;
    
    return parsed;
  } catch (e) {
    console.error('[storage] Failed to parse localStorage data:', e);
    // Return default structure, but could show error to user
    return createDefaultData();
  }
}

function saveQuoteMeData(data) {
  try {
    const json = JSON.stringify(data);
    localStorage.setItem(STORAGE_KEY, json);
    return true;
  } catch (e) {
    console.error('[storage] Failed to save to localStorage:', e);
    // Could be quota exceeded or other error
    return false;
  }
}

// ---------- Profile utilities ----------
function validateProfile(profile) {
  const errors = [];
  // Name is now mandatory (replaces roleTitle as mandatory)
  const required = ['name', 'companyName', 'industrySegment', 'geography', 'productServiceCategory'];
  
  for (const field of required) {
    if (!profile[field] || !profile[field].trim()) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

function createProfile(fields) {
  const now = nowIso();
  return {
    name: fields.name || '',
    roleTitle: fields.roleTitle || null, // Now optional
    companyName: fields.companyName || '',
    industrySegment: fields.industrySegment || '',
    geography: fields.geography || '',
    productServiceCategory: fields.productServiceCategory || '',
    companyDescription: fields.companyDescription || null, // New optional field
    createdAt: now,
    updatedAt: now
  };
}

function updateProfile(profile, updates) {
  const updated = { ...profile, ...updates, updatedAt: nowIso() };
  return updated;
}

// ---------- PA utilities ----------
function createPA(text, fromLM = true) {
  const now = nowIso();
  return {
    text: text || '',
    paApproved: false,
    paApprovedAt: null,
    hasLmDraft: fromLM, // Track if content originated from GT3
    hasUserEdits: false, // Track if user has edited since last LM fill
    createdAt: now,
    updatedAt: now
  };
}

function updatePA(pa, text, userEdited = false) {
  const updated = {
    ...pa,
    text: text || '',
    updatedAt: nowIso()
  };
  
  // Track user edits
  if (userEdited && pa.hasLmDraft) {
    updated.hasUserEdits = true;
  }
  
  // If PA was approved and text changed, revoke approval (per StateMachineSpec)
  if (pa && pa.paApproved && text !== pa.text) {
    updated.paApproved = false;
    updated.paApprovedAt = null;
  }
  
  return updated;
}

function approvePA(pa) {
  return {
    ...pa,
    paApproved: true,
    paApprovedAt: nowIso(),
    updatedAt: nowIso()
  };
}

// ---------- Opportunity utilities ----------
function createOpportunity(title = '') {
  const now = nowIso();
  return {
    id: uuid(),
    title: title.trim(),
    workplanText: '',
    statusText: '',
    workplanApproved: false,
    workplanApprovedAt: null,
    statusApproved: false,
    statusApprovedAt: null,
    // Track authorship for glyph states (per DraftFirst spec)
    workplanHasLmDraft: false,
    workplanHasUserEdits: false,
    statusHasLmDraft: false,
    statusHasUserEdits: false,
    ep: {
      epText: '',
      epGeneratedAt: null,
      epApproved: false,
      epApprovedAt: null,
      epSent: false,
      epSentAt: null
    },
    auditLog: [],
    createdAt: now,
    updatedAt: now
  };
}

function updateOpportunity(data, opportunityId, updates) {
  const opps = data.opportunities;
  const index = opps.findIndex(o => o.id === opportunityId);
  
  if (index === -1) {
    console.warn(`[storage] Opportunity ${opportunityId} not found`);
    return false;
  }
  
  opps[index] = {
    ...opps[index],
    ...updates,
    updatedAt: nowIso()
  };
  
  return saveQuoteMeData(data);
}

function getOpportunity(data, opportunityId) {
  return data.opportunities.find(o => o.id === opportunityId) || null;
}

function listOpportunities(data) {
  // Sort by updatedAt descending (most recently updated first)
  return [...data.opportunities].sort((a, b) => {
    const ta = Date.parse(a.updatedAt || a.createdAt || '');
    const tb = Date.parse(b.updatedAt || b.createdAt || '');
    return tb - ta;
  });
}

function deleteOpportunity(data, opportunityId) {
  data.opportunities = data.opportunities.filter(o => o.id !== opportunityId);
  return saveQuoteMeData(data);
}

// ---------- Audit log utilities ----------
function appendAuditLog(data, opportunityId, eventType, summary, payload = null) {
  const opportunity = getOpportunity(data, opportunityId);
  if (!opportunity) {
    console.warn(`[storage] Cannot append audit log: Opportunity ${opportunityId} not found`);
    return false;
  }
  
  const entry = {
    ts: nowIso(),
    eventType,
    summary,
    payload
  };
  
  opportunity.auditLog.push(entry);
  opportunity.updatedAt = nowIso();
  
  return saveQuoteMeData(data);
}

// ---------- Export ----------
export {
  loadQuoteMeData,
  saveQuoteMeData,
  validateProfile,
  createProfile,
  updateProfile,
  createPA,
  updatePA,
  approvePA,
  createOpportunity,
  updateOpportunity,
  getOpportunity,
  listOpportunities,
  deleteOpportunity,
  appendAuditLog,
  nowIso,
  uuid
};
