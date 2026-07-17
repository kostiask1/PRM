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
- `src/App.jsx` - кореневий React-компонент: завантажує кампанії/налаштування, керує глобальними modal/message/dice/mention потоками.
- `src/app/routing/MainContent.jsx` - композиція маршрутів; нові екрани підключаються з `src/pages/*`.
- `src/shared/model/appStore.ts` - strict TypeScript global store через `useSyncExternalStore`; імпортується через `src/shared/model/index.js`.
- `src/shared/api/httpClient.ts` - спільний HTTP transport для `/api/...`; consumers import it through `src/shared/api/index.ts`.
- `src/entities/*/api` та `src/features/*/api` - API-клієнти, що належать відповідному домену/use case.
- Compatibility facade `src/api.js` видалено; кожен consumer імпортує API client з domain owner.
- `server/server.js` - Express entry point, монтує routes, віддає `dist/`.
- `server/storage.js` - основний файловий storage layer, нормалізація шляхів, JSON read/write, кампанії, сесії, entities, image refs, imports/exports, AI history.
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
- `scripts/` - local helper scripts for env, project run, encoding check, database update/bundling.

## Main Features

### Campaign Workspace

- What: campaigns with story, notes, sessions, PCs, NPCs, locations/factions, graph, import/export.
- Main UI: `src/pages/campaign/ui/CampaignPage.jsx`.
- Main logic: `src/pages/campaign/model/useCampaignView.js`, `src/entities/campaign/model/CampaignViewModel.ts`, `src/features/campaign/campaignStateUtils.js`.
- Backend: `server/routes/campaigns.js`, `server/routes/backups.js`, `server/storage.js`.
- Important files: `CharacterCard.jsx`, `LocationCard.jsx`, `NoteCard.jsx`, `DraggableList.jsx`, `CampaignNotesGraph.jsx`, `GlobalSearchModal.jsx`, `PartialArchiveModal.jsx`.
- Campaign character/NPC/location CRUD frontend ownership is `src/features/campaign-entity`; creation payload cleanup and create/update/delete delegation must go through its client.
- `src/features/campaign-entity/model` is fully TypeScript. Extend entity IDs, payloads, setters, sanitizers, pending saves, reorder/move commands, and scope-modal contracts at this boundary; runtime consumers continue importing through `features/campaign-entity/index.js`.
- Optimistic collection changes, collapse persistence, rename confirmation/application, mention rename callbacks, deletion, and reload-on-error belong to `useCampaignEntityCollection`; debounced writes belong to `useCampaignEntityPersistence`.
- Character/NPC type movement and entity reorder/undo persistence belong to `useCampaignEntityOrdering`; page hooks only supply campaign state, reload callbacks, and user-facing errors.
- Campaign/session NPC and location scope changes must use `useCampaignEntityScopeMovement` and the backend `campaignEntityScopeCommands` transaction. Preserve IDs, flush pending session saves first, and keep compensation behavior for partial filesystem failures.
- Session/scene/note mutations belong to `features/session-editor`; use `useSessionEditing` for editing, `useSessionPersistence` for debounced writes, and `useSessionHistory` for undo/redo or AI replacement snapshots. Keep encounter creation/linking out of this slice.
- Pure session/scene/note mutation contracts live in `features/session-editor/model/sessionMutations.ts`. Preserve resource IDs, immutable updates, encounter cleanup when deleting linked scenes, virtual-note sanitization on reorder, and dynamic section-collapse keys.
- `src/features/session-editor/model` is fully TypeScript. Preserve delayed-save ownership by the originating session, flush-on-unmount behavior, explicit throw/update-UI save options, history application suppression, distinct snapshot transitions, and external replacement discarding pending writes.
- Encounter creation/linking and encounter persistence belong to `features/encounter-editor` and backend session application commands. IDs are server-generated, scene linking is idempotent, and page hooks must not read/modify/write whole sessions to save an encounter.
- `src/features/encounter-editor/model` is fully TypeScript. Preserve server-generated encounter IDs, existing-link navigation without duplicate creation, pending-session flush before creation, debounced encounter writes, unmount flushing, custom-only participant refresh, pending-save sync guards, and selected-instance preservation.
- Encounter participant source loading and custom Bestiary refreshes belong to `useEncounterParticipantSynchronization`; typed merge rules belong to `participantSynchronization.ts`. Preserve `instanceId`, local display name/current HP, and never rewrite official monsters or character participants during custom refresh.
- `participantSynchronization.ts` exposes only participant-name normalization, entity image-map construction, and the synchronization command. Source normalization, payload extraction, identity-name derivation, and individual merge mechanics are private implementation details.
- Session CRUD, rename, deletion, ordering, encounter linking, and encounter persistence must go through backend session application commands and `SessionRepository`. `server/routes/sessions.js` only maps HTTP; do not add filesystem paths or JSON manipulation back to it.
- Campaign lifecycle, rename/reference updates, deletion, export, image checks, ordering, bulk entity replacement, and character/NPC movement must go through campaign application commands and repository ports. `server/routes/campaigns.js` is HTTP-only; preserve campaign/entity IDs and `createdAt`.
- Custom bestiary search/mutations and favorites must go through `bestiaryCommands` and `BestiaryRepository`. Preserve omitted token images, update CUSTOM favorites on rename/delete, reject duplicate names, and keep custom legendary actions on the monster object.
- Bundled bestiary source discovery, source fallback, and legendary-group copy resolution also belong to `BestiaryRepository`/`bestiaryCommands`. `server/routes/bestiary.js` must remain free of filesystem paths and direct JSON/storage operations.
- Settings reads/patches use `SettingsRepository` and `settingsCommands`; keep `server/routes/settings.js` HTTP-only and preserve storage normalization/default recovery.
- Image upload naming/directories, gallery queries, token reads, subcategories, rename/move/delete, and reference propagation use `ImageRepository`/`imageCommands`. Keep filesystem/path logic in the adapter and preserve UTF-8 filename decoding plus collision suffixes.
- Spell and rules-reference reads use `ReferenceRepository`/`referenceCommands`. Preserve aggregate/index fallback, source labels, search ordering, disease fallback, and XPHB/XDMG-over-PHB/DMG precedence; keep `server/routes/spells.js` path-free.
- Full/partial backup exports and imports use `BackupRepository`/`backupCommands`. Preserve gzip/UTF-8 payloads, campaign-only append behavior, replace-by-ID/wipe strategies, and archive response headers; keep persistence orchestration out of `server/routes/backups.js`.
- Static asset directories are resolved in `modules/assets/infrastructure`; routes may mount `express.static` but must not construct filesystem paths.
- Image gallery UI and state (`ImageGallery`, `ImageTargetSettings`, `ImageDropzone`, `ImageAssetField`, `useImageGallery`) belong to `features/images`. External code imports them only through `features/images/index.js`; do not recreate legacy `components/Image*` or `hooks/useImageGallery` paths.
- `src/features/images/model` is fully TypeScript. Keep gallery categories, content scopes, image locations, readonly assets, drag/drop payloads, selection groups, and storage statistics owned by the image feature. Normalize nullable HTTP results and narrow parsed drag data before applying mutations; do not move modal/UI composition into the model.
- Generic `Button`, `Checkbox`, `Icon`, `MultiSelect`, `Select`, `Tooltip`, `Panel`, `Notification`, and `Switch` live in `shared/ui`; import them only from `shared/ui/index.js`. `Input` and `EditableField` remain app-coupled and must not be moved into shared without first removing their store/entity dependencies. `classNames` lives in `shared/lib` and is imported through its public index; the legacy utility path is retired.
- Generic note-state helpers live in `shared/lib` and must be imported through its public index. Character/location card models live in `entities/campaign/model` and are exposed only by `entities/campaign/index.js`; their former `models/*CardModel` paths are retired.
- `CharacterCard`, `LocationCard`, and their create-button/modal compositions live in `widgets/campaign-entity-card`; import them only through `widgets/campaign-entity-card/index.js`. Submit behavior stays in `features/campaign-entity`; the composed UI is a widget because it depends on image/editor features and app state.
- `SpellCardModel` lives in `entities/spell/model` and is exported through `entities/spell/index.js`. Rich `SpellCard` composition lives in `widgets/spell-card` and must be imported through its public index; former `components/SpellCard` and `models/SpellCardModel` paths are retired.
- `MonsterStatBlockModel` lives in `entities/bestiary/model` and must be imported through `entities/bestiary/index.js`; its former legacy model path is retired.
- Monster type normalization and bestiary search matching live in `entities/bestiary/model` and are exposed through `entities/bestiary/index.js`; do not recreate `src/utils/bestiary.js`.
- Encounter participant identity, HP derivation, and instance creation live in `entities/encounter/model` and are exposed through `entities/encounter/index.js`; do not recreate `src/utils/encounters.js`.
- Campaign graph projection and layout live in `pages/campaign/model`; page UI and Node-based tests consume the Node-safe `pages/campaign/graph.js` entrypoint. The former `src/utils/campaignGraph*` paths are retired.
- AI attachment validation, diff construction, model-option loading, and response-resource helpers live in `features/ai/model` and are exposed through `features/ai/index.js`. The former `src/utils/aiAttachments`, `aiDiff`, `aiModels`, and `aiResponseHelpers` paths are retired.
- Reference caches/resolvers, content tokens, tag preprocessing, source metadata/filtering, and spell metadata live in `entities/reference/model`. Browser consumers use `entities/reference/index.js`; Node code/tests use the JSON-free `entities/reference/model.js` entrypoint. Their former `src/services` and `src/utils` paths are retired.
- `src/entities/reference/model` is fully TypeScript. Keep cache maps, nullable API handling, token match indexes, parser fallbacks, source normalization, and resolver object passthrough explicit. Maintain matching declaration facades for `index.js` and the JSON-free `model.js`; Node consumers must not load `sourceNames.ts` or its JSON catalog.
- Generic search highlighting lives in `shared/ui`. Mention boundary/picker behavior lives in `features/editor/model` and is exposed through the Node-safe `features/editor/model.js` entrypoint. Do not recreate the retired `src/utils` tree.
- `src/features/editor/model` is fully TypeScript. Preserve zero-width mention boundaries, Lexical selection guards, Space insertion behavior, and the selected/cancelled picker result union; keep `features/editor/model.js` as the Node-safe compatibility entrypoint.
- Campaign entity name lookup/resolution lives in `entities/campaign/model`; theme behavior lives in `features/settings/model`; localization lives in `shared/lib`; realtime synchronization lives in `app/realtime`. Import through their public entrypoints and do not recreate the retired `src/services` tree.
- Global action contracts, action creators, external-store state, selectors, modal coordination, and navigation commands live in `shared/model` and are imported through `shared/model/index.js`. This placement prevents lower FSD layers from importing upward into `app`; do not recreate `src/actions` or `src/store`.
- Recursive rich-content rendering lives in `features/rich-content` and is imported through its public index. It composes dice, rules-reference, and entity-link controls; token/tag parsing stays in `entities/reference`. Do not recreate `src/renderers`.
- TypeScript adoption is contract-first. `tsconfig.json` is strict/no-emit, and `npm run typecheck` is required after changing `.ts`/`.tsx` files. Convert stable identifiers, events, API payloads, AI operation types, and repository ports independently; do not combine type conversion with domain ownership moves.
- Runtime validators remain authoritative for filesystem, HTTP, archive, and Gemini input. TypeScript types complement but never replace validation of untrusted data.
- Shared workflow identifiers live in `shared/model/contracts.ts`. Typed navigation implementation lives in `shared/lib/navigation.ts` but runtime consumers continue importing functions through `shared/lib/index.js`.
- AI operation types live beside the runtime schema in `server/modules/ai/domain/aiPayloadContracts.ts`; `aiPayloadSchemas.d.ts` describes the CommonJS validator. Keep the type union synchronized with the validator, but never remove runtime validation for Gemini output.
- Typed global workflow action modules live beside `shared/model/actions.js`; the JavaScript action barrel remains the runtime-compatible public facade. Keep each workflow focused and preserve action type strings and payload normalization during conversion.
- Modal, rules-reference, mention-picker, dice, and message-box workflows already have focused TypeScript action modules. New workflow actions should follow this pattern instead of growing the compatibility barrel.
- All global action creators now originate in typed workflow modules; `shared/model/actions.js` is re-export compatibility only. `appStoreTypes.ts` defines the composed state/action/dispatch contracts, while `appStore.ts` implements the strict public store API directly.
- Typed reducer sections live beside `appStore.ts`; the store delegates to them before its remaining switch. Keep each extraction behavior-identical and covered by the existing store/workflow tests.
- Store transitions are split across `settingsSyncReducer.ts`, `workflowReducer.ts`, and `navigationStateReducer.ts`; `appStore.ts` owns only typed infrastructure and reducer composition. Do not reintroduce a monolithic reducer switch.
- Every backend repository port has a colocated TypeScript declaration. Keep required-method runtime guards; declarations describe trusted internal calls but do not validate filesystem, HTTP, archive, or AI input.
- Shared HTTP transport is TypeScript and exported through `shared/api/index.ts`. Domain clients must keep importing the public barrel and should specify focused payload/result types as they migrate.
- Frontend API clients are TypeScript modules exported through their owning entity/feature barrels. Extend contracts at the owning boundary; do not recreate response shapes in widgets or unrelated features. Runtime validation is still required for untrusted responses and imported files.
- AI model discovery and history workflows are strict TypeScript consumers of the AI client contracts. Preserve explicit handling of nullable transport results and keep history resource, restore mode, and retry payload types owned by `features/ai`.
- Frontend AI operations use the discriminated union in `src/features/ai/model/operationContracts.ts`. Do not replace it with generic operation records; runtime Gemini payloads must still pass the server validator before these trusted frontend types apply.
- AI diff types are owned by `src/features/ai/model/aiDiff.ts`. Preserve snapshot narrowing and granular resource identity (`parentResourceId` plus derived IDs); add regression coverage when changing diff expansion or line classification.
- AI attachment allowlists/identity, prompt-target builders, and context-list mutation contracts are owned by their TypeScript modules under `src/features/ai/model`. Keep browser `File`/`Blob` handling at this feature boundary and preserve immutable context updates and `_aiIgnored` note filtering.
- AI token estimates are deliberately approximate and owned by `src/features/ai/model/tokenEstimation.ts`. Preserve its mode constants, ignored-content filtering, and separate text/image/file totals; update focused tests if estimation inputs or formulas change.
- `src/features/ai/model` is fully TypeScript. Context loaders depend on injected API functions, retain cancellation guards, and rely on unchanged context-list objects preserving reference identity. Do not move HTTP calls or widget state into these model modules.
- Encounter participant, session view, and spell-card domain contracts are owned by their TypeScript entity models. Preserve participant IDs, session encounter ID comparison, spell source data variants, and translation callback behavior when extending them.
- Rules-reference navigation, theme application, and Bestiary search normalization are typed at their owning feature/entity boundaries. Keep rules navigation on `shared/model/index.js`, theme writes limited to `data-theme`, and search normalization tolerant of string and structured monster types.
- `src/entities/bestiary/model` is fully TypeScript. Preserve legacy and 5eTools-compatible HP/AC/speed/save/type/defense variants in `MonsterStatBlockModel`; do not narrow official/custom monster input to only one source schema.
- `CampaignViewModel` and `SessionViewModel` live in their respective entity `model` segments and are imported through entity public indexes. `idsEqual` lives in `shared/lib`. Do not recreate the retired `src/models` directory.
- `src/entities/campaign/model` is fully TypeScript. Keep entity lookup and card/view contracts owned there, preserve note IDs and virtual-note materialization, and import runtime values through `entities/campaign/index.js`; the declaration facade must re-export owning types rather than duplicate them.
- Generic `useDebounce` lives in `shared/lib` and is imported through its public index; do not recreate `hooks/useDebounce`.
- Campaign screen orchestration lives in `pages/campaign`; import `CampaignPage` only through `pages/campaign/index.js`. Former `components/CampaignView` and `hooks/useCampaignView` paths are retired.
- Session screen orchestration lives in `pages/session`; import `SessionPage` only through `pages/session/index.js`. Former `components/SessionView` and `hooks/useSessionView` paths are retired.
- `src/pages/session/model` is fully TypeScript. Keep loaded-session normalization, keyboard/history routing, checklist progress, page callback composition, and cross-feature setter adapters at this boundary. Session-scoped NPC/location normalization and display-name rules belong in `sessionEntityModel.ts`; strip internal fields except the explicit `_aiIgnored` flag. Editing/history/persistence remain in `features/session-editor`, encounter creation in `features/encounter-editor`, and scope movement in `features/campaign-entity`.
- Encounter screen orchestration lives in `pages/encounter`; import `EncounterPage` only through `pages/encounter/index.js`. Former `components/EncounterView` and `hooks/useEncounterView` paths are retired. Do not recreate the retired `src/hooks` directory.
- `src/pages/encounter/model` is fully TypeScript. Keep page-state normalization, undo/redo coordination, import/export events, dice-result routing, participant selection, and encounter-page callbacks at this boundary. Pure initiative/CR derivation belongs in `encounterViewMetrics.ts`; preserve fractional and structured CR support. Persistence and custom participant synchronization remain owned by `features/encounter-editor`.
- The embedded spells browser lives in `widgets/spells-browser` and is imported through its public index. Individual rendered spell cards live in `widgets/spell-card`; do not recreate `components/Spells`.
- Rich monster rendering lives in `widgets/monster-stat-block` and is imported through its public index; pure monster derivation stays in `entities/bestiary`. Do not recreate `components/MonsterStatBlock`.
- Dice formula parsing, rolling, and probability utilities live in `shared/lib`. Interactive dice UI lives in `features/dice` and is imported through `features/dice/index.js`; former dice component and `utils/dice` paths are retired.
- Rules link/preview behavior and rules-modal navigation commands live in `features/rules-reference`. Rules modal composition lives in `widgets/rules-reference-modal`; composed monster editing with reference insertion lives in `widgets/monster-editor-modal`. `features/edit-monster` accepts injected reference content and must not import widgets.
- Generic `ListCard`, `CollapseToggleButton`, and `DraggableList` live in `shared/ui` and must be imported through its public index; their former `components/common` paths are retired.
- Entity-link behavior, identity, contexts, and generic entity modal resolution live in `features/entity-link`. UI consumers use `index.js`; Node-only/model consumers may use the model-only public `model.js` entrypoint. Campaign-specific entity modal rendering lives in `widgets/campaign-entity-modal`. Do not recreate former `components/common/Entity*` paths.
- `src/features/entity-link/model` is fully TypeScript. Preserve scope-aware identity matching, ID/slug/name precedence, current-modal suppression, and injected session resolution; keep `features/entity-link/model.js` as the Node-safe compatibility entrypoint.
- App-aware modal and global message-box UI lives in `features/modal` and is imported through its public index. It is not shared UI because it owns localized prompt fields and store-backed message behavior; former `components/common/Modal|MessageBox` paths are retired.
- AI attachment controls live in `features/ai/ui`; browser UI consumers import them from the UI public entrypoint `features/ai/ui/index.js`, while AI slice internals use relative imports. Keep `features/ai/index.js` model-safe for Node consumers and do not recreate `components/ai/AiAttachmentControls`.
- AI response composition lives in `widgets/ai-response-modal`. Feature-level history/draft dialogs accept the response component through injection; they must not import this widget directly. Former `components/ai/AiResponseModal` is retired.
- AI assistant orchestration and its image-prompt picker live in `widgets/ai-assistant`, imported through its public index. The legacy `src/components/ai` directory is retired; AI feature UI remains under `features/ai/ui`.
- Session-only scene and todo UI lives privately under `pages/session/ui/components`; do not expose it from the page public API or recreate `src/components/session`.
- Campaign notes graph and partial archive UI are private under `pages/campaign/ui/components`. Global campaign search lives in `widgets/campaign-search` and is imported through its public index. Do not recreate `src/components/campaign`.
- Application routing and empty-state guide live under `app/routing`. Sidebar/navigation composition lives in `widgets/sidebar` and is imported through its public index. Former root `components/MainContent`, `ProjectGuide`, and `Sidebar` paths are retired.
- Theme switching and settings modal UI live in `features/settings/ui` and browser consumers use `features/settings/ui/index.js`. Keep `features/settings/index.js` API/model-safe; former legacy settings UI paths are retired.
- App-aware `Input`, `EditableField`, and mention-picker modal UI live in `features/editor/ui` and are imported through `features/editor/ui/index.js`. The modal feature must not import editor UI; its simple prompt uses a native styled input to avoid a feature cycle. Do not recreate `src/components/form`.
- Note editing, AI-ignore note controls, and bulk collapse UI live in `features/notes/ui` and are imported through its UI public index. Former common note-control paths are retired.
- Clipboard feedback, localized status badges, encounter monster insertion UI, campaign creation UI, and player questions UI live in their respective feature slices. `src/components` is retired; do not recreate it.
- Cross-domain JSON, download, byte-formatting, and deep-search helpers live in `shared/lib` and are imported through its public index; their former `src/utils` paths are retired.
- Navigation URL/event helpers, DOM target navigation, and undo/redo transitions live in `shared/lib` and are imported through its public index; the former `src/utils/navigation`, `src/utils/domNavigation`, and `src/utils/undoRedo` paths are retired.
- Backend campaign entity CRUD rules live in `server/modules/campaign/application/campaignEntityCommands.js` over the repository port, with filesystem delegation in `server/modules/campaign/infrastructure/fileCampaignEntityRepository.js`.

