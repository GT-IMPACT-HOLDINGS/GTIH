# TRH frontend



Home for **The Reasoning Hub (TRH)** frontend development.



This tree sits **parallel** to [`Tegria_frontend/`](../Tegria_frontend/) at the GT3 repo root. Tegria owns a vertical product shell; TRH owns a **console-focused** surface that strives for a **CLI-based UX**—prompt in, structured GTIH outcomes out—without becoming a Lexiom 1.3 cabinet fork or a Tegria tenant wrapper.



## Day-zero console



- Open (with `npm start`): [http://localhost:8080/TRH%20frontend/](http://localhost:8080/TRH%20frontend/)

- Loads GTIH via `<script src="/gt2/gtih/gtih-sdk.js">` (same origin). When TRH is hosted on a **different** web server, change **only** that script `src` to the absolute GTIH SDK URL (e.g. `https://<gtih-host>/gt2/gtih/gtih-sdk.js`) — no other GTIH path/port config.

- Theme follows the browser `prefers-color-scheme` (bright by default; reversed palette in dark mode)

- Primary: `gtih.osng.proposeThenRealizeUntilDone` — propose OSNG → ephemeral prepare (no Lexiom YAML) → Hanuman realize → render SUD + evidence collections

- Left / right sidebars always open (OSNG · Hanuman); no collapse rails

- Left sidebar: proposed OSNG as **YAML** by default; Outcome-only shows prose paragraphs (blue `output_spec`, green evidence narratives); Metadata alone or both → structured YAML (meta mid-gray · spec blue · evidences green); JSON formatter kept behind `setOsngViewFormat('json'|'yaml')` for a later user toggle

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


