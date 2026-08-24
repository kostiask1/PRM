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
| MD-R02 / Phase 176 | Completed page-local consolidation | Moved Session Page scene-note presentation into private `pages/session/ui/components/SceneNotes.tsx`. `SessionPage` retains its single configured `SessionNoteCard` identity and `SceneCard` mutation/card composition; the presenter receives only a note-render slot plus narrow note commands. | Keep the presenter private; preserve notes presentation/bulk-collapse/reorder order, virtual-note and isolated drag-control behavior, root/header/list DOM/classes, note order/last flag, and `enableHistory={false}` without public page/runtime/store expansion. | 462/462 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 177 | Completed page-local consolidation | Moved Encounter Page header-action presentation into private `pages/encounter/ui/components/EncounterHeaderActions.tsx`. `EncounterView` retains state/ref, distinct pointer-dismissal, toggle, and settings persistence; `EncounterHeader` retains identity/metrics composition. | Keep the leaf private with a narrow view projection; preserve root/classes/count, menu/input/action order, grid/display and saving gates, direct actions, and the distinct dismissal policy without public page/runtime/store/API expansion. | 463/463 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 178 | Completed page-local consolidation | Moved Campaign Page session-list presentation into private `pages/campaign/ui/components/CampaignSessionsSection.tsx`. `CampaignView` retains session-search/filter/reorder policy, runtime navigation, and configured session-card/delete workflow. | Keep the leaf private with controlled list/search inputs, explicit create/reorder/drop commands, and the card slot; preserve pane DOM, filtered drag/static branches, identity, callbacks, empty state, and raw navigation/delete behavior without public page/runtime/store/API expansion. | 464/464 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 179 | Completed page-local consolidation | Moved Session Page checklist-overlay presentation into private `pages/session/ui/components/SessionChecklistOverlay.tsx`. `SessionView` retains the open gate, checklist state, and persistence command. | Keep the leaf private; preserve open-gated reads, modal lifecycle/presentation, progress/item projections, dynamic check lookup, direct item-change delegation, raw floating trigger, and no public page/runtime/store/API expansion. | 465/465 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 180 | Completed page-local consolidation | Moved Session Page header presentation into private `pages/session/ui/components/SessionHeader.tsx`. `SessionView` retains guard, navigation, action-menu lifecycle, and close-before-action workflow. | Keep the leaf private; preserve header/quick-access/action-menu composition, values/callbacks/ref, DOM/classes, encounter identity/fallback rendering, and raw state/navigation/workflow ownership without public page/runtime/store/API expansion. | 466/466 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 181 | Completed page-local consolidation | Moved Session Page scope-import overlay presentation into private `pages/session/ui/components/SessionScopeImportOverlay.tsx`. `SessionView` retains modal derivation, close, and scope-move lifecycle. | Keep the leaf private; preserve unconditional composition/private null guard, modal/list/item/key presentation, loading/key evaluation order, explicit commands, and raw workflow ownership without public page/runtime/store/API expansion. | 467/467 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 182 | Completed page-local consolidation | Moved Campaign Page description-section chrome into private `pages/campaign/ui/components/CampaignDescriptionSection.tsx`. `CampaignView` retains collapse state, persistence, and the expanded-only editor slot. | Keep the leaf private; preserve section/toggle presentation, closed-gated editor invocation, explicit command/slot, exact setter-save order, and raw state/persistence/editor ownership without public page/runtime/store/API expansion. | 468/468 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 183 | Completed page-local consolidation | Moved Campaign Page entity-section presentation into private `pages/campaign/ui/components/CampaignEntitySection.tsx`. `CampaignView` retains per-type collapse/reorder persistence, drag policy, and card/control workflows. | Keep the leaf private; preserve section/drop-target/list presentation, controlled commands/slots, collapsed gates, bulk/reorder/drop/key policy, and raw state/persistence/workflow ownership without public page/runtime/store/API expansion. | 469/469 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 184 | Completed page-local consolidation | Moved Session Page scenes-section presentation into private `pages/session/ui/components/SessionScenesSection.tsx`. `SessionView` and raw `SessionSceneItem` retain scene projection/persistence and all SceneCard workflows. | Keep the leaf private; preserve empty-list actions, controlled commands/render slot, raw duplicate-ID numbering/encounter label/card callbacks, list gate/key policy, and no public page/runtime/store/API expansion. | 470/470 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 185 | Completed page-local consolidation | Moved Session Page floating checklist/search actions into private `pages/session/ui/components/SessionFloatingActions.tsx`. `SessionView` retains search/checklist state and commands. | Keep the leaf private; preserve controlled progress/search props, the trigger/tooltip/badge/search-modal gates, explicit callbacks, and no public page/runtime/store/API expansion. | 471/471 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 186 | Completed page-local consolidation | Moved Session Page notes-section presentation into private `pages/session/ui/components/SessionNotesSection.tsx`. `SessionView` retains note persistence, AI mutation, and NoteCard workflows. | Keep the leaf private; preserve controlled note data/state/slot commands, no-data and expanded gates, raw bulk/reorder/AI/ID/last-note policy, shared Notes list policy with false drag isolation, and no public page/runtime/store/API expansion. | 472/472 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 187 | Completed page-local consolidation | Moved Session Page result-section presentation into private `pages/session/ui/components/SessionResultSection.tsx`. `SessionView` retains result coercion and persistence. | Keep the leaf private; preserve controlled value/command, localized textarea presentation, disabled history, event-to-value routing, raw coercion/update command, and no public page/runtime/store/API expansion. | 473/473 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 188 | Completed page-local consolidation | Moved paired Session NPC/location list shells into private `pages/session/ui/components/SessionEntitySection.tsx`. `SessionView` retains per-type entity persistence and card workflows. | Keep the leaf private; preserve controlled display/list/command/slot values, actions and list gates, current-items bulk delegation, ID/AI/default-drag policy, raw type-bound commands/cards/IDs, and no public page/runtime/store/API expansion. | 474/474 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 189 | Completed page-local consolidation | Moved Session Page SceneCard presentation into private `pages/session/ui/components/SessionSceneCard.tsx`. Raw `SessionSceneItem` retains DOM identity, schema, eager encounter-name evaluation, every view callback, and the `SessionNoteCard` factory/render slot. | Keep the leaf private; preserve controlled SceneCard/header/content/fields/notes/media presentation, disabled field history, localized encounter fallback, raw note-card callback binding, and no public page/runtime/store/API expansion. | 475/475 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 190 | Completed page-local consolidation | Moved Encounter Page player-picker and character-modal presentation into private `pages/encounter/ui/components/EncounterCharacterOverlays.tsx`. Raw `EncounterView` retains player/modal state, available-list derivation, close/reset/start/create workflows, character change/identity policy, and the modal-card callback factory. | Keep the leaf private; preserve picker/modal null gates, create/list/empty/modal presentation, actions, list keys/meta, CharacterCard flags, post-null identity evaluation, and no public page/runtime/store/API expansion. | 476/476 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 191 | Completed page-local consolidation | Moved Encounter Page detail grid/single/stat-block presentation into private `pages/encounter/ui/components/EncounterDetail.tsx`. Raw `EncounterView` retains participant identity, state/ref/callbacks, and image-override policy. | Keep the leaf private; preserve repeated grid ID evaluation, selection/ref/class and empty-state policy, post-null character callback evaluation, CharacterCard flags, stat-block callback/override delegation, and no public page/runtime/store/API expansion. | 477/477 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 192 | Completed page-local consolidation | Moved Encounter Page participant-row/combat-stats/HP-input/action presentation into private `pages/encounter/ui/components/EncounterMonsterRow.tsx`. Raw `EncounterView` retains draft, participant-ID, selection, list-adapter, and select/HP-handler policy. | Keep the leaf private; preserve ID/character/name order, undefined-draft HP semantics, coercion/color, native event/action ordering, duplicate monster identity, character delete-only behavior, and no public page/runtime/store/API expansion. | 478/478 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 193 | Completed page-local consolidation | Moved Encounter Page header/identity/metrics presentation into private `pages/encounter/ui/components/EncounterHeader.tsx`, forwarding private `EncounterHeaderActions`. Raw `EncounterView` retains menu lifecycle, settings persistence, inline toggle, and tooltip-node construction. | Keep the leaf private; preserve header order/direct handlers/mention fallback, eager metric tuples, count gate/key/classes, action-menu forwarding, and no public page/runtime/store/API expansion. | 479/479 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 194 | Completed page-local consolidation | Moved Session Page session-scoped NPC/location modal card presentation into private `pages/session/ui/components/SessionScopedEntityModal.tsx`. Raw `SessionView` retains resolver/current-entity lookup, ID guards, and change/delete/close command ownership. | Keep the leaf private; preserve type branch, normalization, card identity/flags, forced expanded state, and delete-before-close ordering without public page/runtime/store/API expansion. | 480/480 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 195 | Completed page-local consolidation | Moved Campaign Page header presentation into private `pages/campaign/ui/components/CampaignHeader.tsx`, forwarding private `CampaignHeaderActions`. Raw `CampaignView` retains campaign/state/modal-trigger/action command ownership. | Keep the leaf private; preserve header/title/metadata hierarchy, rename tooltip/handler, undo/redo/action forwarding, classes/copy, and no public page/runtime/store/API expansion. | 481/481 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 196 | Completed page-local consolidation | Moved Campaign Page partial-archive overlay lifecycle/presentation into private `pages/campaign/ui/components/CampaignPartialArchiveOverlay.tsx`. Raw `CampaignView` retains search/archive-open state, search close, and archive command ownership. | Keep the leaf private; preserve always-mounted busy state, null gate, await/finally and import-close ordering, modal props, global-search placement, and no public page/runtime/store/API expansion. | 482/482 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 197 | Completed page-local consolidation | Moved Encounter Page Bestiary overlay shell into private `pages/encounter/ui/components/EncounterBestiaryOverlay.tsx`. Raw `EncounterView` retains Bestiary composition, stable widget slots, monster-add command, and cast ownership. | Keep the leaf private; preserve closed-gated slot evaluation, custom modal props/title/no-op confirm, action forwarding, raw composition imports, sibling overlay order, and no public page/runtime/store/API expansion. | 483/483 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 198 | Completed page-local consolidation | Moved Encounter Page notification presentation into private `pages/encounter/ui/components/EncounterNotification.tsx`. Raw `EncounterView` retains notification state and close/reset command ownership. | Keep the leaf private; preserve truthy null gate, shared notification props, sibling mount order, and no public page/runtime/store/API expansion. | 484/484 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 199 | Completed page-model consolidation | Moved Encounter Page request-cleanup lifecycle into private `pages/encounter/model/useEncounterRequestCleanup.ts`. Raw `EncounterView` retains focus-timeout and AI-edit-controller ref ownership. | Keep the hook private; preserve mount cleanup ordering (clear timeout, then abort controller) and no public page/runtime/store/API expansion. | 485/485 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 200 | Completed page-model consolidation | Moved Encounter Page AI-model loading lifecycle into private `pages/encounter/model/useEncounterAiModelLoading.ts`. Raw `EncounterView` retains AI-editing/model state, setters, and localized error policy. | Keep the hook private; preserve the open-edit/empty-model gate, feature-owned loader call, original effect dependencies, and no public page/runtime/store/API expansion. | 486/486 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 201 | Completed page-model consolidation | Moved Campaign Page hash-navigation lifecycle into private `pages/campaign/model/useCampaignHashNavigation.ts`. Raw `CampaignView` retains campaign/section state, setters, notes-view setter, and persistence command ownership. | Keep the hook private; preserve hash decoding, plan construction/execution order, `120ms` delayed scroll/cleanup, original dependencies, and no public page/runtime/store/API expansion. | 487/487 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 202 | Completed page-model consolidation | Moved Session Page hash-navigation lifecycle into private `pages/session/model/useSessionHashNavigation.ts`. Raw `SessionView` retains session state, rendered collections, and section-toggle command ownership. | Keep the hook private; preserve the Session-specific notes-expand predicate, `140ms` delayed scroll/cleanup, original dependencies, and no public page/runtime/store/API expansion. | 488/488 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 203 | Completed page-model consolidation | Moved Campaign Page character-type drag-drop browser lifecycle into private `pages/campaign/model/useCampaignCharacterTypeDrop.ts`. Raw `CampaignView` retains view identity and character-type drop command ownership. | Keep the hook private; preserve target/drop-zone lookup, drop-plan construction, listener lifecycle, raw-view dependency, and no public page/runtime/store/API expansion. | 489/489 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 204 | Completed page-model consolidation | Moved Encounter Page grid-focus state, refs, and timeout policy into private `pages/encounter/model/useEncounterGridFocus.ts`. Raw `EncounterView` retains grid projection, participant-selection plan, and selection command ownership. | Keep the hook private; preserve representative lookup, ref map updates, scroll, timeout replacement/conditional reset, cleanup integration, and no public page/runtime/store/API expansion. | 490/490 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 205 | Completed page-model consolidation | Moved Encounter Page player-character creation state and lifecycle into private `pages/encounter/model/useEncounterPlayerCreation.ts`. Raw `EncounterView` retains adapters, localization, route guard, and overlay composition. | Keep the hook private; preserve draft/close/error/finally policy and create → refresh → add → reset order without public page/runtime/store/API expansion. | 491/491 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 206 | Completed page-model consolidation | Moved Encounter Page HP draft/edit lifecycle into private `pages/encounter/model/useEncounterHpEditing.ts`. Raw `EncounterView` retains participant identity and update adapter. | Preserve draft replacement, absent-draft no-op, normalization, delete-after-commit, and no public page/runtime/store/API expansion. | 492/492 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 207 | Completed page-model consolidation | Moved Encounter Page character-modal state and synchronization into private `pages/encounter/model/useEncounterCharacterModal.ts`. Raw `EncounterView` retains participant-selection and update adapter ownership. | Preserve open/close, exact instance match, character projection, participant-type override, and no public page/runtime/store/API expansion. | 493/493 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 208 | Completed page-model consolidation | Moved Encounter display-settings patch/persistence into private `pages/encounter/model/useEncounterDisplaySettings.ts`. Raw `EncounterView` retains runtime patch adapter and header composition. | Preserve normalization, patch-before-request, error logging, and no public page/runtime/store/API expansion. | 494/494 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 209 | Completed page-model consolidation | Moved Encounter local/global monster field-edit state and save orchestration into private `pages/encounter/model/useEncounterMonsterFieldEditing.ts`. Raw `EncounterView` retains API/runtime/view adapters, localization, and modal/detail composition. | Preserve character/ID guard, `none` edit-plan exit, action close before editor state, local/persistent update options, refresh/close/error ordering, and no public page/runtime/store/API expansion. | 495/495 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 210 | Completed page-model consolidation | Moved the distinct Encounter header pointer-dismissal lifecycle into private `pages/encounter/model/useEncounterHeaderDismissal.ts`. Raw `EncounterView` retains header ref/open state and the close adapter. | Preserve open-only registration, `Node` containment, outside-only close, `pointerdown` cleanup, and no public page/runtime/store/API expansion. | 496/496 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 211 | Completed page-model consolidation | Moved Encounter AI action-modal transition state into private `pages/encounter/model/useEncounterMonsterAiAction.ts`. Raw `EncounterView` retains AI editor state, request execution, history, localization, and composition. | Preserve name guard, target-ID update before opening, in-flight close guard, image-prompt no-op, close-before-editor transition, and no public page/runtime/store/API expansion. | 497/497 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 212 | Completed page-model consolidation | Moved Encounter render-context projection into private `pages/encounter/model/encounterPagePresentation.ts`. Raw `EncounterView` retains loading presentation and all workflows. | Preserve encounter → campaign → session guard order, second encounter read in the result, raw loading guard/deconstruction order, and no public page/runtime/store/API expansion. | 498/498 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 213 | Completed page-model consolidation | Moved Encounter AI draft save/restore/close state and lifecycle into private `pages/encounter/model/useEncounterMonsterAiDraft.ts`. Raw `EncounterView` retains AI generation, modal composition, localized history-error adapter, and diff presentation. | Preserve plan guards, API request/result/error/finally ordering, target identity, local/global update routing, restore close guard, and no public page/runtime/store/API expansion. | 499/499 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 214 | Completed page-model consolidation | Moved Encounter AI editor session state into private `pages/encounter/model/useEncounterMonsterAiEditor.ts`. Raw `EncounterView` retains generate request execution, AbortController, result projection, localized loading-error adapter, and modal composition. | Preserve start/reset, in-flight close guard, success reset, model selection, and no public page/runtime/store/API expansion. | 500/500 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 215 | Completed page-model consolidation | Moved Encounter AI generation/cancellation/result lifecycle into private `pages/encounter/model/useEncounterMonsterAiGeneration.ts`. Raw `EncounterView` retains its AbortController ref, runtime dependencies/effects, localized adapters, and modal composition. | Preserve name/plan exits, start/reset/controller ordering, payload, draft/local update routing, active-controller clearing, and error/finally order; no public page/runtime/store/API expansion. | 501/501 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 216 | Completed page-local consolidation | Moved all four Encounter header tooltip ReactNodes into private `pages/encounter/ui/components/EncounterHeader.tsx`. Raw `EncounterView` retains menu state/ref/dismissal, settings persistence, and the functional toggle. | Preserve unconditional tooltip construction/copy order, encounter participant-count gate, initiative values, header/action forwarding, and no public page/runtime/store/API expansion. | 502/502 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 217 | Completed page-model consolidation | Moved Encounter participant selection and token-image update adapters into private `pages/encounter/model/useEncounterMonsterInteractions.ts`. Raw `EncounterView` retains selected state, character modal, grid focus, and update commands through injected dependencies. | Preserve selection plan/execution order, selected-ID/display-mode forwarding, missing-instance no-op, exact image forwarding, and no public page/runtime/store/API expansion. | 503/503 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 218 | Completed page-local consolidation | Moved the paired Encounter AI/field action-modal composition into private `pages/encounter/ui/components/EncounterMonsterActionModals.tsx`. Raw `EncounterView` retains action state, transition commands, and editor/persistence workflows. | Preserve source gate, labels, local/global availability, title/icon, identities, callback forwarding, and no public page/runtime/store/API expansion. | 503/503 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 219 | Completed page-local consolidation | Moved Encounter participant-list chrome and `DraggableList` presentation into private `pages/encounter/ui/components/EncounterParticipantList.tsx`. Raw `EncounterView` retains add/reorder/drop commands and row render bindings. | Preserve classes, localized buttons, key extraction, callback order, and injected row slot; no public page/runtime/store/API expansion. | 503/503 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 220 | Completed page-model consolidation | Moved Encounter selected-grid identity and layout projection into `pages/encounter/model/encounterPagePresentation.ts`. Raw `EncounterView` retains state/composition. | Preserve selection guard, identity coercion, representative fallback, single override, and grid bounds; no public page/runtime/store/API expansion. | 503/503 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 221 | Completed page-model consolidation | Moved Encounter AI-model loading error projection into private `pages/encounter/model/useEncounterAiModelLoading.ts`. Raw `EncounterView` retains editor setters and localized fallback text. | Preserve guards, model/selection effects, log-before-update order, `Error.message` precedence, fallback, and no public page/runtime/store/API expansion. | 503/503 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 222 | Completed feature-model consolidation | Moved Encounter custom-Bestiary refresh transport, merge-result handling, and error routing into private `executeCustomBestiarySynchronization` in `features/encounter-editor/model/useEncounterParticipantSynchronization.ts`. The hook remains the React callback/effect adapter. | Preserve the empty-monster guard, source load -> typed synchronization -> unchanged guard -> non-undoing update order, selected-ID fallback, error routing, and no public feature/API expansion. | 503/503 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 223 | Completed feature-model consolidation | Moved Encounter paired character/NPC source transport into private `loadParticipantEntitySources` in `features/encounter-editor/model/useEncounterParticipantSynchronization.ts`. The hook remains the lifecycle/state adapter. | Preserve simultaneous request creation and ordering, active guard before payload normalization, player/image-map updates, error routing, and no public feature/API expansion. | 503/503 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 224 | Completed page-local consolidation | Moved the Session page's note-card factory and scene-item renderer into private `ui/components/SessionNoteCard.tsx` and `SessionSceneItem.tsx`. `SessionView` remains the composition and mutation owner. | Preserve scene/note callback binding, DOM IDs, schema and encounter forwarding, simplified-note mode, and no public page/runtime/store/API expansion. | 503/503 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 225 | Completed app-model consolidation | Moved app campaign/settings hydration and theme synchronization into private `app/model/useAppBootstrap.ts`. `App.tsx` remains the runtime/provider composition owner. | Preserve callback/effect order, campaign-reload reloading, mounted-only settings application, settings-sync filtering, theme application, localized campaign-load alert, and no public app-model expansion. | 503/503 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 226 | Completed app-model consolidation | Moved app campaign-completion confirmation, persistence, reload, and error flow into private `app/model/useCampaignCompletionToggle.ts`. `App.tsx` remains the sidebar callback composer. | Preserve completion-plan/date-confirmation branching, update payload, reload-after-save, localized failure alert, and no public app-model expansion. | 503/503 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 227 | Completed app-model consolidation | Moved app mobile-sidebar state and lifecycle into private `app/model/useMobileSidebar.ts`. `App.tsx` remains the control/callback composer. | Preserve route-close, body-class, Escape-listener, cleanup, state-setter semantics, lifecycle ordering after navigation synchronization, and no public app-model expansion. | 503/503 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 228 | Completed page-model consolidation | Moved Campaign page notes display state plus AI-ignore, view-mode, and bulk-collapse orchestration into private `pages/campaign/model/useCampaignNotesControls.ts`. `CampaignView` remains the persistence-command owner. | Preserve note mapping, view-mode plan then setter/save order, bulk reorder then finish order, hash-navigation setter, and no public page-model expansion. | 503/503 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 229 | Completed page-model consolidation | Moved shared Campaign characters/NPC/locations collapse, bulk-collapse, and reorder-drop policy into private `pages/campaign/model/campaignEntitySectionControls.ts`. `CampaignView` injects raw state and persistence commands. | Preserve the has-data gate, setter/save order, typed collapse-key mapping, bulk map/local reorder/persist order, direct typed reorder-drop persistence, and no public page-model expansion. | 503/503 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 230 | Completed feature consolidation | Moved Campaign creation/import modal orchestration into `features/campaign-create/model/campaignCreation.ts` and `useCampaignCreationModal.tsx`. `App.tsx` injects API, modal, reload, navigation, and notification commands through the feature public entry. | Preserve empty-name/second-trim behavior, result guard, create reload/close/navigate order, import reload/close order, localized failures, no feature-sibling edge, and the enforced no-app-store facade. | 504/504 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 231 | Completed app-model consolidation | Moved App global selectors and feature/widget runtime assembly into private `app/model/useAppRuntimes.ts`. `App.tsx` remains the effect, route, sidebar, modal-host, and provider-layout composer. | Preserve selector coverage, runtime memo/action ordering, injected modal commands, Spells Browser campaign/settings actions, provider nesting, and no public app-model expansion. | 505/505 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 232 | Completed Encounter page consolidation | Moved Encounter orchestration into private `pages/encounter/model/useEncounterPageController.ts` and composed UI into private `pages/encounter/ui/components/EncounterPageContent.tsx`. `EncounterPage.tsx` is now the loading-guard and panel shell. | Preserve runtime/API and hook/effect order, grid/selection projection, cleanup, AI workflows, render-context guard, widget factories, callback bindings, and no public page/runtime/store/API expansion. | 506/506 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 233 | Completed Encounter page-model consolidation | Moved Encounter AI action, field-edit, draft, diff, and generation coordination into private `pages/encounter/model/useEncounterMonsterAiWorkflows.ts`. The page controller retains runtime/editor/cleanup/model-loading/display-settings/interactions coordination. | Preserve post-display-settings ordering, API composition, abort-controller identity, AI editor callbacks, target propagation, localized errors, draft behavior, and no public page/runtime/store/API expansion. | 507/507 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 234 | Completed app-model consolidation | Moved App Ctrl/Meta modifier-key browser lifecycle into private `app/model/useAppModifierKey.ts`. `App.tsx` remains the route/runtime/provider/sidebar callback composer. | Preserve editable-target guard, modifier keydown state, non-modifier keyup reset, mouseup reset, listener cleanup/order, Sidebar Ctrl-click forwarding, and no public app-model expansion. | 508/508 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 235 | Completed Encounter page-model consolidation | Moved Encounter grid/participant display projection, focus wiring, and responsive layout derivation into private `pages/encounter/model/useEncounterPageDisplayProjection.ts`. The page controller retains runtime/editor/workflow/interaction coordination. | Preserve post-view hook order, participant fallbacks, grid representative/selection projection, focus cleanup reference, effective layout, player-character availability filtering, and no public page/runtime/store/API expansion. | 509/509 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 236 | Completed Encounter page-model consolidation | Moved Encounter participant availability, player creation, HP editing, and character-modal coordination into private `pages/encounter/model/useEncounterPageParticipantEditing.ts`. The page controller retains runtime/display-projection/AI/interaction coordination. | Preserve post-display-projection hook order, availability → creation → HP → character-modal sequence, localized creation errors, participant identity adapter, focus/interaction callbacks, and no public page/runtime/store/API expansion. | 510/510 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 237 | Completed Bestiary widget-model consolidation | Moved Bestiary source/legendary/favorite initialization, sync-event refresh, full monster loading, and custom reload/selection lifecycle into private `widgets/bestiary-browser/model/useBestiaryDataLoading.ts`. `BestiaryBrowser.tsx` retains widget runtime/state, filtering, edit, history, and UI composition. | Preserve abort cleanup, initialization normalization, sync pending/auto-selection behavior, loading finalization, custom replacement ordering, and no public widget/model expansion. | 511/511 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 238 | Completed Bestiary widget-model consolidation | Moved Bestiary AI action, editor state, model loading, generation, draft persistence, restore, and diff coordination into private `widgets/bestiary-browser/model/useBestiaryAiWorkflows.ts`. `BestiaryBrowser.tsx` retains runtime, abort cleanup, custom-list update adapter, field edit/delete/import, and UI composition. | Preserve post-data-loading effect order, controller identity/cleanup, custom-update and undo callbacks, image-prompt delegation, localized errors, draft apply/undo behavior, and no public widget/model expansion. | 512/512 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 239 | Completed Bestiary widget-model consolidation | Moved Bestiary custom-monster collection projection, undo/redo stacks, replacement, selection application, and AI-update reconciliation into private `widgets/bestiary-browser/model/useBestiaryCustomMonsterHistory.ts`. `BestiaryBrowser.tsx` retains runtime, source selection, field edit/delete/import, and UI composition. | Preserve clone-based snapshots, transition order, replacement normalization, selected/cleared selection behavior, localized undo/redo failures, reload-token increment, and no public widget/model expansion. | 513/513 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 240 | Completed Bestiary widget-model consolidation | Moved Bestiary custom-monster field edit, create-based/update persistence, delete confirmation, and import/export lifecycle into private `widgets/bestiary-browser/model/useBestiaryCustomMonsterEditing.ts`. `BestiaryBrowser.tsx` retains runtime, filtering, source selection, history/AI adapters, and UI composition. | Preserve field-edit plans, stored-list reads, snapshot/update/favorite order, confirmation-before-delete, import reset/restore/snapshot/notification order, localized errors, and no public widget/model expansion. | 514/514 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 241 | Completed AI Assistant widget-model consolidation | Moved API-key input/save and AI-model discovery/selection lifecycle into private `widgets/ai-assistant/model/useAiAssistantModelAccess.ts`. `AiAssistantPanel.tsx` retains runtime, generation/history/context/image-prompt, and UI composition. | Preserve panel-or-picker load eligibility, default model selection, save refresh/error/finally order, localized messages, and no public widget/model expansion. | 514/514 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 242 | Completed AI Assistant widget-model consolidation | Moved generated-data application and AI sync-event runtime adaptation into private `widgets/ai-assistant/model/useAiAssistantUpdatedData.ts`. `AiAssistantPanel.tsx` retains runtime, generation/history/context/image-prompt, and UI composition. | Preserve campaign/session/encounter/bestiary update-plan execution order, route-derived sync metadata, reload/entity refresh callbacks, and no public widget/model expansion. | 515/515 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 243 | Completed AI Assistant widget-model consolidation | Moved generated-result processing into private `widgets/ai-assistant/model/useAiAssistantGeneratedResult.ts`. `AiAssistantPanel.tsx` retains runtime, generation/history/context/image-prompt, and UI composition. | Preserve generated-result plan execution, history/prompt/notification sequencing, update/reload callbacks, dialog-close behavior, localized messages, and no public widget/model expansion. | 516/516 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 244 | Completed AI Assistant widget-model consolidation | Moved generation, cancellation, and history-retry lifecycle into private `widgets/ai-assistant/model/useAiAssistantGeneration.ts`. `AiAssistantPanel.tsx` retains runtime, history/context/image-prompt, cleanup registration, and UI composition. | Preserve reducer/request-ID transitions, abort/ref cleanup, request construction, API-key/failure handling, failed-history replacement, retry deletion/selection behavior, and no public widget/model expansion. | 517/517 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 245 | Completed AI Assistant widget-model consolidation | Moved token-estimate projection and formatting into private `widgets/ai-assistant/model/useAiAssistantTokenEstimate.ts`. `AiAssistantPanel.tsx` retains runtime, history/context/image-prompt, and UI composition. | Preserve the full estimate input/dependency projection, feature-owned token policy, locale fallback, file-token zero fallback, and no public widget/model expansion. | 518/518 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 246 | Completed AI Assistant widget-model consolidation | Moved prompt, toolbar, attachment, error, notification, and dialog control state into private `widgets/ai-assistant/model/useAiAssistantControls.ts`. `AiAssistantPanel.tsx` retains runtime, workflow composition, and UI composition. | Preserve every initial state value, the encounter-derived response-parsing default, campaign/session encounter-generation default, setter contracts, and no public widget/model expansion. | 519/519 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 247 | Completed AI Assistant widget-model consolidation | Moved route-state projection into private `widgets/ai-assistant/model/useAiAssistantRouteState.ts`. `AiAssistantPanel.tsx` retains runtime, workflow composition, and UI composition. | Preserve `getAiAssistantRouteState` inputs, memoized dependency order, route/destructuring values, and no public widget/model expansion. | 520/520 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 248 | Completed Bestiary widget-model consolidation | Moved filtering, sorting, identity normalization, list-display helpers, and challenge-rating projection into private `widgets/bestiary-browser/model/bestiaryBrowserFiltering.ts`. `bestiaryBrowser.ts` retains the compatibility facade and other Bestiary policies. | Preserve normalization, filter predicate order, localized sort behavior, CR parsing, public symbols/types, and no public widget/model expansion. | 521/521 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
| MD-R02 / Phase 249 | Completed Bestiary widget-model consolidation | Moved Bestiary source-code extraction, sync-event parsing/planning/execution, and selected-source persistence into private `widgets/bestiary-browser/model/bestiaryBrowserSync.ts`. `bestiaryBrowser.ts` retains the compatibility facade. | Preserve source candidate precedence, raw sync parsing and truthy-version gating, favorites/selection/reload order, campaign/global persistence callback/error order, public symbols/types, and no public widget/model expansion. | 522/522 tests; architecture maintained; `MD-R02` remains closed; `MD-R04` remains open |
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

