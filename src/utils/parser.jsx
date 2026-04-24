// Keep this import as JSX is used
import React from "react";
import ReactMarkdown from "react-markdown";
import RollDice from "../components/RollDice";
import SpellLink from "../components/SpellLink";
import EntityLink from "../components/common/EntityLink";

export const ABILITY_MAP = {
	str: "Strength",
	dex: "Dexterity",
	con: "Constitution",
	int: "Intelligence",
	wis: "Wisdom",
	cha: "Charisma",
};

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
	const bonus = parseInt(action?.damage_bonus, 10);
	if (!bonus || isNaN(bonus)) return "";
	return bonus > 0 ? `+${bonus}` : `${bonus}`;
};

export const preprocessTags = (text) => {
	if (typeof text !== "string") return text;
	return text
		.replace(/{@h}/gi, "Hit:")
		.replace(/{@dc\s+(\d+)}/gi, "DC $1")
		.replace(/{@atk\s+mw}/gi, "Melee Weapon Attack:")
		.replace(/{@atk\s+rw}/gi, "Ranged Weapon Attack:")
		.replace(/{@atk\s+mw\s*,\s*rw}/gi, "Melee or Ranged Weapon Attack:")
		.replace(/{@atk\s+ms}/gi, "Melee Spell Attack:")
		.replace(/{@atk\s+rs}/gi, "Ranged Spell Attack:")
		.replace(/{@atk\s+ms\s*,\s*rs}/gi, "Melee or Ranged Spell Attack:")
		.replace(/{@hit\s+([+-]?\d+)}/gi, (m, g1) =>
			g1.startsWith("+") || g1.startsWith("-") ? g1 : `+${g1}`,
		)
		.replace(
			/{@damage\s+([^|}]+)(?:\|([^|}]*))?(?:\|([^|}]*))?}/gi,
			(m, name, src, label) => label || name,
		)
		.replace(
			/{@scaledamage\s+([^|}]+)(?:\|([^|}]*))?(?:\|([^|}]*))?}/gi,
			(m, name, src, label) => label || name,
		)
		.replace(
			/{@scaledice\s+([^|}]+)(?:\|([^|}]*))?(?:\|([^|}]*))?}/gi,
			(m, name, src, label) => label || name,
		)
		.replace(
			/{@hitYourSpellAttack(?:\s+([^}]+))?}/gi,
			(m, label) => label || "your spell attack bonus",
		)
		.replace(/{@actSaveFail}/gi, "On a failure,")
		.replace(/{@actSaveFail\s+(\d+)}/gi, "On a failure by $1 or more,")
		.replace(/{@actSaveSuccess}/gi, "On a success,")
		.replace(/{@actSaveSuccessOrFail}/gi, "On a success or failure,")
		.replace(
			/{@dice\s+([^|}]+)(?:\|([^|}]*))?[^}]*}/gi,
			(m, formula, label) => label || formula,
		)
		.replace(
			/{@variantrule\s+([^|}]+)(?:\|([^|}]+))?(?:\|([^|}]+))?}/gi,
			(m, name, src, label) => `*${label || name}*`,
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
		.replace(/{@recharge(?:\s+(\d+))?}/gi, (m, g1) => {
			const num = g1 || "6";
			return num === "6" ? "(Recharge 6)" : `(Recharge ${num}-6)`;
		})
		.replace(
			/{@atkr\s+([a-z,]+)}/gi,
			(m, g1) => `${ATTACK_TYPE_MAP[g1] || g1} Attack: `,
		)
		.replace(/{@chance\s+(\d+)}/gi, "$1%")
		.replace(/{@note\s+([^}]+)}/gi, "$1")
		.replace(/{@hom}/gi, "")
		.replace(/{@loader\s+[^}]+}/gi, "")
		.replace(
			/{@(creature|action|link|skill|item|filter|quickref|book|sense|area|hazard|trap|deck|optfeature|reward|feat|charoption|background|race)\s+([^|}]+)(?:\|([^|}]*))?(?:\|([^|}]*))?[^}]*}/gi,
			(m, tag, name, source, label) => {
				if (tag === "filter") return name;
				return label || name;
			},
		)
		.replace(/{@(?:i|italic)\s+([^}]+)}/gi, "*$1*")
		.replace(/{@(?:b|bold)\s+([^}]+)}/gi, "**$1**");
};

