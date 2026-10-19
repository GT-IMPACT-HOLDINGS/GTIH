import assert from 'node:assert/strict';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  EVIDENCE_AGENT_PROMPT_FILENAME,
  EVIDENCE_PLAN_FILENAME,
  buildEvidenceAgentPromptText,
  buildEvidenceCollectionPlan,
  buildEvidenceExpectedRelativePath
} from '../lib/lexiom13BuildEvidence.js';
import { prepareLexiom13Build } from '../lib/lexiom13BuildPlugins.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const STATIC_ROOT = path.join(REPO_ROOT, 'public');

test('evidence plan builds pointer targets without inspection_prompt echo', () => {
  const osn = {
    id: 'GT_Philosophy.ProductLexiom.UX.a1000003.osn',
    file_name: 'GT_Philosophy.ProductLexiom.UX.a1000003.osn',
    success_evidences: [
      {
        evidence_id: 'sev.ux.screenshot',
        kind: 'SCREEN-SHOT',
        direct: true,
        inspection_prompt: 'SECRET_PROMPT_MUST_NOT_LEAK'
      },
      {
        evidence_id: 'sev.ux.brief',
        kind: 'markdown_brief',
        direct: false,
        inspection_prompt: 'ANOTHER_SECRET'
      }
    ]
  };
  const snapshotById = new Map([
    [
      osn.id,
      {
        id: osn.id,
        snapshot_path: 'osng/GT_Philosophy.ProductLexiom.UX.a1000003.osn.yaml'
      }
    ]
  ]);

  const plan = buildEvidenceCollectionPlan({
    runId: 'test_run',
    pluginId: 'lexiom13.software_coding_builder',
    subgraphOsns: [osn],
    snapshotById
  });

  assert.equal(plan.summary.total, 2);
  assert.equal(plan.summary.direct, 1);
  assert.equal(plan.summary.derivative, 1);
  assert.equal(plan.targets[0].kind, 'SCREEN-SHOT');
  assert.equal(
    plan.targets[0].expected_relative_path,
    'evidences/GT_Philosophy.ProductLexiom.UX.a1000003.osn.sev.ux.screenshot.v1.png'
  );
  const serialized = JSON.stringify(plan);
  assert.equal(serialized.includes('SECRET_PROMPT_MUST_NOT_LEAK'), false);
  assert.equal(serialized.includes('ANOTHER_SECRET'), false);
  assert.equal(serialized.includes('inspection_prompt'), false);
});

