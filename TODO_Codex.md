# TODO для поетапної доробки проєкту PRM

> Робочий беклог для наступних запитів.  
> Важливо: при кожній зміні перевіряти українські тексти на валідність і кодування (щоб не з'являлись `?` або "кракозябри").

## P0. Критично перед іншими задачами

- [x] **Аудит кодування текстів (UTF-8)** у фронтенді й бекенді:
  - `src/App.jsx`
  - `src/components/MainContent.jsx`
  - `src/components/Sidebar.jsx`
  - `src/components/CampaignView.jsx`
  - `src/components/SessionView.jsx`
  - `src/api.js`
  - `server/server.js`
  - `server/routes/campaigns.js`
  - `server/routes/sessions.js`
  - `server/storage.js`
- [x] Уніфікувати повідомлення UI/помилок українською мовою та перевірити, що всі рядки читаються коректно.

## 1. Розбиття на підкомпоненти

- [ ] Винести з `src/App.jsx` модальні блоки `EntityModalContent` і `MentionPickerModalContent` у `src/components/modals/*`.
- [ ] Винести роутинг-логіку з `src/components/MainContent.jsx` у окремий компонент/хук (щоб прибрати залежність від `window.location.pathname` у рендері).
- [ ] Винести повторюваний заголовок секції з кнопкою згортання з `CampaignView`/`SessionView` у універсальний `CollapsibleSection`.
- [ ] Винести повторювані списки з `DraggableList + ListCard` у композиційні компоненти:
  - `CampaignList`
  - `SessionList`
  - `EntityList` (characters/npc)
- [ ] Розбити `SceneCard` (всередині `SessionView.jsx`) на підкомпоненти:
  - `SceneCardHeader`
  - `SceneCardMedia`
  - `SceneCardFields`

## 2. Допрацювання структури та архітектури

- [ ] Зменшити "товсті" HOC:
  - `src/hoc/withCampaignView.jsx`
  - `src/hoc/withSessionView.jsx`
  - рознести на `hooks + services + ui-state` (наприклад: `useCampaignEditor`, `useSessionEditor`).
- [ ] Винести загальні CRUD-операції для нотаток/персонажів/NPC у `src/services` або `src/utils/editor`.
- [ ] Прибрати direct `window.dispatchEvent`/`window.addEventListener` для внутрішньої взаємодії і замінити на React Context/подієвий bus в межах застосунку.
- [ ] Стандартизувати схему даних між сервером та клієнтом:
  - єдині типи для `id`, `slug`, `fileName`
  - валідатори payload на сервері для `campaigns`, `sessions`, `entities`.
- [ ] Додати центральний обробник помилок API на клієнті (map статусів -> локалізовані повідомлення).

## 3. Доробка стилів і кольорів

- [ ] Прибрати змішаний підхід стилізації (SCSS + велика кількість локальних CSS) і визначити єдину стратегію (рекомендовано: SCSS + модульна структура по фічах).
- [ ] Рефакторнути дизайн-токени:
  - кольори, відступи, типографіка, radius, shadow.
- [ ] Підвищити контрастність ключових елементів для light/dark тем.
- [ ] Уніфікувати стилі кнопок, заголовків, бейджів, інпутів між `CampaignView`, `SessionView`, `Sidebar`, `Modal`.
- [ ] Перевірити мобільну адаптивність для основних екранів (Sidebar, SceneCard, модалки, списки).

## 4. Допрацювання логіки

- [ ] Усунути потенційні витоки подій у `App.jsx` (додати cleanup для `keydown/keyup/mouseup` слухачів).
- [ ] Уніфікувати debounce/autosave логіку (зараз різні таймаути/підходи в `withCampaignView` і `withSessionView`).
- [ ] Замінити порівняння через `JSON.stringify` у history/undo-logic на більш контрольований diff.
- [ ] Виправити інконсистентність оновлення NPC у `CampaignView` (перевірити, що reorder/collapse/save працюють однаково з characters).
- [ ] Додати оптимістичні оновлення з rollback для критичних CRUD дій.
- [ ] Переглянути навігацію/стан при `ctrl/meta + click`, `popstate`, відкритті модалок та переходах між campaign/session/encounter.

## 5. Створення компонентів з повторюваних блоків

- [ ] `CollapsibleSection` для секцій з однаковим патерном заголовка.
- [ ] `EntityEditorCard` (базовий) для персонажів і NPC.
- [ ] `NotesEditorList` для повторюваної логіки notes (auto-add порожньої нотатки, delete fallback).
- [ ] `ExportImportActions` для однакових операцій backup/export/import.
- [ ] `ConfirmableActionButton` для повторюваних delete/confirm сценаріїв.

## 6. Оптимізація коду

- [ ] Зменшити зайві ререндери через стабілізацію callback/props у великих списках (`DraggableList`, `CharacterCard`, `NoteCard`).
- [ ] Ліниво підвантажувати важкі модулі (`Bestiary`, `Spells`, `ImageGallery`, `AiAssistantPanel`) через `React.lazy`.
- [ ] Винести обчислення view-model рівня в memoized селектори (особливо для сцен, encounter lookup, progress).
- [ ] Додати кешування/інвалідацію API-запитів (мінімум для campaign/session/entities).
- [ ] Переглянути розмір бандла і внести targeted-оптимізації (розбиття chunk-ів, зменшення дублювання залежностей).

## 7. Тестування та якість

- [ ] Додати мінімальний набір тестів для критичних сценаріїв:
  - створення/перейменування/видалення кампанії
  - створення/редагування/видалення сесії
  - undo/redo
  - autosave
  - робота з NPC/персонажами.
- [ ] Додати smoke-тести для API-роутів `campaigns/sessions/entities/images`.
- [ ] Додати lint-правила/перевірку на кодування текстів перед комітом (UTF-8 guard).

## Рекомендований порядок виконання

- [x] Крок 1: P0 аудит кодування + виправлення текстів.
- [x] Крок 2: декомпозиція `App.jsx`, `CampaignView.jsx`, `SessionView.jsx`.
- [ ] Крок 3: рефактор HOC у hooks/services.
- [ ] Крок 4: уніфікація стилів і токенів.
- [ ] Крок 5: оптимізація і тести.
