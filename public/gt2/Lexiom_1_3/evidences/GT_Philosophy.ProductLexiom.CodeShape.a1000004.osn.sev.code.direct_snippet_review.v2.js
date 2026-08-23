// CodeShape.osn — success evidence sev.code.direct_snippet_review (v2)
// Source: public/gt2/Lexiom_1_3/app.js + osn-evidence-links.ts

const OSN_FILE_PATHS = [
  "/gt2/Lexiom_1_3/GT_Philosophy.a1000001.osn.yaml",
  "/gt2/Lexiom_1_3/GT_Philosophy.ProductLexiom.a1000002.osn.yaml",
  "/gt2/Lexiom_1_3/GT_Philosophy.ProductLexiom.UX.a1000003.osn.yaml",
  "/gt2/Lexiom_1_3/GT_Philosophy.ProductLexiom.CodeShape.a1000004.osn.yaml",
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
