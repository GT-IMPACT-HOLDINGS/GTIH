# GT Constellation Mapping — Lexiom 1.3 Welcome SPA

Collection version: **v2** (prior capture retained as **v1**).

This brief maps the Lexiom 1.3 welcome single-page application to the GT constellation roles and states how the initiative preserves draft-first approval, traceability, and direct inspection evidence.

## Initiative summary

Lexiom 1.3.3 demonstrates a calm, evidence-backed welcome cockpit where four canonical OSN YAML files express human intention, branch into UX and Code Shaping disciplines, expose versioned demo success evidences in the right tray, and open those artifacts in the center playfield on click.

## GT3 — reusable core

- Inference infrastructure via `POST /inference` and `gt3-client.js`
- White / Black / Stability move loop, draft-first cards, append-only action logging
- `osn-evidence-links.ts` for `{file_name}.{evidence_id}.{version}.{extension}` artifact linking

## GT2 — productization

- Welcome SPA at `/gt2/Lexiom_1_3/` with five cockpit regions
- Clickable demo evidence tray wired to center playfield inspection
- Four-node canonical OSN graph with runtime Build children

## GT1 — public-benefit expression

- Runnable teaching artifact for governed, evidence-backed specification practice
- Versioned, directly inspectable success evidences without mediated dashboards

## Draft-first approval

- Lens reframes and build previews remain draft until explicitly approved
- Canonical OSN YAML on disk is never mutated by runtime UI actions

## Traceability

- Evidence filenames encode OSN origin, evidence id, and collection version
- Runtime resolves the newest available version (`v2`, then `v1`) per evidence link

## Direct inspection evidence (versioned)

| OSN source | Evidence ID | Artifact (${EVIDENCE_VERSION_CURRENT}) |
| --- | --- | --- |
| `GT_Philosophy.osn` | `sev.constellation.software_mapping_brief` | `GT_Philosophy.osn.sev.constellation.software_mapping_brief.${EVIDENCE_VERSION_CURRENT}.md` |
| `ProductWelcome.osn` | `sev.product.osn_navigation_video` | `ProductWelcome.osn.sev.product.osn_navigation_video.${EVIDENCE_VERSION_CURRENT}.webm` |
| `UX.osn` | `sev.ux.screenshot` | `UX.osn.sev.ux.screenshot.${EVIDENCE_VERSION_CURRENT}.png` |
| `CodeShape.osn` | `sev.code.direct_snippet_review` | `CodeShape.osn.sev.code.direct_snippet_review.${EVIDENCE_VERSION_CURRENT}.js` |

Prior collection **v1** files remain alongside **v2** under `public/gt2/Lexiom_1_3/evidences/`.
