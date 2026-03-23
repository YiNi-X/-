# Technology Stack

**Analysis Date:** 2026-03-23

## Languages

**Primary:**
- TypeScript (~5.9.3) – front-end code under `demo-web/src/` (e.g., `demo-web/src/App.tsx`, `demo-web/src/RouteEditor.tsx`, `demo-web/src/main.tsx`, `demo-web/src/route-editor.tsx`) plus shared schema `demo-web/src/sharedContracts.ts` and bundler targets in `demo-web/vite.config.ts`.

**Secondary:**
- Python 3.10+ – data preparation scripts `demo-web/scripts/generate_first_version_data.py` and `demo-web/scripts/extract_main_corridors_from_clustered_ais.py` rely on `numpy`, `pandas`, `torch`, `scikit-learn`, `matplotlib`, and `Pillow` to convert raw AIS inputs at `代码依据/轨迹聚类/cleaned_ais.CSV`, `代码依据/轨迹聚类/compressed_segments(60,90,0.03).pkl`, `代码依据/流量预测/grid_mmsi_count（流量数据）.csv`, and `代码依据/流量预测/save/model_0.pt` into `demo-web/public/data/*.json`/`.csv`.

## Runtime

**Environment:**
- Node.js 18+ (required by `vite@8.0.0` in `demo-web/package.json` and `demo-web/vite.config.ts`, which run in ESM mode with native `node:url` helpers).

**Package Manager:**
- npm (`demo-web/package.json` and `demo-web/package-lock.json` manage dependencies).
- Lockfile: present (`demo-web/package-lock.json`).

## Frameworks

**Core:**
- React 19.2.4 / React DOM 19.2.4 (from `demo-web/package.json`) power the UI rendered by `demo-web/src/App.tsx`, `demo-web/src/RouteEditor.tsx`, and the entry roots `demo-web/src/main.tsx` and `demo-web/src/route-editor.tsx`.

**Testing:**
- Not detected (no test runner config or `*.test.*` files in `demo-web`).

**Build/Dev:**
- Vite 8.0.0 (`demo-web/vite.config.ts`) with `@vitejs/plugin-react` 6.0.0 for JSX/TSX transformation, multi-entry bundling (main page + `route-editor.html`), and relative base paths.
- ESLint 9-level stack (`demo-web/eslint.config.js` plus `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`) enforces TypeScript/React guidelines and ignores `demo-web/dist/`.

## Key Dependencies

**Critical:**
- `react` / `react-dom` 19.2.4 – UI foundation in `demo-web/src/`.
- `@vitejs/plugin-react` 6.0.0 – React integration defined in `demo-web/vite.config.ts`.
- `vite` 8.0.0 – orchestrates `npm run dev`, `npm run build`, `npm run preview`, and `npm run editor` from `demo-web/package.json`.

**Infrastructure:**
- `numpy`, `pandas`, `torch`, `matplotlib`, `scikit-learn`, `Pillow` – used by `demo-web/scripts/generate_first_version_data.py` and `demo-web/scripts/extract_main_corridors_from_clustered_ais.py` to turn AIS/flow/raw-track data into `demo-web/public/data/*.json/.csv` and `demo-web/analysis/*.json/.csv`.

## Configuration

**Environment:**
- `demo-web/vite.config.ts` sets `base: './'` and custom rollup inputs for `index.html` and `route-editor.html` so both entry points bundle relative assets.
- `demo-web/eslint.config.js` extends recommended configs for JS/TS/React, sets global ignore for `demo-web/dist/`, and wires `typescript-eslint`.
- `demo-web/tsconfig.app.json` and `demo-web/tsconfig.node.json` lock ES2023 targets, bundler module resolution, and strict lint checks for `src/` and `vite.config.ts`.

**Build:**
- `npm run build` inside `demo-web` runs `tsc -b && vite build` to emit `demo-web/dist/`, ready for `vercel.json`/`netlify.toml` deployment.

## Platform Requirements

**Development:**
- Node.js 18+ with `npm install` run in `demo-web` (highlighted by `vercel.json` `installCommand` and `netlify.toml` build base) to generate `demo-web/node_modules/`.
- Python 3.10+ plus `numpy`, `pandas`, `torch`, `scikit-learn`, `matplotlib`, `Pillow` to run `demo-web/scripts/generate_first_version_data.py` and `demo-web/scripts/extract_main_corridors_from_clustered_ais.py`.
- Raw data dependencies at `代码依据/轨迹聚类/cleaned_ais.CSV`, `代码依据/轨迹聚类/compressed_segments(60,90,0.03).pkl`, `代码依据/流量预测/grid_mmsi_count（流量数据）.csv`, and `代码依据/流量预测/save/model_0.pt` feed the scripts.

**Production:**
- `demo-web/dist/` served by Vercel (per `vercel.json`) or Netlify (per `netlify.toml`); static datasets in `demo-web/public/data/` (e.g., `demo-web/public/data/ais-playback.json`, `demo-web/public/data/flow-forecast.json`, `demo-web/public/data/dataset-catalog.json`, `demo-web/public/data/model-config.json`, `demo-web/public/data/shared-geometry.json`, `demo-web/public/data/main-corridor-tracks.json`) and `demo-web/public/static-port-map.jpg` ship with the bundle.

---

*Stack analysis: 2026-03-23*
