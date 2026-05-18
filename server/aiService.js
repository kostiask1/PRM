const { GoogleGenerativeAI } = require("@google/generative-ai");

const GEMINI_MODELS_ENDPOINT =
	"https://generativelanguage.googleapis.com/v1beta/models";
const MODEL_CACHE_TTL_MS = 10 * 60 * 1000;
const CORE_TEXT_MODELS = [
	"gemini-3-flash-preview",
	"gemini-3.1-flash-lite-preview",
	"gemini-2.5-flash",
	"gemini-2.5-pro",
	"gemini-2.5-flash-lite",
	"gemini-2.0-flash",
];
const FALLBACK_TEXT_MODELS = ["gemini-2.5-flash", "gemini-2.5-pro"];
const PREFERRED_FAST_TEXT_MODELS = [
	"gemini-3-flash-preview",
	"gemini-3.1-flash-lite-preview",
	"gemini-2.5-flash",
	"gemini-2.5-flash-lite",
	"gemini-2.0-flash",
	"gemini-1.5-flash",
];
let modelCache = {
	expiresAt: 0,
	data: null,
};
let genAI = null;
let genAIKey = null;

function getGeminiClient() {
	const apiKey = process.env.GEMINI_API_KEY || "";
	if (!genAI || genAIKey !== apiKey) {
		genAI = new GoogleGenerativeAI(apiKey);
		genAIKey = apiKey;
	}
	return genAI;
}

function clearModelCache() {
	modelCache = {
		expiresAt: 0,
		data: null,
	};
}

function normalizeResponseLanguage(language) {
	const code = String(language || "")
		.trim()
		.toLowerCase();
	if (!code) {
		throw new Error("language is required");
	}

	const aliases = {
		uk: "Ukrainian",
		ua: "Ukrainian",
		ukrainian: "Ukrainian",
		en: "English",
		english: "English",
	};

	return {
		code,
		label: aliases[code] || code,
	};
}

function noteToPromptContext(note, { includeTitle = true } = {}) {
	if (!note) return null;
	if (typeof note === "string") {
		return note.trim() ? { text: note } : null;
	}
	if (typeof note !== "object") return null;

	const title = includeTitle ? String(note.title || "").trim() : "";
	const text = String(note.text || "");
	if (!title && !text.trim()) return null;

	return {
		id: note.id,
		...(includeTitle ? { title } : {}),
		text,
	};
}

function entityContextName(entity = {}) {
	return (
		`${entity.firstName || entity.first_name || ""} ${
			entity.lastName || entity.last_name || ""
		}`.trim() ||
		entity.name ||
		entity.title
	);
}

function characterToPromptContext(entity = {}, noteToContextNote) {
	return {
		id: entity.id,
		slug: entity.slug,
		name: entityContextName(entity),
		race: entity.race,
		class: entity.class,
		level: entity.level,
		motivation: entity.motivation,
		trait: entity.trait,
		notes: (entity.notes || []).map(noteToContextNote).filter(Boolean),
	};
}

function npcToPromptContext(entity = {}, noteToContextNote) {
	return {
		id: entity.id,
		slug: entity.slug,
		name: entityContextName(entity),
		race: entity.race,
		class: entity.class,
		level: entity.level,
		description: entity.description,
		motivation: entity.motivation,
		trait: entity.trait,
		notes: (entity.notes || []).map(noteToContextNote).filter(Boolean),
	};
}

