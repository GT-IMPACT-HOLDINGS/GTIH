# GT2 Micro‑UX Spec: Draft‑First, Inline‑Editable Outputs (v2.0)

**Proposed convention name (recommended): _Draft‑First UX_**  
Tagline: **"Every model output is a draft—editable where it appears."**

Alternate names (more "conference‑brandable"):  
- **Inline Draftflow**  
- **Living Draft UX**  
- **Editable‑by‑Default UX**  
- **Draft‑to‑Trust UX**

---

## 1) Purpose

Define the GT2 signature micro‑UX trait that differentiates GT2 vertical apps (e.g., Legato, QuoteMe):

> **All GT3/LLM outputs are treated as drafts. They are shown inline and are editable immediately at the point of use.**

This is intentionally different from many LLM apps that present outputs as finalized or as "read‑only until you click edit."

---

## 2) Core principles (non‑negotiable)

### P1 — Inline editability
**Any GT3 output must be presented as an editable text surface on the same screen where it is displayed.**  
No "read‑only + Edit page" patterns in v1+.

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
Any **GT3 generation action** related to a field (Generate/Regenerate/Retry/Sync) must be discoverable and performed **in the same header line as the glyph** (near the field title), not as a separate "control panel" elsewhere.

---

## 3) Artifact types and approval modes

GT2 artifacts fall into two approval modes:

### A) Explicit approval artifacts (hard gate)
These require explicit user approval before they can be used downstream.

Examples:
- Proposal Anatomy (PA) (when it gates EP generation)
- Workplan
- Status (when gating EP generation)
- Engagement Proposal (EP) approval before "Sent"

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

## 4) Standard UI pattern (the "Draft Card")

For any GT3 output displayed to the user, render the same micro‑pattern:

1. **Header row** (single line):
   - **Glyph** (authorship + approval indicator): positioned at outer edge (left for LTR, right for RTL)
   - **Label** (what this is): e.g., "Workplan", "Status", "Proposal Anatomy" — positioned 2 spaces after glyph
   - **Action buttons (inline)**: GT3 generation actions appear on the same line, at the opposite edge (Section 6)
   - **Expand/Collapse control** (optional): chevron button for textarea expansion (Section 9)
2. **Editable text area** (always enabled by default; except lifecycle locks)
   - **Collapsed state**: compact height (default, ~4 rows)
   - **Expanded state**: larger view with max height and internal scrolling (Section 9)
3. **Downstream gate**: buttons that depend on approval are disabled until conditions satisfied

> Important: **Do not use a dedicated "Approve" button** in v1+. Approval is performed by interacting with the **glyph**.

---

## 5) GT2 Field State Glyph System (5 states)

Use a small glyph (16×16 ideal) next to each field label (PA / Status / Workplan / EP).  
No permanent "Draft/Approved" words. The glyph is the primary language.

### 5.1 States

1) **Empty**  
- Meaning: empty textarea (`trim()==""`)  
- Glyph: **none** (no indicator, but placeholder reserves space for fixed label position)

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
- Color is optional; if used, reserve "success" accent for approval.
- Glyph uses the same rounded‑rectangle wireframe as action buttons for visual consistency.

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
- **Far right:** `Action buttons` (small icon buttons) + `Expand/Collapse control` (if applicable)

**For RTL applications (e.g., Legato):**
- **Rightmost:** `Glyph` (authorship + approval indicator)
- **2 spaces before Glyph:** `Label` (field title)
- **Far left:** `Action buttons` (small icon buttons) + `Expand/Collapse control` (if applicable)

**Visual example (LTR):**
```
[◯]  Status                    [📄] [🔄] [⌄]
↑    ↑                         ↑         ↑
Glyph Label (2 spaces gap)     Actions   Expand
```

**Visual example (RTL):**
```
[⌄] [📄] [🔄]                    Status  [◯]
↑                            ↑      ↑
Expand + Actions (far left)  Label  Glyph (2 spaces gap)
```

**Rationale:** This fixed order ensures:
- Glyph is always visually anchored to the edge (left for LTR, right for RTL)
- Label is consistently positioned relative to glyph (2 spaces gap)
- Actions are always on the opposite edge, maximizing discoverability
- No visual "jumping" when glyph state changes

If layout is RTL in a vertical app, mirror this consistently (i.e., "label+glyph cluster" remains adjacent; actions remain in the opposite edge of the row).

### 6.3 Action button visual language (required)
Buttons in the header row are **micro-buttons** (no heavy primary CTA styling):

- Default: **outlined**, compact, icon‑first (text optional via tooltip)
- Size: small (e.g., 28–32px height)
- Icons: minimal (Lucide acceptable where needed)
- State:
  - Disabled when action is gated/unavailable (visibly muted)
  - "Working" state uses a small spinner or animated spark on the button itself

### 6.4 Required tooltips (discoverability)
Every header action button must have a tooltip (and `aria-label`) describing the action, for example:
- "Generate draft"
- "Regenerate draft"
- "Retry generation"
- "Copy to clipboard"
- "Expand textarea" / "Collapse textarea"

### 6.5 Standard action types (recommended set)
Not every field needs every action, but when present, use consistent meaning:

1) **Generate**  
- Meaning: create the first draft for this field via GT3
- Icon: spark / wand
- Tooltip: "Generate draft"

2) **Regenerate**  
- Meaning: overwrite current field text with a new GT3 draft (and revoke approval)
- Icon: refresh
- Tooltip: "Regenerate draft"

3) **Retry**  
- Meaning: retry the last failed generation call for this field
- Icon: rotate‑cw / repeat
- Tooltip: "Retry generation"

4) **Copy** (optional)  
- Meaning: copy current text to clipboard
- Icon: copy
- Tooltip: "Copy"

