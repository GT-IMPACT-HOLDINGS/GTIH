# Lexiom 1.4 — Realization Package Schema (`lexiom14/1.0`)

Normative TypeScript: `RealizationPackage` in [`lexiom14-api.d.ts`](lexiom14-api.d.ts).

## Purpose

Terminal success payload for Realization. Verticals (e.g. TRH) **auto-persist** this package into vertical SoR on `realizationCompleted`.

**Package persist ≠ Canonical / Signed.** Canonicalization requires vertical human approval of required direct success evidences (see [`trh-lifecycle.md`](trh-lifecycle.md)).

## MVP profile

`profile: "document"` only.

```json
{
  "package_id": "rp_…",
  "status": "completed",
  "profile": "document",
  "artifact": {
    "artifact_id": "art_…",
    "media_kind": "document",
    "content_type": "text/markdown",
    "file_name": "document.md",
    "uri": "https://gtih.example/lexiom14/artifacts/…"
  },
  "success_evidences": [
    {
      "evidence_id": "ev_…",
      "kind": "TEXTUAL_SNIPPET",
      "direct": true,
      "label": "Opening paragraph of delivered document",
      "uri": "https://gtih.example/lexiom14/evidences/…",
      "structure_node_id": "node_…"
    }
  ],
  "provenance": {
    "provenance_id": "prov_…",
    "session_id": "sess_…",
    "profile": "document",
    "started_at": "2026-08-16T12:00:00.000Z",
    "completed_at": "2026-08-16T12:05:00.000Z",
    "agent_label": "realization-agent"
  },
  "metering_ids": ["mtr_…"],
  "structure_revision": "rev_…"
}
```

## Field rules

| Field | Rule |
|-------|------|
| `artifact.media_kind` | Must be `"document"` for MVP |
| `success_evidences` | At least one item with `direct: true` and kind in `TEXTUAL_SNIPPET` \| `SCREEN-SHOT` \| `VIDEO-CLIP` (or documented alias) |
| `metering_ids` | Ids of GTIH consumption events for this realization |
| `uri` vs `inline_text` | Prefer `uri` on GTIH origin; `inline_text` allowed for small POC demos |

## Vertical responsibilities after handoff

1. Persist package bytes/metadata in vertical SoR.
2. Enter **Evidence Review** case state.
3. Present evidences for human approval (TRH White Moves).
4. Mark **Canonical / Signed** only after all required direct evidences are approved.

## Out of scope

- Software SPA artifact packages (`media_kind: "software"`) — Follow-up
- Cryptographic package signing by GTIH — Follow-up (vertical attestation state is sufficient for MVP)
