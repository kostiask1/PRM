# Migration Debt Register

This register records open work after the selective recovery of useful behavior
from accidental side commit `25b5ccc`. That commit is not part of the `fsd`
lineage and is not a migration baseline.

| ID | Status | Debt and evidence | Removal condition | Target |
| --- | --- | --- | --- | --- |
| MD-R02 | In progress | Phase 136 moved the actual configured store to strict `src/app/model/appStore.ts`; `shared/model/appStore.ts` is now a typed delegation-only compatibility facade. Phase 137 removes the first bounded lower-layer direct-facade dependency: `features/settings` receives a typed live `SettingsModalRuntime` from `widgets/sidebar` while retaining its own API/effect/save logic. Phase 138 removes Notes' direct read and the related note-render consumers' duplicate reads through one app-root `SimplifiedNotesProvider`. Phase 139 removes Player Questions' direct dice state/dispatch dependency through a live Sidebar-provided `PlayerQuestionsRuntime`. Phase 140 removes Campaign Entity's embedded refresh action through a widget-provided `onRefreshEntities` command. Phase 141 removes Encounter Editor's direct alert/reload/modal effects through a Monster Stat Block-provided `AddMonsterToEncounterModalRuntime`. Phase 142 removes Rules Reference's direct navigation/error facade through an App-provided `RulesReferenceRuntime`. Phase 143 removes AI attachment controls' direct alert facade through an App-provided `AiAttachmentAlertRuntime` and detaches the feature's generation lifecycle from the global `RequestId` type. Phase 144 removes Editor's direct mention-picker facade dependency through an App-provided `EditorMentionPickerRuntime` while retaining the feature-owned selected/cancelled promise policy. Phase 145 removes Dice's direct facade dependency through an App-provided `DiceRequestRuntime` plus an app-local live request/result host. Phase 146 removes Images' five direct facade consumers through a feature-owned `ImageGalleryRuntime` supplied by a narrow app-local host. Phase 147 removes Campaign Entity Card's two direct facade consumers through a widget-owned `CampaignEntityCreationRuntime` supplied by a narrow app-local host. Phase 148 removes Campaign Search's two direct facade consumers through a widget-owned `CampaignSearchRuntime` supplied by a narrow route-layout host. Phase 149 removes Campaign Entity Modal's direct confirmation/refresh facade access through an App-supplied `CampaignEntityModalRuntime` while keeping localized copy widget-owned. Phase 150 removes Rules Reference Modal's direct navigation/history, modal, error, and open-state facade access through a widget-owned `RulesReferenceModalRuntime` supplied at App root while preserving the stable factory API. Phase 151 removes Spells Browser's direct debounce/campaign/source selectors plus campaign replacement, ignored-source patch, and error facade access through a widget-owned `SpellsBrowserRuntime` supplied at App root while preserving the stable factory slot. Phase 152 removes Monster Stat Block's direct campaigns selector plus modal, error, reload, and dice facade access through a widget-owned `MonsterStatBlockRuntime` supplied at App root while preserving stable Bestiary, AI Response, and Rules Reference slots. Phase 153 removes Sidebar's three direct facade consumers through a widget-owned `SidebarRuntime` supplied by `app/ui/SidebarRuntimeHost.tsx`, which keeps delayed Settings and Player Questions modal children live while preserving navigation, modal, error, import/export, settings, and dice behavior. Phase 154 removes Bestiary Browser's direct facade access through a widget-owned `BestiaryBrowserRuntime` supplied by `app/ui/BestiaryBrowserRuntimeHost.tsx`, keeping raw sync parsing, API/effect ownership, localization, delete confirmation, and stable composition slots widget-owned; remaining page/widget consumers still use the facade, and the accidental commit's JavaScript store design remains incompatible with the current typed reducers and consumers. | Retire the compatibility facade only after its remaining consumers no longer need it or a narrower public contract is explicitly established, while preserving reducer, realtime, modal, navigation, selector, dispatch, and remaining settings behavior. | Phase 155+ |
| MD-R04 | Verification | Recovered campaign/reference lint restrictions are installed and Fallow reports zero boundary violations or cycles. Complete lint/typecheck execution is blocked by the incomplete local dependency tree: `@typescript-eslint/parser` and the `tsc` binary are absent. | Restore/install the declared development dependencies and pass the unchanged complete lint and typecheck gates. | Recovery R5 |

