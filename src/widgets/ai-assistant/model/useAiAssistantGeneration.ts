import { useReducer, useRef, useState } from "react";
import {
	aiGenerationLifecycleReducer,
	buildAiGenerationRequest,
	executeAiGeneration,
	executeAiHistoryRetry,
	formatAiGenerationFailureAlert,
	getAiHistoryRetryFailure,
	initialAiGenerationLifecycle,
	isAiGenerationPending,
	type AiGenerationRequestInput,
	type AiHistoryEntry,
	type AiHistoryRetryPlan,
	type ExecuteAiGenerationOptions,
	type ExecuteAiHistoryRetryOptions,
} from "../../../features/ai/index.js";
import type { AiUiAttachment } from "../../../features/ai/ui/index.js";
import { lang } from "../../../shared/lib/index.js";
import type { ImagePromptTarget } from "./imagePromptPicker.ts";
import type { GeneratedAiDataInput } from "./useAiAssistantGeneratedResult.ts";

interface GenerateOptions {
	forceParseAIResponse?: boolean | null;
	imageTarget?: ImagePromptTarget | null;
	imagePromptBasePromptOverride?: string;
	userInstructionsOverride?: string | null;
}

interface UseAiAssistantGenerationOptions {
	attachedFiles: AiUiAttachment[];
	attachedImages: AiUiAttachment[];
	buildRetryPlan(
		entry: AiHistoryEntry,
		options: {
			isLoading?: boolean;
			isBestiary?: boolean;
			historyCampaign?: string;
		},
	): AiHistoryRetryPlan | null;
	contextConfig: AiGenerationRequestInput["contextConfig"];
	currentLanguage: string;
	deleteAiResponse: ExecuteAiHistoryRetryOptions["deleteAiResponse"];
	generateAi: ExecuteAiGenerationOptions["generateAi"];
	generateCharacters: boolean;
	generateCustomMonsters: boolean;
	generateEncounters: boolean;
	generateLocations: boolean;
	generateNpcs: boolean;
	handleGeneratedAiData(input: GeneratedAiDataInput): void;
	historyCampaign: string;
	initialRoute: AiGenerationRequestInput["initialRoute"];
	isBestiary: boolean;
	isCampaign: boolean;
	isContextLoading: boolean;
	isEncounter: boolean;
	onApiKeyMissing(): void;
	onError(message: string): void;
	parseAIResponse: boolean;
	refreshResponseHistoryStats(): void;
	selectedResponseId: AiHistoryEntry["id"] | null;
	selectedModel: string;
	setResponseHistory(entries: AiHistoryEntry[]): void;
	showMessage(copy: { title: string; message: string }): void;
	closeGeneratedPrompt(): void;
	upsertResponseHistoryEntry(entry: AiHistoryEntry): void;
	useContext: boolean;
	userInstructions: string;
}

