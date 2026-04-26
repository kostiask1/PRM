const express = require("express");
const router = express.Router();
const storage = require("../storage");
const aiService = require("../aiService");

function makeId() {
	return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function asText(value) {
	return typeof value === "string" ? value.trim() : "";
}

function sanitizeEntityName(value) {
	let name = asText(value);
	if (!name) return "";

	// Remove any outer mention brackets from structured name fields: [John] -> John
	while (name.startsWith("[") && name.endsWith("]")) {
		name = name.slice(1, -1).trim();
	}

	return name.replace(/\s+/g, " ");
}

function parseNameParts(raw = {}) {
	const firstName = sanitizeEntityName(raw.firstName || raw.first_name);
	const lastName = sanitizeEntityName(raw.lastName || raw.last_name);
	if (firstName || lastName) {
		return { firstName, lastName };
	}

	const fullName = sanitizeEntityName(raw.name || raw.fullName || raw.title);
	if (!fullName) return { firstName: "", lastName: "" };
	const parts = fullName.split(/\s+/).filter(Boolean);
	if (parts.length === 1) return { firstName: parts[0], lastName: "" };
	return {
		firstName: parts[0],
		lastName: parts.slice(1).join(" "),
	};
}

function normalizeLevel(rawLevel) {
	const parsed = Number.parseInt(String(rawLevel ?? "1"), 10);
	if (!Number.isFinite(parsed)) return 1;
	if (parsed < 1) return 1;
	if (parsed > 20) return 20;
	return parsed;
}

function parseNoteParts(value) {
	const text = asText(value);
	if (!text) return { title: "", text: "" };

	const lines = text
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);

	if (lines.length <= 1) {
		return { title: "", text };
	}

	return {
		title: lines[0],
		text: lines.slice(1).join("\n"),
	};
}

function normalizeNote(note) {
	if (typeof note === "string") {
		const parsed = parseNoteParts(note);
		return {
			id: makeId(),
			title: parsed.title,
			text: parsed.text,
			collapsed: false,
		};
	}

	if (!note || typeof note !== "object") {
		return null;
	}

	const rawTitle = asText(note.title || note.name);
	const rawText = asText(note.text || note.description || note.content);
	const parsed = rawText && !rawTitle ? parseNoteParts(rawText) : null;

	return {
		id: note.id || makeId(),
		title: rawTitle || parsed?.title || "",
		text: rawText || parsed?.text || "",
		collapsed: Boolean(note.collapsed),
	};
}

function normalizeNotes(notes, { keepAtLeastOne = false } = {}) {
	const list = Array.isArray(notes) ? notes : [];
	const normalized = list
		.map(normalizeNote)
		.filter((note) => note && (note.title || note.text));
	if (keepAtLeastOne && normalized.length === 0) {
		normalized.push({ id: makeId(), title: "", text: "", collapsed: false });
	}
	return normalized;
}

function normalizeCharacter(raw, existing = null) {
	const nameParts = parseNameParts(raw);
	const fallbackDescription = asText(
		raw.description || raw.bio || raw.backstory,
	);
	const notesSource = Array.isArray(raw.notes)
		? raw.notes
		: fallbackDescription
			? [fallbackDescription]
			: [];

	return {
		id: existing?.id || storage.createId(),
		firstName: nameParts.firstName,
		lastName: nameParts.lastName,
		race: asText(raw.race || raw.species),
		class: asText(raw.class || raw.role),
		level: normalizeLevel(raw.level),
		motivation: asText(raw.motivation || raw.goal || raw.description),
		trait: asText(raw.trait || raw.personality || raw.quirk),
		notes: normalizeNotes(notesSource, { keepAtLeastOne: true }),
		collapsed: Boolean(existing?.collapsed ?? raw.collapsed ?? false),
		isNotesCollapsed: Boolean(
			existing?.isNotesCollapsed ?? raw.isNotesCollapsed ?? false,
		),
		// Never overwrite existing image links with AI output.
		imageUrl: existing?.imageUrl ?? raw.imageUrl ?? null,
	};
}

