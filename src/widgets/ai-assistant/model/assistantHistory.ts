import {
	buildAiHistoryRestorePlan,
	buildDiffResources,
	isAiResponseVisibleForRoute,
	type AiHistoryEntry,
	type AiHistoryRestoreResult,
	type DiffResource,
} from "../../../features/ai/index.js";

export interface AiAssistantHistoryRoute {
	campaign?: string;
	session?: string | null;
	encounter?: string | number | null;
}

export interface AiAssistantHistoryLabels {
	note: string;
	scene: string;
	encounter: string;
	creature: string;
}

export interface AiAssistantHistoryView {
	visibleEntries: AiHistoryEntry[];
	diffResources: DiffResource[];
	hasChanges: boolean;
}

export interface AiHistoryConfirmationCopy {
	title: string;
	message: string;
}

export type AiAssistantHistoryRestorePlan = ReturnType<
	typeof buildAiHistoryRestorePlan
>;

export interface AiAssistantHistoryRestoreEffects {
	onApplyUpdatedData(
		updated: AiHistoryRestoreResult["updated"],
		options: {
			entityTypes: string[];
			historyEntry: AiHistoryEntry;
			trackUndo: false;
		},
	): void;
	onHistoryChanged(): void;
	onHistoryReplace(responses: AiHistoryEntry[]): void;
	onHistoryUpsert(entry: AiHistoryEntry): void;
	onRequestReload(entityTypes: string[]): void;
	onSelectionUpdate(entry: AiHistoryEntry): void;
}

type Translate = (phrase: string) => string;

function executeAiAssistantHistoryUpdate(
	update: AiAssistantHistoryRestorePlan["historyUpdate"],
	effects: AiAssistantHistoryRestoreEffects,
): void {
	if (!update) return;
	if (update.type === "replace") {
		effects.onHistoryReplace(update.responses);
	} else {
		effects.onHistoryUpsert(update.entry);
	}
	effects.onHistoryChanged();
}

export function executeAiAssistantHistoryRestorePlan(
	plan: AiAssistantHistoryRestorePlan,
	effects: AiAssistantHistoryRestoreEffects,
): void {
	executeAiAssistantHistoryUpdate(plan.historyUpdate, effects);
	if (plan.updateSelection) effects.onSelectionUpdate(plan.nextEntry);
	if (plan.applyDirectly) {
		effects.onApplyUpdatedData(plan.updated, {
			entityTypes: plan.entityTypes,
			historyEntry: plan.nextEntry,
			trackUndo: false,
		});
	}
	if (plan.requestReload) effects.onRequestReload(plan.entityTypes);
}

export function getAiHistoryDeleteConfirmation(
	kind: "entry" | "all",
	translate: Translate,
): AiHistoryConfirmationCopy {
	return kind === "entry"
		? {
				title: translate("Delete response"),
				message: translate("Delete this AI response?"),
			}
		: {
				title: translate("Clear response history"),
				message: translate("Delete all saved AI responses?"),
			};
}

export function getAiHistoryRestoreConfirmation(
	mode: { isUndo: boolean; isPartial: boolean },
	translate: Translate,
): AiHistoryConfirmationCopy {
	if (mode.isUndo) {
		return mode.isPartial
			? {
					title: translate("Undo selected AI change"),
					message: translate(
						"Undo only this AI change? Newer edits in this resource may be overwritten.",
					),
				}
			: {
					title: translate("Undo AI changes"),
					message: translate(
						"Restore data to the state before this AI response? Newer edits in these resources may be overwritten.",
					),
				};
	}
	return mode.isPartial
		? {
				title: translate("Apply selected AI change"),
				message: translate(
					"Apply only this AI change? Newer edits in this resource may be overwritten.",
				),
			}
		: {
				title: translate("Apply AI changes"),
				message: translate(
					"Restore data to the state after this AI response? Newer edits in these resources may be overwritten.",
				),
			};
}

export function getAiAssistantHistoryView({
	entries,
	selectedEntry,
	route,
	isBestiary,
	labels,
}: {
	entries?: AiHistoryEntry[] | null;
	selectedEntry?: AiHistoryEntry | null;
	route?: AiAssistantHistoryRoute;
	isBestiary: boolean;
	labels: AiAssistantHistoryLabels;
}): AiAssistantHistoryView {
	const diffResources = buildDiffResources(selectedEntry, labels);
	return {
		visibleEntries: (Array.isArray(entries) ? entries : []).filter((entry) =>
			isAiResponseVisibleForRoute(entry, route, { isBestiary }),
		),
		diffResources,
		hasChanges: diffResources.length > 0,
	};
}

export function getAiHistoryErrorMessage(error: unknown, fallback: string): string {
	return error instanceof Error && error.message ? error.message : fallback;
}
