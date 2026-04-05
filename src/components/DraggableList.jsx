import { useState } from "react";
import "../assets/components/DraggableList.css";

/**
 * Універсальний компонент для сортування списків перетягуванням.
 */
export default function DraggableList({
	items = [],
	onReorder,
	onDrop,
	renderItem,
	keyExtractor,
	className = "",
	itemClassName = "",
}) {
	const [draggingIndex, setDraggingIndex] = useState(null);

	const handleDragStart = (e, index) => {
		setDraggingIndex(index);
		e.dataTransfer.effectAllowed = "move";
	};

	const handleDragEnter = (targetIndex) => {
		if (draggingIndex === null || draggingIndex === targetIndex) return;

		const newList = [...items];
		const draggedItem = newList.splice(draggingIndex, 1)[0];
		newList.splice(targetIndex, 0, draggedItem);

		setDraggingIndex(targetIndex);
		onReorder(newList);
	};

	const handleDragEnd = () => {
		setDraggingIndex(null);
		if (onDrop) onDrop();
	};

	return (
		<div className={`DraggableList ${className}`}>
			{items.map((item, index) => (
				<div
					key={keyExtractor(item)}
					draggable
					onDragStart={(e) => handleDragStart(e, index)}
					onDragEnter={() => handleDragEnter(index)}
					onDragEnd={handleDragEnd}
					onDragOver={(e) => e.preventDefault()}
					className={`${itemClassName} ${draggingIndex === index ? "is-dragging" : ""}`}>
					{renderItem(item, draggingIndex === index)}
				</div>
			))}
		</div>
	);
}
