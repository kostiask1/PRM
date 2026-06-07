import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Icon from "../common/Icon";
import "../../assets/components/Select.css";
import classNames from "../../utils/classNames";

const DROPDOWN_OFFSET = 4;
const DROPDOWN_VIEWPORT_GAP = 8;
const DROPDOWN_MAX_HEIGHT = 300;

export default function Select({
	value,
	onChange,
	children,
	className = "",
	disabled = false,
	dropdownMinWidth = 180,
	...props
}) {
	const [isOpen, setIsOpen] = useState(false);
	const [dropdownStyle, setDropdownStyle] = useState({});
	const containerRef = useRef(null);
	const dropdownRef = useRef(null);
	const selectedOptionRef = useRef(null);

	const options =
		React.Children.map(children, (child) => {
			if (!child) return null;
			return {
				value: child.props.value,
				label: child.props.children,
			};
		})?.filter(Boolean) || [];

	const selectedOption =
		options.find((opt) => opt.value === value) || options[0];

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

		if (openUp) {
			setDropdownStyle({
				position: "fixed",
				left,
				bottom: viewportHeight - rect.top + DROPDOWN_OFFSET,
				width,
				maxHeight,
			});
			return;
		}

		setDropdownStyle({
			position: "fixed",
			left,
			top: rect.bottom + DROPDOWN_OFFSET,
			width,
			maxHeight,
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
		if (!isOpen) return;
		updateDropdownPosition();
		window.addEventListener("resize", updateDropdownPosition);
		window.addEventListener("scroll", updateDropdownPosition, true);
		return () => {
			window.removeEventListener("resize", updateDropdownPosition);
			window.removeEventListener("scroll", updateDropdownPosition, true);
		};
	}, [isOpen, updateDropdownPosition]);

	const handleSelect = (val) => {
		if (disabled || typeof onChange !== "function") return;
		onChange({ target: { value: val } });
		setIsOpen(false);
	};

	const scrollSelectedOptionIntoView = useCallback(() => {
		const dropdown = dropdownRef.current;
		const selectedOption = selectedOptionRef.current;
		if (!dropdown || !selectedOption) return;

		const optionTop = selectedOption.offsetTop;
		const optionBottom = optionTop + selectedOption.offsetHeight;
		const visibleTop = dropdown.scrollTop;
		const visibleBottom = visibleTop + dropdown.clientHeight;

		if (optionTop < visibleTop) {
			dropdown.scrollTop = optionTop;
		} else if (optionBottom > visibleBottom) {
			dropdown.scrollTop = optionBottom - dropdown.clientHeight;
		}
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
				{options.map((opt) => (
					<div
						key={opt.value}
						ref={opt.value === value ? selectedOptionRef : null}
						className={classNames("Select__option", {
							is_selected: opt.value === value,
						})}
						onClick={() => handleSelect(opt.value)}
					>
						{opt.label}
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
						setIsOpen((prev) => !prev);
					}}
				>
					<span className="Select__label">{selectedOption?.label}</span>
					<Icon name="chevron" className="Select__icon" />
				</div>
			</div>
			{renderDropdown}
		</>
	);
}
