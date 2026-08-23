# Lexiom AI Bus Specification (v1.0)

**Status:** MVP — aligned with current implementation  
**Scope:** Defines the **AI Bus** as the unified inner-communication mechanism between publishers (White Move outcomes) and consumers (Black Move listeners) within the Lexiom cockpit. Applies to **Lexiom Zenith** (solo) and **Lexiom Accord** (shared).  
**Companion Documents:**  
- Lexiom_UX_InterSpec_Constitution_1_0.md — Five-layer architecture; §9 AI Bus contract  
- Lexiom_Temporal_UX_spec_1_0.md — Rounds: White Move → Black Move → Stability  
- Lexiom_Spatial_UX_spec_1_0.md — Cabinet; §9 AI Bus spatial contract for reactive components  
- Lexiom_Provenance_Spine_Spec_1_0.md — Moves, ledger, canonical state  
- Lexiom_Semantic_Arcade_UX_spec_1_0.md — Position→Interest→Proposal; L2/L3 semantic roles  
- Lexiom_Wireframe_UI_Spec_1_0.md — Listener-driven Black Move; L3 click semantics; event payloads  

---

# 1. Purpose of the AI Bus

The AI Bus is the **single conduit** for passing semantic and structural context from **White Move outcomes** to **Black Move listeners**. It ensures:

- **Unified contract:** All publishers emit the same event envelope; all consumers read from that envelope.
- **Temporal alignment:** Events are published only after the White Move has been applied and are consumed strictly during the subsequent Black Move (InterSpec §9; Temporal §4.1).
- **No silent mutation:** The bus carries information; it does not by itself mutate canonical state. Listeners may update only draft/index/UI state during Black, and only within the rules of the Provenance and Temporal specs.

---

# 2. When the Bus Is Used

- **Trigger:** A **White Move** has just been applied (WHITE_COMMIT phase complete); the Round is about to enter **BLACK_RUN**.
- **Publisher:** The single mutation entrypoint (e.g. `dispatchWhiteMove`) decides, based on `moveType` and post-White state, whether to attach an **AI-bus event** to the payload passed into the Black phase.
- **Consumer:** The Black-phase reducer (and any post-Black logic that runs before the next White Move) reads the event and updates only the state it is authorized to update (e.g. `ui.pendingArtifactForAction`, `ui.lastL3Click`), or triggers async work that later dispatches a **new** White Move (e.g. APPEND_ARTIFACT_FROM_ACTION).

No component may mutate **canonical** state based solely on the bus; canonical changes require an explicit White Move (Provenance, Temporal, InterSpec §3).

---

# 3. Event Envelope (Unified Contract)

Every AI-bus event is carried as a single object on the **Black-phase payload**:

| Field    | Type   | Description |
|---------|--------|-------------|
| `type`  | string | Event type identifier; determines which listeners react. |
| `payload` | object | Type-specific data for consumers. |

**Implementation:** The payload passed to the Black-phase reducer includes an optional property `aiBusEvent` with the shape above. If present, listeners branch on `aiBusEvent.type` and read `aiBusEvent.payload`.

---

# 4. Event Types (MVP)

## 4.1 `proposed_action_item_has_been_accepted`

**Published when:** The White Move is **TOGGLE_APPROVAL** with `kind === "ACTION_DRAFT"`, and the approval causes the proposed action item to be moved into the approved list (rising edge: proposed → approved). The last-approved item has no `linkedArtifactId` yet.

**Payload:**

| Field           | Type   | Description |
|----------------|--------|-------------|
| `actionItemId`  | string | Id of the newly approved action item. |
| `text`         | string | Approved action item text (center playfield expression). |

**Consumer (Black phase):** A listener sets `ui.pendingArtifactForAction = { actionItemId, text }`. After the Black phase completes (STABLE), the app uses this to run GT3 for filename and initial content, then dispatches **APPEND_ARTIFACT_FROM_ACTION** (Wireframe §5.7). No artifact is created inside the reducer.

**Companion specs:** Wireframe §5.5, §5.7, §6.2–6.3; Spatial §9; InterSpec §9.

---

## 4.2 `l3_click`

**Published when:** The White Move is **L3_CLICK**. The user has clicked one of the three L3 ribbon statements; the label is the semantic direction for the next inference.

**Payload:**

| Field     | Type   | Description |
|----------|--------|-------------|
| `l3Index`| number | Index of the clicked L3 button (0–2). |
| `label`  | string | The narrative label shown on the button (semantic direction). |

**Consumer (Black phase):** A listener sets `ui.lastL3Click = { l3Index, label }`. Other listeners (e.g. Center Playfield, L3 ribbon) may use this during the same Black phase or in subsequent logic to build GT3 narratives and decide what to update. Per Wireframe §5.6.2, when the round was triggered by an L3 click, the **restricted** update set applies: only Center Playfield and L3 ribbon may be updated by inference; no L1, L2, Left panel, or Right panel updates from this event.

**Companion specs:** Wireframe §5.6, §5.6.1–5.6.2, §6.2; Semantic Arcade (L3 as semantic acceleration); Spatial §9; InterSpec §9.

---

## 4.3 `artifact_draft_approved`

**Published when:** The White Move is **TOGGLE_APPROVAL** with `kind === "DOC_DRAFT"`, and the approval causes the artifact's draft card to become approved (rising edge).

**Payload:**

| Field       | Type   | Description                                    |
|------------|--------|------------------------------------------------|
| `artifactId` | string | Id of the approved artifact.                   |
| `title`    | string | Artifact title (e.g. filename).                |
| `narrative`| string | Approved artifact card text (full narrative).  |

