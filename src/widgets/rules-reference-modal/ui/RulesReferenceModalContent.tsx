import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type ReactList from "react-list";

import { isAbortError } from "../../../shared/api/index.ts";
import { alert } from "../../../shared/model/index.js";
import {
	bestiaryApi,
	type BestiaryMonster,
} from "../../../entities/bestiary/index.js";
import { spellApi, type SpellRecord } from "../../../entities/spell/index.js";
import "../../../assets/components/Bestiary.css";
import "../../../assets/components/RulesReferenceModalContent.css";
import { lang } from "../../../shared/lib/index.js";
import {
	recordRulesReferenceHistoryEntry,
	setRulesReferenceHistoryIndex,
	setRulesReferenceModalOpen,
	useAppDispatch,
	useAppSelector,
} from "../../../shared/model/index.js";
import {
	formatSourceLabel,
	getSpellMeta as formatSpellMeta,
	referenceApi,
} from "../../../entities/reference/index.js";
import {
	REFERENCE_TAB_POLICIES,
	applyLoadedReferenceSelection,
	applyReferenceTabOnlySelection,
	applyReferenceSelectionReconciliationPlan,
	combineBestiaryLists,
	createReferenceSelection,
	findSelectedReferenceItem,
	getInitialTabId,
	executeReferenceInitialNavigationPlan,
	executeReferenceTabSelectionPlan,
	getReferenceInitialNavigationPlan,
	getReferenceLoadErrorMessage,
	getReferenceNavigationRequestPlan,
	getReferenceHistoryAvailability,
	getReferenceKeyboardPlan,
	getReferenceItemKey,
	getReferenceScrollPlan,
	getReferenceSelectionName,
	getReferenceSelectionReconciliationPlan,
	getReferenceTabSelectionPlan,
	getReferenceTabsToLoad,
	isReferenceTabId,
	itemMatchesQuery,
	normalizeReferenceList,
	type ReferenceItem,
	type ReferenceSelection,
	type ReferenceTabId,
	type ReferenceTabPolicy,
} from "../model.js";
import type { RulesReferenceHistoryEntry } from "../../../shared/model/index.js";
import RulesReferenceListItem from "./RulesReferenceListItem.tsx";
import RulesReferenceModalView from "./RulesReferenceModalView.tsx";

type UiReferenceItem = ReferenceItem &
	Partial<BestiaryMonster> &
	Partial<SpellRecord>;

interface ReferenceTab extends ReferenceTabPolicy {
	load: (options?: RequestInit) => Promise<unknown>;
	meta?: (item: UiReferenceItem) => string;
}

export interface RulesReferenceModalContentProps {
	initialTab?: ReferenceTabId;
	initialName?: string;
	forceTab?: boolean;
	onSelectReference?: ((selection: ReferenceSelection<UiReferenceItem>) => void) | null;
}

const VARIANT_RULE_TYPE_LABELS = {
	C: "Core Rule",
	O: "Optional Rule",
	V: "Variant Rule",
	VO: "Variant Optional Rule",
};

function getVariantRuleTypeLabel(ruleType: unknown) {
	const value = String(ruleType || "");
	return lang.t(VARIANT_RULE_TYPE_LABELS[value as keyof typeof VARIANT_RULE_TYPE_LABELS] || value);
}

function getSpellMeta(spell: UiReferenceItem = {}) {
	return formatSpellMeta(spell, " · ");
}

function getMonsterMeta(monster: UiReferenceItem = {}) {
	const crValue = getMonsterCr(monster);
	return [formatSourceLabel(monster.source), crValue ? `CR ${crValue}` : ""]
		.filter(Boolean)
		.join(" / ");
}

function getMonsterCr(monster: UiReferenceItem = {}) {
	return monster.cr && typeof monster.cr === "object"
		? monster.cr.cr
		: monster.cr;
}

async function loadSpellReferenceItems(options: RequestInit = {}) {
	return spellApi.getSpellData("all", options);
}

async function loadBestiaryReferenceItems(options: RequestInit = {}) {
	const [officialData, customData] = await Promise.all([
		bestiaryApi.getBestiaryData("all", options),
		bestiaryApi
			.getCustomBestiaryData(options)
			.catch((error) =>
				isAbortError(error) ? Promise.reject(error) : [],
			),
	]);
	return combineBestiaryLists(officialData, customData);
}

const LOADERS: Record<
	ReferenceTabId,
	(options?: RequestInit) => Promise<unknown>