test('evidence agent prompt is CA/Real Bolt protocol without Cursor manual steps', () => {
  const plan = {
    summary: { total: 2, direct: 1, derivative: 1 }
  };
  const prompt = buildEvidenceAgentPromptText(
    {
      output_directory: 'C:/tmp/build',
      plugin_id: 'lexiom13.software_coding_builder',
      osng_dir: 'osng',
      osng_basics_path: 'OSNG_Basics_README.md'
    },
    plan
  );
  assert.match(prompt, new RegExp(EVIDENCE_PLAN_FILENAME));
  assert.match(prompt, /EVIDENCE_MANIFEST\.json/);
  assert.match(prompt, /\.\/osng\//);
  assert.match(prompt, /CA \/ Real Bolt/);
  assert.match(prompt, /entries\[\]/);
  assert.equal(prompt.includes('Cursor'), false);
  assert.equal(prompt.includes('File → Open Folder'), false);
  // Field names may appear as instructions to open YAML; body text must not.
  assert.equal(prompt.includes('SECRET_PROMPT'), false);
  assert.equal(prompt.includes('Govern the welcome SPA'), false);
  assert.match(prompt, /inspection_prompt/);
  assert.match(prompt, /Aligning excerpts to the DoE narrative/);
  assert.match(prompt, /proving locus/);
});

test('validateEvidenceManifestAfterSync requires full plan coverage', async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'lexiom13-ev-validate-'));
  const plan = {
    schema_version: 'lexiom13-evidence-collection/1',
    targets: [
      {
        target_id: 'a.osn::sev.one',
        evidence_id: 'sev.one',
        expected_relative_path: 'evidences/a.osn.sev.one.v1.md'
      },
      {
        target_id: 'a.osn::sev.video',
        evidence_id: 'sev.video',
        expected_relative_path: 'evidences/a.osn.sev.video.v1.webm'
      }
    ]
  };
  await fsp.writeFile(path.join(dir, EVIDENCE_PLAN_FILENAME), JSON.stringify(plan), 'utf8');
  await fsp.mkdir(path.join(dir, 'evidences'));
  await fsp.writeFile(path.join(dir, 'evidences', 'a.osn.sev.one.v1.md'), 'quote', 'utf8');

  const incomplete = {
    schema_version: 'lexiom13-evidence-manifest/1',
    entries: [
      {
        target_id: 'a.osn::sev.one',
        status: 'collected',
        artifact_paths: ['evidences/a.osn.sev.one.v1.md']
      }
    ]
  };
  await fsp.writeFile(
    path.join(dir, 'EVIDENCE_MANIFEST.json'),
    JSON.stringify(incomplete),
    'utf8'
  );
  const { validateEvidenceManifestAfterSync } = await import(
    '../lib/lexiom13BuildEvidence.js'
  );
  const bad = await validateEvidenceManifestAfterSync(dir);
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, 'evidence_coverage_incomplete');

  const complete = {
    schema_version: 'lexiom13-evidence-manifest/1',
    collected_at: new Date().toISOString(),
    entries: [
      {
        target_id: 'a.osn::sev.one',
        status: 'collected',
        artifact_paths: ['evidences/a.osn.sev.one.v1.md'],
        collected_by: 'agent'
      },
      {
        target_id: 'a.osn::sev.video',
        status: 'deferred',
        notes: 'Capture UI walkthrough manually',
        collected_by: 'agent'
      }
    ]
  };
  await fsp.writeFile(
    path.join(dir, 'EVIDENCE_MANIFEST.json'),
    JSON.stringify(complete),
    'utf8'
  );
  const ok = await validateEvidenceManifestAfterSync(dir);
  assert.equal(ok.ok, true);
  assert.equal(ok.summary.total, 2);

  await fsp.rm(dir, { recursive: true, force: true });
});

