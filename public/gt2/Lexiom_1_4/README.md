# Lexiom 1.4 runtime (Phase b)

## Layout

| Path | Role |
|------|------|
| `contracts/` | Normative `lexiom14/1.0` API |
| `sdk/lexiom14-sdk.js` | Browser SDK |
| `embeds/` | Token helpers + embed surfaces via SDK |
| `core/` | Shared client helpers |
| `host/` | Smoke host SPA |
| `osn/` | Lexiom-owned document OSN skeleton + generation prompt |
| `../../../../lib/lexiom14*.js` | GT3 capability + `/lexiom14` router |

## Smoke

1. `npm start`
2. Open `http://localhost:8080/gt2/Lexiom_1_4/host/`
3. Mint → session → **Generate OSN** (one outcome description) → Realize document → evidence embed

## TRH vertical (Phase c)

```bash
node public/gt2/Lexiom_1_4/TRH/serve.mjs
```

Open `http://127.0.0.1:4173/` with GT3 at `:8080`. See [`TRH/README.md`](TRH/README.md).

## System test (Phase d)

```bash
node public/gt2/Lexiom_1_4/TRH/e2e-d2.mjs
```

Plan + results: [`TRH/TEST_PLAN.md`](TRH/TEST_PLAN.md), [`TRH/TEST_RESULTS_D2.json`](TRH/TEST_RESULTS_D2.json).

## CORS foreign origin check

```bash
curl -i -X OPTIONS "http://localhost:8080/lexiom14/v1/version" \
  -H "Origin: http://localhost:4173" \
  -H "Access-Control-Request-Method: GET"
```

Expect `Access-Control-Allow-Origin: http://localhost:4173`.

## Known divergence

Document Realization is **server-composed** (POC). TRH serves COOP/COEP; full in-page WebContainer CA remains Follow-up. See Phase (d) Known divergences in [`TRH/TEST_PLAN.md`](TRH/TEST_PLAN.md).

When GT3 inference is unavailable, `generateOsn` fills the Lexiom-owned `osn/0.2` document skeleton from the outcome description (same hemispheres; not a live LM YAML).
