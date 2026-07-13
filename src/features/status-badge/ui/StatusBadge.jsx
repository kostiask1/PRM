import "../../../assets/components/StatusBadge.css";
import { classNames } from "../../../shared/lib/index.js";
import { lang } from "../../../shared/lib/index.js";

export default function StatusBadge({ completed, onClick, className = "" }) {
	let label = "";
	if (completed) {
		label = lang.t("Completed");
	} else {
		label = lang.t("Active");
	}

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