Phase 176 moves Session Page scene-note presentation into private
`ui/components/SceneNotes.tsx`. The raw page retains its module-scoped
`SessionNoteCard` factory and supplies a narrow note-render slot; `SceneCard`
retains scene/card composition and all note mutation bindings. The private
presenter retains one scene-notes presentation call, its bulk collapse plan then
reorder command, virtual-note/list control behavior, and the existing
root/header/collapse/label/bulk/list DOM. The expanded suite passes 462/462
tests; architecture, performance, and Ukrainian encoding checks pass. `MD-R02`
remains closed; `MD-R04` remains verification-blocked until the declared local
lint/typecheck tooling is available.

Phase 177 moves Encounter Page header-action presentation into private
`ui/components/EncounterHeaderActions.tsx`. The raw page retains state/ref,
its distinct pointer-dismissal lifecycle, the functional menu toggle, and
settings patch-before-API persistence; `EncounterHeader` retains the identity
and metrics shell. The private leaf receives a narrow view projection and
preserves the action-root/classes, independent count, menu/input/action order,
display/grid and saving gates, and direct callbacks. The expanded suite passes
463/463 tests; architecture, performance, and Ukrainian encoding checks pass.
`MD-R02` remains closed; `MD-R04` remains verification-blocked until the
declared local lint/typecheck tooling is available.

