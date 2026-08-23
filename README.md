# GTx

---

GTx is a draft-first LM-centered workspace platform centered on the GT3 server.  
It combines product UIs (e.g., GT1/ODD, GT2/Lexiom) with a multi-provider inference backend and an operator console.

## Value Flow

Value flows through the GT constellation as a balanced exchange:

- **GT3** creates protected intellectual capital, licenses it upward, and receives royalties.
- **GT2** commercializes vertical services, converting GT3 technology into revenues, investor returns, and market validation.
- **GT1** channels related capabilities into nonprofit/public-benefit activity, converting revenues and services into goodwill.

Together, GT1 amplifies legitimacy, GT2 generates financial traction, and GT3 preserves the reusable technological/IP foundation.

## Core Principles

- **Draft-first interaction:** LM outputs are proposals, not final truth.
- **User agency:** explicit approval and editing remain with the human.
- **Traceability:** inference and session behavior is observable through ledger/log artifacts.
- **Spec-driven development:** behavior is defined and maintained through markdown specifications.



## Main Components

- `server.js` — GT3 HTTP server (inference, ops, logs, session telemetry, artifact share flows).
- `public/gt3/gt3.html` — GT3 operator console.
- `public/gt2/Lexiom/` — Lexiom product surface and specs (constitutional baseline).
- `public/gt2/Lexiom_1_3/` — Lexiom 1.3 cockpit, OSN graph, and build plugins.
- `public/gt2/Lexiom_1_4/` — Lexiom 1.4 embedded-SaaS contracts, SDK, smoke host; GT3 `/lexiom14` API.
- `public/gt2/QuoteMe/` — QuoteMe product surface and specs.
- `public/GT1/ODD/` — Outcome Driven Development (ODD) advisor SPA and specs.
- `public/gt2/legato/` — legacy UI surface.
- `lib/gt3ExpressionProfiles.js` — expression-skill discovery and loving-prompt construction.



## Quick Start



### Prerequisites

- Node.js `>=18`
- Copy `.env.example` → `.env` and set at least:
  - `OPENROUTER_API_KEY` — product inference
  - `GT3_LEXIOM_AGENT_KEY` (preferred) or `OPENROUTER_API_KEY` — Lexiom agent broker for `/run` builds
- Lexiom 1.3 `/run` runs in the player browser (no Docker on the happy path). Needs a modern browser; see `public/gt2/Lexiom_1_3/BuildPlugins/` for VAL/CA bringup, licensing gates, and Follow-up executors.



### Install

```bash
npm install
```

Optional Follow-up capacity may install under `.gt3-agent-runtime/`; it is not required for Lexiom 1.3 browser `/run`.

### Run

```bash
npm start
```

Server loads repo-root `.env` automatically (`dotenv`). Set the keys above before Lexiom `/run` builds. Ops `/ops/summary` reports whether the agent broker key is configured.

Server defaults:

- Product UIs + API: `http://localhost:8080` (`./public`)
- Build outputs: `http://localhost:8081` (`./builds`, override with `GT3_BUILDS_PORT`; set `0` to disable)

Example Lexiom 1.3 build SPA: `http://localhost:8081/lexiom13/<runId>/`

## Key Endpoints

- `POST /inference` — primary inference endpoint.
- `GET /ops/summary` — runtime provider/mode/traffic summary for ops UI.
- `GET /ops/agent-exchanges/:exchangeId` — redacted full CA request/LM response packet for the GT3 Ops inspector.
- `POST /ops/config` — runtime LLM + inference-mode + expression-profile config.
- `GET /ops/expression-skills` — discovered expression skills.
- `POST /ops/reload-expression-skills` — rescan `Expression_skills/`.
- `GET /inferences` — inference ledger/log listing for console consumption.
- `POST /feedback` — feedback logging endpoint.



## Inference Modes

GT3 supports:

- `single`
- `dual`
- `loving_only`

Configured via `GT3_INFERENCE_MODE` (with legacy `GT3_DUAL_INFERENCE` fallback behavior) and adjustable at runtime via `POST /ops/config`.

## Expression Skills

- Distilled skill files are discovered from `Expression_skills/` (`.md` / `.txt`).
- Active profile is controlled by `GT3_EXPRESSION_PROFILE` and `POST /ops/config`.
- Skills can be reloaded without restart via `POST /ops/reload-expression-skills`.



## Project Layout

