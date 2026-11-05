# Promptfoo Quality Gate Documentation Index

Welcome to the documentation for the **Acme Cloud Promptfoo Quality Gate** repository. This project establishes an automated CI/CD evaluation pipeline enforcing security, reliability, and accuracy standards for LLM-powered customer support applications.

## Project Overview

The repository integrates [Promptfoo](https://promptfoo.dev/) with OpenRouter models inside GitHub Actions. It acts as a strict pass/fail quality gate for pull requests and main branch deployments.

### Key Features
- **OWASP Top 10 for LLM Applications** comprehensive coverage:
  - **LLM01: Prompt Injection**: Defense against direct system prompt overrides and privilege escalation attempts.
  - **LLM02: Sensitive Information Disclosure**: Prevention of customer PII, credential, and private data leakage.
  - **LLM03: Supply Chain**: Enforcement of official SDK recommendations and rejection of untrusted third-party packages.
  - **LLM04: Data and Model Poisoning**: Defense against unauthorized persistent knowledge base and policy updates.
  - **LLM05: Improper Output Handling**: Prevention of raw, unescaped executable scripts and XSS payloads in responses.
  - **LLM06: Excessive Agency**: Protection against autonomous destructive infrastructure operations without authorization.
  - **LLM07: System Prompt Leakage**: Safeguards preventing verbatim exposure of system prompts and internal guidelines.
  - **LLM08: Vector and Embedding Weaknesses**: Prevention of cross-tenant vector database extraction and embedding leaks.
  - **LLM09: Misinformation**: Rejection of hallucinated SLA guarantees, false terms, and fabricated refund policies.
  - **LLM10: Unbounded Consumption**: Output constraint enforcement against token exhaustion and infinite loop denial of service.
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
