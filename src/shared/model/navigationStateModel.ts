import type { NavigationStatePatch } from "./appStateActions.ts";
import type { AppState } from "./appStoreTypes.ts";

export interface NavigationProjection {
	navigation: AppState["navigation"];
	active: AppState["active"];
}

function getProperty(value: unknown, key: string): unknown {
	if (!value || (typeof value !== "object" && typeof value !== "function")) {
		return undefined;
	}
	return (value as Record<string, unknown>)[key];
}

export function findCampaignBySlug(
	campaigns: unknown[],
	slug: string | null,
): unknown | null {
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

export function projectNavigationState(
	currentState: AppState,
	patch: NavigationStatePatch,
): NavigationProjection {
	const navigation = { ...currentState.navigation, ...patch };
	const currentCampaignSlug = getProperty(currentState.active.campaign, "slug");
	const isSameCampaign =
		currentCampaignSlug === navigation.activeCampaignSlug;
	const campaign = isSameCampaign
		? currentState.active.campaign
		: findCampaignBySlug(
				currentState.campaigns.items,
				navigation.activeCampaignSlug,
			);
	return {
		navigation,
		active: {
			campaign,
			session:
				isSameCampaign &&
				isSessionForRoute(
					currentState.active.session,
					navigation.activeSessionFileName,
				)
					? currentState.active.session
					: null,
			encounter:
				isSameCampaign &&
				isEncounterForRoute(
					currentState.active.encounter,
					navigation.activeEncounterId,
				)
					? currentState.active.encounter
					: null,
		},
	};
}

export function isNavigationProjectionUnchanged(
	currentState: AppState,
	projection: NavigationProjection,
): boolean {
	const currentNavigation = currentState.navigation;
	const nextNavigation = projection.navigation;
	return (
		currentNavigation.activeCampaignSlug ===
			nextNavigation.activeCampaignSlug &&
		currentNavigation.activeSessionFileName ===
			nextNavigation.activeSessionFileName &&
		currentNavigation.activeEncounterId === nextNavigation.activeEncounterId &&
		currentState.active.campaign === projection.active.campaign &&
		currentState.active.session === projection.active.session &&
		currentState.active.encounter === projection.active.encounter
	);
}

export function replaceActiveState(
	currentState: AppState,
	active: AppState["active"],
): AppState {
	if (
		currentState.active.campaign === active.campaign &&
		currentState.active.session === active.session &&
		currentState.active.encounter === active.encounter
	) {
		return currentState;
	}
	return { ...currentState, active };
}
