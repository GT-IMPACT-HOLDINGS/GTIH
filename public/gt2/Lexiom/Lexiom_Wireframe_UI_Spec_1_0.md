# Lexiom Wireframe UI Specification
## Lexiom_wireframe_UI_spec.md — Demo Cockpit (v0.3) — Monochrome 80’s Arcade + GT2 Draft‑First Micro‑UX

**Status:** Demo Implementation Spec (Engineering)  
**Goal:** Enable the dev team to build a **working single-page Lexiom cockpit** for demo purposes using **HTML + Bootstrap + JavaScript**, with a **monochromatic early-80s arcade UI skin** and **GT2 Draft‑First micro‑UX** compliance.  
**Mode:** **Single Case Cockpit only** (no dashboard).  
**Inference:** Calls GT3 server using the **same QuoteMe client pattern** (`gt3-client.js`) via prompt concatenation → `/inference` → render.  
**Micro‑UX Binding:** All draft-first surfaces MUST follow **GT2_DraftFirst_MicroUX_Spec_v2.0.md** (glyph approval, header-row actions, expansion behavior, auto‑revoke).

**Implementation alignment (wireframe v0.3):** The demo implements the full cabinet (80vw × 80vh, 10% margin all sides); left/right panel scrolling; center playfield scrolls only in chat mode; draft card textarea flex-fills the card with overflow-y auto and no resize; center-only activity routing for L1, Proposed Action, Document draft, L2 Chat, and Action Item Conversation; a single reusable Draft Card with glyph 5-state and approval toggle; draft text persisted via **EDIT_DRAFT**; auto-revoke and authorship flags; active-item highlight; focus/caret retention in the draft textarea; GT3 client; L2 and action-item chat loops with thread isolation and prompt conditioning; action-item lifecycle (approve → approved list, approved list click opens conversation); artifact creation on action approval via AI-bus (`proposed_action_item_has_been_accepted`) with GT3-inferred filename and initial content; progress/completion prefixes on approved action items; template-placeholder styling in artifact view; L3-triggered inference (aiBusEvent `l3_click`, restricted Black path Center + L3 ribbon only); L3 click in chat appends the L3 label as a user message and produces a substantive Lexiom reply (1–3 sentences), not a short acknowledgment. v0.3 addenda: intro sequence (placeholder 6s + Lexiom title 6s); L1 two lines (title + 9–15 word summary); L2 quartet (4 topics); L2 buttons full-width with 1ch side margin; external artifact discovery via EXTERNAL_ARTIFACT_DISCOVERED and external_artifact_ingested; L1 listens to artifact_draft_approved; Right-panel artifact prefix /xx %/ or /✓/; chat stays open during inference with inline "Lexiom: …"; L1→L2 topic recalculation (aiBusEvent `l1_changed`, post-Black GT3 for vacant L2 topics only).

---

## 0. Landing Intro Sequence (v0.3)

On first load and after browser refresh, the Lexiom landing page MUST display an intro sequence **before** the cockpit GUI:

1. **Placeholder image** (`place_holder_colored_image.png`): fade-in from black 2s, hold 2s, fade-out to black 2s (6s total); image occupies up to 90% of viewport.
2. **Lexiom title** (`Lexiom_Title.png`): fade-in from black 2s, hold 2s, fade-out to black 2s (6s total); same sizing.
3. **Lexiom GUI**: rendered after the 12-second sequence.

**Flow:** black → placeholder image → black → Lexiom title → black → cockpit.

---

## 1. Scope (What must exist)

### 1.1 “Full Cabinet” Layout (Must Render)
The SPA must render the full Lexiom Cabinet layout:

- **Top HUD**: L1 Case Identity (two lines: title + summary) + L2 Topic Quartet (4)
- **Left Panel**: Stage Tower + Proposed Action slot + Action Items list (labels: "STAGE", "PROPOSED", "ACTIONS" per v0.2)
- **Center Playfield**: the only execution surface
- **Right Panel**: Shared Harmony (Top) + Private Artifacts (Bottom)
- **Bottom Ribbon**: L3 Quick Statements (3)

> Visual style: **monochrome**, “vector/CRT” feel, thick borders, scanlines hint (CSS only), no gradients, no modern shadows.

**Alignment Rules (MVP Demo — Binding):**

- Top HUD (L1): all L1 labels and text MUST be horizontally centered within the Top HUD envelope.
- Center Playfield L2 row: the L2 topic quartet (4 topics) MUST be horizontally centered within the Center Playfield header band.
- Bottom Ribbon (L3): in this demo implementation, the L3 band is rendered as the bottom strip of the Center Playfield column; all L3 buttons and text MUST be horizontally centered within that strip.
- Left / Center / Right panels: all panel titles, section labels, list items, and body text MUST be left-aligned (English LTR demo target).
- Draft-First cards (Center Playfield) remain left-aligned within Center; only their internal glyph+label follow GT2 Draft-First micro-UX geometry.

