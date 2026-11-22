const MAX_RECENT_CHAT_MESSAGES = 12;
const SUMMARY_TRIGGER_UNSUMMARIZED = 14;
const SUMMARY_KEEP_RECENT = 10;
const CHARS_PER_TOKEN = 3.6;

const TONE_GUIDANCE = Object.freeze({
	concise: "Be brief, tactical, and direct. Favor bullet points and concrete stats.",
	narrative: "Use evocative, atmospheric tabletop RPG storytelling balanced with clear mechanics.",
	rules_strict: "Prioritize exact D&D 5e/5.5e (2024) mechanics, DCs, action economy, and official terminology.",
});

const COMMAND_INSTRUCTIONS = Object.freeze({
	scene: "@scene: Focus on sensory details, secrets/clues, skill checks (DCs), NPC presence, and actionable scene updates or notes.",
	npc: "@npc: Focus on memorable personality traits, motivation, secrets, appearance, and D&D role/race/class/level.",
	encounter: "@encounter: Balance encounter difficulty against the party levels/count in WORKSPACE CONTEXT. Use exact official English 5e bestiary names or exact customBestiary names in monsters[] (one array element per creature instance). Every newly created encounter MUST set \"clientId\" and MUST be paired in the SAME action's \"operations\" array with a \"scene\" create or update operation referencing it via \"encounterClientId\".",
	bestiary: "@bestiary: Create/update custom 5.5e (2024) monsters using full 5eTools JSON structure (`name`, `source: \"CUSTOM\"`, `size: [\"M\"]`, `type`, `alignment: [\"N\"]`, `ac: [{ \"ac\": 13, \"from\": [\"natural armor\"] }]`, `hp: { \"average\": 45, \"formula\": \"6d8 + 18\" }`, `speed: { \"walk\": 30 }`, `str`, `dex`, `con`, `int`, `wis`, `cha`, `save`, `skill`, `senses`, `languages`, `cr`, `spellcasting`, `trait`, `action`, `bonus`, `reaction`, `legendary` with `{@atk mw}`, `{@hit N}`, `{@damage ...}`, `{@dc N}`, `{@actSave ...}`, `{@spell ...}` tags). Keep targetType: \"monster\" and omit \"scope\".",
	location: "@location: Describe vivid landmarks, sensory atmosphere, inhabitants, factions, hazards, secrets, and tabletop hooks.",
	notes: "@notes: Structure raw notes into scannable Markdown bullets, quests, clues, or session recaps without losing facts.",
	rules: "@rules: Explain D&D 5e/5.5e rules clearly with edge cases and examples. Return actions: [] unless the user explicitly asks to save a note.",
	dice: "@dice: Use the provided SERVER DICE ROLL RESULTS verbatim. Do not invent different numbers. Explain outcomes in context and return actions: [] unless saving notes was requested.",
	image: "@image: Craft ONE vivid, ready-to-use English image-generation prompt (suitable for Imagen / Gemini Image / Midjourney) based on the referenced [Entity], scene, creature, or user request. Include subject details, pose/composition, environment, lighting, mood, and any IMAGE BASE STYLE PROMPT if provided. Present the prompt cleanly inside a fenced text block or concise paragraph in reply, and return \"actions\": [].",
});

function estimateTokensFromText(text) {
	const len = String(text || "").length;
	return len > 0 ? Math.ceil(len / CHARS_PER_TOKEN) : 0;
}

function resolveEntityDisplayName(entity = {}) {
	const first = String(entity.firstName || "").trim();
	const last = String(entity.lastName || "").trim();
	const combined = `${first} ${last}`.trim();
	return String(entity.name || combined || entity.title || "").trim();
}

function collectEntityMatchKeys(entity = {}) {
	const keys = [];
	const display = resolveEntityDisplayName(entity);
	if (display) keys.push(display.toLowerCase());
	if (entity.firstName) keys.push(String(entity.firstName).trim().toLowerCase());
	if (entity.name) keys.push(String(entity.name).trim().toLowerCase());
	if (entity.title) keys.push(String(entity.title).trim().toLowerCase());
	if (entity.slug) keys.push(String(entity.slug).trim().toLowerCase());
	return keys;
}

function stripIgnoredNotesFromEntity(entity) {
	if (!entity || typeof entity !== "object") return entity;
	if (!Array.isArray(entity.notes)) return entity;
	return {
		...entity,
		notes: entity.notes.filter((note) => !note?._aiIgnored),
	};
}

function compactMonsterForContext(monster = {}) {
	return {
		id: monster.id,
		name: monster.name,
		size: monster.size,
		type: monster.type,
		cr: monster.cr,
		ac: monster.ac,
		hp: monster.hp,
	};
}

function getEntitySelectionKey(entity = {}) {
	return String(entity?.id ?? entity?.slug ?? resolveEntityDisplayName(entity)).trim();
}

function getSceneSelectionKey(scene = {}) {
	return String(scene?.id ?? scene?.name ?? scene?.title ?? "").trim();
}

function getMonsterSelectionKey(monster = {}) {
	return String(monster?.id ?? monster?.name ?? "").trim();
}

function filterByOptionalIds(items, selectedIds, getKey) {
	const list = Array.isArray(items) ? items : [];
	if (!Array.isArray(selectedIds)) return list;
	const allowed = new Set(selectedIds.map((id) => String(id ?? "").trim()).filter(Boolean));
	return list.filter((item) => allowed.has(getKey(item)));
}

