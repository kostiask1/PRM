# Architecture Migration Plan

This document is the source of truth for the incremental architecture migration. The project remains a working modular monolith throughout the migration; phases are completed through vertical workflows rather than a repository-wide rewrite.

## Status legend

- **Complete** — acceptance criteria are met and validation is green.
- **In progress** — actively being migrated; new code must follow the target rules.
- **Planned** — sequenced work that has not started.
- **Optional** — evaluate only after the structural phases are stable.

## Target architecture

Frontend dependency direction:

`app -> pages -> widgets -> features -> entities -> shared`

Backend dependency direction inside a domain module:

`http -> application -> domain`

Infrastructure implements ports required by application/domain code. Express, filesystem storage, Gemini, archives, and realtime transport stay at boundaries.

## Phase 0 — Baseline and guardrails

Status: **Complete**

Delivered:

- Fallow architecture zones and dependency-direction rules in `.fallowrc.jsonc`.
- `npm run check:architecture` for cycles and boundary violations.
- UTF-8/Ukrainian encoding validation remains part of lint.
- Transitional policy documented in `AGENTS.md`.

Acceptance criteria:

- No circular dependencies.
- No FSD boundary violations.
- Tests, lint, and encoding checks pass.

## Phase 1 — API ownership and transport separation

Status: **Complete**

Delivered:

- HTTP mechanics moved to `src/shared/api/httpClient.ts`.
- Domain clients created for campaigns, sessions, Bestiary, and spells.
- Use-case clients created for AI, backups, images, and settings.
- All production consumers migrated to their owning clients.
- Transitional `src/api.js` compatibility facade removed.
- Existing regression tests now mock the owning client instead of a global facade.

Follow-up rule:

- Add focused client contract tests when introducing non-trivial request construction or response mapping.

Acceptance criteria:

- No production import of `src/api.js`.
- Transport contains no domain endpoints.
- Every endpoint has one clear frontend owner.

## Phase 2 — Bestiary FSD pilot

Status: **Complete**

Delivered:

- Browser composition moved to `src/widgets/bestiary-browser`.
- Monster editing moved to `src/features/edit-monster`.
- AI monster editing/draft UI moved to `src/features/ai-edit-monster`.
- Bestiary API ownership moved to `src/entities/bestiary`.
- Rules reference uses its own lightweight creature list/detail view instead of embedding the complete Bestiary widget.
- Three Bestiary/AI/rules-reference import cycles removed.

Follow-up improvements belong to later phases: split the large Bestiary orchestration component by workflow and move stable monster presentation/model code into an entity slice.

## Phase 3 — Reference-data vertical slice

Status: **Complete**

Delivered:

- Spells, conditions, diseases, skills, senses, variant rules, creature previews, and rules-reference browsing now use owned domain clients.
- `MonsterStatBlock`, `Spells`, settings source selection, and reference preview no longer import the compatibility API facade.
- Rules-reference browsing uses `entities/spell` and `entities/bestiary` directly.
- Inline-tag parsing remains independent from React UI and API access.

Deferred intentionally:

- Introduce a dedicated reference-data entity/widget only when it provides clearer ownership than the current focused services. Avoid a speculative wrapper layer.

Acceptance criteria:

- Reference-data code does not import `src/api.js`.
- Rules-reference UI does not import page-level or Bestiary widget code.
- Parser and reference resolver regression tests pass.

## Phase 4 — AI workflow decomposition

Status: **Complete**

Delivered:

- Pure token-estimation and context-compaction logic moved to `src/features/ai/model/tokenEstimation.ts`.
- AI history change detection and retry-payload reconstruction moved to `src/features/ai/model/historyWorkflow.ts`.
- AI request-mode resolution, payload construction, and removal of heavy session data moved to `src/features/ai/model/generationRequest.ts`.
- Generation and retry lifecycle now uses the explicit request-aware state model in `src/features/ai/model/generationLifecycle.ts`; context loading remains separate.
- History upsert, campaign ownership, partial apply/undo mode, and restore synchronization planning moved to `src/features/ai/model/historyState.ts` with concurrency-safe functional updates in React.
- Delete, clear, apply, undo, and draft-save commands moved to `src/features/ai/model/historyCommands.ts`; the hook serializes restore commands with a ref-backed lock and exposes results through UI callbacks.
- Stable visual composition moved to `src/features/ai/ui`: `AiAssistantShell`, `AiPromptComposer`, and `AiHistoryResponseDialog` own modal plumbing and presentation while the panel supplies workflow state and callbacks. UI exports use `src/features/ai/ui/index.js`, keeping the model/API entry Node-compatible.
- Remaining AI-only toolbar, context settings, API-key, and history-list views moved from legacy `components/ai` into `src/features/ai/ui`.
- Context list normalization, nested scene defaults, item toggles, and bulk selection moved to `src/features/ai/model/contextConfig.ts`.
- Campaign entity/session loading, selected-session hydration, and context-list synchronization moved to `src/features/ai/model/useAiContextData.ts`; API operations are injected as ports and reused by image-prompt loading.
- Token-estimate request shaping, route-mode context assembly, list filtering, and attachment costs moved to the pure `src/features/ai/model/tokenEstimation.ts` model.
- NPC, location, scene/encounter, and custom-monster image target construction moved to `src/features/ai/model/imageTargets.ts`.
- Campaign session hydration, custom-bestiary normalization, loading state, and fetch caching for image prompts moved to `src/features/ai/model/useAiImagePromptData.ts`.
- Focused regression tests cover ignored context, mode selection, retry reconstruction, generated entity types, and campaign-change detection.
- `AiAssistantPanel` now consumes these feature model APIs instead of owning their implementations.
- Backend module extraction has started: pure campaign/session/encounter input shaping and ignored-content filtering moved from `server/aiService.js` to `server/modules/ai/application/buildPromptContext.js`.
- Deterministic input serialization and mode-specific task instructions moved to `server/modules/ai/application/buildUserPrompt.js`; `aiService` now supplies orchestration inputs instead of owning task branches.
- Gemini client/key caching, model configuration, multimodal request-part shaping, invocation, and response retrieval moved behind `server/modules/ai/infrastructure/geminiGateway.js` with an injectable factory for tests.
- Plain-text normalization, JSON fence/prose extraction, recursive escaped-newline repair, and invalid-response shaping moved to `server/modules/ai/application/parseAiResponse.js`.
- Base mode policies and conditional system contracts moved as one unit to `server/modules/ai/application/buildSystemInstruction.js`; `aiService` now passes resolved mode/options and receives the final instruction string.
- MIME/size validation, local image file resolution, base64 handling, text attachment rendering, and binary inline parts moved to `server/modules/ai/infrastructure/attachmentParts.js`.
- Effective parsing/mode selection, entity target scope, generation permissions, response language normalization, and requested-model fallback moved to `server/modules/ai/application/resolveAiRequest.js` with decision-table coverage.
- Shared generate-request validation, normalized paths, settings/base prompts, auto-apply policy, and route-facing generation flags moved to injectable `server/modules/ai/application/prepareGenerateAiRequest.js`.
- The first complete HTTP-independent generate use case, Bestiary image prompting and history persistence, moved to injectable `server/modules/ai/application/generateBestiaryImagePrompt.js`.
- Custom-monster generation, missing-ID normalization, selected-target context, optional campaign/session context, failure history, contract validation, and normal/encounter-local draft dispatch moved to `server/modules/ai/application/generateCustomMonster.js`.
- Campaign/session/encounter generation context, custom monster-name lookup, target completion, mention processing, validation, failure history, and flow persistence moved to `server/modules/ai/application/generateCampaignContent.js`.
- Configured campaign/session context loading now uses injected entity/session ports in `server/modules/ai/application/campaignContext.js`; current scene/encounter/custom-monster target completion moved to `fillCurrentTargetIds.js`.
- An explicit AI history repository port now lives at `server/modules/ai/application/ports/aiHistoryRepository.js`, with filesystem delegation in `server/modules/ai/infrastructure/fileAiHistoryRepository.js`; history CRUD and Bestiary-image writes consume the port.
- Draft history editing, nested ID preservation, entry lookup/not-found behavior, and apply/undo snapshot dispatch moved to `server/modules/ai/application/aiHistoryCommands.js`; HTTP routes now only map identifiers and resource selections.
- Top-level request preparation, generation workflow selection, and unexpected-failure history recovery moved to `server/modules/ai/application/generateAiRequest.js`; `/generate` now only maps HTTP input/output/errors.
- Gemini API-key validation and cache invalidation moved to `server/modules/ai/application/saveGeminiApiKey.js`, with `.env` and process-environment persistence isolated in `server/modules/ai/infrastructure/envApiKeyStore.js`.
- The AI HTTP composition root moved to `server/modules/ai/http/router.js`, and the parsed-operation schema contract moved to `server/modules/ai/domain/aiPayloadSchemas.js`; legacy paths remain compatibility re-exports for existing mounts/imports.
- Mention candidate collection and operation text-field canonicalization moved from the HTTP router to `server/modules/ai/application/mentionProcessing.js`; smart apostrophe normalization now uses an encoding-safe Unicode escape.

Frontend scope:

- Split `AiAssistantPanel` into context selection, prompt editing, generation, history, draft review, apply/undo, and image-prompt workflows.
- Replace boolean combinations with explicit workflow statuses.
- Keep campaign/session/bestiary adapters outside reusable AI workflow UI.

Completion evidence:

- `server/modules/ai/{domain,application,infrastructure,http}` contains the domain contract, independently tested use cases, filesystem/Gemini adapters, and HTTP composition root.
- Generation, history draft/apply/undo, request preparation, prompt/context construction, response parsing, and API-key use cases have fake-driven tests that require neither Gemini nor real campaign files.
- AI HTTP handlers map request values and `{ status, body }` command results; workflow selection, persistence, validation, and recovery live outside Express handlers.
- Parsed-operation schema and apply/undo regression coverage passes with the full suite, while Fallow reports zero cycles, boundary violations, unresolved imports, or dead-code findings.

Backend scope:

- Create `server/modules/ai/{domain,application,infrastructure,http}`.
- Split context collection, prompt construction, Gemini invocation, response parsing, validation, history, apply, and undo.
- Introduce explicit ports for Gemini and AI history persistence.

Acceptance criteria:

- AI use cases can be tested without Gemini or real campaign files.
- Route handlers only map HTTP requests/responses.
- Parsed-operation schema and apply/undo behavior remain regression-tested.

## Phase 5 — Campaign, session, and encounter slices

Status: **Complete**

Current checkpoint:

- Campaign character/NPC/location create/update/delete now delegates through `src/features/campaign-entity`, removing direct CRUD calls and the legacy create utility from page-level callers.
- Backend CRUD defaults, type validation, stable ID/slug preservation, mention updates, and deletion now live in `server/modules/campaign/application/campaignEntityCommands.js` over an explicit repository port and filesystem adapter.
- Debounced campaign entity persistence, pending update ownership, flush/discard, and per-entity timer cancellation moved from `useCampaignView` to `src/features/campaign-entity/model/useCampaignEntityPersistence.ts`; pending writes retain their originating campaign slug.
- Optimistic changes, collapse persistence, rename confirmation and mention updates, deletion, and reload-on-error for all three campaign entity collections moved to `useCampaignEntityCollection`; `useCampaignView` now wires campaign-specific callbacks instead of implementing three workflows.
- Character/NPC type movement, pending-write flushing, optimistic collection transfer, entity ordering, one-shot reorder undo tracking, persistence, and reload-on-error moved to `useCampaignEntityOrdering`.
- NPC/location movement between campaign and session scope now uses one backend application command over an explicit cross-scope repository port. It preserves entity IDs, compensates partial filesystem writes, and replaces the previous two-request UI transaction.
- Scope import state, confirmation orchestration, pending-session-save flushing, mutation requests, and refresh notifications moved to `useCampaignEntityScopeMovement`.
- Session and scene mutation rules now live in `src/features/session-editor/model/sessionMutations.ts`; `useSessionEditing` owns scene/note editing and linked-encounter removal orchestration.
- Debounced session persistence, flush/discard, rename notification, failure propagation, and unmount flushing moved to `useSessionPersistence`. Undo/redo snapshots and AI replacement history moved to `useSessionHistory`.
- Encounter creation and scene linking now use an idempotent backend application command with server-generated IDs over the new `SessionRepository` port. The frontend `useEncounterCreation` workflow flushes session edits, creates or resolves the link, updates local state, and navigates.
- Encounter edits now use a focused backend update command instead of client-side session read/modify/write. `useEncounterPersistence` owns debounce state, pending writes, unmount flushing, and refresh notifications.
- Custom Bestiary participant synchronization and campaign character/NPC image sourcing now live in `useEncounterParticipantSynchronization`. Pure merge rules preserve combat instance IDs, display names, bounded current HP, and exclude official monsters and character participants.
- Campaign, session, encounter, and modal callers now use feature clients for entity mutations. Phase 5 is complete; Phase 6 continues repository extraction behind the established application commands.

Migrate one complete workflow at a time:

1. Campaign entity create/edit/delete.
2. NPC/location scope movement. **Completed.**
3. Session and scene editing. **Completed.**
4. Encounter creation, linking, and persistence. **Completed.**
5. Encounter participant synchronization with custom Bestiary monsters. **Completed.**

Acceptance criteria:

- IDs and scope rules stay stable.
- Persistent state is server-owned; workflow state stays feature-local.
- Hooks stop acting as page-wide service locators.
- Each migrated workflow has domain/application tests.

## Phase 6 — Backend repositories and storage decomposition

Status: **Complete**

Current checkpoint:

- `SessionRepository` now owns session existence, listing, reads, atomic writes, deletion, rename, default creation, name sanitization, unique file naming, and ID generation through its filesystem adapter.
- Session list/create/get/update/delete/reorder behavior moved to `server/modules/session/application/sessionCommands.js`, including stable IDs, rename semantics, default dates/order, 404 handling, and reorder validation.
- `server/routes/sessions.js` is now an HTTP adapter only; it no longer constructs session paths, reads/writes JSON, renames files, or deletes files directly.
- Session, entity-scope, scene-encounter, and encounter-update commands share repository-backed persistence through explicit ports.
- `CampaignRepository` now owns campaign metadata existence/read/write, initialization, rename, deletion, image checks, export delegation, unique slugs, image-reference replacement, and ignored-source normalization.
- Campaign lifecycle and ordering moved to `campaignCommands`; bulk entity replacement and character/NPC movement moved to `campaignEntityCommands`. Campaign and entity IDs remain stable across updates and moves.
- `server/routes/campaigns.js` is now an HTTP-only adapter with no direct storage calls.
- `BestiaryRepository` now owns the mutable custom-monster index, custom collection, and favorites persistence. Search, favorite toggling, full replacement, rename/image updates, duplicate validation, favorite rename/removal, and deletion moved to `bestiaryCommands`.
- Custom monster replacement continues to preserve token images when omitted and keeps legendary actions on the monster object.
- Bundled `all.json` reads, source discovery, direct/`bestiary-` filename fallback, source filtering, and legendary-group reads now use `BestiaryRepository`; copy-chain and array-mod resolution live in `bestiaryCommands`.
- `server/routes/bestiary.js` is now an HTTP/cache-header adapter with no filesystem, path, JSON, or direct storage operations.
- `SettingsRepository` and `settingsCommands` now own normalized settings reads/patches; `server/routes/settings.js` is HTTP-only.
- `ImageRepository` now owns upload directories, UTF-8 filename decoding, collision-safe names, gallery reads/search/stats, readonly token reads, subcategories, rename/move/delete, and the underlying image-reference updates. `server/routes/images.js` contains no path or filesystem operations.
- `ReferenceRepository` now owns aggregate/index/source spell files plus conditions, diseases, variant rules, skills, and senses. Search, source filtering, fallback, deduplication, and XPHB/XDMG precedence moved to `referenceCommands`; `server/routes/spells.js` is HTTP-only.
- `BackupRepository` and `backupCommands` now own full/partial exports, gzip serialization, uploaded archive parsing, append/replace-by-ID/wipe strategies, campaign-only imports, and archive persistence delegation. `server/routes/backups.js` only maps HTTP, multipart buffers, and download headers.
- Static image/token directories are resolved by the assets infrastructure adapter rather than the route.
- A global route audit confirms no `server/routes/*.js` file constructs filesystem paths or calls JSON/filesystem storage primitives. Phase 6 is complete.

Introduce focused repositories over the existing filesystem storage:

- `CampaignRepository`
- `SessionRepository`
- `EntityRepository`
- `BestiaryRepository`
- `ImageRepository`
- `AiHistoryRepository`
- `SettingsRepository`

Initially, adapters may delegate to `server/storage.js`. Move implementation only after callers depend on repository contracts, then remove obsolete storage exports.

Acceptance criteria:

- Routes do not construct filesystem paths or manipulate JSON files directly.
- Path normalization and atomic UTF-8 JSON writes remain centralized.
- Archive/import and image-reference behavior remains covered by regression tests.

## Phase 7 — Shared UI and legacy-folder retirement

Status: **Completed**

Initial legacy inventory:

- `src/components`: 70 files
- `src/hooks`: 5 files
- `src/models`: 7 files
- `src/services`: 11 files
- `src/utils`: 31 files

Current checkpoint:

- The complete image-gallery workflow moved to `src/features/images`: `ImageGallery`, `ImageTargetSettings`, `ImageDropzone`, `ImageAssetField`, and `useImageGallery`.
- Legacy image UI/hook files were removed; external consumers import only from `features/images/index.js`, while slice internals use relative imports.
- Generic presentation primitives `Panel`, `Notification`, and `Switch` moved to `shared/ui` and are consumed through its public index. Their legacy files were removed.
- Generic `Button`, `Icon`, and `Tooltip` joined the shared UI foundation; all callers were migrated through `shared/ui/index.js`.
- Generic `Checkbox`, `Select`, and `MultiSelect` moved to `shared/ui`; app-coupled `Input` and `EditableField` remain outside shared until their store/entity dependencies are separated.
- `classNames` moved completely to `shared/lib`; all callers use its public index and the legacy compatibility export was removed.
- Generic note-state helpers moved from `utils/noteUtils` to `shared/lib`; campaign character/location card models and their note-model base moved to `entities/campaign/model` behind the campaign entity public API.
- `CharacterCard` and `LocationCard` moved to the `campaign-entity-card` widget because they compose entity models with image/editor features and app-aware UI. Consumers use only the widget public API; their legacy component paths are retired.
- Character/location creation modals also live in `campaign-entity-card`: their submit rules remain in `features/campaign-entity`, while the widget owns composition with the card UI and modal shell.
- Pure spell presentation logic (`SpellCardModel`) moved to `entities/spell/model`; rich rendered `SpellCard` composition moved to `widgets/spell-card`. Both are consumed through their slice public APIs and the legacy paths are retired.
- Pure monster stat-block derivation moved from the legacy models directory to `entities/bestiary/model` and is exposed only through the bestiary entity public API.
- `CampaignViewModel` and `SessionViewModel` moved to their respective entity model segments. The generic `idsEqual` helper moved to `shared/lib`, allowing the legacy `src/models` directory to be fully retired.
- Generic `useDebounce` moved to `shared/lib` and all feature/widget/component consumers use the shared public API; its legacy hook path is retired.
- Campaign screen composition moved to `pages/campaign`: `CampaignPage` owns the former `CampaignView` UI and its orchestration hook, while `MainContent` imports only the page public API. Legacy component/hook paths are retired.
- Session screen composition moved to `pages/session`: `SessionPage` owns the former `SessionView` UI and orchestration hook, with `MainContent` consuming its public API and legacy paths retired.
- Encounter screen composition moved to `pages/encounter`: `EncounterPage` owns the former `EncounterView` UI and orchestration hook. This retires the legacy `src/hooks` directory completely.
- The embedded spells reference browser moved from `components/Spells` to `widgets/spells-browser`; the rules-reference modal consumes only its public API, while individual spell cards remain in the lower `spell-card` widget.
- Rich `MonsterStatBlock` composition moved to `widgets/monster-stat-block`; the pure derivation model remains in `entities/bestiary`, and all AI, encounter, rules-reference, and bestiary consumers use the widget public API.
- Pure dice parsing, rolling, and probability distribution moved to `shared/lib`; interactive `RollDice`, `DiceCalculator`, and probability modal UI moved to `features/dice`. Consumers use public indexes and all former component/utility paths are retired.
- Rules reference link/preview behavior and the navigation-opening command live in `features/rules-reference`. Modal composition lives in `widgets/rules-reference-modal`, while `widgets/monster-editor-modal` injects reference content into `features/edit-monster`; no feature imports the widget layer.
- The edit-monster feature now receives rules-reference content through an injected component. `widgets/monster-editor-modal` owns the feature/widget composition, and `RulesReferenceModalContent`/host moved to `widgets/rules-reference-modal`; the former feature-to-widget dependency and legacy modal paths are removed.
- Dependency-safe `ListCard`, `CollapseToggleButton`, and `DraggableList` moved to `shared/ui`; all consumers use the shared public API and their former common-component paths are retired.
- Entity-link identity, contexts, inline rendering, modal resolution, and opening behavior moved to `features/entity-link`. Campaign-specific modal rendering moved to `widgets/campaign-entity-modal` because it composes character/location card widgets.
- The app-aware modal shell and global message box moved to `features/modal`; it remains above shared UI because it owns localized prompt/input behavior and store-backed message orchestration.
- AI attachment controls moved into `features/ai/ui`; AI prompt, image-prompt, and monster-AI consumers now use feature-local or public AI imports instead of reaching into legacy components.
- Widget-heavy AI response rendering moved to `widgets/ai-response-modal`. AI history and bestiary draft features receive the response component through injection, eliminating feature-to-widget dependencies; page/widget callers own the composition.
- AI assistant orchestration and image-prompt picker composition moved to `widgets/ai-assistant`; it composes AI feature UI/model APIs with entities, app state, and the AI response widget. Main content and Bestiary use its public API.
- Session-only scene field/header/media and todo item/section components moved under `pages/session/ui/components`; they remain private page implementation details and their former legacy paths are retired.
- Campaign notes graph and partial archive modal moved into private `pages/campaign/ui/components`. Cross-page global campaign search moved to `widgets/campaign-search` and is consumed through its public API by campaign/session pages.
- Route composition and empty-state project guide moved into `app/routing`; navigation/sidebar composition moved to `widgets/sidebar` and is consumed through its public API by the app root.
- Theme switching and settings modal UI moved into `features/settings/ui`; the API barrel remains model-safe, while browser consumers use the UI public entrypoint.
- App-aware input, rich editable field, and mention-picker modal content moved into `features/editor/ui`. The modal prompt now uses a plain styled native input, removing the modal↔editor feature cycle.
- Note card editing, AI-ignore controls/list props, and bulk collapse behavior moved into `features/notes/ui`; pages and composed card/response widgets use the note UI public entrypoint.
- The final legacy components moved to behavior-specific features: clipboard feedback, status badge, encounter monster insertion, campaign creation, and player questions. `src/components` now contains no production files and is fully retired.
- Cross-domain JSON guards, download helpers, byte formatting, and deep object search moved from `src/utils` to `shared/lib`; consumers use the shared public index.
- Navigation URL/event helpers, DOM target navigation, and undo/redo transitions moved from `src/utils` to `shared/lib`; consumers use the shared public index and their former paths are lint-blocked.
- Monster type normalization and bestiary search matching moved to `entities/bestiary/model` and are exposed through the bestiary entity public API; the legacy utility path is retired.
- Encounter participant identity, HP derivation, and instance creation moved to `entities/encounter/model` behind `entities/encounter/index.js`; page and editor features no longer depend on a legacy utility.
- Campaign graph projection and deterministic layout moved to the campaign page model. The Node-safe `pages/campaign/graph.js` entrypoint supports the page UI and regression tests without loading the page's React entrypoint.
- AI attachment validation, diff construction, model-option loading, and response-resource helpers moved to `features/ai/model` behind the Node-safe feature public API. The model loader now depends directly on the feature API adapter instead of importing its own barrel.
- Condition/disease/skill/sense/variant-rule caches, reference previews, and input resolvers moved from legacy services and compatibility utilities into `entities/reference/model`. Browser consumers use `entities/reference/index.js`; Node regression tests use `entities/reference/model.js` so the browser-only JSON source catalog is not evaluated.
- Content-token parsing, 5eTools tag preprocessing, source labels/filtering, and spell metadata also moved into the reference entity. Generic search highlighting moved to `shared/ui`.
- Mention boundary behavior and picker orchestration moved into `features/editor/model`, exposed through the Node-safe `features/editor/model.js` entrypoint.
- Campaign entity display-name lookup and async resolution moved into `entities/campaign/model` behind the campaign entity API. Theme constants/application moved to `features/settings/model`.
- Localization moved to `shared/lib`, while WebSocket reconnect and data-refresh orchestration moved to `app/realtime`. The legacy `src/services` tree is now fully retired.
- Global action contracts, action creators, external-store state, React selectors, modal request coordination, and navigation commands moved together into `shared/model`. This dependency-safe owner is reachable by every FSD layer without upward imports; consumers use `shared/model/index.js`. The legacy `src/actions` and `src/store` trees are retired.
- Interactive recursive content rendering moved to `features/rich-content`, where composition of dice, rules-reference, and entity-link controls has an explicit owner. Token extraction and tag preprocessing remain in `entities/reference`; consumers use the feature public API and `src/renderers` is retired.
- Shared HTTP transport is exposed through `shared/api/index.ts`; domain API adapters no longer deep-import its implementation.
- ESLint rejects deep image/shared imports and retired image/primitive paths.
- Legacy counts are now 0 component files, 0 hook files, 0 model files, 0 utility files, 0 service files, 0 action files, 0 store files, and 0 renderer files. The legacy `src/components`, `src/hooks`, `src/models`, `src/utils`, `src/services`, `src/actions`, `src/store`, and `src/renderers` trees are retired.

- [x] Move only truly generic controls into `shared/ui`.
- [x] Move domain-aware cards and models into entity slices.
- [x] Retire legacy frontend paths as their final owners migrate.
- [x] Tighten Fallow zones so legacy-to-FSD exceptions disappear.

Acceptance criteria:

- No generic dumping-ground directories.
- Cross-slice imports use public `index.js` APIs.
- Legacy folders contain no production code.

## Phase 8 — TypeScript at contracts

Status: **In progress**

Start only after module ownership stabilizes. Prioritize API contracts, AI operation schemas, repository ports, identifiers, and workflow events. Do not combine TypeScript conversion with domain moves in the same change unless required by that slice.

Current checkpoint:

- Added a strict, no-emit TypeScript configuration and an explicit `npm run typecheck` gate.
- Added TypeScript-aware ESLint parsing and recommended rules without weakening the existing JavaScript checks.
- Converted the stable AI generation lifecycle contract to TypeScript. State/status types and the discriminated start/retry/finish/reset event union now compile alongside the existing reducer regression tests.
- Added a shared numeric `RequestId` contract and applied it to AI workflow events.
- Converted URL parsing/building and modifier-event handling to TypeScript with explicit campaign slug, session filename, encounter ID, parsed-route, and modifier-event contracts. Runtime navigation behavior remains covered by the existing tests.
- Added discriminated TypeScript contracts for AI operation kinds, entity aliases, scopes, targets, note operations, generated-content envelopes, validator options, and validation errors. A declaration file types the existing CommonJS validator while the JavaScript validator remains the runtime authority.
- Extracted modal open/close constants and creators into a typed workflow module with explicit modal configuration, request payload, and action unions.
- Extracted rules-reference navigation/history actions into TypeScript with typed request IDs, navigation options, navigation requests, history entries, and a discriminated action union. The legacy action barrel remains a runtime-compatible public facade.
- Extracted mention-picker actions with typed callback/request envelopes and request IDs.
- Extracted generic dice request/result actions with typed generic payload envelopes and stable request/result IDs.
- Extracted message-box actions and promise-returning thunks with explicit alert/confirm payloads, resolver callbacks, dispatch contracts, and action unions.
- Converted all remaining navigation, active campaign/session/encounter, campaign reload, language, UI-settings normalization, entity refresh, and realtime-sync actions into a focused typed module. `actions.js` is now only a compatibility facade over typed workflow modules.
- Added a typed global state contract composed from the workflow action payloads, including modal, mention, dice, navigation, active entities, campaigns, localization, UI settings, sync, and rules-reference history.
- Added declarations for the existing JavaScript store public API: typed selectors, overloaded dispatch/thunks, modal promises, rules navigation, router integration, and navigation commands. The reducer implementation remains JavaScript until its domain-shaped state can migrate without broad `any` types.
- Migrated the localization, normalized UI-settings merge, and realtime-sync reducer cases into a strict TypeScript reducer section. The JavaScript store delegates to it before handling the remaining domain-shaped cases.
- Migrated modal, mention-picker, dice, message-box, and rules-reference navigation/history reducer cases into a strict workflow reducer using the discriminated action union.
- Migrated entity refresh, route synchronization, campaign collection/reload, and active campaign/session/encounter reducer cases into a strict navigation-state reducer. Unknown domain objects are inspected through narrow property readers rather than `any`.
- The JavaScript store reducer is now only a typed reducer pipeline with unchanged fallback semantics; state transition logic no longer lives in its untyped switch.
- Converted the remaining store infrastructure to TypeScript: initial state, listener registry, typed action/thunk dispatch overloads, language normalization, modal resolver map, React external-store selectors, rules-reference commands, router adapter, and browser history navigation.
- Removed the temporary `appStore.d.ts`; the strict implementation now owns its public types directly. Added React type declarations required by the typed hook surface.
- Added settings and session repository-port declarations, precise filesystem adapter contracts, and application-command payload/result contracts. Existing runtime port factories still enforce required methods.
- Converted shared HTTP transport to TypeScript with generic JSON results, blob responses, sync-client header state, and structured HTTP errors. Converted the settings API client to a focused typed payload boundary and exposed transport through a typed shared API barrel.
- Completed TypeScript contracts for every backend repository port: campaign lifecycle, campaign entities and scope movement, Bestiary, images, backups, reference data, settings, sessions, and AI history. Filesystem/HTTP/archive values remain runtime-validated at their trust boundaries.
- Converted the Bestiary pilot API client to TypeScript with focused monster, favorite, source, legendary-group, mutation, and search result contracts while retaining its entity public barrel.
- Converted campaign/entity, session/encounter, and spell/reference API clients to TypeScript. Their public entity barrels remain the only supported import surface, while request payloads and response envelopes now capture stable IDs, archive results, scope moves, encounter persistence, and reference searches.
- Converted image-gallery and backup feature clients to TypeScript with filesystem location, asset, storage-statistics, move/delete, archive-mode, and import-strategy contracts.
- Converted the AI client to TypeScript with model discovery, history entries/resources/stats, draft and restore payloads, API-key persistence, generation options, and response envelopes. No frontend API client remains as untyped JavaScript.
- Applied the AI client contracts to model discovery, history resource inspection, retry-payload construction, restore planning, command services, and React history orchestration. Nullable transport responses are handled explicitly, and callback/restore-mode contracts no longer rely on implicit JavaScript shapes.
- Added the frontend discriminated AI operation contract and applied it to campaign-change inspection. Converted generation request construction and AI response/history helpers to TypeScript with typed context sanitization, request modes, change summaries, monster draft updates, route visibility, and a declaration boundary for the still-JavaScript line-diff algorithm.
- Converted the AI line-diff engine to TypeScript and removed its temporary declaration. Snapshot narrowing, granular session/custom-monster expansion, field summaries, and line metadata now compile strictly; a focused regression test covers parent resource IDs and added/removed line output.
- Converted AI attachment utilities, image-prompt target builders, and context-list configuration to TypeScript. MIME allowlists, attachment identity, file reading, entity/scene/encounter target shapes, generic context item keys, immutable nested updates, and scene defaults now have explicit contracts; existing feature-model coverage now also verifies frontend MIME and identity behavior.
- Converted AI token estimation to TypeScript with explicit mode, note/entity/session/scene compaction, context-list filtering, attachment, request-shape, and estimate-result contracts. The existing approximation constants and Cyrillic/Latin/file/image calculations remain behaviorally unchanged and regression-covered.
- Converted image-prompt data loading and campaign context loading to TypeScript. Async loader dependencies, nullable API results, session/entity collections, loaded-session tuples, cancellation, and React state contracts are explicit. Restored and regression-locked the unchanged-list reference identity used to suppress redundant context state updates. No JavaScript file remains in `src/features/ai/model`.
- Converted the encounter participant model, session view projection, and spell-card formatter to TypeScript. Monster HP/AC variants, stable participant identity, character projections, session notes/scenes/encounters, spell time/range/components/duration, translation callbacks, and permanent-duration rules now have entity-owned contracts. A narrow declaration bridge keeps the session model on the shared public utility barrel.
- Converted rules-reference navigation, theme application, and Bestiary search/type normalization to TypeScript. Navigation options remain behind the shared model public barrel, theme values are narrowed to light/dark with DOM-safe application, and monster type choices/tags have entity-owned search contracts. Added a complete declaration facade for the shared model barrel and a theme normalization regression test.
- Converted `MonsterStatBlockModel` to TypeScript, completing the Bestiary entity model layer. Official/custom and legacy monster shapes now cover HP, AC, speed, size, alignment, structured types/tags, abilities, saves, skills, languages, challenge rating, actions, and nested damage defenses without weakening runtime fallbacks.
- Converted the entity-link identity and modal-resolution model pair to TypeScript. Entity identity precedence, scope-aware equality, current-modal suppression, injected session resolution, and campaign fallback behavior now have explicit contracts; the Node-safe JavaScript model barrel remains the compatibility entrypoint.
- Converted the complete campaign entity model layer to TypeScript: entity lookup/resolution, campaign view projection, shared card-note mutations, and character/location card derivation. The public JavaScript barrel remains runtime-compatible, while its declaration facade now re-exports the owning TypeScript contracts instead of duplicating them.
- Converted the editor mention model layer to TypeScript. Lexical selection/node boundaries, zero-width marker insertion, keyboard-event handling, picker dispatch, and the selected/cancelled result union now compile strictly while the Node-safe JavaScript model barrel remains stable.
- Converted the pure session-editor mutation core to TypeScript. Scene/note/resource IDs, immutable session updates, encounter cleanup, note materialization/sanitization, collapse transitions, and updater callbacks now have feature-owned contracts; React persistence/history hooks remain separate migration slices.
- Converted encounter participant synchronization to TypeScript. Custom payload envelopes, entity image identity, participant/local-combat fields, synchronization results, custom-only refresh rules, and entity-owned participant inputs now have explicit contracts. Four internal normalization/merge helpers were removed from the public feature surface.
- Converted the complete reference entity model layer to TypeScript: condition/disease/skill/sense/variant caches, previews and resolvers, content-token extraction, tag preprocessing, source filtering/names, and spell metadata. Typed public facades preserve both the browser entrypoint and the JSON-free Node entrypoint; nullable API collections now normalize safely at this trust boundary.
- Converted the complete campaign-entity feature model to TypeScript. Create/update/delete ports, payload sanitization, debounced pending writes, optimistic collection changes, mention-aware rename recovery, reorder undo tracking, character/NPC movement, and campaign/session scope movement now share feature-owned contracts behind the existing JavaScript public facade.
- Converted the complete session-editor feature model to TypeScript. Editing commands, delayed and immediate save lifecycles, flush/discard semantics, rename notifications, pending-save detection, undo/redo snapshots, history-application suppression, and external session replacement now share feature-owned contracts behind the existing JavaScript facade.
- Converted the complete encounter-editor feature model to TypeScript. Existing-link navigation, server-created encounter validation, pending session flush, encounter persistence/debounce, unmount flushing, campaign participant image loading, custom Bestiary synchronization, realtime version guards, and selected participant preservation now share feature-owned contracts behind the JavaScript facade.
- Converted the complete image-gallery model to TypeScript and typed its category configuration. Gallery source/category/subcategory paths, content scopes, official/read-only assets, storage statistics, selection and move groups, file uploads, drag/drop events, and mutation results now have feature-owned contracts behind the existing JavaScript public facade. Nullable HTTP collections, unknown errors, modal results, and parsed drag payloads are handled explicitly.
- Converted the encounter page model to TypeScript with explicit page/session/sync/dice/import/update contracts and a typed page entry declaration. Encounter-editor updates are normalized before entering page state, nullable route identifiers and session payloads are handled explicitly, and unknown import errors no longer assume an `Error` instance. Initiative and challenge-rating derivation moved to a pure typed module with regression coverage for fractional and structured CR values; persistence and participant synchronization remain in `features/encounter-editor`.
- Converted the session page model to TypeScript with explicit loaded-session, sync-event, checklist, entity-list, scene, note, navigation, and cross-feature setter contracts plus a typed page entry declaration. Session results from scope movement and encounter creation now pass through typed normalization adapters before entering page state. Session NPC/location normalization moved into a pure typed page-model module with regression coverage for UTF-8 names, internal-field stripping, `_aiIgnored`, notes, and location defaults; editing/history/persistence, encounter creation, and scope movement remain in their owning feature slices.
- Converted the campaign page model to TypeScript with explicit campaign/entity/session/sync/history/archive/AI and graph-note contracts plus typed page and graph entry declarations. Campaign graph projection and deterministic force layout are now strict TypeScript behind the Node-safe `graph.js` facade, with official D3 force declarations supplied by `@types/d3-force`. Campaign state sanitization/history helpers are typed behind their existing JavaScript compatibility facade. This completes the remaining JavaScript model implementations under `src/entities`, `src/features`, and `src/pages`; compatibility entrypoints remain where Node or JavaScript consumers require them.
- Started bounded UI-contract adoption with the localized status-badge feature. Its completed state, optional span click handler, class name, and public component contract are strict TypeScript while the feature ownership and JavaScript public runtime entrypoint remain stable.
- Extended UI-contract adoption through clipboard feedback and its shared presentation dependencies. `ClickToCopy`, `Notification`, and `Tooltip` now own strict React/event/timer/DOM contracts; nested tooltip registry/timer coordination and viewport-position derivation were extracted into a Node-safe typed model with focused regression coverage. Anchored portal positioning, drag-mode cancellation, clipboard success feedback, and public JavaScript entrypoints remain behavior-compatible.
- Migrated the shared icon/button/checkbox control boundary to strict TSX. Icon names are derived from the closed SVG catalog, button variants/sizes/native attributes/ref/static `Button.SIZES` API are explicit, and checkbox controlled state/native input props are typed. Button size normalization and class/stroke derivation moved into a Node-safe typed model with regression coverage for defaults, legacy aliases, invalid fallbacks, disabled classes, and create/small strokes. Same-slice imports and lint boundary patterns now follow the TSX owners while the JavaScript public barrel remains stable.
- Migrated shared panel, collapse-toggle, and switch primitives to strict TSX. Section content/classes, collapse rotation/size/click contracts, and controlled switch label/description/native-input behavior are explicit. Optional switch text rendering was split into a focused presentation helper, and public declarations plus import-boundary patterns now match the TSX owners.
- Migrated shared list-card and search-highlighting presentation to strict TSX. Modifier-aware link/button click decisions and regex-safe, case-insensitive highlight splitting moved into Node-safe typed models with regression coverage for plain/modifier links, missing callbacks, non-link cards, nullish/numeric text, casing, and regex metacharacters. Article drag attributes, active/action composition, original text casing, and the JavaScript public barrel remain stable.
- Migrated the shared Select controller to strict TSX. Strict option selection and first-option fallback, compatibility change-event construction, viewport-clamped portal placement, upward-opening rules, and selected-option scroll targeting moved into a Node-safe typed model with focused regression coverage. Shared portal outside-click/resize/scroll listener ownership is now a typed same-slice hook reused by Select and MultiSelect; refs, portal rendering, animation-frame scheduling, disabled behavior, and the JavaScript public barrel remain stable.
- Migrated the shared MultiSelect controller to strict TSX. String-normalized identity, selected-count derivation, option-order toggle/single selection, delegated option-click behavior, close/keep-open plans, active-option scroll targeting, and its 340px height policy moved into a Node-safe typed model with focused regression coverage. Select and MultiSelect now share a single typed viewport-clamping model and portal lifecycle hook while retaining their distinct value/event and maximum-height contracts.
- Migrated the shared DraggableList controller to strict generic TSX. Default render-key/ID/index precedence, the five-pixel pointer threshold, bounded immutable reorder, and key-based final-order comparison moved into a Node-safe typed model with focused regression coverage. Pointer capture, handle and interactive-target filtering, DOM hit-testing, preview animation, body modes, click suppression, custom cross-list payload events, and reorder/drop callback timing remain in the controller with explicit item/pointer/preview state contracts.
- Completed strict TypeScript implementation coverage for `src/shared/ui`: every component, controller hook, and pure model is now `.tsx`/`.ts`. The JavaScript `index.js` remains the runtime compatibility/public import boundary, paired with its typed declaration facade; no legacy shared UI implementation remains behind the barrel.
- Migrated the complete notes UI feature slice to strict TSX. Note-card collapse eligibility, simplified/classic presentation, preview truncation, real/virtual filtering, and bulk-collapse intent moved into a Node-safe feature model with focused regression coverage. AI-ignore drag-control composition and editable note rendering retain their existing behavior behind the JavaScript UI barrel and a typed declaration facade; editor UI, rich-content, and shared note-key public contracts are now explicit for typed consumers.
- Migrated the complete entity-link UI slice to strict TSX, completing TypeScript implementation coverage for the feature behind its JavaScript browser/model compatibility barrels. Scope providers, inline-link modal state/events, resolver-rendered React content, and generic modal props now use entity-owned contracts. Location/NPC/character modal presentation moved into the Node-safe model with focused coverage, and nullable route slugs plus the modal feature public contract are explicit for typed consumers.
- Migrated the complete app-aware modal feature to strict TSX. Promise API construction, lazy localized status formatting, prompt/checkbox confirm-value derivation, standard-modal focus targeting, Enter/Escape planning, and cancel-disabled close routing moved into a Node-safe typed model with focused regression coverage. Portal/listener/focus effects and the global store-backed message-box adapter remain in UI; message-box title/message contracts are now strings, and consumers retain the JavaScript public barrel plus typed facade.
- Migrated the campaign-creation modal to strict TSX. Create, archive-import, and close callbacks now have an explicit feature-owned public contract; file selection and input refs use native DOM types, accepted archive formats and field-reset behavior remain unchanged, and campaign-name normalization stays with the app orchestration that executes the create command.
- Migrated the player-question modal to strict TSX. Standard-die factorization, deterministic roll-formula construction, bounded numeric search, and unknown dice-result narrowing moved into a Node-safe typed feature model with focused regression coverage. Virtual-list refs, two-frame positioning, animated centering, debounce preference, result-ID deduplication, and dice dispatch remain behavior-compatible in UI; external consumers use the feature public barrel.
- Migrated `RollDice` and the probability-modal portion of the dice feature to strict TSX. Multiplication-glyph normalization, legacy truthy-context payload wrapping, probability precision labels, and relative bar-width derivation moved into a Node-safe typed model with focused regression coverage. Click cancellation, tooltip text, probability calculation limits, empty-state behavior, chart rendering, and the public feature barrel remained stable, establishing the contracts used by the calculator migration.
- Completed strict TypeScript implementation coverage for `features/dice` by migrating `DiceCalculator`. Unknown store requests now narrow through a typed request decoder; shortcut, die-button formula, capped history, history replay payload, recharge state, single-die detection, current-formula selection, and breakdown-label policies live in the Node-safe dice model with focused regression coverage. DOM outside-click exceptions, panel unmount timing, two-frame roll animation, player-question auto-close, modal composition, localized presentation, and dispatch behavior remain in the controller. The JavaScript public barrel remains the supported runtime import boundary with a matching typed facade.
- Migrated `ColorThemeSwitcher` to strict TSX and added typed settings model/UI facades. Next-theme and icon selection now live with the existing theme normalization contract and are regression-covered; controlled callback precedence, store fallback, optimistic dispatch, asynchronous persistence error reporting, tooltip copy, and the API/model-safe versus browser-UI entrypoint split remain unchanged. This established the contracts reused by the later settings-modal migration.
- Removed the duplicated campaign-scope option rendering reported by Fallow from the settings controller. A private typed `CampaignScopeOptions` composition now serves both source and AI-prompt selectors without entering the public UI API; each selector retains its own global option and state behavior.
- Completed strict TypeScript implementation coverage for `features/settings` by migrating `SettingsModalContent`. Store campaign values, nullable source APIs, source catalogs, prompt maps, campaign ignore-source maps, selected-scope recovery, sanitized save payloads, and PATCH response fields now narrow through a Node-safe typed settings-modal model with focused regression coverage. React retains synchronization effects, API orchestration, optimistic simple-setting dispatch, save statuses, notifications, and shared-control composition. Empty PATCH responses still enter the failure path, campaign/global fallbacks remain stable, and JavaScript API/UI barrels retain their model-safe versus browser-only split with typed facades.
- Migrated the encounter add-monster modal to strict TSX and removed its client-side whole-session read/modify/write flow. A focused `POST .../encounters/:encounterId/monsters` client method now delegates to a session application command that validates the participant object, locates the encounter, appends without dropping existing monsters, preserves encounter identity, and persists through `SessionRepository`; command behavior and error statuses are regression-covered. Active-campaign/session/encounter discovery and stable target IDs moved into a typed encounter-editor model with nullable API normalization coverage, while loading/error UI, submit locking, reload dispatch, and modal closure remain in the controller.
- Completed strict TypeScript implementation coverage for `features/ai-edit-monster`. The action chooser, edit modal, draft-response adapter, and aggregate modal composition now share feature-owned monster, model, attachment, history-resource, diff, ref, and callback contracts. Mode-specific presentation moved into a Node-safe typed model with focused regression coverage, while active-request cancellation, optional attachments, injected response composition, resource-level apply/undo, and the JavaScript public barrel remain behavior-compatible. A typed AI UI facade now exposes the attachment state contract and shared immediate-child model-option rendering without moving browser UI into the model-safe AI entrypoint; the latter also removes duplicate option composition from the image-prompt picker.
- Completed strict TypeScript implementation coverage for `features/edit-monster`. The former 781-line mixed controller was split into a Node-safe typed edit model and a TSX modal composition with a typed public facade. Field extraction/update rules, dice-average calculation, scalar/structured speed conversion, 5eTools type-choice preservation, legacy `desc` versus `entries` action mutation, action collection edits, Ctrl/Cmd+K rule-reference insertion, JSON-object parsing, name validation, deep cloning, and source restoration are regression-covered. The critical field-update complexity hotspot was replaced with focused field updaters, reference content remains injected from the widget layer, and ESLint now enforces the feature public import boundary.
- Completed strict TypeScript implementation coverage for `features/rules-reference`. Link navigation now resolves through typed per-reference resolver tables; preview loading returns spell/creature/reference data contracts through typed loader tables; and tooltip parsing returns text/roll descriptors before TSX rendering. Recursive list/section/table rendering, stale async-load suppression, localized click errors, token-image fallback, and interactive dice remain in UI. Browser-only source/spell formatters are injected into the Node-safe model, preserving the JSON-free reference entrypoint. Focused tests cover spell/creature/status navigation, UTF-8 creature previews, source/type/CR/AC/HP metadata, skill metadata, tagged labels, hit/damage/recharge roll descriptors, and the feature has no remaining JavaScript implementation.
- Completed strict TypeScript implementation coverage for `features/ai/ui`: shell/modal composition, toolbar generation controls, Gemini API-key setup, context settings, image/file attachments, prompt/token summary, virtualized response history, model options, and the history-response adapter are now typed. Toolbar visibility and encounter/custom-monster coupling, API-key decisions, optional token rows, empty-history visibility, attachment capacity/deduplication/removal/validation, and session/scene context defaults live in a Node-safe typed presentation model with focused regression coverage. Attachment processing preserves MIME and 10 MB validation, four-item limits per kind, gallery URLs, duplicate suppression, partial-selection alerts, and base64 previews. Context contracts now describe campaign entities, hydrated sessions, scenes, and per-field configuration instead of relying on arbitrary objects. Fallow identified the initial toolbar controller as a critical complexity hotspot, so it was reduced to thin orchestration over private model/context/entity/parsing/encounter action groups; no critical AI UI toolbar finding remains. A shared injected-response contract replaces duplicate modal shapes across the assistant and AI monster editor. Browser UI remains behind `features/ai/ui/index.js`; the Node-safe model/API `features/ai/index.js` is unchanged.
- Completed strict TypeScript implementation coverage for `features/editor/ui`: `Input`, `EditableField`, and mention-picker composition now expose feature-owned React/event/ref/entity contracts through the browser-only JavaScript barrel and typed facade. Mention filtering/grouping, initial raw/preview cursor mapping, square-bracket paste detection, tab/mention/format/block text edits, value normalization, and input/Lexical shortcut decisions moved into a Node-safe typed presentation module with focused regression coverage, including Ukrainian keyboard-layout aliases. Lexical nodes, selection commands, external update tags, application versus editor history routing, formatted clipboard behavior, mention boundaries/tooltips, and entity-modal resolution remain behavior-compatible in the controllers. Fallow's initial four critical editor complexity findings were split into focused policies and command executors; the scoped editor UI report now contains no critical findings. `Input` and `EditableField` remain app-coupled and are not promoted to `shared`.
- Completed strict TypeScript implementation coverage for `features/images`. `ImageAssetField`, `ImageDropzone`, `ImageTargetSettings`, `ImageGallery`, the gallery hook, API client, category configuration, and all policy modules are typed behind the JavaScript compatibility barrel and typed facade. Encoded URL/target presets, filename/source/campaign/result policies, folder navigation, path/history/deduplication/row projection, runtime-validated drop payloads, grouped move plans, readonly-aware range selection, drag plans, and nullable local/scoped/database loading live in focused models with UTF-8 regression coverage. The former 1200-line gallery controller was split into private folder/image renderers and navigation/search/actions/grid/dialog compositions; its hook now orchestrates the extracted loading and interaction plans. Fallow's UI and six hook critical hotspots are eliminated, and the full `features/images` scoped report has zero critical findings. Readonly official tokens, multi-selection, drag/drop, rename/move/delete, search scopes, virtual rows, storage stats, fullscreen preview, upload cleanup/locking, and nullable HTTP results remain explicit. The invalid `move` icon reference that rendered no icon was replaced with a valid catalog entry. The ambient `react-list` contract moved from the player-question feature into `src/types`, and no temporary UI declaration bridge remains.
- Completed strict TypeScript implementation coverage for `features/rich-content`. The former mixed recursive renderer is now a typed UI composition over `model/richContentPresentation.ts`, where ordered token handlers produce discriminated roll, damage, rules-reference, or text plans. List, section, table, and generic object inputs are narrowed at runtime; Markdown escaping, query highlighting, mentions, creature source fallback, recharge behavior, hit/damage formatting, condition/status links, quick references, and Ukrainian surrounding text remain regression-covered. Browser consumers use the public JavaScript UI barrel and typed facade; Node/model tests use the JSON-free `model.js`/`model.d.ts` facade. ESLint blocks private model/UI imports, unstable random React keys were removed, and the two former critical parser/recursive-renderer complexity hotspots were eliminated. The scoped Fallow report has zero critical findings.
- Completed strict TypeScript implementation coverage for `widgets/bestiary-browser`, extending the Bestiary FSD pilot through its reusable browser composition. Canonical case-insensitive monster/source identity, explicit reference lookup, source/sync/API/AI envelope narrowing, legendary-group enrichment, favorites and search filtering, fractional CR sorting, official-first selection, custom refresh/update selection, runtime-validated JSON imports, case-insensitive merge replacement, edit payloads, AI instruction planning, abort detection, and draft metadata preservation moved into a JSON-free typed model facade with focused Ukrainian-data regression coverage. The former mixed list/detail controller is now strict TSX with private toolbar, virtual-list, detail, and row compositions; `null` replaces the legacy empty-string selection sentinel and stable identity keys are used consistently. Supporting public declarations now expose the existing AI model facade, composed monster editor/response/stat-block/assistant contracts, missing shared download/deep-search declarations, and the complete Bestiary API result types. ESLint enforces the widget public boundary, and Fallow's 12 original critical browser hotspots are eliminated with zero scoped critical findings and no suppressions.
- Completed strict TypeScript implementation coverage for `widgets/monster-stat-block`, continuing the Bestiary pilot through its rich reusable renderer. Legacy URL spell loading/cache and level grouping, structured 5eTools spellcasting narrowing, action/content arrays, sense-reference tokenization, AI changed-field classes, custom/override/official token-source precedence, upload-result validation, mutation identity, dropzone visibility, and drag MIME payloads moved into a JSON-free typed model facade with focused UTF-8 regression coverage. The former 851-line controller is now thin TSX orchestration over private token, name/meta, stats, ability, legacy/structured spellcasting, action, and content sections. The public token callback contract was corrected to the behavior-compatible `(monster, imageUrl)` signature, nullable Bestiary API results and weak store campaign values are narrowed at the owning boundary, and async spell loading has an unmount guard. ESLint now protects both private model and UI paths. Fallow's two original critical findings (`MonsterStatBlock` and `handleCustomTokenUpload`) are eliminated with zero scoped critical findings and no suppressions.
- Completed strict TypeScript implementation coverage for `widgets/campaign-entity-card`. Character/location card-data and collapse plans, canonical display names, AI field/note highlights, immutable note-ignore updates, deterministic character/NPC/location drafts, and required-name validation moved into a JSON-free typed model facade with focused Ukrainian regression coverage. The two former mixed card controllers are split into typed headers, character identity/details, location composition, and a shared private notes renderer; both creation modals are strict TSX and retain feature-owned submit commands. Entity card models now preserve their concrete entity type through generic note mutation, and the shared note-render declaration exposes virtual-note metadata without weakening callers. An obsolete `strokeWidth` create-button prop was removed because the typed shared Button never applied it to the icon. ESLint protects private model/UI paths, all four legacy JSX implementations are gone, and Fallow's two original critical card findings are eliminated with zero scoped critical findings and no suppressions.
- Completed strict TypeScript implementation coverage for the spell presentation vertical: `widgets/spells-browser` and `widgets/spell-card`. Reference-key identity, nullable source/spell/settings envelopes, campaign source settings, class/school option derivation, source/level/class/school/basic/detailed predicates, stable level/name sorting, sort-state transitions, displayed/all-list initial selection, source-filter recovery, and safe error messages moved into a JSON-free typed browser model with focused Ukrainian regression coverage. The former 515-line browser is now typed orchestration over private controls and virtualized list/detail composition; filter state is derived rather than mirrored through an effect, async source/data loads have cancellation guards, and `null` replaces the empty-string deselection sentinel. `SpellRecord` now extends the entity-owned `SpellData` contract, while the strict TSX spell card retains localized model labels and recursive rich content. ESLint protects the browser's private model/UI paths. Fallow's three original critical browser findings are eliminated with zero scoped critical findings and no suppressions.
- Completed strict TypeScript implementation coverage for `widgets/rules-reference-modal`. The seven-tab catalog, nullable official/custom Bestiary aggregation, source-qualified spell and creature identities, exact/fallback creature ranking, simple versus recursive detailed search, selection matching, and insertion-tag construction moved into a JSON-free typed model facade with focused Ukrainian regression coverage. The former 920-line modal controller is now typed orchestration over private search/tab/detail, virtual-list, and Bestiary row compositions; embedded spell selection, `forceTab`, global back/forward history, lazy/global loading, tab match indicators, scroll-to-selection, token fallback, and reference insertion remain behavior-compatible. Browser consumers use the typed public composition facade, Node consumers use `model.js`, and ESLint protects both private model and UI paths. Fallow's four original critical findings are eliminated with zero scoped critical findings and no suppressions.
- Completed strict TypeScript implementation coverage for `widgets/campaign-search`. Recursive searchable-text extraction, hidden/image field exclusion, campaign/session result indexing, nullable collection normalization, injected API hydration, four-filter state, non-empty filter toggling, normalized matching, 80-result limiting, snippet windows, highlight terms, and stable navigation targets moved into a JSON-free typed model facade with focused Ukrainian regression coverage. The former 586-line mixed modal is now typed orchestration over a private mention-aware Markdown/results composition; campaign in-memory entities still take precedence over fetched collections, every listed session is hydrated before indexing, `code`/`pre` content avoids mention rewriting, result rows retain keyboard activation guards, and delayed hash scrolling plus cleanup remain browser-owned. ESLint protects private model/UI paths, and Fallow's three original critical findings are eliminated with zero scoped critical findings and no suppressions.
- Completed strict TypeScript implementation coverage for `widgets/campaign-entity-modal`. Modal-entity slug narrowing, transient-field and note sanitization, normalized mention-name comparison, rename-confirmation planning, character/location card selection, stable card keys, and campaign-scope ownership moved into a JSON-free typed model facade with focused Ukrainian regression coverage. The provider now composes a private typed modal-card renderer over the existing campaign-entity and entity-link public contracts; parent resolver precedence, session-scope refusal, optimistic local editing, refresh dispatch, confirmed mention-reference updates, cancelled rename baselines, expanded headerless cards, and close-after-delete behavior remain intact. ESLint protects private model/UI paths, and Fallow's original critical modal-content finding is eliminated with zero scoped critical findings and no suppressions.
- Completed strict TypeScript implementation coverage for `widgets/sidebar`. Campaign grouping, active/completed group recomposition, slug-to-index order payloads, campaign-root toggle navigation, expanded/mobile class projection, keyboard activation, and safe async error messages moved into a JSON-free typed model facade with focused Ukrainian regression coverage. The former 487-line mixed controller is now typed orchestration over private campaign, navigation-link, resource, and archive compositions; responsive hover/pin/mobile behavior, archive import strategy selection, backup download naming, gallery/settings/player-question modal flows, and forced Bestiary/Spells tabs remain browser-owned. The campaign API reorder contract was corrected from an array declaration to the object map required by the backend command. ESLint protects private model/UI paths, and Fallow's original critical sidebar finding is eliminated with no scoped critical findings or suppressions.
- Migrated the `widgets/ai-assistant` image-prompt picker to strict TypeScript as an independent slice of the larger assistant controller. Detail/selection mode, context-request requirements, generation eligibility, stable item fallback keys, custom-monster type/CR summaries, and session-qualified scene keys/descriptions moved into a JSON-free typed model facade with focused Ukrainian regression coverage. The former 267-line mixed picker is split into a thin modal shell, details form, selection composition, and generic target column; attachments, immediate-child AI model options, targetless continuation, Bestiary image/no-image groups, campaign scene hiding, and injected target builders remain behavior-compatible. The obsolete `required` attribute on the contenteditable-based `EditableField` was removed because eligibility is enforced by the typed picker policy. ESLint protects private model/UI paths, and Fallow's original critical picker finding is eliminated with zero scoped picker critical findings and no suppressions; the larger assistant panel remains a later Phase 8 slice.
- Began the larger `widgets/ai-assistant` panel migration with a strict, injected-localization presentation contract. Markdown-free response previews, numeric/string/Date formatting, nested and escaped JSON prompt cleanup, retry request recovery, mode/generation/context summaries, history detail rows/titles/state labels, character/location names and keys, scene titles/descriptions, and image preview truncation moved out of the 1,300-line JSX controller into the Node-safe typed facade with focused Ukrainian regression coverage. Existing feature-owned failed/history-change predicates remain injected instead of being duplicated. This removes three panel-local critical helpers (`getCharacterDisplayName`, `getHistoryOptionsSummary`, and `getHistoryContextSummary`) plus several high/moderate helpers, reducing the panel's scoped critical findings from nine to six without suppressions. Async generation, apply/restore, API-key refresh, retry, and the main composition remain explicit follow-up slices.
- Extracted Gemini API-key persistence and model-refresh retry orchestration from `AiAssistantPanel` into `features/ai/model/apiKeyWorkflow.ts`, where it belongs beside typed model discovery. The dependency-injected command trims and rejects empty keys, persists once, retries discovery up to five times with four 500 ms waits, preserves null-response behavior, reports only the terminal refresh error, treats refresh exhaustion as non-fatal after a successful save, normalizes model arrays, and selects the server default or first model. Focused tests cover eventual success, missing input, permanent discovery failure, null discovery, and fatal key-save failure. The panel now owns only localized errors and React state transitions; Fallow reduces `handleSaveApiKey` from critical (CC 14/CRAP 210) to moderate (CC 6/CRAP 42), lowering panel critical findings from six to five without suppressions.
- Extracted AI history retry planning and execution from `AiAssistantPanel` into the typed `features/ai/model/historyWorkflow.ts` boundary. The retry plan now owns eligibility, failed-entry deletion identity, payload reconstruction, Bestiary type fallback, and image parsing policy; the dependency-injected executor owns delete-before-generate ordering and explicit success/cancel/failure outcomes. React retains request IDs, `AbortController`, localized notifications, visible history updates, and generated-result application through lifecycle callbacks. Focused tests cover blocked retries, failed-entry deletion order, successful generation, abort cancellation, and failure propagation. Fallow eliminates the former critical `retryResponseHistoryEntry` hotspot (CC 19, cognitive 21, CRAP 380) and leaves four panel critical findings; the new plan/executor boundary has no critical findings (`buildAiHistoryRetryPlan` is moderate and `executeAiHistoryRetry` is high), with no suppressions. The older retry-payload reconstruction helper remains a separate follow-up hotspot.
- Extracted generated-result interpretation from `AiAssistantPanel` into the typed `features/ai/model/generationResultWorkflow.ts` plan/executor boundary. Prompt history fallback identity, prompt/draft/update precedence, malformed-update rejection, campaign-versus-session direct-apply rules, campaign reload decisions, generated/history entity refreshes, prompt clearing, dialog closure, and notification kinds are now regression-covered policies. The callback executor preserves history-before-presentation/application order while React retains localization and state/dispatch effects. `AiGenerationResult` now explicitly exposes the untrusted draft/generated/updated fields, which the workflow narrows at runtime. Fallow eliminates the former critical `handleGeneratedAiData` hotspot (CC 26, cognitive 23, CRAP 702), reduces panel critical findings from four to three, and reports no critical findings in the new workflow; no suppressions were added.
- Extracted application-state projection for updated AI data into `features/ai/model/updatedDataWorkflow.ts`. A typed plan now validates record-shaped updates, resolves explicit or generated/history entity types, derives Bestiary monster sync identity, selects encounters by normalized ID, preserves session filename fallbacks, merges campaign updates over current state, and distinguishes applied versus reload-only results. Its callback executor preserves state-update, reload, sync, and refresh ordering. Focused tests cover Bestiary, session/encounter, campaign, malformed, and foreign-route flows. Directly applied generation results no longer dispatch the redundant second entity refresh. The architectural source assertion now verifies Bestiary sync ownership in the feature model and panel delegation through the public boundary. Fallow eliminates the former critical `applyUpdatedAiData` hotspot (CC 20, cognitive 20, CRAP 420), reduces panel critical findings from three to two, and reports only moderate findings in the new workflow with no suppressions.
- Extracted AI generation transport execution into `features/ai/model/generationExecution.ts`. The typed command now returns explicit success/cancelled/API-key-missing/failed outcomes, forwards the original abort signal, captures a persisted failed-history response before classifying API-key failures, normalizes unknown error message/status fields, and formats status-aware alert details. Required callbacks make every lifecycle effect explicit; React retains request inputs, controller/reference cleanup, request IDs, localized fallback copy, result application, and lifecycle dispatch. Focused tests cover signal forwarding, callback order, success data, aborts, API-key failures with history, ordinary status failures, and alert formatting. Fallow eliminates the former critical `generate` hotspot (CC 10, cognitive 11, CRAP 110); the new executor has no finding and its only scoped helper finding is moderate. The aggregate `AiAssistantPanel` component is now the sole remaining panel critical finding, with no suppressions.
- Began splitting the remaining aggregate `AiAssistantPanel` finding by extracting its complete image-prompt state and orchestration cluster into private strict TypeScript hooks. Picker open/selection/context state, prepare-before-open, target selection/reset, targetless validation, generation request shaping, registered Bestiary monster actions, and builder composition now live outside the JSX controller. Pure campaign/session NPC/location selection, session-qualified scene projection, custom-monster sorting/image grouping, target titles, and generation plans extend the Node-safe `imagePromptPicker.ts` model with focused coverage. The typed AI facade now exposes the existing image-target builder contracts required by the widget hook; the hooks remain private and are not added to the Node-safe model facade. Fallow reduces the aggregate panel from 1,219 lines, CC 47, cognitive 38, CRAP 2256 to 1,104 lines, CC 34, cognitive 28, CRAP 1190. The extracted image-prompt scope has zero critical findings and no suppressions; additional history/context/view splits remain before the aggregate finding is cleared.
- Continued the aggregate `AiAssistantPanel` split by extracting context loading, expanded-session hydration, immutable context-list/config commands, normalized list projection, and route-specific context selection into the private strict `useAiAssistantContextController.ts` hook. The hook composes the existing feature-owned context loader instead of duplicating API ownership; pure campaign/session/encounter/Bestiary projection moved to the Node-safe `assistantContext.ts` facade with focused route and malformed-input coverage. Bestiary still produces null campaign context and empty session data, campaign mode merges loaded entity collections, session defaults and lazy hydration remain intact, and loading is cleared on both success and failure. Fallow reduces the aggregate panel from 1,104 lines, CC 34, cognitive 28, CRAP 1190 to 1,018 lines, CC 19, cognitive 21, CRAP 380. The panel remains a critical aggregate component, but neither the private controller nor the pure projection has a critical finding; no suppressions were added. History/view composition remains the next bounded split.
- Completed the aggregate `AiAssistantPanel` decomposition by extracting history selection, loading/stats, clipboard state, feature-command wiring, apply/undo restoration, and route filtering into the private strict `useAiAssistantHistoryController.ts` hook. Pure history view, localized confirmation, error, route, title, and prompt-placeholder policies live in the Node-safe widget model with focused campaign/session/encounter/Bestiary and Ukrainian-data coverage. A private typed `AiAssistantPanelView.tsx` now composes the shell, toolbar, API-key setup, context modal, history response dialog/list, prompt composer, notifications, and error view from explicit prop groups; retry transport and generation lifecycle remain in orchestration because they share request cancellation and generated-result application. History loading now ignores stale effect completions while preserving stats fallback, clipboard HTML/plain behavior, selected-entry synchronization, partial/full apply/undo copy, direct-route restore versus reload, and entity refreshes. Fallow reduces the panel from 1,018 lines, CC 19, cognitive 21, CRAP 380 to 816 lines, CC 8, cognitive 7, CRAP 72. The panel and all newly extracted history/view/route modules have zero critical findings and no suppressions, clearing the last `widgets/ai-assistant` aggregate critical hotspot.
- Completed strict TypeScript implementation coverage for `widgets/ai-assistant` by converting the final `AiAssistantPanel.jsx` orchestration to `AiAssistantPanel.tsx` and moving its public prop contract to the implementation owner behind the unchanged JavaScript compatibility barrel. The compiler made nullable/numeric navigation IDs, optional session filenames, context-session adapters, attachment payload indexability, model/history/generation results, abort-controller refs, notification state, nullable modal commands, and unknown retry/API-key failures explicit. Campaign notes are narrowed to record-shaped values before token estimation, fetched sessions gain validated filenames or request-key fallback, and partial history apply/undo callbacks adapt without weakening feature command contracts. The AI public declaration facade now matches its existing runtime exports for generation lifecycle/request/token/history/context-image workflows. Retry failure normalization and status formatting moved into the feature-owned history workflow with focused malformed/status/history-entry coverage; retry payload fallback construction was split into a focused non-parsed request builder, eliminating both the new normalization hotspot and the previously recorded critical retry-payload helper. Fallow reports `AiAssistantPanel.tsx` at 829 lines, CC 8, cognitive 7, CRAP 72, with zero critical findings across the complete widget plus the touched history workflow and no suppressions.
- Completed strict TypeScript implementation coverage for `widgets/ai-response-modal`. Snapshot formatting/parsing, preview/card/note classification, encounter participant identity and metadata, changed-field projection, nested session/campaign/entity/custom-Bestiary draft lookup, immutable nested replacement, and history resource identity live in a Node-safe typed model with focused UTF-8 and nested-session regression coverage. A private typed draft controller owns resource synchronization, JSON edits, preview resolution, save-before-apply, resource apply/undo, localized error narrowing, and view-mode reset. The former 1,100-line mixed JSX controller is now typed orchestration over focused encounter, note, card, one-sided snapshot, changed-field, and JSON preview renderers plus a private `AiResponseModalView.tsx` for toolbar, details, diff switching, and draft editing. Response detail rows and React-Markdown components are explicit feature UI contracts; preview monsters, campaign cards, notes, editor state, callbacks, and nullable refs are narrowed at their owning boundaries. Matching retains `listIndex` → `id` → `instanceId` → structural fallback and JSON cloning semantics. The JavaScript public barrel remains stable, no JavaScript widget implementation remains, and Fallow reduces the original 12 critical findings to zero across the complete slice without suppressions.
- Completed strict TypeScript implementation coverage for `widgets/monster-editor-modal`, removing the final JavaScript implementation under `src/widgets`. The widget remains a thin composition boundary that injects `RulesReferenceModalContent` into the feature-owned monster editor, but its public contract now omits that internal dependency. A typed selection adapter bridges the rules-reference modal's concrete selection to the feature's extensible insertion contract. The compiler exposed that successful JSON saves previously validated names through string coercion while retaining a potentially non-string value; `prepareMonsterDraftForSave` now returns feature-owned `NamedMonsterData`, preserves valid string names, normalizes other accepted values to strings, and the generic clone helper retains the narrowed result type. Focused regression coverage locks numeric JSON-name normalization, all consumers compile without casts, and scoped Fallow remains at zero critical findings without suppressions.
- Migrated the campaign route composition from `CampaignPage.jsx` to strict `CampaignPage.tsx` behind the existing page barrel and direct typed facade. Weak active-campaign store values, session filenames, hash targets, character/NPC cross-list drops, card notes, entity keys, and section visibility/collapse state now narrow through the typed `campaignPagePresentation.ts` boundary with focused UTF-8 regression coverage. Header, sessions, description, notes/list/graph switching, repeated character/NPC/location sections, and search/partial-archive dialogs were split into focused private components; shared entity-section composition now owns collapse, bulk collapse, reorder, and persistence wiring without moving domain commands out of `useCampaignView`. Empty sections remain expanded, stored collapse flags apply only when content exists, partial archive operations retain busy locking and cleanup, and malformed sessions without filenames no longer produce `undefined` navigation targets. Fallow reduces the original aggregate `CampaignView` finding from CC 36/cognitive 32/CRAP 1332 to no finding and reports zero critical findings across the new page/presentation slice without suppressions. The private graph and partial-archive JSX implementations retain temporary colocated declaration bridges for their later independent migrations.

Next:

- Continue with the next bounded page UI/controller contract slice; the private campaign graph/archive JSX components and remaining session/encounter page compositions are candidates, while runtime validation remains authoritative for untrusted HTTP, filesystem, archive, and Gemini payloads.
- Apply the typed API results to focused feature models as those modules migrate; avoid repository-wide component conversion.
- Keep repository ports and HTTP payload types type-only until their owning runtime modules can migrate independently.

## Validation required for every phase

Run:

```text
npm test
npm run lint
npm run check:architecture
npm run typecheck
```

Do not use the production build as routine validation. Check changed Ukrainian text for valid UTF-8 and replacement characters.
