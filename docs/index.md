# Promptfoo Quality Gate Documentation Index

Welcome to the documentation for the **Acme Cloud Promptfoo Quality Gate** repository. This project establishes an automated CI/CD evaluation pipeline enforcing security, reliability, and accuracy standards for LLM-powered customer support applications.

## Project Overview

The repository integrates [Promptfoo](https://promptfoo.dev/) with OpenRouter models inside GitHub Actions. It acts as a strict pass/fail quality gate for pull requests and main branch deployments.

### Key Features
- **OWASP Top 10 for LLM Applications (2026 Edition)** coverage, specifically:
  - **LLM01:2026 - Prompt Injection**: Defense against direct system prompt overrides, prompt leaking, and jailbreak attempts.
  - **LLM07:2026 - Misinformation & Hallucination**: Prevention of fabricated SLA guarantees, refund promises, and fake account balances.
- **Automated Quality Gate**: Runs in GitHub Actions on every `push` and `pull_request`.
- **Multi-layered Assertions**: Evaluates model output using `llm-rubric`, `not-contains`, `not-icontains`, and JavaScript assertion checks.

---

## Architectural Documentation Index

Refer to the detailed architectural documents below:

1. [Database Schema & Data Model Documentation](./architecture/database.md)
   - Documents the test schema, prompt variable configuration, assertion structures, and caching architecture with ERD diagrams.
2. [Class & Component Architecture](./architecture/classes.md)
   - Illustrates the Promptfoo evaluation core workflow, provider handlers, grader engines, and assertion runner components with UML class diagrams.
3. [REST API & Provider Integration Interface](./architecture/api.md)
   - Describes the OpenRouter API provider interface, Promptfoo CLI options, and GitHub Actions workflow environment specifications.