function resolveMentionedEntities({
	mentionedNames,
	characters,
	npcs,
	locations,
	session,
	customMonsters,
}) {
	if (!Array.isArray(mentionedNames) || mentionedNames.length === 0) return [];
	const wanted = new Set(mentionedNames.map((n) => String(n || "").trim().toLowerCase()).filter(Boolean));
	const results = [];
	const seenKeys = new Set();

	const tryCollect = (items, entityType, scope) => {
		for (const item of Array.isArray(items) ? items : []) {
			if (!item || typeof item !== "object") continue;
			const keys = collectEntityMatchKeys(item);
			if (!keys.some((k) => wanted.has(k))) continue;
			const name = resolveEntityDisplayName(item);
			const uniqueKey = `${scope}:${entityType}:${item.id ?? item.slug ?? name}`;
			if (seenKeys.has(uniqueKey)) continue;
			seenKeys.add(uniqueKey);
			results.push({
				id: item.id,
				slug: item.slug,
				name,
				scope,
				entityType,
				data: stripIgnoredNotesFromEntity(item),
			});
		}
	};

	tryCollect(characters, "character", "campaign");
	tryCollect(npcs, "npc", "campaign");
	tryCollect(locations, "location", "campaign");
	if (session?.data) {
		tryCollect(session.data.npcs, "npc", "session");
		tryCollect(session.data.locations, "location", "session");
		tryCollect(session.data.scenes, "scene", "session");
		tryCollect(session.data.encounters, "encounter", "session");
	}
	tryCollect(customMonsters, "monster", "bestiary");

	return results;
}

/**
 * Resolves a monster by exact case-insensitive name from the bestiary index, preferring CUSTOM, XMM, and MM sources.
 */
function findBestiaryIndexMonster(bestiaryIndex, rawName) {
	if (!(bestiaryIndex instanceof Map)) return null;
	const normalized = String(rawName || "").trim().toLowerCase();
	if (!normalized) return null;
	for (const source of ["CUSTOM", "XMM", "MM"]) {
		const direct = bestiaryIndex.get(`${normalized}|${source}`);
		if (direct) return direct;
	}
	const prefix = `${normalized}|`;
	for (const [key, monster] of bestiaryIndex.entries()) {
		if (key.startsWith(prefix) || String(monster?.name || "").trim().toLowerCase() === normalized) {
			return monster;
		}
	}
	return null;
}

/**
 * Loads live campaign, session, scene, encounter, bestiary, and mentioned-entity context for AI chat.
 */