test('prepareLexiom13Build writes plan + both agent prompts without launching an agent', async () => {
  const buildsParent = await fsp.mkdtemp(path.join(os.tmpdir(), 'lexiom13-evidence-'));
  const fakeRepo = path.join(buildsParent, 'repo');
  await fsp.mkdir(path.join(fakeRepo, 'builds', 'lexiom13'), { recursive: true });

  const handoff = await prepareLexiom13Build(STATIC_ROOT, fakeRepo, {
    compilation_root_osn_id: 'GT_Philosophy.ProductLexiom.a1000002.osn'
  });

  assert.ok(handoff.evidence_collection);
  assert.ok(handoff.evidence_collection.summary.total >= 1);

  const outDir = handoff.output_directory;
  const planRaw = await fsp.readFile(path.join(outDir, EVIDENCE_PLAN_FILENAME), 'utf8');
  const plan = JSON.parse(planRaw);
  assert.equal(plan.summary.total, handoff.evidence_collection.summary.total);
  assert.ok(Array.isArray(plan.targets));
  assert.ok(plan.targets.every((t) => t.expected_relative_path && t.snapshot_path));
  assert.equal(planRaw.includes('inspection_prompt'), false);

  const agentPrompt = await fsp.readFile(path.join(outDir, 'AGENT_PROMPT.md'), 'utf8');
  const evidencePrompt = await fsp.readFile(
    path.join(outDir, EVIDENCE_AGENT_PROMPT_FILENAME),
    'utf8'
  );
  assert.match(agentPrompt, new RegExp(EVIDENCE_AGENT_PROMPT_FILENAME));
  assert.match(agentPrompt, /Evidence collection is out of scope/);
  assert.match(evidencePrompt, new RegExp(EVIDENCE_PLAN_FILENAME));
  assert.match(evidencePrompt, /\.\/osng\//);

  // Lean: do not echo ProductLexiom output_spec body fragments into either prompt.
  assert.equal(agentPrompt.includes('make them green'), false);
  assert.equal(evidencePrompt.includes('Focus-centered left graph'), false);

  await fsp.rm(buildsParent, { recursive: true, force: true });
});

test('successful builder report runs host quote-span evidence when plan has targets', async () => {
  const { issueCaJobTicket, writeSessionArtifacts } = await import(
    '../lib/lexiom13CaDispatcher.js'
  );
  const { reportLexiom13CaSession } = await import('../lib/lexiom13BuildPlugins.js');
  const {
    setEvidenceSpanCompleteChatForTests
  } = await import('../lib/lexiom13EvidenceSpanCollect.js');

  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'lexiom13-ev-chain-'));
  const plan = {
    schema_version: 'lexiom13-evidence-collection/1',
    run_id: 'chain_run',
    plugin_id: 'lexiom13.document_builder',
    targets: [
      {
        target_id: 'root.osn::sev.doc',
        osn_id: 'root.osn',
        evidence_id: 'sev.doc',
        kind: 'TEXTUAL_SNIPPET',
        direct: true,
        expected_relative_path: 'evidences/root.osn.sev.doc.v1.md'
      },
      {
        target_id: 'root.osn::sev.shot',
        osn_id: 'root.osn',
        evidence_id: 'sev.shot',
        kind: 'SCREEN-SHOT',
        direct: true,
        expected_relative_path: 'evidences/root.osn.sev.shot.v1.png'
      }
    ],
    summary: { total: 2, direct: 2, derivative: 0 }
  };
  await fsp.writeFile(path.join(root, EVIDENCE_PLAN_FILENAME), JSON.stringify(plan), 'utf8');
  await fsp.writeFile(
    path.join(root, 'HANDOFF.json'),
    JSON.stringify({
      run_id: 'chain_run',
      plugin_id: 'lexiom13.document_builder',
      compilation_root_osn_id: 'root.osn',
      output_directory: root
    }),
    'utf8'
  );
  await fsp.writeFile(path.join(root, EVIDENCE_AGENT_PROMPT_FILENAME), '# evidence\n', 'utf8');
  await fsp.writeFile(path.join(root, 'AGENT_PROMPT.md'), '# builder\n', 'utf8');

  const ticket = issueCaJobTicket({
    runId: 'chain_run',
    pluginId: 'lexiom13.document_builder',
    outputDirectory: root,
    pass: 'builder'
  });

  const { getCaSession } = await import('../lib/lexiom13CaSessionRegistry.js');
  const session = getCaSession(ticket.session_id);
  assert.ok(session);

  const sud = '# Brand book\n\nGoverned outcomes.\n';
  await writeSessionArtifacts(
    ticket.session_id,
    {
      files: [
        { path: 'OUTLINE.md', content: '# Outline' },
        { path: 'document.md', content: sud }
      ]
    },
    ticket.capability_token
  );

  const needle = 'Governed outcomes.';
  const start = sud.indexOf(needle);
  assert.ok(start >= 0);
  setEvidenceSpanCompleteChatForTests(async () => ({
    ok: true,
    content: JSON.stringify({
      quotes: [{ target_id: 'root.osn::sev.doc', start, end: start + needle.length }]
    })
  }));

  try {
    const report = await reportLexiom13CaSession(
      ticket.session_id,
      { status: 'completed', latency_ms: 12 },
      ticket.capability_token
    );

    assert.equal(report.status, 'completed');
    assert.equal(report.pass, 'evidence');
    assert.equal(report.evidence_mode, 'quote_spans');
    assert.equal(report.evidence_ca_session, null);
    assert.equal(report.next_pass == null, true);
    assert.equal(typeof report.bud_written, 'boolean');

    const done = JSON.parse(await fsp.readFile(path.join(root, 'RUN_RESULT.json'), 'utf8'));
    assert.equal(done.status, 'completed');
    assert.equal(done.pass, 'evidence');
    assert.equal(typeof done.bud_written, 'boolean');
    assert.match(
      await fsp.readFile(path.join(root, 'evidences', 'root.osn.sev.doc.v1.md'), 'utf8'),
      /Governed outcomes/
    );
    const manifest = JSON.parse(
      await fsp.readFile(path.join(root, 'EVIDENCE_MANIFEST.json'), 'utf8')
    );
    assert.equal(manifest.collection_mode, 'quote_spans');
    const shot = manifest.entries.find((e) => e.target_id === 'root.osn::sev.shot');
    assert.equal(shot.status, 'deferred');
  } finally {
    setEvidenceSpanCompleteChatForTests(null);
    await fsp.rm(root, { recursive: true, force: true });
  }
});

