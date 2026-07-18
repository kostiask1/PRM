import type { MouseEventHandler } from "react";

import "../../../assets/components/StatusBadge.css";
import { classNames, lang } from "../../../shared/lib/index.js";

export interface StatusBadgeProps {
	completed: boolean;
	onClick?: MouseEventHandler<HTMLSpanElement>;
	className?: string;
}

export default function StatusBadge({
	completed,
	onClick,
	className = "",
}: StatusBadgeProps) {
	const label = completed ? lang.t("Completed") : lang.t("Active");

	return (
		<span
			className={classNames("StatusBadge", className, {
				StatusBadge__done: completed,
			})}
			onClick={onClick}
		>
			{label}
		</span>
	);
}
