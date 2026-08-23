import assert from 'node:assert/strict';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import yaml from 'js-yaml';

import {
  buildBudRecord,
  persistBudOnRequestingOsn,
  writeBudAfterSuccessfulRun
} from '../lib/lexiom13BudPersist.js';
import {
  resolveBudArtifactFile,
  resolveBudPreviewFile
} from '../lib/lexiom13BudServe.js';

test('buildBudRecord shapes document vs software pointers', () => {
  const doc = buildBudRecord({
    run_id: 'run_doc',
    plugin_id: 'lexiom13.document_builder'
  });
  assert.equal(doc.media_kind, 'document');
  assert.equal(doc.entry_file_name, 'document.md');
  assert.match(doc.artifact_path, /\/lexiom13\/build\/run_doc\/artifact\/document\.md/);
  assert.equal(doc.preview_path, null);

  const soft = buildBudRecord({
    run_id: 'run_soft',
    plugin_id: 'lexiom13.software_coding_builder'
  });
  assert.equal(soft.media_kind, 'software');
  assert.equal(soft.entry_file_name, 'index.html');
  assert.match(soft.preview_path, /\/lexiom13\/preview\/run_soft\/$/);
});

test('persistBudOnRequestingOsn writes bud onto live OSN YAML', async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'lexiom13-bud-'));
  const staticRoot = path.join(root, 'public');
  const osnDir = path.join(staticRoot, 'gt2', 'Lexiom_1_3');
  await fsp.mkdir(osnDir, { recursive: true });
  const osnId = 'Test.Brand.a1000999.osn';
  const osn = {
    id: osnId,
    file_name: osnId,
    owner: { display_name: 'Tester' },
    title: 'Test',
    seed: 'Seed text for bud persist.',
    thematic_lenses: [{ lens_id: 'l1', name: 'Lens' }],
    output_spec: 'Deliver a brand book.',
    success_evidences: [
      {
        evidence_id: 'sev.test',
        kind: 'TEXTUAL_SNIPPET',
        direct: true,
        inspection_prompt: 'Quote the document.'
      }
    ],
    compilation: {
      can_be_compilation_root: true,
      compilation_scope: 'self_only',
      target_tool_profile: 'brand_document_agent'
    },
    graph: { parent_osn_ids: [], child_osn_ids: [] }
  };
  await fsp.writeFile(
    path.join(osnDir, `${osnId}.yaml`),
    yaml.dump(osn),
    'utf8'
  );

  const bud = buildBudRecord({
    run_id: 'msbudtest_1',
    plugin_id: 'lexiom13.document_builder'
  });
  const result = await persistBudOnRequestingOsn(staticRoot, osnId, bud);
  assert.equal(result.ok, true);
  assert.equal(result.bud.run_id, 'msbudtest_1');

  const reloaded = yaml.load(
    await fsp.readFile(path.join(osnDir, `${osnId}.yaml`), 'utf8')
  );
  assert.equal(reloaded.bud.schema_version, 'lexiom13-bud/1');
  assert.equal(reloaded.bud.media_kind, 'document');
  assert.equal(reloaded.seed, osn.seed);

  await fsp.rm(root, { recursive: true, force: true });
});

test('writeBudAfterSuccessfulRun requires primary + readable evidence', async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'lexiom13-bud-run-'));
  const staticRoot = path.join(root, 'public');
  const osnDir = path.join(staticRoot, 'gt2', 'Lexiom_1_3');
  const outDir = path.join(root, 'builds', 'lexiom13', 'bud_run_1');
  await fsp.mkdir(osnDir, { recursive: true });
  await fsp.mkdir(outDir, { recursive: true });

  const osnId = 'Test.Root.a1000888.osn';
  await fsp.writeFile(
    path.join(osnDir, `${osnId}.yaml`),
    yaml.dump({
      id: osnId,
      file_name: osnId,
      owner: { display_name: 'Tester' },
      title: 'Root',
      seed: 'Seed',
      thematic_lenses: [{ lens_id: 'l1', name: 'Lens' }],
      output_spec: 'Spec',
      success_evidences: [
        {
          evidence_id: 'sev.x',
          kind: 'TEXTUAL_SNIPPET',
          direct: true,
          inspection_prompt: 'x'
        }
      ],
      compilation: {
        can_be_compilation_root: true,
        compilation_scope: 'self_only',
        target_tool_profile: 'brand_document_agent'
      },
      graph: { parent_osn_ids: [], child_osn_ids: [] }
    }),
    'utf8'
  );

  await fsp.writeFile(path.join(outDir, 'document.md'), '# Delivered\n', 'utf8');
  await fsp.writeFile(
    path.join(outDir, 'EVIDENCE_PLAN.json'),
    JSON.stringify({ targets: [], summary: { total: 0 } }),
    'utf8'
  );

  const written = await writeBudAfterSuccessfulRun({
    staticRoot,
    handoff: {
      run_id: 'bud_run_1',
      plugin_id: 'lexiom13.document_builder',
      compilation_root_osn_id: osnId,
      output_directory: outDir
    }
  });
  assert.equal(written.ok, true);
  assert.equal(written.bud.run_id, 'bud_run_1');

  await fsp.rm(root, { recursive: true, force: true });
});

test('bud preview denies control-plane paths and serves index.html', async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'lexiom13-bud-serve-'));
  const runDir = path.join(root, 'builds', 'lexiom13', 'serve_run');
  await fsp.mkdir(runDir, { recursive: true });
  await fsp.mkdir(path.join(runDir, 'osng'), { recursive: true });
  await fsp.writeFile(path.join(runDir, 'index.html'), '<html>ok</html>', 'utf8');
  await fsp.writeFile(path.join(runDir, 'osng', 'secret.yaml'), 'x: 1', 'utf8');
  await fsp.writeFile(path.join(runDir, 'AGENT_PROMPT.md'), '# no', 'utf8');

  const indexAbs = await resolveBudPreviewFile(root, 'serve_run', []);
  assert.match(await fsp.readFile(indexAbs, 'utf8'), /ok/);

  await assert.rejects(
    () => resolveBudPreviewFile(root, 'serve_run', ['osng', 'secret.yaml']),
    (err) => err && err.statusCode === 403
  );
  await assert.rejects(
    () => resolveBudPreviewFile(root, 'serve_run', ['AGENT_PROMPT.md']),
    (err) => err && err.statusCode === 403
  );

  const docAbs = await (async () => {
    await fsp.writeFile(path.join(runDir, 'document.md'), 'hello', 'utf8');
    return resolveBudArtifactFile(root, 'serve_run', 'document.md');
  })();
  assert.equal(await fsp.readFile(docAbs, 'utf8'), 'hello');

  await fsp.rm(root, { recursive: true, force: true });
});
