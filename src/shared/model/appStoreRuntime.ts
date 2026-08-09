import type {
	CampaignSlug,
	EncounterId,
	SessionFileName,
} from "../lib/navigation.ts";
import type { ModalConfig } from "./modalActions.ts";
import type { RulesReferenceNavigationOptions } from "./rulesReferenceActions.ts";
import type { RequestId } from "./contracts.ts";
import type { AppDispatch, AppState, AppStore } from "./appStoreTypes.ts";

export type AppSelector<TResult> = (state: AppState) => TResult;

export type RouterNavigate = (
	url: string,
	options: { replace: boolean },
) => void;

export interface AppStoreRuntime {
	store: AppStore;
	useAppDispatch(): AppDispatch;
	useAppSelector<TResult>(selector: AppSelector<TResult>): TResult;
	openModalRequest(config: ModalConfig): Promise<unknown>;
	resolveModalRequest(
		requestId: RequestId | null | undefined,
		value: unknown,
	): void;
	closeActiveModal(value?: unknown): void;
	requestRulesReferenceNavigation(
		tabId: unknown,
		name?: unknown,
		options?: RulesReferenceNavigationOptions,
	): void;
	setRulesReferenceModalOpen(isOpen: unknown): void;
	recordRulesReferenceHistoryEntry(tabId: unknown, name: unknown): void;
	setRulesReferenceHistoryIndex(index: string | number): void;
	syncNavigationFromPath(pathname?: string | null): void;
	setRouterNavigate(navigate: RouterNavigate | null): void;
	navigateTo(
		slug: CampaignSlug | null | undefined,
		fileName?: SessionFileName | null,
		replace?: boolean,
		encounterId?: EncounterId | null,
		openInNewTab?: boolean,
	): void;
}

let configuredRuntime: AppStoreRuntime | null = null;

export function configureAppStoreRuntime(runtime: AppStoreRuntime): void {
	configuredRuntime = runtime;
}

export function getAppStoreRuntime(): AppStoreRuntime {
	if (!configuredRuntime) {
		throw new Error("The app-owned store runtime has not been configured.");
	}
	return configuredRuntime;
}
