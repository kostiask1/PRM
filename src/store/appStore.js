import { useSyncExternalStore } from "react";
import {
	CLOSE_MENTION_PICKER,
	CLOSE_MODAL,
	HIDE_MESSAGE_BOX,
	OPEN_MENTION_PICKER,
	OPEN_MODAL,
	PUBLISH_DICE_RESULT,
	REFRESH_ENTITIES,
	REQUEST_CAMPAIGNS_RELOAD,
	SET_LANGUAGE,
	SET_UI_SETTINGS,
	DATA_SYNC_RECEIVED,
	SET_ACTIVE_CAMPAIGN,
	SET_ACTIVE_ENCOUNTER,
	SET_ACTIVE_SESSION,
	REQUEST_DICE_ROLL,
	SET_CAMPAIGNS,
	SET_NAVIGATION,
	SHOW_MESSAGE_BOX,
	closeModalAction,
	openModalAction,
	setNavigationAction,
} from "../actions/app";
import { buildNavigationUrl, parseUrl } from "../utils/navigation";
import { lang } from "../services/localization";

const DEFAULT_IMAGE_PROMPT_BASE_PROMPT =
	"cinematic, photorealistic, ultra realistic, high detail, 8k, dramatic lighting, volumetric light, sharp focus, depth of field, film still, concept art";

function getInitialNavigation() {
	if (typeof window === "undefined") {
		return {
			activeCampaignSlug: null,
			activeSessionFileName: null,
			activeEncounterId: null,
		};
	}
	const route = parseUrl();
	return {
		activeCampaignSlug: route.campaign || null,
		activeSessionFileName: route.session || null,
		activeEncounterId: route.encounter || null,
	};
}

function getInitialUiSettings() {
	return {
		theme: "light",
		encounterViewMode: "grid",
		encounterGridColumns: 3,
		simplifiedNotes: false,
		aiBasePrompt: "",
		imagePromptBasePrompt: DEFAULT_IMAGE_PROMPT_BASE_PROMPT,
		campaignAiBasePrompts: {},
		campaignImagePromptBasePrompts: {},
		autoApplyAiChanges: false,
		useSearchDebounce: true,
	};
}

function findCampaignBySlug(campaigns, slug) {
	if (!slug) return null;
	return (campaigns || []).find((campaign) => campaign?.slug === slug) || null;
}

function isSessionForRoute(session, fileName) {
	if (!session || !fileName) return false;
	return String(session.fileName || "") === String(fileName);
}

function isEncounterForRoute(encounter, encounterId) {
	if (!encounter || encounterId == null) return false;
	return String(encounter.id) === String(encounterId);
}

const initialState = {
	modal: {
		requestId: null,
		config: null,
	},
	entityRefreshVersion: 0,
	mentionPickerRequest: null,
	dice: {
		rollRequest: null,
		rolledResult: null,
	},
	messageBox: null,
	navigation: getInitialNavigation(),
	active: {
		campaign: null,
		session: null,
		encounter: null,
	},
	campaigns: {
		items: [],
		reloadVersion: 0,
	},
	localization: {
		language: lang.getLanguage(),
		availableLanguages: lang.getAvailableLanguages(),
	},
	ui: getInitialUiSettings(),
	sync: {
		version: 0,
		event: null,
	},
};

let state = initialState;
const listeners = new Set();
let modalRequestSeq = 1;
const modalResolvers = new Map();
let routerNavigate = null;

function emitChange() {
	listeners.forEach((listener) => listener());
}

