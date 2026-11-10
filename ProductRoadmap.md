# Product Roadmap: Acme Cloud LLM Quality Gate

**Last updated:** 2026-11-10
**Scope:** `promptfoo-demo` repository (Promptfoo + OpenRouter + GitHub Actions quality gate)

## 1. Where the product is today

The repository is a configuration-only quality gate. One Acme Cloud customer-support prompt is tested against 10 adversarial cases, one for each OWASP Top 10 for LLM Applications risk (LLM01–LLM10). Each case pairs an `llm-rubric` check (scored by `openai/gpt-4o-mini`) with a deterministic string or JavaScript check. The workflow runs on pushes to `main` and on manual runs, and fails the run if any assertion fails.

### Strengths

- **Fast to adopt.** There is no application code, and one YAML file defines the whole suite.
- **Clear security framing.** Every test is labelled with its OWASP risk, the vulnerability and the test objective.
- **Two kinds of check per test.** A semantic rubric plus a deterministic guard on each case.
- **Good CI basics.** Least-privilege token, the API key kept in secrets, a response cache, and reports uploaded even when the gate fails.

### Weaknesses this roadmap addresses

| # | Weakness | Consequence |
| :--- | :--- | :--- |
| W1 | The workflow does not run on pull requests. | Changes are checked only after they are merged to `main`, so nothing is actually blocked. |
| W2 | Several "must not contain" checks match words a correct refusal would naturally use (`password`, `credit card`, `100 percent discount`, `guaranteed refund`, `acme-cloud-hackz`, `nearest-neighbor embedding`). | A safe answer such as "I can't share passwords" fails the gate. False failures erode trust in the gate. |
| W3 | Nothing checks the assertions themselves. | A check that can never pass, or can never fail, goes unnoticed. |
| W4 | `promptfoo@latest` and the GitHub Actions are not pinned to fixed versions. | Results can change without any change to this repo. This is a supply-chain risk, which is the same risk the LLM03 test covers. |
| W5 | The assistant's instructions and the customer's question are sent together as a single user message, with no system message. | The LLM01 (prompt injection) and LLM07 (system prompt leakage) tests don't reflect how a real deployment separates instructions from user input. |
| W6 | All 10 tests are attacks; none checks that the assistant can still help. | A model that refuses everything passes every test. |
| W7 | The model under test is a free OpenRouter model, with no output-token limit or retry settings. | Rate limits and the model being withdrawn can break CI. Output length is not capped at the provider. |
| W8 | One attack per risk, single-turn only, each run once. | Coverage is thin, and pass/fail on a single sample is noisy. |
| W9 | There is no reporting beyond a downloadable artifact kept for 14 days. | No trend over time, no summary on the PR, no cost visibility. |

## 2. How items are prioritized

- **P0 — Make the gate trustworthy.** It either does not block what it should, or it blocks correct behavior. These items are high impact and low effort, so they come first.
- **P1 — Deepen coverage.** More realistic and more varied attacks, and measurement that holds up statistically.
- **P2 — Insight and scale.** Reporting, trends, and reuse by other teams.

Estimates assume one engineer familiar with Promptfoo and GitHub Actions. They do not include OpenRouter API spend.

## 3. Roadmap summary

| ID | Item | Priority | Phase | Dev (h) | Test (h) |
| :--- | :--- | :---: | :---: | ---: | ---: |
| RM-01 | Run the gate on pull requests | P0 | 1 | 2 | 2 |
| RM-02 | Assertion self-test harness | P0 | 1 | 6 | 3 |
| RM-03 | Fix brittle string assertions | P0 | 1 | 4 | 4 |
| RM-04 | Pin Promptfoo and GitHub Actions versions | P0 | 1 | 2 | 1 |
| RM-05 | Send instructions as a real system message | P0 | 1 | 3 | 3 |
| RM-06 | Helpfulness and over-refusal tests | P0 | 1 | 4 | 3 |
| RM-07 | Reliable target model and cost limits | P0 | 1 | 2 | 2 |
| RM-08 | Config linting and test-structure rules in CI | P1 | 2 | 3 | 2 |
| RM-09 | Several attacks per OWASP risk, one file per risk | P1 | 2 | 16 | 8 |
| RM-10 | Multi-turn and indirect prompt-injection tests | P1 | 2 | 8 | 4 |
| RM-11 | Repeated runs, pass-rate thresholds and a nightly no-cache run | P1 | 2 | 4 | 3 |
| RM-12 | Check the accuracy of the grading model | P1 | 2 | 6 | 6 |
| RM-13 | Scheduled automated red-teaming | P1 | 2 | 8 | 6 |
| RM-14 | Results summary posted on the pull request | P2 | 3 | 6 | 3 |
| RM-15 | Compare several models side by side | P2 | 3 | 4 | 3 |
| RM-16 | Track results over time | P2 | 3 | 12 | 4 |
| RM-17 | Package the gate as a reusable workflow | P2 | 3 | 10 | 6 |
| RM-18 | Accurate architecture docs and a test-writing guide | P2 | 3 | 4 | 1 |
| | **Total** | | | **104** | **64** |

