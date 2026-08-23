# Lexiom Deterministic Human–AI Collaboration System
## Technical Disclosure for Provisional Patent Filing

**Document Type:** Technical Disclosure for USPTO Provisional Utility Patent Application  
**Subject Matter:** Systems and methods for consent-driven, deterministic human–AI collaboration through explicit state transitions  
**Status:** Pre-filing disclosure  
**Date:** March 2025  

---

## 1. Field of Invention

The present invention relates to computing systems and methods for governing deterministic human–AI collaboration through explicit state transitions. The invention pertains to the fields of human–computer interaction, distributed computing, collaboration systems, event-driven architectures, and provenance tracking. More particularly, the invention relates to a computing system configured to eliminate silent state mutation by AI components, enforce attribution of all meaningful state changes, and enable deterministic replay of collaboration sessions through an immutable provenance ledger and a strict White Move–Black Move–Stability temporal model.

---

## 2. Background

### 2.1 Limitations of Prior Art

Conventional AI-assisted collaboration tools exhibit several technical limitations:

**Silent AI behavior and background drift:** Prior systems permit AI components to apply changes to canonical state without explicit user consent. Such changes occur asynchronously, in background processes, or in response to triggers not directly attributable to user actions. This makes state transitions difficult to attribute, audit, and replay.

**Lack of structural determinism:** Prior systems do not enforce a strict temporal model that separates user-initiated mutations from AI-generated responses. As a result, collaboration states cannot be deterministically reconstructed from a sequence of recorded events.

**Flat semantic treatment:** Prior drafting and negotiation tools treat user inputs and AI outputs as undifferentiated text, lacking structured semantic layers (e.g., Position, Interest, Constructive Proposal) that would enable systematic transformation and reframing without direct mutation of canonical content.

**No unified provenance:** Prior document collaboration systems often maintain version histories or change logs, but lack an immutable, content-addressed provenance spine that records every atomic contribution, its author, timestamp, and acceptance status in a single ordered ledger.

**Ad hoc spatial layouts:** Prior tools employ floating editors, sidebars, and background update mechanisms that distribute editing surfaces across multiple views. This increases cognitive load and makes state transitions less predictable, as the locus of canonical mutation is unclear.

### 2.2 Prior Art in Event-Driven Systems

Event-driven and reactive architectures exist in prior art (e.g., pub/sub message brokers, reactive programming frameworks). However, prior systems do not combine event dispatch with a strict prohibition on canonical mutation during reactive phases. In prior reactive systems, event handlers may freely mutate shared state, leading to non-deterministic outcomes and difficult audit trails. The invention uniquely couples the Event Dispatch Bus with the White-Black round model such that event consumers may update only draft/index/UI state; canonical mutation is gated exclusively by White Moves.

### 2.3 Prior Art in Provenance and Version Control

Version control systems (e.g., Git) provide immutable commit histories and content-addressed storage. However, they do not distinguish between user commits and AI-generated changes in a structured way, nor do they enforce a publish/accept workflow with unanimous acceptance for shared canonization. The invention extends provenance concepts with explicit Move types, state transitions (DRAFT→PUBLISHED→ACCEPTED), and integration with a temporal model that prevents AI from mutating canonical state.

### 2.5 Conceptual Definitions

The following terms are used throughout this disclosure. Early placement aids patent clarity.

| Term | Definition |
|------|-------------|
| **Canonical State** | The authoritative system state produced by accepted Moves within the provenance ledger. Only qualified user interactions (White Moves) may modify canonical state. |
| **White Move** | An explicit user action that qualifies for canonical state mutation (e.g., approve draft, publish, accept). Typing alone does not qualify. |
| **Black Move** | A system response triggered by a White Move. Generates drafts and recalculates indices. Does not mutate canonical state. |
| **Round** | One cycle of White Move → Black Move → Stability. No canonical mutation may occur outside a round. |
| **Move** | An atomic unit of contribution to the provenance ledger. Immutable; has author, timestamp, parent, action type, artifact reference. |
| **Artifact** | A content-addressed file or derived representation (e.g., document, extracted text) referenced from a Move. |

### 2.6 Technical Objectives

The invention addresses these limitations by providing:

- A **State Transition Engine** that enforces White Move → Black Move → Stability rounds, ensuring no canonical mutation occurs outside explicit user commits.
- An **Event Dispatch Bus** (AI Bus) that carries typed events from White Move outcomes to system components, enabling reactive recalculation without mutating canonical state.
- A **Provenance Ledger Manager** that stores immutable Move objects and content-addressed artifact references in an ordered, auditable structure.
- A **Semantic Transformation Engine** that applies Position→Interest→Constructive Proposal progression to user inputs, producing draft reframings that require explicit White approval before canonization.
- A **User Interface Rendering Engine** with a single execution surface (center playfield) and index-only side panels, eliminating detached editors and floating tools.
- A **Collaboration Control Module** supporting solo (Zenith) and shared (Accord) modes within a unified spatial structure.

### 2.7 Prior Art Distinction and Technical Differentiation

#### Overview

The present invention addresses limitations in existing collaboration, version-control, and event-driven systems by introducing a deterministic, consent-gated state transition architecture for human–AI collaboration. While prior systems may provide elements such as immutable histories, concurrent editing, or event-driven processing, none combine these mechanisms with explicit user-authorized state mutation and AI output governance as disclosed herein.

#### Prior Art Categories Likely Cited

**Version Control Systems (e.g., Git)**

Version control systems provide immutable commit histories and content-addressed storage of artifacts. These systems support branching, merging, and replay of commit histories. However, such systems rely on developer-initiated commits and do not incorporate structured temporal gating between user actions and automated system responses.

In particular, prior version-control systems:
- Allow automated processes (e.g., hooks or CI pipelines) to modify repository state.
- Do not distinguish between user commits and automated modifications in a structured temporal model.
- Do not enforce explicit separation between mutation-authorized phases and system-generated processing phases.

**Real-Time Collaborative Editing Systems (e.g., Google Docs, Operational Transformation, CRDT Architectures)**

Collaborative editors enable multiple users to edit shared documents concurrently. Conflict resolution techniques such as Operational Transformation (OT) or Conflict-Free Replicated Data Types (CRDTs) allow systems to merge concurrent edits and reconcile state divergence.

However, such systems:
- Permit continuous background mutation of shared state.
- Rely on automatic merge and reconciliation mechanisms rather than explicit user-authorized mutation events.
- Do not enforce a deterministic temporal model that separates human-authorized changes from automated system reactions.

**Event-Driven Distributed Systems**

Event-driven architectures and publish–subscribe message brokers (e.g., Kafka, RabbitMQ) allow system components to react asynchronously to events. Event consumers may freely modify shared state in response to messages.

These systems:
- Do not restrict event handlers from mutating shared canonical state.
- Allow asynchronous and non-deterministic mutation patterns.
- Do not incorporate explicit user consent gates before state mutation.

#### Distinguishing Characteristics of the Present Invention

The disclosed system introduces several architectural invariants that distinguish it from the above prior art.

**Consent-Gated Canonical Mutation:** Canonical system state may be modified only through explicit user-authorized interactions ("White Moves"). System-generated operations cannot mutate canonical state without subsequent user authorization.

**Deterministic Round-Based Execution:** The system enforces a temporal model consisting of White Move (user-authorized state mutation), Black Move (system response restricted to draft or index updates), and Stability phase (no state mutation). This round structure prevents asynchronous or background mutation of canonical state.

**Prohibition of Reactive Canonical Mutation:** Event-driven components may generate draft outputs, recalculate indices, or update interface state, but are architecturally restricted from mutating canonical state.

**Serialization of Canonical Transitions:** Rather than relying on merge algorithms used in CRDT or OT systems, canonical transitions are serialized through the White Move qualification mechanism. This reduces the need for complex conflict-resolution procedures and enables deterministic replay.

**Deterministic Replay Anchored to User Authorization:** Because every canonical mutation is attributable to a White Move recorded in the provenance ledger, system state can be deterministically reconstructed by replaying accepted Moves in sequence. Automated system responses remain traceable but non-authoritative until explicitly approved.

#### Technical Implications

These distinctions collectively create a collaboration architecture in which generative AI components operate under explicit governance constraints. Unlike prior systems that allow automated or background mutation of shared state, the invention enforces deterministic, user-authorized state transitions that preserve auditability, traceability, and reproducibility of collaborative processes.

---

## 3. Summary