### Sessions and Scenes

- What: session planning, scenes, scene notes, session-scoped NPC/location entities, encounter links, todo/prep state.
- Main UI: `src/pages/session/ui/SessionPage.jsx`, `src/pages/session/ui/components/*`.
- Main logic: `src/pages/session/model/useSessionView.ts`, `src/entities/session/model/SessionViewModel.ts`.
- Backend: `server/routes/sessions.js`, `server/storage.js`.
- Business detail: NPC/location can be campaign-scoped or session-scoped; scope changes must preserve IDs/references where intended.

### Encounters

- What: combat encounters linked to session scenes, monsters/characters, HP, initiative, grid/focused views, import/export.
- Main UI: `src/pages/encounter/ui/EncounterPage.jsx`.
- Main logic: `src/pages/encounter/model/useEncounterView.ts`, `src/entities/encounter/model/participants.ts`.
- Backend data path: stored inside session data, not a separate DB.
- Important integrations: `src/widgets/bestiary-browser`, `MonsterStatBlock.jsx`, `AddMonsterToEncounterModalContent.jsx`.

### Bestiary and Custom Monsters

- What: browse local bestiary, favorites, custom creatures, custom monster CRUD/import/export, token image upload.
- Main UI: `src/pages/bestiary`, `src/widgets/bestiary-browser`, `src/widgets/monster-stat-block`.
- Bestiary features: `src/features/edit-monster`, `src/features/ai-edit-monster`.
- Main logic: `src/entities/bestiary/model/MonsterStatBlockModel.ts`, `src/entities/bestiary/model/bestiarySearch.ts`, `server/aiCustomMonsterService.js`.
- Backend: `server/routes/bestiary.js`, `server/storage.js`.
- Data:
  - Official/local reference: `database/bestiary/all.json`, `database/bestiary/legendarygroups.json`, `database/bestiary/tokens/`.
  - Custom monsters: `data/custom-bestiary.json`.