Phase 135 closes `MD-R05` at 421/421 tests with empty production feature and
widget same-layer baselines (`0 / 0 / 0 / 0` each). Phase 136 passes 422/422
tests and establishes the app-owned store composition plus enforced typed
compatibility boundary. Phase 137 passes 423/423 tests and removes Settings'
direct store-facade dependency through a live sidebar-provided runtime. Phase
138 passes 424/424 tests and gives Notes a live app-root simplified-preference
provider without letting the feature import the facade. Phase 139 passes
425/425 tests and gives Player Questions a live Sidebar dice runtime without
letting the feature import the facade. Phase 140 passes 426/426 tests and
gives Campaign Entity a widget-provided refresh command without letting the
feature import the facade. Phase 141 passes 427/427 tests and gives Encounter
Editor a Monster Stat Block-provided modal runtime without letting the feature
import the facade. Phase 142 passes 428/428 tests and gives Rules Reference an
App-provided navigation/error runtime without letting the feature import the
facade. Phase 143 passes 429/429 tests and gives AI attachment controls an
App-provided validation-alert runtime without letting the feature import the
facade. Phase 144 passes 430/430 tests and gives Editor an App-provided
mention-picker runtime without letting the feature import the facade. This does
not close the whole FSD migration. Phase 145 passes 431/431 tests and gives
Dice an App-provided request runtime plus an app-local live request/result host
without letting the feature import the facade. Phase 146 passes 432/432 tests
and gives Images a feature-owned gallery runtime supplied by a narrow app-local
host without letting the feature import the facade. Phase 147 passes 433/433
tests and gives Campaign Entity Card a widget-owned creation runtime supplied
by a narrow app-local host without letting the widget import the facade. Phase
148 passes 434/434 tests and gives Campaign Search a widget-owned runtime
supplied by a narrow route-layout host without letting the widget import the
facade. Phase 149 passes 435/435 tests and gives Campaign Entity Modal an
App-supplied confirmation/refresh runtime without letting the widget import the
facade or move its localized copy into App. Phase 150 passes 436/436 tests and
gives Rules Reference Modal a widget-owned navigation/history and modal-effect
runtime without letting the widget import the facade or change its stable
factory API. Phase 151 passes 437/437 tests and gives Spells Browser a
widget-owned preferences/campaign runtime without letting the widget import the
facade or change its stable factory slot. This does not close the whole FSD
migration. Phase 152 passes 438/438 tests and gives Monster Stat Block a
widget-owned campaigns/modal/dice runtime without letting the widget import the
facade or change its stable factory slots. Phase 153 passes 439/439 tests and
gives Sidebar a widget-owned navigation/modal/settings/dice runtime supplied by
an app-local host without letting any Sidebar code import the facade. Phase 154
passes 440/440 tests and gives Bestiary Browser a widget-owned
preferences/campaign/sync/message runtime supplied by a narrow route-layout
host without letting any Bestiary Browser code import the facade. This does not
close the whole FSD migration:
`MD-R02` remains in progress while remaining lower-layer consumers migrate, and `MD-R04` remains
verification-blocked until the declared local lint/typecheck tooling is
available.

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
| MD-R05 / Phase 129 AI assistant response composition | Closed at 415/415 tests. `AiAssistantPanel` receives its required `ResponseModal` from its composition owners: `MainContent` supplies the public response component to route assistants, and the Bestiary forwards its existing response slot through browser/content composition. The assistant no longer imports the sibling `ai-response-modal` widget, reducing the exact widget baseline to 3 importer files / 6 directed pairs / 6 file edges / 6 declarations while the feature baseline and 11-slice widget catalog remain unchanged. The route key and mount guard, assistant state/hooks/controllers, history-dialog slot, Bestiary assistant mount/props, and closed-overlay/nullable-response behavior remain unchanged. |
| MD-R05 / Phase 130 configured AI response composition | Closed at 416/416 tests. Public `createAiResponseModalComponent` accepts lower-layer structural `CharacterCard`, `LocationCard`, `MonsterStatBlock`, and `MonsterEditorModal` slots; `MainContent` and `EncounterPage` each configure one stable module-scope response component while the raw renderer remains private. The raw response widget no longer owns any sibling-widget imports, reducing the exact widget baseline to 2 importer files / 3 directed pairs / 3 file edges / 3 declarations while the feature baseline and 11-slice widget catalog remain unchanged. Hook/controller/null-guard order, card/stat-block branches, conditional callbacks, editor state, view-before-editor order, route and overlay guards, and Bestiary forwarding remain unchanged. |
| MD-R05 / Phase 131 zero widget baseline | Closed at 417/417 tests. `MainContent` and `EncounterPage` configure rules content through `createRulesReferenceModalContentComponent`, `App` passes the two public rendering slots directly to `RulesReferenceModalHost`, and owner-configured monster editors remove the final three sibling-widget imports. Host gating, content loading/navigation/history, empty selected-item details, selected-Bestiary-only stat rendering, spells-tab-only browser rendering, embedded-selection projection, fresh render options, rule-picker gating, selection cloning, and editor prop precedence remain unchanged. Widget same-layer debt is zero across importer files, directed pairs, file edges, and declarations; the 11-slice widget catalog and feature baseline remain unchanged. |
| MD-R05 / Phase 132 Bestiary AI modal composition | Closed at 418/418 tests. The cross-feature edit/draft shell moved from `features/ai-edit-monster` to the encounter page owner, which reuses one stable `EncounterBestiaryAiModals` symbol directly and injects it into `BestiaryBrowser` through the widget-owned callable structural slot. AI-edit policies and `MonsterAiActionModal` remain feature-owned. Edit-before-draft order, null guards, `general` campaign scope, model/attachment controls, request cancellation, response composition, and resource-level apply/undo forwarding remain unchanged. Feature debt fell to 7 importer files / 10 directed pairs / 10 file edges / 11 declarations; widget debt remains zero and its 11-slice catalog is unchanged. |
| MD-R05 / Phase 133 configured Notes composition | Closed at 419/419 tests. Raw `NoteCard` and its parts remain private behind `createNoteCardComponent`, whose Notes-owned callable contracts accept editor and mention-renderer slots without sibling-feature type imports. Session, campaign, campaign-entity-card, and AI-response owners each configure one stable module-scope component, preserving Lexical identity and all collapse/header/preview/body behavior. The sole Notes allowance and both sibling-feature edges are removed. Feature debt fell to 6 importer files / 8 directed pairs / 8 file edges / 9 declarations; widget debt remains zero and its 11-slice catalog is unchanged. |
| MD-R05 / Phase 134 configured rich rendering | Closed at 420/420 tests. `renderMentionText` moved unchanged to entity-link and raw `EntityLink` left the public facade. Raw `RulesLink`, `parseRollsAndSpells`, and `renderRecursiveContent` remain private behind `createRulesLinkComponent` and `createRichContentRenderers`; monster-stat-block, spells-browser, and rules-reference-modal configure stable module-scope symbols through feature public entries. The four stale rich-content/rules-reference allowances are removed. Feature debt fell to 4 importer files / 4 directed pairs / 4 file edges / 5 declarations; widget debt remains zero and its 11-slice catalog is unchanged. This checkpoint left the final AI/editor/images/entity-link/settings cluster for Phase 135. |
| MD-R05 / Phase 135 zero feature and widget baselines | Closed at 421/421 tests. AI attachment/prompt and settings UI use structural factories configured once at encounter, AI-assistant, and sidebar owners. `App` supplies the stable `EditableFieldEntityLinkRuntime` through `EditableFieldEntityLinkProvider`; fields read the injected entity-link Context objects locally and preserve their own modal state, opener behavior, nested scopes, and editor identity. The production feature and widget baselines are both empty (`0 / 0 / 0 / 0`), while `createFsdSameLayerFileEdgeRule` accepts a synthetic test baseline to keep allowed/stale branch coverage without production allowances. This closes `MD-R05`; it does not close the broader FSD migration or the separate `MD-R02` and `MD-R04` work. |

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
