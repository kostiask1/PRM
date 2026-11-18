import type { ReactNode } from "react";
import { classNames, lang } from "../lib/index.js";
import Icon, { type IconName } from "./Icon.tsx";
import "../../assets/components/NoteViewMode.css";

export interface NoteViewModeOption<Value extends string | boolean = boolean> {
	value: Value;
	label: ReactNode;
	title?: string;
	icon?: IconName;
}

export interface NoteViewModeProps<Value extends string | boolean = boolean> {
	value: Value;
	onChange: (value: Value) => void;
	options?: readonly NoteViewModeOption<Value>[];
	ariaLabel?: string;
	className?: string;
}

/**
 * Renders a segmented control for switching note display modes.
 */
export default function NoteViewMode<Value extends string | boolean = boolean>({
	value,
	onChange,
	options,
	ariaLabel = lang.t("Notes display mode"),
	className = "",
}: NoteViewModeProps<Value>) {
	const resolvedOptions = (options ?? [
		{ value: true, label: lang.t("All notes") },
		{ value: false, label: lang.t("One note") },
	]) as readonly NoteViewModeOption<Value>[];

	return (
		<div
			className={classNames("NoteViewMode", className)}
			role="group"
			aria-label={ariaLabel}
		>
			{resolvedOptions.map((option) => (
				<button
					key={String(option.value)}
					type="button"
					aria-pressed={value === option.value}
					onClick={() => onChange(option.value)}
					title={option.title}
				>
					{option.icon && <Icon name={option.icon} size={14} />}
					{option.label}
				</button>
			))}
		</div>
	);
}
