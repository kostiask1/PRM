import type { ReactNode } from "react";
import ReactList from "react-list";
import type { BestiaryMonster } from "../../../entities/bestiary/index.js";
import { renderRecursiveContent } from "../../../features/rich-content/index.js";
import { Input } from "../../../features/editor/ui/index.js";
import { lang } from "../../../shared/lib/index.js";
import { Button, highlightText } from "../../../shared/ui/index.js";
import { getReferenceItemKey, getSpellReferenceName, type ReferenceItem, type ReferenceTabId, type ReferenceTabPolicy } from "../model.js";
import type { SpellRecord } from "../../../entities/spell/index.js";
import type { RulesReferenceModalCompositionSlots } from "./rulesReferenceModalComposition.ts";

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
	listRef: React.RefObject<ReactList>;
	renderReferenceItem: (index: number) => ReactNode;
	onNavigateHistory: (direction: -1 | 1) => void;
	onQueryChange: (query: string) => void;
	onToggleDetailedSearch: () => void;
	onSelectTab: (tabId: ReferenceTabId) => void;
	onEmbeddedSelection: (tabId: ReferenceTabId, name: string) => void;
	onSelectSpell: ((spell: SpellRecord) => void) | null;
	onInsertReference: (tabId: ReferenceTabId, item: ReferenceItem) => void;
}

function ReferenceSearch({ query, isDetailedSearch, canNavigateBack, canNavigateForward, onNavigateHistory, onQueryChange, onToggleDetailedSearch }: Pick<RulesReferenceModalViewProps, "query" | "isDetailedSearch" | "canNavigateBack" | "canNavigateForward" | "onNavigateHistory" | "onQueryChange" | "onToggleDetailedSearch">) {
	return (
		<div className="RulesReferenceModalContent__search">
			<div className="RulesReferenceModalContent__nav">
				<Button variant="ghost" size={Button.SIZES.SMALL} icon="back" onClick={() => onNavigateHistory(-1)} disabled={!canNavigateBack} title={lang.t("Back")} className="RulesReferenceModalContent__nav_btn" />
				<Button variant="ghost" size={Button.SIZES.SMALL} icon="forward" onClick={() => onNavigateHistory(1)} disabled={!canNavigateForward} title={lang.t("Forward")} className="RulesReferenceModalContent__nav_btn" />
			</div>
			<Input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={lang.t("Search")} autoFocus />
			<Button variant={isDetailedSearch ? "primary" : "ghost"} icon="search-detailed" onClick={onToggleDetailedSearch} title={lang.t("Detailed search")} className="DetailedSearchButton RulesReferenceModalContent__detailed_search_btn" />
		</div>
	);
}

function ReferenceTabs({ tabs, activeTab, tabsWithSearchMatches, onSelectTab }: Pick<RulesReferenceModalViewProps, "tabs" | "activeTab" | "tabsWithSearchMatches" | "onSelectTab">) {
	return (
		<div className="RulesReferenceModalContent__tabs" role="tablist">
			{tabs.map((tab) => (
				<button key={tab.id} type="button" role="tab" aria-selected={activeTab.id === tab.id} className={["RulesReferenceModalContent__tab", activeTab.id === tab.id ? "RulesReferenceModalContent__tab__active" : "", tabsWithSearchMatches.has(tab.id) ? "RulesReferenceModalContent__tab__hasMatches" : ""].filter(Boolean).join(" ")} onClick={() => onSelectTab(tab.id)}>
					{lang.t(tab.label)}
				</button>
			))}
		</div>
	);
}

