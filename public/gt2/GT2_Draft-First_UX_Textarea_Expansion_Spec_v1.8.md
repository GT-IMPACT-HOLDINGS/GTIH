# GT2 Draft‑First UX & QuoteMe Header Row Spec
**Version:** 1.8  
**Scope:** GT2 applications (including QuoteMe)  
**Focus:** Draft‑First UX, standardized header rows, and expandable Draft‑First textareas.

---

## 1. Draft‑First UX Principles

### 1.1 Draft as Default
- Every AI / GT3 output is **always a draft**.
- Drafts are **editable inline** where they appear.
- There is no separate “edit mode”.

### 1.2 Five‑State Glyph Language
Each draft‑capable field exposes a single glyph that reflects authorship and approval state:

| State | Meaning | Glyph |
|------|--------|-------|
| Empty | No content | *(no glyph)* |
| User‑only | Authored only by user | ● |
| LM‑only | Authored only by LM | ◯ |
| LM + User edits | LM text modified by user | ◉ |
| Approved | Explicitly approved | ✓ in ◯ |

### 1.3 Glyph as Action
- Glyph is **clickable** to toggle approval.
- Tooltips (required):
  - Not approved → “Click to approve”
  - Approved → “Approved — click to unapprove”
- Keyboard accessible (Tab + Enter / Space).

### 1.4 Edits Revoke Approval
- Any user edit to an approved draft:
  - Automatically revokes approval.
  - Glyph transitions to the appropriate non‑approved state immediately.
- This behavior is local and deterministic (UI‑level).

---

## 2. Standard Header Row Layout

### 2.1 LTR Layout
- **Left:** Field title
- **Middle:** Inline action buttons (Generate, Regenerate, Upload, etc.)
- **Right:** Glyph control

### 2.2 RTL Layout
- Layout is mirrored:
  - **Right:** Field title
  - **Middle:** Actions
  - **Left:** Glyph
- Invariant: glyph always sits on the **outer edge**.

### 2.3 Action Button Rules
- Outlined, icon‑first buttons.
- Tooltips are mandatory.
- Glyph uses the **same rounded‑rectangle wireframe** as action buttons.

---

## 3. Draft‑First Textarea Expansion Behavior

### 3.1 Default (Collapsed) State
- Textarea opens in a **compact height**, similar to today’s size (or slightly smaller).
- Manual corner resize handles are **not relied upon** as the primary interaction.

### 3.2 Expand / Collapse Control (Bootstrap‑based)
- Expansion is controlled via a **standard Bootstrap collapse mechanism**.
- Control uses a **chevron icon**:
  - Chevron‑down → expand
  - Chevron‑up → collapse
- The same control design is reused everywhere.

### 3.3 Dual Control Locations (Expanded State)
When the textarea is expanded:
- A **collapse control appears in two places**:
  1. **Top** — alongside the header row action buttons.
  2. **Bottom** — directly below the textarea.
- Both controls are **visually and behaviorally identical**.

### 3.4 Expanded State Behavior
- Expanded mode grows the textarea to:
  - Fully fit its content **or**
  - Reach a defined max height with internal scrolling.
- Expansion / collapse transitions are smooth and non‑jarring.

### 3.5 Scroll Position Invariance (Critical)
- **When collapsing an expanded textarea:**
  - The **visible text location must not change**.
  - The line the user was viewing before collapse must remain visible after collapse.
- No jump to top, no reflow‑induced scroll reset.
- This rule applies regardless of whether collapse is triggered from the top or bottom control.

---

## 4. Accessibility & Interaction Rules

- Expand / collapse controls:
  - Are keyboard accessible.
  - Have `aria-expanded` and `aria-controls`.
- No loss of focus when toggling size.
- Reduced‑motion users receive non‑animated transitions.

---

## 5. Non‑Goals
- Styling beyond Bootstrap‑consistent visuals.
- Backend persistence rules.
- Analytics or telemetry for expansion behavior.

---

**Design intent:**  
The textarea should feel *elastic but stable*: it grows when the user wants space, shrinks when they want focus — and never disorients them.
