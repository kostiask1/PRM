import Button from "../form/Button";
import "../../assets/components/CollapseToggleButton.css";
import classNames from "../../utils/classNames";

/**
 * @param {Object} props
 * @param {"sm"|"md"|"lg"} [props.size]
 */
function CollapseToggleButton({
	collapsed = false,
	rotated,
	size = Button.SIZES.MEDIUM,
	onClick,
	className = "",
	title,
	disabled = false,
}) {
	const isRotated = typeof rotated === "boolean" ? rotated : collapsed;
	const sizeClass = `CollapseToggleButton--${size}`;
	const iconSize = size === Button.SIZES.SMALL ? 14 : 16;

	return (
		<Button
			variant="ghost"
			size={size}
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

export default CollapseToggleButton;