5) **Upload** (optional)  
- Meaning: upload a file to trigger generation
- Icon: document / file
- Tooltip: "Upload to generate"

> Note: Do not add "Approve" as a button here. Approval is the **glyph toggle** (Section 7).

### 6.6 Button ordering (recommended)
If multiple actions exist, order them consistently:
1) Generate / Regenerate (mutually exclusive or shown as one depending on state)
2) Retry (only when last attempt failed)
3) Upload (if applicable)
4) Copy (optional utility)
5) Expand/Collapse (if applicable, at the end)

### 6.7 Generation feedback placement (required)
When a generation is triggered, the user must see feedback **in the same header row**:
- the triggering button enters "Working" state, OR
- a small inline spinner appears next to the actions

This avoids pushing "AI activity" elsewhere and keeps the micro‑loop tight.

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
  - **Tooltip:** "Click to approve"
- When **approved** and the glyph is hover/focus:
  - **Tooltip:** "Approved — click to unapprove"

Accessibility requirement:
- Provide `aria-label` equivalents for screen readers (same strings as tooltips).
- Keyboard accessible (Tab + Enter / Space).

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

## 9) Draft‑First Textarea Expansion Behavior

### 9.1 Default (Collapsed) State
- Textarea opens in a **compact height** (default ~4 rows).
- Manual corner resize handles are **not relied upon** as the primary interaction (resize disabled via CSS).

### 9.2 Expand / Collapse Control (Bootstrap‑based)
- Expansion is controlled via a **standard Bootstrap collapse mechanism**.
- Control uses a **chevron icon**:
  - Chevron‑down (⌄) → expand
  - Chevron‑up (⌃) → collapse
- The same control design is reused everywhere.
- Control appears in the header row alongside action buttons (always visible).

### 9.3 Dual Control Locations (Expanded State)
When the textarea is expanded:
- A **collapse control appears in two places**:
  1. **Top** — alongside the header row action buttons (same as expand control, now shows chevron-up).
  2. **Bottom** — directly below the expanded textarea (centered, full-width button).
- Both controls are **visually and behaviorally identical**.
- Bottom control is hidden when collapsed, shown when expanded.

### 9.4 Expanded State Behavior
- Expanded mode grows the textarea to:
  - Fully fit its content **or**
  - Reach a defined max height (e.g., 600px) with internal scrolling.
- Expansion / collapse transitions are smooth and non‑jarring.
- Both collapsed and expanded textareas are kept in sync (value changes propagate immediately).

### 9.5 Scroll Position Invariance (Critical)
- **When collapsing an expanded textarea:**
  - The **visible text location must not change**.
  - The line the user was viewing before collapse must remain visible after collapse.
  - No jump to top, no reflow‑induced scroll reset.
- This rule applies regardless of whether collapse is triggered from the top or bottom control.
- Implementation must:
  1. Save scroll position before collapse.
  2. Calculate which line was visible.
  3. Restore scroll position in collapsed textarea to show the same line.

### 9.6 Accessibility & Interaction Rules
- Expand / collapse controls:
  - Are keyboard accessible (Tab + Enter / Space).
  - Have `aria-expanded` and `aria-controls` attributes.
- No loss of focus when toggling size (focus moves to appropriate textarea).
- Reduced‑motion users receive non‑animated transitions (respect `prefers-reduced-motion` media query).

**Design intent:**  
The textarea should feel *elastic but stable*: it grows when the user wants space, shrinks when they want focus — and never disorients them.

---

## 10) Lifecycle lock exception (rare)

Some artifacts may become read‑only due to lifecycle (not preference), e.g.:
- EP becomes read‑only after `Sent=true` (QuoteMe v1)

If locked, it must be explicitly documented in the vertical's StateMachine spec.
Even when locked:
- glyph still reflects state
- the approval toggle may be disabled (with tooltip explaining why)
- regeneration buttons must follow the vertical spec's rules (often disabled after "Sent")
- expand/collapse control may be disabled if appropriate

---

## 11) Compliance checklist (implementation review)

A screen is compliant with Draft‑First UX if:

- [ ] GT3 outputs are **editable inline** where shown (no edit page)
- [ ] Output is treated as **draft by default**
- [ ] Explicit approvals are performed via **glyph toggle**, not a button
- [ ] **Tooltips exist**: "Click to approve" / "Approved — click to unapprove"
- [ ] Any GT3 generation action for the field is in the **header row near the glyph**
- [ ] Header action buttons have tooltips/aria-labels and show "Working" feedback inline
- [ ] Editing an approved field **revokes approval**
- [ ] Any read‑only behavior is lifecycle‑justified and spec'd
- [ ] Textarea expansion uses Bootstrap collapse mechanism
- [ ] Dual collapse controls appear when expanded (top and bottom)
- [ ] Scroll position is preserved when collapsing (scroll position invariance)
- [ ] Expand/collapse controls are keyboard accessible and have proper ARIA attributes

---

## 12) Rationale (why this is GT2‑unique)

This micro‑UX turns LLM generation into a **collaborative drafting loop** rather than an "AI answer machine."  
It creates:
- user agency
- predictable gating (trust as a first-class state)
- professional-grade auditability
- a distinctive GT2 brand feel: **"AI drafts, humans decide."**
- elastic, stable text editing experience that adapts to user needs without disorientation

---

## Version History

- **v2.0** (Current): Merged v1.1 (Draft-First MicroUX) with v1.8 (Textarea Expansion). Added expandable textarea behavior with dual controls and scroll position invariance.
- **v1.1**: Original Draft-First MicroUX spec with header row actions.
- **v1.8**: Textarea Expansion spec (now integrated into v2.0).

