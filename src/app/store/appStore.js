import {
	CLOSE_MENTION_PICKER,
	CLOSE_MODAL,
	HIDE_MESSAGE_BOX,
	OPEN_MENTION_PICKER,
	OPEN_MODAL,
	PUBLISH_DICE_RESULT,
	REFRESH_ENTITIES,
	DATA_SYNC_RECEIVED,
	REQUEST_DICE_ROLL,
	SET_NAVIGATION,
	SHOW_MESSAGE_BOX,
} from "../../shared/model/index.js";
import {
	REQUEST_CAMPAIGNS_RELOAD,
	SET_ACTIVE_CAMPAIGN,
	SET_CAMPAIGNS,
} from "../../entities/campaign/model.js";
import { SET_ACTIVE_SESSION } from "../../entities/session/model.js";
import { SET_ACTIVE_ENCOUNTER } from "../../entities/encounter/model.js";
import {
	SET_LANGUAGE,
	SET_UI_SETTINGS,
} from "../../entities/settings/model.js";
import {
	RECORD_RULES_REFERENCE_HISTORY_ENTRY,
	REQUEST_RULES_REFERENCE_NAVIGATION,
	SET_RULES_REFERENCE_HISTORY_INDEX,
	SET_RULES_REFERENCE_MODAL_OPEN,
} from "../../features/reference-navigation/model.js";
import { bindAppStore } from "../../shared/lib/index.js";
import { parseUrl } from "../../shared/lib/navigation.js";
import { lang } from "../../shared/config/index.js";

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
		ignoreSourcesList: [],
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
	rulesReference: {
		isOpen: false,
		navigationRequest: null,
		history: {
			entries: [],
			index: -1,
		},
	},
};

let state = initialState;
const listeners = new Set();

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
		case REQUEST_RULES_REFERENCE_NAVIGATION:
			return {
				...currentState,
				rulesReference: {
					...currentState.rulesReference,
					navigationRequest: action.payload,
				},
			};
		case SET_RULES_REFERENCE_MODAL_OPEN:
			return {
				...currentState,
				rulesReference: {
					...currentState.rulesReference,
					isOpen: action.payload,
				},
			};
		case RECORD_RULES_REFERENCE_HISTORY_ENTRY: {
			const nextEntry = action.payload;
			if (!nextEntry?.tabId || !nextEntry?.name) return currentState;

			const history = currentState.rulesReference.history;
			const currentEntry = history.entries[history.index];
			if (
				currentEntry?.tabId === nextEntry.tabId &&
				currentEntry?.name === nextEntry.name
			) {
				return currentState;
			}

			const entries = history.entries
				.slice(0, history.index + 1)
				.concat(nextEntry);
			return {
				...currentState,
				rulesReference: {
					...currentState.rulesReference,
					history: {
						entries,
						index: entries.length - 1,
					},
				},
			};
		}
		case SET_RULES_REFERENCE_HISTORY_INDEX: {
			const history = currentState.rulesReference.history;
			if (!history.entries.length) return currentState;

			const nextIndex = Math.min(
				history.entries.length - 1,
				Math.max(0, Number.isFinite(action.payload) ? action.payload : 0),
			);
			if (nextIndex === history.index) return currentState;

			return {
				...currentState,
				rulesReference: {
					...currentState.rulesReference,
					history: {
						...history,
						index: nextIndex,
					},
				},
			};
		}
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

bindAppStore(appStore);
