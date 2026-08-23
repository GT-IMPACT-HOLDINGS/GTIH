# Lexiom 1.3 — Build Plugin Contract (v1.0)

**Status:** Real Bolt product path implemented (append-only OpenAI-compatible tool loop). Sole product executor: [Virtualized Agent Loop](Lexiom_1_3_Virtualized_Agent_Loop_1_0.md) (CA `browser_session` + `bolt_webcontainer` + GT3 ↔ OpenRouter ↔ Claude). See also [CA Worker Protocol](Lexiom_1_3_CA_Worker_Protocol_1_0.md).  
**Audience:** Lexiom runtime authors, plugin authors, agent integrators  
**Applies to:** Lexiom 1.3.x under `public/gt2/Lexiom_1_3/`  
**Companions:**
- [Lexiom_1_3_Virtualized_Agent_Loop_1_0.md](Lexiom_1_3_Virtualized_Agent_Loop_1_0.md) (sole `/run` executor + bringup + failure contract)
- [../Lexiom_1_3_Center_Playfield_Build_Artifact_Review_UX_Spec_1_0.md](../Lexiom_1_3_Center_Playfield_Build_Artifact_Review_UX_Spec_1_0.md) (intended: Center Playfield `bud` section + SUD review)
- [Lexiom_1_3_Document_Builder_Plugin_1_0.md](Lexiom_1_3_Document_Builder_Plugin_1_0.md)
- [Lexiom_1_3_Software_Coding_Builder_Plugin_1_0.md](Lexiom_1_3_Software_Coding_Builder_Plugin_1_0.md)
- [Lexiom_1_3_Evidence_Cockpit_Sync_1_0.md](Lexiom_1_3_Evidence_Cockpit_Sync_1_0.md) (Right Panel poll sync)
- [../Lexiom_1.3.3_System_Description.md](../Lexiom_1.3.3_System_Description.md) §9 (compilation roots); §4.4 (success-evidence kinds)
- [../OSNG_Basics_README.md](../OSNG_Basics_README.md) (OSN graph identity; evidence filename association)

---

## 1. Purpose

A **build plugin** maps a compilation-root OSN and its approved instruction subgraph into a prompt + context package for an external agent. The agent reads the OSN Graph (OSNG) and writes a delivered artifact into a Lexiom-supplied output directory.

**Normative executor:** Virtualized Agent Loop with **`ca_location: browser_session`** + **`executor: bolt_webcontainer`** (player WebContainer + append-only Real Bolt tool loop; canonical tree under `builds/lexiom13/<runId>/` after syncOut + validation; model traffic via GT3 OpenAI-compat proxy ↔ OpenRouter ↔ Claude). Locations `host` / `remote` and executor `aider_docker` are Follow-up. See [VAL](Lexiom_1_3_Virtualized_Agent_Loop_1_0.md) + [CA Worker Protocol](Lexiom_1_3_CA_Worker_Protocol_1_0.md).

Build plugins exist so Lexiom players can trigger domain-appropriate builders (document, software, and later others) from the cockpit build glyph when a plugin is associated with that OSN.

Plugins are **graph-driven**, not tied to fixed product names, branch labels, or artifact genres. Lexiom resolves which OSNs belong in a run from `compilation_root`, `compilation_scope`, `graph.*` links, and policy.

---

## 2. Known divergence (Lexiom 1.3 SPA)

As of this runtime:

- `POST /lexiom13/build/prepare` allocates `builds/lexiom13/<runId>/`, resolves plugin/subgraph/strategy, copies `OSNG_Basics_README.md`, writes `HANDOFF.json`, builds pointer-only `EVIDENCE_PLAN.json`, and packages both agent prompts so the folder is a **standalone agent project**. Software builds snapshot-copy closure YAML under `./osng/`; document builds serialize the same parsed OSN semantics into one immutable `./nodes/nXX.json` file per node, with source-YAML provenance hashes.
- **Normative `/run` delivery:** re-package prompts if needed, then dispatch a CA Job at **`browser_session`** with **`bolt_webcontainer`** (VAL + CA Worker Protocol). The append-only loop receives only plugin-authorized tools, enforces immutable inputs and budgets, and requires `finish` followed by plugin validation. On failure: structured terminal `RUN_RESULT.json` + Lexiom/GT3-console `detail`; no fake primary stubs or alternate executor.
- **Known divergence:** Evidence auto-chain (Phase A / Option E) is implemented as **host quote-span collection** after successful builder validation (no second CA `pass=evidence` Job; no host-heuristic fallback). Phase B `bud` persist + Center Bud + Ops `bud_written` are implemented. `aider_docker` remains Follow-up executor capacity only. Host completion does not yet gate on `BUILD_REPORT.md`.
- The SPA build glyph (when `target_tool_profile` is associated) is an explicit two-move control. The **first click** calls prepare only, creates the inspectable build directory, and settles at `prepared`; the **second click** calls `/run`, activates the CA, and triggers VAL. The Build card shows the prepared handoff/report — not the delivered artifact itself. Its per-requesting-OSN lifecycle is `idle → preparing → prepared → running → completed`, with `failed` as a terminal branch. Only transient `preparing`/`running` states disable repeat invocation.
- OSNs without a mapped profile still fall back to the legacy client-side compilation preview text.
- Static preview: GT3 serves `./builds` on `GT3_BUILDS_PORT` (default **8081**). Open software SPAs at `http://localhost:8081/lexiom13/<runId>/`.

