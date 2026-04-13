import React, { useState, useEffect } from "react";
import { api } from "../api.js";
import RollDice from "./RollDice";
import Icon from "./Icon.jsx";
import SpellCard from "./SpellCard";
import {
	getAbilityModifier,
	formatModifier,
	getDamageBonus,
	parseRollsAndSpells,
	capitalizeWords,
	preprocessTags,
	renderRecursiveContent,
} from "../utils/parser.jsx";
import "../assets/components/MonsterStatBlock.css";
import ClickToCopy from "./ClickToCopy.jsx";

const SPELL_CACHE = new Map();

export default function MonsterStatBlock({
	monster,
	onNameClick,
	nameTitle,
	modal,
}) {
	const [hasImageError, setHasImageError] = useState(false);
	const [spells, setSpells] = useState([]);
	const [loadingSpells, setLoadingSpells] = useState(false);

	const handleSpellClick = async (spellOrName) => {
		let spell = spellOrName;

		// Якщо передано назву (рядок), намагаємось знайти базові дані
		if (typeof spellOrName === "string") {
			const cleanName = spellOrName.split("|")[0];
			try {
				const results = await api.searchSpells({ name: cleanName });
				spell = results?.[0];
				if (!spell) throw new Error("Spell not found");
			} catch (e) {
				console.error("Failed to fetch linked spell", e);
				return;
			}
		}

		modal?.confirm(
			capitalizeWords(spell.name.split("|")[0]),
			<SpellCard spell={spell} onSpellClick={handleSpellClick} />,
		);
	};

	useEffect(() => {
		setHasImageError(false); // Скидаємо стан помилки зображення при зміні монстра
		setSpells([]);

		if (monster.spell_list && monster.spell_list.length > 0) {
			const fetchSpells = async () => {
				setLoadingSpells(true);
				try {
					const loaded = await Promise.all(
						monster.spell_list.map(async (url) => {
							const slug = url.split("/").filter(Boolean).pop();

							if (SPELL_CACHE.has(slug)) return SPELL_CACHE.get(slug);
							const results = await api.searchSpells({ name: slug });
							const data = results?.[0] || null;
							if (data) SPELL_CACHE.set(slug, data);
							return data;
						}),
					);
					setSpells(loaded.filter(Boolean));
				} catch (e) {
					console.error("Error loading monster spells", e);
				} finally {
					setLoadingSpells(false);
				}
			};
			fetchSpells();
		}
	}, [monster]);

	const renderActionList = (actions, title) => {
		if (!actions || actions.length === 0) return null;
		return (
			<div className="MonsterStatBlock__section">
				<h4>{title}:</h4>
				{actions.map((action, index) => (
					<div key={index} className="MonsterStatBlock__action">
						<strong>{renderRecursiveContent(action.name)}.</strong>{" "}
						{renderRecursiveContent(
							action.entries || action.desc,
							handleSpellClick,
						)}
						<div className="MonsterStatBlock__action-rolls">
							{action.attack_bonus && (
								<div className="stat-item">
									Atk:{" "}
									<RollDice
										formula={`1d20${formatModifier(parseInt(action.attack_bonus))}`}>
										{formatModifier(parseInt(action.attack_bonus))}
									</RollDice>
								</div>
							)}
							{action.damage_dice && (
								<div className="stat-item">
									Dmg:{" "}
									<RollDice
										formula={`${action.damage_dice}${getDamageBonus(action)}`}
									/>
								</div>
							)}
						</div>
					</div>
				))}
			</div>
		);
	};

	const renderAbility = (label, value) => {
		const mod = getAbilityModifier(value);
		return (
			<div
				className="MonsterStatBlock__ability-box"
				onClick={() =>
					window.dispatchEvent(
						new CustomEvent("rollDice", {
							detail: `1d20${formatModifier(mod)}`,
						}),
					)
				}
				title={`Кинути перевірку ${label}`}>
				<span className="ability-label">{label}</span>
				<span className="ability-mod">{formatModifier(mod)}</span>
				<span className="ability-score">{value}</span>
			</div>
		);
	};

	const renderSaves = () => {
		const legacyMap = {
			strength_save: "Str",
			dexterity_save: "Dex",
			constitution_save: "Con",
			intelligence_save: "Int",
			wisdom_save: "Wis",
			charisma_save: "Cha",
		};

		const newMap = {
			str: "Str",
			dex: "Dex",
			con: "Con",
			int: "Int",
			wis: "Wis",
			cha: "Cha",
		};

		let saves = [];
		if (monster.save) {
			saves = Object.entries(newMap)
				.filter(([key]) => monster.save[key])
				.map(([key, label]) => ({ label, val: monster.save[key] }));
		} else {
			saves = Object.entries(legacyMap)
				.filter(([key]) => monster[key] !== null && monster[key] !== undefined)
				.map(([key, label]) => ({ label, val: monster[key] }));
		}

		if (saves.length === 0) return null;
		return (
			<div className="MonsterStatBlock__property-item">
				<strong>Saving Throws:</strong>{" "}
				{saves.map((s, idx) => (
					<React.Fragment key={s.label}>
						{s.label}{" "}
						<RollDice formula={`1d20${formatModifier(parseInt(s.val))}`}>
							{formatModifier(parseInt(s.val))}
						</RollDice>
						{idx < saves.length - 1 ? ", " : ""}
					</React.Fragment>
				))}
			</div>
		);
	};

	const renderSpellcasting = () => {
		if (loadingSpells)
			return (
				<div className="MonsterStatBlock__section">
					<p className="muted">Завантаження заклинань...</p>
				</div>
			);
		if (spells.length === 0) return null;

		const levels = spells.reduce((acc, s) => {
			const lvl = s.level_int !== undefined ? s.level_int : s.level;
			const key = lvl === 0 ? "0" : lvl.toString();
			if (!acc[key]) acc[key] = [];
			acc[key].push(s);
			return acc;
		}, {});

		const sortedLevels = Object.keys(levels).sort(
			(a, b) => parseInt(a) - parseInt(b),
		);

		return (
			<div className="MonsterStatBlock__section MonsterStatBlock__spells">
				<h4>Заклинання (Spells):</h4>
				{sortedLevels.map((lvl) => (
					<div key={lvl}>
						<strong>{lvl === "0" ? "Замовляння" : `${lvl}-й рівень`}:</strong>{" "}
						{levels[lvl].map((s, i) => (
							<React.Fragment key={s.slug || s.name}>
								<span
									className="MonsterStatBlock__spell"
									onClick={() => handleSpellClick(s)}>
									{capitalizeWords(s.name.split("|")[0])}
								</span>
								{i < levels[lvl].length - 1 ? ", " : ""}
							</React.Fragment>
						))}
					</div>
				))}
			</div>
		);
	};

	const renderNewSpellcasting = () => {
		if (!monster.spellcasting || monster.spellcasting.length === 0) return null;
		return (
			<div className="MonsterStatBlock__section MonsterStatBlock__spells">
				{monster.spellcasting.map((sc, idx) => (
					<div key={idx} className="MonsterStatBlock__action">
						<h4>{sc.name}:</h4>
						{sc.headerEntries && (
							<p>
								{renderRecursiveContent(sc.headerEntries, handleSpellClick)}
							</p>
						)}
						{sc.will && (
							<p>
								<strong>At will:</strong>{" "}
								{sc.will.map((s, i) => (
									<React.Fragment key={i}>
										{renderRecursiveContent(s, handleSpellClick)}
										{i < sc.will.length - 1 ? ", " : ""}
									</React.Fragment>
								))}
							</p>
						)}
						{sc.daily &&
							Object.entries(sc.daily).map(([freq, list]) => (
								<p key={freq}>
									<strong>{freq} each:</strong>{" "}
									{list.map((s, i) => (
										<React.Fragment key={i}>
											{renderRecursiveContent(s, handleSpellClick)}
											{i < list.length - 1 ? ", " : ""}
										</React.Fragment>
									))}
								</p>
							))}
					</div>
				))}
				{monster.spellcasting.map((sc, idx) => (
					<div key={`slots-${idx}`}>
						{sc.spells &&
							Object.entries(sc.spells).map(([lvl, info]) => (
								<p key={lvl} className="MonsterStatBlock__action">
									<strong>
										{lvl === "0" ? "Cantrips" : `Level ${lvl}`}{" "}
										{info.slots ? `(${info.slots} slots)` : ""}:{" "}
									</strong>
									{info.spells.map((s, i) => (
										<React.Fragment key={i}>
											{renderRecursiveContent(s, handleSpellClick)}
											{i < info.spells.length - 1 ? ", " : ""}
										</React.Fragment>
									))}
								</p>
							))}
					</div>
				))}
			</div>
		);
	};

	// Допоміжні функції для парсингу нових структур даних
	const getHP = () => {
		if (monster.hp && typeof monster.hp === "object") {
			return {
				val: monster.hp.special || monster.hp.average,
				formula: monster.hp.formula,
			};
		}
		return { val: monster.hit_points, formula: monster.hit_dice };
	};

	const getAC = () => {
		if (Array.isArray(monster.ac) && monster.ac[0]) {
			const entry = monster.ac[0];
			if (typeof entry === "object") {
				return {
					val: entry.special || entry.ac,
					desc: entry.from ? entry.from.join(", ") : "",
				};
			}
			return { val: entry, desc: "" };
		}
		return { val: monster.armor_class, desc: monster.armor_desc };
	};

	const formatSpeed = () => {
		if (typeof monster.speed === "string") return monster.speed;
		if (typeof monster.speed === "object" && monster.speed !== null) {
			const parts = Object.entries(monster.speed)
				.filter(([k]) => k !== "canHover")
				.map(([k, v]) => {
					const label = k === "walk" ? "" : k;
					if (typeof v === "object" && v !== null) {
						return `${label} ${v.number} ft. ${v.condition || ""}`.trim();
					}
					return `${label} ${v} ft.`.trim();
				});

			let res = parts.join(", ");
			if (monster.speed.canHover && !res.toLowerCase().includes("hover")) {
				res += " (hover)";
			}
			return res || "—";
		}
		return "—";
	};

	const alignmentMap = {
		L: "Lawful",
		C: "Chaotic",
		G: "Good",
		E: "Evil",
		N: "Neutral",
		U: "Unaligned",
	};

	const formatAlignment = (al) => {
		if (typeof al === "string") return al;
		if (Array.isArray(al)) {
			return al
				.map((abbr) => alignmentMap[abbr] || abbr)
				.filter(Boolean)
				.join(" ");
		}
		// Якщо світогляд не вказано або невідомий, повертаємо "Unaligned"
		return "U";
	};

	const sizeMap = {
		T: "Tiny",
		S: "Small",
		M: "Medium",
		L: "Large",
		H: "Huge",
		G: "Gargantuan",
	};
	const formatSize = (sz) => {
		const s = Array.isArray(sz) ? sz[0] : sz;
		return sizeMap[s] || s;
	};

	const formatDamageProp = (prop) => {
		if (!prop) return null;
		if (typeof prop === "string") return prop;
		if (Array.isArray(prop)) {
			return prop
				.map((item) => {
					if (typeof item === "string") return item;
					if (typeof item === "object" && item !== null) {
						const subProp =
							item.resist ||
							item.immune ||
							item.vulnerable ||
							item.conditionImmune;
						const base = Array.isArray(subProp) ? subProp.join(", ") : subProp;
						return `${item.preNote ? item.preNote + " " : ""}${base || ""}${item.note ? " " + item.note : ""}`.trim();
					}
					return "";
				})
				.filter(Boolean)
				.join(", ");
		}
		return null;
	};

	const imageName = monster.originalBestiaryName || monster.name;
	const localSrc = `/database/bestiary/tokens/${monster.source}/${imageName}.webp`;
	const externalSrc = `https://5e.tools/img/bestiary/tokens/${monster.source}/${imageName}.webp`;

	function handleDragStart(e) {
		e.dataTransfer.effectAllowed = "copy";

		// Найчастіше корисні типи для веб-дропзон
		e.dataTransfer.setData("text/uri-list", externalSrc);
		e.dataTransfer.setData("text/plain", externalSrc);
		e.dataTransfer.setData(
			"text/html",
			`<img src="${externalSrc}" alt="${monster.name}">`,
		);

		// Не обов'язково, але іноді допомагає стороннім дропзонам
		// Формат: mimeType:filename:url
		e.dataTransfer.setData(
			"DownloadURL",
			`image/webp:${imageName}.webp:${externalSrc}`,
		);
	}

	return (
		<div className="MonsterStatBlock">
			<div className="MonsterStatBlock__header">
				<div className="MonsterStatBlock__header__details">
					{onNameClick ? (
						<h3
							className="MonsterStatBlock__name"
							onClick={() => onNameClick?.(monster)}
							title={nameTitle}>
							{monster.name}
						</h3>
					) : (
						<ClickToCopy
							className="MonsterStatBlock__name"
							text={monster.name}
							message={`Ім'я скопійовано!`}>
							{monster.name}
						</ClickToCopy>
					)}

					{monster.originalBestiaryName &&
						monster.originalBestiaryName !== monster.name && (
							<div
								className="MonsterStatBlock__original-name muted"
								style={{
									fontSize: "0.9em",
									marginTop: "-4px",
									marginBottom: "8px",
								}}>
								({monster.originalBestiaryName})
							</div>
						)}

					<div className="MonsterStatBlock__meta-line">
						{formatSize(monster.size)} {monster.type?.type || monster.type}
						{monster.type?.tags && ` (${monster.type.tags.join(", ")})`},{" "}
						{formatAlignment(monster.alignment)}
					</div>
					<div className="MonsterStatBlock__stats">
						<div className="stat-item">
							<strong>HP:</strong>{" "}
							{renderRecursiveContent(getHP().val, handleSpellClick)}{" "}
							{getHP().formula && (
								<>
									(<RollDice formula={getHP().formula} />)
								</>
							)}
						</div>
						<div className="stat-item ac">
							<strong>AC:</strong>{" "}
							{renderRecursiveContent(getAC().val, handleSpellClick)}{" "}
							{renderRecursiveContent(getAC().desc, handleSpellClick)}
						</div>
						<div className="stat-item">
							<strong>Speed:</strong> {formatSpeed()}
						</div>
						{monster.source && (
							<div className="stat-item">
								<strong>Source:</strong>{" "}
								<span className="Bestiary__item-source">
									{monster.source.replace(/^bestiary-/i, "")}
								</span>
							</div>
						)}
					</div>
					<div className="MonsterStatBlock__abilities">
						{renderAbility("STR", monster.str ?? monster.strength)}
						{renderAbility("DEX", monster.dex ?? monster.dexterity)}
						{renderAbility("CON", monster.con ?? monster.constitution)}
						{renderAbility("INT", monster.int ?? monster.intelligence)}
						{renderAbility("WIS", monster.wis ?? monster.wisdom)}
						{renderAbility("CHA", monster.cha ?? monster.charisma)}
					</div>
				</div>
				<div className="MonsterStatBlock__token-wrapper">
					{!hasImageError && (
						<div
							className="MonsterStatBlock__tokenDragProxy"
							draggable
							onDragStart={handleDragStart}>
							<img
								src={localSrc}
								alt={monster.name}
								className="MonsterStatBlock__token"
								draggable={false}
								onError={() => setHasImageError(true)}
							/>
						</div>
					)}
					{hasImageError && (
						<div className="MonsterStatBlock__token-skeleton">
							<Icon name="dice" />
						</div>
					)}
				</div>
			</div>
			<div className="MonsterStatBlock__properties">
				{renderSaves()}

				{(monster.skill || monster.skills) && (
					<div className="MonsterStatBlock__property-item MonsterStatBlock__property-item--skills">
						<strong>Skills:</strong>{" "}
						{Object.entries(monster.skill || monster.skills).map(
							([name, value], idx, arr) => (
								<React.Fragment key={name}>
									<span
										className="skill-name"
										style={{ textTransform: "capitalize" }}>
										{name}
									</span>{" "}
									<RollDice formula={`1d20${formatModifier(parseInt(value))}`}>
										{formatModifier(parseInt(value))}
									</RollDice>
									{idx < arr.length - 1 ? ", " : ""}
								</React.Fragment>
							),
						)}
					</div>
				)}

				{monster.vulnerable && (
					<div className="MonsterStatBlock__property-item">
						<strong>Damage Vulnerabilities:</strong>{" "}
						{formatDamageProp(monster.vulnerable)}
					</div>
				)}
				{monster.resist && (
					<div className="MonsterStatBlock__property-item">
						<strong>Damage Resistances:</strong>{" "}
						{formatDamageProp(monster.resist)}
					</div>
				)}
				{monster.immune && (
					<div className="MonsterStatBlock__property-item">
						<strong>Damage Immunities:</strong>{" "}
						{formatDamageProp(monster.immune)}
					</div>
				)}
				{monster.conditionImmune && (
					<div className="MonsterStatBlock__property-item">
						<strong>Condition Immunities:</strong>{" "}
						{formatDamageProp(monster.conditionImmune)}
					</div>
				)}

				<div className="MonsterStatBlock__description">
					<p>
						<strong>Senses:</strong>{" "}
						{renderRecursiveContent(monster.senses, handleSpellClick)}
					</p>
					<p>
						<strong>Languages:</strong>{" "}
						{typeof monster.languages === "string"
							? monster.languages
							: monster.languages?.join(", ")}
					</p>
					<p>
						<strong>Challenge:</strong> {monster.cr?.cr || monster.cr}
					</p>
				</div>
				{monster.desc && (
					<div className="MonsterStatBlock__lore">
						{parseRollsAndSpells(
							preprocessTags(monster.desc),
							handleSpellClick,
						)}
					</div>
				)}
			</div>
			{renderSpellcasting()}
			{renderNewSpellcasting()}
			{renderActionList(monster.trait, "Traits")}
			{renderActionList(monster.bonus, "Bonus Actions")}
			{renderActionList(monster.action, "Actions")}
			{renderActionList(monster.reaction, "Reactions")}
			{renderActionList(monster.legendary, "Legendary Actions")}
			{monster.lairActions && monster.lairActions.length > 0 && (
				<div className="MonsterStatBlock__section">
					<h4>Lair Actions:</h4>
					{renderRecursiveContent(monster.lairActions, handleSpellClick)}
				</div>
			)}
			{monster.regionalEffects && monster.regionalEffects.length > 0 && (
				<div className="MonsterStatBlock__section">
					<h4>Regional Effects:</h4>
					{renderRecursiveContent(monster.regionalEffects, handleSpellClick)}
				</div>
			)}
		</div>
	);
}
