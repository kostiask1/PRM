import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";

import { isAbortError } from "../../../shared/api/index.ts";
import { lang } from "../../../shared/lib/index.js";
import {
	REFERENCE_TAB_POLICIES,
	applyLoadedReferenceSelection,
	getReferenceLoadErrorMessage,
	getReferenceTabsToLoad,
	normalizeReferenceList,
	type ReferenceItem,
	type ReferenceSelectionsByTab,
	type ReferenceTabId,
} from "../model.js";
import type { RulesReferenceModalRuntime } from "./RulesReferenceModalRuntime.tsx";

export interface ReferenceTabLoadTarget {
	id: ReferenceTabId;
	load: (options?: RequestInit) => Promise<unknown>;
}

interface MutableReference<TValue> {
	current: TValue;
}

type ItemsByTab<TItem extends ReferenceItem> = Partial<
	Record<ReferenceTabId, TItem[]>
>;
type LoadingByTab = Partial<Record<ReferenceTabId, boolean>>;

export interface ReferenceTabLoadRefs {
	isMountedRef: MutableReference<boolean>;
	requestedTabsRef: MutableReference<Set<ReferenceTabId>>;
	requestControllersRef: MutableReference<Map<ReferenceTabId, AbortController>>;
}

export interface ReferenceTabLoadRuntime<TItem extends ReferenceItem>
	extends ReferenceTabLoadRefs {
	setItemsByTab: Dispatch<SetStateAction<ItemsByTab<TItem>>>;
	setLoadingByTab: Dispatch<SetStateAction<LoadingByTab>>;
	setSelectedByTab: Dispatch<SetStateAction<ReferenceSelectionsByTab>>;
	reportError: RulesReferenceModalRuntime["reportError"];
}

export interface UseReferenceTabLoadingOptions<TItem extends ReferenceItem> {
	activeTab: ReferenceTabLoadTarget;
	isGlobalSearch: boolean;
	itemsByTab: ItemsByTab<TItem>;
	runtime: ReferenceTabLoadRuntime<TItem>;
	tabById: { get(tabId: ReferenceTabId): ReferenceTabLoadTarget | undefined };
}

interface ActiveReferenceTabLoad<TItem extends ReferenceItem> {
	tab: ReferenceTabLoadTarget;
	controller: AbortController;
	isCurrentRequest: () => boolean;
	runtime: ReferenceTabLoadRuntime<TItem>;
}

export function useReferenceTabLoadRuntime(): ReferenceTabLoadRefs {
	const isMountedRef = useRef(false);
	const requestedTabsRef = useRef(new Set<ReferenceTabId>());
	const requestControllersRef = useRef(
		new Map<ReferenceTabId, AbortController>(),
	);

	return {
		isMountedRef,
		requestedTabsRef,
		requestControllersRef,
	};
}

export function useReferenceTabLoadLifecycle<TItem extends ReferenceItem>(
	runtime: ReferenceTabLoadRuntime<TItem>,
	setModalOpen: RulesReferenceModalRuntime["setModalOpen"],
): void {
	const { isMountedRef, requestedTabsRef, requestControllersRef } = runtime;
	useEffect(() => {
		const requestControllers = requestControllersRef.current;
		const requestedTabs = requestedTabsRef.current;
		isMountedRef.current = true;
		setModalOpen(true);
		return () => {
			isMountedRef.current = false;
			for (const [tabId, controller] of requestControllers) {
				controller.abort();
				requestedTabs.delete(tabId);
			}
			requestControllers.clear();
			setModalOpen(false);
		};
	}, [setModalOpen]);
}

export function useReferenceTabLoading<TItem extends ReferenceItem>({
	activeTab,
	isGlobalSearch,
	itemsByTab,
	runtime,
	tabById,
}: UseReferenceTabLoadingOptions<TItem>): void {
	const { reportError, requestedTabsRef } = runtime;
	useEffect(() => {
		const tabsToLoad = getReferenceTabsToLoad(
			isGlobalSearch,
			REFERENCE_TAB_POLICIES.map((tab) => tab.id),
			activeTab.id,
			itemsByTab,
			requestedTabsRef.current,
		).map((tabId) => tabById.get(tabId) as ReferenceTabLoadTarget);

		if (!tabsToLoad.length) return undefined;

		tabsToLoad.forEach((tab) => {
			loadReferenceTab(tab, runtime);
		});
	}, [activeTab, isGlobalSearch, itemsByTab, reportError]);
}

