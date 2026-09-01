import {
	buildAiGeneratedResultPlan,
	executeAiGeneratedResultPlan,
	type AiGenerationResult,
	type AiHistoryEntry,
} from "../../../features/ai/index.js";
import { lang } from "../../../shared/lib/index.js";
import type { ApplyUpdatedAiDataOptions } from "./useAiAssistantUpdatedData.ts";

export interface GeneratedAiDataInput {
	data: AiGenerationResult | null;
	requestType: string | null;
	shouldParseResponse: boolean;
	clearPromptOnApplied?: boolean;
}

interface UseAiAssistantGeneratedResultOptions {
	applyUpdatedData(updated: unknown, options?: ApplyUpdatedAiDataOptions): boolean;
	isBestiary: boolean;
	isCampaign: boolean;
	isEncounter: boolean;
	onClearPrompt(): void;
	onCloseAssistantDialogs(): void;
	onCloseAuxiliaryDialogs(): void;
	onNotification(message: string): void;
	onRequestCampaignReload(): void;
	onRefreshEntities(): void;
	showGeneratedPrompt(response: unknown): void;
	upsertResponseHistoryEntry(entry: AiHistoryEntry): void;
}

export function useAiAssistantGeneratedResult({
	applyUpdatedData,
	isBestiary,
	isCampaign,
	isEncounter,
	onClearPrompt,
	onCloseAssistantDialogs,
	onCloseAuxiliaryDialogs,
	onNotification,
	onRequestCampaignReload,
	onRefreshEntities,
	showGeneratedPrompt,
	upsertResponseHistoryEntry,
}: UseAiAssistantGeneratedResultOptions) {
	const handleGeneratedAiData = ({
		data,
		requestType,
		shouldParseResponse,
		clearPromptOnApplied = true,
	}: GeneratedAiDataInput): void => {
		const plan = buildAiGeneratedResultPlan({
			data,
			requestType,
			shouldParseResponse,
			isBestiary,
			isCampaign,
			isEncounter,
			clearPromptOnApplied,
		});
		executeAiGeneratedResultPlan({
			plan,
			onHistoryEntry: upsertResponseHistoryEntry,
			onShowPrompt: showGeneratedPrompt,
			onNotification: (notification) => {
				onNotification(
					notification === "draft-created"
						? lang.t("AI draft created.")
						: notification === "custom-creatures-saved"
							? lang.t("Custom creatures saved.")
							: lang.t("AI changes applied successfully!"),
				);
			},
			onApplyUpdated: (updatedPlan) => {
				applyUpdatedData(updatedPlan.updated, {
					entityTypes: updatedPlan.entityTypes,
					generated: updatedPlan.generated,
					historyEntry: updatedPlan.historyEntry,
				});
			},
			onCampaignReload: onRequestCampaignReload,
			onClearPrompt,
			onRefreshEntities,
			onCloseAuxiliaryDialogs,
			onCloseAssistantDialogs,
		});
	};

	return { handleGeneratedAiData };
}
