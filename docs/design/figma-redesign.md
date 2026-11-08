# Workspace redesign

The redesign uses the connected [PRM Figma file](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled). Access and edits were performed with Figwright MCP.

## Screens and implementation

| Figma | Project owner |
| --- | --- |
| [Campaign desktop](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=4-2) | `src/pages/campaign/ui/CampaignPage.tsx`, `components/CampaignOverview.tsx` |
| [Session desktop](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=5-61) | `src/pages/session/ui/SessionPage.tsx`, `components/SessionScenesSection.tsx` |
| [Campaign mobile](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=6-83) | Responsive campaign styles and the existing sidebar runtime |
| [Shared library](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=3-40) | `src/shared/ui`, domain owners remain in their existing slices |

The app uses a fixed desktop sidebar, a mobile drawer, a workspace header, campaign section tabs, a campaign overview, and a scene outline beside the selected scene editor. Existing campaign and session editors remain mounted when their sections are hidden. Scene selection belongs to `useSessionSceneSelection`; editing and persistence remain in their existing features.

`SectionTabs` supports arrow keys, Home, End, selected state, and roving tab focus. Campaign/session counts and summaries use loaded application data. The illustration is exported from Figma node `4:120` into `public/design/4-120.svg`.

## Foundations

`src/assets/scss/_variables.scss` owns the palette and spacing. Figma variable code syntax references the existing CSS properties. Surface, input, and panel tokens can share a color while retaining their separate semantic roles.

Manrope and IBM Plex Sans are served locally from `public/fonts`; their OFL license files are included. The dark palette is an application adaptation of the new light design; the original screen frames specify the light theme.

## Verified component assets

| Asset | Figma node | Source |
| --- | --- | --- |
| Icons: 54 editable vectors | Review `11:112` | `src/shared/ui/Icon.tsx` |
| Button: six role families, 90 variants | Sets `12:1147` through `12:1152` | `src/shared/ui/Button.tsx` |
| TextInput: 12 type/state variants | `12:1465` | `src/shared/ui/TextInput.tsx` |
| Checkbox: eight variants | `12:1497` | `src/shared/ui/Checkbox.tsx` |
| Switch: six variants | `12:1536` | `src/shared/ui/Switch.tsx` |
| Image field: empty, valid, missing | [`14:3812`](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=14-3812) | `src/features/images/ui/ImageAssetFieldView.tsx` |
| Image destination settings: wide/narrow, 12 compositions | `19:4392`, `19:4393` | `src/features/images/ui/ImageTargetSettings.tsx` |
| Upload dialogs: ready/uploading, desktop/mobile | [Desktop](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=20-6502), [mobile](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=20-7059) | `src/features/images/ui/ImageDropzone.tsx` |
| Gallery: items, source/category states, scoped search, toolbar, grids | [Desktop](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=20-9783), [mobile](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=20-10026) | `src/features/images/ui/ImageGalleryView.tsx` and its child owners |

The source coverage ledger currently records 134 of 291 native visual definitions, 31 of 91 visible compositions, all 54 icons, and both inline render helpers. The expanded inventory covers 216 TSX/JSX files and 129 compositions, including 38 runtime adapters. Shared modal families contain 40 desktop/mobile variants with standard or replaceable custom content.

Character/NPC and location cards now have 22 wide/narrow card and modal presentations. Reusable identity, details, header and note families preserve independent note collapse, classic/simplified notes, empty drafts, image controls and all 20 character levels. Creation flows include eighteen character/NPC/location dialogs for empty, ready and submitting states, with card headers hidden and creation actions inside the body.

- [Character cards](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=20-12464)
- [Location cards](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=20-12466)
- [Creation dialogs](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=20-17074)

The shared Figma Select trigger now follows its parent width, and open menus overlay surrounding content. Editable multiline fields use content-driven height with the source minimum instead of a fixed 128px height. These are Figma library corrections; the app code already has those behaviors. The entity phase's 72 new Figma variants and eighteen creation dialog instances were checked for text sizing, clipping and Ukrainian encoding. AI comparison styling remains with the unfinished AI preview family.

Navigation assets include six [desktop/mobile sidebars](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=20-25173), [open/closed drawer examples](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=20-26917), campaign groups, status badges, history capabilities, resource links, backup states and eight import-mode dialogs. The six source resource URLs have native hyperlinks in both layout examples. The source currently falls back to English for the three import strategy labels; those labels are preserved.