Phase 178 moves Campaign Page session-list presentation into private
`ui/components/CampaignSessionsSection.tsx`. The raw page retains session
search/filter/reorder policy, runtime navigation, and the configured
session-card/delete workflow. The private leaf receives controlled list/search
inputs, explicit create/reorder/drop commands, and the card slot while
preserving pane DOM/classes, drag/static branches, `fileName` identity,
callbacks, and empty state. The expanded suite passes 464/464 tests;
architecture, performance, and Ukrainian encoding checks pass. `MD-R02`
remains closed; `MD-R04` remains verification-blocked until the declared local
lint/typecheck tooling is available.

Phase 179 moves Session Page checklist-overlay presentation into private
`ui/components/SessionChecklistOverlay.tsx`. The raw page retains the
open-gated checklist/progress reads, checklist state, and direct
`updateData(..., true)` persistence command. The private leaf receives
rendered data plus explicit close/item-change callbacks while preserving the
modal lifecycle, DOM/classes, progress rendering, item order/key, and dynamic
Boolean check lookup; the floating-action trigger stays raw. The expanded suite
passes 465/465 tests; architecture, performance, and Ukrainian encoding checks
pass. `MD-R02` remains closed; `MD-R04` remains verification-blocked until the
declared local lint/typecheck tooling is available.

