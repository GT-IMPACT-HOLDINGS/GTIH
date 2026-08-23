// =============================================================
// QuoteMe v1 Network Utilities
// Network error detection and offline handling
// =============================================================

/**
 * Check if the browser is online
 * @returns {boolean} True if online, false if offline
 */
function isOnline() {
  return navigator.onLine !== false;
}

/**
 * Check if an error is a network error
 * @param {Error|string} error - Error object or error message
 * @returns {boolean} True if network error
 */
function isNetworkError(error) {
  const errorMsg = String(error).toLowerCase();
  return (
    errorMsg.includes('network') ||
    errorMsg.includes('fetch') ||
    errorMsg.includes('failed to fetch') ||
    errorMsg.includes('networkerror') ||
    errorMsg.includes('timeout') ||
    errorMsg.includes('connection')
  );
}

/**
 * Setup online/offline event listeners
 * @param {Function} onOnline - Callback when coming online
 * @param {Function} onOffline - Callback when going offline
 */
function setupNetworkListeners(onOnline, onOffline) {
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      if (onOnline) onOnline();
    });
    
    window.addEventListener('offline', () => {
      if (onOffline) onOffline();
    });
  }
}

export { isOnline, isNetworkError, setupNetworkListeners };

