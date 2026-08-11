import { useSyncExternalStore } from "react";
import {
	SET_LANGUAGE,
	closeModalAction,
	openModalAction,
	setNavigationAction,
} from "../../shared/model/index.js";
import { reduceAppState } from "./appStateReducer.ts";
import { buildNavigationUrl, parseUrl } from "../../shared/lib/navigation.ts";
import { lang } from "../../shared/lib/localization.js";
import type {
	AppAction,
	AppDispatch,
	AppState,
	AppStore,
	AppThunk,
	CampaignSlug,
	EncounterId,
	ModalConfig,
	RequestId,
	SessionFileName,
	UiSettingsState,
} from "../../shared/model/index.js";

const DEFAULT_IMAGE_PROMPT_BASE_PROMPT =
	"cinematic, photorealistic, ultra realistic, high detail, 8k, dramatic lighting, volumetric light, sharp focus, depth of field, film still, concept art";

export type RouterNavigate = (
	url: string,
	options: { replace: boolean },
) => void;

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
let routerNavigate: RouterNavigate | null = null;

function emitChange() {
	listeners.forEach((listener) => listener());
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
	state = reduceAppState(state, normalizedAction);
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