The navigation phase's 74 new Figma variants passed text-sizing and UTF-8 checks. The 0.7-second backup spinner and 0.18-second drawer opening were exported and reviewed across six and five frames respectively. A separate native timeline records the source's 1.5-second reduced-motion spinner. Motion examples live in review frames, while runtime event handling and scrolling remain application behavior. The open drawer uses a white close icon for contrast.

Both paired semantic color collections now contain 70 colors, including sidebar-title, success, dropped-dice and reference-link roles. Reference hues, mixed text colors, translucent hover fills and underline colors follow the source CSS. The sidebar footer, dice-total and reference-link styles are bound to the existing body font variable. Starter-plan mode limits still require paired light/dark collections.

[Settings dialogs](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=20-32374) cover general preferences, language, global/no-campaign/inherited/custom scopes, source selection, simplified notes and AI prompts. Source and prompt saving indicators remain independent; fields stay enabled while saving. There is no invented Save footer. Desktop and mobile dialogs have paired dark review instances, and the three source error notifications have wrapping examples.

[Player questions](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=20-34652) include initializing, browse and selected presentations. The library uses sixteen real sample rows from the bundled 600-question dataset. The source policy was executed to obtain `((1d6 - 1) * 100) + 1d100`; the roll button retains the source label `1d600`. Number lookup highlights a question without filtering the list. Scroll position, dice execution and virtualization remain runtime behavior.

The settings phase checked 69 new Figma variants and fourteen dialogs for text sizing, Ukrainian encoding and clipping. Shared switches and option rows now wrap at narrow widths. Notification text also wraps within its existing width. Editable copy controls default to hidden, matching the source; separate examples show the optional copy states. Popup anchors preserve left alignment when a menu is wider than its trigger. Constant-white switch thumbs retain the existing white primitive in either palette. A later dice review corrected shared tooltip text to the source `var(--text)` role and refreshed the earlier dark examples.

[Dice panels](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=20-36510) have eleven states at two widths: waiting, draft, normal, external, natural minimum/maximum, recharge success/failure, kept dice, expressions and long breakdowns. External results leave Roll disabled when the manual field is empty while keeping Graph available. Seven quick-dice actions, a 140px clipped history viewport and optional full-formula/range hints reuse shared controls. The floating toggle has closed/open and hover presentations; [inline roll links](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=20-36383) support formulas or custom labels.

[Probability content](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=20-39344) includes wide/narrow charts and unavailable-formula messages, with four footer-free dialog examples. Totals, kept/dropped values, expression breakdowns, summary averages, percentages and peak-normalized bars were generated through the project's dice functions. Light/dark examples and all 47 new native variants passed text-sizing and Ukrainian-character checks; 177 additional spacing/radius values were bound to existing tokens.

The [dice motion review](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=20-40963) combines the source's 0.2-second entrance, 0.42-second roll and 0.22-second dismissal on a native timeline, exported and visually checked across twelve frames. Principal transforms, ring/flash opacity and display-color pulse are represented. CSS brightness, the one-pixel closing blur and pseudo-element gradient/spread details are omitted. Dice execution, contextual auto-close, event handling and scrolling remain application behavior.

[Editor inputs](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=20-42471) contain 24 text/number/password/textarea variants, including focus with an empty value. Textarea height follows its content. Separate examples retain raw bracket mentions, optional title hints and the read-only result surface. Disabled opacity uses the source's `0.72` value rather than the shared TextInput policy.

[Mention selection](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=24-42579) preserves characters, NPCs and locations/factions as three persistent groups. Browse, single-group match and no-match presentations have six wide/full-screen mobile dialogs. Empty groups retain their headings and source message. The body owns cancellation, and the modal footer stays hidden. Copy wrappers support text or replaceable child content, optional hints, and successful-write notifications with default or custom messages; entity-link atoms support names or custom labels. Scoped entity-modal compositions use the families described below.

[Rich-content tables](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=24-43343) have optional captions/headers, equal or weighted columns, left/center cells and recursive content swaps including inline dice. The 332px layouts keep all three columns visible and wrap cell text. Named/plain lists, optional section headings and nested-entry examples reuse native text and components. The writer rejects negative paragraph indentation, so hanging-list examples use unbulleted paragraphs without the source's negative first-line offset. Display-string edits do not run the parser; inline-helper examples are documented below.

