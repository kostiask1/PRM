import { SET_NAVIGATION } from "./appStateActions.ts";
import type { AppAction, AppState } from "./appStoreTypes.ts";
import {
	isNavigationProjectionUnchanged,
	projectNavigationState,
} from "./navigationStateModel.ts";

export function reduceRouteNavigation(
	currentState: AppState,
	action: AppAction,
): AppState | undefined {
	if (action.type !== SET_NAVIGATION) return undefined;
	const projection = projectNavigationState(currentState, action.payload);
	if (isNavigationProjectionUnchanged(currentState, projection)) {
		return currentState;
	}
	return {
		...currentState,
		navigation: projection.navigation,
		active: projection.active,
	};
}
