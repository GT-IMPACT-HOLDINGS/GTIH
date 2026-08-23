# QuoteMe v1 Narrative Manipulations & Inference Requests Spec (Legato-simple)
## Shared conventions (apply to all QuoteMe inference requests)

### Atomicity & approvals

Any model output is treated as a draft first.

“Approve” is an explicit user action in the UI; approvals gate downstream actions (e.g., EP generation).

### Language policy

Output language must match the Opportunity input language.

If input is English, output is English by default.

### Missing information

When key details are unknown, the model must insert explicit placeholders like:

<<<TBD>>>

<<<Ask customer>>>

<<<Confirm internally>>>

### Output requirements block
Every inference request includes an OUTPUT REQUIREMENTS section with:

Language rule (match input language).

Conciseness rule (no fluff; actionable, sales-ready).

Placeholder rule (use <<< >>>).

Formatting rule (headings/sections as required).

Stability rule (where applicable).

### Privacy

v1 sends inputs as-is (no automatic redaction).

Marked as future enhancement: optional redaction/masking for emails/phones/IDs.

### Profile & PA encoding

Profile is embedded as a short prose paragraph.

PA is embedded as a short prose paragraph (even if it contains section names).

### Role/persona

The system instructs GT3: “Sales Proposal Assistant for global B2B sales.”

## Inference Call A — Generate Proposal Anatomy (PA)

#### Trigger
Immediately after Landing Page profile submission (first-run onboarding).

#### Purpose
Create a global, reusable Proposal Anatomy tailored to the user’s profession/segment context (“mass-wisdom” baseline).

#### Input narrative (high-level structure)
```text
ROLE: Sales Proposal Assistant for global B2B sales.

PROFILE: short prose description of the salesperson’s context (segment, geo, typical motion, etc.).
```

#### OUTPUT REQUIREMENTS
```text
Produce a Proposal Anatomy that is:

Outline + recommended boilerplate micro-copy per section (1–3 sentences).

Minimal placeholders only where they truly help.

Clear, generic enough for global reuse, but tuned to the profile.

Editable by the user (no hard constraints baked in).
```

#### Expected output
A PA document with section headers in a logical order and suggested micro-copy under each section.

Includes <<<TBD>>> where profile lacks specifics (e.g., pricing model).

#### Storage
Saved as global PA, editable anytime from the PA page.

## Inference Call B — Propose Opportunity Title

#### Trigger
When (and only when) the Opportunity title field is empty/whitespace, after the user provides “new input” (uploaded/entered doc/narrative), QuoteMe requests a title proposal.

#### Purpose
Suggest a concise, meaningful Opportunity title for quick scanning and organization.

#### Input narrative
```text
ROLE: Sales Proposal Assistant for global B2B sales.

PROFILE: short prose paragraph.

NEW INPUT: the newly uploaded/entered document/narrative only.
```

#### OUTPUT REQUIREMENTS
```text
8–12 words maximum.

No emojis.

Include customer name if present in NEW INPUT.

Include product/solution keyword if present.

Avoid internal jargon.

Avoid sensitive personal data.

Match the language of NEW INPUT.
```

#### Expected output
A single-line title string.

#### Client-side application rule
Apply the proposal only if the title field is empty/whitespace; keep it fully editable.

## Inference Call C1 — Update Workplan (separate call)

#### Trigger
1. **Status approval workflow**: User manually edits Status textarea, then approves Status (via glyph toggle). If Workplan is empty, trigger Workplan generation from Profile + approved Status.
2. **NEW INPUT workflow**: User uploads a new document for an Opportunity. Trigger Workplan generation from Profile + previous approved Workplan/Status + NEW INPUT.

**Note**: The Status approval trigger applies whenever Workplan is empty (not just in day-zero mode). This matches Legato's behavior where approving Status automatically proposes a Workplan if none exists.

#### Purpose
Produce an updated Workplan draft grounded in:
- (Status approval workflow) Profile + approved Status
- (NEW INPUT workflow) Profile + previous approved Workplan/Status + NEW INPUT