The editing phase checked 59 new native variants and six mention dialogs in light/dark contexts, with no collapsed text or replacement characters. Sixty more spacing/radius values were bound to existing tokens. The full-library scalar-binding audit remains pending.

Entity dialogs reuse the existing modal and card families: [characters](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=24-43939), [NPCs](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=24-43940) and [locations](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=24-43941). Ten wide/narrow templates preserve campaign cards with hidden headers and session cards with their header/delete action. All dialog footers stay hidden. Titles and content swaps remain editable; an empty resolver body is represented without an error message. Not-found and same-entity requests remain source runtime no-ops.

The entity-dialog phase verified eleven new native definitions, paired dark examples and a static mobile body-scroll position. It corrected four existing modal-header identity spacers that retained 100px while empty; desktop headers now respect the source's 60px minimum and mobile headers fit their 44px actions. NPC fixtures use an empty-field placeholder for an absent last name. Another 108 matching scalar values were bound to tokens. Resolver selection, rename confirmation, deletion, mention updates and persistence remain code behavior.

[Reference links](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=24-48461) cover all eight source types, default/hover states and independent loading/resolved preview content. [Preview examples](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=24-49954) use records from the bundled 1,038 spells and 4,683 monsters plus conditions, statuses, diseases, rules, skills and senses. The project's own preview and tooltip-text functions produced the displayed metadata, inline formulas and recharge context. Creature examples use the actual Goblin token and preserve optional image/metadata/AC/HP fields, including visible zero-valued stats.

The [shared Tooltip set](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=24-49280) now supports text and wide/narrow arbitrary content. Existing instance values survived the property migration; helper calls resolve current property IDs by name. Invisible one-pixel guides give content swaps intrinsic widths without forcing minimum widths. Rich arrays have consistent paragraph spacing. Lists, named/unnamed sections, optional table headers, omitted tooltip captions, entry precedence and JSON fallback have native examples. Numeric zero remains empty in the existing tooltip-text formatter; that behavior differs from the creature-stat guard and is preserved.

The reference-link phase checked 35 new native design definitions and the updated text tooltip, with no collapsed text or encoding candidates. It added 33 matching scalar bindings, reviewed light/dark examples and exported the source's 0.2-second hover color/radius transition across fifteen frames. Hover delay, pointer placement, async cancellation, navigation and error reporting remain code. Reference-modal views and embedded browsers remain unfinished.

[Reference browser controls](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=26-53371) add search/navigation, seven tabs, reference rows, headers and sidebar states. Ninety new native definitions cover seven source definitions. Conditions include statuses in the same tab. Search history availability, detailed search, active tabs and cross-tab matches remain independent. The source filters generated the name query `blind` and the metadata query `dex`, preserving the resulting Stealth/Acrobatics/Sleight of Hand ranking. Creature size, type, source and name support separate highlights; optional source and challenge-rating hints use the shared Tooltip. Numeric zero CR retains the source's `--` fallback.

Wide/narrow headers support optional metadata and insertion, including metadata highlights. The mobile list viewport follows 24dvh, and tab overflow uses static offsets. Loading and seven per-tab empty messages preserve the source translations and English fallbacks. Paired light/dark review boards passed text-sizing and Ukrainian-character checks across 516 text nodes. Another 124 matching scalar values were bound to existing tokens. Shared Button labels are now optional in all 90 variants, and 53 existing icon-only instances were corrected, including 27 square bounds.

Source coverage is now **134/291 visual definitions**, **31/91 visible compositions**, **54/54 icons**, and **2/2 inline render helpers**. Full reference details, composed reference dialogs, embedded browsers and other pending domain families remain unfinished. Virtualization, scrolling, focus, history, filtering and insertion are application behavior.

[Inline text helpers](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=26-54970) have fourteen native source cases with paired dark examples. The actual SearchHighlight and renderMentionText functions generated the fixture output; EntityLink was replaced only as an inert child while inspecting element props. All fourteen Figma instance outputs match the source after normalizing nonbreaking edge spaces used to retain inline spacing. Search preserves numeric zero and stringifies false; mention text maps falsy zero to empty. Trimmed names, repeated links, blank names, unclosed/nested brackets, literal search punctuation and Ukrainian case matching remain distinct. Unique per-case text properties avoid shared defaults overwriting unrelated fixtures after variant combination. Editing a Figma label does not run a parser or resolve an entity.

