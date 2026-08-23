// =============================================================
// QuoteMe v1 Toast Notification Utilities
// Generic user-facing error/success notifications
// =============================================================

/**
 * Show a toast notification to the user
 * @param {string} message - The message to display
 * @param {string} type - 'success', 'error', 'warning', 'info' (default: 'info')
 * @param {number} duration - Duration in milliseconds (default: 5000, 0 = persistent)
 */
function showToast(message, type = 'info', duration = 5000) {
  // Create toast container if it doesn't exist
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      max-width: 400px;
      pointer-events: none;
    `;
    document.body.appendChild(toastContainer);
  }

  // Create toast element
  const toast = document.createElement('div');
  toast.className = `alert alert-${type === 'error' ? 'danger' : type === 'success' ? 'success' : type === 'warning' ? 'warning' : 'info'} alert-dismissible fade show`;
  toast.style.cssText = `
    margin-bottom: 10px;
    pointer-events: auto;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  `;
  
  toast.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;

  toastContainer.appendChild(toast);

  // Auto-dismiss after duration (if duration > 0)
  if (duration > 0) {
    setTimeout(() => {
      if (toast.parentNode) {
        toast.classList.remove('show');
        setTimeout(() => {
          if (toast.parentNode) {
            toast.remove();
          }
        }, 150); // Bootstrap fade duration
      }
    }, duration);
  }

  return toast;
}

/**
 * Show a generic error toast for user-facing errors
 * @param {string} message - Error message (user-friendly)
 */
function showErrorToast(message) {
  return showToast(message, 'error', 7000);
}

/**
 * Show a success toast
 * @param {string} message - Success message
 */
function showSuccessToast(message) {
  return showToast(message, 'success', 4000);
}

/**
 * Show a warning toast
 * @param {string} message - Warning message
 */
function showWarningToast(message) {
  return showToast(message, 'warning', 5000);
}

/**
 * Show an info toast
 * @param {string} message - Info message
 */
function showInfoToast(message) {
  return showToast(message, 'info', 4000);
}

export { showToast, showErrorToast, showSuccessToast, showWarningToast, showInfoToast };

