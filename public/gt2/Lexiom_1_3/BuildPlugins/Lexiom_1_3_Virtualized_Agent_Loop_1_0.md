# Lexiom 1.3 — Virtualized Agent Loop (v1.0)

**Status:** Spec (Real Bolt product path implemented) — prepare + builder `/run` via **CA `browser_session` + `bolt_webcontainer`** (append-only OpenAI-compatible tool loop in the player WebContainer, GT3 ↔ OpenRouter ↔ Claude); canonical builder `completed` still requires post-`finish` host validation. **Evidence auto-chain (Phase A / Option E)** is implemented: after successful builder validation, the **host** runs quote-span evidence collection (compact target metadata + SUD → LM spans → host slices into `./evidences/` + `EVIDENCE_MANIFEST.json`). No browser CA evidence Job and no host-heuristic fallback. **Bud + Center Bud + Ops `bud_written` (Phase B / Step 5)** are implemented: on overall success Lexiom/GT3 writes top-level `bud` on the requesting OSN; the Center strip shows a Bud glyph; Ops recent runs expose `bud_written`.  
**Audience:** GT3 server authors, Lexiom 1.3 build-plugin integrators, ops deploying to local or Elastic Beanstalk hosts  
**Applies to:** Lexiom 1.3.x build execution under `builds/lexiom13/<runId>/`, GT3 agent-broker traffic, post-run `bud` bloom, and Ops Console observability  
**Companions:**
- [Lexiom_1_3_CA_Worker_Protocol_1_0.md](Lexiom_1_3_CA_Worker_Protocol_1_0.md) (Job ticket + Worker; **only `browser_session` + `bolt_webcontainer` in the normative product delivery**)
- [Lexiom_1_3_Build_Plugin_Contract_1_0.md](Lexiom_1_3_Build_Plugin_Contract_1_0.md) (prepare, prompts, evidence hemisphere)
- [Lexiom_1_3_Evidence_Cockpit_Sync_1_0.md](Lexiom_1_3_Evidence_Cockpit_Sync_1_0.md) (Right Panel poll after collection)
- [../Lexiom_1_3_Center_Playfield_Build_Artifact_Review_UX_Spec_1_0.md](../Lexiom_1_3_Center_Playfield_Build_Artifact_Review_UX_Spec_1_0.md) (**Bud** — post-run OSN key + Center SUD review)
- [../../../../GT3_Expression_specs/GT3_Ops_Console_Agent_Traffic_Spec_1_0.md](../../../../GT3_Expression_specs/GT3_Ops_Console_Agent_Traffic_Spec_1_0.md) (GT3 LM Ops Console reflection of agent broker traffic)
- [../Lexiom_1.3.3_System_Description.md](../Lexiom_1.3.3_System_Description.md) §9 / §11
- Repo root [README.md](../../../../README.md) (server bringup / EB deploy)

---

## 0. Triptych (shared end-to-end story)

These three specs are one delivery slice:

| Spec | Owns |
|---|---|
| **This document (VAL)** | Bringup, CA Job dispatch, Real Bolt WebContainer execution, GT3 ↔ OpenRouter ↔ Claude broker, evidence auto-chain boundary, failure contract |
| **Ops Console Agent Traffic** | How `gt3.html` shows bringup health, agent-broker ledger rows, and recent run outcomes (including whether `bud` was written) |
| **Center Playfield Bud Review** | Writing `bud` on the requesting OSN after success; Bud glyph; Center iframe/document SUD |

**Shared acceptance narrative:** bringup healthy → broker visible in Ops → `/run` builds SUD → evidences in Right Panel → `bud` on requesting OSN → player opens Bud in Center.

---

## 1. Purpose

This specification defines the **runtime boundaries** and **transactional relationships** between the Containerized Agent (Real Bolt tool loop in WebContainers), the GT3 control plane, and OpenRouter, with Claude as the preferred language model under development.

It closes the gap between a prepared build directory (OSNG snapshot + `AGENT_PROMPT.md` + `EVIDENCE_AGENT_PROMPT.md`) and **autonomous execution** of those prompts so primary deliverables and collected evidence land under `builds/lexiom13/<runId>/`, after which Lexiom records a **`bud`** bloom for Center review.

