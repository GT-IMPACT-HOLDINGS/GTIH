# GT3 Ops Console — Agent Traffic Observability (v1.0)

**Status:** Spec — bringup (browser WebContainer CA + broker), `/v1` broker + Ops AGENT lane, builder `/run` (`bolt_webcontainer` + `ca_location: browser_session`), evidence auto-chain (Option E), and Bud / `bud_written` (Step 5 Phase B) are implemented  
**Audience:** GT3 server authors, ops operators, Lexiom 1.3 agent-runtime integrators  
**Applies to:** GT3 LM Ops Console (`public/gt3/gt3.html`) and the server surfaces it already polls (`GET /ops/summary`, `GET /inferences`, ledger/logs)  
**Companions:**
- [public/gt2/Lexiom_1_3/BuildPlugins/Lexiom_1_3_Virtualized_Agent_Loop_1_0.md](../public/gt2/Lexiom_1_3/BuildPlugins/Lexiom_1_3_Virtualized_Agent_Loop_1_0.md) (sole agent executor; GT3 ↔ OpenRouter ↔ Claude; shared triptych §0)
- [public/gt2/Lexiom_1_3/BuildPlugins/Lexiom_1_3_CA_Worker_Protocol_1_0.md](../public/gt2/Lexiom_1_3/BuildPlugins/Lexiom_1_3_CA_Worker_Protocol_1_0.md) (Job ticket; only `browser_session` + `bolt_webcontainer` supported now)
- [public/gt2/Lexiom_1_3/Lexiom_1_3_Center_Playfield_Build_Artifact_Review_UX_Spec_1_0.md](../public/gt2/Lexiom_1_3/Lexiom_1_3_Center_Playfield_Build_Artifact_Review_UX_Spec_1_0.md) (post-run `bud` bloom — Ops reports whether it was written)
- [GT3_Inference_In_Band_Context_Spec_1_0.md](../GT3_Inference_In_Band_Context_Spec_1_0.md) (product `/inference` path — separate lane)
- [GT3_Expression_specs/README.md](README.md) (expression-profile ops already on Dashboard)
- Repo root [README.md](../README.md) (Quick Start / EB / `OPENROUTER_API_KEY` / `GT3_LEXIOM_AGENT_KEY`)

---

## 1. Purpose

The GT3 LM Ops Console must make **agentic broker traffic** first-class and distinguishable from product narrative inference, so operators can see that Lexiom 1.3 `/run` model calls:

1. enter GT3 on the OpenAI-compatible agent path (e.g. `POST /v1/chat/completions`),
2. leave GT3 only toward **OpenRouter**,
3. return Claude → OpenRouter → GT3 → Aider,

with enough audit metadata to diagnose bringup failures, upstream errors, per-build pass activity, and whether a player-facing **`bud`** was written — without implying a direct Anthropic peer.

This spec defines **what** the console must show and **which** server contracts feed it. It does not redesign the Lexiom cabinet; Bud glyph / Center iframe UX lives in the Bud companion.

**Shared acceptance narrative (with VAL + Bud):** bringup healthy in Ops → broker visible in Ops → `/run` builds SUD → evidences in Right Panel → `bud` on requesting OSN → player opens Bud in Center.

---

## 2. Traffic lanes (non-negotiable separation)

| Lane | Entry | Upstream | Console treatment |
|---|---|---|---|
| **Product inference** | `POST /inference` | OpenRouter / OpenAI / Ollama / mock per `/ops/config` | Existing Dashboard traffic + Logs event stream |
| **Agent broker** | OpenAI-compat agent path (VAL; e.g. `POST /v1/chat/completions`) | **OpenRouter only** → Claude | New agent traffic surfaces in this spec |
| **Non-LM** | `/lexiom13/build/prepare`, static builds, evidence file poll | none | May appear as build/run status cards; not counted as LM inferences |

**Integrity display rule:** agent rows and summaries must label the upstream hop as **OpenRouter** (and the fulfillment model as Claude / configured OpenRouter model id). They must **never** present Anthropic as a direct GT3 peer or omit OpenRouter from the path.

Product `/inference` counters and agent-broker counters must remain **separately countable**. Mixing them into a single undifferentiated “Inferences” total without a breakdown is forbidden once agent traffic exists.

---

## 3. Operator jobs (console outcomes)

An operator opening `gt3.html` must be able to answer, without reading server source:

1. Is agent-runtime bringup healthy? (`executor: bolt_webcontainer`, `ca_location: browser_session`, broker key; WebContainer is browser-side)
2. How many agent broker calls succeeded/failed since process start (and last 5m)?
3. Which Lexiom build `run_id` and pass (`builder` | `evidence`) generated recent agent calls?
4. What OpenRouter model id and latency/status did the last failures see?
5. Where is the durable log for a selected agent event?
6. Did the latest successful run write a **`bud`** on the requesting compilation-root OSN?
7. Which exact redacted system/user messages crossed GT3, and does expected OSN vocabulary (for example a naming specification) appear there?
8. What assistant content, finish reason, usage, and raw response packet returned through GT3?

---

## 4. Dashboard (`tab-dashboard`) — required cards

Extend the existing Dashboard (already fed by `GET /ops/summary`) without removing product Model runtime / expression controls.

### 4.1 Agent runtime bringup card

| Field | Source | Notes |
|---|---|---|
| `bringup_status` | `ok` \| `failed` \| `unknown` | Product gate: broker + CA executor readiness (not Docker) |
| `ca_location` | Constant `browser_session` | Sole supported CA location |
| `executor` | Constant `bolt_webcontainer` | Sole supported executor |
| `detail` | human reason when failed | Same spirit as Lexiom `/run` failure `detail` |
| `docker` / `image` | optional Follow-up | Legacy Aider capacity only — not the product gate |

Failed bringup must be visible even when product inference is healthy. Do not crash the console if the file is missing — show `unknown` + short note.

### 4.2 Agent broker traffic card

Alongside existing “Traffic (since server start)” which today shows product `inference` + `training_example`, add an **Agent broker** block (same card or sibling card):

| Metric | Meaning |
|---|---|
| `agent_broker_total` | Completed broker requests since process start (success + failure) |
| `agent_broker_ok` / `agent_broker_error` | Split of outcomes |
| `agent_broker_last_5m` | Same shape for last 5 minutes |
| `openrouter_model_id` | Model id GT3 actually sent to OpenRouter for agent lane (may differ from product Dashboard model) |
| `last_agent_error_detail` | Optional truncated last failure reason |

**Known divergence (today):** none for bringup/broker Dashboard once Docker bringup is deployed; `bud_written` is implemented on `recent_agent_runs[]` after successful VAL + bud persist.

### 4.3 Config boundary

`POST /ops/config` continues to govern **product** provider / inference mode / expression profile. Agent-lane Claude-via-OpenRouter model may be env-driven (`GT3_AGENT_OPENROUTER_MODEL` or equivalent) and shown read-only on Dashboard unless a later revision explicitly adds editable agent-model controls. Do not silently retarget agent traffic when the operator changes product `llm_provider` to `ollama` / `mock`.

---

## 5. Logs & Telemetry (`tab-logs`) — event stream

### 5.1 Unified stream, typed rows

Keep a single chronological event list (existing Logs tab), but each row must carry a **lane** discriminator:

| `lane` | When |
|---|---|
| `product_inference` | Existing ledger events (`inference_single`, `inference_variant`, …) |
| `agent_broker` | New ledger events for each GT3↔OpenRouter agent hop |

UI: show a lane pill (e.g. `PRODUCT` / `AGENT`) next to the existing track pill. Default filter = all lanes; optional filter chips: Product | Agent | All.

### 5.2 Required fields on `agent_broker` rows

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | Stable event id |
| `ts_iso` | yes | Event time |
| `lane` | yes | `agent_broker` |
| `event` | yes | e.g. `agent_broker_request` / `agent_broker_complete` / `agent_broker_error` |
| `ok` | yes on complete/error | Outcome |
| `run_id` | yes when known | Lexiom build run id |
| `pass` | yes when known | `builder` \| `evidence` |
| `plugin_id` | recommended | From handoff |
| `upstream` | yes | Constant display value `openrouter` |
| `model` | yes when known | OpenRouter model id used |
| `latency_ms` | recommended | Broker wall time |
| `upstream_status` | on error | HTTP status from OpenRouter when available |
| `detail` | on error | Human-readable reason (no secrets) |
| `log_url` | recommended | Link to redacted debug artifact under `/logs/…` |
| `destination` / `transport` / `destination_locality` | yes | Provider-neutral route descriptor; OpenRouter/remote now |
| `request_message_count` / `request_chars` / `response_chars` | recommended | Packet-size diagnostics without opening the exchange |
| `prompt_tokens` / `completion_tokens` / `cached_tokens` | recommended when upstream reports usage | Token and cache-read diagnostics for context-economy tuning |
| `build_phase` / `prompt_cache_enabled` / `cache_sticky_key` | recommended for document builds | Phase and optional cache-capability metadata |
| `exchange_url` | yes | `GET /ops/agent-exchanges/:exchangeId` |

### 5.3 Packet inspector (implemented)

Clicking an AGENT row selects its durable **LM exchange** and opens an in-console packet inspector. The operator sees:

1. route: `CA executor @ ca_location → GT3 control plane → destination + locality`;
2. run/pass/plugin/model/transport/status/latency/message-count metadata;
3. every redacted OpenAI-format request message in role order plus the raw redacted outbound packet;
4. returned assistant content plus finish reason, usage, and raw redacted response packet (or SSE stream/error body);
5. search-with-match-count across both planes and copy-request / copy-response controls.

The request plane is the packet **after GT3’s model rewrite and control-metadata removal**: it is what the destination LM actually receives. A request event is appended before the upstream wait, so an in-flight crossing is observable; complete/error events update the same `exchange_id`.

Capture is full up to the configured safety ceiling (`GT3_AGENT_OBSERVABILITY_MAX_CHARS`, default 2,000,000 characters per text surface). Truncation is explicit in the exchange metadata. Credential-shaped keys/values are redacted **before disk persistence**.

### 5.4 Provider-agnostic exchange envelope

Durable files use schema `gt3-lm-exchange/1`. `route.destination` carries:

`id`, `label`, `transport`, `locality`, and `endpoint_kind`.

Current values describe OpenRouter (`remote`, `openai_compatible_http`). The inspector renders these fields rather than hard-coding “OpenRouter”; a future localhost LM therefore reuses the same packet plane without changing the Ops UX or ledger grammar. **This is an observability seam, not current authorization to retarget VAL away from OpenRouter.**

### 5.5 What must not appear

- OpenRouter API keys or Anthropic keys in list rows or tooltips
- A label that implies GT3 called Anthropic directly
- Fake “success” rows when `/run` failed before any broker call (those belong under build/run status, §6)

---

## 6. Build / run status (Dashboard or Logs companion)

Agent LM traffic is necessary but not sufficient to understand Lexiom builds. The console must also surface recent `/lexiom13/build/run` outcomes (even when zero broker calls occurred — e.g. bringup missing):

| Field | Meaning |
|---|---|
| `run_id` | Build directory id |
| `compilation_root_osn_id` | Requesting OSN (bud target when success) |
| `status` | `completed` \| `agent_failed` \| `agent_unavailable` \| … (from `RUN_RESULT.json`) |
| `executor` | Intended: `bolt_webcontainer` |
| `ca_location` | Intended: `browser_session` |
| `reason` / `detail` | Failure text mirrored to Lexiom Build card |
| `builder_pass` / `evidence_pass` | Optional nested status |
| `bud_written` | `true` when Lexiom/GT3 persisted `bud` on the requesting OSN after success; else `false` |
| `bud_preview_path` | Optional echo of `bud.preview_path` / artifact pointer when written |

**Assumption:** expose via `GET /ops/summary` `recent_agent_runs[]` and/or `GET /ops/agent-runs` (new). Exact endpoint name is an implementation detail; the console contract is the field set above.

Ops does **not** render the SUD iframe — that is Lexiom Center Bud mode.

---

## 7. Server contracts (feeds for `gt3.html`)

### 7.1 Extend `GET /ops/summary`

Add (names normative for the console):

```json
{
  "agent_runtime": {
    "bringup_status": "ok",
    "detail": null,
    "ca_location": "browser_session",
    "executor": "bolt_webcontainer"
  },
  "agent_broker": {
    "openrouter_model_id": "anthropic/claude-…",
    "agent_model_id": "anthropic/claude-…",
    "destination": {
      "id": "openrouter",
      "label": "OpenRouter",
      "transport": "openai_compatible_http",
      "locality": "remote",
      "endpoint_kind": "chat_completions"
    },
    "observability": {
      "schema_version": "gt3-lm-exchange/1",
      "packet_capture": "redacted_full",
      "max_chars_per_text_surface": 2000000
    },
    "traffic_total": { "ok": 0, "error": 0 },
    "traffic_last_5m": { "ok": 0, "error": 0 },
    "last_error_detail": null
  },
  "recent_agent_runs": []
}
```

Preserve existing product fields (`llm_provider`, `traffic_total.inference`, expression skills, …).

### 7.2 Extend `GET /inferences` (or sibling list)

Either:

- include `agent_broker_*` ledger events in `/inferences` with `lane: "agent_broker"`, or
- add `GET /ops/agent-events` and have the Logs tab merge both sources client-side.

**Committed default:** extend `/inferences` (or rename conceptually to “LM events”) so Live polling stays one fetch; filter by `lane` in the UI.

### 7.3 Ledger

Each agent broker attempt appends a JSONL ledger record with the §5.2 fields (plus redaction rules). Product inference event names remain unchanged.

### 7.4 Boot log

On `npm start`, server already should log agent bringup status (VAL §3). The console reads the structured form via `/ops/summary`, not by scraping stdout.