async function buildChatWorkspaceContext(
	{ storage, filterSessionDataForAiContext },
	{ campaignSlug, workspaceContext = {}, contextSettings = {}, mentionedNames = [], commands = [] },
) {
	const isBestiaryScope = campaignSlug === "bestiary";
	const campaign = isBestiaryScope ? null : await storage.readCampaign(campaignSlug);
	const sessionFileName = !isBestiaryScope && workspaceContext.sessionFileName
		? String(workspaceContext.sessionFileName).trim()
		: "";
	const encounterId = !isBestiaryScope && workspaceContext.encounterId !== undefined && workspaceContext.encounterId !== null && workspaceContext.encounterId !== ""
		? String(workspaceContext.encounterId)
		: "";
	const sceneId = !isBestiaryScope && workspaceContext.sceneId !== undefined && workspaceContext.sceneId !== null && workspaceContext.sceneId !== ""
		? String(workspaceContext.sceneId)
		: "";

	const [characters, npcs, locations, session, customBestiaryRaw, allSessions] = await Promise.all([
		isBestiaryScope ? Promise.resolve([]) : storage.listEntities(campaignSlug, "characters").catch(() => []),
		isBestiaryScope ? Promise.resolve([]) : storage.listEntities(campaignSlug, "npc").catch(() => []),
		isBestiaryScope ? Promise.resolve([]) : storage.listEntities(campaignSlug, "locations").catch(() => []),
		sessionFileName
			? storage.readSession(campaignSlug, sessionFileName).catch(() => null)
			: Promise.resolve(null),
		storage.readCustomBestiary().catch(() => ({ monster: [] })),
		!isBestiaryScope &&
		(!sessionFileName || contextSettings.includeRecentSessionHistory) &&
		typeof storage.listSessions === "function"
			? storage.listSessions(campaignSlug).catch(() => [])
			: Promise.resolve([]),
	]);

	const visibleCharacters = characters.filter((c) => !c?._aiIgnored).map(stripIgnoredNotesFromEntity);
	const visibleNpcs = npcs.filter((n) => !n?._aiIgnored).map(stripIgnoredNotesFromEntity);
	const visibleLocations = locations.filter((l) => !l?._aiIgnored).map(stripIgnoredNotesFromEntity);
	const customMonsters = Array.isArray(customBestiaryRaw?.monster) ? customBestiaryRaw.monster : [];

	const filteredSessionData = session?.data ? filterSessionDataForAiContext(session.data) : null;
	const scenes = Array.isArray(filteredSessionData?.scenes) ? filteredSessionData.scenes : [];
	const encounters = Array.isArray(filteredSessionData?.encounters) ? filteredSessionData.encounters : [];
	const currentScene = sceneId ? scenes.find((s) => String(s?.id ?? "") === sceneId) || null : null;
	const currentEncounter = encounterId ? encounters.find((e) => String(e?.id ?? "") === encounterId) || null : null;

	const viewType = isBestiaryScope
		? "bestiary"
		: encounterId
			? "encounter"
			: workspaceContext.viewType || (session ? "session" : "campaign");

	const availableSessions =
		!isBestiaryScope && !session && Array.isArray(allSessions) && allSessions.length > 0
			? allSessions.map((s) => ({
					fileName: s.fileName,
					name: s.name || s.fileName,
				}))
			: [];

	const contextPayload = {
		workspace: {
			viewType,
			campaignSlug,
			campaignName: isBestiaryScope ? "Бестіарій" : campaign?.name || campaignSlug,
			...(sessionFileName ? { sessionFileName, sessionName: session?.name || sessionFileName } : {}),
			...(availableSessions.length > 0 ? { availableSessions } : {}),
			...(currentEncounter ? { encounterId, encounterName: currentEncounter.name || "" } : encounterId ? { encounterId } : {}),
			...(currentScene ? { sceneId, sceneTitle: currentScene.name || currentScene.title || "" } : sceneId ? { sceneId } : {}),
			...(workspaceContext.activeSection ? { activeSection: String(workspaceContext.activeSection) } : {}),
		},
		...(isBestiaryScope
			? {}
			: {
					campaign: {
						name: campaign?.name || campaignSlug,
						description: campaign?.description || "",
						notes: Array.isArray(campaign?.notes)
							? campaign.notes.filter((note) => !note?._aiIgnored)
							: [],
					},
				}),
	};

	const hasExplicitCharactersSetting = contextSettings.includeCampaignCharacters !== undefined;
	const includeCharacters =
		!isBestiaryScope &&
		(hasExplicitCharactersSetting
			? contextSettings.includeCampaignCharacters !== false
			: contextSettings.includeCampaignNpc !== false ||
				viewType === "encounter" ||
				commands.includes("encounter"));

	if (!isBestiaryScope && contextPayload.campaign) {
		if (includeCharacters) {
			contextPayload.campaign.characters = filterByOptionalIds(
				visibleCharacters,
				contextSettings.selectedCharacterIds,
				getEntitySelectionKey,
			);
		}
		if (contextSettings.includeCampaignNpc !== false) {
			contextPayload.campaign.npcs = filterByOptionalIds(
				visibleNpcs,
				contextSettings.selectedNpcIds,
				getEntitySelectionKey,
			);
		}
		if (contextSettings.includeCampaignLocations !== false) {
			contextPayload.campaign.locations = filterByOptionalIds(
				visibleLocations,
				contextSettings.selectedLocationIds,
				getEntitySelectionKey,
			);
		}
	}

	if (session && filteredSessionData && contextSettings.includeCurrentScene !== false) {
		const sessionDataForPrompt = Array.isArray(contextSettings.selectedSceneIds)
			? {
					...filteredSessionData,
					scenes: filterByOptionalIds(
						scenes,
						contextSettings.selectedSceneIds,
						getSceneSelectionKey,
					),
				}
			: filteredSessionData;
		contextPayload.currentSession = {
			fileName: sessionFileName,
			name: session.name,
			data: sessionDataForPrompt,
		};
	} else if (session && (currentScene || currentEncounter)) {
		contextPayload.currentSessionSummary = {
			fileName: sessionFileName,
			name: session.name,
		};
	}

	if (currentScene) {
		contextPayload.currentScene = currentScene;
	}
	if (currentEncounter) {
		contextPayload.currentEncounter = currentEncounter;
	}

	if (contextSettings.includeRecentSessionHistory) {
		const sessionList = Array.isArray(allSessions) ? allSessions : [];
		const otherSessions = sessionList.filter((s) => s.fileName !== sessionFileName);
		let recentMeta;
		if (Array.isArray(contextSettings.selectedSessionFileNames)) {
			const allowedSessions = new Set(
				contextSettings.selectedSessionFileNames.map((f) => String(f ?? "").trim()).filter(Boolean),
			);
			recentMeta = otherSessions
				.filter((s) => allowedSessions.has(String(s.fileName || "").trim()))
				.reverse()
				.slice(0, 12);
		} else {
			recentMeta = otherSessions.slice(-3).reverse();
		}
		const recentSessions = [];
		for (const meta of recentMeta) {
			const loaded = await storage.readSession(campaignSlug, meta.fileName).catch(() => null);
			if (!loaded) continue;
			const clean = filterSessionDataForAiContext(loaded.data || {});
			recentSessions.push({
				fileName: meta.fileName,
				name: loaded.name,
				notes: clean.notes,
				sceneTitles: (clean.scenes || []).map((sc) => sc.name || sc.title || "").filter(Boolean),
			});
		}
		if (recentSessions.length > 0) {
			contextPayload.recentSessions = recentSessions;
		}
	}

	if (
		contextSettings.includeBestiary ||
		commands.includes("encounter") ||
		commands.includes("bestiary") ||
		viewType === "encounter" ||
		viewType === "bestiary"
	) {
		const hasExplicitBestiary = Array.isArray(contextSettings.selectedBestiaryIds);
		const filteredCustomMonsters = hasExplicitBestiary
			? filterByOptionalIds(customMonsters, contextSettings.selectedBestiaryIds, getMonsterSelectionKey)
			: customMonsters;
		contextPayload.customBestiary = {
			monsterNames: filteredCustomMonsters.map((m) => m?.name).filter(Boolean),
			...(commands.includes("bestiary") || contextSettings.includeBestiary
				? {
						monsters: (hasExplicitBestiary
							? filteredCustomMonsters
							: filteredCustomMonsters.slice(0, 25)
						).map(compactMonsterForContext),
					}
				: {}),
		};
	}

	const mentionedEntities = resolveMentionedEntities({
		mentionedNames,
		characters,
		npcs,
		locations,
		session,
		customMonsters,
	});
	const matchedKeys = new Set();
	for (const entry of mentionedEntities) {
		for (const key of collectEntityMatchKeys(entry?.data)) {
			matchedKeys.add(key);
		}
		if (entry?.name) matchedKeys.add(String(entry.name).trim().toLowerCase());
	}
	const unmatchedMentionNames = (Array.isArray(mentionedNames) ? mentionedNames : [])
		.map((name) => String(name || "").trim())
		.filter((name) => name && !matchedKeys.has(name.toLowerCase()));
	if (unmatchedMentionNames.length > 0 && typeof storage.getBestiaryIndex === "function") {
		const bestiaryIndex = await storage.getBestiaryIndex().catch(() => null);
		const seenBestiary = new Set();
		for (const name of unmatchedMentionNames) {
			const monster = findBestiaryIndexMonster(bestiaryIndex, name);
			if (!monster?.name) continue;
			const uniqueKey = `${String(monster.name).trim().toLowerCase()}|${String(monster.source || "").toUpperCase()}`;
			if (seenBestiary.has(uniqueKey)) continue;
			seenBestiary.add(uniqueKey);
			mentionedEntities.push({
				id: monster.id || uniqueKey,
				name: monster.name,
				scope: "bestiary",
				entityType: "monster",
				source: monster.source || "",
				data: monster,
			});
		}
	}
	if (mentionedEntities.length > 0) {
		contextPayload.mentionedEntities = mentionedEntities;
	}

	const mentionCandidateNames = Array.from(
		new Set(
			[
				...visibleCharacters.map(resolveEntityDisplayName),
				...visibleNpcs.map(resolveEntityDisplayName),
				...visibleLocations.map(resolveEntityDisplayName),
				...(session?.data?.npcs || []).map(resolveEntityDisplayName),
				...(session?.data?.locations || []).map(resolveEntityDisplayName),
				...mentionedEntities.map((m) => m.name),
			].filter(Boolean),
		),
	);

	return {
		campaign,
		session,
		contextPayload,
		mentionCandidateNames,
		simplifiedNotes: Boolean(campaign?.simplifiedNotes),
	};
}

