import {
	REFRESH_ENTITIES,
	REQUEST_CAMPAIGNS_RELOAD,
} from "./appStateActions.ts";
import type { AppAction, AppState } from "./appStoreTypes.ts";

export function reduceNavigationVersions(
	currentState: AppState,
	action: AppAction,
): AppState | undefined {
	switch (action.type) {
		case REFRESH_ENTITIES:
			return {
				...currentState,
				entityRefreshVersion: currentState.entityRefreshVersion + 1,
			};
		case REQUEST_CAMPAIGNS_RELOAD:
			return {
				...currentState,
				campaigns: {
					...currentState.campaigns,
					reloadVersion: currentState.campaigns.reloadVersion + 1,
				},
			};
		default:
			return undefined;
	}
}
