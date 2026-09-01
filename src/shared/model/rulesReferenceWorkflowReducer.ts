import {
	RECORD_RULES_REFERENCE_HISTORY_ENTRY,
	REQUEST_RULES_REFERENCE_NAVIGATION,
	SET_RULES_REFERENCE_HISTORY_INDEX,
	SET_RULES_REFERENCE_MODAL_OPEN,
} from "./rulesReferenceActions.ts";
import type { AppAction, AppState } from "./appStoreTypes.ts";
import type { RulesReferenceHistoryEntry } from "./rulesReferenceActions.ts";

function recordRulesReferenceHistoryEntry(
	currentState: AppState,
	nextEntry: RulesReferenceHistoryEntry,
): AppState {
	if (!nextEntry.tabId || !nextEntry.name) return currentState;
	const history = currentState.rulesReference.history;
	const currentEntry = history.entries[history.index];
	if (
		currentEntry?.tabId === nextEntry.tabId &&
		currentEntry?.name === nextEntry.name
	) {
		return currentState;
	}
	const entries = history.entries.slice(0, history.index + 1).concat(nextEntry);
	return {
		...currentState,
		rulesReference: {
			...currentState.rulesReference,
			history: { entries, index: entries.length - 1 },
		},
	};
}

function setRulesReferenceHistoryIndex(
	currentState: AppState,
	requestedIndex: number,
): AppState {
	const history = currentState.rulesReference.history;
	if (!history.entries.length) return currentState;
	const nextIndex = Math.min(
		history.entries.length - 1,
		Math.max(0, Number.isFinite(requestedIndex) ? requestedIndex : 0),
	);
	if (nextIndex === history.index) return currentState;
	return {
		...currentState,
		rulesReference: {
			...currentState.rulesReference,
			history: { ...history, index: nextIndex },
		},
	};
}

export function reduceRulesReferenceWorkflowState(
	currentState: AppState,
	action: AppAction,
): AppState | undefined {
	switch (action.type) {
		case REQUEST_RULES_REFERENCE_NAVIGATION:
			return {
				...currentState,
				rulesReference: {
					...currentState.rulesReference,
					navigationRequest: action.payload,
				},
			};
		case SET_RULES_REFERENCE_MODAL_OPEN:
			return {
				...currentState,
				rulesReference: {
					...currentState.rulesReference,
					isOpen: action.payload,
				},
			};
		case RECORD_RULES_REFERENCE_HISTORY_ENTRY:
			return recordRulesReferenceHistoryEntry(currentState, action.payload);
		case SET_RULES_REFERENCE_HISTORY_INDEX:
			return setRulesReferenceHistoryIndex(currentState, action.payload);
		default:
			return undefined;
	}
}
