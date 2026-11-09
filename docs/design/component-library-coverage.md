# PRM library coverage

Full-library goal is active. Figwright MCP access works. Domain families, remaining shared controls, dark foundations, documentation, and exhaustive visual coverage remain unfinished.

## Verified assets

- All 54 source icons, editable and theme bound.
- Six button families; 90 size/state variants; editable labels, icon visibility and swaps.
- TextInput: 12 type/state variants with separate numeric and masked values.
- Checkbox: 8 checked/state variants.
- Switch: 6 checked/state variants.

## Current source baseline

- 216 TSX/JSX files.
- 291 native visual definitions.
- 129 compositions: 38 runtime adapters, 91 visible compositions; inline, external and injected renderers remain explicit owner checks.
- Composition source classification does not imply Figma coverage.

## Source coverage

| Component | Source | Status | Figma nodes |
| --- | --- | --- | --- |
| App | src/App.tsx:76 | pending-figma |  |
| EmptyState | src/app/routing/MainContent.tsx:45 | pending-figma |  |
| MainContentLayout | src/app/routing/MainContent.tsx:57 | pending-figma |  |
| ProjectGuide | src/app/routing/ProjectGuide.tsx:14 | pending-figma |  |
| WorkspaceHeader | src/app/ui/WorkspaceHeader.tsx:4 | pending-figma |  |
| MonsterAiActionModal | src/features/ai-edit-monster/ui/MonsterAiActionModal.tsx:20 | pending-figma |  |
| AiApiKeyPanel | src/features/ai/ui/AiApiKeyPanel.tsx:18 | verified-figma | 48:102211 |
| AiAssistantShell | src/features/ai/ui/AiAssistantShell.tsx:22 | verified-figma | 53:120266 |
| AiAssistantToolbar | src/features/ai/ui/AiAssistantToolbar.tsx:47 | verified-figma | 48:103928 |
| AiAttachmentActions | src/features/ai/ui/AiAttachmentControls.tsx:46 | verified-figma | 48:104057 |
| AttachedImageList | src/features/ai/ui/AiAttachmentControls.tsx:91 | verified-figma | 48:104512 |
| AttachedFileList | src/features/ai/ui/AiAttachmentControls.tsx:127 | verified-figma | 48:104512 |
| AiAttachmentControls | src/features/ai/ui/AiAttachmentControls.tsx:168 | verified-figma | 48:105118 |
| CampaignEntityContext | src/features/ai/ui/AiContextSettingsModal.tsx:72 | verified-figma | 53:111705 |
| AiContextSettingsModal | src/features/ai/ui/AiContextSettingsModal.tsx:171 | verified-figma | 53:113317 |
| AiPromptComposer | src/features/ai/ui/AiPromptComposer.tsx:13 | verified-figma | 48:107029 |
| AiResponseHistoryRow | src/features/ai/ui/AiResponseHistory.tsx:42 | verified-figma | 48:105301 |
| AiResponseHistory | src/features/ai/ui/AiResponseHistory.tsx:101 | verified-figma | 48:106352 |
| AiModelPicker | src/features/ai/ui/AiToolbarControls.tsx:66 | verified-figma | 48:102259 |
| AiContextActions | src/features/ai/ui/AiToolbarControls.tsx:96 | verified-figma | 48:102350 |
| CreateCampaignModalContent | src/features/campaign-create/ui/CreateCampaignModalContent.tsx:12 | pending-figma |  |
| ClickToCopy | src/features/clipboard/ui/ClickToCopy.tsx:17 | verified-figma | 24:43048, 24:43065 |
| DiceCalculator | src/features/dice/ui/DiceCalculator.tsx:52 | verified-figma | 20:41216, 20:36510, 20:38308, 20:40922 |
| DiceProbabilityModalContent | src/features/dice/ui/DiceProbabilityModalContent.tsx:15 | verified-figma | 20:39344, 20:41217 |
| RollDice | src/features/dice/ui/RollDice.tsx:14 | verified-figma | 20:36383 |
| MonsterActionSections | src/features/edit-monster/ui/MonsterActionSections.tsx:39 | verified-figma | 69:181613 |
| MonsterExactDataSection | src/features/edit-monster/ui/MonsterExactDataSection.tsx:99 | verified-figma | 69:182508, 69:179596 |
| MonsterFieldEditModal | src/features/edit-monster/ui/MonsterFieldEditModal.tsx:119 | pending-figma |  |
| MonsterFieldSections | src/features/edit-monster/ui/MonsterFieldSections.tsx:19 | pending-figma |  |
| MonsterJsonValueInput | src/features/edit-monster/ui/MonsterJsonValueInput.tsx:20 | verified-figma | 69:179596, 69:179359 |
| MonsterLegendaryGroupEditor | src/features/edit-monster/ui/MonsterLegendaryGroupEditor.tsx:14 | verified-figma | 69:180234 |
| MonsterModifierSections | src/features/edit-monster/ui/MonsterModifierSections.tsx:52 | verified-figma | 69:180071 |
| ParserActionField | src/features/edit-monster/ui/MonsterParserActionDialog.tsx:66 | pending-figma |  |
| ParserActionHeading | src/features/edit-monster/ui/MonsterParserActionDialog.tsx:130 | pending-figma |  |
| ActionForm | src/features/edit-monster/ui/MonsterParserActionDialog.tsx:155 | pending-figma |  |
| ReferenceAction | src/features/edit-monster/ui/MonsterParserActionDialog.tsx:219 | pending-figma |  |
| ActionCatalog | src/features/edit-monster/ui/MonsterParserActionDialog.tsx:266 | pending-figma |  |
| MonsterParserActionDialog | src/features/edit-monster/ui/MonsterParserActionDialog.tsx:333 | pending-figma |  |
| SpellItemList | src/features/edit-monster/ui/MonsterSpellcastingSections.tsx:177 | verified-figma | 76:198509, 74:183483, 69:179596 |
| SpellcastingBucketEditor | src/features/edit-monster/ui/MonsterSpellcastingSections.tsx:419 | verified-figma | 76:198510, 76:198509, 12:1465 |
| LeveledSpellsEditor | src/features/edit-monster/ui/MonsterSpellcastingSections.tsx:507 | verified-figma | 76:198511, 76:198509, 12:1465 |
| HiddenFieldsEditor | src/features/edit-monster/ui/MonsterSpellcastingSections.tsx:641 | verified-figma | 76:198512, 12:1497 |
| SpellcastingBlockEditor | src/features/edit-monster/ui/MonsterSpellcastingSections.tsx:686 | verified-figma | 76:198513, 76:198515, 12:1689 |
| MonsterSpellcastingSections | src/features/edit-monster/ui/MonsterSpellcastingSections.tsx:891 | verified-figma | 76:198514, 76:198513 |
| SyntaxList | src/features/edit-monster/ui/MonsterTextParsingHelp.tsx:300 | pending-figma |  |
| SyntaxRows | src/features/edit-monster/ui/MonsterTextParsingHelp.tsx:310 | pending-figma |  |
| HelpSection | src/features/edit-monster/ui/MonsterTextParsingHelp.tsx:332 | pending-figma |  |
| CodeBlock | src/features/edit-monster/ui/MonsterTextParsingHelp.tsx:347 | pending-figma |  |
| MonsterTextParsingHelp | src/features/edit-monster/ui/MonsterTextParsingHelp.tsx:355 | pending-figma |  |
| EditablePlaceholder | src/features/editor/ui/EditableField.tsx:510 | verified-nested | 12:2631 |
| EditableFieldView | src/features/editor/ui/EditableField.tsx:1092 | verified-figma | 12:2631 |
| InputView | src/features/editor/ui/InputView.tsx:83 | verified-figma | 20:42471, 24:43729 |
| MentionPickerModalContent | src/features/editor/ui/MentionPickerModalContent.tsx:19 | verified-figma | 24:42579, 24:42734 |
| AddMonsterToEncounterModalContent | src/features/encounter-editor/ui/AddMonsterToEncounterModalContent.tsx:45 | pending-figma |  |
| EntityLink | src/features/entity-link/ui/EntityLink.tsx:27 | verified-figma | 24:43037, 24:43939, 24:43940, 24:43941 |
| ImageAssetValidContent | src/features/images/ui/ImageAssetFieldView.tsx:21 | verified-figma | 14:3812 |
| ImageAssetMissingContent | src/features/images/ui/ImageAssetFieldView.tsx:56 | verified-figma | 14:3812 |
| ImageAssetPreview | src/features/images/ui/ImageAssetFieldView.tsx:138 | verified-figma | 15:3866, 20:10464 |
| ImageAssetFieldView | src/features/images/ui/ImageAssetFieldView.tsx:199 | verified-figma | 14:3812 |
| ImageDropzone | src/features/images/ui/ImageDropzone.tsx:41 | verified-figma | 14:3716, 14:3717, 20:6502, 20:6613, 20:7059, 20:7170, 20:10433 |
| ImageGalleryFolderItem | src/features/images/ui/ImageGalleryItem.tsx:61 | verified-figma | 20:7303 |
| ImageGalleryFolderVisual | src/features/images/ui/ImageGalleryItem.tsx:166 | verified-nested | 20:7303 |
| ImageGalleryFolderName | src/features/images/ui/ImageGalleryItem.tsx:195 | verified-nested | 20:7303 |
| ImageGalleryImageItem | src/features/images/ui/ImageGalleryItem.tsx:233 | verified-figma | 20:7304 |
| ImageGalleryImageLocation | src/features/images/ui/ImageGalleryItem.tsx:344 | verified-nested | 20:7304 |
| ImageGalleryNavigation | src/features/images/ui/ImageGallerySections.tsx:59 | verified-nested | 20:8543, 20:8544 |
| ImageGallerySearchInput | src/features/images/ui/ImageGallerySections.tsx:223 | verified-figma | 20:8166 |
| ImageGallerySearch | src/features/images/ui/ImageGallerySections.tsx:273 | verified-figma | 20:8166 |
| ImageGalleryStorageStats | src/features/images/ui/ImageGallerySections.tsx:311 | verified-nested | 20:8543, 20:8544 |
| ImageGalleryUploadControl | src/features/images/ui/ImageGallerySections.tsx:360 | verified-nested | 20:8543, 20:8544 |
| ImageGalleryStatsAndActions | src/features/images/ui/ImageGallerySections.tsx:385 | verified-nested | 20:8543, 20:8544 |
| ImageGalleryGrid | src/features/images/ui/ImageGallerySections.tsx:426 | verified-figma | 20:9033, 20:9034 |
| ImageGalleryDialogs | src/features/images/ui/ImageGallerySections.tsx:496 | verified-figma | 20:10227, 20:10330, 15:3866, 20:10464 |
| ImageGallerySidebar | src/features/images/ui/ImageGalleryView.tsx:44 | verified-figma | 20:8057, 20:7739 |
| ImageGalleryTabs | src/features/images/ui/ImageGalleryView.tsx:137 | verified-figma | 20:7740, 20:9344 |
| ImageGalleryToolbar | src/features/images/ui/ImageGalleryView.tsx:187 | verified-figma | 20:8543, 20:8544 |
| ImageGalleryItems | src/features/images/ui/ImageGalleryView.tsx:214 | verified-nested | 20:9033, 20:9034 |
| ImageGalleryLayout | src/features/images/ui/ImageGalleryView.tsx:297 | verified-figma | 20:9344, 20:9783, 20:10026 |
| ImageTargetSourceOptions | src/features/images/ui/ImageTargetSettings.tsx:52 | verified-figma | 16:3938 |
| ImageTargetCategoryOptions | src/features/images/ui/ImageTargetSettings.tsx:86 | verified-figma | 16:3967 |
| ImageTargetPathBar | src/features/images/ui/ImageTargetSettings.tsx:134 | verified-figma | 19:4136 |
| ImageTargetSubfolderTabs | src/features/images/ui/ImageTargetSettings.tsx:221 | verified-figma | 19:4255 |
| ImageTargetSettings | src/features/images/ui/ImageTargetSettings.tsx:277 | verified-figma | 19:4392, 19:4393 |
| NoteCard | src/features/notes/ui/NoteCard.tsx:23 | verified-figma | 12:2818, 12:2819, 12:3174 |
| NoteCardHeader | src/features/notes/ui/NoteCardParts.tsx:27 | verified-nested | 12:2818, 12:2819 |
| NoteCardSimplified | src/features/notes/ui/NoteCardParts.tsx:96 | verified-nested | 12:2818, 12:2819 |
| NoteCardBody | src/features/notes/ui/NoteCardParts.tsx:155 | verified-nested | 12:2818, 12:2819 |
| PlayerQuestionsModalContent | src/features/player-questions/ui/PlayerQuestionsModalContent.tsx:63 | verified-figma | 20:33922, 20:33923, 20:33655, 20:34755 |
| RichContentList | src/features/rich-content/ui/RichContentRenderer.tsx:111 | verified-figma | 24:43095, 24:43257, 24:43516 |
| RichContentSection | src/features/rich-content/ui/RichContentRenderer.tsx:139 | verified-figma | 24:43158, 24:43516 |
| RichContentTable | src/features/rich-content/ui/RichContentRenderer.tsx:157 | verified-figma | 24:43343, 24:43324, 24:43742 |
| TooltipTextContent | src/features/rules-reference/ui/RulesLink.tsx:88 | verified-nested | 24:49325, 24:49954, 24:50510, 24:50517, 26:50525 |
| TooltipList | src/features/rules-reference/ui/RulesLink.tsx:107 | verified-figma | 24:49320, 24:50226 |
| TooltipSection | src/features/rules-reference/ui/RulesLink.tsx:122 | verified-nested | 24:49308, 24:49320 |
| TooltipTable | src/features/rules-reference/ui/RulesLink.tsx:134 | verified-figma | 24:49322, 24:50226 |
| TooltipEntries | src/features/rules-reference/ui/RulesLink.tsx:194 | verified-nested | 24:49325, 24:49954, 24:50226 |
| CreaturePreview | src/features/rules-reference/ui/RulesLink.tsx:215 | verified-figma | 24:48908, 24:50116 |
| RulesLinkPreview | src/features/rules-reference/ui/RulesLink.tsx:248 | verified-figma | 24:49906, 24:49954, 24:49280 |
| RulesLink | src/features/rules-reference/ui/RulesLink.tsx:272 | verified-figma | 24:48461, 24:50176 |
| ColorThemeSwitcher | src/features/settings/ui/ColorThemeSwitcher.tsx:16 | verified-figma | 20:27543, 20:34863, 20:34869 |
| SettingsGeneralGroup | src/features/settings/ui/SettingsModalView.tsx:77 | verified-figma | 20:27923, 20:27924 |
| SettingsSourcesGroup | src/features/settings/ui/SettingsModalView.tsx:143 | verified-figma | 20:28449, 20:28450, 20:27624, 20:27625 |
| SettingsAiGroup | src/features/settings/ui/SettingsModalView.tsx:210 | verified-figma | 20:29751, 20:29752 |
| SettingsScopedGroup | src/features/settings/ui/SettingsModalView.tsx:286 | verified-figma | 20:31073, 20:31074 |
| SettingsModalView | src/features/settings/ui/SettingsModalView.tsx:343 | verified-figma | 20:31691, 20:31692, 20:33360, 20:33504, 20:33246 |
| StatusBadge | src/features/status-badge/ui/StatusBadge.tsx:12 | verified-figma | 20:23237, 20:23238 |
| CampaignView | src/pages/campaign/ui/CampaignPage.tsx:58 | pending-figma |  |
| CampaignDescriptionSection | src/pages/campaign/ui/components/CampaignDescriptionSection.tsx:14 | pending-figma |  |
| CampaignEntitySection | src/pages/campaign/ui/components/CampaignEntitySection.tsx:34 | pending-figma |  |
| CampaignGraphMiniMap | src/pages/campaign/ui/components/CampaignGraphCanvas.tsx:54 | pending-figma |  |
| CampaignGraphCanvas | src/pages/campaign/ui/components/CampaignGraphCanvas.tsx:147 | pending-figma |  |
| CampaignGraphErrorMessage | src/pages/campaign/ui/components/CampaignGraphCanvas.tsx:235 | pending-figma |  |
| CampaignGraphLoadingMessage | src/pages/campaign/ui/components/CampaignGraphCanvas.tsx:240 | pending-figma |  |
| CampaignGraphEmptyMessage | src/pages/campaign/ui/components/CampaignGraphCanvas.tsx:245 | pending-figma |  |
| CampaignGraphConnection | src/pages/campaign/ui/components/CampaignGraphConnection.tsx:12 | pending-figma |  |
| ParsedGraphText | src/pages/campaign/ui/components/CampaignGraphDetails.tsx:77 | pending-figma |  |
| CampaignGraphSelectedHeader | src/pages/campaign/ui/components/CampaignGraphDetails.tsx:154 | pending-figma |  |
| CampaignGraphSelectedStats | src/pages/campaign/ui/components/CampaignGraphDetails.tsx:180 | pending-figma |  |
| CampaignGraphSelectedConnections | src/pages/campaign/ui/components/CampaignGraphDetails.tsx:191 | pending-figma |  |
| CampaignGraphOverview | src/pages/campaign/ui/components/CampaignGraphDetails.tsx:207 | pending-figma |  |
| CampaignGraphDetails | src/pages/campaign/ui/components/CampaignGraphDetails.tsx:266 | pending-figma |  |
| CampaignGraphNodeCard | src/pages/campaign/ui/components/CampaignGraphNodeCard.tsx:48 | pending-figma |  |
| CampaignGraphNoteModal | src/pages/campaign/ui/components/CampaignGraphNoteModal.tsx:28 | pending-figma |  |
| CampaignGraphToolbar | src/pages/campaign/ui/components/CampaignGraphToolbar.tsx:28 | pending-figma |  |
| CampaignHeader | src/pages/campaign/ui/components/CampaignHeader.tsx:29 | pending-figma |  |
| CampaignHeaderActions | src/pages/campaign/ui/components/CampaignHeaderActions.tsx:25 | pending-figma |  |
| CampaignNotesGraph | src/pages/campaign/ui/components/CampaignNotesGraph.tsx:125 | pending-figma |  |
| CampaignNotesList | src/pages/campaign/ui/components/CampaignNotesSection.tsx:44 | pending-figma |  |
| CampaignNotesViewToggle | src/pages/campaign/ui/components/CampaignNotesSection.tsx:91 | pending-figma |  |
| CampaignNotesSection | src/pages/campaign/ui/components/CampaignNotesSection.tsx:187 | pending-figma |  |
| CampaignOverview | src/pages/campaign/ui/components/CampaignOverview.tsx:21 | pending-figma |  |
| CampaignSessionsSection | src/pages/campaign/ui/components/CampaignSessionsSection.tsx:20 | pending-figma |  |
| PartialArchiveModal | src/pages/campaign/ui/components/PartialArchiveModal.tsx:36 | pending-figma |  |
| EncounterLoading | src/pages/encounter/ui/EncounterPage.tsx:23 | pending-figma |  |
| EncounterCharacterPickerOverlay | src/pages/encounter/ui/components/EncounterCharacterOverlays.tsx:49 | pending-figma |  |
| EncounterCharacterCreateForm | src/pages/encounter/ui/components/EncounterCharacterOverlays.tsx:72 | pending-figma |  |
| EncounterCharacterList | src/pages/encounter/ui/components/EncounterCharacterOverlays.tsx:109 | pending-figma |  |
| EncounterCharacterEmptyState | src/pages/encounter/ui/components/EncounterCharacterOverlays.tsx:153 | pending-figma |  |
| EncounterGridDetail | src/pages/encounter/ui/components/EncounterDetail.tsx:43 | pending-figma |  |
| EncounterGridMonster | src/pages/encounter/ui/components/EncounterDetail.tsx:55 | pending-figma |  |
| EncounterSingleDetail | src/pages/encounter/ui/components/EncounterDetail.tsx:64 | pending-figma |  |
| EncounterDetailEmptyState | src/pages/encounter/ui/components/EncounterDetail.tsx:95 | pending-figma |  |
| EncounterHeader | src/pages/encounter/ui/components/EncounterHeader.tsx:48 | pending-figma |  |
| EncounterHeaderIdentity | src/pages/encounter/ui/components/EncounterHeader.tsx:136 | pending-figma |  |
| EncounterMetrics | src/pages/encounter/ui/components/EncounterHeader.tsx:153 | pending-figma |  |
| EncounterHeaderActions | src/pages/encounter/ui/components/EncounterHeaderActions.tsx:38 | pending-figma |  |
| EncounterViewModeControls | src/pages/encounter/ui/components/EncounterHeaderActions.tsx:122 | pending-figma |  |
| EncounterGridColumnControls | src/pages/encounter/ui/components/EncounterHeaderActions.tsx:154 | pending-figma |  |
| EncounterMonsterCombatStats | src/pages/encounter/ui/components/EncounterMonsterRow.tsx:45 | pending-figma |  |
| EncounterCurrentHpInput | src/pages/encounter/ui/components/EncounterMonsterRow.tsx:66 | pending-figma |  |
| EncounterMaxHpInput | src/pages/encounter/ui/components/EncounterMonsterRow.tsx:83 | pending-figma |  |
| EncounterMonsterRowActions | src/pages/encounter/ui/components/EncounterMonsterRow.tsx:99 | pending-figma |  |
| EncounterMonsterRow | src/pages/encounter/ui/components/EncounterMonsterRow.tsx:153 | pending-figma |  |
| EncounterPageContent | src/pages/encounter/ui/components/EncounterPageContent.tsx:42 | pending-figma |  |
| EncounterParticipantList | src/pages/encounter/ui/components/EncounterParticipantList.tsx:16 | pending-figma |  |
| MonsterAiEditModal | src/pages/encounter/ui/components/MonsterAiEditModal.tsx:35 | pending-figma |  |
| SessionView | src/pages/session/ui/SessionPage.tsx:173 | pending-figma |  |
| SceneCardFields | src/pages/session/ui/components/SceneCardFields.tsx:22 | pending-figma |  |
| SceneCardHeader | src/pages/session/ui/components/SceneCardHeader.tsx:20 | pending-figma |  |
| SceneCardMedia | src/pages/session/ui/components/SceneCardMedia.tsx:11 | pending-figma |  |
| SceneNotes | src/pages/session/ui/components/SceneNotes.tsx:30 | pending-figma |  |
| SessionChecklistOverlay | src/pages/session/ui/components/SessionChecklistOverlay.tsx:15 | pending-figma |  |
| SessionEntitySection | src/pages/session/ui/components/SessionEntitySection.tsx:29 | pending-figma |  |
| SessionFloatingActions | src/pages/session/ui/components/SessionFloatingActions.tsx:13 | pending-figma |  |
| SessionHeader | src/pages/session/ui/components/SessionHeader.tsx:34 | pending-figma |  |
| SessionHeaderActions | src/pages/session/ui/components/SessionHeaderActions.tsx:23 | pending-figma |  |
| SessionSceneCard | src/pages/session/ui/components/SessionSceneCard.tsx:36 | pending-figma |  |
| SessionSceneItem | src/pages/session/ui/components/SessionSceneItem.tsx:60 | pending-figma |  |
| SessionScenesSection | src/pages/session/ui/components/SessionScenesSection.tsx:20 | pending-figma |  |
| SessionScopeImportItem | src/pages/session/ui/components/SessionScopeImportOverlay.tsx:31 | pending-figma |  |
| SessionScopeImportList | src/pages/session/ui/components/SessionScopeImportOverlay.tsx:70 | pending-figma |  |
| SessionScopeImportOverlay | src/pages/session/ui/components/SessionScopeImportOverlay.tsx:88 | pending-figma |  |
| TodoItem | src/pages/session/ui/components/TodoItem.tsx:14 | pending-figma |  |
| TodoSection | src/pages/session/ui/components/TodoSection.tsx:15 | pending-figma |  |
| ButtonContent | src/shared/ui/Button.tsx:58 | verified-nested | 12:1147, 12:1148, 12:1149, 12:1150, 12:1151, 12:1152 |
| Button | src/shared/ui/Button.tsx:72 | verified-figma | 12:1147, 12:1148, 12:1149, 12:1150, 12:1151, 12:1152 |
| Checkbox | src/shared/ui/Checkbox.tsx:22 | verified-figma | 12:1497 |
| DraggableList | src/shared/ui/DraggableList.tsx:81 | verified-figma | 12:3273 |
| Icon | src/shared/ui/Icon.tsx:440 | verified-figma | 12:340, 12:341, 12:342, 12:343, 12:344, 12:345, 12:346, 12:347, 12:348, 12:349, 12:350, 12:351, 12:352, 12:353, 12:354, 12:355, 12:356, 12:357, 12:358, 12:359, 12:360, 12:361, 12:362, 12:363, 12:364, 12:365, 12:366, 12:367, 12:368, 12:369, 12:370, 12:371, 12:372, 12:373, 12:374, 12:375, 12:376, 12:377, 12:378, 12:379, 12:380, 12:381, 12:382, 12:383, 12:384, 12:385, 12:386, 12:387, 12:388, 12:389, 12:390, 12:391, 12:392, 12:393 |
| ListCardActions | src/shared/ui/ListCard.tsx:23 | verified-nested | 12:2748 |
| ListCard | src/shared/ui/ListCard.tsx:28 | verified-figma | 12:2748 |
| ModalHeader | src/shared/ui/ModalView.tsx:17 | verified-nested | 12:1833, 12:2176 |
| StandardModalBody | src/shared/ui/ModalView.tsx:43 | verified-nested | 12:1833, 12:2176 |
| ModalBody | src/shared/ui/ModalView.tsx:76 | verified-nested | 12:1833, 12:2176 |
| ModalFooter | src/shared/ui/ModalView.tsx:109 | verified-nested | 12:1833, 12:2176 |
| ModalView | src/shared/ui/ModalView.tsx:144 | verified-figma | 12:1833, 12:2176 |
| MultiSelect | src/shared/ui/MultiSelect.tsx:51 | verified-figma | 12:1690 |
| MultiSelectDropdown | src/shared/ui/MultiSelectDropdown.tsx:31 | verified-figma | 12:1664, 12:1640 |
| Notification | src/shared/ui/Notification.tsx:11 | verified-figma | 12:1599 |
| Panel | src/shared/ui/Panel.tsx:10 | verified-figma | 12:1597 |
| SectionTabs | src/shared/ui/SectionTabs.tsx:16 | verified-figma | 12:3585, 12:3558 |
| Select | src/shared/ui/Select.tsx:41 | verified-figma | 12:1689 |
| OptionalSwitchText | src/shared/ui/Switch.tsx:22 | verified-nested | 12:1536 |
| Switch | src/shared/ui/Switch.tsx:33 | verified-figma | 12:1536 |
| TextInput | src/shared/ui/TextInput.tsx:8 | verified-figma | 12:1465 |
| Tooltip | src/shared/ui/Tooltip.tsx:65 | verified-figma | 24:49280 |
| AiAssistantPanelView | src/widgets/ai-assistant/ui/AiAssistantPanelView.tsx:23 | pending-figma |  |
| SelectedImagePromptTarget | src/widgets/ai-assistant/ui/AiImagePromptDetails.tsx:35 | verified-figma | 53:113695 |
| AiImagePromptDetails | src/widgets/ai-assistant/ui/AiImagePromptDetails.tsx:57 | verified-figma | 53:116255 |
| ImagePromptContextChoice | src/widgets/ai-assistant/ui/AiImagePromptSelection.tsx:57 | verified-figma | 53:113945 |
| AiImagePromptSelection | src/widgets/ai-assistant/ui/AiImagePromptSelection.tsx:84 | verified-figma | 53:114992 |
| ImagePromptColumn | src/widgets/ai-assistant/ui/ImagePromptColumn.tsx:19 | verified-figma | 53:113600 |
| AiResponseSingleCardDiff | src/widgets/ai-response-modal/ui/AiResponseCardDiff.tsx:48 | verified-figma | 60:142415 |
| AiResponseChangedCardDiff | src/widgets/ai-response-modal/ui/AiResponseCardDiff.tsx:78 | verified-figma | 60:142415 |
| AiResponseEncounterMonsterChange | src/widgets/ai-response-modal/ui/AiResponseEncounterMonsterChange.tsx:14 | verified-figma | 60:144190 |
| AiResponseEncounterParticipantList | src/widgets/ai-response-modal/ui/AiResponseEncounterParticipantList.tsx:52 | verified-figma | 60:154678, 60:154249 |
| AiResponseSingleSnapshotFields | src/widgets/ai-response-modal/ui/AiResponseGenericDiff.tsx:23 | verified-figma | 60:152567, 60:151749 |
| AiResponseChangedField | src/widgets/ai-response-modal/ui/AiResponseGenericDiff.tsx:44 | verified-figma | 60:151982 |
| AiResponseGenericDiff | src/widgets/ai-response-modal/ui/AiResponseGenericDiff.tsx:70 | verified-figma | 60:153880 |
| AiResponseJsonDiffLine | src/widgets/ai-response-modal/ui/AiResponseJsonDiff.tsx:17 | verified-figma | 57:125712 |
| AiResponseJsonDiff | src/widgets/ai-response-modal/ui/AiResponseJsonDiff.tsx:43 | verified-figma | 57:126211, 57:127598 |
| AiResponseModal | src/widgets/ai-response-modal/ui/AiResponseModal.tsx:88 | pending-figma |  |
| ResponseDetails | src/widgets/ai-response-modal/ui/AiResponseModalView.tsx:72 | verified-figma | 53:125549 |
| DraftResourceEditor | src/widgets/ai-response-modal/ui/AiResponseModalView.tsx:97 | verified-figma | 66:156042, 66:155491 |
| DraftEditor | src/widgets/ai-response-modal/ui/AiResponseModalView.tsx:142 | verified-figma | 66:156349 |
| DiffViewSwitch | src/widgets/ai-response-modal/ui/AiResponseModalView.tsx:173 | verified-figma | 53:125496 |
| ResponseDiff | src/widgets/ai-response-modal/ui/AiResponseModalView.tsx:197 | verified-figma | 69:160474, 69:157573 |
| AiResponseModalView | src/widgets/ai-response-modal/ui/AiResponseModalView.tsx:244 | verified-figma | 69:174718, 69:165011, 69:174719, 69:165010 |
| AiResponseSingleNoteDiff | src/widgets/ai-response-modal/ui/AiResponseNoteDiff.tsx:54 | verified-figma | 59:131325 |
| AiResponseChangedNoteDiff | src/widgets/ai-response-modal/ui/AiResponseNoteDiff.tsx:81 | verified-figma | 59:131325 |
| AiResponseNoteDiff | src/widgets/ai-response-modal/ui/AiResponseNoteDiff.tsx:115 | verified-figma | 59:133002, 60:134079 |
| AiResponsePreviewResourceHeader | src/widgets/ai-response-modal/ui/AiResponsePreviewResourceHeader.tsx:9 | verified-figma | 57:125647 |
| AppliedState | src/widgets/ai-response-modal/ui/AiResponseResourceActions.tsx:16 | verified-figma | 53:125247 |
| UndoneState | src/widgets/ai-response-modal/ui/AiResponseResourceActions.tsx:24 | verified-figma | 53:125247 |
| BestiaryContent | src/widgets/bestiary-browser/ui/BestiaryContent.tsx:67 | pending-figma |  |
| BestiaryDetail | src/widgets/bestiary-browser/ui/BestiaryDetail.tsx:25 | verified-figma | 48:97924 |
| BestiaryHeaderActions | src/widgets/bestiary-browser/ui/BestiaryHeaderActions.tsx:23 | verified-figma | 44:91146 |
| MonsterListItemContent | src/widgets/bestiary-browser/ui/BestiaryMonsterListItem.tsx:148 | verified-figma | 46:91373 |
| BestiaryMonsterListItem | src/widgets/bestiary-browser/ui/BestiaryMonsterListItem.tsx:208 | verified-figma | 46:91422 |
| BestiaryToolbar | src/widgets/bestiary-browser/ui/BestiaryToolbar.tsx:29 | verified-figma | 48:96087 |
| BestiaryVirtualizedList | src/widgets/bestiary-browser/ui/BestiaryVirtualizedList.tsx:19 | verified-figma | 46:95078 |
| CampaignEntityCardNotes | src/widgets/campaign-entity-card/ui/CampaignEntityCardNotes.tsx:46 | verified-figma | 20:10514, 20:10515 |
| CharacterIdentityFields | src/widgets/campaign-entity-card/ui/CharacterCard.tsx:54 | verified-figma | 20:11428, 20:11429, 20:11369 |
| CharacterDetails | src/widgets/campaign-entity-card/ui/CharacterCard.tsx:74 | verified-figma | 20:11430, 20:11431 |
| CharacterCardHeader | src/widgets/campaign-entity-card/ui/CharacterCard.tsx:87 | verified-figma | 20:11952, 20:11953 |
| CharacterCard | src/widgets/campaign-entity-card/ui/CharacterCard.tsx:102 | verified-figma | 20:12464, 20:12465 |
| CreateCharacterButton | src/widgets/campaign-entity-card/ui/CreateCharacterButton.tsx:28 | verified-figma | 20:19956, 20:17074, 20:17075, 20:19969, 20:19996 |
| CreateLocationButton | src/widgets/campaign-entity-card/ui/CreateLocationButton.tsx:27 | verified-figma | 20:19956, 20:17074, 20:17075, 20:19969, 20:19996 |
| LocationCardHeader | src/widgets/campaign-entity-card/ui/LocationCard.tsx:50 | verified-figma | 20:11954, 20:11955 |
| LocationHeaderIdentity | src/widgets/campaign-entity-card/ui/LocationCard.tsx:61 | verified-nested | 20:11954, 20:11955 |
| LocationHeaderActions | src/widgets/campaign-entity-card/ui/LocationCard.tsx:65 | verified-nested | 20:11954, 20:11955 |
| LocationCard | src/widgets/campaign-entity-card/ui/LocationCard.tsx:69 | verified-figma | 20:12466, 20:12467 |
| SearchResultRow | src/widgets/campaign-search/ui/CampaignSearchResults.tsx:73 | pending-figma |  |
| CampaignSearchResults | src/widgets/campaign-search/ui/CampaignSearchResults.tsx:93 | pending-figma |  |
| CampaignSearchContentState | src/widgets/campaign-search/ui/GlobalSearchModalView.tsx:48 | pending-figma |  |
| GlobalSearchModalView | src/widgets/campaign-search/ui/GlobalSearchModalView.tsx:57 | pending-figma |  |
| MonsterStatBlock | src/widgets/monster-stat-block/ui/MonsterStatBlock.tsx:95 | verified-figma | 40:81564 |
| MonsterTokenDropzone | src/widgets/monster-stat-block/ui/MonsterStatBlockSections.tsx:68 | verified-figma | 33:77875 |
| MonsterTokenImage | src/widgets/monster-stat-block/ui/MonsterStatBlockSections.tsx:99 | verified-figma | 33:78003, 33:77882 |
| MonsterTokenContent | src/widgets/monster-stat-block/ui/MonsterStatBlockSections.tsx:137 | verified-figma | 33:78170, 33:78049 |
| MonsterTokenSection | src/widgets/monster-stat-block/ui/MonsterStatBlockSections.tsx:154 | verified-figma | 33:78300 |
| MonsterAbilities | src/widgets/monster-stat-block/ui/MonsterStatBlockSections.tsx:209 | verified-figma | 30:74784, 30:74705 |
| MonsterHeaderDetails | src/widgets/monster-stat-block/ui/MonsterStatBlockSections.tsx:252 | verified-figma | 40:80627 |
| MonsterNameRow | src/widgets/monster-stat-block/ui/MonsterStatBlockSections.tsx:266 | verified-figma | 30:75150 |
| MonsterNameControl | src/widgets/monster-stat-block/ui/MonsterStatBlockSections.tsx:340 | verified-figma | 30:74860, 30:74833 |
| MonsterMetadata | src/widgets/monster-stat-block/ui/MonsterStatBlockSections.tsx:446 | verified-figma | 30:74932 |
| MonsterOriginalName | src/widgets/monster-stat-block/ui/MonsterStatBlockSections.tsx:461 | verified-figma | 30:74862, 30:74932 |
| MonsterSourceLine | src/widgets/monster-stat-block/ui/MonsterStatBlockSections.tsx:481 | verified-figma | 30:74886, 30:74932 |
| MonsterStats | src/widgets/monster-stat-block/ui/MonsterStatBlockSections.tsx:511 | verified-figma | 39:79798, 38:79583, 38:79591, 38:79601, 38:79609, 38:79627, 38:79646, 38:79654, 38:79668, 38:79676, 38:79684, 38:79692, 38:79713, 38:79721, 38:79733, 38:79741, 38:79749, 38:79757, 38:79780 |
| LegacySpellcastingSection | src/widgets/monster-stat-block/ui/MonsterStatBlockSections.tsx:542 | verified-figma | 39:80243 |
| StructuredSpellcastingSection | src/widgets/monster-stat-block/ui/MonsterStatBlockSections.tsx:552 | verified-figma | 39:80224 |
| StructuredSpellcastingEntry | src/widgets/monster-stat-block/ui/MonsterStatBlockSections.tsx:572 | verified-figma | 39:80178 |
| SpellContentLine | src/widgets/monster-stat-block/ui/MonsterStatBlockSections.tsx:647 | verified-figma | 39:80245 |
| MonsterActionList | src/widgets/monster-stat-block/ui/MonsterStatBlockSections.tsx:651 | verified-figma | 39:80260 |
| MonsterContentSection | src/widgets/monster-stat-block/ui/MonsterStatBlockSections.tsx:656 | verified-figma | 39:80278 |
| CreatureListContent | src/widgets/rules-reference-modal/ui/RulesReferenceListItem.tsx:46 | verified-figma | 26:50746, 26:54382 |
| GenericListContent | src/widgets/rules-reference-modal/ui/RulesReferenceListItem.tsx:70 | verified-figma | 26:50648 |
| RulesReferenceListItem | src/widgets/rules-reference-modal/ui/RulesReferenceListItem.tsx:79 | verified-figma | 26:50990, 26:51021 |
| ReferenceSearch | src/widgets/rules-reference-modal/ui/RulesReferenceModalView.tsx:54 | verified-figma | 26:51706 |
| ReferenceTabs | src/widgets/rules-reference-modal/ui/RulesReferenceModalView.tsx:67 | verified-figma | 26:51463, 26:51154 |
| ReferenceDetailsHeader | src/widgets/rules-reference-modal/ui/RulesReferenceModalView.tsx:79 | verified-figma | 26:52163 |
| ReferenceDetails | src/widgets/rules-reference-modal/ui/RulesReferenceModalView.tsx:105 | pending-figma |  |
| EmbeddedSpellReference | src/widgets/rules-reference-modal/ui/RulesReferenceModalView.tsx:118 | verified-figma | 30:71028 |
| EmbeddedBestiaryReference | src/widgets/rules-reference-modal/ui/RulesReferenceModalView.tsx:126 | pending-figma |  |
| ReferenceSidebar | src/widgets/rules-reference-modal/ui/RulesReferenceModalView.tsx:141 | verified-figma | 26:52797, 26:52510 |
| StandardReferenceLayout | src/widgets/rules-reference-modal/ui/RulesReferenceModalView.tsx:148 | pending-figma |  |
| RulesReferenceModalView | src/widgets/rules-reference-modal/ui/RulesReferenceModalView.tsx:161 | pending-figma |  |
| Sidebar | src/widgets/sidebar/ui/Sidebar.tsx:60 | verified-figma | 20:25173, 20:25174, 20:26917, 20:26229, 20:26230 |
| SidebarArchiveControls | src/widgets/sidebar/ui/SidebarArchiveControls.tsx:14 | verified-figma | 20:25129, 20:25123, 20:25152, 20:27525 |
| CompletedCampaignsHeader | src/widgets/sidebar/ui/SidebarCampaignSection.tsx:38 | verified-figma | 20:23582 |
| SidebarCampaignSection | src/widgets/sidebar/ui/SidebarCampaignSection.tsx:72 | verified-figma | 20:23693, 20:23486, 20:23532, 20:23780 |
| SidebarLink | src/widgets/sidebar/ui/SidebarLinks.tsx:6 | verified-figma | 20:22895, 20:22896 |
| SidebarLinks | src/widgets/sidebar/ui/SidebarLinks.tsx:36 | verified-figma | 20:24546 |
| SidebarResources | src/widgets/sidebar/ui/SidebarResources.tsx:43 | verified-figma | 20:24547 |
| SpellProperties | src/widgets/spells-browser/ui/SpellCard.tsx:25 | verified-figma | 30:63545 |
| SpellCard | src/widgets/spells-browser/ui/SpellCard.tsx:37 | verified-figma | 30:63955, 30:63880, 30:62099, 30:62130, 30:62155, 30:62180, 30:62206, 30:62231, 30:62280, 30:62307, 30:62402, 30:62427, 30:62477, 30:62894, 30:62919, 30:62946, 30:62971, 30:63518, 30:63520 |
| SpellsBrowser | src/widgets/spells-browser/ui/SpellsBrowser.tsx:52 | verified-figma | 30:68019 |
| SpellListItem | src/widgets/spells-browser/ui/SpellsBrowserContent.tsx:23 | verified-figma | 27:57328, 27:57327, 27:57390, 27:57600, 27:57810 |
| SpellSourceMeta | src/widgets/spells-browser/ui/SpellsBrowserContent.tsx:75 | verified-figma | 27:57105, 27:59369 |
| SpellsBrowserContent | src/widgets/spells-browser/ui/SpellsBrowserContent.tsx:110 | verified-figma | 30:67406 |
| SpellsBrowserControls | src/widgets/spells-browser/ui/SpellsBrowserControls.tsx:35 | verified-figma | 27:57026, 27:56768, 26:55416, 26:55923, 26:56070, 26:56184, 26:56293, 26:56440, 26:56554 |