function entityNameKey(raw) {
	const nameParts = parseNameParts(raw || {});
	return `${nameParts.firstName.toLowerCase()} ${nameParts.lastName.toLowerCase()}`.trim();
}

async function upsertGeneratedEntities(campaignSlug, type, generatedEntities) {
	if (!Array.isArray(generatedEntities) || generatedEntities.length === 0)
		return;

	const existing = await storage.listEntities(campaignSlug, type);
	const bySlug = new Map(existing.map((entity) => [entity.slug, entity]));
	const byName = new Map(
		existing
			.map((entity) => ({ key: entityNameKey(entity), entity }))
			.filter(({ key }) => Boolean(key))
			.map(({ key, entity }) => [key, entity]),
	);

	for (const rawEntity of generatedEntities) {
		const nameParts = parseNameParts(rawEntity);
		const fullNameKey = entityNameKey(rawEntity);
		const baseSlug = storage.campaignSlug(
			nameParts.firstName || rawEntity.name || type,
		);

		const existingEntity =
			bySlug.get(rawEntity.slug) ||
			(fullNameKey ? byName.get(fullNameKey) : null) ||
			null;

		const normalized = normalizeCharacter(rawEntity, existingEntity);

		if (existingEntity) {
			const payload = {
				...existingEntity,
				...normalized,
				slug: existingEntity.slug,
				id: existingEntity.id,
				imageUrl: existingEntity.imageUrl ?? normalized.imageUrl ?? null,
			};
			await storage.writeEntity(
				campaignSlug,
				type,
				existingEntity.slug,
				payload,
			);
			bySlug.set(existingEntity.slug, payload);
			if (fullNameKey) byName.set(fullNameKey, payload);
			continue;
		}

		const uniqueSlug = await storage.ensureUniqueEntitySlug(
			campaignSlug,
			type,
			baseSlug,
		);
		const payload = {
			...normalized,
			slug: uniqueSlug,
		};
		await storage.writeEntity(campaignSlug, type, uniqueSlug, payload);
		bySlug.set(uniqueSlug, payload);
		if (fullNameKey) byName.set(fullNameKey, payload);
	}
}

function normalizeSceneTexts(rawScene = {}) {
	const source =
		rawScene.texts && typeof rawScene.texts === "object"
			? rawScene.texts
			: rawScene;
	return {
		summary: asText(source.summary),
		goal: asText(source.goal),
		stakes: asText(source.stakes),
		location: asText(source.location),
	};
}

function normalizeSceneNpcs(npcs) {
	if (!Array.isArray(npcs)) return [];
	return npcs
		.map((npc) => {
			if (typeof npc === "string") {
				const name = asText(npc);
				return name ? { name, description: "" } : null;
			}
			if (!npc || typeof npc !== "object") return null;
			const name = asText(npc.name || npc.firstName);
			if (!name) return null;
			return {
				name,
				description: asText(npc.description || npc.trait || ""),
			};
		})
		.filter(Boolean);
}

function normalizeScene(scene, existing, encounterMap) {
	let encounterId = existing?.encounterId || "";
	if (
		scene.encounterIndex !== undefined &&
		encounterMap.has(scene.encounterIndex)
	) {
		encounterId = encounterMap.get(scene.encounterIndex);
	}

	const notesFromAi = normalizeNotes(scene.notes || []);

	return {
		id: existing?.id || storage.createId(),
		texts: normalizeSceneTexts(scene),
		notes: notesFromAi.length > 0 ? notesFromAi : existing?.notes || [],
		isNotesCollapsed: Boolean(existing?.isNotesCollapsed),
		npcs: normalizeSceneNpcs(scene.npcs),
		collapsed: Boolean(existing?.collapsed),
		encounterId,
		// Keep existing scene image reference unchanged unless scene is new.
		imageUrl: existing?.imageUrl ?? scene.imageUrl ?? null,
	};
}