test('host quote-span evidence fails without LM fallback when spans are missing', async () => {
  const {
    collectEvidenceByQuoteSpans,
    setEvidenceSpanCompleteChatForTests
  } = await import('../lib/lexiom13EvidenceSpanCollect.js');

  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'lexiom13-ev-span-fail-'));
  await fsp.writeFile(
    path.join(root, EVIDENCE_PLAN_FILENAME),
    JSON.stringify({
      schema_version: 'lexiom13-evidence-collection/1',
      targets: [
        {
          target_id: 'a::e1',
          osn_id: 'a',
          evidence_id: 'e1',
          kind: 'TEXTUAL_SNIPPET',
          expected_relative_path: 'evidences/a.e1.v1.md'
        }
      ]
    }),
    'utf8'
  );
  await fsp.writeFile(path.join(root, 'document.md'), 'hello world', 'utf8');
  setEvidenceSpanCompleteChatForTests(async () => ({
    ok: true,
    content: JSON.stringify({ quotes: [] })
  }));
  try {
    const result = await collectEvidenceByQuoteSpans({
      run_id: 'fail_run',
      plugin_id: 'lexiom13.document_builder',
      output_directory: root
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'evidence_span_incomplete');
  } finally {
    setEvidenceSpanCompleteChatForTests(null);
    await fsp.rm(root, { recursive: true, force: true });
  }
});

