# Lexiom 1.3 — Software Coding Builder Plugin (v1.0)

**Status:** Real Bolt software loop implemented; default strategy `ancestor_first_dfs`  
**Plugin id:** `lexiom13.software_coding_builder`  
**Proposed `target_tool_profile`:** `software_coding_agent`  
**Parent contract:** [Lexiom_1_3_Build_Plugin_Contract_1_0.md](Lexiom_1_3_Build_Plugin_Contract_1_0.md)  
**Executor:** [Lexiom_1_3_Virtualized_Agent_Loop_1_0.md](Lexiom_1_3_Virtualized_Agent_Loop_1_0.md)

---

## 1. Purpose

Enable Lexiom to instruct an agent to **generate a software codebase** from an approved OSN instruction subgraph.

The agent has **read-only** access to the frozen OSNG snapshot under `./osng/` (see Build Plugin Contract §3.0) and may **write only** deliverables at the Lexiom-supplied output directory project root (not into `./osng/`).

This plugin is **stack-agnostic**: it implements whatever runtime, UI, and file architecture the included OSNs describe — not a fixed stack (static SPA, mobile app, service backend, etc.). Default examples below assume a simple web client when the root `output_spec` does not specify otherwise.

---

## 2. Known divergence (Lexiom 1.3 SPA)

