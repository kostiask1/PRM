import React, {
	type HTMLAttributes,
	type OptionHTMLAttributes,
	type ReactElement,
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";

import "../../assets/components/Select.css";
import { classNames } from "../lib/index.js";
import Icon from "./Icon.tsx";
import {
	calculateSelectDropdownStyle,
	createSelectChangeEvent,
	getSelectedOption,
	getSelectScrollTop,
	type SelectChangeEvent,
	type SelectDropdownStyle,
	type SelectOption,
	type SelectValue,
} from "./selectModel.ts";
import { useDropdownPortalLifecycle } from "./useDropdownPortalLifecycle.ts";

type SelectOptionElement<Value extends SelectValue> = ReactElement<
	OptionHTMLAttributes<HTMLOptionElement> & { value: Value }
>;

export interface SelectProps<Value extends SelectValue = SelectValue>
	extends Omit<HTMLAttributes<HTMLDivElement>, "children" | "onChange"> {
	value: Value;
	onChange?: (event: SelectChangeEvent<Value>) => void;
	children: ReactNode;
	disabled?: boolean;
	dropdownMinWidth?: number;
}

export default function Select<Value extends SelectValue = SelectValue>({
	value,
	onChange,
	children,
	className = "",
	disabled = false,
	dropdownMinWidth = 180,
	...props
}: SelectProps<Value>) {
	const [isOpen, setIsOpen] = useState(false);
	const [dropdownStyle, setDropdownStyle] =
		useState<SelectDropdownStyle>();
	const containerRef = useRef<HTMLDivElement>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const selectedOptionRef = useRef<HTMLDivElement>(null);

	const options =
		React.Children.map(children, (child): SelectOption<Value> | null => {
			if (!React.isValidElement(child)) return null;
			const option = child as SelectOptionElement<Value>;
			return {
				value: option.props.value,
				label: option.props.children,
			};
		})?.filter((option): option is SelectOption<Value> => option !== null) ?? [];

	const selectedOption = getSelectedOption(options, value);

	const updateDropdownPosition = useCallback(() => {
		const container = containerRef.current;
		if (!container) return;

		setDropdownStyle(
			calculateSelectDropdownStyle(
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

	const handleSelect = (nextValue: Value) => {
		if (disabled || typeof onChange !== "function") return;
		onChange(createSelectChangeEvent(nextValue));
		setIsOpen(false);
	};

	const scrollSelectedOptionIntoView = useCallback(() => {
		const dropdown = dropdownRef.current;
		const selected = selectedOptionRef.current;
		if (!dropdown || !selected) return;

		dropdown.scrollTop = getSelectScrollTop({
			optionTop: selected.offsetTop,
			optionHeight: selected.offsetHeight,
			scrollTop: dropdown.scrollTop,
			viewportHeight: dropdown.clientHeight,
		});
	}, []);

	useEffect(() => {
		if (!isOpen) return;
		const frame = requestAnimationFrame(scrollSelectedOptionIntoView);
		return () => cancelAnimationFrame(frame);
	}, [isOpen, scrollSelectedOptionIntoView, value]);

	const renderDropdown =
		isOpen &&
		!disabled &&
		typeof document !== "undefined" &&
		createPortal(
			<div
				ref={dropdownRef}
				className="Select__dropdown Select__dropdown__portal"
				style={dropdownStyle}
			>
				{options.map((option) => (
					<div
						key={option.value}
						ref={option.value === value ? selectedOptionRef : null}
						className={classNames("Select__option", {
							is_selected: option.value === value,
						})}
						onClick={() => handleSelect(option.value)}
					>
						{option.label as ReactNode}
					</div>
				))}
			</div>,
			document.body,
		);

	return (
		<>
			<div
				className={classNames("Select", className, {
					is_open: isOpen,
					is_disabled: disabled,
				})}
				ref={containerRef}
				{...props}
			>
				<div
					className="Select__trigger"
					onClick={() => {
						if (disabled) return;
						if (!isOpen) updateDropdownPosition();
						setIsOpen((previous) => !previous);
					}}
				>
					<span className="Select__label">
						{selectedOption?.label as ReactNode}
					</span>
					<Icon name="chevron" className="Select__icon" />
				</div>
			</div>
			{renderDropdown}
		</>
	);
}
