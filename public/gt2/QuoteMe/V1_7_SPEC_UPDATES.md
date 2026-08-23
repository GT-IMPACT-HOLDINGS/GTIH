# QuoteMe v1.7 Spec Updates Summary

## Overview
This document summarizes all specification updates for QuoteMe v1.7, reflecting two implementation changes:
1. Dynamic "Opportunity Title (optional)" label
2. Onboarding modal appears on Opportunities page instead of PA page

---

## Change 1: Dynamic "Opportunity Title (optional)" Label

### Implementation
- **File:** `opportunity.html`
- **Function:** `updateTitleLabel()`
- **Behavior:** Label dynamically shows "(optional)" suffix when the title field is empty
  - When empty: "Opportunity Title (optional)"
  - When contains text: "Opportunity Title"
- **Updates:** Label updates automatically when:
  - Opportunity loads
  - User types in the title field
  - Title is auto-generated from uploaded input

### Spec Updates

#### QuoteMeUxSpec.md (v1.6 → v1.7)
- **Section 3.5 "Opportunity page":** Added new subsection documenting dynamic label behavior
- **Section 3.5 (near auto-propose title):** Added v1.7 update note about dynamic label

#### QuoteMeFunctionalSpec.md (v1.6 → v1.7)
- **FR-4 "Opportunity title auto-proposal":** Added v1.7 update section describing dynamic label behavior

#### QuoteMeDataSpec.md (v1.3 → v1.4)
- **Section 9.3 "Opportunity title auto-proposal":** Added v1.4 update note about dynamic label (UI-only change, data model unchanged)

---

## Change 2: Onboarding Modal Appears on Opportunities Page

### Implementation
- **File:** `index.html`
- **Change:** After profile creation and PA generation, user is routed to Opportunities page first, then modal appears on top
- **Previous behavior:** User was routed to PA page, then modal appeared on top
- **New behavior:** User is routed to Opportunities page, then modal appears on top
- **Simplification:** Step 1 (PA editing) is automatically skipped when modal appears on Opportunities page since PA textarea is not visible

### Spec Updates

#### QuoteMeOnboardingModalSpec.md (v1.1 → v1.2)
- **Version bump:** v1.1 → v1.2
- **Section "Trigger":** Updated to reflect that modal appears on Opportunities page (not PA page)
- **Section "Two-step interactive onboarding" - Step 1:** Added note that Step 1 is skipped when modal appears on Opportunities page
- **Section "Navigation behavior":** Updated flow to reflect that user remains on Opportunities page (no navigation needed after modal closes)
- **Section "Technical implementation":** Updated note about PA textarea monitoring being skipped on Opportunities page

#### QuoteMeUxSpec.md (v1.6 → v1.7)
- **Section 3.1 "Landing page":** Updated onboarding modal description to reflect:
  - User is routed to Opportunities page first
  - Modal appears on top of Opportunities page
  - Step 1 (PA editing) is skipped when on Opportunities page
  - User remains on Opportunities page after modal closes

#### QuoteMeFunctionalSpec.md (v1.6 → v1.7)
- **FR-1 "Landing Profile":** Updated onboarding flow description:
  - User is routed to Opportunities page first
  - Modal appears on top of Opportunities page
  - Added v1.7 change note explaining the new flow

---

## Version Bumps

### Updated Specs
1. **QuoteMeUxSpec.md:** v1.6 → v1.7
2. **QuoteMeFunctionalSpec.md:** v1.6 → v1.7
3. **QuoteMeOnboardingModalSpec.md:** v1.1 → v1.2
4. **QuoteMeDataSpec.md:** v1.3 → v1.4

### Specs NOT Updated (No Changes Required)
- **QuoteMeInferenceSpec.md** - Inference logic unchanged (title proposal still triggers when empty)
- **QuoteMeStateMachineSpec.md** - State machine rules unchanged
- **QuoteMeQASpec.md** - QA scenarios unchanged (structural assertions remain valid)
- **QuoteMeApiSpec.md** - API contract unchanged
- **QuoteMeSecurityPrivacySpec.md** - Security/privacy unchanged
- **QuoteMeObservabilitySpec.md** - Observability unchanged

---

## Implementation Notes

### Backward Compatibility
- Dynamic label is a UI-only change; existing data structures remain unchanged
- Onboarding modal flow change is transparent to users (same modal, different page)
- Existing users who have completed onboarding (`draftFirstSeen: true`) are unaffected

### User Experience Impact
- **Dynamic label:** Provides clearer indication that title is optional when empty
- **Onboarding on Opportunities page:** Simpler flow - user sees Opportunities immediately, then learns Draft-First UX via modal

---

## References
- `opportunity.html` - Dynamic label implementation (`updateTitleLabel()` function)
- `index.html` - Onboarding modal flow (routing to Opportunities page first)