- **Top HUD (L1)**: All contents are center-aligned horizontally.
- **Left Panel**: All headings and text are left-aligned (LTR).
- **Center Playfield**: All headings and text are left-aligned (LTR); the L2 topic quartet is centered as a group within the L2 row.
- **Right Panel**: All headings and text are left-aligned (LTR).
- **Bottom Ribbon (L3)**: L3 band sits at the bottom of the Center Playfield column; all L3 buttons are centered as a group; each label is centered.

> Demo layout note: In this v0.3 wireframe implementation, the L2 topic quartet may be in the Top HUD or in a centered strip at the top of the Center Playfield column. L2 topic buttons scale to fill the HUD ribbon width with 1ch margin from the leftmost and rightmost edges. The L3 ribbon is visually attached to the bottom of the Center Playfield column with no separating bar above it.

### 1.2 Four Working Loops (Must Work)
The demo MUST implement these working loops end-to-end:

1) **L1 Identity draft-first loop** (Top HUD click → Center Draft Card → generate/edit/approve)  
2) **L2 Chat loop** (Top HUD L2 click → Center chat → commit → GT3 response)  
3) **Action Item proposal draft-first loop** (Left proposed slot → Center Draft Card → generate/edit/approve)  
4) **Right-side Draft loop** (Right-bottom artifact click → Center Draft Card → generate/edit/approve)

### 1.3 Post-Approval Action Item Chat (Must Work)
After an Action Item is approved, clicking it in the Left panel MUST open an **Action Item Conversation** activity in the Center (chat loop), where GT3 responses are conditioned on the selected Action Item.

### 1.4 Minimum “Round” Simulation (Must Work)
The UI must implement an explicit commit action:
- **Commit (White Move)** triggers:
  - a GT3 inference call (Black Move)
  - updates the UI with returned content (drafts, suggested items, optional L3 refresh)

No background updates. No silent refresh.

---

## 2. GT2 Draft‑First Micro‑UX Binding (Mandatory)

All draft-first surfaces (L1, Action Items & Documents content as seen in the central panel) MUST implement the **GT2 Draft‑First UX** pattern, as follow:

### 2.1 Draft Card Pattern (Required)
Each GT3 output is rendered as a **Draft Card** consisting of:
1) **Header row** (single line):
   - **Glyph** (authorship + approval indicator) at the outer edge
   - **Label** 2 spaces from glyph
2) **Editable textarea** (always enabled by default; except lifecycle locks which are NOT used in this demo)
   - Inline edits are persisted into state via an **EDIT_DRAFT** White Move so that re-opening or re-rendering preserves the user’s text.
   - **Focus and caret** MUST be retained in the draft-first textarea during text entry; after each re-render triggered by an edit, the active textarea receives focus again and the caret/selection is restored so that editing remains fluent.
3) **Downstream gate**: approval unlocks downstream actions (for explicit-approval cards)

### 2.2 Glyph System (5 states) (Required)
Use the exact semantic meaning of glyph states:
- Empty: no glyph
- User-only: ●
- LM-only: ◯
- LM+User edits: ◉
- Approved: ring with check (◯ with ✓ rendered *inside* the ring; see Lexiom_DraftFirst_Widget_Spec_1_0.md and QuoteMe reference)

### 2.3 Approval Interaction (Required)
- Approval is toggled by clicking the **glyph** (NOT a separate “Approve” button).
- Tooltips (optional):
  - not approved: “Click to approve”
  - approved: “Approved — click to unapprove”
- **Edits revoke approval** immediately (auto-revoke), returning glyph to ◯ / ● / ◉ as appropriate.

> Engineering note: This demo UI spec treats **GT2_DraftFirst_MicroUX_Spec_v2.0.md** as the source-of-truth for micro interactions; Lexiom must reuse it rather than re-invent it.

---

## 3. Monochrome Arcade Skin (UI Requirements)

### 3.1 Palette
- Background: near-black
- Foreground (text): monochrome green OR amber (choose one globally)
- Borders / frame: monochrome 1–2px, using a darker shade of the foreground color (approximately 50% lower brightness) so structural lines are more subdued than text.
- Accent: brightness only (no additional colors)

### 3.2 Typography
- Pixel/terminal font preferred; fallback monospace.
- Use uppercase labels sparingly (arcade vibe).

**Demo implementation constraints (v0.2):**

