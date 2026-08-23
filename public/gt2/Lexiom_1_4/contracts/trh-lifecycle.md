# TRH Case Lifecycle ↔ Lexiom 1.4 Events

**Owner:** Vertical (TRH SoR and UX). Lexiom does not canonize vertical cases.  
**API version:** `lexiom14/1.0`  
**References:** TRH Initial UX & System Spec; Figma Make Prompt; [`events-catalogue.md`](events-catalogue.md); [`realization-package.md`](realization-package.md).

## Case states (TRH-owned)

Visual progression required by TRH Figma prompt:

**Draft → Ready to Realize → Realizing → Evidence Review → Human Approved → Canonical / Signed**

| TRH state | Meaning | Lexiom involvement |
|-----------|---------|-------------------|
| `Draft` | Awaiting one outcome description (or generate in flight) | Conversation session + replica |
| `ReadyToRealize` | Both hemispheres sufficient | `generateOsn` → `buildReadinessChanged` with `ready: true` |
| `Realizing` | Document realization in progress | Realization stream |
| `EvidenceReview` | Package persisted; evidences inspectable | Package handoff; Embed `evidence_review` |
| `HumanApproved` | All required **direct** evidences approved by human | Vertical-only White Moves |
| `CanonicalSigned` | Case attested canonical in TRH SoR | Vertical-only; not a Lexiom API |

## Mapping rules

```text
generateOsn pending / failed                                              → remain Draft
generateOsn → structureUpdated / buildReadinessChanged(ready:true)        → ReadyToRealize
realizationStarted / step* / evidenceProduced / artifactUpdated           → Realizing
realizationCompleted → TRH auto-persist Realization Package               → EvidenceReview
realizationFailed                                                         → return Draft (or ReadyToRealize if still ready)
TRH approves each required direct Success Evidence                        → HumanApproved when all done
TRH signs/attests case                                                    → CanonicalSigned
```

## Critical invariant

**`realizationCompleted` + SoR persist must not transition to `CanonicalSigned`.**

Canonical status appears only after human approval of all required direct Success Evidences, then an explicit TRH attestation step (MVP: state flag + attestation record; not crypto PKI).

## Views of one object

TRH navigates among views of the same case (not separate apps):

| View | Primary Lexiom surface |
|------|------------------------|
| Conversation | Conversational Intelligence |
| Structure / Graph | Embed `structure_graph` (+ progressive disclosure from conversation) |
| Realization | Realization events / progress UX |
| Evidence Review | Embed `evidence_review` + package evidences |
| Canonical Artifact | Vertical rendering of approved package artifact |

Optional Cockpit (`embed` surface `cockpit`): semantic / spatial / temporal plane navigation — MVP-lite allowed (graph + one plane affordance).

## Vocabulary

- Do **not** brand Lexiom as a separate product in TRH chrome.
- TRH **may** label structure as Output Specifications, Success Evidences, OSN Graph (TRH-owned language).
- Lexiom SDK payloads use neutral `structure` / `hemispheres` / `build_readiness` fields.

## Follow-up (not required for Phase a/b MVP contracts)

- Voice conversational entry
- Full Agent Delegation authorize/scope UX (`actor_kind: "agent"` is reserved on credentials)
- Software Realization profile
