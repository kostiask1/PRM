import {
	calculateDropdownPortalStyle,
	type DropdownAnchorRect,
	type DropdownPortalStyle,
	type DropdownViewport,
} from "./dropdownPortalModel.ts";

const SELECT_DROPDOWN_MAX_HEIGHT = 300;

export type SelectValue = string | number;

export interface SelectOption<Value extends SelectValue = SelectValue> {
	value: Value;
	label: unknown;
}

export interface SelectChangeEvent<Value extends SelectValue = SelectValue> {
	target: {
		value: Value;
	};
}

export type SelectAnchorRect = DropdownAnchorRect;
export type SelectViewport = DropdownViewport;
export type SelectDropdownStyle = DropdownPortalStyle;

export interface SelectScrollMetrics {
	optionTop: number;
	optionHeight: number;
	scrollTop: number;
	viewportHeight: number;
}

export function getSelectedOption<Value extends SelectValue>(
	options: readonly SelectOption<Value>[],
	value: Value,
): SelectOption<Value> | undefined {
	return options.find((option) => option.value === value) ?? options[0];
}

export function createSelectChangeEvent<Value extends SelectValue>(
	value: Value,
): SelectChangeEvent<Value> {
	return { target: { value } };
}

export function calculateSelectDropdownStyle(
	rect: SelectAnchorRect,
	viewport: SelectViewport,
	dropdownMinWidth: number,
): SelectDropdownStyle {
	return calculateDropdownPortalStyle({
		rect,
		viewport,
		minWidth: dropdownMinWidth,
		maxHeight: SELECT_DROPDOWN_MAX_HEIGHT,
	});
}

export function getSelectScrollTop({
	optionTop,
	optionHeight,
	scrollTop,
	viewportHeight,
}: SelectScrollMetrics): number {
	const optionBottom = optionTop + optionHeight;
	const visibleBottom = scrollTop + viewportHeight;

	if (optionTop < scrollTop) return optionTop;
	if (optionBottom > visibleBottom) return optionBottom - viewportHeight;
	return scrollTop;
}
