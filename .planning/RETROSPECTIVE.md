# Retrospective: Port Traffic AIS Demo Web

## Milestone: v1.1 - Offline Showcase Expansion

**Shipped:** 2026-03-30
**Phases:** 7
**Roadmap Plans:** 22

### What Was Built

- A reproducible bundle-export pipeline for forecast, repair, clustering, evaluation, overview, and forward-looking modules
- A registry-driven shell with lazy-loaded module packages and shared runtime status handling
- Full module surfaces for forecast, repair, clustering, evaluation, overview, and forward-looking analysis
- Site-wide corridor-dominance and deferred `CLUS-03` cross-links instead of isolated module-specific copy

### What Worked

- Data-first sequencing kept UI work anchored to committed artifacts instead of notebook guesses.
- Honest fallback panels let the site ship around missing research artifacts without breaking trust.
- Reusing exported bundle patterns across modules made later phases faster and more coherent.

### What Was Inefficient

- Late phases accumulated summary-only closeout records instead of uniform plan and verification files.
- Planning files drifted from the real shipped state and needed a manual sync during closeout.
- Git history did not keep pace with the executed later phases, so the milestone is documentation-complete before it is commit-complete.

### Patterns Established

- `artifact-index.json` + manifest + bundle is now the canonical frontend module contract.
- Cross-module storylines should route through evaluation / overview rather than duplicating authority everywhere.
- When a research dependency is missing, ship a precise fallback with file-state evidence instead of a mocked replacement.

### Key Lessons

- Corridor dominance became much more valuable once it was allowed to connect clustering, evaluation, overview, and forward-looking together.
- The product stayed stronger by admitting the zero-byte `normalized_distances(60,90,0.03).pkl` blocker explicitly instead of hiding it.
- Milestone-scale work needs the documentation layer maintained continuously, not reconstructed at the end.

## Cross-Milestone Trends

| Milestone | Stronger Than Before | Debt Still Open |
| --- | --- | --- |
| `v1.0` | Buildability, lint/test baseline, runtime contract validation, refactored monolith seams | Broader offline packaging and module architecture still missing |
| `v1.1` | Modular offline showcase, module export pipeline, site-wide narrative cross-links, forward-looking evidence layer | Missing late-phase verification files, missing true noise re-clustering artifact, no next-milestone scope yet |
