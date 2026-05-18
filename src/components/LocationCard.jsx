import { useRef } from "react";

import Button from "./form/Button";
import EditableField from "./form/EditableField";
import DraggableList from "./common/DraggableList.jsx";
import ImageAssetField from "./ImageAssetField";
import NoteCard from "./common/NoteCard.jsx";
import AiContextIgnoreButton from "./common/AiContextIgnoreButton.jsx";
import CollapseToggleButton from "./common/CollapseToggleButton.jsx";
import LocationCardModel from "../models/LocationCardModel.js";
import classNames from "../utils/classNames";
import { lang } from "../services/localization";
import { getNotesForRender, sanitizeNotesForSave } from "../utils/noteUtils";
import { useAppSelector } from "../store/appStore";
import { renderMentionText } from "../renderers/contentRenderer.jsx";
import "../assets/components/LocationCard.css";

export default function LocationCard({
	location,
	isDragging,
	onToggleCollapse,
	onChange,
	onNameBlur,
	onDelete,
	onReorderDrop,
	campaignSlug,
	viewMode = "card",
	showDeleteButton = true,
	showHeader = true,
	headerActions = null,
}) {
	const locationModel = new LocationCardModel(location);
	const editingStartNameRef = useRef(
		String(
			locationModel.displayName || location.name || location.title || "",
		).trim(),
	);
	const simplifiedNotesEnabled = useAppSelector(
		(state) => state.ui.simplifiedNotes,
	);
	const isModalView = viewMode === "modal";
	const hasLocationNotesData = locationModel.notes.some(
		(note) =>
			String(note?.title || "").trim().length > 0 ||
			String(note?.text || "").trim().length > 0,
	);
	const notesForRender = getNotesForRender(locationModel.notes, {
		simplifiedNotes: simplifiedNotesEnabled,
	});
	const hasCardData =
		String(location.name || "").trim().length > 0 ||
		String(location.description || "").trim().length > 0 ||
		String(location.imageUrl || "").trim().length > 0 ||
		hasLocationNotesData;
	const canCollapseCard =
		!isModalView && typeof onToggleCollapse === "function" && hasCardData;
	const isCollapsed = canCollapseCard ? !!location.collapsed : false;
	const isNotesCollapsed = hasLocationNotesData
		? !!location.isNotesCollapsed
		: false;

	const updateField = (field, value) => {
		onChange(location.id, locationModel.withField(field, value));
	};

	const getDisplayName = (entity) =>
		String(entity?.name || entity?.title || "").trim();

	const handleNameBlur = async () => {
		const oldName = editingStartNameRef.current ?? getDisplayName(location);
		const newName = getDisplayName(location);
		const shouldAdvanceBaseline =
			(await onNameBlur?.(location.id, location, oldName, newName)) ?? true;
		if (shouldAdvanceBaseline) {
			editingStartNameRef.current = newName;
		}
	};

	const handleNoteTitleChange = (noteId, title) => {
		updateField("notes", locationModel.withUpdatedNote(noteId, { title }));
	};

	const handleNoteTextChange = (noteId, text) => {
		updateField("notes", locationModel.withUpdatedNote(noteId, { text }));
	};

	const handleNoteDelete = (noteId) => {
		updateField("notes", locationModel.withDeletedNote(noteId));
	};

	const handleNotesReorder = (newNotes) => {
		onChange(
			location.id,
			locationModel.withField("notes", sanitizeNotesForSave(newNotes)),
			{ trackUndo: true },
		);
	};
	const handleNoteAiIgnoredChange = (noteId, ignored) => {
		updateField(
			"notes",
			locationModel.notes.map((note) =>
				note.id === noteId ? { ...note, _aiIgnored: ignored } : note,
			),
		);
	};

	const displayName =
		locationModel.displayName || lang.t("New location/faction");

	return (
		<div
			className={classNames("location_card", {
				is_collapsed: isCollapsed,
				is_dragging: isDragging,
				location_card__modal: isModalView,
			})}
		>
			{showHeader && (
				<div
					className="location_card__header"
					onClick={
						!canCollapseCard ? undefined : () => onToggleCollapse(location.id)
					}
				>
					{canCollapseCard && (
						<CollapseToggleButton
							size={Button.SIZES.SMALL}
							collapsed={isCollapsed}
							onClick={() => onToggleCollapse(location.id)}
						/>
					)}
					{location.imageUrl && isCollapsed && (
						<div className="location_card__mini_image">
							<img src={location.imageUrl} alt="" />
						</div>
					)}
					<div className="location_card__title_group">
						{viewMode !== "modal" && (
							<span className="location_card__name">{displayName}</span>
						)}
						{isCollapsed && locationModel.briefMeta && (
							<span className="location_card__meta_brief">
								{renderMentionText(locationModel.briefMeta)}
							</span>
						)}
					</div>
					{headerActions && (
						<div
							className="location_card__actions"
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
								onDelete(location.id);
							}}
						/>
					)}
				</div>
			)}

			{!isCollapsed && (
				<>
					<div className="location_card__body">
						<div className="location_card__content_side">
							<div className="location_card__info_side">
								<div className="location_card__grid">
									<EditableField
										type="text"
										value={location.name || ""}
										onChange={(e) => updateField("name", e.target.value)}
										onBlur={handleNameBlur}
										placeholder={lang.t("Name")}
									/>
								</div>
							</div>

							<div className="location_card__details">
								<div className="location_card__field">
									<EditableField
										type="textarea"
										value={location.description || ""}
										onChange={(e) => updateField("description", e.target.value)}
										placeholder={lang.t(
											"Briefly describe the location or faction...",
										)}
									/>
								</div>
							</div>
						</div>

						<div className="location_card__image_side">
							<ImageAssetField
								imageUrl={location.imageUrl}
								campaignSlug={campaignSlug}
								target="location"
								showClearButton
								onImageChange={(url) => updateField("imageUrl", url)}
								imageAlt={lang.t("Image")}
								containerClassName="location_card__image_container"
								wrapperClassName={classNames(
									"location_card__image_wrapper",
									"is_editable",
								)}
								deleteButtonClassName="location_card__image_delete"
								previewTitle={displayName || lang.t("Image")}
								previewModalClassName="LocationImageModal"
								previewContentClassName="LocationImageModal__content"
							/>
						</div>
					</div>
					<div className="location_card__notes">
						<div
							className="location_card__notes_header"
							onClick={
								hasLocationNotesData
									? () =>
											updateField(
												"isNotesCollapsed",
												!location.isNotesCollapsed,
											)
									: undefined
							}
						>
							{hasLocationNotesData && (
								<CollapseToggleButton
									size={Button.SIZES.SMALL}
									collapsed={isNotesCollapsed}
									onClick={() =>
										updateField("isNotesCollapsed", !location.isNotesCollapsed)
									}
								/>
							)}
							<label>{lang.t("Notes")}</label>
						</div>
						{!isNotesCollapsed && (
							<DraggableList
								items={notesForRender}
								className="location_card__notes_list"
								onReorder={handleNotesReorder}
								onDrop={onReorderDrop}
								keyExtractor={(note) => note.id}
								isItemDraggable={(note) => !note._isVirtual}
								isolateDragEvents
								isItemControlActive={(note) => Boolean(note._aiIgnored)}
								renderItemControl={(note) =>
									!note._isVirtual && (
										<AiContextIgnoreButton
											ignored={Boolean(note._aiIgnored)}
											onToggle={(ignored) =>
												handleNoteAiIgnoredChange(note.id, ignored)
											}
										/>
									)
								}
								renderItem={(note, isDragging, index) => (
									<NoteCard
										note={note}
										isLast={index === notesForRender.length - 1}
										campaignSlug={campaignSlug}
										onToggleCollapse={(id) => {
											updateField(
												"notes",
												locationModel.toggleNoteCollapse(id),
											);
										}}
										onTitleChange={handleNoteTitleChange}
										onTextChange={handleNoteTextChange}
										onDelete={handleNoteDelete}
									/>
								)}
							/>
						)}
					</div>
				</>
			)}
		</div>
	);
}
