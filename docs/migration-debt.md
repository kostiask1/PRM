# Migration Debt Register

This register records open work after the selective recovery of useful behavior
from accidental side commit `25b5ccc`. That commit is not part of the `fsd`
lineage and is not a migration baseline.

| ID | Status | Debt and evidence | Removal condition | Target |
| --- | --- | --- | --- | --- |
| MD-R02 | Planned | The configured application store still lives in strict `src/shared/model/appStore.ts`. The accidental commit's JavaScript store design is incompatible with the current typed reducers and consumers. | Design an app-owned composition root that injects lower-layer reducers/contracts, migrate consumers incrementally, and retain a typed public compatibility boundary until no longer needed. | Dedicated post-recovery phase |
| MD-R04 | Verification | Recovered campaign/reference lint restrictions are installed and Fallow reports zero boundary violations or cycles. Complete lint/typecheck execution is blocked by the incomplete local dependency tree: `@typescript-eslint/parser` and the `tsc` binary are absent. | Restore/install the declared development dependencies and pass the unchanged complete lint and typecheck gates. | Recovery R5 |
| MD-R05 | In progress | Phase 123 now enforces the remaining `src/features` and `src/widgets` dependencies as an exact importer-file → target-slice baseline through the local ESLint plugin in `scripts/eslint-import-boundaries.mjs`. It rejects new edges and stale allowances across static imports, re-exports, dynamic imports, `require`, TypeScript `import()` types, and external-module `require` references with static string/template literals. A separate all-`src` rule rejects private paths even for approved slice edges; relative and Vite-root `/src/...` specifiers plus Windows filenames are normalized, and comment/literal-safe `npm test` source-inventory coverage stays active while complete lint remains `MD-R04`-blocked. After replacing five plain editor `Input` dependencies with `shared/ui/TextInput`, features have 18 directed slice pairs, 25 file edges, and 29 declarations; widgets remain at 13 / 13 / 13. | Review and lower the next bounded dependency cluster in Phase 124, then continue cluster-by-cluster until same-layer ownership is explicit and no unapproved edge remains. | Phase 124 and later reduction phases |

The Phase 123 enforcement and first-reduction checkpoint is complete at 409/409
tests; `MD-R05` remains open for the measured feature and widget edges above.

## Closed recovery items

| ID | Resolution |
| --- | --- |
| MD-R01 | The full `npm test` gate now passes all 398 tests. Two stale aggregate source assertions were aligned with the Phase 119 presentation owner before the successful run. |
| MD-R03 | Campaign/session/archive mutation routes now validate before commands. Phase 121 clarified that archive `images` validation is strict only for the optional array container while individual rows remain restoration/storage-owned and tolerant; campaign entity movement also validates source type before body access while the command retains target/pair checks and exact errors. Focused contracts cover schema errors, route order, campaign/session guards, UTF-8 archives, and rejection before empty wipe-and-replace persistence. |
| MD-R05 / Phase 122 public-entry and entity scope | Closed at 405/405 tests. Shared `FSD_PUBLIC_API_PATTERNS` and synchronized `FSD_SLICE_NAMES` now apply to frontend JavaScript/JSX and TypeScript/TSX, reject root `./layer/slice/private` imports plus one-or-more-level sibling/cross-layer private paths, and permit only the root `index`, `ui/index`, Node-safe `model.js`, and page `graph.js` facades. The non-`src` ESLint override prevents backend names from being misclassified as frontend slices. All 10 audited private/deep imports use public entries, including the new minimal `features/campaign/index.js` plus `index.d.ts`. Fallow `autoDiscover` gives entities per-slice zones and entity sibling edges are zero. Reference preview/resolution orchestration moved to `features/rules-reference` behind its minimal Node-safe model facade, while the five reference cache/normalizer modules remain entity-owned and public. |

## Recovered without carrying old architecture

- Native cancellation and stale-request protection for Bestiary, spells,
  rules-reference, and campaign search reads.
- Bounded campaign session hydration (`6`) and result cap (`80`).
- Executable Bestiary, spells, campaign-search, and encounter performance
  budgets.
- API-backed campaign entity resolution split from its pure model.
- Rules-reference endpoints split from the spell client.
- Retryable, concurrent, non-destructive migration from legacy Bestiary
  AI-history storage to its canonical path; the legacy source is retained and
  live canonical writes share the migration operation queue.

## Recovery rule

Useful behavior from an off-branch commit is reimplemented against current FSD
owners and contracts. Whole-file copying, cherry-picking the side commit, or
restoring its stale JavaScript/backend layout is not an accepted shortcut.
