# 07 Context

## Objective

Phase 7 turns the completed Phase 6 data layer into a usable website foundation.
This phase is not about finishing every module in depth. It is about making the frontend speak one consistent language to the new module bundles, then using that shared language to build the shell and baseline pages the later module phases will extend.

## Confirmed Scope

Phase 7 includes:
- frontend contracts for all committed Phase 6 module bundles
- module registry metadata and route descriptors
- shared loaders and lazy-loading behavior
- shared loading, error, empty, and deferred states
- website shell and navigation
- baseline pages for overview, forecast, repair, clustering, and evaluation
- one visible forward-looking analysis entry for collaborative decision, clearly marked as deferred

Phase 7 does not include:
- full forecast module interactions beyond the baseline page
- full repair module comparisons beyond the baseline page
- full clustering workflow visualizations beyond the baseline page
- optimization history deep integration
- completed collaborative decision logic

## Data Assumptions From Phase 6

Available now:
- `forecast` bundle is ready, but only STGCN is authoritative
- `repair` bundle is ready
- `clustering` bundle is ready for `raw / segmented / compressed / corridor` storytelling
- `evaluation` bundle is ready
- `overview` bundle is ready

Still deferred:
- forecast `LSTM/BiLSTM` structured runtime exports
- clustering noise re-clustering
- repair Optuna study export
- collaborative decision evidence package

## Phase 7 Decomposition

### 07-01 Contracts and Registry

Purpose:
Create the frontend contract boundary that every later module phase will depend on.

Must cover:
- typed schemas and contracts for each module bundle
- module registry built from `artifact-index.json`
- route descriptors and navigation metadata
- deferred-state semantics so incomplete data can be shown honestly instead of hidden or faked
- one clear loader contract shared by all module pages

### 07-02 Shared Loader and Shell Runtime

Purpose:
Implement the reusable runtime layer that discovers, validates, lazy-loads, and caches module data.

Must cover:
- shared loader utilities for module bundles and manifests
- lazy-loading behavior per module
- shared shell state for active module, loading state, error state, and deferred state
- shell-level fallback screens and status surfaces
- navigation that works before deep module pages are complete

### 07-03 Baseline Module Pages

Purpose:
Wire real data into the shell so every major module has a functioning baseline page before deeper feature phases begin.

Must cover:
- overview baseline page from the overview bundle
- forecast baseline page from the forecast bundle
- repair baseline page from the repair bundle
- clustering baseline page from the clustering bundle
- evaluation baseline page from the evaluation bundle
- forward-looking analysis placeholder for collaborative decision with explicit deferred messaging

## Locked Decisions So Far

### Information Architecture and Navigation

- The homepage remains an independent command-center homepage rather than collapsing into one of the module pages.
- The site should feel like a real product shell, not a linear presentation website or click-through PPT.
- Primary navigation should be horizontal at the top.
- The primary navigation order is: `home -> forecast -> repair -> clustering -> evaluation -> forward-looking analysis`.
- The homepage must retain the command-center tone while also making module entry points obvious.
- The homepage should contain both summary information and clear module entry affordances; users should not need to discover everything through hidden local controls.
- The forward-looking analysis entry should remain first-class in navigation, but it must be labeled as incomplete or under construction and should also explain that status on entry.
- The website should not force an explicit recommended demo sequence in the shell; evaluation committee members should be able to navigate freely.

### Shell Layout and Page Density

- Keep the homepage as a three-column control-screen composition instead of flattening it into a conventional overview page.
- Keep the center map and timeline as the homepage anchor because they preserve the strongest command-center identity.
- Rebuild both side rails around meaningful content instead of preserving their current low-value filler panels.
- The title area beneath the main platform title can be used for secondary shell content such as current scene, current module context, or lightweight switching cues.
- The left and right rails should both mix module entry points with key summaries rather than separating one side as pure navigation and the other as pure status.
- Homepage hover behavior may be used to preview a module, highlight a related map layer, or refresh a summary, but hover must never be the only way to access important content.
- Clicking should remain the primary way to enter a full module page.
- Module pages should use a medium-density layout: still professional and instrument-like, but easier to read than the current dense control wall.
- Shared shell elements across pages should include the top navigation and a persistent top status strip.

