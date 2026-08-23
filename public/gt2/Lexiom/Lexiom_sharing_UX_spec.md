# Lexiom Sharing UX Specification

**Version:** 1.0 (draft)  
**Status:** Draft for review — peripheral; implementation alignment noted inline  
**Audience:** Product / Engineering / Design  
**Companion (read together):** [Lexiom_UX_InterSpec_Constitution_1_0.md](Lexiom_UX_InterSpec_Constitution_1_0.md), [Lexiom_Spatial_UX_spec_1_0.md](Lexiom_Spatial_UX_spec_1_0.md), [Lexiom_Temporal_UX_spec_1_0.md](Lexiom_Temporal_UX_spec_1_0.md), [Lexiom_Provenance_Spine_Spec_1_0.md](Lexiom_Provenance_Spine_Spec_1_0.md), [Lexiom_Peripheral_Specs/Lexiom_Third_Party_Artifact_Reception_UX_spec_1_0.md](Lexiom_Peripheral_Specs/Lexiom_Third_Party_Artifact_Reception_UX_spec_1_0.md), [Lexiom_Accord_Mediation_UX_Specification.md](Lexiom_Peripheral_Specs/Lexiom_Accord_Mediation_UX_Specification.md), [Lexiom_Wireframe_UI_Spec_1_0.md](Lexiom_Wireframe_UI_Spec_1_0.md).

---

## 1. Purpose

Normative UX for **outbound sharing** from the Lexiom cockpit: how an approved **document** artifact becomes a **shareable link**, how that link relates to the **receiver portal** and **Open in Lexiom**, and how sharing relates to **Zenith → Accord** collaboration **without** treating the gesture as silent canonical mutation.

This spec **does not** replace Provenance publish/accept rules or Temporal rounds; it binds **placement**, **precedence of URLs**, and **player intent** so engineering stays aligned with the constitution.

---

## 2. Authority & precedence

| Topic | Authoritative spec |
|--------|-------------------|
| Center-only execution; cockpit vs dashboard | Constitution §2.3, §4; [Spatial](Lexiom_Spatial_UX_spec_1_0.md) |
| White / Black / Stability; no silent mutation | [Temporal](Lexiom_Temporal_UX_spec_1_0.md); Constitution §3 |
| Ledger, replay, publish/accept | [Provenance Spine](Lexiom_Provenance_Spine_Spec_1_0.md) |
| Portal, PDF vs Open in Lexiom, staged ◯ until center Accept | [Third-Party Artifact Reception](Lexiom_Peripheral_Specs/Lexiom_Third_Party_Artifact_Reception_UX_spec_1_0.md) §1, §7.1, §9 |
| Shared Harmony indexing, Accord glyphs | [Spatial](Lexiom_Spatial_UX_spec_1_0.md) §8.1; [Accord Mediation](Lexiom_Peripheral_Specs/Lexiom_Accord_Mediation_UX_Specification.md) |

---

## 3. Outbound — Share affordance (cockpit)

### 3.1 Spatial rule

- **Share** for document artifacts exists only on **approved** draft cards rendered in the **center playfield** (aligned with Third-Party Reception §9: not panel-only execution).
- Applies to **private** `DOC_DRAFT` and **shared** `SHARED_DOC_DRAFT` cards once `card.approved` is true (demo: `appendApprovedArtifactShareRow` in `app.js`).

### 3.2 Action semantics

- **Primary action:** copy a single URL to the system clipboard (no automatic navigation for the sender).
- **i18n:** control is exposed as “copy link” semantics (`artifact_share_copy_link` in `lexiom-i18n.js`); icon is a standard share glyph.

### 3.3 URL precedence (normative for demo; product MAY tighten)

When the user activates **Share**, the copied string MUST be resolved in this order:

1. **`gt3ArtifactSharePortalUrl`** on the artifact row, if non-empty — canonical human path per [Third-Party Reception §7.1](Lexiom_Peripheral_Specs/Lexiom_Third_Party_Artifact_Reception_UX_spec_1_0.md) (gateway → PDF / Open in Lexiom).
2. Else **`gt3ArtifactFileUrl`** if non-empty (direct file URL; power-user / API path).
3. Else a **cockpit deep link** built from the current origin with query parameters: `skipIntro=1`, `shareArtifact=<artifactId>`, `shareKind=private|shared`, and when available `caseId`, `gameRecordId` (demo: `buildArtifactShareUrl` in `app.js`).

