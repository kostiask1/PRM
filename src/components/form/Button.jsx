import Icon from "../common/Icon";
import Tooltip from "../common/Tooltip";
import classNames from "../../utils/classNames";
import "../../assets/components/Button.css";

export default function Button({
	children,
	onClick,
	variant, // primary, danger, ghost, footer, create
	size, // small
	icon,
	iconSize = 18,
	type = "button",
	className = "",
	title,
	...props
}) {
	const classes = classNames(
		"Button",
		variant && `Button--${variant}`,
		size && `Button--${size}`,
		props.disabled && "is-disabled",
		className,
	);

	const strokeWidth = variant === "create" || size === "small" ? 2.5 : 2;

	const handleClick = (e) => {
		if (props.disabled) return;

		e.preventDefault();
		e.stopPropagation();
		onClick && onClick(e);
	};

	const buttonNode = (
		<button type={type} className={classes} onClick={handleClick} {...props}>
			{icon && <Icon name={icon} size={iconSize} strokeWidth={strokeWidth} />}
			{children && <span>{children}</span>}
		</button>
	);

	if (title) {
		return <Tooltip content={title}>{buttonNode}</Tooltip>;
	}

	return buttonNode;
}
