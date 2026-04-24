import "../../assets/components/Switch.css";
import classNames from "../../utils/classNames";

export default function Switch({
	checked,
	onChange,
	label,
	description,
	disabled = false,
	className = "",
	...props
}) {
	const handleChange = (event) => {
		event.stopPropagation();
		if (disabled) return;
		onChange?.(!checked);
	};

	return (
		<label
			className={classNames("Switch", className, {
				"is-checked": checked,
				"is-disabled": disabled,
			})}
		>
			<input
				type="checkbox"
				checked={checked}
				onChange={handleChange}
				disabled={disabled}
				{...props}
			/>
			<span className="Switch__track" aria-hidden="true">
				<span className="Switch__thumb" />
			</span>
			<span className="Switch__content">
				{label && <span className="Switch__label">{label}</span>}
				{description && <span className="Switch__description">{description}</span>}
			</span>
		</label>
	);
}
