import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "../../assets/components/Tooltip.css";
import classNames from "../../utils/classNames";

const GAP = 8;
const VIEWPORT_MARGIN = 8;
const CLOSE_DELAY = 90;

let activeTooltipId = null;
const activeSubscribers = new Set();
const tooltipParentById = new Map();
const tooltipTimeoutControllers = new Map();

function isDraggableListDragging() {
	return Boolean(
		document.body?.classList.contains("prm-draggable-list-dragging") ||
			document.body?.classList.contains("prm-draggable-list-pressing"),
	);
}

function subscribeActiveTooltip(listener) {
	activeSubscribers.add(listener);
	return () => activeSubscribers.delete(listener);
}

function setActiveTooltip(id) {
	activeTooltipId = id || null;
	activeSubscribers.forEach((listener) => listener(activeTooltipId));
}

function cancelOtherTooltipTimeouts(exceptId) {
	tooltipTimeoutControllers.forEach((controllers, id) => {
		if (id === exceptId) return;
		controllers.cancelOpen?.();
		controllers.cancelClose?.();
	});
}

function closeAllTooltips() {
	tooltipTimeoutControllers.forEach((controllers) => {
		controllers.cancelOpen?.();
		controllers.cancelClose?.();
		controllers.close?.();
	});
	setActiveTooltip(null);
}

function findParentTooltipId(element, selfId) {
	if (!element?.parentElement) return null;
	let parent = element.parentElement.closest("[data-tooltip-id]");
	while (parent && parent.dataset.tooltipId === selfId) {
		parent = parent.parentElement?.closest("[data-tooltip-id]") || null;
	}
	return parent?.dataset.tooltipId || null;
}

function isAncestorTooltip(ancestorId, childId) {
	let current = tooltipParentById.get(childId) || null;
	while (current) {
		if (current === ancestorId) return true;
		current = tooltipParentById.get(current) || null;
	}
	return false;
}

function calculatePosition(
	triggerRect,
	tooltipRect,
	viewportWidth,
	viewportHeight,
) {
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

export default function Tooltip({
	content,
	children,
	delay = 160,
	disabled = false,
	className,
	anchorElement = null,
}) {
	const tooltipIdRef = useRef(`tooltip-${Math.random().toString(36).slice(2)}`);
	const closeTimerRef = useRef(null);
	const parentTooltipIdRef = useRef(null);
	const triggerRef = useRef(null);
	const triggerActiveRef = useRef(false);
	const tooltipRef = useRef(null);
	const timerRef = useRef(null);
	const [isOpen, setIsOpen] = useState(false);
	const [activeId, setActiveId] = useState(activeTooltipId);
	const [position, setPosition] = useState({ top: 0, left: 0, ready: false });

	const hasContent = Boolean(content);

	const closeTooltip = () => {
		if (timerRef.current) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
		if (closeTimerRef.current) {
			clearTimeout(closeTimerRef.current);
			closeTimerRef.current = null;
		}
		setIsOpen(false);
		if (activeTooltipId === tooltipIdRef.current) {
			setActiveTooltip(parentTooltipIdRef.current || null);
		}
	};

	const cancelOpenTooltip = () => {
		if (timerRef.current) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
	};

	const scheduleCloseTooltip = () => {
		triggerActiveRef.current = false;
		if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
		closeTimerRef.current = setTimeout(() => {
			closeTooltip();
		}, CLOSE_DELAY);
	};

	const cancelCloseTooltip = () => {
		if (closeTimerRef.current) {
			clearTimeout(closeTimerRef.current);
			closeTimerRef.current = null;
		}
	};

	const openTooltip = () => {
		if (disabled || !hasContent || isDraggableListDragging()) return;
		cancelOpenTooltip();
		cancelCloseTooltip();
		cancelOtherTooltipTimeouts(tooltipIdRef.current);
		timerRef.current = setTimeout(() => {
			const parentId = findParentTooltipId(
				triggerRef.current,
				tooltipIdRef.current,
			);
			parentTooltipIdRef.current = parentId;
			tooltipParentById.set(tooltipIdRef.current, parentId);
			setPosition((prev) => ({ ...prev, ready: false }));
			setIsOpen(true);
			setActiveTooltip(tooltipIdRef.current);
			timerRef.current = null;
		}, delay);
	};

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
		if (
			!triggerActiveRef.current || isOpen || disabled || !hasContent ||
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
			const parentId = findParentTooltipId(
				triggerRef.current,
				tooltipIdRef.current,
			);
			parentTooltipIdRef.current = parentId;
			tooltipParentById.set(tooltipIdRef.current, parentId);
			setPosition((prev) => ({ ...prev, ready: false }));
			setIsOpen(true);
			setActiveTooltip(tooltipIdRef.current);
			timerRef.current = null;
		}, delay);
	}, [content, delay, disabled, hasContent, isOpen]);

	useEffect(() => {
		if (!isOpen) return;
		if (!activeId || activeId === tooltipIdRef.current) return;
		if (isAncestorTooltip(tooltipIdRef.current, activeId)) return;
		closeTooltip();
	}, [activeId, isOpen]);

	useLayoutEffect(() => {
		const anchor = anchorElement || triggerRef.current;
		if (!isOpen || !anchor || !tooltipRef.current) return;
		const triggerRect = anchor.getBoundingClientRect();
		const tooltipRect = tooltipRef.current.getBoundingClientRect();
		setPosition(
			calculatePosition(
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
				calculatePosition(
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

	useEffect(
		() => {
			const tooltipId = tooltipIdRef.current;
			const handleDragModeChange = (event) => {
				if (event.detail?.enabled) closeAllTooltips();
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
				tooltipParentById.delete(tooltipId);
				if (activeTooltipId === tooltipId) {
					setActiveTooltip(parentTooltipIdRef.current || null);
				}
			};
		},
		[],
	);

	useEffect(() => {
		const tooltipId = tooltipIdRef.current;
		const unsubscribe = subscribeActiveTooltip(setActiveId);
		tooltipTimeoutControllers.set(tooltipId, {
			cancelOpen: cancelOpenTooltip,
			cancelClose: cancelCloseTooltip,
			close: closeTooltip,
		});
		return () => {
			unsubscribe();
			tooltipTimeoutControllers.delete(tooltipId);
			if (activeTooltipId === tooltipId) {
				setActiveTooltip(parentTooltipIdRef.current || null);
			}
		};
	}, []);

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
