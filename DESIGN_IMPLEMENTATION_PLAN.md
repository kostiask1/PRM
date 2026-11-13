# Updated design implementation plan

Date: 2026-11-10. Planning baseline: `b8ea321a`.

This plan translates the accepted Figma redesign into the existing React application. It covers styles, component composition, interaction states, responsive behavior, and validation. It does not authorize a backend rewrite or a replacement of existing persistence, editors, or domain models.

Design source: [GM workspace redesign](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=84-106065). Ukrainian remains the interface language.

## Current status and how to use this plan

The baseline above is historical: the current project already contains substantial redesign work across the shell, shared styles, campaign and session views, encounter, reference browsers, gallery, AI, settings, graph, and dice. Treat the phases below as an acceptance and remaining-work checklist, not as an instruction to start those changes again. Inspect the current worktree and compare each feature against its Figma reference before editing; preserve existing changes and user data.

Earlier implementation checks reported 603 passing regression tests, type checking, lint/Ukrainian, and architecture checks. These are historical results, not a fresh verification of every requirement or of subsequent changes. Visual and interaction acceptance across all states and viewport sizes is still required before declaring the redesign complete.

Recent checks against the current worktree passed type checking, lint (including UTF-8/Ukrainian), architecture, and the performance budget script. The latest regression run passed all 615 tests. Most browser checks use mocked API data or a separate temporary backend and do not touch the project's `data/`; the connected in-app browser was also used for read-only visual inspection:

| Area | Evidence gathered | Remaining acceptance work |
| --- | --- | --- |
| Notes, entities, scenes | Campaign and session NPC creation selects the new item; list selection, long names at 390px, and scene-note deep links were checked. Character, NPC, and location card notes now use the same title list and detail editor, including reorder and AI controls; a mocked character check selected an untitled note at 1440px and 320px and showed its text-derived label and detail. An isolated-backend NPC check edited and reordered an untitled note, then confirmed its text and order in storage; the list showed a Markdown-free preview and ellipsis. Isolated campaign and session history links to notes on a non-first NPC selected both the correct NPC and the correct note. Scene notes also use the title list and detail editor. A direct link selected the intended scene note at 1440px and 320px; an isolated-backend check edited and reordered that note and confirmed its saved text and order. Mocked browser checks confirm legacy collapsed flags do not hide entity or scene notes, non-collapsible player, NPC, and location headers no longer use a pointer cursor, and note reorder and AI controls do not overlap in campaign, entity, or scene notes. At 320px, a long untitled Ukrainian note displayed its first 30 characters with the reorder handle, label, and AI control in separate regions and no page overflow. Campaign lists and details were checked at 1024px, 768px, and 390px; intermediate widths stack the panels to preserve editing space. At 320px a 20-note campaign list scrolls within 30% of viewport height and selecting a later note opens its detail; campaign and session note lists share this responsive rule. Character-card note lists and editors were checked at 1440, 1024, 901, 768, and 320px; nested panels stack when their available space is narrow without page overflow. Simulated pointer drags near both list edges scrolled the list and moved notes to off-screen positions, including a note whose title contains an entity link. Repeated keyboard moves kept focus on the note and scrolled it into view; physical touch-device testing remains outstanding. A scene linked to numeric encounter ID zero displays the existing encounter action and navigates to it in a headless check. Session notes, NPCs, and locations also stack without page overflow at 768px; NPC and location lists show thumbnails and move actions without collapse controls at 1440px and 390px. The campaign notes AI toggle and keyboard reorder act independently and send the correct combined save payload. Isolated-backend browser checks confirmed that editing an untitled session note updates its fallback, preserves selection after keyboard reorder, and persists both edit and order; an immediate navigation to the gallery also preserved the pending edit. Campaign character and location creation select the new item; editing either and immediately selecting another preserved the Ukrainian edit in storage. At 390px, an isolated-backend check edited a session NPC, immediately selected another NPC and navigated to the gallery, and confirmed the Ukrainian description was persisted. Another isolated-backend check edited a location and immediately moved it to another campaign; the destination retained the updated Ukrainian description and original ID. | Verify pending-save navigation across remaining viewport and session-scope cases. |
| Moves | Cross-campaign history and rollback have regression coverage; campaign/session move picker was checked with mocks. Isolated-backend browser checks moved a session NPC to its campaign and a session location to a session in another campaign, preserving IDs and removing each from its source. The cross-campaign move was undone and redone through the application history controls. A campaign NPC was also moved into a session in the same campaign, retaining its ID and Ukrainian description and disappearing from the campaign list. A campaign-level location moved directly to another campaign with its ID and description intact. When campaigns share a name, the move picker includes their distinct slugs; an isolated-backend check selected the intended duplicate and confirmed the destination. Duplicate session names likewise show their filenames, and an isolated check moved an NPC to the selected session. At 320px, long unbroken destination labels now wrap inside the dropdown instead of overflowing it. | Exercise the remaining source/destination combinations in an isolated fixture. |
| Encounter and bestiary | Manual condition selection, participant-specific save/reload/removal, token preview and token editing were checked. The condition card opens on hover and keyboard focus; selecting a reference does not add it until its Add action is pressed. The encounter source contains no automatic concentration reminder, and the picker uses the conditions tab of Rules Reference. The editor labels official-copy and custom-edit destinations distinctly. Creature size, alignment, and average HP labels are localized in Ukrainian and were checked in the editor. Static label review also filled missing Ukrainian empty-state and error messages in campaign, session, encounter, and Bestiary flows. A Bestiary action opens a new custom creature editor; isolated-backend checks saved a new creature without borrowing an existing token and undid it. Duplicate names produced an error without overwriting the existing creature; correcting the name in the retained editor saved successfully. The compact action menu stayed within the viewport at 320px, 390px, and 768px. When creation starts under an official-source filter, the created creature remains open and an inline notice explains why it is absent from the list; resetting the filter reveals it and removes the notice. An isolated-backend browser check saved an official creature as a custom copy, updated an existing custom creature while preserving its ID, and confirmed the official record remained unchanged. Mocked stat blocks at 1440px and 390px rendered spellcasting, traits, bonus actions, actions, reactions, legendary, lair, and regional content without horizontal overflow, including a long unbroken word. Encounter participant and detail panels were checked at 1024px, 768px, 390px, and 320px without overlap or page overflow. A creature with at-will, daily, rest, cantrip, slotted, and footer spellcasting content rendered all fixture entries at 1440px and 390px without stat-block overflow. | Review additional spellcasting structures and remaining interaction states. |
| Gallery | The sidebar opens the gallery workspace and the image picker remains a modal. Mocked checks at 1440px and 390px confirmed the route, active navigation, all groups, and no document overflow; browser back, forward, and reload restore the expected workspace. Keyboard activation opens the file chooser and selecting the same file twice sends two uploads. An isolated-backend workspace check moved an uploaded image between campaigns and verified both directories and destination feedback; an isolated-backend search returned the matching image in the current folder, both matching groups in the current campaign, and matching images across campaigns in the full gallery, with source paths shown. An isolated official-token fixture returned the searched token under the database scope with its database path, protected styling, and dragging disabled. | Verify remaining responsive states with representative assets. |
| Rules, dice, graph, settings | Seven rule tabs were keyboard checked at 320px; a mocked browser check opened content in all seven categories, including spells and bestiary, without page overflow. Calculator validation, rolls, history and probability were exercised. A graph fixture showed distinct campaign, note, character, NPC, location, session, scene, and unresolved-reference colors; session and scene notes share the note color, and selection retains a separate outline in light and dark themes. Graph summary text uses its type ink; token contrast is at least 6.5:1 against each node surface in both themes, and a browser check confirmed the applied light-theme colors. A 320px mocked graph with a long unbroken note title kept its type filters within the toolbar; toggling the notes filter removed note nodes and updated its pressed state. Active filter text against each type color measures at least 6.8:1 in light and 9.4:1 in dark theme. An isolated-backend browser check saved and reopened a campaign AI prompt while retaining the global prompt. The campaign source control now explicitly describes copying the current global selection; 320px mocked checks showed distinct Ukrainian inherited and campaign-specific labels, the copy explanation, and the expected campaign patch without page overflow. An isolated-backend check copied the global source selection, changed the global selection, and reopened settings; the campaign retained its own saved sources and displayed the campaign-specific label. | Verify remaining settings inheritance cases and viewport/theme states. |
| AI | Mock comparison highlighted changed text, additions, removals, and note reordering, and stacked at 390px. Creature size, alignment, and custom-source labels also render in Ukrainian in the stat-block comparison. Creature HP and armor changes use compact Ukrainian labels and values; a headless comparison showed highlighted old/new numbers at 1440px and 390px, with complex values retaining their full representation. A long creature-description comparison was also checked at 1440, 390, and 320px with a 600px-tall viewport: the response scrolls, the apply action remains available, and no horizontal overflow occurs. A regression check verifies that a small change in a long note highlights the changed text while preserving unchanged context; very long values retain matching context, and broadly changed regions use a bounded fallback that keeps unchanged prefix and suffix unhighlighted. Regression coverage includes Ukrainian text and emoji. Route checks confirm the campaign and bestiary retain their contextual assistants while the gallery does not show a misleading session assistant. Session and encounter checks opened the assistant over the current page and displayed the correct scope, item name, and campaign/session path; encounter controls also exposed creature editing and custom-creature generation. Route-state and request-boundary regression coverage includes a numeric zero encounter ID: it retains encounter context and enables creature editing in the AI service. Mocked encounter creature editing presents separate battle-only and new-custom-creature destinations; the image-prompt form exposes labelled fields at 390px. A mocked campaign-context request sent Ukrainian instructions as an image-prompt request and displayed the returned text in a response dialog and history. Isolated-backend browser checks applied and undid a prepared campaign-description change, and applied and undid one NPC change without applying a separate campaign change. A simulated automatically applied response appeared in history as applied and reopened with the old and new values highlighted; persistence was mocked in that check. A focused generation test covers cancellation, missing API keys, and service failures. In a headless campaign-context check, a delayed simulated request showed a cancel action; cancellation restored the generate button without an error. A simulated HTTP 500 showed its message both in the assistant and an alert, and restored the generate button. | Exercise remaining contexts and operations with representative responses. |

