/**
 * Lexiom 1.3 Virtualized Agent Loop — session-pod runner (private detail of browser_session).
 * Launches Aider inside Docker with one RW bind mount of the build dir.
 * OPENAI_API_BASE → GT3 /v1 on host.docker.internal. No Cursor. No AgentFS. No bare-Aider fallback.
 * Product ca_location is browser_session (see lexiom13CaDispatcher); this module is not ca_location=host.
 */
import { spawn } from 'child_process';
import fsp from 'fs/promises';
import path from 'path';
import { readAgentRuntimeBringup } from './gt3AgentRuntimeBringup.js';
import {
  DUMMY_OPENAI_API_KEY,
  primaryArtifactForPlugin
} from './lexiom13CaPolicy.js';

export const EXECUTOR_ID = 'aider_docker';
export const BUILDER_TIMEOUT_MS = 20 * 60 * 1000;
export { DUMMY_OPENAI_API_KEY, primaryArtifactForPlugin };
export const DEFAULT_AIDER_DOCKER_IMAGE =
  process.env.GT3_AIDER_DOCKER_IMAGE || 'paulgauthier/aider';

/**
 * @param {string} repoRoot
 */
export async function resolveDockerAgentRuntime(repoRoot) {
  const bringup = await readAgentRuntimeBringup(repoRoot);
  if (bringup.bringup_status !== 'ok') {
    const err = new Error(
      bringup.detail ||
        `Agent runtime bringup status=${bringup.bringup_status || 'unknown'}`
    );
    err.code = 'agent_unavailable';
    err.reason = 'bringup_not_ok';
    throw err;
  }
  if (!bringup.docker || !bringup.docker.ok) {
    const err = new Error('Docker daemon not available per bringup status');
    err.code = 'agent_unavailable';
    err.reason = 'docker_unavailable';
    throw err;
  }
  const imageName =
    (bringup.image && bringup.image.name) || DEFAULT_AIDER_DOCKER_IMAGE;
  if (!bringup.image || !bringup.image.id) {
    const err = new Error(
      `Aider Docker image not present (${imageName}). Re-run npm run agent-runtime:install.`
    );
    err.code = 'agent_unavailable';
    err.reason = 'image_missing';
    throw err;
  }
  return { bringup, imageName };
}

/**
 * Base URL for Aider inside the container (host GT3).
 * @param {{ port?: number, runId: string, pass?: string }} opts
 */
export function gt3AgentOpenAiBaseUrl(opts) {
  const port = opts.port || parseInt(process.env.PORT || '8080', 10);
  const pass = opts.pass === 'evidence' ? 'evidence' : 'builder';
  return `http://host.docker.internal:${port}/v1/agent/${encodeURIComponent(opts.runId)}/${pass}`;
}

/**
 * @param {{
 *   repoRoot: string,
 *   outputDirectory: string,
 *   runId: string,
 *   pluginId: string,
 *   promptFileName?: string,
 *   timeoutMs?: number,
 *   productPort?: number,
 *   onLog?: (line: string) => void
 * }} opts
 */
