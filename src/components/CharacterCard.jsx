import { useState } from "react";
import Button from "./Button";
import EditableField from "./EditableField";
import NoteCard from "./NoteCard";
import ImageAssetField from "./ImageAssetField";
import ReactMarkdown from "react-markdown";
import "../assets/components/CharacterCard.css";
import Select from "./Select";
import CharacterCardModel from "../models/CharacterCardModel.js";
import CollapseToggleButton from "./CollapseToggleButton";
import classNames from "../utils/classNames";

export default function CharacterCard({
	character,
	isDragging,
	onToggleCollapse,
	onChange,
	onDelete,
	campaignSlug,
	initialEditing = false,
	type = "characters",
}) {
	const [isEditing, setIsEditing] = useState(initialEditing);
	const characterModel = new CharacterCardModel(character);

	const updateField = (field, value) => {
		onChange(character.id, characterModel.withField(field, value));
	};

	const handleNoteTitleChange = (noteId, title) => {
		updateField("notes", characterModel.withUpdatedNote(noteId, { title }));
	};

	const handleNoteTextChange = (noteId, text) => {
		updateField("notes", characterModel.withUpdatedNote(noteId, { text }));
	};

	const handleNoteDelete = (noteId) => {
		updateField("notes", characterModel.withDeletedNote(noteId));
	};


	return (
		<div
			className={classNames("character-card", {
				"is-collapsed": character.collapsed,
				"is-dragging": isDragging,
			})}>
			<div
				className="character-card__header"
				onClick={() => onToggleCollapse(character.id)}>
				<CollapseToggleButton
					size="sm"
					collapsed={character.collapsed}
					onClick={() => onToggleCollapse(character.id)}
				/>
				{character.imageUrl && character.collapsed && (
					<div className="character-card__mini-portrait">
						<img src={character.imageUrl} alt="" />
					</div>
				)}
				<div className="character-card__title-group">
					<span className="character-card__name">
						{characterModel.displayName} {character.lastName}
					</span>
					{character.collapsed && (
						<span className="character-card__meta-brief">
							{characterModel.briefMeta}
						</span>
					)}
				</div>
				{!character.collapsed && (
					<Button
						variant={isEditing ? "primary" : "ghost"}
						icon={isEditing ? "check" : "edit"}
						size={14}
						onClick={(e) => {
							e.stopPropagation();
							setIsEditing(!isEditing);
						}}
						title={isEditing ? "Завершити редагування" : "Редагувати"}
					/>
				)}
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
					<div className="character-card__main-layout">
						<div className="character-card__image-side">
							<ImageAssetField
								imageUrl={character.imageUrl}
								campaignSlug={campaignSlug}
								target={type === "npc" ? "npc" : "character"}
								isEditing={isEditing}
								showClearButton={isEditing}
								onImageChange={(url) => updateField("imageUrl", url)}
								imageAlt="Portrait"
								containerClassName="character-card__portrait-container"
								wrapperClassName={classNames("character-card__portrait-wrapper", {
									"is-editable": isEditing,
								})}
								deleteButtonClassName="character-card__image-delete"
								previewTitle={characterModel.fullName || "Portrait"}
								previewModalClassName="CharacterImageModal"
								previewContentClassName="CharacterImageModal__content"
							/>
						</div>

						<div className="character-card__content-side">
							<div className="character-card__info-side">
								{isEditing ? (
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
										<div className="character-card__row-trio">
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
												value={characterModel.level}
												onChange={(e) => updateField("level", e.target.value)}>
												{CharacterCardModel.getLevelOptions().map((level) => (
													<option key={level} value={level}>
														{level} рівень
													</option>
												))}
											</Select>
										</div>
									</div>
								) : (
									<div className="character-card__view-mode">
										<div className="character-card__main-info">
											<div className="character-card__meta-line">
												<h2>{characterModel.fullName}</h2>
											</div>
											<div className="character-card__meta-line">
												<strong>{character.race || "Раса"}</strong> •{" "}
												{character.class || "Клас"} ({characterModel.level}{" "}
												рів.)
											</div>
										</div>
									</div>
								)}
							</div>

							<div className="character-card__details">
								<div className="character-card__field">
									<label>Мотивація</label>
									{isEditing ? (
										<EditableField
											type="textarea"
											value={character.motivation}
											onChange={(e) =>
												updateField("motivation", e.target.value)
											}
											placeholder="Чого прагне персонаж..."
										/>
									) : (
										<div className="character-card__text-content">
											<ReactMarkdown>
												{character.motivation || "*Мотивація не вказана*"}
											</ReactMarkdown>
										</div>
									)}
								</div>
								<div className="character-card__field">
									<label>Особливість</label>
									{isEditing ? (
										<EditableField
											type="textarea"
											value={character.trait}
											onChange={(e) => updateField("trait", e.target.value)}
											placeholder="Характерна риса або звичка..."
										/>
									) : (
										<div className="character-card__text-content">
											<ReactMarkdown>
												{character.trait || "*Особливості не вказані*"}
											</ReactMarkdown>
										</div>
									)}
								</div>
							</div>
						</div>
					</div>

					<div className="character-card__notes">
						<div
							className="character-card__notes-header"
							onClick={() =>
								updateField("isNotesCollapsed", !character.isNotesCollapsed)
							}>
							<CollapseToggleButton
								size="sm"
								collapsed={character.isNotesCollapsed}
								onClick={() =>
									updateField("isNotesCollapsed", !character.isNotesCollapsed)
								}
							/>
							<label>Замітки персонажа</label>
						</div>
						{!character.isNotesCollapsed && (
							<div className="character-card__notes-list">
								{characterModel.notes.map((note, index) => (
									<NoteCard
										key={note.id}
										note={note}
										isLast={index === characterModel.notes.length - 1}
										onToggleCollapse={(id) => {
											updateField(
												"notes",
												characterModel.toggleNoteCollapse(id),
											);
										}}
										onTitleChange={handleNoteTitleChange}
										onTextChange={handleNoteTextChange}
										onDelete={handleNoteDelete}
									/>
								))}
							</div>
						)}
					</div>
				</div>
			)}

		</div>
	);
}
