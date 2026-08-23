# OSNG Basics — Filenames as Graph Structure

An **Outcome Specification Node (OSN)** is a human-owned semantic source file. An **OSN Graph (OSNG)** is those nodes plus their relationships to each other and to evidentiary artifacts. This note describes the **filename conventions** that make those relationships readable from the filesystem alone.

Every live `*.osn.yaml` at or below this `Lexiom_1_3` directory opens with the same YAML comment header summarizing OSN fields and `graph.*` linking. The runtime discovers these files recursively, so domain subdirectories such as `Branding/` may organize cohesive OSN subgraphs without changing graph semantics. Treat that header and this README as a pair: the header is the in-file primer; this README is the filesystem-facing map (including evidence-artifact naming).

## OSN identity

Each live node is stored as:

```text
{hierarchical.path}.{unique_id}.osn.yaml
```

Inside the file, `id` and `file_name` match the stem (without `.yaml`), for example `OrgStandard.ProductX.UX.a1000003.osn`.

Directory placement is organizational rather than semantic. A node may live at the
`Lexiom_1_3` root or in any nested directory; `graph.parent_osn_ids` and
`graph.child_osn_ids` remain authoritative across directory boundaries. New nodes
canonized through the runtime are stored beside their primary parent.

Dot-separated **path segments** before the unique id encode ancestry. A child’s stem extends its parent’s path by one origin leaf, then adds a new unique id. From filenames alone you can sketch hierarchy:

```text
OrgStandard.a1000001.osn
└── OrgStandard.ProductX.a1000002.osn
    ├── OrgStandard.ProductX.UX.a1000003.osn
    └── OrgStandard.ProductX.CodeShape.a1000004.osn
```

Authoritative parent/child links also live in each OSN’s `graph.parent_osn_ids` / `graph.child_osn_ids`. Prefer those fields when they disagree with path prefixes; use prefixes as a fast map of a well-formed tree.

## Standard ancestors (secondary inheritance)

`graph.standard_ancestor_osn_ids` names **one-way** secondary inheritance edges — influence from another thematic trunk without becoming a second native parent.

- Reciprocity rules for `parent_osn_ids` ↔ `child_osn_ids` do **not** apply. Do not list the inheriting node under the standard ancestor’s `child_osn_ids`.
- Native plane (plane zero) remains the primary-parent chain via `parent_osn_ids[0]`.
- Lexiom 1.3 live example: ProductLexiom inherits AccessControl (under WebAppSecurity) as a secondary ancestor while remaining a native child of GT Philosophy; BrandLexiom stays a native sibling only (no secondary edge):

```text
GT_Philosophy.a1000001.osn
├── ProductLexiom.a1000002.osn
│     standard_ancestor_osn_ids → WebAppSecurity.AccessControl.a1000101.osn
└── BrandLexiom.a1000005.osn

WebAppSecurity.a1000100.osn          ← plane name WebAppSecurity (eldest root)
└── AccessControl.a1000101.osn       ← layout trunk S for ProductLexiom’s additional plane
    ├── Authentication.a1000103.osn
    └── Authorization.a1000104.osn
```

**Additional-plane convention:** when a plane is entered through a Focus OSN’s own `standard_ancestor_osn_ids` link to `S` (not inherited by walk-up from native parents), treat **`S` as that plane’s layout trunk** for surrounding-tree display (ancestor column ending at `S`, peers = children of `S` plus grafted inheritors). The **plane name** is always the origin-leaf of the **eldest root** of `S`’s native primary-parent chain (e.g. link to AccessControl → plane name `WebAppSecurity`). Native-plane naming likewise uses the eldest OSN on the Focus primary-parent chain. The PlaneShift shadow companions native ancestors only when the Focus OSN itself declares alternate links.

## Evidentiary artifacts

An OSN declares inspection contracts under `success_evidences` (`evidence_id`, `kind`, …) but does **not** embed the demo file path. Artifacts are named so the link is recoverable:

```text
{osn.file_name}.{evidence_id}.{version}.{extension}
```

Example: `OrgStandard.ProductX.UX.a1000003.osn.sev.ux.screenshot.v2.png`

- **OSN stem** — the segment ending in `.osn` points at `{stem}.yaml`.
- **evidence_id** — usually begins with `sev.` and matches that OSN’s `success_evidences`.
- **version** — e.g. `v1`, `v2` (newer preferred when both exist).
- **extension** — follows `kind` (`TEXTUAL_SNIPPET` → `.md` / `.js` / `.txt`; `SCREEN-SHOT` → image; `VIDEO-CLIP` → video; derivative `markdown_brief` → `.md`).

Given only an artifact name, split on the `.osn.` / `sev.` / `vN` pattern to recover which OSN requested it and which evidence slot it fills. Given only an OSN file, list evidence files whose names start with that OSN’s `file_name`.

## Quick checklist

1. Recursively list live `*.osn.yaml` below `Lexiom_1_3/` → nodes; exclude `*.tomb.osn.yaml`.
2. Nest by path prefix → candidate tree; confirm with `graph.*`.
3. Parse evidence filenames → edges from nodes to artifacts.
4. For filename conventions and evidence linkage detail, keep this README open beside any OSN header.

## Full-screen expositions

Lexiom 1.3 offers two full-screen graph expositions from the left-panel toggle:

1. **Side view** — indented native trees (legacy classical full-graph).
2. **Top view** (OSNG Garden) — radial trees colored per thematic plane (green→purple spectrum) with solid native arrows and dashed cross-tree `standard_ancestor` arrows; tree centers spaced by cross-link counts. See [`Lexiom_1_3_OSNG_Garden_UX_Spec_1_0.md`](Lexiom_1_3_OSNG_Garden_UX_Spec_1_0.md).

## Build plugins (related)

When compiling an OSNG branch into a delivered artifact via an external agent, see [`BuildPlugins/Lexiom_1_3_Build_Plugin_Contract_1_0.md`](BuildPlugins/Lexiom_1_3_Build_Plugin_Contract_1_0.md) and the document / software-coding plugin companions in that folder. Build plugins treat `graph.*` as the authoritative traversal order and must not write OSN YAML.

## Bud (post-build bloom pointer)

After a successful Virtualized Agent Loop run (primary SUD + readable evidence collection), Lexiom/GT3 may write an optional top-level **`bud`** object onto the **requesting** compilation-root OSN. Agents must never invent or write `bud` during prepare or the CA loop. See [`Lexiom_1_3_Center_Playfield_Build_Artifact_Review_UX_Spec_1_0.md`](Lexiom_1_3_Center_Playfield_Build_Artifact_Review_UX_Spec_1_0.md).
