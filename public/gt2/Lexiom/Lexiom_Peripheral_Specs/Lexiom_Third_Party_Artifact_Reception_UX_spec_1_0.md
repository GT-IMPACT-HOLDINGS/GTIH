# Lexiom Third-Party Artifact Reception UX Specification

**Version:** 1.1  
**Status:** Peripheral — receiver portal normative; open topics still deferred  
**Audience:** Product / Engineering / Design  
**Companion:** [Lexiom_UX_InterSpec_Constitution_1_0.md](../Lexiom_UX_InterSpec_Constitution_1_0.md), [Lexiom_Spatial_UX_spec_1_0.md](../Lexiom_Spatial_UX_spec_1_0.md), [Lexiom_Temporal_UX_spec_1_0.md](../Lexiom_Temporal_UX_spec_1_0.md), [Lexiom_Provenance_Spine_Spec_1_0.md](../Lexiom_Provenance_Spine_Spec_1_0.md), [Lexiom_Accord_Mediation_UX_Specification.md](Lexiom_Accord_Mediation_UX_Specification.md).

**v1.1 changelog:** Normative **receiver portal** for human-facing share links (PDF download vs Open in Lexiom); **canonical link** is a gateway page, not a raw static document URL. §1 and §7 updated; new §7.1; §9 extended.

---

## 1. Purpose

Define how **approved artifacts** become visible and actionable for a **third party who already operates Lexiom** (existing user, CRM-ecosystem peer, or first-time Lexiom user who has crossed into the cabinet). The spec addresses **look, feel, and placement** of **accept** and **ignore** when an inbound shared artifact awaits that party’s stance.

**Strategic posture (product intent):** Outbound sharing is treated primarily as **opening a negotiation**—a move in a dialogue—not as a sealed certificate of closure. UX language and affordances should favor **invitation to respond**, not finality.