test('span prompt exposes doe_claim and DoE alignment rubric', async () => {
  const { buildSpanPromptMessages } = await import('../lib/lexiom13EvidenceSpanCollect.js');
  const messages = buildSpanPromptMessages({
    sudPath: 'index.html',
    sudText: '<html>Hello</html>',
    targets: [
      {
        target_id: 'a::e1',
        osn_id: 'a',
        evidence_id: 'e1',
        kind: 'TEXTUAL_SNIPPET',
        direct: true,
        doe_claim: "The greeting showing 'Hello' followed by the user name",
        hint: 'Ship a greeting SPA — The greeting showing Hello',
        selection_goal: 'verbatim_passage_that_proves_doe_claim'
      }
    ]
  });
  const system = messages.find((m) => m.role === 'system')?.content || '';
  const user = messages.find((m) => m.role === 'user')?.content || '';
  assert.match(system, /DoE alignment rubric/);
  assert.match(system, /doe_claim/);
  assert.match(system, /"proves"/);
  assert.match(system, /Greeting \/ displayed-message/);
  assert.match(user, /doe_claim/);
  assert.match(user, /Hello' followed by the user name/);
  assert.match(user, /verbatim_passage_that_proves_doe_claim/);
});

test('YAML snapshot hint includes inspection_prompt for software OSNs', async () => {
  const { inspectionPromptFromYaml, hintFromOsnSnapshot, doeFieldsFromOsnSnapshot } = await import(
    '../lib/lexiom13EvidenceSpanCollect.js'
  );
  const yaml = `
id: demo.osn
output_spec: |-
  Ship a Bootstrap SPA with CDN tags.
success_evidences:
  - evidence_id: ev.direct.textual_snippet.1
    kind: TEXTUAL_SNIPPET
    direct: true
    inspection_prompt: The Bootstrap CDN stylesheet link and script tags in the delivered index.html
compilation:
  can_be_compilation_root: true
`;
  assert.match(
    inspectionPromptFromYaml(yaml, 'ev.direct.textual_snippet.1'),
    /Bootstrap CDN stylesheet/
  );
  const fields = doeFieldsFromOsnSnapshot(
    yaml,
    'osng/demo.osn.yaml',
    'ev.direct.textual_snippet.1'
  );
  assert.match(fields.doe_claim, /Bootstrap CDN stylesheet/);
  assert.equal(fields.doe_claim.includes('Ship a Bootstrap SPA'), false);
  assert.match(fields.hint, /Bootstrap CDN/);
  assert.match(fields.hint, /Ship a Bootstrap SPA/);
  assert.match(
    hintFromOsnSnapshot(yaml, 'osng/demo.osn.yaml', 'ev.direct.textual_snippet.1'),
    /Bootstrap CDN/
  );
});

test('software SCREEN-SHOT defers when Playwright browsers are missing', async () => {
  const { collectEvidenceByQuoteSpans, setEvidenceSpanCompleteChatForTests } =
    await import('../lib/lexiom13EvidenceSpanCollect.js');
  const {
    setEvidenceBrowserCaptureForTests,
    shouldDeferScreenshotFailure
  } = await import('../lib/lexiom13EvidenceBrowserCapture.js');

  assert.equal(
    shouldDeferScreenshotFailure(
      'evidence_shot_no_playwright',
      'Executable does not exist'
    ),
    true
  );

  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'lexiom13-ev-shot-defer-'));
  const rel = 'evidences/soft.osn.ev.direct.screen_shot.1.v1.png';
  await fsp.writeFile(
    path.join(root, EVIDENCE_PLAN_FILENAME),
    JSON.stringify({
      schema_version: 'lexiom13-evidence-collection/1',
      targets: [
        {
          target_id: 'soft.osn::ev.direct.screen_shot.1',
          osn_id: 'soft.osn',
          evidence_id: 'ev.direct.screen_shot.1',
          kind: 'SCREEN-SHOT',
          direct: true,
          expected_relative_path: rel
        },
        {
          target_id: 'std.osn::ev.direct.textual_snippet.1',
          osn_id: 'std.osn',
          evidence_id: 'ev.direct.textual_snippet.1',
          kind: 'TEXTUAL_SNIPPET',
          direct: true,
          expected_relative_path: 'evidences/std.osn.ev.direct.textual_snippet.1.v1.md'
        }
      ]
    }),
    'utf8'
  );
  const html = '<html><body>cdn.jsdelivr.net/npm/bootstrap snippet</body></html>';
  await fsp.writeFile(path.join(root, 'index.html'), html, 'utf8');

  setEvidenceBrowserCaptureForTests(async () => ({
    ok: false,
    reason: 'evidence_shot_no_playwright',
    detail:
      "browserType.launch: Executable doesn't exist\nRun: npx playwright install chromium"
  }));
  const needle = 'cdn.jsdelivr.net/npm/bootstrap';
  const start = html.indexOf(needle);
  setEvidenceSpanCompleteChatForTests(async () => ({
    ok: true,
    content: JSON.stringify({
      quotes: [
        {
          target_id: 'std.osn::ev.direct.textual_snippet.1',
          start,
          end: start + needle.length
        }
      ]
    })
  }));

  try {
    const result = await collectEvidenceByQuoteSpans({
      run_id: 'shot_defer',
      plugin_id: 'lexiom13.software_coding_builder',
      output_directory: root
    });
    assert.equal(result.ok, true, result.detail || result.reason);
    assert.equal(result.summary.deferred, 1);
    assert.equal(result.summary.collected, 1);
    const manifest = JSON.parse(
      await fsp.readFile(path.join(root, 'EVIDENCE_MANIFEST.json'), 'utf8')
    );
    const shot = manifest.entries.find((e) =>
      String(e.target_id).includes('screen_shot')
    );
    const snip = manifest.entries.find((e) =>
      String(e.target_id).includes('textual_snippet')
    );
    assert.equal(shot.status, 'deferred');
    assert.match(shot.notes, /playwright install chromium/i);
    assert.equal(snip.status, 'collected');
  } finally {
    setEvidenceBrowserCaptureForTests(null);
    setEvidenceSpanCompleteChatForTests(null);
    await fsp.rm(root, { recursive: true, force: true });
  }
});

