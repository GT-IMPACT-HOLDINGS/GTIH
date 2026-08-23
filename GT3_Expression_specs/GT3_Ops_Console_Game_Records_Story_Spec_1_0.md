# GT3 Ops Console — Game Records Story Exposition (v1.0)

**Status:** Spec (proposal) — describes intended Game Records plane; **not** current console behavior  
**Audience:** GT3 ops authors, Lexiom / Lexiom 1.3 authors, CaseLake / LexiLake integrators  
**Applies to:** GT3 LM Ops Console tab **Game records** (`public/gt3/gt3.html` → `#tab-game-records`) and the server projections that feed it  
**Companions:**
- [../Lexiom_GT3_Data_Lakes_Spec_1_0.md](../Lexiom_GT3_Data_Lakes_Spec_1_0.md) (LexiLake / CaseLake vocabulary)
- [../public/gt2/Lexiom/Lexiom_UX_InterSpec_Constitution_1_0.md](../public/gt2/Lexiom/Lexiom_UX_InterSpec_Constitution_1_0.md) (White → Black → Stability; attributable Moves)
- [../public/gt2/Lexiom/Lexiom_Cockpit_SaaS_Integration_Brief.md](../public/gt2/Lexiom/Lexiom_Cockpit_SaaS_Integration_Brief.md) (session events + game-record APIs today)
- [GT3_Ops_Console_Agent_Traffic_Spec_1_0.md](GT3_Ops_Console_Agent_Traffic_Spec_1_0.md) (Logs / Dashboard agent lane — adjacent, not the story plane)
- [../public/gt2/Lexiom_1_3/BuildPlugins/Lexiom_1_3_Virtualized_Agent_Loop_1_0.md](../public/gt2/Lexiom_1_3/BuildPlugins/Lexiom_1_3_Virtualized_Agent_Loop_1_0.md) (Hanuman/CA ↔ LM crossings under a `run_id`)
- [../public/gt2/Lexiom_1_3/Lexiom_1_3_Center_Playfield_Build_Artifact_Review_UX_Spec_1_0.md](../public/gt2/Lexiom_1_3/Lexiom_1_3_Center_Playfield_Build_Artifact_Review_UX_Spec_1_0.md) (`bud` / SUD bloom — player-facing; Game Records remains ops review)
- Repo root [../README.md](../README.md)

---

## Governance note

Checked: root README (traceability; Ops Agent Traffic as adjacent observability), Lexiom Constitution (§2–§5: Spine + Temporal rounds; replay must reconstruct truth), Data Lakes (LexiLake ingestion of White inputs and game context), Cockpit SaaS brief (CaseLake session essence), Ops Agent Traffic (lane separation: product inference vs agent broker), VAL / Bud (build chapter stitch `osn → run → session → exchange`).

**Assumption (design center):** Lexiom **1.3** White Moves, build chapters, and Hanuman (CA)↔LM Black Move packets are the primary story the Game Records plane must eventually narrate. Classic Lexiom session essence (`l23_qa_turn`, `l24_approved`, …) remains a first-class, already-durable chapter family and must keep rendering.

**Known divergence (code today):** Game Records is a read-only UUID list + flat newest-first essence dump of four classic event types. Lexiom 1.3 `actionLog` is RAM-only; 1.3 `/inference` does not send `X-GT3-Game-Record`; agent exchanges live under `logs/agent_broker/<exchange_id>/` keyed by `run_id`, not by game record. Grouped essence projections are unused in the UI.

This document does **not** claim the intended story view is implemented.

---

## 1. Purpose

An administrator opening **Game records** must be able to **read the game’s story** — not merely scan raw telemetry.

The plane answers:

1. What **White Moves** did the player commit (approve, branch, prune, canonize, prepare/run, evidence attest…)?
2. What **Black Moves** answered (product inference and/or Hanuman↔LM crossings), and in what order relative to those White Moves?
3. Where did the board reach **Stability**, and what durable artifacts or `bud` bloom closed a chapter?
4. How do Lexiom↔GT3 inferences and LM packets nest inside that story without becoming a second Logs tab?

Game Records is the **CaseLake / LexiLake story spine**. Dashboard and Logs remain the **ops traffic / packet inspector** lanes. The story plane may deep-link into exchange detail; it must not replace Agent Traffic counters or bringup cards.

### 1.1 Naming — Ram and Hanuman

