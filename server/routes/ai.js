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

function parseNameParts(raw = {}) {
	const firstName = asText(raw.firstName || raw.first_name);
	const lastName = asText(raw.lastName || raw.last_name);
	if (firstName || lastName) {
		return { firstName, lastName };
	}

	const fullName = asText(raw.name || raw.fullName || raw.title);
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
	const normalized = list.map(normalizeNote).filter((note) => note && (note.title || note.text));
	if (keepAtLeastOne && normalized.length === 0) {
		normalized.push({ id: makeId(), title: "", text: "", collapsed: false });
	}
	return normalized;
}

function normalizeCharacter(raw, existing = null) {
	const nameParts = parseNameParts(raw);
	const fallbackDescription = asText(raw.description || raw.bio || raw.backstory);
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
	if (scene.encounterIndex !== undefined && encounterMap.has(scene.encounterIndex)) {
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

	const resolved = foundBase ? storage.resolveMonster(foundBase, bestiaryIndex) : null;
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
	const monsters = (Array.isArray(rawEncounter?.monsters) ? rawEncounter.monsters : [])
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
			names
				.map((name) => asText(name))
				.filter((name) => name.length >= 2),
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
			prev[j] = Math.min(
				prev[j] + 1,
				prev[j - 1] + 1,
				prevDiag + cost,
			);
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

function applyMentionsToGeneratedContent(generatedContent, names) {
	if (!generatedContent || typeof generatedContent !== "object" || !names.length) {
		return generatedContent;
	}

	if (typeof generatedContent.description === "string") {
		generatedContent.description = wrapMentionsInText(
			generatedContent.description,
			names,
		);
		generatedContent.description = canonicalizeBracketedMentions(
			generatedContent.description,
			names,
		);
	}

	if (Array.isArray(generatedContent.notes)) {
		generatedContent.notes = generatedContent.notes.map((note) =>
			typeof note === "string"
				? canonicalizeBracketedMentions(wrapMentionsInText(note, names), names)
				: note,
		);
	}

	if (Array.isArray(generatedContent.characters)) {
		generatedContent.characters = generatedContent.characters.map((character) => {
			if (!character || typeof character !== "object") return character;
			const next = { ...character };
			for (const key of ["description", "motivation", "trait"]) {
				if (typeof next[key] === "string") {
					next[key] = canonicalizeBracketedMentions(
						wrapMentionsInText(next[key], names),
						names,
					);
				}
			}
			if (Array.isArray(next.notes)) {
				next.notes = next.notes.map((note) =>
					typeof note === "string"
						? canonicalizeBracketedMentions(wrapMentionsInText(note, names), names)
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
						nextScene.texts[key] = canonicalizeBracketedMentions(
							wrapMentionsInText(nextScene.texts[key], names),
							names,
						);
					}
				}
			}

			if (Array.isArray(nextScene.notes)) {
				nextScene.notes = nextScene.notes.map((note) =>
					typeof note === "string"
						? canonicalizeBracketedMentions(wrapMentionsInText(note, names), names)
						: note,
				);
			}

			if (Array.isArray(nextScene.npcs)) {
				nextScene.npcs = nextScene.npcs.map((npc) => {
					if (!npc || typeof npc !== "object") return npc;
					const nextNpc = { ...npc };
					if (typeof nextNpc.description === "string") {
						nextNpc.description = canonicalizeBracketedMentions(
							wrapMentionsInText(nextNpc.description, names),
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

async function collectMentionCandidates(campaignSlug, sessionData, generatedContent) {
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
		} = req.body;
		if (!process.env.GEMINI_API_KEY) {
			return res.status(500).json({ error: "GEMINI_API_KEY не налаштовано." });
		}

		const campaign = await storage.readCampaign(path.campaign);
		const session = await storage
			.readSession(path.campaign, path.session)
			.catch(() => null);

		const contextData = { campaign: {}, sessions: [] };
		if (contextConfig) {
			if (contextConfig.campaignNotes) contextData.campaign.notes = campaign.notes;
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
			parseAIResponse,
			contextData,
			generateEncounters,
		});

		if (parseAIResponse && generatedContent && typeof generatedContent === "object") {
			const mentionNames = await collectMentionCandidates(
				path.campaign,
				session,
				generatedContent,
			);
			applyMentionsToGeneratedContent(generatedContent, mentionNames);
		}

		if (
			parseAIResponse &&
			session &&
			!path.encounter &&
			!generateEncounters &&
			generatedContent &&
			typeof generatedContent === "object"
		) {
			if (Array.isArray(generatedContent.encounters)) {
				delete generatedContent.encounters;
			}
			if (Array.isArray(generatedContent.scenes)) {
				generatedContent.scenes = generatedContent.scenes.map((scene) => {
					if (!scene || typeof scene !== "object") return scene;
					const { encounterIndex, ...safeScene } = scene;
					return safeScene;
				});
			}
		}

		if (generatedContent.error) return res.status(500).json(generatedContent);
		if (!parseAIResponse) return res.json({ prompt: generatedContent });

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
						} else if (Array.isArray(generatedContent?.encounters) && generatedContent.encounters[0]) {
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
							sessionData.data.encounters[encIdx].monsters = normalized.monsters;
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

					sessionData.data.scenes = generatedContent.scenes.map((scene, idx) =>
						normalizeScene(scene, existingScenes[idx], encounterMap),
					);
				}

				sessionData.updatedAt = new Date().toISOString();
				await storage.writeJson(fullPath, sessionData);
				updatedObject = { ...sessionData, fileName: path.session };
			} else {
				const metaPath = storage.campaignMetaPath(path.campaign);
				const meta = await storage.readJson(metaPath);

				if (asText(generatedContent.description)) {
					meta.description = generatedContent.description;
				}

				if (Array.isArray(generatedContent.notes)) {
					meta.notes = normalizeNotes(generatedContent.notes);
				}

				if (Array.isArray(generatedContent.characters)) {
					const existing = await storage.listEntities(path.campaign, "characters");
					const bySlug = new Map(existing.map((entity) => [entity.slug, entity]));
					const byName = new Map(
						existing
							.map((entity) => ({
								key: `${asText(entity.firstName).toLowerCase()} ${asText(entity.lastName).toLowerCase()}`.trim(),
								entity,
							}))
							.filter(({ key }) => Boolean(key))
							.map(({ key, entity }) => [key, entity]),
					);

					for (const rawCharacter of generatedContent.characters) {
						const nameParts = parseNameParts(rawCharacter);
						const fullNameKey = `${nameParts.firstName.toLowerCase()} ${nameParts.lastName.toLowerCase()}`.trim();
						const baseSlug = storage.campaignSlug(
							nameParts.firstName || rawCharacter.name || "character",
						);

						const existingEntity =
							bySlug.get(rawCharacter.slug) ||
							(fullNameKey ? byName.get(fullNameKey) : null) ||
							null;

						const normalized = normalizeCharacter(rawCharacter, existingEntity);

						if (existingEntity) {
							const payload = {
								...existingEntity,
								...normalized,
								slug: existingEntity.slug,
								id: existingEntity.id,
								imageUrl: existingEntity.imageUrl ?? normalized.imageUrl ?? null,
							};
							await storage.writeEntity(path.campaign, "characters", existingEntity.slug, payload);
							bySlug.set(existingEntity.slug, payload);
							if (fullNameKey) byName.set(fullNameKey, payload);
						} else {
							const uniqueSlug = await storage.ensureUniqueEntitySlug(
								path.campaign,
								"characters",
								baseSlug,
							);
							const payload = {
								...normalized,
								slug: uniqueSlug,
							};
							await storage.writeEntity(path.campaign, "characters", uniqueSlug, payload);
							bySlug.set(uniqueSlug, payload);
							if (fullNameKey) byName.set(fullNameKey, payload);
						}
					}
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
