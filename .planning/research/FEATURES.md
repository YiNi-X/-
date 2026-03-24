# Feature Research

**Domain:** Offline algorithm showcase website for archived AIS traffic analysis
**Researched:** 2026-03-24
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Clear module navigation | A multi-algorithm website feels broken if viewers cannot tell where each analysis lives | MEDIUM | Replace the current dense dashboard framing with first-class module entry points |
| Honest archived-data framing | Viewers and teachers will ask whether the data is live | LOW | Must clearly label archived playback and offline inference without weakening the demo |
| Model and scenario switching | A research showcase must prove that outputs are not one hardcoded screenshot | MEDIUM | Use precomputed bundles and a shared scenario context |
| Metrics plus visualization together | Teachers will want both numerical evidence and intuitive pictures | MEDIUM | Every major module should combine charts, tables, and map or trajectory views |
| Stable repeatable demo scenarios | A presentation site is only credible if the same story can be replayed reliably | MEDIUM | Curated scenarios are more important than unlimited data flexibility |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Unified loop from clustering or repair to prediction to decision | Shows a complete research-to-product narrative instead of isolated notebooks | HIGH | This is likely the strongest defense/demo differentiator |
| Before/after collaborative decision view | Gives the site a clear business story instead of only technical charts | MEDIUM | Can be rule-driven as long as evidence linkage is explicit |
| Noise re-clustering and corridor extraction explanation | Makes the clustering work look deeper and more product-oriented | MEDIUM | Particularly good for teachers who care about methodology depth |
| Evaluation center with optimization history | Demonstrates that model choice was assessed instead of asserted | MEDIUM | Strong support for academic defense and website explanation material |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Fake realtime backend | It sounds impressive in demos | It creates credibility risk when the data source cannot be defended | Use archived replay with explicit quasi-realtime interaction |
| Arbitrary user upload and online analysis | It feels flexible | It changes the site from a curated showcase into an analysis platform | Use curated scenarios and precomputed result bundles |
| Cram every module into one dashboard screen | It seems convenient | It makes the site harder to explain and scale | Use a module shell with clear routes or navigation sections |

## Feature Dependencies

```text
[Flow Prediction Module]
    -> requires -> [Module Shell + Shared Scenario Context]
    -> requires -> [Prediction Result Bundles]

[Trajectory Repair Module]
    -> requires -> [Curated Sample Bundles]
    -> requires -> [Evaluation Metrics Layer]

[Trajectory Clustering Module]
    -> requires -> [Clustering Result Bundles]
    -> enhances -> [Collaborative Decision Module]

[Collaborative Decision Module]
    -> requires -> [Flow Prediction Module]
    -> benefits from -> [Trajectory Clustering Module]

[Evaluation Center]
    -> requires -> [Structured Metrics Across Modules]
```

### Dependency Notes

- **Prediction module requires module shell:** model or horizon switching must live within a stable navigation and state boundary
- **Repair module requires curated sample bundles:** notebook HTML alone is not enough for a website comparison workflow
- **Clustering enhances collaborative decision:** focus routes and explanation copy are much stronger when corridor evidence is available
- **Evaluation center requires structured metrics:** hardcoded benchmark text is not enough once multiple modules expose model comparisons

## MVP Definition

### Launch With (v1)

- [ ] Modular showcase shell with shared scenario or frame context - essential because the current single-surface layout does not scale
- [ ] Flow prediction module - already closest to being productized
- [ ] Trajectory repair module - strong academic value and already supported by offline experiments
- [ ] Trajectory clustering module - key provenance layer for explaining corridor extraction
- [ ] Collaborative decision module - necessary to complete the product story
- [ ] Evaluation center and overview page - essential for defense/readability

### Add After Validation (v1.x)

- [ ] More archived scenarios - add when the first curated scenario set proves stable
- [ ] Richer exports for presentations or reports - add once core module navigation is working
- [ ] Finer-grained scenario comparison - add if reviewers ask for cross-scenario rather than single-scenario depth

### Future Consideration (v2+)

- [ ] Live AIS or backend scenario management - defer until the data source and operations model are real
- [ ] User-uploaded analysis - defer until compute, validation, and storage needs justify a backend

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Module shell and data packaging | HIGH | MEDIUM | P1 |
| Flow prediction module | HIGH | MEDIUM | P1 |
| Trajectory repair module | HIGH | MEDIUM | P1 |
| Trajectory clustering module | HIGH | HIGH | P1 |
| Collaborative decision module | HIGH | MEDIUM | P1 |
| Evaluation center | HIGH | MEDIUM | P1 |
| Extra scenarios | MEDIUM | MEDIUM | P2 |
| Live data or uploads | LOW for current milestone | HIGH | P3 |

## Competitor Feature Analysis

| Feature | Competitor A | Competitor B | Our Approach |
|---------|--------------|--------------|--------------|
| Forecast display | Often a dashboard-only chart view | Often a static report figure | Link map playback, hotspot grids, and model metrics in one module |
| Repair analysis | Often notebook screenshots only | Often metric table only | Show map/trajectory overlay plus error charts and metric summary |
| Clustering explanation | Often buried in research appendix | Often shown as one final plot | Show the full pipeline from raw to corridor extraction |

## Sources

- Conversation-defined milestone goals from 2026-03-24
- `.planning/codebase/ARCHITECTURE.md`
- `代码依据/流量预测`
- `代码依据/轨迹修复`
- `代码依据/轨迹聚类`

---
*Feature research for: offline AIS algorithm showcase website*
*Researched: 2026-03-24*
