import "../../assets/components/Checkbox.css";
import type {
	InputHTMLAttributes,
	MouseEvent,
	ReactNode,
} from "react";
import Icon from "./Icon.tsx";
import Tooltip from "./Tooltip.tsx";
import { classNames } from "../lib/index.js";

export interface CheckboxProps
	extends Omit<
		InputHTMLAttributes<HTMLInputElement>,
		"checked" | "children" | "onChange" | "title" | "type"
	> {
	checked: boolean;
	onChange: (checked: boolean) => void;
	label?: ReactNode;
	title?: ReactNode;
}

export default function Checkbox({
	checked,
	onChange,
	label,
	className = "",
	title,
	...props
}: CheckboxProps) {
	const handleChange = (e: MouseEvent<HTMLLabelElement>) => {
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
