# Updated design implementation plan

Date: 2026-11-10. Planning baseline: `b8ea321a`.

This plan translates the accepted Figma redesign into the existing React application. It covers styles, component composition, interaction states, responsive behavior, and validation. It does not authorize a backend rewrite or a replacement of existing persistence, editors, or domain models.

Design source: [GM workspace redesign](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=84-106065). Ukrainian remains the interface language.

## Current status and how to use this plan

The baseline above is historical: the current working tree already contains substantial, uncommitted redesign work across the shell, shared styles, campaign and session views, encounter, reference browsers, gallery, AI, settings, graph, and dice. Treat the phases below as an acceptance and remaining-work checklist, not as an instruction to start those changes again. Inspect the current worktree and compare each feature against its Figma reference before editing; preserve existing changes and user data.

Earlier implementation checks reported 603 passing regression tests, type checking, lint/Ukrainian, and architecture checks. These are historical results, not a fresh verification of every requirement or of subsequent changes. Visual and interaction acceptance across all states and viewport sizes is still required before declaring the redesign complete.

Recent checks against the current worktree passed type checking, lint (including UTF-8/Ukrainian), architecture, all 606 regression tests, and the performance budget script. Browser checks used mocked API data and did not touch `data/`:

| Area | Evidence gathered | Remaining acceptance work |
| --- | --- | --- |
| Notes, entities, scenes | Campaign and session NPC creation selects the new item; list selection, long names at 390px, scene-note deep links, and previously collapsed scene notes were checked. | Verify location and character creation, editing and pending-save navigation across representative viewports. |
| Moves | Cross-campaign history and rollback have regression coverage; campaign/session move picker was checked with mocks. | Exercise each source/destination combination with persistence and undo/redo in an isolated fixture. |
| Encounter and bestiary | Manual condition selection, participant-specific save/reload/removal, token preview and token editing were checked. | Review official/custom edit permissions and complete stat blocks at the required widths. |
| Gallery | Campaign-to-campaign drag payload, failure/retry, source controls, and advanced-search requests were checked. | Figma shows a workspace page while the application currently uses a modal; compare the final intended presentation and verify search results and all groups with representative assets. |
| Rules, dice, graph, settings | Seven rule tabs were keyboard checked at 320px; calculator validation, rolls, history and probability were exercised; graph labels and campaign-scoped settings were checked. | Verify all rule content categories, graph node types/selection, settings autosave and inheritance, and remaining viewport/theme states. |
| AI | Mock comparison highlighted changed text and stacked at 390px. | Exercise all contexts and operations, monster destination, image prompt, loading/error/cancel, and apply/undo. |

The official Figma design-context endpoint returned a Starter-plan rate limit during the gallery review. Figwright remained connected and rendered the gallery reference, but screenshot comparison alone does not establish full design fidelity. The browser fixture used for one gallery review contained question marks in its mock campaign names; this was fixture data, not project text, and is not evidence for Ukrainian rendering of those names.

For each phase, record what already matches, the specific remaining discrepancy, the responsible owner, and the evidence from the relevant checks. Prioritize shared foundations and behavior regressions first, then screen-specific gaps, then cross-screen responsive and accessibility review. Only change logic when the desired interaction cannot be achieved through presentation and composition alone.

## 1. Accepted requirements

