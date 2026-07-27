# AGENTS.md

Коротка практична карта проєкту для AI-агентів. Проєкт містить українські тексти; файли `js`, `jsx`, `html`, `css`, `scss`, `json`, `md` очікуються у UTF-8.

## Project Overview

- Назва з `package.json`: `dnd-session-manager`.
- Призначення: локальний менеджер кампаній і сесій D&D з кампаніями, сесіями, сценами, нотатками, персонажами, NPC, локаціями, енкаунтерами, бестіарієм, заклинаннями, зображеннями, дайсами й опційною Gemini AI-допомогою.
- Архітектура: React 18 + Vite frontend, Express backend, локальне файлове сховище. Зовнішньої БД немає.
- Основні залежності:
  - Frontend: `react`, `react-dom`, `react-list`, `react-markdown`.
  - Backend: `express`, `multer`, `dotenv`, `@google/generative-ai`.
  - Tooling: `vite`, `eslint`, `sass`, `concurrently`.
- AI потребує `GEMINI_API_KEY` у `.env`.

## Architecture Map

- `src/main.jsx` - frontend entry point, реєструє service worker.
- `src/app/App.jsx` - кореневий React-компонент: завантажує
  кампанії/налаштування, керує глобальними modal/message/dice/mention потоками.
- `src/app/index.js` - public app-layer entry consumed by `src/main.jsx`.
- `src/app/router/MainContent.jsx` - route composition для campaign, session та
  encounter page public APIs.
- `src/app/providers/` - app-only global provider composition.
- `src/app/ui/` - app shell UI: sidebar, global message/dice overlays, and
  rules-reference host.
- `src/app/services/realtimeSync.js` - app bootstrap for realtime invalidation.
- `src/app/store/appStore.js` - configured application reducer/store:
  navigation, modal, messages, dice, language, UI settings, and active data.
- `src/shared/lib/appStorePort.js` - domain-neutral bound-store port and React
  selector/dispatch hooks used by lower FSD layers.
- `src/shared/lib/{classNames,deepSearch,domNavigation,download,formatBytes,id,json,undoRedo}.js`
  - public dependency-free generic helper modules shared across FSD layers.
- `src/shared/lib/useDebounce.js` - public generic React debounce hook.
- `src/shared/lib/navigation.js`, `src/shared/lib/mentionEditor.js` - public URL
  routing and Lexical mention-editing helpers.
- `src/shared/ui/searchHighlight.jsx` - public generic React search
  highlighter.
- `src/shared/model/` - generic modal, message-box, dice, mention-picker,
  navigation, entity-refresh, and realtime-sync action/command contracts.
- `src/shared/config/index.js` - public localization and theme configuration
  API; implementation and language-pack loading stay inside `shared/config`.
- Domain application-state contracts are exposed by owning public model APIs:
  `src/entities/campaign/model.js`, `src/entities/session/model.js`,
  `src/entities/encounter/model.js`, `src/entities/settings/model.js`, and
  `src/features/reference-navigation/model.js`.
- `src/shared/api/` - спільний HTTP transport: заголовки, JSON/blob response та
  нормалізація помилок.
- `src/entities/bestiary/api/bestiaryApi.js` - доменний API бестіарію.
- `src/entities/campaign/api.js`, `src/entities/session/api.js` - доменні
  frontend API кампаній, entities і сесій.
- Campaign entity display/name matching is exposed by
  `src/entities/campaign/model.js`; API-backed cross-type lookup is exposed by
  `src/entities/campaign/api.js`.
- Campaign graph construction and `d3-force` layout/collision mechanics are
  exposed separately by `src/entities/campaign/graph.js`; keep them out of the
  general campaign model barrel.
- `src/entities/ai/api.js`, `src/entities/ai/model.js` - AI endpoints і pure
  response/diff/attachment model logic.
- `src/entities/archive/api.js`, `src/entities/settings/api.js` - archive and
  settings endpoint ownership. The legacy frontend `src/api.js` facade has been
  removed.
