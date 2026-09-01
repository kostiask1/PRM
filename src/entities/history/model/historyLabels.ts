import { lang } from "../../../shared/lib/index.js";
import type { HistoryTransactionSummary } from "../api/historyApi.ts";

export type HistoryDirection = "undo" | "redo";

function parameterText(value: unknown): string {
	return typeof value === "string" || typeof value === "number"
		? String(value).trim()
		: "";
}

function entityTypeFromPath(path: unknown): string {
	const match = parameterText(path).match(/\/entities\/([^/]+)/);
	let value = match?.[1] || "";
	try {
		value = decodeURIComponent(value);
	} catch {
		// Keep the readable portion of a malformed URL instead of hiding the label.
	}
	if (value === "characters") return lang.t("Character");
	if (value === "npc") return lang.t("NPC");
	if (value === "locations") return lang.t("Location");
	return lang.t("Entity");
}

function operationByMethod(
	method: unknown,
	labels: { create: string; edit: string; remove: string },
): string {
	switch (parameterText(method).toUpperCase()) {
		case "POST":
			return lang.t(labels.create);
		case "DELETE":
			return lang.t(labels.remove);
		default:
			return lang.t(labels.edit);
	}
}

export function formatHistoryOperationLabel(
	transaction: HistoryTransactionSummary,
): string {
	const { operation, params = {} } = transaction;
	const oldName = parameterText(params.oldName);
	const newName = parameterText(params.newName);
	const campaignSlug = parameterText(params.campaignSlug);
	const entityType = entityTypeFromPath(params.path);

	switch (operation) {
		case "campaign.create":
			return newName
				? lang.t("Create campaign “{name}”", { name: newName })
				: lang.t("Create campaign");
		case "campaign.delete":
			return campaignSlug
				? lang.t("Delete campaign “{name}”", { name: campaignSlug })
				: lang.t("Delete campaign");
		case "campaign.rename":
			return newName
				? lang.t("Rename campaign to “{name}”", { name: newName })
				: lang.t("Rename campaign");
		case "campaign.reorder":
			return lang.t("Reorder campaigns");
		case "campaign.post":
		case "campaign.put":
		case "campaign.patch":
			return lang.t("Edit campaign");
		case "entity.rename-global":
			return oldName && newName
				? lang.t("Rename {entityType} “{oldName}” to “{newName}”", {
					entityType,
					oldName,
					newName,
				})
				: lang.t("Rename {entityType}", { entityType });
		case "entity.move":
			return lang.t("Move {entityType}", { entityType });
		case "entity.reorder":
			return lang.t("Reorder {entityType}", { entityType });
		case "entity.post":
		case "entity.put":
		case "entity.patch":
		case "entity.delete":
			return operationByMethod(params.method, {
				create: "Create {entityType}",
				edit: "Edit {entityType}",
				remove: "Delete {entityType}",
			}).replace("{entityType}", entityType);
		case "session.reorder":
			return lang.t("Reorder sessions");
		case "session.post":
		case "session.put":
		case "session.patch":
		case "session.delete":
			return operationByMethod(params.method, {
				create: "Create session",
				edit: "Edit session",
				remove: "Delete session",
			});
		case "encounter.post":
		case "encounter.put":
		case "encounter.patch":
		case "encounter.delete":
			return operationByMethod(params.method, {
				create: "Create encounter",
				edit: "Edit encounter",
				remove: "Delete encounter",
			});
		case "encounter.participant.add":
			return lang.t("Add participant to encounter");
		case "ai.apply":
			return lang.t("Apply AI changes");
		case "ai.undo":
			return lang.t("Undo AI changes");
		default:
			return lang.t("Edit campaign data");
	}
}

export function formatHistoryActionTitle(
	direction: HistoryDirection,
	transaction: HistoryTransactionSummary | null,
): string {
	if (!transaction) {
		return lang.t(direction === "undo" ? "Undo (Ctrl+Z)" : "Redo (Ctrl+Y)");
	}
	return lang.t(
		direction === "undo"
			? "Undo: {operation} (Ctrl+Z)"
			: "Redo: {operation} (Ctrl+Y)",
		{ operation: formatHistoryOperationLabel(transaction) },
	);
}