### Homepage Content Replacement Strategy

- Preserve the parts of the current homepage that already feel product-real: header shell, central map stage, timeline, focus card, hotspot or flow summaries, and runtime status framing.
- Replace low-value or placeholder-heavy panels such as the system log, observation feeds, and hardcoded benchmark cards with real module preview cards backed by Phase 6 bundles.
- The homepage should not hide every module behind a blank entry tile. Each module preview should expose at least one real headline metric and one short explanatory summary.
- Forecast should surface compact live-style summary values on the homepage, such as current total flow, next-window prediction, hotspot count, or model readiness.
- Repair should appear as a teaser card on the homepage, emphasizing curated samples and current best-performing method rather than full trajectory detail.
- Clustering should appear as a pipeline summary on the homepage, emphasizing raw-to-segmented-to-compressed-to-corridor progression and corridor counts.
- Evaluation should appear as a scoreboard-style preview on the homepage, emphasizing metric readiness and current top-ranked methods.
- Forward-looking analysis should appear as a visible placeholder in the shell and homepage framing, but it should remain honest about being deferred.

### Baseline Module Page Content

- Every Phase 7 module page should share one baseline structure: top summary band, one main visualization area, and one supporting metrics or explanation column.
- Homepage cards should prioritize the entry action first and use summary content as support rather than turning into text-heavy introductions.
- Module-page summaries should use data-backed summary bands rather than long prose blocks or large decorative preview images.
- Each module summary band should combine concise KPI cards, one clear takeaway sentence, and one product-style primary action such as `View Details`, `Compare Results`, or `View Trajectory`.
- The homepage may show lightweight previews for each module, but deeper comparisons, timelines, geometry, and detailed rankings belong on the module pages.
- Overview, forecast, repair, clustering, and evaluation should all appear as full module destinations even if some sub-capabilities are not yet complete.
- Unfinished sub-capabilities should not weaken the whole module entry in navigation or on the homepage; they should only be explained when the user reaches the relevant detail area or data-dependent section.

### Loading, Error, and Deferred States

- Module pages should load into their finished layout shape first, then fill content with skeleton states rather than replacing the whole page with a blank loader.
- Deferred or not-yet-connected features should use restrained product language such as `Not available in this version` or `This capability will be connected in a later update`.
- Real data failures should show a formal in-module error surface with clear recovery actions such as retrying the load or returning home.
- When most of a module is available but one sub-capability is not, the page should remain normal and only the affected section should explain the limitation.
- The homepage and primary navigation should continue to present the product as whole; deferred messaging belongs at the detailed section level instead of dominating the shell.

### Specific Ideas

- The homepage should act like a command center with entry-first module cards in the side rails and a live map stage in the center.
- Hover can enrich the homepage by highlighting related map layers or refreshing a preview summary, but the main interaction must still work through click entry.
- The forward-looking analysis area should feel intentionally reserved, not broken; the user should understand that it is part of the product direction and not yet fully connected.

### Deferred Ideas

- None. The discussion stayed inside the Phase 7 boundary and clarified how the shell and baseline module pages should behave.

## Delivery Standard

At the end of Phase 7, the website should already feel like a modular product shell, but not like every module is complete.
The success condition is:
- the shell is real
- the navigation is real
- the loaders are real
- the data is real
- the unfinished parts are still honestly marked unfinished

## Hand-off to Later Phases

- Phase 8 deepens forecast interactions on top of the Phase 7 forecast baseline page
- Phase 9 deepens repair interactions on top of the Phase 7 repair baseline page
- Phase 10 deepens clustering interactions on top of the Phase 7 clustering baseline page
- Phase 11 strengthens evaluation and overview presentation on top of the Phase 7 shell
- Phase 12 fills the forward-looking analysis area with collaborative decision once its evidence package is ready
