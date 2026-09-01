import Button from "./Button.tsx";
import type { ReactNode } from "react";
import type { ButtonProps, ButtonSize } from "./Button.tsx";
import "../../assets/components/CollapseToggleButton.css";
import { classNames } from "../lib/index.js";

/**
 * @param {Object} props
 * @param {"sm"|"md"|"lg"} [props.size]
 */
export interface CollapseToggleButtonProps {
	collapsed?: boolean;
	rotated?: boolean;
	size?: ButtonSize;
	onClick?: ButtonProps["onClick"];
	className?: string;
	title?: ReactNode;
	disabled?: boolean;
}

function CollapseToggleButton({
	collapsed = false,
	rotated,
	size = Button.SIZES.MEDIUM,
	onClick,
	className = "",
	title,
	disabled = false,
}: CollapseToggleButtonProps) {
	const isRotated = typeof rotated === "boolean" ? rotated : collapsed;
	const sizeClass = `CollapseToggleButton__${size}`;
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
				{ is_rotated: isRotated },
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
