// =============================================================
// GT2 Draft-First Field Component
// Reusable component for inline-editable GT3 outputs with glyph-based approval
// Complies with GT2_DraftFirst_MicroUX_Spec.md
// Version: 1.8.1 (Single textarea expansion - fixed duplication)
// Last updated: 2024-12-19
// =============================================================

/**
 * Create action button for header row (per DraftFirst v1.1 Section 6)
 * Must be defined before createDraftField since it's used during component creation
 */
function createActionButton(container, actionType, tooltip, onClick, workingState, readOnly) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-outline-secondary btn-sm';
  btn.style.cssText = 'width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center;';
  btn.setAttribute('title', tooltip);
  btn.setAttribute('aria-label', tooltip);
  btn.disabled = readOnly || workingState === 'working';
  
  // Set icon based on action type
  let icon = '';
  switch (actionType) {
    case 'upload':
      icon = '📄'; // Document icon (can be replaced with SVG/Lucide icon later)
      break;
    case 'regenerate':
      icon = '🔄'; // Refresh icon
      break;
    case 'retry':
      icon = '↻'; // Retry icon
      break;
    default:
      icon = '⚡';
  }
  
  // Working state: show spinner
  if (workingState === 'working') {
    btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
    btn.setAttribute('aria-label', 'Generating...');
  } else {
    btn.textContent = icon;
  }
  
  // Click handler
  if (actionType === 'upload') {
    // Upload needs file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.txt,.docx';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (file && onClick) {
        await onClick(file);
      }
      fileInput.value = ''; // Reset for re-selection
    });
    document.body.appendChild(fileInput);
    
    btn.addEventListener('click', () => {
      if (!readOnly && workingState !== 'working') {
        fileInput.click();
      }
    });
    
    container._fileInput = fileInput;
  } else {
    btn.addEventListener('click', async () => {
      if (!readOnly && workingState !== 'working' && onClick) {
        await onClick();
      }
    });
  }
  
  return btn;
}

/**
 * Creates a draft-first field component (inline editable textarea with glyph approval)
 * Complies with GT2_DraftFirst_MicroUX_Spec.md v1.1 (header row actions)
 * 
 * @param {Object} config
 * @param {string} config.label - Field label (e.g., "Proposal Anatomy (PA)")
 * @param {string} config.text - Current text value
 * @param {boolean} [config.approved] - Whether field is approved (for explicit-approval fields)
 * @param {boolean} [config.hasLmDraft] - Whether content originated from GT3/LM
 * @param {boolean} [config.hasUserEdits] - Whether user has edited since last LM fill
 * @param {boolean} [config.readOnly] - Whether field is read-only (lifecycle lock)
 * @param {Function} [config.onTextChange] - Callback: (newText, userHasEdited) => void
 * @param {Function} [config.onApproveToggle] - Callback: (isApproved) => void (for explicit-approval fields)
 * @param {Function} [config.onRegenerate] - Callback: () => void (optional)
 * @param {Function} [config.onUpload] - Callback: (file) => Promise<void> (optional, for upload action)
 * @param {Function} [config.onRetry] - Callback: () => Promise<void> (optional, for retry action)
 * @param {string} [config.placeholder] - Textarea placeholder
 * @param {string} [config.containerId] - ID for container element (auto-generated if not provided)
 * @param {string} [config.workingState] - 'idle' | 'working' | 'error' (for action button states)
 * @param {string} [config.errorPreview] - Error message preview (when workingState === 'error')
 * 
 * @returns {HTMLElement} Container element with the draft field
 */
