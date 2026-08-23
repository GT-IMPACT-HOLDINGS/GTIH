# GT2 Micro‑UX Spec: Draft‑First, Inline‑Editable Outputs (v1.1)

**Proposed convention name (recommended): _Draft‑First UX_**  
Tagline: **“Every model output is a draft—editable where it appears.”**

Alternate names (more “conference‑brandable”):  
- **Inline Draftflow**  
- **Living Draft UX**  
- **Editable‑by‑Default UX**  
- **Draft‑to‑Trust UX**

---

## 1) Purpose

Define the GT2 signature micro‑UX trait that differentiates GT2 vertical apps (e.g., Legato, QuoteMe):

> **All GT3/LLM outputs are treated as drafts. They are shown inline and are editable immediately at the point of use.**

This is intentionally different from many LLM apps that present outputs as finalized or as “read‑only until you click edit.”

---

## 2) Core principles (non‑negotiable)

### P1 — Inline editability
**Any GT3 output must be presented as an editable text surface on the same screen where it is displayed.**  
No “read‑only + Edit page” patterns in v1+.

### P2 — Draft is the default
Every GT3 output is assumed to be **draft** unless and until an explicit or implicit approval is applied.

### P3 — Approval is a gate, not an editor toggle
Approval is a **trust state / permission gate** (enables downstream actions), not a UI mechanism to allow editing.

### P4 — Edits revoke approval
If the user edits a previously approved draft, the relevant approval is revoked automatically and must be re‑granted (unless a vertical spec explicitly says otherwise).

### P5 — Minimal friction
The micro‑UX should reduce steps:
- model suggests → user edits → (optional) user approves → next action enabled

### P6 — Action consistency
Any **GT3 generation action** related to a field (Generate/Regenerate/Retry/Sync) must be discoverable and performed **in the same header line as the glyph** (near the field title), not as a separate “control panel” elsewhere.

---

## 3) Artifact types and approval modes

GT2 artifacts fall into two approval modes:

### A) Explicit approval artifacts (hard gate)
These require explicit user approval before they can be used downstream.

Examples:
- Proposal Anatomy (PA) (when it gates EP generation)
- Workplan
- Status (when gating EP generation)
- Engagement Proposal (EP) approval before “Sent”

**UX rules:**
- Approval must be **inline** and lightweight (see Sections 4–7).
- While not approved, downstream actions remain disabled and visually de‑emphasized.
- Approved state must be clearly visible via the **state glyph** (no heavy labels/buttons).

### B) Implicit approval artifacts (soft gate)
Editable drafts that do not require explicit approval to exist or to be used.

Examples:
- Opportunity title suggestion (auto‑fill only if empty)

**UX rules:**
- Content is editable inline immediately.
- If the system suggested it, the user can accept by doing nothing.
- If the user edits, the edited content becomes the source of truth.

---

## 4) Standard UI pattern (the “Draft Card”)

For any GT3 output displayed to the user, render the same micro‑pattern:

1. **Header row** (single line):
   - **Label** (what this is): e.g., “Workplan”, “Status”, “Proposal Anatomy”
   - **Field state glyph** (tiny, next to the label): authorship + approval language (Section 5)
   - **Action buttons (inline)**: GT3 generation actions appear on the same line (Section 6)
2. **Editable text area** (always enabled by default; except lifecycle locks)
3. **Downstream gate**: buttons that depend on approval are disabled until conditions satisfied

> Important: **Do not use a dedicated “Approve” button** in v1+. Approval is performed by interacting with the **glyph**.

---

## 5) GT2 Field State Glyph System (5 states)

Use a small glyph (16×16 ideal) next to each field label (PA / Status / Workplan / EP).  
No permanent “Draft/Approved” words. The glyph is the primary language.

### 5.1 States

1) **Empty**  
- Meaning: empty textarea (`trim()==""`)  
- Glyph: **none** (no indicator)

2) **User‑only**  
- Meaning: content exists and originated only from user typing  
- Glyph: **filled dot** (●)

3) **LM‑only**  
- Meaning: content exists and originated only from GT3; user has not edited since last fill  
- Glyph: **hollow ring** (◯)

