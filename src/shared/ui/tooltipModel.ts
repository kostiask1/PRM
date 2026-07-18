export type TooltipId = string;
export type TooltipSubscriber = (id: TooltipId | null) => void;

export interface TooltipTimeoutController {
	cancelOpen?: () => void;
	cancelClose?: () => void;
	close?: () => void;
}

export interface TooltipPosition {
	top: number;
	left: number;
	ready: boolean;
}

export interface TooltipRect {
	left: number;
	top: number;
	right: number;
	bottom: number;
	width: number;
	height: number;
}

const GAP = 8;
const VIEWPORT_MARGIN = 8;

let activeTooltipId: TooltipId | null = null;
const activeSubscribers = new Set<TooltipSubscriber>();
const tooltipParentById = new Map<TooltipId, TooltipId | null>();
const tooltipTimeoutControllers = new Map<
	TooltipId,
	TooltipTimeoutController
>();

export function getActiveTooltipId(): TooltipId | null {
	return activeTooltipId;
}

export function subscribeActiveTooltip(
	listener: TooltipSubscriber,
): () => void {
	activeSubscribers.add(listener);
	return () => {
		activeSubscribers.delete(listener);
	};
}

export function setActiveTooltip(id: TooltipId | null): void {
	activeTooltipId = id || null;
	activeSubscribers.forEach((listener) => listener(activeTooltipId));
}

export function setTooltipParent(
	id: TooltipId,
	parentId: TooltipId | null,
): void {
	tooltipParentById.set(id, parentId);
}

export function removeTooltipParent(id: TooltipId): void {
	tooltipParentById.delete(id);
}

export function isAncestorTooltip(
	ancestorId: TooltipId,
	childId: TooltipId,
): boolean {
	let current = tooltipParentById.get(childId) || null;
	while (current) {
		if (current === ancestorId) return true;
		current = tooltipParentById.get(current) || null;
	}
	return false;
}

export function setTooltipTimeoutController(
	id: TooltipId,
	controller: TooltipTimeoutController,
): void {
	tooltipTimeoutControllers.set(id, controller);
}

export function removeTooltipTimeoutController(id: TooltipId): void {
	tooltipTimeoutControllers.delete(id);
}

export function cancelOtherTooltipTimeouts(exceptId: TooltipId): void {
	tooltipTimeoutControllers.forEach((controllers, id) => {
		if (id === exceptId) return;
		controllers.cancelOpen?.();
		controllers.cancelClose?.();
	});
}

export function closeAllTooltips(): void {
	tooltipTimeoutControllers.forEach((controllers) => {
		controllers.cancelOpen?.();
		controllers.cancelClose?.();
		controllers.close?.();
	});
	setActiveTooltip(null);
}

export function calculateTooltipPosition(
	triggerRect: TooltipRect,
	tooltipRect: TooltipRect,
	viewportWidth: number,
	viewportHeight: number,
): TooltipPosition {
	let left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
	left = Math.max(
		VIEWPORT_MARGIN,
		Math.min(left, viewportWidth - tooltipRect.width - VIEWPORT_MARGIN),
	);

	let top = triggerRect.bottom + GAP;
	const bottomOverflow =
		top + tooltipRect.height > viewportHeight - VIEWPORT_MARGIN;
	if (bottomOverflow) {
		const topCandidate = triggerRect.top - tooltipRect.height - GAP;
		if (topCandidate >= VIEWPORT_MARGIN) {
			top = topCandidate;
		} else {
			top = Math.max(
				VIEWPORT_MARGIN,
				viewportHeight - tooltipRect.height - VIEWPORT_MARGIN,
			);
		}
	}

	return { top, left, ready: true };
}
