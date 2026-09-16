import assert from 'node:assert/strict';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  PREPARE_SOURCE_EPHEMERAL,
  prepareLexiom13Build
} from '../lib/lexiom13BuildPlugins.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const STATIC_ROOT = path.join(REPO_ROOT, 'public');

test('prepareLexiom13Build accepts osng_envelope without Lexiom YAML', async () => {
  const tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'lexiom13-ephemeral-prep-'));
  const intent = 'A short FAQ about draft gardens for TRH day-zero.';
  const rootId = 'draft.trh.ephemeral.faq.osn';

  try {
    const handoff = await prepareLexiom13Build(STATIC_ROOT, tmpRoot, {
      osng_envelope: {
        root_osn_id: rootId,
        nodes: [
          {
            id: rootId,
            title: 'TRH ephemeral FAQ',
            seed: intent,
            output_spec: 'Deliver a short markdown FAQ that names the intended outcome.',
            thematic_lenses: ['clarity'],
            success_evidences: [
              {
                evidence_id: 'ev.direct.textual_snippet.1',
                kind: 'TEXTUAL_SNIPPET',
                direct: true,
                inspection_prompt: 'Open document.md and confirm the FAQ names the outcome.'
              }
            ],
            compilation: {
              can_be_compilation_root: true,
              compilation_scope: 'self_only',
              target_tool_profile: 'document_builder'
            },
            graph: { parent_osn_ids: [], child_osn_ids: [] }
          }
        ]
      }
    });

    assert.equal(handoff.status, 'prepared');
    assert.equal(handoff.source, PREPARE_SOURCE_EPHEMERAL);
    assert.equal(handoff.compilation_root_osn_id, rootId);
    assert.equal(handoff.plugin_id, 'lexiom13.document_builder');
    assert.ok(handoff.run_id);
    assert.ok(Array.isArray(handoff.success_evidence_targets));
    assert.equal(handoff.success_evidence_targets.length, 1);

    const handoffPath = path.join(tmpRoot, 'builds', 'lexiom13', handoff.run_id, 'HANDOFF.json');
    const onDisk = JSON.parse(await fsp.readFile(handoffPath, 'utf8'));
    assert.equal(onDisk.source, PREPARE_SOURCE_EPHEMERAL);

    const nodesDir = path.join(tmpRoot, 'builds', 'lexiom13', handoff.run_id, 'nodes');
    const nodeFiles = await fsp.readdir(nodesDir);
    assert.ok(nodeFiles.some((f) => f.endsWith('.json')));
  } finally {
    await fsp.rm(tmpRoot, { recursive: true, force: true });
  }
});

test('prepareLexiom13Build loads proposal_run_id from propose builds tree', async () => {
  const tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'lexiom13-ephemeral-prop-'));
  const proposalRunId = 'test_ephemeral_proposal_1';
  const proposeDir = path.join(tmpRoot, 'builds', 'lexiom13-propose', proposalRunId);
  await fsp.mkdir(proposeDir, { recursive: true });
  const intent = 'Tiny CLI notes for ephemeral propose bridge.';
  await fsp.writeFile(path.join(proposeDir, 'INTENT.md'), intent, 'utf8');
  await fsp.writeFile(
    path.join(proposeDir, 'OSNG_PROPOSAL.json'),
    JSON.stringify({
      root_osn_id: 'draft.cli.notes.osn',
      nodes: [
        {
          id: 'draft.cli.notes.osn',
          title: 'CLI notes',
          seed: intent,
          output_spec: 'A short markdown note.',
          thematic_lenses: ['cli'],
          success_evidences: [
            {
              type: 'TEXTUAL_SNIPPET',
              description: 'Note names the CLI outcome',
              snippet: 'CLI'
            }
          ],
          graph: { parent_osn_ids: [], child_osn_ids: [] }
        }
      ]
    }),
    'utf8'
  );

  try {
    const handoff = await prepareLexiom13Build(STATIC_ROOT, tmpRoot, {
      proposal_run_id: proposalRunId
    });
    assert.equal(handoff.source, PREPARE_SOURCE_EPHEMERAL);
    assert.equal(handoff.proposal_run_id, proposalRunId);
    assert.equal(handoff.compilation_root_osn_id, 'draft.cli.notes.osn');
    assert.equal(handoff.plugin_id, 'lexiom13.document_builder');
  } finally {
    await fsp.rm(tmpRoot, { recursive: true, force: true });
  }
});
