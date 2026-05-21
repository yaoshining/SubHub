<!--
Sync Impact Report
- Version change: template placeholder → 1.0.0
- Modified principles:
  - Template Principle 1 → I. Code Quality Is a Release Gate
  - Template Principle 2 → II. Tests Are Mandatory and Layered
  - Template Principle 3 → III. User Experience Must Stay Consistent
  - Template Principle 4 → IV. Performance Budgets Are Required
  - Template Principle 5 → V. Maintainability and Simplicity by Default
- Added sections:
  - Quality Gates & Delivery Standards
  - Delivery Workflow & Review Expectations
- Removed sections:
  - None
- Templates requiring updates:
  - ✅ .specify/templates/plan-template.md
  - ✅ .specify/templates/spec-template.md
  - ✅ .specify/templates/tasks-template.md
  - ✅ .specify/templates/commands/*.md (path not present; no updates required)
- Deferred TODOs:
  - None
-->
# SubHub Constitution

## Core Principles

### I. Code Quality Is a Release Gate
All production code MUST pass formatting, linting, and static analysis checks before merge.
Each change MUST keep code readable, modular, and documented at API boundaries.
Any accepted technical debt MUST include an owner, rationale, and follow-up task.
Rationale: consistent quality controls reduce regressions and long-term maintenance cost.

### II. Tests Are Mandatory and Layered
Every feature and bug fix MUST include tests that fail before implementation and pass after.
Test coverage MUST include unit tests for core logic and integration/contract tests for adapter
boundaries, API behavior, and cache/storage interactions.
Pull requests MUST not be merged when required tests fail.
Rationale: layered tests are the primary safety mechanism for a provider-aggregating service.

## III. Design Sources of Truth
- Project-wide visual and interaction rules live in `DESIGN.md`.
- Page-specific behavior and layout constraints live in `docs/pages/*.md`.
- Implementation must not invent new visual language when existing rules already cover the case.
- If a new page or component requires a new system-level rule, update `DESIGN.md`.
- If a change affects only one page, update that page spec instead of `DESIGN.md`.

### IV. User Experience Must Stay Consistent
Public API behavior MUST remain predictable across providers, including response shape, error
format, pagination/sorting semantics, and status code usage.
When breaking UX/API behavior is unavoidable, teams MUST document migration impact and provide
compatibility guidance in release notes.
Rationale: downstream media clients depend on stable and uniform integration behavior.

### V. Performance Budgets Are Required
Each feature MUST define measurable performance targets before implementation (for example:
p95 latency, cache hit ratio, and memory/storage constraints where relevant).
Changes that risk exceeding agreed budgets MUST include benchmark evidence and mitigation plans
before merge.
Rationale: SubHub must stay responsive under multi-provider and cache-heavy workloads.

### VI. Maintainability and Simplicity by Default
Designs MUST prefer simple, replaceable modules over tightly coupled abstractions.
Provider integrations MUST be isolated behind stable interfaces to prevent source-specific
behavior from leaking into core APIs.
Rationale: modular simplicity keeps the system extensible as providers and policies evolve.

## Quality Gates & Delivery Standards

- Every feature spec MUST include: test strategy, UX/API consistency expectations, and
  performance targets.
- Every implementation plan MUST pass a Constitution Check for all five principles.
- Every task plan MUST include explicit tasks for tests, UX/API consistency validation, and
  performance verification.

## Delivery Workflow & Review Expectations

- Implement in small, reviewable increments; each pull request MUST state principle compliance.
- Reviewers MUST block merge when any constitutional gate is missing evidence.
- CI MUST run formatting, linting, static analysis, and required test suites on every PR.
- Runtime and API-facing documentation MUST be updated when behavior changes.

## Governance

This constitution is the top-level engineering policy for SubHub. If other guidance conflicts,
this document takes precedence.

Amendments require: (1) a documented proposal, (2) reviewer approval from maintainers, and
(3) synchronization updates to affected templates and guidance docs in the same change.

Versioning policy:
- MAJOR: backward-incompatible governance or principle removals/redefinitions.
- MINOR: new principle/section or materially expanded policy guidance.
- PATCH: clarifications, wording improvements, and non-semantic refinements.

Compliance review expectations:
- Every PR review MUST include an explicit constitution compliance check.
- Periodic audits MUST sample active specs/plans/tasks for policy alignment.

**Version**: 1.0.0 | **Ratified**: 2026-05-21 | **Last Amended**: 2026-05-21
