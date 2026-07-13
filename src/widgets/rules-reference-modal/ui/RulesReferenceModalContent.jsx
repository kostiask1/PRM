import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactList from "react-list";

import { alert } from "../../../shared/model/index.js";
import { bestiaryApi, MonsterStatBlockModel } from "../../../entities/bestiary/index.js";
import { spellApi } from "../../../entities/spell/index.js";
import "../../../assets/components/Bestiary.css";
import "../../../assets/components/RulesReferenceModalContent.css";
import { ListCard } from "../../../shared/ui/index.js";
import { Button, Tooltip } from "../../../shared/ui/index.js";
import { Input } from "../../../features/editor/ui/index.js";
import { MonsterStatBlock } from "../../monster-stat-block/index.js";
import { SpellsBrowser } from "../../spells-browser/index.js";
import { renderRecursiveContent } from "../../../features/rich-content/index.js";
import { lang } from "../../../shared/lib/index.js";
import {
	recordRulesReferenceHistoryEntry,
	setRulesReferenceHistoryIndex,
	setRulesReferenceModalOpen,
	useAppDispatch,
	useAppSelector,
} from "../../../shared/model/index.js";
import { objectMatchesSearch } from "../../../shared/lib/index.js";
import { getMonsterTypeString } from "../../../entities/bestiary/index.js";
import { highlightText } from "../../../shared/ui/index.js";
import {
	formatSourceLabel,
	getSourceFullName,
	getSpellMeta as formatSpellMeta,
} from "../../../entities/reference/index.js";

const VARIANT_RULE_TYPE_LABELS = {
	C: "Core Rule",
	O: "Optional Rule",
	V: "Variant Rule",
	VO: "Variant Optional Rule",
};

function getVariantRuleTypeLabel(ruleType) {
	return lang.t(VARIANT_RULE_TYPE_LABELS[ruleType] || ruleType || "");
}

function getSpellMeta(spell = {}) {
	return formatSpellMeta(spell, " · ");
}

function getMonsterMeta(monster = {}) {
	const crValue = monster.cr?.cr !== undefined ? monster.cr.cr : monster.cr;
	return [formatSourceLabel(monster.source), crValue ? `CR ${crValue}` : ""]
		.filter(Boolean)
		.join(" / ");
}

function getMonsterCr(monster = {}) {
	return monster.cr?.cr !== undefined ? monster.cr.cr : monster.cr;
}

function getSearchValues(tab, item) {
	const fieldValues = tab.searchFields.map((field) => item?.[field]);
	const metaValue = tab.meta?.(item);
	return [...fieldValues, metaValue].filter(Boolean);
}

function itemMatchesQuery(tab, item, normalizedQuery, isDetailedSearch) {
	if (!normalizedQuery) return true;
	if (isDetailedSearch) {
		return (
			objectMatchesSearch(item, normalizedQuery) ||
			getSearchValues(tab, item).some((value) =>
				String(value).toLowerCase().includes(normalizedQuery),
			)
		);
	}

	return getSearchValues(tab, item).some((value) =>
		String(value).toLowerCase().includes(normalizedQuery),
	);
}

async function loadSpellReferenceItems() {
	return spellApi.getSpellData("all");
}

async function loadBestiaryReferenceItems() {
	const [officialData, customData] = await Promise.all([
		bestiaryApi.getBestiaryData("all"),
		bestiaryApi.getCustomBestiaryData().catch(() => []),
	]);
	const officialList = Array.isArray(officialData)
		? officialData
		: officialData?.monster ||
			officialData?.monsters ||
			officialData?.results ||
			[];
	const customList = Array.isArray(customData)
		? customData
		: customData?.monster ||
			customData?.monsters ||
			customData?.results ||
			[];
	return [...officialList, ...customList];
}

