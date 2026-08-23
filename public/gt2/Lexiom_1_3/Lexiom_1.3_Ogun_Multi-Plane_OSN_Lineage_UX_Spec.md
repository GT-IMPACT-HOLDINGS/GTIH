# Lexiom 1.3 (Ogun) UX Specification  
## Multi-Plane OSN Lineage Navigation

**Status:** Implemented (POC)  
**Working concept name:** **PlaneShift**  
**Audience:** Lexiom 1.3 (Ogun) UX and product-design teams  
**Runtime:** Lexiom 1.3 cockpit left graph (`app.js` / `styles.css`); OSNG edge ProductLexiom ← AccessControl (`WebAppSecurity.AccessControl.a1000101.osn`) via `standard_ancestor_osn_ids` (see `OSNG_Basics_README.md`).

### Known divergences / Temporary POC behavior
- Additional-plane **layout trunk** = linking standard ancestor `S` (e.g. AccessControl) for ancestor column + peers; **plane name** = origin-leaf of the eldest root of `S`’s native tree (e.g. `WebAppSecurity`), used whenever that plane is shown for any OSN in the tree.
- Additional planes collected from the Focus OSN’s own `standard_ancestor_osn_ids` only (no walk-up through native parents). Example: UX Focus does not surface ProductLexiom’s WebAppSecurity link.
- Plane influence blurbs are **auto-derived** (7–9 words from trunk seed/title); no authored YAML field yet.
- Shadow control appears only when Focus itself inherits one or more non-native planes; it is companioned **only beside native (plane-zero) ancestors** (direct native parent closest to Focus). On an additional plane, the shadow is detached (return path) and does not sit beside layout-trunk `S`.
- Shadow control **hidden** when Focus has no alternate-plane inheritance (e.g. UX under ProductLexiom).
- Active plane is **session-locked** (`ui.lockedPlaneId`) until the player picks a different radio; Focus changes do not revert to native. Per-OSN `activePlaneByOsnId` remains a secondary memory.
- On an additional plane, OSNs that list `S` in `standard_ancestor_osn_ids` are **grafted peers** under `S` (e.g. ProductLexiom beside Authentication / Authorization). ArrowUp from a peer goes to `S`; focusing `S` lists peers as descendants.
- Alternate-plane descendants under a peer Focus are empty (v1); children of trunk `S` plus grafted inheritors appear as Focus **siblings** (◀/▶), not in the ancestor column.
- Additional-plane ancestor column is only `S`’s primary-parent chain (e.g. WebAppSecurity → AccessControl)—never inverted with peer OSNs above the trunk.
- Full-graph mode disables PlaneShift chrome; left title reverts to “Outcome Specifications” (Side view) or “Top view”. Full-screen offers two kinds — Side view (indented tree) and Top view / OSNG Garden (radial multi-tree exposition) ([`Lexiom_1_3_OSNG_Garden_UX_Spec_1_0.md`](Lexiom_1_3_OSNG_Garden_UX_Spec_1_0.md)).

---

## 1. Purpose

This feature shall allow a player to examine the same focused OSN through multiple thematic inheritance planes without exposing the full complexity of a multi-parent graph at once.

Every OSN retains one direct parent within its native thematic lineage. This lineage is its **native plane**, or **plane zero**. The same OSN may also inherit influence from ancestor OSNs belonging to additional thematic planes, such as security, serviceability, legality, or operations.

At any moment, the cockpit presents one selected plane as a simple, coherent tree. The player may shift planes while preserving the identity and visual position of the focused OSN.

---

## 2. Core UX Principle

The experience shall preserve **one focused OSN across multiple thematic perspectives**.

Plane switching must feel like changing the interpretive lens through which the focused OSN is understood—not navigating away from it or opening a second graph.

---

## 3. Terminology

### Focused OSN
The OSN currently occupying the cockpit’s primary focus.

### Native Plane / Plane Zero
The focused OSN’s default thematic lineage, defined by its single direct parent.

### Additional Plane
A thematic lineage from which the focused OSN inherits through an additional ancestor relationship.

