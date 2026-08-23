import assert from 'node:assert/strict';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  assembleDocumentFromSections,
  assignShortKeys,
  buildFillClusters,
  estimateTokensFromText
} from '../lib/lexiom13BuildContextPack.js';
import { prepareLexiom13Build } from '../lib/lexiom13BuildPlugins.js';
import { applyOptionalPromptCaching } from '../lib/gt3AgentOpenAiProxy.js';
import {
  assembleDocumentFromSections as assembleInOrchestrator,
  estimateCrossingTokens,
  estimateMessagesTokens,
  runDocumentBuildOrchestrator
} from '../public/gt2/Lexiom_1_3/ca/composeBookShapedSud.js';
import { TOOL_NAMES } from '../public/gt2/Lexiom_1_3/ca/consultSunWithTools.js';
import {
  assertWritableArtifactPath,
  validatePrimaryAfterSync
} from '../lib/caWorkers/boltWebContainerServer.js';
import { assertWritablePath as assertClientWritable } from '../public/gt2/Lexiom_1_3/ca/sealedOsngBounds.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const STATIC_ROOT = path.join(REPO_ROOT, 'public');

test('fill clusters expand BrandLexiom containers into four chapter heads', () => {
  const byId = new Map([
    [
      'root',
      {
        id: 'root',
        title: 'Root',
        graph: { child_osn_ids: ['strategy', 'expression'], parent_osn_ids: [] }
      }
    ],
    [
      'strategy',
      {
        id: 'strategy',
        title: 'Strategy',
        graph: { child_osn_ids: ['market', 'audience'], parent_osn_ids: ['root'] }
      }
    ],
    [
      'expression',
      {
        id: 'expression',
        title: 'Expression',
        graph: { child_osn_ids: ['creative', 'gtm'], parent_osn_ids: ['root'] }
      }
    ],
    ['market', { id: 'market', title: 'Market Positioning', graph: { child_osn_ids: ['m1'], parent_osn_ids: ['strategy'] } }],
    ['audience', { id: 'audience', title: 'Audience & Enterprise Value', graph: { child_osn_ids: [], parent_osn_ids: ['strategy'] } }],
    ['creative', { id: 'creative', title: 'Creative Identity', graph: { child_osn_ids: [], parent_osn_ids: ['expression'] } }],
    ['gtm', { id: 'gtm', title: 'Go-to-Market System', graph: { child_osn_ids: [], parent_osn_ids: ['expression'] } }],
    ['m1', { id: 'm1', title: 'Leaf', graph: { child_osn_ids: [], parent_osn_ids: ['market'] } }]
  ]);
  const included = new Set(byId.keys());
  const keyById = assignShortKeys([...byId.values()], 'root');
  const clusters = buildFillClusters('root', byId, included, keyById);
  assert.equal(clusters.length, 4);
  assert.deepEqual(
    clusters.map((c) => c.title),
    [
      'Market Positioning',
      'Audience & Enterprise Value',
      'Creative Identity',
      'Go-to-Market System'
    ]
  );
});