- `server/server.js` - Express entry point, монтує routes, віддає `dist/`.
- `tests/run-tests.mjs` - regression suite; backend fixtures import their owning
  domain/infrastructure modules directly. There is no backend test facade.
- `server/infrastructure/jsonFileStore.js` - generic filesystem/JSON
  infrastructure: queued atomic writes, UTF-8 reads, retrying renames,
  existence and storage-size helpers.
- `server/infrastructure/storagePaths.js` - centralized storage roots, safe
  campaign/session basenames, URL segment encoding and path-segment policy.
- `server/domains/ai/aiResponseRepository.js` - campaign-scoped AI response
  history normalization, Bestiary history migration, stats and CRUD.
- `server/domains/ai/customMonsterPatchService.js` - isolated custom-monster
  create/update/delete AI operations with injectable persistence dependencies.
- `server/domains/ai/encounterPatchService.js` - encounter AI mutation and
  monster-instance normalization with injectable Bestiary/identity dependencies.
- `server/domains/ai/aiApplyAggregateService.js` - AI apply aggregate
  loading/persistence; keeps filesystem paths outside the patch coordinator.
- `server/domains/ai/aiOperationDispatcher.js` - pure operation routing and
  campaign/session change tracking for the AI apply flow.
- `server/domains/ai/notePatchService.js` - note normalization, target
  resolution, and append/update/delete handling across campaign, session,
  scene, and entity scopes.
- `server/domains/ai/entityOperationUtils.js` - shared AI entity identity,
  scope, display-name, and session-collection helpers.
- `server/domains/ai/campaignEntityGateway.js` - campaign entity list/save
  boundary shared by entity and note operations.
- `server/domains/ai/aiContentNormalizer.js` - stable-ID character/location
  normalization and ignored-note preservation shared by entity and scene flows.
- `server/domains/ai/entityPatchService.js` - campaign/session entity CRUD,
  duplicate resolution, mention rewrites, permissions, client-ID mapping, and
  `moveScope` orchestration.
- `server/domains/ai/scenePatchService.js` - scene normalization and CRUD,
  scene/encounter client-ID linking, and newly-created orphan cleanup.
- `server/domains/ai/campaignPatchService.js` - campaign-level AI patch
  operations.
- `server/domains/settings/settingsRepository.js` - settings defaults,
  normalization and persistence; settings/AI routes read it directly.
- `server/domains/reference/referenceDataRepository.js` - spell and rules
  dataset loading, source fallback, search filtering and normalized named
  references.
- `server/domains/bestiary/bestiaryReferenceRepository.js` - read-only official
  Bestiary sources, normalized monster index and legendary-group loading.
- `server/domains/bestiary/customBestiaryRepository.js` - custom monsters,
  normalization, favorites and combined official/custom indexing.
- `server/domains/session/sessionRepository.js` - session aggregate lifecycle:
  list/read/create, stable-ID update and rename, delete and reorder.
- `server/domains/campaign/campaignRepository.js` - campaign metadata
  discovery, creation, slug uniqueness, listing and reorder persistence.
- `server/domains/entity/entityRepository.js` - campaign entity lifecycle,
  character/NPC moves and cross-campaign/session mention rewriting.
- `server/domains/image/imageAssetRepository.js` - image files, folders,
  collision-safe names, moves/deletes and campaign image ownership.
- `server/domains/image/imageReferenceService.js` - image URL rewrites across
  campaign metadata, entities, sessions and AI history.
- `server/domains/image/imageGalleryReadService.js` - read-only user/official
  image search, Bestiary-token browsing and storage-size projections.
- `server/domains/campaign/campaignLifecycleService.js` - coordinated campaign
  rename/delete with image ownership and reference updates.
- `server/domains/archive/archiveExportService.js` - full/partial campaign
  bundle composition and image materialization.
- `server/domains/archive/archiveImportService.js` - append/replace imports,
  aggregate restoration, AI normalization and confined image writes.
- `server/domains/archive/archiveSections.js` - allowed partial-archive section
  policy shared by import and export.
