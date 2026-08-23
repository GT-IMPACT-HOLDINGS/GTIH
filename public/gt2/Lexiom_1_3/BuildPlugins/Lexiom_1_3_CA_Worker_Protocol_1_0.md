# Lexiom 1.3 — Containerized Agent (CA) Worker Protocol (v1.0)

**Status:** Spec — normative Real Bolt delivery contract for VAL Step 4 builder `/run`; canonical completion remains gated on implementation + validation  
**Audience:** GT3 server authors, Lexiom SPA authors, future host/remote worker authors  
**Applies to:** Job tickets issued by GT3 for browser WebContainer agent passes under `builds/lexiom13/<runId>/`  
**Companions:**
- [Lexiom_1_3_Virtualized_Agent_Loop_1_0.md](Lexiom_1_3_Virtualized_Agent_Loop_1_0.md) (integrity + failure contract)
- [../../../../GT3_Expression_specs/GT3_Ops_Console_Agent_Traffic_Spec_1_0.md](../../../../GT3_Expression_specs/GT3_Ops_Console_Agent_Traffic_Spec_1_0.md)
- [../Lexiom_1_3_Center_Playfield_Build_Artifact_Review_UX_Spec_1_0.md](../Lexiom_1_3_Center_Playfield_Build_Artifact_Review_UX_Spec_1_0.md) (Bud — Step 5)

---

## 1. Purpose

GT3 is the **control plane**: prepare the canonical worktree, issue a short-lived **CA Job ticket**, broker model traffic (`/v1` → OpenRouter → Claude), and reconcile artifacts under `builds/lexiom13/<runId>/`.

The **Containerized Agent** is location-agnostic by design (one Job shape, one Worker interface) so the implementation stays generic and lean. The product contract exposes only **`browser_session`** + **`bolt_webcontainer`**: an append-only OpenAI-compatible tool-call loop inside a WebContainer in the Lexiom player browser. Locations `host` / `remote` and executor `aider_docker` are reserved Follow-ups — not selectable, not default.

**Secondary name (display/story only):** **Hanuman** — devotee of Ram (the Lexiom player); crosses workspaces, carries tools, and serves the GT3 LM path without claiming White authority. Schemas and fields remain `CA` / `ca_*` (`lib/lexiom13CaNaming.js`, `public/gt2/Lexiom_1_3/ca/devoteeName.js`).

---

## 2. Locations and executors

| `ca_location` | Status | Meaning |
|---|---|---|
| `browser_session` | **Normative delivery (default, only)** | Lexiom player tab owns the CA sandbox (WebContainer + OPFS mirror). Player laptop supplies compute. |
| `host` | Follow-up | Future: product-visible colocated bind-mount on the GT3 machine |
| `remote` | Follow-up | Future: FaaS / job-pod swarm claiming the same ticket |

| `executor` | Status | Meaning |
|---|---|---|
| `bolt_webcontainer` | **Normative delivery (default, only)** | Headless Lexiom-owned Real Bolt tool loop in WebContainers; LM via GT3 `/v1` only |
| `aider_docker` | Follow-up | Optional session-leased Docker executor capacity |

Dispatcher rule: any `ca_location` other than `browser_session`, or any live product path that requires `aider_docker`, → `agent_unavailable` with a clear `detail`.

Happy path requires **no Docker Desktop** on the player machine.

---

## 3. Job ticket (normative fields)

| Field | Meaning |
|---|---|
| `run_id` | Build directory id |
| `session_id` | Browser session lease id |
| `pass` | `builder` \| `evidence` |
| `plugin_id` | Mapped build plugin (selects document vs software **mode**) |
| `ca_location` | Always `browser_session` now |
| `executor` | Always `bolt_webcontainer` now |
| `runtime` | `webcontainer` |
| `broker_path` | OpenAI-compat path `/v1/agent/:runId/:pass` (SPA resolves against page origin) |
| `broker_token` | Dummy-compatible credential (never an OpenRouter key) |
| `timeout_ms` | Wall clock (builder default 20 min) |
| `workspace` | Sync descriptors (manifest URL / file fetch / syncOut + report) |

**Integrity:** workers receive **zero** `OPENROUTER_API_KEY` / `GT3_LEXIOM_AGENT_KEY`.

---

## 4. Worker interface

```text
claim(job) → syncIn(workspace) → runAgent(sandbox) → syncOut(artifacts) → report(status)
```

