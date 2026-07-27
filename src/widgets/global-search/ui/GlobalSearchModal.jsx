import React, { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";

import { campaignApi } from "../../../entities/campaign/api.js";
import {
	filterGlobalSearchIndex,
	normalizeGlobalSearchText,
} from "../../../entities/campaign/model.js";
import { sessionApi } from "../../../entities/session/api.js";
import { isAbortError } from "../../../shared/api/index.js";
import { mapWithConcurrency } from "../../../shared/lib/index.js";
import { navigateTo } from "../../../shared/model/index.js";
import { useAppSelector } from "../../../shared/lib/index.js";
import { lang } from "../../../shared/config/index.js";
import { buildNavigationUrl } from "../../../shared/lib/navigation.js";
import {
	makeDomId,
	scrollToHashTarget,
} from "../../../shared/lib/domNavigation.js";
import { renderMentionText } from "../../../renderers/contentRenderer.jsx";
import Button from "../../../components/form/Button";
import Modal from "../../../components/common/Modal";
import classNames from "../../../shared/lib/classNames.js";
import "../../../assets/components/GlobalSearchModal.css";

const FILTERS = ["notes", "scenes", "npc", "locations"];
const SESSION_LOAD_CONCURRENCY = 6;

const FILTER_COLOR_BY_ID = {
	notes: "#38bdf8",
	npc: "#f97316",
	locations: "#a3e635",
	scenes: "#e879f9",
};

const MARKDOWN_TAGS_WITH_MENTIONS = [
	"p",
	"strong",
	"em",
	"del",
	"blockquote",
	"li",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"td",
	"th",
	"a",
	"span",
];

const INLINE_MARKDOWN_BLOCK_TAGS = new Set([
	"p",
	"blockquote",
	"li",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"td",
	"th",
]);

function escapeRegExp(value) {
	return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getHighlightTerms(query) {
	return [
		...new Set(
			String(query || "")
				.trim()
				.split(/\s+/)
				.map((term) => term.trim())
				.filter((term) => term.length >= 2),
		),
	];
}

function renderHighlightedText(text, highlightTerms) {
	const source = String(text || "");
	if (!source) return source;
	if (!highlightTerms?.length) return renderMentionText(source);

	const pattern = new RegExp(
		`(${highlightTerms.map(escapeRegExp).join("|")})`,
		"gi",
	);
	return source
		.split(pattern)
		.filter((part) => part !== "")
		.map((part, index) => {
			const isMatch = highlightTerms.some(
				(term) => part.toLowerCase() === term.toLowerCase(),
			);
			const content = renderMentionText(part);
			return isMatch ? (
				<mark key={`${part}:${index}`} className="GlobalSearch__highlight">
					{content}
				</mark>
			) : (
				<React.Fragment key={`${part}:${index}`}>{content}</React.Fragment>
			);
		});
}

function renderMentionChildren(children, highlightTerms = []) {
	return React.Children.map(children, (child) => {
		if (typeof child === "string") {
			return renderHighlightedText(child, highlightTerms);
		}
		if (React.isValidElement(child) && child.props?.children) {
			if (child.type === "code" || child.type === "pre") {
				return child;
			}
			return React.cloneElement(child, {
				...child.props,
				children: renderMentionChildren(child.props.children, highlightTerms),
			});
		}
		return child;
	});
}

function ParsedSearchText({ text, inline = false, highlight = "" }) {
	const highlightTerms = useMemo(
		() => getHighlightTerms(highlight),
		[highlight],
	);
	const components = useMemo(
		() =>
			Object.fromEntries(
				MARKDOWN_TAGS_WITH_MENTIONS.map((tag) => [
					tag,
					({ children, ...tagProps }) =>
						React.createElement(
							inline && INLINE_MARKDOWN_BLOCK_TAGS.has(tag) ? "span" : tag,
							tagProps,
							renderMentionChildren(children, highlightTerms),
						),
				]),
			),
		[highlightTerms, inline],
	);
	const value = String(text || "");
	if (!value.trim()) return null;
	return <ReactMarkdown components={components}>{value}</ReactMarkdown>;
}

function asText(value) {
	if (value === null || value === undefined) return "";
	if (typeof value === "string" || typeof value === "number")
		return String(value);
	if (Array.isArray(value)) return value.map(asText).join("\n");
	if (typeof value === "object") {
		return Object.entries(value)
			.filter(([key]) => !key.startsWith("_") && key !== "imageUrl")
			.map(([, item]) => asText(item))
			.join("\n");
	}
	return "";
}

function getEntityName(entity, fallback = "") {
	const fullName =
		`${entity?.firstName || ""} ${entity?.lastName || ""}`.trim();
	return (
		fullName || entity?.name || entity?.title || fallback || lang.t("Untitled")
	);
}

function getLocationName(location) {
	return location?.name || location?.title || lang.t("Untitled");
}

function getNoteTitle(note) {
	return String(note?.title || "").trim();
}

function getSearchResultTitle(value) {
	const firstLine = String(value || "")
		.split(/\r?\n/)
		.map((line) => line.trim())
		.find(Boolean);
	return firstLine || "";
}

function buildSnippet(text, query) {
	const source = String(text || "")
		.replace(/\s+/g, " ")
		.trim();
	if (!source) return "";
	const normalizedSource = normalizeGlobalSearchText(source);
	const normalizedQuery = normalizeGlobalSearchText(query);
	const index = normalizedQuery
		? normalizedSource.indexOf(normalizedQuery)
		: -1;
	const start = index >= 0 ? Math.max(0, index - 70) : 0;
	const snippet = source.slice(start, start + 180);
	return `${start > 0 ? "..." : ""}${snippet}${start + 180 < source.length ? "..." : ""}`;
}

function pushResult(results, item) {
	const searchText = normalizeGlobalSearchText(
		[item.title, item.subtitle, item.text].join("\n"),
	);
	results.push({ ...item, searchText });
}

function pushNote(results, note, options) {
	const title = getNoteTitle(note);
	const text = [note?.title, note?.text].filter(Boolean).join("\n");
	pushResult(results, {
		id: `${options.idPrefix}:${note?.id || title || "note"}`,
		filter: "notes",
		title,
		subtitle: options.subtitle,
		text,
		target: options.target,
	});
}

function pushEntity(results, entity, options) {
	const title = options.getTitle(entity);
	const notes = Array.isArray(entity?.notes) ? entity.notes : [];
	const text = [
		title,
		entity?.race,
		entity?.class,
		entity?.motivation,
		entity?.description,
		entity?.trait,
		asText(notes),
	].join("\n");
	pushResult(results, {
		id: `${options.idPrefix}:${entity?.id || entity?.slug || title}`,
		filter: options.filter,
		title,
		subtitle: options.subtitle,
		text,
		target: options.target,
	});
	notes.forEach((note, index) => {
		pushNote(results, note, {
			idPrefix: `${options.idPrefix}:${entity?.id || index}:note`,
			title: `${title} · ${lang.t("Note")} ${index + 1}`,
			subtitle: `${options.subtitle} · ${title}`,
			target: options.target,
		});
	});
}

function buildSearchIndex({ campaign, entities, sessions }) {
	const results = [];
	const campaignSlug = campaign.slug;
	const campaignTarget = { campaignSlug };

	pushResult(results, {
		id: "campaign-description",
		filter: "notes",
		title: lang.t("Campaign description"),
		subtitle: campaign.name,
		text: campaign.description || "",
		target: { ...campaignTarget, hash: makeDomId("campaign", "description") },
	});

	(campaign.notes || []).forEach((note, index) => {
		pushNote(results, note, {
			idPrefix: `campaign-note-${note?.id || index}`,
			subtitle: `${campaign.name} · ${lang.t("Campaign notes")}`,
			target: {
				...campaignTarget,
				hash: makeDomId("campaign", "note", note?.id || index),
			},
		});
	});

	(entities.characters || []).forEach((character) => {
		pushEntity(results, character, {
			filter: "npc",
			idPrefix: "campaign-character",
			subtitle: lang.t("Character"),
			getTitle: getEntityName,
			target: {
				...campaignTarget,
				hash: makeDomId(
					"campaign",
					"character",
					character?.id || character?.slug,
				),
			},
		});
	});

	(entities.npc || []).forEach((npc) => {
		pushEntity(results, npc, {
			filter: "npc",
			idPrefix: "campaign-npc",
			subtitle: `${lang.t("NPC")} · ${lang.t("Campaign scope")}`,
			getTitle: getEntityName,
			target: {
				...campaignTarget,
				hash: makeDomId("campaign", "npc", npc?.id || npc?.slug),
			},
		});
	});

	(entities.locations || []).forEach((location) => {
		pushEntity(results, location, {
			filter: "locations",
			idPrefix: "campaign-location",
			subtitle: `${lang.t("Location")} · ${lang.t("Campaign scope")}`,
			getTitle: getLocationName,
			target: {
				...campaignTarget,
				hash: makeDomId("campaign", "location", location?.id || location?.slug),
			},
		});
	});

	sessions.forEach((sessionEntry) => {
		const session = sessionEntry.detail || sessionEntry;
		const fileName = sessionEntry.fileName || session.fileName;
		const data = session.data || {};
		const sessionTarget = { campaignSlug, sessionFileName: fileName };
		(data.notes || []).forEach((note, index) => {
			pushNote(results, note, {
				idPrefix: `session-${fileName}-note-${note?.id || index}`,
				subtitle: `${session.name || fileName} · ${lang.t("Notes")}`,
				target: {
					...sessionTarget,
					hash: makeDomId("session", "note", note?.id || index),
				},
			});
		});
		(data.npcs || []).forEach((npc) => {
			pushEntity(results, npc, {
				filter: "npc",
				idPrefix: `session-${fileName}-npc`,
				subtitle: `${lang.t("NPC")} · ${session.name || fileName}`,
				getTitle: getEntityName,
				target: {
					...sessionTarget,
					hash: makeDomId("session", "npc", npc?.id),
				},
			});
		});
		(data.locations || []).forEach((location) => {
			pushEntity(results, location, {
				filter: "locations",
				idPrefix: `session-${fileName}-location`,
				subtitle: `${lang.t("Location")} · ${session.name || fileName}`,
				getTitle: getLocationName,
				target: {
					...sessionTarget,
					hash: makeDomId("session", "location", location?.id),
				},
			});
		});
		(data.scenes || []).forEach((scene, index) => {
			const sceneTitle =
				scene.title ||
				scene.name ||
				lang.t("Scene {number}", { number: index + 1 });
			const sceneTarget = {
				...sessionTarget,
				hash: makeDomId("session", "scene", scene?.id || index),
			};
			pushResult(results, {
				id: `session-${fileName}-scene-${scene?.id || index}`,
				filter: "scenes",
				title: sceneTitle,
				subtitle: `${lang.t("Scene")} · ${session.name || fileName}`,
				text: asText(scene),
				target: sceneTarget,
			});
			(scene.notes || []).forEach((note, noteIndex) => {
				pushNote(results, note, {
					idPrefix: `session-${fileName}-scene-${scene?.id || index}-note-${note?.id || noteIndex}`,
					subtitle: `${sceneTitle} · ${lang.t("Scene notes")}`,
					target: sceneTarget,
				});
			});
		});
	});

	return results;
}

function openTarget(target) {
	const url = buildNavigationUrl(
		target.campaignSlug,
		target.sessionFileName || null,
		target.encounterId || null,
	);
	navigateTo(
		target.campaignSlug,
		target.sessionFileName || null,
		false,
		target.encounterId || null,
	);
	if (target.hash) {
		const hash = `#${encodeURIComponent(target.hash)}`;
		window.history.replaceState({}, "", `${url}${hash}`);
		window.setTimeout(() => scrollToHashTarget(`#${target.hash}`), 80);
		window.setTimeout(() => {
			if (window.location.pathname !== url) return;
			if (window.location.hash !== hash) return;
			window.history.replaceState({}, "", url);
		}, 2400);
	}
}

export default function GlobalSearchModal({ onCancel }) {
	const campaign = useAppSelector((state) => state.active.campaign);
	const currentData = campaign;
	const [query, setQuery] = useState("");
	const [activeFilters, setActiveFilters] = useState(() => new Set(FILTERS));
	const [index, setIndex] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		if (!campaign) return undefined;
		const controller = new AbortController();
		async function load() {
			setIsLoading(true);
			setError("");
			try {
				const options = { signal: controller.signal };
				const [characters, npc, locations, sessionList] = await Promise.all([
					campaignApi.getEntities(campaign.slug, "characters", options),
					campaignApi.getEntities(campaign.slug, "npc", options),
					campaignApi.getEntities(campaign.slug, "locations", options),
					sessionApi.listSessions(campaign.slug, options),
				]);
				const sessionDetails = await mapWithConcurrency(
					sessionList,
					SESSION_LOAD_CONCURRENCY,
					async (session) => ({
						...session,
						detail: await sessionApi.getSession(
							campaign.slug,
							session.fileName,
							options,
						),
					}),
				);
				if (controller.signal.aborted) return;
				const campaignSnapshot = { ...campaign, ...(currentData || {}) };
				setIndex(
					buildSearchIndex({
						campaign: campaignSnapshot,
						entities: {
							characters: currentData?.characters || characters,
							npc: currentData?.npcs || npc,
							locations: currentData?.locations || locations,
						},
						sessions: sessionDetails,
					}),
				);
			} catch (err) {
				if (!isAbortError(err) && !controller.signal.aborted) {
					setError(err.message || lang.t("Unknown error"));
				}
			} finally {
				if (!controller.signal.aborted) setIsLoading(false);
			}
		}
		load();
		return () => controller.abort();
	}, [campaign, currentData]);

	const results = useMemo(() => {
		return filterGlobalSearchIndex(index, activeFilters, query);
	}, [activeFilters, index, query]);

	const toggleFilter = (filter) => {
		setActiveFilters((current) => {
			const next = new Set(current);
			if (next.has(filter)) next.delete(filter);
			else next.add(filter);
			return next.size > 0 ? next : new Set([filter]);
		});
	};

	const renderResult = (result) => {
		const snippet = buildSnippet(result.text, query);
		const title = getSearchResultTitle(result.title);

		return (
			<div
				key={result.id}
				role="button"
				tabIndex={0}
				className={classNames("GlobalSearch__result", `is_${result.filter}`)}
				style={{ "--search-result-color": FILTER_COLOR_BY_ID[result.filter] }}
				onClick={(event) => {
					if (event.target?.closest?.("a, button, input, textarea, select")) {
						return;
					}
					onCancel?.();
					openTarget(result.target);
				}}
				onKeyDown={(event) => {
					if (event.key !== "Enter" && event.key !== " ") return;
					if (event.target?.closest?.("a, button, input, textarea, select")) {
						return;
					}
					event.preventDefault();
					onCancel?.();
					openTarget(result.target);
				}}
			>
				<span className="GlobalSearch__resultType">
					{lang.t(`Search filter: ${result.filter}`)}
				</span>
				{title && (
					<strong>
						<ParsedSearchText text={title} inline highlight={query} />
					</strong>
				)}
				<span>
					<ParsedSearchText text={result.subtitle} inline highlight={query} />
				</span>
				{snippet && (
					<p>
						<ParsedSearchText text={snippet} inline highlight={query} />
					</p>
				)}
			</div>
		);
	};

	return (
		<Modal
			title={lang.t("Global search")}
			onCancel={onCancel}
			showFooter={false}
		>
			<div className="GlobalSearch">
				<div className="GlobalSearch__bar">
					<input
						autoFocus
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder={lang.t("Search campaign...")}
					/>
				</div>
				<div className="GlobalSearch__filters">
					{FILTERS.map((filter) => (
						<Button
							key={filter}
							variant={activeFilters.has(filter) ? "primary" : "ghost"}
							size={Button.SIZES.SMALL}
							className="GlobalSearch__filter"
							onClick={() => toggleFilter(filter)}
							style={{ "--search-result-color": FILTER_COLOR_BY_ID[filter] }}
						>
							{lang.t(`Search filter: ${filter}`)}
						</Button>
					))}
				</div>
				{isLoading && (
					<div className="GlobalSearch__state">{lang.t("Loading...")}</div>
				)}
				{error && <div className="GlobalSearch__state is_error">{error}</div>}
				{!isLoading && !error && (
					<div className="GlobalSearch__results">
						{results.length === 0 ? (
							<div className="GlobalSearch__state">{lang.t("No results")}</div>
						) : (
							results.map(renderResult)
						)}
					</div>
				)}
			</div>
		</Modal>
	);
}
