import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "../assets/components/Tooltip.css";

const GAP = 8;
const VIEWPORT_MARGIN = 8;
const CLOSE_DELAY = 90;

let activeTooltipId = null;
const activeSubscribers = new Set();
const tooltipParentById = new Map();
const tooltipTimeoutControllers = new Map();

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

function calculatePosition(triggerRect, tooltipRect, viewportWidth, viewportHeight) {
	let left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
	left = Math.max(
		VIEWPORT_MARGIN,
		Math.min(left, viewportWidth - tooltipRect.width - VIEWPORT_MARGIN),
	);

	let top = triggerRect.bottom + GAP;
	const bottomOverflow = top + tooltipRect.height > viewportHeight - VIEWPORT_MARGIN;
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
}) {
	const tooltipIdRef = useRef(`tooltip-${Math.random().toString(36).slice(2)}`);
	const closeTimerRef = useRef(null);
	const parentTooltipIdRef = useRef(null);
	const triggerRef = useRef(null);
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
		if (disabled || !hasContent) return;
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
		cancelOtherTooltipTimeouts(tooltipIdRef.current);
		openTooltip();
	};

	const handleTooltipEnter = () => {
		cancelOtherTooltipTimeouts(tooltipIdRef.current);
		cancelCloseTooltip();
	};

	useEffect(() => {
		const unsubscribe = subscribeActiveTooltip(setActiveId);
		tooltipTimeoutControllers.set(tooltipIdRef.current, {
			cancelOpen: cancelOpenTooltip,
			cancelClose: cancelCloseTooltip,
		});
		return () => {
			unsubscribe();
			tooltipTimeoutControllers.delete(tooltipIdRef.current);
		};
	}, []);

	useEffect(() => {
		if (!isOpen) return;
		if (!activeId || activeId === tooltipIdRef.current) return;
		if (isAncestorTooltip(tooltipIdRef.current, activeId)) return;
		closeTooltip();
	}, [activeId, isOpen]);

	useLayoutEffect(() => {
		if (!isOpen || !triggerRef.current || !tooltipRef.current) return;
		const triggerRect = triggerRef.current.getBoundingClientRect();
		const tooltipRect = tooltipRef.current.getBoundingClientRect();
		setPosition(
			calculatePosition(
				triggerRect,
				tooltipRect,
				window.innerWidth,
				window.innerHeight,
			),
		);
	}, [isOpen, content]);

	useEffect(() => {
		if (!isOpen) return;
		const handleReposition = () => {
			if (!triggerRef.current || !tooltipRef.current) return;
			const triggerRect = triggerRef.current.getBoundingClientRect();
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
	}, [isOpen]);

	useEffect(
		() => () => {
			if (timerRef.current) clearTimeout(timerRef.current);
			if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
			tooltipParentById.delete(tooltipIdRef.current);
			if (activeTooltipId === tooltipIdRef.current) {
				setActiveTooltip(parentTooltipIdRef.current || null);
			}
		},
		[],
	);

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
				className="Tooltip__trigger">
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
							}}>
							{content}
						</div>,
						document.body,
				  )
				: null}
		</>
	);
}
