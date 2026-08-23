# QuoteMe v1.6 Changes Summary

## Overview
This document summarizes all changes implemented in QuoteMe v1.6, including PA approval as non-blocking gate, Profile form updates, and spec version bumps.

---

## Change 1: PA Approval as Non-Blocking Gate for EP Generation

### Implementation
- **File:** `opportunity.html`
- **Function:** `shouldAutoGenerateEP()`
- **Change:** Replaced `paApproved` check with `paExists` check
  - **Before:** `const paApproved = currentData.pa?.paApproved || false;`
  - **After:** `const paExists = currentData.pa && currentData.pa.text && currentData.pa.text.trim().length > 0;`
- **Result:** EP auto-generates when PA exists (not requiring PA approval)

### Spec Updates
- **QuoteMeStateMachineSpec.md:** Updated Rule 1 and Rule 2 to reflect PA existence (not approval) as gate
- **QuoteMeFunctionalSpec.md (v1.6):** Updated FR-8 "Auto-generation Trigger" section
- **QuoteMeInferenceSpec.md:** Updated Call D trigger description
- **QuoteMeDataSpec.md (v1.3):** No changes needed (data model unchanged)

---

## Change 2: Profile Page - Mandatory Name Field and Optional Role/Title

### Implementation
- **Files:** `index.html` (landing page and profile edit page), `storage.js`
- **Changes:**
  - Added mandatory `name` field at top of form
  - Made `roleTitle` optional
  - Placed Name and Role/Title side-by-side in a row (Bootstrap `row` with `col-md-6`)
  - Updated validation in `storage.js` to require `name` instead of `roleTitle`
  - Updated `createProfile()` to include `name` and make `roleTitle` optional (`null` if empty)
  - Updated form handlers to collect `name` field
  - Updated profile rendering to populate `name` field

### Spec Updates
- **QuoteMeDataSpec.md (v1.3):** Updated Profile schema to include `name` (mandatory) and make `roleTitle` optional
- **QuoteMeUxSpec.md (v1.6):** Updated Section 3.1 and 3.4 to document new Profile form structure
- **QuoteMeFunctionalSpec.md (v1.6):** Updated FR-1 to document v1.6 Profile changes

---

## Change 3: Profile Page - Simplified Optional Section

### Implementation
- **Files:** `index.html` (landing page and profile edit page), `storage.js`, `inference-narratives.js`
- **Changes:**
  - Removed all optional fields: `typicalDealSize`, `typicalBuyerPersona`, `salesMotion`, `pricingModel`
  - Added single optional `companyDescription` textarea
  - Updated `createProfile()` to remove old optional fields and add `companyDescription`
  - Updated `profileToProse()` in `inference-narratives.js` to use new fields (name, companyDescription)
  - Updated form handlers to collect `companyDescription` instead of old optional fields
  - Updated profile rendering to populate `companyDescription` field

### Spec Updates
- **QuoteMeDataSpec.md (v1.3):** Updated Profile schema to remove old optional fields and add `companyDescription`
- **QuoteMeUxSpec.md (v1.6):** Updated Profile form description to show simplified optional section
- **QuoteMeFunctionalSpec.md (v1.6):** Updated FR-1 to document removed/added fields

---

## Version Bumps

### Updated Specs
1. **QuoteMeDataSpec.md:** v1.2 → v1.3
2. **QuoteMeFunctionalSpec.md:** v1.5 → v1.6
3. **QuoteMeUxSpec.md:** v1.5 → v1.6
4. **QuoteMeStateMachineSpec.md:** v1 → v1.1 (no version header, but content updated)
5. **QuoteMeInferenceSpec.md:** v1 → v1.1 (no version header, but content updated)

### Specs NOT Updated (No Changes Required)
- **QuoteMeApiSpec.md** (v1.4) - API contract unchanged
- **QuoteMeSecurityPrivacySpec.md** (v1.4) - Security/privacy unchanged
- **QuoteMeObservabilitySpec.md** (v1) - Observability unchanged
- **QuoteMeQASpec.md** (v1) - QA scenarios unchanged (may need updates in future)
- **QuoteMeOnboardingModalSpec.md** (v1.1) - Onboarding unchanged

---

## Implementation Notes

### Backward Compatibility
- Existing profiles without `name` field will need to be updated (validation will require it)
- Existing profiles with old optional fields (`typicalDealSize`, etc.) will be ignored (not used in inference)
- EP auto-generation logic now works even if PA is not approved (as long as PA exists)

### Data Migration
- No automatic migration is implemented in v1.6
- Users with existing profiles will need to re-enter their name when editing profile
- Old optional field data is preserved in localStorage but not used

---

## References
- `opportunity.html` - EP auto-generation logic
- `index.html` - Profile form HTML and handlers
- `storage.js` - Profile validation and data model
- `inference-narratives.js` - Profile prose conversion
