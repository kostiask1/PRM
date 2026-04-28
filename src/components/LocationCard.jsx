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
import "../assets/components/CharacterCard.css";
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
			className={classNames("character-card location-card", {
				"is-collapsed": isCollapsed,
				"is-dragging": isDragging,
				"character-card--modal": isModalView,
			})}
		>
			{showHeader && (
				<div
					className="character-card__header"
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
						<div className="character-card__mini-portrait">
							<img src={location.imageUrl} alt="" />
						</div>
					)}
					<div className="character-card__title-group">
						<span className="character-card__name">{displayName}</span>
						{isCollapsed && locationModel.briefMeta && (
							<span className="character-card__meta-brief">
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
				<div className="character-card__body">
					<div className="character-card__main-layout location-card__main-layout">
						<div className="character-card__content-side location-card__content-side">
							<div className="character-card__info-side">
								{isEditing ? (
									<div className="character-card__grid location-card__grid">
										<EditableField
											type="text"
											value={location.name || ""}
											onChange={(e) => updateField("name", e.target.value)}
											placeholder={lang.t("Name")}
										/>
									</div>
								) : (
									<div className="character-card__view-mode">
										<div className="character-card__main-info">
											<div className="character-card__meta-line">
												<h2>{displayName}</h2>
											</div>
										</div>
									</div>
								)}
							</div>

							<div className="character-card__details">
								<div className="character-card__field">
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
										<div className="character-card__text-content">
											<ReactMarkdown components={mentionComponents}>
												{location.description ||
													`*${lang.t("No description")}*`}
											</ReactMarkdown>
										</div>
									)}
								</div>
							</div>

							<div className="character-card__notes">
								<div
									className="character-card__notes-header"
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

						<div className="character-card__image-side location-card__image-side">
							<ImageAssetField
								imageUrl={location.imageUrl}
								campaignSlug={campaignSlug}
								target="location"
								isEditing={isEditing}
								showClearButton={isEditing}
								onImageChange={(url) => updateField("imageUrl", url)}
								imageAlt={lang.t("Image")}
								containerClassName="character-card__portrait-container location-card__image-container"
								wrapperClassName={classNames(
									"character-card__portrait-wrapper",
									"location-card__image-wrapper",
									{
										"is-editable": isEditing,
									},
								)}
								deleteButtonClassName="character-card__image-delete"
								previewTitle={displayName || lang.t("Image")}
								previewModalClassName="CharacterImageModal"
								previewContentClassName="CharacterImageModal__content"
							/>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
