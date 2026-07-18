import type { AiTokenEstimate } from "../model/tokenEstimation.ts";
import type {
	AiContextDataConfig,
	AiSessionSceneContextConfig,
	AiSessionContextConfig,
} from "../model/useAiContextData.ts";
import type { AiUiAttachment } from "./types.ts";

export interface AiPromptTokenVisibility {
	showFileTokens: boolean;
	showImageTokens: boolean;
}

export interface AiToolbarVisibility {
	showCharacterGeneration: boolean;
	showParsedGenerationOptions: boolean;
}

export function getAiToolbarVisibility({
	isBestiary,
	isCampaign,
	parseAIResponse,
}: {
	isBestiary: boolean;
	isCampaign: boolean;
	parseAIResponse: boolean;
}): AiToolbarVisibility {
	const showParsedGenerationOptions = !isBestiary && parseAIResponse;
	return {
		showParsedGenerationOptions,
		showCharacterGeneration: showParsedGenerationOptions && isCampaign,
	};
}

export interface AiEncounterGenerationTogglePlan {
	generateCustomMonsters: boolean | null;
	generateEncounters: boolean;
}

export function getAiEncounterGenerationTogglePlan(
	generateEncounters: boolean,
): AiEncounterGenerationTogglePlan {
	const enabled = !generateEncounters;
	return {
		generateEncounters: enabled,
		generateCustomMonsters: enabled ? null : false,
	};
}

export function isAiApiKeySaveDisabled(
	apiKeyInput: string,
	isSavingApiKey: boolean,
	isLoading: boolean,
): boolean {
	return isSavingApiKey || isLoading || !apiKeyInput.trim();
}

export function shouldSubmitAiApiKey(key: string): boolean {
	return key === "Enter";
}

export function getAiPromptTokenVisibility(
	estimate: Pick<AiTokenEstimate, "fileTokens" | "imageTokens">,
): AiPromptTokenVisibility {
	return {
		showFileTokens: estimate.fileTokens > 0,
		showImageTokens: estimate.imageTokens > 0,
	};
}

export function hasAiResponseHistory<T>(
	entries: T[] | null | undefined,
): entries is T[] {
	return Array.isArray(entries) && entries.length > 0;
}

export function getAvailableAiAttachmentSlots(
	currentCount: number,
	maximum: number,
): number {
	return Math.max(0, maximum - currentCount);
}

export function mergeUniqueAiAttachments(
	current: AiUiAttachment[],
	incoming: AiUiAttachment[],
	getKey: (attachment: AiUiAttachment) => string,
	maximum: number,
): AiUiAttachment[] {
	const existing = new Set(current.map(getKey));
	const uniqueIncoming = incoming.filter((attachment) => {
		const key = getKey(attachment);
		if (existing.has(key)) return false;
		existing.add(key);
		return true;
	});
	return [...current, ...uniqueIncoming].slice(0, maximum);
}

export function removeAiAttachmentAt(
	attachments: AiUiAttachment[],
	indexToRemove: number,
): AiUiAttachment[] {
	return attachments.filter((_, index) => index !== indexToRemove);
}

export function shouldReportAiAttachmentSelectionError(
	selectedCount: number,
	availableSlots: number,
	skippedCount: number,
): boolean {
	return skippedCount > 0 || selectedCount > availableSlots;
}

export interface PreparedAiAttachmentSelection {
	attachments: AiUiAttachment[];
	skippedNames: string[];
}

export async function prepareAiAttachmentSelection({
	availableSlots,
	files,
	getMimeType,
	includePreview,
	maxBytes,
	readBase64,
}: {
	availableSlots: number;
	files: File[];
	getMimeType: (file: File) => string;
	includePreview: boolean;
	maxBytes: number;
	readBase64: (file: File) => Promise<string>;
}): Promise<PreparedAiAttachmentSelection> {
	const attachments: AiUiAttachment[] = [];
	const skippedNames: string[] = [];
	for (const file of files.slice(0, availableSlots)) {
		const mimeType = getMimeType(file);
		if (!mimeType || file.size > maxBytes) {
			skippedNames.push(file.name);
			continue;
		}
		try {
			const data = await readBase64(file);
			attachments.push({
				name: file.name,
				mimeType,
				sizeBytes: file.size,
				data,
				...(includePreview
					? { previewUrl: `data:${mimeType};base64,${data}` }
					: {}),
			});
		} catch {
			skippedNames.push(file.name);
		}
	}
	return { attachments, skippedNames };
}

export function getAiSessionContextConfig(
	contextConfig: AiContextDataConfig,
	sessionSlug: string,
): AiSessionContextConfig {
	return (
		contextConfig.sessions[sessionSlug] || {
			included: false,
			notes: true,
			result_text: true,
			scenes: {},
		}
	);
}

export function getAiSceneContextConfig(
	config: AiSessionContextConfig,
	sceneId: string,
): AiSessionSceneContextConfig {
	return (
		config.scenes?.[sceneId] || {
			included: true,
			summary: true,
			goal: true,
			stakes: true,
			location: true,
			notes: true,
			encounter: true,
		}
	);
}
