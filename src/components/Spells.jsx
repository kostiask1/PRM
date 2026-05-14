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
import { lang } from "../services/localization";

const SCHOOL_MAP = {
	A: "Abjuration",
	C: "Conjuration",
	D: "Divination",
	E: "Enchantment",
	I: "Illusion",
	N: "Necromancy",
	P: "Transmutation",
	T: "Thaumaturgy",
	V: "Evocation",
};

export default function Spells() {
	const [sources, setSources] = useState([]);
	const [selectedSource, setSelectedSource] = useState("all");
	const [allSpells, setAllSpells] = useState([]);
	const [spells, setSpells] = useState([]);
	const [selectedLevel, setSelectedLevel] = useState("all");
	const [selectedClass, setSelectedClass] = useState("all");
	const [selectedSchool, setSelectedSchool] = useState("all");
	const [search, setSearch] = useState("");
	const [loading, setLoading] = useState(false);
	const [selectedSpell, setSelectedSpell] = useState(null);
	const [sortOrder, setSortOrder] = useState("none"); // 'none', 'asc', 'desc'
	const listRef = useRef(null);

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

	const classOptions = useMemo(
		() =>
			[
				...new Set(
					allSpells.flatMap((spell) =>
						Array.isArray(spell.classes) ? spell.classes : [],
					),
				),
			].sort((a, b) => a.localeCompare(b)),
		[allSpells],
	);

	const schoolOptions = useMemo(
		() =>
			[...new Set(allSpells.map((spell) => spell.school).filter(Boolean))]
				.filter((school) => SCHOOL_MAP[school])
				.sort((a, b) => SCHOOL_MAP[a].localeCompare(SCHOOL_MAP[b])),
		[allSpells],
	);

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

	// Завантаження всіх заклинань один раз; джерела далі фільтруються локально
	useEffect(() => {
		if (sources.length === 0) return;

		const loadData = async () => {
			setLoading(true);
			try {
				const combinedList = await api.getSpellData("all");
				setAllSpells(combinedList);
			} catch (error) {
				console.error("Failed to load local spells", error);
			} finally {
				setLoading(false);
			}
		};
		loadData();
	}, [sources]);

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		params.set("s_source", selectedSource);
		window.history.replaceState({}, "", `?${params.toString()}`);
	}, [selectedSource]);

	// Фільтрація
	useEffect(() => {
		const filtered = allSpells.filter((s) => {
			const matchesSource =
				selectedSource === "all" ||
				s.source?.toUpperCase() === selectedSource.toUpperCase();
			const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
			const matchesLevel =
				selectedLevel === "all" || String(s.level) === selectedLevel;
			const matchesClass =
				selectedClass === "all" || s.classes?.includes(selectedClass);
			const matchesSchool =
				selectedSchool === "all" || s.school === selectedSchool;
			return (
				matchesSource &&
				matchesSearch &&
				matchesLevel &&
				matchesClass &&
				matchesSchool
			);
		});
		setSpells(filtered);
	}, [
		search,
		allSpells,
		selectedLevel,
		selectedSource,
		selectedClass,
		selectedSchool,
	]);

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
		const schoolName = SCHOOL_MAP[spell.school];
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
						{spell.level === 0
							? lang.t("Cantrip")
							: lang.t("{level}-level", { level: spell.level })}
						{schoolName && <> • {schoolName}</>}
						{spell.classes?.length > 0 && <> • {spell.classes.join(", ")}</>}
					</div>
				</ListCard>
			</div>
		);
	};

	return (
		<Panel className="Spells">
			<div className="Panel__header">
				<h2>{lang.t("Spells")}</h2>
			</div>
			<div className="Panel__body Spells__body">
				<div className="Spells__search">
					{sources.length > 0 && (
						<Select
							value={selectedSource}
							onChange={(e) => setSelectedSource(e.target.value)}
						>
							<option value="all">{lang.t("All sources")}</option>
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
						<option value="all">{lang.t("All levels")}</option>
						<option value="0">{lang.t("Cantrip (0)")}</option>
						{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((lvl) => (
							<option key={lvl} value={String(lvl)}>
								{lang.t("Level {level}", { level: lvl })}
							</option>
						))}
					</Select>
					<Select
						value={selectedClass}
						onChange={(e) => setSelectedClass(e.target.value)}
						className="Spells__class-select"
					>
						<option value="all">{lang.t("All classes")}</option>
						{classOptions.map((className) => (
							<option key={className} value={className}>
								{className}
							</option>
						))}
					</Select>
					<Select
						value={selectedSchool}
						onChange={(e) => setSelectedSchool(e.target.value)}
						className="Spells__school-select"
					>
						<option value="all">{lang.t("All schools")}</option>
						{schoolOptions.map((school) => (
							<option key={school} value={school}>
								{SCHOOL_MAP[school]}
							</option>
						))}
					</Select>
					<Tooltip content={lang.t("Sort by level")}>
						<button
							className={classNames("Spells__sort-btn", {
								"is-active": sortOrder !== "none",
							})}
							onClick={toggleSort}
						>
							LVL <Icon name={`sort-${sortOrder}`} />
						</button>
					</Tooltip>
					<Input
						placeholder={lang.t("Search spell...")}
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
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
						<div className="muted">{lang.t("Updating spells...")}</div>
					)}

					<div className="Spells__detail">
						{selectedSpell ? (
							<SpellCard spell={selectedSpell} />
						) : (
							<p className="muted">
								{lang.t("Select a spell from the list to view details.")}
							</p>
						)}
					</div>
				</div>
			</div>
		</Panel>
	);
}