> = {
	conditions: (options) => referenceApi.getConditions(options),
	diseases: (options) => referenceApi.getDiseases(options),
	senses: (options) => referenceApi.getSenses(options),
	skills: (options) => referenceApi.getSkills(options),
	variantrules: (options) => referenceApi.getVariantRules(options),
	spells: loadSpellReferenceItems,
	bestiary: loadBestiaryReferenceItems,
};

const META: Partial<Record<ReferenceTabId, (item: UiReferenceItem) => string>> = {
	diseases: (item) => String(item.type || ""),
	skills: (item) => String(item.ability || "").toUpperCase(),
	variantrules: (item) => getVariantRuleTypeLabel(item.ruleType),
	spells: getSpellMeta,
	bestiary: getMonsterMeta,
};

const REFERENCE_TABS: ReferenceTab[] = REFERENCE_TAB_POLICIES.map((policy) => ({
	...policy,
	load: LOADERS[policy.id],
	meta: META[policy.id],
}));

const TAB_BY_ID = new Map(REFERENCE_TABS.map((tab) => [tab.id, tab]));
const EMPTY_ITEMS: UiReferenceItem[] = [];

function isEditableTarget(target: EventTarget | null) {
	if (!(target instanceof HTMLElement)) return false;
	return Boolean(
		target.closest("input, textarea, select, [contenteditable='true']"),
	);
}

function getReferenceMeta(tab: ReferenceTab, item: UiReferenceItem | null): string {
	if (!item || !tab.meta) return "";
	return tab.meta(item);
}

function getEnabledHandler<THandler>(enabled: unknown, handler: THandler): THandler | null {
	return enabled ? handler : null;
}

function runWhenMounted(mountedRef: { current: boolean }, effect: () => void): void {
	if (mountedRef.current) effect();
}

