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
import Button from "./Button.tsx";
import Checkbox from "./Checkbox.tsx";
import type { DropdownPortalStyle } from "./dropdownPortalModel.ts";
import Icon from "./Icon.tsx";
import {
	calculateMultiSelectDropdownStyle,
	getMultiSelectActiveScrollTarget,
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
	const selectionLabel =
		selection.selectedCount === options.length
			? allSelectedLabel || placeholder
			: selection.selectedCount === 0
				? noneSelectedLabel || placeholder
				: `${selection.selectedCount} / ${options.length}`;
	const label = labelOverride || selectionLabel;

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
			<div
				ref={dropdownRef}
				className="MultiSelect__dropdown MultiSelect__dropdown__portal"
				style={dropdownStyle}
			>
				{allOptionLabel && (
					<button
						type="button"
						ref={
							activeValue === "all" || !activeValue
								? activeOptionRef
								: null
						}
						className={classNames("MultiSelect__option", {
							is_active_filter: activeValue === "all" || !activeValue,
						})}
						onClick={() => {
							onAllOptionClick?.();
							setIsOpen(false);
						}}
					>
						<span className="MultiSelect__optionSpacer" />
						<span className="MultiSelect__optionLabel">
							{allOptionLabel}
						</span>
					</button>
				)}
				<div className="MultiSelect__actions">
					<Button
						variant="ghost"
						size={Button.SIZES.SMALL}
						onClick={() =>
							emitChange(options.map((option) => option.value))
						}
					>
						{selectAllLabel}
					</Button>
					<Button
						variant="ghost"
						size={Button.SIZES.SMALL}
						onClick={() => emitChange([])}
					>
						{clearLabel}
					</Button>
				</div>
				{options.map((option) => {
					const optionValue = String(option.value);
					const isSelected =
						selection.normalizedValues.has(optionValue);
					const isActive =
						Boolean(activeValue) &&
						String(activeValue) === optionValue;
					return (
						<button
							key={optionValue}
							type="button"
							ref={isActive ? activeOptionRef : null}
							className={classNames("MultiSelect__option", {
								is_selected: isSelected,
								is_active_filter: isActive,
							})}
							onClick={() => handleOptionClick(option.value)}
						>
							<Checkbox
								checked={isSelected}
								onChange={() => toggleOption(option.value)}
								className="MultiSelect__checkbox"
							/>
							<span className="MultiSelect__optionLabel">
								{option.label}
							</span>
						</button>
					);
				})}
			</div>,
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
