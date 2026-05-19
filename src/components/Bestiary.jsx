import { useState, useEffect, useMemo, useRef } from "react";
import { api } from "../api";
import { alert, confirm } from "../actions/app";
import { useAppDispatch } from "../store/appStore";
import ReactList from "react-list";
import Panel from "./common/Panel";
import Input from "./form/Input";
import Button from "./form/Button";
import Select from "./form/Select";
import Icon from "./common/Icon";
import ListCard from "./common/ListCard";
import MonsterStatBlock from "./MonsterStatBlock";
import AiAssistantPanel from "./AiAssistantPanel";
import Tooltip from "./common/Tooltip";
import Modal from "./common/Modal";
import classNames from "../utils/classNames";
import {
	getMonsterTypeString,
	matchesMonsterSearch,
} from "../utils/bestiary.js";
import { objectMatchesSearch } from "../utils/deepSearch.js";
import { highlightText } from "../utils/searchHighlight.jsx";
import "../assets/components/Bestiary.css";
import { lang } from "../services/localization";

function monsterMatchesUrl(monster, name, source) {
	return monster?.name === name && (!source || monster.source === source);
}

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

function clearMonsterUrlSelection() {
	const params = new URLSearchParams(window.location.search);
	params.delete("monster");
	params.delete("m_source");
	window.history.replaceState({}, "", `?${params.toString()}`);
}