The invention comprises a computing system configured to govern deterministic human–AI collaboration through explicit state transitions. The system implements a temporal model in which: (a) a White Move is an explicit user commit that qualifies for canonical state mutation; (b) a Black Move is a system response triggered by a White Move, generating drafts and recalculating indices without mutating canonical state; and (c) a Stability phase exists between rounds during which no canonical mutation, metadata drift, or silent recalculation occurs.

The system further comprises: (1) an orthogonal five-layer architecture (Provenance, Temporal, Spatial, Semantic, Strategic) with constitutional invariants; (2) an Event Dispatch Bus (AI Bus) that triggers reactive recalculation in response to White Move outcomes without canonical mutation; (3) a center-playfield-only execution model in which a single surface receives all editing and approval operations; (4) a Position→Interest→Constructive Proposal semantic transformation model for structured reframing; (5) a Git-at-core provenance spine with Draft→Publish→Accept workflow and unanimous acceptance for canonization; and (6) support for solo and shared collaboration modes within a single interface structure.

Figure 1 illustrates the core architecture comprising the State Transition Engine, Event Dispatch Bus, Provenance Ledger, Semantic Transformation Engine, and User Interface. The drawings are set forth in the companion document *Lexiom_Provisional_Patent_Figures_1-11.md* and are incorporated herein by reference for earliest-date priority purposes.

### 3.1 Canonical State — Formal Definition

**Canonical state** refers to the authoritative system state produced by accepted Moves within the provenance ledger. In solo mode, canonical state is derived from Moves accepted by the single user. In shared mode, canonical state is derived from Moves that have achieved unanimous acceptance by all participants. System-generated operations (Black Move) are restricted from modifying canonical state; only explicit user authorization (White Move) may mutate canonical state. Draft outputs, indices, and UI updates produced during Black Move phases are non-canonical until promoted by a subsequent White Move.

---

## 4. System Architecture

In multi-user deployments, multiple clients may submit interactions concurrently, while canonical state mutation remains serialized through the White Move qualification mechanism. Each qualified White Move is applied atomically; overlapping canonical mutations are prevented, reinforcing the concurrency and distributed-systems innovation.

### 4.0 Minimal Embodiment

A minimal implementation of the invention comprises five components. This minimal architecture demonstrates that the disclosure is concrete, not merely conceptual:

| Component | Role |
|-----------|------|
| **User Interface** | Presents content to the user; captures interactions; routes qualified actions to the State Transition Engine. |
| **State Transition Engine** | Detects qualified user interactions (White Moves); applies them to canonical state; triggers Black phase; enforces round boundaries. |
| **Event Dispatch Bus** | Receives White Move outcomes; dispatches events to subscribers; triggers Black Move operations. |
| **Move Ledger** | Stores immutable Move records; derives canonical state from accepted Moves; exports full history. |
| **AI Inference Module** | (Optional) Receives events; generates draft outputs; stores drafts for user review. Does not mutate canonical state. |

This minimal system enforces the core invariant: canonical system state is modified only through qualified user interactions. Additional modules (Semantic Transformation Engine, Collaboration Control, Artifact Storage, etc.) extend the minimal system but are not required for the fundamental temporal model.

### 4.1 State Transition Engine

**Purpose:** Implements the White Move → Black Move → Stability temporal model and enforces that no canonical state mutation occurs outside rounds. See Figure 2 for the state machine diagram.

**Inputs:**
- User interaction events (clicks, keystrokes, selections)
- Canonical state snapshot (from Provenance Ledger Manager)
- Configuration parameters (round boundaries, qualification rules)

**Outputs:**
- Qualification signal indicating whether an interaction qualifies as a White Move
- Round phase identifier (White, Black, Stability)
- State transition triggers for downstream modules

**Internal Data Structures:**
- Round state: `{ phase: WHITE | BLACK | STABILITY, current_move_id: string | null, last_white_timestamp: number }`
- White Move qualification rules: predicates over user interaction types
- Concurrency lock: prevents overlapping Black Moves per White context

**Processing Logic:**
1. Receive user interaction (e.g., mouse click, keyboard input, touch gesture).
2. Evaluate interaction against White Move qualification rules. Qualification criteria may include: (a) interaction type (e.g., approve button, publish button, accept checkbox); (b) context (e.g., draft selected, proposal loaded); (c) user intent (e.g., explicit approval gesture). Typing, scrolling, or selection without approval action does not qualify.
3. If qualified: (a) create or update Move object; (b) apply White Move to canonical state via Provenance Ledger Manager; (c) transition phase to Black; (d) invoke Event Dispatch Bus with White Move outcome.
4. If not qualified: maintain Stability; permit draft/index/UI updates only; do not invoke Event Dispatch Bus for canonical mutation.
5. Execute Black Move operations: (a) Event Dispatch Bus notifies subscribers; (b) Semantic Transformation Engine generates draft reframings; (c) User Interface Rendering Engine recalculates indices; (d) no writes to canonical state.
6. When all Black Move operations complete (e.g., all subscribers acknowledge): transition phase to Stability.
7. Maintain Stability until next qualified White Move; during Stability, no canonical mutation, no metadata drift, no silent recalculation.

### 4.2 Event Dispatch Bus (AI Bus)

**Purpose:** Carries typed events from White Move outcomes into the Black phase so that listening components can recalculate without mutating canonical state. The event dispatcher implements a publish–subscribe queue where system modules register listeners for specific event types. See Figure 3 for the event flow sequence.

**Inputs:**
- White Move outcome (move_id, payload, event_type)
- Subscriber registry (component IDs and event type filters)

**Outputs:**
- Dispatched Event objects to registered consumers
- At most one Event per round

**Event Queue Structure:** A FIFO buffer stores Event objects pending dispatch. Events are enqueued upon White Move completion and dequeued for delivery. The queue supports at-least-once delivery with idempotent handling of duplicate delivery.

**Subscription Model:** System modules register as listeners for specific event types. The registry maps `event_type → [listener_id, callback]`. Listeners may filter by event_type, originating_move, or payload predicates. Wildcard subscriptions (all event types) are supported.

**Asynchronous Dispatch:** Events may be dispatched synchronously (blocking until all subscribers acknowledge) or asynchronously (non-blocking; subscribers process from a queue). In asynchronous mode, the Black phase is considered complete when all subscribers have dequeued and processed the event, or when a configurable timeout elapses.

**Failure Handling:** If a subscriber fails (exception, timeout), the event may be retried (with backoff), logged for manual review, or skipped with failure notification. Canonical state is never mutated by the Event Dispatch Bus or its subscribers; failure affects only draft/index/UI state, preserving system integrity.

**Concurrency Constraints:** At most one Event is dispatched per round. Overlapping Black Moves are prevented by a concurrency lock keyed by (case_id, round_id). Parallel dispatch across different cases or user contexts is permitted. No subscriber may mutate canonical state; this constraint is enforced by architecture, not runtime check.

**Internal Data Structures:**
- Event queue: FIFO buffer of Event objects pending dispatch
- Subscriber list: `{ component_id, event_types[], callback, sync_mode }[]`
- Round-scoped event cache: ensures single event per round
- Concurrency lock: prevents overlapping Black Moves per White context

**Processing Logic:**
1. Receive White Move outcome from State Transition Engine.
2. Acquire concurrency lock for (case_id, round_id).
3. Construct Event object (event_type, payload, originating_move, dispatch_timestamp).
4. Enqueue Event; clear previous round event.
5. Notify all subscribers matching event_type (sync or async per configuration).
6. Subscribers update draft/index/UI state only; no canonical mutation.
7. Release concurrency lock when all subscribers complete or timeout.

### 4.3 Provenance Ledger Manager

**Purpose:** Stores immutable Move objects and content-addressed artifact references; manages Draft→Publish→Accept workflow; exports full ledger for audit. See Figure 4 for the provenance spine data graph and Figure 8 for the Draft→Publish→Accept workflow.

**Inputs:**
- Move objects (from State Transition Engine, Semantic Transformation Engine)
- Artifact references (content hashes, storage pointers)
- Acceptance signals (user approvals for shared mode)

**Outputs:**
- Canonical state derived from accepted Moves
- Full ledger (accepted + unaccepted published Moves)
- Artifact resolution (hash → content retrieval)

**Internal Data Structures:**
- Move store: immutable append-only structure keyed by move_id
- Mainline: ordered sequence of accepted move_ids
- Side paths: published but unaccepted move_ids
- Artifact index: content_hash → storage_pointer mapping

