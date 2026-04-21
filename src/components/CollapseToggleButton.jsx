import Button from "./Button";
import "../assets/components/CollapseToggleButton.css";

export default function CollapseToggleButton({
	collapsed = false,
	rotated,
	size = 24,
	onClick,
	className = "",
	title,
	disabled = false,
}) {
	const isRotated = typeof rotated === "boolean" ? rotated : collapsed;
	const sizeClass = size === 32 ? "CollapseToggleButton--32" : "CollapseToggleButton--24";

	return (
		<Button
			variant="ghost"
			size="small"
			icon="chevron"
			iconSize={size === 32 ? 16 : 14}
			className={`CollapseToggleButton ${sizeClass} ${isRotated ? "is-rotated" : ""} ${className}`.trim()}
			onClick={(event) => {
				event.stopPropagation();
				onClick?.(event);
			}}
			title={title}
			disabled={disabled}
		/>
	);
}