- **sandbox** = WebContainer in the player browser.
- **runAgent** = the append-only Real Bolt tool loop owned by Lexiom SPA; not a full workbench UI embed.
- Executor family in `RUN_RESULT.json`: `executor: bolt_webcontainer` plus `ca_location: browser_session`.

Success = primary artifact present on the **canonical** GT3 build path after syncOut + server validation. No stub primaries and no alternate executor fallback.

### 4.1 Append-only OpenAI-compatible turn protocol

1. Start with the system/plugin instructions and user build request in `messages`.
2. Send the full accumulated `messages` plus the plugin-authorized OpenAI `tools` array to the GT3 broker.
3. Append the returned assistant message unchanged. If it contains tool calls, execute each authorized call and append one matching `role: tool` result with its `tool_call_id`.
4. Repeat from the expanded history. Never replace, rewrite, or summarize away earlier assistant/tool turns **inside a bounded phase**.
5. A prose-only assistant response is not success. The loop reaches requested completion only through `finish`; the host then validates the plugin artifact before reporting canonical completion.

**Document context economy (normative for `lexiom13.document_builder`):** composition uses **phase-fresh** conversations (outline → one conversation per fill cluster → optional reconcile). Append-only applies within each phase. Durable workspace artifacts (`OUTLINE.md`, `sections/**`, `PHASE_LEDGER.json`) and GT3’s exchange ledger carry truth between phases; the billed working `messages` tape does not span the whole run. Software builds retain a single append-only conversation for the Job.

Malformed JSON, unknown tools, duplicate/unknown tool-call ids, disallowed capabilities, or path-policy violations are tool/protocol failures, never instructions to improvise an untracked side effect.

### 4.2 Canonical tool surface

| Tool | Contract |
|---|---|
| `list_files` | List a bounded, workspace-relative directory view. No path may escape the prepared project. |
| `read_file` | Read a bounded byte/line window from one workspace-relative file and report truncation explicitly. |
| `write_file` | Create or replace one authorized workspace-relative deliverable. Parent directories may be created inside the writable project surface. |
| `run_command` | Run one bounded command in the WebContainer project; offered only by the software plugin. |
| `finish` | Request terminal validation with a concise summary; the plugin contract supplies the primary path, and this tool performs no write itself. |

Tool results are structured, serializable, and bounded. Listings, reads, command output, and error detail must state when truncated; binary or oversized content is rejected or represented by metadata rather than injected without limit.

### 4.3 Capability and immutability policy

- Document composition-phase tool: `write_file`. Prepared-node, plan, outline, and source reads are performed by the host while constructing each bounded phase packet; a required non-empty write is validated and atomically finalizes the phase.
- Software builder tools: `list_files`, `read_file`, `write_file`, `run_command`, `finish`.
- All paths are normalized against the prepared workspace; absolute paths, traversal, symlink escape, and writes outside it fail closed.
- Any tool call outside the current phase capability set fails terminally with `tool_not_allowed`.
- `osng/**` and document `nodes/**` are immutable. Prepared/control files are also immutable: `OSNG_Basics_README.md`, `HANDOFF.json`, `AGENT_PROMPT.md`, `EVIDENCE_PLAN.json`, `EVIDENCE_AGENT_PROMPT.md`, `RUN_RESULT.json`, and for document builds `BUILD_PLAN.json`, `SOURCE_MAP.json`, `BUILD_MANIFEST.json`, and `sources/**`.
- The host enforces policy independently of model instructions. A plugin cannot acquire a capability merely by asking for it in a prompt.

### 4.4 Bounds, budgets, and terminal states

The browser worker applies hard host-defined limits and fails closed when they are exhausted:

- Document phases: tighter per-phase step/action ceilings (outline/fill/reconcile) with cumulative prompt-token and LM-crossing admission from `BUILD_PLAN.json` (`token_budgets`); crossing estimates include both serialized messages and offered tool schemas.
- Document fallback / software whole-Job defaults: at most 36/48 model steps and 120/180 tool actions respectively when not overridden by phase budgets.
- Both: at most 3 consecutive no-progress turns (document phases may tighten to 2); each serialized tool result is capped (document phases 40,000; software default 60,000 characters); listings return at most 500 paths; reads default to 30,000 and cap at 60,000 characters.
- Software `run_command`: only `node`, `npm`, and `npx`; default 30 seconds and hard cap 120 seconds per command; captured output caps at 30,000 characters.
- Job lease/wall clock: builder default 20 minutes. Server syncOut additionally caps a report at 300 files and 2,000,000 characters per file.
- Phase-sensitive `max_tokens` on broker crossings; optional provider prompt caching via `GT3_AGENT_PROMPT_CACHE` must not alter correctness on miss.

