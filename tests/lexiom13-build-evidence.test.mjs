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