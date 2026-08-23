import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LEXIOM_DIR = path.join(__dirname, "..", "public", "gt2", "Lexiom_1_3");
const EVIDENCES_DIR = path.join(LEXIOM_DIR, "evidences");
const APP_JS_PATH = path.join(LEXIOM_DIR, "app.js");
const BASE_URL = "http://localhost:8080/gt2/Lexiom_1_3/index.html";

const EVIDENCE_VERSION_INITIAL = "v1";
const EVIDENCE_VERSION_CURRENT = "v2";

const ARTIFACTS = [
  {
    osnFileName: "GT_Philosophy.osn",
    evidenceId: "sev.constellation.software_mapping_brief",
    kind: "markdown_brief",
    extension: "md",
  },
  {
    osnFileName: "ProductLexiom.osn",
    evidenceId: "sev.product.osn_navigation_video",
    kind: "video_clip",
    extension: "webm",
  },
  {
    osnFileName: "UX.osn",
    evidenceId: "sev.ux.screenshot",
    kind: "screenshot",
    extension: "png",
  },
  {
    osnFileName: "CodeShape.osn",
    evidenceId: "sev.code.direct_snippet_review",
    kind: "direct_code_snippet",
    extension: "js",
  },
];

fs.mkdirSync(EVIDENCES_DIR, { recursive: true });

function buildArtifactFileName(osnFileName, evidenceId, extension, version) {
  return `${osnFileName}.${evidenceId}.${version}.${extension}`;
}

function buildLegacyArtifactFileName(osnFileName, evidenceId, extension) {
  return `${osnFileName}.${evidenceId}.${extension}`;
}

function versionExistingArtifactsToV1() {
  for (const artifact of ARTIFACTS) {
    const legacyPath = path.join(
      EVIDENCES_DIR,
      buildLegacyArtifactFileName(artifact.osnFileName, artifact.evidenceId, artifact.extension)
    );
    const v1Path = path.join(
      EVIDENCES_DIR,
      buildArtifactFileName(
        artifact.osnFileName,
        artifact.evidenceId,
        artifact.extension,
        EVIDENCE_VERSION_INITIAL
      )
    );

    if (fs.existsSync(legacyPath) && !fs.existsSync(v1Path)) {
      fs.renameSync(legacyPath, v1Path);
      console.log("Versioned", path.basename(legacyPath), "->", path.basename(v1Path));
    }
  }
}

async function waitForGraph(page) {
  await page.waitForSelector(".lexiom-osn-node-main", { timeout: 15000 });
  await page.waitForFunction(() => {
    const nodes = document.querySelectorAll(".lexiom-osn-node-main");
    return nodes.length >= 4 && !document.querySelector(".lexiom-loading-indicator");
  });
}

async function selectOsnSection(page, osnLabel, sectionLabel) {
  const node = page.locator(".lexiom-osn-node-main", { hasText: osnLabel });
  const branch = node.locator(
    "xpath=ancestor::div[contains(@class,'lexiom-osn-graph-root-wrap') or contains(@class,'lexiom-osn-graph-branch')][1]"
  );
  const section = branch.locator(".lexiom-osn-section-trigger", { hasText: sectionLabel });
  if (!(await section.isVisible())) {
    await node.click();
    await section.waitFor({ state: "visible", timeout: 10000 });
  }
  await section.click();
}

async function expandOsn(page, label) {
  const node = page.locator(".lexiom-osn-node-main", { hasText: label });
  const branch = node.locator(
    "xpath=ancestor::div[contains(@class,'lexiom-osn-graph-root-wrap') or contains(@class,'lexiom-osn-graph-branch')][1]"
  );
  const section = branch.locator(".lexiom-osn-section-trigger").first();
  if (!(await section.isVisible())) {
    await node.click();
    await section.waitFor({ state: "visible", timeout: 10000 });
  }
}

async function pause(page, ms = 900) {
  await page.waitForTimeout(ms);
}

async function dismissWelcomeModalIfPresent(page) {
  const dismiss = page.locator("#lexiom-welcome-modal-dismiss");
  if (await dismiss.isVisible().catch(() => false)) {
    await dismiss.click();
    await page.waitForSelector("#lexiom-welcome-modal[hidden]", { timeout: 5000 }).catch(() => {});
  }
}

async function captureUxScreenshot(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await waitForGraph(page);
  await dismissWelcomeModalIfPresent(page);
  await selectOsnSection(page, "UX.osn", "Seed");
  await pause(page, 400);

  const outPath = path.join(
    EVIDENCES_DIR,
    buildArtifactFileName("UX.osn", "sev.ux.screenshot", "png", EVIDENCE_VERSION_CURRENT)
  );
  await page.screenshot({ path: outPath, fullPage: false });
  await context.close();
  return outPath;
}

