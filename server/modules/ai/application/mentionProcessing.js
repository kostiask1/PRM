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
	if (typeof text !== "string" || !text) return text;
	let output = text;

	// Collapse repeated opening/closing mention brackets: [[Name]] -> [Name]
	for (let i = 0; i < 5; i += 1) {
		const next = output.replace(/\[\s*\[+/g, "[").replace(/\]+\s*\]/g, "]");
		if (next === output) break;
		output = next;
	}

	return output;
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
	if (typeof value === "string") {
		if (AI_OPERATION_IDENTIFIER_KEYS.has(key)) return value;
		if (!AI_OPERATION_TEXT_KEYS.has(key)) return value;
		return processGeneratedTextMentions(value, names);
	}
	if (Array.isArray(value)) {
		return value.map((item) => processOperationTextMentions(item, names, key));
	}
	if (!value || typeof value !== "object") return value;
	return Object.fromEntries(
		Object.entries(value).map(([entryKey, entryValue]) => [
			entryKey,
			processOperationTextMentions(entryValue, names, entryKey),
		]),
	);
}

function applyMentionsToGeneratedContent(generatedContent, names) {
	if (
		!generatedContent ||
		typeof generatedContent !== "object" ||
		!names.length
	) {
		return generatedContent;
	}

	if (Array.isArray(generatedContent.operations)) {
		generatedContent.operations = generatedContent.operations.map((operation) =>
			processOperationTextMentions(operation, names),
		);
	}
	return generatedContent;
}

function collectMentionCandidates(generatedContent, contextData = {}) {
	const names = [];
	const campaignContext = contextData?.campaign || {};
	const currentSessionData = contextData?.currentSession?.data || {};

	if (Array.isArray(campaignContext.characters)) {
		names.push(...campaignContext.characters.map(getCharacterDisplayName));
	}
	if (Array.isArray(campaignContext.npcs)) {
		names.push(...campaignContext.npcs.map(getCharacterDisplayName));
	}
	if (Array.isArray(campaignContext.locations)) {
		names.push(...campaignContext.locations.map(getLocationDisplayName));
	}
	if (Array.isArray(currentSessionData.npcs)) {
		names.push(...currentSessionData.npcs.map(getCharacterDisplayName));
	}
	if (Array.isArray(currentSessionData.locations)) {
		names.push(...currentSessionData.locations.map(getLocationDisplayName));
	}
	if (Array.isArray(currentSessionData.scenes)) {
		for (const scene of currentSessionData.scenes) {
			for (const npc of scene?.npcs || []) {
				names.push(asText(npc?.name));
			}
		}
	}

	for (const sessionContext of contextData?.sessions || []) {
		const conf = sessionContext?.conf || {};
		const data = sessionContext?.data || {};
		if (!conf.included) continue;

		if (Array.isArray(data.npcs)) {
			names.push(...data.npcs.map(getCharacterDisplayName));
		}
		if (Array.isArray(data.locations)) {
			names.push(...data.locations.map(getLocationDisplayName));
		}
		if (!Array.isArray(data.scenes)) continue;

		const hasSceneConfig =
			conf.scenes &&
			typeof conf.scenes === "object" &&
			Object.keys(conf.scenes).length > 0;

		for (const scene of data.scenes) {
			if (hasSceneConfig && !conf.scenes[scene.id]?.included) continue;
			for (const npc of scene?.npcs || []) {
				names.push(asText(npc?.name));
			}
		}
	}

	if (Array.isArray(generatedContent?.characters)) {
		for (const character of generatedContent.characters) {
			names.push(getCharacterDisplayName(character));
		}
	}

	if (Array.isArray(generatedContent?.npcs)) {
		for (const npc of generatedContent.npcs) {
			names.push(getCharacterDisplayName(npc));
		}
	}

	if (Array.isArray(generatedContent?.locations)) {
		for (const location of generatedContent.locations) {
			names.push(getLocationDisplayName(location));
		}
	}

	if (Array.isArray(generatedContent?.scenes)) {
		for (const scene of generatedContent.scenes) {
			for (const npc of scene?.npcs || []) {
				names.push(asText(npc?.name));
			}
		}
	}

	if (Array.isArray(generatedContent?.operations)) {
		for (const operation of generatedContent.operations) {
			const data =
				operation?.data && typeof operation.data === "object"
					? operation.data
					: operation?.patch && typeof operation.patch === "object"
						? operation.patch
						: null;
			if (!data) continue;
			const entity = asText(operation.entity).toLowerCase();
			if (["character", "characters", "npc", "npcs"].includes(entity)) {
				names.push(getCharacterDisplayName(data));
			} else if (
				["location", "locations", "faction", "factions"].includes(entity)
			) {
				names.push(getLocationDisplayName(data));
			} else if (entity === "scene" && Array.isArray(data.npcs)) {
				for (const npc of data.npcs) names.push(asText(npc?.name));
			}
		}
	}

	return normalizeMentionCandidates(names);
}

module.exports = {
	applyMentionsToGeneratedContent,
	collectMentionCandidates,
	processGeneratedTextMentions,
};