- Important rule: custom monster legendary actions live on the monster object; do not move them to a separate legendary group file.

### Spells and Rules References

- What: spell browser, condition/disease/variant rule/skill/sense references, parsed 5eTools-style tags.
- Main UI: `src/widgets/spells-browser`, `src/widgets/spell-card`, `src/features/rules-reference`.
- Main logic: `src/features/rich-content/ui/RichContentRenderer.jsx`, `src/entities/reference/model/parserTags.ts`, `src/entities/reference/model/contentTokens.ts`, `src/entities/reference/model/referenceResolvers.ts`.
- Backend: `server/routes/spells.js`.
- Data: `database/spells/all.json`, `database/conditions.json`, `database/diseases.json`, `database/skills.json`, `database/senses.json`, `database/variantrules.json`.

### AI Assistance

- What: prompt UI, context selection, image prompt generation, parsed operations, draft/apply/undo, history and retry.
- Main UI: `src/widgets/ai-assistant`, `src/features/ai/ui/*`, `src/widgets/ai-response-modal`.
- Backend HTTP composition: `server/modules/ai/http/router.js` (`server/routes/ai.js` is a compatibility re-export). Parsed-operation domain contract: `server/modules/ai/domain/aiPayloadSchemas.js` (`server/aiPayloadSchemas.js` is a compatibility re-export).
- Backend AI application modules are being extracted under `server/modules/ai/application`; `buildPromptContext.js` owns ignored-content filtering and Gemini input-context shaping.
- `server/modules/ai/application/buildUserPrompt.js` owns deterministic mode-specific task instructions and final user-prompt assembly; do not rebuild those branches in routes or the Gemini adapter.
- `server/modules/ai/application/buildSystemInstruction.js` owns base mode policies and all shared/conditional AI contracts, including language, JSON operations, scope, generation toggles, notes, mentions, encounters, and user base prompts.
- `server/modules/ai/infrastructure/geminiGateway.js` is the Gemini SDK boundary: client/key lifecycle, model configuration, attachment request parts, invocation, and response text retrieval stay there.
- `server/modules/ai/infrastructure/attachmentParts.js` owns attachment MIME/size validation, local image resolution, base64 conversion, text-file prompt parts, and binary inline parts.
- `server/modules/ai/application/parseAiResponse.js` owns outer-fence cleanup, surrounding-prose JSON extraction, recursive escaped-newline normalization, and the invalid-JSON response contract.
- `server/modules/ai/application/resolveAiRequest.js` owns effective mode/parsing decisions, entity scope, generation permissions, response language normalization, and requested-model fallback selection.
- `server/modules/ai/application/prepareGenerateAiRequest.js` owns generate-request validation, route-path normalization, settings/base-prompt resolution, auto-apply policy, and route-facing generation flags through an injected settings reader.
- Complete generate workflows belong in application commands such as `server/modules/ai/application/generateBestiaryImagePrompt.js`; commands return `{ status, body }` and receive generation/history persistence dependencies explicitly.
- `server/modules/ai/application/generateCustomMonster.js` owns custom-bestiary normalization, selected-monster context, optional campaign/session context, target-ID completion, validation, and normal versus encounter-local draft routing.
- `server/modules/ai/application/generateCampaignContent.js` owns campaign/session context loading, custom monster-name context, generation, target completion, mention processing, contract validation, failure history, and campaign flow persistence.
- `server/modules/ai/application/campaignContext.js` owns ignored-content filtering and configured campaign/session context loading through injected entity/session readers; `fillCurrentTargetIds.js` owns implicit current-target completion.
- AI history persistence uses the contract in `server/modules/ai/application/ports/aiHistoryRepository.js`; filesystem storage mapping belongs to `server/modules/ai/infrastructure/fileAiHistoryRepository.js`.
- `server/modules/ai/application/aiHistoryCommands.js` owns entry lookup/not-found behavior, draft resource editing with stable nested IDs, and apply/undo snapshot dispatch.
- `server/modules/ai/application/generateAiRequest.js` is the top-level generation use case: preparation, workflow selection, and failed-request history recovery; Express only maps its `{ status, body }` result.
- Gemini API-key validation/cache invalidation belongs to `server/modules/ai/application/saveGeminiApiKey.js`; `.env` reading/writing and `process.env` mutation belong to `server/modules/ai/infrastructure/envApiKeyStore.js`.
- Generated entity mention candidate collection, safe text-field wrapping, canonicalization, and nested-bracket cleanup belong to `server/modules/ai/application/mentionProcessing.js`, not HTTP routes.
- Frontend feature model: `src/features/ai/model/*`; pure estimation, history and workflow rules do not belong inside `AiAssistantPanel.jsx`.
- AI generation/retry uses explicit lifecycle statuses and request IDs. Do not reintroduce a shared `loading` boolean for generation, retry, and context loading.
- AI history collection and restore decisions belong to `src/features/ai/model/historyState.ts`; React executes the plan using functional state updates so concurrent history entries are preserved.
- Async AI history commands belong to `src/features/ai/model/historyCommands.ts`; keep confirmation copy and screen-specific effects in the caller, and preserve the ref-backed restore lock.
- AI-specific presentation boundaries live in `src/features/ai/ui`; keep modal shell, prompt composer, and response-dialog wiring out of `AiAssistantPanel.jsx`.
- Import AI UI through `src/features/ai/ui/index.js`; do not re-export JSX from the model/API `src/features/ai/index.js`, because Node regression tests consume that entry directly.
- Context list normalization and nested updates belong to `src/features/ai/model/contextConfig.ts`; preserve default scene fields and immutable updates.
- Context data fetching, session hydration, and entity-list synchronization belong to `src/features/ai/model/useAiContextData.ts`; inject entity/session API functions instead of importing page clients into the hook.
- Token-estimate request shaping, context compaction, and attachment cost calculation belong to `src/features/ai/model/tokenEstimation.ts`; keep it pure and aligned with generation request modes.
- Image prompt target shaping belongs to `src/features/ai/model/imageTargets.ts`; keep ignored notes filtered and encounter monster summaries stable.
- Image-prompt campaign/session and custom-bestiary loading belongs to `src/features/ai/model/useAiImagePromptData.ts`; reuse injected context loaders and normalize both supported custom-monster response shapes.
- Schema: parsed AI must return `{ "version": 2, "operations": [...] }`.
- Allowed operation style is domain-specific (`create`, `update`, `delete`, `appendNote`, `updateNote`, `deleteNote`, `moveScope`), not raw RFC JSON Patch.
- AI history is campaign-scoped in `data/campaigns/{slug}/_aiResponses.json`.

