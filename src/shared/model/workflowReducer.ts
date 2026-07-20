import type { AppAction, AppState } from "./appStoreTypes.ts";
import { reduceDiceWorkflowState } from "./diceWorkflowReducer.ts";
import { reduceMentionPickerWorkflowState } from "./mentionPickerWorkflowReducer.ts";
import { reduceMessageBoxWorkflowState } from "./messageBoxWorkflowReducer.ts";
import { reduceModalWorkflowState } from "./modalWorkflowReducer.ts";
import { reduceRulesReferenceWorkflowState } from "./rulesReferenceWorkflowReducer.ts";

export type WorkflowStateReducer = (
	currentState: AppState,
	action: AppAction,
) => AppState | undefined;

const WORKFLOW_STATE_REDUCERS: readonly WorkflowStateReducer[] = [
	reduceModalWorkflowState,
	reduceMentionPickerWorkflowState,
	reduceDiceWorkflowState,
	reduceMessageBoxWorkflowState,
	reduceRulesReferenceWorkflowState,
];

export function reduceWorkflowState(
	currentState: AppState,
	action: AppAction,
): AppState | undefined {
	for (const reduceState of WORKFLOW_STATE_REDUCERS) {
		const nextState = reduceState(currentState, action);
		if (nextState !== undefined) return nextState;
	}
	return undefined;
}
