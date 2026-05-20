import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";

import CharacterCard from "../CharacterCard";
import LocationCard from "../LocationCard";
import NoteCard from "../common/NoteCard";
import Button from "../form/Button";
import EditableField from "../form/EditableField";
import Modal from "../common/Modal";
import classNames from "../../utils/classNames";
import { lang } from "../../services/localization";

function snapshotToText(value) {
	if (value === null || value === undefined) return "";
	return JSON.stringify(value, null, 2);
}

function parseSnapshotText(text, allowNull = false) {
	const trimmed = String(text || "").trim();
	if (!trimmed) {
		if (allowNull) return null;
		throw new Error(lang.t("Draft value cannot be empty."));
	}
	return JSON.parse(trimmed);
}

function isObjectSnapshot(value) {
	return value && typeof value === "object" && !Array.isArray(value);
}

function snapshotsEqual(before, after) {
	return JSON.stringify(before ?? null) === JSON.stringify(after ?? null);
}

function formatFieldValue(value) {
	if (value === null || value === undefined || value === "") return "—";
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}
	return JSON.stringify(value, null, 2);
}

function getPreviewFieldKeys(before, after, summary = []) {
	if (!isObjectSnapshot(before) || !isObjectSnapshot(after)) {
		return ["value"];
	}
	const ignoredKeys = new Set(["id", "slug", "source", "createdAt"]);
	const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])]
		.filter((key) => !ignoredKeys.has(key))
		.filter((key) => !snapshotsEqual(before[key], after[key]));
	return keys.length > 0 ? keys : summary;
}

function getFieldValue(snapshot, key) {
	if (key === "value") return snapshot;
	return isObjectSnapshot(snapshot) ? snapshot[key] : undefined;
}

function getPreviewCardType(resource) {
	if (resource?.kind === "entity") {
		if (resource.type === "characters" || resource.type === "npc") {
			return "character";
		}
		if (resource.type === "locations") return "location";
	}
	const id = String(resource?.id || "").toLowerCase();
	if (id.includes(":npcs/") || id.includes(":characters/")) return "character";
	if (id.includes(":locations/")) return "location";
	return null;
}

function getCardEntityType(resource) {
	if (resource?.type === "npc") return "npc";
	if (resource?.type === "characters") return "characters";
	const id = String(resource?.id || "").toLowerCase();
	if (id.includes(":npcs/")) return "npc";
	return "characters";
}

function isNoteSnapshot(value) {
	return (
		isObjectSnapshot(value) &&
		(Object.prototype.hasOwnProperty.call(value, "text") ||
			Object.prototype.hasOwnProperty.call(value, "title")) &&
		!Object.prototype.hasOwnProperty.call(value, "firstName") &&
		!Object.prototype.hasOwnProperty.call(value, "name")
	);
}

function isNoteResource(resource) {
	const id = String(resource?.id || "").toLowerCase();
	return (
		id.includes(":notes/") ||
		id.includes(":note/") ||
		isNoteSnapshot(resource?.before) ||
		isNoteSnapshot(resource?.after)
	);
}

function getNoteDiffKey(note, index) {
	if (isObjectSnapshot(note)) {
		const id = String(note.id || "").trim();
		if (id) return `id:${id}`;
		const signature = `${String(note.title || "").trim()}\n${String(note.text || "").trim()}`;
		if (signature.trim()) return `content:${signature}`;
	}
	return `index:${index}`;
}

