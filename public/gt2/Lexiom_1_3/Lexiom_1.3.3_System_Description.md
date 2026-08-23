# Lexiom 1.3.3: Deterministic Semantic Development, Discipline-Layer OSNs, Compilation Roots, and Evidence Exploration System

## Technical Description for Provisional Patent Expansion

### 1. Overview

Lexiom is an LM-centric system for developing complex subjects into human-approved, evidence-backed artifacts while preserving consent, provenance, replayability, semantic accountability, organizational governance, and discipline-aware development. The system may be used for software development, legal-making, mediation education, enterprise decision-making, contract drafting, product design, compliance review, policy formation, and other domains in which humans use language-model-centric tools to transform initial intention into structured, inspectable, approved outputs.

Lexiom does not treat generated output as authoritative merely because it was produced by a language model, agent, automation, coding tool, or programmatic system. Instead, Lexiom separates generated drafts from canonical artifacts through an explicit temporal, provenance, approval, and evidence model.

Lexiom 1.3.2 extends the OSN model by introducing:

1. **Thematic Discipline Lenses** — approved professional perspectives used to shape the current OSN.
2. **Derivative Discipline OSNs** — layer-specialized child OSNs created to deepen selected disciplines.
3. **Multi-Ancestor OSNs** — OSNs that inherit both local product/case intent and organizational standards.
4. **Compilation Roots** — any approved OSN may be selected as the root for compiling its approved descendant graph into instructions for a mapped implementation tool.

Together, these capabilities allow Lexiom to function as a governed semantic source tree: a system in which human intentions become nodes, nodes become professional branches, branches converge into buildable specifications, and produced artifacts can later be inspected through both success evidences and lineage evidence.

---

### 2. Core Deterministic Collaboration Model

Lexiom operates according to a **White Move → Black Move → Stability** temporal model.

A **White Move** is an explicit human action that qualifies for canonical state mutation. Examples include approving an OSN seed, approving discipline lenses, approving an output specification, approving success evidences, approving derivative discipline OSNs, approving a draft, publishing a proposal, accepting a shared artifact, answering a Lexiom question, or approving a Concordance resolution.

A **Black Move** is a system response triggered by a White Move. During the Black Move phase, Lexiom may generate drafts, propose discipline lenses, propose success evidences, propose derivative OSNs, compute lineage evidence, synthesize inherited OSNs, detect conflicts, render L2 prisms, or issue UI look-and-feel instructions through the DaDa Engine. Black Move operations do not mutate canonical state.

A **Stability** phase follows Black Move completion. During Stability, Lexiom awaits the next qualified White Move. No canonical mutation, silent drift, background canonization, or unauthorized agent mutation occurs.

This model preserves deterministic replay. The canonical state of a product, case, contract, learning simulation, or governance workflow can be reconstructed by replaying approved Moves and approved OSNs stored in the provenance spine.

---

### 3. Outcome Specification Nodes

An **Outcome Specification Node (OSN)** is a human-owned semantic node that describes a desired outcome and the evidence by which its owner may later inspect whether the outcome has been fulfilled.

An OSN may represent a software requirement, user-interface specification, security specification, code-shaping constraint, legal position, factual chronology, contract clause, settlement proposal, mediation role statement, classroom fairness rule, compliance control, design intention, enterprise decision, organizational standard, or any human-approved intention intended to become an accountable artifact.

Each OSN may include:

- OSN identifier;
- human owner;
- seed statement;
- approved thematic discipline lenses;
- approved output specification;
- approved direct success evidences;
- parent OSN references;
- descendant OSN references;
- organizational-standard ancestor references;
- domain-specific layers;
- state, such as draft, approved, branched, blocked, compiled, implemented, validated, or superseded;
- provenance links to approved artifacts, approved human answers, and inherited OSNs.

An OSN is therefore not merely a requirement. It is a semantic-development vessel through which human intention is shaped, inspected, branched, inherited, compiled, and later explained.

---

### 4. OSN Approval Flow

Lexiom 1.3.2 defines an OSN maturation process composed of sequential approval gates.

#### 4.1 Seed Approval

The user first approves the **OSN seed**. The seed expresses the initial human intention, product idea, legal point of view, dispute scenario, organizational standard, educational situation, or desired outcome.

#### 4.2 Thematic Discipline Lens Approval

After seed approval, Lexiom proposes a set of **Thematic Discipline Lenses**. The user edits and approves this list.

