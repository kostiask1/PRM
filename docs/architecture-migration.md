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
- Rules reference link/preview behavior and the navigation-opening command moved to `features/rules-reference`. Modal composition remains temporarily legacy because it composes widgets and is still consumed by `features/edit-monster`; moving it requires first inverting that dependency.
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

Next:

- Continue with another bounded entity/feature model slice; runtime validation remains authoritative for untrusted HTTP, filesystem, archive, and Gemini payloads.
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
