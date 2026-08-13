# Migration Debt Register

This register records open work after the selective recovery of useful behavior
from accidental side commit `25b5ccc`. That commit is not part of the `fsd`
lineage and is not a migration baseline.

| ID | Status | Debt and evidence | Removal condition | Target |
| --- | --- | --- | --- | --- |
| MD-R02 | Closed | Phase 136 introduced a temporary typed `shared/model/appStore.ts` delegation facade and private runtime port while Phases 137-158 migrated every remaining lower-layer consumer to narrow injected runtimes. Phase 159 deletes both transitional files, removes their barrel/runtime registration and the obsolete app-store-runtime-owner checker, and moves `SessionPageRuntimeHost` navigation to `app/model`. `app/model` is the sole stateful store/selector/modal/navigation owner; `shared/model` contains global action contracts/creators, action/state types, and lower-level reducer policies only. | Do not recreate a shared global-store facade/runtime, restore its registration/checker, or let lower layers import the global store. Preserve existing scoped facade-boundary rules and injected runtime contracts. | Closed at Phase 159 |
| MD-R02 / Phase 155 | Completed slice | AI Assistant no longer imports the compatibility facade: its widget-owned `AiAssistantRuntime` receives only live route/prompt/navigation state plus narrow selection, reload, refresh, sync, confirmation, and message commands from `app/ui/AiAssistantRuntimeHost.tsx`. One route-layout scope covers both the ordinary assistant and the Bestiary-injected assistant while route projection, generation/retry, history, local loaders, and response composition remain widget-owned. | Keep the runtime hook private, public props/slots runtime-free, and the scoped widget boundary in force while page consumers migrate. | Phase 156+ |
| MD-R02 / Phase 156 | Completed slice | Session Page no longer imports the compatibility facade: its page-owned `SessionPageRuntime` receives live active campaign/session/sync state plus narrow campaign/session/encounter navigation, active-session selection, campaign reload, entity refresh, confirmation, prompt, and message commands from `app/ui/SessionPageRuntimeHost.tsx`. The existing `SessionRoute` campaign guard scopes the provider only around the page while session loading/normalization, sync decisions, editing/history/persistence, scope movement, encounter creation, keyboard/hash behavior, and quick-access projection remain page-owned. | Keep the runtime hook private, expose only provider/types through the page entry, preserve runtime-free `SessionPage`, and keep the scoped page boundary in force while remaining page consumers migrate. | Phase 157+ |
| MD-R02 / Phase 157 | Completed slice | Encounter Page no longer imports the compatibility facade: its page-owned `EncounterPageRuntime` receives live campaign/session/encounter/sync, dice, theme/language, and encounter-view settings state plus narrow session navigation, active selection, campaign reload, entity refresh, dice, prompt, UI-settings patch, and message commands from `app/ui/EncounterPageRuntimeHost.tsx`. The existing `EncounterRoute` campaign guard scopes the provider only around the page while encounter load/save, active publication, sync/AI handling, participant workflows, HP-roll de-duplication, settings persistence, and localized error/finally behavior remain page-owned. | Keep the runtime hook private, expose only provider/types through the page entry, preserve runtime-free `EncounterPage`, and keep the scoped full facade boundary in force while remaining page consumers migrate. | Phase 158+ |
| MD-R02 / Phase 158 | Completed slice | Campaign Page no longer imports the compatibility facade: its page-owned `CampaignPageRuntime` receives live active-campaign, entity-refresh/sync, theme, and language state plus narrow campaign-list/renamed-campaign/session navigation, graph-note modal, campaign reload, confirmation, prompt, and message commands from `app/ui/CampaignPageRuntimeHost.tsx`. The existing `CampaignRoute` campaign guard scopes the provider only around the page while campaign/session/entity loading and persistence, history, sync/AI flows, graph layout/note editing, archive/import/export, and localized workflow copy remain page-owned. | Keep the runtime hook private, expose only provider/types through the page entry, preserve runtime-free `CampaignPage`, and keep the scoped full facade boundary in force. Phase 159 completes the planned facade retirement. | Phase 159 |
| MD-R02 / Phase 159 | Completed closure | Deleted the former shared app-store facade/runtime, moved the Session Page host's navigation import to `app/model`, and removed the obsolete private-port checker. The current source/import inventory leaves the app-owned runtime hosts on `app/model` and lower layers behind injected runtimes. | Preserve `app/model` as the sole stateful store/selector/modal/navigation owner, `shared/model` as action/type/reducer policy only, and the scoped lower-layer facade boundaries. | Closed |
| MD-R02 / Phase 160 | Completed app-shell consolidation | Moved the app-wide mention-picker request subscription, active-campaign entity reads, callback validation/options projection, and modal lifecycle from root `App` into `app/ui/MentionPickerModalHost.tsx`. The Editor remains behind its injected `EditorMentionPickerRuntime`; its promise/selection policy and UI stay feature-owned. | Keep the host inside the editor runtime provider, retain `App`'s narrow `openMentionPickerAction` adapter, and do not reintroduce feature store access or a shared store facade. | 446/446 tests; architecture maintained |
| MD-R02 / Phase 161 | Completed widget-local consolidation | Moved Rules Reference Modal mounted/controller/requested-tab/loading/error lifecycle into private `widgets/rules-reference-modal/ui/useReferenceTabLoading.ts`. The widget retains its seven-tab API aggregation and browser/abort effects; `RulesReferenceModalContent` retains navigation/history, search, selection, scrolling, and rendering. | Keep the hook private to widget UI, preserve active-request/abort/mounted/retry/error ordering, and do not widen `model.js`, the public widget entry, runtime provider, or stable content factory. | 447/447 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 162 | Completed widget-local consolidation | Moved AI Response Modal creature-field draft editing coordination into private `widgets/ai-response-modal/ui/aiResponseCreatureFieldEditing.ts`. `AiResponseModal` retains configured factory/composition, state/controller/guard order, injected slots, preview rendering, and editor placement. | Keep the controller private; preserve eligibility guards, identity fields, encounter participant replacement, draft-resource resolution/update, and close-after-update order without widening widget public entries. | 448/448 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 163 | Completed widget-local consolidation | Moved AI Response Modal JSON-diff markup into private `widgets/ai-response-modal/ui/AiResponseJsonDiff.tsx`. `AiResponseModal` retains configured factory/composition, state/controller/guard order, injected slots, preview tree, and editor placement. | Keep the renderer private; preserve resource/field/line keys, localized labels, resource states, line classes/markers, and number/text fallbacks without widening widget public entries. | 449/449 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 164 | Completed widget-local consolidation | Moved AI Response Modal generic snapshot-diff presentation into private `widgets/ai-response-modal/ui/AiResponseGenericDiff.tsx`. `AiResponseModal` retains configured factory/composition, state/controller/guard order, injected slots, preview tree, and editor placement. | Keep the renderer private; preserve snapshot selection, metadata exclusion, field fallback/order, nested notes delegation, keys, localized Before/After labels, formatted values, and CSS classes without widening widget public entries. | 450/450 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 165 | Completed widget-local consolidation | Moved AI Response Modal card-diff presentation into private `widgets/ai-response-modal/ui/AiResponseCardDiff.tsx`. `AiResponseModal` retains configured factory/composition, state/controller/guard order, every injected card/editor slot tag, preview tree, outer card resource shell, and editor placement. | Keep the renderer private; preserve new/deleted/changed routing, snapshot selection, labels/classes, draft/apply eligibility, highlight construction, and callback argument order without widening widget public entries. | 451/451 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 166 | Completed widget-local consolidation | Moved AI Response Modal encounter participant-list presentation into private `widgets/ai-response-modal/ui/AiResponseEncounterParticipantList.tsx`. `AiResponseModal` retains configured factory/composition, state/controller/guard order, encounter-side panels, encounter MonsterStatBlock slots, encounter editing/resource composition, preview tree, and editor placement. | Keep the renderer private; preserve entry/map derivation, empty state, participant keys, ordered classes, names, and both metadata evaluations without widening widget public entries. | 452/452 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 167 | Completed widget-local consolidation | Moved Bestiary Browser header-action presentation/action dispatch, menu-local state, and refs into private `widgets/bestiary-browser/ui/BestiaryHeaderActions.tsx`. `BestiaryBrowser` retains custom-monster import parsing/persistence/messages, JSON export, undo/redo operations and stacks, and `BestiaryContent` composition. | Keep the component private; preserve the always-mounted menu, hidden `.json` input, functional toggle, class/title/icon/copy, close-before-action order, and disabled capability flags without widening widget public entries. | 453/453 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 168 | Completed shared UI consolidation | Extracted duplicate open-only header-action pointer dismissal from Campaign Page, Session Page, and private Bestiary Header Actions to public `shared/ui/usePointerDownOutsideDismissal.ts`; each consumer retains state, ref, menu presentation, and commands. | Keep the hook limited to conditional `pointerdown` cleanup/root containment; retain guards/toggle/close-before-action order; do not alter Encounter/Dice behavior, Select/MultiSelect portal lifecycle, or widen Bestiary API. | 454/454 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 169 | Completed widget-local consolidation | Moved AI Response Modal note-diff presentation into private `widgets/ai-response-modal/ui/AiResponseNoteDiff.tsx`. `AiResponseModal` retains configured factory/composition, state/controller/guard order, injected slots, `AiResponseNoteCard` factory, `renderNoteCard` draft callback, twice-resolved resource flow, nested note-array identity synthesis, preview classification, and editor placement. | Keep the renderer private; preserve new/deleted/changed snapshot routing, labels/classes, draft/apply eligibility, note highlight construction, resource key/header, and callback argument order without widening widget public entries. | 455/455 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 170 | Completed page/shared UI consolidation | Moved Campaign Page header-action presentation, menu-local state/refs, and shared dismissal composition into private `pages/campaign/ui/components/CampaignHeaderActions.tsx`; `CampaignHeader` retains title/rename/created metadata and passes narrow workflow commands. Consolidated the duplicate Campaign/Session undo-redo pair in public `shared/ui/UndoRedoButtons.tsx`. | Keep page menu ownership private and the shared component limited to the fragment-only pair plus optional disabled gate; preserve menu lifecycle, direct search/undo/redo behavior, capability/saving flags, classes/copy, and close-before-action order without public page/runtime/store expansion. | 456/456 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 171 | Completed widget-local consolidation | Moved AI Response Modal encounter monster-change presentation into private `widgets/ai-response-modal/ui/AiResponseEncounterMonsterChange.tsx`. `AiResponseModal` retains configured factory/composition, state/controller/guard order, `renderEncounterMonsterCard` MonsterStatBlock/edit slot, participant entries/maps/change detection, draft/apply eligibility, highlights, labels, keys, and encounter composition. | Keep the renderer private; pass only prepared card/label slots and preserve single/paired stack/column/frame/title markup and render/evaluation order without widening widget public entries. | 457/457 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 172 | Completed feature-local consolidation | Moved Monster Field Edit Modal action-section presentation into private `features/edit-monster/ui/MonsterActionSections.tsx`. `MonsterFieldEditModal` retains draft/JSON synchronization, action mutations, rule-picker lifecycle, parsing, save, and error ownership. | Keep the presenter private and Fragment-only; forward original change/keyboard events to raw functional callbacks, preserve action section order/keys/classes/copy, and do not widen the feature public entry. | 458/458 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 173 | Completed feature-local consolidation | Moved Monster Field Edit Modal fields-mode layout into private `features/edit-monster/ui/MonsterFieldSections.tsx`. `MonsterFieldEditModal` retains all draft/JSON, raw field-renderer, action, rule-picker, parsing, save, and error ownership. | Keep the presenter private and Fragment-only; precompute field/action slots in raw evaluation order, preserve four wrapper groups/order/classes, fields/keys/disabled/custom-select/textarea behavior, and do not widen the public entry. | 459/459 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 174 | Completed page-local consolidation | Moved Session Page header action-menu presentation into private `pages/session/ui/components/SessionHeaderActions.tsx`. `SessionView` retains menu state/ref, shared pointer-dismissal lifecycle, global-search state, functional toggle, and close-before-search/undo/redo/delete commands; `SessionHeader` retains title and encounter quick access. | Keep the presenter private; preserve the always-mounted ref root/classes/open state, menu/button order, icons/copy, saving-disabled undo/redo gate, and no public page/runtime/store expansion. | 460/460 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 175 | Completed widget-local consolidation | Moved AI Response Modal preview-resource header markup into private `widgets/ai-response-modal/ui/AiResponsePreviewResourceHeader.tsx`. `AiResponseModal` retains default/fallback resource-label reads plus resource-state/action evaluation and policy. | Keep the leaf private and DOM-only; precompute label, state, and actions in raw order, preserve root/span/action hierarchy and CSS classes, and do not widen widget public entries. | 461/461 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R04 | Verification | Recovered campaign/reference lint restrictions are installed and Fallow reports zero boundary violations or cycles. Complete lint/typecheck execution is blocked by the incomplete local dependency tree: `@typescript-eslint/parser` and the `tsc` binary are absent. | Restore/install the declared development dependencies and pass the unchanged complete lint and typecheck gates. | Recovery R5 |

