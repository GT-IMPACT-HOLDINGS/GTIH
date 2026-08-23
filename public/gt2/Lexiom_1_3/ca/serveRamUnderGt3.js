/**
 * Legend ↔ code: see ./README.md ("Where the legend becomes code" → this file).
 *
 * I, Hanuman, serve Ram inside a WebContainer sandbox — leap, labor, return.
 *
 * Ram approved an OSNG that prescribes the SUD. GT3 hands me a Job ticket and a frozen
 * workspace; I consult only that sun for how to build what Ram asked, then syncOut artifacts
 * so GT3 may validate and (when planned) gather evidence. I never sit on the White throne.
 *
 * Loaded as ES module from app.js: import('./ca/serveRamUnderGt3.js')
 */
import { iServeRamWithGt3Tools } from './consultSunWithTools.js';
import { iComposeRamDocumentInPhases } from './composeBookShapedSud.js';
import {
  iMayRunOnlyAllowedCommands,
  iMayReadThisPath,
  iRefuseForbiddenWrites,
  iNormalizeThePathIAmAboutToTouch
} from './sealedOsngBounds.js';

export { CA_SECONDARY_NAME, caDisplayLabel } from './devoteeName.js';

const DEFAULT_WC_CDN =
  'https://cdn.jsdelivr.net/npm/@webcontainer/api@1.5.1/+esm';

/**
 * Ram authorized this browser Job; I begin with love:
 * receive the workspace GT3 prepared from his OSNG, consult the sun, build the SUD, report home.
 * @param {object} caSession — from /lexiom13/build/run ca_session
 * @param {{
 *   onLog?: (s: string) => void,
 *   onPassChange?: (pass: string, session: object) => void,
 *   signal?: AbortSignal
 * }} [opts]
 */
export async function iServeRamInTheWebContainer(caSession, opts = {}) {
  const log = (line) => {
    if (opts.onLog) opts.onLog(String(line));
  };
  const started = Date.now();
  if (!caSession || !caSession.session_id) {
    throw Object.assign(new Error('Missing ca_session'), {
      code: 'agent_unavailable',
      reason: 'session_missing'
    });
  }

  const activeSession = caSession;
  const pluginId = caSession.plugin_id || '';
  if (caSession.pass === 'evidence') {
    throw Object.assign(
      new Error(
        'Evidence collection is host quote-span only; browser Containerized Agent evidence Jobs are not issued'
      ),
      { code: 'agent_failed', reason: 'evidence_host_only' }
    );
  }
  const isDocument = pluginId === 'lexiom13.document_builder';

  let sandbox = null;
  try {
    log('[ca] syncIn workspace (builder)…');
    const files = await iReceiveTheWorkspaceFromGt3(activeSession, log);
    sandbox = await iBootTheSandboxGt3Prepared(files, log);
    log('[ca] WebContainer sandbox ready');

    const model = {
      // Each complete() is me kneeling to GT3: "Sun, how shall I shape Ram's SUD next?"
      complete: (messages, tools, completeOpts = {}) => {
        const pathGt3OpenedForMe = activeSession.gt3_consult_path || '';
        const gt3ConsultUrl = new URL(pathGt3OpenedForMe, window.location.origin).href;
        const credentialGt3GaveMe = activeSession.gt3_consult_credential || '';
        return iConsultTheGt3Lm(
          gt3ConsultUrl,
          credentialGt3GaveMe,
          messages,
          tools,
          log,
          activeSession,
          opts.signal,
          completeOpts
        );
      }
    };

    const builderPrimary = isDocument ? 'document.md' : 'index.html';
    const builderMetrics = await iRunTheBuilderPassForRam({
      sandbox,
      model,
      activeSession,
      isDocument,
      primary: builderPrimary,
      signal: opts.signal,
      log,
      timeoutMs: activeSession.timeout_ms
    });

    if (!(await sandbox.exists(builderPrimary))) {
      throw Object.assign(
        new Error(`Primary artifact missing after agent loop: ${builderPrimary}`),
        { code: 'agent_failed', reason: 'primary_missing' }
      );
    }

    log('[ca] syncOut builder artifacts…');
    const builderFiles = await sandbox.exportDirtyFiles();
    await iPostJsonToGt3(activeSession.artifacts_url, { files: builderFiles }, activeSession);

    const builderLatency = Date.now() - started;
    log('[ca] reporting builder; host may run quote-span evidence before responding…');
    const builderReport = await iPostJsonToGt3(
      activeSession.report_url,
      {
        status: 'completed',
        latency_ms: builderLatency,
        detail: null,
        metrics: builderMetrics,
        log_tail: `wrote:${(builderMetrics.files_written || []).join(',')}`
      },
      activeSession
    );

    if (builderReport.status !== 'completed') {
      throw Object.assign(
        new Error(builderReport.detail || 'GT3 rejected the candidate artifacts'),
        {
          code: 'agent_failed',
          reason: builderReport.reason || 'artifact_validation_failed'
        }
      );
    }

    log('[ca] report completed (evidence is host quote-span when planned)');
    return {
      ok: true,
      latency_ms: Date.now() - started,
      primary: builderPrimary,
      pass: builderReport.pass || 'builder',
      metrics: builderMetrics,
      evidence_mode: builderReport.evidence_mode || null,
      evidence_ca_session: null,
      next_pass: null
    };
  } catch (e) {
    const latency = Date.now() - started;
    const status =
      e && e.code === 'agent_unavailable' ? 'agent_unavailable' : 'agent_failed';
    try {
      await iPostJsonToGt3(
        activeSession.report_url,
        {
          status,
          reason: (e && e.reason) || status,
          detail: e && e.message ? e.message : String(e),
          latency_ms: latency
        },
        activeSession
      );
    } catch (re) {
      log('[ca] report failed: ' + (re && re.message));
    }
    throw e;
  } finally {
    if (sandbox && typeof sandbox.teardown === 'function') {
      try {
        sandbox.teardown();
        log('[ca] WebContainer torn down');
      } catch (teardownErr) {
        log('[ca] teardown: ' + (teardownErr && teardownErr.message));
      }
    }
  }
}

