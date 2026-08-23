### Lexiom AI Bus — Publishers & Consumers Map

This document maps the **currently implemented** relationships between **AI-bus publishers** (White Moves) and **consumers** (Black-phase + post-Black flows) in the Lexiom demo cockpit.

---

### 1. Overview

- **Publishers** live in `dispatchWhiteMove` (around the AI-bus block in `app.js`).
- **Consumers** live in `reduceStateForBlack` and in post-Black helper flows that:
  - Inspect `draft.ui.pending…` fields, then
  - Call GT3, and
  - Dispatch new White Moves (e.g. `APPEND_ARTIFACT_FROM_ACTION`, `REFRESH_L1_FROM_ARTIFACT_APPROVAL`, `REFRESH_L2_TOPICS_FROM_L1`).

At most **one** `aiBusEvent` is attached per Round.

---

### 2. Event Types and Topology (High-Level)

| **Event type**                           | **Published on White Move(s)**                            | **Primary consumer(s)**                                                                                   |
|------------------------------------------|------------------------------------------------------------|------------------------------------------------------------------------------------------------------------|
| `proposed_action_item_has_been_accepted` | `TOGGLE_APPROVAL` (`kind === "ACTION_DRAFT"`)             | Black: sets `ui.pendingArtifactForAction`; post-Black: artifact filename/content inference → `APPEND_ARTIFACT_FROM_ACTION` |
| `l3_click`                               | `L3_CLICK`                                                | Black: sets `ui.lastL3Click`; post-Black: restricted L3 path uses this to build L2/action chat + L3 ribbon refresh         |
| `artifact_draft_approved`                | `TOGGLE_APPROVAL` (`kind === "DOC_DRAFT"`)                | Black: sets `ui.pendingL1RefreshFromArtifact`; post-Black: L1 refresh from artifact → `REFRESH_L1_FROM_ARTIFACT_APPROVAL`  |
| `external_artifact_ingested`             | `EXTERNAL_ARTIFACT_DISCOVERED`                            | No dedicated consumer in `reduceStateForBlack`; handled primarily in White phase (seed bootstrapping)                      |
| `l1_changed`                             | `BOOTSTRAP_L1_FROM_GT3`, `REFRESH_L1_FROM_ARTIFACT_APPROVAL` | Black: sets `ui.pendingL2RefreshFromL1`; post-Black: L2 topic refresh → `REFRESH_L2_TOPICS_FROM_L1`                         |

---

### 3. `proposed_action_item_has_been_accepted`

#### 3.1 Publisher

- **White Move**: `TOGGLE_APPROVAL` with `payload.kind === "ACTION_DRAFT"`.
- **Location**: `dispatchWhiteMove` AI-bus block in `app.js`.
- **Logic**:
  - After applying `TOGGLE_APPROVAL` in White:
    - Reads `stateAfterWhite.actionItems.approved`.
    - Takes the **last approved** action item (if any).
    - If that item has **no `linkedArtifactId`**, publish:

      ```js
      aiBusEvent = {
        type: "proposed_action_item_has_been_accepted",
        payload: { actionItemId, text }
      }
      ```

  - This marks the “rising edge” of an action item being approved and not yet associated with an artifact.

#### 3.2 Consumers

**Black-phase reducer (`reduceStateForBlack`)**

- **Branch**: `if (aiBusEvent.type === "proposed_action_item_has_been_accepted") …`
- **Effect**:
  - Reads `actionItemId` + `text` from the payload.
  - Sets:

    ```js
    draft.ui = {
      ...prevUi,
      pendingArtifactForAction: { actionItemId, text }
    }
    ```

  - This is a **UI/bookkeeping flag**, not a canonical artifact.

**Post-Black flow (artifact creation driver)**

- **Location**: early in `dispatchWhiteMove`, after Black, where it checks `pendingArtifactForAction`.
- **Flow**:
  1. Read `stateAfterBlack.ui.pendingArtifactForAction`.
  2. If present, call GT3 twice using:
     - `lexiomBuildArtifactFilenameNarrative` → filename inference.
     - `lexiomBuildArtifactContentNarrative` → content inference.
  3. After GT3 returns (successful path):
     - Dispatch `APPEND_ARTIFACT_FROM_ACTION` (White Move) with the inferred filename/content, linked to `actionItemId`.
  4. `reduceStateForWhite` handles `APPEND_ARTIFACT_FROM_ACTION` by:
     - Creating a new `privateArtifacts` entry.
     - Updating the approved action item to reference `linkedArtifactId`.
  5. `CLEAR_PENDING_UI`/similar logic clears `pendingArtifactForAction`.

**Net effect**:  
Approving an action item (White) → AI bus event → Black sets pending → post-Black GT3 → new White Move appends a concrete artifact.

