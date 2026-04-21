import { useState } from "react";
import Tooltip from "./Tooltip.jsx";
import "../assets/components/SpellLink.css";

export default function SpellLink({ children, onClick, onHoverResolve }) {
	const [tooltipContent, setTooltipContent] = useState(null);
	const [isLoading, setIsLoading] = useState(false);

	const handleMouseEnter = async () => {
		if (!onHoverResolve) return;
		if (tooltipContent) return;
		setIsLoading(true);
		try {
			const content = await onHoverResolve();
			setTooltipContent(content || null);
		} catch (error) {
			console.error("Failed to load tooltip content", error);
			setTooltipContent(null);
		} finally {
			setIsLoading(false);
		}
	};

	const resolvedContent =
		tooltipContent ||
		(isLoading ? <div className="Tooltip__text">Завантаження...</div> : null);

	return (
		<Tooltip content={resolvedContent}>
			<span className="SpellLink" onClick={onClick} onMouseEnter={handleMouseEnter}>
				{children}
			</span>
		</Tooltip>
	);
}
