# EP Integration into Opportunities Page - Spec Updates Summary

## Overview
This document summarizes all mandatory spec updates resulting from the integration of Engagement Proposal (EP) into the Opportunities page and the implementation of auto-generation (v1.5 changes).

## Implementation Changes

### 1. EP Location
- **Before:** EP was on a separate `ep.html` page
- **After:** EP is displayed directly on the Opportunity page, below the Workplan field
- EP uses the standard `draft-field` component (Draft-First UX)

### 2. EP Generation
- **Before:** Manual "Generate Engagement Proposal" button (disabled until prerequisites met)
- **After:** Automatic generation when all prerequisites are met (Status + Workplan + PA approved)
- No manual button exists; generation happens automatically when the last prerequisite is approved

### 3. EP Locked/Unlocked Behavior
- EP is **visible but locked** (read-only, glyph disabled) until Workplan is approved
- Shows hint: "Approve the Workplan to unlock the Engagement Proposal draft."
- Once Workplan is approved, EP unlocks and becomes editable

### 4. Send EP to Customer
- **Before:** "Generate Engagement Proposal" button at bottom of Opportunity page
- **After:** "Send EP to Customer" button (disabled until EP is approved)
- Button changes to "EP Sent to Customer" (green) once sent

### 5. PA Section Removal
- PA section (collapsible card) removed from Opportunity page
- PA is still used for EP generation but not displayed on Opportunity page

---

## Updated Specs

### 1. QuoteMeUxSpec.md
**Version:** v1.4 → v1.5

**Changes:**
- Updated Section 3.5 "Opportunity page" to include EP workflow description
- Removed Section 3.6 "EP.html flow" and replaced with integrated EP workflow description
- Added "Send EP to Customer" button description
- Documented EP locked/unlocked behavior
- Documented auto-generation trigger

**Key Updates:**
- EP is now part of the Opportunity page workflow
- EP auto-generates when Status + Workplan + PA are approved
- EP is locked until Workplan is approved
- "Send EP to Customer" button replaces "Generate Engagement Proposal" button

---

### 2. QuoteMeFunctionalSpec.md
**Version:** v1.4 → v1.5

**Changes:**
- Updated FR-8 "EP generation, approval, and sent" section:
  - Added "EP Location and Visibility" subsection
  - Updated "Auto-generation Trigger" subsection (replaces manual button)
  - Added "Send EP to Customer" subsection
  - Removed references to EP.html page

**Key Updates:**
- EP auto-generates when prerequisites are met
- EP is visible but locked until Workplan approved
- "Send EP to Customer" button behavior documented
- EP.html page removed

---

### 3. QuoteMeInferenceSpec.md
**Version:** v1 → v1.1 (no version header, but content updated)

**Changes:**
- Updated "Inference Call D — Generate Engagement Proposal (EP)" trigger description
- Changed from "button enabled; clicking it starts EP.html workflow" to "automatically triggered when all prerequisites are met"
- Updated expected output description (removed "suitable for editing in EP.html")

**Key Updates:**
- EP generation is automatic, not manual
- EP is edited on Opportunity page, not separate page

---

### 4. QuoteMeStateMachineSpec.md
**Version:** v1 → v1.1 (no version header, but content updated)

**Changes:**
- Updated Rule 2 "Status + Workplan approvals trigger EP auto-generation"
- Changed from "Generate Engagement Proposal is enabled" to "EP automatically generates"
- Added auto-generation behavior details
- Updated Rule 1 "EP auto-generation gating" with auto-generation behavior

**Key Updates:**
- EP auto-generates when prerequisites are met
- EP is visible but locked until Workplan approved
- No manual generation button exists

---

### 5. QuoteMeQASpec.md
**Version:** v1 → v1.1 (no version header, but content updated)

**Changes:**
- Updated Scenario 5 "EP flow gating and sent immutability" steps:
  - Changed from "Click 'Generate Engagement Proposal'" to "Approve both Status and Workplan"
  - Updated to reflect auto-generation
  - Changed "Mark EP as sent" to "Click 'Send EP to Customer' button"
  - Added verification step for EP unlock

**Key Updates:**
- QA scenarios now reflect auto-generation workflow
- Steps updated to match new button and workflow

---

## Specs NOT Updated (No Changes Required)

The following specs do not require updates as they don't reference EP generation or location:

1. **QuoteMeDataSpec.md** (v1.2) - Data model unchanged
2. **QuoteMeApiSpec.md** (v1.4) - API contract unchanged
3. **QuoteMeSecurityPrivacySpec.md** (v1.4) - Security/privacy unchanged
4. **QuoteMeObservabilitySpec.md** (v1) - Observability unchanged
5. **QuoteMeOnboardingModalSpec.md** (v1.1) - Onboarding unchanged

---

## Implementation Notes

### EP Auto-Generation Logic
- Triggered in both Status and Workplan approval handlers
- Checks prerequisites: `statusApproved && workplanApproved && paApproved && !epExists`
- Invalidates existing EP first (if present), then generates new EP
- Non-blocking: generation failure doesn't block UI

### EP Locked State
- EP field is always visible on Opportunity page
- `readOnly: true` and glyph disabled when `!workplanApproved`
- Placeholder text shows hint when locked
- Once Workplan is approved, EP unlocks automatically

### Send EP Button
- Located at bottom of Opportunity page (Actions card)
- Disabled until `epText && epApproved && !epSent`
- Shows confirmation dialog before sending
- Updates button text and style after sending

---

## Version History

- **v1.5** (2025-01-XX): EP integrated into Opportunities page
  - EP auto-generates when prerequisites met
  - EP locked until Workplan approved
  - "Send EP to Customer" button replaces "Generate Engagement Proposal"
  - PA section removed from Opportunity page
  - EP.html page removed

---

## References

- `opportunity.html` - Implementation of integrated EP workflow
- `ep.html` - Now shows "Not Found" message
- `GT2_DraftFirst_MicroUX_Spec.md` (v1.1) - Draft-First UX patterns used for EP
