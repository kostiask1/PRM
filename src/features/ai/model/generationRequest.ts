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

export interface AiGenerationRequestPolicy {
	requestType: string | null;
	shouldParseResponse: boolean;
}

export interface AiGenerationRequestOptions {
	generateCharacters: boolean;
	generateNpcs: boolean;
	generateLocations: boolean;
	generateEncounters: boolean;
	generateCustomMonsters: boolean;
}

export interface AiGenerationRequestTarget {
	path: Record<string, unknown>;
	sceneId: string | number | null;
	imageTarget: unknown;
}

export interface AiGenerationRequestAttachments {
	attachedImages: Record<string, unknown>[];
	attachedFiles: Record<string, unknown>[];
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

function resolveAiGenerationRequestType({
	type = null,
	isBestiary = false,
}: AiGenerationRequestInput): string | null {
	return isBestiary && type !== "image" ? "custom-monster" : type;
}

function resolveAiGenerationResponseParsing(
	{
		isBestiary = false,
		forceParseAIResponse = null,
		parseAIResponse = false,
	}: AiGenerationRequestInput,
	requestType: string | null,
): boolean {
	if (requestType === "image") return false;
	if (isBestiary) return true;
	return forceParseAIResponse === null
		? parseAIResponse
		: forceParseAIResponse;
}

export function resolveAiGenerationRequestPolicy(
	input: AiGenerationRequestInput,
): AiGenerationRequestPolicy {
	const requestType = resolveAiGenerationRequestType(input);
	return {
		requestType,
		shouldParseResponse: resolveAiGenerationResponseParsing(input, requestType),
	};
}

function areStructuredEntityOptionsEnabled(
	input: AiGenerationRequestInput,
	policy: AiGenerationRequestPolicy,
): boolean {
	return policy.shouldParseResponse && !input.isEncounter && !input.isBestiary;
}

function shouldGenerateEncounters(
	input: AiGenerationRequestInput,
	policy: AiGenerationRequestPolicy,
): boolean {
	return Boolean(
		policy.requestType !== "image" &&
			policy.shouldParseResponse &&
			!input.isCampaign &&
			!input.isBestiary &&
			input.generateEncounters,
	);
}

export function buildAiGenerationRequestOptions(
	input: AiGenerationRequestInput,
	policy: AiGenerationRequestPolicy,
): AiGenerationRequestOptions {
	const structuredEntityOptionsEnabled = areStructuredEntityOptionsEnabled(
		input,
		policy,
	);
	const generateEncounters = shouldGenerateEncounters(input, policy);
	return {
		generateCharacters: structuredEntityOptionsEnabled
			? Boolean(input.generateCharacters)
			: true,
		generateNpcs: structuredEntityOptionsEnabled
			? Boolean(input.generateNpcs)
			: true,
		generateLocations: structuredEntityOptionsEnabled
			? Boolean(input.generateLocations)
			: true,
		generateEncounters,
		generateCustomMonsters: Boolean(
			generateEncounters && input.generateCustomMonsters,
		),
	};
}

export function getAiGenerationRequestContext(
	{
		isBestiary = false,
		useContext = false,
		contextConfig = null,
	}: AiGenerationRequestInput,
): AiContextConfig | null {
	return !isBestiary && useContext
		? sanitizeAiContextConfig(contextConfig)
		: null;
}

export function buildAiGenerationRequestTarget({
	initialRoute,
	targetSceneId = null,
	imageTarget = null,
}: AiGenerationRequestInput): AiGenerationRequestTarget {
	return {
		path: initialRoute,
		sceneId: targetSceneId,
		imageTarget,
	};
}

export function buildAiGenerationRequestAttachments({
	attachedImages = [],
	attachedFiles = [],
}: AiGenerationRequestInput): AiGenerationRequestAttachments {
	return { attachedImages, attachedFiles };
}

function getAiGenerationInstructions({
	userInstructions = "",
	userInstructionsOverride = null,
}: AiGenerationRequestInput): string {
	return userInstructionsOverride === null
		? userInstructions
		: userInstructionsOverride;
}

export function buildAiGenerationRequest(
	input: AiGenerationRequestInput,
): BuiltAiGenerationRequest {
	const policy = resolveAiGenerationRequestPolicy(input);
	const target = buildAiGenerationRequestTarget(input);
	const attachments = buildAiGenerationRequestAttachments(input);
	return {
		...policy,
		payload: {
			type: policy.requestType,
			modelName: input.selectedModel || undefined,
			userInstructions: getAiGenerationInstructions(input),
			...target,
			...attachments,
			imagePromptBasePromptOverride: input.imagePromptBasePromptOverride,
			parseAIResponse: policy.shouldParseResponse,
			...buildAiGenerationRequestOptions(input, policy),
			contextConfig: getAiGenerationRequestContext(input),
			language: input.currentLanguage,
		},
	};
}