export default function Bestiary({
	onAddMonster,
	isEmbedded = false,
}) {
	const dispatch = useAppDispatch();
	const [sources, setSources] = useState([]);
	const [selectedSource, setSelectedSource] = useState("all");
	const [allMonsters, setAllMonsters] = useState([]);
	const [monsters, setMonsters] = useState([]);
	const [search, setSearch] = useState("");
	const [isDetailedSearch, setIsDetailedSearch] = useState(false);
	const [loading, setLoading] = useState(false);
	const [selectedMonster, setSelectedMonster] = useState(null);
	const [legendaryGroups, setLegendaryGroups] = useState([]);
	const [favorites, setFavorites] = useState([]);
	const [onlyFavorites, setOnlyFavorites] = useState(false);
	const [sortOrder, setSortOrder] = useState("none"); // 'none', 'desc', 'asc'
	const [reloadToken, setReloadToken] = useState(0);
	const [editingMonster, setEditingMonster] = useState(null);
	const [editingMonsterJson, setEditingMonsterJson] = useState("");
	const [editingMonsterError, setEditingMonsterError] = useState("");
	const [isSavingMonsterEdit, setIsSavingMonsterEdit] = useState(false);
	const listRef = useRef(null);
	const selectedMonsterRef = useRef(null);
	const hasInitializedSourceRef = useRef(false);
	const shouldAutoSelectMonsterRef = useRef(true);

	const sourceOptions = useMemo(
		() => sources.filter((source) => !isCustomSource(source)),
		[sources],
	);

	useEffect(() => {
		selectedMonsterRef.current = selectedMonster;
	}, [selectedMonster]);

	const displayedMonsters = useMemo(() => {
		let list = [...monsters];
		if (sortOrder === "none") {
			return list;
		}

		return list.sort((a, b) => {
			const crA = parseCR(a);
			const crB = parseCR(b);
			if (crA === crB) {
				return a.name.localeCompare(b.name);
			}
			return sortOrder === "desc" ? crB - crA : crA - crB;
		});
	}, [monsters, sortOrder]);

	// Допоміжна функція для отримання текстового представлення типу монстра
	// Завантаження списку доступних джерел (файлів)
	useEffect(() => {
		const loadInitialData = async () => {
			try {
				const [sourcesData, legendaryData, favData] = await Promise.all([
					api.getBestiarySources(),
					api.getLegendaryGroups(),
					api.getBestiaryFavorites(),
				]);
				setSources(sourcesData);
				setLegendaryGroups(legendaryData); // Зберігаємо дані легендарних груп
				setFavorites(favData);
				if (sourcesData.length > 0) {
					const params = new URLSearchParams(window.location.search);
					const sourceFromUrl = params.get("source");
					if (!hasInitializedSourceRef.current) {
						setSelectedSource(normalizeSourceSelection(sourceFromUrl));
						hasInitializedSourceRef.current = true;
					}
				}
			} catch (err) {
				console.error(
					"Failed to load bestiary sources or legendary groups",
					err,
				);
			}
		};
		loadInitialData();
	}, [reloadToken]);

	// Завантаження повного списку монстрів один раз; джерела далі фільтруються локально
	useEffect(() => {
		if (sources.length === 0) return;

		const loadData = async () => {
			setLoading(true);
			try {
				const [data, customData] = await Promise.all([
					api.getBestiaryData("all"),
					api.getCustomBestiaryData(),
				]);
				const combinedList = Array.isArray(data)
					? data
					: data.monster || data.monsters || data.results || [];
				const customList = Array.isArray(customData)
					? customData
					: customData.monster || customData.monsters || customData.results || [];
				const sourceList = [...combinedList, ...customList];

				// Об'єднуємо дані монстрів з легендарними діями/регіональними ефектами

				const enrichedMonsters = sourceList.map((monster) => {
					// Шукаємо групу: або за спеціальним посиланням legendaryGroup, або за ім'ям самого монстра
					const groupRef = monster.legendaryGroup;
					const targetName = groupRef?.name || monster.name;
					const targetSource = groupRef?.source || monster.source;

					const legendaryEntry = legendaryGroups.find(
						(lg) =>
							lg.name === targetName &&
							lg.source?.toUpperCase() === targetSource?.toUpperCase(),
					);
					if (legendaryEntry) {
						return {
							...monster,
							lairActions: legendaryEntry.lairActions,
							regionalEffects: legendaryEntry.regionalEffects,
						};
					}
					return monster;
				});
				setAllMonsters(enrichedMonsters);
			} catch (error) {
				console.error("Failed to load local monsters", error);
			} finally {
				setLoading(false);
			}
		};
		loadData();
	}, [sources, legendaryGroups, reloadToken]);

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		params.set("source", selectedSource);
		window.history.replaceState({}, "", `?${params.toString()}`);
	}, [selectedSource]);

	// Локальна фільтрація списку за пошуковим запитом
	useEffect(() => {
		const filtered = allMonsters.filter((m) => {
			const matchesSource =
				selectedSource === "all" ||
				m.source?.toUpperCase() === selectedSource.toUpperCase();
			if (!matchesSource) return false;

			const isFav = favorites.some(
				(f) =>
					f.name === m.name &&
					f.source?.toUpperCase() === m.source?.toUpperCase(),
			);
			if (onlyFavorites && !isFav) return false;

			return isDetailedSearch
				? objectMatchesSearch(m, search)
				: matchesMonsterSearch(m, search);
		});
		setMonsters(filtered);
	}, [
		search,
		allMonsters,
		onlyFavorites,
		favorites,
		selectedSource,
		isDetailedSearch,
	]);

	const handleToggleFavorite = async (monster) => {
		try {
			const newFavs = await api.toggleBestiaryFavorite(
				monster.name,
				monster.source,
			);
			setFavorites(newFavs);
		} catch (err) {
			console.error("Failed to toggle favorite", err);
		}
	};

	const handleCustomBestiaryUpdate = (updated, options = {}) => {
		const updatedCustomMonsters = Array.isArray(updated?.monsters)
			? updated.monsters
			: [];
		const generatedMonsters = Array.isArray(options?.generated?.monsters)
			? options.generated.monsters
			: [];
		const firstGeneratedMonster = generatedMonsters[0];
		const selectedGeneratedMonster = firstGeneratedMonster
			? updatedCustomMonsters.find(
					(monster) =>
						monster.name === firstGeneratedMonster.name &&
						isCustomSource(monster.source),
				) || firstGeneratedMonster
			: null;

		setSelectedSource("CUSTOM");
		shouldAutoSelectMonsterRef.current = true;
		if (updatedCustomMonsters.length > 0) {
			setAllMonsters((current) => [
				...current.filter((item) => !isCustomSource(item.source)),
				...updatedCustomMonsters,
			]);
		}
		if (selectedGeneratedMonster) {
			selectedMonsterRef.current = selectedGeneratedMonster;
			setSelectedMonster(selectedGeneratedMonster);
		}
		setReloadToken((value) => value + 1);
	};

	const openEditCustomMonster = (monster) => {
		if (!isCustomSource(monster?.source)) return;
		setEditingMonster(monster);
		setEditingMonsterJson(JSON.stringify(monster, null, 2));
		setEditingMonsterError("");
	};

	const closeEditCustomMonster = () => {
		if (isSavingMonsterEdit) return;
		setEditingMonster(null);
		setEditingMonsterJson("");
		setEditingMonsterError("");
	};

	const saveEditedCustomMonster = async () => {
		if (!editingMonster?.name) return;
		setEditingMonsterError("");

		let parsed;
		try {
			parsed = JSON.parse(editingMonsterJson);
		} catch (err) {
			setEditingMonsterError(err.message || lang.t("Invalid JSON."));
			return;
		}

		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			setEditingMonsterError(lang.t("Monster data must be a JSON object."));
			return;
		}
		if (!String(parsed.name || "").trim()) {
			setEditingMonsterError(lang.t("Name is required to create an entry."));
			return;
		}

		setIsSavingMonsterEdit(true);
		try {
			const updatedMonster = await api.updateCustomBestiaryMonster(
				editingMonster.name,
				{ monster: { ...parsed, source: "CUSTOM" } },
			);
			shouldAutoSelectMonsterRef.current = true;
			setAllMonsters((current) => [
				...current.filter(
					(item) =>
						!isCustomSource(item.source) ||
						!(
							item.name === editingMonster.name ||
							item.name === updatedMonster.name
						),
				),
				updatedMonster,
			]);
			setSelectedSource("CUSTOM");
			setSelectedMonster(updatedMonster);
			selectedMonsterRef.current = updatedMonster;
			setEditingMonster(null);
			setEditingMonsterJson("");
			setEditingMonsterError("");
			if (editingMonster.name !== updatedMonster.name) {
				setFavorites((current) =>
					current.map((favorite) =>
						favorite.name === editingMonster.name &&
						isCustomSource(favorite.source)
							? { ...favorite, name: updatedMonster.name, source: "CUSTOM" }
							: favorite,
					),
				);
			}
		} catch (err) {
			setEditingMonsterError(err.message || lang.t("Unknown error"));
		} finally {
			setIsSavingMonsterEdit(false);
		}
	};

	const handleDeleteCustomMonster = async (monster) => {
		if (!isCustomSource(monster?.source) || !monster?.name) return;
		const confirmed = await dispatch(
			confirm({
				title: lang.t("Delete custom creature"),
				message: lang.t("Delete custom creature \"{name}\"?", {
					name: monster.name,
				}),
			}),
		);
		if (!confirmed) return;

		try {
			const updatedCustomMonsters = await api.deleteCustomBestiaryMonster(
				monster.name,
			);
			shouldAutoSelectMonsterRef.current = false;
			selectedMonsterRef.current = "";
			setSelectedMonster("");
			clearMonsterUrlSelection();
			setAllMonsters((current) => [
				...current.filter((item) => !isCustomSource(item.source)),
				...(Array.isArray(updatedCustomMonsters) ? updatedCustomMonsters : []),
			]);
			setFavorites((current) =>
				current.filter(
					(favorite) =>
						!(
							favorite.name === monster.name &&
							isCustomSource(favorite.source)
					),
				),
			);
		} catch (err) {
			dispatch(
				alert({
					title: lang.t("Delete error"),
					message: err.message || lang.t("Unknown error"),
				}),
			);
		}
	};

	useEffect(() => {
		const syncSelectionFromUrl = () => {
			const params = new URLSearchParams(window.location.search);
			const urlMonsterName = params.get("monster");
			const urlMonsterSource = params.get("m_source");
			const currentMonster = selectedMonsterRef.current;

			if (!urlMonsterName) {
				// Якщо нічого не вибрано в URL, але монстри завантажені — вибираємо першого
				if (
					shouldAutoSelectMonsterRef.current &&
					displayedMonsters.length > 0 &&
					!currentMonster?.name
				) {
					setSelectedMonster(displayedMonsters[0]);
				}
				return;
			}

			// Якщо в URL той самий монстр, що вже вибраний - нічого не робимо
			if (monsterMatchesUrl(currentMonster, urlMonsterName, urlMonsterSource)) {
				return;
			}

			// Шукаємо в поточному видимому списку для прокрутки; деталі можна
			// показати й для монстра, який не підпадає під активний пошук.
			const foundInList = displayedMonsters.findIndex(
				(m) => monsterMatchesUrl(m, urlMonsterName, urlMonsterSource),
			);

			const monster =
				displayedMonsters[foundInList] ||
				allMonsters.find((m) =>
					monsterMatchesUrl(m, urlMonsterName, urlMonsterSource),
				);

			if (monster) {
				setSelectedMonster(monster);
				if (foundInList >= 0) {
					setTimeout(() => listRef?.current?.scrollTo(foundInList), 0);
				}
			} else if (monsterMatchesUrl(currentMonster, urlMonsterName, urlMonsterSource)) {
				shouldAutoSelectMonsterRef.current = false;
				setSelectedMonster("");
			}
		};

		// Ініціалізація при зміні списку всіх монстрів
		if (displayedMonsters.length > 0 || allMonsters.length > 0) {
			syncSelectionFromUrl();
		}

		window.addEventListener("popstate", syncSelectionFromUrl);
		return () => window.removeEventListener("popstate", syncSelectionFromUrl);
	}, [allMonsters, displayedMonsters]);

	useEffect(() => {
		if (selectedMonster?.name) {
			const params = new URLSearchParams(window.location.search);
			let changed = false;
			if (params.get("monster") !== selectedMonster.name) {
				params.set("monster", selectedMonster.name);
				changed = true;
			}
			if (params.get("m_source") !== selectedMonster.source) {
				params.set("m_source", selectedMonster.source || "");
				changed = true;
			}
			if (changed) {
				window.history.pushState({}, "", `?${params.toString()}`);
			}
		} else if (selectedMonster === "") {
			const params = new URLSearchParams(window.location.search);
			if (params.has("monster") || params.has("m_source")) {
				clearMonsterUrlSelection();
			}
		}
	}, [selectedMonster]);

	const toggleSort = () => {
		setSortOrder((prev) => {
			if (prev === "none") return "desc";
			if (prev === "desc") return "asc";
			return "none";
		});
	};

	function parseCR(monster) {
		const crValue = monster.cr?.cr !== undefined ? monster.cr.cr : monster.cr;
		if (typeof crValue === "number") return crValue;

		const crStr = String(crValue || "0");
		if (crStr.includes("/")) {
			const [num, den] = crStr.split("/").map(Number);
			return den ? num / den : 0;
		}

		return parseFloat(crStr) || 0;
	}

	const renderMonsterItem = (index) => {
		const monster = displayedMonsters[index];
		const crValue = monster.cr?.cr !== undefined ? monster.cr.cr : monster.cr;
		const isSelected =
			selectedMonster?.name === monster.name &&
			selectedMonster?.source === monster.source;
		const isFavorite = favorites.some(
			(f) =>
				f.name === monster.name &&
				f.source?.toUpperCase() === monster.source?.toUpperCase(),
		);

		return (
			<div key={getMonsterItemKey(monster)}>
				<ListCard
					active={isSelected}
					onClick={() => setSelectedMonster(isSelected ? "" : monster)}
					onDoubleClick={() => onAddMonster && onAddMonster(monster)}
					actions={
						<>
							<Button
								variant="ghost"
								size={Button.SIZES.SMALL}
								icon="star"
								className={classNames("Bestiary__item_fav_btn", {
									"is_active": isFavorite,
								})}
								onClick={(e) => {
									e.stopPropagation();
									handleToggleFavorite(monster);
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
									onClick={(e) => {
										e.stopPropagation();
										onAddMonster(monster);
									}}
									title={lang.t("Add to encounter")}
								/>
							)}
							{isCustomSource(monster.source) && (
								<>
									<Button
										variant="ghost"
										className="Bestiary__item_edit_btn"
										size={Button.SIZES.SMALL}
										icon="edit"
										onClick={(e) => {
											e.stopPropagation();
											openEditCustomMonster(monster);
										}}
										title={lang.t("Edit custom creature")}
									/>
									<Button
										variant="danger"
										className="Bestiary__item_delete_btn"
										size={Button.SIZES.SMALL}
										icon="trash"
										onClick={(e) => {
											e.stopPropagation();
											handleDeleteCustomMonster(monster);
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
									monster.type?.tags?.map((t) => t?.tag || t).join(", "),
									search,
								)}
								{monster.source && (
									<span className="Bestiary__item_source">
										{" "}• {highlightText(monster.source, search)}
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
	};

	const renderBestiaryInner = () => (
		<div className="Bestiary Bestiary__inner">
			<div className="Panel__body">
				<div className="Bestiary__search">
					{sources.length > 0 && (
						<Select
							value={selectedSource}
							onChange={(e) =>
								setSelectedSource(normalizeSourceSelection(e.target.value))
							}
						>
							<option value="all">{lang.t("All sources")}</option>
							<option value="CUSTOM">{lang.t("Custom creatures")}</option>
							{sourceOptions.map((s) => (
								<option key={s} value={s}>
									{s.replace(/^bestiary-/i, "").toUpperCase()}
								</option>
							))}
						</Select>
					)}
					<div className="Bestiary__searchInput">
						<Input
							icon="search-detailed"
							placeholder={lang.t("Search by name or type...")}
							value={search}
							onChange={(e) => setSearch(e.target.value)}
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
							"is_active": sortOrder !== "none",
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
						"Bestiary__content__stacked": isEmbedded,
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
						<div className="muted">
							{lang.t("Indexing database...")}
						</div>
					)}

					{selectedMonster && (
						<div className="Bestiary__detail_container">
							<MonsterStatBlock
								monster={selectedMonster}
								onNameClick={onAddMonster ? (m) => onAddMonster(m) : undefined}
								nameTitle={onAddMonster && lang.t("Add to encounter")}
								onFavoriteChange={(newFavs) => setFavorites(newFavs)}
								showAddToEncounterPicker
								onAddToEncounter={onAddMonster}
								searchHighlight={search}
							/>
						</div>
					)}
				</div>
			</div>
		</div>
	);

	const renderEditCustomMonsterModal = () =>
		editingMonster ? (
			<Modal
				title={lang.t("Edit custom creature")}
				onCancel={closeEditCustomMonster}
				showFooter={false}
				className="Bestiary__edit_modal"
			>
				<div className="Bestiary__edit_form">
					<Input
						type="textarea"
						value={editingMonsterJson}
						onChange={(event) => setEditingMonsterJson(event.target.value)}
						disabled={isSavingMonsterEdit}
						className="Bestiary__edit_json"
					/>
					{editingMonsterError && (
						<div className="Bestiary__edit_error">
							{editingMonsterError}
						</div>
					)}
					<div className="Bestiary__edit_actions">
						<Button
							variant="ghost"
							onClick={closeEditCustomMonster}
							disabled={isSavingMonsterEdit}
						>
							{lang.t("Cancel")}
						</Button>
						<Button
							variant="primary"
							icon="check"
							onClick={saveEditedCustomMonster}
							disabled={isSavingMonsterEdit}
						>
							{isSavingMonsterEdit ? lang.t("Saving...") : lang.t("Save")}
						</Button>
					</div>
				</div>
			</Modal>
		) : null;

	if (isEmbedded) {
		return (
			<>
				{renderBestiaryInner()}
				{renderEditCustomMonsterModal()}
			</>
		);
	}

	return (
		<Panel className="Bestiary">
			<div className="Panel__header">
				<h2>{lang.t("Bestiary")}</h2>
			</div>
			<div className="Panel__body">{renderBestiaryInner()}</div>
			<AiAssistantPanel
				bestiaryMode
				sessionData={{}}
				onInsertResult={handleCustomBestiaryUpdate}
			/>
			{renderEditCustomMonsterModal()}
		</Panel>
	);
}
