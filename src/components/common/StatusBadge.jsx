import "../../assets/components/StatusBadge.css";
import classNames from "../../shared/lib/classNames.js";
import { lang } from "../../shared/config/index.js";

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
