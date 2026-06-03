import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactList from "react-list";

import { alert } from "../../actions/app";
import { api } from "../../api";
import "../../assets/components/RulesReferenceModalContent.css";
import ListCard from "../common/ListCard.jsx";
import Button from "../form/Button.jsx";
import Input from "../form/Input";
import { renderRecursiveContent } from "../../renderers/contentRenderer.jsx";
import { lang } from "../../services/localization";
import { useAppDispatch } from "../../store/appStore";
import { objectMatchesSearch } from "../../utils/deepSearch.js";
import { highlightText } from "../../utils/searchHighlight.jsx";

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
	const level =
		spell.level_int !== undefined
			? spell.level_int
			: spell.level !== undefined
				? spell.level
				: "";
	const levelLabel =
		level === 0 || String(level) === "0"
			? lang.t("Cantrip")
			: level !== ""
				? lang.t("Level {level}", { level })
				: "";
	return [levelLabel, spell.school, spell.source].filter(Boolean).join(" · ");
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

const REFERENCE_TABS = [
	{
		id: "conditions",
		label: "Conditions",
		emptyLabel: "No conditions or statuses found.",
		load: () => api.getConditions(),
		searchFields: ["name"],
	},
	{
		id: "diseases",
		label: "Diseases",
		emptyLabel: "No diseases found.",
		load: () => api.getDiseases(),
		searchFields: ["name", "type"],
		meta: (item) => item.type || "",
	},
	{
		id: "senses",
		label: "Senses",
		emptyLabel: "No senses found.",
		load: () => api.getSenses(),
		searchFields: ["name"],
	},
	{
		id: "skills",
		label: "Skills",
		emptyLabel: "No skills found.",
		load: () => api.getSkills(),
		searchFields: ["name", "ability"],
		meta: (item) => item.ability?.toUpperCase?.() || "",
	},
	{
		id: "variantrules",
		label: "Variant Rules",
		emptyLabel: "No variant rules found.",
		load: () => api.getVariantRules(),
		searchFields: ["name", "ruleType"],
		meta: (item) => getVariantRuleTypeLabel(item.ruleType),
	},
	{
		id: "spells",
		label: "Spells",
		emptyLabel: "No spells found.",
		load: () => api.searchSpells(),
		searchFields: ["name", "school", "source", "level", "level_int"],
		meta: getSpellMeta,
	},
];

const TAB_BY_ID = new Map(REFERENCE_TABS.map((tab) => [tab.id, tab]));
const EMPTY_ITEMS = [];

function normalizeList(list) {
	return Array.isArray(list) ? list : [];
}

function getInitialTabId(initialTab = "") {
	return TAB_BY_ID.has(initialTab) ? initialTab : REFERENCE_TABS[0].id;
}

function getReferenceItemKey(tabId, item) {
	return `${tabId}:${item.name}`;
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
	if (tabId === "spells") return `{@spell ${name}}`;
	return name;
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
	onSelectReference = null,
}) {
	const dispatch = useAppDispatch();
	const listRef = useRef(null);
	const isMountedRef = useRef(false);
	const requestedTabsRef = useRef(new Set());
	const shouldScrollToActiveRef = useRef(false);
	const pendingNavigationTabRef = useRef(null);
	const [activeTabId, setActiveTabId] = useState(getInitialTabId(initialTab));
	const [query, setQuery] = useState("");
	const [isDetailedSearch, setIsDetailedSearch] = useState(false);
	const [itemsByTab, setItemsByTab] = useState({});
	const [selectedByTab, setSelectedByTab] = useState({});
	const [loadingByTab, setLoadingByTab] = useState({});
	const [navigationHistory, setNavigationHistory] = useState({
		entries: [],
		index: -1,
	});

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

		setNavigationHistory((current) => {
			const nextEntry = { tabId, name };
			const currentEntry = current.entries[current.index];
			if (
				currentEntry?.tabId === nextEntry.tabId &&
				currentEntry?.name === nextEntry.name
			) {
				return current;
			}

			const entries = current.entries
				.slice(0, current.index + 1)
				.concat(nextEntry);
			return {
				entries,
				index: entries.length - 1,
			};
		});
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

			setNavigationHistory((current) => ({ ...current, index: nextIndex }));
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

	useEffect(() => {
		isMountedRef.current = true;
		return () => {
			isMountedRef.current = false;
		};
	}, []);

	useEffect(() => {
		const nextTabId = getInitialTabId(initialTab);
		setActiveTabId(nextTabId);
		if (initialName) {
			shouldScrollToActiveRef.current = true;
			setSelectedByTab((current) => ({
				...current,
				[nextTabId]: initialName,
			}));
		}
	}, [initialName, initialTab]);

	useEffect(() => {
		if (!activeSelectedName) return;

		setNavigationHistory((current) => {
			if (current.entries.length) return current;
			return {
				entries: [{ tabId: activeTab.id, name: activeSelectedName }],
				index: 0,
			};
		});
	}, [activeSelectedName, activeTab.id]);

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
					return {
						...current,
						[tab.id]: normalizedList[0]?.name || "",
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

		const selectedItemExists = activeItems.some(
			(item) => item.name === activeSelectedName,
		);
		if (selectedItemExists) return;

		if (!filteredItems.length) {
			setSelectedByTab((current) => {
				if (!current[activeTab.id]) return current;
				return { ...current, [activeTab.id]: "" };
			});
			return;
		}

		const hasSelection = filteredItems.some(
			(item) => item.name === activeSelectedName,
		);
		if (!hasSelection) {
			setSelectedByTab((current) => ({
				...current,
				[activeTab.id]: filteredItems[0].name,
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

		const activeIndex = filteredItems.findIndex(
			(item) => item.name === activeSelectedName,
		);
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
		filteredItems.find((item) => item.name === activeSelectedName) ||
		activeItems.find((item) => item.name === activeSelectedName) ||
		null;
	const selectedMeta = selectedItem ? activeTab.meta?.(selectedItem) : "";

	const selectTab = (tabId) => {
		shouldScrollToActiveRef.current = false;
		const nextName =
			selectedByTab[tabId] || (itemsByTab[tabId] || EMPTY_ITEMS)[0]?.name || "";
		if (nextName) {
			pendingNavigationTabRef.current = null;
			recordNavigation(tabId, nextName);
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

	const renderReferenceItem = (index) => {
		const item = filteredItems[index];
		if (!item) return null;
		const meta = activeTab.meta?.(item);
		const isActive = activeSelectedName === item.name;
		const handleClick = () => {
			if (onSelectReference) {
				onSelectReference({
					tabId: activeTab.id,
					item,
					name: item.name,
					tag: getReferenceInlineTag(activeTab.id, item),
				});
				return;
			}
			selectItem(item.name);
		};

		return (
			<div key={getReferenceItemKey(activeTab.id, item)}>
				<ListCard onClick={handleClick} active={isActive}>
					<div className="ListCard__title">
						{highlightText(item.name, query)}
					</div>
					{meta && (
						<div className="ListCard__meta">{highlightText(meta, query)}</div>
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
							</div>

							<div
								key={getReferenceItemKey(activeTab.id, selectedItem)}
								className="RulesReferenceModalContent__entryContent"
							>
								{renderRecursiveContent(selectedItem.entries, query, {
									onRuleNavigate: navigateToReference,
									openSpellInNestedModal: true,
								})}
							</div>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
