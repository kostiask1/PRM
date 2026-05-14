import React from "react";
import ReactMarkdown from "react-markdown";

import RollDice from "../components/RollDice";
import SpellLink from "../components/SpellLink";
import EntityLink from "../components/common/EntityLink";
import {
	capitalizeWords,
	formatModifier,
	preprocessTags,
} from "../utils/parser.jsx";

export const renderRecursiveContent = (
	content,
	onSpellClick,
	onConditionClick,
	onSpellHover,
	onConditionHover,
	onDiseaseClick,
	onDiseaseHover,
	onVariantRuleClick,
	onVariantRuleHover,
	onSkillClick,
	onSkillHover,
) => {
	if (content === undefined || content === null) return null;

	if (typeof content === "string") {
		return parseRollsAndSpells(
			preprocessTags(content),
			onSpellClick,
			onConditionClick,
			onSpellHover,
			onConditionHover,
			onDiseaseClick,
			onDiseaseHover,
			onVariantRuleClick,
			onVariantRuleHover,
			onSkillClick,
			onSkillHover,
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
					onDiseaseClick,
					onDiseaseHover,
					onVariantRuleClick,
					onVariantRuleHover,
					onSkillClick,
					onSkillHover,
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
				onDiseaseClick,
				onDiseaseHover,
				onVariantRuleClick,
				onVariantRuleHover,
				onSkillClick,
				onSkillHover,
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
									onDiseaseClick,
									onDiseaseHover,
									onVariantRuleClick,
									onVariantRuleHover,
									onSkillClick,
									onSkillHover,
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
						onDiseaseClick,
						onDiseaseHover,
						onVariantRuleClick,
						onVariantRuleHover,
						onSkillClick,
						onSkillHover,
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
												onDiseaseClick,
												onDiseaseHover,
												onVariantRuleClick,
												onVariantRuleHover,
												onSkillClick,
												onSkillHover,
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
												onDiseaseClick,
												onDiseaseHover,
												onVariantRuleClick,
												onVariantRuleHover,
												onSkillClick,
												onSkillHover,
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
			onDiseaseClick,
			onDiseaseHover,
			onVariantRuleClick,
			onVariantRuleHover,
			onSkillClick,
			onSkillHover,
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

function stripNotesReferenceText(text) {
	return String(text || "").replace(
		/\s*\(see\s+(?:the\s+)?["“][^"”]+["”]\s+in notes\)\.?/gi,
		"",
	);
}

export const parseRollsAndSpells = (
	text,
	onSpellClick,
	onConditionClick,
	onSpellHover,
	onConditionHover,
	onDiseaseClick,
	onDiseaseHover,
	onVariantRuleClick,
	onVariantRuleHover,
	onSkillClick,
	onSkillHover,
) => {
	if (!text) return text;

	const cleanText = stripNotesReferenceText(text);
	const elements = [];
	const regex =
		/(\d+d\d+(?:\s*[+-]\s*\d+)?)|([+-]\d+(?:\s+to\s+hit))|(\{@spell\s+([^}]+)\})|(\{@(?:condition|status)\s+([^}]+)\})|(@condition\s+([A-Za-z][A-Za-z' -]*))|(\{@disease\s+([^}]+)\})|(\{@variantrule\s+([^}]+)\})|(\{@skill\s+([^}]+)\})/gi;
	let lastIndex = 0;
	let matchIndex = 0;
	let match;

	while ((match = regex.exec(cleanText)) !== null) {
		const fullMatch = match[0];
		const start = match.index;
		pushSafeMarkdownText(
			elements,
			cleanText.slice(lastIndex, start),
			`t-${matchIndex}-before`,
		);

		const roll = match[1];
		const hit = match[2];
		const spellTag = match[3];
		const spellValue = match[4];
		const conditionTag = match[5];
		const conditionValue = match[6];
		const conditionPlain = match[7];
		const diseaseValue = match[10];
		const variantRuleValue = match[12];
		const skillValue = match[14];

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
						type="spell"
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
						type={conditionTag?.toLowerCase().startsWith("{@status") ? "status" : "condition"}
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
		} else if (diseaseValue) {
			const { name: rawDiseaseName, displayText } = parseTaggedName(diseaseValue);
			if (onDiseaseClick) {
				elements.push(
					<SpellLink
						key={`d-${matchIndex}`}
						type="disease"
						onClick={() => onDiseaseClick(rawDiseaseName)}
						onHoverResolve={
							onDiseaseHover
								? () => onDiseaseHover(rawDiseaseName, displayText)
								: null
						}
					>
						{displayText}
					</SpellLink>,
				);
			} else {
				pushSafeMarkdownText(elements, displayText, `t-${matchIndex}-disease`);
			}
		} else if (variantRuleValue) {
			const { name: rawRuleName, displayText } = parseTaggedName(variantRuleValue);
			if (onVariantRuleClick) {
				elements.push(
					<SpellLink
						key={`v-${matchIndex}`}
						type="variantrule"
						onClick={() => onVariantRuleClick(rawRuleName)}
						onHoverResolve={
							onVariantRuleHover
								? () => onVariantRuleHover(rawRuleName, displayText)
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
					`t-${matchIndex}-variantrule`,
				);
			}
		} else if (skillValue) {
			const { name: rawSkillName, displayText } = parseTaggedName(skillValue);
			if (onSkillClick) {
				elements.push(
					<SpellLink
						key={`sk-${matchIndex}`}
						type="skill"
						onClick={() => onSkillClick(rawSkillName)}
						onHoverResolve={
							onSkillHover
								? () => onSkillHover(rawSkillName, displayText)
								: null
						}
					>
						{displayText}
					</SpellLink>,
				);
			} else {
				pushSafeMarkdownText(elements, displayText, `t-${matchIndex}-skill`);
			}
		} else {
			pushSafeMarkdownText(elements, fullMatch, `t-${matchIndex}-raw`);
		}

		lastIndex = start + fullMatch.length;
		matchIndex += 1;
	}

	pushSafeMarkdownText(
		elements,
		cleanText.slice(lastIndex),
		`t-${matchIndex}-tail`,
	);
	return elements;
};

export function renderMentionText(text) {
	const parts = String(text || "").split(/(\[[^\]]+\])/g);
	return parts.map((part, index) => {
		if (part.startsWith("[") && part.endsWith("]")) {
			const name = part.slice(1, -1).trim();
			return (
				<EntityLink key={index} name={name}>
					{name}
				</EntityLink>
			);
		}
		return part;
	});
}
