# Lexiom Cockpit — SaaS Integration Brief

**Status:** Discussion draft  
**Scope:** GT platform placement, GT3↔SaaS interfaces, cockpit inputs/outputs  
**Authority:** [Lexiom_UX_InterSpec_Constitution_1_0.md](Lexiom_UX_InterSpec_Constitution_1_0.md), [README.md](README.md), current GT3 runtime ([server.js](../../server.js))

---

## 1. Platform placement

The **GT platform** turns language-model capability into governed, inspectable work products. **GT3** is its technological foundation: an HTTP server hosting static product surfaces, `POST /inference`, ledgers, and session telemetry. **GT2** commercializes verticals; **Lexiom** is a draft-first legal-making application under `public/gt2/Lexiom/`.

The **Lexiom cockpit** (`index.html`, `app.js`) is the full-screen **cabinet** where legal-making executes — not the case portfolio. Constitution: **the dashboard navigates; the cockpit governs.** Changes to case meaning or shared record status happen only in the **center playfield**, only through explicit **White Moves** (human commits), followed by **Black Moves** (GT3 inference), then **Stability** until the next commit. Side panels index entities; center alone executes. Draft-first cards use glyph approval; inbound shared material remains **staged** until center Accept or Ignore.

The cabinet (20/60/20 layout) comprises a Top HUD (L1 case identity, L2 topic entrypoints), left stage spine with action items, center playfield, right Shared Harmony and private artifacts, and a bottom L3 ribbon of quick strategic statements. **Zenith** is solo rehearsal with private canonical state; **Accord** adds multi-party collaboration through publish/accept on a shared board — one cabinet, two modes.

Technically, Lexiom is an **applicational subsystem** on the GT3 web server, not a separate microservice. Browsers load `/gt2/Lexiom/index.html`; Black Moves call `/inference` via `gt3-client.js` with tenant headers.

---

## 2. Deployment boundary

| Owner | Responsibilities |
|-------|------------------|
| **SaaS platform** | SSO, org tenancy, case list, parties, billing, document master store, CRM/calendar, entitlements |
| **GT3 server** | Lexiom SPA, inference, Lexiom API routes, session logs, game-record APIs, inference ledger |
| **Cockpit** | Constitutional legal-making loop, draft-first UX, White/Black round orchestration |

**Existing GT3 Lexiom routes:** `POST /lexiom/accord/create`, `POST /lexiom/artifact/publish`, receiver portal at `/lexiom/artifact/share/:resourceId`, `POST /lexiom-session/event`, `GET /game-records` and `/game-records/:id/essence`.

**Demo divergences for SaaS:** dashboard is spec'd but not built; profile and API keys live in `localStorage`; case handoff uses `sessionStorage` and query params; artifacts persist under repo-local `Accords/`; full Provenance Spine replay is specified but only partially implemented.

---

## 3. GT3 ↔ SaaS interfaces

**Identity and case open.** SaaS authenticates users. On “open matter,” it issues a short-lived **case-open JWT** carrying `sub`, `org_id`, `case_id`, `gt3_tenant`, `case_mode` (`ZENITH`|`ACCORD`), and permissions. Browser enters via `GET /gt2/Lexiom/index.html?caseToken=<jwt>`. GT3 validates and maps claims to headers (`X-GT3-Tenant`, `X-GT3-Game-Record`). Replace manual browser API-key entry with org-scoped credentials.

**Case bootstrap.** Replace ad hoc demo paths — `lexiom_pending_case_handoff_v1`, `?accord=`, `?inboundArtifact=` — with one envelope, e.g. `GET /lexiom/cases/:caseId/bootstrap`, returning: `case_id`, `game_record_id`, `mode`, `locale`; `player_profile` snapshot; `case_seed` (markdown + optional intent); `corpus_refs[]` pointing to SaaS document fetch URLs; optional resume checkpoint and inbound accord/artifact reference.

**Document corpus.** Demo reads local folders in-browser. SaaS exposes list plus extracted-text fetch; GT3 applies case-create caps (~24 files, ~400k characters total).