- `server/domains/archive/archiveRequestSchemas.js` - structural request
  validation for full and partial archive imports.
- `server/http/requestValidation.js` - shared HTTP validation error and
  middleware contract. Validation failures use status `400`, code
  `INVALID_REQUEST`, and structured `details`.
- `server/http/requestSchemaUtils.js` - generic structural schema helpers;
  domain-specific fields and enums remain in their owning domain.
- `server/domains/campaign/campaignRequestSchemas.js` and
  `server/domains/session/sessionRequestSchemas.js` - campaign/session
  mutation, entity-move, and reorder request contracts.
- `server/routes/*.js` - REST API:
  - `campaigns.js` - campaigns/entities/reorder/move/export.
  - `sessions.js` - session CRUD/reorder.
  - `ai.js` - Gemini, parsed AI operations, history, apply/undo.
  - `bestiary.js` - local bestiary, custom monsters, favorites.
  - `spells.js` - spells/conditions/diseases/rules/skills/senses.
  - `images.js` - image upload/list/move/delete/rename.
  - `backups.js` - full and partial archives/imports.
  - `settings.js` - app settings.
  - `assets.js` - static asset serving.
- `database/` - bundled D&D reference data (`bestiary`, `spells`, conditions, skills, senses, etc.).
- `data/` - local user data. Treat as user-owned runtime data, not source code.
- `tests/run-tests.mjs` - Node-based regression suite.
- `scripts/check-performance-budgets.mjs` - executable median-time and render-cap
  budgets for Bestiary, Spells, global search, and encounter grid grouping.
- `scripts/` - local helper scripts for env, project run, encoding check, database update/bundling.

## Main Features

### Campaign Workspace

- What: campaigns with story, notes, sessions, PCs, NPCs, locations/factions, graph, import/export.
- Main UI: `src/pages/campaign/ui/CampaignPage.jsx`.
- Public APIs: `src/pages/campaign/index.js`,
  `src/features/campaign/model.js`, `src/entities/campaign/api.js`,
  `src/entities/campaign/model.js`, `src/entities/campaign/ui.js`.
- Pure Character/Location card views live under
  `src/entities/campaign/ui`; image selection and simplified-note settings are
  injected by their higher-layer page/widget/component consumers.
- Main logic: `src/features/campaign/model/useCampaignView.js`,
  `src/entities/campaign/model/`.
- Backend: `server/routes/campaigns.js`,
  `server/domains/campaign/*`, `server/domains/archive/*`.
- Important files: `src/entities/campaign/ui/CharacterCardView.jsx`,
  `src/entities/campaign/ui/LocationCardView.jsx`, `NoteCard.jsx`,
  `DraggableList.jsx`, `CampaignNotesGraph.jsx`,
  `src/widgets/global-search/ui/GlobalSearchModal.jsx`,
  `PartialArchiveModal.jsx`.

### Sessions and Scenes

- What: session planning, scenes, scene notes, session-scoped NPC/location entities, encounter links, todo/prep state.
- Main UI: `src/pages/session/ui/SessionPage.jsx`,
  `src/components/session/*`.
- Public APIs: `src/pages/session/index.js`,
  `src/features/session/model.js`, `src/entities/session/api.js`,
  `src/entities/session/model.js`.
- Main logic: `src/features/session/model/useSessionView.js`,
  `src/entities/session/model/`.
- Backend: `server/routes/sessions.js`,
  `server/domains/session/sessionRepository.js`.
- Business detail: NPC/location can be campaign-scoped or session-scoped; scope changes must preserve IDs/references where intended.

### Encounters

- What: combat encounters linked to session scenes, monsters/characters, HP, initiative, grid/focused views, import/export.
- Main UI: `src/pages/encounter/ui/EncounterPage.jsx`.
- Public APIs: `src/pages/encounter/index.js`,
  `src/features/encounter/model.js`, `src/entities/encounter/model.js`.
- Main logic: `src/features/encounter/model/useEncounterView.js`,
  `src/entities/encounter/model/encounters.js`.
