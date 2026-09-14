# Lexiom 1.3 — OSNG Garden UX Spec (v1.0)

**Status:** Implemented (POC)  
**Audience:** Lexiom 1.3 UX and product-design teams  
**Runtime:** Lexiom 1.3 cockpit full-screen graph (`osng-garden.js` / `app.js` / `styles.css`)

## 1. Purpose

The **OSNG Garden** (**Top view** in the cockpit chrome) is a second full-screen exposition of the Outcome Specification Graph. It presents multiple thematic trees in one spatial plane so the player can see both local lineage and cross-thematic inheritance at once.

It coexists with the **Side view** full-graph (indented / classical tree). It does not replace cockpit PlaneShift navigation.

## 2. Entry and exit

1. The left-corner full-graph toggle still enters and exits full-screen mode.
2. Default kind on enter is **Side view**.
3. While full-screen is active, a compact kind switch (**Side view** | **Top view**) sits in the left upper corner beside the full-graph toggle.
4. Selecting an OSN in either kind exits full-screen and returns to the cockpit (Success Evidences section), matching Side view full-graph behavior.
5. Escape exits full-screen.
6. PlaneShift chrome remains disabled in both full-screen kinds.

White Moves / actions:

- `TOGGLE_FULL_GRAPH` — enter/exit full-screen
- `SET_FULL_GRAPH_KIND` — switch `classical` (Side view) ↔ `garden` (Top view); enters full-screen if needed

## 3. Thematic trees (Garden plants)

A Garden **plant** is a native subtree under a **plant trunk**:

- every graph root (empty or unresolved `parent_osn_ids`), as in Side view; and
- every compilation-root OSN that owns native children (so `ProductLexiom` and `BrandLexiom` are their own plants, even though they remain native children of `GT_Philosophy`).

Compilation-root leaves without native children (RealizeProductLexiom, RealizeBrandLexiom) stay in their graph-root plant.

Live Lexiom 1.3 plants include `GT_Philosophy`, `ProductLexiom`, `BrandLexiom`, `Realization`, and `WebAppSecurity`.

## 4. Radial layout (top-down / “from above”)

Within each plant:

- The trunk OSN occupies the local center `(0, 0)`.
- Ring distance `R` grows with child fan-out (`R = R0 · (1 + 0.38 · ln m)`).
- Children share the parent’s angular sector **weighted by subtree size** (larger cones get wider wedges).
- Trunk children subdivide the full `[0, 2π)` circle.

## 5. Garden placement

Multiple plants share one garden canvas. Tree-center spacing uses cross-plant `standard_ancestor_osn_ids` **and** native parent/child stems that now cross plants, with a minimum separation of each plant’s laid-out radius plus a gap (so a large Brand cone cannot sit on ProductLexiom).

- Plants with more such links are pulled closer, but never inside each other’s radius.
- Unlinked plants use a larger far distance.
- The Focus plant is drawn slightly larger; other plants dim.
- A short deterministic spring/relaxation loop settles centers (POC; no external physics library).

## 6. Inheritance rendering

| Inheritance | Source | Stroke |
|-------------|--------|--------|
| Native (plane-zero), including short stems between plant trunks | `parent_osn_ids[0]` / `child_osn_ids` | Solid arrows |
| Cross-tree (one-way) | `standard_ancestor_osn_ids` when only one of the pair cites the other | Dashed stem, arrowheads at both ends |
| Cross-tree (reciprocal) | Both OSNs list each other in `standard_ancestor_osn_ids` | One dash-dot stem, arrowheads at both ends |

Dashed arrows communicate that the linked OSNs belong to different thematic plants while still participating in the shared garden. Reciprocal pairs (ProductLexiom ↔ RealizeProductLexiom, BrandLexiom ↔ RealizeBrandLexiom) share one two-headed stem so the player can tell mutual standard-ancestorship from a one-way citation (e.g. ProductLexiom → AccessControl).

## 7. Visual language

- Each plant receives a distinct hue along a **green → purple** spectrum (stable by trunk order). Nodes, native solid arrows, labels, and trunk neon glow use that plane color.
- Cross-tree dashed stems use a mid-spectrum bridge color and arrowheads at both ends, at the **same opacity and stroke weight** as native arrows. Reciprocal citations use a longer dash-dot rhythm so they still read as mutual.
- Nodes: discs + short origin-leaf labels; trunks slightly larger with a neon glow in their plane color; Focus OSN highlighted with a sinusoidal attention halo (3 LCD period; halo radius blooms 0 → 4× disc radius → 0 via `sin(π t)`; annulus between disc and halo filled with the halo color at **25% opacity**, **no circumference stroke**; fill color mixed **50% toward white on dark panels / toward black on light panels**; looping while Garden is open; reduced-motion uses a static soft wash).
- **Label LOD** (zoom of the SVG `viewBox`): far = plant trunks (+ Focus); mid = trunks, compilation roots, and the Focus ancestor spine; near = all labels with overlap culling. Hover always reveals that node’s origin-leaf.
- Hover: native SVG tooltip shows seed content above the origin-leaf name when seed exists; empty seed → name only.
- Wheel zoom and drag pan on the SVG `viewBox`.
- Navigation-only: no branching, build glyphs, filters chrome, or PlaneShift inside the Garden.

## 8. Known divergences / Temporary POC behavior

- Spring placement is deterministic but approximate; no authored garden coordinates.
- Plane colors are auto-assigned green→purple by plant-trunk order (not authored YAML fields).
- Same-plant `standard_ancestor_osn_ids` (if any) are not drawn as dashed cross-tree edges.
- Near-zoom overlap culling is greedy (priority: Focus, plant trunk, compilation root / spine, then leaves); some near labels still hide until hover.
- No animated morph between Side view and Top view.

## 9. Related docs

- [`OSNG_Basics_README.md`](OSNG_Basics_README.md) — filename and `graph.*` conventions
- [`Lexiom_1.3_Ogun_Multi-Plane_OSN_Lineage_UX_Spec.md`](Lexiom_1.3_Ogun_Multi-Plane_OSN_Lineage_UX_Spec.md) — PlaneShift (cockpit)
- [`Lexiom_1.3.3_System_Description.md`](Lexiom_1.3.3_System_Description.md) — cockpit overview
