import { useState } from "react";
import Tooltip from "./common/Tooltip.jsx";
import "../assets/components/RulesLink.css";
import { lang } from "../services/localization";
import classNames from "../utils/classNames";

export default function RulesLink({
	children,
	onClick,
	onHoverResolve,
	type = "spell",
}) {
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
		(isLoading ? (
			<div className="Tooltip__text">{lang.t("Loading...")}</div>
		) : null);

	return (
		<Tooltip content={resolvedContent}>
			<span
				className={classNames("RulesLink", type && `RulesLink--${type}`)}
				onClick={onClick}
				onMouseEnter={handleMouseEnter}
			>
				{children}
			</span>
		</Tooltip>
	);
}
