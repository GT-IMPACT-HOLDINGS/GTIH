# Causal Lineage Chat for Success Evidence Review

## 20.1 Overview

In some embodiments, Lexiom may provide a **Causal Lineage Chat** capability for assisting a user, player, reviewer, stakeholder, or OSN owner in understanding why a System Under Development (“SUD”) looks, feels, reads, sounds, or behaves in the manner presented through captured success evidence.

This capability may be activated when a success evidence artifact, such as a playable demo, screenshot, video clip, audio recording, clause, visual screen, code behavior, workflow simulation, or other inspectable artifact, is displayed in the Center Playfield of the Lexiom Cockpit. While such evidence is displayed, the L3 bottom ribbon may be populated with a chat window or other natural-language interaction component. Questions entered into this component are interpreted as being semantically scoped to the currently displayed success evidence and to the OSN context from which such evidence was derived.

Accordingly, a question such as “Why is this button here?”, “Why does this flow require approval?”, “Why was this warning phrased softly?”, “Which OSN caused this behavior?”, or “Which success evidence is this screen satisfying?” is not treated as a general-purpose language-model question. Instead, Lexiom treats the question as a causality request concerning the currently presented look, feel, behavior, wording, structure, or interaction of the SUD.

## 20.2 Context-Bounded Inference Request

When the user submits a causal question, Lexiom may generate a bounded inference request to one or more language models, semantic engines, reasoning engines, or GT3-like systems. The request may include a context package comprising at least a portion of the following:

- the currently displayed success evidence;
- the OSN currently presented or selected;
- the OSN seed;
- approved thematic discipline lenses;
- approved output specification;
- approved success-evidence definitions;
- captured success evidence metadata;
- parent OSN references;
- descendant OSN references;
- organizational-standard ancestor OSNs;
- derivative discipline OSNs;
- approved human answers;
- approved Concordance resolutions;
- build or compilation-root metadata;
- lineage evidence references;
- operative policy permissions;
- matrices or other process data that the applicable policy permits to be shared.

The language model is thereby instructed to reason inside the approved semantic territory associated with the displayed success evidence, instead of freely generating an explanation from general knowledge alone.

## 20.3 Causal Explanation Types

Lexiom may classify each generated explanation into one or more causal categories.

An **Approved Cause** is an explanation directly supported by approved OSNs, approved output specifications, approved success-evidence definitions, approved discipline lenses, approved ancestor nodes, approved human answers, approved organizational standards, or approved Concordance resolutions. In the current Lexiom 1.3 Causal Lineage Chat build, `APPROVED_CAUSES` bullets are constrained further: each approved cause must include a verbatim quote from `output_spec` text only (Focus OSN first; ancestor `output_spec` only afterward). Seed, thematic lenses, and success-evidence definitions may inform inferred or missing causes, but must not be quoted under `APPROVED_CAUSES`.

An **Inferred Cause** is an explanation that is plausible in view of the approved semantic context, but is not directly established by an approved record. Such an explanation may be presented with a lower authority status and may invite the user to approve, correct, reject, or convert the inference into a new OSN, annotation, question, or issue.

A **Missing Cause** is reported when Lexiom cannot identify approved lineage explaining the displayed feature, behavior, phrase, or design choice. In this case, Lexiom may indicate that the displayed SUD behavior exists without sufficient approved causal support and may propose corrective actions, such as creating a new OSN, requesting owner clarification, adding a success evidence, reopening a specification, or flagging a lineage gap.

## 20.4 User Interface Behavior

In the Lexiom Cockpit, the Center Playfield may continue to display the success evidence while the L3 ribbon hosts the causal chat. The L2 panel may simultaneously render a Lineage Evidence Prism showing the relevant OSNs, approved fragments, standards, discipline lenses, and human decisions that support the answer.

**Current Lexiom 1.3 build:** when a Lineage narrative (or Proposed Output Spec) is revealed in the Center Playfield, it replaces the evidence viewer as a solo draft-first card. That card uses the same IDE-style `lexiom-draft-card-editor` shell as other Center drafts, and the editor consumes the remaining height of the narrative card below its header (full-card fill — not a content-capped strip).

The user may ask follow-up questions without restating the evidence context. Lexiom may assume that each follow-up remains scoped to the currently displayed success evidence unless the user explicitly changes the selected OSN, selected evidence artifact, or selected portion of the SUD.

For example, if a playable demo is paused on an onboarding screen, the user may ask: “Why does this screen ask for confirmation before continuing?” Lexiom may answer that the confirmation was caused by a Security OSN inherited from an organizational standard, reinforced by a UX OSN requiring explicit user confidence, and validated by a success evidence requiring the user to see and approve the confirmation flow.

## 20.5 Canonical State and Approval Discipline

Causal Lineage Chat does not, by itself, mutate canonical state. The user’s question may be recorded as part of the review history. The system’s answer remains a Black Move output unless and until a qualified human approves it, converts it into an OSN, accepts it as an annotation, or uses it to trigger another approved workflow.

If the user provides a corrective answer, such as “No, this behavior exists because of the legal-risk requirement, not because of UX,” that human answer may become approved evidence or may initiate a new White Move according to the applicable operative policy.

Thus, the chat interface allows causal inquiry without weakening Lexiom’s deterministic temporal model.

## 20.5.1 Post-approval player asks (Q / A)

After a human glyph-approves a lineage narrative for the open evidence, the same L3 **Your ask** box may accept further asks. Lexiom shows an unlock status and sends those asks to GT3 with a request to classify intent as binary **ASK_KIND**:

- **Q** — question / request for knowledge → Lexiom presents a Lineage narrative (same draft-first center path as the initial causal question).
- **A** — request for an act on the player’s behalf → Lexiom presents a Proposed Output Spec draft for the Focus OSN; glyph approval applies that text into the Focus OSN `output_spec` draft card without silently mutating canonical YAML.

Clear imperative change asks (for example “change buttons color to green”) are detected by Lexiom after unlock and routed through an A-only output_spec proposal narrative, so they do not depend on soft model classification.

Until at least one lineage narrative for that evidence is approved, the ask box remains causal-explanation only.

## 20.6 Technical Advantages

The Causal Lineage Chat provides several technical advantages:

- transforms success-evidence review from passive inspection into interactive causal inquiry;
- reduces the user’s need to manually search the OSN graph;
- helps stakeholders understand which approved intentions shaped visible SUD behavior;
- distinguishes approved causes from inferred explanations and missing lineage;
- exposes features or behaviors that lack approved semantic support;
- supports faster correction of specification gaps;
- improves trust in generated demos, builds, clauses, and artifacts;
- preserves the distinction between model-generated explanation and human-approved canonical state;
- enables replayable review sessions in which questions, answers, evidence, and lineage remain traceable.

## 20.7 Concluding Description

In this manner, Lexiom may allow a user to treat each displayed success evidence artifact as an entry point into the causal history of the SUD. The success evidence shows the fruit of the development process, while the Causal Lineage Chat explains the approved roots, branches, standards, human decisions, and missing links that caused such fruit to appear.

The capability thereby extends Lexiom from a system that helps humans approve outcomes into a system that also helps humans understand why approved or proposed outcomes have taken their visible, behavioral, linguistic, or experiential form.