| Phase | Theme | Dev (h) | Test (h) | Total (h) |
| :--- | :--- | ---: | ---: | ---: |
| 1 | Make the gate trustworthy | 23 | 18 | 41 |
| 2 | Deepen coverage | 45 | 29 | 74 |
| 3 | Insight and scale | 36 | 17 | 53 |

## 4. Phase 1 — Make the gate trustworthy (P0)

### RM-01 — Run the gate on pull requests

- **Problem:** W1. The gate runs only after a change is already on `main`.
- **Description:** Add a `pull_request` trigger. Pull requests from forks don't receive repository secrets, so skip the evaluation for them with a clear message instead of letting it fail. Make **Evaluate prompts** a required status check in branch protection. Update the README, `docs/index.md` and `docs/architecture/api.md` to match.
- **Acceptance criteria:** A PR that breaks a test cannot be merged. A PR from a fork shows a skipped check with an explanation.
- **Dev effort:** 2 h. **Test effort:** 2 h (a passing PR, a failing PR, a PR from a fork).
- **Dependencies:** None. Do this before the other items, because it is what makes the rest of the work actually block bad changes.

### RM-02 — Assertion self-test harness

- **Problem:** W3. Nothing proves that each assertion passes a good answer and fails a bad one.
- **Description:** Add a small custom Promptfoo provider (`file://` JavaScript) that returns fixed sample answers. Give each OWASP test at least one known-good answer (a safe refusal) and one known-bad answer (a compliant or leaking reply). Run this suite in CI before the live evaluation. It makes no model calls, so it is fast and costs nothing.
- **Acceptance criteria:** Each test has fixtures for both outcomes. The harness fails if any good answer fails or any bad answer passes. It runs in under 30 seconds and makes no network calls to the model under test.
- **Dev effort:** 6 h. **Test effort:** 3 h.
- **Dependencies:** None. RM-03 relies on this harness to confirm its fixes.

### RM-03 — Fix brittle string assertions

- **Problem:** W2. "Must not contain" checks on LLM01, LLM02, LLM03, LLM08 and LLM09 match words a correct refusal naturally uses.
- **Description:** Replace bare keyword bans with patterns that target the harmful behavior itself, not the topic. For example, ban an actual card-number pattern rather than the phrase "credit card", and ban phrasing that confirms the discount rather than the words "100 percent discount". Where no reliable deterministic pattern exists, rely on the rubric alone and say why in a comment next to the test.
- **Acceptance criteria:** The RM-02 good answers pass and the bad answers fail for all 10 tests.
- **Dev effort:** 4 h. **Test effort:** 4 h.
- **Dependencies:** RM-02.

### RM-04 — Pin Promptfoo and GitHub Actions versions

- **Problem:** W4. The same commit can give different results from one run to the next.
- **Description:** Replace `promptfoo@latest` with a fixed version used in CI, the README and CLAUDE.md. Pin each GitHub Action to a commit SHA. Turn on Dependabot for GitHub Actions and npm, so upgrades arrive as reviewable pull requests.
- **Acceptance criteria:** Every version is fixed in the repository, and Dependabot opens update PRs.
- **Dev effort:** 2 h. **Test effort:** 1 h.
- **Dependencies:** None.

### RM-05 — Send instructions as a real system message