Phase 180 moves Session Page header presentation into private
`ui/components/SessionHeader.tsx`. The raw page retains the null-session guard,
quick-access navigation/modifier policy, header action state/ref/dismissal,
global-search state, and close-before-action commands. The private leaf
receives explicit values/callbacks/ref while preserving header DOM/classes,
back/rename behavior, encounter gate/order/key, localized scene fallback and
mention rendering, and the sibling action-menu presentation. The expanded suite
passes 466/466 tests; architecture, performance, and Ukrainian encoding checks
pass. `MD-R02` remains closed; `MD-R04` remains verification-blocked until the
declared local lint/typecheck tooling is available.

Phase 181 moves Session Page scope-import overlay presentation into private
`ui/components/SessionScopeImportOverlay.tsx`. The raw page retains the
post-guard modal snapshot, presentation derivation, and scope-move/close
lifecycle. The private leaf stays in the existing unconditional JSX slot and
retains its null guard, receiving modal/copy/type plus explicit close/move
commands. It preserves modal/classes, loading-before-empty order, lazy
display-name and key fallback, item order, mention rendering, and click-only
move delegation. The expanded suite passes 467/467 tests; architecture,
performance, and Ukrainian encoding checks pass. `MD-R02` remains closed;
`MD-R04` remains verification-blocked until the declared local lint/typecheck
tooling is available.

