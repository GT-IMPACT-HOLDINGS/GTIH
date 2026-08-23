# Lexiom + GT3 Data Lakes Spec 1.0

## Purpose

This specification defines a shared private dialect for referring to Lexiom gameplay telemetry/log corpora as data lakes, so GT3 server-side developers, GT2/Lexiom developers, administrators, and players can consistently inspect and discuss behavior across stages and rounds.

This spec reflects current platform semantics:

- Lexiom is a multi-level game experience with at least:
  - Zenith (solo, iterative rehearsal rounds),
  - Accord (collaborative negotiation over shared artifacts).
- Game behavior and transitions are auditable via game-record scoped telemetry/log material.
- Stakeholders need simple, memorable names that map to different viewpoints.

---

## Canonical Vocabulary (All Four Terms Are Valid)

### 1) LexiLake

**Primary perspective:** GT3 development and administration.  
**Meaning:** The operational data lake concept for Lexiom gameplay logs overall.

**LexiLake ingestion contract:** All human (White) inputs—chat answers, approved drafts—along with the context of the game must find their way into LexiLake, like rivers pouring their human-made, approved-draft waters into the grand Lexi Lake.

Use when the focus is platform/ops questions, for example:

- "Search my last game's LexiLake for failed inference patterns."
- "Check LexiLake for stage transition anomalies."

### 2) ZenithLake

**Primary perspective:** Lexiom developers and players (solo stage).  
**Meaning:** The subset/view of logs that describe Zenith rounds (draft approvals, home-run, round-to-round progression).

Use when the focus is solo progression and round quality, for example:

- "Inspect ZenithLake for why home-run did not trigger."
- "Compare Round 1 and Round 2 behavior in ZenithLake."

### 3) AccordLake

**Primary perspective:** Lexiom developers and players (collaborative stage).  
**Meaning:** The subset/view of logs that describe Accord flows (shared artifact creation, deep-link opening, draft-first shared approvals, collaboration behavior).

Use when the focus is shared negotiation and cross-user behavior, for example:

- "Check AccordLake for shared-link bootstrap failures."
- "Review AccordLake to see whether both users saw the shared draft."

### 4) CaseLake

**Primary perspective:** Legalish vertical semantics and case-centric analysis.  
**Meaning:** A case-oriented lens over logs, centered on case identity, dispute/goal/strategy/undisputed evolution, action items, and artifacts across stages.

Use when the focus is legal workflow semantics, for example:

- "Analyze CaseLake for how the case narrative evolved from L1 to action artifacts."
- "Review CaseLake for disputables-to-undisputed consistency."

---

## Relationship Between Terms

These are not competing labels; they are complementary aliases over the same underlying log substrate.

- **LexiLake** = global umbrella term.
- **ZenithLake** = stage-focused lens for solo rounds.
- **AccordLake** = stage-focused lens for collaborative rounds.
- **CaseLake** = legal/case semantic lens across all relevant stages.

Recommended mental model:

- One physical log corpus can support multiple semantic views.
- Teams choose the term that best matches the question being asked.

---

## Multi-Level Game Semantics (Current Direction)

### Stage and round direction

- Zenith supports repeated rounds of refinement toward the user's desired zenith state.
- A home-run in Zenith triggers a transition flow where the user can:
  - continue with another Zenith round, or
  - proceed to Accord for human-to-human negotiation.

### Accord collaboration direction

- In Accord setup, a shared markdown resource is created server-side.
- A shareable link is produced for collaboration.
- When another user opens the link, Lexiom bootstraps with that shared artifact as case seed context and presents it in shared space as draft-first content pending approval.

### Reviewability direction

- Logs should support "what happened, when, and why" across:
  - approvals and reversals,
  - round/stage transitions,
  - action/item/artifact lifecycle,
  - shared-link and deep-link behavior.

---

## Roles and Typical Questions

### A) GT3 administrators / server-side developers (LexiLake-first)

Typical questions:

- "Which game record is the latest and did inference calls succeed?"
- "Where did a transition fail in the timeline?"
- "Did the collaboration link creation and retrieval complete?"

Preferred term:

- **LexiLake** (optionally narrowed to ZenithLake/AccordLake when stage-specific).

### B) GT2 / Lexiom MVP developers

Typical questions:

- "Did home-run detection trigger the expected overlay flow?"
- "Did Round 2 reset and bootstrap correctly while preserving intended state?"
- "Did the shared Harmony panel receive and display the shared draft as expected?"

Preferred terms:

- **ZenithLake** for solo-flow behavior,
- **AccordLake** for collaboration flow behavior,
- **CaseLake** for legal-semantic progression checks.

### C) Players / evaluators

Typical questions:

- "Can you inspect my last game's ZenithLake and explain what blocked my progress?"
- "Can you inspect my AccordLake and verify that the shared draft was visible to both sides?"

Preferred terms:

- Stage-centric terms (**ZenithLake**, **AccordLake**) for understandable user language.

---

## Example Dialect (Recommended)

- "I saw an issue in Lexiom. Please search my last game's **LexiLake**."
- "Please inspect **ZenithLake** for why home-run did not transition."
- "Please inspect **AccordLake** for collaborator deep-link bootstrap."
- "Please inspect **CaseLake** for case-semantic drift between disputes and strategy."

---

## Mapping Guidance (Non-Normative)

When needed, teams may map terms to concrete storage locations:

- LexiLake -> all relevant inference/session records for a game record/session.
- ZenithLake -> events and artifacts generated while case mode is Zenith.
- AccordLake -> events and artifacts generated while case mode is Accord.
- CaseLake -> cross-stage case-oriented reconstruction from the same records.

This mapping can evolve without changing the vocabulary contract above. The terms are semantic views, not commitments to one storage engine, path layout, or admin UI shape.

---

## Versioning and Evolution

- Version: **1.0**
- Scope: naming convention + semantic usage contract.
- Future versions may add:
  - strict query recipes,
  - dashboards/filters per lake view,
  - retention and governance conventions.

