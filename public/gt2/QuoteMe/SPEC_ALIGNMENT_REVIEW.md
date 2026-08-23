# QuoteMe v1 Spec Alignment Review
**Date:** 2025-01-XX  
**By:** GTL2  
**Purpose:** Document misalignments between implemented code and specifications, propose updates

---

## Summary

After implementing DraftFirst v1.1 header row actions and reviewing all QuoteMe specifications, I've identified several areas where the implementation differs from the original specs. These differences are **intentional and correct** per GT2 brand standards (GT2_DraftFirst_MicroUX_Spec.md v1.1), but the QuoteMe specs need updates to reflect the actual implementation.

---

## Misalignments Found

### 1. Approval UI Mechanism: Buttons vs. Glyph Toggle

**Spec References:**
- `QuoteMeUxSpec.md v1.2` Section 3.5: Mentions "Approve Workplan" and "Approve Status" buttons
- `QuoteMeApiSpec.md v1.3` Section 7: Mentions "Approve Status" button for day-zero
- `QuoteMeV1ImplementationWorkPlan.md`: References approve buttons throughout

**Implementation:**
- Approval is performed via **glyph toggle** (clicking the glyph next to the field label)
- No separate "Approve" buttons exist
- Per `GT2_DraftFirst_MicroUX_Spec.md v1.1` Section 7: "Do not use a dedicated 'Approve' button in v1+. Approval is performed by interacting with the glyph."

**Resolution:**
- **GT2_DraftFirst_MicroUX_Spec.md takes precedence** as the GT2 brand standard
- QuoteMe specs should be updated to reference glyph toggle instead of buttons
- This is the correct implementation per GT2 brand

**Proposed Updates:**
1. `QuoteMeUxSpec.md`: Update Section 3.5 to reference glyph toggle approval instead of buttons
2. `QuoteMeApiSpec.md`: Update Section 7 to reference glyph toggle instead of button
3. `QuoteMeV1ImplementationWorkPlan.md`: Update references to reflect glyph toggle (work plan only, not a spec)

---

### 2. Upload/Paste: Only Upload Implemented

**Spec References:**
- `QuoteMeFunctionalSpec.md v1.1` FR-5: Mentions "upload/paste → automatic drafting"
- `QuoteMeSecurityPrivacySpec.md v1.3` Section 3.1: Mentions "upload/paste control"
- Multiple references to "upload/paste" throughout specs

**Implementation:**
- Only **file upload** is implemented (via upload action button in Status header row)
- **Paste functionality was removed** per user request (redundant with upload)
- Upload is the primary "ingest" gesture per DraftFirst v1.1

**Resolution:**
- Update specs to reflect that v1 supports **upload only** (paste is out of scope for v1)
- This aligns with minimalism principle and DraftFirst v1.1 header row pattern

**Proposed Updates:**
1. `QuoteMeFunctionalSpec.md`: Update FR-5 to say "upload → automatic drafting" (remove paste)
2. `QuoteMeSecurityPrivacySpec.md`: Update Section 3.1 to reference "upload control" only
3. Update any other references to "upload/paste" to "upload" only

---

### 3. Upload Location: Header Row vs. Separate Section

**Spec References:**
- `QuoteMeUxSpec.md v1.2` Section 3.5: Implies upload/paste as separate control area
- `QuoteMeFunctionalSpec.md v1.1` FR-5: Doesn't specify exact UI location

**Implementation:**
- Upload action is in **Status header row** (per DraftFirst v1.1 Section 6)
- No separate "NEW INPUT Upload/Paste Area" section exists
- Upload button (📄) appears in Status field header row alongside glyph and label

**Resolution:**
- This is correct per DraftFirst v1.1: "All GT3 generation actions must live in the same header row as the field label + glyph"
- Specs should be updated to reflect this pattern

**Proposed Updates:**
1. `QuoteMeUxSpec.md`: Update Section 3.5 to describe upload action in Status header row
2. `QuoteMeFunctionalSpec.md`: Update FR-5 to reference header row upload action

---

### 4. Immediate Glyph Approval Feedback

**Spec References:**
- `GT2_DraftFirst_MicroUX_Spec.md v1.1` Section 7.1: Now documents immediate visual feedback
- QuoteMe specs don't explicitly mention this behavior

**Implementation:**
- Glyph immediately shows approved state (◯✓) when clicked, before callback executes
- Provides instant feedback even if approval triggers async inference calls

**Resolution:**
- This is documented in DraftFirst spec (already updated)
- QuoteMe specs don't need updates (this is a DraftFirst behavior, not QuoteMe-specific)

---

### 5. Fixed Label Position (Glyph Always Reserves Space)

**Spec References:**
- `GT2_DraftFirst_MicroUX_Spec.md v1.1` Section 6.2: Now documents fixed order (Glyph → Label → Actions)
- QuoteMe specs don't mention this detail

**Implementation:**
- Label position is fixed at "glyph + 2 spaces" even when glyph is empty (invisible placeholder)
- Prevents visual jumping when glyph state changes

**Resolution:**
- This is documented in DraftFirst spec (already updated)
- QuoteMe specs don't need updates (this is a DraftFirst behavior, not QuoteMe-specific)

---

## Specs That Are Aligned