export default function RulesReferenceModalContent({
	initialTab = "conditions",
	initialName = "",
	forceTab = false,
	onSelectReference = null,
}: RulesReferenceModalContentProps) {
	const dispatch = useAppDispatch();
	const navigationRequest = useAppSelector(
		(state) => state.rulesReference.navigationRequest,
	);
	const navigationHistory = useAppSelector(
		(state) => state.rulesReference.history,
	);
	const listRef = useRef<ReactList | null>(null);
	const isMountedRef = useRef(false);
	const requestedTabsRef = useRef(new Set<ReferenceTabId>());
	const requestControllersRef = useRef(
		new Map<ReferenceTabId, AbortController>(),
	);
	const handledNavigationRequestIdRef = useRef<number | null>(null);
	const hasInitializedNavigationRef = useRef(false);
	const shouldScrollToActiveRef = useRef(false);
	const pendingNavigationTabRef = useRef<ReferenceTabId | null>(null);
	const [activeTabId, setActiveTabId] = useState(getInitialTabId(initialTab));
	const [query, setQuery] = useState("");
	const [isDetailedSearch, setIsDetailedSearch] = useState(false);
	const [itemsByTab, setItemsByTab] = useState<Partial<Record<ReferenceTabId, UiReferenceItem[]>>>({});
	const [selectedByTab, setSelectedByTab] = useState<Partial<Record<ReferenceTabId, string>>>({});
	const [loadingByTab, setLoadingByTab] = useState<Partial<Record<ReferenceTabId, boolean>>>({});

	const {
		activeTab,
		hasLoadedActiveTab,
		activeItems,
		activeSelectedName,
		isLoading,
		normalizedQuery,
	} = deriveActiveState(activeTabId, itemsByTab, selectedByTab, loadingByTab, query);
	const isGlobalSearch = Boolean(normalizedQuery);
	const { canNavigateBack, canNavigateForward } = getReferenceHistoryAvailability(
		navigationHistory.index,
		navigationHistory.entries.length,
	);

	const recordNavigation = useCallback((tabId: ReferenceTabId, name: string) => {
		if (!tabId || !name) return;
		recordRulesReferenceHistoryEntry(tabId, name);
	}, []);

	const applyNavigationEntry = useCallback((entry: RulesReferenceHistoryEntry) => {
		if (!isReferenceTabId(entry.tabId)) return;
		shouldScrollToActiveRef.current = true;
		pendingNavigationTabRef.current = null;
		setActiveTabId(entry.tabId);
		setSelectedByTab((current) => ({
			...current,
			[entry.tabId]: entry.name,
		}));
	}, []);

	const navigateHistory = useCallback(
		(direction: -1 | 1) => {
			const nextIndex = navigationHistory.index + direction;
			const nextEntry = navigationHistory.entries[nextIndex];
			if (!nextEntry) return;

			setRulesReferenceHistoryIndex(nextIndex);
			applyNavigationEntry(nextEntry);
		},
		[applyNavigationEntry, navigationHistory],
	);

	const navigateToReference = useCallback(
		(tabId: unknown, name: string) => {
			if (!isReferenceTabId(tabId) || !name) return;

			shouldScrollToActiveRef.current = true;
			pendingNavigationTabRef.current = null;
			recordNavigation(tabId, name);
			setActiveTabId(tabId);
			setSelectedByTab((current) => ({
				...current,
				[tabId]: name,
			}));
		},
		[recordNavigation],
	);

	const applyTabOnlyNavigation = useCallback((tabId: unknown) => {
		if (!isReferenceTabId(tabId)) return;

		shouldScrollToActiveRef.current = false;
		pendingNavigationTabRef.current = null;
		setActiveTabId(tabId);
		setSelectedByTab((current) => applyReferenceTabOnlySelection(current, tabId));
	}, []);

	useEffect(() => {
		const requestControllers = requestControllersRef.current;
		const requestedTabs = requestedTabsRef.current;
		isMountedRef.current = true;
		setRulesReferenceModalOpen(true);
		return () => {
			isMountedRef.current = false;
			for (const [tabId, controller] of requestControllers) {
				controller.abort();
				requestedTabs.delete(tabId);
			}
			requestControllers.clear();
			setRulesReferenceModalOpen(false);
		};
	}, []);

	useEffect(() => {
		const plan = getReferenceNavigationRequestPlan(
			navigationRequest,
			handledNavigationRequestIdRef.current,
		);
		if (!plan) return;
		handledNavigationRequestIdRef.current = plan.requestId;
		if (plan.type === "tab-only") applyTabOnlyNavigation(plan.tabId);
		else navigateToReference(plan.tabId, plan.name);
	}, [applyTabOnlyNavigation, navigateToReference, navigationRequest]);

	useEffect(() => {
		const currentEntry = navigationHistory.entries[navigationHistory.index];
		const plan = getReferenceInitialNavigationPlan(
			hasInitializedNavigationRef.current,
			forceTab,
			initialTab,
			initialName,
			currentEntry,
		);
		if (!plan) return;
		hasInitializedNavigationRef.current = true;
		executeReferenceInitialNavigationPlan(plan, {
			onTabOnly: applyTabOnlyNavigation,
			onReference: navigateToReference,
			onHistory: (entry) => applyNavigationEntry(entry as RulesReferenceHistoryEntry),
			onTab: setActiveTabId,
		});
	}, [
		applyNavigationEntry,
		applyTabOnlyNavigation,
		forceTab,
		initialName,
		initialTab,
		navigationHistory,
		navigateToReference,
		recordNavigation,
	]);

	useEffect(() => {
		if (!activeSelectedName) return;
		if (navigationHistory.entries.length) return;
		recordNavigation(activeTab.id, activeSelectedName);
	}, [
		activeSelectedName,
		activeTab.id,
		navigationHistory.entries.length,
		recordNavigation,
	]);

	useEffect(() => {
		const tabsToLoad = getReferenceTabsToLoad(
			isGlobalSearch,
			REFERENCE_TAB_POLICIES.map((tab) => tab.id),
			activeTab.id,
			itemsByTab,
			requestedTabsRef.current,
		).map((tabId) => TAB_BY_ID.get(tabId) as ReferenceTab);

		if (!tabsToLoad.length) return undefined;

		const loadItems = async (tab: ReferenceTab) => {
			const controller = new AbortController();
			const isCurrentRequest = () =>
				requestControllersRef.current.get(tab.id) === controller;
			requestControllersRef.current.set(tab.id, controller);
			requestedTabsRef.current.add(tab.id);
			setLoadingByTab((current) => ({ ...current, [tab.id]: true }));
			try {
				const list = await tab.load({ signal: controller.signal });
				if (
					!isMountedRef.current ||
					controller.signal.aborted ||
					!isCurrentRequest()
				) {
					return;
				}
				runWhenMounted(isMountedRef, () => {
					const normalizedList = normalizeReferenceList(list) as UiReferenceItem[];
					setItemsByTab((current) => ({
						...current,
						[tab.id]: normalizedList,
					}));
					setSelectedByTab((current) =>
						applyLoadedReferenceSelection(current, tab.id, normalizedList),
					);
				});
			} catch (error: unknown) {
				if (isAbortError(error)) return;
				if (
					!isMountedRef.current ||
					controller.signal.aborted ||
					!isCurrentRequest()
				) {
					return;
				}
				requestedTabsRef.current.delete(tab.id);
				runWhenMounted(isMountedRef, () => {
					dispatch(
						alert({
							title: lang.t("Error"),
							message: getReferenceLoadErrorMessage(error, lang.t("Unknown error")),
						}),
					);
				});
			} finally {
				const ownsRequest = isCurrentRequest();
				if (ownsRequest) {
					requestControllersRef.current.delete(tab.id);
				}
				if (
					ownsRequest &&
					isMountedRef.current &&
					!controller.signal.aborted
				) {
					setLoadingByTab((current) => ({
						...current,
						[tab.id]: false,
					}));
				}
			}
		};

		tabsToLoad.forEach((tab) => {
			loadItems(tab);
		});
	}, [activeTab, dispatch, isGlobalSearch, itemsByTab]);

	const filteredItemsByTab = useMemo(() => {
		return REFERENCE_TABS.reduce<Partial<Record<ReferenceTabId, UiReferenceItem[]>>>((result, tab) => {
			const items = itemsByTab[tab.id] || EMPTY_ITEMS;
			result[tab.id] = items.filter((item) =>
				itemMatchesQuery(tab, item, normalizedQuery, isDetailedSearch, tab.meta?.(item)),
			);
			return result;
		}, {});
	}, [itemsByTab, normalizedQuery, isDetailedSearch]);

	const filteredItems = filteredItemsByTab[activeTab.id] || EMPTY_ITEMS;
	const tabsWithSearchMatches = useMemo<Set<ReferenceTabId>>(() => {
		if (!normalizedQuery) return new Set<ReferenceTabId>();

		return new Set(
			REFERENCE_TABS.filter(
				(tab) => (filteredItemsByTab[tab.id] || EMPTY_ITEMS).length > 0,
			).map((tab) => tab.id),
		);
	}, [filteredItemsByTab, normalizedQuery]);

	useEffect(() => {
		const plan = getReferenceSelectionReconciliationPlan({
			tabId: activeTab.id,
			hasLoaded: hasLoadedActiveTab,
			isLoading,
			activeItems,
			filteredItems,
			selectedName: activeSelectedName,
		});
		if (!plan) return;
		setSelectedByTab((current) =>
			applyReferenceSelectionReconciliationPlan(current, plan),
		);
	}, [
		activeSelectedName,
		activeTab.id,
		activeItems,
		filteredItems,
		hasLoadedActiveTab,
		isLoading,
	]);

	useEffect(() => {
		const plan = getReferenceScrollPlan({
			tabId: activeTab.id,
			hasLoaded: hasLoadedActiveTab,
			isLoading,
			shouldScroll: shouldScrollToActiveRef.current,
			filteredItems,
			selectedName: activeSelectedName,
		});
		if (!plan) return;
		shouldScrollToActiveRef.current = false;
		if (plan.scrollIndex >= 0) {
			setTimeout(() => listRef.current?.scrollTo(plan.scrollIndex), 0);
		}
	}, [
		activeSelectedName,
		activeTab.id,
		filteredItems,
		hasLoadedActiveTab,
		isLoading,
	]);

	useEffect(() => {
		if (
			pendingNavigationTabRef.current !== activeTab.id ||
			!activeSelectedName
		) {
			return;
		}

		pendingNavigationTabRef.current = null;
		recordNavigation(activeTab.id, activeSelectedName);
	}, [activeSelectedName, activeTab.id, recordNavigation]);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			const plan = getReferenceKeyboardPlan({
				key: event.key,
				altKey: event.altKey,
				ctrlKey: event.ctrlKey,
				metaKey: event.metaKey,
				shiftKey: event.shiftKey,
				isEditableTarget: isEditableTarget(event.target),
				canNavigateBack,
			});
			if (!plan) return;

			if (plan.preventDefault) event.preventDefault();
			navigateHistory(plan.historyDirection);
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [canNavigateBack, navigateHistory]);

	const selectedItem = resolveSelectedItem(activeTab.id, filteredItems, activeItems, activeSelectedName);
	const selectedMeta = getReferenceMeta(activeTab, selectedItem);

	const selectTab = (tabId: ReferenceTabId) => {
		const plan = getReferenceTabSelectionPlan(
			tabId,
			selectedByTab[tabId] || "",
			(itemsByTab[tabId] || EMPTY_ITEMS)[0],
		);
		executeReferenceTabSelectionPlan(plan, {
			onScrollRequest: (shouldScroll) => {
				shouldScrollToActiveRef.current = shouldScroll;
			},
			onPendingNavigation: (pendingTabId) => {
				pendingNavigationTabRef.current = pendingTabId;
			},
			onNavigation: recordNavigation,
			onActiveTab: setActiveTabId,
		});
	};

	const selectItem = (name: string) => {
		shouldScrollToActiveRef.current = false;
		pendingNavigationTabRef.current = null;
		recordNavigation(activeTab.id, name);
		setSelectedByTab((current) => ({ ...current, [activeTab.id]: name }));
	};

	const selectSpellReference = (spell: SpellRecord) => {
		const selection = createReferenceSelection("spells", spell);
		if (selection && onSelectReference) onSelectReference(selection);
	};

	const recordEmbeddedReferenceSelection = useCallback(
		(tabId: ReferenceTabId, name: string) => {
			if (!isReferenceTabId(tabId) || !name) return;
			pendingNavigationTabRef.current = null;
			recordNavigation(tabId, name);
			setSelectedByTab((current) => {
				if (!current[tabId]) return current;
				return {
					...current,
					[tabId]: "",
				};
			});
		},
		[recordNavigation],
	);

	const insertReference = (tabId: ReferenceTabId, item: UiReferenceItem) => {
		const selection = createReferenceSelection(tabId, item);
		if (selection && onSelectReference) onSelectReference(selection);
	};

	const renderReferenceItem = (index: number) => {
		const item = filteredItems[index];
		if (!item) return null;
		const selectionName = getReferenceSelectionName(activeTab.id, item);
		return (
			<RulesReferenceListItem
				key={getReferenceItemKey(activeTab.id, item)}
				tabId={activeTab.id}
				item={item}
				query={query}
				meta={getReferenceMeta(activeTab, item)}
				active={selectedItem === item}
				onSelect={() => selectItem(selectionName)}
				onInsert={() => insertReference(activeTab.id, item)}
			/>
		);
	};

	return (
		<RulesReferenceModalView
			activeTab={activeTab}
			tabs={REFERENCE_TABS}
			query={query}
			isDetailedSearch={isDetailedSearch}
			activeSelectedName={activeSelectedName}
			tabsWithSearchMatches={tabsWithSearchMatches}
			canNavigateBack={canNavigateBack}
			canNavigateForward={canNavigateForward}
			isLoading={isLoading}
			normalizedQuery={normalizedQuery}
			filteredItems={filteredItems}
			selectedItem={selectedItem}
			selectedMeta={selectedMeta}
			canInsertReference={Boolean(onSelectReference)}
			listRef={listRef}
			renderReferenceItem={renderReferenceItem}
			onNavigateHistory={navigateHistory}
			onQueryChange={setQuery}
			onToggleDetailedSearch={() => setIsDetailedSearch((value) => !value)}
			onSelectTab={selectTab}
			onEmbeddedSelection={recordEmbeddedReferenceSelection}
			onSelectSpell={getEnabledHandler(onSelectReference, selectSpellReference)}
			onInsertReference={insertReference}
		/>
	);
}

