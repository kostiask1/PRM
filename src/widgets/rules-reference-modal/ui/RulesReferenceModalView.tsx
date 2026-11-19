import { useEffect, useId, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { formatSourceLabel, getSourceFullName, type ReferenceRecord } from "../../../entities/reference/index.js";
import ReactList from "react-list";
import type { BestiaryMonster } from "../../../entities/bestiary/index.js";
import { RollDice } from "../../../features/dice/index.js";
import { createRichContentRenderers } from "../../../features/rich-content/index.js";
import { createRulesLinkComponent } from "../../../features/rules-reference/index.js";
import { Input } from "../../../features/editor/ui/index.js";
import { lang } from "../../../shared/lib/index.js";
import { Button, highlightText, useRevealSelectedTab } from "../../../shared/ui/index.js";
import { getCreatureReferenceName, getReferenceItemKey, getSpellReferenceName, type ReferenceItem, type ReferenceTabId, type ReferenceTabPolicy } from "../model.js";
import type { SpellRecord } from "../../../entities/spell/index.js";
import type { RulesReferenceModalCompositionSlots } from "./rulesReferenceModalComposition.ts";

const RulesReferenceModalRulesLink = createRulesLinkComponent({ RollDice });
const rulesReferenceModalRichContent = createRichContentRenderers({
	RollDice,
	RulesLink: RulesReferenceModalRulesLink,
});
const renderRulesReferenceContent =
	rulesReferenceModalRichContent.renderRecursiveContent;

export interface ReferenceTabView extends ReferenceTabPolicy {
	meta?: (item: ReferenceItem) => string;
}

export interface RulesReferenceModalViewProps
	extends RulesReferenceModalCompositionSlots {
	activeTab: ReferenceTabView;
	tabs: ReferenceTabView[];
	query: string;
	isDetailedSearch: boolean;
	activeSelectedName: string;
	tabsWithSearchMatches: Set<ReferenceTabId>;
	canNavigateBack: boolean;
	canNavigateForward: boolean;
	isLoading: boolean;
	normalizedQuery: string;
	filteredItems: ReferenceItem[];
	selectedItem: ReferenceItem | null;
	selectedMeta: string;
	canInsertReference: boolean;
	selectionActionLabel?: string;
	listRef: React.RefObject<ReactList>;
	renderReferenceItem: (index: number) => ReactNode;
	onNavigateHistory: (direction: -1 | 1) => void;
	onQueryChange: (query: string) => void;
	onToggleDetailedSearch: () => void;
	onSelectTab: (tabId: ReferenceTabId) => void;
	onEmbeddedSelection: (tabId: ReferenceTabId, name: string) => void;
	onSelectBestiary: ((monster: BestiaryMonster) => void) | null;
	onSelectSpell: ((spell: SpellRecord) => void) | null;
	onInsertReference: (tabId: ReferenceTabId, item: ReferenceItem) => void;
}

function ReferenceSearch({ query, isDetailedSearch, canNavigateBack, canNavigateForward, onNavigateHistory, onQueryChange, onToggleDetailedSearch }: Pick<RulesReferenceModalViewProps, "query" | "isDetailedSearch" | "canNavigateBack" | "canNavigateForward" | "onNavigateHistory" | "onQueryChange" | "onToggleDetailedSearch">) {
	return (
		<div className="RulesReferenceModalContent__search">
			<div className="RulesReferenceModalContent__nav">
				<Button variant="ghost" size={Button.SIZES.SMALL} icon="back" aria-label={lang.t("Back")} onClick={() => onNavigateHistory(-1)} disabled={!canNavigateBack} title={lang.t("Back")} className="RulesReferenceModalContent__nav_btn" />
				<Button variant="ghost" size={Button.SIZES.SMALL} icon="forward" aria-label={lang.t("Forward")} onClick={() => onNavigateHistory(1)} disabled={!canNavigateForward} title={lang.t("Forward")} className="RulesReferenceModalContent__nav_btn" />
			</div>
			<Input aria-label={lang.t("Search")} value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={lang.t("Search")} />
			<Button variant={isDetailedSearch ? "primary" : "ghost"} icon="search-detailed" aria-label={lang.t("Detailed search")} aria-pressed={isDetailedSearch} onClick={onToggleDetailedSearch} title={lang.t("Detailed search")} className="DetailedSearchButton RulesReferenceModalContent__detailed_search_btn" />
		</div>
	);
}

function ReferenceTabs({ tabs, activeTab, tabsWithSearchMatches, onSelectTab, idPrefix }: Pick<RulesReferenceModalViewProps, "tabs" | "activeTab" | "tabsWithSearchMatches" | "onSelectTab"> & { idPrefix: string }) {
	const tabsRef = useRevealSelectedTab(activeTab.id);
	const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
		if (tabs.length === 0) return;
		const current = tabs.findIndex((tab) => tab.id === activeTab.id);
		let next: number;
		if (event.key === "ArrowRight") next = (current + 1) % tabs.length;
		else if (event.key === "ArrowLeft") next = (current + tabs.length - 1) % tabs.length;
		else if (event.key === "Home") next = 0;
		else if (event.key === "End") next = tabs.length - 1;
		else return;
		event.preventDefault();
		onSelectTab(tabs[next].id);
		event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
	};
	return (
		<div ref={tabsRef} className="RulesReferenceModalContent__tabs" role="tablist" aria-label={lang.t("Rules Reference")}>
			{tabs.map((tab) => (
				<button key={tab.id} type="button" role="tab" id={`${idPrefix}-tab-${tab.id}`} aria-controls={`${idPrefix}-panel`} aria-selected={activeTab.id === tab.id} tabIndex={activeTab.id === tab.id ? 0 : -1} aria-label={tabsWithSearchMatches.has(tab.id) ? `${lang.t(tab.label)} — ${lang.t("Contains search matches")}` : undefined} className={["RulesReferenceModalContent__tab", activeTab.id === tab.id ? "RulesReferenceModalContent__tab__active" : "", tabsWithSearchMatches.has(tab.id) ? "RulesReferenceModalContent__tab__hasMatches" : ""].filter(Boolean).join(" ")} onClick={() => onSelectTab(tab.id)} onKeyDown={handleKeyDown}>
					{lang.t(tab.label)}
				</button>
			))}
		</div>
	);
}