### Images

- What: upload/list/move/rename/delete campaign/general images; attach images to campaigns/entities/scenes/monsters.
- Main UI: `src/features/images/ui/*`, `src/features/images/imageGalleryConfig.js`.
- Backend: `server/routes/images.js`, `server/storage.js`.
- Data: `data/images/{campaignSlug|general}/{category}/{optionalSubcategory}`.
- Categories from config: `maps`, `scenes`, `tokens`, `characters`, `props`, `notes`, `attachments`.

### Global Search and Mentions

- What: campaign-wide search across notes, scenes, NPC, locations, sessions, custom monsters, mentions.
- Main UI: `src/widgets/campaign-search`.
- Mentions: bracketed text like `[Name]` rendered by `EntityLink.jsx` and context utilities.
- Important parsing: do not turn text inside `pre`/`code` into entity links.

### Import, Export, Backups

- What: full backup/archive, campaign archive, partial campaign archive, custom bestiary import/export.
- Backend: `server/routes/backups.js`, `server/storage.js`.
- UI: `CreateCampaignModalContent.jsx`, `PartialArchiveModal.jsx`, `src/widgets/bestiary-browser`.
- Partial campaign archive currently covers sessions, NPC, locations, images, AI history. Custom monsters are handled from Bestiary.

### Settings and Localization

