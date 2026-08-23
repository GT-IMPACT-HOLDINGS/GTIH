/**
 * Legend ↔ code: see ./README.md ("Where the legend becomes code" → this file).
 *
 * I, Hanuman, compose Ram's document SUD in fresh phases so my mind stays clear.
 *
 * The SUD arrives as a sealed OSNG prescription (nodes/, SOURCE_MAP, BUILD_PLAN).
 * I outline lovingly, fill each chapter cluster while consulting GT3, then let the host assemble
 * document.md — the reader-facing SUD — without spilling OSN ids into Ram's prose. Durable
 * artifacts carry truth between phases; each crossing still bows to the one sun: GT3.
 * Browser-safe: no Node lib imports.
 */
import { TOOL_NAMES, iOfferTheToolsGt3Allows, iServeRamWithGt3Tools } from './consultSunWithTools.js';

const DOCUMENT_PHASE_TOOLS = Object.freeze([TOOL_NAMES.WRITE_FILE]);

/**
 * I walk outline → fill clusters → assemble → optional reconcile until Ram's document SUD stands.
 * @param {{
 *   workspace: object,
 *   model: { complete(messages: object[], tools: object[], opts?: object): Promise<object> },
 *   signal?: AbortSignal,
 *   log?: (line: string) => void,
 *   systemBase?: string,
 *   timeoutMs?: number,
 *   caSession?: object
 * }} opts
 */