export function createDraftField(config) {
  const {
    label,
    text = '',
    approved = false,
    hasLmDraft = false,
    hasUserEdits = false,
    readOnly = false,
    onTextChange = null,
    onApproveToggle = null,
    onRegenerate = null,
    onUpload = null,
    onRetry = null,
    placeholder = '',
    containerId = `draft-field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    workingState = 'idle', // 'idle' | 'working' | 'error'
    errorPreview = null
  } = config;

  // Determine glyph state (per spec Section 5)
  const glyphState = computeGlyphState(text, approved, hasLmDraft, hasUserEdits);
  
  // Create container
  const container = document.createElement('div');
  container.id = containerId;
  container.className = 'draft-field-container mb-4';

  // Create header row (per DraftFirst v1.1: Glyph + Label + Actions)
  // Order: Glyph (leftmost for LTR) → Label (2 spaces gap) → Actions (far right)
  const labelRow = document.createElement('div');
  labelRow.className = 'd-flex align-items-center justify-content-between mb-2';
  
  // Left side: Glyph + Label (with 2 spaces gap)
  const leftSide = document.createElement('div');
  leftSide.className = 'd-flex align-items-center';
  leftSide.style.gap = '0.5rem'; // 2 spaces = ~0.5rem (8px)
  
  // Create glyph element (leftmost for LTR)
  // Always create glyph element to reserve space, even when empty (for fixed label position)
  const glyphEl = createGlyphElement(glyphState, approved, onApproveToggle, readOnly);
  // Always append glyph element (now always returns element, even if placeholder)
  leftSide.appendChild(glyphEl);
  
  // Label (2 spaces after glyph)
  const labelEl = document.createElement('label');
  labelEl.className = 'form-label mb-0 fw-semibold';
  labelEl.textContent = label;
  leftSide.appendChild(labelEl);
  
  labelRow.appendChild(leftSide);
  
  // Store reference to leftSide for glyph updates
  container._leftSide = leftSide;
  
  // Right cluster: Action buttons (per DraftFirst v1.1 Section 6)
  const rightCluster = document.createElement('div');
  rightCluster.className = 'd-flex align-items-center gap-1';
  
  // Upload action (if provided)
  if (onUpload) {
    const uploadBtn = createActionButton(container, 'upload', 'Upload to generate Status', onUpload, workingState, readOnly);
    rightCluster.appendChild(uploadBtn);
    container._uploadBtn = uploadBtn;
  }
  
  // Retry action (if provided and in error state)
  if (onRetry && workingState === 'error') {
    const retryBtn = createActionButton(container, 'retry', 'Retry generation', onRetry, workingState, readOnly);
    rightCluster.appendChild(retryBtn);
    container._retryBtn = retryBtn;
  }
  
  // Regenerate action (if provided and not in error state)
  if (onRegenerate && workingState !== 'error') {
    const regenerateBtn = createActionButton(container, 'regenerate', 'Regenerate draft', onRegenerate, workingState, readOnly);
    rightCluster.appendChild(regenerateBtn);
    container._regenerateBtn = regenerateBtn;
  }
  
  labelRow.appendChild(rightCluster);
  container.appendChild(labelRow);

  // Create expandable textarea wrapper (per Textarea Expansion Spec v1.8)
  // Single textarea approach: one textarea that moves between collapsed/expanded containers
  const textareaWrapper = document.createElement('div');
  textareaWrapper.className = 'draft-field-textarea-wrapper';
  
  // Create collapse container for expanded state
  const collapseId = `draft-field-collapse-${containerId}`;
  const collapseContainer = document.createElement('div');
  collapseContainer.className = 'collapse';
  collapseContainer.id = collapseId;
  
  // Create expanded height wrapper (inside collapse container)
  const expandedHeightWrapper = document.createElement('div');
  expandedHeightWrapper.className = 'draft-field-expanded-wrapper';
  expandedHeightWrapper.style.minHeight = '300px';
  expandedHeightWrapper.style.maxHeight = '600px';
  collapseContainer.appendChild(expandedHeightWrapper);
  
  // Create SINGLE textarea (will move between containers)
  const textarea = document.createElement('textarea');
  textarea.className = 'form-control draft-field-textarea';
  textarea.value = text;
  textarea.placeholder = placeholder;
  textarea.disabled = readOnly;
  textarea.rows = 4; // Compact default (per spec Section 3.1)
  textarea.style.fontSize = '0.95rem';
  textarea.style.lineHeight = '1.5';
  textarea.style.resize = 'none'; // Disable manual resize handles (per spec Section 3.1)
  textarea.style.overflowY = 'auto';
  
  // Store original rows for restoration
  const originalRows = 4;
  
  // Create collapse control button (chevron)
  const createCollapseControl = (position) => {
    const control = document.createElement('button');
    control.type = 'button';
    control.className = 'btn btn-sm btn-outline-secondary draft-field-collapse-control';
    control.setAttribute('data-bs-toggle', 'collapse');
    control.setAttribute('data-bs-target', `#${collapseId}`);
    control.setAttribute('aria-expanded', 'false');
    control.setAttribute('aria-controls', collapseId);
    control.style.cssText = 'width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center;';
    control.setAttribute('title', 'Expand textarea');
    control.setAttribute('aria-label', 'Expand textarea');
    
    // Chevron down icon (for expand)
    control.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/></svg>';
    
    // Store position for scroll position invariance
    control._position = position;
    
    return control;
  };
  
  // Top collapse control (in header row, next to action buttons)
  const topCollapseControl = createCollapseControl('top');
  rightCluster.appendChild(topCollapseControl);
  
  // Bottom collapse control (below textarea, only visible when expanded)
  const bottomCollapseControl = createCollapseControl('bottom');
  bottomCollapseControl.style.display = 'none'; // Hidden by default
  bottomCollapseControl.style.marginTop = '0.5rem';
  bottomCollapseControl.style.width = '100%';
  bottomCollapseControl.style.justifyContent = 'center';
  
  // Add bottom control wrapper
  const bottomControlWrapper = document.createElement('div');
  bottomControlWrapper.className = 'draft-field-bottom-control-wrapper';
  bottomControlWrapper.style.display = 'none';
  bottomControlWrapper.appendChild(bottomCollapseControl);
  
  // Track scroll position for invariance (per spec Section 3.5)
  let scrollPositionBeforeCollapse = 0;
  let isExpanded = false;
  let savedScrollTop = 0;
  
  // Initialize Bootstrap collapse
  let collapseInstance = null;
  
  // Setup collapse event listeners (after DOM insertion)
  const setupCollapseListeners = () => {
    if (typeof bootstrap === 'undefined') {
      console.warn('[draft-field] Bootstrap not available, collapse functionality disabled');
      return;
    }
    
    collapseInstance = new bootstrap.Collapse(collapseContainer, {
      toggle: false
    });
    
    // Store collapse instance in container
    container._collapseInstance = collapseInstance;
    
    // Listen for collapse events
    collapseContainer.addEventListener('show.bs.collapse', () => {
      isExpanded = true;
      
      // Save current scroll position from collapsed state
      savedScrollTop = textarea.scrollTop;
      const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 20;
      const visibleLineIndex = Math.floor(savedScrollTop / lineHeight);
      
      // Calculate expanded height based on content
      const expandedHeight = Math.max(300, Math.min(600, textarea.scrollHeight + 20));
      expandedHeightWrapper.style.height = `${expandedHeight}px`;
      
      // CRITICAL: Move textarea into expanded wrapper SYNCHRONOUSLY before animation
      // appendChild automatically removes from previous parent, preventing duplication
      // Ensure textarea is ONLY in expandedHeightWrapper (not in both places)
      const currentParent = textarea.parentNode;
      if (currentParent !== expandedHeightWrapper) {
        // Remove from any current parent first (safety check)
        if (currentParent) {
          currentParent.removeChild(textarea);
        }
        // Then add to expanded wrapper
        expandedHeightWrapper.appendChild(textarea);
      }
      textarea.style.height = '100%';
      textarea.style.minHeight = '300px';
      textarea.style.maxHeight = '600px';
      textarea.rows = 0; // Remove rows constraint when expanded
      
      // Show bottom control
      bottomControlWrapper.style.display = 'block';
      
      // Update controls (chevron up for collapse)
      topCollapseControl.setAttribute('aria-expanded', 'true');
      topCollapseControl.setAttribute('title', 'Collapse textarea');
      topCollapseControl.setAttribute('aria-label', 'Collapse textarea');
      topCollapseControl.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M7.646 4.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1-.708.708L8 5.707l-5.646 5.647a.5.5 0 0 1-.708-.708l6-6z"/></svg>';
      
      bottomCollapseControl.setAttribute('aria-expanded', 'true');
      bottomCollapseControl.setAttribute('title', 'Collapse textarea');
      bottomCollapseControl.setAttribute('aria-label', 'Collapse textarea');
      bottomCollapseControl.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M7.646 4.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1-.708.708L8 5.707l-5.646 5.647a.5.5 0 0 1-.708-.708l6-6z"/></svg>';
      
      // Restore scroll position after expansion animation to maintain visible text location
      setTimeout(() => {
        textarea.focus();
        // Restore to the same visible line (scroll position invariance)
        textarea.scrollTop = visibleLineIndex * lineHeight;
      }, 350); // Wait for Bootstrap collapse animation (~300ms)
    });
    
    collapseContainer.addEventListener('hide.bs.collapse', () => {
      // Save scroll position before collapse (per spec Section 3.5)
      // This is critical: the visible text location must not change
      scrollPositionBeforeCollapse = textarea.scrollTop;
      const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 20;
      const visibleLineIndex = Math.floor(scrollPositionBeforeCollapse / lineHeight);
      
      // Move textarea back to wrapper IMMEDIATELY (before collapse animation)
      // This ensures no duplication during the transition
      // Ensure textarea is ONLY in textareaWrapper (not in both places)
      const currentParent = textarea.parentNode;
      if (currentParent !== textareaWrapper) {
        // Remove from any current parent first (safety check)
        if (currentParent) {
          currentParent.removeChild(textarea);
        }
        // Then add to wrapper before collapse container
        textareaWrapper.insertBefore(textarea, collapseContainer);
      }
      textarea.style.height = '';
      textarea.style.minHeight = '';
      textarea.style.maxHeight = '';
      textarea.rows = originalRows;
      
      // Hide bottom control
      bottomControlWrapper.style.display = 'none';
      
      // Update controls
      topCollapseControl.setAttribute('aria-expanded', 'false');
      topCollapseControl.setAttribute('title', 'Expand textarea');
      topCollapseControl.setAttribute('aria-label', 'Expand textarea');
      topCollapseControl.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/></svg>';
      
      bottomCollapseControl.setAttribute('aria-expanded', 'false');
      
      isExpanded = false;
      
      // Restore focus and scroll position to maintain visible text location (scroll position invariance)
      // The line the user was viewing must remain visible after collapse
      setTimeout(() => {
        textarea.focus();
        // Calculate the scroll position for the same visible line in collapsed state
        const collapsedLineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 20;
        // Ensure the same line is visible (critical requirement per spec Section 3.5)
        textarea.scrollTop = Math.max(0, visibleLineIndex * collapsedLineHeight);
      }, 100);
    });
    
    // Handle reduced motion preference (per spec Section 4)
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      collapseContainer.style.transition = 'none';
    }
  };
  
  // Track original text for edit detection
  let originalText = text;
  let isApproved = approved;
  let currentHasLmDraft = hasLmDraft;
  let currentHasUserEdits = hasUserEdits;
  
  // Shared text change handler (single textarea approach)
  const handleTextChange = () => {
    const newText = textarea.value;
    
    const userHasEdited = newText !== originalText;
    const hasText = newText.trim().length > 0;
    
    // Auto-revoke approval on edit (per spec Section 6.3)
    if (isApproved && userHasEdited) {
      isApproved = false;
      if (onApproveToggle) {
        onApproveToggle(false);
      }
    }
    
    // Update glyph state based on content and authorship
    if (hasText) {
      if (userHasEdited && currentHasLmDraft && !currentHasUserEdits) {
        // User edited LM draft → show LM+User (◉)
        currentHasUserEdits = true;
        updateGlyph(container, newText, isApproved, currentHasLmDraft, true);
      } else if (!currentHasLmDraft) {
        // User-only content (no LM draft) → show user-only (●)
        currentHasLmDraft = false;
        currentHasUserEdits = false;
        updateGlyph(container, newText, isApproved, false, false);
      } else if (userHasEdited && currentHasLmDraft) {
        // User edited LM draft but we already have hasUserEdits set
        updateGlyph(container, newText, isApproved, currentHasLmDraft, currentHasUserEdits);
      } else {
        // Text exists but no changes detected
        updateGlyph(container, newText, isApproved, currentHasLmDraft, currentHasUserEdits);
      }
    } else {
      // Text is empty → no glyph
      currentHasLmDraft = false;
      currentHasUserEdits = false;
      updateGlyph(container, '', false, false, false);
    }
    
    if (onTextChange) {
      onTextChange(newText, userHasEdited);
    }
  };
  
  // Text change handler for single textarea
  textarea.addEventListener('input', handleTextChange);
  
  // Add textarea to wrapper (initially in collapsed state)
  textareaWrapper.appendChild(textarea);
  textareaWrapper.appendChild(collapseContainer);
  textareaWrapper.appendChild(bottomControlWrapper);
  
  // Append textarea wrapper to container
  container.appendChild(textareaWrapper);
  
  // Setup collapse listeners after DOM insertion
  setTimeout(() => {
    setupCollapseListeners();
  }, 0);
  
  // Note: Action buttons are now in the header row (per DraftFirst v1.1)

  // Store references and state for updates
  container._textarea = textarea;
  container._collapseInstance = null; // Will be set in setupCollapseListeners
  container._onApproveToggle = onApproveToggle;
  container._readOnly = readOnly;
  container._originalText = originalText;
  container._isApproved = isApproved;
  container._hasLmDraft = hasLmDraft;
  container._hasUserEdits = hasUserEdits;
  
  // Expose internal state for updates
  container._currentHasLmDraft = currentHasLmDraft;
  container._currentHasUserEdits = currentHasUserEdits;
  
  container._updateGlyph = (newText, newApproved, newHasLmDraft, newHasUserEdits) => {
    updateGlyph(container, newText, newApproved, newHasLmDraft, newHasUserEdits);
    originalText = newText;
    isApproved = newApproved;
    currentHasLmDraft = newHasLmDraft;
    currentHasUserEdits = newHasUserEdits;
    container._originalText = newText;
    container._isApproved = newApproved;
    container._hasLmDraft = newHasLmDraft;
    container._hasUserEdits = newHasUserEdits;
    container._currentHasLmDraft = newHasLmDraft;
    container._currentHasUserEdits = newHasUserEdits;
  };

  return container;
}