- Light workspace, dark green navigation, warm gold accents, readable typography, compact spacing.
- Colors and spacing use shared variables. Existing screens adapt to smaller widths instead of reproducing fixed-size Figma canvases.
- Campaign navigation includes players, NPCs, locations, and notes above the overview content. Campaign and session views do not introduce decisions, hooks, or similar trackers.
- Encounter conditions are optional and manually available. Do not introduce automatic concentration-save reminders or other unsolicited gameplay prompts. Keep normal persistence/error notifications.
- Bestiary rows retain token previews. Encounter creatures show tokens, readable statistics, descriptions, and discoverable editing actions.
- Settings use a gear icon in a separate utility area. Keep useful resources in their own sidebar group.
- Remove the sidebar quick-access/next-session tip. Preserve the useful next-session card in the campaign overview.
- Remove the exact text `Збережено локально`. A concise save indicator may remain where appropriate.
- Undo/redo and import/export are visible, with their real scope and enabled state.
- Gallery includes every current group, a visible campaign/source list, advanced search, and supported cross-campaign drag and drop.
- Graph node types use consistent colors, a legend, and non-color identification.
- AI opens over the current page and clearly identifies its context, target, and operation. Support image-prompt creation and monster editing.
- AI data changes default to a comparison showing the old and new values, with the changed words or values highlighted directly.
- Dice calculator opens from the brand dice action. Preserve formula evaluation, results, history, and probability tools.
- Campaign and session notes use a selectable title list and a detail editor. Characters, NPCs, and locations use the same list/detail approach with available thumbnails; their detail and scene sections do not collapse.
- Untitled notes use the first 30 characters of their content as the list label. Notes can be reordered in both campaign and session lists.
- In encounters, add a condition explicitly through the Rules Reference modal, and show its rule card when its tag is hovered or focused.
- NPCs and locations can move between campaign and session levels, including a different campaign. Preserve identity, pending edits, and supported undo/redo behavior.

Current acceptance evidence: all 610 regression tests passed after the campaign overview navigation change. Mocked browser checks confirmed that choosing a party member opens that character, note reordering works with keyboard and pointer input, and the note AI-context control remains inside its row at 390px with a Ukrainian accessible label and toggle state. At 320px, scene reordering was checked using keyboard input and simulated touch pointer events; the session save request contained the new order. These checks do not replace the remaining cross-screen visual review or physical touch-device testing.

Further mocked checks verified that bestiary edit actions have visible labels for official and custom creatures, encounter grid edit labels fit at 390px, and a missing participant token shows a fallback icon. Gallery checks verified distinct selection for duplicate filenames and correct source paths for search-result rename and move requests. The comparison view was checked for additions and removals at 390px. Campaign and session note reorder requests contained the intended order and excluded the virtual placeholder; selected notes remained open. Shared label tests cover 30-character Ukrainian and emoji fallbacks. These are targeted checks; full data and viewport coverage remains outstanding.

Campaign and session NPC keyboard reordering was also exercised with mocked API responses. The campaign replacement request carried the reordered entities and indexes; the session save carried the reordered NPC array. The same list components provide character and location reordering, but those combinations have not been separately verified in this check.

At a 320px viewport, keyboard navigation through all seven rules-reference tabs kept focus on the selected tab, maintained its panel relationship, and revealed it in the horizontal tab strip without page-level overflow. This confirms navigation behavior; it does not establish the correctness of every reference entry.

The graph was inspected with mocked campaign data in light and dark themes. Visible node types retained distinct color tokens and text labels, and a selected campaign node retained a type-colored inset outline in both themes. A 390px viewport had no page-level horizontal overflow; this does not cover every graph topology or node type.

With mocked encounter persistence, selecting a condition for one of two participants saved only that participant's condition; it remained after reload and was removed on request. The condition card appeared on hover and keyboard focus, and Escape dismissed the card without removing the condition.

The AI workspace banner was inspected with mocked campaign, session, encounter, and bestiary data. Each displayed its scope and relevant target; campaign and session showed text-only mode in the fixture, while encounter and bestiary showed structured changes. This does not verify live model responses.

With a mocked encounter creature, the AI action presented separate encounter-only edit and custom-creature creation choices. Each resulting dialog named the source creature and described the selected destination. The image-prompt context form and custom-monster edit dialog were also inspected at 390px; live generation remains unverified.

## 2. Current implementation and migration approach

The application already has most of the required behavior. The work should primarily change presentation and composition, with small interaction additions where necessary.

The existing SCSS entry is `src/assets/scss/main.scss`; foundations are in `_variables.scss`, `_base.scss`, `_shared.scss`, and `_layout.scss`. Component CSS lives under `src/assets/components/` and is imported by its UI owner. Keep this system and migrate its owners directly; do not introduce another CSS framework or a final stylesheet full of global overrides.

