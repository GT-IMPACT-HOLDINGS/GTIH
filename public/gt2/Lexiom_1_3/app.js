(function () {
  "use strict";

  // OSNs (Outcome Specification Nodes): owned semantic source files expressing human
  // intention and evidence. The graph below loads each node as an owned YAML artifact.
  const DEFAULT_OSN_FILE_PATHS = [
    "/gt2/Lexiom_1_3/GT_Philosophy.a1000001.osn.yaml",
    "/gt2/Lexiom_1_3/GT_Philosophy.ProductLexiom.a1000002.osn.yaml",
    "/gt2/Lexiom_1_3/GT_Philosophy.ProductLexiom.UX.a1000003.osn.yaml",
    "/gt2/Lexiom_1_3/GT_Philosophy.ProductLexiom.CodeShape.a1000004.osn.yaml",
  ];

  const DEFAULT_SELECTED_OSN_ID = "GT_Philosophy.ProductLexiom.a1000002.osn";
  const DEFAULT_SELECTED_SECTION_KEY = "output_spec";
  const BUILD_SECTION_KEY = "build";
  const BUD_SECTION_KEY = "bud";
  const BUILD_LIFECYCLE_STORAGE_KEY = "lexiom13.buildLifecycle.v1";
  const BUILD_ACTIVE_PHASES = new Set(["preparing", "running"]);
  const SUCCESS_EVIDENCES_SECTION_KEY = "success_evidences";
  const OSN_OWNER_META_KEY = "osn_owner";
  const OSN_TITLE_META_KEY = "osn_title";
  const OSN_FILE_NAME_META_KEY = "osn_file_name";
  const OSN_META_FIELD_DEFS = [
    { key: OSN_OWNER_META_KEY, label: "OSN Owner" },
    { key: OSN_TITLE_META_KEY, label: "OSN Title" },
    { key: OSN_FILE_NAME_META_KEY, label: "OSN Name" },
  ];
  // Each OSN section is a slice of that artifact — seed and output_spec hold intention;
  // success_evidences hold the evidence contract owners require before approval.
  // `bud` is a conditional fifth strip glyph (Phase B) — not a draft-editable section.
  const OSN_SECTION_DEFS = [
    { key: "seed", label: "Seed" },
    { key: "thematic_lenses", label: "Thematic Lenses" },
    { key: "output_spec", label: "Output Spec" },
    { key: "success_evidences", label: "Success Evidences" },
  ];
  const BUD_SECTION_DEF = { key: BUD_SECTION_KEY, label: "Bud" };

  // Hanuman — Ram's loving devotee (Containerized Agent): leaps workspaces, consults only GT3,
  // builds the SUD Ram prescribed via the OSNG, never claims the White throne.
  const CA_SECONDARY_NAME = "Hanuman";
  const CA_DISPLAY_LABEL = "Containerized Agent (" + CA_SECONDARY_NAME + ")";

  const PHASES = {
    STABLE: "STABLE",
    WHITE_COMMIT: "WHITE_COMMIT",
    BLACK_RUN: "BLACK_RUN",
  };

  let phase = PHASES.STABLE;
  let lensInferenceInFlight = false;
  let maturationInferenceInFlight = false;
  let canonizationInFlight = false;
  let persistInFlight = false;
  let pruneInFlight = false;
  let cockpitTitleInferenceInFlight = false;
  let causalInferenceInFlight = false;
  // Session draft for Causal Lineage ask — survives ribbon remounts (e.g. poll refresh).
  const causalAskDraftByKey = new Map();

  const COCKPIT_TITLE_FALLBACK = "Lexiom Cockpit";
  const CAUSAL_ASK_PLACEHOLDER =
    "Ask why the System Under Development (SUD) looks, feels, or behaves as shown in this evidence.";
  const PLAYER_ASK_PLACEHOLDER =
    "Keep inquiring or ask for output_spec changes.";
  /** Focus-closure evidence collection poll (Evidence Cockpit Sync v1). */
  const EVIDENCE_COLLECTION_POLL_MS = 5000;

  // PlaneShift (multi-plane lineage): native plane vs standard-ancestor planes.
  const PLANE_NATIVE_ID = "native";
  const PLANE_FADE_OUT_MS = 750;
  const PLANE_FADE_IN_MS = 1500;

  const state = {
    osnsById: new Map(),
    orderedOsns: [],
    draftCardsByOsnId: new Map(),
    selectedOsnId: DEFAULT_SELECTED_OSN_ID,
    selectedSectionKey: DEFAULT_SELECTED_SECTION_KEY,
    selectedEvidenceId: null,
    selectedLensId: null,
    lensMode: "reframe",
    expandedOsnIds: new Set(),
    buildPreviewsByOsnId: new Map(),
    buildHandoffsByOsnId: new Map(),
    buildStrategyByOsnId: new Map(),
    buildRunResultsByOsnId: new Map(),
    buildLifecycleByOsnId: new Map(),
    lensThreadsByKey: new Map(),
    lensDraftsByOsnSection: new Map(),
    lensIntensityByKey: new Map(),
    causalThreadsByEvidenceKey: new Map(),
    causalExecSummaryByEvidenceKey: new Map(),
    causalNarrativeRevealedByEvidenceKey: new Set(),
    playerAskUnlockedByEvidenceKey: new Set(),
    latestAskKindByEvidenceKey: new Map(),
    outputSpecChangeByEvidenceKey: new Map(),
    outputSpecChangeRevealedByEvidenceKey: new Set(),
    drafts: {},
    actionLog: [],
    evidenceAvailableByKey: new Map(),
    evidenceResolvedByKey: new Map(),
    evidenceBundledAvailableByKey: new Map(),
    evidenceBundledResolvedByKey: new Map(),
    evidenceBuildResolvedByKey: new Map(),
    evidenceCollectionPoll: {
      timerId: null,
      inFlight: false,
      lastFocusOsnId: null,
      lastError: null,
      lastPolledAt: null,
    },
    evidenceApprovalByKey: new Map(),
    evidenceTextCache: new Map(),
    /** @type {Map<string, string>} Focus OSN id → last plane pick (native | std:…) */
    activePlaneByOsnId: new Map(),
    ui: {
      pendingLensRefresh: null,
      lensInferencePending: false,
      lensInferenceError: null,
      pendingMaturationProposal: null,
      maturationInferencePending: false,
      maturationInferenceError: null,
      pendingCanonization: null,
      canonizationPending: false,
      canonizationError: null,
      pendingPersist: null,
      persistPending: false,
      persistError: null,
      pendingPrune: null,
      prunePending: false,
      pruneError: null,
      cockpitTitle: null,
      cockpitTitlePending: false,
      cockpitTitleError: null,
      cockpitTitleStale: true,
      pendingCausalLineage: null,
      pendingPlayerAsk: null,
      causalInferencePending: false,
      causalInferenceError: null,
      playerAskUnlockFlashKey: null,
      buildPreparePending: false,
      buildRunPending: false,
      buildError: null,
      fullGraphMode: false,
      /** "classical" | "garden" — only meaningful while fullGraphMode is on. */
      fullGraphKind: "classical",
      planePickerOpen: false,
      /** Session-locked thematic plane; only radio pick changes it. */
      lockedPlaneId: PLANE_NATIVE_ID,
    },
    runtimeOsnIds: [],
    branchSequence: 0,
    error: null,
  };

  const els = {
    lenses: document.getElementById("lexiom-l2-lenses"),
    topHud: document.getElementById("lexiom-top-hud"),
    leftPanel: document.getElementById("lexiom-left-panel"),
    leftPanelTitle: document.getElementById("lexiom-left-panel-title"),
    graph: document.getElementById("lexiom-osn-graph"),
    graphFilters: document.getElementById("lexiom-osn-graph-filters"),
    fullGraphToggle: document.getElementById("lexiom-full-graph-toggle"),
    fullGraphKindSwitch: document.getElementById("lexiom-full-graph-kind-switch"),
    focus: document.getElementById("lexiom-osn-focus"),
    sectionStrip: document.getElementById("lexiom-osn-section-strip"),
    card: document.getElementById("lexiom-osn-card"),
    evidences: document.getElementById("lexiom-success-evidences"),
    cockpitTitle: document.getElementById("lexiom-cockpit-title"),
    bottomRibbon: document.getElementById("lexiom-bottom-ribbon"),
  };
  let graphResizeObserver = null;
  let graphResizeFrame = null;
  let lastGraphViewportWidth = 0;
  let lastGraphViewportHeight = 0;
  let lastPlaneRenderKey = null;
  let planeFadeToken = 0;

  function getEvidenceLinksApi() {
    return window.lexiom13EvidenceLinks || null;
  }

  function getOsnFilteringApi() {
    return window.lexiom13OsnFiltering || null;
  }

  function getOsnFilteringContext() {
    return {
      getLinkedEvidencesForOsn: getLinkedEvidencesForOsn,
      isEvidenceArtifactAvailable: isEvidenceArtifactAvailable,
      isEvidenceApproved: isEvidenceApproved,
      canBuildOsn: canBuildOsn,
    };
  }

  function getEvidenceLinkKey(osnId, evidenceId) {
    const api = getEvidenceLinksApi();
    if (api) {
      return api.getEvidenceLinkKey(osnId, evidenceId);
    }
    return String(osnId) + "::" + String(evidenceId);
  }

  function getLinkedEvidencesForOsn(osn) {
    const api = getEvidenceLinksApi();
    if (!api || !osn) {
      return [];
    }
    return api.linkSuccessEvidencesForOsn(osn);
  }

  function getSelectedEvidenceLink(osn) {
    if (!osn || !state.selectedEvidenceId) {
      return null;
    }
    const api = getEvidenceLinksApi();
    if (!api) {
      return null;
    }
    const base = api.findLinkedEvidence(osn, state.selectedEvidenceId);
    return withResolvedEvidenceLink(base);
  }

  function getResolvedEvidenceLink(osnId, evidenceId) {
    const key = getEvidenceLinkKey(osnId, evidenceId);
    return (
      state.evidenceBuildResolvedByKey.get(key) ||
      state.evidenceBundledResolvedByKey.get(key) ||
      state.evidenceResolvedByKey.get(key) ||
      null
    );
  }

  function isEvidenceArtifactAvailable(link) {
    if (!link) {
      return false;
    }
    const key = getEvidenceLinkKey(link.origin.osnId, link.evidenceId);
    if (state.evidenceBuildResolvedByKey.has(key)) {
      return true;
    }
    if (state.evidenceBundledResolvedByKey.get(key)) {
      return true;
    }
    if (state.evidenceResolvedByKey.get(key)) {
      return true;
    }
    return state.evidenceAvailableByKey.get(key) === true;
  }

  function withResolvedEvidenceLink(link) {
    if (!link) {
      return null;
    }
    const resolved = getResolvedEvidenceLink(link.origin.osnId, link.evidenceId);
    return resolved || link;
  }

  function clearEvidenceSelection() {
    state.selectedEvidenceId = null;
  }

  function getCausalEvidenceKey(osnId, evidenceId) {
    return String(osnId) + "::" + String(evidenceId);
  }

  function ensureCausalThread(osnId, evidenceId) {
    const key = getCausalEvidenceKey(osnId, evidenceId);
    if (!state.causalThreadsByEvidenceKey.has(key)) {
      state.causalThreadsByEvidenceKey.set(key, []);
    }
    return state.causalThreadsByEvidenceKey.get(key);
  }

  function getCausalThread(osnId, evidenceId) {
    return state.causalThreadsByEvidenceKey.get(getCausalEvidenceKey(osnId, evidenceId)) || [];
  }

  function getEvidenceDefinition(osn, evidenceId) {
    const defs = Array.isArray(osn && osn.success_evidences) ? osn.success_evidences : [];
    const target = String(evidenceId || "").trim();
    return (
      defs.find(function (def) {
        return String(def.evidence_id || "").trim() === target;
      }) || null
    );
  }

  function getStandardAncestorOsns(osn) {
    const ids = Array.isArray(osn && osn.graph && osn.graph.standard_ancestor_osn_ids)
      ? osn.graph.standard_ancestor_osn_ids
      : [];
    return ids
      .map(function (id) {
        return getOsnById(id);
      })
      .filter(Boolean);
  }

  function stripInBandTail(text) {
    const lines = String(text || "").split(/\r?\n/);
    while (lines.length && /^_[A-Za-z0-9]+_/.test(String(lines[lines.length - 1]).trim())) {
      lines.pop();
    }
    return lines.join("\n").trim();
  }

  function parseCausalLineageResponse(text) {
    const cleaned = stripInBandTail(text);
    const sections = {
      askKind: "Q",
      execSummary: "",
      narrative: "",
      proposedOutputSpec: "",
      approved: [],
      inferred: [],
      missing: [],
    };

    let body = cleaned;
    const askKindMatch = body.match(/^\s*ASK_KIND:\s*([QA])\s*(?:\r?\n|$)/i);
    if (askKindMatch) {
      sections.askKind = String(askKindMatch[1] || "Q").toUpperCase() === "A" ? "A" : "Q";
      body = body.slice(askKindMatch[0].length).trim();
    }

    const execMarker = "EXEC_SUMMARY:";
    const execIdx = body.indexOf(execMarker);
    if (execIdx !== -1) {
      const lineEnd = body.indexOf("\n", execIdx);
      const execLine = lineEnd === -1 ? body.slice(execIdx) : body.slice(execIdx, lineEnd);
      sections.execSummary = execLine.slice(execMarker.length).trim();
      body = (lineEnd === -1 ? "" : body.slice(lineEnd + 1)).trim();
    }

    const proposedMarker = "PROPOSED_OUTPUT_SPEC:";
    const proposedIdx = body.indexOf(proposedMarker);
    if (proposedIdx !== -1) {
      sections.askKind = "A";
      sections.proposedOutputSpec = body.slice(proposedIdx + proposedMarker.length).trim();
      if (!sections.execSummary && proposedIdx > 0) {
        sections.narrative = body.slice(0, proposedIdx).trim();
      }
      return sections;
    }

    const headers = ["APPROVED_CAUSES:", "INFERRED_CAUSES:", "MISSING_CAUSES:"];
    const headerIndex = {};
    headers.forEach(function (header) {
      const idx = body.indexOf(header);
      if (idx !== -1) {
        headerIndex[header] = idx;
      }
    });

    const firstHeaderPos = headers
      .map(function (header) {
        return headerIndex[header];
      })
      .filter(function (idx) {
        return typeof idx === "number";
      })
      .sort(function (a, b) {
        return a - b;
      })[0];

    if (typeof firstHeaderPos === "number") {
      sections.narrative = body.slice(0, firstHeaderPos).trim();
    } else {
      sections.narrative = body;
      return sections;
    }

    function sliceSection(header, nextHeader) {
      const start = headerIndex[header];
      if (typeof start !== "number") {
        return [];
      }
      const bodyStart = start + header.length;
      const end = typeof nextHeader === "number" ? nextHeader : body.length;
      return body
        .slice(bodyStart, end)
        .split(/\r?\n/)
        .map(function (line) {
          return String(line).trim();
        })
        .filter(function (line) {
          return line.indexOf("- ") === 0 && line !== "- (none)";
        })
        .map(function (line) {
          return line.replace(/^- /, "").trim();
        });
    }

    const approvedPos = headerIndex["APPROVED_CAUSES:"];
    const inferredPos = headerIndex["INFERRED_CAUSES:"];
    const missingPos = headerIndex["MISSING_CAUSES:"];

    sections.approved = sliceSection("APPROVED_CAUSES:", inferredPos);
    sections.inferred = sliceSection("INFERRED_CAUSES:", missingPos);
    sections.missing = sliceSection("MISSING_CAUSES:", undefined);
    return sections;
  }

  function isPlayerAskUnlocked(osnId, evidenceId) {
    return state.playerAskUnlockedByEvidenceKey.has(getCausalEvidenceKey(osnId, evidenceId));
  }

  /**
   * Lexiom-side detector for clear action asks once dual-ask is unlocked.
   * Imperative change language should not rely on soft LLM ASK_KIND choice.
   */
  function isImperativeOutputSpecChangeAsk(askText) {
    const text = String(askText || "").trim().toLowerCase();
    if (!text) {
      return false;
    }
    if (/^(why|what|which|how come|explain|describe|tell me)\b/.test(text)) {
      return false;
    }
    if (/\b(why|what causes|which cause|explain why)\b/.test(text)) {
      return false;
    }
    if (
      /^(change|make|set|update|turn|switch|replace|recolor|rewrite|revise|alter|edit|adjust|repaint)\b/.test(
        text
      )
    ) {
      return true;
    }
    if (
      /\b(change|make|set|update|turn|switch|replace|recolor|rewrite|revise|alter)\b.+\b(to|into)\b/.test(
        text
      )
    ) {
      return true;
    }
    return false;
  }

  function getLatestAskKind(osnId, evidenceId) {
    return state.latestAskKindByEvidenceKey.get(getCausalEvidenceKey(osnId, evidenceId)) || "Q";
  }

  function getOutputSpecChangeState(osnId, evidenceId) {
    return state.outputSpecChangeByEvidenceKey.get(getCausalEvidenceKey(osnId, evidenceId)) || null;
  }

  function ensureOutputSpecChangeState(osnId, evidenceId, seed) {
    const key = getCausalEvidenceKey(osnId, evidenceId);
    if (!state.outputSpecChangeByEvidenceKey.has(key)) {
      state.outputSpecChangeByEvidenceKey.set(key, {
        askText: String((seed && seed.askText) || ""),
        execSummary: String((seed && seed.execSummary) || ""),
        proposedText: String((seed && seed.proposedText) || ""),
        approved: false,
        hasLmDraft: !!(seed && String(seed.proposedText || "").trim()),
        hasUserEdits: false,
      });
    }
    return state.outputSpecChangeByEvidenceKey.get(key);
  }

  function isOutputSpecChangeRevealed(osnId, evidenceId) {
    return state.outputSpecChangeRevealedByEvidenceKey.has(getCausalEvidenceKey(osnId, evidenceId));
  }

  function clearOutputSpecChangeProposal(draft, osnId, evidenceId) {
    const key = getCausalEvidenceKey(osnId, evidenceId);
    draft.outputSpecChangeByEvidenceKey.delete(key);
    draft.outputSpecChangeRevealedByEvidenceKey.delete(key);
  }

  function lockPlayerAskCapability(draft, osnId, evidenceId) {
    const key = getCausalEvidenceKey(osnId, evidenceId);
    draft.playerAskUnlockedByEvidenceKey.delete(key);
    clearOutputSpecChangeProposal(draft, osnId, evidenceId);
  }

  function getApprovedLineageNarrativeText(osnId, evidenceId) {
    const thread = getCausalThread(osnId, evidenceId);
    if (!Array.isArray(thread) || !thread.length) {
      return "";
    }
    for (let i = thread.length - 1; i >= 0; i -= 1) {
      const entry = thread[i];
      if (!entry || entry.role !== "assistant" || !entry.approved) {
        continue;
      }
      return String(
        entry.editedText != null ? entry.editedText : formatCausalExpositionPlainText(entry) || ""
      ).trim();
    }
    return "";
  }

  function getCausalExecSummaryState(osnId, evidenceId) {
    return state.causalExecSummaryByEvidenceKey.get(getCausalEvidenceKey(osnId, evidenceId)) || null;
  }

  function ensureCausalExecSummaryState(osnId, evidenceId, seed) {
    const key = getCausalEvidenceKey(osnId, evidenceId);
    if (!state.causalExecSummaryByEvidenceKey.has(key)) {
      state.causalExecSummaryByEvidenceKey.set(key, {
        text: String(seed || ""),
        approved: false,
        hasLmDraft: !!String(seed || "").trim(),
        hasUserEdits: false,
      });
    }
    return state.causalExecSummaryByEvidenceKey.get(key);
  }

  function updateCausalExecSummaryText(osnId, evidenceId, nextText) {
    const card = getCausalExecSummaryState(osnId, evidenceId);
    if (!card) {
      return;
    }
    const changed = String(card.text || "") !== String(nextText || "");
    card.text = String(nextText || "");
    if (changed) {
      card.hasUserEdits = true;
      if (card.approved) {
        card.approved = false;
      }
      appendAction("edit_causal_exec_summary", { osnId: osnId, evidenceId: evidenceId });
      refreshCausalExecSummaryGlyph(osnId, evidenceId);
    }
  }

  function refreshCausalExecSummaryGlyph(osnId, evidenceId) {
    const card = getCausalExecSummaryState(osnId, evidenceId);
    const glyphBtn = document.getElementById("lexiom-causal-exec-summary-glyph");
    const wrapper = document.getElementById("lexiom-causal-exec-summary-card");
    if (!card || !glyphBtn || !wrapper) {
      return;
    }
    const allowed = String(card.text || "").trim().length > 0;
    const approved = !!card.approved;
    glyphBtn.textContent = getGlyphForCard(card);
    glyphBtn.classList.toggle("lexiom-draft-card-glyph-approved", approved);
    glyphBtn.disabled = !allowed;
    glyphBtn.classList.toggle("is-disabled", !allowed);
    wrapper.classList.toggle("is-approved", approved);
    glyphBtn.title = approved
      ? "Approved — click to unapprove"
      : allowed
        ? "Click to approve"
        : "Executive summary must have text before approval";
  }

  function getCausalNarrativeDraftCard(entry) {
    if (!entry) {
      return null;
    }
    return {
      text: formatCausalExpositionPlainText(entry),
      approved: !!entry.approved,
      hasLmDraft: true,
      hasUserEdits: !!entry.hasUserEdits,
    };
  }

  function refreshCausalNarrativeGlyph(osnId, evidenceId) {
    const entry = getLatestAssistantEntry(getCausalThread(osnId, evidenceId));
    const draftCard = getCausalNarrativeDraftCard(entry);
    const glyphBtn = document.getElementById("lexiom-lineage-narrative-glyph");
    const wrapper = document.getElementById("lexiom-lineage-narrative-card");
    if (!draftCard || !glyphBtn || !wrapper) {
      return;
    }
    const allowed = String(draftCard.text || "").trim().length > 0;
    const approved = !!draftCard.approved;
    glyphBtn.textContent = getGlyphForCard(draftCard);
    glyphBtn.classList.toggle("lexiom-draft-card-glyph-approved", approved);
    glyphBtn.disabled = !allowed;
    glyphBtn.classList.toggle("is-disabled", !allowed);
    wrapper.classList.toggle("is-approved", approved);
    glyphBtn.title = approved
      ? "Approved — click to unapprove"
      : allowed
        ? "Click to approve"
        : "Lineage narrative must have text before approval";
  }

  function toggleCausalNarrativeApproval(osnId, evidenceId) {
    const entry = getLatestAssistantEntry(getCausalThread(osnId, evidenceId));
    const draftCard = getCausalNarrativeDraftCard(entry);
    if (!draftCard || !String(draftCard.text || "").trim()) {
      return;
    }
    const nextApproved = !draftCard.approved;
    dispatchWhiteMove("TOGGLE_CAUSAL_NARRATIVE_APPROVAL", {
      osnId: osnId,
      evidenceId: evidenceId,
    });
    appendAction("toggle_causal_narrative_approval", {
      osnId: osnId,
      evidenceId: evidenceId,
      approved: nextApproved,
    });
  }

  function toggleCausalExecSummaryApproval(osnId, evidenceId) {
    const card = getCausalExecSummaryState(osnId, evidenceId);
    if (!card || !String(card.text || "").trim()) {
      return;
    }
    const nextApproved = !card.approved;
    dispatchWhiteMove("TOGGLE_CAUSAL_EXEC_SUMMARY_APPROVAL", {
      osnId: osnId,
      evidenceId: evidenceId,
    });
    appendAction("toggle_causal_exec_summary_approval", {
      osnId: osnId,
      evidenceId: evidenceId,
      approved: nextApproved,
    });
  }

  function getCausalArtifactBody(link) {
    if (!link || !link.artifactUrl) {
      return "";
    }
    if (link.mediaType === "image" || link.mediaType === "video") {
      return "";
    }
    const cached = state.evidenceTextCache.get(link.artifactUrl);
    if (typeof cached === "string") {
      const trimmed = cached.trim();
      return trimmed.length > 4000 ? trimmed.slice(0, 4000) + "\n...(truncated)" : trimmed;
    }
    return "";
  }

  function isEvidenceApproved(osnId, evidenceId) {
    return state.evidenceApprovalByKey.get(getEvidenceLinkKey(osnId, evidenceId)) === true;
  }

  function setEvidenceApproval(osnId, evidenceId, approved) {
    state.evidenceApprovalByKey.set(getEvidenceLinkKey(osnId, evidenceId), approved === true);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, function (char) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[char];
    });
  }

  /** Seed prose collapsed for hover captions. */
  function getOsnSeedText(osn) {
    return String((osn && osn.seed) || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Hover caption: seed content above the origin-leaf name when seed exists.
   * Falls back to file_name when neither seed nor leaf label is useful.
   */
  function getOsnHoverTitle(osn) {
    const name = getOsnOriginLeafLabel(osn);
    const seed = getOsnSeedText(osn);
    if (seed && name) {
      return seed + "\n\n" + name;
    }
    if (seed) {
      return seed;
    }
    if (name) {
      return name;
    }
    return String((osn && (osn.file_name || osn.id)) || "");
  }

  /** Escape for HTML title attributes, preserving line breaks as &#10;. */
  function escapeTitleAttr(value) {
    return escapeHtml(value).replace(/\r?\n/g, "&#10;");
  }

  function toDomId(prefix, raw) {
    const slug = String(raw || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-");
    return slug ? prefix + "-" + slug : prefix;
  }

  function getOsnById(osnId) {
    return state.osnsById.get(osnId) || null;
  }

  function isCanonicalOsn(osn) {
    return !!(osn && osn.__canonical !== false);
  }

  function isImmatureOsn(osn) {
    return !!(osn && osn.__canonical === false);
  }

  /** DFS post-order walk of the OSN branch slated for pruning (includes immature runtime children). */
  function collectBranchSubtreeIds(rootOsnId) {
    const postOrder = [];
    const visited = new Set();

    function walk(osnId) {
      if (!osnId || visited.has(osnId)) {
        return;
      }
      visited.add(osnId);
      const osn = getOsnById(osnId);
      if (!osn) {
        return;
      }
      const children = Array.isArray(osn.graph && osn.graph.child_osn_ids) ? osn.graph.child_osn_ids : [];
      children.forEach(function (childId) {
        walk(childId);
      });
      postOrder.push(osnId);
    }

    walk(rootOsnId);
    return postOrder;
  }

  function isOsnMetaSectionKey(sectionKey) {
    return (
      sectionKey === OSN_OWNER_META_KEY ||
      sectionKey === OSN_TITLE_META_KEY ||
      sectionKey === OSN_FILE_NAME_META_KEY
    );
  }

  function syncMetaSectionToOsn(osn, sectionKey, text) {
    const trimmed = String(text || "").trim();
    if (!osn || !trimmed) {
      return;
    }
    if (sectionKey === OSN_OWNER_META_KEY) {
      if (!osn.owner) {
        osn.owner = {
          owner_id: "player",
          display_name: trimmed,
          role: "OSN Owner",
        };
      } else {
        osn.owner.display_name = trimmed;
      }
      return;
    }
    if (sectionKey === OSN_TITLE_META_KEY) {
      osn.title = trimmed;
      return;
    }
    if (sectionKey === OSN_FILE_NAME_META_KEY) {
      // Identity remount (id === file_name) is handled in TOGGLE_APPROVAL.
      return;
    }
  }

  function syncCanonicalSectionToOsn(osn, sectionKey, cardText) {
    if (!osn || !sectionKey) {
      return;
    }
    if (sectionKey === "seed") {
      osn.seed = String(cardText || "").trim();
      return;
    }
    if (sectionKey === "thematic_lenses") {
      osn.thematic_lenses = parseThematicLensesDraft(cardText);
      return;
    }
    if (sectionKey === "output_spec") {
      osn.output_spec = String(cardText || "").trim();
      return;
    }
    if (sectionKey === "success_evidences") {
      osn.success_evidences = parseSuccessEvidencesDraft(cardText);
    }
    // Bud draft reviews the delivered SUD in-session; it must not rewrite OSN intention fields
    // or the durable bud pointer / build tree.
  }

  function getOsnMaturity(osn) {
    if (!osn || !osn.maturity) {
      return {
        seed: true,
        thematic_lenses: true,
        output_spec: true,
        success_evidences: true,
      };
    }
    return osn.maturity;
  }

  function isSectionUnlocked(osn, sectionKey) {
    if (isOsnMetaSectionKey(sectionKey)) {
      return true;
    }
    if (!isImmatureOsn(osn)) {
      return true;
    }
    const maturity = getOsnMaturity(osn);
    if (sectionKey === "seed") {
      return true;
    }
    if (sectionKey === "thematic_lenses") {
      return maturity.seed === true;
    }
    if (sectionKey === "output_spec") {
      return maturity.thematic_lenses === true;
    }
    if (sectionKey === "success_evidences") {
      return maturity.output_spec === true;
    }
    if (sectionKey === BUD_SECTION_KEY) {
      return hasOpenableBud(osn);
    }
    if (sectionKey === BUILD_SECTION_KEY) {
      return false;
    }
    return true;
  }

  function canApproveImmatureSection(osn, sectionKey, card) {
    if (!card) {
      return false;
    }
    if (isOsnMetaSectionKey(sectionKey)) {
      return String(card.text || "").trim().length > 0;
    }
    if (sectionKey === BUD_SECTION_KEY) {
      return (
        String(card.text || "").trim().length > 0 && card.budLoadState === "loaded"
      );
    }
    if (!isImmatureOsn(osn)) {
      return true;
    }
    if (!isSectionUnlocked(osn, sectionKey)) {
      return false;
    }
    if (sectionKey === "seed") {
      return String(card.text || "").trim().length > 0;
    }
    if (sectionKey === "thematic_lenses") {
      return parseThematicLensesDraft(card.text).length >= 1;
    }
    if (sectionKey === "output_spec") {
      return String(card.text || "").trim().length > 0;
    }
    if (sectionKey === "success_evidences") {
      const evidences = parseSuccessEvidencesDraft(card.text);
      return evidences.length >= 1 && hasDirectSuccessEvidence(evidences);
    }
    return false;
  }

  function isFullyMatureImmatureOsn(osn) {
    if (!isImmatureOsn(osn)) {
      return false;
    }
    const maturity = getOsnMaturity(osn);
    return (
      maturity.seed === true &&
      maturity.thematic_lenses === true &&
      maturity.output_spec === true &&
      maturity.success_evidences === true
    );
  }

  function serializeOsnForCanonize(osn) {
    const payload = JSON.parse(JSON.stringify(osn));
    delete payload.__canonical;
    delete payload.__sourcePath;
    delete payload.__fileLabel;
    delete payload.maturity;
    return payload;
  }

  function serializeOsnForPersist(osn) {
    const payload = serializeOsnForCanonize(osn);
    if (payload.graph && Array.isArray(payload.graph.child_osn_ids)) {
      payload.graph.child_osn_ids = payload.graph.child_osn_ids.filter(function (childId) {
        const child = getOsnById(childId);
        return child && isCanonicalOsn(child);
      });
    }
    return payload;
  }

  function parseOsnTitleProposal(text) {
    const raw = String(text || "")
      .trim()
      .split(/\r?\n/)
      .map(function (line) {
        return line.trim();
      })
      .filter(Boolean)[0] || "";
    const cleaned = raw
      .replace(/^["'`]+|["'`]+$/g, "")
      .replace(/^title\s*:\s*/i, "")
      .replace(/[.!?]+$/g, "")
      .trim();
    const words = cleaned.split(/\s+/).filter(Boolean).slice(0, 2);
    return words.join(" ");
  }

  function parseCockpitTitleProposal(text) {
    const raw = String(text || "")
      .trim()
      .split(/\r?\n/)
      .map(function (line) {
        return line.trim();
      })
      .filter(Boolean)[0] || "";
    const cleaned = raw
      .replace(/^["'`]+|["'`]+$/g, "")
      .replace(/^title\s*:\s*/i, "")
      .replace(/[.!?]+$/g, "")
      .trim();
    const words = cleaned.split(/\s+/).filter(Boolean).slice(0, 8);
    return words.length >= 2 ? words.join(" ") : "";
  }

  function slugifyEvidenceId(kind) {
    const slug = String(kind || "evidence")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 40);
    return slug || "evidence";
  }

  function parseBooleanField(value) {
    const normalized = String(value || "").trim().toLowerCase();
    return normalized === "true" || normalized === "yes" || normalized === "1";
  }

  function parseSuccessEvidencesDraft(text) {
    const raw = String(text || "").trim();
    if (!raw) {
      return [];
    }
    const blocks = raw.split(/\n\s*\n+/);
    const evidences = [];
    const usedIds = new Set();

    function uniqueEvidenceId(kind, index) {
      const slug = slugifyEvidenceId(kind);
      let id = "sev.draft." + slug;
      let suffix = index;
      while (usedIds.has(id)) {
        suffix += 1;
        id = "sev.draft." + slug + "." + String(suffix);
      }
      usedIds.add(id);
      return id;
    }

    blocks.forEach(function (block, index) {
      const lines = block
        .split(/\r?\n/)
        .map(function (line) {
          return line.trim();
        })
        .filter(Boolean);
      if (!lines.length) {
        return;
      }

      const fields = {
        evidence_id: "",
        kind: "",
        direct: false,
        inspection_prompt: "",
      };
      const promptLines = [];

      lines.forEach(function (line) {
        const evidenceIdMatch = line.match(/^evidence_id:\s*(.+)$/i);
        if (evidenceIdMatch) {
          fields.evidence_id = evidenceIdMatch[1].trim();
          return;
        }
        const kindMatch = line.match(/^kind:\s*(.+)$/i);
        if (kindMatch) {
          fields.kind = kindMatch[1].trim();
          return;
        }
        const directMatch = line.match(/^direct:\s*(.+)$/i);
        if (directMatch) {
          fields.direct = parseBooleanField(directMatch[1]);
          return;
        }
        const promptMatch = line.match(/^inspection_prompt:\s*(.*)$/i);
        if (promptMatch) {
          promptLines.push(promptMatch[1].trim());
          return;
        }
        if (promptLines.length) {
          promptLines.push(line);
        }
      });

      fields.inspection_prompt = promptLines.join("\n").trim();
      if (!fields.kind) {
        return;
      }
      if (!fields.evidence_id) {
        fields.evidence_id = uniqueEvidenceId(fields.kind, index);
      } else {
        usedIds.add(fields.evidence_id);
      }
      if (!fields.inspection_prompt) {
        return;
      }

      evidences.push({
        evidence_id: fields.evidence_id,
        kind: fields.kind,
        direct: fields.direct === true,
        inspection_prompt: fields.inspection_prompt,
      });
    });

    return evidences;
  }

  function hasDirectSuccessEvidence(evidences) {
    const api = window.lexiom13EvidenceLinks;
    if (api && typeof api.hasCompliantDirectSuccessEvidence === "function") {
      return api.hasCompliantDirectSuccessEvidence(evidences);
    }
    return Array.isArray(evidences) && evidences.some(function (evidence) {
      return evidence && evidence.direct === true;
    });
  }

  function formatSuccessEvidencesToDraft(evidences) {
    if (!Array.isArray(evidences) || !evidences.length) {
      return "";
    }
    return evidences
      .map(function (evidence) {
        return (
          "evidence_id: " + String(evidence.evidence_id || "") +
          "\nkind: " + String(evidence.kind || "") +
          "\ndirect: " + (evidence.direct === true ? "true" : "false") +
          "\ninspection_prompt: " + String(evidence.inspection_prompt || "")
        );
      })
      .join("\n\n");
  }

  function slugifyLensId(name) {
    const slug = String(name || "lens")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 40);
    return slug || "lens";
  }

  function parseThematicLensesDraft(text) {
    const raw = String(text || "").trim();
    if (!raw) {
      return [];
    }
    const blocks = raw.split(/\n\s*\n+/);
    const lenses = [];
    const usedIds = new Set();

    function uniqueLensId(baseName, index) {
      const slug = slugifyLensId(baseName);
      let id = "lens.draft." + slug;
      let suffix = index;
      while (usedIds.has(id)) {
        suffix += 1;
        id = "lens.draft." + slug + "." + String(suffix);
      }
      usedIds.add(id);
      return id;
    }

    // Context-echo lines GT3 sometimes emits despite the output contract; a lens
    // block that reduces to one of these is dropped so it never reaches the OSN.
    const CONTEXT_ECHO = /^(osn(\s+title)?|node\s*type|title|approved\s+seed|ancestor\s+output\s+specifications|context|guidance|output\s+contract)\s*:?$/i;

    blocks.forEach(function (block, index) {
      const lines = block
        .split(/\r?\n/)
        .map(function (line) {
          return line.trim();
        })
        .filter(Boolean)
        .filter(function (line) {
          // Drop echoed context scaffolding such as "- Title: ..." / "- Node type: ...".
          return !/^[-*]?\s*(title|node\s*type)\s*:/i.test(line);
        });
      if (!lines.length) {
        return;
      }
      const name = lines[0]
        .replace(/^[-*]\s+/, "")
        .replace(/^(lens\s*name:?\s*)/i, "")
        .trim();
      if (CONTEXT_ECHO.test(name)) {
        return;
      }
      let purpose = "";
      for (let i = 1; i < lines.length; i += 1) {
        const purposeMatch = lines[i].match(/^purpose:\s*(.+)$/i);
        if (purposeMatch) {
          purpose = purposeMatch[1].trim();
          break;
        }
        if (!purpose && !/^purpose:/i.test(lines[i])) {
          purpose = lines[i].replace(/^[-*]\s+/, "").trim();
        }
      }
      if (!name || !purpose) {
        return;
      }
      lenses.push({
        lens_id: uniqueLensId(name, index),
        name: name,
        purpose: purpose,
      });
    });

    return lenses;
  }

  function formatThematicLensesToDraft(lenses) {
    if (!Array.isArray(lenses) || !lenses.length) {
      return "";
    }
    return lenses
      .map(function (lens) {
        return String(lens.name || lens.lens_id || "Lens") + "\nPurpose: " + String(lens.purpose || "");
      })
      .join("\n\n");
  }

  function resetImmatureMaturityFrom(osn, fromSectionKey) {
    if (!isImmatureOsn(osn) || !osn.maturity) {
      return;
    }
    if (fromSectionKey === "seed") {
      osn.maturity.seed = false;
      osn.maturity.thematic_lenses = false;
      osn.maturity.output_spec = false;
      osn.maturity.success_evidences = false;
      return;
    }
    if (fromSectionKey === "thematic_lenses") {
      osn.maturity.thematic_lenses = false;
      osn.maturity.output_spec = false;
      osn.maturity.success_evidences = false;
      return;
    }
    if (fromSectionKey === "output_spec") {
      osn.maturity.output_spec = false;
      osn.maturity.success_evidences = false;
      return;
    }
    if (fromSectionKey === "success_evidences") {
      osn.maturity.success_evidences = false;
    }
  }

  function normalizeLoadedOsn(osn) {
    osn.__canonical = true;
    osn.maturity = {
      seed: true,
      thematic_lenses: true,
      output_spec: true,
      success_evidences: true,
    };
    return osn;
  }

  function generateShortOsnUid() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID().replace(/-/g, "").slice(0, 8);
    }
    return String(Date.now()).slice(-8);
  }

  function stripOsnExtension(name) {
    return String(name || "").trim().replace(/\.osn$/i, "");
  }

  function isOsnUidSegment(segment) {
    return /^[a-f0-9]{8}$/i.test(String(segment || ""));
  }

  /** Split "{Path.Stems}.{uid}.osn" into path parts + uid. */
  function splitOsnPathAndUid(idOrFileName) {
    const stem = stripOsnExtension(idOrFileName);
    const parts = stem.split(".").filter(Boolean);
    if (parts.length >= 2 && isOsnUidSegment(parts[parts.length - 1])) {
      return {
        pathParts: parts.slice(0, -1),
        uid: parts[parts.length - 1].toLowerCase(),
      };
    }
    return { pathParts: parts, uid: null };
  }

  /** Build identity where id === file_name === "{path}.{uid}.osn". */
  function buildOsnIdentity(pathParts, uid) {
    const parts = (Array.isArray(pathParts) ? pathParts : [])
      .map(function (part) {
        return String(part || "")
          .trim()
          .replace(/\.osn$/i, "")
          .replace(/[\\/\s]+/g, "_");
      })
      .filter(Boolean);
    const token = String(uid || generateShortOsnUid()).toLowerCase();
    const fileName = parts.concat([token]).join(".") + ".osn";
    return { id: fileName, file_name: fileName };
  }

  function buildChildOsnIdentity(parentOsn, leafStem) {
    const parent = splitOsnPathAndUid(parentOsn && (parentOsn.id || parentOsn.file_name));
    const leaf = String(leafStem || "NewBranch")
      .trim()
      .replace(/\.osn$/i, "")
      .replace(/[\\/\s]+/g, "_") || "NewBranch";
    return buildOsnIdentity(parent.pathParts.concat([leaf]), generateShortOsnUid());
  }

  /**
   * UI label: only the last origin stem before the unique id.
   * Full path stays in id/file_name; left OSNG already shows hierarchy.
   */
  function getOsnOriginLeafLabel(osnOrId) {
    const raw =
      typeof osnOrId === "string"
        ? osnOrId
        : osnOrId
          ? String(osnOrId.file_name || osnOrId.__fileLabel || osnOrId.id || "")
          : "";
    const parsed = splitOsnPathAndUid(raw);
    if (parsed.pathParts.length) {
      return parsed.pathParts[parsed.pathParts.length - 1];
    }
    const stem = stripOsnExtension(raw);
    if (stem) {
      return stem;
    }
    if (osnOrId && typeof osnOrId === "object" && osnOrId.title) {
      return String(osnOrId.title);
    }
    return "OSN";
  }

  function getOsnFileNameStem(osn) {
    return getOsnOriginLeafLabel(osn);
  }

  function isPlaceholderBranchLeaf(leaf) {
    return /^NewBranch_\d+$/i.test(String(leaf || "").trim());
  }

  /** Turn an OSN title into a PascalCase origin leaf (e.g. "Function Shapes" → FunctionShapes). */
  function slugifyTitleToOriginLeaf(title) {
    const words = String(title || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!words.length) {
      return "";
    }
    const leaf = words
      .map(function (word) {
        const cleaned = word.replace(/[^A-Za-z0-9_-]/g, "");
        if (!cleaned) {
          return "";
        }
        return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
      })
      .join("");
    return leaf.slice(0, 64);
  }

  /**
   * Before first disk write, replace placeholder NewBranch_* leaf with the matured OSN title
   * so the left OSNG label matches the created OSN name immediately after canonization.
   */
  function promotePlaceholderBranchIdentityForCanonize(osn) {
    if (!osn || !isImmatureOsn(osn)) {
      return osn.id;
    }
    const currentLeaf = getOsnOriginLeafLabel(osn);
    if (!isPlaceholderBranchLeaf(currentLeaf)) {
      return osn.id;
    }

    const titleCard = state.draftCardsByOsnId.get(getDraftCardId(osn.id, OSN_TITLE_META_KEY));
    const titleText = String((titleCard && titleCard.text) || osn.title || "").trim();
    if (!titleText || /^new\s*branch$/i.test(titleText)) {
      return osn.id;
    }

    const nextLeaf = slugifyTitleToOriginLeaf(titleText);
    if (!nextLeaf || nextLeaf === currentLeaf) {
      return osn.id;
    }

    const identity = rebuildOsnIdentityFromLeafLabel(osn, nextLeaf, state.osnsById);
    remountOsnIdentity(state, osn, identity);

    if (!osn.title || isPlaceholderBranchLeaf(osn.title) || /^new\s*branch$/i.test(osn.title)) {
      osn.title = titleText;
    }

    const fileCard = state.draftCardsByOsnId.get(getDraftCardId(osn.id, OSN_FILE_NAME_META_KEY));
    if (fileCard) {
      fileCard.text = nextLeaf;
      fileCard.approved = true;
      state.draftCardsByOsnId.set(fileCard.id, fileCard);
      state.drafts[fileCard.id] = {
        osnId: osn.id,
        sectionKey: OSN_FILE_NAME_META_KEY,
        text: nextLeaf,
        approved: true,
      };
    }

    return osn.id;
  }

  function deriveOsnFileNameFromStem(stem) {
    const cleaned = String(stem || "")
      .trim()
      .replace(/\.osn$/i, "")
      .replace(/[\\/]+/g, "")
      .replace(/\s+/g, "");
    return (cleaned || "OSN") + ".osn";
  }

  function rebuildOsnIdentityFromLeafLabel(osn, leafLabel, osnsById) {
    const leaf = String(leafLabel || "")
      .trim()
      .replace(/\.osn$/i, "")
      .split(".")
      .filter(Boolean)
      .pop() || "OSN";
    const sanitized = leaf.replace(/[\\/\s]+/g, "_");
    const parsed = splitOsnPathAndUid(osn && (osn.id || osn.file_name));
    const parentIds = Array.isArray(osn && osn.graph && osn.graph.parent_osn_ids)
      ? osn.graph.parent_osn_ids
      : [];
    const lookup = osnsById || state.osnsById;
    let pathParts;
    if (parentIds.length) {
      const parent = lookup.get(parentIds[0]);
      pathParts = splitOsnPathAndUid(parent && (parent.id || parent.file_name)).pathParts.concat([
        sanitized,
      ]);
    } else {
      pathParts = [sanitized];
    }
    return buildOsnIdentity(pathParts, parsed.uid || generateShortOsnUid());
  }

  function remountOsnIdentity(draft, osn, nextIdentity) {
    if (!draft || !osn || !nextIdentity || !nextIdentity.id) {
      return;
    }
    const oldId = osn.id;
    const newId = nextIdentity.id;
    if (oldId === newId) {
      osn.file_name = nextIdentity.file_name;
      osn.__fileLabel = nextIdentity.file_name;
      return;
    }

    osn.id = newId;
    osn.file_name = nextIdentity.file_name;
    osn.__fileLabel = nextIdentity.file_name;

    draft.osnsById.delete(oldId);
    draft.osnsById.set(newId, osn);

    const runtimeIndex = draft.runtimeOsnIds.indexOf(oldId);
    if (runtimeIndex !== -1) {
      draft.runtimeOsnIds[runtimeIndex] = newId;
    }
    if (draft.expandedOsnIds.has(oldId)) {
      draft.expandedOsnIds.delete(oldId);
      draft.expandedOsnIds.add(newId);
    }
    if (draft.selectedOsnId === oldId) {
      draft.selectedOsnId = newId;
    }

    draft.osnsById.forEach(function (entry) {
      if (!entry || !entry.graph || !Array.isArray(entry.graph.child_osn_ids)) {
        return;
      }
      entry.graph.child_osn_ids = entry.graph.child_osn_ids.map(function (childId) {
        return childId === oldId ? newId : childId;
      });
    });

    Array.from(draft.draftCardsByOsnId.keys()).forEach(function (cardId) {
      const card = draft.draftCardsByOsnId.get(cardId);
      if (!card || card.osnId !== oldId) {
        return;
      }
      const nextCardId = getDraftCardId(newId, card.sectionKey);
      draft.draftCardsByOsnId.delete(cardId);
      card.id = nextCardId;
      card.osnId = newId;
      draft.draftCardsByOsnId.set(nextCardId, card);
      if (draft.drafts[cardId]) {
        draft.drafts[nextCardId] = draft.drafts[cardId];
        draft.drafts[nextCardId].osnId = newId;
        delete draft.drafts[cardId];
      }
    });
  }

  function createImmatureOsnShell(parentOsn) {
    state.branchSequence += 1;
    const leafStem = "NewBranch_" + String(state.branchSequence);
    const identity = buildChildOsnIdentity(parentOsn, leafStem);
    const parentOwner = parentOsn && parentOsn.owner ? parentOsn.owner : null;
    return {
      schema_version: "osn/0.2",
      id: identity.id,
      file_name: identity.file_name,
      node_type: "discipline",
      title: "New Branch",
      owner: parentOwner
        ? {
            owner_id: parentOwner.owner_id,
            display_name: parentOwner.display_name,
            role: parentOwner.role || "OSN Owner",
          }
        : {
            owner_id: "player",
            display_name: "Player",
            role: "OSN Owner",
          },
      graph: {
        parent_osn_ids: [parentOsn.id],
        child_osn_ids: [],
        standard_ancestor_osn_ids: [],
        derived_from_lens_id: null,
      },
      seed: "",
      thematic_lenses: [],
      output_spec: "",
      success_evidences: [],
      compilation: {
        can_be_compilation_root: false,
        compilation_scope: "self_only",
        target_tool_profile: null,
      },
      __canonical: false,
      __fileLabel: identity.file_name,
      maturity: {
        seed: false,
        thematic_lenses: false,
        output_spec: false,
        success_evidences: false,
      },
    };
  }

  function getSelectedOsn() {
    return getOsnById(state.selectedOsnId) || state.orderedOsns[0] || null;
  }

  function isOsnExpanded(osnId) {
    return state.expandedOsnIds.has(osnId);
  }

  function setOsnExpanded(osnId, expanded) {
    if (expanded) {
      state.expandedOsnIds.add(osnId);
      return;
    }
    state.expandedOsnIds.delete(osnId);
  }

  function getSectionLabel(sectionKey) {
    if (sectionKey === BUILD_SECTION_KEY) {
      return "Build";
    }
    if (sectionKey === BUD_SECTION_KEY) {
      return BUD_SECTION_DEF.label;
    }
    const metaMatch = OSN_META_FIELD_DEFS.find(function (section) {
      return section.key === sectionKey;
    });
    if (metaMatch) {
      return metaMatch.label;
    }
    const match = OSN_SECTION_DEFS.find(function (section) {
      return section.key === sectionKey;
    });
    return match ? match.label : sectionKey;
  }

  function hasOpenableBud(osn) {
    const bud = osn && osn.bud;
    if (!bud || typeof bud !== "object") {
      return false;
    }
    const status = String(bud.status || "").toLowerCase();
    return status === "ready" || status === "stale" || status === "";
  }

  function applyBudFromRunResult(osnId, runResult) {
    if (!runResult || !runResult.bud_written || !runResult.bud) {
      return;
    }
    const osn = getOsnById(osnId);
    if (!osn) {
      return;
    }
    osn.bud = runResult.bud;
  }

  function canBuildOsn(osn) {
    return !!(osn && osn.compilation && osn.compilation.can_be_compilation_root);
  }

  function getBuildLifecycle(osnId) {
    return state.buildLifecycleByOsnId.get(String(osnId || "")) || null;
  }

  function isBuildLifecycleActive(entry) {
    return !!(entry && BUILD_ACTIVE_PHASES.has(entry.phase));
  }

  function persistBuildLifecycleState() {
    try {
      const rows = Array.from(state.buildLifecycleByOsnId.entries());
      window.localStorage.setItem(BUILD_LIFECYCLE_STORAGE_KEY, JSON.stringify(rows));
    } catch (_error) {
      /* localStorage may be unavailable; runtime indication still works */
    }
  }

  function restoreBuildLifecycleState() {
    try {
      const raw = window.localStorage.getItem(BUILD_LIFECYCLE_STORAGE_KEY);
      const rows = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(rows)) return;
      rows.forEach(function (row) {
        if (!Array.isArray(row) || !row[0] || !row[1]) return;
        state.buildLifecycleByOsnId.set(String(row[0]), row[1]);
      });
    } catch (_error) {
      /* ignore malformed/stale browser state */
    }
  }

  function setBuildLifecycle(osnId, patch) {
    const id = String(osnId || "");
    if (!id) return null;
    const previous = getBuildLifecycle(id) || {
      phase: "idle",
      startedAt: null,
      completedAt: null,
      runId: null,
      detail: null,
    };
    const next = Object.assign({}, previous, patch || {}, {
      updatedAt: new Date().toISOString(),
    });
    state.buildLifecycleByOsnId.set(id, next);
    persistBuildLifecycleState();
    return next;
  }

  function syncBuildLifecycleFromRunResult(osnId, runResult) {
    if (!runResult) return getBuildLifecycle(osnId);
    const status = String(runResult.status || "").toLowerCase();
    const handoff = runResult.handoff || {};
    const runId = handoff.run_id || runResult.run_id || null;
    if (status === "running") {
      return setBuildLifecycle(osnId, {
        phase: "running",
        runId: runId,
        startedAt:
          runResult.started_at ||
          (getBuildLifecycle(osnId) && getBuildLifecycle(osnId).startedAt) ||
          new Date().toISOString(),
        completedAt: null,
        detail: runResult.detail || "VAL is active.",
      });
    }
    if (status === "completed") {
      applyBudFromRunResult(osnId, runResult);
      return setBuildLifecycle(osnId, {
        phase: "completed",
        runId: runId,
        completedAt: runResult.completed_at || new Date().toISOString(),
        detail:
          runResult.detail ||
          (runResult.bud_written ? "Build completed — Bud ready." : "Build completed."),
      });
    }
    if (status === "agent_failed" || status === "agent_unavailable" || status === "failed") {
      return setBuildLifecycle(osnId, {
        phase: "failed",
        runId: runId,
        completedAt: runResult.completed_at || new Date().toISOString(),
        detail: runResult.detail || runResult.reason || status,
      });
    }
    return getBuildLifecycle(osnId);
  }

  function getBuildPhaseLabel(entry) {
    if (!entry) return "Ready to build";
    if (entry.phase === "preparing") return "Preparing compilation worktree";
    if (entry.phase === "prepared") return "Build directory prepared";
    if (entry.phase === "running") {
      return entry.detail && /collecting evidences/i.test(String(entry.detail))
        ? "Collecting evidences"
        : "VAL active";
    }
    if (entry.phase === "completed") return "Build completed";
    if (entry.phase === "failed") return "Build failed";
    return "Ready to build";
  }

  function formatBuildElapsed(entry) {
    if (!entry || !entry.startedAt) return "";
    const end = entry.completedAt ? Date.parse(entry.completedAt) : Date.now();
    const start = Date.parse(entry.startedAt);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return "";
    const totalSeconds = Math.max(0, Math.floor((end - start) / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes > 0 ? minutes + "m " + seconds + "s" : seconds + "s";
  }

  function getBuildGlyphMarkup(osn, lifecycle) {
    if (!canBuildOsn(osn)) {
      return "🔌";
    }
    return (
      '<span class="lexiom-osn-build-bulb" aria-hidden="true">' +
      '<svg viewBox="0 0 16 16" width="14" height="14" focusable="false">' +
      '<path fill="currentColor" d="M8 1.2a4.5 4.5 0 0 0-2.3 8.38V11a.85.85 0 0 0 .85.85h3a.85.85 0 0 0 .85-.85V9.58A4.5 4.5 0 0 0 8 1.2zm-1.25 10.35h2.5v.6a1.15 1.15 0 0 1-2.3 0v-.6z"/>' +
      "</svg></span>"
    );
  }

  // Monochrome section glyphs for the center section strip: replace text labels
  // so the strip stays scannable. Labels remain on aria-label / title for clarity.
  function getSectionGlyphMarkup(sectionKey) {
    const svgOpen =
      '<span class="lexiom-osn-section-glyph" aria-hidden="true">' +
      '<svg viewBox="0 0 16 16" width="14" height="14" focusable="false">';
    const svgClose = "</svg></span>";
    if (sectionKey === "seed") {
      // Almond / seed shape
      return (
        svgOpen +
        '<ellipse cx="8" cy="8" rx="3.2" ry="5.4" fill="none" stroke="currentColor" stroke-width="1.35" transform="rotate(-28 8 8)"/>' +
        svgClose
      );
    }
    if (sectionKey === "thematic_lenses") {
      // Sprouting seed (thematic prism)
      return (
        '<span class="lexiom-osn-section-glyph" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" focusable="false">' +
        '<path d="M12 19.5V11"/>' +
        '<path d="M12 11c0-3.2 2.2-5.6 5.2-6.2-0.4 3.4-2.4 5.6-5.2 6.2z"/>' +
        '<path d="M12 11c0-3.2-2.2-5.6-5.2-6.2 0.4 3.4 2.4 5.6 5.2 6.2z"/>' +
        "</svg></span>"
      );
    }
    if (sectionKey === "output_spec") {
      // Document
      return (
        svgOpen +
        '<path fill="none" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round" d="M4.2 1.8h5.2L11.8 4.2v10H4.2z"/>' +
        '<path fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" d="M9.2 1.9v2.6h2.5M5.8 7.4h4.4M5.8 9.5h4.4M5.8 11.6h3.1"/>' +
        svgClose
      );
    }
    if (sectionKey === "success_evidences") {
      // Approved checkbox
      return (
        svgOpen +
        '<rect x="1.8" y="1.8" width="12.4" height="12.4" rx="2" fill="none" stroke="currentColor" stroke-width="1.35"/>' +
        '<path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="M4.4 8.1l2.3 2.3 4.9-4.9"/>' +
        svgClose
      );
    }
    if (sectionKey === BUD_SECTION_KEY) {
      // Flower (delivered bloom)
      return (
        svgOpen +
        '<path fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" d="M8 5.2c0-1.5 1.1-2.6 2.4-2.6-.2 1.5-1.1 2.6-2.4 2.6z"/>' +
        '<path fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" d="M8 5.2c0-1.5-1.1-2.6-2.4-2.6.2 1.5 1.1 2.6 2.4 2.6z"/>' +
        '<path fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" d="M9.6 6.6c1.3-.8 2.9-.6 3.4.6-1.4.5-2.9.3-3.4-.6z"/>' +
        '<path fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" d="M6.4 6.6c-1.3-.8-2.9-.6-3.4.6 1.4.5 2.9.3 3.4-.6z"/>' +
        '<path fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" d="M8 7.8c1.1 1.1 1.1 2.8 0 3.5-1.1-.7-1.1-2.4 0-3.5z"/>' +
        '<circle cx="8" cy="6.6" r="1.35" fill="none" stroke="currentColor" stroke-width="1.25"/>' +
        '<path fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" d="M8 10.2v3"/>' +
        svgClose
      );
    }
    return "";
  }

  function getOsnNameEditGlyphMarkup() {
    return (
      '<span class="lexiom-osn-edit-name-glyph" aria-hidden="true">' +
      '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" focusable="false">' +
      '<path d="M11.5 1.8l2.7 2.7L5.2 13.5H2.5v-2.7L11.5 1.8z"/>' +
      '<path d="M10.2 3.1l2.7 2.7"/>' +
      "</svg></span>"
    );
  }

  /**
   * OSN section glyphs (Seed → … → Success Evidences, plus Bud when present).
   * Rendered in the center playfield section strip for the Focus OSN.
   */
  function renderSectionGlyphRow(osn) {
    if (!osn) {
      return "";
    }
    const sections = OSN_SECTION_DEFS.slice();
    if (hasOpenableBud(osn)) {
      sections.push(BUD_SECTION_DEF);
    }
    return (
      '<div class="lexiom-osn-section-row" role="group" aria-label="OSN sections">' +
      sections
        .map(function (section) {
          const sectionUnlocked = isSectionUnlocked(osn, section.key);
          const isSectionSelected =
            !state.selectedEvidenceId && state.selectedSectionKey === section.key;
          const sectionAria =
            section.key === BUD_SECTION_KEY
              ? "Bud — delivered flower"
              : sectionUnlocked
                ? section.label
                : section.label + " (locked)";
          return (
            '<button type="button" id="' +
            toDomId("lexiom-osn-section", osn.id + "-" + section.key) +
            '" class="lexiom-osn-graph-node lexiom-osn-trigger lexiom-osn-section-trigger' +
            (isSectionSelected ? " is-selected" : "") +
            (sectionUnlocked ? "" : " is-locked") +
            '" data-osn-id="' +
            escapeHtml(osn.id) +
            '" data-section-key="' +
            escapeHtml(section.key) +
            '" aria-label="' +
            escapeHtml(sectionAria) +
            '" title="' +
            escapeHtml(sectionAria) +
            '"' +
            (sectionUnlocked ? "" : " disabled") +
            ">" +
            getSectionGlyphMarkup(section.key) +
            "</button>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function getBuildTitle(osn, lifecycle) {
    const label = getOsnOriginLeafLabel(osn);
    if (canBuildOsn(osn)) {
      if (lifecycle && lifecycle.phase === "preparing") {
        return "Preparing build for " + label;
      }
      if (lifecycle && lifecycle.phase === "prepared") {
        return "Build directory prepared — click to activate VAL for " + label;
      }
      if (lifecycle && lifecycle.phase === "running") {
        return "VAL active — building " + label;
      }
      if (lifecycle && lifecycle.phase === "completed") {
        return "Build completed — open report for " + label;
      }
      if (lifecycle && lifecycle.phase === "failed") {
        return "Build failed — open report for " + label;
      }
      return "Build " + label;
    }
    return label + " is not connected to a build agent";
  }

  function getDraftCardId(osnId, sectionKey) {
    return String(osnId) + "::" + String(sectionKey);
  }

  function getLensDraftKey(osnId, sectionKey, lensId) {
    return String(osnId) + "::" + String(sectionKey) + "::" + String(lensId);
  }

  function getLensById(osn, lensId) {
    const lenses = Array.isArray(osn && osn.thematic_lenses) ? osn.thematic_lenses : [];
    return lenses.find(function (lens) {
      return String(lens.lens_id || "") === String(lensId || "");
    }) || null;
  }

  function collectAncestorOsns(osn, seen, results) {
    if (!osn) {
      return;
    }
    const parentIds = Array.isArray(osn.graph && osn.graph.parent_osn_ids) ? osn.graph.parent_osn_ids : [];
    parentIds.forEach(function (parentId) {
      const parent = getOsnById(parentId);
      if (parent && !seen.has(parent.id)) {
        seen.add(parent.id);
        results.push(parent);
        collectAncestorOsns(parent, seen, results);
      }
    });
  }

  function getAncestorOsns(osn) {
    const results = [];
    const seen = new Set();
    if (osn) {
      seen.add(osn.id);
    }
    collectAncestorOsns(osn, seen, results);
    return results;
  }

  function getSelectedOsnAncestorIdSet() {
    const selected = getSelectedOsn();
    const ids = new Set();
    if (!selected) {
      return ids;
    }
    const plane = getActivePlane(selected);
    if (plane && plane.kind === "additional" && plane.rootOsn) {
      const trunk = plane.rootOsn;
      const peers = getPlanePeerOsns(plane);
      const isPeer = peers.some(function (peer) {
        return peer.id === selected.id;
      });
      if (isPeer || selected.id === trunk.id) {
        getFocusAncestorChain(trunk).forEach(function (ancestor) {
          ids.add(ancestor.id);
        });
        if (isPeer) {
          ids.add(trunk.id);
        }
        return ids;
      }
    }
    getAncestorOsns(selected).forEach(function (ancestor) {
      ids.add(ancestor.id);
    });
    return ids;
  }

  /**
   * Primary-parent ancestor chain for the Focus-centered left graph, ordered
   * root-first so the chain paints top-down as a straight vertical line ending
   * at the Focus OSN. Follows parent_osn_ids[0] (POC primary chain).
   */
  function getFocusAncestorChain(focusOsn) {
    const chain = [];
    const seen = new Set(focusOsn ? [focusOsn.id] : []);
    let current = focusOsn;
    while (current) {
      const parentIds = Array.isArray(current.graph && current.graph.parent_osn_ids)
        ? current.graph.parent_osn_ids
        : [];
      const parent = parentIds.length ? getOsnById(parentIds[0]) : null;
      if (!parent || seen.has(parent.id)) {
        break;
      }
      seen.add(parent.id);
      chain.unshift(parent);
      current = parent;
    }
    return chain;
  }

  /**
   * PlaneShift: collect standard_ancestor_osn_ids from the Focus OSN only.
   * Native-plane parents are not walked — a child like UX does not inherit
   * ProductLexiom’s alternate-plane links for shadow / plane listing.
   */
  function collectStandardAncestorIds(focusOsn) {
    const ids = [];
    const seen = new Set();
    if (!focusOsn) {
      return ids;
    }
    const list = Array.isArray(focusOsn.graph && focusOsn.graph.standard_ancestor_osn_ids)
      ? focusOsn.graph.standard_ancestor_osn_ids
      : [];
    list.forEach(function (rawId) {
      const id = String(rawId || "").trim();
      if (!id || seen.has(id) || !getOsnById(id)) {
        return;
      }
      seen.add(id);
      ids.push(id);
    });
    return ids;
  }

  function focusOwnsAlternatePlanes(focusOsn) {
    return getAdditionalPlanes(focusOsn).length > 0;
  }

  function focusBelongsOnAdditionalPlane(focusOsn, plane) {
    if (!focusOsn || !plane || plane.kind !== "additional" || !plane.rootOsn) {
      return false;
    }
    const trunk = plane.rootOsn;
    if (focusOsn.id === trunk.id) {
      return true;
    }
    if (
      getPlanePeerOsns(plane).some(function (peer) {
        return peer.id === focusOsn.id;
      })
    ) {
      return true;
    }
    if (isOsnDescendantOf(focusOsn, trunk)) {
      return true;
    }
    return collectStandardAncestorIds(focusOsn).some(function (stdId) {
      return plane.id === "std:" + stdId;
    });
  }

  /** Drop session plane lock when Focus is outside that alternate plane. */
  function reconcileLockedPlaneForFocus(focusOsn) {
    const lockedId = state.ui.lockedPlaneId || PLANE_NATIVE_ID;
    if (!lockedId || lockedId === PLANE_NATIVE_ID) {
      return;
    }
    const stdId = lockedId.indexOf("std:") === 0 ? lockedId.slice(4) : lockedId;
    const lockedPlane = buildAdditionalPlane(stdId);
    if (!focusBelongsOnAdditionalPlane(focusOsn, lockedPlane)) {
      state.ui.lockedPlaneId = PLANE_NATIVE_ID;
    }
  }

  function getOsnDisplayTitle(osn) {
    if (!osn) {
      return "Plane";
    }
    const title = String(osn.title || "").trim();
    if (title) {
      return title;
    }
    return getOsnOriginLeafLabel(osn);
  }

  /** Eldest OSN on the primary-parent chain (tree/sub-tree root). */
  function resolvePlaneEldestRootOsn(osn) {
    if (!osn) {
      return null;
    }
    const chain = getFocusAncestorChain(osn);
    return chain.length ? chain[0] : osn;
  }

  /**
   * Thematic plane display name: always the origin-leaf of the eldest root
   * (e.g. WebAppSecurity for every OSN under that security tree).
   */
  function getThematicPlaneName(eldestRootOsn) {
    if (!eldestRootOsn) {
      return "Plane";
    }
    return getOsnOriginLeafLabel(eldestRootOsn);
  }

  /** Trim seed/title into a 7–9 word influence blurb for the plane picker. */
  function describePlaneInfluence(plane) {
    const root = plane && (plane.nameRootOsn || plane.rootOsn);
    const seed = String((root && root.seed) || "").replace(/\s+/g, " ").trim();
    const title = getOsnDisplayTitle(root);
    const source = seed || title;
    const words = source.split(/\s+/).filter(Boolean);
    if (words.length <= 9) {
      if (words.length >= 7) {
        return words.join(" ");
      }
      const padded = words.slice();
      while (padded.length < 7 && title) {
        const titleWords = title.split(/\s+/).filter(Boolean);
        for (let i = 0; i < titleWords.length && padded.length < 7; i += 1) {
          if (padded.indexOf(titleWords[i]) === -1) {
            padded.push(titleWords[i]);
          } else {
            padded.push(titleWords[i]);
          }
        }
        if (padded.length < 7) {
          padded.push("influence");
        }
      }
      return padded.slice(0, 9).join(" ");
    }
    return words.slice(0, 9).join(" ");
  }

  function getNativePlane(focusOsn) {
    const rootOsn = resolvePlaneEldestRootOsn(focusOsn) || focusOsn;
    return {
      id: PLANE_NATIVE_ID,
      kind: "native",
      name: getThematicPlaneName(rootOsn),
      rootOsn: rootOsn,
      nameRootOsn: rootOsn,
      description: describePlaneInfluence({ rootOsn: rootOsn, nameRootOsn: rootOsn }),
    };
  }

  function buildAdditionalPlane(stdId) {
    const trunk = getOsnById(stdId);
    if (!trunk) {
      return null;
    }
    const nameRootOsn = resolvePlaneEldestRootOsn(trunk) || trunk;
    const plane = {
      id: "std:" + stdId,
      kind: "additional",
      name: getThematicPlaneName(nameRootOsn),
      rootOsn: trunk,
      nameRootOsn: nameRootOsn,
      standardAncestorId: stdId,
      description: "",
    };
    plane.description = describePlaneInfluence(plane);
    return plane;
  }

  function getAdditionalPlanes(focusOsn) {
    return collectStandardAncestorIds(focusOsn)
      .map(buildAdditionalPlane)
      .filter(Boolean);
  }

  function listPlanesForFocus(focusOsn) {
    if (!focusOsn) {
      return [];
    }
    const planes = [getNativePlane(focusOsn)].concat(getAdditionalPlanes(focusOsn));
    const lockedId = state.ui.lockedPlaneId || PLANE_NATIVE_ID;
    if (
      lockedId &&
      lockedId !== PLANE_NATIVE_ID &&
      !planes.some(function (plane) {
        return plane.id === lockedId;
      })
    ) {
      const stdId =
        lockedId.indexOf("std:") === 0 ? lockedId.slice(4) : lockedId;
      const lockedPlane = buildAdditionalPlane(stdId);
      if (lockedPlane) {
        planes.push(lockedPlane);
      }
    }
    return planes;
  }

  function getResolvedActivePlaneId(focusOsn) {
    const planes = listPlanesForFocus(focusOsn);
    if (!planes.length) {
      return PLANE_NATIVE_ID;
    }
    const lockedId = state.ui.lockedPlaneId || PLANE_NATIVE_ID;
    if (
      lockedId &&
      planes.some(function (plane) {
        return plane.id === lockedId;
      })
    ) {
      return lockedId;
    }
    const remembered = focusOsn
      ? state.activePlaneByOsnId.get(String(focusOsn.id))
      : null;
    if (
      remembered &&
      planes.some(function (plane) {
        return plane.id === remembered;
      })
    ) {
      return remembered;
    }
    return PLANE_NATIVE_ID;
  }

  function getActivePlane(focusOsn) {
    const planeId = getResolvedActivePlaneId(focusOsn);
    const planes = listPlanesForFocus(focusOsn);
    return (
      planes.find(function (plane) {
        return plane.id === planeId;
      }) ||
      planes[0] ||
      null
    );
  }

  /**
   * Peers under additional-plane trunk S: native children of S, then OSNs that
   * inherit S via standard_ancestor_osn_ids (grafted, e.g. ProductLexiom).
   */
  function getPlanePeerOsns(plane) {
    if (!plane || !plane.rootOsn) {
      return [];
    }
    const trunk = plane.rootOsn;
    const trunkId = String(trunk.id);
    const peers = [];
    const seen = new Set();
    const childIds = Array.isArray(trunk.graph && trunk.graph.child_osn_ids)
      ? trunk.graph.child_osn_ids
      : [];
    childIds.forEach(function (childId) {
      const child = getOsnById(childId);
      if (!child || seen.has(child.id)) {
        return;
      }
      seen.add(child.id);
      peers.push(child);
    });
    state.orderedOsns.forEach(function (osn) {
      if (!osn || seen.has(osn.id) || osn.id === trunkId) {
        return;
      }
      const stdIds = Array.isArray(osn.graph && osn.graph.standard_ancestor_osn_ids)
        ? osn.graph.standard_ancestor_osn_ids
        : [];
      if (
        stdIds.some(function (id) {
          return String(id) === trunkId;
        })
      ) {
        seen.add(osn.id);
        peers.push(osn);
      }
    });
    return peers;
  }

  function isOsnDescendantOf(osn, ancestorOsn) {
    if (!osn || !ancestorOsn) {
      return false;
    }
    if (osn.id === ancestorOsn.id) {
      return true;
    }
    const seen = new Set();
    let current = osn;
    while (current) {
      if (seen.has(current.id)) {
        break;
      }
      seen.add(current.id);
      const parentIds = Array.isArray(current.graph && current.graph.parent_osn_ids)
        ? current.graph.parent_osn_ids
        : [];
      const parent = parentIds.length ? getOsnById(parentIds[0]) : null;
      if (!parent) {
        return false;
      }
      if (parent.id === ancestorOsn.id) {
        return true;
      }
      current = parent;
    }
    return false;
  }

  /**
   * Additional-plane ancestor column: primary-parent chain of trunk S,
   * root-first ending at S (e.g. WebAppSecurity → AccessControl). Never insert
   * S's children here — they are Focus siblings / peers on this plane.
   */
  function fitAdditionalPlaneAncestorRows(trunkOsn) {
    if (!trunkOsn) {
      return [];
    }
    const chain = getFocusAncestorChain(trunkOsn).concat([trunkOsn]);
    const graphHeight = els.graph ? els.graph.clientHeight : 0;
    const measuredRow = els.graph && els.graph.querySelector(".lexiom-osn-node-row");
    const rowHeight = measuredRow
      ? Math.max(24, measuredRow.getBoundingClientRect().height)
      : 28;
    const rowStep = rowHeight + 6;
    const remainingHeight = graphHeight > 0
      ? Math.max(0, graphHeight - rowHeight - 16)
      : Number.POSITIVE_INFINITY;
    const ancestorBudgetCap = remainingHeight === Number.POSITIVE_INFINITY
      ? Number.POSITIVE_INFINITY
      : remainingHeight * 0.25;
    const visible = [];
    let budget = ancestorBudgetCap;
    for (let index = chain.length - 1; index >= 0; index -= 1) {
      if (budget < rowStep) {
        break;
      }
      visible.unshift(chain[index]);
      budget -= rowStep;
    }
    if (!visible.length) {
      visible.push(trunkOsn);
    }
    return visible;
  }

  function getActivePlaneView(focusOsn, planeId) {
    const planes = listPlanesForFocus(focusOsn);
    const plane =
      planes.find(function (entry) {
        return entry.id === planeId;
      }) ||
      planes[0] ||
      null;
    if (!focusOsn || !plane) {
      return {
        plane: plane,
        ancestorOsns: [],
        descendantIds: new Set(),
        descendantOrder: [],
        descendantMode: "empty",
      };
    }
    if (plane.kind === "native") {
      const fitted = fitGraphViewport(focusOsn, getFocusAncestorChain(focusOsn), {
        skipDescendants: false,
      });
      return {
        plane: plane,
        ancestorOsns: fitted.ancestors,
        descendantIds: fitted.descendantIds,
        descendantOrder: [],
        descendantMode: "native",
      };
    }

    const trunk = plane.rootOsn;
    const peers = getPlanePeerOsns(plane);
    const peerIds = peers.map(function (peer) {
      return peer.id;
    });
    const peerIdSet = new Set(peerIds);

    if (trunk && focusOsn.id === trunk.id) {
      return {
        plane: plane,
        ancestorOsns: fitAdditionalPlaneAncestorRows(trunk).filter(function (row) {
          return row.id !== trunk.id;
        }),
        descendantIds: peerIdSet,
        descendantOrder: peerIds,
        descendantMode: "plane-peers",
      };
    }

    if (peerIdSet.has(focusOsn.id)) {
      return {
        plane: plane,
        ancestorOsns: fitAdditionalPlaneAncestorRows(trunk),
        descendantIds: new Set(),
        descendantOrder: [],
        descendantMode: "empty",
      };
    }

    if (trunk && isOsnDescendantOf(focusOsn, trunk)) {
      const fitted = fitGraphViewport(focusOsn, getFocusAncestorChain(focusOsn), {
        skipDescendants: false,
      });
      return {
        plane: plane,
        ancestorOsns: fitted.ancestors,
        descendantIds: fitted.descendantIds,
        descendantOrder: [],
        descendantMode: "native",
      };
    }

    const fitted = fitGraphViewport(focusOsn, getFocusAncestorChain(focusOsn), {
      skipDescendants: false,
    });
    return {
      plane: plane,
      ancestorOsns: fitted.ancestors,
      descendantIds: fitted.descendantIds,
      descendantOrder: [],
      descendantMode: "native",
    };
  }

  function prefersReducedMotion() {
    return !!(
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  /** Siblings of the Focus OSN under its primary parent, in parent child order. */
  function getSiblingOsns(focusOsn) {
    if (!focusOsn) {
      return [];
    }
    const parentIds = Array.isArray(focusOsn.graph && focusOsn.graph.parent_osn_ids)
      ? focusOsn.graph.parent_osn_ids
      : [];
    const parent = parentIds.length ? getOsnById(parentIds[0]) : null;
    if (!parent) {
      return [];
    }
    const childIds = Array.isArray(parent.graph && parent.graph.child_osn_ids)
      ? parent.graph.child_osn_ids
      : [];
    return childIds
      .filter(function (childId) {
        return childId !== focusOsn.id;
      })
      .map(getOsnById)
      .filter(Boolean);
  }

  function getSiblingNavigation(focusOsn) {
    const navigation = { previous: null, next: null };
    if (!focusOsn) {
      return navigation;
    }
    const siblingById = new Map(
      getSiblingOsns(focusOsn).map(function (sibling) {
        return [sibling.id, sibling];
      })
    );
    const parentIds = Array.isArray(focusOsn.graph && focusOsn.graph.parent_osn_ids)
      ? focusOsn.graph.parent_osn_ids
      : [];
    const parent = parentIds.length ? getOsnById(parentIds[0]) : null;
    const childIds = Array.isArray(parent && parent.graph && parent.graph.child_osn_ids)
      ? parent.graph.child_osn_ids
      : [];
    const focusIndex = childIds.indexOf(focusOsn.id);
    if (focusIndex < 0) {
      return navigation;
    }
    for (let index = focusIndex - 1; index >= 0; index -= 1) {
      if (siblingById.has(childIds[index])) {
        navigation.previous = siblingById.get(childIds[index]);
        break;
      }
    }
    for (let index = focusIndex + 1; index < childIds.length; index += 1) {
      if (siblingById.has(childIds[index])) {
        navigation.next = siblingById.get(childIds[index]);
        break;
      }
    }
    return navigation;
  }

  /**
   * PlaneShift siblings: native plane uses primary-parent peers; additional
   * plane uses children of trunk S plus grafted standard-ancestor inheritors
   * (e.g. Authentication / Authorization / ProductLexiom under AccessControl).
   */
  function getPlaneSiblingNavigation(focusOsn, plane) {
    if (!plane || plane.kind !== "additional" || !plane.rootOsn) {
      return getSiblingNavigation(focusOsn);
    }
    const navigation = { previous: null, next: null };
    if (!focusOsn) {
      return navigation;
    }
    const peers = getPlanePeerOsns(plane);
    const focusIndex = peers.findIndex(function (peer) {
      return peer.id === focusOsn.id;
    });
    if (focusIndex < 0) {
      return navigation;
    }
    if (focusIndex > 0) {
      navigation.previous = peers[focusIndex - 1];
    }
    if (focusIndex < peers.length - 1) {
      navigation.next = peers[focusIndex + 1];
    }
    return navigation;
  }

  function collectDescendantOsnsBreadthFirst(focusOsn) {
    const descendants = [];
    const seen = new Set(focusOsn ? [focusOsn.id] : []);
    const queue = focusOsn && Array.isArray(focusOsn.graph && focusOsn.graph.child_osn_ids)
      ? focusOsn.graph.child_osn_ids.slice()
      : [];
    while (queue.length) {
      const osn = getOsnById(queue.shift());
      if (!osn || seen.has(osn.id)) {
        continue;
      }
      seen.add(osn.id);
      descendants.push(osn);
      const childIds = Array.isArray(osn.graph && osn.graph.child_osn_ids)
        ? osn.graph.child_osn_ids
        : [];
      childIds.forEach(function (childId) {
        queue.push(childId);
      });
    }
    return descendants;
  }

  function fitGraphViewport(focusOsn, ancestorChain, options) {
    const skipDescendants = !!(options && options.skipDescendants);
    const graphHeight = els.graph ? els.graph.clientHeight : 0;
    const measuredRow = els.graph && els.graph.querySelector(".lexiom-osn-node-row");
    const rowHeight = measuredRow
      ? Math.max(24, measuredRow.getBoundingClientRect().height)
      : 28;
    const rowStep = rowHeight + 6;
    const hasBuildChild = !!(focusOsn && state.buildPreviewsByOsnId.has(focusOsn.id));
    const focusHeight = rowHeight + (hasBuildChild ? rowStep : 0);
    // Match the 1fr / 3fr grid split: Focus near the top quarter, more room below.
    const remainingHeight = graphHeight > 0
      ? Math.max(0, graphHeight - focusHeight - 16)
      : Number.POSITIVE_INFINITY;
    const ancestorBudgetCap = remainingHeight === Number.POSITIVE_INFINITY
      ? Number.POSITIVE_INFINITY
      : remainingHeight * 0.25;
    const descendantBudgetCap = remainingHeight === Number.POSITIVE_INFINITY
      ? Number.POSITIVE_INFINITY
      : remainingHeight * 0.75;

    const visibleAncestors = [];
    let ancestorBudget = ancestorBudgetCap;
    for (let index = ancestorChain.length - 1; index >= 0; index -= 1) {
      if (ancestorBudget < rowStep) {
        break;
      }
      visibleAncestors.unshift(ancestorChain[index]);
      ancestorBudget -= rowStep;
    }

    const visibleDescendantIds = new Set();
    if (!skipDescendants) {
      let descendantBudget = descendantBudgetCap;
      collectDescendantOsnsBreadthFirst(focusOsn).some(function (descendant) {
        if (descendantBudget < rowStep) {
          return true;
        }
        visibleDescendantIds.add(descendant.id);
        descendantBudget -= rowStep;
        return false;
      });
    }

    return {
      ancestors: visibleAncestors,
      descendantIds: visibleDescendantIds,
    };
  }

  function getAncestorContextForLens(osn) {
    return getAncestorOsns(osn).map(function (ancestor) {
      const outputSpecCard = ensureDraftCardState(ancestor, "output_spec");
      const outputSpecText = outputSpecCard
        ? String(outputSpecCard.text || "").trim()
        : String(ancestor.output_spec || "").trim();
      return Object.assign({}, ancestor, {
        output_spec: outputSpecText,
      });
    });
  }

  function getOsnTreeOutputSpecContext() {
    const results = [];
    const seen = new Set();

    function visit(osn) {
      if (!osn || seen.has(osn.id)) {
        return;
      }
      seen.add(osn.id);
      const outputSpecCard = ensureDraftCardState(osn, "output_spec");
      const outputSpecText = outputSpecCard
        ? String(outputSpecCard.text || "").trim()
        : String(osn.output_spec || "").trim();
      results.push(Object.assign({}, osn, {
        output_spec: outputSpecText,
      }));
      const childIds = Array.isArray(osn.graph && osn.graph.child_osn_ids) ? osn.graph.child_osn_ids : [];
      childIds.forEach(function (childId) {
        visit(getOsnById(childId));
      });
    }

    state.orderedOsns.forEach(function (osn) {
      const parentIds = Array.isArray(osn.graph && osn.graph.parent_osn_ids) ? osn.graph.parent_osn_ids : [];
      const isRoot =
        parentIds.length === 0 ||
        parentIds.every(function (parentId) {
          return !getOsnById(parentId);
        });
      if (isRoot) {
        visit(osn);
      }
    });

    state.orderedOsns.forEach(function (osn) {
      if (!seen.has(osn.id)) {
        visit(osn);
      }
    });

    return results;
  }

  function renderCockpitTitle() {
    if (!els.cockpitTitle) {
      return;
    }
    if (state.ui.cockpitTitlePending) {
      els.cockpitTitle.textContent = "Naming cockpit...";
      els.cockpitTitle.title = "";
      return;
    }
    if (state.ui.cockpitTitleError) {
      els.cockpitTitle.textContent = state.ui.cockpitTitle || COCKPIT_TITLE_FALLBACK;
      els.cockpitTitle.title = state.ui.cockpitTitleError;
      return;
    }
    els.cockpitTitle.textContent = state.ui.cockpitTitle || COCKPIT_TITLE_FALLBACK;
    els.cockpitTitle.title = "";
  }

  function requestCockpitTitleInference() {
    const buildNarrativeFn = window.lexiom13BuildCockpitTitleProposalNarrative;
    const callGT3Fn = window.lexiomGT3 && window.lexiomGT3.callGT3;
    if (!buildNarrativeFn || !callGT3Fn) {
      state.ui.cockpitTitleError = "GT3 client or cockpit title narrative builder is not available.";
      renderCockpitTitle();
      return;
    }
    if (cockpitTitleInferenceInFlight) {
      return;
    }

    const osns = getOsnTreeOutputSpecContext();
    if (!osns.length) {
      return;
    }

    const narrative = buildNarrativeFn({ osns: osns });
    cockpitTitleInferenceInFlight = true;
    state.ui.cockpitTitlePending = true;
    state.ui.cockpitTitleError = null;
    renderCockpitTitle();

    callGT3Fn(narrative, { inferenceType: "L24" })
      .then(function (result) {
        if (result && result.ok && typeof result.text === "string") {
          const title = parseCockpitTitleProposal(result.text);
          if (title) {
            state.ui.cockpitTitle = title;
            state.ui.cockpitTitleError = null;
            appendAction("cockpit_title_inferred", { title: title });
            return;
          }
        }
        state.ui.cockpitTitleError =
          (result && result.error) || "Cockpit title inference returned no usable text.";
      })
      .catch(function (error) {
        state.ui.cockpitTitleError = error && error.message ? error.message : String(error);
      })
      .finally(function () {
        cockpitTitleInferenceInFlight = false;
        state.ui.cockpitTitlePending = false;
        renderCockpitTitle();
      });
  }

  function getLensDraftState(osnId, sectionKey, lensId) {
    return state.lensDraftsByOsnSection.get(getLensDraftKey(osnId, sectionKey, lensId)) || null;
  }

  // Intensity = how many times this exact lens has been applied to this
  // OSN section. Each additional click deepens the center draft further into
  // the lens's semantic realm rather than re-running a one-shot reframe.
  function getLensIntensity(osnId, sectionKey, lensId) {
    return state.lensIntensityByKey.get(getLensDraftKey(osnId, sectionKey, lensId)) || 0;
  }

  function ensureLensThread(osnId, lensId) {
    const key = getLensDraftKey(osnId, "thread", lensId);
    if (!state.lensThreadsByKey.has(key)) {
      state.lensThreadsByKey.set(key, []);
    }
    return state.lensThreadsByKey.get(key);
  }

  function reduceStateForWhite(draft, moveType, payload) {
    if (moveType === "TOGGLE_FULL_GRAPH") {
      draft.ui.fullGraphMode = payload && typeof payload.enabled === "boolean"
        ? payload.enabled
        : !draft.ui.fullGraphMode;
      if (draft.ui.fullGraphMode && payload && payload.kind) {
        draft.ui.fullGraphKind =
          payload.kind === "garden" ? "garden" : "classical";
      }
      if (!draft.ui.fullGraphMode) {
        draft.ui.fullGraphKind = "classical";
      }
      return draft;
    }

    if (moveType === "SET_FULL_GRAPH_KIND") {
      const kind =
        payload && payload.kind === "garden" ? "garden" : "classical";
      draft.ui.fullGraphKind = kind;
      if (!draft.ui.fullGraphMode) {
        draft.ui.fullGraphMode = true;
      }
      return draft;
    }

    if (moveType === "SELECT_OSN") {
      draft.selectedOsnId = payload.osnId;
      draft.selectedSectionKey = payload.sectionKey || DEFAULT_SELECTED_SECTION_KEY;
      draft.selectedEvidenceId = null;
      draft.ui.planePickerOpen = false;
      if (payload.expandOnSelect) {
        draft.expandedOsnIds.add(payload.osnId);
      }
      if (payload.clearLens) {
        draft.selectedLensId = null;
      }
      // Selecting an OSN from the full-graph map returns the player to the cockpit.
      if (draft.ui.fullGraphMode) {
        draft.ui.fullGraphMode = false;
      }
      return draft;
    }

    if (moveType === "TOGGLE_OSN_SECTIONS") {
      draft.selectedOsnId = payload.osnId;
      draft.selectedSectionKey = DEFAULT_SELECTED_SECTION_KEY;
      draft.selectedEvidenceId = null;
      if (payload.expanded) {
        draft.expandedOsnIds.add(payload.osnId);
      } else {
        draft.expandedOsnIds.delete(payload.osnId);
      }
      draft.selectedLensId = null;
      return draft;
    }

    if (moveType === "SELECT_THEMATIC_LENS") {
      draft.selectedOsnId = payload.osnId;
      draft.selectedSectionKey = payload.sectionKey;
      draft.selectedEvidenceId = null;
      draft.selectedLensId = payload.lensId;
      draft.ui.lensInferenceError = null;
      return draft;
    }

    if (moveType === "APPLY_LENS_DRAFT") {
      const card = draft.draftCardsByOsnId.get(getDraftCardId(payload.osnId, payload.sectionKey));
      if (card) {
        card.text = String(payload.text || "");
        card.approved = false;
        card.hasLmDraft = true;
        card.hasUserEdits = false;
        card.editBaselineText = String(card.text || "");
        draft.draftCardsByOsnId.set(card.id, card);
        draft.drafts[card.id] = {
          osnId: payload.osnId,
          sectionKey: payload.sectionKey,
          text: card.text,
          approved: false,
        };
      }
      const lensKey = getLensDraftKey(payload.osnId, payload.sectionKey, payload.lensId);
      draft.lensDraftsByOsnSection.set(lensKey, {
        osnId: payload.osnId,
        sectionKey: payload.sectionKey,
        lensId: payload.lensId,
        text: String(payload.text || ""),
        approved: false,
        hasLmDraft: true,
        hasUserEdits: false,
      });
      draft.lensIntensityByKey.set(lensKey, (draft.lensIntensityByKey.get(lensKey) || 0) + 1);
      draft.ui.pendingLensRefresh = null;
      draft.ui.lensInferencePending = false;
      draft.ui.lensInferenceError = null;
      return draft;
    }

    if (moveType === "CLEAR_PENDING_UI") {
      if (payload && payload.key === "pendingLensRefresh") {
        draft.ui.pendingLensRefresh = null;
        draft.ui.lensInferencePending = false;
      }
      if (payload && payload.key === "lensInferenceError") {
        draft.ui.lensInferenceError = null;
        draft.ui.lensInferencePending = false;
      }
      return draft;
    }

    if (moveType === "SET_LENS_INFERENCE_PENDING") {
      draft.ui.lensInferencePending = !!payload.pending;
      if (payload.error) {
        draft.ui.lensInferenceError = String(payload.error);
      } else if (payload.pending) {
        draft.ui.lensInferenceError = null;
      }
      return draft;
    }

    if (moveType === "APPLY_OSN_TITLE") {
      const osn = draft.osnsById.get(payload.osnId);
      if (osn) {
        const title = parseOsnTitleProposal(payload.title);
        if (title) {
          osn.title = title;
          const titleCardId = getDraftCardId(payload.osnId, OSN_TITLE_META_KEY);
          let titleCard = draft.draftCardsByOsnId.get(titleCardId);
          if (!titleCard) {
            titleCard = {
              id: titleCardId,
              osnId: payload.osnId,
              sectionKey: OSN_TITLE_META_KEY,
              text: title,
              approved: !isImmatureOsn(osn),
              hasLmDraft: true,
              hasUserEdits: false,
            };
            draft.draftCardsByOsnId.set(titleCardId, titleCard);
          } else {
            titleCard.text = title;
            titleCard.hasLmDraft = true;
            titleCard.hasUserEdits = false;
            draft.draftCardsByOsnId.set(titleCardId, titleCard);
          }
          draft.drafts[titleCardId] = {
            osnId: payload.osnId,
            sectionKey: OSN_TITLE_META_KEY,
            text: title,
            approved: titleCard.approved,
          };
        }
      }
      draft.ui.maturationInferencePending = false;
      draft.ui.maturationInferenceError = null;
      return draft;
    }

    if (moveType === "APPLY_MATURATION_DRAFT") {
      const cardId = getDraftCardId(payload.osnId, payload.sectionKey);
      // The proposed section card may not have been rendered yet (a fresh branch
      // is focused on seed), so create it here to avoid dropping the GT3 draft.
      let card = draft.draftCardsByOsnId.get(cardId);
      if (!card) {
        card = {
          id: cardId,
          osnId: payload.osnId,
          sectionKey: payload.sectionKey,
          text: "",
          approved: false,
          hasLmDraft: false,
          hasUserEdits: false,
          editBaselineText: null,
        };
        draft.draftCardsByOsnId.set(cardId, card);
      }
      card.text = String(payload.text || "");
      card.approved = false;
      card.hasLmDraft = true;
      card.hasUserEdits = false;
      card.editBaselineText = String(card.text || "");
      if (payload.sectionKey === "output_spec") {
        draft.ui.cockpitTitleStale = true;
      }
      draft.draftCardsByOsnId.set(card.id, card);
      draft.drafts[card.id] = {
        osnId: payload.osnId,
        sectionKey: payload.sectionKey,
        text: card.text,
        approved: false,
      };
      draft.selectedOsnId = payload.osnId;
      draft.selectedSectionKey = payload.sectionKey;
      draft.selectedEvidenceId = null;
      draft.selectedLensId = null;
      draft.expandedOsnIds.add(payload.osnId);
      draft.ui.pendingMaturationProposal = null;
      draft.ui.maturationInferencePending = false;
      draft.ui.maturationInferenceError = null;
      return draft;
    }

    if (moveType === "SET_MATURATION_INFERENCE_PENDING") {
      draft.ui.maturationInferencePending = !!payload.pending;
      if (payload.error) {
        draft.ui.maturationInferenceError = String(payload.error);
      } else if (payload.pending) {
        draft.ui.maturationInferenceError = null;
      }
      return draft;
    }

    if (moveType === "CLEAR_MATURATION_PENDING") {
      draft.ui.pendingMaturationProposal = null;
      draft.ui.maturationInferencePending = false;
      return draft;
    }

    if (moveType === "SET_CANONIZATION_PENDING") {
      draft.ui.canonizationPending = !!payload.pending;
      if (payload.error) {
        draft.ui.canonizationError = String(payload.error);
      } else if (payload.pending) {
        draft.ui.canonizationError = null;
      }
      return draft;
    }

    if (moveType === "CLEAR_CANONIZATION_PENDING") {
      draft.ui.pendingCanonization = null;
      draft.ui.canonizationPending = false;
      return draft;
    }

    if (moveType === "SET_PERSIST_PENDING") {
      draft.ui.persistPending = !!payload.pending;
      if (payload.error) {
        draft.ui.persistError = String(payload.error);
      } else if (payload.pending) {
        draft.ui.persistError = null;
      }
      return draft;
    }

    if (moveType === "CLEAR_PERSIST_PENDING") {
      draft.ui.pendingPersist = null;
      draft.ui.persistPending = false;
      return draft;
    }

    if (moveType === "APPLY_PERSIST") {
      const osn = draft.osnsById.get(payload.osnId);
      if (osn) {
        if (payload.sourcePath) {
          osn.__sourcePath = String(payload.sourcePath);
        }
        if (payload.fileName) {
          osn.__fileLabel = String(payload.fileName);
        }
      }
      draft.ui.pendingPersist = null;
      draft.ui.persistPending = false;
      draft.ui.persistError = null;
      return draft;
    }

    if (moveType === "SET_PRUNE_PENDING") {
      draft.ui.prunePending = !!payload.pending;
      if (payload.error) {
        draft.ui.pruneError = String(payload.error);
      } else if (payload.pending) {
        draft.ui.pruneError = null;
      }
      return draft;
    }

    if (moveType === "CLEAR_PRUNE_PENDING") {
      draft.ui.pendingPrune = null;
      draft.ui.prunePending = false;
      return draft;
    }

    if (moveType === "APPLY_PRUNE_BRANCH") {
      const prunedIds = Array.isArray(payload.prunedIds) ? payload.prunedIds.map(String) : [];
      const prunedSet = new Set(prunedIds);

      prunedIds.forEach(function (osnId) {
        draft.osnsById.delete(osnId);
        const runtimeIndex = draft.runtimeOsnIds.indexOf(osnId);
        if (runtimeIndex !== -1) {
          draft.runtimeOsnIds.splice(runtimeIndex, 1);
        }
        draft.expandedOsnIds.delete(osnId);
        draft.buildPreviewsByOsnId.delete(osnId);
        Array.from(draft.draftCardsByOsnId.keys()).forEach(function (cardId) {
          const card = draft.draftCardsByOsnId.get(cardId);
          if (card && card.osnId === osnId) {
            draft.draftCardsByOsnId.delete(cardId);
            delete draft.drafts[cardId];
          }
        });
        Array.from(draft.lensDraftsByOsnSection.keys()).forEach(function (key) {
          if (key.indexOf(osnId + "::") === 0) {
            draft.lensDraftsByOsnSection.delete(key);
          }
        });
        Array.from(draft.lensThreadsByKey.keys()).forEach(function (key) {
          if (key.indexOf(osnId + "::") === 0) {
            draft.lensThreadsByKey.delete(key);
          }
        });
      });

      draft.orderedOsns = draft.orderedOsns.filter(function (entry) {
        return entry && !prunedSet.has(entry.id);
      });

      draft.osnsById.forEach(function (osn) {
        if (!osn || !osn.graph || !Array.isArray(osn.graph.child_osn_ids)) {
          return;
        }
        osn.graph.child_osn_ids = osn.graph.child_osn_ids.filter(function (childId) {
          return !prunedSet.has(childId);
        });
      });

      if (prunedSet.has(draft.selectedOsnId)) {
        const fallbackParentIds = Array.isArray(payload.fallbackParentIds) ? payload.fallbackParentIds : [];
        let nextSelected = null;
        fallbackParentIds.forEach(function (parentId) {
          if (!nextSelected && !prunedSet.has(parentId) && draft.osnsById.has(parentId)) {
            nextSelected = parentId;
          }
        });
        if (!nextSelected && draft.orderedOsns.length) {
          nextSelected = draft.orderedOsns[0].id;
        }
        if (nextSelected) {
          draft.selectedOsnId = nextSelected;
          draft.selectedSectionKey = DEFAULT_SELECTED_SECTION_KEY;
          draft.selectedEvidenceId = null;
          draft.selectedLensId = null;
        }
      }

      draft.ui.pendingPrune = null;
      draft.ui.prunePending = false;
      draft.ui.pruneError = null;
      draft.ui.cockpitTitleStale = true;
      return draft;
    }

    if (moveType === "APPLY_CANONIZATION") {
      const osn = draft.osnsById.get(payload.osnId);
      if (!osn) {
        return draft;
      }
      normalizeLoadedOsn(osn);
      osn.__sourcePath = String(payload.sourcePath || "");
      osn.__fileLabel = String(payload.fileName || osn.file_name || osn.id);
      const runtimeIndex = draft.runtimeOsnIds.indexOf(payload.osnId);
      if (runtimeIndex !== -1) {
        draft.runtimeOsnIds.splice(runtimeIndex, 1);
      }
      const alreadyListed = draft.orderedOsns.some(function (entry) {
        return entry && entry.id === payload.osnId;
      });
      if (!alreadyListed) {
        draft.orderedOsns.push(osn);
      }
      draft.ui.pendingCanonization = null;
      draft.ui.canonizationPending = false;
      draft.ui.canonizationError = null;
      return draft;
    }

    if (moveType === "TOGGLE_APPROVAL") {
      const osn = draft.osnsById.get(payload.osnId);
      const card = draft.draftCardsByOsnId.get(getDraftCardId(payload.osnId, payload.sectionKey));
      if (card && osn) {
        const previousFileName = String(osn.file_name || "");
        const nextApproved = !card.approved;
        if (isImmatureOsn(osn) && nextApproved && !canApproveImmatureSection(osn, payload.sectionKey, card)) {
          return draft;
        }
        card.approved = nextApproved;
        if (card.approved) {
          clearDraftEditDiff(card);
        }
        draft.draftCardsByOsnId.set(card.id, card);
        draft.drafts[card.id] = {
          osnId: payload.osnId,
          sectionKey: payload.sectionKey,
          text: card.text,
          approved: card.approved,
        };
        if (draft.selectedLensId) {
          const lensKey = getLensDraftKey(payload.osnId, payload.sectionKey, draft.selectedLensId);
          const lensDraft = draft.lensDraftsByOsnSection.get(lensKey);
          if (lensDraft) {
            lensDraft.approved = card.approved;
            draft.lensDraftsByOsnSection.set(lensKey, lensDraft);
          }
        }
        if (isImmatureOsn(osn) && payload.sectionKey === "seed") {
          if (card.approved) {
            osn.maturity.seed = true;
            osn.seed = String(card.text || "").trim();
          } else {
            resetImmatureMaturityFrom(osn, "seed");
            osn.seed = "";
          }
        }
        if (isImmatureOsn(osn) && payload.sectionKey === "thematic_lenses") {
          if (card.approved) {
            osn.maturity.thematic_lenses = true;
            osn.thematic_lenses = parseThematicLensesDraft(card.text);
          } else {
            resetImmatureMaturityFrom(osn, "thematic_lenses");
            osn.thematic_lenses = [];
          }
        }
        if (isImmatureOsn(osn) && payload.sectionKey === "output_spec") {
          if (card.approved) {
            osn.maturity.output_spec = true;
            osn.output_spec = String(card.text || "").trim();
          } else {
            resetImmatureMaturityFrom(osn, "output_spec");
            osn.output_spec = "";
          }
        }
        if (payload.sectionKey === "output_spec") {
          draft.ui.cockpitTitleStale = true;
        }
        if (isImmatureOsn(osn) && payload.sectionKey === "success_evidences") {
          if (card.approved) {
            osn.maturity.success_evidences = true;
            osn.success_evidences = parseSuccessEvidencesDraft(card.text);
          } else {
            resetImmatureMaturityFrom(osn, "success_evidences");
            osn.success_evidences = [];
          }
        }
        if (card.approved && isOsnMetaSectionKey(payload.sectionKey)) {
          if (payload.sectionKey === OSN_FILE_NAME_META_KEY) {
            remountOsnIdentity(
              draft,
              osn,
              rebuildOsnIdentityFromLeafLabel(osn, card.text, draft.osnsById)
            );
          } else {
            syncMetaSectionToOsn(osn, payload.sectionKey, card.text);
          }
        }
        if (card.approved && isCanonicalOsn(osn) && !isOsnMetaSectionKey(payload.sectionKey)) {
          if (payload.sectionKey !== BUD_SECTION_KEY) {
            syncCanonicalSectionToOsn(osn, payload.sectionKey, card.text);
          }
        }
        if (
          card.approved &&
          isCanonicalOsn(osn) &&
          payload.sectionKey !== BUD_SECTION_KEY
        ) {
          draft.ui.pendingPersist = {
            osnId: payload.osnId,
            sectionKey: payload.sectionKey,
            previousFileName: previousFileName,
          };
        }
      }
      return draft;
    }

    if (moveType === "BRANCH_OSN") {
      const parent = draft.osnsById.get(payload.parentOsnId);
      if (!parent) {
        return draft;
      }
      const child = createImmatureOsnShell(parent);
      draft.osnsById.set(child.id, child);
      draft.runtimeOsnIds.push(child.id);
      if (!parent.graph) {
        parent.graph = {};
      }
      if (!Array.isArray(parent.graph.child_osn_ids)) {
        parent.graph.child_osn_ids = [];
      }
      if (parent.graph.child_osn_ids.indexOf(child.id) === -1) {
        parent.graph.child_osn_ids.push(child.id);
      }
      draft.expandedOsnIds.add(payload.parentOsnId);
      draft.expandedOsnIds.add(child.id);
      draft.selectedOsnId = child.id;
      draft.selectedSectionKey = DEFAULT_SELECTED_SECTION_KEY;
      draft.selectedEvidenceId = null;
      draft.selectedLensId = null;
      draft.ui.cockpitTitleStale = true;
      return draft;
    }

    if (moveType === "PRUNE_OSN_BRANCH") {
      const rootOsn = draft.osnsById.get(payload.osnId);
      const subtreeIds = collectBranchSubtreeIds(payload.osnId);
      if (!rootOsn || !subtreeIds.length) {
        return draft;
      }
      draft.ui.pendingPrune = {
        rootOsnId: payload.osnId,
        prunedIds: subtreeIds,
        confirmRootPrune: !!payload.confirmRootPrune,
        fallbackParentIds: Array.isArray(rootOsn.graph && rootOsn.graph.parent_osn_ids)
          ? rootOsn.graph.parent_osn_ids.slice()
          : [],
        runtimeOnly: subtreeIds.every(function (id) {
          const entry = draft.osnsById.get(id);
          return entry && isImmatureOsn(entry);
        }),
      };
      return draft;
    }

    if (moveType === "SUBMIT_CAUSAL_QUESTION") {
      const questionText = String(payload.questionText || "").trim();
      if (!questionText) {
        return draft;
      }
      const key = getCausalEvidenceKey(payload.osnId, payload.evidenceId);
      if (!draft.causalThreadsByEvidenceKey.has(key)) {
        draft.causalThreadsByEvidenceKey.set(key, []);
      }
      const thread = draft.causalThreadsByEvidenceKey.get(key);
      thread.push({
        role: "user",
        text: questionText,
        timestamp: new Date().toISOString(),
      });
      draft.causalNarrativeRevealedByEvidenceKey.delete(key);
      draft.outputSpecChangeRevealedByEvidenceKey.delete(key);
      draft.ui.causalInferenceError = null;
      return draft;
    }

    if (moveType === "SUBMIT_PLAYER_ASK") {
      const askText = String(payload.askText || "").trim();
      if (!askText) {
        return draft;
      }
      const key = getCausalEvidenceKey(payload.osnId, payload.evidenceId);
      if (!draft.playerAskUnlockedByEvidenceKey.has(key)) {
        return draft;
      }
      if (!draft.causalThreadsByEvidenceKey.has(key)) {
        draft.causalThreadsByEvidenceKey.set(key, []);
      }
      const thread = draft.causalThreadsByEvidenceKey.get(key);
      thread.push({
        role: "user",
        text: askText,
        timestamp: new Date().toISOString(),
      });
      draft.causalNarrativeRevealedByEvidenceKey.delete(key);
      draft.outputSpecChangeRevealedByEvidenceKey.delete(key);
      draft.ui.causalInferenceError = null;
      return draft;
    }

    if (moveType === "APPLY_CAUSAL_ANSWER") {
      const key = getCausalEvidenceKey(payload.osnId, payload.evidenceId);
      if (!draft.causalThreadsByEvidenceKey.has(key)) {
        draft.causalThreadsByEvidenceKey.set(key, []);
      }
      const thread = draft.causalThreadsByEvidenceKey.get(key);
      const entry = {
        role: "assistant",
        text: String(payload.text || "").trim(),
        timestamp: new Date().toISOString(),
        causeTags: payload.causeTags || null,
        askKind: "Q",
        hasUserEdits: false,
        approved: false,
      };
      entry.editedText = formatCausalExpositionPlainText(entry);
      thread.push(entry);
      const summaryKey = getCausalEvidenceKey(payload.osnId, payload.evidenceId);
      const execSummary =
        payload.causeTags && payload.causeTags.execSummary
          ? String(payload.causeTags.execSummary).trim()
          : "";
      if (execSummary) {
        draft.causalExecSummaryByEvidenceKey.set(summaryKey, {
          text: execSummary,
          approved: false,
          hasLmDraft: true,
          hasUserEdits: false,
        });
      }
      draft.latestAskKindByEvidenceKey.set(summaryKey, "Q");
      clearOutputSpecChangeProposal(draft, payload.osnId, payload.evidenceId);
      draft.causalNarrativeRevealedByEvidenceKey.delete(summaryKey);
      draft.ui.pendingCausalLineage = null;
      draft.ui.pendingPlayerAsk = null;
      draft.ui.causalInferencePending = false;
      draft.ui.causalInferenceError = null;
      return draft;
    }

    if (moveType === "APPLY_OUTPUT_SPEC_CHANGE_ANSWER") {
      const key = getCausalEvidenceKey(payload.osnId, payload.evidenceId);
      const askText = String(payload.askText || "").trim();
      const execSummary = String(payload.execSummary || "").trim();
      const proposedText = String(payload.proposedText || "").trim();
      if (!proposedText) {
        draft.ui.pendingPlayerAsk = null;
        draft.ui.causalInferencePending = false;
        draft.ui.causalInferenceError = "GT3 returned ASK_KIND A without a proposed output_spec.";
        return draft;
      }
      draft.outputSpecChangeByEvidenceKey.set(key, {
        askText: askText,
        execSummary: execSummary,
        proposedText: proposedText,
        approved: false,
        hasLmDraft: true,
        hasUserEdits: false,
      });
      if (execSummary) {
        draft.causalExecSummaryByEvidenceKey.set(key, {
          text: execSummary,
          approved: false,
          hasLmDraft: true,
          hasUserEdits: false,
        });
      }
      draft.latestAskKindByEvidenceKey.set(key, "A");
      draft.causalNarrativeRevealedByEvidenceKey.delete(key);
      draft.outputSpecChangeRevealedByEvidenceKey.delete(key);
      draft.ui.pendingPlayerAsk = null;
      draft.ui.pendingCausalLineage = null;
      draft.ui.causalInferencePending = false;
      draft.ui.causalInferenceError = null;
      return draft;
    }

    if (moveType === "SET_CAUSAL_INFERENCE_PENDING") {
      draft.ui.causalInferencePending = !!payload.pending;
      if (payload.error) {
        draft.ui.causalInferenceError = String(payload.error);
      } else if (payload.pending) {
        draft.ui.causalInferenceError = null;
      }
      return draft;
    }

    if (moveType === "CLEAR_CAUSAL_PENDING") {
      draft.ui.pendingCausalLineage = null;
      draft.ui.pendingPlayerAsk = null;
      draft.ui.causalInferencePending = false;
      return draft;
    }

    if (moveType === "TOGGLE_CAUSAL_EXEC_SUMMARY_APPROVAL") {
      const key = getCausalEvidenceKey(payload.osnId, payload.evidenceId);
      const card = draft.causalExecSummaryByEvidenceKey.get(key);
      if (card && String(card.text || "").trim()) {
        card.approved = !card.approved;
      }
      return draft;
    }

    if (moveType === "TOGGLE_CAUSAL_NARRATIVE_APPROVAL") {
      const key = getCausalEvidenceKey(payload.osnId, payload.evidenceId);
      const thread = draft.causalThreadsByEvidenceKey.get(key);
      const entry = Array.isArray(thread)
        ? thread.slice().reverse().find(function (item) {
            return item && item.role === "assistant";
          })
        : null;
      if (entry && String(formatCausalExpositionPlainText(entry) || "").trim()) {
        entry.approved = !entry.approved;
        const anyApproved = thread.some(function (item) {
          return (
            item &&
            item.role === "assistant" &&
            item.approved &&
            String(formatCausalExpositionPlainText(item) || "").trim()
          );
        });
        if (anyApproved) {
          const wasUnlocked = draft.playerAskUnlockedByEvidenceKey.has(key);
          draft.playerAskUnlockedByEvidenceKey.add(key);
          if (!wasUnlocked) {
            draft.ui.playerAskUnlockFlashKey = key;
          }
        } else {
          lockPlayerAskCapability(draft, payload.osnId, payload.evidenceId);
          if (draft.ui.playerAskUnlockFlashKey === key) {
            draft.ui.playerAskUnlockFlashKey = null;
          }
        }
      }
      return draft;
    }

    if (moveType === "TOGGLE_OUTPUT_SPEC_CHANGE_APPROVAL") {
      const key = getCausalEvidenceKey(payload.osnId, payload.evidenceId);
      const proposal = draft.outputSpecChangeByEvidenceKey.get(key);
      if (!proposal || !String(proposal.proposedText || "").trim()) {
        return draft;
      }
      const nextApproved = !proposal.approved;
      proposal.approved = nextApproved;
      if (nextApproved) {
        const card = draft.draftCardsByOsnId.get(getDraftCardId(payload.osnId, "output_spec"));
        if (card) {
          card.text = String(proposal.proposedText || "");
          card.approved = false;
          card.hasLmDraft = true;
          card.hasUserEdits = false;
          card.editBaselineText = String(card.text || "");
          draft.draftCardsByOsnId.set(card.id, card);
          draft.drafts[card.id] = {
            osnId: payload.osnId,
            sectionKey: "output_spec",
            text: card.text,
            approved: false,
          };
        }
      }
      return draft;
    }

    return draft;
  }

  function reduceStateForBlack(draft, moveType, payload) {
    const event = payload && payload.aiBusEvent ? payload.aiBusEvent : null;
    if (!event || !event.type) {
      return draft;
    }

    if (event.type === "lens_selected") {
      draft.ui.pendingLensRefresh = {
        osnId: event.payload.osnId,
        sectionKey: event.payload.sectionKey,
        lensId: event.payload.lensId,
      };
      ensureLensThread(event.payload.osnId, event.payload.lensId);
      return draft;
    }

    if (event.type === "lens_activity_opened") {
      return draft;
    }

    if (event.type === "causal_lineage_question") {
      draft.ui.pendingCausalLineage = {
        osnId: event.payload.osnId,
        evidenceId: event.payload.evidenceId,
        questionText: event.payload.questionText,
      };
      return draft;
    }

    if (event.type === "player_ask") {
      draft.ui.pendingPlayerAsk = {
        osnId: event.payload.osnId,
        evidenceId: event.payload.evidenceId,
        askText: event.payload.askText,
        forceAction: event.payload.forceAction === true,
      };
      return draft;
    }

    if (event.type === "seed_approved") {
      draft.ui.pendingMaturationProposal = {
        type: "osn_title",
        osnId: event.payload.osnId,
      };
      return draft;
    }

    if (event.type === "lenses_approved") {
      draft.ui.pendingMaturationProposal = {
        type: "output_spec",
        osnId: event.payload.osnId,
        sectionKey: "output_spec",
      };
      return draft;
    }

    if (event.type === "output_spec_approved") {
      draft.ui.pendingMaturationProposal = {
        type: "success_evidences",
        osnId: event.payload.osnId,
        sectionKey: "success_evidences",
      };
      return draft;
    }

    if (event.type === "success_evidences_approved") {
      draft.ui.pendingCanonization = {
        osnId: event.payload.osnId,
      };
      return draft;
    }

    return draft;
  }

  function invokeMaturationInference(pending, narrative, errorLabel) {
    const callGT3Fn = window.lexiomGT3 && window.lexiomGT3.callGT3;
    if (!callGT3Fn) {
      dispatchWhiteMove("SET_MATURATION_INFERENCE_PENDING", {
        pending: false,
        error: "GT3 client is not available.",
      });
      dispatchWhiteMove("CLEAR_MATURATION_PENDING", {});
      return;
    }

    if (maturationInferenceInFlight) {
      return;
    }

    maturationInferenceInFlight = true;
    dispatchWhiteMove("SET_MATURATION_INFERENCE_PENDING", { pending: true });

    callGT3Fn(narrative, { inferenceType: "L24" })
      .then(function (result) {
        if (result && result.ok && typeof result.text === "string") {
          const cleaned = String(result.text).trim();
          if (cleaned) {
            dispatchWhiteMove("APPLY_MATURATION_DRAFT", {
              osnId: pending.osnId,
              sectionKey: pending.sectionKey,
              text: cleaned,
            });
            return;
          }
        }
        dispatchWhiteMove("SET_MATURATION_INFERENCE_PENDING", {
          pending: false,
          error: (result && result.error) || errorLabel,
        });
        dispatchWhiteMove("CLEAR_MATURATION_PENDING", {});
      })
      .catch(function (error) {
        dispatchWhiteMove("SET_MATURATION_INFERENCE_PENDING", {
          pending: false,
          error: error && error.message ? error.message : String(error),
        });
        dispatchWhiteMove("CLEAR_MATURATION_PENDING", {});
      })
      .finally(function () {
        maturationInferenceInFlight = false;
      });
  }

  function invokeOsnTitleInference(pending, narrative, errorLabel) {
    const callGT3Fn = window.lexiomGT3 && window.lexiomGT3.callGT3;
    if (!callGT3Fn) {
      dispatchWhiteMove("SET_MATURATION_INFERENCE_PENDING", {
        pending: false,
        error: "GT3 client is not available.",
      });
      dispatchWhiteMove("CLEAR_MATURATION_PENDING", {});
      return;
    }

    if (maturationInferenceInFlight) {
      return;
    }

    maturationInferenceInFlight = true;
    dispatchWhiteMove("SET_MATURATION_INFERENCE_PENDING", { pending: true });

    callGT3Fn(narrative, { inferenceType: "L24" })
      .then(function (result) {
        if (result && result.ok && typeof result.text === "string") {
          const title = parseOsnTitleProposal(result.text);
          if (title) {
            dispatchWhiteMove("APPLY_OSN_TITLE", {
              osnId: pending.osnId,
              title: title,
            });
            maturationInferenceInFlight = false;
            processMaturationProposal({
              type: "thematic_lenses",
              osnId: pending.osnId,
              sectionKey: "thematic_lenses",
            });
            return;
          }
        }
        maturationInferenceInFlight = false;
        dispatchWhiteMove("SET_MATURATION_INFERENCE_PENDING", {
          pending: false,
          error: (result && result.error) || errorLabel,
        });
        dispatchWhiteMove("CLEAR_MATURATION_PENDING", {});
      })
      .catch(function (error) {
        maturationInferenceInFlight = false;
        dispatchWhiteMove("SET_MATURATION_INFERENCE_PENDING", {
          pending: false,
          error: error && error.message ? error.message : String(error),
        });
        dispatchWhiteMove("CLEAR_MATURATION_PENDING", {});
      });
  }

  function processMaturationProposal(pending) {
    if (!pending || !pending.type) {
      return;
    }

    const osn = getOsnById(pending.osnId);
    if (!osn) {
      dispatchWhiteMove("CLEAR_MATURATION_PENDING", {});
      return;
    }

    if (pending.type === "osn_title") {
      const buildNarrativeFn = window.lexiom13BuildOsnTitleProposalNarrative;
      if (!buildNarrativeFn) {
        dispatchWhiteMove("SET_MATURATION_INFERENCE_PENDING", {
          pending: false,
          error: "Maturation narrative builder is not available.",
        });
        dispatchWhiteMove("CLEAR_MATURATION_PENDING", {});
        return;
      }
      const seedCard = ensureDraftCardState(osn, "seed");
      invokeOsnTitleInference(
        pending,
        buildNarrativeFn({
          osn: osn,
          seedText: seedCard ? seedCard.text : osn.seed,
          ancestors: getAncestorContextForLens(osn),
        }),
        "OSN name proposal returned no usable text."
      );
      return;
    }

    if (pending.type === "thematic_lenses") {
      const buildNarrativeFn = window.lexiom13BuildOsnThematicLensesProposalNarrative;
      if (!buildNarrativeFn) {
        dispatchWhiteMove("SET_MATURATION_INFERENCE_PENDING", {
          pending: false,
          error: "Maturation narrative builder is not available.",
        });
        dispatchWhiteMove("CLEAR_MATURATION_PENDING", {});
        return;
      }
      const seedCard = ensureDraftCardState(osn, "seed");
      invokeMaturationInference(
        pending,
        buildNarrativeFn({
          osn: osn,
          seedText: seedCard ? seedCard.text : osn.seed,
          ancestors: getAncestorContextForLens(osn),
        }),
        "Thematic lens proposal returned no usable text."
      );
      return;
    }

    if (pending.type === "output_spec") {
      const buildNarrativeFn = window.lexiom13BuildOsnOutputSpecProposalNarrative;
      if (!buildNarrativeFn) {
        dispatchWhiteMove("SET_MATURATION_INFERENCE_PENDING", {
          pending: false,
          error: "Maturation narrative builder is not available.",
        });
        dispatchWhiteMove("CLEAR_MATURATION_PENDING", {});
        return;
      }
      const seedCard = ensureDraftCardState(osn, "seed");
      const lensesCard = ensureDraftCardState(osn, "thematic_lenses");
      const parsedLenses = parseThematicLensesDraft(lensesCard ? lensesCard.text : "");
      invokeMaturationInference(
        pending,
        buildNarrativeFn({
          osn: osn,
          seedText: seedCard ? seedCard.text : osn.seed,
          thematicLenses: parsedLenses.length ? parsedLenses : osn.thematic_lenses,
          ancestors: getAncestorContextForLens(osn),
        }),
        "Output specification proposal returned no usable text."
      );
      return;
    }

    if (pending.type === "success_evidences") {
      const buildNarrativeFn = window.lexiom13BuildOsnSuccessEvidencesProposalNarrative;
      if (!buildNarrativeFn) {
        dispatchWhiteMove("SET_MATURATION_INFERENCE_PENDING", {
          pending: false,
          error: "Maturation narrative builder is not available.",
        });
        dispatchWhiteMove("CLEAR_MATURATION_PENDING", {});
        return;
      }
      const seedCard = ensureDraftCardState(osn, "seed");
      const lensesCard = ensureDraftCardState(osn, "thematic_lenses");
      const outputSpecCard = ensureDraftCardState(osn, "output_spec");
      const parsedLenses = parseThematicLensesDraft(lensesCard ? lensesCard.text : "");
      invokeMaturationInference(
        pending,
        buildNarrativeFn({
          osn: osn,
          seedText: seedCard ? seedCard.text : osn.seed,
          thematicLenses: parsedLenses.length ? parsedLenses : osn.thematic_lenses,
          outputSpecText: outputSpecCard ? outputSpecCard.text : osn.output_spec,
          ancestors: getAncestorContextForLens(osn),
        }),
        "Success evidences proposal returned no usable text."
      );
    }
  }

  function processOsnCanonization(pending) {
    if (!pending || !pending.osnId) {
      dispatchWhiteMove("CLEAR_CANONIZATION_PENDING", {});
      return;
    }

    let osn = getOsnById(pending.osnId);
    if (!osn || !isImmatureOsn(osn) || !isFullyMatureImmatureOsn(osn)) {
      dispatchWhiteMove("CLEAR_CANONIZATION_PENDING", {});
      return;
    }

    if (canonizationInFlight) {
      return;
    }

    const canonizeOsnId = promotePlaceholderBranchIdentityForCanonize(osn);
    osn = getOsnById(canonizeOsnId) || osn;
    pending.osnId = osn.id;

    const parentOsnId =
      Array.isArray(osn.graph && osn.graph.parent_osn_ids) && osn.graph.parent_osn_ids.length
        ? osn.graph.parent_osn_ids[0]
        : null;
    if (!parentOsnId) {
      dispatchWhiteMove("SET_CANONIZATION_PENDING", {
        pending: false,
        error: "Cannot canonize an OSN without a parent link.",
      });
      dispatchWhiteMove("CLEAR_CANONIZATION_PENDING", {});
      return;
    }

    canonizationInFlight = true;
    dispatchWhiteMove("SET_CANONIZATION_PENDING", { pending: true });

    fetch("/lexiom13/osn/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operation: "create",
        osn: serializeOsnForCanonize(osn),
        parentOsnId: parentOsnId,
      }),
    })
      .then(async function (response) {
        let payload = null;
        try {
          payload = await response.json();
        } catch (_error) {
          payload = null;
        }
        if (!response.ok) {
          throw new Error(
            (payload && payload.detail) || "Canonization failed (" + String(response.status) + ")."
          );
        }
        dispatchWhiteMove("APPLY_CANONIZATION", {
          osnId: osn.id,
          sourcePath: payload && payload.sourcePath ? payload.sourcePath : "",
          fileName: payload && payload.fileName ? payload.fileName : "",
        });
        appendAction("canonize_osn", {
          osnId: osn.id,
          sourcePath: payload && payload.sourcePath ? payload.sourcePath : "",
          leafLabel: getOsnOriginLeafLabel(osn),
        });
        state.ui.cockpitTitleStale = true;
        renderApp();
      })
      .catch(function (error) {
        dispatchWhiteMove("SET_CANONIZATION_PENDING", {
          pending: false,
          error: error && error.message ? error.message : String(error),
        });
        dispatchWhiteMove("CLEAR_CANONIZATION_PENDING", {});
        renderApp();
      })
      .finally(function () {
        canonizationInFlight = false;
      });
  }

  function processCanonicalPersist(pending) {
    if (!pending || !pending.osnId) {
      dispatchWhiteMove("CLEAR_PERSIST_PENDING", {});
      return;
    }

    const osn = getOsnById(pending.osnId);
    if (!osn || !isCanonicalOsn(osn)) {
      dispatchWhiteMove("CLEAR_PERSIST_PENDING", {});
      return;
    }

    if (persistInFlight) {
      return;
    }

    persistInFlight = true;
    dispatchWhiteMove("SET_PERSIST_PENDING", { pending: true });

    fetch("/lexiom13/osn/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operation: "update",
        osn: serializeOsnForPersist(osn),
        previousFileName: pending.previousFileName || osn.file_name,
      }),
    })
      .then(async function (response) {
        let payload = null;
        try {
          payload = await response.json();
        } catch (_error) {
          payload = null;
        }
        if (!response.ok) {
          throw new Error(
            (payload && payload.detail) || "Persist failed (" + String(response.status) + ")."
          );
        }
        dispatchWhiteMove("APPLY_PERSIST", {
          osnId: pending.osnId,
          sourcePath: payload && payload.sourcePath ? payload.sourcePath : "",
          fileName: payload && payload.fileName ? payload.fileName : "",
        });
        appendAction("persist_osn", {
          osnId: pending.osnId,
          sectionKey: pending.sectionKey,
          sourcePath: payload && payload.sourcePath ? payload.sourcePath : "",
        });
        if (pending.sectionKey === OSN_FILE_NAME_META_KEY) {
          state.ui.cockpitTitleStale = true;
        }
        renderApp();
      })
      .catch(function (error) {
        const message = error && error.message ? error.message : String(error);
        dispatchWhiteMove("SET_PERSIST_PENDING", {
          pending: false,
          error: message,
        });
        dispatchWhiteMove("CLEAR_PERSIST_PENDING", {});
        appendAction("persist_failed", {
          osnId: pending.osnId,
          sectionKey: pending.sectionKey,
          error: message,
        });
        renderApp();
      })
      .finally(function () {
        persistInFlight = false;
      });
  }

  function processOsnBranchPrune(pending) {
    if (!pending || !pending.rootOsnId) {
      dispatchWhiteMove("CLEAR_PRUNE_PENDING", {});
      return;
    }

    if (pruneInFlight) {
      return;
    }

    const applyPrune = function (resultPayload) {
      dispatchWhiteMove("APPLY_PRUNE_BRANCH", {
        rootOsnId: pending.rootOsnId,
        prunedIds: (resultPayload && resultPayload.prunedIds) || pending.prunedIds,
        fallbackParentIds: pending.fallbackParentIds,
      });
      appendAction("prune_osn_branch", {
        rootOsnId: pending.rootOsnId,
        prunedIds: (resultPayload && resultPayload.prunedIds) || pending.prunedIds,
        tombstonedFiles: resultPayload && resultPayload.tombstonedFiles ? resultPayload.tombstonedFiles : [],
      });
      renderApp();
    };

    if (pending.runtimeOnly) {
      applyPrune({ prunedIds: pending.prunedIds });
      return;
    }

    pruneInFlight = true;
    dispatchWhiteMove("SET_PRUNE_PENDING", { pending: true });

    fetch("/lexiom13/osn/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operation: "prune",
        rootOsnId: pending.rootOsnId,
        confirmRootPrune: !!pending.confirmRootPrune,
      }),
    })
      .then(async function (response) {
        let payload = null;
        try {
          payload = await response.json();
        } catch (_error) {
          payload = null;
        }
        if (!response.ok) {
          throw new Error(
            (payload && payload.detail) || "Prune failed (" + String(response.status) + ")."
          );
        }
        applyPrune(payload || {});
      })
      .catch(function (error) {
        const message = error && error.message ? error.message : String(error);
        dispatchWhiteMove("SET_PRUNE_PENDING", {
          pending: false,
          error: message,
        });
        dispatchWhiteMove("CLEAR_PRUNE_PENDING", {});
        appendAction("prune_failed", {
          rootOsnId: pending.rootOsnId,
          error: message,
        });
        renderApp();
      })
      .finally(function () {
        pruneInFlight = false;
      });
  }

  function processPostBlackEffects(stateAfterBlack, moveType) {
    const pendingLens = stateAfterBlack && stateAfterBlack.ui ? stateAfterBlack.ui.pendingLensRefresh : null;
    if (pendingLens && moveType === "SELECT_THEMATIC_LENS") {
      processLensReframePending(pendingLens);
      return;
    }

    const pendingMaturation =
      stateAfterBlack && stateAfterBlack.ui ? stateAfterBlack.ui.pendingMaturationProposal : null;
    if (pendingMaturation && moveType === "TOGGLE_APPROVAL") {
      processMaturationProposal(pendingMaturation);
      return;
    }

    const pendingCanonization =
      stateAfterBlack && stateAfterBlack.ui ? stateAfterBlack.ui.pendingCanonization : null;
    if (pendingCanonization && moveType === "TOGGLE_APPROVAL") {
      processOsnCanonization(pendingCanonization);
      return;
    }

    const pendingPersist =
      stateAfterBlack && stateAfterBlack.ui ? stateAfterBlack.ui.pendingPersist : null;
    if (pendingPersist && moveType === "TOGGLE_APPROVAL") {
      processCanonicalPersist(pendingPersist);
      return;
    }

    const pendingPrune = stateAfterBlack && stateAfterBlack.ui ? stateAfterBlack.ui.pendingPrune : null;
    if (pendingPrune && moveType === "PRUNE_OSN_BRANCH") {
      processOsnBranchPrune(pendingPrune);
      return;
    }

    const pendingCausal =
      stateAfterBlack && stateAfterBlack.ui ? stateAfterBlack.ui.pendingCausalLineage : null;
    if (pendingCausal && moveType === "SUBMIT_CAUSAL_QUESTION") {
      processCausalLineagePending(pendingCausal);
      return;
    }

    const pendingPlayerAsk =
      stateAfterBlack && stateAfterBlack.ui ? stateAfterBlack.ui.pendingPlayerAsk : null;
    if (pendingPlayerAsk && moveType === "SUBMIT_PLAYER_ASK") {
      processPlayerAskPending(pendingPlayerAsk);
    }
  }

  function buildFocusOsnForCausalInference(osn) {
    const seedCard = ensureDraftCardState(osn, "seed");
    const lensesCard = ensureDraftCardState(osn, "thematic_lenses");
    const outputSpecCard = ensureDraftCardState(osn, "output_spec");
    const evidencesCard = ensureDraftCardState(osn, "success_evidences");
    return Object.assign({}, osn, {
      seed: seedCard ? String(seedCard.text || "").trim() : String(osn.seed || "").trim(),
      output_spec: outputSpecCard
        ? String(outputSpecCard.text || "").trim()
        : String(osn.output_spec || "").trim(),
      success_evidences_draft_text: evidencesCard
        ? String(evidencesCard.text || "").trim()
        : "",
      thematic_lenses_draft_text: lensesCard ? String(lensesCard.text || "").trim() : "",
    });
  }

  function processCausalLineagePending(pending) {
    const buildNarrativeFn = window.lexiom13BuildCausalLineageNarrative;
    const callGT3Fn = window.lexiomGT3 && window.lexiomGT3.callGT3;
    if (!buildNarrativeFn || !callGT3Fn) {
      dispatchWhiteMove("SET_CAUSAL_INFERENCE_PENDING", {
        pending: false,
        error: "GT3 client or causal lineage narrative builder is not available.",
      });
      dispatchWhiteMove("CLEAR_CAUSAL_PENDING", {});
      return;
    }

    if (causalInferenceInFlight) {
      return;
    }

    const osn = getOsnById(pending.osnId);
    const api = getEvidenceLinksApi();
    if (!osn || !api) {
      dispatchWhiteMove("CLEAR_CAUSAL_PENDING", {});
      return;
    }

    const link = withResolvedEvidenceLink(api.findLinkedEvidence(osn, pending.evidenceId));
    if (!link) {
      dispatchWhiteMove("SET_CAUSAL_INFERENCE_PENDING", {
        pending: false,
        error: "Success evidence artifact is not available for causal review.",
      });
      dispatchWhiteMove("CLEAR_CAUSAL_PENDING", {});
      return;
    }

    causalInferenceInFlight = true;
    dispatchWhiteMove("SET_CAUSAL_INFERENCE_PENDING", { pending: true });

    function runInference(artifactBody) {
      const thread = getCausalThread(pending.osnId, pending.evidenceId);
      const priorMessages = thread.slice(0, -1).slice(-6);
      const narrative = buildNarrativeFn({
        osn: buildFocusOsnForCausalInference(osn),
        evidenceLink: link,
        evidenceDef: getEvidenceDefinition(osn, pending.evidenceId),
        artifactBody: artifactBody || getCausalArtifactBody(link),
        ancestors: getAncestorContextForLens(osn),
        standardAncestors: getStandardAncestorOsns(osn),
        priorMessages: priorMessages,
        question: pending.questionText,
      });

      callGT3Fn(narrative, { inferenceType: "L2_LINEAGE" })
        .then(function (result) {
          if (result && result.ok && typeof result.text === "string") {
            const cleaned = stripInBandTail(String(result.text).trim());
            if (cleaned) {
              const causeTags = parseCausalLineageResponse(cleaned);
              dispatchWhiteMove("APPLY_CAUSAL_ANSWER", {
                osnId: pending.osnId,
                evidenceId: pending.evidenceId,
                text: cleaned,
                causeTags: causeTags,
              });
              return;
            }
          }
          dispatchWhiteMove("SET_CAUSAL_INFERENCE_PENDING", {
            pending: false,
            error: (result && result.error) || "Causal lineage chat returned no usable text.",
          });
          dispatchWhiteMove("CLEAR_CAUSAL_PENDING", {});
        })
        .catch(function (error) {
          dispatchWhiteMove("SET_CAUSAL_INFERENCE_PENDING", {
            pending: false,
            error: error && error.message ? error.message : String(error),
          });
          dispatchWhiteMove("CLEAR_CAUSAL_PENDING", {});
        })
        .finally(function () {
          causalInferenceInFlight = false;
        });
    }

    if (
      link.mediaType !== "image" &&
      link.mediaType !== "video" &&
      link.artifactUrl &&
      !state.evidenceTextCache.has(link.artifactUrl)
    ) {
      fetchEvidenceText(link.artifactUrl)
        .then(function (text) {
          runInference(text);
        })
        .catch(function () {
          runInference("");
        });
      return;
    }

    runInference(getCausalArtifactBody(link));
  }

  function processPlayerAskPending(pending) {
    const forceAction = pending && pending.forceAction === true;
    const buildNarrativeFn = forceAction
      ? window.lexiom13BuildOutputSpecChangeNarrative
      : window.lexiom13BuildPlayerAskNarrative;
    const callGT3Fn = window.lexiomGT3 && window.lexiomGT3.callGT3;
    if (!buildNarrativeFn || !callGT3Fn) {
      dispatchWhiteMove("SET_CAUSAL_INFERENCE_PENDING", {
        pending: false,
        error: forceAction
          ? "GT3 client or output-spec change narrative builder is not available."
          : "GT3 client or player-ask narrative builder is not available.",
      });
      dispatchWhiteMove("CLEAR_CAUSAL_PENDING", {});
      return;
    }

    if (causalInferenceInFlight) {
      return;
    }

    const osn = getOsnById(pending.osnId);
    const api = getEvidenceLinksApi();
    if (!osn || !api) {
      dispatchWhiteMove("CLEAR_CAUSAL_PENDING", {});
      return;
    }

    const link = withResolvedEvidenceLink(api.findLinkedEvidence(osn, pending.evidenceId));
    if (!link) {
      dispatchWhiteMove("SET_CAUSAL_INFERENCE_PENDING", {
        pending: false,
        error: "Success evidence artifact is not available for player ask.",
      });
      dispatchWhiteMove("CLEAR_CAUSAL_PENDING", {});
      return;
    }

    causalInferenceInFlight = true;
    dispatchWhiteMove("SET_CAUSAL_INFERENCE_PENDING", { pending: true });

    function runInference(artifactBody) {
      const thread = getCausalThread(pending.osnId, pending.evidenceId);
      const priorMessages = thread.slice(0, -1).slice(-6);
      const narrativeCtx = {
        osn: buildFocusOsnForCausalInference(osn),
        evidenceLink: link,
        evidenceDef: getEvidenceDefinition(osn, pending.evidenceId),
        artifactBody: artifactBody || getCausalArtifactBody(link),
        ancestors: getAncestorContextForLens(osn),
        standardAncestors: getStandardAncestorOsns(osn),
        priorMessages: priorMessages,
        question: pending.askText,
        approvedLineageNarrative: getApprovedLineageNarrativeText(
          pending.osnId,
          pending.evidenceId
        ),
      };
      const narrative = buildNarrativeFn(narrativeCtx);

      callGT3Fn(narrative, { inferenceType: "L2_LINEAGE" })
        .then(function (result) {
          if (result && result.ok && typeof result.text === "string") {
            const cleaned = stripInBandTail(String(result.text).trim());
            if (cleaned) {
              const parsed = parseCausalLineageResponse(cleaned);
              const treatAsAction =
                forceAction ||
                parsed.askKind === "A" ||
                !!String(parsed.proposedOutputSpec || "").trim();
              if (treatAsAction) {
                const proposed = String(parsed.proposedOutputSpec || "").trim();
                if (!proposed) {
                  dispatchWhiteMove("SET_CAUSAL_INFERENCE_PENDING", {
                    pending: false,
                    error: "GT3 signaled ASK_KIND A but returned no PROPOSED_OUTPUT_SPEC.",
                  });
                  dispatchWhiteMove("CLEAR_CAUSAL_PENDING", {});
                  return;
                }
                dispatchWhiteMove("APPLY_OUTPUT_SPEC_CHANGE_ANSWER", {
                  osnId: pending.osnId,
                  evidenceId: pending.evidenceId,
                  askText: pending.askText,
                  execSummary: parsed.execSummary,
                  proposedText: proposed,
                });
                return;
              }
              dispatchWhiteMove("APPLY_CAUSAL_ANSWER", {
                osnId: pending.osnId,
                evidenceId: pending.evidenceId,
                text: cleaned,
                causeTags: parsed,
              });
              return;
            }
          }
          dispatchWhiteMove("SET_CAUSAL_INFERENCE_PENDING", {
            pending: false,
            error: (result && result.error) || "Player ask returned no usable text.",
          });
          dispatchWhiteMove("CLEAR_CAUSAL_PENDING", {});
        })
        .catch(function (error) {
          dispatchWhiteMove("SET_CAUSAL_INFERENCE_PENDING", {
            pending: false,
            error: error && error.message ? error.message : String(error),
          });
          dispatchWhiteMove("CLEAR_CAUSAL_PENDING", {});
        })
        .finally(function () {
          causalInferenceInFlight = false;
        });
    }

    if (
      link.mediaType !== "image" &&
      link.mediaType !== "video" &&
      link.artifactUrl &&
      !state.evidenceTextCache.has(link.artifactUrl)
    ) {
      fetchEvidenceText(link.artifactUrl)
        .then(function (text) {
          runInference(text);
        })
        .catch(function () {
          runInference("");
        });
      return;
    }

    runInference(getCausalArtifactBody(link));
  }

  function processLensReframePending(pending) {
    const buildNarrativeFn = window.lexiom13BuildOsnLensReframeNarrative;
    const callGT3Fn = window.lexiomGT3 && window.lexiomGT3.callGT3;
    if (!buildNarrativeFn || !callGT3Fn) {
      dispatchWhiteMove("SET_LENS_INFERENCE_PENDING", {
        pending: false,
        error: "GT3 client or lens narrative builder is not available.",
      });
      dispatchWhiteMove("CLEAR_PENDING_UI", { key: "pendingLensRefresh" });
      return;
    }

    if (lensInferenceInFlight) {
      return;
    }

    const osn = getOsnById(pending.osnId);
    const lens = getLensById(osn, pending.lensId);
    if (!osn || !lens) {
      dispatchWhiteMove("CLEAR_PENDING_UI", { key: "pendingLensRefresh" });
      return;
    }

    const card = ensureDraftCardState(osn, pending.sectionKey);
    // Feed the CURRENT center draft text back in and advance the pass count so
    // each successive click on the same lens deepens the draft cumulatively.
    const pass = getLensIntensity(pending.osnId, pending.sectionKey, pending.lensId) + 1;
    const narrative = buildNarrativeFn({
      osn: osn,
      sectionKey: pending.sectionKey,
      sectionLabel: getSectionLabel(pending.sectionKey),
      sectionText: card ? card.text : "",
      lens: lens,
      ancestors: getAncestorContextForLens(osn),
      pass: pass,
    });

    lensInferenceInFlight = true;
    dispatchWhiteMove("SET_LENS_INFERENCE_PENDING", { pending: true });

    callGT3Fn(narrative, { inferenceType: "L24" })
      .then(function (result) {
        if (result && result.ok && typeof result.text === "string") {
          const cleaned = String(result.text).trim();
          if (cleaned) {
            dispatchWhiteMove("APPLY_LENS_DRAFT", {
              osnId: pending.osnId,
              sectionKey: pending.sectionKey,
              lensId: pending.lensId,
              text: cleaned,
            });
            return;
          }
        }
        dispatchWhiteMove("SET_LENS_INFERENCE_PENDING", {
          pending: false,
          error: (result && result.error) || "Lens reframe returned no usable text.",
        });
        dispatchWhiteMove("CLEAR_PENDING_UI", { key: "pendingLensRefresh" });
      })
      .catch(function (error) {
        dispatchWhiteMove("SET_LENS_INFERENCE_PENDING", {
          pending: false,
          error: error && error.message ? error.message : String(error),
        });
        dispatchWhiteMove("CLEAR_PENDING_UI", { key: "pendingLensRefresh" });
      })
      .finally(function () {
        lensInferenceInFlight = false;
      });
  }

  function dispatchWhiteMove(moveType, payload) {
    if (phase !== PHASES.STABLE) {
      return;
    }

    let blackPayload = payload || {};

    phase = PHASES.WHITE_COMMIT;
    reduceStateForWhite(state, moveType, payload || {});

    if (moveType === "SELECT_THEMATIC_LENS" && payload && payload.lensId) {
      blackPayload = {
        ...(payload || {}),
        aiBusEvent: {
          type: "lens_selected",
          payload: {
            osnId: payload.osnId,
            sectionKey: payload.sectionKey,
            lensId: payload.lensId,
          },
        },
      };
    }

    if (moveType === "TOGGLE_APPROVAL" && payload && payload.sectionKey === "seed") {
      const osn = state.osnsById.get(payload.osnId);
      const card = state.draftCardsByOsnId.get(getDraftCardId(payload.osnId, payload.sectionKey));
      if (osn && card && isImmatureOsn(osn) && card.approved) {
        blackPayload = {
          ...(payload || {}),
          aiBusEvent: {
            type: "seed_approved",
            payload: {
              osnId: payload.osnId,
            },
          },
        };
      }
    }

    if (moveType === "TOGGLE_APPROVAL" && payload && payload.sectionKey === "thematic_lenses") {
      const osn = state.osnsById.get(payload.osnId);
      const card = state.draftCardsByOsnId.get(getDraftCardId(payload.osnId, payload.sectionKey));
      if (osn && card && isImmatureOsn(osn) && card.approved) {
        blackPayload = {
          ...(payload || {}),
          aiBusEvent: {
            type: "lenses_approved",
            payload: {
              osnId: payload.osnId,
            },
          },
        };
      }
    }

    if (moveType === "TOGGLE_APPROVAL" && payload && payload.sectionKey === "output_spec") {
      const osn = state.osnsById.get(payload.osnId);
      const card = state.draftCardsByOsnId.get(getDraftCardId(payload.osnId, payload.sectionKey));
      if (osn && card && isImmatureOsn(osn) && card.approved) {
        blackPayload = {
          ...(payload || {}),
          aiBusEvent: {
            type: "output_spec_approved",
            payload: {
              osnId: payload.osnId,
            },
          },
        };
      }
    }

    if (moveType === "TOGGLE_APPROVAL" && payload && payload.sectionKey === "success_evidences") {
      const osn = state.osnsById.get(payload.osnId);
      const card = state.draftCardsByOsnId.get(getDraftCardId(payload.osnId, payload.sectionKey));
      if (osn && card && isImmatureOsn(osn) && card.approved && isFullyMatureImmatureOsn(osn)) {
        blackPayload = {
          ...(payload || {}),
          aiBusEvent: {
            type: "success_evidences_approved",
            payload: {
              osnId: payload.osnId,
            },
          },
        };
      }
    }

    if (moveType === "SUBMIT_CAUSAL_QUESTION" && payload && payload.evidenceId) {
      const questionText = String(payload.questionText || "").trim();
      if (questionText) {
        blackPayload = {
          ...(payload || {}),
          aiBusEvent: {
            type: "causal_lineage_question",
            payload: {
              osnId: payload.osnId,
              evidenceId: payload.evidenceId,
              questionText: questionText,
            },
          },
        };
      }
    }

    if (moveType === "SUBMIT_PLAYER_ASK" && payload && payload.evidenceId) {
      const askText = String(payload.askText || "").trim();
      if (askText) {
        blackPayload = {
          ...(payload || {}),
          aiBusEvent: {
            type: "player_ask",
            payload: {
              osnId: payload.osnId,
              evidenceId: payload.evidenceId,
              askText: askText,
              forceAction: payload.forceAction === true,
            },
          },
        };
      }
    }

    phase = PHASES.BLACK_RUN;
    reduceStateForBlack(state, moveType, blackPayload);
    phase = PHASES.STABLE;

    appendAction("white_move", { moveType: moveType, detail: payload || {} });
    renderApp();
    processPostBlackEffects(state, moveType);
    if (moveType === "SELECT_OSN" || moveType === "TOGGLE_OSN_SECTIONS") {
      kickEvidenceCollectionPoll();
    }
  }

  function appendAction(type, detail) {
    state.actionLog.push({
      type,
      detail: detail || {},
      timestamp: new Date().toISOString(),
    });
  }

  function formatActionLabel(action) {
    if (!action) {
      return "";
    }

    if (action.type === "select_osn") {
      return "Selected " + String(action.detail && action.detail.osnId ? action.detail.osnId : "OSN") +
        " → " + getSectionLabel(action.detail && action.detail.sectionKey ? action.detail.sectionKey : DEFAULT_SELECTED_SECTION_KEY);
    }
    if (action.type === "edit_draft") {
      return "Edited draft section " + getSectionLabel(action.detail && action.detail.sectionKey ? action.detail.sectionKey : DEFAULT_SELECTED_SECTION_KEY);
    }
    if (action.type === "toggle_approval") {
      return (action.detail && action.detail.approved ? "Approved " : "Unapproved ") +
        getSectionLabel(action.detail && action.detail.sectionKey ? action.detail.sectionKey : DEFAULT_SELECTED_SECTION_KEY);
    }
    if (action.type === "open_compile_preview") {
      return "Opened compilation preview for " + String(action.detail && action.detail.osnId ? action.detail.osnId : "OSN");
    }
    if (action.type === "toggle_osn_sections") {
      return (action.detail && action.detail.expanded ? "Expanded " : "Collapsed ") +
        String(action.detail && action.detail.osnId ? action.detail.osnId : "OSN") +
        " sections";
    }
    if (action.type === "open_evidence_artifact") {
      return "Opened evidence artifact " +
        String(action.detail && action.detail.evidenceId ? action.detail.evidenceId : "evidence") +
        " for " +
        String(action.detail && action.detail.osnId ? action.detail.osnId : "OSN");
    }
    if (action.type === "causal_question_submitted") {
      return "Causal lineage question for " +
        String(action.detail && action.detail.evidenceId ? action.detail.evidenceId : "evidence") +
        ": " +
        String(action.detail && action.detail.questionText ? action.detail.questionText : "");
    }
    if (action.type === "player_ask_submitted") {
      return "Player ask (" +
        String(action.detail && action.detail.narrativeBuilder
          ? action.detail.narrativeBuilder
          : "player_ask") +
        ") for " +
        String(action.detail && action.detail.evidenceId ? action.detail.evidenceId : "evidence") +
        ": " +
        String(action.detail && action.detail.askText ? action.detail.askText : "");
    }
    if (action.type === "edit_causal_exposition") {
      return "Edited causal exposition draft for " +
        String(action.detail && action.detail.evidenceId ? action.detail.evidenceId : "evidence");
    }
    if (action.type === "edit_output_spec_change_proposal") {
      return "Edited proposed output_spec for " +
        String(action.detail && action.detail.evidenceId ? action.detail.evidenceId : "evidence");
    }
    if (action.type === "edit_causal_exec_summary") {
      return "Edited lineage executive summary for " +
        String(action.detail && action.detail.evidenceId ? action.detail.evidenceId : "evidence");
    }
    if (action.type === "toggle_causal_exec_summary_approval") {
      return (action.detail && action.detail.approved ? "Approved " : "Unapproved ") +
        "lineage executive summary for " +
        String(action.detail && action.detail.evidenceId ? action.detail.evidenceId : "evidence");
    }
    if (action.type === "open_causal_exec_summary_link") {
      return "Opened lineage narrative from executive summary for " +
        String(action.detail && action.detail.evidenceId ? action.detail.evidenceId : "evidence");
    }
    if (action.type === "open_output_spec_change_link") {
      return "Opened proposed output_spec from Lexiom proposal for " +
        String(action.detail && action.detail.evidenceId ? action.detail.evidenceId : "evidence");
    }
    if (action.type === "toggle_causal_narrative_approval") {
      return (action.detail && action.detail.approved ? "Approved " : "Unapproved ") +
        "lineage narrative for " +
        String(action.detail && action.detail.evidenceId ? action.detail.evidenceId : "evidence");
    }
    if (action.type === "toggle_output_spec_change_approval") {
      return (action.detail && action.detail.approved ? "Approved " : "Unapproved ") +
        "proposed output_spec for " +
        String(action.detail && action.detail.evidenceId ? action.detail.evidenceId : "evidence");
    }
    if (action.type === "toggle_evidence_approval") {
      return (action.detail && action.detail.approved ? "Approved success evidence " : "Unapproved success evidence ") +
        String(action.detail && action.detail.evidenceId ? action.detail.evidenceId : "evidence") +
        " for " +
        String(action.detail && action.detail.osnId ? action.detail.osnId : "OSN");
    }
    if (action.type === "toggle_osn_graph_filter") {
      return (action.detail && action.detail.enabled ? "Enabled " : "Disabled ") +
        "OSN graph filter " +
        String(action.detail && action.detail.filterId ? action.detail.filterId : "filter");
    }
    if (action.type === "branch_osn") {
      return "Branched " +
        String(action.detail && action.detail.childOsnId ? action.detail.childOsnId : "new OSN") +
        " from " +
        String(action.detail && action.detail.parentOsnId ? action.detail.parentOsnId : "parent OSN");
    }
    if (action.type === "canonize_osn") {
      return "Canonized " +
        String(action.detail && action.detail.osnId ? action.detail.osnId : "OSN") +
        (action.detail && action.detail.sourcePath ? " → " + action.detail.sourcePath : "");
    }
    if (action.type === "persist_osn") {
      return "Persisted " +
        getSectionLabel(action.detail && action.detail.sectionKey ? action.detail.sectionKey : "") +
        " for " +
        String(action.detail && action.detail.osnId ? action.detail.osnId : "OSN") +
        (action.detail && action.detail.sourcePath ? " → " + action.detail.sourcePath : "");
    }
    if (action.type === "persist_failed") {
      return "Persist failed for " +
        String(action.detail && action.detail.osnId ? action.detail.osnId : "OSN") +
        ": " +
        String(action.detail && action.detail.error ? action.detail.error : "unknown error");
    }
    if (action.type === "prune_osn_branch") {
      return "Pruned OSN branch from " +
        String(action.detail && action.detail.rootOsnId ? action.detail.rootOsnId : "OSN") +
        " (" +
        String(
          action.detail && Array.isArray(action.detail.prunedIds) ? action.detail.prunedIds.length : 0
        ) +
        " nodes)";
    }
    if (action.type === "prune_failed") {
      return "Prune failed for " +
        String(action.detail && action.detail.rootOsnId ? action.detail.rootOsnId : "OSN") +
        ": " +
        String(action.detail && action.detail.error ? action.detail.error : "unknown error");
    }
    if (action.type === "white_move") {
      return "White move: " + String(action.detail && action.detail.moveType ? action.detail.moveType : "unknown");
    }
    if (action.type === "load_started") return "Started loading OSN files";
    if (action.type === "load_completed") return "Loaded " + String(action.detail && action.detail.count ? action.detail.count : 0) + " OSN files";
    return action.type;
  }

  function getSelectedSectionCard() {
    const osn = getSelectedOsn();
    return ensureDraftCardState(osn, state.selectedSectionKey);
  }

  function buildSectionDraftText(osn, sectionKey) {
    if (!osn) {
      return "";
    }

    if (sectionKey === BUILD_SECTION_KEY) {
      return "";
    }

    if (sectionKey === "seed") {
      return String(osn.seed || "").trim();
    }

    if (sectionKey === "output_spec") {
      return String(osn.output_spec || "").trim();
    }

    if (sectionKey === "thematic_lenses") {
      const lenses = Array.isArray(osn.thematic_lenses) ? osn.thematic_lenses : [];
      if (lenses.length) {
        return formatThematicLensesToDraft(lenses);
      }
      return "";
    }

    if (sectionKey === "success_evidences") {
      const evidences = Array.isArray(osn.success_evidences) ? osn.success_evidences : [];
      if (evidences.length) {
        return formatSuccessEvidencesToDraft(evidences);
      }
      return "";
    }

    if (sectionKey === BUD_SECTION_KEY) {
      return "";
    }

    if (sectionKey === OSN_OWNER_META_KEY) {
      return String(osn.owner && osn.owner.display_name ? osn.owner.display_name : "").trim();
    }

    if (sectionKey === OSN_TITLE_META_KEY) {
      return String(osn.title || "").trim();
    }

    if (sectionKey === OSN_FILE_NAME_META_KEY) {
      return getOsnFileNameStem(osn);
    }

    return "";
  }

  function ensureDraftCardState(osn, sectionKey) {
    if (!osn || !osn.id || !sectionKey) {
      return null;
    }

    const draftCardId = getDraftCardId(osn.id, sectionKey);
    if (sectionKey === BUD_SECTION_KEY) {
      if (!hasOpenableBud(osn)) {
        return null;
      }
      const existing = state.draftCardsByOsnId.get(draftCardId);
      const runId = osn.bud && osn.bud.run_id ? String(osn.bud.run_id) : "";
      if (existing && existing.budRunId && existing.budRunId !== runId) {
        state.draftCardsByOsnId.delete(draftCardId);
      }
    }

    if (!state.draftCardsByOsnId.has(draftCardId)) {
      const isBuildCard = sectionKey === BUILD_SECTION_KEY;
      const isBudCard = sectionKey === BUD_SECTION_KEY;
      const isImmature = isImmatureOsn(osn);
      state.draftCardsByOsnId.set(draftCardId, {
        id: draftCardId,
        osnId: osn.id,
        sectionKey: sectionKey,
        text: buildSectionDraftText(osn, sectionKey),
        // Bud arrives as a proposed delivery (draft-first), never pre-approved.
        approved: isBuildCard || isBudCard ? false : !isImmature,
        hasLmDraft: isBuildCard || isBudCard,
        hasUserEdits: false,
        editBaselineText: null,
        budRunId: isBudCard && osn.bud ? String(osn.bud.run_id || "") : null,
        budLoadState: isBudCard ? "idle" : null,
        budLoadError: null
      });
    }

    const card = state.draftCardsByOsnId.get(draftCardId) || null;
    if (card && sectionKey === BUD_SECTION_KEY) {
      ensureBudDraftContent(osn, card);
    }
    return card;
  }

  function getBudArtifactUrl(osn) {
    const bud = osn && osn.bud ? osn.bud : null;
    if (!bud) {
      return null;
    }
    const mediaKind = String(bud.media_kind || "").toLowerCase();
    const runId = bud.run_id || "";
    const entry =
      bud.entry_file_name || (mediaKind === "document" ? "document.md" : "index.html");
    if (mediaKind === "document") {
      return (
        bud.artifact_path ||
        "/lexiom13/build/" +
          encodeURIComponent(runId) +
          "/artifact/" +
          encodeURIComponent(entry)
      );
    }
    // Software: draft-first reviews the delivered entry source (not the live iframe).
    return (
      bud.artifact_path ||
      "/lexiom13/preview/" + encodeURIComponent(runId) + "/" + encodeURIComponent(entry)
    );
  }

  function downloadBudArtifact(url, fileName) {
    const href = String(url || "").trim();
    if (!href) {
      return;
    }
    const safeName = String(fileName || "artifact")
      .replace(/[\\/:*?"<>|]+/g, "_")
      .trim() || "artifact";
    fetch(href, { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Download failed (" + response.status + ")");
        }
        return response.blob();
      })
      .then(function (blob) {
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = safeName;
        anchor.rel = "noopener";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(function () {
          URL.revokeObjectURL(objectUrl);
        }, 1000);
      })
      .catch(function (error) {
        console.warn("lexiom13_bud_download_failed", error);
        appendAction("bud_download_failed", {
          fileName: safeName,
          error: error && error.message ? error.message : String(error),
        });
      });
  }

  function ensureBudDraftContent(osn, card) {
    if (!card || card.budLoadState === "loading" || card.budLoadState === "loaded") {
      return;
    }
    const url = getBudArtifactUrl(osn);
    if (!url) {
      card.budLoadState = "error";
      card.budLoadError = "Bud artifact URL missing.";
      card.text = "";
      return;
    }
    card.budLoadState = "loading";
    card.budLoadError = null;
    if (!String(card.text || "").trim()) {
      card.text = "Loading delivered bud…";
    }
    const osnId = osn.id;
    const runId = osn.bud && osn.bud.run_id ? String(osn.bud.run_id) : "";
    fetch(url, { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Artifact unavailable (" + response.status + ")");
        }
        return response.text();
      })
      .then(function (text) {
        const current = state.draftCardsByOsnId.get(getDraftCardId(osnId, BUD_SECTION_KEY));
        if (!current || current.budRunId !== runId) {
          return;
        }
        // Preserve player edits if they typed while loading.
        if (current.hasUserEdits) {
          current.budLoadState = "loaded";
          return;
        }
        current.text = text;
        current.editBaselineText = text;
        current.hasLmDraft = true;
        current.hasUserEdits = false;
        current.approved = false;
        current.budLoadState = "loaded";
        current.budLoadError = null;
        if (
          state.selectedOsnId === osnId &&
          state.selectedSectionKey === BUD_SECTION_KEY &&
          !state.selectedEvidenceId
        ) {
          renderApp();
        }
      })
      .catch(function (error) {
        const current = state.draftCardsByOsnId.get(getDraftCardId(osnId, BUD_SECTION_KEY));
        if (!current || current.budRunId !== runId) {
          return;
        }
        current.budLoadState = "error";
        current.budLoadError =
          error && error.message ? error.message : String(error);
        if (!current.hasUserEdits) {
          current.text =
            "Bud artifact failed to load: " +
            current.budLoadError +
            "\n\nOpen the Build report for run details.";
        }
        if (
          state.selectedOsnId === osnId &&
          state.selectedSectionKey === BUD_SECTION_KEY &&
          !state.selectedEvidenceId
        ) {
          renderApp();
        }
      });
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

  /**
   * Lightweight Markdown highlight for the draft-card editor mirror.
   * Escapes HTML first, then colors headings / bold / inline code only.
   */
  function highlightMarkdownInline(escapedLine) {
    var withCode = String(escapedLine || "").replace(
      /`([^`]+)`/g,
      '<span class="lexiom-md-code">`$1`</span>'
    );
    return withCode.replace(
      /\*\*([^*]+)\*\*/g,
      '<span class="lexiom-md-bold">**$1**</span>'
    );
  }

  function highlightMarkdownLite(rawText) {
    var lines = String(rawText || "").split("\n");
    return lines
      .map(function (line) {
        var escaped = escapeHtml(line);
        var heading = escaped.match(/^(#{1,6})(\s+)(.*)$/);
        if (heading) {
          return (
            '<span class="lexiom-md-heading">' +
            heading[1] +
            heading[2] +
            highlightMarkdownInline(heading[3]) +
            "</span>"
          );
        }
        return highlightMarkdownInline(escaped);
      })
      .join("\n");
  }

  function tokenizeForEditDiff(text) {
    return String(text || "").match(/\s+|[^\s]+/g) || [];
  }

  /**
   * Word-ish LCS diff. Used to mark insertions (green bg) against an edit baseline.
   * Deletes are omitted from the mirror so caret alignment with the textarea is preserved.
   */
  function diffTokensForEdit(baselineTokens, currentTokens) {
    var a = Array.isArray(baselineTokens) ? baselineTokens : [];
    var b = Array.isArray(currentTokens) ? currentTokens : [];
    var n = a.length;
    var m = b.length;
    var dp = [];
    var i;
    var j;
    for (i = 0; i <= n; i += 1) {
      dp[i] = new Array(m + 1);
      dp[i][0] = 0;
    }
    for (j = 0; j <= m; j += 1) {
      dp[0][j] = 0;
    }
    for (i = 1; i <= n; i += 1) {
      for (j = 1; j <= m; j += 1) {
        if (a[i - 1] === b[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }
    var ops = [];
    i = n;
    j = m;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
        ops.push({ type: "equal", text: b[j - 1] });
        i -= 1;
        j -= 1;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        ops.push({ type: "insert", text: b[j - 1] });
        j -= 1;
      } else {
        ops.push({ type: "delete", text: a[i - 1] });
        i -= 1;
      }
    }
    ops.reverse();
    return ops;
  }

  function shouldShowDraftEditDiff(card) {
    if (!card || !card.hasUserEdits) {
      return false;
    }
    if (card.editBaselineText == null) {
      return false;
    }
    // Show insert cues until glyph approval clears the baseline (works in both
    // bluish approved and pale-purple editing presentation colors).
    return String(card.editBaselineText) !== String(card.text || "");
  }

  function highlightEditDiffInserts(baselineText, currentText) {
    var ops = diffTokensForEdit(
      tokenizeForEditDiff(baselineText),
      tokenizeForEditDiff(currentText)
    );
    var html = [];
    ops.forEach(function (op) {
      if (!op || op.type === "delete") {
        return;
      }
      var escaped = escapeHtml(op.text);
      if (op.type === "insert") {
        html.push('<span class="lexiom-diff-ins">' + escaped + "</span>");
      } else {
        html.push(escaped);
      }
    });
    return html.join("");
  }

  function captureDraftEditBaseline(card) {
    if (!card) {
      return;
    }
    if (card.editBaselineText == null || !card.hasUserEdits) {
      card.editBaselineText = String(card.text || "");
    }
  }

  function clearDraftEditDiff(card) {
    if (!card) {
      return;
    }
    card.editBaselineText = String(card.text || "");
    card.hasUserEdits = false;
  }

  function countDraftEditorLines(text) {
    return Math.max(1, String(text || "").split("\n").length);
  }

  /**
   * Measure how many soft-wrapped visual rows each newline-separated line
   * occupies in the draft editor, so gutter numbers stay aligned with content.
   */
  function getDraftEditorWrapRowCounts(textarea, text) {
    var surface = textarea && textarea.closest
      ? textarea.closest(".lexiom-draft-card-surface")
      : null;
    if (!textarea || !surface) {
      return [1];
    }

    var style = window.getComputedStyle(textarea);
    var fontSize = parseFloat(style.fontSize) || 14;
    var lineHeight = parseFloat(style.lineHeight);
    if (!lineHeight || !isFinite(lineHeight)) {
      lineHeight = fontSize * 1.45;
    }
    var padLeft = parseFloat(style.paddingLeft) || 0;
    var padRight = parseFloat(style.paddingRight) || 0;
    var contentWidth = Math.max(1, textarea.clientWidth - padLeft - padRight);

    var measurer = textarea.__lexiomWrapMeasurer;
    if (!measurer || !measurer.isConnected) {
      measurer = document.createElement("div");
      measurer.className = "lexiom-draft-card-wrap-measurer";
      measurer.setAttribute("aria-hidden", "true");
      surface.appendChild(measurer);
      textarea.__lexiomWrapMeasurer = measurer;
    }

    measurer.style.fontFamily = style.fontFamily;
    measurer.style.fontSize = style.fontSize;
    measurer.style.fontWeight = style.fontWeight;
    measurer.style.fontStyle = style.fontStyle;
    measurer.style.letterSpacing = style.letterSpacing;
    measurer.style.lineHeight = String(lineHeight) + "px";
    measurer.style.width = contentWidth + "px";
    measurer.style.boxSizing = "content-box";
    measurer.style.padding = "0";
    measurer.style.border = "0";
    measurer.style.margin = "0";
    measurer.style.whiteSpace = "pre-wrap";
    measurer.style.wordWrap = "break-word";
    measurer.style.overflowWrap = "break-word";

    var logicalLines = String(text || "").split("\n");
    if (!logicalLines.length) {
      logicalLines = [""];
    }

    return logicalLines.map(function (line) {
      measurer.textContent = line.length ? line : " ";
      var height = measurer.offsetHeight || lineHeight;
      return Math.max(1, Math.round(height / lineHeight));
    });
  }

  function renderDraftCardGutterHtml(wrapRowCounts) {
    var counts = Array.isArray(wrapRowCounts) && wrapRowCounts.length
      ? wrapRowCounts
      : [1];
    var parts = [];
    counts.forEach(function (rowCount, index) {
      var rows = Math.max(1, rowCount | 0);
      parts.push(
        '<span class="lexiom-draft-card-gutter-line">' + (index + 1) + "</span>"
      );
      for (var i = 1; i < rows; i += 1) {
        parts.push(
          '<span class="lexiom-draft-card-gutter-line is-wrap-pad"></span>'
        );
      }
    });
    return parts.join("");
  }

  function getDraftEditorLineMetrics(textarea) {
    var style = window.getComputedStyle(textarea);
    var fontSize = parseFloat(style.fontSize) || 14;
    var lineHeight = parseFloat(style.lineHeight);
    if (!lineHeight || !isFinite(lineHeight)) {
      lineHeight = fontSize * 1.45;
    }
    return {
      lineHeight: lineHeight,
      paddingTop: parseFloat(style.paddingTop) || 0,
      paddingLeft: parseFloat(style.paddingLeft) || 0,
      paddingRight: parseFloat(style.paddingRight) || 0,
    };
  }

  /**
   * 0-based visual row of the caret, accounting for soft-wrap of prior lines
   * and of the current line up to the caret.
   */
  function getDraftEditorCaretVisualRow(textarea) {
    if (!textarea) {
      return 0;
    }
    var caret = typeof textarea.selectionStart === "number"
      ? textarea.selectionStart
      : 0;
    var fullText = String(textarea.value || "");
    var before = fullText.slice(0, caret);
    var linesBefore = before.split("\n");
    var lineIndex = Math.max(0, linesBefore.length - 1);
    var wrapRows = getDraftEditorWrapRowCounts(textarea, fullText);
    var visualRow = 0;
    for (var i = 0; i < lineIndex; i += 1) {
      visualRow += wrapRows[i] || 1;
    }
    var partialOnLine = linesBefore[linesBefore.length - 1] || "";
    if (!partialOnLine.length) {
      return visualRow;
    }
    var metrics = getDraftEditorLineMetrics(textarea);
    var surface = textarea.closest(".lexiom-draft-card-surface");
    if (!surface) {
      return visualRow;
    }
    var measurer = textarea.__lexiomWrapMeasurer;
    if (!measurer || !measurer.isConnected) {
      getDraftEditorWrapRowCounts(textarea, fullText);
      measurer = textarea.__lexiomWrapMeasurer;
    }
    if (!measurer) {
      return visualRow;
    }
    var contentWidth = Math.max(
      1,
      textarea.clientWidth - metrics.paddingLeft - metrics.paddingRight
    );
    measurer.style.width = contentWidth + "px";
    measurer.style.lineHeight = String(metrics.lineHeight) + "px";
    measurer.textContent = partialOnLine;
    var partialRows = Math.max(
      1,
      Math.round((measurer.offsetHeight || metrics.lineHeight) / metrics.lineHeight)
    );
    return visualRow + (partialRows - 1);
  }

  function updateDraftCardCurrentLine(textarea) {
    if (!textarea || !textarea.closest) {
      return;
    }
    var shell = textarea.closest(".lexiom-draft-card-editor");
    if (!shell) {
      return;
    }
    var lineBand = shell.querySelector(".lexiom-draft-card-current-line");
    if (!lineBand) {
      return;
    }
    var focused = document.activeElement === textarea && !textarea.readOnly;
    shell.classList.toggle("is-focused", focused);
    if (!focused) {
      lineBand.hidden = true;
      return;
    }
    var metrics = getDraftEditorLineMetrics(textarea);
    var visualRow = getDraftEditorCaretVisualRow(textarea);
    var top =
      metrics.paddingTop + visualRow * metrics.lineHeight - textarea.scrollTop;
    lineBand.hidden = false;
    lineBand.style.top = top + "px";
    lineBand.style.height = metrics.lineHeight + "px";
  }

  function syncDraftCardEditor(textarea) {
    if (!textarea || !textarea.closest) {
      return;
    }
    var shell = textarea.closest(".lexiom-draft-card-editor");
    if (!shell) {
      return;
    }
    var gutter = shell.querySelector(".lexiom-draft-card-gutter");
    var highlight = shell.querySelector(".lexiom-draft-card-highlight");
    var emptyHint = shell.querySelector(".lexiom-draft-card-empty-hint");
    var text = String(textarea.value || "");
    var isEmpty = !text.trim();
    var display = text.charAt(text.length - 1) === "\n" ? text + " " : text;
    var card = textarea.__lexiomDiffCard || null;
    var showDiff = shouldShowDraftEditDiff(card);
    var wrapper = shell.closest(".lexiom-draft-card");
    shell.classList.toggle("has-edit-diff", showDiff);
    if (wrapper) {
      wrapper.classList.toggle("has-edit-diff", showDiff);
    }
    if (emptyHint) {
      emptyHint.hidden = !isEmpty || !!textarea.readOnly;
    }
    shell.classList.toggle("is-empty", isEmpty);
    if (gutter) {
      gutter.innerHTML = renderDraftCardGutterHtml(
        getDraftEditorWrapRowCounts(textarea, text)
      );
      gutter.scrollTop = textarea.scrollTop;
    }
    if (highlight) {
      if (showDiff) {
        var diffHtml = highlightEditDiffInserts(card.editBaselineText, text);
        if (text.charAt(text.length - 1) === "\n") {
          diffHtml += " ";
        }
        highlight.innerHTML = diffHtml;
      } else {
        highlight.innerHTML = highlightMarkdownLite(display);
      }
      highlight.scrollTop = textarea.scrollTop;
    }
    updateDraftCardCurrentLine(textarea);
  }

  /**
   * Wrap a draft-card textarea in a VS Code–style shell (gutter + highlight mirror).
   * Keeps the textarea as the editable source of truth; header stays untouched.
   */
  function mountDraftCardEditor(textarea) {
    var shell = document.createElement("div");
    shell.className = "lexiom-draft-card-editor";

    var gutter = document.createElement("div");
    gutter.className = "lexiom-draft-card-gutter";
    gutter.setAttribute("aria-hidden", "true");

    var surface = document.createElement("div");
    surface.className = "lexiom-draft-card-surface";

    var lineBand = document.createElement("div");
    lineBand.className = "lexiom-draft-card-current-line";
    lineBand.setAttribute("aria-hidden", "true");
    lineBand.hidden = true;

    var emptyHint = document.createElement("div");
    emptyHint.className = "lexiom-draft-card-empty-hint";
    emptyHint.setAttribute("aria-hidden", "true");
    emptyHint.textContent = "Type to edit this draft…";

    var highlight = document.createElement("pre");
    highlight.className = "lexiom-draft-card-highlight";
    highlight.setAttribute("aria-hidden", "true");

    surface.appendChild(lineBand);
    surface.appendChild(emptyHint);
    surface.appendChild(highlight);
    surface.appendChild(textarea);
    shell.appendChild(gutter);
    shell.appendChild(surface);

    function onScroll() {
      gutter.scrollTop = textarea.scrollTop;
      highlight.scrollTop = textarea.scrollTop;
      updateDraftCardCurrentLine(textarea);
    }

    function onFocusChange() {
      updateDraftCardCurrentLine(textarea);
    }

    textarea.addEventListener("scroll", onScroll);
    textarea.addEventListener("focus", onFocusChange);
    textarea.addEventListener("blur", onFocusChange);
    textarea.addEventListener("keyup", onFocusChange);
    textarea.addEventListener("click", onFocusChange);
    textarea.addEventListener("select", onFocusChange);
    textarea.addEventListener("mouseup", onFocusChange);

    textarea.addEventListener("keydown", function (event) {
      if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      event.preventDefault();
      var start = textarea.selectionStart;
      var end = textarea.selectionEnd;
      var value = String(textarea.value || "");
      var insert = "  ";
      textarea.value = value.slice(0, start) + insert + value.slice(end);
      textarea.selectionStart = textarea.selectionEnd = start + insert.length;
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });

    if (typeof ResizeObserver !== "undefined") {
      var resizeObserver = new ResizeObserver(function () {
        syncDraftCardEditor(textarea);
      });
      resizeObserver.observe(textarea);
      textarea.__lexiomEditorResizeObserver = resizeObserver;
    }

    syncDraftCardEditor(textarea);
    return shell;
  }

  function updateDraftCardText(osnId, sectionKey, nextText) {
    const card = state.draftCardsByOsnId.get(getDraftCardId(osnId, sectionKey));
    if (!card) {
      return;
    }

    const changed = String(card.text || "") !== String(nextText || "");
    if (changed) {
      captureDraftEditBaseline(card);
      card.text = String(nextText || "");
      card.hasUserEdits = true;
      if (card.approved) {
        card.approved = false;
      }
    }
    const osn = getOsnById(osnId);
    if (changed && osn && isImmatureOsn(osn) && sectionKey === "seed" && osn.maturity && osn.maturity.seed) {
      resetImmatureMaturityFrom(osn, "seed");
      osn.seed = String(nextText || "").trim();
    }
    if (
      changed &&
      osn &&
      isImmatureOsn(osn) &&
      sectionKey === "thematic_lenses" &&
      osn.maturity &&
      osn.maturity.thematic_lenses
    ) {
      resetImmatureMaturityFrom(osn, "thematic_lenses");
      osn.thematic_lenses = [];
    }
    if (
      changed &&
      osn &&
      isImmatureOsn(osn) &&
      sectionKey === "output_spec" &&
      osn.maturity &&
      osn.maturity.output_spec
    ) {
      resetImmatureMaturityFrom(osn, "output_spec");
      osn.output_spec = String(nextText || "").trim();
    }
    if (
      changed &&
      osn &&
      isImmatureOsn(osn) &&
      sectionKey === "success_evidences" &&
      osn.maturity &&
      osn.maturity.success_evidences
    ) {
      resetImmatureMaturityFrom(osn, "success_evidences");
      osn.success_evidences = [];
    }
    state.drafts[card.id] = {
      osnId: osnId,
      sectionKey: sectionKey,
      text: card.text,
      approved: card.approved,
    };
    if (state.selectedLensId) {
      const lensKey = getLensDraftKey(osnId, sectionKey, state.selectedLensId);
      const lensDraft = state.lensDraftsByOsnSection.get(lensKey);
      if (lensDraft) {
        lensDraft.text = card.text;
        lensDraft.hasUserEdits = true;
        if (changed && lensDraft.approved) {
          lensDraft.approved = false;
          card.approved = false;
        }
        state.lensDraftsByOsnSection.set(lensKey, lensDraft);
      }
    }
    appendAction("edit_draft", { osnId: osnId, sectionKey: sectionKey });
  }

  function toggleDraftApproval(osnId, sectionKey) {
    const osn = getOsnById(osnId);
    const card = state.draftCardsByOsnId.get(getDraftCardId(osnId, sectionKey));
    if (!card) {
      return;
    }
    const nextApproved = !card.approved;
    if (nextApproved && !canApproveImmatureSection(osn, sectionKey, card)) {
      appendAction("approval_blocked", {
        osnId: osnId,
        sectionKey: sectionKey,
        reason: isOsnMetaSectionKey(sectionKey) ? "empty_meta_field" : "maturation_gate",
      });
      return;
    }
    dispatchWhiteMove("TOGGLE_APPROVAL", { osnId: osnId, sectionKey: sectionKey });
    appendAction("toggle_approval", { osnId: osnId, sectionKey: sectionKey, approved: nextApproved });
  }

  function branchOsnFromParent(parentOsnId) {
    if (!state.osnsById.has(parentOsnId)) {
      return;
    }
    dispatchWhiteMove("BRANCH_OSN", { parentOsnId: parentOsnId });
    appendAction("branch_osn", {
      parentOsnId: parentOsnId,
      childOsnId: state.selectedOsnId,
    });
  }

  function describeOsnBranchLabel(osn) {
    return getOsnOriginLeafLabel(osn);
  }

  function promptPruneOsnBranch(rootOsnId) {
    const rootOsn = getOsnById(rootOsnId);
    if (!rootOsn) {
      return;
    }

    const subtreeIds = collectBranchSubtreeIds(rootOsnId);
    if (!subtreeIds.length) {
      return;
    }

    const labels = subtreeIds.map(function (osnId) {
      return describeOsnBranchLabel(getOsnById(osnId));
    });
    const parentIds = Array.isArray(rootOsn.graph && rootOsn.graph.parent_osn_ids) ? rootOsn.graph.parent_osn_ids : [];
    const isGraphRoot = parentIds.length === 0;
    const preview =
      labels.slice(0, 8).join("\n") + (labels.length > 8 ? "\n… +" + String(labels.length - 8) + " more" : "");

    let confirmRootPrune = false;
    if (isGraphRoot) {
      const rootAck = window.confirm(
        "Prune OSN graph root?\n\n" +
          describeOsnBranchLabel(rootOsn) +
          "\n\nThis will tombstone the entire live OSN tree (" +
          String(subtreeIds.length) +
          " nodes).\n\nNodes:\n" +
          preview +
          "\n\nConfirm only if you intend to remove the whole graph branch from disk."
      );
      if (!rootAck) {
        return;
      }
      confirmRootPrune = true;
    } else {
      const ack = window.confirm(
        "Prune this OSN branch?\n\n" +
          describeOsnBranchLabel(rootOsn) +
          "\n\n" +
          String(subtreeIds.length) +
          " node(s) will be tombstoned (*.tomb.osn.yaml), including all descendants:\n\n" +
          preview
      );
      if (!ack) {
        return;
      }
    }

    dispatchWhiteMove("PRUNE_OSN_BRANCH", {
      osnId: rootOsnId,
      confirmRootPrune: confirmRootPrune,
    });
  }

  function pruneOsnBranch(rootOsnId) {
    promptPruneOsnBranch(rootOsnId);
  }

  function selectLens(osnId, lensId) {
    if (!state.osnsById.has(osnId) || !lensId) {
      return;
    }
    const osn = getOsnById(osnId);
    if (isImmatureOsn(osn) && !getOsnMaturity(osn).thematic_lenses) {
      return;
    }
    if (state.selectedSectionKey === BUILD_SECTION_KEY || state.selectedEvidenceId) {
      return;
    }
    dispatchWhiteMove("SELECT_THEMATIC_LENS", {
      osnId: osnId,
      sectionKey: state.selectedSectionKey,
      lensId: lensId,
    });
  }

  function resolveSelectableSectionKey(osn, preferredKey) {
    const preferred = preferredKey || DEFAULT_SELECTED_SECTION_KEY;
    if (!osn || isSectionUnlocked(osn, preferred)) {
      return preferred;
    }
    if (isSectionUnlocked(osn, DEFAULT_SELECTED_SECTION_KEY)) {
      return DEFAULT_SELECTED_SECTION_KEY;
    }
    for (let i = 0; i < OSN_SECTION_DEFS.length; i += 1) {
      if (isSectionUnlocked(osn, OSN_SECTION_DEFS[i].key)) {
        return OSN_SECTION_DEFS[i].key;
      }
    }
    return "seed";
  }

  /**
   * When moving between OSNs, keep working on the same core section key
   * (Seed / Thematic Lenses / Output Spec / Success Evidences) if one is
   * active. Owner, name, Build, and other non-core views fall back to the
   * default section so navigation still lands on a normal card.
   */
  function getRememberedSectionKey() {
    const current = state.selectedSectionKey;
    const isCore = OSN_SECTION_DEFS.some(function (section) {
      return section.key === current;
    });
    return isCore ? current : DEFAULT_SELECTED_SECTION_KEY;
  }

  function selectOsn(osnId, nextSectionKey, options) {
    if (!state.osnsById.has(osnId)) {
      return;
    }
    const osn = getOsnById(osnId);
    const requestedSectionKey = resolveSelectableSectionKey(
      osn,
      nextSectionKey || DEFAULT_SELECTED_SECTION_KEY
    );
    const expandOnSelect = !!(options && options.expandOnSelect);
    const changed =
      state.selectedOsnId !== osnId ||
      state.selectedSectionKey !== requestedSectionKey ||
      state.selectedEvidenceId !== null ||
      (expandOnSelect && !isOsnExpanded(osnId)) ||
      state.selectedLensId !== null;
    if (!changed) {
      // Clicking the already-focused OSN in full-graph mode still exits to the cockpit.
      if (state.ui.fullGraphMode) {
        toggleFullGraphMode(false);
      }
      return;
    }
    const previousSection = state.selectedSectionKey;
    dispatchWhiteMove("SELECT_OSN", {
      osnId: osnId,
      sectionKey: requestedSectionKey,
      expandOnSelect: expandOnSelect,
      clearLens: true,
    });
    appendAction("select_osn", { osnId: osnId, sectionKey: requestedSectionKey });
    if (requestedSectionKey === BUD_SECTION_KEY) {
      appendAction("open_bud", {
        osnId: osnId,
        runId: osn.bud && osn.bud.run_id,
        media_kind: osn.bud && osn.bud.media_kind,
      });
    } else if (previousSection === BUD_SECTION_KEY) {
      appendAction("close_bud", { osnId: osnId });
    }
  }

  function toggleOsnSections(osnId) {
    if (!state.osnsById.has(osnId)) {
      return;
    }

    const nextExpanded = !isOsnExpanded(osnId);
    const selectionChanged =
      state.selectedOsnId !== osnId ||
      state.selectedSectionKey !== DEFAULT_SELECTED_SECTION_KEY ||
      state.selectedEvidenceId !== null;
    const expansionChanged = isOsnExpanded(osnId) !== nextExpanded;
    const lensChanged = state.selectedLensId !== null;

    if (!selectionChanged && !expansionChanged && !lensChanged) {
      return;
    }

    dispatchWhiteMove("TOGGLE_OSN_SECTIONS", {
      osnId: osnId,
      expanded: nextExpanded,
    });
    appendAction("select_osn", { osnId: osnId, sectionKey: DEFAULT_SELECTED_SECTION_KEY });
    appendAction("toggle_osn_sections", { osnId: osnId, expanded: nextExpanded });
  }

  async function loadEvidenceAvailability() {
    const api = getEvidenceLinksApi();
    if (!api) {
      return;
    }

    state.evidenceAvailableByKey = new Map();
    state.evidenceResolvedByKey = new Map();
    state.evidenceBundledAvailableByKey = new Map();
    state.evidenceBundledResolvedByKey = new Map();

    const probes = [];
    state.orderedOsns.forEach(function (osn) {
      const candidates = api.listCandidateEvidenceLinks
        ? api.listCandidateEvidenceLinks(osn)
        : getLinkedEvidencesForOsn(osn);

      const seenKeys = new Set();
      candidates.forEach(function (link) {
        const key = getEvidenceLinkKey(link.origin.osnId, link.evidenceId);
        if (seenKeys.has(key)) {
          return;
        }
        seenKeys.add(key);

        probes.push(
          (async function () {
            const versions = api.SUPPORTED_EVIDENCE_VERSIONS || [link.version || "v2"];
            for (let i = 0; i < versions.length; i += 1) {
              const version = versions[i];
              const versionedLinks = api.linkSuccessEvidencesForOsn(osn, { evidenceVersion: version });
              const candidate = versionedLinks.find(function (entry) {
                return entry.evidenceId === link.evidenceId;
              });
              if (!candidate) {
                continue;
              }
              try {
                const response = await fetch(candidate.artifactUrl, { method: "HEAD", cache: "no-store" });
                if (response.ok) {
                  state.evidenceAvailableByKey.set(key, true);
                  state.evidenceResolvedByKey.set(key, candidate);
                  state.evidenceBundledAvailableByKey.set(key, true);
                  state.evidenceBundledResolvedByKey.set(key, candidate);
                  return;
                }
              } catch (_error) {
                // try next version
              }
            }
            state.evidenceAvailableByKey.set(key, false);
            state.evidenceBundledAvailableByKey.set(key, false);
          })()
        );
      });
    });

    await Promise.all(probes);
  }

  function buildCollectionResolvedLink(osn, target) {
    if (!osn || !target || !target.artifact) {
      return null;
    }
    const fileName = String(target.artifact.file_name || "").trim();
    const url = String(target.artifact.url || "").trim();
    if (!fileName || !url) {
      return null;
    }
    const extension = fileName.includes(".")
      ? fileName.split(".").pop().toLowerCase()
      : "";
    const def = getEvidenceDefinition(osn, target.evidence_id);
    return {
      evidenceId: String(target.evidence_id),
      kind: String((target.kind || (def && def.kind) || "")).trim(),
      inspectionPrompt: def ? String(def.inspection_prompt || "").trim() : "",
      origin: {
        osnId: osn.id,
        fileName: String(osn.file_name || osn.id),
      },
      artifactFileName: fileName,
      artifactUrl: url,
      mediaType: String(target.artifact.media_type || "text"),
      extension: extension,
      version: "v1",
      source: "build_collection",
      collectionStatus: String(target.status || "collected"),
      runId: target.run_id || null,
    };
  }

  function mergeFocusEvidenceCollection(payload) {
    const osnId = payload && payload.osn_id ? String(payload.osn_id) : "";
    const osn = osnId ? getOsnById(osnId) : null;
    if (!osn) {
      return false;
    }

    const defs = Array.isArray(osn.success_evidences) ? osn.success_evidences : [];
    const focusKeys = [];
    defs.forEach(function (def) {
      const eid = String(def.evidence_id || "").trim();
      if (eid) {
        focusKeys.push(getEvidenceLinkKey(osnId, eid));
      }
    });

    function sameResolved(a, b) {
      if (!a && !b) {
        return true;
      }
      if (!a || !b) {
        return false;
      }
      return (
        String(a.artifactUrl || "") === String(b.artifactUrl || "") &&
        String(a.artifactFileName || "") === String(b.artifactFileName || "") &&
        String(a.source || "") === String(b.source || "") &&
        String(a.collectionStatus || "") === String(b.collectionStatus || "")
      );
    }

    const nextBuildByKey = new Map();
    const targets = payload && Array.isArray(payload.targets) ? payload.targets : [];
    targets.forEach(function (target) {
      if (!target || target.status !== "collected" || !target.artifact) {
        return;
      }
      const link = buildCollectionResolvedLink(osn, target);
      if (!link) {
        return;
      }
      nextBuildByKey.set(getEvidenceLinkKey(osnId, link.evidenceId), link);
    });

    let changed = false;
    focusKeys.forEach(function (key) {
      const prevBuild = state.evidenceBuildResolvedByKey.get(key) || null;
      const nextBuild = nextBuildByKey.get(key) || null;

      if (sameResolved(prevBuild, nextBuild)) {
        if (!nextBuild) {
          const bundled = state.evidenceBundledResolvedByKey.get(key);
          const current = state.evidenceResolvedByKey.get(key);
          if (bundled && !sameResolved(current, bundled)) {
            state.evidenceResolvedByKey.set(key, bundled);
            state.evidenceAvailableByKey.set(key, true);
            changed = true;
          }
        }
        return;
      }

      changed = true;
      if (nextBuild) {
        state.evidenceBuildResolvedByKey.set(key, nextBuild);
        state.evidenceAvailableByKey.set(key, true);
        state.evidenceResolvedByKey.set(key, nextBuild);
        return;
      }

      state.evidenceBuildResolvedByKey.delete(key);
      const bundled = state.evidenceBundledResolvedByKey.get(key);
      if (bundled) {
        state.evidenceResolvedByKey.set(key, bundled);
        state.evidenceAvailableByKey.set(key, true);
      } else {
        const current = state.evidenceResolvedByKey.get(key);
        if (current && current.source === "build_collection") {
          state.evidenceResolvedByKey.delete(key);
          state.evidenceAvailableByKey.set(key, false);
        }
      }
    });

    return changed;
  }

  async function pollFocusEvidenceCollections() {
    const poll = state.evidenceCollectionPoll;
    if (poll.inFlight) {
      return;
    }
    if (typeof document !== "undefined" && document.hidden) {
      return;
    }
    const osn = getSelectedOsn();
    if (!osn || !osn.id) {
      return;
    }

    poll.inFlight = true;
    poll.lastFocusOsnId = osn.id;
    try {
      const response = await fetch(
        "/lexiom13/evidence/collections?osn_id=" + encodeURIComponent(osn.id),
        { cache: "no-store" }
      );
      const payload = await response.json().catch(function () {
        return null;
      });
      if (!response.ok) {
        throw new Error(
          (payload && payload.detail) ||
            "Evidence collections poll failed (" + response.status + ")"
        );
      }
      poll.lastError = null;
      poll.lastPolledAt = (payload && payload.polled_at) || new Date().toISOString();
      const changed = mergeFocusEvidenceCollection(payload);
      if (changed) {
        renderApp();
      }
    } catch (error) {
      poll.lastError = error && error.message ? error.message : String(error);
    } finally {
      poll.inFlight = false;
    }
  }

  function kickEvidenceCollectionPoll() {
    pollFocusEvidenceCollections();
  }

  function stopEvidenceCollectionPoller() {
    const poll = state.evidenceCollectionPoll;
    if (poll.timerId) {
      clearInterval(poll.timerId);
      poll.timerId = null;
    }
  }

  function startEvidenceCollectionPoller() {
    stopEvidenceCollectionPoller();
    const poll = state.evidenceCollectionPoll;
    poll.timerId = setInterval(function () {
      pollFocusEvidenceCollections();
    }, EVIDENCE_COLLECTION_POLL_MS);

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", function () {
        if (!document.hidden) {
          kickEvidenceCollectionPoll();
        }
      });
    }

    kickEvidenceCollectionPoll();
  }

  async function fetchYaml(path) {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to load " + path + " (" + response.status + ")");
    }
    return response.text();
  }

  async function resolveOsnFilePaths() {
    try {
      const response = await fetch("/lexiom13/osn/list", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to list OSN files (" + response.status + ")");
      }
      const payload = await response.json();
      if (payload && Array.isArray(payload.paths) && payload.paths.length) {
        return payload.paths.slice();
      }
    } catch (_error) {
      // Fall back to the built-in canonical quartet when the server list is unavailable.
    }
    return DEFAULT_OSN_FILE_PATHS.slice();
  }

  function warnGraphReciprocityMismatch() {
    state.orderedOsns.forEach(function (osn) {
      const parentIds = Array.isArray(osn.graph && osn.graph.parent_osn_ids) ? osn.graph.parent_osn_ids : [];
      parentIds.forEach(function (parentId) {
        const parent = getOsnById(parentId);
        if (!parent) {
          console.warn("[lexiom13] OSNG reciprocity: missing parent", parentId, "for", osn.id);
          return;
        }
        const children = Array.isArray(parent.graph && parent.graph.child_osn_ids)
          ? parent.graph.child_osn_ids
          : [];
        if (children.indexOf(osn.id) === -1) {
          console.warn(
            "[lexiom13] OSNG reciprocity: parent",
            parentId,
            "does not list child",
            osn.id
          );
        }
      });

      const childIds = Array.isArray(osn.graph && osn.graph.child_osn_ids) ? osn.graph.child_osn_ids : [];
      childIds.forEach(function (childId) {
        if (typeof childId === "string" && childId.indexOf("osn.draft.") === 0) {
          return;
        }
        if (!getOsnById(childId)) {
          console.warn("[lexiom13] OSNG reciprocity: missing child", childId, "listed on", osn.id);
        }
      });
    });
  }

  async function loadOsnGraph() {
    const filePaths = await resolveOsnFilePaths();
    const loaded = await Promise.all(
      filePaths.map(async function (path) {
        const raw = await fetchYaml(path);
        const parsed = window.jsyaml.load(raw);
        if (!parsed || typeof parsed !== "object") {
          throw new Error("Invalid YAML object in " + path);
        }
        parsed.__sourcePath = path;
        parsed.__fileLabel = path.split("/").pop() || path;
        return normalizeLoadedOsn(parsed);
      })
    );

    state.osnsById = new Map(
      loaded.map(function (osn) {
        return [osn.id, osn];
      })
    );
    state.orderedOsns = loaded;
    state.runtimeOsnIds = [];
    state.branchSequence = 0;
    state.draftCardsByOsnId = new Map();
    state.expandedOsnIds = new Set();
    state.buildPreviewsByOsnId = new Map();
    state.lensThreadsByKey = new Map();
    state.lensDraftsByOsnSection = new Map();
    state.lensIntensityByKey = new Map();
    state.selectedLensId = null;
    state.lensMode = "reframe";
    state.drafts = {};
    state.ui = {
      pendingLensRefresh: null,
      lensInferencePending: false,
      lensInferenceError: null,
      pendingMaturationProposal: null,
      maturationInferencePending: false,
      maturationInferenceError: null,
      pendingCanonization: null,
      canonizationPending: false,
      canonizationError: null,
      pendingPersist: null,
      persistPending: false,
      persistError: null,
      pendingPrune: null,
      prunePending: false,
      pruneError: null,
      cockpitTitle: null,
      cockpitTitlePending: false,
      cockpitTitleError: null,
      cockpitTitleStale: true,
      fullGraphMode: false,
      fullGraphKind: "classical",
      planePickerOpen: false,
      lockedPlaneId: PLANE_NATIVE_ID,
    };
    state.activePlaneByOsnId = new Map();
    loaded.forEach(function (osn) {
      OSN_SECTION_DEFS.forEach(function (section) {
        ensureDraftCardState(osn, section.key);
      });
    });

    warnGraphReciprocityMismatch();

    if (!state.osnsById.has(state.selectedOsnId) && loaded.length > 0) {
      state.selectedOsnId = loaded[0].id;
    }
  }

  function renderLenses(osn) {
    if (isImmatureOsn(osn) && !getOsnMaturity(osn).thematic_lenses) {
      if (!getOsnMaturity(osn).seed) {
        els.lenses.innerHTML =
          '<div class="lexiom-13-muted">Approve the OSN seed before thematic discipline lenses unlock.</div>';
        return;
      }
      if (state.ui.maturationInferencePending) {
        els.lenses.innerHTML =
          '<div class="lexiom-13-lens-status">Naming this OSN and proposing thematic discipline lenses from the approved seed...</div>';
        return;
      }
      if (state.ui.maturationInferenceError) {
        els.lenses.innerHTML =
          '<div class="lexiom-13-lens-status lexiom-13-error">' +
          escapeHtml(state.ui.maturationInferenceError) +
          "</div>";
        return;
      }
      els.lenses.innerHTML =
        '<div class="lexiom-13-muted">Approve the thematic lenses draft in the graph to unlock lens refinement and continue maturation.</div>';
      return;
    }

    const lenses = Array.isArray(osn && osn.thematic_lenses) ? osn.thematic_lenses : [];
    if (!lenses.length) {
      if (isImmatureOsn(osn) && getOsnMaturity(osn).thematic_lenses) {
        els.lenses.innerHTML =
          '<div class="lexiom-13-muted">No thematic lenses are available for refinement yet.</div>';
      } else {
        els.lenses.innerHTML = '<div class="lexiom-13-muted">No thematic lenses defined.</div>';
      }
      return;
    }

    const inferenceBusy = state.ui.lensInferencePending || state.ui.maturationInferencePending;

    const isBuildSection = state.selectedSectionKey === BUILD_SECTION_KEY;
    const isBudSection = state.selectedSectionKey === BUD_SECTION_KEY;
    const isEvidenceView = !!state.selectedEvidenceId;
    const activeLens = state.selectedLensId ? getLensById(osn, state.selectedLensId) : null;
    const activeLensName = activeLens ? String(activeLens.name || activeLens.lens_id || "lens") : "";
    const activePass = state.selectedLensId
      ? getLensIntensity(state.selectedOsnId, state.selectedSectionKey, state.selectedLensId)
      : 0;
    const activeSectionLabel = getSectionLabel(state.selectedSectionKey);
    const statusLine = state.ui.maturationInferencePending
      ? '<div id="lexiom-l2-lens-status" class="lexiom-13-lens-status">Proposing the next maturation draft...</div>'
      : state.ui.lensInferencePending
      ? '<div id="lexiom-l2-lens-status" class="lexiom-13-lens-status">Shaping ' +
        escapeHtml(activeSectionLabel) +
        " through " +
        escapeHtml(activeLensName || "the selected lens") +
        " — pass " +
        String(activePass + 1) +
        "...</div>"
      : state.ui.lensInferenceError
        ? '<div id="lexiom-l2-lens-status" class="lexiom-13-lens-status lexiom-13-error">' + escapeHtml(state.ui.lensInferenceError) + "</div>"
        : state.selectedLensId && activePass > 0
          ? '<div id="lexiom-l2-lens-status" class="lexiom-13-lens-status">' +
            escapeHtml(activeLensName) +
            " applied \u00d7" +
            String(activePass) +
            " to " +
            escapeHtml(activeSectionLabel) +
            " — click again to push further into this lens.</div>"
          : state.selectedLensId
            ? '<div id="lexiom-l2-lens-status" class="lexiom-13-lens-status">Active lens guides the center draft card.</div>'
            : '<div id="lexiom-l2-lens-status" class="lexiom-13-lens-status lexiom-13-muted">Select a lens to shape the current section through its discipline.</div>';

    els.lenses.innerHTML =
      statusLine +
      lenses
        .map(function (lens) {
          const lensId = String(lens.lens_id || lens.name || "");
          const isSelected = state.selectedLensId === lensId;
          const intensity = getLensIntensity(state.selectedOsnId, state.selectedSectionKey, lensId);
          return (
            '<button type="button" id="' +
            toDomId("lexiom-l2-lens", lensId) +
            '" class="lexiom-13-placeholder-chip lexiom-lens-chip lexiom-lens-chip-active' +
            (isSelected ? " is-selected" : "") +
            (isBuildSection || isBudSection || isEvidenceView || inferenceBusy ? " is-disabled" : "") +
            '" data-lens-id="' +
            escapeHtml(lensId) +
            '" title="' +
            escapeHtml(String(lens.purpose || lens.name || "Lens")) +
            '"' +
            (isBuildSection || isBudSection || isEvidenceView || inferenceBusy ? " disabled" : "") +
            ">" +
            escapeHtml(lens.name || lens.lens_id || "Lens") +
            (intensity > 0
              ? ' <span class="lexiom-13-lens-pass">\u00d7' + String(intensity) + "</span>"
              : "") +
            "</button>"
          );
        })
        .join("");

    bindLensTriggers(els.lenses);
  }

  function bindLensTriggers(container) {
    container.querySelectorAll(".lexiom-lens-chip-active").forEach(function (button) {
      button.addEventListener("click", function () {
        const lensId = button.getAttribute("data-lens-id");
        const osn = getSelectedOsn();
        if (!osn || !lensId || button.disabled) {
          return;
        }
        selectLens(osn.id, lensId);
      });
    });
  }

  function renderGraphNode(osnId, depth, ancestorIdSet, options) {
    const osn = getOsnById(osnId);
    if (!osn) {
      return "";
    }

    const renderOptions = options || {};
    const navigationOnly = !!renderOptions.navigationOnly;
    const allowedOsnIds = renderOptions.allowedOsnIds || null;
    const siblingArrows =
      !navigationOnly && depth === 0 && renderOptions.siblingArrows
        ? renderOptions.siblingArrows
        : null;
    const previousSiblingArrow = siblingArrows ? siblingArrows.previousHtml || "" : "";
    const nextSiblingArrow = siblingArrows ? siblingArrows.nextHtml || "" : "";
    const children = renderOptions.includeChildren === false
      ? []
      : (Array.isArray(osn.graph && osn.graph.child_osn_ids) ? osn.graph.child_osn_ids : [])
          .filter(function (childId) {
            return !allowedOsnIds || allowedOsnIds.has(childId);
          });
    const isSelected = osn.id === state.selectedOsnId;
    const isAncestor = !isSelected && ancestorIdSet.has(osn.id);
    const isBuildable = canBuildOsn(osn);
    const buildLifecycle = getBuildLifecycle(osn.id);
    const buildPhase =
      buildLifecycle && buildLifecycle.phase ? buildLifecycle.phase : "idle";
    const isBuildActive = isBuildLifecycleActive(buildLifecycle);
    const hasBuildChild = state.buildPreviewsByOsnId.has(osn.id);
    const isBuildLit =
      buildPhase === "completed" ||
      (buildPhase === "idle" && hasBuildChild);
    const isImmature = isImmatureOsn(osn);
    const sectionClass = depth === 0 ? "lexiom-osn-graph-root-wrap" : "lexiom-osn-graph-branch";
    const buildBranch =
      !navigationOnly && hasBuildChild && isSelected
      ? (
          '<div class="lexiom-osn-graph-branch lexiom-osn-section-branch lexiom-osn-build-branch">' +
          '<button type="button" id="' +
          toDomId("lexiom-osn-build-section", osn.id) +
          '" class="lexiom-osn-graph-node lexiom-osn-trigger lexiom-osn-section-trigger lexiom-osn-build-child' +
          (state.selectedSectionKey === BUILD_SECTION_KEY && !state.selectedEvidenceId ? " is-selected" : "") +
          " is-" +
          escapeHtml(buildPhase) +
          '" data-osn-id="' +
          escapeHtml(osn.id) +
          '" data-section-key="' +
          BUILD_SECTION_KEY +
          '">' +
          "Build · " +
          escapeHtml(getBuildPhaseLabel(buildLifecycle)) +
          "</button>" +
          "</div>"
        )
      : "";
    const filteringApi = getOsnFilteringApi();
    const showEvidenceApproval =
      !!(filteringApi &&
        filteringApi.isFilterEnabled(filteringApi.FILTER_IDS.EVIDENCE_APPROVAL));
    const approvalGlyph = showEvidenceApproval
      ? filteringApi.renderEvidenceApprovalGlyph(osn, getOsnFilteringContext())
      : "";
    const showBuildControls =
      !navigationOnly &&
      (filteringApi
        ? filteringApi.isFilterEnabled(filteringApi.FILTER_IDS.BUILD_CONTROLS)
        : true);
    const buildTrigger = showBuildControls
      ? (
          '<button type="button" id="' +
          toDomId("lexiom-osn-build-trigger", osn.id) +
          '" class="lexiom-osn-build-trigger' +
          (isBuildable ? "" : " is-disabled") +
          (isBuildLit ? " is-lit" : "") +
          (isBuildActive ? " is-busy" : "") +
          (buildPhase !== "idle" ? " is-" + escapeHtml(buildPhase) : "") +
          '" data-build-osn-id="' +
          escapeHtml(osn.id) +
          '" aria-label="' +
          escapeHtml(getBuildTitle(osn, buildLifecycle)) +
          '" title="' +
          escapeHtml(getBuildTitle(osn, buildLifecycle)) +
          '"' +
          (isBuildActive ? ' aria-busy="true"' : "") +
          ((!isBuildable || isBuildActive) ? " disabled" : "") +
          ">" +
          getBuildGlyphMarkup(osn, buildLifecycle) +
          "</button>"
        )
      : "";
    const statusRail =
      showEvidenceApproval || showBuildControls
        ? (
            '<div class="lexiom-osn-node-status-rail' +
            (showEvidenceApproval && showBuildControls ? " is-dual" : "") +
            '" aria-hidden="' +
            (showEvidenceApproval || showBuildControls ? "false" : "true") +
            '">' +
            (showEvidenceApproval
              ? approvalGlyph ||
                '<span class="lexiom-osn-approval-glyph is-none" aria-hidden="true">·</span>'
              : "") +
            buildTrigger +
            "</div>"
          )
        : "";
    const branchTrigger =
      !navigationOnly && isSelected
      ? (
          '<button type="button" id="' +
          toDomId("lexiom-osn-branch-trigger", osn.id) +
          '" class="lexiom-osn-branch-trigger" data-branch-parent-id="' +
          escapeHtml(osn.id) +
          '" aria-label="Branch new OSN" title="Branch new OSN">+</button>'
        )
      : "";
    const pruneTrigger =
      !navigationOnly && isSelected
      ? (
          '<button type="button" id="' +
          toDomId("lexiom-osn-prune-trigger", osn.id) +
          '" class="lexiom-osn-prune-trigger" data-prune-osn-id="' +
          escapeHtml(osn.id) +
          '" aria-label="Prune OSN branch" title="Prune OSN branch (tombstone subtree)">×</button>'
        )
      : "";
    const editNameInner =
      !navigationOnly && isSelected
      ? (
          '<span class="lexiom-osn-edit-name-trigger' +
          (state.selectedSectionKey === OSN_FILE_NAME_META_KEY ? " is-selected" : "") +
          '" role="button" tabindex="0" data-osn-id="' +
          escapeHtml(osn.id) +
          '" data-section-key="' +
          OSN_FILE_NAME_META_KEY +
          '" aria-label="Edit OSN name" title="Edit OSN name">' +
          getOsnNameEditGlyphMarkup() +
          "</span>"
        )
      : "";

    return (
      '<div id="' +
      toDomId("lexiom-osn-node-wrap", osn.id) +
      '" class="' +
      sectionClass +
      '">' +
      '<div class="lexiom-osn-node-row">' +
      previousSiblingArrow +
      '<button type="button" id="' +
      toDomId("lexiom-osn-node", osn.id) +
      '" class="lexiom-osn-graph-node lexiom-osn-trigger lexiom-osn-node-main' +
      (isSelected ? " is-selected" : "") +
      (isAncestor ? " is-ancestor" : "") +
      (isImmature ? " is-immature" : "") +
      '" data-osn-id="' +
      escapeHtml(osn.id) +
      '" title="' +
      escapeTitleAttr(getOsnHoverTitle(osn)) +
      '"><span class="lexiom-osn-node-label">' +
      escapeHtml(getOsnOriginLeafLabel(osn)) +
      "</span>" +
      editNameInner +
      "</button>" +
      nextSiblingArrow +
      branchTrigger +
      pruneTrigger +
      statusRail +
      "</div>" +
      buildBranch +
      children.map(function (childId) {
        return renderGraphNode(childId, depth + 1, ancestorIdSet, renderOptions);
      }).join("") +
      "</div>"
    );
  }

  /**
   * Selection-only row for the Focus-centered ancestor stack: leaf label plus
   * ancestor neon, no section glyphs and no branch/prune/build chrome.
   * Optional PlaneShift shadow sits inline beside the native/direct ancestor
   * to emphasize secondary-plane inheritance from that lineage.
   */
  function renderAncestorRow(osn, options) {
    if (!osn) {
      return "";
    }
    const renderOptions = options || {};
    const planeShadowHtml = renderOptions.planeShadowHtml || "";
    return (
      '<div id="' +
      toDomId("lexiom-osn-node-wrap", osn.id) +
      '" class="lexiom-osn-graph-ancestor-row' +
      (planeShadowHtml ? " has-plane-shadow" : "") +
      '">' +
      '<div class="lexiom-osn-node-row">' +
      '<button type="button" id="' +
      toDomId("lexiom-osn-node", osn.id) +
      '" class="lexiom-osn-graph-node lexiom-osn-trigger lexiom-osn-node-main is-ancestor' +
      (isImmatureOsn(osn) ? " is-immature" : "") +
      '" data-osn-id="' +
      escapeHtml(osn.id) +
      '" title="' +
      escapeTitleAttr(getOsnHoverTitle(osn)) +
      '"><span class="lexiom-osn-node-label">' +
      escapeHtml(getOsnOriginLeafLabel(osn)) +
      "</span></button>" +
      planeShadowHtml +
      "</div>" +
      "</div>"
    );
  }

  /**
   * Host the PlaneShift shadow only beside a native (plane-zero) ancestor —
   * the last row in the native ancestor column (closest to Focus). Never
   * companion layout-trunk rows on an additional plane.
   */
  function resolvePlaneShadowHostOsnId(focusOsn, ancestorOsns, plane) {
    if (!plane || plane.kind !== "native") {
      return null;
    }
    const rows = Array.isArray(ancestorOsns) ? ancestorOsns : [];
    if (!rows.length) {
      return null;
    }
    const host = rows[rows.length - 1];
    return host && host.id ? host.id : null;
  }

  /**
   * Both sibling arrows always render beside the Focus OSN so its horizontal
   * position stays stable: an empty fixed-width placeholder when there is no
   * sibling in that direction, a neon-lit clickable arrow when there is.
   */
  function renderSiblingArrow(direction, sibling) {
    const glyph = direction === "previous" ? "◀" : "▶";
    if (!sibling) {
      return (
        '<span class="lexiom-osn-sibling-trigger is-empty is-' +
        direction +
        '" aria-hidden="true">' +
        glyph +
        "</span>"
      );
    }
    const label =
      (direction === "previous" ? "Previous sibling: " : "Next sibling: ") +
      getOsnOriginLeafLabel(sibling);
    return (
      '<button type="button" class="lexiom-osn-sibling-trigger is-available is-' +
      direction +
      '" data-sibling-osn-id="' +
      escapeHtml(sibling.id) +
      '" aria-label="' +
      escapeHtml(label) +
      '" title="' +
      escapeHtml(label) +
      '">' +
      glyph +
      "</button>"
    );
  }

  function renderGraphFilters() {
    const filteringApi = getOsnFilteringApi();
    if (!filteringApi || !els.graphFilters) {
      return;
    }
    els.graphFilters.innerHTML = filteringApi.renderFilterBar(
      state.orderedOsns,
      getOsnFilteringContext()
    );
    filteringApi.bindFilterBar(els.graphFilters, function (filterId, enabled) {
      appendAction("toggle_osn_graph_filter", { filterId: filterId, enabled: enabled });
      renderApp();
    });
  }

  function syncOptionalChromeVisibility() {
    const filteringApi = getOsnFilteringApi();
    const showTopBar = !!(
      filteringApi &&
      filteringApi.isFilterEnabled(filteringApi.FILTER_IDS.TOP_BAR)
    );
    const showCockpitTitle = !!(
      filteringApi &&
      filteringApi.isFilterEnabled(filteringApi.FILTER_IDS.COCKPIT_TITLE)
    );
    if (els.topHud) {
      els.topHud.hidden = !showTopBar;
      els.topHud.setAttribute("aria-hidden", showTopBar ? "false" : "true");
    }
    if (els.cockpitTitle) {
      els.cockpitTitle.hidden = !showCockpitTitle;
      els.cockpitTitle.setAttribute("aria-hidden", showCockpitTitle ? "false" : "true");
    }
    // When the cockpit title is muted, reclaim the outer viewport margin so the
    // cabinet frame fills the browser window.
    document.body.classList.toggle("lexiom-13-edge-fill", !showCockpitTitle);
  }

  function syncFullGraphModeVisibility() {
    const enabled = !!state.ui.fullGraphMode;
    const kind = state.ui.fullGraphKind === "garden" ? "garden" : "classical";
    document.body.classList.toggle("lexiom-13-full-graph", enabled);
    document.body.classList.toggle("lexiom-13-full-graph-garden", enabled && kind === "garden");
    if (els.fullGraphToggle) {
      els.fullGraphToggle.setAttribute("aria-pressed", enabled ? "true" : "false");
      els.fullGraphToggle.setAttribute(
        "aria-label",
        enabled ? "Exit full OSN graph" : "Show full OSN graph"
      );
      els.fullGraphToggle.title = enabled
        ? "Return to cockpit graph"
        : "Show full OSN graph";
    }
    if (els.fullGraphKindSwitch) {
      els.fullGraphKindSwitch.hidden = !enabled;
      els.fullGraphKindSwitch.querySelectorAll("[data-full-graph-kind]").forEach(function (btn) {
        const btnKind = btn.getAttribute("data-full-graph-kind");
        btn.setAttribute("aria-pressed", btnKind === kind ? "true" : "false");
      });
    }
  }

  function toggleFullGraphMode(forceEnabled) {
    const nextEnabled =
      typeof forceEnabled === "boolean" ? forceEnabled : !state.ui.fullGraphMode;
    if (!!state.ui.fullGraphMode === nextEnabled) {
      return;
    }
    dispatchWhiteMove("TOGGLE_FULL_GRAPH", {
      enabled: nextEnabled,
      kind: state.ui.fullGraphKind === "garden" ? "garden" : "classical",
    });
    appendAction("toggle_full_graph", {
      enabled: nextEnabled,
      kind: state.ui.fullGraphKind === "garden" ? "garden" : "classical",
    });
  }

  function setFullGraphKind(kind) {
    const nextKind = kind === "garden" ? "garden" : "classical";
    if (state.ui.fullGraphMode && state.ui.fullGraphKind === nextKind) {
      return;
    }
    dispatchWhiteMove("SET_FULL_GRAPH_KIND", { kind: nextKind });
    appendAction("set_full_graph_kind", { kind: nextKind });
  }

  function getGraphRootOsns() {
    return state.orderedOsns.filter(function (osn) {
      const parentIds = Array.isArray(osn.graph && osn.graph.parent_osn_ids)
        ? osn.graph.parent_osn_ids
        : [];
      if (!parentIds.length) {
        return true;
      }
      return parentIds.every(function (parentId) {
        return !state.osnsById.has(parentId);
      });
    });
  }

  function centerFullGraphOnFocus() {
    if (!state.selectedOsnId) {
      return;
    }
    const focusButton = document.getElementById(toDomId("lexiom-osn-node", state.selectedOsnId));
    if (!focusButton || typeof focusButton.scrollIntoView !== "function") {
      return;
    }
    focusButton.scrollIntoView({ block: "center", inline: "nearest" });
  }

  function renderOsngGarden() {
    renderGraphFilters();

    const gardenApi = window.lexiom13OsngGarden;
    if (
      !gardenApi ||
      typeof gardenApi.computeGardenLayout !== "function" ||
      typeof gardenApi.buildGardenSvgHtml !== "function"
    ) {
      els.graph.innerHTML =
        '<div class="lexiom-13-error">Top view (OSNG Garden) module is not available.</div>';
      return;
    }

    if (typeof gardenApi.unbindGardenPanZoom === "function") {
      gardenApi.unbindGardenPanZoom();
    }

    let statusHtml = "";
    if (state.ui.prunePending) {
      statusHtml =
        '<div class="lexiom-13-lens-status" id="lexiom-osn-prune-status">Pruning OSN branch (tombstoning subtree)...</div>';
    } else if (state.ui.pruneError) {
      statusHtml =
        '<div class="lexiom-13-lens-status lexiom-13-error" id="lexiom-osn-prune-status">' +
        escapeHtml(state.ui.pruneError) +
        "</div>";
    }

    const layout = gardenApi.computeGardenLayout({
      osnsById: state.osnsById,
      rootOsns: getGraphRootOsns(),
    });
    const svgHtml = gardenApi.buildGardenSvgHtml(layout, {
      osnsById: state.osnsById,
      selectedOsnId: state.selectedOsnId,
      helpers: {
        getLabel: function (osn) {
          return getOsnOriginLeafLabel(osn);
        },
      },
    });

    els.graph.innerHTML =
      statusHtml +
      '<div class="lexiom-osng-garden-host" id="lexiom-osng-garden-host">' +
      svgHtml +
      "</div>";

    const svg = document.getElementById("lexiom-osng-garden");
    if (svg && typeof gardenApi.bindGardenPanZoom === "function") {
      gardenApi.bindGardenPanZoom(svg);
    }
    if (typeof gardenApi.bindGardenNodeClicks === "function") {
      gardenApi.bindGardenNodeClicks(els.graph, function (osnId) {
        selectOsn(osnId, SUCCESS_EVIDENCES_SECTION_KEY, { expandOnSelect: true });
      });
    }
  }

  function renderFullGraph() {
    renderGraphFilters();

    const focusOsn = getSelectedOsn();
    const ancestorIdSet = getSelectedOsnAncestorIdSet();
    let statusHtml = "";
    if (state.ui.prunePending) {
      statusHtml =
        '<div class="lexiom-13-lens-status" id="lexiom-osn-prune-status">Pruning OSN branch (tombstoning subtree)...</div>';
    } else if (state.ui.pruneError) {
      statusHtml =
        '<div class="lexiom-13-lens-status lexiom-13-error" id="lexiom-osn-prune-status">' +
        escapeHtml(state.ui.pruneError) +
        "</div>";
    }

    const roots = getGraphRootOsns();
    const treeHtml =
      '<div class="lexiom-osn-graph-full-tree" role="tree" aria-label="Full OSN graph">' +
      roots
        .map(function (rootOsn) {
          return renderGraphNode(rootOsn.id, 0, ancestorIdSet, {
            includeChildren: true,
            navigationOnly: true,
          });
        })
        .join("") +
      "</div>";

    els.graph.innerHTML = statusHtml + treeHtml;

    bindSelectionTriggers(els.graph);

    const filteringApi = getOsnFilteringApi();
    if (filteringApi && typeof filteringApi.bindApprovalGlyphNav === "function") {
      filteringApi.bindApprovalGlyphNav(els.graph, function (osnId) {
        // SELECT_OSN clears fullGraphMode so the player returns to Success Evidences.
        selectOsn(osnId, SUCCESS_EVIDENCES_SECTION_KEY, { expandOnSelect: true });
      });
    }

    window.requestAnimationFrame(function () {
      centerFullGraphOnFocus();
    });
  }

  function renderLeftPanelPlaneTitle(plane) {
    if (!els.leftPanelTitle) {
      return;
    }
    const name = plane && plane.name ? plane.name : "Outcome Specifications";
    els.leftPanelTitle.textContent = name;
    if (els.leftPanel) {
      els.leftPanel.setAttribute("aria-label", "OSN graph — " + name);
      const shifted = !!(plane && plane.kind && plane.kind !== "native");
      els.leftPanel.classList.toggle("lexiom-13-plane-shifted", shifted);
    }
  }

  function setActivePlaneForFocus(focusOsnId, planeId) {
    const id = String(focusOsnId || "");
    if (!id) {
      return;
    }
    state.activePlaneByOsnId.set(id, planeId || PLANE_NATIVE_ID);
  }

  function closePlanePicker() {
    state.ui.planePickerOpen = false;
  }

  function openPlanePicker() {
    state.ui.planePickerOpen = true;
    appendAction("plane_picker_opened", {
      osnId: state.selectedOsnId,
      planeId: getResolvedActivePlaneId(getSelectedOsn()),
    });
  }

  function selectPlane(planeId) {
    const focusOsn = getSelectedOsn();
    if (!focusOsn) {
      return;
    }
    const planes = listPlanesForFocus(focusOsn);
    const matched = planes.find(function (plane) {
      return plane.id === planeId;
    });
    if (!matched) {
      return;
    }
    const previousId = getResolvedActivePlaneId(focusOsn);
    state.ui.lockedPlaneId = matched.id;
    setActivePlaneForFocus(focusOsn.id, matched.id);
    closePlanePicker();
    appendAction("plane_selected", {
      osnId: focusOsn.id,
      planeId: matched.id,
      previousPlaneId: previousId,
      kind: matched.kind,
    });
    renderCockpitGraph({ animatePlaneChange: previousId !== matched.id });
  }

  function renderPlanePickerHtml(focusOsn, activePlaneId) {
    const planes = listPlanesForFocus(focusOsn);
    if (planes.length < 2) {
      return "";
    }
    const groupName = "lexiom-plane-" + toDomId("focus", focusOsn && focusOsn.id);
    const items = planes
      .map(function (plane) {
        const isNative = plane.kind === "native";
        const isActive = plane.id === activePlaneId;
        const optionId = toDomId("lexiom-plane-option", plane.id);
        const descId = toDomId("lexiom-plane-desc", plane.id);
        const radioId = toDomId("lexiom-plane-radio", plane.id);
        return (
          '<label class="lexiom-13-plane-picker-item' +
          (isNative ? " is-native" : "") +
          (isActive ? " is-active" : "") +
          '" id="' +
          optionId +
          '" for="' +
          radioId +
          '" data-plane-id="' +
          escapeHtml(plane.id) +
          '">' +
          '<input type="radio" class="lexiom-13-plane-picker-radio" id="' +
          radioId +
          '" name="' +
          escapeHtml(groupName) +
          '" value="' +
          escapeHtml(plane.id) +
          '" data-plane-id="' +
          escapeHtml(plane.id) +
          '"' +
          (isActive ? " checked" : "") +
          ' aria-describedby="' +
          descId +
          '" />' +
          '<span class="lexiom-13-plane-picker-body">' +
          '<span class="lexiom-13-plane-picker-name">' +
          escapeHtml(plane.name) +
          "</span>" +
          '<span class="lexiom-13-plane-picker-desc" id="' +
          descId +
          '">' +
          escapeHtml(plane.description) +
          "</span>" +
          "</span>" +
          "</label>"
        );
      })
      .join("");
    return (
      '<fieldset class="lexiom-13-plane-picker" id="lexiom-plane-picker">' +
      '<legend class="lexiom-13-plane-picker-legend">Thematic plane</legend>' +
      '<div class="lexiom-13-plane-picker-list" role="presentation">' +
      items +
      "</div></fieldset>"
    );
  }

  function renderPlaneShadowControl(focusOsn, activePlaneId) {
    if (!focusOwnsAlternatePlanes(focusOsn)) {
      return "";
    }
    const planes = listPlanesForFocus(focusOsn);
    if (planes.length < 2) {
      return "";
    }
    const expanded = !!state.ui.planePickerOpen;
    return (
      '<div class="lexiom-13-plane-shadow-wrap">' +
      '<button type="button" class="lexiom-13-plane-shadow" id="lexiom-plane-shadow" aria-haspopup="true" aria-expanded="' +
      (expanded ? "true" : "false") +
      '" aria-controls="lexiom-plane-picker" title="Shift thematic plane" aria-label="Shift thematic plane">' +
      '<span class="lexiom-13-plane-shadow-glyph" aria-hidden="true"><span></span><span></span><span></span></span>' +
      "</button>" +
      (expanded ? renderPlanePickerHtml(focusOsn, activePlaneId) : "") +
      "</div>"
    );
  }

  function bindPlaneShiftControls(container) {
    if (!container) {
      return;
    }
    const shadow = container.querySelector("#lexiom-plane-shadow");
    if (shadow) {
      shadow.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        if (state.ui.planePickerOpen) {
          closePlanePicker();
          renderCockpitGraph({ animatePlaneChange: false });
        } else {
          openPlanePicker();
          renderCockpitGraph({ animatePlaneChange: false });
          const picker = document.getElementById("lexiom-plane-picker");
          const active =
            picker &&
            picker.querySelector(".lexiom-13-plane-picker-radio:checked");
          if (active) {
            active.focus();
          }
        }
      });
    }
    const picker = container.querySelector("#lexiom-plane-picker");
    if (picker) {
      picker.addEventListener("click", function (event) {
        event.stopPropagation();
      });
      picker.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          closePlanePicker();
          renderCockpitGraph({ animatePlaneChange: false });
          const shadowBtn = document.getElementById("lexiom-plane-shadow");
          if (shadowBtn) {
            shadowBtn.focus();
          }
        }
      });
    }
    container.querySelectorAll(".lexiom-13-plane-picker-radio").forEach(function (radio) {
      radio.addEventListener("click", function (event) {
        event.stopPropagation();
        const planeId = radio.getAttribute("data-plane-id") || radio.value;
        if (planeId && planeId === getResolvedActivePlaneId(getSelectedOsn())) {
          closePlanePicker();
          renderCockpitGraph({ animatePlaneChange: false });
        }
      });
      radio.addEventListener("change", function (event) {
        event.stopPropagation();
        if (!radio.checked) {
          return;
        }
        const planeId = radio.getAttribute("data-plane-id") || radio.value;
        if (planeId) {
          selectPlane(planeId);
        }
      });
    });
  }

  function renderCockpitGraph(options) {
    renderGraphFilters();

    const animatePlaneChange = !!(options && options.animatePlaneChange);
    const focusOsn = getSelectedOsn();
    reconcileLockedPlaneForFocus(focusOsn);
    const activePlane = getActivePlane(focusOsn);
    const planeId = activePlane ? activePlane.id : PLANE_NATIVE_ID;
    const planeView = getActivePlaneView(focusOsn, planeId);
    renderLeftPanelPlaneTitle(activePlane);

    const ancestorIdSet = getSelectedOsnAncestorIdSet();
    const siblingNavigation = getPlaneSiblingNavigation(focusOsn, activePlane);
    let statusHtml = "";
    if (state.ui.prunePending) {
      statusHtml =
        '<div class="lexiom-13-lens-status" id="lexiom-osn-prune-status">Pruning OSN branch (tombstoning subtree)...</div>';
    } else if (state.ui.pruneError) {
      statusHtml =
        '<div class="lexiom-13-lens-status lexiom-13-error" id="lexiom-osn-prune-status">' +
        escapeHtml(state.ui.pruneError) +
        "</div>";
    }

    const shadowHtml = renderPlaneShadowControl(focusOsn, planeId);
    const shadowHostId = shadowHtml
      ? resolvePlaneShadowHostOsnId(focusOsn, planeView.ancestorOsns, activePlane)
      : null;
    // When shifted off plane zero, keep a detached shadow (return path) that does
    // not companion non-native layout-trunk ancestors.
    const detachedShadowHtml =
      shadowHtml && !shadowHostId
        ? '<div class="lexiom-osn-graph-ancestors has-plane-shadow-only lexiom-13-plane-shadow-detached" role="group" aria-label="Plane controls">' +
          shadowHtml +
          "</div>"
        : "";
    let ancestorsHtml = "";
    if (planeView.ancestorOsns.length) {
      ancestorsHtml =
        '<div class="lexiom-osn-graph-ancestors" role="group" aria-label="Focus OSN plane context">' +
        planeView.ancestorOsns
          .map(function (ancestor) {
            return renderAncestorRow(ancestor, {
              planeShadowHtml:
                shadowHostId && ancestor && ancestor.id === shadowHostId ? shadowHtml : "",
            });
          })
          .join("") +
        "</div>";
    } else if (shadowHtml && shadowHostId === null && !detachedShadowHtml) {
      ancestorsHtml =
        '<div class="lexiom-osn-graph-ancestors has-plane-shadow-only" role="group" aria-label="Plane controls">' +
        shadowHtml +
        "</div>";
    } else {
      ancestorsHtml = '<div class="lexiom-osn-graph-ancestors" aria-hidden="true"></div>';
    }
    const previousSiblingHtml = renderSiblingArrow("previous", siblingNavigation.previous);
    const nextSiblingHtml = renderSiblingArrow("next", siblingNavigation.next);
    const focusHtml = focusOsn
      ? renderGraphNode(focusOsn.id, 0, ancestorIdSet, {
          includeChildren: false,
          siblingArrows: {
            previousHtml: previousSiblingHtml,
            nextHtml: nextSiblingHtml,
          },
        })
      : "";
    const focusZoneHtml =
      '<div class="lexiom-osn-graph-focus-zone" role="group" aria-label="Focus OSN">' +
      focusHtml +
      "</div>";
    const descendantIds =
      planeView.descendantMode === "plane-peers"
        ? Array.isArray(planeView.descendantOrder)
          ? planeView.descendantOrder.slice()
          : Array.from(planeView.descendantIds || [])
        : planeView.descendantMode === "native" && focusOsn
          ? (Array.isArray(focusOsn.graph && focusOsn.graph.child_osn_ids)
              ? focusOsn.graph.child_osn_ids
              : []
            ).filter(function (childId) {
              return planeView.descendantIds.has(childId);
            })
          : [];
    const descendantsHtml =
      '<div class="lexiom-osn-graph-descendants" role="group" aria-label="Focus OSN descendants">' +
      descendantIds
        .map(function (childId) {
          return renderGraphNode(childId, 1, ancestorIdSet, {
            allowedOsnIds: planeView.descendantIds,
          });
        })
        .join("") +
      "</div>";

    const renderKey =
      String(focusOsn && focusOsn.id) + "::" + planeId + "::" + (state.ui.planePickerOpen ? "1" : "0");
    const shouldAnimate =
      animatePlaneChange &&
      lastPlaneRenderKey &&
      lastPlaneRenderKey.split("::")[0] === String(focusOsn && focusOsn.id) &&
      lastPlaneRenderKey.split("::")[1] !== planeId &&
      !prefersReducedMotion();

    function commitGraphHtml() {
      els.graph.innerHTML =
        statusHtml + ancestorsHtml + detachedShadowHtml + focusZoneHtml + descendantsHtml;
      els.graph.classList.toggle("lexiom-13-plane-picker-open", !!state.ui.planePickerOpen);
      lastPlaneRenderKey = renderKey;
      bindSelectionTriggers(els.graph);
      bindPlaneShiftControls(els.graph);
      const filteringApi = getOsnFilteringApi();
      if (filteringApi && typeof filteringApi.bindApprovalGlyphNav === "function") {
        filteringApi.bindApprovalGlyphNav(els.graph, function (osnId) {
          selectOsn(osnId, SUCCESS_EVIDENCES_SECTION_KEY, { expandOnSelect: true });
        });
      }
    }

    if (!shouldAnimate) {
      commitGraphHtml();
      return;
    }

    const ancestorsEl = els.graph.querySelector(".lexiom-osn-graph-ancestors");
    const descendantsEl = els.graph.querySelector(".lexiom-osn-graph-descendants");
    const token = ++planeFadeToken;
    [ancestorsEl, descendantsEl].forEach(function (el) {
      if (el) {
        el.classList.add("lexiom-13-plane-fade-out");
      }
    });
    window.setTimeout(function () {
      if (token !== planeFadeToken) {
        return;
      }
      commitGraphHtml();
      const nextAncestors = els.graph.querySelector(".lexiom-osn-graph-ancestors");
      const nextDescendants = els.graph.querySelector(".lexiom-osn-graph-descendants");
      [nextAncestors, nextDescendants].forEach(function (el) {
        if (el) {
          el.classList.add("lexiom-13-plane-fade-in");
        }
      });
      window.setTimeout(function () {
        if (token !== planeFadeToken) {
          return;
        }
        [nextAncestors, nextDescendants].forEach(function (el) {
          if (el) {
            el.classList.remove("lexiom-13-plane-fade-in");
          }
        });
      }, PLANE_FADE_IN_MS);
    }, PLANE_FADE_OUT_MS);
  }

  function renderGraph() {
    if (state.ui.fullGraphMode) {
      closePlanePicker();
      if (els.leftPanelTitle) {
        els.leftPanelTitle.textContent =
          state.ui.fullGraphKind === "garden"
            ? "Top view"
            : "Outcome Specifications";
      }
      if (els.leftPanel) {
        els.leftPanel.setAttribute(
          "aria-label",
          state.ui.fullGraphKind === "garden"
            ? "Top view"
            : "OSN graph"
        );
        els.leftPanel.classList.remove("lexiom-13-plane-shifted");
      }
      if (state.ui.fullGraphKind === "garden") {
        renderOsngGarden();
      } else {
        renderFullGraph();
      }
      return;
    }
    if (
      window.lexiom13OsngGarden &&
      typeof window.lexiom13OsngGarden.unbindGardenPanZoom === "function"
    ) {
      window.lexiom13OsngGarden.unbindGardenPanZoom();
    }
    renderCockpitGraph();
  }

  function setupGraphResizeObserver() {
    if (!els.graph || typeof ResizeObserver === "undefined" || graphResizeObserver) {
      return;
    }
    lastGraphViewportWidth = els.graph.clientWidth;
    lastGraphViewportHeight = els.graph.clientHeight;
    graphResizeObserver = new ResizeObserver(function (entries) {
      const entry = entries && entries[0];
      const width = entry ? entry.contentRect.width : els.graph.clientWidth;
      const height = entry ? entry.contentRect.height : els.graph.clientHeight;
      if (
        Math.abs(width - lastGraphViewportWidth) < 1 &&
        Math.abs(height - lastGraphViewportHeight) < 1
      ) {
        return;
      }
      lastGraphViewportWidth = width;
      lastGraphViewportHeight = height;
      if (graphResizeFrame !== null) {
        window.cancelAnimationFrame(graphResizeFrame);
      }
      graphResizeFrame = window.requestAnimationFrame(function () {
        graphResizeFrame = null;
        if (!state.error && getSelectedOsn() && !state.ui.fullGraphMode) {
          renderGraph();
        }
      });
    });
    graphResizeObserver.observe(els.graph);
  }

  function createFocusMetaTrigger(osn, metaSectionKey, displayText, ariaLabel) {
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      "lexiom-osn-focus-meta-cell lexiom-osn-focus-meta-trigger" +
      (state.selectedSectionKey === metaSectionKey ? " is-selected" : "");
    button.textContent = displayText;
    button.setAttribute("aria-label", ariaLabel);
    button.title = "Edit in center playfield";
    button.addEventListener("click", function () {
      selectOsn(osn.id, metaSectionKey, { expandOnSelect: false });
    });
    return button;
  }

  function renderFocus(osn) {
    const ownerName =
      osn.owner && osn.owner.display_name ? String(osn.owner.display_name) : "Owner";

    els.focus.innerHTML = "";

    const strip = document.createElement("div");
    strip.className = "lexiom-osn-focus-meta-strip";
    strip.id = "lexiom-osn-focus-meta-strip";

    const ownerPrefix = document.createElement("span");
    ownerPrefix.className = "lexiom-osn-focus-owner-prefix lexiom-13-region-label";
    ownerPrefix.textContent = "Owned by: ";

    const ownerCell = createFocusMetaTrigger(osn, OSN_OWNER_META_KEY, ownerName, "OSN owner name");
    ownerCell.id = "lexiom-osn-focus-owner";
    ownerCell.classList.add("lexiom-13-region-label");

    strip.appendChild(ownerPrefix);
    strip.appendChild(ownerCell);
    els.focus.appendChild(strip);
  }

  function renderSectionStrip(osn) {
    if (!els.sectionStrip) {
      return;
    }
    if (!osn) {
      els.sectionStrip.innerHTML = "";
      return;
    }
    els.sectionStrip.innerHTML = renderSectionGlyphRow(osn);
    bindSelectionTriggers(els.sectionStrip);
  }

  function renderSuccessEvidenceList(evidences) {
    if (!evidences.length) {
      return '<li class="lexiom-13-muted">No success evidences defined.</li>';
    }

    return evidences
      .map(function (evidence) {
        return (
          '<li class="lexiom-evidence-item">' +
          '<div class="lexiom-evidence-title">' + escapeHtml(evidence.kind || evidence.evidence_id || "Evidence") + "</div>" +
          '<div class="lexiom-evidence-body">' + escapeHtml(evidence.inspection_prompt || "") + "</div>" +
          "</li>"
        );
      })
      .join("");
  }

  function renderEvidenceArtifactList(osn) {
    const links = getLinkedEvidencesForOsn(osn);
    if (!links.length) {
      return '<li class="lexiom-13-muted">No demo evidences attached yet.</li>';
    }

    return links
      .map(function (link) {
        const resolved = withResolvedEvidenceLink(link) || link;
        const available = isEvidenceArtifactAvailable(link);
        const approved = isEvidenceApproved(link.origin.osnId, link.evidenceId);
        const isSelected =
          state.selectedEvidenceId === link.evidenceId &&
          state.selectedOsnId === link.origin.osnId &&
          !isCausalNarrativeRevealed(link.origin.osnId, link.evidenceId);
        const statusLine = available
          ? '<div class="lexiom-evidence-artifact-name">' + escapeHtml(resolved.artifactFileName) + "</div>"
          : '<div class="lexiom-evidence-placeholder">Awaiting demo evidence artifact.</div>';

        const approvalControl = renderEvidenceApprovalControl(link, available, approved);

        if (!available) {
          return (
            '<li id="' +
            toDomId("lexiom-evidence-item", link.origin.osnId + "-" + link.evidenceId) +
            '" class="lexiom-evidence-item lexiom-evidence-artifact-item">' +
            '<div class="lexiom-evidence-artifact-body">' +
            '<div class="lexiom-evidence-title">' + escapeHtml(link.kind || link.evidenceId || "Evidence") + "</div>" +
            statusLine +
            "</div>" +
            approvalControl +
            "</li>"
          );
        }

        return (
          '<li id="' +
          toDomId("lexiom-evidence-item", link.origin.osnId + "-" + link.evidenceId) +
          '" class="lexiom-evidence-item lexiom-evidence-artifact-item' +
          (approved ? " is-approved" : "") +
          '">' +
          '<button type="button" id="' +
          toDomId("lexiom-evidence-trigger", link.origin.osnId + "-" + link.evidenceId) +
          '" class="lexiom-evidence-artifact-trigger' +
          (isSelected ? " is-selected" : "") +
          '" data-evidence-id="' +
          escapeHtml(link.evidenceId) +
          '" data-osn-id="' +
          escapeHtml(link.origin.osnId) +
          '" title="Open ' +
          escapeHtml(resolved.artifactFileName) +
          ' in the center playfield">' +
          '<div class="lexiom-evidence-title">' + escapeHtml(link.kind || link.evidenceId || "Evidence") + "</div>" +
          statusLine +
          "</button>" +
          approvalControl +
          "</li>"
        );
      })
      .join("");
  }

  // Approving a success evidence is an explicit human White Move: the OSN owner
  // reviews the delivered artifact and attests the outcome became real as intended.
  function renderEvidenceApprovalControl(link, available, approved) {
    const inputId =
      "lexiom-evidence-approve-" +
      String(link.origin.osnId).replace(/[^a-zA-Z0-9_-]/g, "_") +
      "-" +
      String(link.evidenceId).replace(/[^a-zA-Z0-9_-]/g, "_");
    const disabledAttr = available ? "" : " disabled";
    const checkedAttr = approved ? " checked" : "";
    const hint = available
      ? "Approve this success evidence after reviewing the artifact"
      : "Approval unlocks once a demo evidence artifact is available to review";

    return (
      '<div id="' +
      toDomId("lexiom-evidence-approval-wrap", link.origin.osnId + "-" + link.evidenceId) +
      '" class="lexiom-evidence-approval">' +
      '<input type="checkbox" class="lexiom-evidence-approval-checkbox" id="' +
      inputId +
      '" data-evidence-id="' +
      escapeHtml(link.evidenceId) +
      '" data-osn-id="' +
      escapeHtml(link.origin.osnId) +
      '"' +
      checkedAttr +
      disabledAttr +
      ' title="' +
      escapeHtml(hint) +
      '">' +
      '<label class="lexiom-evidence-approval-label" for="' +
      inputId +
      '">' +
      (approved ? "Approved" : "Approve") +
      "</label>" +
      "</div>"
    );
  }

  function openEvidenceArtifact(osnId, evidenceId) {
    const osn = getOsnById(osnId);
    const api = getEvidenceLinksApi();
    if (!osn || !api) {
      return;
    }
    const link = withResolvedEvidenceLink(api.findLinkedEvidence(osn, evidenceId));
    if (!link || !isEvidenceArtifactAvailable(link)) {
      return;
    }

    state.selectedOsnId = osnId;
    state.selectedEvidenceId = evidenceId;
    state.selectedLensId = null;
    state.causalNarrativeRevealedByEvidenceKey.delete(getCausalEvidenceKey(osnId, evidenceId));
    state.outputSpecChangeRevealedByEvidenceKey.delete(getCausalEvidenceKey(osnId, evidenceId));
    ensureCausalThread(osnId, evidenceId);
    appendAction("open_evidence_artifact", { osnId: osnId, evidenceId: evidenceId });
    renderApp();
  }

  function bindEvidenceTriggers(container) {
    container.querySelectorAll(".lexiom-evidence-artifact-trigger").forEach(function (button) {
      button.addEventListener("click", function () {
        const osnId = button.getAttribute("data-osn-id");
        const evidenceId = button.getAttribute("data-evidence-id");
        if (osnId && evidenceId) {
          openEvidenceArtifact(osnId, evidenceId);
        }
      });
    });
  }

  function toggleEvidenceApproval(osnId, evidenceId, approved) {
    setEvidenceApproval(osnId, evidenceId, approved);
    appendAction("toggle_evidence_approval", {
      osnId: osnId,
      evidenceId: evidenceId,
      approved: approved === true,
    });
    renderApp();
  }

  function bindEvidenceApprovalToggles(container) {
    container.querySelectorAll(".lexiom-evidence-approval-checkbox").forEach(function (checkbox) {
      checkbox.addEventListener("change", function () {
        const osnId = checkbox.getAttribute("data-osn-id");
        const evidenceId = checkbox.getAttribute("data-evidence-id");
        if (osnId && evidenceId) {
          toggleEvidenceApproval(osnId, evidenceId, checkbox.checked);
        }
      });
    });
  }

  async function fetchEvidenceText(url) {
    if (state.evidenceTextCache.has(url)) {
      return state.evidenceTextCache.get(url);
    }
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to load evidence artifact (" + response.status + ")");
    }
    const text = await response.text();
    state.evidenceTextCache.set(url, text);
    return text;
  }

  function isCausalNarrativeRevealed(osnId, evidenceId) {
    return state.causalNarrativeRevealedByEvidenceKey.has(getCausalEvidenceKey(osnId, evidenceId));
  }

  function revealCausalNarrativeInCenter(osnId, evidenceId) {
    const key = getCausalEvidenceKey(osnId, evidenceId);
    const hadAssistant = !!getLatestAssistantEntry(getCausalThread(osnId, evidenceId));
    if (!hadAssistant) {
      return false;
    }
    state.outputSpecChangeRevealedByEvidenceKey.delete(key);
    state.causalNarrativeRevealedByEvidenceKey.add(key);
    appendAction("open_causal_exec_summary_link", {
      osnId: osnId,
      evidenceId: evidenceId,
    });
    renderApp();
    window.requestAnimationFrame(function () {
      focusLineageNarrativeInCenter();
    });
    return true;
  }

  function revealOutputSpecChangeInCenter(osnId, evidenceId) {
    const key = getCausalEvidenceKey(osnId, evidenceId);
    const proposal = getOutputSpecChangeState(osnId, evidenceId);
    if (!proposal || !String(proposal.proposedText || "").trim()) {
      return false;
    }
    state.causalNarrativeRevealedByEvidenceKey.delete(key);
    state.outputSpecChangeRevealedByEvidenceKey.add(key);
    appendAction("open_output_spec_change_link", {
      osnId: osnId,
      evidenceId: evidenceId,
    });
    renderApp();
    window.requestAnimationFrame(function () {
      focusOutputSpecChangeInCenter();
    });
    return true;
  }

  function revealFindingsInCenter(osnId, evidenceId) {
    if (getLatestAskKind(osnId, evidenceId) === "A") {
      return revealOutputSpecChangeInCenter(osnId, evidenceId);
    }
    return revealCausalNarrativeInCenter(osnId, evidenceId);
  }

  function renderLineageNarrativeCard(osn, evidenceId) {
    if (!isCausalNarrativeRevealed(osn.id, evidenceId)) {
      return null;
    }
    const entry = getLatestAssistantEntry(getCausalThread(osn.id, evidenceId));
    const draftCard = getCausalNarrativeDraftCard(entry);
    if (!draftCard) {
      return null;
    }

    const wrapper = document.createElement("div");
    wrapper.className =
      "lexiom-draft-card lexiom-13-draft-host lexiom-lineage-narrative-card" +
      (draftCard && draftCard.approved ? " is-approved" : "");
    wrapper.id = "lexiom-lineage-narrative-card";

    const header = document.createElement("div");
    header.className = "lexiom-draft-card-header";
    header.id = "lexiom-lineage-narrative-header";

    const labelSpan = document.createElement("span");
    labelSpan.className = "lexiom-draft-card-label";
    labelSpan.id = "lexiom-lineage-narrative-label";
    labelSpan.textContent = "Lineage narrative";

    const glyphBtn = document.createElement("button");
    glyphBtn.type = "button";
    glyphBtn.className = "lexiom-draft-card-glyph";
    glyphBtn.id = "lexiom-lineage-narrative-glyph";
    const canToggle = !!(draftCard && String(draftCard.text || "").trim());
    glyphBtn.textContent = draftCard ? getGlyphForCard(draftCard) : "●";
    glyphBtn.title = draftCard && draftCard.approved
      ? "Approved — click to unapprove"
      : canToggle
        ? "Click to approve"
        : "Lineage narrative must have text before approval";
    if (draftCard && draftCard.approved) {
      glyphBtn.classList.add("lexiom-draft-card-glyph-approved");
    }
    if (!canToggle) {
      glyphBtn.disabled = true;
      glyphBtn.classList.add("is-disabled");
    }
    glyphBtn.addEventListener("click", function () {
      toggleCausalNarrativeApproval(osn.id, evidenceId);
    });

    header.appendChild(labelSpan);
    header.appendChild(glyphBtn);

    const textarea = document.createElement("textarea");
    textarea.className = "lexiom-draft-card-text lexiom-lineage-narrative-text";
    textarea.id = "lexiom-lineage-narrative-text";
    textarea.rows = 8;
    textarea.value = String(draftCard.text || "");
    textarea.readOnly = false;
    textarea.setAttribute("aria-label", "Lineage narrative draft");

    textarea.addEventListener("input", function () {
      if (textarea.readOnly) {
        return;
      }
      updateCausalExpositionText(osn.id, evidenceId, textarea.value);
      syncDraftCardEditor(textarea);
    });

    wrapper.appendChild(header);
    wrapper.appendChild(mountDraftCardEditor(textarea));
    syncDraftCardEditor(textarea);
    return wrapper;
  }

  function updateOutputSpecChangeText(osnId, evidenceId, nextText) {
    const proposal = getOutputSpecChangeState(osnId, evidenceId);
    if (!proposal) {
      return;
    }
    const previous = String(proposal.proposedText || "");
    const next = String(nextText || "");
    if (previous === next) {
      return;
    }
    proposal.proposedText = next;
    proposal.hasUserEdits = true;
    if (proposal.approved) {
      proposal.approved = false;
    }
    appendAction("edit_output_spec_change_proposal", {
      osnId: osnId,
      evidenceId: evidenceId,
    });
    refreshOutputSpecChangeGlyph(osnId, evidenceId);
  }

  function refreshOutputSpecChangeGlyph(osnId, evidenceId) {
    const proposal = getOutputSpecChangeState(osnId, evidenceId);
    const glyphBtn = document.getElementById("lexiom-output-spec-change-glyph");
    const wrapper = document.getElementById("lexiom-output-spec-change-card");
    if (!proposal || !glyphBtn || !wrapper) {
      return;
    }
    const draftCard = {
      text: proposal.proposedText,
      approved: proposal.approved,
      hasLmDraft: proposal.hasLmDraft,
      hasUserEdits: proposal.hasUserEdits,
    };
    const allowed = String(proposal.proposedText || "").trim().length > 0;
    const approved = !!proposal.approved;
    glyphBtn.textContent = getGlyphForCard(draftCard);
    glyphBtn.classList.toggle("lexiom-draft-card-glyph-approved", approved);
    glyphBtn.disabled = !allowed;
    glyphBtn.classList.toggle("is-disabled", !allowed);
    wrapper.classList.toggle("is-approved", approved);
    glyphBtn.title = approved
      ? "Approved into Focus OSN Output Spec draft — click to unapprove"
      : allowed
        ? "Click to apply as Focus OSN Output Spec draft"
        : "Proposed output_spec must have text before approval";
  }

  function toggleOutputSpecChangeApproval(osnId, evidenceId) {
    const proposal = getOutputSpecChangeState(osnId, evidenceId);
    if (!proposal || !String(proposal.proposedText || "").trim()) {
      return;
    }
    const osn = getOsnById(osnId);
    if (osn) {
      ensureDraftCardState(osn, "output_spec");
    }
    const nextApproved = !proposal.approved;
    dispatchWhiteMove("TOGGLE_OUTPUT_SPEC_CHANGE_APPROVAL", {
      osnId: osnId,
      evidenceId: evidenceId,
    });
    appendAction("toggle_output_spec_change_approval", {
      osnId: osnId,
      evidenceId: evidenceId,
      approved: nextApproved,
    });
  }

  function renderOutputSpecChangeCard(osn, evidenceId) {
    if (!isOutputSpecChangeRevealed(osn.id, evidenceId)) {
      return null;
    }
    const proposal = getOutputSpecChangeState(osn.id, evidenceId);
    if (!proposal || !String(proposal.proposedText || "").trim()) {
      return null;
    }

    const draftCard = {
      text: proposal.proposedText,
      approved: proposal.approved,
      hasLmDraft: proposal.hasLmDraft,
      hasUserEdits: proposal.hasUserEdits,
    };

    const wrapper = document.createElement("div");
    wrapper.className =
      "lexiom-draft-card lexiom-13-draft-host lexiom-lineage-narrative-card lexiom-output-spec-change-card" +
      (draftCard.approved ? " is-approved" : "");
    wrapper.id = "lexiom-output-spec-change-card";

    const header = document.createElement("div");
    header.className = "lexiom-draft-card-header";
    header.id = "lexiom-output-spec-change-header";

    const labelSpan = document.createElement("span");
    labelSpan.className = "lexiom-draft-card-label";
    labelSpan.id = "lexiom-output-spec-change-label";
    labelSpan.textContent = "Proposed Output Spec";

    const glyphBtn = document.createElement("button");
    glyphBtn.type = "button";
    glyphBtn.className = "lexiom-draft-card-glyph";
    glyphBtn.id = "lexiom-output-spec-change-glyph";
    const canToggle = !!String(draftCard.text || "").trim();
    glyphBtn.textContent = getGlyphForCard(draftCard);
    glyphBtn.title = draftCard.approved
      ? "Approved into Focus OSN Output Spec draft — click to unapprove"
      : canToggle
        ? "Click to apply as Focus OSN Output Spec draft"
        : "Proposed output_spec must have text before approval";
    if (draftCard.approved) {
      glyphBtn.classList.add("lexiom-draft-card-glyph-approved");
    }
    if (!canToggle) {
      glyphBtn.disabled = true;
      glyphBtn.classList.add("is-disabled");
    }
    glyphBtn.addEventListener("click", function () {
      toggleOutputSpecChangeApproval(osn.id, evidenceId);
    });

    header.appendChild(labelSpan);
    header.appendChild(glyphBtn);

    const textarea = document.createElement("textarea");
    textarea.className = "lexiom-draft-card-text lexiom-lineage-narrative-text lexiom-output-spec-change-text";
    textarea.id = "lexiom-output-spec-change-text";
    textarea.rows = 8;
    textarea.value = String(draftCard.text || "");
    textarea.readOnly = false;
    textarea.setAttribute("aria-label", "Proposed Output Spec draft");

    textarea.addEventListener("input", function () {
      if (textarea.readOnly) {
        return;
      }
      updateOutputSpecChangeText(osn.id, evidenceId, textarea.value);
      syncDraftCardEditor(textarea);
    });

    wrapper.appendChild(header);
    wrapper.appendChild(mountDraftCardEditor(textarea));
    syncDraftCardEditor(textarea);
    return wrapper;
  }

  function renderEvidenceViewerContent(osn, link, hostEl) {
    const mount = hostEl || els.card;
    const viewer = document.createElement("div");
    viewer.id = "lexiom-evidence-viewer";
    viewer.className = "lexiom-evidence-viewer lexiom-13-draft-host";
    viewer.innerHTML =
      '<div class="lexiom-evidence-viewer-body" id="lexiom-evidence-viewer-body">' +
      '<div class="lexiom-loading-indicator">Loading evidence artifact...</div>' +
      "</div>";
    mount.appendChild(viewer);

    const body = document.getElementById("lexiom-evidence-viewer-body");
    if (!body) {
      return;
    }

    if (link.mediaType === "image") {
      body.innerHTML =
        '<figure class="lexiom-evidence-viewer-media">' +
        '<img class="lexiom-evidence-viewer-image" src="' +
        escapeHtml(link.artifactUrl) +
        '" alt="' +
        escapeHtml(link.artifactFileName) +
        '">' +
        "</figure>";
      return;
    }

    if (link.mediaType === "video") {
      body.innerHTML =
        '<figure class="lexiom-evidence-viewer-media">' +
        '<video class="lexiom-evidence-viewer-video" controls playsinline src="' +
        escapeHtml(link.artifactUrl) +
        '"></video>' +
        "</figure>";
      return;
    }

    fetchEvidenceText(link.artifactUrl)
      .then(function (text) {
        const preClass =
          link.mediaType === "code"
            ? "lexiom-evidence-viewer-code"
            : "lexiom-evidence-viewer-text";
        body.innerHTML =
          '<pre class="' + preClass + '"><code>' + escapeHtml(text) + "</code></pre>";
      })
      .catch(function (error) {
        body.innerHTML =
          '<div class="lexiom-13-error">' +
          escapeHtml(error && error.message ? error.message : String(error)) +
          "</div>";
      });
  }

  function renderEvidenceViewer(osn, link) {
    els.card.innerHTML = "";
    const stack = document.createElement("div");
    stack.className = "lexiom-evidence-center-stack";
    stack.id = "lexiom-evidence-center-stack";

    if (isOutputSpecChangeRevealed(osn.id, state.selectedEvidenceId)) {
      const changeCard = renderOutputSpecChangeCard(osn, state.selectedEvidenceId);
      if (changeCard) {
        changeCard.classList.add("lexiom-lineage-narrative-card-solo");
        stack.appendChild(changeCard);
      }
      els.card.appendChild(stack);
      return;
    }

    if (isCausalNarrativeRevealed(osn.id, state.selectedEvidenceId)) {
      const narrativeCard = renderLineageNarrativeCard(osn, state.selectedEvidenceId);
      if (narrativeCard) {
        narrativeCard.classList.add("lexiom-lineage-narrative-card-solo");
        stack.appendChild(narrativeCard);
      }
      els.card.appendChild(stack);
      return;
    }

    const viewerHost = document.createElement("div");
    viewerHost.className = "lexiom-evidence-viewer-host lexiom-readonly-surface";
    viewerHost.id = "lexiom-evidence-viewer-host";
    viewerHost.innerHTML =
      '<div class="lexiom-readonly-banner">' +
      '<span class="lexiom-readonly-lock" aria-hidden="true">' +
      '<svg viewBox="0 0 16 16" width="12" height="12" focusable="false">' +
      '<rect x="3.5" y="7" width="9" height="7" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.35"/>' +
      '<path fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" d="M5.2 7V5.4a2.8 2.8 0 0 1 5.6 0V7"/>' +
      "</svg></span>" +
      '<span class="lexiom-readonly-banner-label">Read-only evidence</span>' +
      "</div>";
    stack.appendChild(viewerHost);
    els.card.appendChild(stack);

    renderEvidenceViewerContent(osn, link, viewerHost);
  }

  /**
   * Center playfield fade (Focus OSN scroll, section-key expositions, and draft
   * presentation-mode flips): outgoing content is snapshotted into an overlay
   * that fades into the playfield background, then the incoming content fades
   * into being. Durations must stay in sync with styles.css (and any inline
   * overrides below).
   *
   * LCD = Lexiom's Canonical Duration — the baseline center-fade period used for
   * Focus scroll and for editing → ready (approve) presentation flips.
   * Ready → editing uses half LCD; section-key exposition swaps use 3/4 LCD.
   * Bud open inserts a 2-LCD rain-only hold between fade-out and fade-in.
   */
  const LCD_FADE_OUT_MS = 1500;
  const LCD_FADE_IN_MS = 3000;
  /** One LCD beat (fade-out baseline); Bud rain-only hold uses 2 × this. */
  const LCD_MS = LCD_FADE_OUT_MS;
  const BUD_OPEN_RAIN_HOLD_LCDs = 2;
  let centerFadeState = null;
  let lastCenterPlayfieldOsnId = null;
  /** @type {{ osnId: string, sectionKey: string, approved: boolean } | null} */
  let lastCenterDraftPresentation = null;

  function rememberCenterDraftPresentation(osn) {
    if (!osn || getSelectedEvidenceLink(osn)) {
      lastCenterDraftPresentation = null;
      return;
    }
    const card = ensureDraftCardState(osn, state.selectedSectionKey);
    lastCenterDraftPresentation = {
      osnId: osn.id,
      sectionKey: state.selectedSectionKey,
      approved: !!(card && card.approved),
    };
  }

  function shouldFadeDraftPresentation(osn) {
    if (!osn || !lastCenterDraftPresentation || getSelectedEvidenceLink(osn)) {
      return false;
    }
    const card = ensureDraftCardState(osn, state.selectedSectionKey);
    if (!card) {
      return false;
    }
    return (
      lastCenterDraftPresentation.osnId === osn.id &&
      lastCenterDraftPresentation.sectionKey === state.selectedSectionKey &&
      lastCenterDraftPresentation.approved !== !!card.approved
    );
  }

  /** Same-Focus section glyph / key change (e.g. seed → thematic_lenses). */
  function shouldFadeSectionExposition(osn) {
    if (!osn || !lastCenterDraftPresentation) {
      return false;
    }
    return (
      lastCenterDraftPresentation.osnId === osn.id &&
      lastCenterDraftPresentation.sectionKey !== state.selectedSectionKey
    );
  }

  /**
   * Fade the center card when bluish (approved) ↔ pale-purple (editing) flips
   * without a full remount — used on the first keystroke that auto-revokes approval.
   * Ready → editing is half of Lexiom's Canonical Duration (LCD).
   */
  function fadeDraftPresentationInPlace(osn, previousCard) {
    if (!previousCard) {
      return;
    }
    beginCenterFade(previousCard, {
      durationScale: 0.5,
      fadeKind: "presentation",
    });
    rememberCenterDraftPresentation(osn);
  }

  function cancelCenterFade() {
    if (window.lexiom13DadaEngine && typeof window.lexiom13DadaEngine.stopDroppingText === "function") {
      window.lexiom13DadaEngine.stopDroppingText();
    }
    if (window.lexiom13DadaEngine && typeof window.lexiom13DadaEngine.stopOutlineBreath === "function") {
      window.lexiom13DadaEngine.stopOutlineBreath();
    }
    if (centerFadeState) {
      if (centerFadeState.timeoutId) {
        window.clearTimeout(centerFadeState.timeoutId);
      }
      if (centerFadeState.overlay && centerFadeState.overlay.parentNode) {
        centerFadeState.overlay.parentNode.removeChild(centerFadeState.overlay);
      }
      centerFadeState = null;
    }
    if (els.card) {
      els.card.classList.remove("is-center-fade-hidden", "is-center-fading-in");
      els.card.style.transitionDuration = "";
    }
  }

  /**
   * innerHTML does not serialize live form-field values (textarea.value is a
   * DOM property), so snapshot the card by cloning it and copying each field's
   * live value into the clone.
   */
  function snapshotCardForFade() {
    if (!els.card) {
      return null;
    }
    const clone = els.card.cloneNode(true);
    clone.removeAttribute("id");
    const liveFields = els.card.querySelectorAll("textarea, input");
    const cloneFields = clone.querySelectorAll("textarea, input");
    liveFields.forEach(function (field, index) {
      const cloned = cloneFields[index];
      if (!cloned) {
        return;
      }
      if (field.tagName === "TEXTAREA") {
        cloned.textContent = field.value;
      } else {
        cloned.setAttribute("value", field.value);
      }
    });
    return clone;
  }

  function beginCenterFade(previousCard, options) {
    const activity = document.getElementById("lexiom-center-activity");
    if (!activity || !els.card) {
      return;
    }
    cancelCenterFade();

    // durationScale: 1 = full LCD; 0.75 = section-key swap; 0.5 = ready→editing.
    const durationScale =
      options && typeof options.durationScale === "number" ? options.durationScale : 1;
    const fadeOutMs = LCD_FADE_OUT_MS * durationScale;
    const fadeInMs = LCD_FADE_IN_MS * durationScale;
    const fadeKind = options && options.fadeKind ? options.fadeKind : "other";
    // Bud open: 2-LCD rain-only gap after fade-out so rain is visible without center text.
    const fadeHoldMs =
      fadeKind === "bud_open" ? BUD_OPEN_RAIN_HOLD_LCDs * LCD_MS : 0;

    const overlay = document.createElement("div");
    overlay.className = "lexiom-center-fade-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.style.transitionDuration = fadeOutMs / 1000 + "s";
    overlay.appendChild(previousCard);
    activity.appendChild(overlay);
    els.card.classList.add("is-center-fade-hidden");
    els.card.style.transitionDuration = fadeInMs / 1000 + "s";
    centerFadeState = { overlay: overlay, timeoutId: null };

    // Force a style/layout flush so the browser commits the overlay's initial
    // opacity:1 before the fading class lands; otherwise the first computed
    // style already includes opacity:0 and the transition never starts (a
    // single rAF runs before the frame's style step, so it cannot ensure this).
    void overlay.offsetWidth;
    overlay.classList.add("is-fading");

    // DaDa look-and-feel only: rainy season if the Weatherman allows it;
    // outline breath on Focus OSN transitions.
    if (window.lexiom13DadaEngine) {
      var dadaCtx = {
        cue: "center_fade",
        fadeKind: fadeKind,
        durationScale: durationScale,
        fadeOutMs: fadeOutMs,
        fadeInMs: fadeInMs,
        fadeHoldMs: fadeHoldMs,
      };
      if (
        typeof window.lexiom13DadaEngine.proposeDroppingText === "function" &&
        typeof window.lexiom13DadaEngine.mountDroppingText === "function"
      ) {
        var dadaInstr = window.lexiom13DadaEngine.proposeDroppingText(dadaCtx);
        if (dadaInstr) {
          window.lexiom13DadaEngine.mountDroppingText(activity, dadaInstr);
        }
      }
      if (
        typeof window.lexiom13DadaEngine.proposeOutlineBreath === "function" &&
        typeof window.lexiom13DadaEngine.mountOutlineBreath === "function"
      ) {
        var breathInstr = window.lexiom13DadaEngine.proposeOutlineBreath(dadaCtx);
        var playfield = document.getElementById("lexiom-center-playfield");
        if (breathInstr && playfield) {
          window.lexiom13DadaEngine.mountOutlineBreath(playfield, breathInstr);
        }
      }
    }

    function finishCenterFade() {
      els.card.classList.remove("is-center-fading-in");
      els.card.style.transitionDuration = "";
      centerFadeState = null;
      // Rain may outlast the fade envelope on bud_open (Weatherman 2× season);
      // its own stop timeout clears the canvas. Interrupt paths use cancelCenterFade.
      if (
        window.lexiom13DadaEngine &&
        typeof window.lexiom13DadaEngine.stopOutlineBreath === "function"
      ) {
        window.lexiom13DadaEngine.stopOutlineBreath();
      }
    }

    function startFadeIn() {
      if (!centerFadeState) {
        return;
      }
      els.card.classList.add("is-center-fading-in");
      window.requestAnimationFrame(function () {
        els.card.classList.remove("is-center-fade-hidden");
      });
      centerFadeState.timeoutId = window.setTimeout(finishCenterFade, fadeInMs);
    }

    centerFadeState.timeoutId = window.setTimeout(function () {
      if (!centerFadeState) {
        return;
      }
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      centerFadeState.overlay = null;
      // Keep #lexiom-osn-card at opacity 0 during the rain-only hold (no center text).
      if (fadeHoldMs > 0) {
        centerFadeState.timeoutId = window.setTimeout(startFadeIn, fadeHoldMs);
      } else {
        startFadeIn();
      }
    }, fadeOutMs);
  }

  function renderCenterPlayfield(osn) {
    const previousOsnId = lastCenterPlayfieldOsnId;
    lastCenterPlayfieldOsnId = osn.id;
    const focusScrolled = previousOsnId !== null && previousOsnId !== osn.id;
    const sectionChanged = !focusScrolled && shouldFadeSectionExposition(osn);
    const presentationChanged =
      !focusScrolled && !sectionChanged && shouldFadeDraftPresentation(osn);
    // Ready→editing: 1/2 LCD; section-key expositions: 3/4 LCD; else full LCD.
    const readyToEditing =
      presentationChanged &&
      lastCenterDraftPresentation &&
      lastCenterDraftPresentation.approved === true;
    const previousCard =
      focusScrolled || sectionChanged || presentationChanged
        ? snapshotCardForFade()
        : null;

    const evidenceLink = getSelectedEvidenceLink(osn);
    if (evidenceLink) {
      renderEvidenceViewer(osn, evidenceLink);
    } else {
      if (state.selectedSectionKey === BUD_SECTION_KEY && !hasOpenableBud(osn)) {
        state.selectedSectionKey = DEFAULT_SELECTED_SECTION_KEY;
      }
      renderDraftCard(osn);
    }

    if (previousCard !== null) {
      let durationScale = 1;
      let fadeKind = "other";
      if (focusScrolled) {
        fadeKind = "osn_transition";
      } else if (readyToEditing) {
        durationScale = 0.5;
        fadeKind = "presentation";
      } else if (sectionChanged) {
        durationScale = 0.75;
        // Weatherman: rain only when opening Bud to watch the SUD.
        fadeKind =
          state.selectedSectionKey === BUD_SECTION_KEY ? "bud_open" : "section";
      } else if (presentationChanged) {
        fadeKind = "presentation";
      }
      beginCenterFade(previousCard, {
        durationScale: durationScale,
        fadeKind: fadeKind,
      });
    }
    rememberCenterDraftPresentation(osn);
  }

  function collectDescendantOsns(osn, seen, results) {
    if (!osn || seen.has(osn.id)) {
      return;
    }
    seen.add(osn.id);
    results.push(osn);

    const childIds = Array.isArray(osn.graph && osn.graph.child_osn_ids) ? osn.graph.child_osn_ids : [];
    childIds.forEach(function (childId) {
      collectDescendantOsns(getOsnById(childId), seen, results);
    });
  }

  function collectCompilationOsns(rootOsn) {
    const scope = rootOsn && rootOsn.compilation ? rootOsn.compilation.compilation_scope : "self_only";
    const results = [];
    const seen = new Set();

    if (!rootOsn) {
      return results;
    }

    if (scope === "self_and_approved_descendants") {
      collectDescendantOsns(rootOsn, seen, results);
      return results;
    }

    if (scope === "self_plus_parent_context") {
      const parentIds = Array.isArray(rootOsn.graph && rootOsn.graph.parent_osn_ids) ? rootOsn.graph.parent_osn_ids : [];
      parentIds.forEach(function (parentId) {
        const parent = getOsnById(parentId);
        if (parent && !seen.has(parent.id)) {
          seen.add(parent.id);
          results.push(parent);
        }
      });
      if (!seen.has(rootOsn.id)) {
        seen.add(rootOsn.id);
        results.push(rootOsn);
      }
      return results;
    }

    return [rootOsn];
  }

  function buildCompilationPreviewText(rootOsn) {
    const includedOsns = collectCompilationOsns(rootOsn);
    const scope = rootOsn && rootOsn.compilation ? rootOsn.compilation.compilation_scope : "self_only";
    const targetProfile = rootOsn && rootOsn.compilation ? rootOsn.compilation.target_tool_profile : "";
    const lines = [];

    lines.push("Compilation Root");
    lines.push(getOsnOriginLeafLabel(rootOsn));
    lines.push("");
    lines.push("Scope");
    lines.push(scope);
    lines.push("");
    lines.push("Target Tool Profile");
    lines.push(targetProfile || "unspecified");
    lines.push("");
    lines.push("Included Semantic Sources");
    lines.push("");

    includedOsns.forEach(function (osn) {
      lines.push("- " + getOsnOriginLeafLabel(osn));
      OSN_SECTION_DEFS.forEach(function (section) {
        const card = ensureDraftCardState(osn, section.key);
        const sectionText = card && card.text ? String(card.text).trim() : "";
        const status = card && card.approved ? "approved" : "draft";
        lines.push("  " + section.label + " [" + status + "]");
        if (sectionText) {
          lines.push("  " + sectionText.split(/\r?\n/).join("\n  "));
        } else {
          lines.push("  (empty)");
        }
        const approvedLensLines = [];
        const lenses = Array.isArray(osn.thematic_lenses) ? osn.thematic_lenses : [];
        lenses.forEach(function (lens) {
          const lensDraft = getLensDraftState(osn.id, section.key, lens.lens_id);
          if (lensDraft && lensDraft.approved && String(lensDraft.text || "").trim()) {
            approvedLensLines.push(
              "    [approved lens: " + String(lens.name || lens.lens_id) + "] " +
              String(lensDraft.text).trim().split(/\r?\n/).join("\n    ")
            );
          }
        });
        if (approvedLensLines.length) {
          lines.push("  Supplemental approved lens context:");
          approvedLensLines.forEach(function (line) {
            lines.push(line);
          });
        }
        lines.push("");
      });
    });

    return lines.join("\n").trim();
  }

  function mirrorCaSessionToOpfs(caSession) {
    if (!caSession || !caSession.workspace_manifest_url) {
      return Promise.resolve(null);
    }
    if (!navigator.storage || !navigator.storage.getDirectory) {
      return Promise.resolve({ skipped: true, reason: "opfs_unavailable" });
    }
    const heartbeatUrl = caSession.heartbeat_url;
    const capabilityHeaders = caSession.capability_token
      ? { "X-GT3-CA-Capability": caSession.capability_token }
      : {};
    let heartbeatTimer = null;
    if (heartbeatUrl) {
      heartbeatTimer = setInterval(function () {
        fetch(heartbeatUrl, {
          method: "POST",
          cache: "no-store",
          headers: capabilityHeaders,
        }).catch(
          function () {}
        );
      }, 30000);
    }
    return fetch(caSession.workspace_manifest_url, {
      cache: "no-store",
      headers: capabilityHeaders,
    })
      .then(function (response) {
        return response.json().then(function (payload) {
          return { ok: response.ok, payload: payload };
        });
      })
      .then(function (result) {
        if (!result.ok) {
          throw new Error(
              (result.payload && result.payload.detail) ||
              CA_DISPLAY_LABEL + " session workspace mirror failed"
          );
        }
        const files = (result.payload && result.payload.files) || [];
        const runId =
          (result.payload &&
            result.payload.files &&
            caSession.session_id) ||
          caSession.session_id;
        return navigator.storage.getDirectory().then(function (root) {
          return root.getDirectoryHandle("lexiom13-ca-sessions", {
            create: true,
          }).then(function (sessionsDir) {
            return sessionsDir.getDirectoryHandle(String(runId), {
              create: true,
            });
          });
        }).then(function (sessionDir) {
          let chain = Promise.resolve();
          files.forEach(function (file) {
            if (!file || !file.path || file.content == null) return;
            chain = chain.then(function () {
              return sessionDir
                .getFileHandle(String(file.path), { create: true })
                .then(function (fh) {
                  return fh.createWritable();
                })
                .then(function (writable) {
                  return writable
                    .write(String(file.content))
                    .then(function () {
                      return writable.close();
                    });
                });
            });
          });
          return chain.then(function () {
            return {
              session_id: caSession.session_id,
              ca_location: caSession.ca_location || "browser_session",
              mirrored_files: files.length,
              heartbeatTimer: heartbeatTimer,
            };
          });
        });
      })
      .catch(function (error) {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        console.warn("lexiom13_ca_opfs_mirror", error);
        return {
          skipped: true,
          reason: error && error.message ? error.message : String(error),
          heartbeatTimer: heartbeatTimer,
        };
      });
  }

  function stopCaSessionHeartbeat(mirrorResult) {
    if (mirrorResult && mirrorResult.heartbeatTimer) {
      clearInterval(mirrorResult.heartbeatTimer);
    }
  }

  function cockpitOpenRouterKeyHeaders() {
    const headers = {};
    try {
      const key =
        (window.lexiomGT3 && typeof window.lexiomGT3.getApiKey === "function"
          ? window.lexiomGT3.getApiKey()
          : "") ||
        (typeof localStorage !== "undefined"
          ? localStorage.getItem("lexiom_gt3_api_key") || ""
          : "");
      if (key && String(key).trim()) {
        headers["X-GT3-OpenRouter-Key"] = String(key).trim();
      }
    } catch (_error) {
      // ignore
    }
    return headers;
  }

  function runBoltWebContainerCaSession(caSession, passHooks) {
    if (!caSession || !caSession.session_id) {
      return Promise.resolve(null);
    }
    return import("./ca/serveRamUnderGt3.js").then(function (mod) {
      if (!mod || typeof mod.runBoltWebContainerCa !== "function") {
        throw new Error("serveRamUnderGt3 module missing runBoltWebContainerCa");
      }
      return mod.runBoltWebContainerCa(caSession, {
        onLog: function (line) {
          appendAction("ca_log", { line: String(line).slice(0, 240) });
        },
        onPassChange: passHooks && passHooks.onPassChange,
      });
    });
  }

  function formatBuildHandoffCardText(handoff, runResult) {
    const lines = [];
    lines.push("Build plugin handoff");
    lines.push("");
    lines.push("Plugin: " + (handoff.plugin_id || "(none)"));
    lines.push("Strategy: " + (handoff.strategy_id || "(none)"));
    lines.push("Root: " + (handoff.compilation_root_osn_id || "(none)"));
    lines.push("Profile: " + (handoff.target_tool_profile || "(none)"));
    lines.push("Scope: " + (handoff.compilation_scope || "(none)"));
    lines.push("Run id: " + (handoff.run_id || "(none)"));
    lines.push("Output directory: " + (handoff.output_directory || "(none)"));
    if (handoff.nodes_dir) {
      lines.push("Prepared nodes: ./" + handoff.nodes_dir + "/");
    } else if (handoff.snapshot_mode) {
      lines.push("OSNG snapshot: ./" + (handoff.osng_dir || "osng") + "/");
    }
    lines.push("");
    lines.push("Subgraph (" + (handoff.subgraph ? handoff.subgraph.length : 0) + " OSNs)");
    (handoff.subgraph || []).forEach(function (node) {
      lines.push("- " + node.id);
    });
    lines.push("");
    if (handoff.walk_plan && Array.isArray(handoff.walk_plan.passes)) {
      lines.push("Walk plan");
      handoff.walk_plan.passes.forEach(function (pass) {
        lines.push(
          "Pass " +
            pass.pass +
            " (" +
            pass.name +
            "): " +
            (pass.osn_ids || []).join(", ")
        );
      });
      lines.push("");
    }
    if (runResult) {
      lines.push("Run status: " + (runResult.status || "(unknown)"));
      if (runResult.executor) {
        lines.push("Executor: " + runResult.executor);
      }
      if (runResult.ca_location) {
        lines.push(CA_DISPLAY_LABEL + " location: " + runResult.ca_location);
      }
      if (runResult.session_id) {
        lines.push(CA_DISPLAY_LABEL + " session: " + runResult.session_id);
      }
      if (runResult.detail) {
        lines.push("Detail: " + runResult.detail);
      }
      if (runResult.agent) {
        lines.push(
          "Agent: " +
            (runResult.agent.launched
              ? "launched (" + (runResult.agent.status || "ok") + ")"
              : "not launched — " +
                  (runResult.agent.reason || runResult.reason || "unknown"))
        );
      }
      if (Array.isArray(runResult.primary_artifacts) && runResult.primary_artifacts.length) {
        lines.push("Artifacts: " + runResult.primary_artifacts.join(", "));
      }
      if (runResult.status === "running") {
        lines.push("");
        if (runResult.pass === "evidence") {
          lines.push(
            "Evidence collection is running (" +
              CA_DISPLAY_LABEL +
              " bolt_webcontainer — collecting OSNG success evidences). This card will refresh when RUN_RESULT updates."
          );
        } else {
          lines.push(
            "Builder is running (" +
              CA_DISPLAY_LABEL +
              " bolt_webcontainer — WebContainer agent in this browser). This card will refresh when RUN_RESULT updates."
          );
        }
      } else if (
        runResult.status === "agent_failed" ||
        runResult.status === "agent_unavailable"
      ) {
        lines.push("");
        lines.push(
          "No stub primary artifacts were written. Fix the detail above and re-run Build."
        );
      } else {
        lines.push("");
        lines.push(
          "This Build card is a handoff/report surface — not the delivered software or document itself."
        );
      }
    } else {
      lines.push("Status: prepared (agent not yet run)");
      lines.push(
        "The build directory and agent documents are ready for inspection. Click the build glyph again to activate the " +
          CA_DISPLAY_LABEL +
          " and trigger VAL."
      );
    }
    return lines.join("\n").trim();
  }

  function applyBuildCardText(osn, text) {
    state.buildPreviewsByOsnId.set(osn.id, text);
    state.selectedOsnId = osn.id;
    state.selectedSectionKey = BUILD_SECTION_KEY;
    state.selectedEvidenceId = null;
    state.selectedLensId = null;

    const buildCard = {
      id: getDraftCardId(osn.id, BUILD_SECTION_KEY),
      osnId: osn.id,
      sectionKey: BUILD_SECTION_KEY,
      text: text,
      approved: false,
      hasLmDraft: true,
      hasUserEdits: false,
    };
    state.draftCardsByOsnId.set(buildCard.id, buildCard);
    state.drafts[buildCard.id] = {
      osnId: osn.id,
      sectionKey: BUILD_SECTION_KEY,
      text: text,
      approved: false,
    };
  }

  function openCompilePreview(osnId) {
    const osn = osnId ? getOsnById(osnId) : getSelectedOsn();
    if (!osn || !canBuildOsn(osn)) {
      return;
    }
    const profile = osn.compilation && osn.compilation.target_tool_profile;
    if (!profile) {
      const previewText = buildCompilationPreviewText(osn);
      applyBuildCardText(osn, previewText);
      appendAction("open_compile_preview", { osnId: osn.id, sectionKey: BUILD_SECTION_KEY });
      renderApp();
      return;
    }
    const lifecycle = getBuildLifecycle(osn.id);
    if (lifecycle && lifecycle.phase === "prepared" && lifecycle.runId) {
      runPreparedBuild(osn.id);
      return;
    }
    prepareBuild(osn.id);
  }

  function prepareBuild(osnId) {
    const osn = getOsnById(osnId);
    if (!osn || !canBuildOsn(osn)) {
      return;
    }
    if (isBuildLifecycleActive(getBuildLifecycle(osn.id))) {
      return;
    }
    if (state.ui.buildPreparePending || state.ui.buildRunPending) {
      return;
    }

    const strategyId = state.buildStrategyByOsnId.get(osn.id) || null;
    setBuildLifecycle(osn.id, {
      phase: "preparing",
      runId: null,
      startedAt: new Date().toISOString(),
      completedAt: null,
      detail: "Preparing compilation worktree.",
    });
    state.ui.buildPreparePending = true;
    state.ui.buildRunPending = false;
    state.ui.buildError = null;
    applyBuildCardText(osn, "Preparing build handoff...");
    appendAction("prepare_build", { osnId: osn.id, strategyId: strategyId });
    renderApp();

    const prepareBody = { compilation_root_osn_id: osn.id };
    if (strategyId) {
      prepareBody.strategy_id = strategyId;
    }

    fetch("/lexiom13/build/prepare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prepareBody),
    })
      .then(function (response) {
        return response.json().then(function (payload) {
          return { ok: response.ok, status: response.status, payload: payload };
        });
      })
      .then(function (result) {
        if (!result.ok) {
          throw new Error(
            (result.payload && result.payload.detail) ||
              "Prepare failed (" + result.status + ")"
          );
        }
        const handoff = result.payload;
        state.buildHandoffsByOsnId.set(osn.id, handoff);
        state.buildStrategyByOsnId.set(osn.id, handoff.strategy_id);
        applyBuildCardText(osn, formatBuildHandoffCardText(handoff, null));
        state.ui.buildPreparePending = false;
        setBuildLifecycle(osn.id, {
          phase: "prepared",
          runId: handoff.run_id,
          completedAt: null,
          detail:
            "Prepared files are ready for inspection. Click the build glyph again to activate VAL.",
        });
        appendAction("build_prepared", {
          osnId: osn.id,
          runId: handoff.run_id,
          pluginId: handoff.plugin_id,
          strategyId: handoff.strategy_id,
        });
        renderApp();
      })
      .catch(function (error) {
        state.ui.buildError = error && error.message ? error.message : String(error);
        setBuildLifecycle(osn.id, {
          phase: "failed",
          completedAt: new Date().toISOString(),
          detail: state.ui.buildError,
        });
        applyBuildCardText(
          osn,
          "Build preparation failed.\n\n" +
            state.ui.buildError +
            "\n\nLocal preview fallback:\n\n" +
            buildCompilationPreviewText(osn)
        );
        appendAction("build_prepare_failed", {
          osnId: osn.id,
          error: state.ui.buildError,
        });
      })
      .finally(function () {
        state.ui.buildPreparePending = false;
        renderApp();
      });
  }

  function runPreparedBuild(osnId) {
    const osn = getOsnById(osnId);
    const lifecycle = getBuildLifecycle(osnId);
    if (
      !osn ||
      !canBuildOsn(osn) ||
      !lifecycle ||
      lifecycle.phase !== "prepared" ||
      !lifecycle.runId ||
      state.ui.buildPreparePending ||
      state.ui.buildRunPending
    ) {
      return;
    }

    const preparedHandoff = state.buildHandoffsByOsnId.get(osn.id) || {
      run_id: lifecycle.runId,
    };
    state.ui.buildRunPending = true;
    state.ui.buildError = null;
    setBuildLifecycle(osn.id, {
      phase: "running",
      runId: lifecycle.runId,
      startedAt: new Date().toISOString(),
      completedAt: null,
      detail: "Activating VAL from the inspected build directory.",
    });
    applyBuildCardText(
      osn,
      formatBuildHandoffCardText(preparedHandoff, {
        status: "running",
        run_id: lifecycle.runId,
        detail: "Activating VAL from the prepared build directory.",
      })
    );
    appendAction("activate_prepared_build", {
      osnId: osn.id,
      runId: lifecycle.runId,
    });
    renderApp();

    fetch("/lexiom13/build/run", {
      method: "POST",
      headers: Object.assign(
        { "Content-Type": "application/json" },
        cockpitOpenRouterKeyHeaders()
      ),
      body: JSON.stringify({
        compilation_root_osn_id: osn.id,
        run_id: lifecycle.runId,
        handoff: { run_id: lifecycle.runId },
      }),
    })
      .then(function (response) {
        return response.json().then(function (payload) {
          return { ok: response.ok, status: response.status, payload: payload };
        });
      })
      .then(function (result) {
        if (!result.ok) {
          throw new Error(
            (result.payload && result.payload.detail) ||
              "Build run failed (" + result.status + ")"
          );
        }
        const runResult = result.payload;
        state.buildRunResultsByOsnId.set(osn.id, runResult);
        syncBuildLifecycleFromRunResult(osn.id, runResult);
        const handoff = runResult.handoff || preparedHandoff;
        state.buildHandoffsByOsnId.set(osn.id, handoff);
        applyBuildCardText(osn, formatBuildHandoffCardText(handoff, runResult));
        appendAction("build_run_started", {
          osnId: osn.id,
          runId: handoff && handoff.run_id,
          status: runResult.status,
          ca_location: runResult.ca_location || "browser_session",
          session_id: runResult.session_id || null,
        });
        renderApp();

        const caSession = runResult.ca_session || null;
        return mirrorCaSessionToOpfs(caSession).then(function (mirrorResult) {
          state.ui.caSessionMirror = mirrorResult;
          if (runResult.status !== "running" || !handoff || !handoff.run_id) {
            stopCaSessionHeartbeat(mirrorResult);
            appendAction("build_run_completed", {
              osnId: osn.id,
              runId: handoff && handoff.run_id,
              status: runResult.status,
              ca_location: runResult.ca_location || "browser_session",
              executor: runResult.executor || "bolt_webcontainer",
            });
            return;
          }
          let activeMirror = mirrorResult;
          const workerPromise = runBoltWebContainerCaSession(caSession, {
            onPassChange: function (pass, session) {
              if (pass !== "evidence" || !session || !session.session_id) {
                return;
              }
              appendAction("ca_evidence_pass_started", {
                osnId: osn.id,
                runId: handoff && handoff.run_id,
                session_id: session.session_id,
                reuse_sandbox: true,
              });
              stopCaSessionHeartbeat(activeMirror);
              mirrorCaSessionToOpfs(session).then(function (evidenceMirror) {
                activeMirror = evidenceMirror;
                state.ui.caSessionMirror = evidenceMirror;
              });
            },
          }).catch(function (err) {
            console.warn("lexiom13_bolt_ca_worker", err);
            appendAction("ca_worker_error", {
              osnId: osn.id,
              error: err && err.message ? err.message : String(err),
            });
            return null;
          });
          return Promise.all([
            workerPromise,
            pollLexiom13BuildStatus(osn, handoff.run_id),
          ]).then(function () {
            stopCaSessionHeartbeat(activeMirror);
            stopCaSessionHeartbeat(mirrorResult);
            appendAction("build_run_completed", {
              osnId: osn.id,
              runId: handoff.run_id,
              status:
                (state.buildRunResultsByOsnId.get(osn.id) &&
                  state.buildRunResultsByOsnId.get(osn.id).status) ||
                "unknown",
              ca_location: "browser_session",
              executor: "bolt_webcontainer",
            });
          });
        });
      })
      .catch(function (error) {
        if (state.ui.caSessionMirror) {
          stopCaSessionHeartbeat(state.ui.caSessionMirror);
        }
        state.ui.buildError = error && error.message ? error.message : String(error);
        setBuildLifecycle(osn.id, {
          phase: "failed",
          completedAt: new Date().toISOString(),
          detail: state.ui.buildError,
        });
        applyBuildCardText(
          osn,
          "VAL activation failed.\n\n" +
            state.ui.buildError +
            "\n\nThe prepared build directory remains available for inspection."
        );
        appendAction("build_failed", { osnId: osn.id, error: state.ui.buildError });
      })
      .finally(function () {
        state.ui.buildRunPending = false;
        renderApp();
      });
  }

  function pollLexiom13BuildStatus(osn, runId) {
    const started = Date.now();
    const maxMs = 21 * 60 * 1000;
    const intervalMs = 4000;

    function once() {
      return fetch("/lexiom13/build/status/" + encodeURIComponent(runId), {
        cache: "no-store",
      })
        .then(function (response) {
          return response.json().then(function (payload) {
            return { ok: response.ok, status: response.status, payload: payload };
          });
        })
        .then(function (result) {
          if (!result.ok) {
            throw new Error(
              (result.payload && result.payload.detail) ||
                "Build status failed (" + result.status + ")"
            );
          }
          const runResult = result.payload;
          state.buildRunResultsByOsnId.set(osn.id, runResult);
          syncBuildLifecycleFromRunResult(osn.id, runResult);
          const handoff =
            runResult.handoff || state.buildHandoffsByOsnId.get(osn.id) || {};
          applyBuildCardText(osn, formatBuildHandoffCardText(handoff, runResult));
          renderApp();

          const st = runResult.status;
          if (st === "running") {
            if (Date.now() - started > maxMs) {
              throw new Error(
                "Timed out waiting for builder RUN_RESULT (status still running)."
              );
            }
            return new Promise(function (resolve) {
              setTimeout(resolve, intervalMs);
            }).then(once);
          }

          if (st === "agent_failed" || st === "agent_unavailable") {
            state.ui.buildError =
              runResult.detail || runResult.reason || st;
            appendAction("build_failed", {
              osnId: osn.id,
              runId: runId,
              status: st,
              detail: state.ui.buildError,
            });
            return runResult;
          }

          appendAction("build_run_completed", {
            osnId: osn.id,
            runId: runId,
            status: st,
          });
          return runResult;
        });
    }

    state.ui.buildRunPending = true;
    return once().finally(function () {
      state.ui.buildRunPending = false;
      renderApp();
    });
  }

  function refreshBuildCardWithoutFocus(osn, runResult) {
    if (!osn || !runResult) return;
    const handoff =
      runResult.handoff || state.buildHandoffsByOsnId.get(osn.id) || {};
    const text = formatBuildHandoffCardText(handoff, runResult);
    state.buildPreviewsByOsnId.set(osn.id, text);
    const cardId = getDraftCardId(osn.id, BUILD_SECTION_KEY);
    const existing = state.draftCardsByOsnId.get(cardId);
    if (existing) {
      existing.text = text;
      existing.hasLmDraft = true;
      state.drafts[cardId] = {
        osnId: osn.id,
        sectionKey: BUILD_SECTION_KEY,
        text: text,
        approved: false,
      };
    }
  }

  function reconnectPersistedBuilds() {
    state.buildLifecycleByOsnId.forEach(function (entry, osnId) {
      if (!isBuildLifecycleActive(entry) || !entry.runId) return;
      const osn = getOsnById(osnId);
      if (!osn) return;

      function check() {
        return fetch(
          "/lexiom13/build/status/" + encodeURIComponent(entry.runId),
          { cache: "no-store" }
        )
          .then(function (response) {
            return response.json().then(function (payload) {
              return { ok: response.ok, payload: payload };
            });
          })
          .then(function (result) {
            if (!result.ok) {
              throw new Error(
                (result.payload && result.payload.detail) ||
                  "Unable to reconnect to build status."
              );
            }
            const runResult = result.payload;
            state.buildRunResultsByOsnId.set(osnId, runResult);
            const lifecycle = syncBuildLifecycleFromRunResult(osnId, runResult);
            refreshBuildCardWithoutFocus(osn, runResult);
            renderApp();
            if (isBuildLifecycleActive(lifecycle)) {
              return new Promise(function (resolve) {
                setTimeout(resolve, 4000);
              }).then(check);
            }
            return runResult;
          })
          .catch(function (error) {
            setBuildLifecycle(osnId, {
              phase: "failed",
              completedAt: new Date().toISOString(),
              detail: error && error.message ? error.message : String(error),
            });
            renderApp();
          });
      }

      check();
    });
  }

  function renderDraftCard(osn) {
    if (isImmatureOsn(osn) && !isSectionUnlocked(osn, state.selectedSectionKey)) {
      els.card.innerHTML =
        '<div id="lexiom-draft-maturation-gate" class="lexiom-readonly-surface lexiom-maturation-gate-card lexiom-13-draft-host" role="status">' +
        '<div class="lexiom-readonly-banner">' +
        '<span class="lexiom-readonly-lock" aria-hidden="true">' +
        '<svg viewBox="0 0 16 16" width="12" height="12" focusable="false">' +
        '<rect x="3.5" y="7" width="9" height="7" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.35"/>' +
        '<path fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" d="M5.2 7V5.4a2.8 2.8 0 0 1 5.6 0V7"/>' +
        "</svg></span>" +
        '<span class="lexiom-readonly-banner-label">Locked</span>' +
        "</div>" +
        '<div class="lexiom-readonly-body lexiom-13-maturation-gate">' +
        "This section unlocks after the prior maturation gate is approved." +
        "</div>" +
        "</div>";
      return;
    }

    const card = ensureDraftCardState(osn, state.selectedSectionKey);
    if (!card) {
      els.card.innerHTML = '<div class="lexiom-13-error">No draft card state available.</div>';
      return;
    }

    const canToggleApproval =
      (isOsnMetaSectionKey(state.selectedSectionKey) ||
        !isImmatureOsn(osn) ||
        isSectionUnlocked(osn, state.selectedSectionKey)) &&
      (card.approved || canApproveImmatureSection(osn, state.selectedSectionKey, card));

    els.card.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.className = "lexiom-draft-card lexiom-13-draft-host" + (card.approved ? " is-approved" : "");
    wrapper.id = "lexiom-draft-card";

    const header = document.createElement("div");
    header.className = "lexiom-draft-card-header";
    header.id = "lexiom-draft-card-header";

    const labelSpan = document.createElement("span");
    labelSpan.className = "lexiom-draft-card-label";
    labelSpan.id = "lexiom-draft-card-label";
    const sectionKey = state.selectedSectionKey;
    const sectionGlyph =
      OSN_SECTION_DEFS.some(function (section) {
        return section.key === sectionKey;
      }) || sectionKey === BUD_SECTION_KEY
        ? getSectionGlyphMarkup(sectionKey)
        : "";
    labelSpan.innerHTML =
      sectionGlyph +
      '<span class="lexiom-draft-card-label-text">' +
      escapeHtml(getSectionLabel(sectionKey)) +
      (sectionKey === BUD_SECTION_KEY && hasOpenableBud(osn) ? " " : "") +
      "</span>";

    if (sectionKey === BUD_SECTION_KEY && hasOpenableBud(osn)) {
      const bud = osn.bud || {};
      const artifactUrl = getBudArtifactUrl(osn);
      const entryName =
        String(bud.entry_file_name || "").trim() ||
        (String(bud.media_kind || "").toLowerCase() === "software"
          ? "index.html"
          : "document.md");
      if (artifactUrl) {
        const downloadBtn = document.createElement("button");
        downloadBtn.type = "button";
        downloadBtn.className = "lexiom-bud-draft-download";
        downloadBtn.id = "lexiom-bud-draft-download";
        downloadBtn.setAttribute("aria-label", "Download delivered artifact");
        downloadBtn.title = "Download " + entryName;
        downloadBtn.innerHTML =
          '<span class="lexiom-bud-draft-download-glyph" aria-hidden="true">' +
          '<svg viewBox="0 0 16 16" width="14" height="14" focusable="false">' +
          '<path fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" d="M8 2.2v8.2"/>' +
          '<path fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" d="M5.2 7.8L8 10.6l2.8-2.8"/>' +
          '<path fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" d="M3.2 13.2h9.6"/>' +
          "</svg></span>";
        downloadBtn.addEventListener("click", function (event) {
          event.stopPropagation();
          downloadBudArtifact(artifactUrl, entryName);
        });
        labelSpan.appendChild(downloadBtn);
      }
    }

    const glyphBtn = document.createElement("button");
    glyphBtn.type = "button";
    glyphBtn.className = "lexiom-draft-card-glyph";
    glyphBtn.id = "lexiom-draft-card-glyph";
    glyphBtn.textContent = getGlyphForCard(card);
    glyphBtn.title = card.approved
      ? "Approved — click to unapprove"
      : canToggleApproval
        ? "Click to approve"
        : sectionKey === BUD_SECTION_KEY
          ? "Wait for the delivered bud to load before approving"
          : "Add content before approving this maturation gate";
    if (card.approved) {
      glyphBtn.classList.add("lexiom-draft-card-glyph-approved");
    }
    if (!canToggleApproval) {
      glyphBtn.disabled = true;
      glyphBtn.classList.add("is-disabled");
      if (
        isImmatureOsn(osn) &&
        state.selectedSectionKey === "success_evidences" &&
        !card.approved
      ) {
        glyphBtn.title = "Include at least one direct: true success evidence before approving";
      }
    }

    function canToggleApprovalNow(currentCard) {
      return (
        (isOsnMetaSectionKey(state.selectedSectionKey) ||
          !isImmatureOsn(osn) ||
          isSectionUnlocked(osn, state.selectedSectionKey)) &&
        (currentCard.approved ||
          canApproveImmatureSection(osn, state.selectedSectionKey, currentCard))
      );
    }

    function refreshDraftCardGlyph(currentCard) {
      const allowed = canToggleApprovalNow(currentCard);
      const approved = !!(currentCard && currentCard.approved);
      glyphBtn.textContent = getGlyphForCard(currentCard);
      glyphBtn.classList.toggle("lexiom-draft-card-glyph-approved", approved);
      glyphBtn.disabled = !allowed;
      glyphBtn.classList.toggle("is-disabled", !allowed);
      wrapper.classList.toggle("is-approved", approved);
      glyphBtn.title = approved
        ? "Approved — click to unapprove"
        : allowed
          ? "Click to approve"
          : "Add content before approving this maturation gate";
    }

    glyphBtn.addEventListener("click", function () {
      const currentCard = ensureDraftCardState(osn, state.selectedSectionKey);
      if (!canToggleApprovalNow(currentCard)) {
        return;
      }
      toggleDraftApproval(osn.id, state.selectedSectionKey);
    });

    header.appendChild(labelSpan);
    header.appendChild(glyphBtn);

    if (sectionKey === BUILD_SECTION_KEY) {
      const lifecycle = getBuildLifecycle(osn.id);
      const phase = lifecycle && lifecycle.phase ? lifecycle.phase : "idle";
      const status = document.createElement("div");
      status.className = "lexiom-build-status-banner is-" + phase;
      status.id = "lexiom-build-status";
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      status.setAttribute(
        "aria-label",
        getBuildPhaseLabel(lifecycle) +
          (lifecycle && lifecycle.detail ? ". " + lifecycle.detail : "")
      );

      const phaseLine = document.createElement("div");
      phaseLine.className = "lexiom-build-status-phase";
      phaseLine.textContent = getBuildPhaseLabel(lifecycle);
      status.appendChild(phaseLine);

      const meta = document.createElement("div");
      meta.className = "lexiom-build-status-meta";
      const elapsed = formatBuildElapsed(lifecycle);
      const metaParts = [];
      if (lifecycle && lifecycle.runId) metaParts.push("Run " + lifecycle.runId);
      if (elapsed) metaParts.push("Elapsed " + elapsed);
      if (lifecycle && lifecycle.detail) metaParts.push(lifecycle.detail);
      meta.textContent = metaParts.join(" · ");
      status.appendChild(meta);

      if (phase === "preparing" || phase === "running" || phase === "completed") {
        const rail = document.createElement("div");
        rail.className = "lexiom-build-progress-rail";
        rail.setAttribute("aria-hidden", "true");
        const fill = document.createElement("span");
        fill.className = "lexiom-build-progress-fill";
        rail.appendChild(fill);
        status.appendChild(rail);
      }
      wrapper.appendChild(status);
    }

    if (state.ui.canonizationPending && osn.id === state.selectedOsnId) {
      const status = document.createElement("div");
      status.className = "lexiom-13-lens-status";
      status.id = "lexiom-draft-canonization-status";
      status.textContent = "Canonizing this OSN as a linked YAML file...";
      wrapper.appendChild(status);
    } else if (state.ui.canonizationError && osn.id === state.selectedOsnId) {
      const status = document.createElement("div");
      status.className = "lexiom-13-lens-status lexiom-13-error";
      status.id = "lexiom-draft-canonization-status";
      status.textContent = state.ui.canonizationError;
      wrapper.appendChild(status);
    } else if (state.ui.persistPending && osn.id === state.selectedOsnId) {
      const status = document.createElement("div");
      status.className = "lexiom-13-lens-status";
      status.id = "lexiom-draft-persist-status";
      status.textContent = "Saving approved changes to the OSN YAML file...";
      wrapper.appendChild(status);
    } else if (state.ui.persistError && osn.id === state.selectedOsnId) {
      const status = document.createElement("div");
      status.className = "lexiom-13-lens-status lexiom-13-error";
      status.id = "lexiom-draft-persist-status";
      status.textContent = state.ui.persistError;
      wrapper.appendChild(status);
    }

    const textarea = document.createElement("textarea");
    textarea.className = "lexiom-draft-card-text";
    textarea.id = "lexiom-draft-card-text";
    textarea.value = card.text || "";
    textarea.__lexiomDiffCard = card;
    textarea.setAttribute(
      "aria-label",
      getOsnOriginLeafLabel(osn) + " " + getSectionLabel(state.selectedSectionKey) + " draft card"
    );
    textarea.rows = isOsnMetaSectionKey(state.selectedSectionKey) ? 3 : 16;

    function autoSize(el) {
      if (!el) return;
      // Editor shell fills the draft card; keep gutter/highlight synced.
      syncDraftCardEditor(el);
    }

    textarea.addEventListener("input", function () {
      const currentCard = ensureDraftCardState(osn, state.selectedSectionKey);
      const wasApproved = !!(currentCard && currentCard.approved);
      const previousCard = wasApproved ? snapshotCardForFade() : null;

      updateDraftCardText(osn.id, state.selectedSectionKey, textarea.value);
      autoSize(textarea);
      renderFocus(osn);
      refreshDraftCardGlyph(ensureDraftCardState(osn, state.selectedSectionKey));

      if (
        previousCard &&
        currentCard &&
        wasApproved &&
        !currentCard.approved
      ) {
        fadeDraftPresentationInPlace(osn, previousCard);
      }
    });

    wrapper.appendChild(header);
    wrapper.appendChild(mountDraftCardEditor(textarea));
    autoSize(textarea);
    els.card.appendChild(wrapper);
  }

  function renderEvidences(osn) {
    els.evidences.innerHTML = renderEvidenceArtifactList(osn);
    bindEvidenceTriggers(els.evidences);
    bindEvidenceApprovalToggles(els.evidences);
  }

  function formatCausalExpositionPlainText(entry) {
    if (!entry) {
      return "";
    }
    if (entry.editedText != null && String(entry.editedText).length) {
      return String(entry.editedText);
    }
    const causeTags = entry.causeTags || null;
    const narrative = causeTags && causeTags.narrative ? causeTags.narrative : String(entry.text || "").trim();
    const lines = [];
    if (narrative) {
      lines.push(narrative);
    }
    function appendSection(title, items) {
      if (!Array.isArray(items) || !items.length) {
        return;
      }
      if (lines.length) {
        lines.push("");
      }
      lines.push(title);
      items.forEach(function (item) {
        lines.push("- " + item);
      });
    }
    if (causeTags) {
      appendSection("APPROVED CAUSES:", causeTags.approved);
      appendSection("INFERRED CAUSES:", causeTags.inferred);
      appendSection("MISSING CAUSES:", causeTags.missing);
    }
    return lines.join("\n").trim();
  }

  function getLatestAssistantEntry(thread) {
    if (!Array.isArray(thread) || !thread.length) {
      return null;
    }
    for (let i = thread.length - 1; i >= 0; i -= 1) {
      if (thread[i] && thread[i].role === "assistant") {
        return thread[i];
      }
    }
    return null;
  }

  function updateCausalExpositionText(osnId, evidenceId, nextText) {
    const thread = getCausalThread(osnId, evidenceId);
    const entry = getLatestAssistantEntry(thread);
    if (!entry) {
      return;
    }
    const previous =
      entry.editedText != null ? String(entry.editedText) : formatCausalExpositionPlainText(entry);
    const next = String(nextText || "");
    if (previous === next) {
      return;
    }
    entry.editedText = next;
    entry.hasUserEdits = true;
    if (entry.approved) {
      entry.approved = false;
    }
    appendAction("edit_causal_exposition", {
      osnId: osnId,
      evidenceId: evidenceId,
    });
    refreshCausalNarrativeGlyph(osnId, evidenceId);
  }

  function renderCausalAskPanel(thread, busy, statusHtml, unlocked, flashUnlock) {
    const placeholder = unlocked ? PLAYER_ASK_PLACEHOLDER : CAUSAL_ASK_PLACEHOLDER;
    const ariaLabel = unlocked
      ? "Ask a question or request an Output Spec change"
      : "Causal lineage question";
    return (
      '<section class="lexiom-causal-chat-ask-panel' +
      (flashUnlock ? " is-unlock-flash" : "") +
      '" aria-label="Your ask">' +
      '<div class="lexiom-causal-chat-panel-label">Your ask</div>' +
      '<div id="lexiom-causal-ask-card" class="lexiom-draft-card lexiom-causal-ask-card">' +
      '<textarea id="lexiom-causal-chat-input" class="lexiom-draft-card-text lexiom-causal-ask-input" rows="5" ' +
      'placeholder="' +
      escapeHtml(placeholder) +
      '" ' +
      'title="" ' +
      'aria-label="' +
      escapeHtml(ariaLabel) +
      '" ' +
      (busy ? "disabled" : "") +
      "></textarea>" +
      "</div>" +
      statusHtml +
      "</section>"
    );
  }

  function focusLineageNarrativeInCenter() {
    const narrativeCard = document.getElementById("lexiom-lineage-narrative-card");
    const narrativeText = document.getElementById("lexiom-lineage-narrative-text");
    if (!narrativeCard) {
      return false;
    }
    narrativeCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
    narrativeCard.classList.remove("is-link-target-flash");
    void narrativeCard.offsetWidth;
    narrativeCard.classList.add("is-link-target-flash");
    window.setTimeout(function () {
      narrativeCard.classList.remove("is-link-target-flash");
    }, 1400);
    if (narrativeText && !narrativeText.readOnly) {
      narrativeText.focus();
    }
    return true;
  }

  function focusOutputSpecChangeInCenter() {
    const changeCard = document.getElementById("lexiom-output-spec-change-card");
    const changeText = document.getElementById("lexiom-output-spec-change-text");
    if (!changeCard) {
      return false;
    }
    changeCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
    changeCard.classList.remove("is-link-target-flash");
    void changeCard.offsetWidth;
    changeCard.classList.add("is-link-target-flash");
    window.setTimeout(function () {
      changeCard.classList.remove("is-link-target-flash");
    }, 1400);
    if (changeText && !changeText.readOnly) {
      changeText.focus();
    }
    return true;
  }

  function getLatestUserEntry(thread) {
    if (!Array.isArray(thread) || !thread.length) {
      return null;
    }
    for (let i = thread.length - 1; i >= 0; i -= 1) {
      if (thread[i] && thread[i].role === "user" && String(thread[i].text || "").trim()) {
        return thread[i];
      }
    }
    return null;
  }

  function renderCausalExecSummaryBody(questionText, summaryText) {
    const question = String(questionText || "").trim();
    const summary = String(summaryText || "").trim();
    if (!question) {
      return (
        '<div class="lexiom-evidence-artifact-name">' +
        escapeHtml(summary) +
        "</div>"
      );
    }
    return (
      '<div class="lexiom-evidence-artifact-name lexiom-causal-exec-summary-body">' +
      '<div class="lexiom-causal-exec-summary-question">' +
      escapeHtml(question) +
      "</div>" +
      '<div class="lexiom-causal-exec-summary-divider" aria-hidden="true"></div>' +
      '<div class="lexiom-causal-exec-summary-answer">' +
      escapeHtml(summary) +
      "</div>" +
      "</div>"
    );
  }

  function renderCausalExpositionPanel(osn, busy) {
    const evidenceId = state.selectedEvidenceId;
    const askKind = evidenceId ? getLatestAskKind(osn.id, evidenceId) : "Q";
    const changeProposal =
      evidenceId && askKind === "A" ? getOutputSpecChangeState(osn.id, evidenceId) : null;
    const card = evidenceId ? getCausalExecSummaryState(osn.id, evidenceId) : null;
    const summaryText = changeProposal
      ? String(changeProposal.execSummary || (card && card.text) || "").trim()
      : card
        ? String(card.text || "").trim()
        : "";
    const latestQuestion = evidenceId
      ? getLatestUserEntry(getCausalThread(osn.id, evidenceId))
      : null;
    const questionText = changeProposal && String(changeProposal.askText || "").trim()
      ? String(changeProposal.askText || "").trim()
      : latestQuestion
        ? String(latestQuestion.text || "").trim()
        : "";
    const isActive =
      !!summaryText &&
      !busy &&
      evidenceId &&
      (askKind === "A"
        ? isOutputSpecChangeRevealed(osn.id, evidenceId)
        : isCausalNarrativeRevealed(osn.id, evidenceId));
    const openLabel =
      askKind === "A"
        ? "Open proposed Output Spec in the center playfield"
        : "Open lineage narrative in the center playfield";

    if (!summaryText) {
      const placeholder = busy
        ? "Composing Lexiom proposal..."
        : "Proposal will appear here after you ask.";
      return (
        '<section class="lexiom-causal-chat-exposition-panel" aria-label="Lexiom proposal">' +
        '<div class="lexiom-causal-chat-panel-label">Lexiom proposal</div>' +
        '<div id="lexiom-causal-exec-summary-card" class="lexiom-causal-exec-summary-card is-placeholder">' +
        '<div class="lexiom-evidence-artifact-trigger is-disabled" aria-disabled="true">' +
        renderCausalExecSummaryBody(questionText, placeholder) +
        "</div>" +
        "</div>" +
        "</section>"
      );
    }

    return (
      '<section class="lexiom-causal-chat-exposition-panel" aria-label="Lexiom proposal">' +
      '<div class="lexiom-causal-chat-panel-label">Lexiom proposal</div>' +
      '<div id="lexiom-causal-exec-summary-card" class="lexiom-causal-exec-summary-card">' +
      '<button type="button" id="lexiom-causal-exec-summary-link" ' +
      'class="lexiom-evidence-artifact-trigger lexiom-causal-exec-summary-trigger' +
      (isActive ? " is-selected" : "") +
      '" title="" ' +
      'aria-label="' +
      escapeHtml(openLabel) +
      '" ' +
      'aria-pressed="' +
      (isActive ? "true" : "false") +
      '">' +
      renderCausalExecSummaryBody(questionText, summaryText) +
      "</button>" +
      "</div>" +
      "</section>"
    );
  }

  function renderBottomRibbon(osn) {
    if (!els.bottomRibbon) {
      return;
    }

    const evidenceLink = getSelectedEvidenceLink(osn);
    if (!evidenceLink || !state.selectedEvidenceId) {
      els.bottomRibbon.innerHTML =
        '<div id="lexiom-13-ribbon-placeholder" class="lexiom-13-ribbon-placeholder">' +
        "Semantic actions — coming soon" +
        "</div>";
      return;
    }

    const evidenceId = state.selectedEvidenceId;
    const evidenceKey = getCausalEvidenceKey(osn.id, evidenceId);
    const unlocked = isPlayerAskUnlocked(osn.id, evidenceId);
    const flashUnlock = unlocked && state.ui.playerAskUnlockFlashKey === evidenceKey;
    const thread = getCausalThread(osn.id, evidenceId);
    const busy = state.ui.causalInferencePending || causalInferenceInFlight || phase !== PHASES.STABLE;
    const statusHtml = state.ui.causalInferencePending
      ? '<div class="lexiom-causal-chat-status">' +
        (unlocked
          ? "Interpreting your ask and composing Lexiom proposal..."
          : "Tracing causal lineage through approved OSN context...") +
        "</div>"
      : state.ui.causalInferenceError
        ? '<div class="lexiom-causal-chat-status lexiom-13-error">' +
          escapeHtml(state.ui.causalInferenceError) +
          "</div>"
        : "";

    const priorAsk = document.getElementById("lexiom-causal-chat-input");
    const evidenceDraftKey = getCausalEvidenceKey(osn.id, evidenceId);
    if (priorAsk) {
      causalAskDraftByKey.set(evidenceDraftKey, String(priorAsk.value || ""));
    }
    const restoreAskFocus = !!(priorAsk && document.activeElement === priorAsk);
    const restoreAskSelStart = priorAsk ? priorAsk.selectionStart : null;
    const restoreAskSelEnd = priorAsk ? priorAsk.selectionEnd : null;

    els.bottomRibbon.innerHTML =
      '<div id="lexiom-causal-chat" class="lexiom-causal-chat" aria-label="Causal lineage chat">' +
      '<div class="lexiom-causal-chat-panels">' +
      renderCausalAskPanel(thread, busy, statusHtml, unlocked, flashUnlock) +
      renderCausalExpositionPanel(osn, busy) +
      "</div>" +
      "</div>";

    bindCausalChatTriggers(osn, {
      restoreFocus: restoreAskFocus,
      selectionStart: restoreAskSelStart,
      selectionEnd: restoreAskSelEnd,
    });

    if (flashUnlock) {
      window.setTimeout(function () {
        if (state.ui.playerAskUnlockFlashKey === evidenceKey) {
          state.ui.playerAskUnlockFlashKey = null;
          const panel = document.querySelector(".lexiom-causal-chat-ask-panel.is-unlock-flash");
          if (panel) {
            panel.classList.remove("is-unlock-flash");
          }
        }
      }, 1600);
    }
  }

  function submitCausalQuestion(osn, evidenceId, questionText) {
    const trimmed = String(questionText || "").trim();
    if (!trimmed || phase !== PHASES.STABLE || state.ui.causalInferencePending || causalInferenceInFlight) {
      return;
    }
    if (isPlayerAskUnlocked(osn.id, evidenceId)) {
      const forceAction = isImperativeOutputSpecChangeAsk(trimmed);
      appendAction("player_ask_submitted", {
        osnId: osn.id,
        evidenceId: evidenceId,
        askText: trimmed,
        askKindPath: "player_ask",
        forceAction: forceAction,
        narrativeBuilder: forceAction
          ? "output_spec_change"
          : "player_ask_classified",
      });
      dispatchWhiteMove("SUBMIT_PLAYER_ASK", {
        osnId: osn.id,
        evidenceId: evidenceId,
        askText: trimmed,
        forceAction: forceAction,
      });
      causalAskDraftByKey.delete(getCausalEvidenceKey(osn.id, evidenceId));
      return;
    }
    appendAction("causal_question_submitted", {
      osnId: osn.id,
      evidenceId: evidenceId,
      questionText: trimmed,
      askKindPath: "causal",
      narrativeBuilder: "causal_lineage",
    });
    dispatchWhiteMove("SUBMIT_CAUSAL_QUESTION", {
      osnId: osn.id,
      evidenceId: evidenceId,
      questionText: trimmed,
    });
    causalAskDraftByKey.delete(getCausalEvidenceKey(osn.id, evidenceId));
  }

  function bindCausalChatTriggers(osn, restoreOptions) {
    const input = document.getElementById("lexiom-causal-chat-input");
    const execSummaryLink = document.getElementById("lexiom-causal-exec-summary-link");
    if (!input || !state.selectedEvidenceId) {
      return;
    }

    const draftKey = getCausalEvidenceKey(osn.id, state.selectedEvidenceId);
    const savedDraft = causalAskDraftByKey.get(draftKey);
    if (typeof savedDraft === "string" && savedDraft && !input.value) {
      input.value = savedDraft;
    }

    input.title = "";
    input.oninput = function () {
      causalAskDraftByKey.set(draftKey, String(input.value || ""));
      input.title = "";
      autoSizeCausalInput(input);
    };

    input.onkeydown = function (event) {
      if (event.key !== "Enter" || event.shiftKey || event.isComposing) {
        return;
      }
      event.preventDefault();
      const questionText = input.value;
      submitCausalQuestion(osn, state.selectedEvidenceId, questionText);
      input.value = "";
      causalAskDraftByKey.delete(draftKey);
      autoSizeCausalInput(input);
    };

    autoSizeCausalInput(input);

    if (restoreOptions && restoreOptions.restoreFocus && !input.disabled) {
      window.requestAnimationFrame(function () {
        const live = document.getElementById("lexiom-causal-chat-input");
        if (!live || live.disabled) {
          return;
        }
        live.focus();
        try {
          const start =
            typeof restoreOptions.selectionStart === "number"
              ? restoreOptions.selectionStart
              : live.value.length;
          const end =
            typeof restoreOptions.selectionEnd === "number"
              ? restoreOptions.selectionEnd
              : live.value.length;
          live.setSelectionRange(start, end);
        } catch (_error) {
          // Some browsers reject setSelectionRange on empty/disabled fields.
        }
      });
    }

    if (execSummaryLink) {
      execSummaryLink.onclick = function () {
        revealFindingsInCenter(osn.id, state.selectedEvidenceId);
      };
    }
  }

  function autoSizeCausalInput(el) {
    if (!el || el.tagName !== "TEXTAREA") {
      return;
    }
    // Center lineage / proposed-output draft cards fill the narrative card via CSS;
    // only auto-size compact L3 ask inputs.
    if (el.classList.contains("lexiom-lineage-narrative-text")) {
      syncDraftCardEditor(el);
      return;
    }
    const maxHeight = 180;
    const shell = el.closest ? el.closest(".lexiom-draft-card-editor") : null;
    if (shell) {
      const style = window.getComputedStyle(el);
      const lineHeight = parseFloat(style.lineHeight) || 20;
      const paddingY =
        (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
      const contentHeight = Math.max(
        countDraftEditorLines(el.value) * lineHeight + paddingY,
        72
      );
      shell.style.flex = "0 0 auto";
      shell.style.height = Math.min(contentHeight, maxHeight) + "px";
    } else {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, maxHeight) + "px";
    }
    syncDraftCardEditor(el);
  }

  function bindSelectionTriggers(container) {
    container.querySelectorAll(".lexiom-osn-sibling-trigger").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        const siblingOsnId = button.getAttribute("data-sibling-osn-id");
        if (siblingOsnId) {
          selectOsn(siblingOsnId, getRememberedSectionKey());
        }
      });
    });

    container.querySelectorAll(".lexiom-osn-trigger").forEach(function (button) {
      button.addEventListener("click", function (event) {
        const osnId = button.getAttribute("data-osn-id");
        const sectionKey = button.getAttribute("data-section-key");
        if (osnId) {
          if (button.classList.contains("lexiom-osn-node-main")) {
            // The nested pencil opens the OSN-name draft card instead of the default section.
            const editGlyph =
              event.target && event.target.closest
                ? event.target.closest(".lexiom-osn-edit-name-trigger")
                : null;
            if (editGlyph && button.contains(editGlyph)) {
              selectOsn(osnId, OSN_FILE_NAME_META_KEY);
              return;
            }
            selectOsn(osnId, getRememberedSectionKey());
            return;
          }
          if (button.disabled || button.classList.contains("is-locked")) {
            return;
          }
          selectOsn(osnId, sectionKey || DEFAULT_SELECTED_SECTION_KEY, { expandOnSelect: true });
        }
      });
    });

    container.querySelectorAll(".lexiom-osn-edit-name-trigger").forEach(function (glyph) {
      glyph.addEventListener("keydown", function (event) {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        const osnId = glyph.getAttribute("data-osn-id");
        if (osnId) {
          selectOsn(osnId, OSN_FILE_NAME_META_KEY);
        }
      });
    });

    container.querySelectorAll(".lexiom-osn-build-trigger").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.stopPropagation();
        const osnId = button.getAttribute("data-build-osn-id");
        if (osnId) {
          const osn = getOsnById(osnId);
          if (!canBuildOsn(osn)) {
            return;
          }
          setOsnExpanded(osnId, true);
          openCompilePreview(osnId);
        }
      });
    });

    container.querySelectorAll(".lexiom-osn-branch-trigger").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.stopPropagation();
        const parentId = button.getAttribute("data-branch-parent-id");
        if (parentId) {
          branchOsnFromParent(parentId);
        }
      });
    });

    container.querySelectorAll(".lexiom-osn-prune-trigger").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.stopPropagation();
        const osnId = button.getAttribute("data-prune-osn-id");
        if (osnId) {
          pruneOsnBranch(osnId);
        }
      });
    });
  }

  function renderError(message) {
    els.lenses.innerHTML = '<div class="lexiom-13-error">' + escapeHtml(message) + "</div>";
    els.graph.innerHTML = '<div class="lexiom-13-error">' + escapeHtml(message) + "</div>";
    els.evidences.innerHTML = '<li class="lexiom-13-error">No success evidences available.</li>';
    els.focus.innerHTML =
      '<span class="lexiom-osn-focus-title">Unable to load OSNs</span>' +
      '<span class="lexiom-osn-focus-meta">' + escapeHtml(message) + "</span>";
    if (els.sectionStrip) {
      els.sectionStrip.innerHTML = "";
    }
    els.card.innerHTML = '<div class="lexiom-13-error">' + escapeHtml(message) + "</div>";
  }

  function renderApp() {
    if (state.error) {
      renderError(state.error);
      renderCockpitTitle();
      return;
    }

    const osn = getSelectedOsn();
    if (!osn) {
      renderError("No OSNs were loaded.");
      renderCockpitTitle();
      return;
    }

    if (state.ui.cockpitTitleStale && !cockpitTitleInferenceInFlight) {
      state.ui.cockpitTitleStale = false;
      requestCockpitTitleInference();
    } else {
      renderCockpitTitle();
    }

    renderLenses(osn);
    syncFullGraphModeVisibility();
    renderGraph();
    syncOptionalChromeVisibility();
    renderFocus(osn);
    renderSectionStrip(osn);
    renderCenterPlayfield(osn);
    renderEvidences(osn);
    renderBottomRibbon(osn);
  }

  const WELCOME_STORAGE_KEY = "lexiom13_welcome_seen";

  function shouldForceWelcome() {
    try {
      const value = new URLSearchParams(window.location.search).get("welcome");
      return value === "1" || value === "force" || value === "true";
    } catch (_error) {
      return false;
    }
  }

  function hasSeenWelcome() {
    try {
      return window.localStorage.getItem(WELCOME_STORAGE_KEY) === "1";
    } catch (_error) {
      return false;
    }
  }

  function markWelcomeSeen() {
    try {
      window.localStorage.setItem(WELCOME_STORAGE_KEY, "1");
    } catch (_error) {
      // storage may be unavailable; the modal simply reappears next load
    }
  }

  // A reload (including a hard refresh, Shift+Ctrl+R) simulates a newcomer:
  // the welcome modal is re-presented regardless of the stored "seen" flag.
  // Browsers do not expose whether a reload was "hard", so any refresh triggers it.
  function isReloadNavigation() {
    try {
      const entries =
        typeof performance !== "undefined" && performance.getEntriesByType
          ? performance.getEntriesByType("navigation")
          : null;
      if (entries && entries.length && entries[0] && entries[0].type) {
        return entries[0].type === "reload";
      }
      if (typeof performance !== "undefined" && performance.navigation) {
        return performance.navigation.type === 1; // TYPE_RELOAD
      }
    } catch (_error) {
      // fall through to false
    }
    return false;
  }

  /**
   * Keyboard-first graph navigation (no extra glyphs): ArrowLeft / ArrowRight
   * move the Focus OSN to its previous / next sibling, mirroring the ◀ ▶
   * glyphs; ArrowUp moves to the direct (primary) ancestor; ArrowDown moves to
   * the first descendant. Ignored while typing in a field or while the welcome
   * modal is open.
   */
  function isTextEntryTarget(target) {
    if (!target || !target.tagName) {
      return false;
    }
    const tag = target.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
  }

  function getKeyboardNavigationTarget(focusOsn, key) {
    const plane = getActivePlane(focusOsn);
    if (key === "ArrowLeft" || key === "ArrowRight") {
      const navigation = getPlaneSiblingNavigation(focusOsn, plane);
      return key === "ArrowLeft" ? navigation.previous : navigation.next;
    }
    if (key === "ArrowUp") {
      if (
        plane &&
        plane.kind === "additional" &&
        plane.rootOsn &&
        getPlanePeerOsns(plane).some(function (peer) {
          return peer.id === focusOsn.id;
        })
      ) {
        return plane.rootOsn;
      }
      const parentIds = Array.isArray(focusOsn.graph && focusOsn.graph.parent_osn_ids)
        ? focusOsn.graph.parent_osn_ids
        : [];
      return parentIds.length ? getOsnById(parentIds[0]) : null;
    }
    if (key === "ArrowDown") {
      if (
        plane &&
        plane.kind === "additional" &&
        plane.rootOsn &&
        focusOsn.id === plane.rootOsn.id
      ) {
        const peers = getPlanePeerOsns(plane);
        return peers.length ? peers[0] : null;
      }
      const childIds = Array.isArray(focusOsn.graph && focusOsn.graph.child_osn_ids)
        ? focusOsn.graph.child_osn_ids
        : [];
      return childIds.length ? getOsnById(childIds[0]) : null;
    }
    return null;
  }

  function setupGraphKeyboardNavigation() {
    const NAVIGATION_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && state.ui.planePickerOpen && !state.ui.fullGraphMode) {
        event.preventDefault();
        closePlanePicker();
        renderCockpitGraph({ animatePlaneChange: false });
        const shadowBtn = document.getElementById("lexiom-plane-shadow");
        if (shadowBtn) {
          shadowBtn.focus();
        }
        return;
      }
      if (event.key === "Escape" && state.ui.fullGraphMode) {
        event.preventDefault();
        toggleFullGraphMode(false);
        return;
      }
      if (NAVIGATION_KEYS.indexOf(event.key) === -1) {
        return;
      }
      if (state.ui.fullGraphMode) {
        return;
      }
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }
      if (isTextEntryTarget(event.target)) {
        return;
      }
      const welcomeOverlay = document.getElementById("lexiom-welcome-modal");
      if (welcomeOverlay && !welcomeOverlay.hidden) {
        return;
      }
      const focusOsn = getSelectedOsn();
      if (!focusOsn) {
        return;
      }
      const target = getKeyboardNavigationTarget(focusOsn, event.key);
      if (!target) {
        return;
      }
      event.preventDefault();
      selectOsn(target.id, getRememberedSectionKey());
    });
  }

  function setupFullGraphToggle() {
    if (!els.fullGraphToggle) {
      return;
    }
    els.fullGraphToggle.addEventListener("click", function () {
      toggleFullGraphMode();
    });
    if (!els.fullGraphKindSwitch) {
      return;
    }
    els.fullGraphKindSwitch.querySelectorAll("[data-full-graph-kind]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setFullGraphKind(btn.getAttribute("data-full-graph-kind"));
      });
    });
  }

  function setupWelcomeModal() {
    const overlay = document.getElementById("lexiom-welcome-modal");
    if (!overlay) {
      return;
    }
    const dismiss = document.getElementById("lexiom-welcome-modal-dismiss");
    if (dismiss) {
      dismiss.addEventListener("click", function () {
        overlay.hidden = true;
        markWelcomeSeen();
        appendAction("welcome_modal_dismissed", {});
      });
    }
    if (shouldForceWelcome() || isReloadNavigation() || !hasSeenWelcome()) {
      overlay.hidden = false;
      if (dismiss) {
        dismiss.focus();
      }
      appendAction("welcome_modal_shown", {});
    }
  }

  async function init() {
    try {
      appendAction("load_started", {});
      restoreBuildLifecycleState();
      await loadOsnGraph();
      await loadEvidenceAvailability();
      appendAction("load_completed", { count: state.orderedOsns.length });
      renderApp();
      reconnectPersistedBuilds();
      setupGraphResizeObserver();
      startEvidenceCollectionPoller();
    } catch (error) {
      state.error = error && error.message ? error.message : String(error);
      renderApp();
    }
  }

  init().finally(function () {
    setupWelcomeModal();
    setupGraphKeyboardNavigation();
    setupFullGraphToggle();
  });
})();