- Backend data path: stored inside session data, not a separate DB.
- Important integrations: `Bestiary.jsx`, `MonsterStatBlock.jsx`, `AddMonsterToEncounterModalContent.jsx`.

### Bestiary and Custom Monsters

- What: browse local bestiary, favorites, custom creatures, custom monster CRUD/import/export, token image upload.
- Main UI: `src/features/bestiary/ui/Bestiary.jsx`,
  `src/components/MonsterStatBlock.jsx`.
- Bestiary-owned list/AI/action UI: `src/features/bestiary/ui/`.
- Reusable monster editor: `src/entities/bestiary/ui/MonsterFieldEditModal.jsx`.
- Public APIs: `src/features/bestiary/index.js`,
  `src/entities/bestiary/api.js`, `src/entities/bestiary/model.js`,
  `src/entities/bestiary/ui.js`.
- Main logic: `src/entities/bestiary/model/`,
  `server/aiCustomMonsterService.js`.
- Frontend API: `src/entities/bestiary/api/bestiaryApi.js`.
- Backend: `server/routes/bestiary.js`,
  `server/domains/bestiary/*`.
- Data:
  - Official/local reference: `database/bestiary/all.json`, `database/bestiary/legendarygroups.json`, `database/bestiary/tokens/`.
  - Custom monsters: `data/custom-bestiary.json`.
- Important rule: custom monster legendary actions live on the monster object; do not move them to a separate legendary group file.

### Spells and Rules References

- What: spell browser, condition/disease/variant rule/skill/sense references, parsed 5eTools-style tags.
- Main UI: `src/features/spells/ui/Spells.jsx`,
  `src/entities/spell/ui/SpellCard.jsx`, `src/components/RulesLink.jsx`.
- Public APIs: `src/features/spells/index.js`, `src/entities/spell/api.js`,
  `src/entities/spell/model.js`, `src/entities/spell/meta.js`,
  `src/entities/spell/ui.js`, `src/entities/rules-reference/api.js`,
  `src/entities/rules-reference/model.js`,
  `src/features/reference-navigation/model.js`,
  `src/widgets/rules-reference/index.js`.
- Rules-reference composition UI:
  `src/widgets/rules-reference/ui/RulesReferenceModalContent.jsx`.
- Main logic: `src/entities/spell/model/`,
  `src/entities/rules-reference/model/`,
  `src/features/reference-navigation/model/`,
  `src/renderers/contentRenderer.jsx`, `src/utils/parser.jsx`,
  `src/utils/contentTokens.js`.
- Frontend API: spell endpoints belong to `src/entities/spell/api/`;
  condition/disease/variant-rule/skill/sense endpoints belong to
  `src/entities/rules-reference/api/`.
- Backend: `server/routes/spells.js`.
- Data: `database/spells/all.json`, `database/conditions.json`, `database/diseases.json`, `database/skills.json`, `database/senses.json`, `database/variantrules.json`.

### AI Assistance

- What: prompt UI, context selection, image prompt generation, parsed operations, draft/apply/undo, history and retry.
- Main UI: `src/widgets/ai-assistant/ui/`.
- Widget public API: `src/widgets/ai-assistant/index.js`.
- Public APIs: `src/entities/ai/api.js`, `src/entities/ai/model.js`,
  `src/features/ai/model.js`.
- Frontend model logic: `src/entities/ai/model/`; AI model-option loading:
  `src/features/ai/model/loadAiModelOptions.js`.
- Backend: `server/routes/ai.js`, `server/aiService.js`, `server/aiPatchService.js`, `server/aiPayloadSchemas.js`, `server/aiHistoryService.js`, `server/aiResponseHistoryService.js`.
- Schema: parsed AI must return `{ "version": 2, "operations": [...] }`.
- Allowed operation style is domain-specific (`create`, `update`, `delete`, `appendNote`, `updateNote`, `deleteNote`, `moveScope`), not raw RFC JSON Patch.
- AI history is campaign-scoped in `data/campaigns/{slug}/_aiResponses.json`.

### Images