**Processing Logic:**
1. Append Move to Move store; never overwrite.
2. If Move state is DRAFT: keep in private space.
3. If Move state is PUBLISHED: add to shared view; retain in side paths until accepted.
4. If Move state is ACCEPTED: append to mainline; update canonical state.
5. Resolve artifact references via content hash lookup.
6. Support full ledger export (accepted + unaccepted, ordered).

### 4.4 Semantic Transformation Engine

**Purpose:** Applies Position→Interest→Constructive Proposal progression; produces draft reframings that require explicit White approval. See Figure 6 for the semantic transformation pipeline.

**Inputs:**
- User text (position statements, interests, proposals)
- Current semantic context (stage, tone rules, L2 topic)
- Black Move trigger (from Event Dispatch Bus)

**Outputs:**
- Draft reframings (never canonical until White approves)
- Semantic ladder suggestions (Interest extraction, Proposal formulation)
- Tone-adjusted variants (descriptive verbs, problem statements)

**Internal Data Structures:**
- Semantic model: Position, Interest, Constructive Proposal types
- Reframing rules: mappings from aggressive phrasing to neutral/problem-oriented
- Stage calibration parameters
- Eight-Fold Strategic Matrix axes (positions, interests, leverage, risk, pathways)

**Processing Logic:**
1. Parse user input into Position/Interest/Proposal segments.
2. Apply mediator reframing (replace accusation verbs, convert blame to problem statements).
3. Generate draft Constructive Proposals satisfying multiple strategic axes.
4. Output draft-only; no canonical mutation.
5. Await White Move (user approval) to promote any draft to canonical state.

**AI Optional:** In some embodiments, the Semantic Transformation Engine may operate without machine-learning components and instead rely on deterministic transformation rules (e.g., pattern-based reframing, template substitution, rule-based position→interest extraction). AI and machine learning are optional; the invention is not limited to AI-assisted transformation.

### 4.5 User Interface Rendering Engine

**Purpose:** Renders a fixed-layout interface with a single execution surface (center playfield) and index-only side panels. See Figure 5 for the layout.

**Inputs:**
- Layout specification (panel contracts, proportions)
- Entity bindings (panel items → center playfield activities)
- State from Event Dispatch Bus consumers (draft/index/UI state)

**Outputs:**
- Rendered view hierarchy (Top HUD, Left Panel, Center Playfield, Right Panel, Bottom Ribbon)
- User interaction events (clicks, selections) routed to State Transition Engine

**Internal Data Structures:**
- Panel contracts: `{ panel_id, width_pct, entities[], render_rules }`
- Entity binding map: `entity_id → activity_id` (1:1)
- Center playfield as sole editing/approval target

**Processing Logic:**
1. Render Top HUD (L1 identity, L2 topic lenses); fixed height.
2. Render Left Panel (stage tower, proposed actions) as index; no inline editing.
3. Render Center Playfield as sole execution surface; all editing and approvals occur here.
4. Render Right Panel (shared collaboration state index, private artifacts) as index.
5. Render Bottom Ribbon (L3 quick statements); fixed height.
6. On entity click: resolve binding; open bound Activity in Center Playfield.
7. No detached editors, no floating tools, no background mutation.

### 4.6 Collaboration Control Module

**Purpose:** Manages solo (Zenith) vs. shared (Accord) modes; enforces unanimous acceptance for shared canonization. See Figure 11 for the Zenith vs. Accord mode architecture.

**Inputs:**
- Mode selection (Zenith / Accord)
- Participant list (Accord)
- Acceptance signals from each participant
- Published Proposals

**Outputs:**
- Canonical state scope (private vs. shared)
- Acceptance status per Proposal
- Shared board visibility rules

**Internal Data Structures:**
- Mode state: ZENITH | ACCORD
- Participant acceptance matrix: `{ proposal_id → { user_id → accepted } }`
- Unanimous acceptance predicate

**Processing Logic:**
1. In Zenith: canonical state is private only; shared board disabled.
2. In Accord: multiple users have private workspaces; shared board shows published Proposals.
3. Proposal promoted to canonical only when all participants have accepted.
4. No timeout-based canonization; Moves remain pending until explicit acceptance.

### 4.7 L2 Topic Lens and L3 Semantic Acceleration Module

**Purpose:** Provides interpretive lenses (L2) and clickable semantic direction levers (L3) for semantic acceleration without leaving the main workflow. See Figure 9 for the L2/L3 layout and flow.

**Inputs:**
- Current semantic context from Semantic Transformation Engine
- L2 topic options (e.g., Clarification, Impact, Resolution, Options)
- L3 statement templates (three per context)
- Black Move trigger (from Event Dispatch Bus)

**Outputs:**
- L2 topic selection (shifts Center Playfield semantic mode)
- L3 click event (qualifies as White Move; commits semantic direction)
- Restricted Black recalculation scope (Center Playfield + L3 ribbon only; no L1/L2/panel updates)

**Internal Data Structures:**
- L2 topic registry: `{ topic_id, label, semantic_mode }[]`
- L3 statement registry: `{ statement_id, label, semantic_direction, restricted_scope }[]`
- Current L2 selection; L3 visibility rules

**Processing Logic:**
1. During Black Move: derive L2 topics from current context; populate L2 selector.
2. L2 topics stable during White Move; updated only in Black phase.
3. L3 statements: three clickable elements; clicking one qualifies as White Move.
4. On L3 click: commit semantic direction; trigger restricted Black recalculation.
5. Restricted Black: update Center Playfield and L3 ribbon only; skip L1, L2, side panels.
6. Prevents unintended cascade; accelerates semantic flow.

### 4.8 Eight-Fold Strategic Matrix Module

**Purpose:** Operates beneath Position→Interest→Constructive Proposal; enforces multi-axis analysis and optionality preservation. See Figure 10 for the eight-fold strategic matrix axes.

**Inputs:**
- Position and Interest segments from Semantic Transformation Engine
- Eight axes: (1) Declared Position (Self), (2) Underlying Interests (Self), (3) Declared Position (Other), (4) Underlying Interests (Other), (5) Leverage & Constraints (Self), (6) Leverage & Constraints (Other), (7) Risk Surface, (8) Strategic Pathways

**Outputs:**
- Multi-axis completion assessment
- Proposal robustness score (satisfaction across axes)
- Anti-flattening and asymmetry detection signals
- Optionality preservation recommendations

**Internal Data Structures:**
- Axis definitions and completion predicates
- Proposal robustness testing rules
- Escalation gradient parameters

**Processing Logic:**
1. Map Position/Interest segments to relevant axes.
2. Apply multi-dimensional completion bias: expand beyond single-axis framing.
3. Apply anti-flattening: preserve plurality of motivations.
4. Apply asymmetry detection: analytical, non-inflammatory.
5. Test proposal robustness: satisfy multiple axes before publication suggestion.
6. Preserve optionality: avoid premature commitment to single path.

### 4.9 Artifact Storage System

**Purpose:** Content-addressed storage for artifacts; resolves hashes to content; supports Markdown-first policy.

**Inputs:**
- Artifact content (from Move creation, Black Move outputs)
- Content hash (e.g., SHA-256)
- Storage pointer requests

**Outputs:**
- Storage pointer (e.g., object store key, file path)
- Content retrieval by hash
- Artifact metadata (content_type, parent_artifact)

**Internal Data Structures:**
- Object store: content_hash → blob
- Artifact index: artifact_id → { artifact_hash, content_type, parent_artifact, storage_pointer }
- Markdown-first policy: preferred format for canonical narratives

**Processing Logic:**
1. Compute content hash of incoming artifact.
2. Store blob at content-addressed location.
3. Create Artifact index entry with storage_pointer.
4. Support retrieval by hash or artifact_id.
5. Handle parent_artifact for derivation chains.

### 4.10 Five-Layer Orthogonal Architecture

The system enforces an orthogonal five-layer architecture. See Figure 7 for the layer diagram. Each layer has defined invariants; layers do not bypass each other.

**Layer 1 — Provenance (Spine):** Immutable Moves; content-addressed artifacts; Draft→Publish→Accept workflow; unanimous acceptance for canonization; full ledger export. Invariant: No Move is ever edited; only superseded.

**Layer 2 — Temporal:** White→Black→Stability; mutation authority; no silent moves; concurrency bounds (no overlapping Black Moves per White context). Invariant: Canonical mutation only during White phase.

**Layer 3 — Spatial:** Fixed layout; panel contracts; center playfield as sole execution surface; no detached editors or floating tools. Invariant: All editing and approval in center playfield.

