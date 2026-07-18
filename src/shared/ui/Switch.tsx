import "../../assets/components/Switch.css";
import type {
	ChangeEvent,
	InputHTMLAttributes,
	ReactNode,
} from "react";
import { classNames } from "../lib/index.js";

export interface SwitchProps
	extends Omit<
		InputHTMLAttributes<HTMLInputElement>,
		"checked" | "className" | "disabled" | "onChange" | "type"
	> {
	checked: boolean;
	onChange?: (checked: boolean) => void;
	label?: ReactNode;
	description?: ReactNode;
	disabled?: boolean;
	className?: string;
}

function OptionalSwitchText({
	value,
	className,
}: {
	value?: ReactNode;
	className: string;
}) {
	if (!value) return null;
	return <span className={className}>{value}</span>;
}

export default function Switch({
	checked,
	onChange,
	label,
	description,
	disabled = false,
	className = "",
	...props
}: SwitchProps) {
	const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
		event.stopPropagation();
		if (disabled) return;
			onChange?.(!checked);
	};

	return (
		<label
			className={classNames("Switch", className, {
				is_checked: checked,
				is_disabled: disabled,
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
				<OptionalSwitchText value={label} className="Switch__label" />
				<OptionalSwitchText
					value={description}
					className="Switch__description"
				/>
			</span>
		</label>
	);
}