Phase 135 closes `MD-R05` at 421/421 tests with empty production feature and
widget same-layer baselines (`0 / 0 / 0 / 0` each). Phase 136 passes 422/422
tests and establishes the app-owned store composition plus a temporary enforced
typed compatibility boundary. Phase 137 passes 423/423 tests and removes Settings'
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
close the whole FSD migration. Phase 155 passes 441/441 tests and gives AI
Assistant a widget-owned route/prompt/navigation and workflow-command runtime
supplied by one route-layout host around both its ordinary route and injected
Bestiary mounts without letting any AI Assistant code import the facade. This
does not close the whole FSD migration. One added static regression brings
Phase 156 to 442/442 tests and gives Session Page a page-owned
campaign/session/sync and workflow-command runtime supplied by a narrow
`SessionRoute` host without letting any Session Page code import the facade.
Phase 157 passes 443/443 tests and gives Encounter Page a page-owned
campaign/session/encounter/sync, dice/theme/language/settings, and
workflow-command runtime supplied by a narrow `EncounterRoute` host without
letting any Encounter Page code import the facade. Phase 158 passes 444/444
tests and gives Campaign Page a page-owned active-campaign,
entity-refresh/sync, theme/language, and workflow-command runtime supplied by
a narrow `CampaignRoute` host without letting any Campaign Page code import the
facade. Architecture, performance, and Ukrainian encoding checks also pass.
Phase 159 deletes the temporary `shared/model/appStore.ts` facade and
`appStoreRuntime.ts` port, removes the former private-port checker, and moves
`SessionPageRuntimeHost` navigation to `app/model`. This closes `MD-R02`:
`app/model` is the sole stateful store/selector/modal/navigation owner and
`shared/model` contains action/type/reducer policy only. `MD-R04` remains
verification-blocked until the declared local lint/typecheck tooling is
available. The expanded suite passes 445/445 tests; architecture, performance,
and Ukrainian encoding checks pass.
Phase 160 moves the app-wide mention-picker request/entity/modal workflow from
root `App` to `app/ui/MentionPickerModalHost.tsx`, while the Editor keeps its
injected runtime plus feature-owned promise and selection policy. This is
app-shell consolidation after the `MD-R02` closure, not a return to a shared
store facade. The expanded suite passes 446/446 tests; architecture,
performance, and Ukrainian encoding checks pass. `MD-R04` remains
verification-blocked until the declared local lint/typecheck tooling is
available.
Phase 161 moves the Rules Reference Modal's mounted/controller/requested-tab/
loading/error lifecycle into private `ui/useReferenceTabLoading.ts`, keeping
the seven-tab API and `AbortController` effects widget-owned. It preserves the
Node-safe model, public widget entry, injected runtime, and stable content
factory without creating a shared loader or public API expansion. The expanded
suite passes 447/447 tests; architecture, performance, and Ukrainian encoding
checks pass. `MD-R02` remains closed; `MD-R04` remains verification-blocked
until the declared local lint/typecheck tooling is available.
Phase 162 moves AI Response Modal creature-field draft editing coordination
into private `ui/aiResponseCreatureFieldEditing.ts`. It preserves the raw
renderer composition order, configured factory/public entries, injected slots,
preview tree, and editor placement while retaining eligibility guards, identity
preservation, encounter replacement, draft updates, and close ordering. The
expanded suite passes 448/448 tests; architecture, performance, and Ukrainian
encoding checks pass. `MD-R02` remains closed; `MD-R04` remains
verification-blocked until the declared local lint/typecheck tooling is
available.
Phase 163 moves AI Response Modal JSON-diff markup into private
`ui/AiResponseJsonDiff.tsx`. It preserves raw renderer composition/state
ordering, configured factory/public entries, injected slots, preview tree, and
editor placement while retaining resource/field/line keys, localized labels,
resource states, line markers/classes, and number/text fallbacks. The expanded
suite passes 449/449 tests; architecture, performance, and Ukrainian encoding
checks pass. `MD-R02` remains closed; `MD-R04` remains verification-blocked
until the declared local lint/typecheck tooling is available.
Phase 164 moves AI Response Modal generic snapshot-diff presentation into
private `ui/AiResponseGenericDiff.tsx`. It preserves raw renderer
composition/state ordering, configured factory/public entries, injected slots,
preview tree, and editor placement while retaining snapshot selection, metadata
exclusion, fallback fields, field ordering, nested notes delegation, keys,
localized Before/After labels, formatted values, and CSS classes. The expanded
suite passes 450/450 tests; architecture, performance, and Ukrainian encoding
checks pass. `MD-R02` remains closed; `MD-R04` remains verification-blocked
until the declared local lint/typecheck tooling is available.
Phase 165 moves AI Response Modal card-diff presentation into private
`ui/AiResponseCardDiff.tsx`. It preserves raw renderer composition/state
ordering, configured factory/public entries, every injected card/editor slot
tag, preview tree, outer card resource shell, and editor placement while
retaining new/deleted/changed routing, snapshot selection, labels/classes,
draft/apply eligibility, highlight construction, and callback argument order.
The expanded suite passes 451/451 tests; architecture, performance, and
Ukrainian encoding checks pass. `MD-R02` remains closed; `MD-R04` remains
verification-blocked until the declared local lint/typecheck tooling is
available.
Phase 166 moves AI Response Modal encounter participant-list presentation into
private `ui/AiResponseEncounterParticipantList.tsx`. It preserves raw renderer
composition/state ordering, configured factory/public entries, encounter-side
panels, encounter MonsterStatBlock slots, encounter editing/resource
composition, preview tree, and editor placement while retaining entry/map
derivation, empty state, participant keys, ordered classes, names, and both
metadata evaluations. The expanded suite passes 452/452 tests; architecture,
performance, and Ukrainian encoding checks pass. `MD-R02` remains closed;
`MD-R04` remains verification-blocked until the declared local lint/typecheck
tooling is available.
Phase 167 moves Bestiary Browser header-action presentation/action dispatch,
menu-local state, and refs into private
`ui/BestiaryHeaderActions.tsx`. `BestiaryBrowser` retains custom-monster import
parsing/persistence/messages, JSON export, undo/redo operations and stacks,
and `BestiaryContent` composition while the private component preserves the
always-mounted menu, hidden `.json` input, functional toggle,
classes/titles/icons/copy, close-before-action order, and disabled capability
flags. The expanded suite passes 453/453 tests; architecture, performance, and
Ukrainian encoding checks pass. `MD-R02` remains closed; `MD-R04` remains
verification-blocked until the declared local lint/typecheck tooling is
available.
Phase 168 centralizes the behaviorally identical Campaign Page, Session Page,
and Bestiary header pointer-dismissal lifecycle in public shared UI
`usePointerDownOutsideDismissal.ts`. Each consumer retains state, root ref,
menu presentation, and commands while the hook preserves the open-only
`pointerdown` listener/cleanup, `Node` containment guard, inside-root no-op,
and outside/non-Node close. The expanded suite passes 454/454 tests;
architecture, performance, and Ukrainian encoding checks pass. `MD-R02`
remains closed; `MD-R04` remains verification-blocked until the declared local
lint/typecheck tooling is available.

