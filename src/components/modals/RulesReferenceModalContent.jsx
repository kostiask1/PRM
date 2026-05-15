import { useEffect, useMemo, useRef, useState } from "react";
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
];

const TAB_BY_ID = new Map(REFERENCE_TABS.map((tab) => [tab.id, tab]));
const EMPTY_ITEMS = [];

function normalizeList(list) {
	return Array.isArray(list) ? list : [];
}

function getInitialTabId(initialTab = "") {
	return TAB_BY_ID.has(initialTab) ? initialTab : REFERENCE_TABS[0].id;
}

export default function RulesReferenceModalContent({
	initialTab = "conditions",
	initialName = "",
}) {
	const dispatch = useAppDispatch();
	const listRef = useRef(null);
	const isMountedRef = useRef(false);
	const requestedTabsRef = useRef(new Set());
	const shouldScrollToActiveRef = useRef(false);
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
		const tabsToLoad = isGlobalSearch
			? REFERENCE_TABS.filter(
					(tab) => !itemsByTab[tab.id] && !requestedTabsRef.current.has(tab.id),
				)
			: !itemsByTab[activeTab.id] &&
				  !requestedTabsRef.current.has(activeTab.id)
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

	const selectedItem =
		filteredItems.find((item) => item.name === activeSelectedName) ||
		activeItems.find((item) => item.name === activeSelectedName) ||
		null;
	const selectedMeta = selectedItem ? activeTab.meta?.(selectedItem) : "";

	const selectTab = (tabId) => {
		shouldScrollToActiveRef.current = false;
		setActiveTabId(tabId);
	};

	const selectItem = (name) => {
		shouldScrollToActiveRef.current = false;
		setSelectedByTab((current) => ({ ...current, [activeTab.id]: name }));
	};

	const renderReferenceItem = (index, key) => {
		const item = filteredItems[index];
		const meta = activeTab.meta?.(item);
		const isActive = activeSelectedName === item.name;

		return (
			<div key={key}>
				<ListCard onClick={() => selectItem(item.name)} active={isActive}>
					<div className="ListCard__title">{highlightText(item.name, query)}</div>
					{meta && (
						<div className="ListCard__meta">{highlightText(meta, query)}</div>
					)}
				</ListCard>
			</div>
		);
	};

	return (
		<div className="RulesReferenceModalContent RulesReferenceModalContent--withTabs">
			<div className="RulesReferenceModalContent__search">
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
					className="DetailedSearchButton RulesReferenceModalContent__detailed-search-btn"
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
								? "RulesReferenceModalContent__tab--active"
								: "",
							tabsWithSearchMatches.has(tab.id)
								? "RulesReferenceModalContent__tab--hasMatches"
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

							<div className="RulesReferenceModalContent__entryContent">
								{renderRecursiveContent(selectedItem.entries, query)}
							</div>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