- What: theme, language, simplified notes, encounter UI, AI base prompts, auto-apply parsed AI changes.
- UI: `src/features/settings/ui/SettingsModalContent.jsx`.
- Backend/data: `server/routes/settings.js`, `data/settings.json`.
- Localization: `src/langs/uk.json`; `src/langs/en.json` currently appears empty/minimal.

## Data Flow

- URL -> `src/shared/lib/navigation.js` (through `shared/lib/index.js`) -> `appStore.navigation`.
- `MainContent.jsx` chooses the active view:
  - `/campaign/:slug`
  - `/campaign/:slug/session/:fileName`
  - `/campaign/:slug/session/:fileName/encounter/:encounterId`
  - `/bestiary`
  - `/spells`
- Views і slices викликають власні domain API clients. Усі clients використовують `src/shared/api/httpClient.ts` для Express routes під `/api`.
- `server/storage.js` reads/writes JSON and files under `data/`.
- Campaign metadata: `data/campaigns/{slug}/_campaign.json`.
- Entities: `data/campaigns/{slug}/characters|npc|locations/{entitySlug}/info.json`.
- Sessions: `data/campaigns/{slug}/sessions/{fileName}.json`.
- AI parsed response flow:
  1. `AiAssistantPanel.jsx` sends payload to `/api/ai/generate`.
  2. `server/aiService.js` builds prompt/context.
  3. `server/modules/ai/domain/aiPayloadSchemas.js` validates operation schema.
  4. `server/aiPatchService.js` applies targeted operations.
  5. `server/storage.js` persists changes and response history.
  6. UI shows draft/enhanced diff in `AiResponseModal.jsx`.
