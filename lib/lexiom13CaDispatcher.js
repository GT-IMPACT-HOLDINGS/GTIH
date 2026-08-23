/**
 * Lexiom 1.3 CA Job dispatcher — location-agnostic seam.
 * Sole product path: browser_session + bolt_webcontainer (browser owns the run).
 * host/remote/aider_docker are Follow-up only.
 * CA secondary name: Hanuman (devotee of Ram / the player; see lexiom13CaNaming.js).
 */
import path from 'path';
import fsp from 'fs/promises';
import {
  CA_LOCATION_BROWSER_SESSION,
  createCaSession,
  getCaSession,
  heartbeatCaSession,
  cancelCaSession,
  requireCaSessionAccess,
  isTerminalCaSession,
  markCaSessionStatus
} from './lexiom13CaSessionRegistry.js';
import {
  buildSessionWorkspaceManifest,
  readWorkspaceFile,
  stageSessionArtifacts,
  promoteSessionArtifacts,
  discardSessionArtifacts,
  sessionStageDirectory,
  validatePrimaryAfterSync,
  BUILDER_TIMEOUT_MS,
  EVIDENCE_TIMEOUT_MS
} from './caWorkers/boltWebContainerServer.js';
import { validateEvidenceManifestAfterSync } from './lexiom13BuildEvidence.js';
import { DUMMY_OPENAI_API_KEY } from './lexiom13CaPolicy.js';

export const EXECUTOR_ID = 'bolt_webcontainer';
export const CA_RUNTIME = 'webcontainer';
export { BUILDER_TIMEOUT_MS, EVIDENCE_TIMEOUT_MS, CA_LOCATION_BROWSER_SESSION };
export const SUPPORTED_CA_LOCATIONS = Object.freeze([CA_LOCATION_BROWSER_SESSION]);
export const SUPPORTED_EXECUTORS = Object.freeze([EXECUTOR_ID]);

/**
 * @param {string} [requested]
 */
export function resolveCaLocation(requested) {
  const loc = requested ? String(requested).trim() : CA_LOCATION_BROWSER_SESSION;
  if (!loc || loc === CA_LOCATION_BROWSER_SESSION) {
    return CA_LOCATION_BROWSER_SESSION;
  }
  const err = new Error(
    `CA location "${loc}" is not supported. Only browser_session is available (host/remote are Follow-up).`
  );
  err.code = 'agent_unavailable';
  err.reason = 'ca_location_unsupported';
  throw err;
}

/**
 * Issue a browser_session Job ticket. Browser worker owns execution (no server docker).
 * @param {{
 *   runId: string,
 *   pluginId: string,
 *   outputDirectory: string,
 *   productPort?: number,
 *   pass?: string,
 *   caLocation?: string
 * }} opts
 */
export function issueCaJobTicket(opts) {
  const caLocation = resolveCaLocation(opts.caLocation);
  const pass = opts.pass === 'evidence' ? 'evidence' : 'builder';
  const timeoutMs =
    typeof opts.timeoutMs === 'number' && opts.timeoutMs > 0
      ? opts.timeoutMs
      : pass === 'evidence'
        ? EVIDENCE_TIMEOUT_MS
        : BUILDER_TIMEOUT_MS;
  const session = createCaSession({
    runId: opts.runId,
    pluginId: opts.pluginId,
    outputDirectory: opts.outputDirectory,
    pass,
    timeoutMs
  });
  const brokerPath = `/v1/agent/${encodeURIComponent(opts.runId)}/${session.pass}`;
  return {
    run_id: opts.runId,
    session_id: session.session_id,
    pass: session.pass,
    plugin_id: opts.pluginId,
    ca_location: caLocation,
    executor: EXECUTOR_ID,
    runtime: CA_RUNTIME,
    // GT3-internal broker routing (never required in Hanuman/ca source).
    broker_path: brokerPath,
    broker_token: DUMMY_OPENAI_API_KEY,
    // Agent-facing aliases: Hanuman consults GT3 only — no broker vocabulary.
    gt3_consult_path: brokerPath,
    gt3_consult_credential: DUMMY_OPENAI_API_KEY,
    capability_token: session.capability_token,
    timeout_ms: timeoutMs,
    workspace: {
      kind: 'sync',
      manifest_path: `/lexiom13/build/session/${encodeURIComponent(session.session_id)}/workspace`,
      file_path_template: `/lexiom13/build/session/${encodeURIComponent(session.session_id)}/file?path=`
    },
    artifacts_path: `/lexiom13/build/session/${encodeURIComponent(session.session_id)}/artifacts`,
    report_path: `/lexiom13/build/session/${encodeURIComponent(session.session_id)}/report`
  };
}

/**
 * Product path no longer runs the agent on the server.
 * Kept so callers that await "dispatch" get a clear contract: browser owns the job.
 * @param {{ sessionId: string }} opts
 */
