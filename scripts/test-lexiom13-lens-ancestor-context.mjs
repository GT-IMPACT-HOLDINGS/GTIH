import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const LOG_DIR = path.join(ROOT, "logs");
const OSN_DIR = path.join(ROOT, "public", "gt2", "Lexiom_1_3");
const OSN_FILES = [
  "GT_Philosophy.osn.yaml",
  "ProductWelcome.osn.yaml",
  "UX.osn.yaml",
  "CodeShape.osn.yaml",
];

function readBlockScalar(raw, key) {
  const re = new RegExp(
    "^" + key + ":\\s*>?\\s*\\n([\\s\\S]*?)(?=\\n[a-zA-Z_][a-zA-Z0-9_.]*:|\\n#|$)",
    "m"
  );
  const match = raw.match(re);
  return match ? trimBlock(match[1].replace(/\n\s+/g, " ")) : "";
}

function readPipeScalar(raw, key) {
  const re = new RegExp("^" + key + ":\\s*\\|\\s*\\n([\\s\\S]*?)(?=\\n[a-zA-Z_][a-zA-Z0-9_.]*:|\\n#|$)", "m");
  const match = raw.match(re);
  if (!match) {
    return "";
  }
  return match[1]
    .split("\n")
    .map((line) => line.replace(/^\s{2}/, ""))
    .join("\n")
    .trim();
}

function readParentIds(raw) {
  const block = raw.match(/parent_osn_ids:\s*\n((?:[ \t]+-\s+".+"\s*\n?)+)/);
  if (!block) {
    return [];
  }
  return [...block[1].matchAll(/-\s+"(.+?)"/g)].map((m) => m[1]);
}

function readLenses(raw) {
  const block = raw.match(/thematic_lenses:\s*\n([\s\S]*?)(?=\noutput_spec:|\nsuccess_evidences:|\ncompilation:|\n#|$)/);
  if (!block) {
    return [];
  }
  const items = block[1].split(/\n\s*-\s+lens_id:/).slice(1);
  return items.map((item) => {
    const lensId = item.match(/^\s*"(.+?)"/)?.[1] || "";
    const name = item.match(/\n\s*name:\s*"(.+?)"/)?.[1] || "";
    const purpose = item.match(/\n\s*purpose:\s*"(.+?)"/)?.[1] || "";
    return { lens_id: lensId, name, purpose };
  });
}

function parseOsnYaml(raw) {
  const text = String(raw).replace(/\r\n/g, "\n");
  return {
    id: text.match(/^id:\s*"(.+)"$/m)?.[1] || "",
    file_name: text.match(/^file_name:\s*"(.+)"$/m)?.[1] || "",
    title: text.match(/^title:\s*"(.+)"$/m)?.[1] || "",
    seed: readBlockScalar(text, "seed"),
    output_spec: readPipeScalar(text, "output_spec"),
    graph: { parent_osn_ids: readParentIds(text) },
    thematic_lenses: readLenses(text),
  };
}

async function loadOsns() {
  const loaded = [];
  for (const file of OSN_FILES) {
    const raw = await fs.readFile(path.join(OSN_DIR, file), "utf8");
    loaded.push(parseOsnYaml(raw));
  }
  return new Map(loaded.map((osn) => [osn.id, osn]));
}

function trimBlock(value) {
  return String(value || "").trim();
}

function indentLines(text, prefix) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => prefix + line)
    .join("\n");
}

