import { test } from 'node:test';
import assert from 'node:assert/strict';
import fsp from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  startLexiom13OsngPropose,
  startLexiom13ModalChat,
  readLexiom13OsngProposeStatus,
  envelopeFromOsngProposalFile,
  normalizeDraftOsn,
  normalizeSuccessEvidences,
  normalizeThematicLenses,
  normalizeHanumanOwner,
  buildNaiveSingleOsn,
  buildModalChatAgentPrompt,
  makeHanumanOsnId,
  isHanumanOsnId,
  DEFAULT_HANUMAN_OWNER,
  OSNG_PROPOSER_PLUGIN_ID,
  OSNG_PROPOSAL_PRIMARY,
  OSNG_FINISHED_TOP_KEYS,
  OSNG_FINISHED_GRAPH_KEYS,
  PROPOSE_SEED_ARTIFACT,
  PROPOSE_LENSES_ARTIFACT,
  MODAL_CHAT_MODE,
  MODAL_CHAT_CONTRACT_LINEAGE,
  MODAL_CHAT_CONTRACT_EDIT,
  MODAL_CHAT_PRIOR_OSNG,
  MODAL_CHAT_REPLY,
  MODAL_CHAT_FOCUS,
  MODAL_CHAT_FOCUS_CONTENT,
  MODAL_CHAT_EVIDENCE,
  proposeLexiom13OsngFromIntent
} from '../lib/lexiom13OsnPropose.js';
import { primaryArtifactForPlugin } from '../lib/lexiom13CaPolicy.js';
import { validatePrimaryAfterSync } from '../lib/caWorkers/boltWebContainerServer.js';

test('primaryArtifactForPlugin maps osng_proposer to OSNG_PROPOSAL.json', () => {
  assert.equal(primaryArtifactForPlugin(OSNG_PROPOSER_PLUGIN_ID), OSNG_PROPOSAL_PRIMARY);
});

test('makeHanumanOsnId emits opaque {uuid}.osn', () => {
  const id = makeHanumanOsnId();
  assert.ok(isHanumanOsnId(id));
  assert.doesNotMatch(id, /draft\.|berlin|poem/i);
  assert.ok(isHanumanOsnId('a1b2c3d4-e5f6-4780-abcd-ef1234567890.osn'));
  assert.equal(isHanumanOsnId('ram.berlin_poem.osn'), false);
  assert.equal(isHanumanOsnId('GT_Philosophy.BrandLexiom.a1000005.osn'), false);
});

test('buildNaiveSingleOsn uses {uuid}.osn id and matching file_name', () => {
  const osn = buildNaiveSingleOsn('a trip to Berlin poem');
  assert.ok(isHanumanOsnId(osn.id));
  assert.equal(osn.file_name, osn.id);
  assert.equal(osn.owner, DEFAULT_HANUMAN_OWNER);
  assert.doesNotMatch(osn.id, /berlin|trip|poem|draft\./i);
});

test('normalizeHanumanOwner mandates a simple string defaulting to Ram', () => {
  assert.equal(normalizeHanumanOwner(undefined), 'Ram');
  assert.equal(normalizeHanumanOwner(''), 'Ram');
  assert.equal(normalizeHanumanOwner('  Sita  '), 'Sita');
  assert.equal(
    normalizeHanumanOwner({
      authority: 'white_throne_consent',
      raised_by: 'ram',
      laborer: 'hanuman'
    }),
    'Ram'
  );
  assert.equal(normalizeHanumanOwner({ display_name: 'Draft proposer' }), 'Ram');
  assert.equal(normalizeHanumanOwner({ display_name: 'Lakshmana' }), 'Lakshmana');
});

test('normalizeSuccessEvidences maps Hanuman type/description/snippet to Lexiom shape', () => {
  const out = normalizeSuccessEvidences(
    [
      {
        type: 'TEXTUAL_SNIPPET',
        description: 'HTML file contains DOCTYPE declaration',
        snippet: '<!DOCTYPE html>'
      }
    ],
    'hello world html'
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, 'TEXTUAL_SNIPPET');
  assert.equal(out[0].direct, true);
  assert.ok(out[0].evidence_id);
  assert.match(out[0].inspection_prompt, /DOCTYPE/);
  assert.match(out[0].inspection_prompt, /<!DOCTYPE html>/);
  assert.equal(out[0].type, undefined);
});