### Plane Root
The eldest OSN within a thematic plane. It acts as the root or trunk of that plane’s simple tree whenever descendants exist.

The same OSN may also be understood metaphorically as a **soil mineral** when its influence nourishes OSNs native to other trees.

### Shadow Control
A clickable shadow that reveals alternate (non-native) thematic planes available to the **focused** OSN. It appears only when that Focus OSN itself declares `standard_ancestor_osn_ids`, and is placed beside a **native (plane-zero) ancestor** — never beside a native parent that is merely inherited through by a child that has no alternate links of its own.

---

## 4. Player Entry Point

1. The cockpit displays the focused OSN within the currently active plane.
2. When the focused OSN inherits from one or more non-native planes, a clickable **shadow control** appears beside its native ancestor lineage.
3. Activating the shadow opens a plane-selection preview.
4. The shadow is the player’s recurring control for moving between available thematic planes (detached while an additional plane is active so it does not companion non-native layout ancestors).

---

## 5. Plane-Selection Preview

The preview shall display the planes available for the focused OSN as a **radio-button group** (one choice at a time). The player must pick a radio option to change the thematic plane; the shadow alone only opens or closes the preview.

Each plane entry shall show:

- A **radio control** plus the **plane name** in its resting state.
- A **7–9-word description** of the plane’s inherited influence when the player hovers or focuses the entry.
- The currently active plane as the **checked** radio.

The focused OSN’s native plane shall:

- Always appear first.
- Be slightly highlighted.
- Remain available as the default path back to plane zero.

The remaining plane-ordering rules are not yet defined.

---

## 6. Plane Naming

Each thematic plane shall be named after the **eldest OSN** (tree/sub-tree root) of the OSNs that plane presents — using that root’s origin-leaf label (e.g. `WebAppSecurity` for every OSN under the security folder tree).

When an additional plane is entered through a link to a non-root standard ancestor `S`, the plane’s **name** still comes from the eldest root above `S` (not from `S` itself). Layout around Focus may still treat `S` as the immediate trunk for peers and the ancestor column.

The active plane’s name shall appear as the **title of the cockpit’s left panel**.

This naming model expresses two complementary meanings:

1. The eldest OSN is the root of its own thematic tree and gives the plane its stable name.
2. Its inherited influence may nourish OSNs belonging to other thematic trees, like a mineral within shared soil.

---

## 7. Plane-Switching Behavior

When the player selects a plane (radio pick):

1. The currently displayed tree fades out.
2. The focused OSN remains fixed in the same cockpit position.
3. The selected thematic tree fades in around it.
4. The former tree is replaced entirely; it is not retained as a background layer.
5. The cockpit presents the focused OSN’s relationships to OSNs native to the selected plane (plus grafted inheritors of trunk `S`).
6. The left-panel title updates to the selected plane’s name.
7. When the active plane is **not** the native plane, the left panel background tints slightly toward the Focus OSN wireframe blue (up to ~20% mix) so the player can tell native vs thematic-plane presentation apart. Native plane and full-graph mode restore the untinted panel.
8. The chosen plane **stays locked** for the session until the player picks a different radio — navigating Focus among trunk `S`, its children, and grafted inheritors (e.g. ProductLexiom ↔ Authentication ↔ Authorization under AccessControl) does not exit alternate-plane mode.

On an additional plane, the OSN that entered via `standard_ancestor_osn_ids` → `S` is presented as a **peer under `S`**: accessible beside `S`’s native children, with ◀/▶ sibling navigation and ArrowUp returning to `S`, while the left panel remains in alternate-plane presentation.

The transition shall use a **smooth fade-out/fade-in animation** rather than an immediate redraw, morph, or spatial rotation.

---

## 8. Spatial Continuity

The focused OSN must remain visually anchored throughout the transition.

Only the surrounding OSNs, connections, labels, and plane-specific context are replaced. This prevents the player from interpreting a plane switch as a change of subject and supports continuity across perspectives.

---

## 9. Functional Requirements

