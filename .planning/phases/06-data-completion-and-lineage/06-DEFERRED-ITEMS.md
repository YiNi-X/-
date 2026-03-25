# Phase 6 Deferred Items

_Last updated: 2026-03-25_

These items were deliberately deferred instead of being silently fabricated or overwritten.

| Name | Why it is deferred | What depends on it later |
|---|---|---|
| `forecast-lstm-runtime` | The repo contains `LSTM.ipynb`, but no committed structured website-facing runtime export exists yet | Phase 8 multi-model switching and fair model comparison |
| `forecast-bilstm-runtime` | The repo contains `BILSTM.ipynb`, but no committed structured website-facing runtime export exists yet | Phase 8 multi-model switching and fair model comparison |
| `clustering-noise-reclustered` | `代码依据/轨迹聚类/normalized_distances(60,90,0.03).pkl` is unreadable, so the notebook-grade noise re-clustering path is not stable right now | Phase 10 advanced clustering comparison (`CLUS-03`) |
| `repair-optuna-study-export` | `代码依据/轨迹修复/study1_1.pkl` requires `optuna`, which is not available in the current local environment | Phase 11 optimization history and parameter-importance views (`EVAL-04`) |
| `decision-evidence-bundle` | The current research base does not yet support an honest collaborative-decision artifact set | Phase 12 collaborative decision module |

## Explicit Non-Decisions

- Phase 6 does **not** promote any regenerated corridor review output back into `demo-web/public/data/main-corridor-tracks.json`.
- Phase 6 does **not** ship placeholder LSTM/BiLSTM metric rows just to satisfy a UI control.
- Phase 6 does **not** claim that collaborative decision is implemented when only narrative placeholders exist.

## Re-entry Conditions

An item can leave this deferred list only when all three are true:

1. The upstream source artifact is committed and readable in the local environment.
2. The exported website-facing package can be regenerated without notebook-only manual state.
3. The resulting output passes the same manifest and verification rules used by the rest of Phase 6.
