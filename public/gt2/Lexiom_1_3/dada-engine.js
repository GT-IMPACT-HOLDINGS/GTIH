/**
 * Lexiom DaDa Engine (look-and-feel only).
 * Produces UI instructions from semantic/system cues without mutating canonical
 * state, OSN content, artifact content, or provenance.
 *
 * First instruction: dropping_text — Matrix-style rain for center LCD fades.
 */
(function (global) {
  "use strict";

  var MATRIX_LITE_CHARS =
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
    "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ";

  // Comfort bias: L, o, v, e each appear at LOVE_WEIGHT × any other glyph.
  var LOVE_CHARS = "Love";
  var LOVE_WEIGHT = 1000000;

  function pickChar() {
    var otherCount = MATRIX_LITE_CHARS.length;
    var loveCount = LOVE_CHARS.length;
    var loveTotal = loveCount * LOVE_WEIGHT;
    var total = otherCount + loveTotal;
    var r = Math.random() * total;
    if (r < loveTotal) {
      return LOVE_CHARS.charAt(Math.min(loveCount - 1, Math.floor(r / LOVE_WEIGHT)));
    }
    return MATRIX_LITE_CHARS.charAt(Math.floor(Math.random() * otherCount));
  }

  var activeRain = null;
  var activeOutlineBreath = null;

  function prefersReducedMotion() {
    try {
      return (
        typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      );
    } catch (_error) {
      return false;
    }
  }

  /**
   * The Weatherman — fictional DaDa figure who governs rainy-season look-and-feel.
   * Does not touch canonical state; only gates when dropping_text may run.
   *
   * Standing order (relaxed weather): rainy seasons only when the player opens
   * Bud to watch the delivered SUD on the Center Playfield. Focus OSN changes,
   * other section glyphs, and presentation-mode fades stay dry.
   *
   * Bud rainy season lasts twice the ordinary fadeOut+fadeIn envelope so the
   * player can see the rain clearly across fade-out, the 2-LCD rain-only hold,
   * and fade-in.
   */
  var theWeatherman = {
    name: "theWeatherman",
    /**
     * @param {{ cue?: string, fadeKind?: string }} ctx
     * @returns {boolean}
     */
    allowsRainySeason: function (ctx) {
      var context = ctx || {};
      if (context.cue !== "center_fade") {
        return false;
      }
      return context.fadeKind === "bud_open";
    },
    /**
     * Rain duration multiplier for an authorized rainy season.
     * Bud opens run at 2× the ordinary fadeOut+fadeIn envelope.
     * @param {{ fadeKind?: string }} ctx
     * @returns {number}
     */
    rainySeasonDurationScale: function (ctx) {
      var context = ctx || {};
      return context.fadeKind === "bud_open" ? 2 : 1;
    },
  };

  function parseCssColorToRgb(color) {
    if (!color || color === "transparent" || color === "rgba(0, 0, 0, 0)") {
      return null;
    }
    var canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    var ctx2d = canvas.getContext("2d");
    if (!ctx2d) {
      return null;
    }
    ctx2d.fillStyle = "#000";
    ctx2d.fillStyle = color;
    var computed = ctx2d.fillStyle;
    if (typeof computed !== "string") {
      return null;
    }
    var rgb = computed.match(
      /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/
    );
    if (!rgb) {
      // Modern browsers may return #rrggbb
      var hex = computed.match(/^#([0-9a-f]{6})$/i);
      if (hex) {
        var n = parseInt(hex[1], 16);
        return {
          r: (n >> 16) & 255,
          g: (n >> 8) & 255,
          b: n & 255,
        };
      }
      return null;
    }
    return {
      r: Math.round(Number(rgb[1])),
      g: Math.round(Number(rgb[2])),
      b: Math.round(Number(rgb[3])),
    };
  }

  function readPlayfieldOutlineRgb(el) {
    if (!el || !global.getComputedStyle) {
      return { r: 77, g: 170, b: 252 };
    }
    var style = global.getComputedStyle(el);
    var candidates = [
      style.borderInlineEndColor,
      style.borderRightColor,
      style.borderTopColor,
      style.outlineColor,
      style.getPropertyValue("--lexiom-13-wireframe"),
      style.getPropertyValue("--lexiom-frame"),
    ];
    var i;
    for (i = 0; i < candidates.length; i += 1) {
      var rgb = parseCssColorToRgb(String(candidates[i] || "").trim());
      if (rgb) {
        return rgb;
      }
    }
    return { r: 77, g: 170, b: 252 };
  }

  /**
   * Propose outline breath for OSN transitions: current color → transparent → current
   * via inverted half-sine (1 − sin(πt)).
   */
  function proposeOutlineBreath(ctx) {
    var context = ctx || {};
    if (context.cue !== "center_fade" || context.fadeKind !== "osn_transition") {
      return null;
    }
    if (prefersReducedMotion()) {
      return null;
    }
    var fadeOutMs = typeof context.fadeOutMs === "number" ? context.fadeOutMs : 0;
    var fadeInMs = typeof context.fadeInMs === "number" ? context.fadeInMs : 0;
    var durationMs = Math.max(0, fadeOutMs + fadeInMs);
    if (durationMs <= 0) {
      return null;
    }
    return {
      type: "outline_breath",
      surface: "center_playfield",
      durationMs: durationMs,
    };
  }

  function stopOutlineBreath() {
    if (!activeOutlineBreath) {
      return;
    }
    if (activeOutlineBreath.rafId != null) {
      global.cancelAnimationFrame(activeOutlineBreath.rafId);
    }
    if (activeOutlineBreath.stopTimeoutId != null) {
      global.clearTimeout(activeOutlineBreath.stopTimeoutId);
    }
    var el = activeOutlineBreath.el;
    if (el) {
      el.classList.remove("lexiom-dada-outline-breathing");
      el.style.outlineColor = "";
      el.style.outlineWidth = "";
      el.style.outlineStyle = "";
      el.style.outlineOffset = "";
    }
    activeOutlineBreath = null;
  }

  function mountOutlineBreath(playfieldEl, instr) {
    stopOutlineBreath();
    if (!playfieldEl || !instr || instr.type !== "outline_breath") {
      return;
    }
    if (prefersReducedMotion()) {
      return;
    }

    var rgb = readPlayfieldOutlineRgb(playfieldEl);
    var durationMs =
      typeof instr.durationMs === "number" ? instr.durationMs : 0;
    var startTs = 0;
    var width =
      global.getComputedStyle(playfieldEl).getPropertyValue("--lexiom-13-wireframe-width") ||
      "1px";

    playfieldEl.classList.add("lexiom-dada-outline-breathing");
    playfieldEl.style.outlineStyle = "solid";
    playfieldEl.style.outlineWidth = String(width).trim() || "1px";
    playfieldEl.style.outlineOffset = "-1px";
    playfieldEl.style.outlineColor =
      "rgba(" + rgb.r + ", " + rgb.g + ", " + rgb.b + ", 1)";

    function frame(ts) {
      if (!activeOutlineBreath || activeOutlineBreath.el !== playfieldEl) {
        return;
      }
      if (!startTs) {
        startTs = ts;
      }
      var progress =
        durationMs > 0
          ? Math.min(1, Math.max(0, (ts - startTs) / durationMs))
          : 1;
      // Current color → transparent → current color (half-wave).
      var alpha = 1 - Math.sin(Math.PI * progress);
      playfieldEl.style.outlineColor =
        "rgba(" + rgb.r + ", " + rgb.g + ", " + rgb.b + ", " + alpha + ")";
      if (progress < 1) {
        activeOutlineBreath.rafId = global.requestAnimationFrame(frame);
      }
    }

    activeOutlineBreath = {
      el: playfieldEl,
      rafId: null,
      stopTimeoutId: null,
    };
    activeOutlineBreath.rafId = global.requestAnimationFrame(frame);

    if (durationMs > 0) {
      activeOutlineBreath.stopTimeoutId = global.setTimeout(function () {
        stopOutlineBreath();
      }, durationMs + 32);
    }
  }

  /**
   * Propose a dropping_text instruction for a center-fade cue.
   * @param {{ cue?: string, fadeKind?: string, durationScale?: number, fadeOutMs?: number, fadeInMs?: number, fadeHoldMs?: number }} ctx
   * @returns {object|null}
   */
  function proposeDroppingText(ctx) {
    var context = ctx || {};
    if (!theWeatherman.allowsRainySeason(context)) {
      return null;
    }
    if (prefersReducedMotion()) {
      return null;
    }
    var fadeOutMs = typeof context.fadeOutMs === "number" ? context.fadeOutMs : 0;
    var fadeInMs = typeof context.fadeInMs === "number" ? context.fadeInMs : 0;
    var fadeHoldMs = typeof context.fadeHoldMs === "number" ? context.fadeHoldMs : 0;
    var baseMs = Math.max(0, fadeOutMs + fadeInMs);
    if (baseMs <= 0) {
      return null;
    }
    var seasonScale = theWeatherman.rainySeasonDurationScale(context);
    // Doubled (or scaled) envelope, and never shorter than fade-out + hold + fade-in.
    var durationMs = Math.max(baseMs * seasonScale, fadeOutMs + fadeHoldMs + fadeInMs);
    var durationScale =
      typeof context.durationScale === "number" ? context.durationScale : 1;
    var intensity = Math.max(0.25, Math.min(1, durationScale));
    return {
      type: "dropping_text",
      surface: "center_activity",
      durationMs: durationMs,
      intensity: intensity,
      charset: "matrix_lite",
      palette: "cockpit_cyan",
      authorizedBy: theWeatherman.name,
      seasonScale: seasonScale,
    };
  }

  function stopDroppingText() {
    if (!activeRain) {
      return;
    }
    if (activeRain.rafId != null) {
      global.cancelAnimationFrame(activeRain.rafId);
    }
    if (activeRain.stopTimeoutId != null) {
      global.clearTimeout(activeRain.stopTimeoutId);
    }
    if (activeRain.resizeObserver) {
      try {
        activeRain.resizeObserver.disconnect();
      } catch (_error) {
        // ignore
      }
    }
    if (activeRain.host && activeRain.host.parentNode) {
      activeRain.host.parentNode.removeChild(activeRain.host);
    }
    activeRain = null;
  }

  /**
   * Mount Matrix-style dropping text on a host container for instr.durationMs.
   * @param {HTMLElement} hostEl
   * @param {object} instr
   */
  function mountDroppingText(hostEl, instr) {
    stopDroppingText();
    if (!hostEl || !instr || instr.type !== "dropping_text") {
      return;
    }
    if (prefersReducedMotion()) {
      return;
    }

    var wrap = document.createElement("div");
    wrap.className = "lexiom-dada-dropping-text";
    wrap.setAttribute("aria-hidden", "true");

    var canvas = document.createElement("canvas");
    canvas.className = "lexiom-dada-dropping-text-canvas";
    wrap.appendChild(canvas);
    hostEl.appendChild(wrap);

    var ctx2d = canvas.getContext("2d");
    if (!ctx2d) {
      if (wrap.parentNode) {
        wrap.parentNode.removeChild(wrap);
      }
      return;
    }

    var intensity = typeof instr.intensity === "number" ? instr.intensity : 0.6;
    var durationMs =
      typeof instr.durationMs === "number" ? instr.durationMs : 0;
    var fontSize = 14;
    var columns = [];
    var lastTs = 0;
    var startTs = 0;
    // Pale purple season peak (aligned with draft-edit presentation).
    var headRgb = "201, 182, 232";
    var trailRgb = "160, 130, 210";

    function resize() {
      var width = Math.max(1, hostEl.clientWidth || 1);
      var height = Math.max(1, hostEl.clientHeight || 1);
      var dpr = Math.min(global.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);

      // 10× baseline column spacing (was 5×; doubled again on request).
      var density = 10;
      var colWidth = Math.max(fontSize * 0.95, 12) / density;
      var count = Math.max(8 * density, Math.floor(width / colWidth));
      var next = [];
      var i;
      for (i = 0; i < count; i += 1) {
        next.push({
          x: i * colWidth + colWidth * 0.2,
          y: Math.random() * height,
          speed: (28 + Math.random() * 70) * (0.55 + intensity * 0.7),
          trail: 8 + Math.floor(Math.random() * 14),
          cells: [],
          changeAcc: Math.random() * 0.04,
        });
      }
      columns = next;
    }

    resize();

    function frame(ts) {
      if (!activeRain || activeRain.host !== wrap) {
        return;
      }
      if (!startTs) {
        startTs = ts;
      }
      if (!lastTs) {
        lastTs = ts;
      }
      var dt = Math.min(0.05, (ts - lastTs) / 1000);
      lastTs = ts;

      // Half-sine envelope: transparent → purple peak → transparent (rainy↔dry).
      var progress =
        durationMs > 0 ? Math.min(1, Math.max(0, (ts - startTs) / durationMs)) : 1;
      var season = Math.sin(Math.PI * progress);

      var width = hostEl.clientWidth || 1;
      var height = hostEl.clientHeight || 1;

      ctx2d.clearRect(0, 0, width, height);

      if (season <= 0.001) {
        activeRain.rafId = global.requestAnimationFrame(frame);
        return;
      }

      ctx2d.font =
        '500 ' +
        fontSize +
        'px "JetBrains Mono", Consolas, "Cascadia Code", monospace';
      ctx2d.textBaseline = "top";

      var i;
      var j;
      // Glyph refresh was ~every frame (~60 Hz); 50% slower → ~30 Hz.
      var charChangePeriod = (1 / 60) * 2;
      for (i = 0; i < columns.length; i += 1) {
        var col = columns[i];
        col.y += col.speed * dt;
        if (col.y - col.trail * fontSize > height) {
          col.y = -Math.random() * height * 0.35;
          col.speed = (28 + Math.random() * 70) * (0.55 + intensity * 0.7);
          col.trail = 8 + Math.floor(Math.random() * 14);
          col.cells = [];
        }
        if (!col.cells) {
          col.cells = [];
        }
        while (col.cells.length < col.trail) {
          col.cells.push(pickChar());
        }
        if (col.cells.length > col.trail) {
          col.cells.length = col.trail;
        }

        col.changeAcc = (col.changeAcc || 0) + dt;
        if (col.changeAcc >= charChangePeriod) {
          col.changeAcc -= charChangePeriod;
          col.cells[0] = pickChar();
          for (j = 1; j < col.cells.length; j += 1) {
            if (Math.random() < 0.36) {
              col.cells[j] = pickChar();
            }
          }
        }

        for (j = 0; j < col.trail; j += 1) {
          var gy = col.y - j * fontSize;
          if (gy < -fontSize || gy > height) {
            continue;
          }
          var isHead = j === 0;
          var baseAlpha = isHead
            ? 0.55 + intensity * 0.35
            : Math.max(0.04, (1 - j / col.trail) * 0.28 * intensity);
          var alpha = baseAlpha * season;
          ctx2d.fillStyle =
            "rgba(" + (isHead ? headRgb : trailRgb) + ", " + alpha + ")";
          ctx2d.fillText(col.cells[j] || pickChar(), col.x, gy);
        }
      }

      activeRain.rafId = global.requestAnimationFrame(frame);
    }

    var resizeObserver = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(function () {
        if (activeRain && activeRain.host === wrap) {
          resize();
        }
      });
      resizeObserver.observe(hostEl);
    }

    activeRain = {
      host: wrap,
      rafId: null,
      stopTimeoutId: null,
      resizeObserver: resizeObserver,
    };

    activeRain.rafId = global.requestAnimationFrame(frame);

    if (durationMs > 0) {
      activeRain.stopTimeoutId = global.setTimeout(function () {
        stopDroppingText();
      }, durationMs);
    }
  }

  global.lexiom13DadaEngine = {
    theWeatherman: theWeatherman,
    proposeDroppingText: proposeDroppingText,
    mountDroppingText: mountDroppingText,
    stopDroppingText: stopDroppingText,
    proposeOutlineBreath: proposeOutlineBreath,
    mountOutlineBreath: mountOutlineBreath,
    stopOutlineBreath: stopOutlineBreath,
  };
})(typeof window !== "undefined" ? window : this);
