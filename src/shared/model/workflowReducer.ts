import { PUBLISH_DICE_RESULT, REQUEST_DICE_ROLL } from "./diceActions.ts";
import {
	CLOSE_MENTION_PICKER,
	OPEN_MENTION_PICKER,
} from "./mentionPickerActions.ts";
import { HIDE_MESSAGE_BOX, SHOW_MESSAGE_BOX } from "./messageBoxActions.ts";
import { CLOSE_MODAL, OPEN_MODAL } from "./modalActions.ts";
import {
	RECORD_RULES_REFERENCE_HISTORY_ENTRY,
	REQUEST_RULES_REFERENCE_NAVIGATION,
	SET_RULES_REFERENCE_HISTORY_INDEX,
	SET_RULES_REFERENCE_MODAL_OPEN,
} from "./rulesReferenceActions.ts";
import type { AppAction, AppState } from "./appStoreTypes.ts";

export function reduceWorkflowState(
	currentState: AppState,
	action: AppAction,
): AppState | undefined {
	switch (action.type) {
		case OPEN_MODAL:
			return {
				...currentState,
				modal: {
					requestId: action.payload.requestId,
					config: action.payload.config,
				},
			};
		case CLOSE_MODAL:
			return {
				...currentState,
				modal: { requestId: null, config: null },
			};
		case OPEN_MENTION_PICKER:
			return { ...currentState, mentionPickerRequest: action.payload };
		case CLOSE_MENTION_PICKER:
			return { ...currentState, mentionPickerRequest: null };
		case REQUEST_DICE_ROLL:
			return {
				...currentState,
				dice: { ...currentState.dice, rollRequest: action.payload },
			};
		case PUBLISH_DICE_RESULT:
			return {
				...currentState,
				dice: { ...currentState.dice, rolledResult: action.payload },
			};
		case SHOW_MESSAGE_BOX:
			return { ...currentState, messageBox: action.payload };
		case HIDE_MESSAGE_BOX:
			return { ...currentState, messageBox: null };
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
		case RECORD_RULES_REFERENCE_HISTORY_ENTRY: {
			const nextEntry = action.payload;
			if (!nextEntry.tabId || !nextEntry.name) return currentState;

			const history = currentState.rulesReference.history;
			const currentEntry = history.entries[history.index];
			if (
				currentEntry?.tabId === nextEntry.tabId &&
				currentEntry?.name === nextEntry.name
			) {
				return currentState;
			}

			const entries = history.entries
				.slice(0, history.index + 1)
				.concat(nextEntry);
			return {
				...currentState,
				rulesReference: {
					...currentState.rulesReference,
					history: { entries, index: entries.length - 1 },
				},
			};
		}
		case SET_RULES_REFERENCE_HISTORY_INDEX: {
			const history = currentState.rulesReference.history;
			if (!history.entries.length) return currentState;

			const nextIndex = Math.min(
				history.entries.length - 1,
				Math.max(0, Number.isFinite(action.payload) ? action.payload : 0),
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
		default:
			return undefined;
	}
}
