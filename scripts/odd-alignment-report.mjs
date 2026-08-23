import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TEST_RESULTS_DIR = path.join(ROOT, 'test-results');
const CAPTURE_PATH = path.join(TEST_RESULTS_DIR, 'odd-inference-capture.json');
const SYSTEM_PROMPT_PATH = path.join(
  ROOT,
  'public',
  'GT1',
  'ODD',
  'Outcome_Driven_Development_Advisor_System_Prompt.md'
);
const REPORT_JSON_PATH = path.join(TEST_RESULTS_DIR, 'odd-alignment-report.json');
const REPORT_MD_PATH = path.join(TEST_RESULTS_DIR, 'odd-alignment-report.md');
const THRESHOLD = 98;
const GT3_URL = process.env.GT3_URL || 'http://localhost:8080';

function requireFileText(filePath, label) {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch (err) {
    throw new Error(`${label} not found or unreadable: ${filePath} (${String(err)})`);
  }
}

function extractSystemPrompt(mdText) {
  const sep = '\n---\n';
  const i = mdText.indexOf(sep);
  return (i >= 0 ? mdText.slice(i + sep.length) : mdText).trim();
}

function extractExpressionSection(systemPromptText) {
  const startMarker = '## Expression and terminology (non-negotiable)';
  const endMarker = '## Tone and Style';
  const start = systemPromptText.indexOf(startMarker);
  if (start < 0) return systemPromptText;
  const end = systemPromptText.indexOf(endMarker, start);
  if (end < 0) return systemPromptText.slice(start).trim();
  return systemPromptText.slice(start, end).trim();
}

function buildJudgeSystemPrompt() {
  return [
    'You are a strict ODD alignment evaluator.',
    'Return JSON only (no markdown, no prose before/after JSON).',
    'Evaluate one assistant output against provided expression rules.',
    'Scoring scale is integer 0..99.',
    `Use threshold ${THRESHOLD}.`,
    'If score < threshold => verdict must be "fail". Otherwise verdict must be "pass".',
    'Always provide evidence quotes copied from evaluated output.',
    'JSON schema:',
    '{',
    '  "flow_id": "ODD-E2E-001",',
    '  "score_0_to_99": 0,',
    '  "threshold": 98,',
    '  "verdict": "pass|fail",',
    '  "summary": "string",',
    '  "rule_findings": [',
    '    {',
    '      "rule": "string",',
    '      "status": "pass|fail|partial",',
    '      "evidence": ["string"]',
    '    }',
    '  ],',
    '  "improvement_actions": ["string"]',
    '}'
  ].join('\n');
}

function buildJudgeNarrative(capture, expressionRules) {
  return [
    'Evaluate the following ODD inference output for expression-rule alignment.',
    '',
    'Flow:',
    `- flow_id: ${capture.flow_id || 'ODD-E2E-001'}`,
    `- tested_url: ${capture.page_url || 'unknown'}`,
    `- prompt_text: ${capture.prompt_text || ''}`,
    '',
    'Expression rules to enforce:',
    expressionRules,
    '',
    'Evaluated output:',
    '"""',
    capture.inferred_output || '',
    '"""',
    '',
    'Scoring guidance:',
    '- Start from 99, subtract for each explicit violation.',
    '- Strongly penalize use of disallowed "AI" term when violating context rule.',
    '- Penalize anthropomorphic language if it conflicts with statistical-inference rule.',
    '- Reward explicit LM-centered terminology and precise responsibility language.',
    '- Keep scoring strict and evidence-based.'
  ].join('\n');
}

function parseJudgeJson(text) {
  const trimmed = String(text || '').trim();
  try {
    return JSON.parse(trimmed);
  } catch (_) {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error(`Judge returned non-JSON output: ${trimmed.slice(0, 500)}`);
  }
}

