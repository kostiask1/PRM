export const QUESTION_ROLL_CONTEXT = "playerQuestions";
export type PlayerQuestionsRollContext = typeof QUESTION_ROLL_CONTEXT;
export const STANDARD_QUESTION_DICE = [100, 20, 12, 10, 8, 6, 4] as const;

interface UnknownRecord {
	[key: string]: unknown;
}

export interface QuestionDiceRoll {
	resultId: unknown;
	questionId: number | null;
}

function isRecord(value: unknown): value is UnknownRecord {
	return typeof value === "object" && value !== null;
}

export function getDiceResultId(value: unknown): unknown {
	return isRecord(value) ? (value.resultId ?? null) : null;
}

function getQuestionRollResult(value: unknown): UnknownRecord | null {
	if (!isRecord(value) || !value.resultId) return null;
	return value;
}

function isQuestionRollContext(value: unknown): boolean {
	return isRecord(value) && value.type === QUESTION_ROLL_CONTEXT;
}

function normalizeRolledQuestionId(
	value: unknown,
	questionCount: number,
): number | null {
	const questionId = Number(value);
	return Number.isInteger(questionId) &&
		questionId >= 1 &&
		questionId <= questionCount
		? questionId
		: null;
}

function getRolledQuestionId(
	value: UnknownRecord,
	questionCount: number,
): number | null {
	if (!isQuestionRollContext(value.context)) return null;
	const result = isRecord(value.result) ? value.result : null;
	return normalizeRolledQuestionId(result?.total, questionCount);
}

export function getQuestionDiceRoll(
	value: unknown,
	questionCount: number,
): QuestionDiceRoll | null {
	const rollResult = getQuestionRollResult(value);
	if (!rollResult) return null;
	return {
		resultId: rollResult.resultId,
		questionId: getRolledQuestionId(rollResult, questionCount),
	};
}

export function normalizeQuestionSearch(
	value: string,
	questionCount: number,
): string {
	const digits = value.replace(/\D+/g, "");
	if (!digits) return "";

	return String(Math.max(1, Math.min(Number(digits), questionCount)));
}

export function getQuestionSearchTarget(
	value: string,
	questionCount: number,
): number | null {
	if (!value) return null;

	const questionId = Math.max(1, Math.min(Number(value), questionCount));
	return Number.isFinite(questionId) ? questionId : null;
}

export function getStandardDiceFactors(target: number): number[] | null {
	const cache = new Map<number, number[] | null>();

	function findFactors(value: number): number[] | null {
		if (value === 1) return [];
		if (cache.has(value)) return cache.get(value) ?? null;

		let best: number[] | null = null;
		STANDARD_QUESTION_DICE.forEach((sides) => {
			if (value % sides !== 0) return;

			const rest = findFactors(value / sides);
			if (!rest) return;

			const candidate = [sides, ...rest];
			if (
				!best ||
				candidate.length < best.length ||
				(candidate.length === best.length &&
					candidate.join(",") > best.join(","))
			) {
				best = candidate;
			}
		});

		cache.set(value, best);
		return best;
	}

	return findFactors(target);
}

export function getQuestionRollFormula(questionCount: number): string {
	const factors = getStandardDiceFactors(questionCount);
	if (!factors?.length) return `1d${questionCount}`;
	if (factors.length === 1) return `1d${factors[0]}`;

	return factors.reduce((formula, sides, index) => {
		if (index === 0) return `(1d${sides} - 1)`;
		if (index === factors.length - 1) {
			return `(${formula} * ${sides}) + 1d${sides}`;
		}
		return `(${formula} * ${sides}) + (1d${sides} - 1)`;
	}, "");
}
