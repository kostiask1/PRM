import React, { useMemo, useState } from "react";
import Button from "./form/Button";
import EditableField from "./form/EditableField";
import NoteCard from "./common/NoteCard.jsx";
import ImageAssetField from "./ImageAssetField";
import ReactMarkdown from "react-markdown";
import EntityLink from "./common/EntityLink.jsx";
import "../assets/components/CharacterCard.css";
import Select from "./form/Select";
import CharacterCardModel from "../models/CharacterCardModel.js";
import CollapseToggleButton from "./common/CollapseToggleButton.jsx";
import classNames from "../utils/classNames";

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

function renderMentionText(text, keyPrefix = "mention", campaignSlug) {
	const parts = String(text || "").split(/(\[[^\]]+\])/g);
	return parts.map((part, index) => {
		if (part.startsWith("[") && part.endsWith("]")) {
			const name = part.slice(1, -1).trim();
			return (
				<EntityLink
					key={`${keyPrefix}-${index}`}
					name={name}
					campaignSlug={campaignSlug}
					className="mention-link"
				>
					{name}
				</EntityLink>
			);
		}
		return part;
	});
}

function renderMentionChildren(
	children,
	keyPrefix = "mention-node",
	campaignSlug,
) {
	return React.Children.map(children, (child, index) => {
		const nextKey = `${keyPrefix}-${index}`;
		if (typeof child === "string") {
			return renderMentionText(child, nextKey, campaignSlug);
		}
		if (React.isValidElement(child) && child.props?.children) {
			return React.cloneElement(child, {
				...child.props,
				children: renderMentionChildren(
					child.props.children,
					nextKey,
					campaignSlug,
				),
			});
		}
		return child;
	});
}

export default function CharacterCard({
	character,
	isDragging,
	onToggleCollapse,
	onChange,
	onDelete,
	campaignSlug,
	initialEditing = false,
	type = "characters",
	viewMode = "card",
	showDeleteButton = true,
	showHeader = true,
}) {
	const [isEditing, setIsEditing] = useState(initialEditing);
	const characterModel = new CharacterCardModel(character);
	const isModalView = viewMode === "modal";
	const isCollapsed = isModalView ? false : !!character.collapsed;
	const mentionComponents = useMemo(
		() =>
			Object.fromEntries(
				markdownTagsWithMentions.map((tag) => [
					tag,
					({ children, ...tagProps }) =>
						React.createElement(
							tag,
							tagProps,
							renderMentionChildren(children, `mention-${tag}`, campaignSlug),
						),
				]),
			),
		[campaignSlug],
	);

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
				"is-collapsed": isCollapsed,
				"is-dragging": isDragging,
				"character-card--modal": isModalView,
			})}
		>
			{showHeader && (
				<div
					className="character-card__header"
					onClick={
						isModalView || typeof onToggleCollapse !== "function"
							? undefined
							: () => onToggleCollapse(character.id)
					}
				>
					{!isModalView && typeof onToggleCollapse === "function" && (
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
						<span className="character-card__name">
							{characterModel.displayName} {character.lastName}
						</span>
						{isCollapsed && (
							<span className="character-card__meta-brief">
								{characterModel.briefMeta}
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
							title={isEditing ? "Завершити редагування" : "Редагувати"}
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
								onDelete(character.id);
							}}
						/>
					)}
				</div>
			)}

			{!isCollapsed && (
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
								wrapperClassName={classNames(
									"character-card__portrait-wrapper",
									{
										"is-editable": isEditing,
									},
								)}
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
												onChange={(e) => updateField("level", e.target.value)}
											>
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
											<ReactMarkdown components={mentionComponents}>
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
											<ReactMarkdown components={mentionComponents}>
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
							}
						>
							<CollapseToggleButton
								size={Button.SIZES.SMALL}
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
