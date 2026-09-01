import { CLOSE_MODAL, OPEN_MODAL } from "./modalActions.ts";
import type { AppAction, AppState } from "./appStoreTypes.ts";

export function reduceModalWorkflowState(
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
		default:
			return undefined;
	}
}
