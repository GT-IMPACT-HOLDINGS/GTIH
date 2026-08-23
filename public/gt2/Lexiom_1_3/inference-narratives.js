(function () {
  "use strict";

  function trimBlock(value) {
    return String(value || "").trim();
  }

  function isOsnUidSegment(segment) {
    return /^[a-f0-9]{8}$/i.test(String(segment || ""));
  }

  /** UI/narrative label: last origin stem before the unique id suffix. */
  function getOsnOriginLeafLabel(osn) {
    const raw = trimBlock(
      osn && (osn.file_name || osn.__fileLabel || osn.id) ? osn.file_name || osn.__fileLabel || osn.id : ""
    ).replace(/\.osn$/i, "");
    const parts = raw.split(".").filter(Boolean);
    if (parts.length >= 2 && isOsnUidSegment(parts[parts.length - 1])) {
      return parts[parts.length - 2];
    }
    if (parts.length) {
      return parts[parts.length - 1];
    }
    return trimBlock(osn && osn.title ? osn.title : "") || "OSN";
  }

  function indentLines(text, prefix) {
    return String(text || "")
      .split(/\r?\n/)
      .map(function (line) {
        return prefix + line;
      })
      .join("\n");
  }

  // Ancestor context passes upstream owner intention: each parent's output_spec is
  // evidence-backed semantic source that child lens reframing must honor, not override.
  function formatAncestorLines(ancestors) {
    if (!Array.isArray(ancestors) || !ancestors.length) {
      return "(none)";
    }
    return ancestors
      .map(function (osn) {
        const title = getOsnOriginLeafLabel(osn);
        const seed = trimBlock(osn.seed).split(/\r?\n/)[0];
        const outputSpec = trimBlock(osn.output_spec);
        let block = "- " + title;
        if (seed) {
          block += "\n  Seed: " + seed;
        }
        if (outputSpec) {
          block += "\n  Output Spec:\n" + indentLines(outputSpec, "    ");
        }
        return block;
      })
      .join("\n\n");
  }

  /**
   * Build GT3 narrative for reframing one OSN section through a thematic lens.
   * @param {{
   *   osn: object,
   *   sectionKey: string,
   *   sectionLabel: string,
   *   sectionText: string,
   *   lens: { lens_id?: string, name?: string, purpose?: string },
   *   ancestors?: object[],
   *   pass?: number
   * }} ctx
   * @returns {string}
   */
  function buildOsnLensReframeNarrative(ctx) {
    const osn = ctx && ctx.osn ? ctx.osn : {};
    const lens = ctx && ctx.lens ? ctx.lens : {};
    const sectionKey = trimBlock(ctx && ctx.sectionKey);
    const sectionLabel = trimBlock(ctx && ctx.sectionLabel) || sectionKey || "section";
    const sectionText = trimBlock(ctx && ctx.sectionText);
    const lensName = trimBlock(lens.name || lens.lens_id || "Lens");
    const lensPurpose = trimBlock(lens.purpose);
    const osnTitle = getOsnOriginLeafLabel(osn);
    const osnSeed = trimBlock(osn.seed);
    // pass counts human clicks on the same lens for the same section. Pass 1 is
    // the first application; each later pass deepens the SAME draft further.
    const pass = Math.max(1, parseInt(ctx && ctx.pass, 10) || 1);

    const intensityGuidance = pass <= 1
      ? "- This is the first application of this lens (pass 1). Reshape the CURRENT SECTION so its perspective, priorities, vocabulary, and concerns clearly reflect the lens, while preserving the owner's intent.\n"
      : "- This is refinement pass " + pass + " for the SAME lens. The CURRENT SECTION draft already reflects prior applications of this lens. Push it further into the lens's semantic realm: intensify the lens-specific emphasis, deepen its characteristic concepts and terminology, and sharpen the tradeoffs this lens cares about, so the draft reads as more strongly shaped by the lens than before. Continue building on the current draft rather than restarting from a neutral phrasing.\n";

    return (
      "You are Lexiom 1.3, reshaping one OSN section through an approved thematic discipline lens for structured reasoning-making.\n\n" +
      "TASK:\n" +
      "- Reshape the CURRENT SECTION DRAFT so it is clearer, sharper, and more strongly viewed through the selected lens.\n" +
      "- Preserve the owner's intent; do not invent unrelated product scope.\n" +
      "- Honor the ANCESTOR CONTEXT: the section must stay consistent with each ancestor's output specification and must not override upstream owner outcomes.\n" +
      "- Return only the reshaped section text. No preamble, no markdown fences, no bullet labels unless they help readability inside the section itself.\n" +
      "- Keep the result concise and directly editable in a draft-first card.\n\n" +
      "OSN:\n" +
      "- Title: " + osnTitle + "\n" +
      (osnSeed ? "- Seed: " + osnSeed + "\n" : "") +
      "\nANCESTOR CONTEXT:\n" +
      formatAncestorLines(ctx && ctx.ancestors) +
      "\n\nSELECTED LENS:\n" +
      "- Name: " + lensName + "\n" +
      (lens.lens_id ? "- Lens ID: " + trimBlock(lens.lens_id) + "\n" : "") +
      (lensPurpose ? "- Purpose: " + lensPurpose + "\n" : "") +
      "\nCURRENT SECTION:\n" +
      "- Key: " + sectionKey + "\n" +
      "- Label: " + sectionLabel + "\n" +
      "- Application pass: " + pass + "\n" +
      "- Draft text:\n" +
      (sectionText || "(empty)") +
      "\n\nREFRAME GUIDANCE:\n" +
      intensityGuidance +
      "- Explain tradeoffs, missing concerns, and sharper wording only insofar as they belong to this lens.\n" +
      "- Do not change unrelated OSN sections.\n" +
      "- Treat this as a draft proposal awaiting explicit human approval."
    );
  }

  function formatAncestorOutputSpecLines(ancestors) {
    if (!Array.isArray(ancestors) || !ancestors.length) {
      return "(none — no ancestor output specifications available)";
    }
    return ancestors
      .map(function (osn) {
        const title = getOsnOriginLeafLabel(osn);
        const outputSpec = trimBlock(osn.output_spec);
        if (!outputSpec) {
          return "- " + title + "\n  Output Spec: (empty)";
        }
        return "- " + title + "\n  Output Spec:\n" + indentLines(outputSpec, "    ");
      })
      .join("\n\n");
  }

  /**
   * Build GT3 narrative proposing a seed draft for a newly branched immature OSN.
   * Grounds the proposal in output_spec values inherited from all ancestors.
   * @param {{
   *   osn: object,
   *   ancestors?: object[]
   * }} ctx
   * @returns {string}
   */
  function buildOsnSeedProposalNarrative(ctx) {
    const osn = ctx && ctx.osn ? ctx.osn : {};
    const osnTitle = getOsnOriginLeafLabel(osn);
    const nodeType = trimBlock(osn.node_type || "discipline");
    const parentIds = Array.isArray(osn.graph && osn.graph.parent_osn_ids)
      ? osn.graph.parent_osn_ids
      : [];

    return (
      "You are Lexiom 1.3, proposing a seed draft for a newly branched Outcome Specification Node (OSN) in a reasoning-making cockpit.\n\n" +
      "TASK:\n" +
      "- Propose a concise OSN seed statement for the NEW BRANCHED OSN below.\n" +
      "- The seed should express a focused human intention that deepens or specializes the inherited ancestor outcomes — not repeat them verbatim.\n" +
      "- Ground the seed ONLY in the ANCESTOR OUTPUT SPECIFICATIONS listed below. These are the authoritative upstream outcomes this branch must honor and extend.\n" +
      "- Do not invent scope unrelated to the ancestor output specifications.\n" +
      "- Return only the proposed seed text. No preamble, no markdown fences, no section labels.\n" +
      "- Keep the result directly editable in a draft-first card (one to four short paragraphs maximum).\n\n" +
      "NEW BRANCHED OSN:\n" +
      "- Title: " + osnTitle + "\n" +
      "- Node type: " + nodeType + "\n" +
      (parentIds.length ? "- Parent OSN id: " + parentIds.join(", ") + "\n" : "") +
      "\nANCESTOR OUTPUT SPECIFICATIONS (inherited context — honor these):\n" +
      formatAncestorOutputSpecLines(ctx && ctx.ancestors) +
      "\n\nGUIDANCE:\n" +
      "- The seed names what this branch node is meant to become — a clear, owned intention the player can edit and approve.\n" +
      "- Stay consistent with every ancestor output specification; resolve tensions explicitly if ancestors pull in different directions.\n" +
      "- Treat this as a draft proposal awaiting explicit human approval."
    );
  }

  window.lexiom13BuildOsnLensReframeNarrative = buildOsnLensReframeNarrative;
  window.lexiom13BuildOsnSeedProposalNarrative = buildOsnSeedProposalNarrative;

  /**
   * Build GT3 narrative proposing a short OSN title after seed approval.
   * @param {{
   *   osn: object,
   *   seedText?: string,
   *   ancestors?: object[]
   * }} ctx
   * @returns {string}
   */
  function buildOsnTitleProposalNarrative(ctx) {
    const osn = ctx && ctx.osn ? ctx.osn : {};
    const seedText = trimBlock(ctx && ctx.seedText ? ctx.seedText : osn.seed);
    const nodeType = trimBlock(osn.node_type || "discipline");

    return (
      "You are Lexiom 1.3, naming a newly branched Outcome Specification Node (OSN) that is maturing from an approved seed.\n\n" +
      "TASK:\n" +
      "- Propose a short name for this OSN using ONLY 1 or 2 words.\n" +
      "- The name should capture the core subject of the APPROVED SEED below — what this node is becoming — not a generic label like 'New Branch'.\n" +
      "- Prefer evocative, specific words drawn from the seed's intention; avoid articles, punctuation, and role labels.\n" +
      "- Return only the proposed name. No preamble, no markdown fences, no 'Title:' label, no explanation.\n\n" +
      "OUTPUT CONTRACT (write exactly this and nothing else):\n" +
      "- Output ONLY the 1–2 word name on a single line.\n" +
      "- Use 1 word when it is sufficient; use 2 words only when both are needed to name the seed's subject clearly.\n" +
      "- Do NOT echo the seed text, ancestor context, or any other labels.\n\n" +
      "EXACT OUTPUT EXAMPLES (format only):\n" +
      "Palette\n\n" +
      "Welcome Flow\n\n" +
      "--- CONTEXT (for your reasoning only; never repeat it in the output) ---\n" +
      "Node type: " + nodeType + "\n" +
      "\nAPPROVED SEED:\n" +
      (seedText || "(empty)") +
      "\n\nANCESTOR OUTPUT SPECIFICATIONS:\n" +
      formatAncestorOutputSpecLines(ctx && ctx.ancestors) +
      "\n\nGUIDANCE:\n" +
      "- Honor the inherited direction from ancestors when choosing words, but keep the name anchored in this seed's subject.\n" +
      "- Treat this as a draft proposal awaiting explicit human approval of later maturation steps."
    );
  }

  window.lexiom13BuildOsnTitleProposalNarrative = buildOsnTitleProposalNarrative;

  /**
   * Build GT3 narrative proposing thematic discipline lenses after seed approval.
   * @param {{
   *   osn: object,
   *   seedText?: string,
   *   ancestors?: object[]
   * }} ctx
   * @returns {string}
   */
  function buildOsnThematicLensesProposalNarrative(ctx) {
    const osn = ctx && ctx.osn ? ctx.osn : {};
    const seedText = trimBlock(ctx && ctx.seedText ? ctx.seedText : osn.seed);
    const osnTitle = getOsnOriginLeafLabel(osn);
    const nodeType = trimBlock(osn.node_type || "discipline");

    return (
      "You are Lexiom 1.3, expanding an approved OSN seed into thematic discipline lenses (semantic prisms) for a newly branched Outcome Specification Node (OSN).\n\n" +
      "TASK:\n" +
      "- Expand the APPROVED SEED into EXACTLY 3 thematic lenses.\n" +
      "- Grow the seed toward the semantic direction expressed by its ANCESTORS. The ANCESTOR OUTPUT SPECIFICATIONS below are quoted upstream outcomes; treat them as the gravitational pull that orients the seed's growth, so the 3 lenses develop the seed in a way that deepens and honors that inherited direction rather than drifting away from it.\n" +
      "- Treat each lens as a distinct semantic vector: take the seed's core subject and decompose it into 3 different directions that pull apart from one another, so together they open the seed like a prism splitting light.\n" +
      "- The 3 lenses must be non-overlapping facets of the SAME seed subject — not generic professional roles, and not restatements of the seed. Each should reveal a different dimension a person could develop independently.\n" +
      "- Example of the intended move: if the seed is about the color scheme of a UI, three strong semantic vectors could be 'Tone', 'Transparency', and 'Texture'. If the seed is about a welcome flow, vectors could pull apart pacing, orientation, and reassurance. Derive vectors that genuinely fit THIS seed.\n\n" +
      "OUTPUT CONTRACT (write exactly this and nothing else):\n" +
      "- Output ONLY the 3 lens blocks. Each lens is exactly two lines:\n" +
      "    Line 1: the lens name on its own line (no bullet, no numbering, no 'Lens Name:' label).\n" +
      "    Line 2: 'Purpose: ' followed by one concise sentence naming the semantic direction this vector expands from the seed.\n" +
      "- Separate the 3 lenses with exactly one blank line.\n" +
      "- Do NOT include any headings, preamble, commentary, markdown fences, bullets, or context labels.\n" +
      "- Do NOT echo the OSN title, node type, seed, or ancestor context anywhere in the output.\n\n" +
      "EXACT OUTPUT EXAMPLE (format only — invent 3 vectors suited to THIS seed):\n" +
      "Tone\n" +
      "Purpose: Expand the seed along the emotional temperature and hue relationships of the palette.\n\n" +
      "Transparency\n" +
      "Purpose: Expand the seed along layering, opacity, and how surfaces let light and content through.\n\n" +
      "Texture\n" +
      "Purpose: Expand the seed along surface grain, material feel, and tactile visual detail.\n\n" +
      "--- CONTEXT (for your reasoning only; never repeat it in the output) ---\n" +
      "OSN Title: " + osnTitle + "\n" +
      "Node type: " + nodeType + "\n" +
      "\nAPPROVED SEED (this is the subject to split into 3 vectors):\n" +
      (seedText || "(empty)") +
      "\n\nANCESTOR OUTPUT SPECIFICATIONS:\n" +
      formatAncestorOutputSpecLines(ctx && ctx.ancestors) +
      "\n\nGUIDANCE:\n" +
      "- Stay strictly within the seed's subject; the 3 vectors are facets of it, expanding in different directions.\n" +
      "- Prefer short, evocative single-word or short-phrase lens names, like the prism example.\n" +
      "- Keep the 3 vectors clearly distinct from one another with minimal conceptual overlap.\n" +
      "- Treat this as a draft proposal awaiting explicit human approval."
    );
  }

  window.lexiom13BuildOsnThematicLensesProposalNarrative = buildOsnThematicLensesProposalNarrative;

  function formatThematicLensLines(lenses) {
    if (!Array.isArray(lenses) || !lenses.length) {
      return "(none)";
    }
    return lenses
      .map(function (lens) {
        const name = trimBlock(lens.name || lens.lens_id || "Lens");
        const purpose = trimBlock(lens.purpose);
        let block = "- " + name;
        if (lens.lens_id) {
          block += " (lens_id: " + trimBlock(lens.lens_id) + ")";
        }
        if (purpose) {
          block += "\n  Purpose: " + purpose;
        }
        return block;
      })
      .join("\n\n");
  }

  /**
   * Build GT3 narrative proposing an output specification after lens approval.
   * @param {{
   *   osn: object,
   *   seedText?: string,
   *   thematicLenses?: object[],
   *   ancestors?: object[]
   * }} ctx
   * @returns {string}
   */
  function buildOsnOutputSpecProposalNarrative(ctx) {
    const osn = ctx && ctx.osn ? ctx.osn : {};
    const seedText = trimBlock(ctx && ctx.seedText ? ctx.seedText : osn.seed);
    const osnTitle = getOsnOriginLeafLabel(osn);
    const nodeType = trimBlock(osn.node_type || "discipline");
    const lenses = Array.isArray(ctx && ctx.thematicLenses) ? ctx.thematicLenses : [];

    return (
      "Please propose an output specification for my friend. Let your proposal expand the System Under Development (SUD)'s seed (as it would be given to you below) as a means to assist our friend in maturing the specifications for the purpose of maturing the SUD along with its specifications.\n\n" +
      "TASK:\n" +
      "- Lexiom wants your reply to be a well-structured requirements specification written in the manner of a Software Requirements Specification (SRS): precise, accountable statements of what this node must express, produce, protect, validate, constrain, or develop for the SUD.\n" +
      "- Expand the SUD's seed (given below)—not merely this OSN's local seed in isolation—so the proposal helps our friend mature the specifications and the SUD together.\n" +
      "- Ground the proposal in the APPROVED SEED and APPROVED THEMATIC LENSES below.\n" +
      "- Refer explicitly to the subject matter established by the ANCESTOR OUTPUT SPECIFICATIONS below. State this node's owned outcome in terms consistent with that inherited subject matter rather than introducing unrelated scope.\n" +
      "- Write in language that matches the linguistic nuances of the ancestors: adopt similar phrasing patterns, tone, modality (e.g. shall/must/should), and descriptive register to how those ancestors express their desire for how the SUD should be described.\n" +
      "- Structure the answer as an SRS-style requirements body: clear requirement statements, grouped logically where helpful, numbered or bulleted where it aids review—without adding document titles or section headings beyond what the requirement text itself needs.\n" +
      "- Return only the proposed output specification text. No preamble, no markdown fences, no meta-commentary.\n" +
      "- Keep the result directly editable in a draft-first card.\n\n" +
      "OSN:\n" +
      "- Title: " + osnTitle + "\n" +
      "- Node type: " + nodeType + "\n" +
      "\nAPPROVED SEED:\n" +
      (seedText || "(empty)") +
      "\n\nAPPROVED THEMATIC LENSES:\n" +
      formatThematicLensLines(lenses) +
      "\n\nANCESTOR OUTPUT SPECIFICATIONS:\n" +
      formatAncestorOutputSpecLines(ctx && ctx.ancestors) +
      "\n\nGUIDANCE:\n" +
      "- Each requirement should be inspectable: a reviewer should be able to tell whether the SUD satisfies it.\n" +
      "- Honor every approved lens and ancestor output specification; resolve tensions explicitly when needed.\n" +
      "- When ancestors use particular idioms, constraint verbs, or descriptive habits, carry those forward rather than switching to a generic or mismatched voice.\n" +
      "- Treat this as a draft proposal awaiting explicit human approval."
    );
  }

  window.lexiom13BuildOsnOutputSpecProposalNarrative = buildOsnOutputSpecProposalNarrative;

  /**
   * Build GT3 narrative proposing success evidences after output spec approval.
   * @param {{
   *   osn: object,
   *   seedText?: string,
   *   thematicLenses?: object[],
   *   outputSpecText?: string,
   *   ancestors?: object[]
   * }} ctx
   * @returns {string}
   */
  function buildOsnSuccessEvidencesProposalNarrative(ctx) {
    const osn = ctx && ctx.osn ? ctx.osn : {};
    const seedText = trimBlock(ctx && ctx.seedText ? ctx.seedText : osn.seed);
    const outputSpecText = trimBlock(ctx && ctx.outputSpecText ? ctx.outputSpecText : osn.output_spec);
    const osnTitle = getOsnOriginLeafLabel(osn);
    const nodeType = trimBlock(osn.node_type || "discipline");
    const lenses = Array.isArray(ctx && ctx.thematicLenses) ? ctx.thematicLenses : [];

    return (
      "You are Lexiom 1.3, proposing success evidences for a maturing Outcome Specification Node (OSN).\n\n" +
      "TASK:\n" +
      "- Help the player compose a SHORT list of exactly 2 success evidence entries: one direct evidence and one indirect (derivative) evidence.\n" +
      "- The DIRECT evidence (direct: true) must confirm that at least ONE concrete requirement in the APPROVED OUTPUT SPECIFICATION below has actually been met. Pick a single, checkable requirement and describe a first-hand artifact that demonstrates it is satisfied in the delivered SUD.\n" +
      "- The INDIRECT evidence (direct: false) must try to capture as MUCH derivative data as possible that validates the player's broader intention as expressed when they approved the output specification. Prefer an aggregate report, measurement, or summary spanning the SUD rather than a single spot check.\n" +
      "- Example: if the output spec requests a specific naming convention in JavaScript source files and also requests short functions/methods, a good direct evidence is a reviewable snippet of one JavaScript function that visibly follows the naming convention, and a good indirect evidence is a markdown report measuring function/method length across the SUD's source code.\n" +
      "- Ground both entries in the APPROVED OUTPUT SPECIFICATION below — each inspection_prompt must describe how to capture or review a delivered artifact produced downstream of the spec, not the spec text itself.\n" +
      "- NEVER cite the OSN's own seed, lenses, output_spec, or evidence definitions as direct evidence.\n\n" +
      "OUTPUT CONTRACT (write exactly this and nothing else):\n" +
      "- Output ONLY the 2 evidence blocks, direct first then indirect. Each block uses exactly four lines:\n" +
      "    evidence_id: sev.draft.<short_slug>\n" +
      "    kind: <for direct: TEXTUAL_SNIPPET | SCREEN-SHOT | VIDEO-CLIP; for indirect: markdown_brief or another non-direct label>\n" +
      "    direct: true | false\n" +
      "    inspection_prompt: <one or more sentences describing how to produce or inspect the artifact>\n" +
      "- Separate the 2 blocks with exactly one blank line.\n" +
      "- Do NOT include any headings, preamble, commentary, markdown fences, bullets, or context labels.\n" +
      "- Do NOT echo the OSN title, node type, seed, lenses, output spec, or ancestor context anywhere in the output.\n\n" +
      "EXACT OUTPUT EXAMPLE (format only — invent entries suited to THIS output spec):\n" +
      "evidence_id: sev.draft.function_snippet\n" +
      "kind: TEXTUAL_SNIPPET\n" +
      "direct: true\n" +
      "inspection_prompt: Open one delivered JavaScript source file from the SUD and copy a single function that visibly follows the naming convention required by the output specification, so the reviewer can confirm that specific requirement is met.\n\n" +
      "evidence_id: sev.draft.function_length_report\n" +
      "kind: markdown_brief\n" +
      "direct: false\n" +
      "inspection_prompt: Produce a markdown report measuring the length of every function and method across the SUD's source code, summarizing how closely the codebase honors the player's intent for short functions expressed in the approved output specification.\n\n" +
      "--- CONTEXT (for your reasoning only; never repeat it in the output) ---\n" +
      "OSN Title: " + osnTitle + "\n" +
      "Node type: " + nodeType + "\n" +
      "\nAPPROVED SEED:\n" +
      (seedText || "(empty)") +
      "\n\nAPPROVED THEMATIC LENSES:\n" +
      formatThematicLensLines(lenses) +
      "\n\nAPPROVED OUTPUT SPECIFICATION (derive inspection artifacts from this — do not quote it back as evidence):\n" +
      (outputSpecText || "(empty)") +
      "\n\nANCESTOR OUTPUT SPECIFICATIONS:\n" +
      formatAncestorOutputSpecLines(ctx && ctx.ancestors) +
      "\n\nGUIDANCE:\n" +
      "- The direct evidence inspects a delivered artifact or observable behavior proving one specific output-spec requirement is met; the indirect evidence aggregates derivative data validating the player's broader intent.\n" +
      "- inspection_prompt should be concrete enough that a reviewer knows what to open, capture, measure, or report.\n" +
      "- Treat this as a draft proposal awaiting explicit human approval."
    );
  }

  window.lexiom13BuildOsnSuccessEvidencesProposalNarrative = buildOsnSuccessEvidencesProposalNarrative;

  function formatOsnTreeOutputSpecLines(osns) {
    if (!Array.isArray(osns) || !osns.length) {
      return "(none — no OSN output specifications available)";
    }
    return osns
      .map(function (osn) {
        const title = getOsnOriginLeafLabel(osn);
        const outputSpec = trimBlock(osn.output_spec);
        if (!outputSpec) {
          return "- " + title + "\n  Output Spec: (empty)";
        }
        return "- " + title + "\n  Output Spec:\n" + indentLines(outputSpec, "    ");
      })
      .join("\n\n");
  }

  /**
   * Build GT3 narrative proposing a cockpit title from the united OSN tree output specs.
   * @param {{
   *   osns?: object[]
   * }} ctx
   * @returns {string}
   */
  function buildCockpitTitleProposalNarrative(ctx) {
    const osns = Array.isArray(ctx && ctx.osns) ? ctx.osns : [];

    return (
      "You are GT3, let your answer refer to the System Under Development (SUD) as a mean to assist our friend in maturing the SUD specifications for the purpose of maturing the SUD itself.\n\n" +
      "TASK:\n" +
      "- Propose ONE short cockpit title that captures what this entire OSN tree is collectively trying to produce.\n" +
      "- Ground the title ONLY in the OSN TREE OUTPUT SPECIFICATIONS below.\n" +
      "- The title should feel like a human-facing name for the experience or system outcome, not a file name, node id, or technical label.\n" +
      "- Return only the proposed title. No preamble, no markdown fences, no 'Title:' label, no explanation.\n\n" +
      "OUTPUT CONTRACT (write exactly this and nothing else):\n" +
      "- Output ONLY the title on a single line.\n" +
      "- Use between 2 and 8 words.\n" +
      "- Do NOT echo output specifications, OSN file names, or ancestor labels in the output.\n\n" +
      "EXACT OUTPUT EXAMPLES (format only):\n" +
      "Welcoming OSN Cockpit\n\n" +
      "Reasoning Source Tree\n\n" +
      "OSN TREE OUTPUT SPECIFICATIONS (hierarchical — honor the full tree):\n" +
      formatOsnTreeOutputSpecLines(osns) +
      "\n\nGUIDANCE:\n" +
      "- Synthesize the tree into one memorable title a newcomer would understand.\n" +
      "- Prefer outcome language over implementation jargon.\n" +
      "- Treat this as a draft proposal; the player may later edit surrounding cockpit copy."
    );
  }

  window.lexiom13BuildCockpitTitleProposalNarrative = buildCockpitTitleProposalNarrative;

  function formatSuccessEvidenceDefLines(evidences) {
    if (!Array.isArray(evidences) || !evidences.length) {
      return "(none)";
    }
    return evidences
      .map(function (def) {
        const id = trimBlock(def.evidence_id || "evidence");
        const kind = trimBlock(def.kind || "");
        const direct = def.direct === true ? "true" : "false";
        const prompt = trimBlock(def.inspection_prompt);
        let block = "- " + id + " (kind: " + (kind || "unspecified") + ", direct: " + direct + ")";
        if (prompt) {
          block += "\n  Inspection prompt: " + prompt;
        }
        return block;
      })
      .join("\n\n");
  }

  function formatThreadHistoryLines(messages) {
    if (!Array.isArray(messages) || !messages.length) {
      return "(none — first question in this evidence-scoped thread)";
    }
    return messages
      .map(function (entry) {
        const role = trimBlock(entry.role || "user");
        const text = trimBlock(entry.text);
        return role.toUpperCase() + ": " + (text || "(empty)");
      })
      .join("\n\n");
  }

  /**
   * Build GT3 narrative for Causal Lineage Chat while reviewing success evidence.
   * @param {{
   *   osn: object,
   *   evidenceLink: object,
   *   evidenceDef?: object,
   *   artifactBody?: string,
   *   ancestors?: object[],
   *   standardAncestors?: object[],
   *   priorMessages?: object[]
   * }} ctx
   * @returns {string}
   */
  function buildCausalLineageNarrative(ctx) {
    const osn = ctx && ctx.osn ? ctx.osn : {};
    const link = ctx && ctx.evidenceLink ? ctx.evidenceLink : {};
    const def = ctx && ctx.evidenceDef ? ctx.evidenceDef : {};
    const osnTitle = getOsnOriginLeafLabel(osn);
    const seed = trimBlock(osn.seed);
    const outputSpec = trimBlock(osn.output_spec);
    const lensesDraftText = trimBlock(osn.thematic_lenses_draft_text);
    const evidencesDraftText = trimBlock(osn.success_evidences_draft_text);
    const question = trimBlock(ctx && ctx.question);
    const artifactBody = trimBlock(ctx && ctx.artifactBody);
    const mediaType = trimBlock(link.mediaType || "unknown");
    const compilation = osn.compilation && typeof osn.compilation === "object" ? osn.compilation : null;

    let artifactSection =
      "- Evidence ID: " + trimBlock(link.evidenceId || def.evidence_id || "unknown") + "\n" +
      "- Kind: " + trimBlock(link.kind || def.kind || "unknown") + "\n" +
      "- Direct: " + (def.direct === true ? "true" : "false") + "\n" +
      "- Artifact file: " + trimBlock(link.artifactFileName || "unknown") + "\n" +
      "- Media type: " + mediaType + "\n" +
      "- Inspection prompt: " + (trimBlock(link.inspectionPrompt || def.inspection_prompt) || "(none)");

    if (artifactBody) {
      artifactSection += "\n- Artifact body (text/code excerpt):\n" + indentLines(artifactBody, "    ");
    } else if (mediaType === "image" || mediaType === "video") {
      artifactSection +=
        "\n- Visual artifact note: pixel-level vision is unavailable in this MVP. " +
        "Reason from the inspection prompt, OSN output specifications, and graph lineage only.";
    }

    let compilationSection = "(none)";
    if (compilation) {
      compilationSection =
        "- can_be_compilation_root: " + String(!!compilation.can_be_compilation_root) + "\n" +
        "- compilation_scope: " + trimBlock(compilation.compilation_scope || "unspecified") + "\n" +
        "- target_tool_profile: " + trimBlock(compilation.target_tool_profile || "unspecified");
    }

    let focusQuotableSection =
      "FOCUS OSN:\n" +
      "- Title: " + osnTitle + "\n" +
      "- File: " + getOsnOriginLeafLabel(osn) + "\n" +
      "\nFOCUS OSN SEED (context only — do not quote under APPROVED_CAUSES):\n" +
      (seed || "(empty)") +
      "\n\nFOCUS OSN THEMATIC LENSES (context only — do not quote under APPROVED_CAUSES):\n" +
      formatThematicLensLines(osn.thematic_lenses) +
      (lensesDraftText
        ? "\n\nFOCUS OSN THEMATIC LENSES DRAFT TEXT (context only — do not quote under APPROVED_CAUSES):\n" +
          lensesDraftText
        : "") +
      "\n\nFOCUS OSN OUTPUT SPECIFICATION (sole quotation source for APPROVED_CAUSES):\n" +
      (outputSpec || "(empty)") +
      "\n\nFOCUS OSN SUCCESS EVIDENCE DEFINITIONS (context only — do not quote under APPROVED_CAUSES):\n" +
      formatSuccessEvidenceDefLines(osn.success_evidences) +
      (evidencesDraftText
        ? "\n\nFOCUS OSN SUCCESS EVIDENCES DRAFT TEXT (context only — do not quote under APPROVED_CAUSES):\n" +
          evidencesDraftText
        : "");

    return (
      "You are Lexiom 1.3 answering a Causal Lineage Chat question during success-evidence review.\n\n" +
      "TASK:\n" +
      "- The human is inspecting a delivered success-evidence artifact in the Center Playfield.\n" +
      "- Their question is semantically scoped to WHY the System Under Development (SUD) looks, feels, reads, or behaves as shown in that evidence — not a general-purpose chat.\n" +
      "- Reason ONLY inside the approved semantic territory below: OSN seeds, output specifications, thematic lenses, success-evidence definitions, ancestors, and organizational standards.\n" +
      "- Do NOT treat your answer as canonical truth. This is a Black Move draft explanation for human review.\n" +
      "- Classify every causal claim into approved, inferred, or missing lineage.\n" +
      "- For APPROVED_CAUSES: quote ONLY from the Focus OSN output_spec (OUTPUT SPECIFICATION) below. Do not use seed, thematic lenses, success evidences, ancestors, or other fields as APPROVED_CAUSES quotation sources.\n\n" +
      "CURRENT QUESTION:\n" +
      (question || "(empty)") +
      "\n\nPRIOR THREAD (same evidence scope — follow-ups need not restate the artifact):\n" +
      formatThreadHistoryLines(ctx && ctx.priorMessages) +
      "\n\n" +
      focusQuotableSection +
      "\n\nDISPLAYED SUCCESS EVIDENCE ARTIFACT:\n" +
      artifactSection +
      "\n\nPARENT / ANCESTOR OSNs (secondary context — do not quote under APPROVED_CAUSES):\n" +
      formatAncestorLines(ctx && ctx.ancestors) +
      "\n\nORGANIZATIONAL STANDARD ANCESTORS (secondary context — do not quote under APPROVED_CAUSES):\n" +
      formatAncestorLines(ctx && ctx.standardAncestors) +
      "\n\nCOMPILATION METADATA:\n" +
      compilationSection +
      "\n\nOUTPUT CONTRACT (use this exact structure):\n" +
      "Line 1 must be exactly:\n" +
      "EXEC_SUMMARY: <one line containing exactly 13-17 words that executive-summarize the full lineage exploration narrative below>\n" +
      "Then a blank line.\n" +
      "Then write a short narrative explanation paragraph (2-6 sentences).\n" +
      "Then include these section headers on their own lines, each followed by bullet lines starting with \"- \":\n" +
      "APPROVED_CAUSES:\n" +
      "- Quote ONLY from the Focus OSN output_spec / OUTPUT SPECIFICATION above.\n" +
      "- Each bullet MUST include (1) the Focus OSN file name and the section label Output Spec, and (2) an accurate verbatim quote from that output_spec enclosed in double quotes.\n" +
      "- Do not paraphrase output_spec wording inside those quotes; copy the words exactly as written in FOCUS OSN OUTPUT SPECIFICATION.\n" +
      "- Do NOT quote seed, thematic lenses, success evidences, ancestors, standards, artifact metadata, or general knowledge under APPROVED_CAUSES.\n" +
      "- If no output_spec passage supports the claim, do NOT place it under APPROVED_CAUSES — use INFERRED_CAUSES or MISSING_CAUSES instead.\n" +
      "INFERRED_CAUSES:\n" +
      "- Plausible causes not directly established by Focus OSN output_spec quotes; mark lower authority.\n" +
      "MISSING_CAUSES:\n" +
      "- Features or behaviors lacking approved output_spec lineage; suggest corrective actions (new OSN, clarification, evidence gap).\n" +
      "If a section has no items, write \"- (none)\" under that header.\n" +
      "Do not use markdown fences. Do not mutate or propose edits to canonical OSN YAML."
    );
  }

  /**
   * Build GT3 narrative for an unlocked player ask that may be Q (knowledge)
   * or A (act: propose Focus OSN output_spec change).
   * @param {{
   *   osn: object,
   *   evidenceLink: object,
   *   evidenceDef?: object,
   *   artifactBody?: string,
   *   ancestors?: object[],
   *   standardAncestors?: object[],
   *   priorMessages?: object[],
   *   question?: string,
   *   approvedLineageNarrative?: string
   * }} ctx
   * @returns {string}
   */
  function buildPlayerAskNarrative(ctx) {
    const osn = ctx && ctx.osn ? ctx.osn : {};
    const link = ctx && ctx.evidenceLink ? ctx.evidenceLink : {};
    const def = ctx && ctx.evidenceDef ? ctx.evidenceDef : {};
    const osnTitle = getOsnOriginLeafLabel(osn);
    const seed = trimBlock(osn.seed);
    const outputSpec = trimBlock(osn.output_spec);
    const lensesDraftText = trimBlock(osn.thematic_lenses_draft_text);
    const evidencesDraftText = trimBlock(osn.success_evidences_draft_text);
    const question = trimBlock(ctx && ctx.question);
    const artifactBody = trimBlock(ctx && ctx.artifactBody);
    const approvedLineage = trimBlock(ctx && ctx.approvedLineageNarrative);
    const mediaType = trimBlock(link.mediaType || "unknown");
    const compilation = osn.compilation && typeof osn.compilation === "object" ? osn.compilation : null;

    let artifactSection =
      "- Evidence ID: " + trimBlock(link.evidenceId || def.evidence_id || "unknown") + "\n" +
      "- Kind: " + trimBlock(link.kind || def.kind || "unknown") + "\n" +
      "- Direct: " + (def.direct === true ? "true" : "false") + "\n" +
      "- Artifact file: " + trimBlock(link.artifactFileName || "unknown") + "\n" +
      "- Media type: " + mediaType + "\n" +
      "- Inspection prompt: " + (trimBlock(link.inspectionPrompt || def.inspection_prompt) || "(none)");

    if (artifactBody) {
      artifactSection += "\n- Artifact body (text/code excerpt):\n" + indentLines(artifactBody, "    ");
    } else if (mediaType === "image" || mediaType === "video") {
      artifactSection +=
        "\n- Visual artifact note: pixel-level vision is unavailable in this MVP. " +
        "Reason from the inspection prompt, OSN output specifications, and graph lineage only.";
    }

    let compilationSection = "(none)";
    if (compilation) {
      compilationSection =
        "- can_be_compilation_root: " + String(!!compilation.can_be_compilation_root) + "\n" +
        "- compilation_scope: " + trimBlock(compilation.compilation_scope || "unspecified") + "\n" +
        "- target_tool_profile: " + trimBlock(compilation.target_tool_profile || "unspecified");
    }

    let focusQuotableSection =
      "FOCUS OSN:\n" +
      "- Title: " + osnTitle + "\n" +
      "- File: " + getOsnOriginLeafLabel(osn) + "\n" +
      "\nFOCUS OSN SEED (context only — do not quote under APPROVED_CAUSES):\n" +
      (seed || "(empty)") +
      "\n\nFOCUS OSN THEMATIC LENSES (context only — do not quote under APPROVED_CAUSES):\n" +
      formatThematicLensLines(osn.thematic_lenses) +
      (lensesDraftText
        ? "\n\nFOCUS OSN THEMATIC LENSES DRAFT TEXT (context only — do not quote under APPROVED_CAUSES):\n" +
          lensesDraftText
        : "") +
      "\n\nFOCUS OSN OUTPUT SPECIFICATION (sole quotation source for APPROVED_CAUSES; sole rewrite target for ASK_KIND A):\n" +
      (outputSpec || "(empty)") +
      "\n\nFOCUS OSN SUCCESS EVIDENCE DEFINITIONS (context only — do not quote under APPROVED_CAUSES):\n" +
      formatSuccessEvidenceDefLines(osn.success_evidences) +
      (evidencesDraftText
        ? "\n\nFOCUS OSN SUCCESS EVIDENCES DRAFT TEXT (context only — do not quote under APPROVED_CAUSES):\n" +
          evidencesDraftText
        : "");

    return (
      "You are Lexiom 1.3 answering a player ask during success-evidence review after an approved lineage narrative.\n\n" +
      "TASK:\n" +
      "- Decide whether the PLAYER ASK is a Question / request for knowledge (ASK_KIND Q) or a request for an Act on the player's behalf (ASK_KIND A).\n" +
      "- Q = the player wants explanation of why the System Under Development (SUD) looks, feels, reads, or behaves as shown.\n" +
      "- A = the player wants Lexiom to propose a changed Focus OSN output_spec that steers the SUD toward the direction of their ask.\n" +
      "- Choose exactly one of Q or A. Do not mix payloads.\n" +
      "- Classification examples:\n" +
      "  - \"why are the buttons blue?\" → ASK_KIND Q\n" +
      "  - \"what causes this highlight?\" → ASK_KIND Q\n" +
      "  - \"explain why the modal appears\" → ASK_KIND Q\n" +
      "  - \"change the buttons to green\" → ASK_KIND A\n" +
      "  - \"make the highlight neon green\" → ASK_KIND A\n" +
      "  - \"update the output_spec so buttons are green\" → ASK_KIND A\n" +
      "- Imperative redesign / alter / recolor / rewrite / set / make / change requests are ASK_KIND A even without a question mark.\n" +
      "- Knowledge / why / which-cause / explain requests are ASK_KIND Q.\n" +
      "- Do NOT treat your answer as canonical truth. This is a Black Move draft for human review.\n" +
      "- Reason ONLY inside the approved semantic territory below.\n\n" +
      "PLAYER ASK:\n" +
      (question || "(empty)") +
      "\n\nAPPROVED LINEAGE NARRATIVE (grounding for this ask):\n" +
      (approvedLineage || "(none)") +
      "\n\nPRIOR THREAD (same evidence scope):\n" +
      formatThreadHistoryLines(ctx && ctx.priorMessages) +
      "\n\n" +
      focusQuotableSection +
      "\n\nDISPLAYED SUCCESS EVIDENCE ARTIFACT:\n" +
      artifactSection +
      "\n\nPARENT / ANCESTOR OSNs (secondary context):\n" +
      formatAncestorLines(ctx && ctx.ancestors) +
      "\n\nORGANIZATIONAL STANDARD ANCESTORS (secondary context):\n" +
      formatAncestorLines(ctx && ctx.standardAncestors) +
      "\n\nCOMPILATION METADATA:\n" +
      compilationSection +
      "\n\nOUTPUT CONTRACT (use this exact structure):\n" +
      "Line 1 must be exactly one of:\n" +
      "ASK_KIND: Q\n" +
      "or\n" +
      "ASK_KIND: A\n" +
      "Line 2 must be exactly:\n" +
      "EXEC_SUMMARY: <one line containing exactly 13-17 words>\n" +
      "Then a blank line.\n" +
      "If ASK_KIND is Q:\n" +
      "- Write a short lineage narrative paragraph (2-6 sentences).\n" +
      "- Then include APPROVED_CAUSES / INFERRED_CAUSES / MISSING_CAUSES with the same rules as Causal Lineage Chat:\n" +
      "  APPROVED_CAUSES bullets must quote ONLY Focus OSN output_spec verbatim in double quotes.\n" +
      "  If a section has no items, write \"- (none)\" under that header.\n" +
      "If ASK_KIND is A:\n" +
      "- After the blank line following EXEC_SUMMARY, write exactly:\n" +
      "PROPOSED_OUTPUT_SPEC:\n" +
      "- Then provide the full replacement Focus OSN output_spec text only (no preamble, no markdown fences).\n" +
      "- Rewrite the current OUTPUT SPECIFICATION so it points the SUD toward the player's ask while preserving owner intent and ancestor constraints.\n" +
      "Do not use markdown fences. Do not mutate canonical OSN YAML yourself."
    );
  }

  /**
   * Build GT3 narrative for an unlocked imperative change ask (A-only).
   * Lexiom has already detected a clear action request; do not offer ASK_KIND Q.
   * @param {{
   *   osn: object,
   *   evidenceLink: object,
   *   evidenceDef?: object,
   *   artifactBody?: string,
   *   ancestors?: object[],
   *   standardAncestors?: object[],
   *   priorMessages?: object[],
   *   question?: string,
   *   approvedLineageNarrative?: string
   * }} ctx
   * @returns {string}
   */
  function buildOutputSpecChangeNarrative(ctx) {
    const osn = ctx && ctx.osn ? ctx.osn : {};
    const link = ctx && ctx.evidenceLink ? ctx.evidenceLink : {};
    const def = ctx && ctx.evidenceDef ? ctx.evidenceDef : {};
    const osnTitle = getOsnOriginLeafLabel(osn);
    const seed = trimBlock(osn.seed);
    const outputSpec = trimBlock(osn.output_spec);
    const lensesDraftText = trimBlock(osn.thematic_lenses_draft_text);
    const evidencesDraftText = trimBlock(osn.success_evidences_draft_text);
    const question = trimBlock(ctx && ctx.question);
    const artifactBody = trimBlock(ctx && ctx.artifactBody);
    const approvedLineage = trimBlock(ctx && ctx.approvedLineageNarrative);
    const mediaType = trimBlock(link.mediaType || "unknown");
    const compilation = osn.compilation && typeof osn.compilation === "object" ? osn.compilation : null;

    let artifactSection =
      "- Evidence ID: " + trimBlock(link.evidenceId || def.evidence_id || "unknown") + "\n" +
      "- Kind: " + trimBlock(link.kind || def.kind || "unknown") + "\n" +
      "- Direct: " + (def.direct === true ? "true" : "false") + "\n" +
      "- Artifact file: " + trimBlock(link.artifactFileName || "unknown") + "\n" +
      "- Media type: " + mediaType + "\n" +
      "- Inspection prompt: " + (trimBlock(link.inspectionPrompt || def.inspection_prompt) || "(none)");

    if (artifactBody) {
      artifactSection += "\n- Artifact body (text/code excerpt):\n" + indentLines(artifactBody, "    ");
    } else if (mediaType === "image" || mediaType === "video") {
      artifactSection +=
        "\n- Visual artifact note: pixel-level vision is unavailable in this MVP. " +
        "Reason from the inspection prompt, OSN output specifications, and graph lineage only.";
    }

    let compilationSection = "(none)";
    if (compilation) {
      compilationSection =
        "- can_be_compilation_root: " + String(!!compilation.can_be_compilation_root) + "\n" +
        "- compilation_scope: " + trimBlock(compilation.compilation_scope || "unspecified") + "\n" +
        "- target_tool_profile: " + trimBlock(compilation.target_tool_profile || "unspecified");
    }

    return (
      "You are Lexiom 1.3 proposing a Focus OSN output_spec change during success-evidence review.\n\n" +
      "TASK:\n" +
      "- Lexiom has already classified this PLAYER ASK as an Act (ASK_KIND A): propose a changed Focus OSN output_spec.\n" +
      "- Do NOT answer as a causal lineage explanation. Do NOT return APPROVED_CAUSES / INFERRED_CAUSES / MISSING_CAUSES.\n" +
      "- Rewrite the current FOCUS OSN OUTPUT SPECIFICATION so the System Under Development (SUD) steers toward the player's ask.\n" +
      "- Preserve owner intent and ancestor constraints; change only what the ask requires.\n" +
      "- Do NOT treat your answer as canonical truth. This is a Black Move draft for human review.\n\n" +
      "PLAYER ASK (action request):\n" +
      (question || "(empty)") +
      "\n\nAPPROVED LINEAGE NARRATIVE (grounding):\n" +
      (approvedLineage || "(none)") +
      "\n\nPRIOR THREAD (same evidence scope):\n" +
      formatThreadHistoryLines(ctx && ctx.priorMessages) +
      "\n\nFOCUS OSN:\n" +
      "- Title: " + osnTitle + "\n" +
      "- File: " + getOsnOriginLeafLabel(osn) + "\n" +
      (seed ? "\nFOCUS OSN SEED (context):\n" + seed + "\n" : "") +
      (lensesDraftText
        ? "\nFOCUS OSN THEMATIC LENSES DRAFT TEXT (context):\n" + lensesDraftText + "\n"
        : "") +
      "\nFOCUS OSN OUTPUT SPECIFICATION (rewrite target):\n" +
      (outputSpec || "(empty)") +
      (evidencesDraftText
        ? "\n\nFOCUS OSN SUCCESS EVIDENCES DRAFT TEXT (context):\n" + evidencesDraftText
        : "") +
      "\n\nDISPLAYED SUCCESS EVIDENCE ARTIFACT:\n" +
      artifactSection +
      "\n\nPARENT / ANCESTOR OSNs (secondary context):\n" +
      formatAncestorLines(ctx && ctx.ancestors) +
      "\n\nORGANIZATIONAL STANDARD ANCESTORS (secondary context):\n" +
      formatAncestorLines(ctx && ctx.standardAncestors) +
      "\n\nCOMPILATION METADATA:\n" +
      compilationSection +
      "\n\nOUTPUT CONTRACT (use this exact structure — ASK_KIND A only):\n" +
      "Line 1 must be exactly:\n" +
      "ASK_KIND: A\n" +
      "Line 2 must be exactly:\n" +
      "EXEC_SUMMARY: <one line containing exactly 13-17 words summarizing the proposed output_spec change>\n" +
      "Then a blank line.\n" +
      "Then write exactly:\n" +
      "PROPOSED_OUTPUT_SPEC:\n" +
      "Then provide the full replacement Focus OSN output_spec text only (no preamble, no markdown fences).\n" +
      "Do not use markdown fences. Do not mutate canonical OSN YAML yourself."
    );
  }

  window.lexiom13BuildCausalLineageNarrative = buildCausalLineageNarrative;
  window.lexiom13BuildPlayerAskNarrative = buildPlayerAskNarrative;
  window.lexiom13BuildOutputSpecChangeNarrative = buildOutputSpecChangeNarrative;
})();
