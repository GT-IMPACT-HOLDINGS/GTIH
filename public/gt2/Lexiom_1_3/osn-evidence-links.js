"use strict";
/**
 * Lexiom 1.3 — link success-evidence definitions in OSN YAML to demo artifact files.
 *
 * Naming convention (mirrors OSN disk layout + collection version):
 *   OSN source:  {Name}.osn.yaml  with  file_name: "{Name}.osn"
 *   Evidence:    {file_name}.{evidence_id}.{version}.{extension}
 *   Example:     UX.osn.sev.ux.screenshot.v2.png
 *
 * Direct kinds are the closed enumerators from Lexiom_1.3.3_System_Description.md §4.4:
 *   "TEXTUAL_SNIPPET" | "SCREEN-SHOT" | "VIDEO-CLIP"
 */
const DEFAULT_EVIDENCE_DIR = "/gt2/Lexiom_1_3/evidences";
const DEFAULT_EVIDENCE_VERSION = "v2";
const SUPPORTED_EVIDENCE_VERSIONS = ["v2", "v1"];
/** Canonical direct-evidence enumerators (exact strings). */
const SUPPORTED_DIRECT_EVIDENCE_KINDS = [
    "TEXTUAL_SNIPPET",
    "SCREEN-SHOT",
    "VIDEO-CLIP",
];
/** Legacy YAML/runtime labels → canonical enumerators. */
const LEGACY_DIRECT_KIND_ALIASES = {
    direct_code_snippet: "TEXTUAL_SNIPPET",
    direct_document_review: "TEXTUAL_SNIPPET",
    screenshot: "SCREEN-SHOT",
    video_clip: "VIDEO-CLIP",
    "textual_snippet": "TEXTUAL_SNIPPET",
    "screen-shot": "SCREEN-SHOT",
    "video-clip": "VIDEO-CLIP",
};
const KIND_EXTENSION_MAP = {
    TEXTUAL_SNIPPET: "md",
    "SCREEN-SHOT": "png",
    "VIDEO-CLIP": "webm",
    markdown_brief: "md",
    // Legacy aliases (transitional discovery / filename inference)
    screenshot: "png",
    video_clip: "webm",
    direct_code_snippet: "js",
    direct_document_review: "md",
};
const KIND_EXTENSION_CANDIDATES = {
    TEXTUAL_SNIPPET: ["md", "js", "txt"],
    "SCREEN-SHOT": ["png", "jpg", "jpeg"],
    "VIDEO-CLIP": ["webm", "mp4"],
    markdown_brief: ["md"],
};
const EXTENSION_MEDIA_MAP = {
    md: "markdown",
    png: "image",
    jpg: "image",
    jpeg: "image",
    webm: "video",
    mp4: "video",
    js: "code",
    ts: "code",
    txt: "text",
};
function canonicalizeEvidenceKind(kind) {
    const raw = String(kind || "").trim();
    if (!raw) {
        return "";
    }
    if (SUPPORTED_DIRECT_EVIDENCE_KINDS.includes(raw)) {
        return raw;
    }
    const lower = raw.toLowerCase();
    if (LEGACY_DIRECT_KIND_ALIASES[lower]) {
        return LEGACY_DIRECT_KIND_ALIASES[lower];
    }
    if (LEGACY_DIRECT_KIND_ALIASES[raw]) {
        return LEGACY_DIRECT_KIND_ALIASES[raw];
    }
    return raw;
}
function isSupportedDirectEvidenceKind(kind) {
    const canonical = canonicalizeEvidenceKind(kind);
    return SUPPORTED_DIRECT_EVIDENCE_KINDS.includes(canonical);
}
function hasCompliantDirectSuccessEvidence(evidences) {
    if (!Array.isArray(evidences)) {
        return false;
    }
    return evidences.some(function (entry) {
        return entry && entry.direct === true && isSupportedDirectEvidenceKind(entry.kind);
    });
}
function getOsnFileName(osn) {
    const fromField = String(osn.file_name || "").trim();
    if (fromField) {
        return fromField;
    }
    const title = String(osn.title || osn.id || "OSN").trim();
    return title.endsWith(".osn") ? title : title + ".osn";
}
function inferExtensionFromKind(kind) {
    const canonical = canonicalizeEvidenceKind(kind);
    if (KIND_EXTENSION_MAP[canonical]) {
        return KIND_EXTENSION_MAP[canonical];
    }
    const raw = String(kind || "").trim();
    if (KIND_EXTENSION_MAP[raw]) {
        return KIND_EXTENSION_MAP[raw];
    }
    const lower = raw.toLowerCase();
    return KIND_EXTENSION_MAP[lower] || "txt";
}
function extensionsForKind(kind) {
    const canonical = canonicalizeEvidenceKind(kind);
    if (KIND_EXTENSION_CANDIDATES[canonical]) {
        return KIND_EXTENSION_CANDIDATES[canonical].slice();
    }
    return [inferExtensionFromKind(kind)];
}
function inferMediaType(extension, kind) {
    const fromExt = EXTENSION_MEDIA_MAP[String(extension || "").toLowerCase()];
    if (fromExt) {
        return fromExt;
    }
    const canonical = canonicalizeEvidenceKind(kind);
    if (canonical === "SCREEN-SHOT")
        return "image";
    if (canonical === "VIDEO-CLIP")
        return "video";
    if (canonical === "TEXTUAL_SNIPPET")
        return "markdown";
    const lower = String(kind || "").trim().toLowerCase();
    if (lower === "markdown_brief")
        return "markdown";
    return "text";
}
function buildEvidenceArtifactFileName(osnFileName, evidenceId, extension, version) {
    return osnFileName + "." + evidenceId + "." + version + "." + extension;
}
function buildEvidenceArtifactUrl(evidenceDir, osnFileName, evidenceId, extension, version) {
    const base = evidenceDir.replace(/\/+$/, "");
    return base + "/" + buildEvidenceArtifactFileName(osnFileName, evidenceId, extension, version);
}
/** Parse `{file_name}.{evidence_id}.{version}.{extension}` back into origin parts. */
function parseEvidenceArtifactFileName(artifactFileName) {
    const trimmed = String(artifactFileName || "").trim();
    if (!trimmed) {
        return null;
    }
    const versionMatch = trimmed.match(/^(.+\.osn)\.(sev\..+)\.(v\d+(?:\.\d+)*)\.([^.]+)$/);
    if (versionMatch) {
        return {
            osnFileName: versionMatch[1],
            evidenceId: versionMatch[2],
            version: versionMatch[3],
            extension: versionMatch[4],
        };
    }
    const legacyMatch = trimmed.match(/^(.+\.osn)\.(sev\..+)\.([^.]+)$/);
    if (legacyMatch) {
        return {
            osnFileName: legacyMatch[1],
            evidenceId: legacyMatch[2],
            version: "",
            extension: legacyMatch[3],
        };
    }
    return null;
}
function getEvidenceLinkKey(osnId, evidenceId) {
    return String(osnId) + "::" + String(evidenceId);
}
function linkSuccessEvidencesForOsn(osn, options) {
    const evidenceDir = (options === null || options === void 0 ? void 0 : options.evidenceDir) || DEFAULT_EVIDENCE_DIR;
    const version = (options === null || options === void 0 ? void 0 : options.evidenceVersion) || DEFAULT_EVIDENCE_VERSION;
    const osnFileName = getOsnFileName(osn);
    const defs = Array.isArray(osn.success_evidences) ? osn.success_evidences : [];
    return defs.map(function (def) {
        const evidenceId = String(def.evidence_id || "").trim();
        const kind = String(def.kind || evidenceId || "evidence").trim();
        const extension = (options === null || options === void 0 ? void 0 : options.extension) || inferExtensionFromKind(kind);
        const mediaType = inferMediaType(extension, kind);
        return {
            evidenceId,
            kind,
            inspectionPrompt: String(def.inspection_prompt || "").trim(),
            origin: {
                osnId: osn.id,
                fileName: osnFileName,
            },
            artifactFileName: buildEvidenceArtifactFileName(osnFileName, evidenceId, extension, version),
            artifactUrl: buildEvidenceArtifactUrl(evidenceDir, osnFileName, evidenceId, extension, version),
            mediaType,
            extension,
            version,
        };
    });
}
function findLinkedEvidence(osn, evidenceId, options) {
    const target = String(evidenceId || "").trim();
    if (!target) {
        return null;
    }
    return (linkSuccessEvidencesForOsn(osn, options).find(function (link) {
        return link.evidenceId === target;
    }) || null);
}
function listCandidateEvidenceLinks(osn, options) {
    const versions = options && options.evidenceVersion
        ? [options.evidenceVersion]
        : SUPPORTED_EVIDENCE_VERSIONS.slice();
    const candidates = [];
    const defs = Array.isArray(osn.success_evidences) ? osn.success_evidences : [];
    versions.forEach(function (version) {
        defs.forEach(function (def) {
            const kind = String(def.kind || "").trim();
            extensionsForKind(kind).forEach(function (extension) {
                linkSuccessEvidencesForOsn(osn, {
                    evidenceDir: options === null || options === void 0 ? void 0 : options.evidenceDir,
                    evidenceVersion: version,
                    extension,
                })
                    .filter(function (link) {
                    return link.evidenceId === String(def.evidence_id || "").trim();
                })
                    .forEach(function (link) {
                    candidates.push(link);
                });
            });
        });
    });
    return candidates;
}
const lexiom13EvidenceLinksApi = {
    DEFAULT_EVIDENCE_DIR,
    DEFAULT_EVIDENCE_VERSION,
    SUPPORTED_EVIDENCE_VERSIONS,
    SUPPORTED_DIRECT_EVIDENCE_KINDS,
    canonicalizeEvidenceKind,
    getOsnFileName,
    inferExtensionFromKind,
    extensionsForKind,
    isSupportedDirectEvidenceKind,
    hasCompliantDirectSuccessEvidence,
    inferMediaType,
    buildEvidenceArtifactFileName,
    buildEvidenceArtifactUrl,
    parseEvidenceArtifactFileName,
    getEvidenceLinkKey,
    linkSuccessEvidencesForOsn,
    findLinkedEvidence,
    listCandidateEvidenceLinks,
};
window.lexiom13EvidenceLinks =
    lexiom13EvidenceLinksApi;