Publishing to obtain (1) or (2) is triggered after approval via server **`POST /lexiom/artifact/publish`**, which returns `sharePortalUrl` of the form `/lexiom/artifact/share/:resourceId` resolved against deployment origin (`server.js`).

---

## 4. Inbound handoff (recipient)

- Links that resolve to the **receiver portal** MUST honor [Third-Party Reception §7.1.2](Lexiom_Peripheral_Specs/Lexiom_Third_Party_Artifact_Reception_UX_spec_1_0.md): **Open in Lexiom** places material in **Shared Harmony** (right panel, top) as **staged** until **Accept** or **Ignore** in the **center playfield**; the portal MUST NOT promote shared canonical state alone (§7.1.2, Spine + Accord).

- Deep links with `shareArtifact` / `shareKind` are a **resume / inbound** contract for players already in or entering the cabinet; their exact landing behavior is shared with first-entry resume flows documented near `app.js` (inbound published markdown / shared accord init).

### 4.1 Known divergence (current implementation)

- **Known divergence:** `buildArtifactShareUrl()` currently emits deep links with `shareArtifact` / `shareKind`, but current `initializeApp()` inbound handling is keyed on `inboundArtifact` and `accord`.  
- **Temporary behavior:** share deep-link fallback URLs are still copied and usable as traceable references, but first-class recipient ingestion into cockpit currently depends on portal/open flows that produce `inboundArtifact` (or `accord`) rather than direct `shareArtifact` processing in `app.js`.
- **Follow-up required:** either wire explicit `shareArtifact` consumption in cockpit init or remove it from deep-link contract language to avoid overstating runtime behavior.

---

## 5. Zenith, “home run,” and Accord — sharing vs transition UI

### 5.1 Current demo behavior (as implemented)

- **Home run** (Zenith): when a **non-seed** Lexiom-created private artifact is approved **and** `undisputed_draft_approved` is true, `TOGGLE_APPROVAL` can auto-start **`HOME_RUN_TRANSITION`**: phases `COCKPIT_FADEOUT` → `TRANSITORY_1` → `SELECTION` (Zenith vs Accord choice, Accord positioning, instructions, shared seed link copy, **Enter Accord**). If undisputed is not yet approved when the artifact edge fires, an **undisputed gate modal** may open first (`OPEN_UNDISPUTED_GATE_MODAL`).

- **Share** on an approved artifact is **orthogonal** to that sequence today: it only copies a URL; it does not by itself dispatch a White Move or change `case.mode`.

### 5.2 Product normative direction (v1.0 draft intent)

- **Share-first path:** Treat **Share** as the user’s explicit **invitation to negotiate** (aligned with Third-Party Reception §1 strategic posture). The product SHOULD allow players who have shared an approved artifact to **enter or continue Accord collaboration** via that thread **without** being forced through the full **post–home-run** **SELECTION** questionnaire, **provided** Temporal + Spine invariants still hold (separate explicit moves for mode change and shared canon).

- **Coupling rule:** Auto-launch of **`HOME_RUN_TRANSITION`** after approvals SHOULD be **suppressed or shortened** when a **share-first** flag is recorded (e.g. user copied share portal URL for an approved case artifact before reaching legacy “home run”), **or** SELECTION SHOULD be skippable when Accord onboarding already started from an inbound link — exact gating is **open** for v1.1.

- **Non-normative:** Share MUST NOT imply publish/accept completion or unanimous shared truth.

---

## 6. Non-goals (v1.0)

- Recipient identity binding, version lineage — defer to Third-Party Reception [§8](Lexiom_Peripheral_Specs/Lexiom_Third_Party_Artifact_Reception_UX_spec_1_0.md) and Provenance.
- Analytics on copy events, A/B copy for social channels — optional later.

---

## 7. Testing notes (UX acceptance)

- Approved **private** and **shared** doc cards show **Share** only in **center** context; unapproved cards do not.
- Clipboard receives portal URL when `gt3ArtifactSharePortalUrl` is set after publish; otherwise file URL or deep link per §3.3.
- Recipient: portal shows co-primary **Download PDF** / **Open in Lexiom** per Third-Party Reception §9.
- **Share** alone does not change `case.mode` or shared canonical rows without subsequent spine-backed moves.

---

End of document  
**Lexiom Sharing UX Specification v1.0 (draft)**