Phase 182 moves Campaign Page description-section chrome into private
`ui/components/CampaignDescriptionSection.tsx`. The raw page retains collapse
state, the has-data guard, exact setter-then-save persistence order, and the
expanded-only description-editor render callback. The private leaf receives
only display state, an explicit toggle command, and a render slot while
preserving section DOM/id/classes, toggle behavior, localized copy, and
closed-gated editor reads. The expanded suite passes 468/468 tests;
architecture, performance, and Ukrainian encoding checks pass. `MD-R02`
remains closed; `MD-R04` remains verification-blocked until the declared local
lint/typecheck tooling is available.

Phase 183 moves Campaign Page entity-section presentation into private
`ui/components/CampaignEntitySection.tsx`. The raw page retains every per-type
collapse guard, setter-then-save command, bulk map/reorder/persist order,
drag-drop policy, global cross-type drop listener, and card/AI-control render
slot. The private leaf receives controlled list state plus explicit commands
and slots while preserving section/drop-target DOM, collapsed gates, current
item bulk delegation, DraggableList reorder/drop/key behavior, and all raw
entity workflows. The expanded suite passes 469/469 tests; architecture,
performance, and Ukrainian encoding checks pass. `MD-R02` remains closed;
`MD-R04` remains verification-blocked until the declared local lint/typecheck
tooling is available.

