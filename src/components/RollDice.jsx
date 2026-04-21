import "../assets/components/RollDice.css";
import Tooltip from "./Tooltip";

export default function RollDice({ formula, children }) {
	const handleClick = (e) => {
		e.preventDefault();
		e.stopPropagation();
		window.dispatchEvent(new CustomEvent("rollDice", { detail: formula }));
	};

	return (
		<Tooltip content={`Кинути ${formula}`}>
			<span className="RollDice" onClick={handleClick}>
				{children || formula}
			</span>
		</Tooltip>
	);
}