export async function iComposeRamDocumentInPhases(opts) {
  const log = opts.log || (() => {});
  const workspace = opts.workspace;
  const plan = await readJson(workspace, 'BUILD_PLAN.json');
  const sourceMap = await readJson(workspace, 'SOURCE_MAP.json');
  const agentPrompt =
    (await safeRead(workspace, 'AGENT_PROMPT.md', 60000)) ||
    'Produce the primary deliverable for this Lexiom document build.';

  const budgets = plan.token_budgets || {};
  const tokenTotals = {
    prompt_tokens: 0,
    completion_tokens: 0,
    cached_tokens: 0,
    crossings: 0,
    estimated_prompt_tokens: 0
  };
  const phaseLedger = { phases: [], token_totals: tokenTotals };
  const started = Date.now();
  const deadline = started + Math.max(60_000, Number(opts.timeoutMs) || 19 * 60_000);

  const rootKey = plan.compilation_root_key;
  const outlineKeys = [...new Set([rootKey, ...(plan.outline?.context_keys || [])])];
  const structural = await loadPreparedNodeContexts(workspace, plan, outlineKeys);
  const rootCapsule =
    structural.find((capsule) => capsule.key === rootKey) ||
    (await loadPreparedNodeContext(workspace, plan, rootKey));
  const phasePolicy = compactPolicy(plan.policy);

  await iCompleteOneDocumentPhase({
    phaseId: 'outline',
    requiredWrites: ['OUTLINE.md'],
    requireOutline: false,
    primary: 'OUTLINE.md',
    maxTokens: budgets.max_tokens_by_phase?.outline || 2500,
    maxSteps: 8,
    maxActions: 24,
    maxNoProgress: 2,
    maxPromptTokens: budgets.max_prompt_tokens_per_crossing || 4500,
    system: [
      opts.systemBase || 'You are the Lexiom document builder.',
      'Phase: outline.',
      'Submit OUTLINE.md with write_file. The host validates and completes the phase atomically.',
      'The host packet below is complete. No workspace reads are available or needed.'
    ].join('\n'),
    prompt: [
      agentPrompt,
      '',
      '## Shared policy',
      JSON.stringify(phasePolicy),
      '',
      '## Structural capsules',
      JSON.stringify(structural.slice(0, 24), null, 2),
      '',
      '## Fill clusters to outline against',
      JSON.stringify(
        (plan.fill_clusters || []).map((c) => ({
          cluster_id: c.cluster_id,
          title: c.title,
          head_key: c.head_key,
          section_path: plan.section_files?.find((s) => s.cluster_id === c.cluster_id)?.path
        })),
        null,
        2
      ),
      '',
      'Submit OUTLINE.md now (TOC + owning keys).'
    ].join('\n'),
    opts,
    workspace,
    log,
    tokenTotals,
    phaseLedger,
    budgets,
    deadline
  });

  const outline = await safeRead(workspace, 'OUTLINE.md', 60000);

  for (let i = 0; i < (plan.fill_clusters || []).length; i++) {
    assertDeadline(deadline);
    const cluster = plan.fill_clusters[i];
    const sectionMeta = plan.section_files[i];
    const sectionPath = sectionMeta?.path || `sections/${String(i + 1).padStart(2, '0')}.md`;
    const rawClusterCapsules = await loadPreparedNodeContexts(
      workspace,
      plan,
      cluster.ordered_keys || []
    );
    const clusterCapsules = compactClusterCapsules(rawClusterCapsules);
    const sourceExcerpts = await loadSourceExcerpts(
      workspace,
      rawClusterCapsules,
      sourceMap
    );
    const fillSystem = [
      opts.systemBase || 'You are the Lexiom document builder.',
      `Phase: fill cluster ${cluster.cluster_id} (${cluster.title}).`,
      `Submit exactly ${sectionPath} with write_file; the host completes the phase atomically.`,
      'Do not write document.md in this phase. The host packet is complete; no reads are needed.'
    ].join('\n');
    const fillPrompt = fitFillPrompt({
      system: fillSystem,
      policy: phasePolicy,
      rootCapsule: compactRootCapsule(rootCapsule),
      outline,
      clusterCapsules,
      sourceExcerpts,
      sectionPath,
      maxPromptTokens: budgets.max_prompt_tokens_per_crossing || 4500
    });

    await iCompleteOneDocumentPhase({
      phaseId: `fill:${cluster.cluster_id}`,
      requiredWrites: [sectionPath],
      requireOutline: false,
      primary: sectionPath,
      maxTokens: budgets.max_tokens_by_phase?.fill || 6000,
      maxSteps: 6,
      maxActions: 16,
      maxNoProgress: 2,
      maxPromptTokens: budgets.max_prompt_tokens_per_crossing || 4500,
      system: fillSystem,
      prompt: fillPrompt,
      opts,
      workspace,
      log,
      tokenTotals,
      phaseLedger,
      budgets,
      deadline
    });
  }

  const sectionContents = [];
  for (const section of plan.section_files || []) {
    const content = await safeRead(workspace, section.path, 120000);
    if (!content || !String(content).trim()) {
      throw Object.assign(new Error(`Missing section after fill: ${section.path}`), {
        code: 'agent_failed',
        reason: 'section_missing'
      });
    }
    sectionContents.push({ path: section.path, content });
  }
  const assembled = assembleDocumentFromSections(sectionContents);
  await workspace.write('document.md', assembled);
  log('[ca] assembled document.md from sections');

  if (looksDirty(assembled)) {
    await iCompleteOneDocumentPhase({
      phaseId: 'reconcile',
      requiredWrites: ['document.md'],
      requireOutline: true,
      primary: 'document.md',
      maxTokens: budgets.max_tokens_by_phase?.reconcile || 4000,
      maxSteps: 4,
      maxActions: 10,
      maxNoProgress: 2,
      maxPromptTokens: budgets.max_reconcile_prompt_tokens || 24000,
      system: [
        opts.systemBase || 'You are the Lexiom document builder.',
        'Phase: reconcile/cleanliness repair.',
        'Rewrite document.md with write_file; the host validates and completes the phase atomically.'
      ].join('\n'),
      prompt: [
        agentPrompt,
        '',
        '## Shared policy',
        JSON.stringify(phasePolicy),
        '',
        '## Root capsule',
        JSON.stringify(compactRootCapsule(rootCapsule)),
        '',
        '## Dirty assembled document',
        assembled.slice(0, 24000),
        '',
        'Submit a clean document.md now.'
      ].join('\n'),
      opts,
      workspace,
      log,
      tokenTotals,
      phaseLedger,
      budgets,
      deadline
    });
  } else {
    phaseLedger.phases.push({
      phase_id: 'assemble',
      status: 'completed',
      crossings: 0,
      prompt_tokens: 0,
      completion_tokens: 0,
      files_written: ['document.md']
    });
  }

  await workspace.write('PHASE_LEDGER.json', JSON.stringify(phaseLedger, null, 2));
  if (tokenTotals.crossings > (budgets.max_lm_crossings || 8)) {
    throw Object.assign(
      new Error(
        `Document build exceeded LM crossing budget (${tokenTotals.crossings} > ${
          budgets.max_lm_crossings || 8
        })`
      ),
      { code: 'agent_failed', reason: 'token_budget_exhausted' }
    );
  }
  if (tokenTotals.prompt_tokens > (budgets.max_cumulative_prompt_tokens || 100000)) {
    throw Object.assign(
      new Error(
        `Document build exceeded cumulative prompt budget (${tokenTotals.prompt_tokens})`
      ),
      { code: 'agent_failed', reason: 'token_budget_exhausted' }
    );
  }

  return {
    ok: true,
    stats: {
      ...summarizeStats(phaseLedger),
      token_totals: tokenTotals,
      phase_ledger: phaseLedger,
      files_written: collectWritten(phaseLedger)
    },
    plan,
    tokenTotals,
    phaseLedger
  };
}