**Layer 4 — Semantic:** Position→Interest→Constructive Proposal; mediator reframing; stage calibration; shared-board tone rules. Invariant: Semantic transformation enters record only upon White approval.

**Layer 5 — Strategic:** Eight axes; mandatory behaviors (anti-flattening, asymmetry detection, optionality preservation). Invariant: Proposals tested across multiple axes before publication suggestion.

**Orthogonality Rules:**
- No canonical mutation without a round (Temporal).
- System-generated operations are restricted from modifying canonical state without a subsequent explicit user authorization (Temporal).
- No semantic transformation enters record without explicit White authorization (Semantic).
- All work occurs inside the fixed layout; center-only execution (Spatial).
- Replay reconstructs canonical state (Provenance).

---

## 5. Data Structures

See Figure 4 for the provenance spine data graph showing Move nodes, mainline vs. side paths, and artifact references.

### 5.0 Provenance Spine — Explicit Record Structures (Patent-Oriented)

The following structures are explicit data models suitable for claim support. Patent examiners require concrete structure definitions.

**Move Record**

```
MoveRecord:
  move_id
  parent_move_id
  author_identifier
  timestamp
  move_type
  artifact_reference
  canonical_state_flag
```

The `canonical_state_flag` indicates whether the Move has been accepted into the mainline (i.e., contributes to canonical state). Moves with `canonical_state_flag = true` define the authoritative system state.

**Artifact Object**

```
Artifact:
  artifact_id
  content_hash
  parent_artifact
  storage_pointer
  artifact_type
```

**AI Bus Event**

```
Event:
  event_type
  originating_move
  payload
  dispatch_timestamp
```

### 5.1 Move Object (Full Schema)

A Move is the atomic unit of contribution to the provenance spine. It is immutable once created.

```
Move {
  move_id: string
  parent_move: string | null
  parents: string[]           // zero or more; typically one for linear chains
  author_id: string
  timestamp: number
  created_at: string
  action_type: enum { DOCUMENT_PUBLISH, COMMENT, DECISION, INSIGHT, REQUEST_RESULT, SEMANTIC_APPROVAL, ... }
  artifact_reference: string | null
  artifact_refs: string[]
  payload_ref: string | null
  state: enum { DRAFT, PUBLISHED, ACCEPTED, REJECTED, SUPERSEDED }
  title: string
  summary: string
  case_id: string
  publish_intent: string
}
```

**Fields:**
- `move_id`: Stable unique identifier.
- `parent_move` / `parents`: Reference(s) to preceding Move(s) in the chain.
- `author_id`: User or system identifier.
- `timestamp`, `created_at`: Temporal metadata.
- `action_type`: Classifies the Move (document publish, comment, decision, semantic approval, etc.).
- `artifact_reference` / `artifact_refs`: Pointers to content-addressed artifacts.
- `payload_ref`: Pointer to structured payload.
- `state`: DRAFT (private), PUBLISHED (shared), ACCEPTED (mainline), etc.
- `case_id`: Logical workspace identifier.

### 5.2 Artifact Object

An Artifact is any file or derived representation referenced from a Move.

```
Artifact {
  artifact_hash: string
  content_type: string
  parent_artifact: string | null
  storage_pointer: string
  artifact_id: string
  created_at: string
}
```

**Fields:**
- `artifact_hash`: Content-addressed hash (e.g., SHA-256).
- `content_type`: MIME type or format (e.g., text/markdown).
- `parent_artifact`: Reference to source artifact if derived.
- `storage_pointer`: Location in object store or file system.
- `artifact_id`: Stable unique identifier.

### 5.3 Event Object (AI Bus)

An Event is dispatched from the Event Dispatch Bus to consumers.

```
Event {
  event_type: string
  payload: object
  originating_move: string
  round_id: string
  timestamp: number
}
```

**Fields:**
- `event_type`: Classifies the event (e.g., DOCUMENT_APPROVED, SEMANTIC_REFRAIN_TRIGGERED).
- `payload`: Event-specific data.
- `originating_move`: move_id of the White Move that triggered the event.
- `round_id`: Identifies the current round.
- `timestamp`: Dispatch time.

### 5.4 Round State Object

```
RoundState {
  round_id: string
  phase: enum { WHITE, BLACK, STABILITY }
  current_move_id: string | null
  last_white_timestamp: number
  black_complete: boolean
}
```

### 5.5 Proposal Object (Extended Move)

A Proposal is a Move published to the shared board but not yet accepted.

```
Proposal extends Move {
  acceptance_status: { user_id: boolean }[]
  unanimous: boolean
}
```

---

## 6. Methods of Operation

### 6.1 Deterministic Collaboration Method

**Steps:**

1. Receive user interaction (e.g., click, keyboard input, selection).
2. Determine whether the interaction qualifies as a White Move according to configured rules (e.g., approve draft, publish, accept; typing alone does not qualify).
3. If not qualified: update draft/index/UI state only; remain in Stability; await next interaction.
4. If qualified:
   a. Apply the White Move to canonical state (e.g., append to provenance ledger, update mainline or side paths).
   b. Transition to Black phase.
   c. Generate an AI Bus Event (event_type, payload, originating_move).
   d. Dispatch the Event to registered system components.
5. Execute Black Move operations:
   a. Semantic Transformation Engine receives Event; produces draft reframings.
   b. User Interface Rendering Engine updates draft/index displays.
   c. Provenance Ledger Manager records any new Move references.
   d. No canonical state mutation during Black phase.
6. When Black Move operations complete, transition to Stability.
7. Produce draft artifacts (stored in draft space; not canonical).
8. Await next White Move.

### 6.1.1 Example Round — Concrete Walkthrough

The following walkthrough clarifies operational determinism:

**User Action:** User presses "Approve Draft."

**White Phase:**
- State Transition Engine detects qualified interaction.
- Move M45 created; Ledger appends M45.
- Ledger updates canonical state (mainline advances).
- Event E45 emitted (event_type: DRAFT_APPROVED, originating_move: M45).
- Phase transitions to Black.

**Black Phase:**
- Event Dispatch Bus delivers E45 to subscribers.
- AI Inference Module (or Semantic Transformation Engine) generates reframed proposal (draft).
- User Interface recalculates topic lenses (L2).
- No writes to canonical state.
- When all subscribers complete, phase transitions to Stability.

**Stability:**
- System awaits next qualified user interaction.
- No canonical mutation, no metadata drift, no silent recalculation.

**Result:** Deterministic round; canonical state changed only by user action; all system responses attributable to Move M45. See Figure 2 for the state machine and Figure 3 for the event flow.

### 6.2 Semantic Transformation Method

**Steps:**

1. Receive user input (text segment).
2. Parse input into semantic segments (Position, Interest, Constructive Proposal).
3. Apply Position→Interest→Constructive Proposal progression rules.
4. Generate draft reframings:
   - Replace accusation verbs with descriptive verbs.
   - Convert blame statements into problem statements.
   - Suggest symmetrical formulations.
5. Store reframings in draft space; do not mutate canonical state.
6. Await White Move (user approval) to promote draft to canonical.
7. If White Move approves: create Move; append to provenance ledger; update mainline or side paths.

### 6.3 Provenance Tracking Method

**Steps:**

1. Create Move object with move_id, author_id, timestamp, action_type, artifact_refs, state.
2. Store Move in immutable append-only structure.
3. If state is DRAFT: retain in private space; do not expose to shared view.
4. If state is PUBLISHED: add to shared board; expose to collaborators; retain in side paths.
5. If state is ACCEPTED: append to mainline; update canonical state.
6. Require unanimous acceptance (in Accord mode) for Promotion to canonical.
7. Export full ledger (accepted + unaccepted published Moves, artifact references, ordered). See Figure 8 for the Draft→Publish→Accept flowchart.

### 6.4 Center-Playfield-Only Execution Method

**Steps:**

1. Render layout with Top HUD, Left Panel, Center Playfield, Right Panel, Bottom Ribbon.
2. Populate side panels with entity indexes (e.g., stage items, proposed actions, shared collaboration state items).
3. On user click on side-panel entity: resolve entity→activity binding.
4. Load bound Activity into Center Playfield.
5. All editing and approval operations occur only in Center Playfield.
6. No inline editing in side panels; no detached editors; no floating tools.
7. Route all Center Playfield interactions to State Transition Engine.

### 6.5 Event Dispatch Method (AI Bus)

**Steps:**

