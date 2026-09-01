import {
	SET_ACTIVE_CAMPAIGN,
	SET_ACTIVE_ENCOUNTER,
	SET_ACTIVE_SESSION,
	SET_CAMPAIGNS,
} from "./appStateActions.ts";
import type { AppAction, AppState } from "./appStoreTypes.ts";
import {
	findCampaignBySlug,
	replaceActiveState,
} from "./navigationStateModel.ts";

function reduceCampaignCollection(
	currentState: AppState,
	campaigns: unknown[],
): AppState {
	const campaign = findCampaignBySlug(
		campaigns,
		currentState.navigation.activeCampaignSlug,
	);
	const active = {
		...currentState.active,
		campaign,
		session: campaign ? currentState.active.session : null,
		encounter: campaign ? currentState.active.encounter : null,
	};
	if (currentState.campaigns.items === campaigns) {
		return replaceActiveState(currentState, active);
	}
	return {
		...currentState,
		campaigns: { ...currentState.campaigns, items: campaigns },
		active,
	};
}

function reduceActiveCampaign(
	currentState: AppState,
	campaign: unknown | null,
): AppState {
	return replaceActiveState(currentState, {
		...currentState.active,
		campaign,
		session: campaign ? currentState.active.session : null,
		encounter: campaign ? currentState.active.encounter : null,
	});
}

function reduceActiveSession(
	currentState: AppState,
	session: unknown | null,
): AppState {
	return replaceActiveState(currentState, {
		...currentState.active,
		session,
		encounter: session ? currentState.active.encounter : null,
	});
}

export function reduceActiveResourceState(
	currentState: AppState,
	action: AppAction,
): AppState | undefined {
	switch (action.type) {
		case SET_CAMPAIGNS:
			return reduceCampaignCollection(currentState, action.payload);
		case SET_ACTIVE_CAMPAIGN:
			return reduceActiveCampaign(currentState, action.payload);
		case SET_ACTIVE_SESSION:
			return reduceActiveSession(currentState, action.payload);
		case SET_ACTIVE_ENCOUNTER:
			return replaceActiveState(currentState, {
				...currentState.active,
				encounter: action.payload,
			});
		default:
			return undefined;
	}
}
