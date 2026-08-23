# Lexiom 1.3 — Center Playfield Build Artifact Review (UX Spec v1.0)

**Status:** Implemented (runtime) — companion to VAL Step 5 Phase B  
**Audience:** Lexiom 1.3 UX / cockpit authors, build-plugin authors, GT3 server authors  
**Applies to:** Lexiom 1.3 cockpit after a successful VAL `/run` that produced a primary System Under Development (SUD) and completed evidence collection under `builds/lexiom13/<runId>/`  
**Companions:**
- [BuildPlugins/Lexiom_1_3_Virtualized_Agent_Loop_1_0.md](BuildPlugins/Lexiom_1_3_Virtualized_Agent_Loop_1_0.md) (execution; shared triptych §0; writes nothing to live OSNs itself — Lexiom/GT3 writes `bud` after success)
- [BuildPlugins/Lexiom_1_3_Build_Plugin_Contract_1_0.md](BuildPlugins/Lexiom_1_3_Build_Plugin_Contract_1_0.md)
- [BuildPlugins/Lexiom_1_3_Evidence_Cockpit_Sync_1_0.md](BuildPlugins/Lexiom_1_3_Evidence_Cockpit_Sync_1_0.md)
- [../../../GT3_Expression_specs/GT3_Ops_Console_Agent_Traffic_Spec_1_0.md](../../../GT3_Expression_specs/GT3_Ops_Console_Agent_Traffic_Spec_1_0.md) (Ops reports `bud_written` on recent runs; does not render the SUD)
- [Lexiom_1.3.3_System_Description.md](Lexiom_1.3.3_System_Description.md) §11 (Center = sole execution surface)
- [OSNG_Basics_README.md](OSNG_Basics_README.md) (OSN fields; agents must not write live OSN YAML)
- Lexiom 1.x spatial baseline: [../Lexiom/Lexiom_Spatial_UX_spec_1_0.md](../Lexiom/Lexiom_Spatial_UX_spec_1_0.md)
- Runtime: `lib/lexiom13BudPersist.js`, `lib/lexiom13BudServe.js`, Center Bud host in `app.js`

---

## Governance note

Checked: root README, Lexiom Constitution (Center-only execution; no silent mutation), System Description §4.4/§9/§11, VAL + Build Plugin contracts, UX/CodeShape OSN section model, and current `app.js` (`OSN_SECTION_DEFS`: `seed`, `thematic_lenses`, `output_spec`, `success_evidences`; Build handoff is a separate runtime `"build"` card).

**Code today:** After a successful VAL run, Lexiom/GT3 persists `bud` on the requesting OSN YAML. Focusing that OSN shows a Bud glyph immediately after Success Evidences; clicking Bud opens the delivered SUD in Center as a **draft-first** card (editable proposal chrome shared with other OSN section tabs). Completion does not auto-steal Focus. The runtime Build handoff card remains separate from the `bud` key.

**Shared acceptance narrative (with VAL + Ops):** bringup healthy → broker visible in Ops → `/run` builds SUD → evidences in Right Panel → `bud` on requesting OSN → player opens Bud in Center.

---

## 1. Purpose

After the Virtualized Agent Loop finishes for a compilation-root OSN (primary SUD written **and** evidence collection available for Lexiom to read), Lexiom records a new top-level YAML key **`bud`** on **that requesting OSN**.

Lexiom then:

1. Treats `bud` as a **first-class section sibling** of `seed`, `thematic_lenses`, `output_spec`, and `success_evidences`.
2. Shows a **Bud glyph** in the Center section strip next to the Success Evidences glyph when `bud` is present.
3. On player click of the Bud section, runs/presents the SUD in the Center Playfield (software: iframe preview; document: read-only document host).

Viewing the bud is **not** evidence approval. Right Panel checkboxes remain the White Move attestation path.

---

## 2. When `bud` is written

| Gate | Rule |
|---|---|
| Trigger OSN | The compilation-root OSN whose build glyph invoked prepare/run (the “requesting” OSN) |
| Success bar | Builder pass completed with resolvable primary artifact **and** evidence pass produced a readable plan/manifest (collection available to Lexiom — statuses may include `collected` / `deferred` / etc.; presence of `EVIDENCE_MANIFEST.json` covering the plan is enough) |
| Writer | **Lexiom/GT3 server** (or cockpit persist path), **not** the Aider/Docker agent. Agents still must not mutate live `public/gt2/Lexiom_1_3/**/*.osn.yaml` or `./osng/` |
| Failure | No `bud` key written; Build handoff/report shows VAL `detail` only |

**Temporal note:** Writing `bud` is a post-run system record of “a delivered bloom exists for this node,” analogous to attaching a pointer — not a silent edit of seed/lenses/output_spec. Player-visible Focus refresh must pick up the new key without requiring a manual YAML edit. Prefer durable write to the live requesting OSN YAML (canonize/persist) once the run succeeds; session overlay may precede disk write if needed, but the architecture of record is the YAML key on the OSN.