export default function AiResponseModal({
	generatedPrompt,
	generatedPromptRef,
	isGeneratedPromptCopied,
	isRestoringResponse,
	markdownComponents,
	onApply,
	onCancel,
	onCopy,
	onSaveDraftChanges,
	onUndo,
	selectedResponseDetails,
	selectedResponseDiffResources,
	selectedResponseEntry,
	selectedResponseHasChanges,
	getDiffResourceState,
	getHistoryChangeSummary,
}) {
	const draftResources = useMemo(
		() =>
			selectedResponseEntry?.applyState === "draft" &&
			Array.isArray(selectedResponseEntry?.changes?.resources)
				? selectedResponseEntry.changes.resources
				: [],
		[selectedResponseEntry],
	);
	const [draftEdits, setDraftEdits] = useState({});
	const [draftError, setDraftError] = useState("");
	const [diffViewMode, setDiffViewMode] = useState("preview");

	useEffect(() => {
		setDraftEdits(
			Object.fromEntries(
				draftResources.map((resource) => [
					resource.id,
					snapshotToText(resource.after),
				]),
			),
		);
		setDraftError("");
	}, [draftResources]);

	useEffect(() => {
		setDiffViewMode("preview");
	}, [selectedResponseEntry?.id]);

	if (!generatedPrompt) return null;

	const isDraft = selectedResponseEntry?.applyState === "draft";
	const noop = () => {};
	const renderNoteCard = (resource, note) => {
		if (!isObjectSnapshot(note)) return null;
		const campaignSlug = resource.campaign || selectedResponseEntry?.path?.campaign;
		const normalizedNote = {
			id: note.id || "preview-note",
			title: note.title || "",
			text: note.text || "",
			collapsed: Boolean(note.collapsed),
		};
		return (
			<NoteCard
				note={normalizedNote}
				isLast={false}
				campaignSlug={campaignSlug}
				onToggleCollapse={noop}
				onTitleChange={noop}
				onTextChange={noop}
				onDelete={noop}
			/>
		);
	};

	const renderEntityCard = (resource, snapshot) => {
		const cardType = getPreviewCardType(resource);
		if (!cardType || !isObjectSnapshot(snapshot)) return null;
		const campaignSlug = resource.campaign || selectedResponseEntry?.path?.campaign;
		if (cardType === "location") {
			return (
				<LocationCard
					location={snapshot}
					campaignSlug={campaignSlug}
					onChange={noop}
					onNameBlur={noop}
					onDelete={noop}
					onReorderDrop={noop}
					showDeleteButton={false}
				/>
			);
		}
		return (
			<CharacterCard
				character={snapshot}
				campaignSlug={campaignSlug}
				type={getCardEntityType(resource)}
				onChange={noop}
				onNameBlur={noop}
				onDelete={noop}
				onReorderDrop={noop}
				showDeleteButton={false}
			/>
		);
	};

	const renderNoteCardDiff = (resource) => {
		const isNew = resource.before === null;
		const isDeleted = resource.after === null;
		return (
			<div
				key={resource.id}
				className={classNames(
					"AiAssistant__preview_resource",
					"AiAssistant__preview_resource_notes",
					isNew && "is_added",
					isDeleted && "is_removed",
				)}
			>
				<div className="AiAssistant__preview_resource_header">
					<span>{resource.label}</span>
					<span>{getDiffResourceState(resource)}</span>
				</div>
				{isNew || isDeleted ? (
					<div className="AiAssistant__preview_card_stack">
						<div className="AiAssistant__preview_card_frame">
							<div className="AiAssistant__preview_column_title">
								{isNew ? lang.t("New") : lang.t("Deleted")}
							</div>
							<div className="AiAssistant__preview_note_surface">
								{renderNoteCard(resource, isNew ? resource.after : resource.before)}
							</div>
						</div>
					</div>
				) : (
					<div className="AiAssistant__preview_card_columns">
						<div className="AiAssistant__preview_card_frame">
							<div className="AiAssistant__preview_column_title">
								{lang.t("Before")}
							</div>
							<div className="AiAssistant__preview_note_surface is_removed">
								{renderNoteCard(resource, resource.before)}
							</div>
						</div>
						<div className="AiAssistant__preview_card_frame">
							<div className="AiAssistant__preview_column_title">
								{lang.t("After")}
							</div>
							<div className="AiAssistant__preview_note_surface is_added">
								{renderNoteCard(resource, resource.after)}
							</div>
						</div>
					</div>
				)}
			</div>
		);
	};

	const renderNoteArrayDiff = (resource, beforeNotes, afterNotes) => {
		const beforeList = Array.isArray(beforeNotes) ? beforeNotes : [];
		const afterList = Array.isArray(afterNotes) ? afterNotes : [];
		const beforeByKey = new Map(
			beforeList.map((note, index) => [getNoteDiffKey(note, index), note]),
		);
		const afterByKey = new Map(
			afterList.map((note, index) => [getNoteDiffKey(note, index), note]),
		);
		const keys = [...new Set([...beforeByKey.keys(), ...afterByKey.keys()])].filter(
			(key) => !snapshotsEqual(beforeByKey.get(key), afterByKey.get(key)),
		);
		return (
			<div className="AiAssistant__preview_note_list">
				{keys.map((key, index) => {
					const before = beforeByKey.get(key) ?? null;
					const after = afterByKey.get(key) ?? null;
					return renderNoteCardDiff({
						...resource,
						id: `${resource.id}:note:${key}`,
						label: `${resource.label} / ${lang.t("Note")} ${index + 1}`,
						before,
						after,
					});
				})}
			</div>
		);
	};

	const renderPreviewResource = (resource) => {
		const isNew = resource.before === null;
		const isDeleted = resource.after === null;
		const cardType = getPreviewCardType(resource);
		const fieldKeys = getPreviewFieldKeys(
			resource.before,
			resource.after,
			resource.fieldSummary,
		);

		if (isNoteResource(resource)) {
			return renderNoteCardDiff(resource);
		}

		if (cardType) {
			return (
				<div
					key={resource.id}
					className={classNames(
						"AiAssistant__preview_resource",
						"AiAssistant__preview_resource_cards",
						isNew && "is_added",
						isDeleted && "is_removed",
					)}
				>
					<div className="AiAssistant__preview_resource_header">
						<span>{resource.label}</span>
						<span>{getDiffResourceState(resource)}</span>
					</div>
					{isNew || isDeleted ? (
						<div className="AiAssistant__preview_card_stack">
							<div className="AiAssistant__preview_card_frame">
								<div className="AiAssistant__preview_column_title">
									{isNew ? lang.t("New") : lang.t("Deleted")}
								</div>
								<div className="AiAssistant__preview_card_surface">
									{renderEntityCard(resource, isNew ? resource.after : resource.before)}
								</div>
							</div>
						</div>
					) : (
						<div className="AiAssistant__preview_card_columns">
							<div className="AiAssistant__preview_card_frame">
								<div className="AiAssistant__preview_column_title">
									{lang.t("Before")}
								</div>
								<div className="AiAssistant__preview_card_surface is_removed">
									{renderEntityCard(resource, resource.before)}
								</div>
							</div>
							<div className="AiAssistant__preview_card_frame">
								<div className="AiAssistant__preview_column_title">
									{lang.t("After")}
								</div>
								<div className="AiAssistant__preview_card_surface is_added">
									{renderEntityCard(resource, resource.after)}
								</div>
							</div>
						</div>
					)}
				</div>
			);
		}

		if (isNew || isDeleted) {
			const snapshot = isNew ? resource.after : resource.before;
			const keys = isObjectSnapshot(snapshot)
				? Object.keys(snapshot).filter(
						(key) =>
							!["id", "slug", "source", "createdAt"].includes(
								key,
							),
					)
				: ["value"];
			return (
				<div
					key={resource.id}
					className={classNames(
						"AiAssistant__preview_resource",
						isNew ? "is_added" : "is_removed",
					)}
				>
					<div className="AiAssistant__preview_resource_header">
						<span>{resource.label}</span>
						<span>{getDiffResourceState(resource)}</span>
					</div>
					<div className="AiAssistant__preview_stack">
						{keys.map((key) => (
							<div key={`${resource.id}-${key}`} className="AiAssistant__preview_field">
								<div className="AiAssistant__preview_field_label">{key}</div>
								<pre>{formatFieldValue(getFieldValue(snapshot, key))}</pre>
							</div>
						))}
					</div>
				</div>
			);
		}

		return (
			<div key={resource.id} className="AiAssistant__preview_resource">
				<div className="AiAssistant__preview_resource_header">
					<span>{resource.label}</span>
					<span>{getDiffResourceState(resource)}</span>
				</div>
				{fieldKeys.map((key) => (
					<div key={`${resource.id}-${key}`} className="AiAssistant__preview_field">
						<div className="AiAssistant__preview_field_label">{key}</div>
						{key === "notes" &&
						(Array.isArray(getFieldValue(resource.before, key)) ||
							Array.isArray(getFieldValue(resource.after, key))) ? (
							renderNoteArrayDiff(
								resource,
								getFieldValue(resource.before, key),
								getFieldValue(resource.after, key),
							)
						) : (
							<div className="AiAssistant__preview_columns">
								<div className="AiAssistant__preview_column">
									<div className="AiAssistant__preview_column_title">
										{lang.t("Before")}
									</div>
									<pre className="is_removed">
										{formatFieldValue(getFieldValue(resource.before, key))}
									</pre>
								</div>
								<div className="AiAssistant__preview_column">
									<div className="AiAssistant__preview_column_title">
										{lang.t("After")}
									</div>
									<pre className="is_added">
										{formatFieldValue(getFieldValue(resource.after, key))}
									</pre>
								</div>
							</div>
						)}
					</div>
				))}
			</div>
		);
	};

	const renderJsonDiff = () =>
		selectedResponseDiffResources.map((resource) => (
			<div key={resource.id} className="AiAssistant__diff_file">
				<div className="AiAssistant__diff_file_header">
					<span>{resource.label}</span>
					<span>{getDiffResourceState(resource)}</span>
				</div>
				{resource.fieldSummary.length > 0 && (
					<div className="AiAssistant__diff_field_summary">
						<span>{lang.t("Changed fields")}:</span>
						{resource.fieldSummary.map((field) => (
							<code key={`${resource.id}-${field}`}>{field}</code>
						))}
					</div>
				)}
				<div className="AiAssistant__diff_lines">
					{resource.lines.map((line, index) => (
						<div
							key={`${resource.id}-${index}`}
							className={classNames(
								"AiAssistant__diff_line",
								`is_${line.type}`,
							)}
						>
							<span className="AiAssistant__diff_line_number">
								{line.oldNumber || ""}
							</span>
							<span className="AiAssistant__diff_line_number">
								{line.newNumber || ""}
							</span>
							<span className="AiAssistant__diff_line_marker">
								{line.type === "added"
									? "+"
									: line.type === "removed"
										? "-"
										: " "}
							</span>
							<code>{line.text || " "}</code>
						</div>
					))}
				</div>
			</div>
		));

	const handleApply = async () => {
		if (!isDraft || draftResources.length === 0 || !onSaveDraftChanges) {
			onApply(selectedResponseEntry);
			return;
		}
		try {
			const resources = draftResources.map((resource) => ({
				id: resource.id,
				after: parseSnapshotText(
					draftEdits[resource.id],
					resource.after === null,
				),
			}));
			setDraftError("");
			const updatedEntry = await onSaveDraftChanges(resources);
			onApply(updatedEntry || selectedResponseEntry);
		} catch (error) {
			setDraftError(error.message || lang.t("Invalid draft changes"));
		}
	};

	return (
		<Modal
			title={lang.t("Response")}
			onCancel={onCancel}
			showFooter={false}
			overlayClassName={classNames(
				"AiAssistant__response_overlay",
				selectedResponseHasChanges && "AiAssistant__response_overlay_wide",
			)}
		>
			<div className="AiAssistant__prompt_result_wrap">
				<div className="AiAssistant__prompt_result_actions">
					{selectedResponseHasChanges && (
						<>
							{!isDraft && (
								<Button
									variant="ghost"
									size={Button.SIZES.SMALL}
									icon="undo"
									onClick={onUndo}
									disabled={isRestoringResponse}
									title={lang.t("Undo AI changes")}
								>
									{lang.t("Undo")}
								</Button>
							)}
							<Button
								variant="primary"
								size={Button.SIZES.SMALL}
								icon="check"
								onClick={handleApply}
								disabled={isRestoringResponse}
								title={lang.t("Apply AI changes")}
							>
								{lang.t("Apply")}
							</Button>
						</>
					)}
					{!selectedResponseHasChanges && (
						<Button
							variant="ghost"
							size={Button.SIZES.SMALL}
							icon={isGeneratedPromptCopied ? "check" : "copy"}
							onClick={onCopy}
							title={lang.t("Copy formatted text for Word")}
						/>
					)}
				</div>
				{!selectedResponseHasChanges && (
					<div className="AiAssistant__prompt_result" ref={generatedPromptRef}>
						<ReactMarkdown components={markdownComponents}>
							{generatedPrompt}
						</ReactMarkdown>
					</div>
				)}
				{selectedResponseDetails.length > 0 && (
					<div className="AiAssistant__response_details">
						<div className="AiAssistant__response_details_title">
							{lang.t("Request details")}
						</div>
						{selectedResponseDetails.map((row) => (
							<div
								key={row.label}
								className="AiAssistant__response_details_row"
							>
								<span className="AiAssistant__response_details_label">
									{row.label}
								</span>
								<span className="AiAssistant__response_details_value">
									{row.value}
								</span>
							</div>
						))}
					</div>
				)}
				{selectedResponseHasChanges && (
					<div className="AiAssistant__diff">
						<div className="AiAssistant__diff_title">
							<span>{lang.t("Changes")}</span>
							<span>{getHistoryChangeSummary(selectedResponseEntry)}</span>
						</div>
						<div className="AiAssistant__diff_view_switch">
							<Button
								variant={diffViewMode === "preview" ? "primary" : "ghost"}
								size={Button.SIZES.SMALL}
								onClick={() => setDiffViewMode("preview")}
							>
								{lang.t("Preview")}
							</Button>
							<Button
								variant={diffViewMode === "json" ? "primary" : "ghost"}
								size={Button.SIZES.SMALL}
								onClick={() => setDiffViewMode("json")}
							>
								JSON
							</Button>
						</div>
						{diffViewMode === "preview" ? (
							<div className="AiAssistant__preview_diff">
								{selectedResponseDiffResources.map(renderPreviewResource)}
							</div>
						) : (
							renderJsonDiff()
						)}
						{isDraft && draftResources.length > 0 && (
							<div className="AiAssistant__draft_editor">
								<div className="AiAssistant__draft_editor_title">
									{lang.t("Draft values before applying")}
								</div>
								{draftError && (
									<div className="AiAssistant__draft_error">
										{draftError}
									</div>
								)}
								{draftResources.map((resource) => {
									const isNew = resource.before === null;
									return (
										<div
											key={resource.id}
											className={classNames(
												"AiAssistant__draft_resource",
												isNew && "is_new",
											)}
										>
											<div className="AiAssistant__draft_resource_header">
												<span>{resource.label}</span>
												<span>{getDiffResourceState(resource)}</span>
											</div>
											<div className="AiAssistant__draft_columns">
												{!isNew && (
													<div className="AiAssistant__draft_column">
														<div className="AiAssistant__draft_column_title">
															{lang.t("Before")}
														</div>
														<pre>{snapshotToText(resource.before)}</pre>
													</div>
												)}
												<div className="AiAssistant__draft_column">
													<div className="AiAssistant__draft_column_title">
														{isNew ? lang.t("New") : lang.t("After")}
													</div>
													<EditableField
														type="textarea"
														className="AiAssistant__draft_textarea"
														value={draftEdits[resource.id] || ""}
														onChange={(event) =>
															setDraftEdits((current) => ({
																...current,
																[resource.id]: event.target.value,
															}))
														}
													/>
												</div>
											</div>
										</div>
									);
								})}
							</div>
						)}
					</div>
				)}
			</div>
		</Modal>
	);
}
