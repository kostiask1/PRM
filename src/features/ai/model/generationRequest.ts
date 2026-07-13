import type { AiGenerationPayload } from "../api/aiApi.ts";

export interface AiContextConfig extends Record<string, unknown> {
	sessions?: Record<string, Record<string, unknown>>;
}

export interface AiGenerationRequestInput {
	type?: string | null;
	isBestiary?: boolean;
	isEncounter?: boolean;
	isCampaign?: boolean;
	forceParseAIResponse?: boolean | null;
	parseAIResponse?: boolean;
	selectedModel?: string;
	userInstructions?: string;
	userInstructionsOverride?: string | null;
	initialRoute: Record<string, unknown>;
	targetSceneId?: string | number | null;
	imageTarget?: unknown;
	attachedImages?: Record<string, unknown>[];
	attachedFiles?: Record<string, unknown>[];
	imagePromptBasePromptOverride?: string;
	generateCharacters?: boolean;
	generateNpcs?: boolean;
	generateLocations?: boolean;
	generateEncounters?: boolean;
	generateCustomMonsters?: boolean;
	useContext?: boolean;
	contextConfig?: AiContextConfig | null;
	currentLanguage?: string;
}

export interface BuiltAiGenerationRequest {
	requestType: string | null;
	shouldParseResponse: boolean;
	payload: AiGenerationPayload;
}

export function sanitizeAiContextConfig(
	contextConfig: AiContextConfig | null | undefined,
): AiContextConfig | null {
	if (!contextConfig) return null;
	const sanitized = JSON.parse(JSON.stringify(contextConfig)) as AiContextConfig;
	if (sanitized.sessions) {
		for (const session of Object.values(sanitized.sessions)) {
			if (session && typeof session === "object") delete session.data;
		}
	}
	return sanitized;
}

export function buildAiGenerationRequest({
	type = null,
	isBestiary = false,
	isEncounter = false,
	isCampaign = false,
	forceParseAIResponse = null,
	parseAIResponse = false,
	selectedModel = "",
	userInstructions = "",
	userInstructionsOverride = null,
	initialRoute,
	targetSceneId = null,
	imageTarget = null,
	attachedImages = [],
	attachedFiles = [],
	imagePromptBasePromptOverride,
	generateCharacters = false,
	generateNpcs = false,
	generateLocations = false,
	generateEncounters = false,
	generateCustomMonsters = false,
	useContext = false,
	contextConfig = null,
	currentLanguage,
}: AiGenerationRequestInput): BuiltAiGenerationRequest {
	const requestType = isBestiary && type !== "image" ? "custom-monster" : type;
	const shouldParseResponse =
		requestType === "image"
			? false
			: isBestiary
				? true
				: forceParseAIResponse === null
					? parseAIResponse
					: forceParseAIResponse;
	const structuredEntityOptionsEnabled =
		shouldParseResponse && !isEncounter && !isBestiary;

	return {
		requestType,
		shouldParseResponse,
		payload: {
			type: requestType,
			modelName: selectedModel || undefined,
			userInstructions:
				userInstructionsOverride === null
					? userInstructions
					: userInstructionsOverride,
			path: initialRoute,
			sceneId: targetSceneId,
			imageTarget,
			attachedImages,
			attachedFiles,
			imagePromptBasePromptOverride,
			parseAIResponse: shouldParseResponse,
			generateCharacters: structuredEntityOptionsEnabled
				? generateCharacters
				: true,
			generateNpcs: structuredEntityOptionsEnabled ? generateNpcs : true,
			generateLocations: structuredEntityOptionsEnabled
				? generateLocations
				: true,
			generateEncounters:
				requestType === "image"
					? false
					: shouldParseResponse &&
						!isCampaign &&
						!isBestiary &&
						generateEncounters,
			generateCustomMonsters:
				requestType !== "image" &&
				shouldParseResponse &&
				!isCampaign &&
				!isBestiary &&
				generateEncounters &&
				generateCustomMonsters,
			contextConfig:
				!isBestiary && useContext
					? sanitizeAiContextConfig(contextConfig)
					: null,
			language: currentLanguage,
		},
	};
}
