"use strict";

(function () {
  /**
   * Lexiom Demo — Iteration 1
   * - Cabinet frame
   * - Seed narrative load from meeting_with_client.md
   * - Constitution Harness v1 + dispatchWhiteMove
   */

  // First-entry gate: if no approved profile exists, redirect to landing
  (function ensureFirstEntryProfile() {
    try {
      // Allow explicit bypass for internal dev/test.
      var params = new URLSearchParams(window.location.search || "");
      var inboundArtifact = params.get("inboundArtifact");
      if (inboundArtifact && String(inboundArtifact).trim()) {
        try {
          window.sessionStorage.setItem("lexiom_pending_inbound_artifact_v1", String(inboundArtifact).trim());
        } catch (_) {
          /* ignore */
        }
      }
      if (params.get("bypassFirstEntry") === "1") {
        return;
      }
      var raw = window.localStorage.getItem("lexiom_first_entry_profile_v1");
      var profile = raw ? JSON.parse(raw) : null;
      if (!profile || !profile.approved) {
        window.location.replace("/gt2/Lexiom/landing.html");
      }
    } catch (_) {
      try {
        window.location.replace("/gt2/Lexiom/landing.html");
      } catch (_) {
        // ignore
      }
    }
  })();

  const PHASES = {
    STABLE: "STABLE",
    WHITE_COMMIT: "WHITE_COMMIT",
    BLACK_RUN: "BLACK_RUN",
  };

  /** @type {"STABLE" | "WHITE_COMMIT" | "BLACK_RUN"} */
  let phase = PHASES.STABLE;

  /** @type {Array<{moveId:string, moveType:string, phase:string, timestamp:string, activityContext:any, mutatedKeys:string[]}>} */
  const eventLedger = [];

  /** @type {any} */
  let appState = null;

  // Prevent duplicate transition sequences / server calls due to async renders.
  let homeRunTransitionInFlight = false;
  let accordSharedCreateInFlight = false;
  let l2RefreshFromL1InFlight = false;
  /** @type {Set<string>} */
  const gt3ArtifactPublishInFlight = new Set();
  let transitionHandlersBound = false;
  let lastTransitoryAnimationPhase = null;

  /** First cockpit session after landing (see landing.js skipIntro): gradual panel / L2 reveal. */
  const GRADUAL_COCKPIT_STORAGE_KEY = "lexiom_gradual_cockpit_v1";
  const REVEAL_CENTER_STORAGE_KEY = "lexiom_reveal_center_v1";
  const INIT_EMPTY_CASE_STORAGE_KEY = "lexiom_init_empty_case_v1";
  const REVEAL_RIGHT_INTRO_STORAGE_KEY = "lexiom_reveal_right_intro_v1";
  /** Session handoff from case-create passage → cockpit (see case-create.js). */
  const PENDING_CASE_HANDOFF_STORAGE_KEY = "lexiom_pending_case_handoff_v1";
  /** Resume inbound shared artifact after first-entry landing (see receiver portal Open in Lexiom). */
  const LEXIOM_PENDING_INBOUND_ARTIFACT_V1 = "lexiom_pending_inbound_artifact_v1";
  /** GT3 L1/L2/L3 bootstrap from bundled seed file runs once, after user approves the draft-first seed artifact. */
  let bootstrapFromBundledSeedDone = false;
  const THINKING_TRANSITION_MS_FULL = 10000;
  const THINKING_TRANSITION_MS_SHORT = 5000;
  let thinkingTransitionRunId = 0;
  let thinkingTransitionVisibleUntilMs = 0;
  let thinkingTransitionMode = "full";

  // L2 structural and semantic helpers
  // Structural: L21–L24 = vertical layers; L23 = chat (inquiry), L24 = draft-first (chat results)
  //             a–d     = horizontal topics (currently: a=tensions, b=goals, c=strategy, d=undisputed)
  // Semantic:   tensions, goals, strategy, undisputed
  const L2_TOPIC_KEYS = ["tensions", "goals", "strategy", "undisputed"];

  /** L23 (chat) display title keys aligned with each L2 topic (localized via lexioin-i18n.js). */
  const L23_TITLE_KEYS = {
    tensions: "l23_unlock_story",
    goals: "l23_unlock_intent",
    strategy: "l23_unlock_path",
    undisputed: "l23_unlock_accord",
  };

  /** L24 (draft-first) visibility gates — min user answers required before showing each widget.
   * Phase 2 (Option A):
   * - L24a (disputes) and L24d (undisputed) can render immediately on topic open (inference is triggered on L2a/L2d click).
   * - L24b (goals) renders after 1 user answer in the L23b chat (Underlying Interests — Self).
   * - L24c (strategy) renders after 4 user answers in its L23 chat.
   */
  const L24_MIN_USER_ANSWERS = {
    tensions: 0,
    goals: 1,
    strategy: 4,
    undisputed: 0,
  };

  function l2TopicKeyFromIndex(index) {
    const i = typeof index === "number" ? index : 0;
    return L2_TOPIC_KEYS[i] || "goals";
  }

  function l2IndexFromTopicKey(key) {
    const normalized = typeof key === "string" ? key.toLowerCase() : "";
    const idx = L2_TOPIC_KEYS.indexOf(normalized);
    return idx >= 0 ? idx : 0;
  }

  function l2Coordinate(layer, topicKey) {
    // layer: 21,22,23,24; topicKey: one of L2_TOPIC_KEYS
    const colIndex = l2IndexFromTopicKey(topicKey);
    const colLetter = String.fromCharCode("a".charCodeAt(0) + colIndex);
    return "L2" + String(layer) + colLetter;
  }

  function getCurrentLocale() {
    const i18n = window.lexiomI18n;
    if (i18n && typeof i18n.getLocale === "function") {
      try {
        const loc = String(i18n.getLocale() || "").toLowerCase();
        if (loc) return loc;
      } catch {
        /* ignore */
      }
    }
    const raw = (navigator.language || (navigator.languages && navigator.languages[0]) || "en");
    return String(raw).toLowerCase().split("-")[0];
  }

  function getDefaultL2Topics() {
    const defaults = [
      { l21: "!", l22: "" },           // L2a (tensions) — L22 filled after L24a approval
      { l21: "?", l22: "" },           // L2b (goals) — L22 filled after L24b approval
      { l21: "????", l22: "" },        // L2c (strategy) — L22 filled after L24c approval
      { l21: "!!", l22: "" },          // L2d (undisputed) — L22 filled after L24d approval
    ];
    return defaults.map(function (t) {
      return { l21: t.l21, l22: t.l22 };
    });
  }

  function getFixedL21LabelByIndex(index) {
    switch (index) {
      case 0: return "!";
      case 1: return "?";
      case 2: return "????";
      case 3: return "!!";
      default: return "!";
    }
  }

  function normalizeL2TopicsWithFixedL21(topics) {
    if (!Array.isArray(topics)) return getDefaultL2Topics();
    return topics.map(function (t, i) {
      const base = t && typeof t === "object" ? t : {};
      return {
        ...base,
        l21: getFixedL21LabelByIndex(i),
      };
    });
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function isThinkingTransitionVisible() {
    return Date.now() < thinkingTransitionVisibleUntilMs;
  }

  function beginThinkingTransition(mode) {
    const nextMode = mode === "short" ? "short" : "full";
    const durationMs =
      nextMode === "short" ? THINKING_TRANSITION_MS_SHORT : THINKING_TRANSITION_MS_FULL;
    thinkingTransitionRunId += 1;
    thinkingTransitionMode = nextMode;
    thinkingTransitionVisibleUntilMs = Date.now() + durationMs;
    renderApp();
    setTimeout(function () {
      if (!isThinkingTransitionVisible()) {
        renderApp();
      }
    }, durationMs + 20);
    return durationMs;
  }

  function resolveThinkingModeForApproval(payload, stateAfterWhite, stateBefore) {
    const kind = payload && payload.kind ? String(payload.kind) : "";
    if (!kind || !stateAfterWhite) return null;

    if (kind === "L1") {
      return stateAfterWhite.case && stateAfterWhite.case.l1_card && stateAfterWhite.case.l1_card.approved
        ? "full"
        : null;
    }
    if (kind === "DOC_DRAFT" && payload.artifactId) {
      const aid = String(payload.artifactId);
      const artifacts = Array.isArray(stateAfterWhite.privateArtifacts) ? stateAfterWhite.privateArtifacts : [];
      const artifact = artifacts.find(function (a) {
        return a && String(a.id) === aid;
      });
      return artifact && artifact.card && artifact.card.approved ? "full" : null;
    }
    if (kind === "ACTION_DRAFT") {
      const beforeApproved = stateBefore &&
        stateBefore.actionItems &&
        Array.isArray(stateBefore.actionItems.approved)
        ? stateBefore.actionItems.approved.length
        : 0;
      const afterApproved = stateAfterWhite.actionItems &&
        Array.isArray(stateAfterWhite.actionItems.approved)
        ? stateAfterWhite.actionItems.approved.length
        : 0;
      return afterApproved > beforeApproved ? "full" : null;
    }
    if (kind === "L2_GOALS") {
      return stateAfterWhite.case && stateAfterWhite.case.goals_draft_approved ? "short" : null;
    }
    if (kind === "L2_STRATEGY") {
      return stateAfterWhite.case && stateAfterWhite.case.strategy_draft_approved ? "short" : null;
    }
    if (kind === "L2_UNDISPUTED") {
      return stateAfterWhite.case && stateAfterWhite.case.undisputed_draft_approved ? "short" : null;
    }
    if (kind === "L23A") {
      const card0 = stateAfterWhite.l23_cards && stateAfterWhite.l23_cards["0"];
      return card0 && card0.approved ? "short" : null;
    }
    return null;
  }

  function resolveThinkingTransitionMode(
    moveType,
    payload,
    stateAfterWhite,
    activityContext,
    stateBefore
  ) {
    const ui = stateAfterWhite && stateAfterWhite.ui ? stateAfterWhite.ui : {};
    if (ui.transitionPhase) return null;
    if (moveType === "APPEND_CHAT_MESSAGE") {
      const contextType = payload && payload.contextType ? String(payload.contextType) : "";
      if (contextType === "L2") return "short";
    }
    if (moveType === "EXTERNAL_ARTIFACT_DISCOVERED") {
      const activity = activityContext && activityContext.activity ? String(activityContext.activity) : "";
      return activity === "INIT" ? "short" : "full";
    }
    if (moveType === "L3_CLICK") return "full";
    if (moveType === "TOGGLE_APPROVAL") {
      return resolveThinkingModeForApproval(payload, stateAfterWhite, stateBefore);
    }
    return null;
  }

  /** UUID for GT3 inference logs under logs/<id>/ (one per opened case). */
  function newLexiomGameRecordId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (
      c
    ) {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function deepFreeze(obj) {
    if (obj && typeof obj === "object" && !Object.isFrozen(obj)) {
      Object.freeze(obj);
      Object.getOwnPropertyNames(obj).forEach((prop) => {
        // eslint-disable-next-line no-prototype-builtins
        if (obj.hasOwnProperty(prop)) {
          deepFreeze(obj[prop]);
        }
      });
    }
    return obj;
  }

  function logLedgerEntry(moveId, moveType, phaseValue, activityContext, mutatedKeys) {
    const entry = {
      moveId,
      moveType,
      phase: phaseValue,
      timestamp: nowIso(),
      activityContext: activityContext || null,
      mutatedKeys: mutatedKeys || [],
    };
    eventLedger.push(entry);
    // Expose last entry for quick inspection
    // eslint-disable-next-line no-console
    console.debug("[LEXIOM_LEDGER]", entry);
  }

  function reportDirectMutationViolation(detail) {
    const message = "CONSTITUTION_VIOLATION_DIRECT_MUTATION: " + detail;
    // eslint-disable-next-line no-console
    console.error(message);
    throw new Error(message);
  }

  /**
   * Safe getter — returns the current app state (frozen).
   */
  function getState() {
    return appState;
  }

  function isHomeRun(state) {
    try {
      if (!state || !state.case) return false;
      if (state.case.mode !== "ZENITH") return false;

      const artifacts = state.privateArtifacts || [];
      const hasApprovedLexiomCreatedArtifact = artifacts.some(function (a) {
        if (!a || !a.card || !a.card.approved) return false;
        const id = a.id ? String(a.id) : "";
        const title = a.title ? String(a.title).toLowerCase() : "";
        const isSeedById = id.indexOf("artifact_meeting_with_client") === 0;
        const isSeedByTitle = title === "meeting_with_client.md";
        return !isSeedById && !isSeedByTitle;
      });

      return hasApprovedLexiomCreatedArtifact;
    } catch {
      return false;
    }
  }

  function hasApprovedLexiomCreatedArtifact(state) {
    const artifacts = state && Array.isArray(state.privateArtifacts) ? state.privateArtifacts : [];
    return artifacts.some(function (a) {
      if (!a || !a.card || !a.card.approved) return false;
      const id = a.id ? String(a.id) : "";
      const title = a.title ? String(a.title).toLowerCase() : "";
      const isSeedById = id.indexOf("artifact_meeting_with_client") === 0;
      const isSeedByTitle = title === "meeting_with_client.md";
      return !isSeedById && !isSeedByTitle;
    });
  }

  function parseUndisputedItems(text) {
    const raw = typeof text === "string" ? text : "";
    return raw
      .split(/\r?\n/)
      .map(function (s) { return s.trim(); })
      .filter(Boolean)
      .map(function (s) { return s.replace(/^[\-\*\d\.\)\s]+/, "").trim(); })
      .filter(Boolean);
  }

  function buildAccordSharedSeedContent(state) {
    const narrative = state && state.case && typeof state.case.narrative === "string"
      ? state.case.narrative.trim()
      : "";
    const undisputedText = state && state.case && typeof state.case.undisputed_draft_text === "string"
      ? state.case.undisputed_draft_text
      : "";
    const items = parseUndisputedItems(undisputedText);
    const body = items.length
      ? ("## Undisputed Items (from Zenith completion)\n" + items.map(function (it) { return "- " + it; }).join("\n"))
      : "## Undisputed Items (from Zenith completion)\n- (none captured)";

    return (narrative || "Lexiom Accord Seed") + "\n\n" + body + "\n";
  }

  function buildAccordInvitationPrompt(state, recipientPolarity, recipientChannel) {
    const caseSeed = state && state.case && typeof state.case.narrative === "string" ? state.case.narrative.trim() : "";
    const undisputedAnchors = state && state.case && typeof state.case.undisputed_draft_text === "string" ? state.case.undisputed_draft_text.trim() : "";
    const personalGoals = state && state.case && typeof state.case.goals_draft_text === "string" ? state.case.goals_draft_text.trim() : "";
    const conductStrategy = state && state.case && typeof state.case.strategy_draft_text === "string" ? state.case.strategy_draft_text.trim() : "";

    const l23Cards = state && state.l23_cards && typeof state.l23_cards === "object" ? state.l23_cards : {};
    const disputedItems = l23Cards["0"] && typeof l23Cards["0"].text === "string" ? l23Cards["0"].text.trim() : "";

    const polarityNorm = (recipientPolarity ? String(recipientPolarity) : "ALLY").toUpperCase();
    const channelNorm = (recipientChannel ? String(recipientChannel) : "DIRECT").toUpperCase();
    const polarityLabel = polarityNorm === "FOE" ? "foe" : "ally";
    const channelLabel = channelNorm === "MEDIATED" ? "mediated" : "direct";

    const positioning = polarityLabel + " x " + channelLabel;

    // Player A editorial sovereignty: the synthesis must reflect the initiating player's captured framing.
    return (
      "You are Lexiom (demo cockpit). Create the Shared Case Seed Narrative for Lexiom Accord.\n\n" +
      "Semantic framing inputs (initiating player = Player A):\n" +
      "- Case seed narrative (Player A):\n" +
      caseSeed +
      "\n\n" +
      "- Disputed items (L23a):\n" +
      disputedItems +
      "\n\n" +
      "- Personal goals:\n" +
      personalGoals +
      "\n\n" +
      "- Conduct / strategy reflections:\n" +
      conductStrategy +
      "\n\n" +
      "- Undisputed anchors:\n" +
      undisputedAnchors +
      "\n\n" +
      "- Recipient positioning (ally/foe x direct/mediated): " +
      positioning +
      "\n\n" +
      "TASK:\n" +
      "1) Write in a third-perspective synthesis voice.\n" +
      "2) Be forward-looking and non-accusatory.\n" +
      "3) Create legitimate shared meeting ground (common ground + clarifiable differences).\n" +
      "4) Include undisputed anchors as stable reference points.\n" +
      "5) Calibrate narrative framing using recipient positioning:\n" +
      "- If ally: emphasize collaboration and psychological safety.\n" +
      "- If foe: keep respectful neutrality and preserve dignity.\n" +
      "- If direct: be explicit and operational.\n" +
      "- If mediated: be structured, facilitative, and process-forward.\n" +
      "6) Weight tone approximately: lawyers 60%, laypersons 30%, mediator 10%.\n\n" +
      "OUTPUT (markdown only):\n" +
      "- First line: a short 3-5 word case identity phrase (no punctuation), suitable for deriving a title.\n" +
      "- Then include sections using localized markdown headings (translate the heading text into the requested OUTPUT language; do NOT keep headings in English):\n" +
      "  ## Common Ground\n" +
      "  ## Clarifiable Differences\n" +
      "  ## Undisputed Anchors\n" +
      "  ## Invitation Direction (recipient positioning)\n"
    );
  }

  function inferAccordSharedSeedContent(state, recipientPolarity, recipientChannel) {
    const callGT3Fn = window.lexiomGT3 && window.lexiomGT3.callGT3 ? window.lexiomGT3.callGT3 : null;
    const fallback = buildAccordSharedSeedContent(state);
    if (typeof callGT3Fn !== "function") {
      return Promise.resolve(fallback);
    }

    const prompt = buildAccordInvitationPrompt(state, recipientPolarity, recipientChannel);
    return callGT3Fn(prompt, { inferenceType: "TRANSIENT_DRAFT" }).then(function (res) {
      const ok = res && res.ok;
      const text = res && typeof res.text === "string" ? res.text.trim() : "";
      if (ok && text) return text;
      return fallback;
    }).catch(function () {
      return fallback;
    });
  }

  function getQueryParam(name) {
    try {
      const p = new URLSearchParams(window.location.search);
      return p.get(name);
    } catch {
      return null;
    }
  }

  function isGradualCockpitEnabled() {
    try {
      return window.sessionStorage.getItem(GRADUAL_COCKPIT_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  }

  function clearGradualCockpitSessionHints() {
    try {
      window.sessionStorage.removeItem(REVEAL_CENTER_STORAGE_KEY);
      window.sessionStorage.removeItem(INIT_EMPTY_CASE_STORAGE_KEY);
      window.sessionStorage.removeItem(REVEAL_RIGHT_INTRO_STORAGE_KEY);
      window.sessionStorage.removeItem(GRADUAL_COCKPIT_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  /** Bundled markdown seed or L1-created user_seed artifact — not Lexiom-created action artifacts. */
  function isBundledSeedArtifact(a) {
    if (!a) return false;
    const id = a.id ? String(a.id) : "";
    const title = (a.title && String(a.title).toLowerCase()) || "";
    if (id.indexOf("artifact_meeting_with_client") === 0) return true;
    if (id.indexOf("artifact_seed_") === 0) return true;
    if (title === "meeting_with_client.md" || title === "user_seed.md") return true;
    return false;
  }

  function isCenterNarrativeApprovedForGradualL2a(state) {
    const arts = (state && state.privateArtifacts) || [];
    const meetingSeed = arts.find(function (a) {
      return a && String(a.id).indexOf("artifact_meeting_with_client") === 0;
    });
    if (meetingSeed) return !!(meetingSeed.card && meetingSeed.card.approved);
    return !!(state && state.case && state.case.l1_card && state.case.l1_card.approved);
  }

  function isCenterUnlockedForGradual() {
    try {
      return window.sessionStorage.getItem(REVEAL_CENTER_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  }

  /** Run before renderTopHud so L2 milestone classes match the current activity. */
  function noteGradualRevealCenterProgress(state) {
    if (!isGradualCockpitEnabled() || !state || !state.ui) return;
    const act = state.ui.activeActivity;
    if (!act) return;
    try {
      if (act.type === "DOC_DRAFT" && act.artifactId) {
        const arts = state.privateArtifacts || [];
        const hit = arts.find(function (a) {
          return a && String(a.id) === String(act.artifactId);
        });
        if (hit && isBundledSeedArtifact(hit)) {
          window.sessionStorage.setItem(REVEAL_CENTER_STORAGE_KEY, "1");
        }
      }
      if (act.type === "L1_DRAFT" && window.sessionStorage.getItem(INIT_EMPTY_CASE_STORAGE_KEY) === "1") {
        window.sessionStorage.setItem(REVEAL_CENTER_STORAGE_KEY, "1");
      }
    } catch {
      /* ignore */
    }
  }

  function computeCockpitRevealMilestones(state) {
    if (!isGradualCockpitEnabled()) {
      return {
        right: true,
        center: true,
        l2a: true,
        l2b: true,
        l2c: true,
        l2d: true,
        left: true,
      };
    }
    const right = true;
    const center = isCenterUnlockedForGradual();
    const narrativeOk = isCenterNarrativeApprovedForGradualL2a(state);
    const l2a = center && narrativeOk;
    const lc0 = !!(state && state.l23_cards && state.l23_cards["0"] && state.l23_cards["0"].approved);
    const l2b = l2a && lc0;
    const goalsOk = !!(state && state.case && state.case.goals_draft_approved);
    const l2c = l2b && goalsOk;
    const strategyOk = !!(state && state.case && state.case.strategy_draft_approved);
    const l2d = l2c && strategyOk;
    const undisputedOk = !!(state && state.case && state.case.undisputed_draft_approved);
    const left = l2d && undisputedOk;
    return { right, center, l2a, l2b, l2c, l2d, left };
  }

  function getNewlyRevealedL2TopicIndex(stateBefore, stateAfter) {
    const before = computeCockpitRevealMilestones(stateBefore || null);
    const after = computeCockpitRevealMilestones(stateAfter || null);
    const keys = ["l2a", "l2b", "l2c", "l2d"];
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      if (!before[key] && !!after[key]) return i;
    }
    return null;
  }

  function applyGradualCockpitReveal(state) {
    const right = document.getElementById("lexiom-right-panel");
    const center = document.getElementById("lexiom-center-playfield");
    const left = document.getElementById("lexiom-left-panel");
    if (!right || !center || !left) return;

    if (!isGradualCockpitEnabled()) {
      right.classList.remove("lexiom-reveal-hidden", "lexiom-reveal-visible");
      center.classList.remove("lexiom-reveal-hidden", "lexiom-reveal-visible");
      left.classList.remove("lexiom-reveal-hidden", "lexiom-reveal-visible");
      return;
    }

    const m = computeCockpitRevealMilestones(state);
    function setReveal(el, show) {
      el.classList.remove("lexiom-reveal-hidden", "lexiom-reveal-visible");
      el.classList.add(show ? "lexiom-reveal-visible" : "lexiom-reveal-hidden");
    }
    try {
      const rightIntroDone = window.sessionStorage.getItem(REVEAL_RIGHT_INTRO_STORAGE_KEY) === "1";
      if (m.right && !rightIntroDone) {
        window.sessionStorage.setItem(REVEAL_RIGHT_INTRO_STORAGE_KEY, "1");
        setReveal(right, false);
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            setReveal(right, true);
          });
        });
      } else {
        setReveal(right, m.right);
      }
    } catch {
      setReveal(right, m.right);
    }
    setReveal(center, m.center);
    setReveal(left, m.left);

    if (m.left) {
      clearGradualCockpitSessionHints();
    }
  }

  const FIRST_ENTRY_PROFILE_STORAGE_KEY = "lexiom_first_entry_profile_v1";
  const LANDING_EVENT_QUEUE_KEY = "lexiom_landing_event_queue_v1";
  const PRESPA_FLAG_STORAGE_KEY = "lexiom_prespa_enabled_v1";

  function isPreSpaLandingEnabled() {
    const qp = getQueryParam("prespa");
    if (qp === "0") return false;
    if (qp === "1") return true;
    try {
      const raw = localStorage.getItem(PRESPA_FLAG_STORAGE_KEY);
      if (raw === "0") return false;
      if (raw === "1") return true;
    } catch {
      /* ignore */
    }
    return true;
  }

  function getFirstEntryProfile() {
    try {
      const raw = localStorage.getItem(FIRST_ENTRY_PROFILE_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function getFirstEntryState() {
    const p = getFirstEntryProfile();
    if (!p) return "new_user_uninitialized";
    if (!p.approved) return "onboarding_in_progress";
    return "onboarding_complete";
  }

  function redirectToLanding(reason) {
    try {
      const u = new URL("/gt2/Lexiom/landing.html", window.location.origin);
      if (reason) u.searchParams.set("reason", String(reason));
      window.location.replace(u.toString());
    } catch {
      window.location.href = "/gt2/Lexiom/landing.html";
    }
  }

  function tryFlushLandingEventQueue() {
    const emit = window.lexiomGT3 && window.lexiomGT3.emitSessionEvent;
    const state = getState();
    if (typeof emit !== "function" || !state || !state.case || !state.case.gameRecordId) return;
    let queue = [];
    try {
      queue = JSON.parse(localStorage.getItem(LANDING_EVENT_QUEUE_KEY) || "[]");
      if (!Array.isArray(queue)) queue = [];
    } catch {
      queue = [];
    }
    if (!queue.length) return;

    queue.forEach(function (ev) {
      if (!ev || typeof ev !== "object") return;
      const name = ev.name ? String(ev.name) : "landing_event";
      const payload = ev.payload && typeof ev.payload === "object" ? ev.payload : {};
      void emit({
        // Keep strict compatibility with server-side allowed event types.
        event_type: "l23_qa_turn",
        payload: {
          topicIndex: -2,
          role: "system",
          text: name,
          context: "LANDING",
          landing: payload,
        },
      }).catch(function () { /* non-fatal */ });
    });
    try {
      localStorage.removeItem(LANDING_EVENT_QUEUE_KEY);
    } catch {
      /* ignore */
    }
  }

  function emitPersonaModeEventOnce() {
    const emit = window.lexiomGT3 && window.lexiomGT3.emitSessionEvent;
    if (typeof emit !== "function") return;
    try {
      if (sessionStorage.getItem("lexiom_persona_mode_event_sent_v1") === "1") return;
    } catch {
      /* ignore */
    }
    const mode =
      window.lexiomGT3 && typeof window.lexiomGT3.getPersonaMode === "function"
        ? window.lexiomGT3.getPersonaMode()
        : "demo_fallback";
    void emit({
      event_type: "l23_qa_turn",
      payload: {
        topicIndex: -3,
        role: "system",
        text: "persona_mode:" + mode,
        context: "PERSONA",
        persona_mode: mode,
      },
    }).catch(function () {
      /* non-fatal */
    });
    try {
      sessionStorage.setItem("lexiom_persona_mode_event_sent_v1", "1");
    } catch {
      /* ignore */
    }
  }

  /**
   * Client → GT3 session essence: L23 Q&A turns, L24 approvals, action/artifact edges.
   * Uses rising-edge detection (stateBefore → stateAfter).
   */
  function emitLexiomSessionEventsAfterMove(moveType, payload, stateBefore, stateAfter) {
    if (!stateAfter || !stateAfter.case || !stateAfter.case.gameRecordId) {
      return;
    }
    const emit = window.lexiomGT3 && window.lexiomGT3.emitSessionEvent;
    if (typeof emit !== "function") {
      return;
    }

    const sb = stateBefore || {};

    function fire(partial) {
      void emit(partial).catch(function () {
        /* non-fatal */
      });
    }

    if (moveType === "APPEND_CHAT_MESSAGE" || moveType === "APPEND_ASSISTANT_MESSAGE") {
      const p = payload || {};
      const text = typeof p.text === "string" ? p.text.trim() : "";
      if (!text) return;
      const role = moveType === "APPEND_CHAT_MESSAGE" ? "user" : "assistant";
      const ctx = p.contextType;
      if (ctx === "L2") {
        const topicIndex = typeof p.topicIndex === "number" ? p.topicIndex : 0;
        fire({
          event_type: "l23_qa_turn",
          payload: { topicIndex, role, text, context: "L2" },
        });
      } else if (ctx === "ACTION_ITEM") {
        const actionItemId = p.actionItemId ? String(p.actionItemId) : "";
        fire({
          event_type: "l23_qa_turn",
          payload: {
            topicIndex: -1,
            role,
            text,
            context: "ACTION_ITEM",
            actionItemId,
          },
        });
      }
      return;
    }

    if (moveType === "TOGGLE_APPROVAL" && payload && payload.kind) {
      const kind = payload.kind;
      if (kind === "L2_GOALS") {
        if (!(sb.case && sb.case.goals_draft_approved) && stateAfter.case && stateAfter.case.goals_draft_approved) {
          fire({
            event_type: "l24_approved",
            payload: {
              lane: "b",
              text: (stateAfter.case.goals_draft_text || "").trim(),
            },
          });
        }
      } else if (kind === "L2_STRATEGY") {
        if (
          !(sb.case && sb.case.strategy_draft_approved) &&
          stateAfter.case &&
          stateAfter.case.strategy_draft_approved
        ) {
          fire({
            event_type: "l24_approved",
            payload: {
              lane: "c",
              text: (stateAfter.case.strategy_draft_text || "").trim(),
            },
          });
        }
      } else if (kind === "L2_UNDISPUTED") {
        if (
          !(sb.case && sb.case.undisputed_draft_approved) &&
          stateAfter.case &&
          stateAfter.case.undisputed_draft_approved
        ) {
          fire({
            event_type: "l24_approved",
            payload: {
              lane: "d",
              text: (stateAfter.case.undisputed_draft_text || "").trim(),
            },
          });
        }
      } else if (kind === "L23A") {
        const prevCard = sb.l23_cards && sb.l23_cards["0"];
        const nextCard = stateAfter.l23_cards && stateAfter.l23_cards["0"];
        if (!(prevCard && prevCard.approved) && nextCard && nextCard.approved) {
          fire({
            event_type: "l24_approved",
            payload: {
              lane: "a",
              text: (nextCard.text && String(nextCard.text)) || "",
            },
          });
        }
      } else if (kind === "ACTION_DRAFT") {
        const al0 = (sb.actionItems && sb.actionItems.approved) || [];
        const al1 = (stateAfter.actionItems && stateAfter.actionItems.approved) || [];
        if (al1.length > al0.length) {
          const last = al1[al1.length - 1];
          if (last && last.text) {
            fire({
              event_type: "action_item_approved",
              payload: { id: last.id, text: last.text || "" },
            });
          }
        }
      } else if (kind === "DOC_DRAFT" && payload.artifactId) {
        const aid = String(payload.artifactId);
        const arts0 = sb.privateArtifacts || [];
        const arts1 = stateAfter.privateArtifacts || [];
        const a0 = arts0.find(function (a) {
          return a && String(a.id) === aid;
        });
        const a1 = arts1.find(function (a) {
          return a && String(a.id) === aid;
        });
        const was = a0 && a0.card && a0.card.approved;
        const now = a1 && a1.card && a1.card.approved;
        if (!was && now) {
          fire({
            event_type: "artifact_approved",
            payload: {
              artifactId: a1.id,
              title: a1.title || "",
              cardText: (a1.card.text && String(a1.card.text)) || "",
            },
          });
        }
      }
      return;
    }

    if (moveType === "TOGGLE_L2_DRAFT_APPROVAL") {
      const idx =
        payload && typeof payload.topicIndex === "number" ? payload.topicIndex : 0;
      const key = l2TopicKeyFromIndex(idx);
      if (key === "goals") {
        if (!(sb.case && sb.case.goals_draft_approved) && stateAfter.case && stateAfter.case.goals_draft_approved) {
          fire({
            event_type: "l24_approved",
            payload: {
              lane: "b",
              text: (stateAfter.case.goals_draft_text || "").trim(),
            },
          });
        }
      } else if (key === "strategy") {
        if (
          !(sb.case && sb.case.strategy_draft_approved) &&
          stateAfter.case &&
          stateAfter.case.strategy_draft_approved
        ) {
          fire({
            event_type: "l24_approved",
            payload: {
              lane: "c",
              text: (stateAfter.case.strategy_draft_text || "").trim(),
            },
          });
        }
      }
    }
  }

  /**
   * Internal helper to apply a mutation under a non-STABLE phase.
   */
  function applyMutation(mutatorFn, mutatedKeyHints) {
    if (phase === PHASES.STABLE) {
      // Any mutation attempt during STABLE is a violation
      reportDirectMutationViolation("Mutation attempted during STABLE phase");
    }
    const draft = appState ? { ...appState } : {};
    const result = mutatorFn(draft) || draft;
    appState = deepFreeze(result);
    return mutatedKeyHints || [];
  }

  /**
   * Single public mutation entrypoint.
   * Returns a Promise for COMMIT_INFERENCE (async Black phase); otherwise sync.
   */
  function dispatchWhiteMove(moveType, payload, activityContext) {
    if (phase !== PHASES.STABLE) {
      reportDirectMutationViolation("dispatchWhiteMove called while not STABLE");
    }

    const stateBefore = getState();
    const moveId = "move_" + nowIso();

    // WHITE_COMMIT
    phase = PHASES.WHITE_COMMIT;
    const mutatedKeysWhite = applyMutation(
      (draft) => reduceStateForWhite(draft, moveType, payload),
      []
    );
    logLedgerEntry(moveId, moveType, PHASES.WHITE_COMMIT, activityContext, mutatedKeysWhite);

    // AI-bus: publish events for listeners (action-item acceptance, L3 click, etc.).
    let blackPayload = payload;
    if (moveType === "TOGGLE_APPROVAL" && payload && payload.kind === "ACTION_DRAFT") {
      const stateAfterWhite = getState();
      const approved = (stateAfterWhite && stateAfterWhite.actionItems && stateAfterWhite.actionItems.approved) || [];
      const lastApproved = approved.length ? approved[approved.length - 1] : null;
      if (lastApproved && (lastApproved.linkedArtifactId == null || lastApproved.linkedArtifactId === "")) {
        blackPayload = {
          ...payload,
          aiBusEvent: {
            type: "proposed_action_item_has_been_accepted",
            payload: {
              actionItemId: lastApproved.id,
              text: lastApproved.text || "",
            },
          },
        };
      }
    } else if (moveType === "L3_CLICK" && payload) {
      const l3Index = typeof payload.l3Index === "number" ? payload.l3Index : -1;
      const label = typeof payload.label === "string" ? payload.label : "";
      blackPayload = {
        ...payload,
        aiBusEvent: {
          type: "l3_click",
          payload: {
            l3Index,
            label,
          },
        },
      };
    } else if (moveType === "EXTERNAL_ARTIFACT_DISCOVERED" && payload) {
      const title = (payload.title && String(payload.title).trim()) || "meeting_with_client.md";
      const content = (payload.content && String(payload.content)) || "";
      blackPayload = {
        ...payload,
        aiBusEvent: {
          type: "external_artifact_ingested",
          payload: { title, content, approved: true },
        },
      };
    } else if (
      (moveType === "BOOTSTRAP_L1_FROM_GT3" || moveType === "REFRESH_L1_FROM_ARTIFACT_APPROVAL") &&
      payload && payload.title
    ) {
      const stateAfterWhite = getState();
      const c = stateAfterWhite && stateAfterWhite.case;
      const title = (c && c.l1_title) || (payload.title && String(payload.title).trim()) || "";
      const summary = (c && c.l1_summary) || (payload.summary && String(payload.summary).trim()) || "";
      if (title) {
        blackPayload = {
          ...payload,
          aiBusEvent: {
            type: "l1_changed",
            payload: { title, summary },
          },
        };
      }
    } else if (moveType === "TOGGLE_APPROVAL" && payload && payload.kind === "DOC_DRAFT" && payload.artifactId) {
      const stateAfterWhite = getState();
      const artifactId = String(payload.artifactId);
      const artifacts = (stateAfterWhite && stateAfterWhite.privateArtifacts) || [];
      const artifact = artifacts.find((a) => a && String(a.id) === artifactId);
      if (artifact && artifact.card && artifact.card.approved) {
        const narrative = typeof artifact.card.text === "string" ? artifact.card.text : "";
        blackPayload = {
          ...payload,
          aiBusEvent: {
            type: "artifact_draft_approved",
            payload: {
              artifactId,
              title: artifact.title || "",
              narrative: narrative.trim(),
            },
          },
        };
      }
    }

    const stateAfterWhite = getState();
    const thinkingMode = resolveThinkingTransitionMode(
      moveType,
      payload,
      stateAfterWhite,
      activityContext,
      stateBefore
    );
    if (thinkingMode) {
      beginThinkingTransition(thinkingMode);
    }

    function executeBlackRunAndEffects() {
      phase = PHASES.BLACK_RUN;
      const mutatedKeysBlack = applyMutation(
        (draft) => reduceStateForBlack(draft, moveType, blackPayload),
        []
      );
      logLedgerEntry(moveId, moveType, PHASES.BLACK_RUN, activityContext, mutatedKeysBlack);
      phase = PHASES.STABLE;
      renderApp();

      const stateAfterBlack = getState();

      try {
        emitLexiomSessionEventsAfterMove(moveType, payload, stateBefore, stateAfterBlack);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[lexiom] session essence emit", e);
      }

      // Temporal-spatial UX: when a new L2 button is revealed, auto-open its lane
      // so center playfield transitions immediately without waiting for a click.
      if (stateAfterBlack) {
        const newlyRevealedTopic = getNewlyRevealedL2TopicIndex(stateBefore, stateAfterBlack);
        if (newlyRevealedTopic != null) {
          const activeNow =
            stateAfterBlack.ui && stateAfterBlack.ui.activeActivity
              ? stateAfterBlack.ui.activeActivity
              : { type: "IDLE", topicIndex: null };
          const alreadyOnTopic =
            activeNow.type === "L2_CHAT" && activeNow.topicIndex === newlyRevealedTopic;
          if (!alreadyOnTopic) {
            dispatchWhiteMove(
              "NAVIGATE_ACTIVITY",
              { activity: "L2_CHAT", topicIndex: newlyRevealedTopic },
              { activity: "L2_CHAT", topicIndex: newlyRevealedTopic }
            );
          }
        }
      }

      // Temporal-spatial UX: once L24d (undisputed) gets approved, auto-focus
      // Proposed Action so it is highlighted and shown in center playfield.
      if (
        moveType === "TOGGLE_APPROVAL" &&
        payload &&
        payload.kind === "L2_UNDISPUTED" &&
        stateAfterBlack
      ) {
        const wasUndisputedApproved = !!(
          stateBefore &&
          stateBefore.case &&
          stateBefore.case.undisputed_draft_approved
        );
        const isUndisputedApproved = !!(
          stateAfterBlack.case &&
          stateAfterBlack.case.undisputed_draft_approved
        );
        if (!wasUndisputedApproved && isUndisputedApproved) {
          const hasProposed = !!(
            stateAfterBlack.actionItems &&
            stateAfterBlack.actionItems.proposed
          );
          if (hasProposed) {
            const activeNow =
              stateAfterBlack.ui && stateAfterBlack.ui.activeActivity
                ? stateAfterBlack.ui.activeActivity
                : { type: "IDLE" };
            if (activeNow.type !== "ACTION_DRAFT") {
              dispatchWhiteMove(
                "NAVIGATE_ACTIVITY",
                { activity: "ACTION_DRAFT" },
                { activity: "ACTION_DRAFT" }
              );
            }
          }
        }
      }

      if (moveType === "TOGGLE_APPROVAL" && payload && stateAfterBlack) {
        if (payload.kind === "DOC_DRAFT" && payload.artifactId) {
          maybePublishApprovedRightPanelArtifact(
            stateBefore,
            stateAfterBlack,
            "private",
            String(payload.artifactId)
          );
        } else if (payload.kind === "SHARED_DOC_DRAFT" && payload.artifactId) {
          maybePublishApprovedRightPanelArtifact(
            stateBefore,
            stateAfterBlack,
            "shared",
            String(payload.artifactId)
          );
        }
      }

      // After Black: if we started with no seed narrative and the user just approved L1
      // for the first time, treat the approved L1 text as the seed narrative and run
      // the same bootstrap flow as if it came from a markdown seed file.
      if (
        moveType === "TOGGLE_APPROVAL" &&
        payload &&
        payload.kind === "L1" &&
        stateAfterBlack &&
        stateAfterBlack.case &&
        !stateAfterBlack.case.narrative
      ) {
        const l1Card = stateAfterBlack.case.l1_card;
        const seedText =
          l1Card && l1Card.approved && typeof l1Card.text === "string"
            ? l1Card.text.trim()
            : "";
        if (seedText) {
          // First, set the canonical case narrative and create a seed artifact via White Move.
          dispatchWhiteMove(
            "SET_CASE_NARRATIVE_FROM_L1",
            { narrative: seedText, title: "user_seed.md" },
            { activity: "INIT_FROM_L1" }
          );
          // Then, reuse the seeded bootstrap pipeline (L1/L2/L3/proposed) with this narrative.
          if (typeof bootstrapFromSeedNarrative === "function") {
            bootstrapFromSeedNarrative(seedText);
          }
        }
      }

    // After Black: bundled seed markdown — run GT3 bootstrap only after user approves the draft-first seed artifact.
    if (
      moveType === "TOGGLE_APPROVAL" &&
      payload &&
      payload.kind === "DOC_DRAFT" &&
      payload.artifactId &&
      stateAfterBlack
    ) {
      const aid = String(payload.artifactId);
      const arts = (stateAfterBlack.privateArtifacts && stateAfterBlack.privateArtifacts.slice()) || [];
      const art = arts.find(function (a) {
        return a && String(a.id) === aid;
      });
      if (
        art &&
        art.card &&
        art.card.approved &&
        !bootstrapFromBundledSeedDone &&
        String(art.id).indexOf("artifact_meeting_with_client") === 0
      ) {
        bootstrapFromBundledSeedDone = true;
        const narr =
          (stateAfterBlack.case && typeof stateAfterBlack.case.narrative === "string"
            ? stateAfterBlack.case.narrative
            : "") ||
          (typeof art.card.text === "string" ? art.card.text : "");
        const trimmed = narr.trim();
        if (trimmed && typeof bootstrapFromSeedNarrative === "function") {
          bootstrapFromSeedNarrative(trimmed);
        }
      }
    }

    // After Black: if private section listener set pending artifact, infer filename and content via GT3 then append artifact.
    const pending = stateAfterBlack && stateAfterBlack.ui && stateAfterBlack.ui.pendingArtifactForAction;
    if (pending && pending.actionItemId) {
      const buildFilenameFn = window.lexiomBuildArtifactFilenameNarrative;
      const buildContentFn = window.lexiomBuildArtifactContentNarrative;
      const callGT3Fn = window.lexiomGT3 && window.lexiomGT3.callGT3;

      function dispatchAppend(inferredTitle, inferredContent) {
        dispatchWhiteMove(
          "APPEND_ARTIFACT_FROM_ACTION",
          {
            actionItemId: pending.actionItemId,
            inferredTitle: inferredTitle || "action_item.md",
            inferredContent: typeof inferredContent === "string" ? inferredContent : "",
          },
          { activity: "APPEND_ARTIFACT" }
        );
      }

      if (buildFilenameFn && callGT3Fn) {
        callGT3Fn(buildFilenameFn(pending.text), { inferenceType: "RP_filename" })
          .then(function (filenameResult) {
            let inferredTitle = "action_item.md";
            if (filenameResult && filenameResult.ok && typeof filenameResult.text === "string") {
              const raw = String(filenameResult.text).trim().split(/\r?\n/)[0] || "";
              const noExt = raw.replace(/\.md$/i, "").trim();
              const words = noExt
                .toLowerCase()
                .replace(/\s+/g, "_")
                .split("_")
                .filter(Boolean);
              const two = words.slice(0, 2);
              if (two.length >= 1) {
                inferredTitle = two.join("_") + ".md";
              }
            }

            if (buildContentFn) {
              callGT3Fn(buildContentFn(pending.text, stateAfterBlack), { inferenceType: "RP_content" })
                .then(function (contentResult) {
                  let inferredContent = "";
                  if (contentResult && contentResult.ok && typeof contentResult.text === "string") {
                    inferredContent = String(contentResult.text).trim();
                  }
                  dispatchAppend(inferredTitle, inferredContent);
                })
                .catch(function () {
                  dispatchAppend(inferredTitle, "");
                });
            } else {
              dispatchAppend(inferredTitle, "");
            }
          })
          .catch(function () {
            dispatchAppend("action_item.md", "");
          });
      } else {
        dispatchAppend("action_item.md", "");
      }
    }

    // After Black: if L1 listener set pending refresh from artifact approval, infer title/summary via GT3.
    const pendingL1 = stateAfterBlack && stateAfterBlack.ui && stateAfterBlack.ui.pendingL1RefreshFromArtifact;
    if (pendingL1 && pendingL1.artifactId) {
      const buildL1RefreshFn = window.lexiomBuildL1RefreshFromArtifactNarrative;
      const callGT3Fn = window.lexiomGT3 && window.lexiomGT3.callGT3;
      const seedNarrative = (stateAfterBlack.case && stateAfterBlack.case.narrative) || "";

      if (buildL1RefreshFn && callGT3Fn) {
        const narrative = buildL1RefreshFn(seedNarrative, pendingL1.title, pendingL1.narrative);
        callGT3Fn(narrative, { inferenceType: "L2_REFRESH" })
          .then(function (l1Result) {
            if (l1Result && l1Result.ok && typeof l1Result.text === "string") {
              const lines = String(l1Result.text)
                .split(/\r?\n/)
                .map((s) => s.replace(/^[\d.)\-\s*]+/, "").trim())
                .filter(Boolean);
              const titleLine = lines[0] || "";
              const summaryLine = lines[1] || "";
              if (titleLine) {
                dispatchWhiteMove(
                  "REFRESH_L1_FROM_ARTIFACT_APPROVAL",
                  { title: titleLine, summary: summaryLine },
                  { activity: "REFRESH_L1_FROM_ARTIFACT" }
                );
              }
            }
          })
          .catch(function (e) {
            if (typeof console !== "undefined" && console.error) {
              console.error("[LEXIOM] L1 refresh from artifact approval failed:", e);
            }
            dispatchWhiteMove(
              "CLEAR_PENDING_UI",
              { key: "pendingL1RefreshFromArtifact" },
              { activity: "REFRESH_L1_FROM_ARTIFACT" }
            );
          });
      } else {
        dispatchWhiteMove(
          "CLEAR_PENDING_UI",
          { key: "pendingL1RefreshFromArtifact" },
          { activity: "REFRESH_L1_FROM_ARTIFACT" }
        );
      }
    }

    // After Black: if L1-changed listener set pending L2 refresh, recalc topics for vacant indices.
    const pendingL2 = stateAfterBlack && stateAfterBlack.ui && stateAfterBlack.ui.pendingL2RefreshFromL1;
    if (pendingL2 && pendingL2.title) {
      const buildL22OnlyFn = window.lexiomBuildL22OnlyTopicRefreshNarrative;
      const callGT3Fn = window.lexiomGT3 && window.lexiomGT3.callGT3;
      const seedNarrative = (stateAfterBlack.case && stateAfterBlack.case.narrative) || "";
      const threads = stateAfterBlack.threads || { l2Threads: {}, actionItemThreads: {} };
      const l2Threads = threads.l2Threads || {};
      const defaultL2Topics = getDefaultL2Topics();
      const currentTopics = stateAfterBlack.l2_topics || defaultL2Topics;
      const vacantIndices = [0, 1, 2, 3].filter(function (i) {
        const arr = l2Threads[String(i)];
        return !Array.isArray(arr) || arr.length === 0;
      });

      if (vacantIndices.length === 0) {
        dispatchWhiteMove("CLEAR_PENDING_UI", { key: "pendingL2RefreshFromL1" }, { activity: "REFRESH_L2_FROM_L1" });
      } else if (l2RefreshFromL1InFlight) {
        /* One in-flight refresh is enough; avoids a storm when pending stayed set across many moves. */
      } else if (buildL22OnlyFn && callGT3Fn) {
        l2RefreshFromL1InFlight = true;
        const narrative = buildL22OnlyFn(seedNarrative, pendingL2.title, pendingL2.summary);
        callGT3Fn(narrative, { inferenceType: "L2_REFRESH" })
          .then(function (l2Result) {
            if (l2Result && l2Result.ok && typeof l2Result.text === "string") {
              const rawLines = String(l2Result.text)
                .split(/\r?\n/)
                .map(function (s) { return s.replace(/^[\d.)\-\s*]+/, "").trim(); })
                .filter(Boolean)
                .slice(0, 4);
              if (rawLines.length >= 4) {
                const merged = currentTopics.map(function (cur, i) {
                  if (vacantIndices.indexOf(i) < 0) return cur;
                  return { ...cur, l22: (rawLines[i] || "").trim() || (cur && cur.l22) || "…" };
                });
                dispatchWhiteMove(
                  "REFRESH_L2_TOPICS_FROM_L1",
                  { mergedTopics: merged },
                  { activity: "REFRESH_L2_FROM_L1" }
                );
              } else {
                dispatchWhiteMove("CLEAR_PENDING_UI", { key: "pendingL2RefreshFromL1" }, { activity: "REFRESH_L2_FROM_L1" });
              }
            } else {
              dispatchWhiteMove("CLEAR_PENDING_UI", { key: "pendingL2RefreshFromL1" }, { activity: "REFRESH_L2_FROM_L1" });
            }
          })
          .catch(function (e) {
            if (typeof console !== "undefined" && console.error) {
              console.error("[LEXIOM] L2 topic refresh from L1 failed:", e);
            }
            dispatchWhiteMove("CLEAR_PENDING_UI", { key: "pendingL2RefreshFromL1" }, { activity: "REFRESH_L2_FROM_L1" });
          })
          .finally(function () {
            l2RefreshFromL1InFlight = false;
          });
      } else {
        dispatchWhiteMove("CLEAR_PENDING_UI", { key: "pendingL2RefreshFromL1" }, { activity: "REFRESH_L2_FROM_L1" });
      }
    }

    // After Black: when draft-first (L2a/L2b) is approved, infer L22 via GT3 from approved draft + user answers.
    const pendingL22 = stateAfterBlack && stateAfterBlack.ui && stateAfterBlack.ui.pendingL22RefreshFromApprovedDraft;
    if (pendingL22 && typeof pendingL22.topicIndex === "number") {
      const buildL22Fn = window.lexiomBuildL22SummaryFromApprovedDraftNarrative;
      const callGT3Fn = window.lexiomGT3 && window.lexiomGT3.callGT3;
      if (buildL22Fn && callGT3Fn) {
        const narrative = buildL22Fn(stateAfterBlack, pendingL22.topicIndex);
        callGT3Fn(narrative, { inferenceType: "L24" })
          .then(function (l22Result) {
            if (l22Result && l22Result.ok && typeof l22Result.text === "string") {
              const raw = String(l22Result.text).trim().replace(/^["']|["']$/g, "");
              const words = raw.split(/\s+/).filter(Boolean);
              const summary = (words[0] || "").trim() || raw.slice(0, 50);
              if (summary) {
                dispatchWhiteMove(
                  "REFRESH_L22_FROM_APPROVED_DRAFT",
                  { topicIndex: pendingL22.topicIndex, summary },
                  { activity: "REFRESH_L22" }
                );
              } else {
                dispatchWhiteMove("CLEAR_PENDING_UI", { key: "pendingL22RefreshFromApprovedDraft" }, { activity: "REFRESH_L22" });
              }
            } else {
              dispatchWhiteMove("CLEAR_PENDING_UI", { key: "pendingL22RefreshFromApprovedDraft" }, { activity: "REFRESH_L22" });
            }
          })
          .catch(function (e) {
            if (typeof console !== "undefined" && console.error) {
              console.error("[LEXIOM] L22 refresh from approved draft failed:", e);
            }
            dispatchWhiteMove("CLEAR_PENDING_UI", { key: "pendingL22RefreshFromApprovedDraft" }, { activity: "REFRESH_L22" });
          });
      } else {
        dispatchWhiteMove("CLEAR_PENDING_UI", { key: "pendingL22RefreshFromApprovedDraft" }, { activity: "REFRESH_L22" });
      }
    }

    // After Black: recalculate proposed action when White Move conclusions warrant it (Left Panel listens).
    const moveTypesForProposedRefresh = [
      "BOOTSTRAP_L1_FROM_GT3",
      "REFRESH_L1_FROM_ARTIFACT_APPROVAL",
      "APPEND_ARTIFACT_FROM_ACTION",
    ];
    const isActionApproval = moveType === "TOGGLE_APPROVAL" && payload && payload.kind === "ACTION_DRAFT";
    const isL24DraftApproval =
      moveType === "TOGGLE_APPROVAL" &&
      payload &&
      payload.kind &&
      (
        (payload.kind === "L23A" && !!(stateAfterBlack && stateAfterBlack.l23_cards && stateAfterBlack.l23_cards["0"] && stateAfterBlack.l23_cards["0"].approved)) ||
        (payload.kind === "L2_GOALS" && !!(stateAfterBlack && stateAfterBlack.case && stateAfterBlack.case.goals_draft_approved)) ||
        (payload.kind === "L2_STRATEGY" && !!(stateAfterBlack && stateAfterBlack.case && stateAfterBlack.case.strategy_draft_approved)) ||
        (payload.kind === "L2_UNDISPUTED" && !!(stateAfterBlack && stateAfterBlack.case && stateAfterBlack.case.undisputed_draft_approved))
      );
    const shouldRefreshProposed =
      moveTypesForProposedRefresh.indexOf(moveType) >= 0 || isActionApproval || isL24DraftApproval;
    if (shouldRefreshProposed) {
      const buildProposedFn = window.lexiomBuildProposedActionRefreshNarrative;
      const callGT3Fn = window.lexiomGT3 && window.lexiomGT3.callGT3;
      if (buildProposedFn && callGT3Fn) {
        const narrative = buildProposedFn(stateAfterBlack);
        callGT3Fn(narrative, { inferenceType: "LP" })
          .then(function (result) {
            if (result && result.ok && typeof result.text === "string") {
              const actionLine = String(result.text).split(/\r?\n/)[0].trim();
              if (actionLine) {
                dispatchWhiteMove(
                  "REFRESH_PROPOSED_ACTION_FROM_GT3",
                  { text: actionLine },
                  { activity: "REFRESH_PROPOSED" }
                );
              }
            }
          })
          .catch(function (e) {
            if (typeof console !== "undefined" && console.error) {
              console.error("[LEXIOM] Proposed action refresh failed:", e);
            }
          });
      }
    }

    // After Black (L3-triggered round): restricted path — Center + L3 ribbon only (Wireframe §5.6.2).
    const lastL3 = stateAfterBlack && stateAfterBlack.ui && stateAfterBlack.ui.lastL3Click;
    if (moveType === "L3_CLICK" && lastL3 && typeof lastL3.label === "string") {
      const callGT3Fn = window.lexiomGT3 && window.lexiomGT3.callGT3;
      const buildDraftForL3 = window.lexiomBuildDraftNarrativeForL3;
      const buildL3Refresh = window.lexiomBuildL3RibbonRefreshNarrative;
      const active =
        (stateAfterBlack.ui && stateAfterBlack.ui.activeActivity) ||
        { type: "IDLE", artifactId: null, topicIndex: null, actionItemId: null };
      const l3Label = lastL3.label;

      dispatchWhiteMove("SET_INFERENCE_PENDING", {}, { activity: "L3_CLICK" });

      function runCenterL3Inference() {
        if (active.type === "L1_DRAFT" || active.type === "ACTION_DRAFT" || active.type === "DOC_DRAFT") {
          if (!callGT3Fn || !buildDraftForL3) {
            dispatchWhiteMove("SET_INFERENCE_ERROR", { message: "GT3 or L3 draft builder not configured" }, { activity: "L3_CLICK" });
            return Promise.resolve();
          }
          const narrative = buildDraftForL3(stateAfterBlack, l3Label);
          return callGT3Fn(narrative, { inferenceType: "L24" }).then(
            function (result) {
              if (result && result.ok && typeof result.text === "string" && result.text.trim()) {
                dispatchWhiteMove(
                  "COMMIT_INFERENCE",
                  { inferenceResult: result },
                  { activity: active.type, artifactId: active.artifactId || null }
                );
              } else {
                dispatchWhiteMove(
                  "SET_INFERENCE_ERROR",
                  { message: (result && result.error) || "L3 draft inference failed" },
                  { activity: "L3_CLICK" }
                );
              }
            },
            function (err) {
              dispatchWhiteMove(
                "SET_INFERENCE_ERROR",
                { message: (err && err.message) || String(err) || "GT3 error" },
                { activity: "L3_CLICK" }
              );
            }
          );
        }
        if (active.type === "L2_CHAT" || active.type === "ACTION_CHAT") {
          const buildL2Chat = window.lexiomBuildL2ChatNarrative;
          const buildActionChat = window.lexiomBuildActionItemChatNarrative;
          if (!callGT3Fn || !buildL2Chat || !buildActionChat) {
            dispatchWhiteMove("SET_INFERENCE_ERROR", { message: "GT3 or chat narrative builders not configured" }, { activity: "L3_CLICK" });
            return Promise.resolve();
          }
          // Append L3 label as user message so transcript shows "You: [L3 label]"
          if (active.type === "L2_CHAT") {
            dispatchWhiteMove(
              "APPEND_CHAT_MESSAGE",
              { contextType: "L2", topicIndex: active.topicIndex != null ? active.topicIndex : 0, text: l3Label },
              { activity: active.type, topicIndex: active.topicIndex }
            );
          } else {
            dispatchWhiteMove(
              "APPEND_CHAT_MESSAGE",
              { contextType: "ACTION_ITEM", actionItemId: active.actionItemId || "", text: l3Label },
              { activity: active.type, actionItemId: active.actionItemId }
            );
          }
          const stateAfterUser = getState();
          const narrative =
            active.type === "L2_CHAT"
              ? buildL2Chat(stateAfterUser, active.topicIndex != null ? active.topicIndex : 0, { l3Continuation: true })
              : buildActionChat(stateAfterUser, active.actionItemId || "", { l3Continuation: true });
          return callGT3Fn(narrative, { inferenceType: "L23" }).then(
            function (result) {
              if (result && result.ok && typeof result.text === "string") {
                const reply = String(result.text).trim();
                if (reply) {
                  if (active.type === "L2_CHAT") {
                    dispatchWhiteMove(
                      "APPEND_ASSISTANT_MESSAGE",
                      { contextType: "L2", topicIndex: active.topicIndex != null ? active.topicIndex : 0, text: reply },
                      { activity: active.type, topicIndex: active.topicIndex }
                    );
                  } else {
                    dispatchWhiteMove(
                      "APPEND_ASSISTANT_MESSAGE",
                      { contextType: "ACTION_ITEM", actionItemId: active.actionItemId || "", text: reply },
                      { activity: active.type, actionItemId: active.actionItemId }
                    );
                  }
                }
              }
              dispatchWhiteMove("CLEAR_INFERENCE_UI", {}, { activity: "L3_CLICK" });
            },
            function (err) {
              dispatchWhiteMove(
                "SET_INFERENCE_ERROR",
                { message: (err && err.message) || String(err) || "GT3 error" },
                { activity: "L3_CLICK" }
              );
            }
          );
        }
        dispatchWhiteMove("CLEAR_INFERENCE_UI", {}, { activity: "L3_CLICK" });
        return Promise.resolve();
      }

      function runL3RibbonRefresh() {
        if (!callGT3Fn || !buildL3Refresh) return Promise.resolve();
        const narrative = buildL3Refresh(stateAfterBlack, l3Label);
        return callGT3Fn(narrative, { inferenceType: "L2_REFRESH" }).then(
          function (result) {
            if (result && result.ok && typeof result.text === "string") {
              const raw = String(result.text)
                .split(/\r?\n/)
                .map((s) => s.replace(/^[\d.)\-\s*]+/, "").trim())
                .filter(Boolean)
                .slice(0, 3);
              const labels = [raw[0] || "Move 1", raw[1] || "Move 2", raw[2] || "Move 3"];
              dispatchWhiteMove("BOOTSTRAP_L3_FROM_GT3", { labels }, { activity: "L3_RIBBON_REFRESH" });
            }
          },
          function () {
            // Non-fatal: keep current L3 ribbon
          }
        );
      }

      runCenterL3Inference().then(runL3RibbonRefresh);
    }

    // After Black: when navigating into an L2 chat with an empty thread,
    // automatically ask Lexiom for a strategic status summary for that lens
    // and append it as the first assistant message instead of showing a placeholder.
    if (moveType === "NAVIGATE_ACTIVITY" && stateAfterBlack && stateAfterBlack.ui && stateAfterBlack.ui.activeActivity) {
      const active = stateAfterBlack.ui.activeActivity;
      if (active.type === "L2_CHAT") {
        const topicIndex =
          typeof active.topicIndex === "number" ? active.topicIndex : 0;
        const threads = stateAfterBlack.threads || { l2Threads: {}, actionItemThreads: {} };
        const l2Threads = threads.l2Threads || {};
        const key = String(topicIndex);
        const existing = Array.isArray(l2Threads[key]) ? l2Threads[key] : [];

        const callGT3Fn = window.lexiomGT3 && window.lexiomGT3.callGT3;
        const buildLabelNarrative = window.lexiomBuildL2QuestionsLabelNarrative || null;

        // Infer and cache a single-word label for "Questions:" (per language) the first time we enter an L2 chat.
        if (callGT3Fn && buildLabelNarrative && stateAfterBlack.case && !stateAfterBlack.case.l2_questions_label) {
          const labelNarrative = buildLabelNarrative(stateAfterBlack);
          if (labelNarrative && typeof labelNarrative === "string" && labelNarrative.trim()) {
            callGT3Fn(labelNarrative, { inferenceType: "L2_REFRESH" })
              .then(function (labelResult) {
                if (labelResult && labelResult.ok && typeof labelResult.text === "string") {
                  const rawLabel = String(labelResult.text).trim();
                  const oneWord = rawLabel.split(/\s+/)[0] || "";
                  if (oneWord) {
                    dispatchWhiteMove(
                      "SET_L2_QUESTIONS_LABEL",
                      { label: oneWord },
                      { activity: "L2_CHAT", topicIndex }
                    );
                  }
                }
              })
              .catch(function () {
                // Non-fatal; fall back to default header behavior.
              });
          }
        }

        // L2 chat: all topics (tensions, goals, strategy, undisputed) open with buildL2ChatNarrative. No 4-question phase (obsolete; L24 draft visibility gated by L24_MIN_USER_ANSWERS).
        const topicKey = l2TopicKeyFromIndex(topicIndex);
        const isTensions = topicKey === "tensions";
        const isGoals = topicKey === "goals";
        const isStrategy = topicKey === "strategy";
        const isUndisputed = topicKey === "undisputed";
        // Phase 2: L2a/L2d are card-only. Trigger L24a/L24d inference on click, independent of L23 chat activity.
        if ((isTensions || isUndisputed) && callGT3Fn) {
          const latestStateOnClick = (getState && getState()) || stateAfterBlack;
          if (latestStateOnClick) {
            if (isTensions) {
              const cards = latestStateOnClick.l23_cards || {};
              const card0 = cards["0"];
              if (!card0 || !card0.approved) {
                const buildDisputes = window.lexiomBuildDisputesAnalysisNarrative;
                if (buildDisputes) {
                  const disputesNarrative = buildDisputes(latestStateOnClick);
                  if (disputesNarrative && typeof disputesNarrative === "string" && disputesNarrative.trim()) {
                    callGT3Fn(disputesNarrative, { inferenceType: "L24" })
                      .then(function (disputesResult) {
                        if (disputesResult && disputesResult.ok && typeof disputesResult.text === "string") {
                          const raw = String(disputesResult.text)
                            .split(/\r?\n/)
                            .map(function (s) { return s.replace(/^[\d.)\-\s*]+/, "").trim(); })
                            .filter(Boolean);
                          const text = raw.join("\n");
                          if (text) {
                            dispatchWhiteMove(
                              "UPDATE_L23A_FROM_GT3",
                              { text },
                              { activity: "L2_CHAT", topicIndex: 0 }
                            );
                          }
                        }
                      })
                      .catch(function () {
                        // Non-fatal
                      });
                  }
                }
              }
            } else if (isUndisputed) {
              const buildUndisputedDraftNarrative = window.lexiomBuildUndisputedDraftNarrative || null;
              if (!latestStateOnClick.case || !latestStateOnClick.case.undisputed_draft_approved) {
                const undisputedNarrative = buildUndisputedDraftNarrative && buildUndisputedDraftNarrative(latestStateOnClick, topicIndex);
                if (undisputedNarrative && typeof undisputedNarrative === "string" && undisputedNarrative.trim()) {
                  callGT3Fn(undisputedNarrative, { inferenceType: "L24" })
                    .then(function (draftResult) {
                      if (draftResult && draftResult.ok && typeof draftResult.text === "string") {
                        const draftText = String(draftResult.text).trim();
                        if (draftText) {
                          dispatchWhiteMove(
                            "SET_L2_DRAFT_FROM_GT3",
                            { topicIndex, text: draftText },
                            { activity: "L2_CHAT", topicIndex }
                          );
                        }
                      }
                    })
                    .catch(function () {
                      // Non-fatal
                    });
                }
              }
            }
          }
        }

        if (!existing.length && (isGoals || isStrategy)) {
          const buildChatNarrative = window.lexiomBuildL2ChatNarrative || null;
          const buildGoalsDraftNarrative = window.lexiomBuildGoalsDraftNarrative || null;
          const buildStrategyDraftNarrative = window.lexiomBuildStrategyDraftNarrative || null;
          const buildUndisputedDraftNarrative = window.lexiomBuildUndisputedDraftNarrative || null;
          const narrative = buildChatNarrative && buildChatNarrative(stateAfterBlack, topicIndex);
          if (callGT3Fn && narrative && typeof narrative === "string" && narrative.trim()) {
            dispatchWhiteMove(
              "SET_INFERENCE_PENDING",
              {},
              { activity: "L2_CHAT", topicIndex }
            );
            callGT3Fn(narrative, { inferenceType: "L23" })
              .then(function (result) {
                if (result && result.ok && typeof result.text === "string") {
                  const reply = String(result.text).trim().replace(/^[\d.)\-\s*]+/, "").trim();
                  if (reply) {
                    const text = reply;
                      dispatchWhiteMove(
                        "APPEND_ASSISTANT_MESSAGE",
                        {
                          contextType: "L2",
                          topicIndex,
                          text,
                        },
                        { activity: "L2_CHAT", topicIndex }
                      );

                      // Kick off initial draft-first inference for L2b/L2c/L2d unless already approved.
                      const latestState = getState && getState();
                      if (latestState && latestState.case) {
                        const topicKeyForDraft = l2TopicKeyFromIndex(topicIndex);

                        // L24a (tensions): initial tensions analysis on L2a click, unless L23a card already approved.
                        if (topicKeyForDraft === "tensions") {
                          const cards = latestState.l23_cards || {};
                          const card0 = cards["0"];
                          if (!card0 || !card0.approved) {
                            const buildDisputes = window.lexiomBuildDisputesAnalysisNarrative;
                            if (callGT3Fn && buildDisputes) {
                              const disputesNarrative = buildDisputes(latestState);
                              if (disputesNarrative && typeof disputesNarrative === "string" && disputesNarrative.trim()) {
                                callGT3Fn(disputesNarrative, { inferenceType: "L24" })
                                  .then(function (disputesResult) {
                                    if (disputesResult && disputesResult.ok && typeof disputesResult.text === "string") {
                                      const raw = String(disputesResult.text)
                                        .split(/\r?\n/)
                                        .map(function (s) { return s.replace(/^[\d.)\-\s*]+/, "").trim(); })
                                        .filter(Boolean);
                                      const text = raw.join("\n");
                                      if (text) {
                                        dispatchWhiteMove(
                                          "UPDATE_L23A_FROM_GT3",
                                          { text },
                                          { activity: "L2_CHAT", topicIndex: 0 }
                                        );
                                      }
                                    }
                                  })
                                  .catch(function () {
                                    // Non-fatal
                                  });
                              }
                            }
                          }
                        }

                        // L24b/L24c/L24d initial drafts, unless already approved.
                        if (buildGoalsDraftNarrative || buildStrategyDraftNarrative || buildUndisputedDraftNarrative) {
                          const isGoalsDraft = topicKeyForDraft === "goals";
                          const isStrategyDraft = topicKeyForDraft === "strategy";
                          const isUndisputedDraft = topicKeyForDraft === "undisputed";
                          const approved = isGoalsDraft
                            ? !!latestState.case.goals_draft_approved
                            : (isStrategyDraft ? !!latestState.case.strategy_draft_approved : (isUndisputedDraft ? !!latestState.case.undisputed_draft_approved : true));
                          if (!approved && (isGoalsDraft || isStrategyDraft || isUndisputedDraft)) {
                            const draftNarrative = isGoalsDraft
                              ? (buildGoalsDraftNarrative && buildGoalsDraftNarrative(latestState, topicIndex))
                              : (isStrategyDraft
                                ? (buildStrategyDraftNarrative && buildStrategyDraftNarrative(latestState, topicIndex))
                                : (buildUndisputedDraftNarrative && buildUndisputedDraftNarrative(latestState, topicIndex)));
                            if (draftNarrative && typeof draftNarrative === "string" && draftNarrative.trim()) {
                              callGT3Fn(draftNarrative, { inferenceType: "L24" })
                                .then(function (draftResult) {
                                  if (draftResult && draftResult.ok && typeof draftResult.text === "string") {
                                    const draftText = String(draftResult.text).trim();
                                    if (draftText) {
                                      dispatchWhiteMove(
                                        "SET_L2_DRAFT_FROM_GT3",
                                        { topicIndex, text: draftText },
                                        { activity: "L2_CHAT", topicIndex }
                                      );
                                    }
                                  }
                                })
                                .catch(function () {
                                  // Non-fatal.
                                });
                            }
                          }
                        }
                      }
                    } else {
                      dispatchWhiteMove(
                        "CLEAR_INFERENCE_UI",
                        {},
                        { activity: "L2_CHAT", topicIndex }
                      );
                    }
                  } else {
                    dispatchWhiteMove(
                      "CLEAR_INFERENCE_UI",
                      {},
                      { activity: "L2_CHAT", topicIndex }
                    );
                  }
                })
                .catch(function () {
                  dispatchWhiteMove(
                    "CLEAR_INFERENCE_UI",
                    {},
                    { activity: "L2_CHAT", topicIndex }
                  );
                });
          }
        }
      }
    }

      // Home-run: when key Zenith approvals are all present, auto-enter transition flow.
      if (moveType === "TOGGLE_APPROVAL") {
      try {
        const st = getState();
        const ui = st && st.ui ? st.ui : {};
        const kind = payload && payload.kind ? String(payload.kind) : "";
        const approvedArtifactEdge = kind === "DOC_DRAFT" && hasApprovedLexiomCreatedArtifact(st);
        const hasUndisputedApproval = !!(st && st.case && st.case.undisputed_draft_approved);

        if (approvedArtifactEdge && !hasUndisputedApproval && !ui.undisputedGateModalOpen) {
          dispatchWhiteMove(
            "OPEN_UNDISPUTED_GATE_MODAL",
            { items: parseUndisputedItems(st && st.case ? st.case.undisputed_draft_text : "") },
            { activity: "HOME_RUN_BLOCKED_UNDISPUTED_REQUIRED" }
          );
          return undefined;
        }

        if (!homeRunTransitionInFlight && isHomeRun(st) && hasUndisputedApproval && !ui.transitionPhase) {
          homeRunTransitionInFlight = true;

          // 1) cockpit -> black (2s)
          dispatchWhiteMove(
            "SET_TRANSITION_PHASE",
            { phase: "COCKPIT_FADEOUT" },
            { activity: "HOME_RUN_TRANSITION" }
          );

          // 2) transitory slide (6s) then selection
          setTimeout(function () {
            dispatchWhiteMove(
              "SET_TRANSITION_PHASE",
              { phase: "TRANSITORY_1" },
              { activity: "HOME_RUN_TRANSITION" }
            );
          }, 2000);

          setTimeout(function () {
            dispatchWhiteMove(
              "SET_TRANSITION_PHASE",
              { phase: "SELECTION" },
              { activity: "HOME_RUN_TRANSITION" }
            );
          }, 2000 + 6000);
        }
      } catch {
        // Non-fatal: transition is cosmetic.
      }
      }
      return undefined;
    }

    return executeBlackRunAndEffects();
  }

  /**
   * Reducer for WHITE_COMMIT phase.
   */
  function reduceStateForWhite(draft, moveType, payload) {
    if (moveType === "INIT_FROM_SHARED_ACCORD_MD" || moveType === "INIT_FROM_INBOUND_PUBLISHED_MD") {
      const fromInboundGateway = moveType === "INIT_FROM_INBOUND_PUBLISHED_MD";
      const resourceId = payload && payload.resourceId ? String(payload.resourceId) : "";
      const title = payload && payload.title ? String(payload.title) : "accord_shared.md";
      const content = payload && typeof payload.content === "string" ? payload.content : "";
      const narrative = content.trim();
      if (!resourceId || !narrative) return draft;

      const firstLine = narrative.split(/\r?\n/)[0] || "";
      const words = firstLine.trim().split(/\s+/).slice(0, 4);
      const l1Title = words.length ? words.join(" ") : "LEXIOM ACCORD CASE";

      draft.case = {
        id: "case_lexiom_accord_demo_1",
        gameRecordId: newLexiomGameRecordId(),
        l1_title: l1Title,
        l1_summary: "",
        l1_card: {
          id: "l1_card",
          text: "",
          approved: false,
          hasLmDraft: false,
          hasUserEdits: false,
        },
        narrative,
        mode: "ACCORD",
        goals_draft_text: "",
        goals_draft_approved: false,
        strategy_draft_text: "",
        strategy_draft_approved: false,
        undisputed_draft_text: "",
        undisputed_draft_approved: false,
        l2_questions_label: "",
      };

      draft.stages = [
        { id: "preparing", name: "Preparing", currentStage: true },
        { id: "opening", name: "Opening", currentStage: false },
        { id: "exposing", name: "Exposing", currentStage: false },
        { id: "reframing", name: "Reframing", currentStage: false },
        { id: "proposing", name: "Proposing", currentStage: false },
        { id: "resoluting", name: "Resoluting", currentStage: false },
      ];

      draft.l2_topics = getDefaultL2Topics();
      draft.l3_ribbon = ["Clarify expectations", "Surface constraints", "Propose step"];

      draft.actionItems = {
        proposed: {
          id: "ai_proposed_shared_" + resourceId,
          text: "",
          approved: false,
          hasLmDraft: false,
          hasUserEdits: false,
        },
        approved: [],
        completed: [],
      };

      draft.sharedHarmony = [
        {
          id: "shared_" + resourceId,
          resourceId,
          title,
          card: {
            id: "shared_card_" + resourceId,
            text: narrative,
            approved: false, // awaiting collaborator approval
            hasLmDraft: true,
            hasUserEdits: false,
          },
        },
      ];

      draft.privateArtifacts = [];

      draft.threads = {
        l2Threads: {},
        actionItemThreads: {},
      };

      draft.l23_cards = {
        "0": {
          text: "",
          approved: false,
          hasLmDraft: false,
          hasUserEdits: false,
        },
      };

      draft.ui = {
        activeActivity: { type: "IDLE", artifactId: null, topicIndex: null, actionItemId: null },
        inferenceError: null,
        inferencePending: false,
        editingArtifactId: null,
        transitionPhase: null,
        transitionChoice: null,
        undisputedGateModalOpen: false,
        undisputedGateModalItems: [],
        accordSetup: {
          status: fromInboundGateway ? "ready_from_inbound_gateway" : "ready_from_deeplink",
          sharedResourceId: resourceId,
          sharedResourceLink: null,
          errorMessage: "",
          seedContent: narrative,
          sharedResourceFilename: title,
          linkActionTaken: false,
        },
      };

      return draft;
    }

    if (moveType === "SET_TRANSITION_PHASE") {
      const phase = payload && payload.phase ? String(payload.phase) : null;
      const prevUi = draft.ui && typeof draft.ui === "object" ? draft.ui : {};
      draft.ui = {
        ...prevUi,
        transitionPhase: phase,
      };
      return draft;
    }

    if (moveType === "OPEN_UNDISPUTED_GATE_MODAL") {
      const prevUi = draft.ui && typeof draft.ui === "object" ? draft.ui : {};
      const itemsRaw = payload && Array.isArray(payload.items) ? payload.items : [];
      const items = itemsRaw.map(function (s) { return String(s || "").trim(); }).filter(Boolean);
      draft.ui = {
        ...prevUi,
        undisputedGateModalOpen: true,
        undisputedGateModalItems: items,
      };
      return draft;
    }

    if (moveType === "CLOSE_UNDISPUTED_GATE_MODAL") {
      const prevUi = draft.ui && typeof draft.ui === "object" ? draft.ui : {};
      draft.ui = {
        ...prevUi,
        undisputedGateModalOpen: false,
      };
      return draft;
    }

    if (moveType === "SELECT_NEXT_ROUND") {
      const choice = payload && payload.choice ? String(payload.choice) : "ZENITH";
      const nextPhase = choice === "ACCORD" ? "ACCORD_POSITIONING" : "INSTRUCTIONS_ZENITH";
      const prevUi = draft.ui && typeof draft.ui === "object" ? draft.ui : {};
      draft.ui = {
        ...prevUi,
        transitionChoice: choice,
        transitionPhase: nextPhase,
        undisputedGateModalOpen: false,
        accordSetup: choice === "ACCORD"
          ? {
              ...(prevUi.accordSetup || {}),
              status: "idle",
              sharedResourceId: null,
              sharedResourceLink: "",
              errorMessage: "",
              seedContent: draft.case && draft.case.narrative ? draft.case.narrative : "",
              recipientPolarity: null,
              recipientChannel: null,
              linkActionTaken: false,
            }
          : prevUi.accordSetup,
      };
      return draft;
    }

    if (moveType === "SET_ACCORD_RECIPIENT_POSITIONING") {
      const polarity = payload && payload.polarity ? String(payload.polarity) : null;
      const channel = payload && payload.channel ? String(payload.channel) : null;
      const prevUi = draft.ui && typeof draft.ui === "object" ? draft.ui : {};

      draft.ui = {
        ...prevUi,
        accordSetup: {
          ...(prevUi.accordSetup || {}),
          recipientPolarity: polarity,
          recipientChannel: channel,
        },
      };
      return draft;
    }

    if (moveType === "SET_ACCORD_LINK_ACTION_USED") {
      const prevUi = draft.ui && typeof draft.ui === "object" ? draft.ui : {};
      draft.ui = {
        ...prevUi,
        accordSetup: {
          ...(prevUi.accordSetup || {}),
          linkActionTaken: true,
        },
      };
      return draft;
    }

    if (moveType === "SET_ACCORD_SHARED_RESOURCE") {
      const resourceId = payload && payload.resourceId ? String(payload.resourceId) : "";
      const filename = payload && payload.filename ? String(payload.filename) : "";
      const shareLink = payload && payload.shareLink ? String(payload.shareLink) : "";
      const seedContent = payload && typeof payload.seedContent === "string" ? payload.seedContent : (draft.case && draft.case.narrative ? draft.case.narrative : "");
      const prevUi = draft.ui && typeof draft.ui === "object" ? draft.ui : {};

      draft.ui = {
        ...prevUi,
        accordSetup: {
          ...(prevUi.accordSetup || {}),
          status: resourceId && shareLink ? "ready" : "error",
          sharedResourceId: resourceId || null,
          sharedResourceFilename: filename,
          sharedResourceLink: shareLink,
          errorMessage: "",
          seedContent,
          linkActionTaken: false,
        },
      };
      return draft;
    }

    if (moveType === "SET_ARTIFACT_GT3_FILE_URL") {
      const scope = payload && payload.scope === "shared" ? "shared" : "private";
      const artifactId = payload && payload.artifactId ? String(payload.artifactId) : "";
      const fileUrl = payload && typeof payload.fileUrl === "string" ? payload.fileUrl.trim() : "";
      const sharePortalUrl =
        payload && typeof payload.sharePortalUrl === "string" ? payload.sharePortalUrl.trim() : "";
      if (!artifactId || (!fileUrl && !sharePortalUrl)) return draft;
      const patch = {};
      if (fileUrl) patch.gt3ArtifactFileUrl = fileUrl;
      if (sharePortalUrl) patch.gt3ArtifactSharePortalUrl = sharePortalUrl;
      if (scope === "shared" && Array.isArray(draft.sharedHarmony)) {
        draft.sharedHarmony = draft.sharedHarmony.map(function (row) {
          if (!row || String(row.id) !== artifactId) return row;
          return { ...row, ...patch };
        });
      } else if (Array.isArray(draft.privateArtifacts)) {
        draft.privateArtifacts = draft.privateArtifacts.map(function (row) {
          if (!row || String(row.id) !== artifactId) return row;
          return { ...row, ...patch };
        });
      }
      return draft;
    }

    if (moveType === "START_NEXT_ZENITH_ROUND") {
      // Keep the approved case seed (L1), but reset the round-working drafts.
      const prevUi = draft.ui && typeof draft.ui === "object" ? draft.ui : {};
      if (!draft.case) return draft;

      draft.case = {
        ...draft.case,
        mode: "ZENITH",
        goals_draft_text: "",
        goals_draft_approved: false,
        strategy_draft_text: "",
        strategy_draft_approved: false,
        undisputed_draft_text: "",
        undisputed_draft_approved: false,
      };

      draft.stages = [{ id: "zenith", name: "ZENITH", currentStage: true }];

      draft.l23_cards = {
        "0": { text: "", approved: false, hasLmDraft: false, hasUserEdits: false },
      };

      const prevActionItems = draft.actionItems && typeof draft.actionItems === "object" ? draft.actionItems : {};
      draft.actionItems = {
        proposed: {
          id: "ai_proposed_" + nowIso(),
          text: "",
          approved: false,
          hasLmDraft: false,
          hasUserEdits: false,
        },
        approved: [],
        completed: [],
      };

      draft.sharedHarmony = [];

      draft.ui = {
        ...prevUi,
        activeActivity: { type: "IDLE", artifactId: null, topicIndex: null, actionItemId: null },
        inferenceError: null,
        inferencePending: false,
        editingArtifactId: null,
        transitionPhase: null,
        transitionChoice: null,
        undisputedGateModalOpen: false,
        accordSetup: { ...(prevUi.accordSetup || {}), status: "idle", sharedResourceId: null, sharedResourceLink: "", errorMessage: "" },
      };

      return draft;
    }

    if (moveType === "START_ACCORD_STAGE") {
      if (!draft.case) return draft;
      const prevUi = draft.ui && typeof draft.ui === "object" ? draft.ui : {};
      const setup = prevUi.accordSetup || {};
      const resourceId = setup.sharedResourceId ? String(setup.sharedResourceId) : "";
      const filename =
        setup.sharedResourceFilename && typeof setup.sharedResourceFilename === "string"
          ? setup.sharedResourceFilename
          : resourceId
            ? "accord_shared_playfield." + resourceId + ".md"
            : "accord_shared.md";
      const seedContent =
        typeof setup.seedContent === "string" && setup.seedContent.trim() ? setup.seedContent.trim() : (draft.case.narrative || "");

      if (!resourceId || !seedContent.trim()) return draft;

      draft.case = {
        ...draft.case,
        mode: "ACCORD",
      };

      draft.stages = [
        { id: "preparing", name: "Preparing", currentStage: true },
        { id: "opening", name: "Opening", currentStage: false },
        { id: "exposing", name: "Exposing", currentStage: false },
        { id: "reframing", name: "Reframing", currentStage: false },
        { id: "proposing", name: "Proposing", currentStage: false },
        { id: "resoluting", name: "Resoluting", currentStage: false },
      ];

      draft.sharedHarmony = [
        {
          id: "shared_" + resourceId,
          resourceId,
          title: filename,
          card: {
            id: "shared_card_" + resourceId,
            text: seedContent,
            approved: false, // awaiting approvals in Accord
            hasLmDraft: true,
            hasUserEdits: false,
          },
        },
      ];

      draft.ui = {
        ...prevUi,
        activeActivity: { type: "IDLE", artifactId: null, topicIndex: null, actionItemId: null },
        transitionPhase: null,
        transitionChoice: null,
        undisputedGateModalOpen: false,
      };

      return draft;
    }

    if (moveType === "EXTERNAL_ARTIFACT_DISCOVERED") {
      const title = (payload && payload.title && String(payload.title).trim()) || "meeting_with_client.md";
      const content = (payload && payload.content && String(payload.content)) || "";
      const narrative = content;
      const firstLine = narrative.split(/\r?\n/)[0] || "";
      const words = firstLine.trim().split(/\s+/).slice(0, 4);
      const l1Title = words.length ? words.join(" ") : "LEXIOM DEMO CASE";
      const caseIntent =
        payload && typeof payload.caseIntent === "string" ? payload.caseIntent.trim() : "";

      draft.case = {
        id: "case_lexiom_demo_1",
        gameRecordId: newLexiomGameRecordId(),
        l1_title: l1Title,
        l1_summary: "",
        l1_card: {
          id: "l1_card",
          text: "",
          approved: false,
          hasLmDraft: false,
          hasUserEdits: false,
        },
        narrative,
        mode: "ZENITH",
        goals_draft_text: "",
        goals_draft_approved: false,
        strategy_draft_text: "",
        strategy_draft_approved: false,
        undisputed_draft_text: "",
        undisputed_draft_approved: false,
        l2_questions_label: "",
        case_intent: caseIntent,
      };

      draft.stages = [
        { id: "zenith", name: "ZENITH", currentStage: true },
      ];

      draft.l2_topics = getDefaultL2Topics();
      draft.l3_ribbon = ["Clarify expectations", "Surface constraints", "Propose step"];

      draft.actionItems = {
        proposed: {
          id: "ai_proposed_1",
          text: "draft (seeded from case narrative).",
          approved: false,
          hasLmDraft: true,
          hasUserEdits: false,
        },
        approved: [],
        completed: [],
      };

      draft.sharedHarmony = [];

      draft.privateArtifacts = [
        {
          id: "artifact_meeting_with_client",
          title,
          originActionItemId: null,
          card: {
            id: "artifact_meeting_with_client_card",
            text: narrative,
            approved: false,
            hasLmDraft: true,
            hasUserEdits: false,
          },
        },
      ];

      draft.threads = {
        l2Threads: {},
        actionItemThreads: {},
      };

      draft.l23_cards = {
        "0": {
          text: "",
          approved: false,
          hasLmDraft: false,
          hasUserEdits: false,
        },
      };

      draft.ui = {
        activeActivity: {
          type: "IDLE",
          artifactId: null,
        },
        inferenceError: null,
        inferencePending: false,
        editingArtifactId: null,
        transitionPhase: null,
        transitionChoice: null,
        undisputedGateModalOpen: false,
        undisputedGateModalItems: [],
        accordSetup: {
          status: "idle",
          sharedResourceId: null,
          sharedResourceLink: "",
          errorMessage: "",
        },
      };
    } else if (moveType === "INIT_EMPTY_CASE") {
      // No seed file or empty seed: start a new empty case.
      draft.case = {
        id: "case_new_1",
        gameRecordId: newLexiomGameRecordId(),
        l1_title: "- new case -",
        l1_summary: "",
        l1_card: {
          id: "l1_card",
          text: "",
          approved: false,
          hasLmDraft: false,
          hasUserEdits: false,
        },
        narrative: "",
        mode: "ZENITH",
        goals_draft_text: "",
        goals_draft_approved: false,
        strategy_draft_text: "",
        strategy_draft_approved: false,
        undisputed_draft_text: "",
        undisputed_draft_approved: false,
        l2_questions_label: "",
      };

      draft.stages = [
        { id: "zenith", name: "ZENITH", currentStage: true },
      ];

      draft.l2_topics = getDefaultL2Topics();
      draft.l3_ribbon = [];

      draft.actionItems = {
        proposed: null,
        approved: [],
        completed: [],
      };

      draft.sharedHarmony = [];
      draft.privateArtifacts = [];

      draft.threads = {
        l2Threads: {},
        actionItemThreads: {},
      };

      draft.l23_cards = {
        "0": {
          text: "",
          approved: false,
          hasLmDraft: false,
          hasUserEdits: false,
        },
      };

      draft.ui = {
        activeActivity: {
          type: "L1_DRAFT",
          artifactId: null,
          topicIndex: null,
          actionItemId: null,
        },
        inferenceError: null,
        inferencePending: false,
        editingArtifactId: null,
        transitionPhase: null,
        transitionChoice: null,
        undisputedGateModalOpen: false,
        undisputedGateModalItems: [],
        accordSetup: {
          status: "idle",
          sharedResourceId: null,
          sharedResourceLink: "",
          errorMessage: "",
        },
      };
    } else if (moveType === "SET_CASE_NARRATIVE_FROM_L1") {
      const narrative =
        payload && typeof payload.narrative === "string" ? payload.narrative.trim() : "";
      const title =
        payload && typeof payload.title === "string" ? payload.title.trim() : "user_seed.md";

      const prevCase =
        draft.case ||
        {
          id: "case_new_1",
          l1_title: "",
          l1_summary: "",
          l1_card: null,
          narrative: "",
          mode: "ZENITH",
        };

      draft.case = {
        ...prevCase,
        narrative,
      };

      const prevArtifacts = Array.isArray(draft.privateArtifacts)
        ? draft.privateArtifacts.slice()
        : [];

      if (prevArtifacts.length === 0 && narrative) {
        const newArtifactId = "artifact_seed_" + nowIso();
        prevArtifacts.push({
          id: newArtifactId,
          title: title || "user_seed.md",
          originActionItemId: null,
          card: {
            id: "card_" + newArtifactId,
            text: narrative,
            approved: true,
            hasLmDraft: true,
            hasUserEdits: false,
          },
        });
      }

      draft.privateArtifacts = prevArtifacts;
    } else if (moveType === "BOOTSTRAP_L1_FROM_GT3") {
      const title =
        payload && typeof payload.title === "string" ? payload.title.trim() : "";
      const summary =
        payload && typeof payload.summary === "string" ? payload.summary.trim() : "";
      if (!title) {
        return draft;
      }
      const prevCase = draft.case || {
        id: "case_lexiom_demo_1",
        l1_title: "",
        l1_summary: "",
        l1_card: null,
        narrative: "",
        mode: "ZENITH",
      };
      const prevCard =
        prevCase.l1_card || {
          id: "l1_card",
          text: "",
          approved: false,
          hasLmDraft: false,
          hasUserEdits: false,
        };
      draft.case = {
        ...prevCase,
        l1_title: title,
        l1_summary: summary,
        l1_card: {
          ...prevCard,
          text: title,
          approved: false,
          hasLmDraft: true,
          hasUserEdits: false,
        },
      };
    } else if (moveType === "REFRESH_L1_FROM_ARTIFACT_APPROVAL") {
      const title =
        payload && typeof payload.title === "string" ? payload.title.trim() : "";
      const summary =
        payload && typeof payload.summary === "string" ? payload.summary.trim() : "";
      if (!title) {
        return draft;
      }
      const prevCase = draft.case || {
        id: "case_lexiom_demo_1",
        l1_title: "",
        l1_summary: "",
        l1_card: null,
        narrative: "",
        mode: "ZENITH",
      };
      const prevCard =
        prevCase.l1_card || {
          id: "l1_card",
          text: "",
          approved: false,
          hasLmDraft: false,
          hasUserEdits: false,
        };
      draft.case = {
        ...prevCase,
        l1_title: title,
        l1_summary: summary,
        l1_card: {
          ...prevCard,
          text: title,
          approved: false,
          hasLmDraft: true,
          hasUserEdits: false,
        },
      };
      draft.ui = draft.ui || {};
      const { pendingL1RefreshFromArtifact: _drop, ...restUi } = draft.ui;
      draft.ui = restUi;
    } else if (moveType === "SET_L2_DRAFT_FROM_GT3") {
      const idx =
        payload && typeof payload.topicIndex === "number" ? payload.topicIndex : 0;
      const text =
        payload && typeof payload.text === "string" ? payload.text.trim() : "";
      if (!draft.case) {
        return draft;
      }
      const draftTopicKey = l2TopicKeyFromIndex(idx);
      if (draftTopicKey === "goals") {
        if (!draft.case.goals_draft_approved) {
          draft.case = {
            ...draft.case,
            goals_draft_text: text,
            // Fresh LM draft arrived; reset user-edit flag so glyph reflects current provenance.
            goals_draft_has_user_edits: false,
          };
        }
      } else if (draftTopicKey === "strategy") {
        if (!draft.case.strategy_draft_approved) {
          draft.case = {
            ...draft.case,
            strategy_draft_text: text,
            // Fresh LM draft arrived; reset user-edit flag so glyph reflects current provenance.
            strategy_draft_has_user_edits: false,
          };
        }
      } else if (draftTopicKey === "undisputed") {
        if (!draft.case.undisputed_draft_approved) {
          draft.case = {
            ...draft.case,
            undisputed_draft_text: text,
            // Fresh LM draft arrived; reset user-edit flag so glyph reflects current provenance.
            undisputed_draft_has_user_edits: false,
          };
        }
      }
    } else if (moveType === "UPDATE_L23A_FROM_GT3") {
      const text =
        payload && typeof payload.text === "string" ? payload.text : "";
      const cards = draft.l23_cards || { "0": { text: "", approved: false, hasLmDraft: false, hasUserEdits: false } };
      const card0 = cards["0"] || { text: "", approved: false, hasLmDraft: false, hasUserEdits: false };
      if (!card0.approved) {
        draft.l23_cards = {
          ...cards,
          "0": {
            ...card0,
            text: text.trim(),
            hasLmDraft: !!text.trim(),
          },
        };
      }
    } else if (moveType === "TOGGLE_L2_DRAFT_APPROVAL") {
      const idx =
        payload && typeof payload.topicIndex === "number" ? payload.topicIndex : 0;
      if (!draft.case) {
        return draft;
      }
      const approvalTopicKey = l2TopicKeyFromIndex(idx);
      const topics = Array.isArray(draft.l2_topics) ? draft.l2_topics.slice(0, 4) : [];
      const summarize = function (text) {
        if (!text) return "";
        const firstSentence = String(text).split(/[.!?]/)[0] || "";
        const words = firstSentence.trim().split(/\s+/).slice(0, 8);
        return words.join(" ");
      };
      if (approvalTopicKey === "goals") {
        const nextApproved = !draft.case.goals_draft_approved;
        const nextCase = {
          ...draft.case,
          goals_draft_approved: nextApproved,
        };
        draft.case = nextCase;
        if (nextApproved && topics.length >= 1) {
          const t0 = topics[0] || { l21: "Goals", l22: "" };
          topics[0] = {
            l21: t0.l21 || "Goals",
            l22: summarize(nextCase.goals_draft_text) || (t0.l22 || "Receive the full security deposit"),
          };
          draft.l2_topics = topics;
        }
      } else if (approvalTopicKey === "strategy") {
        const nextApproved = !draft.case.strategy_draft_approved;
        const nextCase = {
          ...draft.case,
          strategy_draft_approved: nextApproved,
        };
        draft.case = nextCase;
        if (nextApproved && topics.length >= 2) {
          const t1 = topics[1] || { l21: "Strategy", l22: "" };
          topics[1] = {
            l21: t1.l21 || "Strategy",
            l22: summarize(nextCase.strategy_draft_text) || (t1.l22 || "Path to resolution"),
          };
          draft.l2_topics = topics;
        }
      }
    } else if (moveType === "SET_L2_QUESTIONS_LABEL") {
      const label =
        payload && typeof payload.label === "string" ? payload.label.trim() : "";
      if (!draft.case || !label) {
        return draft;
      }
      draft.case = {
        ...draft.case,
        l2_questions_label: label,
      }
    } else if (moveType === "BOOTSTRAP_ACTION_FROM_GT3") {
      const text =
        payload && typeof payload.text === "string" ? payload.text.trim() : "";
      if (!text) {
        return draft;
      }
      const prevActionItems = draft.actionItems || {
        proposed: null,
        approved: [],
        completed: [],
      };
      const prevProposed =
        prevActionItems.proposed || {
          id: "ai_proposed_1",
          text: "",
          approved: false,
          hasLmDraft: false,
          hasUserEdits: false,
        };
      draft.actionItems = {
        ...prevActionItems,
        proposed: {
          ...prevProposed,
          text,
          approved: false,
          hasLmDraft: true,
          hasUserEdits: false,
        },
      };
    } else if (moveType === "REFRESH_PROPOSED_ACTION_FROM_GT3") {
      const text =
        payload && typeof payload.text === "string" ? payload.text.trim() : "";
      if (text) {
        const prevActionItems = draft.actionItems || {
          proposed: null,
          approved: [],
          completed: [],
        };
        const prevProposed =
          prevActionItems.proposed || {
            id: "ai_proposed_1",
            text: "",
            approved: false,
            hasLmDraft: false,
            hasUserEdits: false,
          };
        draft.actionItems = {
          ...prevActionItems,
          proposed: {
            ...prevProposed,
            text,
            approved: false,
            hasLmDraft: true,
            hasUserEdits: false,
          },
        };
      }
    } else if (moveType === "BOOTSTRAP_L2_FROM_GT3") {
      const raw = payload && payload.topics;
      const defaultL2 = draft.l2_topics || getDefaultL2Topics();
      const toObj = (t, i) => {
        if (t && typeof t === "object" && t.l21 != null && t.l22 != null) return t;
        if (typeof t === "string") return { l21: defaultL2[i] && defaultL2[i].l21 || "Topic", l22: t.trim() || defaultL2[i] && defaultL2[i].l22 };
        return defaultL2[i] || { l21: "Topic", l22: "L2" + (i + 1) };
      };
      const arr = Array.isArray(raw) ? raw : [];
      draft.l2_topics = normalizeL2TopicsWithFixedL21([
        toObj(arr[0], 0),
        toObj(arr[1], 1),
        toObj(arr[2], 2),
        toObj(arr[3], 3),
      ]);
      draft.ui = draft.ui || {};
      const { pendingL2RefreshFromL1: _dropL2p, ...restUiL2 } = draft.ui;
      draft.ui = restUiL2;
    } else if (moveType === "REFRESH_L2_TOPICS_FROM_L1") {
      const merged = payload && payload.mergedTopics;
      const arr = Array.isArray(merged) ? merged : [];
      const defaultL2 = draft.l2_topics || getDefaultL2Topics();
      const toObj = (t, i) => {
        if (t && typeof t === "object" && t.l21 != null && t.l22 != null) return t;
        if (typeof t === "string") return { l21: defaultL2[i] && defaultL2[i].l21 || "Topic", l22: t.trim() || defaultL2[i] && defaultL2[i].l22 };
        return defaultL2[i] || { l21: "Topic", l22: "L2" + (i + 1) };
      };
      if (arr.length >= 4) {
        draft.l2_topics = normalizeL2TopicsWithFixedL21([
          toObj(arr[0], 0),
          toObj(arr[1], 1),
          toObj(arr[2], 2),
          toObj(arr[3], 3),
        ]);
      }
      draft.ui = draft.ui || {};
      const { pendingL2RefreshFromL1: _drop, ...restUi } = draft.ui;
      draft.ui = restUi;
    } else if (moveType === "REFRESH_L22_FROM_APPROVED_DRAFT") {
      const topicIndex = payload && typeof payload.topicIndex === "number" ? payload.topicIndex : 0;
      const summary = payload && typeof payload.summary === "string" ? payload.summary.trim() : "";
      if (summary && draft.l2_topics && Array.isArray(draft.l2_topics) && topicIndex >= 0 && topicIndex < draft.l2_topics.length) {
        draft.l2_topics = normalizeL2TopicsWithFixedL21(
          draft.l2_topics.map(function (t, i) {
            if (i !== topicIndex) return t;
            return t && typeof t === "object"
              ? { ...t, l22: summary }
              : { l21: "Topic", l22: summary };
          })
        );
      }
      const prevUi = draft.ui && typeof draft.ui === "object" ? draft.ui : {};
      const { pendingL22RefreshFromApprovedDraft: _dropL22, ...restUi } = prevUi;
      draft.ui = restUi;
    } else if (moveType === "BOOTSTRAP_L3_FROM_GT3") {
      const raw = payload && payload.labels;
      const arr = Array.isArray(raw) ? raw : (typeof raw === "string" ? [raw] : []);
      const labels = arr.slice(0, 3).map((l) => (l != null ? String(l).trim() : "")).filter(Boolean);
      const defaultL3 = draft.l3_ribbon || ["Clarify expectations", "Surface constraints", "Propose step"];
      draft.l3_ribbon = [
        labels[0] || defaultL3[0] || "Move 1",
        labels[1] || defaultL3[1] || "Move 2",
        labels[2] || defaultL3[2] || "Move 3",
      ];
    } else if (moveType === "NAVIGATE_ACTIVITY") {
      const next = (payload && payload.activity) || "IDLE";
      const artifactId = payload && payload.artifactId ? String(payload.artifactId) : null;
      const topicIndex =
        typeof (payload && payload.topicIndex) === "number" ? payload.topicIndex : null;
      const actionItemId =
        payload && payload.actionItemId ? String(payload.actionItemId) : null;

      // If navigating into L1 draft and card text is empty, clone the current L1 title
      // into the L1 Draft Card for editing/approval.
      if (next === "L1_DRAFT" && draft.case) {
        const prevCard = draft.case.l1_card || {
          id: "l1_card",
          text: "",
          approved: false,
          hasLmDraft: false,
          hasUserEdits: false,
        };
        const cardText = (prevCard.text || "").trim();
        if (!cardText && draft.case.l1_title) {
          draft.case = {
            ...draft.case,
            l1_card: {
              ...prevCard,
              text: draft.case.l1_title,
              // Seed as LM-only draft until user edits/approves
              hasLmDraft: true,
            },
          };
        }
      }

      const prevUi = draft.ui && typeof draft.ui === "object" ? draft.ui : {};
      draft.ui = {
        ...prevUi,
        inferenceError: null,
        activeActivity: {
          type: next,
          artifactId,
          topicIndex,
          actionItemId,
        },
      };
    } else if (moveType === "EDIT_DRAFT") {
      const kind = payload && payload.kind;
      const artifactId = payload && payload.artifactId ? String(payload.artifactId) : null;
      const nextText = payload && typeof payload.text === "string" ? payload.text : "";

      function applyEdit(card) {
        if (!card) return card;
        const prevText = typeof card.text === "string" ? card.text : "";
        const changed = prevText !== nextText;
        const updated = {
          ...card,
          text: nextText,
          hasUserEdits: true,
        };
        if (changed && card.approved) {
          updated.approved = false;
        }
        return updated;
      }

      if (kind === "L1" && draft.case && draft.case.l1_card) {
        draft.case = {
          ...draft.case,
          l1_card: applyEdit(draft.case.l1_card),
        };
      } else if (kind === "ACTION_DRAFT" && draft.actionItems && draft.actionItems.proposed) {
        draft.actionItems = {
          ...draft.actionItems,
          proposed: applyEdit(draft.actionItems.proposed),
        };
      } else if (kind === "DOC_DRAFT" && Array.isArray(draft.privateArtifacts)) {
        draft.privateArtifacts = draft.privateArtifacts.map((artifact) => {
          if (!artifact || artifact.id !== artifactId || !artifact.card) return artifact;
          return {
            ...artifact,
            card: applyEdit(artifact.card),
          };
        });
      } else if (kind === "SHARED_DOC_DRAFT" && Array.isArray(draft.sharedHarmony)) {
        draft.sharedHarmony = draft.sharedHarmony.map((shared) => {
          if (!shared || shared.id !== artifactId || !shared.card) return shared;
          return {
            ...shared,
            card: applyEdit(shared.card),
          };
        });
      } else if (kind === "L2_GOALS") {
        if (!draft.case) return draft;
        const prevText = typeof draft.case.goals_draft_text === "string" ? draft.case.goals_draft_text : "";
        const changed = prevText !== nextText;
        draft.case = {
          ...draft.case,
          goals_draft_text: nextText,
          goals_draft_approved: changed ? false : draft.case.goals_draft_approved,
          goals_draft_has_user_edits: changed ? true : !!draft.case.goals_draft_has_user_edits,
        };
      } else if (kind === "L2_STRATEGY") {
        if (!draft.case) return draft;
        const prevText = typeof draft.case.strategy_draft_text === "string" ? draft.case.strategy_draft_text : "";
        const changed = prevText !== nextText;
        draft.case = {
          ...draft.case,
          strategy_draft_text: nextText,
          strategy_draft_approved: changed ? false : draft.case.strategy_draft_approved,
          strategy_draft_has_user_edits: changed ? true : !!draft.case.strategy_draft_has_user_edits,
        };
      } else if (kind === "L2_UNDISPUTED") {
        if (!draft.case) return draft;
        const prevText = typeof draft.case.undisputed_draft_text === "string" ? draft.case.undisputed_draft_text : "";
        const changed = prevText !== nextText;
        draft.case = {
          ...draft.case,
          undisputed_draft_text: nextText,
          undisputed_draft_approved: changed ? false : draft.case.undisputed_draft_approved,
          undisputed_draft_has_user_edits: changed ? true : !!draft.case.undisputed_draft_has_user_edits,
        };
      } else if (kind === "L23A") {
        const cards = draft.l23_cards || { "0": { text: "", approved: false, hasLmDraft: false, hasUserEdits: false } };
        const card0 = cards["0"] || { text: "", approved: false, hasLmDraft: false, hasUserEdits: false };
        const prevText = typeof card0.text === "string" ? card0.text : "";
        const changed = prevText !== nextText;
        draft.l23_cards = {
          ...cards,
          "0": {
            ...card0,
            text: nextText,
            hasUserEdits: true,
            approved: changed ? false : card0.approved,
          },
        };
      }
    } else if (moveType === "TOGGLE_APPROVAL") {
      const kind = payload && payload.kind;
      const artifactId = payload && payload.artifactId ? String(payload.artifactId) : null;

      if (kind === "L1" && draft.case && draft.case.l1_card) {
        const card = draft.case.l1_card;
        const nextApproved = !card.approved;
        draft.case = {
          ...draft.case,
          l1_card: {
            ...card,
            approved: nextApproved,
          },
          l1_title: nextApproved && (card.text || "").trim()
            ? String((card.text || "").trim())
            : draft.case.l1_title,
        };
      } else if (kind === "ACTION_DRAFT" && draft.actionItems && draft.actionItems.proposed) {
        const prevCard = draft.actionItems.proposed;
        const wasApproved = !!prevCard.approved;
        const nextApprovedFlag = !wasApproved;

        let nextProposed = {
          ...prevCard,
          approved: nextApprovedFlag,
        };

        let nextApprovedList = Array.isArray(draft.actionItems.approved)
          ? draft.actionItems.approved.slice()
          : [];

        // Rising edge: proposed → approved list, then reset proposed slot.
        // Artifact creation is deferred to the AI-bus listener in Black phase (proposed_action_item_has_been_accepted).
        if (!wasApproved && nextApprovedFlag) {
          const text = (prevCard.text || "").trim();
          if (text) {
            const approvedItemId = prevCard.id || "ai_" + nowIso();
            const approvedItem = {
              id: approvedItemId,
              text,
              progress: 0,
              completed: false,
              linkedArtifactId: null,
            };
            nextApprovedList = nextApprovedList.concat(approvedItem);
          }

          nextProposed = {
            id: "ai_proposed_" + nowIso(),
            text: "",
            approved: false,
            hasLmDraft: false,
            hasUserEdits: false,
          };
        }

        draft.actionItems = {
          ...draft.actionItems,
          proposed: nextProposed,
          approved: nextApprovedList,
        };
      } else if (kind === "DOC_DRAFT" && Array.isArray(draft.privateArtifacts)) {
        draft.privateArtifacts = draft.privateArtifacts.map((artifact) => {
          if (!artifact || artifact.id !== artifactId || !artifact.card) return artifact;

          const prevCard = artifact.card;
          const wasApproved = !!prevCard.approved;
          const nextApproved = !wasApproved;

          const nextArtifact = {
            ...artifact,
            card: {
              ...prevCard,
              approved: nextApproved,
            },
            gt3ArtifactFileUrl: nextApproved
              ? !wasApproved
                ? null
                : artifact.gt3ArtifactFileUrl
              : null,
            gt3ArtifactSharePortalUrl: nextApproved
              ? !wasApproved
                ? null
                : artifact.gt3ArtifactSharePortalUrl
              : null,
          };

          // Rising edge: document just became approved; mark linked action item completed.
          if (
            !wasApproved &&
            nextApproved &&
            artifact.originActionItemId &&
            draft.actionItems &&
            Array.isArray(draft.actionItems.approved)
          ) {
            draft.actionItems = {
              ...draft.actionItems,
              approved: draft.actionItems.approved.map((ai) => {
                if (!ai || String(ai.id) !== String(artifact.originActionItemId)) {
                  return ai;
                }
                return {
                  ...ai,
                  completed: true,
                  progress: 100,
                };
              }),
            };
          }

          return nextArtifact;
        });
      } else if (kind === "SHARED_DOC_DRAFT" && Array.isArray(draft.sharedHarmony)) {
        draft.sharedHarmony = draft.sharedHarmony.map((shared) => {
          if (!shared || shared.id !== artifactId || !shared.card) return shared;
          const prevCard = shared.card;
          const wasApproved = !!prevCard.approved;
          const nextApproved = !wasApproved;
          return {
            ...shared,
            card: {
              ...prevCard,
              approved: nextApproved,
            },
            gt3ArtifactFileUrl: nextApproved
              ? !wasApproved
                ? null
                : shared.gt3ArtifactFileUrl
              : null,
            gt3ArtifactSharePortalUrl: nextApproved
              ? !wasApproved
                ? null
                : shared.gt3ArtifactSharePortalUrl
              : null,
          };
        });
      } else if (kind === "L2_GOALS") {
        if (!draft.case) return draft;
        const nextApproved = !draft.case.goals_draft_approved;
        draft.case = {
          ...draft.case,
          goals_draft_approved: nextApproved,
        };
      } else if (kind === "L2_STRATEGY") {
        if (!draft.case) return draft;
        const nextApproved = !draft.case.strategy_draft_approved;
        draft.case = {
          ...draft.case,
          strategy_draft_approved: nextApproved,
        };
      } else if (kind === "L2_UNDISPUTED") {
        if (!draft.case) return draft;
        const nextApproved = !draft.case.undisputed_draft_approved;
        draft.case = {
          ...draft.case,
          undisputed_draft_approved: nextApproved,
        };
      } else if (kind === "L23A") {
        const cards = draft.l23_cards || { "0": { text: "", approved: false, hasLmDraft: false, hasUserEdits: false } };
        const card0 = cards["0"] || { text: "", approved: false, hasLmDraft: false, hasUserEdits: false };
        draft.l23_cards = {
          ...cards,
          "0": {
            ...card0,
            approved: !card0.approved,
          },
        };
      }
    } else if (moveType === "APPEND_CHAT_MESSAGE") {
      const contextType = payload && payload.contextType;
      const text =
        payload && typeof payload.text === "string" ? payload.text.trim() : "";
      if (!text) {
        return draft;
      }

      const message = {
        id: "msg_" + nowIso(),
        role: "user",
        text,
        timestamp: nowIso(),
      };

      const prevThreads =
        draft.threads && typeof draft.threads === "object"
          ? draft.threads
          : { l2Threads: {}, actionItemThreads: {} };

      const nextThreads = {
        l2Threads: { ...(prevThreads.l2Threads || {}) },
        actionItemThreads: { ...(prevThreads.actionItemThreads || {}) },
      };

      if (contextType === "L2") {
        const topicIndex =
          typeof payload.topicIndex === "number" ? payload.topicIndex : 0;
        const key = String(topicIndex);
        const existing = Array.isArray(nextThreads.l2Threads[key])
          ? nextThreads.l2Threads[key]
          : [];
        nextThreads.l2Threads[key] = existing.concat(message);
      } else if (contextType === "ACTION_ITEM") {
        const actionItemId =
          payload && payload.actionItemId ? String(payload.actionItemId) : null;
        if (actionItemId) {
          const key = actionItemId;
          const existing = Array.isArray(nextThreads.actionItemThreads[key])
            ? nextThreads.actionItemThreads[key]
            : [];
          nextThreads.actionItemThreads[key] = existing.concat(message);
        }
      }

      draft.threads = nextThreads;
    } else if (moveType === "APPEND_ASSISTANT_MESSAGE") {
      const contextType = payload && payload.contextType;
      const text =
        payload && typeof payload.text === "string" ? payload.text.trim() : "";
      if (!text) {
        return draft;
      }

      const message = {
        id: "msg_" + nowIso(),
        role: "assistant",
        text,
        timestamp: nowIso(),
      };

      const prevThreads =
        draft.threads && typeof draft.threads === "object"
          ? draft.threads
          : { l2Threads: {}, actionItemThreads: {} };

      const nextThreads = {
        l2Threads: { ...(prevThreads.l2Threads || {}) },
        actionItemThreads: { ...(prevThreads.actionItemThreads || {}) },
      };

      if (contextType === "L2") {
        const topicIndex =
          typeof payload.topicIndex === "number" ? payload.topicIndex : 0;
        const key = String(topicIndex);
        const existing = Array.isArray(nextThreads.l2Threads[key])
          ? nextThreads.l2Threads[key]
          : [];
        nextThreads.l2Threads[key] = existing.concat(message);
      } else if (contextType === "ACTION_ITEM") {
        const actionItemId =
          payload && payload.actionItemId ? String(payload.actionItemId) : null;
        if (actionItemId) {
          const key = actionItemId;
          const existing = Array.isArray(nextThreads.actionItemThreads[key])
            ? nextThreads.actionItemThreads[key]
            : [];
          nextThreads.actionItemThreads[key] = existing.concat(message);
        }
      }

      draft.threads = nextThreads;

      const prevUi = draft.ui && typeof draft.ui === "object" ? draft.ui : {};
      draft.ui = {
        ...prevUi,
        inferencePending: false,
        inferenceError: null,
      };
    } else if (moveType === "SET_INFERENCE_PENDING") {
      const prevUi = draft.ui && typeof draft.ui === "object" ? draft.ui : {};
      draft.ui = {
        ...prevUi,
        inferencePending: true,
        inferenceError: null,
      };
    } else if (moveType === "SET_INFERENCE_ERROR") {
      const prevUi = draft.ui && typeof draft.ui === "object" ? draft.ui : {};
      const message =
        payload && typeof payload.message === "string"
          ? payload.message
          : "GT3 inference failed";
      draft.ui = {
        ...prevUi,
        inferencePending: false,
        inferenceError: message,
      };
    } else if (moveType === "CLEAR_INFERENCE_UI") {
      const prevUi = draft.ui && typeof draft.ui === "object" ? draft.ui : {};
      draft.ui = {
        ...prevUi,
        inferencePending: false,
        inferenceError: null,
      };
    } else if (moveType === "CLEAR_PENDING_UI") {
      const key = payload && payload.key;
      if (key && draft.ui && typeof draft.ui === "object") {
        const { [key]: _drop, ...restUi } = draft.ui;
        draft.ui = restUi;
      }
    } else if (moveType === "SET_EDITING_DRAFT") {
      const prevUi = draft.ui && typeof draft.ui === "object" ? draft.ui : {};
      const artifactId = payload && payload.artifactId != null ? String(payload.artifactId) : null;
      draft.ui = { ...prevUi, editingArtifactId: artifactId || null };
    } else if (moveType === "APPEND_ARTIFACT_FROM_ACTION") {
      const actionItemId = payload && payload.actionItemId ? String(payload.actionItemId) : null;
      let inferredTitle = payload && typeof payload.inferredTitle === "string" ? payload.inferredTitle.trim() : "";
      if (!inferredTitle) inferredTitle = "action_item.md";
      if (!inferredTitle.endsWith(".md")) inferredTitle = inferredTitle + ".md";
      const inferredContent = payload && typeof payload.inferredContent === "string" ? payload.inferredContent.trim() : "";
      const hasInferredContent = inferredContent.length > 0;

      const prevUi = draft.ui && typeof draft.ui === "object" ? draft.ui : {};
      draft.ui = { ...prevUi, pendingArtifactForAction: undefined };

      if (actionItemId && draft.actionItems && Array.isArray(draft.actionItems.approved)) {
        const prevArtifacts = Array.isArray(draft.privateArtifacts) ? draft.privateArtifacts : [];
        const existingForAction = prevArtifacts.find(
          (a) => a && String(a.originActionItemId) === String(actionItemId)
        );

        if (existingForAction) {
          // Ensure the approved action item still points at the existing artifact.
          draft.actionItems = {
            ...draft.actionItems,
            approved: draft.actionItems.approved.map((ai) => {
              if (!ai || String(ai.id) !== String(actionItemId)) return ai;
              return { ...ai, linkedArtifactId: existingForAction.id };
            }),
          };
        } else {
          const newArtifactId = "artifact_action_" + nowIso();
          draft.privateArtifacts = prevArtifacts.concat({
            id: newArtifactId,
            title: inferredTitle,
            originActionItemId: actionItemId,
            card: {
              id: "card_" + newArtifactId,
              text: inferredContent,
              approved: false,
              hasLmDraft: hasInferredContent,
              hasUserEdits: false,
            },
          });
          draft.actionItems = {
            ...draft.actionItems,
            approved: draft.actionItems.approved.map((ai) => {
              if (!ai || String(ai.id) !== String(actionItemId)) return ai;
              return { ...ai, linkedArtifactId: newArtifactId };
            }),
          };
        }
      }
    }

    return draft;
  }

  /**
   * Reducer for BLACK_RUN phase.
   */
  function reduceStateForBlack(draft, moveType, payload) {
    if (moveType === "SET_ARTIFACT_GT3_FILE_URL") {
      return draft;
    }
    const prevUi = draft.ui && typeof draft.ui === "object" ? draft.ui : {};

    // AI-bus listener: right-panel private section will create artifact after GT3 infers filename.
    // Defer creation; set pending so dispatchWhiteMove can run GT3 and then APPEND_ARTIFACT_FROM_ACTION.
    const aiBusEvent = payload && payload.aiBusEvent;
    if (aiBusEvent) {
      if (aiBusEvent.type === "proposed_action_item_has_been_accepted") {
        const expression = aiBusEvent.payload || {};
        const actionItemId = expression.actionItemId;
        const text = expression.text || "";
        if (actionItemId) {
          draft.ui = {
            ...prevUi,
            pendingArtifactForAction: { actionItemId, text },
          };
        }
      } else if (aiBusEvent.type === "l3_click") {
        const expression = aiBusEvent.payload || {};
        const l3Index = typeof expression.l3Index === "number" ? expression.l3Index : -1;
        const label = typeof expression.label === "string" ? expression.label : "";
        draft.ui = {
          ...prevUi,
          lastL3Click: { l3Index, label },
        };
      } else if (aiBusEvent.type === "artifact_draft_approved") {
        const expression = aiBusEvent.payload || {};
        const artifactId = expression.artifactId;
        const title = expression.title || "";
        const narrative = expression.narrative || "";
        if (artifactId) {
          draft.ui = {
            ...prevUi,
            pendingL1RefreshFromArtifact: { artifactId, title, narrative },
          };
        }
      } else if (aiBusEvent.type === "l1_changed") {
        const expression = aiBusEvent.payload || {};
        const title = expression.title || "";
        const summary = expression.summary || "";
        // Seed bootstrap already runs a dedicated L2 pipeline (BOOTSTRAP_L2_FROM_GT3); do not queue
        // pendingL2RefreshFromL1 or every subsequent move re-triggers L2_REFRESH until pending clears.
        if (title && moveType !== "BOOTSTRAP_L1_FROM_GT3") {
          draft.ui = {
            ...prevUi,
            pendingL2RefreshFromL1: { title, summary },
          };
        }
      }
    }

    // When draft-first (goals/strategy/disputes/undisputed) is approved, mark pending L22 refresh for GT3 inference.
    if (moveType === "TOGGLE_APPROVAL" && payload && draft.case) {
      const kind = payload.kind;
      if (kind === "L2_GOALS" && draft.case.goals_draft_approved) {
        draft.ui = {
          ...(draft.ui || {}),
          pendingL22RefreshFromApprovedDraft: { topicIndex: l2IndexFromTopicKey("goals") },
        };
      } else if (kind === "L2_STRATEGY" && draft.case.strategy_draft_approved) {
        draft.ui = {
          ...(draft.ui || {}),
          pendingL22RefreshFromApprovedDraft: { topicIndex: l2IndexFromTopicKey("strategy") },
        };
      } else if (kind === "L23A") {
        const cards = draft.l23_cards || {};
        const card0 = cards["0"] || {};
        if (card0.approved) {
          draft.ui = {
            ...(draft.ui || {}),
            pendingL22RefreshFromApprovedDraft: { topicIndex: l2IndexFromTopicKey("tensions") },
          };
        }
      } else if (kind === "L2_UNDISPUTED" && draft.case.undisputed_draft_approved) {
        draft.ui = {
          ...(draft.ui || {}),
          pendingL22RefreshFromApprovedDraft: { topicIndex: l2IndexFromTopicKey("undisputed") },
        };
      }
    }

    const isInferenceMove = moveType === "COMMIT_INFERENCE" || moveType === "TOGGLE_APPROVAL";
    const result = payload && payload.inferenceResult;

    if (isInferenceMove && result) {
      if (result.ok) {
        const text = result.text;
        if (text && typeof text === "string") {
          const active = draft.ui && draft.ui.activeActivity ? draft.ui.activeActivity : { type: "IDLE", artifactId: null };
          const nextText = String(text).trim();

          function applyInferenceResult(card) {
            if (!card) return card;
            return {
              ...card,
              text: nextText,
              hasLmDraft: true,
              hasUserEdits: false,
              approved: false,
            };
          }

          if (active.type === "L1_DRAFT" && draft.case && draft.case.l1_card) {
            draft.case = { ...draft.case, l1_card: applyInferenceResult(draft.case.l1_card) };
          } else if (active.type === "ACTION_DRAFT" && draft.actionItems && draft.actionItems.proposed) {
            draft.actionItems = {
              ...draft.actionItems,
              proposed: applyInferenceResult(draft.actionItems.proposed),
            };
          } else if (active.type === "DOC_DRAFT" && Array.isArray(draft.privateArtifacts)) {
            const aid = active.artifactId || (draft.privateArtifacts[0] && draft.privateArtifacts[0].id);
            draft.privateArtifacts = draft.privateArtifacts.map((artifact) => {
              if (!artifact || artifact.id !== aid || !artifact.card) return artifact;
              return { ...artifact, card: applyInferenceResult(artifact.card) };
            });
          }
        }
        draft.ui = { ...prevUi, inferenceError: null, inferencePending: false };
      } else {
        draft.ui = {
          ...prevUi,
          inferenceError: result.error || "GT3 inference failed",
          inferencePending: false,
        };
      }
    }
    return draft;
  }

  function renderApp() {
    const state = getState();
    if (!state) return;

    noteGradualRevealCenterProgress(state);
    renderTopHud(state);
    renderLeftPanel(state);
    renderCenterPlayfield(state);
    renderRightPanel(state);
    renderRoundTransitionOverlay(state);
    renderUndisputedGateModal(state);
    renderBottomRibbon(state);
    applyGradualCockpitReveal(state);
  }

  function renderUndisputedGateModal(state) {
    const modal = document.getElementById("lexiom-undisputed-gate-modal");
    const listEl = document.getElementById("lexiom-undisputed-gate-list");
    if (!modal || !listEl) return;
    const ui = state && state.ui ? state.ui : {};
    const open = !!ui.undisputedGateModalOpen;
    const items = Array.isArray(ui.undisputedGateModalItems) ? ui.undisputedGateModalItems : [];
    modal.hidden = !open;
    if (!open) return;

    listEl.innerHTML = "";
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "lexiom-center-idle";
      empty.textContent = "No undisputed narratives available yet. Open L24d, review, then approve.";
      listEl.appendChild(empty);
      return;
    }
    items.forEach(function (item, idx) {
      const line = document.createElement("div");
      line.className = "lexiom-undisputed-gate-item";
      line.textContent = String(idx + 1) + ". " + item;
      listEl.appendChild(line);
    });
  }

  function renderRoundTransitionOverlay(state) {
    const overlay = document.getElementById("lexiom-round-transition");
    const mainWrap = document.getElementById("lexiom-main-wrap");
    const overlayContent = document.getElementById("lexiom-transition-overlay-content");
    if (!overlay) return;

    const ui = state.ui && typeof state.ui === "object" ? state.ui : {};
    const phase = ui.transitionPhase || null;
    const thinkingVisible = isThinkingTransitionVisible();

    // Toggle cockpit visibility.
    if (mainWrap) {
      if (phase) mainWrap.classList.add("lexiom-transitioning");
      else mainWrap.classList.remove("lexiom-transitioning");
    }

    const visible = !!phase || thinkingVisible;
    overlay.hidden = !visible;
    if (visible) overlay.classList.add("visible");
    else overlay.classList.remove("visible");
    overlay.classList.toggle("lexiom-thinking-scope", thinkingVisible);
    if (overlayContent) {
      overlayContent.classList.toggle("lexiom-thinking-mode", thinkingVisible);
      if (!thinkingVisible) {
        overlayContent.style.left = "";
        overlayContent.style.top = "";
        overlayContent.style.width = "";
        overlayContent.style.height = "";
        overlayContent.style.backgroundColor = "";
        overlayContent.style.backgroundImage = "";
      }
    }

    if (!visible) return;

    const transitory = document.getElementById("lexiom-transition-screen-transitory");
    const selection = document.getElementById("lexiom-transition-screen-selection");
    const accordPositioning = document.getElementById("lexiom-transition-screen-accord-positioning");
    const zenithInstr = document.getElementById("lexiom-transition-screen-instructions-zenith");
    const accordInstr = document.getElementById("lexiom-transition-screen-instructions-accord");
    const thinkingScreen = document.getElementById("lexiom-transition-screen-thinking");
    const thinkingWord = document.getElementById("lexiom-transition-thinking-word");

    const transitoryImg = document.getElementById("lexiom-transition-transitory-image");

    function hide(el) {
      if (el) el.hidden = true;
    }
    function show(el) {
      if (el) el.hidden = false;
    }

    const isAccordWizard =
      phase === "SELECTION" || phase === "ACCORD_POSITIONING" || phase === "INSTRUCTIONS_ACCORD";

    hide(transitory);
    hide(zenithInstr);
    hide(thinkingScreen);

    if (thinkingVisible) {
      const centerPlayfield = document.getElementById("lexiom-center-playfield");
      show(thinkingScreen);
      if (overlayContent && centerPlayfield) {
        const rect = centerPlayfield.getBoundingClientRect();
        const centerStyle = window.getComputedStyle(centerPlayfield);
        overlayContent.style.left = Math.round(rect.left) + "px";
        overlayContent.style.top = Math.round(rect.top) + "px";
        overlayContent.style.width = Math.round(rect.width) + "px";
        overlayContent.style.height = Math.round(rect.height) + "px";
        overlayContent.style.backgroundColor = centerStyle.backgroundColor || "";
        overlayContent.style.backgroundImage = centerStyle.backgroundImage || "";
      }
      if (thinkingWord) {
        const runId = String(thinkingTransitionRunId);
        if (thinkingWord.getAttribute("data-thinking-run") !== runId) {
          thinkingWord.setAttribute("data-thinking-run", runId);
          thinkingWord.classList.remove("lexiom-thinking-word-full", "lexiom-thinking-word-short");
          thinkingWord.style.animation = "none";
          // Force reflow so animation restart takes effect.
          // eslint-disable-next-line no-unused-expressions
          thinkingWord.offsetHeight;
          thinkingWord.classList.add(
            thinkingTransitionMode === "short"
              ? "lexiom-thinking-word-short"
              : "lexiom-thinking-word-full"
          );
          thinkingWord.style.animation = "";
        }
        const playfieldWidth =
          overlayContent && overlayContent.clientWidth ? overlayContent.clientWidth : 0;
        const targetWordWidth = playfieldWidth > 0 ? playfieldWidth * 0.5 : 0; // 25% breathing room each side.
        if (targetWordWidth > 0) {
          thinkingWord.style.width = Math.round(targetWordWidth) + "px";
          let px = Math.max(24, Math.round(playfieldWidth * 0.11));
          thinkingWord.style.fontSize = px + "px";
          while (px > 24 && thinkingWord.scrollWidth > targetWordWidth) {
            px -= 1;
            thinkingWord.style.fontSize = px + "px";
          }
        }
      }
      hide(selection);
      hide(accordPositioning);
      hide(accordInstr);
      return;
    }

    if (!isAccordWizard) {
      hide(selection);
      hide(accordPositioning);
      hide(accordInstr);
    } else {
      // Reserve the slots for equal-height panels, even when a panel is "closed".
      if (selection) selection.hidden = false;
      if (accordPositioning) accordPositioning.hidden = false;
      if (accordInstr) accordInstr.hidden = false;

      if (selection) selection.classList.toggle("lexiom-transition-panel-disabled", phase !== "SELECTION");
      if (accordPositioning) accordPositioning.classList.toggle("lexiom-transition-panel-inactive", phase === "SELECTION");
      if (accordInstr) accordInstr.classList.toggle("lexiom-transition-panel-inactive", phase !== "INSTRUCTIONS_ACCORD");
    }

    if (phase !== "TRANSITORY_1") {
      lastTransitoryAnimationPhase = null;
    }
    if (phase === "TRANSITORY_1") {
      show(transitory);
      if (transitoryImg && lastTransitoryAnimationPhase !== "TRANSITORY_1") {
        lastTransitoryAnimationPhase = "TRANSITORY_1";
        transitoryImg.style.animation = "none";
        // Force reflow so animation restart takes effect.
        // eslint-disable-next-line no-unused-expressions
        transitoryImg.offsetHeight;
        transitoryImg.style.animation = "";
      }
    } else if (phase === "INSTRUCTIONS_ZENITH") {
      show(zenithInstr);
    }

    // Upper panel feedback/lock (next-round choice).
    if (phase === "SELECTION" || phase === "ACCORD_POSITIONING" || phase === "INSTRUCTIONS_ACCORD" || phase === "INSTRUCTIONS_ZENITH") {
      const btnZenith = document.getElementById("lexiom-transition-btn-zenith");
      const btnAccord = document.getElementById("lexiom-transition-btn-accord");
      const choice = ui && ui.transitionChoice ? String(ui.transitionChoice) : null;
      const choiceLocked = !!choice;

      if (btnZenith) {
        btnZenith.classList.toggle("lexiom-active", choice === "ZENITH");
        btnZenith.disabled = choiceLocked;
      }
      if (btnAccord) {
        btnAccord.classList.toggle("lexiom-active", choice === "ACCORD");
        btnAccord.disabled = choiceLocked;
      }
    }

    // Visual selection feedback (middle panel).
    if (phase === "ACCORD_POSITIONING" || phase === "INSTRUCTIONS_ACCORD") {
      const pol = ui.accordSetup ? ui.accordSetup.recipientPolarity : null;
      const ch = ui.accordSetup ? ui.accordSetup.recipientChannel : null;
      const framingLocked = !!(pol && ch);

      const btnDirectAlly = document.getElementById("lexiom-transition-accord-pos-direct-ally");
      const btnMediatedAlly = document.getElementById("lexiom-transition-accord-pos-mediated-ally");
      const btnDirectFoe = document.getElementById("lexiom-transition-accord-pos-direct-foe");
      const btnMediatedFoe = document.getElementById("lexiom-transition-accord-pos-mediated-foe");

      if (btnDirectAlly) {
        btnDirectAlly.classList.toggle("lexiom-active", String(pol).toUpperCase() === "ALLY" && String(ch).toUpperCase() === "DIRECT");
        btnDirectAlly.disabled = framingLocked;
      }
      if (btnMediatedAlly) {
        btnMediatedAlly.classList.toggle("lexiom-active", String(pol).toUpperCase() === "ALLY" && String(ch).toUpperCase() === "MEDIATED");
        btnMediatedAlly.disabled = framingLocked;
      }
      if (btnDirectFoe) {
        btnDirectFoe.classList.toggle("lexiom-active", String(pol).toUpperCase() === "FOE" && String(ch).toUpperCase() === "DIRECT");
        btnDirectFoe.disabled = framingLocked;
      }
      if (btnMediatedFoe) {
        btnMediatedFoe.classList.toggle("lexiom-active", String(pol).toUpperCase() === "FOE" && String(ch).toUpperCase() === "MEDIATED");
        btnMediatedFoe.disabled = framingLocked;
      }
    }

    // Accord link UI updates.
    if (phase === "INSTRUCTIONS_ACCORD") {
      const linkValueEl = document.getElementById("lexiom-transition-accord-link-value");
      const copyBtn = document.getElementById("lexiom-transition-accord-btn-copy");
      const mailtoBtn = document.getElementById("lexiom-transition-accord-btn-mailto");
      const enterAccordBtn = document.getElementById("lexiom-transition-btn-enter-accord");
      const errEl = document.getElementById("lexiom-transition-accord-error");

      if (linkValueEl) {
        const setup = ui.accordSetup || null;
        const link = setup && typeof setup.sharedResourceLink === "string" ? setup.sharedResourceLink : "";
        linkValueEl.textContent = link || "Creating link...";
      }
      if (copyBtn) {
        const setup = ui.accordSetup || null;
        const link = setup && typeof setup.sharedResourceLink === "string" ? setup.sharedResourceLink : "";
        copyBtn.hidden = !link;
      }
      if (mailtoBtn) {
        const setup = ui.accordSetup || null;
        const link = setup && typeof setup.sharedResourceLink === "string" ? setup.sharedResourceLink : "";
        const polarityRaw = setup && setup.recipientPolarity ? String(setup.recipientPolarity) : "ALLY";
        const channelRaw = setup && setup.recipientChannel ? String(setup.recipientChannel) : "DIRECT";
        const polarityLabel = polarityRaw.toUpperCase() === "FOE" ? "foe" : "ally";
        const channelLabel = channelRaw.toUpperCase() === "MEDIATED" ? "mediated" : "direct";

        const subject = "Lexiom Accord shared case seed (" + polarityLabel + " / " + channelLabel + ")";
        const body = [
          "Hi,",
          "",
          "Here is the Lexiom Accord shared case seed narrative for our negotiation.",
          "",
          "Lexiom Accord cockpit:",
          // Keep the URL on its own line for maximum auto-link reliability.
          link,
          "",
          "Framing selected:",
          polarityLabel + " / " + channelLabel,
          "",
          "Shared narrative:",
          "This email is an invitation to open the proposed shared Accord narrative in the Lexiom link above (review, edit, and approve together).",
          "",
          "When ready, open the shared link to review/edit/approve the accord items.",
        ].join("\n");

        const href = link
          ? ("mailto:?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body))
          : "#";

        mailtoBtn.hidden = !link;
        mailtoBtn.href = href;
      }
      if (enterAccordBtn) {
        const setup = ui.accordSetup || null;
        const link = setup && typeof setup.sharedResourceLink === "string" ? setup.sharedResourceLink : "";
        const linkActionTaken = !!(setup && setup.linkActionTaken);
        enterAccordBtn.hidden = !(link && linkActionTaken);
      }
      if (errEl) {
        const setup = ui.accordSetup || null;
        const err = setup && typeof setup.errorMessage === "string" ? setup.errorMessage : "";
        errEl.textContent = err || "";
        errEl.hidden = !err;
      }
    }

    // Bind overlay UI handlers once.
    if (!transitionHandlersBound) {
      const btnZenith = document.getElementById("lexiom-transition-btn-zenith");
      const btnAccord = document.getElementById("lexiom-transition-btn-accord");
        const btnAccordPosDirectAlly = document.getElementById("lexiom-transition-accord-pos-direct-ally");
        const btnAccordPosMediatedAlly = document.getElementById("lexiom-transition-accord-pos-mediated-ally");
        const btnAccordPosDirectFoe = document.getElementById("lexiom-transition-accord-pos-direct-foe");
        const btnAccordPosMediatedFoe = document.getElementById("lexiom-transition-accord-pos-mediated-foe");
        const btnAccordPositioningContinue = document.getElementById("lexiom-transition-btn-accord-positioning-continue");
      const btnBeginZenith = document.getElementById("lexiom-transition-btn-begin-zenith");
      const btnEnterAccord = document.getElementById("lexiom-transition-btn-enter-accord");
      const btnCopy = document.getElementById("lexiom-transition-accord-btn-copy");
      const btnMailto = document.getElementById("lexiom-transition-accord-btn-mailto");
      const undisputedApproveBtn = document.getElementById("lexiom-undisputed-gate-approve");
      const undisputedCloseBtn = document.getElementById("lexiom-undisputed-gate-close");

      if (btnZenith) {
        btnZenith.onclick = function onZenithSelect() {
          const st = getState();
          const existingChoice = st && st.ui && st.ui.transitionChoice ? String(st.ui.transitionChoice) : null;
          if (existingChoice) return;
          dispatchWhiteMove("SELECT_NEXT_ROUND", { choice: "ZENITH" }, { activity: "TRANSITION_SELECT" });
        };
      }
      if (btnAccord) {
        btnAccord.onclick = function onAccordSelect() {
          const st = getState();
          const existingChoice = st && st.ui && st.ui.transitionChoice ? String(st.ui.transitionChoice) : null;
          if (existingChoice) return;
          dispatchWhiteMove("SELECT_NEXT_ROUND", { choice: "ACCORD" }, { activity: "TRANSITION_SELECT" });
        };
      }

      // Accord positioning option selection.
      if (btnAccordPosDirectAlly) {
        btnAccordPosDirectAlly.onclick = function onPosDirectAlly() {
          const st = getState();
          const setup = st && st.ui && st.ui.accordSetup ? st.ui.accordSetup : {};
          if (setup && setup.recipientPolarity && setup.recipientChannel) return;
          dispatchWhiteMove(
            "SET_ACCORD_RECIPIENT_POSITIONING",
            { polarity: "ALLY", channel: "DIRECT" },
            { activity: "ACCORD_POSITIONING_SELECT" }
          );
          // Locate the selected middle-panel button after click.
          setTimeout(function () {
            try {
              if (btnAccordPosDirectAlly) {
                btnAccordPosDirectAlly.scrollIntoView({ block: "nearest" });
                btnAccordPosDirectAlly.focus();
              }
            } catch (e) {}
          }, 0);
          dispatchWhiteMove(
            "SET_TRANSITION_PHASE",
            { phase: "INSTRUCTIONS_ACCORD" },
            { activity: "ACCORD_POSITIONING_AUTO_CONTINUE" }
          );
        };
      }
      if (btnAccordPosMediatedAlly) {
        btnAccordPosMediatedAlly.onclick = function onPosMediatedAlly() {
          const st = getState();
          const setup = st && st.ui && st.ui.accordSetup ? st.ui.accordSetup : {};
          if (setup && setup.recipientPolarity && setup.recipientChannel) return;
          dispatchWhiteMove(
            "SET_ACCORD_RECIPIENT_POSITIONING",
            { polarity: "ALLY", channel: "MEDIATED" },
            { activity: "ACCORD_POSITIONING_SELECT" }
          );
          setTimeout(function () {
            try {
              if (btnAccordPosMediatedAlly) {
                btnAccordPosMediatedAlly.scrollIntoView({ block: "nearest" });
                btnAccordPosMediatedAlly.focus();
              }
            } catch (e) {}
          }, 0);
          dispatchWhiteMove(
            "SET_TRANSITION_PHASE",
            { phase: "INSTRUCTIONS_ACCORD" },
            { activity: "ACCORD_POSITIONING_AUTO_CONTINUE" }
          );
        };
      }
      if (btnAccordPosDirectFoe) {
        btnAccordPosDirectFoe.onclick = function onPosDirectFoe() {
          const st = getState();
          const setup = st && st.ui && st.ui.accordSetup ? st.ui.accordSetup : {};
          if (setup && setup.recipientPolarity && setup.recipientChannel) return;
          dispatchWhiteMove(
            "SET_ACCORD_RECIPIENT_POSITIONING",
            { polarity: "FOE", channel: "DIRECT" },
            { activity: "ACCORD_POSITIONING_SELECT" }
          );
          setTimeout(function () {
            try {
              if (btnAccordPosDirectFoe) {
                btnAccordPosDirectFoe.scrollIntoView({ block: "nearest" });
                btnAccordPosDirectFoe.focus();
              }
            } catch (e) {}
          }, 0);
          dispatchWhiteMove(
            "SET_TRANSITION_PHASE",
            { phase: "INSTRUCTIONS_ACCORD" },
            { activity: "ACCORD_POSITIONING_AUTO_CONTINUE" }
          );
        };
      }
      if (btnAccordPosMediatedFoe) {
        btnAccordPosMediatedFoe.onclick = function onPosMediatedFoe() {
          const st = getState();
          const setup = st && st.ui && st.ui.accordSetup ? st.ui.accordSetup : {};
          if (setup && setup.recipientPolarity && setup.recipientChannel) return;
          dispatchWhiteMove(
            "SET_ACCORD_RECIPIENT_POSITIONING",
            { polarity: "FOE", channel: "MEDIATED" },
            { activity: "ACCORD_POSITIONING_SELECT" }
          );
          setTimeout(function () {
            try {
              if (btnAccordPosMediatedFoe) {
                btnAccordPosMediatedFoe.scrollIntoView({ block: "nearest" });
                btnAccordPosMediatedFoe.focus();
              }
            } catch (e) {}
          }, 0);
          dispatchWhiteMove(
            "SET_TRANSITION_PHASE",
            { phase: "INSTRUCTIONS_ACCORD" },
            { activity: "ACCORD_POSITIONING_AUTO_CONTINUE" }
          );
        };
      }

      // "Continue to Accord Stage" intentionally disabled: entering Accord is automatic
      // right after selecting one of the 4 ally/foe x direct/mediated options.

      if (btnBeginZenith) {
        btnBeginZenith.onclick = function onBeginZenith() {
          const st = getState();
          const seed = st && st.case && typeof st.case.narrative === "string" ? st.case.narrative : "";
          dispatchWhiteMove("START_NEXT_ZENITH_ROUND", {}, { activity: "TRANSITION_START_ZENITH_2" });
          homeRunTransitionInFlight = false;
          // Refresh proposed action + L2/L3 for the next rehearsal round.
          if (seed && typeof refreshRoundFromSeedNarrative === "function") {
            refreshRoundFromSeedNarrative(seed);
          }
        };
      }
      if (btnEnterAccord) {
        btnEnterAccord.onclick = function onEnterAccord() {
          const st = getState();
          const setup = st && st.ui && st.ui.accordSetup ? st.ui.accordSetup : {};
          if (!setup || setup.status !== "ready") {
            const errEl = document.getElementById("lexiom-transition-accord-error");
            if (errEl) {
              errEl.textContent = "Shared link is not ready yet.";
              errEl.hidden = false;
            }
            return;
          }
          dispatchWhiteMove("START_ACCORD_STAGE", {}, { activity: "TRANSITION_START_ACCORD" });
          homeRunTransitionInFlight = false;
        };
      }
      if (btnCopy) {
        btnCopy.onclick = function onCopyLink() {
          const st = getState();
          const setup = st && st.ui && st.ui.accordSetup ? st.ui.accordSetup : {};
          const link = setup && typeof setup.sharedResourceLink === "string" ? setup.sharedResourceLink : "";
          if (!link) return;
          dispatchWhiteMove(
            "SET_ACCORD_LINK_ACTION_USED",
            {},
            { activity: "ACCORD_LINK_ACTION_COPY" }
          );
          if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
            navigator.clipboard.writeText(link).catch(function () {});
          }
        };
      }
      if (btnMailto) {
        btnMailto.onclick = function onMailtoLink() {
          const st = getState();
          const setup = st && st.ui && st.ui.accordSetup ? st.ui.accordSetup : {};
          const link = setup && typeof setup.sharedResourceLink === "string" ? setup.sharedResourceLink : "";
          if (!link) return;
          dispatchWhiteMove(
            "SET_ACCORD_LINK_ACTION_USED",
            {},
            { activity: "ACCORD_LINK_ACTION_MAILTO" }
          );
        };
      }
      if (undisputedApproveBtn) {
        undisputedApproveBtn.onclick = function onApproveUndisputedNow() {
          const st = getState();
          const caseObj = st && st.case ? st.case : {};
          const hasText = typeof caseObj.undisputed_draft_text === "string" && caseObj.undisputed_draft_text.trim().length > 0;
          if (hasText && !caseObj.undisputed_draft_approved) {
            dispatchWhiteMove(
              "TOGGLE_APPROVAL",
              { kind: "L2_UNDISPUTED" },
              { activity: "UNDISPUTED_GATE_APPROVE" }
            );
          }
          dispatchWhiteMove("CLOSE_UNDISPUTED_GATE_MODAL", {}, { activity: "UNDISPUTED_GATE_CLOSE" });
        };
      }
      if (undisputedCloseBtn) {
        undisputedCloseBtn.onclick = function onCloseUndisputedGate() {
          dispatchWhiteMove("CLOSE_UNDISPUTED_GATE_MODAL", {}, { activity: "UNDISPUTED_GATE_CLOSE" });
        };
      }

      transitionHandlersBound = true;
    }

    // When entering Accord instructions, create the shared markdown resource server-side (no client GT3 key).
    if (phase === "INSTRUCTIONS_ACCORD") {
      const setup = ui.accordSetup || {};
      const status = setup && setup.status ? setup.status : "idle";
      if (status === "idle" && !accordSharedCreateInFlight) {
        accordSharedCreateInFlight = true;
        const recipientPolarity = setup && setup.recipientPolarity ? setup.recipientPolarity : "ALLY";
        const recipientChannel = setup && setup.recipientChannel ? setup.recipientChannel : "DIRECT";

        const fallbackSeedContent = buildAccordSharedSeedContent(state);
        let effectiveSeedContent = fallbackSeedContent;

        inferAccordSharedSeedContent(state, recipientPolarity, recipientChannel)
          .then(function (seedContent) {
            const nextSeed = seedContent && typeof seedContent === "string" && seedContent.trim() ? seedContent.trim() : fallbackSeedContent;
            effectiveSeedContent = nextSeed;
            return fetch("/lexiom/accord/create", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ seedContent: effectiveSeedContent })
            });
          })
          .then(function (resp) {
            if (!resp.ok) return resp.json().then(function (d) { throw new Error(d && d.detail ? d.detail : "accord create failed"); });
            return resp.json();
          })
          .then(function (data) {
            const resourceId = data && data.resourceId ? String(data.resourceId) : "";
            const filename = data && data.filename ? String(data.filename) : "";
            const shareLink = data && data.shareLink ? String(data.shareLink) : "";

            dispatchWhiteMove(
              "SET_ACCORD_SHARED_RESOURCE",
              { resourceId, filename, shareLink, seedContent: effectiveSeedContent },
              { activity: "ACCORD_SHARED_RESOURCE_CREATED" }
            );
          })
          .catch(function (e) {
            const errEl = document.getElementById("lexiom-transition-accord-error");
            if (errEl) {
              errEl.textContent = String(e && e.message ? e.message : e);
              errEl.hidden = false;
            }
            dispatchWhiteMove(
              "SET_ACCORD_SHARED_RESOURCE",
              { resourceId: "", filename: "", shareLink: "", seedContent: effectiveSeedContent },
              { activity: "ACCORD_SHARED_RESOURCE_ERROR" }
            );
          })
          .finally(function () {
            accordSharedCreateInFlight = false;
          });
      }
    }
  }

  function renderTopHud(state) {
    const l1El = document.getElementById("lexiom-top-hud-l1");
    const l2El = document.getElementById("lexiom-top-hud-l2");
    if (!l1El || !l2El) return;

    const t = window.lexiomI18n && window.lexiomI18n.t ? window.lexiomI18n.t : function (k) { return k; };
    const l1Title = state.case && state.case.l1_title ? state.case.l1_title : t("lexiom_case");
    const l1Summary = state.case && state.case.l1_summary ? state.case.l1_summary : "";
    l1El.innerHTML = "";
    const line1 = document.createElement("div");
    line1.className = "lexiom-l1-title";
    line1.textContent = l1Title;
    l1El.appendChild(line1);
    if (l1Summary) {
      const line2 = document.createElement("div");
      line2.className = "lexiom-l1-summary";
      line2.textContent = l1Summary;
      l1El.appendChild(line2);
    }
    l1El.classList.add("lexiom-clickable");

    const active =
      state.ui && state.ui.activeActivity
        ? state.ui.activeActivity
        : { type: "IDLE", artifactId: null, topicIndex: null, actionItemId: null };
    if (active.type === "L1_DRAFT") {
      l1El.classList.add("lexiom-active");
    } else {
      l1El.classList.remove("lexiom-active");
    }

    l1El.onclick = function onL1Click() {
      dispatchWhiteMove(
        "NAVIGATE_ACTIVITY",
        { activity: "L1_DRAFT" },
        { activity: "L1_DRAFT" }
      );
    };

    const gradualCockpit = isGradualCockpitEnabled();
    const revealM = gradualCockpit ? computeCockpitRevealMilestones(state) : null;
    const l2RevealKeys = ["l2a", "l2b", "l2c", "l2d"];

    l2El.innerHTML = "";
    (state.l2_topics || []).forEach((topic, index) => {
      const l21 = (topic && typeof topic === "object" && topic.l21) ? String(topic.l21) : (typeof topic === "string" ? topic : t("topic_n") + " " + (index + 1));
      const l22 = (topic && typeof topic === "object" && topic.l22) ? String(topic.l22) : "";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-sm lexiom-l2-btn lexiom-clickable";
      btn.innerHTML = "";
      const line1 = document.createElement("div");
      line1.className = "lexiom-l2-btn-l21";
      line1.textContent = l21 || "Topic";
      btn.appendChild(line1);
      if (l22) {
        const line2 = document.createElement("div");
        line2.className = "lexiom-l2-btn-l22";
        line2.textContent = l22;
        btn.appendChild(line2);
      }

      if (active.type === "L2_CHAT" && active.topicIndex === index) {
        btn.classList.add("lexiom-active");
      }

      btn.onclick = function onL2Click() {
        dispatchWhiteMove(
          "NAVIGATE_ACTIVITY",
          { activity: "L2_CHAT", topicIndex: index },
          { activity: "L2_CHAT", topicIndex: index }
        );
      };

      if (gradualCockpit && revealM) {
        const wrap = document.createElement("span");
        wrap.className =
          "lexiom-l2-btn-reveal " +
          (revealM[l2RevealKeys[index]] ? "lexiom-reveal-visible" : "lexiom-reveal-hidden");
        wrap.appendChild(btn);
        l2El.appendChild(wrap);
      } else {
        l2El.appendChild(btn);
      }
    });
  }

  function renderLeftPanel(state) {
    const stageTowerEl = document.getElementById("lexiom-stage-tower");
    const actionItemsEl = document.getElementById("lexiom-action-items");
    if (!stageTowerEl || !actionItemsEl) return;

    stageTowerEl.innerHTML = "";
    const stageLines = (state.stages || []).map((s) => (s.currentStage ? "> " + s.name : "  " + s.name));
    if (!stageLines.length) {
      stageLines.push("> ZENITH");
    }
    stageLines.forEach((lineText) => {
      const lineEl = document.createElement("div");
      lineEl.className = "lexiom-center-idle";
      lineEl.textContent = lineText;
      stageTowerEl.appendChild(lineEl);
    });

    actionItemsEl.innerHTML = "";
    const proposed = state.actionItems && state.actionItems.proposed;
    const approved = (state.actionItems && state.actionItems.approved) || [];

    const proposedTitle = document.createElement("div");
    proposedTitle.className = "lexiom-panel-title";
    const t = window.lexiomI18n && window.lexiomI18n.t ? window.lexiomI18n.t : function (k) { return k; };
    proposedTitle.textContent = t("proposed");
    actionItemsEl.appendChild(proposedTitle);

    const proposedBody = document.createElement("div");
    proposedBody.className = "lexiom-list-body lexiom-clickable";
    const proposedText =
      proposed && typeof proposed.text === "string"
        ? proposed.text.trim()
        : "";
    // Always show a single line starting with "> ".
    proposedBody.textContent = proposedText ? "> " + proposedText : "> ";

    const active =
      state.ui && state.ui.activeActivity
        ? state.ui.activeActivity
        : { type: "IDLE", artifactId: null, topicIndex: null, actionItemId: null };
    if (active.type === "ACTION_DRAFT") {
      proposedBody.classList.add("lexiom-active");
    }

    proposedBody.onclick = function onProposedClick() {
      dispatchWhiteMove(
        "NAVIGATE_ACTIVITY",
        { activity: "ACTION_DRAFT" },
        { activity: "ACTION_DRAFT" }
      );
    };
    actionItemsEl.appendChild(proposedBody);

    const approvedTitle = document.createElement("div");
    approvedTitle.className = "lexiom-panel-title mt-2";
    approvedTitle.textContent = t("actions");
    actionItemsEl.appendChild(approvedTitle);

    const approvedBody = document.createElement("div");
    approvedBody.className = "lexiom-list-body";
    if (!approved.length) {
      approvedBody.textContent = "?";
    } else {
      // Render latest-first: newest approved items at the top.
      const approvedLatestFirst = approved.slice().reverse();
      approvedLatestFirst.forEach((item) => {
        const line = document.createElement("div");
        line.className = "lexiom-clickable";

        const completed = !!item.completed;
        const rawProgress =
          typeof item.progress === "number" ? item.progress : 0;
        const clampedProgress = Math.max(
          0,
          Math.min(99, Math.floor(rawProgress))
        );
        const prefix = completed
          ? "<✓> "
          : "<" + String(clampedProgress).padStart(2, "0") + " %> ";

        line.textContent = prefix + (item.text || "");

        if (active.type === "ACTION_CHAT" && active.actionItemId === item.id) {
          line.classList.add("lexiom-active");
        }

        line.onclick = function onApprovedClick() {
          dispatchWhiteMove(
            "NAVIGATE_ACTIVITY",
            { activity: "ACTION_CHAT", actionItemId: item.id },
            { activity: "ACTION_CHAT", actionItemId: item.id }
          );
        };

        approvedBody.appendChild(line);
      });
    }
    actionItemsEl.appendChild(approvedBody);
  }

  function getDraftCardState(kind, state, artifactId) {
    if (!state) return null;
    if (kind === "L1") {
      return state.case && state.case.l1_card;
    }
    if (kind === "ACTION_DRAFT") {
      return state.actionItems && state.actionItems.proposed;
    }
    if (kind === "DOC_DRAFT") {
      const artifacts = state.privateArtifacts || [];
      const target = artifacts.find((a) => a.id === artifactId) || artifacts[0];
      return target && target.card;
    }
    if (kind === "SHARED_DOC_DRAFT") {
      const shared = state.sharedHarmony || [];
      const target = shared.find((a) => a && a.id === artifactId) || shared[0];
      return target && target.card ? target.card : null;
    }
     if (kind === "L2_GOALS") {
       const c = state.case || {};
       const text = c.goals_draft_text || "";
       return {
         text,
         approved: !!c.goals_draft_approved,
         hasLmDraft: !!text,
         hasUserEdits: !!c.goals_draft_has_user_edits,
       };
     }
     if (kind === "L23A") {
       const cards = state.l23_cards || {};
       const card = cards["0"] || { text: "", approved: false, hasLmDraft: false, hasUserEdits: false };
       return {
         text: typeof card.text === "string" ? card.text : "",
         approved: !!card.approved,
         hasLmDraft: !!card.hasLmDraft,
         hasUserEdits: !!card.hasUserEdits,
       };
     }
     if (kind === "L2_STRATEGY") {
       const c = state.case || {};
       const text = c.strategy_draft_text || "";
       return {
         text,
         approved: !!c.strategy_draft_approved,
         hasLmDraft: !!text,
         hasUserEdits: !!c.strategy_draft_has_user_edits,
       };
     }
     if (kind === "L2_UNDISPUTED") {
       const c = state.case || {};
       const text = c.undisputed_draft_text || "";
       return {
         text,
         approved: !!c.undisputed_draft_approved,
         hasLmDraft: !!text,
         hasUserEdits: !!c.undisputed_draft_has_user_edits,
       };
     }
    return null;
  }

  function getDraftCardLabel(kind, state, artifactId) {
    const t = window.lexiomI18n && window.lexiomI18n.t ? window.lexiomI18n.t : function (k) { return k; };
    if (kind === "L1") return t("case_identity");
    if (kind === "ACTION_DRAFT") return t("proposed");
    if (kind === "DOC_DRAFT") {
      const artifacts = (state && state.privateArtifacts) || [];
      const target = artifacts.find((a) => a.id === artifactId) || artifacts[0];
      if (target && target.title) return target.title;
      return t("document_draft");
    }
    if (kind === "SHARED_DOC_DRAFT") {
      const shared = (state && state.sharedHarmony) || [];
      const target = shared.find((a) => a && a.id === artifactId) || shared[0];
      if (target && target.title) return target.title;
      return t("shared_document_draft") || "shared_document_draft";
    }
    if (kind === "L23A") return t("l24_tensions_hint");
    if (kind === "L2_UNDISPUTED") return t("l24_undisputed_hint");
    if (kind === "L2_GOALS") return t("l24_goals_hint");
    if (kind === "L2_STRATEGY") return t("l24_strategy_hint");
    return t("draft");
  }

  function getGlyphForCard(card) {
    if (!card) return "";
    const text = (card.text || "").trim();
    if (!text) return "";
    if (card.approved) return "◯";
    if (card.hasLmDraft && card.hasUserEdits) return "◉";
    if (card.hasLmDraft) return "◯";
    return "●";
  }

  /** Parse L24a disputes text (format: "quote" — basis per line) into { quote, basis } items. */
  function parseDisputesItems(text) {
    const lines = (typeof text === "string" ? text : "").split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    const items = [];
    const re = /^"([^"]*)"\s*[—–\-]\s*(.*)$/;
    for (var i = 0; i < lines.length; i++) {
      const m = lines[i].match(re);
      if (m) {
        items.push({ quote: m[1] || "", basis: (m[2] || "").trim() });
      } else if (lines[i]) {
        items.push({ quote: "", basis: lines[i] });
      }
    }
    return items;
  }

  /** Escape HTML and wrap template placeholders in spans for artifact view. Placeholders: backtick-wrapped or [bracket]. */
  function artifactTextToHtmlWithPlaceholders(rawText) {
    const text = typeof rawText === "string" ? rawText : "";
    function escapeHtml(s) {
      return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }
    const parts = [];
    let lastEnd = 0;
    const re = /`([^`]+)`|\[([^\]]+)\]/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      parts.push(escapeHtml(text.slice(lastEnd, m.index)));
      const placeholderContent = m[1] != null ? m[1] : m[2];
      parts.push('<span class="lexiom-placeholder">' + escapeHtml(placeholderContent) + "</span>");
      lastEnd = re.lastIndex;
    }
    parts.push(escapeHtml(text.slice(lastEnd)));
    return parts.join("").replace(/\n/g, "<br>\n");
  }

  /** Bootstrap Icons "share" (MIT) — https://icons.getbootstrap.com/icons/share/ */
  const LEXIOM_BOOTSTRAP_SHARE_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="lexiom-artifact-share-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M13.5 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3M11 2.5a2.5 2.5 0 1 1 .603 1.628l-6.718 3.12a2.5 2.5 0 0 1 0 1.504l6.718 3.12a2.5 2.5 0 1 1-.488.876l-6.718-3.12a2.5 2.5 0 1 1 0-3.256l6.718-3.12A2.5 2.5 0 0 1 11 2.5m-8.5 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3m11 5.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3"/></svg>';

  function renderDraftCard(containerEl, kind, state, artifactId) {
    const card = getDraftCardState(kind, state, artifactId);
    const label = getDraftCardLabel(kind, state, artifactId);

    const wrapper = document.createElement("div");
    wrapper.className = "lexiom-draft-card";

    const header = document.createElement("div");
    header.className = "lexiom-draft-card-header";

    const glyphBtn = document.createElement("button");
    glyphBtn.type = "button";
    glyphBtn.className = "lexiom-draft-card-glyph";
    glyphBtn.textContent = getGlyphForCard(card);
    if (card && card.approved) {
      glyphBtn.classList.add("lexiom-draft-card-glyph-approved");
    }
    glyphBtn.onclick = function onGlyphClick() {
      dispatchWhiteMove(
        "TOGGLE_APPROVAL",
        { kind, artifactId: artifactId || null },
        { activity: kind, artifactId: artifactId || null }
      );
    };

    const labelSpan = document.createElement("span");
    labelSpan.className = "lexiom-draft-card-label";
    labelSpan.textContent = label;

    header.appendChild(labelSpan);
    header.appendChild(glyphBtn);

    const isDocDraft = kind === "DOC_DRAFT" || kind === "SHARED_DOC_DRAFT";
    const ui = state.ui && typeof state.ui === "object" ? state.ui : {};
    const rawText = card && card.text ? card.text : "";
    const isEditingThisArtifact = isDocDraft && (ui.editingArtifactId != null && String(ui.editingArtifactId) === String(artifactId));
    const showPlaceholderView = isDocDraft && !isEditingThisArtifact && rawText.length > 0;

    if (showPlaceholderView) {
      const viewDiv = document.createElement("div");
      viewDiv.className = "lexiom-draft-card-text lexiom-draft-card-view lexiom-clickable";
      viewDiv.innerHTML = artifactTextToHtmlWithPlaceholders(rawText);
      viewDiv.title = "Click to edit";
      viewDiv.onclick = function () {
        dispatchWhiteMove(
          "SET_EDITING_DRAFT",
          { artifactId: artifactId || null },
          { activity: kind, artifactId: artifactId || null }
        );
      };
      wrapper.appendChild(header);
      appendApprovedArtifactShareRow(wrapper, kind, state, artifactId);
      wrapper.appendChild(viewDiv);
    } else if (kind === "L23A" && rawText.trim() && card && card.approved) {
      const disputesView = document.createElement("div");
      disputesView.className = "lexiom-draft-card-text lexiom-disputes-formatted";
      const items = parseDisputesItems(rawText);
      items.forEach(function (item) {
        if (!item.quote && !item.basis) return;
        const itemEl = document.createElement("div");
        itemEl.className = "lexiom-dispute-item";
        if (item.quote) {
          const quoteEl = document.createElement("strong");
          quoteEl.textContent = "\"" + item.quote + "\"";
          itemEl.appendChild(quoteEl);
        }
        if (item.basis) {
          const basisEl = document.createElement("div");
          basisEl.className = "lexiom-dispute-basis";
          basisEl.textContent = item.basis;
          itemEl.appendChild(basisEl);
        }
        disputesView.appendChild(itemEl);
      });
      wrapper.appendChild(header);
      wrapper.appendChild(disputesView);
    } else if (kind === "L2_UNDISPUTED" && rawText.trim() && card && card.approved) {
      const undisputedView = document.createElement("div");
      undisputedView.className = "lexiom-draft-card-text lexiom-disputes-formatted";
      const items = parseDisputesItems(rawText);
      items.forEach(function (item) {
        if (!item.quote && !item.basis) return;
        const itemEl = document.createElement("div");
        itemEl.className = "lexiom-dispute-item";
        if (item.quote) {
          const quoteEl = document.createElement("strong");
          quoteEl.textContent = "\"" + item.quote + "\"";
          itemEl.appendChild(quoteEl);
        }
        if (item.basis) {
          const basisEl = document.createElement("div");
          basisEl.className = "lexiom-dispute-basis";
          basisEl.textContent = item.basis;
          itemEl.appendChild(basisEl);
        }
        undisputedView.appendChild(itemEl);
      });
      wrapper.appendChild(header);
      wrapper.appendChild(undisputedView);
    } else {
      const textarea = document.createElement("textarea");
      textarea.className = "lexiom-draft-card-text";
      textarea.value = card && card.text ? card.text : "";
      textarea.rows = 5; // default to approximately 5 lines of text

      // Auto-size the textarea vertically to fit its content.
      function autoSize(el) {
        if (!el) return;
        el.style.height = "auto";
        el.style.height = el.scrollHeight + "px";
      }
      autoSize(textarea);

      // When there is no seed narrative and the L1 draft is empty,
      // show a hint to type the initial case narrative or upload a seed file.
      if (
        kind === "L1" &&
        (!card || !card.text) &&
        state &&
        state.case &&
        !state.case.narrative
      ) {
        const t = window.lexiomI18n && window.lexiomI18n.t ? window.lexiomI18n.t : function (k) { return k; };
        textarea.placeholder = t("new_case_hint");
      }
      const textareaIdParts = ["lexiom-draft-text", kind];
      if (artifactId) {
        textareaIdParts.push(String(artifactId));
      } else {
        textareaIdParts.push("primary");
      }
      const textareaId = textareaIdParts.join("__");
      textarea.id = textareaId;

      if (isDocDraft) {
        textarea.addEventListener("blur", function () {
          // Defer decision to next paint ticks so input-driven rerender/refocus can settle.
          // If focus lands back on the same draft textarea, keep edit mode active.
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              const active = document.activeElement;
              const activeId = active && active.id ? String(active.id) : "";
              const shouldKeepEditing = activeId === textareaId;
              if (shouldKeepEditing) return;
              dispatchWhiteMove(
                "SET_EDITING_DRAFT",
                { artifactId: null },
                { activity: kind, artifactId: artifactId || null }
              );
            });
          });
        });
      }

      textarea.addEventListener("input", function onDraftInput() {
        const current = textarea.value || "";
        const wasFocused = document.activeElement === textarea;
        const selectionStart = textarea.selectionStart;
        const selectionEnd = textarea.selectionEnd;

        dispatchWhiteMove(
          "EDIT_DRAFT",
          { kind, artifactId: artifactId || null, text: current },
          { activity: kind, artifactId: artifactId || null }
        );

        if (wasFocused) {
          const newTextarea = document.getElementById(textareaId);
          if (newTextarea) {
            try {
              newTextarea.focus();
              if (typeof selectionStart === "number" && typeof selectionEnd === "number") {
                newTextarea.selectionStart = selectionStart;
                newTextarea.selectionEnd = selectionEnd;
              }
              autoSize(newTextarea);
            } catch (e) {
              // Ignore focus/selection errors.
            }
          }
        } else {
          autoSize(textarea);
        }
      });

      wrapper.appendChild(header);
      appendApprovedArtifactShareRow(wrapper, kind, state, artifactId);
      wrapper.appendChild(textarea);
    }

    containerEl.appendChild(wrapper);
  }

  function renderCenterPlayfield(state) {
    const centerEl = document.getElementById("lexiom-center-activity");
    const playfieldEl = document.getElementById("lexiom-center-playfield");
    if (!centerEl) return;
    // Clear existing content
    centerEl.innerHTML = "";

    const ui = state.ui && typeof state.ui === "object" ? state.ui : {};
    const inferenceError = ui.inferenceError;
    const inferencePending = ui.inferencePending;

    const active =
      state.ui && state.ui.activeActivity
        ? state.ui.activeActivity
        : { type: "IDLE", artifactId: null, topicIndex: null, actionItemId: null };

    if (inferenceError) {
      const banner = document.createElement("div");
      banner.className = "lexiom-error-banner";
      const t = window.lexiomI18n && window.lexiomI18n.t ? window.lexiomI18n.t : function (k) { return k; };
      banner.textContent = t("gt3_error_prefix") + " " + inferenceError;
      centerEl.appendChild(banner);
    }

    if (playfieldEl) {
      if (active.type !== "IDLE") {
        playfieldEl.classList.add("lexiom-center-playfield-active");
      } else {
        playfieldEl.classList.remove("lexiom-center-playfield-active");
      }
      if (active.type === "L2_CHAT" || active.type === "ACTION_CHAT") {
        playfieldEl.classList.add("lexiom-center-chat");
      } else {
        playfieldEl.classList.remove("lexiom-center-chat");
      }
    }

    if (active.type === "L1_DRAFT") {
      renderDraftCard(centerEl, "L1", state, null);
    } else if (active.type === "ACTION_DRAFT") {
      renderDraftCard(centerEl, "ACTION_DRAFT", state, null);
    } else if (active.type === "DOC_DRAFT") {
      renderDraftCard(centerEl, "DOC_DRAFT", state, active.artifactId || null);
    } else if (active.type === "SHARED_DOC_DRAFT") {
      renderDraftCard(centerEl, "SHARED_DOC_DRAFT", state, active.artifactId || null);
    } else if (active.type === "L2_CHAT" || active.type === "ACTION_CHAT") {
      renderChatActivity(centerEl, state, active);
    } else {
      const idle = document.createElement("div");
      idle.className = "lexiom-center-idle";
      const t = window.lexiomI18n && window.lexiomI18n.t ? window.lexiomI18n.t : function (k) { return k; };
      idle.textContent = t("center_idle");
      centerEl.appendChild(idle);
    }
  }

  function renderChatActivity(containerEl, state, active) {
    const t = window.lexiomI18n && window.lexiomI18n.t ? window.lexiomI18n.t : function (k) { return k; };
    const threads =
      state.threads && typeof state.threads === "object"
        ? state.threads
        : { l2Threads: {}, actionItemThreads: {} };

    let headerLabel = "";
    let l2TopicKeyForView = null;
    let messages = [];
    let contextType = null;
    let topicIndex = null;
    let actionItemId = null;

    if (active.type === "L2_CHAT") {
      const topics = state.l2_topics || [];
      topicIndex =
        typeof active.topicIndex === "number" ? active.topicIndex : 0;
      const t2 = topics[topicIndex];
      const topicKey = l2TopicKeyFromIndex(topicIndex);
      l2TopicKeyForView = topicKey;
      // L23 titles: Unlock Story (disputes), Unlock Intent (goals), Unlock Path (strategy), Unlock Accord (undisputed).
      headerLabel = t(L23_TITLE_KEYS[topicKey]) || (t2 && typeof t2 === "object" && t2.l21 && t2.l22
        ? t2.l21 + " — " + t2.l22
        : ((typeof t2 === "string" ? t2 : null) || t("topic_n") + " " + (topicIndex + 1)));
      const key = String(topicIndex);
      messages =
        (threads.l2Threads && threads.l2Threads[key]) || [];
      contextType = "L2";
    } else if (active.type === "ACTION_CHAT") {
      const approved =
        (state.actionItems && state.actionItems.approved) || [];
      const item = approved.find(
        (ai) => ai && ai.id === active.actionItemId
      );
      headerLabel =
        (item && item.text) || t("action_item_conv");
      actionItemId = item && item.id ? String(item.id) : null;
      const key = actionItemId || "";
      messages =
        (threads.actionItemThreads &&
          threads.actionItemThreads[key]) ||
        [];
      contextType = "ACTION_ITEM";
    } else {
      return;
    }

    // For L23b/L23c, once L24b/L24c is eligible to render, switch the center playfield
    // to draft-only mode (hide/unrender L23 chat UI).
    if (contextType === "L2" && (l2TopicKeyForView === "goals" || l2TopicKeyForView === "strategy")) {
      const userAnswerCountForDraftOnly = (messages || []).filter(function (m) { return m && m.role === "user"; }).length;
      const minRequiredForDraftOnly =
        L24_MIN_USER_ANSWERS[l2TopicKeyForView] != null ? L24_MIN_USER_ANSWERS[l2TopicKeyForView] : 0;
      if (userAnswerCountForDraftOnly >= minRequiredForDraftOnly) {
        if (l2TopicKeyForView === "goals") {
          renderDraftCard(containerEl, "L2_GOALS", state, null);
        } else {
          renderDraftCard(containerEl, "L2_STRATEGY", state, null);
        }
        return;
      }
    }

    // L23 = inquiry (chat). L24 = results (draft-first). Vertical order: chat on top, draft-first below.
    const header = document.createElement("div");
    header.className = "lexiom-panel-title lexiom-chat-header-title";
    header.textContent = (active.type === "L2_CHAT" ? "> " : "") + headerLabel;
    containerEl.appendChild(header);

  // Phase 2: L2a/L2d are card-only surfaces (no L23 chat composer/transcript).
  if (contextType === "L2" && (l2TopicKeyForView === "tensions" || l2TopicKeyForView === "undisputed")) {
    if (l2TopicKeyForView === "tensions") {
        renderDraftCard(containerEl, "L23A", state, null);
      } else {
        renderDraftCard(containerEl, "L2_UNDISPUTED", state, null);
      }
      return;
    }

    const transcript = document.createElement("div");
    transcript.className = "lexiom-chat-transcript";

    // L23 UI: show only the current Lexiom question (one question + textarea+send). No chat history in GUI.
    // Full chat collection remains in state (l2Threads/actionItemThreads) for L24 draft-first GT3 inference.
    var lastAssistant = null;
    for (var i = messages.length - 1; i >= 0; i--) {
      if (messages[i] && messages[i].role === "assistant") {
        lastAssistant = messages[i];
        break;
      }
    }
    if (lastAssistant && lastAssistant.text) {
      const line = document.createElement("div");
      line.className = "lexiom-chat-line";
      const raw = lastAssistant.text;
      const blankLineIdx = raw.indexOf("\n\n");
      const questionPart = (blankLineIdx >= 0 ? raw.slice(0, blankLineIdx) : raw).trim();
      const reflectionPart = blankLineIdx >= 0 ? raw.slice(blankLineIdx + 2).trim() : "";
      line.appendChild(document.createTextNode("Lexiom: "));
      const strong = document.createElement("strong");
      strong.textContent = questionPart;
      line.appendChild(strong);
      if (reflectionPart) {
        line.appendChild(document.createTextNode("\n\n" + reflectionPart));
      }
      transcript.appendChild(line);
    }

    const ui = state.ui && typeof state.ui === "object" ? state.ui : {};
    if (ui.inferencePending) {
      const typingLine = document.createElement("div");
      typingLine.className = "lexiom-chat-line lexiom-chat-typing";
      typingLine.textContent = t("typing");
      transcript.appendChild(typingLine);
    }

    containerEl.appendChild(transcript);

    const inputRow = document.createElement("div");
    inputRow.className = "lexiom-chat-input d-flex";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "lexiom-chat-input-field";
    input.placeholder = t("type_message_placeholder");

    const sendBtn = document.createElement("button");
    sendBtn.type = "button";
    sendBtn.className = "lexiom-chat-send-btn lexiom-clickable";
    sendBtn.textContent = t("send");

    function sendCurrentMessage() {
      const raw = input.value || "";
      const text = raw.trim();
      if (!text) return;

      const payload =
        contextType === "L2"
          ? {
              contextType: "L2",
              topicIndex: topicIndex != null ? topicIndex : 0,
              text,
            }
          : {
              contextType: "ACTION_ITEM",
              actionItemId,
              text,
            };

      dispatchWhiteMove(
        "APPEND_CHAT_MESSAGE",
        payload,
        {
          activity: active.type,
          topicIndex: topicIndex != null ? topicIndex : null,
          actionItemId: actionItemId || null,
        }
      );

      const callGT3Fn = window.lexiomGT3 && window.lexiomGT3.callGT3;

      // L2 chat: trigger GT3 inference via buildL2ChatNarrative (no 4-question phase).
      if (contextType === "L2") {
        const buildChatNarrative = window.lexiomBuildL2ChatNarrative || null;
        const buildGoalsDraftNarrative = window.lexiomBuildGoalsDraftNarrative || null;
        const buildStrategyDraftNarrative = window.lexiomBuildStrategyDraftNarrative || null;

        if (!callGT3Fn || !buildChatNarrative) {
          dispatchWhiteMove(
            "SET_INFERENCE_ERROR",
            { message: "GT3 chat client not configured" },
            { activity: active.type, topicIndex }
          );
        } else {
          const stateAfterUser = getState();
          const narrative = buildChatNarrative(stateAfterUser, topicIndex != null ? topicIndex : 0);

          dispatchWhiteMove(
            "SET_INFERENCE_PENDING",
            {},
            { activity: active.type, topicIndex }
          );

          callGT3Fn(narrative, { inferenceType: "L23" })
            .then(function (result) {
              if (result && result.ok && typeof result.text === "string") {
                const reply = String(result.text).trim().replace(/^[\d.)\-\s*]+/, "").trim();
                if (!reply) {
                  dispatchWhiteMove(
                    "SET_INFERENCE_ERROR",
                    { message: "GT3 chat returned empty reply" },
                    { activity: active.type, topicIndex }
                  );
                  return;
                }
                dispatchWhiteMove(
                  "APPEND_ASSISTANT_MESSAGE",
                  {
                    contextType: "L2",
                    topicIndex: topicIndex != null ? topicIndex : 0,
                    text: reply,
                  },
                  { activity: active.type, topicIndex }
                );

                // Post-L24a disputes analysis: re-calculate on every user answer (reducer applies only when card not approved).
                const ti = topicIndex != null ? topicIndex : 0;
                if (ti === 0) {
                  const latestState = getState();
                  const buildDisputes = window.lexiomBuildDisputesAnalysisNarrative;
                  if (callGT3Fn && buildDisputes) {
                    const disputesNarrative = buildDisputes(latestState);
                    if (disputesNarrative && typeof disputesNarrative === "string" && disputesNarrative.trim()) {
                      callGT3Fn(disputesNarrative, { inferenceType: "L24" })
                        .then(function (disputesResult) {
                          if (disputesResult && disputesResult.ok && typeof disputesResult.text === "string") {
                            const raw = String(disputesResult.text)
                              .split(/\r?\n/)
                              .map(function (s) { return s.replace(/^[\d.)\-\s*]+/, "").trim(); })
                              .filter(Boolean);
                            const text = raw.join("\n");
                            if (text) {
                              dispatchWhiteMove(
                                "UPDATE_L23A_FROM_GT3",
                                { text },
                                { activity: "L2_CHAT", topicIndex: 0 }
                              );
                            }
                          }
                        })
                        .catch(function () {
                          // Non-fatal
                        });
                    }
                  }
                }
              } else {
                const message =
                  (result && result.error) || "GT3 chat inference failed";
                dispatchWhiteMove(
                  "SET_INFERENCE_ERROR",
                  { message },
                  { activity: active.type, topicIndex }
                );
              }
            })
            .catch(function (err) {
              const message =
                (err && err.message) || String(err) || "GT3 chat error";
              dispatchWhiteMove(
                "SET_INFERENCE_ERROR",
                { message },
                { activity: active.type, topicIndex }
              );
            });

          // In parallel, re-calculate L24b/L24c/L24d on every user answer (reducers apply only when draft not approved).
          const topicKeyForDraft = l2TopicKeyFromIndex(topicIndex != null ? topicIndex : 0);
          const isGoalsOrStrategyOrUndisputed =
            topicKeyForDraft === "goals" ||
            topicKeyForDraft === "strategy" ||
            topicKeyForDraft === "undisputed";
          const buildUndisputedDraftNarrative = window.lexiomBuildUndisputedDraftNarrative || null;
          if (isGoalsOrStrategyOrUndisputed && callGT3Fn && (buildGoalsDraftNarrative || buildStrategyDraftNarrative || buildUndisputedDraftNarrative) && stateAfterUser.case) {
            const isGoals = topicKeyForDraft === "goals";
            const isStrategyDraft = topicKeyForDraft === "strategy";
            const isUndisputedDraft = topicKeyForDraft === "undisputed";
            const draftNarrative = isGoals
              ? (buildGoalsDraftNarrative && buildGoalsDraftNarrative(stateAfterUser, topicIndex != null ? topicIndex : 0))
              : (isStrategyDraft
                ? (buildStrategyDraftNarrative && buildStrategyDraftNarrative(stateAfterUser, topicIndex != null ? topicIndex : 0))
                : (buildUndisputedDraftNarrative && buildUndisputedDraftNarrative(stateAfterUser, topicIndex != null ? topicIndex : 3)));
            if (draftNarrative && typeof draftNarrative === "string" && draftNarrative.trim()) {
              callGT3Fn(draftNarrative, { inferenceType: "L24" })
                .then(function (draftResult) {
                  if (draftResult && draftResult.ok && typeof draftResult.text === "string") {
                    const draftText = String(draftResult.text).trim();
                    if (draftText) {
                      dispatchWhiteMove(
                        "SET_L2_DRAFT_FROM_GT3",
                        { topicIndex, text: draftText },
                        { activity: "L2_CHAT", topicIndex }
                      );
                    }
                  }
                })
                .catch(function () {
                  // Draft refresh failures are non-fatal; ignore.
                });
            }
          }
        }
      } else if (contextType === "ACTION_ITEM") {
        const buildActionNarrative =
          window.lexiomBuildActionItemChatNarrative || null;

        if (!callGT3Fn || !buildActionNarrative || !actionItemId) {
          dispatchWhiteMove(
            "SET_INFERENCE_ERROR",
            { message: "GT3 action-item chat not configured" },
            { activity: active.type, actionItemId }
          );
        } else {
          const stateAfterUser = getState();
          const narrative = buildActionNarrative(
            stateAfterUser,
            actionItemId
          );

          dispatchWhiteMove(
            "SET_INFERENCE_PENDING",
            {},
            { activity: active.type, actionItemId }
          );

          callGT3Fn(narrative, { inferenceType: "L23" })
            .then(function (result) {
              if (result && result.ok && typeof result.text === "string") {
                const reply = String(result.text).trim();
                if (!reply) {
                  dispatchWhiteMove(
                    "SET_INFERENCE_ERROR",
                    { message: "GT3 chat returned empty reply" },
                    { activity: active.type, actionItemId }
                  );
                  return;
                }
                dispatchWhiteMove(
                  "APPEND_ASSISTANT_MESSAGE",
                  {
                    contextType: "ACTION_ITEM",
                    actionItemId,
                    text: reply,
                  },
                  { activity: active.type, actionItemId }
                );
              } else {
                const message =
                  (result && result.error) || "GT3 chat inference failed";
                dispatchWhiteMove(
                  "SET_INFERENCE_ERROR",
                  { message },
                  { activity: active.type, actionItemId }
                );
              }
            })
            .catch(function (err) {
              const message =
                (err && err.message) || String(err) || "GT3 chat error";
              dispatchWhiteMove(
                "SET_INFERENCE_ERROR",
                { message },
                { activity: active.type, actionItemId }
              );
            });
        }
      }

      input.value = "";
    }

    input.addEventListener("keydown", function onKeyDown(ev) {
      if (ev.key === "Enter") {
        ev.preventDefault();
        sendCurrentMessage();
      }
    });

    sendBtn.addEventListener("click", function onSendClick() {
      sendCurrentMessage();
    });

    inputRow.appendChild(input);
    inputRow.appendChild(sendBtn);
    containerEl.appendChild(inputRow);

    // L24 = draft-first widget (semantic expression of chat results) — below the chat (L23)
    // Render only after enough L23 user answers (for goals/strategy/undisputed; tensions use card-only surface).
    if (active.type === "L2_CHAT") {
      const draftTopicKey = l2TopicKeyFromIndex(topicIndex);
      const userAnswerCount = (messages || []).filter(function (m) { return m && m.role === "user"; }).length;
      const minRequired = L24_MIN_USER_ANSWERS[draftTopicKey] != null ? L24_MIN_USER_ANSWERS[draftTopicKey] : 0;
      if (userAnswerCount >= minRequired) {
        if (draftTopicKey === "goals") {
          renderDraftCard(containerEl, "L2_GOALS", state, null);
        } else if (draftTopicKey === "strategy") {
          renderDraftCard(containerEl, "L2_STRATEGY", state, null);
        } else if (draftTopicKey === "undisputed") {
          renderDraftCard(containerEl, "L2_UNDISPUTED", state, null);
        }
      }
    }

    try {
      // Focus L23 chat textarea so the user can type their answer immediately without clicking or tabbing.
      input.focus();
    } catch (e) {
      // Ignore focus errors.
    }
  }

  /**
   * Build a cockpit URL that identifies this artifact for sharing (recipient / deep-link consumers).
   * @param {any} state
   * @param {string} artifactId
   * @param {"private" | "shared"} shareKind
   */
  function buildArtifactShareUrl(state, artifactId, shareKind) {
    const id = artifactId != null ? String(artifactId) : "";
    if (!id) return "";
    const u = new URL(window.location.href);
    u.hash = "";
    u.search = "";
    u.searchParams.set("skipIntro", "1");
    u.searchParams.set("shareArtifact", id);
    u.searchParams.set("shareKind", shareKind === "shared" ? "shared" : "private");
    const c = state && state.case;
    if (c && c.id) u.searchParams.set("caseId", String(c.id));
    if (c && c.gameRecordId) u.searchParams.set("gameRecordId", String(c.gameRecordId));
    return u.toString();
  }

  function copyStringToClipboard(text) {
    if (!text) return Promise.resolve(false);
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      return navigator.clipboard
        .writeText(text)
        .then(function () {
          return true;
        })
        .catch(function () {
          return false;
        });
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return Promise.resolve(ok);
    } catch {
      return Promise.resolve(false);
    }
  }

  /**
   * Center playfield only (per Third-Party Artifact Reception §4 / §9): share link for approved private/shared doc artifacts.
   */
  function appendApprovedArtifactShareRow(wrapper, kind, state, artifactId) {
    if ((kind !== "DOC_DRAFT" && kind !== "SHARED_DOC_DRAFT") || artifactId == null || artifactId === "") {
      return;
    }
    const docCard = getDraftCardState(kind, state, artifactId);
    if (!docCard || !docCard.approved) return;
    const t = window.lexiomI18n && window.lexiomI18n.t ? window.lexiomI18n.t : function (k) { return k; };
    const scope = kind === "SHARED_DOC_DRAFT" ? "shared" : "private";
    const aid = String(artifactId);
    const row = document.createElement("div");
    row.className = "lexiom-draft-card-share-row";
    const shareBtn = document.createElement("button");
    shareBtn.type = "button";
    shareBtn.className = "lexiom-artifact-share-btn lexiom-draft-card-share-btn";
    shareBtn.setAttribute("aria-label", t("artifact_share_copy_link"));
    shareBtn.setAttribute("title", t("artifact_share_copy_link"));
    shareBtn.innerHTML = LEXIOM_BOOTSTRAP_SHARE_SVG;
    shareBtn.onclick = function onShareArtifact(ev) {
      ev.stopPropagation();
      const st = getState();
      const list = scope === "shared" ? st.sharedHarmony : st.privateArtifacts;
      const artifactRow = (list || []).find(function (r) {
        return r && String(r.id) === aid;
      });
      const portal =
        artifactRow &&
        typeof artifactRow.gt3ArtifactSharePortalUrl === "string" &&
        artifactRow.gt3ArtifactSharePortalUrl.trim()
          ? artifactRow.gt3ArtifactSharePortalUrl.trim()
          : "";
      const fileUrl =
        artifactRow && typeof artifactRow.gt3ArtifactFileUrl === "string" && artifactRow.gt3ArtifactFileUrl.trim()
          ? artifactRow.gt3ArtifactFileUrl.trim()
          : "";
      const url = portal || fileUrl || buildArtifactShareUrl(st, aid, scope === "shared" ? "shared" : "private");
      copyStringToClipboard(url);
    };
    row.appendChild(shareBtn);
    wrapper.appendChild(row);
  }

  function publishArtifactMarkdownToLexiomServer(content, baseName) {
    return fetch("/lexiom/artifact/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content, baseName: baseName || "artifact.md" }),
    })
      .then(function (resp) {
        if (!resp.ok) {
          return resp.json().then(function (d) {
            throw new Error(d && d.detail ? d.detail : "artifact publish failed");
          });
        }
        return resp.json();
      })
      .then(function (data) {
        const fileUrl = data && typeof data.fileUrl === "string" ? data.fileUrl.trim() : "";
        const sharePortalUrl =
          data && typeof data.sharePortalUrl === "string" ? data.sharePortalUrl.trim() : "";
        if (!fileUrl && !sharePortalUrl) return null;
        return { fileUrl: fileUrl || "", sharePortalUrl: sharePortalUrl || "" };
      });
  }

  function maybePublishApprovedRightPanelArtifact(stateBefore, stateAfter, scope, artifactId) {
    const listKey = scope === "shared" ? "sharedHarmony" : "privateArtifacts";
    const arBefore = (stateBefore && stateBefore[listKey]) || [];
    const arAfter = (stateAfter && stateAfter[listKey]) || [];
    const a0 = arBefore.find(function (a) {
      return a && String(a.id) === artifactId;
    });
    const a1 = arAfter.find(function (a) {
      return a && String(a.id) === artifactId;
    });
    const was = a0 && a0.card && a0.card.approved;
    const now = a1 && a1.card && a1.card.approved;
    if (was || !now || !a1 || !a1.card) return;
    const body = typeof a1.card.text === "string" ? a1.card.text.trim() : "";
    if (!body) return;
    const baseName = (a1.title && String(a1.title)) || "artifact.md";
    const flightKey = scope + ":" + artifactId;
    if (gt3ArtifactPublishInFlight.has(flightKey)) return;
    gt3ArtifactPublishInFlight.add(flightKey);
    publishArtifactMarkdownToLexiomServer(body, baseName)
      .then(function (urls) {
        if (!urls) return;
        dispatchWhiteMove(
          "SET_ARTIFACT_GT3_FILE_URL",
          {
            scope: scope,
            artifactId: artifactId,
            fileUrl: urls.fileUrl || "",
            sharePortalUrl: urls.sharePortalUrl || "",
          },
          { activity: "ARTIFACT_GT3_FILE_PUBLISHED" }
        );
      })
      .catch(function (e) {
        // eslint-disable-next-line no-console
        console.warn("[lexiom] artifact publish failed", e);
      })
      .finally(function () {
        gt3ArtifactPublishInFlight.delete(flightKey);
      });
  }

  function renderRightPanel(state) {
    const sharedEl = document.getElementById("lexiom-shared-harmony");
    const artifactsEl = document.getElementById("lexiom-private-artifacts");
    if (!sharedEl || !artifactsEl) return;

    sharedEl.innerHTML = "";
    const t = window.lexiomI18n && window.lexiomI18n.t ? window.lexiomI18n.t : function (k) { return k; };
    const mode = state && state.case && state.case.mode ? String(state.case.mode) : "ZENITH";

    if (mode === "ACCORD" && Array.isArray(state.sharedHarmony) && state.sharedHarmony.length > 0) {
      // Shared Harmony: render clickable entries (like private artifacts). Click opens in center playfield.
      const activeForShared = state.ui && state.ui.activeActivity ? state.ui.activeActivity : { type: "IDLE", artifactId: null };
      (state.sharedHarmony || []).forEach(function (sharedItem) {
        if (!sharedItem || !sharedItem.id) return;
        const card = document.createElement("div");
        card.className = "lexiom-private-artifact-card lexiom-clickable";
        if (activeForShared.type === "SHARED_DOC_DRAFT" && String(activeForShared.artifactId) === String(sharedItem.id)) {
          card.classList.add("lexiom-active");
        }
        const prefix = (sharedItem.card && sharedItem.card.approved) ? "/✓/ " : "/00 %/ ";
        const title = document.createElement("div");
        title.className = "lexiom-private-artifact-title";
        title.textContent = prefix + (sharedItem.title || t("shared_document_draft") || "shared_document_draft");
        card.appendChild(title);
        card.onclick = function () {
          dispatchWhiteMove(
            "NAVIGATE_ACTIVITY",
            { activity: "SHARED_DOC_DRAFT", artifactId: sharedItem.id },
            { activity: "SHARED_DOC_DRAFT", artifactId: sharedItem.id }
          );
        };
        sharedEl.appendChild(card);
      });
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "lexiom-center-idle";
      placeholder.textContent = t("solo_mode");
      sharedEl.appendChild(placeholder);
    }

    artifactsEl.innerHTML = "";
    const active =
      state.ui && state.ui.activeActivity
        ? state.ui.activeActivity
        : { type: "IDLE", artifactId: null };

    (state.privateArtifacts || []).forEach((artifact) => {
      const card = document.createElement("div");
      card.className = "lexiom-private-artifact-card lexiom-clickable";

      if (active.type === "DOC_DRAFT" && active.artifactId === artifact.id) {
        card.classList.add("lexiom-active");
      }

      let artifactPrefix = "/00 %/ ";
      if (artifact.originActionItemId && state.actionItems && Array.isArray(state.actionItems.approved)) {
        const ai = state.actionItems.approved.find(
          (item) => item && String(item.id) === String(artifact.originActionItemId)
        );
        if (ai) {
          const completed = !!ai.completed;
          const rawProgress = typeof ai.progress === "number" ? ai.progress : 0;
          const clampedProgress = Math.max(0, Math.min(99, Math.floor(rawProgress)));
          artifactPrefix = completed ? "/✓/ " : "/" + String(clampedProgress).padStart(2, "0") + " %/ ";
        }
      } else if (artifact.card && artifact.card.approved) {
        artifactPrefix = "/✓/ ";
      } else {
        artifactPrefix = "/00 %/ ";
      }

      const title = document.createElement("div");
      title.className = "lexiom-private-artifact-title";
      title.textContent = artifactPrefix + (artifact.title || t("artifact"));
      card.appendChild(title);

      card.onclick = function onArtifactClick() {
        dispatchWhiteMove(
          "NAVIGATE_ACTIVITY",
          { activity: "DOC_DRAFT", artifactId: artifact.id },
          { activity: "DOC_DRAFT", artifactId: artifact.id }
        );
      };

      artifactsEl.appendChild(card);
    });
  }

  function renderBottomRibbon(state) {
    const ribbonEl = document.getElementById("lexiom-bottom-ribbon");
    if (!ribbonEl) return;

    ribbonEl.innerHTML = "";
    (state.l3_ribbon || []).forEach((label, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-sm lexiom-clickable";
      const t = window.lexiomI18n && window.lexiomI18n.t ? window.lexiomI18n.t : function (k) { return k; };
      btn.textContent = label || t("move_n") + " " + (index + 1);
      btn.onclick = function onL3Click() {
        dispatchWhiteMove(
          "L3_CLICK",
          { l3Index: index, label: label || "" },
          { activity: "L3_CLICK", l3Index: index, label: label || "" }
        );
      };
      ribbonEl.appendChild(btn);
    });
  }

  async function bootstrapFromSeedNarrative(narrative) {
    const callGT3Fn = window.lexiomGT3 && window.lexiomGT3.callGT3;
    if (!callGT3Fn) return;

    const trimmed = narrative && typeof narrative === "string" ? narrative.trim() : "";
    if (!trimmed) return;

    // Build all prompts up front so we can fire all inference requests immediately.
    const l1Prompt =
      "You are Lexiom, an arcade engine for structured reasoning inside the Lexiom cabinet, proposing a short case identity and summary.\n\n" +
      "Seed narrative:\n" +
      trimmed +
      "\n\nTASK: Propose two lines:\n" +
      "Line 1: A 1–4 word case identity title.\n" +
      "Line 2: A 9–15 word summary of the case.\n" +
      "OUTPUT: Return exactly two lines, one per line. No numbers, bullets, or extra commentary.";
    const actionPrompt =
      "You are Lexiom, an arcade engine for structured reasoning inside the Lexiom cabinet, proposing a single next safe action for the user.\n\n" +
      "Seed narrative:\n" +
      trimmed +
      "\n\nTASK: Propose one short sentence (Proposed Action) that describes the next safe, concrete move the user could take.\n" +
      "OUTPUT: Return only that one sentence, without quotes or extra commentary.";
    const buildL22 = window.lexiomBuildL22BootstrapNarrative;
    const buildL21 = window.lexiomBuildL21BootstrapNarrative;
    const l2PromptLegacy =
      "You are Lexiom, an arcade engine for structured reasoning inside the Lexiom cabinet, proposing four L2 boxes. Each box: L21 (one word) and L22 (one word).\n\nSeed:\n" +
      trimmed +
      "\n\nOUTPUT: Eight lines: L21-1, L22-1, L21-2, L22-2, L21-3, L22-3, L21-4, L22-4.";
    const l3Prompt =
      "You are Lexiom, an arcade engine for structured reasoning inside the Lexiom cabinet, proposing three short strategic action labels.\n\n" +
      "Seed narrative:\n" +
      trimmed +
      "\n\nTASK: Propose exactly three short action labels (2–5 words each) for strategic moves the user could take.\n" +
      "OUTPUT: Return exactly three lines, one label per line, no numbers or bullets.";

    // Fire L1, Action, L3 in parallel. L2: L22 first, then L21 (once per round, post seed approval).
    const pL1 = callGT3Fn(l1Prompt, { inferenceType: "L2_REFRESH" });
    const pAction = callGT3Fn(actionPrompt, { inferenceType: "LP" });
    function parseL2L3Lines(text, maxLines) {
      const max = typeof maxLines === "number" && maxLines > 0 ? maxLines : 4;
      return String(text)
        .split(/\r?\n/)
        .map((s) => s.replace(/^[\d.)\-\s*]+/, "").trim())
        .filter(Boolean)
        .slice(0, max);
    }

    const pL2 = buildL22 && buildL21
      ? callGT3Fn(buildL22(trimmed), { inferenceType: "L2_REFRESH" }).then(function (l22Result) {
          if (!l22Result || !l22Result.ok || typeof l22Result.text !== "string") return Promise.resolve();
          const l22Lines = parseL2L3Lines(l22Result.text, 4);
          return callGT3Fn(buildL21(trimmed), { inferenceType: "L2_REFRESH" }).then(function (l21Result) {
            if (!l21Result || !l21Result.ok || typeof l21Result.text !== "string") return;
            const l21Raw = parseL2L3Lines(l21Result.text, 4);
            const l21Lines = l21Raw.map(function (line) { return (line && String(line).split(/\s+/)[0]) || ""; });
            const defaults = getDefaultL2Topics();
            const topics = [
              { l21: l21Lines[0] || defaults[0].l21, l22: l22Lines[0] || defaults[0].l22 },
              { l21: l21Lines[1] || defaults[1].l21, l22: l22Lines[1] || defaults[1].l22 },
              { l21: l21Lines[2] || defaults[2].l21, l22: l22Lines[2] || defaults[2].l22 },
              { l21: l21Lines[3] || defaults[3].l21, l22: l22Lines[3] || defaults[3].l22 },
            ];
            dispatchWhiteMove("BOOTSTRAP_L2_FROM_GT3", { topics }, { activity: "INIT_L2" });
          });
        })
      : callGT3Fn(l2PromptLegacy, { inferenceType: "L2_REFRESH" });
    const pL3 = callGT3Fn(l3Prompt, { inferenceType: "L2_REFRESH" });

    // As each request completes, dispatch the corresponding White Move and re-render.
    pL1.then(function (l1Result) {
      if (l1Result && l1Result.ok && typeof l1Result.text === "string") {
        const lines = String(l1Result.text)
          .split(/\r?\n/)
          .map((s) => s.replace(/^[\d.)\-\s*]+/, "").trim())
          .filter(Boolean);
        const titleLine = lines[0] || "";
        const summaryLine = lines[1] || "";
        if (titleLine) {
          dispatchWhiteMove(
            "BOOTSTRAP_L1_FROM_GT3",
            { title: titleLine, summary: summaryLine },
            { activity: "INIT_L1" }
          );
        }
      }
    }).catch(function (e) {
      // eslint-disable-next-line no-console
      console.error("[LEXIOM_BOOTSTRAP] L1 identity inference failed:", e);
    });

    pAction.then(function (actionResult) {
      if (actionResult && actionResult.ok && typeof actionResult.text === "string") {
        const actionLine = String(actionResult.text).split(/\r?\n/)[0].trim();
        if (actionLine) {
          dispatchWhiteMove("BOOTSTRAP_ACTION_FROM_GT3", { text: actionLine }, { activity: "INIT_ACTION" });
        }
      }
    }).catch(function (e) {
      // eslint-disable-next-line no-console
      console.error("[LEXIOM_BOOTSTRAP] Proposed action inference failed:", e);
    });

    pL2.then(function (l2Result) {
      if (l2Result && l2Result.ok && typeof l2Result.text === "string") {
        const rawLines = parseL2L3Lines(l2Result.text, 8);
        if (rawLines.length >= 8) {
          const defaults = getDefaultL2Topics();
          const topics = [
            { l21: rawLines[0] || defaults[0].l21, l22: rawLines[1] || defaults[0].l22 },
            { l21: rawLines[2] || defaults[1].l21, l22: rawLines[3] || defaults[1].l22 },
            { l21: rawLines[4] || defaults[2].l21, l22: rawLines[5] || defaults[2].l22 },
            { l21: rawLines[6] || defaults[3].l21, l22: rawLines[7] || defaults[3].l22 },
          ];
          dispatchWhiteMove("BOOTSTRAP_L2_FROM_GT3", { topics }, { activity: "INIT_L2" });
        }
      }
    }).catch(function (e) {
      // eslint-disable-next-line no-console
      console.error("[LEXIOM_BOOTSTRAP] L2 topics inference failed:", e);
    });

    pL3.then(function (l3Result) {
      if (l3Result && l3Result.ok && typeof l3Result.text === "string") {
        const labels = parseL2L3Lines(l3Result.text, 3);
        if (labels.length >= 1) {
          dispatchWhiteMove("BOOTSTRAP_L3_FROM_GT3", { labels }, { activity: "INIT_L3" });
        }
      }
    }).catch(function (e) {
      // eslint-disable-next-line no-console
      console.error("[LEXIOM_BOOTSTRAP] L3 ribbon inference failed:", e);
    });

    // Settle only so callers awaiting bootstrap know when all listeners have finished (success or failure).
    await Promise.allSettled([pL1, pAction, pL2, pL3]);
  }

  // Round refresh helper for Zenith Round 2+.
  // Similar to bootstrapFromSeedNarrative, but avoids touching L1 (so the approved L1 stays approved).
  async function refreshRoundFromSeedNarrative(narrative) {
    const callGT3Fn = window.lexiomGT3 && window.lexiomGT3.callGT3;
    if (!callGT3Fn) return;

    const trimmed = narrative && typeof narrative === "string" ? narrative.trim() : "";
    if (!trimmed) return;

    const actionPrompt =
      "You are Lexiom (demo cockpit) proposing a single next safe action for the user.\n\n" +
      "Seed narrative:\n" +
      trimmed +
      "\n\nTASK: Propose one short sentence (Proposed Action) that describes the next safe, concrete move the user could take.\n" +
      "OUTPUT: Return only that one sentence, without quotes or extra commentary.";

    const l3Prompt =
      "You are Lexiom (demo cockpit) proposing three short strategic action labels.\n\n" +
      "Seed narrative:\n" +
      trimmed +
      "\n\nTASK: Propose exactly three short action labels (2–5 words each) for strategic moves the user could take.\n" +
      "OUTPUT: Return exactly three lines, one label per line, no numbers or bullets.";

    const l2PromptLegacy =
      "You are Lexiom (demo cockpit) proposing four L2 boxes. Each box: L21 (one word) and L22 (one word).\n\nSeed:\n" +
      trimmed +
      "\n\nOUTPUT: Eight lines: L21-1, L22-1, L21-2, L22-2, L21-3, L22-3, L21-4, L22-4.";

    function parseLines(text, maxLines) {
      const max = typeof maxLines === "number" && maxLines > 0 ? maxLines : 4;
      return String(text)
        .split(/\r?\n/)
        .map((s) => s.replace(/^[\d.)\-\s*]+/, "").trim())
        .filter(Boolean)
        .slice(0, max);
    }

    const pAction = callGT3Fn(actionPrompt, { inferenceType: "LP" }).then(function (actionResult) {
      if (actionResult && actionResult.ok && typeof actionResult.text === "string") {
        const actionLine = String(actionResult.text).split(/\r?\n/)[0].trim();
        if (actionLine) {
          dispatchWhiteMove("REFRESH_PROPOSED_ACTION_FROM_GT3", { text: actionLine }, { activity: "ROUND_REFRESH_ACTION" });
        }
      }
    });

    const buildL22 = window.lexiomBuildL22BootstrapNarrative;
    const buildL21 = window.lexiomBuildL21BootstrapNarrative;
    const pL2 = buildL22 && buildL21
      ? callGT3Fn(buildL22(trimmed), { inferenceType: "L2_REFRESH" }).then(function (l22Result) {
          if (!l22Result || !l22Result.ok || typeof l22Result.text !== "string") return;
          const l22Lines = parseLines(l22Result.text, 4);
          return callGT3Fn(buildL21(trimmed), { inferenceType: "L2_REFRESH" }).then(function (l21Result) {
            if (!l21Result || !l21Result.ok || typeof l21Result.text !== "string") return;
            const l21Raw = parseLines(l21Result.text, 4);
            const l21Lines = l21Raw.map(function (line) {
              return (line && String(line).split(/\s+/)[0]) || "";
            });
            const defaults = getDefaultL2Topics();
            const topics = [
              { l21: l21Lines[0] || defaults[0].l21, l22: l22Lines[0] || defaults[0].l22 },
              { l21: l21Lines[1] || defaults[1].l21, l22: l22Lines[1] || defaults[1].l22 },
              { l21: l21Lines[2] || defaults[2].l21, l22: l22Lines[2] || defaults[2].l22 },
              { l21: l21Lines[3] || defaults[3].l21, l22: l22Lines[3] || defaults[3].l22 },
            ];
            dispatchWhiteMove("BOOTSTRAP_L2_FROM_GT3", { topics }, { activity: "ROUND_REFRESH_L2" });
          });
        })
      : callGT3Fn(l2PromptLegacy, { inferenceType: "L2_REFRESH" }).then(function (l2Result) {
          if (l2Result && l2Result.ok && typeof l2Result.text === "string") {
            const rawLines = parseLines(l2Result.text, 8);
            if (rawLines.length >= 8) {
              const defaults = getDefaultL2Topics();
              const topics = [
                { l21: rawLines[0] || defaults[0].l21, l22: rawLines[1] || defaults[0].l22 },
                { l21: rawLines[2] || defaults[1].l21, l22: rawLines[3] || defaults[1].l22 },
                { l21: rawLines[4] || defaults[2].l21, l22: rawLines[5] || defaults[2].l22 },
                { l21: rawLines[6] || defaults[3].l21, l22: rawLines[7] || defaults[3].l22 },
              ];
              dispatchWhiteMove("BOOTSTRAP_L2_FROM_GT3", { topics }, { activity: "ROUND_REFRESH_L2" });
            }
          }
        });

    const pL3 = callGT3Fn(l3Prompt, { inferenceType: "L2_REFRESH" }).then(function (l3Result) {
      if (l3Result && l3Result.ok && typeof l3Result.text === "string") {
        const labels = parseLines(l3Result.text, 3);
        if (labels.length >= 1) {
          dispatchWhiteMove("BOOTSTRAP_L3_FROM_GT3", { labels }, { activity: "ROUND_REFRESH_L3" });
        }
      }
    });

    await Promise.allSettled([pAction, pL2, pL3]);
  }

  /**
   * Consume one-time case creation handoff from sessionStorage (JSON).
   * @returns {{ title: string, content: string, caseIntent: string } | null}
   */
  function consumePendingCaseHandoff() {
    try {
      const raw = window.sessionStorage.getItem(PENDING_CASE_HANDOFF_STORAGE_KEY);
      if (!raw) return null;
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return null;
      }
      if (!parsed || typeof parsed !== "object" || parsed.version !== 1) return null;
      const content = typeof parsed.content === "string" ? parsed.content.trim() : "";
      if (!content) return null;
      try {
        window.sessionStorage.removeItem(PENDING_CASE_HANDOFF_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      return {
        title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : "case_seed.md",
        content,
        caseIntent: typeof parsed.caseIntent === "string" ? parsed.caseIntent.trim() : "",
      };
    } catch {
      return null;
    }
  }

  async function loadSeedNarrative() {
    const locale = getCurrentLocale();
    const candidates = locale === "he"
      ? ["meeting_with_client_he.txt", "meeting_with_client.md", "meeting_with_client_en.txt"]
      : ["meeting_with_client.md", "meeting_with_client_en.txt", "meeting_with_client_he.txt"];

    for (let i = 0; i < candidates.length; i++) {
      const file = candidates[i];
      const seedUrl = file + "?t=" + Date.now();
      const response = await fetch(seedUrl, { cache: "no-store" });
      if (!response.ok) continue;

      const text = await response.text();
      const trimmed = text && typeof text === "string" ? text.trim() : "";
      if (!trimmed) continue;

      return { content: trimmed, title: file };
    }

    // eslint-disable-next-line no-console
    console.warn("[LEXIOM_INIT] No non-empty seed narrative file found.");
    return null;
  }

  async function initializeApp() {
    try {
      if (window.lexiomI18n && window.lexiomI18n.applyI18n) {
        window.lexiomI18n.applyI18n();
      }
      try {
        const ibPersist = getQueryParam("inboundArtifact");
        if (ibPersist) {
          window.sessionStorage.setItem(LEXIOM_PENDING_INBOUND_ARTIFACT_V1, ibPersist);
        }
      } catch {
        /* ignore */
      }
      const accordId = getQueryParam("accord");
      const fromLanding = getQueryParam("source") === "landing";
      const firstEntryState = getFirstEntryState();
      if (!accordId && isPreSpaLandingEnabled() && firstEntryState !== "onboarding_complete") {
        // Enforce newcomer onboarding before entering standard SPA flow.
        redirectToLanding(fromLanding ? "onboarding_incomplete" : "first_entry_required");
        return;
      }
      let content = null;
      let initMove = null;
      let initPayload = null;

      if (accordId) {
        const accordUrl = "/gt2/Lexiom/Accords/accord_shared_playfield." + encodeURIComponent(accordId) + ".md?t=" + Date.now();
        const response = await fetch(accordUrl, { cache: "no-store" });
        if (response.ok) {
          const text = await response.text();
          const trimmed = text && typeof text === "string" ? text.trim() : "";
          if (trimmed) {
            content = trimmed;
            initMove = "INIT_FROM_SHARED_ACCORD_MD";
            initPayload = {
              resourceId: accordId,
              title: "accord_shared_playfield." + accordId + ".md",
              content: trimmed,
            };
          }
        }
      }

      if (!content) {
        let inboundResourceId = getQueryParam("inboundArtifact") || "";
        if (!inboundResourceId) {
          try {
            inboundResourceId = window.sessionStorage.getItem(LEXIOM_PENDING_INBOUND_ARTIFACT_V1) || "";
          } catch {
            inboundResourceId = "";
          }
        }
        inboundResourceId = inboundResourceId ? String(inboundResourceId).trim() : "";
        if (inboundResourceId) {
          const inboundUrl =
            "/lexiom/artifact/content/" + encodeURIComponent(inboundResourceId) + "?t=" + Date.now();
          const response = await fetch(inboundUrl, { cache: "no-store", credentials: "same-origin" });
          if (response.ok) {
            const data = await response.json();
            const trimmed =
              data && typeof data.content === "string" ? data.content.trim() : "";
            if (trimmed) {
              try {
                window.sessionStorage.removeItem(LEXIOM_PENDING_INBOUND_ARTIFACT_V1);
              } catch {
                /* ignore */
              }
              content = trimmed;
              initMove = "INIT_FROM_INBOUND_PUBLISHED_MD";
              initPayload = {
                resourceId: inboundResourceId,
                title:
                  data && typeof data.filename === "string" && data.filename.trim()
                    ? data.filename.trim()
                    : "shared_artifact.md",
                content: trimmed,
              };
            }
          }
        }
      }

      if (!content) {
        const handoff = consumePendingCaseHandoff();
        if (handoff) {
          content = handoff.content;
          initMove = "EXTERNAL_ARTIFACT_DISCOVERED";
          initPayload = {
            title: handoff.title,
            content: handoff.content,
            caseIntent: handoff.caseIntent,
          };
        }
      }

      if (!content) {
        const seedResult = await loadSeedNarrative();
        content = seedResult && seedResult.content ? seedResult.content : null;
        initMove = content ? "EXTERNAL_ARTIFACT_DISCOVERED" : "INIT_EMPTY_CASE";
        initPayload = content
          ? { title: (seedResult && seedResult.title) || "meeting_with_client.md", content }
          : {};
      }

      if (initMove === "INIT_EMPTY_CASE") {
        try {
          window.sessionStorage.setItem(INIT_EMPTY_CASE_STORAGE_KEY, "1");
        } catch {
          /* ignore */
        }
      } else {
        try {
          window.sessionStorage.removeItem(INIT_EMPTY_CASE_STORAGE_KEY);
        } catch {
          /* ignore */
        }
      }

      if (initMove) {
        dispatchWhiteMove(initMove, initPayload, { activity: "INIT" });
        // First cockpit seed guidance: auto-open the seed artifact in center playfield
        // right after seed-based initialization.
        if (initMove === "EXTERNAL_ARTIFACT_DISCOVERED") {
          const stateAfterInit = getState();
          const activeAfterInit =
            stateAfterInit &&
            stateAfterInit.ui &&
            stateAfterInit.ui.activeActivity
              ? stateAfterInit.ui.activeActivity
              : { type: "IDLE" };
          if (activeAfterInit.type === "IDLE") {
            const artifacts = (stateAfterInit && stateAfterInit.privateArtifacts) || [];
            const seedArtifact = artifacts.find(function (a) {
              return isBundledSeedArtifact(a);
            });
            if (seedArtifact && seedArtifact.id) {
              dispatchWhiteMove(
                "NAVIGATE_ACTIVITY",
                { activity: "DOC_DRAFT", artifactId: seedArtifact.id },
                { activity: "DOC_DRAFT", artifactId: seedArtifact.id }
              );
            }
          }
        }
      }
      // Expose debug helpers and GT3 client (Step 3a/3b: callable from app)
      window.lexiomDebug = {
        getState,
        eventLedger,
        phase: () => phase,
        callGT3: window.lexiomGT3 && window.lexiomGT3.callGT3,
        getInferenceUri: window.lexiomGT3 && window.lexiomGT3.getInferenceUri,
        getApiKey: window.lexiomGT3 && window.lexiomGT3.getApiKey,
        setApiKey: window.lexiomGT3 && window.lexiomGT3.setApiKey,
        buildNarrative: window.lexiomBuildNarrative,
      };

      if (window.lexiomGT3 && window.lexiomGT3.setGameRecordIdProvider) {
        window.lexiomGT3.setGameRecordIdProvider(function () {
          try {
            const s = getState();
            if (s && s.case && s.case.gameRecordId) {
              return String(s.case.gameRecordId);
            }
          } catch {
            /* ignore */
          }
          return null;
        });
      }

      // If user came from landing, attach the queued landing funnel events to this game record.
      if (fromLanding) {
        tryFlushLandingEventQueue();
      }
      emitPersonaModeEventOnce();

      // eslint-disable-next-line no-console
      if (content) {
        // Bundled seed: draft-first artifact must be user-approved before GT3 bootstrap (see TOGGLE_APPROVAL Black hook).
        const deferSeedBootstrap = initMove === "EXTERNAL_ARTIFACT_DISCOVERED";
        if (!deferSeedBootstrap) {
          bootstrapFromSeedNarrative(content);
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to initialize Lexiom:", err);
    }
  }

  document.addEventListener("DOMContentLoaded", function onReady() {
    document.removeEventListener("DOMContentLoaded", onReady);
    runIntroThenInit();
  });

  function runIntroThenInit() {
    const skipIntro =
      new URLSearchParams(window.location.search || "").get("skipIntro") === "1";
    const introEl = document.getElementById("lexiom-intro");
    const mainWrap = document.getElementById("lexiom-main-wrap");
    const introDurationMs = 6000;

    if (skipIntro) {
      if (introEl && introEl.parentNode) {
        introEl.parentNode.removeChild(introEl);
      } else if (introEl) {
        introEl.classList.add("lexiom-intro-hidden");
        introEl.setAttribute("hidden", "");
      }
      if (mainWrap) mainWrap.classList.add("lexiom-intro-done");
      initializeApp();
      return;
    }

    if (!introEl || !mainWrap) {
      initializeApp();
      return;
    }

    setTimeout(function () {
      introEl.classList.add("lexiom-intro-hidden");
      if (mainWrap) mainWrap.classList.add("lexiom-intro-done");
      setTimeout(function () {
        if (introEl && introEl.parentNode) introEl.parentNode.removeChild(introEl);
      }, 350);
      initializeApp();
    }, introDurationMs);
  }
})();

