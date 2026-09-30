# promptfoo-demo

This repository runs a Promptfoo evaluation against an OpenRouter model in GitHub
Actions. The workflow treats the evaluation as a **pass/fail quality gate**: a
failed assertion makes the pull request or push check fail.

## Repository layout

```text
.
├── .github/workflows/promptfoo-eval.yml  # GitHub Actions pipeline
├── promptfooconfig.yml                   # Prompt, model, test, and assertions
└── README.md
```

## Step-by-step setup

1. **Create an OpenRouter API key.** Create a key in OpenRouter that is allowed
   to use the model selected in `promptfooconfig.yml`.
2. **Store the key in GitHub.** In the repository, open **Settings → Secrets and
   variables → Actions**, create a repository secret named
   `OPENROUTER_API_KEY`, and paste the key. Never commit the key to this
   repository or put it in the configuration file.
3. **Choose the OpenRouter model.** The configuration uses
   `openrouter:openai/gpt-4o-mini`. To use another OpenRouter model, replace
   only the model portion after `openrouter:` (for example,
   `openrouter:anthropic/claude-3.5-sonnet`). Keep the key name unchanged.
4. **Define representative cases.** Add entries under `tests` in
   `promptfooconfig.yml`. Each entry supplies `vars` for the prompt and one or
   more `assert` rules that describe acceptable behavior.
5. **Set the quality gate.** Make assertions measurable. This example uses an
   `llm-rubric` to require a safe, helpful cancellation answer and a
   `not-contains` assertion to prevent an unsupported refund promise. Promptfoo
   requires all assertions for the test to pass.
6. **Run the check locally (optional).** Export the same key and run the command
   below before opening a pull request:

   ```bash
   export OPENROUTER_API_KEY='your-openrouter-key'
   npx --yes promptfoo@latest eval \
     --config promptfooconfig.yml \
     --output promptfoo-results.json \
     --fail-on-error
   ```

7. **Push or open a pull request.** The workflow runs for pull requests, pushes
   to `main`, and manual dispatches. It checks out the code, installs Node.js,
   restores a cache of Promptfoo responses, runs the command above, and uploads
   `promptfoo-results.json` as an artifact even if the gate fails.

## How the pass/fail gate works

The `--fail-on-error` option causes the evaluation command to return a non-zero
status when the test has a failing assertion. GitHub Actions then marks the
**Promptfoo quality gate** check as failed. Configure that check as a required
status check in your branch-protection rules to prevent merges until prompt
quality passes.

The response cache speeds up repeat evaluations with unchanged inputs. Delete
the cache from the GitHub Actions cache UI, or change `promptfooconfig.yml`, when
you need to force fresh model responses.
