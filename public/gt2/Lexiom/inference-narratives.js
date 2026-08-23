// =============================================================
// Lexiom Inference Narrative Builder
// Per Lexiom_Wireframe_UI_Spec_1_0.md §8
// =============================================================

(function () {
  "use strict";

  // L2 semantic topic keys (order mirrors UI: a–d).
  // a=disputes, b=goals, c=strategy, d=undisputed
  const L2_TOPIC_KEYS = ["disputes", "goals", "strategy", "undisputed"];

  function l2TopicKeyFromIndex(index) {
    const i = typeof index === "number" ? index : 0;
    return L2_TOPIC_KEYS[i] || "goals";
  }

  const L2_AXIS_META = [
    {
      id: 1,
      name: "Declared Position (Self)",
      focus: "what the user is explicitly claiming or demanding.",
    },
    {
      id: 2,
      name: "Underlying Interests (Self)",
      focus: "why the user truly wants this (financial, reputational, procedural, emotional, or risk-avoidant interests).",
    },
    {
      id: 3,
      name: "Declared Position (Other)",
      focus: "what the other side is explicitly claiming or demanding.",
    },
    {
      id: 4,
      name: "Underlying Interests (Other)",
      focus: "what the other side likely needs, fears, or is trying to protect.",
    },
    {
      id: 5,
      name: "Leverage & Constraints (Self)",
      focus: "the legal, procedural, financial, evidentiary, and reputational constraints affecting the user.",
    },
    {
      id: 6,
      name: "Leverage & Constraints (Other)",
      focus: "the equivalent constraints affecting the opposing side.",
    },
    {
      id: 7,
      name: "Risk Surface",
      focus: "exposure vectors if conflict escalates (litigation, cost, delay, relationship, regulatory).",
    },
    {
      id: 8,
      name: "Strategic Pathways",
      focus: "the viable forward routes (escalate, negotiate, sequence partial agreements, defer, reframe scope, procedural maneuvers, settlement structures).",
    },
  ];

  /**
   * Append approved draft context blocks to a narrative lines array.
   * Approved-only policy: include draft text only when its approved flag is true.
   * @param {string[]} lines
   * @param {object} state
   * @param {{ l24a?: boolean, l24b?: boolean, l24c?: boolean, l24d?: boolean }} include
   */
  function appendApprovedDraftContextLines(lines, state, include) {
    if (!Array.isArray(lines) || !state || !include) return;

    if (include.l24a) {
      const cards = state.l23_cards || {};
      const card0 = cards["0"];
      if (card0 && card0.approved && typeof card0.text === "string") {
        const approvedL24a = String(card0.text).trim();
        if (approvedL24a) {
          lines.push(
            "",
            "APPROVED_L24A_DISPUTES:",
            approvedL24a
          );
        }
      }
    }

    const c = state.case || {};
    if (include.l24b && c.goals_draft_approved && typeof c.goals_draft_text === "string") {
      const approvedL24b = String(c.goals_draft_text).trim();
      if (approvedL24b) {
        lines.push(
          "",
          "APPROVED_L24B_GOALS:",
          approvedL24b
        );
      }
    }

    if (include.l24c && c.strategy_draft_approved && typeof c.strategy_draft_text === "string") {
      const approvedL24c = String(c.strategy_draft_text).trim();
      if (approvedL24c) {
        lines.push(
          "",
          "APPROVED_L24C_STRATEGY:",
          approvedL24c
        );
      }
    }

    if (include.l24d && c.undisputed_draft_approved && typeof c.undisputed_draft_text === "string") {
      const approvedL24d = String(c.undisputed_draft_text).trim();
      if (approvedL24d) {
        // Requested label for artifact drafting input context.
        lines.push(
          "",
          "APPROVED_L24D_UNDISPUTED_FACTS:",
          approvedL24d
        );
      }
    }
  }

  /**
   * Build narrative string for GT3 inference for draft activities.
   * @param {object} state - Current app state (getState())
   * @returns {string}
   */
  function buildLexiomNarrative(state) {
    if (!state) return "";

    const mode = (state.case && state.case.mode) || "ZENITH";
    const l1Title = (state.case && state.case.l1_title) || "";
    const l1Card = state.case && state.case.l1_card;
    const l1Text = l1Card && typeof l1Card.text === "string" ? l1Card.text : "";
    const l1Approved = l1Card && l1Card.approved;
    const stages = state.stages || [];
    const currentStage = stages.find((s) => s && s.currentStage);
    const stageName = (currentStage && currentStage.name) || "ZENITH";
    const active = state.ui && state.ui.activeActivity ? state.ui.activeActivity : { type: "IDLE", artifactId: null };

    // §8.1 Common Narrative Header
    const header = [
      "You are Lexiom (demo cockpit).",
      "MODE: " + mode,
      "L1: " + (l1Title || "?") + " | L1 draft: \"" + (l1Text || "") + "\" | approved: " + !!l1Approved,
      "STAGE: " + stageName,
      "ACTIVE_ACTIVITY: " + (active.type || "IDLE"),
    ].join("\n");

    // §8.2 Activity Payload Blocks
    let activityPayload = "";
    if (active.type === "L1_DRAFT") {
      activityPayload =
        "L1_IDENTITY: Current draft: \"" + l1Text + "\". TASK: Improve or refine this case identity (3–5 words). Return only the revised identity text.";
    } else if (active.type === "ACTION_DRAFT" && state.actionItems && state.actionItems.proposed) {
      const proposedText = state.actionItems.proposed.text || "";
      activityPayload =
        "ACTION_ITEM_DRAFT: Current draft: \"" + proposedText + "\". TASK: Improve or refine this proposed action. Return only the revised action text.";
    } else if (active.type === "DOC_DRAFT" && Array.isArray(state.privateArtifacts)) {
      const target = state.privateArtifacts.find((a) => a && a.id === active.artifactId) || state.privateArtifacts[0];
      const docText = (target && target.card && target.card.text) || "";
      const title = (target && target.title) || "document";
      activityPayload =
        "DOCUMENT_DRAFT: Document \"" + title + "\". Current draft: \"" + (docText.slice(0, 500) + (docText.length > 500 ? "..." : "")) + "\". TASK: Improve or refine this draft. Return only the revised text (or a concise summary if the document is long).";
    } else {
      activityPayload = "No draft activity focused. TASK: Return a short greeting or status.";
    }

    // §8.3 Strategic Hint
    const hint = "STRATEGIC_HINT: Consider Roy's 8 axes; keep response concise.";

    return header + "\n\n" + activityPayload + "\n\n" + hint;
  }

  /**
   * Build narrative for an L2 topic chat (Clarification / Impact / Resolution lens).
   * @param {object} state
   * @param {number} topicIndex
   * @param {{ l3Continuation?: boolean }} options - If l3Continuation is true, the last user message is treated as an L3 direction; ask for a substantive continuation.
   * @returns {string}
   */
  function buildL2ChatNarrative(state, topicIndex, options) {
    if (!state) return "";

    const mode = (state.case && state.case.mode) || "ZENITH";
    const stages = state.stages || [];
    const currentStage = stages.find((s) => s && s.currentStage);
    const stageName = (currentStage && currentStage.name) || "ZENITH";

    const topics = state.l2_topics || [];
    const idx = typeof topicIndex === "number" ? topicIndex : 0;
    const t = topics[idx];
    const lensLabel = (t && typeof t === "object" && t.l22) ? t.l22 : (typeof t === "string" ? t : "Clarification Lens");
    // Map the four L2 lenses to representative strategic axes:
    // index 0 (Disputes)   → Under Dispute   → Declared Position (Self) (Axis 1)
    // index 1 (Goals)      → End Goal        → Strategic Pathways (Axis 8)
    // index 2 (Strategy)   → Strategic Path  → Leverage & Constraints (Self) (Axis 5)
    // index 3 (Undisputed) → Undisputed      → Underlying Interests (Self) (Axis 2)
    var axisMap = [0, 7, 4, 1]; // zero-based indices into L2_AXIS_META
    var mappedIndex = axisMap[idx] != null ? axisMap[idx] : 7;
    const axis = L2_AXIS_META[mappedIndex] || L2_AXIS_META[7];

    const threads =
      state.threads && typeof state.threads === "object"
        ? state.threads
        : { l2Threads: {}, actionItemThreads: {} };
    const key = String(idx);
    const messages = (threads.l2Threads && threads.l2Threads[key]) || [];

    const headerLines = [
      "You are Lexiom (demo cockpit).",
      "MODE: " + mode,
      "STAGE: " + stageName,
      "L2_LENS: " + lensLabel,
      "STRATEGIC_AXIS: Axis " + axis.id + " – " + axis.name,
      "",
      "CRITICAL — LEXIOM QUESTIONING TRAIT: You ask exactly ONE question per round. A compound question that asks for two or more distinct answers (e.g. \"What X and what Y?\" or \"What X? Also, what Y?\") is out of character and inconceivable. One question, one question mark. Never bundle multiple inquiries into a single reply.",
    ];

    const historyLines = messages.map(function (msg) {
      if (!msg || !msg.text) return "";
      const role = msg.role === "assistant" ? "Lexiom" : "User";
      return role + ": " + String(msg.text);
    }).filter(Boolean);

    const historyBlock =
      historyLines.length > 0
        ? "CHAT_HISTORY:\n" + historyLines.join("\n")
        : "CHAT_HISTORY:\n(Conversation just started; no prior messages.)";

    function getApprovedL24ADisputesText() {
      const cards = state.l23_cards || {};
      const card0 = cards["0"];
      if (!card0 || !card0.approved || typeof card0.text !== "string") return "";
      return String(card0.text).trim();
    }

    var taskLines;
    const topicKey = l2TopicKeyFromIndex(idx);
    const isDisputes = topicKey === "disputes";
    const isGoals = topicKey === "goals";
    const isStrategy = topicKey === "strategy";
    if (isDisputes) {
      // L24a (disputes): ask questions along Axis 1 (Declared Position Self) and Axis 3 (Declared Position Other)
      const axis1 = L2_AXIS_META[0]; // Declared Position (Self)
      const axis3 = L2_AXIS_META[2]; // Declared Position (Other)
      taskLines = [
        "TASK:",
        "- Ask clarifying questions along two strategic axes to surface items that could reasonably be disputed:",
        "- Axis 1 — " + axis1.name + ": " + axis1.focus,
        "- Axis 3 — " + axis3.name + ": " + axis3.focus,
        "- Alternate or balance inquiry across both axes. Stay neutral and non-leading.",
        "- Reply format: Ask exactly ONE question (one question mark total). Optionally add a short follow-up explaining why it matters. If you add a follow-up, leave one blank line between the question and the follow-up. Never ask two or more distinct questions in one reply; compound questions are out of character.",
        "- Do not use the phrase \"Strategic summary:\". Use a warm, exploratory, friendly tone.",
      ];
    } else if (isGoals) {
      // L23b (goals): Lexiom_Strategic_Semantic_UX_spec_1_0.md §2.1 — Axis 2 only (Underlying Interests — Self).
      // Declared positions (Axes 1 & 3) and the other party's interests (Axis 4) are out of scope for this lens.
      const axis2 = L2_AXIS_META[1];
      var seedNarrativeGoals = (state.case && state.case.narrative && String(state.case.narrative).trim()) || "(none)";
      var approvedL24aGoals = getApprovedL24ADisputesText();
      taskLines = [
        "TASK:",
        "- Invite the user's point of view on **one strategic axis only** (aligned with Lexiom Strategic Semantic UX §2.1):",
        "- **Axis 2 — " + axis2.name + "**: why the user truly wants what they want — financial, reputational, procedural, emotional, risk-avoidant, or similar drivers. Do **not** re-litigate what they already claim or demand (that belongs in the Case seed / declared position). Do **not** pivot to the other party's motives (Axis 4) in this topic.",
        "- Reply format (strict):",
        "  1) Ask exactly ONE question (one question mark total).",
        "  2) Leave one blank line.",
        "  3) Add a short realization explaining why the question matters.",
        "  4) Leave one blank line.",
        "  5) Add one concise example-answer line grounded only in the semantic reality available in this request stack (CASE_SEED and APPROVED_L24A_DISPUTES, if present). Do not invent facts not inferable from that context.",
        "  6) The example-answer line must begin with a localized equivalent of \"For example,\" in the same output language as the rest of the reply (user-preferred language), followed by a comma (e.g., Hebrew: \"לדוגמא,\"). Do not use a fixed English label unless the output language is English.",
        "- Never ask two or more distinct questions — compound questions are out of character and forbidden.",
        "- If the user asks you a question in CHAT_HISTORY, give a short direct answer first, then rephrase your prior question in a softer, more inviting tone.",
        "- Do not use the phrase \"Strategic summary:\". Use a warm, exploratory, friendly tone.",
        "",
      ];
      if (approvedL24aGoals) {
        taskLines.push(
          "APPROVED_L24A_DISPUTES:",
          approvedL24aGoals,
          ""
        );
      }
      taskLines.push(
        "CASE_SEED (for the follow-up realization): " +
          (seedNarrativeGoals.length > 300 ? seedNarrativeGoals.slice(0, 300) + "..." : seedNarrativeGoals)
      );
    } else if (isStrategy) {
      // L23c (strategy): Axes 5–8 — Leverage Self/Other, Risk Surface, Strategic Pathways. Point-of-view inquiry, even balance.
      const axis5 = L2_AXIS_META[4];
      const axis6 = L2_AXIS_META[5];
      const axis7 = L2_AXIS_META[6];
      const axis8 = L2_AXIS_META[7];
      var seedNarrativeStrategy = (state.case && state.case.narrative && String(state.case.narrative).trim()) || "(none)";
      var approvedL24aForStrategy = getApprovedL24ADisputesText();
      var approvedL24bForStrategy = "";
      if (state.case && state.case.goals_draft_approved && typeof state.case.goals_draft_text === "string") {
        approvedL24bForStrategy = String(state.case.goals_draft_text).trim();
      }
      taskLines = [
        "TASK:",
        "- Ask questions that invite the user's point of view on the following four strategic axes:",
        "- Axis 5 — " + axis5.name + ": " + axis5.focus,
        "- Axis 6 — " + axis6.name + ": " + axis6.focus,
        "- Axis 7 — " + axis7.name + ": " + axis7.focus,
        "- Axis 8 — " + axis8.name + ": " + axis8.focus,
        "- Balance inquiry evenly across these four axes. Vary which axis you explore each turn.",
        "- Reply format (strict):",
        "  1) Ask exactly ONE question (one question mark total).",
        "  2) Leave one blank line.",
        "  3) Add a short realization explaining why the question matters.",
        "  4) Leave one blank line.",
        "  5) Add one concise example-answer line grounded only in the semantic reality available in this request stack (CASE_SEED, APPROVED_L24A_DISPUTES, and APPROVED_L24B_GOALS when present). Do not invent facts not inferable from that context.",
        "  6) The example-answer line must begin with a localized equivalent of \"For example,\" in the same output language as the rest of the reply (user-preferred language), followed by a comma (e.g., Hebrew: \"לדוגמא,\"). Do not use a fixed English label unless the output language is English.",
        "- Never ask two or more distinct questions (e.g. \"What X and what Y?\") — compound questions are out of character and forbidden.",
        "- If the user asks you a question in CHAT_HISTORY, give a short direct answer first, then rephrase your prior question in a softer, more inviting tone.",
        "- Do not use the phrase \"Strategic summary:\". Express yourself with a warm, exploratory, friendly tone.",
        "",
      ];
      if (approvedL24aForStrategy) {
        taskLines.push(
          "APPROVED_L24A_DISPUTES:",
          approvedL24aForStrategy,
          ""
        );
      }
      if (approvedL24bForStrategy) {
        taskLines.push(
          "APPROVED_L24B_GOALS:",
          approvedL24bForStrategy,
          ""
        );
      }
      taskLines.push(
        "CASE_SEED (for the follow-up realization): " +
          (seedNarrativeStrategy.length > 300 ? seedNarrativeStrategy.slice(0, 300) + "..." : seedNarrativeStrategy)
      );
    } else if (topicKey === "undisputed") {
      // L23d (undisputed): full semantic sweep — all 8 axes. Point-of-view inquiry. Keep reflective/appreciative tone.
      var seedNarrativeUndisputed = (state.case && state.case.narrative && String(state.case.narrative).trim()) || "(none)";
      var axisListLines = L2_AXIS_META.map(function (ax, i) {
        return "- Axis " + (i + 1) + " — " + ax.name + ": " + ax.focus;
      });
      taskLines = [
        "TASK:",
        "- Ask questions that invite the user's point of view across all eight strategic axes (surface what is agreed, undisputed, or shared):",
      ].concat(axisListLines).concat([
        "- Vary which axis you explore each turn. Invite the user to name facts or points both sides could acknowledge.",
        "- Reply format: Ask exactly ONE question (one question mark total). Follow with a short reflection. Leave one blank line between your question and your reflection. Never ask two or more distinct questions in one reply.",
        "- TONE: Oscillate between appreciation (for what the user shares), thankfulness (for their openness), and self-compassion (gentle acknowledgment of the journey). Warm, reflective. Avoid adversarial or probing language.",
        "",
        "CASE_SEED (for context): " + (seedNarrativeUndisputed.length > 300 ? seedNarrativeUndisputed.slice(0, 300) + "..." : seedNarrativeUndisputed),
      ]);
    } else {
      taskLines = [
        "TASK:",
        "- One question per round only. No compound questions.",
        "- First, give a 1–2 sentence strategic summary of the current situation along this axis: " + axis.focus,
        "- Your reply MUST start with \"Strategic summary: \" followed by that summary.",
        "- After the summary, you may add 0–2 short sentences that directly answer the user's latest message.",
        "- Stay within the \"" + lensLabel + "\" lens and keep a calm, neutral, analytical tone.",
      ];
    }
    if (options && options.l3Continuation) {
      taskLines.push("- The user's last message is a chosen L3 strategic direction; respond with a substantive continuation that incorporates this direction.");
    }
    taskLines.push("", "OUTPUT: Return only your reply text, no preamble or labels.");

    return (
      headerLines.join("\n") +
      "\n\n" +
      historyBlock +
      "\n\n" +
      taskLines.join("\n")
    );
  }

  /**
   * Build narrative for an Action Item chat.
   * Prompt context MUST include the approved action text and stage label.
   * @param {object} state
   * @param {string} actionItemId
   * @param {{ l3Continuation?: boolean }} options - If l3Continuation is true, the last user message is treated as an L3 direction; ask for a substantive continuation.
   * @returns {string}
   */
  function buildActionItemChatNarrative(state, actionItemId, options) {
    if (!state) return "";

    const mode = (state.case && state.case.mode) || "ZENITH";
    const l1Title = (state.case && state.case.l1_title) || "";
    const stages = state.stages || [];
    const currentStage = stages.find((s) => s && s.currentStage);
    const stageName = (currentStage && currentStage.name) || "ZENITH";

    const approved =
      (state.actionItems && state.actionItems.approved) || [];
    const item = approved.find(function (ai) {
      return ai && String(ai.id) === String(actionItemId);
    });
    const actionText = (item && item.text) || "";

    const threads =
      state.threads && typeof state.threads === "object"
        ? state.threads
        : { l2Threads: {}, actionItemThreads: {} };
    const key = String(actionItemId || "");
    const messages =
      (threads.actionItemThreads &&
        threads.actionItemThreads[key]) ||
      [];

    const headerLines = [
      "You are Lexiom (demo cockpit).",
      "MODE: " + mode,
      "L1: " + (l1Title || "?"),
      "STAGE: " + stageName,
      "ACTION_ITEM: " + (actionText || "(none)"),
    ];

    const historyLines = messages.map(function (msg) {
      if (!msg || !msg.text) return "";
      const role = msg.role === "assistant" ? "Lexiom" : "User";
      return role + ": " + String(msg.text);
    }).filter(Boolean);

    const historyBlock =
      historyLines.length > 0
        ? "CHAT_HISTORY:\n" + historyLines.join("\n")
        : "CHAT_HISTORY:\n(Conversation just started; no prior messages.)";

    const taskLines = [
      "TASK:",
      "- Respond in 1–3 short sentences.",
      "- Stay focused on progressing or clarifying this approved action item.",
      "- Be concrete, neutral, and procedural.",
    ];
    if (options && options.l3Continuation) {
      taskLines.push("- The user's last message is a chosen L3 strategic direction; respond with a substantive continuation that incorporates this direction.");
    }
    taskLines.push("", "OUTPUT: Return only your reply text, no preamble or labels.");

    return (
      headerLines.join("\n") +
      "\n\n" +
      historyBlock +
      "\n\n" +
      taskLines.join("\n")
    );
  }

  /**
   * Build narrative for GT3 to infer an artifact filename from an accepted action item.
   * Request: two words, underscore-separated, expressing the artifact that should result from the action.
   * @param {string} actionItemText - Semantic content of the accepted action item.
   * @returns {string}
   */
  function buildArtifactFilenameNarrative(actionItemText) {
    const content = typeof actionItemText === "string" ? actionItemText.trim() : "";
    const lines = [
      "You are Lexiom (demo cockpit).",
      "An action item has been accepted. Its semantic content:",
      "\"" + (content || "(none)") + "\"",
      "",
      "TASK: Propose a short filename for the artifact (document) that should result from this action.",
      "RULES: Use exactly two words. Separate them with a single underscore. Use lowercase. No file extension.",
      "OUTPUT: Return only the filename, e.g. client_summary or meeting_notes. No quotes, no .md.",
    ];
    return lines.join("\n");
  }

  /**
   * Build narrative for GT3 to infer the initial semantic content of an artifact created from an accepted action item.
   * Request: a narrative that expresses the aim/intention of the action (e.g. demand, timeline, consequences).
   * Prefer all-inclusive, compassionate wording; use capitals only when grammatically required.
   * @param {string} actionItemText - Semantic content of the accepted action item.
   * @returns {string}
   */
  function buildArtifactContentNarrative(actionItemText, state) {
    const content = typeof actionItemText === "string" ? actionItemText.trim() : "";
    const seedNarrative = (state && state.case && state.case.narrative && String(state.case.narrative).trim()) || "";
    const stages = state && state.stages ? state.stages : [];
    const currentStage = stages.find((s) => s && s.currentStage) || null;
    const stageName = (currentStage && currentStage.name) || "ZENITH";

    // Approved-only context: treat it as the semantic boundary conditions the draft must live within.
    const approvedL24ContextLines = [];
    appendApprovedDraftContextLines(approvedL24ContextLines, state, { l24a: true, l24b: true, l24c: true, l24d: true });
    const approvedL24Context = approvedL24ContextLines.join("\n");

    const lines = [
      "You are Lexiom (demo cockpit).",
      "",
      "CASE SEED NARRATIVE:",
      seedNarrative || "(none)",
      "",
      "APPROVED PROPOSED ACTION ITEM (operational intent):",
      "\"" + (content || "(none)") + "\"",
      "",
      "TERRAIN MAP (semantic boundary conditions):",
      approvedL24Context ? approvedL24Context : "(No approved L24 drafts available; draft must still remain anchored to the seed and the approved action item.)",
      "",
      "STAGE: " + stageName,
      "",
      "DRAFTING PRINCIPLES:",
      "- Instrumentality: the draft exists to serve the action; make the move easier to perform, clearer to communicate, and more likely to create constructive negotiational motion.",
      "- Factual grounding: when relevant, anchor the draft in leverage-bearing undisputed facts (L24D). Do not introduce new factual claims unless neutral, procedural, or explicitly framed as the user's position.",
      "- Strategic alignment: tone/structure/emphasis must reflect the approved goals and strategy; avoid argumentative escalation that contradicts the agreed strategic direction.",
      "- Stage sensitivity:",
      "  * Zenith: allow exploratory phrasing, calibrated openness, and signals that invite reaction or clarification.",
      "  * Accord: favor confirmatory language, bridge-building formulations, and clarity that stabilizes shared understanding.",
      "- Singularity of move: the draft must correspond to exactly the single approved action item; do not bundle extra initiatives, additional demands, or parallel negotiations into the same artifact.",
      "- Negotiational dignity: professional, composed, forward-moving language that cultivates momentum toward agreement (not rhetorical victory).",
      "",
      "GUARDRAILS:",
      "- Treat this as cultivation of negotiational momentum, not prediction of success.",
      "- Avoid argumentation disguised as instruction; do not attempt to resolve the case, only move it forward semantically meaningful.",
      "",
      "TASK:",
      "Draft the initial narrative content for the artifact (document) that results from the approved action item.",
      "",
      "STYLE:",
      "All-inclusive and compassionate. Use capitals only when grammatically required (proper nouns, sentence start).",
      "PLACEHOLDERS:",
      "For template placeholders use standard markdown inline code (backticks), e.g. `[insert amount]` or `[insert date]`.",
      "",
      "OUTPUT:",
      "Return only the narrative text (no preamble, no labels). One or more sentences as needed.",
    ];

    return lines.join("\n");
  }

  /**
   * Build narrative for Center draft (L1 / Action / Doc) when the user clicked an L3 statement.
   * Injects the L3 label as SEMANTIC_DIRECTION so GT3 returns a revised draft incorporating it.
   * Per Wireframe §5.6.1.
   * @param {object} state - Current app state
   * @param {string} l3Label - The clicked L3 ribbon label (semantic direction)
   * @returns {string}
   */
  function buildDraftNarrativeForL3(state, l3Label) {
    if (!state) return "";
    const base = buildLexiomNarrative(state);
    const direction = (typeof l3Label === "string" ? l3Label : "").trim() || "user's chosen direction";
    const inject =
      "\n\nSEMANTIC_DIRECTION: The user chose this L3 statement: \"" +
      direction +
      "\". Incorporate this semantic direction into your revision. Return only the revised text (identity, action, or document as appropriate).";
    return base + inject;
  }

  /**
   * Build narrative for a short (3–7 word) chat acknowledgment when user clicked an L3 in a Chat activity.
   * Per Wireframe §5.6.1: "The semantic direction is appended as a system directive, and GT3 is requested to produce a 3–7 word acknowledgment."
   * @param {object} state - Current app state
   * @param {object} active - activeActivity (type, topicIndex, actionItemId)
   * @param {string} l3Label - The clicked L3 ribbon label
   * @returns {string}
   */
  function buildChatAckForL3(state, active, l3Label) {
    if (!state || !active) return "";
    const direction = (typeof l3Label === "string" ? l3Label : "").trim() || "this direction";
    const lines = [
      "You are Lexiom (demo cockpit).",
      "The user has chosen an L3 semantic direction for the current conversation: \"" + direction + "\".",
      "TASK: Acknowledge that you will adopt this refined direction for the conversation.",
      "OUTPUT: Return only a 3–7 word acknowledgment. No preamble, no labels.",
    ];
    return lines.join("\n");
  }

  /**
   * Build narrative to infer a single-word label meaning "Questions:" in the current interface language.
   * Used as the title for L2a/L2b chat when bound to the center playfield.
   * @param {object} state
   * @returns {string}
   */
  function buildL2QuestionsLabelNarrative(state) {
    if (!state) return "";
    const seedNarrative =
      (state.case && state.case.narrative && String(state.case.narrative).trim()) || "";

    const lines = [
      "You are Lexiom (demo cockpit).",
      "",
      "The interface may be in English or another language.",
      "We need a single word that we can use as a panel title meaning \"Questions:\" in the current interface language.",
      "",
      "CASE_SEED_NARRATIVE:",
      seedNarrative || "(none)",
      "",
      "TASK:",
      "- Propose one word that a thoughtful legal professional would use as a heading for a list of clarifying or strategic questions.",
      "- The word should be in the same language as this interface (if the text above is in Hebrew, answer in Hebrew; if it is in English, answer in English).",
      "- It must semantically match \"Questions:\" as a neutral, professional label.",
      "",
      "OUTPUT: Return only that one word. No punctuation, no quotes, no extra text.",
    ];

    return lines.join("\n");
  }

  /**
   * Build narrative for GT3 to propose the next 3 L3 ribbon statements after the user clicked one.
   * Per Wireframe §5.6.2: L3 Ribbon refresh to the next set of 3 items.
   * @param {object} state - Current app state
   * @param {string} lastLabel - The L3 label that was just clicked (optional context)
   * @returns {string}
   */
  function buildL3RibbonRefreshNarrative(state, lastLabel) {
    if (!state) return "";
    const l1Title = (state.case && state.case.l1_title) || "";
    const stageName =
      (state.stages && state.stages.find((s) => s && s.currentStage) && state.stages.find((s) => s && s.currentStage).name) ||
      "ZENITH";
    const currentL3 = state.l3_ribbon || [];
    const prev = (typeof lastLabel === "string" ? lastLabel : "") || (currentL3[0] || "");
    const lines = [
      "You are Lexiom (demo cockpit).",
      "L1: " + (l1Title || "?"),
      "STAGE: " + stageName,
      "The user just selected this L3 statement: \"" + prev + "\".",
      "TASK: Propose the NEXT three short strategic action labels (2–5 words each) that the user could take from here.",
      "OUTPUT: Return exactly three lines, one label per line, no numbers or bullets.",
    ];
    return lines.join("\n");
  }

  /**
   * Build narrative for L1 refresh when an artifact draft has been approved.
   * Asks GT3 for a title and 9–15 word summary semantically aligned with the case seed,
   * synthesizing the approved artifact's narrative at the tail.
   * @param {string} seedNarrative - Case seed narrative
   * @param {string} artifactTitle - Title of the approved artifact
   * @param {string} artifactNarrative - Approved artifact's card text
   * @returns {string}
   */
  /**
   * Build narrative for L22 bootstrap (round start, post seed approval).
   * Asks GT3 for four L22 subtitles only (exactly one word each). L21 is inferred separately.
   * @param {string} seedNarrative - Case seed narrative
   * @returns {string}
   */
  function buildL22BootstrapNarrative(seedNarrative) {
    const seed = (typeof seedNarrative === "string" ? seedNarrative : "").trim();
    return [
      "You are Lexiom (demo cockpit). Propose four L22 subtitles (exactly one word each) for the four L2 boxes.",
      "",
      "CASE SEED NARRATIVE:",
      seed || "(none)",
      "",
      "TASK: Return exactly four lines, one per box in left-to-right order:",
      "- Box 1: one-word summary of the main tension or friction (not necessarily a legal dispute). Avoid the literal words \"Dispute\" or \"Disputes\"; prefer more general terms such as \"Tension\", \"Issue\", or \"Focus\".",
      "- Box 2: one-word label for the winning end-game goal (e.g. \"Victory\", \"Relief\").",
      "- Box 3: one-word summary of the strategic path to resolution.",
      "- Box 4: one-word summary of agreed facts.",
      "- Language rule: use the same language as CASE SEED NARRATIVE.",
      "",
      "OUTPUT: Return exactly four lines. Each line must contain exactly one word (no spaces). No numbers, bullets, or prefixes.",
    ].join("\n");
  }

  /**
   * Build narrative for L21 bootstrap (round start, post seed approval).
   * Asks GT3 for four L21 titles only (strictly one word each). Run after L22.
   * L21 is fixed for the round; only L22 refreshes thereafter.
   * @param {string} seedNarrative - Case seed narrative
   * @returns {string}
   */
  function buildL21BootstrapNarrative(seedNarrative) {
    const seed = (typeof seedNarrative === "string" ? seedNarrative : "").trim();
    return [
      "You are Lexiom (demo cockpit). Propose four L21 titles. Each must be exactly ONE word.",
      "",
      "CASE SEED NARRATIVE:",
      seed || "(none)",
      "",
      "TASK: Return exactly four lines, ONE WORD per line, in left-to-right order:",
      "- Box 1: one word for tensions (e.g. Tensions, Friction).",
      "- Box 2: one word for goals (e.g. Goals, Aims).",
      "- Box 3: one word for strategy (e.g. Strategy, Approach).",
      "- Box 4: one word for undisputed (e.g. Undisputed, Agreed).",
      "- Language rule: use the same language as CASE SEED NARRATIVE.",
      "",
      "OUTPUT: Exactly four lines. Each line contains only a single word. No phrases, numbers, or bullets.",
    ].join("\n");
  }

  /**
   * Build narrative for L22-only refresh when L1 has changed.
   * Updates only L22 subtitles (exactly one word each); L21 titles remain fixed for the round.
   * @param {string} seedNarrative - Case seed narrative
   * @param {string} l1Title - New L1 title
   * @param {string} l1Summary - New L1 summary
   * @returns {string}
   */
  function buildL22OnlyTopicRefreshNarrative(seedNarrative, l1Title, l1Summary) {
    const seed = (typeof seedNarrative === "string" ? seedNarrative : "").trim();
    const title = (typeof l1Title === "string" ? l1Title : "").trim();
    const summary = (typeof l1Summary === "string" ? l1Summary : "").trim();
    return [
      "You are Lexiom (demo cockpit). L1 has changed; propose refreshed L22 subtitles only (exactly one word each; do not change L21 titles).",
      "",
      "CASE SEED NARRATIVE:",
      seed || "(none)",
      "",
      "NEW L1 TITLE: " + (title || "?"),
      "NEW L1 SUMMARY: " + (summary || "(none)"),
      "",
      "TASK: Return exactly four lines, L22 only (exactly one word per line), one per box:",
      "- Box 1: one-word summary of what is under dispute.",
      "- Box 2: one-word label for the winning end-game goal.",
      "- Box 3: one-word summary of the strategic path to resolution.",
      "- Box 4: one-word summary of agreed facts.",
      "",
      "OUTPUT: Return exactly four lines. No numbers, bullets, or prefixes.",
    ].join("\n");
  }

  /**
   * Build narrative for proposed action item refresh when White Move conclusions warrant it.
   * Asks GT3 for one short sentence (next safe action) given seed, L1, approved actions, and stage.
   * @param {object} state - Current app state
   * @returns {string}
   */
  function buildProposedActionRefreshNarrative(state) {
    if (!state) return "";
    const seed = (state.case && state.case.narrative && String(state.case.narrative).trim()) || "";
    const l1Title = (state.case && state.case.l1_title) || "";
    const l1Summary = (state.case && state.case.l1_summary) || "";
    const currentStage = state.stages && state.stages.find && state.stages.find((s) => s && s.currentStage);
    const stageName = (currentStage && currentStage.name) || "ZENITH";
    const approved = (state.actionItems && state.actionItems.approved) || [];
    const approvedTexts = approved.map((ai) => ai && ai.text).filter(Boolean);
    const l23Cards = state.l23_cards || {};
    const card0 = l23Cards && l23Cards["0"] ? l23Cards["0"] : null;
    const c = state.case || {};
    const approvedL24a = card0 && card0.approved && typeof card0.text === "string" ? String(card0.text).trim() : "";
    const approvedL24b = c.goals_draft_approved && typeof c.goals_draft_text === "string" ? String(c.goals_draft_text).trim() : "";
    const approvedL24c = c.strategy_draft_approved && typeof c.strategy_draft_text === "string" ? String(c.strategy_draft_text).trim() : "";
    const approvedL24d = c.undisputed_draft_approved && typeof c.undisputed_draft_text === "string" ? String(c.undisputed_draft_text).trim() : "";
    const approvedL24Blocks = [];
    if (approvedL24a) approvedL24Blocks.push("APPROVED_L24A_DISPUTES:\n" + approvedL24a);
    if (approvedL24b) approvedL24Blocks.push("APPROVED_L24B_GOALS:\n" + approvedL24b);
    if (approvedL24c) approvedL24Blocks.push("APPROVED_L24C_STRATEGY:\n" + approvedL24c);
    if (approvedL24d) approvedL24Blocks.push("APPROVED_L24D_UNDISPUTED:\n" + approvedL24d);
    const approvedL24Context = approvedL24Blocks.length ? approvedL24Blocks.join("\n\n") : "";
    const lines = [
      "You are Lexiom (demo cockpit) proposing a single next executable step for the user.",
      "",
      "CASE SEED NARRATIVE:",
      seed || "(none)",
      "",
      approvedL24Context ? "APPROVED L24 DRAFTS (living map of the current semantic terrain):\n" + approvedL24Context : "",
      "L1 TITLE: " + (l1Title || "?") + "",
      "L1 SUMMARY: " + (l1Summary || "(none)"),
      "",
      "STAGE: " + stageName,
      "",
      approvedTexts.length > 0 ? "APPROVED ACTIONS SO FAR:\n" + approvedTexts.join("\n") + "\n" : "",
      "INVOCATION PRINCIPLE:",
      "- Do not ask for strategy in the abstract, and do not propose motion without intention.",
      "- Use the approved L24 drafts as the living map; they define the factual substrate and the strategic direction already consented.",
      "",
      "TASK: Propose exactly one next executable step (Proposed Action) that advances the user's negotiational objective within this semantic terrain.",
      "",
      "The move must be:",
      "1) Concrete: singular, observable, immediately performable by the user without further decomposition.",
      "2) Situated: arises naturally from the stabilized factual substrate and the strategic direction already consented.",
      "3) Directional: gently shifts the case toward improved negotiational posture.",
      "4) Stage-dependent (pose guidance only, not a prediction):",
      "   - If STAGE is ZENITH: improve posture through frontier probing (test assumptions, surface reactions, or introduce structured uncertainty that reveals flexibility).",
      "   - If STAGE is ACCORD: improve posture through shared-ground consolidation (strengthen mutual clarity, reinforce undisputed anchors, enable jointly acceptable next steps).",
      "",
      "Guardrails:",
      "- Avoid argumentation disguised as instruction (do not resolve the case; do not instruct the user to argue).",
      "- Do not attempt to resolve disagreements; only move the case forward semantically meaningful.",
      "- It is not prediction of success; it is cultivation of negotiational momentum via a disciplined rhythm of small intentional moves.",
      "",
      "OUTPUT: Return only that one sentence, without quotes, numbers, bullet points, or extra commentary. Limit to 16 words or fewer.",
    ];
    return lines.join("\n").replace(/\n{3,}/g, "\n\n");
  }

  function buildL1RefreshFromArtifactNarrative(seedNarrative, artifactTitle, artifactNarrative) {
    const seed = (typeof seedNarrative === "string" ? seedNarrative : "").trim();
    const title = (typeof artifactTitle === "string" ? artifactTitle : "").trim();
    const artText = (typeof artifactNarrative === "string" ? artifactNarrative : "").trim();

    const lines = [
      "You are Lexiom (demo cockpit). An artifact draft has just been approved.",
      "",
      "CASE SEED NARRATIVE:",
      seed || "(none)",
      "",
      "APPROVED ARTIFACT: \"" + (title || "document") + "\"",
      "Artifact narrative (synthesize this into the tail of your proposed case description):",
      artText || "(none)",
      "",
      "TASK: Propose an updated case identity and description.",
      "Line 1: A 1–4 word case identity title semantically aligned with the seed narrative and synthesizing the approved artifact.",
      "Line 2: A 9–15 word summary of the case that integrates the seed and the approved artifact's content at the tail.",
      "OUTPUT: Return exactly two lines. Line 1 = title. Line 2 = summary. No numbers, bullets, or extra commentary.",
    ];
    return lines.join("\n");
  }

  /**
   * Build narrative for GT3 to infer a single-word L22 summary when the draft-first narrative is approved.
   * Weights attention towards Axis 1 (Declared Position) and Axis 2 (Underlying Interests), compressed into one word.
   * @param {object} state
   * @param {number} topicIndex - 0 for L2a (Goals), 1 for L2b (Strategy)
   * @returns {string}
   */
  function buildL22SummaryFromApprovedDraftNarrative(state, topicIndex) {
    if (!state) return "";
    const idx = typeof topicIndex === "number" ? topicIndex : 0;
    const topicKey = l2TopicKeyFromIndex(idx);
    const c = state.case || {};
    const approvedDraft =
      topicKey === "goals"
        ? (c.goals_draft_text || "")
        : (topicKey === "strategy"
          ? (c.strategy_draft_text || "")
          : (topicKey === "disputes"
            ? (((state.l23_cards && state.l23_cards["0"] && typeof state.l23_cards["0"].text === "string") ? String(state.l23_cards["0"].text) : "") || "")
            : (c.undisputed_draft_text || "")));
    const seedNarrative = (c.narrative && String(c.narrative).trim()) || "";
    const threads = state.threads && state.threads.l2Threads ? state.threads.l2Threads : {};
    const key = String(idx);
    const messages = (threads[key] || []);
    const userAnswers = messages.filter(function (m) { return m && m.role === "user"; }).map(function (m) { return m.text || ""; }).filter(Boolean);
    const userGist = userAnswers.length ? userAnswers.join(" | ") : "(no user answers)";

    const axisHint = topicKey === "goals"
      ? "Axis 2 — Underlying Interests (Self): why the user truly wants it (financial, reputational, procedural, emotional, risk-avoidant, etc.). Weight the L22 word toward this lens."
      : (topicKey === "strategy"
        ? "Axis 5–8 (strategy axes): constraints, risks, pathways."
        : "Axis 2 & 4 (Underlying Interests): agreed facts, common ground, shared understanding.");

    const lines = [
      "You are Lexiom (demo cockpit).",
      "",
      "The user has just approved a draft-first narrative. Propose a single-word L22 subtitle summarizing:",
      "1) The full approved draft narrative; 2) The gist of the user's answers in the L2 chat.",
      "",
      "APPROVED_DRAFT:",
      approvedDraft || "(none)",
      "",
      "USER_ANSWERS_GIST:",
      userGist,
      "",
      "STRATEGIC_WEIGHTING: " + axisHint,
      "Your single word should chiefly reflect underlying interests (why they want it), consistent with L23b.",
      "",
      "OUTPUT: Return exactly one word. No period, no label. A compact single-word subtitle suitable as an L2 topic label.",
    ];
    return lines.join("\n");
  }

  /**
   * Build narrative for a Goals draft (L2a).
   * Describes the user's end-game victory conditions, using seed + full L2a chat history.
   * Length: 30–50 words based on case seed complexity.
   * If the last assistant message is an unanswered numbered question, the tail of the draft
   * should be semantically aligned with that question.
   * @param {object} state
   * @param {number} topicIndex
   * @returns {string}
   */
  function buildGoalsDraftNarrative(state, topicIndex) {
    if (!state) return "";
    const seedNarrative =
      (state.case && state.case.narrative && String(state.case.narrative).trim()) || "";

    const threads =
      state.threads && typeof state.threads === "object"
        ? state.threads
        : { l2Threads: {}, actionItemThreads: {} };
    const idx = typeof topicIndex === "number" ? topicIndex : 0;
    const key = String(idx);
    const messages = (threads.l2Threads && threads.l2Threads[key]) || [];

    const historyLines = messages.map(function (msg) {
      if (!msg || !msg.text) return "";
      const role = msg.role === "assistant" ? "Lexiom" : "User";
      return role + ": " + String(msg.text);
    }).filter(Boolean);

    var lastAssistantQuestion = "";
    for (var i = messages.length - 1; i >= 0; i--) {
      var m = messages[i];
      if (m && m.role === "assistant" && m.text) {
        lastAssistantQuestion = String(m.text);
        break;
      }
    }

    const lines = [
      "You are Lexiom (demo cockpit).",
      "",
      "TASK: Draft a concise description of the user's end-game victory conditions for this case, grounded in **Underlying Interests (Self)** (why they want the outcome — needs, stakes, drivers) as surfaced in the L23b chat.",
      "",
      "CASE_SEED_NARRATIVE:",
      seedNarrative || "(none)",
      "",
      // If the L24a / L23a disputes draft has been approved, include it as part of the case context.
      // This gives GT3 the user's agreed disputes narrative alongside the seed.
    ];

    var approvedL24aForGoals = (function () {
      const cards = state.l23_cards || {};
      const card0 = cards["0"];
      if (!card0 || !card0.approved || typeof card0.text !== "string") return "";
      return String(card0.text).trim();
    })();
    if (approvedL24aForGoals) {
      lines.push(
        "APPROVED_L24A_DISPUTES:",
        approvedL24aForGoals,
        ""
      );
    }

    lines.push(
      "L2A_CHAT_HISTORY (Goals lens):",
      historyLines.length ? historyLines.join("\n") : "(no prior chat)",
      "",
      "If there is a recent Lexiom question at the end of the chat, align the tail of your goals draft with that question, anticipating the user's answer.",
      "RECENT_LEXIOM_QUESTION: " + (lastAssistantQuestion || "(none)"),
      "",
      "OUTPUT:",
      "- Write one short paragraph describing what outcome would count as a 'case victory' for the user.",
      "- Length: 30–50 words. Use more words (40–50) if the case seed describes a complex semantic reality; use fewer (30–40) if simpler.",
      "- Use calm, clear language focused on needs and desired end state.",
      "- Do not include bullets, headings, or markup; plain text only.",
    );

    return lines.join("\n");
  }

  /**
   * Build narrative for a Strategy draft (L2b).
   * Describes a short strategic plan expressed via negativa (what the user should refrain from doing),
   * using seed + full L2b chat history. If the last assistant message is an unanswered numbered
   * question, the tail of the draft should be aligned with that question.
   * @param {object} state
   * @param {number} topicIndex
   * @returns {string}
   */
  function buildStrategyDraftNarrative(state, topicIndex) {
    if (!state) return "";
    const seedNarrative =
      (state.case && state.case.narrative && String(state.case.narrative).trim()) || "";

    const threads =
      state.threads && typeof state.threads === "object"
        ? state.threads
        : { l2Threads: {}, actionItemThreads: {} };
    const idx = typeof topicIndex === "number" ? topicIndex : 0;
    const key = String(idx);
    const messages = (threads.l2Threads && threads.l2Threads[key]) || [];

    const historyLines = messages.map(function (msg) {
      if (!msg || !msg.text) return "";
      const role = msg.role === "assistant" ? "Lexiom" : "User";
      return role + ": " + String(msg.text);
    }).filter(Boolean);

    var lastAssistantQuestion = "";
    for (var i = messages.length - 1; i >= 0; i--) {
      var m = messages[i];
      if (m && m.role === "assistant" && m.text) {
        lastAssistantQuestion = String(m.text);
        break;
      }
    }

    const lines = [
      "You are Lexiom (demo cockpit).",
      "",
      "TASK: Draft a short strategic plan for this case expressed via negativa: focus on what the user should refrain from doing in order to protect their interests and move toward resolution.",
      "Within that strategy, explicitly probe for potential evidential misses (missing or weakly supported facts/documents that could materially affect leverage).",
      "",
      "CASE_SEED_NARRATIVE:",
      seedNarrative || "(none)",
    ];

    // Include approved L24a (disputes) and L24b (goals) narratives, if available, as part of the case context.
    (function () {
      const cards = state.l23_cards || {};
      const card0 = cards["0"];
      if (card0 && card0.approved && typeof card0.text === "string") {
        const approvedL24a = String(card0.text).trim();
        if (approvedL24a) {
          lines.push(
            "",
            "APPROVED_L24A_DISPUTES:",
            approvedL24a
          );
        }
      }
      if (state.case && state.case.goals_draft_approved && typeof state.case.goals_draft_text === "string") {
        const approvedL24b = String(state.case.goals_draft_text).trim();
        if (approvedL24b) {
          lines.push(
            "",
            "APPROVED_L24B_GOALS:",
            approvedL24b
          );
        }
      }
    })();

    lines.push(
      "",
      "L2B_CHAT_HISTORY (Strategy lens):",
      historyLines.length ? historyLines.join("\n") : "(no prior chat)",
      "",
      "EVIDENCE_GAP_FOCUS:",
      "- Use only information present in the case seed, approved upstream drafts, and this chat history.",
      "- Do not fabricate facts, documents, dates, witnesses, or legal claims.",
      "- If support appears incomplete, label it as a potential evidential miss (not a confirmed absence).",
      "- Prioritize high-impact evidential misses that could weaken the user's position if unaddressed.",
      "",
      "If there is a recent Lexiom question at the end of the chat, let the tail of your strategic paragraph anticipate and harmonize with that question.",
      "RECENT_LEXIOM_QUESTION: " + (lastAssistantQuestion || "(none)"),
      "",
      "OUTPUT:",
      "- Write one short paragraph (3–6 sentences) describing the strategic path via negativa (what to avoid, what not to escalate, what not to concede prematurely).",
      "- Include one compact sentence in that paragraph that names the highest-impact potential evidential miss and what evidence the user should gather next.",
      "- Do not list bullet points; keep it as one coherent paragraph.",
      "- Do not give legal advice or make promises of outcome; stay at the level of strategic posture."
    );

    return lines.join("\n").replace(/\n{3,}/g, "\n\n");
  }

  window.lexiomBuildNarrative = buildLexiomNarrative;
  window.lexiomBuildL2ChatNarrative = buildL2ChatNarrative;
  window.lexiomBuildActionItemChatNarrative = buildActionItemChatNarrative;
  window.lexiomBuildArtifactFilenameNarrative = buildArtifactFilenameNarrative;
  window.lexiomBuildArtifactContentNarrative = buildArtifactContentNarrative;
  window.lexiomBuildDraftNarrativeForL3 = buildDraftNarrativeForL3;
  window.lexiomBuildChatAckForL3 = buildChatAckForL3;
  window.lexiomBuildL3RibbonRefreshNarrative = buildL3RibbonRefreshNarrative;
  window.lexiomBuildL1RefreshFromArtifactNarrative = buildL1RefreshFromArtifactNarrative;
  window.lexiomBuildL22BootstrapNarrative = buildL22BootstrapNarrative;
  window.lexiomBuildL21BootstrapNarrative = buildL21BootstrapNarrative;
  window.lexiomBuildL22OnlyTopicRefreshNarrative = buildL22OnlyTopicRefreshNarrative;
  window.lexiomBuildProposedActionRefreshNarrative = buildProposedActionRefreshNarrative;
  window.lexiomBuildGoalsDraftNarrative = buildGoalsDraftNarrative;
  window.lexiomBuildStrategyDraftNarrative = buildStrategyDraftNarrative;
  window.lexiomBuildL2QuestionsLabelNarrative = buildL2QuestionsLabelNarrative;
  window.lexiomBuildL22SummaryFromApprovedDraftNarrative = buildL22SummaryFromApprovedDraftNarrative;

  /**
   * Build narrative for GT3 to identify agreed/undisputed semantic items from case narrative + L24d chat.
   * Output: plain text, one line per item, format "agreed fact" — basis.
   * Tone: appreciation, thankfulness, self-compassion.
   * @param {object} state - Current app state
   * @param {number} topicIndex - 3 for undisputed
   * @returns {string}
   */
  function buildUndisputedDraftNarrative(state, topicIndex) {
    if (!state) return "";
    const seedNarrative =
      (state.case && state.case.narrative && String(state.case.narrative).trim()) || "";
    const threads =
      state.threads && typeof state.threads === "object"
        ? state.threads
        : { l2Threads: {}, actionItemThreads: {} };
    const key = String((typeof topicIndex === "number" ? topicIndex : 3));
    const messages = (threads.l2Threads && threads.l2Threads[key]) || [];

    const historyLines = messages.map(function (msg) {
      if (!msg || !msg.text) return "";
      const role = msg.role === "assistant" ? "Lexiom" : "User";
      return role + ": " + String(msg.text);
    }).filter(Boolean);

    const lines = [
      "You are Lexiom (demo cockpit).",
      "",
      "CASE_SEED_NARRATIVE:",
      seedNarrative || "(none)",
    ];

    // Include approved upstream drafts (L24a/L24b/L24c) as part of the context for undisputed facts.
    appendApprovedDraftContextLines(lines, state, { l24a: true, l24b: true, l24c: true });

    lines.push(
      "",
      "L24D_CHAT_HISTORY (undisputed / common-ground lens):",
      historyLines.length ? historyLines.join("\n") : "(no prior chat)",
      "",
      "TASK: Identify leverage-bearing undisputed facts — fact cores that are not challenged in the case seed or approved upstream drafts, and whose admission may improve the user's negotiation posture as the case moves toward shared agreements.",
      "Use case seed + APPROVED_L24A_DISPUTES + APPROVED_L24B_GOALS + APPROVED_L24C_STRATEGY as constraints (approved-only). If present, use L24D chat history as supporting evidence.",
      "HARD_EXCLUSION: Never list as undisputed any fact core that APPROVED_L24A_DISPUTES already treats as disputed, rephrased, or paraphrased (same underlying issue). If L24A names a quantity conflict, that quantity is not undisputed.",
      "CONFLICTING_QUANTITIES: If the case seed (or L24A) shows conflicting figures for the same underlying measurement (e.g. two asserted security deposit amounts), do not state either figure alone as undisputed. Prefer omitting that item, or one neutral line that both sides assert different amounts with brief attribution—never one party's number as shared truth.",
      "Include other facts that appear unchallenged in the seed; for non-quantitative facts, explicit bilateral confirmation is not required.",
      "Prefer tight leverage-bearing anchors over broad procedural inventories.",
      "When a fragment mixes fact and interpretation, extract only the stable fact core.",
      "Exclude advocacy, legal conclusions, emotional framing, party repetition ('my client consistently says X'), and argumentative claims disguised as facts.",
      "For each item, quote the fact core and briefly explain why it appears unchallenged and leverage-bearing.",
      "",
      "TONE: Oscillate between appreciation (for what is shared), thankfulness (for clarity), and self-compassion (gentle acknowledgment). Use warm, reflective language in any inline notes.",
      "",
      "OUTPUT: Return plain text. One item per line. Each line: \"fact\" — brief basis for why it appears unchallenged and leverage-bearing.",
      "No numbers, bullets, or JSON. Example:",
      "\"lease started March 1\" — Not contradicted upstream; anchors timing and notice posture."
    );

    return lines.join("\n");
  }

  window.lexiomBuildUndisputedDraftNarrative = buildUndisputedDraftNarrative;

  /**
   * Build narrative for GT3 to identify disputed semantic items from case narrative + L24a chat.
   * Output: plain text, one line per item, format "quote" — basis.
   * @param {object} state - Current app state
   * @returns {string}
   */
  function buildDisputesAnalysisNarrative(state) {
    if (!state) return "";

    const seedNarrative =
      (state.case && state.case.narrative && String(state.case.narrative).trim()) || "";
    const threads =
      state.threads && typeof state.threads === "object"
        ? state.threads
        : { l2Threads: {}, actionItemThreads: {} };
    const messages = (threads.l2Threads && threads.l2Threads["0"]) || [];

    const historyLines = messages.map(function (msg) {
      if (!msg || !msg.text) return "";
      const role = msg.role === "assistant" ? "Lexiom" : "User";
      return role + ": " + String(msg.text);
    }).filter(Boolean);

    const lines = [
      "You are Lexiom (demo cockpit).",
      "",
      "CASE_SEED_NARRATIVE:",
      seedNarrative || "(none)",
      "",
    ];

    // Use approved upstream drafts as primary constraints so L24a can be inferred
    // even when the corresponding L23a chat history is empty or absent.
    appendApprovedDraftContextLines(lines, state, { l24b: true, l24c: true });

    lines.push(
      "L24A_CHAT_HISTORY (disputes lens, optional):",
      historyLines.length ? historyLines.join("\n") : "(no prior chat)",
      "",
      "TASK: Identify all disputed semantic items — statements or elements that could reasonably be regarded as factual by one party yet fictional, exaggerated, or incorrect by another.",
      "Use the case seed plus any approved upstream drafts as constraints. If present, also use the disputes-lens chat history as additional evidence.",
      "For each item: quote the relevant fragment, then briefly explain the potential basis for dispute.",
      "",
      "OUTPUT: Return plain text. One item per line. Each line: \"quote\" — brief basis for dispute.",
      "No numbers, bullets, or JSON. Example:",
      "\"damages I didn't cause\" — Landlord may claim damages; tenant asserts otherwise. Factual dispute over causation.",
    );

    return lines.join("\n");
  }

  window.lexiomBuildDisputesAnalysisNarrative = buildDisputesAnalysisNarrative;
})();
