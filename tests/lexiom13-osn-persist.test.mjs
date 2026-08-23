import assert from 'node:assert/strict';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  getLexiom13OsnDir,
  listLexiom13OsnYamlPaths,
  loadOsnGraphIndex,
  saveLexiom13Osn,
  serializeLexiom13OsnYaml,
} from '../lib/lexiom13OsnPersist.js';

function validOsn(id, parentIds = []) {
  return {
    schema_version: 'osn/0.2',
    id,
    file_name: id,
    node_type: parentIds.length ? 'discipline' : 'product',
    title: id,
    owner: {
      owner_id: 'test-owner',
      display_name: 'Test Owner',
      role: 'Test Owner',
    },
    graph: {
      parent_osn_ids: parentIds,
      child_osn_ids: [],
      standard_ancestor_osn_ids: [],
      derived_from_lens_id: null,
    },
    seed: `Govern ${id}.`,
    thematic_lenses: [
      {
        lens_id: `lens.${id}.test`,
        name: 'Test',
        purpose: 'Exercise recursive OSN persistence.',
      },
    ],
    output_spec: `Deliver ${id}.`,
    success_evidences: [
      {
        evidence_id: `sev.${id}.artifact`,
        kind: 'direct_document_review',
        direct: true,
        inspection_prompt: `Inspect the delivered artifact for ${id}.`,
      },
    ],
    compilation: {
      can_be_compilation_root: false,
      compilation_scope: 'self_only',
      target_tool_profile: null,
    },
  };
}

test('recursive OSN persistence keeps branch files beside their primary parent', async (t) => {
  const tempRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'lexiom13-osn-'));
  t.after(() => fsp.rm(tempRoot, { recursive: true, force: true }));

  const staticRoot = path.join(tempRoot, 'public');
  const osnRoot = getLexiom13OsnDir(staticRoot);
  const brandingDir = path.join(osnRoot, 'Branding');
  await fsp.mkdir(brandingDir, { recursive: true });

  const parent = validOsn('Root.Brand.a0000001.osn');
  await fsp.writeFile(
    path.join(brandingDir, `${parent.file_name}.yaml`),
    serializeLexiom13OsnYaml(parent),
    'utf8'
  );
  await fsp.writeFile(
    path.join(brandingDir, 'ignored.tomb.osn.yaml'),
    serializeLexiom13OsnYaml(validOsn('ignored.tomb.osn')),
    'utf8'
  );

  assert.deepEqual(await listLexiom13OsnYamlPaths(staticRoot), [
    '/gt2/Lexiom_1_3/Branding/Root.Brand.a0000001.osn.yaml',
  ]);

  const child = validOsn('Root.Brand.Child.a0000002.osn', [parent.id]);
  const created = await saveLexiom13Osn(staticRoot, {
    operation: 'create',
    parentOsnId: parent.id,
    osn: child,
  });
  assert.equal(
    created.sourcePath,
    '/gt2/Lexiom_1_3/Branding/Root.Brand.Child.a0000002.osn.yaml'
  );

  const createdIndex = await loadOsnGraphIndex(staticRoot);
  const createdEntry = createdIndex.get(child.id);
  assert.equal(path.dirname(createdEntry.filePath), brandingDir);
  assert.deepEqual(createdIndex.get(parent.id).parsed.graph.child_osn_ids, [child.id]);

  const renamed = structuredClone(createdEntry.parsed);
  renamed.file_name = 'Root.Brand.RenamedChild.a0000002.osn';
  const updated = await saveLexiom13Osn(staticRoot, {
    operation: 'update',
    previousFileName: child.file_name,
    osn: renamed,
  });
  assert.equal(
    updated.sourcePath,
    '/gt2/Lexiom_1_3/Branding/Root.Brand.RenamedChild.a0000002.osn.yaml'
  );

  const pruned = await saveLexiom13Osn(staticRoot, {
    operation: 'prune',
    rootOsnId: child.id,
  });
  assert.deepEqual(pruned.tombstonedFiles, [
    'Branding/Root.Brand.RenamedChild.a0000002.tomb.osn.yaml',
  ]);
  assert.deepEqual(await listLexiom13OsnYamlPaths(staticRoot), [
    '/gt2/Lexiom_1_3/Branding/Root.Brand.a0000001.osn.yaml',
  ]);
});
