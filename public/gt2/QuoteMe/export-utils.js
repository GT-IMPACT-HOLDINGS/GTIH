// =============================================================
// QuoteMe v1 Export Utilities
// Functions for exporting QuoteMe data
// =============================================================

const STORAGE_KEY = 'quoteme.v1';

/**
 * Export all QuoteMe data from localStorage
 * @returns {string} JSON string of all QuoteMe data
 */
export function exportAllData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return JSON.stringify({
        schemaVersion: 1,
        profile: null,
        pa: null,
        opportunities: []
      }, null, 2);
    }

    // Parse and pretty-print
    const data = JSON.parse(raw);
    return JSON.stringify(data, null, 2);
  } catch (e) {
    console.error('[export] Failed to export data:', e);
    throw new Error('Failed to export data: ' + e.message);
  }
}

/**
 * Download JSON string as a file
 * @param {string} jsonString - JSON string to download
 * @param {string} filename - Filename for the download
 */
export function downloadJSON(jsonString, filename) {
  try {
    // Create blob
    const blob = new Blob([jsonString], { type: 'application/json' });
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('[export] Failed to download file:', e);
    alert('Failed to download export file: ' + e.message);
  }
}

