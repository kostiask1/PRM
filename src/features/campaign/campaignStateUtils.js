import { sanitizeNotesForSave } from "../../utils/noteUtils.js";

export const sanitizeEntityForSave = (entity) =>
	Object.fromEntries(
		Object.entries(entity || {}).filter(([key]) => !key.startsWith("_")),
	);

export const sanitizeLoadedEntity = (entity) => sanitizeEntityForSave(entity);

export const normalizeMentionName = (value) =>
	String(value || "")
		.trim()
		.replace(/\s+/g, " ")
		.toLowerCase();

export const replaceBracketedMentionNames = (value, oldName, newName) => {
	if (typeof value !== "string") return value;
	const normalizedOldName = normalizeMentionName(oldName);
	const nextName = String(newName || "")
		.trim()
		.replace(/\s+/g, " ");
	if (!normalizedOldName || !nextName) return value;

	return value.replace(/\[([^[\]]+)\]/g, (fullMatch, rawName) => {
		if (normalizeMentionName(rawName) !== normalizedOldName) return fullMatch;
		return `[${nextName}]`;
	});
};

export const replaceMentionsInValue = (value, oldName, newName) => {
	if (typeof value === "string") {
		return replaceBracketedMentionNames(value, oldName, newName);
	}
	if (Array.isArray(value)) {
		return value.map((item) => replaceMentionsInValue(item, oldName, newName));
	}
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([key, item]) => [
				key,
				replaceMentionsInValue(item, oldName, newName),
			]),
		);
	}
	return value;
};

export const getCharacterDisplayName = (entity) =>
	`${entity?.firstName || ""} ${entity?.lastName || ""}`.trim() ||
	String(entity?.name || entity?.title || "").trim();

export const getLocationDisplayName = (entity) =>
	String(entity?.name || entity?.title || "").trim();

export const cloneHistoryList = (items) =>
	JSON.parse(JSON.stringify((items || []).map(sanitizeLoadedEntity)));

export const areHistoryStatesEqual = (left, right) =>
	JSON.stringify(left) === JSON.stringify(right);

export const campaignHistoryPayload = (state) => ({
	description: state.description || "",
	notes: sanitizeNotesForSave(state.notes || []),
	completed: Boolean(state.completed),
	completedAt: state.completedAt || null,
});
