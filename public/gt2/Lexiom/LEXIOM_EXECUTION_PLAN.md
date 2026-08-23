# Lexiom Wireframe Demo — Execution Plan & Implementation Status

**Status:** Living document  
**Scope:** Bounded strictly to [Lexiom_Wireframe_UI_Spec_1_0.md](./Lexiom_Wireframe_UI_Spec_1_0.md) (no extra features).  
**Constitution:** Center-only execution, White→Black→Stability, no silent moves, draft-only until explicit approval.

---

## 1. Six-Iteration Plan (Summary)

| Iteration | Goal | Key deliverables |
|-----------|------|------------------|
| **1** | Cabinet Frame + Constitution Harness | Full cabinet layout, monochrome skin, seeded state from `meeting_with_client.md`, `dispatchWhiteMove()` only mutation entrypoint, phase machine, event ledger, no timers/polling |
| **2** | Center Activity Router + Draft Card Primitive | Center-only routing for L1 / Proposed Action / Private Artifact; single reusable Draft Card (glyph + label + textarea); glyph 5-state display; navigation and highlight |
| **3** | GT3 Client + Standard White→Black Commit | **Done** (3a client; 3b narrative + glyph-triggered inference; 3c error banner + loading) |
| **4** | Chat Loops (L2 + Approved Action Item Conversation) | **Done** — L2 topic chat and action-item-bound chat in Center; thread isolation; prompt conditioning; Lexiom: prefix |
| **5** | Action Item Lifecycle + Post-Approval Flow | **Done** — Proposed → approved; single proposed slot; approved list latest-first with \<xx %> / \<✓>; artifact creation on approval (AI-bus, GT3 filename + content); completion when linked artifact approved |
| **6** | L3 Restricted Path + Constitution Verification | **Done** — 6a L3 as White Move (aiBusEvent); 6b restricted Black path (Center + L3 ribbon only); 6c compliance verification |
| **7** | Refinements | L2 topics: 3 → 4 (iter 7) |

---

## 2. Current State of Implementation

### Iteration 1 — **Done**
- Cabinet: Top HUD (L1 + L2), Left panel (STAGE, PROPOSED, ACTIONS), Center playfield, Right panel (SHARED + PRIVATE), L3 ribbon (in bottom of center column).
- Monochrome arcade skin; two font tiers (title / content); single font (e.g. Courier New); alignment rules applied.
- Seed narrative loaded from `meeting_with_client.md` at runtime; no hardcoded narrative in JS.
- Constitution Harness v1: `dispatchWhiteMove()` only entrypoint; phase machine STABLE → WHITE_COMMIT → BLACK_RUN → STABLE; direct-mutation detection; append-only event ledger; no timers/polling after load.

### Iteration 2 — **Done**
- **Implemented:**
  - Center-only activity router: clicking L1, Proposed Action content, or a Private Artifact filename opens the corresponding activity in the Center (L1_DRAFT, ACTION_DRAFT, DOC_DRAFT).
  - Single reusable Draft Card: header (glyph + label), editable textarea; glyph states ● / ◯ / ◉ and approved (ring with ✓ inside); glyph click toggles approval via `TOGGLE_APPROVAL` White Move.
  - L1 clone on open: when opening L1 draft with empty card text, current L1 title is copied into the card.
  - Document draft card header shows the document filename (e.g. `meeting_with_client.md`), not generic “DOCUMENT DRAFT”.
  - Active-item highlight: the source item (L1 strip, proposed-action line, or document row) is highlighted when its activity is open in the Center.
  - Layout: no “CENTER PLAYFIELD” title; no bar above L3; draft textarea frame transparent; center column 2× side panels; left panel labels STAGE, PROPOSED, ACTIONS.
  - Draft edits persisted via `EDIT_DRAFT` White Move, updating `case.l1_card.text`, `actionItems.proposed.text`, and `privateArtifacts[].card.text` in-state.
  - Auto-revoke + authorship flags wired: any edit sets `hasUserEdits = true` and revokes `approved` when text changes; LM-seeded drafts (Proposed Action, documents, and cloned L1 draft) set `hasLmDraft = true` so glyphs follow the 5-state model.
  - Focus and caret retention in draft textarea during editing: stable textarea id + restore focus/selection after each `EDIT_DRAFT` re-render.
  - Responsive overflow: artifact names truncate with ellipsis in the right panel; L3 topic buttons stay contained in the center playfield on narrow screens.

### Iteration 3 — **Done** (three implementation steps)

