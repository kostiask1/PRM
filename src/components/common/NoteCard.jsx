import { lang } from "../../services/localization";
import { useAppSelector } from "../../store/appStore";
import classNames from "../../utils/classNames";
import "../../assets/components/NoteCard.css";
import Button from "../form/Button";
import EditableField from "../form/EditableField";
import CollapseToggleButton from "./CollapseToggleButton";
import { renderMentionText } from "../../renderers/contentRenderer";

const SHORT_TEXT_LENGTH = 50;

export default function NoteCard({
	note,
	isLast,
	campaignSlug,
	enableHistory = true,
	onToggleCollapse,
	onTitleChange,
	onTextChange,
	onDelete,
	highlightFields = null,
}) {
	const simplifiedNotesEnabled = useAppSelector(
		(state) => state.ui.simplifiedNotes,
	);
	const noteTitle = String(note.title || "").trim();
	const noteText = String(note.text || "").trim();
	const canCollapse = !isLast && (noteTitle.length > 0 || noteText.length > 0);
	const isCollapsed = canCollapse && note.collapsed;
	const showClassicHeader = !simplifiedNotesEnabled;
	const showSimplifiedActions = simplifiedNotesEnabled && !isLast;
	const shortText = note.text.slice(0, SHORT_TEXT_LENGTH);

	return (
		<div
			className={classNames("note_card_simple", {
				is_collapsed: isCollapsed,
				note_card_simple__simplified: simplifiedNotesEnabled,
			})}
			onClick={() =>
				isCollapsed &&
				simplifiedNotesEnabled &&
				canCollapse &&
				onToggleCollapse(note.id)
			}
		>
			{showClassicHeader && (
				<div
					key="classic-header"
					className="note_card_simple__header"
					onClick={() => canCollapse && onToggleCollapse(note.id)}
				>
					{canCollapse && (
						<CollapseToggleButton
							key="collapse-toggle"
							size={Button.SIZES.SMALL}
							collapsed={isCollapsed}
							onClick={() => onToggleCollapse(note.id)}
						/>
					)}
					<EditableField
						key="title"
						value={note.title || ""}
						enableHistory={enableHistory}
						onChange={(event) => onTitleChange(note.id, event.target.value)}
						placeholder={lang.t("New note")}
						className={classNames(
							"note_card_simple__title",
							highlightFields?.includes?.("title") && "is_ai_changed_field",
						)}
					/>
					{!isLast && (
						<Button
							key="delete"
							variant="danger"
							icon="trash"
							size={Button.SIZES.SMALL}
							iconSize={14}
							onClick={(event) => {
								event.stopPropagation();
								onDelete(note.id);
							}}
							title={lang.t("Delete note")}
						/>
					)}
				</div>
			)}
			{showSimplifiedActions && isCollapsed && (
				<span key="collapsed-preview">
					{renderMentionText(shortText)}
					{note.text.length > SHORT_TEXT_LENGTH && "..."}
				</span>
			)}
			{showSimplifiedActions && (
				<div key="simplified-actions" className="note_card_simple__simpleActions">
					{canCollapse && (
						<CollapseToggleButton
							key="collapse-toggle"
							size={Button.SIZES.SMALL}
							collapsed={isCollapsed}
							onClick={() => onToggleCollapse(note.id)}
							title={
								isCollapsed ? lang.t("Expand note") : lang.t("Collapse note")
							}
							className="note_card_simple__actionBtn"
						/>
					)}
					<Button
						key="delete"
						variant="ghost"
						icon="trash"
						size={Button.SIZES.SMALL}
						iconSize={14}
						onClick={(event) => {
							event.stopPropagation();
							onDelete(note.id);
						}}
						title={lang.t("Delete note")}
						className="note_card_simple__actionBtn note_card_simple__actionBtn__danger"
					/>
				</div>
			)}
			{!isCollapsed && (
				<div key="content" className="note_card_simple__content">
					<EditableField
						type="textarea"
						value={note.text}
						enableHistory={enableHistory}
						onChange={(event) => onTextChange(note.id, event.target.value)}
						placeholder={lang.t("Note text...")}
						campaignSlug={campaignSlug}
						className={
							highlightFields?.includes?.("text") ? "is_ai_changed_field" : ""
						}
					/>
				</div>
			)}
		</div>
	);
}
