# QuoteMeApiSpec.md (v1.4)

This document defines the **frontend ↔ GT3 server API contract** for QuoteMe v1. QuoteMe reuses the **exact same GT3 endpoints and request/response envelope** as Legato, and differs only in **narrative composition** (see QuoteMeInferenceSpec).

---

## 1) High-level principles

1. **Reuse Legato endpoints**  
   QuoteMe calls the same GT3 server routes and uses the same payload envelope as Legato.

2. **Plain-text inference outputs**  
   All GT3 responses used by QuoteMe are **plain text** (including EP, which is structured via headings in the text).

3. **Single narrative field**  
   QuoteMe sends one concatenated string field named `narrative` (Legato style).

4. **No idempotency in v1**  
   QuoteMe does not send idempotency keys or correlation IDs.

5. **Provider/model selection is server-side**  
   QuoteMe does not specify `provider` or `model`; GT3 chooses via its own configuration.

6. **No automatic retries**  
   QuoteMe does not retry failed inference calls automatically; user may retry manually.

7. **Training/ledger metadata enabled**  
   QuoteMe enables the same “training example” / ledger logging metadata that Legato uses (as supported by GT3).

---

## 2) Required request metadata (sent on every request)

QuoteMe includes these identifiers on every GT3 request:

- `tenant` (string) — e.g., `"gt2-quoteme-dev"` or `"quoteme"`
- `app` (string) — `"quoteme"`
- `track` (string) — `"green" | "orange" | "red"` (per GT3 design)
- `consent` (string) — `"v1"` (or the current consent version)

### 2.1 Optional API Key Headers

QuoteMe may send optional API key headers if user has configured an API key:

- `X-GT3-OpenRouter-Key`: API key for OpenRouter provider (if configured)
- `X-GT3-OpenAI-Key`: API key for OpenAI provider (if configured)

These headers are:
- Optional (only sent if user has entered an API key in Settings)
- Stored in browser localStorage under key `quoteme_gt3_api_key` (separate from `quoteme.v1` data blob)
- Sent on every inference request when present
- Per-request overrides (GT3 uses the relevant one per provider and ignores the rest)

**Note:** API key is required if GT3 server needs it (per server.js implementation). Users can enter the key via Settings sidebar (accessible by clicking GT2 logo on any QuoteMe page). The Settings sidebar is implemented using Bootstrap offcanvas and matches Legato's pattern (English UI, QuoteMe color scheme).

---

## 3) Endpoints and operations (logical mapping)

QuoteMe performs these **logical operations**, all implemented via existing Legato-compatible GT3 endpoints:

1. **Generate PA** (post-profile submit)
2. **Propose Opportunity Title** (if title empty)
3. **Generate/Update Workplan** (auto after each upload; and day-zero special case)
4. **Generate/Update Status** (auto after each upload)
5. **Generate EP** (when PA+Status+Workplan are approved)

> Note: The specific endpoint path(s) are identical to Legato’s. QuoteMeApiSpec intentionally does not rename or introduce new routes.

---

## 4) Request envelope

### 4.1 Required fields
QuoteMe sends the following minimum payload (plus any additional Legato-compatible fields your GT3 server already expects):

```json
{
  "tenant": "string",
  "app": "quoteme",
  "track": "green",
  "consent": "v1",
  "narrative": "string"
}
```

### 4.2 Optional fields (Legato-compatible)
If GT3/Legato already supports these envelope fields, QuoteMe may pass them unchanged:
- `mode`, `variant`
- `user` or `actor`
- `caseId` / `opportunityId` (if Legato uses such metadata; optional in v1)
- Training/ledger flags or descriptors used by Legato

*(Exact optional fields should mirror the existing Legato integration; QuoteMe does not invent new ones in v1.)*

---

## 5) Response envelope

### 5.1 Success
QuoteMe expects a **plain-text** response body (or a response object whose primary payload is plain text, exactly as Legato consumes it). The output is written directly into the relevant editable textarea / editor.

### 5.2 Errors
On non-2xx responses or network errors:
- QuoteMe shows a **generic user-friendly toast**.
- QuoteMe logs and surfaces **full error details** only in **Admin** view (see section 9).

QuoteMe does not auto-retry; user initiates retry.

---

## 6) Parallel + atomic paired calls (Workplan + Status)

When a new document/narrative upload occurs for an Opportunity:

1. QuoteMe extracts text in the frontend and appends a `new_input_added` audit log entry.
2. QuoteMe triggers **two GT3 requests in parallel**:
   - Workplan drafting
   - Status drafting
3. QuoteMe applies results **atomically**:
   - If **both succeed**: commit both drafts to the Opportunity and update audit log.
   - If **either fails**: discard both results, persist nothing from the pair, and log an `error` audit event.

No partial updates are allowed for this paired operation.

---

## 7) Day-zero special case (Status approval → Workplan only)

On day-zero (derived by lifecycle, not by explicit flag), QuoteMe allows the user to manually edit and approve Status while Workplan is disabled. When the user **approves Status via glyph toggle** in day-zero:

- QuoteMe triggers a GT3 request for **Workplan only** (plain text).
- Workplan is then populated as a draft and awaits user approval.
- Approval is performed via glyph toggle (per GT2_DraftFirst_MicroUX_Spec.md v1.1), not a separate "Approve Status" button.

---

## 8) File upload extraction responsibility

- QuoteMe performs **frontend text extraction** for uploaded documents (as Legato does).
- QuoteMe sends only extracted text within the `narrative`.
- QuoteMe does **not** upload raw files to GT3 in v1.

---

## 9) Admin diagnostics and error visibility

### 9.1 User-facing error UX
- Generic toast (e.g., “Generation failed. Please retry.”)
- No upstream body or stack details shown to standard users.

### 9.2 Admin view
Admin view may show:
- Full request narrative (or a link to view it)
- Full response text
- Upstream HTTP status and error preview/body (where available)
- Latency and provider/model info (as returned/logged by GT3)

---

## 10) Security & privacy notes (v1)

- QuoteMe v1 sends inputs **as-is** (no automatic redaction), as documented in the inference spec.
- Future enhancement: optional client-side masking/redaction policies.

---

## 11) Compatibility note

Because QuoteMe reuses Legato endpoints, the authoritative source for exact route paths and envelope nuances is the existing **Legato ↔ GT3 integration**. QuoteMe must remain compatible with that contract.

