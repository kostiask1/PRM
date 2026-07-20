import {
	CLOSE_MENTION_PICKER,
	OPEN_MENTION_PICKER,
} from "./mentionPickerActions.ts";
import type { AppAction, AppState } from "./appStoreTypes.ts";

export function reduceMentionPickerWorkflowState(
	currentState: AppState,
	action: AppAction,
): AppState | undefined {
	switch (action.type) {
		case OPEN_MENTION_PICKER:
			return { ...currentState, mentionPickerRequest: action.payload };
		case CLOSE_MENTION_PICKER:
			return { ...currentState, mentionPickerRequest: null };
		default:
			return undefined;
	}
}
