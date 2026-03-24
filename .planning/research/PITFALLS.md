# Pitfalls Research

**Domain:** Offline algorithm showcase website for archived AIS traffic analysis
**Researched:** 2026-03-24
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Frontend Depends on Raw Notebook Artifacts

**What goes wrong:**
The website starts reading notebook-native structures, HTML exports, or ad hoc file names directly.

**Why it happens:**
The research artifacts already exist, so it feels faster to wire the UI straight to them.

**How to avoid:**
Create stable website-facing packaging scripts and manifests before building module UIs.

**Warning signs:**
UI code contains notebook file names, HTML-specific assumptions, or parsing logic for multiple unrelated artifact formats.

**Phase to address:**
Phase 6

---

### Pitfall 2: The Demo Looks Live But Cannot Defend Its Data Source

**What goes wrong:**
Teachers or reviewers ask whether the data is live, and the site wording overpromises.

**Why it happens:**
Teams try to maximize perceived sophistication by blurring archived playback and realtime operations.

**How to avoid:**
Use "historical replay + offline inference" framing everywhere while keeping interaction quasi-realtime through timeline playback and state switching.

**Warning signs:**
Labels say "live" without qualifiers, or no page explicitly describes the archived-data pipeline.

**Phase to address:**
Phases 6 and 11

---

### Pitfall 3: All Results Ship in One Monolithic Payload

**What goes wrong:**
Load time and browser memory rise sharply as repair, clustering, evaluation, and multiple models are added.

**Why it happens:**
The current demo already uses a few large JSON files, so it is tempting to keep appending fields to them.

**How to avoid:**
Split artifacts by module, scenario, model, and sample; load them lazily from small manifests.

**Warning signs:**
`public/data` contains giant catch-all JSON files, or the first page load must fetch every module's data.

**Phase to address:**
Phase 6

---

### Pitfall 4: Collaborative Decision Is Untethered From Evidence

**What goes wrong:**
Strategy suggestions read like generic text and cannot be traced to prediction or clustering outputs.

**Why it happens:**
There is no strong standalone decision package in `代码依据`, so teams may improvise narrative without explicit linkage.

**How to avoid:**
Make collaborative decision a rule-driven evidence layer with visible inputs, explanations, and before/after state bundles.

**Warning signs:**
Recommendations mention no focus grid, route, forecast change, or corridor evidence.

**Phase to address:**
Phase 10

---

### Pitfall 5: Overreacting to Growth With a Framework Rewrite

**What goes wrong:**
Time is lost migrating the app instead of solving route, module, and artifact boundaries.

**Why it happens:**
Growing pages and datasets can look like a framework problem even when they are really an information-architecture problem.

**How to avoid:**
Keep the current stack, introduce module boundaries, and postpone backend or framework changes until static delivery truly stops fitting.

**Warning signs:**
Discussion jumps to Next.js, micro-frontends, or backend APIs before module manifests and lazy loading exist.

**Phase to address:**
Phase 6

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoding benchmark metrics in frontend files | Fast initial demo | Metrics drift away from actual offline outputs | Only as a temporary bridge while packaging scripts are being built |
| Embedding notebook HTML results directly | Quick visual reuse | Weak contract boundary and hard styling/control integration | Acceptable only for short-lived review prototypes |
| Reusing one timeline payload for every module | Fewer files to manage | Large payloads and hidden coupling between unrelated views | Acceptable only while the site still has one or two tightly related surfaces |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `代码依据` -> website | Treat notebook folders as if they were API contracts | Build a packaging layer that emits website-facing manifests and result bundles |
| Flow forecast -> evaluation | Use hardcoded benchmark summaries without artifact traceability | Export metrics together with model and horizon identifiers |
| Clustering -> decision | Make the decision view read raw clustering outputs directly | Export simplified evidence bundles and corridor metadata for the decision module |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading all modules eagerly | Slow first paint and high memory use | Lazy-load module bundles and manifests | Breaks once multiple scenarios and repair/clustering bundles are added |
| Rendering raw trajectories everywhere | Browser lag and unreadable plots | Use segmented, compressed, or corridor-level outputs where appropriate | Breaks as soon as full AIS traces are shown across many views |
| Recomputing heavy transforms in render code | Jank while switching modules or scenarios | Precompute offline and keep frontend transforms lightweight | Breaks when clustering or repair data gets denser |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Treating local file paths as harmless display text | Exposes messy or misleading internal provenance in the public UI | Normalize and curate provenance labels in manifests |
| Letting schema-less artifacts load into the site | Broken or misleading demo state from malformed files | Keep Zod validation at module boundaries |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Keeping the old log-heavy monitoring layout | Users cannot tell where each algorithm story lives | Promote overview and module-first navigation |
| Showing metrics without a corresponding visual example | Reviewers cannot connect numbers to behavior | Pair every metric table with map, chart, or trajectory evidence |
| Hiding scenario identity | Users do not know what time period or sample they are viewing | Keep scenario labels, time windows, and sample names visible |

## "Looks Done But Isn't" Checklist

- [ ] **Flow switching:** Often missing real data remapping - verify model and horizon switches change both visuals and metrics
- [ ] **Repair showcase:** Often missing ground-truth overlay - verify missing, repaired, and reference trajectories are all visible
- [ ] **Clustering showcase:** Often missing noise explanation - verify first-pass noise and re-clustering are both understandable
- [ ] **Decision showcase:** Often missing evidence traceability - verify every suggestion cites a focus route/grid and offline evidence
- [ ] **Overview:** Often still framed like a live system - verify archived replay and offline inference wording is explicit

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Raw notebook coupling | MEDIUM | Freeze a website-facing schema, write one exporter, update modules to read only packaged artifacts |
| Monolithic payload growth | MEDIUM | Split data by module/scenario, add manifests, measure load size again |
| Weak decision evidence | LOW | Introduce an intermediate rule bundle linking forecast and corridor signals to recommendation text |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Raw notebook coupling | Phase 6 | No module reads notebook-native structures directly |
| Overpromising live data | Phases 6 and 11 | Labels and overview copy explicitly say archived playback plus offline inference |
| Monolithic payload growth | Phase 6 | Module data loads are split and lazy |
| Weak decision evidence | Phase 10 | Each recommendation cites forecast or clustering evidence |
| Premature framework rewrite | Phase 6 | Roadmap and architecture keep the existing frontend stack |

## Sources

- Existing repo architecture and stack docs
- Audit of `demo-web/public/data`
- Audit of `代码依据` structure and current artifact gaps
- Current dashboard narrative and benchmark implementation

---
*Pitfalls research for: offline AIS algorithm showcase website*
*Researched: 2026-03-24*