/**
 * Compute glyph state per GT2_DraftFirst_MicroUX_Spec.md Section 5
 */
function computeGlyphState(text, approved, hasLmDraft, hasUserEdits) {
  if (!text || text.trim() === '') {
    return 'empty';
  }
  if (approved) {
    return 'approved';
  }
  if (hasLmDraft && hasUserEdits) {
    return 'lm-user';
  }
  if (hasLmDraft) {
    return 'lm-only';
  }
  return 'user-only';
}

/**
 * Create empty glyph placeholder (invisible, reserves space for fixed label position)
 */
function createEmptyGlyphPlaceholder() {
  const placeholder = document.createElement('span');
  placeholder.className = 'draft-field-glyph draft-field-glyph-empty';
  placeholder.style.cssText = 'width: 20px; height: 20px; display: inline-block; visibility: hidden;';
  placeholder.setAttribute('aria-hidden', 'true');
  return placeholder;
}

/**
 * Create glyph element with tooltip and click handler
 */
function createGlyphElement(glyphState, approved, onApproveToggle, readOnly) {
  if (glyphState === 'empty') {
    // Return placeholder instead of null to maintain fixed label position
    return createEmptyGlyphPlaceholder();
  }

  const glyphEl = document.createElement('span');
  glyphEl.className = 'draft-field-glyph';
  glyphEl.style.cssText = 'cursor: pointer; font-size: 16px; line-height: 1; display: inline-block; width: 20px; height: 20px; text-align: center; vertical-align: middle; position: relative;';
  glyphEl.setAttribute('role', 'button');
  glyphEl.setAttribute('tabindex', '0');
  
  // Set glyph symbol
  if (glyphState === 'approved') {
    // For approved, render ring and check separately for better visual (per spec: ring + check)
    glyphEl.innerHTML = '<span style="position: absolute; left: 0; top: 0; width: 100%; height: 100%; line-height: 20px;">◯</span><span style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font-size: 11px; line-height: 1;">✓</span>';
  } else {
    const symbol = getGlyphSymbol(glyphState);
    glyphEl.textContent = symbol;
  }
  
  // Set tooltip and aria-label (per spec Section 6.2)
  if (onApproveToggle && !readOnly) {
    const tooltipText = approved 
      ? 'Approved — click to unapprove'
      : 'Click to approve';
    glyphEl.setAttribute('title', tooltipText);
    glyphEl.setAttribute('aria-label', tooltipText);
    
    // Click handler for approval toggle
    const handleToggle = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const newApproved = !approved;
      
      // Immediate visual feedback: update glyph state before executing callback
      // This provides instant feedback even if callback triggers async operations
      const container = glyphEl.closest('.draft-field-container');
      if (container) {
        // Get current text and authorship state from container
        const currentText = container._textarea?.value || '';
        const currentHasLmDraft = container._hasLmDraft || false;
        const currentHasUserEdits = container._hasUserEdits || false;
        
        // Immediately update glyph to show new approval state
        updateGlyph(container, currentText, newApproved, currentHasLmDraft, currentHasUserEdits);
        
        // Update internal state
        container._isApproved = newApproved;
      }
      
      // Execute callback (may be async, e.g., triggers inference call)
      if (onApproveToggle) {
        try {
          await onApproveToggle(newApproved);
        } catch (err) {
          // If callback fails, revert glyph to previous state
          console.error('[Glyph approval] Callback failed:', err);
          if (container) {
            const currentText = container._textarea?.value || '';
            const currentHasLmDraft = container._hasLmDraft || false;
            const currentHasUserEdits = container._hasUserEdits || false;
            updateGlyph(container, currentText, !newApproved, currentHasLmDraft, currentHasUserEdits);
            container._isApproved = !newApproved;
          }
        }
      }
    };
    
    glyphEl.addEventListener('click', handleToggle);
    glyphEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        handleToggle(e);
      }
    });
    
    // Hover style
    glyphEl.style.opacity = '0.7';
    glyphEl.addEventListener('mouseenter', () => {
      glyphEl.style.opacity = '1';
    });
    glyphEl.addEventListener('mouseleave', () => {
      glyphEl.style.opacity = '0.7';
    });
  } else {
    // Read-only or implicit approval field - no toggle
    glyphEl.style.cursor = 'default';
    glyphEl.style.opacity = '0.6';
  }
  
  return glyphEl;
}