function startReferenceTabLoad<TItem extends ReferenceItem>(
	tab: ReferenceTabLoadTarget,
	runtime: ReferenceTabLoadRuntime<TItem>,
): ActiveReferenceTabLoad<TItem> {
	const controller = new AbortController();
	const isCurrentRequest = () =>
		runtime.requestControllersRef.current.get(tab.id) === controller;
	runtime.requestControllersRef.current.set(tab.id, controller);
	runtime.requestedTabsRef.current.add(tab.id);
	runtime.setLoadingByTab((current) => ({ ...current, [tab.id]: true }));
	return { tab, controller, isCurrentRequest, runtime };
}

function shouldIgnoreReferenceTabLoad<TItem extends ReferenceItem>(
	request: ActiveReferenceTabLoad<TItem>,
): boolean {
	return (
		!request.runtime.isMountedRef.current ||
		request.controller.signal.aborted ||
		!request.isCurrentRequest()
	);
}

function applyLoadedReferenceTab<TItem extends ReferenceItem>(
	request: ActiveReferenceTabLoad<TItem>,
	list: unknown,
): void {
	if (shouldIgnoreReferenceTabLoad(request)) return;
	runWhenMounted(request.runtime.isMountedRef, () => {
		const normalizedList = normalizeReferenceList(list) as TItem[];
		request.runtime.setItemsByTab((current) => ({
			...current,
			[request.tab.id]: normalizedList,
		}));
		request.runtime.setSelectedByTab((current) =>
			applyLoadedReferenceSelection(current, request.tab.id, normalizedList),
		);
	});
}

function reportReferenceTabLoadFailure<TItem extends ReferenceItem>(
	request: ActiveReferenceTabLoad<TItem>,
	error: unknown,
): void {
	if (isAbortError(error)) return;
	if (shouldIgnoreReferenceTabLoad(request)) return;
	request.runtime.requestedTabsRef.current.delete(request.tab.id);
	runWhenMounted(request.runtime.isMountedRef, () => {
		request.runtime.reportError({
			title: lang.t("Error"),
			message: getReferenceLoadErrorMessage(error, lang.t("Unknown error")),
		});
	});
}

function finalizeReferenceTabLoad<TItem extends ReferenceItem>(
	request: ActiveReferenceTabLoad<TItem>,
): void {
	const ownsRequest = request.isCurrentRequest();
	removeOwnedReferenceTabRequest(request, ownsRequest);
	resetOwnedReferenceTabLoading(request, ownsRequest);
}

function removeOwnedReferenceTabRequest<TItem extends ReferenceItem>(
	request: ActiveReferenceTabLoad<TItem>,
	ownsRequest: boolean,
): void {
	if (!ownsRequest) return;
	request.runtime.requestControllersRef.current.delete(request.tab.id);
}

function resetOwnedReferenceTabLoading<TItem extends ReferenceItem>(
	request: ActiveReferenceTabLoad<TItem>,
	ownsRequest: boolean,
): void {
	if (!ownsRequest) return;
	if (!request.runtime.isMountedRef.current) return;
	if (request.controller.signal.aborted) return;
	request.runtime.setLoadingByTab((current) => ({
		...current,
		[request.tab.id]: false,
	}));
}

async function loadReferenceTab<TItem extends ReferenceItem>(
	tab: ReferenceTabLoadTarget,
	runtime: ReferenceTabLoadRuntime<TItem>,
): Promise<void> {
	const request = startReferenceTabLoad(tab, runtime);
	try {
		const list = await tab.load({ signal: request.controller.signal });
		applyLoadedReferenceTab(request, list);
	} catch (error: unknown) {
		reportReferenceTabLoadFailure(request, error);
	} finally {
		finalizeReferenceTabLoad(request);
	}
}

function runWhenMounted(
	mountedRef: MutableReference<boolean>,
	effect: () => void,
): void {
	if (mountedRef.current) effect();
}
