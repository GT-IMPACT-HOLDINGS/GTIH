# QuoteMe v1 Spec Patches — Profile Implementation Alignment

## Summary
After implementing Profile editing functionality, the following minimal patches are required to align specs with implementation.

---

## Patch 1: QuoteMeUxSpec.md — Navigation Structure

**Location:** Section 3.2 "Main app shell / Opportunities home" (lines 72-84)

**Current Text:**
```
3.2 Main app shell / Opportunities home

Top nav:

Opportunities

Proposal Anatomy (PA)

(Optional) Settings/Profile

Prominent "Create Opportunity" button.

List of Opportunities with last updated timestamp and quick open.
```

**Issue:** 
- Spec says "Top nav" but implementation uses left sidebar (consistent with Admin placement per line 142)
- Profile navigation location needs clarification

**Proposed Patch:**
```
3.2 Main app shell / Opportunities home

Left sidebar navigation:

- Opportunities
- Proposal Anatomy (PA)
- Profile
- Admin

Main content area:
- Prominent "Create Opportunity" button.
- List of Opportunities with last updated timestamp and quick open.
```

**Rationale:** 
- Aligns with implementation (left sidebar, not top nav)
- Consistent with Admin placement (line 142: "Admin tools are accessible via a small **Admin** item at the bottom of the left sidebar")
- Profile is now required (not optional) since Profile editing is mandatory per FR-1

---

## Patch 2: QuoteMeUxSpec.md — Profile Page Section

**Location:** After section 3.3 "PA page" (add new section 3.4, renumber existing 3.4→3.5, 3.5→3.6)

**Current Text:** (No Profile page section exists)

**Issue:** 
- Spec describes Landing page, PA page, Opportunity page, EP page, but no Profile page
- Profile editing is required functionality (FR-1) but navigation/page is not documented

**Proposed Patch:**
```
3.4 Profile page

Purpose: edit the global Profile used for PA and inference generation.

Layout:
- Form with all Profile fields (required + optional), pre-populated with current Profile data
- Same validation as Landing page (required fields must be non-empty)
- "Save Profile" button

Behavior:
- On save: validate required fields
- If Profile changed: prompt "Profile changed—regenerate PA?" (per StateMachineSpec)
- If user confirms: trigger PA regeneration (per InferenceSpec Call A) and revoke PA approval
- If user declines: PA remains unchanged
- Update Profile timestamps (updatedAt)

3.5 Opportunity page (Status/Workplan workflow)
[... existing content ...]

3.6 EP.html flow (mirrors Legato)
[... existing content ...]
```

**Rationale:**
- Documents the Profile editing page that was implemented
- Aligns with FR-1 requirement: "Profile is editable after onboarding"
- Documents the "Profile changed—regenerate PA?" prompt behavior

---

## Patch 3: QuoteMeFunctionalSpec.md — Functional Scope Summary

**Location:** Section "Functional scope summary (v1)" (lines 76-87)

**Current Text:**
```
QuoteMe v1 supports exactly this journey (no additional features implied):

1) Landing Profile submit → PA generated  
2) Approve PA  
3) Create Opportunity → upload doc/paste → auto title + auto status/workplan drafts  
4) Edit + approve status/workplan  
5) Generate EP → edit + approve → mark sent  
6) Admin diagnostics/export (passcode‑gated)
```

**Issue:**
- Profile editing is not mentioned in the journey summary, but it's required functionality (FR-1)

**Proposed Patch:**
```
QuoteMe v1 supports exactly this journey (no additional features implied):

1) Landing Profile submit → PA generated  
2) Approve PA  
3) Edit Profile (optional, accessible via sidebar) → prompt "Profile changed—regenerate PA?" if changed
4) Create Opportunity → upload doc/paste → auto title + auto status/workplan drafts  
5) Edit + approve status/workplan  
6) Generate EP → edit + approve → mark sent  
7) Admin diagnostics/export (passcode‑gated)
```

**Rationale:**
- Documents Profile editing as part of the v1 journey
- Notes it's optional (user-initiated) but available
- Mentions the PA regeneration prompt

---

## Patch 4: QuoteMeDataSpec.md — Profile Edit Behavior Clarification

**Location:** Section 4.4 "Profile edit behavior (UX contract)" (lines 102-107)

**Current Text:**
```
### 4.4 Profile edit behavior (UX contract)
- Editing Profile does **not** auto-overwrite PA.
- After Profile changes, QuoteMe prompts: **"Profile changed—regenerate PA?"**
- If user confirms regeneration, PA is overwritten with the newly generated PA (no history in v1).

*(Note: the prompt behavior is UX/UI; this DataSpec only requires Profile timestamps to support "changed" detection and audit logging.)*
```

**Issue:**
- Spec doesn't clarify what "Profile changes" means (any field change? specific fields?)
- Implementation detects changes by comparing all fields

**Proposed Patch:**
```
### 4.4 Profile edit behavior (UX contract)
- Editing Profile does **not** auto-overwrite PA.
- After Profile save that changes any Profile field (compared to previous saved state), QuoteMe prompts: **"Profile changed—regenerate PA?"**
- If user confirms regeneration, PA is overwritten with the newly generated PA (no history in v1).
- If user declines, PA remains unchanged.

*(Note: the prompt behavior is UX/UI; this DataSpec only requires Profile timestamps to support "changed" detection and audit logging. Change detection compares all Profile fields to determine if any modification occurred.)*
```

**Rationale:**
- Clarifies that any field change triggers the prompt
- Documents the decline behavior (PA unchanged)
- Notes that change detection compares all fields (as implemented)

---

## Summary of Required Patches

1. ✅ **QuoteMeUxSpec.md Section 3.2** — Update navigation from "Top nav" to "Left sidebar", make Profile required (not optional)
2. ✅ **QuoteMeUxSpec.md** — Add new section 3.4 "Profile page" documenting Profile editing UI/behavior
3. ✅ **QuoteMeFunctionalSpec.md Section "Functional scope summary"** — Add Profile editing to journey (step 3)
4. ✅ **QuoteMeDataSpec.md Section 4.4** — Clarify change detection behavior and decline option

**All patches are minimal and mandatory** to align specs with implemented Profile editing functionality.

---

*Generated: 2025-01-XX (by GTL2)*