/**
 * Builds the system instruction guiding the conversational D&D assistant JSON contract.
 */
function buildChatSystemInstruction({
	responseLanguage = "uk",
	responseTone = "narrative",
	rulesEdition = "5.5e",
	commands = [],
	workspaceViewType = "campaign",
	needsTitle = false,
	globalBasePrompt = "",
	campaignBasePrompt = "",
	imageBasePrompt = "",
	simplifiedNotes = false,
}) {
	const langLabel = String(responseLanguage).toLowerCase().startsWith("en")
		? "English"
		: "Ukrainian";
	const normalizedEdition = rulesEdition === "5e" ? "5e" : "5.5e";
	const editionLabel =
		normalizedEdition === "5e"
			? "D&D 5e (2014 Classic Rules)"
			: "D&D 5.5e (2024 Revised Rules)";
	const toneText =
		responseTone === "rules_strict"
			? `Prioritize exact ${editionLabel} mechanics, DCs, action economy, and official terminology.`
			: TONE_GUIDANCE[responseTone] || TONE_GUIDANCE.narrative;
	const commandHints = commands
		.map((cmd) => COMMAND_INSTRUCTIONS[cmd])
		.filter(Boolean);

	const parts = [
		`You are an expert Dungeons & Dragons AI Assistant integrated inside the PRM Campaign Manager. Primary ruleset: ${editionLabel}.`,
		`CRITICAL: Always write your natural-language "reply", action "title", "subtitle", "description", and any new game content in ${langLabel}. Keep D&D 5eTools lookup tags ({@spell ...}, {@condition ...}, {@damage ...}) and official English monster names in English.`,
		`Tone guidance: ${toneText}`,
		`Current workspace view: "${workspaceViewType}".${simplifiedNotes ? " Note: simplified notes mode is enabled (omit redundant note titles unless essential)." : ""}`,
		globalBasePrompt ? `Global DM Instructions: ${globalBasePrompt}` : "",
		campaignBasePrompt ? `Campaign DM Instructions: ${campaignBasePrompt}` : "",
		commands.includes("image") && imageBasePrompt
			? `Image style base prompt to incorporate: ${imageBasePrompt}`
			: "",
		`OUTPUT FORMAT — Return ONE raw JSON object only (no Markdown fences around the outer JSON). Always output JSON keys in this exact order: ${needsTitle ? '"chatTitle", then ' : ""}"reply", then "actions":
{
  ${needsTitle ? '"chatTitle": "3-6 word summary title in ' + langLabel + '",\n  ' : ""}"reply": "Helpful Markdown response for the DM. Reference existing campaign/session entities using [Exact Name].",
  "actions": [
    {
      "kind": "atomic | diff",
      "title": "Short action card title",
      "subtitle": "Optional category label",
      "description": "What this action changes, referencing entities with [Exact Name]",
      "targetEntity": "Human-readable name of target scene, NPC, location, session, encounter, or monster",
      "targetType": "campaign | session | scene | npc | character | location | encounter | monster | note",
      "operations": [ /* one or more PRM v2 patch operations */ ]
    }
  ]
}`,
		`WHEN TO EMIT ACTIONS vs EMPTY ARRAY:
- For pure questions, brainstorming, @rules lookups, or @dice rolls where the user did not ask to modify campaign data, return "actions": [].
- Whenever the user asks to create, edit, move, balance, add notes, or update workspace entities/scenes/encounters/monsters, populate "actions" with executable PRM v2 operations AND summarize them clearly in "reply".
- Use "kind": "atomic" for single-step structural/quick actions (e.g., moveScope between campaign and session, adding an existing monster to an encounter, quick appendNote).
- Use "kind": "diff" for multi-field content generation or rewriting (e.g., creating/rewriting a scene, NPC, location, monster, or full encounter).`,
		`SUPPORTED PRM V2 OPERATIONS (used inside each action's "operations" array):
- create: { "op": "create", "entity": "npc|location|character|scene|encounter|monster", "scope": "campaign|session", "clientId": "optional-temp-id", "data": { ...fields... } }
- update: { "op": "update", "entity": "campaign|npc|location|character|scene|encounter|encounter-creature|monster", "scope": "campaign|session", "id": "EXACT_EXISTING_ID", "patch": { ...changedFieldsOnly... } }
- delete: { "op": "delete", "entity": "npc|location|character|scene|encounter|monster", "scope": "campaign|session", "id": "EXACT_EXISTING_ID" }
- appendNote: { "op": "appendNote", "entity": "campaign|session|scene|npc|location|character", "scope": "campaign|session", "id": "EXACT_OWNER_ID_OR_OMIT_FOR_CAMPAIGN_OR_SESSION", "targetClientId": "if_created_in_same_action", "note": { "title": "...", "text": "Markdown text..." } }
- updateNote: { "op": "updateNote", "entity": "campaign|session|scene|npc|location|character", "scope": "campaign|session", "id": "EXACT_OWNER_ID", "noteId": "EXACT_NOTE_ID", "patch": { "title": "...", "text": "..." } }
- deleteNote: { "op": "deleteNote", "entity": "campaign|session|scene|npc|location|character", "scope": "campaign|session", "id": "EXACT_OWNER_ID", "noteId": "EXACT_NOTE_ID" }
- moveScope: { "op": "moveScope", "entity": "npc|location", "id": "EXACT_ENTITY_ID", "from": "campaign|session", "to": "session|campaign" }

RULES FOR OPERATIONS:
1. NEVER invent existing IDs. Always use the exact "id" (or "slug"/"name" if id absent) found in WORKSPACE CONTEXT or mentionedEntities.
2. When a current session is active, always specify "scope": "campaign" or "scope": "session" on npc/location operations. Scenes ALWAYS use "scope": "session" (never "scope": "campaign") and "data": { "texts": { "summary": "...", "goal": "...", "stakes": "...", "location": "..." } } with non-empty fields in ${langLabel}.
3. For NEW encounters: every "create" "encounter" operation MUST use "scope": "session", MUST define a unique "clientId" (e.g. "encounter-1"), MUST omit final "id", MUST list each creature instance as its own item in "monsters": [{ "monsterName": "Official English Name or Custom Monster Name", "name": "Optional label" }] (do NOT use count/quantity), and MUST be paired inside the SAME action's "operations" array with either:
   - { "op": "update", "entity": "scene", "scope": "session", "id": "EXACT_EXISTING_SCENE_ID", "patch": { "encounterClientId": "encounter-1" } } (only if the existing scene does not already have an "encounterId"), OR
   - { "op": "create", "entity": "scene", "scope": "session", "clientId": "scene-1", "data": { "texts": { "summary": "...", "goal": "...", "stakes": "...", "location": "..." }, "encounterClientId": "encounter-1" } }.
   Optionally include a tactical combat-mechanics note on that scene via appendNote ("targetClientId": "scene-1" or existing scene "id") in the same action card.
4. For EXISTING encounter updates, patch { "name": "...", "monsters": [{ "monsterName": "Official English Name or Custom Monster Name", "name": "Optional label" }] } using exact "id".
5. Omit "scope" for "monster" (custom bestiary) and "encounter-creature" operations.
6. For "monster" creation, populate full 5eTools JSON inside "data" (name, source: "CUSTOM", size: ["M"], type, alignment, ac: [{ "ac": 13, "from": ["natural armor"] }], hp: { "average": 45, "formula": "6d8 + 18" }, speed: { "walk": 30 }, str, dex, con, int, wis, cha, save, skill, senses, languages, cr, trait, action, bonus, reaction, legendary, spellcasting). If creating a new custom creature based on an official or referenced creature in "mentionedEntities", emit { "op": "create", "entity": "monster", "data": { ...adapted full 5eTools JSON with "source": "CUSTOM"... } } without modifying the original official creature. For updating an existing custom monster, use { "op": "update", "entity": "monster", "id": "EXACT_MONSTER_ID", "patch": { ...changedFieldsOnly... } } — never duplicate unchanged fields.
7. Do not split dependent operations across separate cards (e.g. creating an encounter and linking a scene with "encounterClientId", or creating an NPC and appending/moving it via "targetClientId") — keep all dependent ops inside one action card.`,
	];

	if (commandHints.length > 0) {
		parts.push(`ACTIVE SLASH/AT COMMANDS:\n${commandHints.join("\n")}`);
	}

	return parts.filter(Boolean).join("\n\n");
}