export const renderRecursiveContent = (
	content,
	onSpellClick,
	onConditionClick,
	onSpellHover,
	onConditionHover,
) => {
	if (content === undefined || content === null) return null;

	if (typeof content === "string") {
		return parseRollsAndSpells(
			preprocessTags(content),
			onSpellClick,
			onConditionClick,
			onSpellHover,
			onConditionHover,
		);
	}

	if (typeof content === "number") {
		return content;
	}

	if (Array.isArray(content)) {
		return content.map((item, idx) => (
			<React.Fragment key={idx}>
				{renderRecursiveContent(
					item,
					onSpellClick,
					onConditionClick,
					onSpellHover,
					onConditionHover,
				)}
			</React.Fragment>
		));
	}

	if (typeof content === "object") {
		if (content.entry) {
			return renderRecursiveContent(
				content.entry,
				onSpellClick,
				onConditionClick,
				onSpellHover,
				onConditionHover,
			);
		}

		if (content.type === "list" && content.items) {
			return (
				<ul
					key={content.name || Math.random()}
					className={
						content.style === "list-hang-notitle" ? "list-hang-notitle" : ""
					}
				>
					{content.items.map((item, idx) => {
						const isObject = typeof item === "object" && item !== null;
						return (
							<li key={idx}>
								{isObject && item.name && <strong>{item.name}. </strong>}
								{renderRecursiveContent(
									isObject ? item.entries || item.entry : item,
									onSpellClick,
									onConditionClick,
									onSpellHover,
									onConditionHover,
								)}
							</li>
						);
					})}
				</ul>
			);
		}

		if (
			(content.type === "entries" || content.type === "section") &&
			content.entries
		) {
			return (
				<div key={content.name || Math.random()} className="parser-section">
					{content.name && <strong>{content.name}. </strong>}
					{renderRecursiveContent(
						content.entries,
						onSpellClick,
						onConditionClick,
						onSpellHover,
						onConditionHover,
					)}
				</div>
			);
		}

		if (content.type === "table") {
			return (
				<div
					className="ParserTable__wrapper"
					key={content.caption || Math.random()}
				>
					{content.caption && (
						<div className="ParserTable__caption">{content.caption}</div>
					)}
					<table className="ParserTable">
						{content.colLabels && (
							<thead>
								<tr>
									{content.colLabels.map((lbl, i) => (
										<th key={i} className={content.colStyles?.[i]}>
											{renderRecursiveContent(
												lbl,
												onSpellClick,
												onConditionClick,
												onSpellHover,
												onConditionHover,
											)}
										</th>
									))}
								</tr>
							</thead>
						)}
						<tbody>
							{content.rows.map((row, i) => (
								<tr key={i}>
									{row.map((cell, j) => (
										<td key={j} className={content.colStyles?.[j]}>
											{renderRecursiveContent(
												cell,
												onSpellClick,
												onConditionClick,
												onSpellHover,
												onConditionHover,
											)}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			);
		}

		return parseRollsAndSpells(
			preprocessTags(JSON.stringify(content)),
			onSpellClick,
			onConditionClick,
			onSpellHover,
			onConditionHover,
		);
	}

	return null;
};

function pushSafeMarkdownText(elements, text, key) {
	if (!text) return;
	const safeText = text
		.replace(/^(\s*)([+\-*]|\d+\.)(\s)/gm, "$1\\$2$3")
		.replace(/\n/gi, "&nbsp; \n")
		.replace(/^ /g, "\u00A0")
		.replace(/ $/g, "\u00A0");
	elements.push(
		<ReactMarkdown key={key} components={{ p: "span" }}>
			{safeText}
		</ReactMarkdown>,
	);
}

function parseTaggedName(raw) {
	const parts = String(raw || "").split("|");
	const name = String(parts[0] || "").trim();
	const label = String(parts[2] || "").trim();
	return {
		name,
		displayText: capitalizeWords(label || name),
	};
}

export const parseRollsAndSpells = (
	text,
	onSpellClick,
	onConditionClick,
	onSpellHover,
	onConditionHover,
) => {
	if (!text) return text;

	const elements = [];
	const regex =
		/(\d+d\d+(?:\s*[+-]\s*\d+)?)|([+-]\d+(?:\s+to\s+hit))|(\{@spell\s+([^}]+)\})|(\{@(?:condition|status)\s+([^}]+)\})|(@condition\s+([A-Za-z][A-Za-z' -]*))/gi;
	let lastIndex = 0;
	let matchIndex = 0;
	let match;

	while ((match = regex.exec(text)) !== null) {
		const fullMatch = match[0];
		const start = match.index;
		pushSafeMarkdownText(
			elements,
			text.slice(lastIndex, start),
			`t-${matchIndex}-before`,
		);

		const roll = match[1];
		const hit = match[2];
		const spellTag = match[3];
		const spellValue = match[4];
		const conditionTag = match[5];
		const conditionValue = match[6];
		const conditionPlain = match[7];

		if (roll) {
			elements.push(
				<RollDice key={`r-${matchIndex}`} formula={roll.replace(/\s+/g, "")}>
					{roll}
				</RollDice>,
			);
		} else if (hit) {
			const bonus = hit.split(" ")[0];
			elements.push(
				<RollDice
					key={`h-${matchIndex}`}
					formula={`1d20${formatModifier(parseInt(bonus, 10))}`}
				>
					{hit}
				</RollDice>,
			);
		} else if (spellTag) {
			const { name: rawSpellName, displayText } = parseTaggedName(spellValue);
			if (onSpellClick) {
				elements.push(
					<SpellLink
						key={`s-${matchIndex}`}
						onClick={() => onSpellClick(displayText)}
						onHoverResolve={
							onSpellHover
								? () => onSpellHover(rawSpellName, displayText)
								: null
						}
					>
						{displayText}
					</SpellLink>,
				);
			} else {
				pushSafeMarkdownText(elements, displayText, `t-${matchIndex}-spell`);
			}
		} else if (conditionTag || conditionPlain) {
			const rawCondition = conditionTag
				? parseTaggedName(conditionValue).name
				: conditionPlain.replace(/^@condition\s+/i, "").trim();
			const displayText = capitalizeWords(rawCondition);
			if (onConditionClick) {
				elements.push(
					<SpellLink
						key={`c-${matchIndex}`}
						onClick={() => onConditionClick(rawCondition)}
						onHoverResolve={
							onConditionHover
								? () => onConditionHover(rawCondition, displayText)
								: null
						}
					>
						{displayText}
					</SpellLink>,
				);
			} else {
				pushSafeMarkdownText(
					elements,
					displayText,
					`t-${matchIndex}-condition`,
				);
			}
		} else {
			pushSafeMarkdownText(elements, fullMatch, `t-${matchIndex}-raw`);
		}

		lastIndex = start + fullMatch.length;
		matchIndex += 1;
	}

	pushSafeMarkdownText(elements, text.slice(lastIndex), `t-${matchIndex}-tail`);
	return elements;
};

export function renderMentionText(text, keyPrefix = "mention", campaignSlug) {
	const parts = String(text || "").split(/(\[[^\]]+\])/g);
	return parts.map((part, index) => {
		if (part.startsWith("[") && part.endsWith("]")) {
			const name = part.slice(1, -1).trim();
			return (
				<EntityLink
					key={`${keyPrefix}-${index}`}
					name={name}
					campaignSlug={campaignSlug}
					className="mention-link"
				>
					{name}
				</EntityLink>
			);
		}
		return part;
	});
}
