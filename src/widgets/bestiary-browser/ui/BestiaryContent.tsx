import {
	useEffect,
	useRef,
	type Dispatch,
	type MouseEvent as ReactMouseEvent,
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
import { Icon } from "../../../shared/ui/index.js";
import { Input } from "../../../features/editor/ui/index.js";
import { ListCard } from "../../../shared/ui/index.js";
import { MonsterStatBlockModel } from "../../../entities/bestiary/index.js";
import { MultiSelect } from "../../../shared/ui/index.js";
import { Tooltip } from "../../../shared/ui/index.js";
import { classNames } from "../../../shared/lib/index.js";
import { getMonsterTypeString } from "../../../entities/bestiary/index.js";
import { highlightText } from "../../../shared/ui/index.js";
import {
	formatSourceLabel,
	getSourceFullName,
} from "../../../entities/reference/index.js";
import { lang } from "../../../shared/lib/index.js";
import {
	getBestiaryDetailPresentation,
	getBestiaryMonsterRowPresentation,
	getMonsterItemKey,
	getMonsterSizeText,
	getMonsterTagText,
	isSameMonsterIdentity,
	type BestiaryMonsterRowPresentation,
	type BestiaryMonsterRowPrimaryAction,
	type BestiarySortOrder,
} from "../model.js";
import type {
	BestiaryAssistantSlot,
	BestiaryMonsterStatBlockSlot,
} from "./bestiaryComposition.ts";

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

function executeMonsterRowPrimaryAction(
	action: BestiaryMonsterRowPrimaryAction,
	monster: BestiaryMonster,
	onSelectMonster: MonsterListItemProps["onSelectMonster"],
	onAddMonster: MonsterListItemProps["onAddMonster"],
) {
	if (action === "select") {
		onSelectMonster?.(monster);
		return;
	}
	if (action === "add") onAddMonster?.(monster);
}

function executeStoppedMonsterRowAction(
	event: ReactMouseEvent<HTMLElement>,
	action: () => void,
) {
	event.stopPropagation();
	action();
}

interface MonsterListItemActionsProps {
	monster: BestiaryMonster;
	onAddMonster: MonsterListItemProps["onAddMonster"];
	onAiEdit: MonsterListItemProps["onAiEdit"];
	onDelete: MonsterListItemProps["onDelete"];
	onEdit: MonsterListItemProps["onEdit"];
	onSelectMonster: MonsterListItemProps["onSelectMonster"];
	onToggleFavorite: MonsterListItemProps["onToggleFavorite"];
	presentation: BestiaryMonsterRowPresentation;
}

function MonsterListItemActions({
	monster,
	onAddMonster,
	onAiEdit,
	onDelete,
	onEdit,
	onSelectMonster,
	onToggleFavorite,
	presentation,
}: MonsterListItemActionsProps) {
	return (
		<>
			<Button
				variant="ghost"
				size={Button.SIZES.SMALL}
				icon="star"
				className={classNames("Bestiary__item_fav_btn", {
					is_active: presentation.isFavorite,
				})}
				onClick={(event) =>
					executeStoppedMonsterRowAction(event, () =>
						onToggleFavorite(monster),
					)
				}
				title={lang.t(presentation.favoriteTitleKey)}
			/>
			{presentation.primaryTitleKey && (
				<Button
					variant="ghost"
					size={Button.SIZES.SMALL}
					icon="plus"
					onClick={(event) =>
						executeStoppedMonsterRowAction(event, () =>
							executeMonsterRowPrimaryAction(
								presentation.primaryAction,
								monster,
								onSelectMonster,
								onAddMonster,
							),
						)
					}
					title={lang.t(presentation.primaryTitleKey)}
				/>
			)}
			<Button
				variant="ghost"
				className="Bestiary__item_edit_btn"
				size={Button.SIZES.SMALL}
				icon="edit"
				onClick={(event) =>
					executeStoppedMonsterRowAction(event, () => onEdit(monster))
				}
				title={lang.t("Edit creature")}
			/>
			{presentation.isCustom && (
				<>
					<Button
						variant="ghost"
						className="Bestiary__item_ai_edit_btn"
						size={Button.SIZES.SMALL}
						icon="wand"
						onClick={(event) =>
							executeStoppedMonsterRowAction(event, () => onAiEdit(monster))
						}
						title={lang.t("AI edit custom creature")}
					/>
					<Button
						variant="danger"
						className="Bestiary__item_delete_btn"
						size={Button.SIZES.SMALL}
						icon="trash"
						onClick={(event) =>
							executeStoppedMonsterRowAction(event, () => onDelete(monster))
						}
						title={lang.t("Delete custom creature")}
					/>
				</>
			)}
		</>
	);
}

interface MonsterListItemContentProps {
	monster: BestiaryMonster;
	presentation: BestiaryMonsterRowPresentation;
	search: string;
	sourceFullName: string;
}

function MonsterListItemContent({
	monster,
	presentation,
	search,
	sourceFullName,
}: MonsterListItemContentProps) {
	return (
		<div className="Bestiary__item_content">
			<img
				className="Bestiary__item_token"
				src={presentation.tokenSrc}
				alt=""
				loading="lazy"
				draggable={false}
				onError={(event) => {
					event.currentTarget.hidden = true;
				}}
			/>
			<div className="Bestiary__item_info">
				<div className="ListCard__title">
					{highlightText(monster.name, search)}
				</div>
				<div className="ListCard__meta">
					{highlightText(getMonsterSizeText(monster), search)}{" "}
					{highlightText(getMonsterTypeString(monster.type), search)}{" "}
					{highlightText(getMonsterTagText(monster), search)}
					{monster.source && (
						<Tooltip content={sourceFullName} disabled={!sourceFullName}>
							<span className="Bestiary__item_source">
								{" "}
								• {highlightText(monster.source, search)}
							</span>
						</Tooltip>
					)}
				</div>
			</div>
			<Tooltip content={lang.t("Challenge Rating")}>
				<div className="Bestiary__item_cr">
					<div className="Bestiary__cr_label">CR</div>
					<div className="Bestiary__cr_value">{presentation.crDisplay}</div>
				</div>
			</Tooltip>
		</div>
	);
}

function MonsterListItem(props: MonsterListItemProps) {
	const { favorites, monster, search, selectedMonster } = props;
	const fallbackTokenSrc = new MonsterStatBlockModel(monster).localTokenSrc;
	const presentation = getBestiaryMonsterRowPresentation(
		monster,
		selectedMonster,
		favorites,
		Boolean(props.onSelectMonster),
		Boolean(props.onAddMonster),
		fallbackTokenSrc,
	);
	return (
		<div>
			<ListCard
				active={presentation.isSelected}
				onClick={() => props.onSelect(presentation.nextSelection)}
				onDoubleClick={() =>
					executeMonsterRowPrimaryAction(
						presentation.primaryAction,
						monster,
						props.onSelectMonster,
						props.onAddMonster,
					)
				}
				actions={
					<MonsterListItemActions
						monster={monster}
						onAddMonster={props.onAddMonster}
						onAiEdit={props.onAiEdit}
						onDelete={props.onDelete}
						onEdit={props.onEdit}
						onSelectMonster={props.onSelectMonster}
						onToggleFavorite={props.onToggleFavorite}
						presentation={presentation}
					/>
				}
			>
				<MonsterListItemContent
					monster={monster}
					presentation={presentation}
					search={search}
					sourceFullName={getSourceFullName(monster.source)}
				/>
			</ListCard>
		</div>
	);
}

interface MonsterListItemProps {
	favorites: BestiaryFavorite[];
	monster: BestiaryMonster;
	onAddMonster?: ((monster: BestiaryMonster) => void) | null;
	onAiEdit: (monster: BestiaryMonster) => void;
	onDelete: (monster: BestiaryMonster) => void;
	onEdit: (monster: BestiaryMonster) => void;
	onSelectMonster?: ((monster: BestiaryMonster) => void) | null;
	onSelect: (monster: BestiaryMonster | null) => void;
	onToggleFavorite: (monster: BestiaryMonster) => void;
	search: string;
	selectedMonster: BestiaryMonster | null;
}

export interface BestiaryContentProps {
	AiAssistantPanel: BestiaryAssistantSlot;
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

type BestiaryToolbarProps = Pick<
	BestiaryContentProps,
	| "headerActions"
	| "hideSearchInput"
	| "isDetailedSearch"
	| "onSelectedSourcesChange"
	| "onSourceFilterChange"
	| "onlyFavorites"
	| "search"
	| "selectedSources"
	| "setIsDetailedSearch"
	| "setOnlyFavorites"
	| "setSearch"
	| "sortOrder"
	| "sourceFilter"
	| "sourceFilterLabel"
	| "sourceOptions"
	| "sources"
	| "toggleSort"
>;

function BestiaryToolbar({
	headerActions,
	hideSearchInput,
	isDetailedSearch,
	onSelectedSourcesChange,
	onSourceFilterChange,
	onlyFavorites,
	search,
	selectedSources,
	setIsDetailedSearch,
	setOnlyFavorites,
	setSearch,
	sortOrder,
	sourceFilter,
	sourceFilterLabel,
	sourceOptions,
	sources,
	toggleSort,
}: BestiaryToolbarProps) {
	return (
		<div className="Bestiary__search">
			<MultiSelect
				className="Bestiary__source_select"
				dropdownMinWidth={450}
				value={selectedSources}
				onChange={onSelectedSourcesChange}
				onOptionClick={onSourceFilterChange}
				activeValue={sourceFilter}
				allOptionLabel={lang.t("All sources")}
				onAllOptionClick={() => onSourceFilterChange("all")}
				labelOverride={sourceFilterLabel}
				placeholder={lang.t("Sources")}
				allSelectedLabel={lang.t("All sources")}
				noneSelectedLabel={lang.t("No sources")}
				selectAllLabel={lang.t("Select all")}
				clearLabel={lang.t("Clear")}
				disabled={sources.length === 0}
				options={[
					{ value: "CUSTOM", label: lang.t("Custom creatures") },
					...sourceOptions.map((source) => ({
						value: source,
						label: formatSourceLabel(source.replace(/^bestiary-/i, "")),
					})),
				]}
			/>
			{!hideSearchInput && (
				<div className="Bestiary__searchInput">
					<Input
						placeholder={lang.t("Search by name or type...")}
						value={search}
						onChange={(event) => setSearch(event.target.value)}
					/>
					<Button
						variant={isDetailedSearch ? "primary" : "ghost"}
						icon="search-detailed"
						onClick={() => setIsDetailedSearch((value) => !value)}
						title={lang.t("Detailed search")}
						className="DetailedSearchButton Bestiary__detailed_search_btn"
					/>
				</div>
			)}
			<Button
				variant={onlyFavorites ? "primary" : "ghost"}
				icon="star"
				onClick={() => setOnlyFavorites(!onlyFavorites)}
				title={lang.t("Only favorites")}
				className="Bestiary__filter_fav_btn"
			/>
			<Button
				className={classNames("Bestiary__sort_btn", {
					is_active: sortOrder !== "none",
				})}
				variant="ghost"
				onClick={toggleSort}
				title={lang.t("Sort by CR (Challenge Rating)")}
			>
				<span className="Bestiary__sort_label">CR</span>
				<Icon
					name={`sort-${sortOrder}`}
					className={classNames(
						"Bestiary__sort_icon",
						`state-${sortOrder}`,
					)}
				/>
			</Button>
			{headerActions && (
				<div className="Bestiary__embedded_actions">{headerActions}</div>
			)}
		</div>
	);
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
		<MonsterListItem
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
				isBestiary
				onRegisterImagePromptAction={onRegisterImagePromptAction}
			/>
		</div>
	);
}
