# ODD Advisor — product specification (v1.3)

---

## 1. Outcome (anchor)

Deliver a **publicly reachable single-page application** that offers a minimal **plain-text chat** against the GT3 inference API, plus a **watercolor visual** of each successful textual response. Each advisor turn sends the user’s message (with advisor system instructions). A follow-up inference uses the **textual response** as `narrative` and the graphics system prompt as `system` (see [ODD_Graphics_Outcome_Spec.md](ODD_Graphics_Outcome_Spec.md)).

Success means: developers can open one URL, type a prompt, receive **plain-text** advisory output aligned with the ODD manifesto (see [Outcome_Driven_Development_Advisor_System_Prompt.md](Outcome_Driven_Development_Advisor_System_Prompt.md)), and see a **128×128 colorful watercolor** image visualizing that output.

---

## 2. Scope and non-goals

**In scope**

- One HTML page + inline script (no build step).
- Single centered playfield (side panels removed).
- Load system prompt text from the co-located markdown file; use the body after the first `\n---\n` delimiter as the LM system string.
- `POST /inference` with JSON `{ "narrative": "<user>", "system": "<advisor>" }`.
- Display `response` as plain text (no markdown rendering, no streaming).
- Keyboard-first submission (Enter submits, Shift+Enter inserts newline).
- After a successful advisor response, a **second** `POST /inference` with `X-GT3-ODD-Graphics: 1`, `narrative` = advisor text, `system` = [ODD_Graphics_Image_System_Prompt.md](ODD_Graphics_Image_System_Prompt.md); parse PNG base64 when present and render in **inferred visual** at **128×128** (colorful watercolor intent).
- Textual output remains visible if graphics inference fails; visual may use a client watercolor fallback.

**Non-goals (v1)**

- Authentication, rate limiting, or per-user quotas (must be handled at deployment if the page is internet-public).
- Storing chat history server-side.
- Tool use, attachments, or rich formatting (beyond the visual image in the visual area).
- Separate image-generation APIs; graphics use the same `/inference` text/base64-PNG path.

---

## 3. Behavioral specification

| ID | Requirement |
|----|----------------|
| B1 | Page loads and fetches `Outcome_Driven_Development_Advisor_System_Prompt.md` from the same directory; if fetch fails, show a clear error and do not call `/inference`. |
| B2 | System text sent to the API is the file body after the first `\n---\n` (trimmed). If delimiter missing, use entire file trimmed. |
| B3 | Input is pre-filled by default with `e.g., in 50 words, who are you vs. who am I ?`; caret is placed at the end on load. |
| B4 | User submits with **Enter** (Shift+Enter adds a newline). Empty submit is rejected client-side with an inline error message in the output area. |
| B5 | While waiting for the server, input is disabled and a loading line (`inferring GT3…`) is shown to prevent duplicate submits. |
| B6 | On HTTP 200 with JSON `{ "response": string }`, show `response` in a read-only area labeled `inferred output`, preserving newlines (`white-space: pre-wrap`). |
| B7 | On error (network, non-JSON, 4xx/5xx), show `detail` or status text inline in the output area; do not claim success. |
| B8 | No client-side API keys. Requests include GT3 tenant/telemetry headers (`X-GT3-Tenant`, `X-GT3-Data-Track`, `X-GT3-Consent-Version`) so server-side key strategy can be applied per tenant in `server.js`. **The server must have either** a tenant-scoped demo key strategy (for browser-only access) **or** provider keys (`OPENROUTER_API_KEY` / `OPENAI_API_KEY`, matching `LLM_PROVIDER`); otherwise GT3 responds with a configuration error `detail`. |
| B9 | On load, fetch both advisor and graphics system prompt markdown files; if either fails, show a clear error and do not call `/inference`. |
| B10 | One Enter submit performs advisor inference then graphics inference sequentially; loading text shows `inferring GT3…` then `generating visual…`. |
| B11 | Advisor: `{ "narrative", "system" }` + `X-GT3-ODD-Direct: 1` → OpenRouter chat (**openai/gpt-4o-mini** default). Graphics: narrative = advisor response, `system` = graphics prompt, `X-GT3-ODD-Graphics: 1` → OpenRouter image model **`bytedance-seed/seedream-4.5`** (override via `GT3_OPENROUTER_IMAGE_MODEL`). |
| B12 | Graphics `response` is PNG base64 from Seedream (via `lib/gt3OpenRouterImage.js`). Display at **128×128** as `<img class="odd-visual-img">`. Client watercolor fallback if generation fails. |

---

## 4. API contract (GT3)

**Endpoint:** `POST /inference`  
**Headers:** `Content-Type: application/json`  
**Body:**

```json
{
  "narrative": "User message (required, non-empty when sent).",
  "system": "Optional. When non-empty, replaces the default LM system message for this request only."
}
```

**Success:** `200` — `{ "response": "<plain text>" }` (may be post-processed by server `extractAndStripInBand`).

**Errors:** `400` if `narrative` empty; `502` if upstream LM fails.

**Logging:** When `system` is present, inference debug logs record `Custom system prompt: yes (length N)` only (not full prompt text).

---

## 5. Test strategy (spec-derived)

| Test | Method |
|------|--------|
| T1 | With `LLM_PROVIDER=mock`, send a request with `system` set; mock response indicates custom system length (server behavior). |
| T2 | Open `/GT1/ODD/index.html`, confirm default input text is present and caret starts at the end; press Enter to submit; receive textual response and a 128×128 image in **inferred visual** (two `POST /inference` calls). |
| T3 | Press Shift+Enter in the input and verify a newline is inserted (no submit). |
| T4 | Temporarily break fetch URL; UI shows load error (B1). |

---

## 6. Responsibility mapping

| Activity | Accountability |
|----------|----------------|
| Publishing the page and `/inference` to the public internet | A human operator with explicit approval authority; cost and abuse exposure apply. |
| Day-to-day use of the advisor | The user drives prompts and judges outputs. |
| Operating GT3 (keys, provider, logs) | Operations monitors and intervenes via config and deployment. |

---

## 7. Risk assessment

- **Cost and abuse:** An open `/inference` with server-side keys allows unauthenticated use if the URL is known. Mitigate with network controls, auth, rate limits, or dedicated demo tenants configured in `server.js`.
- **Goodhart:** Passing smoke tests does not prove ODD alignment; reviewers should validate behavior against this spec and the advisor prompt.
- **In-band stripping:** Server may strip a trailing `_token` from responses; rare for advisory prose but possible if the model ends with such a token.

---

## 8. Release / Elastic Beanstalk

Source of truth is the repo `public/` tree. After changes, run [pack.ps1](../../../pack.ps1) from the project root to refresh `eb_bundle/` and produce a deployable zip (see script output).

---

## 9. References

- [Outcome_Driven_Development_Advisor_System_Prompt.md](Outcome_Driven_Development_Advisor_System_Prompt.md) — frozen advisor text (markdown + delimiter for SPA extraction). **v1.1:** non-negotiable expression rule—advisor must not use the term “AI”; use LM-based / LM-centered technical wording instead.
- [ODD_Graphics_Outcome_Spec.md](ODD_Graphics_Outcome_Spec.md) — graphics customer outcome.
- [ODD_Graphics_Image_System_Prompt.md](ODD_Graphics_Image_System_Prompt.md) — watercolor graphics LM instructions.