test('normalizeThematicLenses maps bare strings to Lexiom lens objects', () => {
  const out = normalizeThematicLenses(['web_development', 'html_markup'], 'intent');
  assert.equal(out.length, 2);
  assert.equal(out[0].name, 'web_development');
  assert.ok(out[0].lens_id.startsWith('lens.'));
  assert.ok(out[0].description);
  assert.ok(out[0].purpose);
});

test('normalizeDraftOsn emits only finished-node allowlist keys', () => {
  const intent = "a 'hellow world' html page";
  const osn = normalizeDraftOsn(
    {
      id: 'hello_world_html.osn',
      title: "Create a 'Hello World' HTML Page",
      seed: intent,
      thematic_lenses: ['web_development', 'html_markup'],
      node_type: 'document',
      compilation: { target_tool_profile: 'document_agent' },
      owner: {
        authority: 'white_throne_consent',
        raised_by: 'ram',
        laborer: 'hanuman'
      },
      output_spec: 'A single HTML file',
      success_evidences: [
        {
          type: 'TEXTUAL_SNIPPET',
          description: 'HTML file contains hello world message',
          snippet: 'Hello World'
        }
      ],
      graph: {
        parent_osn_ids: [],
        child_osn_ids: [],
        derived_from_lens_id: 'lens.x'
      }
    },
    intent
  );
  assert.deepEqual(Object.keys(osn).sort(), [...OSNG_FINISHED_TOP_KEYS].sort());
  assert.deepEqual(Object.keys(osn.graph).sort(), [...OSNG_FINISHED_GRAPH_KEYS].sort());
  assert.equal(osn.title, undefined);
  assert.equal(osn.owner, DEFAULT_HANUMAN_OWNER);
  assert.equal(typeof osn.owner, 'string');
  assert.equal(osn.seed, undefined);
  assert.equal(osn.thematic_lenses, undefined);
  assert.equal(osn.node_type, undefined);
  assert.equal(osn.compilation, undefined);
  assert.equal(osn.graph.derived_from_lens_id, undefined);
  assert.equal(osn.success_evidences[0].kind, 'TEXTUAL_SNIPPET');
  assert.match(osn.success_evidences[0].inspection_prompt, /Hello World/);
});

test('envelopeFromOsngProposalFile accepts valid single-node envelope', () => {
  const intent = 'A calm CLI that turns a narrative into a draft OSN garden.';
  const envelope = envelopeFromOsngProposalFile(
    JSON.stringify({
      root_osn_id: 'draft.cli.abc.osn',
      nodes: [
        {
          id: 'draft.cli.abc.osn',
          title: 'CLI draft',
          seed: intent,
          thematic_lenses: [],
          output_spec: 'Ship a CLI',
          success_evidences: [
            {
              evidence_id: 'ev.1',
              kind: 'TEXTUAL_SNIPPET',
              direct: true,
              inspection_prompt: 'Read README'
            }
          ]
        }
      ]
    }),
    intent,
    {
      max_descendants_requested: 0,
      max_descendants_effective: 0,
      clamped: false
    }
  );
  assert.equal(envelope.status, 'ok');
  assert.equal(envelope.root_osn_id, 'draft.cli.abc.osn');
  assert.equal(envelope.nodes.length, 1);
  assert.equal(envelope.meta, undefined);
  assert.equal(envelope.nodes[0].seed, undefined);
  assert.equal(envelope.nodes[0].thematic_lenses, undefined);
  assert.equal(envelope.nodes[0].title, undefined);
  assert.deepEqual(Object.keys(envelope.nodes[0]).sort(), [...OSNG_FINISHED_TOP_KEYS].sort());
});

