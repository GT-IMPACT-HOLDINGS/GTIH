# Lexiom UX Architecture
## Inter-Spec Constitution (v1.0) — Zenith + Accord

**Status:** Foundational (MVP constitutional context for engineering)  
**Purpose:** Provide a single cross-spec map that binds Lexiom’s **Provenance**, **Temporal**, **Spatial**, **Semantic (Arcade)**, and **Strategic-Semantic** specifications into one coherent engineering contract.

**Audience:** Software development team (frontend, backend, infra, QA).  
**Applies To:** Lexiom Zenith (solo) and Lexiom Accord (shared), within the unified “Lexiom Cabinet.”

---

# 0. Companion Specs (Single Entry Index)

This inter-spec is the **single entry point** for Lexiom specifications.

## 0.1 Canonical five (authority layer)

1. **[Lexiom_Provenance_Spine_Spec_1_0.md](Lexiom_Provenance_Spine_Spec_1_0.md)** — move ledger, publish/accept, content addressing, export.
2. **[Lexiom_Temporal_UX_spec_1_0.md](Lexiom_Temporal_UX_spec_1_0.md)** — White Move → Black Move → Stability; no silent mutation.
3. **[Lexiom_Spatial_UX_spec_1_0.md](Lexiom_Spatial_UX_spec_1_0.md)** — cabinet layout, panel contracts, center playfield as sole execution surface.
4. **[Lexiom_Semantic_Arcade_UX_spec_1_0.md](Lexiom_Semantic_Arcade_UX_spec_1_0.md)** — Position→Interest→Proposal semantics, reframing, stage calibration.
5. **[Lexiom_Strategic_Semantic_UX_spec_1_0.md](Lexiom_Strategic_Semantic_UX_spec_1_0.md)** — eight-fold strategic scaffold.

## 0.2 Core integration and implementation contracts

6. **[Lexiom_Wireframe_UI_Spec_1_0.md](Lexiom_Wireframe_UI_Spec_1_0.md)** — cockpit implementation contract and interaction map.
7. **[Lexiom_AI_bus_specification.md](Lexiom_AI_bus_specification.md)** — AI-bus event envelope, publisher/consumer contract.
8. **[Lexiom_DraftFirst_Widget_Spec_1_0.md](Lexiom_DraftFirst_Widget_Spec_1_0.md)** — reusable draft-card widget contract.
9. **[Lexiom_sharing_UX_spec.md](Lexiom_sharing_UX_spec.md)** — outbound share semantics and inbound handoff expectations.

## 0.3 Peripheral specs (active)

10. **[Lexiom_Peripheral_Specs/Lexiom_first_entry_UX_spec_1_0.md](Lexiom_Peripheral_Specs/Lexiom_first_entry_UX_spec_1_0.md)** — first-entry onboarding and approval gate.
11. **[Lexiom_Peripheral_Specs/Lexiom_Case_Creation_UX_spec_1_0.md](Lexiom_Peripheral_Specs/Lexiom_Case_Creation_UX_spec_1_0.md)** — case-create handoff and corpus ingestion.
12. **[Lexiom_Peripheral_Specs/Lexiom_Draft_Flows_Spec_1_0.md](Lexiom_Peripheral_Specs/Lexiom_Draft_Flows_Spec_1_0.md)** — L24 flow topology and approved-only context policy.
13. **[Lexiom_Peripheral_Specs/Lexiom_Thinking_Transition_Slide_Implementation_Spec_1_0.md](Lexiom_Peripheral_Specs/Lexiom_Thinking_Transition_Slide_Implementation_Spec_1_0.md)** — thinking-transition behavior contract.
14. **[Lexiom_Peripheral_Specs/Lexiom_Auto_Focus_Guidance_UX_spec_1_0.md](Lexiom_Peripheral_Specs/Lexiom_Auto_Focus_Guidance_UX_spec_1_0.md)** — auto-focus trigger/behavior contract.
15. **[Lexiom_Peripheral_Specs/Lexiom_In_Band_Description_Spec_1_0.md](Lexiom_Peripheral_Specs/Lexiom_In_Band_Description_Spec_1_0.md)** — Lexiom client in-band phrase contract for GT3.
16. **[Lexiom_Peripheral_Specs/Lexiom_Invitation_Semantic_UX_Spec_v1_0.md](Lexiom_Peripheral_Specs/Lexiom_Invitation_Semantic_UX_Spec_v1_0.md)** — Accord invitation semantics.
17. **[Lexiom_Peripheral_Specs/Lexiom_Third_Party_Artifact_Reception_UX_spec_1_0.md](Lexiom_Peripheral_Specs/Lexiom_Third_Party_Artifact_Reception_UX_spec_1_0.md)** — receiver portal and in-cabinet accept/ignore semantics.
18. **[Lexiom_Peripheral_Specs/Lexiom_Accord_Mediation_UX_Specification.md](Lexiom_Peripheral_Specs/Lexiom_Accord_Mediation_UX_Specification.md)** — Accord mediation model and round semantics.