Maintain maximum stability when previous Workplan exists.

#### Input narrative

**For Status approval workflow (Workplan empty):**
```text
ROLE: Sales Proposal Assistant for global B2B sales.

PROFILE: short prose paragraph.

PREVIOUS APPROVED WORKPLAN: (empty)

PREVIOUS APPROVED STATUS: (the newly approved Status text)

NEW INPUT: "No new document. The updated status is:\n[approved Status text]"
```

**For NEW INPUT workflow:**
```text
ROLE: Sales Proposal Assistant for global B2B sales.

PROFILE: short prose paragraph.

PREVIOUS APPROVED WORKPLAN: (may be empty on first run)

PREVIOUS APPROVED STATUS: (may be empty on first run)

NEW INPUT: newest uploaded/entered document/narrative for the Opportunity.
```

#### OUTPUT REQUIREMENTS
```text
Output only the updated Workplan.

Maximize stability:

Do not rewrite existing steps unless new input requires it.

Prefer appending or minimally editing.

Make steps actionable and sequenced.

Insert placeholders <<<TBD>>> where needed.

Match language of NEW INPUT.
```

#### Expected output
A Workplan draft (numbered or bulleted steps), sales-process oriented.

## Inference Call C2 — Update Status (separate call)

#### Trigger
- Automatically after each **new document/narrative upload** for an Opportunity (paired with a Workplan inference call; treated atomically at the app level).

#### Purpose
Produce an updated Status draft grounded in new input while maintaining stability.

#### Input narrative
```text
ROLE: Sales Proposal Assistant for global B2B sales.

PROFILE: short prose paragraph.

PREVIOUS APPROVED STATUS: (may be empty on first run)

PREVIOUS APPROVED WORKPLAN: (may be empty on first runxt)

NEW INPUT: newest uploaded/entered document/narrative.
```

#### OUTPUT REQUIREMENTS
```text
Output only the updated Status.

Maximize stability:

Avoid rewriting; append/adjust only what’s implied by NEW INPUT.

Include crisp “where we are now” and “what changed”.

Use placeholders as needed.

Match language of NEW INPUT.
```

#### Expected output
A Status draft: concise, factual, progress-oriented.

---
## Atomic behavior for Workplan + Status (application-level transaction)

Although Workplan and Status are generated via two separate GT3 calls, QuoteMe treats the user action as atomic in order to keep the present (status) and the future thinking (workplan) aligned:

#### Commit rule (v1)
If both calls succeed: update both draft textareas in the UI and persist them together.

If either call fails: show an error toast and discard both results (no partial updates, no saving).

#### Rationale
Preserves user trust and prevents “half-updated truth.”

## Inference Call D — Generate Engagement Proposal (EP)

#### Trigger
EP generation is **automatically triggered** when all prerequisites are met:
- PA exists (PA approval is not required - non-blocking gate per v1.6)
- Status approved (via glyph toggle)
- Workplan approved (via glyph toggle)

#### Purpose
Generate a customer-ready EP draft aligned to the global PA and the approved Opportunity state.

#### Inputs included (v1)
```text
PROFILE: short prose paragraph

PROPOSAL ANATOMY (PA): short prose paragraph

OPPORTUNITY TITLE: the final current title

APPROVED WORKPLAN: exact approved content

APPROVED STATUS: exact approved content
```

#### Output requirements
```text
Structured, section-labeled document.

Section order should follow the PA ordering.

Each section should be concise, sales-ready, and consistent with approved Workplan/Status.

Use <<<TBD>>> where necessary.

Match language of the approved content (and/or Opportunity language context).
```

#### Expected output
An EP draft with clear headings and content blocks suitable for editing directly on the Opportunity page (using draft-field component).

## Future considerations (explicitly out of scope for v1)

Automatic redaction/masking of sensitive data prior to inference.

Per-Opportunity or per-segment PA variants.

EP generation that also ingests the raw NEW INPUT narrative/doc.

Multi-pass refinement (e.g., objections handling, competitive positioning) as additional inference calls.
