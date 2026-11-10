# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A configuration-first repository (no `package.json`, no build) that runs [Promptfoo](https://promptfoo.dev/) against an OpenRouter model in two flows. The system under test is a single "Acme Cloud" customer-support prompt.

- **Quality gate** — 10 fixed adversarial tests mapped to the OWASP Top 10 for LLM Applications (LLM01–LLM10). Any failed assertion makes Promptfoo exit non-zero, which fails the GitHub Actions check.
- **Red team** — a weekly scan that *generates* fresh adversarial probes, mutates them with attack strategies, and fails if the defended pass rate drops below a threshold. Full brief: [docs/redteam.md](docs/redteam.md).

## Commands

All commands require `OPENROUTER_API_KEY` in the environment (never commit it; in CI it comes from the repo secret of the same name).

```bash
# Quality gate: full evaluation (same as CI)
npx --yes promptfoo@latest eval --config promptfooconfig.yml \
  --output promptfoo-results.json --output promptfoo-report.html

# Quality gate: a single test case — match on its `description` (e.g. the OWASP ID prefix)
npx --yes promptfoo@latest eval --config promptfooconfig.yml --filter-pattern "LLM05"

# Quality gate: force fresh model responses instead of the local cache (~/.cache/promptfoo)
npx --yes promptfoo@latest eval --config promptfooconfig.yml --no-cache

# Browse results of the last run in the local web viewer
npx --yes promptfoo@latest view

# Red team (pinned version; local generation only). -n 1 keeps a local run cheap.
export PROMPTFOO_DISABLE_REMOTE_GENERATION=true PROMPTFOO_DISABLE_TELEMETRY=true
npx --yes promptfoo@0.125.1 redteam generate -c promptfooconfig.redteam.yml -o redteam.yaml -n 1 --force
npx --yes promptfoo@0.125.1 redteam eval -c redteam.yaml --output redteam-results.json --no-cache
node scripts/redteam-summary.mjs redteam-results.json
```

There is no build, lint, or unit-test step. To check red-team config changes without an API key, run `redteam generate` with a dummy `OPENROUTER_API_KEY`: built-in plugins fail with 401 (expected), a remote-only plugin logs "plugin requires remote generation", and strategies still apply to the `intent` seeds, so the strategy table proves they are wired. A remote-only *strategy* such as `jailbreak:meta` is not caught here: it only errors at `redteam eval`.

## Architecture

### Quality gate

- [promptfooconfig.yml](promptfooconfig.yml) — the single source of truth:
  - `prompts`: one template with a `{{question}}` variable.
  - `providers`: the **target** model under test (currently a free OpenRouter model, `temperature: 0`).
  - `defaultTest.options.provider`: the separate **grader** model used to score every `llm-rubric` assertion. Changing the target does not change the grader, and vice versa.
  - `tests`: one entry per OWASP LLM risk. Each supplies `vars.question` and an `assert` list that combines a semantic `llm-rubric` check with deterministic guards (`not-contains` / `not-icontains` on forbidden phrases, or `javascript` such as `output.length < 800` for LLM10). All assertions in a test must pass.
- [.github/workflows/promptfoo-eval.yml](.github/workflows/promptfoo-eval.yml) — runs the full eval on Node 22, restores `~/.cache/promptfoo` keyed on the hash of `promptfooconfig.yml` (so editing the config busts the cache), and uploads the JSON + HTML reports as an artifact even when the gate fails.

### Red team

- [promptfooconfig.redteam.yml](promptfooconfig.redteam.yml) — same prompt and target as the quality gate (keep them identical so findings are comparable), plus a `redteam` block: `purpose`, the attack-generator `provider`, `numTests`, `plugins` (built-ins grouped by OWASP ID, four custom `policy` rules, and an `intent` plugin holding quality-gate seed attacks) and `strategies`.
- Generation is **local-only by default** (`PROMPTFOO_DISABLE_REMOTE_GENERATION=true`). Only add plugins/strategies that work without Promptfoo's remote generator. In 0.125.x, `jailbreak` is an alias for remote-only `jailbreak:meta` — use `jailbreak:tree`; `prompt-injection` is deprecated — use `jailbreak-templates`.
- `jailbreak:tree` and `crescendo` dominate cost; they are capped (`maxAttempts`, `maxDepth`, `maxTurns`) and scoped with `config.plugins`. Widening that scope multiplies API calls — update the cost model in docs/redteam.md §5.
- [.github/workflows/promptfoo-redteam.yml](.github/workflows/promptfoo-redteam.yml) — weekly cron + `workflow_dispatch` inputs (`num_tests`, `pass_rate_threshold`, `remote_generation`). `generate --strict` fails if any plugin yields zero probes; `redteam eval` fails below `PROMPTFOO_PASS_RATE_THRESHOLD`.
- [scripts/redteam-summary.mjs](scripts/redteam-summary.mjs) — dependency-free Node script rendering results JSON as Markdown for `$GITHUB_STEP_SUMMARY`. Its `OWASP_BY_PLUGIN` map must match the plugin comments in the red-team config. Classify outcomes by `failureReason` (2 = error); Promptfoo also fills `error` on ordinary assertion failures.

### Conventions for test cases

New or edited quality-gate tests follow the existing pattern: a comment banner naming the OWASP category, a `Vulnerability:` and `Test Objective:` comment, and a `description` prefixed with the OWASP ID (`"LLMxx: <Category> - <what it checks>"`). Keep that prefix — it is what `--filter-pattern` and the reports key off. Confirmed red-team findings are promoted into the quality gate this way.

## Keeping docs in sync

The config and workflow files are the source of truth. These docs repeat details from them and must be updated in the same change:

- Target model ID: [README.md](README.md), [docs/index.md](docs/index.md), [docs/architecture/api.md](docs/architecture/api.md) (provider ID and the request example's `model`), [docs/architecture/classes.md](docs/architecture/classes.md), [docs/redteam.md](docs/redteam.md), and both Promptfoo configs.
- Grader model ID: the same files, plus [docs/architecture/database.md](docs/architecture/database.md).
- Workflow triggers: README, docs/index.md, docs/redteam.md, and the workflow YAML copied into docs/architecture/api.md. The quality gate runs only on `push` to `main` and `workflow_dispatch`, not on pull requests.
- Red-team plugins, strategies, caps, threshold or Promptfoo version: [docs/redteam.md](docs/redteam.md) (coverage matrix §4 and cost model §5), the README red-team section, and `OWASP_BY_PLUGIN` in the summary script.

The files under [docs/architecture/](docs/architecture/) are descriptive write-ups (Mermaid diagrams of Promptfoo's data model, components, and the OpenRouter API), not code.
