# Lexiom 1.4 — Events Catalogue (`lexiom14/1.0`)

All events are `EventEnvelope<type, payload>` from [`lexiom14-api.d.ts`](lexiom14-api.d.ts).

Shared envelope fields: `api_version`, `type`, `session_id`, `occurred_at`, optional `provenance_id`, `payload`.

## Conversational Intelligence

| `type` | When | Payload highlights |
|--------|------|--------------------|
| `messageAccepted` | User message accepted into session | `message`, optional `client_message_id` |
| `questionGenerated` | Lexiom/assistant question or reply | `message` |
| `intentUpdated` | Captured intent summary changed | `summary` |
| `structureUpdated` | Session replica structure summary changed | `structure` (nodes + hemispheres) |
| `buildReadinessChanged` | Ready-to-realize gate flipped or reasons changed | `readiness` (`ready`, `hemispheres`, `reasons`) |
| `warning` | Non-fatal issue | `warning: OperationError` |
| `error` | Fatal conversational error | `error: OperationError` |

**Readiness rule (MVP):** `build_readiness.ready === true` only when **both** hemispheres report ready (`output_spec_ready` and `success_evidence_ready`). POC happy path: both become ready after a successful `generateOsn` (single outcome description). Multi-turn `postMessage` remains Follow-up and is not required.

## Realization (document profile)

| `type` | When | Payload highlights |
|--------|------|--------------------|
| `realizationStarted` | Realization accepted | `profile: "document"`, `run_status` |
| `stepStarted` | Internal step begins | `step_id`, `label` (human-readable; not infra) |
| `stepProgress` | Progress within a step | `step_id`, optional `ratio`, `message` |
| `stepCompleted` | Step finished | `step_id` |
| `evidenceProduced` | A success evidence item became available | `evidence` |
| `artifactUpdated` | Document artifact pointer/content updated | `artifact` (`media_kind: "document"`) |
| `realizationCompleted` | Terminal success | `package: RealizationPackage` |
| `realizationFailed` | Terminal failure | `error`, `run_status: "failed"` |

**UX note:** Step labels must not require the vertical to expose WebContainer, broker, or cloud topology.

**Handoff:** On `realizationCompleted`, the vertical **auto-persists** `package` into its SoR. That does **not** make the case Canonical (see [`trh-lifecycle.md`](trh-lifecycle.md)).

## Embedded Experience

| `type` | When | Payload highlights |
|--------|------|--------------------|
| `selectionChanged` | Selection changed | `id`, `surface` |
| `stateChanged` | Semantic widget state changed | `surface`, `state` |
| `itemActivated` | Item activated (e.g. open evidence) | `id`, `surface` |
| `viewportChanged` | Viewport/camera changed | `surface`, `viewport` |
| `dataUpdated` | Bound data refreshed | `surface` |
| `error` | Embed failure | `error`, `surface` |

Events describe **what happened**, never how to paint pixels.