test('software SCREEN-SHOT collects via host browser capture hook', async () => {
  const {
    collectEvidenceByQuoteSpans,
    setEvidenceSpanCompleteChatForTests
  } = await import('../lib/lexiom13EvidenceSpanCollect.js');
  const { setEvidenceBrowserCaptureForTests } = await import(
    '../lib/lexiom13EvidenceBrowserCapture.js'
  );

  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'lexiom13-ev-shot-'));
  const rel = 'evidences/soft.osn.ev.direct.screen_shot.1.v1.png';
  await fsp.writeFile(
    path.join(root, EVIDENCE_PLAN_FILENAME),
    JSON.stringify({
      schema_version: 'lexiom13-evidence-collection/1',
      targets: [
        {
          target_id: 'soft.osn::ev.direct.screen_shot.1',
          osn_id: 'soft.osn',
          evidence_id: 'ev.direct.screen_shot.1',
          kind: 'SCREEN-SHOT',
          direct: true,
          expected_relative_path: rel
        }
      ]
    }),
    'utf8'
  );
  await fsp.writeFile(
    path.join(root, 'index.html'),
    '<!doctype html><title>Hi</title><body>Hello</body>',
    'utf8'
  );

  setEvidenceBrowserCaptureForTests(async ({ expectedRelativePath, outDir }) => {
    const abs = path.join(outDir, ...String(expectedRelativePath).split('/'));
    await fsp.mkdir(path.dirname(abs), { recursive: true });
    await fsp.writeFile(abs, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), 'binary');
    return {
      ok: true,
      artifact_path: expectedRelativePath,
      preview_url: 'http://127.0.0.1:8080/lexiom13/preview/soft/',
      collected_by: 'host_browser_shot'
    };
  });
  setEvidenceSpanCompleteChatForTests(async () => {
    throw new Error('span LM must not run for screenshot-only plans');
  });

  try {
    const result = await collectEvidenceByQuoteSpans({
      run_id: 'shot_run',
      plugin_id: 'lexiom13.software_coding_builder',
      output_directory: root
    });
    assert.equal(result.ok, true, result.detail || result.reason);
    assert.equal(result.summary.shot_targets, 1);
    assert.equal(result.summary.span_targets, 0);
    const st = await fsp.stat(path.join(root, ...rel.split('/')));
    assert.ok(st.size > 0);
    const manifest = JSON.parse(
      await fsp.readFile(path.join(root, 'EVIDENCE_MANIFEST.json'), 'utf8')
    );
    assert.equal(manifest.entries[0].status, 'collected');
    assert.equal(manifest.entries[0].collected_by, 'host_browser_shot');
  } finally {
    setEvidenceBrowserCaptureForTests(null);
    setEvidenceSpanCompleteChatForTests(null);
    await fsp.rm(root, { recursive: true, force: true });
  }
});

