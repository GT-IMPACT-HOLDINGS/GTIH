# QuoteMeObservabilitySpec.md (v1)

This document defines QuoteMe v1 **observability**: what is logged, what is visible in Admin, and what can be exported for support. QuoteMe v1 observability is **local-only**.

> Note: QuoteMeDataSpec defines the persistence schema. This document defines the *behavioral* logging and diagnostics requirements.

---

## 1) Scope and principles

1. **Local-only (v1)**  
   No client-side analytics events are sent to any server in v1.

2. **No metrics (v1)**  
   QuoteMe v1 does not compute or display metrics dashboards. Observability is strictly logs/diagnostics + export.

3. **Audit-first debugging**  
   Support and troubleshooting rely on per-Opportunity `auditLog[]` entries plus Admin tools to view/export them.

---

## 2) Admin diagnostics

### 2.1 Admin entry point
- Admin diagnostics are accessible via a visible **Admin** item in the left sidebar (per UI spec).

### 2.2 Diagnostics views (v1 minimum)
Admin includes:
- A simple way to select an Opportunity and view its `auditLog[]` entries.
- A view for the global objects (Profile + PA) status at minimum:
  - whether Profile exists/valid
  - whether PA exists/approved
  - last updated timestamps

### 2.3 Export (required)
Admin includes an **Export** action that downloads the full QuoteMe storage blob:
- Entire `localStorage["quoteme.v1"]` JSON (including Profile, PA, all Opportunities, and full audit logs).

Export includes **everything** (including raw NEW INPUT text stored in audit log payloads).

---

## 3) Audit logging requirements

### 3.1 Audit as authoritative local truth
For each Opportunity, `auditLog[]` is the primary record used for:
- lifecycle visibility (case-lifecycle equivalent)
- troubleshooting inference calls
- support export

### 3.2 What must be logged
QuoteMe must log at least the v1 event types defined in DataSpec, including:
- inference-related events (`*_generated`, `title_proposed`, `ep_generated`, etc.)
- approvals (`*_approved`, `ep_sent`)
- user edits (`*_edited`)
- errors (`error`)
- `new_input_added` (with raw extracted input text)

### 3.3 Standardized payload fields (required)
To enable consistent Admin rendering, inference and error events must use standardized payload fields as follows.

#### 3.3.1 Inference event payload schema
For any inference-driven event (e.g., `workplan_generated`, `status_generated`, `ep_generated`, `title_proposed`, `pa_generated` if used):

```json
{
  "requestNarrative": "string",
  "responseText": "string",
  "latencyMs": "number | null",
  "provider": "string | null",
  "model": "string | null",
  "truncated": true | false,
  "truncation": {
    "limitChars": 200000,
    "requestWasTruncated": true | false,
    "responseWasTruncated": true | false
  }
}
```

- `provider`, `model`, `latencyMs` are populated if GT3 returns/records them and QuoteMe has access; otherwise `null`.
- `truncated` is true if either request or response was truncated.

#### 3.3.2 Error event payload schema
For `error` events:

```json
{
  "scope": "title|pa|workplan|status|ep|storage|ui",
  "message": "string",
  "upstreamStatus": "number | null",
  "upstreamBodyPreview": "string | null",
  "truncated": true | false
}
```

- `upstreamBodyPreview` must be a **truncated preview** (not full raw body).
- `truncated` indicates whether the preview itself was truncated.

#### 3.3.3 New input payload schema
For `new_input_added` events:

```json
{
  "inputType": "pasted|docx|pdf|other",
  "inputText": "string"
}
```

NEW INPUT text is stored **only** in audit logs (not in separate Opportunity fields).

---

## 4) Truncation policy (required)

### 4.1 Maximum sizes
To keep localStorage stable, QuoteMe enforces:
- `requestNarrative` max length: **200,000 chars**
- `responseText` max length: **200,000 chars**

If longer, truncate and record truncation flags in payload.

### 4.2 Marking truncation
Whenever truncation occurs:
- `payload.truncated = true`
- populate `payload.truncation.*` accurately
- Admin UI should show a clear indicator: “Truncated to 200k chars”.

---

## 5) Display rules (Admin)

### 5.1 Default display
Admin should present audit entries with:
- timestamp (`ts`)
- event type
- summary
- expandable payload (request/response/error preview)

### 5.2 Sensitive content reminder (v1)
Because export includes raw inputs and full narratives/responses, Admin should show a light warning near Export:
- “Export contains customer text and AI outputs. Share carefully.”

(Behavior only; no policy enforcement in v1.)

---

## 6) Future enhancements (explicitly out of scope for v1)
- Metrics dashboards (counts, conversion funnel, error rates)
- Server-side analytics
- Automatic redaction/masking in logs/exports
- Log compaction/archiving strategies beyond truncation