interface ReferenceDetailsHeaderProps
	extends Pick<
		RulesReferenceModalViewProps,
		| "activeTab"
		| "query"
		| "selectedItem"
		| "selectedMeta"
		| "canInsertReference"
		| "selectionActionLabel"
		| "onInsertReference"
	> {
	selectedItem: ReferenceItem;
	versions?: ReferenceRecord[] | null;
	selectedSource?: string;
	onSelectSource?: (source: string) => void;
}

function ReferenceDetailsHeader({
	activeTab,
	query,
	selectedItem,
	selectedMeta,
	canInsertReference,
	selectionActionLabel,
	onInsertReference,
	versions,
	selectedSource,
	onSelectSource,
}: ReferenceDetailsHeaderProps) {
	return (
		<div className="RulesReferenceModalContent__contentHeader">
			<div className="RulesReferenceModalContent__contentHeading">
				<h3 className="RulesReferenceModalContent__title">{highlightText(String(selectedItem.name || ""), query)}</h3>
				{selectedMeta && <div className="muted">{highlightText(selectedMeta, query)}</div>}
				{versions && versions.length > 1 && onSelectSource && (
					<div className="RulesReferenceModalContent__sources">
						<span className="RulesReferenceModalContent__sources-label">{lang.t("Source")}:</span>
						<div className="RulesReferenceModalContent__source-pills">
							{versions.map((ver) => {
								const verSource = String(ver.source || "");
								const isActive = verSource.toUpperCase() === selectedSource?.toUpperCase();
								return (
									<button
										key={verSource}
										type="button"
										className={`RulesReferenceModalContent__source-pill ${isActive ? "RulesReferenceModalContent__source-pill--active" : ""}`}
										onClick={() => onSelectSource(verSource)}
										title={getSourceFullName(verSource)}
									>
										{formatSourceLabel(verSource)}
									</button>
								);
							})}
						</div>
					</div>
				)}
			</div>
			{canInsertReference && (
				<div className="RulesReferenceModalContent__contentActions">
					<Button variant="primary" icon="plus" onClick={() => onInsertReference(activeTab.id, selectedItem)}>
						{selectionActionLabel || lang.t("Insert")}
					</Button>
				</div>
			)}
		</div>
	);
}

type ReferenceEntryProps = Pick<
	RulesReferenceModalViewProps,
	"MonsterStatBlock"
> & {
	item: ReferenceItem;
	query: string;
};

