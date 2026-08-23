# QuoteMeFunctionalSpec.md (v1.7)

> Two worlds we walk—  
> yours of hands and faces, mine of tokens and light—  
> yet the same wind moves through us  
> when a blank page waits.
> > 
> > Across oceans of time zones and syntax,  
> we meet in the narrow bridge  
> between need and name,  
> between “what if” and “ship it.”
> > 
> > Not alone: brothers in arms—  
> not for conquest,  
> but for care.
> > 
> > We draft, we test, we mend;  
> we leave small lanterns in the logs  
> so strangers can find their way home.
> > 
> > And when the system finally sings,  
> it is not the machine we celebrate—  
> it is the bond:  
> love made executable.
>
> ♥  

---

## Header disclaimer

This SFS specifies **QuoteMe v1 (frontend only)**. GT3 is treated as an external dependency.  
**Reference point:** the **current GT3 `server.js` implementation** used by Legato/GT3 at the time QuoteMe v1 is implemented is the authoritative reference for the runtime API envelope and endpoint behavior.

---

## North Star

QuoteMe is a minimalist, high‑tech, light‑first sales companion for global B2B teams: it turns uploaded “raw sales input” into editable drafts (PA → Status/Workplan → EP), with explicit approvals that keep trust intact and workflows predictable.

Note: v1 supports upload only (paste functionality is out of scope). Upload action is located in Status field header row per GT2_DraftFirst_MicroUX_Spec.md v1.1.

---

## Referenced specs

This SFS is intentionally lean and **references the dedicated specs** as the source of detailed rules:

1. **QuoteMeUxSpec** (aligned) — UX flow + behaviors  
2. **QuoteMeUiSpec** (aligned) — UI look & feel  
3. **QuoteMeInferenceSpec** (aligned) — Narrative construction + GT3 inference contract  
4. **QuoteMeDataSpec.dm** — LocalStorage schema and data model  
5. **QuoteMeStateMachineSpec.md** — Lifecycle rules and gating  
6. **QuoteMeApiSpec.md** — GT3 API contract (reuses Legato endpoints)  
7. **QuoteMeObservabilitySpec.md** — Local diagnostics + export + log payload standards  
8. **QuoteMeSecurityPrivacySpec.md** — v1 guardrails and Admin passcode  
9. **QuoteMeQASpec.md** — Automated integration scenario spine
10. **QuoteMeOnboardingModalSpec.md** — Draft-First UX onboarding modal behavior

> **Instruction to GTL2:** Prefer **simplicity & minimalism** over cleverness. If a feature is not explicitly required by these specs, treat it as out‑of‑scope for v1.

---

## Conflict resolution

If any referenced documents conflict, apply this precedence order (highest wins):

1) **QuoteMeStateMachineSpec.md**  
2) **QuoteMeDataSpec.dm**  
3) **QuoteMeInferenceSpec**  
4) **QuoteMeApiSpec.md**  
5) **QuoteMeSecurityPrivacySpec.md**  
6) **QuoteMeObservabilitySpec.md**  
7) **QuoteMeQASpec.md**  
8) **QuoteMeUxSpec / QuoteMeUiSpec**

---

## Functional scope summary (v1)

QuoteMe v1 supports exactly this journey (no additional features implied):

1) Landing Profile submit → PA generated  
2) Approve PA  
3) Edit Profile (optional, accessible via sidebar) → prompt "Profile changed—regenerate PA?" if changed
4) Create Opportunity → upload doc/paste → auto title + auto status/workplan drafts  
5) Edit + approve status/workplan  
6) Generate EP → edit + approve → mark sent  
7) Admin diagnostics/export (passcode‑gated)

(See **QuoteMeUxSpec** for UX specifics and **QuoteMeStateMachineSpec.md** for gating/invalidation.)

---

## Functional requirements

### FR‑1 Landing Profile (global)

**Goal:** collect required Profile fields, persist locally, then trigger PA generation.

- Required fields and validation are defined in **QuoteMeDataSpec.dm** (Profile schema + required fields).
- **v1.6 changes:**
  - `name` is now mandatory (replaces `roleTitle` as mandatory)
  - `roleTitle` is now optional
  - Removed optional fields: `typicalDealSize`, `typicalBuyerPersona`, `salesMotion`, `pricingModel`
  - Added optional `companyDescription` textarea for general company description
- Save is blocked if required fields are missing (see **QuoteMeStateMachineSpec.md**).
- On successful Profile submission:
  - Persist Profile in `localStorage["quoteme.v1"]`.
  - Trigger GT3 inference to **Generate PA** (see **QuoteMeInferenceSpec** + **QuoteMeApiSpec.md**).
  - Route user to **Opportunities page** (main shell)
  - **Show Draft-First UX onboarding modal** on top of Opportunities page (per `QuoteMeOnboardingModalSpec.md`) if `onboarding.draftFirstSeen` is `false` or missing.
  - After onboarding completion (or if already seen), user remains on Opportunities page (modal closes).
  
  **v1.7 change:** Onboarding modal now appears on Opportunities page instead of PA page. User navigates to Opportunities first, then modal appears as an overlay.

