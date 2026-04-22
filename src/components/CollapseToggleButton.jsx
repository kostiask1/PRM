import Button from "./Button";
import "../assets/components/CollapseToggleButton.css";
import classNames from "../utils/classNames";

export default function CollapseToggleButton({
	collapsed = false,
	rotated,
	size = "md",
	onClick,
	className = "",
	title,
	disabled = false,
}) {
	const isRotated = typeof rotated === "boolean" ? rotated : collapsed;
	const allowedSizes = new Set(["sm", "md", "lg"]);
	const normalizedSize = allowedSizes.has(size) ? size : "md";
	const sizeClass = `CollapseToggleButton--${normalizedSize}`;
	const iconSize = normalizedSize === "sm" ? 14 : 16;

	return (
		<Button
			variant="ghost"
			size="small"
			icon="chevron"
			iconSize={iconSize}
			className={classNames(
				"CollapseToggleButton",
				sizeClass,
				{ "is-rotated": isRotated },
				className,
			)}
			onClick={(event) => {
				event.stopPropagation();
				onClick?.(event);
			}}
			title={title}
			disabled={disabled}
		/>
	);
}
