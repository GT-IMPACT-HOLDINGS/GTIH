/**
 * Legend ↔ code: see ./README.md ("Where the legend becomes code" → this file).
 *
 * I, Hanuman, serve Ram with an append-only tool loop — one loving turn at a time.
 *
 * Ram prescribed the SUD through the OSNG; I do not rewrite that prescription. Instead I ask
 * GT3 (my only sun) what tool to lift next, then wield list/read/write/run/finish until the
 * primary artifact is ready for GT3 to show Ram. Workspace and consult transports are injected
 * so browser, host, or remote sandboxes may carry me — my devotion stays the same.
 */

export const TOOL_NAMES = Object.freeze({
  LIST_FILES: 'list_files',
  READ_FILE: 'read_file',
  WRITE_FILE: 'write_file',
  RUN_COMMAND: 'run_command',
  FINISH: 'finish'
});

/**
 * I lay before the sun only the tools this phase of Ram's build permits —
 * never a secret back door into the sealed OSNG.
 */
export function iOfferTheToolsGt3Allows({ allowCommands = false, allowedTools = null } = {}) {
  const tools = [
    tool(TOOL_NAMES.LIST_FILES, 'List files in the mounted build workspace.', {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative directory; omit for workspace root.' },
        depth: { type: 'integer', minimum: 1, maximum: 6 }
      },
      additionalProperties: false
    }),
    tool(TOOL_NAMES.READ_FILE, 'Read UTF-8 text from a relative workspace file.', {
      type: 'object',
      properties: {
        path: { type: 'string' },
        offset: { type: 'integer', minimum: 0 },
        limit: { type: 'integer', minimum: 1, maximum: 60000 }
      },
      required: ['path'],
      additionalProperties: false
    }),
    tool(TOOL_NAMES.WRITE_FILE, 'Write complete UTF-8 contents to an allowed artifact file.', {
      type: 'object',
      properties: {
        path: { type: 'string' },
        content: { type: 'string' }
      },
      required: ['path', 'content'],
      additionalProperties: false
    })
  ];
  if (allowCommands) {
    tools.push(
      tool(TOOL_NAMES.RUN_COMMAND, 'Run a bounded command in the software workspace.', {
        type: 'object',
        properties: {
          command: { type: 'string' },
          args: { type: 'array', items: { type: 'string' }, maxItems: 32 },
          cwd: { type: 'string' },
          timeout_ms: { type: 'integer', minimum: 100, maximum: 120000 }
        },
        required: ['command'],
        additionalProperties: false
      })
    );
  }
  tools.push(
    tool(TOOL_NAMES.FINISH, 'Finish only after required artifacts are present and ready for validation.', {
      type: 'object',
      properties: { summary: { type: 'string', maxLength: 2000 } },
      additionalProperties: false
    })
  );
  if (!Array.isArray(allowedTools)) return tools;
  const allowed = new Set(allowedTools);
  return tools.filter((entry) => allowed.has(entry.function.name));
}

/** @deprecated dual name — prefer iOfferTheToolsGt3Allows */
export const buildAgentTools = iOfferTheToolsGt3Allows;

/**
 * Here I consult GT3, hear which tools to lift, and labor until Ram's primary is ready.
 * Each crossing is loving obedience: prose alone cannot change the SUD — only tools can.
 * @param {{
 *   system: string,
 *   prompt: string,
 *   primary: string,
 *   isDocument: boolean,
 *   requireOutline?: boolean,
 *   allowCommands?: boolean,
 *   allowedTools?: string[],
 *   allowedWritePaths?: string[],
 *   autoFinishAfterWrite?: boolean,
 *   finalize?: () => Promise<{ ok: boolean, error?: string, detail?: string, [key: string]: any }>,
 *   workspace: object,
 *   model: { complete(messages: object[], tools: object[]): Promise<object> },
 *   signal?: AbortSignal,
 *   log?: (line: string) => void,
 *   budgets?: { maxSteps?: number, maxActions?: number, maxNoProgress?: number, maxToolResultChars?: number, maxWallClockMs?: number }
 * }} opts
 */
