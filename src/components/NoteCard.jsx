import Button from "./Button";
import EditableField from "./EditableField";
import "../assets/components/NoteCard.css";

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
			className={`note-card-simple ${isCollapsed ? "is-collapsed" : ""} ${isDragging ? "note-card-simple--dragging" : ""}`}>
			<div
				className="note-card-simple__header"
				onClick={() => !isLast && onToggleCollapse(note.id)}>
				{!isLast && (
					<Button
						variant="ghost"
						size="small"
						icon="chevron"
						className={`note-card-simple__toggle ${isCollapsed ? "is-rotated" : ""}`}
						onClick={(e) => {
							e.stopPropagation();
							onToggleCollapse(note.id);
						}}
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
						size={14}
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
