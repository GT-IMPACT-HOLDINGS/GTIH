# Lexiom 1.3 — Document Builder Plugin (v1.0)

**Status:** Real Bolt document loop implemented; default strategy `outline_then_fill`  
**Plugin id:** `lexiom13.document_builder`  
**Proposed `target_tool_profile`:** `document_agent`  
**Parent contract:** [Lexiom_1_3_Build_Plugin_Contract_1_0.md](Lexiom_1_3_Build_Plugin_Contract_1_0.md)  
**Executor:** [Lexiom_1_3_Virtualized_Agent_Loop_1_0.md](Lexiom_1_3_Virtualized_Agent_Loop_1_0.md)

---

## 1. Purpose

Enable Lexiom to instruct an agent to **generate a document artifact pack** from an approved OSN instruction subgraph.

The agent has **read-only** access to normalized prepared OSN nodes under `./nodes/` (see Build Plugin Contract §3.0) and may **write only** deliverables at the Lexiom-supplied output-directory project root (not into `./nodes/`).

This plugin is **domain-agnostic**: it compiles whatever prose, policy, narrative, or specification content the included OSNs describe — not a fixed document genre (brand book, legal brief, policy manual, etc.). The document shape comes from the compilation root’s `output_spec`, `success_evidences`, and descendant OSNs.

