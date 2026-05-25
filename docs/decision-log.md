# SentraAI Architecture Decision Log (ADR)

This log records the major technical and product design decisions made for SentraAI, establishing context and history for the engineering team.

---

## ADR 001: Monorepo vs. Multi-Repo Setup

### Status
**Approved** (2026-05-25)

### Context
We initially planned a multi-repo structure with separate repositories for frontend, backend, scanner, and docs. While microservice separation makes sense at scale, managing 5 separate repositories, independent pipelines, and shared dependencies creates immense overhead for a single-founder/early-stage startup.

### Decision
We will use a **Monorepo** structure (`sentra-ai/` containing `frontend/`, `backend/`, `scanner-engine/`, `remediation-engine/`, `shared/`, `docs/`, `config/`, `tests/`). 

### Consequences
* **Pros**: Single git history, atomic commits across scanner/backend, direct importing of shared types without packaging systems, simple workspace management.
* **Cons**: Larger single repository, but negligible at early-stage MVP size.

---

## ADR 002: Deterministic Rule-Based Engine vs. AI LLM

### Status
**Approved** (2026-05-25)

### Context
Using OpenAI or Claude API calls to scan and generate fixes immediately incurs high token costs, potential rate-limiting, slow execution speeds (3-10 seconds per API request), and non-deterministic text outputs that could break Terraform code diff syntax.

### Decision
For Phase 1 MVP, we will use a **deterministic Python-based pattern rule engine** combined with template-based remediations. The remediation-engine will map scanner findings to hardcoded, tested code diff templates (e.g., swapping `public-read` to `private`).

### Consequences
* **Pros**: Zero API costs, extremely fast execution (<100ms), 100% reliable syntax validation for code fixes, predictable and secure behavior.
* **Cons**: Limited to pre-defined rules, but these rules cover 90% of critical CVEs and misconfigurations that developers encounter. AI can be layered on top later as a premium feature.

---

## ADR 003: Deferring the SaaS Dashboard

### Status
**Approved** (2026-05-25)

### Context
Founders often spend months building dashboard features (login, profile, organization settings, graphs, analytics, pricing pages) before validating if users actually want the core utility of their software.

### Decision
We will **defer the creation of any web dashboard**. The primary and only interface for SentraAI will be the GitHub Pull Request page. Findings, severity details, explanations, and code diff fixes will be written inline as PR review comments.

### Consequences
* **Pros**: Saves months of frontend, database, and auth development. Focuses 100% of engineering bandwidth on the developer workflow experience.
* **Cons**: No central settings page, configuration must be handled through repository file parameters (e.g., `sentra.yml` in their code repos) rather than a UI dashboard. This is actually a positive for developer-centric UX.
