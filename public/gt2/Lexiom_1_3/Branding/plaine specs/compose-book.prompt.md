# TASK: Compose a book from the specification files in `./`

You are the composer of a single, finished, publication-quality book. Your only
source of truth is the set of markdown specification files present in `./` at
the moment you run. Do not rely on any prior knowledge of this project, any
example document, or anything remembered from a previous session. If a file
named `document.md` (or any other pre-composed book) exists, ignore it entirely
as a source of content.

## PHASE 1 — INTAKE (discover, never assume)

1. List every `*.md` file in `./` (non-recursive; ignore `.cursor/`, `logs/`,
   this prompt file itself, and any output file you yourself create). Count
   them. This count, whatever it is, is the complete spec set.
2. Read every one of them in full. They are short — typically one to three
   sentences. Read all of them before writing anything.
3. Parse each filename as a hierarchy path. The convention to expect:
   `Segment1.Segment2.…SegmentN.<id>.md`, where segments are dot-delimited
   PascalCase node names and the final segment before `.md` is an identifier
   (e.g. a letter followed by digits). Derive:
   - **path** = the segment list with the identifier removed
   - **depth** = length of that path
   - **node name** = the last segment (de-PascalCase it into a human title,
     e.g. `CompetitiveDifferentiation` → "Competitive Differentiation")
   - **id** = the trailing identifier, used only for ordering and traceability

   If the actual filenames do not follow this convention, infer whatever
   hierarchy convention they *do* follow (numeric prefixes, folders, front
   matter, heading levels inside the file) and state your inference explicitly
   in the run report before proceeding.
4. Reconstruct the full tree by prefix: a spec whose path is a strict prefix of
   another spec's path is that spec's ancestor. Insert an implicit node for any
   missing intermediate path segment that no file occupies.

## PHASE 2 — OUTLINE (derive structure from the tree, not from taste)

1. The tree *is* the table of contents. Do not invent, merge, drop, or reorder
   top-level branches to suit a narrative you prefer.
2. Map depth to heading level: the shallowest specs that share a common single
   root become the book's top-level chapters (`#`); each additional level of
   depth is one additional `#`. If every spec shares one common root segment,
   that root supplies the book's title and its children become the chapters.
3. Ordering: within each parent, order children by their trailing identifier
   (ascending, natural/numeric sort). Only override this when a spec's own text
   states a required sequence (e.g. "phase 1 … phase 2"), and note any override
   in the run report.
4. Produce the outline as an explicit intermediate artifact and check it against
   the file list: every spec file must appear exactly once, and every heading
   must trace to a spec or an inserted implicit node. Do not start drafting
   until this check passes.

## PHASE 3 — DRAFTING (expand, don't quote)

Each spec is a *directive about what must be true of the finished text*, not a
sentence to be pasted in. Expand it.

- **Leaf specs** (no children) carry the substance: expand each into roughly
  200–600 words of finished prose — definition, mechanism, contrast, concrete
  implication, and where the spec supports it, illustrative structure such as a
  short list, a labelled sequence, or a table.
- **Parent specs** (with children) become framing: an opening passage that
  establishes the section's scope and the through-line connecting its children,
  written so the children read as its unfolding rather than as a list.
- **Implicit nodes** (path segments with no file) get a brief connective
  passage only. Never invent substantive claims for them.
- Scale the whole to the spec set: aim for a book whose length is proportional
  to the number of leaves, and keep depth of treatment even across siblings so
  no branch feels starved or bloated.

Constraints on invention:

- Every substantive claim must be traceable to at least one spec. You may
  supply connective reasoning, explanatory analogy, restatement for different
  audiences, and structural scaffolding. You may **not** introduce new facts,
  names, numbers, dates, prices, metrics, features, or commitments that no spec
  states or directly implies.
- Honour hedges and negations exactly. If a spec says something is *not
  implemented*, *not yet*, *planned*, or *out of scope*, the book must preserve
  that limit rather than quietly promoting it to a capability.
- Terminology is fixed by the specs. Extract the vocabulary the specs use for
  key entities and concepts, use those exact terms consistently throughout, and
  never introduce a synonym for a defined term.

## PHASE 4 — INTEGRATION AND SYNCHRONICITY (the part that makes it a book)

The deliverable is one continuous work, not a set of stitched fragments.

1. **One voice.** Uniform register, tense, person, sentence rhythm, and list
   style from first line to last. A reader must not be able to tell where one
   spec's territory ends and the next begins.
2. **Forward and backward binding.** Where a concept defined in one section is
   used in another, name the relationship in prose ("the same authority
   described earlier now governs…"). Define each key term once, at its earliest
   natural point, and thereafter use it without redefining.
3. **Cross-branch consistency.** The same concept must be characterised
   identically wherever it appears. Where two specs describe the same thing at
   different depths, the deeper one elaborates the shallower — it must never
   contradict or restate it verbatim.
4. **Chapter openings and closings.** Each top-level chapter opens by situating
   itself in the book's argument and closes with a short synthesis that carries
   the reader into the next.
5. **Front matter.** Derive a title from the root node and the specs' own
   language. Open with a brief framing section that states what the book covers
   and for whom, and include a table of contents generated from the outline.
6. **No meta-scaffolding in the text.** No spec filenames, identifiers, file
   paths, "as specified", "this section will", TODOs, or placeholders anywhere
   in the book body. The prose must read as if written by an author, not
   assembled by a machine.
7. **No duplication.** If two specs overlap, resolve the overlap into a single
   authoritative treatment plus a cross-reference, not two near-identical
   passages.

## PHASE 5 — OUTPUT AND VERIFICATION

1. Write the book to `./book.md` as a single markdown file. Do not overwrite or
   delete any spec file. If a file at that path already exists, write to
   `./book.<n>.md` instead.
2. Then verify, and fix anything that fails before reporting done:
   - Every spec file is represented; list any that are not.
   - Heading hierarchy is well formed: no skipped levels, no orphans, matches
     the Phase 2 outline.
   - No placeholder text, no filenames or identifiers, no unresolved
     cross-reference.
   - Terminology is consistent; no contradictions between sections.
   - Every negation and limitation in the specs survives in the text.
3. Report to the user, in prose and briefly: the number of specs found, the
   inferred hierarchy convention, the derived chapter list, the resulting word
   count, any ordering overrides or inferences you made, and any spec you found
   ambiguous or in tension with another (with how you resolved it). Do not put
   this report inside `book.md`.



## FAILURE MODES TO AVOID

- Treating the specs as an outline to be echoed rather than a brief to be
  fulfilled: a book that is one heading per spec, each followed by a single
  restated sentence, is a failure even if complete.
- Inventing an appealing narrative structure that diverges from the spec tree.
- Padding: repeated ideas, throat-clearing, or sections that say the same thing
  in three registers.
- Smuggling in domain content you happen to know but no spec states.
- Stopping at a draft. The deliverable is finished, verified, publication-ready
  prose.
