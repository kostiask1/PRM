import { useSyncExternalStore } from "react";
import {
	SET_LANGUAGE,
	setNavigationAction,
} from "./appStateActions.ts";
import {
	closeModalAction,
	openModalAction,
} from "./modalActions.ts";
import {
	recordRulesReferenceHistoryEntryAction,
	requestRulesReferenceNavigationAction,
	setRulesReferenceHistoryIndexAction,
	setRulesReferenceModalOpenAction,
} from "./rulesReferenceActions.ts";
import { buildNavigationUrl, parseUrl } from "../lib/navigation.ts";
import { lang } from "../lib/localization.js";
import { reduceSettingsAndSyncState } from "./settingsSyncReducer.ts";
import { reduceWorkflowState } from "./workflowReducer.ts";
import { reduceNavigationState } from "./navigationStateReducer.ts";
import type {
	CampaignSlug,
	EncounterId,
	SessionFileName,
} from "../lib/navigation.ts";
import type {
	AppAction,
	AppDispatch,
	AppState,
	AppStore,
	AppThunk,
	UiSettingsState,
} from "./appStoreTypes.ts";
import type { ModalConfig } from "./modalActions.ts";
import type { RequestId } from "./contracts.ts";
import type { RulesReferenceNavigationOptions } from "./rulesReferenceActions.ts";

const DEFAULT_IMAGE_PROMPT_BASE_PROMPT =
	"cinematic, photorealistic, ultra realistic, high detail, 8k, dramatic lighting, volumetric light, sharp focus, depth of field, film still, concept art";

function getInitialNavigation(): AppState["navigation"] {
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

function getInitialUiSettings(): UiSettingsState {
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

const initialState: AppState = {
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

let state: AppState = initialState;
const listeners = new Set<() => void>();
let modalRequestSeq: RequestId = 1;
const modalResolvers = new Map<RequestId, (value: unknown) => void>();
type RouterNavigate = (url: string, options: { replace: boolean }) => void;
let routerNavigate: RouterNavigate | null = null;

function emitChange() {
	listeners.forEach((listener) => listener());
}

function reducer(currentState: AppState, action: AppAction): AppState {
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

function dispatch(action: AppAction): AppAction;
function dispatch<TResult>(thunk: AppThunk<TResult>): TResult;
function dispatch<TResult>(
	action: AppAction | AppThunk<TResult>,
): AppAction | TResult {
	if (typeof action === "function") {
		return action(dispatch, appStore.getState);
	}
	const normalizedAction: AppAction =
		action.type === SET_LANGUAGE
			? { ...action, payload: lang.setLanguage(action.payload) }
			: action;
	state = reducer(state, normalizedAction);
	emitChange();
	return normalizedAction;
}

export const appStore: AppStore = {
	getState() {
		return state;
	},
	dispatch: dispatch as AppDispatch,
	subscribe(listener: () => void) {
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	},
};

export function useAppSelector<TResult>(
	selector: (state: AppState) => TResult,
): TResult {
	return useSyncExternalStore(
		appStore.subscribe,
		() => selector(appStore.getState()),
		() => selector(appStore.getState()),
	);
}

export function useAppDispatch(): AppDispatch {
	return appStore.dispatch;
}

export function openModalRequest(config: ModalConfig): Promise<unknown> {
	const requestId = modalRequestSeq++;
	return new Promise((resolve) => {
		modalResolvers.set(requestId, resolve);
		appStore.dispatch(openModalAction(requestId, config));
	});
}

export function resolveModalRequest(
	requestId: RequestId | null | undefined,
	value: unknown,
): void {
	if (requestId !== null && requestId !== undefined) {
		const resolve = modalResolvers.get(requestId);
		if (resolve) {
			resolve(value);
			modalResolvers.delete(requestId);
		}
	}
	appStore.dispatch(closeModalAction());
}

export function closeActiveModal(value: unknown = null): void {
	const requestId = appStore.getState().modal.requestId;
	resolveModalRequest(requestId, value);
}

export function requestRulesReferenceNavigation(
	tabId: unknown,
	name: unknown = "",
	options: RulesReferenceNavigationOptions = {},
): void {
	appStore.dispatch(
		requestRulesReferenceNavigationAction(tabId, name, options),
	);
}

export function setRulesReferenceModalOpen(isOpen: unknown): void {
	appStore.dispatch(setRulesReferenceModalOpenAction(isOpen));
}

export function recordRulesReferenceHistoryEntry(
	tabId: unknown,
	name: unknown,
): void {
	appStore.dispatch(recordRulesReferenceHistoryEntryAction(tabId, name));
}

export function setRulesReferenceHistoryIndex(index: string | number): void {
	appStore.dispatch(setRulesReferenceHistoryIndexAction(index));
}

export function syncNavigationFromPath(pathname: string | null = null): void {
	const route = parseUrl(pathname);
	appStore.dispatch(
		setNavigationAction({
			activeCampaignSlug: route.campaign || null,
			activeSessionFileName: route.session || null,
			activeEncounterId: route.encounter || null,
		}),
	);
}

export function setRouterNavigate(navigate: RouterNavigate | null): void {
	routerNavigate = typeof navigate === "function" ? navigate : null;
}

export function navigateTo(
	slug: CampaignSlug | null | undefined,
	fileName: SessionFileName | null = null,
	replace = false,
	encounterId: EncounterId | null = null,
	openInNewTab = false,
): void {
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
