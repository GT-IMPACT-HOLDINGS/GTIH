// =============================================================
// Lexiom GT3 Client — QuoteMe-pattern inference wrapper
// Step 3a: endpoint, headers, body per Lexiom_Wireframe_UI_Spec_1_0.md §7
// =============================================================

(function () {
  "use strict";

  const DEFAULT_INFERENCE_URI = "/inference";
  const SESSION_EVENT_URI = "/lexiom-session/event";
  const SESSION_EVENT_SCHEMA_V1 = "lexiom_session_event.v1";
  const SEQ_STORAGE_PREFIX = "lexiom_gt3_sess_seq_";
  const API_KEY_STORAGE_KEY = "lexiom_gt3_api_key";
  const FIRST_ENTRY_PROFILE_STORAGE_KEY = "lexiom_first_entry_profile_v1";

  let gt3ApiKey = (function () {
    try {
      return localStorage.getItem(API_KEY_STORAGE_KEY) || "";
    } catch {
      return "";
    }
  })();

  /** @type {null | (() => string | null)} */
  let gameRecordIdProvider = null;

  function hasNonIso88591CodePoint(s) {
    const str = String(s || "");
    for (let i = 0; i < str.length; i++) {
      if (str.charCodeAt(i) > 255) return true;
    }
    return false;
  }

  function emitDebugLog(hypothesisId, message, data) {
    // #region agent log
    fetch("http://127.0.0.1:7318/ingest/66b2ba87-3e5b-4e81-97da-c0fb8e5eb34d", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "fe3c1b",
      },
      body: JSON.stringify({
        sessionId: "fe3c1b",
        runId: "pre-fix",
        hypothesisId,
        location: "public/gt2/Lexiom/gt3-client.js",
        message,
        data: data || {},
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }

  /**
   * Get inference URI from URL param ?api= or default.
   * @returns {string}
   */
  function getInferenceUri() {
    const urlParams = new URLSearchParams(window.location.search);
    const apiParam = urlParams.get("api");
    if (apiParam) return apiParam;
    return DEFAULT_INFERENCE_URI;
  }

  function getApiKey() {
    try {
      return localStorage.getItem(API_KEY_STORAGE_KEY) || "";
    } catch {
      return "";
    }
  }

  function setApiKey(key) {
    try {
      if (key && key.trim()) {
        localStorage.setItem(API_KEY_STORAGE_KEY, key.trim());
        gt3ApiKey = key.trim();
      } else {
        localStorage.removeItem(API_KEY_STORAGE_KEY);
        gt3ApiKey = "";
      }
    } catch (e) {
      console.error("[lexiom gt3-client] Failed to save API key:", e);
    }
  }

  /**
   * Build inference headers per spec §7.2.
   * @returns {Record<string, string>}
   *
   * Demo behavior:
   * - Uses a Lexiom-specific tenant so the GT3 server can associate
   *   a server-side demo key (no client key required).
   * - Still forwards a client key if present, for future flexibility.
   */
  function buildInferenceHeaders() {
    const principal = resolvePrincipalLabel(getApprovedFirstEntryProfile());
    const headers = {
      "Content-Type": "application/json",
      "X-GT3-Tenant": "gt2-lexiom-demo",
      "X-GT3-Data-Track": "green",
      "X-GT3-Consent-Version": "v1",
      "X-Lexiom-Persona-Mode": getPersonaMode(),
    };
    if (principal) {
      const principalSafeForHeader = !hasNonIso88591CodePoint(principal);
      if (principalSafeForHeader) {
        headers["X-Lexiom-Principal-Label"] = principal;
      }
      // #region agent log
      emitDebugLog("H4", "buildInferenceHeaders.principalHeaderDecision", {
        principalPresent: true,
        principalSafeForHeader,
        principalPreview: String(principal).slice(0, 80),
      });
      // #endregion
    }
    if (gt3ApiKey) {
      headers["X-GT3-OpenRouter-Key"] = gt3ApiKey;
      headers["X-GT3-OpenAI-Key"] = gt3ApiKey;
    }
    if (gameRecordIdProvider) {
      try {
        const id = gameRecordIdProvider();
        if (id && typeof id === "string") {
          const t = id.trim();
          if (t) headers["X-GT3-Game-Record"] = t;
        }
      } catch (_) {
        /* ignore */
      }
    }
    // #region agent log
    emitDebugLog("H1", "buildInferenceHeaders.output", {
      hasPrincipal: !!principal,
      principalPreview: principal ? String(principal).slice(0, 80) : "",
      principalHasNonIso88591: hasNonIso88591CodePoint(principal || ""),
      personaMode: headers["X-Lexiom-Persona-Mode"] || "",
    });
    // #endregion
    return headers;
  }

  function getApprovedFirstEntryProfile() {
    try {
      const raw = localStorage.getItem(FIRST_ENTRY_PROFILE_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      if (!parsed.approved) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function getPersonaMode() {
    return getApprovedFirstEntryProfile() ? "profile_shaped" : "demo_fallback";
  }

  function getPersonaHeaderLine() {
    const profile = getApprovedFirstEntryProfile();
    if (!profile) {
      return "You are Lexiom, an arcade engine for structured reasoning inside the Lexiom cabinet.";
    }
    const role = typeof profile.role === "string" ? profile.role.trim() : "";
    const identity = typeof profile.draftIdentity === "string" ? profile.draftIdentity.trim() : "";
    const rolePart = role ? " for a " + role + " profile" : "";
    const identityPart = identity
      ? " Anchor your guidance to this approved identity: \"" + identity + "\"."
      : "";
    return (
      "You are Lexiom, a profile-shaped strategic reasoning advisor" +
      rolePart +
      "." +
      identityPart +
      " Maintain calm, explicit, consent-driven, draft-first guidance across legal and other structured domains."
    );
  }

  function applyPersonaHeader(narrative) {
    const header = getPersonaHeaderLine();
    const raw = String(narrative || "");
    if (!raw) return raw;
    // Replace any legacy demo header variant while preserving the rest of the prompt.
    return raw.replace(/You are Lexiom \(demo cockpit\)\.?/g, header);
  }

  function defaultPrincipalLabelForRole(role) {
    const r = String(role || "").trim();
    if (r === "Lawyer") return "my client";
    if (r === "Mediator") return "the parties";
    if (r === "Sales Professional") return "my employer and our customers";
    return "";
  }

  function resolvePrincipalLabel(profile) {
    if (!profile || typeof profile !== "object") return "";
    const explicit =
      typeof profile.principalLabel === "string" ? profile.principalLabel.trim() : "";
    if (explicit) return explicit.slice(0, 200);
    const role = typeof profile.role === "string" ? profile.role.trim() : "";
    if (role === "Non-Professional") return "";
    const d = defaultPrincipalLabelForRole(role);
    return d ? d.slice(0, 200) : "";
  }

  /**
   * When the player is a professional, bias outward-facing drafts toward representative voice.
   * Appended to every Lexiom GT3 narrative inside callGT3 (after persona header normalization).
   */
  function buildRepresentationVoiceSuffix() {
    const profile = getApprovedFirstEntryProfile();
    const principal = resolvePrincipalLabel(profile);
    if (!principal) return "";
    const role = profile && typeof profile.role === "string" ? profile.role.trim() : "";
    const roleLine = role ? "Professional role (from player profile): " + role + "." : "";
    return (
      "\n\nVOICE / REPRESENTATION (Lexiom cabinet):\n" +
      "- The player is acting as a professional representative.\n" +
      (roleLine ? "- " + roleLine + "\n" : "") +
      "- Principal / party you are representing in outward-facing correspondence drafts: \"" +
      principal +
      "\".\n" +
      "- When drafting letters, emails, formal demands, or similar outbound artifacts, write as the professional speaking on behalf of that principal.\n" +
      "- Prefer phrasing like: \"on behalf of " +
      principal +
      "\", \"our client\", \"for my employer\", or equivalent natural representative framing.\n" +
      "- Avoid first-person beneficiary framing that implies the player personally is the private party (e.g., \"my security deposit\") when the matter clearly concerns the represented principal; use the principal's perspective instead.\n" +
      "- If the case seed explicitly indicates the player is the direct party, you may use first-person for the player; otherwise default to representative voice for external-facing drafts."
    );
  }

  /**
   * Register a callback that returns the current case's game-record UUID for GT3 logs.
   * @param {null | (() => string | null)} fn
   */
  function setGameRecordIdProvider(fn) {
    gameRecordIdProvider = typeof fn === "function" ? fn : null;
  }

  function nextSessionEventSeq(gameRecordId) {
    const id = (gameRecordId && String(gameRecordId).trim()) || "";
    if (!id) return 0;
    try {
      const k = SEQ_STORAGE_PREFIX + id;
      const cur = parseInt(sessionStorage.getItem(k) || "0", 10) || 0;
      const n = cur + 1;
      sessionStorage.setItem(k, String(n));
      return n;
    } catch {
      return Date.now();
    }
  }

  /**
   * Append one Lexiom session essence event (client-collected) to GT3.
   * @param {{ event_type: string, payload: object, ts_client?: string, idempotency_key?: string }} partial
   * @returns {Promise<{ ok: boolean, error?: string }>}
   */
  async function emitSessionEvent(partial) {
    if (!partial || typeof partial !== "object") {
      return { ok: false, error: "invalid_partial" };
    }
    let gr = "";
    if (gameRecordIdProvider) {
      try {
        const id = gameRecordIdProvider();
        if (id && typeof id === "string") gr = id.trim();
      } catch (_) {
        /* ignore */
      }
    }
    if (!gr) {
      return { ok: false, error: "no_game_record" };
    }

    const seq = nextSessionEventSeq(gr);
    const headers = buildInferenceHeaders();
    headers["Content-Type"] = "application/json";
    headers["X-GT3-Game-Record"] = gr;

    const ts_client =
      typeof partial.ts_client === "string" && partial.ts_client
        ? partial.ts_client
        : new Date().toISOString();

    const body = JSON.stringify({
      schema_id: SESSION_EVENT_SCHEMA_V1,
      event_type: partial.event_type,
      payload: partial.payload,
      seq,
      ts_client,
      idempotency_key:
        typeof partial.idempotency_key === "string"
          ? partial.idempotency_key
          : "s" + seq + ":" + partial.event_type,
    });

    try {
      const response = await fetch(SESSION_EVENT_URI, {
        method: "POST",
        headers,
        body,
      });
      if (!response.ok) {
        const errText = await response.text();
        return {
          ok: false,
          error: "HTTP " + response.status + ": " + errText,
        };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }

  /**
   * In-band instruction for the LM (in_band_description_of_Lexioms_act). Per Lexiom_In_Band_Description_Spec.
   * The body must reflect the TASK in the inference request (e.g. name_for vs content_of for RP).
   * @param {'L23'|'L24'|'LP'|'RP'|'RP_filename'|'RP_content'|'L2_REFRESH'|'TRANSIENT_DRAFT'} inferenceType
   * @returns {string}
   */
  function getInBandInstruction(inferenceType) {
    const formats = {
      L23: "Format: _L23_Clarify_ followed by four words (underscore-separated) that capture what you clarify in this inference, within the Case's semantic realm.",
      L24: "Format: _L24_Draft_ followed by four words (underscore-separated) that capture what you draft in this inference, within the Case's semantic realm.",
      LP: "Format: _LP_Draft_ followed by four words (underscore-separated) that capture the proposed action, within the Case's semantic realm.",
      RP: "Format: _RP_Draft_ followed by four words (underscore-separated) that capture the artifact you draft, within the Case's semantic realm.",
      RP_filename: "Format: _RP_Draft_ followed by four words that reflect the TASK (name for) and the artifact. Example: _RP_Draft_name_for_demand_letter — the task is naming the artifact, not drafting its content.",
      RP_content: "Format: _RP_Draft_ followed by four words that reflect the TASK (content of) and the artifact. Example: _RP_Draft_content_of_demand_letter — the task is drafting the artifact content.",
      L2_REFRESH: "Format: _L2_Refresh_ followed by four words (underscore-separated) that capture the refreshed L1/L2 content, within the Case's semantic realm.",
      TRANSIENT_DRAFT:
        "Format: _Transient_Draft_<word1>_<word2>_<word3>_<word4> (single token on its own line; no spaces). " +
        "Example: _Transient_Draft_shared_tenant_deposit_case. " +
        "Do NOT output any additional underscore-prefixed tokens (e.g. do not embed _L23_...)."
    };
    const fmt = formats[inferenceType] || formats.L24;
    const englishOnly =
      " ENGLISH_ONLY (in-band line): The entire in_band_description_of_Lexioms_act must use English (Latin script) only — ASCII letters A–Z and a–z and digits 0–9 inside each word. Do not use Hebrew, Arabic, Cyrillic, CJK, diacritics, or any non-Latin characters in this phrase, even if LANGUAGE above requires another language for the main response. Express the semantic fingerprint in English words or standard English transliterations (e.g. shalom → peace, not Hebrew letters). This line is exempt from non-English LANGUAGE rules.";
    return (
      "\n\nIMPORTANT: After your main response, add exactly one line containing the in_band_description_of_Lexioms_act. The phrase MUST begin with an underscore (_).\n" +
      fmt +
      " RULES: Use ONLY underscores to separate words. No slashes, hyphens, spaces, or other characters. Each word is letters and numbers only (Latin/ASCII only — see ENGLISH_ONLY). Do NOT wrap this final in-band line in quotes, parentheses, markdown, code fences, or any surrounding punctuation. Example body words: tenant_deposit_return_intent. The four words after the prefix are a compressed semantic fingerprint (first person applies ONLY to that phrase, NOT your main response). Put it on its own line at the very end. No other text after it." +
      englishOnly
    );
  }

  /**
   * Get language instruction suffix for multilingual output.
   * Reads user's browser language preference and returns a directive for GT3
   * to produce all responses in that language.
   * @returns {string} Empty for English; otherwise a suffix to append to the narrative.
   */
  function getOutputLanguageInstruction(forcedLanguage) {
    let raw = "";
    if (forcedLanguage && String(forcedLanguage).trim()) {
      raw = String(forcedLanguage).trim();
    }
    try {
      if (!raw && typeof window !== "undefined" && window.lexiomI18n && typeof window.lexiomI18n.getLocale === "function") {
        raw = String(window.lexiomI18n.getLocale() || "").trim();
      }
    } catch (_) {
      /* ignore */
    }
    if (!raw) {
      raw = navigator.language || (navigator.languages && navigator.languages[0]) || "en";
    }
    const primary = String(raw).split("-")[0].toLowerCase();
    if (primary === "en") return "";
    const langNames = {
      he: "Hebrew", es: "Spanish", fr: "French", de: "German",
      ar: "Arabic", ru: "Russian", it: "Italian", pt: "Portuguese",
      ja: "Japanese", zh: "Chinese", ko: "Korean", hi: "Hindi",
      nl: "Dutch", pl: "Polish", tr: "Turkish",
    };
    const name = langNames[primary] || raw;
    return (
      "\n\nLANGUAGE: Output all text in " +
      name +
      " (" +
      raw +
      "). Write all responses, labels, titles, summaries, chat replies, and narrative content in this language only. Do not use English unless the user's input is in English. Exception: the single final line containing in_band_description_of_Lexioms_act must still follow the appended in-band rules (English/Latin ASCII words only), regardless of this LANGUAGE directive."
    );
  }

  /**
   * Call GT3 inference endpoint.
   * @param {string} narrative - Narrative string to send (request body: { narrative })
   * @param {{ inferenceType?: 'L23'|'L24'|'LP'|'RP'|'RP_filename'|'RP_content'|'L2_REFRESH', outputLanguage?: string }} [options] - inferenceType for in-band instruction; defaults to L24
   * @returns {Promise<{ok: boolean, text: string|null, error: string|null, latencyMs: number}>}
   */
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
    const outputLanguage = options && typeof options.outputLanguage === "string" ? options.outputLanguage : "";
    const uri = getInferenceUri();
    const headers = buildInferenceHeaders();
    const normalizedNarrative = applyPersonaHeader(trimmed);
    const voiceSuffix = buildRepresentationVoiceSuffix();
    const fullNarrative =
      normalizedNarrative +
      voiceSuffix +
      getOutputLanguageInstruction(outputLanguage) +
      getInBandInstruction(inferenceType);
    const body = JSON.stringify({ narrative: fullNarrative });
    const headerIssues = Object.keys(headers).map((k) => ({
      key: k,
      hasNonIso88591: hasNonIso88591CodePoint(headers[k]),
      preview: k === "X-GT3-OpenRouter-Key" || k === "X-GT3-OpenAI-Key" ? "[redacted]" : String(headers[k] || "").slice(0, 80),
    }));
    // #region agent log
    emitDebugLog("H2", "callGT3.preFetch.headersValidation", {
      inferenceType,
      uri,
      headerIssues,
      hasAnyInvalidHeader: headerIssues.some((x) => x.hasNonIso88591),
    });
    // #endregion

    try {
      const response = await fetch(uri, {
        method: "POST",
        headers,
        body,
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
      // #region agent log
      if (data.response.includes("_L24_Draft_") || data.response.includes("_L23_Clarify_") || data.response.includes("_LP_Draft_") || data.response.includes("_RP_Draft_")) {
        fetch('http://127.0.0.1:7318/ingest/66b2ba87-3e5b-4e81-97da-c0fb8e5eb34d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8974af'},body:JSON.stringify({sessionId:'8974af',runId:'pre-fix',hypothesisId:'H2',location:'gt3-client.js:callGT3:response',message:'client received response containing in-band marker',data:{inferenceType,tail:data.response.slice(Math.max(0, data.response.length - 180))},timestamp:Date.now()})}).catch(()=>{});
      }
      // #endregion

      return {
        ok: true,
        text: data.response,
        error: null,
        latencyMs,
      };
    } catch (e) {
      // #region agent log
      emitDebugLog("H3", "callGT3.fetch.catch", {
        error: String(e),
      });
      // #endregion
      const latencyMs = Date.now() - t0;
      return {
        ok: false,
        text: null,
        error: "Network error: " + String(e),
        latencyMs,
      };
    }
  }

  window.lexiomGT3 = {
    callGT3,
    getInferenceUri,
    getApiKey,
    setApiKey,
    buildInferenceHeaders,
    setGameRecordIdProvider,
    emitSessionEvent,
    getPersonaMode,
    getPersonaHeaderLine,
  };
})();
