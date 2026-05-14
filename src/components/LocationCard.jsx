import { useRef } from "react";

import Button from "./form/Button";
import EditableField from "./form/EditableField";
import DraggableList from "./common/DraggableList.jsx";
import ImageAssetField from "./ImageAssetField";
import NoteCard from "./common/NoteCard.jsx";
import CollapseToggleButton from "./common/CollapseToggleButton.jsx";
import LocationCardModel from "../models/LocationCardModel.js";
import classNames from "../utils/classNames";
import { lang } from "../services/localization";
import { getNotesForRender, sanitizeNotesForSave } from "../utils/noteUtils";
import { useAppSelector } from "../store/appStore";
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
}) {
	const locationModel = new LocationCardModel(location);
	const editingStartNameRef = useRef(
		String(locationModel.displayName || location.name || location.title || "").trim(),
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

	const displayName =
		locationModel.displayName || lang.t("New location/faction");

	return (
		<div
			className={classNames("location-card", {
				"is-collapsed": isCollapsed,
				"is-dragging": isDragging,
				"location-card--modal": isModalView,
			})}
		>
			{showHeader && (
				<div
					className="location-card__header"
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
						<div className="location-card__mini-image">
							<img src={location.imageUrl} alt="" />
						</div>
					)}
					<div className="location-card__title-group">
						{viewMode !== "modal" && (
							<span className="location-card__name">{displayName}</span>
						)}
						{isCollapsed && locationModel.briefMeta && (
							<span className="location-card__meta-brief">
								{locationModel.briefMeta}
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
								onDelete(location.id);
							}}
						/>
					)}
				</div>
			)}

			{!isCollapsed && (
				<div className="location-card__body">
					<div className="location-card__main-layout">
						<div className="location-card__content-side">
							<div className="location-card__info-side">
								<div className="location-card__grid">
									<EditableField
										type="text"
										value={location.name || ""}
										onChange={(e) => updateField("name", e.target.value)}
										onBlur={handleNameBlur}
										placeholder={lang.t("Name")}
									/>
								</div>
							</div>

							<div className="location-card__details">
								<div className="location-card__field">
									<EditableField
										type="textarea"
										value={location.description || ""}
										onChange={(e) =>
											updateField("description", e.target.value)
										}
										placeholder={lang.t(
											"Briefly describe the location or faction...",
										)}
									/>
								</div>
							</div>

							<div className="location-card__notes">
								<div
									className="location-card__notes-header"
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
												updateField(
													"isNotesCollapsed",
													!location.isNotesCollapsed,
												)
											}
										/>
									)}
									<label>{lang.t("Notes")}</label>
								</div>
								{!isNotesCollapsed && (
									<DraggableList
										items={notesForRender}
										className="location-card__notes-list"
										onReorder={handleNotesReorder}
										onDrop={onReorderDrop}
										keyExtractor={(note) => note.id}
										isItemDraggable={(note) => !note._isVirtual}
										isolateDragEvents
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
						</div>

						<div className="location-card__image-side">
							<ImageAssetField
								imageUrl={location.imageUrl}
								campaignSlug={campaignSlug}
								target="location"
								showClearButton
								onImageChange={(url) => updateField("imageUrl", url)}
								imageAlt={lang.t("Image")}
								containerClassName="location-card__image-container"
								wrapperClassName={classNames(
									"location-card__image-wrapper",
									"is-editable",
								)}
								deleteButtonClassName="location-card__image-delete"
								previewTitle={displayName || lang.t("Image")}
								previewModalClassName="LocationImageModal"
								previewContentClassName="LocationImageModal__content"
							/>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