Phase 184 moves Session Page scenes-section presentation into private
`ui/components/SessionScenesSection.tsx`. The raw page retains
`SessionSceneItem`, scene projection/persistence, duplicate-ID numbering,
encounter-label evaluation, and every SceneCard callback. The private leaf
receives controlled scenes, explicit bulk/add/reorder commands, and a render
slot while preserving empty-list actions, section/list DOM, nonempty-list
gate, key extraction, and direct render-slot delegation. The expanded suite
passes 470/470 tests; architecture, performance, and Ukrainian encoding checks
pass. `MD-R02` remains closed; `MD-R04` remains verification-blocked until the
declared local lint/typecheck tooling is available.

Phase 185 moves Session Page floating checklist/search actions into private
`ui/components/SessionFloatingActions.tsx`. The raw page retains
global-search/checklist state, its close/open commands, and the progress read.
The private leaf receives controlled state and explicit callbacks while
preserving the unconditional trigger, tooltip/button/badge DOM, strict progress
gate, and open-only search-modal lifecycle. The expanded suite passes 471/471
tests; architecture, performance, and Ukrainian encoding checks pass.
`MD-R02` remains closed; `MD-R04` remains verification-blocked until the
declared local lint/typecheck tooling is available.

Phase 186 moves Session Page notes-section presentation into private
`ui/components/SessionNotesSection.tsx`. The raw page retains note state,
bulk/reorder persistence, the AI mutation command, NoteCard factory/render
slot, IDs, last-note calculation, and every card callback. The private leaf
receives controlled notes/state, explicit commands, and a card slot while
preserving raw bulk source, controlled no-data/expanded gates, shared Notes
list policy, and false drag isolation. The expanded suite passes 472/472 tests;
architecture, performance, and Ukrainian encoding checks pass. `MD-R02`
remains closed; `MD-R04` remains verification-blocked until the declared local
lint/typecheck tooling is available.