These lenses are not yet child OSNs. They are professional perspectives used to shape and inspect the current OSN. Examples may include UX, security, software architecture, visual design, performance, code shaping, legal strategy, negotiation posture, compliance, privacy, accessibility, educational fairness, content tone, or brand language.

#### 4.3 Output Specification Approval

Using the approved thematic discipline lenses, Lexiom helps refine the OSN’s **output specification**: what the node is meant to express, produce, protect, validate, constrain, teach, or develop. The user approves the output specification through a White Move.

#### 4.4 Success Evidence Approval

Lexiom then proposes **success evidences**, and the user edits and approves them. Each entry in an OSN's `success_evidences` list carries a **`direct`** boolean that states whether the artifact counts toward the minimum direct-evidence requirement.

**Mandatory minimum (non-negotiable):** every approved OSN — including organizational standards, product OSNs, and discipline OSNs — must declare **at least one** success evidence with **`direct: true`**. An OSN whose `success_evidences` list contains only derivative entries (`direct: false`) does **not** meet the canonical approval requirement and must not be treated as fully approved.

**Direct success evidence (`direct: true`)** is first-hand inspection material. The owner (or reviewer) can open, watch, play, read, or otherwise inspect the **delivered outcome itself** — or a primary fragment of the build artifact that *is* the outcome for that OSN — and answer: *did the outcome become real as intended?* Nothing essential is hidden behind a report, summary, test harness, log pipeline, or analytic interpretation.

**Supported direct evidence kinds (discrete enumerators).** A direct evidence entry must declare a `kind` that is exactly one of the following strings (case-sensitive enumerators). Lexiom does **not** treat arbitrary demo media as direct merely because it feels first-hand; only these enumerators (or later explicit additions to this list) may satisfy `direct: true`:

1. `"TEXTUAL_SNIPPET"` — a reviewable excerpt taken from the System Under Development (SUD) / build deliverable itself. Examples: a code excerpt from a JavaScript (or other source) file that composes the built software artifact; a paragraph or clause excerpt from a produced markdown document when that document *is* the SUD (for example a brand book compiled by the document builder). Always points at delivered build material — never at the OSN’s own specification text.
2. `"SCREEN-SHOT"` — a still image of the produced artifact or a relevant part of it.
3. `"VIDEO-CLIP"` — a short recording that captures the produced artifact or a relevant interaction with it.

**Extensibility:** additional direct enumerators (for example an audio-clip kind when an MP3 is itself the build target of an OSN) may be added later by expanding this list in the system description and matching runtime kind registries. Until listed here as an exact enumerator string, such media must not be counted as direct evidence.

**Known divergence (Lexiom 1.3 POC runtime):** older builds and artifacts may still carry legacy kind labels (`direct_code_snippet`, `direct_document_review`, `screenshot`, `video_clip`). The runtime accepts those as transitional aliases of `"TEXTUAL_SNIPPET"`, `"SCREEN-SHOT"`, and `"VIDEO-CLIP"` for discovery and validation; live OSN YAML under `Lexiom_1_3/` should use the canonical enumerator strings only.

**Prohibited — an OSN may not cite its own specification as direct evidence.** The OSN graph describes *how a product should be*, not the delivered product itself; the OSN tree is the prescription, not the outcome. Therefore an OSN's own `seed`, thematic lenses, `output_spec`, success-evidence definitions, or any other part of its specification content must **never** be used as that OSN's direct success evidence. Quoting, excerpting, or re-rendering the `output_spec` (or any OSN field) back as an artifact only re-presents the prescription; it demonstrates nothing about whether an outcome became real. Every OSN — including the top-level organizational standard — must anchor its direct evidence in something produced *downstream of* the specification and represented with a supported direct enumerator: `"TEXTUAL_SNIPPET"`, `"SCREEN-SHOT"`, or `"VIDEO-CLIP"`. A `"TEXTUAL_SNIPPET"` is valid as direct evidence only when it is taken from a **delivered outcome artifact** (the SUD), never when it is the OSN's own specification text.

**Derivative success evidence (`direct: false`)** describes, measures, or summarizes an outcome **indirectly**. It is derived from the outcome (or from artifacts about the outcome) rather than presenting the outcome for first-hand inspection. Examples include automated test results, logs, metrics, scans, markdown mapping briefs, generated reports, and analytics. These may supplement review and may appear in `success_evidences`, but they **do not** satisfy the mandatory direct minimum.

**Quick test:** if producing the evidence requires authoring a new summary *about* the outcome — or merely re-presenting the OSN's own specification — rather than capturing or presenting a delivered outcome artifact itself, it is not a valid direct evidence.

