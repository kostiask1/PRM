import {
	useMemo,
	useRef,
	useState,
} from "react";
import { lang } from "../../../shared/lib/index.js";
import type {
	CampaignEntityRecord,
	CampaignRecord,
} from "../../../entities/campaign/index.js";
import type {
	EncounterViewModel,
	EncounterViewParticipant,
} from "./contracts.ts";
import {
	getAvailableEncounterCharacters,
	getEncounterGridProjection,
	getEncounterLayout,
	getEncounterRenderContext,
	getEncounterSelectedGridId,
} from "./encounterPagePresentation.ts";
import { useEncounterPageRuntime } from "./EncounterPageRuntime.tsx";
import { useEncounterAiModelLoading } from "./useEncounterAiModelLoading.ts";
import { useEncounterCharacterModal } from "./useEncounterCharacterModal.ts";
import { useEncounterDisplaySettings } from "./useEncounterDisplaySettings.ts";
import { useEncounterGridFocus } from "./useEncounterGridFocus.ts";
import { useEncounterHeaderDismissal } from "./useEncounterHeaderDismissal.ts";
import { useEncounterHpEditing } from "./useEncounterHpEditing.ts";
import { useEncounterMonsterAiEditor } from "./useEncounterMonsterAiEditor.ts";
import { useEncounterMonsterInteractions } from "./useEncounterMonsterInteractions.ts";
import { useEncounterMonsterAiWorkflows } from "./useEncounterMonsterAiWorkflows.ts";
import { useEncounterPlayerCreation } from "./useEncounterPlayerCreation.ts";
import { useEncounterRequestCleanup } from "./useEncounterRequestCleanup.ts";
import useEncounterView from "./useEncounterView.ts";

const EMPTY_ENCOUNTER_PARTICIPANTS: EncounterViewParticipant[] = [];
const EMPTY_CAMPAIGN_ENTITIES: CampaignEntityRecord[] = [];

function getParticipantInstanceId(participant: EncounterViewParticipant): string {
	return String(participant.instanceId || participant.id || "");
}

function getEncounterDisplayMode(value: unknown): "single" | "grid" {
	return value === "single" ? "single" : "grid";
}

function getEncounterGridColumns(value: unknown): number {
	return Number(value) || 2;
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

export function useEncounterPageController() {
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

	const selectedGridInstanceId = getEncounterSelectedGridId(
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
		fallbackError: lang.t("Failed to connect to AI."),
		onError: aiEditor.setError,
	});
	const displaySettings = useEncounterDisplaySettings({ patchUiSettings });
	const {
		aiDraft,
		aiDraftDiffResources,
		aiGeneration,
		monsterAiAction,
		monsterFieldEditing,
	} = useEncounterMonsterAiWorkflows({
		aiEditor,
		aiEditControllerRef,
		campaignSlug: campaign?.slug || "",
		sessionId: sessionId || "",
		language: currentLanguage,
		view,
		refreshEntities,
		showMessage,
	});
	const monsterInteractions = useEncounterMonsterInteractions({
		selectedInstanceId: view.selectedInstance?.instanceId,
		displayMode: effectiveDisplayMode,
		onOpenCharacter: characterModal.open,
		onSelect: view.setSelectedInstance,
		onFocus: focusMonsterInGrid,
		onTokenImageUpdate: view.updateMonsterImage,
	});

	return {
		aiDraft,
		aiDraftDiffResources,
		aiDraftResponseRef,
		aiEditor,
		aiGeneration,
		availablePlayerCharacters,
		characterModal,
		displaySettings,
		effectiveDisplayMode,
		effectiveGridColumns,
		focusedMonsterId,
		getParticipantInstanceId,
		gridColumns,
		gridMonsters,
		headerActionsRef,
		hpEditing,
		isHeaderActionsOpen,
		monsterAiAction,
		monsterFieldEditing,
		monsterInteractions,
		playerCreation,
		renderContext: getEncounterRenderContext(view, campaign, sessionId),
		selectedGridInstanceId,
		selectedParticipantId: view.selectedInstance
			? getParticipantInstanceId(view.selectedInstance)
			: undefined,
		setGridItemRef,
		toggleHeaderActions: () => setIsHeaderActionsOpen((value) => !value),
		view,
	};
}