function reducer(currentState, action) {
	switch (action.type) {
		case OPEN_MODAL:
			return {
				...currentState,
				modal: {
					requestId: action.payload.requestId,
					config: action.payload.config,
				},
			};
		case CLOSE_MODAL:
			return {
				...currentState,
				modal: {
					requestId: null,
					config: null,
				},
			};
		case REFRESH_ENTITIES:
			return {
				...currentState,
				entityRefreshVersion: currentState.entityRefreshVersion + 1,
			};
		case OPEN_MENTION_PICKER:
			return {
				...currentState,
				mentionPickerRequest: action.payload,
			};
		case CLOSE_MENTION_PICKER:
			return {
				...currentState,
				mentionPickerRequest: null,
			};
		case REQUEST_DICE_ROLL:
			return {
				...currentState,
				dice: {
					...currentState.dice,
					rollRequest: action.payload,
				},
			};
		case PUBLISH_DICE_RESULT:
			return {
				...currentState,
				dice: {
					...currentState.dice,
					rolledResult: action.payload,
				},
			};
		case SHOW_MESSAGE_BOX:
			return {
				...currentState,
				messageBox: action.payload,
			};
		case HIDE_MESSAGE_BOX:
			return {
				...currentState,
				messageBox: null,
			};
		case SET_NAVIGATION: {
			const nextNavigation = {
				...currentState.navigation,
				...action.payload,
			};
			const nextActiveCampaign =
				currentState.active.campaign?.slug === nextNavigation.activeCampaignSlug
					? currentState.active.campaign
					: findCampaignBySlug(
							currentState.campaigns.items,
							nextNavigation.activeCampaignSlug,
						);
			const isSameCampaign =
				currentState.active.campaign?.slug ===
				nextNavigation.activeCampaignSlug;
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
				campaigns: {
					...currentState.campaigns,
					items: campaigns,
				},
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
				active: {
					...currentState.active,
					encounter: action.payload,
				},
			};
		case REQUEST_CAMPAIGNS_RELOAD:
			return {
				...currentState,
				campaigns: {
					...currentState.campaigns,
					reloadVersion: currentState.campaigns.reloadVersion + 1,
				},
			};
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
			return currentState;
	}
}

export const appStore = {
	getState() {
		return state;
	},
	dispatch(action) {
		if (typeof action === "function") {
			return action(appStore.dispatch, appStore.getState);
		}
		if (action.type === SET_LANGUAGE) {
			action = {
				...action,
				payload: lang.setLanguage(action.payload),
			};
		}
		state = reducer(state, action);
		emitChange();
		return action;
	},
	subscribe(listener) {
		listeners.add(listener);
		return () => listeners.delete(listener);
	},
};

export function useAppSelector(selector) {
	return useSyncExternalStore(
		appStore.subscribe,
		() => selector(appStore.getState()),
		() => selector(appStore.getState()),
	);
}

export function useAppDispatch() {
	return appStore.dispatch;
}

export function openModalRequest(config) {
	const requestId = modalRequestSeq++;
	return new Promise((resolve) => {
		modalResolvers.set(requestId, resolve);
		appStore.dispatch(openModalAction(requestId, config));
	});
}

export function resolveModalRequest(requestId, value) {
	if (requestId !== null && requestId !== undefined) {
		const resolve = modalResolvers.get(requestId);
		if (resolve) {
			resolve(value);
			modalResolvers.delete(requestId);
		}
	}
	appStore.dispatch(closeModalAction());
}

export function closeActiveModal(value = null) {
	const requestId = appStore.getState().modal.requestId;
	resolveModalRequest(requestId, value);
}

export function syncNavigationFromPath(pathname) {
	const route = parseUrl(pathname);
	appStore.dispatch(
		setNavigationAction({
			activeCampaignSlug: route.campaign || null,
			activeSessionFileName: route.session || null,
			activeEncounterId: route.encounter || null,
		}),
	);
}

export function setRouterNavigate(navigate) {
	routerNavigate = typeof navigate === "function" ? navigate : null;
}

export function navigateTo(
	slug,
	fileName = null,
	replace = false,
	encounterId = null,
	openInNewTab = false,
) {
	const url = buildNavigationUrl(slug, fileName, encounterId);
	if (openInNewTab) {
		window.open(url, "_blank");
		return;
	}
	appStore.dispatch(
		setNavigationAction({
			activeCampaignSlug: slug || null,
			activeSessionFileName: fileName || null,
			activeEncounterId: encounterId || null,
		}),
	);
	if (routerNavigate) {
		routerNavigate(url, { replace });
	} else if (replace) {
		window.history.replaceState({}, "", url);
	} else {
		window.history.pushState({}, "", url);
	}
}
