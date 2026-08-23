/**
 * Follow-up only — former browser_session adapter that scheduled Aider via Docker.
 * Product path is bolt_webcontainer:
 *   - server: lib/caWorkers/boltWebContainerServer.js
 *   - SPA: public/gt2/Lexiom_1_3/ca/serveRamUnderGt3.js
 * Docker/Aider helpers remain in lib/lexiom13AgentRuntime.js for a future `aider_docker` adapter.
 */
import {
  EXECUTOR_ID as AIDER_EXECUTOR_ID,
  BUILDER_TIMEOUT_MS,
  primaryArtifactForPlugin,
  runBuilderPass
} from '../lexiom13AgentRuntime.js';
import { CA_LOCATION_BROWSER_SESSION } from '../lexiom13CaSessionRegistry.js';

/** @deprecated Product executor is bolt_webcontainer */
export const EXECUTOR_ID = AIDER_EXECUTOR_ID;
export { BUILDER_TIMEOUT_MS, primaryArtifactForPlugin };

/**
 * @deprecated Follow-up — not used by lexiom13CaDispatcher product path
 */
export async function runBrowserSessionBuilderPass(opts) {
  const err = new Error(
    'runBrowserSessionBuilderPass is Follow-up only (aider_docker). Product executor is bolt_webcontainer.'
  );
  err.code = 'agent_unavailable';
  err.reason = 'executor_unsupported';
  throw err;
}

/**
 * @deprecated Use boltWebContainerServer.buildSessionWorkspaceManifest
 */
export async function buildSessionWorkspaceManifest() {
  return {
    schema_version: 'lexiom13-ca-session-workspace/legacy',
    ca_location: CA_LOCATION_BROWSER_SESSION,
    executor: AIDER_EXECUTOR_ID,
    files: [],
    note: 'Deprecated — use boltWebContainerServer'
  };
}

void runBuilderPass;
