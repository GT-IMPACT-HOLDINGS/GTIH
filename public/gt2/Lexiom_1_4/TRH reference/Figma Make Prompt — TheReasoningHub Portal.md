# Figma Make Prompt — TheReasoningHub Portal

Design a responsive web application called **TheReasoningHub (TRH)**: a conversation-first environment where users transform an idea into a structured, realized, and human-validated artifact.

## Primary Experience

Make the **conversation with the TRH Agent** the dominant entry point. The interface should initially feel simple and approachable, similar to a modern AI workspace. The Agent asks progressive questions until it understands what the user wants to create.

As understanding develops, progressively reveal the underlying **OSN Graph**, consisting of:

- **Output Specifications** — what must be realized.
- **Success Evidences** — what must be observed to prove successful realization.

Avoid overwhelming users with graph complexity initially. Use progressive disclosure.

## Realization Experience

Provide a clear **Realize** action. Realization is executed through **Lexiom 1.4 embedded capabilities** exposed to the TRH frontend.

During execution, show understandable progress rather than infrastructure details. The same UX must work regardless of whether the Lexiom Realization Agent executes inside a browser WebContainer, customer-managed container infrastructure, or distributed cloud compute.

Execution location is an implementation detail, not the center of the user experience.

## Realization Result

Present the result as one coherent **Realization Package** containing:

**Artifact + Success Evidences + provenance/status information.**

Create an evidence-review workspace where the user can inspect screenshots, recordings, code snippets, test results, or other direct evidences associated with individual OSNs.

Allow each required evidence to be explicitly approved by the human user.

Clearly distinguish these states visually:

**Draft → Ready to Realize → Realizing → Evidence Review → Human Approved → Canonical / Signed**

Canonical status must only appear after all required direct Success Evidences have received human approval.

## OSN Graph & Cockpit

Provide an optional advanced **Cockpit** where users can inspect and navigate the OSN Graph across its **semantic, spatial, and temporal planes**.

Allow users to move naturally between:

**Conversation ↔ OSN Graph ↔ Realization ↔ Evidence Review ↔ Canonical Artifact**

These should feel like different views of the same evolving object, not separate applications.

## Agent Delegation

Include an unobtrusive mechanism allowing the user to authorize an external Agent to act on their behalf. The UX should communicate authorization scope clearly and distinguish actions performed by the human from actions performed by delegated Agents.

## Embedded Lexiom Boundary

Design reusable UI components with a clean integration boundary for **Lexiom 1.4 APIs/components**. TRH owns its branding, navigation, user experience, and authoritative OSN/OSNG state. Lexiom supplies embedded reasoning, OSN operations, Realization, Evidence, and Cockpit capabilities.

Do not visually expose Lexiom as a separate product during normal workflows. Its capabilities should feel native to TRH.

## Visual Direction

Use a sophisticated, calm, high-trust visual language: spacious layouts, restrained color, excellent typography, subtle depth, and minimal visual noise.

The interface should communicate a progression from **human intention → structured specification → realization → evidence → human trust**.

Prioritize clarity over decoration and progressive disclosure over dashboards crowded with controls.

Create desktop-first responsive designs, reusable Figma components, component states, interaction patterns, and representative screens covering the complete end-to-end journey.