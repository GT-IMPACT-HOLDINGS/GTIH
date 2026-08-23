// =============================================================
// QuoteMe v1 QA Test Helper Utilities
// For external automated test systems (Playwright, Puppeteer, etc.)
// =============================================================

/**
 * Clear all QuoteMe data from localStorage
 * Wipes `quoteme.v1` and related keys
 */
function clearStorage() {
  try {
    localStorage.removeItem('quoteme.v1');
    localStorage.removeItem('quoteme_gt3_api_key');
    return { success: true, message: 'Storage cleared successfully' };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

/**
 * Create a synthetic test Profile
 * @param {Object} overrides - Optional field overrides
 * @returns {Object} Synthetic Profile object
 */
function createTestProfile(overrides = {}) {
  const now = new Date().toISOString();
  return {
    name: overrides.name || 'Test User',
    roleTitle: overrides.roleTitle || 'Sales Manager',
    companyName: overrides.companyName || 'Test Company Inc.',
    industrySegment: overrides.industrySegment || 'Technology',
    geography: overrides.geography || 'North America',
    productServiceCategory: overrides.productServiceCategory || 'Software Solutions',
    companyDescription: overrides.companyDescription || 'A test company for QA scenarios.',
    createdAt: overrides.createdAt || now,
    updatedAt: overrides.updatedAt || now,
    ...overrides
  };
}

/**
 * Create a synthetic test Opportunity
 * @param {Object} overrides - Optional field overrides
 * @returns {Object} Synthetic Opportunity object
 */
function createTestOpportunity(overrides = {}) {
  const now = new Date().toISOString();
  const opportunityId = overrides.id || `test-opp-${Date.now()}`;
  
  return {
    id: opportunityId,
    title: overrides.title || 'Test Opportunity',
    status: {
      statusText: overrides.status?.statusText || 'Initial contact made with customer.',
      hasLmDraft: overrides.status?.hasLmDraft !== undefined ? overrides.status.hasLmDraft : true,
      hasUserEdits: overrides.status?.hasUserEdits !== undefined ? overrides.status.hasUserEdits : false,
      statusApproved: overrides.status?.statusApproved !== undefined ? overrides.status.statusApproved : false,
      statusApprovedAt: overrides.status?.statusApprovedAt || null
    },
    workplan: {
      workplanText: overrides.workplan?.workplanText || '1. Schedule discovery call\n2. Present solution\n3. Negotiate terms',
      hasLmDraft: overrides.workplan?.hasLmDraft !== undefined ? overrides.workplan.hasLmDraft : true,
      hasUserEdits: overrides.workplan?.hasUserEdits !== undefined ? overrides.workplan.hasUserEdits : false,
      workplanApproved: overrides.workplan?.workplanApproved !== undefined ? overrides.workplan.workplanApproved : false,
      workplanApprovedAt: overrides.workplan?.workplanApprovedAt || null
    },
    ep: {
      epText: overrides.ep?.epText || null,
      hasLmDraft: overrides.ep?.hasLmDraft !== undefined ? overrides.ep.hasLmDraft : false,
      hasUserEdits: overrides.ep?.hasUserEdits !== undefined ? overrides.ep.hasUserEdits : false,
      epApproved: overrides.ep?.epApproved !== undefined ? overrides.ep.epApproved : false,
      epApprovedAt: overrides.ep?.epApprovedAt || null,
      epSent: overrides.ep?.epSent !== undefined ? overrides.ep.epSent : false,
      epSentAt: overrides.ep?.epSentAt || null
    },
    auditLog: overrides.auditLog || [],
    createdAt: overrides.createdAt || now,
    updatedAt: overrides.updatedAt || now,
    ...overrides
  };
}

/**
 * Create a synthetic test PA (Proposal Anatomy)
 * @param {Object} overrides - Optional field overrides
 * @returns {Object} Synthetic PA object
 */
function createTestPA(overrides = {}) {
  const now = new Date().toISOString();
  return {
    text: overrides.text || `# Proposal Structure

## Executive Summary
Brief overview of the engagement.

## Solution Overview
Detailed description of the proposed solution.

## Implementation Plan
Step-by-step implementation approach.

## Pricing
Pricing details and terms.

## Next Steps
Recommended next actions.`,
    paApproved: overrides.paApproved !== undefined ? overrides.paApproved : false,
    paApprovedAt: overrides.paApprovedAt || null,
    hasLmDraft: overrides.hasLmDraft !== undefined ? overrides.hasLmDraft : true,
    hasUserEdits: overrides.hasUserEdits !== undefined ? overrides.hasUserEdits : false,
    createdAt: overrides.createdAt || now,
    updatedAt: overrides.updatedAt || now,
    ...overrides
  };
}

/**
 * Load test data into localStorage
 * @param {Object} data - QuoteMe data object (profile, pa, opportunities, etc.)
 */
function loadTestData(data) {
  try {
    const storageKey = 'quoteme.v1';
    localStorage.setItem(storageKey, JSON.stringify(data));
    return { success: true, message: 'Test data loaded successfully' };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

/**
 * Get current QuoteMe data from localStorage
 * @returns {Object|null} QuoteMe data object or null if not found
 */
function getTestData() {
  try {
    const storageKey = 'quoteme.v1';
    const data = localStorage.getItem(storageKey);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    return null;
  }
}

// Export functions for external test frameworks
// These can be accessed via window.quotemeQA or imported as ES modules
if (typeof window !== 'undefined') {
  window.quotemeQA = {
    clearStorage,
    createTestProfile,
    createTestOpportunity,
    createTestPA,
    loadTestData,
    getTestData
  };
}

export {
  clearStorage,
  createTestProfile,
  createTestOpportunity,
  createTestPA,
  loadTestData,
  getTestData
};

