# QuoteMeStateMachineSpec.md (v1)

This document defines QuoteMe v1 lifecycle rules as **state/behavior rules per object** (not a transition table). It focuses on **gating**, **approval semantics**, and **invalidation rules**.

---

## 1) Global object: Profile

### 1.1 States (conceptual)
- **ProfileMissing**: no Profile exists yet.
- **ProfileValid**: required fields present.
- **ProfileDirty**: user is editing but not yet saved.

### 1.2 Rules
1. **Required field integrity (hard gate)**  
   Saving Profile is **blocked** unless all required fields are non-empty:
   - company name
   - role/title
   - industry/segment
   - geography
   - product/service category

2. **Edit does not auto-change PA**  
   Editing/saving Profile must **not** automatically regenerate or overwrite the global PA.

3. **Profile change triggers regeneration prompt**  
   After a successful Profile save that changes any Profile field, QuoteMe must prompt:  
   **“Profile changed—regenerate PA?”**  
   - If user declines: PA remains unchanged.  
   - If user confirms: follow PA regeneration rules (see PA section).

---

## 2) Global object: Proposal Anatomy (PA)

### 2.1 States (conceptual)
- **PAMissing**: PA not created (e.g., initial generation failed).
- **PADraft**: PA exists but is not approved.
- **PAApproved**: PA exists and is approved.

### 2.2 Rules
1. **Creation timing (first run)**  
   After initial Profile submission, QuoteMe attempts to generate PA immediately.  
   If generation fails, PA becomes **missing**, but the user may still use Opportunities (EP generation gated).

2. **Editability**  
   PA is always editable when present.

3. **Approval semantics (quality gate)**  
   PA has an explicit approval action:
   - Approving PA sets `paApproved = true` and `paApprovedAt = now`.
   - EP generation is allowed when PA **exists** (PA approval is not required - non-blocking gate per v1.6).

4. **Editing after approval revokes approval**  
   If the user edits PA after it is approved:
   - `paApproved` is reset to `false` and `paApprovedAt` cleared.
   - PA returns to **PADraft**.
   - EP generation is not blocked (PA existence is sufficient, approval is not required per v1.6).

5. **Regeneration (explicit, confirmed)**  
   When user confirms “regenerate PA”:
   - Overwrite PA text with the newly generated PA.
   - Set `paApproved = false` and require re-approval.
   - **Do not** modify Opportunities or EP drafts (leave them untouched in v1).

6. **PA existence gating for EP**
   - If PA is missing, EP generation is blocked (even if Status/Workplan are approved).

---

## 3) Object: Opportunity

### 3.1 States (conceptual)
- **OpportunityDraft**: Status/Workplan drafts exist but not both approved.
- **OpportunityReadyForEP**: Status approved AND Workplan approved AND PA exists (PA approval not required per v1.6).
- **OpportunityHasEPDraft**: EP generated and editable (not necessarily approved).
- **OpportunityEPSent**: EP marked sent (EP becomes read-only in v1).

*(These are conceptual; the app derives them from persisted flags and content.)*

### 3.2 Rules
1. **Title editing**
   - Title may be edited **at any time**, including after EP is sent.

2. **Status + Workplan approvals trigger EP auto-generation**
   - EP **automatically generates** when all prerequisites are met:
     - `statusApproved = true`
     - `workplanApproved = true`
     - global PA **exists** (PA approval is not required - non-blocking gate per v1.6)
   - No manual "Generate Engagement Proposal" button exists (removed in v1.5)
   - EP is displayed directly on the Opportunity page (no separate EP.html page)
   - EP is visible but locked (read-only, glyph disabled) until Workplan is approved
   - Auto-generation happens when the last prerequisite (Status or Workplan) is approved

3. **Edits after approval revoke approval (trust rule)**
   - If Status is edited after it was approved:
     - set `statusApproved = false`, clear `statusApprovedAt`
     - require re-approval
   - If Workplan is edited after it was approved:
     - set `workplanApproved = false`, clear `workplanApprovedAt`
     - require re-approval