- Single monospace font family is used across the entire cabinet (currently `IBM Plex Mono Condensed` loaded via Google Fonts), with no additional font families mixed in.
- Font sizes are limited to **two tiers**:
  - **Title size**: panel titles and L1 case identity.
  - **Content size**: stage tower lines, shared-harmony placeholders, button labels (L2 + L3), private artifact filenames, and all other body text.

### 3.3 Controls
- Sharp corners, no rounding.
- No icons required beyond ASCII-style glyphs/markers; keep minimal.
- L2 Topic buttons and L3 Quick Statement buttons share the same monochrome border, padding, and font-size so they read as one control family. L3 Quick Statement labels may wrap onto up to **three lines**; all three L3 buttons share the height of the tallest label (shorter labels simply have empty vertical space) so the ribbon remains visually balanced.
- Private Artifacts in the Right panel are rendered as a simple vertical list of filenames (no surrounding card frame or border); clicking a filename still opens the full draft card activity in the Center Playfield. Filenames are rendered in **italic** to visually emphasize their role as artifacts.
- **Active-item highlight:** When the user has opened an activity in the Center (L1, Proposed Action, or a document), the corresponding source item (L1 in Top HUD, proposed-action line in Left panel, or document filename in Right panel) MUST be visually highlighted (e.g. subtle background) so it is clearly associated with the content in the Center Playfield. The Center Playfield background uses the **same highlight tint** as the active source item so the relationship is mirrored in both locations.
- **Draft Card textarea:** The draft-first textarea frame MAY be transparent (no visible border) per implementation; body remains editable. The implementation MUST preserve focus and caret position in the textarea across re-renders caused by draft edits (e.g. stable textarea id + restore focus/selection after EDIT_DRAFT). When the textarea is focused, its border, caret, and selection MUST remain within the monochrome palette (no default blue browser focus ring); in the current demo they are rendered in the same green as the text.

### 3.4 Layout (v0.2 implementation details)
- **Cabinet dimensions:** The cabinet is 80vw × 80vh (10% margin from all viewport edges). Aspect ratio matches the browser window.
- **Scrolling:** Left panel and Right panel have `overflow-y: auto`. Center playfield scrolls only when in **chat mode** (L2 Chat or Action Item Chat); otherwise the activity area does not scroll.
- Center Playfield has no separate “CENTER PLAYFIELD” title; the activity area begins immediately.
- The L3 ribbon has no horizontal bar/rule above it; it sits directly below the Center activity area.
- Center column proportions: center playfield is twice the width of each side panel (e.g. flex 2 : 1 : 1).
- **Draft card textarea:** The draft-first textarea fills the available space within the draft card (flex: 1 1 0, min-height: 0), has `overflow-y: auto` for long content, and `resize: none`. No user resize handle.

### 3.5 Alignment & Layout Classes (Implementation Guidance)

Use Bootstrap (or equivalent CSS) to enforce alignment:

- Top HUD container: `text-center` + flex utilities (`d-flex`, `justify-content-center`, `align-items-center`).
- L1 area: `text-center` (single line), and if it’s a button, keep it centered in its parent.
- L2 trio row: `d-flex justify-content-center gap-*` (all three centered as a group).
- Bottom Ribbon container: `text-center` + `d-flex justify-content-center gap-*` for the 3 L3 buttons.
- Left / Center / Right panel containers: `text-start` + `justify-content-start`.
- Panel titles/labels: `text-start` always.
- Prohibition: do not center-align paragraphs, list items, or card bodies inside Left/Center/Right panels.

### 3.6 Template Placeholders (Document Draft View)
When the Center shows a **Document Draft** in view mode (not edit mode), template placeholders in the artifact markdown MUST be visually distinct. Placeholders are defined as: (a) text inside markdown inline code (backticks), e.g. `` `[insert amount]` ``; (b) optionally, bare bracket phrases `[like this]`. In the view, placeholder spans MUST use a class such as `lexiom-placeholder` and be styled with approximately 50% darker background and 50% darker font than the surrounding text (e.g. relative to `var(--lexiom-frame)` or the panel foreground). Clicking the view switches to edit mode (textarea); blur saves and returns to view.

---

## 4. Data Model (Demo-Only, In-Memory)

### 4.1 Core Objects
- `case`: `{ id, l1_title, l1_summary, l1_card:{text, approved, hasLmDraft, hasUserEdits}, narrative, mode:"ACCORD"|"ZENITH" }`
- `stages[]`: stage names + `currentStage`
- `l2_topics[4]`: objects `{ l21, l22 }` — L21 (evidential title, one word) and L22 (3–5 word subtitle) per topic
- `l3_ribbon[3]`: strings
- `actionItems`:
  - `proposed`: one object with draft-first card state `{ id, text, approved, hasLmDraft, hasUserEdits }`; updated by **EDIT_DRAFT** and **TOGGLE_APPROVAL**.
  - `approved[]`: list of approved action items; each has `{ id, text, progress, completed, linkedArtifactId }` and a bound conversation thread. `progress` is 0–99 (or 100 when completed); `completed` is set true when the linked artifact's draft card is approved; `linkedArtifactId` is set when an artifact is created from this item (see §5.7).
  - `completed[]`: list (optional; completion is represented by `completed: true` on the item in `approved[]`).
