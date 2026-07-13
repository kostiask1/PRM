import "../../assets/components/Checkbox.css";
import Icon from "./Icon.jsx";
import Tooltip from "./Tooltip.jsx";
import { classNames } from "../lib/index.js";

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
			className={classNames("Checkbox", className, { is_checked: checked })}
			onClick={handleChange}
		>
			<input type="checkbox" checked={checked} readOnly {...props} />
			<div className="Checkbox__indicator">
				<Icon
					name="check"
					size={14}
					strokeWidth={3}
					className="Checkbox__icon"
				/>
			</div>
			{label && <span className="Checkbox__label">{label}</span>}
		</label>
	);

	if (title) {
		return <Tooltip content={title}>{checkboxNode}</Tooltip>;
	}

	return checkboxNode;
}
