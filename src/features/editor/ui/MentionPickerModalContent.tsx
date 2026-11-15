import { useId, useMemo, useState } from "react";
import "../../../assets/components/MentionPickerModalContent.css";

import { lang } from "../../../shared/lib/index.js";
import { Button } from "../../../shared/ui/index.js";
import {
	filterMentionEntities,
	getAmbiguousMentionNames,
	groupMentionEntities,
	type EditorMentionEntity,
} from "./editorPresentation.ts";
import Input from "./Input.tsx";

export interface MentionPickerModalContentProps {
	entities: EditorMentionEntity[];
	onSelect: (name: string, label?: string) => void;
	onCancel: () => void;
	initialQuery?: string;
}

export default function MentionPickerModalContent({
	entities,
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

			<div className="MentionPickerModalContent__columns">
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
