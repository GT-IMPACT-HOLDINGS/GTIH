## Lexiom GT3 Demo Key Strategy (Temporary)

This document explains the **temporary** GT3 key strategy for the Lexiom
wireframe demo and how to deprecate it when moving toward an MVP.

---

### 1. Goal

For the **Lexiom wireframe demo**, we want:

- A working GT3 integration **without** requiring users to paste API
  keys into the Lexiom UI.
- Legacy apps (QuoteMe, Legato) to **remain unchanged** and continue
  using client-side keys.

We achieve this by:

- Sending a **Lexiom-specific tenant header** from the browser.
- Letting the **GT3 server** inject a **server-side demo key** when it
  sees that tenant, only if no client key is provided.

---

### 2. Lexiom Client Behavior (Browser)

File: `public/gt2/Lexiom/gt3-client.js`

- Lexiom’s GT3 client builds headers as:

```js
{
  "Content-Type": "application/json",
  "X-GT3-Tenant": "gt2-lexiom-demo",
  "X-GT3-Data-Track": "green",
  "X-GT3-Consent-Version": "v1",
  // Optionally:
  // "X-GT3-OpenRouter-Key": <clientKey>,
  // "X-GT3-OpenAI-Key": <clientKey>,
}
```

- For the **demo**, users are **not expected** to set a client key in
  Lexiom; the server-side fallback handles authentication.
- If a client key is present (e.g. for internal testing), it is still
  forwarded in the `X-GT3-OpenRouter-Key` / `X-GT3-OpenAI-Key` headers.

Legacy apps (QuoteMe, Legato) continue to:

- Use their own `gt3-client.js` (or equivalent).
- Send their original tenants (e.g. `gt2-quoteme-dev`) and **require**
  client-provided keys.

---

### 3. GT3 Server Behavior (Demo Fallback)

**Note:** The GT3 server code is not in this repo. The following is the
intended behavior for the GT3 service that the Lexiom demo calls.

Server-side pseudocode for the **demo fallback**:

```js
const tenant = (req.headers["x-gt3-tenant"] || "").toLowerCase();
let apiKey =
  req.headers["x-gt3-openai-key"] ||
  req.headers["x-gt3-openrouter-key"];

// Lexiom demo fallback:
// If no client key is provided and the request comes
// from the Lexiom demo tenant, use a server-side key.
if (!apiKey && tenant === "gt2-lexiom-demo") {
  apiKey = process.env.GT3_LEXIOM_DEMO_KEY;
}

if (!apiKey) {
  return res.status(401).json({ error: "Missing API key" });
}

// Use `apiKey` for the upstream LLM call...
```

Requirements:

- `GT3_LEXIOM_DEMO_KEY` is configured in the GT3 server environment.
- This behavior is **scoped only** to tenant `gt2-lexiom-demo`.
- All other tenants (including QuoteMe/Legato) must still supply a
  client-side key and behave as they do today.

---

### 4. Security and Scope

- This mechanism is intended for **single-tenant Lexiom demo** and
  internal testing, not for general multi-tenant production use.
- The server-side demo key is:
  - Stored only on the GT3 server.
  - Used only when:
    - Tenant is `gt2-lexiom-demo`, and
    - No client key is provided.

If additional demo tenants are added in the future, each should have its
own explicitly configured key and conditional logic.

---

### 5. Deprecation Plan (Transition to MVP)

When moving from **wireframe demo** to a full **MVP**, do the following:

1. **Introduce a proper key entry UI** in Lexiom
   - Add an “API Key” / “GT3 Token” field in a settings screen or
     dedicated GT3 configuration panel (similar to QuoteMe’s UX).
   - Wire it to `lexiom_gt3_api_key` (or a consolidated storage key) and
     forward it via `X-GT3-OpenRouter-Key` / `X-GT3-OpenAI-Key`.

2. **Require client-side key for Lexiom tenant**
   - On the GT3 server, remove or disable the `tenant === "gt2-lexiom-demo"`
     fallback branch.
   - Option 1: Continue using `gt2-lexiom-demo` but always require a
     client key.
   - Option 2: Move Lexiom to a new production tenant name (e.g.
     `gt3-lexiom-prod`) with stricter policies, leaving the demo tenant
     for internal testing only.

3. **Update documentation**
   - Update Lexiom specs and READMEs to state that:
     - Lexiom requires an explicit GT3 key in the UI.
     - The previous server-side fallback path was demo-only and has been
       removed or limited to non-production environments.

4. **Tighten server config**
   - Ensure that `GT3_LEXIOM_DEMO_KEY` is:
     - Removed from production environments, or
     - Scoped only to internal/demo deployments.

After these steps:

- Lexiom behaves like other GT3-integrated apps: users explicitly supply
  a key, and the server **never** silently injects one based solely on a
  tenant header.
- The temporary demo behavior is fully deprecated while preserving the
  provenance and security posture of the GT3 service.