In this story plane, the Lexiom player/user is **Ram**: White authority, throne of consent, whose Moves settle meaning. The Compilation Agent (CA) is **Hanuman**: devotee, not sovereign. Hanuman crosses into workspaces, carries tools, and acts in accordance with the GT3 LM serving model — leaping the broker path, returning drafts and artifacts — without claiming the throne. Black Move beats that nest spoken content and tool Moves are Hanuman’s crossings in Ram’s service. Game Records narrates that devotion; it never elevates the agent above Ram’s approval. Technical specs may still say CA; the Game Records face prefers **Hanuman**.

---

## 2. Design principle — story before substrate

| Layer | Role |
|---|---|
| **Story spine** | Chronological chapters a human can follow: White commit → Black reply → Stability / artifact |
| **Semantic cards** | One job per event: title, when, who/what mutated, short excerpt |
| **Dialogue nest** | Expandable Black Move body: spoken assistant content + tool Moves (when agent) |
| **Audit depth** | Raw JSONL, folder browse, full redacted exchange packet — one click away, never the default face |

**Cabinet analogy for ops:** the left column is the case shelf; the right column is the Center Playfield for *reading* one game’s replay — not for executing legal-making.

---

## 3. Operator jobs (acceptance narrative)

Without reading `server.js`, an operator must be able to:

1. Find a game by id / last activity and open its story.
2. See a **chronological** (oldest→newest default, with toggle) sequence of semantic beats — not only newest-first JSON dumps.
3. Distinguish **White** vs **Black** vs **system/stability** beats at a glance.
4. Expand a Black beat to read the dialogue (product narrative reply **or** Hanuman’s spoken content + tool Moves).
5. Jump from a build chapter to its phase ledger summary and nested exchanges (`exchange_id` → existing `/ops/agent-exchanges/:id` inspector pattern).
6. Export the story as Markdown that preserves chapter headings and dialogue excerpts.
7. Reach raw LexiLake files when audit requires them.

---

## 4. UI composition (intended)

Preserve the existing two-column console pattern.

### 4.1 Left — Sessions (shelf)

- Rows remain selectable (`role=option`), keyboard Enter/Space.
- Each row shows: short id (mono), **last activity**, and a **chapter hint** when known (e.g. classic CaseLake vs Lexiom 1.3, mode, root OSN id, latest `run_id`).
- Affordances: Refresh; optional filter text (id / OSN / run substring); empty and error states as today.
- Selecting a session loads the **story projection** (not only classic essence).

### 4.2 Right — Story (playfield)

Header strip (one composition, not a dashboard of cards):

- Game record id + time span
- Links: raw folder browse, Markdown download
- View mode: **Story** (default) | **Raw essence** (escape hatch for today’s dump)

Story body is a vertical **chapter list**, oldest→newest by default:

```text
#game-records-detail
└─ .gt3-game-story
   ├─ .gt3-game-story-header
   └─ .gt3-game-story-chapters
      └─ .gt3-game-beat[data-beat-kind=white|black|stability|build]
         ├─ .gt3-game-beat-rail   (kind glyph / label)
         ├─ .gt3-game-beat-main
         │  ├─ title + timestamp
         │  ├─ one-line semantic summary
         │  └─ (optional) expand → dialogue / tools / payload excerpt
         └─ .gt3-game-beat-links (exchange, inference log, artifact)
```

**No hero clutter:** first viewport of a selected session is header + beginning of the story, not stats strips or multi-filter chrome.

### 4.3 Beat kinds (semantic face)

| Kind | Lexiom temporal meaning | Examples |
|---|---|---|
| **White** | Human authorization / structural Move | Classic: `l24_approved`, `action_item_approved`, `artifact_approved`. Lexiom 1.3: approve/unapprove, branch, prune, canonize/persist, evidence approve, prepare authorized, `/run` authorized |
| **Black** | Model / Hanuman reply during Black Move | Classic: `l23_qa_turn` (pair user+assistant). Product: inference ledger row joined by `game_record`. Agent: Hanuman↔LM exchange nested under a build chapter |
| **Stability** | Board settled; durable outcome visible | Round/session idle markers; publish/share URLs; `bud_written` / RUN_RESULT completion |
| **Build** | Chapter container for VAL | Prepare → run → phase crossings → RUN_RESULT / BUILD_MANIFEST summary |

Unknown or unmapped raw events render as a muted **system** beat with expandable JSON — never crash the story.