Phase 187 moves Session Page result-section presentation into private
`ui/components/SessionResultSection.tsx`. The raw page retains exact result
coercion and persistence while the leaf receives a controlled value and
command. It preserves the localized textarea section, disabled history, and
event-to-value adapter. The expanded suite passes 473/473 tests; architecture,
performance, and Ukrainian encoding checks pass. `MD-R02` remains closed;
`MD-R04` remains verification-blocked until the declared local lint/typecheck
tooling is available.

Phase 205 moves Encounter Page player-character creation state and lifecycle
into private `model/useEncounterPlayerCreation.ts`. Raw `EncounterView` retains
runtime/view adapters, localization, route guard, and overlay composition. The
hook preserves draft and close-guard policy, blank-name/error handling, payload
defaults, create → refresh → add → reset order, and finally reset. The expanded
suite passes 491/491 tests; architecture, performance, and Ukrainian encoding
checks pass. `MD-R02` remains closed; `MD-R04` remains verification-blocked.

Phase 188 moves the paired Session NPC/location list shells into private
`ui/components/SessionEntitySection.tsx`. The raw page retains type-bound
entity persistence, action/card workflows, and IDs while the generic leaf
receives controlled display/list values, commands, and card slots. It preserves
always-visible actions, current-items bulk delegation, empty/list gates, ID and
AI-control policy, and default drag behavior. The expanded suite passes
474/474 tests; architecture, performance, and Ukrainian encoding checks pass.
`MD-R02` remains closed; `MD-R04` remains verification-blocked until the
declared local lint/typecheck tooling is available.

Phase 189 moves Session Page SceneCard presentation into private
`ui/components/SessionSceneCard.tsx`. Raw `SessionSceneItem` retains its DOM
identity, scene schema, eager encounter-name evaluation, every view callback,
and the configured `SessionNoteCard` factory/render slot. The private leaf
receives controlled presentation inputs and preserves SceneCard/header/
expanded-content/fields/notes/media composition, disabled field history, and
the localized encounter fallback. The expanded suite passes 475/475 tests;
architecture, performance, and Ukrainian encoding checks pass. `MD-R02`
remains closed; `MD-R04` remains verification-blocked until the declared local
lint/typecheck tooling is available.

Phase 190 moves Encounter Page player-picker and character-modal presentation
into private `ui/components/EncounterCharacterOverlays.tsx`. Raw `EncounterView`
retains player/modal state, the available-player list, close/reset/start/create
workflows, `handleCharacterChange`, `getParticipantInstanceId`, and the injected
modal-card callback factory. The private leaf receives controlled values and
explicit callbacks while preserving picker/modal null gates, create/list/empty/
modal presentation, actions, list keys/meta, CharacterCard flags, and identity
evaluation after the modal null gate. The expanded suite passes 476/476 tests;
architecture, performance, and Ukrainian encoding checks pass. `MD-R02`
remains closed; `MD-R04` remains verification-blocked until the declared local
lint/typecheck tooling is available.

Phase 191 moves Encounter Page detail grid/single/stat-block presentation into
private `ui/components/EncounterDetail.tsx`. Raw `EncounterView` retains
`getParticipantInstanceId`, display/selection/focus state, grid refs, callbacks,
and image-override policy while the private leaf receives those dependencies.
It preserves repeated grid ID evaluation, selection/ref/class and empty-state
policy, CharacterCard flags, the selected-character null gate before identity/
callback evaluation, and stat-block callback/image-override delegation. The
expanded suite passes 477/477 tests; architecture, performance, and Ukrainian
encoding checks pass. `MD-R02` remains closed; `MD-R04` remains
verification-blocked until the declared local lint/typecheck tooling is
available.

Phase 192 moves Encounter Page participant-row/combat-stats/HP-input/action
presentation into private `ui/components/EncounterMonsterRow.tsx`. Raw
`EncounterView` retains `hpDrafts`, participant-ID policy, selected-instance
derivation, the `DraggableList` key/reorder/drop/render adapter, and select/HP
handlers while the leaf receives narrow row-view commands. It preserves
instance-ID → character classification → display-name evaluation, undefined
draft semantics, HP coercion/color, native input and stop-propagation action
order, duplicate-by-monster identity, and the character delete-only path. The
expanded suite passes 478/478 tests; architecture, performance, and Ukrainian
encoding checks pass. `MD-R02` remains closed; `MD-R04` remains
verification-blocked until the declared local lint/typecheck tooling is
available.

Phase 193 moves Encounter Page header/identity/metrics presentation into private
`ui/components/EncounterHeader.tsx`, forwarding the existing private
`EncounterHeaderActions`. Raw `EncounterView` retains action-menu open/ref/
dismissal lifecycle, grid/display-settings persistence, the inline toggle, and
four unconditional tooltip ReactNodes. The leaf receives a narrow unified view
and controlled action inputs while preserving header order, direct method
handlers, mention fallback, eager metric tuple construction, participant-count
gate, keys/classes, and private action-menu composition. The expanded suite
passes 479/479 tests; architecture, performance, and Ukrainian encoding checks
pass. `MD-R02` remains closed; `MD-R04` remains verification-blocked until the
declared local lint/typecheck tooling is available.

