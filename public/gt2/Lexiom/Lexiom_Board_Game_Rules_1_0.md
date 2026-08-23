# Lexiom — Official Board Game Rules
## v1.1 | Constitutional Draft

**Scope:** Formal rules synthesised from Lexiom Temporal UX, Strategic Semantic UX, and Semantic Arcade UX specifications.  
**Audience:** Players accustomed to deterministic, turn-based strategic games (e.g. chess).

---

# §1. Object of the Game

Lexiom is an **Arcade Game of Structured Reasoning**, with legal-making as its first instantiated domain. The object is to advance a given reasoning trajectory (including legal cases) toward resolution through structured, move-by-move play. Victory is not measured by capture; it is measured by **canonical state advancement** — the board moves forward only when players commit.

**Core axioms:**
- Nothing changes without consent.
- Nothing happens silently.
- History is immutable.

---

# §2. The Board

## 2.1 Board Types

- **Private Board (Zenith):** One White; private canonical state; no shared publication.
- **Shared Board (Accord):** Multiple Whites; shared canonical state; publication requires unanimous acceptance.

## 2.2 Board Stability

Between Rounds, the board is **stable**. No mutation, no drift, no recalculation. The board remains frozen until the next Move.

---

# §3. Players and Roles

## 3.1 White (Human)

White is the **active player**. White performs explicit Moves that mutate state. White alone may:
- Approve drafts
- Save documents
- Approve action items
- Publish to shared board (Accord only)
- Accept shared proposals
- Confirm stage transitions

**Important:** Typing alone is not a Move. A Move is a **commit action**.

## 3.2 Black (System)

Black is the **responding player**. Black:
- Acts only after a White Move
- Executes deterministic orchestration
- Generates probabilistic drafts
- Never mutates canonical state silently
- Never publishes to shared board

Black is a reactive force, not an autonomous player.

---

# §4. Round Structure (Temporal Model)

A **Round** is strictly:

```
White Move → Black Move → Stability
```

No state mutation may occur outside a Round. The game advances one Round at a time.

## 4.1 White Move

A White Move is an explicit commit. Examples:
- Approve draft
- Save document
- Approve action item
- Publish to shared board
- Accept shared proposal
- Confirm stage transition

## 4.2 Black Move

Triggered immediately after a White Move. Black may:
- Generate drafts
- Recalculate indices
- Update proposals
- Suggest stage transitions

Black may **never**:
- Mutate canonical state silently
- Publish to shared board
- Override acceptance rules

## 4.3 Stability Phase

Between Rounds:
- No canonical mutation
- No metadata drift
- No silent recalculation
- No automatic stage transition

---

# §5. Semantic Layers (Position → Interest → Proposal)

Each meaningful statement exists in one of three semantic layers. Advancement along this ladder is the strategic goal.

| Layer | Description | Example |
|-------|-------------|---------|
| **Position** | What a party declares they want | "Refund full amount." |
| **Interest** | Why they want it | "Clarify financial impact and reimbursement expectations." |
| **Constructive Proposal** | Forward-looking formulation satisfying multiple interests | "Draft structured repayment plan aligned with both parties' constraints." |

**Progression rule:** Position → Interest → Constructive Proposal.

Items evolve across layers only through explicit White Moves. Nothing silently upgrades.

---

# §6. The Eight-Fold Strategic Matrix

Internally, Lexiom evaluates every material interaction across eight axes. Players who master these axes play at a higher level.

| Axis | Focus |
|------|-------|
| 1. Declared Position (Self) | What you explicitly claim or demand |
| 2. Underlying Interests (Self) | Why you truly want it |
| 3. Declared Position (Other) | What the opposing side claims or demands |
| 4. Underlying Interests (Other) | What they likely need, fear, or protect |
| 5. Leverage & Constraints (Self) | Legal, procedural, financial, evidentiary constraints affecting you |
| 6. Leverage & Constraints (Other) | Equivalent constraints affecting the other side |
| 7. Risk Surface | Exposure if conflict escalates (litigation, cost, delay, reputation, regulation) |
| 8. Strategic Pathways | Viable routes: escalate, negotiate, sequence, defer, reframe, procedurally maneuver |

