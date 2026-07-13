import type {
	AiHistoryEntry,
	AiHistoryId,
	AiHistoryRestoreResult,
} from "../api/aiApi.ts";
import { getHistoryChangedEntityTypes } from "./historyWorkflow.ts";

export type AiHistoryRestoreOperation = "apply" | "undo";

export interface AiHistoryRestoreMode {
	isUndo: boolean;
	isPartial: boolean;
	operation: AiHistoryRestoreOperation;
}

export interface AiRouteLocation {
	campaign?: string;
	session?: string;
}

export function upsertAiHistoryEntry(
	history: AiHistoryEntry[] | null | undefined,
	entry: AiHistoryEntry | null | undefined,
): AiHistoryEntry[] {
	if (!entry?.id) return Array.isArray(history) ? history : [];
	return [
		entry,
		...(Array.isArray(history) ? history : []).filter(
			(item) => item?.id !== entry.id,
		),
	];
}

export function getAiHistoryCampaign(
	entry: AiHistoryEntry | null | undefined,
	fallbackCampaign: string,
): string {
	return entry?.path?.campaign || fallbackCampaign;
}

export function getAiHistoryRestoreMode(
	mode: string,
	resourceIds?: string[],
): AiHistoryRestoreMode {
	const isUndo = mode === "undo";
	return {
		isUndo,
		isPartial: Array.isArray(resourceIds) && resourceIds.length > 0,
		operation: isUndo ? "undo" : "apply",
	};
}

export function canApplyRestoredAiDataDirectly({
	updated,
	entryPath = {},
	currentRoute = {},
	isBestiary = false,
	isCampaign = false,
}: {
	updated?: Record<string, unknown>;
	entryPath?: AiHistoryEntry["path"];
	currentRoute?: AiRouteLocation;
	isBestiary?: boolean;
	isCampaign?: boolean;
}): boolean {
	if (!updated || typeof updated !== "object") return false;
	const data = updated.data;
	const updatedIsSessionLike = Boolean(data && typeof data === "object");
	const isSameCampaign = entryPath?.campaign === currentRoute.campaign;

	return (
		(isBestiary && Array.isArray(updated.monsters)) ||
		(isCampaign &&
			isSameCampaign &&
			!entryPath?.session &&
			!updatedIsSessionLike) ||
		(!isCampaign &&
			isSameCampaign &&
			entryPath?.session === currentRoute.session &&
			updatedIsSessionLike)
	);
}

export function buildAiHistoryRestorePlan({
	result,
	fallbackEntry,
	selectedResponseId,
	currentRoute,
	isBestiary,
	isCampaign,
}: {
	result: AiHistoryRestoreResult;
	fallbackEntry: AiHistoryEntry;
	selectedResponseId?: AiHistoryId | null;
	currentRoute?: AiRouteLocation;
	isBestiary?: boolean;
	isCampaign?: boolean;
}) {
	const nextEntry = result.response || fallbackEntry;
	const historyUpdate = Array.isArray(result.responses)
		? { type: "replace" as const, responses: result.responses }
		: result.response
			? { type: "upsert" as const, entry: result.response }
			: null;
	const updated = result.updated;
	const applyDirectly = canApplyRestoredAiDataDirectly({
		updated,
		entryPath: nextEntry.path,
		currentRoute,
		isBestiary,
		isCampaign,
	});

	return {
		nextEntry,
		historyUpdate,
		updateSelection: Boolean(
			nextEntry.id && nextEntry.id === selectedResponseId,
		),
		updated,
		applyDirectly,
		entityTypes: getHistoryChangedEntityTypes(nextEntry),
		requestReload: !applyDirectly,
	};
}
