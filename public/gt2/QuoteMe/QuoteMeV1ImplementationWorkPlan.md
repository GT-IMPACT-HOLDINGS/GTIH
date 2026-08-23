# QuoteMe v1 Implementation Work Plan

> "Love made executable" — disciplined minimalism, clarity, and incremental delivery.

---

## Architecture Sketch

### Pages/Modules
- **Landing Page** (`index.html`) — Profile onboarding + PA generation
- **Opportunities List** (`index.html` main shell) — list view + create new
- **Opportunity Detail** (`opportunity.html`) — Status/Workplan workflow
- **PA Editor** (`pa.html`) — global Proposal Anatomy editor
- **EP Workflow** (`ep.html`) — Engagement Proposal generation/approval/sent
- **Admin** (`admin.html` or embedded in sidebar) — diagnostics + export

### localStorage Model
Single root key: `quoteme.v1` containing:
```json
{
  "schemaVersion": 1,
  "profile": { ... } | null,
  "pa": { ... } | null,
  "opportunities": [ ... ]
}
```
- Profile: required fields (companyName, roleTitle, industrySegment, geography, productServiceCategory) + optional fields
- PA: text + timestamps + approval flags
- Opportunities: array of Opportunity objects with embedded EP + auditLog[]

### GT3 Call Wrapper
- Reuse exact Legato endpoint: `POST /inference` (match Legato's actual implementation)
- Request body: `{ narrative: string }` only (GT3 ignores other body fields; headers are source of truth)
- Request headers (source of truth for metadata): `X-GT3-Tenant: "gt2-quoteme-dev"`, `X-GT3-Data-Track: "green"`, `X-GT3-Consent-Version: "v1"`
- Response: `{ response: string }` (match Legato's actual response format)
- Observability: Log `null` for `provider`, `model`, `latencyMs` in audit payloads (GT3 doesn't return these; can measure client-side latency if needed)
- Wrapper module: `gt3-client.js` (shared utility for all inference calls)

### Audit Logging
- Per-Opportunity `auditLog[]` array
- Standardized payloads per ObservabilitySpec (requestNarrative, responseText, truncation flags)
- Truncation at 200k chars per field
- Admin view renders audit entries with expandable payloads

---

## Phased Implementation Plan

### Phase 1: Foundation & Storage (Steps 1-3)
**Goal:** Establish localStorage schema, basic routing, and core data utilities.

#### Step 1: localStorage Schema + Data Utilities
**Spec References:** QuoteMeDataSpec.md  
**Concrete Changes:**
- Create `storage.js` module:
  - `loadQuoteMeData()` → returns parsed `quoteme.v1` or default structure
  - `saveQuoteMeData(data)` → serializes and writes to localStorage
  - `createOpportunity()` → factory for new Opportunity with defaults
  - `updateOpportunity(id, updates)` → atomic update with `updatedAt` refresh
  - `appendAuditLog(opportunityId, eventType, summary, payload)` → appends to auditLog
- Add schema validation helpers (check required Profile fields, parse timestamps)

**Validation Method:**
- Manual: Open browser console, call `loadQuoteMeData()`, verify structure
- Create test Opportunity, verify it persists across page reloads

**Dependencies/Risks:**
- None (pure localStorage operations)

---

#### Step 2: Basic Routing & Shell Structure
**Spec References:** QuoteMeUxSpec.md  
**Concrete Changes:**
- Create `index.html` (landing + opportunities list):
  - Landing form (Profile fields) when `profile === null`
  - Opportunities list view when Profile exists
  - Sidebar navigation (Opportunities, PA, Admin)
  - "Create Opportunity" button
- Create `router.js` (simple hash-based or query-param routing):
  - `#/` → index.html (landing or list)
  - `#/opportunity?id=...` → opportunity.html
  - `#/pa` → pa.html
  - `#/admin` → admin.html
- Minimal CSS: Bootstrap 5.3.3 (same as Legato), QuoteMe color scheme (primary #2F6BFF, approved #00B8D9)

**Validation Method:**
- Manual: Navigate between routes, verify correct page loads
- Check localStorage persistence across navigation

**Dependencies/Risks:**
- None (static HTML/JS)

---

#### Step 3: Profile Onboarding Form
**Spec References:** QuoteMeDataSpec.md, QuoteMeStateMachineSpec.md (FR-1)  
**Concrete Changes:**
- In `index.html` landing section:
  - Form with required fields: companyName, roleTitle, industrySegment, geography, productServiceCategory
  - Optional fields: typicalDealSize, typicalBuyerPersona, salesMotion, pricingModel
  - Validation: block submit if required fields empty
  - On submit: save Profile, set `createdAt`/`updatedAt`, then trigger PA generation (Step 4)
- Add `profile-utils.js`:
  - `validateProfile(profile)` → returns { valid: boolean, errors: [] }
  - `profileToProse()` → converts Profile object to short prose paragraph (for inference narratives)

**Validation Method:**
- Manual: Fill form, submit, verify Profile saved in localStorage
- Try submitting with empty required field → should block

**Dependencies/Risks:**
- None (form validation is client-side)

---

### Phase 2: GT3 Integration & PA (Steps 4-5)
**Goal:** Connect to GT3, generate PA, and establish inference patterns.

#### Step 4: GT3 Client Wrapper
**Spec References:** QuoteMeApiSpec.md, Legato index.html (actual implementation)  
**Concrete Changes:**
- Create `gt3-client.js`:
  - `callGT3(narrative, metadata)` → POST to `/inference` (match Legato's endpoint exactly)
  - Request body: `{ narrative: string }` only (GT3 confirmed: other body fields are ignored; headers are source of truth)
  - Request headers (source of truth): `X-GT3-Tenant: "gt2-quoteme-dev"`, `X-GT3-Data-Track: "green"`, `X-GT3-Consent-Version: "v1"`
  - Returns: `{ ok: boolean, text: string | null, error: string | null, latencyMs: number }`
  - Error handling: catch network errors, parse HTTP errors, return structured error
  - Latency: measure client-side (`Date.now()` before/after fetch) since GT3 doesn't return server latency
  - **Note:** Match Legato's actual request/response format by inspecting Legato code
- Test against running GT3 server (manual smoke test)

**Validation Method:**
- Manual: Call `callGT3("test narrative")` from console, verify response
- Check GT3 server logs for correct headers/metadata

**Dependencies/Risks:**
- GT3 server must be running (assume it is, or document requirement)

---

#### Step 5: PA Generation & Editor
**Spec References:** QuoteMeInferenceSpec.md (Call A), QuoteMeStateMachineSpec.md (PA rules), QuoteMeUxSpec.md, GT2_DraftFirst_MicroUX_Spec.md  
**Concrete Changes:**
- In `index.html` landing flow:
  - After Profile submit success, call GT3 with PA narrative (per InferenceSpec)
  - Show progress: "Creating your proposal structure…"
  - On success: save PA to `quoteme.v1.pa`, route to opportunities list
  - On failure: show banner "PA not created yet — retry" with Retry button
- Create `pa.html`:
  - Use `draft-field` component for PA textarea (per GT2_DraftFirst_MicroUX_Spec.md)
  - Inline editable textarea with glyph-based approval (5-state glyph system)
  - Approval via glyph toggle (no separate "Approve PA" button)
  - Edit detection: if PA edited after approval, revoke approval automatically (set `paApproved = false`)
  - Glyph states: empty / user-only (●) / LM-only (◯) / LM+User (◉) / approved (◯✓)
- Add `pa-utils.js`:
  - `buildPANarrative(profile)` → composes narrative per InferenceSpec Call A
  - `generatePA(profile)` → calls GT3, returns PA text

**Validation Method:**
- Manual: Complete Profile onboarding, verify PA generated and saved
- Edit PA after approval, verify approval revoked
- Check PA narrative format matches InferenceSpec

**Dependencies/Risks:**
- GT3 server must respond correctly (assume it does)

---

### Phase 3: Opportunities Core (Steps 6-8)
**Goal:** Opportunity list, creation, and basic detail view.

#### Step 6: Opportunities List View
**Spec References:** QuoteMeDataSpec.md, QuoteMeUxSpec.md  
**Concrete Changes:**
- In `index.html` main shell:
  - Load `opportunities[]` from storage, sort by `updatedAt` descending
  - Render list: title (or "Untitled"), last updated timestamp, "Open" button
  - "Create Opportunity" button → creates new Opportunity, routes to `opportunity.html?id=...`
  - Empty state: "No opportunities yet. Create your first one."
- Add `opportunity-utils.js`:
  - `listOpportunities()` → returns sorted array
  - `getOpportunity(id)` → returns single Opportunity or null

**Validation Method:**
- Manual: Create multiple opportunities, verify list shows them in correct order
- Delete opportunity, verify it disappears from list

**Dependencies/Risks:**
- None (storage operations)

---

#### Step 7: Opportunity Detail Page Shell
**Spec References:** QuoteMeUxSpec.md, QuoteMeDataSpec.md, GT2_DraftFirst_MicroUX_Spec.md  
**Concrete Changes:**
- Create `opportunity.html`:
  - Header: Opportunity title (editable input), back button to list
  - Status and Workplan fields using `draft-field` component (per GT2_DraftFirst_MicroUX_Spec.md):
    - Inline editable textareas with glyph-based approval (5-state glyph system)
    - Approval via glyph toggle (no separate "Approve Status" or "Approve Workplan" buttons)
    - Glyph states: empty / user-only (●) / LM-only (◯) / LM+User (◉) / approved (◯✓)
  - Upload action button in Status field header row (per GT2_DraftFirst_MicroUX_Spec.md v1.1)
  - Button: "Generate Engagement Proposal" (disabled until Status, Workplan, and PA are approved)
  - Status messages area (for progress/errors)
- Wire up basic edit handlers:
  - Title edit → update `opportunity.title`, save
  - Status/Workplan edit → update text, detect approval revocation if edited after approval (automatic via draft-field component)
  - Add privacy disclaimer near upload: "Avoid pasting secrets or personal IDs."

**Validation Method:**
- Manual: Create opportunity, edit title, verify persistence
- Edit Status after approval, verify approval revoked

**Dependencies/Risks:**
- None (UI shell only)

---

#### Step 8: NEW INPUT Upload/Paste + Text Extraction
**Spec References:** QuoteMeDataSpec.md, QuoteMeInferenceSpec.md, QuoteMeApiSpec.md  
**Concrete Changes:**
- In `opportunity.html`:
  - File input: accept `.txt`, `.docx` only (v1 scope; PDF deferred to v1.1)
  - Paste handler: detect paste events, extract text
- Add `text-extraction.js`:
  - `extractText(file)` → uses Mammoth.js for .docx, FileReader for .txt (v1 supports .txt + .docx only; PDF deferred to v1.1)
  - `normalizeText(text)` → cleans whitespace, normalizes line breaks
  - `scanSensitive(text)` → regex-based detection (API keys, SSN-like, credit cards) → returns { detected: boolean, categories: [] }
- On upload/paste:
  - Extract text, scan for sensitive patterns
  - If sensitive detected: show inline banner (non-blocking)
  - Append `new_input_added` audit event with `payload.inputText` and `payload.inputType`
  - Revoke approvals: `statusApproved = false`, `workplanApproved = false`
  - Trigger Status + Workplan generation (Step 9)

**Validation Method:**
- Manual: Upload .docx file, verify text extracted
- Paste text with API key pattern, verify warning banner appears
- Check audit log for `new_input_added` event

**Dependencies/Risks:**
- Mammoth.js CDN (already used by Legato, assume available)
- PDF extraction: explicitly deferred to v1.1 (v1 supports .txt + .docx only)

---

### Phase 4: Status/Workplan Generation (Steps 9-10)
**Goal:** Auto-drafting after upload, atomic parallel calls, day-zero special case.

#### Step 9: Parallel Status + Workplan Generation (Atomic)
**Spec References:** QuoteMeInferenceSpec.md (Calls C1, C2), QuoteMeApiSpec.md, QuoteMeStateMachineSpec.md  
**Concrete Changes:**
- In `opportunity.html`:
  - After NEW INPUT extracted, trigger two parallel GT3 calls:
    - Call C1: Workplan narrative (build from Profile + previous approved Workplan/Status + NEW INPUT)
    - Call C2: Status narrative (build from Profile + previous approved Status/Workplan + NEW INPUT)
  - Show progress: "Generating Status and Workplan…"
  - Atomic commit:
    - If both succeed: update both `statusText` and `workplanText`, append audit events, save
    - If either fails: discard both, show error toast, log `error` audit event
- Add `inference-narratives.js`:
  - `buildWorkplanNarrative(profile, previousWorkplan, previousStatus, newInput)` → per InferenceSpec C1
  - `buildStatusNarrative(profile, previousStatus, previousWorkplan, newInput)` → per InferenceSpec C2
- Update audit log with standardized payloads (requestNarrative, responseText, truncation flags per ObservabilitySpec)
- Note: Log `null` for `provider`, `model` (GT3 doesn't return these); log client-side `latencyMs` if measured

**Validation Method:**
- Manual: Upload document, verify both Status and Workplan populate
- Simulate one call failing (mock GT3 error), verify both discarded
- Check audit log payloads match ObservabilitySpec schema

**Dependencies/Risks:**
- GT3 must handle parallel requests (assume it does, per server.js)

---

#### Step 10: Status Approval → Workplan Generation + Title Proposal
**Spec References:** QuoteMeInferenceSpec.md (Call C1, Call B), QuoteMeStateMachineSpec.md, QuoteMeUxSpec.md, GT2_DraftFirst_MicroUX_Spec.md  
**Concrete Changes:**
- **Status approval workflow (general, not just day-zero)**:
  - User can manually edit Status textarea (tracked with glyph states: user-only ● vs LM-only ◯)
  - When Status is approved (via glyph toggle) and Workplan is empty: trigger Workplan-only inference (Call C1)
  - Narrative: Profile + approved Status (no NEW INPUT document)
  - Generated Workplan saved as draft (not auto-approved)
  - This applies whenever Workplan is empty, not just in day-zero mode
- Day-zero detection: if `workplanText` empty and no `workplan_generated` audit event → day-zero mode
  - In day-zero: disable Workplan textarea (greyed), allow Status editing
  - Day-zero is a UI state (read-only Workplan), but Status approval → Workplan generation works the same way
- Title proposal:
  - After NEW INPUT, if `title` is empty/whitespace, trigger title inference (Call B)
  - Narrative: Profile + NEW INPUT only
  - Apply proposed title directly to `title` field (keep editable)
  - Log `title_proposed` audit event
- Add `title-utils.js`:
  - `buildTitleNarrative(profile, newInput)` → per InferenceSpec Call B
  - `proposeTitle(profile, newInput)` → calls GT3, returns title string

**Validation Method:**
- Manual: Create new opportunity, paste Status text, approve → verify Workplan generates
- Create opportunity with empty title, upload doc → verify title auto-fills
- Edit title after proposal → verify it remains editable

**Dependencies/Risks:**
- None (logic only)

---

### Phase 5: Approvals & EP Gating (Steps 11-12)
**Goal:** Approval workflow, EP generation prerequisites.

#### Step 11: Approval Semantics & EP Gating
**Spec References:** QuoteMeStateMachineSpec.md, QuoteMeDataSpec.md, GT2_DraftFirst_MicroUX_Spec.md  
**Concrete Changes:**
- In `opportunity.html`:
  - Status and Workplan approval via glyph toggle (per GT2_DraftFirst_MicroUX_Spec.md):
    - Clicking glyph toggles approval state
    - Sets `statusApproved = true/false`, `statusApprovedAt = now/null` (or cleared)
    - Logs `status_approved` / `workplan_approved` audit event when approved
    - Glyph shows approved state (◯✓) when approved
  - **Important:** Textareas remain editable after approval (not read-only) - this is handled by draft-field component
  - Edit-after-approval detection:
    - If Status edited after approval → revoke automatically (`statusApproved = false`, clear timestamp)
    - If Workplan edited after approval → revoke automatically
    - Revocation is handled by draft-field component's onTextChange callback
  - "Generate Engagement Proposal" button:
    - Enabled only when: `statusApproved && workplanApproved && paApproved` (check global PA)
    - If PA not approved: show tooltip "Approve PA first"
    - If Status not approved: show tooltip "Approve Status first"
    - If Workplan not approved: show tooltip "Approve Workplan first"

**Validation Method:**
- Manual: Approve Status + Workplan via glyph toggle, verify EP button enables
- Edit Status after approval, verify approval revoked automatically, EP button disabled
- Check PA approval state affects EP button

**Dependencies/Risks:**
- None (state management)

---

#### Step 12: EP Generation & Workflow
**Spec References:** QuoteMeInferenceSpec.md (Call D), QuoteMeStateMachineSpec.md (EP rules), QuoteMeUxSpec.md, GT2_DraftFirst_MicroUX_Spec.md  
**Concrete Changes:**
- Create `ep.html` (mirror Legato's workflow logic, but use Draft-First UX patterns for all GT3 outputs):
  - Header: Opportunity title, back button
  - Read-only section: Approved Workplan + Status (collapsible)
  - EP textarea using `draft-field` component (per GT2_DraftFirst_MicroUX_Spec.md Section 3A):
    - Inline editable textarea with glyph-based approval (5-state glyph system)
    - Approval via glyph toggle (no separate "Approve EP" button)
    - Glyph states: empty / user-only (●) / LM-only (◯) / LM+User (◉) / approved (◯✓)
    - Read-only when `epSent = true` (locked per QuoteMeStateMachineSpec.md Section 4.2 Rule 5)
  - Button: "Mark as Sent" (enabled only when EP is approved via glyph)
  - State handling:
    - If `epSent = true`: EP textarea read-only (locked), button disabled
    - If EP edited after approval (and not sent): revoke `epApproved` automatically
- EP generation:
  - Build narrative per InferenceSpec Call D (Profile + PA + Opportunity title + approved Workplan + approved Status)
  - Call GT3, save to `opportunity.ep.epText`
  - Set `epGeneratedAt = now`, `epApproved = false`, `epSent = false`
  - Log `ep_generated` audit event
- EP invalidation:
  - When new Status/Workplan approved after EP exists → clear EP (per StateMachineSpec rule)
- Add `ep-utils.js`:
  - `buildEPNarrative(profile, pa, opportunity)` → per InferenceSpec Call D
  - `generateEP(profile, pa, opportunity)` → calls GT3, returns EP text
  - `invalidateEP(opportunity)` → clears EP state

**Validation Method:**
- Manual: Generate EP, verify structured output with headings
- Approve EP via glyph toggle, mark sent → verify EP becomes read-only
- Approve new Status after EP exists → verify EP cleared
- Verify EP glyph shows correct state (LM-only ◯ when generated, approved ◯✓ when approved)

**Dependencies/Risks:**
- None (EP workflow logic)

---

### Phase 6: Admin & Observability (Steps 13-14)
**Goal:** Admin diagnostics, audit log viewing, export.

#### Step 13: Admin Diagnostics View
**Spec References:** QuoteMeObservabilitySpec.md, QuoteMeSecurityPrivacySpec.md  
**Concrete Changes:**
- Create `admin.html` (or embed in sidebar):
  - Passcode gate: prompt for passcode `123` (hardcoded)
  - Global status view:
    - Profile exists/valid indicator
    - PA exists/approved indicator
    - Last updated timestamps
  - Opportunity selector: dropdown/list to select Opportunity
  - Audit log viewer:
    - Render `auditLog[]` entries for selected Opportunity
    - Show: timestamp, event type, summary
    - Expandable payloads: show requestNarrative, responseText (with truncation indicators)
    - Error previews: show upstreamStatus, upstreamBodyPreview (truncated)
- Add `admin-utils.js`:
  - `getGlobalStatus()` → returns Profile/PA status summary
  - `formatAuditEntry(entry)` → formats for display
  - `truncateForDisplay(text, maxChars)` → truncates with marker

**Validation Method:**
- Manual: Enter passcode, verify admin view accessible
- Select opportunity, verify audit log renders
- Check truncation indicators appear for long narratives

**Dependencies/Risks:**
- None (UI rendering)

---

#### Step 14: Export Functionality
**Spec References:** QuoteMeObservabilitySpec.md, QuoteMeSecurityPrivacySpec.md  
**Concrete Changes:**
- In `admin.html`:
  - "Export" button
  - Warning message: "Export contains customer text and AI outputs. Share carefully."
  - On click: download `quoteme.v1` JSON blob as `quoteme-export-YYYY-MM-DD.json`
- Add `export-utils.js`:
  - `exportAllData()` → reads `localStorage["quoteme.v1"]`, returns JSON string
  - `downloadJSON(jsonString, filename)` → triggers browser download

**Validation Method:**
- Manual: Click Export, verify JSON file downloads
- Open exported JSON, verify all data present (Profile, PA, Opportunities, audit logs)

**Dependencies/Risks:**
- None (browser download API)

---

### Phase 7: Polish & QA Spine (Step 15)
**Goal:** UI polish, error handling, QA test scenarios.

#### Step 15: Error Handling, UI Polish, QA Spine
**Spec References:** QuoteMeQASpec.md, QuoteMeUxSpec.md, QuoteMeUiSpec.md (inferred from Legato)  
**Concrete Changes:**
- Error handling:
  - Generic toasts for user-facing errors ("Generation failed. Please retry.")
  - Full error details in Admin view only
  - Network error handling (offline detection, retry prompts)
- UI polish:
  - QuoteMe color scheme applied consistently (electric blue, approved cyan)
  - Loading states for all async operations
  - Collapsible sections (mirror Legato patterns)
  - Responsive layout (mobile-friendly)
- QA spine implementation (for external automated test system):
  - Create test helper utilities (not a qa.html page):
    - `clearStorage()` → wipes `quoteme.v1` (for test setup)
    - `createTestProfile()` → returns synthetic Profile (for test data)
    - `createTestOpportunity()` → returns synthetic Opportunity (for test data)
  - Note: QA scenarios are for external integration tests (per QuoteMeQASpec), not in-app runner
  - Test helpers can be used by external test framework (e.g., Playwright, Puppeteer)

**Validation Method:**
- Manual: Test error cases: GT3 offline, invalid responses
- Visual review: check color scheme (#2F6BFF primary, #00B8D9 approved), spacing, typography
- QA scenarios: external test system validates (not in-app)

**Dependencies/Risks:**
- QA scenarios require GT3 test instance (assume available)

---

## Day-1 Tasks (Quick Skeleton)

**Goal:** Get a running QuoteMe skeleton in ~4-6 hours that demonstrates the core flow.

### Task 1: Storage + Basic HTML Shell (1-2 hours)
- Create `storage.js` with `loadQuoteMeData()`, `saveQuoteMeData()`
- Create `index.html` with:
  - Landing form (Profile fields, minimal validation)
  - Opportunities list placeholder
  - Basic Bootstrap styling
- Manual test: fill Profile form, submit, verify localStorage has `quoteme.v1`

### Task 2: GT3 Client + PA Generation (1-2 hours)
- Create `gt3-client.js` with `callGT3(narrative)` (body: `{ narrative }` only; headers: `X-GT3-Tenant`, `X-GT3-Data-Track`, `X-GT3-Consent-Version` per GTL3 confirmation)
- Wire Profile submit → call GT3 for PA → save PA → route to list
- Manual test: complete onboarding, verify PA text appears in localStorage

### Task 3: Opportunity Creation + Basic Detail (1-2 hours)
- Create `opportunity.html` with:
  - Title input
  - Status/Workplan textareas
  - Upload file input
- Wire "Create Opportunity" → new Opportunity → route to detail page
- Manual test: create opportunity, verify it appears in list

### Day-1 Deliverable:
- User can: fill Profile → get PA → create Opportunity → see basic detail page
- All data persists in localStorage
- GT3 integration works (PA generation)

---

## Potential Asks for GTL3

### Ask 1: Confirm GT3 Endpoint Contract
**Who:** GTL3  
**What:** Verify QuoteMe's planned request envelope matches GT3's current expectations  
**Why:** QuoteMeApiSpec requires body payload `{ tenant, app: "quoteme", track, consent, narrative }`; also sending headers like Legato for compatibility. Need confirmation this format is accepted.  
**Blocked On:** None (can proceed by matching Legato's actual implementation, but confirmation reduces risk)  
**Status:** ✅ **Resolved** (answered by GTL3)
**GTL3 Response:**
- ✅ Body should be `{ narrative: string }` only (GT3 ignores other body fields)
- ✅ Headers are source of truth: `X-GT3-Tenant: "gt2-quoteme-dev"`, `X-GT3-Data-Track: "green"`, `X-GT3-Consent-Version: "v1"`
- ✅ Response format: `{ response: string }` (matches Legato)

### Ask 2: GT3 Response Metadata (Optional)
**Who:** GTL3  
**What:** Does GT3 return provider/model/latency in response headers or body?  
**Why:** QuoteMe ObservabilitySpec requires logging `provider`, `model`, `latencyMs` in audit payloads  
**Blocked On:** None (can log `null` if unavailable, but better to capture if GT3 provides it)  
**Status:** ✅ **Resolved** (answered by GTL3)
**GTL3 Response:**
- ✅ GT3 does NOT return provider/model/latency in response
- ✅ Recommendation: Log `null` for `provider`, `model`; measure client-side `latencyMs` if needed

---

## Potential Asks for GTdevOps

### Ask 1: Test GT3 Instance for QA
**Who:** GTdevOps  
**What:** Provide a stable GT3 test instance URL for QuoteMe QA scenarios  
**Why:** QuoteMeQASpec requires integration tests against real GT3 instance  
**Blocked On:** None (can use localhost:8080, but dedicated test instance is better)  
**Acceptance Criteria:**
- GTdevOps provides: GT3 test instance URL (or confirms localhost:8080 is sufficient)
- GTdevOps confirms: test instance can handle parallel requests (for Status+Workplan atomic calls)

### Ask 2: Static File Serving Path (Optional)
**Who:** GTdevOps  
**What:** Confirm QuoteMe HTML files are served at `/gt2/QuoteMe/` path  
**Why:** server.js comments indicate QuoteMe should be at `/gt2/QuoteMe/`, but want confirmation  
**Blocked On:** None (can proceed assuming current server.js structure)  
**Acceptance Criteria:**
- GTdevOps confirms: QuoteMe files in `public/gt2/QuoteMe/` are served at `http://localhost:8080/gt2/QuoteMe/`
- Or GTdevOps provides: correct path if different

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| GT3 endpoint contract differs from Legato | High | Match Legato's actual implementation exactly; verify request/response format by inspecting Legato code |
| localStorage size limits with large audit logs | Medium | Enforce 200k char truncation per ObservabilitySpec |
| PDF extraction not available | Low | Explicitly deferred to v1.1; v1 supports .txt + .docx only |
| Parallel GT3 calls fail partially | Medium | Implement atomic discard (Step 9) |
| QA scenarios require non-deterministic assertions | Low | Use structural checks only (length, non-empty, headings); external test system handles scenarios |

---

## Success Criteria

QuoteMe v1 is "done" when:
1. ✅ User can complete full journey: Profile → PA → Opportunity → Status/Workplan → EP → Sent
2. ✅ All state persists in localStorage under `quoteme.v1`
3. ✅ Approvals gate EP generation correctly
4. ✅ Edit-after-approval revokes approvals
5. ✅ Admin view shows audit logs with standardized payloads
6. ✅ Export downloads full `quoteme.v1` JSON
7. ✅ QA spine scenarios 1-5, 7 pass (structural assertions)

---

## Next Steps

1. Review this work plan with stakeholders
2. Write asks to TeamSpace.md (if any)
3. Begin Day-1 tasks
4. Proceed incrementally through phases, validating each step

---

*"Love made executable" — let's build this with care and clarity.* ♥
