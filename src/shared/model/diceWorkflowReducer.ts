import { PUBLISH_DICE_RESULT, REQUEST_DICE_ROLL } from "./diceActions.ts";
import type { AppAction, AppState } from "./appStoreTypes.ts";

export function reduceDiceWorkflowState(
	currentState: AppState,
	action: AppAction,
): AppState | undefined {
	switch (action.type) {
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
		default:
			return undefined;
	}
}