4. **Status approval triggers Workplan generation (when Workplan is empty)**
   - User can manually edit Status textarea at any time.
   - When Status is approved (via glyph toggle) and Workplan is empty:
     - QuoteMe triggers a GT3 inference to generate Workplan from Profile + approved Status.
     - This applies whenever Workplan is empty, not just in day-zero mode.
     - The generated Workplan is saved as a draft (not auto-approved).
   - Manual Status edits are tracked with glyph states (user-only ● vs LM-only ◯ vs LM+User ◉).

5. **NEW INPUT upload behavior (automatic drafting)**
   - After each new document/narrative upload:
     - QuoteMe automatically triggers GT3 drafting of **Status + Workplan** (two calls; app-level atomic).
     - QuoteMe revokes approvals:
       - `statusApproved = false` and `workplanApproved = false`
     - The newly uploaded/entered input is recorded in the Opportunity audit log.

6. **Atomicity for split Status/Workplan drafting**
   - Status and Workplan drafting are separate GT3 calls.
   - If either call fails, **discard both** drafts and persist nothing from the pair.

6. **Deletion**
   - In v1, an Opportunity may be deleted from **any state**, including after EP is sent.
   - Future enhancement: archive deleted opportunities instead of removing permanently.

---

## 4) Object: Engagement Proposal (EP) (embedded in Opportunity)

### 4.1 States (conceptual)
- **EPMissing**: no EP text generated yet.
- **EPDraft**: EP text exists, not approved.
- **EPApproved**: EP approved, not sent.
- **EPSent**: EP marked sent; read-only in v1.

### 4.2 Rules
1. **EP auto-generation gating (v1.6)**
   EP **automatically generates** when all prerequisites are met:
   - PA **exists** (PA approval is not required - non-blocking gate per v1.6)
   - Status is **approved**
   - Workplan is **approved**
   
   **Auto-generation behavior:**
   - No manual "Generate Engagement Proposal" button exists
   - EP is displayed directly on the Opportunity page (no separate EP.html page)
   - EP is visible but locked (read-only, glyph disabled) until Workplan is approved
   - Auto-generation happens when the last prerequisite (Status or Workplan) is approved
   - If EP already exists, it is invalidated first (per Rule 6), then regenerated
   
   **Note:** PA approval is no longer a blocking gate for EP generation. EP can generate as long as PA exists, even if PA is not approved.

2. **EP generation result**
   - Generating EP produces a structured, section-labeled draft.
   - Sets `epGeneratedAt = now`.
   - Sets `epApproved = false`, `epSent = false` (until explicitly set).

3. **EP approval**
   - Approving EP sets `epApproved = true` and `epApprovedAt = now`.

4. **Editing after EP approval revokes EP approval**
   - If the user edits EP after approval:
     - set `epApproved = false`, clear `epApprovedAt`
     - require re-approval

5. **Sent EP is immutable in v1**
   - If `epSent = true`, EP becomes read-only:
     - editing is blocked
     - approval changes are blocked
   - Future enhancement: allow revisions/versioning after sent.

6. **EP invalidation on upstream change (hard rule)**
   If new information causes upstream artifacts to change and be re-approved:
   - When a new upload triggers new drafts, approvals are revoked.
   - Once new Status and Workplan are approved (i.e., Opportunity returns to ready-for-EP),
     QuoteMe must invalidate the existing EP:
     - clear `epText`
     - set `epApproved = false`, clear `epApprovedAt`
     - set `epSent = false`, clear `epSentAt`
     - set `epGeneratedAt = null`
   Rationale: prevent sending a proposal that no longer matches the approved Opportunity state.

---

## 5) Admin visibility (state-related)
- Admin tooling is accessible via a visible **Admin** item in the sidebar (v1).
- Admin view may show:
  - approvals timestamps
  - audit log entries
  - inference errors
- Admin visibility does not change state semantics; it only reveals diagnostics.

---

## 6) Future enhancements (explicitly out of scope for v1)
- Archive/restore instead of hard delete.
- EP revision/versioning after sent.
- Automatic redaction policies affecting state/rules.
- Multi-PA support per segment/opportunity.
