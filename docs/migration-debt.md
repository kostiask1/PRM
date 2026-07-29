# Migration Debt Register

This register records open work after the selective recovery of useful behavior
from accidental side commit `25b5ccc`. That commit is not part of the `fsd`
lineage and is not a migration baseline.

| ID | Status | Debt and evidence | Removal condition | Target |
| --- | --- | --- | --- | --- |
| MD-R02 | Planned | The configured application store still lives in strict `src/shared/model/appStore.ts`. The accidental commit's JavaScript store design is incompatible with the current typed reducers and consumers. | Design an app-owned composition root that injects lower-layer reducers/contracts, migrate consumers incrementally, and retain a typed public compatibility boundary until no longer needed. | Dedicated post-recovery phase |
| MD-R04 | Verification | Recovered campaign/reference lint restrictions are installed and Fallow reports zero boundary violations or cycles. Complete lint/typecheck execution is blocked by the incomplete local dependency tree: `@typescript-eslint/parser` and the `tsc` binary are absent. | Restore/install the declared development dependencies and pass the unchanged complete lint and typecheck gates. | Recovery R5 |
| MD-R05 | In progress | Phase 123 installed the exact importer-file → target-slice ESLint baseline for `src/features` and `src/widgets`; it rejects new edges, stale allowances, and private entries across every supported static module-reference form. Phase 124 removed the false `features/modal` ownership boundary and reduced features to 10 importer files / 12 directed pairs / 14 file edges / 18 declarations. Phase 125 removed two sibling-widget imports through page-owned composition. Phase 126 absorbed the redundant sole-consumer `widgets/spell-card` slice unchanged into private `widgets/spells-browser/ui/SpellCard.tsx`, deleting its public barrels, catalog entry, and stale lint allowance while preserving all rendering contracts. Phase 127 moved the Bestiary assistant and stat-block component slots to `EncounterPage`, removing two more sibling-widget imports while preserving render conditions and browser/content state ownership. Phase 128 moved campaign-entity modal card composition to `App`, removing the modal widget's sibling `campaign-entity-card` import while preserving resolver, state, branch, key, callback, and modal-flag contracts. The widget catalog remains at 11 slices, widget debt is now 4 importer files / 7 directed pairs / 7 file edges / 7 declarations, and feature debt remains 10 importer files / 12 directed pairs / 14 file edges / 18 declarations. Comment/literal-safe `npm test` source-inventory coverage stays active while complete lint remains `MD-R04`-blocked. | Audit and lower the next bounded cluster in Phase 129 without preselecting its strategy, then continue cluster-by-cluster until same-layer ownership is explicit and no unapproved edge remains. | Phase 129 and later reduction phases |

The Phase 128 app-owned campaign-entity modal composition reduction is complete at
414/414 tests;
`MD-R05` remains open for the measured feature and widget edges above.

## Closed recovery items

| ID | Resolution |
| --- | --- |
| MD-R01 | The full `npm test` gate now passes all 398 tests. Two stale aggregate source assertions were aligned with the Phase 119 presentation owner before the successful run. |
| MD-R03 | Campaign/session/archive mutation routes now validate before commands. Phase 121 clarified that archive `images` validation is strict only for the optional array container while individual rows remain restoration/storage-owned and tolerant; campaign entity movement also validates source type before body access while the command retains target/pair checks and exact errors. Focused contracts cover schema errors, route order, campaign/session guards, UTF-8 archives, and rejection before empty wipe-and-replace persistence. |
| MD-R05 / Phase 122 public-entry and entity scope | Closed at 405/405 tests. Shared `FSD_PUBLIC_API_PATTERNS` and synchronized `FSD_SLICE_NAMES` now apply to frontend JavaScript/JSX and TypeScript/TSX, reject root `./layer/slice/private` imports plus one-or-more-level sibling/cross-layer private paths, and permit only the root `index`, `ui/index`, Node-safe `model.js`, and page `graph.js` facades. The non-`src` ESLint override prevents backend names from being misclassified as frontend slices. All 10 audited private/deep imports use public entries, including the new minimal `features/campaign/index.js` plus `index.d.ts`. Fallow `autoDiscover` gives entities per-slice zones and entity sibling edges are zero. Reference preview/resolution orchestration moved to `features/rules-reference` behind its minimal Node-safe model facade, while the five reference cache/normalizer modules remain entity-owned and public. |
| MD-R05 / Phase 124 modal ownership | Closed at 410/410 tests. Generic modal behavior moved from the deleted `features/modal` slice to the public `shared/ui/Modal` boundary with private controller/view and Node-safe `modalModel.ts`; the store-backed global renderer moved to `app/ui/MessageBoxHost.tsx`, and the dead imperative modal API was removed. The synchronized feature catalog and exact baseline no longer contain `modal` or its 11 allowances. |
| MD-R05 / Phase 125 widget composition | Closed at 411/411 tests. `EncounterPage`, the sole `BestiaryBrowser` consumer, injects the required `ResponseModal` and `MonsterEditorModal` contracts through their public widget entries. The browser no longer owns the two sibling-widget imports, and the exact widget baseline is reduced to 7 importer files / 11 directed pairs / 11 file edges / 11 declarations without changing modal state, rendering, or null behavior. |
| MD-R05 / Phase 126 spell-card ownership | Closed at 412/412 tests. The redundant sole-consumer `widgets/spell-card` slice was absorbed unchanged into private `widgets/spells-browser/ui/SpellCard.tsx`; its public barrels, synchronized catalog entry, and stale same-layer allowance were deleted. The widget catalog is now 11 slices and the exact widget baseline is reduced to 6 importer files / 10 directed pairs / 10 file edges / 10 declarations without changing any spell-card rendering contract. |
| MD-R05 / Phase 127 Bestiary content composition | Closed at 413/413 tests. `EncounterPage` injects stable public `AiAssistantPanel` and `MonsterStatBlock` component symbols through `BestiaryBrowser` into private `BestiaryContent`. The content no longer owns those two sibling-widget imports, and the exact widget baseline is reduced to 5 importer files / 8 directed pairs / 8 file edges / 8 declarations. The overlay null guard, assistant mount position, stat-block detail guard, component identity, prop forwarding, state, and callback ownership remain unchanged. |
| MD-R05 / Phase 128 campaign-entity modal composition | Closed at 414/414 tests. `App` injects stable public `CharacterCard` and `LocationCard` component symbols through `CampaignEntityModalProvider` into its private card composition. The modal widget no longer owns the sibling `campaign-entity-card` import, and the exact widget baseline is reduced to 4 importer files / 7 directed pairs / 7 file edges / 7 declarations while the feature baseline and 11-slice widget catalog remain unchanged. Parent-resolver delegation, campaign/scope guards, entity state, card-plan branch and key, callback adapters, and all modal-card flags remain unchanged. |

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
