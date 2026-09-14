import { test } from 'node:test';
import assert from 'node:assert/strict';
import fsp from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  startLexiom13OsngPropose,
  readLexiom13OsngProposeStatus,
  envelopeFromOsngProposalFile,
  normalizeDraftOsn,
  normalizeSuccessEvidences,
  normalizeThematicLenses,
  OSNG_PROPOSER_PLUGIN_ID,
  OSNG_PROPOSAL_PRIMARY,
  proposeLexiom13OsngFromIntent
} from '../lib/lexiom13OsnPropose.js';
import { primaryArtifactForPlugin } from '../lib/lexiom13CaPolicy.js';
import { validatePrimaryAfterSync } from '../lib/caWorkers/boltWebContainerServer.js';

test('primaryArtifactForPlugin maps osng_proposer to OSNG_PROPOSAL.json', () => {
  assert.equal(primaryArtifactForPlugin(OSNG_PROPOSER_PLUGIN_ID), OSNG_PROPOSAL_PRIMARY);
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

test('normalizeDraftOsn coerces Hanuman dialect into Lexiom fields for Tegria', () => {
  const intent = "a 'hellow world' html page";
  const osn = normalizeDraftOsn(
    {
      id: 'hello_world_html.osn',
      title: "Create a 'Hello World' HTML Page",
      seed: intent,
      thematic_lenses: ['web_development', 'html_markup'],
      output_spec: 'A single HTML file',
      success_evidences: [
        {
          type: 'TEXTUAL_SNIPPET',
          description: 'HTML file contains hello world message',
          snippet: 'Hello World'
        }
      ],
      graph: { parent_osn_ids: [], child_osn_ids: [] }
    },
    intent
  );
  assert.equal(typeof osn.thematic_lenses[0], 'object');
  assert.equal(osn.thematic_lenses[0].name, 'web_development');
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
  assert.equal(envelope.meta.labor, 'hanuman_browser_ca');
});

test('envelopeFromOsngProposalFile normalizes Hanuman evidence dialect in nodes', () => {
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
  const ev = envelope.nodes[0].success_evidences[0];
  assert.equal(ev.kind, 'TEXTUAL_SNIPPET');
  assert.match(ev.inspection_prompt, /how to join/);
  assert.equal(envelope.nodes[0].thematic_lenses[0].name, 'community');
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
    assert.match(agentPrompt, /inspection_prompt/);
    assert.match(agentPrompt, /Do NOT use type\/description\/snippet/);
    assert.match(agentPrompt, /exactly 3 thematic lenses/);
    assert.match(agentPrompt, /Compose output_spec from the lenses/);
    const brief = JSON.parse(
      await fsp.readFile(path.join(outDir, 'PROPOSE_BRIEF.json'), 'utf8')
    );
    assert.equal(brief.raised_by, 'ram');
    assert.equal(brief.request, 'osng_proposition');
    assert.equal(brief.sun, 'gt3');
    assert.equal(brief.method.thematic_lenses_count, 3);
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
