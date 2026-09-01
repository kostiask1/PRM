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
const RESPONSE_LANGUAGE_ALIASES = new Map([
	["uk", "Ukrainian"],
	["ua", "Ukrainian"],
	["ukrainian", "Ukrainian"],
	["en", "English"],
	["english", "English"],
]);

function normalizeResponseLanguage(language) {
	const code = String(language || "").trim().toLowerCase();
	if (!code) throw new Error("language is required");
	return { code, label: RESPONSE_LANGUAGE_ALIASES.get(code) || code };
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

function isGenerationEnabled(value) {
	return value !== false;
}

function resolveGenerationFlags({
	generateCharacters,
	generateNpcs,
	generateLocations,
	generateEncounters,
	generateCustomMonsters,
}) {
	const encounterGenerationEnabled = Boolean(generateEncounters);
	return {
		characterGenerationEnabled: isGenerationEnabled(generateCharacters),
		customMonsterGenerationEnabled:
			encounterGenerationEnabled && Boolean(generateCustomMonsters),
		encounterGenerationEnabled,
		locationGenerationEnabled: isGenerationEnabled(generateLocations),
		npcGenerationEnabled: isGenerationEnabled(generateNpcs),
	};
}

function canUseSessionEntityScope(session, encounterId, entityScope) {
	return session && !encounterId && entityScope !== "campaign";
}

function resolveEntityTargetScope(session, encounterId, entityScope) {
	if (!canUseSessionEntityScope(session, encounterId, entityScope)) {
		return "campaign";
	}
	return entityScope === "session" ? "session" : "mixed";
}

function canParseAiResponse(parseAIResponse, encounterId, encounterEnabled) {
	return Boolean(parseAIResponse) && (!encounterId || encounterEnabled);
}

function resolveEffectiveParsing(
	type,
	parseAIResponse,
	encounterId,
	encounterEnabled,
) {
	return (
		type === "custom-monster" ||
		canParseAiResponse(parseAIResponse, encounterId, encounterEnabled)
	);
}

function resolveRequestedType(type, encounterGenerationEnabled) {
	return type === "encounter" && !encounterGenerationEnabled ? null : type;
}

function resolveRouteUseKey(encounterId, session) {
	if (encounterId) return "encounter";
	if (session) return "scene";
	return "campaign";
}

function resolveParsedUseKey(requestedType, encounterId, session) {
	return SUPPORTED_REQUEST_TYPES.has(requestedType)
		? requestedType
		: resolveRouteUseKey(encounterId, session);
}

function resolveUseKey(
	requestedType,
	effectiveParseAIResponse,
	encounterId,
	session,
) {
	if (requestedType === "image") return "image";
	return effectiveParseAIResponse
		? resolveParsedUseKey(requestedType, encounterId, session)
		: "prompt";
}

function usesStructuredJsonContract(effectiveParseAIResponse, useKey) {
	return effectiveParseAIResponse && STRUCTURED_REQUEST_TYPES.has(useKey);
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
	const generationFlags = resolveGenerationFlags({
		generateCharacters,
		generateNpcs,
		generateLocations,
		generateEncounters,
		generateCustomMonsters,
	});
	const entityTargetScope = resolveEntityTargetScope(
		session,
		encounterId,
		entityScope,
	);
	const effectiveParseAIResponse = resolveEffectiveParsing(
		type,
		parseAIResponse,
		encounterId,
		generationFlags.encounterGenerationEnabled,
	);
	const requestedType = resolveRequestedType(
		type,
		generationFlags.encounterGenerationEnabled,
	);
	const useKey = resolveUseKey(
		requestedType,
		effectiveParseAIResponse,
		encounterId,
		session,
	);
	return {
		characterGenerationEnabled: generationFlags.characterGenerationEnabled,
		customMonsterGenerationEnabled:
			generationFlags.customMonsterGenerationEnabled,
		effectiveParseAIResponse,
		encounterGenerationEnabled: generationFlags.encounterGenerationEnabled,
		entityTargetScope,
		locationGenerationEnabled: generationFlags.locationGenerationEnabled,
		npcGenerationEnabled: generationFlags.npcGenerationEnabled,
		responseLanguage,
		simplifiedNotesEnabled,
		useKey,
		usesStructuredJsonContract: usesStructuredJsonContract(
			effectiveParseAIResponse,
			useKey,
		),
	};
}

module.exports = {
	normalizeModelName,
	normalizeResponseLanguage,
	resolveAiRequest,
	selectAiModel,
};
