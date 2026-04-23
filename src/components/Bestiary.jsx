import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { api } from "../api";
import ReactList from "react-list";
import Panel from "./common/Panel";
import Input from "./form/Input";
import Button from "./form/Button";
import Select from "./form/Select";
import Icon from "./common/Icon";
import ListCard from "./common/ListCard";
import MonsterStatBlock from "./MonsterStatBlock";
import Tooltip from "./common/Tooltip";
import classNames from "../utils/classNames";
import "../assets/components/Bestiary.css";
import { lang } from "../services/localization";

export default function Bestiary({ onAddMonster, isEmbedded = false }) {
	const [sources, setSources] = useState([]);
	const [selectedSource, setSelectedSource] = useState("all");
	const [allMonsters, setAllMonsters] = useState([]);
	const [monsters, setMonsters] = useState([]);
	const [search, setSearch] = useState("");
	const [loading, setLoading] = useState(false);
	const [selectedMonster, setSelectedMonster] = useState(null);
	const [legendaryGroups, setLegendaryGroups] = useState([]);
	const [favorites, setFavorites] = useState([]);
	const [onlyFavorites, setOnlyFavorites] = useState(false);
	const [sortOrder, setSortOrder] = useState("none"); // 'none', 'desc', 'asc'
	const listRef = useRef(null);

	const displayedMonsters = useMemo(() => {
		let list = [...monsters];
		if (sortOrder === "none")
			list = list.sort((a, b) => a.name.localeCompare(b.name));

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
	const getMonsterTypeString = useCallback((monsterType) => {
		if (!monsterType) return "";
		if (typeof monsterType === "string") return monsterType;
		if (typeof monsterType === "object") {
			const t = monsterType.type;
			if (typeof t === "string") return t;
			if (typeof t === "object" && t.choose) return t.choose.join("/");
		}
		return "";
	}, []);

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
					setSelectedSource(sourceFromUrl || "all");
				}
			} catch (err) {
				console.error(
					"Failed to load bestiary sources or legendary groups",
					err,
				);
			}
		};
		loadInitialData();
	}, []); // Залежності порожні, щоб завантажувати один раз

	// Завантаження повного списку монстрів з обраного джерела
	useEffect(() => {
		const isAll = selectedSource === "all";
		if (isAll && sources.length === 0) return;

		const params = new URLSearchParams(window.location.search);
		params.set("source", selectedSource);
		window.history.replaceState({}, "", `?${params.toString()}`);

		const loadData = async () => {
			setLoading(true);
			try {
				let combinedList = [];

				if (isAll) {
					const results = await Promise.all(
						sources.map((s) => api.getBestiaryData(s)),
					);
					results.forEach((data) => {
						const list = Array.isArray(data)
							? data
							: data.monster || data.monsters || data.results || [];
						combinedList.push(...list);
					});
				} else {
					const data = await api.getBestiaryData(selectedSource);
					combinedList = Array.isArray(data)
						? data
						: data.monster || data.monsters || data.results || [];
				}

				// Об'єднуємо дані монстрів з легендарними діями/регіональними ефектами

				// TODO: Реалізувати resolution для _copy монстрів на сервері
				const enrichedMonsters = combinedList.map((monster) => {
					// Шукаємо групу: або за спеціальним посиланням legendaryGroup, або за ім'ям самого монстра
					const groupRef = monster.legendaryGroup;
					const targetName = groupRef?.name || monster.name;
					const targetSource = groupRef?.source || monster.source;

					const legendaryEntry = legendaryGroups.find(
						(lg) => lg.name === targetName && lg.source === targetSource,
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
	}, [selectedSource, sources, legendaryGroups]); // Додаємо legendaryGroups до залежностей

	// Локальна фільтрація списку за пошуковим запитом
	useEffect(() => {
		const filtered = allMonsters.filter((m) => {
			const isFav = favorites.some(
				(f) =>
					f.name === m.name &&
					f.source?.toUpperCase() === m.source?.toUpperCase(),
			);
			if (onlyFavorites && !isFav) return false;

			const normalizedSearch = search.trim().toLowerCase();

			// Покращений пошук по типу: об'єднуємо базовий тип (включаючи choose) та теги
			const typeBase = getMonsterTypeString(m.type);
			const tags = Array.isArray(m.type?.tags) ? m.type.tags.join(" ") : "";
			const searchableText = [m.name, typeBase, tags]
				.filter(Boolean)
				.join(" ")
				.toLowerCase();

			if (!normalizedSearch) return true;
			return searchableText.includes(normalizedSearch);
		});
		setMonsters(filtered);
	}, [
		search,
		allMonsters,
		getMonsterTypeString,
		onlyFavorites,
		favorites,
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

	useEffect(() => {
		const initSelection = async () => {
			const params = new URLSearchParams(window.location.search);
			const urlMonsterName = params.get("monster");
			const urlMonsterSource = params.get("m_source");

			if (!urlMonsterName) {
				// Якщо нічого не вибрано в URL, але монстри завантажені — вибираємо першого
				if (displayedMonsters.length > 0 && !selectedMonster?.name) {
					setSelectedMonster(displayedMonsters[0]);
				}
				return;
			}

			// Якщо в URL той самий монстр, що вже вибраний - нічого не робимо
			if (
				selectedMonster?.name === urlMonsterName &&
				selectedMonster?.source === urlMonsterSource
			)
				return;

			// Шукаємо в поточному завантаженому списку
			const foundInList = displayedMonsters.findIndex(
				(m) =>
					m.name === urlMonsterName &&
					(!urlMonsterSource || m.source === urlMonsterSource),
			);

			const monster = displayedMonsters[foundInList];

			if (monster) {
				setSelectedMonster(monster);
				setTimeout(() => listRef?.current?.scrollTo(foundInList), 0);
			}
		};

		// Ініціалізація при зміні списку всіх монстрів
		if (displayedMonsters.length > 0) initSelection();

		window.addEventListener("popstate", initSelection);
		return () => window.removeEventListener("popstate", initSelection);
		// Видалили selectedMonster?.name із залежностей, щоб уникнути циклу
	}, [displayedMonsters]);

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
			params.delete("monster");

			window.history.pushState({}, "", `?${params.toString()}`);
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

	const renderMonsterItem = (index, key) => {
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
			<div key={key}>
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
								className={classNames("Bestiary__item-fav-btn", {
									"is-active": isFavorite,
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
						</>
					}
				>
					<div className="Bestiary__item-content">
						<div className="Bestiary__item-info">
							<div className="ListCard__title">{monster.name}</div>
							<div className="ListCard__meta">
								{Array.isArray(monster.size) ? monster.size[0] : monster.size}{" "}
								{getMonsterTypeString(monster.type)}{" "}
								{monster.type?.tags?.join(", ")}
								{monster.source && (
									<span className="Bestiary__item-source">
										{" "}
										• {monster.source}
									</span>
								)}
							</div>
						</div>
						<Tooltip content={lang.t("Challenge Rating")}>
							<div className="Bestiary__item-cr">
								<div className="Bestiary__cr-label">CR</div>
								<div className="Bestiary__cr-value">{crValue || "--"}</div>
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
							onChange={(e) => setSelectedSource(e.target.value)}
						>
							<option value="all">{lang.t("All sources")}</option>
							{sources.map((s) => (
								<option key={s} value={s}>
									{s.replace(/^bestiary-/i, "").toUpperCase()}
								</option>
							))}
						</Select>
					)}
					<Input
						icon="search"
						placeholder={lang.t("Search by name or type...")}
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
					<Button
						variant={onlyFavorites ? "primary" : "ghost"}
						icon="star"
						onClick={() => setOnlyFavorites(!onlyFavorites)}
						title={lang.t("Only favorites")}
						className="Bestiary__filter-fav-btn"
					/>
					<Button
						className={classNames("Bestiary__sort-btn", {
							"is-active": sortOrder !== "none",
						})}
						variant="ghost"
						onClick={toggleSort}
						title={lang.t("Sort by CR (Challenge Rating)")}
					>
						<span className="Bestiary__sort-label">CR</span>
						<Icon
							name={`sort-${sortOrder}`}
							className={classNames(
								"Bestiary__sort-icon",
								`state-${sortOrder}`,
							)}
						/>
					</Button>
				</div>

				<div
					className={classNames("Bestiary__content", {
						"Bestiary__content--stacked": isEmbedded,
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
						<div className="Bestiary__loader muted">
							{lang.t("Indexing database...")}
						</div>
					)}

					{selectedMonster && (
						<div className="Bestiary__detail-container">
							{onAddMonster && (
								<Button
									variant="primary"
									icon="plus"
									onClick={() => onAddMonster(selectedMonster)}
									className="Bestiary__add-to-encounter-btn"
									title={lang.t("Add to encounter")}
								/>
							)}
							<MonsterStatBlock
								monster={selectedMonster}
								onNameClick={onAddMonster ? (m) => onAddMonster(m) : undefined}
								nameTitle={onAddMonster && lang.t("Add to encounter")}
								onFavoriteChange={(newFavs) => setFavorites(newFavs)}
							/>
						</div>
					)}
				</div>
			</div>
		</div>
	);

	if (isEmbedded) {
		return <>{renderBestiaryInner()}</>;
	}

	return (
		<Panel className="Bestiary">
			<div className="Panel__header">
				<h2>{lang.t("Bestiary")}</h2>
			</div>
			<div className="Panel__body">{renderBestiaryInner()}</div>
		</Panel>
	);
}