At the planning baseline, `_variables.scss` already contains the redesigned green palette, local Manrope/IBM Plex Sans font families, 40px and 32px controls, and dark-theme values. Sidebar styling has also started moving toward the new direction. Remaining discrepancies include a 240px desktop sidebar versus the design's 208px, a 40px content-padding token versus the design's usual 24px, inconsistent radius names, and feature-specific older layouts. Confirm the current HEAD and actual computed styles before changing these values; do not redo work that has landed.

Retain these ownership boundaries:

- `app` owns navigation, global store access, runtime hosts, and global modal composition.
- Shared UI stays prop-driven. Features and widgets receive narrow runtime commands through their existing public contracts.
- Page/widget UI can change without moving persistence policies out of their domain owners.
- Use public slice entries for external imports. Avoid new private-path imports, sibling-widget coupling, or compatibility facades.
- Keep pending-save flushing, history restoration, request cancellation, and mounted-state protections intact.
- Do not change backend schemas or user data to make visual fixtures convenient. Do not touch `data/` for this migration.

## 3. Design reference map

| Area | Figma reference | Primary implementation owners |
| --- | --- | --- |
| Campaign overview and tabs | [Campaign](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=85-210619) | `pages/campaign/ui/CampaignPage.tsx`, `CampaignHeader.tsx`, `CampaignHeaderActions.tsx` |
| Session preparation | [Session](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=85-210804) | `pages/session`, `features/session-editor` |
| Encounter and optional conditions | [Encounter](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=85-211011), [conditions](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=88-214521) | `pages/encounter/ui/components`, `widgets/monster-stat-block` |
| Bestiary and custom creature | [Bestiary](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=88-213651), [creature](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=96-217273) | `widgets/bestiary-browser`, `widgets/monster-stat-block`, `widgets/monster-editor-modal` |
| Spells and rules | [Spells](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=88-214130), [rules](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=88-214335) | `widgets/spells-browser`, `widgets/rules-reference-modal` |
| Entity forms | [Player](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=97-217942), [NPC](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=98-218150), [location](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=98-218359) | `widgets/campaign-entity-card`, `widgets/campaign-entity-modal`, `features/campaign-entity` |
| Gallery | [Advanced search](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=98-220434), [drag state](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=98-220761) | `features/images/ui`, `app/ui/ImageGalleryRuntimeHost.tsx` |
| Notes graph | [Graph](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=94-216040) | `pages/campaign/ui/components/CampaignGraph*`, `CampaignNotesGraph.tsx` |
| Settings | [General](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=98-218586), [campaign](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=98-218709), [AI](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=98-218883) | `features/settings/ui/SettingsModalView.tsx` |
| Contextual AI | [Request over session](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=102-226988), [comparison](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=100-225186), [image prompt](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=100-225525) | `widgets/ai-assistant`, `features/ai`, `widgets/ai-response-modal` |
| Dice | [Calculator](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=94-215752) | `features/dice/ui`, `app/ui/DiceCalculatorHost.tsx` |
| Import/export | [Campaign archive](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=103-227711), [global import](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=103-227662) | `widgets/sidebar/ui/SidebarArchiveControls.tsx`, `PartialArchiveModal.tsx` |

Paths in the owner column are relative to `src/`. Treat Figma frames as layout and interaction references; they do not automatically imply new application routes.

## 4. Foundation specification

### Semantic variables

Keep existing public variable names where practical and add missing semantic roles. Bind component styling to roles, not duplicated color literals.

| Role | Existing variable / planned role | Light value |
| --- | --- | --- |
| Workspace canvas | `--bg` | `#F7F8F6` |
| Surface | `--panel` | `#FFFFFF` |
| Subtle surface | `--panel-soft` | `#F0F3F0` |
| Primary / secondary text | `--text`, `--muted` | `#20332D`, `#66766E` |
| Borders | `--border` | `#E2E8E2` |
| Primary action | `--accent`, `--accent-soft` | `#24745B`, `#E6F1EA` |
| Warm accent | `--warning`, `--warning-soft` or explicit decorative aliases | `#9B773B`, `#F5EEDF` |
| Sidebar | `--sidebar-bg`, `--sidebar-hover` | `#152925`, `#203D36` |
| Sidebar text | `--sidebar-title`, `--sidebar-text` | `#FFFFFF`, `#AABCB6` |
| Modal overlay | `--overlay` | `rgba(9,20,38,.42)` |
| Added / removed changes | Dedicated diff surface, border, and text roles | Green / red, with readable themed text |
| Graph types | Dedicated type surface, border, and text roles | Defined per node type |