**Consumer (Black phase):** A listener sets `ui.pendingL1RefreshFromArtifact = { artifactId, title, narrative }`. After the Black phase completes, the app calls GT3 with a narrative that synthesizes the case seed and the approved artifact, then dispatches **REFRESH_L1_FROM_ARTIFACT_APPROVAL** to update L1 title and summary. L1 stays semantically aligned with the seed while integrating the artifact at the tail.

---

## 4.4 `external_artifact_ingested`

**Published when:** The White Move is **EXTERNAL_ARTIFACT_DISCOVERED**. Lexiom has discovered an artifact placed externally (e.g. `meeting_with_client.md` in the project directory at bootup). The artifact-finding act is treated as a White Move completion; the content is treated as approved.

**Payload:**

| Field      | Type   | Description                                      |
|------------|--------|--------------------------------------------------|
| `title`    | string | Artifact title (e.g. filename).                   |
| `content`  | string | Full artifact content (approved).                 |
| `approved` | boolean| Always `true` for externally discovered artifacts.|

**Consumer (Black phase):** Optional. The initial case/artifact state is created in the White phase. The event unifies external artifact ingestion with other AI-bus events (e.g. `artifact_draft_approved`). Future listeners may react (e.g. analytics, day-zero bootstrap context).

**Companion specs:** Wireframe §4.2; InterSpec §9.

---

## 4.5 `l1_changed`

**Published when:** The White Move is **BOOTSTRAP_L1_FROM_GT3** or **REFRESH_L1_FROM_ARTIFACT_APPROVAL**, and the L1 title and summary have been updated.

**Payload:**

| Field    | Type   | Description            |
|----------|--------|------------------------|
| `title`  | string | Updated L1 title.      |
| `summary`| string | Updated L1 summary.    |

**Consumer (Black phase):** A listener sets `ui.pendingL2RefreshFromL1 = { title, summary }`. After the Black phase completes, the app determines which L2 topics have empty chat threads (vacant indices), calls GT3 with a narrative that combines the seed and new L1 context, obtains four topic labels, merges them into `l2_topics` only at vacant indices, and dispatches **REFRESH_L2_TOPICS_FROM_L1**. Topics with non-empty threads are unchanged.

**Companion specs:** Wireframe §5.x (L1→L2 topic recalculation); InterSpec §9.

---

# 5. Publisher Rules (Implementation)

- **Where:** Immediately after WHITE_COMMIT has been applied and before BLACK_RUN runs, the dispatcher builds the payload for the Black phase (`blackPayload`). If the White Move implies an AI-bus event, it attaches `blackPayload.aiBusEvent = { type, payload }`.
- **At most one event per Round:** In the current implementation, at most one `aiBusEvent` is attached per Round (external artifact ingestion, action-item acceptance, L3 click, artifact draft approval, or L1 change).
- **No event for other moves:** Moves such as NAVIGATE_ACTIVITY, EDIT_DRAFT, APPEND_CHAT_MESSAGE, etc., do not attach an `aiBusEvent`; the Black phase still runs but no listener is driven by the bus for that Round.

---

# 6. Consumer Rules (Implementation)

- **Where:** The Black-phase reducer (e.g. `reduceStateForBlack`) receives `(draft, moveType, payload)`. It reads `payload.aiBusEvent` and, based on `aiBusEvent.type`, updates only the state it owns (e.g. `draft.ui`).
- **Idempotent reads:** Consumers must not assume that `aiBusEvent` is present. They branch on `aiBusEvent.type` and use defensively typed reads from `aiBusEvent.payload`.
- **No canonical mutation:** Updates in response to the bus are limited to UI/bookkeeping state (e.g. `pendingArtifactForAction`, `lastL3Click`) or to triggering async flows that eventually dispatch a new White Move. The bus never directly appends to `privateArtifacts`, `actionItems.approved`, or other canonical structures; that happens only via explicit White Moves (e.g. APPEND_ARTIFACT_FROM_ACTION).

---

# 7. Relation to Core Specs

| Spec | Relation |
|------|----------|
| **Temporal** | The bus is used only **between** White and Black within a Round. No event is emitted outside a Round; no listener runs outside Black. |
| **Provenance** | The bus does not create or alter Moves. It carries context so that listeners can prepare draft/index state; canonical record changes are White Moves only. |
| **Spatial** | Listening components (Left, Center, Right, Top HUD, Bottom Ribbon) correspond to cockpit panels; the bus is the spatial contract for reactive updates (Spatial §9). |
| **Semantic Arcade** | L3 events carry semantic direction (Position→Interest→Proposal; L3 as acceleration). Reframing and tone remain draft-only until White approval. |
| **InterSpec** | The AI Bus is the engineering contract of InterSpec §9: “When a White commits a Move, the system dispatches an event (AI Bus).” This spec defines the envelope and the MVP event set. |

---

# 8. Extensibility

New event types may be added by:

1. Defining a new `type` string and a `payload` shape.
2. Publishing that event in the dispatcher when the corresponding White Move (and optional state conditions) are satisfied.
3. Adding a consumer branch in the Black-phase reducer or in documented post-Black logic, without mutating canonical state outside White Moves.

Backward compatibility: existing listeners ignore unknown `aiBusEvent.type` values.

---

# 9. One-Sentence Summary

The AI Bus is the unified publisher–consumer channel that carries typed events from White Move outcomes into the Black phase so that listeners can update draft/index/UI state and drive inference (e.g. GT3) without violating Temporal or Provenance rules.

---

*End of Lexiom AI Bus Specification v1.0*