**Outcome cleanliness (non-negotiable):** the delivered reader-facing document must read as a finished organizational/product document. It must **not** expose, cite, or otherwise leave traces of the OSN Graph (OSNG) that generated it. OSNG is an internal instruction source; the outcome document is the public-facing artifact. See [§3.5](#35-outcome-document-cleanliness-no-osng-traces).

---

## 2. Known divergence (Lexiom 1.3 SPA)

- Runtime: `POST /lexiom13/build/prepare` + `POST /lexiom13/build/run` with document packager (`document.md`, `OUTLINE.md` when using `outline_then_fill`, `sections/**` from deterministic fill clusters).
- Prepare also writes `EVIDENCE_PLAN.json` + `EVIDENCE_AGENT_PROMPT.md` (shared evidence hemisphere — see Build Plugin Contract §8) and the context-economy pack (`nodes/nXX.json`, `BUILD_PLAN.json`, `SOURCE_MAP.json`, `sources/**`). Each node file carries the complete parsed OSN object, compact phase context, and source-YAML provenance/hash; `BUILD_PLAN.json` maps short keys to files. `SOURCE_MAP.json` records markdown section offsets so fill packets load only the top-level sections named by participating `source_spec` references.

Fill packets compact every participating node uniformly, lift shared policy without repeating provenance-key lists, and fit source excerpts/node detail deterministically against the crossing ceiling before LM admission.
- **Current executor:** Virtualized Agent Loop with **`ca_location: browser_session`** + **`bolt_webcontainer`**. Document composition uses a **phase-fresh** orchestrator (outline → clustered fills → host assembly of `document.md` → optional reconcile) with GT3 ↔ OpenRouter ↔ Claude; validation gates outline (when required), section coverage/cleanliness, and assembly equality after syncOut. On failure: structured errors/logs — no fake stubs or alternate executor.
- **Known divergence:** Evidence auto-chain (Phase A / Option E host quote-span) and Phase B `bud` are implemented; `aider_docker` remains Follow-up executor capacity only. Authoritative provenance is machine-written `BUILD_MANIFEST.json` + deterministic `BUILD_REPORT.md` (agent `BUILD_NOTES.md` may be preserved as notes).
- See [Appendix A](#appendix-a-reference-deployment-lexiom-13) for one Lexiom 1.3 deployment example only.

---

## 3. Scope

### 3.1 Plugin configuration (Lexiom → plugin)

Lexiom resolves these at trigger time:

| Parameter | Description |
|---|---|
| `compilation_root_osn_id` | OSN the player clicked (or policy-resolved root) |
| `compilation_scope` | From root OSN `compilation.compilation_scope` (see contract) |
| `standard_ancestor_osn_ids` | Organizational / cross-cutting standards to include (from `graph.standard_ancestor_osn_ids` and policy) |
| `strategy_id` | One of the shared compilation-order strategies |
| `output_directory` | Absolute write path for this run |
| `artifact_profile` | Optional override for primary filename, format, and multi-file layout (defaults in §3.3) |

The plugin does **not** hard-code a branch name, product name, or domain vocabulary.

### 3.2 Instruction subgraph (generic)

Include OSNs according to `compilation_scope` and policy:

1. **Standard ancestors** (when policy or scope requires) — reusable organizational constraints.
2. **Compilation root** — the triggered OSN.
3. **Descendants** — every live child reachable recursively via `graph.child_osn_ids` from the root when scope includes descendants.

Exclude:

- Tombstoned `*.tomb.osn.yaml`
- OSNs outside the resolved subgraph (sibling branches, unrelated roots) unless policy explicitly unions them
- Demo evidence files as canonical instruction (they are inspection targets, not source text)

Child order is always `graph.child_osn_ids` on each node.

### 3.3 Default artifact contract

Write under `output_directory`:

| Path | Role |
|---|---|
| `document.md` | Primary delivered document (single-file default) |
| `OUTLINE.md` | Required when strategy is `outline_then_fill` (Pass 1 skeleton) |
| `BUILD_REPORT.md` | Run metadata, inclusion list, gaps |

**Multi-file pack (allowed):** the agent may emit a `sections/` (or similarly named) directory when the outline or root `output_spec` demands it, provided `document.md` remains a coherent entry document (full text or master index).

**Format:** default markdown unless `artifact_profile` or the compilation root `output_spec` specifies another deliverable (e.g. structured sections for later PDF export). The plugin does not mandate a genre-specific filename such as “branding book.”

### 3.4 Agent role

Document author / compiler. Not a coding agent. Not an OSN editor.

### 3.5 Outcome document cleanliness (no OSNG traces)

The **reader-facing outcome** is `document.md` and any multi-file body under `sections/` (or equivalent paths named by `artifact_profile` / root `output_spec`). Those files are the published document. They must be **clean of the generating data structure**.

#### 3.5.1 What must stay clean

| Artifact | Cleanliness rule |
|---|---|
| `document.md` | **Must** contain zero OSNG/OSN process traces (rules below) |
| `sections/**` (or other body pack files) | **Same** as `document.md` |
| `OUTLINE.md` | Lexiom **scaffold only** — may retain owning OSN ids for process/audit; **must not** be presented as the published document; its OSN ids must not be copied into the outcome body |
| `BUILD_REPORT.md` | Lexiom **provenance / run metadata** — OSN ids, strategy, gaps belong here, **not** in the outcome body |

#### 3.5.2 Forbidden in the outcome document

Do **not** place any of the following in `document.md` / body pack files (including headings, footnotes, appendices, captions, or “sources” sections meant for end readers):

1. **Identity / filesystem** — OSN `id`, `file_name`, `*.osn.yaml` paths, `./osng/…` paths, public Lexiom OSN URLs, or run ids / `HANDOFF.json` references.
2. **Schema / field names as prose** — `output_spec`, `seed`, `thematic_lenses`, `success_evidences`, `graph.child_osn_ids`, `graph.parent_osn_ids`, `standard_ancestor_osn_ids`, `compilation_root`, `compilation_scope`, `node_type`, `discipline`, or similar OSNG vocabulary used as labels or citations.
3. **Graph / process meta** — phrases that reveal generation machinery, e.g. “per the parent OSN”, “compiled from the BrandLexiom subgraph”, “this leaf requires…”, “according to `…a1000005.osn`”, “OSNG says…”, “success evidence SE-…”, walk-plan / strategy ids, snapshot-mode language.
4. **Scaffold leakage** — copying `OUTLINE.md` owning-OSN columns, `BUILD_REPORT` provenance tables, or agent-prompt instructions into the reader-facing body.
5. **Internal product names as source attribution** — naming Lexiom, OSNG, or “instruction nodes” as the authority for a claim (write the claim as organizational/product voice instead).

#### 3.5.3 Required voice

- Write as the **finished document** the root `output_spec` asks for (policy, brand book, narrative, etc.), in normal domain language.
- Use OSNs only as **hidden instructions**: extract meaning, then emit prose that a reader could accept without knowing OSNG exists.
- If an OSN’s text itself contains OSNG jargon meant only for agents, **translate** it into domain prose; do not paste agent-facing instruction language into the outcome.
- Domain vocabulary that is *content* (e.g. a brand’s own use of “seed story”) is allowed when it is the subject matter — not when it is citing OSNG field names.

#### 3.5.4 Where provenance belongs

- Map “which OSN informed which section” **only** in `BUILD_REPORT.md` (and optionally `OUTLINE.md` during Pass 1).
- Success-evidence inspection remains a Lexiom/cockpit concern against the clean document; the document itself does not cite evidence ids.

#### 3.5.5 Pass 3 cleanliness check

On the reconcile pass (and before declaring success), the agent must scan the outcome body for the forbidden patterns in §3.5.2 and remove/rewrite any hits. Residual OSNG traces in the outcome are a **plugin failure**, even if content coverage is otherwise good.

---

## 4. Prompt package (document-specific)

Assemble a **traversal protocol** per contract §9 (paths + strategy — not inlined OSN bodies). OSN field semantics and graph inter-relations come primarily from each file’s leading `#` comment header (+ `OSNG_Basics_README.md`).

Document rules once the agent opens YAML on disk:

1. **Claims discipline** — Do not invent factual, regulatory, numerical, or performance claims absent from included OSN text.
2. **Proposal vs approved** — When OSNs distinguish drafts from approved truth, preserve that distinction in the delivered document **in domain language** (e.g. “proposed” / “approved”), not by citing OSN draft fields.
3. **Section mapping** — Prefer one major section per mid-level OSN cluster in the subgraph, with leaf OSNs filling subsections — mapping is internal; section titles in the outcome must be reader-facing, not OSN ids.
4. **Success evidences** — The final pack must be inspectable against included OSNs’ `success_evidences` (especially those calling for direct document review); do not embed evidence ids in the outcome body.
5. **Source attribution** — In `BUILD_REPORT.md` only, list which OSN ids informed which sections. **Never** put that attribution in `document.md` / `sections/`.
6. **Outcome cleanliness** — Enforce §3.5 in full: the reader-facing document must be free of OSNG/OSN traces.

### 4.1 Canonical sections to extract per OSN (from disk)

Prefer, when present and in-scope (after reading the OSN header):

- `seed`
- `thematic_lenses` (professional framing, not filler alone)
- `output_spec` (primary instructional body)
- `success_evidences` (inspection targets for the delivered document)

These fields are **inputs to the agent**, not labels or headings for the published document.

### 4.2 Real Bolt capability policy

Each document composition phase receives a complete host-built packet and exactly `write_file`. It receives neither workspace discovery/read tools, explicit `finish`, nor `run_command`; host orchestration owns prepared-node/source reads and atomically completes the phase after validating its required non-empty write.

- Reads are bounded and confined to the prepared project.
- Writes are bounded and confined to document deliverables at the project root/body-pack paths.
- `nodes/**`, `OSNG_Basics_README.md`, `HANDOFF.json`, `AGENT_PROMPT.md`, `EVIDENCE_PLAN.json`, `EVIDENCE_AGENT_PROMPT.md`, `RUN_RESULT.json`, `BUILD_PLAN.json`, `SOURCE_MAP.json`, `BUILD_MANIFEST.json`, and `sources/**` are immutable.
- `finish` requests host validation; it is not success by declaration. The host must verify the configured primary document, required `OUTLINE.md` (for `outline_then_fill`), planned `sections/**` coverage and cleanliness, deterministic assembly equality with `document.md`, and §3.5 cleanliness before `completed`. Machine `BUILD_MANIFEST.json` / deterministic `BUILD_REPORT.md` record provenance and token totals.
- A model stop without `finish`, a disallowed tool call, exhausted budget, or failed validation ends in an explicit non-success terminal state.

---

## 5. Compilation-order strategies (document builder)

Shared strategy definitions live in the [Build Plugin Contract](Lexiom_1_3_Build_Plugin_Contract_1_0.md) §6. Below: **document-specific** traversal, context packing, pros/cons, and recommendation — using generic node roles only.

**Generic roles used in this section:**

- **Standard** — organizational-standard ancestor OSN(s)
- **Root** — compilation root OSN
- **Mid** — non-leaf descendants that structure the document (chapters/parts)
- **Leaf** — terminal descendants with detailed `output_spec` content

### 5.1 `ancestor_first_dfs`

**How the agent traverses**

1. Read Standard(s) fully (when included).
2. Read Root fully.
3. Pre-order DFS through Mid and Leaf nodes via `child_osn_ids`, drafting prose as each node is visited.

**In-prompt vs on-demand**

- In-prompt: Standard + Root + current node + primary-parent chain.
- On-demand: unvisited siblings and cousin subtrees.

**Pros**

- Governance and scope constraints land before detail.
- Natural top-down narrative flow (mandate → structure → detail).
- Good when the agent can stream one continuous manuscript.

**Cons**

- Deep subgraphs blow context if everything stays in working memory.
- Early sections may bloat with standards before a stable TOC exists.
- Wide sibling branches may receive uneven depth.

**When to try**

Short subtree builds, or when the root mandate must dominate tone from the first paragraph.

---

### 5.2 `descendant_first_dfs`

**How the agent traverses**

1. Recurse to Leaf nodes under Root first.
2. Draft leaf subsections from leaf `output_spec` text.
3. Synthesize Mid nodes, then Root, then Standard alignment (if included).

**In-prompt vs on-demand**

- In-prompt: active leaf cluster + direct parent `output_spec`.
- On-demand: Root and Standard mainly at synthesis time.

**Pros**

- Concrete leaf content gets full attention.
- Reduces empty framework sections with no substance.
- Useful for regenerating a section after leaf OSNs change.

**Cons**

- Orphaned or contradictory sections before parent constraints apply.
- Root/Standard authority may arrive too late to prevent drift.
- Quality depends on a strong final synthesis pass.

**When to try**

When leaf OSNs are newly matured and a document skeleton already exists from a prior run.

---

### 5.3 `outline_then_fill` (recommended first)

**How the agent traverses**

**Pass 1 — Outline (ancestor-first):**
1. Walk Standard (if any) → Root → Mid structure.
2. Emit `OUTLINE.md`: title, TOC, section headings, owning OSN ids (scaffold only), one- or two-sentence purpose per section.
3. Do **not** write full body copy yet.

**Pass 2 — Fill (descendant-first within each outline section):**
1. For each outline section, read the owning OSN and its descendants.
2. Write body content into `document.md` (and optional `sections/*`) in **reader-facing voice** (§3.5) — no OSN ids or OSNG vocabulary in the body.
3. Keep claims tethered to leaf `output_spec` text (as source material, not as cited schema).

**Pass 3 — Reconcile (short):**
1. Re-read Root (+ Standard if included).
2. Fix global tone, naming, and claim consistency.
3. Run the §3.5.5 cleanliness scan; strip any OSNG traces from the outcome body.
4. Check success-evidence inspection prompts; note gaps in `BUILD_REPORT.md`.

**In-prompt vs on-demand**

- Pass 1: titles, seeds, structural fragments only.
- Pass 2: full `output_spec` for the active section cluster.
- Pass 3: Root/Standard + outline + problem spots.

**Pros**

- Stable document architecture before prose volume.
- Best fit for wide subgraphs with multiple Mid branches.
- Natural checkpoint: humans can review `OUTLINE.md` before a costly fill.
- Pass 3 restores governance after leaf detail.

**Cons**

- Two (or three) passes cost more agent time/tokens.
- Outline errors propagate unless Pass 3 is thorough.
- Requires discipline not to draft body copy in Pass 1.

**When to try**

**Default first strategy for this plugin** when compiling a full multi-level document subgraph.

---

## 6. Recommendation

| Situation | Strategy to try first |
|---|---|
| Full multi-level document subgraph | **`outline_then_fill`** |
| Single deep subtree arm | `ancestor_first_dfs` |
| Refresh leaf sections into an existing document | `descendant_first_dfs` |

**Primary recommendation:** start with `outline_then_fill`. Document packs benefit from a stable section skeleton from mid-level OSN structure before filling leaf messaging; pure leaf-first produces orphaned sections; pure ancestor-first dumps standards and root mandate into early pages without a usable structure.

---

## 7. Non-goals

- Editing or rewriting OSN YAML
- Implementing or modifying unrelated application codebases
- Inventing claims not supported by included OSNs
- Compiling software artifacts (use the software-coding builder plugin)
- Silent publication of the document as canonical organizational truth without human review
- Publishing an outcome document that documents, teaches, or cites the OSNG / OSN instruction machinery (§3.5)
- Embedding provenance, OSN ids, or build-process metadata in the reader-facing body (those belong in `BUILD_REPORT.md` / scaffold only)

---

## 8. Success bar (plugin-level)

A run is structurally successful when:

1. The agent called `finish`, syncOut completed, and `document.md` (or `artifact_profile` primary path) exists under `output_directory` and is readable end-to-end.
2. `BUILD_REPORT.md` lists included OSN ids and the strategy used.
3. For `outline_then_fill`, `OUTLINE.md` exists and section headings map to OSN clusters in the subgraph (scaffold may name OSN ids; the outcome body must not).
4. The document does not contradict draft-first / human-governance constraints stated in included Standard or Root OSNs.
5. Known gaps (missing nodes, draft-only sections) are listed in `BUILD_REPORT.md` rather than hallucinated away.
6. **Cleanliness:** `document.md` and any body pack under `sections/` (or equivalent) pass §3.5 — no OSN/OSNG identities, schema field names, graph/process meta, or scaffold leakage in the reader-facing text.

Domain inspection remains with each included OSN’s `success_evidences`.

---

## 9. Evidence collection (plugin-specific notes)

Shared contract: [Build Plugin Contract §8](Lexiom_1_3_Build_Plugin_Contract_1_0.md#8-evidence-collection-hemisphere). This plugin only adds capture hints:

- A `TEXTUAL_SNIPPET` (including legacy `direct_document_review`) target may be satisfied by referencing the delivered `document.md` via `source_artifact_paths` in `EVIDENCE_MANIFEST.json` when that file *is* the SUD — still emit a manifest row for every `target_id`.
- Derivative briefs (e.g. `markdown_brief`): write under `./evidences/` only when the plan requests them; derive from the delivered document + OSNG, never invent claims.
- Do **not** put evidence ids, manifest rows, or “success evidence” process language into the reader-facing `document.md` (§3.5).

Builder success (§8 above) does not require the evidence pass to have completed; evidence success is Contract §8.8.

---

## 10. Future wiring notes

Runtime is live via `POST /lexiom13/build/prepare` and `POST /lexiom13/build/run`.

Remaining polish:
1. Strategy picker UI as an explicit White Move (defaults work without it).
2. Stage delivered SUD via OSN `bud` + Center Bud mode — [../Lexiom_1_3_Center_Playfield_Build_Artifact_Review_UX_Spec_1_0.md](../Lexiom_1_3_Center_Playfield_Build_Artifact_Review_UX_Spec_1_0.md).
3. Deliver and validate the append-only Real Bolt document loop per [Lexiom_1_3_Virtualized_Agent_Loop_1_0.md](Lexiom_1_3_Virtualized_Agent_Loop_1_0.md); evidence auto-chain is Phase A / Option E host quote-span; `bud` is Phase B (both implemented).

---

## Appendix A — Reference deployment (Lexiom 1.3)

*Illustrative only; not part of the generic contract.*

| Role | Example OSN (Lexiom 1.3) |
|---|---|
| Standard | `GT_Philosophy.a1000001.osn` |
| Root | `GT_Philosophy.BrandLexiom.a1000005.osn` |
| Descendants | BrandLexiom subtree under `Branding/` |

In this deployment, BrandLexiom is a compilation root with `target_tool_profile: document_agent`. A branding-oriented `artifact_profile` might name the primary file `branding-book.md` — that naming is deployment-specific, not required by this plugin spec.