export async function dispatchCaJob(opts) {
  const session = getCaSession(opts.sessionId);
  if (!session) {
    const err = new Error('CA session not found or expired');
    err.code = 'agent_unavailable';
    err.reason = 'session_missing';
    throw err;
  }
  if (session.ca_location !== CA_LOCATION_BROWSER_SESSION) {
    resolveCaLocation(session.ca_location);
  }
  markCaSessionStatus(session.session_id, 'awaiting_browser');
  return {
    ok: true,
    deferred_to_browser: true,
    executor: EXECUTOR_ID,
    ca_location: CA_LOCATION_BROWSER_SESSION,
    session_id: session.session_id,
    detail:
      'CA Job issued for bolt_webcontainer. Lexiom SPA must syncIn → runAgent → syncOut → report.'
  };
}

/**
 * @param {string} sessionId
 */
export async function readSessionWorkspace(sessionId, capabilityToken) {
  const session = requireCaSessionAccess(sessionId, capabilityToken);
  return buildSessionWorkspaceManifest(session.output_directory, session.session_id);
}

/**
 * @param {string} sessionId
 * @param {string} relPath
 */
export async function readSessionWorkspaceFile(sessionId, relPath, capabilityToken) {
  const session = requireCaSessionAccess(sessionId, capabilityToken);
  return readWorkspaceFile(session.output_directory, relPath);
}

/**
 * @param {string} sessionId
 * @param {{ files?: Array<{ path: string, content: string, encoding?: string }> }} body
 */
export async function writeSessionArtifacts(sessionId, body, capabilityToken) {
  const session = requireCaSessionAccess(sessionId, capabilityToken);
  const written = await stageSessionArtifacts(
    session.output_directory,
    session.session_id,
    body && body.files,
    { pass: session.pass }
  );
  session.staged_files = written;
  markCaSessionStatus(session.session_id, 'staged');
  return { written, session_id: session.session_id, run_id: session.run_id };
}

/**
 * Finalize RUN_RESULT from browser worker report.
 * @param {string} sessionId
 * @param {object} report
 * @param {(result: object) => Promise<void>} onFinalize — build-plugins callback
 */
export async function applySessionReport(
  sessionId,
  report,
  onFinalize,
  capabilityToken = null
) {
  const session = getCaSession(sessionId);
  if (!session) {
    const err = new Error('CA session not found');
    err.code = 'session_missing';
    err.statusCode = 404;
    throw err;
  }
  if (capabilityToken) {
    requireCaSessionAccess(sessionId, capabilityToken, { allowTerminal: true });
  }
  if (isTerminalCaSession(session) && session.final_result) {
    return session.final_result;
  }
  const statusIn = report && report.status ? String(report.status) : 'agent_failed';
  let status = statusIn;
  let reason = report && report.reason ? String(report.reason) : null;
  let detail = report && report.detail ? String(report.detail) : null;

  if (statusIn === 'completed') {
    const stageDir = sessionStageDirectory(session.output_directory, session.session_id);
    const gate =
      session.pass === 'evidence'
        ? await validateEvidenceManifestAfterSync(stageDir, {
            canonicalDir: session.output_directory
          })
        : await validatePrimaryAfterSync(stageDir, session.plugin_id, {
            canonicalDir: session.output_directory
          });
    if (!gate.ok) {
      status = 'agent_failed';
      reason = gate.reason || (session.pass === 'evidence' ? 'evidence_invalid' : 'primary_invalid');
      detail =
        gate.detail ||
        (session.pass === 'evidence'
          ? 'Evidence collection validation failed after syncOut'
          : 'Primary artifact validation failed after syncOut');
      await discardSessionArtifacts(session.output_directory, session.session_id);
    } else {
      await promoteSessionArtifacts(session.output_directory, session.session_id);
    }
  } else {
    await discardSessionArtifacts(session.output_directory, session.session_id);
  }

  markCaSessionStatus(
    session.session_id,
    status === 'completed' ? 'completed' : status === 'agent_unavailable' ? 'unavailable' : 'failed'
  );

  const result = {
    status,
    executor: EXECUTOR_ID,
    ca_location: CA_LOCATION_BROWSER_SESSION,
    runtime: CA_RUNTIME,
    session_id: session.session_id,
    pass: session.pass,
    run_id: session.run_id,
    reason,
    detail,
    agent: {
      launched: true,
      status,
      reason,
      pass: session.pass,
      ca_location: CA_LOCATION_BROWSER_SESSION,
      executor: EXECUTOR_ID
    },
    latency_ms: report && typeof report.latency_ms === 'number' ? report.latency_ms : null,
    metrics: report && report.metrics && typeof report.metrics === 'object'
      ? report.metrics
      : null,
    log_tail: report && report.log_tail ? String(report.log_tail).slice(-8000) : null
  };

  if (typeof onFinalize === 'function') {
    await onFinalize(result, session);
  }
  session.final_result = result;
  return result;
}

export function heartbeatSession(sessionId, capabilityToken) {
  requireCaSessionAccess(sessionId, capabilityToken);
  return heartbeatCaSession(sessionId);
}

export function cancelSession(sessionId, capabilityToken) {
  requireCaSessionAccess(sessionId, capabilityToken, { allowTerminal: true });
  return cancelCaSession(sessionId);
}

/** @deprecated Follow-up — Docker/Aider path no longer product-dispatched */
export async function dispatchLegacyAiderDocker() {
  const err = new Error(
    'executor aider_docker is Follow-up only; product path is bolt_webcontainer'
  );
  err.code = 'agent_unavailable';
  err.reason = 'executor_unsupported';
  throw err;
}

export { path, fsp };
