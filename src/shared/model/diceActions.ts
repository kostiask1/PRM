import type { RequestId } from "./contracts.ts";

export const REQUEST_DICE_ROLL = "dice/requestRoll";
export const PUBLISH_DICE_RESULT = "dice/publishResult";

export interface DiceRollRequest<TData = unknown> {
	requestId: RequestId;
	data: TData;
}

export interface PublishedDiceResult<TResult = unknown, TContext = unknown> {
	resultId: RequestId;
	result: TResult;
	context: TContext | null;
}

export type DiceAction<TData = unknown, TResult = unknown, TContext = unknown> =
	| {
			type: typeof REQUEST_DICE_ROLL;
			payload: DiceRollRequest<TData>;
	  }
	| {
			type: typeof PUBLISH_DICE_RESULT;
			payload: PublishedDiceResult<TResult, TContext>;
	  };

let diceRollRequestSeq: RequestId = 1;
let diceRollResultSeq: RequestId = 1;

export function requestDiceRollAction<TData>(
	payload: TData,
): DiceAction<TData> {
	return {
		type: REQUEST_DICE_ROLL,
		payload: {
			requestId: diceRollRequestSeq++,
			data: payload,
		},
	};
}

export function publishDiceResultAction<TResult, TContext = unknown>(
	result: TResult,
	context: TContext | null = null,
): DiceAction<unknown, TResult, TContext> {
	return {
		type: PUBLISH_DICE_RESULT,
		payload: {
			resultId: diceRollResultSeq++,
			result,
			context,
		},
	};
}