**Non-goals in v1.1:** This document still does **not** resolve binding questions of **recipient identity** (person vs seat vs organization) or **version lineage** when an artifact legitimately evolves; see [§8 Open Topics](#8-open-topics-deferred-for-later-versions).

**Recipients outside the cabinet (normative):** Human-facing **share links** MUST resolve to a **receiver portal** (see [§7.1](#71-outbound-share-link-and-receiver-portal-normative)) with two primary choices: **Download as PDF** or **Open in Lexiom**. The **PDF** path uses a **lightweight contract**: **implicit consent** at the moment of download, with a **short disclosed note** on the portal explaining what the download is and that proceeding constitutes acceptance of that use. The **Open in Lexiom** path defers ratification to the **explicit** Accept/Ignore model inside the cockpit ([§4](#4-spatial-placement-third-party-inside-lexiom), [§5](#5-interaction-model--accept-vs-ignore)). Raw static URLs (e.g. direct `.md`) MAY remain for APIs, automation, or power users; **canonical UX for recipients** is the portal.

---

## 2. Authority & Precedence

| Topic | Authoritative spec |
|--------|-------------------|
| Cockpit layout, center-only execution, **Shared Harmony** (right panel, top) | [Lexiom_Spatial_UX_spec_1_0.md](../Lexiom_Spatial_UX_spec_1_0.md) (e.g. §8.1) |
| Rounds, White/Black, no silent mutation | [Lexiom_Temporal_UX_spec_1_0.md](../Lexiom_Temporal_UX_spec_1_0.md) |
| Publish / accept / ledger / replay | [Lexiom_Provenance_Spine_Spec_1_0.md](../Lexiom_Provenance_Spine_Spec_1_0.md) |
| Accord staging, shared vs staged, mediation rounds | [Lexiom_Accord_Mediation_UX_Specification.md](Lexiom_Accord_Mediation_UX_Specification.md) |

**Inbound staging:** Once the recipient is in the cabinet, promotion of shared material MUST remain consistent with **Provenance** + **Accord** (no bypass of publish/accept invariants by the portal alone).

---

## 3. Alignment With Accord — Draft-First Glyph System

Inbound artifacts that are **not yet mutually accepted** participate in the same **staged** semantics as other Accord material. Visual truth for list rows and headers MUST stay consistent with:

**Reference:** [Lexiom_Accord_Mediation_UX_Specification.md](Lexiom_Accord_Mediation_UX_Specification.md) — **§7 Draft-First Glyph System** (glyph definitions for shared vs staged artifacts).

Summary for implementation (do not drift from Accord):

| Layer | Glyph meaning |
|--------|----------------|
| **Shared** artifacts | Approved: **ring with check** (◯ with ✓ inside the ring). |
| **Staged** — proposed by Lexiom or counterpart | **◯** (open circle). |
| **Staged** — you approved, awaiting counterpart | **Ring with check** (◯ with ✓ inside the ring). |

**Third-party reception rule:** Until the recipient **accepts** (ratifies promotion toward shared reality per Accord), the inbound artifact remains **staged** from the recipient’s perspective: use the **◯** affordance for “awaiting your stance” when the counterpart has proposed and the recipient has not yet accepted.

After the recipient **accepts**, glyph state advances per Accord (e.g. ring-with-check where the spec places “player approved, awaiting counterpart” when that bilateral pattern applies).

**Ignore** does not promote the artifact to **shared**. It is a recipient-visible resolution that **withholds mutual semantic ground** for that item. Visually: the row MUST **not** adopt the shared-document “fully approved” treatment; it SHOULD move to a **muted, settled** treatment (e.g. reduced emphasis, optional “Ignored” or “Not pursuing” sublabel) while **preserving** the Draft-First glyph vocabulary above for any still-relevant staged history—i.e. ignore is expressed through **list emphasis + explicit status**, not by inventing a conflicting third glyph family without a cross-spec bump.

---

## 4. Spatial Placement (Third Party Inside Lexiom)

Per the Spatial model:

- **Indexing** of inbound / staged artifacts belongs in the **cockpit panels**—specifically the **Shared Harmony** (top) sub-panel of the **right panel** for shared-board index semantics; see [Lexiom_Spatial_UX_spec_1_0.md](../Lexiom_Spatial_UX_spec_1_0.md) §8.1.
- **Committing** a stance—**Accept** or **Ignore**—occurs only in the **Center Playfield** when the activity is active. Side panels do not execute legal-making; they select and orient.

**Feel:** Selecting an inbound staged artifact should **load a calm, single-purpose Activity** in the center: large readable artifact body, clear counterpart context, and **two primary actions** at the same visual weight tier: **Accept** and **Ignore** (labels may be tuned for negotiation framing, e.g. “Accept into shared space” vs “Decline / ignore for now”—copy is product-tunable but must remain **honest and non-coercive**).

**Information scent before commitment:** The Top HUD / surrounding shell should communicate that the case is in a **shared semantic space** when Accord conditions are met (consistent with Accord’s system line: *“You are now in a shared semantic space.”* — see [Lexiom_Accord_Mediation_UX_Specification.md](Lexiom_Accord_Mediation_UX_Specification.md) §6).

---

## 5. Interaction Model — Accept vs Ignore

### 5.1 Accept

- **Intent:** Recipient ratifies, moving the artifact toward **co-accepted shared material** per Accord (exact spine transitions remain defined by Provenance + Accord; this spec only constrains UX).
- **Feel:** Decisive but quiet—confirmation may be **one step** if stakes are low, or **short explicit confirm** if the product tier requires it; no celebratory noise. The glyph for staged items should **advance** toward the Accord “ring with check” pattern as appropriate to “you have approved.”
- **Aftermath:** The artifact appears among **shared** classified rows where Accord places mutually accepted items; staging noise drops away for that row.

### 5.2 Ignore

- **Intent:** Recipient **does not** grant mutual acceptance; negotiation remains open in principle, but **this artifact** does not become part of jointly carried forward shared ground.
- **Feel:** Must not read as “delete” or “shame”—it is a **strategic withhold**, not a failure state. Prefer copy that signals **posture** (“Not pursuing this proposal,” “Leave unstaged”) over punitive wording.
- **Aftermath:** Row leaves the **urgent staged** band; sender-side visibility of that outcome is a **Provenance / notification** concern—this spec only requires that the recipient’s cockpit shows a **settled, non-shared** state.

### 5.3 Passive non-response

If the recipient neither accepts nor ignores:

- The artifact **remains staged** (**◯**) and visible in the awaiting band—consistent with “negotiation opened,” not “closed.”
- No automatic promotion to shared.

---

## 6. Emotional & Semantic Tone

- **Negotiation frame:** Center copy should avoid “final agreement” language unless the artifact type truly is terminal. Prefer language of **response, counter-proposal, and joint seed** (aligned with Accord’s round and shared-seed concepts).
- **Calm procedural safety:** No timers, no nagging animations; **presence of the staged glyph** is the reminder.

---

## 7. Relation to Other Recipient Classes (Brief)

| Recipient | UX note (v1.1) |
|-----------|------------------|
| **Browser receiver (pre-cabinet)** | Lands on the **receiver portal** ([§7.1](#71-outbound-share-link-and-receiver-portal-normative)): two **equal-weight** primary actions—**Download as PDF** and **Open in Lexiom**—plus short disclosed copy for the download path. No dark patterns; no hidden default that bypasses choice. |
| **Existing Lexiom user** | After **Open in Lexiom**, full cockpit behavior per §§3–6; inbound item indexed under **Shared Harmony** until stance resolved in center. |
| **New user (first entry via artifact)** | Portal may chain into onboarding/landing **before** the cabinet; once eligible, the same **Shared Harmony** indexing and **explicit** Accept/Ignore in the **center playfield** apply—not a dark pattern. |
| **PDF-only path** | User never enters Lexiom; consent is **implicit at download** with **disclosure on the portal**; PDF is a **rendering** of the approved snapshot (implementation may use server or client rendering; quality and accessibility limits of PDF vs source markdown are product/eng tradeoffs). |

---

## 7.1 Outbound share link and receiver portal (normative)

### 7.1.1 Canonical link shape (human recipients)

- **Canonical human-facing share URLs** MUST target a **gateway** (receiver **portal page**) identified by an **opaque** or **server-resolvable** reference (e.g. token, id, or signed payload)—not by exposing raw repository or static paths as the primary UX.
- The portal MUST clearly identify **what** is being shared (title/summary or equivalent) and **who** sent it when that metadata is available, without requiring the recipient to understand Lexiom internals.

### 7.1.2 Primary actions on the portal

1. **Download as PDF**  
   - Delivers a **PDF** representation of the **approved artifact snapshot** at share time (or latest published snapshot per product policy).  
   - **Disclosure:** Visible text explains that downloading constitutes agreement to receive this document under the stated lightweight terms (exact legal wording is product/legal).  
   - **Accessibility:** PDF may be less accessible than structured markdown; the portal MAY offer a secondary “download source” link for power users if product allows (optional, not required by this spec).

2. **Open in Lexiom**  
   - Navigates into the Lexiom **cockpit** (e.g. main case experience) with a **handoff** that places the artifact in the **Shared Harmony** area of the **right panel** ([Spatial §8.1](../Lexiom_Spatial_UX_spec_1_0.md)).  
   - The item MUST appear as **staged** from the recipient’s perspective until they **Accept** or **Ignore** in the **center playfield** ([§4](#4-spatial-placement-third-party-inside-lexiom), [§5](#5-interaction-model--accept-vs-ignore), [§3](#3-alignment-with-accord--draft-first-glyph-system)).  
   - **Spine:** Actual publish/accept ledger behavior MUST follow [Lexiom_Provenance_Spine_Spec_1_0.md](../Lexiom_Provenance_Spine_Spec_1_0.md) and [Lexiom_Accord_Mediation_UX_Specification.md](Lexiom_Accord_Mediation_UX_Specification.md); the portal MUST NOT silently promote shared canonical state without those rules.

**Implementation note (v1.1 retrofit):** Current cockpit ingestion path in `app.js` resolves inbound shared content primarily via query/session key `inboundArtifact` (fetched from `/lexiom/artifact/content/:resourceId`) and via `accord` for shared accord playfield resources. This is consistent with the portal-open intent, but the exact portal query contract is implementation-coupled and should remain explicitly documented alongside server routes.

### 7.1.3 Strategic tone on the portal

- Copy SHOULD reinforce **negotiation opened** (aligned with §1), not “closed deal,” unless the artifact type is explicitly terminal in product policy.

---

## 8. Open Topics (Deferred for Later Versions)

The following are **acknowledged tensions**; v1.1 **does not** choose a single ontology:

1. **Recipient binding:** Whether the artifact is addressed to a **person**, a **seat/role**, or an **organization**—and how that affects listing, notifications, and audit.
2. **Evolving artifact lineage:** When an artifact advances to a “more advanced version,” whether older holdings (file on disk vs in-app state) are **superseded**, **parallel-valid**, or **forked** realities—and how that surfaces in glyphs and history.
3. **Open question:** Whether human-facing fallback links that carry `shareArtifact`/`shareKind` should be formally supported in cockpit init, or normalized server-side into `inboundArtifact` before handoff.

Later specs should resolve these in coordination with Provenance and Accord.

---

## 9. Testing Notes (UX Acceptance)

- **Receiver portal:** Both **Download PDF** and **Open in Lexiom** are visible as **co-primary** actions; neither is buried or pre-selected in a misleading way.
- **PDF path:** Download completes; disclosed copy is present on the portal before or adjacent to the action.
- **Lexiom path:** After handoff, the artifact appears under **Shared Harmony** (right panel, top) and remains **staged** (◯ per [§3](#3-alignment-with-accord--draft-first-glyph-system) / Accord §7) until **Accept**; **Accept** and **Ignore** are **only** committed from **Center Playfield** activities, not from the portal alone and not from panel chrome alone.
- **Ignore** never presents as shared-approved; settled state is visually distinct from shared rows.

---

End of document  
**Lexiom Third-Party Artifact Reception UX Specification v1.1**
