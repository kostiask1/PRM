import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import RollDice from "./common/RollDice.jsx";
import Icon from "./common/Icon.jsx";
import {
	getAbilityModifier,
	formatModifier,
	getDamageBonus,
	capitalizeWords,
} from "../utils/parser.jsx";
import {
	parseRollsAndSpells,
	renderRecursiveContent,
} from "../renderers/contentRenderer.jsx";
import "../assets/components/MonsterStatBlock.css";
import ClickToCopy from "./common/ClickToCopy.jsx";
import Button from "./form/Button.jsx";
import MonsterStatBlockModel from "../models/MonsterStatBlockModel.js";
import Tooltip from "./common/Tooltip.jsx";
import classNames from "../utils/classNames";
import { requestDiceRollAction } from "../actions/app";
import {
	openModalRequest,
	useAppDispatch,
	useAppSelector,
} from "../store/appStore";
import { lang } from "../services/localization.js";
import AddMonsterToEncounterModalContent from "./modals/AddMonsterToEncounterModalContent.jsx";
import RulesLink from "./common/RulesLink.jsx";
import { highlightText } from "../utils/searchHighlight.jsx";
import ImageDropzone from "./form/ImageDropzone.jsx";
import { formatSourceLabel } from "../utils/sourceNames.js";

const SPELL_CACHE = new Map();
const SENSE_NAME_REGEX = /\b(blindsight|darkvision|tremorsense|truesight)\b/gi;

