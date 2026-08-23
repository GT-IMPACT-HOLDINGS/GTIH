import assert from 'node:assert/strict';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  TOOL_NAMES,
  runAgentToolLoop
} from '../public/gt2/Lexiom_1_3/ca/consultSunWithTools.js';
import {
  assertWritablePath,
  normalizeWorkspacePath
} from '../public/gt2/Lexiom_1_3/ca/sealedOsngBounds.js';
import {
  assertWritableArtifactPath,
  promoteSessionArtifacts,
  stageSessionArtifacts,
  validatePrimaryAfterSync
} from '../lib/caWorkers/boltWebContainerServer.js';
import {
  createCaSession,
  requireCaSessionAccess
} from '../lib/lexiom13CaSessionRegistry.js';
import {
  applySessionReport,
  issueCaJobTicket,
  writeSessionArtifacts
} from '../lib/lexiom13CaDispatcher.js';

test('append-only tool loop reads Ogun source, writes outline and document, then finishes', async () => {
  const workspace = memoryWorkspace(
    new Map([
      [
        'osng/BrandLexiom.osn.yaml',
        'title: Lexiom 1.3 — Ogun Brand\noutput_spec: Produce an approved Ogun brand standard.'
      ],
      ['AGENT_PROMPT.md', 'Read the root and produce a clean branding book.']
    ])
  );
  const requests = [];
  const replies = [
    assistantCall('read-1', TOOL_NAMES.READ_FILE, {
      path: 'osng/BrandLexiom.osn.yaml'
    }),
    assistantCalls([
      call('write-1', TOOL_NAMES.WRITE_FILE, {
        path: 'OUTLINE.md',
        content: '# Ogun Brand Standard\n'
      }),
      call('write-2', TOOL_NAMES.WRITE_FILE, {
        path: 'document.md',
        content: '# Ogun Brand Standard\n\nOgun turns human intention into governed outcomes.'
      })
    ]),
    assistantCall('finish-1', TOOL_NAMES.FINISH, { summary: 'Brand book ready' })
  ];
  const model = {
    async complete(messages, tools) {
      requests.push({ messages: structuredClone(messages), tools });
      return replies.shift();
    }
  };

  const result = await runAgentToolLoop({
    system: 'Use tools.',
    prompt: 'Build the document.',
    primary: 'document.md',
    isDocument: true,
    workspace,
    model
  });

  assert.equal(result.ok, true);
  assert.equal(result.stats.reads, 1);
  assert.deepEqual(result.stats.files_written, ['OUTLINE.md', 'document.md']);
  assert.match(workspace.store.get('document.md'), /Ogun/);
  assert.ok(
    requests[1].messages.some(
      (message) =>
        message.role === 'tool' &&
        message.content.includes('Produce an approved Ogun brand standard')
    )
  );
  assert.ok(requests[0].tools.some((entry) => entry.function.name === 'finish'));
  assert.ok(!requests[0].tools.some((entry) => entry.function.name === 'run_command'));
});

test('phase-scoped tool loop rejects calls outside its capability set', async () => {
  const workspace = memoryWorkspace(new Map([['BUILD_PLAN.json', '{"large":"control"}']]));
  await assert.rejects(
    runAgentToolLoop({
      system: 'Write only.',
      prompt: 'Create OUTLINE.md.',
      primary: 'OUTLINE.md',
      isDocument: true,
      allowedTools: [TOOL_NAMES.WRITE_FILE, TOOL_NAMES.FINISH],
      workspace,
      model: {
        async complete(_messages, tools) {
          assert.deepEqual(
            tools.map((entry) => entry.function.name),
            [TOOL_NAMES.WRITE_FILE, TOOL_NAMES.FINISH]
          );
          return assistantCall('forbidden-read', TOOL_NAMES.READ_FILE, {
            path: 'BUILD_PLAN.json'
          });
        }
      }
    }),
    (error) => error?.reason === 'tool_not_allowed'
  );
});

test('atomic document phase finalizes after its required write', async () => {
  const workspace = memoryWorkspace(new Map());
  let crossings = 0;
  const result = await runAgentToolLoop({
    system: 'Submit one phase artifact.',
    prompt: 'Write OUTLINE.md.',
    primary: 'OUTLINE.md',
    isDocument: true,
    allowedTools: [TOOL_NAMES.WRITE_FILE],
    autoFinishAfterWrite: true,
    workspace,
    model: {
      async complete(_messages, tools) {
        crossings++;
        assert.deepEqual(
          tools.map((entry) => entry.function.name),
          [TOOL_NAMES.WRITE_FILE]
        );
        return assistantCall('write-outline', TOOL_NAMES.WRITE_FILE, {
          path: 'OUTLINE.md',
          content: '# Outline\n'
        });
      }
    },
    finalize: async () => ({
      ok: workspace.store.get('OUTLINE.md') === '# Outline\n'
    })
  });
  assert.equal(result.ok, true);
  assert.equal(result.auto_finished, true);
  assert.equal(crossings, 1);
});

