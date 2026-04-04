// Keep this import as JSX is used
import React from "react";
import remarkBreaks from "remark-breaks";
import ReactMarkdown from "react-markdown";
import RollDice from "../components/RollDice/RollDice";
import SpellLink from "../components/SpellLink/SpellLink";

// Мапінг для скорочень здібностей
export const ABILITY_MAP = {
	str: "Strength",
	dex: "Dexterity",
	con: "Constitution",
	int: "Intelligence",
	wis: "Wisdom",
	cha: "Charisma",
};

// Мапінг для скорочень типів атак
export const ATTACK_TYPE_MAP = {
	m: "Melee",
	r: "Ranged",
	"m,r": "Melee or Ranged",
	ms: "Melee Spell",
	rs: "Ranged Spell",
	"ms,rs": "Melee or Ranged Spell",
};

export const getAbilityModifier = (abilityScore) => {
	const score = parseInt(abilityScore, 10);
	if (isNaN(score)) return 0;
	return Math.floor((score - 10) / 2);
};

export const formatModifier = (modifier) => {
	if (modifier === 0) return "+0";
	return modifier > 0 ? `+${modifier}` : `${modifier}`;
};

export const capitalizeWords = (str) => {
	if (!str) return str;
	return str
		.split(" ")
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
		.join(" ");
};

export const getDamageBonus = (action) => {
	const bonus = parseInt(action?.damage_bonus);
	if (!bonus || isNaN(bonus)) return "";
	return bonus > 0 ? `+${bonus}` : `${bonus}`;
};

export const preprocessTags = (text) => {
	if (typeof text !== "string") return text;
	return text
		.replace(/{@h}/gi, "Hit: ")
		.replace(/{@dc\s+(\d+)}/gi, "DC $1")
		.replace(
			/{@status\s+([^|}]+)(?:\|[^|}]*)?(?:\|([^}]*))?}/gi,
			(m, g1, g2) => g2 || g1,
		)
		.replace(
			/{@condition\s+([^|}]+)(?:\|[^|}]*)?(?:\|([^}]*))?}/gi,
			(m, g1, g2) => g2 || g1,
		)
		.replace(/{@atk\s+mw}/gi, "Melee Weapon Attack: ")
		.replace(/{@atk\s+rw}/gi, "Ranged Weapon Attack: ")
		.replace(/{@atk\s+mw\s*,\s*rw}/gi, "Melee or Ranged Weapon Attack: ")
		.replace(/{@atk\s+ms}/gi, "Melee Spell Attack: ")
		.replace(/{@atk\s+rs}/gi, "Ranged Spell Attack: ")
		.replace(/{@atk\s+ms\s*,\s*rs}/gi, "Melee or Ranged Spell Attack: ")
		.replace(/{@hit\s+([+-]?\d+)}/gi, (m, g1) =>
			g1.startsWith("+") || g1.startsWith("-") ? g1 : `+${g1}`,
		)
		.replace(
			/{@dice\s+([^|}]+)(?:\|[^|}]*)?(?:\|([^}]*))?}/gi,
			(m, g1, g2) => g2 || g1,
		)
		.replace(
			/{@damage\s+([^|}]+)(?:\|[^|}]*)?(?:\|([^}]*))?}/gi,
			(m, g1, g2) => g2 || g1,
		)
		.replace(
			/{@scaledamage\s+([^|}]+)(?:\|[^|}]*)?(?:\|([^}]*))?}/gi,
			(m, g1, g2) => g2 || g1,
		)
		.replace(
			/{@scaledice\s+([^|}]+)(?:\|[^|}]*)?(?:\|([^}]*))?}/gi,
			(m, g1, g2) => g2 || g1,
		)
		.replace(/{@hitYourSpellAttack}/gi, "your spell attack bonus")
		.replace(/{@actSaveFail}/gi, "On a failure,")
		.replace(/{@actSaveSuccess}/gi, "On a success,")
		.replace(
			/{@variantrule\s+([^|}]+)(?:\|[^|}]*)?(?:\|([^}]*))?}/gi,
			(m, g1, g2) => g2 || g1,
		)
		.replace(/{@ability\s+([a-z]{3})}/gi, (m, g1) => ABILITY_MAP[g1] || g1)
		.replace(
			/{@savingThrow\s+([a-z]{3})}/gi,
			(m, g1) => `${ABILITY_MAP[g1] || g1} saving throw`,
		)
		.replace(
			/{@actSave\s+([a-z]{3})}/gi,
			(m, g1) => `${ABILITY_MAP[g1] || g1} saving throw`,
		)
		.replace(/{@recharge(?:\s+(\d+))?}/gi, (m, g1) =>
			g1 ? `(Recharge ${g1}-6)` : "(Recharge)",
		)
		.replace(
			/{@atkr\s+([a-z,]+)}/gi,
			(m, g1) => `${ATTACK_TYPE_MAP[g1] || g1} Attack: `,
		)
		.replace(/{@chance\s+(\d+)}/gi, "$1%")
		.replace(/{@note\s+([^}]+)}/gi, "$1")
		.replace(/{@loader\s+[^}]+}/gi, "")
		.replace(
			/{@(?:creature|action|link|skill|item|filter|quickref|book|sense|area|hazard|trap|deck|optfeature|reward|feat|charoption|background|race)\s+([^|}]+)(?:\|[^|}]*)?(?:\|([^}]*))?}/gi,
			(m, g1, g2) => g2 || g1,
		)
		.replace(/{@(?:i|italic)\s+([^}]+)}/gi, "*$1*")
		.replace(/{@(?:b|bold)\s+([^}]+)}/gi, "**$1**");
};