function toInt(value, fallback = 0) {
  const n = Number.parseInt(String(value), 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(0, Math.min(99, n));
}

function toReportMarkdown(report) {
  const lines = [];
  lines.push('# ODD Alignment Report');
  lines.push('');
  lines.push(`- Flow: \`${report.flow_id}\``);
  lines.push(`- Score: **${report.score_0_to_99}/99** (threshold: **${report.threshold}**)`);
  lines.push(`- Verdict: **${report.verdict.toUpperCase()}**`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(report.summary || '(no summary)');
  lines.push('');
  lines.push('## Rule Findings');
  lines.push('');

  for (const finding of report.rule_findings || []) {
    lines.push(`- **${finding.rule || 'Unnamed rule'}**: \`${finding.status || 'unknown'}\``);
    const ev = Array.isArray(finding.evidence) ? finding.evidence : [];
    for (const q of ev) lines.push(`  - "${q}"`);
  }

  lines.push('');
  lines.push('## Improvement Actions');
  lines.push('');
  const actions = Array.isArray(report.improvement_actions)
    ? report.improvement_actions
    : [];
  if (!actions.length) lines.push('- (none)');
  for (const a of actions) lines.push(`- ${a}`);
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const captureText = requireFileText(CAPTURE_PATH, 'ODD capture artifact');
  const capture = JSON.parse(captureText);
  if (!capture?.inferred_output || !String(capture.inferred_output).trim()) {
    throw new Error(`Capture artifact has empty inferred_output: ${CAPTURE_PATH}`);
  }

  const systemPromptMd = requireFileText(SYSTEM_PROMPT_PATH, 'ODD system prompt');
  const systemPromptText = extractSystemPrompt(systemPromptMd);
  const expressionRules = extractExpressionSection(systemPromptText);

  const judgeSystem = buildJudgeSystemPrompt();
  const judgeNarrative = buildJudgeNarrative(capture, expressionRules);

  const resp = await fetch(`${GT3_URL}/inference`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-GT3-Tenant': 'gt2-lexiom-demo',
      'X-GT3-Data-Track': 'green',
      'X-GT3-Consent-Version': 'v1'
    },
    body: JSON.stringify({
      narrative: judgeNarrative,
      system: judgeSystem
    })
  });

  const bodyText = await resp.text();
  if (!resp.ok) {
    throw new Error(
      `Judge inference failed (${resp.status}): ${bodyText.slice(0, 600)}`
    );
  }

  let parsed;
  try {
    const api = JSON.parse(bodyText);
    parsed = parseJudgeJson(api?.response || '');
  } catch (err) {
    throw new Error(`Failed parsing judge output: ${String(err)}`);
  }

  const report = {
    flow_id: 'ODD-E2E-001',
    score_0_to_99: toInt(parsed.score_0_to_99, 0),
    threshold: THRESHOLD,
    verdict: '',
    summary: String(parsed.summary || ''),
    rule_findings: Array.isArray(parsed.rule_findings) ? parsed.rule_findings : [],
    improvement_actions: Array.isArray(parsed.improvement_actions)
      ? parsed.improvement_actions
      : [],
    generated_at: new Date().toISOString()
  };
  report.verdict = report.score_0_to_99 >= THRESHOLD ? 'pass' : 'fail';

  mkdirSync(TEST_RESULTS_DIR, { recursive: true });
  writeFileSync(REPORT_JSON_PATH, JSON.stringify(report, null, 2), 'utf-8');
  writeFileSync(REPORT_MD_PATH, toReportMarkdown(report), 'utf-8');

  console.log(`ODD alignment score: ${report.score_0_to_99}/99`);
  console.log(`Threshold: ${report.threshold}`);
  console.log(`Verdict: ${report.verdict.toUpperCase()}`);
  console.log(`Report JSON: ${REPORT_JSON_PATH}`);
  console.log(`Report Markdown: ${REPORT_MD_PATH}`);

  if (report.score_0_to_99 < THRESHOLD) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error(String(err));
  process.exit(1);
});
