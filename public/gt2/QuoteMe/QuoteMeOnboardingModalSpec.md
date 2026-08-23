# QuoteMeOnboardingModalSpec.md (v1.2)

## Purpose
Introduce users to GT2 "Draft-First UX" (AI drafts, user controls) immediately after Profile submission and PA generation, on the Opportunities page.

## Trigger
After user submits Profile successfully AND PA draft is generated, user is routed to **Opportunities page**, and then the onboarding modal is shown on top of the Opportunities page.

**Condition:** Modal only shows if `quoteme.v1.onboarding.draftFirstSeen` is `false` or undefined.

**v1.2 change:** Modal now appears on Opportunities page (not PA page). User navigates to Opportunities first, then modal appears as an overlay.

## Modal UX (light-first, friendly, high-tech)

### Title
"AI drafts. You're in control."

### Body
"Every GT3 output is a proposal, editable right where it appears."

### Mini glyph legend (visual-first)
- **◯** "AI draft" (hollow ring, larger font size ~2rem)
- **◉** "You shaped it" (dot within ring, larger font size ~2rem)
- **◯✓** "Approved" (checkmark inside ring, larger font size ~2rem, checkmark color #00B8D9)

The approved glyph uses absolute positioning to ensure the checkmark appears inside the ring.

## Two-step interactive onboarding

### Step 1: Edit the PA draft
**Completion rule:** PA textarea value differs from initial GT3-filled value by >= 1 character.

**Visual feedback:**
- While incomplete: subtle pulse highlight on PA textarea border (CSS class `onboarding-pulse-border`)
- Upon completion: pulse removed from textarea, pulse added to onboarding modal's draft-field glyph

**Note:** No explicit "Step 1" label is shown in the UI (per implementation). The user learns by doing.

**v1.2 change:** When modal appears on Opportunities page (not PA page), Step 1 is automatically skipped since PA textarea is not visible. User proceeds directly to Step 2.

### Step 2: Approve via glyph click
**Completion rule:** User clicks the glyph in the onboarding modal's draft-field component to approve it.

**Onboarding draft-field component:**
- **Label:** "← click to approve"
- **Text:** "Hello {companyName} user" (where `{companyName}` comes from user's Profile)
- **Glyph state:** Hollow ring (◯) - simulates GT3 draft (`hasLmDraft: true`, `approved: false`, `hasUserEdits: false`)
- **Component:** Uses the standard `draft-field` component (per `GT2_DraftFirst_MicroUX_Spec.md`)

**Visual feedback:**
- While incomplete (after Step 1 done): subtle glow/pulse on onboarding draft-field glyph (CSS class `onboarding-glyph-pulse`)
- Upon completion: glyph immediately updates to approved state (◯✓) per Draft-First immediate feedback pattern

**Tooltip requirement (always):**
- Not approved → "Click to approve"
- Approved → "Approved — click to unapprove"

## Navigation behavior

**No separate "Continue" button:** The glyph click itself triggers modal closure.

**Flow:**
1. User clicks glyph → glyph immediately updates to approved state (◯✓)
2. Wait 1 second (so user can see the approved glyph)
3. Store `quoteme.v1.onboarding.draftFirstSeen = true`
4. Close modal
5. User remains on Opportunities page (no navigation needed - modal was already shown on Opportunities page)

**v1.2 change:** Since modal appears on Opportunities page (not PA page), no navigation is needed after modal closes. User simply remains on the Opportunities page.

**Implementation note:** The `onApproveToggle` callback in the draft-field component handles the delay and modal closure automatically.

## State persistence

After successful completion (glyph clicked and approved), store:
```json
{
  "onboarding": {
    "draftFirstSeen": true
  }
}
```

Modal should not show again when this flag is `true`.

## Reset behavior (to reinforce learning)

- If user deletes PA text back to original or empty: Step 1 becomes incomplete again (pulse returns to PA textarea) - **Note:** This only applies when PA view is visible (modal on PA page). When modal appears on Opportunities page, Step 1 is skipped.
- If user approves onboarding draft-field then edits it: approval revokes (per Draft-First spec), but since modal already closed, this doesn't affect the modal state

## Accessibility

- Tooltip text mirrored in aria-labels for glyph and action controls
- Focus trap within modal while open
- Enter/Space should activate focused control (glyph toggle)

## Technical implementation

- Modal uses Bootstrap 5 Modal component
- Draft-field component is created dynamically via `createDraftField()` from `../utilities/draft-field.js`
- PA textarea monitoring uses `input` event listener (only when PA view is visible)
- Modal backdrop is `static` (non-dismissible) and keyboard navigation is disabled during onboarding

**v1.2 change:** PA textarea monitoring is skipped when modal appears on Opportunities page (PA textarea not visible)

## Out of scope (v1)

- Skip button
- Multi-field training (only PA is used for onboarding)
- Analytics/metrics tracking
- Custom onboarding content beyond the greeting text
