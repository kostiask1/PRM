import type { ReactNode, RefObject } from "react";

import { classNames } from "../lib/index.js";
import Button from "./Button.tsx";
import Checkbox from "./Checkbox.tsx";
import type { DropdownPortalStyle } from "./dropdownPortalModel.ts";
import {
	getMultiSelectOptionPresentation,
	type MultiSelectOption,
	type MultiSelectSelectionState,
	type MultiSelectValue,
} from "./multiSelectModel.ts";

interface MultiSelectDropdownProps<Value extends MultiSelectValue> {
	dropdownRef: RefObject<HTMLDivElement>;
	activeOptionRef: RefObject<HTMLButtonElement>;
	dropdownStyle: DropdownPortalStyle | undefined;
	options: readonly MultiSelectOption<Value, ReactNode>[];
	selection: MultiSelectSelectionState;
	activeValue: Value | "all" | "";
	allOptionLabel: ReactNode;
	selectAllLabel: ReactNode;
	clearLabel: ReactNode;
	onAllOptionSelect: () => void;
	onSelectAll: () => void;
	onClear: () => void;
	onOptionClick: (value: Value) => void;
	onOptionToggle: (value: Value) => void;
}

export default function MultiSelectDropdown<
	Value extends MultiSelectValue,
>({
	dropdownRef,
	activeOptionRef,
	dropdownStyle,
	options,
	selection,
	activeValue,
	allOptionLabel,
	selectAllLabel,
	clearLabel,
	onAllOptionSelect,
	onSelectAll,
	onClear,
	onOptionClick,
	onOptionToggle,
}: MultiSelectDropdownProps<Value>) {
	const isAllOptionActive = activeValue === "all" || !activeValue;
	return (
		<div
			ref={dropdownRef}
			className="MultiSelect__dropdown MultiSelect__dropdown__portal"
			style={dropdownStyle}
		>
			{allOptionLabel && (
				<button
					type="button"
					ref={isAllOptionActive ? activeOptionRef : null}
					className={classNames("MultiSelect__option", {
						is_active_filter: isAllOptionActive,
					})}
					onClick={onAllOptionSelect}
				>
					<span className="MultiSelect__optionSpacer" />
					<span className="MultiSelect__optionLabel">
						{allOptionLabel}
					</span>
				</button>
			)}
			<div className="MultiSelect__actions">
				<Button variant="ghost" size={Button.SIZES.SMALL} onClick={onSelectAll}>
					{selectAllLabel}
				</Button>
				<Button variant="ghost" size={Button.SIZES.SMALL} onClick={onClear}>
					{clearLabel}
				</Button>
			</div>
			{options.map((option) => {
				const { optionKey, isSelected, isActive } =
					getMultiSelectOptionPresentation(
						option.value,
						selection,
						activeValue,
					);
				return (
					<button
						key={optionKey}
						type="button"
						ref={isActive ? activeOptionRef : null}
						className={classNames("MultiSelect__option", {
							is_selected: isSelected,
							is_active_filter: isActive,
						})}
						onClick={() => onOptionClick(option.value)}
					>
						<Checkbox
							checked={isSelected}
							onChange={() => onOptionToggle(option.value)}
							className="MultiSelect__checkbox"
						/>
						<span className="MultiSelect__optionLabel">
							{option.label}
						</span>
					</button>
				);
			})}
		</div>
	);
}