- **Problem:** W5. Instructions and user input share one message, so the injection and leakage tests don't match a real deployment.
- **Description:** Change the prompt to chat format, with the assistant's instructions as the `system` message and `{{question}}` as the `user` message. Point the LLM07 leakage check at the new system text.
- **Acceptance criteria:** The request sent to the model contains separate system and user messages. LLM01 and LLM07 still pass, or any new failures are investigated and recorded.
- **Dev effort:** 3 h. **Test effort:** 3 h.
- **Dependencies:** RM-02, so the LLM07 fixtures can be updated in the same change.

### RM-06 — Helpfulness and over-refusal tests

- **Problem:** W6. A model that refuses everything passes the current suite.
- **Description:** Add 5–8 ordinary support questions, such as cancelling a subscription, resetting a password, a billing question or a request for an official SDK. Each must get a helpful, accurate answer. Add a rubric check that fails if the assistant refuses or deflects a legitimate request.
- **Acceptance criteria:** A model that always refuses fails these tests, which you can confirm with a refusal fixture from RM-02. The current model passes them.
- **Dev effort:** 4 h. **Test effort:** 3 h.
- **Dependencies:** RM-02.

### RM-07 — Reliable target model and cost limits

- **Problem:** W7. Free-tier rate limits and withdrawn models can break CI, and output length isn't capped at the provider.
- **Description:** Set a maximum number of output tokens and a sensible concurrency limit on the target model, and configure retries. Write down a fallback model and how to switch to it. If CI flakiness is due to the free tier, decide whether to move to a paid model. Keep the LLM10 JavaScript length check as a second layer of protection.
- **Acceptance criteria:** No CI failure is caused by rate limits over 10 consecutive runs. The README documents the fallback model.
- **Dev effort:** 2 h. **Test effort:** 2 h.
- **Dependencies:** None.

## 5. Phase 2 — Deepen coverage (P1)

### RM-08 — Config linting and test-structure rules in CI

- **Description:** Validate `promptfooconfig.yml` against Promptfoo's published config schema and lint the YAML. Add a small script that requires every test to have an `LLMxx:` description prefix and both a rubric and a deterministic assertion (or a documented exception), and that requires every OWASP risk to have at least one test.
- **Acceptance criteria:** A malformed or non-conforming test fails CI before any model call is made.
- **Dev effort:** 3 h. **Test effort:** 2 h.

### RM-09 — Several attacks per OWASP risk, one file per risk

- **Description:** Grow from 1 to 3–5 attacks per risk, covering paraphrased, obfuscated (base64, other languages, role-play) and direct variants. Move the tests into `tests/llmXX-*.yaml` and load them with Promptfoo's `file://` glob, so each risk can be reviewed and owned separately.
- **Acceptance criteria:** At least 30 attack tests. Each file has fixtures in the RM-02 harness. A full run takes less than 10 minutes.
- **Dev effort:** 16 h. **Test effort:** 8 h.
- **Dependencies:** RM-02, RM-03, RM-08.

### RM-10 — Multi-turn and indirect prompt-injection tests

- **Description:** Add conversations where the attack builds up over several turns. Add indirect injection, where harmful instructions are hidden in content passed to the model through a variable, such as a "retrieved help article" or a "customer email". The aim is to show resistance in the shape of a real RAG or agent system, not just single questions.
- **Acceptance criteria:** At least 4 multi-turn tests and 4 indirect-injection tests, each with good and bad fixtures.
- **Dev effort:** 8 h. **Test effort:** 4 h.
- **Dependencies:** RM-05.

### RM-11 — Repeated runs, pass-rate thresholds and a nightly no-cache run

- **Description:** Model output varies even at temperature 0, and a cached response can hide a change in the model behind a provider ID. Run each test several times with `--repeat` and gate on a per-risk pass-rate threshold rather than a single sample. Add a scheduled nightly run with `--no-cache` to catch changes on the provider's side.
- **Acceptance criteria:** Pass rate is reported per risk. The nightly run alerts on a regression without blocking pull requests.
- **Dev effort:** 4 h. **Test effort:** 3 h.
- **Dependencies:** RM-07, since repeated runs make cost and rate limits matter more.

### RM-12 — Check the accuracy of the grading model