### 4.4 Dialogue nest (Black Move packet)

When expanded, a Black beat shows:

1. **Spoken face** — assistant / product response text the human would have read (same spirit as Logs `#logs-response-content`).
2. **Tool Moves** (agent lane only) — ordered tool names + short arg summary; full redacted packet behind “Open exchange” (reuse Ops agent exchange inspector / `/ops/agent-exchanges/:exchangeId`).
3. **Request context** (collapsed by default) — user/system excerpt or narrative type, not the full prompt wall.

**Lane integrity:** product inference Black beats and agent-broker Black beats must remain visually labeled as distinct lanes (per Agent Traffic Spec §2). Never imply a direct Anthropic peer.

### 4.5 Filters (story plane only)

Minimal, one purpose: help an admin find beats inside a long game.

- Kind chips: White / Black / Build / Stability (multi-select, default all on)
- Optional type subset once event vocabulary grows
- Search: substring over titles, OSN ids, `run_id`, `exchange_id`

No pagination required in v1 if the projection is capped and lazy-expands dialogue bodies.

---

## 5. Story projection (data contract)

### 5.1 Identity stitch

| Plane | Correlation key | Notes |
|---|---|---|
| Classic CaseLake | `game_record_id` | Folder `logs/<uuid>/`; `session_events.jsonl` |
| Product inference | `X-GT3-Game-Record` → ledger `game_record` | Already joinable for classic Lexiom |
| Lexiom 1.3 Moves | **Required:** durable emit into LexiLake under a `game_record_id` | Today: RAM `actionLog` only — gap |
| Build / VAL | `compilation_root_osn_id` → `run_id` → `session_id` → `exchange_id` | Strongest existing stitch; must hang under the game record once 1.3 binds a game record |
| Agent exchange files | `logs/agent_broker/<exchange_id>/exchange.json` | Discoverable by `run_id` until RUN_RESULT lists exchanges |

**Required product seam (Lexiom 1.3):** allocate or resume a browser `gameRecordId`, send `X-GT3-Game-Record` on product inference and on session-event posts, and include `game_record_id` (and when known `osn_id` / `run_id`) on durable Move events.

### 5.2 Intended API shape

Keep existing:

- `GET /game-records`
- `GET /game-records/:id/essence`
- `POST /lexiom-session/event`
- raw browse under `/logs/browse/:id`

Add (or extend essence with) a **story projection**:

- `GET /game-records/:id/story`

Response sketch (`lexiom_game_story.v1`):

```json
{
  "schema_id": "lexiom_game_story.v1",
  "game_record_id": "<uuid>",
  "time_span": { "start": "<iso>", "end": "<iso>" },
  "chapters": [
    {
      "beat_id": "<stable id>",
      "kind": "white|black|stability|build",
      "ts": "<iso>",
      "title": "Approved L24 interests",
      "summary": "…",
      "source": {
        "plane": "session_event|inference|action|build|exchange",
        "event_type": "l24_approved",
        "refs": {
          "osn_id": null,
          "run_id": null,
          "exchange_id": null,
          "log_url": null
        }
      },
      "dialogue": null,
      "children": []
    }
  ],
  "raw": {
    "essence_available": true,
    "browse_url": "/logs/browse/<uuid>"
  }
}
```

**Build chapters** may nest Black exchange beats as `children[]` ordered by crossing time / phase.

**Ordering:** prefer `seq_client` when present for session events; else `ts_server` / ledger `ts_iso` / exchange `created_at`. Document ties and duplicates as Known divergence until idempotency is enforced.

### 5.3 Session-event vocabulary growth

Extend `lexiom_session_event.v1` (or a sibling schema version) so Lexiom 1.3 White Moves can pour into LexiLake without inventing a second lake:

| New / mapped `event_type` (illustrative) | White Move |
|---|---|
| `osn_approved` / `osn_unapproved` | Draft maturity attestation |
| `osn_branched` | Branch immature child |
| `osn_pruned` | Prune subtree (tombstone refs) |
| `osn_canonized` / `osn_persisted` | YAML land / save |
| `evidence_approved` | Right-panel attestation |
| `build_prepared` / `build_run_authorized` | Prepare vs VAL authorize |
| `build_completed` / `build_failed` | Stability / failure of a build chapter |

Payloads carry ids and short human summaries — not full OSN YAML blobs.

