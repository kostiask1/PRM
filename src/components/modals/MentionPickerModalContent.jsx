import { useState } from "react";

import Button from "../form/Button";
import Input from "../form/Input";

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

	return (
		<div className="MentionPicker">
			<Input
				value={query}
				onChange={(e) => setQuery(e.target.value)}
				placeholder="Пошук NPC або персонажа..."
				autoFocus
			/>

			<div className="MentionPicker__list">
				{filteredEntities.length > 0 ? (
					filteredEntities.map((entity) => (
						<button
							key={`${entity.type}-${entity.id}-${entity.name}`}
							type="button"
							className="MentionPicker__item"
							onClick={() => onSelect(entity.name)}
						>
							<span>{entity.name}</span>
							<span className="muted">
								{entity.type === "npc" ? "NPC" : "Персонаж"}
							</span>
						</button>
					))
				) : (
					<p className="muted">Нічого не знайдено.</p>
				)}
			</div>

			<div className="MentionPicker__actions">
				<Button variant="ghost" onClick={onCancel}>
					Скасувати
				</Button>
			</div>
		</div>
	);
}