test('envelopeFromOsngProposalFile silently drops non-allowlisted keys and normalizes evidences', () => {
  const intent = 'tiny garden FAQ';
  const envelope = envelopeFromOsngProposalFile(
    JSON.stringify({
      root_osn_id: 'draft.garden.osn',
      nodes: [
        {
          id: 'draft.garden.osn',
          title: 'Garden FAQ',
          seed: intent,
          thematic_lenses: ['community'],
          output_spec: 'One FAQ page',
          success_evidences: [
            {
              type: 'TEXTUAL_SNIPPET',
              description: 'Mentions joining',
              snippet: 'how to join'
            }
          ]
        }
      ]
    }),
    intent,
    { max_descendants_effective: 0 }
  );
  const node = envelope.nodes[0];
  const ev = node.success_evidences[0];
  assert.equal(ev.kind, 'TEXTUAL_SNIPPET');
  assert.match(ev.inspection_prompt, /how to join/);
  assert.equal(node.seed, undefined);
  assert.equal(node.thematic_lenses, undefined);
  assert.equal(node.title, undefined);
});

test('envelopeFromOsngProposalFile rejects malformed JSON without fallback', () => {
  assert.throws(
    () => envelopeFromOsngProposalFile('not json', 'intent', {}),
    (err) => err && err.statusCode === 502 && err.message === 'osng_proposal_not_json'
  );
});

test('envelopeFromOsngProposalFile rejects empty nodes without fallback', () => {
  assert.throws(
    () =>
      envelopeFromOsngProposalFile(
        JSON.stringify({ root_osn_id: 'x', nodes: [] }),
        'intent',
        { max_descendants_effective: 0 }
      ),
    (err) => err && err.statusCode === 502
  );
});

test('validatePrimaryAfterSync accepts OSNG_PROPOSAL.json shape', async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'osng-propose-'));
  try {
    await fsp.writeFile(
      path.join(dir, OSNG_PROPOSAL_PRIMARY),
      JSON.stringify({
        root_osn_id: 'draft.a.osn',
        nodes: [{ id: 'draft.a.osn', title: 'A', seed: 'seed' }]
      }),
      'utf8'
    );
    const gate = await validatePrimaryAfterSync(dir, OSNG_PROPOSER_PLUGIN_ID);
    assert.equal(gate.ok, true);
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test('validatePrimaryAfterSync rejects bad OSNG_PROPOSAL.json', async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'osng-propose-bad-'));
  try {
    await fsp.writeFile(
      path.join(dir, OSNG_PROPOSAL_PRIMARY),
      JSON.stringify({ hello: 'world' }),
      'utf8'
    );
    const gate = await validatePrimaryAfterSync(dir, OSNG_PROPOSER_PLUGIN_ID);
    assert.equal(gate.ok, false);
    assert.equal(gate.reason, 'osng_proposal_shape');
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test('startLexiom13OsngPropose creates workspace + awaiting_browser ticket', async () => {
  const repoRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'osng-propose-repo-'));
  try {
    const started = await startLexiom13OsngPropose(repoRoot, {
      intent: 'Need a document SUD for onboarding.',
      max_descendants: 3
    });
    assert.equal(started.status, 'awaiting_browser');
    assert.ok(started.run_id);
    assert.ok(started.session_id);
    assert.ok(started.ca_session);
    assert.equal(started.ca_session.plugin_id, OSNG_PROPOSER_PLUGIN_ID);
    assert.equal(started.meta.labor, 'hanuman_browser_ca');
    assert.equal(started.meta.clamped, true);
    assert.equal(started.meta.max_descendants_effective, 0);

    const outDir = path.join(repoRoot, 'builds', 'lexiom13-propose', started.run_id);
    const intent = await fsp.readFile(path.join(outDir, 'INTENT.md'), 'utf8');
    assert.match(intent, /onboarding/);
    const agentPrompt = await fsp.readFile(path.join(outDir, 'AGENT_PROMPT.md'), 'utf8');
    assert.match(agentPrompt, /Ram .* has raised this request for an \*\*OSNG proposition\*\*/);
    assert.match(agentPrompt, /Outcome-facing language/);
    assert.match(agentPrompt, /\*\*Never\*\* put those names/);
    assert.match(agentPrompt, /not .Ram.s trip/);
    assert.match(agentPrompt, /inspection_prompt/);
    assert.match(agentPrompt, /Do NOT use type\/description\/snippet/);
    assert.match(agentPrompt, /exactly 3 thematic lenses/);
    assert.match(agentPrompt, /Fold into output_spec/);
    assert.match(agentPrompt, new RegExp(PROPOSE_SEED_ARTIFACT));
    assert.match(agentPrompt, new RegExp(PROPOSE_LENSES_ARTIFACT));
    assert.match(agentPrompt, /\{uuid\}\.osn/);
    assert.match(agentPrompt, /encode outcome words/);
    assert.match(agentPrompt, /put `title`, `seed`/);
    assert.match(agentPrompt, /finished node/);
    const brief = JSON.parse(
      await fsp.readFile(path.join(outDir, 'PROPOSE_BRIEF.json'), 'utf8')
    );
    assert.equal(brief.raised_by, 'ram');
    assert.equal(brief.laborer, 'hanuman');
    assert.equal(brief.authority, undefined);
    assert.equal(brief.request, 'osng_proposition');
    assert.equal(brief.sun, 'gt3');
    assert.equal(brief.method.thematic_lenses_count, 3);
    assert.deepEqual(brief.method.mid_method_artifacts, [
      PROPOSE_SEED_ARTIFACT,
      PROPOSE_LENSES_ARTIFACT
    ]);
    assert.deepEqual(brief.method.finished_node_allowlist, [...OSNG_FINISHED_TOP_KEYS]);
    await fsp.access(path.join(outDir, 'PROPOSE_BRIEF.json'));
    await fsp.access(path.join(outDir, 'HANDOFF.json'));
    await fsp.access(path.join(outDir, 'RUN_RESULT.json'));

    const status = await readLexiom13OsngProposeStatus(repoRoot, started.run_id);
    assert.equal(status.status, 'awaiting_browser');
    assert.equal(status.run_id, started.run_id);
  } finally {
    await fsp.rm(repoRoot, { recursive: true, force: true });
  }
});

