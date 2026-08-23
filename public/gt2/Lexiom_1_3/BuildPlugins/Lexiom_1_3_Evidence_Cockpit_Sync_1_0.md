# Lexiom 1.3 — Evidence Cockpit Sync (v1.0)

**Status:** Implemented (runtime)  
**Audience:** Lexiom cockpit authors, GT3 server authors, build-plugin evidence integrators  
**Applies to:** Lexiom 1.3.x under `public/gt2/Lexiom_1_3/`  
**Companions:**
- [Lexiom_1_3_Build_Plugin_Contract_1_0.md](Lexiom_1_3_Build_Plugin_Contract_1_0.md) §8 (evidence-collection hemisphere)
- [Lexiom_1_3_Virtualized_Agent_Loop_1_0.md](Lexiom_1_3_Virtualized_Agent_Loop_1_0.md) (builder → evidence auto-chain; failure contract)
- [../Lexiom_1.3.3_System_Description.md](../Lexiom_1.3.3_System_Description.md) §4.4 (success evidences) and §11 (Right Panel)
- Runtime: `lib/lexiom13EvidenceCockpitSync.js`, `GET /lexiom13/evidence/*`, SPA poller in `app.js`

---

## 1. Purpose

Synchronize **OSNG-requested** success evidences (each Focus OSN’s `success_evidences[]`) with artifacts **produced and collected** by Lexiom build-plugin evidence passes under `builds/lexiom13/<runId>/`, so the cockpit **Right Panel** can present the latest reviewable files.

- Collection status is **not** owner approval.
- The OSN YAML remains the source of truth for *what* evidences are requested.
- Bundled demo artifacts under `/gt2/Lexiom_1_3/evidences` remain a fallback when no covering build collection exists.

---

## 2. Poll contract (Focus-closure hybrid)

| Rule | Value |
|---|---|
| Interval | Default **5000** ms (`EVIDENCE_COLLECTION_POLL_MS`) |
| Identity | Focus `osn_id` only — server owns run discovery |
| Kick | Immediate poll on Focus OSN change |
| Visibility | Poll while the cockpit document is visible; **pause** when `document.hidden` |

The SPA does **not** send a run_id list. The server finds covering runs on disk.

---

## 3. Server discovery algorithm

1. Scan `builds/lexiom13/*/` directories.
2. A run **covers** Focus OSN if its `EVIDENCE_PLAN.json` `targets[]` (or `HANDOFF.json` `success_evidence_targets`) includes any row with matching `osn_id`.
3. Rank covering runs newest-first by `EVIDENCE_MANIFEST.json` `collected_at` when present, else by directory mtime.
4. Prefer runs that have a manifest over plan-only runs when ranking richness, but apply **per-target latest wins**:
   - For each `target_id` belonging to Focus OSN, take the newest covering run that has `status: collected` with a resolvable artifact path.
   - Otherwise use the newest covering run’s non-collected status for that target (`deferred` / `failed` / `not_applicable` / `pending`).
5. Plan-only targets (in plan, not yet in manifest) surface as `pending`.
6. If no covering run exists, return an empty `targets[]` (cockpit keeps bundled-demo discovery).
7. Empty, truncated, or otherwise unparsable control JSON (`HANDOFF.json`, `EVIDENCE_PLAN.json`, `EVIDENCE_MANIFEST.json`) is **skipped** for that run (warn + continue). One corrupt sibling run must not fail the whole `collections` response.

---

## 4. API (same-origin product port)

### 4.1 `GET /lexiom13/evidence/collections?osn_id=<FocusOsnId>`

Response schema `lexiom13-evidence-cockpit-sync/1`:

| Field | Meaning |
|---|---|
| `osn_id` | Echo of Focus OSN id |
| `polled_at` | ISO timestamp |
| `source_runs[]` | Covering runs considered (`run_id`, `plugin_id`, `has_manifest`, `rank_time`) |
| `targets[]` | Per Focus evidence target (see below) |

Each `targets[]` row:

| Field | Meaning |
|---|---|
| `target_id` | `{osn_id}::{evidence_id}` |
| `evidence_id` / `kind` / `direct` | From plan / manifest |
| `status` | See §5 |
| `artifact` | `{ url, file_name, media_type }` when a reviewable file is available; else `null` |
| `notes` | Optional collector notes |
| `run_id` | Run that supplied this row’s status / artifact |

### 4.2 `GET /lexiom13/evidence/artifact/:runId/*relPath`

Path-traversal-safe file serve. Allowed:

- Paths under that run’s `evidences/` directory.
- Allowlisted primary deliverable basenames at the run root when recorded on the manifest entry (`document.md`, `index.html`) — only when resolving a collected target that references them.

Do **not** expose `osng/`, prompts, or arbitrary paths outside the allowlist.

---

## 5. Status vocabulary

From Build Plugin Contract §8.5:

| Status | Meaning |
|---|---|
| `collected` | Artifact exists (or allowed primary-artifact reference); **not** owner approval |
| `deferred` | Cannot collect now; notes may explain follow-up |
| `failed` | Attempted; no usable artifact |
| `not_applicable` | SUD cannot host this inspection |

Cockpit-only:

| Status | Meaning |
|---|---|
| `pending` | Present in plan; not yet in manifest |
| `unknown` | No covering run (typically omitted from `targets[]`) |

---

## 6. Right Panel merge rules

1. Enumerate Focus OSN `success_evidences[]` from loaded YAML (always).
2. Availability overlay order for each evidence id:
   1. Build-collected `artifact.url` when status is `collected`
   2. Else bundled demo under `/gt2/Lexiom_1_3/evidences` (init HEAD probe)
   3. Else awaiting placeholder
3. Approval checkboxes remain session-only White Moves; poll cycles never toggle approval.
4. Left-graph evidence-approval glyphs for **non-Focus** OSNs are out of scope for v1 refresh (may stay stale until that OSN becomes Focus or a later batch endpoint lands).

---

## 7. Out of scope (v1)

- Auto-running host quote-span evidence after builder (**architecture of record:** Virtualized Agent Loop Option E via `/run`; cockpit sync itself does not collect — it only polls collected artifacts)
- WebSocket / SSE push
- Copying collected files into `public/gt2/Lexiom_1_3/evidences/`
- Durable approval persistence
- Strategy picker UI
- Batch poll for the entire visible graph

---

## 8. Acceptance

- Focusing an OSN that has a covering run with a later `collected` manifest entry shows the artifact in the Right Panel within ~one poll interval without full reload.
- Changing Focus immediately kicks a poll for the new OSN.
- Bundled demos still appear when no covering collection exists.
- Polling pauses when the tab is hidden and resumes when visible.
- Artifact URLs work from the cockpit origin (product port), not `:8081`.
- Owner approval state is unchanged by poll cycles.
- A sibling run with empty/corrupt control JSON does not 500 the collections endpoint; covering runs still surface.
