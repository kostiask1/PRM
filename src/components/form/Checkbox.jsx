import "../../assets/components/Checkbox.css";
import Tooltip from "../common/Tooltip";
import classNames from "../../utils/classNames";

export default function Checkbox({
	checked,
	onChange,
	label,
	className = "",
	title,
	...props
}) {
	const handleChange = (e) => {
		e.preventDefault();
		e.stopPropagation();

		onChange(!checked);
	};
	const checkboxNode = (
		<label
			className={classNames("Checkbox", className, { "is-checked": checked })}
			onClick={handleChange}
		>
			<input type="checkbox" checked={checked} readOnly {...props} />
			<div className="Checkbox__indicator" />
			{label && <span className="Checkbox__label">{label}</span>}
		</label>
	);

	if (title) {
		return <Tooltip content={title}>{checkboxNode}</Tooltip>;
	}

	return checkboxNode;
}