test('prepare BrandLexiom emits per-node JSON, source pack, and four clusters', async () => {
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'lexiom13-ctx-'));
  const handoff = await prepareLexiom13Build(STATIC_ROOT, tmp, {
    compilation_root_osn_id: 'GT_Philosophy.BrandLexiom.a1000005.osn',
    strategy_id: 'outline_then_fill',
    run_id: 'ctxpack1'
  });
  assert.equal(handoff.plugin_id, 'lexiom13.document_builder');
  assert.equal(handoff.context_economy?.mode, 'prepared_nodes');
  assert.equal(handoff.context_economy?.node_count, 64);
  assert.equal(handoff.context_economy?.cluster_count, 4);
  assert.ok(handoff.context_economy?.source_count >= 1);

  const outDir = handoff.output_directory;
  const plan = JSON.parse(await fsp.readFile(path.join(outDir, 'BUILD_PLAN.json'), 'utf8'));
  const sourceMap = JSON.parse(await fsp.readFile(path.join(outDir, 'SOURCE_MAP.json'), 'utf8'));
  const evidencePlan = JSON.parse(
    await fsp.readFile(path.join(outDir, 'EVIDENCE_PLAN.json'), 'utf8')
  );
  const evidencePrompt = await fsp.readFile(
    path.join(outDir, 'EVIDENCE_AGENT_PROMPT.md'),
    'utf8'
  );
  const prompt = await fsp.readFile(path.join(outDir, 'AGENT_PROMPT.md'), 'utf8');

  assert.equal(plan.fill_clusters.length, 4);
  assert.equal(Object.keys(plan.node_files).length, 64);
  const rootDescriptor = plan.node_files[plan.compilation_root_key];
  const rootRaw = await fsp.readFile(path.join(outDir, rootDescriptor.path), 'utf8');
  const rootNode = JSON.parse(rootRaw);
  assert.equal(rootNode.schema_version, 'lexiom13-prepared-node/1');
  assert.equal(rootNode.context.role, 'root');
  assert.equal(rootNode.osn.id, handoff.compilation_root_osn_id);
  assert.equal(rootNode.source.yaml_sha256, rootDescriptor.source_yaml_sha256);
  assert.equal(
    crypto.createHash('sha256').update(rootRaw, 'utf8').digest('hex'),
    rootDescriptor.artifact_sha256
  );
  assert.ok(sourceMap.sources.length >= 1);
  assert.ok(sourceMap.sources[0].section_index.length >= 20);
  assert.ok(
    sourceMap.sources[0].section_index.every(
      (section) => section.end > section.start
    )
  );
  assert.ok(await fsp.stat(path.join(outDir, sourceMap.sources[0].path)));
  assert.match(prompt, /BUILD_PLAN/);
  assert.doesNotMatch(prompt, /open every \*\.osn\.yaml/i);
  assert.equal(plan.section_files.length, 4);
  assert.equal(handoff.snapshot_format, 'normalized_json_nodes');
  assert.deepEqual(handoff.instruction_read_roots, ['nodes']);
  assert.ok(handoff.subgraph.every((node) => node.snapshot_path.startsWith('nodes/')));
  assert.ok(evidencePlan.targets.every((target) => target.snapshot_path.startsWith('nodes/')));
  assert.match(evidencePrompt, /\.\/nodes\//);
  await assert.rejects(fsp.access(path.join(outDir, 'BUILD_VIEW.jsonl')));
  await assert.rejects(fsp.access(path.join(outDir, 'osng')));
  for (const descriptor of Object.values(plan.node_files)) {
    assert.ok(descriptor.byte_length < 60000);
  }
});

test('document orchestrator uses fresh phases, host assembly, and token totals', async () => {
  const workspace = memoryWorkspace(
    new Map([
      [
        'BUILD_PLAN.json',
        JSON.stringify({
          schema_version: 'lexiom13-build-plan/1',
          compilation_root_key: 'n01',
          policy: { shared_invariants: ['clean prose'] },
          node_files: {
            n01: { key: 'n01', path: 'nodes/n01.json' },
            n02: { key: 'n02', path: 'nodes/n02.json' }
          },
          outline: { context_keys: ['n01', 'n02'] },
          fill_clusters: [
            {
              cluster_id: 'c01',
              head_key: 'n02',
              title: 'Market',
              ordered_keys: ['n02']
            }
          ],
          section_files: [
            {
              cluster_id: 'c01',
              path: 'sections/01-market.md',
              title: 'Market',
              ordered_keys: ['n02']
            }
          ],
          token_budgets: {
            max_prompt_tokens_per_crossing: 20000,
            max_reconcile_prompt_tokens: 24000,
            max_lm_crossings: 8,
            max_cumulative_prompt_tokens: 100000,
            max_tokens_by_phase: { outline: 800, fill: 1200, reconcile: 800 }
          }
        })
      ],
      [
        'nodes/n01.json',
        JSON.stringify({
          schema_version: 'lexiom13-prepared-node/1',
          key: 'n01',
          context: {
            key: 'n01',
            title: 'Ogun',
            role: 'root',
            seed: 'Govern Ogun',
            unique_requirements: ['Preserve Ogun identity']
          }
        })
      ],
      [
        'nodes/n02.json',
        JSON.stringify({
          schema_version: 'lexiom13-prepared-node/1',
          key: 'n02',
          context: {
            key: 'n02',
            title: 'Market',
            role: 'mid',
            seed: 'Position Ogun',
            unique_requirements: ['State category clearly'],
            source: { path: 'sources/abc.md', document: 'branding_spec.md', sections: '§1' }
          }
        })
      ],
      [
        'SOURCE_MAP.json',
        JSON.stringify({
          sources: [{ hash: 'abc', path: 'sources/abc.md', document: 'branding_spec.md' }]
        })
      ],
      ['sources/abc.md', 'Ogun is the governed forge.'],
      ['AGENT_PROMPT.md', 'Use build view.']
    ])
  );

  const requests = [];
  const replies = [
    // outline phase
    assistantCalls([
      call('w1', TOOL_NAMES.WRITE_FILE, {
        path: 'OUTLINE.md',
        content: '# Outline\n- Market (n02)\n'
      })
    ]),
    // fill phase
    assistantCalls([
      call('w2', TOOL_NAMES.WRITE_FILE, {
        path: 'sections/01-market.md',
        content: '# Market\n\nOgun occupies the governed-forge category.'
      })
    ])
  ];

  const result = await runDocumentBuildOrchestrator({
    workspace,
    log: () => {},
    caSession: { run_id: 't1' },
    timeoutMs: 60_000,
    model: {
      async complete(messages, tools, completeOpts = {}) {
        requests.push({ messages, tools, completeOpts });
        const usage = {
          prompt_tokens: 100,
          completion_tokens: 40,
          prompt_tokens_details: { cached_tokens: 10 }
        };
        const reply = replies.shift();
        return { ...reply, usage };
      }
    }
  });

  assert.equal(result.ok, true);
  assert.equal(requests.length, 2);
  assert.notEqual(requests[0].messages, requests[1].messages);
  for (const request of requests) {
    assert.deepEqual(
      request.tools.map((entry) => entry.function.name),
      [TOOL_NAMES.WRITE_FILE]
    );
  }
  assert.match(workspace.store.get('document.md'), /governed-forge/);
  assert.equal(
    workspace.store.get('document.md'),
    assembleInOrchestrator([
      { content: workspace.store.get('sections/01-market.md') }
    ])
  );
  assert.equal(result.tokenTotals.crossings, 2);
  assert.equal(result.tokenTotals.prompt_tokens, 200);
  assert.equal(result.tokenTotals.cached_tokens, 20);
  assert.ok(requests[0].completeOpts.max_tokens <= 800);
  assert.ok(workspace.store.get('PHASE_LEDGER.json'));
});

