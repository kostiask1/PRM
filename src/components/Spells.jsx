import { useState, useEffect, useMemo, useRef } from "react";
import { api } from "../api.js";
import ReactList from "react-list";
import { useSearchParams } from "react-router";
import Panel from "./common/Panel.jsx";
import Input from "./form/Input";
import Button from "./form/Button";
import Select from "./form/Select";
import ListCard from "./common/ListCard.jsx";
import SpellCard from "./SpellCard";
import Icon from "./common/Icon.jsx";
import Tooltip from "./common/Tooltip.jsx";
import { capitalizeWords } from "../utils/parser.jsx";
import "../assets/components/Spells.css";
import classNames from "../utils/classNames";
import { lang } from "../services/localization";
import { objectMatchesSearch } from "../utils/deepSearch.js";
import { highlightText } from "../utils/searchHighlight.jsx";
import useDebounce from "../hooks/useDebounce.js";
import { useAppSelector } from "../store/appStore.js";

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

function spellMatchesUrl(spell, name, source) {
	return (
		spell?.name === name &&
		(!source || source === "all" || spell.source === source)
	);
}

function getSpellItemKey(spell) {
	return `${spell.source || ""}:${spell.name}`;
}

export default function Spells({
	isEmbedded = false,
	onSelectSpell = null,
	initialSearch = "",
	initialDetailedSearch = false,
	hideSearchInput = false,
	renderOptions = {},
}) {
	const [urlSearchParams, setUrlSearchParams] = useSearchParams();
	const useSearchDebounce = useAppSelector(
		(state) => state.ui.useSearchDebounce !== false,
	);
	const urlSpellName = isEmbedded ? "" : urlSearchParams.get("spell") || "";
	const urlSpellSource = isEmbedded ? "" : urlSearchParams.get("s_source") || "";
	const [sources, setSources] = useState([]);
	const [selectedSource, setSelectedSource] = useState(
		() => urlSpellSource || "all",
	);
	const [allSpells, setAllSpells] = useState([]);
	const [spells, setSpells] = useState([]);
	const [selectedLevel, setSelectedLevel] = useState("all");
	const [selectedClass, setSelectedClass] = useState("all");
	const [selectedSchool, setSelectedSchool] = useState("all");
	const [search, setSearch] = useState(initialSearch);
	const debouncedSearch = useDebounce(search, useSearchDebounce ? 250 : 0);
	const [isDetailedSearch, setIsDetailedSearch] = useState(initialDetailedSearch);
	const [loading, setLoading] = useState(false);
	const [selectedSpell, setSelectedSpell] = useState(null);
	const [sortOrder, setSortOrder] = useState("none"); // 'none', 'asc', 'desc'
	const listRef = useRef(null);
	const selectedSpellRef = useRef(null);

	useEffect(() => {
		selectedSpellRef.current = selectedSpell;
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
		if (isEmbedded) return;
		const loadSources = async () => {
			try {
				const data = await api.getSpellSources();
				setSources(data);
			} catch (err) {
				console.error("Failed to load spell sources", err);
			}
		};
		loadSources();
	}, [isEmbedded]);

	useEffect(() => {
		if (!isEmbedded) return;
		const loadSources = async () => {
			try {
				const data = await api.getSpellSources();
				setSources(data);
			} catch (err) {
				console.error("Failed to load spell sources", err);
			}
		};
		loadSources();
	}, [isEmbedded]);

	useEffect(() => {
		if (!isEmbedded) return;
		setSearch(initialSearch);
	}, [initialSearch, isEmbedded]);

	useEffect(() => {
		if (!isEmbedded) return;
		setIsDetailedSearch(Boolean(initialDetailedSearch));
	}, [initialDetailedSearch, isEmbedded]);

	useEffect(() => {
		if (isEmbedded || !urlSpellSource) return;
		setSelectedSource((current) =>
			current === urlSpellSource ? current : urlSpellSource,
		);
	}, [isEmbedded, urlSpellSource]);

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
		if (isEmbedded) return;
		if (urlSpellSource === selectedSource) return;
		setUrlSearchParams(
			(current) => {
				const next = new URLSearchParams(current);
				next.set("s_source", selectedSource);
				return next;
			},
			{ replace: true },
		);
	}, [
		isEmbedded,
		selectedSource,
		setUrlSearchParams,
		urlSpellSource,
	]);

	// Фільтрація
	useEffect(() => {
		const filtered = allSpells.filter((s) => {
			const matchesSource =
				selectedSource === "all" ||
				s.source?.toUpperCase() === selectedSource.toUpperCase();
			const normalizedSearch = debouncedSearch.trim().toLowerCase();
			const matchesSearch =
				!normalizedSearch ||
				(isDetailedSearch
					? objectMatchesSearch(s, normalizedSearch)
					: s.name.toLowerCase().includes(normalizedSearch));
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
		debouncedSearch,
		allSpells,
		selectedLevel,
		selectedSource,
		selectedClass,
		selectedSchool,
		isDetailedSearch,
	]);

	// початковий вибір
	useEffect(() => {
		if (isEmbedded) {
			if (displayedSpells.length > 0 && !selectedSpellRef.current?.name) {
				setSelectedSpell(displayedSpells[0]);
			}
			return undefined;
		}

		const syncSelectionFromUrl = () => {
			const currentSpell = selectedSpellRef.current;

			if (!urlSpellName) {
				if (displayedSpells.length > 0 && !currentSpell?.name) {
					setSelectedSpell(displayedSpells[0]);
				}
				return;
			}

			if (spellMatchesUrl(currentSpell, urlSpellName, urlSpellSource)) {
				return;
			}

			const spellToSelect = displayedSpells.findIndex((s) =>
				spellMatchesUrl(s, urlSpellName, urlSpellSource),
			);
			const spell =
				displayedSpells[spellToSelect] ||
				allSpells.find((s) => spellMatchesUrl(s, urlSpellName, urlSpellSource));

			if (spell) {
				setSelectedSpell(spell);
				if (spellToSelect >= 0) {
					setTimeout(() => listRef?.current?.scrollTo(spellToSelect), 0);
				}
			}
		};

		if (displayedSpells.length > 0 || allSpells.length > 0) {
			syncSelectionFromUrl();
		}

		return undefined;
	}, [
		allSpells,
		displayedSpells,
		isEmbedded,
		urlSpellName,
		urlSpellSource,
	]);

	useEffect(() => {
		if (isEmbedded) return;
		if (selectedSpell?.name) {
			if (urlSpellName === selectedSpell.name) return;
			setUrlSearchParams((current) => {
				const next = new URLSearchParams(current);
				next.set("spell", selectedSpell.name);
				return next;
			});
		} else if (selectedSpell === "") {
			if (!urlSpellName) return;
			setUrlSearchParams((current) => {
				const next = new URLSearchParams(current);
				next.delete("spell");
				return next;
			});
		}
	}, [
		isEmbedded,
		selectedSpell,
		setUrlSearchParams,
		urlSpellName,
	]);

	const toggleSort = () => {
		setSortOrder((prev) =>
			prev === "none" ? "asc" : prev === "asc" ? "desc" : "none",
		);
	};

	const renderSpellItem = (index) => {
		const spell = displayedSpells[index];
		if (!spell) return null;
		const schoolName = SCHOOL_MAP[spell.school];
		const isSelected =
			selectedSpell?.name === spell.name &&
			selectedSpell?.source === spell.source;

		return (
			<div
				key={getSpellItemKey(spell)}
				onDoubleClick={() => onSelectSpell?.(spell)}
			>
				<ListCard
					active={isSelected}
					onClick={() => setSelectedSpell(isSelected ? "" : spell)}
				>
					<div className="ListCard__title">
						{highlightText(
							capitalizeWords(spell.name.split("|")[0]),
							debouncedSearch,
						)}
					</div>
					<div className="ListCard__meta">
						{highlightText(
							spell.level === 0
								? lang.t("Cantrip")
								: lang.t("{level}-level", { level: spell.level }),
							debouncedSearch,
						)}
						{schoolName && (
							<> • {highlightText(schoolName, debouncedSearch)}</>
						)}
						{spell.classes?.length > 0 && (
							<>
								{" "}
								• {highlightText(spell.classes.join(", "), debouncedSearch)}
							</>
						)}
					</div>
				</ListCard>
			</div>
		);
	};

	const content = (
		<>
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
						className="Spells__level_select"
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
						className="Spells__class_select"
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
						className="Spells__school_select"
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
							className={classNames("Spells__sort_btn", {
								is_active: sortOrder !== "none",
							})}
							onClick={toggleSort}
						>
							LVL <Icon name={`sort-${sortOrder}`} />
						</button>
					</Tooltip>
					{!hideSearchInput && (
						<div className="Spells__searchInput">
							<Input
								placeholder={lang.t("Search spell...")}
								value={search}
								onChange={(e) => setSearch(e.target.value)}
							/>
							<Button
								variant={isDetailedSearch ? "primary" : "ghost"}
								icon="search-detailed"
								onClick={() => setIsDetailedSearch((value) => !value)}
								title={lang.t("Detailed search")}
								className="DetailedSearchButton Spells__detailed_search_btn"
							/>
						</div>
					)}
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
							<>
								{onSelectSpell && (
									<div className="Spells__select_actions">
										<Button
											variant="primary"
											icon="plus"
											onClick={() => onSelectSpell(selectedSpell)}
										>
											{lang.t("Insert")}
										</Button>
									</div>
								)}
								<SpellCard
									spell={selectedSpell}
									searchHighlight={debouncedSearch}
									renderOptions={renderOptions}
								/>
							</>
						) : (
							<p className="muted">
								{lang.t("Select a spell from the list to view details.")}
							</p>
						)}
					</div>
				</div>
		</>
	);

	if (isEmbedded) {
		return (
			<div className="Spells Spells__embedded">
				<div className="Spells__body">{content}</div>
			</div>
		);
	}

	return (
		<Panel className="Spells">
			<div className="Panel__header">
				<h2>{lang.t("Spells")}</h2>
			</div>
			<div className="Panel__body Spells__body">{content}</div>
		</Panel>
	);
}
