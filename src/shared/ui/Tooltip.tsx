import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import "../../assets/components/Tooltip.css";
import { classNames } from "../lib/index.js";
import {
	calculateTooltipPosition,
	cancelOtherTooltipTimeouts,
	closeAllTooltips,
	getActiveTooltipId,
	isAncestorTooltip,
	removeTooltipParent,
	removeTooltipTimeoutController,
	setActiveTooltip,
	setTooltipParent,
	setTooltipTimeoutController,
	subscribeActiveTooltip,
	type TooltipId,
	type TooltipPosition,
} from "./tooltipModel.ts";

const CLOSE_DELAY = 90;

export interface TooltipProps {
	content: ReactNode;
	children: ReactNode;
	delay?: number;
	disabled?: boolean;
	className?: string;
	anchorElement?: Element | null;
}

function containsNode(parent: Node | null, child: Node | null): boolean {
	if (!parent || !child) return false;
	return parent === child || parent.contains(child);
}

function isDraggableListDragging(): boolean {
	return Boolean(
		document.body?.classList.contains("prm_draggable_list_dragging") ||
		document.body?.classList.contains("prm_draggable_list_pressing"),
	);
}


function findParentTooltipId(
	element: HTMLElement | null,
	selfId: TooltipId,
): TooltipId | null {
	if (!element?.parentElement) return null;
	let parent = element.parentElement.closest<HTMLElement>("[data-tooltip-id]");
	while (parent && parent.dataset.tooltipId === selfId) {
		parent =
			parent.parentElement?.closest<HTMLElement>("[data-tooltip-id]") || null;
	}
	return parent?.dataset.tooltipId || null;
}

