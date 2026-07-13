import type {
	AiGenerationPayload,
	AiHistoryEntry,
	AiHistoryResource,
} from "../api/aiApi.ts";
import type { AiGeneratedContent } from "./operationContracts.ts";

type GeneratedContent = AiGeneratedContent | null | undefined;

export function getHistoryChangeResources(
	entry: AiHistoryEntry | null | undefined,
): AiHistoryResource[] {
	return Array.isArray(entry?.changes?.resources)
		? entry.changes.resources
		: [];
}

export function getHistoryChangedEntityTypes(
	entry: AiHistoryEntry | null | undefined,
): string[] {
	return [
		...new Set(
			getHistoryChangeResources(entry)
				.filter((resource) => resource.kind === "entity" && resource.type)
				.map((resource) => resource.type as string),
		),
	];
}

export function getGeneratedEntityTypes(
	generated: GeneratedContent,
	historyEntry: AiHistoryEntry | null = null,
): string[] {
	const types: string[] = [];
	if (Array.isArray(generated?.characters)) types.push("characters");
	if (Array.isArray(generated?.npcs)) types.push("npc");
	if (Array.isArray(generated?.locations)) types.push("locations");
	return types.length > 0 ? types : getHistoryChangedEntityTypes(historyEntry);
}

export function hasGeneratedCampaignChanges(
	generated: GeneratedContent,
	historyEntry: AiHistoryEntry | null = null,
): boolean {
	const operations = generated?.operations || [];
	if (
		operations.some(
			(operation) =>
				operation.entity === "campaign" ||
				operation.scope === "campaign" ||
				(operation.op === "moveScope" &&
					(operation.to === "campaign" || operation.from === "campaign")),
		)
	) {
		return true;
	}
	return getHistoryChangeResources(historyEntry).some(
		(resource) => resource.kind === "campaign",
	);
}

export function hasHistoryChanges(entry: AiHistoryEntry | null | undefined) {
	return getHistoryChangeResources(entry).length > 0;
}

export function isFailedHistoryEntry(entry: AiHistoryEntry | null | undefined) {
	return entry?.status === "failed";
}

export function isNonParsedHistoryEntry(entry: AiHistoryEntry | null | undefined) {
	return entry?.request?.options?.responseParsing === false;
}

export function buildRetryPayloadFromHistoryEntry(
	entry: AiHistoryEntry | null | undefined,
	getRequestText: (entry: AiHistoryEntry) => string,
): AiGenerationPayload | null {
	if (entry?.retryPayload && typeof entry.retryPayload === "object") {
		return entry.retryPayload;
	}
	if (!entry || !isNonParsedHistoryEntry(entry)) return null;

	const options = entry.request?.options || {};
	const path = entry.path || {};
	if (!path.campaign) return null;

	return {
		type: entry.type || options.mode || null,
		modelName: entry.modelName || options.modelName || undefined,
		userInstructions: getRequestText(entry),
		path,
		sceneId: options.sceneId || undefined,
		imageTarget: options.imageTarget || undefined,
		parseAIResponse: false,
		generateCharacters: Boolean(options.characterGeneration),
		generateNpcs: Boolean(options.npcGeneration),
		generateLocations: Boolean(options.locationGeneration),
		generateEncounters: false,
		generateCustomMonsters: false,
		contextConfig: null,
		language: entry.language || undefined,
	};
}

export function createAiHistoryWorkflow(
	getRequestText: (entry: AiHistoryEntry) => string,
) {
	if (typeof getRequestText !== "function") {
		throw new TypeError("getRequestText must be a function");
	}
	const buildRetryPayload = (entry: AiHistoryEntry) =>
		buildRetryPayloadFromHistoryEntry(entry, getRequestText);
	return {
		buildRetryPayloadFromHistoryEntry: buildRetryPayload,
		canRetryHistoryEntry(entry: AiHistoryEntry) {
			if (isFailedHistoryEntry(entry)) return Boolean(entry.retryPayload);
			if (isNonParsedHistoryEntry(entry)) return Boolean(buildRetryPayload(entry));
			return false;
		},
	};
}