These are defaults/maxima for this delivery, not model suggestions. Later ticket-level tightening may be added without broadening plugin capability.

Terminal states are explicit:

| Terminal state | Meaning |
|---|---|
| `completed` | `finish` was called and plugin validation passed after syncOut. |
| `agent_failed` | Model, protocol, tool, budget, command, syncOut, or artifact validation failed. |
| `agent_unavailable` | Required browser/runtime/broker capability was unavailable before useful execution. |
| `agent_failed` with `reason: session_cancelled` | Player/session cancellation ended useful execution; the lease is `cancelled`. |
| `agent_failed` with `reason: session_expired` or timeout reason | Lease/wall-clock expiry ended execution; the lease is `expired`. |

Model stop, empty tool calls, browser disappearance, or budget exhaustion must resolve to one of these states; the worker must not leave an ambiguous successful-looking run.

### 4.5 Plugin modes (same worker)

| Plugin | Mode rules |
|---|---|
| `lexiom13.document_builder` | Prefer file actions; enforce outline_then_fill gates; reject dirty `document.md` (§3.5 cleanliness) |
| `lexiom13.software_coding_builder` | Allow shell/npm/preview in WebContainer; primary `index.html` (or profile path) |

---

## 5. Browser session surfaces

| Surface | Role |
|---|---|
| `POST /lexiom13/build/run` | Issues ticket; returns `ca_session` bootstrap; **does not** start server-side Docker |
| `GET /lexiom13/build/session/:sessionId/workspace` | Manifest of prepared files (incl. software `osng/**` or document `nodes/**` paths) |
| `GET /lexiom13/build/session/:sessionId/file?path=` | Fetch one workspace file for syncIn |
| `POST /lexiom13/build/session/:sessionId/artifacts` | syncOut file bodies into canonical build dir |
| `POST /lexiom13/build/session/:sessionId/report` | Final status → `RUN_RESULT.json` |
| `POST /lexiom13/build/session/:sessionId/heartbeat` | Keep lease warm |
| `POST /lexiom13/build/session/:sessionId/cancel` | Player abandons session |
| `GET /lexiom13/build/status/:runId` | Poll canonical `RUN_RESULT.json` |

### 5.1 LM crossing observability

The worker identifies `ca_location`, `executor`, and `plugin_id` on each broker call; the run/pass remain bound by the broker path. GT3 records the redacted outbound OpenAI packet and returning response as `gt3-lm-exchange/1` before exposing it to Ops.

The exchange route is location/provider-agnostic: `CA → GT3 → destination { id, transport, locality }`. OpenRouter/remote remains the only product destination now. A future localhost LM may occupy the destination plane without changing the CA Job shape, packet inspector, or redaction contract.

---

## 6. Sister plane (SUD)

Where the player **runs the generated software** (WebContainer preview / OPFS / Center Bud) is orthogonal to `ca_location`. Evidence auto-chain (Phase A / Option E) is **host quote-span** after builder success — not a second browser CA Job. Bud persist + Center Bud (Phase B) write `bud` on the requesting OSN after overall success.

---

## 7. Acceptance (Step 4)

1. `/run` records `executor: bolt_webcontainer`, `ca_location: browser_session`.
2. Lexiom SPA boots WebContainer, syncIn, runs the append-only canonical tool protocol via GT3 `/v1`, syncOut + report.
3. Primary lands under `builds/lexiom13/<runId>/` with **no Docker**; broker integrity holds; no stub primaries.
4. Document mode rejects unclean `document.md`; software mode requires primary HTML (or profile path).
5. Ops `recent_agent_runs[]` includes `executor` + `ca_location`.
6. `host` / `remote` / `aider_docker` are documented Follow-ups only.
7. Every broker call is inspectable in Ops as a redacted request/response LM exchange; no worker credential is persisted.
8. Tool authorization, immutable paths, bounded results, all Job budgets, explicit terminal states, and post-`finish` plugin validation pass before `completed`.
