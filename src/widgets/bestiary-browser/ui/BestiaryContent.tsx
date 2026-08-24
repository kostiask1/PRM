import {
	useEffect,
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
import { Button } from "../../../shared/ui/index.js";
import { lang } from "../../../shared/lib/index.js";
import {
	getBestiaryDetailPresentation,
	getMonsterItemKey,
	isSameMonsterIdentity,
	type BestiarySortOrder,
} from "../model.js";
import type {
	BestiaryAssistantSlotProps,
	BestiaryAssistantSlot,
	BestiaryMonsterStatBlockSlot,
} from "./bestiaryComposition.ts";
import { BestiaryMonsterListItem } from "./BestiaryMonsterListItem.tsx";
import { BestiaryToolbar } from "./BestiaryToolbar.tsx";

function isMobileViewport() {
	return (
		typeof window !== "undefined" &&
		window.matchMedia("(max-width: 767px)").matches
	);
}

function getFallbackScrollParent() {
	if (typeof window === "undefined") return null;
	return window;
}

export interface BestiaryContentProps {
	AiAssistantPanel: BestiaryAssistantSlot;
	MonsterStatBlock: BestiaryMonsterStatBlockSlot;
	ResponseModal: BestiaryAssistantSlotProps["ResponseModal"];
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
	onRegisterImagePromptAction: (handler: ((monster: BestiaryMonster) => void) | null) => void;
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

interface BestiaryListProps {
	displayedMonsters: BestiaryMonster[];
	itemRenderer: (index: number) => ReactNode;
	listContainerRef: RefObject<HTMLDivElement>;
	listRef: RefObject<ReactList>;
	loading: boolean;
}

function BestiaryList({
	displayedMonsters,
	itemRenderer,
	listContainerRef,
	listRef,
	loading,
}: BestiaryListProps) {
	return (
		<div className="Bestiary__list" ref={listContainerRef}>
			{loading && displayedMonsters.length === 0 && (
				<div className="Bestiary__loading muted">{lang.t("Loading...")}</div>
			)}
			<ReactList
				ref={listRef}
				itemRenderer={itemRenderer}
				length={displayedMonsters.length}
				scrollParentGetter={() =>
					listContainerRef.current || getFallbackScrollParent()
				}
				scrollParentViewportSizeGetter={() =>
					listContainerRef.current?.clientHeight ||
					getFallbackScrollParent()?.innerHeight ||
					0
				}
				type="uniform"
			/>
		</div>
	);
}

type BestiaryDetailProps = Pick<
	BestiaryContentProps,
	| "MonsterStatBlock"
	| "favorites"
	| "onAddMonster"
	| "onDeleteCustomMonster"
	| "onEditMonster"
	| "onFavoriteListChange"
	| "onMonsterAiAction"
	| "onSelectMonster"
	| "selectedMonster"
> & {
	detailRef: RefObject<HTMLDivElement>;
	searchHighlight: string;
};

function BestiaryDetail({
	MonsterStatBlock,
	detailRef,
	favorites,
	onAddMonster,
	onDeleteCustomMonster,
	onEditMonster,
	onFavoriteListChange,
	onMonsterAiAction,
	onSelectMonster,
	searchHighlight,
	selectedMonster,
}: BestiaryDetailProps) {
	const presentation = getBestiaryDetailPresentation(
		selectedMonster,
		favorites,
		onSelectMonster,
		onAddMonster,
		onDeleteCustomMonster,
		() => lang.t("Add to encounter"),
	);
	if (!presentation) return null;
	return (
		<div className="Bestiary__detail_container" ref={detailRef}>
			{presentation.insertAction && (
				<div className="Bestiary__select_actions">
					<Button
						variant="primary"
						icon="plus"
						onClick={() =>
							presentation.insertAction?.(presentation.monster)
						}
					>
						{lang.t("Insert")}
					</Button>
				</div>
			)}
			<MonsterStatBlock
				monster={presentation.monster}
				favoriteActive={presentation.favoriteActive}
				onNameClick={presentation.addAction}
				nameTitle={presentation.addTitle}
				onFavoriteChange={onFavoriteListChange}
				showAddToEncounterPicker={presentation.showAddToEncounterPicker}
				onAddToEncounter={presentation.addAction}
				onAiAction={onMonsterAiAction}
				onDelete={presentation.deleteAction}
				onFieldEdit={onEditMonster}
				searchHighlight={searchHighlight}
			/>
		</div>
	);
}

export default function BestiaryContent({
	AiAssistantPanel,
	MonsterStatBlock,
	ResponseModal,
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
	onRegisterImagePromptAction,
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
	const detailRef = useRef<HTMLDivElement>(null);

	const handleSelectMonster = (monster: BestiaryMonster | null) => {
		setSelectedMonster(monster);
		if (!monster?.name || !isMobileViewport()) return;

		requestAnimationFrame(() => {
			detailRef.current?.scrollIntoView({
				behavior: "smooth",
				block: "start",
			});
		});
	};

	useEffect(() => {
		if (!selectedMonster?.name || !isMobileViewport()) return undefined;
		const selectedIndex = displayedMonsters.findIndex(
			(monster) => isSameMonsterIdentity(monster, selectedMonster),
		);
		if (selectedIndex < 0) return undefined;

		const frameId = requestAnimationFrame(() => {
			listRef.current?.scrollTo(selectedIndex);
		});
		return () => cancelAnimationFrame(frameId);
	}, [displayedMonsters, listRef, selectedMonster]);

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
					<BestiaryList
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
					/>
				</div>
			</div>
			<AiAssistantPanel
				ResponseModal={ResponseModal}
				isBestiary
				onRegisterImagePromptAction={onRegisterImagePromptAction}
			/>
		</div>
	);
}
