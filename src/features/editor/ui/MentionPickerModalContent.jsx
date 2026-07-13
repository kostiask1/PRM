import { useState } from "react";

import { Button } from "../../../shared/ui/index.js";
import Input from "./Input.jsx";
import { lang } from "../../../shared/lib/index.js";

export default function MentionPickerModalContent({
	entities,
	onSelect,
	onCancel,
}) {
	const [query, setQuery] = useState("");

	const normalizedQuery = query.trim().toLowerCase();
	const filteredEntities = entities.filter((entity) => {
		if (!normalizedQuery) return true;
		const name = (entity.name || "").toLowerCase();
		const firstName = (entity.firstName || "").toLowerCase();
		const lastName = (entity.lastName || "").toLowerCase();
		const fullName = `${firstName} ${lastName}`.trim();
		return (
			name.includes(normalizedQuery) ||
			firstName.includes(normalizedQuery) ||
			lastName.includes(normalizedQuery) ||
			fullName.includes(normalizedQuery)
		);
	});
	const groups = [
		{
			key: "characters",
			title: lang.t("Characters"),
			items: filteredEntities.filter((entity) => entity.type === "characters"),
		},
		{
			key: "npc",
			title: lang.t("NPCs"),
			items: filteredEntities.filter((entity) => entity.type === "npc"),
		},
		{
			key: "locations",
			title: lang.t("Locations/Factions"),
			items: filteredEntities.filter((entity) => entity.type === "locations"),
		},
	];

	return (
		<div className="MentionPicker">
			<Input
				value={query}
				onChange={(e) => setQuery(e.target.value)}
				placeholder={lang.t("Search NPC, character, or location...")}
				autoFocus
			/>

			<div className="MentionPicker__columns">
				{groups.map((group) => (
					<section key={group.key} className="MentionPicker__column">
						<h4 className="MentionPicker__column_title">{group.title}</h4>
						<div className="MentionPicker__list">
							{group.items.length > 0 ? (
								group.items.map((entity) => (
									<button
										key={`${entity.type}-${entity.id}-${entity.name}`}
										type="button"
										className="MentionPicker__item"
										onClick={() => onSelect(entity.name)}
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