**Organizational standard OSNs** follow the same rule and cannot escape it by reviewing their own text. A mapping brief or initiative summary may be listed as supplemental derivative evidence, but the standard's direct evidence must inspect a delivered artifact using a supported enumerator — for example `"SCREEN-SHOT"` of the governed product's actual behavior.

**Per-evidence approval (build attestation).** Approving a successful build is not a single blanket action; it is expressed as the OSN owner reviewing and approving each defined success evidence. In the cockpit, the Right Panel presents an **approval checkbox beside every success-evidence artifact**. After opening and inspecting an artifact in the Center Playfield, the owner toggles its checkbox to attest that the delivered outcome became real as intended. Each toggle is an explicit **White Move** (approve / unapprove of that specific evidence) recorded in the action log. Approval is available only once a reviewable evidence artifact exists; an evidence whose artifact has not yet been produced cannot be approved. Per-evidence approvals are independent — each artifact is attested on its own — and the build of an OSN is considered owner-attested when its required evidences (at minimum its direct evidence) are approved.

#### 4.5 Derivative Discipline OSN Approval

Only after the seed, discipline lenses, output specification, and success evidences are approved does Lexiom propose **Derivative Discipline OSNs**. These are layer-specialized child OSNs derived from selected approved discipline lenses.

The user edits and approves which derivative discipline OSNs should be created. Approved derivative OSNs become downstream child nodes awaiting human ownership and further maturation.

---

### 5. Discipline Layers, Thematic Lenses, and Derivative OSNs

Lexiom distinguishes between two uses of discipline.

**Thematic Discipline Lenses** are used to understand, shape, and refine the current OSN. They answer: *through which professional eyes should this node be developed?*

**Derivative Discipline OSNs** are downstream child nodes created to deepen selected disciplines. They answer: *which professional perspectives now deserve their own owned specification nodes?*

For example, a root product OSN for a “Welcome Newcomers” application may approve the thematic discipline lenses UX, Security, Visual Design, Performance, and Content Tone. After the output specification and success evidences are approved, Lexiom may propose one derivative OSN per selected discipline.

Later, an approved UX OSN may itself propose sub-discipline OSNs such as UX Flows, Form Interaction, Error Handling, and Accessibility. An approved Visual Design OSN may branch into Typography, Color Scheme, Animation Style, and Layout. An approved Security OSN may branch into Input Validation, Abuse Resistance, Authentication, and Privacy.

Thus, the OSN graph becomes a discipline-aware specification tree, while still remaining governed by human approval at each node.

---

### 6. OSN Graph, Multi-Ancestor Inheritance, and Organizational Standards

Lexiom supports OSNs as an approved semantic graph rather than a strict tree.

An OSN may have one parent, multiple parents, or both product-specific and organizational-standard ancestors. This enables reusable organizational standards to percolate into designated product graphs, legal-case graphs, educational simulations, or governance workflows.

For example, a Security OSN in a product graph may inherit from:

1. the Product Vision OSN, which expresses the local product intention; and
2. an organizational Security Standard OSN, such as a requirement to address the OWASP Top Ten security risks.

Similarly, a legal-drafting OSN may inherit from a case-specific legal-position OSN and from a firm-wide drafting-standard OSN. A mediation-education OSN may inherit from a fictional dispute OSN and from a school-approved fairness-standard OSN.

This multi-ancestor model allows Lexiom to combine local intention with reusable standards, policies, templates, brand rules, legal doctrines, security baselines, compliance obligations, and architectural constraints.

Questions of ownership, override, harmonization authority, and escalation are governed by Lexiom’s Operative Policy Layer.

---

### 7. Concordance and Conflict Handling

Conflicts may arise when an OSN inherits from multiple ancestor OSNs whose requirements, constraints, tones, risks, values, or professional assumptions are in tension.

Lexiom uses the **Concordance Engine** to detect, surface, and attempt to resolve such conflicts.

The Concordance Engine may identify:

- aligned intentions;
- conflicting requirements;
- incompatible assumptions;
- unresolved ambiguities;
- tension between product experience and security;
- tension between legal protection and relational tone;
- tension between visual richness and performance;
- tension between organizational standards and local product goals;
- tension between educational simplicity and emotional accuracy.

If a conflict can be semantically resolved, the Concordance Engine may propose a harmonized OSN draft. Such harmonization remains non-canonical until approved by the relevant human owner or owners according to policy.