Do not use warning styling for every decorative gold element if that implies a warning state. Add a warm-accent alias where the distinction matters. Keep dark-theme equivalents for all new roles. Validate contrast for actual foreground/background combinations, especially muted labels, gold badges, and diff text.

Spacing already uses index-based names: `--space-1` is 4px and `--space-4` is 16px. Figma's numeric spacing labels describe values differently. Preserve CSS meanings and document the mapping; do not map Figma `space/4` to CSS `--space-4` blindly. Use the existing 4/8/12/16/20/24/32 scale and extend it for recurring 40/48px needs. Tiny icon adjustments and borders need not become arbitrary spacing tokens.

Introduce understandable radius roles for controls, cards, dialogs, and pills. Existing `--radius-sm` is 12px while `--radius-md` is 8px: audit consumers before changing either. Migrate individual consumers to the new semantic aliases, then remove unused aliases.

### Typography and geometry

- Keep locally loaded fonts: Manrope for body/UI and IBM Plex Sans for headings.
- Target title 28/36px at weight 600; section heading 20/28px at 600; body 14/23px; label 13/20px at 600; secondary 12/19px.
- Keep 40px standard and 32px compact controls. Give compact icon controls adequate hit areas and accessible names.
- Target desktop sidebar 208px, top bar approximately 56px, content padding 24px, and section gaps 16px. Use smaller padding when space is constrained.
- Use approximately 8px control, 12px card, and 20px dialog radii where matched by the design.
- Prefer grid/flex with `min-width: 0`, sensible minimum columns, and text wrapping. Avoid absolute positioning for ordinary content alignment.
- Use one intended vertical scroll owner per panel. Sticky headers must not obscure focus or create nested full-height scroll traps.

## 5. Sequenced implementation work

Each phase should be reviewable independently. Integrate and verify shared foundations before migrating the screens that consume them.

### Phase 0 — Baseline and acceptance inventory

1. Record HEAD, current worktree changes, existing checks, and already-completed redesign work.
2. Capture representative current screens and corresponding Figma references at 1440px and 1280px.
3. Inventory literal colors/gaps, duplicate control styles, global selectors, and obsolete layout rules with `rg`.
4. Prepare non-user fixtures for long Ukrainian names, missing images, large creature descriptions, empty lists, and many gallery items.
5. Record existing action availability for official/custom monsters, history scopes, archive modes, and gallery permissions.

Completion: a bounded list of actual visual gaps, baseline failures recorded separately, and no accidental changes to user data.

### Phase 1 — Tokens and shared controls

Owners: `src/assets/scss/*`, `src/shared/ui/{Button,TextInput,Select,SectionTabs,Modal,UndoRedoButtons}.tsx`, and their existing CSS owners.

1. Complete semantic color, spacing, typography, radius, focus, overlay, and elevation roles.
2. Normalize controls: heights, label alignment, icon sizes, disabled/loading states, error messages, and hover/focus states.
3. Make `SectionTabs` support a compact visual hierarchy, a clear active indicator, and narrow-width overflow. Use tab semantics only for in-place tab panels; navigation links keep navigation semantics.
4. Standardize dialog header/body/footer spacing and responsive maximum dimensions through the public Modal API.
5. Preserve portal, focus restoration, Escape/overlay behavior, cancellation rules, and nested-dialog handling. Do not duplicate the modal manager.
6. Keep rich-text/editor content typography scoped so compact application labels do not damage article, spell, or stat-block readability.

Completion: shared controls match the design in light/dark themes and can be used without per-screen padding/color overrides.

### Phase 2 — Application shell, sidebar, history, and archives