export default function Tooltip({
	content,
	children,
	delay = 160,
	disabled = false,
	className,
	anchorElement = null,
}: TooltipProps) {
	const tooltipIdRef = useRef(`tooltip-${Math.random().toString(36).slice(2)}`);
	const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const parentTooltipIdRef = useRef<TooltipId | null>(null);
	const triggerRef = useRef<HTMLSpanElement | null>(null);
	const triggerActiveRef = useRef(false);
	const tooltipRef = useRef<HTMLDivElement | null>(null);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [isOpen, setIsOpen] = useState(false);
	const [activeId, setActiveId] = useState<TooltipId | null>(
		getActiveTooltipId(),
	);
	const [position, setPosition] = useState<TooltipPosition>({
		top: 0,
		left: 0,
		ready: false,
	});

	const hasContent = Boolean(content);

	const closeTooltip = useCallback(() => {
		if (timerRef.current) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
		if (closeTimerRef.current) {
			clearTimeout(closeTimerRef.current);
			closeTimerRef.current = null;
		}
		setIsOpen(false);
		if (getActiveTooltipId() === tooltipIdRef.current) {
			setActiveTooltip(parentTooltipIdRef.current || null);
		}
	}, []);

	const cancelOpenTooltip = useCallback(() => {
		if (timerRef.current) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
	}, []);

	const scheduleCloseTooltip = useCallback(() => {
		triggerActiveRef.current = false;
		if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
		closeTimerRef.current = setTimeout(() => {
			closeTooltip();
		}, CLOSE_DELAY);
	}, [closeTooltip]);

	const cancelCloseTooltip = useCallback(() => {
		if (closeTimerRef.current) {
			clearTimeout(closeTimerRef.current);
			closeTimerRef.current = null;
		}
	}, []);

	const showTooltip = useCallback(() => {
		const parentId = findParentTooltipId(
			triggerRef.current,
			tooltipIdRef.current,
		);
		parentTooltipIdRef.current = parentId;
		setTooltipParent(tooltipIdRef.current, parentId);
		setPosition((prev) => ({ ...prev, ready: false }));
		setIsOpen(true);
		setActiveTooltip(tooltipIdRef.current);
		timerRef.current = null;
	}, []);

	const openTooltip = useCallback(() => {
		if (disabled || !hasContent || isDraggableListDragging()) return;
		cancelOpenTooltip();
		cancelCloseTooltip();
		cancelOtherTooltipTimeouts(tooltipIdRef.current);
		timerRef.current = setTimeout(() => {
			showTooltip();
		}, delay);
	}, [
		cancelCloseTooltip,
		cancelOpenTooltip,
		delay,
		disabled,
		hasContent,
		showTooltip,
	]);

	const handleTriggerEnter = () => {
		if (isDraggableListDragging()) {
			closeTooltip();
			return;
		}
		triggerActiveRef.current = true;
		cancelOtherTooltipTimeouts(tooltipIdRef.current);
		openTooltip();
	};

	const handleTooltipEnter = () => {
		cancelOtherTooltipTimeouts(tooltipIdRef.current);
		cancelCloseTooltip();
	};

	useEffect(() => {
		if (disabled || !hasContent) closeTooltip();
	}, [closeTooltip, disabled, hasContent]);

	useEffect(() => {
		if (
			!triggerActiveRef.current ||
			isOpen ||
			disabled ||
			!hasContent ||
			isDraggableListDragging()
		)
			return;
		if (timerRef.current) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
		if (closeTimerRef.current) {
			clearTimeout(closeTimerRef.current);
			closeTimerRef.current = null;
		}
		cancelOtherTooltipTimeouts(tooltipIdRef.current);
		timerRef.current = setTimeout(() => {
			showTooltip();
		}, delay);
	}, [content, delay, disabled, hasContent, isOpen, showTooltip]);

	useEffect(() => {
		if (!isOpen) return;
		if (!activeId || activeId === tooltipIdRef.current) return;
		if (isAncestorTooltip(tooltipIdRef.current, activeId)) return;
		closeTooltip();
	}, [activeId, closeTooltip, isOpen]);

	useLayoutEffect(() => {
		const anchor = anchorElement || triggerRef.current;
		if (!isOpen || !anchor || !tooltipRef.current) return;
		const triggerRect = anchor.getBoundingClientRect();
		const tooltipRect = tooltipRef.current.getBoundingClientRect();
		setPosition(
			calculateTooltipPosition(
				triggerRect,
				tooltipRect,
				window.innerWidth,
				window.innerHeight,
			),
		);
	}, [isOpen, content, anchorElement]);

	useEffect(() => {
		if (!isOpen) return;
		const handleReposition = () => {
			const anchor = anchorElement || triggerRef.current;
			if (!anchor || !tooltipRef.current) return;
			const triggerRect = anchor.getBoundingClientRect();
			const tooltipRect = tooltipRef.current.getBoundingClientRect();
			setPosition(
				calculateTooltipPosition(
					triggerRect,
					tooltipRect,
					window.innerWidth,
					window.innerHeight,
				),
			);
		};

		window.addEventListener("scroll", handleReposition, true);
		window.addEventListener("resize", handleReposition);
		return () => {
			window.removeEventListener("scroll", handleReposition, true);
			window.removeEventListener("resize", handleReposition);
		};
	}, [isOpen, anchorElement]);

	useEffect(() => {
		if (!isOpen) return;
		const handlePointerMove = (event: PointerEvent) => {
			if (isDraggableListDragging()) {
				closeTooltip();
				return;
			}

			const trigger = triggerRef.current;
			const anchor = anchorElement;
			const hoveredElement = document.elementFromPoint(
				event.clientX,
				event.clientY,
			);
			const isOverTrigger = containsNode(trigger, hoveredElement);
			const isOverAnchor = anchor && containsNode(anchor, hoveredElement);

			if (!isOverTrigger && !isOverAnchor) {
				scheduleCloseTooltip();
			}
		};

		document.addEventListener("pointermove", handlePointerMove, true);
		return () => {
			document.removeEventListener("pointermove", handlePointerMove, true);
		};
	}, [anchorElement, closeTooltip, isOpen, scheduleCloseTooltip]);

	useEffect(() => {
		const tooltipId = tooltipIdRef.current;
		const handleDragModeChange = (event: Event) => {
			const dragEvent = event as CustomEvent<{ enabled?: boolean }>;
			if (dragEvent.detail?.enabled) closeAllTooltips();
		};
		window.addEventListener(
			"prm-draggable-list-drag-mode",
			handleDragModeChange,
		);
		return () => {
			window.removeEventListener(
				"prm-draggable-list-drag-mode",
				handleDragModeChange,
			);
			if (timerRef.current) clearTimeout(timerRef.current);
			if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
			removeTooltipParent(tooltipId);
			if (getActiveTooltipId() === tooltipId) {
				setActiveTooltip(parentTooltipIdRef.current || null);
			}
		};
	}, []);

	useEffect(() => {
		const tooltipId = tooltipIdRef.current;
		const unsubscribe = subscribeActiveTooltip(setActiveId);
		setTooltipTimeoutController(tooltipId, {
			cancelOpen: cancelOpenTooltip,
			cancelClose: cancelCloseTooltip,
			close: closeTooltip,
		});
		return () => {
			unsubscribe();
			removeTooltipTimeoutController(tooltipId);
			if (getActiveTooltipId() === tooltipId) {
				setActiveTooltip(parentTooltipIdRef.current || null);
			}
		};
	}, [cancelCloseTooltip, cancelOpenTooltip, closeTooltip]);

	const hiddenByChild =
		isOpen &&
		activeId &&
		activeId !== tooltipIdRef.current &&
		isAncestorTooltip(tooltipIdRef.current, activeId);

	return (
		<>
			<span
				data-tooltip-id={tooltipIdRef.current}
				ref={triggerRef}
				onMouseEnter={handleTriggerEnter}
				onMouseLeave={scheduleCloseTooltip}
				onBlur={scheduleCloseTooltip}
				onFocus={handleTriggerEnter}
				className={classNames("Tooltip__trigger", className)}
			>
				{children}
			</span>
			{isOpen && hasContent
				? createPortal(
						<div
							ref={tooltipRef}
							data-tooltip-id={tooltipIdRef.current}
							className="Tooltip"
							onMouseEnter={handleTooltipEnter}
							onMouseLeave={scheduleCloseTooltip}
							style={{
								top: `${position.top}px`,
								left: `${position.left}px`,
								visibility:
									position.ready && !hiddenByChild ? "visible" : "hidden",
							}}
						>
							{content}
						</div>,
						document.body,
					)
				: null}
		</>
	);
}
