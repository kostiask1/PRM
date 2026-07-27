export const REQUEST_DICE_ROLL = "dice/requestRoll";
export const PUBLISH_DICE_RESULT = "dice/publishResult";

let diceRollRequestSeq = 1;
let diceRollResultSeq = 1;

export function requestDiceRollAction(payload) {
	return {
		type: REQUEST_DICE_ROLL,
		payload: {
			requestId: diceRollRequestSeq++,
			data: payload,
		},
	};
}

export function publishDiceResultAction(result, context = null) {
	return {
		type: PUBLISH_DICE_RESULT,
		payload: {
			resultId: diceRollResultSeq++,
			result,
			context,
		},
	};
}
