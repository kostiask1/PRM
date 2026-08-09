import { reduceNavigationState } from "../../shared/model/navigationStateReducer.ts";
import { reduceSettingsAndSyncState } from "../../shared/model/settingsSyncReducer.ts";
import { reduceWorkflowState } from "../../shared/model/workflowReducer.ts";
import type { AppAction, AppState } from "../../shared/model/appStoreTypes.ts";

export function reduceAppState(
	currentState: AppState,
	action: AppAction,
): AppState {
	const settingsAndSyncState = reduceSettingsAndSyncState(
		currentState,
		action,
	);
	if (settingsAndSyncState !== undefined) return settingsAndSyncState;
	const workflowState = reduceWorkflowState(currentState, action);
	if (workflowState !== undefined) return workflowState;
	const navigationState = reduceNavigationState(currentState, action);
	return navigationState ?? currentState;
}
