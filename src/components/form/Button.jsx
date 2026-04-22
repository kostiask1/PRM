import Icon from "../common/Icon";
import Tooltip from "../common/Tooltip";
import classNames from "../../utils/classNames";
import "../../assets/components/Button.css";

const BUTTON_SIZES = Object.freeze({
	SMALL: "sm",
	MEDIUM: "md",
	LARGE: "lg",
});

const LEGACY_SIZE_ALIASES = Object.freeze({
	small: BUTTON_SIZES.SMALL,
});

const BUTTON_SIZE_VALUES = new Set(Object.values(BUTTON_SIZES));

function normalizeButtonSize(size) {
	const normalized = LEGACY_SIZE_ALIASES[size] || size;
	return BUTTON_SIZE_VALUES.has(normalized) ? normalized : BUTTON_SIZES.MEDIUM;
}

/**
 * @param {Object} props
 * @param {"sm"|"md"|"lg"} [props.size]
 */
function Button({
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
}) {
	const normalizedSize = normalizeButtonSize(size);
	const classes = classNames(
		"Button",
		variant && `Button--${variant}`,
		normalizedSize && `Button--${normalizedSize}`,
		props.disabled && "is-disabled",
		className,
	);

	const strokeWidth = variant === "create" || normalizedSize === BUTTON_SIZES.SMALL ? 2.5 : 2;

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

Button.SIZES = BUTTON_SIZES;

export default Button;
