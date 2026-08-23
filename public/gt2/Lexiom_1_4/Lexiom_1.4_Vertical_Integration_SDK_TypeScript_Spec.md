# Lexiom 1.4 Vertical Integration SDK --- TypeScript Design Specification

## Objective

Lexiom 1.4 shall expose a small TypeScript SDK that allows vertical
applications such as **TheReasoningHub (TRH)** and **Tegria.ai** to
consume Lexiom capabilities without depending on Lexiom internals.

The SDK shall encapsulate exactly three primary API domains:

1.  **Conversational Intelligence API**
2.  **Realization API**
3.  **Embedded Experience API**

All three shall follow one consistent interaction model:

**commands in → typed semantic events out → structured final
state/result**

The vertical owns presentation, branding, local state, and authoritative
business data. Lexiom owns reasoning, execution behavior, capability
semantics, provenance, and capability usage.

## 1. Conversational Intelligence API

Provide a TypeScript client representing a Lexiom conversational
session.

The vertical shall be able to create or resume a conversation session,
submit a **single outcome description** (`generateOsn`) so Lexiom can
compose a YAML OSN internally, query the current conversation state, and
receive an explicit `buildReady` indication when both hemispheres are
sufficient. Multi-turn `postMessage` remains available as Follow-up and
is not required for POC readiness.

The API must not expose OSN terminology or internal graph mechanics to
the human-facing vertical workflow. `osn_yaml` returned by `generateOsn`
is an **opaque** snapshot for vertical SoR persist; Lexiom owns
`output_spec`, direct Success Evidences, and other OSN structure.

The conversation client shall publish typed lifecycle events such as
`messageAccepted`, `questionGenerated`, `intentUpdated`,
`buildReadinessChanged`, `warning`, and `error`.

## 2. Realization API

Provide a TypeScript client for initiating and observing a Realization
session.

A vertical shall issue a Realization command when the user selects
**Build / Realize**.

Lexiom shall internally derive the required OSN structure and invoke the
Realization Agent, including Hanuman or another appropriate execution
agent.

The session shall stream typed events such as `realizationStarted`,
`stepStarted`, `stepProgress`, `stepCompleted`, `evidenceProduced`,
`artifactUpdated`, `realizationCompleted`, and `realizationFailed`.

The final result shall return a structured **Realization Package**
containing artifact references or payload descriptors, Success
Evidences, execution status, provenance, and relevant metering metadata.

## 3. Embedded Experience API

Provide reusable TypeScript-accessible Lexiom widgets and view-models
for capabilities such as graph visualization, Evidence inspection, or
Cockpit experiences.

Lexiom shall own widget behavior and semantic state; the vertical shall
own appearance.

Components must therefore support configurable design tokens, themes,
node styles, colors, typography, spacing, and host-controlled
composition.

Widgets shall accept imperative commands and emit typed semantic events
such as `selectionChanged`, `stateChanged`, `itemActivated`,
`viewportChanged`, `dataUpdated`, and `error`.

Lexiom events must describe **what happened**, never prescribe how the
vertical should render it.

## Shared SDK Requirements

All APIs shall use shared primitives for authentication and scoped
authorization, session identifiers, typed events, subscription and
unsubscription, errors and status objects, cancellation, provenance
identifiers, and version metadata.

Prefer interfaces and discriminated TypeScript unions over loosely
structured objects.

The SDK shall expose stable public contracts while hiding transport
details such as HTTP, WebSocket, worker messaging, or remote execution.

The central engineering principle is that a vertical developer should
learn **one interaction pattern once** and then apply it consistently
across conversation, realization, and embedded Lexiom capabilities.

## Normative TypeScript contracts

Phase (a) frozen shapes for `lexiom14/1.0` are in
[`contracts/lexiom14-api.d.ts`](contracts/lexiom14-api.d.ts), with companion
docs:

- [`contracts/events-catalogue.md`](contracts/events-catalogue.md)
- [`contracts/realization-package.md`](contracts/realization-package.md)
- [`contracts/trh-lifecycle.md`](contracts/trh-lifecycle.md) (vertical case
  states; package persist ≠ canonical)
- [`contracts/routes.md`](contracts/routes.md)

**MVP locks reflected in contracts:** document Realization profile; TRH
origin COOP/COEP for in-page CA; session-scoped replica; Realization
Package auto-handoff without GTIH canonization of vertical SoR.

**Vocabulary note:** SDK public fields use neutral structure/readiness
language. Verticals such as TRH may map those fields onto their own
Output Specification / Success Evidence / graph terminology in UX
without Lexiom product chrome.