function buildMonsterInstance(monster, bestiaryIndex) {
	const monsterName = asText(monster?.monsterName || monster?.name);
	if (!monsterName) return null;

	let foundBase = null;
	const searchKey = monsterName.toLowerCase();
	for (const [key, data] of bestiaryIndex.entries()) {
		if (key.startsWith(`${searchKey}|`)) {
			foundBase = data;
			break;
		}
	}

	const resolved = foundBase
		? storage.resolveMonster(foundBase, bestiaryIndex)
		: null;
	const instance = {
		...(resolved || {}),
		instanceId: `inst-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
		name: asText(monster?.name) || (resolved ? resolved.name : monsterName),
		originalBestiaryName: resolved ? resolved.name : monsterName,
		source: resolved ? resolved.source : asText(monster?.source) || "Unknown",
	};

	if (resolved) {
		const hpVal =
			typeof resolved.hp === "object"
				? resolved.hp.average || 0
				: resolved.hit_points || 0;
		instance.currentHp = hpVal;
		instance.hit_points = hpVal;

		let acVal = resolved.armor_class || 0;
		if (Array.isArray(resolved.ac) && resolved.ac[0]) {
			const entry = resolved.ac[0];
			acVal = typeof entry === "object" ? entry.ac || 0 : entry;
		}
		instance.armor_class = acVal;
	} else {
		instance.currentHp = 0;
		instance.hit_points = 0;
		instance.armor_class = 0;
	}

	return instance;
}

function normalizeEncounterFromAi(rawEncounter, bestiaryIndex, fallbackName) {
	const monsters = (
		Array.isArray(rawEncounter?.monsters) ? rawEncounter.monsters : []
	)
		.map((monster) => buildMonsterInstance(monster, bestiaryIndex))
		.filter(Boolean);

	return {
		name: asText(rawEncounter?.name) || fallbackName,
		monsters,
	};
}

function escapeRegExp(value) {
	return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getCharacterDisplayName(entity = {}) {
	const firstName = asText(entity.firstName || entity.first_name);
	const lastName = asText(entity.lastName || entity.last_name);
	const combined = `${firstName} ${lastName}`.trim();
	if (combined) return combined;
	return asText(entity.name || entity.title);
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
		const pattern = new RegExp(`(?<!\\[)${escapeRegExp(name)}(?!\\])`, "giu");
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
		.replace(/[`'’]/g, "")
		.replace(/[^\p{L}\p{N}\s-]+/gu, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function levenshteinDistance(a, b) {
	const left = String(a);
	const right = String(b);
	if (left === right) return 0;
	if (!left.length) return right.length;
	if (!right.length) return left.length;

	const prev = Array.from({ length: right.length + 1 }, (_, i) => i);
	for (let i = 1; i <= left.length; i += 1) {
		let prevDiag = prev[0];
		prev[0] = i;
		for (let j = 1; j <= right.length; j += 1) {
			const temp = prev[j];
			const cost = left[i - 1] === right[j - 1] ? 0 : 1;
			prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, prevDiag + cost);
			prevDiag = temp;
		}
	}
	return prev[right.length];
}

function resolveCanonicalName(rawName, canonicalNames) {
	const raw = asText(rawName);
	if (!raw || !canonicalNames.length) return rawName;

	const exact = canonicalNames.find(
		(name) => normalizeNameForMatch(name) === normalizeNameForMatch(raw),
	);
	if (exact) return exact;

	const normalizedRaw = normalizeNameForMatch(raw);
	if (!normalizedRaw) return rawName;

	let best = null;
	let bestDistance = Number.MAX_SAFE_INTEGER;
	for (const candidate of canonicalNames) {
		const normalizedCandidate = normalizeNameForMatch(candidate);
		if (!normalizedCandidate) continue;
		const distance = levenshteinDistance(normalizedRaw, normalizedCandidate);
		if (distance < bestDistance) {
			bestDistance = distance;
			best = candidate;
		}
	}

	if (!best) return rawName;
	const threshold = normalizedRaw.length >= 10 ? 3 : 2;
	return bestDistance <= threshold ? best : rawName;
}

function canonicalizeBracketedMentions(text, names) {
	if (!text || !names.length) return text;
	return String(text).replace(/\[([^[\]]+)\]/g, (_full, rawName) => {
		const canonical = resolveCanonicalName(rawName, names);
		return `[${canonical}]`;
	});
}

function processGeneratedTextMentions(text, names) {
	if (typeof text !== "string") return text;
	const wrapped = wrapMentionsInText(text, names);
	const canonicalized = canonicalizeBracketedMentions(wrapped, names);
	return collapseNestedMentionBrackets(canonicalized);
}

function shouldAppendScenesRequest(userInstructions) {
	const text = asText(userInstructions).toLowerCase();
	if (!text) return false;
	const appendHints = [
		"нова сцена",
		"нову сцену",
		"додай сцен",
		"додати сцен",
		"create new scene",
		"add scene",
		"new scene",
	];
	return appendHints.some((hint) => text.includes(hint));
}

function sceneTextSignature(texts = {}) {
	return {
		summary: asText(texts.summary),
		goal: asText(texts.goal),
		stakes: asText(texts.stakes),
		location: asText(texts.location),
	};
}

function sceneNotesSignature(notes = []) {
	return (Array.isArray(notes) ? notes : [])
		.map((note) => ({
			title: asText(note?.title),
			text: asText(note?.text),
		}))
		.filter((note) => note.title || note.text);
}

function sceneNpcsSignature(npcs = []) {
	return (Array.isArray(npcs) ? npcs : [])
		.map((npc) => ({
			name: asText(npc?.name),
			description: asText(npc?.description),
		}))
		.filter((npc) => npc.name || npc.description);
}

function sceneSignature(scene) {
	const payload = {
		texts: sceneTextSignature(scene?.texts),
		notes: sceneNotesSignature(scene?.notes),
		npcs: sceneNpcsSignature(scene?.npcs),
		encounterId: asText(scene?.encounterId),
	};
	return JSON.stringify(payload);
}

function applyMentionsToGeneratedContent(generatedContent, names) {
	if (
		!generatedContent ||
		typeof generatedContent !== "object" ||
		!names.length
	) {
		return generatedContent;
	}

	if (typeof generatedContent.description === "string") {
		generatedContent.description = processGeneratedTextMentions(
			generatedContent.description,
			names,
		);
	}

	if (Array.isArray(generatedContent.notes)) {
		generatedContent.notes = generatedContent.notes.map((note) =>
			typeof note === "string"
				? processGeneratedTextMentions(note, names)
				: note,
		);
	}

	if (Array.isArray(generatedContent.characters)) {
		generatedContent.characters = generatedContent.characters.map(
			(character) => {
				if (!character || typeof character !== "object") return character;
				const next = { ...character };
				for (const key of ["description", "motivation", "trait"]) {
					if (typeof next[key] === "string") {
						next[key] = processGeneratedTextMentions(next[key], names);
					}
				}
				if (Array.isArray(next.notes)) {
					next.notes = next.notes.map((note) =>
						typeof note === "string"
							? processGeneratedTextMentions(note, names)
							: note,
					);
				}
				return next;
			},
		);
	}

	if (Array.isArray(generatedContent.npcs)) {
		generatedContent.npcs = generatedContent.npcs.map((npc) => {
			if (!npc || typeof npc !== "object") return npc;
			const next = { ...npc };
			for (const key of ["description", "motivation", "trait"]) {
				if (typeof next[key] === "string") {
					next[key] = processGeneratedTextMentions(next[key], names);
				}
			}
			if (Array.isArray(next.notes)) {
				next.notes = next.notes.map((note) =>
					typeof note === "string"
						? processGeneratedTextMentions(note, names)
						: note,
				);
			}
			return next;
		});
	}

	if (Array.isArray(generatedContent.scenes)) {
		generatedContent.scenes = generatedContent.scenes.map((scene) => {
			if (!scene || typeof scene !== "object") return scene;
			const nextScene = { ...scene };

			if (nextScene.texts && typeof nextScene.texts === "object") {
				nextScene.texts = { ...nextScene.texts };
				for (const key of ["summary", "goal", "stakes", "location"]) {
					if (typeof nextScene.texts[key] === "string") {
						nextScene.texts[key] = processGeneratedTextMentions(
							nextScene.texts[key],
							names,
						);
					}
				}
			}

			if (Array.isArray(nextScene.notes)) {
				nextScene.notes = nextScene.notes.map((note) =>
					typeof note === "string"
						? processGeneratedTextMentions(note, names)
						: note,
				);
			}

			if (Array.isArray(nextScene.npcs)) {
				nextScene.npcs = nextScene.npcs.map((npc) => {
					if (!npc || typeof npc !== "object") return npc;
					const nextNpc = { ...npc };
					if (typeof nextNpc.description === "string") {
						nextNpc.description = processGeneratedTextMentions(
							nextNpc.description,
							names,
						);
					}
					return nextNpc;
				});
			}

			return nextScene;
		});
	}

	return generatedContent;
}

function enforceEntityGenerationScope(generatedContent, type) {
	if (
		!generatedContent ||
		typeof generatedContent !== "object" ||
		!["character", "npc"].includes(type)
	) {
		return generatedContent;
	}

	if (type === "character") {
		delete generatedContent.npcs;
	} else {
		delete generatedContent.characters;
	}

	delete generatedContent.description;
	delete generatedContent.notes;
	delete generatedContent.scenes;
	delete generatedContent.encounters;
	return generatedContent;
}

async function collectMentionCandidates(
	campaignSlug,
	sessionData,
	generatedContent,
) {
	const [characters, npcs] = await Promise.all([
		storage.listEntities(campaignSlug, "characters"),
		storage.listEntities(campaignSlug, "npc"),
	]);

	const names = [
		...characters.map(getCharacterDisplayName),
		...npcs.map(getCharacterDisplayName),
	];

	if (sessionData?.data?.scenes) {
		for (const scene of sessionData.data.scenes) {
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

	if (Array.isArray(generatedContent?.scenes)) {
		for (const scene of generatedContent.scenes) {
			for (const npc of scene?.npcs || []) {
				names.push(asText(npc?.name));
			}
		}
	}

	return normalizeMentionCandidates(names);
}

router.get("/models", async (_req, res, next) => {
	try {
		const result = await aiService.listAvailableModels();
		res.json(result);
	} catch (error) {
		next(error);
	}
});

router.get("/responses", async (_req, res, next) => {
	try {
		res.json(await storage.readAiResponses());
	} catch (error) {
		next(error);
	}
});

router.delete("/responses/:id", async (req, res, next) => {
	try {
		res.json(await storage.deleteAiResponse(req.params.id));
	} catch (error) {
		next(error);
	}
});

router.delete("/responses", async (_req, res, next) => {
	try {
		res.json(await storage.clearAiResponses());
	} catch (error) {
		next(error);
	}
});

router.post("/generate", async (req, res, next) => {
	try {
		const {
			type,
			modelName,
			userInstructions,
			path,
			sceneId,
			parseAIResponse,
			generateEncounters,
			contextConfig,
			language,
		} = req.body;
		const responseLanguage = String(language || "")
			.trim()
			.toLowerCase();
		if (!responseLanguage) {
			return res.status(400).json({ error: "language is required." });
		}
		if (!process.env.GEMINI_API_KEY) {
			return res.status(500).json({ error: "GEMINI_API_KEY не налаштовано." });
		}
		const encounterGenerationEnabled = Boolean(generateEncounters);
		const shouldParseAIResponse =
			Boolean(parseAIResponse || encounterGenerationEnabled) &&
			(!path.encounter || encounterGenerationEnabled);

		const campaign = await storage.readCampaign(path.campaign);
		const session = await storage
			.readSession(path.campaign, path.session)
			.catch(() => null);

		const contextData = { campaign: {}, sessions: [] };
		if (contextConfig) {
			if (contextConfig.campaignNotes)
				contextData.campaign.notes = campaign.notes;
			if (contextConfig.campaignCharacters) {
				const chars = await storage.listEntities(path.campaign, "characters");
				const npcs = await storage.listEntities(path.campaign, "npc");
				contextData.campaign.characters = [...chars, ...npcs];
			}

			if (contextConfig.sessions) {
				for (const [slug, conf] of Object.entries(contextConfig.sessions)) {
					if (!conf.included) continue;
					const sData = await storage.readSession(path.campaign, slug);
					contextData.sessions.push({
						name: sData.name,
						conf,
						data: sData.data,
					});
				}
			}
		}

		const generatedContent = await aiService.generateContent({
			type,
			session,
			campaign,
			userInstructions,
			modelName,
			encounterId: path.encounter,
			sceneId,
			parseAIResponse: shouldParseAIResponse,
			contextData,
			generateEncounters: encounterGenerationEnabled,
			language: responseLanguage,
		});

		enforceEntityGenerationScope(generatedContent, type);

		if (
			shouldParseAIResponse &&
			generatedContent &&
			typeof generatedContent === "object"
		) {
			const mentionNames = await collectMentionCandidates(
				path.campaign,
				session,
				generatedContent,
			);
			applyMentionsToGeneratedContent(generatedContent, mentionNames);
		}

		if (
			shouldParseAIResponse &&
			session &&
			!path.encounter &&
			!encounterGenerationEnabled &&
			generatedContent &&
			typeof generatedContent === "object"
		) {
			if (Array.isArray(generatedContent.encounters)) {
				delete generatedContent.encounters;
			}
			if (Array.isArray(generatedContent.scenes)) {
				generatedContent.scenes = generatedContent.scenes.map((scene) => {
					if (!scene || typeof scene !== "object") return scene;
					const { encounterId, encounterIndex, monsters, ...safeScene } = scene;
					return safeScene;
				});
			}
		}

		if (generatedContent.error) return res.status(500).json(generatedContent);
		if (!shouldParseAIResponse) {
			const aiResponse = await storage.addAiResponse({
				text: generatedContent,
				path,
				type,
				modelName,
				language: responseLanguage,
				userInstructions,
			});
			return res.json({ prompt: generatedContent, aiResponse });
		}

		let updatedObject = null;
		if (campaign) {
			if (session) {
				const fullPath = storage.sessionPath(path.campaign, path.session);
				const sessionData = await storage.readJson(fullPath);
				sessionData.data = sessionData.data || {};

				if (path.encounter) {
					sessionData.data.encounters = sessionData.data.encounters || [];
					const encIdx = sessionData.data.encounters.findIndex(
						(e) => String(e.id) === String(path.encounter),
					);

					if (encIdx !== -1) {
						let aiEncounter = null;
						if (Array.isArray(generatedContent?.monsters)) {
							aiEncounter = generatedContent;
						} else if (
							Array.isArray(generatedContent?.encounters) &&
							generatedContent.encounters[0]
						) {
							aiEncounter = generatedContent.encounters[0];
						}

						if (aiEncounter) {
							const bestiaryIndex = await storage.getBestiaryIndex();
							const normalized = normalizeEncounterFromAi(
								aiEncounter,
								bestiaryIndex,
								sessionData.data.encounters[encIdx].name || "Бій",
							);
							sessionData.data.encounters[encIdx].name = normalized.name;
							sessionData.data.encounters[encIdx].monsters =
								normalized.monsters;
							sessionData.updatedAt = new Date().toISOString();
							await storage.writeJson(fullPath, sessionData);
							return res.json({
								generated: generatedContent,
								updated: { ...sessionData, fileName: path.session },
							});
						}
					}
				}

				const encounterMap = new Map();
				if (Array.isArray(generatedContent.encounters)) {
					sessionData.data.encounters = sessionData.data.encounters || [];
					const bestiaryIndex = await storage.getBestiaryIndex();

					for (const [index, enc] of generatedContent.encounters.entries()) {
						const normalized = normalizeEncounterFromAi(
							enc,
							bestiaryIndex,
							`Бій ${sessionData.data.encounters.length + 1}`,
						);
						const newId = storage.createId();
						sessionData.data.encounters.push({
							id: newId,
							name: normalized.name,
							monsters: normalized.monsters,
						});
						encounterMap.set(index, newId);
					}
				}

				if (Array.isArray(generatedContent.scenes)) {
					const existingScenes = Array.isArray(sessionData.data.scenes)
						? sessionData.data.scenes
						: [];
					const appendScenes = shouldAppendScenesRequest(userInstructions);
					const existingSignatures = new Set(
						existingScenes.map(sceneSignature),
					);

					if (appendScenes) {
						const appendedScenes = [];
						for (const scene of generatedContent.scenes) {
							const normalized = normalizeScene(scene, null, encounterMap);
							const signature = sceneSignature(normalized);
							if (existingSignatures.has(signature)) continue;
							existingSignatures.add(signature);
							appendedScenes.push(normalized);
						}
						sessionData.data.scenes = [...existingScenes, ...appendedScenes];
					} else {
						const mergedScenes = [...existingScenes];
						generatedContent.scenes.forEach((scene, idx) => {
							if (idx < mergedScenes.length) {
								mergedScenes[idx] = normalizeScene(
									scene,
									mergedScenes[idx],
									encounterMap,
								);
							} else {
								const normalized = normalizeScene(scene, null, encounterMap);
								const signature = sceneSignature(normalized);
								if (!existingSignatures.has(signature)) {
									existingSignatures.add(signature);
									mergedScenes.push(normalized);
								}
							}
						});
						sessionData.data.scenes = mergedScenes;
					}
				}

				if (Array.isArray(generatedContent.notes)) {
					sessionData.data.notes = normalizeNotes(generatedContent.notes, {
						keepAtLeastOne: true,
					});
				}

				sessionData.updatedAt = new Date().toISOString();
				await storage.writeJson(fullPath, sessionData);
				updatedObject = { ...sessionData, fileName: path.session };
			} else {
				const metaPath = storage.campaignMetaPath(path.campaign);
				const meta = await storage.readJson(metaPath);

				if (type === "character") {
					await upsertGeneratedEntities(
						path.campaign,
						"characters",
						generatedContent.characters,
					);
				} else if (type === "npc") {
					await upsertGeneratedEntities(
						path.campaign,
						"npc",
						generatedContent.npcs,
					);
				} else {
					if (asText(generatedContent.description)) {
						meta.description = generatedContent.description;
					}

					if (Array.isArray(generatedContent.notes)) {
						meta.notes = normalizeNotes(generatedContent.notes);
					}

					await upsertGeneratedEntities(
						path.campaign,
						"characters",
						generatedContent.characters,
					);
					await upsertGeneratedEntities(
						path.campaign,
						"npc",
						generatedContent.npcs,
					);
				}

				meta.updatedAt = new Date().toISOString();
				await storage.writeJson(metaPath, meta);
				updatedObject = meta;
			}
		}

		res.json({ generated: generatedContent, updated: updatedObject });
	} catch (error) {
		next(error);
	}
});

module.exports = router;
