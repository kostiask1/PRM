import { useState } from "react";
import Button from "./Button";
import EditableField from "./EditableField";
import NoteCard from "./NoteCard";
import Icon from "./Icon";
import ImageDropzone from "./ImageDropzone";
import ImageGallery from "./ImageGallery";
import Modal from "./Modal";
import ReactMarkdown from "react-markdown";
import "../assets/components/CharacterCard.css";
import Select from "./Select";
import CharacterCardModel from "../models/CharacterCardModel.js";

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
	const [isGalleryOpen, setIsGalleryOpen] = useState(false);
	const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
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
			className={`character-card ${character.collapsed ? "is-collapsed" : ""} ${isDragging ? "is-dragging" : ""}`}>
			<div
				className="character-card__header"
				onClick={() => onToggleCollapse(character.id)}>
				<Button
					variant="ghost"
					size="small"
					icon="chevron"
					onClick={() => onToggleCollapse(character.id)}
					className={`character-card__toggle ${character.collapsed ? "is-rotated" : ""}`}
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
							<div className="character-card__portrait-container">
								{character.imageUrl && (
									<div
										className={`character-card__portrait-wrapper ${isEditing ? "is-editable" : ""}`}>
										<img
											src={character.imageUrl}
											alt="Portrait"
											onClick={() => {
												if (isEditing) {
													setIsGalleryOpen(true);
													return;
												}
												setIsImagePreviewOpen(true);
											}}
										/>
										{isEditing && (
											<Button
												variant="danger"
												size="small"
												icon="x"
												onClick={(e) => {
													e.stopPropagation();
													updateField("imageUrl", null);
												}}
												className="character-card__image-delete"
												title="Видалити зображення"
											/>
										)}
									</div>
								)}
								{!character.imageUrl && isEditing && (
									<ImageDropzone
										campaignSlug={campaignSlug}
										onUploadSuccess={(res) => updateField("imageUrl", res.url)}
									/>
								)}
								{!character.imageUrl && !isEditing && (
									<div className="character-card__portrait-placeholder">
										<Icon name="user" size={48} />
									</div>
								)}
							</div>
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
							<Button
								variant="ghost"
								size="small"
								icon="chevron"
								className={`character-card__notes-toggle ${character.isNotesCollapsed ? "is-rotated" : ""}`}
								onClick={(e) => {
									e.stopPropagation();
									updateField("isNotesCollapsed", !character.isNotesCollapsed);
								}}
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

			<ImageGallery
				isOpen={isGalleryOpen}
				onClose={() => setIsGalleryOpen(false)}
				onSelect={(img) => {
					updateField("imageUrl", img.url);
					setIsGalleryOpen(false);
				}}
				initialSource={campaignSlug}
				initialCategory={type === "npc" ? "tokens" : "characters"}
				initialSubcategory={type === "npc" ? "npc" : "players"}
			/>

			{!isEditing && isImagePreviewOpen && character.imageUrl && (
				<Modal
					title={characterModel.fullName || "Portrait"}
					type="custom"
					className="CharacterImageModal"
					onCancel={() => setIsImagePreviewOpen(false)}
					showFooter={false}>
					<div
						className="CharacterImageModal__content"
						onClick={() => setIsImagePreviewOpen(false)}>
						<img src={character.imageUrl} alt="Character portrait preview" />
					</div>
				</Modal>
			)}
		</div>
	);
}