- Image move/rename updates references across campaign metadata, entities and sessions via `storage.updateAllImageReferences`.
- Service worker caches `/api/bestiary` and `/api/spells` GET responses for reference data. Be careful when debugging stale bestiary/spell data.

## Important Conventions

- Use UTF-8. After editing Ukrainian text, run `npm run check:uk` or `npm run lint`.
- Do not replace Ukrainian text with `?`; watch for mojibake/replacement symbols.
- Prefer existing local patterns over new abstractions.
- Use `rg`/`rg --files` for search.
- Use `apply_patch` for manual edits.
- Do not revert user changes. Worktrees may be dirty.
- Do not edit `data/` unless the user explicitly asks to change local runtime data.
- Do not edit generated `dist/` or `node_modules/`.
- Do not propose running `npm run build`. The script exists, but project instruction says not to propose it.
- If changing logic, remove code made obsolete by the change.
- Frontend styles are mostly BEM-like classes in `src/assets/components/*.css` plus shared SCSS in `src/assets/scss/`.
- Cards/components often have paired model files under `src/models/`; check models before changing display logic.
- Many views debounce autosave; avoid adding immediate writes inside every keystroke unless existing code already does that.

## Target Frontend Architecture (FSD)

Поточний статус і послідовність міграції зафіксовані в `docs/architecture-migration.md`. Оновлюй статус phase та acceptance criteria разом зі структурними змінами.

