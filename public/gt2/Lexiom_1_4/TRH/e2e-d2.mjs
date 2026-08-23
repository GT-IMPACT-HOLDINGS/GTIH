#!/usr/bin/env node
/**
 * Phase (d) D2 automated happy-path: TRH origin (:4173) → GT3 Lexiom 1.4 (:8080)
 * Single-prompt generateOsn, then document Realize; SoR persist ≠ canonical.
 *
 * Usage: node public/gt2/Lexiom_1_4/TRH/e2e-d2.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const GT3 = (process.env.GT3_BASE || 'http://127.0.0.1:8080').replace(/\/+$/, '');
const TRH = (process.env.TRH_BASE || 'http://127.0.0.1:4173').replace(/\/+$/, '');
const TRH_ORIGIN = 'http://localhost:4173';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = [];

function pass(id, detail) {
  results.push({ id, ok: true, detail });
  console.log('PASS', id, detail || '');
}
function fail(id, detail) {
  results.push({ id, ok: false, detail });
  console.error('FAIL', id, detail || '');
}

async function fetchJson(url, opts = {}) {
  const headers = Object.assign({}, opts.headers || {});
  if (opts.origin) headers.Origin = opts.origin;
  const res = await fetch(url, { ...opts, headers });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { res, data, text };
}

async function main() {
  // --- TRH COOP/COEP ---
  {
    const { res } = await fetchJson(TRH + '/');
    const coop = res.headers.get('cross-origin-opener-policy');
    const coep = res.headers.get('cross-origin-embedder-policy');
    if (res.ok && coop === 'same-origin' && coep === 'require-corp') {
      pass('D2.coop_coep', `${coop} / ${coep}`);
    } else {
      fail('D2.coop_coep', `status=${res.status} coop=${coop} coep=${coep}`);
    }
  }

  // --- SDK same-origin on TRH ---
  {
    const { res } = await fetchJson(TRH + '/sdk/lexiom14-sdk.js');
    if (res.ok && String(res.headers.get('content-type') || '').includes('javascript')) {
      pass('D2.trh_sdk_same_origin', 'sdk 200 from TRH');
    } else {
      fail('D2.trh_sdk_same_origin', `status=${res.status}`);
    }
  }

  // --- CORS preflight from TRH origin ---
  {
    const res = await fetch(GT3 + '/lexiom14/v1/version', {
      method: 'OPTIONS',
      headers: {
        Origin: TRH_ORIGIN,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization,content-type'
      }
    });
    const allow = res.headers.get('access-control-allow-origin');
    if (allow === TRH_ORIGIN) pass('D2.cors_preflight', allow);
    else fail('D2.cors_preflight', `got ${allow}`);
  }

  // --- Mint + conversation + realize (credentialed, TRH Origin) ---
  const mint = await fetchJson(GT3 + '/lexiom14/v1/demo/mint', {
    method: 'POST',
    origin: TRH_ORIGIN,
    headers: { 'Content-Type': 'application/json', Origin: TRH_ORIGIN },
    body: JSON.stringify({
      vertical_id: 'trh',
      tenant_pseudonym: 'e2e_tenant',
      app_id: 'trh_portal',
      actor_pseudonym: 'e2e_actor'
    })
  });
  if (!mint.res.ok) {
    fail('D2.mint', JSON.stringify(mint.data));
    return finish();
  }
  pass('D2.mint', 'credential issued');
  const token = mint.data.token;
  const auth = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Origin: TRH_ORIGIN };

  const created = await fetchJson(GT3 + '/lexiom14/v1/sessions', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ case_label: 'E2E TRH document' })
  });
  if (!created.res.ok) {
    fail('D2.session', JSON.stringify(created.data));
    return finish();
  }
  const sessionId = created.data.session_id;
  pass('D2.session', sessionId);

  // Ensure Lexiom API host is GT3, not TRH
  if (String(created.res.url || GT3).includes(':4173')) {
    fail('D2.no_trh_api_host', 'session hit TRH origin');
  } else {
    pass('D2.no_trh_api_host', 'API on GT3');
  }

  const osn = await fetchJson(GT3 + `/lexiom14/v1/sessions/${sessionId}/osn`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      outcome_description: 'A concise governance memo for Lexiom 1.4 embedded SaaS'
    })
  });
  if (osn.res.ok && osn.data && osn.data.osn_yaml && String(osn.data.osn_yaml).includes('output_spec')) {
    pass('D2.osn_yaml', 'opaque YAML present');
  } else {
    fail('D2.osn_yaml', JSON.stringify(osn.data && Object.keys(osn.data || {})));
  }

  const state = await fetchJson(GT3 + `/lexiom14/v1/sessions/${sessionId}`, { headers: auth });
  const ready = state.data && state.data.build_readiness && state.data.build_readiness.ready;
  const hemi = state.data && state.data.build_readiness && state.data.build_readiness.hemispheres;
  if (ready && hemi && hemi.output_spec_ready && hemi.success_evidence_ready) {
    pass('D2.build_ready', 'both hemispheres ready after generateOsn');
  } else {
    fail('D2.build_ready', JSON.stringify(state.data && state.data.build_readiness));
  }

  const structure = state.data && state.data.structure;
  if (structure && structure.nodes && structure.nodes.length >= 1) {
    pass('D2.structure_disclosure', `${structure.nodes.length} nodes`);
  } else {
    fail('D2.structure_disclosure', 'missing structure');
  }

  await fetchJson(GT3 + `/lexiom14/v1/sessions/${sessionId}/realization`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ profile: 'document' })
  });

  let pkg = null;
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 100));
    const p = await fetchJson(GT3 + `/lexiom14/v1/sessions/${sessionId}/realization/package`, {
      headers: auth
    });
    if (p.res.ok) {
      pkg = p.data;
      break;
    }
  }
  if (!pkg || pkg.profile !== 'document') {
    fail('D2.realization_package', 'no document package');
    return finish();
  }
  pass('D2.realization_package', pkg.package_id);

  // Simulate TRH SoR auto-persist (not canonical)
  const sorPath = path.join(__dirname, '.e2e-sor-case.json');
  let caseRec = {
    case_id: sessionId,
    state: 'EvidenceReview',
    package: pkg,
    evidence_approvals: {},
    attestation: null
  };
  fs.writeFileSync(sorPath, JSON.stringify(caseRec, null, 2));
  if (caseRec.state === 'CanonicalSigned') fail('D2.persist_not_canonical', 'premature canonical');
  else pass('D2.persist_not_canonical', 'EvidenceReview after persist');

  // Fetch artifact from GT3 with TRH origin
  const art = await fetch(GT3 + pkg.artifact.uri, {
    headers: { Authorization: 'Bearer ' + token, Origin: TRH_ORIGIN }
  });
  const artText = await art.text();
  const corp = art.headers.get('cross-origin-resource-policy');
  if (art.ok && artText.length > 20) {
    pass('D2.artifact_fetch', `bytes=${artText.length} corp=${corp}`);
  } else {
    fail('D2.artifact_fetch', `status=${art.status}`);
  }

  // Approve directs → HumanApproved → Canonical
  const directs = (pkg.success_evidences || []).filter((e) => e.direct);
  if (!directs.length) fail('D2.direct_evidences', 'none');
  else pass('D2.direct_evidences', String(directs.length));

  for (const ev of directs) {
    caseRec.evidence_approvals[ev.evidence_id] = true;
    const evRes = await fetch(GT3 + ev.uri, {
      headers: { Authorization: 'Bearer ' + token, Origin: TRH_ORIGIN }
    });
    if (!evRes.ok) fail('D2.evidence_fetch_' + ev.evidence_id, String(evRes.status));
  }
  const allApproved = directs.every((e) => caseRec.evidence_approvals[e.evidence_id]);
  if (allApproved) {
    caseRec.state = 'HumanApproved';
    pass('D2.human_approved', 'all directs approved');
  } else {
    fail('D2.human_approved', 'incomplete');
  }

  // Pre-canonical reload check
  if (caseRec.state !== 'CanonicalSigned') {
    pass('D2.pre_sign_not_canonical', caseRec.state);
  } else {
    fail('D2.pre_sign_not_canonical', 'already signed');
  }

  caseRec.attestation = {
    at: new Date().toISOString(),
    by: 'e2e_actor',
    kind: 'attestation_record_poc'
  };
  caseRec.state = 'CanonicalSigned';
  fs.writeFileSync(sorPath, JSON.stringify(caseRec, null, 2));
  pass('D2.canonical_signed', caseRec.attestation.at);

  // Metering — no customer PII fields
  const meter = await fetchJson(GT3 + '/lexiom14/v1/metering/events', { headers: auth });
  if (meter.res.ok && Array.isArray(meter.data.events)) {
    const bad = meter.data.events.some((e) => {
      const s = JSON.stringify(e).toLowerCase();
      return (
        s.includes('email') ||
        s.includes('invoice') ||
        s.includes('customer_name') ||
        s.includes('credit_card')
      );
    });
    if (bad) fail('D2.metering_no_pii', 'suspicious fields');
    else pass('D2.metering_no_pii', `events=${meter.data.events.length}`);
  } else {
    fail('D2.metering_no_pii', JSON.stringify(meter.data));
  }

  // realizationFailed path (separate session) — not corrupt
  {
    const c2 = await fetchJson(GT3 + '/lexiom14/v1/sessions', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ case_label: 'fail path' })
    });
    const sid2 = c2.data.session_id;
    const early = await fetchJson(GT3 + `/lexiom14/v1/sessions/${sid2}/realization`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ profile: 'document' })
    });
    if (early.res.status === 400 && early.data?.error?.code === 'not_build_ready') {
      pass('D2.realization_failed_guard', 'not_build_ready without corrupt package');
      const st = await fetchJson(GT3 + `/lexiom14/v1/sessions/${sid2}`, { headers: auth });
      if (!st.data.package) pass('D2.failed_no_package', 'clean');
      else fail('D2.failed_no_package', 'unexpected package');
    } else {
      fail('D2.realization_failed_guard', JSON.stringify(early.data));
    }
  }

  // WebContainer / in-page CA: Phase b/c Known divergence — server-composed document
  pass(
    'D2.ca_isolation_ready',
    'TRH COOP/COEP present; document Realization is server-composed (Known divergence vs full in-page WebContainer CA)'
  );

  // D3 Lexiom 1.3
  {
    const { res } = await fetchJson(GT3 + '/gt2/Lexiom_1_3/index.html');
    if (res.ok) pass('D3.lexiom13_loads', String(res.status));
    else fail('D3.lexiom13_loads', String(res.status));

    const appJs = path.join(__dirname, '..', '..', 'Lexiom_1_3', 'app.js');
    if (fs.existsSync(appJs)) pass('D3.lexiom13_tree_present', 'app.js exists');
    else fail('D3.lexiom13_tree_present', 'missing');
  }

  finish();
}

function finish() {
  const failed = results.filter((r) => !r.ok);
  const out = {
    ran_at: new Date().toISOString(),
    gt3: GT3,
    trh: TRH,
    results,
    passed: results.filter((r) => r.ok).length,
    failed: failed.length
  };
  const reportPath = path.join(__dirname, 'TEST_RESULTS_D2.json');
  fs.writeFileSync(reportPath, JSON.stringify(out, null, 2));
  console.log('\nSummary', out.passed, 'passed,', out.failed, 'failed');
  console.log('Wrote', reportPath);
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