---

### 4. `l3_click`

#### 4.1 Publisher

- **White Move**: `L3_CLICK`.
- **Location**: `dispatchWhiteMove` AI-bus block.
- **Logic**:
  - Reads `payload.l3Index` and `payload.label`.
  - Always publishes:

    ```js
    aiBusEvent = {
      type: "l3_click",
      payload: { l3Index, label }
    }
    ```

#### 4.2 Consumers

**Black-phase reducer**

- **Branch**: `else if (aiBusEvent.type === "l3_click") …`
- **Effect**:

  ```js
  draft.ui = {
    ...prevUi,
    lastL3Click: { l3Index, label }
  }
  ```

  This caches the chosen semantic direction for the current Round.

**Post-Black restricted L3 path**

- **Location**: The L3-click handling block in `dispatchWhiteMove` that drives:
  - **Center Playfield** continuation (L2 or action-item chat), and
  - **L3 ribbon** refresh.

- **Flow (summarized)**:
  1. After Black finishes for `L3_CLICK`:
     - If active activity is `L2_CHAT` or `ACTION_CHAT`:
       - Append the L3 label as a **user chat message** (`APPEND_CHAT_MESSAGE`).
       - Build narrative via:
         - `buildL2ChatNarrative(..., { l3Continuation: true })` or
         - `buildActionItemChatNarrative(..., { l3Continuation: true })`.
       - Call GT3 and append Lexiom’s substantive reply (`APPEND_ASSISTANT_MESSAGE`).
  2. In parallel, call `lexiomBuildL3RibbonRefreshNarrative` and run GT3 to get 3 new L3 labels, then:
     - Dispatch `BOOTSTRAP_L3_FROM_GT3` to update `l3_ribbon`.

**Net effect**:  
L3 click (White) → AI bus event → Black stores `lastL3Click` → post-Black uses it to drive a restricted path: chat continuation + L3 ribbon refresh (no L1/L2/left/right-panel updates here).

---

### 5. `artifact_draft_approved`

#### 5.1 Publisher

- **White Move**: `TOGGLE_APPROVAL` with `payload.kind === "DOC_DRAFT"` and `payload.artifactId`.
- **Location**: `dispatchWhiteMove` AI-bus block.
- **Logic**:
  - After White:
    - Locate the artifact in `stateAfterWhite.privateArtifacts` whose `id` matches `payload.artifactId`.
    - If its `card.approved` is **true**, publish:

      ```js
      aiBusEvent = {
        type: "artifact_draft_approved",
        payload: { artifactId, title, narrative }
      }
      ```

    - `narrative` is the approved card text.

#### 5.2 Consumers

**Black-phase reducer**

- **Branch**: `else if (aiBusEvent.type === "artifact_draft_approved") …`
- **Effect**:

  ```js
  draft.ui = {
    ...prevUi,
    pendingL1RefreshFromArtifact: { artifactId, title, narrative }
  }
  ```

**Post-Black L1 refresh driver**

- **Location**: The post-Black block that checks `pendingL1RefreshFromArtifact`.
- **Flow**:
  1. Read `stateAfterBlack.ui.pendingL1RefreshFromArtifact`.
  2. If `artifactId` present:
     - Build a narrative via `lexiomBuildL1RefreshFromArtifactNarrative(seedNarrative, title, narrative)`.
     - Call GT3 to propose new L1 identity + summary.
  3. On success:
     - Dispatch `REFRESH_L1_FROM_ARTIFACT_APPROVAL` (White Move) with the proposed title/summary.
  4. `reduceStateForWhite` updates `case.l1_title` and `case.l1_summary`.
  5. `CLEAR_PENDING_UI` removes `pendingL1RefreshFromArtifact`.

**Net effect**:  
Approving an artifact (White) → AI bus event → Black marks “L1 needs refresh from artifact” → post-Black GT3 → new White Move updates L1.

---

### 6. `external_artifact_ingested`

#### 6.1 Publisher

- **White Move**: `EXTERNAL_ARTIFACT_DISCOVERED`.
- **Location**: `dispatchWhiteMove` AI-bus block.
- **Logic**:
  - Normalizes `title` and `content` from the payload.
  - Publishes:

    ```js
    aiBusEvent = {
      type: "external_artifact_ingested",
      payload: { title, content, approved: true }
    }
    ```

#### 6.2 Consumers

- **Black-phase reducer**:
  - Currently has **no branch** for `external_artifact_ingested`.
  - So the event is effectively **unconsumed** in `reduceStateForBlack`.

