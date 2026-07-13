const SUPPORTED_REQUEST_TYPES = new Set([
	"campaign",
	"scene",
	"encounter",
	"character",
	"npc",
	"location",
	"custom-monster",
]);

const STRUCTURED_REQUEST_TYPES = new Set(SUPPORTED_REQUEST_TYPES);

function normalizeResponseLanguage(language) {
	const code = String(language || "").trim().toLowerCase();
	if (!code) throw new Error("language is required");
	const aliases = {
		uk: "Ukrainian",
		ua: "Ukrainian",
		ukrainian: "Ukrainian",
		en: "English",
		english: "English",
	};
	return { code, label: aliases[code] || code };
}

function normalizeModelName(name) {
	return String(name || "").replace(/^models\//, "").trim();
}

function selectAiModel(availableModels, requestedName) {
	const requestedModel = normalizeModelName(requestedName);
	return availableModels.models.some((item) => item.name === requestedModel)
		? requestedModel
		: availableModels.defaultModel;
}

function resolveAiRequest({
	type,
	session,
	encounterId,
	parseAIResponse,
	generateCharacters,
	generateNpcs,
	generateLocations,
	generateEncounters,
	generateCustomMonsters,
	entityScope,
	language,
	simplifiedNotes,
}) {
	const responseLanguage = normalizeResponseLanguage(language);
	const simplifiedNotesEnabled = Boolean(simplifiedNotes);
	const encounterGenerationEnabled = Boolean(generateEncounters);
	const customMonsterGenerationEnabled =
		encounterGenerationEnabled && Boolean(generateCustomMonsters);
	const characterGenerationEnabled = generateCharacters !== false;
	const npcGenerationEnabled = generateNpcs !== false;
	const locationGenerationEnabled = generateLocations !== false;
	const entityTargetScope =
		session && !encounterId && entityScope !== "campaign"
			? entityScope === "session"
				? "session"
				: "mixed"
			: "campaign";
	const effectiveParseAIResponse =
		type === "custom-monster" ||
		(Boolean(parseAIResponse) && (!encounterId || encounterGenerationEnabled));
	const requestedType =
		type === "encounter" && !encounterGenerationEnabled ? null : type;
	const useKey =
		requestedType === "image"
			? "image"
			: !effectiveParseAIResponse
				? "prompt"
				: requestedType && SUPPORTED_REQUEST_TYPES.has(requestedType)
					? requestedType
					: encounterId
						? "encounter"
						: session
							? "scene"
							: "campaign";
	return {
		characterGenerationEnabled,
		customMonsterGenerationEnabled,
		effectiveParseAIResponse,
		encounterGenerationEnabled,
		entityTargetScope,
		locationGenerationEnabled,
		npcGenerationEnabled,
		responseLanguage,
		simplifiedNotesEnabled,
		useKey,
		usesStructuredJsonContract:
			effectiveParseAIResponse && STRUCTURED_REQUEST_TYPES.has(useKey),
	};
}

module.exports = {
	normalizeModelName,
	normalizeResponseLanguage,
	resolveAiRequest,
	selectAiModel,
};