- `sharedHarmony[]`: placeholder list (read-only ok)
- `privateArtifacts[]`: list of document artifacts; each has `{ id, title, card, originActionItemId? }` where `card` has the same draft-first shape (`text`, `approved`, `hasLmDraft`, `hasUserEdits`) and is updated by **EDIT_DRAFT** and **TOGGLE_APPROVAL**. `originActionItemId` is set when the artifact was created from an approved action item (§5.7).
- `threads`:
  - `l2Threads[topicId]`: array of `{ role, text }` (user/assistant) per L2 topic.
  - `actionItemThreads[actionItemId]`: array of `{ role, text }` per approved action item.
- `ui` (or equivalent): `editingArtifactId` (id of artifact whose draft is in edit mode in Center); `pendingArtifactForAction` (set in Black phase when a proposed action was just approved, used to drive GT3 filename + content inference and **APPEND_ARTIFACT_FROM_ACTION**); `lastL3Click` (set by AI-bus consumer in Black phase when `l3_click` event is present: `{ l3Index, label }`).

### 4.2 Default Seed Content and External Artifact Discovery (v0.3)

On first load, the demo discovers `meeting_with_client.md` via the **EXTERNAL_ARTIFACT_DISCOVERED** White Move. The artifact-finding act is treated as a White Move completion; content is treated as approved. The AI-bus publishes **external_artifact_ingested** with payload `{ title, content, approved: true }`. Initial state is built from this event.

- A private artifact: `meeting_with_client.md` loaded at runtime (see `./meeting_with_client.md`); artifact card is approved (externally given).
- L1: identity and summary from day-zero GT3 bootstrap (BOOTSTRAP_L1_FROM_GT3 returns two lines: title + 9–15 word summary); L1 draft card is empty until the user opens it, then the title is cloned into the card.
- L2 topics: four `{ l21, l22 }` objects (e.g. “Clarification Lens”, “Impact Lens”, “Resolution Lens”, “Options Lens”); L21 (one word) and L22 (3–5 word subtitle) inferred separately at bootstrap: L22 first, then L21 (post seed approval). L21 fixed per round; only L22 refreshes thereafter.
- L3 ribbon: fixed demo strings (e.g. “Clarify expectations”, “Surface constraints”, “Propose next step”); GT3-based L3 refresh on each L3 click via **BOOTSTRAP_L3_FROM_GT3** (buildL3RibbonRefreshNarrative).
- Proposed Action Item: one draft object seeded with placeholder text (e.g. “PROPOSED ACTION draft (seeded from case narrative).”) with `hasLmDraft: true`; GT3-generated proposal is a later iteration.
- Document draft: the narrative file content is loaded at runtime (e.g. via `fetch`) and injected into the first private artifact’s card as initial text; no hardcoded narrative in JS.

**Demo implementation note:** The wireframe loads the case narrative from `meeting_with_client.md` at runtime and builds initial state. Day-zero AI-bus bootstrap (see §4.3) populates L1, Proposed Action, L2 topics, and L3 ribbon. L2 bootstrap is sequential (L22 first, then L21); L1, Action, and L3 may run in parallel. L3 ribbon is refreshed on each L3 click via buildL3RibbonRefreshNarrative and BOOTSTRAP_L3_FROM_GT3.

### 4.3 Day-Zero AI-Bus Bootstrap

After initial state is built from the seed narrative (§4.2), the demo MAY run a **day-zero AI-bus bootstrap**: multiple GT3 inference requests that populate L1, Proposed Action, L2 topics, and L3 ribbon from the same narrative. These act as **AI-bus listeners** that consume the seed narrative and write into app state via White Moves.

**Listeners (day-zero):**

| Listener | State target | White Move | Description |
|----------|--------------|------------|-------------|
| L1 Case Identity | `case.l1_title`, `case.l1_summary`, `case.l1_card` | **BOOTSTRAP_L1_FROM_GT3** | Two lines: (1) 1–4 word title, (2) 9–15 word summary. |
| Proposed Action Item | `actionItems.proposed` | **BOOTSTRAP_ACTION_FROM_GT3** | One short proposed action sentence. |
| L2 Topic Quartet | `l2_topics[4]` | **BOOTSTRAP_L2_FROM_GT3** | Four `{ l21, l22 }` topic labels. Inferred sequentially: L22 (4 subtitles) then L21 (4 one-word titles). L21 fixed per round; only L22 refreshes on later updates. |
| L3 Strategic Action | `l3_ribbon[3]` | **BOOTSTRAP_L3_FROM_GT3** | Three short strategic action labels (Bottom Ribbon). |
| Private Artifact | (optional) | — | In this demo, the first artifact's card is seeded from the narrative text only; no separate GT3 bootstrap is required. |