If a conflict cannot be resolved, Lexiom surfaces a blocking message. The message may include the conflict description, links to relevant OSNs, links to specific conflicting fragments, links to human owners, proposed clarification questions, and possible local override or change-request actions.

The Concordance Engine may assist synthesis, but it may not erase disagreement, imply consent, or canonize a resolution without human approval.

---

### 8. Operative Policy Layer

Lexiom may be provisioned within an **Operative Policy Layer**, the administrative envelope governing how OSNs behave in a specific organization, school, legal practice, product group, or enterprise.

The Operative Policy Layer may define:

- available discipline-layer taxonomy;
- who may add or approve discipline lenses;
- which disciplines are mandatory for certain OSN types;
- who owns derivative discipline OSNs;
- inheritance rules;
- organizational-standard percolation rules;
- local override permissions;
- parent change-request behavior;
- conflict escalation rules;
- mandatory evidence types;
- acceptance rules;
- publication rules;
- tool-mapping rules;
- who may compile/build from which OSNs;
- whether build actions require additional approval.

Lexiom may support at least two governance modes for inherited constraints:

1. **Local Override Mode** — a downstream OSN owner may override an inherited constraint, with the override recorded in provenance.
2. **Parent Change-Request Mode** — a downstream OSN owner may not override directly; Lexiom generates a formal change request back to the relevant ancestor OSN owner.

The policy layer allows Lexiom’s semantic core to remain flexible while preserving organizational governance.

---

### 9. Compilation Roots and Build from Any OSN

Lexiom 1.3.2 generalizes implementation and build behavior.

No dedicated “Implementation OSN” is required. Instead, any approved OSN may act as a **Compilation Root**.

When a user chooses to build from a selected OSN, Lexiom gathers:

- the selected OSN;
- approved descendant OSNs;
- inherited organizational-standard OSNs;
- approved output specifications;
- approved direct success evidences;
- approved derivative evidences;
- approved discipline lenses;
- approved constraints;
- approved Concordance resolutions;
- approved lineage evidence references;
- policy-defined implementation requirements.

Lexiom then compiles these materials into coherent instructions for a mapped implementation tool, such as a coding agent, document-generation tool, legal-drafting tool, test-generation tool, educational-simulation tool, or other external system.

A root product OSN may compile a whole product. A UX OSN may compile a UX sub-product. A security OSN may compile a security specification or security implementation prompt. A legal-case OSN may compile an entire case narrative. A clause OSN may compile only one clause. A mediation-education OSN may compile only one simulated agreement.

Thus, the OSN graph becomes both the specification tree and the executable semantic source tree.

**Lexiom 1.3 build plugins (runtime):** mapped implementation tools are specified under [`BuildPlugins/`](BuildPlugins/Lexiom_1_3_Build_Plugin_Contract_1_0.md) (including the shared evidence-collection hemisphere in Contract §8, cockpit poll sync in [`Lexiom_1_3_Evidence_Cockpit_Sync_1_0.md`](BuildPlugins/Lexiom_1_3_Evidence_Cockpit_Sync_1_0.md), the sole `/run` executor in [`Lexiom_1_3_Virtualized_Agent_Loop_1_0.md`](BuildPlugins/Lexiom_1_3_Virtualized_Agent_Loop_1_0.md), and the CA Job shape in [`Lexiom_1_3_CA_Worker_Protocol_1_0.md`](BuildPlugins/Lexiom_1_3_CA_Worker_Protocol_1_0.md)). The SPA build glyph exposes `POST /lexiom13/build/prepare` and `POST /lexiom13/build/run` as two explicit White Moves: the first click creates the standalone build directory and changes the glyph to stable prepared amber so the agent documents can be inspected; the second click activates the CA and triggers VAL for that prepared `run_id`. Prepare snapshot-copies the compilation-closure OSNs into `builds/lexiom13/<runId>/osng/` (plus `OSNG_Basics_README.md`), writes pointer-only `EVIDENCE_PLAN.json`, and packages `AGENT_PROMPT.md` + `EVIDENCE_AGENT_PROMPT.md` so the folder is a standalone agent project. **Intended run:** CA location **`browser_session`** + executor **`bolt_webcontainer`** — Lexiom player WebContainer with a bolt-style agent loop; model traffic GT3 ↔ OpenRouter ↔ Claude; canonical artifacts under `builds/lexiom13/<runId>/` after syncOut (`host` / `remote` / `aider_docker` are Follow-up). Evidence auto-chains after a successful builder (Step 5); failures surface structured errors/logs without fake primary stubs. The cockpit Right Panel polls `GET /lexiom13/evidence/collections?osn_id=…` (default every 5s) to surface collected artifacts for the Focus OSN.