export async function iServeRamWithGt3Tools(opts) {
  const log = opts.log || (() => {});
  const budgets = {
    maxSteps: opts.budgets?.maxSteps || (opts.isDocument ? 36 : 48),
    maxActions: opts.budgets?.maxActions || (opts.isDocument ? 120 : 180),
    maxNoProgress: opts.budgets?.maxNoProgress || 3,
    maxToolResultChars: opts.budgets?.maxToolResultChars || 60000,
    maxWallClockMs: opts.budgets?.maxWallClockMs || 19 * 60 * 1000
  };
  const requireOutline =
    opts.requireOutline != null ? !!opts.requireOutline : !!opts.isDocument;
  const allowCommands =
    opts.allowCommands != null ? !!opts.allowCommands : !opts.isDocument;
  const deadline = Date.now() + budgets.maxWallClockMs;
  const tools = iOfferTheToolsGt3Allows({
    allowCommands,
    allowedTools: opts.allowedTools
  });
  const allowedToolNames = new Set(tools.map((entry) => entry.function.name));
  const messages = [
    { role: 'system', content: opts.system },
    { role: 'user', content: opts.prompt }
  ];
  const stats = {
    steps: 0,
    actions: 0,
    reads: 0,
    writes: 0,
    commands: 0,
    files_read: [],
    files_written: [],
    command_results: []
  };
  let noProgress = 0;

  for (let step = 0; step < budgets.maxSteps; step++) {
    iStopIfRamCancelledMe(opts.signal);
    iStopIfMyWallClockEnds(deadline);
    stats.steps = step + 1;
    log(`[ca] tool step ${stats.steps}/${budgets.maxSteps}`);
    const raw = await opts.model.complete(messages, tools);
    const assistant = iHearWhatGt3Replied(raw);
    messages.push(assistant);
    const calls = Array.isArray(assistant.tool_calls) ? assistant.tool_calls : [];
    if (!calls.length) {
      noProgress++;
      if (noProgress >= budgets.maxNoProgress) {
        throw loopError(
          'agent_no_progress',
          'Model repeatedly returned prose without a structured tool call'
        );
      }
      messages.push({
        role: 'user',
        content: 'Continue by calling the provided tools. Prose alone cannot change or finish the build.'
      });
      continue;
    }

    let progressed = false;
    let finished = false;
    for (const call of calls) {
      iStopIfRamCancelledMe(opts.signal);
      iStopIfMyWallClockEnds(deadline);
      stats.actions++;
      if (stats.actions > budgets.maxActions) {
        throw loopError('action_budget_exhausted', 'Containerized Agent tool action budget exhausted');
      }
      const name = call?.function?.name || '';
      if (!allowedToolNames.has(name)) {
        throw loopError(
          'tool_not_allowed',
          `Tool is not available in this phase: ${name || '(missing name)'}`
        );
      }
      let result;
      try {
        const args = iParseToolArgumentsGt3Sent(call?.function?.arguments);
        result = await iWieldOneToolForRam(name, args, { ...opts, requireOutline }, stats);
        if (result.ok && name !== TOOL_NAMES.FINISH) progressed = true;
        if (name === TOOL_NAMES.FINISH && result.ok) finished = true;
      } catch (error) {
        result = {
          ok: false,
          error: error?.reason || error?.code || 'tool_error',
          detail: error?.message || String(error)
        };
      }
      messages.push({
        role: 'tool',
        tool_call_id: call.id || `tool_${stats.actions}`,
        name,
        content: iBoundWhatIReportBackToGt3(result, budgets.maxToolResultChars)
      });
    }

    noProgress = progressed ? 0 : noProgress + 1;
    if (!finished && progressed && opts.autoFinishAfterWrite) {
      const finalized = opts.finalize ? await opts.finalize() : { ok: true };
      if (finalized?.ok) {
        return {
          ok: true,
          messages,
          stats,
          auto_finished: true,
          finalization: finalized
        };
      }
    }
    if (finished) {
      return { ok: true, messages, stats };
    }
    if (noProgress >= budgets.maxNoProgress) {
      throw loopError(
        'agent_no_progress',
        'Containerized Agent made no writable progress across the allowed tool turns'
      );
    }
  }
  throw loopError('step_budget_exhausted', 'Containerized Agent tool step budget exhausted');
}

/** @deprecated dual name — prefer iServeRamWithGt3Tools */
export const runAgentToolLoop = iServeRamWithGt3Tools;