**Parallel inferencing (required when bootstrap is implemented):**

- L1, Proposed Action, and L3 bootstrap requests MAY be sent in parallel. The **L2 bootstrap** is sequential: L22 inference first, then L21 inference (post seed approval; L21 computed once per round).
- As each inference response arrives, the implementation MUST dispatch the corresponding White Move (e.g. **BOOTSTRAP_L1_FROM_GT3**, **BOOTSTRAP_ACTION_FROM_GT3**, **BOOTSTRAP_L2_FROM_GT3**, **BOOTSTRAP_L3_FROM_GT3**) and re-render the UI. The order in which listeners complete is unspecified; the UI SHALL update progressively as each response is received.
- Failure of one listener's inference MUST NOT prevent other listeners' requests from being sent or their results from being applied; each listener's success or failure is independent (e.g. per-listener catch and log).

**Rationale:** Sending all requests in parallel minimizes time-to-interactive and avoids unnecessary serial latency; the GT3 server handles concurrent `/inference` requests independently. Progressive UI update gives the user earlier feedback as each listener completes.

---

## 5. Interaction Map (What clicks do)

### 5.1 L1 Click (Top HUD) — **Required**
Clicking the L1 title opens **L1 Identity Activity** in Center:
- Render an **L1 Draft Card** (GT2 Draft‑First compliant) with header label “CASE IDENTITY”.
- **Clone on open:** If the L1 Draft Card text is empty, the current L1 title (case identity line) MUST be copied into the card for editing/approval.
- Supports: Generate/Regenerate via GT3 (when implemented), inline editing, glyph approval (explicit gate).

**On approval:** the Top HUD L1 should render the approved text moving forward (still editable if user reopens, but editing auto-revokes approval).

### 5.2 L2 Topic Click (Top HUD)
Opens **Chat Activity** in Center:
- Transcript area (user messages shown as "You:", assistant as "Lexiom:")
- Input field; Commit (SEND / Enter) triggers GT3 and appends assistant message to the same L2 thread.
- Thread isolation: each L2 topic has its own transcript (`l2Threads[topicIndex]`).

**During inference (v0.3):** The chat MUST remain visible. Do NOT replace the transcript with a full-screen "Inference running…" loader. Instead, append an inline typing indicator: **"Lexiom: …"** (with subtle styling, e.g. opacity/italic) at the end of the transcript while `ui.inferencePending` is true.

### 5.3 Proposed Action Item Click (Left Panel) — **Required**
Clicking the **proposed** action item slot opens **Action Item Draft Activity** in Center:
- Render an **Action Item Draft Card** (GT2 Draft‑First compliant).
- The proposed slot in the Left panel MUST always show a single line: "> " when empty, or "> " plus the proposed text when present.
- Supports inline edits, glyph approval.

**On approval:** move the item from `proposed` → `approved[]` (with `progress: 0`, `completed: false`, `linkedArtifactId: null` initially), and create a fresh empty proposed slot. The AI-bus then dispatches **proposed_action_item_has_been_accepted** with the center playfield expression (accepted action id and text). The right-panel private section listens for this event and, after GT3 infers a filename (two words, underscore-separated, e.g. `client_summary.md`) and initial narrative content, creates a new private artifact and links it to the approved item via **APPEND_ARTIFACT_FROM_ACTION** (see §5.7).

### 5.4 Approved Action Item Click (Left Panel) — **Required**
Clicking an **approved** action item opens **Action Item Conversation Activity** in Center:
- A chat transcript bound to that action item (user: "You:", assistant: "Lexiom:").
- User prompt input; Commit triggers GT3 and appends assistant response to `actionItemThreads[actionItemId]`.

**Prompt context MUST include** the selected action item’s approved text and stage label.

**Display:** Approved items are listed latest-first. Each line MUST show a prefix: **\<xx %>** (00–99) while in progress, or **\<✓>** when completed, then the action text. Completion: when the artifact linked to the action item (`linkedArtifactId`) has its draft card **approved** by the user, the action item is marked `completed: true` and the prefix becomes \<✓>.

