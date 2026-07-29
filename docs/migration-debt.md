# Migration Debt Register

This register records open work after the selective recovery of useful behavior
from accidental side commit `25b5ccc`. That commit is not part of the `fsd`
lineage and is not a migration baseline.

| ID | Status | Debt and evidence | Removal condition | Target |
| --- | --- | --- | --- | --- |
| MD-R02 | Planned | The configured application store still lives in strict `src/shared/model/appStore.ts`. The accidental commit's JavaScript store design is incompatible with the current typed reducers and consumers. | Design an app-owned composition root that injects lower-layer reducers/contracts, migrate consumers incrementally, and retain a typed public compatibility boundary until no longer needed. | Dedicated post-recovery phase |
| MD-R04 | Verification | Recovered campaign/reference lint restrictions are installed and Fallow reports zero boundary violations or cycles. Complete lint/typecheck execution is blocked by the incomplete local dependency tree: `@typescript-eslint/parser` and the `tsc` binary are absent. | Restore/install the declared development dependencies and pass the unchanged complete lint and typecheck gates. | Recovery R5 |
| MD-R05 | Planned | Remaining same-layer debt after the closed Phase 122 public-entry/entity checkpoint: features have 22 directed slice pairs, 30 file edges, and 34 import declarations; widgets have 13 directed pairs, 13 file edges, and 13 declarations. Every measured edge uses a public entry, but no exact same-layer file-edge baseline is enforced yet. | Freeze these exact feature/widget file edges against growth, then eliminate the first dependency cluster and lower the baseline. Continue cluster-by-cluster until same-layer ownership is explicit and no unapproved edge remains. | Phase 123 and later reduction phases |

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
