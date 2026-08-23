/**
 * Quick Phase b smoke against a running GT3 server.
 * Usage: node public/gt2/Lexiom_1_4/host/smoke-node.mjs [baseUrl]
 */
const base = (process.argv[2] || 'http://127.0.0.1:8080').replace(/\/+$/, '');

async function j(path, opts = {}) {
  const res = await fetch(base + path, opts);
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const err = new Error(JSON.stringify(data));
    err.status = res.status;
    throw err;
  }
  return data;
}

const mint = await j('/lexiom14/v1/demo/mint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ vertical_id: 'trh', actor_pseudonym: 'smoke' })
});
const headers = {
  Authorization: 'Bearer ' + mint.token,
  'Content-Type': 'application/json'
};
const { session_id } = await j('/lexiom14/v1/sessions', {
  method: 'POST',
  headers,
  body: JSON.stringify({ case_label: 'Smoke doc' })
});
await j('/lexiom14/v1/sessions/' + session_id + '/osn', {
  method: 'POST',
  headers,
  body: JSON.stringify({
    outcome_description: 'Write a short philosophy memo'
  })
});
const state = await j('/lexiom14/v1/sessions/' + session_id, { headers });
if (!state.build_readiness.ready) throw new Error('not ready');
await j('/lexiom14/v1/sessions/' + session_id + '/realization', {
  method: 'POST',
  headers,
  body: JSON.stringify({ profile: 'document' })
});
let pkg = null;
for (let i = 0; i < 40; i++) {
  await new Promise((r) => setTimeout(r, 100));
  try {
    pkg = await j('/lexiom14/v1/sessions/' + session_id + '/realization/package', {
      headers
    });
    break;
  } catch {
    /* wait */
  }
}
if (!pkg) throw new Error('no package');
const art = await fetch(base + pkg.artifact.uri, { headers });
if (!art.ok) throw new Error('artifact fetch failed');

const opt = await fetch(base + '/lexiom14/v1/version', {
  method: 'OPTIONS',
  headers: {
    Origin: 'http://localhost:4173',
    'Access-Control-Request-Method': 'GET'
  }
});
const allow = opt.headers.get('access-control-allow-origin');
if (allow !== 'http://localhost:4173') {
  throw new Error('CORS allow origin missing: ' + allow);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      session_id,
      package_id: pkg.package_id,
      artifact_bytes: (await art.text()).length,
      cors: allow
    },
    null,
    2
  )
);
