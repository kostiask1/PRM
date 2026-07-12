export const ESTIMATED_IMAGE_TOKENS = 260;

export const SYSTEM_TOKEN_ESTIMATES = Object.freeze({
	prompt: 650,
	campaign: 1500,
	scene: 1900,
	encounter: 1200,
	"custom-monster": 2200,
	image: 550,
});

export function estimateTextTokens(text) {
	const value = String(text || "");
	if (!value.trim()) return 0;

	const cyrillic = (value.match(/[\u0400-\u04ff]/g) || []).length;
	const latinDigits = (value.match(/[A-Za-z0-9]/g) || []).length;
	const whitespace = (value.match(/\s/g) || []).length;
	const other = Math.max(0, value.length - cyrillic - latinDigits - whitespace);
	return Math.ceil(cyrillic / 2.7 + latinDigits / 4 + other / 3.5);
}

export function estimateValueTokens(value) {
	if (value === null || value === undefined) return 0;
	if (typeof value === "string") return estimateTextTokens(value);
	return estimateTextTokens(JSON.stringify(value));
}

export function compactNoteForEstimate(note) {
	if (!note || note._aiIgnored) return null;
	return {
		title: note.title || "",
		text: note.text || "",
	};
}

export function compactEntityForEstimate(entity) {
	if (!entity || entity._aiIgnored) return null;
	return {
		name:
			[
				entity.firstName || entity.first_name || "",
				entity.lastName || entity.last_name || "",
			]
				.filter(Boolean)
				.join(" ") ||
			entity.name ||
			entity.title ||
			"",
		description: entity.description || "",
		motivation: entity.motivation || "",
		trait: entity.trait || "",
		notes: (entity.notes || []).map(compactNoteForEstimate).filter(Boolean),
	};
}

export function compactSessionForEstimate(data = {}) {
	return {
		notes: (data.notes || []).map(compactNoteForEstimate).filter(Boolean),
		result: data.result_text || "",
		scenes: (data.scenes || []).map((scene) => ({
			texts: scene.texts || {},
			notes: (scene.notes || []).map(compactNoteForEstimate).filter(Boolean),
			npcs: scene.npcs || [],
			encounterId: scene.encounterId || "",
		})),
		npcs: (data.npcs || []).map(compactEntityForEstimate).filter(Boolean),
		locations: (data.locations || [])
			.map(compactEntityForEstimate)
			.filter(Boolean),
	};
}

export function getEstimatedAiMode({
	isBestiary,
	isEncounter,
	isCampaign,
	parseAIResponse,
}) {
	if (isBestiary) return "custom-monster";
	if (!parseAIResponse) return "prompt";
	if (isEncounter) return "encounter";
	if (isCampaign) return "campaign";
	return "scene";
}