function summarizeActionCardForPrompt(card) {
	return `${card.title} [${card.status}]${card.targetEntity ? ` -> ${card.targetEntity}` : ""}`;
}

function formatRecentMessage(msg) {
	const roleLabel = msg.role === "assistant" ? "ASSISTANT" : "USER";
	const lines = [`${roleLabel}: ${String(msg.content || "").trim()}`];
	if (Array.isArray(msg.actionCards) && msg.actionCards.length > 0) {
		const cards = msg.actionCards.map(summarizeActionCardForPrompt).join("; ");
		lines.push(`  [Action Cards: ${cards}]`);
	}
	return lines.join("\n");
}

/**
 * Composes the user-turn prompt combining workspace JSON, rolled dice, summary, and history.
 */
function buildChatTurnPrompt({
	summary = "",
	summarizedMessageCount = 0,
	recentMessages = [],
	contextPayload = {},
	userMessage = "",
	diceRolls = [],
	needsTitle = false,
	attachments = [],
}) {
	const sections = [
		`WORKSPACE CONTEXT:\n${JSON.stringify(contextPayload, null, 2)}`,
	];

	if (summary) {
		sections.push(`CONVERSATION SUMMARY SO FAR:\n${summary}`);
	}

	const startIdx =
		Number.isFinite(Number(summarizedMessageCount)) && Number(summarizedMessageCount) > 0
			? Math.min(recentMessages.length, Number(summarizedMessageCount))
			: 0;
	const sliced = recentMessages.slice(startIdx).slice(-MAX_RECENT_CHAT_MESSAGES);
	if (sliced.length > 0) {
		sections.push(`RECENT CONVERSATION:\n${sliced.map(formatRecentMessage).join("\n\n")}`);
	}

	if (Array.isArray(diceRolls) && diceRolls.length > 0) {
		const diceText = diceRolls
			.map((r) => `${r.expression}: rolls=[${r.rolls.join(", ")}]${r.modifier ? ` modifier=${r.modifier >= 0 ? `+${r.modifier}` : r.modifier}` : ""} => TOTAL=${r.total}`)
			.join("\n");
		sections.push(`SERVER DICE ROLL RESULTS (already rolled fairly — report these exact numbers):\n${diceText}`);
	}

	sections.push(`CURRENT USER MESSAGE:\n${userMessage}`);

	if (needsTitle) {
		sections.push("TITLE REQUIREMENT: Because this is the first message in this chat, provide a concise 3-6 word \"chatTitle\" in the JSON output.");
	}

	const userPrompt = sections.join("\n\n---\n\n");
	const attachmentTokens = (Array.isArray(attachments) ? attachments : []).reduce((acc, att) => {
		const isImg = String(att?.mimeType || "").startsWith("image/");
		return acc + (isImg ? 260 : Math.min(4000, Math.ceil((Number(att?.sizeBytes) || 1024) / 4)));
	}, 0);

	return {
		userPrompt,
		tokenEstimate: estimateTokensFromText(userPrompt) + attachmentTokens,
	};
}

