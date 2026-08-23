# GT1 / ODD

GT1/ODD is a minimal single-page advisory interface that runs on top of the GT3 inference server.

It provides a plain-text chat flow for Outcome Driven Development (ODD) guidance, plus a 128×128 watercolor visual of each textual response, with keyboard-first interaction and no build pipeline.

## What Is In This Module

- `index.html` — the ODD SPA (single-file UI + inline script).
- `ODD_Advisor_Product_Spec.md` — product/behavior contract.
- `ODD_testing_specification.md` — canonical testing contract and quality gate.
- `Outcome_Driven_Development_Advisor_System_Prompt.md` — advisor prompt source loaded by the SPA.
- `ODD_Graphics_Outcome_Spec.md` — graphics customer outcome.
- `ODD_Graphics_Image_System_Prompt.md` — graphics LM prompt (watercolor image of advisor output).

## Runtime Behavior

1. User opens `/GT1/ODD/index.html`.
2. UI fetches advisor and graphics system prompt markdown files.
3. User submits message with Enter (Shift+Enter inserts newline).
4. SPA calls `POST /inference` on GT3 (advisor turn).
5. Textual response is rendered in **inferred output**.
6. SPA calls `POST /inference` again with `X-GT3-ODD-Graphics: 1`, using the textual response as `narrative` and the graphics system prompt as `system`.
7. GT3 calls OpenRouter image generation (**default model `bytedance-seed/seedream-4.5`**, `modalities: ["image"]`); PNG base64 is returned and rendered at 128×128 (client watercolor fallback if generation fails).

## API / Integration

- Endpoint: `POST /inference`
- Headers used by ODD page:
  - `X-GT3-Tenant: gt2-lexiom-demo`
  - `X-GT3-Data-Track: green`
  - `X-GT3-Consent-Version: v1`
  - `X-GT3-ODD-Direct: 1` (advisor text turn: direct chat LM via OpenRouter)
  - `X-GT3-ODD-Graphics: 1` (graphics turn: OpenRouter `bytedance-seed/seedream-4.5` image generation; mock returns placeholder PNG)
- Request body per turn:
  - Advisor: `{ "narrative": "<user>", "system": "<advisor prompt>" }` with `X-GT3-ODD-Direct: 1`
  - Graphics: `{ "narrative": "<advisor response>", "system": "<graphics prompt>" }` with `X-GT3-ODD-Graphics: 1` and `X-GT3-ODD-Direct: 1`
- GT3 tunnels both to the runtime provider (default **openrouter** → **openai/gpt-4o-mini**); set `OPENROUTER_API_KEY` or `GT3_LEXIOM_DEMO_KEY` on the server.

## Local Run

From repository root:

```bash
npm install
npm start
```

Then open:

- `http://localhost:8080/GT1/ODD/index.html`

## Testing / Validation

Primary scripts from repo root:

- `npm run test:odd`
- `npm run test:odd:headed`
- `npm run prehandoff:odd`

Artifacts are written under `test-results/` per the testing spec.

## Read Order (Single Entry)

1. `ODD_Advisor_Product_Spec.md`
2. `ODD_testing_specification.md`
3. `Outcome_Driven_Development_Advisor_System_Prompt.md`

## Notes for Contributors

- Keep ODD behavior changes and ODD specs updated in the same PR.
- Keep responses plain-text and avoid adding rich rendering unless the product spec changes.
- If behavior diverges from spec, document it explicitly before handoff.