**Scope note:** This index intentionally includes active specs only; temporary drafts under `tmp/` are excluded from constitutional authority.

**Note:** This inter-spec does not restate all companion specs. It defines **how they interlock** and where each is authoritative.

---

# 1. System-Level Aim

Lexiom is a deterministic, consent-driven **Arcade Cockpit for Legal-Making**.

It is designed to:
- Eliminate silent AI behavior and background drift.
- Make every meaningful change explicit, attributable, and replayable.
- Preserve calm procedural safety (predictable structure + explicit consent).
- Convert drafting into strategy-guided progression (semantic + strategic scaffolding).
- Support solo rehearsal (Zenith) and shared constitutional collaboration (Accord).

Lexiom must feel like a **cabinet**, not a feed.

---

# 2. Five-Layer Architecture (The Lexiom Constitution)

Lexiom is governed by five orthogonal layers:

## 2.1 Provenance Layer — “The Spine”
**Answers:** *What is recorded? What is canonical? What can be audited/exported?*  
Defines immutable Moves, Draft/Publish/Accept, content addressing, full ledger export, and consensus canonization (Accord).

## 2.2 Temporal Layer — “The Rounds”
**Answers:** *When does anything change?*  
Defines White Move → Black Move → Stability; mutation authority; no silent moves; determinism constraints; concurrency bounds.

## 2.3 Spatial Layer — “The Cabinet”
**Answers:** *Where does work live?*  
Defines cockpit layout (Top HUD, Left, Center, Right, Bottom ribbon), panel contracts, and the “Center Playfield = only execution surface” rule.

## 2.4 Semantic Layer — “The Meaning Engine (Arcade)”
**Answers:** *What does this move mean? How is meaning transformed safely?*  
Defines Position→Interest→Constructive Proposal progression, reframing rules, stage calibration, shared-board tone rules, and semantic safety.

## 2.5 Strategic-Semantic Layer — “The 8-Fold Scaffold (Roy)”
**Answers:** *What is the strategic shape of the situation?*  
Defines the eight axes (positions, interests, leverage/constraints, procedural posture, risk surface, strategic pathways) and mandatory behaviors (anti-flattening, asymmetry detection, optionality preservation).

---

# 3. Orthogonality Principle (Hard Rules)

1. **No canonical mutation without a Round.**  
   - Spatial state, semantic state, and spine state do not change outside Temporal rounds.

2. **Black never mutates canonical state.**  
   - Black generates drafts and recalculates indexes only during Black Move phases.

3. **No semantic transformation enters record without explicit White authorization.**  
   - Reframes are draft-only until approved/published/accepted per the Spine.

4. **No work occurs outside the Cabinet.**  
   - All editing and approvals occur only in the Center Playfield (Spatial rule).

5. **Replay must reconstruct truth.**  
   - Canonical state must be derivable by replaying accepted Moves (Spine rule).

---

# 4. Dashboard ↔ Case Cockpit Relationship

## 4.1 Dashboard (Outside the Cabinet)
- Navigation surface.
- Lists cases + minimal metadata.
- Creates/enters cases.

**Dashboard navigates. It does not execute legal-making.**

## 4.2 Cockpit (Inside the Cabinet)
- The atomic working environment.
- All five layers apply here.
- No detached editors; no floating tools; no background mutation.

**Cockpit governs.**

---

# 5. Activity Binding Rule (Spatial ↔ Temporal ↔ Spine)

Every selectable entity in the cockpit binds **1:1** to an Activity rendered in the **Center Playfield**.

Examples (non-exhaustive):
- L1 Case Identity (draft-first editor) → Activity: edit/approve identity Move.
- L2 Topic Conversation (chat) → Activity: conversation Move(s) + structured outcomes.
- Proposed Action Item (left panel) → Activity: draft-first action item editor.
- Shared Harmony entry (right-top, Accord) → Activity: view/accept Move.
- Private Artifact (right-bottom) → Activity: edit/publish Move.

**All Activity state transitions occur via Temporal rounds and are recorded as Moves (when committed).**

---

# 6. Authority Matrix (Who Can Change What)

