import { sanitizeNotesForSave } from "../../shared/lib/index.js";
import type { SharedNote } from "../../shared/lib/index.js";

export interface CampaignStateEntity extends Record<string, unknown> {
	notes?: SharedNote[];
	name?: string;
	title?: string;
}

export interface CampaignHistoryState extends Record<string, unknown> {
	description?: unknown;
	notes?: SharedNote[];
	completed?: unknown;
	completedAt?: unknown;
}

export const sanitizeEntityForSave = <T extends CampaignStateEntity>(
	entity: T,
): T => {
	const sanitized = Object.fromEntries(
		Object.entries(entity || {}).filter(
			([key]) => !key.startsWith("_") || key === "_aiIgnored",
		),
	);
	if (Array.isArray(sanitized.notes)) {
		sanitized.notes = sanitizeNotesForSave(sanitized.notes);
	}
	return sanitized as T;
};

export const sanitizeLoadedEntity = <T extends CampaignStateEntity>(
	entity: T | null | undefined,
): T => sanitizeEntityForSave((entity || {}) as T);

export const normalizeMentionName = (value: unknown): string =>
	String(value || "")
		.trim()
		.replace(/\s+/g, " ")
		.toLowerCase();

export const replaceBracketedMentionNames = (
	value: unknown,
	oldName: unknown,
	newName: unknown,
): unknown => {
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

export const replaceMentionsInValue = <T>(
	value: T,
	oldName: unknown,
	newName: unknown,
): T => {
	if (typeof value === "string") {
		return replaceBracketedMentionNames(value, oldName, newName) as T;
	}
	if (Array.isArray(value)) {
		return value.map((item) => replaceMentionsInValue(item, oldName, newName)) as T;
	}
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([key, item]) => [
				key,
				replaceMentionsInValue(item, oldName, newName),
			]),
		) as T;
	}
	return value;
};

export const getLocationDisplayName = (
	entity: CampaignStateEntity | null | undefined,
): string =>
	String(entity?.name || entity?.title || "").trim();

export const cloneHistoryList = <T extends CampaignStateEntity>(
	items: T[] = [],
): T[] =>
	JSON.parse(
		JSON.stringify(items.map((item) => sanitizeLoadedEntity(item))),
	) as T[];

export const areHistoryStatesEqual = (left: unknown, right: unknown): boolean =>
	JSON.stringify(left) === JSON.stringify(right);

export const campaignHistoryPayload = (state: CampaignHistoryState) => ({
	description: state.description || "",
	notes: sanitizeNotesForSave(state.notes || []),
	completed: Boolean(state.completed),
	completedAt: state.completedAt || null,
});