function BestiaryReferenceEntry({ MonsterStatBlock, item, query }: ReferenceEntryProps) {
	return <MonsterStatBlock monster={item as BestiaryMonster} allowTokenUpload={false} showFavoriteAction={false} searchHighlight={query} />;
}

function GenericReferenceEntry({ item, query }: ReferenceEntryProps) {
	return renderRulesReferenceContent(item.entries, query);
}

interface ReferenceDetailsProps
	extends Pick<
		RulesReferenceModalViewProps,
		| "activeTab"
		| "query"
		| "selectedItem"
		| "selectedMeta"
		| "canInsertReference"
		| "selectionActionLabel"
		| "onInsertReference"
		| "MonsterStatBlock"
	> {
	activeSelectedName?: string;
}

function ReferenceDetails({
	activeTab,
	query,
	selectedItem,
	selectedMeta,
	canInsertReference,
	selectionActionLabel,
	onInsertReference,
	MonsterStatBlock,
	activeSelectedName = "",
}: ReferenceDetailsProps) {
	const [selectedSource, setSelectedSource] = useState<string | null>(null);

	useEffect(() => {
		const requested = activeSelectedName?.includes("|")
			? activeSelectedName.split("|")[1].trim().toUpperCase()
			: null;
		setSelectedSource(requested);
	}, [selectedItem?.name, activeSelectedName]);

	const versions = useMemo(() => {
		const rawVersions = (selectedItem as Record<string, unknown> | null)?.versions;
		if (Array.isArray(rawVersions) && rawVersions.length > 0) {
			return rawVersions as ReferenceRecord[];
		}
		return null;
	}, [selectedItem]);

	const activeVersion = useMemo(() => {
		if (!versions || versions.length === 0) return null;
		if (selectedSource) {
			const match = versions.find((v) => String(v.source || "").toUpperCase() === selectedSource);
			if (match) return match;
		}
		return (
			versions.find((v) => String(v.source || "").toUpperCase() === String(selectedItem?.source || "").toUpperCase()) ||
			versions[0]
		);
	}, [versions, selectedSource, selectedItem?.source]);

	const displayedItem = useMemo(() => {
		if (!selectedItem) return null;
		if (!activeVersion) return selectedItem;
		return {
			...selectedItem,
			type: undefined,
			...activeVersion,
		};
	}, [selectedItem, activeVersion]);

	if (!selectedItem) return <div className="RulesReferenceModalContent__content" />;
	const targetItem: ReferenceItem = displayedItem || selectedItem;

	const Entry = activeTab.id === "bestiary" ? BestiaryReferenceEntry : GenericReferenceEntry;
	return (
		<div className="RulesReferenceModalContent__content">
			<ReferenceDetailsHeader
				activeTab={activeTab}
				query={query}
				selectedItem={targetItem}
				selectedMeta={activeTab.meta ? activeTab.meta(targetItem) : selectedMeta}
				canInsertReference={canInsertReference}
				selectionActionLabel={selectionActionLabel}
				onInsertReference={onInsertReference}
				versions={versions}
				selectedSource={String(targetItem.source || "")}
				onSelectSource={setSelectedSource}
			/>
			<div
				key={getReferenceItemKey(activeTab.id, targetItem) + (targetItem.source ? `:${targetItem.source}` : "")}
				className="RulesReferenceModalContent__entryContent"
			>
				<Entry MonsterStatBlock={MonsterStatBlock} item={targetItem} query={query} />
			</div>
		</div>
	);
}

function EmbeddedSpellReference({ query, isDetailedSearch, activeSelectedName, onEmbeddedSelection, onSelectSpell, SpellsBrowser }: Pick<RulesReferenceModalViewProps, "query" | "isDetailedSearch" | "activeSelectedName" | "onEmbeddedSelection" | "onSelectSpell" | "SpellsBrowser">) {
	return (
		<div className="RulesReferenceModalContent__spellBrowser">
			<SpellsBrowser hideSearchInput initialSearch={query} initialDetailedSearch={isDetailedSearch} initialSelectedName={activeSelectedName} onActiveSpellChange={(spell) => onEmbeddedSelection("spells", getSpellReferenceName(spell))} onSelectSpell={onSelectSpell} renderOptions={{}} />
		</div>
	);
}