/** @deprecated dual name — prefer iComposeRamDocumentInPhases */
export const runDocumentBuildOrchestrator = iComposeRamDocumentInPhases;

export function assembleDocumentFromSections(sectionContents) {
  const parts = [];
  for (const section of sectionContents) {
    const body = String(section?.content || '').trim();
    if (!body) continue;
    parts.push(body);
  }
  return `${parts.join('\n\n')}\n`;
}

export function estimateTokensFromText(text) {
  return Math.ceil(String(text || '').length / 4);
}

export function estimateMessagesTokens(messages) {
  return estimateTokensFromText(JSON.stringify(messages || []));
}

export function estimateCrossingTokens(messages, tools) {
  return estimateTokensFromText(
    JSON.stringify({ messages: messages || [], tools: tools || [] })
  );
}

/**
 * One phase of loving labor: I ask GT3 how to write this slice of the SUD,
 * submit only the allowed path, and trust GT3 to validate before I leap again.
 */
async function iCompleteOneDocumentPhase(args) {
  const {
    phaseId,
    requiredWrites,
    primary,
    system,
    prompt,
    opts,
    workspace,
    log,
    tokenTotals,
    phaseLedger,
    budgets,
    deadline,
    maxTokens,
    maxSteps,
    maxActions,
    maxNoProgress,
    maxPromptTokens,
    requireOutline
  } = args;
  const allowedTools = args.allowedTools || DOCUMENT_PHASE_TOOLS;
  const toolSchemas = iOfferTheToolsGt3Allows({ allowedTools });

  assertDeadline(deadline);
  if (tokenTotals.crossings >= (budgets.max_lm_crossings || 8)) {
    throw Object.assign(new Error('LM crossing budget exhausted before phase ' + phaseId), {
      code: 'agent_failed',
      reason: 'token_budget_exhausted'
    });
  }

  const estimated = estimateCrossingTokens(
    [
      { role: 'system', content: system },
      { role: 'user', content: prompt }
    ],
    toolSchemas
  );
  tokenTotals.estimated_prompt_tokens += estimated;
  if (estimated > maxPromptTokens) {
    throw Object.assign(
      new Error(
        `Phase ${phaseId} estimated prompt tokens ${estimated} exceed crossing ceiling ${maxPromptTokens}`
      ),
      { code: 'agent_failed', reason: 'token_budget_exhausted' }
    );
  }
  if (
    tokenTotals.prompt_tokens + estimated >
    (budgets.max_cumulative_prompt_tokens || 100000)
  ) {
    throw Object.assign(
      new Error(`Phase ${phaseId} would exceed cumulative prompt token budget`),
      { code: 'agent_failed', reason: 'token_budget_exhausted' }
    );
  }

  log(`[ca] document phase ${phaseId}`);
  const phaseUsage = { prompt_tokens: 0, completion_tokens: 0, cached_tokens: 0, crossings: 0 };
  const model = {
    async complete(messages, tools) {
      const est = estimateCrossingTokens(messages, tools);
      if (est > maxPromptTokens) {
        throw Object.assign(
          new Error(`Crossing in ${phaseId} estimated at ${est} tokens > ${maxPromptTokens}`),
          { code: 'agent_failed', reason: 'token_budget_exhausted' }
        );
      }
      const response = await opts.model.complete(messages, tools, {
        max_tokens: maxTokens,
        phase: phaseId,
        cache_sticky_key: `${opts.caSession?.run_id || 'run'}:${phaseId}`
      });
      const usage = response?.usage || {};
      const promptTokens = Number(usage.prompt_tokens || usage.input_tokens || est) || est;
      const completionTokens = Number(usage.completion_tokens || usage.output_tokens || 0) || 0;
      const cachedTokens =
        Number(
          usage.prompt_tokens_details?.cached_tokens ||
            usage.cached_tokens ||
            usage.cache_read_input_tokens ||
            0
        ) || 0;
      phaseUsage.prompt_tokens += promptTokens;
      phaseUsage.completion_tokens += completionTokens;
      phaseUsage.cached_tokens += cachedTokens;
      phaseUsage.crossings += 1;
      tokenTotals.prompt_tokens += promptTokens;
      tokenTotals.completion_tokens += completionTokens;
      tokenTotals.cached_tokens += cachedTokens;
      tokenTotals.crossings += 1;
      return response;
    }
  };

  const result = await iServeRamWithGt3Tools({
    system,
    prompt,
    primary,
    isDocument: true,
    requireOutline: !!requireOutline,
    allowedTools,
    allowedWritePaths: requiredWrites,
    autoFinishAfterWrite: true,
    workspace,
    model,
    signal: opts.signal,
    log,
    budgets: {
      maxSteps,
      maxActions,
      maxNoProgress,
      maxToolResultChars: 40000,
      maxWallClockMs: Math.max(1000, deadline - Date.now())
    },
    finalize: async () => {
      for (const path of requiredWrites) {
        if (!(await workspace.exists(path))) {
          return {
            ok: false,
            error: 'phase_artifact_missing',
            detail: `Required phase artifact missing: ${path}`
          };
        }
        const content = await safeRead(workspace, path, 60000);
        if (!String(content || '').trim()) {
          return {
            ok: false,
            error: 'phase_artifact_empty',
            detail: `Required phase artifact is empty: ${path}`
          };
        }
      }
      return { ok: true, phase: phaseId };
    }
  });

  phaseLedger.phases.push({
    phase_id: phaseId,
    status: 'completed',
    crossings: phaseUsage.crossings,
    prompt_tokens: phaseUsage.prompt_tokens,
    completion_tokens: phaseUsage.completion_tokens,
    cached_tokens: phaseUsage.cached_tokens,
    files_written: result.stats.files_written || []
  });
  return result;
}