- What: upload/list/move/rename/delete campaign/general images; attach images to campaigns/entities/scenes/monsters.
- Main UI: `src/features/images/ui/ImageGallery.jsx`,
  `src/features/images/ui/ImageDropzone.jsx`,
  `src/features/images/ui/ImageAssetField.jsx`.
- Public APIs: `src/features/images/index.js`, `src/entities/image/api.js`,
  `src/entities/image/model.js`.
- Main logic: `src/features/images/model/useImageGallery.js`,
  `src/entities/image/model/imageGalleryConfig.js`.
- Frontend API: `src/entities/image/api/imageApi.js`.
- Backend: `server/routes/images.js`, `server/domains/image/*`.
- Data: `data/images/{campaignSlug|general}/{category}/{optionalSubcategory}`.
- Categories from config: `maps`, `scenes`, `tokens`, `characters`, `props`, `notes`, `attachments`.

### Global Search and Mentions

- What: campaign-wide search across notes, scenes, NPC, locations, sessions, custom monsters, mentions.
- Main UI: `src/widgets/global-search/ui/GlobalSearchModal.jsx`.
- Public API: `src/widgets/global-search/index.js`.
- Large campaigns load session details with bounded concurrency and one shared
  `AbortSignal`; do not replace this with unbounded `Promise.all`.
- Mentions: bracketed text like `[Name]` rendered by `EntityLink.jsx` and context utilities.
- Important parsing: do not turn text inside `pre`/`code` into entity links.

### Import, Export, Backups

- What: full backup/archive, campaign archive, partial campaign archive, custom bestiary import/export.
- Backend: `server/routes/backups.js`, `server/domains/archive/*`.
- UI: `CreateCampaignModalContent.jsx`, `PartialArchiveModal.jsx`, `Bestiary.jsx`.
- Partial campaign archive currently covers sessions, NPC, locations, images, AI history. Custom monsters are handled from Bestiary.

### Settings and Localization

- What: theme, language, simplified notes, encounter UI, AI base prompts, auto-apply parsed AI changes.
- UI: `src/components/modals/SettingsModalContent.jsx`.
- Backend/data: `server/routes/settings.js`, `data/settings.json`.
- Localization: `src/langs/uk.json`; `src/langs/en.json` currently appears empty/minimal.

## Data Flow

- URL -> `src/utils/navigation.js` -> `appStore.navigation`.
- `MainContent.jsx` chooses the active view:
  - `/campaign/:slug`
  - `/campaign/:slug/session/:fileName`
  - `/campaign/:slug/session/:fileName/encounter/:encounterId`
  - `/bestiary`
  - `/spells`
- Slices call their owning domain API through `src/shared/api`; there is no
  generic frontend API facade. Endpoint paths must remain domain-owned.
- Backend routes call domain repositories/services; generic filesystem access
  goes through `server/infrastructure/jsonFileStore.js`.
- Bestiary, Spells, and rules-reference read APIs accept an optional native
  fetch-options object. Large-data effects must pass an `AbortSignal`, abort on
  cleanup, and check the signal before committing state.
- Campaign metadata: `data/campaigns/{slug}/_campaign.json`.
- Entities: `data/campaigns/{slug}/characters|npc|locations/{entitySlug}/info.json`.
- Sessions: `data/campaigns/{slug}/sessions/{fileName}.json`.
- AI parsed response flow:
  1. `AiAssistantPanel.jsx` sends payload to `/api/ai/generate`.
  2. `server/aiService.js` builds prompt/context.
  3. `server/aiPayloadSchemas.js` validates operation schema.
  4. `server/aiPatchService.js` is the thin top-level apply coordinator; do not
     add domain mutation logic back into it.
  5. AI domain services dispatch operations and load/persist the affected
     campaign/session aggregates.
  6. Domain repositories persist entity changes and AI response history.
  7. UI shows draft/enhanced diff in `AiResponseModal.jsx`.
- Image move/rename updates references through
  `server/domains/image/imageReferenceService.js`.
- Service worker caches `/api/bestiary` and `/api/spells` GET responses for reference data. Be careful when debugging stale bestiary/spell data.