✅ **QuoteMeDataSpec.md v1.1**: Fully aligned (includes all authorship tracking fields)  
✅ **QuoteMeStateMachineSpec.md**: Fully aligned (all rules match implementation)  
✅ **QuoteMeInferenceSpec.md**: Fully aligned (all calls match implementation)  
✅ **QuoteMeApiSpec.md v1.3**: Mostly aligned (only approval UI mechanism needs update)  
✅ **QuoteMeObservabilitySpec.md**: Fully aligned (audit logging matches spec)  
✅ **QuoteMeSecurityPrivacySpec.md v1.3**: Mostly aligned (only upload/paste reference needs update)  
✅ **GT2_DraftFirst_MicroUX_Spec.md v1.1**: Fully aligned (recently updated with header row pattern)

---

## Recommended Spec Updates

### Priority 1: Critical (affects user expectations)

1. **QuoteMeUxSpec.md v1.2 → v1.3**
   - Update Section 3.5: Replace "Approve Workplan" and "Approve Status" buttons with glyph toggle description
   - Update Section 3.5: Describe upload action in Status header row
   - Remove references to separate "upload/paste" area

2. **QuoteMeFunctionalSpec.md v1.1 → v1.2**
   - Update FR-5: Change "upload/paste" to "upload" only
   - Update FR-5: Reference header row upload action
   - Update journey summary: Remove "paste" references

3. **QuoteMeApiSpec.md v1.3 → v1.4**
   - Update Section 7: Replace "Approve Status" button with glyph toggle reference

### Priority 2: Minor (documentation clarity)

4. **QuoteMeSecurityPrivacySpec.md v1.3 → v1.4**
   - Update Section 3.1: Change "upload/paste control" to "upload control"
   - Update Section 4.1: Remove "pasted text input" (only document upload)

---

## Notes

- **DraftFirst v1.1 takes precedence** for approval UI mechanism (glyph toggle is GT2 brand standard)
- **Upload-only** aligns with minimalism and user request (paste was intentionally removed)
- **Header row actions** are correct per DraftFirst v1.1 (all GT3 actions in control strip)
- All functional behaviors (gating, approvals, atomicity, etc.) match specs exactly
- Only UI mechanism descriptions need updates, not functional requirements

---

## Next Steps

1. ✅ Review this document with user
2. ✅ Update specs with version bumps (v1.2 → v1.3, etc.) - **COMPLETED**
3. Proceed with Phase 4 implementation

---

## Minor Remaining Items (Fixed)

**Item 1: QuoteMeFunctionalSpec.md line 39 - "uploaded/pasted" in North Star section**
- **Status:** ✅ **FIXED**
- **Issue:** North Star section still referenced "uploaded/pasted" instead of "uploaded" only
- **Fix Applied:** Updated to "uploaded" and added note about upload-only scope and header row location (line 41)
- **Details:** The replace_all successfully changed all instances of "uploaded/pasted" to "uploaded", and a note was added explaining that v1 supports upload only with the upload action located in Status field header row per DraftFirst v1.1

**Item 2: QuoteMeFunctionalSpec.md FR-7 - Approval mechanism section insertion**
- **Status:** ✅ **FIXED**
- **Issue:** The approval mechanism section (describing glyph toggle) needed to be inserted into FR-7 between the "Trust rule" paragraph and the revocation bullet list
- **Nature of the problem:**
  - The existing FR-7 section had a bullet list starting immediately after "Any edit revokes approval."
  - The new content (approval mechanism description) needed to be inserted between the "Trust rule" paragraph and the bullet list
  - The `search_replace` tool is sensitive to exact whitespace matching, and the file had subtle formatting differences:
    - **Tabs vs spaces**: The file might use tabs for indentation in some places, spaces in others
    - **Line endings**: Windows CRLF (`\r\n`) vs Unix LF (`\n`) can cause matching issues
    - **Special Unicode characters**: The file uses en-dash "‑" (U+2011) in "high‑tech" which is different from regular hyphen "-" (U+002D)
    - **Exact number of blank lines**: The tool requires exact match of blank lines between sections
    - **Invisible formatting**: There may be trailing spaces or other invisible characters
  - **Solution:** Used a targeted replacement matching just the first bullet item, which successfully inserted the approval mechanism section (lines 190-194) and reorganized revocation rules under a "Revocation rules" subsection (line 196)
- **Fix Applied:** Successfully inserted the approval mechanism section and reorganized revocation rules under a "Revocation rules" subsection for clarity
- **Impact:** Documentation now fully aligns with implementation (glyph toggle approval mechanism is properly documented)

---

## Update Log

**2025-01-XX:** Updated all affected specs with version bumps:
- ✅ QuoteMeUxSpec.md: v1.2 → v1.3 (updated Section 3.5 with DraftFirst UX pattern)
- ✅ QuoteMeFunctionalSpec.md: v1.1 → v1.2 (updated FR-5, FR-7, journey summary, North Star section)
  - ✅ Fixed: Added upload-only note in North Star (line 41)
  - ✅ Fixed: Added approval mechanism section in FR-7 (lines 190-196)
- ✅ QuoteMeApiSpec.md: v1.3 → v1.4 (updated Section 7 with glyph toggle reference)
- ✅ QuoteMeSecurityPrivacySpec.md: v1.3 → v1.4 (updated upload/paste references to upload only)