Black product turns may remain `l23_qa_turn`-shaped or a clearer `inference_turn`; agent crossings are preferably **projected** from exchange observability rather than duplicated wholesale into JSONL (store refs + titles; nest full packet by link).

### 5.4 What stays out of LexiLake (by design)

Per Constitution and SaaS brief:

- Unapproved Black drafts
- Keystroke-level editing
- Full live OSN graphs as event payloads
- Mixing agent-broker counters into product inference totals

---

## 6. Relationship to adjacent console tabs

| Tab | Job | Game Records may… |
|---|---|---|
| **Dashboard** | Bringup, traffic counts, expression config | Link “latest game” optionally; must not duplicate bringup cards |
| **Logs** | Live event stream + packet inspector | Open the same exchange/inference artifact Game Records deep-links |
| **Game records** | CaseLake story replay for one `game_record_id` | Nest dialogue; never become the global AGENT lane |

**Shared acceptance with VAL + Ops + Bud:** bringup healthy in Ops → broker visible in Logs/Dashboard → `/run` builds SUD → evidences / `bud` in cabinet → **Game Records narrates the White authorize → Black crossings → Stability/`bud` chapter** for that game.

---

## 7. Phased delivery

### Phase A — Classic story face (near-term)

- Re-render existing essence as chronological White/Black semantic beats (use `grouped` where helpful).
- Oldest→newest default; keep Raw essence toggle.
- Join product inference rows for the same `game_record_id` as Black beats with log links.
- Improve session row metadata; auto-select newest on first load (optional UX polish).
- Markdown export emits story headings, not only raw pre blocks.

### Phase B — Lexiom 1.3 LexiLake seam

- `gameRecordId` + `X-GT3-Game-Record` on Lexiom 1.3 client.
- Persist White Moves from `actionLog` / Move dispatch via `POST /lexiom-session/event` (extended types).
- Bind prepare/`run` to the same game record (`run_id` in event refs).

### Phase C — Build chapters + dialogue nests

- `GET /game-records/:id/story` aggregates session events + inferences + exchanges-by-`run_id`.
- Expandable Black nests (spoken + tools) using existing exchange JSON.
- Prefer exchange id lists on RUN_RESULT / phase ledger as Follow-up hardening (until then, ledger scan by `run_id` is acceptable with documented limit).

### Phase D — Hardening

- Enforce session `idempotency_key`.
- Cap / page very large stories.
- Optional CaseLake summary header (title, mode) when SaaS/case bootstrap mapping exists.

---

## 8. Non-goals (v1)

- Replacing the Lexiom cabinet or executing White Moves from Ops.
- Full Provenance Spine replay engine inside the console.
- Real-time co-watching of another player’s keystrokes.
- Unifying product and agent counters into one number.
- Designing SaaS case-portfolio UI (dashboard navigates; this plane reads LexiLake).

---

## 9. Markdown export contract

Exported `.md` for a game record:

1. Title: `Game record <uuid>`
2. Time span
3. Chapters in story order with `##` beat titles and kind tags
4. Nested Black dialogue as blockquotes / fenced excerpts
5. Footer links to browse URL and listed `exchange_id`s

Must remain readable offline as a CaseLake narrative, not only as a debug dump.

---

## 10. Testing / validation (intended)

Deterministic coverage when Phase A–C land:

- Essence → story beat mapping for the four classic types
- Ordering rules (`seq_client` vs timestamps)
- Inference join by `game_record_id`
- Exchange nesting under a build chapter given fixture `run_id`
- Export snapshot stability

Integration fixtures may reuse `logs/<uuid>/session_events.jsonl` and `logs/agent_broker/<exchange_id>/exchange.json` samples already in-repo.

---

## 11. Open questions

1. Should a Lexiom 1.3 browser session use **one game record per OSN graph session** or **one per compilation-root build**? (Default recommendation: one per browser case/session, with many build chapters beneath.)
2. Do evidence approvals require server-side attestation events immediately in Phase B, or may Phase B ship structural Moves first?
3. When classic and 1.3 events share a folder, is a single mixed story acceptable without stage chips (ZenithLake / AccordLake)? (Default: mixed story; lake chips are Follow-up.)

---

## 12. Versioning

- Version: **1.0** (proposal)
- Scope: Ops Console Game Records **story exposition** + required LexiLake seams
- Future versions may add ZenithLake/AccordLake filters, SaaS case-title join, and full Spine export parity