export default function MonsterStatBlock({
	monster,
	onNameClick,
	nameTitle,
	onFavoriteChange,
	favoriteActive = null,
	tokenImageOverrideUrl = null,
	layoutMode = "single",
	showFavoriteAction = true,
	showAddToEncounterPicker = false,
	allowTokenUpload = true,
	tokenUploadCampaignSlug = "general",
	onTokenImageChange,
	onAddToEncounter,
	onAiAction,
	onDelete,
	onFieldEdit,
	searchHighlight = "",
	highlightFields = null,
}) {
	const dispatch = useAppDispatch();
	const campaigns = useAppSelector((store) => store.campaigns.items);
	const [hasImageError, setHasImageError] = useState(false);
	const [spells, setSpells] = useState([]);
	const [loadingSpells, setLoadingSpells] = useState(false);
	const [isFavorite, setIsFavorite] = useState(false);
	const [customTokenUrl, setCustomTokenUrl] = useState(monster.imageUrl || "");
	const [isReplacingToken, setIsReplacingToken] = useState(false);

	const model = useMemo(() => new MonsterStatBlockModel(monster), [monster]);
	const effectiveName = model.effectiveName;
	const sourceLabel = formatSourceLabel(monster.source);
	const highlight = (value) => highlightText(value, searchHighlight);
	const referenceRenderOptions = useMemo(
		() => ({
			creatureSourceFallback: monster.source,
		}),
		[monster.source],
	);
	const renderContent = (content) =>
		renderRecursiveContent(content, searchHighlight, referenceRenderOptions);
	const renderInlineText = (text) =>
		parseRollsAndSpells(text, searchHighlight, referenceRenderOptions);
	const isFieldHighlighted = (...fields) =>
		fields.some((field) => highlightFields?.fields?.includes?.(field));
	const changedClass = (...fields) =>
		isFieldHighlighted(...fields) ? "is_ai_changed_field" : "";

	useEffect(() => {
		if (favoriteActive !== null) {
			setIsFavorite(Boolean(favoriteActive));
			return;
		}

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

		if (showFavoriteAction && monster.name && monster.source) {
			checkFavoriteStatus();
		} else {
			setIsFavorite(false);
		}
	}, [
		effectiveName,
		favoriteActive,
		monster.name,
		monster.source,
		showFavoriteAction,
	]);

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

	const handleAddToEncounter = () => {
		if (onAddToEncounter) {
			onAddToEncounter(monster);
			return;
		}

		openModalRequest({
			title: lang.t("Add to encounter"),
			type: "confirm",
			showFooter: false,
			children: (
				<AddMonsterToEncounterModalContent
					monster={monster}
					campaigns={campaigns}
				/>
			),
		});
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
		setCustomTokenUrl(monster.imageUrl || "");
		setIsReplacingToken(false);
	}, [monster, tokenImageOverrideUrl]);

	const renderActionList = (actions, title, field) => {
		if (!actions || actions.length === 0) return null;
		return (
			<div
				className={classNames("MonsterStatBlock__section", changedClass(field))}
			>
				<h4>{title}:</h4>
				{actions.map((action, index) => (
					<div key={index} className="MonsterStatBlock__action">
						<strong>{renderContent(action.name)}.</strong>{" "}
						{renderContent(action.entries || action.desc)}
						<div className="MonsterStatBlock__action_rolls">
							{action.attack_bonus && (
								<div className="stat_item">
									Atk:{" "}
									<RollDice
										formula={`1d20${formatModifier(parseInt(action.attack_bonus))}`}
									>
										{formatModifier(parseInt(action.attack_bonus))}
									</RollDice>
								</div>
							)}
							{action.damage_dice && (
								<div className="stat_item">
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
			<Tooltip content={lang.t("Roll {label} check", { label })}>
				<div
					className={classNames(
						"MonsterStatBlock__ability_box",
						changedClass(abilityFieldByLabel[label]),
					)}
					onClick={() =>
						dispatch(requestDiceRollAction(`1d20${formatModifier(mod)}`))
					}
				>
					<span className="ability_label">{label}</span>
					<span className="ability_mod">{formatModifier(mod)}</span>
					<span className="ability_score">{value}</span>
				</div>
			</Tooltip>
		);
	};

	const renderAbilities = () => (
		<>
			{renderAbility("STR", model.abilityScores.str)}
			{renderAbility("DEX", model.abilityScores.dex)}
			{renderAbility("CON", model.abilityScores.con)}
			{renderAbility("INT", model.abilityScores.int)}
			{renderAbility("WIS", model.abilityScores.wis)}
			{renderAbility("CHA", model.abilityScores.cha)}
		</>
	);

	const renderSaves = () => {
		if (model.saves.length === 0) return null;
		return (
			<div
				className={classNames(
					"MonsterStatBlock__property_item",
					changedClass("save"),
				)}
			>
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

	const renderSenses = () => {
		const senses = monster.senses;
		if (!Array.isArray(senses)) return renderSenseText(senses);

		return senses.map((sense, index) => (
			<React.Fragment key={index}>
				{renderSenseText(sense)}
				{index < senses.length - 1 ? ", " : ""}
			</React.Fragment>
		));
	};

	const renderSenseText = (text) => {
		if (typeof text !== "string") {
			return renderContent(text);
		}
		if (/\{@sense\s/i.test(text)) {
			return renderContent(text);
		}

		const elements = [];
		let lastIndex = 0;
		let matchIndex = 0;
		let match;

		SENSE_NAME_REGEX.lastIndex = 0;
		while ((match = SENSE_NAME_REGEX.exec(text)) !== null) {
			const start = match.index;
			const senseName = match[1];
			if (start > lastIndex) {
				elements.push(
					<React.Fragment key={`sense-text-${matchIndex}`}>
						{renderInlineText(text.slice(lastIndex, start))}
					</React.Fragment>,
				);
			}
			elements.push(
				<RulesLink
					key={`sense-link-${matchIndex}`}
					type="sense"
					name={senseName}
				>
					{highlight(senseName)}
				</RulesLink>,
			);
			lastIndex = start + senseName.length;
			matchIndex += 1;
		}

		if (lastIndex < text.length) {
			elements.push(
				<React.Fragment key="sense-text-tail">
					{renderInlineText(text.slice(lastIndex))}
				</React.Fragment>,
			);
		}

		return elements.length > 0 ? elements : renderContent(text);
	};

	const renderSpellcasting = () => {
		if (loadingSpells)
			return (
				<div className="MonsterStatBlock__section">
					<p className="muted">Loading spells...</p>
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
			<div
				className={classNames(
					"MonsterStatBlock__section MonsterStatBlock__spells",
					changedClass("spell_list"),
				)}
			>
				<h4>Spells:</h4>
				{sortedLevels.map((lvl) => (
					<div key={lvl}>
						<strong>{lvl === "0" ? "Cantrip" : `${lvl}-level`}:</strong>{" "}
						{levels[lvl].map((s, i) => (
							<React.Fragment key={s.slug || s.name}>
								<RulesLink type="spell" name={s.name}>
									{highlight(capitalizeWords(s.name.split("|")[0]))}
								</RulesLink>
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
			<div
				className={classNames(
					"MonsterStatBlock__section MonsterStatBlock__spells",
					changedClass("spellcasting"),
				)}
			>
				{monster.spellcasting.map((sc, idx) => (
					<div key={idx} className="MonsterStatBlock__action">
						<h4>{sc.name}:</h4>
						{sc.headerEntries && <p>{renderContent(sc.headerEntries)}</p>}
						{sc.will && (
							<p>
								<strong>At will:</strong>{" "}
								{sc.will.map((s, i) => (
									<React.Fragment key={i}>
										{renderContent(s)}
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
											{renderContent(s)}
											{i < list.length - 1 ? ", " : ""}
										</React.Fragment>
									))}
								</p>
							))}
						{sc.spells &&
							Object.entries(sc.spells).map(([lvl, info]) => (
								<p key={lvl} className="MonsterStatBlock__action">
									<strong>
										{lvl === "0" ? "Cantrips" : `Level ${lvl}`}{" "}
										{info.slots ? `(${info.slots} slots)` : ""}:{" "}
									</strong>
									{info.spells.map((s, i) => (
										<React.Fragment key={i}>
											{renderContent(s)}
											{i < info.spells.length - 1 ? ", " : ""}
										</React.Fragment>
									))}
								</p>
							))}
						{sc.footerEntries && <p>{renderContent(sc.footerEntries)}</p>}
					</div>
				))}
			</div>
		);
	};

	// Helpers for parsing newer data structures.

	const isCustomMonster =
		String(monster.source || "").toUpperCase() === "CUSTOM";
	const customTokenSrc = customTokenUrl ?? monster.imageUrl ?? "";
	const localSrc =
		customTokenSrc || tokenImageOverrideUrl || model.localTokenSrc;
	const externalSrc =
		customTokenSrc || tokenImageOverrideUrl || model.externalTokenSrc;
	const shouldShowTokenDropzone =
		allowTokenUpload &&
		(isCustomMonster || onTokenImageChange) &&
		(isReplacingToken || !localSrc || hasImageError);

	const handleCustomTokenUpload = async (result) => {
		const nextUrl = result?.url || "";
		if (!nextUrl) return;
		setCustomTokenUrl(nextUrl);
		setHasImageError(false);
		if (onTokenImageChange) {
			onTokenImageChange(monster, nextUrl);
			setIsReplacingToken(false);
			return;
		}
		try {
			const updatedMonster = await api.updateCustomBestiaryMonster(
				monster.id || effectiveName || monster.name,
				{
					imageUrl: nextUrl,
				},
			);
			setCustomTokenUrl(updatedMonster?.imageUrl || nextUrl);
			setIsReplacingToken(false);
		} catch (err) {
			console.error("Failed to save custom monster token", err);
		}
	};

	const handleReplaceTokenImage = async () => {
		setCustomTokenUrl("");
		setHasImageError(false);
		setIsReplacingToken(true);
		if (onTokenImageChange) {
			onTokenImageChange(monster, null);
			return;
		}
		try {
			await api.updateCustomBestiaryMonster(
				monster.id || effectiveName || monster.name,
				{
					imageUrl: null,
				},
			);
		} catch (err) {
			console.error("Failed to clear custom monster token", err);
		}
	};

	function handleDragStart(e) {
		if (!externalSrc) return;
		e.dataTransfer.effectAllowed = "copy";

		// Commonly useful types for web drop zones.
		e.dataTransfer.setData("text/uri-list", externalSrc);
		e.dataTransfer.setData("text/plain", externalSrc);
		e.dataTransfer.setData(
			"text/html",
			`<img src="${externalSrc}" alt="${monster.name}">`,
		);

		// Optional, but sometimes useful for third-party drop zones.
		// Format: mimeType:filename:url
		e.dataTransfer.setData(
			"DownloadURL",
			`image/webp:${effectiveName}.webp:${externalSrc}`,
		);
	}

	const isGridLayout = layoutMode === "grid";
	const abilityFieldByLabel = {
		STR: "str",
		DEX: "dex",
		CON: "con",
		INT: "int",
		WIS: "wis",
		CHA: "cha",
	};

	return (
		<div
			className={classNames("MonsterStatBlock", {
				MonsterStatBlock__grid: isGridLayout,
			})}
		>
			<div className="MonsterStatBlock__header">
				<div className="MonsterStatBlock__token_wrapper">
					{shouldShowTokenDropzone ? (
						<div className="MonsterStatBlock__token_dropzone">
							<ImageDropzone
								campaignSlug={tokenUploadCampaignSlug}
								initialSource={tokenUploadCampaignSlug}
								initialCategory="tokens"
								initialSubcategory=""
								onUploadSuccess={handleCustomTokenUpload}
							/>
							{customTokenSrc && !hasImageError && (
								<Button
									variant="ghost"
									size={Button.SIZES.SMALL}
									onClick={() => setIsReplacingToken(false)}
								>
									{lang.t("Cancel")}
								</Button>
							)}
						</div>
					) : !hasImageError ? (
						<div
							className="MonsterStatBlock__tokenDragProxy"
							draggable
							onDragStart={handleDragStart}
						>
							<img
								src={localSrc}
								alt={monster.name}
								className="MonsterStatBlock__token"
								draggable={false}
								onError={() => setHasImageError(true)}
							/>
							{allowTokenUpload &&
								(isCustomMonster || onTokenImageChange) && (
									<Button
										variant="ghost"
										size={Button.SIZES.SMALL}
										icon="image"
										className="MonsterStatBlock__replace_token_btn"
										onClick={handleReplaceTokenImage}
										title={lang.t("Replace image")}
									/>
								)}
						</div>
					) : (
						<div className="MonsterStatBlock__token_skeleton">
							<Icon name="dice" />
						</div>
					)}
				</div>
				<div className="MonsterStatBlock__header__details">
					<div className="MonsterStatBlock__name__row">
						{onNameClick ? (
							<Tooltip content={nameTitle} disabled={!nameTitle}>
								<h3
									className={classNames(
										"MonsterStatBlock__name",
										changedClass("name"),
									)}
									onClick={() => onNameClick?.(monster)}
								>
									{highlight(monster.name)}
								</h3>
							</Tooltip>
						) : (
							<ClickToCopy
								className={classNames(
									"MonsterStatBlock__name",
									changedClass("name"),
								)}
								text={monster.name}
								message={lang.t("Name copied!")}
							>
								{highlight(monster.name)}
							</ClickToCopy>
						)}
						{showFavoriteAction && (
							<Button
								variant="ghost"
								size={Button.SIZES.SMALL}
								icon="star"
								className={classNames("MonsterStatBlock__favorite_btn", {
									is_active: isFavorite,
								})}
								onClick={handleToggleFavorite}
								title={
									isFavorite ? "Remove from favorites" : "Add to favorites"
								}
							/>
						)}
						{onAiAction && (
							<Button
								variant="ghost"
								size={Button.SIZES.SMALL}
								icon="wand"
								className="MonsterStatBlock__ai_btn"
								onClick={() => onAiAction(monster)}
								title={lang.t("AI creature action")}
							/>
						)}
						{onFieldEdit && (
							<Button
								variant="ghost"
								size={Button.SIZES.SMALL}
								icon="edit"
								className="MonsterStatBlock__edit_btn"
								onClick={() => onFieldEdit(monster)}
								title={lang.t("Edit creature")}
							/>
						)}
						{onDelete && (
							<Button
								variant="danger"
								size={Button.SIZES.SMALL}
								icon="trash"
								className="MonsterStatBlock__delete_btn"
								onClick={() => onDelete(monster)}
								title={lang.t("Delete custom creature")}
							/>
						)}
						{showAddToEncounterPicker && (
							<Button
								variant="primary"
								size={Button.SIZES.SMALL}
								icon="plus"
								className="MonsterStatBlock__add_to_encounter_btn"
								onClick={handleAddToEncounter}
							>
								{lang.t("Add to encounter")}
							</Button>
						)}
					</div>

					{monster.originalBestiaryName &&
						monster.originalBestiaryName !== monster.name && (
							<div
								className={classNames(
									"MonsterStatBlock__original_name muted",
									changedClass("originalBestiaryName"),
								)}
							>
								({highlight(monster.originalBestiaryName)})
							</div>
						)}

					<div
						className={classNames(
							"MonsterStatBlock__meta_line",
							changedClass("size", "type", "alignment"),
						)}
					>
						{highlight(model.size)} {highlight(model.typeLabel)},{" "}
						{highlight(model.alignment)}
					</div>
					{sourceLabel && (
						<div
							className={classNames(
								"MonsterStatBlock__meta_line",
								changedClass("source"),
							)}
						>
							<strong>Source:</strong> {highlight(sourceLabel)}
						</div>
					)}
					<div className="MonsterStatBlock__stats__wrap">
						<div className="MonsterStatBlock__stats">
							<div
								className={classNames(
									"stat_item",
									changedClass("hp", "hit_points"),
								)}
							>
								<strong>HP:</strong>{" "}
								{renderContent(model.hp.val)}{" "}
								{model.hp.formula && (
									<>
										(
										<RollDice formula={model.hp.formula}>
											{highlight(model.hp.formula)}
										</RollDice>
										)
									</>
								)}
							</div>
							<div
								className={classNames(
									"stat_item ac",
									changedClass("ac", "armor_class"),
								)}
							>
								<strong>AC:</strong>{" "}
								{renderContent(model.ac.val)} {renderContent(model.ac.desc)}
							</div>
							<div className={classNames("stat_item", changedClass("speed"))}>
								<strong>Speed:</strong> {highlight(model.speed)}
							</div>
						</div>
						<div className="MonsterStatBlock__properties">
							{renderSaves()}

							{model.skills.length > 0 && (
								<div
									className={classNames(
										"MonsterStatBlock__property_item MonsterStatBlock__property_item__skills",
										changedClass("skill"),
									)}
								>
									<strong>Skills:</strong>{" "}
									{model.skills.map(([name, value], idx, arr) => (
										<React.Fragment key={name}>
											<span
												className="skill_name"
												style={{ textTransform: "capitalize" }}
											>
												{highlight(name)}
											</span>{" "}
											<RollDice
												formula={`1d20${formatModifier(parseInt(value))}`}
											>
												{formatModifier(parseInt(value))}
											</RollDice>
											{idx < arr.length - 1 ? ", " : ""}
										</React.Fragment>
									))}
								</div>
							)}

							{monster.vulnerable && (
								<div
									className={classNames(
										"MonsterStatBlock__property_item",
										changedClass("vulnerable"),
									)}
								>
									<strong>Damage Vulnerabilities:</strong>{" "}
									{highlight(model.formatDamageProperty(monster.vulnerable))}
								</div>
							)}
							{monster.resist && (
								<div
									className={classNames(
										"MonsterStatBlock__property_item",
										changedClass("resist"),
									)}
								>
									<strong>Damage Resistances:</strong>{" "}
									{highlight(model.formatDamageProperty(monster.resist))}
								</div>
							)}
							{monster.immune && (
								<div
									className={classNames(
										"MonsterStatBlock__property_item",
										changedClass("immune"),
									)}
								>
									<strong>Damage Immunities:</strong>{" "}
									{highlight(model.formatDamageProperty(monster.immune))}
								</div>
							)}
							{monster.conditionImmune && (
								<div
									className={classNames(
										"MonsterStatBlock__property_item",
										changedClass("conditionImmune"),
									)}
								>
									<strong>Condition Immunities:</strong>{" "}
									{highlight(
										model.formatDamageProperty(monster.conditionImmune),
									)}
								</div>
							)}

							<div className="MonsterStatBlock__description">
								<p className={changedClass("senses")}>
									<strong>Senses:</strong> {renderSenses()}
								</p>
								<p className={changedClass("languages")}>
									<strong>Languages:</strong> {highlight(model.languages)}
								</p>
								<p className={changedClass("cr")}>
									<strong>CR:</strong> {highlight(model.challenge)}
								</p>
							</div>
							{monster.desc && (
								<div
									className={classNames(
										"MonsterStatBlock__lore",
										changedClass("desc"),
									)}
								>
									{renderInlineText(monster.desc)}
								</div>
							)}
						</div>
					</div>
					{!isGridLayout && (
						<div className="MonsterStatBlock__abilities">
							{renderAbilities()}
						</div>
					)}
				</div>
			</div>
			{isGridLayout && (
				<div className="MonsterStatBlock__abilities">
					{renderAbilities()}
				</div>
			)}
			{renderSpellcasting()}
			{renderNewSpellcasting()}
			{renderActionList(monster.trait, "Traits", "trait")}
			{renderActionList(monster.bonus, "Bonus Actions", "bonus")}
			{renderActionList(monster.action, "Actions", "action")}
			{renderActionList(monster.reaction, "Reactions", "reaction")}
			{renderActionList(monster.legendary, "Legendary Actions", "legendary")}
			{monster.lairActions && monster.lairActions.length > 0 && (
				<div
					className={classNames(
						"MonsterStatBlock__section",
						changedClass("lairActions"),
					)}
				>
					<h4>Lair Actions:</h4>
					{renderContent(monster.lairActions)}
				</div>
			)}
			{monster.regionalEffects && monster.regionalEffects.length > 0 && (
				<div
					className={classNames(
						"MonsterStatBlock__section",
						changedClass("regionalEffects"),
					)}
				>
					<h4>Regional Effects:</h4>
					{renderContent(monster.regionalEffects)}
				</div>
			)}
		</div>
	);
}
