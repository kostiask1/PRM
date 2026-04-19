import Button from "./Button";
import EditableField from "./EditableField";
import NoteCard from "./NoteCard";
import Icon from "./Icon";
import "../assets/components/CharacterCard.css";
import Select from "./Select";

export default function CharacterCard({
	character,
	isDragging,
	onToggleCollapse,
	onChange,
	onDelete,
}) {
	const updateField = (field, value) => {
		onChange(character.id, { ...character, [field]: value });
	};

	const handleNoteUpdate = (noteId, updates) => {
		const newNotes = character.notes.map((n) =>
			n.id === noteId ? { ...n, ...updates } : n,
		);
		updateField("notes", newNotes);
	};

	const handleNoteTitleChange = (noteId, title) => {
		let notes = character.notes || [];
		let newNotes = notes.map((n) => (n.id === noteId ? { ...n, title } : n));

		const lastNote = newNotes[newNotes.length - 1];
		if (lastNote && (lastNote.text?.trim() || lastNote.title?.trim())) {
			newNotes.push({ id: Date.now(), title: "", text: "", collapsed: false });
		}
		updateField("notes", newNotes);
	};

	const handleNoteTextChange = (noteId, text) => {
		let notes = character.notes || [];
		let newNotes = notes.map((n) => (n.id === noteId ? { ...n, text } : n));

		const lastNote = newNotes[newNotes.length - 1];
		if (lastNote && (lastNote.text?.trim() || lastNote.title?.trim())) {
			newNotes.push({ id: Date.now(), title: "", text: "", collapsed: false });
		}
		updateField("notes", newNotes);
	};

	const handleNoteDelete = (noteId) => {
		let newNotes = character.notes.filter((n) => n.id !== noteId);
		if (newNotes.length === 0) {
			newNotes.push({ id: Date.now(), title: "", text: "", collapsed: false });
		}
		updateField("notes", newNotes);
	};

	return (
		<div
			className={`character-card ${character.collapsed ? "is-collapsed" : ""} ${isDragging ? "is-dragging" : ""}`}>
			<div
				className="character-card__header"
				onClick={() => onToggleCollapse(character.id)}>
				<Button
					variant="ghost"
					size="small"
					icon="chevron"
					className={`character-card__toggle ${character.collapsed ? "is-rotated" : ""}`}
				/>
				<div className="character-card__title-group">
					<span className="character-card__name">
						{character.firstName || character.name || "Новий персонаж"}{" "}
						{character.lastName}
					</span>
					{character.collapsed && (
						<span className="character-card__meta-brief">
							{character.race} {character.class}{" "}
							{character.level && `• ${character.level} ур.`}
						</span>
					)}
				</div>
				<Button
					variant="danger"
					icon="trash"
					size={14}
					onClick={(e) => {
						e.stopPropagation();
						onDelete(character.id);
					}}
				/>
			</div>

			{!character.collapsed && (
				<div className="character-card__body">
					<div className="character-card__grid">
						<EditableField
							type="text"
							value={character.firstName}
							onChange={(e) => updateField("firstName", e.target.value)}
							placeholder="Ім'я"
						/>
						<EditableField
							type="text"
							value={character.lastName}
							onChange={(e) => updateField("lastName", e.target.value)}
							placeholder="Прізвище"
						/>
						<EditableField
							type="text"
							value={character.race}
							onChange={(e) => updateField("race", e.target.value)}
							placeholder="Раса"
						/>
						<EditableField
							type="text"
							value={character.class}
							onChange={(e) => updateField("class", e.target.value)}
							placeholder="Клас"
						/>
						<Select
							value={character.level}
							onChange={(e) => updateField("level", e.target.value)}>
							{Array.from(Array(20)).map((_, index) => {
								const level = index + 1;

								return (
									<option key={level} value={level}>
										{level}
									</option>
								);
							})}
						</Select>
					</div>

					<div className="character-card__details">
						<div className="character-card__field">
							<label>Мотивація</label>
							<EditableField
								type="textarea"
								value={character.motivation}
								onChange={(e) => updateField("motivation", e.target.value)}
								placeholder="Чого прагне персонаж..."
							/>
						</div>
						<div className="character-card__field">
							<label>Особливість</label>
							<EditableField
								type="textarea"
								value={character.trait}
								onChange={(e) => updateField("trait", e.target.value)}
								placeholder="Характерна риса або звичка..."
							/>
						</div>
					</div>

					<div className="character-card__notes">
						<label>Замітки персонажа</label>
						<div className="character-card__notes-list">
							{(character.notes || []).map((note, index) => (
								<NoteCard
									key={note.id}
									note={note}
									isLast={index === (character.notes || []).length - 1}
									onToggleCollapse={(id) => {
										const notes = character.notes.map((n) =>
											n.id === id ? { ...n, collapsed: !n.collapsed } : n,
										);
										updateField("notes", notes);
									}}
									onTitleChange={handleNoteTitleChange}
									onTextChange={handleNoteTextChange}
									onDelete={handleNoteDelete}
								/>
							))}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