/** One tool-call from the sun: I list, read, write, run, or finish — always for Ram's SUD. */
async function iWieldOneToolForRam(name, args, opts, stats) {
  switch (name) {
    case TOOL_NAMES.LIST_FILES:
      return {
        ok: true,
        files: await opts.workspace.list(args.path || '', args.depth || 3)
      };
    case TOOL_NAMES.READ_FILE: {
      const result = await opts.workspace.read(args.path, {
        offset: args.offset || 0,
        limit: args.limit || 30000
      });
      stats.reads++;
      addUnique(stats.files_read, result.path || args.path);
      return { ok: true, ...result };
    }
    case TOOL_NAMES.WRITE_FILE: {
      if (
        Array.isArray(opts.allowedWritePaths) &&
        !opts.allowedWritePaths.includes(String(args.path || ''))
      ) {
        throw loopError(
          'tool_not_allowed',
          `Write path is not available in this phase: ${args.path || '(missing path)'}`
        );
      }
      const result = await opts.workspace.write(args.path, args.content);
      stats.writes++;
      addUnique(stats.files_written, result.path || args.path);
      return { ok: true, ...result };
    }
    case TOOL_NAMES.RUN_COMMAND: {
      const allowCommands =
        opts.allowCommands != null ? !!opts.allowCommands : !opts.isDocument;
      if (!allowCommands || typeof opts.workspace.run !== 'function') {
        throw loopError('tool_not_allowed', 'run_command is unavailable in this pass');
      }
      const result = await opts.workspace.run(args.command, args.args || [], {
        cwd: args.cwd || '',
        timeoutMs: args.timeout_ms
      });
      stats.commands++;
      stats.command_results.push({
        command: args.command,
        exit_code: result.exit_code,
        timed_out: !!result.timed_out
      });
      return { ok: result.exit_code === 0 && !result.timed_out, ...result };
    }
    case TOOL_NAMES.FINISH: {
      const primaryPresent = await opts.workspace.exists(opts.primary);
      const requireOutline =
        opts.requireOutline != null ? !!opts.requireOutline : !!opts.isDocument;
      const outlinePresent = !requireOutline || (await opts.workspace.exists('OUTLINE.md'));
      if (!primaryPresent || !outlinePresent) {
        return {
          ok: false,
          error: !primaryPresent ? 'primary_missing' : 'outline_missing',
          detail: !primaryPresent
            ? `Required primary is missing: ${opts.primary}`
            : 'OUTLINE.md is required before document completion'
        };
      }
      if (typeof opts.finalize === 'function') {
        const finalized = await opts.finalize({
          primary: opts.primary,
          summary: String(args.summary || '')
        });
        if (!finalized?.ok) {
          return {
            ok: false,
            error: finalized?.error || 'finalize_failed',
            detail: finalized?.detail || 'Workspace finalization failed'
          };
        }
        return {
          ok: true,
          primary: opts.primary,
          summary: String(args.summary || ''),
          ...finalized
        };
      }
      return { ok: true, primary: opts.primary, summary: String(args.summary || '') };
    }
    default:
      throw loopError('tool_unknown', `Unknown tool: ${name || '(missing)'}`);
  }
}

/** I listen carefully to GT3's reply; without a clear message I cannot serve. */
function iHearWhatGt3Replied(raw) {
  const message = raw?.choices?.[0]?.message || raw?.message || raw;
  if (!message || typeof message !== 'object') {
    throw loopError('gt3_response_invalid', 'GT3 returned no assistant message');
  }
  return {
    role: 'assistant',
    content: message.content == null ? null : String(message.content),
    ...(Array.isArray(message.tool_calls) ? { tool_calls: message.tool_calls } : {})
  };
}

/** I unwrap the arguments the sun attached to a tool call. */
function iParseToolArgumentsGt3Sent(value) {
  if (value == null || value === '') return {};
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(String(value));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch {
    throw loopError('tool_arguments_invalid', 'Tool arguments must be a JSON object');
  }
}

/** I keep my report to GT3 bounded — humble, not endless. */
function iBoundWhatIReportBackToGt3(value, maxChars) {
  const text = JSON.stringify(value);
  if (text.length <= maxChars) return text;
  return JSON.stringify({
    ok: value?.ok !== false,
    truncated: true,
    original_chars: text.length,
    content: text.slice(0, maxChars)
  });
}

/** If Ram cancels, I lay down my tools at once — devotion includes stopping. */
function iStopIfRamCancelledMe(signal) {
  if (signal?.aborted) {
    throw loopError('session_cancelled', 'Containerized Agent session cancelled');
  }
}

/** When the wall-clock gift ends, I stop rather than overstay Ram's patience. */
function iStopIfMyWallClockEnds(deadline) {
  if (Date.now() > deadline) {
    throw loopError('wall_clock_exhausted', 'Containerized Agent wall-clock budget exhausted');
  }
}

function tool(name, description, parameters) {
  return { type: 'function', function: { name, description, parameters } };
}

function addUnique(values, value) {
  if (value && !values.includes(value)) values.push(value);
}

function loopError(reason, message) {
  return Object.assign(new Error(message), { code: 'agent_failed', reason });
}

/* Legend ↔ code: return to ./README.md */
