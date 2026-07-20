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

export interface MultiSelectLabelInput<Label> {
	selectedCount: number;
	optionCount: number;
	labelOverride: Label;
	placeholder: Label;
	allSelectedLabel: Label;
	noneSelectedLabel: Label;
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

export function getMultiSelectLabel<Label>({
	selectedCount,
	optionCount,
	labelOverride,
	placeholder,
	allSelectedLabel,
	noneSelectedLabel,
}: MultiSelectLabelInput<Label>): Label | string {
	if (labelOverride) return labelOverride;
	if (selectedCount === optionCount) return allSelectedLabel || placeholder;
	if (selectedCount === 0) return noneSelectedLabel || placeholder;
	return `${selectedCount} / ${optionCount}`;
}

export function getMultiSelectOptionPresentation(
	optionValue: MultiSelectValue,
	selection: MultiSelectSelectionState,
	activeValue: MultiSelectValue | "all" | "",
): { optionKey: string; isSelected: boolean; isActive: boolean } {
	const optionKey = String(optionValue);
	return {
		optionKey,
		isSelected: selection.normalizedValues.has(optionKey),
		isActive: Boolean(activeValue) && String(activeValue) === optionKey,
	};
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
