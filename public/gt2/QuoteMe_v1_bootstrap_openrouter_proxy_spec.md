# QuoteMe v1 — Secure Bootstrap + Server-Side OpenRouter Proxy (Option 2)

**Version:** v1.0 (Draft)  
**Owners:** GTL2 (QuoteMe Front-End), GTL3 (GT3 Server)  
**Core principle:** *OpenRouter API keys never reach the browser.*

---

## 1. Goal

Implement a **day-zero, zero-login** bootstrap so that:
- A **new browser** can start using QuoteMe immediately on first visit.
- QuoteMe continues to work even if the user deletes `localStorage` (because identity is cookie-based).
- **All** OpenRouter traffic goes **QuoteMe → GT3 → OpenRouter** (server-side proxy).
- Each browser installation is associated with its own OpenRouter key, created via OpenRouter provisioning API key.

---

## 2. Non-goals (explicitly deferred)

Not included in v1:
- User accounts, email login, magic links, passkeys (WebAuthn), recovery codes
- Key rotation UI, “reset installation” UI
- Anti-fraud / device fingerprinting beyond a cookie
- Multi-browser sync for the same person
- Advanced abuse analytics (beyond basic per-install rate limiting and logs)

---

## 3. High-level flow

### 3.1 First-ever visit (day zero)
1. User opens `index.html`.
2. QuoteMe calls `POST /bootstrap` with `credentials: "include"`.
3. GT3 server:
   - Creates a **new install token** (opaque random).
   - Calls OpenRouter **Key Management** API to create a new OpenRouter key for this install.
   - Stores mapping: `install_token_hash → openrouter_key_secret (+ metadata)`.
   - Sets `Set-Cookie: quoteme_install=<install_token>; HttpOnly; SameSite=Lax; ...`
4. QuoteMe receives `200 OK` and proceeds.

### 3.2 Subsequent visits (including after localStorage deletion)
1. QuoteMe calls `POST /bootstrap` again (safe/idempotent).
2. Browser automatically sends `quoteme_install` cookie.
3. GT3 server finds mapping and returns `200 OK` without creating a new key.
4. QuoteMe proceeds.

### 3.3 Inference
1. QuoteMe calls `POST /quoteme/infer` with the user’s inputs (case context, narrative, etc.) and `credentials: "include"`.
2. GT3 server uses cookie to locate the OpenRouter key and forwards request to OpenRouter.
3. GT3 returns only model output (and safe metadata) to QuoteMe.

---

## 4. GTL2 (Front-End) specification

### 4.1 Startup bootstrap
- Add `ensureBootstrap()` that runs:
  - on app load, and
  - before any “Generate Quote” action (as a guard)

**Contract**
- `POST /bootstrap`
- Include credentials:
  - `fetch("/bootstrap", { method: "POST", credentials: "include" })`

**UX requirements**
- No login dialogs.
- If bootstrap fails:
  - show a single, clear error state (“Server bootstrap failed — retry”).
  - include a “Copy debug info” action for logs payload returned from server (safe fields only).

### 4.2 Never store OpenRouter key client-side
- QuoteMe must **not** store any OpenRouter key in:
  - localStorage
  - sessionStorage
  - IndexedDB
  - URL params
  - DOM

### 4.3 CORS / origin
- v1 assumes same-origin (QuoteMe served by GT3 server).
- If dev uses different ports/origins, GTL3 must enable CORS with `credentials: true` and explicit origin allow-list.

---

## 5. GTL3 (Server) specification

### 5.1 Endpoint: `POST /bootstrap`

**Purpose**
- Establish or re-establish a browser installation identity.
- Ensure the installation has a server-stored OpenRouter key.

**Request**
- No body required (v1).
- Cookie: may include `quoteme_install`.

**Response (200)**
```json
{
  "ok": true,
  "install": {
    "present": true,
    "install_id_hint": "h_9f2c" 
  },
  "server_version": "v.poc.0xx"
}
```
Notes:
- `install_id_hint` is a short, non-sensitive prefix derived from the install token hash (for debugging only).
- No secrets in response.

**Response (4xx/5xx)**
```json
{
  "ok": false,
  "error": {
    "code": "BOOTSTRAP_FAILED",
    "message": "Unable to bootstrap installation",
    "detail": "optional safe detail"
  },
  "server_version": "v.poc.0xx"
}
```

**Idempotency rules**
- If `quoteme_install` cookie exists and mapping exists → do not create a new OpenRouter key.
- If cookie exists but mapping is missing/corrupt → treat as **new install** (create new token + key, overwrite cookie). Log `bootstrap_orphan_cookie`.

### 5.2 Cookie requirements
Cookie name: `quoteme_install`