```text
[ Lexiom player browser_session ]
   WebContainer sandbox + Real Bolt tool loop + OPFS mirror
         |
         v  Job ticket / heartbeat / syncOut
[ GT3 Control Plane ]  <-->  OpenAI-compat /v1/agent/...
         |
         v
[ OpenRouter Gateway ]  <-->  [ Claude Model ]
```

**Two planes:** (1) **CA** — where the agent runs (`ca_location` + `executor`); (2) **SUD** — where the player later runs the generated software (WebContainer preview / Center Bud). They must not be collapsed into one location knob.

Happy path requires **no Docker Desktop** on the player machine. Player laptop compute runs the WebContainer sandbox.

---

## 2. Core component relationships

### 2.1 Location-agnostic CA — `browser_session` + `bolt_webcontainer` (now)

GT3 dispatches a **CA Job** through a lean Worker interface ([CA Worker Protocol](Lexiom_1_3_CA_Worker_Protocol_1_0.md)). Location enums `host` and `remote`, and executor `aider_docker`, are **Follow-up** expansion options; they are not product-supported in this revision.

**Normative product location:** `ca_location: browser_session`.  
**Normative product executor:** `executor: bolt_webcontainer` (`runtime: webcontainer`).

- The Lexiom **player** owns the session-visible worktree (OPFS) and the **WebContainer** sandbox.
- A headless **Real Bolt** loop runs inside that sandbox: OpenAI-compatible assistant tool calls and matching tool results accumulate in an append-only message history **within each bounded phase** (document builds) or for the whole Job (software builds).
- Canonical artifacts remain under `builds/lexiom13/<runId>/` on GT3 after **syncOut** + server validation (Ops / Bud truth).
- Document builds prepare deterministic **per-node JSON / source packs**. Each `nodes/nXX.json` preserves full parsed OSN semantics and source-YAML provenance while exposing a compact phase context. VAL opens only node keys assigned to the phase; source maps carry markdown section offsets, and fill packets include only referenced sections. Uniform node compaction plus deterministic excerpt/detail fitting keeps each packet within its crossing ceiling.

**Isolation trade (normative):** the WebContainer write scope is the prepared build project. The agent must not mutate live `public/gt2/Lexiom_1_3/` OSN YAML.

**Plugin modes:** same Worker; `plugin_id` selects document vs software gates (outline/cleanliness vs HTML primary + optional npm/preview).

There is no alternate executor fallback and no product Docker requirement for `/run`. `aider_docker` remains a named Follow-up only.

#### 2.1.1 Real Bolt loop (normative delivery)

Each model turn within a phase receives the complete accumulated OpenAI-compatible `messages` history for that phase and only the tools authorized by the selected plugin. The worker appends the assistant response, executes authorized tool calls, appends one matching `role: tool` result per call, and continues without rewriting prior turns **inside the phase**. Document composition starts a fresh conversation per outline/fill/reconcile phase; host assembly writes `document.md` from ordered `sections/**`.

The canonical tools are:

- `list_files`
- `read_file`
- `write_file`
- `run_command` — software plugin only
- `finish`

Document composition is packet-driven: the host resolves prepared nodes, plans, outlines, and source excerpts before each crossing, while the LM receives only `write_file`. A successful required non-empty write is an atomic phase submission: host finalization completes the phase without a second LM crossing merely to call `finish`. Software capability exposes bounded `list_files`, `read_file`, `write_file`, `run_command`, and explicit `finish`. The worker rejects calls outside the phase capability set, malformed arguments, workspace escape, and writes to immutable surfaces. `osng/**`, document `nodes/**`, `sources/**`, and prepared/control files (`OSNG_Basics_README.md`, `HANDOFF.json`, both agent prompts, `EVIDENCE_PLAN.json`, `RUN_RESULT.json`, and document `BUILD_PLAN.json` / `SOURCE_MAP.json` / `BUILD_MANIFEST.json`) are read-only.

Every run has hard worker-enforced step/action, no-progress, per-result, listing/read, command, wall-clock, and (for document builds) cumulative prompt-token / LM-crossing limits defined by the CA Worker Protocol and `BUILD_PLAN.json` token budgets. Crossing admission estimates the serialized messages together with the offered tool schemas. Tool results report truncation. Exhaustion is terminal, not an invitation to continue without accounting. Optional OpenRouter/Claude prompt caching (`GT3_AGENT_PROMPT_CACHE`) is a provider capability only.