---

## 3. `bud` YAML shape (normative)

Top-level sibling of the core intention/evidence keys:

```yaml
seed: >
  ...
thematic_lenses:
  - ...
output_spec: |-
  ...
success_evidences:
  - ...
bud:
  schema_version: lexiom13-bud/1
  run_id: mrxpefev_c458264d
  plugin_id: lexiom13.software_coding_builder
  media_kind: software          # software | document
  entry_file_name: index.html   # or document.md / artifact_profile primary
  preview_path: /lexiom13/preview/mrxpefev_c458264d/
  # document media_kind may use artifact_path instead of/in addition to preview_path:
  # artifact_path: /lexiom13/build/mrxpefev_c458264d/artifact/document.md
  status: ready                 # ready | stale | missing_artifact
  completed_at: "2026-07-24T18:00:00.000Z"
compilation:
  ...
graph:
  ...
```

Rules:

- Omit `bud` entirely when no successful delivered bloom exists.
- Re-running build for the same root **replaces** `bud` with the newest successful run (do not accumulate an array in v1).
- `status: stale` may be set if the OSN’s approved intention sections change after the bloom (optional later); v1 may keep `ready` until a new run overwrites.
- `bud` is presented in Center as a **draft-first** proposal card (same edit/approve chrome as other OSN section cards). Session edits do not rewrite the durable `bud` pointer or the build-tree artifact; approving Bud is a local review White Move, not evidence approval.

---

## 4. Section strip visualization

Extend the Center top section strip (`#lexiom-osn-section-strip` / `OSN_SECTION_DEFS` pattern) so core keys are:

| Order | Key | Glyph role (today / proposed) |
|---|---|---|
| 1 | `seed` | Seed (existing) |
| 2 | `thematic_lenses` | Sprout (existing) |
| 3 | `output_spec` | Document (existing) |
| 4 | `success_evidences` | Checkbox (existing) |
| 5 | `bud` | **Flower glyph**, placed **immediately after** Success Evidences |

### 4.1 Visibility

- Render the Bud control **only when** the Focus OSN has a `bud` object with `status` usable for open (`ready`, or `stale` still openable).
- If `bud` is absent, the strip looks as today (four glyphs).
- Runtime-only `"build"` handoff card (prepare/run report) remains available via the build glyph flow; it is **not** a substitute for the `bud` section key and need not appear as a fifth permanent strip glyph.

### 4.2 Glyph affordance

- Monochrome SVG flower mark, same strip styling as siblings (`aria-label` / `title`: “Bud — delivered flower”).
- Selected state matches other section glyphs when `selectedSectionKey === "bud"`.
- Clicking Bud sets Focus section to `bud`, clears `selectedEvidenceId`, and switches Center to the draft-first delivered-artifact card (§5).
- **DaDa weather:** the Weatherman authorizes dropping-text rain **only** on this Bud-open Center fade (`fadeKind: bud_open`). Rain duration is **2×** the ordinary fadeOut+fadeIn envelope. Between fade-out end and fade-in start the Center Playfield holds for **2 LCD** (2 × `LCD_FADE_OUT_MS`) with the incoming card still hidden — rain only, no center text. Focus OSN changes and other section fades stay dry (outline breath on OSN Focus change is unchanged).

---

## 5. Center Playfield when Bud is selected

Selecting `bud` is the **sole player action** that stages the SUD into Center (no auto-open when the run completes).

| `media_kind` | Center host |
|---|---|
| `software` | Draft-first card loaded from the delivered entry source (`index.html` text) with the same draft editor chrome; download glyph saves the SUD entry to the browser Downloads folder |
| `document` | Draft-first card loaded from `bud.artifact_path` / primary entry (markdown/text in the shared draft editor: pale-purple editing chrome, approve glyph, edit-diff rendering); download glyph saves the SUD entry to the browser Downloads folder |

Chrome (calm, minimal):

- Draft card header: flower glyph + “Bud” title + space + borderless download glyph + approve/unapprove control (same chrome family as sibling sections)
- Body: shared draft-card editor (gutter, highlight, edit-diff colors)
- Leaving Bud (other section glyph, evidence open, or graph Focus change away) tears down the draft surface like any other section

**Forbidden:** auto-switching to Bud when `/run` completes while the player is editing another section. Build card may show “Bud ready” copy; Focus stays put until the player clicks the Bud glyph.

---

## 6. End-to-end flow

```text
Player clicks build glyph on compilation-root OSN
        │
        ▼
Prepare creates inspectable build directory; glyph changes to prepared
        │
        ▼
Player reviews agent documents and clicks build glyph again
        │
        ▼
CA activates and VAL runs (builder → evidence auto-chain)
        │
        ├── fail → RUN_RESULT detail on Build card; no bud key
        │
        └── success (SUD + evidence collection readable)
                │
                ▼
        Lexiom/GT3 writes bud: { ... } onto requesting OSN YAML
                │
                ▼
        Section strip gains Bud glyph (sibling after Success Evidences)
                │
                ▼
        Player clicks Bud glyph
                │
                ▼
        Center runs/presents SUD (iframe or document host)
```

