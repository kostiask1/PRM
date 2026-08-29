import { useMemo, useState } from "react";
import "../../../assets/components/MentionPickerModalContent.css";

import { lang } from "../../../shared/lib/index.js";
import { Button } from "../../../shared/ui/index.js";
import {
	filterMentionEntities,
	groupMentionEntities,
	type EditorMentionEntity,
} from "./editorPresentation.ts";
import Input from "./Input.tsx";

export interface MentionPickerModalContentProps {
	entities: EditorMentionEntity[];
	onSelect: (name: string) => void;
	onCancel: () => void;
}

export default function MentionPickerModalContent({
	entities,
	onSelect,
	onCancel,
}: MentionPickerModalContentProps) {
	const [query, setQuery] = useState("");
	const groups = useMemo(
		() => groupMentionEntities(filterMentionEntities(entities, query)),
		[entities, query],
	);

	return (
		<div className="MentionPickerModalContent">
			<Input
				value={query}
				onChange={(event) => setQuery(event.target.value)}
				placeholder={lang.t("Search NPC, character, or location...")}
				autoFocus
			/>

			<div className="MentionPickerModalContent__columns">
				{groups.map((group) => (
					<section key={group.key} className="MentionPickerModalContent__column">
						<h4 className="MentionPickerModalContent__columnTitle">
							{lang.t(group.label)}
						</h4>
						<div className="MentionPickerModalContent__list">
							{group.items.length > 0 ? (
								group.items.map((entity) => (
									<button
										key={`${entity.type}-${entity.id}-${entity.name}`}
										type="button"
										className="MentionPickerModalContent__item"
										onClick={() => onSelect(String(entity.name || ""))}
									>
										<span>{entity.name}</span>
									</button>
								))
							) : (
								<p className="muted MentionPickerModalContent__empty">
									{lang.t("Nothing found.")}
								</p>
							)}
						</div>
					</section>
				))}
			</div>

			<div className="MentionPickerModalContent__actions">
				<Button variant="ghost" onClick={onCancel}>
					{lang.t("Cancel")}
				</Button>
			</div>
		</div>
	);
}