### 7.5 LM exchange detail

`GET /ops/agent-exchanges/:exchangeId` returns one redacted `gt3-lm-exchange/1` envelope from the durable agent-broker log. Invalid ids return 400; absent exchanges return 404; responses are `Cache-Control: no-store`.

---

## 8. Live polling behavior

Reuse existing Dashboard Live toggle + Refresh:

- When Live is ON, poll `/ops/summary` and the LM-events endpoint on the same cadence as today.
- Agent cards and Logs update without full page reload.
- Pausing Live must not drop historical ledger rows on next Refresh.

---

## 9. Privacy, safety, and redaction

- Never render raw `OPENROUTER_API_KEY` / `X-GT3-OpenRouter-Key` values.
- Prefer status, model id, run_id, pass, latency, and short `detail` in the UI.
- LM exchange files may hold full prompt/response content up to the configured ceiling; redact credentials before persistence and mark truncation explicitly.
- Do not auto-fetch build directory file trees into the console beyond status metadata and linked logs.
- Do not store request headers. The inspector is for LM semantic packets, not bearer credentials or browser cookies.

**Production gate:** the current POC serves the Ops console, `/inferences`, and exchange detail under the GT3 server’s existing network boundary; it does not add a new application-level admin login. Production deployment must protect these surfaces with the chosen admin authentication/reverse-proxy policy before enabling operators beyond a trusted network.

---

## 10. Known divergence (implementation)

| Surface | Status |
|---|---|
| Dashboard bringup card | Implemented (Step 2) |
| Dashboard agent broker traffic | Implemented (Step 3) — `/ops/summary.agent_broker` |
| Logs `/inferences` AGENT lane | Implemented (Step 3) — `lane: agent_broker` |
| VAL `POST /v1/chat/completions` | Implemented (Step 3) — OpenRouter only; default model `anthropic/claude-haiku-4.5` via `GT3_AGENT_OPENROUTER_MODEL`; auth `X-GT3-OpenRouter-Key` → `GT3_LEXIOM_AGENT_KEY` → `OPENROUTER_API_KEY` |
| Streaming | Non-stream review path + SSE passthrough when `stream: true` |
| Builder `/run` | Implemented — CA `browser_session` + `bolt_webcontainer`; async `running`; SPA WebContainer worker; poll `GET /lexiom13/build/status/:runId` |
| Recent agent runs / `bud_written` | `recent_agent_runs` exposed; `bud_written` set after successful bud persist |
| Redacted full LM exchange capture | Implemented — `gt3-lm-exchange/1`, request event before upstream wait, JSON/SSE/error response capture |
| Logs packet inspector | Implemented — inline route/meta/request/response/search/copy |
| Localhost LM destination | Follow-up — destination grammar is implemented; VAL routing remains OpenRouter-only |

---

## 11. Out of scope

- Editing Docker/Aider image install from the console UI
- Replacing Lexiom Build card UX (console mirrors status; Lexiom remains the player surface)
- WebSocket push (polling remains acceptable)
- Full prompt replay / chat transcript UI inside `gt3.html`
- Changing Evidence Cockpit Sync or product expression-skill flows

---

## 12. Acceptance

1. With Live ON, an agent broker call that reaches OpenRouter appears as an `AGENT` lane row within one poll interval, showing `run_id`, `pass`, `upstream: openrouter`, model id, and ok/error.
2. Product inference rows remain labeled `PRODUCT` and remain separately counted on Dashboard.
3. Bringup failure shows on Dashboard even when product `/inference` still works (**review gate for VAL Step 2**).
4. A synthetic or real broker call is visible in Ops without requiring Lexiom UI (**review gate for VAL Step 3**).
5. `/run` failure with zero broker calls still shows run `detail` on Dashboard/recent runs; `bud_written` is false.
6. Successful end-to-end run shows `bud_written: true` and `compilation_root_osn_id` on the recent-run row (**review gate alongside VAL Step 5 / Bud**).
7. No console surface claims a direct Anthropic connection for agent traffic.
8. No API keys appear in rendered HTML or event JSON returned to the browser.

---

## 13. Implementation notes (non-normative)

Suggested touch points (aligned with reviewable VAL plan):

- **Step 2:** expose `agent_runtime` on `/ops/summary`; Dashboard bringup card in [`public/gt3/gt3.html`](../public/gt3/gt3.html)
- **Step 3:** agent proxy handler writes ledger + `recordOpsEvent('agent_broker', …)`; agent traffic card + Logs lane pills
- **Steps 4–5:** `recent_agent_runs[]` including `bud_written` after Bud persist
- Keep product `/ops/config` behavior intact