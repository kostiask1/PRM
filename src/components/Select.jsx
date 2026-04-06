import React, { useState, useRef, useEffect } from "react";
import Icon from "./Icon";
import "../assets/components/Select.css";

export default function Select({
	value,
	onChange,
	children,
	className = "",
	...props
}) {
	const [isOpen, setIsOpen] = useState(false);
	const containerRef = useRef(null);

	// Витягуємо дані з children (очікуємо <option>)
	const options = React.Children.map(children, (child) => {
		if (!child) return null;
		return {
			value: child.props.value,
			label: child.props.children,
		};
	}).filter(Boolean);

	const selectedOption =
		options.find((opt) => opt.value === value) || options[0];

	useEffect(() => {
		const handleClickOutside = (event) => {
			if (
				containerRef.current &&
				!containerRef.current.contains(event.target)
			) {
				setIsOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const handleSelect = (val) => {
		// Імітуємо подію для сумісності з існуючими onChange
		onChange({ target: { value: val } });
		setIsOpen(false);
	};

	return (
		<div
			className={`Select ${className} ${isOpen ? "is-open" : ""}`}
			ref={containerRef}
			{...props}>
			<div className="Select__trigger" onClick={() => setIsOpen(!isOpen)}>
				<span className="Select__label">{selectedOption?.label}</span>
				<Icon name="chevron" className="Select__icon" />
			</div>
			{isOpen && (
				<div className="Select__dropdown">
					{options.map((opt) => (
						<div
							key={opt.value}
							className={`Select__option ${opt.value === value ? "is-selected" : ""}`}
							onClick={() => handleSelect(opt.value)}>
							{opt.label}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
