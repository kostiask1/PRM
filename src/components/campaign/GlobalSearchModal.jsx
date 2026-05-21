import React, { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";

import { api } from "../../api";
import { navigateTo } from "../../store/appStore";
import { lang } from "../../services/localization";
import { buildNavigationUrl } from "../../utils/navigation";
import { makeDomId, scrollToHashTarget } from "../../utils/domNavigation";
import { renderMentionText } from "../../renderers/contentRenderer.jsx";
import Button from "../form/Button";
import Modal from "../common/Modal";
import classNames from "../../utils/classNames";
import "../../assets/components/GlobalSearchModal.css";

const FILTERS = [
	"notes",
	"scenes",
	"npc",
	"locations",
	"sessions",
	"monsters",
	"mentions",
];

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

function renderMentionChildren(children) {
	return React.Children.map(children, (child) => {
		if (typeof child === "string") {
			return renderMentionText(child);
		}
		if (React.isValidElement(child) && child.props?.children) {
			if (child.type === "code" || child.type === "pre") {
				return child;
			}
			return React.cloneElement(child, {
				...child.props,
				children: renderMentionChildren(child.props.children),
			});
		}
		return child;
	});
}

function ParsedSearchText({ text, inline = false }) {
	const components = useMemo(
		() =>
			Object.fromEntries(
				MARKDOWN_TAGS_WITH_MENTIONS.map((tag) => [
					tag,
					({ children, ...tagProps }) =>
						React.createElement(
							inline && tag === "p" ? "span" : tag,
							tagProps,
							renderMentionChildren(children),
						),
				]),
			),
		[inline],
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

function normalize(value) {
	return String(value || "")
		.toLowerCase()
		.replace(/\s+/g, " ")
		.trim();
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

function getNoteTitle(note, fallback) {
	return note?.title || fallback || lang.t("Untitled note");
}

function extractMentions(text) {
	const matches = [];
	const source = String(text || "");
	for (const match of source.matchAll(/\[([^\]\n]{2,120})\]/g)) {
		matches.push(match[1].trim());
	}
	return [...new Set(matches.filter(Boolean))];
}

function buildSnippet(text, query) {
	const source = String(text || "")
		.replace(/\s+/g, " ")
		.trim();
	if (!source) return "";
	const normalizedSource = normalize(source);
	const normalizedQuery = normalize(query);
	const index = normalizedQuery
		? normalizedSource.indexOf(normalizedQuery)
		: -1;
	const start = index >= 0 ? Math.max(0, index - 70) : 0;
	const snippet = source.slice(start, start + 180);
	return `${start > 0 ? "..." : ""}${snippet}${start + 180 < source.length ? "..." : ""}`;
}

function pushResult(results, item) {
	const searchText = normalize(
		[item.title, item.subtitle, item.text].join("\n"),
	);
	results.push({ ...item, searchText });
}

function pushNote(results, note, options) {
	const title = getNoteTitle(note, options.title);
	const text = [note?.title, note?.text].filter(Boolean).join("\n");
	pushResult(results, {
		id: `${options.idPrefix}:${note?.id || title}`,
		filter: "notes",
		title,
		subtitle: options.subtitle,
		text,
		target: options.target,
	});
	extractMentions(text).forEach((mention) => {
		pushResult(results, {
			id: `${options.idPrefix}:mention:${mention}`,
			filter: "mentions",
			title: mention,
			subtitle: `${lang.t("Mention")} · ${options.subtitle}`,
			text,
			target: options.target,
		});
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
		entity?.trait,
		entity?.description,
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
	extractMentions(text).forEach((mention) => {
		pushResult(results, {
			id: `${options.idPrefix}:${entity?.id || title}:mention:${mention}`,
			filter: "mentions",
			title: mention,
			subtitle: `${lang.t("Mention")} · ${options.subtitle} · ${title}`,
			text,
			target: options.target,
		});
	});
}

function buildSearchIndex({ campaign, entities, sessions, customMonsters }) {
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
		pushResult(results, {
			id: `session-${fileName}`,
			filter: "sessions",
			title: session.name || sessionEntry.name || fileName,
			subtitle: lang.t("Session"),
			text: asText(data),
			target: sessionTarget,
		});
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
		(data.encounters || []).forEach((encounter) => {
			(encounter.monsters || []).forEach((monster) => {
				pushResult(results, {
					id: `session-${fileName}-encounter-${encounter.id}-monster-${monster.instanceId || monster.name}`,
					filter: "monsters",
					title: monster.name || lang.t("Creature"),
					subtitle: `${lang.t("Combat encounter")} · ${encounter.name || lang.t("Untitled")}`,
					text: asText(monster),
					target: { ...sessionTarget, encounterId: encounter.id },
				});
			});
		});
	});

	customMonsters.forEach((monster) => {
		pushResult(results, {
			id: `custom-monster-${monster.name}`,
			filter: "monsters",
			title: monster.name || lang.t("Creature"),
			subtitle: lang.t("Custom creature"),
			text: asText(monster),
			target: {
				customMonster: monster.name,
				customMonsterSource: monster.source || "CUSTOM",
			},
		});
	});

	return results;
}

function openTarget(target) {
	if (target?.customMonster) {
		const params = new URLSearchParams({
			source: "CUSTOM",
			monster: target.customMonster,
			m_source: target.customMonsterSource || "CUSTOM",
		});
		window.location.href = `/bestiary?${params.toString()}`;
		return;
	}
	navigateTo(
		target.campaignSlug,
		target.sessionFileName || null,
		false,
		target.encounterId || null,
	);
	if (target.hash) {
		window.history.replaceState(
			{},
			"",
			`${buildNavigationUrl(target.campaignSlug, target.sessionFileName || null, target.encounterId || null)}#${encodeURIComponent(target.hash)}`,
		);
		window.setTimeout(() => scrollToHashTarget(`#${target.hash}`), 80);
	}
}

export default function GlobalSearchModal({ campaign, currentData, onCancel }) {
	const [query, setQuery] = useState("");
	const [activeFilters, setActiveFilters] = useState(() => new Set(FILTERS));
	const [index, setIndex] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		let cancelled = false;
		async function load() {
			setIsLoading(true);
			setError("");
			try {
				const [characters, npc, locations, sessionList, customData] =
					await Promise.all([
						api.getEntities(campaign.slug, "characters"),
						api.getEntities(campaign.slug, "npc"),
						api.getEntities(campaign.slug, "locations"),
						api.listSessions(campaign.slug),
						api.getCustomBestiaryData().catch(() => []),
					]);
				const sessionDetails = await Promise.all(
					(sessionList || []).map(async (session) => ({
						...session,
						detail: await api.getSession(campaign.slug, session.fileName),
					})),
				);
				if (cancelled) return;
				const campaignSnapshot = { ...campaign, ...(currentData || {}) };
				const customMonsters =
					customData?.monster ||
					customData?.monsters ||
					customData?.results ||
					(Array.isArray(customData) ? customData : []);
				setIndex(
					buildSearchIndex({
						campaign: campaignSnapshot,
						entities: {
							characters: currentData?.characters || characters,
							npc: currentData?.npcs || npc,
							locations: currentData?.locations || locations,
						},
						sessions: sessionDetails,
						customMonsters,
					}),
				);
			} catch (err) {
				if (!cancelled) setError(err.message || lang.t("Unknown error"));
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		}
		load();
		return () => {
			cancelled = true;
		};
	}, [campaign, currentData]);

	const results = useMemo(() => {
		const normalizedQuery = normalize(query);
		return index
			.filter((item) => activeFilters.has(item.filter))
			.filter(
				(item) => !normalizedQuery || item.searchText.includes(normalizedQuery),
			)
			.slice(0, 80);
	}, [activeFilters, index, query]);

	const toggleFilter = (filter) => {
		setActiveFilters((current) => {
			const next = new Set(current);
			if (next.has(filter)) next.delete(filter);
			else next.add(filter);
			return next.size > 0 ? next : new Set([filter]);
		});
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
							onClick={() => toggleFilter(filter)}
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
							results.map((result) => (
								<div
									key={result.id}
									role="button"
									tabIndex={0}
									className={classNames(
										"GlobalSearch__result",
										`is_${result.filter}`,
									)}
									onClick={(event) => {
										if (
											event.target?.closest?.(
												"a, button, input, textarea, select",
											)
										) {
											return;
										}
										onCancel?.();
										openTarget(result.target);
									}}
									onKeyDown={(event) => {
										if (event.key !== "Enter" && event.key !== " ") return;
										if (
											event.target?.closest?.(
												"a, button, input, textarea, select",
											)
										) {
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
									<strong>
										<ParsedSearchText text={result.title} inline />
									</strong>
									<span>
										<ParsedSearchText text={result.subtitle} inline />
									</span>
									{buildSnippet(result.text, query) && (
										<p>
											<ParsedSearchText
												text={buildSnippet(result.text, query)}
												inline
											/>
										</p>
									)}
								</div>
							))
						)}
					</div>
				)}
			</div>
		</Modal>
	);
}