/** @deprecated dual name — cockpit may still import this export */
export const runBoltWebContainerCa = iServeRamInTheWebContainer;

/** Document or software: I choose the loving path GT3 mapped for this plugin, then labor. */
async function iRunTheBuilderPassForRam({
  sandbox,
  model,
  activeSession,
  isDocument,
  primary,
  signal,
  log,
  timeoutMs
}) {
  const wallMs = Math.max(
    1000,
    Math.min(19 * 60 * 1000, Number(timeoutMs) - 30000)
  );
  if (isDocument) {
    log('[ca] document context-economy orchestrator');
    const loop = await iComposeRamDocumentInPhases({
      workspace: sandbox,
      model,
      signal,
      log,
      caSession: activeSession,
      timeoutMs: wallMs,
      systemBase: iSpeakTheSystemVowForThisBuild(true, primary)
    });
    return loop.stats;
  }
  const prompt =
    (await sandbox.read('AGENT_PROMPT.md', { offset: 0, limit: 60000 })).content ||
    'Produce the primary deliverable for this Lexiom build project.';
  const loop = await iServeRamWithGt3Tools({
    system: iSpeakTheSystemVowForThisBuild(false, primary),
    prompt,
    primary,
    isDocument: false,
    workspace: sandbox,
    signal,
    budgets: { maxWallClockMs: wallMs },
    log,
    model
  });
  return loop.stats;
}

/** The vow I speak into the sun's ear before tools begin — how I will honor Ram's prescription. */
function iSpeakTheSystemVowForThisBuild(isDocument, primary) {
  return [
    'You are the Lexiom 1.3 build agent (bolt-style, headless).',
    'Use only the supplied structured tools. Prose cannot read or change the workspace.',
    isDocument
      ? 'Document mode uses BUILD_PLAN plus immutable per-node JSON under ./nodes/ and SOURCE_MAP. Read only the node keys assigned to the current phase.'
      : 'Inspect the frozen OSNG snapshot with list_files and read_file before authoring. Treat ./osng/ as read-only source material.',
    'Use write_file for complete artifact contents.',
    `Primary deliverable path: ${primary}`,
    isDocument
      ? 'Write phase artifacts only (OUTLINE.md or the assigned sections/*.md). Host assembly owns document.md unless a reconcile phase asks otherwise. Reader-facing prose must contain ZERO OSN ids, .osn.yaml paths, output_spec, success_evidences, or build meta.'
      : 'Software mode: produce a working index.html (and supporting assets as needed). Prefer simple static HTML/JS/CSS unless the prompt requires more.',
    isDocument
      ? 'Submit the required phase artifact with write_file; the host validates and completes the phase atomically.'
      : 'Call finish only when the required primary artifacts are complete and correct.'
  ].join('\n');
}

