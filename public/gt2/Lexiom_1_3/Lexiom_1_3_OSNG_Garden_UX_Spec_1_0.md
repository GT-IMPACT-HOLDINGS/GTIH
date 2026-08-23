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

## 3. Thematic trees

A thematic tree is the native primary-parent connected component under a graph root (OSNs with empty or unresolved `parent_osn_ids`), same roots as classical full-graph (`getGraphRootOsns()`).

Live Lexiom 1.3 example roots include `GT_Philosophy` and `WebAppSecurity`.

## 4. Radial layout (top-down / “from above”)

Within each tree:

- The root / trunk OSN occupies the local center `(0, 0)`.
- Direct descendants sit at a fixed ring distance `R` from their immediate parent.
- Children of a node share equal angular subdivision of the angular sector inherited from that parent.
- Root children subdivide the full `[0, 2π)` circle.

## 5. Garden placement

Multiple trees share one garden canvas. Relative placement of tree centers uses only the count of **cross-tree** `standard_ancestor_osn_ids` links:

- Trees with more such links are placed closer together.
- Trees with fewer (or zero) links are placed farther apart.
- Desired distance: `d = D0 / (1 + w)` when `w > 0`; unlinked pairs use a larger far distance.
- A short deterministic spring/relaxation loop settles centers (POC; no external physics library).

## 6. Inheritance rendering

| Inheritance | Source | Stroke |
|-------------|--------|--------|
| Native (plane-zero) | `parent_osn_ids[0]` / `child_osn_ids` within a tree | Solid arrows |
| Cross-tree | `standard_ancestor_osn_ids` when ancestor and inheritor have different roots | Dashed arrows |

Dashed arrows communicate that the linked OSNs belong to different thematic trees while still participating in the shared garden.

## 7. Visual language

- Each thematic tree/plane receives a distinct hue along a **green → purple** spectrum (stable by root order). Nodes, native solid arrows, labels, and root neon glow use that plane color.
- Cross-tree dashed arrows use a mid-spectrum bridge color so they remain readable as inter-plane links.
- Nodes: discs + short origin-leaf labels; roots slightly larger with a neon glow in their plane color; Focus OSN highlighted with a sinusoidal attention halo (3 LCD period; halo radius blooms 0 → 4× disc radius → 0 via `sin(π t)`; annulus between disc and halo filled with the halo color at **25% opacity**, **no circumference stroke**; fill color mixed **50% toward white on dark panels / toward black on light panels**; looping while Garden is open; reduced-motion uses a static soft wash).
- Hover: native SVG tooltip shows seed content above the origin-leaf name when seed exists; empty seed → name only.
- Wheel zoom and drag pan on the SVG `viewBox`.
- Navigation-only: no branching, build glyphs, filters chrome, or PlaneShift inside the Garden.

## 8. Known divergences / Temporary POC behavior

- Spring placement is deterministic but approximate; no authored garden coordinates.
- Plane colors are auto-assigned green→purple by root order (not authored YAML fields).
- Same-tree `standard_ancestor_osn_ids` (if any) are not drawn as dashed cross-tree edges.
- Dense Brand subgraphs under Philosophy may require pan/zoom; labels may overlap at default zoom.
- No animated morph between Side view and Top view.

## 9. Related docs

- [`OSNG_Basics_README.md`](OSNG_Basics_README.md) — filename and `graph.*` conventions
- [`Lexiom_1.3_Ogun_Multi-Plane_OSN_Lineage_UX_Spec.md`](Lexiom_1.3_Ogun_Multi-Plane_OSN_Lineage_UX_Spec.md) — PlaneShift (cockpit)
- [`Lexiom_1.3.3_System_Description.md`](Lexiom_1.3.3_System_Description.md) — cockpit overview
