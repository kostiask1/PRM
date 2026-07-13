import { useRef } from "react";
import { Button, Select } from "../../../shared/ui/index.js";
import { EditableField } from "../../../features/editor/ui/index.js";
import { DraggableList } from "../../../shared/ui/index.js";
import {
	getAiIgnoredNoteListProps,
	NoteCard,
} from "../../../features/notes/ui/index.js";
import { ImageAssetField } from "../../../features/images/index.js";
import "../../../assets/components/CharacterCard.css";
import { CharacterCardModel } from "../../../entities/campaign/index.js";
import { CollapseToggleButton } from "../../../shared/ui/index.js";
import {
	classNames,
	getNotesForRender,
	sanitizeNotesForSave,
} from "../../../shared/lib/index.js";
import { lang } from "../../../shared/lib/index.js";
import { useAppSelector } from "../../../shared/model/index.js";
import { renderMentionText } from "../../../features/rich-content/index.js";

export default function CharacterCard({
	character,
	onToggleCollapse,
	onChange,
	onNameBlur,
	onDelete,
	onReorderDrop,
	campaignSlug,
	enableHistory = true,
	type = "characters",
	viewMode = "card",
	showDeleteButton = true,
	showHeader = true,
	headerActions = null,
	highlightFields = null,
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
		String(characterModel.description || "").trim().length > 0 ||
		String(characterModel.trait || "").trim().length > 0 ||
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
	const isFieldHighlighted = (field) =>
		highlightFields?.fields?.includes?.(field);
	const getNoteHighlightFields = (note) =>
		highlightFields?.notes?.[String(note?.id)] ||
		highlightFields?.notes?.[String(note?.title || "").trim()] ||
		null;

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

	const handleNotesReorder = (newNotes) => {
		onChange(
			character.id,
			characterModel.withField("notes", sanitizeNotesForSave(newNotes)),
			{ trackUndo: true },
		);
	};
	const handleNoteAiIgnoredChange = (noteId, ignored) => {
		updateField(
			"notes",
			characterModel.notes.map((note) =>
				note.id === noteId ? { ...note, _aiIgnored: ignored } : note,
			),
		);
	};

	return (
		<div
			className={classNames("character_card", {
				is_collapsed: isCollapsed,
				character_card__modal: isModalView,
			})}
			onClick={
				!canCollapseCard
					? undefined
					: () => isCollapsed && onToggleCollapse(character.id)
			}
		>
			{showHeader && (
				<div
					className="character_card__header"
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
						<div className="character_card__mini_portrait">
							<img src={character.imageUrl} alt="" />
						</div>
					)}
					<div className="character_card__title_group">
						{viewMode !== "modal" && (
							<span className="character_card__name">
								{characterModel.displayName} {character.lastName}
							</span>
						)}
						{isCollapsed && (
							<span className="character_card__meta_brief">
								{renderMentionText(characterModel.briefMeta)}
							</span>
						)}
					</div>
					{headerActions && (
						<div
							className="character_card__actions"
							onClick={(event) => event.stopPropagation()}
						>
							{headerActions}
						</div>
					)}
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
				<div className="character_card__body">
					<div className="character_card__image_side">
						<ImageAssetField
							imageUrl={character.imageUrl}
							campaignSlug={campaignSlug}
							target={type === "npc" ? "npc" : "character"}
							showClearButton
							onImageChange={(url) => updateField("imageUrl", url)}
							imageAlt={lang.t("Portrait")}
							containerClassName="character_card__portrait_container"
							wrapperClassName={classNames(
								"character_card__portrait_wrapper",
								"is_editable",
							)}
							deleteButtonClassName="character_card__image_delete"
							previewTitle={characterModel.fullName || lang.t("Portrait")}
							previewModalClassName="CharacterImageModal"
							previewContentClassName="CharacterImageModal__content"
						/>
					</div>
					<div className="character_card__info_side">
						<div className="character_card__grid">
							<EditableField
								type="text"
								value={character.firstName}
								enableHistory={enableHistory}
								onChange={(e) => updateField("firstName", e.target.value)}
								onBlur={handleNameBlur}
								placeholder={lang.t("First name")}
								className={
									isFieldHighlighted("firstName") ? "is_ai_changed_field" : ""
								}
							/>
							<EditableField
								type="text"
								value={character.lastName}
								enableHistory={enableHistory}
								onChange={(e) => updateField("lastName", e.target.value)}
								onBlur={handleNameBlur}
								placeholder={lang.t("Last name")}
								className={
									isFieldHighlighted("lastName") ? "is_ai_changed_field" : ""
								}
							/>
							<div className="character_card__row_trio">
								<EditableField
									type="text"
									value={character.race}
									enableHistory={enableHistory}
									onChange={(e) => updateField("race", e.target.value)}
									placeholder={lang.t("Race")}
									className={
										isFieldHighlighted("race") ? "is_ai_changed_field" : ""
									}
								/>
								<EditableField
									type="text"
									value={character.class}
									enableHistory={enableHistory}
									onChange={(e) => updateField("class", e.target.value)}
									placeholder={lang.t("Class")}
									className={
										isFieldHighlighted("class") ? "is_ai_changed_field" : ""
									}
								/>
								<Select
									value={characterModel.level}
									onChange={(e) => updateField("level", e.target.value)}
								>
									<option value="">--</option>
									{CharacterCardModel.getLevelOptions().map((level) => (
										<option key={level} value={level}>
											{lang.t("Level {level}", { level })}
										</option>
									))}
								</Select>
							</div>
						</div>
					</div>

					<div className="character_card__details">
						<div className="character_card__field">
							<label>{lang.t("Motivation")}</label>
							<EditableField
								type="textarea"
								value={character.motivation}
								enableHistory={enableHistory}
								onChange={(e) => updateField("motivation", e.target.value)}
								placeholder={lang.t("What does the character want...")}
								className={
									isFieldHighlighted("motivation") ? "is_ai_changed_field" : ""
								}
							/>
						</div>
						<div className="character_card__field">
							<label>{lang.t("Trait")}</label>
							<EditableField
								type="textarea"
								value={characterModel.trait}
								enableHistory={enableHistory}
								onChange={(e) => updateField("trait", e.target.value)}
								placeholder={lang.t("Distinctive trait or habit...")}
								className={
									isFieldHighlighted("trait") ? "is_ai_changed_field" : ""
								}
							/>
						</div>
					</div>
					<div className="character_card__field">
						<label>{lang.t("Description")}</label>
						<EditableField
							type="textarea"
							value={characterModel.description}
							enableHistory={enableHistory}
							onChange={(e) => updateField("description", e.target.value)}
							placeholder={lang.t("Character description...")}
							className={
								isFieldHighlighted("description") ? "is_ai_changed_field" : ""
							}
						/>
					</div>

					<div className="character_card__notes">
						<div
							className="character_card__notes_header"
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
							<DraggableList
								items={notesForRender}
								className="character_card__notes_list"
								onReorder={handleNotesReorder}
								onDrop={onReorderDrop}
								{...getAiIgnoredNoteListProps(handleNoteAiIgnoredChange)}
								renderItem={(note, isDragging, index) => (
									<NoteCard
										note={note}
										isLast={index === notesForRender.length - 1}
										campaignSlug={campaignSlug}
										enableHistory={enableHistory}
										onToggleCollapse={(id) => {
											updateField(
												"notes",
												characterModel.toggleNoteCollapse(id),
											);
										}}
										onTitleChange={handleNoteTitleChange}
										onTextChange={handleNoteTextChange}
										onDelete={handleNoteDelete}
										highlightFields={getNoteHighlightFields(note)}
									/>
								)}
							/>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