function deriveActiveState(
	activeTabId: ReferenceTabId,
	itemsByTab: Partial<Record<ReferenceTabId, UiReferenceItem[]>>,
	selectedByTab: Partial<Record<ReferenceTabId, string>>,
	loadingByTab: Partial<Record<ReferenceTabId, boolean>>,
	query: string,
) {
	const activeTab = TAB_BY_ID.get(activeTabId) ?? REFERENCE_TABS[0];
	return {
		activeTab,
		hasLoadedActiveTab: Object.prototype.hasOwnProperty.call(itemsByTab, activeTab.id),
		activeItems: itemsByTab[activeTab.id] ?? EMPTY_ITEMS,
		activeSelectedName: selectedByTab[activeTab.id] ?? "",
		isLoading: Boolean(loadingByTab[activeTab.id]),
		normalizedQuery: query.trim().toLowerCase(),
	};
}

function resolveSelectedItem(
	tabId: ReferenceTabId,
	filteredItems: UiReferenceItem[],
	activeItems: UiReferenceItem[],
	selectedName: string,
): UiReferenceItem | null {
	return (findSelectedReferenceItem(tabId, filteredItems, selectedName) ??
		findSelectedReferenceItem(tabId, activeItems, selectedName)) as UiReferenceItem | null;
}