[Spell browser controls](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=27-58147) add wide, medium and narrow filter layouts, three sort orders, optional source/search controls, detailed-search states and complete menus from the bundled 1,038-spell data. Eleven level options, seventeen class options, nine school options and nineteen source choices plus the all-source filter remain editable. Checkbox selection and the active source filter are independent. Model-generated eight-spell samples preserve the none → descending → ascending → none cycle and alphabetical ties.

[Spell rows](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=27-59369) retain 81px height while moving the source beside the name and placing level/school and classes on separate lines. The class value stays complete in the editable property and truncates to one displayed line. Optional fields, missing source data, title/source matches, source opacity and full-name hints have native examples. Source badges use the library's 12px small-text scale; sort labels use its 13px label scale with extra-bold weight. Reverse paint order keeps hints above later text and rows.

[Filter menus](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=29-61493) use the source's 300px Select and 340px MultiSelect limits. The 450px source popup clamps to 374px in the 390px viewport example. A static scroll offset reveals XPHB at the bottom of the scoped menu; the full option-body components remain available. Shared Select/MultiSelect trigger text now uses single-line ellipsis, while option rows retain their wrapping treatment.

This phase adds 47 native Figma definitions covering three source definitions and two text-fragment compositions. The audit checked 787 text nodes with no collapsed text or replacement characters and added 759 scalar bindings. Twelve light/dark review frames and a sixteen-frame export verify the native layouts and the source's 0.2-second sort background/border transition. Runtime source persistence, sorting, selection, insertion, focus and scrolling remain application behavior. SpellCard, SpellProperties, the content view and full SpellsBrowser remain unfinished.

The source inventory was corrected to include JSX inside map callbacks and tagless fragments. That discovered ten omitted definitions and reclassified four compositions as native visuals. Verified gallery and tooltip mappings were retained; the remaining discoveries are explicitly queued. The revised totals preserve the full-project scope rather than treating the original inventory as exhaustive.

Image assets use a replaceable FIT image fill derived from the existing journey artwork, preserving image proportions. Mobile gallery examples show static full-content layouts and a clipped category strip. Interactive scrolling, focus handling, callbacks, persistence, and file operations remain application behavior; they are not wired Figma prototypes.

The full component-library goal remains in progress. These assets do not cover all domain components, overlays, templates, or rich content. Local Figwright snapshots record the campaign hero (`4:108`) and session editor (`5:201`) as design baselines; they are not a claim of pixel equality for every application screen.

## Validation

- 601 regression tests passed after the campaign/session changes.
- TypeScript and ESLint passed; the Ukrainian encoding check passed for 264 files.
- Browser checks passed for campaign tabs, keyboard selection, the mobile drawer, scene ID `0`, scene selection, and retained selection across session tabs.
- Campaign and session layouts were reviewed at desktop and 390px widths, with no horizontal overflow or runtime exceptions in the isolated fixture.
- Browser API requests were intercepted for the review; user-owned campaign data was not used as a test fixture.


The [spell browser redesign](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=30-68020) adds 33 new native definitions for spell properties, cards, browser content, responsive browsers and embedded references. Thirteen source-rendered fixtures cover paragraphs, lists, references, dice, search highlights, higher-level content, sparse records and tables at two widths. Properties align labels in a 112px column; body paragraphs use 12px spacing. Metadata uses the shared muted small style and inline references use native underlines for natural reflow.

Eight browser examples cover selected, unselected, updating, empty and retained-selection states. Mobile examples preserve the 56px scroll margin and separate Back/Insert actions. The embedded reference hides its duplicate search input. The Teleport table retains all 35 cells, weighted columns and a 560px minimum width, with static left/right mobile viewport examples. Runtime actions remain application code; editable text does not rerun parsing or reposition highlight rectangles.

The phase audit checked 33 definitions and 895 text nodes, with no collapsed visible text or replacement characters. All 53 inline text records match the source render plans. Desktop, mobile, long-content and dark-theme screenshots were reviewed and saved locally. This Figma/documentation batch did not change application code. Full-library coverage remains 134/291 native definitions and 31/91 visible compositions.


The [Bestiary header library](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=30-75151) adds 27 native monster-header definitions covering six source definitions and three optional-action compositions. Names support copy and callback modes with separate hints. Optional Favorite, AI, Edit, Delete and Add actions reuse shared round buttons; narrow layouts wrap them. Original names and source lines retain source visibility rules. Six ability columns show formatted checks and original scores at wide, 332px narrow and compact grid widths. Missing scores and empty action groups collapse.

