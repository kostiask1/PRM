import { useEffect, useId, useMemo, useRef, useState } from "react";
import ReactList from "react-list";
import "../../../assets/components/Bestiary.css";
import "../../../assets/components/MentionPickerModalContent.css";

import {
	getMonsterTypeString,
	MonsterStatBlockModel,
	type BestiaryMonster,
} from "../../../entities/bestiary/index.js";
import { getSourceFullName } from "../../../entities/reference/index.js";
import { lang, rankSearchResultsByName } from "../../../shared/lib/index.js";
import {
	Button,
	highlightText,
	Icon,
	ListCard,
	Tooltip,
} from "../../../shared/ui/index.js";
import {
	filterMentionEntities,
	getAmbiguousMentionNames,
	groupMentionEntities,
	type EditorMentionEntity,
} from "./editorPresentation.ts";
import Input from "./Input.tsx";

export interface BestiaryMentionOption extends BestiaryMonster {
	name: string;
	source?: string;
}

export interface MentionPickerModalContentProps {
	entities: EditorMentionEntity[];
	bestiaryMonsters?: BestiaryMentionOption[];
	onSelect: (name: string, label?: string) => void;
	onCancel: () => void;
	initialQuery?: string;
}

function getMonsterSizeText(monster: BestiaryMentionOption): string {
	return String(
		Array.isArray(monster.size) ? monster.size[0] ?? "" : monster.size ?? "",
	);
}

function getMonsterTagText(monster: BestiaryMentionOption): string {
	if (!monster.type || typeof monster.type === "string") return "";
	return (monster.type.tags ?? [])
		.map((tag) =>
			tag && typeof tag === "object" && !Array.isArray(tag) && "tag" in tag
				? (tag as { tag?: unknown }).tag
				: tag,
		)
		.filter((tag): tag is string => typeof tag === "string")
		.join(", ");
}

function getMonsterCrDisplay(monster: BestiaryMentionOption): string {
	const rawCr = monster.cr;
	if (rawCr && typeof rawCr === "object" && !Array.isArray(rawCr) && "cr" in rawCr) {
		return String((rawCr as { cr?: unknown }).cr ?? "").trim();
	}
	return String(rawCr ?? "").trim();
}

function getFallbackScrollParent() {
	if (typeof window === "undefined") return null;
	return window;
}

function BestiaryMentionListItem({
	monster,
	search,
	onSelect,
}: {
	monster: BestiaryMentionOption;
	search: string;
	onSelect: () => void;
}) {
	const tokenModel = new MonsterStatBlockModel(monster);
	const localTokenSrc = tokenModel.localTokenSrc;
	const externalTokenSrc = tokenModel.externalTokenSrc;
	const tokenSrc =
		typeof monster.imageUrl === "string" && monster.imageUrl.trim()
			? monster.imageUrl.trim()
			: localTokenSrc;
	const crDisplay = getMonsterCrDisplay(monster);
	const sourceFullName = getSourceFullName(monster.source);

	return (
		<div>
			<ListCard onClick={onSelect}>
				<div className="Bestiary__item_content">
					<img
						className="Bestiary__item_token"
						src={tokenSrc}
						alt=""
						loading="lazy"
						draggable={false}
						onLoad={(event) => {
							event.currentTarget.hidden = false;
						}}
						onError={(event) => {
							if (
								tokenSrc === localTokenSrc &&
								event.currentTarget.src !== externalTokenSrc
							) {
								event.currentTarget.src = externalTokenSrc;
							} else {
								event.currentTarget.hidden = true;
							}
						}}
					/>
					<span className="Bestiary__item_tokenFallback" aria-hidden="true">
						<Icon name="skull" size={20} />
					</span>
					<div className="Bestiary__item_info">
						<div className="ListCard__title" title={monster.name}>
							{highlightText(monster.name, search)}
						</div>
						<div className="ListCard__meta">
							{highlightText(getMonsterSizeText(monster), search)}{" "}
							{highlightText(getMonsterTypeString(monster.type), search)}{" "}
							{highlightText(getMonsterTagText(monster), search)}
							{monster.source && (
								<Tooltip content={sourceFullName} disabled={!sourceFullName}>
									<span className="Bestiary__item_source">
										{" "}
										• {highlightText(monster.source, search)}
									</span>
								</Tooltip>
							)}
						</div>
					</div>
					{crDisplay && (
						<Tooltip content={lang.t("Challenge Rating")}>
							<div className="Bestiary__item_cr">
								<div className="Bestiary__cr_label">CR</div>
								<div className="Bestiary__cr_value">{crDisplay}</div>
							</div>
						</Tooltip>
					)}
				</div>
			</ListCard>
		</div>
	);
}