---

### 10. Provenance Spine, Success Evidence, and Lineage Evidence

Lexiom maintains an immutable provenance spine. Each meaningful contribution is represented as a Move, OSN, artifact, or artifact reference.

Lexiom distinguishes between two evidence concepts:

#### 10.1 Success Evidence

**Success Evidence** is defined by an OSN owner before or during OSN approval. It describes the material by which fulfillment will later be inspected.

**Mandatory minimum:** every approved OSN must include at least one **direct** success evidence (`direct: true` in the OSN YAML) whose `kind` is exactly one of the §4.4 enumerators `"TEXTUAL_SNIPPET"`, `"SCREEN-SHOT"`, or `"VIDEO-CLIP"` (until that list is extended). This requirement applies without exception to product OSNs, discipline OSNs, and organizational standard OSNs. Derivative evidences (`direct: false`) may be listed alongside them as supplemental material but **cannot replace** the direct minimum; an OSN approved with only derivative evidences, or with a `direct: true` entry whose kind is not one of those enumerators, is non-compliant.

An OSN may **never** use its own specification content (its `seed`, thematic lenses, `output_spec`, or evidence definitions) as direct evidence. The specification prescribes how the product should be; it is not the delivered product. Direct evidence must inspect a delivered build artifact or a capture of that artifact, using a supported direct kind, not the specification itself.

#### 10.2 Lineage Evidence

**Lineage Evidence** is used after or during review to explain why an artifact, behavior, phrase, clause, demo moment, or generated output appears as it does. It traces the artifact back to approved OSNs, approved human answers, approved ancestor nodes, approved discipline lenses, approved organizational standards, approved success-evidence definitions, and approved Concordance resolutions.

Success Evidence asks: *Did the outcome become real as intended?*

Lineage Evidence asks: *Why did it become shaped this way?*

Both are rendered through Lexiom’s evidence-aware UX, especially through the Center Playfield and L2 Lineage Evidence Prism.

---

### 11. User Interface: The Lexiom Cockpit

Lexiom uses a fixed cockpit-like interface designed around a single execution surface.

As a design preference, Lexiom may render OSNs as **file-like artifacts**, such as `UX.osn`, `Security.osn`, or `ProductVision.osn`, so that users and developers may intuitively experience each OSN as an editable, reviewable, and version-aware semantic document. In this presentation model, the Lexiom Cockpit may behave like an **OSN-aware file editor**: a utility for opening, editing, reviewing, approving, branching, compiling, and inspecting `.osn` artifacts while remaining aware of their graph relationships, ancestors, descendants, owners, success evidences, and lineage evidence. This file-like representation is not required as a core architectural trait of Lexiom; the underlying system may still implement OSNs as database records, graph nodes, object structures, or other persistent representations. The `.osn` metaphor is therefore a UX and developer-facing preference that makes the semantic graph feel concrete, inspectable, and familiar.

The **Center Playfield** is the sole execution surface. It is where users review drafts, edit artifacts, approve OSN seeds, approve discipline lenses, approve output specifications, approve success evidences, inspect legal clauses, play demos, pause behavior, resolve conflicts, or trigger compilation/build from a selected OSN.

The **Top Panel / L2 Thematic Prisms** provides thematic focusing and evidence reasoning. During OSN creation, the L2 panel may show approved thematic discipline lenses. Each lens acts per Focus OSN and per focused section: clicking a lens reshapes the current Center Playfield section through that discipline, and clicking the same lens again re-runs the reshape on the current draft so the section is pushed progressively deeper into the lens's semantic realm (for example, repeatedly applying a Code Shaping lens moves a seed further toward code-shaping language). This deepening reshapes only the draft in place and remains an unapproved proposal. During review, the L2 panel may become the Lineage Evidence Prism, explaining why selected output is shaped as shown.

The **Right Panel** may display generated artifacts, OSNs awaiting review, derivative discipline OSNs awaiting ownership, success evidence definitions, and build outputs. It also presents, beside each success-evidence artifact, an **approval checkbox** through which the OSN owner reviews and approves that evidence as a White Move (see §4.4). For build-plugin collections, the Lexiom 1.3 cockpit polls the GT3 server on a Focus-closure schedule (default 5s) so newly collected artifacts under `builds/lexiom13/<runId>/evidences/` appear in this tray when the Focus OSN is covered by a run’s evidence plan/manifest (see [`BuildPlugins/Lexiom_1_3_Evidence_Cockpit_Sync_1_0.md`](BuildPlugins/Lexiom_1_3_Evidence_Cockpit_Sync_1_0.md)). Collection status remains distinct from owner approval.

