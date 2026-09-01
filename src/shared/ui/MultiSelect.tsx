import {
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";

import "../../assets/components/MultiSelect.css";
import { classNames } from "../lib/index.js";
import type { DropdownPortalStyle } from "./dropdownPortalModel.ts";
import Icon from "./Icon.tsx";
import MultiSelectDropdown from "./MultiSelectDropdown.tsx";
import {
	calculateMultiSelectDropdownStyle,
	getMultiSelectActiveScrollTarget,
	getMultiSelectLabel,
	getMultiSelectOptionAction,
	getMultiSelectSelectionState,
	toggleMultiSelectValue,
	type MultiSelectOption,
	type MultiSelectOptionClickMode,
	type MultiSelectValue,
} from "./multiSelectModel.ts";
import { useDropdownPortalLifecycle } from "./useDropdownPortalLifecycle.ts";

export interface MultiSelectProps<
	Value extends MultiSelectValue = MultiSelectValue,
> {
	value?: readonly Value[];
	options?: readonly MultiSelectOption<Value, ReactNode>[];
	onChange?: (values: Value[]) => void;
	onOptionClick?: ((value: Value) => void) | null;
	optionClickMode?: MultiSelectOptionClickMode;
	activeValue?: Value | "all" | "";
	allOptionLabel?: ReactNode;
	onAllOptionClick?: (() => void) | null;
	labelOverride?: ReactNode;
	className?: string;
	placeholder?: ReactNode;
	allSelectedLabel?: ReactNode;
	noneSelectedLabel?: ReactNode;
	selectAllLabel?: ReactNode;
	clearLabel?: ReactNode;
	disabled?: boolean;
	dropdownMinWidth?: number;
}

export default function MultiSelect<
	Value extends MultiSelectValue = MultiSelectValue,
>({
	value = [],
	options = [],
	onChange,
	onOptionClick = null,
	optionClickMode = "single",
	activeValue = "",
	allOptionLabel = "",
	onAllOptionClick = null,
	labelOverride = "",
	className = "",
	placeholder = "",
	allSelectedLabel = "",
	noneSelectedLabel = "",
	selectAllLabel = "",
	clearLabel = "",
	disabled = false,
	dropdownMinWidth = 240,
}: MultiSelectProps<Value>) {
	const [isOpen, setIsOpen] = useState(false);
	const [dropdownStyle, setDropdownStyle] =
		useState<DropdownPortalStyle>();
	const containerRef = useRef<HTMLDivElement>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const activeOptionRef = useRef<HTMLButtonElement>(null);

	const selection = useMemo(
		() => getMultiSelectSelectionState(options, value),
		[options, value],
	);
	const label = getMultiSelectLabel({
		selectedCount: selection.selectedCount,
		optionCount: options.length,
		labelOverride,
		placeholder,
		allSelectedLabel,
		noneSelectedLabel,
	});

	const updateDropdownPosition = useCallback(() => {
		const container = containerRef.current;
		if (!container) return;
		setDropdownStyle(
			calculateMultiSelectDropdownStyle(
				container.getBoundingClientRect(),
				{ width: window.innerWidth, height: window.innerHeight },
				dropdownMinWidth,
			),
		);
	}, [dropdownMinWidth]);

	useDropdownPortalLifecycle({
		isOpen,
		triggerRef: containerRef,
		dropdownRef,
		setIsOpen,
		updatePosition: updateDropdownPosition,
	});

	useEffect(() => {
		if (!isOpen) return;
		const frame = requestAnimationFrame(() => {
			if (getMultiSelectActiveScrollTarget(activeValue) === "top") {
				if (dropdownRef.current) dropdownRef.current.scrollTop = 0;
				return;
			}
			activeOptionRef.current?.scrollIntoView({
				block: "nearest",
				inline: "nearest",
			});
		});
		return () => cancelAnimationFrame(frame);
	}, [activeValue, isOpen]);

	const emitChange = (nextValues: Value[]) => {
		if (disabled || typeof onChange !== "function") return;
		onChange(nextValues);
	};

	const toggleOption = (optionValue: Value) => {
		emitChange(toggleMultiSelectValue(options, value, optionValue));
	};

	const handleOptionClick = (optionValue: Value) => {
		const action = getMultiSelectOptionAction({
			options,
			selectedValues: value,
			optionValue,
			mode: optionClickMode,
			hasOptionClickHandler: typeof onOptionClick === "function",
		});

		if (action.kind === "delegate") {
			onOptionClick?.(optionValue);
		} else {
			emitChange(action.values);
		}
		if (action.close) setIsOpen(false);
	};

	const dropdown =
		isOpen &&
		!disabled &&
		typeof document !== "undefined" &&
		createPortal(
			<MultiSelectDropdown
				dropdownRef={dropdownRef}
				activeOptionRef={activeOptionRef}
				dropdownStyle={dropdownStyle}
				options={options}
				selection={selection}
				activeValue={activeValue}
				allOptionLabel={allOptionLabel}
				selectAllLabel={selectAllLabel}
				clearLabel={clearLabel}
				onAllOptionSelect={() => {
					onAllOptionClick?.();
					setIsOpen(false);
				}}
				onSelectAll={() => emitChange(options.map((option) => option.value))}
				onClear={() => emitChange([])}
				onOptionClick={handleOptionClick}
				onOptionToggle={toggleOption}
			/>,
			document.body,
		);

	return (
		<>
			<div
				ref={containerRef}
				className={classNames("MultiSelect", className, {
					is_open: isOpen,
					is_disabled: disabled,
				})}
			>
				<button
					type="button"
					className="MultiSelect__trigger"
					onClick={() => {
						if (disabled) return;
						if (!isOpen) updateDropdownPosition();
						setIsOpen((current) => !current);
					}}
				>
					<span className="MultiSelect__label">
						{label || placeholder}
					</span>
					<Icon name="chevron" className="MultiSelect__icon" />
				</button>
			</div>
			{dropdown}
		</>
	);
}