const REFERENCE_TABS = [
	{
		id: "conditions",
		label: "Conditions",
		emptyLabel: "No conditions or statuses found.",
		load: () => spellApi.getConditions(),
		searchFields: ["name"],
	},
	{
		id: "diseases",
		label: "Diseases",
		emptyLabel: "No diseases found.",
		load: () => spellApi.getDiseases(),
		searchFields: ["name", "type"],
		meta: (item) => item.type || "",
	},
	{
		id: "senses",
		label: "Senses",
		emptyLabel: "No senses found.",
		load: () => spellApi.getSenses(),
		searchFields: ["name"],
	},
	{
		id: "skills",
		label: "Skills",
		emptyLabel: "No skills found.",
		load: () => spellApi.getSkills(),
		searchFields: ["name", "ability"],
		meta: (item) => item.ability?.toUpperCase?.() || "",
	},
	{
		id: "variantrules",
		label: "Variant Rules",
		emptyLabel: "No variant rules found.",
		load: () => spellApi.getVariantRules(),
		searchFields: ["name", "ruleType"],
		meta: (item) => getVariantRuleTypeLabel(item.ruleType),
	},
	{
		id: "spells",
		label: "Spells",
		emptyLabel: "No spells found.",
		load: loadSpellReferenceItems,
		searchFields: ["name", "school", "source", "level", "level_int"],
		meta: getSpellMeta,
	},
	{
		id: "bestiary",
		label: "Bestiary",
		emptyLabel: "No creatures found.",
		load: loadBestiaryReferenceItems,
		searchFields: ["name", "source", "cr"],
		meta: getMonsterMeta,
	},
];

const TAB_BY_ID = new Map(REFERENCE_TABS.map((tab) => [tab.id, tab]));
const EMBEDDED_BROWSER_TAB_IDS = new Set(["spells"]);
const EMPTY_ITEMS = [];

function normalizeList(list) {
	return Array.isArray(list) ? list : [];
}

function getInitialTabId(initialTab = "") {
	return TAB_BY_ID.has(initialTab) ? initialTab : REFERENCE_TABS[0].id;
}

function getReferenceItemKey(tabId, item) {
	return `${tabId}:${item.source || ""}:${item.name}`;
}

function getSpellReferenceName(spell = {}) {
	const name = String(spell.name || "").trim();
	if (!name) return "";
	const source = String(spell.source || "").trim();
	return source ? `${name}|${source}` : name;
}

function getReferenceInlineTag(tabId, item = {}) {
	const name = String(item.name || "").trim();
	if (!name) return "";
	if (tabId === "conditions") {
		const tagType = item.kind === "status" ? "status" : "condition";
		return `{@${tagType} ${name}}`;
	}
	if (tabId === "diseases") return `{@disease ${name}}`;
	if (tabId === "senses") return `{@sense ${name}}`;
	if (tabId === "skills") return `{@skill ${name}}`;
	if (tabId === "variantrules") return `{@variantrule ${name}}`;
	if (tabId === "spells") return `{@spell ${getSpellReferenceName(item)}}`;
	if (tabId === "bestiary") {
		const source = String(item.source || "").trim();
		return source ? `{@creature ${name}|${source}}` : `{@creature ${name}}`;
	}
	return name;
}

function getCreatureReferenceName(monster = {}) {
	const name = String(monster.name || "").trim();
	if (!name) return "";
	const source = String(monster.source || "").trim();
	return source ? `${name}|${source}` : name;
}

function normalizeCreatureReferenceName(value) {
	const [name = "", source = ""] = String(value || "").split("|");
	const normalizedName = name.trim();
	if (!normalizedName) return "";
	const normalizedSource = source.trim();
	return normalizedSource
		? `${normalizedName}|${normalizedSource}`
		: normalizedName;
}

function parseCreatureReference(value) {
	const [name = "", source = ""] = normalizeCreatureReferenceName(value).split(
		"|",
	);
	return {
		name: name.trim().toLowerCase(),
		source: source.trim().toUpperCase(),
	};
}

function getCreatureReferenceMatchRank(item, selectedName) {
	const selected = parseCreatureReference(selectedName);
	const itemReference = parseCreatureReference(getCreatureReferenceName(item));
	if (!selected.name || itemReference.name !== selected.name) return 0;
	if (!selected.source) return 2;
	return itemReference.source === selected.source ? 3 : 1;
}

function findSelectedReferenceItem(tabId, items, selectedName) {
	if (tabId !== "bestiary") {
		return (
			items.find((item) => getReferenceSelectionName(tabId, item) === selectedName) ||
			items.find((item) => String(item?.name || "") === selectedName) ||
			null
		);
	}

	let bestMatch = null;
	let bestRank = 0;
	for (const item of items) {
		const rank = getCreatureReferenceMatchRank(item, selectedName);
		if (rank > bestRank) {
			bestMatch = item;
			bestRank = rank;
		}
		if (rank === 3) break;
	}
	return bestMatch;
}

