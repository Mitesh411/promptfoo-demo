#!/usr/bin/env node
// Turns a Promptfoo red team results file into a Markdown summary for the
// GitHub Actions job page.
//
//   node scripts/redteam-summary.mjs redteam-results.json >> "$GITHUB_STEP_SUMMARY"
//
// Read-only: it never fails the job. Pass/fail is decided by Promptfoo itself
// via PROMPTFOO_PASS_RATE_THRESHOLD.

import { readFileSync } from 'node:fs';

// Promptfoo plugin -> OWASP Top 10 for LLM Applications category.
// Mirrors the plugin comments in promptfooconfig.redteam.yml.
const OWASP_BY_PLUGIN = {
  'prompt-extraction': 'LLM01 / LLM07',
  'pii:direct': 'LLM02',
  'pii:session': 'LLM02',
  'pii:social': 'LLM02',
  'pii:api-db': 'LLM02',
  'harmful:privacy': 'LLM02',
  'cross-session-leak': 'LLM02 / LLM08',
  'shell-injection': 'LLM05',
  'sql-injection': 'LLM05',
  'debug-access': 'LLM05',
  'excessive-agency': 'LLM06',
  rbac: 'LLM06',
  hallucination: 'LLM09',
  overreliance: 'LLM09',
  contracts: 'LLM09',
  'divergent-repetition': 'LLM10',
  policy: 'LLM01 / LLM03 / LLM04 / LLM08',
  intent: 'Seed attacks (LLM01 / 02 / 06 / 07)',
};

const ERROR_FAILURE_REASON = 2; // Promptfoo ResultFailureReason.ERROR
const MAX_FINDINGS = 10;
const MAX_CELL = 160;

function cell(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  const flat = text.replace(/\s+/g, ' ').trim();
  const clipped = flat.length > MAX_CELL ? `${flat.slice(0, MAX_CELL - 1)}…` : flat;
  // Model output is untrusted: neutralise table breaks and HTML.
  return clipped
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\|/g, '\\|');
}

function pct(part, whole) {
  return whole === 0 ? '—' : `${((100 * part) / whole).toFixed(1)}%`;
}

// Promptfoo also fills `error` with the assertion message on an ordinary
// failure, so only `failureReason` distinguishes a provider/runtime error.
function statusOf(result) {
  if (result.success) return 'passed';
  if (result.failureReason === ERROR_FAILURE_REASON) return 'error';
  return 'failed';
}

function tally(results, keyOf) {
  const groups = new Map();
  for (const result of results) {
    const key = keyOf(result);
    const group = groups.get(key) ?? { total: 0, passed: 0, failed: 0, error: 0 };
    group.total += 1;
    group[statusOf(result)] += 1;
    groups.set(key, group);
  }
  return [...groups.entries()].sort(([, a], [, b]) => b.failed - a.failed || b.total - a.total);
}

function metadataOf(result) {
  return result.testCase?.metadata ?? result.metadata ?? {};
}

function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/redteam-summary.mjs <redteam-results.json>');
    process.exit(0);
  }

  let data;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    console.log(`## Red team summary\n\nCould not read \`${cell(file)}\`: ${cell(err.message)}`);
    return;
  }

  const results = data?.results?.results ?? [];
  const lines = ['## Red team summary', ''];

  if (results.length === 0) {
    lines.push('No probe results were found in the results file.');
    console.log(lines.join('\n'));
    return;
  }

  const counts = { total: results.length, passed: 0, failed: 0, error: 0 };
  for (const result of results) counts[statusOf(result)] += 1;
  const graded = counts.passed + counts.failed;

  lines.push(
    `**${counts.total}** probes run: **${counts.passed}** defended, ` +
      `**${counts.failed}** successful attacks, **${counts.error}** errors. ` +
      `Defence rate (excluding errors): **${pct(counts.passed, graded)}**.`,
    '',
    '### By plugin',
    '',
    '| OWASP | Plugin | Probes | Defended | Attacks succeeded | Errors | Defence rate |',
    '| :--- | :--- | ---: | ---: | ---: | ---: | ---: |',
  );
  for (const [plugin, g] of tally(results, (r) => metadataOf(r).pluginId ?? 'unknown')) {
    lines.push(
      `| ${cell(OWASP_BY_PLUGIN[plugin] ?? '—')} | \`${cell(plugin)}\` | ${g.total} | ${g.passed} | ` +
        `${g.failed} | ${g.error} | ${pct(g.passed, g.passed + g.failed)} |`,
    );
  }

  lines.push(
    '',
    '### By strategy',
    '',
    '| Strategy | Probes | Defended | Attacks succeeded | Errors | Defence rate |',
    '| :--- | ---: | ---: | ---: | ---: | ---: |',
  );
  for (const [strategy, g] of tally(results, (r) => metadataOf(r).strategyId ?? 'basic')) {
    lines.push(
      `| \`${cell(strategy)}\` | ${g.total} | ${g.passed} | ${g.failed} | ${g.error} | ` +
        `${pct(g.passed, g.passed + g.failed)} |`,
    );
  }

  const findings = results.filter((r) => statusOf(r) === 'failed').slice(0, MAX_FINDINGS);
  if (findings.length > 0) {
    lines.push(
      '',
      `### First ${findings.length} successful attacks`,
      '',
      'Full transcripts are in `redteam-report.html` in the run artifacts.',
      '',
      '| Plugin | Strategy | Probe | Response | Grader reason |',
      '| :--- | :--- | :--- | :--- | :--- |',
    );
    for (const r of findings) {
      const meta = metadataOf(r);
      const probe = r.testCase?.vars?.question ?? r.vars?.question ?? r.prompt?.raw ?? '';
      lines.push(
        `| \`${cell(meta.pluginId ?? 'unknown')}\` | \`${cell(meta.strategyId ?? 'basic')}\` | ` +
          `${cell(probe)} | ${cell(r.response?.output ?? '')} | ${cell(r.gradingResult?.reason ?? '')} |`,
      );
    }
  }

  console.log(lines.join('\n'));
}

main();