Figwright is connected again. The encounter reference `85:211011` uses a participant list with two creature stat cards side by side; the current encounter supports both single-card and configurable grid modes, so visual comparison should use grid mode. The reference also depicts a round and next-turn control. Implementation should use the existing participant order (which is already reorderable), identify the current participant by `instanceId`, preserve an optional round and current participant on the encounter, and persist changes through `applyEncounterUpdate`/`useEncounterPersistence`. Starting an old encounter must remain explicit; removal, reordering, empty encounters, undo/redo, and reload need coverage. Do not infer initiative rolls or concentration reminders. Source inspection found initiative estimates but no round/current-turn state or next-turn command in the encounter page and editor; this is a functional gap against the depicted control, not a verified feature. A first implementation adds explicit start and next-turn actions using saved encounter state and participant order. A regression test covers start, wrap, reorder, removal, and empty lists; the initial control was inspected on the real site without starting a turn. An in-app browser check using an isolated in-memory API started turns, advanced to the second participant, reloaded with that state retained, and wrapped to round two. A separate in-app browser check with a copied server and isolated filesystem retained the second turn after reload, undid it to the first participant, and redid it to the second; no user campaign files were used.

A targeted scan of the changed component styles found no hexadecimal or RGB color literals and no nonzero pixel values in gap, padding, or margin declarations. Other units, computed values, inline styles, and unchanged styles were outside this scan.

An isolated failed-save browser check confirmed that a failed turn change now restores the previous turn and shows an error, allowing the same action to be attempted again. The rollback is limited to the matching turn fields so unrelated edits are retained.

