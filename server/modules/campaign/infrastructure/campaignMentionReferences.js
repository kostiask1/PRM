function normalizeMentionName(value) {
	return String(value || "")
		.trim()
		.replace(/\s+/g, " ")
		.toLowerCase();
}

function getMentionDisplayName(value) {
	return String(value || "")
		.trim()
		.replace(/\s+/g, " ");
}

function replaceBracketedMentionNames(value, oldName, newName) {
	if (typeof value !== "string") return value;
	const normalizedOldName = normalizeMentionName(oldName);
	const nextName = getMentionDisplayName(newName);
	if (!normalizedOldName || !nextName) return value;

	return value.replace(/\[([^[\]]+)\]/g, (fullMatch, rawName) => {
		if (normalizeMentionName(rawName) !== normalizedOldName) return fullMatch;
		return `[${nextName}]`;
	});
}

function replaceMentionsInArray(value, oldName, newName) {
	return value.map((item) => replaceMentionsInValue(item, oldName, newName));
}

function replaceMentionsInObject(value, oldName, newName) {
	return Object.fromEntries(
		Object.entries(value).map(([key, item]) => [
			key,
			replaceMentionsInValue(item, oldName, newName),
		]),
	);
}

function replaceMentionsInNonStringValue(value, oldName, newName) {
	if (Array.isArray(value)) {
		return replaceMentionsInArray(value, oldName, newName);
	}
	if (!value) return value;
	if (typeof value === "object") {
		return replaceMentionsInObject(value, oldName, newName);
	}
	return value;
}

function replaceMentionsInValue(value, oldName, newName) {
	if (typeof value === "string") {
		return replaceBracketedMentionNames(value, oldName, newName);
	}
	return replaceMentionsInNonStringValue(value, oldName, newName);
}

function shouldSkipMentionReferenceUpdate(oldName, newName) {
	if (!normalizeMentionName(oldName)) return true;
	if (!String(newName || "").trim()) return true;
	return normalizeMentionName(oldName) === normalizeMentionName(newName);
}

function hasMentionReferenceChanges(currentValue, nextValue) {
	const nextSerialized = JSON.stringify(nextValue);
	const currentSerialized = JSON.stringify(currentValue);
	return nextSerialized !== currentSerialized;
}

async function updateJsonMentionReferences({
	currentValue,
	oldName,
	newName,
	write,
}) {
	const nextValue = replaceMentionsInValue(currentValue, oldName, newName);
	if (!hasMentionReferenceChanges(currentValue, nextValue)) return;
	await write(nextValue);
}

async function updateCampaignMetaMentionReferences({
	campaignSlug,
	oldName,
	newName,
	campaignMetaPath,
	exists,
	readJson,
	writeJson,
}) {
	const metaPath = campaignMetaPath(campaignSlug);
	if (!(await exists(metaPath))) return;
	const meta = await readJson(metaPath);
	await updateJsonMentionReferences({
		currentValue: meta,
		oldName,
		newName,
		write: (nextMeta) => writeJson(metaPath, nextMeta),
	});
}

async function updateCampaignEntityMentionReferences({
	campaignSlug,
	type,
	oldName,
	newName,
	listEntities,
	writeEntity,
}) {
	const entities = await listEntities(campaignSlug, type);
	for (const entity of entities) {
		await updateJsonMentionReferences({
			currentValue: entity,
			oldName,
			newName,
			write: (nextEntity) =>
				writeEntity(campaignSlug, type, entity.slug, nextEntity),
		});
	}
}

async function updateCampaignEntitiesMentionReferences({
	campaignSlug,
	oldName,
	newName,
	entityTypes,
	listEntities,
	writeEntity,
}) {
	for (const type of entityTypes) {
		await updateCampaignEntityMentionReferences({
			campaignSlug,
			type,
			oldName,
			newName,
			listEntities,
			writeEntity,
		});
	}
}

async function updateCampaignSessionMentionReferences({
	campaignSlug,
	session,
	oldName,
	newName,
	sessionPath,
	readJson,
	writeJson,
}) {
	const filePath = sessionPath(campaignSlug, session.fileName);
	const sessionData = await readJson(filePath);
	await updateJsonMentionReferences({
		currentValue: sessionData,
		oldName,
		newName,
		write: (nextSessionData) => writeJson(filePath, nextSessionData),
	});
}

async function updateCampaignSessionsMentionReferences({
	campaignSlug,
	oldName,
	newName,
	listSessions,
	sessionPath,
	readJson,
	writeJson,
}) {
	const sessions = await listSessions(campaignSlug);
	for (const session of sessions) {
		await updateCampaignSessionMentionReferences({
			campaignSlug,
			session,
			oldName,
			newName,
			sessionPath,
			readJson,
			writeJson,
		});
	}
}

function createCampaignMentionReferenceUpdater({
	entityTypes,
	campaignMetaPath,
	exists,
	readJson,
	writeJson,
	listEntities,
	writeEntity,
	listSessions,
	sessionPath,
}) {
	return async function updateCampaignMentionReferences(
		campaignSlug,
		oldName,
		newName,
	) {
		if (shouldSkipMentionReferenceUpdate(oldName, newName)) return;

		await updateCampaignMetaMentionReferences({
			campaignSlug,
			oldName,
			newName,
			campaignMetaPath,
			exists,
			readJson,
			writeJson,
		});
		await updateCampaignEntitiesMentionReferences({
			campaignSlug,
			oldName,
			newName,
			entityTypes,
			listEntities,
			writeEntity,
		});
		await updateCampaignSessionsMentionReferences({
			campaignSlug,
			oldName,
			newName,
			listSessions,
			sessionPath,
			readJson,
			writeJson,
		});
	};
}

module.exports = {
	createCampaignMentionReferenceUpdater,
	normalizeMentionName,
	replaceBracketedMentionNames,
	replaceMentionsInValue,
};
