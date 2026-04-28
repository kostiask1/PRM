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
	const draggingIndexRef = useRef(null);

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
		draggingIndexRef.current = index;
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

	const handleDragOver = (e, targetIndex) => {
		e.preventDefault();
		if (!isListDragRef.current) return;
		const sourceIndex = draggingIndexRef.current;
		if (sourceIndex === null || sourceIndex === targetIndex) return;

		const rect = e.currentTarget.getBoundingClientRect();
		const midpoint = rect.top + rect.height / 2;
		const isMovingDown = sourceIndex < targetIndex;
		const isMovingUp = sourceIndex > targetIndex;

		if (isMovingDown && e.clientY < midpoint) return;
		if (isMovingUp && e.clientY > midpoint) return;

		const newList = [...items];
		const draggedItem = newList.splice(sourceIndex, 1)[0];
		newList.splice(targetIndex, 0, draggedItem);

		draggingIndexRef.current = targetIndex;
		setDraggingIndex(targetIndex);
		onReorder(newList);
	};

	const handleDragEnd = () => {
		const wasListDrag = isListDragRef.current;
		isListDragRef.current = false;
		draggingIndexRef.current = null;
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
					onDragEnd={handleDragEnd}
					onDragOver={(e) => handleDragOver(e, index)}
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