/**
 * Get glyph symbol for state
 */
function getGlyphSymbol(glyphState) {
  switch (glyphState) {
    case 'user-only':
      return '●'; // filled dot
    case 'lm-only':
      return '◯'; // hollow ring
    case 'lm-user':
      return '◉'; // filled dot inside hollow ring
    case 'approved':
      return '◯✓'; // ring + check (per spec: ring with check inside)
    default:
      return '';
  }
}

/**
 * Update glyph in container
 */
function updateGlyph(container, text, approved, hasLmDraft, hasUserEdits) {
  // Use stored reference to left side container (more reliable than querySelector)
  const leftSide = container._leftSide;
  if (!leftSide) {
    // Fallback: try to find it (for backward compatibility)
    const found = container.querySelector('.d-flex.align-items-center:not(.justify-content-between)');
    if (found) {
      container._leftSide = found;
      return updateGlyph(container, text, approved, hasLmDraft, hasUserEdits);
    }
    return;
  }
  
  // Remove old glyph
  const oldGlyph = container.querySelector('.draft-field-glyph');
  if (oldGlyph) {
    oldGlyph.remove();
  }
  
  // Compute new state
  const glyphState = computeGlyphState(text, approved, hasLmDraft, hasUserEdits);
  
  // Create new glyph with stored callbacks (always returns element, even if placeholder)
  const glyphEl = createGlyphElement(
    glyphState, 
    approved, 
    container._onApproveToggle || null,
    container._readOnly || false
  );
  
  // Always insert glyph (even if placeholder) to maintain fixed label position
  const label = leftSide.querySelector('label');
  if (label) {
    // Insert glyph before label (leftmost position)
    leftSide.insertBefore(glyphEl, label);
  } else {
    // If no label, append glyph (shouldn't happen, but safe fallback)
    leftSide.insertBefore(glyphEl, leftSide.firstChild);
  }
}