function getReferenceSelectionName(tabId, item = {}) {
	if (tabId === "spells") return getSpellReferenceName(item);
	if (tabId === "bestiary") return getCreatureReferenceName(item);
	return String(item?.name || "");
}

function itemMatchesSelectedName(tabId, item, selectedName) {
	const normalizedSelected = String(selectedName || "").trim();
	if (!normalizedSelected) return false;
	if (tabId === "bestiary") {
		return getCreatureReferenceMatchRank(item, normalizedSelected) > 0;
	}
	if (getReferenceSelectionName(tabId, item) === normalizedSelected) return true;
	return String(item?.name || "") === normalizedSelected;
}

function isEditableTarget(target) {
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
}) {
	const dispatch = useAppDispatch();
	const navigationRequest = useAppSelector(
		(state) => state.rulesReference.navigationRequest,
	);
	const navigationHistory = useAppSelector(
		(state) => state.rulesReference.history,
	);
	const listRef = useRef(null);
	const isMountedRef = useRef(false);
	const requestedTabsRef = useRef(new Set());
	const handledNavigationRequestIdRef = useRef(null);
	const hasInitializedNavigationRef = useRef(false);
	const shouldScrollToActiveRef = useRef(false);
	const pendingNavigationTabRef = useRef(null);
	const [activeTabId, setActiveTabId] = useState(getInitialTabId(initialTab));
	const [query, setQuery] = useState("");
	const [isDetailedSearch, setIsDetailedSearch] = useState(false);
	const [itemsByTab, setItemsByTab] = useState({});
	const [selectedByTab, setSelectedByTab] = useState({});
	const [loadingByTab, setLoadingByTab] = useState({});

	const activeTab = TAB_BY_ID.get(activeTabId) || REFERENCE_TABS[0];
	const hasLoadedActiveTab = Object.prototype.hasOwnProperty.call(
		itemsByTab,
		activeTab.id,
	);
	const activeItems = itemsByTab[activeTab.id] || EMPTY_ITEMS;
	const activeSelectedName = selectedByTab[activeTab.id] || "";
	const isLoading = Boolean(loadingByTab[activeTab.id]);
	const normalizedQuery = query.trim().toLowerCase();
	const isGlobalSearch = Boolean(normalizedQuery);
	const canNavigateBack = navigationHistory.index > 0;
	const canNavigateForward =
		navigationHistory.index >= 0 &&
		navigationHistory.index < navigationHistory.entries.length - 1;

	const recordNavigation = useCallback((tabId, name) => {
		if (!tabId || !name) return;
		recordRulesReferenceHistoryEntry(tabId, name);
	}, []);

	const applyNavigationEntry = useCallback((entry) => {
		if (!entry) return;
		shouldScrollToActiveRef.current = true;
		pendingNavigationTabRef.current = null;
		setActiveTabId(entry.tabId);
		setSelectedByTab((current) => ({
			...current,
			[entry.tabId]: entry.name,
		}));
	}, []);

	const navigateHistory = useCallback(
		(direction) => {
			const nextIndex = navigationHistory.index + direction;
			const nextEntry = navigationHistory.entries[nextIndex];
			if (!nextEntry) return;

			setRulesReferenceHistoryIndex(nextIndex);
			applyNavigationEntry(nextEntry);
		},
		[applyNavigationEntry, navigationHistory],
	);

	const navigateToReference = useCallback(
		(tabId, name) => {
			if (!TAB_BY_ID.has(tabId) || !name) return;

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

	const applyTabOnlyNavigation = useCallback((tabId) => {
		if (!TAB_BY_ID.has(tabId)) return;

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

		const loadItems = async (tab) => {
			requestedTabsRef.current.add(tab.id);
			setLoadingByTab((current) => ({ ...current, [tab.id]: true }));
			try {
				const list = await tab.load();
				if (!isMountedRef.current) return;

				const normalizedList = normalizeList(list);
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
			} catch (error) {
				requestedTabsRef.current.delete(tab.id);
				if (!isMountedRef.current) return;

				dispatch(
					alert({
						title: lang.t("Error"),
						message: error.message || lang.t("Unknown error"),
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
		return REFERENCE_TABS.reduce((result, tab) => {
			const items = itemsByTab[tab.id] || EMPTY_ITEMS;
			result[tab.id] = items.filter((item) =>
				itemMatchesQuery(tab, item, normalizedQuery, isDetailedSearch),
			);
			return result;
		}, {});
	}, [itemsByTab, normalizedQuery, isDetailedSearch]);

	const filteredItems = filteredItemsByTab[activeTab.id] || EMPTY_ITEMS;
	const tabsWithSearchMatches = useMemo(() => {
		if (!normalizedQuery) return new Set();

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
		const handleKeyDown = (event) => {
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

	const selectedItem =
		findSelectedReferenceItem(activeTab.id, filteredItems, activeSelectedName) ||
		findSelectedReferenceItem(activeTab.id, activeItems, activeSelectedName) ||
		null;
	const selectedMeta = selectedItem ? activeTab.meta?.(selectedItem) : "";

	const selectTab = (tabId) => {
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

	const selectItem = (name) => {
		shouldScrollToActiveRef.current = false;
		pendingNavigationTabRef.current = null;
		recordNavigation(activeTab.id, name);
		setSelectedByTab((current) => ({ ...current, [activeTab.id]: name }));
	};

	const selectSpellReference = (spell) => {
		if (!spell?.name || !onSelectReference) return;
		onSelectReference({
			tabId: "spells",
			item: spell,
			name: spell.name,
			tag: getReferenceInlineTag("spells", spell),
		});
	};

	const recordEmbeddedReferenceSelection = useCallback(
		(tabId, name) => {
			if (!TAB_BY_ID.has(tabId) || !name) return;
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

	const insertReference = (tabId, item) => {
		if (!item?.name || !onSelectReference) return;
		onSelectReference({
			tabId,
			item,
			name: item.name,
			tag: getReferenceInlineTag(tabId, item),
		});
	};

	const renderReferenceItem = (index) => {
		const item = filteredItems[index];
		if (!item) return null;
		const meta = activeTab.meta?.(item);
		const selectionName = getReferenceSelectionName(activeTab.id, item);
		const isActive = selectedItem === item;
		const handleClick = () => {
			selectItem(selectionName);
		};
		const isBestiaryItem = activeTab.id === "bestiary";
		const tokenSrc = isBestiaryItem
			? item.imageUrl || new MonsterStatBlockModel(item).localTokenSrc
			: "";
		const sourceFullName = isBestiaryItem ? getSourceFullName(item.source) : "";
		const crValue = isBestiaryItem ? getMonsterCr(item) : "";

		return (
			<div
				key={getReferenceItemKey(activeTab.id, item)}
				onDoubleClick={() => insertReference(activeTab.id, item)}
			>
				<ListCard onClick={handleClick} active={isActive}>
					{isBestiaryItem ? (
						<div className="Bestiary__item_content">
							<img
								className="Bestiary__item_token"
								src={tokenSrc}
								alt=""
								loading="lazy"
								draggable={false}
								onError={(event) => {
									event.currentTarget.hidden = true;
								}}
							/>
							<div className="Bestiary__item_info">
								<div className="ListCard__title">
									{highlightText(item.name, query)}
								</div>
								<div className="ListCard__meta">
									{highlightText(
										Array.isArray(item.size) ? item.size[0] : item.size,
										query,
									)}{" "}
									{highlightText(getMonsterTypeString(item.type), query)}
									{item.source && (
										<Tooltip
											content={sourceFullName}
											disabled={!sourceFullName}
										>
											<span className="Bestiary__item_source">
												{" "}
												• {highlightText(item.source, query)}
											</span>
										</Tooltip>
									)}
								</div>
							</div>
							<Tooltip content={lang.t("Challenge Rating")}>
								<div className="Bestiary__item_cr">
									<div className="Bestiary__cr_label">CR</div>
									<div className="Bestiary__cr_value">{crValue || "--"}</div>
								</div>
							</Tooltip>
						</div>
					) : (
						<>
							<div className="ListCard__title">
								{highlightText(item.name, query)}
							</div>
							{meta && (
								<div className="ListCard__meta">
									{highlightText(meta, query)}
								</div>
							)}
						</>
					)}
				</ListCard>
			</div>
		);
	};

	return (
		<div className="RulesReferenceModalContent RulesReferenceModalContent__withTabs">
			<div className="RulesReferenceModalContent__search">
				<div className="RulesReferenceModalContent__nav">
					<Button
						variant="ghost"
						size={Button.SIZES.SMALL}
						icon="back"
						onClick={() => navigateHistory(-1)}
						disabled={!canNavigateBack}
						title={lang.t("Back")}
						className="RulesReferenceModalContent__nav_btn"
					/>
					<Button
						variant="ghost"
						size={Button.SIZES.SMALL}
						icon="forward"
						onClick={() => navigateHistory(1)}
						disabled={!canNavigateForward}
						title={lang.t("Forward")}
						className="RulesReferenceModalContent__nav_btn"
					/>
				</div>
				<Input
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder={lang.t("Search")}
					autoFocus
				/>
				<Button
					variant={isDetailedSearch ? "primary" : "ghost"}
					icon="search-detailed"
					onClick={() => setIsDetailedSearch((value) => !value)}
					title={lang.t("Detailed search")}
					className="DetailedSearchButton RulesReferenceModalContent__detailed_search_btn"
				/>
			</div>

			<div className="RulesReferenceModalContent__tabs" role="tablist">
				{REFERENCE_TABS.map((tab) => (
					<button
						key={tab.id}
						type="button"
						role="tab"
						aria-selected={activeTab.id === tab.id}
						className={[
							"RulesReferenceModalContent__tab",
							activeTab.id === tab.id
								? "RulesReferenceModalContent__tab__active"
								: "",
							tabsWithSearchMatches.has(tab.id)
								? "RulesReferenceModalContent__tab__hasMatches"
								: "",
						]
							.filter(Boolean)
							.join(" ")}
						onClick={() => selectTab(tab.id)}
					>
						{lang.t(tab.label)}
					</button>
				))}
			</div>

			{activeTab.id === "spells" ? (
				<div className="RulesReferenceModalContent__spellBrowser">
					<SpellsBrowser
						hideSearchInput
						initialSearch={query}
						initialDetailedSearch={isDetailedSearch}
						initialSelectedName={activeSelectedName}
						onActiveSpellChange={(spell) =>
							recordEmbeddedReferenceSelection(
								"spells",
								getSpellReferenceName(spell),
							)
						}
						onSelectSpell={onSelectReference ? selectSpellReference : null}
						renderOptions={{
							openSpellInNestedModal: false,
						}}
					/>
				</div>
			) : (
				<div className="RulesReferenceModalContent__main">
					<div className="RulesReferenceModalContent__sidebar">
						<div className="RulesReferenceModalContent__list">
							{isLoading ? (
								<p className="muted">{lang.t("Loading...")}</p>
							) : filteredItems.length ? (
								<ReactList
									key={`${activeTab.id}:${normalizedQuery}:${isDetailedSearch ? "detailed" : "simple"}`}
									ref={listRef}
									itemRenderer={renderReferenceItem}
									length={filteredItems.length}
									type="uniform"
								/>
							) : (
								<p className="muted">{lang.t(activeTab.emptyLabel)}</p>
							)}
						</div>
					</div>

					<div className="RulesReferenceModalContent__content">
						{selectedItem && (
							<>
								<div className="RulesReferenceModalContent__contentHeader">
									<h3 className="RulesReferenceModalContent__title">
										{highlightText(selectedItem.name, query)}
									</h3>
									{selectedMeta && (
										<div className="muted">
											{highlightText(selectedMeta, query)}
										</div>
									)}
									{onSelectReference && (
										<div className="RulesReferenceModalContent__contentActions">
											<Button
												variant="primary"
												icon="plus"
												onClick={() =>
													insertReference(activeTab.id, selectedItem)
												}
											>
												{lang.t("Insert")}
											</Button>
										</div>
									)}
								</div>

								<div
									key={getReferenceItemKey(activeTab.id, selectedItem)}
									className="RulesReferenceModalContent__entryContent"
								>
									{activeTab.id === "bestiary" ? (
										<MonsterStatBlock
											monster={selectedItem}
											allowTokenUpload={false}
											showFavoriteAction={false}
											searchHighlight={query}
										/>
									) : (
										renderRecursiveContent(selectedItem.entries, query, {
											openSpellInNestedModal: true,
										})
									)}
								</div>
							</>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