Seven fixtures execute the project's model and presentation helpers: four bundled creatures, a synthetic Ukrainian creature, a legacy record and a sparse record. Fifteen layout examples have paired dark copies; all displayed names and 90 ability checks match their fixtures. The audit checked 116 text nodes, found no collapsed visible text or replacement characters, and confirmed bound solid paints. Twenty additional scalar bindings were applied. A native timeline and sixteen-frame GIF verify the 0.2-second hover fill/border transition and two-pixel lift.

The redesign uses the shared type scale, palette and subtle round-button borders. Generic changed abilities use the existing accentSoft role; AI before/after parent decorations remain with the pending AI family. In Figma, an all-hidden action configuration also disables Show actions; source layout derives this automatically. Dice, copying, favorite requests, callbacks and tooltip timing remain application behavior. Tokens and the stat-block composition were completed in the subsequent phases below.


The [monster token library](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=33-78300) adds 45 native token definitions for four source owners. Image, upload and fallback branches cover the source's 280px, 160px and 140px contexts. Bundled Goblin, Lich and Adult Red Dragon artwork uses replaceable FIT fills. Upload controls reuse the compact ImageDropzone and grow vertically to avoid overflowing a fixed token wrapper. The dice-only fallback is centered. The compact uploader retains the existing 24px image icon and shared small typography.

Source policy fixtures execute all 128 boolean combinations, eight named cases and four URL-precedence cases. Thirty state examples have paired dark copies. Replacement availability, cancellation and branch selection match the source presentation in every example; twelve image geometries match desktop zoom or mobile no-zoom rules. The audit checked 93 text nodes, found no collapsed visible text or replacement characters, confirmed bound solid paints and added 108 scalar bindings. Dark reviews have no light semantic-color bindings. Three token-action roles bring both themes to 70 colors.

A native timeline, MP4 and nineteen-frame GIF verify the 0.2-second image translation/scale and 0.15-second replacement-control fade, movement and background transition. A shared focus-ring bug was also corrected: all eighteen Button focus variants now stretch their ring when resized, and eighteen icon-only role/size examples retain a three-pixel outside ring.

Token-state examples use bundled artwork independently of synthetic fixture URLs. Uploading, persistence, image-error events, source fallback, dragging, cancellation and hover triggers remain application behavior. The stat-block composition and rich content were completed in the subsequent phase below. Current full-library coverage is 134/291 native source definitions and 31/91 visible compositions.


The [complete monster stat-block family](https://www.figma.com/design/7sh6Lf9cuSxgbso7xyaorb/Untitled?node-id=40-81564) adds 63 native stat-block definitions for nine source owners and three spell-link/line compositions. Single, grid and mobile layouts reuse the verified name/action, metadata, token and ability families. Stats expose editable primary/property data, optional fields and lore. Rendered/loading/missing spell groups, standalone/embedded spellcasting, every spell-use bucket, legacy attack/damage controls, lair/regional content and empty guards are represented. Twenty compatible instance-swap menus help authors choose the right data or layout family.

Thirty-nine source-executed fixtures produce 78 measured plans. Thirty-five fixture boards compare wide and narrow layouts; ten complete cards cover bundled creatures, sparse data, uploads, callbacks and combined sections. Two clipped Lich viewports show top/bottom scroll positions. Every example has a paired dark copy. All 442 measured paragraph geometries match, and all 215 rich-text definitions retain their source text. Eight complete Goblin/Lich/Dragon snapshots match the actual component output after whitespace/list-marker normalization.

The audit checked 63 definitions and 633 text nodes, with no collapsed visible text, replacement characters or unbound solid paints. Five missing/empty masters contain no children, fills or strokes. Eight matching radius bindings were added. All 1,054 dark rich-text instances retain the expected semantic colors, with no light-theme leaks. A timed-out conversion was resumed from its existing copy; the helper now skips correct ranges and uses smaller batches.

The redesign uses shared body/section typography, natural value casing and muted small lore. Narrow headers stack portrait and details; grid abilities stay outside header details. Properties-panel measurements include the one-pixel border, leaving 534/306px text widths inside 560/332px panels. Source content and conditions are preserved, while rolling, copying, loading, callbacks, uploads, tooltips and scrolling remain application behavior. Editing text does not rerun parsing or reposition search highlights. AI parent decorations, the Bestiary browser, composed reference views and other domain families remain pending.