export function useAiAssistantGeneration({
	attachedFiles,
	attachedImages,
	buildRetryPlan,
	contextConfig,
	currentLanguage,
	deleteAiResponse,
	generateAi,
	generateCharacters,
	generateCustomMonsters,
	generateEncounters,
	generateLocations,
	generateNpcs,
	handleGeneratedAiData,
	historyCampaign,
	initialRoute,
	isBestiary,
	isCampaign,
	isContextLoading,
	isEncounter,
	onApiKeyMissing,
	onError,
	parseAIResponse,
	refreshResponseHistoryStats,
	selectedResponseId,
	selectedModel,
	setResponseHistory,
	showMessage,
	closeGeneratedPrompt,
	upsertResponseHistoryEntry,
	useContext,
	userInstructions,
}: UseAiAssistantGenerationOptions) {
	const [generationLifecycle, dispatchGenerationLifecycle] = useReducer(
		aiGenerationLifecycleReducer,
		initialAiGenerationLifecycle,
	);
	const activeGenerateControllerRef = useRef<AbortController | null>(null);
	const nextGenerationRequestIdRef = useRef(0);
	const [canCancelGenerate, setCanCancelGenerate] = useState(false);
	const loading =
		isContextLoading || isAiGenerationPending(generationLifecycle);

	const cancelGenerateRequest = () => {
		activeGenerateControllerRef.current?.abort();
		activeGenerateControllerRef.current = null;
		setCanCancelGenerate(false);
	};

	const generate = async (
		type: string | null = null,
		targetSceneId: string | number | null = null,
		{
			forceParseAIResponse = null,
			imageTarget = null,
			imagePromptBasePromptOverride = undefined,
			userInstructionsOverride = null,
		}: GenerateOptions = {},
	): Promise<void> => {
		const { requestType, shouldParseResponse, payload } =
			buildAiGenerationRequest({
				type,
				isBestiary,
				isEncounter,
				isCampaign,
				forceParseAIResponse,
				parseAIResponse,
				selectedModel,
				userInstructions,
				userInstructionsOverride,
				initialRoute,
				targetSceneId,
				imageTarget,
				attachedImages,
				attachedFiles,
				imagePromptBasePromptOverride,
				generateCharacters,
				generateNpcs,
				generateLocations,
				generateEncounters,
				generateCustomMonsters,
				useContext,
				contextConfig,
				currentLanguage,
			});
		cancelGenerateRequest();
		const controller = new AbortController();
		const requestId = (nextGenerationRequestIdRef.current += 1);
		activeGenerateControllerRef.current = controller;
		setCanCancelGenerate(true);
		dispatchGenerationLifecycle({ type: "start-generation", requestId });
		onError("");

		try {
			await executeAiGeneration({
				payload,
				signal: controller.signal,
				generateAi,
				onSucceeded: (data) => {
					handleGeneratedAiData({
						data,
						requestType,
						shouldParseResponse,
					});
					dispatchGenerationLifecycle({ type: "succeed", requestId });
				},
				onCancelled: () => {
					dispatchGenerationLifecycle({ type: "cancel", requestId });
				},
				onFailedHistoryEntry: upsertResponseHistoryEntry,
				onApiKeyMissing: () => {
					dispatchGenerationLifecycle({ type: "fail", requestId });
					onApiKeyMissing();
					onError("");
				},
				onFailed: (failure) => {
					dispatchGenerationLifecycle({ type: "fail", requestId });
					onError(failure.message || lang.t("Failed to connect to AI."));
					showMessage({
						title: lang.t("AI error"),
						message: formatAiGenerationFailureAlert(
							failure,
							lang.t("Status"),
						),
					});
				},
			});
		} finally {
			if (activeGenerateControllerRef.current === controller) {
				activeGenerateControllerRef.current = null;
				setCanCancelGenerate(false);
			}
		}
	};

	const retryResponseHistoryEntry = async (
		entry: AiHistoryEntry,
	): Promise<void> => {
		const plan = buildRetryPlan(entry, {
			isLoading: loading,
			isBestiary,
			historyCampaign,
		});
		if (!plan) return;

		cancelGenerateRequest();
		const controller = new AbortController();
		const requestId = (nextGenerationRequestIdRef.current += 1);
		activeGenerateControllerRef.current = controller;
		setCanCancelGenerate(true);
		dispatchGenerationLifecycle({ type: "start-retry", requestId });
		onError("");

		try {
			await executeAiHistoryRetry({
				plan,
				signal: controller.signal,
				deleteAiResponse,
				generateAi,
				onFailedEntryDeleted: (responses) => {
					setResponseHistory(responses);
					refreshResponseHistoryStats();
					if (selectedResponseId === entry.id) {
						closeGeneratedPrompt();
					}
				},
				onSucceeded: (data) => {
					handleGeneratedAiData({
						data,
						requestType: plan.requestType,
						shouldParseResponse: plan.shouldParseResponse,
						clearPromptOnApplied: false,
					});
					dispatchGenerationLifecycle({ type: "succeed", requestId });
				},
				onCancelled: () => {
					dispatchGenerationLifecycle({ type: "cancel", requestId });
				},
				onFailed: (error) => {
					const failure = getAiHistoryRetryFailure(error, lang.t("Status"));
					dispatchGenerationLifecycle({ type: "fail", requestId });
					if (failure.historyEntry) {
						upsertResponseHistoryEntry(failure.historyEntry);
					}
					onError(failure.message || lang.t("Failed to connect to AI."));
					showMessage({
						title: lang.t("AI error"),
						message: failure.alertMessage,
					});
				},
			});
		} finally {
			if (activeGenerateControllerRef.current === controller) {
				activeGenerateControllerRef.current = null;
				setCanCancelGenerate(false);
			}
		}
	};

	return {
		canCancelGenerate,
		cancelGenerateRequest,
		generate,
		isGenerationPending: isAiGenerationPending(generationLifecycle),
		retryResponseHistoryEntry,
	};
}
