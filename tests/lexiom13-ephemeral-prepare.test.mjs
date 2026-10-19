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
import {
  COMPOSITION_MERGED_REFINEMENTS,
  MERGED_REFINEMENT_GUIDANCE
} from '../lib/lexiom13BuildContextPack.js';

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
    const capsule = JSON.parse(
      await fsp.readFile(path.join(nodesDir, nodeFiles.find((f) => f.endsWith('.json'))), 'utf8')
    );
    const ctx = capsule.context || capsule;
    assert.equal(ctx.seed, undefined);
    assert.equal(ctx.lenses, undefined);
    assert.equal(ctx.title, undefined);
    assert.equal(typeof ctx.output_spec, 'string');
    assert.ok(ctx.output_spec.length > 0);
    assert.ok(Array.isArray(ctx.success_evidences));
    assert.ok(Array.isArray(ctx.unique_requirements));
    assert.ok(ctx.unique_requirements.length > 0);

    const onDiskSub = (onDisk.subgraph || []).find((n) => n.id === rootId) || onDisk.subgraph?.[0];
    if (onDiskSub) {
      assert.ok(!onDiskSub.sections?.some((s) => s.key === 'seed' || s.key === 'thematic_lenses'));
    }
  } finally {
    await fsp.rm(tmpRoot, { recursive: true, force: true });
  }
});

test('ephemeral multi-node envelope realizes the whole tree as one merged SUD', async () => {
  const tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'lexiom13-ephemeral-tree-'));
  const rootId = 'draft.trh.tree.root.osn';
  const kidIds = ['draft.trh.tree.k1.osn', 'draft.trh.tree.k2.osn'];
  const grandId = 'draft.trh.tree.k1g1.osn';
  const ev = (n) => [
    {
      evidence_id: 'ev.direct.textual_snippet.1',
      kind: 'TEXTUAL_SNIPPET',
      direct: true,
      inspection_prompt: `Open document.md and confirm ${n}.`
    }
  ];
  const node = (id, parents, children, spec) => ({
    id,
    output_spec: spec,
    success_evidences: ev(spec),
    graph: { parent_osn_ids: parents, child_osn_ids: children }
  });

  try {
    const handoff = await prepareLexiom13Build(STATIC_ROOT, tmpRoot, {
      osng_envelope: {
        root_osn_id: rootId,
        nodes: [
          node(rootId, [], kidIds, 'A short poem about a trip to Berlin.'),
          node(kidIds[0], [rootId], [grandId], 'The poem dwells on the river at night.'),
          node(kidIds[1], [rootId], [], 'The poem uses only present tense.'),
          node(grandId, [kidIds[0]], [], 'The river is seen from a bridge.')
        ]
      }
    });

    assert.equal(handoff.source, PREPARE_SOURCE_EPHEMERAL);
    assert.equal(handoff.compilation_scope, 'self_and_approved_descendants');
    assert.equal(handoff.composition, COMPOSITION_MERGED_REFINEMENTS);
    assert.deepEqual(
      handoff.subgraph.map((n) => n.id).sort(),
      [rootId, ...kidIds, grandId].sort()
    );
    assert.equal(handoff.success_evidence_targets.length, 4);

    const buildDir = path.join(tmpRoot, 'builds', 'lexiom13', handoff.run_id);
    const plan = JSON.parse(await fsp.readFile(path.join(buildDir, 'BUILD_PLAN.json'), 'utf8'));
    assert.equal(plan.composition, COMPOSITION_MERGED_REFINEMENTS);
    assert.equal(plan.fill_clusters.length, 1);
    assert.equal(plan.fill_clusters[0].ordered_keys.length, 4);
    for (const line of MERGED_REFINEMENT_GUIDANCE) {
      assert.ok(plan.policy.shared_invariants.includes(line));
    }
  } finally {
    await fsp.rm(tmpRoot, { recursive: true, force: true });
  }
});

test('single-node ephemeral envelope keeps self_only scope', async () => {
  const tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'lexiom13-ephemeral-single-'));
  const rootId = 'draft.trh.single.osn';
  try {
    const handoff = await prepareLexiom13Build(STATIC_ROOT, tmpRoot, {
      osng_envelope: {
        root_osn_id: rootId,
        nodes: [
          {
            id: rootId,
            output_spec: 'A haiku.',
            success_evidences: [
              {
                evidence_id: 'ev.direct.textual_snippet.1',
                kind: 'TEXTUAL_SNIPPET',
                direct: true,
                inspection_prompt: 'Confirm it is a haiku.'
              }
            ],
            graph: { parent_osn_ids: [], child_osn_ids: [] }
          }
        ]
      }
    });
    assert.equal(handoff.compilation_scope, 'self_only');
    assert.equal(handoff.composition, null);
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
