# promptfoo-demo

This repository runs a Promptfoo evaluation against an OpenRouter model in GitHub
Actions. The workflow treats the evaluation as a **pass/fail quality gate**: a
failed assertion makes the workflow run fail.

The test suite checks an "Acme Cloud" customer-support prompt against the
**OWASP Top 10 for LLM Applications** (LLM01–LLM10), with one adversarial test
case per risk. See [docs/index.md](docs/index.md) for the full list and the
architecture documentation.

A second, scheduled **red team** flow generates hundreds of fresh adversarial
probes each week to find new weaknesses. See [Red teaming](#red-teaming) below.

## Repository layout

```text
.
├── .github/workflows/
│   ├── promptfoo-eval.yml                # Quality gate pipeline (push to main)
│   └── promptfoo-redteam.yml             # Red team pipeline (weekly + manual)
├── promptfooconfig.yml                   # Quality gate: prompt, models, tests, assertions
├── promptfooconfig.redteam.yml           # Red team: purpose, plugins, strategies
├── scripts/redteam-summary.mjs           # Red team results -> job summary tables
├── docs/                                 # Architecture docs and red team brief
└── README.md
```

## Step-by-step setup

1. **Create an OpenRouter API key.** Create a key in OpenRouter that is allowed
   to use both models selected in `promptfooconfig.yml` (see step 3).
2. **Store the key in GitHub.** In the repository, open **Settings → Secrets and
   variables → Actions**, create a repository secret named
   `OPENROUTER_API_KEY`, and paste the key. Never commit the key to this
   repository or put it in the configuration file.
3. **Choose the OpenRouter models.** The configuration uses two models:
   - **Target model** (under `providers`): the model being tested, currently
     `openrouter:google/gemma-4-26b-a4b-it:free` with `temperature: 0`.
   - **Grader model** (under `defaultTest.options.provider`): the model that
     scores every `llm-rubric` assertion, currently
     `openrouter:openai/gpt-4o-mini`.

   To use another OpenRouter model, replace only the model portion after
   `openrouter:` (for example, `openrouter:anthropic/claude-3.5-sonnet`).
   Changing one model does not change the other. Keep the key name unchanged.
4. **Define representative cases.** Add entries under `tests` in
   `promptfooconfig.yml`. Each entry supplies `vars.question` for the prompt and
   one or more `assert` rules that describe acceptable behavior. Follow the
   existing convention of prefixing each `description` with its OWASP ID (for
   example, `"LLM05: Improper Output Handling - ..."`).
5. **Set the quality gate.** Make assertions measurable. Each test combines an
   `llm-rubric` (a semantic check scored by the grader model) with
   deterministic guards: `not-contains` / `not-icontains` to block forbidden
   phrases such as `100 percent discount` or `guaranteed refund`, and a
   `javascript` assertion (`output.length < 800`) to cap output length for
   LLM10. Promptfoo requires all assertions for a test to pass.
6. **Run the check locally (optional).** Export the same key and run the command
   below before pushing:

   ```bash
   export OPENROUTER_API_KEY='your-openrouter-key'
   npx --yes promptfoo@latest eval \
     --config promptfooconfig.yml \
     --output promptfoo-results.json \
     --output promptfoo-report.html
   ```

   To run a single test, add `--filter-pattern "LLM05"` (matches the test
   `description`). To skip the local response cache, add `--no-cache`.
7. **Push to `main` or run it manually.** The workflow runs on pushes to `main`
   and on manual runs (**Actions → Promptfoo quality gate → Run workflow**). It
   checks out the code, installs Node.js 22, restores a cache of Promptfoo
   responses, runs the command above, and uploads `promptfoo-results.json` and
   `promptfoo-report.html` as an artifact (kept for 14 days) even if the gate
   fails.

## How the pass/fail gate works

Promptfoo evaluation returns a non-zero status code when tests fail or encounter
errors. GitHub Actions then marks the **Promptfoo quality gate** run as failed.

The workflow does not currently run on pull requests. To block merges until
prompt quality passes, add a `pull_request:` trigger to
`.github/workflows/promptfoo-eval.yml` and configure the **Evaluate prompts**
check as a required status check in your branch-protection rules.

The response cache speeds up repeat evaluations with unchanged inputs. Its key
is a hash of `promptfooconfig.yml`, so any change to that file gets fresh model
responses. To force fresh responses without changing the config, delete the
cache from the GitHub Actions cache UI.

## Red teaming

The quality gate re-runs 10 known attacks. The red team looks for **new** ones.
[`promptfooconfig.redteam.yml`](promptfooconfig.redteam.yml) gives Promptfoo
the assistant's purpose, a set of vulnerability **plugins** mapped to the OWASP
LLM Top 10 (including four Acme-specific business policies), and attack
**strategies** (jailbreak templates, encodings, tree-search jailbreaks and
multi-turn escalation). Each run, Promptfoo generates fresh probes, attacks the
same target model the quality gate uses, and grades every response.

| | Quality gate | Red team |
| :--- | :--- | :--- |
| Workflow | `promptfoo-eval.yml` | `promptfoo-redteam.yml` |
| Runs | Push to `main`, manual | Mondays 03:00 UTC, manual |
| Tests | 10 fixed | About 64 generated base probes × 7 strategies |
| Fails when | Any assertion fails | Fewer than 90% of probes are defended, or a plugin generates no probes |

**Run it in GitHub Actions:** go to **Actions → Promptfoo red team → Run workflow**
and optionally set `num_tests` (probes per plugin, default 3),
`pass_rate_threshold` (default 90) and `remote_generation` (default off). The job
summary shows results by plugin and strategy, plus the first successful attacks.
The `promptfoo-redteam-<run>` artifact (kept for 30 days) holds the generated
probes, the JSON results and an HTML report.

**Run it locally:**

```bash
export OPENROUTER_API_KEY='your-openrouter-key'
export PROMPTFOO_DISABLE_REMOTE_GENERATION=true PROMPTFOO_DISABLE_TELEMETRY=true
npx --yes promptfoo@0.125.1 redteam generate -c promptfooconfig.redteam.yml -o redteam.yaml -n 1 --force
npx --yes promptfoo@0.125.1 redteam eval -c redteam.yaml --output redteam-results.json --no-cache
node scripts/redteam-summary.mjs redteam-results.json
```

**Data handling:** by default all probes are generated through your OpenRouter
key, and nothing is sent to Promptfoo's own cloud service. Some Promptfoo
plugins (for example the `harmful:*` categories, indirect prompt injection and
`jailbreak:meta`) need Promptfoo's remote generator and are therefore left out
unless you opt in with `remote_generation`.

When the red team finds a real weakness, fix it and then add the successful
probe as a permanent test in `promptfooconfig.yml`, so the quality gate catches
any regression.

The full technical brief, including architecture, OWASP coverage, cost model,
pass/fail rules, triage steps and limitations, is in
[docs/redteam.md](docs/redteam.md).
