# QuoteMeQASpec.md (v1)

This document defines the **automated integration test scenario catalog** for QuoteMe v1.  
Goal for v1: implement an **automation skeleton** that validates the main functional flows using a **real GT3 test instance**, while keeping assertions **structural** (non-deterministic AI outputs tolerated).

---

## 1) Test approach (v1)

### 1.1 Test type
- **Integration tests against a real GT3 test instance** (no mocking).
- Outputs are **non-deterministic**; tests validate **structural properties** only.

### 1.2 Input data
- Use a **fixed library of small synthetic inputs** stored with the test suite.
- Include **at least one non-English** synthetic input to validate “output language follows input.”

### 1.3 Assertions policy (structural only)
AI output assertions must be minimal, for example:
- non-empty text
- length > minimal threshold
- for EP/PA: contains at least N section-like headings (e.g., lines starting with `#`/`##` or similar patterns)

No strict semantic checks (no specific section names) in v1.

### 1.4 Out of scope for v1 skeleton
- Failure-mode / negative tests (e.g., GT3 auth failures, timeouts)
- Admin Export validation
- Performance/latency benchmarking
- Long-run soak tests

---

## 2) Environment prerequisites (hard requirements)

1. QuoteMe app is reachable (example):  
   - `http://localhost:8080/...` (exact path as configured by the project)

2. A **GT3 test instance** is reachable at a configured base URL.

3. Test runner can:
   - start/stop QuoteMe locally (or assume it is already running)
   - **wipe browser storage** between scenarios (clear `localStorage["quoteme.v1"]`)

4. Test configuration provides required metadata fields (sent by QuoteMe in requests):
   - `tenant`, `app="quoteme"`, `track`, `consent`

---

## 3) Scenario catalog structure (feature buckets)

v1 provides **~1 spine scenario per bucket**:

1) Profile + PA lifecycle  
2) Opportunity title proposal  
3) Upload → auto Status+Workplan (parallel + atomic)  
4) Approvals + edit-after-approval revocation  
5) EP generation + approval + sent/read-only  
6) Error handling + Admin diagnostics + export (**out of scope for v1 skeleton**)  
7) Multi-language case

---

## 4) Spine scenarios (v1)

### Scenario 1 — Profile submit → PA generated (Bucket 1)
**Purpose:** Validate onboarding path and PA creation.

**Setup:**
- Clear localStorage.
- Launch QuoteMe landing page.

**Steps:**
1. Fill Profile required fields with synthetic values.
2. Submit Profile.
3. Wait for PA generation to complete and app to enter main shell.

**Assertions:**
- PA editor exists and PA text is **non-empty**.
- `localStorage["quoteme.v1"]` exists and parses.
- Stored `profile` exists; stored `pa.text` exists and non-empty.

---

### Scenario 2 — Upload input triggers Opportunity title proposal (Bucket 2)
**Purpose:** Validate title auto-proposal behavior when title is empty.

**Setup:**
- Clear localStorage; complete Profile+PA creation (can reuse Scenario 1 as a shared setup step).

**Steps:**
1. Create new Opportunity with **empty/whitespace** title.
2. Add NEW INPUT via the supported upload/paste mechanism (synthetic English input).

**Assertions:**
- Opportunity title becomes **non-empty** after inference completes.
- Title remains editable (can type and save a different title).

---

### Scenario 3 — Upload triggers Status+Workplan drafts (parallel + atomic) (Bucket 3)
**Purpose:** Validate the core auto-drafting mechanism after each upload.

**Setup:**
- Fresh state; Profile+PA exists.

**Steps:**
1. Create new Opportunity.
2. Upload/paste NEW INPUT (synthetic English input).
3. Wait until both Status and Workplan drafts appear.

**Assertions:**
- Status textarea is **non-empty**.
- Workplan textarea is **non-empty**.
- Both drafts are visible after a single upload action.

*(No negative/partial-failure assertions in v1.)*

---

### Scenario 4 — Approvals revoked on edit (Bucket 4)
**Purpose:** Validate approval gating and “edit-after-approval revokes approval”.

**Setup:**
- Opportunity with drafted Status+Workplan.

**Steps:**
1. Click Approve Status.
2. Click Approve Workplan.
3. Edit one character in Status text area.
4. Observe approval state changes.

**Assertions:**
- After edit, Status approval state is revoked (UI indicates “not approved”).
- EP generation remains gated until Status is re-approved.

---

### Scenario 5 — EP lifecycle: generate → approve → send → read-only (Bucket 5)
**Purpose:** Validate EP flow gating and sent immutability.

**Setup:**
- Ensure global PA is **approved**.
- Opportunity has Status and Workplan both approved.

**Steps:**
1. Approve both Status and Workplan (via glyph toggles).
2. Wait for EP to auto-generate (appears on Opportunity page below Workplan).
3. Verify EP is unlocked and editable.
4. Approve EP (via glyph toggle).
5. Click "Send EP to Customer" button.
6. Attempt to edit EP text after sending.

**Assertions:**
- EP text is **non-empty** after auto-generation.
- EP is unlocked and editable after Workplan approval.
- "Send EP to Customer" button is enabled only after EP approval.
- After sent, EP editor is **read-only** (edits blocked).

---

### Scenario 6 — Error handling + Admin diagnostics + export (Bucket 6)
**Status:** Out of scope for v1 automation skeleton.

---

### Scenario 7 — Non-English input results in non-English draft output (Bucket 7)
**Purpose:** Validate language-following behavior with at least one non-English input.

**Setup:**
- Profile+PA exists.

**Steps:**
1. Create Opportunity.
2. Upload/paste NEW INPUT in a non-English language (e.g., French/Spanish synthetic paragraph).
3. Wait for Status+Workplan drafts.

**Assertions (structural):**
- Status and Workplan are non-empty.
- Output text contains evidence of non-English script/words (lightweight check, e.g., presence of accented characters or known words from the synthetic input).

---

## 5) Notes for future expansion (post-v1)
- Add negative tests (GT3 401/429/5xx; atomic discard verification).
- Add Admin Export verification.
- Add multi-upload sequences (several uploads; approvals revoke; EP invalidation rules).
- Add day-zero special case scenario once implementation stabilizes.

