import React, { useState, useEffect } from "react";
import RollDice from "../RollDice/RollDice";
import Icon from "../Icon";
import SpellCard from "../SpellCard/SpellCard";
import {
	getAbilityModifier,
	formatModifier,
	getDamageBonus,
	parseRollsAndSpells,
} from "../../utils/diceParser.jsx";
import "./MonsterStatBlock.css";
import ClickToCopy from "../ClickToCopy/ClickToCopy.jsx";

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
			const slug = spellOrName.toLowerCase().replace(/\s+/g, "-");
			try {
				const res = await fetch(
					`https://www.dnd5eapi.co/api/2014/spells/${slug}`,
				);
				spell = await res.json();
				if (!spell.name) throw new Error();
			} catch (e) {
				console.error("Failed to fetch linked spell", e);
				return;
			}
		}

		modal?.confirm(
			spell.name,
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
					console.log("monster.spell_list:", monster.spell_list);
					const loaded = await Promise.all(
						monster.spell_list.map(async (url) => {
							const fixUrl = url.replace(
								"https://api.open5e.com/v2/spells",
								"https://www.dnd5eapi.co/api/2014/spells",
							);

							if (SPELL_CACHE.has(url)) return SPELL_CACHE.get(fixUrl);
							const res = await fetch(fixUrl);
							const data = await res.json();
							SPELL_CACHE.set(fixUrl, data);
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

	const preprocessText = (text) => {
		if (typeof text !== "string") return text;
		return text
			.replace(/{@h}/gi, "Hit: ")
			.replace(/{@dc\s+(\d+)}/gi, "DC $1")
			.replace(/{@status\s+([^|}]+)(?:\|[^|}]*)?(?:\|([^}]*))?}/gi, (m, g1, g2) => g2 || g1)
			.replace(/{@condition\s+([^|}]+)(?:\|[^|}]*)?(?:\|([^}]*))?}/gi, (m, g1, g2) => g2 || g1)
			.replace(/{@atk\s+mw}/gi, "Melee Weapon Attack: ")
			.replace(/{@atk\s+rw}/gi, "Ranged Weapon Attack: ")
			.replace(/{@atk\s+mw,rw}/gi, "Melee or Ranged Weapon Attack: ")
			.replace(/{@hit\s+([+-]?\d+)}/gi, (m, g1) =>
				g1.startsWith("+") || g1.startsWith("-") ? g1 : `+${g1}`,
			)
			.replace(/{@dice\s+([^|}]+)(?:\|[^|}]*)?(?:\|([^}]*))?}/gi, (m, g1, g2) => g2 || g1)
			.replace(/{@damage\s+([^|}]+)(?:\|[^|}]*)?(?:\|([^}]*))?}/gi, (m, g1, g2) => g2 || g1)
			.replace(/{@(?:creature|skill|item|filter|quickref|book)\s+([^|}]+)(?:\|[^|}]*)?(?:\|([^}]*))?}/gi, (m, g1, g2) => g2 || g1)
			.replace(/{@i\s+([^}]+)}/gi, "*$1*")
			.replace(/{@b\s+([^}]+)}/gi, "**$1**");
	};

	// Рекурсивна функція для рендерингу складних структур entries/items
	const renderContentRecursive = (content) => {
		if (content === undefined || content === null) return null;

		if (typeof content === "string") {
			return parseRollsAndSpells(preprocessText(content), handleSpellClick);
		}

		if (Array.isArray(content)) {
			return content.map((item, idx) => (
				<React.Fragment key={idx}>
					{renderContentRecursive(item)}
				</React.Fragment>
			));
		}

		if (typeof content === "object") {
			if (content.type === "list" && content.items) {
				return (
					<ul
						key={content.name || Math.random()}
						className={
							content.style === "list-hang-notitle" ? "list-hang-notitle" : ""
						}>
						{content.items.map((item, idx) => {
							const isObject = typeof item === "object" && item !== null;
							return (
								<li key={idx}>
									{isObject && item.name && <strong>{item.name}. </strong>}
									{renderContentRecursive(isObject ? (item.entries || item.entry) : item)}
								</li>
							);
						})}
					</ul>
				);
			} else if (content.type === "entries" && content.entries) {
				return (
					<div key={content.name || Math.random()}>
						{content.name && <strong>{content.name}. </strong>}
						{renderContentRecursive(content.entries)}
					</div>
				);
			}
			// Fallback for other unexpected object types, stringify them
			return parseRollsAndSpells(JSON.stringify(content), handleSpellClick);
		}
		return null;
	};
	const renderActionList = (actions, title) => {
		if (!actions || actions.length === 0) return null;
		return (
			<div className="MonsterStatBlock__section">
				<h4>{title}:</h4>
				{actions.map((action, index) => (
					<div key={index} className="MonsterStatBlock__action">
						<strong>{action.name}.</strong>{" "}
						{renderContentRecursive(action.entries || action.desc)}
						<div className="MonsterStatBlock__action-rolls">
							{action.attack_bonus && (
								<div className="stat-item">
									Atk:{" "}
									<RollDice
										formula={`1d20${formatModifier(action.attack_bonus)}`}>
										{formatModifier(action.attack_bonus)}
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
						<RollDice formula={`1d20${formatModifier(s.val)}`}>
							{formatModifier(s.val)}
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
									{s.name}
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
							<p>{renderContentRecursive(sc.headerEntries)}</p>
						)}
						{sc.will && (
							<p>
								<strong>At will:</strong>{" "}
								{sc.will.map((s, i) => (
									<React.Fragment key={i}>
										{renderContentRecursive(s)}
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
											{renderContentRecursive(s)}
											{i < list.length - 1 ? ", " : ""}
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
		if (typeof monster.hp === "object" && monster.hp?.average) {
			return { val: monster.hp.average, formula: monster.hp.formula };
		}
		return { val: monster.hit_points, formula: monster.hit_dice };
	};

	const getAC = () => {
		if (Array.isArray(monster.ac) && monster.ac[0]) {
			const entry = monster.ac[0];
			return {
				val: typeof entry === "object" ? entry.ac : entry,
				desc: entry.from ? entry.from.join(", ") : "",
			};
		}
		return { val: monster.armor_class, desc: monster.armor_desc };
	};

	const formatSpeed = () => {
		if (typeof monster.speed === "string") return monster.speed;
		if (typeof monster.speed === "object") {
			return Object.entries(monster.speed)
				.map(([k, v]) => `${k} ${v}`)
				.join(", ");
		}
		return "—";
	};

	const formatAlignment = (al) => {
		if (typeof al === "string") return al;
		if (Array.isArray(al)) return al.join("");
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
	return (
		<div className="MonsterStatBlock">
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

			<div className="MonsterStatBlock__meta-line">
				{formatSize(monster.size)} {monster.type?.type || monster.type}
				{monster.type?.tags && ` (${monster.type.tags.join(", ")})`},{" "}
				{formatAlignment(monster.alignment)}
			</div>

			<div className="MonsterStatBlock__header">
				<div className="MonsterStatBlock__stats">
					<div className="stat-item">
						<strong>HP:</strong> {getHP().val}{" "}
						{getHP().formula && (
							<>
								(<RollDice formula={getHP().formula} />)
							</>
						)}
					</div>
					<div className="stat-item">
						<strong>AC:</strong> {getAC().val}{" "}
						{getAC().desc && `(${getAC().desc})`}
					</div>
					<div className="stat-item">
						<strong>Speed:</strong> {formatSpeed()}
					</div>
					{monster.source && (
						<div className="stat-item">
							<strong>Source:</strong>{" "}
							<span className="Bestiary__item-source">{monster.source}</span>
						</div>
					)}
				</div>
				<div className="MonsterStatBlock__token-wrapper">
					{!hasImageError && (
						<img
							src={`/database/bestiary/tokens/${monster.source}/${monster.name}.webp`}
							alt={monster.name}
							className="MonsterStatBlock__token"
							onError={() => setHasImageError(true)}
						/>
					)}
					{hasImageError && (
						<div className="MonsterStatBlock__token-skeleton">
							<Icon name="dice" />
						</div>
					)}
				</div>
			</div>
			<div className="MonsterStatBlock__abilities">
				{renderAbility("STR", monster.str ?? monster.strength)}
				{renderAbility("DEX", monster.dex ?? monster.dexterity)}
				{renderAbility("CON", monster.con ?? monster.constitution)}
				{renderAbility("INT", monster.int ?? monster.intelligence)}
				{renderAbility("WIS", monster.wis ?? monster.wisdom)}
				{renderAbility("CHA", monster.cha ?? monster.charisma)}
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
									<RollDice formula={`1d20${formatModifier(value)}`}>
										{formatModifier(value)}
									</RollDice>
									{idx < arr.length - 1 ? ", " : ""}
								</React.Fragment>
							),
						)}
					</div>
				)}

				{monster.damage_immunities && (
					<div className="MonsterStatBlock__property-item">
						<strong>Damage Immunities:</strong> {monster.damage_immunities}
					</div>
				)}
				{monster.damage_vulnerabilities && (
					<div className="MonsterStatBlock__property-item">
						<strong>Damage Vulnerabilities:</strong>{" "}
						{monster.damage_vulnerabilities}
					</div>
				)}
				{monster.damage_resistances && (
					<div className="MonsterStatBlock__property-item">
						<strong>Damage Resistances:</strong> {monster.damage_resistances}
					</div>
				)}
				<div className="MonsterStatBlock__description">
					<p>
						<strong>Senses:</strong>{" "}
						{Array.isArray(monster.senses)
							? monster.senses.join(", ")
							: monster.senses}
					</p>
					<p>
						<strong>Languages:</strong>{" "}
						{Array.isArray(monster.languages)
							? monster.languages.join(", ")
							: monster.languages}
					</p>
					<p>
						<strong>Challenge:</strong> {monster.cr?.cr || monster.cr}
					</p>
				</div>
				{monster.desc && (
					<div className="MonsterStatBlock__lore">
						{parseRollsAndSpells(preprocessText(monster.desc), handleSpellClick)}
					</div>
				)}
			</div>
			{renderSpellcasting()}
			{renderNewSpellcasting()}
			{renderActionList(monster.trait || monster.special_abilities, "Traits")}
			{renderActionList(monster.action || monster.actions, "Actions")}
			{renderActionList(monster.reaction || monster.reactions, "Reactions")}
			{renderActionList(
				monster.legendary || monster.legendary_actions,
				"Legendary Actions",
			)}
			{monster.lairActions && monster.lairActions.length > 0 && (
				<div className="MonsterStatBlock__section">
					<h4>Lair Actions:</h4>
					{renderContentRecursive(monster.lairActions)}
				</div>
			)}
			{monster.regionalEffects && monster.regionalEffects.length > 0 && (
				<div className="MonsterStatBlock__section">
					<h4>Regional Effects:</h4>
					{renderContentRecursive(monster.regionalEffects)}
				</div>
			)}
		</div>
	);
}
