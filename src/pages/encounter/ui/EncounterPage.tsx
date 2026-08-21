import {
	useMemo,
	useRef,
	useState,
} from "react";
import {
	Button,
	DraggableList,
	Panel,
} from "../../../shared/ui/index.js";
import { BestiaryBrowser as Bestiary } from "../../../widgets/bestiary-browser/index.js";
import { createAiResponseModalComponent } from "../../../widgets/ai-response-modal/index.js";
import { AiAssistantPanel } from "../../../widgets/ai-assistant/index.js";
import { createMonsterEditorModalComponent } from "../../../widgets/monster-editor-modal/index.js";
import { MonsterStatBlock } from "../../../widgets/monster-stat-block/index.js";
import { SpellsBrowser } from "../../../widgets/spells-browser/index.js";
import { createRulesReferenceModalContentComponent } from "../../../widgets/rules-reference-modal/index.js";
import {
	CharacterCard,
	LocationCard,
} from "../../../widgets/campaign-entity-card/index.js";
import useEncounterView from "../model/useEncounterView.ts";
import { useEncounterAiModelLoading } from "../model/useEncounterAiModelLoading.ts";
import { useEncounterGridFocus } from "../model/useEncounterGridFocus.ts";
import { useEncounterHpEditing } from "../model/useEncounterHpEditing.ts";
import { useEncounterCharacterModal } from "../model/useEncounterCharacterModal.ts";
import { useEncounterDisplaySettings } from "../model/useEncounterDisplaySettings.ts";
import { useEncounterHeaderDismissal } from "../model/useEncounterHeaderDismissal.ts";
import { useEncounterMonsterAiAction } from "../model/useEncounterMonsterAiAction.ts";
import { useEncounterMonsterAiDraft } from "../model/useEncounterMonsterAiDraft.ts";
import { useEncounterMonsterAiEditor } from "../model/useEncounterMonsterAiEditor.ts";
import { useEncounterMonsterAiGeneration } from "../model/useEncounterMonsterAiGeneration.ts";
import { useEncounterMonsterFieldEditing } from "../model/useEncounterMonsterFieldEditing.ts";
import { useEncounterMonsterInteractions } from "../model/useEncounterMonsterInteractions.ts";
import { useEncounterPlayerCreation } from "../model/useEncounterPlayerCreation.ts";
import { useEncounterRequestCleanup } from "../model/useEncounterRequestCleanup.ts";
import "../../../assets/components/EncounterView.css";
import { campaignApi } from "../../../entities/campaign/index.js";
import {
	bestiaryApi,
	type BestiaryMonster,
} from "../../../entities/bestiary/index.js";
import { aiApi } from "../../../features/ai/index.js";
import { settingsApi } from "../../../features/settings/index.js";
import EncounterBestiaryAiModals from "./components/EncounterBestiaryAiModals.tsx";
import EncounterBestiaryOverlay from "./components/EncounterBestiaryOverlay.tsx";
import EncounterCharacterOverlays from "./components/EncounterCharacterOverlays.tsx";
import EncounterDetail from "./components/EncounterDetail.tsx";
import EncounterHeader from "./components/EncounterHeader.tsx";
import EncounterMonsterActionModals from "./components/EncounterMonsterActionModals.tsx";
import EncounterMonsterRow from "./components/EncounterMonsterRow.tsx";
import EncounterNotification from "./components/EncounterNotification.tsx";

const EncounterRulesReferenceContent =
	createRulesReferenceModalContentComponent({
		MonsterStatBlock,
		SpellsBrowser,
	});
const EncounterMonsterEditorModal = createMonsterEditorModalComponent({
	RulesReferenceContent: EncounterRulesReferenceContent,
});
const EncounterAiResponseModal = createAiResponseModalComponent({
	CharacterCard,
	LocationCard,
	MonsterStatBlock,
	MonsterEditorModal: EncounterMonsterEditorModal,
});

