# Lexiom Provenance Spine Specifications (v1.0)

> **Purpose**\
> This specification defines the **Git-at-the-core provenance spine** of
> **Lexiom**: the immutable move ledger, artifact addressing,
> proposal/acceptance workflow, and the guarantees required for
> asynchronous collaboration in **Zenith** (solo) and **Accord**
> (shared) modes.

> **Scope**\
> Applies to all Lexiom MVP implementations that:\
> - default to **Zenith** (solo) sessions,\
> - allow seamless transition into **Accord** (shared) sessions,\
> - treat the shared case space as a **published/accepted** record
> rather than a live co-edit canvas.

> **Non-goals (MVP)**\
> - Real-time co-editing with automatic merges (Google-Docs style).\
> - Exposing Git terminology (rebase, cherry-pick, merge conflicts) to
> users.\
> - Full cryptographic notarization by default (optional extension).

------------------------------------------------------------------------

## 1. Core Principles

1.  **Moves are immutable**: once created, a Move is never edited---only
    superseded by newer Moves.\
2.  **Draft is private; record is shared**: users create drafts
    privately; only **explicitly published** Moves enter shared view.\
3.  **Acceptance creates the "case truth"**: the canonical case state is
    derived from **accepted** Moves (mainline).\
4.  **Asynchronous collaboration**: no turn-taking is enforced;
    collaboration is achieved through **publish + accept**.\
5.  **Everything is attributable**: every published item is attributable
    to an author, time, and intent.\
6.  **Artifacts are content-addressed**: files/derived data are
    referenced by stable hashes/pointers.\
7.  **Lexiom UX verbs map to Git semantics invisibly**: Draft / Publish
    / Accept / Comment / Fork / Compare.

------------------------------------------------------------------------

## 2. Definitions

### 2.1 Case

A **Case** is the logical workspace for a matter/dispute/project. It
maps to a **case-root directory** in the underlying file system (or
object-store namespace).

### 2.2 User Spaces

-   **Private Draft Space (per user, per case)**: workspace for
    experimentation and "playing against one's Lexiom."\
-   **Shared Space (per case)**: the visible, collaborative "board"
    populated by published artifacts and moves.

### 2.3 Move

A **Move** is the atomic unit of contribution to the provenance spine,
representing a user-approved action intended for publication.

A Move may include: - A document draft or edit outcome - A case insight
(semantic realization) - A decision record (e.g., "use Template B") - A
request to Lexiom that yields a structured output - A published
comment/annotation on another Move

### 2.4 Proposal

A **Proposal** is a Move (or chain of Moves) that is **published** to
the shared board but not yet **accepted** into the canonical case
record.

### 2.5 Acceptance

**Acceptance** is the explicit action that promotes a Proposal (Move)
into the **accepted mainline** of the Case.

### 2.6 Artifact

An **Artifact** is any file or derived representation (md, txt, docx,
pdf, json, extracted text, embeddings pointer, etc.) referenced from a
Move.\
In the MVP **Lexiom arcade**, authored documents are **Markdown-first**:
canonical case narratives and working drafts are preferably stored as
`*.md` files (e.g. `meeting_with_client.md`), with other formats treated
as derivatives or later extensions.

------------------------------------------------------------------------

## 3. Identity, Authorship, and Time

### 3.1 Identity

Each Move MUST record: - `author_user_id` - `author_display_name` -
`author_avatar_ref` (optional)

### 3.2 Time

Each Move MUST record: - `created_at` (server time, canonical) -
`client_created_at` (optional, for diagnostics) - `published_at` (if
published) - `accepted_at` (if accepted)

### 3.3 Attribution UX

In shared views, every published element MUST display: - author
avatar/name - publish time (absolute timestamp) - state badge: Draft
(private), Published, Accepted, Rejected (optional)

------------------------------------------------------------------------

## 4. The Provenance Spine Data Model

### 4.1 Move Object (Logical Schema)

Minimum fields:

-   `move_id` (stable unique identifier)
-   `case_id`
-   `parents[]` (zero or more parent move IDs; MVP typically 1 parent
    for linear chains)
-   `author_user_id`
-   `created_at`
-   `move_type` (e.g., DOCUMENT_PUBLISH, COMMENT, DECISION, INSIGHT,
    REQUEST_RESULT)
-   `title` (short human-readable)
-   `summary` (1--3 lines for board display)
-   `payload_ref` (pointer to structured payload, content-addressed)
-   `artifact_refs[]` (list of artifact pointers/hashes)
-   `state` ∈ {DRAFT, PUBLISHED, ACCEPTED, REJECTED, SUPERSEDED}
-   `publish_intent` (human intention label; e.g., "proposal",
    "decision", "note")