The **Left Panel** may show OSN graph navigation, parent-child relationships, multi-ancestor inheritance, organizational-standard ancestors, unresolved conflicts, discipline layers, and node ownership indexes. When an OSN is selected for cockpit exposition, its parent-chain ancestors in the graph receive the same bluish selection highlight so the player can see which upstream nodes shape the current view. It also supports **graph filters** that optionally surface read-only status glyphs and controls beside OSN nodes. To keep the initial experience visually calm, **all graph filters are disabled by default**; the player opts into each detail lens explicitly. The available filters are:

- **Evidence approval** — shows, per OSN, whether demo-evidence review and owner approval has taken place (`●` fully attested, `◐` partial, `○` pending, `·` no reviewable artifact yet), together with an aggregate attestation summary for the current SUD build graph. For any OSN that defines success evidences, the approval glyph doubles as a **quick-navigation control**: clicking it selects that OSN and opens its Success Evidences section, so the owner immediately sees the success-evidence definitions in the Center Playfield alongside the demo evidence artifacts in the Right Panel. The glyph only navigates; it never changes approval state (approval remains a Right Panel White Move).
- **Build controls** — shows the build glyph beside each OSN (used to compile from that node) plus a summary of how many OSNs are build-ready. Hiding this filter removes build affordances from the graph to reduce visual load.
- **Top bar** — shows the Top HUD ribbon with L2 thematic lens chips.

The GT3-proposed cockpit shell title remains hidden and is **not** offered as a selectable graph filter (edge-fill applies while it stays muted).

The left-corner full-graph toggle opens a cabinet-wide exposition with two kinds: **Side view** (indented native trees) and **Top view** / OSNG Garden (radial trees colored per thematic plane on a green→purple spectrum; solid native arrows; dashed cross-tree `standard_ancestor` arrows; tree centers spaced by cross-link counts — see [`Lexiom_1_3_OSNG_Garden_UX_Spec_1_0.md`](Lexiom_1_3_OSNG_Garden_UX_Spec_1_0.md)).

The **Bottom Ribbon / L3 Semantic Direction Layer** may provide quick semantic actions, such as approve seed, approve discipline lenses, approve evidence, request Concordance, create derivative OSNs, compile from this node, or inspect lineage.

---

### 12. Semantic Engines

Lexiom may include multiple semantic engines.

#### 12.1 Semantic Transformation Engine

Receives user meaning and produces draft semantic outputs, including candidate OSN seeds, output specifications, reframings, proposals, clauses, requirements, or mediation statements. Outputs remain draft-only until approved.

#### 12.2 Strategic Matrix Engine

Evaluates proposed artifacts or OSNs across multiple axes, such as self-interest, other-interest, leverage, constraints, risks, implementation impact, stakeholder impact, legal posture, or validation requirements.

#### 12.3 Evidence Prism Engine

Receives a selected artifact fragment, OSN element, behavior, demo moment, clause, code-shape element, or visible product behavior and identifies approved lineage evidence. Its output is rendered primarily in the L2 panel.

#### 12.4 Concordance Engine

Synthesizes multiple narratives, OSNs, parent-node specifications, organizational standards, or discipline-specific constraints into a coherent proposed OSN. It detects conflicts and proposes draft harmonization without implying consent.

#### 12.5 DaDa Engine

Receives semantic inputs and system state and produces UI look-and-feel instructions, such as breathing effects, color modulation, focus emphasis, visual quieting, or transition rhythm. It does not alter canonical state, OSN content, artifact content, or provenance.

#### 12.6 Compilation Engine

The Compilation Engine receives a selected compilation-root OSN and gathers approved descendant OSNs, approved ancestors, organizational standards, discipline layers, output specifications, success evidences, and constraints. It produces coherent implementation instructions for a mapped external tool. Its output remains subject to the White/Black/Stability model and policy-defined approval rules.

---

### 13. Use in Software Development

When used for LM-centric software development, Lexiom supports a staged, multi-node semantic-development process in which human intention is transformed into an implemented, reviewable, and evidence-backed software artifact.