`finish` requests validation; it does not declare success by itself. Only syncOut followed by plugin-specific primary-artifact validation may produce `completed`. Model stop without `finish`, tool/protocol failure, cancellation, timeout, unavailability, and failed validation resolve explicitly per the [CA Worker Protocol](Lexiom_1_3_CA_Worker_Protocol_1_0.md), never as implicit success.

### 2.2 Agent to GT3 (API interface)

When the Real Bolt loop sends its accumulated context and tool definitions in a model request, it **must not** call OpenRouter or Anthropic directly. It uses the Job ticket `broker_path` resolved against the Lexiom page origin (e.g. `POST /v1/agent/<runId>/<pass>/chat/completions`).

Constraints:

- OpenAI-compat base → GT3 only (never OpenRouter/Anthropic base URLs in the browser)
- Model id as seen by the agent is an OpenAI-compat alias that GT3 maps to Claude-via-OpenRouter
- Agent receives only a **dummy** broker token; real OpenRouter credentials stay server-side (`GT3_LEXIOM_AGENT_KEY` / `OPENROUTER_API_KEY`)

### 2.3 GT3 to OpenRouter (brokering link)

GT3 audits the payload stream, injects tracking metrics (at least `run_id`, build path, pass = `builder` | `evidence`), and proxies token traffic to the OpenRouter API using server-held authorization. Product `POST /inference` remains a separate narrative path and is **not** reused for agent traffic.

Every broker hop must be observable in the LM Ops Console per [GT3_Ops_Console_Agent_Traffic_Spec_1_0.md](../../../../GT3_Expression_specs/GT3_Ops_Console_Agent_Traffic_Spec_1_0.md).

### 2.4 OpenRouter to Claude (model fulfillment)

OpenRouter brokers the request to Claude. Completions return **only** along Claude → OpenRouter → GT3 → agent. GT3 never opens a direct Anthropic peer connection for this loop.

**Integrity rule:** every model request and every model response traverses **GT3 ↔ OpenRouter ↔ Claude**. Claude never talks to GT3 or the agent directly; the agent never talks to OpenRouter or Anthropic directly.

---

## 3. Bringup (WebContainer + broker are not silent assumptions)

Browser WebContainer capacity and the agent broker key are **verified for Ops visibility**, not assumed healthy without status.

Normative bringup sequence:

1. **Browser:** Lexiom SPA served with **COOP/COEP** headers so WebContainers can use SharedArrayBuffer.
2. **`npm start`:** `node server.js` loads repo-root `.env` via `dotenv` (if present), then serves the product UI; broker readiness via `/ops/summary.agent_broker`.
3. **Ops Dashboard:** Agent runtime card shows `ca_location: browser_session`, `executor: bolt_webcontainer`, and broker key status. `aider_docker` image status may appear as **Follow-up capacity** only — not as the product bringup gate for `/run`.
4. **`/run` gate:** If neither `GT3_LEXIOM_AGENT_KEY` / `OPENROUTER_API_KEY` nor request header `X-GT3-OpenRouter-Key` is present, `/lexiom13/build/run` returns **503** immediately (no CA spin-up). The SPA may forward a cockpit-stored OpenRouter key (`lexiom_gt3_api_key` / `?or_key=`) as that header on `/run` and on same-origin broker hops; `broker_token` remains a dummy and never carries OpenRouter credentials into the WebContainer sandbox.

Elastic Beanstalk / local: `OPENROUTER_API_KEY` / `GT3_LEXIOM_AGENT_KEY` required for the agent broker. Docker Engine is **not** required for the happy path.

**Production note:** StackBlitz WebContainer API requires a commercial license for for-profit production use; POC/prototype use may be exempt — track as an ops gate in root README.

Runtime resolution: `/run` issues a Job ticket and returns `ca_session` for the SPA worker. GT3 does **not** shell `docker run` for the product executor.

---

## 4. Mapping onto prepare outputs and post-run bloom

Prepare (Build Plugin Contract §3) remains the packaging authority. The Virtualized Agent Loop consumes:

| Path under `builds/lexiom13/<runId>/` | Role |
|---|---|
| `osng/**` | Software-build frozen OSN closure (read-only for agents) |
| `nodes/**` | Document-only normalized OSN closure (read-only; one bounded JSON file per node) |
| `OSNG_Basics_README.md` | Primer |
| `HANDOFF.json` | Lexiom audit index |
| `AGENT_PROMPT.md` | Builder pass protocol (authority for the agent loop) |
| `EVIDENCE_PLAN.json` | Pointer-only evidence index |
| `EVIDENCE_AGENT_PROMPT.md` | Evidence collector pass protocol |

Order:

1. **Builder pass** (Step 4): player White Move → `/run` → `browser_session` Job → SPA WebContainer + append-only Real Bolt loop on `AGENT_PROMPT.md` → `finish` → syncOut + validation of primaries on GT3.
2. **Evidence pass** (Phase A / Option E): on successful builder validation, GT3 host collects evidences **without** a second WebContainer tool loop — compact `EVIDENCE_PLAN` metadata + SUD text → one (or section-batched) LM call returning quote spans → host slices the SUD into `./evidences/` and writes `EVIDENCE_MANIFEST.json` (`collection_mode: quote_spans`). Non-span kinds (`SCREEN-SHOT`, `VIDEO-CLIP`, derivatives) are recorded `deferred` with human-capture notes. Invalid/missing spans fail the evidence pass (no heuristic fill). Empty plans skip evidence.
3. **Cockpit Right Panel** polls collected artifacts per Evidence Cockpit Sync.
4. **Bud write** (Lexiom/GT3, not the agent): when SUD + evidence collection are readable, write top-level `bud` on the **requesting** compilation-root OSN per [Center Playfield Bud Review](../Lexiom_1_3_Center_Playfield_Build_Artifact_Review_UX_Spec_1_0.md).

Agents must not mutate prepared `./osng/` or `./nodes/` intent, nor live `public/gt2/Lexiom_1_3/`. The `bud` field is written only by Lexiom/GT3 after success.

### 4.1 Build lifecycle signal (implemented)

The requesting OSN owns a browser-side lifecycle record keyed by OSN id and, once issued, `run_id`:

`idle → preparing → prepared → running → completed`, with `failed` as the terminal failure branch.

- The **first click** sets `preparing` before `/prepare`; successful preparation stops at stable **`prepared`** and creates the standalone build directory without issuing a CA Job.
- Prepared is an inspectable stability point: the Build card exposes `run_id`, output directory, subgraph/walk, and the instruction pack. The glyph changes to stable amber with a launch mark.
- The **second click** is a distinct White Move. It sends the prepared `run_id` to `/run`, changes the lifecycle to `running`, activates the `browser_session` CA, and triggers VAL.
- `/run` and canonical `/status` responses set **`running`**, **`completed`**, or **`failed`**; the UI does not infer completion from elapsed time.
- Preparing is an amber pulse; prepared is stable amber; running is a continuous cyan halo with an indeterminate progress rail; completion is a stable bloom/check; failure is a stable red/error signal.
- While preparing/running, repeat invocation for that OSN is disabled and the glyph exposes `aria-busy="true"`. Prepared remains enabled because its next click is the explicit VAL authorization.
- The Center Build card announces phase/detail through an `aria-live="polite"` status surface and shows elapsed time without inventing a percentage.
- Lifecycle rows persist in browser local storage. A persisted prepared row may launch `/run` from its `run_id` after reload; active rows reconnect to canonical `/status`. Neither path moves Focus.
- Completion does **not** auto-open Bud or steal Center Focus. Stability remains player-inspected.

---

## 5. Failure contract (no alternate executors)

There is no alternate executor fallback, no product `host`/`remote` switch, and no product `aider_docker` path in this revision.

When WebContainers cannot boot, the broker key/proxy fails, the agent loop fails, syncOut validation fails (missing/dirty primary), or a pass times out:

- Do **not** write fake primary stubs.
- Do **not** write `bud`.
- Write `RUN_RESULT.json` with an explicit terminal status (`agent_failed` or `agent_unavailable`; cancellation/expiry remain explicit `reason` values and lease states), `executor: bolt_webcontainer`, `ca_location: browser_session`, plus `reason` and `detail`.
- Emit structured logs / ledger events visible to the GT3 Ops Console.
- Return failure fields so the Lexiom Build card can show the same `detail`.
- Leave prepare artifacts on disk for diagnosis.