test('software loop exposes bounded command tool and retains command result', async () => {
  const workspace = memoryWorkspace(new Map());
  workspace.run = async () => ({
    command: 'node',
    exit_code: 0,
    timed_out: false,
    output: 'ok'
  });
  const replies = [
    assistantCall('write-index', TOOL_NAMES.WRITE_FILE, {
      path: 'index.html',
      content: '<!doctype html><title>Ready</title>'
    }),
    assistantCall('run-check', TOOL_NAMES.RUN_COMMAND, {
      command: 'node',
      args: ['--version']
    }),
    assistantCall('finish', TOOL_NAMES.FINISH, {})
  ];
  let sawRunTool = false;
  const result = await runAgentToolLoop({
    system: 'Use tools.',
    prompt: 'Build software.',
    primary: 'index.html',
    isDocument: false,
    workspace,
    model: {
      async complete(_messages, tools) {
        sawRunTool ||= tools.some((entry) => entry.function.name === 'run_command');
        return replies.shift();
      }
    }
  });
  assert.equal(result.ok, true);
  assert.equal(sawRunTool, true);
  assert.equal(result.stats.commands, 1);
  assert.equal(result.stats.command_results[0].exit_code, 0);
});

test('tool loop rejects repeated prose without actions', async () => {
  await assert.rejects(
    runAgentToolLoop({
      system: 'Use tools.',
      prompt: 'Build.',
      primary: 'document.md',
      isDocument: true,
      workspace: memoryWorkspace(new Map()),
      budgets: { maxNoProgress: 2 },
      model: {
        async complete() {
          return { role: 'assistant', content: 'I am done.' };
        }
      }
    }),
    (error) => error.reason === 'agent_no_progress'
  );
});

test('tool loop rejects malformed calls, exhausted actions, cancellation, and wall clock', async () => {
  await assert.rejects(
    runAgentToolLoop({
      system: 'Use tools.',
      prompt: 'Build.',
      primary: 'index.html',
      isDocument: false,
      workspace: memoryWorkspace(new Map()),
      budgets: { maxNoProgress: 1 },
      model: {
        async complete() {
          return assistantCalls([
            {
              id: 'bad-json',
              type: 'function',
              function: { name: 'write_file', arguments: '{bad' }
            }
          ]);
        }
      }
    }),
    (error) => error.reason === 'agent_no_progress'
  );

  await assert.rejects(
    runAgentToolLoop({
      system: 'Use tools.',
      prompt: 'Build.',
      primary: 'index.html',
      isDocument: false,
      workspace: memoryWorkspace(new Map()),
      budgets: { maxActions: 1 },
      model: {
        async complete() {
          return assistantCalls([
            call('one', TOOL_NAMES.LIST_FILES, {}),
            call('two', TOOL_NAMES.LIST_FILES, {})
          ]);
        }
      }
    }),
    (error) => error.reason === 'action_budget_exhausted'
  );

  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    runAgentToolLoop({
      system: 'Use tools.',
      prompt: 'Build.',
      primary: 'index.html',
      isDocument: false,
      workspace: memoryWorkspace(new Map()),
      signal: controller.signal,
      model: { async complete() {} }
    }),
    (error) => error.reason === 'session_cancelled'
  );

  await assert.rejects(
    runAgentToolLoop({
      system: 'Use tools.',
      prompt: 'Build.',
      primary: 'index.html',
      isDocument: false,
      workspace: memoryWorkspace(new Map()),
      budgets: { maxWallClockMs: 1 },
      model: {
        async complete() {
          await new Promise((resolve) => setTimeout(resolve, 5));
          return assistantCall('late', TOOL_NAMES.LIST_FILES, {});
        }
      }
    }),
    (error) => error.reason === 'wall_clock_exhausted'
  );
});

test('workspace path policy rejects traversal and immutable variants', () => {
  for (const value of ['../x', './osng/x', 'osng\\x', 'C:/x', '/x', 'a//b']) {
    assert.throws(() => normalizeWorkspacePath(value));
  }
  for (const value of ['osng/x.yaml', 'OSNG/x.yaml', 'HANDOFF.json', 'run_result.json']) {
    assert.throws(() => assertWritablePath(value));
    assert.throws(() => assertWritableArtifactPath(value));
  }
  assert.equal(assertWritablePath('assets/app.js'), 'assets/app.js');
});