/**
 * I receive from GT3 the frozen workspace grown from Ram's OSNG —
 * only what the sun places on the ticket; I invent no prescription of my own.
 */
async function iReceiveTheWorkspaceFromGt3(caSession, log) {
  const manifest = await iGetJsonFromGt3(caSession.workspace_manifest_url, caSession);
  const map = new Map();
  for (const f of manifest.files || []) {
    if (f && f.path && f.content != null) map.set(f.path, String(f.content));
  }
  const paths = manifest.paths || [];
  const template = caSession.file_path_template || '';
  for (const p of paths) {
    if (map.has(p)) continue;
    try {
      const url = template + encodeURIComponent(p);
      const file = await iGetJsonFromGt3(url, caSession);
      if (file && file.content != null) map.set(p, String(file.content));
    } catch (e) {
      log('[ca] skip file ' + p + ': ' + (e && e.message));
    }
  }
  log(`[ca] syncIn ${map.size} files`);
  return map;
}

/** I boot the sandbox where I will lovingly assemble the SUD Ram asked for. */
async function iBootTheSandboxGt3Prepared(fileMap, log, opts = {}) {
  if (typeof SharedArrayBuffer === 'undefined') {
    throw unavailableError('SharedArrayBuffer unavailable (need COOP/COEP)');
  }
  let mod;
  try {
    mod = await import(/* webpackIgnore: true */ DEFAULT_WC_CDN);
  } catch (error) {
    throw unavailableError(`WebContainer module failed to load: ${error?.message || error}`);
  }
  const WebContainer = mod.WebContainer || (mod.default && mod.default.WebContainer);
  if (!WebContainer) throw unavailableError('WebContainer export missing from CDN module');
  let wc;
  try {
    wc = await WebContainer.boot();
    await wc.mount(iShapeFilesIntoATree(fileMap));
  } catch (error) {
    throw unavailableError(`WebContainer boot failed: ${error?.message || error}`);
  }
  const dirty = new Set();
  const initial = new Map(fileMap);
  let writeGuard = iRefuseForbiddenWrites;
  let tornDown = false;
  const currentGuard = () => writeGuard;
  return {
    kind: 'webcontainer',
    setWriteGuard(fn) {
      if (typeof fn === 'function') writeGuard = fn;
    },
    clearDirty() {
      dirty.clear();
    },
    async read(input, options = {}) {
      const p = iMayReadThisPath(input);
      const content = await wc.fs.readFile(p, 'utf-8');
      const offset = Math.max(0, Number(options.offset) || 0);
      const limit = Math.max(1, Math.min(60000, Number(options.limit) || 30000));
      const slice = content.slice(offset, offset + limit);
      return {
        path: p,
        content: slice,
        offset,
        content_chars: content.length,
        truncated: offset + slice.length < content.length
      };
    },
    async write(input, content) {
      const p = writeGuard(input);
      const parts = p.split('/');
      if (parts.length > 1) {
        await wc.fs.mkdir(parts.slice(0, -1).join('/'), { recursive: true });
      }
      await wc.fs.writeFile(p, String(content), 'utf-8');
      dirty.add(p);
      log(`[ca] wrote ${p} (${String(content).length} chars)`);
      return { path: p, chars: String(content).length };
    },
    async exists(input) {
      const p = iMayReadThisPath(input);
      try {
        await wc.fs.readFile(p);
        return true;
      } catch {
        return false;
      }
    },
    async list(input = '', depth = 3) {
      const base = iNormalizeThePathIAmAboutToTouch(input, { allowRoot: true });
      const all = [];
      await iWalkTheSandboxTree(wc, base, all, Math.max(1, Math.min(6, depth)));
      return all.slice(0, 500);
    },
    async run(command, args = [], options = {}) {
      const executable = iMayRunOnlyAllowedCommands(command);
      const cwd = iNormalizeThePathIAmAboutToTouch(options.cwd || '', { allowRoot: true });
      const timeoutMs = Math.max(100, Math.min(120000, options.timeoutMs || 30000));
      const process = await wc.spawn(executable, args.map(String), cwd ? { cwd } : {});
      let output = '';
      const outputDone = process.output.pipeTo(
        new WritableStream({
          write(chunk) {
            if (output.length < 30000) output += String(chunk).slice(0, 30000 - output.length);
          }
        })
      );
      let timedOut = false;
      const exit = await Promise.race([
        process.exit,
        new Promise((resolve) =>
          setTimeout(() => {
            timedOut = true;
            try {
              process.kill();
            } catch {
              /* process already exited */
            }
            resolve(null);
          }, timeoutMs)
        )
      ]);
      await outputDone.catch(() => {});
      await iRefreshDirtyFilesIWrote(wc, initial, dirty, currentGuard());
      return {
        command: executable,
        args: args.map(String),
        cwd,
        exit_code: typeof exit === 'number' ? exit : null,
        timed_out: timedOut,
        output,
        output_truncated: output.length >= 30000
      };
    },
    async exportDirtyFiles({ onlyTracked = false } = {}) {
      const out = [];
      if (!onlyTracked) {
        await iRefreshDirtyFilesIWrote(wc, initial, dirty, currentGuard());
      }
      for (const p of [...dirty].sort()) {
        currentGuard()(p);
        try {
          const content = await wc.fs.readFile(p, 'utf-8');
          out.push({ path: p, content });
        } catch {
          /* missing */
        }
      }
      return out;
    },
    teardown() {
      if (tornDown) return;
      tornDown = true;
      try {
        if (wc && typeof wc.teardown === 'function') wc.teardown();
      } catch {
        /* already torn down */
      }
      wc = null;
    }
  };
}

