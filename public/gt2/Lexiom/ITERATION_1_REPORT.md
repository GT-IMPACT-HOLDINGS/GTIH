## Lexiom — Iteration 1 Report (Cabinet Frame + Constitution Harness)

### How to Run

- From the project root, start the GT3 dev server:
  - `npm install` (once, if not already done)
  - `npm start`
- In a browser, open: `http://localhost:8080/public/gt2/Lexiom/index.html`

You should see the Lexiom cabinet with a Top HUD, Left panel, Center playfield, Right panel, and Bottom ribbon.

### What Changed (Scope: Iteration 1 Only)

- **New files** under `public/gt2/Lexiom/`:
  - `index.html`
    - Renders the **full cabinet layout**:
      - Top HUD: L1 Case Identity + L2 Topic Trio (centered horizontally).
      - Left Panel: Stage/Time + Action Items (left-aligned).
      - Center Playfield: execution surface (currently idle placeholder).
      - Right Panel: Shared Harmony (quiet solo placeholder) + Private Artifacts (left-aligned).
      - Bottom Ribbon: L3 Quick Statements (3, centered as a group).
    - Uses Bootstrap utilities only for layout/alignment; no extra behavior.
  - `styles.css`
    - Monochrome arcade skin:
      - Near-black background, green mono foreground, sharp borders, no gradients/shadows beyond a subtle monochrome glow and CRT-like background.
      - Panel borders and cabinet outline consistent with the wireframe spec.
    - Enforces **alignment rules** from `Lexiom_Wireframe_UI_Spec_1_0.md`:
      - Top HUD + L2 trio center-aligned.
      - Bottom Ribbon L3 buttons centered as a group; labels centered.
      - Left / Center / Right panels strictly left-aligned for titles and body text.
  - `app.js`
    - Implements:
      - **In-memory state** with required demo objects:
        - `case`: `{ id, l1_title, l1_card, narrative, mode }`
        - `stages[]`: single Zenith stage with `currentStage: true`
        - `l2_topics[3]`: Clarification / Impact / Resolution lenses
        - `l3_ribbon[3]`: three semantic moves
        - `actionItems`: `proposed`, `approved[]`, `completed[]`
        - `sharedHarmony[]`: empty placeholder (solo mode)
        - `privateArtifacts[]`: one artifact for `meeting_with_client.md`
        - `threads`: `{ l2Threads, actionItemThreads }` (empty in this iteration)
      - **Seed narrative load** from `meeting_with_client.md` at runtime via `fetch`.
      - **Constitution Harness v1**:
        - Phase machine: `STABLE -> WHITE_COMMIT -> BLACK_RUN -> STABLE`.
        - Single mutation entrypoint `dispatchWhiteMove(moveType, payload, activityContext)`.
        - Direct mutation detection + violation logging.
        - No timers or polling after initial load; rendering is event-driven only.
        - Append-only event ledger exposed via `window.lexiomDebug`.

### Proof: Seed Narrative Loaded from `meeting_with_client.md`

- At runtime, `app.js` calls:
  - `fetch("meeting_with_client.md", { cache: "no-store" })`
  - The response text is passed into:
    - `dispatchWhiteMove("INIT_FROM_NARRATIVE", { narrative }, { activity: "INIT" })`
  - There is **no hardcoded copy** of the narrative string in JS.
- The **L1 Case Identity** and **Private Artifacts** reflect this loaded content:
  - `case.l1_title` is derived from the first line of the narrative.
  - `privateArtifacts[0].card.text` is initialized with the full narrative.
- Console proof (open DevTools console on page load):
  - You should see:
    - An info log:
      - `"[LEXIOM_INIT] Seed narrative loaded from meeting_with_client.md, length=<N>"`
    - Two ledger debug entries:
      - `"[LEXIOM_LEDGER]"` with `moveType: "INIT_FROM_NARRATIVE", phase: "WHITE_COMMIT"`
      - `"[LEXIOM_LEDGER]"` with `moveType: "INIT_FROM_NARRATIVE", phase: "BLACK_RUN"`
  - You can also inspect:
    - `window.lexiomDebug.getState().case.narrative` — contains the **full text** loaded from `meeting_with_client.md`.
    - `window.lexiomDebug.eventLedger` — append-only ledger of moves and phases.

This satisfies the requirement that the canonical case narrative is sourced dynamically from `meeting_with_client.md` as the external source-of-truth, without being hardcoded in JavaScript.

