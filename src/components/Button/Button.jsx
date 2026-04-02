import Icon from "../Icon";
import "./Button.css";

export default function Button({
	children,
	onClick,
	variant, // primary, danger, ghost, footer, create
	size, // small
	icon,
	iconSize = 18,
	type = "button",
	className = "",
	...props
}) {
	const classes = [
		"Button",
		variant ? `Button--${variant}` : "",
		size ? `Button--${size}` : "",
		props.disabled ? "is-disabled" : "",
		className,
	]
		.filter(Boolean)
		.join(" ");

	const strokeWidth = variant === "create" || size === "small" ? 2.5 : 2;

	const handleClick = (e) => {
		if (props.disabled) return;

		e.preventDefault();
		e.stopPropagation();
		onClick && onClick(e);
	};

	return (
		<button type={type} className={classes} onClick={handleClick} {...props}>
			{icon && <Icon name={icon} size={iconSize} strokeWidth={strokeWidth} />}
			{children && <span>{children}</span>}
		</button>
	);
}