function formatAncestorLines(ancestors) {
  if (!Array.isArray(ancestors) || !ancestors.length) {
    return "(none)";
  }
  return ancestors
    .map((osn) => {
      const title = trimBlock(osn.file_name || osn.title || osn.id);
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

function collectAncestorOsns(osn, osnsById, seen, results) {
  if (!osn) {
    return;
  }
  const parentIds = Array.isArray(osn.graph?.parent_osn_ids)
    ? osn.graph.parent_osn_ids
    : [];
  for (const parentId of parentIds) {
    const parent = osnsById.get(parentId);
    if (parent && !seen.has(parent.id)) {
      seen.add(parent.id);
      results.push(parent);
      collectAncestorOsns(parent, osnsById, seen, results);
    }
  }
}

function getAncestorContextForLens(osn, osnsById) {
  const results = [];
  const seen = new Set();
  if (osn) {
    seen.add(osn.id);
  }
  collectAncestorOsns(osn, osnsById, seen, results);
  return results.map((ancestor) => ({
    ...ancestor,
    output_spec: trimBlock(ancestor.output_spec),
  }));
}

function buildOsnLensReframeNarrative(ctx) {
  const osn = ctx?.osn || {};
  const lens = ctx?.lens || {};
  const sectionKey = trimBlock(ctx?.sectionKey);
  const sectionLabel = trimBlock(ctx?.sectionLabel) || sectionKey || "section";
  const sectionText = trimBlock(ctx?.sectionText);
  const lensName = trimBlock(lens.name || lens.lens_id || "Lens");
  const lensPurpose = trimBlock(lens.purpose);
  const osnTitle = trimBlock(osn.file_name || osn.title || osn.id || "OSN");
  const osnSeed = trimBlock(osn.seed);

  return (
    "You are Lexiom 1.3, an OSN-aware engine for structured reasoning-making. " +
    "Help the owner inspect, refine, and approve semantic source material through explicit draft-first guidance.\n\n" +
    "You are Lexiom 1.3, reframing one OSN section through an approved thematic discipline lens for structured reasoning-making.\n\n" +
    "TASK:\n" +
    "- Rewrite the CURRENT SECTION DRAFT so it is clearer, sharper, and more useful when viewed through the selected lens.\n" +
    "- Preserve the owner's intent; do not invent unrelated product scope.\n" +
    "- Return only the reframed section text. No preamble, no markdown fences, no bullet labels unless they help readability inside the section itself.\n" +
    "- Keep the result concise and directly editable in a draft-first card.\n\n" +
    "OSN:\n" +
    "- Title: " +
    osnTitle +
    "\n" +
    (osnSeed ? "- Seed: " + osnSeed + "\n" : "") +
    "\nANCESTOR CONTEXT:\n" +
    formatAncestorLines(ctx?.ancestors) +
    "\n\nSELECTED LENS:\n" +
    "- Name: " +
    lensName +
    "\n" +
    (lens.lens_id ? "- Lens ID: " + trimBlock(lens.lens_id) + "\n" : "") +
    (lensPurpose ? "- Purpose: " + lensPurpose + "\n" : "") +
    "\nCURRENT SECTION:\n" +
    "- Key: " +
    sectionKey +
    "\n" +
    "- Label: " +
    sectionLabel +
    "\n" +
    "- Draft text:\n" +
    (sectionText || "(empty)") +
    "\n\nREFRAME GUIDANCE:\n" +
    "- Explain tradeoffs, missing concerns, and sharper wording only insofar as they belong to this lens.\n" +
    "- Do not change unrelated OSN sections.\n" +
    "- Treat this as a draft proposal awaiting explicit human approval.\n\n" +
    "IMPORTANT: After your main response, add exactly one line containing the in_band_description_of_Lexioms_act. " +
    "The phrase MUST begin with an underscore (_).\n" +
    "Format: _L24_Draft_ followed by four words (underscore-separated) that capture what you draft in this inference, within the current OSN reasoning workspace. " +
    "RULES: Use ONLY underscores to separate words. No slashes, hyphens, spaces, or other characters. " +
    "Each word uses Latin/ASCII letters and digits only. Put it on its own line at the very end. No other text after it."
  );
}

async function listLogFiles() {
  const names = await fs.readdir(LOG_DIR);
  const files = [];
  for (const name of names) {
    const full = path.join(LOG_DIR, name);
    const stat = await fs.stat(full);
    if (stat.isFile() && name.endsWith(".txt")) {
      files.push({ name, full, mtime: stat.mtimeMs });
    }
  }
  return files.sort((a, b) => b.mtime - a.mtime);
}

async function main() {
  const osnsById = await loadOsns();
  const uxOsn = osnsById.get("UX.osn");
  if (!uxOsn) {
    console.log("Loaded OSN ids:", [...osnsById.keys()]);
    throw new Error("UX OSN not found in parsed graph");
  }
  console.log("UX parent ids:", uxOsn.graph?.parent_osn_ids);
  console.log(
    "ProductLexiom present:",
    osnsById.has("ProductLexiom.osn"),
    osnsById.get("ProductLexiom.osn")?.file_name
  );
  const lens = (uxOsn.thematic_lenses || []).find(
    (item) => item.lens_id === "lens.ux.first_time_clarity"
  );
  const ancestors = getAncestorContextForLens(uxOsn, osnsById);

  const narrative = buildOsnLensReframeNarrative({
    osn: uxOsn,
    sectionKey: "seed",
    sectionLabel: "Seed",
    sectionText: trimBlock(uxOsn.seed),
    lens,
    ancestors,
  });

  const before = await listLogFiles();
  const beforeTop = before[0]?.name || null;

  const response = await fetch("http://localhost:8080/inference", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-GT3-Tenant": "gt2-lexiom-demo",
      "X-GT3-Data-Track": "green",
      "X-GT3-Consent-Version": "v1",
      "X-Lexiom-Persona-Mode": "lexiom_13_reasoning",
    },
    body: JSON.stringify({ narrative }),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error("Inference failed: " + JSON.stringify(body));
  }

  await new Promise((resolve) => setTimeout(resolve, 500));
  const after = await listLogFiles();
  const newest =
    after.find((file) => file.name !== beforeTop) || after[0] || null;
  if (!newest) {
    throw new Error("No inference log file found under logs/");
  }

  const logText = await fs.readFile(newest.full, "utf8");
  const ancestorStart = logText.indexOf("ANCESTOR CONTEXT:");
  const selectedLensStart = logText.indexOf("SELECTED LENS:", ancestorStart);
  const ancestorExcerpt =
    ancestorStart >= 0 && selectedLensStart > ancestorStart
      ? logText.slice(ancestorStart, selectedLensStart).trim()
      : "(ANCESTOR CONTEXT section not found)";

  const responseTail = String(body.response || "").trim().split(/\r?\n/).slice(-3).join("\n");

  console.log("=== TEST: Lexiom 1.3 UX lens ancestor output_spec in GT3 log ===");
  console.log("Log file:", newest.name);
  console.log("Ancestor count in narrative build:", ancestors.length);
  console.log("Ancestor titles:", ancestors.map((a) => a.file_name).join(", "));
  console.log("");
  console.log("--- ANCESTOR CONTEXT excerpt from GT3 inference log ---");
  console.log(ancestorExcerpt);
  console.log("");
  console.log("--- LM response tail ---");
  console.log(responseTail);
  console.log("");
  console.log(
    "PASS:",
    ancestorExcerpt.includes("ProductWelcome.osn") &&
      ancestorExcerpt.includes("Output Spec:") &&
      ancestorExcerpt.includes("playable welcome experience")
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
