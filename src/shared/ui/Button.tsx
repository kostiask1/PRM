import { forwardRef } from "react";
import type {
	ButtonHTMLAttributes,
	ForwardRefExoticComponent,
	MouseEvent,
	ReactNode,
	RefAttributes,
} from "react";
import Icon from "./Icon.tsx";
import type { IconName } from "./Icon.tsx";
import Tooltip from "./Tooltip.tsx";
import "../../assets/components/Button.css";
import { BUTTON_SIZES, getButtonAppearance } from "./buttonModel.ts";
import type {
	ButtonSize,
	ButtonVariant,
	LegacyButtonSize,
} from "./buttonModel.ts";

export type {
	ButtonSize,
	ButtonVariant,
	LegacyButtonSize,
} from "./buttonModel.ts";

export interface ButtonProps
	extends Omit<
		ButtonHTMLAttributes<HTMLButtonElement>,
		"children" | "onClick" | "size" | "title"
	> {
	children?: ReactNode;
	onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
	variant?: ButtonVariant;
	size?: ButtonSize | LegacyButtonSize;
	icon?: IconName;
	iconSize?: number;
	title?: ReactNode;
}

export interface ButtonComponent
	extends ForwardRefExoticComponent<
		ButtonProps & RefAttributes<HTMLButtonElement>
	> {
	SIZES: typeof BUTTON_SIZES;
}

interface ButtonIconProps {
	icon?: IconName;
	iconSize: number;
	strokeWidth: number;
}

function ButtonIcon({ icon, iconSize, strokeWidth }: ButtonIconProps) {
	if (!icon) return null;
	return <Icon name={icon} size={iconSize} strokeWidth={strokeWidth} />;
}

function ButtonContent({ children }: { children?: ReactNode }) {
	if (!children) return null;
	return <span>{children}</span>;
}

function withOptionalTooltip(button: ReactNode, title?: ReactNode) {
	if (!title) return button;
	return <Tooltip content={title}>{button}</Tooltip>;
}

/**
 * @param {Object} props
 * @param {"sm"|"md"|"lg"} [props.size]
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
	{
		children,
		onClick,
		variant, // primary, danger, ghost, footer, create
		size = BUTTON_SIZES.MEDIUM,
		icon,
		iconSize = 18,
		type = "button",
		className = "",
		title,
		...props
	},
	ref,
) {
	const appearance = getButtonAppearance({
		variant,
		size,
		disabled: props.disabled,
		className,
	});

	const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
		if (props.disabled) return;

		e.preventDefault();
		e.stopPropagation();
		onClick?.(e);
	};

	const buttonNode = (
		<button
			ref={ref}
			type={type}
			className={appearance.className}
			onClick={handleClick}
			{...props}
		>
			<ButtonIcon
				icon={icon}
				iconSize={iconSize}
				strokeWidth={appearance.strokeWidth}
			/>
			<ButtonContent>{children}</ButtonContent>
		</button>
	);

	return withOptionalTooltip(buttonNode, title);
}) as ButtonComponent;

Button.SIZES = BUTTON_SIZES;

export default Button;
