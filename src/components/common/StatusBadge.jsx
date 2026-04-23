import "../../assets/components/StatusBadge.css";
import classNames from "../../utils/classNames";
import { lang } from "../../services/localization";

export default function StatusBadge({
	completed,
	onClick,
	className = "",
	type = "campaign",
}) {
	let label = "";
	if (completed) {
		label = lang.t("Completed");
	} else {
		label =
			type === "campaign"
				? lang.t("Active")
				: lang.t("In preparation");
	}

	return (
		<span
			className={classNames("StatusBadge", className, {
				"StatusBadge--done": completed,
			})}
			onClick={onClick}
		>
			{label}
		</span>
	);
}