4) **LM + User edits**  
- Meaning: GT3 draft exists and user edited it  
- Glyph: **filled dot inside hollow ring** (◉)  
  (Implement as ring + center dot.)

5) **Approved**  
- Meaning: user explicitly approved current content (trust gate satisfied)  
- Glyph: **check inside hollow ring** (ring + ✓)

### 5.2 Visual intent
- The glyph communicates **authorship** (LM vs human) and **trust state** (approved) at a glance.
- Color is optional; if used, reserve “success” accent for approval.

---

## 6) Inline action buttons (header row standard)

### 6.1 Goal
Standardize the micro‑UX so that **any GT3 generation action** related to a field is available in the **same horizontal line** as:
- the field label
- the field glyph

This applies across all GT2 applications.

### 6.2 Header row layout (required)
A Draft Card header row is structured with a specific order:

**For LTR applications (e.g., QuoteMe):**
- **Leftmost:** `Glyph` (authorship + approval indicator)
- **2 spaces after Glyph:** `Label` (field title, e.g., "Status", "Workplan")
- **Far right:** `Action buttons` (small icon buttons)

**For RTL applications (e.g., Legato):**
- **Rightmost:** `Glyph` (authorship + approval indicator)
- **2 spaces before Glyph:** `Label` (field title)
- **Far left:** `Action buttons` (small icon buttons)

**Visual example (LTR):**
```
[◯]  Status                    [📄] [🔄]
↑    ↑                         ↑
Glyph Label (2 spaces gap)     Actions (far right)
```

**Visual example (RTL):**
```
[📄] [🔄]                    Status  [◯]
↑                            ↑      ↑
Actions (far left)           Label  Glyph (2 spaces gap)
```

**Rationale:** This fixed order ensures:
- Glyph is always visually anchored to the edge (left for LTR, right for RTL)
- Label is consistently positioned relative to glyph (2 spaces gap)
- Actions are always on the opposite edge, maximizing discoverability
- No visual "jumping" when glyph state changes

If layout is RTL in a vertical app, mirror this consistently (i.e., “label+glyph cluster” remains adjacent; actions remain in the opposite edge of the row).

### 6.3 Action button visual language (required)
Buttons in the header row are **micro-buttons** (no heavy primary CTA styling):

- Default: **outlined**, compact, icon‑first (text optional via tooltip)
- Size: small (e.g., 28–32px height)
- Icons: minimal (Lucide acceptable where needed)
- State:
  - Disabled when action is gated/unavailable (visibly muted)
  - “Working” state uses a small spinner or animated spark on the button itself

### 6.4 Required tooltips (discoverability)
Every header action button must have a tooltip (and `aria-label`) describing the action, for example:
- “Generate draft”
- “Regenerate draft”
- “Retry generation”
- “Copy to clipboard”

### 6.5 Standard action types (recommended set)
Not every field needs every action, but when present, use consistent meaning:

1) **Generate**  
- Meaning: create the first draft for this field via GT3
- Icon: spark / wand
- Tooltip: “Generate draft”

2) **Regenerate**  
- Meaning: overwrite current field text with a new GT3 draft (and revoke approval)
- Icon: refresh
- Tooltip: “Regenerate draft”

3) **Retry**  
- Meaning: retry the last failed generation call for this field
- Icon: rotate‑cw / repeat
- Tooltip: “Retry generation”

4) **Copy** (optional)  
- Meaning: copy current text to clipboard
- Icon: copy
- Tooltip: “Copy”

> Note: Do not add “Approve” as a button here. Approval is the **glyph toggle** (Section 7).

### 6.6 Button ordering (recommended)
If multiple actions exist, order them consistently:
1) Generate / Regenerate (mutually exclusive or shown as one depending on state)
2) Retry (only when last attempt failed)
3) Copy (optional utility)

### 6.7 Generation feedback placement (required)
When a generation is triggered, the user must see feedback **in the same header row**:
- the triggering button enters “Working” state, OR
- a small inline spinner appears next to the actions

This avoids pushing “AI activity” elsewhere and keeps the micro‑loop tight.

