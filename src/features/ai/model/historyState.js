import { getHistoryChangedEntityTypes } from "./historyWorkflow.js";

export function upsertAiHistoryEntry(history, entry) {
	if (!entry?.id) return Array.isArray(history) ? history : [];
	return [
		entry,
		...(Array.isArray(history) ? history : []).filter(
			(item) => item?.id !== entry.id,
		),
	];
}

export function getAiHistoryCampaign(entry, fallbackCampaign) {
	return entry?.path?.campaign || fallbackCampaign;
}

export function getAiHistoryRestoreMode(mode, resourceIds) {
	const isUndo = mode === "undo";
	const isPartial = Array.isArray(resourceIds) && resourceIds.length > 0;
	return {
		isUndo,
		isPartial,
		operation: isUndo ? "undo" : "apply",
	};
}

export function canApplyRestoredAiDataDirectly({
	updated,
	entryPath = {},
	currentRoute = {},
	isBestiary = false,
	isCampaign = false,
}) {
	if (!updated || typeof updated !== "object") return false;
	const updatedIsSessionLike = Boolean(
		updated.data && typeof updated.data === "object",
	);
	const isSameCampaign = entryPath.campaign === currentRoute.campaign;

	return (
		(isBestiary && Array.isArray(updated.monsters)) ||
		(isCampaign &&
			isSameCampaign &&
			!entryPath.session &&
			!updatedIsSessionLike) ||
		(!isCampaign &&
			isSameCampaign &&
			entryPath.session === currentRoute.session &&
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
}) {
	const nextEntry = result?.response || fallbackEntry;
	let historyUpdate = null;
	if (Array.isArray(result?.responses)) {
		historyUpdate = { type: "replace", responses: result.responses };
	} else if (result?.response) {
		historyUpdate = { type: "upsert", entry: result.response };
	}

	const updated = result?.updated;
	const applyDirectly = canApplyRestoredAiDataDirectly({
		updated,
		entryPath: nextEntry?.path || {},
		currentRoute,
		isBestiary,
		isCampaign,
	});

	return {
		nextEntry,
		historyUpdate,
		updateSelection: Boolean(
			nextEntry?.id && nextEntry.id === selectedResponseId,
		),
		updated,
		applyDirectly,
		entityTypes: getHistoryChangedEntityTypes(nextEntry),
		requestReload: !applyDirectly,
	};
}
