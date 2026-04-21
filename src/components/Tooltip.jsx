import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "../assets/components/Tooltip.css";

const GAP = 8;
const VIEWPORT_MARGIN = 8;
const TOOLTIP_OPEN_EVENT = "prm-tooltip-open";

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
	const triggerRef = useRef(null);
	const tooltipRef = useRef(null);
	const timerRef = useRef(null);
	const [isOpen, setIsOpen] = useState(false);
	const [position, setPosition] = useState({ top: 0, left: 0, ready: false });

	const hasContent = Boolean(content);

	const closeTooltip = () => {
		if (timerRef.current) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
		setIsOpen(false);
	};

	const openTooltip = () => {
		if (disabled) return;
		if (timerRef.current) clearTimeout(timerRef.current);
		timerRef.current = setTimeout(() => {
			window.dispatchEvent(
				new CustomEvent(TOOLTIP_OPEN_EVENT, {
					detail: { id: tooltipIdRef.current },
				}),
			);
			setPosition((prev) => ({ ...prev, ready: false }));
			setIsOpen(true);
		}, delay);
	};

	useEffect(() => {
		const handleTooltipOpened = (event) => {
			const openedTooltipId = event?.detail?.id;
			if (!openedTooltipId || openedTooltipId === tooltipIdRef.current) return;
			closeTooltip();
		};

		window.addEventListener(TOOLTIP_OPEN_EVENT, handleTooltipOpened);
		return () => {
			window.removeEventListener(TOOLTIP_OPEN_EVENT, handleTooltipOpened);
		};
	}, []);

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
		},
		[],
	);

	return (
		<>
			<span
				ref={triggerRef}
				onMouseEnter={openTooltip}
				onMouseLeave={closeTooltip}
				onBlur={closeTooltip}
				onFocus={openTooltip}
				className="Tooltip__trigger">
				{children}
			</span>
			{isOpen && hasContent
				? createPortal(
						<div
							ref={tooltipRef}
							className="Tooltip"
							style={{
								top: `${position.top}px`,
								left: `${position.left}px`,
								visibility: position.ready ? "visible" : "hidden",
							}}>
							{content}
						</div>,
						document.body,
				  )
				: null}
		</>
	);
}
