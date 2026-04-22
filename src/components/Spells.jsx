import { useState, useEffect, useMemo, useRef } from "react";
import { api } from "../api.js";
import ReactList from "react-list";
import Panel from "./common/Panel.jsx";
import Input from "./form/Input";
import Select from "./form/Select";
import ListCard from "./common/ListCard.jsx";
import SpellCard from "./SpellCard";
import Icon from "./common/Icon.jsx";
import Tooltip from "./common/Tooltip.jsx";
import { capitalizeWords } from "../utils/parser.jsx";
import "../assets/components/Spells.css";
import classNames from "../utils/classNames";

export default function Spells() {
	const [sources, setSources] = useState([]);
	const [selectedSource, setSelectedSource] = useState("all");
	const [allSpells, setAllSpells] = useState([]);
	const [spells, setSpells] = useState([]);
	const [selectedLevel, setSelectedLevel] = useState("all");
	const [search, setSearch] = useState("");
	const [loading, setLoading] = useState(false);
	const [selectedSpell, setSelectedSpell] = useState(null);
	const [sortOrder, setSortOrder] = useState("none"); // 'none', 'asc', 'desc'
	const listRef = useRef(null);

	const displayedSpells = useMemo(() => {
		let result = [...spells].sort((a, b) => a.name.localeCompare(b.name));
		if (sortOrder !== "none") {
			result.sort((a, b) => {
				const lvlA = a.level ?? 0;
				const lvlB = b.level ?? 0;
				if (lvlA === lvlB) return a.name.localeCompare(b.name);
				return sortOrder === "asc" ? lvlA - lvlB : lvlB - lvlA;
			});
		}
		return result;
	}, [spells, sortOrder]);

	// Завантаження списку доступних джерел
	useEffect(() => {
		const loadSources = async () => {
			try {
				const data = await api.getSpellSources();
				setSources(data);
				const params = new URLSearchParams(window.location.search);
				const sourceFromUrl = params.get("s_source");
				if (sourceFromUrl) setSelectedSource(sourceFromUrl);
			} catch (err) {
				console.error("Failed to load spell sources", err);
			}
		};
		loadSources();
	}, []);

	// Завантаження даних заклинань
	useEffect(() => {
		const isAll = selectedSource === "all";
		if (isAll && sources.length === 0) return;

		const params = new URLSearchParams(window.location.search);
		params.set("s_source", selectedSource);
		window.history.replaceState({}, "", `?${params.toString()}`);

		const loadData = async () => {
			setLoading(true);
			try {
				let combinedList = [];
				if (isAll) {
					const results = await Promise.all(
						sources.map((s) => api.getSpellData(s)),
					);
					results.forEach((data) => {
						combinedList.push(...data);
					});
				} else {
					const data = await api.getSpellData(selectedSource);
					combinedList = data;
				}
				setAllSpells(combinedList);
			} catch (error) {
				console.error("Failed to load local spells", error);
			} finally {
				setLoading(false);
			}
		};
		loadData();
	}, [selectedSource, sources]);

	// Фільтрація
	useEffect(() => {
		const filtered = allSpells.filter((s) => {
			const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
			const matchesLevel =
				selectedLevel === "all" || String(s.level) === selectedLevel;
			return matchesSearch && matchesLevel;
		});
		setSpells(filtered);
	}, [search, allSpells, selectedLevel]);

	// початковий вибір
	useEffect(() => {
		// Початковий вибір заклинання, якщо ще нічого не вибрано
		// Ця логіка повинна виконуватися лише при зміні displayedSpells або search,
		// але не при зміні selectedSpell, щоб уникнути рекурсії.
		// Перевіряємо, чи selectedSpell вже встановлено, щоб не перезаписувати вибір користувача.
		const params = new URLSearchParams(window.location.search);
		const urlSpellName = params.get("spell");
		const urlSpellSource = params.get("s_source");
		let spellToSelect = null;

		if (!urlSpellName && displayedSpells.length > 0 && !selectedSpell) {
			setSelectedSpell(displayedSpells[0]);
			return;
		}

		if (
			urlSpellName &&
			(!selectedSpell || selectedSpell.name !== urlSpellName)
		) {
			spellToSelect = displayedSpells.findIndex(
				(s) =>
					s.name === urlSpellName &&
					(!urlSpellSource ||
						urlSpellSource === "all" ||
						s.source === urlSpellSource),
			);
			const spell = displayedSpells[spellToSelect];

			if (spell) {
				setSelectedSpell(spell);
				setTimeout(() => listRef?.current?.scrollTo(spellToSelect), 0);
			}
		}
	}, [search, displayedSpells, selectedLevel]);

	useEffect(() => {
		if (selectedSpell?.name) {
			const params = new URLSearchParams(window.location.search);
			let changed = false;
			if (params.get("spell") !== selectedSpell.name) {
				params.set("spell", selectedSpell.name);
				changed = true;
			}
			if (changed) {
				window.history.pushState({}, "", `?${params.toString()}`);
			}
		} else if (selectedSpell === "") {
			const params = new URLSearchParams(window.location.search);
			params.delete("spell");

			window.history.pushState({}, "", `?${params.toString()}`);
		}
	}, [selectedSpell]);

	const toggleSort = () => {
		setSortOrder((prev) =>
			prev === "none" ? "asc" : prev === "asc" ? "desc" : "none",
		);
	};

	const renderSpellItem = (index, key) => {
		const spell = displayedSpells[index];
		const schoolMap = {
			E: "Enchantment",
			N: "Necromancy",
			C: "Conjuration",
			A: "Abjuration",
			I: "Illusion",
			D: "Divination",
			P: "Transmutation",
			T: "Thaumaturgy",
		};
		const schoolName = schoolMap[spell.school] || spell.school;
		const isSelected =
			selectedSpell?.name === spell.name &&
			selectedSpell?.source === spell.source;

		return (
			<div key={key}>
				<ListCard
					active={isSelected}
					onClick={() => setSelectedSpell(isSelected ? "" : spell)}
				>
					<div className="ListCard__title">
						{capitalizeWords(spell.name.split("|")[0])}
					</div>
					<div className="ListCard__meta">
						{spell.level === 0 ? "Замовляння" : `${spell.level}-й рівень`} •{" "}
						{schoolName}
						{spell.source && (
							<span className="Bestiary__item-source"> • {spell.source}</span>
						)}
					</div>
				</ListCard>
			</div>
		);
	};

	return (
		<Panel className="Spells">
			<div className="Panel__header">
				<h2>Заклинання</h2>
			</div>
			<div className="Panel__body Spells__body">
				<div className="Spells__search">
					{sources.length > 0 && (
						<Select
							value={selectedSource}
							onChange={(e) => setSelectedSource(e.target.value)}
						>
							<option value="all">УСІ ДЖЕРЕЛА</option>
							{sources.map((s) => (
								<option key={s} value={s}>
									{s.toUpperCase()}
								</option>
							))}
						</Select>
					)}
					<Select
						value={selectedLevel}
						onChange={(e) => setSelectedLevel(e.target.value)}
						className="Spells__level-select"
					>
						<option value="all">УСІ РІВНІ</option>
						<option value="0">Замовляння (0)</option>
						{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((lvl) => (
							<option key={lvl} value={String(lvl)}>
								Рівень {lvl}
							</option>
						))}
					</Select>
					<Input
						placeholder="Пошук заклинання..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
					<Tooltip content="Сортувати за рівнем">
						<button
							className={classNames("Spells__sort-btn", {
								"is-active": sortOrder !== "none",
							})}
							onClick={toggleSort}
						>
							LVL <Icon name={`sort-${sortOrder}`} />
						</button>
					</Tooltip>
				</div>
				<div className="Spells__content">
					<div className="Spells__list">
						<ReactList
							ref={listRef}
							itemRenderer={renderSpellItem}
							length={displayedSpells.length}
							type="uniform"
						/>
					</div>
					{loading && (
						<div className="Bestiary__loader muted">Оновлення магії...</div>
					)}

					<div className="Spells__detail">
						{selectedSpell ? (
							<SpellCard
								spell={selectedSpell}
								onSpellClick={async (name) => {
									const cleanName = name.split("|")[0].toLowerCase();
									// 1. Шукаємо в поточному завантаженому списку (найшвидше)
									let found = allSpells.find(
										(item) =>
											item.name.split("|")[0].toLowerCase() === cleanName,
									);

									if (!found) {
										// 2. Якщо не знайшли локально, шукаємо по всіх джерелах через API
										try {
											const results = await api.searchSpells({
												name: cleanName,
											});
											// Шукаємо точний збіг назви серед результатів пошуку
											found =
												results.find(
													(s) =>
														s.name.split("|")[0].toLowerCase() === cleanName,
												) || results[0];
										} catch (err) {
											console.error("Global spell search failed", err);
										}
									}

									if (found) setSelectedSpell(found);
								}}
							/>
						) : (
							<p className="muted">
								Оберіть заклинання зі списку, щоб переглянути опис.
							</p>
						)}
					</div>
				</div>
			</div>
		</Panel>
	);
}
