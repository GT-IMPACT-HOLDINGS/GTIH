/**
 * Lexiom 1.3 — OSNG Garden
 * Full-screen multi-tree radial exposition (look-and-feel + navigation only).
 * Does not mutate canonical OSN YAML or provenance.
 */
(function (global) {
  "use strict";

  var FULL_GRAPH_KIND_CLASSICAL = "classical";
  var FULL_GRAPH_KIND_GARDEN = "garden";

  var DEFAULT_RING = 72;
  var DEFAULT_D0 = 280;
  var DEFAULT_D_FAR = 520;
  var SPRING_ITERS = 90;
  var NODE_RADIUS = 5.5;
  var LABEL_OFFSET_Y = 14;
  /** Match app.js LCD_FADE_OUT_MS — one Lexiom Canonical Duration beat. */
  var GARDEN_LCD_MS = 1500;
  /** Focus-OSN attention halo: one sinusoidal bloom over 3 LCD. */
  var FOCUS_HALO_DURATION_MS = 3 * GARDEN_LCD_MS;
  /** Thematic-plane hue range: green → purple (degrees). */
  var PLANE_HUE_START = 130;
  var PLANE_HUE_END = 295;
  var PLANE_SAT = 62;
  var PLANE_LIGHT = 58;

  var panZoomState = {
    svg: null,
    viewBox: null,
    dragging: false,
    lastX: 0,
    lastY: 0,
    bound: false,
  };
  var focusHaloRafId = null;

  function hslToCss(h, s, l) {
    return "hsl(" + Math.round(h) + " " + s + "% " + l + "%)";
  }

  function hslToRgba(h, s, l, alpha) {
    var a = typeof alpha === "number" ? alpha : 0.45;
    // Convert HSL → RGB for drop-shadow filters that need rgba().
    var sat = s / 100;
    var light = l / 100;
    var c = (1 - Math.abs(2 * light - 1)) * sat;
    var hp = (((h % 360) + 360) % 360) / 60;
    var x = c * (1 - Math.abs((hp % 2) - 1));
    var r1 = 0;
    var g1 = 0;
    var b1 = 0;
    if (hp >= 0 && hp < 1) {
      r1 = c;
      g1 = x;
    } else if (hp < 2) {
      r1 = x;
      g1 = c;
    } else if (hp < 3) {
      g1 = c;
      b1 = x;
    } else if (hp < 4) {
      g1 = x;
      b1 = c;
    } else if (hp < 5) {
      r1 = x;
      b1 = c;
    } else {
      r1 = c;
      b1 = x;
    }
    var m = light - c / 2;
    var r = Math.round((r1 + m) * 255);
    var g = Math.round((g1 + m) * 255);
    var b = Math.round((b1 + m) * 255);
    return "rgba(" + r + ", " + g + ", " + b + ", " + a + ")";
  }

  function hslToRgbTuple(h, s, l) {
    var sat = s / 100;
    var light = l / 100;
    var c = (1 - Math.abs(2 * light - 1)) * sat;
    var hp = (((h % 360) + 360) % 360) / 60;
    var x = c * (1 - Math.abs((hp % 2) - 1));
    var r1 = 0;
    var g1 = 0;
    var b1 = 0;
    if (hp >= 0 && hp < 1) {
      r1 = c;
      g1 = x;
    } else if (hp < 2) {
      r1 = x;
      g1 = c;
    } else if (hp < 3) {
      g1 = c;
      b1 = x;
    } else if (hp < 4) {
      g1 = x;
      b1 = c;
    } else if (hp < 5) {
      r1 = x;
      b1 = c;
    } else {
      r1 = c;
      b1 = x;
    }
    var m = light - c / 2;
    return {
      r: Math.round((r1 + m) * 255),
      g: Math.round((g1 + m) * 255),
      b: Math.round((b1 + m) * 255),
    };
  }

  function parseCssRgb(color) {
    if (!color || color === "transparent") {
      return null;
    }
    var rgb = String(color).match(
      /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/
    );
    if (rgb) {
      return {
        r: Number(rgb[1]),
        g: Number(rgb[2]),
        b: Number(rgb[3]),
      };
    }
    var hex = String(color).match(/^#([0-9a-f]{6})$/i);
    if (hex) {
      var n = parseInt(hex[1], 16);
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
    return null;
  }

  function relativeLuminance(rgb) {
    if (!rgb) {
      return 0;
    }
    function channel(v) {
      var c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }
    return (
      0.2126 * channel(rgb.r) +
      0.7152 * channel(rgb.g) +
      0.0722 * channel(rgb.b)
    );
  }

  /**
   * Read the garden panel surface and decide whether the backdrop is dark.
   * Dark → push halo toward white; light → push toward black.
   */
  function isGardenBackgroundDark() {
    try {
      var host =
        (typeof document !== "undefined" &&
          (document.getElementById("lexiom-osn-graph") ||
            document.getElementById("lexiom-left-panel") ||
            document.body)) ||
        null;
      if (!host || !global.getComputedStyle) {
        return true;
      }
      var style = global.getComputedStyle(host);
      var rgb =
        parseCssRgb(style.backgroundColor) ||
        parseCssRgb(
          String(style.getPropertyValue("--lexiom-13-cockpit-surface") || "").trim()
        );
      if (!rgb) {
        return true;
      }
      return relativeLuminance(rgb) < 0.45;
    } catch (_error) {
      return true;
    }
  }

  /**
   * Mix plane color 50% toward white (dark bg) or black (light bg)
   * so the focus halo reads with stronger spatial contrast.
   */
  function contrastBoostHaloColors(hue, sat, light, towardWhite) {
    var rgb = hslToRgbTuple(hue, sat, light);
    var target = towardWhite ? 255 : 0;
    var mix = 0.5;
    var r = Math.round(rgb.r + mix * (target - rgb.r));
    var g = Math.round(rgb.g + mix * (target - rgb.g));
    var b = Math.round(rgb.b + mix * (target - rgb.b));
    return {
      color: "rgb(" + r + ", " + g + ", " + b + ")",
      glow: "rgba(" + r + ", " + g + ", " + b + ", 0.55)",
    };
  }

  /**
   * Assign green→purple plane colors across thematic trees (stable by root order).
   */
  function assignPlaneColors(trees) {
    var n = trees.length;
    trees.forEach(function (tree, index) {
      var t = n <= 1 ? 0 : index / (n - 1);
      var hue = PLANE_HUE_START + t * (PLANE_HUE_END - PLANE_HUE_START);
      tree.planeIndex = index;
      tree.hue = hue;
      tree.color = hslToCss(hue, PLANE_SAT, PLANE_LIGHT);
      tree.colorGlow = hslToRgba(hue, PLANE_SAT, PLANE_LIGHT, 0.55);
      tree.colorDim = hslToCss(hue, PLANE_SAT, 42);
    });
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return (
        {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }[char] || char
      );
    });
  }

  function getPrimaryParentId(osn) {
    var parents =
      osn && osn.graph && Array.isArray(osn.graph.parent_osn_ids)
        ? osn.graph.parent_osn_ids
        : [];
    return parents.length ? String(parents[0]) : null;
  }

  function getChildIds(osn) {
    return osn && osn.graph && Array.isArray(osn.graph.child_osn_ids)
      ? osn.graph.child_osn_ids.map(String)
      : [];
  }

  function getStandardAncestorIds(osn) {
    return osn && osn.graph && Array.isArray(osn.graph.standard_ancestor_osn_ids)
      ? osn.graph.standard_ancestor_osn_ids.map(String)
      : [];
  }

  function resolveRootId(osnId, osnsById) {
    var current = osnsById.get(osnId);
    var seen = Object.create(null);
    while (current) {
      var id = String(current.id);
      if (seen[id]) {
        return id;
      }
      seen[id] = true;
      var parentId = getPrimaryParentId(current);
      if (!parentId || !osnsById.has(parentId)) {
        return id;
      }
      current = osnsById.get(parentId);
    }
    return String(osnId);
  }

  function partitionThematicTrees(osnsById, rootOsns) {
    var trees = [];
    var nodeToRoot = Object.create(null);
    var rootList = (rootOsns || []).map(function (osn) {
      return String(osn.id);
    });

    rootList.forEach(function (rootId) {
      trees.push({
        rootId: rootId,
        nodeIds: [],
        localPositions: Object.create(null),
      });
    });

    var rootIndex = Object.create(null);
    trees.forEach(function (tree, index) {
      rootIndex[tree.rootId] = index;
    });

    osnsById.forEach(function (_osn, osnId) {
      var rootId = resolveRootId(osnId, osnsById);
      nodeToRoot[String(osnId)] = rootId;
      var index = rootIndex[rootId];
      if (index == null) {
        index = trees.length;
        rootIndex[rootId] = index;
        trees.push({
          rootId: rootId,
          nodeIds: [],
          localPositions: Object.create(null),
        });
      }
      trees[index].nodeIds.push(String(osnId));
    });

    return { trees: trees, nodeToRoot: nodeToRoot };
  }

  function layoutRadialTree(rootId, osnsById, ringRadius) {
    var R = typeof ringRadius === "number" && ringRadius > 0 ? ringRadius : DEFAULT_RING;
    var positions = Object.create(null);
    positions[rootId] = { x: 0, y: 0 };

    function childrenOf(parentId) {
      var parent = osnsById.get(parentId);
      return getChildIds(parent).filter(function (childId) {
        return osnsById.has(childId) && resolveRootId(childId, osnsById) === rootId;
      });
    }

    function place(parentId, sectorStart, sectorEnd) {
      var kids = childrenOf(parentId);
      if (!kids.length) {
        return;
      }
      var width = sectorEnd - sectorStart;
      var parentPos = positions[parentId] || { x: 0, y: 0 };
      var m = kids.length;
      var j;
      for (j = 0; j < m; j += 1) {
        var childId = kids[j];
        var angle = sectorStart + ((j + 0.5) * width) / m;
        positions[childId] = {
          x: parentPos.x + R * Math.cos(angle),
          y: parentPos.y + R * Math.sin(angle),
        };
        var childWidth = width / m;
        var childStart = sectorStart + j * childWidth;
        place(childId, childStart, childStart + childWidth);
      }
    }

    place(rootId, 0, Math.PI * 2);
    return positions;
  }

  function countCrossTreeLinks(osnsById, nodeToRoot) {
    var weights = Object.create(null);
    function key(a, b) {
      return a < b ? a + "\0" + b : b + "\0" + a;
    }
    osnsById.forEach(function (osn, osnId) {
      var fromRoot = nodeToRoot[String(osnId)];
      if (!fromRoot) {
        return;
      }
      getStandardAncestorIds(osn).forEach(function (ancestorId) {
        if (!osnsById.has(ancestorId)) {
          return;
        }
        var toRoot = nodeToRoot[String(ancestorId)];
        if (!toRoot || toRoot === fromRoot) {
          return;
        }
        var k = key(fromRoot, toRoot);
        weights[k] = (weights[k] || 0) + 1;
      });
    });
    return weights;
  }

  function desiredDistance(rootA, rootB, weights, d0, dFar) {
    var k = rootA < rootB ? rootA + "\0" + rootB : rootB + "\0" + rootA;
    var w = weights[k] || 0;
    if (w <= 0) {
      return dFar;
    }
    return d0 / (1 + w);
  }

  function placeTreeCenters(rootIds, weights, options) {
    var d0 = (options && options.d0) || DEFAULT_D0;
    var dFar = (options && options.dFar) || DEFAULT_D_FAR;
    var centers = Object.create(null);
    var n = rootIds.length;
    var i;
    var j;
    var iter;

    if (n === 0) {
      return centers;
    }
    if (n === 1) {
      centers[rootIds[0]] = { x: 0, y: 0 };
      return centers;
    }

    for (i = 0; i < n; i += 1) {
      var angle = (2 * Math.PI * i) / n;
      centers[rootIds[i]] = {
        x: Math.cos(angle) * dFar * 0.55,
        y: Math.sin(angle) * dFar * 0.55,
      };
    }

    for (iter = 0; iter < SPRING_ITERS; iter += 1) {
      var forces = Object.create(null);
      for (i = 0; i < n; i += 1) {
        forces[rootIds[i]] = { x: 0, y: 0 };
      }

      for (i = 0; i < n; i += 1) {
        for (j = i + 1; j < n; j += 1) {
          var a = rootIds[i];
          var b = rootIds[j];
          var ca = centers[a];
          var cb = centers[b];
          var dx = cb.x - ca.x;
          var dy = cb.y - ca.y;
          var dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
          var ux = dx / dist;
          var uy = dy / dist;
          var target = desiredDistance(a, b, weights, d0, dFar);

          // Soft repulsion to avoid collapse.
          var minSep = Math.min(d0 * 0.45, target * 0.7);
          if (dist < minSep) {
            var push = (minSep - dist) * 0.35;
            forces[a].x -= ux * push;
            forces[a].y -= uy * push;
            forces[b].x += ux * push;
            forces[b].y += uy * push;
          }

          // Spring toward desired distance.
          var pull = (dist - target) * 0.08;
          forces[a].x += ux * pull;
          forces[a].y += uy * pull;
          forces[b].x -= ux * pull;
          forces[b].y -= uy * pull;
        }
      }

      var damp = 1 - iter / (SPRING_ITERS + 8);
      for (i = 0; i < n; i += 1) {
        var id = rootIds[i];
        centers[id].x += forces[id].x * damp;
        centers[id].y += forces[id].y * damp;
      }
    }

    // Recenter garden around origin.
    var sx = 0;
    var sy = 0;
    for (i = 0; i < n; i += 1) {
      sx += centers[rootIds[i]].x;
      sy += centers[rootIds[i]].y;
    }
    sx /= n;
    sy /= n;
    for (i = 0; i < n; i += 1) {
      centers[rootIds[i]].x -= sx;
      centers[rootIds[i]].y -= sy;
    }

    return centers;
  }

  function collectNativeEdges(trees, osnsById) {
    var edges = [];
    trees.forEach(function (tree) {
      tree.nodeIds.forEach(function (nodeId) {
        var osn = osnsById.get(nodeId);
        getChildIds(osn).forEach(function (childId) {
          if (tree.localPositions[childId]) {
            edges.push({ from: nodeId, to: childId, kind: "native" });
          }
        });
      });
    });
    return edges;
  }

  function collectCrossEdges(osnsById, nodeToRoot) {
    var edges = [];
    osnsById.forEach(function (osn, osnId) {
      var fromRoot = nodeToRoot[String(osnId)];
      getStandardAncestorIds(osn).forEach(function (ancestorId) {
        if (!osnsById.has(ancestorId)) {
          return;
        }
        var toRoot = nodeToRoot[String(ancestorId)];
        if (!toRoot || !fromRoot || toRoot === fromRoot) {
          return;
        }
        edges.push({
          from: String(osnId),
          to: String(ancestorId),
          kind: "cross",
        });
      });
    });
    return edges;
  }

  /**
   * @param {{ osnsById: Map, rootOsns: Array, ringRadius?: number, d0?: number, dFar?: number }} input
   */
  function computeGardenLayout(input) {
    var osnsById = input && input.osnsById;
    var rootOsns = (input && input.rootOsns) || [];
    if (!osnsById) {
      return {
        nodes: [],
        edges: [],
        trees: [],
        bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
      };
    }

    var partitioned = partitionThematicTrees(osnsById, rootOsns);
    var trees = partitioned.trees;
    var nodeToRoot = partitioned.nodeToRoot;
    var ring = (input && input.ringRadius) || DEFAULT_RING;
    assignPlaneColors(trees);

    trees.forEach(function (tree) {
      tree.localPositions = layoutRadialTree(tree.rootId, osnsById, ring);
    });

    var weights = countCrossTreeLinks(osnsById, nodeToRoot);
    var rootIds = trees.map(function (tree) {
      return tree.rootId;
    });
    var centers = placeTreeCenters(rootIds, weights, {
      d0: input && input.d0,
      dFar: input && input.dFar,
    });

    var colorByRoot = Object.create(null);
    trees.forEach(function (tree) {
      colorByRoot[tree.rootId] = {
        color: tree.color,
        colorGlow: tree.colorGlow,
        colorDim: tree.colorDim,
        planeIndex: tree.planeIndex,
        hue: tree.hue,
      };
    });

    var world = Object.create(null);
    trees.forEach(function (tree) {
      var c = centers[tree.rootId] || { x: 0, y: 0 };
      var palette = colorByRoot[tree.rootId] || {};
      Object.keys(tree.localPositions).forEach(function (nodeId) {
        var local = tree.localPositions[nodeId];
        world[nodeId] = {
          id: nodeId,
          x: local.x + c.x,
          y: local.y + c.y,
          rootId: tree.rootId,
          isRoot: nodeId === tree.rootId,
          color: palette.color,
          colorGlow: palette.colorGlow,
          colorDim: palette.colorDim,
          planeIndex: palette.planeIndex,
          hue: palette.hue,
        };
      });
    });

    var nodes = Object.keys(world).map(function (id) {
      return world[id];
    });
    var edges = collectNativeEdges(trees, osnsById).concat(
      collectCrossEdges(osnsById, nodeToRoot)
    );

    var minX = Infinity;
    var minY = Infinity;
    var maxX = -Infinity;
    var maxY = -Infinity;
    if (!nodes.length) {
      minX = minY = maxX = maxY = 0;
    } else {
      nodes.forEach(function (node) {
        if (node.x < minX) minX = node.x;
        if (node.y < minY) minY = node.y;
        if (node.x > maxX) maxX = node.x;
        if (node.y > maxY) maxY = node.y;
      });
    }

    var pad = ring * 1.4;
    return {
      nodes: nodes,
      edges: edges,
      trees: trees,
      centers: centers,
      crossWeights: weights,
      bounds: {
        minX: minX - pad,
        minY: minY - pad,
        maxX: maxX + pad,
        maxY: maxY + pad,
      },
    };
  }

  function labelForNode(osn, helpers) {
    if (helpers && typeof helpers.getLabel === "function") {
      return helpers.getLabel(osn);
    }
    if (!osn) {
      return "OSN";
    }
    if (osn.title) {
      return String(osn.title);
    }
    return String(osn.id || "OSN");
  }

  /** Collapse seed prose for hover captions (GUI + native <title>). */
  function seedForNode(osn) {
    return String((osn && osn.seed) || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /** Seed above name when seed exists; otherwise name only. */
  function hoverCaptionForNode(osn, helpers) {
    var name = labelForNode(osn, helpers);
    var seed = seedForNode(osn);
    if (!seed) {
      return name;
    }
    return seed + "\n\n" + name;
  }

  function buildGardenSvgHtml(layout, options) {
    var opts = options || {};
    var selectedId = opts.selectedOsnId ? String(opts.selectedOsnId) : "";
    var osnsById = opts.osnsById;
    var helpers = opts.helpers || {};
    var bounds = layout.bounds || { minX: 0, minY: 0, maxX: 800, maxY: 600 };
    var width = Math.max(40, bounds.maxX - bounds.minX);
    var height = Math.max(40, bounds.maxY - bounds.minY);
    var viewBox =
      bounds.minX + " " + bounds.minY + " " + width + " " + height;

    var trees = layout.trees || [];
    var markerDefs = trees
      .map(function (tree) {
        var idx = tree.planeIndex;
        var fill = escapeHtml(tree.color || "currentColor");
        return (
          '<marker id="lexiom-garden-arrow-native-' +
          idx +
          '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">' +
          '<path d="M 0 0 L 10 5 L 0 10 z" fill="' +
          fill +
          '"></path>' +
          "</marker>"
        );
      })
      .join("");
    // Cross-tree arrows: mid-spectrum (cyan–blue) so they read as bridges between planes.
    var crossHue = (PLANE_HUE_START + PLANE_HUE_END) / 2;
    var crossColor = hslToCss(crossHue, PLANE_SAT, PLANE_LIGHT);
    var markerCross =
      '<marker id="lexiom-garden-arrow-cross" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">' +
      '<path d="M 0 0 L 10 5 L 0 10 z" fill="' +
      escapeHtml(crossColor) +
      '" opacity="0.9"></path>' +
      "</marker>";

    var nodeById = Object.create(null);
    (layout.nodes || []).forEach(function (node) {
      nodeById[node.id] = node;
    });

    var edgeHtml = (layout.edges || [])
      .map(function (edge) {
        var from = nodeById[edge.from];
        var to = nodeById[edge.to];
        if (!from || !to) {
          return "";
        }
        var isCross = edge.kind === "cross";
        var cls = isCross
          ? "lexiom-garden-edge lexiom-garden-edge-cross"
          : "lexiom-garden-edge lexiom-garden-edge-native";
        var stroke = isCross
          ? crossColor
          : from.color || to.color || "currentColor";
        var marker = isCross
          ? "url(#lexiom-garden-arrow-cross)"
          : "url(#lexiom-garden-arrow-native-" +
            (typeof from.planeIndex === "number" ? from.planeIndex : 0) +
            ")";
        var dx = to.x - from.x;
        var dy = to.y - from.y;
        var len = Math.sqrt(dx * dx + dy * dy) || 1;
        var inset = NODE_RADIUS + 2;
        var x1 = from.x + (dx / len) * inset;
        var y1 = from.y + (dy / len) * inset;
        var x2 = to.x - (dx / len) * inset;
        var y2 = to.y - (dy / len) * inset;
        return (
          '<line class="' +
          cls +
          '" style="stroke:' +
          escapeHtml(stroke) +
          "; color:" +
          escapeHtml(stroke) +
          '" x1="' +
          x1 +
          '" y1="' +
          y1 +
          '" x2="' +
          x2 +
          '" y2="' +
          y2 +
          '" marker-end="' +
          marker +
          '"></line>'
        );
      })
      .join("");

    var nodeHtml = (layout.nodes || [])
      .map(function (node) {
        var osn = osnsById ? osnsById.get(node.id) : null;
        var label = escapeHtml(labelForNode(osn, helpers));
        var hoverCaption = escapeHtml(hoverCaptionForNode(osn, helpers));
        var selected = node.id === selectedId ? " is-selected" : "";
        var rootClass = node.isRoot ? " is-root" : "";
        var color = node.color || "currentColor";
        var glow = node.colorGlow || "rgba(77, 170, 252, 0.45)";
        var discR = node.isRoot ? NODE_RADIUS + 1.5 : NODE_RADIUS;
        var haloColor = color;
        var haloGlow = glow;
        if (selected) {
          var towardWhite = isGardenBackgroundDark();
          var boosted = contrastBoostHaloColors(
            typeof node.hue === "number" ? node.hue : 210,
            PLANE_SAT,
            PLANE_LIGHT,
            towardWhite
          );
          haloColor = boosted.color;
          haloGlow = boosted.glow;
        }
        var haloHtml = selected
          ? '<circle class="lexiom-garden-focus-halo" r="0" fill-opacity="0" data-base-r="' +
            discR +
            '" aria-hidden="true"></circle>'
          : "";
        return (
          '<g class="lexiom-garden-node' +
          selected +
          rootClass +
          '" data-osn-id="' +
          escapeHtml(node.id) +
          '" data-plane-index="' +
          (typeof node.planeIndex === "number" ? node.planeIndex : "") +
          '" style="color:' +
          escapeHtml(color) +
          "; --garden-plane-color:" +
          escapeHtml(color) +
          "; --garden-plane-glow:" +
          escapeHtml(glow) +
          "; --garden-halo-color:" +
          escapeHtml(haloColor) +
          "; --garden-halo-glow:" +
          escapeHtml(haloGlow) +
          '" transform="translate(' +
          node.x +
          " " +
          node.y +
          ')">' +
          haloHtml +
          '<circle class="lexiom-garden-node-disc" r="' +
          discR +
          '"></circle>' +
          '<text class="lexiom-garden-node-label" y="' +
          LABEL_OFFSET_Y +
          '" text-anchor="middle">' +
          label +
          "</text>" +
          "<title>" +
          hoverCaption +
          "</title>" +
          "</g>"
        );
      })
      .join("");

    return (
      '<svg id="lexiom-osng-garden" class="lexiom-osng-garden" role="img" aria-label="Top view" viewBox="' +
      escapeHtml(viewBox) +
      '" data-min-x="' +
      bounds.minX +
      '" data-min-y="' +
      bounds.minY +
      '" data-vb-w="' +
      width +
      '" data-vb-h="' +
      height +
      '">' +
      "<defs>" +
      markerDefs +
      markerCross +
      "</defs>" +
      '<g class="lexiom-garden-edges">' +
      edgeHtml +
      "</g>" +
      '<g class="lexiom-garden-nodes">' +
      nodeHtml +
      "</g>" +
      "</svg>"
    );
  }

  function getViewBox(svg) {
    if (!svg) {
      return null;
    }
    var minX = parseFloat(svg.getAttribute("data-min-x"));
    var minY = parseFloat(svg.getAttribute("data-min-y"));
    var w = parseFloat(svg.getAttribute("data-vb-w"));
    var h = parseFloat(svg.getAttribute("data-vb-h"));
    if (![minX, minY, w, h].every(function (n) {
      return Number.isFinite(n);
    })) {
      return null;
    }
    return { minX: minX, minY: minY, width: w, height: h };
  }

  function applyViewBox(svg, vb) {
    if (!svg || !vb) {
      return;
    }
    svg.setAttribute(
      "viewBox",
      vb.minX + " " + vb.minY + " " + vb.width + " " + vb.height
    );
    svg.setAttribute("data-min-x", String(vb.minX));
    svg.setAttribute("data-min-y", String(vb.minY));
    svg.setAttribute("data-vb-w", String(vb.width));
    svg.setAttribute("data-vb-h", String(vb.height));
  }

  function clientToSvgDelta(svg, dx, dy) {
    var rect = svg.getBoundingClientRect();
    var vb = getViewBox(svg);
    if (!vb || !rect.width || !rect.height) {
      return { x: 0, y: 0 };
    }
    return {
      x: (dx / rect.width) * vb.width,
      y: (dy / rect.height) * vb.height,
    };
  }

  function stopFocusHaloAnimation() {
    if (focusHaloRafId != null) {
      global.cancelAnimationFrame(focusHaloRafId);
      focusHaloRafId = null;
    }
  }

  /**
   * Sinusoidal focus halo: over each 3-LCD cycle, radius blooms
   * 0 → 2× disc radius → 0 via sin(π t). Loops while Garden is open.
   */
  function startFocusHaloAnimation(svg) {
    stopFocusHaloAnimation();
    if (!svg) {
      return;
    }
    try {
      if (
        global.matchMedia &&
        global.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        var staticHalo = svg.querySelector(".lexiom-garden-focus-halo");
        if (staticHalo) {
          var baseStatic = parseFloat(staticHalo.getAttribute("data-base-r")) || NODE_RADIUS;
          staticHalo.setAttribute("r", String(baseStatic * 2.7));
          staticHalo.setAttribute("fill-opacity", "0.25");
          staticHalo.removeAttribute("stroke-opacity");
          staticHalo.removeAttribute("opacity");
        }
        return;
      }
    } catch (_error) {
      // ignore
    }

    var halo = svg.querySelector(".lexiom-garden-focus-halo");
    if (!halo) {
      return;
    }
    var baseR = parseFloat(halo.getAttribute("data-base-r"));
    if (!Number.isFinite(baseR) || baseR <= 0) {
      baseR = NODE_RADIUS;
    }
    // Peak halo radius = 4× disc (doubled from the prior 2× peak).
    var maxR = baseR * 4;
    var startTs = 0;

    function frame(ts) {
      if (!startTs) {
        startTs = ts;
      }
      var elapsed = ts - startTs;
      var t = (elapsed % FOCUS_HALO_DURATION_MS) / FOCUS_HALO_DURATION_MS;
      // Half-sine lobe: amplitude grows 0 → maxR → 0 over 3 LCD.
      var amp = Math.sin(Math.PI * t);
      halo.setAttribute("r", String(maxR * amp));
      // Annulus wash only (no circumference stroke); peak fill 25% opacity.
      halo.setAttribute("fill-opacity", String(0.25 * amp));
      halo.removeAttribute("stroke-opacity");
      halo.removeAttribute("opacity");
      focusHaloRafId = global.requestAnimationFrame(frame);
    }

    focusHaloRafId = global.requestAnimationFrame(frame);
  }

  function unbindGardenPanZoom() {
    stopFocusHaloAnimation();
    panZoomState.svg = null;
    panZoomState.viewBox = null;
    panZoomState.dragging = false;
    panZoomState.bound = false;
  }

  function bindGardenPanZoom(svg) {
    unbindGardenPanZoom();
    if (!svg) {
      return;
    }
    panZoomState.svg = svg;
    panZoomState.viewBox = getViewBox(svg);
    panZoomState.bound = true;
    startFocusHaloAnimation(svg);

    svg.addEventListener(
      "wheel",
      function (event) {
        if (!panZoomState.svg) {
          return;
        }
        event.preventDefault();
        var vb = getViewBox(svg);
        if (!vb) {
          return;
        }
        var rect = svg.getBoundingClientRect();
        var mx = event.clientX - rect.left;
        var my = event.clientY - rect.top;
        var svgX = vb.minX + (mx / rect.width) * vb.width;
        var svgY = vb.minY + (my / rect.height) * vb.height;
        var factor = event.deltaY < 0 ? 0.9 : 1.1;
        var nextW = Math.max(40, vb.width * factor);
        var nextH = Math.max(40, vb.height * factor);
        var next = {
          width: nextW,
          height: nextH,
          minX: svgX - (mx / rect.width) * nextW,
          minY: svgY - (my / rect.height) * nextH,
        };
        applyViewBox(svg, next);
      },
      { passive: false }
    );

    svg.addEventListener("pointerdown", function (event) {
      if (event.button !== 0) {
        return;
      }
      if (event.target && event.target.closest && event.target.closest(".lexiom-garden-node")) {
        return;
      }
      panZoomState.dragging = true;
      panZoomState.lastX = event.clientX;
      panZoomState.lastY = event.clientY;
      try {
        svg.setPointerCapture(event.pointerId);
      } catch (_error) {
        // ignore
      }
      svg.classList.add("is-panning");
    });

    svg.addEventListener("pointermove", function (event) {
      if (!panZoomState.dragging) {
        return;
      }
      var vb = getViewBox(svg);
      if (!vb) {
        return;
      }
      var delta = clientToSvgDelta(
        svg,
        event.clientX - panZoomState.lastX,
        event.clientY - panZoomState.lastY
      );
      panZoomState.lastX = event.clientX;
      panZoomState.lastY = event.clientY;
      applyViewBox(svg, {
        minX: vb.minX - delta.x,
        minY: vb.minY - delta.y,
        width: vb.width,
        height: vb.height,
      });
    });

    function endPan(event) {
      if (!panZoomState.dragging) {
        return;
      }
      panZoomState.dragging = false;
      svg.classList.remove("is-panning");
      try {
        svg.releasePointerCapture(event.pointerId);
      } catch (_error) {
        // ignore
      }
    }

    svg.addEventListener("pointerup", endPan);
    svg.addEventListener("pointercancel", endPan);
  }

  function bindGardenNodeClicks(container, onSelect) {
    if (!container || typeof onSelect !== "function") {
      return;
    }
    container.querySelectorAll(".lexiom-garden-node").forEach(function (nodeEl) {
      nodeEl.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        var osnId = nodeEl.getAttribute("data-osn-id");
        if (osnId) {
          onSelect(osnId);
        }
      });
    });
  }

    global.lexiom13OsngGarden = {
    FULL_GRAPH_KIND_CLASSICAL: FULL_GRAPH_KIND_CLASSICAL,
    FULL_GRAPH_KIND_GARDEN: FULL_GRAPH_KIND_GARDEN,
    computeGardenLayout: computeGardenLayout,
    buildGardenSvgHtml: buildGardenSvgHtml,
    bindGardenPanZoom: bindGardenPanZoom,
    unbindGardenPanZoom: unbindGardenPanZoom,
    bindGardenNodeClicks: bindGardenNodeClicks,
    startFocusHaloAnimation: startFocusHaloAnimation,
    stopFocusHaloAnimation: stopFocusHaloAnimation,
  };
})(typeof window !== "undefined" ? window : this);
