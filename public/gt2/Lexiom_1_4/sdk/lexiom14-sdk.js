/**
 * Lexiom 1.4 browser SDK (Phase b) — implements contracts/lexiom14-api.d.ts shapes in JS.
 * Transport: fetch + EventSource (Bearer via fetch; EventSource uses query token POC).
 */
(function (global) {
  'use strict';

  const API_VERSION = 'lexiom14/1.0';

  function joinUrl(base, path) {
    return String(base).replace(/\/+$/, '') + path;
  }

  async function getCred(config) {
    return typeof config.getCredential === 'function'
      ? await config.getCredential()
      : config.credential;
  }

  async function apiFetch(config, path, options) {
    const cred = await getCred(config);
    const headers = Object.assign(
      {
        Authorization: 'Bearer ' + cred.token,
        Accept: 'application/json'
      },
      (options && options.headers) || {}
    );
    if (options && options.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(joinUrl(config.baseUrl, path), Object.assign({}, options, { headers }));
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      const err = new Error((data && data.error && data.error.message) || res.statusText);
      err.code = (data && data.error && data.error.code) || 'http_' + res.status;
      err.status = res.status;
      err.body = data;
      throw err;
    }
    return data;
  }

  /**
   * EventSource cannot set Authorization headers in browsers.
   * POC: pass token as query param; server also accepts Authorization on fetch routes.
   * For SSE we use fetch streaming when possible; fallback EventSource + ?access_token=
   */
  function subscribeSse(config, path, handler) {
    let aborted = false;
    let es = null;
    let readerCancel = null;

    (async function run() {
      const cred = await getCred(config);
      const url = joinUrl(config.baseUrl, path);
      try {
        const res = await fetch(url, {
          headers: {
            Authorization: 'Bearer ' + cred.token,
            Accept: 'text/event-stream'
          }
        });
        if (!res.ok || !res.body) {
          throw new Error('sse_fetch_failed');
        }
        const reader = res.body.getReader();
        readerCancel = () => reader.cancel();
        const decoder = new TextDecoder();
        let buf = '';
        while (!aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split('\n\n');
          buf = parts.pop() || '';
          for (const block of parts) {
            const lines = block.split('\n');
            let dataLine = '';
            for (const line of lines) {
              if (line.startsWith('data:')) dataLine += line.slice(5).trim();
            }
            if (!dataLine) continue;
            try {
              handler(JSON.parse(dataLine));
            } catch {
              /* ignore */
            }
          }
        }
      } catch (e) {
        if (aborted) return;
        // Fallback EventSource with access_token (also supported if we add it — for now report error)
        handler({
          api_version: API_VERSION,
          type: 'error',
          session_id: '',
          occurred_at: new Date().toISOString(),
          payload: {
            error: {
              code: 'sse_unavailable',
              message: e.message || String(e),
              retryable: true
            }
          }
        });
      }
    })();

    return function unsubscribe() {
      aborted = true;
      if (readerCancel) readerCancel();
      if (es) es.close();
    };
  }

  function createSdk(config) {
    if (!config || !config.baseUrl) {
      throw new Error('Lexiom14Sdk requires baseUrl');
    }

    const conversation = {
      create: function (req) {
        return apiFetch(config, '/lexiom14/v1/sessions', {
          method: 'POST',
          body: JSON.stringify(req || {})
        });
      },
      resume: function (req) {
        return apiFetch(config, '/lexiom14/v1/sessions/' + encodeURIComponent(req.session_id), {
          method: 'GET'
        });
      },
      generateOsn: function (req) {
        return apiFetch(
          config,
          '/lexiom14/v1/sessions/' + encodeURIComponent(req.session_id) + '/osn',
          {
            method: 'POST',
            body: JSON.stringify({
              outcome_description: req.outcome_description,
              client_message_id: req.client_message_id
            })
          }
        );
      },
      postMessage: function (req) {
        return apiFetch(
          config,
          '/lexiom14/v1/sessions/' + encodeURIComponent(req.session_id) + '/messages',
          {
            method: 'POST',
            body: JSON.stringify({
              text: req.text,
              client_message_id: req.client_message_id
            })
          }
        );
      },
      getState: function (sessionId) {
        return apiFetch(config, '/lexiom14/v1/sessions/' + encodeURIComponent(sessionId), {
          method: 'GET'
        });
      },
      subscribe: function (sessionId, handler) {
        return subscribeSse(
          config,
          '/lexiom14/v1/sessions/' + encodeURIComponent(sessionId) + '/events',
          handler
        );
      }
    };

    const realization = {
      start: function (req) {
        return apiFetch(
          config,
          '/lexiom14/v1/sessions/' + encodeURIComponent(req.session_id) + '/realization',
          {
            method: 'POST',
            body: JSON.stringify({
              profile: req.profile || 'document',
              options: req.options
            })
          }
        );
      },
      getPackage: function (sessionId) {
        return apiFetch(
          config,
          '/lexiom14/v1/sessions/' + encodeURIComponent(sessionId) + '/realization/package',
          { method: 'GET' }
        );
      },
      subscribe: function (sessionId, handler) {
        return subscribeSse(
          config,
          '/lexiom14/v1/sessions/' +
            encodeURIComponent(sessionId) +
            '/realization/events',
          handler
        );
      }
    };

    const embed = {
      mount: function (options) {
        const surface = options.surface || 'evidence_review';
        const el = options.container;
        const handlers = new Set();
        function emit(type, payload) {
          const envelope = {
            api_version: API_VERSION,
            type: type,
            session_id: options.session_id,
            occurred_at: new Date().toISOString(),
            payload: payload
          };
          handlers.forEach(function (h) {
            h(envelope);
          });
        }
        function render() {
          if (!el) return;
          const tokens = options.tokens || {};
          el.style.fontFamily = (tokens.typography && tokens.typography.body) || 'Georgia, serif';
          el.style.color = (tokens.colors && tokens.colors.text) || '#1a1a1a';
          el.style.background = (tokens.colors && tokens.colors.surface) || '#f7f5f0';
          el.style.padding = '1rem';
          el.style.borderRadius = '8px';
          if (surface === 'evidence_review' && options.package) {
            const ev = (options.package.success_evidences || [])
              .map(function (e) {
                return (
                  '<li data-id="' +
                  e.evidence_id +
                  '"><strong>' +
                  (e.label || e.evidence_id) +
                  '</strong> (' +
                  e.kind +
                  ', direct=' +
                  e.direct +
                  ')</li>'
                );
              })
              .join('');
            el.innerHTML =
              '<h3>Evidence review</h3><p>Artifact: ' +
              (options.package.artifact && options.package.artifact.file_name) +
              '</p><ul class="lexiom14-evidence-list">' +
              ev +
              '</ul>';
            el.querySelectorAll('[data-id]').forEach(function (node) {
              node.addEventListener('click', function () {
                emit('itemActivated', { id: node.getAttribute('data-id'), surface: surface });
                emit('selectionChanged', {
                  id: node.getAttribute('data-id'),
                  surface: surface
                });
              });
            });
          } else if (surface === 'structure_graph' && options.structure) {
            const nodes = (options.structure.nodes || [])
              .map(function (n) {
                return '<li data-id="' + n.id + '">' + (n.title || n.id) + '</li>';
              })
              .join('');
            el.innerHTML = '<h3>Structure</h3><ul>' + nodes + '</ul>';
            emit('dataUpdated', { surface: surface });
          } else {
            el.innerHTML = '<p>Lexiom embed: ' + surface + '</p>';
          }
          emit('stateChanged', { surface: surface, state: { mounted: true } });
        }
        render();
        return {
          command: function (cmd) {
            if (cmd.type === 'setTokens') {
              options.tokens = Object.assign({}, options.tokens, cmd.tokens);
              render();
            } else if (cmd.type === 'refresh') {
              render();
            } else if (cmd.type === 'dispose') {
              el.innerHTML = '';
              handlers.clear();
            }
          },
          subscribe: function (handler) {
            handlers.add(handler);
            return function () {
              handlers.delete(handler);
            };
          }
        };
      }
    };

    return {
      api_version: API_VERSION,
      conversation: conversation,
      realization: realization,
      embed: embed,
      /** POC helper */
      mintDemoCredential: function (claims) {
        return apiFetch(
          {
            baseUrl: config.baseUrl,
            getCredential: async function () {
              return { token: 'unused' };
            }
          },
          '/lexiom14/v1/demo/mint',
          { method: 'POST', body: JSON.stringify(claims || {}) }
        ).catch(async function () {
          // mint is unauthenticated — call without bearer
          const res = await fetch(joinUrl(config.baseUrl, '/lexiom14/v1/demo/mint'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(claims || {})
          });
          return res.json();
        });
      }
    };
  }

  // Fix mint to not require auth
  createSdk.mintDemo = async function (baseUrl, claims) {
    const res = await fetch(String(baseUrl).replace(/\/+$/, '') + '/lexiom14/v1/demo/mint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(claims || {})
    });
    if (!res.ok) throw new Error('mint_failed');
    return res.json();
  };

  global.Lexiom14Sdk = { create: createSdk, mintDemo: createSdk.mintDemo, API_VERSION: API_VERSION };
})(typeof window !== 'undefined' ? window : globalThis);
