# Lexiom 1.4 — Integration Contracts (Phase a)

**Status:** Design contract (Phase a). Not yet implemented on GT3.  
**API version:** `lexiom14/1.0`  
**Interaction model:** commands in → typed semantic events out → structured final state/result.

## Documents in this folder

| File | Purpose |
|------|---------|
| [`lexiom14-api.d.ts`](lexiom14-api.d.ts) | Normative TypeScript public contracts (SDK-facing) |
| [`events-catalogue.md`](events-catalogue.md) | Discriminated event catalogue by domain |
| [`realization-package.md`](realization-package.md) | Realization Package schema (document MVP) |
| [`trh-lifecycle.md`](trh-lifecycle.md) | Vertical case lifecycle mapping (TRH-owned states) |
| [`routes.md`](routes.md) | `/lexiom14` HTTP + SSE sketch, CORS, COOP/COEP |

## Parent specs

- [`../Lexiom 1.4 Embedded SaaS — Integration Boundary.md`](../Lexiom%201.4%20Embedded%20SaaS%20—%20Integration%20Boundary.md)
- [`../Lexiom_1.4_Vertical_Integration_SDK_TypeScript_Spec.md`](../Lexiom_1.4_Vertical_Integration_SDK_TypeScript_Spec.md)
- TRH UX: [`../TRH reference/`](../TRH%20reference/)

## Locked MVP decisions (contracts assume these)

- Session-scoped working replica on GTIH; vertical remains SoR.
- Realization completion emits a Realization Package for vertical auto-persist; **persist ≠ canonical**.
- First Realization profile: **document** (`document` profile id).
- POC Draft formation: **single-prompt `generateOsn`**; Lexiom owns OSN hemispheres.
- TRH origin serves **COOP/COEP**; Realization CA runs in the TRH page (no GTIH iframe).
- Software Realization, voice, full agent-delegation product, separate commit API: **out of scope** for `lexiom14/1.0`.

## Phase b runtime status

Implemented on GT3: `lib/lexiom14*.js`, mount `/lexiom14`, smoke host at `/gt2/Lexiom_1_4/host/`. See [`../README.md`](../README.md). Document Realization is server-composed; in-page WebContainer CA remains Follow-up. Single-prompt YAML OSN generation is implemented (`POST .../osn`); when GT3 inference is unavailable the same Lexiom skeleton is filled from the outcome description (**Known divergence** vs live LM fill).

## Non-goals (`lexiom14/1.0`)

- Separate commit/sync API beyond Realization Package handoff
- Voice conversational input
- Full external Agent Delegation product UX
- Software-coding Realization profile
- Vertical billing / invoice systems
- Full tariff / royalty portal UI
- Any edits under `public/gt2/Lexiom_1_3/`
