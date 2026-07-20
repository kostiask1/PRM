import React, { useMemo, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import { renderMentionText } from "../../../features/rich-content/index.js";
import { lang, classNames } from "../../../shared/lib/index.js";
import {
	buildCampaignSearchSnippet,
	getCampaignSearchHighlightTerms,
	getCampaignSearchResultTitle,
	type CampaignSearchFilter,
	type CampaignSearchResult,
} from "../model.js";

const FILTER_COLOR_BY_ID: Record<CampaignSearchFilter, string> = {
	notes: "#38bdf8",
	npc: "#f97316",
	locations: "#a3e635",
	scenes: "#e879f9",
};

const MARKDOWN_TAGS_WITH_MENTIONS = ["p", "strong", "em", "del", "blockquote", "li", "h1", "h2", "h3", "h4", "h5", "h6", "td", "th", "a", "span"] as const;
const INLINE_MARKDOWN_BLOCK_TAGS = new Set<string>(["p", "blockquote", "li", "h1", "h2", "h3", "h4", "h5", "h6", "td", "th"]);

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderHighlightedText(text: unknown, terms: string[]): ReactNode {
	const source = String(text || "");
	if (!source) return source;
	if (!terms.length) return renderMentionText(source);
	const pattern = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
	return source.split(pattern).filter(Boolean).map((part, index) => {
		const content = renderMentionText(part);
		return terms.some((term) => part.toLowerCase() === term.toLowerCase())
			? <mark key={`${part}:${index}`} className="GlobalSearch__highlight">{content}</mark>
			: <React.Fragment key={`${part}:${index}`}>{content}</React.Fragment>;
	});
}

function renderMentionChildren(children: ReactNode, terms: string[]): ReactNode {
	return React.Children.map(children, (child) => renderMentionChild(child, terms));
}

function isElementWithMentionChildren(child: ReactNode): child is React.ReactElement<{ children: ReactNode }> {
	if (!React.isValidElement<{ children?: ReactNode }>(child)) return false;
	return Boolean(child.props.children);
}

function isMentionExcludedElement(child: React.ReactElement): boolean {
	return ["code", "pre"].includes(String(child.type));
}

function renderMentionChild(child: ReactNode, terms: string[]): ReactNode {
	if (typeof child === "string") return renderHighlightedText(child, terms);
	if (!isElementWithMentionChildren(child)) return child;
	if (isMentionExcludedElement(child)) return child;
	return React.cloneElement(child, { children: renderMentionChildren(child.props.children, terms) });
}

function ParsedSearchText({ text, inline = false, highlight = "" }: { text: unknown; inline?: boolean; highlight?: string }) {
	const terms = useMemo(() => getCampaignSearchHighlightTerms(highlight), [highlight]);
	const components = useMemo<Components>(() => Object.fromEntries(
		MARKDOWN_TAGS_WITH_MENTIONS.map((tag) => [tag, ({ children, ...props }: { children?: ReactNode } & HTMLAttributes<HTMLElement>) => React.createElement(inline && INLINE_MARKDOWN_BLOCK_TAGS.has(tag) ? "span" : tag, props, renderMentionChildren(children, terms))]),
	) as Components, [inline, terms]);
	const value = String(text || "");
	return value.trim() ? <ReactMarkdown components={components}>{value}</ReactMarkdown> : null;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
	return target instanceof Element && Boolean(target.closest("a, button, input, textarea, select"));
}

function SearchResultRow({ result, query, onOpen }: { result: CampaignSearchResult; query: string; onOpen: (result: CampaignSearchResult) => void }) {
	const snippet = buildCampaignSearchSnippet(result.text, query);
	const title = getCampaignSearchResultTitle(result.title);
	const activate = (target: EventTarget | null) => { if (!isInteractiveTarget(target)) onOpen(result); };
	const style = { "--search-result-color": FILTER_COLOR_BY_ID[result.filter] } as CSSProperties;
	return (
		<div role="button" tabIndex={0} className={classNames("GlobalSearch__result", `is_${result.filter}`)} style={style} onClick={(event) => activate(event.target)} onKeyDown={(event) => {
			if (event.key !== "Enter" && event.key !== " ") return;
			if (isInteractiveTarget(event.target)) return;
			event.preventDefault();
			onOpen(result);
		}}>
			<span className="GlobalSearch__resultType">{lang.t(`Search filter: ${result.filter}`)}</span>
			{title && <strong><ParsedSearchText text={title} inline highlight={query} /></strong>}
			<span><ParsedSearchText text={result.subtitle} inline highlight={query} /></span>
			{snippet && <p><ParsedSearchText text={snippet} inline highlight={query} /></p>}
		</div>
	);
}

export default function CampaignSearchResults({ results, query, onOpen }: { results: CampaignSearchResult[]; query: string; onOpen: (result: CampaignSearchResult) => void }) {
	return <div className="GlobalSearch__results">{results.length ? results.map((result) => <SearchResultRow key={result.id} result={result} query={query} onOpen={onOpen} />) : <div className="GlobalSearch__state">{lang.t("No results")}</div>}</div>;
}

export { FILTER_COLOR_BY_ID };
