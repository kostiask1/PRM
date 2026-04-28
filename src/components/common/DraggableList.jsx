import { useRef, useState } from "react";
import "../../assets/components/DraggableList.css";
import classNames from "../../utils/classNames";

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
	dragData,
}) {
	const [draggingIndex, setDraggingIndex] = useState(null);
	const isListDragRef = useRef(false);

	const isNativeMediaDrag = (e) => {
		const target = e.target;
		if (!(target instanceof Element)) return false;
		return Boolean(target.closest("img, [data-no-list-drag='true']"));
	};

	const handleDragStart = (e, index) => {
		if (isNativeMediaDrag(e)) {
			isListDragRef.current = false;
			setDraggingIndex(null);
			return;
		}

		isListDragRef.current = true;
		setDraggingIndex(index);
		e.dataTransfer.effectAllowed = "move";
		if (typeof dragData === "function") {
			const payload = dragData(items[index], index);
			if (payload) {
				const serialized = JSON.stringify(payload);
				e.dataTransfer.setData("application/x-prm-entity-drag", serialized);
				e.dataTransfer.setData("text/plain", serialized);
			}
		}
	};

	const handleDragEnter = (targetIndex) => {
		if (!isListDragRef.current) return;
		if (draggingIndex === null || draggingIndex === targetIndex) return;

		const newList = [...items];
		const draggedItem = newList.splice(draggingIndex, 1)[0];
		newList.splice(targetIndex, 0, draggedItem);

		setDraggingIndex(targetIndex);
		onReorder(newList);
	};

	const handleDragEnd = () => {
		const wasListDrag = isListDragRef.current;
		isListDragRef.current = false;
		setDraggingIndex(null);
		if (wasListDrag && onDrop) onDrop();
	};

	return (
		<div className={classNames("DraggableList", className)}>
			{items.map((item, index) => (
				<div
					key={keyExtractor(item)}
					draggable
					onDragStart={(e) => handleDragStart(e, index)}
					onDragEnter={() => handleDragEnter(index)}
					onDragEnd={handleDragEnd}
					onDragOver={(e) => e.preventDefault()}
					className={classNames(itemClassName, {
						"is-dragging": draggingIndex === index,
					})}
				>
					{renderItem(item, draggingIndex === index, index)}
				</div>
			))}
		</div>
	);
}