Owners: `src/App.tsx`, `src/app/routing/MainContent.tsx`, `src/widgets/sidebar/ui/*`, `src/app/ui/SidebarRuntimeHost.tsx`, `_layout.scss`, `Sidebar.css`.

1. Align sidebar width, workspace offset, header spacing, and content gutters with shared layout variables.
2. Group workspace/campaign navigation, library actions, useful resources, and bottom utilities clearly.
3. Retain all seven resources: Homebrewery, Tokenizer, Assets, Owlbear Rodeo, Szepeku maps, Map Architect (AI), and Player questions.
4. Put global import/export above a separated settings action with a gear icon. Remove the unwanted tip and `Збережено локально` from every relevant view.
5. Add readable undo/redo labels and scope indication. Use application history for global actions and the existing persistent campaign history for campaign/session/encounter views; do not invent independent session journals.
6. Preserve import types and strategies: `append`, `replace_by_id`, and `wipe_and_replace`. Keep actual file input and archive handlers.
7. Keep campaign full export and partial import/export discoverable in the campaign header. The current partial archive supports sessions, NPCs, locations, images, and AI history; do not display an unsupported player checkbox. Full campaign export retains players.
8. Wire brand dice action to the existing calculator host. Preserve the mobile drawer/backdrop and keyboard access.

Completion: all global actions are reachable without overflow at 1280px; campaign and global scopes are unambiguous; the mobile drawer still works.

### Phase 3 — Campaign and session workspace

Owners: campaign/session page UI, `CampaignHeader.tsx`, `CampaignHeaderActions.tsx`, existing entity lists and note cards.

1. Place the campaign tab strip above overview content, including players, NPCs, locations, and notes. Integrate sessions/graph with existing navigation instead of duplicating state.
2. Keep the next-session overview card, compact session lists, readable notes, and obvious creation actions.
3. Reduce oversized card padding and horizontal gaps. Establish consistent title/action alignment and card headers.
4. Rework session scene/note sections with the same density and clear selected/collapsed states. Avoid decisions/hooks trackers.
5. Preserve mention links, reorder, collapse preferences, inline editing, deletion confirmations, and linked encounters.
6. Preserve debounced saves, origin-session ownership, flush on navigation/unmount, and history application suppression.

Completion: long names and content wrap cleanly; changing tabs or sessions neither loses pending edits nor duplicates data.

### Phase 4 — Player, NPC, and location cards/forms

Owners: `widgets/campaign-entity-card/ui/{CharacterCard,LocationCard,CreateCharacterButton,CreateLocationButton}.tsx`, `widgets/campaign-entity-modal/ui/CampaignEntityModalCard.tsx`, related CSS.

1. Use a compact identity header with portrait, name, type metadata, and visible edit/menu actions.
2. Group person identity fields, race/class/level, narrative fields, and notes in readable sections. Preserve first/last name, motivation, trait, description, image, and notes.
3. Keep player/NPC shared form structure while respecting type-specific labels and scope actions.
4. Give location/faction name, image, description, and notes a similarly compact arrangement.
5. Use two columns only while field labels and values remain readable; stack at constrained widths. Use persistent labels rather than placeholder-only fields.
6. Preserve image selection, mentions, inline edit behavior, rename-reference confirmation, scoped movement, and pending-save sequencing.

Completion: existing fields remain viewable/editable, empty states offer a clear action, and modal close/navigation preserves save policy.

### Phase 5 — Creature layout, bestiary, and encounter

Owners: `MonsterStatBlock.tsx`, `MonsterStatBlockSections.tsx`, `MonsterStatBlock.css`, bestiary browser UI, encounter detail/action UI, monster editor.