## Important Conventions

- Use UTF-8. After editing Ukrainian text, run `npm run check:uk` or `npm run lint`.
- Do not replace Ukrainian text with `?`; watch for mojibake/replacement symbols.
- Prefer existing local patterns over new abstractions.
- Backend production code must import an owning module under `server/domains`
  or `server/infrastructure`; do not import `server/storage.js`.
- Backend regression tests follow the same ownership rule. Do not recreate
  `tests/support/backendTestFacade.js` or another aggregate persistence barrel.
- App-only routing, global overlay hosts, shell UI, providers, and realtime
  bootstrap belong under `src/app`; do not recreate their legacy
  `src/components` or `src/services` paths.
- The configured reducer/store belongs under `src/app/store`. Lower FSD layers
  use hooks from `src/shared/lib/index.js`; they must not import `app/store`.
  Do not recreate `src/store/appStore.js`.
- Application actions and imperative commands belong to their generic shared
  model or owning entity/feature model API. Do not recreate
  `src/actions/app.js`, `src/services/applicationRuntime.js`, or another
  cross-domain action/runtime catalog.
- Generic class-name composition, deep object search, DOM target navigation,
  browser downloads, byte formatting, ID comparison, JSON checks, and
  undo/redo transitions belong to their public files under `src/shared/lib`.
  Do not recreate the corresponding `src/utils` files or legacy imports.
- Localization and theme configuration belong to
  `src/shared/config/index.js`. Do not recreate
  `src/services/localization.js`, `src/services/uiSettings.js`, or import
  `shared/config` implementation files directly.
- Campaign entity identity/display logic and API-backed name resolution belong
  to the campaign entity public model/API entry points. Do not recreate
  `src/services/entities.js` or another legacy frontend `src/services`
  directory.
- Campaign graph construction/layout belongs to
  `src/entities/campaign/graph.js`. Do not recreate
  `src/utils/campaignGraph.js` or `src/utils/campaignGraphLayout.js`, and do
  not add graph-engine exports to the general campaign `model.js` barrel.
- Generic debounce behavior belongs to `src/shared/lib/useDebounce.js`. Do not
  recreate `src/hooks/useDebounce.js` or a legacy frontend `src/hooks`
  directory.
- URL parsing/building, mention editor mechanics, mention picker orchestration,
  and generic search highlighting belong to their documented `shared`
  modules. Do not recreate `src/utils/navigation.js`,
  `src/utils/mentionEditor.js`, `src/utils/mentionPicker.js`, or
  `src/utils/searchHighlight.jsx`.
- Validate untrusted request bodies and uploaded JSON before calling domain
  mutations. Destructive operations such as `wipe_and_replace` must only run
  after the entire payload has passed validation.
- Put reusable HTTP validation mechanics in `server/http`; keep domain schemas
  with their owning `server/domains/<domain>` module. Do not add ad hoc
  route-local error formats.
- Reorder payloads are `{ orders: { [stableKey]: nonNegativeInteger } }`.
  Campaign/session names, when supplied, must be non-empty strings. Validate
  these constraints before rename or persistence work.
- Treat `AbortError` as an expected lifecycle outcome. Do not show an error or
  commit loading/data state from an aborted Bestiary, Spells, or
  rules-reference request.
- Use `rg`/`rg --files` for search.
- Use `apply_patch` for manual edits.
- Do not revert user changes. Worktrees may be dirty.
- Do not edit `data/` unless the user explicitly asks to change local runtime data.
- Do not edit generated `dist/` or `node_modules/`.
- Do not propose running `npm run build`. The script exists, but project instruction says not to propose it.
- If changing logic, remove code made obsolete by the change.
- Frontend styles are mostly BEM-like classes in `src/assets/components/*.css` plus shared SCSS in `src/assets/scss/`.
- Character and Location card models belong to
  `src/entities/campaign/model.js`; do not recreate `src/models`.
- Entity UI must not import `features/images` or the app store. Pass image
  capability components and UI settings from a higher composition layer.