### 5.5 Private Artifact Click (Right-Bottom)
Opens **Document Draft Activity** in Center:
- Render a **Document Draft Card** (GT2 Draft‑First compliant).
- The card header label MUST show the **document filename** (e.g. `meeting_with_client.md`), not a generic “DOCUMENT DRAFT”.
- **View vs Edit:** When not editing, the artifact body is shown in a **view** that renders template placeholders with distinct styling (see §3.6). Clicking the view enters **edit** mode (textarea); blurring the textarea saves and returns to view.
- **Template placeholders** in the stored markdown use standard markdown inline code (backticks), e.g. `` `[insert amount]` ``; optionally bare brackets `[insert amount]` are also treated as placeholders. In the Center playfield view, placeholder text and background are styled ~50% darker than the rest of the artifact text.
- Edits and approval via glyph in edit mode.

### 5.7 Artifact Creation on Action Approval (AI-Bus)
When a proposed action item is approved (§5.3), the following occurs:
1. **White phase:** The item is appended to `approved[]` with `linkedArtifactId: null`; the proposed slot is reset to empty.
2. **AI-bus:** The event **proposed_action_item_has_been_accepted** is published with payload `{ actionItemId, text }` (the center playfield expression).
3. **Black phase:** The right-panel private section listener sets `ui.pendingArtifactForAction`; no artifact is created in the reducer.
4. **After Black (STABLE):** The app calls GT3 twice (sequentially): first to infer a **filename** (two words, underscore, e.g. `client_summary.md`), then to infer the **initial narrative content** of the artifact from the action item's semantic content. On success, **APPEND_ARTIFACT_FROM_ACTION** is dispatched with `actionItemId`, `inferredTitle`, and `inferredContent`.
5. **APPEND_ARTIFACT_FROM_ACTION (White):** A new artifact is appended to `privateArtifacts` with `title: inferredTitle`, `originActionItemId: actionItemId`, and `card.text: inferredContent` (with `hasLmDraft: true` when non-empty). The approved action item's `linkedArtifactId` is set to the new artifact's id. On GT3 or builder failure, fallback title is `action_item.md` and content is empty.

### 5.6 L3 Ribbon Click (Bottom) — **White Move → Black Move**

Clicking an L3 statement is an **explicit White Move** (move type **L3_CLICK**). The dispatcher attaches an **AI-bus event** `l3_click` with payload `{ l3Index, label }` to the Black-phase payload. The Black-phase consumer sets `ui.lastL3Click`. After Black completes (STABLE), the app runs a **restricted inference path** that updates only Center and L3 ribbon (see §5.6.2). All inference and state updates go through **dispatchWhiteMove**; no silent mutation. See **Lexiom_AI_bus_specification.md** for the AI-bus contract.

### 5.6.1 Semantic Direction Injection (What L3 means)
The clicked L3 label is treated as a **semantic direction** that constrains the next inference output.

- If the **Center is a Draft activity** (L1 / Action Item Draft / Document Draft):  
  The app builds a narrative via **buildDraftNarrativeForL3** (injects `SEMANTIC_DIRECTION`) and calls GT3. On success, **COMMIT_INFERENCE** applies the new draft to the active card.
- If the **Center is a Chat activity** (L2 Topic Chat / Action Item Chat):  
  The app first appends the L3 label as a **user message** (transcript shows "You: [L3 label]"). It then builds the narrative via **buildL2ChatNarrative** or **buildActionItemChatNarrative** with `{ l3Continuation: true }`, calls GT3, and appends the Lexiom reply (a **substantive 1–3 sentence continuation** that incorporates the chosen direction, not a short acknowledgment).
- If the **Center is IDLE**: only the L3 ribbon is refreshed; no Center inference.

### 5.6.2 Black-Move Update Set (Post L3 Click) — *Demo-Minimum*
After an L3 click, the Black Move updates ONLY:

1) **Center Playfield** (the focused activity output, per 5.6.1)  
2) **L3 Ribbon** (refresh to the next set of 3 items)

Hard constraints (demo v1.0):
- **No L1 updates** from an L3 click (no `NEXT_L1` parsing).  
- **No L2 trio updates** from an L3 click (no `NEXT_L2` parsing).  
- **No Left Panel proposed action item updates** from an L3 click.  
- **No Right Panel artifact list updates** from an L3 click (only the focused draft text changes if it is in focus).

---

---

## 6. White Move → Black Move Loop (Demo Contract)

### 6.1 White Moves (Commit + L3 Click)

**Definition (aligned with Lexiom_Temporal_UX_spec_1_0.md §4):** A **White Move** is an *explicit commit action* (Temporal §4.2). It completes when its state mutation has been applied; the Round then enters the **Black Move** phase (§4.1). Typing alone is not a Move. All state changes go through the single mutation entrypoint (e.g. `dispatchWhiteMove`); only explicit commits are White Moves in the Temporal sense.

