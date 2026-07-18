import { Fragment, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";

import { RollDice } from "../../dice/index.js";
import { RulesLink } from "../../rules-reference/index.js";
import { EntityLink } from "../../entity-link/index.js";
import {
	extractContentTokens,
	preprocessTags,
} from "../../../entities/reference/index.js";
import { highlightText } from "../../../shared/ui/index.js";
import {
	asRichContentArray,
	getContentTokenRenderPlan,
	isRichContentRecord,
	stripNotesReferenceText,
	type ContentTokenRenderPlan,
	type RichContentRenderOptions,
} from "../model/richContentPresentation.ts";

interface RecursiveRenderProps {
	content: unknown;
	highlightQuery: string;
	options: RichContentRenderOptions;
}

export function renderRecursiveContent(
	content: unknown,
	highlightQuery = "",
	options: RichContentRenderOptions = {},
): ReactNode {
	if (content === undefined || content === null) return null;
	if (typeof content === "string") {
		return parseRollsAndSpells(content, highlightQuery, options);
	}
	if (typeof content === "number") return highlightText(content, highlightQuery);
	if (Array.isArray(content)) {
		return content.map((item, index) => (
			<Fragment key={index}>
				{renderRecursiveContent(item, highlightQuery, options)}
			</Fragment>
		));
	}
	if (!isRichContentRecord(content)) return null;
	return (
		<RichObjectContent
			content={content}
			highlightQuery={highlightQuery}
			options={options}
		/>
	);
}

function RichObjectContent({
	content,
	highlightQuery,
	options,
}: RecursiveRenderProps & { content: Record<string, unknown> }) {
	if (content.entry) {
		return renderRecursiveContent(content.entry, highlightQuery, options);
	}
	if (content.type === "list" && content.items) {
		return (
			<RichContentList
				content={content}
				highlightQuery={highlightQuery}
				options={options}
			/>
		);
	}
	if (
		(content.type === "entries" || content.type === "section") &&
		content.entries
	) {
		return (
			<RichContentSection
				content={content}
				highlightQuery={highlightQuery}
				options={options}
			/>
		);
	}
	if (content.type === "table") {
		return (
			<RichContentTable
				content={content}
				highlightQuery={highlightQuery}
				options={options}
			/>
		);
	}
	return parseRollsAndSpells(JSON.stringify(content), highlightQuery, options);
}

function RichContentList({
	content,
	highlightQuery,
	options,
}: RecursiveRenderProps & { content: Record<string, unknown> }) {
	const items = asRichContentArray(content.items);
	return (
		<ul className={content.style === "list_hang_notitle" ? "list_hang_notitle" : ""}>
			{items.map((item, index) => {
				const record = isRichContentRecord(item) ? item : null;
				const value = record ? record.entries ?? record.entry : item;
				const name = record?.name;
				return (
					<li key={index}>
						{Boolean(name) && (
							<strong>
								{renderRecursiveContent(name, highlightQuery, options)}.{" "}
							</strong>
						)}
						{renderRecursiveContent(value, highlightQuery, options)}
					</li>
				);
			})}
		</ul>
	);
}

function RichContentSection({
	content,
	highlightQuery,
	options,
}: RecursiveRenderProps & { content: Record<string, unknown> }) {
	return (
		<div className="parser_section">
			{Boolean(content.name) && (
				<strong>
					{renderRecursiveContent(content.name, highlightQuery, options)}.{" "}
				</strong>
			)}
			{renderRecursiveContent(content.entries, highlightQuery, options)}
		</div>
	);
}

function RichContentTable({
	content,
	highlightQuery,
	options,
}: RecursiveRenderProps & { content: Record<string, unknown> }) {
	const labels = asRichContentArray(content.colLabels);
	const showLabels = Boolean(content.colLabels);
	const styles = asRichContentArray(content.colStyles).map(String);
	const rows = asRichContentArray(content.rows).map(asRichContentArray);
	return (
		<div className="ParserTable__wrapper">
			{Boolean(content.caption) && (
				<div className="ParserTable__caption">
					{highlightText(content.caption, highlightQuery)}
				</div>
			)}
			<table className="ParserTable">
				{showLabels && (
					<thead>
						<tr>
							{labels.map((label, index) => (
								<th key={index} className={styles[index]}>
									{renderRecursiveContent(label, highlightQuery, options)}
								</th>
							))}
						</tr>
					</thead>
				)}
				<tbody>
					{rows.map((row, rowIndex) => (
						<tr key={rowIndex}>
							{row.map((cell, columnIndex) => (
								<td key={columnIndex} className={styles[columnIndex]}>
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

function pushSafeMarkdownText(
	elements: ReactNode[],
	text: unknown,
	key: string,
	highlightQuery = "",
): void {
	if (!text) return;
	const processedText = preprocessTags(String(text));
	const query = String(highlightQuery || "").trim();
	if (query) {
		pushHighlightedMarkdown(elements, processedText, key, query);
		return;
	}
	const markdownText = /^[*_]+$/.test(processedText)
		? processedText.replace(/([*_])/g, "\\$1")
		: processedText;
	const safeText = markdownText
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

function pushHighlightedMarkdown(
	elements: ReactNode[],
	text: string,
	key: string,
	query: string,
): void {
	const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const parts = text.split(new RegExp(`(${escapedQuery})`, "gi"));
	const normalizedQuery = query.toLowerCase();
	parts.forEach((part, index) => {
		if (!part) return;
		if (part.toLowerCase() === normalizedQuery) {
			elements.push(
				<mark key={`${key}-mark-${index}`} className="SearchHighlight">
					{part}
				</mark>,
			);
			return;
		}
		pushSafeMarkdownText(elements, part, `${key}-text-${index}`);
	});
}

function getReferenceKey(prefix: string, index: number, name: string): string {
	return `${prefix}-${index}-${name.toLowerCase()}`;
}

function pushTokenPlan(
	elements: ReactNode[],
	plan: ContentTokenRenderPlan,
	index: number,
	highlightQuery: string,
): void {
	const key = `${plan.keyPrefix}-${index}`;
	if (plan.kind === "text") {
		pushSafeMarkdownText(elements, plan.text, `${key}-plain`, highlightQuery);
		return;
	}
	if (plan.kind === "reference") {
		elements.push(
			<RulesLink
				key={getReferenceKey(plan.keyPrefix, index, plan.name)}
				type={plan.referenceType}
				name={plan.name}
			>
				{highlightText(plan.displayText, highlightQuery)}
			</RulesLink>,
		);
		return;
	}
	if (plan.kind === "damage") {
		if (plan.formula) {
			elements.push(
				<RollDice key={key} formula={plan.formula}>
					{highlightText(plan.displayText, highlightQuery)}
				</RollDice>,
			);
		}
		pushSafeMarkdownText(
			elements,
			plan.remainder,
			`${key}-remainder`,
			highlightQuery,
		);
		return;
	}
	elements.push(
		<RollDice key={key} formula={plan.formula} context={plan.context}>
			{highlightText(plan.displayText, highlightQuery)}
		</RollDice>,
	);
}

export function parseRollsAndSpells(
	text: unknown,
	highlightQuery = "",
	options: RichContentRenderOptions = {},
): ReactNode {
	if (!text) return text as ReactNode;
	const cleanText = stripNotesReferenceText(text);
	const elements: ReactNode[] = [];
	let lastIndex = 0;
	const tokens = extractContentTokens(cleanText);
	tokens.forEach((token, index) => {
		pushSafeMarkdownText(
			elements,
			cleanText.slice(lastIndex, token.index),
			`t-${index}-before`,
			highlightQuery,
		);
		pushTokenPlan(
			elements,
			getContentTokenRenderPlan(token, options),
			index,
			highlightQuery,
		);
		lastIndex = token.index + token.fullMatch.length;
	});
	pushSafeMarkdownText(
		elements,
		cleanText.slice(lastIndex),
		`t-${tokens.length}-tail`,
		highlightQuery,
	);
	return elements;
}

export function renderMentionText(text: unknown): ReactNode[] {
	return String(text || "")
		.split(/(\[[^\]]+\])/g)
		.map((part, index) => {
			if (!part.startsWith("[") || !part.endsWith("]")) return part;
			const name = part.slice(1, -1).trim();
			return (
				<EntityLink key={index} name={name}>
					{name}
				</EntityLink>
			);
		});
}
