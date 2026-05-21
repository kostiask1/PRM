import React from "react";
import ReactMarkdown from "react-markdown";

import RollDice from "../components/RollDice";
import RulesLink from "../components/RulesLink";
import EntityLink from "../components/common/EntityLink";
import {
	capitalizeWords,
	formatModifier,
	preprocessTags,
} from "../utils/parser.jsx";
import {
	CONTENT_TOKEN_REGEX,
	tokenFromContentMatch,
} from "../utils/contentTokens.js";
import { highlightText } from "../utils/searchHighlight.jsx";

export const renderRecursiveContent = (
	content,
	highlightQuery = "",
	options = {},
) => {
	if (content === undefined || content === null) return null;

	if (typeof content === "string") {
		return parseRollsAndSpells(
			preprocessTags(content),
			highlightQuery,
			options,
		);
	}

	if (typeof content === "number") {
		return highlightText(content, highlightQuery);
	}

	if (Array.isArray(content)) {
		return content.map((item, idx) => (
			<React.Fragment key={idx}>
				{renderRecursiveContent(item, highlightQuery, options)}
			</React.Fragment>
		));
	}

	if (typeof content === "object") {
		if (content.entry) {
			return renderRecursiveContent(content.entry, highlightQuery, options);
		}

		if (content.type === "list" && content.items) {
			return (
				<ul
					key={content.name || Math.random()}
					className={
						content.style === "list_hang_notitle" ? "list_hang_notitle" : ""
					}
				>
					{content.items.map((item, idx) => {
						const isObject = typeof item === "object" && item !== null;
						return (
							<li key={idx}>
								{isObject && item.name && (
									<strong>{highlightText(item.name, highlightQuery)}. </strong>
								)}
								{renderRecursiveContent(
									isObject ? item.entries || item.entry : item,
									highlightQuery,
									options,
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
				<div key={content.name || Math.random()} className="parser_section">
					{content.name && (
						<strong>{highlightText(content.name, highlightQuery)}. </strong>
					)}
					{renderRecursiveContent(content.entries, highlightQuery, options)}
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
						<div className="ParserTable__caption">
							{highlightText(content.caption, highlightQuery)}
						</div>
					)}
					<table className="ParserTable">
						{content.colLabels && (
							<thead>
								<tr>
									{content.colLabels.map((lbl, i) => (
										<th key={i} className={content.colStyles?.[i]}>
											{renderRecursiveContent(lbl, highlightQuery, options)}
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
											{renderRecursiveContent(cell, highlightQuery, options)}
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
			highlightQuery,
			options,
		);
	}

	return null;
};

function pushSafeMarkdownText(elements, text, key, highlightQuery = "") {
	if (!text) return;
	const query = String(highlightQuery || "").trim();
	if (query) {
		const regex = new RegExp(
			`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
			"gi",
		);
		const parts = String(text).split(regex);
		const normalizedQuery = query.toLowerCase();
		parts.forEach((part, index) => {
			if (!part) return;
			if (part.toLowerCase() === normalizedQuery) {
				elements.push(
					<mark key={`${key}-mark-${index}`} className="SearchHighlight">
						{part}
					</mark>,
				);
			} else {
				pushSafeMarkdownText(elements, part, `${key}-text-${index}`);
			}
		});
		return;
	}

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

function getReferenceKey(prefix, matchIndex, name) {
	return `${prefix}-${matchIndex}-${String(name || "").toLowerCase()}`;
}

export const parseRollsAndSpells = (
	text,
	highlightQuery = "",
	options = {},
) => {
	if (!text) return text;

	const cleanText = stripNotesReferenceText(text);
	const elements = [];
	const regex = new RegExp(
		CONTENT_TOKEN_REGEX.source,
		CONTENT_TOKEN_REGEX.flags,
	);
	let lastIndex = 0;
	let matchIndex = 0;
	let match;

	while ((match = regex.exec(cleanText)) !== null) {
		const token = tokenFromContentMatch(match);
		const fullMatch = token.fullMatch;
		const start = match.index;
		pushSafeMarkdownText(
			elements,
			cleanText.slice(lastIndex, start),
			`t-${matchIndex}-before`,
			highlightQuery,
		);

		const {
			recharge,
			roll,
			hit,
			hitSuffix,
			spellTag,
			spellValue,
			conditionTag,
			conditionValue,
			conditionPlain,
			diseaseValue,
			variantRuleValue,
			skillValue,
			senseValue,
		} = token;

		if (recharge) {
			elements.push(
				<RollDice key={`re-${matchIndex}`} formula="1d6">
					{highlightText(recharge, highlightQuery)}
				</RollDice>,
			);
		} else if (roll) {
			elements.push(
				<RollDice key={`r-${matchIndex}`} formula={roll.replace(/\s+/g, "")}>
					{highlightText(roll, highlightQuery)}
				</RollDice>,
			);
		} else if (hit) {
			const bonus = hit.split(" ")[0];
			elements.push(
				<RollDice
					key={`h-${matchIndex}`}
					formula={`1d20${formatModifier(parseInt(bonus, 10))}`}
				>
					{highlightText(`${hit}${hitSuffix}`, highlightQuery)}
				</RollDice>,
			);
		} else if (spellTag) {
			const { name: rawSpellName, displayText } = parseTaggedName(spellValue);
			elements.push(
				<RulesLink
					key={getReferenceKey("s", matchIndex, rawSpellName)}
					type="spell"
					name={rawSpellName}
					onNavigate={options.onRuleNavigate}
					openInNestedModal={options.openSpellInNestedModal}
				>
					{highlightText(displayText, highlightQuery)}
				</RulesLink>,
			);
		} else if (conditionTag || conditionPlain) {
			const rawCondition = conditionTag
				? parseTaggedName(conditionValue).name
				: conditionPlain.replace(/^@condition\s+/i, "").trim();
			const displayText = capitalizeWords(rawCondition);
			const conditionType = conditionTag?.toLowerCase().startsWith("{@status")
				? "status"
				: "condition";
			elements.push(
				<RulesLink
					key={getReferenceKey(conditionType, matchIndex, rawCondition)}
					type={conditionType}
					name={rawCondition}
					onNavigate={options.onRuleNavigate}
				>
					{highlightText(displayText, highlightQuery)}
				</RulesLink>,
			);
		} else if (diseaseValue) {
			const { name: rawDiseaseName, displayText } =
				parseTaggedName(diseaseValue);
			elements.push(
				<RulesLink
					key={getReferenceKey("d", matchIndex, rawDiseaseName)}
					type="disease"
					name={rawDiseaseName}
					onNavigate={options.onRuleNavigate}
				>
					{highlightText(displayText, highlightQuery)}
				</RulesLink>,
			);
		} else if (variantRuleValue) {
			const { name: rawRuleName, displayText } =
				parseTaggedName(variantRuleValue);
			elements.push(
				<RulesLink
					key={getReferenceKey("v", matchIndex, rawRuleName)}
					type="variantrule"
					name={rawRuleName}
					onNavigate={options.onRuleNavigate}
				>
					{highlightText(displayText, highlightQuery)}
				</RulesLink>,
			);
		} else if (skillValue) {
			const { name: rawSkillName, displayText } = parseTaggedName(skillValue);
			elements.push(
				<RulesLink
					key={getReferenceKey("sk", matchIndex, rawSkillName)}
					type="skill"
					name={rawSkillName}
					onNavigate={options.onRuleNavigate}
				>
					{highlightText(displayText, highlightQuery)}
				</RulesLink>,
			);
		} else if (senseValue) {
			const { name: rawSenseName, displayText } = parseTaggedName(senseValue);
			elements.push(
				<RulesLink
					key={getReferenceKey("se", matchIndex, rawSenseName)}
					type="sense"
					name={rawSenseName}
					onNavigate={options.onRuleNavigate}
				>
					{highlightText(displayText, highlightQuery)}
				</RulesLink>,
			);
		} else {
			pushSafeMarkdownText(
				elements,
				fullMatch,
				`t-${matchIndex}-raw`,
				highlightQuery,
			);
		}

		lastIndex = start + fullMatch.length;
		matchIndex += 1;
	}

	pushSafeMarkdownText(
		elements,
		cleanText.slice(lastIndex),
		`t-${matchIndex}-tail`,
		highlightQuery,
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
