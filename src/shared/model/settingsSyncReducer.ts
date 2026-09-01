import {
	DATA_SYNC_RECEIVED,
	SET_LANGUAGE,
	SET_UI_SETTINGS,
} from "./appStateActions.ts";
import type { AppAction, AppState } from "./appStoreTypes.ts";

export function reduceSettingsAndSyncState(
	currentState: AppState,
	action: AppAction,
): AppState | undefined {
	switch (action.type) {
		case SET_LANGUAGE:
			return {
				...currentState,
				localization: {
					...currentState.localization,
					language: action.payload,
				},
			};
		case SET_UI_SETTINGS:
			return {
				...currentState,
				ui: {
					...currentState.ui,
					...action.payload,
				},
			};
		case DATA_SYNC_RECEIVED:
			return {
				...currentState,
				sync: {
					version: currentState.sync.version + 1,
					event: action.payload,
				},
			};
		default:
			return undefined;
	}
}
