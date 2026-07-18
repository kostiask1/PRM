import {
	calculateDropdownPortalStyle,
	type DropdownAnchorRect,
	type DropdownPortalStyle,
	type DropdownViewport,
} from "./dropdownPortalModel.ts";

const MULTI_SELECT_DROPDOWN_MAX_HEIGHT = 340;

export type MultiSelectValue = string | number;
export type MultiSelectOptionClickMode = "single" | "toggle";

export interface MultiSelectOption<
	Value extends MultiSelectValue = MultiSelectValue,
	Label = unknown,
> {
	value: Value;
	label: Label;
}

export interface MultiSelectSelectionState {
	normalizedValues: Set<string>;
	selectedCount: number;
}

export type MultiSelectOptionAction<Value extends MultiSelectValue> =
	| { kind: "delegate"; close: true }
	| { kind: "change"; close: boolean; values: Value[] };

export function getMultiSelectSelectionState<
	Value extends MultiSelectValue,
>(
	options: readonly MultiSelectOption<Value>[],
	selectedValues: readonly Value[],
): MultiSelectSelectionState {
	const normalizedValues = new Set(selectedValues.map(String));
	const selectedCount = options.filter((option) =>
		normalizedValues.has(String(option.value)),
	).length;

	return { normalizedValues, selectedCount };
}

export function toggleMultiSelectValue<Value extends MultiSelectValue>(
	options: readonly MultiSelectOption<Value>[],
	selectedValues: readonly Value[],
	optionValue: Value,
): Value[] {
	const nextValues = new Set(selectedValues.map(String));
	const normalizedOptionValue = String(optionValue);
	if (nextValues.has(normalizedOptionValue)) {
		nextValues.delete(normalizedOptionValue);
	} else {
		nextValues.add(normalizedOptionValue);
	}

	return options
		.filter((option) => nextValues.has(String(option.value)))
		.map((option) => option.value);
}

export function selectOnlyMultiSelectValue<Value extends MultiSelectValue>(
	options: readonly MultiSelectOption<Value>[],
	optionValue: Value,
): Value[] {
	return options
		.filter((option) => String(option.value) === String(optionValue))
		.map((option) => option.value);
}

export function getMultiSelectOptionAction<Value extends MultiSelectValue>({
	options,
	selectedValues,
	optionValue,
	mode,
	hasOptionClickHandler,
}: {
	options: readonly MultiSelectOption<Value>[];
	selectedValues: readonly Value[];
	optionValue: Value;
	mode: MultiSelectOptionClickMode;
	hasOptionClickHandler: boolean;
}): MultiSelectOptionAction<Value> {
	if (hasOptionClickHandler) return { kind: "delegate", close: true };
	if (mode === "toggle") {
		return {
			kind: "change",
			close: false,
			values: toggleMultiSelectValue(
				options,
				selectedValues,
				optionValue,
			),
		};
	}

	return {
		kind: "change",
		close: true,
		values: selectOnlyMultiSelectValue(options, optionValue),
	};
}

export function getMultiSelectActiveScrollTarget(
	activeValue: MultiSelectValue | undefined,
): "active" | "top" {
	return activeValue && activeValue !== "all" ? "active" : "top";
}

export function calculateMultiSelectDropdownStyle(
	rect: DropdownAnchorRect,
	viewport: DropdownViewport,
	dropdownMinWidth: number,
): DropdownPortalStyle {
	return calculateDropdownPortalStyle({
		rect,
		viewport,
		minWidth: dropdownMinWidth,
		maxHeight: MULTI_SELECT_DROPDOWN_MAX_HEIGHT,
	});
}