**Collaboration.** Existing publish/accord routes remain; add tenant scoping. Target: SaaS webhooks on publish/accept; index `resourceId` to `case_id`.

**Telemetry and dashboard reads.** Existing: session events in `logs/{game_record_id}/session_events.jsonl`, essence API, inference ledger for ops/billing. Target: `GET /lexiom/cases?org_id=` returning derived **case summaries**; webhooks on White Move commits only — not keystrokes or unapproved drafts.

**Deployment.** SaaS provides Node hosting, TLS, secrets, persistent volumes for logs and artifact store. GT3 expects Node ≥18 and writable `logs/`, ledger, and artifact directories.

---

## 4. Cockpit inputs

**Player profile** — role, value proposition, GT3-generated draft identity, approved outbound voice, locale. Shapes advisory tone and gates first entry. Demo: `lexiom_first_entry_profile_v1` in localStorage. SaaS: identity snapshot at bootstrap.

**Case binding** — `case_id` (SaaS matter ID), `game_record_id` (GT3 session UUID under `logs/`), `mode`, optional stage/round on resume.

**Case seed narrative** — primary markdown context for L1, L2, L24 flows, action items, artifacts. Schema aligns with `lexiom_pending_case_handoff_v1`: `title`, `content`, optional `caseIntent`. Always proposed at entry; canonical only after in-cockpit approval. Alternate entry: accord shared playfield or inbound published artifact.

**Document corpus** — extracted text from matter files for seed synthesis and Black Move context, subject to file-count and character caps.

**Inbound collaboration** — accord resource ID or published artifact ID. Constitution: never canonical on arrival; center Accept required.

**Runtime** — inference URI, tenant headers, org inference credentials, UX flags (`skipIntro`, gradual panel reveal).

**Explicitly not required:** pre-approved L1 bypassing center playfield, SaaS billing/CRM fields, real-time co-editing cursors.

---

## 5. Cockpit outputs (GT3-persisted)

Peripheral services — especially a **cases dashboard** — consume GT3-persisted outputs, not live cockpit RAM.

**Session events (CaseLake).** Append-only `session_events.jsonl` via `POST /lexiom-session/event`. Types today: `l23_qa_turn`, `l24_approved`, `action_item_approved`, `artifact_approved`. Grouped via `GET /game-records/:id/essence`. Dashboard: activity timeline and semantic milestones.

**Published artifacts.** Markdown snapshots via `POST /lexiom/artifact/publish`; returns `resourceId`, `fileUrl`, `sharePortalUrl`. Dashboard: deliverables list and share links.

**Accord seeds.** Shared playfield markdown via `POST /lexiom/accord/create`; returns collaborator deep link. Dashboard: collaboration status.

**Game record index.** `GET /game-records` lists sessions with `last_activity_at`. Join to SaaS `case_id` via mapping table.

**Target projections.** `lexiom_case_summary.v1` — derived row: L1 title, mode, stage, approved action/artifact counts, last activity. Provenance **Move ledger** per Spine spec for replay and Published/Accepted badges (not fully implemented in demo).

**Not persisted by design:** unapproved Black drafts, uncommitted chat, in-progress edits — consistent with White→Black→Stability law.

Billing meters inference ledger entries tagged with `X-GT3-Tenant`.

---

## 6. Non-negotiables

1. Center-only execution and approval  
2. No silent mutation; inbound links do not canonize without Accept  
3. External integration on **White commits** and **publish/accept**, not raw model output  
4. GT3 inference traceability (ledger + LexiLake / CaseLake)  
5. SaaS owns navigation and matter master data; cockpit owns the governed legal-making loop  

---

## 7. Next design steps

1. Freeze JWT and bootstrap schemas  
2. Define `case_id` ↔ `game_record_id` mapping and case-summary projection  
3. Scope tenant-scoped artifact storage  
4. Extend session event types for stage transitions and accord accept/ignore  
5. Plan checkpoint API for full Spine replay beyond demo milestones
