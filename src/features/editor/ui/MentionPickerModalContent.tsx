import { useId, useMemo, useState } from "react";
import "../../../assets/components/MentionPickerModalContent.css";

import { lang, rankSearchResultsByName } from "../../../shared/lib/index.js";
import { Button } from "../../../shared/ui/index.js";
import {
	filterMentionEntities,
	getAmbiguousMentionNames,
	groupMentionEntities,
	type EditorMentionEntity,
} from "./editorPresentation.ts";
import Input from "./Input.tsx";

export interface BestiaryMentionOption {
	name: string;
	source?: string;
	cr?: string;
}

export interface MentionPickerModalContentProps {
	entities: EditorMentionEntity[];
	bestiaryMonsters?: BestiaryMentionOption[];
	onSelect: (name: string, label?: string) => void;
	onCancel: () => void;
	initialQuery?: string;
}

const MAX_VISIBLE_BESTIARY_MENTIONS = 80;

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
	const duplicateNames = useMemo(() => getAmbiguousMentionNames(entities), [entities]);
	const groups = useMemo(
		() => groupMentionEntities(filterMentionEntities(entities, query)),
		[entities, query],
	);
	const hasBestiary = bestiaryMonsters.length > 0;
	const filteredBestiary = useMemo(() => {
		if (!hasBestiary) return [];
		const normalized = String(query || "").trim().toLocaleLowerCase();
		const matching = normalized
			? rankSearchResultsByName(
					bestiaryMonsters.filter((monster) => {
						const name = String(monster.name || "").toLocaleLowerCase();
						const source = String(monster.source || "").toLocaleLowerCase();
						return name.includes(normalized) || source.includes(normalized);
					}),
					normalized,
					(monster) => monster.name,
				)
			: bestiaryMonsters;
		return matching.slice(0, MAX_VISIBLE_BESTIARY_MENTIONS);
	}, [bestiaryMonsters, hasBestiary, query]);

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
				className={`MentionPickerModalContent__columns${hasBestiary ? " has-bestiary" : ""}`}
			>
				{groups.map((group) => (
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
					<section className="MentionPickerModalContent__column">
						<h4 className="MentionPickerModalContent__columnTitle">
							{lang.t("Bestiary")}
						</h4>
						<div className="MentionPickerModalContent__list">
							{filteredBestiary.length > 0 ? (
								filteredBestiary.map((monster) => {
									const meta = [
										monster.source || "",
										monster.cr ? `CR ${monster.cr}` : "",
									]
										.filter(Boolean)
										.join(" · ");
									return (
										<button
											key={`bestiary-${monster.source || "all"}-${monster.name}`}
											type="button"
											className="MentionPickerModalContent__item"
											onClick={() => onSelect(String(monster.name || ""), label || undefined)}
										>
											<span className="MentionPickerModalContent__itemName">{monster.name}</span>
											{meta && <span className="MentionPickerModalContent__scope">{meta}</span>}
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