Prepare may still succeed and leave a frozen project even when `/run` fails.

---

## 6. Port, auth, and audit

| Item | Rule |
|---|---|
| GT3 product base | Default `http://localhost:8080`; on EB, the application origin |
| From browser CA | Same origin `/v1/agent/<runId>/<pass>` (Job `broker_path`) |
| Agent API shape | OpenAI-compatible chat completions |
| Builds static preview | `GT3_BUILDS_PORT` default **8081**; Bud Center preview prefers product-port `/lexiom13/preview/:runId/` |
| OpenRouter key | Server-held; never given to the browser agent |
| CA location / executor | `browser_session` + `bolt_webcontainer` only (now) |
| Audit | GT3 logs agent-broker traffic with run_id / pass / upstream status; Ops Console per companion spec |

---

## 7. Delivery truth / known divergence

- **Existing foundation:** prepare packaging; evidence plan/prompt; cockpit poll; per-OSN lifecycle signal with reload status reconnection; `/v1` broker + Ops AGENT lane; browser-session WebContainer worker, syncOut/report, timeout, and Ops recent-run surfaces.
- **Current product behavior:** the append-only five-tool Real Bolt loop, plugin-scoped capabilities, immutable OSNG/control files, bounded results and run budgets, explicit terminal resolution, and validation after `finish` (deterministic unit/integration coverage landed; opt-in real-Haiku smoke requires a broker key on the running server). After successful builder primary validation, GT3 runs **host quote-span evidence** (Option E: metadata + SUD → LM spans → host slice + `EVIDENCE_MANIFEST.json`); Contract §8.8 coverage still gates overall `completed`. Lifecycle may show `running` with detail “collecting evidences” during that host pass. Empty plans skip evidence. Browser CA does **not** issue `pass=evidence` Jobs. On overall `completed`, Lexiom/GT3 writes `bud` on the requesting OSN, sets Ops `bud_written`, and the Center strip exposes the Bud glyph (no auto-steal of Focus).
- **Known divergence:** `BUILD_REPORT.md` remains a plugin success obligation; host completion currently gates on primary/outline/cleanliness (document) or primary + referenced local assets (software), not on `BUILD_REPORT.md` presence. Prepared `EVIDENCE_AGENT_PROMPT.md` remains an audit/manual sibling; the product evidence path is host quote-span, not an append-only CA evidence tool loop.
- **Follow-up required (expansion):** product locations `host` / `remote`; executor `aider_docker`.
- **Production gate:** WebContainer API commercial license for for-profit deployments.

---

## 8. Out of scope for the Real Bolt slice

- Shipping product-selectable `host` / `remote` / `aider_docker`
- Full chat/workbench UI embed
- Changing prepare snapshot format or OSN graph resolution
- Replacing Evidence Cockpit Sync discovery/poll algorithm
- In-Center editing of the SUD; multiple historical `bud` arrays (see Bud spec)
- Any alternate-executor fallback

Evidence auto-chain (Phase A) and Center Playfield Bud (Phase B) are implemented. The companion specs remain their authority.

---

## 9. Acceptance (Real Bolt slice)

1. Ops shows `ca_location: browser_session`, `executor: bolt_webcontainer`, and broker readiness; Docker is not the product gate.
2. Agent broker calls appear as `AGENT` lane rows in Ops (OpenRouter hop only); product inference remains separately counted.
3. First build-glyph click prepares an inspectable directory without launching a CA; second click activates the prepared run through the plugin-authorized five-tool loop via CA `bolt_webcontainer` only (no fake stubs, **no Docker**). `finish` → SPA syncOut → GT3 validation is required before `completed`.
4. Document Jobs cannot invoke `run_command`; software Jobs can invoke it only within command budgets. Both reject immutable-path writes and workspace escape.
5. Tool results and all run dimensions are bounded; every run ends in an explicit terminal state.
6. Failed bringup/run shows clear `detail` in Lexiom Build card and Ops recent-runs; no fake primary is written.