- Character and Location card consumers must use
  `src/entities/campaign/ui.js` and inject `ImageAssetFieldComponent` plus
  `simplifiedNotesEnabled`; do not recreate legacy card adapters under
  `src/components`.
- Bestiary AI history is canonical at `data/_aiResponses-bestiary.json`.
  `data/campaigns/bestiary/_aiResponses.json` is a read-through migration
  source only when canonical history is absent. Canonical data always wins;
  never delete or overwrite the legacy source during automatic migration, and
  do not restore permanent legacy-path fallback reads.
- Many views debounce autosave; avoid adding immediate writes inside every keystroke unless existing code already does that.

## FSD Migration Rules

- Актуальний план і статус фаз: `docs/architecture-migration.md`.
- Accepted architecture decisions live in `docs/adr/`; do not contradict them
  silently. Supersede an ADR explicitly when a decision changes.
- Temporary exceptions live in `docs/migration-debt.md` with evidence, a
  removal condition, and a target phase. Do not add an unregistered
  compatibility adapter.
- Напрям залежностей: `app -> pages -> widgets -> features -> entities -> shared`.
- Нижчий FSD layer не імпортує вищий.
- Зовнішні споживачі slice імпортують тільки його public API: `index.js` або
  явний segment entry point на кшталт `api.js` / `ui.js`. Не змішувати API та
  UI в одному barrel, якщо це тягне зайві runtime dependencies.
  Deep imports у `entities/*/api`, `entities/*/model`, `entities/*/ui`,
  `features/*/model`, `features/*/ui`, `widgets/*/ui`, `pages/*/ui` та
  implementation-файли `shared/api` / `shared/model` заборонені ESLint.
- Entity UI не імпортує feature/widget UI. Якщо reusable entity потребує
  higher-layer flow, передавати renderer/callback із composition layer.
- `src/shared` не містить доменних понять і не імпортує domain slices.
- Dependency-free helpers may expose focused public files under
  `src/shared/lib` when a barrel would initialize unrelated runtime
  dependencies.
- Endpoint paths та domain operations належать `entities/<domain>/api`, а не
  shared transport і не legacy `src/api.js`.
- Stateful use-case orchestration належить `features`; reusable domain data,
  pure model logic і read-only domain UI належать `entities`.
- Legacy folders можна використовувати під час поетапної міграції, але новий
  cross-domain coupling через них не створювати.
- Для кожної міграції: додати public API, перевести consumers, видалити
  застарілий код, потім виконати `npm run check:architecture`.
- Не обходити boundary gate через re-export з legacy-файлу або suppression без
  задокументованої причини та фази видалення.

## Business Rules

- This is local-first: filesystem data is the source of truth.
- Campaign/session/entity IDs must remain stable. Do not change entity IDs unless explicitly required.
- `updatedAt` should not be reintroduced.
- Campaign and session scopes matter:
  - Session-scoped NPC/location data should stay session-scoped unless moving scope is requested.
  - AI in session scope should not copy campaign-scoped NPC/location content into session as duplicates.
- AI context can ignore notes/entities via `_aiIgnored`; ignored content must not be sent to AI.
- Parsed AI should return precise operations, not full unchanged datasets.
- AI custom monster generation must avoid app entity links (`[Name]`) inside monster fields.
- 5eTools inline tags in monster text should use English/canonical lookup values, e.g. `{@condition stunned}`, `{@spell Gust of Wind|XPHB}`.
- Monster attack/damage text should use parseable tags like `{@hit N}`, `{@damage FORMULA}`, `{@dc N}`, `{@recharge N}`.
- `{@recharge N}` is a d6 recharge threshold, not a d20 modifier.
- Custom monster spellcasting should use the official-style top-level `spellcasting` array when applicable.
- Image defaults used in UI:
  - Location image upload default category: `scenes`.
  - Character/NPC image upload default: `characters` / `npc`.
  - Custom monster token upload default: `tokens`, no subfolder.

## Testing and Validation

