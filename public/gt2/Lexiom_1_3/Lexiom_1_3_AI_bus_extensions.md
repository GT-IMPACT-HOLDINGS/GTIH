# Lexiom 1.3 AI Bus Extensions

**Status:** Active peripheral contract for Lexiom 1.3  
**Companion:** `public/gt2/Lexiom/Lexiom_AI_bus_specification.md`

Lexiom 1.3 reuses the Lexiom 1.0 envelope (`aiBusEvent.type` + `aiBusEvent.payload`) and the same temporal rule: publish after White, consume during Black, run GT3 only after Black completes.

## MVP event: `lens_selected`

**Published when:** White move `SELECT_THEMATIC_LENS`.

**Payload:**

| Field | Type | Description |
|---|---|---|
| `osnId` | string | Selected OSN id |
| `sectionKey` | string | Active center section key |
| `lensId` | string | Selected thematic lens id |

**Black consumer:** sets `ui.pendingLensRefresh`.

**Post-Black:** client calls `POST /inference` through `public/gt2/Lexiom_1_3/gt3-client.js`, then dispatches `APPLY_LENS_DRAFT` as a new White move. Every lens click re-runs inference: the current center draft text is fed back in and the per-`(osnId, sectionKey, lensId)` application pass is advanced, so repeated clicks on the same lens deepen the same draft cumulatively rather than performing a one-shot reframe. `APPLY_LENS_DRAFT` increments `lensIntensityByKey` for that slot.

**Restricted update set:** center draft card, L2 chip selection, and the per-slot intensity counter only. No graph, build, or right-panel mutation in the same round.

## Reserved event: `lens_activity_opened`

Published later when Lexiom 1.3 grows from lens reframing into full conversational L2 lanes. Current build consumes this as a no-op stub.

## MVP event: `causal_lineage_question`

**Published when:** White move `SUBMIT_CAUSAL_QUESTION` while a success evidence artifact is open in the Center Playfield.

**Payload:**

| Field | Type | Description |
|---|---|---|
| `osnId` | string | Focus OSN id |
| `evidenceId` | string | Active success evidence id |
| `questionText` | string | User's causal question scoped to the displayed evidence |

**Black consumer:** sets `ui.pendingCausalLineage`.

**Post-Black:** client calls `POST /inference` through `public/gt2/Lexiom_1_3/gt3-client.js` with inference type `L2_LINEAGE`, then dispatches `APPLY_CAUSAL_ANSWER` as a new White move. Assistant output is non-canonical (Black Move draft only).

**Restricted update set:** L3 causal chat thread (`causalThreadsByEvidenceKey`), causal inference UI flags, and `actionLog` review history only. No OSN draft cards, evidence approvals, graph, or YAML mutation in the same round.

## MVP event: `player_ask`

**Published when:** White move `SUBMIT_PLAYER_ASK` while a success evidence artifact is open and dual-ask capability is unlocked (at least one lineage narrative for that evidence has been glyph-approved).

**Payload:**

| Field | Type | Description |
|---|---|---|
| `osnId` | string | Focus OSN id |
| `evidenceId` | string | Active success evidence id |
| `askText` | string | Player ask (question or action request) scoped to the displayed evidence |
| `forceAction` | boolean | When true, Lexiom detected an imperative change ask and will use the A-only output_spec narrative |

**Black consumer:** sets `ui.pendingPlayerAsk`.

**Post-Black:** client calls `POST /inference` through `public/gt2/Lexiom_1_3/gt3-client.js` with inference type `L2_LINEAGE`. Narrative selection:

- If Lexiom detects a clear imperative change ask (`forceAction: true`, e.g. "change buttons color to green"), it uses `lexiom13BuildOutputSpecChangeNarrative` (A-only: requires `ASK_KIND: A` + `PROPOSED_OUTPUT_SPEC`).
- Otherwise it uses `lexiom13BuildPlayerAskNarrative`. GT3 must return binary `ASK_KIND: Q` or `ASK_KIND: A`.

Routing after the response:

- **Q** — Lexiom dispatches `APPLY_CAUSAL_ANSWER` and presents a Lineage narrative in the center (same draft-first path as `causal_lineage_question`).
- **A** — Lexiom dispatches `APPLY_OUTPUT_SPEC_CHANGE_ANSWER` and presents a Proposed Output Spec draft in the center. Glyph approval of that proposal writes into the Focus OSN `output_spec` draft card (`hasLmDraft: true`, `approved: false`); canonical YAML persist stays on the existing Output Spec section path.

**Restricted update set:** L3 ask thread / findings / proposal state and `actionLog`. OSN `output_spec` draft card is updated only on a later White move (`TOGGLE_OUTPUT_SPEC_CHANGE_APPROVAL`), not in the same inference round.

While unlocked, the ask placeholder becomes: "Keep inquiring or ask for output_spec changes." Submit actions record `askKindPath` / `narrativeBuilder` in `actionLog` for play review. The right L3 panel is labeled **Lexiom proposal**.

## Lane-ready runtime slots

- `selectedLensId`
- `lensMode` (`reframe` today; `conversation` later)
- `lensThreadsByKey`
- `lensDraftsByOsnSection`
- `lensIntensityByKey` (application-pass count per `(osnId, sectionKey, lensId)`)
- `causalThreadsByEvidenceKey` (evidence-scoped causal lineage chat threads keyed by `osnId::evidenceId`)
- `playerAskUnlockedByEvidenceKey` (evidence keys unlocked after lineage narrative approval)
- `latestAskKindByEvidenceKey` (`Q` or `A` for the latest GT3 interpretation)
- `outputSpecChangeByEvidenceKey` (proposed Focus OSN output_spec drafts from ASK_KIND A)

Approved lens drafts may be included as supplemental build input. Transient lens drafts do not alter compilation by default.
