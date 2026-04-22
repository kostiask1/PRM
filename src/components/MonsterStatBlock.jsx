import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import RollDice from "./RollDice";
import Icon from "./common/Icon.jsx";
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
import ClickToCopy from "./common/ClickToCopy.jsx";
import Button from "./form/Button.jsx";
import MonsterStatBlockModel from "../models/MonsterStatBlockModel.js";
import { getSpellByName } from "../utils/referencePreview.js";
import { resolveSpellInput } from "../utils/referenceResolvers.js";
import useConditionReference from "../hooks/useConditionReference.jsx";
import Tooltip from "./common/Tooltip.jsx";
import classNames from "../utils/classNames";
import { requestDiceRollAction } from "../actions/app";
import { openModalRequest, useAppDispatch } from "../store/appStore";

const SPELL_CACHE = new Map();

export default function MonsterStatBlock({
	monster,
	onNameClick,
	nameTitle,
	onFavoriteChange,
	tokenImageOverrideUrl = null,
}) {
	const dispatch = useAppDispatch();
	const [hasImageError, setHasImageError] = useState(false);
	const [spells, setSpells] = useState([]);
	const [loadingSpells, setLoadingSpells] = useState(false);
	const [isFavorite, setIsFavorite] = useState(false);

	const model = useMemo(() => new MonsterStatBlockModel(monster), [monster]);
	const effectiveName = model.effectiveName;

	useEffect(() => {
		const checkFavoriteStatus = async () => {
			try {
				const favs = await api.getBestiaryFavorites();
				const found = favs.some(
					(f) =>
						f.name === effectiveName &&
						f.source?.toUpperCase() === monster.source?.toUpperCase(),
				);
				setIsFavorite(found);
			} catch (e) {
				console.error("Failed to fetch favorite status", e);
			}
		};

		if (monster.name && monster.source) {
			checkFavoriteStatus();
		} else {
			setIsFavorite(false);
		}
	}, [effectiveName, monster.source]);

	const handleToggleFavorite = async () => {
		try {
			const newFavs = await api.toggleBestiaryFavorite(
				effectiveName,
				monster.source,
			);
			const found = newFavs.some(
				(f) =>
					f.name === effectiveName &&
					f.source?.toUpperCase() === monster.source?.toUpperCase(),
			);
			setIsFavorite(found);
			if (onFavoriteChange) onFavoriteChange(newFavs);
		} catch (err) {
			console.error("Failed to toggle favorite", err);
		}
	};

	const handleSpellClick = async (spellOrName) => {
		const spell = await resolveSpellInput(spellOrName);
		if (!spell) return;

		openModalRequest({
			title: capitalizeWords(spell.name.split("|")[0]),
			type: "confirm",
			showFooter: false,
			children: (
				<SpellCard
					spell={spell}
					onSpellClick={handleSpellClick}
					onConditionClick={handleConditionClick}
				/>
			),
		});
	};

	const { handleConditionClick, handleConditionHover } = useConditionReference({
		onSpellClick: handleSpellClick,
		getSpellHoverHandler: () => handleSpellHover,
	});

	const handleSpellHover = async (spellName) => {
		const spell = await getSpellByName(spellName);
		if (!spell) return null;
		return (
			<div className="Tooltip__spell-card">
				<SpellCard
					spell={spell}
					onSpellClick={handleSpellClick}
					onConditionClick={handleConditionClick}
				/>
			</div>
		);
	};


	useEffect(() => {
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

	useEffect(() => {
		setHasImageError(false);
	}, [monster, tokenImageOverrideUrl]);

	const renderActionList = (actions, title) => {
		if (!actions || actions.length === 0) return null;
		return (
			<div className="MonsterStatBlock__section">
				<h4>{title}:</h4>
				{actions.map((action, index) => (
					<div key={index} className="MonsterStatBlock__action">
						<strong>
							{renderRecursiveContent(
								action.name,
								handleSpellClick,
								handleConditionClick,
								handleSpellHover,
								handleConditionHover,
							)}
							.
						</strong>{" "}
						{renderRecursiveContent(
							action.entries || action.desc,
							handleSpellClick,
							handleConditionClick,
							handleSpellHover,
							handleConditionHover,
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
			<Tooltip content={`Кинути перевірку ${label}`}>
					<div
						className="MonsterStatBlock__ability-box"
						onClick={() =>
							dispatch(requestDiceRollAction(`1d20${formatModifier(mod)}`))
						}>
					<span className="ability-label">{label}</span>
					<span className="ability-mod">{formatModifier(mod)}</span>
					<span className="ability-score">{value}</span>
				</div>
			</Tooltip>
		);
	};

	const renderSaves = () => {
		if (model.saves.length === 0) return null;
		return (
			<div className="MonsterStatBlock__property-item">
				<strong>Saving Throws:</strong>{" "}
				{model.saves.map((s, idx) => (
					<React.Fragment key={s.label}>
						{s.label}{" "}
						<RollDice formula={`1d20${formatModifier(parseInt(s.val))}`}>
							{formatModifier(parseInt(s.val))}
						</RollDice>
						{idx < model.saves.length - 1 ? ", " : ""}
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
								{renderRecursiveContent(
									sc.headerEntries,
									handleSpellClick,
									handleConditionClick,
									handleSpellHover,
									handleConditionHover,
								)}
							</p>
						)}
						{sc.will && (
							<p>
								<strong>At will:</strong>{" "}
								{sc.will.map((s, i) => (
									<React.Fragment key={i}>
										{renderRecursiveContent(
											s,
											handleSpellClick,
											handleConditionClick,
											handleSpellHover,
											handleConditionHover,
										)}
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
											{renderRecursiveContent(
												s,
												handleSpellClick,
												handleConditionClick,
												handleSpellHover,
												handleConditionHover,
											)}
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
											{renderRecursiveContent(
												s,
												handleSpellClick,
												handleConditionClick,
												handleSpellHover,
												handleConditionHover,
											)}
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

	const localSrc = tokenImageOverrideUrl || model.localTokenSrc;
	const externalSrc = tokenImageOverrideUrl || model.externalTokenSrc;

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
			`image/webp:${effectiveName}.webp:${externalSrc}`,
		);
	}

	return (
		<div className="MonsterStatBlock">
			<div className="MonsterStatBlock__header">
				<div className="MonsterStatBlock__header__details">
					<div className="MonsterStatBlock__name__row">
						{onNameClick ? (
							<Tooltip content={nameTitle} disabled={!nameTitle}>
								<h3
									className="MonsterStatBlock__name"
									onClick={() => onNameClick?.(monster)}>
									{monster.name}
								</h3>
							</Tooltip>
						) : (
							<ClickToCopy
								className="MonsterStatBlock__name"
								text={monster.name}
								message={`Ім'я скопійовано!`}>
								{monster.name}
							</ClickToCopy>
						)}
						<Button
							variant="ghost"
							size="small"
							icon="star"
							className={classNames("MonsterStatBlock__favorite-btn", {
								"is-active": isFavorite,
							})}
							onClick={handleToggleFavorite}
							title={isFavorite ? "Видалити з обраного" : "Додати в обране"}
						/>
					</div>

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
						{model.size} {model.typeLabel}, {model.alignment}
					</div>
					<div className="MonsterStatBlock__stats">
						<div className="stat-item">
							<strong>HP:</strong>{" "}
							{renderRecursiveContent(
								model.hp.val,
								handleSpellClick,
								handleConditionClick,
								handleSpellHover,
								handleConditionHover,
							)}{" "}
							{model.hp.formula && (
								<>
									(<RollDice formula={model.hp.formula} />)
								</>
							)}
						</div>
						<div className="stat-item ac">
							<strong>AC:</strong>{" "}
							{renderRecursiveContent(
								model.ac.val,
								handleSpellClick,
								handleConditionClick,
								handleSpellHover,
								handleConditionHover,
							)}{" "}
							{renderRecursiveContent(
								model.ac.desc,
								handleSpellClick,
								handleConditionClick,
								handleSpellHover,
								handleConditionHover,
							)}
						</div>
						<div className="stat-item">
							<strong>Speed:</strong> {model.speed}
						</div>
						{monster.source && (
							<div className="stat-item">
								<strong>Source:</strong>{" "}
								<span className="Bestiary__item-source">
									{model.sourceLabel}
								</span>
							</div>
						)}
					</div>
					<div className="MonsterStatBlock__abilities">
						{renderAbility("STR", model.abilityScores.str)}
						{renderAbility("DEX", model.abilityScores.dex)}
						{renderAbility("CON", model.abilityScores.con)}
						{renderAbility("INT", model.abilityScores.int)}
						{renderAbility("WIS", model.abilityScores.wis)}
						{renderAbility("CHA", model.abilityScores.cha)}
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

				{model.skills.length > 0 && (
					<div className="MonsterStatBlock__property-item MonsterStatBlock__property-item--skills">
						<strong>Skills:</strong>{" "}
						{model.skills.map(([name, value], idx, arr) => (
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
						))}
					</div>
				)}

				{monster.vulnerable && (
					<div className="MonsterStatBlock__property-item">
						<strong>Damage Vulnerabilities:</strong>{" "}
						{model.formatDamageProperty(monster.vulnerable)}
					</div>
				)}
				{monster.resist && (
					<div className="MonsterStatBlock__property-item">
						<strong>Damage Resistances:</strong>{" "}
						{model.formatDamageProperty(monster.resist)}
					</div>
				)}
				{monster.immune && (
					<div className="MonsterStatBlock__property-item">
						<strong>Damage Immunities:</strong>{" "}
						{model.formatDamageProperty(monster.immune)}
					</div>
				)}
				{monster.conditionImmune && (
					<div className="MonsterStatBlock__property-item">
						<strong>Condition Immunities:</strong>{" "}
						{model.formatDamageProperty(monster.conditionImmune)}
					</div>
				)}

				<div className="MonsterStatBlock__description">
					<p>
						<strong>Senses:</strong>{" "}
						{renderRecursiveContent(
							monster.senses,
							handleSpellClick,
							handleConditionClick,
							handleSpellHover,
							handleConditionHover,
						)}
					</p>
					<p>
						<strong>Languages:</strong> {model.languages}
					</p>
					<p>
						<strong>CR:</strong> {model.challenge}
					</p>
				</div>
				{monster.desc && (
					<div className="MonsterStatBlock__lore">
						{parseRollsAndSpells(
							preprocessTags(monster.desc),
							handleSpellClick,
							handleConditionClick,
							handleSpellHover,
							handleConditionHover,
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
					{renderRecursiveContent(
						monster.lairActions,
						handleSpellClick,
						handleConditionClick,
						handleSpellHover,
						handleConditionHover,
					)}
				</div>
			)}
			{monster.regionalEffects && monster.regionalEffects.length > 0 && (
				<div className="MonsterStatBlock__section">
					<h4>Regional Effects:</h4>
					{renderRecursiveContent(
						monster.regionalEffects,
						handleSpellClick,
						handleConditionClick,
						handleSpellHover,
						handleConditionHover,
					)}
				</div>
			)}
		</div>
	);
}



