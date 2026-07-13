import {
	REFRESH_ENTITIES,
	REQUEST_CAMPAIGNS_RELOAD,
	SET_ACTIVE_CAMPAIGN,
	SET_ACTIVE_ENCOUNTER,
	SET_ACTIVE_SESSION,
	SET_CAMPAIGNS,
	SET_NAVIGATION,
} from "./appStateActions.ts";
import type { AppAction, AppState } from "./appStoreTypes.ts";

function getProperty(value: unknown, key: string): unknown {
	if (!value || (typeof value !== "object" && typeof value !== "function")) {
		return undefined;
	}
	return (value as Record<string, unknown>)[key];
}

function findCampaignBySlug(campaigns: unknown[], slug: string | null): unknown {
	if (!slug) return null;
	return (
		campaigns.find((campaign) => getProperty(campaign, "slug") === slug) || null
	);
}

function isSessionForRoute(session: unknown, fileName: string | null): boolean {
	if (!session || !fileName) return false;
	return String(getProperty(session, "fileName") || "") === String(fileName);
}

function isEncounterForRoute(
	encounter: unknown,
	encounterId: string | number | null,
): boolean {
	if (!encounter || encounterId == null) return false;
	return String(getProperty(encounter, "id")) === String(encounterId);
}

export function reduceNavigationState(
	currentState: AppState,
	action: AppAction,
): AppState | undefined {
	switch (action.type) {
		case REFRESH_ENTITIES:
			return {
				...currentState,
				entityRefreshVersion: currentState.entityRefreshVersion + 1,
			};
		case SET_NAVIGATION: {
			const nextNavigation = {
				...currentState.navigation,
				...action.payload,
			};
			const currentCampaignSlug = getProperty(
				currentState.active.campaign,
				"slug",
			);
			const nextActiveCampaign =
				currentCampaignSlug === nextNavigation.activeCampaignSlug
					? currentState.active.campaign
					: findCampaignBySlug(
							currentState.campaigns.items,
							nextNavigation.activeCampaignSlug,
						);
			const isSameCampaign =
				currentCampaignSlug === nextNavigation.activeCampaignSlug;
			return {
				...currentState,
				navigation: nextNavigation,
				active: {
					campaign: nextActiveCampaign,
					session:
						isSameCampaign &&
						isSessionForRoute(
							currentState.active.session,
							nextNavigation.activeSessionFileName,
						)
							? currentState.active.session
							: null,
					encounter:
						isSameCampaign &&
						isEncounterForRoute(
							currentState.active.encounter,
							nextNavigation.activeEncounterId,
						)
							? currentState.active.encounter
							: null,
				},
			};
		}
		case SET_CAMPAIGNS: {
			const campaigns = action.payload;
			const activeCampaign = findCampaignBySlug(
				campaigns,
				currentState.navigation.activeCampaignSlug,
			);
			return {
				...currentState,
				campaigns: { ...currentState.campaigns, items: campaigns },
				active: {
					...currentState.active,
					campaign: activeCampaign,
					session: activeCampaign ? currentState.active.session : null,
					encounter: activeCampaign ? currentState.active.encounter : null,
				},
			};
		}
		case SET_ACTIVE_CAMPAIGN:
			return {
				...currentState,
				active: {
					...currentState.active,
					campaign: action.payload,
					session: action.payload ? currentState.active.session : null,
					encounter: action.payload ? currentState.active.encounter : null,
				},
			};
		case SET_ACTIVE_SESSION:
			return {
				...currentState,
				active: {
					...currentState.active,
					session: action.payload,
					encounter: action.payload ? currentState.active.encounter : null,
				},
			};
		case SET_ACTIVE_ENCOUNTER:
			return {
				...currentState,
				active: { ...currentState.active, encounter: action.payload },
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
