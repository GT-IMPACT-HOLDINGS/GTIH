(function () {
  "use strict";

  function t(key) {
    return window.lexiomI18n && window.lexiomI18n.t ? window.lexiomI18n.t(key) : key;
  }

  var PROFILE_STORAGE_KEY = "lexiom_first_entry_profile_v1";
  var LANDING_STATE_STORAGE_KEY = "lexiom_first_entry_state_v1";
  var LANDING_EVENT_QUEUE_KEY = "lexiom_landing_event_queue_v1";
  /** Max length for auto-generated onboarding identity text persisted to profile. */
  var LANDING_DRAFT_IDENTITY_MAX_CHARS = 1000;

  function clampDraftIdentity(text) {
    var s = String(text || "");
    if (s.length <= LANDING_DRAFT_IDENTITY_MAX_CHARS) return s;
    return s.slice(0, LANDING_DRAFT_IDENTITY_MAX_CHARS);
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function safeJsonParse(text, fallback) {
    try {
      return JSON.parse(text);
    } catch (_) {
      return fallback;
    }
  }

  function readLocalJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return safeJsonParse(raw, fallback);
    } catch (_) {
      return fallback;
    }
  }

  function writeLocalJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {
      // no-op
    }
  }

  function queueLandingEvent(name, payload) {
    var queue = readLocalJson(LANDING_EVENT_QUEUE_KEY, []);
    queue.push({
      name: name,
      ts: nowIso(),
      payload: payload || {},
    });
    writeLocalJson(LANDING_EVENT_QUEUE_KEY, queue);
  }

  function showError(msg) {
    var el = byId("landing-error");
    if (!el) return;
    el.hidden = false;
    el.textContent = msg;
  }

  function clearError() {
    var el = byId("landing-error");
    if (!el) return;
    el.hidden = true;
    el.textContent = "";
  }

  /** Footer progress compressed to 0/3–3/3 across onboarding states. */
  var LANDING_PROGRESS_NUM = [0, 1, 2, 2, 3, 3];
  var LANDING_PROGRESS_DENOMINATOR = 3;

  function updateLandingFooterProgress(stepNum) {
    var status = byId("landing-status");
    if (!status) return;
    var i = Math.max(0, Math.min(5, stepNum | 0));
    var n = LANDING_PROGRESS_NUM[i];
    status.textContent = n + "/" + LANDING_PROGRESS_DENOMINATOR + " — " + t("landing_progress_" + i);
  }

  var STEP_HEADING_ACTIVE_GLYPH = {
    1: "◉",
    2: "②",
    3: "②",
    4: "③",
  };
  var STEP_HEADING_EMPTY_GLYPH = "◯";
  var STEP_HEADING_INTERACTED = { 1: false, 2: false, 4: false };

  function stripLeadingHeadingGlyph(text) {
    return String(text || "").replace(/^\s*[◯◉⓪①②③④⑤⑥⑦⑧⑨⑩]\s*/, "").trim();
  }

  function updateStepHeadingGlyph(stepNum) {
    var heading = byId("landing-step-" + stepNum);
    if (!heading) return;
    var titleEl = heading.querySelector(".lexiom-onboarding-heading[data-i18n]");
    if (!titleEl) return;
    var base = titleEl.getAttribute("data-base-heading");
    if (!base) {
      base = stripLeadingHeadingGlyph(titleEl.textContent);
      titleEl.setAttribute("data-base-heading", base);
    }
    var glyph = STEP_HEADING_INTERACTED[stepNum] ? STEP_HEADING_ACTIVE_GLYPH[stepNum] : STEP_HEADING_EMPTY_GLYPH;
    titleEl.textContent = glyph + " " + base;
  }

  function refreshAllStepHeadingGlyphs() {
    [1, 2, 4].forEach(updateStepHeadingGlyph);
  }

  function markStepInteracted(stepNum) {
    if (!STEP_HEADING_INTERACTED[stepNum]) {
      STEP_HEADING_INTERACTED[stepNum] = true;
      updateStepHeadingGlyph(stepNum);
    }
  }

  /** Role-based default for outbound “on behalf of” line when the draft is cleared (approve step). */
  function defaultPrincipalForRole(roleName) {
    var r = String(roleName || "").trim();
    if (r === "Lawyer") return "my client";
    if (r === "Mediator") return "the parties";
    if (r === "Sales Professional") return "my employer and our customers";
    return "";
  }

  function getLocalePrimary() {
    var loc = "en";
    try {
      if (window.lexiomI18n && typeof window.lexiomI18n.getLocale === "function") {
        loc = window.lexiomI18n.getLocale() || "en";
      }
    } catch (_) {
      loc = "en";
    }
    return String(loc).split("-")[0].toLowerCase();
  }

  function landingGt3Error(detail) {
    var base = t("landing_err_gt3_required");
    var d = String(detail || "").trim();
    if (!d) return base;
    return base + " (" + d + ")";
  }

  async function callGT3RequiredForOnboardingDraft(narrative, inferenceType) {
    if (!window.lexiomGT3 || !window.lexiomGT3.callGT3) {
      throw new Error(landingGt3Error(""));
    }
    var result = await window.lexiomGT3.callGT3(narrative, { inferenceType: inferenceType || "L24" });
    if (!result || !result.ok || typeof result.text !== "string") {
      throw new Error(landingGt3Error(result && result.error));
    }
    var text = String(result.text || "").trim();
    if (!text) throw new Error(landingGt3Error("Empty response"));
    return text;
  }

  function parsePolarTwoLines(text) {
    var s = String(text || "").trim();
    if (!s) return "";
    s = s.replace(/^```[a-zA-Z]*\s*\n?/, "").replace(/\n?```\s*$/, "");
    var lines = s.split(/\r?\n/).map(function (line) {
      return line.replace(/^\s*[-*•]\s*/, "").trim();
    }).filter(function (line) {
      return line.length > 0;
    });
    if (lines.length >= 2) return (lines[0] + "\n" + lines[1]).slice(0, 200);
    if (lines.length === 1) {
      var parts = lines[0].split(/\s*[|/—–-]\s*/).map(function (x) {
        return x.trim();
      }).filter(Boolean);
      if (parts.length >= 2) return (parts[0] + "\n" + parts[1]).slice(0, 200);
    }
    return "";
  }

  /**
   * Ask GT3 for two contrasting outbound-reference poles derived from profession + profile context.
   * Output must be exactly two lines (GT3 LANGUAGE suffix sets locale).
   */
  async function inferOutboundPolarDraft(roleName, valueProposition, draftIdentity) {
    var r = String(roleName || "").trim();
    var vp = String(valueProposition || "").trim();
    var id = String(draftIdentity || "").trim();
    var lines = [
      "You are Lexiom, a profile-shaped strategic advisor for a new player completing Lexiom first-entry onboarding.",
      "",
      "The player selected this professional role (fixed enum from UI):",
      r || "(unknown)",
      "",
      "Their strategic value proposition (free text):",
      vp || "(none)",
      "",
      "Their approved draft identity statement (first-person, may be long):",
      id || "(none)",
      "",
      "TASK:",
      "- Propose exactly TWO short polar reference phrases Lexiom should use when drafting outbound letters/emails/formal text on the player's behalf.",
      "- Derive both poles from THIS profession and the player's value proposition + identity (do not use unrelated clichés).",
      "- Line 1 = pole A (primary \"on behalf of\" leaning). Line 2 = pole B (contrasting stakeholder / tension).",
      "- Each line: max ~8 words in the output language. No bullets, no numbering, no quotes.",
      "- Output format: EXACTLY two lines separated by a single newline. No other text before or after.",
      "",
      "OUTPUT:",
      "- Two lines only.",
    ];
    var narrative = lines.join("\n");
    var raw = await callGT3RequiredForOnboardingDraft(narrative, "L24");
    var parsed = parsePolarTwoLines(raw);
    if (!parsed) {
      throw new Error(landingGt3Error("Malformed two-line output"));
    }
    return parsed;
  }

  /** Turn draft (one or two lines) into one phrase for profile / headers (max 200). */
  function normalizePrincipalDraft(raw) {
    var s = String(raw || "").trim();
    if (!s) return "";
    return s
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map(function (line) {
        return line.trim();
      })
      .filter(function (line) {
        return line.length > 0;
      })
      .join(" — ")
      .replace(/\s{2,}/g, " ")
      .slice(0, 200);
  }

  function setStep(stepNum) {
    [0, 1, 2, 3, 4, 5].forEach(function (n) {
      var el = byId("landing-step-" + n);
      if (el) el.hidden = n !== stepNum;
    });
    var titleEl = document.querySelector(".lexiom-top-hud-l1[data-i18n='landing_welcome_title']");
    if (titleEl) {
      if (stepNum === 5) {
        titleEl.textContent = "A well©m message from GT Impact Holdings";
      } else {
        titleEl.textContent = t("landing_welcome_title");
      }
    }
    var entryBtn = byId("landing-mode-zenith");
    if (entryBtn) {
      entryBtn.innerHTML = "<strong>Enter</strong> the <strong>Lexiom</strong>";
    }
    updateLandingFooterProgress(stepNum);
  }

  async function inferDraftIdentity(role, valueProposition) {
    var vp = (valueProposition || "").trim();
    var r = (role || "").trim();
    var header = "You are Lexiom, a profile-shaped strategic advisor for a new player entering the Lexiom cabinet.";
    var lines = [
      header,
      "",
      "The player has selected this professional role:",
      r || "(unspecified role)",
      "",
      "The player described their unique strategic value proposition in their professional world as:",
      vp || "(no value proposition provided; infer a gentle, generic but dignified stance).",
      "",
      "TASK:",
      "- Draft a single first-person identity statement the player can approve as their Lexiom profile.",
      "- Length: 20–25 words only (strict). One or two short sentences.",
      "- Tone: calm, confident, service-oriented, strategically reflective.",
      "- The statement must sound like the player describing themselves (\"I ...\"), not you describing them.",
      "- Explicitly connect their value proposition to how they create value for others.",
      "- Make it suitable as a stable cross-case profile inside Lexiom.",
      "",
      "OUTPUT:",
      "- Return only the identity statement text (no bullets, no headings, no quotes)."
    ];
    var narrative = lines.join("\n");
    return await callGT3RequiredForOnboardingDraft(narrative, "L24");
  }

  /**
   * Maps step-1 role to the "XXX" in "Arcade-style CRM for XXX Making".
   * Non-professionals use a fixed welcome line instead (see inferWelcomeMessage).
   */
  function lexiomMakingPhraseForRole(role) {
    var r = String(role || "").trim();
    if (r === "Lawyer") return "legal-making";
    if (r === "Mediator") return "mediation-making";
    if (r === "Sales Professional") return "sales-making";
    return "structured-making";
  }

  /** Hebrew gloss for product framing in offline welcome (no English slugs in UI). */
  function lexiomMakingPhraseHebrew(role) {
    var r = String(role || "").trim();
    if (r === "Lawyer") return "עשייה משפטית";
    if (r === "Mediator") return "עשייה בגישור";
    if (r === "Sales Professional") return "עשייה במכירות";
    return "עשייה מובנית";
  }

  /** Remove trailing GT3 in-band token if present (matches server extractAndStripInBand behavior). */
  function stripLexiomInferenceDisplaySuffix(text) {
    var trimmed = String(text || "").trimEnd();
    var tokens = trimmed.split(/\s+/).filter(Boolean);
    if (!tokens.length) return trimmed;
    var lastToken = tokens[tokens.length - 1];
    if (lastToken && lastToken.charAt(0) === "_" && lastToken.length <= 120) {
      var cut = trimmed.lastIndexOf(lastToken);
      if (cut >= 0) return trimmed.slice(0, cut).trimEnd();
    }
    return trimmed;
  }

  function inferWelcomeMessageFallback(roleName) {
    var r = String(roleName || "").trim();
    var isNonPro = r === "Non-Professional";
    var makingPhrase = lexiomMakingPhraseForRole(r);
    if (isNonPro) {
      return (
        "Welcome. Lexiom aligns guidance to your approved profile, expands your value proposition, and advances structured reasoning through explicit, approval-driven play."
      );
    }
    return (
      "Welcome " +
      ". Lexiom aligns guidance to your approved profile, expands your value proposition, and supports " +
      makingPhrase +
      " through explicit, approval-driven structured play."
    );
  }

  async function inferWelcomeMessage(role, draftIdentity) {
    var r = (role || "").trim();
    var idText = (draftIdentity || "").trim();
    var isNonPro = r === "Non-Professional";
    var makingPhrase = lexiomMakingPhraseForRole(r);
    var header =
      "You are Lexiom, a profile-shaped strategic advisor welcoming a new player who has just approved their identity statement.";
    var lines;
    if (isNonPro) {
      lines = [
        header,
        "",
        "The approved identity statement (first-person) is:",
        idText || "(none)",
        "",
        "The player chose the role: Non-Professional (not Lawyer, Mediator, or Sales Professional).",
        "",
        "TASK:",
        "- Write a short second-person welcome message addressed to this player as they enter Lexiom.",
        "- Tone: warm, concise, game-aware, identity-affirming.",
        "- Acknowledge their approved identity and that Lexiom will help them expand their value proposition.",
        "- You MUST include this exact sentence verbatim (punctuation as shown): Lexiom is an arcade for structured reasoning.",
        "- Mention that approvals move state forward (no silent changes).",
        "- Length: exactly 20 words total.",
        "",
        "OUTPUT:",
        "- Return only one sentence, exactly 20 words (no headings, no labels, no bullets).",
        "- Output language: English only, regardless of browser locale."
      ];
    } else {
      lines = [
        header,
        "",
        "The approved identity statement (first-person) is:",
        idText || "(none)",
        "",
        "The player's selected professional role label is:",
        r || "(unspecified role)",
        "",
        "Lexiom product framing for this player:",
        "- Present Lexiom as an arcade-style CRM for " + makingPhrase + " (i.e. CRM for \"" + makingPhrase + "\" making — use natural wording in the message).",
        "- The \"" + makingPhrase + "\" segment reflects their profile; weave it into one clear clause.",
        "",
        "TASK:",
        "- Write a short second-person welcome message addressed to this player as they enter Lexiom.",
        "- Tone: warm, concise, game-aware, identity-affirming.",
        "- Explicitly acknowledge who they told you they are and that Lexiom will help expand their value proposition.",
        "- In one short clause, define Lexiom as an arcade-style CRM tailored to " + makingPhrase + " (same meaning as CRM for " + makingPhrase + " making).",
        "- Mention that approvals move state forward (no silent changes).",
        "- Length: exactly 20 words total.",
        "- Output language: English only, regardless of browser locale."
      ];
      lines.push(
        "",
        "OUTPUT:",
        "- Return only one sentence, exactly 20 words (no headings like \"Welcome and mode entry\", no labels, no bullets)."
      );
    }
    var narrative = lines.join("\n");
    if (!window.lexiomGT3 || !window.lexiomGT3.callGT3) {
      return inferWelcomeMessageFallback(r);
    }
    try {
      var result = await window.lexiomGT3.callGT3(narrative, { inferenceType: "L24", outputLanguage: "en-US" });
      if (result && result.ok && typeof result.text === "string") {
        return stripLexiomInferenceDisplaySuffix(result.text.trim());
      }
    } catch (_) {
      // fall through
    }
    return inferWelcomeMessageFallback(r);
  }

  function redirectToSpa(args) {
    var params = new URLSearchParams();
    params.set("source", "landing");
    if (args && args.returning) params.set("returning", "1");
    if (args && args.mode) params.set("mode", args.mode);
    if (args && args.skipIntro) {
      params.set("skipIntro", "1");
      try {
        window.sessionStorage.setItem("lexiom_gradual_cockpit_v1", "1");
      } catch (_) {
        /* ignore */
      }
    }
    params.set("handoff", String(Date.now()));
    if (args && args.returning) {
      window.location.href = "/gt2/Lexiom/index.html?" + params.toString();
      return;
    }
    if (args && args.mode) {
      window.location.href = "/gt2/Lexiom/case-create.html?" + params.toString();
      return;
    }
    window.location.href = "/gt2/Lexiom/index.html?" + params.toString();
  }

  function shuffleArray(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function collectLandingFadeTargets() {
    var cabinet = byId("lexiom-cabinet");
    if (!cabinet) return [];
    var header = cabinet.querySelector("header.lexiom-top-hud");
    var section = cabinet.querySelector("main.lexiom-main > section.flex-grow-1");
    var footer = cabinet.querySelector("footer.lexiom-bottom-ribbon");
    var list = [];
    if (header) list.push(header);
    if (section) list.push(section);
    if (footer) list.push(footer);
    return list;
  }

  function resolveLandingTitleImageForTheme() {
    try {
      if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
        return "Lexiom_title_80_light.png";
      }
    } catch (_) {
      /* ignore */
    }
    return "Lexiom_Title.png";
  }

  /**
   * 3s: regions fade out in random order; then 2s solid black; then Lexiom title fade-in; then redirect.
   */
  function runLandingExitTransitionThenRedirect(mode) {
    var FADE_TOTAL_MS = 3000;
    var BLACK_HOLD_MS = 2000;
    var TITLE_IN_MS = 3000;
    var TITLE_HOLD_MS = 3000;
    var FADE_TO_SOLID_MS = 3000;
    var targets = shuffleArray(collectLandingFadeTargets());
    if (!targets.length) {
      redirectToSpa({ mode: mode, skipIntro: true });
      return;
    }
    var slotMs = Math.max(1, Math.floor(FADE_TOTAL_MS / targets.length));
    document.body.style.overflow = "hidden";
    targets.forEach(function (el) {
      if (el && el.style) el.style.opacity = "1";
    });
    targets.forEach(function (el, orderIdx) {
      if (!el || !el.style) return;
      el.style.transitionProperty = "opacity";
      el.style.transitionDuration = slotMs + "ms";
      el.style.transitionTimingFunction = "ease-in-out";
      el.style.transitionDelay = orderIdx * slotMs + "ms";
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          el.style.opacity = "0";
        });
      });
    });
    window.setTimeout(function () {
      var root = byId("landing-exit-root");
      if (root) {
        root.hidden = false;
        root.setAttribute("aria-hidden", "false");
        var isLight = false;
        try {
          isLight = !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches);
        } catch (_) {
          isLight = false;
        }
        root.style.background = isLight ? "#ffffff" : "#000000";
      }
      var titleImg = byId("landing-exit-title");
      if (titleImg) {
        titleImg.src = resolveLandingTitleImageForTheme();
      }
    }, FADE_TOTAL_MS);
    window.setTimeout(function () {
      var titleImg = byId("landing-exit-title");
      if (titleImg) {
        requestAnimationFrame(function () {
          titleImg.classList.add("landing-exit-title-visible");
        });
      }
    }, FADE_TOTAL_MS + BLACK_HOLD_MS);
    window.setTimeout(function () {
      var titleImg = byId("landing-exit-title");
      if (titleImg) {
        titleImg.style.transitionDuration = FADE_TO_SOLID_MS + "ms";
        requestAnimationFrame(function () {
          titleImg.classList.remove("landing-exit-title-visible");
        });
      }
    }, FADE_TOTAL_MS + BLACK_HOLD_MS + TITLE_IN_MS + TITLE_HOLD_MS);
    window.setTimeout(function () {
      redirectToSpa({ mode: mode, skipIntro: true });
    }, FADE_TOTAL_MS + BLACK_HOLD_MS + TITLE_IN_MS + TITLE_HOLD_MS + FADE_TO_SOLID_MS);
  }

  function init() {
    var role = "";
    var valueProposition = "";
    var draft = "";
    var principalLabel = "";
    var landingExitInProgress = false;

    if (window.lexiomI18n && typeof window.lexiomI18n.applyI18n === "function") {
      window.lexiomI18n.applyI18n();
    }
    refreshAllStepHeadingGlyphs();

    [1, 2, 3, 4].forEach(function (n) {
      var section = byId("landing-step-" + n);
      if (!section) return;
      section.addEventListener("click", function (evt) {
        var target = evt && evt.target;
        if (target && target.closest && target.closest("button")) {
          markStepInteracted(n);
        }
      });
      section.addEventListener("input", function (evt) {
        var target = evt && evt.target;
        if (!target) return;
        var tag = String(target.tagName || "").toLowerCase();
        if (tag === "textarea" || tag === "input" || target.isContentEditable) {
          markStepInteracted(n);
        }
      });
    });

    queueLandingEvent("landing_opened", { path: window.location.pathname });

    var saved = readLocalJson(LANDING_STATE_STORAGE_KEY, null);
    if (saved && typeof saved === "object") {
      role = saved.role || "";
      valueProposition = saved.valueProposition || "";
      draft = clampDraftIdentity(saved.draft || "");
      principalLabel = typeof saved.principalLabel === "string" ? saved.principalLabel : "";
    }

    byId("landing-btn-new").onclick = function () {
      clearError();
      queueLandingEvent("landing_newcomer_start", {});
      setStep(1);
    };

    byId("landing-btn-returning").onclick = function () {
      clearError();
      queueLandingEvent("landing_redirect_spa", { returning: true });
      redirectToSpa({ returning: true });
    };

    var roleButtons = Array.prototype.slice.call(document.querySelectorAll(".landing-role-btn"));
    roleButtons.forEach(function (btn) {
      btn.onclick = function () {
        role = String(btn.getAttribute("data-role") || "").trim();
        roleButtons.forEach(function (x) { x.classList.remove("is-selected"); });
        btn.classList.add("is-selected");
        byId("landing-step-1-next").disabled = !role;
        writeLocalJson(LANDING_STATE_STORAGE_KEY, {
          role: role,
          valueProposition: valueProposition,
          draft: draft,
          principalLabel: principalLabel,
          updatedAt: nowIso(),
        });
      };
      if (role && btn.getAttribute("data-role") === role) {
        btn.classList.add("is-selected");
      }
    });
    byId("landing-step-1-next").disabled = !role;
    byId("landing-step-1-next").onclick = function () {
      setStep(2);
      byId("landing-value-input").value = valueProposition;
    };

    byId("landing-step-2-back").onclick = function () {
      setStep(1);
    };
    byId("landing-step-2-next").onclick = async function () {
      clearError();
      valueProposition = String(byId("landing-value-input").value || "").trim();
      if (!valueProposition) {
        showError(t("landing_err_value_proposition"));
        return;
      }
      try {
        draft = clampDraftIdentity(await inferDraftIdentity(role, valueProposition));
      } catch (e) {
        showError(String((e && e.message) || t("landing_err_gt3_required")));
        return;
      }
      writeLocalJson(LANDING_STATE_STORAGE_KEY, {
        role: role,
        valueProposition: valueProposition,
        draft: draft,
        principalLabel: principalLabel,
        updatedAt: nowIso(),
      });
      setStep(4);
      var nextBtn = byId("landing-step-2-next");
      if (nextBtn) nextBtn.disabled = true;
      var saved = String(principalLabel || "").trim();
      var principalDraft = "";
      if (saved) {
        principalDraft = saved.slice(0, 200);
      } else {
        try {
          principalDraft = await inferOutboundPolarDraft(role, valueProposition, draft);
        } catch (e) {
          showError(String((e && e.message) || t("landing_err_gt3_required")));
          if (nextBtn) nextBtn.disabled = false;
          return;
        }
      }
      principalLabel = String(principalDraft || "").trim().slice(0, 200);
      writeLocalJson(LANDING_STATE_STORAGE_KEY, {
        role: role,
        valueProposition: valueProposition,
        draft: draft,
        principalLabel: principalLabel,
        updatedAt: nowIso(),
      });
      var principalEl = byId("landing-principal-draft");
      if (principalEl) {
        principalEl.value = principalDraft;
      }
      if (nextBtn) nextBtn.disabled = false;
      if (window.lexiomI18n && typeof window.lexiomI18n.applyI18n === "function") {
        window.lexiomI18n.applyI18n();
        refreshAllStepHeadingGlyphs();
      }
    };

    byId("landing-step-4-back").onclick = function () {
      var principalEl = byId("landing-principal-draft");
      if (principalEl) principalLabel = String(principalEl.value || "").trim().slice(0, 200);
      writeLocalJson(LANDING_STATE_STORAGE_KEY, {
        role: role,
        valueProposition: valueProposition,
        draft: draft,
        principalLabel: principalLabel,
        updatedAt: nowIso(),
      });
      setStep(2);
      byId("landing-value-input").value = valueProposition;
    };

    byId("landing-principal-draft").addEventListener("input", function () {
      principalLabel = String(byId("landing-principal-draft").value || "").trim().slice(0, 200);
      writeLocalJson(LANDING_STATE_STORAGE_KEY, {
        role: role,
        valueProposition: valueProposition,
        draft: draft,
        principalLabel: principalLabel,
        updatedAt: nowIso(),
      });
    });

    byId("landing-step-4-approve").onclick = async function () {
      clearError();
      draft = clampDraftIdentity(String(draft || "").trim());
      if (!draft) {
        try {
          draft = clampDraftIdentity(await inferDraftIdentity(role, valueProposition));
        } catch (e) {
          showError(String((e && e.message) || t("landing_err_gt3_required")));
          return;
        }
      }
      if (!draft) {
        showError(t("landing_err_draft_empty"));
        return;
      }
      var principalEl = byId("landing-principal-draft");
      var explicitPrincipal = principalEl ? normalizePrincipalDraft(principalEl.value) : "";
      var resolvedPrincipal = explicitPrincipal;
      if (!resolvedPrincipal) {
        if (role === "Lawyer") resolvedPrincipal = "my client";
        else if (role === "Mediator") resolvedPrincipal = "the parties";
        else if (role === "Sales Professional") resolvedPrincipal = "my employer and our customers";
        else resolvedPrincipal = "";
      }
      if (resolvedPrincipal.length > 200) resolvedPrincipal = resolvedPrincipal.slice(0, 200);
      principalLabel = resolvedPrincipal;
      var profile = {
        version: 1,
        approved: true,
        approvedAt: nowIso(),
        role: role,
        valueProposition: valueProposition,
        draftIdentity: draft,
        principalLabel: resolvedPrincipal || undefined,
      };
      writeLocalJson(PROFILE_STORAGE_KEY, profile);
      writeLocalJson(LANDING_STATE_STORAGE_KEY, {
        role: role,
        valueProposition: valueProposition,
        draft: draft,
        principalLabel: principalLabel,
        updatedAt: nowIso(),
      });
      queueLandingEvent("onboarding_profile_approved", {
        role: role,
        hasValueProposition: !!valueProposition,
      });
      var welcome = byId("landing-welcome");
      welcome.textContent = await inferWelcomeMessage(role, draft);
      setStep(5);
    };

    function tryBeginLandingExit(mode) {
      if (landingExitInProgress) return;
      var profile = readLocalJson(PROFILE_STORAGE_KEY, null);
      if (!profile || !profile.approved) {
        showError(t("landing_err_approve_profile_first"));
        return;
      }
      clearError();
      landingExitInProgress = true;
      profile.mode = mode;
      profile.modeSelectedAt = nowIso();
      writeLocalJson(PROFILE_STORAGE_KEY, profile);
      queueLandingEvent("mode_selected", { mode: mode });
      queueLandingEvent("landing_redirect_spa", { returning: false, mode: mode });
      runLandingExitTransitionThenRedirect(mode);
    }

    byId("landing-mode-zenith").onclick = function () {
      tryBeginLandingExit("ZENITH");
    };

    setStep(0);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
