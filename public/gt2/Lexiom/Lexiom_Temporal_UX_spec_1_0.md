

## Lexiom Temporal Arcade UX Specification Model (v1.1)

Status: MVP Constitutional Draft\
Scope: Unified UX model for Lexiom Zenith (Solo) and Lexiom Accord
(Shared)

------------------------------------------------------------------------

# 1. Foundational Philosophy

Lexiom is an **Arcade Game of Structured Reasoning**, with legal-making as its first instantiated domain.

It is: - Easy to enter - Difficult to master - Deterministic in
structure - Probabilistic in generation - Immutable in history -
Explicit in consent

Lexiom encodes collaboration as structured play: White commits → Black
responds → Stability → Repeat.

Nothing changes without consent.\
Nothing happens silently.\
History is preserved.

------------------------------------------------------------------------

# 2. Modes of Play

## 2.1 Lexiom Zenith (Solo Vector)

Single White (human). - Private canonical state - No shared board
mutation - Stage transitions require explicit commit - Full provenance
spine applies

## 2.2 Lexiom Accord (Shared Vector)

Multiple Whites collaborate toward resolution. - Each White operates in
a private cockpit - Shared board represents published state - Canonical
shared state requires unanimous acceptance - All activity is ledgered

------------------------------------------------------------------------

# 3. Actors

## 3.1 White (Human)

A White performs explicit Moves that mutate state.

## 3.2 Black (System)

Black is Lexiom: - Executes deterministic orchestration - Generates
probabilistic drafts - Acts only after a White Move - Never mutates
canonical state silently - Never publishes to shared board

------------------------------------------------------------------------

# 4. Temporal Model --- Arcade Law

## 4.1 Round Structure

A Round is:

White Move → Black Move → Stability

No state mutation may occur outside a Round.

## 4.2 White Move

A White Move is an explicit commit action: - Approve draft - Save
document - Approve action item - Publish to shared board - Accept shared
proposal - Confirm stage transition

Typing alone is not a Move.

## 4.3 Black Move

Triggered immediately after a White Move. Black may: - Generate drafts -
Recalculate indices - Update proposals - Suggest stage transitions

Black may never: - Mutate canonical state silently - Publish to shared
board - Override acceptance rules

## 4.4 Stability Law

Between Rounds: - No canonical mutation - No metadata drift - No silent
recalculation - No stage auto-transition

The board is stable until the next Move.

------------------------------------------------------------------------

# 5. Canonical State Model

Lexiom separates:

## 5.1 Private Canonical State

Per user, per case. Contains: - Approved documents - Approved action
items - Approved structural decisions

Drafts are non-canonical.

## 5.2 Shared Canonical State (Accord)

Contains only published items that achieved unanimous acceptance.

Black cannot publish here.

------------------------------------------------------------------------

# 6. Concurrency & Ordering

## 6.1 Parallel Private Play

Multiple Whites may perform private Rounds simultaneously. There is no
global case lock for private activity.

## 6.2 Shared Boundary Serialization

Serialization applies only when mutating shared canonical state.

When a White publishes: - That publish event is serialized - Ordering is
deterministic - Each White Move triggers exactly one Black Move

## 6.3 No Overlapping Black Moves

Black Moves do not overlap per White context. They may run in parallel
across different Whites' private cockpits.

This ensures: - Determinism - No race conditions - No merge chaos

------------------------------------------------------------------------

# 7. Acceptance Authority Model

## 7.1 Unanimous Acceptance Required

A published Move becomes canonical only when all core participants
explicitly accept it.

Silence does not equal consent.

## 7.2 No Timeout Canonization

No automatic acceptance based on delay. Moves remain pending
indefinitely.

Soft reminders may exist without altering legitimacy rules.

------------------------------------------------------------------------

# 8. Rejection Philosophy

There is no explicit Reject action.

Alternative Moves may be published and accepted. Acceptance of a
competing Move implicitly supersedes prior proposals.

Nothing is deleted. History remains intact.

------------------------------------------------------------------------

# 9. Move Taxonomy

All items are labeled simply as:

Move

No Proposal/Decision/Note taxonomy in MVP.

Meaning derives from: - Content - Acceptance state - Position in ledger

------------------------------------------------------------------------

# 10. Diff Model

MVP Diff = Red/Green Inline Text Diff

-   Operates on extracted canonical text
-   No layout diff
-   No rendered binary diff
-   Minimal, deterministic, reliable

------------------------------------------------------------------------

# 11. Progression Model

## 11.1 Action Item Progress

Deterministic thresholds: - 0% Approved - 30% Drafted - 60% Approved
privately - 100% Published & completed

## 11.2 No Leaderboards

Progress provides clarity, not competition.

------------------------------------------------------------------------

# 12. Stage Progression (Accord)

Stages: Preparation → Opening → Exposition → Reframing → Proposals →
Resolutions

-   Black may suggest transitions
-   Whites must publish & unanimously accept
-   No automatic stage drift

Zenith uses same structure but without shared publication.

------------------------------------------------------------------------

# 13. Performance Constraint

Black Move target latency: ≤ 30 seconds.

If exceeded: - Show progress indicator - Do not mutate canonical state
outside Round

------------------------------------------------------------------------

# 14. Determinism Principle

Given identical: - Canonical state - White Move - Context inputs

The resulting structural state must be deterministic.

AI outputs may vary in wording but not structural effect.

No hidden memory. No invisible updates.

------------------------------------------------------------------------

# 15. Provenance Spine (Git-at-the-Core)

## 15.1 Immutable Moves

Every Move: - Has author - Has timestamp - References parent(s) - Is
content-addressed - Is immutable

## 15.2 Ledger Model

Case state is derived from replaying accepted Moves.

Proposals remain in history even if superseded.

## 15.3 Artifact Storage

Artifacts are content-addressed via hash. Large binaries stored in
object store. Ledger stores references only.

## 15.4 Export Policy (Legal Defensibility)

Export MUST include: - Accepted Moves - Unaccepted published Moves -
Metadata - Artifact references - Ordered ledger

Lexiom preserves semantic evolution.

------------------------------------------------------------------------

# 16. Entry Loop (Arcade Spawn)

Upon entering a case: - Surface current stage - Surface one recommended
next action - Surface L2 trio - Surface L3 ribbon

Arcade promise: Easy to learn. Difficult to master.

------------------------------------------------------------------------

# 17. One-Sentence Mental Model

White commits intent.\
Black responds.\
Nothing changes without consent.\
Nothing happens silently.\
The case advances move-by-move.

------------------------------------------------------------------------

**Change note (v1.1):** Terminology generalized from “legal-making” to “structured reasoning” while preserving legal play as the first explicit domain; no behavioral or temporal rule changes.

End Of Spec Version: v1.1\
Status: Unified Constitutional Draft
