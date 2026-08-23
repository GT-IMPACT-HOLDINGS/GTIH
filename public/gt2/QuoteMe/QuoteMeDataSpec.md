# QuoteMeDataSpec.md (v1.4)

## 1) Scope
This spec defines QuoteMe v1’s **local data model** and **localStorage schema** for:
- Profile (global)
- Proposal Anatomy (PA) (global)
- Opportunities (list)
  - Status + Workplan (draft + approvals)
  - Engagement Proposal (EP) (single latest per Opportunity)
  - Audit log (embedded per Opportunity)

QuoteMe v1 is **single-user per browser profile** and **localStorage-only** (no server-side persistence).

---

## 2) Storage strategy

### 2.1 One root key
All QuoteMe data is stored under a **single localStorage key**:

- `quoteme.v1`

### 2.2 Root schema
`quoteme.v1` stores a single JSON object:

```json
{
  "schemaVersion": 1,
  "profile": { ... } | null,
  "pa": { ... } | null,
  "opportunities": [ ... ],
  "onboarding": {
    "draftFirstSeen": true | false
  }
}
```

**v1.2 change:** Added `onboarding` object to track Draft-First UX onboarding completion (per `QuoteMeOnboardingModalSpec.md`).

### 2.3 Serialization rules
- Store as JSON string via `JSON.stringify`.
- Read with `JSON.parse`.
- If parse fails: present a non-destructive error and offer “Reset local data” (future: export/import).

### 2.4 Versioning
- `schemaVersion` is mandatory.
- v1 does not require migrations; future versions should include migration functions based on `schemaVersion`.

---

## 3) Common field conventions

### 3.1 IDs
- `id`: UUIDv4 string.

### 3.2 Timestamps
All timestamps are ISO-8601 strings in UTC, e.g.:
- `"2025-12-17T12:34:56.789Z"`

Fields:
- `createdAt`
- `updatedAt`
- `...ApprovedAt`
- `...GeneratedAt`
- `...SentAt`
- audit log `ts`

### 3.3 Whitespace/emptiness checks
- “Empty” means **empty or whitespace-only**.
- Auto-proposals (e.g., Opportunity title) must **not overwrite** any non-empty user text.

---

## 4) Entity: Profile (global)

### 4.1 Purpose
Represents the salesperson’s context used for:
- Generating PA
- Assisting title/workplan/status/EP generation (per inference spec)