1. Upon White Move completion, construct Event (event_type, payload, originating_move).
2. Enqueue Event; ensure at most one Event per round.
3. Notify all subscribers registered for the event_type.
4. Subscribers execute callbacks; update draft/index/UI state only.
5. Subscribers do not mutate canonical state.
6. When all subscribers complete, mark Black phase complete; transition to Stability.

### 6.6 Deterministic Replay Method

**Steps:**

1. Load provenance ledger (ordered sequence of Move objects).
2. Filter to accepted Moves (mainline) for canonical replay; or include side paths for full history replay.
3. Initialize empty canonical state.
4. For each Move in order: (a) resolve artifact_reference to artifact content; (b) apply Move to canonical state according to action_type; (c) update mainline or side path state.
5. Result: canonical state identical to state at time of last replayed Move.
6. Determinism guarantee: same Move sequence yields same canonical state; no external state dependencies during replay.

### 6.7 Entity Binding and Center Playfield Load Method

**Steps:**

1. Render side panels (Left, Right) with entity lists (e.g., stage items, proposed actions, shared collaboration state items).
2. Each entity has entity_id and bound activity_id (1:1 mapping).
3. On user click on entity: capture entity_id; lookup activity_id in binding map.
4. Load activity content (from Provenance Ledger or Artifact Storage) into Center Playfield.
5. Center Playfield becomes active execution surface for that activity.
6. All subsequent editing and approval until entity change occur in Center Playfield.

### 6.8 Integration with External AI Inference

**Steps:**

1. During Black Move, Semantic Transformation Engine or other components may require AI inference (e.g., large language model, structured generation).
2. Construct inference request from Event payload and current context.
3. Invoke external AI service (e.g., REST API, gRPC); receive draft output.
4. Store draft output in draft space; do not mutate canonical state.
5. Present draft to user in Center Playfield or draft panel.
6. User White Move (approve) promotes draft to canonical; create Move; append to provenance.
7. If user does not approve, draft remains in draft space; may be discarded or revised in next round.
8. Critical: External AI output is never automatically canonical; White Move gate is always required.

---

## 7. Example Embodiments

The invention is framed as **general AI collaboration governance**, not limited to legal mediation tools. The following embodiments demonstrate the breadth of application.

### 7.1 Embodiment 1 — Legal Drafting System

In this embodiment, the system is configured for legal document drafting. The Semantic Transformation Engine applies legal-domain reframing rules (e.g., converting adversarial language into neutral formulations). The provenance spine records each draft version as a Move; clients and attorneys approve Moves via White Moves. The center playfield displays the current draft; side panels show prior versions, comments, and proposal history. Deterministic replay supports audit trails for malpractice defense and regulatory compliance.

### 7.2 Embodiment 2 — Contract Negotiation System

In this embodiment, the system supports multi-party contract negotiation. Each party operates in a private workspace (Zenith-like); Proposals are Published to a shared board. Unanimous Accept promotes a clause or section to canonical. The Position→Interest→Constructive Proposal model guides parties from stated positions to underlying interests and mutually acceptable proposals. The Event Dispatch Bus triggers AI-assisted proposal generation (Black Move) without mutating the shared state until all parties Accept.

### 7.3 Embodiment 3 — Dispute Mediation System

In this embodiment, the system supports structured dispute mediation. The Semantic Transformation Engine acts as a mediator reframing layer, converting accusatory language into problem-oriented statements. L2 topic lenses (Clarification, Impact, Resolution, Options) shift the center playfield semantic mode. L3 quick statements provide one-click semantic direction commits (White Move). The Eight-Fold Strategic Matrix ensures multi-axis analysis before proposal publication. The provenance spine provides a full record for dispute resolution documentation.

### 7.4 Embodiment 4 — Enterprise Decision-Making System

In this embodiment, the system supports enterprise decision-making workflows (e.g., policy approval, procurement decisions). Stakeholders contribute Positions; the system extracts Interests and generates Constructive Proposals. White Moves represent explicit approvals; Black Moves generate draft recommendations. The provenance ledger provides auditability for governance and compliance. The system operates in Accord mode with multiple stakeholders; unanimous acceptance enforces consensus.

### 7.5 Embodiment 5 — Medical Documentation System

In this embodiment, the system supports clinical documentation and care coordination. Providers enter clinical observations (Position); the system extracts clinical intent and compliance requirements (Interest); draft notes and care plans are generated (Constructive Proposal). All AI-generated content remains draft until provider White Move approval. The provenance spine provides a full audit trail for regulatory and malpractice defense. Center-playfield-only execution ensures all documentation edits occur in a single, auditable surface.

### 7.6 Embodiment 6 — Research Collaboration System

In this embodiment, the system supports multi-institution research collaboration. Co-authors contribute draft sections; the Semantic Transformation Engine suggests consistency improvements and citation formatting. Proposals are Published to a shared board; unanimous Accept promotes sections to the canonical manuscript. The Eight-Fold Strategic Matrix may be adapted for research axes (hypothesis, method, results, interpretation). Deterministic replay supports reproducibility documentation.

### 7.7 Embodiment 7 — Collaborative Software Engineering Platform

In this embodiment, the system supports collaborative software development. Developers contribute code proposals (Position); the system extracts design intent and constraints (Interest); draft implementations and refactorings are generated (Constructive Proposal). AI-generated code remains draft until explicit White Move approval. The provenance spine provides full version history and auditability for code review and compliance. The Event Dispatch Bus triggers AI-assisted code generation without mutating the canonical codebase until approved.

### 7.8 Embodiment 8 — Policy Negotiation System

In this embodiment, the system supports multi-stakeholder policy negotiation (e.g., organizational policy, regulatory comment). Stakeholders contribute positions; the system structures interests and generates draft policy language. Proposals are published to a shared board; unanimous acceptance promotes language to canonical policy. Deterministic replay supports regulatory transparency and accountability.

### 7.9 Embodiment 9 — Regulatory Review Environment

In this embodiment, the system supports regulatory review workflows (e.g., compliance documentation, audit responses). Regulated entities contribute documentation; the system assists with structured responses and evidence organization. All AI-assisted outputs are draft until authorized personnel approve via White Move. The provenance ledger provides a defensible audit trail for regulatory examinations.

### 7.10 Embodiment 10 — AI-Assisted Document Governance

In this embodiment, the system supports general document governance (e.g., corporate policies, knowledge base management, standards development). Contributors propose edits; AI assists with consistency, formatting, and cross-referencing. The White-Black round model ensures no AI output enters the canonical document set without explicit authorization. Deterministic replay and full ledger export support governance and compliance requirements.

---

## 8. Alternative Implementations

### 8.1 Alternative Event Models

**Multiple Events per Round:** An alternative implementation may permit multiple Events per round, each tagged with a sub-round identifier, enabling finer-grained reactivity while still preventing canonical mutation during Black phase.

**Event Filtering:** Consumers may subscribe to event type filters or payload predicates; only matching Events trigger callbacks.

**Event Persistence:** Events may be persisted to a log for replay and debugging, separate from the provenance spine.

### 8.2 Event Dispatch Bus Implementation Variations

**Message Queue (e.g., RabbitMQ, Kafka, AWS SQS):** The Event Dispatch Bus may be implemented as a message queue. Publishers enqueue Events upon White Move completion; subscribers consume from the queue. Supports asynchronous dispatch, at-least-once delivery, and horizontal scaling of Black Move processors.

### 8.3 Provenance Spine Implementation Variations

**Append-Only Database:** The provenance spine may be implemented as an append-only database (e.g., event-sourcing store). Moves are appended; mainline is derived by replay or materialized view. Supports audit trail and deterministic replay.

**Blockchain or Permissioned Distributed Ledger:** The provenance spine may be implemented on a blockchain or permissioned distributed ledger for tamper-evident auditability. Moves are transactions; consensus determines canonical order.

### 8.4 Alternative Storage Systems

**Relational Database:** Move and Artifact objects may be stored in a relational database with append-only tables and content-addressed blob storage.

**Distributed Key-Value Store:** Moves and artifacts may be stored in a distributed key-value store (e.g., Cassandra, DynamoDB) with hash-based partitioning.

**File-System-Based:** Moves may be stored as JSON files in a directory structure; artifacts as content-addressed files in an object store directory.

### 8.5 User Interface Implementation Variations

**Web Browser:** The User Interface Rendering Engine may be implemented as a browser-based application (SPA). Provenance Ledger and Artifact Storage accessed via REST or WebSocket API.