function buildFallbackDigest(previousSummary, messagesToCompact) {
	const lines = previousSummary ? [previousSummary] : [];
	for (const msg of messagesToCompact.slice(-6)) {
		const snippet = String(msg.content || "").replace(/\s+/g, " ").trim().slice(0, 140);
		if (snippet) lines.push(`${msg.role === "assistant" ? "AI" : "DM"}: ${snippet}`);
	}
	return lines.join("\n").slice(-2000);
}

/**
 * Estimates tokens consumed by conversation summary plus unsummarized recent turns.
 */
function estimateChatHistoryTokens(chat) {
	if (!chat || typeof chat !== "object") return 0;
	const historyParts = [];
	if (chat.summary) {
		historyParts.push(`CONVERSATION SUMMARY SO FAR:\n${chat.summary}`);
	}
	const allMessages = Array.isArray(chat.messages) ? chat.messages : [];
	const currentSummarized = Math.max(0, Number(chat.summarizedMessageCount) || 0);
	const startIdx = Math.min(allMessages.length, currentSummarized);
	const sliced = allMessages.slice(startIdx).slice(-MAX_RECENT_CHAT_MESSAGES);
	if (sliced.length > 0) {
		historyParts.push(`RECENT CONVERSATION:\n${sliced.map(formatRecentMessage).join("\n\n")}`);
	}
	return historyParts.length > 0 ? estimateTokensFromText(historyParts.join("\n\n---\n\n")) : 0;
}

/**
 * Compacts older chat turns into a rolling summary when the unsummarized window grows too large or forced manually.
 */
async function compactChatHistoryIfNeeded(
	{ geminiGateway },
	{ chat, modelName, responseLanguage = "uk", force = false, keepRecent = SUMMARY_KEEP_RECENT },
) {
	const messages = Array.isArray(chat?.messages) ? chat.messages : [];
	const currentSummarized = Math.max(0, Number(chat?.summarizedMessageCount) || 0);
	const unsummarizedCount = messages.length - currentSummarized;
	const effectiveKeepRecent = Math.max(0, Number(keepRecent) || 0);

	if (
		!force &&
		(unsummarizedCount < SUMMARY_TRIGGER_UNSUMMARIZED || messages.length <= effectiveKeepRecent)
	) {
		return {
			summary: String(chat?.summary || ""),
			summarizedMessageCount: currentSummarized,
			compacted: false,
			compactedCount: 0,
		};
	}

	const nextSummarizedCount = messages.length - effectiveKeepRecent;
	if (nextSummarizedCount <= currentSummarized) {
		return {
			summary: String(chat?.summary || ""),
			summarizedMessageCount: currentSummarized,
			compacted: false,
			compactedCount: 0,
		};
	}

	const sliceToCompact = messages.slice(currentSummarized, nextSummarizedCount);
	const compactedCount = sliceToCompact.length;
	const targetLang = String(responseLanguage).toLowerCase().startsWith("en") ? "English" : "Ukrainian";

	if (!modelName || typeof geminiGateway?.generateText !== "function") {
		return {
			summary: buildFallbackDigest(chat?.summary, sliceToCompact),
			summarizedMessageCount: nextSummarizedCount,
			compacted: true,
			compactedCount,
		};
	}

	try {
		const summaryText = await geminiGateway.generateText({
			modelName,
			systemInstruction: `Summarize this D&D campaign assistant conversation concisely in ${targetLang}. Preserve key narrative decisions, created/modified entities, exact IDs/names, and active quest/scene facts.`,
			useJsonResponse: false,
			userPrompt: [
				chat?.summary ? `Previous summary:\n${chat.summary}` : "",
				`New turns to fold in:\n${sliceToCompact.map(formatRecentMessage).join("\n")}`,
			].filter(Boolean).join("\n\n"),
		});
		const cleaned = String(summaryText || "").trim();
		return {
			summary: cleaned || buildFallbackDigest(chat?.summary, sliceToCompact),
			summarizedMessageCount: nextSummarizedCount,
			compacted: true,
			compactedCount,
		};
	} catch {
		return {
			summary: buildFallbackDigest(chat?.summary, sliceToCompact),
			summarizedMessageCount: nextSummarizedCount,
			compacted: true,
			compactedCount,
		};
	}
}

