import {
	Fragment,
	type MouseEvent as ReactMouseEvent,
	type PointerEvent as ReactPointerEvent,
	type ReactNode,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import "../../assets/components/DraggableList.css";
import { classNames } from "../lib/index.js";
import {
	getDefaultDraggableItemKey,
	getDraggableReorderResult,
	hasReachedDragStartThreshold,
	type DraggableItemKeyExtractor,
} from "./draggableListModel.ts";
import Icon from "./Icon.tsx";

const PRESSING_BODY_CLASS = "prm_draggable_list_pressing";
const DRAGGING_BODY_CLASS = "prm_draggable_list_dragging";
let nextListId = 1;

interface PendingPointer {
	pointerId: number;
	startX: number;
	startY: number;
	index: number;
	element: HTMLDivElement;
}

interface DragPointerCoordinates {
	clientX: number;
	clientY: number;
}

interface ActiveDrag<Item> {
	sourceIndex: number;
	targetIndex: number;
	originalItems: Item[];
	hasReordered: boolean;
	previewOffsetX: number;
	previewOffsetY: number;
	payload: unknown;
}

interface DragPreview<Item> {
	item: Item;
	index: number;
	width: number;
	height: number;
}

interface DragPreviewPosition {
	left: number;
	top: number;
}

export interface DraggableListProps<Item> {
	items?: readonly Item[];
	onReorder?: (items: Item[]) => void;
	onDrop?: (items: Item[]) => void;
	renderItem: (item: Item, isDragging: boolean, index: number) => ReactNode;
	keyExtractor?: DraggableItemKeyExtractor<Item>;
	className?: string;
	itemClassName?: string;
	dragData?: (item: Item, index: number) => unknown;
	isItemDraggable?: (item: Item, index: number) => boolean;
	isolateDragEvents?: boolean;
	renderItemControl?: (item: Item, index: number) => ReactNode;
	isItemControlActive?: (item: Item, index: number) => boolean;
}

/**
 * Generic component for drag-and-drop list sorting.
 */
export default function DraggableList<Item>({
	items = [],
	onReorder,
	onDrop,
	renderItem,
	keyExtractor = getDefaultDraggableItemKey as DraggableItemKeyExtractor<Item>,
	className = "",
	itemClassName = "",
	dragData,
	isItemDraggable,
	isolateDragEvents = false,
	renderItemControl,
	isItemControlActive,
}: DraggableListProps<Item>) {
	const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
	const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
	const [dragPreview, setDragPreview] = useState<DragPreview<Item> | null>(null);
	const listIdRef = useRef(`DraggableList-${nextListId++}`);
	const listRef = useRef<HTMLDivElement>(null);
	const itemsRef = useRef<readonly Item[]>(items);
	const pendingPointerRef = useRef<PendingPointer | null>(null);
	const dragStateRef = useRef<ActiveDrag<Item> | null>(null);
	const removePointerListenersRef = useRef<(() => void) | null>(null);
	const suppressClickRef = useRef(false);
	const dragPreviewRef = useRef<HTMLDivElement>(null);
	const dragPreviewFrameRef = useRef<number | null>(null);
	const dragPreviewPositionRef = useRef<DragPreviewPosition | null>(null);
	const displayItems = items;
	const draggableItemsCount = displayItems.filter((item, index) =>
		isItemAllowedToDrag(item, index),
	).length;

	useLayoutEffect(() => {
		itemsRef.current = items;
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

	const scheduleDragPreviewPosition = (left: number, top: number) => {
		dragPreviewPositionRef.current = { left, top };
		if (dragPreviewFrameRef.current) return;
		const ownerWindow = listRef.current?.ownerDocument?.defaultView || window;
		dragPreviewFrameRef.current = ownerWindow.requestAnimationFrame(
			flushDragPreviewPosition,
		);
	};

	const setDocumentPressMode = (ownerDocument: Document, enabled: boolean) => {
		ownerDocument.body?.classList.toggle(PRESSING_BODY_CLASS, enabled);
	};

	const setDocumentDragMode = (ownerDocument: Document, enabled: boolean) => {
		ownerDocument.body?.classList.toggle(DRAGGING_BODY_CLASS, enabled);
		ownerDocument.defaultView?.dispatchEvent(
			new CustomEvent("prm-draggable-list-drag-mode", {
				detail: { enabled },
			}),
		);
	};

	const isNoListDragTarget = (event: { target: EventTarget | null }) => {
		const target = event.target;
		if (!(target instanceof HTMLElement)) return false;
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

	function isItemAllowedToDrag(item: Item, index: number) {
		return (
			typeof isItemDraggable !== "function" || isItemDraggable(item, index)
		);
	}

	const canDragItem = (item: Item, index: number) =>
		draggableItemsCount > 1 && isItemAllowedToDrag(item, index);

	const getListItemFromPoint = (
		clientX: number,
		clientY: number,
	): HTMLElement | null => {
		const root = listRef.current;
		const ownerDocument = root?.ownerDocument || document;
		const elements = ownerDocument.elementsFromPoint(clientX, clientY);

		for (const element of elements) {
			let current = element instanceof HTMLElement ? element : null;
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

	const dispatchCustomDragDrop = (
		event: DragPointerCoordinates,
		payload: unknown,
	) => {
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

	const getItemContentElement = (itemElement: Element | null): Element | null =>
		Array.from(itemElement?.children || []).find(
			(child) =>
				child instanceof Element &&
				!child.classList.contains("DraggableList__handle") &&
				!child.classList.contains("DraggableList__itemControl"),
		) || itemElement;

	const startPointerDrag = (event: DragPointerCoordinates) => {
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
		const draggedContentElement = getItemContentElement(draggedElement);
		const draggedRect = draggedContentElement?.getBoundingClientRect();

		if (!draggedRect) return;

		dragStateRef.current = {
			sourceIndex: pending.index,
			targetIndex: pending.index,
			originalItems: currentItems,
			hasReordered: false,
			previewOffsetX: event.clientX - draggedRect.left,
			previewOffsetY: event.clientY - draggedRect.top,
			payload,
		};
		setDocumentDragMode(listRef.current?.ownerDocument || document, true);
		setDraggingIndex(pending.index);
		setDragOverIndex(null);
		setDragPreview({
			item: currentItems[pending.index],
			index: pending.index,
			width: draggedRect.width,
			height: draggedRect.height,
		});
		scheduleDragPreviewPosition(draggedRect.left, draggedRect.top);
		updatePointerDrag(event);
	};

	const updatePointerDrag = (event: DragPointerCoordinates) => {
		const dragState = dragStateRef.current;
		if (!dragState) return;
		scheduleDragPreviewPosition(
			event.clientX - dragState.previewOffsetX,
			event.clientY - dragState.previewOffsetY,
		);

		const sourceIndex = dragState.sourceIndex;
		const targetElement = getListItemFromPoint(event.clientX, event.clientY);
		if (!targetElement) {
			setDragOverIndex(null);
			return;
		}

		const targetIndex = Number(targetElement.dataset.draggableListItemIndex);
		if (
			!Number.isInteger(targetIndex) ||
			targetElement.dataset.draggableListItemDraggable !== "true" ||
			sourceIndex === null
		) {
			setDragOverIndex(null);
			return;
		}
		if (sourceIndex === targetIndex) {
			dragState.targetIndex = sourceIndex;
			setDragOverIndex(null);
			return;
		}

		dragState.targetIndex = targetIndex;
		dragState.hasReordered = true;
		setDragOverIndex(targetIndex);
	};

	const finishPointerDrag = (event: DragPointerCoordinates) => {
		removePointerListenersRef.current?.();
		removePointerListenersRef.current = null;
		pendingPointerRef.current = null;

		const dragState = dragStateRef.current;
		dragStateRef.current = null;
		const reorderResult = dragState
			? getDraggableReorderResult({
					originalItems: dragState.originalItems,
					sourceIndex: dragState.sourceIndex,
					targetIndex: dragState.targetIndex,
					visitedDifferentTarget: dragState.hasReordered,
					keyExtractor,
				})
			: null;
		setDocumentPressMode(listRef.current?.ownerDocument || document, false);
		setDocumentDragMode(listRef.current?.ownerDocument || document, false);
		setDraggingIndex(null);
		setDragOverIndex(null);
		setDragPreview(null);
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

		if (reorderResult?.hasReordered && typeof onReorder === "function") {
			onReorder(reorderResult.items);
		}
		dispatchCustomDragDrop(event, dragState.payload);
		if (reorderResult?.hasReordered && onDrop) onDrop(reorderResult.items);
	};

	const handlePointerDown = (
		event: ReactPointerEvent<HTMLDivElement>,
		index: number,
	) => {
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

		const handlePointerMove = (moveEvent: PointerEvent) => {
			const pending = pendingPointerRef.current;
			if (!pending || moveEvent.pointerId !== pending.pointerId) return;

			if (
				!dragStateRef.current &&
				!hasReachedDragStartThreshold(
					pending.startX,
					pending.startY,
					moveEvent.clientX,
					moveEvent.clientY,
				)
			) {
				return;
			}

			moveEvent.preventDefault();
			startPointerDrag(moveEvent);
			updatePointerDrag(moveEvent);
		};

		const handlePointerUp = (upEvent: PointerEvent) => {
			const pending = pendingPointerRef.current;
			if (!pending || upEvent.pointerId !== pending.pointerId) return;
			finishPointerDrag(upEvent);
		};

		const handlePointerCancel = (cancelEvent: PointerEvent) => {
			const pending = pendingPointerRef.current;
			if (!pending || cancelEvent.pointerId !== pending.pointerId) return;
			finishPointerDrag(cancelEvent);
		};

		const handleSelectStart = (selectEvent: Event) => {
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

	const handleClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
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
					is_list_dragging: draggingIndex !== null,
				})}
				onClickCapture={handleClickCapture}
			>
				{displayItems.map((item, index) => (
					<div
						key={keyExtractor(item, index)}
						data-draggable-list-item="true"
						data-draggable-list-item-index={index}
						data-draggable-list-item-draggable={canDragItem(item, index)}
						onPointerDown={(event) => handlePointerDown(event, index)}
						className={classNames(itemClassName, {
							is_dragging: draggingIndex === index,
							is_drag_over: dragOverIndex === index,
						})}
					>
						{canDragItem(item, index) && (
							<span
								key="drag-handle"
								className="DraggableList__handle"
								data-list-drag-handle="true"
								aria-hidden="true"
							>
								<Icon name="drag-handle" size={18} strokeWidth={2} />
							</span>
						)}
						{renderItemControl && (
							<div
								key="item-control"
								className={classNames(
									"DraggableList__itemControl",
									isItemControlActive?.(item, index) && "is_active",
								)}
							>
								{renderItemControl(item, index)}
							</div>
						)}
						<Fragment key="item-content">
							{renderItem(item, draggingIndex === index, index)}
						</Fragment>
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