The UX shall:

- Represent one active thematic plane at a time.
- Preserve one native parent for every OSN.
- Allow additional ancestor relationships across other planes.
- Present each selected plane as a simple tree.
- Provide plane access through the shadow control only when Focus owns alternate-plane inheritance; companion the shadow to native-plane ancestors only.
- Present available planes as a radio-button group; require an explicit radio pick to change plane.
- Keep the chosen plane locked across Focus navigation until a different radio is picked.
- Graft standard-ancestor inheritors under trunk `S` as peers of `S`’s children while the additional plane is active.
- List the native plane first and visually distinguish it.
- Reveal concise inherited-influence descriptions on hover/focus.
- Replace the visible tree when a new plane is selected.
- Keep the focused OSN fixed during the transition.
- Display the active plane name in the left-panel title.
- Tint the left-panel background toward Focus wireframe blue while an additional plane is active (native and full-graph remain untinted).
- Permit return to the native plane through the same shadow control.

---

## 10. Experience Acceptance Criteria

The experience is successful when a player can:

1. Recognize that the focused OSN has additional thematic perspectives.
2. Open the available-plane radio list through the shadow control.
3. Identify the native plane immediately (first, highlighted, checked when active).
4. Understand each alternate plane’s influence through a short hover/focus description.
5. Change plane only by selecting a radio option, without losing awareness of the focused OSN.
6. Stay on the alternate plane while navigating among trunk peers (including the grafted entry OSN) until choosing another radio.
7. Observe the old tree fade out and the selected tree fade in.
8. See the focused OSN remain spatially stable.
9. Confirm the active plane through the left-panel title.
10. Distinguish additional-plane presentation from native via the left-panel background tint.
11. Return to the native plane using the same interaction.

---

## 11. Accessibility Considerations

Hover and focus currently reveal inherited-influence descriptions. Plane choice uses native radio-group keyboard behavior (arrow keys among options; checked state reflects the active plane). The final design must also provide equivalent behavior for:

- Touch devices
- Screen readers
- Reduced-motion preferences

Further accessible refinements remain open for UX definition.

---

## 12. Open Questions for Future Discussion

The following matters are intentionally unresolved:

1. What final product term should replace the working name **PlaneShift**?
2. What exact visual form should the shadow control take?
3. Where precisely should the shadow attach to the ancestor lineage?
4. Should the shadow appear when only the native plane is available?
5. How should additional planes be ordered after the native plane?
6. What interaction replaces hover on touch interfaces?
7. Who authors and approves each 7–9-word influence description?
8. What are the fade duration, easing curve, and interruption rules?
9. How should reduced-motion mode represent the plane change?
10. Should the selected plane persist after cockpit refresh or session return?
11. How should plane switching participate in browser history, undo, or breadcrumbs?
12. What happens when plane data is incomplete, unavailable, or fails to load?
13. How should very large plane trees be arranged around the anchored OSN?
14. How should the feature behave on compact or mobile cockpit layouts?
15. When focus moves to another OSN, how should available planes and the shadow control refresh?
16. How should an OSN that participates in a plane without being native to it behave when selected?
17. Should players be able to compare two planes, or is comparison permanently outside the single-plane experience?
18. What analytics or success evidence should validate player comprehension?

---

## 13. Out of Scope for This Draft

This specification does not define:

- Data-model or persistence implementation
- Graph-query algorithms
- Conflict resolution between inherited requirements
- Editing of inheritance relationships
- Authorization for creating or removing planes
- Plane comparison views
- Focus-change behavior after selecting another OSN
- Backend naming or schema conventions

---

## 14. Design Intent Summary

Multi-plane navigation should make multiple inheritance understandable without making the graph visually tangled. Each OSN remains rooted in one native tree while receiving influence from other thematic lineages. The player encounters these lineages through a subtle shadow, chooses a named plane, and watches the surrounding graph dissolve and reform while the focused OSN remains still.

The experience should communicate that the OSN has not moved; only the plane through which its meaning is being perceived has changed.
