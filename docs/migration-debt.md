# Migration Debt Register

This register records open work after the selective recovery of useful behavior
from accidental side commit `25b5ccc`. That commit is not part of the `fsd`
lineage and is not a migration baseline.

| ID | Status | Debt and evidence | Removal condition | Target |
| --- | --- | --- | --- | --- |
| MD-R02 | Planned | The configured application store still lives in strict `src/shared/model/appStore.ts`. The accidental commit's JavaScript store design is incompatible with the current typed reducers and consumers. | Design an app-owned composition root that injects lower-layer reducers/contracts, migrate consumers incrementally, and retain a typed public compatibility boundary until no longer needed. | Dedicated post-recovery phase |
| MD-R04 | Verification | Recovered campaign/reference lint restrictions are installed and Fallow reports zero boundary violations or cycles. Complete lint/typecheck execution is blocked by the incomplete local dependency tree: `@typescript-eslint/parser` and the `tsc` binary are absent. | Restore/install the declared development dependencies and pass the unchanged complete lint and typecheck gates. | Recovery R5 |
| MD-R05 | Planned | Public-entrypoint enforcement is not yet a complete symmetric TypeScript/TSX and JavaScript/JSX baseline, and same-layer slice imports are not isolated. The Phase 121 audit found 10 external deep imports plus 3 entity, 36 feature, and 13 widget cross-slice imports. `entities/reference/model` also composes sibling entity/API concerns instead of remaining an entity-owned model boundary. | Redirect the 10 deep imports through explicit slice barrels; move sibling reference loading/resolution orchestration into `features/rules-reference`; classify and remove or explicitly justify every same-layer dependency; then enforce the complete language-symmetric public API and slice-isolation rules with no unapproved violations. | Phase 122 |

## Closed recovery items

| ID | Resolution |
| --- | --- |
| MD-R01 | The full `npm test` gate now passes all 398 tests. Two stale aggregate source assertions were aligned with the Phase 119 presentation owner before the successful run. |
| MD-R03 | Campaign/session/archive mutation routes now validate before commands. Phase 121 clarified that archive `images` validation is strict only for the optional array container while individual rows remain restoration/storage-owned and tolerant; campaign entity movement also validates source type before body access while the command retains target/pair checks and exact errors. Focused contracts cover schema errors, route order, campaign/session guards, UTF-8 archives, and rejection before empty wipe-and-replace persistence. |

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
