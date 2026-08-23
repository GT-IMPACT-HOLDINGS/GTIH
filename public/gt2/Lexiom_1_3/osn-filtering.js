(function () {
  "use strict";

  /**
   * Lexiom 1.3 — OSN graph filtering and read-only status glyphs.
   *
   * Filters control which optional read-only details appear on OSN graph nodes.
   * The initial filter surfaces per-OSN demo-evidence approval status.
   */

  var FILTER_IDS = {
    EVIDENCE_APPROVAL: "evidence_approval",
    BUILD_CONTROLS: "build_controls",
    TOP_BAR: "top_bar",
    COCKPIT_TITLE: "cockpit_title",
  };

  // All optional surfaces start disabled so the initial cockpit is visually calm;
  // the player opts into extra detail (evidence approval, build controls, top bar).
  // Cockpit title stays off and is not offered as a selectable filter.
  var filterState = {
    evidence_approval: false,
    build_controls: false,
    top_bar: false,
    cockpit_title: false,
  };

  var FILTER_DEFS = [
    {
      id: FILTER_IDS.EVIDENCE_APPROVAL,
      label: "Evidence approval",
      description: "Show a read-only glyph beside each OSN for demo-evidence approval status",
    },
    {
      id: FILTER_IDS.BUILD_CONTROLS,
      label: "Build controls",
      description: "Show the build glyph beside each OSN for compiling from that node",
    },
    {
      id: FILTER_IDS.TOP_BAR,
      label: "Top bar",
      description: "Show the top HUD ribbon with L2 thematic lenses",
    },
  ];

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, function (char) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[char];
    });
  }

  function toDomId(prefix, raw) {
    var slug = String(raw || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-");
    return slug ? prefix + "-" + slug : prefix;
  }

  function isFilterEnabled(filterId) {
    return filterState[filterId] === true;
  }

  function setFilterEnabled(filterId, enabled) {
    if (Object.prototype.hasOwnProperty.call(filterState, filterId)) {
      filterState[filterId] = enabled === true;
    }
  }

  function getLinkedEvidences(osn, ctx) {
    if (!ctx || typeof ctx.getLinkedEvidencesForOsn !== "function" || !osn) {
      return [];
    }
    return ctx.getLinkedEvidencesForOsn(osn) || [];
  }

  function isArtifactAvailable(link, ctx) {
    if (!ctx || typeof ctx.isEvidenceArtifactAvailable !== "function" || !link) {
      return false;
    }
    return ctx.isEvidenceArtifactAvailable(link) === true;
  }

  function isEvidenceApproved(link, ctx) {
    if (!ctx || typeof ctx.isEvidenceApproved !== "function" || !link) {
      return false;
    }
    return ctx.isEvidenceApproved(link.origin.osnId, link.evidenceId) === true;
  }

  /**
   * Classify an OSN's demo-evidence approval posture.
   * state: "none" | "pending" | "partial" | "approved"
   */
  function getOsnEvidenceApprovalStatus(osn, ctx) {
    var links = getLinkedEvidences(osn, ctx);
    var available = links.filter(function (link) {
      return isArtifactAvailable(link, ctx);
    });
    var approved = available.filter(function (link) {
      return isEvidenceApproved(link, ctx);
    });

    var state = "none";
    if (available.length > 0) {
      if (approved.length === 0) {
        state = "pending";
      } else if (approved.length === available.length) {
        state = "approved";
      } else {
        state = "partial";
      }
    }

    return {
      total: links.length,
      available: available.length,
      approved: approved.length,
      state: state,
    };
  }

  function summarizeEvidenceApproval(osns, ctx) {
    var list = Array.isArray(osns) ? osns : [];
    var reviewable = 0;
    var attested = 0;
    var partial = 0;
    var pending = 0;

    list.forEach(function (osn) {
      var status = getOsnEvidenceApprovalStatus(osn, ctx);
      if (status.available === 0) {
        return;
      }
      reviewable += 1;
      if (status.state === "approved") {
        attested += 1;
      } else if (status.state === "partial") {
        partial += 1;
      } else if (status.state === "pending") {
        pending += 1;
      }
    });

    return {
      reviewable: reviewable,
      attested: attested,
      partial: partial,
      pending: pending,
    };
  }

  function canBuildOsn(osn, ctx) {
    if (!ctx || typeof ctx.canBuildOsn !== "function" || !osn) {
      return false;
    }
    return ctx.canBuildOsn(osn) === true;
  }

  function summarizeBuild(osns, ctx) {
    var list = Array.isArray(osns) ? osns : [];
    var total = list.length;
    var buildable = 0;

    list.forEach(function (osn) {
      if (canBuildOsn(osn, ctx)) {
        buildable += 1;
      }
    });

    return {
      total: total,
      buildable: buildable,
    };
  }

  function getEvidenceApprovalTitle(status) {
    if (!status || status.available === 0) {
      return "No reviewable demo evidence yet";
    }
    if (status.state === "approved") {
      return (
        "All " +
        status.approved +
        " reviewable evidence" +
        (status.approved === 1 ? "" : "s") +
        " approved"
      );
    }
    if (status.state === "partial") {
      return status.approved + " of " + status.available + " reviewable evidences approved";
    }
    return status.available + " reviewable evidence" + (status.available === 1 ? "" : "s") + " pending owner approval";
  }

  function getEvidenceApprovalGlyphChar(state) {
    if (state === "approved") {
      return "\u25CF";
    }
    if (state === "partial") {
      return "\u25D0";
    }
    if (state === "pending") {
      return "\u25CB";
    }
    return "\u00B7";
  }

  function renderEvidenceApprovalGlyph(osn, ctx) {
    if (!isFilterEnabled(FILTER_IDS.EVIDENCE_APPROVAL)) {
      return "";
    }

    var status = getOsnEvidenceApprovalStatus(osn, ctx);
    var stateTitle = getEvidenceApprovalTitle(status);
    var glyph = getEvidenceApprovalGlyphChar(status.state);

    // When the OSN defines success evidences, the glyph doubles as a quick-nav
    // control into that OSN's Success Evidences section. It never mutates
    // approval — it only navigates — so it stays a read-only status indicator.
    if (status.total > 0 && osn && osn.id) {
      var navTitle = stateTitle + " — open Success Evidences";
      return (
        '<button type="button" id="' +
        toDomId("lexiom-osn-approval-glyph", osn.id) +
        '" class="lexiom-osn-approval-glyph lexiom-osn-approval-glyph-trigger is-' +
        escapeHtml(status.state) +
        '" data-approval-osn-id="' +
        escapeHtml(osn.id) +
        '" aria-label="' +
        escapeHtml(navTitle) +
        '" title="' +
        escapeHtml(navTitle) +
        '">' +
        escapeHtml(glyph) +
        "</button>"
      );
    }

    return (
      '<span id="' +
      toDomId("lexiom-osn-approval-glyph", osn.id) +
      '" class="lexiom-osn-approval-glyph is-' +
      escapeHtml(status.state) +
      '" role="img" aria-label="' +
      escapeHtml(stateTitle) +
      '" title="' +
      escapeHtml(stateTitle) +
      '">' +
      escapeHtml(glyph) +
      "</span>"
    );
  }

  function bindApprovalGlyphNav(container, onNavigate) {
    if (!container || typeof onNavigate !== "function") {
      return;
    }
    container.querySelectorAll(".lexiom-osn-approval-glyph-trigger").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.stopPropagation();
        var osnId = button.getAttribute("data-approval-osn-id");
        if (osnId) {
          onNavigate(osnId);
        }
      });
    });
  }

  function renderEvidenceApprovalSummary(osns, ctx) {
    var summary = summarizeEvidenceApproval(osns, ctx);
    if (summary.reviewable === 0) {
      return (
        '<div id="lexiom-osn-filter-summary" class="lexiom-osn-filter-summary">' +
        "No reviewable demo evidences in this graph yet." +
        "</div>"
      );
    }

    return (
      '<div id="lexiom-osn-filter-summary" class="lexiom-osn-filter-summary">' +
      "Evidence approval: " +
      summary.attested +
      "/" +
      summary.reviewable +
      " OSN" +
      (summary.reviewable === 1 ? "" : "s") +
      " attested" +
      (summary.partial > 0 ? " · " + summary.partial + " partial" : "") +
      (summary.pending > 0 ? " · " + summary.pending + " pending" : "") +
      "</div>"
    );
  }

  function renderBuildSummary(osns, ctx) {
    var summary = summarizeBuild(osns, ctx);
    if (summary.total === 0) {
      return "";
    }

    return (
      '<div class="lexiom-osn-filter-summary">' +
      "Build controls: " +
      summary.buildable +
      "/" +
      summary.total +
      " OSN" +
      (summary.total === 1 ? "" : "s") +
      " build-ready" +
      "</div>"
    );
  }

  function renderFilterSummary(osns, ctx) {
    var parts = [];
    if (isFilterEnabled(FILTER_IDS.EVIDENCE_APPROVAL)) {
      parts.push(renderEvidenceApprovalSummary(osns, ctx));
    }
    if (isFilterEnabled(FILTER_IDS.BUILD_CONTROLS)) {
      parts.push(renderBuildSummary(osns, ctx));
    }
    return parts.join("");
  }

  function renderFilterBar(osns, ctx) {
    var controls = FILTER_DEFS.map(function (filter) {
      var inputId = "lexiom-osn-filter-" + filter.id;
      var checked = isFilterEnabled(filter.id) ? " checked" : "";
      return (
        '<div class="lexiom-osn-filter-item" id="' +
        toDomId("lexiom-osn-filter-item", filter.id) +
        '">' +
        '<input type="checkbox" class="lexiom-osn-filter-checkbox" id="' +
        inputId +
        '" data-filter-id="' +
        escapeHtml(filter.id) +
        '"' +
        checked +
        ' title="' +
        escapeHtml(filter.description) +
        '">' +
        '<label class="lexiom-osn-filter-label" for="' +
        inputId +
        '">' +
        escapeHtml(filter.label) +
        "</label>" +
        "</div>"
      );
    }).join("");

    return (
      '<div id="lexiom-osn-filter-bar" class="lexiom-osn-filter-bar">' +
      controls +
      renderFilterSummary(osns, ctx) +
      "</div>"
    );
  }

  function bindFilterBar(container, onChange) {
    if (!container) {
      return;
    }
    container.querySelectorAll(".lexiom-osn-filter-checkbox").forEach(function (checkbox) {
      checkbox.addEventListener("change", function () {
        var filterId = checkbox.getAttribute("data-filter-id");
        if (filterId) {
          setFilterEnabled(filterId, checkbox.checked);
          if (typeof onChange === "function") {
            onChange(filterId, checkbox.checked);
          }
        }
      });
    });
  }

  window.lexiom13OsnFiltering = {
    FILTER_IDS: FILTER_IDS,
    isFilterEnabled: isFilterEnabled,
    setFilterEnabled: setFilterEnabled,
    getOsnEvidenceApprovalStatus: getOsnEvidenceApprovalStatus,
    summarizeEvidenceApproval: summarizeEvidenceApproval,
    summarizeBuild: summarizeBuild,
    renderEvidenceApprovalGlyph: renderEvidenceApprovalGlyph,
    bindApprovalGlyphNav: bindApprovalGlyphNav,
    renderFilterBar: renderFilterBar,
    bindFilterBar: bindFilterBar,
  };
})();