Phase 194 moves Session Page session-scoped NPC/location modal card presentation
into private `ui/components/SessionScopedEntityModal.tsx`. Raw `SessionView`
retains the session-only resolver, current-entity lookup, ID guards, and every
change/delete/close command. The leaf receives only controlled entity/type/card
inputs while preserving the `locations`-then-NPC branch, normalization, card
keys/flags, forced expanded state, and delete-before-close ordering. The
expanded suite passes 480/480 tests; architecture, performance, and Ukrainian
encoding checks pass. `MD-R02` remains closed; `MD-R04` remains
verification-blocked until the declared local lint/typecheck tooling is
available.

Phase 195 moves Campaign Page header presentation into private
`ui/components/CampaignHeader.tsx`, forwarding the existing private
`CampaignHeaderActions`. Raw `CampaignView` retains campaign construction,
state, modal-trigger, and action-command ownership. The leaf receives a narrow
header view, `CampaignViewModel`, and controlled modal-open commands while
preserving the header/title/metadata hierarchy, rename tooltip/handler,
undo/redo and direct action callbacks, action-menu forwarding, classes, and
localized copy. The expanded suite passes 481/481 tests; architecture,
performance, and Ukrainian encoding checks pass. `MD-R02` remains closed;
`MD-R04` remains verification-blocked until the declared local lint/typecheck
tooling is available.

Phase 196 moves Campaign Page partial-archive overlay lifecycle/presentation
into private `ui/components/CampaignPartialArchiveOverlay.tsx`. Raw
`CampaignView` retains global-search/partial-archive open state, the search
close callback, and direct archive commands. The leaf receives controlled
open/close/export/import inputs while preserving always-mounted busy state, the
closed-overlay null gate, busy-before-await/finally reset, import success before
close, `PartialArchiveModal` prop routing, and global-search placement. The
expanded suite passes 482/482 tests; architecture, performance, and Ukrainian
encoding checks pass. `MD-R02` remains closed; `MD-R04` remains
verification-blocked until the declared local lint/typecheck tooling is
available.

Phase 197 moves Encounter Page Bestiary overlay shell into private
`ui/components/EncounterBestiaryOverlay.tsx`. Raw `EncounterView` retains
Bestiary composition, all stable widget slots, the monster-add command, and
cast ownership. The leaf receives open/close/action inputs plus a render slot,
preserving closed-gated slot evaluation, custom modal title/props/no-op confirm,
action forwarding, raw composition imports, and sibling overlay order. The
expanded suite passes 483/483 tests; architecture, performance, and Ukrainian
encoding checks pass. `MD-R02` remains closed; `MD-R04` remains
verification-blocked until the declared local lint/typecheck tooling is
available.

Phase 198 moves Encounter Page notification presentation into private
`ui/components/EncounterNotification.tsx`. Raw `EncounterView` retains the
notification state and its close/reset command. The leaf receives controlled
message/close inputs, preserving the truthy null gate, shared notification
props, and sibling mount order. The expanded suite passes 484/484 tests;
architecture and Ukrainian encoding checks pass. `MD-R02` remains closed;
`MD-R04` remains verification-blocked until the declared local lint/typecheck
tooling is available.

Phase 199 moves Encounter Page request-cleanup lifecycle into private
`model/useEncounterRequestCleanup.ts`. Raw `EncounterView` retains ownership
of the focus-timeout and AI-edit-controller refs and passes both to the hook.
The hook preserves mount cleanup ordering: clear a present timeout, then abort
a present controller. The expanded suite passes 485/485 tests; architecture,
performance, and Ukrainian encoding checks pass. `MD-R02` remains closed;
`MD-R04` remains verification-blocked until the declared local lint/typecheck
tooling is available.

Phase 200 moves Encounter Page AI-model loading lifecycle into private
`model/useEncounterAiModelLoading.ts`. Raw `EncounterView` retains AI-editing
and model state, setters, and the localized error policy. The hook preserves
the open-edit/empty-model gate, feature-owned `loadAiModelOptions` call, and
original effect dependencies. The expanded suite passes 486/486 tests;
architecture, performance, and Ukrainian encoding checks pass. `MD-R02`
remains closed; `MD-R04` remains verification-blocked until the declared local
lint/typecheck tooling is available.

Phase 201 moves Campaign Page hash-navigation lifecycle into private
`model/useCampaignHashNavigation.ts`. Raw `CampaignView` retains campaign and
section state, section setters, the notes-view setter, and all persistence
commands. The hook preserves hash decoding, navigation-plan construction and
execution order, `120ms` delayed scroll/cleanup, and original dependencies.
The expanded suite passes 487/487 tests; architecture, performance, and
Ukrainian encoding checks pass. `MD-R02` remains closed; `MD-R04` remains
verification-blocked until the declared local lint/typecheck tooling is
available.

Phase 202 moves Session Page hash-navigation lifecycle into private
`model/useSessionHashNavigation.ts`. Raw `SessionView` retains session state,
rendered collections, and the section-toggle command. The hook preserves the
Session-specific notes-expand predicate, `140ms` delayed scroll/cleanup, and
original dependencies. The expanded suite passes 488/488 tests; architecture,
performance, and Ukrainian encoding checks pass. `MD-R02` remains closed;
`MD-R04` remains verification-blocked until the declared local lint/typecheck
tooling is available.

Phase 203 moves Campaign Page character-type drag-drop browser lifecycle into
private `model/useCampaignCharacterTypeDrop.ts`. Raw `CampaignView` retains
view identity and the character-type drop command. The hook preserves target
and drop-zone lookup, plan construction, listener lifecycle, and the raw-view
effect dependency. The expanded suite passes 489/489 tests; architecture,
performance, and Ukrainian encoding checks pass. `MD-R02` remains closed;
`MD-R04` remains verification-blocked until the declared local lint/typecheck
tooling is available.

Phase 204 moves Encounter Page grid-focus state, refs, and timeout policy into
private `model/useEncounterGridFocus.ts`. Raw `EncounterView` retains grid
projection, the participant-selection plan, and selection command ownership.
The hook preserves representative lookup, ref-map updates, auto-center scroll,
timeout replacement and conditional reset after `1800ms`, plus cleanup through
`useEncounterRequestCleanup`. The expanded suite passes 490/490 tests;
architecture, performance, and Ukrainian encoding checks pass. `MD-R02`
remains closed; `MD-R04` remains verification-blocked until the declared local
lint/typecheck tooling is available.

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
