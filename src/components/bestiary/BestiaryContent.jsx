import { useEffect, useRef } from "react";
import ReactList from "react-list";
import Button from "../form/Button";
import Icon from "../common/Icon";
import Input from "../form/Input";
import ListCard from "../common/ListCard";
import MonsterStatBlock from "../MonsterStatBlock";
import Select from "../form/Select";
import Tooltip from "../common/Tooltip";
import classNames from "../../utils/classNames";
import { getMonsterTypeString } from "../../utils/bestiary.js";
import { highlightText } from "../../utils/searchHighlight.jsx";
import {
	formatSourceLabel,
	getSourceFullName,
} from "../../utils/sourceNames.js";
import { lang } from "../../services/localization";

function getMonsterItemKey(monster) {
	return `${monster.source || ""}:${monster.name}`;
}

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

function isCustomSource(source) {
	return String(source || "").toUpperCase() === "CUSTOM";
}

function normalizeSourceSelection(source) {
	if (isCustomSource(source)) return "CUSTOM";
	return source || "all";
}

function isFavoriteMonster(favorites, monster) {
	return favorites.some(
		(f) =>
			f.name === monster?.name &&
			f.source?.toUpperCase() === monster?.source?.toUpperCase(),
	);
}

function MonsterListItem({
	favorites,
	monster,
	onAddMonster,
	onAiEdit,
	onDelete,
	onEdit,
	onSelectMonster,
	onSelect,
	onToggleFavorite,
	search,
	selectedMonster,
}) {
	const crValue = monster.cr?.cr !== undefined ? monster.cr.cr : monster.cr;
	const isSelected =
		selectedMonster?.name === monster.name &&
		selectedMonster?.source === monster.source;
	const isFavorite = isFavoriteMonster(favorites, monster);
	const sourceFullName = getSourceFullName(monster.source);

	return (
		<div key={getMonsterItemKey(monster)}>
			<ListCard
				active={isSelected}
				onClick={() => onSelect(isSelected ? "" : monster)}
				onDoubleClick={() => {
					if (onSelectMonster) onSelectMonster(monster);
					else if (onAddMonster) onAddMonster(monster);
				}}
				actions={
					<>
						<Button
							variant="ghost"
							size={Button.SIZES.SMALL}
							icon="star"
							className={classNames("Bestiary__item_fav_btn", {
								is_active: isFavorite,
							})}
							onClick={(event) => {
								event.stopPropagation();
								onToggleFavorite(monster);
							}}
							title={
								isFavorite
									? lang.t("Remove from favorites")
									: lang.t("Add to favorites")
							}
						/>
						{(onAddMonster || onSelectMonster) && (
							<Button
								variant="ghost"
								size={Button.SIZES.SMALL}
								icon="plus"
								onClick={(event) => {
									event.stopPropagation();
									if (onSelectMonster) onSelectMonster(monster);
									else onAddMonster(monster);
								}}
								title={
									onSelectMonster
										? lang.t("Insert")
										: lang.t("Add to encounter")
								}
							/>
						)}
						<Button
							variant="ghost"
							className="Bestiary__item_edit_btn"
							size={Button.SIZES.SMALL}
							icon="edit"
							onClick={(event) => {
								event.stopPropagation();
								onEdit(monster);
							}}
							title={lang.t("Edit creature")}
						/>
						{isCustomSource(monster.source) && (
							<>
								<Button
									variant="ghost"
									className="Bestiary__item_ai_edit_btn"
									size={Button.SIZES.SMALL}
									icon="wand"
									onClick={(event) => {
										event.stopPropagation();
										onAiEdit(monster);
									}}
									title={lang.t("AI edit custom creature")}
								/>
								<Button
									variant="danger"
									className="Bestiary__item_delete_btn"
									size={Button.SIZES.SMALL}
									icon="trash"
									onClick={(event) => {
										event.stopPropagation();
										onDelete(monster);
									}}
									title={lang.t("Delete custom creature")}
								/>
							</>
						)}
					</>
				}
			>
				<div className="Bestiary__item_content">
					<div className="Bestiary__item_info">
						<div className="ListCard__title">
							{highlightText(monster.name, search)}
						</div>
						<div className="ListCard__meta">
							{highlightText(
								Array.isArray(monster.size) ? monster.size[0] : monster.size,
								search,
							)}{" "}
							{highlightText(getMonsterTypeString(monster.type), search)}{" "}
							{highlightText(
								monster.type?.tags?.map((tag) => tag?.tag || tag).join(", "),
								search,
							)}
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
							<div className="Bestiary__cr_value">{crValue || "--"}</div>
						</div>
					</Tooltip>
				</div>
			</ListCard>
		</div>
	);
}