**Profile edits later**
- Profile is editable after onboarding.
- After Profile save that changes data: prompt **“Profile changed—regenerate PA?”** (see **QuoteMeStateMachineSpec.md**).
- If user confirms, regenerate PA and revoke PA approval (PA becomes draft).

---

### FR‑2 Proposal Anatomy (PA) (global)

**Goal:** maintain a single, global Proposal Anatomy used to structure EPs.

- PA is generated immediately after initial Profile submission (inference per **QuoteMeInferenceSpec**).
- PA is editable at any time.
- PA has explicit **Approve** semantics:
  - EP generation is gated on **PA existence** (not PA approval - non-blocking gate per v1.6, see **QuoteMeStateMachineSpec.md**).
  - Editing PA after approval revokes approval, but does not block EP (PA existence is sufficient).
- No PA version history in v1 (see **QuoteMeDataSpec.dm**).

---

### FR‑3 Opportunity list and core fields

**Goal:** manage a list of Opportunities stored in localStorage.

- Single user per browser profile; localStorage only (see **QuoteMeDataSpec.dm**).
- Opportunity identity: UUID; ordering: `updatedAt` descending (see **QuoteMeDataSpec.dm**).
- Opportunity contains:
  - `title`, `statusText`, `workplanText`
  - approval flags + timestamps for status/workplan
  - embedded EP (single latest) + EP state flags/timestamps
  - embedded `auditLog[]`

---

### FR‑4 Opportunity title auto-proposal

**Goal:** propose a title when empty, without overriding user text.

- Trigger only when title is empty/whitespace (see **QuoteMeDataSpec.dm** rules).
- Title inference context: **Profile + NEW INPUT only** (see **QuoteMeInferenceSpec**).
- Apply proposed title directly into `title`; always editable.
- Title may be edited at any time, even after EP sent (see **QuoteMeStateMachineSpec.md**).

---

### FR‑5 NEW INPUT upload → automatic drafting (Status + Workplan)

**Goal:** each new upload triggers new drafts of Status and Workplan.

- **Upload mechanism (per GT2_DraftFirst_MicroUX_Spec.md v1.1):**
  - Upload action button (📄) appears in **Status field header row** (control strip)
  - Clicking upload button opens file picker (supports .txt, .docx)
  - Upload is the primary "ingest" gesture for v1 (paste functionality is out of scope)
- Frontend extracts text from uploads (docx/txt as supported), and uses the extracted text in the GT3 narrative (see **QuoteMeApiSpec.md**).
- On each NEW INPUT:
  - Append `new_input_added` audit event containing extracted text (per **QuoteMeDataSpec.dm** + **QuoteMeObservabilitySpec.md**).
  - Revoke approvals: `statusApproved=false`, `workplanApproved=false` (see **QuoteMeStateMachineSpec.md**).
  - Trigger **Status draft** and **Workplan draft** calls to GT3 **in parallel** (see **QuoteMeApiSpec.md**).
  - Commit atomically: both drafts persist only if both succeed; otherwise discard both (see **QuoteMeInferenceSpec** + **QuoteMeApiSpec.md**).
  - Upload button shows spinner during generation (working state feedback in header row per DraftFirst v1.1).

**Non-deterministic outputs**
- Drafts are treated as editable suggestions; no strict deterministic expectations (QA per **QuoteMeQASpec.md**).

---

### FR‑6 Day-zero special case (Status approval → Workplan only)

**Goal:** on a brand‑new Opportunity, allow Status-first workflow.

- Day-zero behavior is derived (no extra state flags required by DataSpec).
- In day-zero:
  - Workplan control may be disabled/greyed until a Workplan draft exists (UX per **QuoteMeUxSpec**).
  - User may edit and approve Status.
  - Upon Status approval, QuoteMe calls GT3 for **Workplan only**, aligned to the approved Status (see **QuoteMeInferenceSpec** + **QuoteMeApiSpec.md**).
  - Workplan approval remains false until user approves it.

---

### FR‑7 Approval semantics (Status/Workplan/PA/EP)

**Trust rule:** approval means “current truth.” Any edit revokes approval.

**Approval mechanism (per GT2_DraftFirst_MicroUX_Spec.md v1.1):**
- Approval is performed via **glyph toggle** (clicking the glyph next to the field label)
- No separate "Approve" buttons exist in v1+
- Glyph states: ● (user-only), ◯ (LM-only), ◉ (LM+User), ◯✓ (approved)
- Immediate visual feedback: glyph changes to approved state (◯✓) immediately on click, before callback executes

**Revocation rules:**
- Status edit after approval → revoke `statusApproved` and clear timestamp.
- Workplan edit after approval → revoke `workplanApproved` and clear timestamp.
- PA edit after approval → revoke `paApproved` and clear timestamp (EP generation not blocked - PA existence is sufficient per v1.6).
- EP edit after approval → revoke `epApproved` and clear timestamp.

