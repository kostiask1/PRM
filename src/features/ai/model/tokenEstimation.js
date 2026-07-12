export const ESTIMATED_IMAGE_TOKENS = 260;
export const ESTIMATED_FILE_TOKEN_BYTES = 4;

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

function filterByContextList(list, config, getKey) {
	const items = config?.items || {};
	const hasExplicitItems = Object.keys(items).length > 0;
	if (config?.included === false) return [];
	return (Array.isArray(list) ? list : []).filter(
		(item) => !hasExplicitItems || items[getKey(item)] !== false,
	);
}

const compactEntities = (list) =>
	list.map(compactEntityForEstimate).filter(Boolean);

export function buildAiTokenEstimate({
	activeCampaignBasePrompt,
	attachedFiles = [],
	attachedImages = [],
	campaignContext,
	characterContext,
	charactersList = [],
	contextConfig,
	currentLanguage,
	generateCharacters,
	generateCustomMonsters,
	generateEncounters,
	generateLocations,
	generateNpcs,
	globalAiBasePrompt,
	isBestiary,
	isCampaign,
	isEncounter,
	locationContext,
	locationsList = [],
	npcContext,
	npcsList = [],
	parseAIResponse,
	selectedModel,
	sessionData,
	sessionName,
	useContext,
	userInstructions,
	getCharacterKey,
	getLocationKey,
}) {
	const mode = getEstimatedAiMode({
		isBestiary,
		isEncounter,
		isCampaign,
		parseAIResponse,
	});
	const context = {};
	if (!isBestiary && isCampaign) {
		context.campaign = {
			name: sessionData?.name || sessionName || "",
			description: sessionData?.description || "",
		};
		if (useContext) {
			if (contextConfig.campaignNotes) {
				context.campaign.notes = (sessionData?.notes || [])
					.map(compactNoteForEstimate)
					.filter(Boolean);
			}
			context.campaign.characters = compactEntities(
				filterByContextList(
					sessionData?.characters || charactersList,
					characterContext,
					getCharacterKey,
				),
			);
			context.campaign.npcs = compactEntities(
				filterByContextList(
					sessionData?.npcs || npcsList,
					npcContext,
					getCharacterKey,
				),
			);
			context.campaign.locations = compactEntities(
				filterByContextList(
					sessionData?.locations || locationsList,
					locationContext,
					getLocationKey,
				),
			);
		}
	} else if (!isBestiary) {
		context.campaign = { description: campaignContext?.description || "" };
		if (isEncounter) {
			context.currentEncounter = sessionData || {};
		} else if (parseAIResponse) {
			context.currentSession = compactSessionForEstimate(sessionData || {});
		}
		if (useContext) {
			context.campaign = {
				...context.campaign,
				notes: contextConfig.campaignNotes
					? (campaignContext?.notes || [])
							.map(compactNoteForEstimate)
							.filter(Boolean)
					: [],
				characters: compactEntities(
					filterByContextList(
						charactersList,
						characterContext,
						getCharacterKey,
					),
				),
				npcs: compactEntities(
					filterByContextList(npcsList, npcContext, getCharacterKey),
				),
				locations: compactEntities(
					filterByContextList(locationsList, locationContext, getLocationKey),
				),
			};
			context.selectedSessions = Object.entries(contextConfig.sessions || {})
				.filter(([, config]) => config?.included && config?.data)
				.map(([slug, config]) => ({
					slug,
					data: compactSessionForEstimate(config.data),
				}));
		}
	}

	const requestShape = {
		mode,
		language: currentLanguage,
		modelName: selectedModel,
		userInstructions,
		options: {
			responseParsing: mode !== "prompt",
			characterGeneration: generateCharacters,
			npcGeneration: generateNpcs,
			locationGeneration: generateLocations,
			encounterGeneration: generateEncounters,
			customMonsterGeneration: generateCustomMonsters,
			contextEnabled: useContext && !isBestiary,
		},
		basePrompts: {
			global: globalAiBasePrompt,
			campaign: activeCampaignBasePrompt,
		},
		context,
		attachedImages: attachedImages.map(({ name, url }) => ({ name, url })),
		attachedFiles: attachedFiles.map(({ name, mimeType, sizeBytes }) => ({
			name,
			mimeType,
			sizeBytes,
		})),
	};
	const textTokens =
		(SYSTEM_TOKEN_ESTIMATES[mode] || SYSTEM_TOKEN_ESTIMATES.prompt) +
		estimateValueTokens(requestShape);
	const imageTokens = attachedImages.length * ESTIMATED_IMAGE_TOKENS;
	const fileTokens = Math.ceil(
		attachedFiles.reduce(
			(total, file) => total + (Number(file.sizeBytes) || 0),
			0,
		) / ESTIMATED_FILE_TOKEN_BYTES,
	);
	return {
		textTokens,
		imageTokens,
		fileTokens,
		total: textTokens + imageTokens + fileTokens,
	};
}