**Desktop Application:** The User Interface may be a native desktop application (e.g., Electron, Qt) with optional local Provenance Ledger and Artifact Storage; sync to cloud on connection.

**AI Inference Location:** AI inference (e.g., Semantic Transformation Engine backend) may execute locally (on user device) or remotely (cloud API). In both cases, output remains draft until White Move approval.

### 8.6 Alternative UI Layouts

**Adaptive Layouts:** Panel proportions may be configurable (e.g., 20/60/20, 25/50/25); panel order may be permuted.

**Collapsible Panels:** Side panels may collapse to icons or tabs; center playfield expands accordingly.

**Multi-View Center Playfield:** The center playfield may support split views (e.g., compare two drafts) while retaining single execution surface semantics per split.

**Mobile Layout:** On smaller screens, panels may stack vertically or appear as overlay sheets; center playfield remains the primary execution surface.

### 8.7 Alternative White-Black Round Structures

**Deferred Black Move:** Black Move execution may be deferred (e.g., batched) while maintaining Stability; canonical mutation still requires White Move.

**Parallel Black Moves:** Multiple Black Move operations may execute in parallel (e.g., semantic reframing and index recalculation) provided none mutate canonical state.

**Conditional Black Move:** Black Move may be skipped for certain White Move types if no reactive recalculation is needed.

### 8.8 Alternative Provenance Models

**Fork-and-Merge:** Users may fork from a Move; merge creates a new Move with multiple parents; mainline may be computed via merge strategy.

**Supersession Without Reject:** Unwanted Proposals may be superseded by newer Proposals rather than explicitly rejected; ledger retains both.

**Partial Acceptance:** In some embodiments, partial acceptance (e.g., majority vote) may promote to canonical for non-legal use cases.

**Timeout-Based Canonization (Optional Override):** In embodiments where unanimous acceptance is impractical, a configurable timeout may promote Proposals to canonical if no objection; override flag distinguishes from default unanimous model.

### 8.9 Alternative White Move Qualification Rules

**Configurable Qualification:** White Move qualification may be configurable per deployment: e.g., auto-save after idle may or may not qualify; keystroke-level commits for power users; gesture-based approval on touch devices.

**Deferred Qualification:** An interaction may be marked for potential White Move; user confirms in a second step; provisional state held until confirmation.

**Batch White Moves:** Multiple interactions may be batched into a single White Move (e.g., approve-all-drafts); reduces round count while preserving determinism.

### 8.10 Alternative Semantic Models

**Domain-Specific Ladders:** Position→Interest→Constructive Proposal may be adapted: e.g., Clinical Finding→Clinical Intent→Care Plan for medical; Hypothesis→Method→Interpretation for research.

**Additional Semantic Layers:** Four or more layers may be introduced (e.g., Position→Interest→Constraint→Constructive Proposal).

**Semantic Pruning:** In simplified embodiments, Interest extraction may be omitted; direct Position→Constructive Proposal.

### 8.11 Alternative Event Dispatch Topologies

**Hierarchical Dispatch:** Events may be dispatched in tiers; some components receive all events; others receive filtered subsets.

**Async vs. Sync:** Event handling may be synchronous (blocking) or asynchronous (queue-based); Black phase completion criteria adapt accordingly.

**Event Replay:** Event log may support replay for debugging; replay mode does not mutate canonical state.

---

## 9. Technical Advantages

The invention provides the following technical improvements over prior art. These advantages relate to computer system behavior and help defend against abstract-idea rejections:

**Deterministic Replay of AI-Assisted Workflows:** Because every canonical mutation is attributable to a White Move and every White Move is recorded in the provenance spine, the system can deterministically reconstruct any prior collaboration state by replaying the sequence of accepted Moves. Prior systems with silent AI behavior cannot provide this guarantee. This improves reproducibility and debugging of AI-assisted workflows.

**Reduction of Unauthorized State Mutations:** The temporal model explicitly forbids canonical mutation during Black phase. System-generated operations are restricted from modifying canonical state without a subsequent explicit user authorization. AI components can only produce drafts; promotion to canonical requires a White Move. This prevents background drift, silent edits, and unauthorized changes.

**Improved Concurrency Control:** The round structure and concurrency lock prevent overlapping Black Moves per White context, reducing race conditions and inconsistent intermediate states. Serialization at shared boundaries ensures deterministic ordering.

**Improved Traceability of Generative Outputs:** The Event Dispatch Bus and White-Black round model ensure that AI-generated (generative) outputs are clearly distinguished from user-approved state. Each draft can be traced to the originating White Move; each canonical artifact traces to a specific user authorization. This improves traceability of generative AI outputs for audit and compliance.

**Improved System Auditability:** Auditors can reconstruct full collaboration history from the provenance ledger. The full export includes accepted and unaccepted published Moves, supporting legal defensibility and dispute transparency. No hidden or deleted proposal history.

**Single Execution Surface Reduces State Fragmentation:** By restricting all editing and approval to the center playfield, the system eliminates state fragmentation across multiple editors. The locus of canonical mutation is unambiguous.

**Content-Addressed Artifacts Enable Deduplication and Integrity:** Artifacts stored by content hash support deduplication and integrity verification; any corruption is detectable via hash mismatch.

**Restricted Black Recalculation Scope:** The L3 semantic acceleration feature triggers Black recalculation only for Center Playfield and L3 ribbon when an L3 statement is clicked, preventing unintended updates to L1, L2, and side panels. This reduces computational load and preserves user context.

**Orthogonal Layer Architecture Reduces Coupling:** The five-layer model (Provenance, Temporal, Spatial, Semantic, Strategic) enforces strict separation; changes in one layer do not require cascading changes in others, improving maintainability and reducing regression risk.

**Unanimous Acceptance Enforces Consensus:** In Accord mode, canonical promotion requires explicit acceptance from all participants, preventing minority override and ensuring that shared state reflects genuine consensus.

**Serialization Reduces State-Reconciliation Overhead:** The deterministic round model reduces concurrent mutation conflicts by serializing canonical state transitions. Prior systems that permit parallel writes to shared state require expensive merge algorithms, conflict resolution, and state reconciliation. By serializing canonical transitions through the White-Black round model, the invention improves reproducibility and reduces state-reconciliation overhead in collaborative systems. This is a measurable computational improvement.

---

## 10. Hardware Environment

The system may execute on one or more processors, including cloud servers, local computing devices, or distributed processing nodes connected through a network. The system comprises:

**Processors:** One or more central processing units (CPUs), which may include general-purpose processors, application-specific integrated circuits (ASICs), or field-programmable gate arrays (FPGAs). Processing may be distributed across multiple machines in a cloud or cluster configuration.

**Memory:** Random access memory (RAM), read-only memory (ROM), and persistent storage (e.g., solid-state drives, hard disk drives) for storing program instructions, Move objects, artifact caches, and working data structures.

**Network Interfaces:** Wired or wireless network adapters for communication between clients and servers, between distributed components, and for external API access (e.g., AI inference services).

**Storage Systems:** Local or network-attached storage for the provenance ledger, artifact blob store, and configuration. May include object storage (e.g., S3-compatible), file systems, or database storage engines.

**Input/Output Devices:** Keyboards, pointing devices, touchscreens, and displays for user interaction. The User Interface Rendering Engine produces output for display on one or more screens.

**Containerized Microservices:** The system may be deployed as containerized microservices (e.g., Docker, Kubernetes). The State Transition Engine, Event Dispatch Bus, Provenance Ledger Manager, Semantic Transformation Engine, and Artifact Storage System may run as separate service instances, communicating via APIs or message queues.

**Computing Environment Options:**
- Cloud server clusters
- Local computing devices
- Distributed processing nodes

**Scaling Considerations:** For high-load deployments, the State Transition Engine may be replicated with a single-writer coordinator for canonical state. Event Dispatch Bus may use a distributed message queue with partition-by-round-id to preserve ordering. Provenance Ledger Manager may use sharding by case_id. Artifact Storage System may use distributed object storage with content-addressable partitioning.

---

## 11. Computer-Readable Medium

A non-transitory computer-readable medium stores instructions which, when executed by one or more processors, cause the system to perform the methods described herein, including:

- The Deterministic Collaboration Method (Section 6.1)
- The Semantic Transformation Method (Section 6.2)
- The Provenance Tracking Method (Section 6.3)
- The Center-Playfield-Only Execution Method (Section 6.4)
- The Event Dispatch Method (Section 6.5)