/** I shape GT3's file map into a tree the sandbox can mount. */
function iShapeFilesIntoATree(fileMap) {
  const root = {};
  for (const [rel, content] of fileMap) {
    const parts = rel.split('/');
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const last = i === parts.length - 1;
      if (last) {
        node[part] = { file: { contents: content } };
      } else {
        if (!node[part]) node[part] = { directory: {} };
        if (!node[part].directory) node[part] = { directory: {} };
        node = node[part].directory;
      }
    }
  }
  return root;
}

/**
 * I, Hanuman, consult GT3 — the only sun I know — for Ram.
 * Path and credential arrive on the Job; how the sun routes my voice is GT3's affair.
 * I carry never White keys: I ask how to build the SUD the OSNG prescribed, then return.
 */
async function iConsultTheGt3Lm(
  gt3ConsultUrl,
  credentialGt3GaveMe,
  messages,
  tools,
  log,
  caSession,
  signal,
  completeOpts = {}
) {
  const url = gt3ConsultUrl.replace(/\/?$/, '') + '/chat/completions';
  const maxTokens = Math.max(256, Math.min(12000, Number(completeOpts.max_tokens) || 12000));
  const headers = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + credentialGt3GaveMe,
    'X-GT3-CA-Location': caSession?.ca_location || 'browser_session',
    'X-GT3-CA-Executor': caSession?.executor || 'bolt_webcontainer',
    'X-GT3-Plugin-Id': caSession?.plugin_id || '',
    'X-GT3-Run-Id': caSession?.run_id || '',
    'X-GT3-Agent-Pass': caSession?.pass || 'builder'
  };
  // Same-origin GT3 cockpit key override only — never injected into WebContainer sandbox env.
  try {
    const cockpitKey =
      (typeof localStorage !== 'undefined' &&
        localStorage.getItem('lexiom_gt3_api_key')) ||
      '';
    if (cockpitKey && String(cockpitKey).trim()) {
      headers['X-GT3-OpenRouter-Key'] = String(cockpitKey).trim();
    }
  } catch (_error) {
    // ignore
  }
  if (completeOpts.phase) {
    headers['X-GT3-Build-Phase'] = String(completeOpts.phase);
  }
  if (completeOpts.cache_sticky_key) {
    headers['X-GT3-Cache-Sticky'] = String(completeOpts.cache_sticky_key);
  }
  const res = await fetch(url, {
    method: 'POST',
    signal: iBoundMyRequestWithRamSignal(signal, 120000),
    headers,
    body: JSON.stringify({
      model: 'openai/gt3-lexiom-agent',
      temperature: 0.2,
      messages,
      tools,
      tool_choice: 'auto',
      max_tokens: maxTokens,
      metadata: {
        run_id: caSession?.run_id || null,
        plugin_id: caSession?.plugin_id || null,
        pass: caSession?.pass || 'builder',
        phase: completeOpts.phase || null,
        cache_sticky_key: completeOpts.cache_sticky_key || null
      }
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const rawDetail =
      (data && (data.detail || data.error || data.message)) ||
      'GT3 consult HTTP ' + res.status;
    const detail =
      typeof rawDetail === 'string'
        ? rawDetail
        : rawDetail?.message || JSON.stringify(rawDetail);
    log('[ca] gt3 consult error: ' + detail);
    throw Object.assign(new Error(String(detail)), {
      code: res.status === 401 || res.status === 503 ? 'agent_unavailable' : 'agent_failed',
      reason: 'gt3_consult_error'
    });
  }
  return data;
}

/** I fetch what GT3 prepared for me (manifest, files). */
async function iGetJsonFromGt3(url, caSession) {
  const res = await fetch(url, {
    cache: 'no-store',
    headers: iCarryMyCapabilityToGt3(caSession)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data && data.detail) || 'GET failed ' + res.status);
  }
  return data;
}

/** I return artifacts or status to GT3 so Ram may see what love built. */
async function iPostJsonToGt3(url, body, caSession) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...iCarryMyCapabilityToGt3(caSession) },
    body: JSON.stringify(body || {})
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data && data.detail) || 'POST failed ' + res.status);
  }
  return data;
}