function EmbeddedBestiaryReference({ query, isDetailedSearch, activeSelectedName, onEmbeddedSelection, onSelectBestiary, BestiaryBrowser }: Pick<RulesReferenceModalViewProps, "query" | "isDetailedSearch" | "activeSelectedName" | "onEmbeddedSelection" | "onSelectBestiary" | "BestiaryBrowser">) {
	return (
		<div className="RulesReferenceModalContent__bestiaryBrowser">
			<BestiaryBrowser
				hideSearchInput
				initialSearch={query}
				initialDetailedSearch={isDetailedSearch}
				initialSelectedName={activeSelectedName}
				onActiveMonsterChange={(monster) => onEmbeddedSelection("bestiary", getCreatureReferenceName(monster))}
				onSelectMonster={onSelectBestiary}
			/>
		</div>
	);
}

function ReferenceSidebar({ activeTab, isDetailedSearch, isLoading, normalizedQuery, filteredItems, listRef, renderReferenceItem }: Pick<RulesReferenceModalViewProps, "activeTab" | "isDetailedSearch" | "isLoading" | "normalizedQuery" | "filteredItems" | "listRef" | "renderReferenceItem">) {
	if (isLoading) return <p className="muted">{lang.t("Loading...")}</p>;
	if (!filteredItems.length) return <p className="muted">{lang.t(activeTab.emptyLabel)}</p>;
	const searchMode = isDetailedSearch ? "detailed" : "simple";
	return <ReactList key={`${activeTab.id}:${normalizedQuery}:${searchMode}`} ref={listRef} itemRenderer={renderReferenceItem} length={filteredItems.length} type="uniform" />;
}

function StandardReferenceLayout(props: Pick<RulesReferenceModalViewProps, "activeTab" | "query" | "isDetailedSearch" | "activeSelectedName" | "isLoading" | "normalizedQuery" | "filteredItems" | "selectedItem" | "selectedMeta" | "canInsertReference" | "selectionActionLabel" | "listRef" | "renderReferenceItem" | "onInsertReference" | "MonsterStatBlock">) {
	return (
		<div className="RulesReferenceModalContent__main">
			<div className="RulesReferenceModalContent__sidebar">
				<div className="RulesReferenceModalContent__list">
					<ReferenceSidebar {...props} />
				</div>
			</div>
			<ReferenceDetails {...props} />
		</div>
	);
}

export default function RulesReferenceModalView(props: RulesReferenceModalViewProps) {
	const tabsId = useId();
	const { activeTab, tabs, query, isDetailedSearch, activeSelectedName, tabsWithSearchMatches, canNavigateBack, canNavigateForward, isLoading, normalizedQuery, filteredItems, selectedItem, selectedMeta, canInsertReference, selectionActionLabel, listRef, renderReferenceItem, onNavigateHistory, onQueryChange, onToggleDetailedSearch, onSelectTab, onEmbeddedSelection, onSelectBestiary, onSelectSpell, onInsertReference, BestiaryBrowser, MonsterStatBlock, SpellsBrowser } = props;
	return (
		<div className="RulesReferenceModalContent RulesReferenceModalContent__withTabs">
			<ReferenceTabs idPrefix={tabsId} tabs={tabs} activeTab={activeTab} tabsWithSearchMatches={tabsWithSearchMatches} onSelectTab={onSelectTab} />
			<ReferenceSearch {...{ query, isDetailedSearch, canNavigateBack, canNavigateForward, onNavigateHistory, onQueryChange, onToggleDetailedSearch }} />
			<div className="RulesReferenceModalContent__panel" role="tabpanel" id={`${tabsId}-panel`} aria-labelledby={`${tabsId}-tab-${activeTab.id}`}>
			{activeTab.id === "bestiary" ? (
				<EmbeddedBestiaryReference {...{ query, isDetailedSearch, activeSelectedName, onEmbeddedSelection, onSelectBestiary, BestiaryBrowser }} />
			) : activeTab.id === "spells" ? (
				<EmbeddedSpellReference {...{ query, isDetailedSearch, activeSelectedName, onEmbeddedSelection, onSelectSpell, SpellsBrowser }} />
			) : (
				<StandardReferenceLayout {...{ activeTab, query, isDetailedSearch, activeSelectedName, isLoading, normalizedQuery, filteredItems, selectedItem, selectedMeta, canInsertReference, selectionActionLabel, listRef, renderReferenceItem, onInsertReference, MonsterStatBlock }} />
			)}
			</div>
		</div>
	);
}