A product manager may approve a root OSN seed describing a product vision. Lexiom proposes thematic discipline lenses such as UX, Security, Visual Design, Performance, Architecture, and Content Tone. The product manager edits and approves these lenses. Lexiom then helps refine and approve the output specification, followed by at least one direct success evidence (`direct: true`) whose `kind` is a §4.4 enumerator — for example `"SCREEN-SHOT"` of the running SPA, `"VIDEO-CLIP"` of a key interaction, or `"TEXTUAL_SNIPPET"` from the built artifact for a code-shape OSN.

After the root OSN is approved, Lexiom proposes derivative discipline OSNs. UX, Security, Visual Design, Performance, and Architecture may each become child OSNs awaiting ownership by appropriate humans. Each child OSN repeats the same approval flow.

Approved child OSNs may branch further into sub-discipline OSNs. UX may branch into UX Flows, Form Interaction, Error Handling, and Accessibility. Security may branch into Input Validation, Abuse Resistance, Privacy, and Threat Modeling.

A Security OSN may inherit both from the Product Vision OSN and from an organizational security-standard OSN, such as OWASP Top Ten compliance. The Concordance Engine harmonizes product-specific security intent with organizational standards.

When the team wants to build, no Implementation OSN is required. The user selects any approved OSN as the compilation root. Selecting the product root compiles the whole product specification tree. Selecting the UX OSN compiles only the UX sub-product. Lexiom then sends coherent build instructions to the mapped coding or implementation tool.

After build, OSN owners inspect success evidences in the Center Playfield and may use the L2 Lineage Evidence Prism to understand why the system behaves as shown.

---

### 14. Use in Legal-Making

When used for legal-making, Lexiom supports a staged, multi-node semantic-development process in which an initial legal point of view is transformed into a structured, reviewable, evidence-backed legal case.

A lawyer, client, mediator, or layperson may approve a root OSN seed describing what happened, what is disputed, what is desired, what must be protected, and what legal or emotional boundaries shape the matter. Lexiom proposes thematic discipline lenses such as Facts, Legal Theory, Evidence, Risk, Negotiation Strategy, Remedy, Drafting Tone, or Compliance. The user edits and approves the lenses.

Lexiom then helps refine the output specification and success evidences. Direct evidences must use §4.4 enumerators — for example `"TEXTUAL_SNIPPET"` from a produced clause or settlement document (the SUD), `"SCREEN-SHOT"` of a rendered timeline or agreement surface, or `"VIDEO-CLIP"` of a mediated walkthrough. Related materials such as issue lists, mediation summaries, or oral notes may appear as **derivative** evidences when they summarize rather than present the delivered outcome itself.

After approval, Lexiom may propose derivative legal-discipline OSNs, such as Factual Chronology, Legal Position, Evidence, Remedy, Risk, Negotiation, Clause Drafting, or Settlement Proposal. These OSNs may branch, inherit, converge, and compile using the same mechanics as software OSNs.

A clause OSN may inherit both from a case-specific negotiation OSN and from a firm-wide contract-drafting-standard OSN. The Concordance Engine detects and harmonizes tension according to policy.

A user may compile from any approved legal OSN. Compiling from a case root may generate a full case narrative. Compiling from a clause OSN may generate only a specific clause. Lineage Evidence explains why selected legal language was phrased as shown.

---

### 15. Use in Mediation Education

When used for mediation education, Lexiom may function as a legal-case development flight simulator.

Two or more students may play opposing roles in a fictional dispute. Each student approves OSN seeds representing their assigned party’s position, fears, interests, factual claims, and desired outcomes. Lexiom proposes thematic discipline lenses such as Facts, Emotions, Interests, Fairness, Risk, Options, Agreement Terms, and Relationship Repair.

Students approve output specifications and success evidences for their OSNs. Direct evidences must use §4.4 enumerators (for example `"TEXTUAL_SNIPPET"` from a drafted agreement that is the SUD, `"SCREEN-SHOT"` of a shared board, or `"VIDEO-CLIP"` of a role-play walkthrough). Role-play transcripts, emotional-interest summaries, and similar materials may appear as derivative evidences when they describe rather than present the delivered outcome.

Lexiom may then propose derivative OSNs, such as Party Position, Underlying Interest, Fairness Rule, Risk Concern, Resolution Option, or Agreement Term. The Concordance Engine helps students converge opposing OSNs into a mediated-agreement OSN.

A student or instructor may compile from the mediated-agreement OSN to generate a draft agreement. They may inspect the draft in the Center Playfield and use the L2 Lineage Evidence Prism to see which approved party statements, interests, fairness rules, and negotiation constraints shaped each phrase.

