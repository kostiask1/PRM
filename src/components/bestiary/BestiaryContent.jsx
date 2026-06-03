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
import { lang } from "../../services/localization";

function getMonsterItemKey(monster) {
	return `${monster.source || ""}:${monster.name}`;
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

	return (
		<div key={getMonsterItemKey(monster)}>
			<ListCard
				active={isSelected}
				onClick={() => onSelect(isSelected ? "" : monster)}
				onDoubleClick={() => onAddMonster && onAddMonster(monster)}
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
						{onAddMonster && (
							<Button
								variant="ghost"
								size={Button.SIZES.SMALL}
								icon="plus"
								onClick={(event) => {
									event.stopPropagation();
									onAddMonster(monster);
								}}
								title={lang.t("Add to encounter")}
							/>
						)}
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
									variant="ghost"
									className="Bestiary__item_edit_btn"
									size={Button.SIZES.SMALL}
									icon="edit"
									onClick={(event) => {
										event.stopPropagation();
										onEdit(monster);
									}}
									title={lang.t("Edit custom creature")}
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
								<span className="Bestiary__item_source">
									{" "}
									• {highlightText(monster.source, search)}
								</span>
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
	isDetailedSearch,
	isEmbedded,
	listRef,
	loading,
	onAddMonster,
	onDeleteCustomMonster,
	onEditCustomMonster,
	onFavoriteListChange,
	onMonsterAiAction,
	onAiEditCustomMonster,
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
	const renderMonsterItem = (index) => (
		<MonsterListItem
			favorites={favorites}
			monster={displayedMonsters[index]}
			onAddMonster={onAddMonster}
			onAiEdit={onAiEditCustomMonster}
			onDelete={onDeleteCustomMonster}
			onEdit={onEditCustomMonster}
			onSelect={setSelectedMonster}
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
							value={selectedSource}
							onChange={(event) =>
								setSelectedSource(normalizeSourceSelection(event.target.value))
							}
						>
							<option value="all">{lang.t("All sources")}</option>
							<option value="CUSTOM">{lang.t("Custom creatures")}</option>
							{sourceOptions.map((source) => (
								<option key={source} value={source}>
									{source.replace(/^bestiary-/i, "").toUpperCase()}
								</option>
							))}
						</Select>
					)}
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
				</div>

				<div
					className={classNames("Bestiary__content", {
						Bestiary__content__stacked: isEmbedded,
					})}
				>
					<div className="Bestiary__list">
						<ReactList
							ref={listRef}
							itemRenderer={renderMonsterItem}
							length={displayedMonsters.length}
							type="uniform"
						/>
					</div>
					{loading && (
						<div className="muted">{lang.t("Indexing database...")}</div>
					)}

					{selectedMonster && (
						<div className="Bestiary__detail_container">
							<MonsterStatBlock
								monster={selectedMonster}
								favoriteActive={isFavoriteMonster(favorites, selectedMonster)}
								onNameClick={
									onAddMonster ? (monster) => onAddMonster(monster) : undefined
								}
								nameTitle={onAddMonster && lang.t("Add to encounter")}
								onFavoriteChange={onFavoriteListChange}
								showAddToEncounterPicker
								onAddToEncounter={onAddMonster}
								onAiAction={onMonsterAiAction}
								onFieldEdit={
									isCustomSource(selectedMonster?.source)
										? onEditCustomMonster
										: null
								}
								searchHighlight={searchHighlight}
							/>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