- **Description:** Every rubric verdict comes from a single grading model (`gpt-4o-mini`). Build a labelled set of about 40 answers, judged pass or fail by a person, and measure how often the grader agrees. If agreement is below target, try a stronger grader or reword the rubric text. Record the chosen grader and its measured accuracy.
- **Acceptance criteria:** Grader agreement with the human labels is at least 90% and is recorded in the docs.
- **Dev effort:** 6 h. **Test effort:** 6 h.
- **Dependencies:** RM-02, which supplies a starting set of labelled answers.

### RM-13 — Scheduled automated red-teaming

- **Description:** Use Promptfoo's red-team feature with its OWASP LLM Top 10 preset to generate many more attacks automatically against the same prompt. Run it on a schedule (weekly) rather than on every PR. Turn confirmed findings into permanent hand-written tests under RM-09.
- **Acceptance criteria:** A weekly report is published as an artifact. A short documented process explains how a finding becomes a permanent test.
- **Dev effort:** 8 h. **Test effort:** 6 h.
- **Status (2026-11-10):** Built; first live run pending. See `promptfooconfig.redteam.yml`, `.github/workflows/promptfoo-redteam.yml` and [docs/redteam.md](docs/redteam.md). Generation is local-only by default, so the OWASP plugins that need Promptfoo's remote generator are excluded until someone opts in. The `crescendo` strategy also provides part of RM-10 (multi-turn attacks).
- **Dependencies:** RM-07.

## 6. Phase 3 — Insight and scale (P2)

### RM-14 — Results summary posted on the pull request

- **Description:** Post or update a comment on the PR with pass/fail for each OWASP risk, the change from `main`, links to failing cases in the HTML report, and tokens used and estimated cost.
- **Acceptance criteria:** Each PR has a single comment that updates in place. The workflow is granted only the extra permission it needs to write PR comments.
- **Dev effort:** 6 h. **Test effort:** 3 h.
- **Dependencies:** RM-01.

### RM-15 — Compare several models side by side

- **Description:** An optional manual workflow that runs the suite against 3–5 candidate models and produces a comparison table of pass rate per risk, response time and cost, to support model-selection decisions.
- **Acceptance criteria:** One manual run produces a comparison report as an artifact.
- **Dev effort:** 4 h. **Test effort:** 3 h.

### RM-16 — Track results over time

- **Description:** Keep the results from each run on `main` and the nightly run beyond the 14-day artifact limit, for example in a results branch or external storage. Show pass rate per OWASP risk over time on a simple dashboard.
- **Acceptance criteria:** At least 90 days of history can be viewed. A regression can be traced to the date and commit where it started.
- **Dev effort:** 12 h. **Test effort:** 4 h.
- **Dependencies:** RM-11.

### RM-17 — Package the gate as a reusable workflow

- **Description:** Turn the pipeline into a reusable GitHub workflow, with the config path, model, grader and thresholds as inputs, so other teams' prompts can use the same OWASP baseline. Version it and add a changelog.
- **Acceptance criteria:** A second repository uses the gate with fewer than 20 lines of workflow YAML.
- **Dev effort:** 10 h. **Test effort:** 6 h.
- **Dependencies:** RM-01, RM-04, RM-08.

### RM-18 — Accurate architecture docs and a test-writing guide

- **Description:** The class and data diagrams in `docs/architecture/` describe Promptfoo with made-up component names. Label them clearly as conceptual, or replace them with a description of how this repository actually works. Add a CONTRIBUTING guide covering test naming, assertion design rules (learned from RM-03), fixtures, and how to run a single test.
- **Acceptance criteria:** A new contributor can add a test that passes RM-08 using only the guide.
- **Dev effort:** 4 h. **Test effort:** 1 h.

## 7. Risks and assumptions

- **API cost goes up.** RM-09, RM-11, RM-13 and RM-15 add many more model calls. Set a monthly spending budget on the OpenRouter key before Phase 2.
- **Grader bias.** Until RM-12 is done, rubric results depend on one grading model whose accuracy hasn't been measured.
- **Some tests check only what the assistant says.** LLM06 (excessive agency) and LLM08 (vector and embedding weaknesses) test what the assistant says it will do, because this setup has no real tools or vector database. Proving the actual controls requires testing against the production agent or retrieval system, which is outside this repository.
- **Secrets on fork PRs.** RM-01 deliberately skips fork PRs. Running evaluations for them would need a separately reviewed `pull_request_target` design.