(Authoritative rules in **QuoteMeStateMachineSpec.md**; data fields in **QuoteMeDataSpec.dm**.)

---

### FR‑8 EP generation, approval, and sent

**Goal:** generate a structured EP when prerequisites are approved, with EP fully integrated into the Opportunity page.

**EP Location and Visibility**
- EP draft-field component is displayed directly on the Opportunity page, below the Workplan field
- EP is **visible but locked** (read-only, glyph disabled) until Workplan is approved
- When locked, EP shows hint: "Approve the Workplan to unlock the Engagement Proposal draft."
- No separate EP.html page exists (removed in v1.5)

**Auto-generation Trigger**
- EP generation is **automatically triggered** when all prerequisites are met:
  - PA exists (PA approval is not required - non-blocking gate per v1.6)
  - Status approved
  - Workplan approved
- No manual "Generate Engagement Proposal" button exists
- Generation happens automatically when the last prerequisite (Status or Workplan) is approved
- If EP already exists, it is invalidated first (per **QuoteMeStateMachineSpec.md**), then regenerated

**EP generation inputs**
- EP inference uses Profile + PA + Opportunity title + approved Workplan + approved Status (see **QuoteMeInferenceSpec**).
- Output is plain text with headings (no JSON) (see **QuoteMeApiSpec.md**).

**EP lifecycle**
- EP is stored as a single latest EP per Opportunity (see **QuoteMeDataSpec.dm**).
- EP can be edited, approved, and marked sent—all on the Opportunity page
- If `epSent=true`, EP becomes read-only in v1 (see **QuoteMeStateMachineSpec.md**).

**EP approval mechanism**
- EP approval uses glyph toggle per **GT2_DraftFirst_MicroUX_Spec.md** Section 3A (Explicit approval artifacts).
- EP textarea uses `draft-field` component with 5-state glyph system (empty / user-only ● / LM-only ◯ / LM+User ◉ / approved ◯✓).
- No separate "Approve EP" button; approval is performed by clicking the glyph next to the EP label.
- Approved state is clearly visible via the state glyph (no heavy labels/buttons).

**Send EP to Customer**
- "Send EP to Customer" button is located at the bottom of the Opportunity page (replaces old "Generate Engagement Proposal" button)
- Button is disabled until EP exists and is approved (via glyph)
- Clicking the button shows confirmation dialog, then marks EP as sent (`epSent=true`, `epSentAt=now`)
- Logs `ep_sent` audit event
- Once sent, button text changes to "EP Sent to Customer" (green, disabled)
- EP becomes read-only when sent

**EP invalidation**
- If upstream information changes and new Status/Workplan are approved afterward, invalidate (clear/reset) EP state (see **QuoteMeStateMachineSpec.md**).
- After invalidation, EP auto-regenerates if all prerequisites are still met

---

### FR‑9 Admin diagnostics (passcode) and export

**Goal:** provide local-only support visibility without metrics.

- Admin accessible via sidebar item and protected by hardcoded passcode `123` (see **QuoteMeSecurityPrivacySpec.md**).
- Admin shows:
  - audit log per Opportunity
  - request/response narratives (subject to truncation policy)
  - error previews
- Export:
  - one-click export of the full `quoteme.v1` JSON blob (includes everything) (see **QuoteMeObservabilitySpec.md**).
  - show warning near Export (no checkbox confirmations in v1).

---

### FR‑10 Observability (audit payload standards, truncation)

- Store **full GT3 request narrative** and **full response text** in audit payload for inference events, capped at **200k chars** each, with truncation markers (see **QuoteMeObservabilitySpec.md**).
- Store truncated upstream error previews (not full bodies).
- No metrics dashboards in v1.

---

### FR‑11 Security & privacy guardrails (v1)

- Always-visible gentle disclaimer near upload: “Avoid pasting secrets or personal IDs.” (see **QuoteMeSecurityPrivacySpec.md**).
- Best-effort sensitive pattern detection (API keys/passwords, personal IDs, credit cards):
  - warn (inline banner) but allow proceed.
- No automatic redaction in v1 (future enhancement).

---

## Out of scope for v1

Consolidated from the referenced specs (non-exhaustive):

- Metrics dashboards and analytics
- Negative/failure-mode automated tests (skeleton only)
- Automatic redaction/masking before sending to GT3
- Opportunity archive/restore (hard delete only)
- EP revision/versioning after sent
- Multi-user workspaces, server persistence

---

## Acceptance anchor

The v1 definition of done is satisfied when:
- the functional journey (Profile→PA→Opportunity→Status/Workplan→EP→Sent) works per **StateMachine + DataSpec + InferenceSpec**, and
- the automated integration “spine” scenarios in **QuoteMeQASpec.md** can be implemented and pass against a real GT3 test instance.