export default function BestiaryContent({
	displayedMonsters,
	favorites,
	headerActions = null,
	hideSearchInput = false,
	isDetailedSearch,
	isEmbedded,
	listRef,
	loading,
	onAddMonster,
	onDeleteCustomMonster,
	onEditMonster,
	onFavoriteListChange,
	onMonsterAiAction,
	onAiEditCustomMonster,
	onSelectMonster,
	onToggleFavorite,
	onlyFavorites,
	search,
	searchHighlight = search,
	selectedMonster,
	selectedSource,
	setIsDetailedSearch,
	setOnlyFavorites,
	setSearch,
	setSelectedMonster,
	setSelectedSource,
	sortOrder,
	sourceOptions,
	sources,
	toggleSort,
}) {
	const listContainerRef = useRef(null);
	const detailRef = useRef(null);

	const handleSelectMonster = (monster) => {
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
			(monster) =>
				monster?.name === selectedMonster.name &&
				monster?.source === selectedMonster.source,
		);
		if (selectedIndex < 0) return undefined;

		const frameId = requestAnimationFrame(() => {
			listRef.current?.scrollTo(selectedIndex);
		});
		return () => cancelAnimationFrame(frameId);
	}, [displayedMonsters, listRef, selectedMonster]);

	const renderMonsterItem = (index) => (
		<MonsterListItem
			key={displayedMonsters[index].name + displayedMonsters[index].source}
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
				<div className="Bestiary__search">
					{sources.length > 0 && (
						<Select
							className="Bestiary__source_select"
							dropdownMinWidth={450}
							value={selectedSource}
							onChange={(event) =>
								setSelectedSource(normalizeSourceSelection(event.target.value))
							}
						>
							<option value="all">{lang.t("All sources")}</option>
							<option value="CUSTOM">{lang.t("Custom creatures")}</option>
							{sourceOptions.map((source) => (
								<option key={source} value={source}>
									{formatSourceLabel(source.replace(/^bestiary-/i, ""))}
								</option>
							))}
						</Select>
					)}
					{!hideSearchInput && (
						<div className="Bestiary__searchInput">
							<Input
								icon="search-detailed"
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
				{loading && (
					<div className="muted">{lang.t("Indexing database...")}</div>
				)}
				<div
					className={classNames("Bestiary__content", {
						Bestiary__content__stacked: isEmbedded,
					})}
				>
					<div className="Bestiary__list" ref={listContainerRef}>
						<ReactList
							ref={listRef}
							itemRenderer={renderMonsterItem}
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

					{selectedMonster && (
						<div className="Bestiary__detail_container" ref={detailRef}>
							{onSelectMonster && (
								<div className="Bestiary__select_actions">
									<Button
										variant="primary"
										icon="plus"
										onClick={() => onSelectMonster(selectedMonster)}
									>
										{lang.t("Insert")}
									</Button>
								</div>
							)}
							<MonsterStatBlock
								monster={selectedMonster}
								favoriteActive={isFavoriteMonster(favorites, selectedMonster)}
								onNameClick={
									onAddMonster ? (monster) => onAddMonster(monster) : undefined
								}
								nameTitle={onAddMonster && lang.t("Add to encounter")}
								onFavoriteChange={onFavoriteListChange}
								showAddToEncounterPicker={Boolean(onAddMonster)}
								onAddToEncounter={onAddMonster}
								onAiAction={onMonsterAiAction}
								onDelete={
									isCustomSource(selectedMonster.source)
										? onDeleteCustomMonster
										: undefined
								}
								onFieldEdit={onEditMonster}
								searchHighlight={searchHighlight}
							/>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