1. Replace the large floated token layout with a grid identity header: approximately 88–96px token in details and approximately 44px preview in list rows. Put statistics and rich content below at full usable width.
2. Preserve image fitting, fallback, token selection/replacement permissions, and supported drag/upload behavior.
3. Make edit, AI, favorite, and add-to-encounter actions discoverable without crowding the title. Keep actions permission-aware: official creatures create editable copies; custom creatures can be updated/deleted; encounter-local changes retain their distinct destination.
4. Preserve all stat families: ability scores, AC/HP/speed, skills/saves, senses/languages, traits, actions, bonus actions, reactions, legendary/lair/regional content, spellcasting, links, and dice controls.
5. Align bestiary filters and token rows. Synchronize virtualized row measurements with the new row geometry.
6. Adapt encounter participant cards to tokens with compact vital statistics and access to complete details.
7. Provide a small explicit add-condition action and removable condition chips. Empty conditions take minimal space. Do not add mandatory condition steps or automatic concentration checks.
8. Preserve participant identity/current HP, custom-only refresh rules, selected-instance state, and the focused add-monster command. Never save a whole session to add a creature.

Completion: tokens never squeeze statistics into a narrow strip; edit availability is correct for each creature source; encounter-local changes remain local unless explicitly applied elsewhere.

### Phase 6 — Spells and game rules

Owners: `widgets/spells-browser/ui/*`, `widgets/rules-reference-modal/ui/*`, shared tabs and reference styles.

1. Use consistent library header, filters, list/detail panels, empty/loading states, and compact tab navigation.
2. Keep access to bestiary, spells, conditions, diseases, rules, skills, and senses. Collapse or scroll navigation at narrow widths without hiding categories permanently.
3. Improve spell metadata and reference text hierarchy, retaining readable line length and rich rule links.
4. Preserve source selection/priority, canonical record identity, search behavior, inline insertion, nested previews, request cancellation, scroll restoration, and virtualization.
5. Reuse current widgets for full-workspace and modal presentations. Add route wrappers only if navigation needs them, composed by `app`; do not duplicate browser logic for Figma frames.

Completion: every current category and source remains accessible, and a selected reference opens correctly from both browsing and inline links.

### Phase 7 — Gallery and advanced search

Owners: `src/features/images/ui/*`, `imageGalleryConfig.ts`, `ImageGallery.css`, app runtime host.

1. Keep General and campaign sources visible beside the asset grid. Give long campaign names a readable selected state.
2. Show all groups: maps, scenes, tokens, characters, props, notes, attachments. Preserve NPC/player subfolders where supported.
3. Present search scope explicitly: current folder (`local`), source, all sources, and official database tokens when available for General/Tokens.
4. Show result path/source metadata and provide navigation into a result's folder. Preserve current restrictions on dragging global-search results and read-only database tokens.
5. Provide clear valid-target drag highlighting for campaign/source/category/folder moves, with success/error feedback. Retain rename, bulk selection, move, delete, upload, and reorder controls.
6. Keep path back/forward navigation and reference propagation after moves. Preserve virtualized rendering and abort/mounted guards.

Completion: a supported user asset can be moved to another campaign with the source list visible; official tokens cannot be modified; every group is reachable.

### Phase 8 — Contextual AI request workflow

Owners: `widgets/ai-assistant/ui/*`, `features/ai/ui/*`, assistant context controllers, app AI runtime host.

1. Keep the assistant modal above campaign, session, encounter, or bestiary content. Show a concise scope/target header and destination summary.
2. Distinguish the resource to modify from supporting context selected for reading. Make the active target visible throughout the request.
3. Present structured changes, plain answers, image-prompt creation, and monster editing as understandable task choices.
4. Image-prompt mode returns editable/copyable prompt text. Preserve its object/context picker; do not imply image generation exists.
5. Monster editing distinguishes encounter-local edits, eligible custom-creature updates, and creation of a new copy.
6. Reuse the existing modal shell, request history, loading/cancel behavior, model/settings controls, and route-context updates. An entry chooser may be an overlay; do not introduce a separate chat page.

Completion: before submitting, a user can identify what context is read, what will be changed, and where the result will go.

### Phase 9 — AI comparison and change application

Owners: `widgets/ai-response-modal/ui/AiResponse*Diff.tsx`, `AiResponseModalView.tsx`, resource action components, existing draft model/controller.