const api = { ...campaignApi, ...bestiaryApi, ...aiApi, ...settingsApi };
import { lang } from "../../../shared/lib/index.js";
import {
	buildDiffResources,
	type AiHistoryEntry,
	type AiHistoryResource,
} from "../../../features/ai/index.js";
import {
	getHistoryChangeSummary as getAiHistoryChangeSummary,
	getLocalizedDiffResourceState,
} from "../../../features/ai/index.js";
import {
	getAvailableEncounterCharacters,
	getEncounterGridProjection,
	getEncounterRenderContext,
	resolveEncounterHpInputValue as resolveHpInputValue,
} from "../model/encounterPagePresentation.ts";
import type {
	EncounterViewModel,
	EncounterViewParticipant,
} from "../model/contracts.ts";
import type {
	CampaignEntityRecord,
	CampaignRecord,
} from "../../../entities/campaign/index.js";
import { useEncounterPageRuntime } from "../model/EncounterPageRuntime.tsx";

type EncounterDisplayMode = "grid" | "single";

const EMPTY_ENCOUNTER_PARTICIPANTS: EncounterViewParticipant[] = [];
const EMPTY_CAMPAIGN_ENTITIES: CampaignEntityRecord[] = [];

function translate(...args: Parameters<typeof lang.t>) {
	return lang.t(...args);
}

function getHistoryChangeSummary(entry: AiHistoryEntry) {
	return getAiHistoryChangeSummary(entry, translate);
}

function getDiffResourceState(resource: AiHistoryResource) {
	return getLocalizedDiffResourceState(resource, translate);
}

function getParticipantInstanceId(participant: EncounterViewParticipant): string {
	return String(participant.instanceId || participant.id || "");
}

function getEncounterDisplayMode(value: unknown): EncounterDisplayMode {
	return value === "single" ? "single" : "grid";
}

function getEncounterGridColumns(value: unknown): number {
	return Number(value) || 2;
}

function getSelectedGridId(
	selected: EncounterViewParticipant | null,
	representatives: Map<string, string>,
): string | null {
	if (!selected) return null;
	const instanceId = getParticipantInstanceId(selected);
	return representatives.get(instanceId) || instanceId;
}

function getEncounterLayout(
	displayMode: EncounterDisplayMode,
	gridColumns: number,
	monsterCount: number,
) {
	return {
		displayMode: monsterCount === 1 ? "single" as const : displayMode,
		gridColumns: Math.max(1, Math.min(gridColumns, monsterCount || 1)),
	};
}

function getOptionalParticipantId(
	participant: EncounterViewParticipant | null,
): string | undefined {
	return participant ? getParticipantInstanceId(participant) : undefined;
}

function getEncounterViewParticipants(
	view: EncounterViewModel,
): EncounterViewParticipant[] {
	return view.encounter?.monsters || EMPTY_ENCOUNTER_PARTICIPANTS;
}

function getEncounterViewPlayerCharacters(
	view: EncounterViewModel,
): CampaignEntityRecord[] {
	return view.playerCharacters || EMPTY_CAMPAIGN_ENTITIES;
}

