import assert from 'node:assert/strict';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('build glyph separates prepare from VAL activation', async () => {
  const source = await fsp.readFile(
    path.join(repoRoot, 'public', 'gt2', 'Lexiom_1_3', 'app.js'),
    'utf8'
  );

  const prepareStart = source.indexOf('function prepareBuild(osnId)');
  const runStart = source.indexOf('function runPreparedBuild(osnId)');
  const pollStart = source.indexOf('function pollLexiom13BuildStatus');
  assert.ok(prepareStart >= 0 && runStart > prepareStart && pollStart > runStart);

  const prepareBody = source.slice(prepareStart, runStart);
  const runBody = source.slice(runStart, pollStart);

  assert.match(prepareBody, /fetch\("\/lexiom13\/build\/prepare"/);
  assert.doesNotMatch(prepareBody, /fetch\("\/lexiom13\/build\/run"/);
  assert.match(prepareBody, /phase:\s*"prepared"/);
  assert.match(
    prepareBody,
    /Click the build glyph again to activate VAL/
  );

  assert.match(runBody, /fetch\("\/lexiom13\/build\/run"/);
  assert.match(runBody, /handoff:\s*\{\s*run_id:\s*lifecycle\.runId\s*\}/);
  assert.match(source, /lifecycle\.phase === "prepared"/);
  assert.match(source, /runPreparedBuild\(osn\.id\)/);
});

test('prepared build glyph has a stable distinct color', async () => {
  const styles = await fsp.readFile(
    path.join(repoRoot, 'public', 'gt2', 'Lexiom_1_3', 'styles.css'),
    'utf8'
  );
  assert.match(styles, /\.lexiom-osn-build-trigger\.is-prepared\s*\{/);
  assert.match(styles, /\.lexiom-build-status-banner\.is-prepared\s*\{/);
});
