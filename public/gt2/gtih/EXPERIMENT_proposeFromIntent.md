# How to experiment — GTIH propose → realize (async Hanuman)

Shared bricks:

1. **narrative → proposed OSNG** via browser Hanuman (`max_descendants: 0` → single-OSN OSNG).
2. **proposed OSNG → SUD + evidences** via ephemeral prepare (no Lexiom YAML) + Hanuman realize.

Lexiom 1.3 cockpit prepare/realize White Moves were **not** changed.

## Prerequisites

1. From repo root: `npm start` (GT3 on **http://localhost:8080**). Restart after pulling so propose + prepare routes load.
2. Configure `OPENROUTER_API_KEY` or `GT3_LEXIOM_AGENT_KEY` in `.env` (or pass `X-GT3-OpenRouter-Key` / the TRH key field). Agent broker is required — **no** product-inference fallback and **no** silent deterministic draft.
3. Browser must allow WebContainer (COOP/COEP). TRH path and Tegria Vite already set isolation headers.

## Flow A — propose only

1. `POST /lexiom13/osn/propose` → `{ status: "awaiting_browser", run_id, ca_session }`
2. Browser runs `gtih.hanuman.serveProposeSession(ca_session)` (WebContainer tool loop)
3. `GET /lexiom13/osn/propose/status/:runId` until `ok` (+ envelope) or `failed` (+ detail/debug)

Convenience: `gtih.osng.proposeFromIntentUntilDone(...)`.

## Flow B — propose → realize (TRH)

1. Propose until envelope (Flow A).
2. `POST /lexiom13/build/prepare` with `{ osng_envelope }` (or `proposal_run_id`) → handoff `source: "ephemeral_osng_envelope"`.
3. `POST /lexiom13/build/run` → `ca_session`; browser `gtih.hanuman.serveRealizeSession`.
4. Poll `GET /lexiom13/build/status/:runId` until `completed` (or failed).
5. Fetch SUD (`/lexiom13/build/{runId}/artifact/document.md` or `/lexiom13/preview/{runId}/`) and `GET /lexiom13/evidence/collections?osn_id=`.

Convenience: `gtih.osng.proposeThenRealizeUntilDone(...)`  
Also: `gtih.hanuman.realizeUntilDone({ osng_envelope })` when you already hold an envelope.

**Note:** Ephemeral roots skip Lexiom YAML bud persist; SUD still lives under `builds/lexiom13/<runId>/`.

## 1) Curl / propose start only

```bash
curl -s -X POST http://localhost:8080/lexiom13/osn/propose ^
  -H "Content-Type: application/json" ^
  -d "{\"intent\":\"A CLI that turns a prompt into a draft OSN\",\"max_descendants\":0}"
```

Expect `{ "status": "awaiting_browser", "run_id", "ca_session", "meta": { "labor": "hanuman_browser_ca", ... } }`.  
Without a browser worker the Job stays awaiting / eventually times out — that is expected.

## 2) TRH browser console

Open: **http://localhost:8080/TRH%20frontend/**  

- **propose → realize** — full chain; renders SUD + evidence targets.
- **propose only** — envelope JSON (day-zero brick).

## 3) Tegria day-zero UI

```bash
cd Tegria_frontend
npm run dev
```

Open **http://localhost:5173/** — empty garden. Use **Ask Anything**. Vite proxies `/lexiom13`, `/v1`, and `/gt2/Lexiom_1_3/ca` → `:8080`.

## 4) Lexiom intact smoke

Open **http://localhost:8080/gt2/Lexiom_1_3/** — graph load / cockpit should behave as before (no propose wiring in the Lexiom SPA build cards).

## Unit tests

```bash
node --test tests/lexiom13-osn-propose.test.mjs
node --test tests/lexiom13-ephemeral-prepare.test.mjs
```