Students therefore do not merely read mediation theory. They practice mediation as a governed semantic process in which conflict is branched, clarified, harmonized, and transformed into accountable agreement.

---

### 16. Additional Use Cases

Lexiom may also be applied in enterprise decision-making, product design, compliance review, governance, research collaboration, procurement, policy formation, medical documentation, and other domains.

In each domain, Lexiom may represent human-approved intentions as OSNs. Each OSN matures through seed approval, thematic discipline lens approval, output specification approval, success evidence approval, and derivative discipline OSN approval. OSNs may inherit from local project nodes and organizational standards. Any approved OSN may act as a compilation root.

For example:

- a compliance OSN may inherit from a product OSN and a regulatory-standard OSN;
- a design OSN may branch into visual language, interaction, accessibility, and brand OSNs;
- a policy OSN may inherit from local stakeholder needs and global organizational policy;
- a procurement OSN may inherit from vendor requirements and organizational risk standards;
- a research OSN may inherit from project hypotheses and reproducibility standards.

In each case, Lexiom transforms intention into accountable, inspectable, discipline-aware form.

---

### 17. Technical Advantages

Lexiom 1.3.2 provides several technical and practical advantages:

- prevents programmatic LM systems, agents, or automations from mutating canonical state without human approval;
- separates draft generation from human approval;
- enables deterministic replay of approved collaboration history;
- represents outcome development as an approved OSN graph;
- introduces discipline-aware OSN maturation;
- distinguishes thematic discipline lenses from derivative discipline OSNs;
- allows organizational standards to percolate through multi-ancestor OSNs;
- permits any approved OSN to serve as a compilation root;
- eliminates the need for a dedicated implementation OSN;
- ensures every accepted OSN includes at least one direct success evidence (`direct: true`) whose `kind` is a §4.4 enumerator (`"TEXTUAL_SNIPPET"`, `"SCREEN-SHOT"`, or `"VIDEO-CLIP"`);
- preserves traceability between outputs, OSNs, ancestors, standards, success evidences, and lineage evidence;
- supports policy-governed inheritance, override, escalation, and tool mapping;
- enables one software implementation to support software development, legal-making, mediation education, compliance, and governance.

---

### 18. Core Invariants

Lexiom enforces the following invariants:

1. **Canonical mutation occurs only through White Moves.**
2. **Black Move outputs remain non-canonical until human approval.**
3. **Human answers to Lexiom questions become approved evidence immediately.**
4. **Every approved OSN must include an approved seed.**
5. **Every approved OSN must include approved thematic discipline lenses.**
6. **Every approved OSN must include an approved output specification.**
7. **Every approved OSN must include at least one direct success evidence (`direct: true`) whose `kind` is exactly one of `"TEXTUAL_SNIPPET"`, `"SCREEN-SHOT"`, or `"VIDEO-CLIP"` (§4.4). Derivative-only lists, and direct flags on other kind strings, are non-compliant.**
8. **Derivative discipline OSNs are created only after user approval.**
9. **An OSN may have multiple ancestors.**
10. **Organizational standards may be inherited through standard OSNs.**
11. **Conflicts among inherited OSNs are handled by the Concordance Engine and policy layer.**
12. **Any approved OSN may act as a compilation root if permitted by policy.**
13. **Compilation gathers approved descendants, inherited standards, specifications, evidences, and constraints.**
14. **Lineage Evidence uses approved artifacts, approved OSNs, approved standards, approved success-evidence definitions, and approved human answers.**
15. **The Center Playfield remains the sole execution surface.**
16. **The L2 panel renders thematic lenses and lineage evidence.**
17. **The DaDa Engine may alter look and feel, but not canonical content or provenance.**
18. **The provenance spine remains immutable, exportable, and replayable.**

---

### 19. Concluding Description

Lexiom 1.3.2 is a system for turning human intention into governed, discipline-aware, evidence-backed artifacts.

It may receive product vision, legal point of view, classroom conflict, organizational policy, security standard, design intention, or compliance need. It may ask questions, propose discipline lenses, generate output specifications, define success evidences, create derivative OSNs, inherit standards, detect conflicts, compile subtrees, and explain artifact lineage.

Yet Lexiom remains anchored by a strict principle: the machine may suggest, illuminate, branch, harmonize, compile, and breathe, but only humans approve what becomes canonical.

The OSN graph is therefore both garden and source tree. It grows through human approval, branches through professional disciplines, inherits organizational standards, compiles from any approved node, and lets every produced artifact be traced back to the approved seeds from which it emerged.
