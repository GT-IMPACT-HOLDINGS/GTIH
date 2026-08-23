import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import {
  listLexiom13OsnYamlPaths,
  loadOsnGraphIndex,
  validateOsnForUpdate,
} from '../lib/lexiom13OsnPersist.js';

const STATIC_ROOT = path.join(process.cwd(), 'public');
const BRAND_ROOT_ID = 'GT_Philosophy.BrandLexiom.a1000005.osn';

test('live graph contains a valid five-generation BrandLexiom binary subtree', async () => {
  const paths = await listLexiom13OsnYamlPaths(STATIC_ROOT);
  assert.equal(paths.length, 67);
  assert.equal(paths.filter((publicPath) => publicPath.includes('/Branding/')).length, 63);

  const index = await loadOsnGraphIndex(STATIC_ROOT);
  assert.equal(index.size, 67);

  for (const [id, entry] of index) {
    assert.deepEqual(validateOsnForUpdate(entry.parsed), [], id);
    assert.equal(`${entry.parsed.file_name}.yaml`, entry.fileName, id);

    for (const parentId of entry.parsed.graph.parent_osn_ids) {
      assert(index.has(parentId), `${id} references missing parent ${parentId}`);
      assert(
        index.get(parentId).parsed.graph.child_osn_ids.includes(id),
        `${parentId} does not reciprocally reference child ${id}`
      );
    }

    for (const childId of entry.parsed.graph.child_osn_ids) {
      assert(index.has(childId), `${id} references missing child ${childId}`);
      assert(
        index.get(childId).parsed.graph.parent_osn_ids.includes(id),
        `${childId} does not reciprocally reference parent ${id}`
      );
    }
  }

  const brandRoot = index.get(BRAND_ROOT_ID);
  assert(brandRoot, 'BrandLexiom root is missing');

  const queue = [[brandRoot.parsed, 0]];
  let brandNodeCount = 0;
  while (queue.length) {
    const [osn, depth] = queue.shift();
    brandNodeCount += 1;
    assert.equal(
      osn.graph.child_osn_ids.length,
      depth < 5 ? 2 : 0,
      `${osn.id} has the wrong child count at depth ${depth}`
    );
    for (const childId of osn.graph.child_osn_ids) {
      queue.push([index.get(childId).parsed, depth + 1]);
    }
  }

  assert.equal(brandNodeCount, 63);
});
