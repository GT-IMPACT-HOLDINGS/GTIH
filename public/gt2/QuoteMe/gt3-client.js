// =============================================================
// QuoteMe v1 GT3 Client Module
// Wrapper for GT3 inference endpoint calls
// =============================================================

// Default to relative URL (works when QuoteMe and GT3 are on same origin)
// Falls back to localhost for local development if needed
const DEFAULT_INFERENCE_URI = '/inference';
const API_KEY_STORAGE_KEY = 'quoteme_gt3_api_key';

// Load API key from localStorage
let gt3ApiKey = (() => {
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY) || '';
  } catch {
    return '';
  }
})();

// Get inference URI from URL params or use default
// If 'api' param is provided, it can be absolute (e.g., http://localhost:8080/inference) or relative (/inference)
// If not provided, defaults to relative URL which works on same origin (EB deployment)
function getInferenceUri() {
  const urlParams = new URLSearchParams(window.location.search);
  const apiParam = urlParams.get('api');
  
  if (apiParam) {
    // If absolute URL provided, use it; if relative, it will be resolved by fetch()
    return apiParam;
  }
  
  // Default: relative URL (works when QuoteMe and GT3 are on same server)
  return DEFAULT_INFERENCE_URI;
}

// API key getter/setter
function getApiKey() {
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function setApiKey(key) {
  try {
    if (key && key.trim()) {
      localStorage.setItem(API_KEY_STORAGE_KEY, key.trim());
      gt3ApiKey = key.trim();
    } else {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
      gt3ApiKey = '';
    }
  } catch (e) {
    console.error('[gt3-client] Failed to save API key:', e);
  }
}

// Build inference headers (source of truth for metadata per GTL3 confirmation)
function buildInferenceHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    'X-GT3-Tenant': 'gt2-quoteme-dev',
    'X-GT3-Data-Track': 'green',
    'X-GT3-Consent-Version': 'v1'
  };

  // Add API key headers if present (per Legato pattern)
  if (gt3ApiKey) {
    // Send the same key in both headers
    // GT3 will use the relevant one per provider and ignore the rest
    headers['X-GT3-OpenRouter-Key'] = gt3ApiKey;
    headers['X-GT3-OpenAI-Key'] = gt3ApiKey;
  }
  
  return headers;
}

/**
 * Call GT3 inference endpoint
 * @param {string} narrative - The narrative string to send
 * @returns {Promise<{ok: boolean, text: string | null, error: string | null, latencyMs: number}>}
 */
async function callGT3(narrative) {
  const t0 = Date.now();
  
  if (!narrative || !narrative.trim()) {
    return {
      ok: false,
      text: null,
      error: 'Narrative must be non-empty',
      latencyMs: 0
    };
  }

  const uri = getInferenceUri();
  const headers = buildInferenceHeaders();
  
  // Request body: { narrative } only (per GTL3 confirmation)
  const body = JSON.stringify({ narrative: narrative.trim() });

  try {
    const response = await fetch(uri, {
      method: 'POST',
      headers,
      body
    });

    const latencyMs = Date.now() - t0;

    if (!response.ok) {
      const errorText = await response.text();
      return {
        ok: false,
        text: null,
        error: `HTTP ${response.status}: ${errorText}`,
        latencyMs
      };
    }

    const data = await response.json();
    
    // Response format: { response: string } (per Legato pattern)
    if (!data.response || typeof data.response !== 'string') {
      return {
        ok: false,
        text: null,
        error: 'Malformed response: "response" field missing or not a string',
        latencyMs
      };
    }

    return {
      ok: true,
      text: data.response,
      error: null,
      latencyMs
    };
  } catch (e) {
    const latencyMs = Date.now() - t0;
    return {
      ok: false,
      text: null,
      error: `Network error: ${String(e)}`,
      latencyMs
    };
  }
}

export { callGT3, getInferenceUri, getApiKey, setApiKey };