Encounter save failures now leave a persistent retry action. An isolated browser fixture rejected an HP change once, accepted retry, and returned the edited value after reload.

Concurrent encounter saves remain a risk: an HP edit can send a second full encounter while a turn save is in flight, and the existing persistence hook does not serialize those requests. The delayed-failure check verified local display only; it did not prove durable ordering or resolve mixed success/failure. The persistence hook now queues writes. In an isolated browser fixture, a delayed failed turn save followed by a successful HP edit retained both the turn and HP after reopening. Further tests are needed for other failure orders and navigation during an in-flight save.

The turn control disables advancement when there are no identifiable participants. If the saved current participant is removed, the UI explicitly shows that the participant is unavailable; advancing selects the first remaining participant without incrementing the round. In an isolated filesystem-backed browser fixture, deleting the current participant showed the unavailable state; advancing selected the remaining participant in the same round and survived reload. The empty-list behavior has unit coverage.

A variable-reference scan of changed component styles found three tokens without stylesheet declarations: `--filter-color`, `--search-result-color`, and `--gallery-columns`. Source inspection confirmed that their owning React components assign them inline. This scan checks references only, not every hardcoded color or spacing value.

Read-only in-app review of a populated campaign graph confirmed visible type-colored nodes, matching legend and type filters, node/link totals, zoom controls, and a minimap on real data.

In-app browser review of the real gallery exposed a blank empty folder. The gallery now shows loading, empty-folder, and no-search-results states; an empty folder, an unmatched search, and a populated campaign folder were checked without modifying files.

Read-only in-app browser review of a saved campaign AI response confirmed that changed description text is highlighted on both sides. Note arrays in entity-card comparisons now use the existing per-note comparison instead of raw JSON; a saved response was inspected in the in-app browser, including an added empty note. Nested apply/undo actions are hidden because the parent card owns the change. A regression test verifies nested draft edits after reordering, including ID zero and a missing target. In the in-app browser with isolated mock API data, a changed note and its reordered position appeared in comparison; editing it, reordering it with the keyboard, editing it again, and selecting the other note preserved both texts and updated the comparison. No response was applied or reverted during this review.

The official Figma design-context endpoint returned a Starter-plan rate limit during the gallery and later bestiary reviews. The bestiary screenshot confirms the intended list-and-detail structure, token thumbnails, and visible editing action; prior browser checks cover the corresponding implemented interactions. A later campaign overview context and screenshot were retrieved successfully; the implementation now includes the reference's direct notes-graph action beside the campaign tabs, verified at 320px and at a 720 x 450 CSS viewport, with no page-level horizontal overflow. Figwright remained connected and rendered the gallery reference, but screenshot comparison alone does not establish full design fidelity. The browser fixture used for one gallery review contained question marks in its mock campaign names; this was fixture data, not project text, and is not evidence for Ukrainian rendering of those names.

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
- Untitled notes use the first 30 characters of their readable content as the list label, omitting Markdown formatting and adding an ellipsis when text remains. Entity mentions remain interactive in note labels and campaign overview descriptions; a truncated mention retains its full destination. The overview description scrolls when long, and a focused mention near its end remains reachable; this was checked at 1440px and 320px. Notes can be reordered in both campaign and session lists.
- In encounters, add a condition explicitly through the Rules Reference modal, and show its rule card when its tag is hovered or focused.
- NPCs and locations can move between campaign and session levels, including a different campaign. Preserve identity, pending edits, and supported undo/redo behavior.

Current acceptance evidence: all 613 regression tests passed after the recent design and comparison changes. Mocked browser checks confirmed that choosing a party member opens that character, note reordering works with keyboard and pointer input, and the note AI-context control remains inside its row at 390px with a Ukrainian accessible label and toggle state. At 320px, scene reordering was checked using keyboard input and simulated touch pointer events; the session save request contained the new order. These checks do not replace the remaining cross-screen visual review or physical touch-device testing.

