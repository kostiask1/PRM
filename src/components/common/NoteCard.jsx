import Button from "../form/Button";
import EditableField from "../form/EditableField";
import CollapseToggleButton from "./CollapseToggleButton";
import "../../assets/components/NoteCard.css";
import classNames from "../../utils/classNames";

export default function NoteCard({
	note,
	isLast,
	isDragging,
	onToggleCollapse,
	onTitleChange,
	onTextChange,
	onDelete,
}) {
	// Якщо це остання замітка (слот для нової), вона завжди розгорнута
	const isCollapsed = !isLast && note.collapsed;

	return (
		<div
			className={classNames("note-card-simple", {
				"is-collapsed": isCollapsed,
				"note-card-simple--dragging": isDragging,
			})}>
			<div
				className="note-card-simple__header"
				onClick={() => !isLast && onToggleCollapse(note.id)}>
				{!isLast && (
					<CollapseToggleButton
						size={Button.SIZES.SMALL}
						collapsed={isCollapsed}
						onClick={() => onToggleCollapse(note.id)}
					/>
				)}
				<EditableField
					value={note.title || ""}
					onChange={(e) => onTitleChange(note.id, e.target.value)}
					placeholder="Нова замітка"
					className="note-card-simple__title"
				/>
				{!isLast && (
					<Button
						variant="danger"
						icon="trash"
						size={Button.SIZES.SMALL}
						iconSize={14}
						onClick={(e) => {
							e.stopPropagation();
							onDelete(note.id);
						}}
						title="Видалити замітку"
					/>
				)}
			</div>
			{!isCollapsed && (
				<div className="note-card-simple__content">
					<EditableField
						type="textarea"
						value={note.text}
						onChange={(e) => onTextChange(note.id, e.target.value)}
						placeholder="Текст замітки..."
					/>
				</div>
			)}
		</div>
	);
}
