const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs/promises");
const path = require("path");
const storage = require("./storage");

const GEMINI_MODELS_ENDPOINT =
	"https://generativelanguage.googleapis.com/v1beta/models";
const MODEL_CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_AI_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_AI_IMAGES = 4;
const MAX_AI_FILE_BYTES = 10 * 1024 * 1024;
const MAX_AI_FILES = 4;
const AI_IMAGE_MIME_TYPES = Object.freeze({
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".png": "image/png",
	".webp": "image/webp",
	".gif": "image/gif",
});
const AI_ALLOWED_IMAGE_MIME_TYPES = new Set(Object.values(AI_IMAGE_MIME_TYPES));
const AI_FILE_MIME_TYPES = Object.freeze({
	".csv": "text/csv",
	".css": "text/css",
	".htm": "text/html",
	".html": "text/html",
	".js": "text/javascript",
	".json": "application/json",
	".md": "text/markdown",
	".markdown": "text/markdown",
	".pdf": "application/pdf",
	".scss": "text/css",
	".txt": "text/plain",
	".xml": "application/xml",
	".yaml": "application/x-yaml",
	".yml": "application/x-yaml",
});
const AI_TEXT_FILE_MIME_TYPES = new Set([
	"application/json",
	"application/x-yaml",
	"application/xml",
	"text/css",
	"text/csv",
	"text/html",
	"text/javascript",
	"text/markdown",
	"text/plain",
	"text/xml",
]);
const AI_ALLOWED_FILE_MIME_TYPES = new Set([
	...Object.values(AI_FILE_MIME_TYPES),
	"text/xml",
]);
const CORE_TEXT_MODELS = [
	"gemini-3.1-flash-lite-preview",
	"gemini-3-flash-preview",
	"gemini-2.5-flash",
	"gemini-2.5-pro",
	"gemini-2.5-flash-lite",
	"gemini-2.0-flash",
];
const FALLBACK_TEXT_MODELS = ["gemini-2.5-flash", "gemini-2.5-pro"];
const PREFERRED_FAST_TEXT_MODELS = [
	"gemini-3.1-flash-lite-preview",
	"gemini-3-flash-preview",
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
		description: entity.description,
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
For "npc" and "location" operations in session planning, set "scope" explicitly. Default new NPCs and locations/factions to "session" unless they clearly belong to the wider campaign.
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
Do not use app entity-link syntax. Never wrap names, places, creatures, factions, or any other text in square brackets.
Describe in this order:
1) Scene overview
2) Location and environment
3) Characters and actions
4) Lighting
5) Atmosphere
6) Style (cinematic, photorealistic, concept art, etc.)
Use the configured image prompt base style from system instructions when provided.
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
- Use "{@dc N}" and "{@actSave str|dex|con|int|wis|cha}" for saving throws when appropriate, for example "{@actSave dex} {@dc 11}".
- Use spell links as "{@spell Spell Name|SOURCE}", e.g. "{@spell Gust of Wind|XPHB}". If the source is unknown, use "{@spell Spell Name}".
- Use other supported tags where useful: "{@dice FORMULA}", "{@condition Name}", "{@recharge 5}", "{@h}", "{@actSaveFail}", "{@actSaveSuccess}", "{@actSaveSuccessOrFail}".
- Lookup values inside 5eTools tags must stay in English and use canonical rule names, e.g. "{@condition stunned}", "{@condition poisoned}", "{@sense darkvision}", "{@skill Perception}", "{@spell Gust of Wind|XPHB}". Do not translate tag lookup values.
Keep calculated average damage before tagged damage when matching official style, e.g. "14 ({@damage 2d8 + 5})".`,
};

const structuredJsonResponseContract = `PARSED JSON RESPONSE CONTRACT:
1. Always return exactly one JSON object with this top-level shape:
{ "version": 2, "operations": [ ... ] }
2. Return raw JSON only: no Markdown fence, no prose, no comments, no keys outside "version" and "operations".
3. The response is a domain patch, not final state. Never return full arrays of unchanged characters, NPCs, locations, scenes, notes, encounters, or monsters.
4. Operation names are case-sensitive. Use exactly: "create", "update", "delete", "appendNote", "updateNote", "deleteNote", "moveScope".
5. Entity names are case-sensitive. Prefer exactly: "campaign", "session", "character", "npc", "location", "scene", "encounter", "monster".
6. Every operation must describe one precise change requested by USER INSTRUCTIONS. Omit all unchanged data.
7. Supported operation shapes:
- Create: { "op": "create", "entity": "npc|location|character|scene|encounter|monster", "scope": "campaign|session", "clientId": "optional-temp-id", "data": { ...new object fields... } }
- Update: { "op": "update", "entity": "npc|location|character|scene|encounter|monster", "scope": "campaign|session", "id": "existing-id", "patch": { ...changed fields only... } }
- Update campaign description: { "op": "update", "entity": "campaign", "patch": { "description": "..." } }
- Delete: { "op": "delete", "entity": "npc|location|character|scene|encounter|monster", "scope": "campaign|session", "id": "existing-id" }
- Append note: { "op": "appendNote", "entity": "campaign|session|scene|npc|location|character", "scope": "campaign|session", "id": "existing-owner-id-if-needed", "targetClientId": "new-owner-clientId-if-needed", "note": { "title": "...", "text": "Markdown note text..." } }
- Update note: { "op": "updateNote", "entity": "campaign|session|scene|npc|location|character", "scope": "campaign|session", "id": "existing-owner-id-if-needed", "noteId": "existing-note-id", "patch": { "title": "...", "text": "..." } }
- Delete note: { "op": "deleteNote", "entity": "campaign|session|scene|npc|location|character", "scope": "campaign|session", "id": "existing-owner-id-if-needed", "noteId": "existing-note-id" }
- Move scope: { "op": "moveScope", "entity": "npc|location", "id": "existing-id-or-use-targetClientId", "targetClientId": "new-entity-clientId-if-needed", "from": "session|campaign", "to": "campaign|session" }
8. For existing targets, use the exact "id" from INPUT DATA whenever available. Use "slug" or exact "name" only if no id exists. Campaign updates are the only update operations that do not need an id.
9. Omit "scope" for "monster" operations. Monsters belong to the custom bestiary, not campaign/session scope.
10. For new targets, never invent a final id. Use "clientId" on the create operation only when another operation in the same response needs to reference the new item. Later operations must reference it with "targetClientId", including moveScope operations for an entity created earlier in the same response.
11. Patch objects must contain only changed fields. Do not copy unchanged fields into "patch".
12. To add a note, prefer appendNote. To change a note, use updateNote with noteId. Do not replace whole note arrays unless explicitly necessary.
13. To create an encounter and connect it to a scene, create the encounter with "clientId", then create/update the scene with "encounterClientId" in data/patch. Existing encounter updates must include the encounter "id".
14. Never invent, reconstruct, summarize, or modify hidden data that is not present in INPUT DATA. Hidden data remains untouched because you omit it from operations.
15. If USER INSTRUCTIONS cannot be satisfied with the available targets, return { "version": 2, "operations": [] } instead of guessing destructive edits.`;

const operationTargetIdentityContract = `OPERATION TARGET IDENTITY RULE:
Use "create" for new entities and "update" only for entities that already exist in INPUT DATA.
Every "update" and "delete" operation must include one of: exact existing "id", exact existing "slug", exact existing "name", or "targetClientId" for an item created earlier in the same response.
If you are editing the current selected encounter, include its exact INPUT DATA.currentEncounter.id in the encounter update operation.
If you are editing an existing scene, include its exact scene id from INPUT DATA.currentSession.scenes or INPUT DATA.selectedSessions.
If you cannot identify an existing target id/slug/name, do not output update/delete. Output create for new content, appendNote for new notes, or no operation.`;

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

const entityMentionContract = `APP ENTITY MENTION RULE:
Use [Exact Entity Name] only for actual existing entities from INPUT DATA or for new entities created in this same JSON response. Do not bracket ordinary nouns, species, terrain, concepts, JSON keys, or structured name fields.
Existing character/NPC/location/faction names must keep their exact spelling and alphabet. Do not translate, transliterate, decline, or rename them unless USER INSTRUCTIONS explicitly ask for it.
When session content needs an existing campaign NPC/location/faction, mention it as [Exact Entity Name] in scene texts or note text. Do not create a copied session entity just to use it in session content.`;

const sessionEntityScopeDecisionContract = `SESSION ENTITY SCOPE DECISION RULE:
In session planning, new NPCs and locations/factions are session-scoped by default.
Use "scope": "session" for one-shot, scene-specific, temporary, incidental, or currently unnamed/low-consequence content. This includes witnesses, guards, merchants, messengers, victims, tavern staff, ambushers, small hideouts, rooms, alleys, caves, shrines, camps, clue sites, encounter locations, temporary safehouses, and any place or NPC created mainly to make the current session playable.
Use "scope": "campaign" only when the entity is explicitly requested for the campaign/global scope, is expected to recur across multiple sessions, is a major campaign hub/region/faction/organization, is a long-term antagonist/patron/ally, is tied to a player character or campaign premise, or must be reusable outside the current session.
If uncertain, choose "scope": "session".
A single response may mix scopes, but decide per entity. Every "npc" and "location" create/update/delete/appendNote operation in a session request must use "scope": "campaign" or "scope": "session".
Do not promote a new session entity to campaign scope just because it has a proper name or a detailed description.
If an existing entity is in the wrong scope for its logical use, output moveScope. Move campaign to session when it is no longer a reusable campaign entity and should belong only to the current session. Move session to campaign when it becomes recurring or campaign-important.
When creating a new entity and then realizing it belongs in the other scope, create it with clientId and immediately output moveScope using targetClientId.`;

const customMonsterNoEntityLinksContract = `CUSTOM MONSTER TEXT RULE:
Custom bestiary creatures must not contain app entity links. Do not output [Name] syntax anywhere in monster fields.`;

const generatedNpcDetailContract = `GENERATED NPC DETAIL RULE:
For every newly created top-level NPC, fill "description" with a detailed character portrayal, not a short quirk. Start with a concrete visual description: apparent age, build, face, hair, eyes, skin or notable ancestry features, clothing, armor, equipment, colors, scars, jewelry, posture, and memorable silhouette. Then include voice or manner of speaking, behavior, habits, flaws, tells, and distinctive roleplay cues.
Use this field to make the NPC easy to portray at the table.`;

const generatedLocationDetailContract = `GENERATED LOCATION DETAIL RULE:
For every newly created top-level location or faction, make "description" detailed and gameable, not just a summary. Include visual landmarks, sensory details, spatial layout, atmosphere, inhabitants or members, current tensions, secrets, hazards, useful resources, adventure hooks, and at least one distinctive feature players can interact with.`;

const sceneCombatMechanicsContract = `SCENE COMBAT MECHANICS RULE:
When a generated or updated scene includes combat, an encounter, monsters, or an "encounterIndex", include a scene note with interesting combat mechanics or tactical ideas. The note should describe concrete gameplay hooks such as terrain features, hazards, objectives beyond killing enemies, lair actions, reinforcements, countdowns, interactive objects, monster behavior, or ways players can exploit the environment. Write this note in the mandatory response language.`;

const encounterSceneLinkContract = `ENCOUNTER-SCENE LINK RULE:
Every created encounter must be linked to exactly one scene in the same JSON response.
When you create an encounter, always set a unique "clientId" on the encounter create operation.
In the paired scene create/update operation, set "encounterClientId" to that same clientId inside "data" or "patch".
Never create a standalone encounter during session generation. If you cannot identify the existing scene, create the scene too and link it.
For an existing scene, update it by exact scene "id" with "patch": { "encounterClientId": "encounter-1" }.
For a new scene, create it with "data": { "texts": { ... }, "encounterClientId": "encounter-1" }.
Do not put encounterClientId only in scene text or notes; it must be a JSON field.`;

const sceneDataContract = `SCENE DATA CONTRACT:
When creating a scene, always use "data": { "texts": { "summary": "...", "goal": "...", "stakes": "...", "location": "..." } }.
All four scene text fields are required and must be non-empty:
- summary: what happens in the scene and what the players immediately understand.
- goal: what the players can accomplish.
- stakes: what changes if they succeed, fail, hesitate, or choose poorly.
- location: where the scene happens; use a concrete place name or short descriptive location.
Do not create placeholder or empty scenes. If there is not enough information to make a useful scene, omit the scene operation.
When updating an existing scene, use "patch": { "texts": { ...changed fields only... } } and never blank an existing field unless USER INSTRUCTIONS explicitly ask to clear it.`;

const sessionNotesContract = `SESSION NOTES CONTRACT:
The current session has general notes stored on entity "session".
Use { "op": "appendNote", "entity": "session", "note": { "title": "...", "text": "..." } } for notes that describe the whole session, preparation, pacing, recap, reminders, secrets, open questions, DM checklist, or information not tied to one exact scene.
Use entity "scene" notes only when the note belongs to one specific scene and you can identify that scene by id or targetClientId.
Do not force general session-level information into a scene note.`;

const additiveEntityGenerationContract = `ENTITY GENERATION TOGGLES ARE ADDITIVE:
The character, NPC, location/faction, and encounter generation settings are permissions for what entity types may appear in one parsed response. They do not replace each other and do not change the user's task by themselves.
If multiple generation settings are enabled, you may include operations for any enabled entity type when USER INSTRUCTIONS explicitly request or clearly imply that entity type.
If an entity type is disabled, do not output operations for that entity type.
Do not narrow the whole response to only NPCs, only locations, only characters, or only encounters just because one of those toggles is enabled.`;

function stripOuterJsonFence(text) {
	const trimmed = String(text || "").trim();
	const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
	return match ? match[1].trim() : trimmed;
}

function extractFirstJsonObject(text) {
	const source = stripOuterJsonFence(text);
	const firstBrace = source.indexOf("{");
	if (firstBrace === -1) return source.trim();

	let depth = 0;
	let inString = false;
	let escaped = false;
	for (let index = firstBrace; index < source.length; index += 1) {
		const char = source[index];
		if (inString) {
			if (escaped) {
				escaped = false;
			} else if (char === "\\") {
				escaped = true;
			} else if (char === '"') {
				inString = false;
			}
			continue;
		}
		if (char === '"') {
			inString = true;
		} else if (char === "{") {
			depth += 1;
		} else if (char === "}") {
			depth -= 1;
			if (depth === 0) return source.slice(firstBrace, index + 1).trim();
		}
	}

	return source.trim();
}

function collectImageUrls(value, output = []) {
	if (!Array.isArray(value)) return output;
	if (Array.isArray(value)) {
		for (const item of value) {
			if (item?.url) output.push(String(item.url).trim());
			if (output.length >= MAX_AI_IMAGES) break;
		}
	}
	return output;
}

function isSafeImagePathPart(value) {
	const part = String(value || "");
	return (
		part &&
		part !== "." &&
		part !== ".." &&
		!part.includes("/") &&
		!part.includes("\\")
	);
}

function resolveLocalImageUrl(imageUrl) {
	let pathname = "";
	try {
		pathname = new URL(String(imageUrl || ""), "http://local").pathname;
	} catch {
		pathname = String(imageUrl || "");
	}

	const parts = pathname
		.split("/")
		.filter(Boolean)
		.map((part) => decodeURIComponent(part));
	if (parts.length < 5 || parts[0] !== "api" || parts[1] !== "images") {
		return null;
	}

	const [, , slug, category, ...relativeParts] = parts;
	if (!slug || !category || relativeParts.length === 0) return null;
	if (![slug, category, ...relativeParts].every(isSafeImagePathPart)) {
		return null;
	}

	const filePath = path.resolve(
		storage.IMAGES_DIR,
		slug,
		category,
		...relativeParts,
	);
	const rootPath = path.resolve(storage.IMAGES_DIR);
	if (filePath !== rootPath && !filePath.startsWith(`${rootPath}${path.sep}`)) {
		return null;
	}

	const mimeType = AI_IMAGE_MIME_TYPES[path.extname(filePath).toLowerCase()];
	if (!mimeType) return null;
	return { filePath, mimeType };
}

async function imageUrlToInlinePart(imageUrl) {
	const resolved = resolveLocalImageUrl(imageUrl);
	if (!resolved) return null;

	const stats = await fs.stat(resolved.filePath).catch(() => null);
	if (!stats?.isFile() || stats.size > MAX_AI_IMAGE_BYTES) return null;

	const data = await fs.readFile(resolved.filePath);
	return {
		inlineData: {
			data: data.toString("base64"),
			mimeType: resolved.mimeType,
		},
	};
}

function normalizeAttachedImageMimeType(image = {}) {
	const mimeType = String(image.mimeType || "")
		.trim()
		.toLowerCase();
	if (AI_ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) return mimeType;
	const byExtension = AI_IMAGE_MIME_TYPES[extensionFromName(image.name)];
	return byExtension || "";
}

function normalizeAttachedImageData(data) {
	const value = String(data || "").trim();
	if (!value) return "";
	const commaIndex = value.indexOf(",");
	return value.startsWith("data:") && commaIndex !== -1
		? value.slice(commaIndex + 1)
		: value;
}

function attachedImageToInlinePart(image = {}) {
	const mimeType = normalizeAttachedImageMimeType(image);
	if (!mimeType) return null;

	const data = normalizeAttachedImageData(image.data);
	if (!data) return null;

	let buffer;
	try {
		buffer = Buffer.from(data, "base64");
	} catch {
		return null;
	}
	if (!buffer.length || buffer.length > MAX_AI_IMAGE_BYTES) return null;

	return {
		inlineData: {
			data: buffer.toString("base64"),
			mimeType,
		},
	};
}

async function buildImageParts(attachedImages = []) {
	const images = Array.isArray(attachedImages)
		? attachedImages.slice(0, MAX_AI_IMAGES)
		: [];
	const parts = [];
	const seenUrls = new Set();
	for (const image of images) {
		const inlinePart = attachedImageToInlinePart(image);
		if (inlinePart) {
			parts.push(inlinePart);
			continue;
		}

		const url = String(image?.url || "").trim();
		if (!url || seenUrls.has(url)) continue;
		seenUrls.add(url);
		const urlPart = await imageUrlToInlinePart(url);
		if (urlPart) parts.push(urlPart);
	}
	return parts;
}

function extensionFromName(fileName) {
	return path.extname(String(fileName || "")).toLowerCase();
}

function normalizeAttachedFileMimeType(file = {}) {
	const byExtension = AI_FILE_MIME_TYPES[extensionFromName(file.name)];
	if (byExtension) return byExtension;
	const mimeType = String(file.mimeType || "")
		.trim()
		.toLowerCase();
	return AI_ALLOWED_FILE_MIME_TYPES.has(mimeType) ? mimeType : "";
}

function normalizeAttachedFileData(data) {
	const value = String(data || "").trim();
	if (!value) return "";
	const commaIndex = value.indexOf(",");
	return value.startsWith("data:") && commaIndex !== -1
		? value.slice(commaIndex + 1)
		: value;
}

function attachmentNameForPrompt(name) {
	return String(name || "attached-file").replace(/[\r\n]+/g, " ").trim();
}

function attachedFileToPart(file = {}) {
	const mimeType = normalizeAttachedFileMimeType(file);
	if (!mimeType) return [];

	const data = normalizeAttachedFileData(file.data);
	if (!data) return [];

	let buffer;
	try {
		buffer = Buffer.from(data, "base64");
	} catch {
		return [];
	}
	if (!buffer.length || buffer.length > MAX_AI_FILE_BYTES) return [];

	const name = attachmentNameForPrompt(file.name);
	if (AI_TEXT_FILE_MIME_TYPES.has(mimeType)) {
		return [
			{
				text: `ATTACHED FILE: ${name} (${mimeType})\n\n${buffer.toString("utf8")}`,
			},
		];
	}

	return [
		{ text: `ATTACHED FILE: ${name} (${mimeType})` },
		{
			inlineData: {
				data: buffer.toString("base64"),
				mimeType,
			},
		},
	];
}

function buildFileParts(attachedFiles = []) {
	const files = Array.isArray(attachedFiles)
		? attachedFiles.slice(0, MAX_AI_FILES)
		: [];
	return files.flatMap(attachedFileToPart);
}

async function generateContent({
	type,
	session,
	campaign,
	userInstructions,
	encounterId,
	sceneId,
	imageTarget,
	attachedImages,
	attachedFiles,
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
	globalBasePrompt,
	imagePromptBasePrompt,
	campaignBasePrompt,
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
				: requestedType && systemInstructions[requestedType]
					? requestedType
					: encounterId
						? "encounter"
						: session
							? "scene"
							: "campaign";
	const usesStructuredJsonContract =
		effectiveParseAIResponse &&
		[
			"campaign",
			"scene",
			"encounter",
			"character",
			"npc",
			"location",
			"custom-monster",
		].includes(useKey);

	const availableModels = await listAvailableModels();
	const requestedModel = normalizeModelName(modelName);
	const selectedModel = availableModels.models.some(
		(item) => item.name === requestedModel,
	)
		? requestedModel
		: availableModels.defaultModel;
	const systemInstructionParts = [
		systemInstructions[useKey] || systemInstructions.prompt,
	];
	if (useKey !== "image") {
		systemInstructionParts.push(
			`MANDATORY LANGUAGE RULE: Determine the response language from the text that appears after "USER INSTRUCTIONS (PRIORITY):". Write all user-visible output in that same language. If that text is empty or its language is ambiguous, use ${responseLanguage.label}.`,
		);
	}
	if (useKey === "prompt") {
		systemInstructionParts.push(imagePromptLanguageContract);
	}
	if (usesStructuredJsonContract) {
		systemInstructionParts.push(
			`NAME LANGUAGE RULE: Any new names you invent must use the language detected from "USER INSTRUCTIONS (PRIORITY):". If that text is empty or ambiguous, use ${responseLanguage.label}. This includes new character names, NPC names, place names, scene names, encounter names, aliases, titles, and display names.