test('BrandLexiom fill packets fit budget and load referenced source sections', async () => {
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'lexiom13-fill-pack-'));
  const handoff = await prepareLexiom13Build(STATIC_ROOT, tmp, {
    compilation_root_osn_id: 'GT_Philosophy.BrandLexiom.a1000005.osn',
    strategy_id: 'outline_then_fill',
    run_id: 'fillpack1'
  });
  const requests = [];
  const sectionByPhase = {
    'fill:c01': 'sections/01-market-positioning.md',
    'fill:c02': 'sections/02-audience-and-enterprise-value.md',
    'fill:c03': 'sections/03-creative-identity.md',
    'fill:c04': 'sections/04-go-to-market-system.md'
  };
  const result = await runDocumentBuildOrchestrator({
    workspace: fileWorkspace(handoff.output_directory),
    caSession: { run_id: handoff.run_id },
    timeoutMs: 60_000,
    model: {
      async complete(messages, tools, completeOpts = {}) {
        requests.push({ messages: structuredClone(messages), tools, completeOpts });
        const phase = completeOpts.phase;
        const target = phase === 'outline' ? 'OUTLINE.md' : sectionByPhase[phase];
        return {
          ...assistantCalls([
            call(`write-${phase}`, TOOL_NAMES.WRITE_FILE, {
              path: target,
              content:
                phase === 'outline'
                  ? '# Outline\n\n1. Market Positioning\n2. Audience\n3. Identity\n4. Go-to-Market\n'
                  : `# ${phase}\n\nReader-facing Ogun brand prose.`
            })
          ]),
          usage: { prompt_tokens: 1000, completion_tokens: 100 }
        };
      }
    }
  });
  assert.equal(result.ok, true);
  assert.equal(result.tokenTotals.crossings, 5);
  assert.equal(requests.length, 5);
  const fillOne = requests.find((request) => request.completeOpts.phase === 'fill:c01');
  assert.ok(fillOne);
  assert.ok(estimateCrossingTokens(fillOne.messages, fillOne.tools) <= 8000);
  assert.match(fillOne.messages[1].content, /## 4\./);
  assert.doesNotMatch(fillOne.messages[1].content, /## 1\. Brand Mandate/);
  await fsp.rm(tmp, { recursive: true, force: true });
});

test('context pack and sources are immutable in client and server policy', () => {
  assert.throws(() => assertClientWritable('nodes/n01.json'));
  assert.throws(() => assertClientWritable('sources/abc.md'));
  assert.throws(() => assertWritableArtifactPath('nodes/n01.json'));
  assert.throws(() => assertWritableArtifactPath('BUILD_PLAN.json'));
  assert.throws(() => assertWritableArtifactPath('sources/abc.md'));
  assert.equal(assertClientWritable('sections/01-market.md'), 'sections/01-market.md');
  assert.equal(assertClientWritable('PHASE_LEDGER.json'), 'PHASE_LEDGER.json');
});

test('optional prompt caching marks system text and falls back when disabled', () => {
  const enabled = {
    messages: [{ role: 'system', content: 'Stable instructions' }, { role: 'user', content: 'Go' }]
  };
  applyOptionalPromptCaching(enabled, {
    enabled: true,
    stickyKey: 'run:outline',
    phase: 'outline',
    runId: 'r1'
  });
  assert.equal(enabled.messages[0].content[0].cache_control.type, 'ephemeral');

  const disabled = {
    messages: [{ role: 'system', content: 'Stable instructions' }]
  };
  applyOptionalPromptCaching(disabled, { enabled: false });
  assert.equal(typeof disabled.messages[0].content, 'string');
});