async function captureConstellationWelcomeModal(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // ?welcome=1 forces the first-time welcome modal regardless of stored state.
  await page.goto(BASE_URL + "?welcome=1", { waitUntil: "networkidle" });
  await waitForGraph(page);
  await page.waitForSelector("#lexiom-welcome-modal:not([hidden])", { timeout: 10000 });
  await pause(page, 400);

  const outPath = path.join(
    EVIDENCES_DIR,
    buildArtifactFileName(
      "GT_Philosophy.osn",
      "sev.constellation.welcome_modal_screenshot",
      "png",
      EVIDENCE_VERSION_CURRENT
    )
  );
  await page.screenshot({ path: outPath, fullPage: false });
  await context.close();
  return outPath;
}

async function captureProductNavigationVideo(browser) {
  const videoDir = path.join(EVIDENCES_DIR, "_video_tmp");
  fs.mkdirSync(videoDir, { recursive: true });

  const context = await browser.newContext({
    recordVideo: { dir: videoDir, size: { width: 1440, height: 900 } },
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await waitForGraph(page);
  await dismissWelcomeModalIfPresent(page);

  await selectOsnSection(page, "ProductLexiom.osn", "Output Spec");
  await pause(page);
  await selectOsnSection(page, "UX.osn", "Seed");
  await pause(page);
  await selectOsnSection(page, "CodeShape.osn", "Output Spec");
  await pause(page);
  await expandOsn(page, "ProductLexiom.osn");
  await pause(page);
  await page.locator('[data-build-osn-id="ProductLexiom.osn"]').click();
  await pause(page, 1200);

  const video = page.video();
  await context.close();

  const outPath = path.join(
    EVIDENCES_DIR,
    buildArtifactFileName(
      "ProductLexiom.osn",
      "sev.product.osn_navigation_video",
      "webm",
      EVIDENCE_VERSION_CURRENT
    )
  );

  const recordedPath = video ? await video.path() : null;
  if (recordedPath && fs.existsSync(recordedPath)) {
    fs.copyFileSync(recordedPath, outPath);
    fs.rmSync(videoDir, { recursive: true, force: true });
    return outPath;
  }

  const webmFiles = fs
    .readdirSync(videoDir)
    .filter((name) => name.endsWith(".webm"))
    .map((name) => path.join(videoDir, name));

  if (!webmFiles.length) {
    throw new Error("No video file was produced");
  }

  fs.copyFileSync(webmFiles[0], outPath);
  fs.rmSync(videoDir, { recursive: true, force: true });
  return outPath;
}

function writeConstellationBriefV2() {
  const outPath = path.join(
    EVIDENCES_DIR,
    buildArtifactFileName(
      "GT_Philosophy.osn",
      "sev.constellation.software_mapping_brief",
      "md",
      EVIDENCE_VERSION_CURRENT
    )
  );

  const lines = [
    "# GT Constellation Mapping — Lexiom 1.3 Welcome SPA",
    "",
    `Collection version: **${EVIDENCE_VERSION_CURRENT}** (prior capture retained as **${EVIDENCE_VERSION_INITIAL}**).`,
    "",
    "This brief maps the Lexiom 1.3 welcome single-page application to the GT constellation roles and states how the initiative preserves draft-first approval, traceability, and direct inspection evidence.",
    "",
    "## Initiative summary",
    "",
    "Lexiom 1.3.3 demonstrates a calm, evidence-backed welcome cockpit where four canonical OSN YAML files express human intention, branch into UX and Code Shaping disciplines, expose versioned demo success evidences in the right tray, and open those artifacts in the center playfield on click.",
    "",
    "## GT3 — reusable core",
    "",
    "- Inference infrastructure via `POST /inference` and `gt3-client.js`",
    "- White / Black / Stability move loop, draft-first cards, append-only action logging",
    "- `osn-evidence-links.ts` for `{file_name}.{evidence_id}.{version}.{extension}` artifact linking",
    "",
    "## GT2 — productization",
    "",
    "- Welcome SPA at `/gt2/Lexiom_1_3/` with five cockpit regions",
    "- Clickable demo evidence tray wired to center playfield inspection",
    "- Four-node canonical OSN graph with runtime Build children",
    "",
    "## GT1 — public-benefit expression",
    "",
    "- Runnable teaching artifact for governed, evidence-backed specification practice",
    "- Versioned, directly inspectable success evidences without mediated dashboards",
    "",
    "## Draft-first approval",
    "",
    "- Lens reframes and build previews remain draft until explicitly approved",
    "- Canonical OSN YAML on disk is never mutated by runtime UI actions",
    "",
    "## Traceability",
    "",
    "- Evidence filenames encode OSN origin, evidence id, and collection version",
    "- Runtime resolves the newest available version (`v2`, then `v1`) per evidence link",
    "",
    "## Direct inspection evidence (versioned)",
    "",
    "| OSN source | Evidence ID | Artifact (${EVIDENCE_VERSION_CURRENT}) |",
    "| --- | --- | --- |",
    "| `GT_Philosophy.osn` | `sev.constellation.software_mapping_brief` | `GT_Philosophy.osn.sev.constellation.software_mapping_brief.${EVIDENCE_VERSION_CURRENT}.md` |",
    "| `ProductLexiom.osn` | `sev.product.osn_navigation_video` | `ProductLexiom.osn.sev.product.osn_navigation_video.${EVIDENCE_VERSION_CURRENT}.webm` |",
    "| `UX.osn` | `sev.ux.screenshot` | `UX.osn.sev.ux.screenshot.${EVIDENCE_VERSION_CURRENT}.png` |",
    "| `CodeShape.osn` | `sev.code.direct_snippet_review` | `CodeShape.osn.sev.code.direct_snippet_review.${EVIDENCE_VERSION_CURRENT}.js` |",
    "",
    "Prior collection **v1** files remain alongside **v2** under `public/gt2/Lexiom_1_3/evidences/`.",
    "",
  ];

  fs.writeFileSync(outPath, lines.join("\n"), "utf8");
  return outPath;
}

function writeCodeShapeSnippetV2() {
  const outPath = path.join(
    EVIDENCES_DIR,
    buildArtifactFileName(
      "CodeShape.osn",
      "sev.code.direct_snippet_review",
      "js",
      EVIDENCE_VERSION_CURRENT
    )
  );

  const snippet = `// CodeShape.osn — success evidence sev.code.direct_snippet_review (${EVIDENCE_VERSION_CURRENT})
// Source: public/gt2/Lexiom_1_3/app.js + osn-evidence-links.ts

const OSN_FILE_PATHS = [
  "/gt2/Lexiom_1_3/GT_Philosophy.osn.yaml",
  "/gt2/Lexiom_1_3/ProductLexiom.osn.yaml",
  "/gt2/Lexiom_1_3/UX.osn.yaml",
  "/gt2/Lexiom_1_3/CodeShape.osn.yaml",
];

async function loadOsnGraph() {
  const loaded = await Promise.all(
    OSN_FILE_PATHS.map(async function (path) {
      const raw = await fetchYaml(path);
      return window.jsyaml.load(raw);
    })
  );
  state.osnsById = new Map(loaded.map(function (osn) { return [osn.id, osn]; }));
  state.expandedOsnIds = new Set();
}

// Versioned evidence linking: {file_name}.{evidence_id}.{version}.{extension}
function buildEvidenceArtifactFileName(osnFileName, evidenceId, extension, version) {
  return osnFileName + "." + evidenceId + "." + version + "." + extension;
}

async function loadEvidenceAvailability() {
  const versions = window.lexiom13EvidenceLinks.SUPPORTED_EVIDENCE_VERSIONS; // ["v2", "v1"]
  for (const osn of state.orderedOsns) {
    for (const version of versions) {
      const links = window.lexiom13EvidenceLinks.linkSuccessEvidencesForOsn(osn, { evidenceVersion: version });
      for (const link of links) {
        const response = await fetch(link.artifactUrl, { method: "HEAD" });
        if (response.ok) {
          state.evidenceResolvedByKey.set(
            window.lexiom13EvidenceLinks.getEvidenceLinkKey(link.origin.osnId, link.evidenceId),
            link
          );
          break;
        }
      }
    }
  }
}

function openEvidenceArtifact(osnId, evidenceId) {
  const link = state.evidenceResolvedByKey.get(
    window.lexiom13EvidenceLinks.getEvidenceLinkKey(osnId, evidenceId)
  );
  state.selectedEvidenceId = evidenceId;
  renderEvidenceViewer(link); // image | video | text in center playfield
  appendAction("open_evidence_artifact", { osnId, evidenceId, version: link.version });
}

function getAncestorContextForLens(osn) {
  return getAncestorOsns(osn).map(function (ancestor) {
    return Object.assign({}, ancestor, {
      output_spec: String(ensureDraftCardState(ancestor, "output_spec").text || ancestor.output_spec || "").trim(),
    });
  });
}

function openCompilePreview(osnId) {
  state.buildPreviewsByOsnId.set(osnId, buildCompilationPreviewText(getOsnById(osnId)));
  state.selectedSectionKey = "build";
  appendAction("open_compile_preview", { osnId, sectionKey: "build" });
  renderApp();
}
`;

  fs.writeFileSync(outPath, snippet, "utf8");
  return outPath;
}

async function main() {
  versionExistingArtifactsToV1();

  const browser = await chromium.launch({ headless: true });
  const videoPath = await captureProductNavigationVideo(browser);
  console.log("Wrote", videoPath);
  const screenshotPath = await captureUxScreenshot(browser);
  console.log("Wrote", screenshotPath);
  const welcomeModalPath = await captureConstellationWelcomeModal(browser);
  console.log("Wrote", welcomeModalPath);
  await browser.close();

  const briefPath = writeConstellationBriefV2();
  console.log("Wrote", briefPath);
  const snippetPath = writeCodeShapeSnippetV2();
  console.log("Wrote", snippetPath);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