export const renderRecursiveContent = (content, onSpellClick) => {
	if (content === undefined || content === null) return null;

	if (typeof content === "string") {
		return parseRollsAndSpells(preprocessTags(content), onSpellClick);
	}

	if (Array.isArray(content)) {
		return content.map((item, idx) => (
			<React.Fragment key={idx}>
				{renderRecursiveContent(item, onSpellClick)}
			</React.Fragment>
		));
	}

	if (typeof content === "object") {
		if (content.entry) {
			return renderRecursiveContent(content.entry, onSpellClick);
		}

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
								{renderRecursiveContent(
									isObject ? item.entries || item.entry : item,
									onSpellClick,
								)}
							</li>
						);
					})}
				</ul>
			);
		} else if (
			(content.type === "entries" || content.type === "section") &&
			content.entries
		) {
			return (
				<div key={content.name || Math.random()} className="parser-section">
					{content.name && <strong>{content.name}. </strong>}
					{renderRecursiveContent(content.entries, onSpellClick)}
				</div>
			);
		}
		return parseRollsAndSpells(
			preprocessTags(JSON.stringify(content)),
			onSpellClick,
		);
	}
	return null;
};

export const parseRollsAndSpells = (text, onSpellClick) => {
	if (!text) return text;
	// Regex для пошуку кубиків, бонусів атаки та посилань {@spell Name}
	const regex =
		/(\d+d\d+(?:\s*[+-]\s*\d+)?)|([+-]\d+(?:\s+to\s+hit))|(\{@spell\s+([^}]+)\})/gi;
	const parts = text.split(regex);
	const elements = [];

	for (let i = 0; i < parts.length; i += 5) {
		if (parts[i]) {
			// Екрануємо символи, які Markdown може сприйняти як початок списку (+, -, *, цифри з крапкою)
			// особливо якщо вони опинилися на початку фрагмента після розбиття тексту
			// Виправлено: тепер коректно екранує маркери списків, а не видаляє їх.
			// Шукає необов'язкові пробіли на початку рядка, потім маркер списку (+, -, *, або цифра з крапкою),
			// а потім пробіл. Екранує знайдений маркер.
			const safeText = parts[i]
				.replace(/^(\s*)([+\-*]|\d+\.)(\s)/gm, "$1\\$2$3")
				.replace(/\n/gi, "&nbsp; \n");
			elements.push(
				<ReactMarkdown
					key={`t-${i}`}
					components={{ p: "span" }}
					remarkPlugins={[remarkBreaks]}>
					{safeText}
				</ReactMarkdown>,
			);
		}

		if (i + 1 < parts.length) {
			const roll = parts[i + 1];
			const hit = parts[i + 2];
			const spellFull = parts[i + 3];
			const spellName = parts[i + 4];

			if (roll) {
				elements.push(
					<RollDice key={`r-${i}`} formula={roll.replace(/\s+/g, "")}>
						{roll}
					</RollDice>,
				);
			} else if (hit) {
				const bonus = hit.split(" ")[0];
				elements.push(
					<RollDice
						key={`h-${i}`}
						formula={`1d20${formatModifier(parseInt(bonus))}`}>
						{hit}
					</RollDice>,
				);
			} else if (spellFull && onSpellClick) {
				const spellParts = spellName.split("|");
				const rawDisplayText = spellParts[2] || spellParts[0];
				const displayText = capitalizeWords(rawDisplayText);
				elements.push(
					<SpellLink key={`s-${i}`} onClick={() => onSpellClick(displayText)}>
						{displayText}
					</SpellLink>,
				);
			}
		}
	}
	return elements;
};
