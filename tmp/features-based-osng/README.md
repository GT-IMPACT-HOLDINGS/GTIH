# Feature-based OSNG (experiment)

This directory holds an alternate four-node OSN Graph that re-segments the live
domain-based Lexiom 1.3 graph (`UX` / `CodeShape`) into **cross-domain product
features** (`Cockpit` / `CockpitChat`).

## Graph

```text
GT_Philosophy.a2000001.osn
└── GT_Philosophy.Lexiom.a2000002.osn
    ├── GT_Philosophy.Lexiom.Cockpit.a2000003.osn
    └── GT_Philosophy.Lexiom.CockpitChat.a2000004.osn
```

| Node | Source mapping (approx.) |
|------|---------------------------|
| GT_Philosophy | Parent `GT_Philosophy.a1000001` (constellation standard) |
| Lexiom | Parent `ProductLexiom` product intent; children become features |
| Cockpit | UX shell + **full CodeShape shell contracts** (load, routes, state, render, lens/maturation round loop, branch/prune, build, evidence linking, persist/canonize, snippet evidence) |
| CockpitChat | UX chat ribbon + **CodeShape causal contracts** (chat state Maps, L2_LINEAGE / player-ask round loop, non-mutation, chat snippet evidence) |

Code Shaping is not dropped: every former CodeShape `output_spec` / lens /
`sev.code.direct_snippet_review` obligation is assigned to Cockpit and/or
CockpitChat under the feature cut.

## Notes

- Filename / graph conventions: see [`../OSNG_Basics_README.md`](../OSNG_Basics_README.md).
- This subdirectory is **not** loaded by the live SPA `/lexiom13/osn/list` scan (root `*.osn.yaml` only). It is a filesystem exercise in OSNG transformation.
- Demo evidence artifacts for these `a200000x` ids are not required to exist yet; `success_evidences` define the inspection contracts.