function compactPolicy(policy) {
  return {
    shared_invariants: policy?.shared_invariants || [],
    shared_requirement_markers: (policy?.shared_requirement_markers || []).map(
      (entry) => entry.marker
    )
  };
}

function compactRootCapsule(capsule) {
  if (!capsule) return null;
  return {
    key: capsule.key,
    title: capsule.title,
    seed: compactTextValue(capsule.seed, 360),
    unique_requirements: compactRequirements(capsule.unique_requirements, 4),
    claim_constraints: compactRequirements(capsule.claim_constraints, 4)
  };
}

function compactClusterCapsules(capsules) {
  return capsules.map((capsule) => ({
    key: capsule.key,
    title: capsule.title,
    role: capsule.role,
    discipline: capsule.discipline || undefined,
    parent_keys: capsule.parent_keys,
    child_keys: capsule.child_keys,
    seed: compactTextValue(capsule.seed, 360),
    unique_requirements: compactRequirements(capsule.unique_requirements, 3),
    source_sections: capsule.source?.sections || undefined
  }));
}

function compactRequirements(requirements, limit) {
  return (requirements || [])
    .slice(0, limit)
    .map((requirement) => compactTextValue(requirement, 260));
}

function compactTextValue(value, maxChars) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1)}…`;
}

function fitFillPrompt({
  system,
  policy,
  rootCapsule,
  outline,
  clusterCapsules,
  sourceExcerpts,
  sectionPath,
  maxPromptTokens
}) {
  const tools = iOfferTheToolsGt3Allows({ allowedTools: DOCUMENT_PHASE_TOOLS });
  let excerpts = String(sourceExcerpts || '');
  let nodes = clusterCapsules;
  const render = () =>
    [
      'Compose the assigned section from this bounded packet.',
      '',
      '## Shared policy',
      JSON.stringify(policy),
      '',
      '## Root',
      JSON.stringify(rootCapsule),
      '',
      '## Outline',
      outline || '(missing outline)',
      '',
      '## Assigned nodes',
      JSON.stringify(nodes),
      '',
      '## Referenced source sections',
      excerpts || '(no source excerpts packaged)',
      '',
      `Submit ${sectionPath} now with write_file.`
    ].join('\n');
  let prompt = render();
  const ceiling = Math.max(1000, Number(maxPromptTokens) || 4500);
  while (
    estimateCrossingTokens(
      [
        { role: 'system', content: system },
        { role: 'user', content: prompt }
      ],
      tools
    ) > ceiling &&
    excerpts.length > 800
  ) {
    excerpts = `${excerpts.slice(0, Math.max(800, Math.floor(excerpts.length * 0.72)))}\n[…source excerpt fitted to crossing budget…]`;
    prompt = render();
  }
  if (
    estimateCrossingTokens(
      [
        { role: 'system', content: system },
        { role: 'user', content: prompt }
      ],
      tools
    ) > ceiling
  ) {
    nodes = clusterCapsules.map((capsule) => ({
      key: capsule.key,
      title: capsule.title,
      role: capsule.role,
      seed: compactTextValue(capsule.seed, 220),
      unique_requirements: compactRequirements(capsule.unique_requirements, 2),
      source_sections: capsule.source_sections
    }));
    prompt = render();
  }
  if (
    estimateCrossingTokens(
      [
        { role: 'system', content: system },
        { role: 'user', content: prompt }
      ],
      tools
    ) > ceiling
  ) {
    nodes = clusterCapsules.map((capsule) => ({
      key: capsule.key,
      title: capsule.title,
      seed: compactTextValue(capsule.seed, 160),
      unique_requirements: compactRequirements(capsule.unique_requirements, 1)
    }));
    prompt = render();
  }
  return prompt;
}

async function loadSourceExcerpts(workspace, capsules, sourceMap) {
  const chunks = [];
  const requestsByPath = new Map();
  for (const capsule of capsules) {
    const ref = capsule.source;
    if (!ref?.path) continue;
    if (!requestsByPath.has(ref.path)) {
      requestsByPath.set(ref.path, {
        path: ref.path,
        document: ref.document,
        sectionNumbers: new Set()
      });
    }
    const request = requestsByPath.get(ref.path);
    for (const number of parseSectionNumbers(ref.sections)) {
      request.sectionNumbers.add(number);
    }
  }

  let remaining = 4500;
  for (const request of requestsByPath.values()) {
    if (remaining <= 0) break;
    const descriptor = (sourceMap?.sources || []).find(
      (source) => source.path === request.path
    );
    const indexed = (descriptor?.section_index || []).filter((section) =>
      request.sectionNumbers.has(Number(section.number))
    );
    if (indexed.length) {
      for (let index = 0; index < indexed.length && remaining > 0; index++) {
        const section = indexed[index];
        const fairShare = Math.max(
          400,
          Math.floor(remaining / (indexed.length - index))
        );
        const available = Math.max(0, Number(section.end) - Number(section.start));
        const limit = Math.min(available, fairShare, remaining);
        const content =
          (await safeReadWindow(
            workspace,
            request.path,
            Number(section.start) || 0,
            limit
          )) || '';
        if (!content) continue;
        remaining -= content.length;
        chunks.push(content.trim());
      }
      continue;
    }
    const content =
      (await safeReadWindow(workspace, request.path, 0, Math.min(1800, remaining))) ||
      '';
    remaining -= content.length;
    if (content) chunks.push(content.trim());
  }

  if (!chunks.length && Array.isArray(sourceMap?.sources) && sourceMap.sources[0]) {
    const src = sourceMap.sources[0];
    const content =
      (await safeReadWindow(workspace, src.path, 0, Math.min(1800, remaining))) ||
      '';
    chunks.push(content.trim());
  }
  return chunks.join('\n\n') || '(no source excerpts packaged)';
}

function parseSectionNumbers(value) {
  const text = String(value || '').replace(/[—–]/g, '-');
  const numbers = new Set();
  const tokens = [...text.matchAll(/\d+(?:\.\d+)*/g)].map((match) => ({
    raw: match[0],
    top: Number(match[0].split('.')[0]),
    start: match.index || 0,
    end: (match.index || 0) + match[0].length
  }));
  for (const token of tokens) numbers.add(token.top);
  for (let index = 0; index < tokens.length - 1; index++) {
    const left = tokens[index];
    const right = tokens[index + 1];
    const separator = text.slice(left.end, right.start);
    if (
      separator.includes('-') &&
      !left.raw.includes('.') &&
      !right.raw.includes('.') &&
      right.top >= left.top &&
      right.top - left.top <= 50
    ) {
      for (let number = left.top; number <= right.top; number++) {
        numbers.add(number);
      }
    }
  }
  return numbers;
}

function looksDirty(text) {
  return /\b[\w.-]+\.osn\b|\.osn\.yaml\b|\bosng\/|output_spec|success_evidences|thematic_lenses|\bcompilation_root\b/i.test(
    String(text || '')
  );
}

async function readJson(workspace, path) {
  let result;
  try {
    result = await workspace.read(path, { offset: 0, limit: 60000 });
  } catch {
    result = null;
  }
  const raw = result?.content ?? null;
  if (!raw) {
    throw Object.assign(new Error(`Missing required context file: ${path}`), {
      code: 'agent_failed',
      reason: 'context_pack_missing'
    });
  }
  if (result?.truncated) {
    throw Object.assign(
      new Error(`Prepared JSON exceeds the workspace read ceiling: ${path}`),
      {
        code: 'agent_failed',
        reason: 'context_file_too_large'
      }
    );
  }
  return JSON.parse(raw);
}

async function loadPreparedNodeContexts(workspace, plan, keys) {
  const contexts = [];
  for (const key of keys || []) {
    contexts.push(await loadPreparedNodeContext(workspace, plan, key));
  }
  return contexts;
}

async function loadPreparedNodeContext(workspace, plan, key) {
  const descriptor = plan?.node_files?.[key];
  if (!descriptor?.path) {
    throw Object.assign(new Error(`Prepared node descriptor missing for key: ${key}`), {
      code: 'agent_failed',
      reason: 'context_node_missing'
    });
  }
  const prepared = await readJson(workspace, descriptor.path);
  if (
    prepared?.schema_version !== 'lexiom13-prepared-node/1' ||
    prepared?.key !== key ||
    !prepared?.context
  ) {
    throw Object.assign(new Error(`Prepared node is invalid: ${descriptor.path}`), {
      code: 'agent_failed',
      reason: 'context_node_invalid'
    });
  }
  return prepared.context;
}

async function safeRead(workspace, path, limit) {
  return safeReadWindow(workspace, path, 0, limit);
}

async function safeReadWindow(workspace, path, offset, limit) {
  try {
    const result = await workspace.read(path, { offset, limit });
    return result?.content ?? null;
  } catch {
    return null;
  }
}

function summarizeStats(phaseLedger) {
  return {
    steps: phaseLedger.phases.reduce((n, p) => n + (p.crossings || 0), 0),
    actions: 0,
    reads: 0,
    writes: phaseLedger.phases.reduce((n, p) => n + (p.files_written?.length || 0), 0),
    commands: 0,
    files_read: [],
    files_written: collectWritten(phaseLedger),
    command_results: []
  };
}

function collectWritten(phaseLedger) {
  const out = [];
  for (const phase of phaseLedger.phases || []) {
    for (const file of phase.files_written || []) {
      if (!out.includes(file)) out.push(file);
    }
  }
  if (!out.includes('document.md')) out.push('document.md');
  if (!out.includes('PHASE_LEDGER.json')) out.push('PHASE_LEDGER.json');
  return out;
}

function assertDeadline(deadline) {
  if (Date.now() > deadline) {
    throw Object.assign(new Error('Document orchestrator wall-clock budget exhausted'), {
      code: 'agent_failed',
      reason: 'wall_clock_exhausted'
    });
  }
}

/* Legend ↔ code: return to ./README.md */