function EncounterView() {
	const {
		activeCampaign: runtimeCampaign,
		activeSessionFileName: sessionId,
		currentLanguage,
		encounterGridColumns,
		encounterViewMode,
		patchUiSettings,
		refreshEntities,
		showMessage,
	} = useEncounterPageRuntime();
	const campaign = runtimeCampaign as CampaignRecord | null;
	const displayMode = getEncounterDisplayMode(encounterViewMode);
	const gridColumns = getEncounterGridColumns(encounterGridColumns);
	const aiDraftResponseRef = useRef<HTMLDivElement | null>(null);
	const aiEditControllerRef = useRef<AbortController | null>(null);
	const headerActionsRef = useRef<HTMLDivElement | null>(null);
	const [isHeaderActionsOpen, setIsHeaderActionsOpen] = useState(false);
	const view = useEncounterView();
	const encounterParticipants = getEncounterViewParticipants(view);
	const playerCharacters = getEncounterViewPlayerCharacters(view);

	const { gridMonsters, gridRepresentativeByInstanceId } = useMemo(() => {
		const projection = getEncounterGridProjection(encounterParticipants);
		return {
			gridMonsters: projection.monsters,
			gridRepresentativeByInstanceId: projection.representativeByInstanceId,
		};
	}, [encounterParticipants]);

	const selectedGridInstanceId = getSelectedGridId(
		view.selectedInstance,
		gridRepresentativeByInstanceId,
	);
	const {
		focusTimeoutRef,
		focusedMonsterId,
		focusMonsterInGrid,
		setGridItemRef,
	} = useEncounterGridFocus(gridRepresentativeByInstanceId);
	const displayedMonsterCount = gridMonsters.length;
	const {
		displayMode: effectiveDisplayMode,
		gridColumns: effectiveGridColumns,
	} = getEncounterLayout(displayMode, gridColumns, displayedMonsterCount);
	const availablePlayerCharacters = useMemo(
		() => getAvailableEncounterCharacters(
			encounterParticipants,
			playerCharacters,
		),
		[encounterParticipants, playerCharacters],
	);
	const playerCreation = useEncounterPlayerCreation({
		campaignSlug: campaign?.slug || "",
		onAdd: view.handleAddCharacter,
		onClosePicker: () => view.setShowCharacterPicker(false),
		refreshEntities,
		showMessage,
		messages: {
			errorTitle: lang.t("Error"),
			missingName: lang.t("Name is required to create an entry."),
			failedCreation: lang.t("Failed to create entity."),
		},
	});
	const hpEditing = useEncounterHpEditing({
	getInstanceId: getParticipantInstanceId,
	onUpdate: view.updateMonsterHp,
	});
	const characterModal = useEncounterCharacterModal({
		onUpdate: view.updateEncounterCharacter,
	});
	const aiEditor = useEncounterMonsterAiEditor();

	useEncounterRequestCleanup(focusTimeoutRef, aiEditControllerRef);
	useEncounterHeaderDismissal(isHeaderActionsOpen, headerActionsRef, () => setIsHeaderActionsOpen(false));
	useEncounterAiModelLoading({
		aiEditingMonster: aiEditor.editingMonster,
		aiModelCount: aiEditor.models.length,
		onModels: aiEditor.setModels,
		onSelectedModel: aiEditor.setSelectedModel,
		onError: (error) => {
			console.error("Failed to load AI models", error);
			aiEditor.setError(error instanceof Error ? error.message : lang.t("Failed to connect to AI."));
		},
	});
	const displaySettings = useEncounterDisplaySettings({ patchUiSettings });
	const monsterAiAction = useEncounterMonsterAiAction({
		isEditing: aiEditor.isEditing,
		onStartEditing: aiEditor.start,
	});
	const monsterFieldEditing = useEncounterMonsterFieldEditing({
		api,
		creatureLabel: lang.t("Creature"),
		duplicateNameMessage: lang.t("Custom creature with this name already exists."),
		errorTitle: lang.t("Error"),
		unknownError: lang.t("Unknown error"),
		refreshEntities,
		showMessage,
		onUpdateMonster: view.updateMonsterFromAi,
	});
	const aiDraft = useEncounterMonsterAiDraft({
		api,
		campaignSlug: campaign?.slug || "",
		targetInstanceId: monsterAiAction.targetInstanceId,
		onLocalUpdate: view.handleAiUpdate,
		onMonsterUpdate: view.updateMonsterFromAi,
		onError: (error) => showMessage({
			title: lang.t("AI history error"),
			message: error instanceof Error ? error.message : lang.t("Unknown error"),
		}),
	});
	const aiDraftDiffResources = useMemo(
		() =>
			buildDiffResources(aiDraft.entry, {
				added: lang.t("Added"),
				deleted: lang.t("Deleted"),
				modified: lang.t("Modified"),
			}),
		[aiDraft.entry],
	);
	const aiGeneration = useEncounterMonsterAiGeneration({
		api,
		controllerRef: aiEditControllerRef,
		campaignSlug: campaign?.slug || "",
		sessionId: sessionId || "",
		encounterId: view.encounter?.id,
		language: currentLanguage,
		targetInstanceId: monsterAiAction.targetInstanceId,
		monster: aiEditor.editingMonster,
		mode: aiEditor.mode,
		instructions: aiEditor.instructions,
		selectedModel: aiEditor.selectedModel,
		translate: lang.t,
		onDraftMode: aiDraft.setMode,
		onDraftEntry: aiDraft.setEntry,
		onMonsterUpdate: view.updateMonsterFromAi,
		onError: aiEditor.setError,
		onStart: () => {
			aiEditor.setIsEditing(true);
			aiEditor.setError("");
		},
		onSuccess: aiEditor.completeSuccess,
		onComplete: () => aiEditor.setIsEditing(false),
	});
	const monsterInteractions = useEncounterMonsterInteractions({
		selectedInstanceId: view.selectedInstance?.instanceId,
		displayMode: effectiveDisplayMode,
		onOpenCharacter: characterModal.open,
		onSelect: view.setSelectedInstance,
		onFocus: focusMonsterInGrid,
		onTokenImageUpdate: view.updateMonsterImage,
	});

	const renderContext = getEncounterRenderContext(view, campaign, sessionId);
	if (!renderContext) return <EncounterLoading />;
	const { campaign: activeCampaign, encounter } = renderContext;

	return (
		<Panel className="EncounterView">
			<EncounterHeader
				view={view}
				displayMode={effectiveDisplayMode}
				displayedMonsterCount={displayedMonsterCount}
				gridColumns={gridColumns}
				isActionsOpen={isHeaderActionsOpen}
				actionsRef={headerActionsRef}
				onToggleActions={() => setIsHeaderActionsOpen((value) => !value)}
				onDisplayMode={displaySettings.updateViewMode}
				onGridColumns={displaySettings.updateGridColumns}
			/>
			<div className="Panel__body EncounterView__body">
				<div className="EncounterView__main">
					<div className="EncounterView__list">
						<div className="EncounterView__addActions">
							<Button
								variant="create"
								onClick={() => view.setShowBestiary(true)}
								icon="plus"
								className="EncounterView__addBtn"
							>
								{lang.t("Add monster")}
							</Button>
							<Button
								variant="ghost"
								onClick={() => view.setShowCharacterPicker(true)}
								icon="user"
								className="EncounterView__addBtn"
							>
								{lang.t("Add player")}
							</Button>
						</div>

						<DraggableList
							items={encounter.monsters}
							onReorder={view.handleReorderMonsters}
							onDrop={view.handleMonstersDrop}
							keyExtractor={(m) => m.instanceId || String(m.id || m.name || "")}
							renderItem={(monster, isDragging) => (
								<EncounterMonsterRow
									monster={monster}
									isDragging={isDragging}
								hpDrafts={hpEditing.drafts}
									selectedInstanceId={getOptionalParticipantId(view.selectedInstance)}
									view={view}
									onSelect={monsterInteractions.select}
								onHpChange={hpEditing.onChange}
								onHpBlur={hpEditing.onBlur}
									getParticipantInstanceId={getParticipantInstanceId}
								/>
							)}
						/>
					</div>

					<EncounterDetail
						displayMode={effectiveDisplayMode}
						gridMonsters={gridMonsters}
						gridColumns={effectiveGridColumns}
						selectedInstance={view.selectedInstance}
						selectedGridInstanceId={selectedGridInstanceId}
						focusedMonsterId={focusedMonsterId}
						campaignSlug={activeCampaign.slug}
						getParticipantInstanceId={getParticipantInstanceId}
						setGridItemRef={setGridItemRef}
						onAiAction={monsterAiAction.openAction}
						onFieldEdit={monsterFieldEditing.openAction}
						onTokenImageChange={monsterInteractions.updateTokenImage}
						onCharacterChange={characterModal.getOnChange}
						getMonsterImageOverride={view.getMonsterImageOverride}
					/>
				</div>
			</div>

			<EncounterBestiaryOverlay
				open={view.showBestiary}
				onClose={() => view.setShowBestiary(false)}
				onAdd={view.handleAddMonster}
				renderBestiary={(onAdd) => (
					<Bestiary
						BestiaryAiModals={EncounterBestiaryAiModals}
						AiAssistantPanel={AiAssistantPanel}
						MonsterStatBlock={MonsterStatBlock}
						ResponseModal={EncounterAiResponseModal}
						MonsterEditorModal={EncounterMonsterEditorModal}
						onAddMonster={(monster) => onAdd(monster as EncounterViewParticipant)}
						/>
				)}
			/>

			<EncounterCharacterOverlays
				open={view.showCharacterPicker}
				creating={playerCreation.creating}
				submitting={playerCreation.submitting}
				draft={playerCreation.draft}
				available={availablePlayerCharacters}
				allCharacters={view.playerCharacters}
				modalCharacter={characterModal.value}
				campaignSlug={activeCampaign.slug}
				onClosePicker={playerCreation.closePicker}
				onDraft={playerCreation.setDraft}
				onCreate={playerCreation.submit}
				onReset={playerCreation.reset}
				onStartCreate={playerCreation.start}
				onAdd={view.handleAddCharacter}
				onCloseCharacter={characterModal.close}
					getModalCharacterOnChange={(character) =>
						characterModal.getOnChange(getParticipantInstanceId(character))
				}
			/>

			<EncounterMonsterActionModals
				aiActionMonster={monsterAiAction.actionMonster}
				fieldActionMonster={monsterFieldEditing.actionMonster}
				onAiCancel={monsterAiAction.closeAction}
				onAiChoose={monsterAiAction.chooseAction}
				onFieldCancel={monsterFieldEditing.closeAction}
				onFieldChoose={monsterFieldEditing.chooseAction}
			/>
			<EncounterBestiaryAiModals
				ResponseModal={EncounterAiResponseModal}
				aiDraftDiffResources={aiDraftDiffResources}
				aiDraftResponseEntry={aiDraft.entry}
				aiDraftResponseRef={aiDraftResponseRef}
				aiEditingMonster={aiEditor.editingMonster as BestiaryMonster | null}
				aiEditError={aiEditor.error}
				aiEditInstructions={aiEditor.instructions}
				aiEditMode={aiEditor.mode}
				aiModels={aiEditor.models}
				getDiffResourceState={getDiffResourceState}
				getHistoryChangeSummary={getHistoryChangeSummary}
				isAiEditingMonster={aiEditor.isEditing}
				isRestoringAiResponse={aiDraft.isRestoring}
				onApplyDraft={(entry) => aiDraft.restore(entry, "apply")}
				onApplyDraftResource={(entry, resourceIds) =>
					aiDraft.restore(entry, "apply", { resourceIds })
				}
				onCancelDraft={aiDraft.close}
				onCancelEdit={aiEditor.close}
				onCancelEditRequest={aiGeneration.cancel}
				onInstructionsChange={aiEditor.setInstructions}
				onModelChange={aiEditor.setSelectedModel}
				onSaveDraftChanges={aiDraft.save}
				onSaveEdit={aiGeneration.save}
				onUndoDraft={(entry) => aiDraft.restore(entry, "undo")}
				onUndoDraftResource={(entry, resourceIds) =>
					aiDraft.restore(entry, "undo", { resourceIds })
				}
				selectedAiModel={aiEditor.selectedModel}
			/>
			<EncounterMonsterEditorModal
				editingMonster={monsterFieldEditing.editingMonster}
				onCancel={monsterFieldEditing.closeEditor}
				onSave={monsterFieldEditing.save}
				title={lang.t("Edit encounter creature")}
			/>

			<EncounterNotification
				message={view.notification}
				onClose={() => view.setNotification(null)}
			/>
		</Panel>
	);
}

function EncounterLoading() {
	return (
		<Panel className="EncounterView">
			<div className="Panel__body">{lang.t("Loading...")}</div>
		</Panel>
	);
}

export default EncounterView;
