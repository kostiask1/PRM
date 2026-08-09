import {
	getAppStoreRuntime,
	type AppSelector,
	type RouterNavigate,
} from "./appStoreRuntime.ts";
import type {
	CampaignSlug,
	EncounterId,
	SessionFileName,
} from "../lib/navigation.ts";
import type { ModalConfig } from "./modalActions.ts";
import type { RulesReferenceNavigationOptions } from "./rulesReferenceActions.ts";
import type { RequestId } from "./contracts.ts";
import type {
	AppAction,
	AppDispatch,
	AppState,
	AppStore,
	AppThunk,
} from "./appStoreTypes.ts";

function dispatch(action: AppAction): AppAction;
function dispatch<TResult>(thunk: AppThunk<TResult>): TResult;
function dispatch<TResult>(
	action: AppAction | AppThunk<TResult>,
): AppAction | TResult {
	if (typeof action === "function") {
		return getAppStoreRuntime().store.dispatch(action);
	}
	return getAppStoreRuntime().store.dispatch(action);
}

export const appStore: AppStore = {
	getState() {
		return getAppStoreRuntime().store.getState();
	},
	dispatch: dispatch as AppDispatch,
	subscribe(listener: () => void) {
		return getAppStoreRuntime().store.subscribe(listener);
	},
};

export function useAppSelector<TResult>(selector: AppSelector<TResult>): TResult {
	return getAppStoreRuntime().useAppSelector(selector);
}

export function useAppDispatch(): AppDispatch {
	return getAppStoreRuntime().useAppDispatch();
}

export function openModalRequest(config: ModalConfig): Promise<unknown> {
	return getAppStoreRuntime().openModalRequest(config);
}

export function resolveModalRequest(
	requestId: RequestId | null | undefined,
	value: unknown,
): void {
	getAppStoreRuntime().resolveModalRequest(requestId, value);
}

export function closeActiveModal(value: unknown = null): void {
	getAppStoreRuntime().closeActiveModal(value);
}

export function requestRulesReferenceNavigation(
	tabId: unknown,
	name: unknown = "",
	options: RulesReferenceNavigationOptions = {},
): void {
	getAppStoreRuntime().requestRulesReferenceNavigation(tabId, name, options);
}

export function setRulesReferenceModalOpen(isOpen: unknown): void {
	getAppStoreRuntime().setRulesReferenceModalOpen(isOpen);
}

export function recordRulesReferenceHistoryEntry(
	tabId: unknown,
	name: unknown,
): void {
	getAppStoreRuntime().recordRulesReferenceHistoryEntry(tabId, name);
}

export function setRulesReferenceHistoryIndex(index: string | number): void {
	getAppStoreRuntime().setRulesReferenceHistoryIndex(index);
}

export function syncNavigationFromPath(pathname: string | null = null): void {
	getAppStoreRuntime().syncNavigationFromPath(pathname);
}

export function setRouterNavigate(navigate: RouterNavigate | null): void {
	getAppStoreRuntime().setRouterNavigate(navigate);
}

export function navigateTo(
	slug: CampaignSlug | null | undefined,
	fileName: SessionFileName | null = null,
	replace = false,
	encounterId: EncounterId | null = null,
	openInNewTab = false,
): void {
	getAppStoreRuntime().navigateTo(
		slug,
		fileName,
		replace,
		encounterId,
		openInNewTab,
	);
}