- `npm test` runs `tests/run-tests.mjs` and covers utilities/storage/AI patching/parsing/model behavior.
- `TEST_FILTER` may select focused contracts by case-insensitive test-name
  substring, but a filtered run does not replace the full regression suite.
- `npm run lint` runs ESLint and `npm run check:uk`.
- `npm run check:uk` validates UTF-8 and suspicious Ukrainian text corruption in `src` and `server`.
- Existing warnings may exist; distinguish pre-existing warnings from new regressions.
- Do not use `npm run build` as a default validation command.
- `npm run check:performance` runs stable representative workloads against the
  bundled reference data. Update a budget only with a documented reason and a
  recorded before/after measurement; do not raise it merely to make the gate
  pass.
- When changing AI operations, add or update tests around:
  - `server/aiPayloadSchemas.js`
  - `server/aiPatchService.js`
  - `tests/run-tests.mjs`
- When changing parsers/renderers, test `src/utils/parser.jsx`, `src/utils/contentTokens.js`, and `src/renderers/contentRenderer.jsx`.

## Common Pitfalls

- PowerShell can corrupt Ukrainian text if writing through the wrong encoding path. Prefer `apply_patch`; verify with `check:uk`.
- `data/` contains real local campaign/user data and may have Ukrainian path names.
- Service worker cache can hide fresh `/api/bestiary` or `/api/spells` changes.
- Custom bestiary should be fetched separately from cached official bestiary data.
- `ReactList` expects stable item rendering; changing list row heights/drag behavior can cause visual jumps.
- Drag/reorder persistence usually belongs on drop/final action, not every hover.
- Entity mentions should not be parsed inside code/pre blocks.
- AI modals can stack; confirmation dialogs must remain inside the active modal flow or be reachable.
- Session encounter data is nested in sessions; do not assume a standalone encounter collection.
- `package.json` has `"main": "server.js"`, but actual backend entry used by scripts is `server/server.js`.

## Do Not Change Without Checking

- `server/infrastructure/storagePaths.js`,
  `server/domains/archive/*`, and `server/domains/image/*` path, archive, and
  image-reference behavior.
- `server/aiService.js`, `server/routes/ai.js`, `server/aiPatchService.js`, `server/aiPayloadSchemas.js` prompt/schema/apply flow.
- Entity scope/move logic in
  `src/features/session/model/useSessionView.js`,
  `src/features/campaign/model/useCampaignView.js`,
  `server/domains/entity/entityRepository.js`,
  `server/domains/session/sessionRepository.js`.
- Mention parsing and rendering: `EntityLink.jsx`, `entityLinkUtils.js`, `contentRenderer.jsx`, `parser.jsx`.
- `CampaignNotesGraph.jsx` layout/drag collision code; small constants can drastically change UX.
- `DraggableList.jsx` and `DraggableList.css`; drag hover/layout is sensitive.
- `public/service-worker.js`; cache behavior affects reference data debugging.
- `database/` reference files; they can be large generated/bundled data.
- `src/langs/uk.json`; preserve valid JSON and UTF-8.
- `data/custom-bestiary.json`; user-created monsters live here.

## Useful Commands

- Install dependencies: `npm install`.
- Start frontend dev server only: `npm run client` (Vite, port 3000, proxies `/api` to `http://localhost:5000`).
- Start backend dev server only: `npm run server` (Express watch mode, port 5000 by default).
- Start client and server together: `npm start`.
- Windows helper: `run_project.bat`.
- Project helper: `npm run project` performs `git pull`, may install deps, may build, then starts production server; use only when this side effect is intended.
- Tests: `npm test`.
- Architecture boundaries, cycles and dead code: `npm run check:architecture`.
- Performance budgets: `npm run check:performance`.
- Lint + Ukrainian encoding check: `npm run lint`.
- Encoding check only: `npm run check:uk`.
- Bestiary copy materialization: `npm run bestiary:materialize-copies`.
- Database bundle scripts: `npm run database:bundle`, `npm run database:bundle:compact`.
- Update 5eTools data: `npm run database:update`.
- Build script exists in `package.json`, but do not propose it as routine validation.
