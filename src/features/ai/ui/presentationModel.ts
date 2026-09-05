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
	showEncounterCreatureEditing: boolean;
	showParsedGenerationOptions: boolean;
}

export interface AiEntityGenerationActionsView {
	showActions: boolean;
	showCharacterAction: boolean;
}

export interface AiEncounterGenerationActionsView {
	encounterTitleKind: "current" | "scenes";
	showActions: boolean;
	showCreateCustomCreatureAction: boolean;
	showCustomMonsterAction: boolean;
	showEncounterAction: boolean;
}

export function getAiToolbarVisibility({
	isBestiary,
	isCampaign,
	isEncounter,
	parseAIResponse,
}: {
	isBestiary: boolean;
	isCampaign: boolean;
	isEncounter: boolean;
	parseAIResponse: boolean;
}): AiToolbarVisibility {
	const showParsedGenerationOptions = !isBestiary && parseAIResponse;
	return {
		showParsedGenerationOptions,
		showCharacterGeneration: showParsedGenerationOptions && isCampaign,
		showEncounterCreatureEditing: Boolean(
			showParsedGenerationOptions && isEncounter,
		),
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

export interface AiResponseHistoryRowView {
	changeSummary: string;
	dateLabel: string;
	showRetry: boolean;
	stateLabel: string;
	title: string;
}

export function getAiResponseHistoryRowView<
	TEntry extends { createdAt?: string },
>({
	canRetry,
	currentLanguage,
	entry,
	fallbackTitle,
	formatResponseDate,
	getStateLabel,
	getSummary,
	getTitle,
}: {
	canRetry?: (entry: TEntry) => boolean;
	currentLanguage?: string;
	entry: TEntry;
	fallbackTitle: string;
	formatResponseDate: (createdAt?: string, language?: string) => string;
	getStateLabel: (entry: TEntry) => string;
	getSummary: (entry: TEntry) => string;
	getTitle: (entry: TEntry) => string;
}): AiResponseHistoryRowView {
	return {
		changeSummary: getSummary(entry),
		dateLabel: formatResponseDate(entry.createdAt, currentLanguage),
		showRetry: Boolean(canRetry?.(entry)),
		stateLabel: getStateLabel(entry),
		title: getTitle(entry) || fallbackTitle,
	};
}

export function getAiEntityGenerationActionsView({
	isEncounter,
	showCharacterGeneration,
	showParsedGenerationOptions,
}: {
	isEncounter: boolean;
	showCharacterGeneration: boolean;
	showParsedGenerationOptions: boolean;
}): AiEntityGenerationActionsView {
	const showActions = showParsedGenerationOptions && !isEncounter;
	return {
		showActions,
		showCharacterAction: showActions && showCharacterGeneration,
	};
}

export function getAiEncounterGenerationActionsView({
	isCampaign,
	isCustomMonsterGenerationVisible,
	isEncounter,
	showParsedGenerationOptions,
}: {
	isCampaign: boolean;
	isCustomMonsterGenerationVisible: boolean;
	isEncounter: boolean;
	showParsedGenerationOptions: boolean;
}): AiEncounterGenerationActionsView {
	return {
		encounterTitleKind: isEncounter ? "current" : "scenes",
		showActions: showParsedGenerationOptions,
		showCreateCustomCreatureAction:
			showParsedGenerationOptions && isEncounter,
		showCustomMonsterAction:
			showParsedGenerationOptions && isCustomMonsterGenerationVisible,
		showEncounterAction: showParsedGenerationOptions && !isCampaign,
	};
}

export function getAvailableAiAttachmentSlots(
	currentCount: number,
	maximum: number,
): number {
	return Math.max(0, maximum - currentCount);
}

export interface AiAttachmentControlsView {
	fileActionDisabled: boolean;
	gallerySource: string;
	showImageActions: boolean;
}

export function getAiAttachmentControlsView({
	attachedFileCount,
	attachedImageCount,
	campaignSlug,
	disabled,
	maximum,
}: {
	attachedFileCount: number;
	attachedImageCount: number;
	campaignSlug?: string | null;
	disabled: boolean;
	maximum: number;
}): AiAttachmentControlsView {
	return {
		fileActionDisabled: disabled || attachedFileCount >= maximum,
		gallerySource: campaignSlug || "general",
		showImageActions: attachedImageCount < maximum,
	};
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
