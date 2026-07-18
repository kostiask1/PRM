import { useMemo, useState } from "react";

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
		<div className="MentionPicker">
			<Input
				value={query}
				onChange={(event) => setQuery(event.target.value)}
				placeholder={lang.t("Search NPC, character, or location...")}
				autoFocus
			/>

			<div className="MentionPicker__columns">
				{groups.map((group) => (
					<section key={group.key} className="MentionPicker__column">
						<h4 className="MentionPicker__column_title">
							{lang.t(group.label)}
						</h4>
						<div className="MentionPicker__list">
							{group.items.length > 0 ? (
								group.items.map((entity) => (
									<button
										key={`${entity.type}-${entity.id}-${entity.name}`}
										type="button"
										className="MentionPicker__item"
										onClick={() => onSelect(String(entity.name || ""))}
									>
										<span>{entity.name}</span>
									</button>
								))
							) : (
								<p className="muted MentionPicker__empty">
									{lang.t("Nothing found.")}
								</p>
							)}
						</div>
					</section>
				))}
			</div>

			<div className="MentionPicker__actions">
				<Button variant="ghost" onClick={onCancel}>
					{lang.t("Cancel")}
				</Button>
			</div>
		</div>
	);
}
