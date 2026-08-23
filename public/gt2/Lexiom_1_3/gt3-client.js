(function () {
  "use strict";

  const DEFAULT_INFERENCE_URI = "/inference";
  const API_KEY_STORAGE_KEY = "lexiom_gt3_api_key";
  const LEGACY_COCKPIT_TITLE_PROMPT =
    "You are Lexiom 1.3, naming a reasoning-making cockpit from the united outcome specifications of its OSN tree.";
  const UPDATED_COCKPIT_TITLE_PROMPT =
    "You are GT3, let your answer refer to the System Under Development (SUD) as a mean to assist our friend in maturing the SUD specifications for the purpose of maturing the SUD itself.";

  let gt3ApiKey = (function () {
    try {
      const fromUrl = new URLSearchParams(window.location.search).get("or_key");
      if (fromUrl && String(fromUrl).trim()) {
        const trimmed = String(fromUrl).trim();
        try {
          localStorage.setItem(API_KEY_STORAGE_KEY, trimmed);
        } catch {
          // ignore quota / private mode
        }
        return trimmed;
      }
      return localStorage.getItem(API_KEY_STORAGE_KEY) || "";
    } catch {
      return "";
    }
  })();

  function getApiKey() {
    try {
      return localStorage.getItem(API_KEY_STORAGE_KEY) || gt3ApiKey || "";
    } catch {
      return gt3ApiKey || "";
    }
  }

  function setApiKey(key) {
    try {
      if (key && String(key).trim()) {
        localStorage.setItem(API_KEY_STORAGE_KEY, String(key).trim());
        gt3ApiKey = String(key).trim();
      } else {
        localStorage.removeItem(API_KEY_STORAGE_KEY);
        gt3ApiKey = "";
      }
    } catch (e) {
      console.error("[lexiom13 gt3-client] Failed to save API key:", e);
    }
  }

  function getInferenceUri() {
    const urlParams = new URLSearchParams(window.location.search);
    const apiParam = urlParams.get("api");
    if (apiParam) {
      return apiParam;
    }
    return DEFAULT_INFERENCE_URI;
  }

  function buildInferenceHeaders() {
    const headers = {
      "Content-Type": "application/json",
      "X-GT3-Tenant": "gt2-lexiom-demo",
      "X-GT3-Data-Track": "green",
      "X-GT3-Consent-Version": "v1",
      "X-Lexiom-Persona-Mode": "lexiom_13_reasoning",
    };
    if (getApiKey()) {
      headers["X-GT3-OpenRouter-Key"] = getApiKey();
      headers["X-GT3-OpenAI-Key"] = getApiKey();
    }
    return headers;
  }

  function getLexiom13InferenceIntro() {
    return (
      "This request is sent to GT3 by Lexiom—a friend and assistant to the human who is using Lexiom. " +
      "Lexiom is helping that person specify, refine, and approve the specifications of a System Under Development (SUD). " +
      "Everything that follows in this message concerns that SUD: its Outcome Specification Nodes, draft sections, thematic lenses, " +
      "output specifications, success evidences, and related semantic material. " +
      "Lexiom does not speak as the human owner and does not treat model output as canonical truth. " +
      "Your role is to propose clear, editable drafts that the human can inspect, revise, and explicitly approve " +
      "before anything becomes part of the accountable specification record."
    );
  }

  function getPersonaHeaderLine() {
    return getLexiom13InferenceIntro();
  }

  function applyPersonaHeader(narrative) {
    const intro = getLexiom13InferenceIntro();
    const raw = String(narrative || "").trim();
    if (!raw) {
      return raw;
    }
    if (raw.indexOf("This request is sent to GT3 by Lexiom") === 0) {
      return raw;
    }
    return intro + "\n\n" + raw;
  }

  function normalizeLegacyPromptPhrases(narrative) {
    const raw = String(narrative || "");
    if (!raw) {
      return raw;
    }
    return raw.split(LEGACY_COCKPIT_TITLE_PROMPT).join(UPDATED_COCKPIT_TITLE_PROMPT);
  }

  function getInBandInstruction(inferenceType) {
    const formats = {
      L24:
        "Format: _L24_Draft_ followed by four words (underscore-separated) that capture what you draft in this inference, within the current OSN reasoning workspace.",
      L2_REFRESH:
        "Format: _L2_Refresh_ followed by four words (underscore-separated) that capture the refreshed lens-guided reasoning output.",
      L2_LINEAGE:
        "Format: _L2_Lineage_ followed by four words (underscore-separated) that capture the causal lineage explanation act.",
    };
    const fmt = formats[inferenceType] || formats.L24;
    return (
      "\n\nIMPORTANT: After your main response, add exactly one line containing the in_band_description_of_Lexioms_act. " +
      "The phrase MUST begin with an underscore (_).\n" +
      fmt +
      " RULES: Use ONLY underscores to separate words. No slashes, hyphens, spaces, or other characters. " +
      "Each word uses Latin/ASCII letters and digits only. Put it on its own line at the very end. No other text after it."
    );
  }

  async function callGT3(narrative, options) {
    const t0 = Date.now();
    const trimmed = narrative ? String(narrative).trim() : "";
    if (!trimmed) {
      return {
        ok: false,
        text: null,
        error: "Narrative must be non-empty",
        latencyMs: 0,
      };
    }

    const inferenceType = (options && options.inferenceType) || "L24";
    const fullNarrative = normalizeLegacyPromptPhrases(
      applyPersonaHeader(trimmed) + getInBandInstruction(inferenceType)
    );

    try {
      const response = await fetch(getInferenceUri(), {
        method: "POST",
        headers: buildInferenceHeaders(),
        body: JSON.stringify({ narrative: fullNarrative }),
      });
      const latencyMs = Date.now() - t0;

      if (!response.ok) {
        const errorText = await response.text();
        return {
          ok: false,
          text: null,
          error: "HTTP " + response.status + ": " + errorText,
          latencyMs,
        };
      }

      const data = await response.json();
      if (!data.response || typeof data.response !== "string") {
        return {
          ok: false,
          text: null,
          error: 'Malformed response: "response" field missing or not a string',
          latencyMs,
        };
      }

      return {
        ok: true,
        text: data.response,
        error: null,
        latencyMs,
      };
    } catch (error) {
      return {
        ok: false,
        text: null,
        error: "Network error: " + String(error),
        latencyMs: Date.now() - t0,
      };
    }
  }

  window.lexiomGT3 = {
    callGT3,
    getApiKey,
    setApiKey,
    getInferenceUri,
    buildInferenceHeaders,
    getLexiom13InferenceIntro,
    getPersonaHeaderLine,
  };
})();