See [Appendix A](#appendix-a-reference-deployment-lexiom-13) for Lexiom 1.3 association examples.

---

## 3. Handoff model

```text
Player clicks build glyph (first White Move)
        │
        ▼
Lexiom resolves associated plugin + strategy + output dir
        │
        ▼
Prepare: snapshot ./osng/ (software) or ./nodes/ (document) + HANDOFF + EVIDENCE_PLAN + both agent prompts
        │
        ▼
Player inspects prepared build directory; glyph settles at prepared
        │
        ▼
Player clicks build glyph again (second White Move)
        │
        ▼
Builder agent (AGENT_PROMPT.md) via Virtualized Agent Loop
  reads assigned ./osng/ or ./nodes/ inputs → writes primary deliverables at project root
        │
        ▼
Evidence pass (host quote-span / Option E)  ← after builder success (Phase A)
  compact plan metadata + SUD → LM spans → host writes ./evidences/ + EVIDENCE_MANIFEST.json
  (EVIDENCE_AGENT_PROMPT.md remains packaged for audit/manual; not the product CA path)
        │
        ▼
Bud on requesting OSN / Center Bud         ← Phase B (implemented)
        │
        ▼
Build report / cockpit evidence review
```

### 3.0 Prepared instruction snapshot (Lexiom 1.3 prepare)

Prepare freezes the compilation closure into the build directory so the folder is a **standalone agent project**:

| Path under `output_directory` | Role |
|---|---|
| `osng/**/*.osn.yaml` | Software builds: frozen subgraph (layout mirrors `Lexiom_1_3` relative paths) |
| `nodes/nXX.json` | Document builds: deterministic full parsed OSN semantics + compact phase context + source identity/hash; one file per included node |
| `OSNG_Basics_README.md` | Copied primer |
| `HANDOFF.json` | Lexiom audit index (`snapshot_mode`, `snapshot_path` per node, strategy/walk, `evidence_collection` summary, `context_economy` pointer) |
| `BUILD_PLAN.json` | Document builds: outline order, fill clusters, section paths, token budgets |
| `SOURCE_MAP.json` + `sources/<hash>.*` | Document builds: content-addressed `source_spec` documents packaged once |
| `AGENT_PROMPT.md` | Builder protocol; document builds consume only node JSON files assigned to each phase |
| `EVIDENCE_PLAN.json` | Pointer-only evidence index (`targets[]`; no `inspection_prompt` echo) |
| `EVIDENCE_AGENT_PROMPT.md` | Evidence-collector protocol (sibling of the builder prompt) |
| `evidences/` | Created when the host evidence pass writes artifacts |
| `EVIDENCE_MANIFEST.json` | Written by the host evidence pass (status per `target_id`) |

`instruction_read_roots` is `["osng"]` for software builds and `["nodes"]` for document builds — never the live `public/gt2/Lexiom_1_3` tree. Primary deliverables stay at the project root; agents must not mutate either snapshot plane. Evidence files go under `./evidences/` (see §8).

### 3.1 Trigger conditions

Lexiom launches a plugin only when all of the following hold:

1. The player invokes build from a buildable OSN (build glyph / build controls enabled).
2. That OSN (or policy-resolved root) has an associated build plugin.
3. Lexiom supplies a concrete absolute **output directory** path for this run.

If no plugin is associated, the UI may continue to show a disconnected affordance or a local preview only; it must not invent agent side effects.

---

## 4. Plugin identity and association

### 4.1 Plugin ids

| Plugin id | Spec | Artifact class | Typical subgraph shape |
|---|---|---|---|
| `lexiom13.document_builder` | Document Builder Plugin | Prose / policy / narrative documents | Standard ancestor(s) + compilation root + descendants (when scope includes them) |
| `lexiom13.software_coding_builder` | Software Coding Builder Plugin | Executable software / codebase | Standard ancestor(s) + compilation root + discipline descendants (when scope includes them) |

**Subgraph resolution (generic):**

1. Start at `compilation_root_osn_id` (clicked node or policy-resolved root).
2. Include **standard ancestors** when `graph.standard_ancestor_osn_ids` or policy requires them.
3. Include **descendants** per `compilation.compilation_scope`:
   - `self_only` — root only (plus ancestors if policy adds them)
   - `self_and_approved_descendants` — root + recursive `child_osn_ids`
   - `self_plus_parent_context` — root + direct parent(s) per scope rules
4. Exclude tombstoned OSNs and nodes outside the resolved set unless policy explicitly unions branches.

Child traversal order is always `graph.child_osn_ids`. When path prefixes disagree with `graph.*`, **`graph.*` wins**.

### 4.2 Mapping from OSN `compilation` fields

Existing OSN fields remain the association surface until a dedicated plugin field is introduced:

| OSN field | Plugin use |
|---|---|
| `compilation.can_be_compilation_root` | Whether the node may trigger a build root |
| `compilation.compilation_scope` | Default inclusion set when gathering OSNs (`self_only`, `self_and_approved_descendants`, `self_plus_parent_context`) |
| `compilation.target_tool_profile` | Maps to plugin id / profile (e.g. `document_agent` → document builder; `software_coding_agent` or deployment aliases → software-coding builder) |

**Assumption:** Lexiom may later add an explicit `compilation.build_plugin_id` field. Until then, `target_tool_profile` is the association key.

---

## 5. Inputs Lexiom supplies to the plugin

Lexiom (via the plugin) must give the agent at least:

| Input | Description |
|---|---|
| `compilation_root_osn_id` | OSN id of the clicked / policy-chosen root |
| `subgraph` | Resolved set of OSN ids/paths (see §4.1) |
| `strategy_id` | One of the shared compilation-order strategies (§6) |
| `output_directory` | Absolute filesystem path; build project root (write deliverables here; not under `./osng/`) |
| `osng_read_roots` | Snapshot-relative roots granting read access to frozen `*.osn.yaml` (Lexiom 1.3: `["osng"]`) |
| `success_evidence_targets` | Slim list derived from the evidence plan (`osn_id`, `evidence_id`, `direct`, `kind`, `expected_relative_path`) — not full `inspection_prompt` text |
| `evidence_collection` | Pointers + summary for the evidence hemisphere (`plan_path`, `manifest_path`, `evidence_agent_prompt_path`, `artifacts_directory`, counts) |

Optional but recommended:

- `artifact_profile` — primary filenames, format, layout overrides
- `standard_ancestor_osn_ids` — explicit list when policy augments graph links
- Strategy-specific reading plan (precomputed walk order)
- Draft vs approved section flags
- Human-readable build label / run id for the build report

---

## 6. Shared compilation-order strategies

All Lexiom 1.3 build plugins use the same three strategy ids so players and integrators can A/B compare traversal styles.

**Generic node roles** (used in plugin specs):

- **Standard** — organizational-standard ancestor OSN(s)
- **Root** — compilation root OSN
- **Mid / discipline** — non-leaf descendants that structure the artifact
- **Leaf** — terminal descendants with detailed `output_spec` content

### 6.1 `ancestor_first_dfs` — pre-order depth-first

**Walk:** Visit the current node, then recurse each child in `child_osn_ids` order.

**Agent instruction shape:**
1. Ingest Standard / governance constraints first (when included).
2. Apply them while constructing later nodes’ contributions.
3. Emit or refine the artifact continuously as the walk descends.

**Typical in-prompt context:** Root seed + `output_spec` for the current node and its primary-parent chain.  
**On-demand read:** deeper descendants as the walk reaches them.

### 6.2 `descendant_first_dfs` — post-order depth-first

**Walk:** Fully process each child subtree, then emit/synthesize the parent contribution.

**Agent instruction shape:**
1. Produce leaf-level material first.
2. Roll up into parent sections/modules.
3. Finish with Root (and Standard) synthesis and global consistency.

**Typical in-prompt context:** leaf `output_spec` + success evidences.  
**On-demand read:** parents when synthesizing.

### 6.3 `outline_then_fill` — two-pass (optional short third pass)

**Pass 1 (ancestor-first):** Build a skeleton only — TOC, file plan, module map, heading tree — without filling body content.  
**Pass 2 (descendant-first or depth-banded):** Fill leaf/body content into the skeleton.  
**Pass 3 (optional):** Root (+ Standard) reconciliation against success evidences and parent constraints.

**Typical in-prompt context:** Pass 1 = titles, seeds, structural `output_spec` fragments; Pass 2 = full section text for the node being filled.

---

## 7. Agent privileges and invariants

### 7.1 Read / write

| Resource | Access |
|---|---|
| Software OSNG under `./osng/`; document nodes under `./nodes/` | **Read only** (builder and evidence agents) |
| Primary deliverables at project root (`document.md`, software tree, …) | **Write** (builder); **Read** (evidence agent, for inspection) |
| `./evidences/` and `EVIDENCE_MANIFEST.json` | **Write** (evidence agent only); builder must not invent evidence packs |
| `OSNG_Basics_README.md` / `EVIDENCE_PLAN.json` / `HANDOFF.json` / prompts / `RUN_RESULT.json` / document `nodes/**` / `BUILD_PLAN.json` / `SOURCE_MAP.json` / `BUILD_MANIFEST.json` / `sources/**` | Lexiom/GT3-written control files; agents **read only** |
| Canonical live OSN YAML / cockpit session state / evidence-approval maps outside the build dir | **No write** |

The host enforces these boundaries after normalized path resolution; absolute paths, traversal, symlink escape, and writes to immutable files fail closed.

### 7.1.1 Plugin capability policy

| Plugin | Authorized tools |
|---|---|
| `lexiom13.document_builder` | Composition phases: atomic `write_file` submission (host prepares read context and finalizes the required non-empty artifact) |
| `lexiom13.software_coding_builder` | `list_files`, `read_file`, `write_file`, `run_command`, `finish` |

The OpenAI-compatible `tools` array must contain exactly the selected plugin's capabilities. Tool results and the whole run are bounded by the CA worker limits; authorization is host policy, not prompt convention.

### 7.2 Canonicality

- Treat **approved** OSN sections as binding instruction when Lexiom marks them in-scope.
- Treat unapproved draft sections as non-binding proposals; if the plugin includes them, label them clearly as draft.
- Do not invent factual, legal, market, or product claims unsupported by included OSN text.
- Black/agent output remains non-canonical for Lexiom until a human White Move accepts it in the cockpit (per constitutional draft-first rules).
- Evidence **collection** (`collected` in the manifest) is not owner **approval**; approval remains a cockpit White Move (System Description §4.4).

### 7.3 Build report

Each run should produce a short report under the output directory (for example `BUILD_REPORT.md`) stating:

- plugin id, strategy id, compilation root
- OSN ids included
- primary artifact paths written
- known gaps / skipped draft-only nodes
- whether Pass 3 reconciliation ran (`outline_then_fill` only)
- optional pointer to evidence plan/manifest summary when the evidence pass has run

---

## 8. Evidence collection hemisphere

Evidence collection is a **shared second pass** for all build plugins. It is not folded into the builder prompt. Plan packaging lives in `lib/lexiom13BuildEvidence.js`; product collection is host Option E in `lib/lexiom13EvidenceSpanCollect.js`. Kinds and direct/derivative rules are governed by [System Description §4.4](../Lexiom_1.3.3_System_Description.md).

### 8.1 Separation of agents

| Pass | Prompt / runtime | Responsibility |
|---|---|---|
| Builder | `AGENT_PROMPT.md` (CA Real Bolt loop) | Produce the primary SUD / deliverable; **out of scope:** writing evidence artifacts |
| Evidence collector | Host Option E (`lib/lexiom13EvidenceSpanCollect.js`); `EVIDENCE_AGENT_PROMPT.md` packaged for audit | For every plan target, produce or defer an inspection artifact under `./evidences/` and record status in `EVIDENCE_MANIFEST.json` via quote spans for `TEXTUAL_SNIPPET` (non-span kinds → `deferred`) |

Order: **builder first**, then evidence. The evidence pass may inspect primary deliverables; it must not re-author the product document or software tree as its main job.

### 8.2 Plan packaging (prepare)

At prepare, Lexiom walks every `success_evidences[]` entry on OSNs in the compilation closure and writes **pointer-only** `EVIDENCE_PLAN.json` (`schema_version`: `lexiom13-evidence-collection/1`).

Each `targets[]` row includes at least:

| Field | Meaning |
|---|---|
| `target_id` | `{osn_id}::{evidence_id}` (unique in the closure) |
| `osn_id` / `osn_file_name` | Owning OSN |
| `snapshot_path` | Path under this project to the frozen YAML |
| `evidence_id` / `kind` / `direct` | From the OSN entry (`kind` canonicalized; see §8.4) |
| `expected_relative_path` | Where the artifact should land |
| `preferred_extension` | Derived from kind |

**Intentionally omitted from the plan:** `inspection_prompt`, `seed`, `output_spec`, and any other OSN body text. The evidence agent must open `snapshot_path` and read those fields from YAML.

Duplicate `target_id` values or missing `evidence_id` fail prepare.

### 8.3 Artifact naming

Under `./evidences/`:

```text
{osn.file_name}.{evidence_id}.v1.{ext}
```

Example: `GT_Philosophy.BrandLexiom.a1000005.osn.SE-01.v1.md`  
Association is recoverable from the filename alone (see `OSNG_Basics_README.md`). Collection version suffix is currently `v1`.

### 8.4 Kinds (cross-link)

Supported **direct** enumerators (case-sensitive) are defined in System Description §4.4:

- `TEXTUAL_SNIPPET`
- `SCREEN-SHOT`
- `VIDEO-CLIP`

Runtime may accept legacy aliases (`direct_document_review`, `direct_code_snippet`, `screenshot`, `video_clip`, …) when reading older YAML; live OSNs should use the canonical strings. Derivative targets (`direct: false`) may use other kinds (e.g. briefs) and never satisfy the direct minimum.

**Hard ban (shared with §4.4):** OSN specification text (`seed`, lenses, `output_spec`, evidence definitions) must never be used as **direct** evidence.

### 8.5 Manifest and status vocabulary

The host evidence pass writes `EVIDENCE_MANIFEST.json` covering **every** `target_id` from the plan. Suggested per-entry fields: `target_id`, `osn_id`, `evidence_id`, `direct`, `kind`, `status`, `artifact_paths`, optional `source_artifact_paths`, `notes`, `collected_by: "host_span"` (Option E).

| Status | Meaning |
|---|---|
| `collected` | Artifact exists at the expected path (or an allowed primary-artifact reference is recorded); **not** owner approval |
| `deferred` | Cannot collect now; include concrete human-capture / follow-up notes |
| `failed` | Attempted but did not produce a usable artifact |
| `not_applicable` | Only when the delivered SUD truly cannot host this inspection (explain why) |

### 8.6 Hard bans (evidence agent)

- Do not fabricate screenshots, videos, metrics, or passing test results.
- Do not use OSN specification text as direct evidence.
- Do not claim human approval or mutate canonical Lexiom state outside this build directory.
- Do not paste or paraphrase OSN bodies into the manifest; point at paths and statuses.
- Do not treat evidence collection as part of `AGENT_PROMPT.md`.

### 8.7 Evidence prompt package shape

`EVIDENCE_AGENT_PROMPT.md` is a slim protocol (paths + rules), not an echo of inspection prompts:

1. Project setup — cwd = build dir; plan + `./osng/`
2. Role — evidence collector, not second product author
3. Scope — process every `targets[]` row
4. Per-target procedure — plan row → open YAML → read `inspection_prompt` → write `expected_relative_path` or status
5. Status vocabulary + hard bans
6. Short **plugin-specific capture hints** (document vs software; see companion specs)
7. Required `EVIDENCE_MANIFEST.json` coverage

### 8.8 Success bar (evidence pass)

1. `EVIDENCE_PLAN.json` exists and matches closure membership used for the build.
2. `EVIDENCE_MANIFEST.json` has one row per plan `target_id`.
3. Every `collected` direct target points at delivered-outcome material (or an allowed primary-artifact reference), never at OSN YAML bodies.
4. Unsupported automated capture is `deferred` with notes — not fake media.
5. Gaps are honest; collection status is distinct from cockpit evidence approval.

---

## 9. Outputs

| Output | Description |
|---|---|
| Primary artifact(s) | Plugin-defined under `output_directory` (document pack or software tree per plugin spec) |
| `BUILD_REPORT.md` | Run metadata and gaps |
| Optional intermediate plans | e.g. `OUTLINE.md` / `FILE_PLAN.md` when using `outline_then_fill` |
| `EVIDENCE_PLAN.json` | Pointer index for the evidence pass (prepare) |
| `EVIDENCE_AGENT_PROMPT.md` | Evidence-collector instructions (prepare) |
| `evidences/**` | Collected evidence artifacts (evidence pass) |
| `EVIDENCE_MANIFEST.json` | Per-target collection status (evidence pass) |

Lexiom stages collected evidence into the cockpit Right Panel via Focus-closure polling — see [Lexiom_1_3_Evidence_Cockpit_Sync_1_0.md](Lexiom_1_3_Evidence_Cockpit_Sync_1_0.md). Primary-artifact Center staging beyond that sync remains out of scope for this contract.

---

## 10. Prompt package shape (common)

Plugins should assemble **builder** instructions as a **slim traversal protocol** against the **snapshot-copy project**, not an id dump or inline OSN bodies:

1. **Project setup** — open `output_directory` as cwd; OSNs live under `./osng/`
2. **Role + privileges** — read `./osng/` only (read-only); write primary deliverables at project root; **do not** collect evidence in this pass
3. **OSN structure primer** — learn fields and inter-relations primarily from the compilation-root `*.osn.yaml` **leading comment header**, with copied `./OSNG_Basics_README.md` as the filesystem companion
4. **Compilation root + closure** — root id + `./osng/…` path; only snapshotted files participate; discover via `graph.*`
5. **Strategy preamble** — strategy id and how to walk via `graph.child_osn_ids` / `parent_osn_ids` (no full path list in the prompt)
6. **Artifact contract** — filenames, format, completeness bar (`artifact_profile` when set)
7. **Hard non-goals** — plugin-specific (including no mutation of `./osng/`; no evidence fabrication here)
8. **Defer evidence** — point at sibling `EVIDENCE_AGENT_PROMPT.md` + `EVIDENCE_PLAN.json` for the post-build evidence pass
9. **Optional check** — point at `HANDOFF.json` for Lexiom’s frozen subgraph / walk_plan / `evidence_collection` summary (audit), without pasting that set into the prompt

`HANDOFF.json` remains the machine index for the run (`snapshot_mode`, subgraph with `snapshot_path`, walk_plan, evidence summary). Exact narrative templates live in `lib/lexiom13BuildPlugins.js` and `lib/lexiom13BuildEvidence.js`.

---

## 11. Out of scope for this contract

- Multi-tenant Docker isolation beyond a local `builds/lexiom13/` directory (see Virtualized Agent Loop)
- Cockpit UI for choosing strategy ids (defaults are applied server-side)
- Staging built primary artifacts into Center Playfield beyond Right-Panel evidence sync ([Evidence Cockpit Sync](Lexiom_1_3_Evidence_Cockpit_Sync_1_0.md)) — **in overall delivery via** [../Lexiom_1_3_Center_Playfield_Build_Artifact_Review_UX_Spec_1_0.md](../Lexiom_1_3_Center_Playfield_Build_Artifact_Review_UX_Spec_1_0.md) (`bud` section); not part of prepare packaging alone
- Alternate executors; `aider_docker` remains Follow-up capacity under the VAL/CA contracts

---

## 12. Open questions

1. Whether strategy selection is a player White Move, a plugin default, or a policy-layer setting.
2. Whether the agent must consult `HANDOFF.json` for frozen membership or may rely solely on graph.* closure rules from the compilation root.
3. Whether `target_tool_profile` should allow multiple aliases mapping to the same plugin id across deployments.
4. **Resolved (Phase A / Option E + Phase B):** `/run` auto-runs host quote-span evidence after a successful builder pass, then Lexiom/GT3 writes `bud` and Ops `bud_written` ([Virtualized Agent Loop](Lexiom_1_3_Virtualized_Agent_Loop_1_0.md) §4 / §7; [Center Bud Review](../Lexiom_1_3_Center_Playfield_Build_Artifact_Review_UX_Spec_1_0.md)). Missing/invalid spans fail the evidence pass (no heuristic fallback).
5. How collected evidence files are staged into cockpit approval without conflating `collected` with owner-approved.

---

## Appendix A — Reference deployment (Lexiom 1.3)

*Illustrative only; not part of the generic contract.*

| Plugin | Example association (current repo) |
|---|---|
| Document builder | Standard: `GT_Philosophy.a1000001.osn`; Root: `GT_Philosophy.BrandLexiom.a1000005.osn` with `can_be_compilation_root: true`, `compilation_scope: self_and_approved_descendants`, `target_tool_profile: document_agent` |
| Software-coding builder | Standard: `GT_Philosophy.a1000001.osn`; Root: `GT_Philosophy.ProductLexiom.a1000002.osn` with `can_be_compilation_root: true`, `compilation_scope: self_and_approved_descendants`, `target_tool_profile: static_spa_coding_agent` as one profile alias |

These examples show how Lexiom 1.3 maps two sibling branches to two plugin types. Other deployments may use different OSN ids, profiles, and artifact names without changing this contract.
