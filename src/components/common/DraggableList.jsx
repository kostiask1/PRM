import { useEffect, useLayoutEffect, useRef, useState } from "react";
import "../../assets/components/DraggableList.css";
import classNames from "../../utils/classNames";
import Icon from "./Icon.jsx";

const DRAG_START_THRESHOLD = 5;
const PRESSING_BODY_CLASS = "prm_draggable_list_pressing";
const DRAGGING_BODY_CLASS = "prm_draggable_list_dragging";
let nextListId = 1;

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
	isItemDraggable,
	isolateDragEvents = false,
	renderItemControl,
	isItemControlActive,
}) {
	const [draggingIndex, setDraggingIndex] = useState(null);
	const [dragPreview, setDragPreview] = useState(null);
	const [previewItems, setPreviewItems] = useState(null);
	const listIdRef = useRef(`DraggableList-${nextListId++}`);
	const listRef = useRef(null);
	const itemsRef = useRef(items);
	const pendingPointerRef = useRef(null);
	const dragStateRef = useRef(null);
	const scrollSnapshotRef = useRef(null);
	const removePointerListenersRef = useRef(null);
	const suppressClickRef = useRef(false);
	const dragPreviewRef = useRef(null);
	const dragPreviewFrameRef = useRef(null);
	const dragPreviewPositionRef = useRef(null);
	const displayItems = previewItems || items;
	const draggableItemsCount = displayItems.filter((item, index) =>
		isItemAllowedToDrag(item, index),
	).length;

	useLayoutEffect(() => {
		itemsRef.current = items;
	});

	useLayoutEffect(() => {
		if (!scrollSnapshotRef.current) return;
		restoreScrollSnapshot(scrollSnapshotRef.current);
		scrollSnapshotRef.current = null;
	});

	useLayoutEffect(() => {
		if (dragPreview) flushDragPreviewPosition();
	}, [dragPreview]);

	useEffect(() => {
		const ownerDocument = listRef.current?.ownerDocument || document;
		return () => {
			removePointerListenersRef.current?.();
			if (dragPreviewFrameRef.current) {
				cancelAnimationFrame(dragPreviewFrameRef.current);
				dragPreviewFrameRef.current = null;
			}
			setDocumentPressMode(ownerDocument, false);
			setDocumentDragMode(ownerDocument, false);
		};
	}, []);

	const flushDragPreviewPosition = () => {
		dragPreviewFrameRef.current = null;
		const node = dragPreviewRef.current;
		const position = dragPreviewPositionRef.current;
		if (!node || !position) return;
		node.style.transform = `translate3d(${position.left}px, ${position.top}px, 0)`;
	};

	const scheduleDragPreviewPosition = (left, top) => {
		dragPreviewPositionRef.current = { left, top };
		if (dragPreviewFrameRef.current) return;
		const ownerWindow = listRef.current?.ownerDocument?.defaultView || window;
		dragPreviewFrameRef.current = ownerWindow.requestAnimationFrame(
			flushDragPreviewPosition,
		);
	};

	const setDocumentPressMode = (ownerDocument, enabled) => {
		ownerDocument.body?.classList.toggle(PRESSING_BODY_CLASS, enabled);
	};

	const setDocumentDragMode = (ownerDocument, enabled) => {
		ownerDocument.body?.classList.toggle(DRAGGING_BODY_CLASS, enabled);
		ownerDocument.defaultView?.dispatchEvent(
			new CustomEvent("prm-draggable-list-drag-mode", {
				detail: { enabled },
			}),
		);
	};

	const getDocumentScrollElement = (ownerDocument) =>
		ownerDocument.scrollingElement || ownerDocument.documentElement;

	const getScrollableAncestors = (root) => {
		if (!root) return [];
		const ownerDocument = root.ownerDocument || document;
		const ownerWindow = ownerDocument.defaultView || window;
		const scrollables = [];

		for (let element = root; element; element = element.parentElement) {
			const style = ownerWindow.getComputedStyle(element);
			const canScrollY =
				/(auto|scroll|overlay)/.test(style.overflowY) &&
				element.scrollHeight > element.clientHeight;
			const canScrollX =
				/(auto|scroll|overlay)/.test(style.overflowX) &&
				element.scrollWidth > element.clientWidth;

			if (canScrollY || canScrollX) scrollables.push(element);
		}

		scrollables.push(getDocumentScrollElement(ownerDocument));
		return scrollables;
	};

	const captureScrollSnapshot = () => {
		const root = listRef.current;
		if (!root) return [];

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

		getScrollableAncestors(root.parentElement).forEach(addTarget);
		return targets;
	};

	const restoreScrollSnapshot = (snapshot) => {
		for (const item of snapshot) {
			if (!item.target.isConnected) continue;
			item.target.scrollLeft = item.scrollLeft;
			item.target.scrollTop = item.scrollTop;
		}
	};

	const isNoListDragTarget = (event) => {
		const target = event.target;
		if (!(target instanceof Element)) return false;
		if (!target.closest("[data-list-drag-handle='true']")) return true;
		if (target.isContentEditable) return true;
		return Boolean(
			target.closest(
				[
					"input",
					"textarea",
					"select",
					"button",
					"img",
					"[contenteditable='true']",
					"[contenteditable='plaintext-only']",
					"[data-no-list-drag='true']",
					".MarkdownView",
				].join(", "),
			),
		);
	};

	function isItemAllowedToDrag(item, index) {
		return (
			typeof isItemDraggable !== "function" || isItemDraggable(item, index)
		);
	}

	const canDragItem = (item, index) =>
		draggableItemsCount > 1 && isItemAllowedToDrag(item, index);

	const getListItemFromPoint = (clientX, clientY) => {
		const root = listRef.current;
		const ownerDocument = root?.ownerDocument || document;
		const elements = ownerDocument.elementsFromPoint(clientX, clientY);

		for (const element of elements) {
			let current = element instanceof Element ? element : null;
			while (current && current !== root) {
				if (
					current.parentElement === root &&
					current.dataset.draggableListItem === "true"
				) {
					return current;
				}
				current = current.parentElement;
			}
		}

		return null;
	};

	const dispatchCustomDragDrop = (event, payload) => {
		if (!payload) return;
		const ownerWindow = listRef.current?.ownerDocument?.defaultView || window;
		ownerWindow.dispatchEvent(
			new CustomEvent("prm-draggable-list-drop", {
				detail: {
					payload,
					clientX: event.clientX,
					clientY: event.clientY,
					sourceListId: listIdRef.current,
				},
			}),
		);
	};

	const haveSameItemOrder = (left = [], right = []) => {
		if (left.length !== right.length) return false;
		return left.every(
			(item, index) => keyExtractor(item) === keyExtractor(right[index]),
		);
	};

	const startPointerDrag = (event) => {
		const pending = pendingPointerRef.current;
		if (!pending || dragStateRef.current) return;

		const currentItems = [...itemsRef.current];
		const payload =
			typeof dragData === "function"
				? dragData(currentItems[pending.index], pending.index)
				: null;
		const draggedElement = pending.element?.isConnected
			? pending.element
			: getListItemFromPoint(event.clientX, event.clientY);
		const draggedRect = draggedElement?.getBoundingClientRect();

		if (!draggedRect) return;

		dragStateRef.current = {
			currentIndex: pending.index,
			items: currentItems,
			originalItems: currentItems,
			blockedTargetKey: null,
			hasReordered: false,
			previewOffsetX: event.clientX - draggedRect.left,
			previewOffsetY: event.clientY - draggedRect.top,
			payload,
		};
		setDocumentDragMode(listRef.current?.ownerDocument || document, true);
		setDraggingIndex(pending.index);
		setDragPreview({
			item: currentItems[pending.index],
			index: pending.index,
			width: draggedRect.width,
			height: draggedRect.height,
		});
		scheduleDragPreviewPosition(draggedRect.left, draggedRect.top);
		updatePointerDrag(event);
	};

	const updatePointerDrag = (event) => {
		const dragState = dragStateRef.current;
		if (!dragState) return;
		scheduleDragPreviewPosition(
			event.clientX - dragState.previewOffsetX,
			event.clientY - dragState.previewOffsetY,
		);

		const sourceIndex = dragState.currentIndex;
		const targetElement = getListItemFromPoint(event.clientX, event.clientY);
		if (!targetElement) {
			dragState.blockedTargetKey = null;
			return;
		}

		const targetIndex = Number(targetElement.dataset.draggableListItemIndex);
		const targetItem = dragState.items[targetIndex];
		const targetKey = targetItem == null ? null : keyExtractor(targetItem);
		if (
			!Number.isInteger(targetIndex) ||
			targetElement.dataset.draggableListItemDraggable !== "true" ||
			sourceIndex === null ||
			sourceIndex === targetIndex
		) {
			if (sourceIndex === targetIndex) dragState.blockedTargetKey = null;
			return;
		}
		if (targetKey != null && targetKey === dragState.blockedTargetKey) {
			return;
		}

		const newList = [...dragState.items];
		const draggedItem = newList.splice(sourceIndex, 1)[0];
		newList.splice(targetIndex, 0, draggedItem);

		scrollSnapshotRef.current = captureScrollSnapshot();
		dragState.items = newList;
		dragState.currentIndex = targetIndex;
		dragState.blockedTargetKey = targetKey;
		dragState.hasReordered = true;
		setDraggingIndex(targetIndex);
		setPreviewItems(newList);
	};

	const finishPointerDrag = (event) => {
		removePointerListenersRef.current?.();
		removePointerListenersRef.current = null;
		pendingPointerRef.current = null;

		const dragState = dragStateRef.current;
		dragStateRef.current = null;
		const finalItems = dragState?.items || null;
		const hasReordered =
			!!dragState?.hasReordered &&
			!haveSameItemOrder(dragState.originalItems, finalItems);
		setDocumentPressMode(listRef.current?.ownerDocument || document, false);
		setDocumentDragMode(listRef.current?.ownerDocument || document, false);
		setDraggingIndex(null);
		setDragPreview(null);
		setPreviewItems(null);
		dragPreviewPositionRef.current = null;
		if (dragPreviewFrameRef.current) {
			cancelAnimationFrame(dragPreviewFrameRef.current);
			dragPreviewFrameRef.current = null;
		}

		if (!dragState) return;

		suppressClickRef.current = true;
		window.setTimeout(() => {
			suppressClickRef.current = false;
		}, 0);

		if (hasReordered && finalItems && typeof onReorder === "function") {
			onReorder(finalItems);
		}
		dispatchCustomDragDrop(event, dragState.payload);
		if (hasReordered && onDrop) onDrop(finalItems || itemsRef.current);
	};

	const handlePointerDown = (event, index) => {
		if (isolateDragEvents) event.stopPropagation();
		if (
			event.button !== 0 ||
			!canDragItem(itemsRef.current[index], index) ||
			isNoListDragTarget(event)
		) {
			return;
		}

		const ownerDocument = listRef.current?.ownerDocument || document;
		const ownerWindow = ownerDocument.defaultView || window;
		event.preventDefault();
		setDocumentPressMode(ownerDocument, true);
		pendingPointerRef.current = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			index,
			element: event.currentTarget,
		};

		const handlePointerMove = (moveEvent) => {
			const pending = pendingPointerRef.current;
			if (!pending || moveEvent.pointerId !== pending.pointerId) return;

			const distance = Math.hypot(
				moveEvent.clientX - pending.startX,
				moveEvent.clientY - pending.startY,
			);
			if (!dragStateRef.current && distance < DRAG_START_THRESHOLD) return;

			moveEvent.preventDefault();
			startPointerDrag(moveEvent);
			updatePointerDrag(moveEvent);
		};

		const handlePointerUp = (upEvent) => {
			const pending = pendingPointerRef.current;
			if (!pending || upEvent.pointerId !== pending.pointerId) return;
			finishPointerDrag(upEvent);
		};

		const handlePointerCancel = (cancelEvent) => {
			const pending = pendingPointerRef.current;
			if (!pending || cancelEvent.pointerId !== pending.pointerId) return;
			finishPointerDrag(cancelEvent);
		};

		const handleSelectStart = (selectEvent) => {
			if (!pendingPointerRef.current && !dragStateRef.current) return;
			selectEvent.preventDefault();
		};

		removePointerListenersRef.current?.();
		ownerWindow.addEventListener("pointermove", handlePointerMove, {
			capture: true,
		});
		ownerWindow.addEventListener("pointerup", handlePointerUp, {
			capture: true,
		});
		ownerWindow.addEventListener("pointercancel", handlePointerCancel, {
			capture: true,
		});
		ownerDocument.addEventListener("selectstart", handleSelectStart, {
			capture: true,
		});
		removePointerListenersRef.current = () => {
			setDocumentPressMode(ownerDocument, false);
			ownerWindow.removeEventListener("pointermove", handlePointerMove, {
				capture: true,
			});
			ownerWindow.removeEventListener("pointerup", handlePointerUp, {
				capture: true,
			});
			ownerWindow.removeEventListener("pointercancel", handlePointerCancel, {
				capture: true,
			});
			ownerDocument.removeEventListener("selectstart", handleSelectStart, {
				capture: true,
			});
		};
	};

	const handleClickCapture = (event) => {
		if (!suppressClickRef.current) return;
		event.preventDefault();
		event.stopPropagation();
		suppressClickRef.current = false;
	};

	return (
		<>
			<div
				ref={listRef}
				data-draggable-list-id={listIdRef.current}
				className={classNames("DraggableList", className, {
					"is_list_dragging": draggingIndex !== null,
				})}
				onClickCapture={handleClickCapture}
			>
				{displayItems.map((item, index) => (
					<div
						key={keyExtractor(item)}
						data-draggable-list-item="true"
						data-draggable-list-item-index={index}
						data-draggable-list-item-draggable={canDragItem(item, index)}
						onPointerDown={(event) => handlePointerDown(event, index)}
						className={classNames(itemClassName, {
							"is_dragging": draggingIndex === index,
						})}
					>
						{canDragItem(item, index) && (
							<span
								className="DraggableList__handle"
								data-list-drag-handle="true"
								aria-hidden="true"
							>
								<Icon name="drag-handle" size={18} strokeWidth={2} />
							</span>
						)}
						{renderItemControl && (
							<div
								className={classNames(
									"DraggableList__itemControl",
									isItemControlActive?.(item, index) && "is_active",
								)}
							>
								{renderItemControl(item, index)}
							</div>
						)}
						{renderItem(item, draggingIndex === index, index)}
					</div>
				))}
			</div>
			{dragPreview && (
				<div
					ref={dragPreviewRef}
					className="DraggableList__preview"
					style={{
						width: `${dragPreview.width}px`,
						minHeight: `${dragPreview.height}px`,
					}}
				>
					{renderItem(dragPreview.item, true, dragPreview.index)}
				</div>
			)}
		</>
	);
}
