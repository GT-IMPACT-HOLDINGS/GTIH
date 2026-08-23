# QuoteMeSecurityPrivacySpec.md (v1.4)

This document defines QuoteMe v1 **privacy guardrails** and **lightweight security controls** suitable for a local-only, single-user browser app. QuoteMe v1 sends customer text and AI outputs **as-is** (no automatic redaction), but introduces minimal UI warnings and a light Admin gate.

---

## 1) Principles (v1)

1. **Local-first**  
   QuoteMe data is stored in browser localStorage. Export is user-initiated.

2. **Warn, don’t block**  
   v1 uses gentle guidance and non-blocking warnings to reduce accidental leakage.

3. **Minimal controls (not “real security”)**  
   v1 includes a convenience Admin passcode gate to reduce casual exposure, but it is not a substitute for authentication.

---

## 2) In-scope “sensitive” categories (v1)

For v1, QuoteMe treats these categories as “sensitive” for UI warnings:

- **Passwords / API keys**
- **Personal IDs** (national ID / SSN-like)
- **Credit card numbers**

Out of scope in v1 (no detection/redaction policy specified):
- emails
- phone numbers
- home addresses
- bank/IBAN details
- customer names

---

## 3) User-facing privacy disclaimer (always visible)

### 3.1 Placement
- Show a short disclaimer near the **upload** control on Opportunity pages.
- Note: v1 supports upload only (paste functionality is out of scope). Upload action is located in Status field header row (per GT2_DraftFirst_MicroUX_Spec.md v1.1).

### 3.2 Tone
- Gentle wording (non-alarming).

### 3.3 Example copy (English UI chrome)
- “Avoid pasting secrets or personal IDs.”

*(Exact copy may be tuned, but must remain gentle and short.)*

---

## 4) Sensitive-pattern detection (v1)

### 4.1 Scope
Detection applies to **both**:
- pasted text input
- extracted text from uploaded documents (docx/pdf as implemented)

### 4.2 Implementation guidance (non-binding)
- Use a shared `scanSensitive(text)` helper (regex-based).
- Detection is best-effort; false positives are acceptable in v1 since warnings are non-blocking.

### 4.3 UX behavior on detection (warn-but-allow)
When potential sensitive patterns are detected:
- Show a **non-blocking inline banner** near the upload area (or in a toast notification).
- User can proceed without removing content.

No blocking modals in v1.

### 4.4 Logging
- v1 does **not** add special audit flags for sensitive detection (UI-only warning).

---

## 5) Admin access (v1)

### 5.1 Admin entry point
- Admin is accessible from the sidebar via an **Admin** item.

### 5.2 Passcode gate
- v1 requires a light, hardcoded passcode:
  - **Passcode:** `123`

### 5.3 Security note
This is a convenience gate only:
- It reduces accidental exposure on shared screens.
- It does not provide real security against a motivated attacker.
- Future versions should replace this with real authentication and role-based access.

---

## 6) Export policy (v1)

### 6.1 Export contents
Admin export includes **everything** in `localStorage["quoteme.v1"]`, including:
- Profile
- PA
- all Opportunities
- full audit logs (including raw NEW INPUT text)
- full GT3 request narratives and response texts (subject to truncation rules)

### 6.2 Export UX
- Export remains **one-click**.
- Show a warning message near Export, but no checkbox confirmations.

Example warning:
- “Export contains customer text and AI outputs. Share carefully.”

---

## 7) API Key Management (v1)

### 7.1 Storage
- API key is stored in browser localStorage under key `quoteme_gt3_api_key`
- Separate from main QuoteMe data blob (`quoteme.v1`)
- Stored as plain text (not encrypted)
- Persists across browser sessions

### 7.2 Access
- Accessible via Settings sidebar (click GT2 logo)
- Password input field (type="password" for visual masking)
- User can enter, edit, or clear API key at any time

### 7.3 Usage
- API key is sent in request headers if present:
  - `X-GT3-OpenRouter-Key` (if key exists)
  - `X-GT3-OpenAI-Key` (if key exists)
- GT3 server uses the relevant header per provider configuration
- Key is not logged in audit payloads (security best practice)

### 7.4 Security Note
- API key storage is local-only (browser localStorage)
- No server-side persistence
- Key is sent over network in HTTP headers (HTTPS recommended for production)
- v1 does not encrypt the key in localStorage

---

## 8) Future enhancements (explicitly out of scope for v1)

- Automatic redaction/masking prior to sending text to GT3
- Configurable sensitive categories (emails/phones/etc.)
- Stronger export controls (checkbox confirmations, encryption)
- Real authentication for Admin, role-based access control
- Server-side privacy policy enforcement, retention policies, and compliance workflows

