import {
	useMemo,
	type MutableRefObject,
} from "react";
import { campaignApi } from "../../../entities/campaign/index.js";
import { bestiaryApi } from "../../../entities/bestiary/index.js";
import {
	aiApi,
	buildDiffResources,
} from "../../../features/ai/index.js";
import { settingsApi } from "../../../features/settings/index.js";
import { lang } from "../../../shared/lib/index.js";
import type { EncounterPageMessage } from "./EncounterPageRuntime.tsx";
import type {
	EncounterViewModel,
} from "./contracts.ts";
import type { useEncounterMonsterAiEditor } from "./useEncounterMonsterAiEditor.ts";
import { useEncounterMonsterAiAction } from "./useEncounterMonsterAiAction.ts";
import { useEncounterMonsterAiDraft } from "./useEncounterMonsterAiDraft.ts";
import { useEncounterMonsterAiGeneration } from "./useEncounterMonsterAiGeneration.ts";
import { useEncounterMonsterFieldEditing } from "./useEncounterMonsterFieldEditing.ts";

const api = { ...campaignApi, ...bestiaryApi, ...aiApi, ...settingsApi };

interface Options {
	aiEditor: ReturnType<typeof useEncounterMonsterAiEditor>;
	aiEditControllerRef: MutableRefObject<AbortController | null>;
	campaignSlug: string;
	sessionId: string;
	language: string;
	view: EncounterViewModel;
	refreshEntities(): void;
	showMessage(message: EncounterPageMessage): void;
}

export function useEncounterMonsterAiWorkflows(options: Options) {
	const monsterAiAction = useEncounterMonsterAiAction({
		isEditing: options.aiEditor.isEditing,
		onStartEditing: options.aiEditor.start,
	});
	const monsterFieldEditing = useEncounterMonsterFieldEditing({
		api,
		creatureLabel: lang.t("Creature"),
		duplicateNameMessage: lang.t("Custom creature with this name already exists."),
		errorTitle: lang.t("Error"),
		unknownError: lang.t("Unknown error"),
		refreshEntities: options.refreshEntities,
		showMessage: options.showMessage,
		onUpdateMonster: options.view.updateMonsterFromAi,
	});
	const aiDraft = useEncounterMonsterAiDraft({
		api,
		campaignSlug: options.campaignSlug,
		targetInstanceId: monsterAiAction.targetInstanceId,
		onLocalUpdate: options.view.handleAiUpdate,
		onMonsterUpdate: options.view.updateMonsterFromAi,
		onError: (error) => options.showMessage({
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
		controllerRef: options.aiEditControllerRef,
		campaignSlug: options.campaignSlug,
		sessionId: options.sessionId,
		encounterId: options.view.encounter?.id,
		language: options.language,
		targetInstanceId: monsterAiAction.targetInstanceId,
		monster: options.aiEditor.editingMonster,
		mode: options.aiEditor.mode,
		instructions: options.aiEditor.instructions,
		selectedModel: options.aiEditor.selectedModel,
		translate: lang.t,
		onDraftMode: aiDraft.setMode,
		onDraftEntry: aiDraft.setEntry,
		onMonsterUpdate: options.view.updateMonsterFromAi,
		onError: options.aiEditor.setError,
		onStart: () => {
			options.aiEditor.setIsEditing(true);
			options.aiEditor.setError("");
		},
		onSuccess: options.aiEditor.completeSuccess,
		onComplete: () => options.aiEditor.setIsEditing(false),
	});

	return {
		aiDraft,
		aiDraftDiffResources,
		aiGeneration,
		monsterAiAction,
		monsterFieldEditing,
	};
}