| Change Type | Layer Authority | Who Initiates | Where It Happens |
|---|---|---|---|
| Draft text / draft proposals | Temporal (Black Move) | Black | Center Playfield (draft surfaces) |
| Approve/edit draft into private canonical | Temporal (White Move) + Spine | White | Center Playfield |
| Publish to shared board | Spine + Temporal (White Move) | White | Center Playfield (Publish action) |
| Accept into shared canonical | Spine + Temporal (White Move) | White(s) per acceptance model | Center Playfield (Accept action) |
| Reframing / semantic transforms | Semantic (draft only) | Black proposes; White commits | Center Playfield |
| L2 trio and L3 ribbon regeneration | Temporal (Black Move) | Black after White commit | Top HUD / Bottom Ribbon |
| Entity ordering / rotation | Temporal (Black Move) | Black after White commit | Cockpit panels |
| Stage transition suggestion | Semantic/Temporal (Black Move) | Black suggests | Center Playfield prompt |
| Stage transition canonization (Accord) | Spine + Temporal | Whites publish + unanimous accept | Center Playfield |
| Artifact addressing, diff, export | Spine | System services; user triggers export | UI surfaces as implemented |
| Layout structure | Spatial | Product spec (static) | N/A (implementation constant) |

---

# 7. Determinism & Stability Guarantees

## 7.1 Stability Between Rounds
Between rounds:
- No canonical content changes.
- No index reordering drift.
- No hidden semantic mutation.
- No silent stage drift.

## 7.2 Determinism Principle
Given identical:
- accepted (canonical) state,
- latest committed White Move,
- selected L2 lens / stage context,
- relevant case inputs,

…the resulting **structural** outputs MUST be deterministic:
- which entities exist where,
- what is proposed as “the” proposed action item slot,
- what is eligible to publish/accept,
- stage label expansion/collapse rules.

(Only the natural-language phrasing of drafts may vary, within semantic safety constraints.)

---

# 8. Zenith ↔ Accord Mode Interlock (Single Cabinet)

Lexiom is implemented as **one cabinet** with two modes.

## 8.1 Zenith (Solo)
- Private canonical state only.
- Shared Harmony panel is intentionally quiet/disabled.
- Strategic depth is used as rehearsal: explore options before committing.

## 8.2 Accord (Shared)
- Multiple Whites operate in private cockpits.
- Shared Harmony is a published board.
- Canonical shared state is built only through explicit Publish + Accept (unanimous acceptance per Spine/Temporal).

## 8.3 Upgrade Path
A Zenith case may be upgraded to Accord by adding collaborators and activating shared board visibility, without changing the cabinet structure.

---

# 9. The AI Bus (Engineering Contract)

When a White commits a Move, the system dispatches an event (AI Bus).  
Listening components recompute during the subsequent Black Move, including:

- Top HUD: L1 (if applicable), L2 trio.
- Left Panel: proposed action item slot, ordering.
- Center Playfield: refreshed activity context + new drafts.
- Bottom Ribbon: new L3 statements.
- Right Panel: private artifacts inventory; shared harmony index (Accord).

**Constraint:** The AI Bus must never cause canonical mutation by itself. It only triggers recalculation/draft generation during Black Move.

---

# 10. Developer “Where To Look” Guide (Practical)

- **UI component contracts / panels / bindings:** read *Spatial* first.
- **Event loop / state transitions / concurrency rules:** read *Temporal* second.
- **Storage model / publish-accept / replay / export / diff:** read *Provenance Spine* third.
- **Reframing / tone / Position→Interest ladder / mediation logic:** read *Semantic Arcade* next.
- **8-fold strategic scaffolding / anti-flattening / optionality preservation:** read *Strategic-Semantic* last (but treat as always-on semantic posture).

---

# 11. Testing Implications (QA & Determinism)

Minimum MVP tests should validate:

1. **No silent moves:** state never mutates outside explicit White commits.
2. **Replay:** accepted Moves reconstruct canonical state deterministically.
3. **Publish/Accept invariants:** shared canonization requires explicit acceptance; unaccepted proposals remain visible.
4. **Center-only execution:** edits/approvals cannot occur in side panels.
5. **Semantic safety:** reframes are draft-only until approved; no implied liability introduced without approval.
6. **Mode correctness:** Zenith never writes to shared; Accord writes only through Publish/Accept.

---

# 12. Versioning & Governance

- This Inter-Spec is **v1.0** and is intended to remain stable throughout MVP implementation.
- Any change to:
  - acceptance authority,
  - round structure,
  - center-only execution,
  - or the five-layer orthogonality,
  
…MUST trigger a coordinated version bump across the companion specs.

---

End of Document  
**Lexiom UX Inter-Spec Constitution v1.0**
