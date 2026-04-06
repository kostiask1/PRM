import "../assets/components/StatusBadge.css";

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
			className={`StatusBadge ${completed ? "StatusBadge--done" : ""} ${className}`}
			onClick={onClick}>
			{label}
		</span>
	);
}
