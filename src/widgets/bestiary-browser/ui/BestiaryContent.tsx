import {
	useMemo,
	useRef,
	type Dispatch,
	type ReactNode,
	type RefObject,
	type SetStateAction,
} from "react";
import ReactList from "react-list";
import type {
	BestiaryFavorite,
	BestiaryMonster,
} from "../../../entities/bestiary/index.js";
import {
	getMonsterItemKey,
	isSameMonsterIdentity,
	type BestiarySortOrder,
} from "../model.js";
import type {
	BestiaryMonsterStatBlockSlot,
} from "./bestiaryComposition.ts";
import { BestiaryMonsterListItem } from "./BestiaryMonsterListItem.tsx";
import { BestiaryToolbar } from "./BestiaryToolbar.tsx";
import { BestiaryDetail } from "./BestiaryDetail.tsx";
import { BestiaryVirtualizedList } from "./BestiaryVirtualizedList.tsx";
import { useBestiaryMobileSelection } from "./useBestiaryMobileSelection.ts";

export interface BestiaryContentProps {
	MonsterStatBlock: BestiaryMonsterStatBlockSlot;
	displayedMonsters: BestiaryMonster[];
	favorites: BestiaryFavorite[];
	headerActions?: ReactNode;
	hideSearchInput?: boolean;
	isDetailedSearch: boolean;
	listRef: RefObject<ReactList>;
	loading: boolean;
	onAddMonster?: ((monster: BestiaryMonster) => void) | null;
	onDeleteCustomMonster: (monster: BestiaryMonster) => void;
	onEditMonster: (monster: BestiaryMonster) => void;
	onFavoriteListChange: Dispatch<SetStateAction<BestiaryFavorite[]>>;
	onMonsterAiAction: (monster: BestiaryMonster) => void;
	onSelectedSourcesChange: (sources: string[]) => void | Promise<void>;
	onSourceFilterChange: (source: string) => void;
	onAiEditCustomMonster: (monster: BestiaryMonster) => void;
	onSelectMonster?: ((monster: BestiaryMonster) => void) | null;
	onToggleFavorite: (monster: BestiaryMonster) => void;
	onlyFavorites: boolean;
	search: string;
	searchHighlight?: string;
	selectedMonster: BestiaryMonster | null;
	selectedSources: string[];
	sourceFilter: string;
	sourceFilterLabel: string;
	setIsDetailedSearch: Dispatch<SetStateAction<boolean>>;
	setOnlyFavorites: Dispatch<SetStateAction<boolean>>;
	setSearch: Dispatch<SetStateAction<string>>;
	setSelectedMonster: (monster: BestiaryMonster | null) => void;
	sortOrder: BestiarySortOrder;
	sourceOptions: string[];
	sources: string[];
	toggleSort: () => void;
}

export default function BestiaryContent({
	MonsterStatBlock,
	displayedMonsters,
	favorites,
	headerActions = null,
	hideSearchInput = false,
	isDetailedSearch,
	listRef,
	loading,
	onAddMonster,
	onDeleteCustomMonster,
	onEditMonster,
	onFavoriteListChange,
	onMonsterAiAction,
	onSelectedSourcesChange,
	onSourceFilterChange,
	onAiEditCustomMonster,
	onSelectMonster,
	onToggleFavorite,
	onlyFavorites,
	search,
	searchHighlight = search,
	selectedMonster,
	selectedSources,
	sourceFilter,
	sourceFilterLabel,
	setIsDetailedSearch,
	setOnlyFavorites,
	setSearch,
	setSelectedMonster,
	sortOrder,
	sourceOptions,
	sources,
	toggleSort,
}: BestiaryContentProps) {
	const listContainerRef = useRef<HTMLDivElement>(null);
	const selectedHiddenByFilters = useMemo(
		() => !loading && Boolean(selectedMonster) && !displayedMonsters.some((monster) => isSameMonsterIdentity(monster, selectedMonster)),
		[displayedMonsters, loading, selectedMonster],
	);
	const { detailRef, handleSelectMonster } = useBestiaryMobileSelection({
		displayedMonsters,
		listRef,
		selectedMonster,
		setSelectedMonster,
	});

	const renderMonsterItem = (index: number) => (
		<BestiaryMonsterListItem
			key={getMonsterItemKey(displayedMonsters[index])}
			favorites={favorites}
			monster={displayedMonsters[index]}
			onAddMonster={onAddMonster}
			onAiEdit={onAiEditCustomMonster}
			onDelete={onDeleteCustomMonster}
			onEdit={onEditMonster}
			onSelectMonster={onSelectMonster}
			onSelect={handleSelectMonster}
			onToggleFavorite={onToggleFavorite}
			search={searchHighlight}
			selectedMonster={selectedMonster}
		/>
	);

	return (
		<div className="Bestiary Bestiary__inner">
			<div className="Panel__body">
				<BestiaryToolbar
					headerActions={headerActions}
					hideSearchInput={hideSearchInput}
					isDetailedSearch={isDetailedSearch}
					onSelectedSourcesChange={onSelectedSourcesChange}
					onSourceFilterChange={onSourceFilterChange}
					onlyFavorites={onlyFavorites}
					search={search}
					selectedSources={selectedSources}
					setIsDetailedSearch={setIsDetailedSearch}
					setOnlyFavorites={setOnlyFavorites}
					setSearch={setSearch}
					sortOrder={sortOrder}
					sourceFilter={sourceFilter}
					sourceFilterLabel={sourceFilterLabel}
					sourceOptions={sourceOptions}
					sources={sources}
					toggleSort={toggleSort}
				/>
				<div className="Bestiary__content Bestiary__content__stacked">
					<BestiaryVirtualizedList
						displayedMonsters={displayedMonsters}
						itemRenderer={renderMonsterItem}
						listContainerRef={listContainerRef}
						listRef={listRef}
						loading={loading}
					/>
					<BestiaryDetail
						MonsterStatBlock={MonsterStatBlock}
						detailRef={detailRef}
						favorites={favorites}
						onAddMonster={onAddMonster}
						onDeleteCustomMonster={onDeleteCustomMonster}
						onEditMonster={onEditMonster}
						onFavoriteListChange={onFavoriteListChange}
						onMonsterAiAction={onMonsterAiAction}
						onSelectMonster={onSelectMonster}
						searchHighlight={searchHighlight}
						selectedMonster={selectedMonster}
						selectedHiddenByFilters={selectedHiddenByFilters}
					/>
				</div>
			</div>
		</div>
	);
}