## Inline render helpers

| Helper | Status | Figma nodes |
| --- | --- | --- |
| SearchHighlight | verified-figma | 26:50552, 26:54965 |
| MentionText | verified-figma | 24:43037, 26:54965 |

## Additional verified families

- Select and MultiSelect: seven trigger/menu states plus seven reusable option states.
- Modal: forty desktop/mobile variants; standard or custom body for each type/cancellation state.
- Image controls, destination settings, upload/preview/move dialogs, and gallery families cover 27 source definitions plus 10 compositions. Desktop/mobile layouts visually reviewed; scrolling remains application behavior.
- Character/NPC/location cards: 22 presentations, reusable headers/fields/notes, all 20 level options, and 18 wide/narrow creation dialogs. Eleven additional source definitions covered; 72 new native definitions checked for collapsed text and Ukrainian encoding.
- Sidebar navigation, status badges, campaign groups, history controls, resources, backup/import and mobile drawer cover eight more source definitions. Source spinner and drawer motion were exported and visually reviewed; scrolling remains application behavior.
- Settings and player questions cover seven more source definitions and three compositions. Light/dark reviews, global/campaign scope, independent saving, three error messages, and real 600-question policy fixtures are represented. Sixty-nine new Figma variants and fourteen dialogs passed text/layout checks.
- Editable fields: twelve variants; ListCard: three; NoteCard: twenty-four plus new-row examples.
- Draggable item: fourteen variants; collapse toggles: twelve; AI context and bulk collapse controls: two each.
- SectionTabs: reusable desktop strip and clipped mobile viewport; interactive prototype scrolling is not claimed.
- Theme collections: primitive palette plus paired light/dark semantic collections, verified using shared control specimens.
- Dice: three more source definitions, 47 native variants and four dialogs; exact source fixtures, probability bars, paired dark review and source-timed motion verified. Tooltip contrast follows the source text role.
- Editing and rich content: seven more source definitions, one composition, 59 native variants and six mention dialogs. Inputs, copy, entity-link atoms, named/plain lists, sections, cells and responsive tables have light/dark examples. Negative first-line hanging indent is unsupported by the writer; entity-modal compositions are tracked separately; inline-helper coverage is recorded below.
- Entity dialogs: four more source compositions, ten campaign/session templates and an empty resolver body. Four shared modal-header spacers were corrected; light/dark and static body-scroll views were checked.
- Rules links and tooltips: six more source definitions, three compositions, 35 new native design definitions and an updated shared Tooltip set. Eight type colors, real source preview records, recursive entries, optional creature fields, paired dark examples and 0.2-second hover motion were verified. At that phase, both semantic collections contained 61 colors.
- Reference browser controls: seven more source definitions, 90 new native definitions, name/metadata highlights, seven independent tab-match indicators, 16 search variants, 18 sidebar states, optional header actions and paired dark reviews. Three semantic color roles bring each theme to 64 colors. Shared Button labels are now optional in all 90 variants; 53 icon-only instances were corrected. Full reference details, composed modal and embedded browsers remain unfinished.
- Both inline render helpers are verified through fourteen source-executed native fixtures and paired light/dark reviews. All fourteen instance outputs match the source after normalizing Figma edge spaces. Source-function execution is not implemented inside Figma.
- Spell controls and rows: three more native source definitions and two text-fragment compositions; 47 new native Figma definitions. Wide/medium/narrow filters, all actual options, source-selection/filter separation, fixed-height rows, source/title match examples and paired dark reviews are verified. Menu viewports use the source limits; the 0.2-second sort color transition was exported across sixteen frames. Both themes contain 65 colors.
- Spell cards and browsers: five additional source definitions and 33 native definitions. Thirteen renderer fixtures, eight browser examples, mobile scroll views and paired dark reviews are verified. All 53 inline text records match source plans; 895 text nodes have no collapsed visible text or replacement characters. Both themes now contain 67 semantic colors.
- Monster headers: six additional source definitions, three optional-action compositions and 27 native Figma definitions. Seven model-executed fixtures produce fifteen wide/narrow/grid reviews with paired dark copies. All names and six ability values match their fixture; 116 text nodes have no collapsed visible text or replacement characters, and every solid paint is bound. Shared hints and the source 0.2-second hover color/border/two-pixel lift were reviewed; the full stat block remains pending.
- Monster tokens: four additional source definitions and 45 native Figma definitions. Three bundled artwork assets, 280/160/140px contexts, image/upload/fallback branches and thirty state examples have paired dark reviews. Source policy fixtures execute 128 combinations and four URL-precedence cases. Audit: 93 text nodes, no collapsed visible text or replacement characters, all solid paints bound, 108 scalar bindings added, and no light-color leaks in dark reviews. The 0.2s image zoom and 0.15s replacement control were verified across nineteen exported frames. All eighteen shared button focus rings now stretch correctly in icon-only sizes. Both themes contain 70 semantic colors; stats and rich stat-block content remain pending.
- Monster stat blocks: nine additional source definitions, three spell-line/link compositions and 63 native Figma definitions. Source execution produced 39 fixtures and 78 width-specific plans. Thirty-five fixture boards, ten assembled cards and two scroll views have paired dark copies. All 442 measured paragraphs and 215 rich-text definitions match their source plans; eight whole-creature text snapshots match after whitespace/list-marker normalization. The 633-text-node audit found no collapsed visible text, replacement characters or unbound solid paints. All 1,054 dark rich-text instances retain the expected semantic colors. Empty guards, special/legacy stats and all spell-use buckets are covered. Compatible data-swap menus are provided; runtime actions remain code.
- The source audit now includes JSX inside map callbacks and tagless fragments: ten previously omitted definitions were added and four compositions were reclassified as native visuals. Existing gallery and tooltip mappings were preserved. The revised baseline is 291 native visual definitions and 129 compositions, including 38 runtime adapters and 91 visible compositions.
- Bestiary browser parts: six additional source definitions, the row-actions composition and 94 native Figma definitions. Responsive toolbars, header menus, independent source filters, fixed-height rows, list states and detail callback modes reuse verified shared controls. Nine source-executed creature fixtures preserve numeric-zero/string-zero CR behavior. Compact rows explicitly hide portraits. Full browser compositions remain pending their AI and editor dependencies; runtime actions remain code.
- AI controls and history: eleven additional source definitions, eight compositions and 107 native Figma definitions. Setup, model selection, context, responsive toolbars, image/file attachments, prompt composition and response history preserve source guards and loading behavior. The 107-definition audit checked 915 text nodes with no collapsed visible text, replacement characters or unbound solid paints. Four dark reviews cover 471 text nodes with no light-color leaks. Source policy fixtures, conditional metadata/token branches, whitespace keys, full-disabled lists and editable cloned text bindings are verified. Assistant chrome and composed dialogs remain pending; runtime behavior remains code.
- AI dialogs and shell: eight additional source definitions, one composition and 114 native Figma definitions. Context inclusion/expansion, missing data, image selection/detail/context states, independent dialogs and notifications, responsive layout and loading locks preserve source contracts. The audit checked 1,814 text nodes with no collapsed visible text, replacement characters or unbound solid paints. Ten paired dark reviews cover 410 text nodes with no light-color leaks. Twenty-three snapshots and three source-timed animation exports were reviewed. Full assistant and response/diff compositions remain pending; runtime behavior remains code.
- AI response parts: seven more source definitions, four compositions and 69 native Figma definitions. Request metadata, toolbar, resource actions, preview/JSON switch, headers and structured JSON diffs preserve draft/applied/undone/restoring branches. Source fixtures cover nine resources, twelve action states and 156 rendered lines. Native audits cover 948 text nodes; five dark reviews cover 602 text nodes, with no collapsed text, replacement characters, unbound solid paints or light-theme leaks. Ten screenshots were saved. Both themes contain 72 semantic colors. Typed card/note/encounter previews and full response dialogs remain pending.
- AI note comparisons: three more source definitions and 64 native Figma definitions. Classic/simplified modes, new/deleted/invalid notes, responsive before/after comparisons, partial highlights, resolved resource actions and collapsed reviews reuse live NoteCard components. All 92 note instances match expected modes, content and highlight variants; 388 text nodes have no collapsed text, replacement characters or unbound solid paints. Six dark reviews cover 49 text nodes without light-color leaks. Twelve screenshots and sixteen executed source-policy cases are recorded. Shared instance-swap defaults were removed after variant merging; nested note instances remain editable and swappable. Both themes retain 72 semantic colors.
- AI card comparisons: three more source definitions, one composition and 40 native Figma definitions. Live character/location/monster slots cover new, deleted, changed, unchanged and invalid snapshots. Independent encounter labels and optional supplied cards preserve empty branches. Source execution covers sixteen fixtures, sixty-four policy cases and sixteen optional-slot cases. The native audit checked 48 embedded cards, 172 projected values, 110 highlight containers and 2,132 text nodes without contract, encoding or paint-binding errors. Eight dark reviews check 717 text nodes and all 16,373 characters in 357 rich-text instances without color leaks. Sixteen snapshots and geometry checks are recorded. Composite instances hug their contents, including empty comparisons. Runtime behavior remains code.
- Generic comparisons and encounter participant lists: four more source definitions and 98 native Figma definitions. Fifteen generic plans preserve primitive/object formatting, metadata exclusion, summary fallback, note-array delegation and 360px value viewports. Sixteen participant plans preserve duplicate identities, zero/string-zero metadata, serialized equality, missing/modified rows and source empty messages. Native checks cover 76 values, 48 participant instances and 468 text nodes; twelve dark reviews cover 132 text nodes without leaks or text errors. Twenty-four snapshots are saved. All 98 definitions were recovered and revalidated after a temporary connection loss. Source verifiers pass; runtime behavior remains code.
- AI draft editors: two more source definitions and 34 native Figma definitions. Responsive before/after code fields, new/deleted/invalid/empty/whitespace/long values and focused/restoring states reuse EditableField and shared resource actions. Source execution verifies seven resources, three ordered/empty draft lists, sixteen diff policies and thirty-two modal-view policies. Native checks cover 34 values, four capped fields, four locked action groups, 28 inherited headings and 228 text nodes without contract, encoding or paint errors. Seven dark reviews cover 75 text nodes without leaks; fourteen snapshots are saved. Separate New/After properties preserve labels inside nested instances. ResponseDiff and full response/history dialogs remain pending.
- Response comparisons and modal views: two more source definitions and 107 native Figma definitions. Twenty comparison states and thirty-two body/dialog pairs reuse live generic previews, structured JSON rows, draft editors, request details and shared modal controls. Seventeen viewports preserve desktop/mobile caps; creature dialogs demonstrate the source 2200px width. Source verification covers sixteen diff policies, thirty-two view policies and four empty-prompt/details cases. Native audits check 4,613 text nodes and eighteen JSON line instances without text, contract or paint errors. Eleven paired dark reviews preserve 9,793 characters, including eighty rich-text nodes, without light-color leaks or text changes. Twenty-two snapshots and two bottom-of-form views are saved. All assets fit section 26; the 26-section page remains compact and has no overlaps. Full response orchestration and injected editor compositions remain pending.
- Monster editing fields: five more source definitions, the ModifierKeyInput composition and 92 native Figma definitions. JSON scalar/structured values, parse errors/recovery, modifier filtering and zero values, legendary groups, all five action categories and advanced raw fields preserve source policies. Source execution covers eleven JSON cases, four modifier plans, five legendary-group plans, six action plans and eight exact-data plans, including guarded adds, removals and deferred key commits. Native audits check sixty textarea values, twenty-two modifier rows, twelve legendary fields, twenty-eight action rows, eighty-four exact-field summaries and 738 text nodes without contract, encoding or paint errors. Nine dark review pairs preserve 3,949 characters without leaks or text changes. Eighteen snapshots are saved. Disclosure arrows were corrected and verified; all assets fit section 27 without overlaps. Full editor dialogs, spellcasting and parser/help remain pending.
- Spellcasting editors: six more source definitions and the EditableMapKey composition. Source-executed fixtures preserve text versus structured entries, hidden flags, all six frequency buckets, zero slots/lower bounds, unknown select values, malformed rows and collapsed/advanced blocks. Shared controls, bound light/dark colors, complete source text and compact section placement are verified. Runtime callbacks and disclosure behavior remain code.