test('startLexiom13OsngPropose rejects empty intent', async () => {
  await assert.rejects(
    () => startLexiom13OsngPropose(os.tmpdir(), { intent: '   ' }),
    (err) => err && err.statusCode === 400
  );
});

test('sync proposeLexiom13OsngFromIntent is gone (410)', async () => {
  await assert.rejects(
    () => proposeLexiom13OsngFromIntent({ intent: 'x' }),
    (err) => err && err.statusCode === 410
  );
});

const SAMPLE_ENVELOPE = {
  root_osn_id: 'a1b2c3d4-e5f6-4780-abcd-ef1234567890.osn',
  nodes: [
    {
      schema_version: 'osn/0.2',
      id: 'a1b2c3d4-e5f6-4780-abcd-ef1234567890.osn',
      file_name: 'a1b2c3d4-e5f6-4780-abcd-ef1234567890.osn',
      owner: 'Ram',
      graph: {
        parent_osn_ids: [],
        child_osn_ids: [],
        standard_ancestor_osn_ids: []
      },
      output_spec: 'A short travel poem.',
      success_evidences: [
        {
          evidence_id: 'ev.direct.textual_snippet.1',
          kind: 'TEXTUAL_SNIPPET',
          direct: true,
          inspection_prompt: 'Poem mentions Berlin.'
        }
      ]
    }
  ]
};

test('buildModalChatAgentPrompt lineage vs edit contracts', () => {
  const lineage = buildModalChatAgentPrompt({
    contract: MODAL_CHAT_CONTRACT_LINEAGE,
    question: 'Why this evidence?',
    thread: [{ role: 'user', content: 'hi' }],
    focusSample: { serial: 1, type: 'TEXTUAL_SNIPPET' },
    evidenceSummary: [{ serial: 1 }]
  });
  assert.match(lineage, /lineage_readonly/);
  assert.match(lineage, /only file you write/);
  assert.match(lineage, /Do \*\*not\*\* write `OSNG_PROPOSAL\.json`/);
  assert.match(lineage, new RegExp(MODAL_CHAT_FOCUS_CONTENT));
  assert.match(lineage, new RegExp(MODAL_CHAT_REPLY));
  assert.doesNotMatch(lineage, /edit_osng \(mandatory\)/);

  const edit = buildModalChatAgentPrompt({
    contract: MODAL_CHAT_CONTRACT_EDIT,
    question: 'Tighten the output_spec',
    thread: [],
    focusSample: { serial: 0, type: 'DOCUMENT' },
    evidenceSummary: []
  });
  assert.match(edit, /edit_osng/);
  assert.match(edit, /revise the draft OSNG|PRIOR_OSNG\.json/);
  assert.match(edit, new RegExp(MODAL_CHAT_REPLY));
  assert.match(edit, /already holds a copy/);
  assert.doesNotMatch(edit, /only file you write/);
});

