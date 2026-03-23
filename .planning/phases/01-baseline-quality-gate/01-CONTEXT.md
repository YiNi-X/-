# Phase 1: Baseline Quality Gate - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning and execution

<domain>
## Phase Boundary

Phase 1 establishes a real, repeatable local baseline for the existing offline demo. It covers installation, running both entry points, lint, build, a lightweight smoke test, and the documentation/checklists needed for developers and demo operators on Windows-first environments.

</domain>

<decisions>
## Implementation Decisions

### Audience and baseline
- Optimize for both developers and demo operators.
- A fresh-machine baseline must cover both the dashboard and RouteEditor.
- Phase 1 runtime success is based on cleaned or already committed data in `public/data`.
- `代码依据/` remains the upstream source background, but raw-data regeneration is not required to pass this phase.

### Quality gate behavior
- Lint must reach zero errors in Phase 1.
- Lint warnings may remain if they do not block delivery.
- Small, documented, targeted exceptions are acceptable when a full fix would force a broader refactor.
- Broad lint rule weakening or large ignore-based bypasses are not acceptable.
- `test` must be a real lightweight smoke test, not an empty placeholder.
- Provide one unified verification command that wraps the baseline checks.

### Documentation shape
- Use a root-level entry document and a `demo-web` detail document.
- Documentation is Chinese-first, with English commands and technical terms where useful.
- Structure the detailed doc as Quick Start first, then troubleshooting and quality checks.
- Provide a separate demo checklist for presentation use.

### Claude's Discretion
- Exact smoke-test implementation details.
- Exact wording of known-issues and troubleshooting sections.
- Whether remaining non-blocking lint warnings should be fixed immediately or only documented.

</decisions>

<specifics>
## Specific Ideas

- Windows is the only explicit support target for this phase.
- The quality gate should be easy to hand to another person as a single command.
- Demo operators should be able to check both pages without reading full development notes.

</specifics>

<deferred>
## Deferred Ideas

- Full raw-data-to-output regeneration from `代码依据/` belongs to Phase 4.
- Realtime AIS ingestion and backend API work are out of scope for this phase.

</deferred>

---

*Phase: 01-baseline-quality-gate*
*Context gathered: 2026-03-23*