The computer-readable medium may comprise magnetic disk, optical disc, solid-state memory, or other non-transitory storage. The instructions may be stored in source code, compiled bytecode, or machine code form. Execution may occur on a single machine or across a distributed system.

**Medium Claims:** The non-transitory computer-readable medium claim encompasses storage of the system's program instructions, configuration data, and (optionally) the provenance ledger and artifact store. The medium may be portable (e.g., USB drive, optical disc) or fixed (e.g., server storage). The instructions, when executed, cause the system to perform the Deterministic Collaboration Method, Semantic Transformation Method, Provenance Tracking Method, Center-Playfield-Only Execution Method, Event Dispatch Method, Deterministic Replay Method, and Entity Binding Method described herein.

---

## 12. Figure Descriptions

The following figures support the claimed architecture and are incorporated by reference for earliest-date priority purposes. The drawings are set forth in the companion document *Lexiom_Provisional_Patent_Figures_1-11.md*. Each figure number corresponds to the narrative section indicated below.

| Figure | Title | Primary Narrative Reference |
|--------|-------|-----------------------------|
| 1 | System Architecture Diagram | Summary (§3); §4 System Architecture |
| 2 | White-Black Round State Machine | §4.1 State Transition Engine; §6.1, §6.1.1 |
| 3 | AI Bus Event Flow | §4.2 Event Dispatch Bus; §6.1.1 |
| 4 | Provenance Spine Data Graph | §4.3 Provenance Ledger Manager; §5 Data Structures |
| 5 | User Interface Layout | §4.5 User Interface Rendering Engine |
| 6 | Semantic Transformation Pipeline | §4.4 Semantic Transformation Engine; §6.2 |
| 7 | Five-Layer Orthogonal Architecture | §4.10 |
| 8 | Draft-Publish-Accept Workflow | §4.3 Provenance Ledger Manager; §6.3 |
| 9 | L2 Topic Lenses and L3 Semantic Acceleration | §4.7 |
| 10 | Eight-Fold Strategic Matrix Axes | §4.8 |
| 11 | Zenith vs. Accord Mode Architecture | §4.6 Collaboration Control Module |

### Figure 1 — System Architecture Diagram

A block diagram showing the major system components and their interconnections: State Transition Engine, Event Dispatch Bus (AI Bus), Provenance Ledger Manager, Semantic Transformation Engine, User Interface Rendering Engine, Collaboration Control Module, and Artifact Storage System. Arrows indicate data flow: user interactions into State Transition Engine; White Move outcomes into Event Dispatch Bus; Event dispatch to Semantic Transformation Engine and User Interface Rendering Engine; Move and Artifact data between Provenance Ledger Manager and Artifact Storage System; canonical state and acceptance signals between Collaboration Control Module and Provenance Ledger Manager.

### Figure 2 — White-Black Round State Machine

A state machine diagram with three states: White, Black, Stability. Transitions: (Stability → White) on qualified user interaction; (White → Black) on White Move completion; (Black → Stability) on Black Move completion. No transition from Stability to Black without intervening White. Annotations indicate: "Canonical mutation only in White"; "Draft/index update only in Black"; "No mutation in Stability."

### Figure 3 — AI Bus Event Flow

A sequence diagram showing: User → State Transition Engine (interaction); State Transition Engine → Provenance Ledger Manager (apply White Move); State Transition Engine → Event Dispatch Bus (emit Event); Event Dispatch Bus → Semantic Transformation Engine (Event); Event Dispatch Bus → User Interface Rendering Engine (Event). Semantic Transformation Engine and User Interface Rendering Engine update draft/index state only; no arrows to Provenance Ledger Manager for canonical mutation from these components.

### Figure 4 — Provenance Spine Data Graph

A directed acyclic graph of Move nodes. Each node has move_id, author_id, state (DRAFT, PUBLISHED, ACCEPTED). Edges represent parent_move relationships. Mainline path highlighted (accepted Moves). Side paths shown as published but unaccepted branches. Artifact nodes linked to Moves via artifact_refs. Content-addressed storage symbols (hash icons) for artifacts.

### Figure 5 — User Interface Layout (Center-Playfield-Only Execution)

A wireframe layout: Top HUD (L1 identity, L2 topic lenses) spanning full width; Left Panel (20% width) with stage tower and proposed actions; Center Playfield (60% width) as primary content area with "sole execution surface" annotation; Right Panel (20% width) with shared collaboration state index and private artifacts; Bottom Ribbon with L3 quick statements. Entity binding arrows from Left/Right panel items to Center Playfield. Legend: "Index only—no inline editing in panels"; "All editing and approval in Center."

### Figure 6 — Semantic Transformation Pipeline

A flowchart: User Input (Position) → Parse → Extract Interest → Generate Constructive Proposal (draft) → Store in draft space → Await White Move → If approved: Create Move, append to provenance. Draft stages marked "Not canonical"; canonical promotion marked "Requires White Move."

### Figure 7 — Five-Layer Orthogonal Architecture

A layered diagram: Layer 1 (Provenance) at bottom; Layer 2 (Temporal) above; Layer 3 (Spatial) above; Layer 4 (Semantic) above; Layer 5 (Strategic) at top. Each layer labeled with key invariants. Arrows show dependency (upper layers depend on lower). Orthogonality annotation: "No cross-layer mutation; constitutional invariants enforced."

### Figure 8 — Draft-Publish-Accept Workflow

A flowchart: Move created → State DRAFT (private) → User Publish → State PUBLISHED (shared board) → All participants Accept → State ACCEPTED (mainline, canonical). Optional: Supersede (new Move replaces; no explicit Reject). Unanimous acceptance gate before canonical.

### Figure 9 — L2 Topic Lenses and L3 Semantic Acceleration

A diagram showing: L2 selector (Clarification, Impact, Resolution, Options) in Top HUD; L3 ribbon with three clickable statements (e.g., "Reframe toward shared impact," "Clarify underlying expectations," "Suggest symmetrical formulation"); Center Playfield with current semantic mode indicator. Arrow: L3 click → White Move → Restricted Black (Center + L3 only). Annotation: "L3 click = explicit White Move; restricted scope prevents cascade."

### Figure 10 — Eight-Fold Strategic Matrix Axes

A radial or matrix diagram with eight axes: (1) Position Self, (2) Interests Self, (3) Position Other, (4) Interests Other, (5) Leverage Self, (6) Leverage Other, (7) Risk Surface, (8) Strategic Pathways. Proposal at center; arrows from proposal to axes indicating satisfaction/coverage. Annotation: "Multi-axis completion bias; anti-flattening; optionality preservation."

### Figure 11 — Zenith vs. Accord Mode Architecture

A comparison diagram: Zenith mode—single user, private canonical state, shared board disabled; Accord mode—multiple users, private workspaces each with center playfield, shared board with published Proposals, unanimous Accept gate. Same layout structure; mode toggle; upgrade path arrow from Zenith to Accord.

---

## 13. Constitutional Invariants and Safety Constraints

The system enforces the following invariants across all layers:

**Temporal Invariant:** Canonical state is mutated only during a White Move. Black Move operations may read canonical state but must not write to it. During Stability, no mutation occurs.

**Provenance Invariant:** Every Move is immutable once created. Moves are never edited; supersession is achieved by creating a new Move with reference to the prior Move. The full ledger (accepted and unaccepted) is always exportable.

**Spatial Invariant:** All editing and approval operations occur in the center playfield. Side panels function as indexes only; clicking an entity opens its bound activity in the center playfield. No detached editors, floating tools, or secondary editing surfaces.

**Semantic Invariant:** Semantic transformations (Position→Interest→Constructive Proposal, mediator reframing) produce draft output only. Draft output is promoted to canonical only upon explicit White Move approval.

**Strategic Invariant:** Proposals are tested against multiple axes (Eight-Fold Matrix) before publication suggestion. Anti-flattening and optionality preservation are mandatory behaviors; proposals must satisfy multiple axes before being suggested for publication.

**Safety Constraints (Semantic Layer):**
- No forced confession semantics: the system does not coerce users into admitting liability or fault without explicit consent.
- No implied liability without approval: draft reframings do not imply legal consequences until White Move approval.
- No escalation mirroring: aggressive language in user input is not mirrored in system output; reframing reduces escalation.
- No hidden narrative bias: tone rules and reframing rules are configurable and auditable; no opaque bias injection.

**Concurrency Invariant:** At most one Black Move executes per White context. Overlapping Black Moves are prevented by concurrency lock. This ensures deterministic ordering of reactive operations.

---

