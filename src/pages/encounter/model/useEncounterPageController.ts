import {
	useMemo,
	useRef,
	useState,
} from "react";
import { lang } from "../../../shared/lib/index.js";
import type { CampaignRecord } from "../../../entities/campaign/index.js";
import type {
	EncounterViewParticipant,
} from "./contracts.ts";
import {
	getAvailableEncounterCharacters,
	getEncounterRenderContext,
} from "./encounterPagePresentation.ts";
import { useEncounterPageRuntime } from "./EncounterPageRuntime.tsx";
import { useEncounterAiModelLoading } from "./useEncounterAiModelLoading.ts";
import { useEncounterCharacterModal } from "./useEncounterCharacterModal.ts";
import { useEncounterDisplaySettings } from "./useEncounterDisplaySettings.ts";
import { useEncounterHeaderDismissal } from "./useEncounterHeaderDismissal.ts";
import { useEncounterHpEditing } from "./useEncounterHpEditing.ts";
import { useEncounterMonsterAiEditor } from "./useEncounterMonsterAiEditor.ts";
import { useEncounterMonsterInteractions } from "./useEncounterMonsterInteractions.ts";
import { useEncounterMonsterAiWorkflows } from "./useEncounterMonsterAiWorkflows.ts";
import { useEncounterPageDisplayProjection } from "./useEncounterPageDisplayProjection.ts";
import { useEncounterPlayerCreation } from "./useEncounterPlayerCreation.ts";
import { useEncounterRequestCleanup } from "./useEncounterRequestCleanup.ts";
import useEncounterView from "./useEncounterView.ts";

function getParticipantInstanceId(participant: EncounterViewParticipant): string {
	return String(participant.instanceId || participant.id || "");
}

function getEncounterDisplayMode(value: unknown): "single" | "grid" {
	return value === "single" ? "single" : "grid";
}

function getEncounterGridColumns(value: unknown): number {
	return Number(value) || 2;
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
	const displayProjection = useEncounterPageDisplayProjection({
		displayMode,
		gridColumns,
		view,
	});
	const availablePlayerCharacters = useMemo(
		() => getAvailableEncounterCharacters(
			displayProjection.encounterParticipants,
			displayProjection.playerCharacters,
		),
		[
			displayProjection.encounterParticipants,
			displayProjection.playerCharacters,
		],
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

	useEncounterRequestCleanup(displayProjection.focusTimeoutRef, aiEditControllerRef);
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
		displayMode: displayProjection.effectiveDisplayMode,
		onOpenCharacter: characterModal.open,
		onSelect: view.setSelectedInstance,
		onFocus: displayProjection.focusMonsterInGrid,
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
		...displayProjection,
		getParticipantInstanceId,
		gridColumns,
		headerActionsRef,
		hpEditing,
		isHeaderActionsOpen,
		monsterAiAction,
		monsterFieldEditing,
		monsterInteractions,
		playerCreation,
		renderContext: getEncounterRenderContext(view, campaign, sessionId),
		selectedParticipantId: view.selectedInstance
			? getParticipantInstanceId(view.selectedInstance)
			: undefined,
		toggleHeaderActions: () => setIsHeaderActionsOpen((value) => !value),
		view,
	};
}
