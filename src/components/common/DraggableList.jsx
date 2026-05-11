import { useLayoutEffect, useRef, useState } from "react";
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
	isolateDragEvents = false,
}) {
	const [draggingIndex, setDraggingIndex] = useState(null);
	const listRef = useRef(null);
	const isListDragRef = useRef(false);
	const draggingIndexRef = useRef(null);
	const scrollSnapshotRef = useRef(null);

	useLayoutEffect(() => {
		if (!scrollSnapshotRef.current) return;
		restoreScrollSnapshot(scrollSnapshotRef.current);
		scrollSnapshotRef.current = null;
	});

	const captureScrollSnapshot = () => {
		const root = listRef.current;
		if (!root) return [];

		const ownerDocument = root.ownerDocument || document;
		const targets = [];
		const seen = new Set();
		const addTarget = (target) => {
			if (!target || seen.has(target)) return;
			seen.add(target);
			targets.push({
				target,
				scrollLeft: target.scrollLeft,
				scrollTop: target.scrollTop,
			});
		};

		addTarget(ownerDocument.scrollingElement || ownerDocument.documentElement);

		for (let element = root.parentElement; element; element = element.parentElement) {
			const style = ownerDocument.defaultView.getComputedStyle(element);
			const canScrollY =
				/(auto|scroll|overlay)/.test(style.overflowY) &&
				element.scrollHeight > element.clientHeight;
			const canScrollX =
				/(auto|scroll|overlay)/.test(style.overflowX) &&
				element.scrollWidth > element.clientWidth;

			if (canScrollY || canScrollX) addTarget(element);
		}

		return targets;
	};

	const restoreScrollSnapshot = (snapshot) => {
		for (const item of snapshot) {
			if (!item.target.isConnected) continue;
			item.target.scrollLeft = item.scrollLeft;
			item.target.scrollTop = item.scrollTop;
		}
	};

	const isNativeMediaDrag = (e) => {
		const target = e.target;
		if (!(target instanceof Element)) return false;
		return Boolean(target.closest("img, [data-no-list-drag='true']"));
	};

	const handleDragStart = (e, index) => {
		if (isolateDragEvents) e.stopPropagation();
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
		if (isolateDragEvents) e.stopPropagation();
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

		scrollSnapshotRef.current = captureScrollSnapshot();
		draggingIndexRef.current = targetIndex;
		setDraggingIndex(targetIndex);
		onReorder(newList);
	};

	const handleDragEnd = (e) => {
		if (isolateDragEvents) e.stopPropagation();
		const wasListDrag = isListDragRef.current;
		isListDragRef.current = false;
		draggingIndexRef.current = null;
		setDraggingIndex(null);
		if (wasListDrag && onDrop) onDrop();
	};

	return (
		<div
			ref={listRef}
			className={classNames("DraggableList", className, {
				"is-list-dragging": draggingIndex !== null,
			})}
		>
			{items.map((item, index) => (
				<div
					key={keyExtractor(item)}
					draggable
					onDragStart={(e) => handleDragStart(e, index)}
					onDragEnd={(e) => handleDragEnd(e)}
					onDragOver={(e) => handleDragOver(e, index)}
					onDrop={(e) => {
						if (isolateDragEvents) e.stopPropagation();
					}}
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