Optional fields: - `tags[]` (template, topic, urgency) - `mentions[]`
(user IDs) - `linked_moves[]` (references to relevant prior moves) -
`confidence` (Lexiom's internal confidence; may stay hidden in MVP)

### 4.2 Mainline vs Side Paths

-   **Accepted mainline**: the ordered sequence of accepted Moves that
    define the canonical case state.
-   **Side paths**: published but unaccepted proposals, forks,
    alternatives.

MVP constraint: - Acceptance prefers **fast-forward** into mainline (no
complex merges).\
- "Merge" means "accept a proposal," not "auto-resolve textual diffs."

------------------------------------------------------------------------

## 5. Case Ledger and State Derivation

### 5.1 Ledger

A Case ledger is the append-only log of Moves.

### 5.2 Deriving "Current Case State"

The UI and cockpit context SHOULD be derived from: - all accepted Moves
(mainline)\
- optionally: the most recent published proposals not yet accepted
(configurable)

### 5.3 Replay Semantics

Given a case, it MUST be possible to: - reconstruct the accepted state
by replaying accepted Moves in order - export an audit trail of accepted
and published events

------------------------------------------------------------------------

## 6. Publish--Accept Workflow

### 6.1 Draft → Publish

A user may publish a Move only after: - reviewing the draft output -
explicitly selecting **Publish** (or "Publish as Proposal")

Publish MUST: - create a new immutable Move with `state=PUBLISHED` -
write it to the shared ledger - render it on the shared board

### 6.2 Publish → Accept

Acceptance MUST be explicit, by a user with acceptance permission.

Accept MUST: - mark the Move `ACCEPTED` - advance the case mainline head
to this Move (fast-forward semantics) - optionally mark competing
proposals as `SUPERSEDED` (not deleted)

### 6.3 Comments

Comments are Moves: - `move_type=COMMENT` - with `linked_moves`
referencing the target Move(s)

### 6.4 Reject

Reject is optional in MVP. If present: - state becomes `REJECTED` -
remains in history for transparency

------------------------------------------------------------------------

## 7. Branching and Forking Semantics

### 7.1 Fork (User Meaning)

Fork means: "I'm pursuing an alternate line of reasoning or drafting
based on the same base state."

### 7.2 Fork (System Meaning)

Fork creates a new proposal chain that references: - the base accepted
head (or another proposal) as parent

### 7.3 Reconciliation

MVP reconciliation is human-led: - users compare proposals - accept
one - optionally create a new Move that synthesizes both (manual
"merge")

------------------------------------------------------------------------

## 8. Artifact Addressing and Storage

### 8.1 Content Addressing

Artifacts MUST be referenced by: - `artifact_hash` (e.g., SHA-256) -
`artifact_uri` (object-store key or filesystem path) - `artifact_kind`
(docx, pdf, txt, json, embedding_ref, etc.) - `artifact_size` and
`mime_type` (recommended)

### 8.2 Repository Bloat Avoidance

The provenance spine SHOULD store: - pointers/hashes and metadata in the
"spine store" - binaries and large content in an object store (or
deduplicated FS)

### 8.3 Derived Representations

For each document, the system MAY generate: - extracted text -
structured outline - semantic tags - embeddings reference

These SHOULD be stored as separate artifacts referenced from the Move.

### 8.4 Markdown-First Artifact Policy (MVP)

MVP adopts a **Markdown-first** policy for authored documents:

- The canonical case narrative and primary working drafts SHOULD be
  stored as Markdown (`*.md`) artifacts in the provenance spine.
- Other formats (docx, pdf, html, etc.) MAY exist as **derived**
  representations or future extensions, referenced from the same Move.
- The spine itself remains format-agnostic (`artifact_kind` and
  `mime_type` capture actual types), but the **Lexiom game experience**
  prefers Markdown for: diffability, portability, and Git-friendly
  history.

As Lexiom evolves, additional artifact formats MAY be introduced into
the arcade experience **by explicit design agreement**, without
changing the underlying provenance guarantees.

------------------------------------------------------------------------

## 9. Diff and Compare

### 9.1 Compare Goals

Users must be able to: - see what changed between two accepted states -
compare a proposal against the current accepted head - understand change
at human-meaning level, not only line diffs

### 9.2 Diff Types (MVP)

-   **Text diff** (for extracted text)
-   **Metadata diff** (title, parties, dates, template fields)
-   **Artifact set diff** (added/removed files)

### 9.3 Binary Docs

For docx/pdf: - diff primarily uses extracted text + metadata -
optionally show side-by-side render previews

------------------------------------------------------------------------

## 10. Access Control and Visibility

### 10.1 Visibility Rule (Per Your Decision)

In a shared case, **everyone with case access can see everything** in
the case-root shared space.

### 10.2 Publishing Permissions

Define at least: - who can invite others - who can publish - who can
accept

MVP default suggestion: - all case participants can publish - acceptance
restricted to a role (e.g., "Case Owner") OR a configurable quorum

### 10.3 Directory Mapping

Accord mode reveals collaborators as avatars tied to the same case-root
directory. Lexiom assumes artifacts in the directory are
context-relevant, subject to permissions.

------------------------------------------------------------------------

## 11. Concurrency and Soft Locks

### 11.1 No Turn Governance

Lexiom does not enforce turns. Users act asynchronously.

### 11.2 Soft Lock (Courtesy)

If implemented, the "lock" is a presence signal: - "X is editing---open
read-only or clone to your draft?" - It MUST NOT block publishing a
separate proposal.

### 11.3 Collision Handling

If two users publish competing documents: - both proposals appear on the
board - acceptance resolves which becomes canonical - the non-accepted
remains as history (optionally marked superseded)

------------------------------------------------------------------------

## 12. Provenance, Audit, and Export

### 12.1 Audit Requirements

For each Move, record: - who authored it - when it was
created/published/accepted - what artifacts it references - what it
supersedes or depends on

### 12.2 Exports

MVP export types: - **Case Activity Ledger** (JSON/CSV) - **Case Record
Bundle** (accepted artifacts + accepted ledger snapshot) - **Board
Timeline PDF** (optional)

### 12.3 Integrity

Optionally support: - signed Move manifests - tamper-evident hashing
chain (each Move hash includes parent hash)

------------------------------------------------------------------------

## 13. Sync, Offline, and Latency

### 13.1 Sync Model

-   local caching of artifacts permitted
-   the ledger is the authoritative sequence of published/accepted moves

### 13.2 Delivery Guarantees (MVP)

-   publishing should be **at-least-once** with idempotent Move IDs
-   UI must gracefully handle duplicate delivery

### 13.3 Offline Drafting

Users may draft offline; publishing requires connectivity and server
timestamping.

------------------------------------------------------------------------

## 14. UX Mapping Table (Internal)

  Lexiom UX Verb   Spine Action (Internal)        User-Visible Meaning
  ---------------- ------------------------------ ------------------------------
  Draft            Create private working state   "Play privately with Lexiom"
  Publish          Append PUBLISHED Move          "Propose to shared board"
  Accept           Mark ACCEPTED + advance head   "Make it part of record"
  Comment          Append COMMENT Move            "Discuss / annotate"
  Fork             New proposal chain             "Try alternative"
  Compare          Diff two states                "See what changed"

------------------------------------------------------------------------

## 15. Constitutional Commitments (MVP Binding Decisions)

This chapter replaces prior "Open Decisions" and formalizes the binding
strategic choices adopted during synthesis.\
These principles define the normative behavior of the Provenance Spine
in MVP.

------------------------------------------------------------------------

### 15.1 Acceptance Authority Model

**Unanimous Acceptance Required.**

A published Move becomes canonical only when **all core participants
explicitly accept it**.

Implications: - No single-user canonization authority. - Silence does
not equal consent. - The accepted mainline represents mutual semantic
legitimacy. - Pending proposals remain visible until consensus is
achieved.

------------------------------------------------------------------------

### 15.2 Silent Participant Policy

**No timeout-based canonization in MVP.**

If a participant does not respond, the Move remains in **Published
(Pending Acceptance)** state indefinitely.

Implications: - Lexiom encodes patience rather than procedural
coercion. - No owner override or automatic escalation in MVP. - Soft
nudges may be introduced without changing the unanimity rule.

------------------------------------------------------------------------

### 15.3 Rejection Philosophy

**No explicit "Reject" action exists.**

A Move is never formally rejected.\
Alternative Moves may be published and accepted, implicitly superseding
others.

Implications: - Evolution replaces negation. - No semantic deletion of
ideas. - All proposals remain historically visible. - Supersession is
achieved through acceptance of an alternative.

------------------------------------------------------------------------

### 15.4 Move Taxonomy Simplicity

**All items are labeled simply as "Move."**

No taxonomy (Proposal / Decision / Note) is introduced in MVP.

Implications: - Reduced cognitive overhead. - Avoids premature workflow
rigidity. - Meaning derives from content and acceptance state. - Future
taxonomies may layer without structural redesign.

------------------------------------------------------------------------

### 15.5 Minimal Diff Commitment

**Red/green inline text diff only.**

Diff operates on extracted canonical text.

Implications: - No layout-aware or binary-level diff required in MVP. -
No side-by-side rendered comparison required. - Textual semantic delta
is considered sufficient. - Implementation remains lightweight and
reliable.

------------------------------------------------------------------------

### 15.6 Full Ledger Export Policy

**Export includes the complete ledger, including unaccepted proposals.**

The export bundle MUST contain: - All accepted Moves - All published but
unaccepted Moves - Author and timestamp metadata - Artifact references
(content-addressed) - Ordered ledger structure

Implications: - Lexiom functions as a transparent provenance system. -
Historical semantic evolution is preserved. - No hidden or deleted
proposal history. - Enables legal defensibility and dispute
transparency.

------------------------------------------------------------------------

### 15.7 Constitutional Coherence

The MVP Provenance Spine now encodes:

-   Immutable Moves
-   Unanimous canonization
-   No silent acceptance
-   No rejection, only supersession
-   No taxonomy complexity
-   Minimal text-based diff
-   Full transparent export

Lexiom is thereby positioned as:

-   A semantic provenance ledger
-   An asynchronous constitutional collaboration engine
-   A history-preserving arcade for structured resolution

## end of spec