- Runtime: `POST /lexiom13/build/prepare` + `POST /lexiom13/build/run` with software packager (`AGENT_PROMPT.md`, primary SPA tree + `BUILD_REPORT.md` when the agent completes).
- Prepare also writes `EVIDENCE_PLAN.json` + `EVIDENCE_AGENT_PROMPT.md` (shared evidence hemisphere — see Build Plugin Contract §8).
- Profile alias `static_spa_coding_agent` maps to this plugin.
- **Current executor:** Virtualized Agent Loop with **`ca_location: browser_session`** + **`bolt_webcontainer`** (append-only OpenAI-compatible tool loop + GT3 ↔ OpenRouter ↔ Claude). On failure: structured errors/logs — no fake stubs or alternate executor.
- **Known divergence:** Evidence auto-chain (Phase A / Option E host quote-span) and Phase B `bud` are implemented; `aider_docker` remains Follow-up executor capacity only. Host completion gates on primary HTML + referenced local assets, not on `BUILD_REPORT.md`.
- A build run must treat OSNs as the instruction source for the **artifact under `output_directory`**, not as a license to silently rewrite canonical OSN files outside that directory.
- See [Appendix A](#appendix-a-reference-deployment-lexiom-13) for one Lexiom 1.3 deployment example only.

---

## 3. Scope

### 3.1 Plugin configuration (Lexiom → plugin)

Lexiom resolves these at trigger time:

| Parameter | Description |
|---|---|
| `compilation_root_osn_id` | OSN the player clicked (or policy-resolved root) |
| `compilation_scope` | From root OSN `compilation.compilation_scope` |
| `standard_ancestor_osn_ids` | Organizational standards to include (from graph + policy) |
| `strategy_id` | One of the shared compilation-order strategies |
| `output_directory` | Absolute write path for this run |
| `artifact_profile` | Optional override for entrypoints, module layout, and runtime type |

The plugin does **not** hard-code product names, discipline labels (UX, CodeShape, etc.), or cockpit-specific regions unless they appear in the resolved subgraph.

### 3.2 Instruction subgraph (generic)

Include OSNs according to `compilation_scope` and policy:

1. **Standard ancestors** (when required) — governance and reusable constraints.
2. **Compilation root** — product or implementation branch root.
3. **Descendants** — discipline and sub-discipline OSNs reachable via `graph.child_osn_ids` when scope includes descendants.

Exclude:

- Tombstoned OSNs
- OSNs outside the resolved subgraph unless policy unions them
- Demo evidence artifacts copied blindly as source code (inspection targets only, unless an OSN says otherwise)

### 3.3 Default artifact contract

Write under `output_directory`:

| Path | Role |
|---|---|
| Entry artifact(s) | As declared by root or code-discipline `output_spec` (e.g. `index.html`, `main.py`, `package.json`) |
| Application modules | Supporting source files implied by included OSNs |
| `FILE_PLAN.md` | Required when strategy is `outline_then_fill` |
| `BUILD_REPORT.md` | Run metadata, inclusion list, gaps |

**Default when unspecified:** a runnable static web client (`index.html` + script + stylesheet) is a reasonable fallback for Lexiom-style cockpit POCs, but the binding contract is always the compilation root and descendant `output_spec` text — not this default.

The artifact must be **runnable or inspectable** in the way the included `success_evidences` describe (screenshot, video, snippet review, etc.).

### 3.4 Agent role

Software coding agent. Implements interaction, product, and implementation contracts from the subgraph. Not an OSN editor. Not a document author.

---

## 4. Prompt package (software-specific)

Assemble a **traversal protocol** per contract §9 (paths + strategy — not inlined OSN bodies). OSN field semantics and graph inter-relations come primarily from each file’s leading `#` comment header (+ `OSNG_Basics_README.md`).

Coding rules once the agent opens YAML on disk:

1. **Draft-first / human governance** — Do not invent silent canonical mutation where OSNs require explicit approval.
2. **Spatial / interaction contracts** — Honor layout and interaction OSNs (however labeled) when implementing user-facing behavior.
3. **Semantic source** — Prefer patterns that load or reflect OSN-defined configuration over hard-coded product copy when implementation OSNs require it.
4. **No unauthorized scope** — Do not invent backends, auth, billing, collaboration, or persistence absent from included OSNs.
5. **Write confinement** — Create/modify files only under `output_directory`.
6. **Success evidences** — Align delivered behavior with inspection prompts in included OSNs.

### 4.1 Canonical sections to extract per OSN (from disk)

Prefer, when present and in-scope (after reading the OSN header):

- `seed`
- `thematic_lenses`
- `output_spec` (primary implementation contract)
- `success_evidences`
- `compilation` (scope and tool profile)

### 4.2 Conflict precedence (when Concordance is unavailable)

When discipline OSNs disagree, apply in order (record unresolved items in `BUILD_REPORT.md`):

1. Standard ancestor invariants (governance, approval, evidence)
2. Compilation root product outcome / in-scope list
3. Interaction / experience discipline OSNs (layout, flows, panels)
4. Implementation / code-shape discipline OSNs (files, state, routes, build rules)

Node **roles** are determined by `node_type`, `discipline`, and `output_spec` — not by fixed names like “UX” or “CodeShape.”

### 4.3 Real Bolt capability policy

The software builder receives exactly `list_files`, `read_file`, `write_file`, `run_command`, and `finish`.

- File and command effects are confined to the prepared WebContainer project.
- `osng/**`, `OSNG_Basics_README.md`, `HANDOFF.json`, `AGENT_PROMPT.md`, `EVIDENCE_PLAN.json`, `EVIDENCE_AGENT_PROMPT.md`, and `RUN_RESULT.json` are immutable.
- `run_command` is limited to `node`, `npm`, and `npx`, with bounded duration and captured output; it must not provide a path or process escape from the workspace.
- Reads, listings, model steps, tool actions, no-progress turns, per-result characters, and wall-clock time are bounded by the CA worker limits.
- `finish` requests host validation; it is not success by declaration. The host must validate the configured entry artifact/primary HTML and its referenced local assets before `completed`; `BUILD_REPORT.md` remains a plugin-level success obligation.
- A model stop without `finish`, a disallowed tool call, exhausted budget, command failure chosen as terminal by the agent/host, or failed validation ends in an explicit non-success terminal state.

---

## 5. Compilation-order strategies (software-coding builder)

Shared strategy definitions live in the [Build Plugin Contract](Lexiom_1_3_Build_Plugin_Contract_1_0.md) §6. Below: **software-specific** traversal, context packing, pros/cons, and recommendation — using generic node roles only.

**Generic roles:**

- **Standard** — organizational-standard ancestor OSN(s)
- **Root** — compilation root (product / application outcome)
- **Experience** — descendant OSNs governing interaction, layout, and user-visible behavior
- **Implementation** — descendant OSNs governing files, state, runtime, and build mechanics
- **Leaf** — terminal descendants under either branch

A subgraph may have zero, one, or many Experience and Implementation nodes; traversal follows `child_osn_ids` order on each node.

### 5.1 `ancestor_first_dfs` (recommended first)

**How the agent traverses**

1. Read Standard(s) (governance invariants).
2. Read Root (product outcome, in/out of scope).
3. Pre-order DFS through descendants — typically Experience before Implementation when listed first under Root — implementing in constraint order: **why → what → how it feels → how it is built**.

**In-prompt vs on-demand**

- In-prompt: Standard + Root + the node currently being implemented.
- On-demand: sibling disciplines before final integration.

**Pros**

- Governance and product scope constrain implementation early.
- Matches human reasoning order; fewer unauthorized features.
- Works well for shallow subgraphs without outline overhead.
- Natural fit for greenfield output directories.

**Cons**

- Experience implemented before Implementation may require file/module rework.
- Long `output_spec` texts still pressure context.
- Less explicit checkpoint than a FILE_PLAN pass.

**When to try**

**Default first strategy** for full greenfield builds from Root with Experience + Implementation descendants.

---

### 5.2 `descendant_first_dfs`

**How the agent traverses**

1. Implement from Leaf / Implementation / Experience modules upward.
2. Wrap with Root shell behavior.
3. Apply Standard checks last (approval gates, evidence hooks, no silent mutation).

**In-prompt vs on-demand**

- In-prompt: active leaf or discipline `output_spec`.
- On-demand: Root / Standard during integration.

**Pros**

- Useful when regenerating one discipline against an existing shell in `output_directory`.
- Encourages modular files aligned to discipline OSNs.
- Surfaces implementation constraints as concrete modules early.

**Cons**

- Easy to over-build infrastructure Root marks out of scope.
- Governance flows may be bolted on late.
- Higher integration risk than ancestor-first on greenfield runs.

**When to try**

Discipline-scoped rebuilds when a prior Root shell already exists in the output directory.

---

### 5.3 `outline_then_fill`

**How the agent traverses**

**Pass 1 — File plan (ancestor-first):**
1. Walk Standard → Root → descendants (Experience and Implementation).
2. Emit `FILE_PLAN.md`: entrypoints, modules, responsibilities, owning OSN ids.
3. Do not write production code yet (stubs optional).

**Pass 2 — Implement (descendant-first or module-by-module):**
1. Fill modules per FILE_PLAN, reading the owning OSN’s full `output_spec`.
2. Prefer separating interaction surfaces and runtime modules as the plan dictates.

**Pass 3 — Reconcile (short):**
1. Verify Root in/out of scope.
2. Smoke-check scenarios implied by included `success_evidences`.
3. Note gaps in `BUILD_REPORT.md`.

**In-prompt vs on-demand**

- Pass 1: seeds + structural requirements.
- Pass 2: full `output_spec` for the module under work.
- Pass 3: Root + FILE_PLAN + failing checks.

**Pros**

- Clear module boundaries before code volume.
- Better as subgraph depth grows.
- Human-reviewable plan checkpoint.

**Cons**

- Extra pass cost on shallow graphs.
- FILE_PLAN may rubber-stamp an existing layout without questioning Root scope.
- Overkill for small experimental builds.

**When to try**

When the agent should emit an explicit file plan before coding, or when the descendant tree is deep.

---

## 6. Recommendation

| Situation | Strategy to try first |
|---|---|
| Full greenfield build from Root | **`ancestor_first_dfs`** |
| Need an explicit module map before coding | `outline_then_fill` |
| Regenerate one discipline against an existing shell | `descendant_first_dfs` |

**Primary recommendation:** start with `ancestor_first_dfs`. Standard and Root constraints should land before Experience and Implementation work; shallow product subgraphs often fit a single constrained pass. Prefer `outline_then_fill` when a file-plan checkpoint is valuable; prefer `descendant_first_dfs` only for discipline regeneration against a stable shell.

---

## 7. Non-goals

- Silently overwriting canonical OSN YAML or live product trees outside `output_directory`
- Inventing backends, auth, billing, or persistence not required by included OSNs
- Treating in-cockpit Build preview text as already-built software
- Compiling document artifacts (use the document builder plugin)
- Autonomous canonization of generated code into Lexiom provenance without human review

---

## 8. Success bar (plugin-level)

A run is structurally successful when:

1. The agent called `finish`, syncOut completed, and entry artifact(s) declared in FILE_PLAN or Root `output_spec` run from `output_directory`.
2. `BUILD_REPORT.md` lists included OSN ids, strategy id, and primary files written.
3. Behavior respects Root out-of-scope constraints.
4. User-visible requirements from Experience OSNs are present at least in minimal form.
5. Implementation constraints from Implementation OSNs that are in-scope are reflected in the generated design.
6. Gaps versus `success_evidences` are listed honestly.

Builder success above does not require the evidence pass to have completed; evidence success is [Build Plugin Contract §8.8](Lexiom_1_3_Build_Plugin_Contract_1_0.md#88-success-bar-evidence-pass).

---

## 9. Evidence collection (plugin-specific notes)

Shared contract: [Build Plugin Contract §8](Lexiom_1_3_Build_Plugin_Contract_1_0.md#8-evidence-collection-hemisphere). This plugin only adds capture hints:

- Prefer excerpts from the **delivered tree** for `TEXTUAL_SNIPPET` (including legacy `direct_code_snippet`) — never OSN `output_spec` text.
- Use browser / UI capture when feasible for `SCREEN-SHOT` / `VIDEO-CLIP` against the built entrypoint (e.g. static preview on the builds port).
- If automated capture is unavailable, mark those targets `deferred` with a concrete human-capture procedure — do **not** invent media files.
- Derivative briefs: write under `./evidences/` from delivered behavior + OSNG; never substitute them for missing direct evidence.

---

## 10. Future wiring notes

Runtime is live via `POST /lexiom13/build/prepare` and `POST /lexiom13/build/run`.

Profile mapping includes `software_coding_agent` and aliases such as `static_spa_coding_agent`.

Remaining polish:
1. Strategy picker UI as an explicit White Move.
2. Stage delivered SUD via OSN `bud` + Center Bud mode — [../Lexiom_1_3_Center_Playfield_Build_Artifact_Review_UX_Spec_1_0.md](../Lexiom_1_3_Center_Playfield_Build_Artifact_Review_UX_Spec_1_0.md).
3. Deliver and validate the append-only Real Bolt software loop per [Lexiom_1_3_Virtualized_Agent_Loop_1_0.md](Lexiom_1_3_Virtualized_Agent_Loop_1_0.md); evidence auto-chain is Phase A / Option E host quote-span; `bud` is Phase B (both implemented).

---

## Appendix A — Reference deployment (Lexiom 1.3)

*Illustrative only; not part of the generic contract.*

| Role | Example OSN (Lexiom 1.3) |
|---|---|
| Standard | `GT_Philosophy.a1000001.osn` |
| Root | `GT_Philosophy.ProductLexiom.a1000002.osn` |
| Experience | `GT_Philosophy.ProductLexiom.UX.a1000003.osn` |
| Implementation | `GT_Philosophy.ProductLexiom.CodeShape.a1000004.osn` |

ProductLexiom currently declares `can_be_compilation_root: true`, `compilation_scope: self_and_approved_descendants`, and `target_tool_profile: static_spa_coding_agent` as one association alias for this plugin. The Lexiom 1.3 POC’s Implementation OSN describes the existing cockpit codebase; a build run targets `output_directory`, not silent rewrite of that canonical tree.