export default function MentionPickerModalContent({
	entities,
	bestiaryMonsters = [],
	onSelect,
	onCancel,
	initialQuery = "",
}: MentionPickerModalContentProps) {
	const [query, setQuery] = useState(initialQuery);
	const [label, setLabel] = useState(initialQuery);
	const searchId = useId();
	const labelId = useId();
	const bestiaryListContainerRef = useRef<HTMLDivElement>(null);
	const bestiaryListRef = useRef<ReactList>(null);
	const duplicateNames = useMemo(() => getAmbiguousMentionNames(entities), [entities]);
	const groups = useMemo(
		() => groupMentionEntities(filterMentionEntities(entities, query)),
		[entities, query],
	);
	const hasBestiary = bestiaryMonsters.length > 0;
	const hasCampaignEntities = entities.length > 0;
	const filteredBestiary = useMemo(() => {
		if (!hasBestiary) return [];
		const normalized = String(query || "").trim().toLocaleLowerCase();
		if (!normalized) return bestiaryMonsters;
		return rankSearchResultsByName(
			bestiaryMonsters.filter((monster) => {
				const name = String(monster.name || "").toLocaleLowerCase();
				const source = String(monster.source || "").toLocaleLowerCase();
				const typeText = getMonsterTypeString(monster.type).toLocaleLowerCase();
				const sizeText = getMonsterSizeText(monster).toLocaleLowerCase();
				const tagText = getMonsterTagText(monster).toLocaleLowerCase();
				const crText = getMonsterCrDisplay(monster).toLocaleLowerCase();
				return (
					name.includes(normalized) ||
					source.includes(normalized) ||
					typeText.includes(normalized) ||
					sizeText.includes(normalized) ||
					tagText.includes(normalized) ||
					crText === normalized
				);
			}),
			normalized,
			(monster) => monster.name,
		);
	}, [bestiaryMonsters, hasBestiary, query]);

	useEffect(() => {
		if (bestiaryListContainerRef.current) {
			bestiaryListContainerRef.current.scrollTop = 0;
		}
	}, [query]);

	return (
		<div className="MentionPickerModalContent">
			<div className="MentionPickerModalContent__fields">
				<label className="MentionPickerModalContent__field" htmlFor={searchId}>
					<span>{lang.t("Find entity")}</span>
					<Input
						id={searchId}
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder={lang.t("Search NPC, character, or location...")}
						autoFocus
					/>
				</label>
				<label className="MentionPickerModalContent__field" htmlFor={labelId}>
					<span>{lang.t("Link text")}</span>
					<Input
						id={labelId}
						value={label}
						onChange={(event) => setLabel(event.target.value)}
						placeholder={lang.t("Use entity name")}
					/>
				</label>
			</div>

			<div
				className={`MentionPickerModalContent__columns${hasBestiary ? " has-bestiary" : ""}${hasBestiary && !hasCampaignEntities ? " only-bestiary" : ""}`}
			>
				{(!hasBestiary || hasCampaignEntities) &&
					groups.map((group) => (
						<section key={group.key} className="MentionPickerModalContent__column">
							<h4 className="MentionPickerModalContent__columnTitle">
								{lang.t(group.label)}
							</h4>
							<div className="MentionPickerModalContent__list">
								{group.items.length > 0 ? (
									group.items.map((entity) => {
										const ambiguous = duplicateNames.has(String(entity.name || "").trim().toLowerCase());
										return (
										<button
											key={`${entity.type}-${entity.scope || "campaign"}-${entity.id}-${entity.name}`}
											type="button"
											className="MentionPickerModalContent__item"
											disabled={ambiguous}
											title={ambiguous ? lang.t("Rename duplicate entities to create a link.") : undefined}
											onClick={() => onSelect(String(entity.name || ""), label || undefined)}
										>
											<span className="MentionPickerModalContent__itemName">{entity.name}</span>
											{entity.scope === "session" && <span className="MentionPickerModalContent__scope">{lang.t("Session")}</span>}
											{ambiguous && <span className="MentionPickerModalContent__duplicate">{lang.t("Duplicate name")}</span>}
										</button>
										);
									})
								) : (
									<p className="muted MentionPickerModalContent__empty">
										{lang.t("Nothing found.")}
									</p>
								)}
							</div>
						</section>
					))}
				{hasBestiary && (
					<section className="MentionPickerModalContent__column MentionPickerModalContent__column--bestiary Bestiary">
						<h4 className="MentionPickerModalContent__columnTitle">
							{lang.t("Bestiary")}
						</h4>
						{filteredBestiary.length > 0 ? (
							<div
								className="Bestiary__list MentionPickerModalContent__bestiaryList"
								ref={bestiaryListContainerRef}
							>
								<ReactList
									key={query.trim().toLocaleLowerCase()}
									ref={bestiaryListRef}
									itemRenderer={(index) => {
										const monster = filteredBestiary[index];
										if (!monster) return null;
										return (
											<BestiaryMentionListItem
												key={`bestiary-${monster.source || "all"}-${monster.name}`}
												monster={monster}
												search={query}
												onSelect={() =>
													onSelect(
														String(monster.name || ""),
														label || undefined,
													)
												}
											/>
										);
									}}
									length={filteredBestiary.length}
									scrollParentGetter={() =>
										bestiaryListContainerRef.current ||
										getFallbackScrollParent()
									}
									scrollParentViewportSizeGetter={() =>
										bestiaryListContainerRef.current?.clientHeight ||
										getFallbackScrollParent()?.innerHeight ||
										0
									}
									type="uniform"
								/>
							</div>
						) : (
							<p className="muted MentionPickerModalContent__empty">
								{lang.t("Nothing found.")}
							</p>
						)}
					</section>
				)}
			</div>
			{duplicateNames.size > 0 && (
				<p className="MentionPickerModalContent__hint">{lang.t("Rename duplicate entities to create a link.")}</p>
			)}

			<div className="MentionPickerModalContent__actions">
				<Button variant="ghost" onClick={onCancel}>
					{lang.t("Cancel")}
				</Button>
			</div>
		</div>
	);
}