/** I walk the sandbox tree when I must list or refresh what I have written. */
async function iWalkTheSandboxTree(wc, base, out, depth) {
  if (depth < 0) return;
  const dir = base || '.';
  const entries = await wc.fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const name = typeof entry === 'string' ? entry : entry.name;
    const rel = base ? `${base}/${name}` : name;
    const isDirectory =
      typeof entry !== 'string' &&
      typeof entry.isDirectory === 'function' &&
      entry.isDirectory();
    if (isDirectory) {
      if (name === 'node_modules' || name === '.git' || name === '.ca-staging') continue;
      if (depth > 0) await iWalkTheSandboxTree(wc, rel, out, depth - 1);
    } else {
      out.push(rel);
    }
  }
}

/** I notice which files I changed so I can offer them back to GT3. */
async function iRefreshDirtyFilesIWrote(wc, initial, dirty, writeGuard = iRefuseForbiddenWrites) {
  const paths = [];
  await iWalkTheSandboxTree(wc, '', paths, 12);
  for (const p of paths) {
    try {
      writeGuard(p);
      const content = await wc.fs.readFile(p, 'utf-8');
      if (!initial.has(p) || initial.get(p) !== content) dirty.add(p);
    } catch {
      /* directory, binary, immutable, or unreadable */
    }
  }
}

/** I carry only the capability token GT3 gave me — never Ram's throne keys. */
function iCarryMyCapabilityToGt3(caSession) {
  return caSession?.capability_token
    ? { 'X-GT3-CA-Capability': caSession.capability_token }
    : {};
}

function unavailableError(message) {
  return Object.assign(new Error(message), {
    code: 'agent_unavailable',
    reason: 'webcontainer_unavailable'
  });
}

/** I bound my consult so I do not linger past Ram's patience. */
function iBoundMyRequestWithRamSignal(signal, timeoutMs) {
  const timeout =
    typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
      ? AbortSignal.timeout(timeoutMs)
      : null;
  if (signal && timeout && typeof AbortSignal.any === 'function') {
    return AbortSignal.any([signal, timeout]);
  }
  return signal || timeout || undefined;
}

/* Legend ↔ code: return to ./README.md */
