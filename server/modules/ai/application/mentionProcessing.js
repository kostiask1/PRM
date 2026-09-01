const { asText } = require("../../../ai/AiHistoryWriter");
const {
	getCharacterDisplayName,
	getLocationDisplayName,
} = require("../../../ai/entityDisplayUtils");

function escapeRegExp(value) {
	return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeMentionCandidates(names = []) {
	return Array.from(
		new Set(
			names.map((name) => asText(name)).filter((name) => name.length >= 2),
		),
	).sort((a, b) => b.length - a.length);
}

function wrapMentionsInText(text, names) {
	if (!text || !names.length) return text;
	let output = String(text);

	for (const name of names) {
		const pattern = new RegExp(
			`(?<![\\p{L}\\p{N}_\\[])${escapeRegExp(name)}(?![\\p{L}\\p{N}_\\]])`,
			"giu",
		);
		output = output.replace(pattern, (match, offset, source) => {
			const before = source[offset - 1];
			const after = source[offset + match.length];
			if (before === "[" && after === "]") return match;
			return `[${match}]`;
		});
	}

	return output;
}

function collapseNestedMentionBrackets(text) {
	if (!isNonEmptyString(text)) return text;
	let output = text;

	// Collapse repeated opening/closing mention brackets: [[Name]] -> [Name]
	for (let i = 0; i < 5; i += 1) {
		const next = output.replace(/\[\s*\[+/g, "[").replace(/\]+\s*\]/g, "]");
		if (next === output) break;
		output = next;
	}

	return output;
}

function isNonEmptyString(value) {
	return typeof value === "string" && Boolean(value);
}

function normalizeNameForMatch(value) {
	return String(value || "")
		.toLowerCase()
		.replace(/[`'\u2019]/g, "")
		.replace(/[^\p{L}\p{N}\s-]+/gu, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function resolveCanonicalName(rawName, canonicalNames) {
	const raw = asText(rawName);
	if (!raw || !canonicalNames.length) return null;

	const exact = canonicalNames.find(
		(name) => normalizeNameForMatch(name) === normalizeNameForMatch(raw),
	);
	if (exact) return exact;

	return null;
}

function canonicalizeBracketedMentions(text, names) {
	if (!text || !names.length) return text;
	return String(text).replace(/\[([^[\]]+)\]/g, (full, rawName) => {
		const canonical = resolveCanonicalName(rawName, names);
		return canonical ? `[${canonical}]` : full;
	});
}

function processGeneratedTextMentions(text, names) {
	if (typeof text !== "string") return text;
	const wrapped = wrapMentionsInText(text, names);
	const canonicalized = canonicalizeBracketedMentions(wrapped, names);
	return collapseNestedMentionBrackets(canonicalized);
}

const AI_OPERATION_TEXT_KEYS = new Set([
	"description",
	"motivation",
	"trait",
	"summary",
	"goal",
	"stakes",
	"location",
	"text",
	"content",
]);

const AI_OPERATION_IDENTIFIER_KEYS = new Set([
	"id",
	"slug",
	"clientId",
	"targetClientId",
	"ownerClientId",
	"targetId",
	"noteId",
	"name",
	"title",
	"firstName",
	"first_name",
	"lastName",
	"last_name",
	"monsterName",
	"source",
	"type",
	"entity",
	"op",
	"scope",
	"from",
	"to",
	"targetScope",
]);

function processOperationTextMentions(value, names, key = "") {
	if (typeof value === "string") return processOperationStringMention(value, names, key);
	if (Array.isArray(value)) {
		return value.map((item) => processOperationTextMentions(item, names, key));
	}
	return processOperationObjectMentions(value, names);
}

function processOperationStringMention(value, names, key) {
	if (AI_OPERATION_IDENTIFIER_KEYS.has(key)) return value;
	if (!AI_OPERATION_TEXT_KEYS.has(key)) return value;
	return processGeneratedTextMentions(value, names);
}

function processOperationObjectMentions(value, names) {
	const record = asOptionalRecord(value);
	if (!record) return value;
	return Object.fromEntries(
		Object.entries(record).map(([entryKey, entryValue]) => [
			entryKey,
			processOperationTextMentions(entryValue, names, entryKey),
		]),
	);
}

function applyMentionsToGeneratedContent(generatedContent, names) {
	const record = asOptionalRecord(generatedContent);
	if (!record) return generatedContent;
	if (!names.length) return generatedContent;
	applyMentionsToOperations(record, names);
	return generatedContent;
}

function applyMentionsToOperations(generatedContent, names) {
	if (!Array.isArray(generatedContent.operations)) return;
	generatedContent.operations = generatedContent.operations.map((operation) =>
		processOperationTextMentions(operation, names),
	);
}

function collectMentionCandidates(generatedContent, contextData = {}) {
	return normalizeMentionCandidates([
		...collectCampaignContextCandidates(contextData),
		...collectCurrentSessionCandidates(contextData),
		...collectConfiguredSessionCandidates(contextData),
		...collectGeneratedEntityCandidates(generatedContent),
		...collectGeneratedOperationCandidates(generatedContent),
	]);
}

function collectCampaignContextCandidates(contextData) {
	const campaign = asRecord(contextData?.campaign);
	return [
		...mapDisplayNames(campaign.characters, getCharacterDisplayName),
		...mapDisplayNames(campaign.npcs, getCharacterDisplayName),
		...mapDisplayNames(campaign.locations, getLocationDisplayName),
	];
}

function collectCurrentSessionCandidates(contextData) {
	const data = asRecord(asRecord(contextData?.currentSession).data);
	return [
		...mapDisplayNames(data.npcs, getCharacterDisplayName),
		...mapDisplayNames(data.locations, getLocationDisplayName),
		...collectSceneNpcNames(data.scenes),
	];
}

function collectConfiguredSessionCandidates(contextData) {
	return asArray(contextData?.sessions).flatMap(collectConfiguredSessionCandidateNames);
}

function collectConfiguredSessionCandidateNames(sessionContext) {
	const session = asRecord(sessionContext);
	const conf = asRecord(session.conf);
	if (!conf.included) return [];
	const data = asRecord(session.data);
	return [
		...mapDisplayNames(data.npcs, getCharacterDisplayName),
		...mapDisplayNames(data.locations, getLocationDisplayName),
		...collectConfiguredSceneNpcNames(data.scenes, conf.scenes),
	];
}

function collectConfiguredSceneNpcNames(scenes, sceneConfigValue) {
	const sceneConfig = asRecord(sceneConfigValue);
	const hasSceneConfig = Object.keys(sceneConfig).length > 0;
	return asArray(scenes)
		.filter((scene) => isConfiguredSceneIncluded(scene, sceneConfig, hasSceneConfig))
		.flatMap((scene) => collectSceneNpcNames([scene]));
}

function isConfiguredSceneIncluded(scene, sceneConfig, hasSceneConfig) {
	if (!hasSceneConfig) return true;
	const sceneId = asRecord(scene).id;
	return Boolean(asRecord(sceneConfig[sceneId]).included);
}

function collectGeneratedEntityCandidates(generatedContent) {
	const generated = asRecord(generatedContent);
	return [
		...mapDisplayNames(generated.characters, getCharacterDisplayName),
		...mapDisplayNames(generated.npcs, getCharacterDisplayName),
		...mapDisplayNames(generated.locations, getLocationDisplayName),
		...collectSceneNpcNames(generated.scenes),
	];
}

function collectGeneratedOperationCandidates(generatedContent) {
	return asArray(asRecord(generatedContent).operations).flatMap(
		collectGeneratedOperationCandidateNames,
	);
}

function collectGeneratedOperationCandidateNames(operationValue) {
	const operation = asRecord(operationValue);
	const data = getOperationEntityData(operation);
	if (!data) return [];
	return getOperationEntityCandidateNames(asText(operation.entity).toLowerCase(), data);
}

function getOperationEntityData(operation) {
	return asOptionalRecord(operation.data) || asOptionalRecord(operation.patch);
}

const CHARACTER_OPERATION_ENTITIES = new Set([
	"character",
	"characters",
	"npc",
	"npcs",
]);
const LOCATION_OPERATION_ENTITIES = new Set([
	"location",
	"locations",
	"faction",
	"factions",
]);

function getOperationEntityCandidateNames(entity, data) {
	if (CHARACTER_OPERATION_ENTITIES.has(entity)) {
		return [getCharacterDisplayName(data)];
	}
	if (LOCATION_OPERATION_ENTITIES.has(entity)) {
		return [getLocationDisplayName(data)];
	}
	return entity === "scene" ? collectSceneNpcNames([data]) : [];
}

function collectSceneNpcNames(scenes) {
	return asArray(scenes).flatMap((scene) =>
		asArray(asRecord(scene).npcs).map((npc) => asText(asRecord(npc).name)),
	);
}

function mapDisplayNames(value, getDisplayName) {
	return asArray(value).map(getDisplayName);
}

function asArray(value) {
	return Array.isArray(value) ? value : [];
}

function asOptionalRecord(value) {
	return value && typeof value === "object" ? value : null;
}

function asRecord(value) {
	return asOptionalRecord(value) || {};
}

module.exports = {
	applyMentionsToGeneratedContent,
	collectMentionCandidates,
	processGeneratedTextMentions,
};