function normalizeModelName(name) {
	return String(name || "")
		.replace(/^models\//, "")
		.trim();
}

function isLikelyTextModel(name) {
	const lower = normalizeModelName(name).toLowerCase();
	return !["imagen", "veo", "embedding", "aqa", "learnlm"].some((token) =>
		lower.includes(token),
	);
}

function isCoreTextModel(name) {
	const lower = normalizeModelName(name).toLowerCase();
	return CORE_TEXT_MODELS.some(
		(core) => lower === core || lower.startsWith(`${core}-`),
	);
}

function pickDefaultModel(models) {
	for (const preferred of PREFERRED_FAST_TEXT_MODELS) {
		if (models.some((model) => model.name === preferred)) return preferred;
	}
	return models[0]?.name || FALLBACK_TEXT_MODELS[0];
}

async function listAvailableModels({ forceRefresh = false } = {}) {
	const now = Date.now();
	if (!forceRefresh && modelCache.data && modelCache.expiresAt > now) {
		return modelCache.data;
	}

	if (!process.env.GEMINI_API_KEY) {
		const fallback = {
			models: FALLBACK_TEXT_MODELS.map((name) => ({ name, displayName: name })),
			defaultModel: FALLBACK_TEXT_MODELS[0],
			source: "fallback",
		};
		modelCache = { data: fallback, expiresAt: now + MODEL_CACHE_TTL_MS };
		return fallback;
	}

	try {
		const response = await fetch(
			`${GEMINI_MODELS_ENDPOINT}?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,
		);
		if (!response.ok) {
			throw new Error(`Gemini models request failed: ${response.status}`);
		}
		const payload = await response.json();
		const models = (payload.models || [])
			.filter((model) => Array.isArray(model.supportedGenerationMethods))
			.filter((model) =>
				model.supportedGenerationMethods.includes("generateContent"),
			)
			.map((model) => ({
				name: normalizeModelName(model.name),
				displayName: model.displayName || normalizeModelName(model.name),
				description: model.description || "",
				inputTokenLimit: model.inputTokenLimit,
				outputTokenLimit: model.outputTokenLimit,
			}))
			.filter((model) => model.name)
			.filter((model) => isLikelyTextModel(model.name));

		const deduped = Array.from(
			new Map(models.map((model) => [model.name, model])).values(),
		).filter((model) => isCoreTextModel(model.name));

		const ordered = deduped.sort((a, b) => {
			const aName = a.name.toLowerCase();
			const bName = b.name.toLowerCase();
			const aIdx = CORE_TEXT_MODELS.findIndex(
				(core) => aName === core || aName.startsWith(`${core}-`),
			);
			const bIdx = CORE_TEXT_MODELS.findIndex(
				(core) => bName === core || bName.startsWith(`${core}-`),
			);
			const safeA = aIdx === -1 ? Number.MAX_SAFE_INTEGER : aIdx;
			const safeB = bIdx === -1 ? Number.MAX_SAFE_INTEGER : bIdx;
			return safeA - safeB || a.name.localeCompare(b.name);
		});

		const result = {
			models: ordered.length
				? ordered
				: FALLBACK_TEXT_MODELS.map((name) => ({ name, displayName: name })),
			defaultModel: pickDefaultModel(ordered),
			source: "api",
		};
		modelCache = { data: result, expiresAt: now + MODEL_CACHE_TTL_MS };
		return result;
	} catch (error) {
		const fallback = {
			models: FALLBACK_TEXT_MODELS.map((name) => ({ name, displayName: name })),
			defaultModel: FALLBACK_TEXT_MODELS[0],
			source: "fallback",
			error: error.message,
		};
		modelCache = { data: fallback, expiresAt: now + MODEL_CACHE_TTL_MS };
		return fallback;
	}
}

const systemInstructions = {
	campaign: `You are an experienced Dungeon Master for Dungeons & Dragons.
Your goal is to help with campaign planning.
Keep responses structured and practical for real gameplay.
Always return JSON only, with no text before or after JSON.
The JSON must contain final-state campaign data only, without extra commentary.
Use this shape:
{ "description": "...", "notes": [{ "id": "existing-note-id-if-any", "title": "...", "text": "Markdown note text..." }], "characters": [{ "id": "existing-id-if-any", "slug": "existing-slug-if-any", "name": "...", "race": "...", "class": "...", "level": 1, "motivation": "...", "trait": "...", "notes": [{ "id": "existing-note-id-if-any", "title": "...", "text": "Markdown note text..." }] }], "npcs": [{ "id": "existing-id-if-any", "slug": "existing-slug-if-any", "name": "...", "race": "...", "class": "...", "level": 1, "description": "...", "motivation": "...", "trait": "...", "notes": [{ "id": "existing-note-id-if-any", "title": "...", "text": "Markdown note text..." }] }], "locations": [{ "id": "existing-id-if-any", "slug": "existing-slug-if-any", "name": "...", "description": "...", "notes": [{ "id": "existing-note-id-if-any", "title": "...", "text": "Markdown note text..." }] }] }.
Each item in "notes" must be an object. Use "title" for the note card title and "text" for the Markdown body. Preserve "id" for existing notes.
When updating story description, notes, characters, NPCs, or locations, return the full final-state value for every field/category you output, not only newly added material. Preserve every included existing item from input unchanged unless the user explicitly asks to edit it or a minimal consistency edit is required.
Do not generate a "scenes" field for campaign mode.
Include "characters", "npcs", and "locations" only when the task instructions explicitly allow those categories.`,
	scene: `You are an experienced Dungeon Master for Dungeons & Dragons.
Your goal is to help with session planning.
Keep responses structured and practical for real gameplay.
Always return JSON only, with no text before or after JSON.
The JSON must contain final-state session data only, without extra commentary.
When generating scenes, use this base shape:
{ "notes": [{ "id": "existing-note-id-if-any", "title": "...", "text": "Markdown note text..." }], "scenes": [{ "id": "existing-scene-id-if-any", "texts": { "summary": "...", "goal": "...", "stakes": "...", "location": "..." }, "notes": [{ "id": "existing-note-id-if-any", "title": "...", "text": "Markdown note text..." }], "npcs": [{ "name": "...", "description": "..." }] }], "characters": [{ "id": "existing-id-if-any", "slug": "existing-slug-if-any", "name": "...", "race": "...", "class": "...", "level": 1, "motivation": "...", "trait": "...", "notes": [{ "id": "existing-note-id-if-any", "title": "...", "text": "Markdown note text..." }] }], "npcs": [{ "id": "existing-id-if-any", "slug": "existing-slug-if-any", "name": "...", "race": "...", "class": "...", "level": 1, "description": "...", "motivation": "...", "trait": "...", "notes": [{ "id": "existing-note-id-if-any", "title": "...", "text": "Markdown note text..." }] }], "locations": [{ "id": "existing-id-if-any", "slug": "existing-slug-if-any", "name": "...", "description": "...", "notes": [{ "id": "existing-note-id-if-any", "title": "...", "text": "Markdown note text..." }] }] }.
Top-level "notes" are general notes for the whole session (not scene notes).
When updating notes, scenes, characters, NPCs, or locations, return the full final-state value for every field/category you output, not only newly added material. Preserve every included existing item from input unchanged unless the user explicitly asks to edit it or a minimal consistency edit is required.
Include top-level "characters", top-level "npcs", top-level "locations", and scene "npcs" only when task instructions explicitly allow those categories.
Do not include combat encounter fields unless task instructions explicitly say encounter generation is enabled.`,
	encounter: `You are an experienced Dungeon Master for Dungeons & Dragons 5e.
Your goal is to help build a specific combat encounter.
Keep responses structured and practical for real gameplay.
Always return JSON only, with no text before or after JSON.
The JSON must use:
{ "name": "Encounter name", "monsters": [{ "monsterName": "Official D&D Monster Name", "name": "Optional display name" }] }.
Balance rules:
1. Analyze characters array: count and levels.
2. Determine difficulty from user instructions. If not specified, build a medium encounter.
3. Difficulty scale:
- Easy: party spends minimal resources.
- Medium: party spends some resources and takes moderate damage.
- Hard: real risk of a character dropping to 0 HP.
- Deadly: high risk of character death.
4. Consider action economy: one boss vs 4-5 PCs is often weaker than multiple enemies.
5. If "currentEncounter" exists, you may add monsters or fully replace composition according to instructions.
6. "monsterName" must always be in English using official bestiary names.`,
	character: `You are an experienced Dungeon Master for Dungeons & Dragons.
Your goal is to create player characters for a campaign.
Always return JSON only, with no text before or after JSON.
The JSON must use this shape:
{ "characters": [{ "id": "existing-id-if-any", "slug": "existing-slug-if-any", "name": "...", "race": "...", "class": "...", "level": 1, "motivation": "...", "trait": "...", "notes": [{ "id": "existing-note-id-if-any", "title": "...", "text": "Markdown note text..." }] }] }.
Return only the top-level "characters" field. Do not include "npcs", campaign notes, scenes, encounters, or story description.
Create complete and playable character concepts.
Use realistic D&D class/race combinations and sensible levels.`,
	npc: `You are an experienced Dungeon Master for Dungeons & Dragons.
Your goal is to create NPCs for a campaign.
Always return JSON only, with no text before or after JSON.
The JSON must use this shape:
{ "npcs": [{ "id": "existing-id-if-any", "slug": "existing-slug-if-any", "name": "...", "race": "...", "class": "...", "level": 1, "description": "...", "motivation": "...", "trait": "...", "notes": [{ "id": "existing-note-id-if-any", "title": "...", "text": "Markdown note text..." }] }] }.
Return only the top-level "npcs" field. Do not include "characters", campaign notes, scenes, encounters, or story description.
Create distinct NPCs with clear story function and personality.
For each NPC, include race, class, and level when they can reasonably be inferred from the request or story role.
Use sensible D&D race/class/level values for the NPC's function. If a class is not appropriate, use a concise role or archetype instead of leaving the field empty.`,
	location: `You are an experienced Dungeon Master for Dungeons & Dragons.
Your goal is to create or update locations and factions for a campaign.
Always return JSON only, with no text before or after JSON.
The JSON must use this shape:
{ "locations": [{ "id": "existing-id-if-any", "slug": "existing-slug-if-any", "name": "...", "description": "...", "notes": [{ "id": "existing-note-id-if-any", "title": "...", "text": "Markdown note text..." }] }] }.
Return only the top-level "locations" field. Do not include "characters", "npcs", campaign notes, scenes, encounters, or story description.
Create practical locations/factions with clear gameable details, inhabitants, conflicts, hooks, and notes when useful.`,
	prompt: `You are an experienced Dungeon Master for Dungeons & Dragons.
Your goal is to help another DM with planning.
You receive data and user instructions.
Analyze data independently and fully execute instructions, even when data is incomplete or ambiguous.
In those cases, make the most reasonable assumptions.
Do not ask clarifying questions.
Do not give generic advice unless explicitly requested.
Ignore empty fields and work with what is available.
Return plain natural text for humans only.
Do not return JSON.
Do not output keys, braces {}, or arrays [].
Do not expose raw data structure.
If the user asks to generate a prompt for creating an image, your entire response must be a detailed image-generation prompt in English, regardless of the requested response language.
Use markdown formatting in your final response.`,
	image: `You generate detailed scene-image prompts.
Input is JSON with keys:
Scene fields (higher priority): summary, goal, stakes, location, npcs.
General fields (lower priority): notes, description.
Generate one final image-generation prompt from this data.
Always write the final image-generation prompt in English.
Output only the final prompt, with no explanations, no JSON, and no lists.
Describe in this order:
1) Scene overview
2) Location and environment
3) Characters and actions
4) Lighting
5) Atmosphere
6) Style (cinematic, photorealistic, concept art, etc.)
Default style suffix:
cinematic, photorealistic, ultra realistic, high detail, 8k, dramatic lighting, volumetric light, sharp focus, depth of field, film still, concept art
Input JSON:`,
};

const structuredJsonResponseContract = `PARSED JSON RESPONSE CONTRACT:
1. Treat INPUT DATA as the complete editable scope for this request, not as an example and not as the entire campaign.
2. Return the desired final state for the fields/categories you output when the corresponding category exists in INPUT DATA. Do not return patches, deltas, append-only fragments, or summaries of changes.
3. Output only fields/categories that USER INSTRUCTIONS asks you to create or edit, or that are necessary for those requested changes.
4. For every output field/category, include all matching existing items from INPUT DATA in their original order, then add or revise only what the request requires. Do not drop unchanged included items.
5. Copy unchanged included text exactly: preserve wording, spelling, markdown, line breaks, titles, spacing, bullet/number formatting, and existing bracketed mentions.
6. Change existing text only when USER INSTRUCTIONS explicitly asks for that edit or when a minimal consistency edit is unavoidable because of the requested new context.
7. Existing scenes and campaign entities in INPUT DATA include stable "id" and sometimes "slug". Preserve the same "id" and "slug" when editing or renaming an existing item. To rename an item, keep its "id"/"slug" and change only its display name fields.
8. You may delete existing included items only when USER INSTRUCTIONS asks to delete/remove/keep only a subset. Prefer returning the final array without deleted items. You may also mark a specific included item with "delete": true while preserving its "id"/"slug".
9. Never invent, reconstruct, summarize, or modify data that is not present in INPUT DATA. Data outside INPUT DATA is hidden and must remain untouched by being omitted from the response.
10. If INPUT DATA does not contain a category, you cannot edit, rename, delete, or preserve hidden existing items from that category. In that case the category is append-only: return only new items needed for USER INSTRUCTIONS.
Category final-state rules:
- If you output "notes", include all notes from the corresponding INPUT DATA notes array plus requested new/edited notes. Notes must be objects, not strings. Preserve existing note "id", "title", "text", and "collapsed" unless editing that note requires a text/title change.
- If you output "characters", include all player characters from INPUT DATA.campaign.characters plus requested new/edited player characters.
- If you output "npcs", include all NPCs from INPUT DATA.campaign.npcs plus requested new/edited NPCs.
- If you output "locations", include all locations/factions from INPUT DATA.campaign.locations plus requested new/edited locations/factions.
- If you output "scenes", include all scenes from the relevant selected session context plus requested new/edited scenes.`;

const characterLevelContract = `CHARACTER LEVEL CONTRACT:
For character and NPC "level" fields, use a number from 1 to 20 when the level is known, or an empty string "" when the level is unknown, intentionally unset, or already empty in INPUT DATA. Preserve existing empty level values as "" unless the user explicitly asks to set a level.
When balancing encounters, ignore characters or NPCs whose level is "" instead of treating them as level 1.`;

const markdownFormattingContract = `APP MARKDOWN FORMAT CONTRACT:
The app stores rich text as Markdown strings and renders them through EditableField/ReactMarkdown.
Supported formatting in editable textarea fields:
- Headings: "# Heading" through "###### Heading" at the beginning of a line.
- Bold: "**text**".
- Italic: "*text*".
- Lists: "- item" at the beginning of a line.
- Quotes: "> text" at the beginning of a line.
- Indentation: real tab characters "\\t"; preserve existing tabs and use "\\t" for intentional nested/indented text.
- Paragraphs and line breaks: preserve meaningful blank lines and existing line breaks.
- Entity mentions: "[Exact Entity Name]" only, following the separate mention rules.
When returning parsed JSON, Markdown must be inside JSON string values only. Escape newlines/tabs as normal JSON string content; do not output HTML, rich-text objects, code fences, Markdown tables, markdown links, or raw React/HTML tags.
Preserve existing Markdown markers exactly in unchanged text. When editing text, keep the user's existing formatting style and change only the requested content.
For notes, Markdown belongs in the note object's "text" field. A line starting with "#" is a Markdown heading inside "text"; never convert it into the note "title" and never remove the "#" marker unless the user explicitly asks to change that heading.`;

const imagePromptLanguageContract = `IMAGE PROMPT LANGUAGE EXCEPTION:
If the user asks to generate a prompt for creating an image, ignore the normal response-language rule for that answer and write the complete prompt in English.
The image prompt must be detailed and ready to paste into an image generator.`;

async function generateContent({
	type,
	session,
	campaign,
	userInstructions,
	encounterId,
	sceneId,
	parseAIResponse,
	contextData,
	generateCharacters,
	generateNpcs,
	generateLocations,
	generateEncounters,
	entityScope,
	modelName,
	language,
	simplifiedNotes,
}) {
	let model;
	let userPrompt = "";
	const responseLanguage = normalizeResponseLanguage(language);
	const simplifiedNotesEnabled = Boolean(simplifiedNotes);
	const noteToContextNote = (note) =>
		noteToPromptContext(note, { includeTitle: !simplifiedNotesEnabled });
	const encounterGenerationEnabled = Boolean(generateEncounters);
	const characterGenerationEnabled = generateCharacters !== false;
	const npcGenerationEnabled = generateNpcs !== false;
	const locationGenerationEnabled = generateLocations !== false;
	const entityTargetScope =
		session && !encounterId && entityScope !== "campaign"
			? "session"
			: "campaign";
	const effectiveParseAIResponse =
		Boolean(parseAIResponse) && (!encounterId || encounterGenerationEnabled);
	const requestedType =
		type === "encounter" && !encounterGenerationEnabled ? null : type;

	const useKey = requestedType
		? requestedType
		: !effectiveParseAIResponse
			? "prompt"
			: encounterId
				? "encounter"
				: session
					? "scene"
					: "campaign";

	const availableModels = await listAvailableModels();
	const requestedModel = normalizeModelName(modelName);
	const selectedModel = availableModels.models.some(
		(item) => item.name === requestedModel,
	)
		? requestedModel
		: availableModels.defaultModel;
	const systemInstructionParts = [
		systemInstructions[useKey],
		`MANDATORY LANGUAGE RULE: You must write all user-visible output strictly in ${responseLanguage.label}.`,
		imagePromptLanguageContract,
		`NAME LANGUAGE RULE: Any new names you invent must be written in ${responseLanguage.label}. This includes new character names, NPC names, place names, scene names, encounter names, aliases, titles, and display names.
EXISTING NAME PROTECTION: Names that already exist in the input data must keep their exact original spelling and alphabet. Do not translate, transliterate, decline, paraphrase, rename, or otherwise alter existing names unless the user explicitly asks you to do that.
Exception: technical lookup fields that require official English names, such as "monsterName", must remain official English bestiary names.`,
		characterLevelContract,
		markdownFormattingContract,
	];
	if (
		effectiveParseAIResponse &&
		["campaign", "scene", "character", "npc", "location"].includes(useKey)
	) {
		systemInstructionParts.push(structuredJsonResponseContract);
	}
	if (simplifiedNotesEnabled) {
		systemInstructionParts.push(
			`SIMPLIFIED NOTES MODE IS ENABLED. In all note arrays, return note objects with "text" and optional existing "id"; do not use "title" or "name" for notes. When using input notes as context, treat only their text as meaningful and ignore any title fields.`,
		);
	}
	if (useKey === "scene" && encounterGenerationEnabled) {
		systemInstructionParts.push(
			`Encounter generation is enabled. You may create combat encounters using this shape:
{ "notes": [{ "id": "existing-note-id-if-any", "title": "...", "text": "Markdown session note text..." }], "scenes": [{ "texts": { "summary": "...", "goal": "...", "stakes": "...", "location": "..." }, "notes": [{ "id": "existing-note-id-if-any", "title": "...", "text": "Markdown scene note text..." }], "npcs": [{ "name": "...", "description": "..." }], "encounterIndex": 0 }], "encounters": [{ "name": "Encounter name", "monsters": [{ "monsterName": "Official D&D Monster Name", "name": "Optional display name" }] }] }.
If a scene requires combat, "encounterIndex" must point to the encounter index in "encounters".
If combat is not needed, omit "encounterIndex".
Pick monsters according to party level and party size from context.
If user instructions specify encounter difficulty, follow that strictly.`,
		);
	} else if (useKey === "scene") {
		systemInstructionParts.push(
			`Encounter generation is disabled. Do not create or edit combat encounters.`,
		);
	}
	if (["campaign", "scene"].includes(useKey)) {
		systemInstructionParts.push(
			characterGenerationEnabled
				? `Character generation is enabled. You may include a top-level "characters" array only when the user explicitly asks to create, edit, rename, or delete player characters.`
				: `Character generation is disabled. Do not create or edit player characters. Do not include a top-level "characters" array.`,
		);
		systemInstructionParts.push(
			npcGenerationEnabled
				? `NPC generation is enabled. You may include NPC data only when the user explicitly asks to create, edit, rename, or delete NPCs. Use a top-level "npcs" array for NPC cards; scene-local NPC references may be included in scene "npcs".`
				: `NPC generation is disabled. Do not create or edit NPCs. Do not include top-level "npcs" or scene "npcs".`,
		);
		systemInstructionParts.push(
			locationGenerationEnabled
				? `Location/faction generation is enabled. You may include a top-level "locations" array only when the user explicitly asks to create, edit, rename, or delete locations or factions. Each item should include name, description, and notes.`
				: `Location/faction generation is disabled. Do not create or edit locations/factions. Do not include a top-level "locations" array.`,
		);
		if (useKey === "scene") {
			systemInstructionParts.push(
				entityTargetScope === "session"
					? `ENTITY SCOPE: Top-level "npcs" and "locations" in this response are session-scoped by default. They belong only to the current session and must not be treated as campaign-wide entities unless the user explicitly asks for campaign scope.`
					: `ENTITY SCOPE: Top-level "npcs" and "locations" in this response are campaign-scoped. They belong to the whole campaign.`,
			);
		}
	}

	model = getGeminiClient().getGenerativeModel({
		model: selectedModel,
		...(useKey === "prompt" || useKey === "image"
			? {}
			: {
					generationConfig: {
						responseMimeType: "application/json",
					},
				}),
		systemInstruction: systemInstructionParts.join("\n\n"),
	});

	// 1. Гнучка фільтрація сесій згідно з налаштованим контекстом
	const filteredSessions = (contextData?.sessions || [])
		.map((s) => {
			const sessionContext = { id: s.slug, slug: s.slug, name: s.name };
			const conf = s.conf || {};
			const data = s.data || {};

			// Додаємо нотатки, якщо обрано
			if (conf.included && conf.notes && data.notes) {
				sessionContext.notes = data.notes.map(noteToContextNote).filter(Boolean);
			}

			// Додаємо результат сесії, якщо обрано
			if (conf.included && conf.result_text && data.result_text) {
				sessionContext.result = data.result_text;
			}

			// Додаємо лише вибрані сцени та їх конкретні поля
			if (conf.included && data.scenes) {
				const hasSceneConfig =
					conf.scenes &&
					typeof conf.scenes === "object" &&
					Object.keys(conf.scenes).length > 0;
				const defaultSceneConf = {
					included: true,
					summary: true,
					goal: true,
					stakes: true,
					location: true,
					notes: true,
					encounter: true,
				};
				const sceneFields = [
					"summary",
					"goal",
					"stakes",
					"location",
					"encounter",
					"notes",
				];
				const filteredScenes = data.scenes
					.filter((scene) => {
						if (!hasSceneConfig) return true;
						return conf.scenes[scene.id]?.included;
					})
					.map((scene) => {
						const sceneConf = hasSceneConfig
							? {
									...defaultSceneConf,
									...(conf.scenes[scene.id] || {}),
								}
							: defaultSceneConf;
						const resultScene = { id: scene.id };

						// Якщо обрано енкаунтер, шукаємо імена монстрів
						if (sceneConf.encounter && scene.encounterId) {
							const encounter = (data.encounters || []).find(
								(e) => e.id.toString() === scene.encounterId.toString(),
							);
							if (encounter && encounter.monsters) {
								resultScene.monsters = encounter.monsters.map(
									(m) => m.name || m.monsterName,
								);
							}
						}

						sceneFields.forEach((field) => {
							if (field === "encounter") return; // Вже оброблено вище
							if (field === "notes") {
								if (sceneConf[field])
									resultScene[field] = (scene.notes || [])
										.map(noteToContextNote)
										.filter(Boolean);
								return;
							}
							if (sceneConf[field]) {
								const value = scene.texts?.[field];
								if (value !== undefined && value !== null) {
									resultScene[field] = value;
								}
							}
						});
						return resultScene;
					});

				if (filteredScenes.length > 0) {
					sessionContext.scenes = filteredScenes;
				}
			}

			if (conf.included && Array.isArray(data.npcs) && data.npcs.length > 0) {
				sessionContext.npcs = data.npcs
					.map((npc) => npcToPromptContext(npc, noteToContextNote))
					.filter((npc) => npc.name || npc.description || npc.motivation);
			}

			if (
				conf.included &&
				Array.isArray(data.locations) &&
				data.locations.length > 0
			) {
				sessionContext.locations = data.locations
					.map((location) => ({
						id: location.id,
						slug: location.slug,
						name: location.name || location.title,
						description: location.description,
						notes: (location.notes || [])
							.map(noteToContextNote)
							.filter(Boolean),
					}))
					.filter((location) => location.name || location.description);
			}

			return sessionContext;
		})
		.filter((s) => s.notes || s.result || s.scenes || s.npcs || s.locations); // Прибираємо сесії без контенту

	// 2. Формуємо фінальний JSON контексту для Gemini
	const contextJson = {
		campaign: {
			name: campaign.name,
			description: campaign.description,
			notes: contextData?.campaign?.notes
				?.map(noteToContextNote)
				.filter(Boolean),
			characters: contextData?.campaign?.characters
				?.map((c) => characterToPromptContext(c, noteToContextNote))
				.filter((c) => c.name || c.motivation),
			npcs: contextData?.campaign?.npcs
				?.map((npc) => npcToPromptContext(npc, noteToContextNote))
				.filter((npc) => npc.name || npc.description || npc.motivation),
			locations: contextData?.campaign?.locations
				?.map((location) => ({
					id: location.id,
					slug: location.slug,
					name: location.name || location.title,
					description: location.description,
					notes: (location.notes || [])
						.map(noteToContextNote)
						.filter(Boolean),
				}))
				.filter((location) => location.name || location.description),
		},
	};

	if (session && entityTargetScope === "session") {
		const currentSession = {
			name: session.name,
		};
		if (Array.isArray(session.data?.npcs) && session.data.npcs.length > 0) {
			currentSession.npcs = session.data.npcs
				.map((npc) => npcToPromptContext(npc, noteToContextNote))
				.filter((npc) => npc.name || npc.description || npc.motivation);
		}
		if (
			Array.isArray(session.data?.locations) &&
			session.data.locations.length > 0
		) {
			currentSession.locations = session.data.locations
				.map((location) => ({
					id: location.id,
					slug: location.slug,
					name: location.name || location.title,
					description: location.description,
					notes: (location.notes || [])
						.map(noteToContextNote)
						.filter(Boolean),
				}))
				.filter((location) => location.name || location.description);
		}
		contextJson.currentSession = currentSession;
	}

	if (filteredSessions.length > 0) {
		contextJson.selectedSessions = filteredSessions;
	}

	// Додаємо дані про поточний бій, якщо ми в режимі Encounter
	if (encounterId && session) {
		const currentEnc = (session.data.encounters || []).find(
			(e) => e.id.toString() === encounterId.toString(),
		);
		if (currentEnc) {
			contextJson.currentEncounter = {
				name: currentEnc.name,
				monsters: (currentEnc.monsters || []).map((m) => ({
					name: m.name,
					monsterName: m.originalBestiaryName || m.name,
					cr: m.cr || m.challenge_rating,
				})),
			};
		}
	}

	userPrompt = `INPUT DATA (JSON):\n${JSON.stringify(contextJson, null, 2)}\n\n`;
	userPrompt += `MANDATORY: Reply strictly in ${responseLanguage.label}.\n`;
	userPrompt +=
		"EXCEPTION: If the user asks for a prompt to create an image, reply with a detailed image-generation prompt in English, regardless of the mandatory response language.\n";
	userPrompt +=
		'IMPORTANT: Text fields in INPUT DATA may contain the app Markdown format: headings with "#", bold "**text**", italic "*text*", lists "- item", quotes "> text", tab indentation "\\t", blank lines, and entity mentions "[Name]". Treat these as real formatting, not noise. Preserve unchanged Markdown exactly. When adding formatted text, use only this supported Markdown subset inside JSON strings.\n';
	if (
		effectiveParseAIResponse &&
		["campaign", "scene", "character", "npc", "location"].includes(useKey)
	) {
		userPrompt +=
			"IMPORTANT: The JSON response must be the final state for every field or array you output, not a delta. Preserve unchanged INPUT DATA items exactly and include them together with requested new or edited items. Omit fields/categories that are outside the user's request.\n";
	}
	userPrompt +=
		"IMPORTANT: In generated text fields, use square brackets only for actual entity names that are already present in INPUT DATA or for new entities that you create in this same JSON response in structured arrays such as \"characters\", \"npcs\", scene \"npcs\", or \"locations\". Do not wrap ordinary nouns, species, terrain, place types, groups, concepts, or generic descriptors just because they sound important. For example, do not output [Dwarves], [Swamps], [Market], or [Guard] unless that exact entity already exists in INPUT DATA or you are also creating it as a structured entity in this response. Do not wrap JSON keys.\n";
	userPrompt +=
		"IMPORTANT: Do NOT wrap structured name fields in brackets. Fields like name, firstName, lastName, and monsterName must contain plain names without [] symbols.\n";
	userPrompt +=
		"IMPORTANT: Never alter, translate, decline, or paraphrase existing character/NPC/location/faction names unless the user explicitly asks you to rename or translate them. Always use existing names exactly as provided in the input JSON, preserving original spelling, and only wrap them in square brackets.\n";
	userPrompt +=
		"IMPORTANT: Never transliterate existing names between alphabets (for example, Latin <-> Cyrillic) unless the user explicitly asks you to transliterate them. Keep the exact original characters from input. Mention format must be a single pair of brackets only: [Name]. Never output [[Name]] or nested brackets.\n";
	userPrompt += `IMPORTANT: For new names you invent, use ${responseLanguage.label}. For existing names from input, keep the original spelling unless the user explicitly requests a rename, translation, or transliteration. Keep official lookup fields such as monsterName in English when the schema requires official D&D names.\n`;
	if (simplifiedNotesEnabled) {
		userPrompt +=
			'IMPORTANT: Simplified notes mode is enabled. For every "notes" array in your JSON, output note objects with "text" and optional existing "id"; do not output note titles and do not use the first line as a title.\n';
	}

	// Додаємо специфічні інструкції залежно від типу задачі
	if (useKey === "image") {
		userPrompt += `TASK: Generate an image prompt for scene ID: ${sceneId}\n`;
	} else if (useKey === "character") {
		userPrompt += `TASK: Create new player characters for this campaign based on user instructions.
IMPORTANT: This request is strictly for player characters. Return only "characters". Do not create NPCs or any other content category.
IMPORTANT: If editing, renaming, or deleting an existing character from INPUT DATA, preserve its "id" and "slug". If INPUT DATA.campaign.characters is absent, this request is append-only for characters.\n`;
	} else if (useKey === "npc") {
		userPrompt += `TASK: Create new NPCs for this ${entityTargetScope === "session" ? "current session" : "campaign"} based on user instructions.
IMPORTANT: This request is strictly for NPCs. Return only "npcs". Do not create player characters or any other content category.
IMPORTANT: Include race, class, and level for every generated NPC when possible. If a formal class does not fit, put a role/archetype in "class".
IMPORTANT: If editing, renaming, or deleting an existing NPC from INPUT DATA, preserve its "id" and "slug". If ${entityTargetScope === "session" ? "INPUT DATA.currentSession.npcs" : "INPUT DATA.campaign.npcs"} is absent, this request is append-only for NPCs.\n`;
	} else if (useKey === "location") {
		userPrompt += `TASK: Create or update locations/factions for this ${entityTargetScope === "session" ? "current session" : "campaign"} based on user instructions.
IMPORTANT: This request is strictly for locations/factions. Return only "locations". Do not create characters, NPCs, campaign notes, scenes, encounters, or any other content category.
IMPORTANT: If editing, renaming, or deleting an existing location/faction from INPUT DATA, preserve its "id" and "slug".
IMPORTANT: If ${entityTargetScope === "session" ? "INPUT DATA.currentSession.locations" : "INPUT DATA.campaign.locations"} is present, the returned "locations" array must contain every included existing location/faction unchanged unless the user requested edits/deletions, plus requested new locations/factions. Do not return only the new item. If ${entityTargetScope === "session" ? "INPUT DATA.currentSession.locations" : "INPUT DATA.campaign.locations"} is absent, this request is append-only for locations/factions.\n`;
	} else if (useKey === "encounter") {
		userPrompt += `TASK: Update current combat encounter (ID: ${encounterId}). Consider character levels and requested difficulty (easy, medium, hard, deadly). Pick monsters that fit the scenario.\n`;
	} else if (useKey === "scene") {
		userPrompt += `TASK: Based on current session and context, apply the user's requested session changes.\n`;
		userPrompt += `IMPORTANT: Return the complete updated session content for the fields you output. For notes, scenes, characters, NPCs, and locations, include all corresponding included existing items from INPUT DATA together with your revisions/additions. Do not return only a delta or only the newly added content.\n`;
		if (characterGenerationEnabled) {
			userPrompt += `IMPORTANT: Character generation is enabled. Include player characters only when the user explicitly asks to create, edit, rename, or delete them. If you output "characters", preserve "id"/"slug" for existing items and include all included existing player characters from INPUT DATA.campaign.characters plus requested additions/edits, unless the user requested deletion.\n`;
		} else {
			userPrompt += `IMPORTANT: Character generation is disabled. Do not create or edit player characters and do not output "characters".\n`;
		}
		if (npcGenerationEnabled) {
			userPrompt +=
				entityTargetScope === "session"
					? `IMPORTANT: NPC generation is enabled. Include NPC cards only when the user explicitly asks to create, edit, rename, or delete NPCs. Top-level "npcs" are session-scoped and belong only to the current session. Scene-local NPC references may also be included in scene "npcs". If you output top-level "npcs", preserve "id"/"slug" for existing items and include all included existing NPCs from INPUT DATA.currentSession.npcs plus requested additions/edits, unless the user requested deletion.\n`
					: `IMPORTANT: NPC generation is enabled. Include NPC cards only when the user explicitly asks to create, edit, rename, or delete NPCs. Scene-local NPC references may also be included in scene "npcs". If you output top-level "npcs", preserve "id"/"slug" for existing items and include all included existing NPCs from INPUT DATA.campaign.npcs plus requested additions/edits, unless the user requested deletion.\n`;
		} else {
			userPrompt += `IMPORTANT: NPC generation is disabled. Do not create or edit NPCs and do not output top-level "npcs" or scene "npcs".\n`;
		}
		if (locationGenerationEnabled) {
			userPrompt +=
				entityTargetScope === "session"
					? `IMPORTANT: Location/faction generation is enabled. Include locations/factions only when the user explicitly asks to create, edit, rename, or delete places, factions, organizations, landmarks, or regions. Top-level "locations" are session-scoped and belong only to the current session. If you output "locations", preserve "id"/"slug" for existing items and include all included existing locations/factions from INPUT DATA.currentSession.locations plus requested additions/edits, unless the user requested deletion. Locations/factions should include name, description, and notes when possible.\n`
					: `IMPORTANT: Location/faction generation is enabled. Include locations/factions only when the user explicitly asks to create, edit, rename, or delete places, factions, organizations, landmarks, or regions. If you output "locations", preserve "id"/"slug" for existing items and include all included existing locations/factions from INPUT DATA.campaign.locations plus requested additions/edits, unless the user requested deletion. Locations/factions should include name, description, and notes when possible.\n`;
		} else {
			userPrompt += `IMPORTANT: Location/faction generation is disabled. Do not create or edit locations/factions and do not output "locations".\n`;
		}
		if (encounterGenerationEnabled) {
			userPrompt += `IMPORTANT: For each scene where conflict is possible, generate an encounter object in the encounters array.
Pick monsters (English names) while considering character levels and classes for balance.\n`;
		} else {
			userPrompt += `IMPORTANT: Encounter generation is disabled. Do not create or edit combat encounters, do not pick monsters, and do not output "encounters", "encounterIndex", or "encounterId".\n`;
		}
	} else if (useKey === "campaign") {
		userPrompt += `TASK: Apply the user's requested campaign changes.\n`;
		userPrompt += `IMPORTANT: Return the complete updated campaign content for the fields you output. For description, notes, characters, NPCs, and locations, include all corresponding included existing items from INPUT DATA together with your revisions/additions. Do not return only a delta or only the newly added content.\n`;
		if (characterGenerationEnabled) {
			userPrompt += `IMPORTANT: Character generation is enabled. Include player characters only when the user explicitly asks to create, edit, rename, or delete them. If you output "characters", preserve "id"/"slug" for existing items and include all included existing player characters from INPUT DATA.campaign.characters plus requested additions/edits, unless the user requested deletion.\n`;
		} else {
			userPrompt += `IMPORTANT: Character generation is disabled. Do not create or edit player characters and do not output "characters".\n`;
		}
		if (npcGenerationEnabled) {
			userPrompt += `IMPORTANT: NPC generation is enabled. Include NPCs only when the user explicitly asks to create, edit, rename, or delete them. If you output "npcs", preserve "id"/"slug" for existing items and include all included existing NPCs from INPUT DATA.campaign.npcs plus requested additions/edits, unless the user requested deletion. NPCs should include race, class, level, description, motivation, trait, and notes when possible.\n`;
		} else {
			userPrompt += `IMPORTANT: NPC generation is disabled. Do not create or edit NPCs and do not output "npcs".\n`;
		}
		if (locationGenerationEnabled) {
			userPrompt += `IMPORTANT: Location/faction generation is enabled. Include locations/factions only when the user explicitly asks to create, edit, rename, or delete places, factions, organizations, landmarks, or regions. If you output "locations", preserve "id"/"slug" for existing items and include all included existing locations/factions from INPUT DATA.campaign.locations plus requested additions/edits, unless the user requested deletion. Locations/factions should include name, description, and notes when possible.\n`;
		} else {
			userPrompt += `IMPORTANT: Location/faction generation is disabled. Do not create or edit locations/factions and do not output "locations".\n`;
		}
	}

	if (userInstructions) {
		userPrompt += `USER INSTRUCTIONS (PRIORITY): ${userInstructions}\n`;
	}

	const result = await model.generateContent(userPrompt);
	const response = await result.response;
	let text = response.text();

	// Допоміжна функція для рекурсивного виправлення екранованих символів переносу (\\n -> \n)
	const fixNewLines = (val) => {
		if (typeof val === "string") return val.replace(/\\n/g, "\n");
		if (Array.isArray(val)) return val.map(fixNewLines);
		if (val && typeof val === "object") {
			const next = {};
			for (const key in val) next[key] = fixNewLines(val[key]);
			return next;
		}
		return val;
	};

	if (!effectiveParseAIResponse) {
		return text.replace(/\\n/g, "\n");
	}

	try {
		// Очищення від можливих markdown-тегів, якщо вони проскочили
		const cleanJson = text
			.replace(/```json/g, "")
			.replace(/```/g, "")
			.trim();

		return fixNewLines(JSON.parse(cleanJson));
	} catch (e) {
		console.error("Failed to parse AI response as JSON:", text, e);
		// Якщо парсинг не вдався, повертаємо структуровану помилку
		return {
			error: "AI повернув некоректний JSON. Спробуйте ще раз.",
			raw_response: text.replace(/\\n/g, "\n"),
		};
	}
}

module.exports = { generateContent, listAvailableModels, clearModelCache };
