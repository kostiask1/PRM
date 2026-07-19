import {
	buildDiffResources,
	isAiResponseVisibleForRoute,
	type AiHistoryEntry,
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

type Translate = (phrase: string) => string;

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
