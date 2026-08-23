# TheReasoningHub (TRH) — Phase (c)

Vertical portal that consumes **Lexiom 1.4** as embedded SaaS. TRH owns branding, UX, SoR, and canonicalization.

## Run (separate origin — required for Phase d)

Terminal A — GT3:

```bash
npm start
```

Terminal B — TRH with COOP/COEP:

```bash
node public/gt2/Lexiom_1_4/TRH/serve.mjs
```

Open `http://127.0.0.1:4173/`  
Settings → Lexiom base URL = `http://localhost:8080`

## Journey

1. **Single prompt** on welcome → mint delegated credential + Lexiom session + `generateOsn`  
2. Lexiom returns structure + opaque YAML (`osn_yaml` stored in TRH SoR — TRH does not compose hemispheres)  
3. Progressive **Output Specifications / Success Evidences** rail (from Lexiom events)  
4. **Realize** → document package auto-persisted to TRH SoR (`localStorage`) — **not** canonical  
5. **Evidence review** → approve each direct evidence  
6. **Mark Canonical / Signed** → attestation record in TRH SoR  

Views: Conversation ↔ Structure ↔ Realization ↔ Evidence ↔ Canonical ↔ Cockpit (MVP-lite planes).

## Phase (d) system test

```bash
node public/gt2/Lexiom_1_4/TRH/e2e-d2.mjs
```

See [`TEST_PLAN.md`](TEST_PLAN.md) and [`TEST_RESULTS_D2.json`](TEST_RESULTS_D2.json).

## SoR

`TrhSor` in `sor.js` — browser `localStorage` key `trh.cases.v1`.

## Follow-up

Voice, full Agent Delegation UX, software Realization, deeper cockpit planes.
