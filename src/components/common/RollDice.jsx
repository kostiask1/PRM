import { requestDiceRollAction } from "../../shared/model/index.js";
import "../../assets/components/RollDice.css";
import { lang } from "../../shared/config/index.js";
import { useAppDispatch } from "../../shared/lib/index.js";
import Tooltip from "./Tooltip";

export default function RollDice({ formula, children, context = null }) {
	const dispatch = useAppDispatch();
	const handleClick = (e) => {
		e.preventDefault();
		e.stopPropagation();
		dispatch(
			requestDiceRollAction(
				context
					? {
							formula: formula.replace(/×/g, "*"),
							context,
						}
					: formula.replace(/×/g, "*"),
			),
		);
	};

	return (
		<Tooltip content={lang.t("Roll {formula}", { formula })}>
			<span className="RollDice" onClick={handleClick}>
				{children || formula}
			</span>
		</Tooltip>
	);
}
