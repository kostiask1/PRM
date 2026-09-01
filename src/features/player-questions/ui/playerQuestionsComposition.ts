import type { PlayerQuestionsRollContext } from "../model.ts";

export interface PlayerQuestionsDiceRollRequest {
	formula: string;
	context: { type: PlayerQuestionsRollContext };
}

export interface PlayerQuestionsRuntime {
	rolledResult: unknown;
	useSearchDebounce: boolean;
	requestDiceRoll(request: PlayerQuestionsDiceRollRequest): void;
}

export interface PlayerQuestionsModalContentProps {
	runtime: PlayerQuestionsRuntime;
}