- **White-phase handling instead**:
  - The actual seed bootstrap from `meeting_with_client.md` is done directly in `reduceStateForWhite` for `EXTERNAL_ARTIFACT_DISCOVERED`, where:
    - `draft.case`, `draft.stages`, `draft.l2_topics`, `draft.privateArtifacts`, etc. are initialized from the external file.

**Net effect**:  
The event exists to keep ingestion conceptually aligned with other artifact events, but the **canonical work** happens in White; no current listener uses this aiBus event.

---

### 7. `l1_changed`

#### 7.1 Publisher

- **White Moves**:
  - `BOOTSTRAP_L1_FROM_GT3` (initial L1 from seed narrative/GT3)
  - `REFRESH_L1_FROM_ARTIFACT_APPROVAL` (L1 updated because an artifact was approved)

- **Location**: `dispatchWhiteMove` AI-bus block.
- **Logic**:
  - After White:
    - Reads the **current case** from `stateAfterWhite.case`.
    - Normalizes:
      - `title` as `case.l1_title` (or fallback from payload)
      - `summary` as `case.l1_summary` (or fallback)
    - If `title` is non-empty, publishes:

      ```js
      aiBusEvent = {
        type: "l1_changed",
        payload: { title, summary }
      }
      ```

#### 7.2 Consumers

**Black-phase reducer**

- **Branch**: `else if (aiBusEvent.type === "l1_changed") …`
- **Effect**:

  ```js
  draft.ui = {
    ...prevUi,
    pendingL2RefreshFromL1: { title, summary }
  }
  ```

**Post-Black L2 topic refresh driver**

- **Location**: post-Black block that inspects `pendingL2RefreshFromL1`.
- **Flow**:
  1. Read `stateAfterBlack.ui.pendingL2RefreshFromL1`.
  2. If `title` present:
     - Determine which L2 topics are “vacant” (topic indices whose `l2Threads[index]` is empty).
     - Build narrative via `lexiomBuildL2TopicRefreshNarrative(seedNarrative, title, summary)`.
     - Call GT3; parse the 8-line `{ l21, l22 }` outputs into four topics.
     - Merge new topics into `l2_topics` **only at vacant indices**.
  3. Dispatch `REFRESH_L2_TOPICS_FROM_L1` (White Move) with the merged topics.
  4. `reduceStateForWhite` updates `draft.l2_topics` and clears `pendingL2RefreshFromL1`.

**Net effect**:  
L1 changes (White) → AI bus event → Black marks “L2 refresh needed” → post-Black GT3 → new White Move updates L2 topics (without touching existing threads).

---

### 8. Summary Matrix

#### 8.1 Publishers (by White Move)

| **White Move type**                      | **Condition**                                      | **Published `aiBusEvent.type`**                  |
|------------------------------------------|----------------------------------------------------|--------------------------------------------------|
| `TOGGLE_APPROVAL` (ACTION_DRAFT)         | rising edge to approved, no `linkedArtifactId`    | `proposed_action_item_has_been_accepted`         |
| `L3_CLICK`                               | always                                             | `l3_click`                                       |
| `EXTERNAL_ARTIFACT_DISCOVERED`           | payload present                                    | `external_artifact_ingested`                     |
| `BOOTSTRAP_L1_FROM_GT3`                  | `payload.title` / case.l1_title non-empty         | `l1_changed`                                     |
| `REFRESH_L1_FROM_ARTIFACT_APPROVAL`      | same                                               | `l1_changed`                                     |
| `TOGGLE_APPROVAL` (DOC_DRAFT)            | artifact’s card has become approved               | `artifact_draft_approved`                        |

#### 8.2 Consumers (by event type)

| `aiBusEvent.type`                       | **Black reducer effect on `draft.ui`**                               | **Post-Black flows (GT3 + White Moves)**                               |
|-----------------------------------------|------------------------------------------------------------------------|-------------------------------------------------------------------------|
| `proposed_action_item_has_been_accepted` | `pendingArtifactForAction = { actionItemId, text }`                   | Build filename/content → `APPEND_ARTIFACT_FROM_ACTION`                 |
| `l3_click`                              | `lastL3Click = { l3Index, label }`                                   | Restricted Center + L3 ribbon path (chat continuation + ribbon)        |
| `artifact_draft_approved`               | `pendingL1RefreshFromArtifact = { artifactId, title, narrative }`     | L1 refresh narrative → `REFRESH_L1_FROM_ARTIFACT_APPROVAL`             |
| `external_artifact_ingested`            | *(no branch)*                                                         | Seed handling done in `EXTERNAL_ARTIFACT_DISCOVERED` White handler     |
| `l1_changed`                            | `pendingL2RefreshFromL1 = { title, summary }`                         | L2 topic refresh narrative → `REFRESH_L2_TOPICS_FROM_L1`               |

