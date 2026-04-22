import "../assets/components/RollDice.css";
import Tooltip from "./Tooltip";
import { DICE_ROLL_EVENT } from "../utils/diceEvents";

export default function RollDice({ formula, children }) {
	const handleClick = (e) => {
		e.preventDefault();
		e.stopPropagation();
		window.dispatchEvent(new CustomEvent(DICE_ROLL_EVENT, { detail: formula }));
	};

	return (
		<Tooltip content={`Кинути ${formula}`}>
			<span className="RollDice" onClick={handleClick}>
				{children || formula}
			</span>
		</Tooltip>
	);
}
