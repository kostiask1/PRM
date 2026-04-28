import React, { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";

import Button from "./form/Button";
import EditableField from "./form/EditableField";
import ImageAssetField from "./ImageAssetField";
import NoteCard from "./common/NoteCard.jsx";
import CollapseToggleButton from "./common/CollapseToggleButton.jsx";
import LocationCardModel from "../models/LocationCardModel.js";
import classNames from "../utils/classNames";
import { lang } from "../services/localization";
import { renderMentionText } from "../utils/parser.jsx";
import { getNotesForRender } from "../utils/noteUtils";
import "../assets/components/LocationCard.css";

const markdownTagsWithMentions = [
	"p",
	"strong",
	"em",
	"del",
	"code",
	"blockquote",
	"li",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"td",
	"th",
	"a",
	"span",
];

function renderMentionChildren(children) {
	return React.Children.map(children, (child) => {
		if (typeof child === "string") {
			return renderMentionText(child);
		}
		if (React.isValidElement(child) && child.props?.children) {
			return React.cloneElement(child, {
				...child.props,
				children: renderMentionChildren(child.props.children),
			});
		}
		return child;
	});
}

export default function LocationCard({
	location,
	isDragging,
	onToggleCollapse,
	onChange,
	onDelete,
	campaignSlug,
	initialEditing = false,
	viewMode = "card",
	showDeleteButton = true,
	showHeader = true,
}) {
	const [isEditing, setIsEditing] = useState(initialEditing);
	const locationModel = new LocationCardModel(location);
	const isModalView = viewMode === "modal";
	const hasLocationNotesData = locationModel.notes.some(
		(note) =>
			String(note?.title || "").trim().length > 0 ||
			String(note?.text || "").trim().length > 0,
	);
	const notesForRender = getNotesForRender(locationModel.notes);
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
	const mentionComponents = useMemo(
		() =>
			Object.fromEntries(
				markdownTagsWithMentions.map((tag) => [
					tag,
					({ children, ...tagProps }) =>
						React.createElement(tag, tagProps, renderMentionChildren(children)),
				]),
			),
		[],
	);

	const updateField = (field, value) => {
		onChange(location.id, locationModel.withField(field, value));
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
						{viewMode !== "modal" &&<span className="location-card__name">{displayName}</span>}
						{isCollapsed && locationModel.briefMeta && (
							<span className="location-card__meta-brief">
								{locationModel.briefMeta}
							</span>
						)}
					</div>
					{!isCollapsed && (
						<Button
							variant={isEditing ? "primary" : "ghost"}
							icon={isEditing ? "check" : "edit"}
							size={Button.SIZES.SMALL}
							iconSize={14}
							onClick={(e) => {
								e.stopPropagation();
								setIsEditing(!isEditing);
							}}
							title={isEditing ? lang.t("Finish editing") : lang.t("Edit")}
						/>
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
				<div className="location-card__body">
					<div className="location-card__main-layout">
						<div className="location-card__content-side">
							<div className="location-card__info-side">
								{isEditing ? (
									<div className="location-card__grid">
										<EditableField
											type="text"
											value={location.name || ""}
											onChange={(e) => updateField("name", e.target.value)}
											placeholder={lang.t("Name")}
										/>
									</div>
								) : (
									<div className="location-card__view-mode">
										<div className="location-card__main-info">
											<div className="location-card__meta-line">
												<h2>{displayName}</h2>
											</div>
										</div>
									</div>
								)}
							</div>

							<div className="location-card__details">
								<div className="location-card__field">
									<label>{lang.t("Description")}</label>
									{isEditing ? (
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
									) : (
										<div className="location-card__text-content">
											<ReactMarkdown components={mentionComponents}>
												{location.description ||
													`*${lang.t("No description")}*`}
											</ReactMarkdown>
										</div>
									)}
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
									<label>{lang.t("Location/faction notes")}</label>
								</div>
								{!isNotesCollapsed && (
									<div className="location-card__notes-list">
										{notesForRender.map((note, index) => (
											<NoteCard
												key={note.id}
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
										))}
									</div>
								)}
							</div>
						</div>

						<div className="location-card__image-side">
							<ImageAssetField
								imageUrl={location.imageUrl}
								campaignSlug={campaignSlug}
								target="location"
								isEditing={isEditing}
								showClearButton={isEditing}
								onImageChange={(url) => updateField("imageUrl", url)}
								imageAlt={lang.t("Image")}
								containerClassName="location-card__image-container"
								wrapperClassName={classNames(
									"location-card__image-wrapper",
									{
										"is-editable": isEditing,
									},
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
