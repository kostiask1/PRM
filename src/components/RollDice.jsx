import "../assets/components/RollDice.css";
import Tooltip from "./common/Tooltip";
import { requestDiceRollAction } from "../actions/app";
import { useAppDispatch } from "../store/appStore";
import { lang } from "../services/localization";

export default function RollDice({ formula, children }) {
	const dispatch = useAppDispatch();
	const handleClick = (e) => {
		e.preventDefault();
		e.stopPropagation();
		dispatch(requestDiceRollAction(formula));
	};

	return (
		<Tooltip content={lang.t("Roll {formula}", { formula })}>
			<span className="RollDice" onClick={handleClick}>
				{children || formula}
			</span>
		</Tooltip>
	);
}
