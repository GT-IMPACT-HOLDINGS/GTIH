// =============================================================
// QuoteMe v1 Loading State Utilities
// Loading indicators for async operations
// =============================================================

/**
 * Create a loading spinner element
 * @param {string} size - 'sm', 'md', 'lg' (default: 'sm')
 * @returns {HTMLElement} Spinner element
 */
function createSpinner(size = 'sm') {
  const spinner = document.createElement('div');
  spinner.className = `spinner-border spinner-border-${size} text-primary`;
  spinner.setAttribute('role', 'status');
  spinner.innerHTML = '<span class="visually-hidden">Loading...</span>';
  spinner.style.cssText = 'color: #2F6BFF !important;'; // QuoteMe primary color
  return spinner;
}

/**
 * Show loading state on a button
 * @param {HTMLElement} button - Button element
 * @param {string} loadingText - Text to show while loading (default: 'Loading...')
 */
function setButtonLoading(button, loadingText = 'Loading...') {
  if (!button) return;
  
  button.disabled = true;
  const originalText = button.textContent;
  button.dataset.originalText = originalText;
  button.innerHTML = `
    <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" style="color: #2F6BFF;"></span>
    ${loadingText}
  `;
}

/**
 * Remove loading state from a button
 * @param {HTMLElement} button - Button element
 */
function removeButtonLoading(button) {
  if (!button) return;
  
  button.disabled = false;
  const originalText = button.dataset.originalText || button.textContent;
  button.textContent = originalText;
  delete button.dataset.originalText;
}

/**
 * Show loading overlay on an element
 * @param {HTMLElement} container - Container element
 * @param {string} message - Loading message (optional)
 */
function showLoadingOverlay(container, message = 'Loading...') {
  if (!container) return null;
  
  // Remove existing overlay if present
  const existing = container.querySelector('.loading-overlay');
  if (existing) existing.remove();
  
  const overlay = document.createElement('div');
  overlay.className = 'loading-overlay';
  overlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    flex-direction: column;
    gap: 1rem;
  `;
  
  const spinner = createSpinner('md');
  overlay.appendChild(spinner);
  
  if (message) {
    const messageEl = document.createElement('div');
    messageEl.textContent = message;
    messageEl.style.cssText = 'color: #2F6BFF; font-weight: 500;';
    overlay.appendChild(messageEl);
  }
  
  // Ensure container has relative positioning
  const containerPosition = window.getComputedStyle(container).position;
  if (containerPosition === 'static') {
    container.style.position = 'relative';
  }
  
  container.appendChild(overlay);
  return overlay;
}

/**
 * Remove loading overlay from an element
 * @param {HTMLElement} container - Container element
 */
function removeLoadingOverlay(container) {
  if (!container) return;
  
  const overlay = container.querySelector('.loading-overlay');
  if (overlay) {
    overlay.remove();
  }
}

/**
 * Show inline loading indicator in a draft field header
 * @param {HTMLElement} headerRow - Header row element
 * @param {string} message - Loading message (optional)
 */
function showHeaderLoading(headerRow, message = '') {
  if (!headerRow) return null;
  
  // Remove existing loading indicator
  const existing = headerRow.querySelector('.header-loading-indicator');
  if (existing) existing.remove();
  
  const indicator = document.createElement('span');
  indicator.className = 'header-loading-indicator';
  indicator.style.cssText = 'margin-left: 0.5rem;';
  
  const spinner = createSpinner('sm');
  indicator.appendChild(spinner);
  
  if (message) {
    const text = document.createElement('span');
    text.textContent = message;
    text.style.cssText = 'margin-left: 0.5rem; color: #2F6BFF; font-size: 0.875rem;';
    indicator.appendChild(text);
  }
  
  headerRow.appendChild(indicator);
  return indicator;
}

/**
 * Remove inline loading indicator from header
 * @param {HTMLElement} headerRow - Header row element
 */
function removeHeaderLoading(headerRow) {
  if (!headerRow) return;
  
  const indicator = headerRow.querySelector('.header-loading-indicator');
  if (indicator) {
    indicator.remove();
  }
}

export {
  createSpinner,
  setButtonLoading,
  removeButtonLoading,
  showLoadingOverlay,
  removeLoadingOverlay,
  showHeaderLoading,
  removeHeaderLoading
};

