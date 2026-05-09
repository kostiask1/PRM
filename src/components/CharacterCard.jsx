import { useRef } from "react";
import Button from "./form/Button";
import EditableField from "./form/EditableField";
import NoteCard from "./common/NoteCard.jsx";
import ImageAssetField from "./ImageAssetField";
import "../assets/components/CharacterCard.css";
import Select from "./form/Select";
import CharacterCardModel from "../models/CharacterCardModel.js";
import CollapseToggleButton from "./common/CollapseToggleButton.jsx";
import classNames from "../utils/classNames";
import { lang } from "../services/localization";
import { getNotesForRender } from "../utils/noteUtils";
import { useAppSelector } from "../store/appStore";

export default function CharacterCard({
	character,
	isDragging,
	onToggleCollapse,
	onChange,
	onNameBlur,
	onDelete,
	campaignSlug,
	type = "characters",
	viewMode = "card",
	showDeleteButton = true,
	showHeader = true,
}) {
	const characterModel = new CharacterCardModel(character);
	const editingStartNameRef = useRef(characterModel.fullName);
	const simplifiedNotesEnabled = useAppSelector(
		(state) => state.ui.simplifiedNotes,
	);
	const isModalView = viewMode === "modal";
	const hasCharacterNotesData = characterModel.notes.some(
		(note) =>
			String(note?.title || "").trim().length > 0 ||
			String(note?.text || "").trim().length > 0,
	);
	const notesForRender = getNotesForRender(characterModel.notes, {
		simplifiedNotes: simplifiedNotesEnabled,
	});
	const hasCardData =
		String(character.firstName || "").trim().length > 0 ||
		String(character.lastName || "").trim().length > 0 ||
		String(character.race || "").trim().length > 0 ||
		String(character.class || "").trim().length > 0 ||
		String(character.motivation || "").trim().length > 0 ||
		String(character.trait || "").trim().length > 0 ||
		String(character.imageUrl || "").trim().length > 0 ||
		hasCharacterNotesData;
	const canCollapseCard =
		!isModalView && typeof onToggleCollapse === "function" && hasCardData;
	const isCollapsed = canCollapseCard ? !!character.collapsed : false;
	const isNotesCollapsed = hasCharacterNotesData
		? !!character.isNotesCollapsed
		: false;

	const updateField = (field, value) => {
		onChange(character.id, characterModel.withField(field, value));
	};

	const getDisplayName = (entity) =>
		`${entity?.firstName || ""} ${entity?.lastName || ""}`.trim() ||
		String(entity?.name || entity?.title || "").trim();

	const handleNameBlur = async () => {
		const oldName = editingStartNameRef.current ?? getDisplayName(character);
		const newName = getDisplayName(character);
		const shouldAdvanceBaseline =
			(await onNameBlur?.(character.id, character, oldName, newName)) ?? true;
		if (shouldAdvanceBaseline) {
			editingStartNameRef.current = newName;
		}
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
				"is-collapsed": isCollapsed,
				"is-dragging": isDragging,
				"character-card--modal": isModalView,
			})}
		>
			{showHeader && (
				<div
					className="character-card__header"
					onClick={
						!canCollapseCard ? undefined : () => onToggleCollapse(character.id)
					}
				>
					{canCollapseCard && (
						<CollapseToggleButton
							size={Button.SIZES.SMALL}
							collapsed={isCollapsed}
							onClick={() => onToggleCollapse(character.id)}
						/>
					)}
					{character.imageUrl && isCollapsed && (
						<div className="character-card__mini-portrait">
							<img src={character.imageUrl} alt="" />
						</div>
					)}
					<div className="character-card__title-group">
						{viewMode !== "modal" && (
							<span className="character-card__name">
								{characterModel.displayName} {character.lastName}
							</span>
						)}
						{isCollapsed && (
							<span className="character-card__meta-brief">
								{characterModel.briefMeta}
							</span>
						)}
					</div>
					{showDeleteButton && (
						<Button
							variant="danger"
							icon="trash"
							size={Button.SIZES.SMALL}
							iconSize={14}
							onClick={(e) => {
								e.stopPropagation();
								onDelete(character.id);
							}}
						/>
					)}
				</div>
			)}

			{!isCollapsed && (
				<div className="character-card__body">
					<div className="character-card__main-layout">
						<div className="character-card__content-side">
							<div className="character-card__info-side">
								<div className="character-card__grid">
									<EditableField
										type="text"
										value={character.firstName}
										onChange={(e) => updateField("firstName", e.target.value)}
										onBlur={handleNameBlur}
										placeholder={lang.t("First name")}
									/>
									<EditableField
										type="text"
										value={character.lastName}
										onChange={(e) => updateField("lastName", e.target.value)}
										onBlur={handleNameBlur}
										placeholder={lang.t("Last name")}
									/>
									<div className="character-card__row-trio">
										<EditableField
											type="text"
											value={character.race}
											onChange={(e) => updateField("race", e.target.value)}
											placeholder={lang.t("Race")}
										/>
										<EditableField
											type="text"
											value={character.class}
											onChange={(e) => updateField("class", e.target.value)}
											placeholder={lang.t("Class")}
										/>
										<Select
											value={characterModel.level}
											onChange={(e) => updateField("level", e.target.value)}
										>
											{CharacterCardModel.getLevelOptions().map((level) => (
												<option key={level} value={level}>
													{lang.t("Level {level}", { level })}
												</option>
											))}
										</Select>
									</div>
								</div>
							</div>

							<div className="character-card__details">
								<div className="character-card__field">
									<label>{lang.t("Motivation")}</label>
									<EditableField
										type="textarea"
										value={character.motivation}
										onChange={(e) => updateField("motivation", e.target.value)}
										placeholder={lang.t("What does the character want...")}
									/>
								</div>
								<div className="character-card__field">
									<label>{lang.t("Trait")}</label>
									<EditableField
										type="textarea"
										value={character.trait}
										onChange={(e) => updateField("trait", e.target.value)}
										placeholder={lang.t("Distinctive trait or habit...")}
									/>
								</div>
							</div>
						</div>
						<div className="character-card__image-side">
							<ImageAssetField
								imageUrl={character.imageUrl}
								campaignSlug={campaignSlug}
								target={type === "npc" ? "npc" : "character"}
								showClearButton
								onImageChange={(url) => updateField("imageUrl", url)}
								imageAlt={lang.t("Portrait")}
								containerClassName="character-card__portrait-container"
								wrapperClassName={classNames(
									"character-card__portrait-wrapper",
									"is-editable",
								)}
								deleteButtonClassName="character-card__image-delete"
								previewTitle={characterModel.fullName || lang.t("Portrait")}
								previewModalClassName="CharacterImageModal"
								previewContentClassName="CharacterImageModal__content"
							/>
						</div>
					</div>

					<div className="character-card__notes">
						<div
							className="character-card__notes-header"
							onClick={
								hasCharacterNotesData
									? () =>
											updateField(
												"isNotesCollapsed",
												!character.isNotesCollapsed,
											)
									: undefined
							}
						>
							{hasCharacterNotesData && (
								<CollapseToggleButton
									size={Button.SIZES.SMALL}
									collapsed={isNotesCollapsed}
									onClick={() =>
										updateField("isNotesCollapsed", !character.isNotesCollapsed)
									}
								/>
							)}
							<label>{lang.t("Character notes")}</label>
						</div>
						{!isNotesCollapsed && (
							<div className="character-card__notes-list">
								{notesForRender.map((note, index) => (
									<NoteCard
										key={note.id}
										note={note}
										isLast={index === notesForRender.length - 1}
										campaignSlug={campaignSlug}
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