**Beginner:** Operates on Axes 1–3.  
**Advanced:** Anticipates opponent constraints; balances risk vs leverage; sequences proposals intentionally.  
**Expert:** Navigates all eight axes fluidly; preserves optionality while converging toward resolution.

---

# §7. L2 Topic Trio (Semantic Lenses)

L2 topics are interpretive lenses for the Center Playfield. Selecting one shifts the board into that semantic mode.

| Lens | Purpose |
|------|---------|
| **Clarification** | Define what is claimed, asked, denied, or requested |
| **Impact** | Articulate consequences, constraints, harms, costs, risk, dignity |
| **Resolution** | Shape options, tradeoffs, sequencing, mutual gains |

---

# §8. L3 Ribbon (Semantic Acceleration)

Each L3 statement is a compact semantic Move. Examples:
- "Reframe toward shared impact."
- "Clarify underlying expectations."
- "Propose structured next step."

**Rule:** Clicking an L3 statement is an explicit White commit. It triggers recalculation and new draft proposals. L3 is a fast lever, always visible.

---

# §9. Stage Progression

The game advances through stages. Black may **suggest** transitions; Whites must **publish and unanimously accept** (Accord). No automatic stage drift.

| Stage | Semantic Emphasis |
|-------|-------------------|
| Preparation | Constraints and risk mapping |
| Opening | Declared positions |
| Exposition | Interests |
| Reframing | Integration across axes |
| Proposals | Strategic pathways |
| Resolutions | Risk minimization + optionality lock-in |

Zenith uses the same internal arc under a single stage label: **Zenith**.

---

# §10. Canonical State

## 10.1 Private Canonical State

Per user, per case. Contains:
- Approved documents
- Approved action items
- Approved structural decisions

**Drafts are non-canonical.**

## 10.2 Shared Canonical State (Accord)

Contains only published items that achieved **unanimous acceptance**.

Black cannot publish here. Ever.

---

# §11. Acceptance and Rejection

## 11.1 Unanimous Acceptance Required

A published Move becomes canonical only when all core participants **explicitly accept** it.

**Silence does not equal consent.**

## 11.2 No Timeout Canonisation

No automatic acceptance based on delay. Moves remain pending indefinitely.

## 11.3 Rejection Philosophy

There is no explicit Reject action. Alternative Moves may be published and accepted. Acceptance of a competing Move implicitly supersedes prior proposals.

**Nothing is deleted.** History remains intact.

---

# §12. Provenance (Ledger Model)

Every Move is immutable and recorded:
- Author
- Timestamp
- Reference to parent(s)
- Content-addressed (hash)

Case state is derived from replaying accepted Moves. Proposals remain in history even if superseded. Export MUST include: accepted Moves, unaccepted published Moves, metadata, artifact references, ordered ledger.

---

# §13. Forbidden Moves

## White

- No silent approval; every Move must be explicit.
- No publishing to shared board without unanimous acceptance (Accord).

## Black

- No mutating canonical state silently.
- No publishing to shared board.
- No overriding acceptance rules.
- No implied admissions or liability without White approval.
- No manufacturing leverage that does not exist.

---

# §14. Performance Constraint

Black Move target latency: ≤ 30 seconds. If exceeded, show progress; do not mutate canonical state outside the Round.

---

# §15. Determinism Principle

Given identical:
- Canonical state
- White Move
- Context inputs

The resulting structural state must be deterministic. AI outputs may vary in wording but not structural effect. No hidden memory. No invisible updates.

---

# §16. Arcade Mastery Curve

| Level | Behaviour |
|-------|-----------|
| **Easy to learn** | Draft position; approve reframing; select L2 lens; click L3. |
| **Difficult to master** | Right semantic shift at the right moment; position→interest without losing dignity; proposals reflecting multiple constraints; publishing only strategically durable Moves. |
| **Expert** | See the whole board before moving; navigate all eight axes; preserve optionality while converging. |

---

# §17. One-Sentence Summary

**White commits intent. Black responds. Nothing changes without consent. Nothing happens silently. The case advances move-by-move.**

Lexiom does not argue for you. It ensures you see the whole board before you move.

---

*End of Rules | Version 1.0 | Lexiom Constitutional Draft*
