Lexiom Draft Flows Spec v1.0
============================

This spec describes how **human-approved drafts** flow across Lexiom’s canonical layers without redefining the five primary UX specs:

- `Lexiom_Strategic_Semantic_UX_spec_1_0.md`
- `Lexiom_Semantic_Arcade_UX_spec_1_0.md`
- `Lexiom_Temporal_UX_spec_1_0.md`
- `Lexiom_Spatial_UX_spec_1_0.md`
- `Lexiom_Provenance_Spine_Spec_1_0.md`

It is a **peripheral spine**: it names the channels and gates through which drafts move, but does not restate the inner voice of Lexiom.

## 1. Canonical surfaces

- **L24a — Tensions Draft**: formatted surface of contested or high-friction positions, derived from case seed plus approved upstream context (goals/strategy when approved).  
- **L24b — Goals Draft**: end-state victory narrative for the user.  
- **L24c — Strategy Draft**: via negativa plan (what not to do) in light of disputes and goals.  
- **L24d — Undisputed Draft**: negotiation-useful undisputed fact cores (leverage-bearing facts that remain unchallenged in the seed and approved upstream drafts).

Each draft is a **humanly approved artifact**: Lexiom may propose; only the user can approve.

**Current UI behavior:** L2a and L2d remain clickable entries but are rendered as **card-only** surfaces (L24a/L24d); no L23 chat composer is shown for those entries. L2b and L2c begin as L23 chat surfaces, then switch to **card-only** L24b/L24c rendering once their visibility gates are satisfied (`L24_MIN_USER_ANSWERS`), at which point L23 is hidden/unrendered in the center playfield.

## 2. Flow topology

1. **L24a → L24b**  
   Approved L24a items constrain and contextualize L24b. Goals must acknowledge which claims remain contested and which cannot be safely assumed. Inference prompts inject approved L24a text when present (approved-only).

2. **L24a + L24b → L24c**  
   Strategy drafts ingest the disputes surface and approved goals. Temporally, L24c inference is downstream of whatever approved L24a/L24b text exists at call time (Temporal UX). Spatially, it occupies the same case locus in the arcade frame (Spatial UX).
   
   L24c prompting should also attempt to surface **potential evidential misses** (gaps or weak support) as part of strategic posture, using only available seed/approved/chat context and without fabricating missing facts.

3. **L24a + L24b + L24c → L24d**  
   L24d inference uses the case seed plus **approved** upstream L24a/L24b/L24c when available, optionally supported by any present undisputed-lens chat history.  

   L24d is intentionally narrow: it seeks leverage-bearing fact cores that are not challenged in the seed and approved upstream drafts (it does not aim to catalog every broadly acceptable detail).

   Selection guidance for L24d:
   - include facts that appear unchallenged; explicit bilateral confirmation is not required,
   - prefer tight leverage-bearing anchors over broad procedural inventories,
   - extract only the stable fact core when a fragment mixes fact and interpretation,
   - exclude advocacy, legal conclusions, emotional framing, and argumentative claims disguised as facts.

   It returns candidate **semantic facts** (L24d), expressed as one line per item: `"fact" — basis`. The user may approve these lines, turning them into stable building blocks that downstream flows (including proposed action and right-panel artifacts) may rely on when marked approved.

**Approved-only policy:** upstream draft context is injected only when the corresponding draft is explicitly approved by the user; non-approved drafts are excluded from cross-topic inference context.

## 3. Temporal and spatial constraints

- **Visibility gates (`L24_MIN_USER_ANSWERS`):** L24a (disputes) and L24d (undisputed) may show the draft widget with **zero** user answers in the corresponding topic; L24b (goals) requires **one** user answer in the L23b thread (Underlying Interests — Self per Strategic Semantic UX §2.1); L24c (strategy) requires **four** user answers in its L23 thread before the L24 draft area renders. For L2b/L2c, once the gate is met, center rendering becomes draft-only (L24 card only) and the L23 chat UI is not rendered.
- **Recalculation:** User messages in L23 topics that carry chat can trigger GT3 re-inference for the relevant L24 draft; reducers apply new text only while that draft is **not** approved. Approved narratives are not overwritten by inference.
- **Evidence-gap discipline in L24c:** when strategy text references missing evidence, it should label it as a **potential** evidential miss and propose next evidence to gather, not assert unverified absence as fact.
- **L21/L22 inference (round start):** L21 titles are computed once per stage/round, post seed approval. Sequence: Case seed approval → L22 inference (four subtitles) → L21 inference (four one-word titles). Thereafter, any refresh of the L2 button label updates **only** L22 subtitles; L21 titles remain fixed for the round.
- **L22 subtitles:** When the user approves L24a (L23A card), the implementation schedules an L22 refresh for the **disputes** column so the left-panel subtitle can track the approved disputes draft; analogous pending refresh exists for other approved L24 kinds where wired.
- **Temporal ordering:** A later draft never becomes “earlier” in the user’s intent chain; approvals freeze the narrative the user accepted for that lens until they edit or un-approve.
- **Spatial:** All L24 drafts share the same case coordinate (Spatial UX §2). They differ by lens, not by location.

## 4. Approved L24 context for re-rendered proposed actions

Whenever the **proposed action** is re-calculated and re-rendered in the left panel, the GT3 narrative includes the **case seed**, **L1 title/summary**, **stage**, **approved action items already in the list**, and—when present—the **approved L24 blocks** (L24a–L24d) as the living semantic terrain. Non-approved drafts are omitted; missing approved sections are omitted rather than filled with unapproved text.

The invocation asks for **one next executable step** (not abstract strategy): concrete, situated, directional, with **ZENITH** vs **ACCORD** posture hints, and an output cap of **16 words or fewer** in a single sentence. Triggers include bootstrap/refresh paths and **each approval** of an L24 draft (or the proposed action draft), so the left-panel line can track newly approved terrain. (In code, the undisputed block is labeled `APPROVED_L24D_UNDISPUTED` in this prompt; semantics match L24d.)

## 5. Right-panel artifact drafting (accepted action items)

When an approved action item spawns a new private artifact, **initial document content** is inferred with **full case state**: **case seed narrative**, the **accepted action item text** (operational intent), optional **approved-only** blocks `APPROVED_L24A_DISPUTES`, `APPROVED_L24B_GOALS`, `APPROVED_L24C_STRATEGY`, and `APPROVED_L24D_UNDISPUTED_FACTS` (same approved policy as elsewhere). Those blocks are **semantic boundary conditions** for the draft. The prompt encodes instrumentality, factual grounding, strategic alignment, stage sensitivity, a single move per artifact, and negotiational dignity. Filename inference may still use only the action text.

## 6. Provenance and arcade behavior

Implementation today keeps **approved text and flags** in app state (`l23_cards`, `case.*_draft_*`); GT3 requests pass labeled approved sections rather than per-line structured provenance IDs. The Provenance Spine remains the conceptual home for richer lineage; the arcade stays visually quiet while inference uses approved drafts as **constraints** and **anchors** for the next move.
