import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "../common/Icon";
import Button from "./Button";
import Checkbox from "./Checkbox";
import classNames from "../../utils/classNames";
import "../../assets/components/MultiSelect.css";

const DROPDOWN_OFFSET = 4;
const DROPDOWN_VIEWPORT_GAP = 8;
const DROPDOWN_MAX_HEIGHT = 340;

export default function MultiSelect({
	value = [],
	options = [],
	onChange,
	onOptionClick = null,
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
}) {
	const [isOpen, setIsOpen] = useState(false);
	const [dropdownStyle, setDropdownStyle] = useState({});
	const containerRef = useRef(null);
	const dropdownRef = useRef(null);

	const normalizedValue = useMemo(
		() => new Set((Array.isArray(value) ? value : []).map(String)),
		[value],
	);
	const selectedCount = options.filter((option) =>
		normalizedValue.has(String(option.value)),
	).length;
	const selectionLabel =
		selectedCount === options.length
			? allSelectedLabel || placeholder
			: selectedCount === 0
				? noneSelectedLabel || placeholder
				: `${selectedCount} / ${options.length}`;
	const label = labelOverride || selectionLabel;

	const updateDropdownPosition = useCallback(() => {
		if (!containerRef.current) return;
		const rect = containerRef.current.getBoundingClientRect();
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;
		const width = Math.min(
			Math.max(rect.width, dropdownMinWidth),
			viewportWidth - DROPDOWN_VIEWPORT_GAP * 2,
		);
		const left = Math.min(
			Math.max(DROPDOWN_VIEWPORT_GAP, rect.left),
			viewportWidth - width - DROPDOWN_VIEWPORT_GAP,
		);
		const spaceBelow = viewportHeight - rect.bottom - DROPDOWN_VIEWPORT_GAP;
		const spaceAbove = rect.top - DROPDOWN_VIEWPORT_GAP;
		const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
		const maxHeight = Math.max(
			120,
			Math.min(DROPDOWN_MAX_HEIGHT, openUp ? spaceAbove : spaceBelow),
		);

		setDropdownStyle({
			position: "fixed",
			left,
			width,
			maxHeight,
			...(openUp
				? { bottom: viewportHeight - rect.top + DROPDOWN_OFFSET }
				: { top: rect.bottom + DROPDOWN_OFFSET }),
		});
	}, [dropdownMinWidth]);

	useEffect(() => {
		const handleClickOutside = (event) => {
			const clickedInsideTrigger =
				containerRef.current && containerRef.current.contains(event.target);
			const clickedInsideDropdown =
				dropdownRef.current && dropdownRef.current.contains(event.target);
			if (!clickedInsideTrigger && !clickedInsideDropdown) {
				setIsOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	useEffect(() => {
		if (!isOpen) return undefined;
		updateDropdownPosition();
		window.addEventListener("resize", updateDropdownPosition);
		window.addEventListener("scroll", updateDropdownPosition, true);
		return () => {
			window.removeEventListener("resize", updateDropdownPosition);
			window.removeEventListener("scroll", updateDropdownPosition, true);
		};
	}, [isOpen, updateDropdownPosition]);

	const emitChange = (nextValues) => {
		if (disabled || typeof onChange !== "function") return;
		onChange(nextValues);
	};

	const toggleOption = (optionValue) => {
		const stringValue = String(optionValue);
		const next = new Set(normalizedValue);
		if (next.has(stringValue)) next.delete(stringValue);
		else next.add(stringValue);
		emitChange(
			options
				.filter((option) => next.has(String(option.value)))
				.map((option) => option.value),
		);
	};

	const handleOptionClick = (optionValue) => {
		if (typeof onOptionClick === "function") {
			onOptionClick(optionValue);
			setIsOpen(false);
			return;
		}
		emitChange(
			options
				.filter((option) => String(option.value) === String(optionValue))
				.map((option) => option.value),
		);
		setIsOpen(false);
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
						className={classNames("MultiSelect__option", {
							is_active_filter: activeValue === "all" || !activeValue,
						})}
						onClick={() => {
							onAllOptionClick?.();
							setIsOpen(false);
						}}
					>
						<span className="MultiSelect__optionSpacer" />
						<span className="MultiSelect__optionLabel">{allOptionLabel}</span>
					</button>
				)}
				<div className="MultiSelect__actions">
					<Button
						variant="ghost"
						size={Button.SIZES.SMALL}
						onClick={() => emitChange(options.map((option) => option.value))}
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
					const isSelected = normalizedValue.has(optionValue);
					return (
						<button
							key={optionValue}
							type="button"
							className={classNames("MultiSelect__option", {
								is_selected: isSelected,
								is_active_filter:
									activeValue && String(activeValue) === optionValue,
							})}
							onClick={() => handleOptionClick(option.value)}
						>
							<Checkbox
								checked={isSelected}
								onChange={() => toggleOption(option.value)}
								className="MultiSelect__checkbox"
							/>
							<span className="MultiSelect__optionLabel">{option.label}</span>
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
					<span className="MultiSelect__label">{label || placeholder}</span>
					<Icon name="chevron" className="MultiSelect__icon" />
				</button>
			</div>
			{dropdown}
		</>
	);
}