test('startLexiom13ModalChat seeds PRIOR_OSNG + contract prompt', async () => {
  const repoRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'osng-modal-chat-'));
  try {
    const started = await startLexiom13ModalChat(repoRoot, {
      contract: MODAL_CHAT_CONTRACT_LINEAGE,
      question: 'How does evidence 1 relate to the root?',
      osng_envelope: SAMPLE_ENVELOPE,
      focus_sample: { serial: 1, type: 'TEXTUAL_SNIPPET', status: 'C' },
      focus_content: 'Grey stones hum beneath the Spree.',
      evidence_summary: [{ serial: 1, kind: 'TEXTUAL_SNIPPET', status: 'collected' }],
      thread: [{ role: 'user', content: 'earlier' }]
    });
    assert.equal(started.status, 'awaiting_browser');
    assert.equal(started.meta.mode, MODAL_CHAT_MODE);
    assert.equal(started.meta.contract, MODAL_CHAT_CONTRACT_LINEAGE);
    assert.equal(started.ca_session.plugin_id, OSNG_PROPOSER_PLUGIN_ID);

    const outDir = path.join(repoRoot, 'builds', 'lexiom13-propose', started.run_id);
    const prior = JSON.parse(
      await fsp.readFile(path.join(outDir, MODAL_CHAT_PRIOR_OSNG), 'utf8')
    );
    assert.equal(prior.root_osn_id, SAMPLE_ENVELOPE.root_osn_id);
    await fsp.access(path.join(outDir, MODAL_CHAT_FOCUS));
    await fsp.access(path.join(outDir, MODAL_CHAT_EVIDENCE));
    const focusContent = await fsp.readFile(path.join(outDir, MODAL_CHAT_FOCUS_CONTENT), 'utf8');
    assert.match(focusContent, /Grey stones hum/);
    const seeded = JSON.parse(
      await fsp.readFile(path.join(outDir, OSNG_PROPOSAL_PRIMARY), 'utf8')
    );
    assert.deepEqual(seeded, prior);
    const prompt = await fsp.readFile(path.join(outDir, 'AGENT_PROMPT.md'), 'utf8');
    assert.match(prompt, /lineage_readonly/);
    assert.match(prompt, /How does evidence 1 relate/);
    assert.match(prompt, new RegExp(MODAL_CHAT_REPLY));
    const brief = JSON.parse(
      await fsp.readFile(path.join(outDir, 'PROPOSE_BRIEF.json'), 'utf8')
    );
    assert.equal(brief.mode, MODAL_CHAT_MODE);
    assert.equal(brief.contract, MODAL_CHAT_CONTRACT_LINEAGE);
  } finally {
    await fsp.rm(repoRoot, { recursive: true, force: true });
  }
});

test('startLexiom13OsngPropose mode modal_chat routes to modal chat', async () => {
  const repoRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'osng-modal-via-propose-'));
  try {
    const started = await startLexiom13OsngPropose(repoRoot, {
      mode: MODAL_CHAT_MODE,
      contract: MODAL_CHAT_CONTRACT_EDIT,
      question: 'Make the poem shorter',
      osng_envelope: SAMPLE_ENVELOPE
    });
    assert.equal(started.meta.mode, MODAL_CHAT_MODE);
    assert.equal(started.meta.contract, MODAL_CHAT_CONTRACT_EDIT);
    const outDir = path.join(repoRoot, 'builds', 'lexiom13-propose', started.run_id);
    const prompt = await fsp.readFile(path.join(outDir, 'AGENT_PROMPT.md'), 'utf8');
    assert.match(prompt, /edit_osng/);
    assert.match(prompt, /Make the poem shorter/);
  } finally {
    await fsp.rm(repoRoot, { recursive: true, force: true });
  }
});

