# Lexiom 1.4 — Platform Routes Sketch (`lexiom14/1.0`)

GT3 host origin (example): `http://localhost:8080`  
All paths below are relative to that origin.  
Auth: `Authorization: Bearer <delegated_token>` unless noted.

**Status:** Phase (b) implemented on GT3 (`lib/lexiom14*.js`, `POST/GET /lexiom14/v1/*`). Contracts remain normative.

## Route map

### Session / conversation

| Method | Path | Command |
|--------|------|---------|
| `POST` | `/lexiom14/v1/sessions` | Create conversation session (optional `seed_snapshot`) → `{ session_id }` |
| `GET` | `/lexiom14/v1/sessions/:sessionId` | `getState` (includes opaque `osn_yaml` after generate) |
| `POST` | `/lexiom14/v1/sessions/:sessionId/osn` | `generateOsn` `{ outcome_description }` → `{ structure, build_readiness, osn_yaml }` |
| `POST` | `/lexiom14/v1/sessions/:sessionId/messages` | Follow-up `postMessage` `{ text, client_message_id? }` — not required for `build_readiness` after generateOsn |
| `GET` | `/lexiom14/v1/sessions/:sessionId/events` | **SSE** conversation (+ shared session) event stream |

### Realization (document MVP)

| Method | Path | Command |
|--------|------|---------|
| `POST` | `/lexiom14/v1/sessions/:sessionId/realization` | `startRealization` `{ profile: "document" }` → `{ realization_id }` |
| `GET` | `/lexiom14/v1/sessions/:sessionId/realization/package` | Latest `RealizationPackage` or 404 |
| `GET` | `/lexiom14/v1/sessions/:sessionId/realization/events` | **SSE** realization events (or multiplex on session events) |

### Artifacts / evidences

| Method | Path | Command |
|--------|------|---------|
| `GET` | `/lexiom14/v1/artifacts/:artifactId` | Fetch artifact bytes/metadata |
| `GET` | `/lexiom14/v1/evidences/:evidenceId` | Fetch evidence bytes/metadata |

### Metering (vertical-owner read)

| Method | Path | Command |
|--------|------|---------|
| `GET` | `/lexiom14/v1/metering/events` | List consumption events for caller’s `vertical_id` (scoped) |

### Health

| Method | Path | Command |
|--------|------|---------|
| `GET` | `/lexiom14/v1/version` | `{ api_version: "lexiom14/1.0" }` |

## SSE conventions

- `Content-Type: text/event-stream`
- Each `data:` line is JSON for one `EventEnvelope`
- Heartbeat comments (`: ping`) allowed
- Client reconnect may use `Last-Event-ID` when implemented (Phase b+)

SDK hides SSE vs fetch details behind `subscribe()`.

## CORS (separate TRH origin)

GT3 **must** allowlist configured TRH origins for `/lexiom14/*`:

- `Access-Control-Allow-Origin: <TRH origin>` (not `*` when credentials used)
- `Access-Control-Allow-Credentials: true` when cookie/credential mode requires it
- `Access-Control-Allow-Headers` includes `Authorization`, `Content-Type`, and any Lexiom POC headers
- Preflight (`OPTIONS`) supported on mutating routes and SSE if required by browser

POC default allowlist example: `http://localhost:4173` (TRH static), `http://127.0.0.1:4173`.

## COOP / COEP (TRH origin — mandatory for MVP CA)

Realization document CA / WebContainer runs **in the TRH page**. The **TRH static server** (second origin) must send:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp` (or documented equivalent that enables `crossOriginIsolated`)

GTIH iframe embedding is **out of scope** for MVP.

GT3 artifact/evidence responses consumed by a COEP page may need `Cross-Origin-Resource-Policy: cross-origin` (or CORP-compatible hosting) so TRH can fetch them — Phase b must verify.

## Credential mint

Vertical (TRH) mints short-lived delegated credentials carrying `PseudonymousIdentity` + scopes.  
GT3 validates token, scope, and `session_id` binding on `/lexiom14` routes.  
Mint endpoint is **vertical-owned** (not specified as a GTIH public product API in `lexiom14/1.0`); POC may use a TRH helper that GT3 accepts via a shared secret / demo issuer config (Phase b).

## Catalogue mapping (commercial ↔ 1.4)

| Capability | `lexiom14/1.0` surface |
|------------|------------------------|
| Conversational structure formation | `/sessions`, `POST .../osn` (single-prompt YAML OSN), optional messages, events |
| Document Realization | `/realization` + package |
| Evidence / graph embeds | SDK Embed client (may be client-only + artifact GETs) |
| Metering read | `/metering/events` |

Do not require verticals to call `/lexiom13/*` for this program.

## Non-goals

- Separate commit/sync routes
- Software realization routes
- Royalty allocation UI APIs
- Mutating Lexiom 1.3 disk OSNs as vertical SoR