- **Step 3a — GT3 client integration — Done:** Lexiom `gt3-client.js` added (QuoteMe pattern). Endpoint `POST /inference` (override via `?api=...`), headers per spec §7.2. Exposed as `window.lexiomGT3.callGT3(narrative)` and on `window.lexiomDebug`.
- **Step 3b — Narrative builder + approval-triggered inference — Done:** `inference-narratives.js` builds the narrative per wireframe spec §8. Per Lexiom_Temporal_UX_spec_1_0: **glyph approval** (user clicks draft-first glyph to approve) is the White Move completion; Black runs `callGT3(narrative)` and applies the response to the active draft card (L1 / ACTION_DRAFT / DOC_DRAFT). No separate Commit button; approval triggers inference. On GT3 failure, list and draft state are not mutated.
- **Step 3c — Error handling and safety — Done:** On GT3 failure, an error banner appears in the Center Playfield (`ui.inferenceError`); list and draft state are not mutated on failure. A loading indicator ("Inference running…") shows during the GT3 call (`ui.inferencePending`). Error and loading are cleared on success or navigation. Black Move handling remains correct when inference fails (error stored in ui only; ledger logs `inference_error` on catch).

### Iteration 4 — **Done**
- **L2 Chat:** Clicking an L2 topic opens Chat Activity in Center; transcript (You: / Lexiom:), input, SEND/Enter; Commit appends user message then calls GT3 via `buildL2ChatNarrative` and appends assistant reply to `l2Threads[topicIndex]`. Loading and error banner in Center.
- **Action Item Conversation:** Clicking an approved action item opens Action Item Conversation in Center; same chat UI; thread stored in `actionItemThreads[actionItemId]`; prompt built via `buildActionItemChatNarrative` (action text + stage + history).
- Thread isolation per topic and per action item; assistant messages labeled "Lexiom:".

### Iteration 5 — **Done**
- **Proposed → approved:** On glyph approval of the proposed action item, the item moves to `approved[]` with `progress: 0`, `completed: false`, `linkedArtifactId: null`; proposed slot resets to empty. Left panel proposed line shows "> " or "> " + text.
- **Approved list:** Rendered latest-first; each line prefixed with \<xx %> (0–99) or \<✓> when completed. Clicking an approved item opens its conversation in Center (ACTION_CHAT).
- **Artifact creation on approval:** AI-bus event `proposed_action_item_has_been_accepted` published in Black phase; right-panel listener sets `ui.pendingArtifactForAction`. After Black, app calls GT3 for filename (two words, underscore) and for initial narrative content, then dispatches **APPEND_ARTIFACT_FROM_ACTION**; new artifact gets `originActionItemId`, approved item gets `linkedArtifactId`. Fallback title `action_item.md` on failure.
- **Completion:** When the artifact linked to an approved action item has its draft card **approved** (glyph), the action item is marked `completed: true`, progress 100, prefix \<✓>.
- **Document draft view/edit:** Artifact body can be shown in view mode (template placeholders as `lexiom-placeholder` spans, ~50% darker); click to edit (textarea), blur to save and return to view.

### Iteration 6 — **Done** (three implementation steps)

- **Step 6a — L3 click as White Move — Done:** Each L3 ribbon button click calls `dispatchWhiteMove("L3_CLICK", { l3Index, label }, activityContext)`. Phase machine runs WHITE_COMMIT → BLACK_RUN → STABLE; event ledger records the move. aiBusEvent `l3_click` is attached to Black payload; Black-phase consumer in `reduceStateForBlack` stores `lastL3Click: { l3Index, label }` in `ui`. L3 buttons use `lexiom-clickable` class.
- **Step 6b — Restricted Black path for L3-triggered rounds — Done:** When the White Move was **L3_CLICK**, after Black the app runs a restricted path only: (1) **Center Playfield** — GT3 via `buildDraftNarrativeForL3` (L1/ACTION_DRAFT/DOC_DRAFT) or, for **L2_CHAT/ACTION_CHAT**, append L3 label as user message (APPEND_CHAT_MESSAGE), then build narrative with `buildL2ChatNarrative`/`buildActionItemChatNarrative` with `{ l3Continuation: true }` and append substantive Lexiom reply (APPEND_ASSISTANT_MESSAGE); (2) **L3 Ribbon** — GT3 via `buildL3RibbonRefreshNarrative`, then BOOTSTRAP_L3_FROM_GT3. No L1, L2, Left panel, or Right panel updates.
- **Step 6c — No silent mutation + constitution verification — Done:** Audit and compliance checklist added below (§4.1); Iteration 6 complete.