test('software quote-span collects from index.html only (not RUN_TRACE)', async () => {
  const {
    collectEvidenceByQuoteSpans,
    setEvidenceSpanCompleteChatForTests
  } = await import('../lib/lexiom13EvidenceSpanCollect.js');

  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'lexiom13-ev-soft-direct-'));
  const html =
    '<!doctype html><html><head>' +
    '<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">' +
    '</head><body><h1>Hello</h1></body></html>\n';
  const trace =
    '# RUN_TRACE\n### Checks\n2. Bootstrap CDN CSS link present\n3. Bootstrap CDN JS script present\n';
  await fsp.writeFile(
    path.join(root, EVIDENCE_PLAN_FILENAME),
    JSON.stringify({
      schema_version: 'lexiom13-evidence-collection/1',
      targets: [
        {
          target_id: 'soft.osn::ev.direct.textual_snippet.1',
          osn_id: 'soft.osn',
          evidence_id: 'ev.direct.textual_snippet.1',
          kind: 'TEXTUAL_SNIPPET',
          direct: true,
          snapshot_path: 'osng/soft.osn.yaml',
          expected_relative_path:
            'evidences/soft.osn.ev.direct.textual_snippet.1.v1.md'
        }
      ]
    }),
    'utf8'
  );
  await fsp.mkdir(path.join(root, 'osng'), { recursive: true });
  await fsp.writeFile(
    path.join(root, 'osng', 'soft.osn.yaml'),
    [
      'id: soft.osn',
      'success_evidences:',
      '  - evidence_id: ev.direct.textual_snippet.1',
      '    kind: TEXTUAL_SNIPPET',
      '    direct: true',
      '    inspection_prompt: The Bootstrap CDN stylesheet link in index.html',
      ''
    ].join('\n'),
    'utf8'
  );
  await fsp.writeFile(path.join(root, 'index.html'), html, 'utf8');
  await fsp.writeFile(path.join(root, 'RUN_TRACE.md'), trace, 'utf8');

  const needle = 'cdn.jsdelivr.net/npm/bootstrap@5.3.0';
  const start = html.indexOf(needle);
  assert.ok(start >= 0);
  setEvidenceSpanCompleteChatForTests(async ({ messages }) => {
    const user = messages.find((m) => m.role === 'user')?.content || '';
    assert.match(user, /cdn\.jsdelivr\.net/);
    assert.doesNotMatch(user, /RUN_TRACE/);
    assert.match(user, /doe_claim/);
    assert.match(user, /Bootstrap CDN stylesheet/);
    const system = messages.find((m) => m.role === 'system')?.content || '';
    assert.match(system, /DoE alignment rubric/);
    return {
      ok: true,
      content: JSON.stringify({
        quotes: [
          {
            target_id: 'soft.osn::ev.direct.textual_snippet.1',
            start,
            end: start + needle.length,
            proves: 'Bootstrap CDN stylesheet link'
          }
        ]
      })
    };
  });

  try {
    const result = await collectEvidenceByQuoteSpans({
      run_id: 'soft_direct',
      plugin_id: 'lexiom13.software_coding_builder',
      output_directory: root
    });
    assert.equal(result.ok, true, result.detail || result.reason);
    const excerpt = await fsp.readFile(
      path.join(root, 'evidences', 'soft.osn.ev.direct.textual_snippet.1.v1.md'),
      'utf8'
    );
    assert.match(excerpt, /cdn\.jsdelivr\.net/);
    assert.doesNotMatch(excerpt, /Checks Performed|CDN CSS link present/);
    const manifest = JSON.parse(
      await fsp.readFile(path.join(root, 'EVIDENCE_MANIFEST.json'), 'utf8')
    );
    assert.equal(manifest.sud_path, 'index.html');
    assert.deepEqual(manifest.entries[0].source_artifact_paths, ['index.html']);
  } finally {
    setEvidenceSpanCompleteChatForTests(null);
    await fsp.rm(root, { recursive: true, force: true });
  }
});