Flags:
- `HttpOnly`: **true**
- `SameSite`: `Lax`
- `Secure`: **true in production** (HTTPS). In local dev, allow non-secure cookie if needed.
- `Max-Age`: long-lived (e.g., 5–10 years) or a large fixed duration

### 5.3 OpenRouter key provisioning
- GT3 server holds an **OpenRouter provisioning key** (server secret).
- On new install, server calls OpenRouter key creation endpoint and receives:
  - a key secret (and possibly key id / metadata)

Store with install mapping:
- `install_token_hash`
- `openrouter_key_secret`
- `openrouter_key_id` (if provided)
- `created_at`
- optional: `limit`, `limit_reset`, `expires_at` (recommended to set conservative defaults)

### 5.4 Endpoint: `POST /quoteme/infer` (server-side proxy)

**Purpose**
- Proxy LLM inference while keeping OpenRouter key server-only.

**Request (example)**
```json
{
  "model": "openai/gpt-4o-mini",
  "messages": [
    {"role":"system","content":"..."},
    {"role":"user","content":"..."}
  ],
  "temperature": 0.2
}
```

**Auth**
- Requires `quoteme_install` cookie.
- If missing/invalid → `401` with `AUTH_REQUIRED`.

**Server behavior**
1. Resolve install token → hash → lookup mapped OpenRouter key.
2. Call OpenRouter completions/chat endpoint with:
   - `Authorization: Bearer <openrouter_key_secret>`
   - Any required headers for OpenRouter (referer/title) as you already standardize for GT3.
3. Return LLM response to client (no key leakage).

**Response (200)**
Return model output plus safe metadata:
```json
{
  "ok": true,
  "output": {
    "text": "…"
  },
  "usage": {
    "prompt_tokens": 123,
    "completion_tokens": 456,
    "total_tokens": 579
  },
  "trace": {
    "install_id_hint": "h_9f2c",
    "latency_ms": 812
  }
}
```

### 5.5 Logging requirements (v1)
Log events must **never** include:
- install token raw value
- OpenRouter key secret
- full prompt content unless already part of your consent/track policy

Recommended event names:
- `bootstrap_new_install`
- `bootstrap_existing_install`
- `bootstrap_orphan_cookie`
- `quoteme_infer_ok`
- `quoteme_infer_error`

For upstream errors, include:
- `upstream_status`
- `upstream_body_preview` (truncate)
- `provider`, `model`, `latency_ms`
- `install_id_hint`

### 5.6 Basic per-install rate limiting (v1)
- Apply a simple in-memory limiter keyed by `install_token_hash` (or install hint).
- Example policy (tunable): `N requests / minute` + burst.
- On limit exceeded → `429 RATE_LIMITED`.

---

## 6. Data model (minimal)

A single table/collection/file (implementation up to GTL3):

`installations`
- `install_token_hash` (primary)
- `openrouter_key_secret` (encrypted at rest if easy; otherwise plain in v1 but never logged)
- `openrouter_key_id` (optional)
- `created_at`
- `last_seen_at`
- `limits` (optional object)

---

## 7. Local development notes

- If running on `http://localhost`, cookie `Secure` may block. Use:
  - `Secure=false` in dev, or
  - run HTTPS locally.
- If QuoteMe and GT3 run on different origins in dev:
  - enable CORS with explicit origin allowlist
  - `credentials: true`
  - ensure `SameSite=None; Secure` if truly cross-site (prefer same-origin to avoid this in v1)

---

## 8. Test checklist (definition of done)

### Front-end (GTL2)
- [ ] First visit triggers `/bootstrap` once and proceeds to successful inference.
- [ ] Delete localStorage → refresh → still works (cookie re-identifies install).
- [ ] No OpenRouter key appears in storage, network responses, or UI.

### Server (GTL3)
- [ ] New install sets cookie and creates OpenRouter key once.
- [ ] Existing install reuses same mapping and does not create a new key.
- [ ] Missing/invalid cookie returns `401` on `/quoteme/infer`.
- [ ] Upstream OpenRouter failure returns clear error and includes upstream status/preview in logs.
- [ ] Rate limiting returns `429` with stable error code.

---

## 9. Ownership split

**GTL2**
- `ensureBootstrap()` on app load and before inference
- UI error surface for bootstrap/infer failures
- Never store or display secrets

**GTL3**
- `/bootstrap` (cookie + install mapping + OpenRouter key provisioning)
- `/quoteme/infer` (proxy inference)
- persistence + logs + basic rate limiting

---

## 10. Versioning & rollout

- Server exposes `server_version` in responses.
- Feature flag optional: `QUOTE_ME_PROXY_MODE=true` (default on for v1).
- Roll out to dev tenant first, then production.

