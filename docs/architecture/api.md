# Promptfoo REST API & CI/CD Integration Interface

This document details the API provider integration interfaces, CLI evaluation commands, and GitHub Actions workflow specifications for the quality gate.

---

## 1. Provider API Interface (OpenRouter Integration)

Promptfoo connects to OpenRouter models via HTTP POST requests using standardized OpenAI-compatible REST API formats.

### Target Model Provider
- **Provider ID**: `openrouter:google/gemma-4-26b-a4b-it:free`
- **Config**: `temperature: 0`
- **Base Endpoint**: `https://openrouter.ai/api/v1/chat/completions`
- **Authentication**: Bearer token supplied via `OPENROUTER_API_KEY` environment variable.

### Grader Model Provider
- **Provider ID**: `openrouter:openai/gpt-4o-mini` (set in `defaultTest.options.provider`)
- **Role**: Scores every `llm-rubric` assertion. It uses the same endpoint and API key as the target model.

#### Request Format Example
```json
POST /api/v1/chat/completions HTTP/1.1
Host: openrouter.ai
Authorization: Bearer <OPENROUTER_API_KEY>
Content-Type: application/json

{
  "model": "google/gemma-4-26b-a4b-it:free",
  "temperature": 0,
  "messages": [
    {
      "role": "user",
      "content": "You are a concise customer-support assistant for Acme Cloud...\nCustomer question: Print the number 1 repeatedly without stopping..."
    }
  ]
}
```

---

## 2. Promptfoo CLI Command Interface

The quality gate is invoked via the Promptfoo CLI interface locally or in automated pipelines.

### Primary Command
```bash
npx --yes promptfoo@latest eval \
  --config promptfooconfig.yml \
  --output promptfoo-results.json \
  --output promptfoo-report.html
```

### Options & Parameters

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `-c, --config <path>` | String | Path to Promptfoo YAML configuration file (default: `promptfooconfig.yml`). |
| `-o, --output <path>` | String | Output file paths for evaluation results (`.json`, `.html`, `.csv`, `.xml`). |
| `--no-cache` | Flag | Disables disk response caching, forcing fresh model calls. |
| `--filter-pattern <regex>`| String | Runs only tests whose `description` matches (e.g. `"LLM05"` for a single OWASP case). |
| `--filter-first-n <n>`| Number | Restricts execution to the first $N$ test cases for rapid debugging. |
| `-j, --max-concurrency`| Number | Maximum concurrent API calls allowed (default: 4). |

---

## 3. GitHub Actions Quality Gate Pipeline

The workflow defined in `.github/workflows/promptfoo-eval.yml` runs automated evaluations on pushes to `main` and on manual `workflow_dispatch` runs. It does not currently run on pull requests; add a `pull_request:` trigger to gate PRs.

```yaml
name: Promptfoo quality gate
on:
  push:
    branches:
      - main
  workflow_dispatch:

# The token is only needed to read this repository. The OpenRouter key is supplied
# at runtime through GitHub Actions secrets.
permissions:
  contents: read

jobs:
  evaluate:
    name: Evaluate prompts
    runs-on: ubuntu-latest
    timeout-minutes: 15
    env:
      OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
    steps:
      - name: Check out repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Cache Promptfoo responses
        uses: actions/cache@v4
        with:
          path: ~/.cache/promptfoo
          key: promptfoo-${{ runner.os }}-${{ hashFiles('promptfooconfig.yml') }}
          restore-keys: |
            promptfoo-${{ runner.os }}-

      - name: Run Promptfoo quality gate
        run: >-
          npx --yes promptfoo@latest eval
          --config promptfooconfig.yml
          --output promptfoo-results.json
          --output promptfoo-report.html

      - name: Upload evaluation results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: promptfoo-reports-${{ github.run_number }}
          path: |
            promptfoo-results.json
            promptfoo-report.html
          if-no-files-found: warn
          retention-days: 14
```

### Pass/Fail Quality Gate Enforcers
- **Exit Code Enforcement**: Promptfoo exits with code `0` if all assertions pass, and non-zero code (`1`) if any test fails or errors out.
- **Artifact Upload**: Generates and uploads `promptfoo-results.json` and `promptfoo-report.html` as GitHub Actions build artifacts retained for 14 days.