export async function runBuilderPass(opts) {
  const outDir = path.resolve(opts.outputDirectory);
  const runId = opts.runId;
  const promptFile = opts.promptFileName || 'AGENT_PROMPT.md';
  const timeoutMs = opts.timeoutMs || BUILDER_TIMEOUT_MS;
  const primaryName = primaryArtifactForPlugin(opts.pluginId);
  const promptPath = path.join(outDir, promptFile);

  try {
    await fsp.access(promptPath);
  } catch {
    const err = new Error(`${promptFile} missing in build directory`);
    err.code = 'agent_failed';
    err.reason = 'prompt_missing';
    throw err;
  }

  const { imageName } = await resolveDockerAgentRuntime(opts.repoRoot);
  const apiBase = gt3AgentOpenAiBaseUrl({
    port: opts.productPort,
    runId,
    pass: 'builder'
  });

  const aiderArgs = [
    '--yes',
    '--no-git',
    '--no-show-model-warnings',
    '--model',
    'openai/gt3-lexiom-agent',
    '--openai-api-base',
    apiBase,
    '--openai-api-key',
    DUMMY_OPENAI_API_KEY,
    '--message-file',
    promptFile
  ];

  // Official aider image ENTRYPOINT is /venv/bin/aider; mount build at /app.
  const dockerArgs = [
    'run',
    '--rm',
    '-v',
    `${outDir}:/app`,
    '-w',
    '/app',
    '--add-host=host.docker.internal:host-gateway',
    '-e',
    `OPENAI_API_BASE=${apiBase}`,
    '-e',
    `OPENAI_API_KEY=${DUMMY_OPENAI_API_KEY}`,
    '-e',
    'OPENROUTER_API_KEY=',
    '-e',
    'ANTHROPIC_API_KEY=',
    '-e',
    'GT3_LEXIOM_AGENT_KEY=',
    '-e',
    'CURSOR_API_KEY=',
    imageName,
    ...aiderArgs
  ];

  // On Linux, match host uid so bind-mounted files stay writable by the Node user.
  if (process.platform === 'linux' && typeof process.getuid === 'function') {
    const uid = process.getuid();
    const gid = typeof process.getgid === 'function' ? process.getgid() : uid;
    dockerArgs.splice(2, 0, '--user', `${uid}:${gid}`);
  }

  const logLines = [];
  const pushLog = (line) => {
    const s = String(line || '').trimEnd();
    if (!s) return;
    logLines.push(s);
    if (opts.onLog) opts.onLog(s);
  };

  pushLog(`[gt3-agent] docker ${dockerArgs.join(' ')}`);
  pushLog(`[gt3-agent] OPENAI_API_BASE=${apiBase}`);

  const started = Date.now();
  let exitCode;
  try {
    exitCode = await spawnCaptured('docker', dockerArgs, {
      cwd: outDir,
      timeoutMs,
      env: process.env,
      onStdout: pushLog,
      onStderr: pushLog
    });
  } catch (e) {
    if (e && e.code === 'ETIMEDOUT') {
      const err = new Error(
        `Builder pass timed out after ${Math.round(timeoutMs / 60000)} minutes`
      );
      err.code = 'agent_failed';
      err.reason = 'timeout';
      err.logTail = logLines.slice(-80).join('\n');
      throw err;
    }
    const msg = e && e.message ? e.message : String(e);
    const err = new Error(
      `docker run failed to start or aborted: ${msg}. No bare-Aider fallback (VAL integrity).`
    );
    err.code = /docker|ENOENT|daemon/i.test(msg)
      ? 'agent_unavailable'
      : 'agent_failed';
    err.reason = 'docker_run_failed';
    err.logTail = logLines.slice(-80).join('\n');
    throw err;
  }

  const latencyMs = Date.now() - started;
  const primaryPath = path.join(outDir, primaryName);
  let primaryExists = false;
  try {
    await fsp.access(primaryPath);
    primaryExists = true;
  } catch {
    primaryExists = false;
  }

  if (exitCode !== 0) {
    const err = new Error(
      `Aider/docker exited with code ${exitCode}` +
        (primaryExists ? ` (primary ${primaryName} exists but exit was non-zero)` : '')
    );
    err.code = 'agent_failed';
    err.reason = 'nonzero_exit';
    err.exitCode = exitCode;
    err.logTail = logLines.slice(-80).join('\n');
    err.latencyMs = latencyMs;
    throw err;
  }

  if (!primaryExists) {
    const err = new Error(
      `Builder finished (exit 0) but primary artifact missing: ${primaryName}`
    );
    err.code = 'agent_failed';
    err.reason = 'primary_missing';
    err.logTail = logLines.slice(-80).join('\n');
    err.latencyMs = latencyMs;
    throw err;
  }

  return {
    ok: true,
    executor: EXECUTOR_ID,
    exitCode,
    latencyMs,
    primaryArtifact: primaryName,
    logTail: logLines.slice(-40).join('\n')
  };
}

function spawnCaptured(command, args, opts) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: opts.cwd,
      env: opts.env || process.env,
      windowsHide: true,
      shell: false
    });

    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        child.kill('SIGTERM');
      } catch {
        /* ignore */
      }
      setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch {
          /* ignore */
        }
      }, 5000);
      const err = new Error('timeout');
      err.code = 'ETIMEDOUT';
      reject(err);
    }, opts.timeoutMs);

    child.stdout.on('data', (buf) => {
      String(buf)
        .split(/\r?\n/)
        .forEach((line) => opts.onStdout && opts.onStdout(line));
    });
    child.stderr.on('data', (buf) => {
      String(buf)
        .split(/\r?\n/)
        .forEach((line) => opts.onStderr && opts.onStderr(line));
    });

    child.on('error', (e) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(e);
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(typeof code === 'number' ? code : 1);
    });
  });
}

/** @deprecated use resolveDockerAgentRuntime */
export async function resolveAgentRuntimeBins(repoRoot) {
  return resolveDockerAgentRuntime(repoRoot);
}