Phase 169 moves AI Response Modal note-diff presentation into private
`ui/AiResponseNoteDiff.tsx`. The raw renderer retains configured
factory/composition, state/controller/guard order, injected slots, the
`AiResponseNoteCard` factory and draft-update callback, twice-resolved resource
flow, nested note-array identity synthesis, preview classification, and editor
placement. The private renderer preserves new/deleted/changed routing,
labels/classes, draft/apply eligibility, note highlights, resource key/header,
and callback order. The expanded suite passes 455/455 tests; architecture,
performance, and Ukrainian encoding checks pass. `MD-R02` remains closed;
`MD-R04` remains verification-blocked until the declared local lint/typecheck
tooling is available.

Phase 170 moves Campaign Page header-action presentation, menu-local state/ref,
and shared pointer-dismissal composition into private
`ui/components/CampaignHeaderActions.tsx`. `CampaignHeader` retains campaign
title/rename/created metadata and passes narrow search, partial-archive,
undo/redo, export, and deletion commands. The Fallow-detected duplicate
Campaign/Session undo-redo pair is consolidated in public
`shared/ui/UndoRedoButtons.tsx`, which remains a fragment-only pair with an
optional disabled gate. The phase preserves the always-mounted menu,
pointer-dismissal lifecycle, functional toggle, labels/classes/icons, direct
search/undo/redo callbacks, capability/saving flags, and close-before-action
order. The expanded suite passes 456/456 tests; architecture, performance, and
Ukrainian encoding checks pass. `MD-R02` remains closed; `MD-R04` remains
verification-blocked until the declared local lint/typecheck tooling is
available.

