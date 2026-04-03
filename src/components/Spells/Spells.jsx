import { useState, useEffect, useMemo } from "react";
import { api } from "../../api";
import ReactList from "react-list";
import Panel from "../Panel/Panel";
import Input from "../Input/Input";
import Select from "../Select/Select";
import ListCard from "../ListCard/ListCard";
import SpellCard from "../SpellCard/SpellCard";
import Icon from "../Icon";
import { capitalizeWords } from "../../utils/diceParser.jsx";
import "./Spells.css";

export default function Spells() {
	const [sources, setSources] = useState([]);
	const [selectedSource, setSelectedSource] = useState("all");
	const [allSpells, setAllSpells] = useState([]);
	const [spells, setSpells] = useState([]);
	const [search, setSearch] = useState("");
	const [loading, setLoading] = useState(false);
	const [selectedSpell, setSelectedSpell] = useState(null);
	const [sortOrder, setSortOrder] = useState("none"); // 'none', 'asc', 'desc'

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
					const results = await Promise.all(sources.map(s => api.getSpellData(s)));
					results.forEach(data => {
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

	// Фільтрація та початковий вибір
	useEffect(() => {
		const filtered = allSpells.filter(s => 
			s.name.toLowerCase().includes(search.toLowerCase())
		);
		setSpells(filtered);

		// Початковий вибір заклинання, якщо ще нічого не вибрано
		// Ця логіка повинна виконуватися лише при зміні allSpells або search,
		// але не при зміні selectedSpell, щоб уникнути рекурсії.
		// Перевіряємо, чи selectedSpell вже встановлено, щоб не перезаписувати вибір користувача.
		const params = new URLSearchParams(window.location.search);
		const urlSpellName = params.get("spell");
		const urlSpellSource = params.get("s_source");
		let spellToSelect = null;

		if (!urlSpellName && allSpells.length > 0 && !selectedSpell) {
			setSelectedSpell(allSpells[0]);
			return;
		}

		if (urlSpellName && (!selectedSpell || selectedSpell.name !== urlSpellName)) {
			spellToSelect = allSpells.find(s => 
				s.name === urlSpellName && (!urlSpellSource || s.source === urlSpellSource)
			);

			if (spellToSelect) {
				setSelectedSpell(spellToSelect);
			}
		}
	}, [search, allSpells]);

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
		}
	}, [selectedSpell]);

	const displayedSpells = useMemo(() => {
		let result = [...spells];
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

	const toggleSort = () => {
		setSortOrder((prev) =>
			prev === "none" ? "asc" : prev === "asc" ? "desc" : "none",
		);
	};

	const renderSpellItem = (index, key) => {
		const spell = displayedSpells[index];
		const schoolMap = { "E": "Enchantment", "N": "Necromancy", "C": "Conjuration", "A": "Abjuration", "I": "Illusion", "D": "Divination", "P": "Transmutation", "T": "Thaumaturgy" };
		const schoolName = schoolMap[spell.school] || spell.school;

		return (
			<div key={key}>
				<ListCard
					active={selectedSpell?.name === spell.name && selectedSpell?.source === spell.source}
					onClick={() => setSelectedSpell(spell)}>
					<div className="ListCard__title">{capitalizeWords(spell.name.split('|')[0])}</div>
					<div className="ListCard__meta">
						{spell.level === 0 ? "Замовляння" : `${spell.level}-й рівень`} • {schoolName}
						{spell.source && <span className="Bestiary__item-source"> • {spell.source}</span>}
					</div>
				</ListCard>
			</div>
		);
	};

	return (
		<Panel className="Spells">
			<div className="Panel__header">
				<div>
					<h2>Заклинання</h2>
					<p className="muted">Каталог заклинань D&D 5e (SRD)</p>
				</div>
			</div>
			<div className="Panel__body Spells__body">
				<div className="Spells__search">
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
						placeholder="Пошук заклинання..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
					<button
						className={`Spells__sort-btn ${sortOrder !== "none" ? "is-active" : ""}`}
						onClick={toggleSort}
						title="Сортувати за рівнем">
						LVL <Icon name={`sort-${sortOrder}`} />
					</button>
				</div>
				<div className="Spells__content">
					<div className="Spells__list">
						<ReactList
							itemRenderer={renderSpellItem}
							length={displayedSpells.length}
							type="uniform"
						/>
					</div>
					{loading && <div className="Bestiary__loader muted">Оновлення магії...</div>}

					<div className="Spells__detail">
						{selectedSpell ? (
							<SpellCard
								spell={selectedSpell}
								onSpellClick={async (name) => {
									const cleanName = name.split('|')[0].toLowerCase();
									// 1. Шукаємо в поточному завантаженому списку (найшвидше)
									let found = allSpells.find(item => item.name.split('|')[0].toLowerCase() === cleanName);

									if (!found) {
										// 2. Якщо не знайшли локально, шукаємо по всіх джерелах через API
										try {
											const results = await api.searchSpells({ name: cleanName });
											// Шукаємо точний збіг назви серед результатів пошуку
											found = results.find(s => s.name.split('|')[0].toLowerCase() === cleanName) || results[0];
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
