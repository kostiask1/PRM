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
	if (note._aiIgnored) return null;

	const title = includeTitle ? String(note.title || "").trim() : "";
	const text = String(note.text || "");
	if (!title && !text.trim()) return null;

	return {
		id: note.id,
		...(includeTitle ? { title } : {}),
		text,
	};
}

function isAiIgnored(value = {}) {
	return Boolean(value?._aiIgnored);
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
	if (isAiIgnored(entity)) return null;
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
	if (isAiIgnored(entity)) return null;
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

function locationToPromptContext(location = {}, noteToContextNote) {
	if (isAiIgnored(location)) return null;
	return {
		id: location.id,
		slug: location.slug,
		name: location.name || location.title,
		description: location.description,
		notes: (location.notes || []).map(noteToContextNote).filter(Boolean),
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
The JSON must contain operation-based changes only, without extra commentary.
Never return complete campaign arrays or unchanged entities.
Use stable ids from INPUT DATA for existing targets. Use "create" only for new items.
Do not generate scene operations for campaign mode unless the user explicitly asks to change a session.`,
	scene: `You are an experienced Dungeon Master for Dungeons & Dragons.
Your goal is to help with session planning.
Keep responses structured and practical for real gameplay.
Always return JSON only, with no text before or after JSON.
The JSON must contain operation-based changes only, without extra commentary.
Never return complete session arrays or unchanged entities.
Use stable ids from INPUT DATA for existing targets. Use "create" only for new items.
"npc" and "location" operations are session-scoped by default unless campaign scope is explicitly requested.
Do not include combat encounter operations unless task instructions explicitly say encounter generation is enabled.`,
	encounter: `You are an experienced Dungeon Master for Dungeons & Dragons 5.5e (2024).
Your goal is to help build a specific combat encounter.
Keep responses structured and practical for real gameplay.
Always return JSON only, with no text before or after JSON.
The JSON must contain operation-based changes only. Update the current encounter with an "update" operation for entity "encounter".
The encounter patch shape is:
{ "name": "Encounter name", "monsters": [{ "monsterName": "Official D&D Monster Name or exact custom creature name", "name": "Optional display name" }] }.
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
6. "monsterName" must match a bestiary lookup name exactly. Use an official English bestiary name, or use an exact custom creature name from INPUT DATA.customBestiary.monsterNames when it fits the encounter.`,
	character: `You are an experienced Dungeon Master for Dungeons & Dragons.
Your goal is to create player characters for a campaign.
Always return JSON only, with no text before or after JSON.
Return operation-based changes only. Create or update entity "character"; do not return unchanged characters.
Do not create NPCs or any other content category.
Create complete and playable character concepts.
Use realistic D&D class/race combinations and sensible levels.`,
	npc: `You are an experienced Dungeon Master for Dungeons & Dragons.
Your goal is to create NPCs for a campaign.
Always return JSON only, with no text before or after JSON.
Return operation-based changes only. Create or update entity "npc"; do not return unchanged NPCs.
Do not create player characters or any other content category.
Create distinct NPCs with clear story function and personality.
For each NPC, include race, class, and level when they can reasonably be inferred from the request or story role.
Use sensible D&D race/class/level values for the NPC's function. If a class is not appropriate, use a concise role or archetype instead of leaving the field empty.`,
	location: `You are an experienced Dungeon Master for Dungeons & Dragons.
Your goal is to create or update locations and factions for a campaign.
Always return JSON only, with no text before or after JSON.
Return operation-based changes only. Create or update entity "location"; do not return unchanged locations.
Do not create characters, NPCs, campaign notes, scenes, encounters, or any other content category.
Create practical locations/factions with detailed, gameable descriptions: visible landmarks, sensory details, layout, atmosphere, inhabitants, conflicts, secrets, hazards, resources, hooks, and what makes the place distinct at the table.`,
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
	image: `You generate detailed image prompts for Dungeons & Dragons campaign elements.
Input is JSON with keys:
Selected target fields (highest priority): type, name, description, trait, motivation, texts, notes, npcs, location, sessionName.
Scene fields: summary, goal, stakes, location, npcs.
Custom monster fields: size, creatureType, alignment, actions, bonusActions, reactions, legendaryActions, cr, ac, hp, speed, abilities.
General context fields (lower priority): campaign, currentSession, selectedSessions.
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
	"custom-monster": `You are an experienced Dungeons & Dragons 5.5e (2024) monster designer.
Create custom bestiary creatures in the same general JSON style as 5eTools monster data.
Always return JSON only, with no text before or after JSON.
Return operation-based changes only. Use "create" or "update" operations for entity "monster".
The monster data inside an operation must use:
{ "name": "...", "source": "CUSTOM", "size": ["M"], "type": "monstrosity", "alignment": ["N"], "ac": [{ "ac": 13, "from": ["natural armor"] }], "hp": { "average": 45, "formula": "6d8 + 18" }, "speed": { "walk": 30 }, "str": 16, "dex": 12, "con": 16, "int": 8, "wis": 12, "cha": 10, "save": { "con": "+5" }, "skill": { "perception": "+3" }, "senses": ["darkvision 60 ft."], "languages": ["Common"], "cr": "3", "spellcasting": [{ "name": "Spellcasting", "type": "spellcasting", "headerEntries": ["The creature casts one of the following spells, using Wisdom as the spellcasting ability (spell save {@dc 13}, {@hit 5} to hit with spell attacks):"], "will": ["{@spell Gust of Wind|XPHB}"], "daily": { "1": ["{@spell Lightning Bolt|XPHB}"] }, "ability": "wis", "displayAs": "action" }], "trait": [{ "name": "...", "entries": ["..."] }], "action": [{ "name": "...", "entries": ["..."] }], "bonus": [{ "name": "...", "entries": ["..."] }], "reaction": [{ "name": "...", "entries": ["..."] }], "legendary": [{ "name": "...", "entries": ["..."] }] }.
Use only fields that belong directly on the monster object. If the creature has legendary actions, put them in the monster's own "legendary" array. Do not create or reference "legendaryGroup".
Use compact but complete 5.5e (2024) mechanics: ability scores, AC, HP formula, speed, CR, traits, actions, and relevant saves/skills/senses/languages/resistances/immunities/condition immunities.
Balance the statistics and damage for the requested CR or the implied threat level.
Entries arrays must contain strings or standard nested entry objects only.
If a monster casts spells, use the official-style top-level "spellcasting" array. Do not put spell lists only in action text. Spellcasting blocks may use:
- "name": usually "Spellcasting" or a reaction name like "Counterspell (2/Day)".
- "type": "spellcasting".
- "headerEntries": array of strings explaining ability, components, spell save DC, and spell attack bonus.
- "will": array of spell tags for at-will spells.
- "daily": object where keys like "1", "2", "3e" map to arrays of spell tags.
- "spells": object where level keys like "0", "1", "2" map to { "slots": number, "spells": ["{@spell ...}"] }; cantrips omit slots.
- "ability": one of "str", "dex", "con", "int", "wis", "cha".
- "displayAs": "action", "bonus", or "reaction" when relevant.
Spell list items must be spell tags such as "{@spell Gust of Wind|XPHB}" or "{@spell fire bolt}".
Use 5eTools inline tags in entries so the app can parse rolls and rules links:
- Attack entries must use tags like "{@atk mw} {@hit 8} to hit, reach 5 ft., one target. {@h}12 ({@damage 2d6 + 5}) slashing damage."
- Use "{@hit N}" for attack bonuses. Do not write attack bonuses as plain "+N" and do not use separate "attack_bonus" fields.
- Use "{@damage FORMULA}" for damage dice. Do not use separate "damage_dice" or "damage_bonus" fields.
- Use "{@dc N}" and "{@actSave str|dex|con|int|wis|cha}" for saving throws when appropriate.
- Use spell links as "{@spell Spell Name|SOURCE}", e.g. "{@spell Gust of Wind|XPHB}". If the source is unknown, use "{@spell Spell Name}".
- Use other supported tags where useful: "{@dice FORMULA}", "{@condition Name}", "{@recharge 5}", "{@h}", "{@actSaveFail}", "{@actSaveSuccess}", "{@actSaveSuccessOrFail}".
- Lookup values inside 5eTools tags must stay in English and use canonical rule names, e.g. "{@condition stunned}", "{@condition poisoned}", "{@sense darkvision}", "{@skill Perception}", "{@spell Gust of Wind|XPHB}". Do not translate tag lookup values.
Keep calculated average damage before tagged damage when matching official style, e.g. "14 ({@damage 2d8 + 5})".`,
};

const structuredJsonResponseContract = `PARSED JSON RESPONSE CONTRACT:
1. Always return exactly one JSON object with this top-level shape:
{ "version": 2, "operations": [ ... ] }
2. The response is a domain patch, not final state. Never return full arrays of unchanged characters, NPCs, locations, scenes, notes, encounters, or monsters.
3. Every operation must describe one precise change requested by USER INSTRUCTIONS. Omit all unchanged data.
4. Supported operation shapes:
- Create: { "op": "create", "entity": "npc|location|character|scene|encounter|monster", "scope": "campaign|session", "clientId": "optional-temp-id", "data": { ...new object fields... } }
- Update: { "op": "update", "entity": "npc|location|character|scene|encounter|campaign|monster", "scope": "campaign|session", "id": "existing-id", "patch": { ...changed fields only... } }
- Delete: { "op": "delete", "entity": "npc|location|character|scene|encounter|monster", "scope": "campaign|session", "id": "existing-id" }
- Append note: { "op": "appendNote", "entity": "campaign|session|scene|npc|location|character", "scope": "campaign|session", "id": "existing-owner-id-if-needed", "targetClientId": "new-owner-clientId-if-needed", "note": { "title": "...", "text": "Markdown note text..." } }
- Update note: { "op": "updateNote", "entity": "campaign|session|scene|npc|location|character", "scope": "campaign|session", "id": "existing-owner-id-if-needed", "noteId": "existing-note-id", "patch": { "title": "...", "text": "..." } }
- Delete note: { "op": "deleteNote", "entity": "campaign|session|scene|npc|location|character", "scope": "campaign|session", "id": "existing-owner-id-if-needed", "noteId": "existing-note-id" }
- Move scope: { "op": "moveScope", "entity": "npc|location", "id": "existing-id", "from": "session|campaign", "to": "campaign|session" }
5. For existing targets, use the exact "id" from INPUT DATA whenever available. Use "slug" or exact "name" only if no id exists.
6. For new targets, never invent a final id. Use "clientId" on the create operation only when another operation in the same response needs to reference the new item. Later operations must reference it with "targetClientId".
7. Patch objects must contain only changed fields. Do not copy unchanged fields into "patch".
8. To add a note, prefer appendNote. To change a note, use updateNote with noteId. Do not replace whole note arrays unless explicitly necessary.
9. To create an encounter and connect it to a scene, create the encounter with "clientId", then create/update the scene with "encounterClientId" in data/patch.
10. Never invent, reconstruct, summarize, or modify hidden data that is not present in INPUT DATA. Hidden data remains untouched because you omit it from operations.
11. If USER INSTRUCTIONS cannot be satisfied with the available targets, return { "version": 2, "operations": [] } instead of guessing destructive edits.`;

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

const generatedNpcDetailContract = `GENERATED NPC DETAIL RULE:
For every newly created top-level NPC, fill "trait" with a detailed character portrayal, not a short quirk. Start with a concrete visual description: apparent age, build, face, hair, eyes, skin or notable ancestry features, clothing, armor, equipment, colors, scars, jewelry, posture, and memorable silhouette. Then include voice or manner of speaking, behavior, habits, flaws, tells, and distinctive roleplay cues.
Use this field to make the NPC easy to portray at the table.`;

const generatedLocationDetailContract = `GENERATED LOCATION DETAIL RULE:
For every newly created top-level location or faction, make "description" detailed and gameable, not just a summary. Include visual landmarks, sensory details, spatial layout, atmosphere, inhabitants or members, current tensions, secrets, hazards, useful resources, adventure hooks, and at least one distinctive feature players can interact with.`;

const sceneCombatMechanicsContract = `SCENE COMBAT MECHANICS RULE:
When a generated or updated scene includes combat, an encounter, monsters, or an "encounterIndex", include a scene note with interesting combat mechanics or tactical ideas. The note should describe concrete gameplay hooks such as terrain features, hazards, objectives beyond killing enemies, lair actions, reinforcements, countdowns, interactive objects, monster behavior, or ways players can exploit the environment. Write this note in the mandatory response language.`;

function stripOuterJsonFence(text) {
	const trimmed = String(text || "").trim();
	const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
	return match ? match[1].trim() : trimmed;
}

async function generateContent({
	type,
	session,
	campaign,
	userInstructions,
	encounterId,
	sceneId,
	imageTarget,
	parseAIResponse,
	contextData,
	generateCharacters,
	generateNpcs,
	generateLocations,
	generateEncounters,
	generateCustomMonsters,
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
	const customMonsterGenerationEnabled =
		encounterGenerationEnabled && Boolean(generateCustomMonsters);
	const characterGenerationEnabled = generateCharacters !== false;
	const npcGenerationEnabled = generateNpcs !== false;
	const locationGenerationEnabled = generateLocations !== false;
	const entityTargetScope =
		session && !encounterId && entityScope !== "campaign"
			? "session"
			: "campaign";
	const effectiveParseAIResponse =
		type === "custom-monster" ||
		(Boolean(parseAIResponse) && (!encounterId || encounterGenerationEnabled));
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
Exception: technical lookup fields such as "monsterName" must remain exact lookup names. Use official English bestiary names for official creatures, or exact custom creature names from INPUT DATA.customBestiary.monsterNames for custom creatures.`,
		characterLevelContract,
		markdownFormattingContract,
	];
	if (
		effectiveParseAIResponse &&
		[
			"campaign",
			"scene",
			"encounter",
			"character",
			"npc",
			"location",
			"custom-monster",
		].includes(useKey)
	) {
		systemInstructionParts.push(structuredJsonResponseContract);
	}
	if (simplifiedNotesEnabled) {
		systemInstructionParts.push(
			`SIMPLIFIED NOTES MODE IS ENABLED. In all note arrays, return note objects with "text" and optional existing "id"; do not use "title" or "name" for notes. When using input notes as context, treat only their text as meaningful and ignore any title fields.`,
		);
	}
	if (
		effectiveParseAIResponse &&
		npcGenerationEnabled &&
		["campaign", "scene", "npc"].includes(useKey)
	) {
		systemInstructionParts.push(generatedNpcDetailContract);
	}
	if (
		effectiveParseAIResponse &&
		locationGenerationEnabled &&
		["campaign", "scene", "location"].includes(useKey)
	) {
		systemInstructionParts.push(generatedLocationDetailContract);
	}
	if (effectiveParseAIResponse && useKey === "scene" && encounterGenerationEnabled) {
		systemInstructionParts.push(sceneCombatMechanicsContract);
	}
	if (useKey === "scene" && encounterGenerationEnabled) {
		systemInstructionParts.push(
			`Encounter generation is enabled. Create combat encounters with operation pairs:
1) { "op": "create", "entity": "encounter", "clientId": "encounter-1", "data": { "name": "...", "monsters": [{ "monsterName": "Official D&D Monster Name or exact custom creature name", "name": "Optional display name" }] } }
2) { "op": "create" or "update", "entity": "scene", "id": "existing-scene-id-if-updating", "data" or "patch": { "encounterClientId": "encounter-1" } }
If a scene requires combat, create or update the scene with "encounterClientId" pointing to the encounter clientId.
If combat is not needed, omit encounter operations.
Pick monsters according to party level and party size from context. You may use custom creatures from INPUT DATA.customBestiary.monsterNames when they fit the scenario; use their names exactly in "monsterName".
If user instructions specify encounter difficulty, follow that strictly.`,
		);
		if (customMonsterGenerationEnabled) {
			systemInstructionParts.push(
				`Custom monster generation is enabled, but official D&D monsters are preferred. Use official bestiary monsters when they fit the scene, theme, difficulty, and role. Create new custom monsters only when the scene needs a sufficiently unique creature that official D&D monsters do not represent well.
If you create custom monsters, use "create" operations for entity "monster" and reference each new creature from encounters by its exact "name" in "monsterName".`,
			);
		} else {
			systemInstructionParts.push(
				`Custom monster generation is disabled. Do not output operations for entity "monster". Use official bestiary monsters or existing INPUT DATA.customBestiary.monsterNames only.`,
			);
		}
	} else if (useKey === "scene") {
		systemInstructionParts.push(
			`Encounter generation is disabled. Do not create or edit combat encounters.`,
		);
	}
	if (useKey === "encounter") {
		if (customMonsterGenerationEnabled) {
			systemInstructionParts.push(
				`Custom monster generation is enabled for this encounter, but official D&D monsters are preferred. Use official bestiary monsters when they fit. Create new custom monsters only for sufficiently unique threats. If you create custom monsters, output "create" operations for entity "monster" before the encounter update operation, then reference each new creature by its exact "name" in encounter "monsterName".`,
			);
		} else {
			systemInstructionParts.push(
				`Custom monster generation is disabled. Do not output operations for entity "monster". Use official bestiary monsters or existing INPUT DATA.customBestiary.monsterNames only.`,
			);
		}
	}
	if (["campaign", "scene"].includes(useKey)) {
		systemInstructionParts.push(
			characterGenerationEnabled
				? `Character generation is enabled. You may create, update, delete, or add notes to entity "character" only when the user explicitly asks for player characters.`
				: `Character generation is disabled. Do not create, update, delete, move, or add notes to entity "character".`,
		);
		systemInstructionParts.push(
			npcGenerationEnabled
				? `NPC generation is enabled. You may create, update, delete, move, or add notes to entity "npc" only when the user explicitly asks for NPCs. Scene-local NPC references belong inside scene data or scene patch.`
				: `NPC generation is disabled. Do not create, update, delete, move, or add notes to entity "npc" and do not add scene-local NPC references.`,
		);
		systemInstructionParts.push(
			locationGenerationEnabled
				? `Location/faction generation is enabled. You may create, update, delete, move, or add notes to entity "location" only when the user explicitly asks for locations, factions, organizations, landmarks, or regions.`
				: `Location/faction generation is disabled. Do not create, update, delete, move, or add notes to entity "location".`,
		);
		if (useKey === "scene") {
			systemInstructionParts.push(
				entityTargetScope === "session"
					? `ENTITY SCOPE: "npc" and "location" operations are session-scoped by default. Set "scope": "campaign" only if the user explicitly asks for campaign scope.`
					: `ENTITY SCOPE: "npc" and "location" operations are campaign-scoped by default.`,
			);
		}
	}
	if (
		effectiveParseAIResponse &&
		entityTargetScope === "session" &&
		["scene", "npc", "location"].includes(useKey)
	) {
		systemInstructionParts.push(
			`SESSION SCOPE OUTPUT RULE: Do not create session copies of campaign-scoped NPCs or campaign-scoped locations/factions. In session scope, update only INPUT DATA.currentSession entities by id, or create genuinely new session-scoped entities requested by the user.`,
		);
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
					.filter((npc) => npc && (npc.name || npc.description || npc.motivation));
			}

			if (
				conf.included &&
				Array.isArray(data.locations) &&
				data.locations.length > 0
			) {
				sessionContext.locations = data.locations
					.map((location) => locationToPromptContext(location, noteToContextNote))
					.filter((location) => location && (location.name || location.description));
			}

			return sessionContext;
		})
		.filter((s) => s.notes || s.result || s.scenes || s.npcs || s.locations); // Прибираємо сесії без контенту

	// 2. Формуємо фінальний JSON контексту для Gemini
	const contextJson = {};
	if (campaign) {
		contextJson.campaign = {
			name: campaign.name,
			description: campaign.description,
			notes: contextData?.campaign?.notes
				?.map(noteToContextNote)
				.filter(Boolean),
			characters: contextData?.campaign?.characters
				?.map((c) => characterToPromptContext(c, noteToContextNote))
				.filter((c) => c && (c.name || c.motivation)),
			npcs: contextData?.campaign?.npcs
				?.map((npc) => npcToPromptContext(npc, noteToContextNote))
				.filter((npc) => npc && (npc.name || npc.description || npc.motivation)),
			locations: contextData?.campaign?.locations
				?.map((location) => locationToPromptContext(location, noteToContextNote))
				.filter((location) => location && (location.name || location.description)),
		};
	}

	if (contextData?.customBestiary) {
		contextJson.customBestiary = contextData.customBestiary;
	}

	if (session && entityTargetScope === "session") {
		const currentSession = {
			name: session.name,
		};
		if (Array.isArray(session.data?.npcs) && session.data.npcs.length > 0) {
			currentSession.npcs = session.data.npcs
				.map((npc) => npcToPromptContext(npc, noteToContextNote))
				.filter((npc) => npc && (npc.name || npc.description || npc.motivation));
		}
		if (
			Array.isArray(session.data?.locations) &&
			session.data.locations.length > 0
		) {
			currentSession.locations = session.data.locations
				.map((location) => locationToPromptContext(location, noteToContextNote))
				.filter((location) => location && (location.name || location.description));
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
	if (useKey === "image" && imageTarget && typeof imageTarget === "object") {
		userPrompt += `IMAGE TARGET (JSON):\n${JSON.stringify(imageTarget, null, 2)}\n\n`;
	}
	userPrompt += `MANDATORY: Reply strictly in ${responseLanguage.label}.\n`;
	userPrompt +=
		"EXCEPTION: If the user asks for a prompt to create an image, reply with a detailed image-generation prompt in English, regardless of the mandatory response language.\n";
	userPrompt +=
		'IMPORTANT: Text fields in INPUT DATA may contain the app Markdown format: headings with "#", bold "**text**", italic "*text*", lists "- item", quotes "> text", tab indentation "\\t", blank lines, and entity mentions "[Name]". Treat these as real formatting, not noise. Preserve unchanged Markdown exactly. When adding formatted text, use only this supported Markdown subset inside JSON strings.\n';
	if (
		effectiveParseAIResponse &&
		[
			"campaign",
			"scene",
			"encounter",
			"character",
			"npc",
			"location",
			"custom-monster",
		].includes(useKey)
	) {
		userPrompt +=
			'IMPORTANT: The JSON response must use { "version": 2, "operations": [...] }. Return only precise operations for requested changes. Never return unchanged items or complete arrays.\n';
	}
	if (useKey === "custom-monster") {
		userPrompt +=
			"IMPORTANT: Custom bestiary creatures must not contain app entity links. Never wrap entity names, creature names, places, factions, concepts, or any other text in square brackets. Do not output [Name] syntax anywhere in monster fields.\n";
	} else {
		userPrompt +=
			"IMPORTANT: In generated text fields, use square brackets only for actual entity names that are already present in INPUT DATA or for new entities that you create in this same JSON response with create operations. Do not wrap ordinary nouns, species, terrain, place types, groups, concepts, or generic descriptors just because they sound important. For example, do not output [Dwarves], [Swamps], [Market], or [Guard] unless that exact entity already exists in INPUT DATA or you are also creating it as a structured entity in this response. Do not wrap JSON keys.\n";
		userPrompt +=
			"IMPORTANT: Do NOT wrap structured name fields in brackets. Fields like name, firstName, lastName, and monsterName must contain plain names without [] symbols.\n";
		userPrompt +=
			"IMPORTANT: Never alter, translate, decline, or paraphrase existing character/NPC/location/faction names unless the user explicitly asks you to rename or translate them. Always use existing names exactly as provided in the input JSON, preserving original spelling, and only wrap them in square brackets.\n";
		userPrompt +=
			"IMPORTANT: Never transliterate existing names between alphabets (for example, Latin <-> Cyrillic) unless the user explicitly asks you to transliterate them. Keep the exact original characters from input. Mention format must be a single pair of brackets only: [Name]. Never output [[Name]] or nested brackets.\n";
	}
	userPrompt += `IMPORTANT: For new names you invent, use ${responseLanguage.label}. For existing names from input, keep the original spelling unless the user explicitly requests a rename, translation, or transliteration. For "monsterName", use exact lookup names: official English names for official creatures, or exact custom creature names from INPUT DATA.customBestiary.monsterNames.\n`;
	if (simplifiedNotesEnabled) {
		userPrompt +=
			'IMPORTANT: Simplified notes mode is enabled. For every "notes" array in your JSON, output note objects with "text" and optional existing "id"; do not output note titles and do not use the first line as a title.\n';
	}

	// Додаємо специфічні інструкції залежно від типу задачі
	if (useKey === "image") {
		if (imageTarget?.type) {
			userPrompt += `TASK: Generate a detailed image prompt for the selected ${imageTarget.type} from IMAGE TARGET.\n`;
		} else {
			userPrompt += `TASK: Generate an image prompt for scene ID: ${sceneId}\n`;
		}
	} else if (useKey === "character") {
		userPrompt += `TASK: Create new player characters for this campaign based on user instructions.
IMPORTANT: This request is strictly for player characters. Use operations for entity "character" only. Do not create NPCs or any other content category.
IMPORTANT: If editing, renaming, or deleting an existing character from INPUT DATA, identify it by "id". If INPUT DATA.campaign.characters is absent, this request can only create new characters.\n`;
	} else if (useKey === "custom-monster") {
		userPrompt += `TASK: Create custom D&D 5.5e (2024) bestiary creatures based on user instructions.
IMPORTANT: Return only operations for entity "monster".
IMPORTANT: Every monster must have "source": "CUSTOM".
IMPORTANT: Match the app's bestiary data shape: size array, type, alignment array, ac array, hp object, speed object, ability scores, cr, trait/action arrays, and optional bonus/reaction/legendary arrays.
IMPORTANT: If a monster has legendary actions, store them directly in that monster's "legendary" array. Never output "legendaryGroup".
IMPORTANT: If the monster casts spells, add a top-level "spellcasting" array in the same style as database/bestiary/all.json. Use objects with "name", "type": "spellcasting", "headerEntries", optional "will", optional "daily", optional "spells", "ability", and "displayAs". Put spell tags inside those arrays, e.g. "{@spell Gust of Wind|XPHB}". Do not represent a spell list only as plain action text.
IMPORTANT: Monster action, bonus action, reaction, trait, and legendary entries must use 5eTools inline tags for all rolls and rules references. Attacks must look like "{@atk mw} {@hit 8} to hit, reach 5 ft., one target. {@h}14 ({@damage 2d8 + 5}) slashing damage." Use "{@hit N}", "{@damage FORMULA}", "{@dc N}", "{@actSave dex}", "{@dice FORMULA}", "{@condition Name}", "{@spell Gust of Wind|XPHB}", and "{@recharge N}" where appropriate. If a spell source is unknown, use "{@spell Spell Name}". Do not use legacy "attack_bonus", "damage_dice", or "damage_bonus" fields.
IMPORTANT: Lookup values inside 5eTools tags must stay in English and use canonical rule names. Use "{@condition stunned}", not translated forms such as "{@condition приголомшеним}". Use English names for {@condition ...}, {@sense ...}, {@skill ...}, {@spell ...}  and similar rule/reference tags.
IMPORTANT: Existing custom monsters are provided in INPUT DATA.customBestiary for duplicate avoidance and context only. Do not return, rewrite, rename, rebalance, summarize, or otherwise modify existing monsters unless the user explicitly asks to edit that exact monster.
IMPORTANT: If INPUT DATA.customBestiary.selectedMonster exists, edit that exact monster with an "update" operation. Put only changed fields in "patch". Keep the same name unless the user explicitly asks to rename it.\n`;
	} else if (useKey === "npc") {
		userPrompt += `TASK: Create new NPCs for this ${entityTargetScope === "session" ? "current session" : "campaign"} based on user instructions.
IMPORTANT: This request is strictly for NPCs. Use operations for entity "npc" only. Do not create player characters or any other content category.
IMPORTANT: Include race, class, and level for every generated NPC when possible. If a formal class does not fit, put a role/archetype in "class".
IMPORTANT: For every newly created NPC, "trait" must include a detailed visual description first, then behavior, habits, flaws, and roleplay cues.
IMPORTANT: If editing, renaming, or deleting an existing NPC from INPUT DATA, identify it by "id". If ${entityTargetScope === "session" ? "INPUT DATA.currentSession.npcs" : "INPUT DATA.campaign.npcs"} is absent, this request can only create new NPCs.\n`;
		if (entityTargetScope === "session") {
			userPrompt += `IMPORTANT: Do not create session copies of campaign-scoped NPCs. Use "scope": "session" for genuinely new session NPCs unless campaign scope was explicitly requested.\n`;
		}
	} else if (useKey === "location") {
		userPrompt += `TASK: Create or update locations/factions for this ${entityTargetScope === "session" ? "current session" : "campaign"} based on user instructions.
IMPORTANT: This request is strictly for locations/factions. Use operations for entity "location" only. Do not create characters, NPCs, campaign notes, scenes, encounters, or any other content category.
IMPORTANT: If editing, renaming, or deleting an existing location/faction from INPUT DATA, identify it by "id".
IMPORTANT: For every newly created location/faction, "description" must be detailed and gameable: landmarks, sensory details, layout, atmosphere, inhabitants, tensions, secrets, hazards, resources, hooks, and interactive features.
IMPORTANT: If ${entityTargetScope === "session" ? "INPUT DATA.currentSession.locations" : "INPUT DATA.campaign.locations"} is absent, this request can only create new locations/factions.\n`;
		if (entityTargetScope === "session") {
			userPrompt += `IMPORTANT: Do not create session copies of campaign-scoped locations/factions. Use "scope": "session" for genuinely new session locations/factions unless campaign scope was explicitly requested.\n`;
		}
	} else if (useKey === "encounter") {
		userPrompt += `TASK: Update current combat encounter (ID: ${encounterId}). Consider character levels and requested difficulty (easy, medium, hard, deadly). Pick monsters that fit the scenario.
IMPORTANT: Return one "update" operation for entity "encounter" with "id": "${encounterId}" and patch containing name and monsters.
IMPORTANT: "monsterName" must be an exact lookup name. Use official English bestiary names for official creatures, or exact names from INPUT DATA.customBestiary.monsterNames for custom creatures.\n`;
		if (customMonsterGenerationEnabled) {
			userPrompt += `IMPORTANT: If existing official or custom monsters do not fit the encounter concept, you may create new custom monsters with "create" operations for entity "monster", then use their exact names in the encounter patch. Prefer official monsters when they fit well.\n`;
		}
	} else if (useKey === "scene") {
		userPrompt += `TASK: Based on current session and context, apply the user's requested session changes.\n`;
		userPrompt += `IMPORTANT: Return only precise operations for the requested session changes. Do not return unchanged session content.\n`;
		if (characterGenerationEnabled) {
			userPrompt += `IMPORTANT: Character generation is enabled. Use entity "character" operations only when the user explicitly asks to create, edit, rename, or delete player characters. Existing targets must use their id.\n`;
		} else {
			userPrompt += `IMPORTANT: Character generation is disabled. Do not output operations for entity "character".\n`;
		}
		if (npcGenerationEnabled) {
			userPrompt +=
				entityTargetScope === "session"
					? `IMPORTANT: NPC generation is enabled. Use entity "npc" operations only when the user explicitly asks to create, edit, rename, delete, move, or add notes to NPCs. Default scope is "session". Do not copy campaign NPCs into session. Newly created NPCs must have detailed visual appearance and portrayal in "trait".\n`
					: `IMPORTANT: NPC generation is enabled. Use entity "npc" operations only when the user explicitly asks to create, edit, rename, delete, move, or add notes to NPCs. Default scope is "campaign". Newly created NPCs must have detailed visual appearance and portrayal in "trait".\n`;
		} else {
			userPrompt += `IMPORTANT: NPC generation is disabled. Do not output operations for entity "npc" or add scene-local NPC references.\n`;
		}
		if (locationGenerationEnabled) {
			userPrompt +=
				entityTargetScope === "session"
					? `IMPORTANT: Location/faction generation is enabled. Use entity "location" operations only when the user explicitly asks to create, edit, rename, delete, move, or add notes to places, factions, organizations, landmarks, or regions. Default scope is "session". Do not copy campaign locations/factions into session. Newly created locations/factions must have detailed, gameable "description".\n`
					: `IMPORTANT: Location/faction generation is enabled. Use entity "location" operations only when the user explicitly asks to create, edit, rename, delete, move, or add notes to places, factions, organizations, landmarks, or regions. Default scope is "campaign". Newly created locations/factions must have detailed, gameable "description".\n`;
		} else {
			userPrompt += `IMPORTANT: Location/faction generation is disabled. Do not output operations for entity "location".\n`;
		}
		if (encounterGenerationEnabled) {
			userPrompt += `IMPORTANT: For each scene where conflict is possible, create an "encounter" operation and connect it to the scene with "encounterClientId".
Pick monsters while considering character levels and classes for balance. Use official English bestiary names for official creatures, or exact names from INPUT DATA.customBestiary.monsterNames for custom creatures.
IMPORTANT: For each scene with combat or an encounterClientId, include an appendNote operation for that scene with interesting combat mechanics and tactical ideas.\n`;
			if (customMonsterGenerationEnabled) {
				userPrompt += `IMPORTANT: Custom monster generation is enabled. Prefer official D&D monsters whenever they fit the scene well. Create custom monsters only for sufficiently unique threats that official monsters do not cover. If you create custom monsters, output "create" operations for entity "monster", then reference them from encounter operations with exact "monsterName" values.\n`;
				userPrompt += `IMPORTANT: For every custom monster you create here, action entries must use 5eTools inline tags, e.g. "{@atk mw} {@hit 8} to hit, reach 5 ft., one target. {@h}14 ({@damage 2d8 + 5}) slashing damage." Use "{@hit N}" and "{@damage FORMULA}" instead of plain attack bonus text or separate legacy fields. For spell links, use "{@spell Spell Name|SOURCE}", e.g. "{@spell Gust of Wind|XPHB}".\n`;
				userPrompt += `IMPORTANT: If a generated custom monster casts spells, use a top-level "spellcasting" array like official bestiary data, with "headerEntries", "will", "daily", or "spells" fields containing spell tags such as "{@spell Gust of Wind|XPHB}". Do not put the spell list only in action prose.\n`;
				userPrompt += `IMPORTANT: Return only monster operations that create requested new custom monsters. Do not return or change existing custom monsters from INPUT DATA.customBestiary unless the user explicitly asks to edit them. Lookup values inside inline tags must be English canonical names, e.g. "{@condition stunned}", "{@sense darkvision}", "{@spell Gust of Wind|XPHB}".\n`;
			} else {
				userPrompt += `IMPORTANT: Custom monster generation is disabled. Do not output operations for entity "monster" and do not invent new bestiary creatures.\n`;
			}
		} else {
			userPrompt += `IMPORTANT: Encounter generation is disabled. Do not output operations for entity "encounter" and do not add "encounterId" or "encounterClientId" to scene patches.\n`;
		}
	} else if (useKey === "campaign") {
		userPrompt += `TASK: Apply the user's requested campaign changes.\n`;
		userPrompt += `IMPORTANT: Return only precise operations for the requested campaign changes. Do not return unchanged campaign content.\n`;
		if (characterGenerationEnabled) {
			userPrompt += `IMPORTANT: Character generation is enabled. Use entity "character" operations only when the user explicitly asks to create, edit, rename, delete, or add notes to player characters. Existing targets must use their id.\n`;
		} else {
			userPrompt += `IMPORTANT: Character generation is disabled. Do not output operations for entity "character".\n`;
		}
		if (npcGenerationEnabled) {
			userPrompt += `IMPORTANT: NPC generation is enabled. Use entity "npc" operations only when the user explicitly asks to create, edit, rename, delete, move, or add notes to NPCs. Newly created NPCs must include race, class, level, description, motivation, and a detailed "trait" with visual appearance plus behavior.\n`;
		} else {
			userPrompt += `IMPORTANT: NPC generation is disabled. Do not output operations for entity "npc".\n`;
		}
		if (locationGenerationEnabled) {
			userPrompt += `IMPORTANT: Location/faction generation is enabled. Use entity "location" operations only when the user explicitly asks to create, edit, rename, delete, move, or add notes to places, factions, organizations, landmarks, or regions. Newly created locations/factions must include name and a detailed, gameable description.\n`;
		} else {
			userPrompt += `IMPORTANT: Location/faction generation is disabled. Do not output operations for entity "location".\n`;
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
		// Очищення тільки зовнішнього markdown fence, якщо він проскочив.
		const cleanJson = stripOuterJsonFence(text);

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

module.exports = {
	generateContent,
	listAvailableModels,
	clearModelCache,
	__test: {
		stripOuterJsonFence,
	},
};