### Iteration 7 — **Refinements**
- **L2 topics 3 → 4:** Default seed, BOOTSTRAP_L2_FROM_GT3, day-zero L2 prompt, and parseL2L3Lines updated to support 4 L2 topics. L3 ribbon remains 3. Fourth default topic: "Options Lens".
- **L2 buttons full-width:** L2 topic buttons scale to fill the HUD ribbon; `#lexiom-top-hud-l2` width 100%, `.lexiom-l2-btn` flex 1 1 0, min-width 0, text wrap; 1ch side padding.
- **L1 second line (summary):** L1 case identity displays two lines: title (1–4 words) and summary (9–15 words). L1 bootstrap prompt asks GT3 for both; BOOTSTRAP_L1_FROM_GT3 accepts `{ title, summary }`; `l1_summary` in case; `.lexiom-l1-summary` styling.
- **L1 listens to artifact approval:** AI-bus event `artifact_draft_approved` published when a private/shared artifact draft is approved; L1 listener sets `pendingL1RefreshFromArtifact`; post-Black GT3 call via `buildL1RefreshFromArtifactNarrative` (seed + artifact narrative tail); REFRESH_L1_FROM_ARTIFACT_APPROVAL updates L1 title/summary.
- **Seed discovery via AI-bus:** INIT_FROM_NARRATIVE replaced by EXTERNAL_ARTIFACT_DISCOVERED White Move; discovery of meeting_with_client.md triggers `external_artifact_ingested` AI-bus event; content treated as approved (artifact card.approved: true); unifies external artifact ingestion with other AI-bus events.
- **Artifact completion prefix (Right panel):** Each artifact name prefixed with `/xx %/ ` (0% initial) or `/✓/ ` (approved/100%); percentage matches correlated action item when linked; format differs from left-panel `<xx %>` / `<✓>`.
- **L1→L2 topic recalculation:** AI-bus event `l1_changed` published on BOOTSTRAP_L1_FROM_GT3 and REFRESH_L1_FROM_ARTIFACT_APPROVAL; L2 listener sets `pendingL2RefreshFromL1`; post-Black GT3 via `buildL2TopicRefreshNarrative` (seed + L1 context); merge new topic labels into `l2_topics` only for vacant indices (no thread); dispatch REFRESH_L2_TOPICS_FROM_L1.

---

## 3. Missing Items (Gap List & Resolutions)

### 3.1 Draft text not persisted into state (Iteration 2) — **Resolved**
- **Spec / DoD:** Edits in the Draft Card textarea should update the underlying draft state (`case.l1_card.text`, `actionItems.proposed.text`, `privateArtifacts[].card.text`) so that re-opening the activity or re-rendering shows the user’s edits.
- **Implementation:** A new `EDIT_DRAFT` White Move updates the appropriate card’s `text` via `reduceStateForWhite`, invoked from the textarea `input` handler. Draft content is now persisted in app state and survives re-render/navigation.

### 3.2 Auto-revoke and authorship flags not wired in state (Iteration 2) — **Resolved**
- **Spec / DoD:** Editing an approved draft auto-revokes approval; user edits set `hasUserEdits = true` so glyph reflects LM+User (◉) when there is LM draft.
- **Implementation:** `EDIT_DRAFT` sets `hasUserEdits = true` and `approved = false` when text changes. Proposed action and document drafts seeded with `hasLmDraft = true`; glyphs follow the 5-state model.

### 3.3 Iteration 3 (three steps)
- **Step 3a:** GT3 client integration (QuoteMe pattern, callable from app; Lexiom-specific tenant `gt2-lexiom-demo` with documented temporary server-side demo key strategy). — **Done**
- **Step 3b:** Narrative builder + glyph-triggered inference (approval = White Move completion); Black Move applies response to active draft. — **Done**
- **Step 3c:** Error banner in Center, no list/draft mutation on failure; optional loading indicator. — **Done**
### 3.4 Iterations 4–6 — **Resolved**
- **Iteration 4:** L2 and action-item chat activities, thread storage (`l2Threads`, `actionItemThreads`), prompt conditioning (`buildL2ChatNarrative`, `buildActionItemChatNarrative`), Center chat UI with Lexiom: prefix. — **Done**
- **Iteration 5:** Approving proposed action item moves it to `approved[]` (progress, completed, linkedArtifactId); new empty proposed slot; approved list latest-first with \<xx %> / \<✓>; clicking approved item opens conversation; artifact creation on approval (AI-bus, GT3 filename + content, APPEND_ARTIFACT_FROM_ACTION); completion when linked artifact approved; document draft view/edit with placeholder styling. — **Done**
- **Iteration 6:** 6a L3 click as White Move — **Done**; 6b restricted Black path — **Done**; 6c no silent mutation + compliance verification — **Done**

---

## 4. Constitution Harness (Current)

- **Single mutation entrypoint:** `dispatchWhiteMove(moveType, payload, activityContext)`.
- **Phase machine:** STABLE → WHITE_COMMIT → BLACK_RUN → STABLE (no mutation outside this flow).
- **Ledger:** Append-only `eventLedger` with `moveId`, `moveType`, `phase`, `timestamp`, `activityContext`, `mutatedKeys`; exposed via `window.lexiomDebug.eventLedger`.
- **Violations:** Direct mutation or dispatch while not STABLE logs/throws `CONSTITUTION_VIOLATION_DIRECT_MUTATION`.

