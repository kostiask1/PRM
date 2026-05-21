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
- `src/components/MainContent.jsx` - вибирає основний екран за URL/state: `CampaignView`, `SessionView`, `EncounterView`, `Bestiary`, `Spells`.
- `src/store/appStore.js` - легкий глобальний store через `useSyncExternalStore`; navigation, modal, messages, dice, language, UI settings.
- `src/api.js` - єдиний frontend API wrapper для `/api/...`.
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
- Main UI: `src/components/CampaignView.jsx`.
- Main logic: `src/hooks/useCampaignView.js`, `src/models/CampaignViewModel.js`, `src/features/campaign/campaignStateUtils.js`.
- Backend: `server/routes/campaigns.js`, `server/routes/backups.js`, `server/storage.js`.
- Important files: `CharacterCard.jsx`, `LocationCard.jsx`, `NoteCard.jsx`, `DraggableList.jsx`, `CampaignNotesGraph.jsx`, `GlobalSearchModal.jsx`, `PartialArchiveModal.jsx`.

### Sessions and Scenes

- What: session planning, scenes, scene notes, session-scoped NPC/location entities, encounter links, todo/prep state.
- Main UI: `src/components/SessionView.jsx`, `src/components/session/*`.
- Main logic: `src/hooks/useSessionView.js`, `src/models/SessionViewModel.js`.
- Backend: `server/routes/sessions.js`, `server/storage.js`.
- Business detail: NPC/location can be campaign-scoped or session-scoped; scope changes must preserve IDs/references where intended.

### Encounters

- What: combat encounters linked to session scenes, monsters/characters, HP, initiative, grid/focused views, import/export.
- Main UI: `src/components/EncounterView.jsx`.
- Main logic: `src/hooks/useEncounterView.js`, `src/utils/encounters.js`.
- Backend data path: stored inside session data, not a separate DB.
- Important integrations: `Bestiary.jsx`, `MonsterStatBlock.jsx`, `AddMonsterToEncounterModalContent.jsx`.

### Bestiary and Custom Monsters

- What: browse local bestiary, favorites, custom creatures, custom monster CRUD/import/export, token image upload.
- Main UI: `src/components/Bestiary.jsx`, `src/components/MonsterStatBlock.jsx`.
- Main logic: `src/models/MonsterStatBlockModel.js`, `src/utils/bestiary.js`, `server/aiCustomMonsterService.js`.
- Backend: `server/routes/bestiary.js`, `server/storage.js`.
- Data:
  - Official/local reference: `database/bestiary/all.json`, `database/bestiary/legendarygroups.json`, `database/bestiary/tokens/`.
  - Custom monsters: `data/custom-bestiary.json`.
- Important rule: custom monster legendary actions live on the monster object; do not move them to a separate legendary group file.

### Spells and Rules References

- What: spell browser, condition/disease/variant rule/skill/sense references, parsed 5eTools-style tags.
- Main UI: `src/components/Spells.jsx`, `src/components/SpellCard.jsx`, `src/components/RulesLink.jsx`.
- Main logic: `src/renderers/contentRenderer.jsx`, `src/utils/parser.jsx`, `src/utils/contentTokens.js`, `src/services/referenceResolvers.js`.
- Backend: `server/routes/spells.js`.
- Data: `database/spells/all.json`, `database/conditions.json`, `database/diseases.json`, `database/skills.json`, `database/senses.json`, `database/variantrules.json`.

### AI Assistance

- What: prompt UI, context selection, image prompt generation, parsed operations, draft/apply/undo, history and retry.
- Main UI: `src/components/AiAssistantPanel.jsx`, `src/components/ai/AiResponseModal.jsx`, `src/components/ai/AiResponseHistory.jsx`, `src/components/ai/AiImagePromptPickerModal.jsx`.
- Backend: `server/routes/ai.js`, `server/aiService.js`, `server/aiPatchService.js`, `server/aiPayloadSchemas.js`, `server/aiHistoryService.js`, `server/aiResponseHistoryService.js`.
- Schema: parsed AI must return `{ "version": 2, "operations": [...] }`.
- Allowed operation style is domain-specific (`create`, `update`, `delete`, `appendNote`, `updateNote`, `deleteNote`, `moveScope`), not raw RFC JSON Patch.
- AI history is campaign-scoped in `data/campaigns/{slug}/_aiResponses.json`.

### Images

- What: upload/list/move/rename/delete campaign/general images; attach images to campaigns/entities/scenes/monsters.
- Main UI: `src/components/ImageGallery.jsx`, `src/components/ImageDropzone.jsx`, `src/components/ImageAssetField.jsx`, `src/features/images/imageGalleryConfig.js`.
- Backend: `server/routes/images.js`, `server/storage.js`.
- Data: `data/images/{campaignSlug|general}/{category}/{optionalSubcategory}`.
- Categories from config: `maps`, `scenes`, `tokens`, `characters`, `props`, `notes`, `attachments`.

### Global Search and Mentions

- What: campaign-wide search across notes, scenes, NPC, locations, sessions, custom monsters, mentions.
- Main UI: `src/components/campaign/GlobalSearchModal.jsx`.
- Mentions: bracketed text like `[Name]` rendered by `EntityLink.jsx` and context utilities.
- Important parsing: do not turn text inside `pre`/`code` into entity links.

### Import, Export, Backups

- What: full backup/archive, campaign archive, partial campaign archive, custom bestiary import/export.
- Backend: `server/routes/backups.js`, `server/storage.js`.
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
- Views call `src/api.js`; API calls Express routes under `/api`.
- `server/storage.js` reads/writes JSON and files under `data/`.
- Campaign metadata: `data/campaigns/{slug}/_campaign.json`.
- Entities: `data/campaigns/{slug}/characters|npc|locations/{entitySlug}/info.json`.
- Sessions: `data/campaigns/{slug}/sessions/{fileName}.json`.
- AI parsed response flow:
  1. `AiAssistantPanel.jsx` sends payload to `/api/ai/generate`.
  2. `server/aiService.js` builds prompt/context.
  3. `server/aiPayloadSchemas.js` validates operation schema.
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

- `server/storage.js` path normalization, import/export/archive behavior, and image reference updates.
- `server/aiService.js`, `server/routes/ai.js`, `server/aiPatchService.js`, `server/aiPayloadSchemas.js` prompt/schema/apply flow.
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
- Bestiary copy materialization: `npm run bestiary:materialize-copies`.
- Database bundle scripts: `npm run database:bundle`, `npm run database:bundle:compact`.
- Update 5eTools data: `npm run database:update`.
- Build script exists in `package.json`, but do not propose it as routine validation.

## Unknown / Needs Verification

- Production deployment target beyond local `dist/` serving is unknown / needs verification.
- Full canonical schema for every campaign/session field is implicit in storage normalizers and UI models, not separately documented.
- Whether `src/langs/en.json` is intentionally empty/minimal is unknown / needs verification.
- External source/update policy for `database/` depends on scripts and should be verified before changing bundled data.
