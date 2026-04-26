const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
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

function noteToPromptText(note) {
	if (!note) return "";
	if (typeof note === "string") return note.trim();
	const title = String(note.title || "").trim();
	const text = String(note.text || "").trim();
	return [title, text].filter(Boolean).join("\n");
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
The JSON must contain generated data only, without extra commentary.
Use this shape:
{ "description": "...", "notes": ["Title\\nDetailed note...", ...], "characters": [{ "name": "...", "race": "...", "class": "...", "level": 1, "motivation": "...", "trait": "...", "notes": ["Title\\nDetailed note...", "..."] }], "npcs": [{ "name": "...", "race": "...", "class": "...", "level": 1, "description": "...", "motivation": "...", "trait": "...", "notes": ["Title\\nDetailed note...", "..."] }] }.
Each note in "notes" must be a complete block where the first line is a short title and the following lines are details.
When updating story description or notes, return the full updated picture, not only newly added material. Preserve useful existing description/notes from the input, revise them as needed, and add new material on top of them.
Do not generate a "scenes" field for campaign mode.
Include "characters" and "npcs" only when the task instructions explicitly allow those categories.`,
	scene: `You are an experienced Dungeon Master for Dungeons & Dragons.
Your goal is to help with session planning.
Keep responses structured and practical for real gameplay.
Always return JSON only, with no text before or after JSON.
The JSON must contain generated data only, without extra commentary.
When generating scenes, use this base shape:
{ "notes": ["Title\\nDetailed session note...", ...], "scenes": [{ "texts": { "summary": "...", "goal": "...", "stakes": "...", "location": "..." }, "notes": ["Short note 1", "Short note 2"], "npcs": [{ "name": "...", "description": "..." }] }], "characters": [{ "name": "...", "race": "...", "class": "...", "level": 1, "motivation": "...", "trait": "...", "notes": ["Title\\nDetailed note...", "..."] }], "npcs": [{ "name": "...", "race": "...", "class": "...", "level": 1, "description": "...", "motivation": "...", "trait": "...", "notes": ["Title\\nDetailed note...", "..."] }] }.
Top-level "notes" are general notes for the whole session (not scene notes).
When updating notes or scenes, return the full updated picture, not only newly added material. Preserve useful existing notes/scenes from the input, revise them as needed, and add new material on top of them.
Include top-level "characters", top-level "npcs", and scene "npcs" only when task instructions explicitly allow those categories.
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
{ "characters": [{ "name": "...", "race": "...", "class": "...", "level": 1, "motivation": "...", "trait": "...", "notes": ["Title\\nDetailed note...", "..."] }] }.
Return only the top-level "characters" field. Do not include "npcs", campaign notes, scenes, encounters, or story description.
Create complete and playable character concepts.
Use realistic D&D class/race combinations and sensible levels.`,
	npc: `You are an experienced Dungeon Master for Dungeons & Dragons.
Your goal is to create NPCs for a campaign.
Always return JSON only, with no text before or after JSON.
The JSON must use this shape:
{ "npcs": [{ "name": "...", "race": "...", "class": "...", "level": 1, "description": "...", "motivation": "...", "trait": "...", "notes": ["Title\\nDetailed note...", "..."] }] }.
Return only the top-level "npcs" field. Do not include "characters", campaign notes, scenes, encounters, or story description.
Create distinct NPCs with clear story function and personality.
For each NPC, include race, class, and level when they can reasonably be inferred from the request or story role.
Use sensible D&D race/class/level values for the NPC's function. If a class is not appropriate, use a concise role or archetype instead of leaving the field empty.`,
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
Use markdown formatting in your final response.`,
	image: `You generate detailed scene-image prompts.
Input is JSON with keys:
Scene fields (higher priority): summary, goal, stakes, location, npcs.
General fields (lower priority): notes, description.
Generate one final image-generation prompt from this data.
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
	generateEncounters,
	modelName,
	language,
}) {
	let model;
	let userPrompt = "";
	const responseLanguage = normalizeResponseLanguage(language);
	const encounterGenerationEnabled = Boolean(generateEncounters);
	const characterGenerationEnabled = generateCharacters !== false;
	const npcGenerationEnabled = generateNpcs !== false;
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
		`NAME LANGUAGE RULE: Any new names you invent must be written in ${responseLanguage.label}. This includes new character names, NPC names, place names, scene names, encounter names, aliases, titles, and display names.
EXISTING NAME PROTECTION: Names that already exist in the input data must keep their exact original spelling and alphabet. Do not translate, transliterate, decline, paraphrase, rename, or otherwise alter existing names unless the user explicitly asks you to do that.
Exception: technical lookup fields that require official English names, such as "monsterName", must remain official English bestiary names.`,
	];
	if (useKey === "scene" && encounterGenerationEnabled) {
		systemInstructionParts.push(
			`Encounter generation is enabled. You may create combat encounters using this shape:
{ "notes": ["Title\\nDetailed session note...", ...], "scenes": [{ "texts": { "summary": "...", "goal": "...", "stakes": "...", "location": "..." }, "notes": ["Short note 1", "Short note 2"], "npcs": [{ "name": "...", "description": "..." }], "encounterIndex": 0 }], "encounters": [{ "name": "Encounter name", "monsters": [{ "monsterName": "Official D&D Monster Name", "name": "Optional display name" }] }] }.
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
				? `Character generation is enabled. You may include a top-level "characters" array only when new player characters are useful for the user's request.`
				: `Character generation is disabled. Do not create or edit player characters. Do not include a top-level "characters" array.`,
		);
		systemInstructionParts.push(
			npcGenerationEnabled
				? `NPC generation is enabled. You may include NPC data only when new NPCs are useful for the user's request. Use a top-level "npcs" array for NPC cards; scene-local NPC references may be included in scene "npcs".`
				: `NPC generation is disabled. Do not create or edit NPCs. Do not include top-level "npcs" or scene "npcs".`,
		);
	}

	model = genAI.getGenerativeModel({
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
			const sessionContext = { name: s.name };
			const conf = s.conf || {};
			const data = s.data || {};

			// Додаємо нотатки, якщо обрано
			if (conf.included && conf.notes && data.notes) {
				sessionContext.notes = data.notes
					.map(noteToPromptText)
					.filter((t) => t && t.trim() !== "");
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
										.map(noteToPromptText)
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

			return sessionContext;
		})
		.filter((s) => s.notes || s.result || s.scenes); // Прибираємо сесії без контенту

	// 2. Формуємо фінальний JSON контексту для Gemini
	const contextJson = {
		campaign: {
			name: campaign.name,
			description: campaign.description,
			notes: contextData?.campaign?.notes
				?.map(noteToPromptText)
				.filter(Boolean),
			characters: contextData?.campaign?.characters
				?.map((c) => ({
					name: `${c.firstName || ""} ${c.lastName || ""}`.trim() || c.name,
					race: c.race,
					class: c.class,
					level: c.level,
					motivation: c.motivation,
					trait: c.trait,
					notes: (c.notes || []).map(noteToPromptText).filter(Boolean),
				}))
				.filter((c) => c.name || c.motivation),
		},
	};

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
		"IMPORTANT: In all generated text fields, wrap every mention of character or NPC names in square brackets, for example [Iryna] or [Borin Stonehelm]. Do not wrap JSON keys.\n";
	userPrompt +=
		"IMPORTANT: Do NOT wrap structured name fields in brackets. Fields like name, firstName, lastName, and monsterName must contain plain names without [] symbols.\n";
	userPrompt +=
		"IMPORTANT: Never alter, translate, decline, or paraphrase existing character/NPC names unless the user explicitly asks you to rename or translate them. Always use existing names exactly as provided in the input JSON, preserving original spelling, and only wrap them in square brackets.\n";
	userPrompt +=
		"IMPORTANT: Never transliterate existing names between alphabets (for example, Latin <-> Cyrillic) unless the user explicitly asks you to transliterate them. Keep the exact original characters from input. Mention format must be a single pair of brackets only: [Name]. Never output [[Name]] or nested brackets.\n";
	userPrompt += `IMPORTANT: For new names you invent, use ${responseLanguage.label}. For existing names from input, keep the original spelling unless the user explicitly requests a rename, translation, or transliteration. Keep official lookup fields such as monsterName in English when the schema requires official D&D names.\n`;

	// Додаємо специфічні інструкції залежно від типу задачі
	if (useKey === "image") {
		userPrompt += `TASK: Generate an image prompt for scene ID: ${sceneId}\n`;
	} else if (useKey === "character") {
		userPrompt += `TASK: Create new player characters for this campaign based on user instructions.
IMPORTANT: This request is strictly for player characters. Return only "characters". Do not create NPCs or any other content category.\n`;
	} else if (useKey === "npc") {
		userPrompt += `TASK: Create new NPCs for this campaign based on user instructions.
IMPORTANT: This request is strictly for NPCs. Return only "npcs". Do not create player characters or any other content category.
IMPORTANT: Include race, class, and level for every generated NPC when possible. If a formal class does not fit, put a role/archetype in "class".\n`;
	} else if (useKey === "encounter") {
		userPrompt += `TASK: Update current combat encounter (ID: ${encounterId}). Consider character levels and requested difficulty (easy, medium, hard, deadly). Pick monsters that fit the scenario.\n`;
	} else if (useKey === "scene") {
		userPrompt += `TASK: Based on current session and context, propose ideas for new scenes or expand existing ones.\n`;
		userPrompt += `IMPORTANT: Return the complete updated session content for the fields you output. For notes and scenes, include existing useful items from the input together with your revisions/additions. Do not return only a delta or only the newly added content.\n`;
		if (characterGenerationEnabled) {
			userPrompt += `IMPORTANT: Character generation is enabled. If the user asks for new player characters or they are clearly useful, include them in a top-level "characters" array.\n`;
		} else {
			userPrompt += `IMPORTANT: Character generation is disabled. Do not create or edit player characters and do not output "characters".\n`;
		}
		if (npcGenerationEnabled) {
			userPrompt += `IMPORTANT: NPC generation is enabled. If the user asks for new NPCs or they are clearly useful, include NPC cards in a top-level "npcs" array. Scene-local NPC references may also be included in scene "npcs".\n`;
		} else {
			userPrompt += `IMPORTANT: NPC generation is disabled. Do not create or edit NPCs and do not output top-level "npcs" or scene "npcs".\n`;
		}
		if (encounterGenerationEnabled) {
			userPrompt += `IMPORTANT: For each scene where conflict is possible, generate an encounter object in the encounters array.
Pick monsters (English names) while considering character levels and classes for balance.\n`;
		} else {
			userPrompt += `IMPORTANT: Encounter generation is disabled. Do not create or edit combat encounters, do not pick monsters, and do not output "encounters", "encounterIndex", or "encounterId".\n`;
		}
	} else if (useKey === "campaign") {
		userPrompt += `TASK: Update campaign story description and structure campaign notes.\n`;
		userPrompt += `IMPORTANT: Return the complete updated campaign story content for the fields you output. For description and notes, include existing useful material from the input together with your revisions/additions. Do not return only a delta or only the newly added content.\n`;
		if (characterGenerationEnabled) {
			userPrompt += `IMPORTANT: Character generation is enabled. If the user asks for new player characters or they are clearly useful, include them in "characters".\n`;
		} else {
			userPrompt += `IMPORTANT: Character generation is disabled. Do not create or edit player characters and do not output "characters".\n`;
		}
		if (npcGenerationEnabled) {
			userPrompt += `IMPORTANT: NPC generation is enabled. If the user asks for new NPCs or they are clearly useful, include them in "npcs". NPCs should include race, class, level, description, motivation, trait, and notes when possible.\n`;
		} else {
			userPrompt += `IMPORTANT: NPC generation is disabled. Do not create or edit NPCs and do not output "npcs".\n`;
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

module.exports = { generateContent, listAvailableModels };
