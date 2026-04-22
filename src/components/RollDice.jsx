import "../assets/components/RollDice.css";
import Tooltip from "./common/Tooltip";
import { requestDiceRollAction } from "../actions/app";
import { useAppDispatch } from "../store/appStore";

export default function RollDice({ formula, children }) {
	const dispatch = useAppDispatch();
	const handleClick = (e) => {
		e.preventDefault();
		e.stopPropagation();
		dispatch(requestDiceRollAction(formula));
	};

	return (
		<Tooltip content={`Кинути ${formula}`}>
			<span className="RollDice" onClick={handleClick}>
				{children || formula}
			</span>
		</Tooltip>
	);
}
