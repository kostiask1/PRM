import type { AppAction, AppState } from "./appStoreTypes.ts";
import { reduceActiveResourceState } from "./activeResourceReducer.ts";
import { reduceNavigationVersions } from "./navigationVersionReducer.ts";
import { reduceRouteNavigation } from "./routeNavigationReducer.ts";

type NavigationReducer = (
	currentState: AppState,
	action: AppAction,
) => AppState | undefined;

const NAVIGATION_REDUCERS: NavigationReducer[] = [
	reduceNavigationVersions,
	reduceRouteNavigation,
	reduceActiveResourceState,
];

export function reduceNavigationState(
	currentState: AppState,
	action: AppAction,
): AppState | undefined {
	for (const reducer of NAVIGATION_REDUCERS) {
		const nextState = reducer(currentState, action);
		if (nextState !== undefined) return nextState;
	}
	return undefined;
}
