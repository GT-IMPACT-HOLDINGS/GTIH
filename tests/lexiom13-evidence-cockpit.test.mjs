import assert from 'node:assert/strict';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { listFocusEvidenceCollections } from '../lib/lexiom13EvidenceCockpitSync.js';

test('listFocusEvidenceCollections skips empty/corrupt HANDOFF.json without 500', async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'lexiom13-ev-cockpit-'));
  const goodRun = path.join(root, 'builds', 'lexiom13', 'good_run');
  const badRun = path.join(root, 'builds', 'lexiom13', 'bad_run');
  await fsp.mkdir(goodRun, { recursive: true });
  await fsp.mkdir(badRun, { recursive: true });

  const focusId = 'GT_Philosophy.BrandLexiom.a1000005.osn';
  await fsp.writeFile(
    path.join(goodRun, 'EVIDENCE_PLAN.json'),
    JSON.stringify({
      schema_version: 'lexiom13-evidence-collection/1',
      targets: [
        {
          target_id: `${focusId}::sev.brand.brand_lexiom.delivered_artifact`,
          osn_id: focusId,
          evidence_id: 'sev.brand.brand_lexiom.delivered_artifact',
          kind: 'TEXTUAL_SNIPPET',
          direct: true,
          expected_relative_path:
            'evidences/GT_Philosophy.BrandLexiom.a1000005.osn.sev.brand.brand_lexiom.delivered_artifact.v1.md'
        }
      ]
    }),
    'utf8'
  );
  await fsp.writeFile(
    path.join(goodRun, 'EVIDENCE_MANIFEST.json'),
    JSON.stringify({
      schema_version: 'lexiom13-evidence-manifest/1',
      collected_at: new Date().toISOString(),
      entries: [
        {
          target_id: `${focusId}::sev.brand.brand_lexiom.delivered_artifact`,
          osn_id: focusId,
          evidence_id: 'sev.brand.brand_lexiom.delivered_artifact',
          status: 'collected',
          artifact_paths: [
            'evidences/GT_Philosophy.BrandLexiom.a1000005.osn.sev.brand.brand_lexiom.delivered_artifact.v1.md'
          ],
          collected_by: 'host_span'
        }
      ]
    }),
    'utf8'
  );
  await fsp.mkdir(path.join(goodRun, 'evidences'), { recursive: true });
  await fsp.writeFile(
    path.join(
      goodRun,
      'evidences',
      'GT_Philosophy.BrandLexiom.a1000005.osn.sev.brand.brand_lexiom.delivered_artifact.v1.md'
    ),
    '> excerpt\n',
    'utf8'
  );

  // Corrupt sibling run previously crashed the whole collections endpoint.
  await fsp.writeFile(path.join(badRun, 'HANDOFF.json'), '\n', 'utf8');
  await fsp.writeFile(path.join(badRun, 'EVIDENCE_PLAN.json'), '{', 'utf8');

  const result = await listFocusEvidenceCollections(root, focusId);
  assert.equal(result.osn_id, focusId);
  assert.ok(Array.isArray(result.targets));
  assert.equal(result.targets.length, 1);
  assert.equal(result.targets[0].status, 'collected');
  assert.ok(result.targets[0].artifact);

  await fsp.rm(root, { recursive: true, force: true });
});

test('listFocusEvidenceCollections with runId ignores older runs reusing the OSN id', async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'lexiom13-ev-run-'));
  const focusId = 'a7f2d8c1-4e9b-11ee-be56-0242ac120002.osn';
  async function writeRun(runId, evidenceIds, collectedAt) {
    const runDir = path.join(root, 'builds', 'lexiom13', runId);
    await fsp.mkdir(runDir, { recursive: true });
    const targets = evidenceIds.map((eid) => ({
      target_id: `${focusId}::${eid}`,
      osn_id: focusId,
      evidence_id: eid,
      kind: 'TEXTUAL_SNIPPET',
      direct: true,
      expected_relative_path: `evidences/${focusId}.${eid}.v1.md`
    }));
    await fsp.writeFile(
      path.join(runDir, 'EVIDENCE_PLAN.json'),
      JSON.stringify({ schema_version: 'lexiom13-evidence-collection/1', targets }),
      'utf8'
    );
    await fsp.writeFile(
      path.join(runDir, 'EVIDENCE_MANIFEST.json'),
      JSON.stringify({
        schema_version: 'lexiom13-evidence-manifest/1',
        collected_at: collectedAt,
        entries: targets.map((t) => ({ ...t, status: 'pending' }))
      }),
      'utf8'
    );
  }
  await writeRun('old_run', ['ev.1', 'ev.2', 'ev.3'], '2026-09-27T00:00:00.000Z');
  await writeRun('new_run', ['ev.1'], '2026-10-05T00:00:00.000Z');

  const merged = await listFocusEvidenceCollections(root, focusId);
  assert.equal(merged.targets.length, 3);
  const scoped = await listFocusEvidenceCollections(root, focusId, { runId: 'new_run' });
  assert.equal(scoped.targets.length, 1);
  assert.equal(scoped.targets[0].evidence_id, 'ev.1');

  await fsp.rm(root, { recursive: true, force: true });
});
