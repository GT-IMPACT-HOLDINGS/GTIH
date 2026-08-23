/**
 * TheReasoningHub portal — Phase (c)
 * Uses Lexiom 1.4 SDK only for GTIH capabilities. TRH owns SoR + canonicalization.
 */
(function () {
  'use strict';

  const STATES = [
    'Draft',
    'ReadyToRealize',
    'Realizing',
    'EvidenceReview',
    'HumanApproved',
    'CanonicalSigned'
  ];

  const VIEWS = [
    'conversation',
    'structure',
    'realization',
    'evidence',
    'canonical',
    'cockpit'
  ];

  const DEFAULT_BASE = 'http://localhost:8080';
  const LS_BASE = 'trh.lexiom_base_url';

  const ui = {
    statePill: document.getElementById('statePill'),
    viewNav: document.getElementById('viewNav'),
    chatLog: document.getElementById('chatLog'),
    composer: document.getElementById('composer'),
    messageInput: document.getElementById('messageInput'),
    btnSend: document.getElementById('btnSend'),
    btnRealize: document.getElementById('btnRealize'),
    btnStart: document.getElementById('btnStart'),
    outcomeInput: document.getElementById('outcomeInput'),
    welcomeError: document.getElementById('welcomeError'),
    btnSettings: document.getElementById('btnSettings'),
    btnCanonical: document.getElementById('btnCanonical'),
    settings: document.getElementById('settings'),
    baseUrl: document.getElementById('baseUrl'),
    welcome: document.getElementById('welcome'),
    main: document.getElementById('main'),
    layout: document.getElementById('layout'),
    structurePanel: document.getElementById('structurePanel'),
    hemiOutput: document.getElementById('hemiOutput'),
    hemiEvidence: document.getElementById('hemiEvidence'),
    progressList: document.getElementById('progressList'),
    evidenceList: document.getElementById('evidenceList'),
    canonicalBody: document.getElementById('canonicalBody'),
    cockpitNodes: document.getElementById('cockpitNodes'),
    cockpitPlaneLabel: document.getElementById('cockpitPlaneLabel'),
    views: {
      conversation: document.getElementById('view-conversation'),
      structure: document.getElementById('view-structure'),
      realization: document.getElementById('view-realization'),
      evidence: document.getElementById('view-evidence'),
      canonical: document.getElementById('view-canonical'),
      cockpit: document.getElementById('view-cockpit')
    }
  };

  /** @type {any} */
  let sdk = null;
  /** @type {any} */
  let credential = null;
  let unsub = null;
  let selectedNodeId = null;
  let activePlane = 'semantic';

  /** @type {any} */
  let caseRecord = null;

  function baseUrl() {
    return (ui.baseUrl.value || localStorage.getItem(LS_BASE) || DEFAULT_BASE).replace(
      /\/+$/,
      ''
    );
  }

  function setState(next) {
    if (!caseRecord) return;
    caseRecord.state = next;
    caseRecord.updated_at = new Date().toISOString();
    persist();
    renderState();
    renderChrome();
  }

  function persist() {
    if (!caseRecord) return;
    window.TrhSor.upsert(caseRecord);
  }

  function renderState() {
    const state = caseRecord ? caseRecord.state : 'Draft';
    ui.statePill.dataset.state = state;
    ui.statePill.textContent = labelState(state);
  }

  function labelState(state) {
    const map = {
      Draft: 'Draft',
      ReadyToRealize: 'Ready to Realize',
      Realizing: 'Realizing',
      EvidenceReview: 'Evidence Review',
      HumanApproved: 'Human Approved',
      CanonicalSigned: 'Canonical / Signed'
    };
    return map[state] || state;
  }

  function setView(view) {
    if (!caseRecord) return;
    caseRecord.active_view = view;
    persist();
    VIEWS.forEach(function (v) {
      const el = ui.views[v];
      if (el) el.hidden = v !== view;
    });
    ui.viewNav.querySelectorAll('button').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.view === view);
    });
    if (view === 'structure' || view === 'cockpit') renderStructure();
    if (view === 'evidence') renderEvidence();
    if (view === 'canonical') renderCanonical();
    if (view === 'realization') renderProgress();
  }

  function renderChrome() {
    const hasCase = !!caseRecord;
    ui.welcome.hidden = hasCase;
    ui.main.hidden = !hasCase;
    ui.btnRealize.disabled = !(caseRecord && caseRecord.state === 'ReadyToRealize');
    ui.btnCanonical.hidden = !(
      caseRecord &&
      (caseRecord.state === 'HumanApproved' ||
        caseRecord.state === 'EvidenceReview' ||
        caseRecord.state === 'CanonicalSigned')
    );
    ui.btnCanonical.disabled = !(caseRecord && caseRecord.state === 'HumanApproved');
    if (caseRecord && caseRecord.state === 'CanonicalSigned') {
      ui.btnCanonical.hidden = true;
    }
    const showStructure =
      caseRecord &&
      caseRecord.structure &&
      caseRecord.structure.nodes &&
      caseRecord.structure.nodes.length > 0;
    ui.layout.classList.toggle('has-structure', !!showStructure);
    ui.structurePanel.hidden = !showStructure;
  }

  function appendBubble(role, text) {
    const div = document.createElement('div');
    div.className = 'bubble ' + role;
    div.textContent = text;
    ui.chatLog.appendChild(div);
    ui.chatLog.scrollTop = ui.chatLog.scrollHeight;
  }

  function renderChat() {
    ui.chatLog.innerHTML = '';
    (caseRecord.messages || []).forEach(function (m) {
      appendBubble(m.role === 'user' ? 'user' : 'assistant', m.text);
    });
  }

  function renderStructure() {
    const h = (caseRecord.structure && caseRecord.structure.hemispheres) || {};
    ui.hemiOutput.classList.toggle('ready', !!h.output_spec_ready);
    ui.hemiEvidence.classList.toggle('ready', !!h.success_evidence_ready);
    ui.hemiOutput.querySelector('.body').textContent =
      h.output_spec_summary || 'Awaiting an outcome description…';
    ui.hemiEvidence.querySelector('.body').textContent =
      h.success_evidence_summary || 'Lexiom will name how success should be inspected…';

    const detail = document.getElementById('structureDetail');
    if (detail) {
      detail.innerHTML =
        '<div class="hemi' +
        (h.output_spec_ready ? ' ready' : '') +
        '"><div class="label">Output Specifications</div><div class="body">' +
        (h.output_spec_summary || '…') +
        '</div></div><div class="hemi' +
        (h.success_evidence_ready ? ' ready' : '') +
        '"><div class="label">Success Evidences</div><div class="body">' +
        (h.success_evidence_summary || '…') +
        '</div></div>';
    }

    const nodes = (caseRecord.structure && caseRecord.structure.nodes) || [];
    ui.cockpitNodes.innerHTML = '';
    nodes.forEach(function (n) {
      const li = document.createElement('li');
      li.textContent = n.title || n.id;
      li.dataset.id = n.id;
      if (n.id === selectedNodeId) li.classList.add('selected');
      li.onclick = function () {
        selectedNodeId = n.id;
        renderStructure();
      };
      ui.cockpitNodes.appendChild(li);
    });
    ui.cockpitPlaneLabel.textContent =
      'Plane: ' +
      activePlane +
      ' — inspect the outcome graph. Spatial and temporal depth are Follow-up.';
  }

  function renderProgress() {
    const steps = caseRecord.progress || [];
    ui.progressList.innerHTML = '';
    if (!steps.length) {
      const li = document.createElement('li');
      li.textContent =
        caseRecord.state === 'Realizing'
          ? 'Working…'
          : 'Realization progress will appear here.';
      ui.progressList.appendChild(li);
      return;
    }
    steps.forEach(function (s) {
      const li = document.createElement('li');
      li.textContent = s.label || s.step_id;
      if (s.status === 'active') li.classList.add('active');
      if (s.status === 'done') li.classList.add('done');
      ui.progressList.appendChild(li);
    });
  }

  async function fetchEvidenceText(ev) {
    if (!ev || !ev.uri || !credential) return '';
    try {
      const res = await fetch(baseUrl() + ev.uri, {
        headers: { Authorization: 'Bearer ' + credential.token }
      });
      if (!res.ok) return '';
      return await res.text();
    } catch {
      return '';
    }
  }

  async function renderEvidence() {
    ui.evidenceList.innerHTML = '';
    const pkg = caseRecord.package;
    if (!pkg) {
      ui.evidenceList.textContent = 'No realization package yet.';
      return;
    }
    const approvals = caseRecord.evidence_approvals || {};
    const list = pkg.success_evidences || [];
    for (let i = 0; i < list.length; i++) {
      const ev = list[i];
      const item = document.createElement('div');
      item.className = 'evidence-item';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!approvals[ev.evidence_id];
      cb.disabled = caseRecord.state === 'CanonicalSigned';
      cb.onchange = function () {
        caseRecord.evidence_approvals[ev.evidence_id] = cb.checked;
        recomputeApprovalState();
        persist();
        renderChrome();
      };
      const body = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = ev.label || ev.evidence_id;
      const meta = document.createElement('div');
      meta.style.fontSize = '0.8rem';
      meta.style.color = '#3d4a57';
      meta.textContent =
        (ev.kind || '') + (ev.direct ? ' · direct' : ' · derivative');
      const pre = document.createElement('pre');
      pre.textContent = 'Loading…';
      body.appendChild(title);
      body.appendChild(meta);
      body.appendChild(pre);
      item.appendChild(cb);
      item.appendChild(body);
      ui.evidenceList.appendChild(item);
      fetchEvidenceText(ev).then(function (text) {
        pre.textContent = text || '(empty)';
      });
    }
  }

  function recomputeApprovalState() {
    if (!caseRecord || !caseRecord.package) return;
    if (
      caseRecord.state === 'CanonicalSigned' ||
      caseRecord.state === 'Realizing' ||
      caseRecord.state === 'Draft' ||
      caseRecord.state === 'ReadyToRealize'
    ) {
      return;
    }
    const required = (caseRecord.package.success_evidences || []).filter(function (e) {
      return e.direct;
    });
    const approvals = caseRecord.evidence_approvals || {};
    const all =
      required.length > 0 &&
      required.every(function (e) {
        return !!approvals[e.evidence_id];
      });
    if (all) {
      setState('HumanApproved');
    } else if (caseRecord.state === 'HumanApproved') {
      setState('EvidenceReview');
    }
  }

  async function renderCanonical() {
    ui.canonicalBody.innerHTML = '';
    if (!caseRecord.package) {
      ui.canonicalBody.textContent = 'Canonical artifact appears after signing.';
      return;
    }
    if (caseRecord.state !== 'CanonicalSigned') {
      ui.canonicalBody.innerHTML =
        '<p>Not canonical yet. Approve all required direct evidences, then mark Canonical / Signed.</p>';
      return;
    }
    const badge = document.createElement('div');
    badge.className = 'canonical-badge';
    badge.textContent = 'CANONICAL / SIGNED';
    const meta = document.createElement('p');
    meta.textContent =
      'Attested ' +
      (caseRecord.attestation && caseRecord.attestation.at) +
      ' by ' +
      (caseRecord.attestation && caseRecord.attestation.by);
    const pre = document.createElement('pre');
    pre.textContent = 'Loading artifact…';
    ui.canonicalBody.appendChild(badge);
    ui.canonicalBody.appendChild(meta);
    ui.canonicalBody.appendChild(pre);
    const art = caseRecord.package.artifact;
    if (art && art.uri) {
      try {
        const res = await fetch(baseUrl() + art.uri, {
          headers: { Authorization: 'Bearer ' + credential.token }
        });
        pre.textContent = await res.text();
      } catch (e) {
        pre.textContent = String(e.message || e);
      }
    }
  }

  function ensureSdkScripts() {
    return new Promise(function (resolve, reject) {
      if (window.Lexiom14Sdk) {
        resolve();
        return;
      }
      // Same-origin paths from TRH serve.mjs (COEP-safe)
      const urls = ['/sdk/lexiom14-sdk.js', '/core/lexiom14-core.js', '/embeds/lexiom14-embeds.js'];
      let i = 0;
      function next() {
        if (i >= urls.length) {
          if (!window.Lexiom14Sdk) reject(new Error('SDK failed to load'));
          else resolve();
          return;
        }
        const s = document.createElement('script');
        s.src = urls[i++];
        s.onload = next;
        s.onerror = function () {
          reject(new Error('Failed loading ' + s.src));
        };
        document.head.appendChild(s);
      }
      next();
    });
  }

  async function startCase() {
    const outcome = (ui.outcomeInput && ui.outcomeInput.value ? ui.outcomeInput.value : '').trim();
    if (ui.welcomeError) {
      ui.welcomeError.hidden = true;
      ui.welcomeError.textContent = '';
    }
    if (!outcome) {
      if (ui.welcomeError) {
        ui.welcomeError.hidden = false;
        ui.welcomeError.textContent = 'Please describe the desired outcome in one prompt.';
      }
      return;
    }
    ui.btnStart.disabled = true;
    try {
      localStorage.setItem(LS_BASE, baseUrl());
      await ensureSdkScripts();
      credential = await window.Lexiom14Sdk.mintDemo(baseUrl(), {
        vertical_id: 'trh',
        tenant_pseudonym: 'trh_demo_tenant',
        app_id: 'trh_portal',
        env: 'dev',
        actor_pseudonym: 'trh_human'
      });
      sdk = window.Lexiom14Sdk.create({
        baseUrl: baseUrl(),
        getCredential: async function () {
          return credential;
        }
      });
      const created = await sdk.conversation.create({
        case_label: outcome.slice(0, 80)
      });
      caseRecord = {
        case_id: created.session_id,
        session_id: created.session_id,
        state: 'Draft',
        active_view: 'conversation',
        messages: [],
        structure: null,
        osn_yaml: null,
        build_ready: false,
        progress: [],
        package: null,
        evidence_approvals: {},
        attestation: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      if (unsub) unsub();
      unsub = sdk.conversation.subscribe(created.session_id, onLexiomEvent);
      persist();
      renderState();
      renderChat();
      renderChrome();
      setView('conversation');

      const generated = await sdk.conversation.generateOsn({
        session_id: created.session_id,
        outcome_description: outcome
      });
      if (generated && generated.osn_yaml) {
        caseRecord.osn_yaml = generated.osn_yaml;
      }
      if (generated && generated.structure) {
        caseRecord.structure = generated.structure;
      }
      if (generated && generated.build_readiness && generated.build_readiness.ready) {
        caseRecord.build_ready = true;
        if (caseRecord.state === 'Draft') setState('ReadyToRealize');
      }
      try {
        const state = await sdk.conversation.getState(created.session_id);
        if (state && Array.isArray(state.messages) && state.messages.length) {
          caseRecord.messages = state.messages;
        }
        if (state && state.osn_yaml) caseRecord.osn_yaml = state.osn_yaml;
        if (state && state.structure) caseRecord.structure = state.structure;
      } catch {
        /* events / generate result already applied */
      }
      persist();
      renderChat();
      renderChrome();
      renderStructure();
    } catch (e) {
      if (ui.welcomeError) {
        ui.welcomeError.hidden = false;
        ui.welcomeError.textContent = 'Start failed: ' + (e.message || e);
      }
      throw e;
    } finally {
      ui.btnStart.disabled = false;
    }
  }

  function onLexiomEvent(ev) {
    if (!caseRecord) return;
    if (ev.type === 'messageAccepted' && ev.payload.message) {
      if (!caseRecord.messages.some(function (m) { return m.id === ev.payload.message.id; })) {
        caseRecord.messages.push(ev.payload.message);
      }
      renderChat();
      persist();
    }
    if (ev.type === 'questionGenerated' && ev.payload.message) {
      if (!caseRecord.messages.some(function (m) { return m.id === ev.payload.message.id; })) {
        caseRecord.messages.push(ev.payload.message);
      }
      renderChat();
      persist();
    }
    if (ev.type === 'structureUpdated') {
      caseRecord.structure = ev.payload.structure;
      persist();
      renderChrome();
      renderStructure();
    }
    if (ev.type === 'buildReadinessChanged') {
      caseRecord.build_ready = !!(ev.payload.readiness && ev.payload.readiness.ready);
      if (caseRecord.build_ready && caseRecord.state === 'Draft') {
        setState('ReadyToRealize');
      } else if (!caseRecord.build_ready && caseRecord.state === 'ReadyToRealize') {
        setState('Draft');
      }
      persist();
      renderChrome();
    }
    if (ev.type === 'realizationStarted') {
      setState('Realizing');
      caseRecord.progress = [];
      setView('realization');
    }
    if (ev.type === 'stepStarted') {
      caseRecord.progress = caseRecord.progress || [];
      caseRecord.progress.push({
        step_id: ev.payload.step_id,
        label: ev.payload.label,
        status: 'active'
      });
      persist();
      renderProgress();
    }
    if (ev.type === 'stepCompleted') {
      (caseRecord.progress || []).forEach(function (s) {
        if (s.step_id === ev.payload.step_id) s.status = 'done';
      });
      persist();
      renderProgress();
    }
    if (ev.type === 'stepProgress') {
      renderProgress();
    }
    if (ev.type === 'realizationFailed') {
      caseRecord.progress = caseRecord.progress || [];
      caseRecord.progress.push({
        step_id: 'failed',
        label: (ev.payload.error && ev.payload.error.message) || 'Realization failed',
        status: 'active'
      });
      setState(caseRecord.build_ready ? 'ReadyToRealize' : 'Draft');
      persist();
      renderProgress();
      renderChrome();
    }
    if (ev.type === 'realizationCompleted') {
      // Auto-persist package into TRH SoR — NOT canonical
      caseRecord.package = ev.payload.package;
      caseRecord.evidence_approvals = caseRecord.evidence_approvals || {};
      setState('EvidenceReview');
      setView('evidence');
      renderEvidence();
      renderChrome();
    }
  }

  async function sendMessage() {
    if (!caseRecord || !sdk) return;
    const text = (ui.messageInput.value || '').trim();
    if (!text) return;
    ui.messageInput.value = '';
    ui.btnSend.disabled = true;
    try {
      await sdk.conversation.postMessage({
        session_id: caseRecord.session_id,
        text: text
      });
    } catch (e) {
      appendBubble('assistant', 'Could not send: ' + (e.message || e));
    } finally {
      ui.btnSend.disabled = false;
      ui.messageInput.focus();
    }
  }

  async function realize() {
    if (!caseRecord || !sdk || caseRecord.state !== 'ReadyToRealize') return;
    ui.btnRealize.disabled = true;
    caseRecord.progress = [];
    setState('Realizing');
    setView('realization');
    try {
      await sdk.realization.start({
        session_id: caseRecord.session_id,
        profile: 'document'
      });
    } catch (e) {
      caseRecord.progress.push({
        step_id: 'err',
        label: e.message || String(e),
        status: 'active'
      });
      setState('ReadyToRealize');
      renderProgress();
      renderChrome();
    }
  }

  function markCanonical() {
    if (!caseRecord || caseRecord.state !== 'HumanApproved') return;
    caseRecord.attestation = {
      at: new Date().toISOString(),
      by: 'trh_human',
      kind: 'attestation_record_poc'
    };
    setState('CanonicalSigned');
    setView('canonical');
    renderCanonical();
    renderChrome();
  }

  function wire() {
    ui.baseUrl.value = localStorage.getItem(LS_BASE) || DEFAULT_BASE;
    ui.btnSettings.onclick = function () {
      ui.settings.classList.toggle('open');
    };
    ui.btnStart.onclick = function () {
      startCase().catch(function (e) {
        if (ui.welcomeError && ui.welcomeError.hidden) {
          alert('Start failed: ' + (e.message || e));
        }
      });
    };
    ui.btnSend.onclick = sendMessage;
    ui.messageInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    ui.btnRealize.onclick = realize;
    ui.btnCanonical.onclick = markCanonical;
    ui.viewNav.querySelectorAll('button').forEach(function (btn) {
      btn.onclick = function () {
        setView(btn.dataset.view);
      };
    });
    document.querySelectorAll('[data-plane]').forEach(function (btn) {
      btn.onclick = function () {
        activePlane = btn.dataset.plane;
        document.querySelectorAll('[data-plane]').forEach(function (b) {
          b.classList.toggle('active', b === btn);
        });
        renderStructure();
      };
    });
    renderState();
    renderChrome();
  }

  wire();
})();