function ReferenceDetailsHeader({ activeTab, query, selectedItem, selectedMeta, canInsertReference, onInsertReference }: Pick<RulesReferenceModalViewProps, "activeTab" | "query" | "selectedItem" | "selectedMeta" | "canInsertReference" | "onInsertReference"> & { selectedItem: ReferenceItem }) {
	return (
		<div className="RulesReferenceModalContent__contentHeader">
			<h3 className="RulesReferenceModalContent__title">{highlightText(String(selectedItem.name || ""), query)}</h3>
			{selectedMeta && <div className="muted">{highlightText(selectedMeta, query)}</div>}
			{canInsertReference && <div className="RulesReferenceModalContent__contentActions"><Button variant="primary" icon="plus" onClick={() => onInsertReference(activeTab.id, selectedItem)}>{lang.t("Insert")}</Button></div>}
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
	return renderRecursiveContent(item.entries, query);
}

function ReferenceDetails({ activeTab, query, selectedItem, selectedMeta, canInsertReference, onInsertReference, MonsterStatBlock }: Pick<RulesReferenceModalViewProps, "activeTab" | "query" | "selectedItem" | "selectedMeta" | "canInsertReference" | "onInsertReference" | "MonsterStatBlock">) {
	if (!selectedItem) return <div className="RulesReferenceModalContent__content" />;
	const Entry = activeTab.id === "bestiary" ? BestiaryReferenceEntry : GenericReferenceEntry;
	return (
		<div className="RulesReferenceModalContent__content">
			<ReferenceDetailsHeader {...{ activeTab, query, selectedItem, selectedMeta, canInsertReference, onInsertReference }} />
			<div key={getReferenceItemKey(activeTab.id, selectedItem)} className="RulesReferenceModalContent__entryContent">
				<Entry MonsterStatBlock={MonsterStatBlock} item={selectedItem} query={query} />
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

function ReferenceSidebar({ activeTab, isDetailedSearch, isLoading, normalizedQuery, filteredItems, listRef, renderReferenceItem }: Pick<RulesReferenceModalViewProps, "activeTab" | "isDetailedSearch" | "isLoading" | "normalizedQuery" | "filteredItems" | "listRef" | "renderReferenceItem">) {
	if (isLoading) return <p className="muted">{lang.t("Loading...")}</p>;
	if (!filteredItems.length) return <p className="muted">{lang.t(activeTab.emptyLabel)}</p>;
	const searchMode = isDetailedSearch ? "detailed" : "simple";
	return <ReactList key={`${activeTab.id}:${normalizedQuery}:${searchMode}`} ref={listRef} itemRenderer={renderReferenceItem} length={filteredItems.length} type="uniform" />;
}

function StandardReferenceLayout(props: Pick<RulesReferenceModalViewProps, "activeTab" | "query" | "isDetailedSearch" | "isLoading" | "normalizedQuery" | "filteredItems" | "selectedItem" | "selectedMeta" | "canInsertReference" | "listRef" | "renderReferenceItem" | "onInsertReference" | "MonsterStatBlock">) {
	return (
		<div className="RulesReferenceModalContent__main">
			<div className="RulesReferenceModalContent__sidebar"><div className="RulesReferenceModalContent__list">
				<ReferenceSidebar {...props} />
			</div></div>
			<ReferenceDetails {...props} />
		</div>
	);
}

export default function RulesReferenceModalView(props: RulesReferenceModalViewProps) {
	const { activeTab, tabs, query, isDetailedSearch, activeSelectedName, tabsWithSearchMatches, canNavigateBack, canNavigateForward, isLoading, normalizedQuery, filteredItems, selectedItem, selectedMeta, canInsertReference, listRef, renderReferenceItem, onNavigateHistory, onQueryChange, onToggleDetailedSearch, onSelectTab, onEmbeddedSelection, onSelectSpell, onInsertReference, MonsterStatBlock, SpellsBrowser } = props;
	return (
		<div className="RulesReferenceModalContent RulesReferenceModalContent__withTabs">
			<ReferenceSearch {...{ query, isDetailedSearch, canNavigateBack, canNavigateForward, onNavigateHistory, onQueryChange, onToggleDetailedSearch }} />
			<ReferenceTabs tabs={tabs} activeTab={activeTab} tabsWithSearchMatches={tabsWithSearchMatches} onSelectTab={onSelectTab} />
			{activeTab.id === "spells" ? (
				<EmbeddedSpellReference {...{ query, isDetailedSearch, activeSelectedName, onEmbeddedSelection, onSelectSpell, SpellsBrowser }} />
			) : (
				<StandardReferenceLayout {...{ activeTab, query, isDetailedSearch, isLoading, normalizedQuery, filteredItems, selectedItem, selectedMeta, canInsertReference, listRef, renderReferenceItem, onInsertReference, MonsterStatBlock }} />
			)}
		</div>
	);
}