**White Moves (explicit commits; no central inference triggered):**
- **TOGGLE_APPROVAL** (glyph click in Center — “Approve draft”): toggles the active card’s `approved` flag and updates derived state (e.g. L1 title in Top HUD from the approved card text). The White Move completes when this state update is applied; no central inference is invoked. See §6.3 for listener behavior after the White Move completes.
- **Clicking an L3 Ribbon statement**: White Move that records the semantic direction. Inference (if any) is listener-driven (§6.2, §6.3).

**Other state updates (same entrypoint; not White Moves per Temporal §4.2):**
- **NAVIGATE_ACTIVITY**: opening L1 / Proposed Action / Document draft / L2 Chat / Action Item Conversation in the Center.
- **EDIT_DRAFT**: each change to the draft textarea updates the active card’s `text`, sets `hasUserEdits = true`, and auto-revokes `approved` if the text changed; focus and caret are restored after re-render. Typing dispatches **EDIT_DRAFT** (persists content and authorship) but does not by itself trigger a GT3 call or start a Round.
- **APPEND_CHAT_MESSAGE** / **APPEND_ASSISTANT_MESSAGE**: append user or assistant message to the active chat thread (L2 or action-item); used after commit in Center chat.
- **SET_EDITING_DRAFT**: set `ui.editingArtifactId` when entering or leaving artifact draft edit mode in Center.
- **APPEND_ARTIFACT_FROM_ACTION**: append a new private artifact with inferred title and content and link it to the approved action item (see §5.7); clears `ui.pendingArtifactForAction`.
- **SET_INFERENCE_PENDING** / **SET_INFERENCE_ERROR**: UI state for loading and error display during GT3 calls (e.g. in Center chat).
- **CLEAR_INFERENCE_UI**: clears `ui.inferencePending` and `ui.inferenceError` (used after L3-triggered chat or when Center is IDLE).

### 6.2 Listener-driven Black Move (GT3 Inference)

Per the Temporal model (§4.1), a Round is **White Move → Black Move → Stability**. The White Move completes when its state mutation has been applied; the **Black Move** phase then runs (Temporal §4.3). There is **no central inference call** (e.g. no single `runInferenceBlack()` triggered by every White Move). Instead, **each AI-bus listener** decides for itself whether to run GT3 during the Black Move phase and how to apply the result to its presented content.

- **Inference is triggered by listeners**, not by the White-move dispatcher. When a White Move has completed (commit’s state update applied), one or more listeners may, during the Black Move phase, call `/inference` and update the state they own (e.g. L1 title, Proposed Action text, L2 topics, L3 ribbon, Center draft, chat reply). No listener is required to infer; the Center may choose not to (§6.3).
- **L3 click** and other explicit commits may cause specific listeners to run GT3; the narrative and update set are defined per pathway (e.g. §5.6.1, §5.6.2 for L3).

No state mutation occurs outside a Round (Temporal §4.1, §4.4).

### 6.3 Center playfield and glyph approval (design decision)

**Center playfield content approval (glyph click)** is a White Move (Temporal §4.2: “Approve draft”). It completes when the approval state mutation has been applied; the Round then enters the Black Move phase. The Center does not run inference in response to its own approval:

- The **Center playfield** does **not** react to its own **TOGGLE_APPROVAL** in the Black Move phase by calling GT3 or by replacing the approved draft text. It continues to present the approved content; the approved text remains stable in the Center.
- **Other listeners** may react in the Black Move phase after this White Move has completed: they may call GT3 and recalculate their presented content if their logic requires it (e.g. refresh L2 topics or L3 ribbon based on the newly approved identity). When the approved content is the **Action Item Draft**, the **proposed_action_item_has_been_accepted** AI-bus event is published; the right-panel listener then sets `pendingArtifactForAction` and, after Black, drives GT3 filename + content inference and **APPEND_ARTIFACT_FROM_ACTION** (§5.7). When the approved content is a **Document Draft** (artifact), the **artifact_draft_approved** AI-bus event is published; the L1 listener sets `pendingL1RefreshFromArtifact` and, after Black, drives GT3 via **buildL1RefreshFromArtifactNarrative** (seed + artifact narrative tail), then dispatches **REFRESH_L1_FROM_ARTIFACT_APPROVAL** to update L1 title and summary. When L1 is updated (BOOTSTRAP_L1_FROM_GT3 or REFRESH_L1_FROM_ARTIFACT_APPROVAL), the **l1_changed** AI-bus event is published; the L2 listener sets `pendingL2RefreshFromL1` and, after Black, drives GT3 via **buildL22OnlyTopicRefreshNarrative** (seed + L1 context), then merges **L22 subtitles only** into L2 for vacant topics (L21 titles remain fixed for the round) and dispatches **REFRESH_L2_TOPICS_FROM_L1**. Implementation is listener-specific.