## Composition Figma coverage

| Composition | Status | Figma nodes |
| --- | --- | --- |
| CampaignRoute | runtime-adapter |  |
| SessionRoute | runtime-adapter |  |
| EncounterRoute | runtime-adapter |  |
| MainContent | runtime-adapter |  |
| AiAssistantRuntimeHost | runtime-adapter |  |
| BestiaryBrowserRuntimeHost | runtime-adapter |  |
| CampaignEntityCreationRuntimeHost | runtime-adapter |  |
| CampaignPageRuntimeHost | runtime-adapter |  |
| CampaignSearchRuntimeHost | runtime-adapter |  |
| DiceCalculatorHost | runtime-adapter |  |
| EncounterPageRuntimeHost | runtime-adapter |  |
| ImageGalleryRuntimeHost | runtime-adapter |  |
| MessageBoxHost | runtime-adapter |  |
| SessionPageRuntimeHost | runtime-adapter |  |
| SidebarRuntimeHost | runtime-adapter |  |
| AiAttachmentAlertRuntimeProvider | runtime-adapter |  |
| ConfiguredAiAttachmentControls | verified-composition | 48:105118, 20:9344, 20:9783, 20:10026 |
| AiHistoryResponseDialog | pending-figma-composition |  |
| ConfiguredAiPromptComposer | verified-composition | 48:107029, 12:2631 |
| AiGenerationToggleButton | verified-composition | 48:103928, 12:1148, 12:1150 |
| AiImagePromptAction | verified-composition | 48:103928, 12:1148, 12:1150 |
| AiEntityGenerationActions | verified-composition | 48:103928, 12:1148, 12:1150 |
| AiResponseParsingAction | verified-composition | 48:103928, 12:1148, 12:1150 |
| AiEncounterCreatureEditingAction | verified-composition | 48:103928, 12:1148, 12:1150 |
| AiEncounterGenerationActions | verified-composition | 48:103928, 12:1148, 12:1150 |
| DiceRequestRuntimeProvider | runtime-adapter |  |
| ModifierKeyInput | verified-composition | 69:180071, 12:1465 |
| EditableMapKey | verified-composition | 76:198510, 76:198511, 12:1465 |
| MarkdownChangePlugin | runtime-adapter |  |
| EditorContentPlugin | runtime-adapter |  |
| LexicalEditableFieldView | pending-figma-composition |  |
| LexicalEditableField | pending-figma-composition |  |
| EditableField | pending-figma-composition |  |
| EditableFieldEntityLinkProvider | runtime-adapter |  |
| EditorMentionPickerRuntimeProvider | runtime-adapter |  |
| Input | verified-composition | 20:42471 |
| EntityLinkScope | runtime-adapter |  |
| EntityModal | verified-composition | 24:43939, 24:43940, 24:43941, 24:47063 |
| ImageGalleryRuntimeProvider | runtime-adapter |  |
| ImageAssetField | verified-composition | 14:3812 |
| ImageAssetEmptyContent | verified-composition | 14:3717 |
| ImageAssetFieldContent | verified-composition | 14:3812 |
| ImageAssetGalleryDialog | verified-composition | 20:9783, 20:10026 |
| ImageGallery | verified-composition | 20:9783, 20:10026 |
| ImageGalleryItem | verified-composition | 20:7303, 20:7304 |
| ImageGalleryScopeButton | verified-composition | 20:8166 |
| ImageGallerySelectionActions | verified-composition | 20:8543, 20:8544 |
| ImageGalleryView | verified-composition | 20:9783, 20:10026 |
| AiContextIgnoreButton | verified-composition | 12:3225 |
| BulkCollapseButton | verified-composition | 12:3546 |
| ConfiguredNoteCard | verified-composition | 12:2818, 12:2819 |
| SimplifiedNotesProvider | runtime-adapter |  |
| RichObjectContent | pending-figma-composition |  |
| TooltipObject | verified-composition | 24:49325, 24:50226 |
| ConfiguredRulesLink | verified-composition | 24:48461 |
| RulesReferenceRuntimeProvider | runtime-adapter |  |
| SettingsModalContent | verified-composition | 20:32374, 20:32481, 20:32588, 20:32699, 20:32810, 20:32917, 20:33024, 20:33135 |
| ConfiguredSettingsModalContent | verified-composition | 20:32374, 20:32481, 20:32588, 20:32699, 20:32810, 20:32917, 20:33024, 20:33135 |
| CampaignPageRuntimeProvider | runtime-adapter |  |
| CampaignPage | pending-figma-composition |  |
| CampaignGraphCanvasMessages | pending-figma-composition |  |
| CampaignGraphSelectedDetails | pending-figma-composition |  |
| CampaignGraphNodeHandles | pending-figma-composition |  |
| CampaignNotesContent | pending-figma-composition |  |
| CampaignPartialArchiveOverlay | pending-figma-composition |  |
| EncounterPageRuntimeProvider | runtime-adapter |  |
| EncounterView | pending-figma-composition |  |
| BestiaryAiDraftModal | pending-figma-composition |  |
| EncounterBestiary | pending-figma-composition |  |
| EncounterBestiaryAiModals | pending-figma-composition |  |
| EncounterBestiaryOverlay | pending-figma-composition |  |
| EncounterCharacterOverlays | pending-figma-composition |  |
| EncounterCharacterModalOverlay | pending-figma-composition |  |
| EncounterDetail | pending-figma-composition |  |
| EncounterSelectedDetail | pending-figma-composition |  |
| EncounterMonsterStatBlock | pending-figma-composition |  |
| EncounterHistoryControls | pending-figma-composition |  |
| EncounterMonsterActionModals | pending-figma-composition |  |
| EncounterNotification | pending-figma-composition |  |
| SessionPageRuntimeProvider | runtime-adapter |  |
| SessionNotesSection | pending-figma-composition |  |
| SessionResultSection | pending-figma-composition |  |
| SessionScopedEntityModal | verified-composition | 24:45168, 24:45864, 24:46425, 24:46941 |
| ButtonIcon | pending-figma-composition |  |
| CollapseToggleButton | verified-composition | 12:2714 |
| Modal | pending-figma-composition |  |
| UndoRedoButtons | pending-figma-composition |  |
| AiAssistantPanel | pending-figma-composition |  |
| AiAssistantRuntimeProvider | runtime-adapter |  |
| AiImagePromptPickerModal | verified-composition | 53:117574 |
| AiResponseCardDiff | verified-composition | 60:142415 |
| ConfiguredAiResponseModal | pending-figma-composition |  |
| ResponseToolbar | verified-composition | 53:125455 |
| ApplyButton | verified-composition | 53:125344 |
| UndoButton | verified-composition | 53:125344 |
| AiResponseResourceActions | verified-composition | 53:125344 |
| BestiaryBrowser | pending-figma-composition |  |
| BestiaryBrowserContent | pending-figma-composition |  |
| BestiaryBrowserModals | pending-figma-composition |  |
| BestiaryBrowserRuntimeProvider | runtime-adapter |  |
| MonsterListItemActions | verified-composition | 45:91290 |
| CampaignEntityCreationRuntimeProvider | runtime-adapter |  |
| CampaignEntityModalCard | verified-composition | 24:44124, 24:44472, 24:44820, 24:45516, 24:46167, 24:46683 |
| CampaignEntityModalContent | verified-composition | 24:44124, 24:44472, 24:44820, 24:45516, 24:46167, 24:46683 |
| CampaignEntityModalProvider | runtime-adapter |  |
| ParsedSearchText | pending-figma-composition |  |
| CampaignSearchRuntimeProvider | runtime-adapter |  |
| GlobalSearchModal | pending-figma-composition |  |
| CampaignSearchFilterButton | pending-figma-composition |  |
| MonsterEditorModal | pending-figma-composition |  |
| RulesReferenceAdapter | pending-figma-composition |  |
| ConfiguredMonsterEditorModal | pending-figma-composition |  |
| MonsterStatBlockRuntimeProvider | runtime-adapter |  |
| MonsterFavoriteAction | verified-composition | 30:74974, 30:75150 |
| MonsterCallbackAction | verified-composition | 30:75007, 30:75150 |
| MonsterAddToEncounterAction | verified-composition | 30:75009, 30:75150 |
| SpellLinks | verified-composition | 39:80243, 39:80280 |
| OptionalSpellContentLine | verified-composition | 39:80245, 39:80178, 39:80280 |
| SpellContentLines | verified-composition | 39:80178, 39:80280 |
| RulesReferenceModalContent | pending-figma-composition |  |
| ConfiguredRulesReferenceModalContent | pending-figma-composition |  |
| RulesReferenceModalHost | runtime-adapter |  |
| RulesReferenceModalRuntimeProvider | runtime-adapter |  |
| BestiaryReferenceEntry | pending-figma-composition |  |
| SidebarRuntimeProvider | runtime-adapter |  |
| SidebarPlayerQuestionsModalContent | verified-composition | 20:34268, 20:34306, 20:34408, 20:34510, 20:34549, 20:34652 |
| SpellSchoolMeta | verified-composition | 27:57327, 27:59369 |
| SpellClassesMeta | verified-composition | 27:57327, 27:59369 |
| SpellsBrowserRuntimeProvider | runtime-adapter |  |