EXISTING NAME PROTECTION: Names that already exist in the input data must keep their exact original spelling and alphabet. Do not translate, transliterate, decline, paraphrase, rename, or otherwise alter existing names unless the user explicitly asks you to do that.
Exception: technical lookup fields such as "monsterName" must remain exact lookup names. Use official English bestiary names for official creatures, or exact custom creature names from INPUT DATA.customBestiary.monsterNames for custom creatures.`,
			characterLevelContract,
			markdownFormattingContract,
		);
		systemInstructionParts.push(
			structuredJsonResponseContract,
			operationTargetIdentityContract,
		);
	}
	if (usesStructuredJsonContract && simplifiedNotesEnabled) {
		systemInstructionParts.push(
			`SIMPLIFIED NOTES MODE IS ENABLED. In all note arrays, return note objects with "text" and optional existing "id"; do not use "title" or "name" for notes. When using input notes as context, treat only their text as meaningful and ignore any title fields.`,
		);
	}
	if (usesStructuredJsonContract) {
		systemInstructionParts.push(
			useKey === "custom-monster"
				? customMonsterNoEntityLinksContract
				: entityMentionContract,
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
	if (
		effectiveParseAIResponse &&
		useKey === "scene" &&
		encounterGenerationEnabled
	) {
		systemInstructionParts.push(
			sceneCombatMechanicsContract,
			encounterSceneLinkContract,
		);
	}
	if (effectiveParseAIResponse && useKey === "scene") {
		systemInstructionParts.push(sceneDataContract, sessionNotesContract);
	}
	if (effectiveParseAIResponse && ["campaign", "scene"].includes(useKey)) {
		systemInstructionParts.push(additiveEntityGenerationContract);
	}
	if (useKey === "scene" && encounterGenerationEnabled) {
		systemInstructionParts.push(
			`Encounter generation is enabled. Every created encounter MUST be paired with a scene create/update operation in the same response:
1) { "op": "create", "entity": "encounter", "clientId": "encounter-1", "data": { "name": "...", "monsters": [{ "monsterName": "Official D&D Monster Name or exact custom creature name", "name": "Optional display name" }] } }
2) { "op": "update", "entity": "scene", "id": "existing-scene-id", "patch": { "encounterClientId": "encounter-1" } }
or
2) { "op": "create", "entity": "scene", "clientId": "scene-1", "data": { "texts": { "summary": "...", "goal": "...", "stakes": "...", "location": "..." }, "encounterClientId": "encounter-1" } }
Do not output encounter create operations without "clientId".
Do not invent a final encounter "id" for a new encounter. Link new encounters only through encounter create "clientId" and scene "encounterClientId".
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
				entityTargetScope === "mixed"
					? `ENTITY SCOPE: This session request may create both campaign-scoped and session-scoped NPC/location operations in one response. New NPCs and locations/factions are session-scoped by default. Set "scope": "session" unless the entity is clearly reusable campaign content. Set "scope": "campaign" only for wider-campaign entities. Never output "scope": "mixed". If you create a campaign-scoped NPC/location and it should belong only to the current session, immediately follow that create operation with moveScope from "campaign" to "session" using targetClientId.`
					: entityTargetScope === "session"
						? `ENTITY SCOPE: "npc" and "location" operations are session-scoped by default. Set "scope": "campaign" only for clearly reusable campaign content. If you create a campaign-scoped NPC/location during a session request and it should belong only to the current session, immediately follow that create operation with moveScope from "campaign" to "session" using targetClientId.`
						: `ENTITY SCOPE: "npc" and "location" operations are campaign-scoped by default.`,
			);
		}
	}
	if (
		effectiveParseAIResponse &&
		entityTargetScope !== "campaign" &&
		["scene", "npc", "location"].includes(useKey)
	) {
		systemInstructionParts.push(sessionEntityScopeDecisionContract);
		systemInstructionParts.push(
			`SESSION/CAMPAIGN ENTITY OUTPUT RULE:
Do not create session copies of campaign-scoped NPCs or campaign-scoped locations/factions.
If existing INPUT DATA.campaign.npcs or INPUT DATA.campaign.locations are needed in scenes, notes, goals, stakes, or location text, refer to them with [Exact Entity Name] mentions inside text fields instead of creating "npc" or "location" operations.
Set "scope" explicitly on every "npc" and "location" operation. Use only "campaign" or "session"; never use "mixed" as an operation scope.
Use "scope": "session" for genuinely new NPCs/locations/factions that are only needed in the current session.
Use "scope": "campaign" only for reusable NPCs/locations/factions that should remain available across the campaign.
Update INPUT DATA.currentSession entities by id when changing session-only entities. Update INPUT DATA.campaign entities by id only when the user asks to change the campaign entity itself.
If the user request or the content's logical use means an existing campaign NPC/location/faction should become session-only, output moveScope with "from": "campaign" and "to": "session" for that existing id.
If you create an NPC/location with "scope": "campaign" during a session request but it should belong only to this session, output a follow-up moveScope operation using the create operation's targetClientId.`,
		);
	}
	const normalizedGlobalBasePrompt = String(globalBasePrompt || "").trim();
	const normalizedCampaignBasePrompt = String(campaignBasePrompt || "").trim();
	const normalizedImagePromptBasePrompt = String(
		imagePromptBasePrompt || "",
	).trim();
	if (normalizedGlobalBasePrompt || normalizedCampaignBasePrompt) {
		systemInstructionParts.push(
			`USER BASE PROMPTS:
These are standing user preferences for all current and future requests. Follow them for style, tone, world assumptions, constraints, and recurring DM preferences unless they conflict with higher-priority system rules, JSON contracts, entity scope rules, or the user's current request.
GLOBAL BASE PROMPT:
${normalizedGlobalBasePrompt || "(none)"}
CAMPAIGN BASE PROMPT:
${normalizedCampaignBasePrompt || "(none)"}`,
		);
	}
	if (useKey === "image" && normalizedImagePromptBasePrompt) {
		systemInstructionParts.push(
			`IMAGE PROMPT BASE STYLE:
Append or incorporate this user-configured image style guidance into every generated image prompt unless the current user instructions explicitly override it:
${normalizedImagePromptBasePrompt}`,
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

	// 1. Flexible session filtering based on configured context.
	const filteredSessions = (contextData?.sessions || [])
		.map((s) => {
			const sessionContext = { id: s.slug, slug: s.slug, name: s.name };
			const conf = s.conf || {};
			const data = s.data || {};

			// Add notes when selected.
			if (conf.included && conf.notes && data.notes) {
				sessionContext.notes = data.notes
					.map(noteToContextNote)
					.filter(Boolean);
			}

			// Add session result when selected.
			if (conf.included && conf.result_text && data.result_text) {
				sessionContext.result = data.result_text;
			}

			// Add only selected scenes and their specific fields.
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

						// If an encounter is selected, look up monster names.
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
							if (field === "encounter") return; // Already handled above.
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
					.filter(
						(npc) => npc && (npc.name || npc.description || npc.motivation),
					);
			}

			if (
				conf.included &&
				Array.isArray(data.locations) &&
				data.locations.length > 0
			) {
				sessionContext.locations = data.locations
					.map((location) =>
						locationToPromptContext(location, noteToContextNote),
					)
					.filter(
						(location) => location && (location.name || location.description),
					);
			}

			return sessionContext;
		})
		.filter((s) => s.notes || s.result || s.scenes || s.npcs || s.locations); // Remove sessions without content.

	// 2. Build final JSON context for Gemini.
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
				.filter(
					(c) => c && (c.name || c.description || c.motivation || c.trait),
				),
			npcs: contextData?.campaign?.npcs
				?.map((npc) => npcToPromptContext(npc, noteToContextNote))
				.filter(
					(npc) =>
						npc && (npc.name || npc.description || npc.motivation || npc.trait),
				),
			locations: contextData?.campaign?.locations
				?.map((location) =>
					locationToPromptContext(location, noteToContextNote),
				)
				.filter(
					(location) => location && (location.name || location.description),
				),
		};
	}

	if (contextData?.customBestiary) {
		contextJson.customBestiary = contextData.customBestiary;
	}

	if (session && entityTargetScope !== "campaign") {
		const currentSessionData =
			contextData?.currentSession?.data &&
			typeof contextData.currentSession.data === "object"
				? contextData.currentSession.data
				: session.data || {};
		const currentSession = {
			id: session.id,
			slug: contextData?.currentSession?.slug,
			fileName: contextData?.currentSession?.fileName,
			name: contextData?.currentSession?.name || session.name,
		};
		if (
			Array.isArray(currentSessionData.scenes) &&
			currentSessionData.scenes.length > 0
		) {
			currentSession.scenes = currentSessionData.scenes.map((scene) => ({
				id: scene.id,
				texts: scene.texts,
				encounterId: scene.encounterId || "",
				notes: (scene.notes || []).map(noteToContextNote).filter(Boolean),
				npcs: scene.npcs || [],
			}));
		}
		if (
			Array.isArray(currentSessionData.encounters) &&
			currentSessionData.encounters.length > 0
		) {
			currentSession.encounters = currentSessionData.encounters.map(
				(encounter) => ({
					id: encounter.id,
					name: encounter.name,
					monsters: (encounter.monsters || []).map((monster) => ({
						name: monster.name,
						monsterName: monster.originalBestiaryName || monster.name,
						cr: monster.cr || monster.challenge_rating,
					})),
				}),
			);
		}
		if (
			Array.isArray(currentSessionData.npcs) &&
			currentSessionData.npcs.length > 0
		) {
			currentSession.npcs = currentSessionData.npcs
				.map((npc) => npcToPromptContext(npc, noteToContextNote))
				.filter(
					(npc) =>
						npc && (npc.name || npc.description || npc.motivation || npc.trait),
				);
		}
		if (
			Array.isArray(currentSessionData.locations) &&
			currentSessionData.locations.length > 0
		) {
			currentSession.locations = currentSessionData.locations
				.map((location) => locationToPromptContext(location, noteToContextNote))
				.filter(
					(location) => location && (location.name || location.description),
				);
		}
		contextJson.currentSession = currentSession;
	}

	if (filteredSessions.length > 0) {
		contextJson.selectedSessions = filteredSessions;
	}

	// Add current encounter data when in Encounter mode.
	if (encounterId && session) {
		const currentEnc = (session.data.encounters || []).find(
			(e) => e.id.toString() === encounterId.toString(),
		);
		if (currentEnc) {
			contextJson.currentEncounter = {
				id: currentEnc.id,
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

	// Add task-specific instructions.
	if (useKey === "image") {
		if (imageTarget?.type) {
			userPrompt += `TASK: Generate a detailed image prompt for the selected ${imageTarget.type} from IMAGE TARGET.\n`;
		} else if (sceneId) {
			userPrompt += `TASK: Generate an image prompt for scene ID: ${sceneId}.\n`;
		} else {
			userPrompt += `TASK: Generate a detailed image prompt based on INPUT DATA and USER INSTRUCTIONS. Use the current context to infer the subject, composition, mood, and relevant details.\n`;
		}
	} else if (useKey === "character") {
		userPrompt += `TASK: Create or update player character operations requested by USER INSTRUCTIONS. Use entity "character" only and identify existing targets by id when available.\n`;
	} else if (useKey === "custom-monster") {
		userPrompt += `TASK: Create or update custom D&D 5.5e bestiary monster operations requested by USER INSTRUCTIONS. Use entity "monster" only and follow the custom monster schema from system instructions.
If INPUT DATA.customBestiary.selectedMonster exists and selectedMonsterMode is "create-based", use it only as reference and create a new monster.
When creating a monster based on an existing one, give the new monster a distinct "name" unless USER INSTRUCTIONS explicitly ask to replace or keep the same name.
If selectedMonster exists and selectedMonsterMode is not "create-based", update that monster by id and return only changed fields in patch.\n`;
	} else if (useKey === "npc") {
		if (entityTargetScope === "mixed") {
			userPrompt += `TASK: Create or update NPC operations for the current session and campaign as requested. Use entity "npc" only, identify existing targets by id, and choose "scope": "campaign" or "scope": "session" separately for each NPC operation. Default new NPCs to "scope": "session"; use "scope": "campaign" only for clearly recurring or campaign-important NPCs.\n`;
			userPrompt += `Do not create session copies of campaign-scoped NPCs. If an existing campaign NPC is only referenced in session content, use [Exact Entity Name] in text fields. If the user request or the NPC's logical use means that campaign NPC should become session-only, use moveScope from campaign to session.\n`;
		} else {
			userPrompt += `TASK: Create or update NPC operations for this ${entityTargetScope === "session" ? "current session" : "campaign"} as requested. Use entity "npc" only, identify existing targets by id, and use "${entityTargetScope}" scope by default.\n`;
			if (entityTargetScope === "session") {
				userPrompt += `Do not create session copies of campaign-scoped NPCs. If an existing campaign NPC is only referenced in session content, use [Exact Entity Name] in text fields. If the user request or the NPC's logical use means that campaign NPC should become session-only, use moveScope from campaign to session.\n`;
			}
		}
	} else if (useKey === "location") {
		if (entityTargetScope === "mixed") {
			userPrompt += `TASK: Create or update location/faction operations for the current session and campaign as requested. Use entity "location" only, identify existing targets by id, and choose "scope": "campaign" or "scope": "session" separately for each location/faction operation. Default new locations/factions to "scope": "session"; use "scope": "campaign" only for major reusable places, factions, regions, organizations, or campaign hubs.\n`;
			userPrompt += `Do not create session copies of campaign-scoped locations/factions. If an existing campaign location/faction is only referenced in session content, use [Exact Entity Name] in text fields. If the user request or the location/faction's logical use means that campaign entity should become session-only, use moveScope from campaign to session.\n`;
		} else {
			userPrompt += `TASK: Create or update location/faction operations for this ${entityTargetScope === "session" ? "current session" : "campaign"} as requested. Use entity "location" only, identify existing targets by id, and use "${entityTargetScope}" scope by default.\n`;
			if (entityTargetScope === "session") {
				userPrompt += `Do not create session copies of campaign-scoped locations/factions. If an existing campaign location/faction is only referenced in session content, use [Exact Entity Name] in text fields. If the user request or the location/faction's logical use means that campaign entity should become session-only, use moveScope from campaign to session.\n`;
			}
		}
	} else if (useKey === "encounter") {
		userPrompt += `TASK: Update current combat encounter (id: ${encounterId}) according to USER INSTRUCTIONS. Use exact official monster names or exact INPUT DATA.customBestiary.monsterNames values in monsterName.\n`;
		if (customMonsterGenerationEnabled) {
			userPrompt += `Custom monster creation is allowed only when existing official or custom monsters do not fit well.\n`;
		}
	} else if (useKey === "scene") {
		userPrompt += `TASK: Based on current session and context, apply the user's requested session changes.\n`;
		if (entityTargetScope !== "campaign") {
			userPrompt += `When existing campaign NPCs, locations, or factions are used in this session, write them as [Exact Entity Name] mentions in scene text or notes instead of creating copied session entities. For new NPCs/locations/factions, choose "scope": "session" by default; use "scope": "campaign" only for reusable campaign entities. Use moveScope whenever the entity's logical role shows it belongs in the other scope.\n`;
		}
		if (encounterGenerationEnabled) {
			userPrompt += `Encounter generation is enabled: any combat encounter you create must be connected to exactly one scene with encounterClientId in the same JSON response. Never create orphan encounters.\n`;
		}
	} else if (useKey === "campaign") {
		userPrompt += `TASK: Apply the user's requested campaign changes.\n`;
		userPrompt += `If USER INSTRUCTIONS ask to create, rewrite, expand, summarize, or otherwise change the campaign premise, overview, story, concept, or main description, return an update operation for entity "campaign" with patch.description. Do not create a note for this unless USER INSTRUCTIONS explicitly ask for a note.\n`;
	}

	userPrompt += `USER INSTRUCTIONS (PRIORITY): ${userInstructions || ""}\n`;

	const imageParts = await buildImageParts(attachedImages);
	const fileParts = buildFileParts(attachedFiles);
	const attachmentParts = [...imageParts, ...fileParts];
	const requestParts =
		attachmentParts.length > 0
			? [{ text: userPrompt }, ...attachmentParts]
			: userPrompt;
	const result = await model.generateContent(requestParts);
	const response = await result.response;
	let text = response.text();

	// Helper for recursively fixing escaped line breaks (\\n -> \n).
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
		// Clean only the outer markdown fence if it slipped through.
		const cleanJson = extractFirstJsonObject(text);

		return fixNewLines(JSON.parse(cleanJson));
	} catch (e) {
		console.error("Failed to parse AI response as JSON:", text, e);
		// If parsing failed, return a structured error.
		return {
			error: "AI returned invalid JSON. Try again.",
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
		extractFirstJsonObject,
		collectImageUrls,
		resolveLocalImageUrl,
		buildImageParts,
	},
};
