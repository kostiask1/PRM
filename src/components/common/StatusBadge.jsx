import "../../assets/components/StatusBadge.css";
import classNames from "../../utils/classNames";

export default function StatusBadge({
	completed,
	onClick,
	className = "",
	type = "campaign",
}) {
	let label = "";
	if (completed) {
		label = `Завершена`;
	} else {
		label = type === "campaign" ? "Активна" : "В підготовці";
	}

	return (
		<span
			className={classNames("StatusBadge", className, {
				"StatusBadge--done": completed,
			})}
			onClick={onClick}>
			{label}
		</span>
	);
}
