import { HIDE_MESSAGE_BOX, SHOW_MESSAGE_BOX } from "./messageBoxActions.ts";
import type { AppAction, AppState } from "./appStoreTypes.ts";

export function reduceMessageBoxWorkflowState(
	currentState: AppState,
	action: AppAction,
): AppState | undefined {
	switch (action.type) {
		case SHOW_MESSAGE_BOX:
			return { ...currentState, messageBox: action.payload };
		case HIDE_MESSAGE_BOX:
			return { ...currentState, messageBox: null };
		default:
			return undefined;
	}
}