### 4.1 Iteration 6c — Compliance Verification (No Silent Mutation)

| Check | Status |
|-------|--------|
| **State mutation only via `dispatchWhiteMove`** | ✅ `appState` is assigned only in `applyMutation()`, which is called exclusively from `dispatchWhiteMove`. No direct writes elsewhere. |
| **No timers/polling** | ✅ No `setInterval` or `setTimeout` in the Lexiom codebase. |
| **Async GT3 always dispatches White Move** | ✅ All GT3 callbacks (pending artifact, L3 post-Black, L2 chat, action chat, bootstrap) mutate state only by calling `dispatchWhiteMove(...)`. |
| **L3 Black path restricted** | ✅ `reduceStateForBlack` for `L3_CLICK` only sets `ui.lastL3Click` (aiBusEvent consumer). Post-Black L3 block dispatches only: COMMIT_INFERENCE (Center draft), APPEND_CHAT_MESSAGE + APPEND_ASSISTANT_MESSAGE (Center threads), BOOTSTRAP_L3_FROM_GT3 (L3 ribbon), SET_INFERENCE_* / CLEAR_INFERENCE_UI. No L1, L2, Left panel (proposed/stage), or Right panel updates. |
| **Event ledger consistency** | ✅ `logLedgerEntry` called for each phase (WHITE_COMMIT, BLACK_RUN) inside `dispatchWhiteMove`. Ledger append-only; exposed via `window.lexiomDebug.eventLedger`. |
| **Phase machine** | ✅ `phase` changed only inside `dispatchWhiteMove`; `reportDirectMutationViolation` thrown if dispatch or mutation attempted while not STABLE. |

---

## 5. Out of Scope (Explicit)

- Multi-user collaboration; real provenance persistence/export; dashboard/case list.
- Polished visuals beyond monochrome wireframe; full strategic analytics UI.
- Any feature not named in [Lexiom_Wireframe_UI_Spec_1_0.md](./Lexiom_Wireframe_UI_Spec_1_0.md).

---

---

## 6. Recent Achievements (Refinements)

- **Temporal UX alignment:** Glyph approval = White Move completion; Black runs GT3 and applies response to active draft (Commit button removed).
- **Focus retention:** Draft textarea keeps focus and caret during text entry (stable id + restore after `EDIT_DRAFT` re-render).
- **Responsive overflow:** Artifact names and L3 topic buttons stay within panel boundaries on narrow screens (ellipsis truncation, `min-width: 0`, flex containment).
- **Label + layout polish:** Left-panel labels updated to `STAGE / PROPOSED / ACTIONS`; right-panel titles to `SHARED / PRIVATE`; L3 topics shortened to two-word phrases for narrow aspect ratios; Shared placeholder set to `/ SOLO MODE`.
- **Markdown-first seed narrative:** Seed case artifact uses `meeting_with_client.md` and aligns with the Markdown-first provenance policy in `Lexiom_Provenance_Spine_Spec_1_0.md`.
- **Iteration 3 complete:** Steps 3a (GT3 client + demo tenant), 3b (narrative + glyph-triggered inference), 3c (error banner + loading indicator) all implemented; temporary GT3 demo key strategy documented in `LEXIOM_GT3_DEMO_KEY_STRATEGY.md`.
- **Iteration 4 complete:** L2 and action-item chat in Center; thread isolation (`l2Threads`, `actionItemThreads`); narrative builders and prompt conditioning; "Lexiom:" assistant label; APPEND_CHAT_MESSAGE / APPEND_ASSISTANT_MESSAGE.
- **Iteration 5 complete:** Action-item lifecycle (proposed → approved with progress/completed/linkedArtifactId); approved list latest-first with \<xx %> / \<✓>; artifact creation on approval via AI-bus and GT3 (filename + content); completion when linked artifact draft is approved; document draft view/edit with `lexiom-placeholder` styling.
- **Iteration 6 complete:** L3 click as White Move with aiBusEvent; restricted Black path (Center + L3 ribbon only); L3-triggered chat continues conversation with L3 label as user message; compliance verification (no silent mutation, no timers, L3 path restricted, ledger/harness consistent).
- **Iteration 7 (refinement):** L2 proposed topics 3→4; L2 buttons scale to fill HUD ribbon; L1 second line (summary); L1 listens to artifact approval; seed discovery via AI-bus (EXTERNAL_ARTIFACT_DISCOVERED → external_artifact_ingested); L1→L2 topic recalculation (l1_changed, vacant-only merge).

---

*Last updated: Iteration 7 — L1→L2 topic recalculation, seed discovery via AI-bus, L1 artifact listener.*
