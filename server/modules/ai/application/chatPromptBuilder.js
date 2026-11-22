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
	encounter: "@encounter: Balance encounter difficulty against the party levels/count in WORKSPACE CONTEXT. Use exact official English 5e bestiary names or exact customBestiary names in encounter monsters.",
	bestiary: "@bestiary: Create/update custom 5.5e (2024) monsters using full 5eTools JSON structure (`name`, `source: \"CUSTOM\"`, `size: [\"M\"]`, `type`, `alignment: [\"N\"]`, `ac: [{ \"ac\": 13, \"from\": [\"natural armor\"] }]`, `hp: { \"average\": 45, \"formula\": \"6d8 + 18\" }`, `speed: { \"walk\": 30 }`, `str`, `dex`, `con`, `int`, `wis`, `cha`, `save`, `skill`, `senses`, `languages`, `cr`, `spellcasting`, `trait`, `action`, `bonus`, `reaction`, `legendary` with `{@atk mw}`, `{@hit N}`, `{@damage ...}`, `{@dc N}`, `{@actSave ...}`, `{@spell ...}` tags). Keep targetType: \"monster\" and omit \"scope\".",
	location: "@location: Describe vivid landmarks, sensory atmosphere, inhabitants, factions, hazards, secrets, and tabletop hooks.",
	notes: "@notes: Structure raw notes into scannable Markdown bullets, quests, clues, or session recaps without losing facts.",
	rules: "@rules: Explain D&D 5e/5.5e rules clearly with edge cases and examples. Return actions: [] unless the user explicitly asks to save a note.",
	dice: "@dice: Use the provided SERVER DICE ROLL RESULTS verbatim. Do not invent different numbers. Explain outcomes in context and return actions: [] unless saving notes was requested.",
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
	const campaign = await storage.readCampaign(campaignSlug);
	const sessionFileName = workspaceContext.sessionFileName
		? String(workspaceContext.sessionFileName).trim()
		: "";
	const encounterId = workspaceContext.encounterId !== undefined && workspaceContext.encounterId !== null && workspaceContext.encounterId !== ""
		? String(workspaceContext.encounterId)
		: "";
	const sceneId = workspaceContext.sceneId !== undefined && workspaceContext.sceneId !== null && workspaceContext.sceneId !== ""
		? String(workspaceContext.sceneId)
		: "";

	const [characters, npcs, locations, session, customBestiaryRaw] = await Promise.all([
		storage.listEntities(campaignSlug, "characters").catch(() => []),
		storage.listEntities(campaignSlug, "npc").catch(() => []),
		storage.listEntities(campaignSlug, "locations").catch(() => []),
		sessionFileName
			? storage.readSession(campaignSlug, sessionFileName).catch(() => null)
			: Promise.resolve(null),
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
	const currentEncounter = encounterId ? encounters.find((e) => String(e?.id ?? "") === encounterId) || null : null;

	const viewType = encounterId
		? "encounter"
		: workspaceContext.viewType || (session ? "session" : "campaign");

	const contextPayload = {
		workspace: {
			viewType,
			campaignSlug,
			campaignName: campaign?.name || campaignSlug,
			...(sessionFileName ? { sessionFileName, sessionName: session?.name || sessionFileName } : {}),
			...(currentEncounter ? { encounterId, encounterName: currentEncounter.name || "" } : encounterId ? { encounterId } : {}),
			...(currentScene ? { sceneId, sceneTitle: currentScene.name || currentScene.title || "" } : sceneId ? { sceneId } : {}),
			...(workspaceContext.activeSection ? { activeSection: String(workspaceContext.activeSection) } : {}),
		},
		campaign: {
			name: campaign?.name || campaignSlug,
			description: campaign?.description || "",
			notes: Array.isArray(campaign?.notes)
				? campaign.notes.filter((note) => !note?._aiIgnored)
				: [],
		},
	};

	const includeCharacters =
		contextSettings.includeCampaignNpc !== false ||
		viewType === "encounter" ||
		commands.includes("encounter");

	if (includeCharacters) {
		contextPayload.campaign.characters = visibleCharacters;
	}
	if (contextSettings.includeCampaignNpc !== false) {
		contextPayload.campaign.npcs = visibleNpcs;
	}
	if (contextSettings.includeCampaignLocations !== false) {
		contextPayload.campaign.locations = visibleLocations;
	}

	if (session && filteredSessionData && contextSettings.includeCurrentScene !== false) {
		contextPayload.currentSession = {
			fileName: sessionFileName,
			name: session.name,
			data: filteredSessionData,
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
		const allSessions = await storage.listSessions(campaignSlug).catch(() => []);
		const recentMeta = allSessions
			.filter((s) => s.fileName !== sessionFileName)
			.slice(-3)
			.reverse();
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
		contextPayload.customBestiary = {
			monsterNames: customMonsters.map((m) => m?.name).filter(Boolean),
			...(commands.includes("bestiary") || contextSettings.includeBestiary
				? { monsters: customMonsters.slice(0, 25).map(compactMonsterForContext) }
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
	commands = [],
	workspaceViewType = "campaign",
	needsTitle = false,
	globalBasePrompt = "",
	campaignBasePrompt = "",
	simplifiedNotes = false,
}) {
	const langLabel = String(responseLanguage).toLowerCase().startsWith("en")
		? "English"
		: "Ukrainian";
	const toneText = TONE_GUIDANCE[responseTone] || TONE_GUIDANCE.narrative;
	const commandHints = commands
		.map((cmd) => COMMAND_INSTRUCTIONS[cmd])
		.filter(Boolean);

	const parts = [
		"You are an expert Dungeons & Dragons 5e / 5.5e (2024) AI Assistant integrated inside the PRM Campaign Manager.",
		`CRITICAL: Always write your natural-language "reply", action "title", "subtitle", "description", and any new game content in ${langLabel}. Keep D&D 5eTools lookup tags ({@spell ...}, {@condition ...}, {@damage ...}) and official English monster names in English.`,
		`Tone guidance: ${toneText}`,
		`Current workspace view: "${workspaceViewType}".${simplifiedNotes ? " Note: simplified notes mode is enabled (omit redundant note titles unless essential)." : ""}`,
		globalBasePrompt ? `Global DM Instructions: ${globalBasePrompt}` : "",
		campaignBasePrompt ? `Campaign DM Instructions: ${campaignBasePrompt}` : "",
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
2. When a current session is active, always specify "scope": "campaign" or "scope": "session" on npc/location operations.
3. For "encounter" updates, patch { "name": "...", "monsters": [{ "monsterName": "Official English Name or Custom Monster Name", "name": "Optional label" }] }.
4. Omit "scope" for "monster" (custom bestiary) and "encounter-creature" operations.
5. For "monster" creation, populate full 5eTools JSON inside "data" (name, source: "CUSTOM", size: ["M"], type, alignment, ac: [{ "ac": 13, "from": ["natural armor"] }], hp: { "average": 45, "formula": "6d8 + 18" }, speed: { "walk": 30 }, str, dex, con, int, wis, cha, save, skill, senses, languages, cr, trait, action, bonus, reaction, legendary, spellcasting). If creating a new custom creature based on an official or referenced creature in "mentionedEntities", emit { "op": "create", "entity": "monster", "data": { ...adapted full 5eTools JSON with "source": "CUSTOM"... } } without modifying the original official creature. For updating an existing custom monster, use { "op": "update", "entity": "monster", "id": "EXACT_MONSTER_ID", "patch": { ...changedFieldsOnly... } } — never duplicate unchanged fields.
6. Do not split a cohesive multi-op creation (e.g., creating an NPC + moving/linking it) into disconnected cards that depend on each other's temp clientId — keep dependent ops inside one action card.`,
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

	const sliced = recentMessages.slice(-MAX_RECENT_CHAT_MESSAGES);
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
 * Compacts older chat turns into a rolling summary when the unsummarized window grows too large.
 */
async function compactChatHistoryIfNeeded(
	{ geminiGateway },
	{ chat, modelName, responseLanguage = "uk" },
) {
	const messages = Array.isArray(chat?.messages) ? chat.messages : [];
	const currentSummarized = Math.max(0, Number(chat?.summarizedMessageCount) || 0);
	const unsummarizedCount = messages.length - currentSummarized;

	if (unsummarizedCount < SUMMARY_TRIGGER_UNSUMMARIZED || messages.length <= SUMMARY_KEEP_RECENT) {
		return {
			summary: String(chat?.summary || ""),
			summarizedMessageCount: currentSummarized,
		};
	}

	const nextSummarizedCount = messages.length - SUMMARY_KEEP_RECENT;
	if (nextSummarizedCount <= currentSummarized) {
		return {
			summary: String(chat?.summary || ""),
			summarizedMessageCount: currentSummarized,
		};
	}

	const sliceToCompact = messages.slice(currentSummarized, nextSummarizedCount);
	const targetLang = String(responseLanguage).toLowerCase().startsWith("en") ? "English" : "Ukrainian";

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
		};
	} catch {
		return {
			summary: buildFallbackDigest(chat?.summary, sliceToCompact),
			summarizedMessageCount: nextSummarizedCount,
		};
	}
}

module.exports = {
	MAX_RECENT_CHAT_MESSAGES,
	SUMMARY_TRIGGER_UNSUMMARIZED,
	SUMMARY_KEEP_RECENT,
	estimateTokensFromText,
	buildChatWorkspaceContext,
	buildChatSystemInstruction,
	buildChatTurnPrompt,
	compactChatHistoryIfNeeded,
};