Evidence tray continues to poll/overlay collected artifacts. Opening an evidence uses the existing evidence viewer mode (not the Bud iframe).

---

## 7. Server / URL contract (minimal)

| Need | Contract |
|---|---|
| Persist `bud` | After successful `/lexiom13/build/run` (+ evidence pass), update requesting OSN YAML with `bud` (dedicated helper beside existing canonize/persist) |
| Software preview URL | Product-port allowlisted tree, e.g. `/lexiom13/preview/:runId/…` serving `builds/lexiom13/<runId>/` (prefer over forcing the iframe onto `:8081` in EB layouts) |
| Document bytes | Allowlisted `/lexiom13/build/:runId/artifact/<entry>` (same spirit as evidence artifact serve) |
| Safety | Never expose `osng/`, prompts, or container internals via Bud URLs |

---

## 8. Temporal / provenance

| Action | Class |
|---|---|
| System write of `bud` after successful run | Post-build Lexiom record on the requesting OSN (not an agent FS write; not an edit of seed/lenses/output_spec) |
| Click Bud / leave Bud | Navigation — log `open_bud` / `close_bud` (or section-select) |
| Approve evidence | Unchanged Right Panel White Move |
| Edit Bud draft text in Center | Session draft review of the delivered SUD; does **not** rewrite live `bud` YAML pointer or build artifacts on approve |

---

## 9. Relationship to other Center modes

| Mode | When |
|---|---|
| `osn_section` | seed / lenses / output_spec / success_evidences (draft cards) |
| `evidence` | Right-tray artifact open |
| `build_handoff` | Runtime Build card after prepare/run (status/report) |
| `bud` | Delivered SUD staged as draft-first Center card from OSN `bud` key |

Only one Center body at a time.

---

## 10. Failure and empty states

| Condition | UX |
|---|---|
| Run failed | No `bud`; no Bud glyph |
| `bud` present but artifact 404 | Bud glyph may show; Center shows calm error + pointer back to Build report |
| Focus OSN without `bud` | Four-key strip only |
| Evidence collection incomplete mid-run | Do not write `bud` until collection is available to Lexiom per §2 |

---

## 11. Acceptance (when implemented)

1. Successful VAL run on a compilation root writes `bud` onto that OSN’s YAML with `run_id`, `media_kind`, and preview/artifact pointer.
2. Focusing that OSN shows a Bud glyph immediately after Success Evidences in the Center section strip.
3. Clicking Bud opens the delivered SUD in the shared draft-first Center card (editable proposal chrome); DaDa rain accompanies that Center fade only, at 2× duration with a 2-LCD rain-only hold between fade-out and fade-in.
4. Run completion does not auto-steal Center from another section.
5. Agents never wrote the live OSN `bud` field; Lexiom/GT3 did.
6. Evidence approval remains separate White Moves on the Right Panel.
7. Approving the Bud draft does not persist SUD text into intention fields or rewrite the build tree.

---

## 12. Out of scope (v1)

- Persisting Bud draft edits back into the build tree or rewriting the durable `bud` YAML pointer on approve
- Multiple historical buds (array) — newest wins
- Bud glyph on OSNs that were merely included in a subgraph but did not request the build
- Replacing Evidence Cockpit Sync
- Auto-open Bud on run complete
- In-iframe live SPA embed as the primary Bud Center body (live preview remains available via product preview URLs, not the Bud meta control)

---

## 13. Spec / code amendments (with VAL Step 5)

1. Add conditional `bud` to cockpit section strip + `getSectionGlyphMarkup` (render only when present).
2. After successful VAL builder + evidence passes, Lexiom/GT3 persist `bud` on the requesting OSN; set Ops `bud_written` on the recent-run row.
3. Serve product-port preview / artifact URLs for Center host (§7).
4. OSNG header / Basics README — document `bud` as optional post-build bloom pointer (agents still must not invent it during prepare).
5. UX / CodeShape `output_spec` sync after implementation (lexiom-1-3-osn-sync).

---

## 14. Delivery truth

| Intended | Status |
|---|---|
| `bud` on requesting OSN after successful run | Implemented (`lib/lexiom13BudPersist.js`) |
| Bud glyph after Success Evidences | Implemented (conditional strip glyph) |
| Click Bud → SUD in Center draft-first card | Implemented (shared draft editor chrome) |
| Ops `bud_written` on recent runs | Implemented (`recent_agent_runs[]`) |
| Product-port preview / artifact URLs | Implemented (`/lexiom13/preview/:runId/*`, `/lexiom13/build/:runId/artifact/:entry`) |
