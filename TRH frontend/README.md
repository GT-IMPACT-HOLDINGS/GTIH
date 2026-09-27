# TRH frontend



Home for **The Reasoning Hub (TRH)** frontend development.



This tree lives inside the GTIH repo; Tegria’s SPA lives in the sibling [`tegria-front-end/`](../../tegria-front-end/) workspace. Tegria owns a vertical product shell; TRH owns a **console-focused** surface that strives for a **CLI-based UX**—prompt in, structured GTIH outcomes out—without becoming a Lexiom 1.3 cabinet fork or a Tegria tenant wrapper.



## Day-zero console



- Open (with `npm start`): [http://localhost:8080/TRH%20frontend/](http://localhost:8080/TRH%20frontend/)

- Loads GTIH via `<script src="/gt2/gtih/gtih-sdk.js">` (same origin). When TRH is hosted on a **different** web server, change **only** that script `src` to the absolute GTIH SDK URL (e.g. `https://<gtih-host>/gt2/gtih/gtih-sdk.js`) — no other GTIH path/port config.

- Theme follows the browser `prefers-color-scheme` (bright by default; reversed palette in dark mode)

- Desired outcome autofocuses on load; after a raise (and across browser refresh) the last intent is the empty-box placeholder (localStorage) — **Tab** concretizes it for edit / continue / Enter again. Once a SUD is shown in Outcome, the field title becomes **Desired change** (reshape the OSNG); it reverts when Outcome is cleared.

- Primary: `gtih.osng.proposeThenRealizeUntilDone` — propose OSNG → ephemeral prepare (no Lexiom YAML) → Hanuman realize → render Outcome then Evidences only when each has content

- Left / right sidebars always open (OSNG · Hanuman); no collapse rails. Each sidebar scrolls on its own (`#osngView` / `#out`); the center workspace scrolls separately — wheel or focus + keys on a panel do not move the others.

- Left sidebar: proposed OSNG as **YAML** by default; Outcome Spec-only shows **editable** prose paragraphs (blue `output_spec`, green evidence narratives — blur/input commits into the envelope); after a SUD exists, editing Outcome Spec / evidences reveals a **▶** that calls `gtih.hanuman.realizeUntilDone({ osng_envelope })` then refreshes Outcome / Evidences; Metadata alone or both → structured YAML (meta mid-gray · spec blue · evidences green); JSON formatter kept behind `setOsngViewFormat('json'|'yaml')` for a later user toggle

- Right sidebar (Agentic Delegation): **Subject Matter** / **OSNG Machinery** / **Hanuman Labor** filters — Subject Matter (default on) keeps intent→garden→SUD→evidences story beats; OSNG Machinery (default off) shows host/Job machinery (propose/prepare/phase); Hanuman Labor (default off) shows structured CA `onLaborEvent` facts only (tools, FS, GT3 consults, lifecycle) — inside the leap, not TRH-invented narrative. Both/all on = full chronological stream (scrollable history in `#out`, sticky to bottom while live unless you scroll up); none = empty hint. Subject Matter lines use **light purple** during OSNG expansion and **dark purple** during SUD realization. Labor lines use slate mono. Expand ends on the sealed propose Job; prepare opens realize with an explicit cut beat. While Hanuman labors, a `| / - \` spinner trails the log. Hard error JSON pierces the filter.

- **Outcome / Evidences:** each row is **serial · type · status** (`0` = SUD; evidences `1…n`; status `C` Collected / `A` Approved / `M` Missing). Click a row to open `#resultModal` (90vw×90vh). Modal body planes:

  | Panel | Plane | SDK | Contract |
  |-------|--------|-----|----------|
  | **LP** | Hanuman WebContainer (same as RP) | `gtih.hanuman.modalChatUntilDone({ contract: 'lineage_readonly', … })` | Read-only counsel in `AGENT_PROMPT` — writes only `CHAT_REPLY.md`, answers sample questions from `FOCUS_CONTENT.md`; no Apply |
  | **TP** | Sample content | (local) | — |
  | **BP** | GT3 product infer | `gtih.gt3.infer` | No OSNG/SUD pack |
  | **RP** | Hanuman WebContainer (same as LP) | `modalChatUntilDone({ contract: 'edit_osng', … })` | Edit-my-OSNG; **Apply** updates System Pack; optional ▶ re-realize |

  `<-`/`->` step samples; download + **X** in the header. Cockpit blurs under a scrim while the modal is open.

- Secondary: **propose only** (`proposeFromIntentUntilDone`, `max_descendants: 0` → single-OSN OSNG)

- On failure: shows `detail` + `debug` JSON (no silent draft fallback)

- Hanuman sidebar narrates labor as **Ram** (raises / throne of consent) · **Hanuman** (devotion with hands) · **GT3** (the only sun); propose Jobs tell Hanuman the OSNG proposition was raised by Ram

- How to experiment: [`../public/gt2/gtih/EXPERIMENT_proposeFromIntent.md`](../public/gt2/gtih/EXPERIMENT_proposeFromIntent.md)



## Intent



- Console / CLI-first interaction (browser console for day-zero).

- Call the **GTIH SDK** directly — see [`public/gt2/gtih/`](../public/gt2/gtih/).

- Flow: narrative → proposed OSNG → SUD realization → evidences — [`SHARED_OSNG_propose_from_intent.md`](../public/gt2/gtih/SHARED_OSNG_propose_from_intent.md) + [`API.md`](../public/gt2/gtih/API.md) Hanuman group.



## Non-goals (this directory)



- Replacing Lexiom 1.3 cockpit UX.

- Hosting Tegria domain/tenant remote-server concerns.

- Auto-canonizing proposed OSNG into Lexiom YAML (ephemeral prepare only).
