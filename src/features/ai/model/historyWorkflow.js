export function getHistoryChangeResources(entry) {
	return Array.isArray(entry?.changes?.resources)
		? entry.changes.resources
		: [];
}

export function getHistoryChangedEntityTypes(entry) {
	return [
		...new Set(
			getHistoryChangeResources(entry)
				.filter((resource) => resource?.kind === "entity" && resource.type)
				.map((resource) => resource.type),
		),
	];
}

export function getGeneratedEntityTypes(generated, historyEntry = null) {
	const types = [];
	if (Array.isArray(generated?.characters)) types.push("characters");
	if (Array.isArray(generated?.npcs)) types.push("npc");
	if (Array.isArray(generated?.locations)) types.push("locations");
	if (types.length > 0) return types;
	return historyEntry ? getHistoryChangedEntityTypes(historyEntry) : [];
}

export function hasGeneratedCampaignChanges(generated, historyEntry = null) {
	const operations = Array.isArray(generated?.operations)
		? generated.operations
		: [];
	if (
		operations.some(
			(operation) =>
				operation?.entity === "campaign" ||
				operation?.scope === "campaign" ||
				operation?.to === "campaign" ||
				operation?.from === "campaign",
		)
	) {
		return true;
	}
	return getHistoryChangeResources(historyEntry).some(
		(resource) => resource?.kind === "campaign",
	);
}

export function hasHistoryChanges(entry) {
	return getHistoryChangeResources(entry).length > 0;
}

export function isFailedHistoryEntry(entry) {
	return entry?.status === "failed";
}

export function isNonParsedHistoryEntry(entry) {
	return entry?.request?.options?.responseParsing === false;
}

export function buildRetryPayloadFromHistoryEntry(entry, getRequestText) {
	if (entry?.retryPayload && typeof entry.retryPayload === "object") {
		return entry.retryPayload;
	}
	if (!isNonParsedHistoryEntry(entry)) return null;

	const options = entry?.request?.options || {};
	const path = entry?.path || {};
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

export function createAiHistoryWorkflow(getRequestText) {
	if (typeof getRequestText !== "function") {
		throw new TypeError("getRequestText must be a function");
	}
	const buildRetryPayload = (entry) =>
		buildRetryPayloadFromHistoryEntry(entry, getRequestText);
	return {
		buildRetryPayloadFromHistoryEntry: buildRetryPayload,
		canRetryHistoryEntry(entry) {
			if (isFailedHistoryEntry(entry)) return Boolean(entry?.retryPayload);
			if (isNonParsedHistoryEntry(entry)) return Boolean(buildRetryPayload(entry));
			return false;
		},
	};
}
