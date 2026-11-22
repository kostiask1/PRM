const DESTRUCTIVE_OPS = new Set(["delete", "deletenote"]);
const MAX_PREVIEW_CHARS = 6000;

function isObject(value) {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asText(value) {
	return String(value ?? "").trim();
}

/**
 * Checks whether any operation in a card deletes entities or notes.
 */
function isDestructiveOperationList(operations) {
	if (!Array.isArray(operations)) return false;
	return operations.some((op) => DESTRUCTIVE_OPS.has(asText(op?.op).toLowerCase()));
}

function truncatePreviewText(text) {
	const value = String(text || "");
	if (value.length <= MAX_PREVIEW_CHARS) return value;
	return `${value.slice(0, MAX_PREVIEW_CHARS)}\n... (скорочено)`;
}

function serializePreviewObject(value) {
	if (value === null || value === undefined) return "—";
	if (typeof value === "string") return value || "—";
	return JSON.stringify(value, null, 2);
}

function projectSessionDiffFields(beforeSession = {}, afterSession = {}) {
	const beforeObj = isObject(beforeSession) ? beforeSession : {};
	const afterObj = isObject(afterSession) ? afterSession : {};
	const beforeData = isObject(beforeObj.data) ? beforeObj.data : {};
	const afterData = isObject(afterObj.data) ? afterObj.data : {};
	const beforeOut = {};
	const afterOut = {};

	if (beforeObj.name !== afterObj.name) {
		beforeOut.name = beforeObj.name ?? "";
		afterOut.name = afterObj.name ?? "";
	}

	for (const key of ["notes", "scenes", "npcs", "locations", "encounters"]) {
		const prevVal = beforeData[key] ?? [];
		const nextVal = afterData[key] ?? [];
		if (JSON.stringify(prevVal) === JSON.stringify(nextVal)) continue;

		if (Array.isArray(prevVal) && Array.isArray(nextVal)) {
			const prevMap = new Map(prevVal.map((item, idx) => [String(item?.id ?? idx), item]));
			const nextMap = new Map(nextVal.map((item, idx) => [String(item?.id ?? idx), item]));
			const changedPrev = [];
			const changedNext = [];
			for (const id of new Set([...prevMap.keys(), ...nextMap.keys()])) {
				const p = prevMap.get(id);
				const n = nextMap.get(id);
				if (JSON.stringify(p ?? null) !== JSON.stringify(n ?? null)) {
					if (p !== undefined) changedPrev.push(p);
					if (n !== undefined) changedNext.push(n);
				}
			}
			if (changedPrev.length > 0 || changedNext.length > 0) {
				beforeOut[key] = changedPrev;
				afterOut[key] = changedNext;
			}
		} else {
			beforeOut[key] = prevVal;
			afterOut[key] = nextVal;
		}
	}

	return { before: beforeOut, after: afterOut };
}

function projectObjectChangedFields(beforeVal, afterVal) {
	if (!isObject(beforeVal) || !isObject(afterVal)) {
		return { before: beforeVal, after: afterVal };
	}
	const beforeOut = {};
	const afterOut = {};
	for (const key of new Set([...Object.keys(beforeVal), ...Object.keys(afterVal)])) {
		if (key.startsWith("_")) continue;
		if (JSON.stringify(beforeVal[key] ?? null) !== JSON.stringify(afterVal[key] ?? null)) {
			if (beforeVal[key] !== undefined) beforeOut[key] = beforeVal[key];
			if (afterVal[key] !== undefined) afterOut[key] = afterVal[key];
		}
	}
	return { before: beforeOut, after: afterOut };
}

function formatSingleResourceDiff(resource) {
	if (resource.kind === "session") {
		if (!resource.before || !resource.after) {
			return { before: resource.before, after: resource.after };
		}
		return projectSessionDiffFields(resource.before, resource.after);
	}
	return projectObjectChangedFields(resource.before, resource.after);
}

function countCollectionChanges(prevArr = [], nextArr = [], singularLabel, pluralLabel, stats) {
	const prev = Array.isArray(prevArr) ? prevArr : [];
	const next = Array.isArray(nextArr) ? nextArr : [];
	if (JSON.stringify(prev) === JSON.stringify(next)) return;

	const prevIds = new Set(prev.map((item) => String(item?.id ?? JSON.stringify(item))));
	const nextIds = new Set(next.map((item) => String(item?.id ?? JSON.stringify(item))));

	let added = 0;
	let removed = 0;
	let modified = 0;

	for (const item of next) {
		const key = String(item?.id ?? JSON.stringify(item));
		if (!prevIds.has(key)) {
			added += 1;
		} else {
			const prevItem = prev.find((p) => String(p?.id ?? JSON.stringify(p)) === key);
			if (JSON.stringify(prevItem) !== JSON.stringify(item)) modified += 1;
		}
	}
	for (const key of prevIds) {
		if (!nextIds.has(key)) removed += 1;
	}

	if (added > 0) stats.push({ label: pluralLabel, value: `+${added} ${added === 1 ? singularLabel : pluralLabel}`, type: "added" });
	if (modified > 0) stats.push({ label: pluralLabel, value: `~${modified} ${modified === 1 ? singularLabel : pluralLabel}`, type: "changed" });
	if (removed > 0) stats.push({ label: pluralLabel, value: `-${removed} ${removed === 1 ? singularLabel : pluralLabel}`, type: "info" });
}

function collectEntityStat(resource, stats) {
	const typeLabels = {
		characters: "Персонаж",
		npc: "NPC",
		locations: "Локація",
	};
	const label = typeLabels[resource.type] || "Сутність";
	if (resource.before === null || resource.before === undefined) {
		stats.push({ label, value: `+1 ${label}`, type: "added" });
	} else if (resource.after === null || resource.after === undefined) {
		stats.push({ label, value: `-1 ${label}`, type: "info" });
	} else {
		stats.push({ label, value: `~1 ${label}`, type: "changed" });
	}
}

function collectResourceStats(resource, stats) {
	if (resource.kind === "entity") {
		collectEntityStat(resource, stats);
		return;
	}
	if (resource.kind === "custom-monster" || resource.kind === "custom-bestiary") {
		const isNew = resource.before === null || resource.before === undefined;
		const isDeleted = resource.after === null || resource.after === undefined;
		stats.push({
			label: "Монстр",
			value: isNew ? "+1 монстр" : isDeleted ? "-1 монстр" : "~1 монстр",
			type: isNew ? "added" : isDeleted ? "info" : "changed",
		});
		return;
	}
	if (resource.kind === "campaign") {
		const prevDesc = String(resource.before?.description || "").trim();
		const nextDesc = String(resource.after?.description || "").trim();
		if (prevDesc !== nextDesc) {
			const wordsDelta = nextDesc.split(/\s+/).filter(Boolean).length - prevDesc.split(/\s+/).filter(Boolean).length;
			stats.push({
				label: "Опис",
				value: wordsDelta >= 0 ? `+${wordsDelta} слів` : `${wordsDelta} слів`,
				type: "changed",
			});
		}
		countCollectionChanges(resource.before?.notes, resource.after?.notes, "нотатка", "нотатки", stats);
		return;
	}
	if (resource.kind === "session") {
		const bData = resource.before?.data || {};
		const aData = resource.after?.data || {};
		countCollectionChanges(bData.scenes, aData.scenes, "сцена", "сцени", stats);
		countCollectionChanges(bData.notes, aData.notes, "нотатка", "нотатки", stats);
		countCollectionChanges(bData.npcs, aData.npcs, "NPC (сесія)", "NPC (сесія)", stats);
		countCollectionChanges(bData.locations, aData.locations, "локація (сесія)", "локації (сесія)", stats);
		countCollectionChanges(bData.encounters, aData.encounters, "бій", "бої", stats);
	}
}

/**
 * Formats diff resources into concise readable before/after previews and badge stats.
 */
function formatDiffResourcesForPreview(resources = []) {
	const safeResources = Array.isArray(resources) ? resources : [];
	const stats = [];
	const beforeSections = [];
	const afterSections = [];

	for (const resource of safeResources) {
		collectResourceStats(resource, stats);
		const projected = formatSingleResourceDiff(resource);
		const header = resource.label || resource.name || resource.id || resource.kind;
		beforeSections.push(`[${header}]\n${serializePreviewObject(projected.before)}`);
		afterSections.push(`[${header}]\n${serializePreviewObject(projected.after)}`);
	}

	return {
		stats: stats.slice(0, 6),
		diffSnippet: {
			before: truncatePreviewText(beforeSections.join("\n\n")),
			after: truncatePreviewText(afterSections.join("\n\n")),
		},
	};
}

function extractChangedEntityTypes(resources = []) {
	const types = new Set();
	for (const resource of Array.isArray(resources) ? resources : []) {
		if (resource?.kind === "entity" && resource.type) {
			types.add(resource.type);
		}
	}
	return Array.from(types);
}

function buildActionHistoryPath(campaignSlug, sessionFileName, encounterId) {
	return {
		campaign: campaignSlug,
		...(sessionFileName ? { session: sessionFileName } : {}),
		...(encounterId !== undefined && encounterId !== null && encounterId !== ""
			? { encounter: encounterId }
			: {}),
	};
}

function buildActionHistoryContext({
	payload,
	responsePath,
	modelName,
	language,
	title,
	sceneId,
	simplifiedNotes,
	historyWriter,
}) {
	const requestSnapshot = historyWriter.buildRequestSnapshot({
		type: "campaign",
		modelName,
		userInstructions: title,
		path: responsePath,
		sceneId,
		parseAIResponse: true,
		shouldParseAIResponse: true,
		generateCharacters: true,
		generateNpcs: true,
		generateLocations: true,
		generateEncounters: true,
		generateCustomMonsters: true,
		editEncounterCreatures: Boolean(responsePath.encounter),
		entityScope: responsePath.session ? "mixed" : "campaign",
		language,
		simplifiedNotes,
	});
	return {
		payload,
		path: responsePath,
		type: "campaign",
		modelName,
		responseLanguage: language,
		historyUserInstructions: title,
		requestSnapshot,
	};
}

function buildGeneratedOperationPayload({
	operations,
	responsePath,
	sceneId,
	mentionCandidateNames,
	fillCurrentTargetIds,
	applyMentionsToGeneratedContent,
}) {
	const payload = {
		version: 2,
		operations: JSON.parse(JSON.stringify(operations)),
	};
	fillCurrentTargetIds(payload, {
		path: responsePath,
		sceneId,
		customMonsterTarget: null,
	});
	if (Array.isArray(mentionCandidateNames) && mentionCandidateNames.length > 0) {
		applyMentionsToGeneratedContent(payload, mentionCandidateNames);
	}
	return payload;
}

const FULL_PERMISSIONS = Object.freeze({
	allowCharacters: true,
	allowNpcs: true,
	allowLocations: true,
	allowEncounters: true,
	allowCustomMonsters: true,
	allowEncounterCreatureEditing: true,
});

/**
 * Simulates pending action cards in draft mode or applies non-destructive cards when autoApply is enabled.
 */
async function prepareChatActionCards(
	{
		storage,
		applyAiOperations,
		historyWriter,
		buildCustomMonsterChangeResources,
		fillCurrentTargetIds,
		applyMentionsToGeneratedContent,
		validateAiGeneratedContent,
		createId = storage.createId,
	},
	{
		rawActions = [],
		campaignSlug,
		sessionFileName = "",
		encounterId = null,
		sceneId = null,
		modelName = "",
		language = "uk",
		simplifiedNotes = false,
		autoApply = false,
		mutationPermission = "diff_only",
		mentionCandidateNames = [],
	},
) {
	const responsePath = buildActionHistoryPath(campaignSlug, sessionFileName, encounterId);
	const actionCards = [];
	const appliedActionIds = [];
	const changedEntityTypesSet = new Set();
	let lastUpdated = null;

	for (const raw of Array.isArray(rawActions) ? rawActions : []) {
		if (!isObject(raw) || !Array.isArray(raw.operations) || raw.operations.length === 0) {
			continue;
		}
		const generatedPayload = buildGeneratedOperationPayload({
			operations: raw.operations,
			responsePath,
			sceneId,
			mentionCandidateNames,
			fillCurrentTargetIds,
			applyMentionsToGeneratedContent,
		});
		const validation = validateAiGeneratedContent(generatedPayload, {
			type: "campaign",
			requireExplicitEntityScope: false,
		});
		if (!validation.valid || generatedPayload.operations.length === 0) {
			continue;
		}

		const cardId = `act-${createId()}`;
		const title = asText(raw.title) || "Дія асистента";
		const beforeApplyBundle = await storage.exportCampaignBundle(campaignSlug);
		const applied = await applyAiOperations({
			payload: generatedPayload,
			campaignSlug,
			sessionFile: sessionFileName || null,
			encounterId: encounterId ?? null,
			entityScope: sessionFileName ? "mixed" : "campaign",
			simplifiedNotes: Boolean(simplifiedNotes),
			permissions: FULL_PERMISSIONS,
		});
		const extraChangeResources = applied.customBestiaryChange?.hasChanges
			? buildCustomMonsterChangeResources(
					applied.customBestiaryChange.before,
					applied.customBestiaryChange.after,
				)
			: [];
		const shouldAutoApply =
			(Boolean(autoApply) || mutationPermission === "direct_mutation") &&
			!isDestructiveOperationList(generatedPayload.operations);
		const historyContext = buildActionHistoryContext({
			payload: generatedPayload,
			responsePath,
			modelName,
			language,
			title,
			sceneId,
			simplifiedNotes,
			historyWriter,
		});

		const aiResponse = shouldAutoApply
			? await historyWriter.saveParsed({
					beforeApplyBundle,
					generatedContent: generatedPayload,
					path: responsePath,
					type: "campaign",
					modelName,
					language,
					userInstructions: title,
					requestSnapshot: historyContext.requestSnapshot,
					retryPayload: generatedPayload,
					extraChangeResources,
				})
			: await historyWriter.saveDraftParsed({
					beforeApplyBundle,
					generatedContent: generatedPayload,
					path: responsePath,
					type: "campaign",
					modelName,
					language,
					userInstructions: title,
					requestSnapshot: historyContext.requestSnapshot,
					retryPayload: generatedPayload,
					extraChangeResources,
				});

		const resources = aiResponse?.changes?.resources || [];
		if (resources.length === 0) {
			continue;
		}

		const preview = formatDiffResourcesForPreview(resources);
		const card = {
			id: cardId,
			type: raw.kind === "atomic" ? "atomic" : "diff",
			title,
			...(raw.subtitle ? { subtitle: asText(raw.subtitle) } : {}),
			...(raw.description ? { description: asText(raw.description) } : {}),
			...(raw.targetEntity ? { targetEntity: asText(raw.targetEntity) } : {}),
			...(raw.targetType ? { targetType: asText(raw.targetType) } : {}),
			...(preview.stats.length > 0 ? { stats: preview.stats } : {}),
			status: shouldAutoApply ? "applied" : "pending",
			diffSnippet: preview.diffSnippet,
			diffResources: resources,
			operations: generatedPayload.operations,
			...(aiResponse?.id ? { aiResponseId: String(aiResponse.id) } : {}),
			...(shouldAutoApply ? { appliedAt: Date.now() } : {}),
		};

		actionCards.push(card);
		if (shouldAutoApply) {
			appliedActionIds.push(cardId);
			if (applied.updated) lastUpdated = applied.updated;
			for (const t of extractChangedEntityTypes(resources)) {
				changedEntityTypesSet.add(t);
			}
		}
	}

	return {
		actionCards,
		updated: lastUpdated,
		appliedActionIds,
		changedEntityTypes: Array.from(changedEntityTypesSet),
	};
}

/**
 * Applies a pending or undone chat action card to the live campaign state and records undoable AI history.
 */
async function applyChatActionCard(
	{
		storage,
		applyAiOperations,
		historyWriter,
		buildCustomMonsterChangeResources,
		validateAiGeneratedContent,
		restoreAiResponseSnapshot,
	},
	{
		actionCard,
		campaignSlug,
		sessionFileName = "",
		encounterId = null,
		sceneId = null,
		modelName = "",
		language = "uk",
		simplifiedNotes = false,
		useDraftSnapshot = false,
	},
) {
	if (
		useDraftSnapshot &&
		actionCard?.aiResponseId &&
		typeof restoreAiResponseSnapshot === "function"
	) {
		const responses = await storage.readAiResponses(campaignSlug);
		const entry = (Array.isArray(responses) ? responses : []).find(
			(item) => String(item?.id ?? "") === String(actionCard.aiResponseId),
		);
		if (entry) {
			const restored = await restoreAiResponseSnapshot(entry, "after");
			const resources =
				restored?.response?.changes?.resources ||
				entry?.changes?.resources ||
				[];
			const preview = formatDiffResourcesForPreview(resources);
			const nextCard = {
				...actionCard,
				status: "applied",
				appliedAt: Date.now(),
				...(entry?.id ? { aiResponseId: String(entry.id) } : {}),
				...(preview.stats.length > 0 ? { stats: preview.stats } : {}),
				...(resources.length > 0
					? { diffSnippet: preview.diffSnippet, diffResources: resources }
					: {}),
			};
			return {
				actionCard: nextCard,
				updated: restored?.updated || null,
				aiResponse: restored?.response || entry,
				changedEntityTypes: extractChangedEntityTypes(resources),
			};
		}
	}

	if (!Array.isArray(actionCard?.operations) || actionCard.operations.length === 0) {
		const error = new Error("Action card has no executable operations.");
		error.status = 400;
		throw error;
	}

	const payload = {
		version: 2,
		operations: JSON.parse(JSON.stringify(actionCard.operations)),
	};
	const validation = validateAiGeneratedContent(payload, {
		type: "campaign",
		requireExplicitEntityScope: false,
	});
	if (!validation.valid) {
		const error = new Error("Action operations are invalid.");
		error.status = 400;
		error.details = validation.errors;
		throw error;
	}

	const responsePath = buildActionHistoryPath(campaignSlug, sessionFileName, encounterId);
	const beforeApplyBundle = await storage.exportCampaignBundle(campaignSlug);
	const applied = await applyAiOperations({
		payload,
		campaignSlug,
		sessionFile: sessionFileName || null,
		encounterId: encounterId ?? null,
		entityScope: sessionFileName ? "mixed" : "campaign",
		simplifiedNotes: Boolean(simplifiedNotes),
		permissions: FULL_PERMISSIONS,
	});
	const extraChangeResources = applied.customBestiaryChange?.hasChanges
		? buildCustomMonsterChangeResources(
				applied.customBestiaryChange.before,
				applied.customBestiaryChange.after,
			)
		: [];
	const historyContext = buildActionHistoryContext({
		payload,
		responsePath,
		modelName,
		language,
		title: actionCard.title || "Дія асистента",
		sceneId,
		simplifiedNotes,
		historyWriter,
	});
	const aiResponse = await historyWriter.saveParsed({
		beforeApplyBundle,
		generatedContent: payload,
		path: responsePath,
		type: "campaign",
		modelName,
		language,
		userInstructions: actionCard.title || "Дія асистента",
		requestSnapshot: historyContext.requestSnapshot,
		retryPayload: payload,
		extraChangeResources,
	});
	const resources = aiResponse?.changes?.resources || [];
	const preview = formatDiffResourcesForPreview(resources);
	const nextCard = {
		...actionCard,
		status: "applied",
		appliedAt: Date.now(),
		...(aiResponse?.id ? { aiResponseId: String(aiResponse.id) } : {}),
		...(preview.stats.length > 0 ? { stats: preview.stats } : {}),
		...(resources.length > 0
			? { diffSnippet: preview.diffSnippet, diffResources: resources }
			: {}),
	};

	return {
		actionCard: nextCard,
		updated: applied.updated || null,
		aiResponse,
		changedEntityTypes: extractChangedEntityTypes(resources),
	};
}

/**
 * Undoes a previously applied chat action card via its linked AI history snapshot.
 */
async function undoChatActionCard(
	{ storage, restoreAiResponseSnapshot },
	{ actionCard, campaignSlug },
) {
	const responseId = asText(actionCard?.aiResponseId);
	if (!responseId) {
		const error = new Error("Action card has no linked AI history record to undo.");
		error.status = 400;
		throw error;
	}
	const responses = await storage.readAiResponses(campaignSlug);
	const entry = (Array.isArray(responses) ? responses : []).find(
		(item) => String(item?.id ?? "") === responseId,
	);
	if (!entry) {
		const error = new Error("AI history entry for this action was not found.");
		error.status = 404;
		throw error;
	}
	const restored = await restoreAiResponseSnapshot(entry, "before");
	const nextCard = {
		...actionCard,
		status: "undone",
		appliedAt: null,
	};
	return {
		actionCard: nextCard,
		updated: restored?.updated || null,
		aiResponse: restored?.response || null,
		changedEntityTypes: extractChangedEntityTypes(entry?.changes?.resources),
	};
}

module.exports = {
	isDestructiveOperationList,
	formatDiffResourcesForPreview,
	prepareChatActionCards,
	applyChatActionCard,
	undoChatActionCard,
};