This design removes the previous “central post-approval inference” that overwrote the Center draft with a new GT3 result, and keeps approval semantics clear: the user’s approved text is final in the Center unless the user explicitly starts a new Round that requests inference (e.g. via L3 click or Regenerate).

---

## 7. GT3 Client Integration (QuoteMe Pattern)

### 7.1 Endpoint & Override
- Default endpoint: `POST /inference`
- Override: `?api=<absolute_or_relative_inference_url>`

### 7.2 Headers
Use the QuoteMe header pattern:
- `Content-Type: application/json`
- `X-GT3-Tenant: gt2-quoteme-dev` *(demo default; can be swapped later)*
- `X-GT3-Data-Track: green`
- `X-GT3-Consent-Version: v1`
- Optional API key (localStorage):
  - `X-GT3-OpenRouter-Key`
  - `X-GT3-OpenAI-Key`

### 7.3 Body / Response
Request:
```json
{ "narrative": "<string>" }
```
Response:
```json
{ "response": "<string>" }
```

### 7.4 Error Handling
- Show error banner in Center Playfield
- Do not mutate list state if GT3 fails

---

## 8. Prompt Concatenation (Demo Narrative Format)

### 8.1 Common Narrative Header
Include:
- “You are Lexiom, an arcade engine for structured reasoning inside the Lexiom cabinet.…"
- mode (Zenith/Accord)
- L1 text + approval state
- current stage
- active activity type

### 8.2 Activity Payload Blocks
- L1 identity: current draft + requested revision
- L2 chat: last N turns + new user message (narrative built per active L2 topic)
- Action item draft: current draft + requested revision
- Action item chat: approved action item text + stage + last N turns + new user message (narrative built per active action item)
- Document draft: current doc draft + requested revision

Narrative builders concatenate header, activity payload, and optional strategic hint for the `/inference` request:

- **buildLexiomNarrative** (draft activities)
- **buildL2ChatNarrative** (state, topicIndex, options?) — optional `options.l3Continuation` adds directive for substantive continuation when last user message is L3
- **buildActionItemChatNarrative** (state, actionItemId, options?) — same `l3Continuation` option
- **buildDraftNarrativeForL3** (state, l3Label) — for L3-triggered draft revision (injects SEMANTIC_DIRECTION)
- **buildL3RibbonRefreshNarrative** (state, lastLabel) — for next 3 L3 labels after a click
- **buildArtifactFilenameNarrative** / **buildArtifactContentNarrative** — for artifact creation from approved action
- **buildL1RefreshFromArtifactNarrative** (seedNarrative, artifactTitle, artifactNarrative) — for L1 refresh when an artifact draft is approved
- **buildL22BootstrapNarrative** / **buildL21BootstrapNarrative** (seedNarrative) — for L2 bootstrap (L22 first, then L21)
- **buildL22OnlyTopicRefreshNarrative** (seedNarrative, l1Title, l1Summary) — for L22-only refresh when L1 changes
- **buildL22SummaryFromApprovedDraftNarrative** (state, topicIndex) — for L22 refresh when an L24 draft is approved

Artifact content inference from an approved action uses the action text and stage to request compassionate narrative with backtick-wrapped placeholders for template slots.

### 8.3 Strategic Hint (Short)
Include a short reminder to consider Roy’s 8 axes, but keep response concise.

---

## 9. Non-Goals (Out of Demo Scope)
- Real provenance persistence/replay/export (simulate in the browser's 'local storage' memory)
- Publish/Accept unanimity workflow (placeholders only)
- Multi-user collaboration
- Polished visuals beyond monochrome arcade skin

---

## 10. Deliverables
1) `index.html` (Bootstrap layout)
2) `styles.css` (monochrome CRT skin)
3) `app.js` (state machine + activity renderer + Draft‑First micro‑UX implementation)
4) `gt3-client.js` (reuse QuoteMe module)
5) `inference-narratives.js` (narrative builders: buildLexiomNarrative, buildL2ChatNarrative, buildActionItemChatNarrative, buildDraftNarrativeForL3, buildL3RibbonRefreshNarrative, buildArtifactFilenameNarrative, buildArtifactContentNarrative, buildL1RefreshFromArtifactNarrative, buildL22BootstrapNarrative, buildL21BootstrapNarrative, buildL22OnlyTopicRefreshNarrative, buildL22SummaryFromApprovedDraftNarrative)

**Companion spec:** Lexiom_AI_bus_specification.md defines the AI-bus event envelope and event types (`external_artifact_ingested`, `proposed_action_item_has_been_accepted`, `artifact_draft_approved`, `l3_click`).

---

End of Spec  