Phase 171 moves AI Response Modal encounter monster-change presentation into
private `ui/AiResponseEncounterMonsterChange.tsx`. The raw renderer retains
participant mapping/change detection, MonsterStatBlock field-edit composition,
draft/apply guards, highlights, localized labels, keys, and encounter rendering;
the private component receives prepared slots only and preserves the existing
single/paired layout markup and order. The expanded suite passes 457/457 tests;
architecture, performance, and Ukrainian encoding checks pass. `MD-R02` remains
closed; `MD-R04` remains verification-blocked until the declared local
lint/typecheck tooling is available.

Phase 172 moves Monster Field Edit Modal action-section presentation into private
`ui/MonsterActionSections.tsx`. The raw feature modal retains draft/JSON
synchronization, functional action mutations, Ctrl+K rule-picker detection and
selection state, parsing, save, and error ownership. The private component
forwards original change/keyboard events to raw callbacks, returns no DOM wrapper,
and preserves section order, keys, classes, copy, and action fields. The expanded
suite passes 458/458 tests; architecture, performance, and Ukrainian encoding
checks pass. `MD-R02` remains closed; `MD-R04` remains verification-blocked until
the declared local lint/typecheck tooling is available.

Phase 173 moves Monster Field Edit Modal fields-mode layout into private
`ui/MonsterFieldSections.tsx`. The raw feature modal retains draft/JSON
synchronization, field renderer/field-read and select-fallback behavior, action
composition, update and Ctrl+K rule-picker callbacks, parsing, save, error, and
modal lifecycle ownership. It precomputes basic, ability, text, and action slots
in the original raw evaluation order; the private Fragment-only component keeps
only their four wrapper groups and their classes/order. The expanded suite passes
459/459 tests; architecture, performance, and Ukrainian encoding checks pass.
`MD-R02` remains closed; `MD-R04` remains verification-blocked until the declared
local lint/typecheck tooling is available.

