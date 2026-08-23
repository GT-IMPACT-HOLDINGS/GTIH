/**
 * In-memory Lexiom 1.3 agent run registry for Ops + status polling (VAL Step 4).
 */
const MAX_RECENT = 40;
/** @type {Map<string, object>} */
const byRunId = new Map();

/**
 * @param {object} entry
 */
export function upsertAgentRun(entry) {
  if (!entry || !entry.run_id) return;
  const prev = byRunId.get(entry.run_id) || {};
  const next = {
    ...prev,
    ...entry,
    updated_at: new Date().toISOString()
  };
  byRunId.delete(entry.run_id);
  byRunId.set(entry.run_id, next);
  while (byRunId.size > MAX_RECENT) {
    const oldest = byRunId.keys().next().value;
    byRunId.delete(oldest);
  }
}

export function getAgentRun(runId) {
  return byRunId.get(runId) || null;
}

/** Newest-first list for /ops/summary.recent_agent_runs */
export function listRecentAgentRuns(limit = 20) {
  const arr = Array.from(byRunId.values());
  arr.sort((a, b) => {
    const ta = Date.parse(a.updated_at || a.started_at || '') || 0;
    const tb = Date.parse(b.updated_at || b.started_at || '') || 0;
    return tb - ta;
  });
  return arr.slice(0, limit);
}