/**
 * Update action button working state (for external updates)
 */
export function updateDraftFieldActions(container, workingState, errorPreview = null) {
  if (!container) return;
  
  // Update upload button
  if (container._uploadBtn) {
    container._uploadBtn.disabled = workingState === 'working' || container._readOnly;
    if (workingState === 'working') {
      container._uploadBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
      container._uploadBtn.setAttribute('aria-label', 'Generating...');
    } else if (workingState === 'error') {
      container._uploadBtn.textContent = '↻'; // Retry icon
      container._uploadBtn.setAttribute('aria-label', 'Retry generation');
    } else {
      container._uploadBtn.textContent = '📄';
      container._uploadBtn.setAttribute('aria-label', 'Upload to generate Status');
    }
  }
  
  // Update retry button visibility
  if (container._retryBtn) {
    container._retryBtn.style.display = workingState === 'error' ? '' : 'none';
    if (workingState === 'error') {
      container._retryBtn.disabled = workingState === 'working' || container._readOnly;
    }
  }
  
  // Update regenerate button
  if (container._regenerateBtn) {
    if (workingState === 'error') {
      container._regenerateBtn.style.display = 'none';
    } else {
      container._regenerateBtn.style.display = '';
      container._regenerateBtn.disabled = workingState === 'working' || container._readOnly;
      if (workingState === 'working') {
        container._regenerateBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
        container._regenerateBtn.setAttribute('aria-label', 'Generating...');
      } else {
        container._regenerateBtn.textContent = '🔄';
        container._regenerateBtn.setAttribute('aria-label', 'Regenerate draft');
      }
    }
  }
}