1. Build on existing structured before/after snapshots and resource diffs; do not replace parsing or application logic.
2. Default data-mutation previews to comparison. Label current/proposed values and their fields; highlight changed values directly, with neutral unchanged content.
3. Use red/removal treatment for old values and green/addition treatment for new values. Include textual labels or markers so color is not the only signal.
4. Show additions as absent-to-new and deletions as old-to-removed. Present reordered collections without pretending every item was recreated; match existing stable resource identity.
5. For long text, highlight changed words/phrases with a bounded diff strategy and a readable fallback for very large content. Render text safely; do not diff rendered HTML or insert untrusted HTML.
6. Keep editable drafts, per-resource apply/undo, JSON inspection, failure feedback, and original snapshots after application.
7. Respect the existing auto-apply setting. Show applied status/comparison and undo when enabled; do not force a new confirmation step universally.
8. At narrow widths, stack old/new values with explicit labels; retain the side-by-side comparison where readable.

Completion: HP, names, descriptions, notes, additions, and removals visibly show exactly what changed; applying or undoing uses the existing domain pipeline.

### Phase 10 — Graph, settings, and dice finishing

Graph owners: `CampaignNotesGraph.tsx`, `CampaignGraphToolbar.tsx`, `CampaignGraphNodeCard.tsx`, details/connection components, `CampaignNotesGraph.css`.

- Map campaign, note, player, NPC, location, session, scene, and unresolved node types to shared semantic colors. Use tinted surfaces with contrasting text/borders.
- Match legend/filter labels and node styling. Keep a type label/icon and a distinct selection outline without replacing the type color.
- Preserve existing XYFlow/D3 layout, collision, drag/pan/zoom, filters, selection, and note editing. Styling does not justify changing layout constants.

Settings owner: `features/settings/ui/SettingsModalView.tsx` and current controller/composition.

- Organize general, campaign, and AI sections using compact aligned rows and readable help text.
- Preserve theme/language, search debounce, AI auto-apply, simplified notes, source preferences, and both prompt settings.
- Show global versus campaign scope and inherited values clearly. Keep current autosave behavior; do not add a nonfunctional Save button.

Dice owners: `features/dice/ui/*`, `app/ui/DiceCalculatorHost.tsx`.

- Style formula input, dice controls, result/history, and probability action consistently with shared controls.
- Keep calculator popup, formula rules, error states, result history, and probability modal. Do not replace the dice engine.

Completion: graph colors communicate type consistently; settings preserve scope/inheritance; dice works from the sidebar and inline roll controls.

### Phase 11 — Responsive polish and obsolete-style removal

1. Review all migrated screens together for consistent density, title baselines, tab height, card gutters, and action alignment.
2. Test 1440, 1280, 1024, 768, and approximately 390px viewport widths, plus 200% browser zoom.
3. Prefer wrapping action groups, compact padding, stacked forms, and list-to-detail navigation before reducing text size.
4. Preserve mobile sidebar behavior. Limit horizontal scrolling to intentional regions such as tabs or genuinely wide data, not the entire page.
5. Remove superseded selectors, unused classes/components, duplicated tokens, and obsolete layout branches after checking their consumers.
6. Audit remaining hardcoded colors/gaps and document legitimate exceptions such as user-defined colors and calculated canvas coordinates.

Completion: no unintended page-level horizontal overflow, clipped actions, overlapping labels, or orphaned legacy styling across the migrated areas.

## 6. Validation strategy

### Visual and interaction review

| Area | Required states and checks |
| --- | --- |
| Foundations | Light/dark, focus, hover, disabled/loading/error, long Ukrainian labels, 200% zoom |
| Shell | Active campaign/no campaign, sidebar scroll, mobile drawer, settings separation, resources, archive/history scope |
| Campaign/session/entities | Empty and populated lists, long notes, inline editing, mentions, pending-save navigation, rename, reorder, scope movement |
| Creatures/encounter | Official/custom/missing token, long stat block, local/global edits, HP changes, optional conditions, selected participant |
| References | All seven categories, source filters, no results, large list, inline rule/spell links, narrow detail view |
| Gallery | All groups, all search scopes, many items, long paths, valid/invalid drag targets, read-only token results, bulk actions |
| AI | All four scopes, context/target changes, image prompt, creature destination, loading/cancel/error, manual and automatic application |
| Comparison | Number/text/object/list changes, addition/removal/reorder, unchanged fields, large text, draft edits, apply/undo |
| Graph/settings/dice | Every graph type and selected state, settings inheritance/autosave, valid/invalid dice and probability |

