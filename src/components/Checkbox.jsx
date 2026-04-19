import "../assets/components/Checkbox.css";

export default function Checkbox({
	checked,
	onChange,
	label,
	className = "",
	...props
}) {
	const handleChange = (e) => {
		e.preventDefault();
		e.stopPropagation();

		onChange(!checked);
	};
	return (
		<label className={`Checkbox ${className} ${checked ? "is-checked" : ""}`} onClick={handleChange}>
			<input
				type="checkbox"
				checked={checked}
				readOnly
				{...props}
			/>
			<div className="Checkbox__indicator" />
			{label && <span className="Checkbox__label">{label}</span>}
		</label>
	);
}