export function updateDraftField(container, updates) {
  if (!container || !container._textarea) {
    console.warn('[draft-field] Container not found or invalid');
    return;
  }
  
  const {
    text,
    approved,
    hasLmDraft,
    hasUserEdits
  } = updates;
  
  if (text !== undefined) {
    container._textarea.value = text;
    // Sync to expanded textarea if it exists
    const expandedTextarea = container.querySelector('.draft-field-textarea-expanded');
    if (expandedTextarea) {
      expandedTextarea.value = text;
    }
  }
  
  // Update internal state before calling _updateGlyph
  const newText = text !== undefined ? text : container._textarea.value;
  const newApproved = approved !== undefined ? approved : container._isApproved;
  const newHasLmDraft = hasLmDraft !== undefined ? hasLmDraft : container._hasLmDraft;
  const newHasUserEdits = hasUserEdits !== undefined ? hasUserEdits : container._hasUserEdits;
  
  if (container._updateGlyph) {
    container._updateGlyph(newText, newApproved, newHasLmDraft, newHasUserEdits);
  }
  
  // Store state
  if (text !== undefined) container._originalText = text;
  if (approved !== undefined) container._isApproved = approved;
  if (hasLmDraft !== undefined) container._hasLmDraft = hasLmDraft;
  if (hasUserEdits !== undefined) {
    container._hasUserEdits = hasUserEdits;
    container._currentHasUserEdits = hasUserEdits;
  }
}
