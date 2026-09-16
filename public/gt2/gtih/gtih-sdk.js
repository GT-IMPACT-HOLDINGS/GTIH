/**
 * GTIH browser SDK (thin) — Lexiom 1.3 / GT3 substrate.
 * OSNG propose + Hanuman prepare/realize/evidence (+ TRH propose→realize chain).
 */
(function (global) {
  'use strict';

  var API_KEY_STORAGE_KEY = 'lexiom_gt3_api_key';
  var CA_MODULE_URL = '/gt2/Lexiom_1_3/ca/serveRamUnderGt3.js';
  var TERMINAL_REALIZE_STATUSES = {
    completed: true,
    agent_failed: true,
    agent_unavailable: true,
    failed: true,
    cancelled: true,
    timeout: true
  };

  function createGtihClient(config) {
    var cfg = config || {};
    var baseUrl = String(cfg.baseUrl != null ? cfg.baseUrl : '').replace(/\/+$/, '');

    function getApiKey() {
      if (typeof cfg.getApiKey === 'function') {
        return String(cfg.getApiKey() || '');
      }
      try {
        return localStorage.getItem(API_KEY_STORAGE_KEY) || '';
      } catch (_e) {
        return '';
      }
    }

    function setApiKey(key) {
      try {
        if (key && String(key).trim()) {
          localStorage.setItem(API_KEY_STORAGE_KEY, String(key).trim());
        } else {
          localStorage.removeItem(API_KEY_STORAGE_KEY);
        }
      } catch (_e) {
        /* ignore */
      }
    }

    function joinUrl(path) {
      if (!baseUrl) return path;
      return baseUrl + path;
    }

    async function jsonFetch(method, path, body, extraHeaders) {
      var headers = Object.assign(
        { Accept: 'application/json' },
        extraHeaders || {}
      );
      var init = { method: method, headers: headers, cache: 'no-store' };
      if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(body);
      }
      var res = await fetch(joinUrl(path), init);
      var data = null;
      try {
        data = await res.json();
      } catch (_e) {
        data = null;
      }
      if (!res.ok) {
        var msg =
          (data && data.detail) ||
          res.statusText ||
          'HTTP ' + res.status;
        var err = new Error(String(msg));
        err.status = res.status;
        err.body = data;
        err.debug = data && data.debug != null ? data.debug : undefined;
        err.detail = data && data.detail != null ? data.detail : undefined;
        throw err;
      }
      return data;
    }

    function openRouterHeaders() {
      var headers = {};
      var key = getApiKey();
      if (key) {
        headers['X-GT3-OpenRouter-Key'] = key;
      }
      return headers;
    }

    function sleep(ms) {
      return new Promise(function (resolve) {
        setTimeout(resolve, ms);
      });
    }

    function primaryEntryForPlugin(pluginId) {
      if (pluginId === 'lexiom13.document_builder') return 'document.md';
      return 'index.html';
    }

    /**
     * Start async propose Job. Returns immediately with ca_session for browser Hanuman.
     * @param {{ intent?: string, narrative?: string, max_descendants?: number }} args
     */
    async function proposeFromIntent(args) {
      var a = args || {};
      var intent = String(a.intent || a.narrative || '').trim();
      if (!intent) {
        throw new Error('intent must be non-empty');
      }
      var maxDesc =
        a.max_descendants !== undefined && a.max_descendants !== null
          ? Number(a.max_descendants)
          : 0;
      return jsonFetch(
        'POST',
        '/lexiom13/osn/propose',
        { intent: intent, max_descendants: maxDesc },
        openRouterHeaders()
      );
    }

    async function getProposeStatus(runId) {
      var id = String(runId || '').trim();
      if (!id) throw new Error('run_id required');
      return jsonFetch(
        'GET',
        '/lexiom13/osn/propose/status/' + encodeURIComponent(id),
        undefined,
        openRouterHeaders()
      );
    }

    /**
     * Browser labor: boot Lexiom CA WebContainer for a propose or realize ca_session.
     */
    async function serveCaSession(caSession, opts) {
      var o = opts || {};
      if (!caSession || !caSession.session_id) {
        throw new Error('ca_session required');
      }
      var mod = await import(CA_MODULE_URL);
      var run =
        mod && (mod.runBoltWebContainerCa || mod.iServeRamInTheWebContainer);
      if (typeof run !== 'function') {
        throw new Error('serveRamUnderGt3 module missing runBoltWebContainerCa');
      }
      return run(caSession, {
        onLog: o.onLog,
        onPassChange: o.onPassChange,
        signal: o.signal
      });
    }

    async function serveProposeSession(caSession, opts) {
      return serveCaSession(caSession, opts);
    }

    async function serveRealizeSession(caSession, opts) {
      return serveCaSession(caSession, opts);
    }

    /**
     * Convenience: start → Hanuman labor → poll until ok/failed.
     * @returns envelope { root_osn_id, nodes, meta }
     */
    async function proposeFromIntentUntilDone(args, opts) {
      var o = opts || {};
      var started = await proposeFromIntent(args);
      if (o.onStatus) o.onStatus(started);
      if (started && started.ca_session) {
        try {
          await serveProposeSession(started.ca_session, {
            onLog: o.onLog,
            signal: o.signal
          });
        } catch (laborErr) {
          var afterLabor = null;
          try {
            afterLabor = await getProposeStatus(started.run_id);
          } catch (_e) {
            afterLabor = null;
          }
          if (afterLabor && afterLabor.status === 'ok' && afterLabor.envelope) {
            return afterLabor.envelope;
          }
          var fail = new Error(
            (afterLabor && afterLabor.detail) ||
              (laborErr && laborErr.message) ||
              'Hanuman propose labor failed'
          );
          fail.status = 502;
          fail.detail = afterLabor && afterLabor.detail;
          fail.debug =
            (afterLabor && afterLabor.debug) ||
            {
              phase: 'hanuman_labor',
              error_message: laborErr && laborErr.message
            };
          fail.body = afterLabor;
          throw fail;
        }
      }

      var pollMs = typeof o.pollMs === 'number' ? o.pollMs : 1500;
      var maxWaitMs = typeof o.maxWaitMs === 'number' ? o.maxWaitMs : 20 * 60 * 1000;
      var t0 = Date.now();
      while (Date.now() - t0 < maxWaitMs) {
        var st = await getProposeStatus(started.run_id);
        if (o.onStatus) o.onStatus(st);
        if (st.status === 'ok' && st.envelope) {
          return st.envelope;
        }
        if (st.status === 'failed') {
          var err = new Error(st.detail || 'OSNG propose failed');
          err.status = 502;
          err.detail = st.detail;
          err.debug = st.debug;
          err.body = st;
          throw err;
        }
        await sleep(pollMs);
      }
      var timeoutErr = new Error('OSNG propose poll timeout');
      timeoutErr.status = 504;
      timeoutErr.debug = { phase: 'poll_timeout', run_id: started.run_id };
      throw timeoutErr;
    }

    async function prepare(args) {
      var a = args || {};
      var body = {};
      if (a.osng_envelope) body.osng_envelope = a.osng_envelope;
      if (a.proposal_run_id) body.proposal_run_id = a.proposal_run_id;
      if (a.compilation_root_osn_id) {
        body.compilation_root_osn_id = a.compilation_root_osn_id;
      }
      if (a.strategy_id) body.strategy_id = a.strategy_id;
      if (a.run_id) body.run_id = a.run_id;
      return jsonFetch('POST', '/lexiom13/build/prepare', body, openRouterHeaders());
    }

    async function prepareFromOsngEnvelope(args) {
      var a = args || {};
      if (!a.osng_envelope && !a.proposal_run_id && !a.envelope) {
        throw new Error('osng_envelope or proposal_run_id required');
      }
      return prepare({
        osng_envelope: a.osng_envelope || a.envelope,
        proposal_run_id: a.proposal_run_id,
        strategy_id: a.strategy_id,
        run_id: a.run_id
      });
    }

    async function realize(args) {
      var a = args || {};
      var body = {};
      if (a.run_id || (a.handoff && a.handoff.run_id)) {
        body.run_id = a.run_id || a.handoff.run_id;
        body.handoff = a.handoff || { run_id: body.run_id };
      }
      if (a.compilation_root_osn_id) {
        body.compilation_root_osn_id = a.compilation_root_osn_id;
      }
      if (a.osng_envelope) body.osng_envelope = a.osng_envelope;
      if (a.proposal_run_id) body.proposal_run_id = a.proposal_run_id;
      if (a.strategy_id) body.strategy_id = a.strategy_id;
      if (a.ca_location) body.ca_location = a.ca_location;
      return jsonFetch('POST', '/lexiom13/build/run', body, openRouterHeaders());
    }

    async function getStatus(runId) {
      var id = String(runId || '').trim();
      if (!id) throw new Error('run_id required');
      return jsonFetch(
        'GET',
        '/lexiom13/build/status/' + encodeURIComponent(id),
        undefined,
        openRouterHeaders()
      );
    }

    async function watchStatus(runId, opts) {
      var o = opts || {};
      var pollMs = typeof o.pollMs === 'number' ? o.pollMs : 1500;
      var maxWaitMs = typeof o.maxWaitMs === 'number' ? o.maxWaitMs : 20 * 60 * 1000;
      var t0 = Date.now();
      while (Date.now() - t0 < maxWaitMs) {
        var st = await getStatus(runId);
        if (o.onStatus) o.onStatus(st);
        var status = st && st.status;
        if (status && TERMINAL_REALIZE_STATUSES[status]) {
          return st;
        }
        await sleep(pollMs);
      }
      var timeoutErr = new Error('Hanuman realize poll timeout');
      timeoutErr.status = 504;
      timeoutErr.debug = { phase: 'realize_poll_timeout', run_id: runId };
      throw timeoutErr;
    }

    async function listEvidenceCollections(osnId) {
      var id = String(osnId || '').trim();
      if (!id) throw new Error('osn_id required');
      return jsonFetch(
        'GET',
        '/lexiom13/evidence/collections?osn_id=' + encodeURIComponent(id),
        undefined,
        openRouterHeaders()
      );
    }

    function getBudArtifactUrl(runId, entry) {
      var id = String(runId || '').trim();
      var e = String(entry || 'document.md').trim();
      return joinUrl(
        '/lexiom13/build/' +
          encodeURIComponent(id) +
          '/artifact/' +
          encodeURIComponent(e)
      );
    }

    function getBudPreviewUrl(runId, relPath) {
      var id = String(runId || '').trim();
      var rel = String(relPath || '').replace(/^\/+/, '');
      if (!rel) {
        return joinUrl('/lexiom13/preview/' + encodeURIComponent(id) + '/');
      }
      return joinUrl(
        '/lexiom13/preview/' +
          encodeURIComponent(id) +
          '/' +
          rel
            .split('/')
            .map(encodeURIComponent)
            .join('/')
      );
    }

    function getEvidenceArtifactUrl(runId, relPath) {
      var id = String(runId || '').trim();
      var rel = String(relPath || '')
        .replace(/^\/+/, '')
        .split('/')
        .map(encodeURIComponent)
        .join('/');
      return joinUrl(
        '/lexiom13/evidence/artifact/' + encodeURIComponent(id) + '/' + rel
      );
    }

    async function fetchBudText(runId, pluginId) {
      var id = String(runId || '').trim();
      if (!id) throw new Error('run_id required');
      var entry = primaryEntryForPlugin(pluginId);
      var url =
        pluginId === 'lexiom13.document_builder'
          ? getBudArtifactUrl(id, entry)
          : getBudPreviewUrl(id, entry);
      var res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        var err = new Error('Failed to fetch SUD artifact HTTP ' + res.status);
        err.status = res.status;
        throw err;
      }
      var text = await res.text();
      return {
        entry: entry,
        media_kind:
          pluginId === 'lexiom13.document_builder' ? 'document' : 'software',
        url: url,
        text: text
      };
    }

    /**
     * prepare → realize → CA labor → poll until terminal.
     * Accepts prepared handoff, canon root id, or ephemeral envelope / proposal_run_id.
     */
    async function realizeUntilDone(args, opts) {
      var a = args || {};
      var o = opts || {};
      var handoff = a.handoff || null;

      if (!handoff || !handoff.run_id) {
        if (o.onLog) o.onLog('phase: prepare');
        handoff = await prepare({
          compilation_root_osn_id: a.compilation_root_osn_id,
          osng_envelope: a.osng_envelope || a.envelope,
          proposal_run_id: a.proposal_run_id,
          strategy_id: a.strategy_id,
          run_id: a.run_id
        });
        if (o.onStatus) o.onStatus(handoff);
      }

      if (o.onLog) o.onLog('phase: realize (issue CA ticket)');
      var started = await realize({
        run_id: handoff.run_id,
        handoff: { run_id: handoff.run_id },
        compilation_root_osn_id: handoff.compilation_root_osn_id
      });
      if (o.onStatus) o.onStatus(started);

      if (started && started.ca_session) {
        try {
          if (o.onLog) o.onLog('phase: Hanuman realize labor');
          await serveRealizeSession(started.ca_session, {
            onLog: o.onLog,
            onPassChange: o.onPassChange,
            signal: o.signal
          });
        } catch (laborErr) {
          if (o.onLog) {
            o.onLog(
              'realize labor ended: ' +
                ((laborErr && laborErr.message) || String(laborErr))
            );
          }
        }
      }

      var status = await watchStatus(handoff.run_id, {
        pollMs: o.pollMs,
        maxWaitMs: o.maxWaitMs,
        onStatus: o.onStatus
      });

      if (status.status !== 'completed') {
        var fail = new Error(status.detail || 'Hanuman realize failed');
        fail.status = 502;
        fail.detail = status.detail;
        fail.debug = { phase: 'realize', status: status.status };
        fail.body = status;
        throw fail;
      }

      return {
        handoff: status.handoff || handoff,
        status: status
      };
    }

    /**
     * Full TRH chain: propose OSNG → ephemeral prepare → realize → evidence → SUD text.
     * @param {object} [opts]
     * @param {(envelope: object) => void} [opts.onEnvelope] — fired as soon as propose yields an OSNG (before prepare/realize)
     */
    async function proposeThenRealizeUntilDone(args, opts) {
      var o = opts || {};
      if (o.onLog) o.onLog('phase: propose OSNG');
      var envelope = await proposeFromIntentUntilDone(args, {
        onLog: o.onLog,
        onStatus: function (st) {
          if (o.onStatus) o.onStatus({ phase: 'propose', status: st });
        },
        pollMs: o.pollMs,
        maxWaitMs: o.maxWaitMs,
        signal: o.signal
      });

      if (typeof o.onEnvelope === 'function') {
        try {
          o.onEnvelope(envelope);
        } catch (_cbErr) {
          /* host UI callback must not abort the realize chain */
        }
      }

      if (o.onLog) o.onLog('phase: prepare from proposed OSNG envelope');
      var realized = await realizeUntilDone(
        {
          osng_envelope: {
            root_osn_id: envelope.root_osn_id,
            nodes: envelope.nodes,
            meta: envelope.meta
          },
          strategy_id: args && args.strategy_id
        },
        {
          onLog: o.onLog,
          onStatus: function (st) {
            if (o.onStatus) o.onStatus({ phase: 'realize', status: st });
          },
          onPassChange: o.onPassChange,
          pollMs: o.pollMs,
          maxWaitMs: o.maxWaitMs,
          signal: o.signal
        }
      );

      var handoff = realized.handoff;
      var status = realized.status;
      var osnId = handoff.compilation_root_osn_id || envelope.root_osn_id;
      var evidence = null;
      try {
        if (o.onLog) o.onLog('phase: collect evidence listings');
        evidence = await listEvidenceCollections(osnId);
      } catch (evErr) {
        evidence = {
          osn_id: osnId,
          targets: [],
          detail: (evErr && evErr.message) || String(evErr)
        };
      }

      var sud = null;
      try {
        if (o.onLog) o.onLog('phase: fetch SUD artifact');
        sud = await fetchBudText(handoff.run_id, handoff.plugin_id);
      } catch (sudErr) {
        sud = {
          entry: primaryEntryForPlugin(handoff.plugin_id),
          media_kind:
            handoff.plugin_id === 'lexiom13.document_builder'
              ? 'document'
              : 'software',
          url:
            handoff.plugin_id === 'lexiom13.document_builder'
              ? getBudArtifactUrl(handoff.run_id, 'document.md')
              : getBudPreviewUrl(handoff.run_id, 'index.html'),
          text: null,
          error: (sudErr && sudErr.message) || String(sudErr)
        };
      }

      return {
        envelope: envelope,
        handoff: handoff,
        status: status,
        evidence: evidence,
        sud: sud
      };
    }

    async function infer(narrative, options) {
      var text = String(narrative || '').trim();
      if (!text) {
        return { ok: false, text: null, error: 'Narrative must be non-empty', latencyMs: 0 };
      }
      var t0 = Date.now();
      var headers = {
        'Content-Type': 'application/json',
        'X-GT3-Tenant': 'gt2-lexiom-demo',
        'X-GT3-Data-Track': 'green',
        'X-GT3-Consent-Version': 'v1',
        'X-Lexiom-Persona-Mode': 'lexiom_13_reasoning'
      };
      var key = getApiKey();
      if (key) {
        headers['X-GT3-OpenRouter-Key'] = key;
        headers['X-GT3-OpenAI-Key'] = key;
      }
      try {
        var res = await fetch(joinUrl('/inference'), {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({ narrative: text })
        });
        var latencyMs = Date.now() - t0;
        if (!res.ok) {
          var errText = await res.text();
          return {
            ok: false,
            text: null,
            error: 'HTTP ' + res.status + ': ' + errText,
            latencyMs: latencyMs
          };
        }
        var data = await res.json();
        if (!data.response || typeof data.response !== 'string') {
          return {
            ok: false,
            text: null,
            error: 'Malformed response: "response" field missing or not a string',
            latencyMs: latencyMs
          };
        }
        return { ok: true, text: data.response, error: null, latencyMs: latencyMs };
      } catch (e) {
        return {
          ok: false,
          text: null,
          error: 'Network error: ' + String(e),
          latencyMs: Date.now() - t0
        };
      }
    }

    return {
      osng: {
        proposeFromIntent: proposeFromIntent,
        getProposeStatus: getProposeStatus,
        proposeFromIntentUntilDone: proposeFromIntentUntilDone,
        proposeThenRealizeUntilDone: proposeThenRealizeUntilDone
      },
      gt3: {
        infer: infer,
        getApiKey: getApiKey,
        setApiKey: setApiKey
      },
      hanuman: {
        prepare: prepare,
        prepareFromOsngEnvelope: prepareFromOsngEnvelope,
        realize: realize,
        getStatus: getStatus,
        watchStatus: watchStatus,
        serveProposeSession: serveProposeSession,
        serveRealizeSession: serveRealizeSession,
        realizeUntilDone: realizeUntilDone,
        listEvidenceCollections: listEvidenceCollections,
        getBudArtifactUrl: getBudArtifactUrl,
        getBudPreviewUrl: getBudPreviewUrl,
        getEvidenceArtifactUrl: getEvidenceArtifactUrl,
        fetchBudText: fetchBudText
      },
      getApiKey: getApiKey,
      setApiKey: setApiKey
    };
  }

  var defaultClient = createGtihClient();
  global.gtih = defaultClient;
  global.createGtihClient = createGtihClient;
})(typeof window !== 'undefined' ? window : globalThis);