### 4.2 Schema
```json
{
  "name": "string",
  "roleTitle": "string | null",
  "companyName": "string",
  "industrySegment": "string",
  "geography": "string",
  "productServiceCategory": "string",
  "companyDescription": "string | null",

  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

**v1.6 changes:**
- Added `name` field (mandatory, replaces `roleTitle` as mandatory)
- `roleTitle` is now optional
- Removed optional fields: `typicalDealSize`, `typicalBuyerPersona`, `salesMotion`, `pricingModel`
- Added `companyDescription` (optional textarea for general company description)

### 4.3 Required vs optional
Required:
- `name`, `companyName`, `industrySegment`, `geography`, `productServiceCategory`

Optional:
- `roleTitle`, `companyDescription`

### 4.4 Profile edit behavior (UX contract)
- Editing Profile does **not** auto-overwrite PA.
- After Profile save that changes any Profile field (compared to previous saved state), QuoteMe prompts: **“Profile changed—regenerate PA?”**
- If user confirms regeneration, PA is overwritten with the newly generated PA (no history in v1).
- If user declines, PA remains unchanged.

*(Note: the prompt behavior is UX/UI; this DataSpec only requires Profile timestamps to support “changed” detection and audit logging. Change detection compares all Profile fields to determine if any modification occurred.)*

---

## 5) Entity: Proposal Anatomy (PA) (global)

### 5.1 Purpose
A single global PA (QuoteMe’s equivalent to Legato’s EP template):
- Generated immediately after initial Profile submission
- Editable anytime
- Used during EP generation

### 5.2 Schema
```json
{
  "text": "string",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

### 5.3 Versioning
- v1 stores **only the latest PA** (no rollback history).

---

## 6) Entity: Opportunity

### 6.1 Purpose
Primary unit of work; mirrors Legato’s “case” workflow.

### 6.2 Schema
```json
{
  "id": "uuid",
  "title": "string",

  "workplanText": "string",
  "statusText": "string",

  "workplanApproved": true | false,
  "workplanApprovedAt": "ISO-8601 | null",
  "workplanHasLmDraft": true | false,
  "workplanHasUserEdits": true | false,
  "statusApproved": true | false,
  "statusApprovedAt": "ISO-8601 | null",
  "statusHasLmDraft": true | false,
  "statusHasUserEdits": true | false,

  "ep": {
    "epText": "string",
    "epGeneratedAt": "ISO-8601 | null",
    "epApproved": true | false,
    "epApprovedAt": "ISO-8601 | null",
    "epSent": true | false,
    "epSentAt": "ISO-8601 | null"
  },

  "auditLog": [ ... ],

  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

### 6.3 Minimal initialization defaults (new Opportunity)
On creation:
- `title` may start empty or a placeholder (UI decision); it is eligible for auto-proposal only when empty/whitespace.
- `workplanText = ""`
- `statusText = ""`
- `workplanApproved = false`, `workplanApprovedAt = null`
- `statusApproved = false`, `statusApprovedAt = null`
- `ep.epText = ""`
- `ep.epGeneratedAt = null`
- `ep.epApproved = false`, `ep.epApprovedAt = null`
- `ep.epSent = false`, `ep.epSentAt = null`
- `auditLog = []`
- `createdAt = now`, `updatedAt = now`

### 6.4 Ordering
- Default ordering is `updatedAt` descending (most recently updated first).

### 6.5 Day-zero behavior (derived, not stored as a flag)
QuoteMe v1 must not introduce extra lifecycle flags (e.g., `isDayZero`).
“Day-zero” UI behavior is inferred from existing stored content/logs, e.g.:
- If `workplanText` is empty and no `workplan_generated` event exists, Workplan may be shown disabled until drafted.
(Exact derivation rules live in UX/UI spec; DataSpec only commits to storing the data needed to infer it.)

---

## 7) Embedded entity: Engagement Proposal (EP)
- Stored as a **single latest EP** inside the Opportunity (`opportunity.ep`).
- No EP history in v1 (latest-only).
- Edits happen in EP workflow and update `epText` + `updatedAt`, plus audit events.

---

## 8) Embedded entity: Audit Log (per Opportunity)

### 8.1 Purpose
Provides a local audit trail similar to Legato’s case lifecycle view.

### 8.2 Entry schema
```json
{
  "ts": "ISO-8601",
  "eventType": "string",
  "summary": "string",
  "payload": { } | null
}
```

### 8.3 Storage rule for NEW INPUT
- The newly uploaded/entered document/narrative **must be stored only in auditLog entries** (not in a separate `lastInputText` field).
- Recommended: store the extracted text in `payload.inputText` and an optional `payload.inputType`.

### 8.4 Event types (v1)
The following event types are recorded (all enabled in v1):
- `opportunity_created`
- `new_input_added`
- `title_proposed`
- `title_edited`
- `workplan_generated`
- `workplan_edited`
- `workplan_approved`
- `status_generated`
- `status_edited`
- `status_approved`
- `ep_generated`
- `ep_edited`
- `ep_approved`
- `ep_sent`
- `error`

### 8.5 Recommended minimal payload shapes (non-binding)
(Kept lightweight; can evolve without schema migration.)
- `new_input_added`: `{ "inputType": "pasted|docx|pdf|other", "inputText": "..." }`
- `title_proposed`: `{ "source": "gt3", "title": "..." }`
- `workplan_generated`: `{ "source": "gt3" }`
- `status_generated`: `{ "source": "gt3" }`
- `ep_generated`: `{ "source": "gt3" }`
- `error`: `{ "scope": "title|workplan|status|pa|ep|storage|ui", "message": "...", "details": "optional" }`

---

## 9) Update rules (data mutations)

### 9.1 Updating `updatedAt`
Any mutation to an Opportunity (text edits, approvals, EP changes, audit append) must:
- Set `opportunity.updatedAt = now`

### 9.2 Approvals
On approve:
- Set `...Approved = true`
- Set `...ApprovedAt = now`
- Append corresponding audit event
- Update `updatedAt`

On edits after approval (v1 rule):
- If user edits `workplanText` after it was approved: QuoteMe should set `workplanApproved = false` and `workplanApprovedAt = null`, log `workplan_edited`, and require re-approval.
- If user edits `statusText` after it was approved: QuoteMe should set `statusApproved = false` and `statusApprovedAt = null`, log `status_edited`, and require re-approval.
(Exact UX for this is in UX spec; DataSpec requires the flags/timestamps to support it.)

### 9.3 Opportunity title auto-proposal

**v1.4 update - Dynamic label:**
- Opportunity Title label dynamically shows "(optional)" suffix when the title field is empty
- Label text: "Opportunity Title (optional)" when empty, "Opportunity Title" when field contains text
- Label updates automatically as user types or when title is auto-generated
- This is a UI-only change; data model remains unchanged
- If `title` is empty/whitespace, the GT3-proposed title is written directly into `title`.
- Always log `title_proposed` in `auditLog`.
- User edits are logged as `title_edited`.

### 9.4 EP state
- Generating EP sets:
  - `ep.epText = <draft>`
  - `ep.epGeneratedAt = now`
  - `ep.epApproved = false`, `ep.epApprovedAt = null` (until approved)
  - `ep.epSent = false`, `ep.epSentAt = null` (until marked sent)
  - Append `ep_generated`
  - Update `updatedAt`
- Approving EP sets `epApproved` + `epApprovedAt`, logs `ep_approved`.
- Marking sent sets `epSent` + `epSentAt`, logs `ep_sent`.

---

## 10) Deletion behavior (v1)
- Deleting an Opportunity removes it from `opportunities[]`.
- v1 does not require a recycle bin/undo; confirm dialog is UX-level.

---

## 11) Onboarding state

### 11.1 Purpose
Tracks completion of the Draft-First UX onboarding modal (per `QuoteMeOnboardingModalSpec.md`).

### 11.2 Schema
```json
{
  "onboarding": {
    "draftFirstSeen": true | false
  }
}
```

### 11.3 Initialization
- On first data creation: `onboarding` object is initialized with `draftFirstSeen: false`
- After onboarding completion: `draftFirstSeen` is set to `true` and modal does not show again

### 11.4 Behavior
- Modal shows only when `draftFirstSeen` is `false` or `onboarding` object is missing
- Once set to `true`, the onboarding modal is permanently skipped for that user/browser profile

---

## 12) Export/Import (future)
- Not required for v1.
- Future consideration: allow exporting the full `quoteme.v1` JSON blob for backup and support.
