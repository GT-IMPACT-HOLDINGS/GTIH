/**
 * Opt-in Haiku smoke for document context economy.
 * Requires GT3_LEXIOM_AGENT_KEY or OPENROUTER_API_KEY.
 * Set GT3_SMOKE_CONTEXT_ECONOMY=1 to run against a live broker (otherwise prepare-only).
 */
import { promises as fsp } from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { prepareLexiom13Build } from '../lib/lexiom13BuildPlugins.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const STATIC_ROOT = path.join(REPO_ROOT, 'public');

async function main() {
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'lexiom13-smoke-ctx-'));
  const handoff = await prepareLexiom13Build(STATIC_ROOT, tmp, {
    compilation_root_osn_id: 'GT_Philosophy.BrandLexiom.a1000005.osn',
    strategy_id: 'outline_then_fill',
    run_id: `smoke_ctx_${Date.now().toString(36)}`
  });

  const plan = JSON.parse(
    await fsp.readFile(path.join(handoff.output_directory, 'BUILD_PLAN.json'), 'utf8')
  );
  console.log(
    JSON.stringify(
      {
        ok: true,
        run_id: handoff.run_id,
        capsule_count: handoff.context_economy?.capsule_count,
        cluster_count: handoff.context_economy?.cluster_count,
        source_count: handoff.context_economy?.source_count,
        section_files: plan.section_files?.map((s) => s.path),
        live_broker:
          process.env.GT3_SMOKE_CONTEXT_ECONOMY === '1'
            ? 'requested_but_browser_owned'
            : 'prepare_only'
      },
      null,
      2
    )
  );

  if (handoff.context_economy?.cluster_count !== 4) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