Phase 174 moves Session Page header action-menu presentation into private
`ui/components/SessionHeaderActions.tsx`. `SessionView` retains menu state/ref,
shared pointer-dismissal lifecycle, global-search state, functional toggle, and
close-before-search/undo/redo/delete command creation; `SessionHeader` retains
title/back/rename and encounter quick-access mapping. The private component
keeps the existing always-mounted ref root, classes/open state, button order,
icons/copy, and saving-disabled shared undo/redo gate. The expanded suite passes
460/460 tests; architecture, performance, and Ukrainian encoding checks pass.
`MD-R02` remains closed; `MD-R04` remains verification-blocked until the declared
local lint/typecheck tooling is available.

Phase 175 moves AI Response Modal preview-resource header markup into private
`ui/AiResponsePreviewResourceHeader.tsx`. Raw
`renderPreviewResourceHeader` retains the default resource-label read, fallback
label read, resource-state lookup, and action construction in their original
order before passing prepared nodes to the leaf. The private component preserves
only the root/first-label-span/nested-actions/state-span hierarchy and classes.
The expanded suite passes 461/461 tests; architecture, performance, and
Ukrainian encoding checks pass. `MD-R02` remains closed; `MD-R04` remains
verification-blocked until the declared local lint/typecheck tooling is
available.

## Closed recovery items

| ID | Resolution |
| --- | --- |
| MD-R01 | The full `npm test` gate now passes all 398 tests. Two stale aggregate source assertions were aligned with the Phase 119 presentation owner before the successful run. |
| MD-R02 | Closed at Phase 159. The temporary typed shared store facade/runtime and its private-port checker are deleted after all page/widget consumers migrated to narrow injected runtimes. `app/model` alone owns stateful store/selectors/modal/navigation, and `shared/model` retains action/type/reducer policies only. `SessionPageRuntimeHost` imports navigation from `app/model`. |
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
