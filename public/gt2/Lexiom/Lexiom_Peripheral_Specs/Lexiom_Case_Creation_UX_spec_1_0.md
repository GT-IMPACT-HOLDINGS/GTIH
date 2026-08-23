# Lexiom Case Creation UX Specification

**Version:** 1.1  
**Status:** MVP (as implemented)  
**Audience:** Engineering / Product  
**Companion:** [Lexiom_UX_InterSpec_Constitution_1_0.md](../Lexiom_UX_InterSpec_Constitution_1_0.md), [Lexiom_Provenance_Spine_Spec_1_0.md](../Lexiom_Provenance_Spine_Spec_1_0.md), [Lexiom_Spatial_UX_spec_1_0.md](../Lexiom_Spatial_UX_spec_1_0.md), [Lexiom_Temporal_UX_spec_1_0.md](../Lexiom_Temporal_UX_spec_1_0.md).

---

## 1. Purpose

Define the passage between landing and cockpit where a user can create a new case seed from:

- optional free-text framing (`caseIntent`)
- optional filesystem corpus selected from local folders

The output is a **proposed draft seed** only. Canonical advancement still requires explicit approvals inside the cockpit.

---

## 2. Temporal Placement

`landing` -> `case-create.html` -> `index.html` (cockpit)

- New users who complete landing mode-entry are routed through case-create.
- Returning users may still enter cockpit directly (outside this page path).

**Implementation note:** case-create handoff enters cockpit through `lexiom_pending_case_handoff_v1` + query `skipIntro=1`. Inbound shared-artifact entry (`inboundArtifact`) is handled by cockpit init and is a separate path from case-create.

---

## 3. Entry Guard

`case-create.html` enforces first-entry approval gate:

- reads `lexiom_first_entry_profile_v1` from `localStorage`
- if missing/unapproved (and no `bypassFirstEntry=1`), redirects to `landing.html`

---

## 4. UX Flow (Current Implementation)

1. **Case framing input (optional)**  
   The case description textarea may stay empty.

2. **Folder selection (optional)**  
   If `showDirectoryPicker` is available, user can select a folder.

3. **Post-selection folder feedback (inside page)**  
   After selection, the page shows:
   - selected folder name
   - list of supported file names (up to display cap)
   - overflow line when additional supported files exist

4. **Conditional enter CTA**  
   `Enter` button is hidden by default and becomes visible only if:
   - case description has non-empty text, **or**
   - a folder has been selected

5. **Seed synthesis**  
   Lexiom calls GT3 (`inferenceType: L24`) with framing + extracted corpus.
   - On GT3 failure/unavailability: fallback local markdown composition is used.

6. **Handoff & navigation**  
   Case payload is written to `sessionStorage`, then user is redirected to cockpit with `skipIntro=1`.

---

## 5. Case Description Placeholder Behavior

On load, case description placeholder is resolved as:

1. last submitted case intent from `localStorage` key `lexiom_last_case_intent_v1` (if available)
2. otherwise localized fallback text (`case_create_step1_heading`)

On successful `Enter` click:

- non-empty `caseIntent` is persisted back to `lexiom_last_case_intent_v1` for next case creation

Keyboard affordance:

- pressing `Tab` inside an empty case description textarea copies current placeholder into real textarea value

---

## 6. Internationalization & Direction

Case-create is multilingual through `lexiom-i18n.js`:

- static text via `data-i18n`
- page title via `data-i18n-title`
- runtime strings via `t()` / `tt()` in `case-create.js`
- locale direction (`ltr`/`rtl`) inherited from shared i18n direction handling

Current translation sets include English and Hebrew.

---

## 7. Session Handoff Contract

Storage key: `lexiom_pending_case_handoff_v1`

Payload shape:

| Field | Type | Notes |
|---|---|---|
| `version` | number | fixed `1` |
| `title` | string | default `case_seed.md` |
| `content` | string | proposed seed markdown |
| `caseIntent` | string | user framing (may be empty) |

---

## 8. File Extraction Rules (Current)

- traversal: recursive stack walk over selected folder and subfolders
- supported formats: `.md`, `.txt`, `.docx`
- file cap: `MAX_TEXT_FILES = 24`
- per-file cap: `MAX_CHARS_PER_FILE = 120000`
- total corpus cap: `MAX_TOTAL_CORPUS = 400000`
- handoff cap: `MAX_HANDOFF_CHARS = 450000` (payload safety truncation)

`.docx` extraction uses Mammoth (`mammoth.browser.min.js`) and safely falls back if parsing fails.

---

## 9. Browser Capability Notes

- Full folder-pick flow requires File System Access API support.
- If unsupported, user can continue with text-only framing.
- If secure context requirements are not met, warning copy is shown.

---

## 10. Visual/Interaction Notes (Implemented)

- page uses two side-by-side section cards (description + folder) on large screens; stacks on smaller screens
- section footer ribbon is removed
- folder status line text is removed; folder feedback is details/list oriented
- `Enter` action row sits outside the section card and is centered when visible
- page fades in on load for smoother handoff from the preceding title slide
- page uses a dedicated case-create theme palette (dark + light variants) aligned with Lexiom title-art direction

---

End of document.
