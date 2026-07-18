import { classNames } from "../lib/index.js";

export const BUTTON_SIZES = Object.freeze({
	SMALL: "sm",
	MEDIUM: "md",
	LARGE: "lg",
} as const);

const LEGACY_SIZE_ALIASES = Object.freeze({
	small: BUTTON_SIZES.SMALL,
} as const);

export type ButtonSize = (typeof BUTTON_SIZES)[keyof typeof BUTTON_SIZES];
export type LegacyButtonSize = keyof typeof LEGACY_SIZE_ALIASES;
export type ButtonVariant =
	| "primary"
	| "danger"
	| "ghost"
	| "footer"
	| "create";

const BUTTON_SIZE_VALUES = new Set<ButtonSize>(Object.values(BUTTON_SIZES));

export interface ButtonAppearanceOptions {
	variant?: ButtonVariant;
	size?: ButtonSize | LegacyButtonSize;
	disabled?: boolean;
	className?: string;
}

export interface ButtonAppearance {
	normalizedSize: ButtonSize;
	className: string;
	strokeWidth: number;
}

export function normalizeButtonSize(
	size: ButtonSize | LegacyButtonSize = BUTTON_SIZES.MEDIUM,
): ButtonSize {
	const normalized =
		size === "small" ? LEGACY_SIZE_ALIASES.small : (size as ButtonSize);
	return BUTTON_SIZE_VALUES.has(normalized)
		? normalized
		: BUTTON_SIZES.MEDIUM;
}

function getVariantClass(variant?: ButtonVariant): string {
	return variant ? `Button__${variant}` : "";
}

function getDisabledClass(disabled: boolean): string {
	return disabled ? "is_disabled" : "";
}

function getIconStrokeWidth(
	variant: ButtonVariant | undefined,
	normalizedSize: ButtonSize,
): number {
	return variant === "create" || normalizedSize === BUTTON_SIZES.SMALL
		? 2.5
		: 2;
}

export function getButtonAppearance({
	variant,
	size = BUTTON_SIZES.MEDIUM,
	disabled = false,
	className = "",
}: ButtonAppearanceOptions): ButtonAppearance {
	const normalizedSize = normalizeButtonSize(size);
	return {
		normalizedSize,
		className: classNames(
			"Button",
			getVariantClass(variant),
			`Button__${normalizedSize}`,
			getDisabledClass(disabled),
			className,
		),
		strokeWidth: getIconStrokeWidth(variant, normalizedSize),
	};
}
