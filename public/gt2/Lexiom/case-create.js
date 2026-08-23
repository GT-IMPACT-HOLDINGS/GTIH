(function () {
  "use strict";

  var PENDING_CASE_HANDOFF_STORAGE_KEY = "lexiom_pending_case_handoff_v1";
  var LAST_CASE_INTENT_STORAGE_KEY = "lexiom_last_case_intent_v1";
  var HANDOFF_VERSION = 1;
  var MAX_TEXT_FILES = 24;
  var MAX_CHARS_PER_FILE = 120000;
  var MAX_TOTAL_CORPUS = 400000;
  var MAX_HANDOFF_CHARS = 450000;

  /** @type {FileSystemDirectoryHandle | null} */
  var pickedDirHandle = null;
  var pickedFileCount = null;
  /** @type {{ name:string }[]} */
  var pickedFileMeta = [];

  function t(key) {
    return window.lexiomI18n && window.lexiomI18n.t ? window.lexiomI18n.t(key) : key;
  }

  function tt(key, vars) {
    var s = t(key);
    if (!vars || typeof s !== "string") return s;
    return s.replace(/\{(\w+)\}/g, function (_, k) {
      return Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : "";
    });
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function readLastCaseIntent() {
    try {
      var raw = window.localStorage.getItem(LAST_CASE_INTENT_STORAGE_KEY);
      return typeof raw === "string" ? raw.trim() : "";
    } catch (_) {
      return "";
    }
  }

  function writeLastCaseIntent(text) {
    var s = String(text || "").trim();
    if (!s) return;
    try {
      window.localStorage.setItem(LAST_CASE_INTENT_STORAGE_KEY, s);
    } catch (_) {
      // ignore storage failures
    }
  }

  function showError(msg) {
    var el = byId("case-create-error");
    if (!el) return;
    if (!msg) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.hidden = false;
    el.textContent = msg;
  }

  function setBusy(on) {
    var el = byId("case-create-busy");
    if (!el) return;
    el.hidden = !on;
    var btn = byId("case-create-enter");
    if (btn) btn.disabled = !!on;
  }

  function hasEntrySignal() {
    var intentEl = byId("case-create-intent");
    var hasIntent = !!(intentEl && String(intentEl.value || "").trim());
    return hasIntent || !!pickedDirHandle;
  }

  function updateEnterVisibility() {
    var canEnter = hasEntrySignal();
    var row = byId("case-create-actions-row");
    var btn = byId("case-create-enter");
    if (row) row.hidden = !canEnter;
    if (btn) btn.hidden = !canEnter;
  }

  function onIntentKeyDown(evt) {
    if (!evt || evt.key !== "Tab") return;
    var intentEl = byId("case-create-intent");
    if (!intentEl) return;
    var current = String(intentEl.value || "");
    if (current.trim()) return;
    var ph = String(intentEl.placeholder || "").trim();
    if (!ph) return;
    evt.preventDefault();
    intentEl.value = ph;
    updateEnterVisibility();
    try {
      var pos = intentEl.value.length;
      intentEl.setSelectionRange(pos, pos);
    } catch (_) {
      // no-op for unsupported environments
    }
  }

  function hasFsAccess() {
    return typeof window.showDirectoryPicker === "function";
  }

  function isLikelySecureContext() {
    // Localhost is treated as secure by browsers even on http.
    var host = (window.location && window.location.hostname) || "";
    return (
      !!window.isSecureContext ||
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "[::1]"
    );
  }

  function updateFsWarningVisibility() {
    var w = byId("case-create-fs-api-warning");
    if (!w) return;
    if (hasFsAccess()) {
      w.hidden = true;
      return;
    }
    w.hidden = false;
    if (!isLikelySecureContext()) {
      w.textContent =
        "Folder pick requires a secure context (HTTPS or localhost). Open Lexiom over HTTPS in Chrome/Edge, or continue with your text answer only.";
    } else {
      w.textContent = t("case_create_fs_warning");
    }
  }

  /**
   * Walk the selected folder recursively and invoke callback for each .md/.txt/.docx file.
   * @param {FileSystemDirectoryHandle} dirHandle
   * @param {(fileHandle:any, relPath:string)=>Promise<void>} onMarkdown
   * @returns {Promise<void>}
   */
  async function walkSeedTextFilesRecursive(dirHandle, onMarkdown) {
    /** @type {{ dir:any, prefix:string }[]} */
    var stack = [{ dir: dirHandle, prefix: "" }];
    while (stack.length) {
      var next = stack.pop();
      var dir = next.dir;
      var prefix = next.prefix || "";
      for await (var entry of dir.values()) {
        if (!entry || !entry.name) continue;
        var name = String(entry.name);
        var relPath = prefix ? prefix + "/" + name : name;
        if (entry.kind === "directory") {
          stack.push({ dir: entry, prefix: relPath });
          continue;
        }
        if (entry.kind !== "file") continue;
        if (!/\.(md|txt|docx)$/i.test(name)) continue;
        await onMarkdown(entry, relPath);
      }
    }
  }

  /**
   * Read supported text sources. For .docx, extract raw text via Mammoth when available.
   * @param {File} file
   * @param {string} name
   * @returns {Promise<string>}
   */
  async function readSupportedSeedText(file, name) {
    var lower = String(name || "").toLowerCase();
    if (/\.docx$/i.test(lower)) {
      try {
        if (window.mammoth && typeof window.mammoth.extractRawText === "function") {
          var ab = await file.arrayBuffer();
          var result = await window.mammoth.extractRawText({ arrayBuffer: ab });
          return result && typeof result.value === "string" ? result.value : "";
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[case-create] docx extraction failed:", e);
        return "";
      }
      return "";
    }
    return file.text();
  }

  /**
   * @param {FileSystemDirectoryHandle} dirHandle
   * @returns {Promise<{count:number, files:{name:string}[]}>}
   */
  async function scanSeedTextFilesSummary(dirHandle) {
    var count = 0;
    var files = [];
    await walkSeedTextFilesRecursive(dirHandle, async function (entry, relPath) {
      count++;
      if (files.length < MAX_TEXT_FILES) {
        files.push({ name: relPath });
      }
    });
    files.sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });
    return { count: count, files: files };
  }

  /**
   * @param {FileSystemDirectoryHandle} dirHandle
   * @returns {Promise<{ name: string, text: string }[]>}
   */
  async function collectSeedTextFiles(dirHandle) {
    var out = [];
    await walkSeedTextFilesRecursive(dirHandle, async function (entry, relPath) {
      out.push({ name: relPath, handle: entry });
    });
    out.sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });
    out = out.slice(0, MAX_TEXT_FILES);
    var results = [];
    var total = 0;
    for (var i = 0; i < out.length; i++) {
      var item = out[i];
      var file = await item.handle.getFile();
      var text = await readSupportedSeedText(file, item.name);
      var s = typeof text === "string" ? text : "";
      if (s.length > MAX_CHARS_PER_FILE) {
        s = s.slice(0, MAX_CHARS_PER_FILE);
      }
      if (total + s.length > MAX_TOTAL_CORPUS) {
        var room = MAX_TOTAL_CORPUS - total;
        if (room <= 0) break;
        s = s.slice(0, room);
      }
      total += s.length;
      results.push({ name: item.name, text: s });
      if (total >= MAX_TOTAL_CORPUS) break;
    }
    return results;
  }

  function buildCorpusMarkdown(files) {
    if (!files || !files.length) return "";
    var parts = [];
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      parts.push("## File: `" + f.name + "`\n\n" + (f.text || "").trim());
    }
    return parts.join("\n\n---\n\n");
  }

  function buildFallbackSeed(caseIntent, corpus) {
    var intent = (caseIntent || "").trim();
    var body =
      "## Your framing\n\n" +
      (intent || "(not specified)") +
      "\n\n---\n\n## Material from your case folder\n\n" +
      (corpus && corpus.trim() ? corpus.trim() : "_(no .md/.txt/.docx files read)_");
    return body;
  }

  /**
   * @param {string} caseIntent
   * @param {string} corpus
   * @returns {Promise<string>}
   */
  async function synthesizeSeedWithGt3(caseIntent, corpus) {
    var callGT3Fn = window.lexiomGT3 && window.lexiomGT3.callGT3;
    if (typeof callGT3Fn !== "function") {
      return buildFallbackSeed(caseIntent, corpus);
    }
    var intent = (caseIntent || "").trim();
    var c = (corpus || "").trim();
    var prompt =
      "You are Lexiom, an arcade engine for structured reasoning inside the Lexiom cabinet.\n\n" +
      "The player is creating a new case. Use ONLY the following inputs. Do not invent parties, facts, or documents not supported by the text.\n\n" +
      "### Player framing (open answer)\n" +
      intent +
      "\n\n" +
      "### Text sources (.md/.txt/.docx) from the chosen case folder (may be partial)\n" +
      (c || "(no files)") +
      "\n\n" +
      "TASK: Write a single cohesive **case seed narrative** in markdown suitable as the canonical working story for this matter.\n" +
      "- Prefer clear, neutral, professional language.\n" +
      "- If information is missing, say what is unknown rather than guessing.\n" +
      "- Do not include JSON or code fences unless quoting from sources.\n" +
      "OUTPUT: markdown only, no preamble.";
    try {
      var res = await callGT3Fn(prompt, { inferenceType: "L24" });
      if (res && res.ok && typeof res.text === "string") {
        var t = res.text.trim();
        if (t) return t;
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[case-create] GT3 synthesis failed:", e);
    }
    return buildFallbackSeed(caseIntent, corpus);
  }

  function persistHandoffAndNavigate(title, content, caseIntent) {
    var payload = {
      version: HANDOFF_VERSION,
      title: title || "case_seed.md",
      content: content,
      caseIntent: typeof caseIntent === "string" ? caseIntent : "",
    };
    var str = JSON.stringify(payload);
    if (str.length > MAX_HANDOFF_CHARS) {
      payload.content = payload.content.slice(0, Math.max(0, MAX_HANDOFF_CHARS - 2000));
      str = JSON.stringify(payload);
    }
    try {
      window.sessionStorage.setItem(PENDING_CASE_HANDOFF_STORAGE_KEY, str);
    } catch (e) {
      showError(t("case_create_error_storage"));
      // eslint-disable-next-line no-console
      console.error(e);
      return;
    }

    var params = new URLSearchParams(window.location.search || "");
    params.set("source", "landing");
    params.set("skipIntro", "1");
    try {
      window.sessionStorage.setItem("lexiom_gradual_cockpit_v1", "1");
    } catch (_) {
      /* ignore */
    }
    params.set("handoff", String(Date.now()));
    window.location.href = "/gt2/Lexiom/index.html?" + params.toString();
  }

  function updateFolderUi() {
    var details = byId("case-create-folder-details");
    var folderName = byId("case-create-folder-name");
    var listWrap = byId("case-create-file-list-wrap");
    var list = byId("case-create-file-list");
    if (details) details.hidden = !pickedDirHandle;
    if (pickedDirHandle) {
      if (folderName) folderName.textContent = pickedDirHandle.name || t("case_create_folder_unknown");
    }
    if (listWrap) listWrap.hidden = !pickedDirHandle;
    if (list) {
      list.textContent = "";
      if (pickedDirHandle) {
        for (var i = 0; i < pickedFileMeta.length; i++) {
          var m = pickedFileMeta[i];
          var li = document.createElement("li");
          li.textContent = tt("case_create_file_row", { name: m.name });
          list.appendChild(li);
        }
        var extra = (Number(pickedFileCount) || 0) - pickedFileMeta.length;
        if (extra > 0) {
          var more = document.createElement("li");
          more.textContent = tt("case_create_file_list_more", { count: extra });
          list.appendChild(more);
        }
      }
    }
    updateEnterVisibility();
  }

  async function onPickFolder() {
    showError("");
    if (!hasFsAccess()) {
      updateFsWarningVisibility();
      return;
    }
    try {
      // @ts-ignore — File System Access API
      pickedDirHandle = await window.showDirectoryPicker({ mode: "read" });
      var summary = await scanSeedTextFilesSummary(pickedDirHandle);
      pickedFileCount = summary.count;
      pickedFileMeta = summary.files;
      updateFolderUi();
    } catch (e) {
      if (e && e.name === "AbortError") return;
      // eslint-disable-next-line no-console
      console.warn("[case-create] folder pick failed:", e);
      showError(t("case_create_error_folder_read"));
    }
  }

  async function onEnterCabinet() {
    showError("");
    var intentEl = byId("case-create-intent");
    var caseIntent = intentEl ? String(intentEl.value || "").trim() : "";
    writeLastCaseIntent(caseIntent);

    setBusy(true);
    try {
      var corpus = "";
      if (pickedDirHandle) {
        var files = await collectSeedTextFiles(pickedDirHandle);
        corpus = buildCorpusMarkdown(files);
      }

      var seedBody = await synthesizeSeedWithGt3(caseIntent, corpus);

      persistHandoffAndNavigate("case_seed.md", seedBody, caseIntent);
    } finally {
      setBusy(false);
    }
  }

  function init() {
    var mainWrap = byId("lexiom-main-wrap");
    if (mainWrap) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          mainWrap.classList.add("lexiom-intro-done");
        });
      });
    }
    if (window.lexiomI18n && typeof window.lexiomI18n.applyI18n === "function") {
      window.lexiomI18n.applyI18n();
    }
    var intentEl = byId("case-create-intent");
    if (intentEl) {
      var remembered = readLastCaseIntent();
      intentEl.placeholder = remembered || t("case_create_step1_heading");
      intentEl.style.paddingTop = "";
      intentEl.addEventListener("input", updateEnterVisibility);
      intentEl.addEventListener("keydown", onIntentKeyDown);
    }
    updateFsWarningVisibility();

    var pick = byId("case-create-pick-folder");
    if (pick) pick.onclick = onPickFolder;
    var enter = byId("case-create-enter");
    if (enter) enter.onclick = onEnterCabinet;
    updateFolderUi();
    updateEnterVisibility();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
