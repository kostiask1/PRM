const DRAG_START_THRESHOLD = 5;

export type DraggableItemKey = string | number;
export type DraggableItemKeyExtractor<Item> = (
	item: Item,
	index: number,
) => DraggableItemKey;

function readDefaultKey(value: unknown): DraggableItemKey | undefined {
	return typeof value === "string" || typeof value === "number"
		? value
		: undefined;
}

export function getDefaultDraggableItemKey(
	item: unknown,
	index: number,
): DraggableItemKey {
	if (item && typeof item === "object") {
		const record = item as Record<string, unknown>;
		return (
			readDefaultKey(record._renderKey) ??
			readDefaultKey(record.id) ??
			index
		);
	}
	return index;
}

export function hasReachedDragStartThreshold(
	startX: number,
	startY: number,
	clientX: number,
	clientY: number,
): boolean {
	return (
		Math.hypot(clientX - startX, clientY - startY) >=
		DRAG_START_THRESHOLD
	);
}

export function reorderDraggableItems<Item>(
	sourceItems: Item[],
	sourceIndex: number,
	targetIndex: number,
): Item[] {
	if (
		!Number.isInteger(sourceIndex) ||
		!Number.isInteger(targetIndex) ||
		sourceIndex === targetIndex ||
		sourceIndex < 0 ||
		targetIndex < 0 ||
		sourceIndex >= sourceItems.length ||
		targetIndex >= sourceItems.length
	) {
		return sourceItems;
	}

	const nextItems = [...sourceItems];
	const [draggedItem] = nextItems.splice(sourceIndex, 1);
	nextItems.splice(targetIndex, 0, draggedItem);
	return nextItems;
}

export function haveSameDraggableItemOrder<Item>(
	left: readonly Item[],
	right: readonly Item[],
	keyExtractor: DraggableItemKeyExtractor<Item>,
): boolean {
	if (left.length !== right.length) return false;
	return left.every(
		(item, index) =>
			keyExtractor(item, index) === keyExtractor(right[index], index),
	);
}

export interface DraggableReorderResult<Item> {
	items: Item[];
	hasReordered: boolean;
}

export interface DraggableDropDetail {
	payload: unknown;
	clientX: number;
	clientY: number;
	sourceListId: string;
}

export interface DraggableFinishPlan<Item> {
	items: Item[];
	hasReordered: boolean;
	dropDetail: DraggableDropDetail | null;
}

export interface DraggableFinishCallbacks<Item> {
	onReorder?: (items: Item[]) => void;
	onCustomDrop: (detail: DraggableDropDetail) => void;
	onDrop?: (items: Item[]) => void;
}

export function getDraggableReorderResult<Item>({
	originalItems,
	sourceIndex,
	targetIndex,
	visitedDifferentTarget,
	keyExtractor,
}: {
	originalItems: Item[];
	sourceIndex: number;
	targetIndex: number;
	visitedDifferentTarget: boolean;
	keyExtractor: DraggableItemKeyExtractor<Item>;
}): DraggableReorderResult<Item> {
	const items = reorderDraggableItems(
		originalItems,
		sourceIndex,
		targetIndex,
	);
	return {
		items,
		hasReordered:
			visitedDifferentTarget &&
			!haveSameDraggableItemOrder(originalItems, items, keyExtractor),
	};
}

export function getDraggableFinishPlan<Item>({
	originalItems,
	sourceIndex,
	targetIndex,
	visitedDifferentTarget,
	keyExtractor,
	payload,
	clientX,
	clientY,
	sourceListId,
}: {
	originalItems: Item[];
	sourceIndex: number;
	targetIndex: number;
	visitedDifferentTarget: boolean;
	keyExtractor: DraggableItemKeyExtractor<Item>;
	payload: unknown;
	clientX: number;
	clientY: number;
	sourceListId: string;
}): DraggableFinishPlan<Item> {
	const reorderResult = getDraggableReorderResult({
		originalItems,
		sourceIndex,
		targetIndex,
		visitedDifferentTarget,
		keyExtractor,
	});
	return {
		...reorderResult,
		dropDetail: payload
			? { payload, clientX, clientY, sourceListId }
			: null,
	};
}

export function applyDraggableFinishPlan<Item>(
	plan: DraggableFinishPlan<Item>,
	callbacks: DraggableFinishCallbacks<Item>,
): void {
	if (plan.hasReordered) callbacks.onReorder?.(plan.items);
	if (plan.dropDetail) callbacks.onCustomDrop(plan.dropDetail);
	if (plan.hasReordered) callbacks.onDrop?.(plan.items);
}
