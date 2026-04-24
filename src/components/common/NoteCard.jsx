import { lang } from "../../services/localization";
import { useAppSelector } from "../../store/appStore";
import classNames from "../../utils/classNames";
import "../../assets/components/NoteCard.css";
import Button from "../form/Button";
import EditableField from "../form/EditableField";
import CollapseToggleButton from "./CollapseToggleButton";

export default function NoteCard({
	note,
	isLast,
	isDragging,
	onToggleCollapse,
	onTitleChange,
	onTextChange,
	onDelete,
}) {
	const simplifiedNotesEnabled = useAppSelector(
		(state) => state.ui.simplifiedNotes,
	);
	const isCollapsed = !isLast && note.collapsed;
	const showClassicHeader = !simplifiedNotesEnabled;
	const showSimplifiedActions = simplifiedNotesEnabled && !isLast;

	return (
		<div
			className={classNames("note-card-simple", {
				"is-collapsed": isCollapsed,
				"note-card-simple--dragging": isDragging,
				"note-card-simple--simplified": simplifiedNotesEnabled,
			})}
		>
			{showClassicHeader && (
				<div
					className="note-card-simple__header"
					onClick={() => !isLast && onToggleCollapse(note.id)}
				>
					{!isLast && (
						<CollapseToggleButton
							size={Button.SIZES.SMALL}
							collapsed={isCollapsed}
							onClick={() => onToggleCollapse(note.id)}
						/>
					)}
					<EditableField
						value={note.title || ""}
						onChange={(event) => onTitleChange(note.id, event.target.value)}
						placeholder={lang.t("New note")}
						className="note-card-simple__title"
					/>
					{!isLast && (
						<Button
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
			{showSimplifiedActions && (
				<div className="note-card-simple__simpleActions">
					<CollapseToggleButton
						size={Button.SIZES.SMALL}
						collapsed={isCollapsed}
						onClick={() => onToggleCollapse(note.id)}
						title={
							isCollapsed ? lang.t("Expand note") : lang.t("Collapse note")
						}
						className="note-card-simple__actionBtn"
					/>
					<Button
						variant="ghost"
						icon="trash"
						size={Button.SIZES.SMALL}
						iconSize={14}
						onClick={(event) => {
							event.stopPropagation();
							onDelete(note.id);
						}}
						title={lang.t("Delete note")}
						className="note-card-simple__actionBtn note-card-simple__actionBtn--danger"
					/>
				</div>
			)}
			{!isCollapsed && (
				<div className="note-card-simple__content">
					<EditableField
						type="textarea"
						value={note.text}
						onChange={(event) => onTextChange(note.id, event.target.value)}
						placeholder={lang.t("Note text...")}
						plainTextPreview={simplifiedNotesEnabled}
					/>
				</div>
			)}
		</div>
	);
}