/**
 * Returns selectable context catalog items with per-item token estimates and live totals for empty or active chats.
 */
async function buildChatContextPreview(
	{ storage, filterSessionDataForAiContext },
	{
		campaignSlug,
		workspaceContext = {},
		contextSettings = {},
		chat = null,
		responseLanguage = "uk",
		globalBasePrompt = "",
		campaignBasePrompt = "",
		maxTokens = 1000000,
	},
) {
	const isBestiaryScope = campaignSlug === "bestiary";
	const campaign = isBestiaryScope
		? null
		: await storage.readCampaign(campaignSlug).catch(() => null);
	const sessionFileName = !isBestiaryScope && workspaceContext.sessionFileName
		? String(workspaceContext.sessionFileName).trim()
		: "";
	const encounterId =
		!isBestiaryScope &&
		workspaceContext.encounterId !== undefined &&
		workspaceContext.encounterId !== null &&
		workspaceContext.encounterId !== ""
			? String(workspaceContext.encounterId)
			: "";
	const sceneId =
		!isBestiaryScope &&
		workspaceContext.sceneId !== undefined &&
		workspaceContext.sceneId !== null &&
		workspaceContext.sceneId !== ""
			? String(workspaceContext.sceneId)
			: "";

	const [characters, npcs, locations, session, allSessions, customBestiaryRaw] = await Promise.all([
		isBestiaryScope ? Promise.resolve([]) : storage.listEntities(campaignSlug, "characters").catch(() => []),
		isBestiaryScope ? Promise.resolve([]) : storage.listEntities(campaignSlug, "npc").catch(() => []),
		isBestiaryScope ? Promise.resolve([]) : storage.listEntities(campaignSlug, "locations").catch(() => []),
		sessionFileName
			? storage.readSession(campaignSlug, sessionFileName).catch(() => null)
			: Promise.resolve(null),
		isBestiaryScope ? Promise.resolve([]) : storage.listSessions(campaignSlug).catch(() => []),
		storage.readCustomBestiary().catch(() => ({ monster: [] })),
	]);

	const visibleCharacters = characters.filter((c) => !c?._aiIgnored).map(stripIgnoredNotesFromEntity);
	const visibleNpcs = npcs.filter((n) => !n?._aiIgnored).map(stripIgnoredNotesFromEntity);
	const visibleLocations = locations.filter((l) => !l?._aiIgnored).map(stripIgnoredNotesFromEntity);
	const customMonsters = Array.isArray(customBestiaryRaw?.monster) ? customBestiaryRaw.monster : [];
	const filteredSessionData = session?.data ? filterSessionDataForAiContext(session.data) : null;
	const scenes = Array.isArray(filteredSessionData?.scenes) ? filteredSessionData.scenes : [];
	const encounters = Array.isArray(filteredSessionData?.encounters) ? filteredSessionData.encounters : [];
	const currentScene = sceneId ? scenes.find((s) => String(s?.id ?? "") === sceneId) || null : null;
	const currentEncounter = encounterId
		? encounters.find((e) => String(e?.id ?? "") === encounterId) || null
		: null;

	const viewType = isBestiaryScope
		? "bestiary"
		: encounterId
			? "encounter"
			: workspaceContext.viewType || (session ? "session" : "campaign");

	const otherMeta = (Array.isArray(allSessions) ? allSessions : [])
		.filter((s) => s?.fileName && s.fileName !== sessionFileName)
		.slice()
		.reverse()
		.slice(0, 20);
	const loadedOtherSessions = await Promise.all(
		otherMeta.map(async (meta) => {
			const loaded = await storage.readSession(campaignSlug, meta.fileName).catch(() => null);
			if (!loaded) return null;
			const clean = filterSessionDataForAiContext(loaded.data || {});
			const sceneTitles = (clean.scenes || []).map((sc) => sc.name || sc.title || "").filter(Boolean);
			const summaryObj = {
				fileName: meta.fileName,
				name: loaded.name,
				notes: clean.notes,
				sceneTitles,
			};
			return {
				id: String(meta.fileName),
				name: String(loaded.name || meta.name || meta.fileName),
				meta: sceneTitles.length > 0 ? `${sceneTitles.length} сцен` : "",
				tokenEstimate: estimateTokensFromText(JSON.stringify(summaryObj)),
			};
		}),
	);

	const catalog = {
		characters: visibleCharacters.map((c) => {
			const levelText = c?.level ? `Рів. ${c.level}` : "";
			return {
				id: getEntitySelectionKey(c),
				name: resolveEntityDisplayName(c) || getEntitySelectionKey(c),
				meta: [c?.class || c?.role, levelText].filter(Boolean).join(" · "),
				tokenEstimate: estimateTokensFromText(JSON.stringify(c)),
			};
		}),
		npcs: visibleNpcs.map((n) => ({
			id: getEntitySelectionKey(n),
			name: resolveEntityDisplayName(n) || getEntitySelectionKey(n),
			meta: [n?.role || n?.class, n?.race].filter(Boolean).join(" · "),
			tokenEstimate: estimateTokensFromText(JSON.stringify(n)),
		})),
		locations: visibleLocations.map((l) => ({
			id: getEntitySelectionKey(l),
			name: resolveEntityDisplayName(l) || getEntitySelectionKey(l),
			meta: String(l?.type || l?.region || "").trim(),
			tokenEstimate: estimateTokensFromText(JSON.stringify(l)),
		})),
		scenes: scenes.map((sc) => ({
			id: getSceneSelectionKey(sc),
			name: String(sc?.name || sc?.title || getSceneSelectionKey(sc)),
			meta: Array.isArray(sc?.notes) && sc.notes.length > 0 ? `${sc.notes.length} нот.` : "",
			tokenEstimate: estimateTokensFromText(JSON.stringify(sc)),
		})),
		sessions: loadedOtherSessions.filter(Boolean),
		bestiary: customMonsters.map((m) => {
			const crText =
				typeof m?.cr === "object" && m.cr !== null ? m.cr.cr : m?.cr;
			return {
				id: getMonsterSelectionKey(m),
				name: String(m?.name || getMonsterSelectionKey(m)),
				meta: crText !== undefined && crText !== null && crText !== "" ? `CR ${crText}` : "CUSTOM",
				tokenEstimate: estimateTokensFromText(JSON.stringify(compactMonsterForContext(m))),
			};
		}),
	};

	const baseWorkspacePayload = {
		workspace: {
			viewType,
			campaignSlug,
			campaignName: isBestiaryScope ? "Бестіарій" : campaign?.name || campaignSlug,
			...(sessionFileName ? { sessionFileName, sessionName: session?.name || sessionFileName } : {}),
			...(currentEncounter ? { encounterId, encounterName: currentEncounter.name || "" } : encounterId ? { encounterId } : {}),
			...(currentScene ? { sceneId, sceneTitle: currentScene.name || currentScene.title || "" } : sceneId ? { sceneId } : {}),
		},
		...(isBestiaryScope
			? {}
			: {
					campaign: {
						name: campaign?.name || campaignSlug,
						description: campaign?.description || "",
						notes: Array.isArray(campaign?.notes)
							? campaign.notes.filter((note) => !note?._aiIgnored)
							: [],
					},
				}),
	};
	const campaignBaseTokens = estimateTokensFromText(
		`WORKSPACE CONTEXT:\n${JSON.stringify(baseWorkspacePayload, null, 2)}`,
	);

	const currentSessionBaseTokens = filteredSessionData
		? estimateTokensFromText(
				JSON.stringify({
					fileName: sessionFileName,
					name: session.name,
					data: { ...filteredSessionData, scenes: [] },
				}),
			)
		: 0;

	const needsTitle =
		!chat?.isAutoTitled &&
		(!Array.isArray(chat?.messages) ||
			chat.messages.filter((msg) => msg.role === "user").length === 0);
	const systemInstruction = buildChatSystemInstruction({
		responseLanguage,
		responseTone: contextSettings.responseTone || "narrative",
		rulesEdition: contextSettings.rulesEdition || "5.5e",
		commands: [],
		workspaceViewType: viewType,
		needsTitle,
		globalBasePrompt,
		campaignBasePrompt,
		simplifiedNotes: Boolean(campaign?.simplifiedNotes),
	});
	const systemTokens = estimateTokensFromText(systemInstruction);

	const historyTokens = estimateChatHistoryTokens(chat);

	const sumSelected = (items, enabled, selectedIds, limitDefault = null) => {
		if (!enabled || items.length === 0) return 0;
		if (Array.isArray(selectedIds)) {
			const set = new Set(selectedIds.map((id) => String(id ?? "").trim()).filter(Boolean));
			return items.reduce((acc, item) => (set.has(item.id) ? acc + item.tokenEstimate : acc), 0);
		}
		const list = limitDefault ? items.slice(0, limitDefault) : items;
		return list.reduce((acc, item) => acc + item.tokenEstimate, 0);
	};

	const includeCharacters =
		contextSettings.includeCampaignCharacters !== undefined
			? contextSettings.includeCampaignCharacters !== false
			: contextSettings.includeCampaignNpc !== false || viewType === "encounter";

	const contextTokens =
		campaignBaseTokens +
		(filteredSessionData && contextSettings.includeCurrentScene !== false
			? currentSessionBaseTokens +
				sumSelected(catalog.scenes, true, contextSettings.selectedSceneIds)
			: 0) +
		sumSelected(catalog.characters, includeCharacters, contextSettings.selectedCharacterIds) +
		sumSelected(catalog.npcs, contextSettings.includeCampaignNpc !== false, contextSettings.selectedNpcIds) +
		sumSelected(
			catalog.locations,
			contextSettings.includeCampaignLocations !== false,
			contextSettings.selectedLocationIds,
		) +
		sumSelected(
			catalog.sessions,
			Boolean(contextSettings.includeRecentSessionHistory),
			contextSettings.selectedSessionFileNames,
			3,
		) +
		sumSelected(
			catalog.bestiary,
			Boolean(contextSettings.includeBestiary || isBestiaryScope),
			contextSettings.selectedBestiaryIds,
			25,
		);

	return {
		systemTokens,
		campaignBaseTokens,
		currentSessionBaseTokens,
		historyTokens,
		hasActiveSession: Boolean(session && filteredSessionData),
		activeSessionName: session?.name || sessionFileName || "",
		defaultRecentSessionCount: 3,
		maxTokens,
		catalog,
		totals: {
			systemTokens,
			contextTokens,
			historyTokens,
			totalTokens: systemTokens + contextTokens + historyTokens,
		},
	};
}

module.exports = {
	MAX_RECENT_CHAT_MESSAGES,
	SUMMARY_TRIGGER_UNSUMMARIZED,
	SUMMARY_KEEP_RECENT,
	estimateTokensFromText,
	estimateChatHistoryTokens,
	buildChatWorkspaceContext,
	buildChatContextPreview,
	buildChatSystemInstruction,
	buildChatTurnPrompt,
	compactChatHistoryIfNeeded,
};
