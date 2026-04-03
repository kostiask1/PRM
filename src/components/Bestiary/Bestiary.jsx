import { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "../../api";
import ReactList from "react-list";
import Panel from "../Panel/Panel";
import Input from "../Input/Input";
import Button from "../Button/Button";
import Select from "../Select/Select";
import Icon from "../Icon";
import ListCard from "../ListCard/ListCard";
import MonsterStatBlock from "../MonsterStatBlock/MonsterStatBlock";
import "./Bestiary.css";

export default function Bestiary({ onAddMonster, isEmbedded = false, modal }) {
	const [sources, setSources] = useState([]);
	const [selectedSource, setSelectedSource] = useState("all");
	const [allMonsters, setAllMonsters] = useState([]);
	const [monsters, setMonsters] = useState([]);
	const [search, setSearch] = useState("");
	const [typeSearch, setTypeSearch] = useState("");
	const [loading, setLoading] = useState(false);
	const [selectedMonster, setSelectedMonster] = useState(null);
	const [legendaryGroups, setLegendaryGroups] = useState([]);
	const [sortOrder, setSortOrder] = useState("none"); // 'none', 'desc', 'asc'

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
		const loadSourcesAndLegendary = async () => {
			try {
				const [sourcesData, legendaryData] = await Promise.all([
					api.getBestiarySources(),
					api.getLegendaryGroups(),
				]);
				setSources(sourcesData);
				setLegendaryGroups(legendaryData); // Зберігаємо дані легендарних груп
				if (sourcesData.length > 0) {
					const params = new URLSearchParams(window.location.search);
					const sourceFromUrl = params.get("source");
					setSelectedSource(sourceFromUrl || "all");
				}
			} catch (err) {
				console.error("Failed to load bestiary sources or legendary groups", err);
			}
		};
		loadSourcesAndLegendary();
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
				const enrichedMonsters = combinedList.map(monster => {
					// Шукаємо групу: або за спеціальним посиланням legendaryGroup, або за ім'ям самого монстра
					const groupRef = monster.legendaryGroup;
					const targetName = groupRef?.name || monster.name;
					const targetSource = groupRef?.source || monster.source;

					const legendaryEntry = legendaryGroups.find(lg =>
						lg.name === targetName && lg.source === targetSource
					);
					if (legendaryEntry) {
						return { ...monster, lairActions: legendaryEntry.lairActions, regionalEffects: legendaryEntry.regionalEffects };
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
			const matchesName = m.name?.toLowerCase().includes(search.toLowerCase());
			
			// Покращений пошук по типу: об'єднуємо базовий тип (включаючи choose) та теги
			const typeBase = getMonsterTypeString(m.type);
			const tags = Array.isArray(m.type?.tags) ? m.type.tags.join(" ") : "";
			const searchableType = `${typeBase} ${tags}`.toLowerCase();

			const matchesType = typeSearch
				? searchableType.includes(typeSearch.toLowerCase())
				: true;
			return matchesName && matchesType;
		});
		setMonsters(filtered);
	}, [search, typeSearch, allMonsters, getMonsterTypeString]);

	useEffect(() => {
		const initSelection = async () => {
			const params = new URLSearchParams(window.location.search);
			const urlMonsterName = params.get("monster");
			const urlMonsterSource = params.get("m_source");

			if (!urlMonsterName) {
				// Якщо нічого не вибрано в URL, але монстри завантажені — вибираємо першого
				if (allMonsters.length > 0 && !selectedMonster?.name) {
					setSelectedMonster(allMonsters[0]);
				}
				return;
			}

			// Якщо в URL той самий монстр, що вже вибраний - нічого не робимо
			if (selectedMonster?.name === urlMonsterName && selectedMonster?.source === urlMonsterSource) return;

			// Шукаємо в поточному завантаженому списку
			const foundInList = allMonsters.find(
				(m) => m.name === urlMonsterName && (!urlMonsterSource || m.source === urlMonsterSource)
			);
			
			if (foundInList) {
				setSelectedMonster(foundInList);
			}
		};

		// Ініціалізація при зміні списку всіх монстрів
		if (allMonsters.length > 0) initSelection();

		window.addEventListener("popstate", initSelection);
		return () => window.removeEventListener("popstate", initSelection);
		// Видалили selectedMonster?.name із залежностей, щоб уникнути циклу
	}, [allMonsters]);

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
		}
	}, [selectedMonster]);

	const toggleSort = () => {
		setSortOrder((prev) => {
			if (prev === "none") return "desc";
			if (prev === "desc") return "asc";
			return "none";
		});
	};

	const parseCR = (monster) => {
		const crValue = monster.cr?.cr !== undefined ? monster.cr.cr : monster.cr;
		if (typeof crValue === "number") return crValue;
		
		const crStr = String(crValue || "0");
		if (crStr.includes("/")) {
			const [num, den] = crStr.split("/").map(Number);
			return den ? num / den : 0;
		}
		
		return parseFloat(crStr) || 0;
	};

	const displayedMonsters = useMemo(() => {
		if (sortOrder === "none") return [...monsters].sort((a, b) => a.name.localeCompare(b.name));

		return [...monsters].sort((a, b) => {
			const crA = parseCR(a);
			const crB = parseCR(b);
			if (crA === crB) {
				return a.name.localeCompare(b.name);
			}
			return sortOrder === "desc" ? crB - crA : crA - crB;
		});
	}, [monsters, sortOrder]);

	const renderMonsterItem = (index, key) => {
		const monster = displayedMonsters[index];
		const crValue = monster.cr?.cr !== undefined ? monster.cr.cr : monster.cr;

		return (
			<div key={key}>
				<ListCard
					active={selectedMonster?.name === monster.name && selectedMonster?.source === monster.source}
					onClick={() => setSelectedMonster(monster)}
					onDoubleClick={() => onAddMonster && onAddMonster(monster)}
					actions={
						onAddMonster && (
							<Button
								variant="ghost"
								size="small"
								icon="plus"
								onClick={(e) => {
									e.stopPropagation();
									onAddMonster(monster);
								}}
								title="Додати до зіткнення"
							/>
						)
					}>
					<div className="Bestiary__item-content">
						<div className="Bestiary__item-info">
							<div className="ListCard__title">{monster.name}</div>
							<div className="ListCard__meta">
								{Array.isArray(monster.size) ? monster.size[0] : monster.size}
								{" "}{getMonsterTypeString(monster.type)}
								{" "}
								{monster.type?.tags?.join(", ")}
								{monster.source && (
									<span className="Bestiary__item-source">
										{" "}
										• {monster.source}
									</span>
								)}
							</div>
						</div>
						<div className="Bestiary__item-cr" title="Challenge Rating">
							<div className="Bestiary__cr-label">CR</div>
							<div className="Bestiary__cr-value">{crValue}</div>
						</div>
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
							onChange={(e) => setSelectedSource(e.target.value)}>
							<option value="all">УСІ ДЖЕРЕЛА</option>
							{sources.map((s) => (
								<option key={s} value={s}>{s.toUpperCase()}</option>
							))}
						</Select>
					)}
					<Input
						icon="search"
						placeholder="Пошук назви..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
					<Input
						placeholder="Тип (напр. dragon)..."
						value={typeSearch}
						onChange={(e) => setTypeSearch(e.target.value)}
					/>
					<Button
						className={`Bestiary__sort-btn ${sortOrder !== "none" ? "is-active" : ""}`}
						variant="ghost"
						onClick={toggleSort}
						title="Сортувати за CR (Challenge Rating)">
						<span className="Bestiary__sort-label">CR</span>
						<Icon
							name={`sort-${sortOrder}`}
							className={`Bestiary__sort-icon state-${sortOrder}`}
						/>
					</Button>
				</div>

				<div
					className={`Bestiary__content ${isEmbedded ? "Bestiary__content--stacked" : ""}`}>
					<div className="Bestiary__list">
						<ReactList
							itemRenderer={renderMonsterItem}
							length={displayedMonsters.length}
							type="uniform"
						/>
					</div>
					{loading && (
						<div className="Bestiary__loader muted">
							Оновлення бази даних...
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
									title="Додати до зіткнення"
								/>
							)}
							<MonsterStatBlock
								monster={selectedMonster}
								onNameClick={onAddMonster ? (m) => onAddMonster(m) : undefined}
								nameTitle={onAddMonster && "Додати до зіткнення"}
								modal={modal}
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
				<div>
					<h2>Бестіарій</h2>
					<p className="muted">Локальний каталог монстрів</p>
				</div>
			</div>
			<div className="Panel__body">{renderBestiaryInner()}</div>
		</Panel>
	);
}