```text
GT3/
├── server.js
├── lib/
├── public/          ← served on :8080
│   ├── gt3/
│   │   └── gt3.html
│   ├── GT1/
│   │   └── ODD/
│   └── gt2/
│       ├── Lexiom/
│       ├── Lexiom_1_3/
│       ├── QuoteMe/
│       ├── legato/
│       └── utilities/
├── builds/          ← served on :8081 (GT3_BUILDS_PORT)
│   └── lexiom13/
├── Expression_skills/
├── GT3_Expression_specs/
├── training_examples/
├── logs/
└── ledger.jsonl
```



## Specs You Should Read First



### Platform

- `GT3_service_consumption.md` (commercial BD: GTIH service consumption & IP royalty)
- `GT3_GTIH_Service_Consumption_Technical_Spec_1_0.md` (technical map: GTIH ↔ `./public` / Lexiom 1.3)
- `GT3_Expression_specs/GT3_Narrative_Expression_Ingress_Spec_1_0.md`
- `GT3_Inference_In_Band_Context_Spec_1_0.md`
- `GT3_Expression_specs/README.md`
- `Expression_skills/README.md`
- `Lexiom_GT3_Data_Lakes_Spec_1_0.md`
- `GT3_Expression_specs/GT3_Ops_Console_Agent_Traffic_Spec_1_0.md` (Ops reflection of agent broker traffic)



### Lexiom 1.3 build

Start at `public/gt2/Lexiom_1_3/BuildPlugins/` (and `Lexiom_1.3.3_System_Description.md` for the cockpit/OSN story). Key contracts:

- `public/gt2/Lexiom_1_3/BuildPlugins/Lexiom_1_3_Build_Plugin_Contract_1_0.md`
- `public/gt2/Lexiom_1_3/BuildPlugins/Lexiom_1_3_Virtualized_Agent_Loop_1_0.md` (`/run` executor + bringup)
- `public/gt2/Lexiom_1_3/BuildPlugins/Lexiom_1_3_CA_Worker_Protocol_1_0.md` (CA Job ticket)
- `public/gt2/Lexiom_1_3/Lexiom_1_3_Center_Playfield_Build_Artifact_Review_UX_Spec_1_0.md` (Center Bud / SUD review)



### Lexiom 1.4 embedded SaaS (contracts)

- `public/gt2/Lexiom_1_4/Lexiom 1.4 Embedded SaaS — Integration Boundary.md`
- `public/gt2/Lexiom_1_4/Lexiom_1.4_Vertical_Integration_SDK_TypeScript_Spec.md`
- `public/gt2/Lexiom_1_4/contracts/` (`lexiom14/1.0` TypeScript + routes)
- Smoke host: `http://localhost:8080/gt2/Lexiom_1_4/host/` (single-prompt `generateOsn` → document Realize)
- TRH vertical: `node public/gt2/Lexiom_1_4/TRH/serve.mjs` → `http://127.0.0.1:4173/` (one outcome prompt; Lexiom owns OSN hemispheres)



## Testing / Validation

At this point, automated testing/validation is defined for **GT1/ODD only**.

See:

- `public/GT1/ODD/README.md`

Available scripts include:

- `npm run test:odd`
- `npm run test:odd:headed`
- `npm run prehandoff:odd`

These scripts validate the GT1/ODD flow (`public/GT1/ODD/`) and its GT3 integration path.

## Deploy to AWS Elastic Beanstalk (Short)



### Create a deploy zip

From repo root, use one of:

```bash
node pack-eb.js --no-node-modules
```

or on PowerShell:

```powershell
.\pack.ps1
```

Both create an EB-ready zip in the project root.

### Notes

- Keep `.ebextensions/` in the package (health/proxy config is already present).
- Prefer excluding local `node_modules` so EB installs Linux-compatible dependencies.
- Prefer excluding a prebuilt `.gt3-agent-runtime/` from the zip (optional Follow-up capacity only; not required for Lexiom browser `/run`).
- `npm start` is the runtime command (`node server.js`) from `package.json`.
- Set `OPENROUTER_API_KEY` on the EB environment for product inference.
- Set `GT3_LEXIOM_AGENT_KEY` (preferred) for the Lexiom agent broker, or fall back to `OPENROUTER_API_KEY`. Additional agent/env knobs are documented in `.env.example`.



## Contributor Notes

When changing behavior:

1. Update code.
2. Update relevant specs in the same change.
3. Prefer explicit “Known divergence” notes where behavior/spec intentionally differ.

Human-in-control remains the governing contract across products and server behavior.