Compare browser screenshots against Figma at matching viewport widths. Validate computed geometry and interactive states as well as appearance; a static screenshot alone does not demonstrate correct modal, keyboard, or persistence behavior.

Keyboard review includes visible focus, logical order, labelled icon buttons, dialog focus containment/restoration, tabs or links with appropriate semantics, and usable forms. Do not intercept application undo shortcuts while a text editor needs its own undo behavior. Ensure changes/errors remain understandable without color alone.

### Automated checks during implementation

- Run `npm run lint` and `npm run typecheck` for migrated TypeScript/UI. Lint includes the Ukrainian text check.
- Run `npm run check:architecture` when adding components, wrappers, runtime contracts, or changing imports.
- Run `npm test` before completing each implementation phase; separate pre-existing failures from regressions.
- Run `npm run check:performance` for relevant changes to virtualized lists, rich-content rendering, gallery, or graph.
- Add focused behavioral tests only when logic changes: comparison projection/fallbacks, target selection, new navigation behavior, or permission handling. Avoid tests that merely repeat CSS declarations.
- Verify UTF-8 and scan changed files for replacement characters or broken Ukrainian strings. Read representative labels in the running UI.

Updating this plan requires document/path/encoding checks only. Previously reported implementation checks do not replace the acceptance review described above.

## 7. Main risks and safeguards

| Risk | Safeguard |
| --- | --- |
| Shared tokens unexpectedly change unrelated views | Introduce semantic aliases; migrate owners deliberately; review representative screens after foundation changes |
| Sidebar width/content offsets diverge | Use a single shared width token for sidebar and workspace layout; verify drawer breakpoints |
| Component CSS overrides leak into editors/stat blocks | Scope selectors to component roots; avoid generic descendant rules for all headings/buttons |
| Shorter virtual rows cause scroll jumps | Update measurements together with CSS; test long names, loaded images, and selection restoration |
| Compact dialogs create competing scroll regions | Define header/body/footer sizing and one intended body scroll owner; check nested previews |
| Restyle disrupts autosave/history | Keep existing hooks and injected commands; exercise pending edits during close/navigation/undo |
| AI applies changes to an unexpected destination | Explicit scope and target labels; preserve command eligibility and before/after snapshots |
| Gallery redesign implies unsupported writes | Keep source permissions and path policy; label database assets read-only |
| Token dimensions obscure monster content | Grid identity header plus full-width stat content; test missing and unusually shaped images |
| Graph selection hides node type | Keep type surface/border and add a separate selection outline |
| Localized strings become corrupted | UTF-8 edits, Ukrainian lint, replacement-character scan, and visual review |

## 8. Delivery order and definition of done

Recommended review units: foundations → shared controls → shell/history/archive → campaign/session → entity forms → creatures/bestiary/encounter → spells/rules → gallery → contextual AI → AI comparison → graph/settings/dice → responsive cleanup.

Once foundations and shared controls are stable, the feature migrations are largely independent, but each should integrate before broad final polish. Reuse the existing React, Sass, Lexical, ReactList, XYFlow, and D3 tooling. No new dependency is required by this plan.

Every review unit should include:

- Concrete before/after screenshots at representative widths and in relevant states.
- A short explanation of component/style changes and any interaction changes.
- Passing applicable checks, with unrelated baseline failures identified.
- Confirmation that supported fields, permissions, data persistence, and history scope remain intact.
- Removal of code/styles made unnecessary by the change.

The migration is complete when all accepted requirements above are demonstrated in the running application, all screens use the shared foundations consistently, smaller viewports remain usable, Ukrainian text is intact, and relevant regression/architecture checks pass. Figma screen count or superficial color matching alone is not the completion criterion.