---

## 7) Approval interaction: glyph toggle (required)

For explicit-approval artifacts (PA/Status/Workplan/EP where applicable):

### 7.1 How to approve
- The glyph is **clickable**.
- Clicking toggles approval:
  - **Immediate visual feedback**: When clicking to approve, the glyph **immediately** changes to ring+check (◯✓) before the approval callback is executed. This provides instant feedback even if the callback triggers an async operation (e.g., inference call).
  - **Not approved → Approved**: Glyph immediately shows ring+check (◯✓), then the approval callback is executed.
  - **Approved → Not approved**: Glyph immediately returns to the appropriate authorship state (see unapproving behavior below), then the unapproval callback is executed.
- **Unapproving behavior**: When unapproving (clicking approved glyph), the glyph **immediately** returns to the appropriate authorship state:
  - If `hasLmDraft && hasUserEdits`: show ◉ (LM + User)
  - Else if `hasLmDraft`: show ◯ (LM-only)
  - Else if user-only content: show ● (User-only)
  - The glyph reflects the last known authorship state, not a default state
- **Error handling**: If the approval callback fails (e.g., inference error), the glyph should revert to the previous state. The implementation should handle this gracefully.

### 7.2 Required tooltip (discoverability)
Because this interaction is intentionally minimal, the UI must include a tooltip / hint:

- When **not approved** and the glyph is hover/focus:
  - **Tooltip:** “Click to approve”
- When **approved** and the glyph is hover/focus:
  - **Tooltip:** “Approved — click to unapprove”

Accessibility requirement:
- Provide `aria-label` equivalents for screen readers (same strings as tooltips).

### 7.3 Editing behavior (auto-revoke)
If a user edits a field that is currently approved:
- approval is immediately revoked
- glyph returns from ring+check to the appropriate authorship glyph (◯/●/◉)
- downstream gates are re-disabled as required

---

## 8) Minimal implementation model (recommended)

To compute the 5 states robustly, track per field:

- `text` (string)
- `approved` (boolean; only for explicit approval artifacts)
- `hasLmDraft` (boolean)
- `hasUserEdits` (boolean; set true on first user change after GT3 fill)
- `lastGen` (optional): `{ status: "idle|working|error", ts, errorPreview }` used only to drive which header action (Generate/Retry) is visible.

Derive glyph state:

1. if `text.trim()==""` → Empty (no glyph)  
2. else if `approved==true` → Approved (ring+check)  
3. else if `hasLmDraft && hasUserEdits` → LM+User (◉)  
4. else if `hasLmDraft` → LM-only (◯)  
5. else → User-only (●)

---

## 9) Lifecycle lock exception (rare)

Some artifacts may become read‑only due to lifecycle (not preference), e.g.:
- EP becomes read‑only after `Sent=true` (QuoteMe v1)

If locked, it must be explicitly documented in the vertical’s StateMachine spec.
Even when locked:
- glyph still reflects state
- the approval toggle may be disabled (with tooltip explaining why)
- regeneration buttons must follow the vertical spec’s rules (often disabled after “Sent”)

---

## 10) Compliance checklist (implementation review)

A screen is compliant with Draft‑First UX if:

- [ ] GT3 outputs are **editable inline** where shown (no edit page)
- [ ] Output is treated as **draft by default**
- [ ] Explicit approvals are performed via **glyph toggle**, not a button
- [ ] **Tooltips exist**: “Click to approve” / “Approved — click to unapprove”
- [ ] Any GT3 generation action for the field is in the **header row near the glyph**
- [ ] Header action buttons have tooltips/aria-labels and show “Working” feedback inline
- [ ] Editing an approved field **revokes approval**
- [ ] Any read‑only behavior is lifecycle‑justified and spec’d

---

## 11) Rationale (why this is GT2‑unique)

This micro‑UX turns LLM generation into a **collaborative drafting loop** rather than an “AI answer machine.”  
It creates:
- user agency
- predictable gating (trust as a first-class state)
- professional-grade auditability
- a distinctive GT2 brand feel: **“AI drafts, humans decide.”**
