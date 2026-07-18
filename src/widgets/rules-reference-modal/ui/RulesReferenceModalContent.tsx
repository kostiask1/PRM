import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type ReactList from "react-list";

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
} from "../../../entities/reference/index.js";
import {
	REFERENCE_TAB_POLICIES,
	combineBestiaryLists,
	createReferenceSelection,
	findSelectedReferenceItem,
	getInitialTabId,
	getReferenceItemKey,
	getReferenceSelectionName,
	isReferenceTabId,
	itemMatchesQuery,
	itemMatchesSelectedName,
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
	load: () => Promise<unknown>;
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

async function loadSpellReferenceItems() {
	return spellApi.getSpellData("all");
}

async function loadBestiaryReferenceItems() {
	const [officialData, customData] = await Promise.all([
		bestiaryApi.getBestiaryData("all"),
		bestiaryApi.getCustomBestiaryData().catch(() => []),
	]);
	return combineBestiaryLists(officialData, customData);
}

const LOADERS: Record<ReferenceTabId, () => Promise<unknown>> = {
	conditions: () => spellApi.getConditions(),
	diseases: () => spellApi.getDiseases(),
	senses: () => spellApi.getSenses(),
	skills: () => spellApi.getSkills(),
	variantrules: () => spellApi.getVariantRules(),
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
const EMBEDDED_BROWSER_TAB_IDS = new Set<ReferenceTabId>(["spells"]);
const EMPTY_ITEMS: UiReferenceItem[] = [];

function isEditableTarget(target: EventTarget | null) {
	if (!(target instanceof HTMLElement)) return false;
	return Boolean(
		target.closest("input, textarea, select, [contenteditable='true']"),
	);
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
	const canNavigateBack = navigationHistory.index > 0;
	const canNavigateForward =
		navigationHistory.index >= 0 &&
		navigationHistory.index < navigationHistory.entries.length - 1;

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
		setSelectedByTab((current) =>
			current[tabId] === "" ? current : { ...current, [tabId]: "" },
		);
	}, []);

	useEffect(() => {
		isMountedRef.current = true;
		setRulesReferenceModalOpen(true);
		return () => {
			isMountedRef.current = false;
			setRulesReferenceModalOpen(false);
		};
	}, []);

	useEffect(() => {
		if (!navigationRequest?.requestId) return;
		if (handledNavigationRequestIdRef.current === navigationRequest.requestId) {
			return;
		}

		handledNavigationRequestIdRef.current = navigationRequest.requestId;
		if (navigationRequest.forceTab && !navigationRequest.name) {
			applyTabOnlyNavigation(navigationRequest.tabId);
			return;
		}
		navigateToReference(navigationRequest.tabId, navigationRequest.name);
	}, [applyTabOnlyNavigation, navigateToReference, navigationRequest]);

	useEffect(() => {
		if (hasInitializedNavigationRef.current) return;
		hasInitializedNavigationRef.current = true;

		if (forceTab) {
			applyTabOnlyNavigation(getInitialTabId(initialTab));
			if (initialName) {
				navigateToReference(getInitialTabId(initialTab), initialName);
			}
			return;
		}

		const currentEntry = navigationHistory.entries[navigationHistory.index];
		const nextTabId = getInitialTabId(initialTab);
		if (initialName) {
			shouldScrollToActiveRef.current = true;
			pendingNavigationTabRef.current = null;
			setActiveTabId(nextTabId);
			setSelectedByTab((current) => ({
				...current,
				[nextTabId]: initialName,
			}));
			recordNavigation(nextTabId, initialName);
			return;
		}

		if (currentEntry) {
			applyNavigationEntry(currentEntry);
			return;
		}

		setActiveTabId(nextTabId);
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
		const tabsToLoad = isGlobalSearch
			? REFERENCE_TABS.filter(
					(tab) => !itemsByTab[tab.id] && !requestedTabsRef.current.has(tab.id),
				)
			: !itemsByTab[activeTab.id] && !requestedTabsRef.current.has(activeTab.id)
				? [activeTab]
				: [];

		if (!tabsToLoad.length) return undefined;

		const loadItems = async (tab: ReferenceTab) => {
			requestedTabsRef.current.add(tab.id);
			setLoadingByTab((current) => ({ ...current, [tab.id]: true }));
			try {
				const list = await tab.load();
				if (!isMountedRef.current) return;

				const normalizedList = normalizeReferenceList(list) as UiReferenceItem[];
				setItemsByTab((current) => ({
					...current,
					[tab.id]: normalizedList,
				}));
				setSelectedByTab((current) => {
					if (current[tab.id]) return current;
					if (EMBEDDED_BROWSER_TAB_IDS.has(tab.id)) return current;
					return {
						...current,
						[tab.id]: getReferenceSelectionName(tab.id, normalizedList[0]),
					};
				});
			} catch (error: unknown) {
				requestedTabsRef.current.delete(tab.id);
				if (!isMountedRef.current) return;

				dispatch(
					alert({
						title: lang.t("Error"),
						message: error instanceof Error ? error.message : lang.t("Unknown error"),
					}),
				);
			} finally {
				if (isMountedRef.current) {
					setLoadingByTab((current) => ({ ...current, [tab.id]: false }));
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
		if (!hasLoadedActiveTab || isLoading) return;
		if (EMBEDDED_BROWSER_TAB_IDS.has(activeTab.id)) return;

		const selectedItemExists = activeItems.some((item) =>
			itemMatchesSelectedName(activeTab.id, item, activeSelectedName),
		);
		if (selectedItemExists) return;

		if (!filteredItems.length) {
			setSelectedByTab((current) => {
				if (!current[activeTab.id]) return current;
				return { ...current, [activeTab.id]: "" };
			});
			return;
		}

		const hasSelection = filteredItems.some((item) =>
			itemMatchesSelectedName(activeTab.id, item, activeSelectedName),
		);
		if (!hasSelection) {
			setSelectedByTab((current) => ({
				...current,
				[activeTab.id]: getReferenceSelectionName(
					activeTab.id,
					filteredItems[0],
				),
			}));
		}
	}, [
		activeSelectedName,
		activeTab.id,
		activeItems,
		filteredItems,
		hasLoadedActiveTab,
		isLoading,
	]);

	useEffect(() => {
		if (!hasLoadedActiveTab || isLoading || !activeSelectedName) return;
		if (!shouldScrollToActiveRef.current) return;

		const activeItem = findSelectedReferenceItem(
			activeTab.id,
			filteredItems,
			activeSelectedName,
		);
		const activeIndex = activeItem ? filteredItems.indexOf(activeItem) : -1;
		shouldScrollToActiveRef.current = false;
		if (activeIndex >= 0) {
			setTimeout(() => listRef.current?.scrollTo(activeIndex), 0);
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
			if (event.key !== "Backspace") return;
			if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
				return;
			if (isEditableTarget(event.target)) return;
			if (!canNavigateBack) return;

			event.preventDefault();
			navigateHistory(-1);
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [canNavigateBack, navigateHistory]);

	const selectedItem = resolveSelectedItem(activeTab.id, filteredItems, activeItems, activeSelectedName);
	const selectedMeta = selectedItem && activeTab.meta ? activeTab.meta(selectedItem) : "";

	const selectTab = (tabId: ReferenceTabId) => {
		shouldScrollToActiveRef.current = false;
		const nextName =
			selectedByTab[tabId] ||
			getReferenceSelectionName(tabId, (itemsByTab[tabId] || EMPTY_ITEMS)[0]) ||
			"";
		if (nextName && !EMBEDDED_BROWSER_TAB_IDS.has(tabId)) {
			pendingNavigationTabRef.current = null;
			recordNavigation(tabId, nextName);
		} else if (selectedByTab[tabId]) {
			pendingNavigationTabRef.current = null;
			recordNavigation(tabId, selectedByTab[tabId]);
		} else {
			pendingNavigationTabRef.current = tabId;
		}
		setActiveTabId(tabId);
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
				meta={activeTab.meta?.(item)}
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
			selectedMeta={selectedMeta || ""}
			canInsertReference={Boolean(onSelectReference)}
			listRef={listRef}
			renderReferenceItem={renderReferenceItem}
			onNavigateHistory={navigateHistory}
			onQueryChange={setQuery}
			onToggleDetailedSearch={() => setIsDetailedSearch((value) => !value)}
			onSelectTab={selectTab}
			onEmbeddedSelection={recordEmbeddedReferenceSelection}
			onSelectSpell={onSelectReference ? selectSpellReference : null}
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
