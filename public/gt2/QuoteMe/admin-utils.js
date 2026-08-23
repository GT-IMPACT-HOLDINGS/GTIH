// =============================================================
// QuoteMe v1 Admin Utilities
// Helper functions for admin diagnostics view
// =============================================================

/**
 * Get global status summary (Profile and PA)
 * @param {Object} data - QuoteMe data object
 * @returns {Object} Status summary with profile and pa status
 */
export function getGlobalStatus(data) {
  const profile = data.profile;
  const pa = data.pa;

  const profileStatus = {
    exists: profile !== null && profile !== undefined,
    valid: false,
    lastUpdated: null,
    statusClass: 'status-missing',
    text: 'Missing'
  };

  if (profileStatus.exists) {
    // Check if profile has required fields
    const required = ['companyName', 'roleTitle', 'industrySegment', 'geography', 'productServiceCategory'];
    profileStatus.valid = required.every(field => profile[field] && profile[field].trim());
    profileStatus.lastUpdated = profile.updatedAt || profile.createdAt;
    profileStatus.statusClass = profileStatus.valid ? 'status-valid' : 'status-invalid';
    profileStatus.text = profileStatus.valid ? 'Valid' : 'Invalid (missing required fields)';
  }

  const paStatus = {
    exists: pa !== null && pa !== undefined && pa.text && pa.text.trim(),
    approved: false,
    lastUpdated: null,
    statusClass: 'status-missing',
    text: 'Missing'
  };

  if (paStatus.exists) {
    paStatus.approved = pa.paApproved === true;
    paStatus.lastUpdated = pa.updatedAt || pa.createdAt;
    paStatus.statusClass = 'status-valid';
    paStatus.text = paStatus.approved ? 'Exists and approved' : 'Exists (not approved)';
  }

  return {
    profile: profileStatus,
    pa: paStatus
  };
}

/**
 * Format an audit log entry for display
 * @param {Object} entry - Audit log entry
 * @returns {string} HTML string for the entry
 */
export function formatAuditEntry(entry) {
  if (!entry || !entry.ts) {
    return '<div class="audit-entry"><p class="text-muted">Invalid entry</p></div>';
  }

  const timestamp = new Date(entry.ts).toLocaleString();
  const eventType = entry.eventType || 'unknown';
  const summary = entry.summary || 'No summary';
  
  // Determine entry class based on event type
  let entryClass = '';
  if (eventType === 'error') {
    entryClass = 'error';
  } else if (eventType.includes('_generated') || eventType.includes('_approved') || eventType === 'ep_sent') {
    entryClass = 'success';
  }

  let html = `<div class="audit-entry ${entryClass}">`;
  html += `<div class="d-flex justify-content-between align-items-start mb-2">`;
  html += `<div>`;
  html += `<strong>${escapeHtml(eventType)}</strong><br>`;
  html += `<small class="text-muted">${timestamp}</small>`;
  html += `</div>`;
  html += `<button class="btn btn-sm btn-outline-secondary" type="button" data-bs-toggle="collapse" data-bs-target="#payload-${entry.ts.replace(/[^a-zA-Z0-9]/g, '-')}" aria-expanded="false">`;
  html += `View Details`;
  html += `</button>`;
  html += `</div>`;
  html += `<p class="mb-2">${escapeHtml(summary)}</p>`;

  // Expandable payload section
  if (entry.payload) {
    const payloadId = `payload-${entry.ts.replace(/[^a-zA-Z0-9]/g, '-')}`;
    html += `<div class="collapse" id="${payloadId}">`;
    html += `<div class="payload-preview">`;
    html += formatPayload(entry.payload, eventType);
    html += `</div>`;
    html += `</div>`;
  }

  html += `</div>`;

  return html;
}

/**
 * Format payload for display
 * @param {Object} payload - Payload object
 * @param {string} eventType - Event type
 * @returns {string} Formatted payload HTML
 */
function formatPayload(payload, eventType) {
  let html = '';

  // Show truncation indicator if present
  if (payload.truncated) {
    html += `<div class="truncated-indicator mb-2">⚠ Truncated to 200k chars</div>`;
  }

  // Format based on event type
  if (eventType.includes('_generated') || eventType === 'title_proposed' || eventType === 'ep_generated') {
    // Inference event
    if (payload.requestNarrative) {
      html += `<strong>Request Narrative:</strong>\n`;
      html += `${truncateForDisplay(payload.requestNarrative, 5000)}\n\n`;
    }
    if (payload.responseText) {
      html += `<strong>Response Text:</strong>\n`;
      html += `${truncateForDisplay(payload.responseText, 5000)}\n\n`;
    }
    if (payload.latencyMs !== null && payload.latencyMs !== undefined) {
      html += `<strong>Latency:</strong> ${payload.latencyMs}ms\n`;
    }
    if (payload.provider) {
      html += `<strong>Provider:</strong> ${escapeHtml(payload.provider)}\n`;
    }
    if (payload.model) {
      html += `<strong>Model:</strong> ${escapeHtml(payload.model)}\n`;
    }
  } else if (eventType === 'error') {
    // Error event
    if (payload.scope) {
      html += `<strong>Scope:</strong> ${escapeHtml(payload.scope)}\n`;
    }
    if (payload.message) {
      html += `<strong>Message:</strong> ${escapeHtml(payload.message)}\n\n`;
    }
    if (payload.upstreamStatus !== null && payload.upstreamStatus !== undefined) {
      html += `<strong>Upstream Status:</strong> ${payload.upstreamStatus}\n`;
    }
    if (payload.upstreamBodyPreview) {
      html += `<strong>Upstream Body Preview:</strong>\n`;
      html += `${truncateForDisplay(payload.upstreamBodyPreview, 2000)}\n`;
    }
  } else if (eventType === 'new_input_added') {
    // New input event
    if (payload.inputType) {
      html += `<strong>Input Type:</strong> ${escapeHtml(payload.inputType)}\n`;
    }
    if (payload.inputText) {
      html += `<strong>Input Text:</strong>\n`;
      html += `${truncateForDisplay(payload.inputText, 5000)}\n`;
    }
    if (payload.sensitiveDetected) {
      html += `<strong>Sensitive Patterns Detected:</strong> ${payload.sensitiveDetected}\n`;
      if (payload.sensitiveCategories && payload.sensitiveCategories.length > 0) {
        html += `<strong>Categories:</strong> ${payload.sensitiveCategories.join(', ')}\n`;
      }
    }
  } else {
    // Generic payload (JSON stringify)
    html += JSON.stringify(payload, null, 2);
  }

  return html || '(No payload data)';
}

/**
 * Truncate text for display with indicator
 * @param {string} text - Text to truncate
 * @param {number} maxChars - Maximum characters to show
 * @returns {string} Truncated text with indicator if needed
 */
export function truncateForDisplay(text, maxChars = 1000) {
  if (!text) return '';
  
  if (text.length <= maxChars) {
    return escapeHtml(text);
  }

  const truncated = text.substring(0, maxChars);
  return escapeHtml(truncated) + `\n\n[... truncated: ${text.length - maxChars} more characters ...]`;
}

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  if (typeof text !== 'string') {
    text = String(text);
  }
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