test('staged document validates before promotion and preserves control files', async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'lexiom-ca-stage-'));
  await fsp.writeFile(path.join(root, 'HANDOFF.json'), '{"canonical":true}', 'utf8');
  const sessionId = 'cas_test_stage';
  await stageSessionArtifacts(root, sessionId, [
    { path: 'OUTLINE.md', content: '# Plan' },
    { path: 'document.md', content: '# Ogun\n\nA governed brand standard.' }
  ]);
  const stage = path.join(root, '.ca-staging', sessionId);
  const gate = await validatePrimaryAfterSync(stage, 'lexiom13.document_builder');
  assert.equal(gate.ok, true);
  await promoteSessionArtifacts(root, sessionId);
  assert.match(await fsp.readFile(path.join(root, 'document.md'), 'utf8'), /Ogun/);
  assert.equal(await fsp.readFile(path.join(root, 'HANDOFF.json'), 'utf8'), '{"canonical":true}');
  await fsp.rm(root, { recursive: true, force: true });
});

test('session capability is required and terminal access is rejected', () => {
  const session = createCaSession({
    runId: 'run_capability_test',
    pluginId: 'lexiom13.document_builder',
    outputDirectory: 'C:/tmp/run_capability_test',
    timeoutMs: 60000
  });
  assert.throws(
    () => requireCaSessionAccess(session.session_id, 'wrong'),
    (error) => error.code === 'session_forbidden'
  );
  assert.equal(
    requireCaSessionAccess(session.session_id, session.capability_token).run_id,
    'run_capability_test'
  );
});

test('dispatcher stages, validates, promotes, and finalizes idempotently', async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'lexiom-ca-dispatch-'));
  const ticket = issueCaJobTicket({
    runId: 'run_dispatch_test',
    pluginId: 'lexiom13.document_builder',
    outputDirectory: root
  });
  await assert.rejects(
    writeSessionArtifacts(ticket.session_id, { files: [] }, 'wrong'),
    (error) => error.code === 'session_forbidden'
  );
  await writeSessionArtifacts(
    ticket.session_id,
    {
      files: [
        { path: 'OUTLINE.md', content: '# Outline' },
        { path: 'document.md', content: '# Ogun\n\nGoverned outcomes.' }
      ]
    },
    ticket.capability_token
  );
  let finalized = 0;
  const first = await applySessionReport(
    ticket.session_id,
    { status: 'completed', metrics: { actions: 3 } },
    async () => {
      finalized++;
    },
    ticket.capability_token
  );
  const duplicate = await applySessionReport(
    ticket.session_id,
    { status: 'completed' },
    async () => {
      finalized++;
    },
    ticket.capability_token
  );
  assert.equal(first.status, 'completed');
  assert.deepEqual(duplicate, first);
  assert.equal(finalized, 1);
  assert.equal(first.metrics.actions, 3);
  assert.match(await fsp.readFile(path.join(root, 'document.md'), 'utf8'), /Ogun/);
  await fsp.rm(root, { recursive: true, force: true });
});

test('software validation rejects missing local assets', async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'lexiom-ca-assets-'));
  await fsp.writeFile(
    path.join(root, 'index.html'),
    '<!doctype html><link href="styles.css"><script src="src/app.js"></script>',
    'utf8'
  );
  const gate = await validatePrimaryAfterSync(
    root,
    'lexiom13.software_coding_builder'
  );
  assert.equal(gate.ok, false);
  assert.equal(gate.reason, 'software_assets_missing');
  assert.match(gate.detail, /styles\.css/);
  assert.match(gate.detail, /src\/app\.js/);
  await fsp.rm(root, { recursive: true, force: true });
});

function memoryWorkspace(initial) {
  const store = new Map(initial);
  return {
    store,
    async list(base = '') {
      return [...store.keys()].filter((value) => !base || value.startsWith(`${base}/`));
    },
    async read(file, { offset = 0, limit = 30000 } = {}) {
      if (!store.has(file)) throw new Error(`missing: ${file}`);
      const full = store.get(file);
      const content = full.slice(offset, offset + limit);
      return {
        path: file,
        content,
        content_chars: full.length,
        truncated: offset + content.length < full.length
      };
    },
    async write(file, content) {
      assertWritablePath(file);
      store.set(file, content);
      return { path: file, chars: content.length };
    },
    async exists(file) {
      return store.has(file);
    }
  };
}

function assistantCall(id, name, args) {
  return assistantCalls([call(id, name, args)]);
}

function assistantCalls(toolCalls) {
  return {
    choices: [
      {
        message: {
          role: 'assistant',
          content: null,
          tool_calls: toolCalls
        }
      }
    ]
  };
}

function call(id, name, args) {
  return {
    id,
    type: 'function',
    function: { name, arguments: JSON.stringify(args) }
  };
}