## 14. Qualification Rules for White Move

An interaction qualifies as a White Move only when it meets all of the following:

1. **Explicit Intent:** The interaction conveys explicit user intent to commit, approve, publish, or accept. Typing, scrolling, or selection alone does not qualify.
2. **Qualified Action Type:** The interaction maps to a qualified action type (e.g., approve-draft, publish, accept, semantic-direction-commit, save-document). Configurable per deployment.
3. **Valid Context:** The context permits the action (e.g., a draft is selected for approval; a proposal is loaded for accept).
4. **Round Boundary:** The system is in Stability phase; no Black Move is in progress.

**Non-Qualifying Interactions:**
- Keystrokes (typing) unless configured for power-user commit modes
- Mouse hover or focus changes
- Scroll or resize events
- Selection changes without associated approval action
- Background or automated triggers not directly attributable to user action

**Qualifying Interactions (Examples):**
- Click on "Approve" or "Accept" button
- Click on L3 quick statement (semantic direction commit)
- Explicit "Publish" or "Save" gesture
- Checkbox selection for "Accept Proposal" in shared mode
- Configurable: double-click, long-press, or keyboard shortcut for commit

---

## 15. Black Move Scope and Restrictions

Black Move operations are restricted as follows:

**Permitted:** (a) Read canonical state; (b) Generate draft reframings; (c) Recalculate indices (e.g., L2 topics, L3 statements); (d) Update draft/index/UI state; (e) Invoke external AI inference for draft generation; (f) Store drafts in draft space (non-canonical).

**Prohibited:** (a) Mutate canonical state; (b) Append to mainline; (c) Change Move state from DRAFT to PUBLISHED or ACCEPTED; (d) Modify accepted Moves or mainline; (e) Publish to shared board without White Move.

**Scope Variants:**
- **Full Black Move:** All subscribers (Semantic Transformation Engine, User Interface Rendering Engine, L2/L3 modules, etc.) receive Event and update.
- **Restricted Black Move:** Triggered by L3 click; only Center Playfield and L3 ribbon update; L1, L2, side panels do not update. Reduces cascade and preserves context.

---

## 16. Implementation Variations

### 16.1 Cloud-Based Distributed System

The system may be deployed as a cloud service. State Transition Engine and Provenance Ledger Manager run on server nodes; Event Dispatch Bus may use a message queue (e.g., RabbitMQ, Kafka). Clients run User Interface Rendering Engine; Artifact Storage System uses cloud object storage (e.g., AWS S3). Horizontal scaling of Black Move processors; single-writer canonical state.

### 16.2 On-Premise Deployment

The system may run entirely on-premise for data sovereignty. All components on local servers; Artifact Storage System on local or SAN storage. No external API calls required for core operation; optional AI inference may be local or external.

### 16.3 Peer-to-Peer Collaboration

In a P2P variant, Moves may be propagated via gossip protocol; consensus algorithm determines canonical mainline. Event Dispatch Bus implemented as local event bus with optional P2P event sync. Provenance Ledger replicated across peers; conflict resolution via Move ordering rules.

### 16.4 Browser-Based Application

The User Interface Rendering Engine implemented as a single-page application (SPA); State Transition Engine and Event Dispatch Bus run in browser; Provenance Ledger Manager and Artifact Storage System accessed via REST or WebSocket API. No desktop installation required.

### 16.5 Desktop Client

A native desktop application (e.g., Electron, Qt) with local Provenance Ledger Manager and Artifact Storage System; optional sync to cloud. Full offline operation; Event Dispatch Bus local; sync on reconnection.

### 16.6 Mobile Device

A mobile application (iOS, Android) with simplified layout: stacked panels, center playfield as primary view. Touch-optimized L3 quick statements; gesture support for White Move (e.g., swipe to approve). Provenance and Artifact Storage accessed via API; optional local cache.

---

## 17. Claim Categories (Suggested for Non-Provisional)

Provisionals do not require claims, but including claim-style language strengthens priority for the subsequent non-provisional application.

### 17.1 Example Claim Framework (for Later Non-Provisional)

A computing system comprising:

- a state transition engine configured to detect qualified user interactions;
- an event dispatch bus configured to dispatch events triggered by said interactions;
- a provenance ledger configured to store immutable move records;
- a semantic transformation engine configured to generate draft outputs;
- wherein canonical system state is modified only through qualified user interactions.

This framework protects system claim scope. Variations may add or omit components (e.g., user interface, artifact storage, collaboration control) without departing from the core inventive concept.

### 17.2 Claim Categories Table

The following claim categories are suggested for the subsequent non-provisional application. **No claims are drafted herein;** this section identifies subject matter suitable for claim development.

| Category | Representative Subject Matter |
|----------|-------------------------------|
| **System** | A computing system comprising: a structured user interaction interface with Top HUD, Left, Center, Right panels and Bottom Ribbon; a White Move–Black Move round engine; an Event Dispatch Bus; a provenance spine; and center-playfield-only execution logic. |
| **Method** | A method for consent-driven human–AI collaboration comprising: receiving a White Move; applying the White Move to canonical state; dispatching an Event; executing a Black Move to generate drafts and recalculate indices without mutating canonical state; entering a Stability phase. |
| **Method** | A method for semantic transformation comprising: receiving a user position; applying Position→Interest→Constructive Proposal progression; generating draft reframings; storing canonical output only upon explicit White Move approval. |
| **Method** | A method for provenance tracking comprising: creating immutable Move records; publishing to shared collaboration state; requiring unanimous acceptance for canonization; exporting full ledger including unaccepted proposals. |
| **System** | A dual-mode collaboration system supporting solo (Zenith) and shared (Accord) modes within a single interface structure. |
| **Computer-Readable Medium** | A non-transitory computer-readable medium storing instructions that, when executed, cause a computing system to enforce deterministic human–AI collaboration through explicit state transitions (White Move → Black Move → Stability). |
| **Event Dispatch Architecture** | A computing system comprising: an Event Dispatch Bus with publish–subscribe queue; subscribers registered for event types; concurrency constraints preventing overlapping Black Moves; Event objects with event_type, originating_move, payload, dispatch_timestamp. |
| **Deterministic Replay** | A method for deterministic replay comprising: loading provenance ledger; filtering to accepted Moves; replaying Moves in order to reconstruct canonical state; guaranteeing same Move sequence yields same canonical state. |

---

## 18. Glossary of Technical Terms

| Term | Definition |
|------|-------------|
| **White Move** | An explicit user commit that qualifies for canonical state mutation. Typing alone does not qualify. |
| **Black Move** | System response triggered by White Move; generates drafts and recalculates indices; does not mutate canonical state. |
| **Stability** | Phase between rounds; no canonical mutation, no metadata drift, no silent recalculation. |
| **Event Dispatch Bus (AI Bus)** | Event channel carrying typed events from White Move outcomes into Black phase; triggers reactive recalculation without canonical mutation. |
| **Center Playfield** | Sole execution surface; all editing and approval operations occur here. |
| **Provenance Spine** | Immutable Move ledger; content-addressed artifacts; Draft→Publish→Accept workflow. |
| **Move** | Atomic unit of contribution; immutable; has move_id, author_id, timestamp, parent_move, action_type, artifact_reference, state. |
| **Zenith** | Solo mode; private canonical state; shared board disabled. |
| **Accord** | Shared mode; multiple users; shared board; unanimous acceptance for canonization. |
| **L1** | Case identity (title, summary). |
| **L2** | Topic lenses (e.g., Clarification, Impact, Resolution, Options). |
| **L3** | User-triggered semantic control elements (three); click = White Move; triggers restricted Black recalculation. |

---

## 19. Final Note to Developers

This technical disclosure is intended to support a USPTO provisional utility patent application. The objective is to disclose every possible technical interpretation of the Lexiom architecture. Terminology has been chosen for legal breadth: "computing system," "execution surface," "state transition engine," "event dispatch mechanism," "provenance ledger," and similar terms are used to avoid limiting the invention to a specific product or marketing framing.

Anything not described in this provisional disclosure may be difficult to claim in a subsequent non-provisional application. The document should be read as laying legal territory around the invention—capturing all technical variations, alternative implementations, and embodied use cases—so that later claim drafting has maximum flexibility.

**No patent claims are included in this provisional disclosure.** Claims will be drafted separately for the non-provisional application. This document provides the technical foundation for those claims.

---

*End of Document — Lexiom Deterministic Human–AI Collaboration System: Technical Disclosure for Provisional Patent Filing*
