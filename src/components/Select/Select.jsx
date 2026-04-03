import React from "react";
import "./Select.css";

export default function Select({ value, onChange, children, className = "", ...props }) {
	return (
		<select
			className={`Select ${className}`}
			value={value}
			onChange={onChange}
			{...props}>
			{children}
		</select>
	);
}