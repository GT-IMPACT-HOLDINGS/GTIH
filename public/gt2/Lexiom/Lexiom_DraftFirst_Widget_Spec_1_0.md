# Lexiom Draft-First Widget Spec v1.0
**Status:** Wireframe — UI component contract  
**Source-of-truth lineage:** .\public\gt2\GT2_DraftFirst_MicroUX_Spec_v2.0.md, with Lexiom wireframe bindings and Lexiom-specific adjustments.

---

## 1) Purpose
Define the **single reusable “Draft Card” widget** used by Lexiom’s draft-first surfaces (L1 Identity, Proposed Action Item Draft, Private/shared Artifact Drafts). The widget enforces the GT2 principle: **outputs are drafts, editable inline, with explicit approval as a trust gate**.

---

## 2) Lexiom adjustments vs GT2 Draft-First (normative)
Lexiom wireframe intentionally simplifies GT2 Draft-First:

1) **No inline header actions**   
   - Any generation/commit controls are provided by the **hosting activity**, not by this widget.  
2) **Always expanded**: no collapse/expand mechanism; no dual collapse controls; no scroll-position invariance requirements.  
3) **Approval glyph is the only clickable control in the header**.  
4) **Silent auto-revoke**: editing an approved draft revokes approval with **no toast/banners**; only the glyph changes.  
5) **Multi-line editing**: Enter inserts newline; standard selection/editing.

---

## 3) Where this widget is used
This widget is used in the **Center Playfield only** (Center-only execution).

Required surfaces:
- **L1 Identity Activity** → Draft Card  
- **Action Item Draft Activity** (proposed slot) → Draft Card  
- **Document Draft Activity** (private/shared artifact) → Draft Card  

Non-usage:
- Side panels **must not** host editable Draft Cards.

---

## 4) Component anatomy (required)
A Draft Card consists of exactly:

### 4.1 Header row (single line)
- **Label + glyph** are rendered in a single header row (current implementation places label first and glyph button at the opposite edge).  
- No other controls in the header.

**Header interactivity**
- Only the **glyph** is clickable.
- The label is inert (no toggles, no menus, no buttons).

### 4.2 Body
- **Editable textarea** (always enabled).  
- Multi-line behavior; Enter inserts newline.

### 4.3 No meta
- No “Draft/Approved” labels, timestamps, move IDs, or provenance lines are shown in this widget (arcade-clean).  
  (The glyph is the only state language.)

---

## 5) Glyph system (required)
Lexiom uses the **same 5-state meaning** as GT2.

| State | Meaning | Glyph |
|---|---|---|
| Empty | `text.trim()==""` | *(no glyph)* |
| User-only | content originated from user typing | `●` |
| LM-only | content originated from GT3; user has not edited since last fill | `◯` |
| LM + User edits | GT3 draft exists and user edited it | `◉` |
| Approved | user explicitly approved current content | `◯✓` |

**Rendering rule**
- The glyph is rendered as monochrome, aligned to a fixed width so the label never “jumps” as glyph changes.

---

## 6) State model (recommended; must support deterministic glyph)
Track per Draft Card:

```txt
id: string
text: string
approved: boolean
hasLmDraft: boolean
hasUserEdits: boolean
```

Derive glyph state:
1. if `text.trim()==""` → Empty  
2. else if `approved==true` → Approved (`◯✓`)  
3. else if `hasLmDraft && hasUserEdits` → `◉`  
4. else if `hasLmDraft` → `◯`  
5. else → `●`

---

## 7) Interaction rules (required)

### 7.1 Typing (draft-first)
- Typing edits `text` immediately.
- If `approved==true`, any edit triggers **auto-revoke**:
  - set `approved=false`
  - glyph returns to `◯` / `●` / `◉` according to authorship flags
  - **no toast or banner** (silent).

### 7.2 Approval toggle (glyph click)
- Clicking the glyph toggles approval:
  - Not approved → Approved (`◯✓`)
  - Approved → Not approved (return to the correct authorship glyph, not a default).

**Important**
- There is **no “Approve” button** anywhere in the card.

### 7.3 Tooltips
- Optional in Lexiom wireframe. If implemented: “Click to approve” / “Approved — click to unapprove”.

---

## 8) Hosting-activity responsibilities (explicit boundary)
Because Lexiom removed inline actions, the **Draft Card widget does not implement generation/regen/retry/copy**.

Hosting activities must provide:
- Any **Generate/Regenerate** affordance required by the loop (if present in that activity’s spec).  
- Any **Commit (White Move)** affordance required by the demo’s round simulation.

---

## 9) Visual / layout requirements (arcade skin)
- Monochrome palette; no borders; minimal ASCII vibe.  
- Header and textarea align to a simple grid; no shadows/gradients.  

---

## 10) Compliance checklist (Lexiom wireframe)
A Draft Card instance is compliant if:
- [ ] Appears only in **Center Playfield** (no side-panel editing).  
- [ ] Has exactly **glyph + label + textarea** (no inline header actions, no meta).  
- [ ] Glyph meanings match GT2 5-state system.  
- [ ] **Glyph-only** header clickability.  
- [ ] **Silent auto-revoke** on edit-after-approval.  
- [ ] Multi-line editing works (Enter = newline).  
- [ ] No lifecycle locks used in demo.

---

## 11) Non-goals (this spec does not cover)
- Chat widgets (L2 / action-item conversation).  
- Provenance ledger UI (Move IDs/timestamps) — may exist in dev console only.  
- Textarea expand/collapse, dual controls, scroll invariance.

---

## 12) Known divergence (v1.0 retrofit)

- **Known divergence:** current `renderDraftCard()` layout places the label before glyph in DOM order (with glyph still being the only clickable header control for approval). Functional semantics are preserved, but geometry differs from the original “glyph-first” wording.
- **Assumption:** approved glyph rendering remains the “ring with check” semantic via approved styling class, even though `getGlyphForCard()` returns base ring token and style layer composes final visual.
- **Temporary behavior (Lexiom 1.3):** in `public/gt2/Lexiom_1_3/`, the draft-card **body** may render as a VS Code–style editor shell (dark canvas, line gutter, lightweight Markdown highlight overlay) while the header (label + approval glyph) and draft-first approval semantics remain unchanged. Classic Lexiom keeps the plain textarea presentation. The editable value remains a plain-text textarea (not a rich-text document model). While a card has unapproved player edits, inserted spans vs an edit baseline may render with a green background (cleared on glyph approval); deleted-text strike cues are not yet shown in the mirror. Approved ↔ editing presentation flips reuse the center-playfield fade (dissolve to cockpit background, then fade in) already used when scrolling Focus OSNs.