Frontend використовує Feature-Sliced Design. `src/components`, `src/hooks`, `src/models`, `src/utils`, `src/services`, `src/store`, `src/actions`, and `src/renderers` retired і не повинні відновлюватися. Новий функціонал створюй у `app`, `pages`, `widgets`, `features`, `entities`, or `shared` відповідно до напрямку залежностей.

Дозволений напрям залежностей:

`app -> pages -> widgets -> features -> entities -> shared`

- `app` - providers, routing, app initialization і глобальна композиція.
- `pages` - тонкі route-компоненти; лише композиція widgets/features, без доменної логіки.
- `widgets` - великі самодостатні частини сторінки, що компонують features та entities.
- `features` - завершені дії користувача/use cases (`edit-monster`, `ai-edit-monster`, upload, apply/undo).
- `entities` - доменні моделі, domain API, selectors, нормалізація та повторно використовуване domain UI.
- `shared` - HTTP transport, загальний UI, config та справді доменно-нейтральні helpers.

Обов'язкові правила:

- Нижчий FSD-шар не імпортує вищий. Правила закріплені в `.fallowrc.jsonc`.
- Зовнішній код імпортує slice через його публічний `index.js`. Deep imports у чужий slice заборонені; виняток - внутрішні імпорти всередині того самого slice.
- Не створюй broad barrel-файли, що реекспортують цілі дерева. Public API slice має бути мінімальним і явним.
- Імпортуй domain client з власника: наприклад `entities/bestiary`, `entities/campaign`, `features/ai`. Не створюй новий global API facade.
- `shared/api/httpClient.ts` знає лише HTTP-механіку. Domain endpoints не додаються до transport layer.
- Не перенось state у глобальний store автоматично. Persistent domain state належить filesystem/server; route state - router; workflow/modal/filter/draft state - відповідному feature/widget. Store використовуй лише для справді глобального app state.
- Не перетворюй кожен компонент або click handler на feature. Feature повинна представляти завершену дію/use case.
- Під час роботи з legacy-файлом мігруй лише той вертикальний workflow, якого стосується зміна; не роби масове переміщення без окремого запиту.
- Після структурних змін запускай `npm run check:architecture`; результат має не містити нових cycles або boundary violations.