async function makeModalGateDirs(contract, stagedFiles) {
  const canonical = await fsp.mkdtemp(path.join(os.tmpdir(), 'modal-gate-'));
  const stage = path.join(canonical, '.ca-staging', 'cas_test');
  await fsp.mkdir(stage, { recursive: true });
  await fsp.writeFile(
    path.join(canonical, 'PROPOSE_BRIEF.json'),
    JSON.stringify({ mode: MODAL_CHAT_MODE, contract, chat_reply: MODAL_CHAT_REPLY }),
    'utf8'
  );
  for (const [name, content] of Object.entries(stagedFiles)) {
    await fsp.writeFile(path.join(stage, name), content, 'utf8');
  }
  return { canonical, stage };
}

const WRAPPED_PROPOSAL =
  '{"ok":true,"path":"PRIOR_OSNG.json","content":"{\\n  \\"root_osn_id\\": \\"x\\"\\n}"';

test('modal gate (lineage): broken staged proposal is dropped, reply survives', async () => {
  const { canonical, stage } = await makeModalGateDirs(MODAL_CHAT_CONTRACT_LINEAGE, {
    [MODAL_CHAT_REPLY]: 'The poem has 27 words.',
    [OSNG_PROPOSAL_PRIMARY]: WRAPPED_PROPOSAL
  });
  try {
    const gate = await validatePrimaryAfterSync(stage, OSNG_PROPOSER_PLUGIN_ID, {
      canonicalDir: canonical
    });
    assert.equal(gate.ok, true);
    assert.deepEqual(gate.drop_paths, [OSNG_PROPOSAL_PRIMARY]);
    assert.equal(gate.warning, null);
  } finally {
    await fsp.rm(canonical, { recursive: true, force: true });
  }
});

test('modal gate (edit): invalid proposal becomes a warning, not a failure', async () => {
  const { canonical, stage } = await makeModalGateDirs(MODAL_CHAT_CONTRACT_EDIT, {
    [MODAL_CHAT_REPLY]: 'Shortened the spec.',
    [OSNG_PROPOSAL_PRIMARY]: WRAPPED_PROPOSAL
  });
  try {
    const gate = await validatePrimaryAfterSync(stage, OSNG_PROPOSER_PLUGIN_ID, {
      canonicalDir: canonical
    });
    assert.equal(gate.ok, true);
    assert.deepEqual(gate.drop_paths, [OSNG_PROPOSAL_PRIMARY]);
    assert.equal(gate.warning.reason, 'primary_not_json');
  } finally {
    await fsp.rm(canonical, { recursive: true, force: true });
  }
});

test('modal gate (edit): valid revised proposal is kept', async () => {
  const { canonical, stage } = await makeModalGateDirs(MODAL_CHAT_CONTRACT_EDIT, {
    [MODAL_CHAT_REPLY]: 'Shortened the spec.',
    [OSNG_PROPOSAL_PRIMARY]: JSON.stringify(SAMPLE_ENVELOPE)
  });
  try {
    const gate = await validatePrimaryAfterSync(stage, OSNG_PROPOSER_PLUGIN_ID, {
      canonicalDir: canonical
    });
    assert.equal(gate.ok, true);
    assert.deepEqual(gate.drop_paths, []);
    assert.equal(gate.warning, null);
  } finally {
    await fsp.rm(canonical, { recursive: true, force: true });
  }
});

test('modal gate: missing CHAT_REPLY.md fails', async () => {
  const { canonical, stage } = await makeModalGateDirs(MODAL_CHAT_CONTRACT_LINEAGE, {});
  try {
    const gate = await validatePrimaryAfterSync(stage, OSNG_PROPOSER_PLUGIN_ID, {
      canonicalDir: canonical
    });
    assert.equal(gate.ok, false);
    assert.equal(gate.reason, 'chat_reply_missing');
  } finally {
    await fsp.rm(canonical, { recursive: true, force: true });
  }
});

test('startLexiom13ModalChat rejects bad contract and missing envelope', async () => {
  await assert.rejects(
    () =>
      startLexiom13ModalChat(os.tmpdir(), {
        contract: 'nope',
        question: 'q',
        osng_envelope: SAMPLE_ENVELOPE
      }),
    (err) => err && err.statusCode === 400
  );
  await assert.rejects(
    () =>
      startLexiom13ModalChat(os.tmpdir(), {
        contract: MODAL_CHAT_CONTRACT_LINEAGE,
        question: 'q',
        osng_envelope: { root_osn_id: 'x', nodes: [] }
      }),
    (err) => err && err.statusCode === 400
  );
});
