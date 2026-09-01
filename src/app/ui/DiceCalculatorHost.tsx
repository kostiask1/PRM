import { useCallback } from "react";
import {
	DiceCalculator,
	type DiceCalculatorProps,
} from "../../features/dice/index.js";
import { publishDiceResultAction } from "../../shared/model/index.js";
import { useAppDispatch, useAppSelector } from "../model/index.js";

type DicePublishResult = DiceCalculatorProps["publishResult"];

export default function DiceCalculatorHost() {
	const dispatch = useAppDispatch();
	const diceRollRequest = useAppSelector((state) => state.dice.rollRequest);
	const publishResult = useCallback<DicePublishResult>(
		(result, context) => {
			dispatch(publishDiceResultAction(result, context));
		},
		[dispatch],
	);

	return (
		<DiceCalculator
			diceRollRequest={diceRollRequest}
			publishResult={publishResult}
		/>
	);
}
