# Migration Debt Register

This register contains temporary architecture exceptions that remain after
Phase 8. Every entry needs observable evidence, a removal condition, and a
target phase. New compatibility adapters are not allowed unless added here.

| ID | Status | Debt and evidence | Removal condition | Target |
| --- | --- | --- | --- | --- |
| MD-001 | Open | Live code remains in legacy frontend folders: 45 files in `src/components` and 8 files in `src/utils`. `src/models`, frontend `src/hooks`, and frontend `src/services` are retired; app shell/router/provider/realtime paths, legacy Character/Location cards, generic helpers/hooks, shared interaction utilities, campaign graph models, localization, theme configuration, and campaign entity resolution are closed. | Move domain UI to owning slices and migrate the remaining note/entity-creation, dice, and rules/reference utilities to `shared` or their owning domain; update consumers and delete superseded files. | Phase 9.8 |
| MD-005 | Verification | The full `npm test` suite has not been executed in the current migration run; focused contracts, syntax checks, lint, encoding, architecture, and performance gates are green. | Run the full suite when authorization is available and resolve any failures without weakening boundaries. | Before merge |

## Closed Debt

| ID | Resolution |
| --- | --- |
| MD-C01 | Removed the frontend `src/api.js` compatibility facade after adding archive and settings domain APIs. |
| MD-C02 | Removed the production backend `server/storage.js` facade and prohibited legacy imports. |
| MD-C03 | Added a real `src/app` entry and moved the root component into the app layer, eliminating the empty app-zone warning. |
| MD-C04 | Moved global search into `widgets/global-search`, added native cancellation and bounded session fan-out, and removed its legacy component path. |
| MD-C05 | Moved Character, Location, and card-note models into the campaign entity model API and removed `src/models`. |
| MD-C06 | Migrated all Character/Location card consumers to the entity UI API with explicit higher-layer dependency injection and deleted both legacy adapters. |
| MD-C07 | Replaced the Bestiary AI-history fallback with a non-destructive, retryable canonical read-through migration and preservation contracts. |
| MD-C08 | Replaced the regression suite's backend compatibility barrel with direct owning-module imports and deleted `tests/support/backendTestFacade.js`. |
| MD-C09 | Distributed application actions and imperative commands to shared concern modules and owning entity/feature model APIs, then deleted `src/actions/app.js` and `src/services/applicationRuntime.js`. |