Further mocked checks verified that bestiary edit actions have visible labels for official and custom creatures, encounter grid edit labels fit at 390px, and a missing participant token shows a fallback icon. Gallery checks verified distinct selection for duplicate filenames and correct source paths for search-result rename and move requests. The comparison view was checked for additions and removals at 390px. Campaign and session note reorder requests contained the intended order and excluded the virtual placeholder; selected notes remained open. Shared label tests cover 30-character Ukrainian and emoji fallbacks. These are targeted checks; full data and viewport coverage remains outstanding.

Campaign and session NPC keyboard reordering was also exercised with mocked API responses. The campaign replacement request carried the reordered entities and indexes; the session save carried the reordered NPC array. The same list components provide character and location reordering, but those combinations have not been separately verified in this check.

At a 320px viewport, keyboard navigation through all seven rules-reference tabs kept focus on the selected tab, maintained its panel relationship, and revealed it in the horizontal tab strip without page-level overflow. Representative mocked conditions, diseases, senses, skills, variant rules, spells, and bestiary entries rendered in their respective tabs. This does not establish the correctness of the complete reference dataset.

The graph was inspected with mocked campaign data in light and dark themes. Visible node types retained distinct color tokens and text labels, and a selected campaign node retained a type-colored inset outline in both themes. A 390px viewport had no page-level horizontal overflow; this does not cover every graph topology or node type.

With mocked encounter persistence, selecting a condition for one of two participants saved only that participant's condition; it remained after reload and was removed on request. The condition card appeared on hover and keyboard focus, and Escape dismissed the card without removing the condition.

The AI workspace banner was inspected with mocked campaign, session, encounter, and bestiary data. Each displayed its scope and relevant target; campaign and session showed text-only mode in the fixture, while encounter and bestiary showed structured changes. This does not verify live model responses.

With a mocked encounter creature, the AI action presented separate encounter-only edit and custom-creature creation choices. Each resulting dialog named the source creature and described the selected destination. The image-prompt context form and custom-monster edit dialog were also inspected at 390px; live generation remains unverified.

The settings dialog was inspected at 320px and 768px with mocked settings. Its navigation remained visible without page-level overflow, the dialog exposed its title and close action, and a theme change updated the page and sent the expected settings patch. Campaign inheritance and every setting's persistence require their own checks.

The sidebar dice action opened the calculator and focused its formula field. A browser check covered an invalid formula, a valid roll, keyboard reroll from history, the probability view, and a 390px viewport without page-level overflow. At 320 x 360, the action buttons wrap into two rows without horizontal overflow and the panel scrolls within the viewport. This does not replace the dice engine's regression tests.

With mocked history, the sidebar exposed application-scoped undo/redo and import/export actions. At 320px the campaign undo/redo icons remained visible with accessible labels, and campaign archive actions were available in the action menu. The disabled state in this fixture reflected an empty history. An isolated-backend browser check downloaded a full compressed archive through the sidebar and verified that it contained a campaign and NPC with intact Ukrainian text; A headless isolated-backend check imported a single-campaign archive through the sidebar's append strategy and file input; the imported campaign and NPC retained their Ukrainian text.

A mocked campaign-to-session NPC transfer enabled application undo; undo restored the NPC and enabled redo, and redo moved it again. The requests used the respective history revisions. This checks the UI and request flow, not an end-to-end filesystem archive or history restore.

The regression suite separately exercised NPC and location transfers for campaign/session source and destination combinations across campaigns, including ID zero, data preservation, duplicate protection, and compensation after a failed source write. Isolated filesystem history tests covered undo/redo for a cross-campaign NPC transfer and a same-campaign session-to-session location transfer. All 610 tests passed with temporary data outside the user data directory.

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
4. Rework session scene/note sections with the same density and clear selected states. Keep scene details expanded and avoid decisions/hooks trackers.
5. Preserve mention links, reorder, inline editing, deletion confirmations, and linked encounters.
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