Bestiary є пілотним FSD slice:

- Entry point з Sidebar відкриває Bestiary у rules-reference modal flow; окремий route не створюється без зміни navigation UX.
- Reusable browser/widget: `src/widgets/bestiary-browser`.
- Monster edit use case: `src/features/edit-monster`.
- AI monster edit/draft use case: `src/features/ai-edit-monster`.
- Bestiary API owner: `src/entities/bestiary`.

Не імпортуй повний Bestiary widget з rules/reference, entity або feature layers. Reference browser повинен використовувати власний lightweight list/detail view, щоб не створювати цикли.

## Backend Architecture Direction

Backend залишається modular monolith. FSD не застосовується до Express буквально. Новий або суттєво перероблений backend functionality організовуй вертикальними domain modules під `server/modules/<domain>`:

- `domain` - invariants, validation, pure transformations.
- `application` - use cases та orchestration.
- `infrastructure` - filesystem/Gemini/archive adapters.
- `http` - router, request mapping, response mapping.

Routes не повинні напряму будувати filesystem paths. Поступово вводь focused repositories (`CampaignRepository`, `SessionRepository`, `BestiaryRepository`, `AiHistoryRepository`, `ImageRepository`) поверх чинного `server/storage.js`. Filesystem залишається source of truth; не додавай DB або microservices без окремої вимоги.

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
- `npm run lint` runs ESLint and `npm run check:uk`.
- `npm run check:uk` validates UTF-8 and suspicious Ukrainian text corruption in `src` and `server`.
- Existing warnings may exist; distinguish pre-existing warnings from new regressions.
- Do not use `npm run build` as a default validation command.
- When changing AI operations, add or update tests around:
  - `server/modules/ai/domain/aiPayloadSchemas.js`
  - `server/aiPatchService.js`
  - `tests/run-tests.mjs`
- When changing parsers/renderers, test `src/entities/reference/model/parserTags.ts`, `src/entities/reference/model/contentTokens.ts`, and `src/features/rich-content/ui/RichContentRenderer.jsx`.

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

- `server/storage.js` path normalization, import/export/archive behavior, and image reference updates.
- `server/aiService.js`, `server/modules/ai/http/router.js`, `server/aiPatchService.js`, `server/modules/ai/domain/aiPayloadSchemas.js` prompt/schema/apply flow.
- Preserve the `server/modules/ai/application/buildPromptContext.js` contract when changing campaign/session/encounter context selection; add focused tests for field filtering and simplified notes.
- Preserve exact scope, mention, encounter-linking, and custom-monster rules in `server/modules/ai/application/buildUserPrompt.js`; prompt wording is behavioral code and needs mode-focused regression tests.
- Treat `buildSystemInstruction.js` wording and composition order as behavioral code; keep option-dependent contracts covered without duplicating policy constants in `aiService.js`.
- Keep `server/aiService.js` independent of `@google/generative-ai`; SDK-specific behavior belongs behind the injectable Gemini gateway and should be tested with a fake client.
- Keep filesystem and attachment encoding concerns out of application prompt builders; validate text and binary attachment behavior through `attachmentParts.js`.
- Preserve raw-response fallback text and recursive newline normalization when changing `parseAiResponse.js`; test plain, parsed, fenced/prose, and invalid responses.
- Add decision-table tests when changing mode/scope/model behavior in `resolveAiRequest.js`; `aiService` must consume the resolved request instead of reimplementing boolean combinations.
- Keep Express objects out of `prepareGenerateAiRequest.js`; it returns a data/error contract that the route maps to HTTP status and JSON.
- Keep Express request/response objects and direct Gemini/storage imports out of generation commands; test success and failure paths using injected fakes.
- Application commands and HTTP history endpoints should depend on the AI history repository port rather than raw `storage.*AiResponse*` methods.
- History routes only extract campaign/id/resource IDs and map command results/errors; draft/apply/undo rules belong to `aiHistoryCommands.js`.
- Keep generation selection and failed-history recovery out of Express handlers; keep `.env` persistence out of application commands and routes.
- Entity scope/move logic in `useSessionView.js`, `useCampaignView.js`, `server/storage.js`.
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
- Lint + Ukrainian encoding check: `npm run lint`.
- Encoding check only: `npm run check:uk`.
- TypeScript contracts: `npm run typecheck`.
- Bestiary copy materialization: `npm run bestiary:materialize-copies`.
- Database bundle scripts: `npm run database:bundle`, `npm run database:bundle:compact`.
- Update 5eTools data: `npm run database:update`.
- Build script exists in `package.json`, but do not propose it as routine validation.