test('token estimator and assembly helpers are deterministic', () => {
  assert.equal(estimateTokensFromText('abcd'), 1);
  assert.equal(estimateMessagesTokens([{ role: 'user', content: 'hi' }]) > 0, true);
  assert.ok(
    estimateCrossingTokens(
      [{ role: 'user', content: 'hi' }],
      [{ type: 'function', function: { name: 'finish' } }]
    ) > estimateMessagesTokens([{ role: 'user', content: 'hi' }])
  );
  assert.equal(
    assembleDocumentFromSections([
      { content: 'A\n' },
      { content: 'B' }
    ]),
    'A\n\nB\n'
  );
});

test('validation accepts assembled sections against prepared plan', async () => {
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'lexiom13-val-'));
  const section = '# Market\n\nOgun prose.';
  await fsp.mkdir(path.join(tmp, 'nodes'), { recursive: true });
  const nodeRaw = `${JSON.stringify({
    schema_version: 'lexiom13-prepared-node/1',
    key: 'n01',
    source: { osn_id: 'root.osn', yaml_sha256: 'source-hash' },
    context: { key: 'n01', role: 'root' },
    osn: { id: 'root.osn' }
  }, null, 2)}\n`;
  await fsp.writeFile(path.join(tmp, 'nodes/n01.json'), nodeRaw, 'utf8');
  await fsp.writeFile(
    path.join(tmp, 'BUILD_PLAN.json'),
    JSON.stringify({
      strategy_id: 'outline_then_fill',
      node_files: {
        n01: {
          key: 'n01',
          osn_id: 'root.osn',
          path: 'nodes/n01.json',
          source_yaml_sha256: 'source-hash',
          artifact_sha256: crypto.createHash('sha256').update(nodeRaw, 'utf8').digest('hex')
        }
      },
      section_files: [{ path: 'sections/01-market.md', cluster_id: 'c01', title: 'Market' }]
    }),
    'utf8'
  );
  await fsp.writeFile(path.join(tmp, 'SOURCE_MAP.json'), '{"sources":[]}\n', 'utf8');
  await fsp.writeFile(path.join(tmp, 'OUTLINE.md'), '# Outline\n', 'utf8');
  await fsp.mkdir(path.join(tmp, 'sections'), { recursive: true });
  await fsp.writeFile(path.join(tmp, 'sections/01-market.md'), section, 'utf8');
  await fsp.writeFile(path.join(tmp, 'document.md'), `${section.trim()}\n`, 'utf8');

  const gate = await validatePrimaryAfterSync(tmp, 'lexiom13.document_builder');
  assert.equal(gate.ok, true);
});

function memoryWorkspace(initial) {
  const store = new Map(initial);
  return {
    store,
    async read(input, options = {}) {
      const content = store.get(input);
      if (content == null) throw new Error('missing ' + input);
      const offset = options.offset || 0;
      const limit = options.limit || content.length;
      const slice = content.slice(offset, offset + limit);
      return {
        path: input,
        content: slice,
        offset,
        content_chars: content.length,
        truncated: offset + slice.length < content.length
      };
    },
    async write(input, content) {
      store.set(input, String(content));
      return { path: input, chars: String(content).length };
    },
    async exists(input) {
      return store.has(input);
    },
    async list() {
      return [...store.keys()];
    }
  };
}

function fileWorkspace(root) {
  const absolute = (input) => path.join(root, ...String(input).split('/'));
  return {
    async read(input, options = {}) {
      const content = await fsp.readFile(absolute(input), 'utf8');
      const offset = options.offset || 0;
      const limit = options.limit || content.length;
      const slice = content.slice(offset, offset + limit);
      return {
        path: input,
        content: slice,
        offset,
        content_chars: content.length,
        truncated: offset + slice.length < content.length
      };
    },
    async write(input, content) {
      const destination = absolute(input);
      await fsp.mkdir(path.dirname(destination), { recursive: true });
      await fsp.writeFile(destination, String(content), 'utf8');
      return { path: input, chars: String(content).length };
    },
    async exists(input) {
      try {
        await fsp.access(absolute(input));
        return true;
      } catch {
        return false;
      }
    },
    async list() {
      return [];
    }
  };
}

function call(id, name, args) {
  return {
    id,
    type: 'function',
    function: { name, arguments: JSON.stringify(args) }
  };
}

function assistantCalls(toolCalls) {
  return {
    choices: [{ message: { role: 'assistant', content: null, tool_calls: toolCalls } }]
  };
}
