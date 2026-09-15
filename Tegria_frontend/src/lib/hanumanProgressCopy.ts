/**
 * User-facing progress copy for Hanuman OSNG propose labor.
 * Maps host status + CA log lines into expressive beats (not raw wire jargon).
 */

export function expressProposeStatus(
  status: string
): string | null {
  switch (status) {
    case "awaiting_browser":
      return "Hanuman prepares to leap into the garden sandbox…";
    case "running":
      return "Hanuman labors on the draft — seed, three thematic lenses, output_spec, and success evidences…";
    case "ok":
    case "completed":
      return null;
    case "failed":
      return null;
    default:
      return null;
  }
}

/** Translate a raw CA / host log line into one expressive sentence, or null to skip. */
export function expressHanumanLog(rawLine: string): string | null {
  const line = String(rawLine || "").trim();
  if (!line) return null;

  if (/syncIn workspace \(osng propose\)/i.test(line)) {
    return "Receiving the propose workspace into Hanuman’s hands…";
  }
  const syncInFiles = line.match(/syncIn\s+(\d+)\s+files/i);
  if (syncInFiles) {
    return `The Job’s frozen country is ready (${syncInFiles[1]} files)…`;
  }
  if (/WebContainer sandbox ready/i.test(line)) {
    return "The sandbox opens — Hanuman begins the leap…";
  }
  if (/osng propose tool loop/i.test(line)) {
    return "Consulting GT3 to draft a proposal OSNG from your intent…";
  }

  const step = line.match(/tool step\s+(\d+)\s*\/\s*(\d+)/i);
  if (step) {
    const n = Number(step[1]);
    if (n === 1) {
      return "Hanuman reads your intent and takes the first loving tool step…";
    }
    if (n === 2) {
      return "Expanding the seed into three thematic lenses…";
    }
    if (n === 3) {
      return "Composing the output_spec through those lenses…";
    }
    if (n === 4) {
      return "Shaping success evidences that can inspect the future SUD…";
    }
    if (n % 3 === 0) {
      return `Another consult under the sun — refining the draft (step ${n})…`;
    }
    return `Hanuman wields another tool turn under GT3 (step ${n})…`;
  }

  const wrote = line.match(/wrote\s+(\S+)/i);
  if (wrote) {
    const path = wrote[1].replace(/[()]/g, "").trim();
    if (/OSNG_PROPOSAL\.json/i.test(path)) {
      return "Writing OSNG_PROPOSAL.json — the draft garden takes form…";
    }
    if (/INTENT\.md/i.test(path) || /AGENT_PROMPT/i.test(path) || /PROPOSE_BRIEF/i.test(path)) {
      return null;
    }
    return `Offering an artifact: ${path}…`;
  }

  if (/syncOut propose/i.test(line)) {
    return "Carrying the proposal artifacts back to Tegria…";
  }
  if (/reporting propose primary/i.test(line)) {
    return "Offering the draft OSNG for host validation…";
  }
  if (/propose report completed/i.test(line)) {
    return "The propose Job is sealed — Hanuman’s labor is complete…";
  }
  if (/WebContainer torn down/i.test(line)) {
    return "Hanuman rests; the sandbox closes…";
  }
  if (/gt3 consult error/i.test(line)) {
    return line.replace(/^\[ca\]\s*/i, "Consult faltered: ");
  }
  if (/report failed/i.test(line)) {
    return line.replace(/^\[ca\]\s*/i, "Could not report the draft: ");
  }

  // Soften residual [ca] noise; skip pure builder / skip-file chatter.
  if (/^\[ca\]\s*skip file/i.test(line)) return null;
  if (/^\[ca\]\s*syncIn workspace \(builder\)/i.test(line)) return null;
  if (/^\[ca\]/.test(line)) {
    return line.replace(/^\[ca\]\s*/i, "").trim() || null;
  }

  return line;
}

export function appendProgressLine(
  prev: string | null | undefined,
  nextLine: string,
  maxLines = 8
): string {
  const line = String(nextLine || "").trim();
  if (!line) return prev || "";
  const lines = String(prev || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  if (lines[lines.length - 1] === line) return lines.join("\n");
  return [...lines, line].slice(-maxLines).join("\n");
}

export function expressDraftReady(rootOsnId: string): string {
  return [
    "Hanuman offers a draft OSNG for your garden.",
    `Root: ${rootOsnId}`,
    "Review the proposal — it is not yet seated on the White throne.",
  ].join("\n");
}
