# Lexiom

Lexiom is a draft-first GT2 application powered by GT3 inference.  
It runs as a cabinet-style UX with explicit approvals, staged/shared artifacts, and Zenith-to-Accord progression.

## What Lexiom Includes

- **Landing / onboarding:** `landing.html`, `landing.js`
- **Case creation handoff:** `case-create.html`, `case-create.js`
- **Main cockpit:** `index.html`, `app.js`
- **Narrative builders:** `inference-narratives.js`
- **GT3 client wrapper:** `gt3-client.js`
- **Localization:** `lexiom-i18n.js`
- **Styling:** `styles.css`, `landing.css`, `case-create.css`

## Runtime Flow

1. User enters via `landing.html`.
2. Approved onboarding profile routes user to `case-create.html`.
3. Case-create writes handoff payload to session storage and redirects to `index.html`.
4. Cockpit initializes from one of:
   - inbound shared artifact (`inboundArtifact`)
   - shared accord link (`accord`)
   - case-create handoff payload
   - bundled seed markdown fallback
5. User proceeds through draft-first loops (L1/L2/L3, actions, artifacts) with explicit approvals.

## Key Behavior Contracts

- **Center-only execution:** drafting, approval, and decisive actions happen in center playfield.
- **No silent mutation:** user-visible semantic progression is explicit and approval-gated.
- **Draft-first cards:** editable content + glyph-driven approval semantics.
- **Accord onboarding:** positioning and shared-link generation happen through transition flow.
- **Inbound sharing:** portal/open flows stage content for in-cockpit Accept/Ignore semantics.

## GT3 Integration Notes

- Primary inference endpoint: `POST /inference` (served by repo-root `server.js`).
- Per-request behavior is shaped by `gt3-client.js` narrative building and inference type selection.
- In-band response tails are server-stripped per GT3 in-band spec; client receives display text.

## Run Locally

From repo root:

```bash
npm install
npm start
```

Then open:

- `http://localhost:8080/gt2/Lexiom/landing.html` (recommended entry)
- `http://localhost:8080/gt2/Lexiom/index.html` (direct cockpit entry; gates may redirect)

## Specs Entry Point

Use `Lexiom_UX_InterSpec_Constitution_1_0.md` as the **single entry point** for all Lexiom specifications (canonical and peripheral).

The Constitution now maintains the indexed companion list and authority map. Start there, then follow links to:

- canonical five specs
- core integration/implementation contracts
- active peripheral specs under `Lexiom_Peripheral_Specs/`

## Contributor Guidance

- Keep code and markdown specs updated together.
- Prefer minimal, explicit wording updates over broad rewrites.
- If behavior and spec diverge, document it explicitly (`Known divergence`, `Open question`, `Temporary behavior`).
