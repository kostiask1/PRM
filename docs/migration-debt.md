# Migration Debt Register

This register records open work after the selective recovery of useful behavior
from accidental side commit `25b5ccc`. That commit is not part of the `fsd`
lineage and is not a migration baseline.

| ID | Status | Debt and evidence | Removal condition | Target |
| --- | --- | --- | --- | --- |
| MD-R02 | Planned | The configured application store still lives in strict `src/shared/model/appStore.ts`. The accidental commit's JavaScript store design is incompatible with the current typed reducers and consumers. | Design an app-owned composition root that injects lower-layer reducers/contracts, migrate consumers incrementally, and retain a typed public compatibility boundary until no longer needed. | Dedicated post-recovery phase |
| MD-R04 | Verification | Recovered campaign/reference lint restrictions are installed and Fallow reports zero boundary violations or cycles. Complete lint/typecheck execution is blocked by the incomplete local dependency tree: `@typescript-eslint/parser` and the `tsc` binary are absent. | Restore/install the declared development dependencies and pass the unchanged complete lint and typecheck gates. | Recovery R5 |
| MD-R05 | In progress | Phase 123 installed the exact importer-file → target-slice ESLint baseline for `src/features` and `src/widgets`; it rejects new edges, stale allowances, and private entries across every supported static module-reference form. Phase 124 removed the false `features/modal` ownership boundary and reduced features to 10 importer files / 12 directed pairs / 14 file edges / 18 declarations. Phase 125 completed the first widget-composition reduction: sole page-level owner `EncounterPage` now injects the required `ResponseModal` and `MonsterEditorModal` contracts into `BestiaryBrowser`, preserving its modal state, render placement/order, forwarded props, and nullable behavior while removing both sibling-widget imports. Widgets fell from 8 importer files / 13 directed pairs / 13 file edges / 13 declarations to 7 / 11 / 11 / 11; feature debt remains unchanged. Comment/literal-safe `npm test` source-inventory coverage stays active while complete lint remains `MD-R04`-blocked. | Review and lower the next bounded cluster in Phase 126 without preselecting its strategy, then continue cluster-by-cluster until same-layer ownership is explicit and no unapproved edge remains. | Phase 126 and later reduction phases |

The Phase 125 widget-composition reduction is complete at 411/411 tests;
`MD-R05` remains open for the measured feature and widget edges above.

## Closed recovery items

| ID | Resolution |
| --- | --- |
| MD-R01 | The full `npm test` gate now passes all 398 tests. Two stale aggregate source assertions were aligned with the Phase 119 presentation owner before the successful run. |
| MD-R03 | Campaign/session/archive mutation routes now validate before commands. Phase 121 clarified that archive `images` validation is strict only for the optional array container while individual rows remain restoration/storage-owned and tolerant; campaign entity movement also validates source type before body access while the command retains target/pair checks and exact errors. Focused contracts cover schema errors, route order, campaign/session guards, UTF-8 archives, and rejection before empty wipe-and-replace persistence. |
| MD-R05 / Phase 122 public-entry and entity scope | Closed at 405/405 tests. Shared `FSD_PUBLIC_API_PATTERNS` and synchronized `FSD_SLICE_NAMES` now apply to frontend JavaScript/JSX and TypeScript/TSX, reject root `./layer/slice/private` imports plus one-or-more-level sibling/cross-layer private paths, and permit only the root `index`, `ui/index`, Node-safe `model.js`, and page `graph.js` facades. The non-`src` ESLint override prevents backend names from being misclassified as frontend slices. All 10 audited private/deep imports use public entries, including the new minimal `features/campaign/index.js` plus `index.d.ts`. Fallow `autoDiscover` gives entities per-slice zones and entity sibling edges are zero. Reference preview/resolution orchestration moved to `features/rules-reference` behind its minimal Node-safe model facade, while the five reference cache/normalizer modules remain entity-owned and public. |
| MD-R05 / Phase 124 modal ownership | Closed at 410/410 tests. Generic modal behavior moved from the deleted `features/modal` slice to the public `shared/ui/Modal` boundary with private controller/view and Node-safe `modalModel.ts`; the store-backed global renderer moved to `app/ui/MessageBoxHost.tsx`, and the dead imperative modal API was removed. The synchronized feature catalog and exact baseline no longer contain `modal` or its 11 allowances. |
| MD-R05 / Phase 125 widget composition | Closed at 411/411 tests. `EncounterPage`, the sole `BestiaryBrowser` consumer, injects the required `ResponseModal` and `MonsterEditorModal` contracts through their public widget entries. The browser no longer owns the two sibling-widget imports, and the exact widget baseline is reduced to 7 importer files / 11 directed pairs / 11 file edges / 11 declarations without changing modal state, rendering, or null behavior. |

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
