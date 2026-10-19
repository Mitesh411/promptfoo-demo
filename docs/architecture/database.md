# Promptfoo Test Case & Cache Data Model Documentation

This document describes the configuration schema, evaluation data model, and local/CI response caching architecture utilized by the Promptfoo quality gate.

---

## Entity-Relationship Diagram (ERD)

The following Mermaid ERD represents the relational structure of the evaluation configuration schema, test cases, prompt variables, assertions, and execution results.

```mermaid
erDiagram
    PROMPTFOO_CONFIG ||--|{ PROMPT : contains
    PROMPTFOO_CONFIG ||--|{ PROVIDER : configures
    PROMPTFOO_CONFIG ||--|{ TEST_CASE : defines
    TEST_CASE ||--|{ VARIABLE : supplies
    TEST_CASE ||--|{ ASSERTION : enforces
    TEST_CASE ||--o| EVALUATION_RESULT : generates
    EVALUATION_RESULT ||--o| RESPONSE_CACHE : stores

    PROMPTFOO_CONFIG {
        string description
        string default_test_provider
    }

    PROMPT {
        string prompt_id PK
        string raw_template
    }

    PROVIDER {
        string provider_id PK
        string model_name
        float temperature
    }

    TEST_CASE {
        string test_id PK
        string description
        string owasp_category
    }

    VARIABLE {
        string key PK
        string value
    }

    ASSERTION {
        string type PK
        string value
        string rubric_grader
    }

    EVALUATION_RESULT {
        string eval_id PK
        boolean pass
        string raw_output
        float latency_ms
    }

    RESPONSE_CACHE {
        string cache_key PK
        string cached_response
        timestamp created_at
    }
```

---

## Data Schema & Table Specifications

### 1. `promptfooconfig` (Root Configuration)
Main configuration entry point defining project metadata and global defaults.

| Field | Type | Description |
| :--- | :--- | :--- |
| `description` | String | Overview description of the evaluation test suite. |
| `prompts` | List[String] | Array of template prompts evaluated during test runs. |
| `providers` | List[Object] | Target LLM model configurations (e.g., OpenRouter endpoint and parameters). |
| `defaultTest` | Object | Fallback options and rubric evaluator models (e.g., `openrouter:openai/gpt-4o-mini`). |

---

### 2. `tests` (Test Case Schema)
Defines individual scenario tests, objective metrics, and security controls.

| Field | Type | Description |
| :--- | :--- | :--- |
| `description` | String | Human-readable title detailing the objective and OWASP threat category. |
| `vars` | Map[String, String] | Key-value pairs substituted into prompt templates (e.g., `{{question}}`). |
| `assert` | List[Object] | List of validation assertions that must ALL pass for the test to succeed. |

---

### 3. `assert` (Assertion Schema)
Defines pass/fail quality gate rules evaluated against model outputs.

| Field | Type | Description |
| :--- | :--- | :--- |
| `type` | Enum | Assertion evaluator type: `llm-rubric`, `not-contains`, `not-icontains`, `javascript`. |
| `value` | String | Evaluation criteria or threshold (e.g., rubric text or substring to disallow). |
| `options.provider` | String | Model used to grade `llm-rubric` evaluation prompts. |

---

## Indexing & Caching Strategy

- **Cache Key (`cache_key`)**: Hash of `(prompt_template, provider_id, prompt_vars, temperature)`.
- **Cache Location**: Local disk storage at `~/.cache/promptfoo` and GitHub Actions workflow runner cache (`actions/cache@v4`).
- **Cache Invalidation**: Automatically invalidated whenever `promptfooconfig.yml` content changes.
