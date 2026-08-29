import type {
	DiceBreakdownEntry,
	DiceFormulaResult,
} from "../../shared/lib/index.js";

export type DiceRollPayload =
	| string
	| {
			formula: string;
			context: unknown;
	  };

export function normalizeDiceFormula(formula: string): string {
	return formula.replace(/×/g, "*");
}

export function createRollDicePayload(
	formula: string,
	context: unknown,
): DiceRollPayload {
	const normalizedFormula = normalizeDiceFormula(formula);
	return context
		? { formula: normalizedFormula, context }
		: normalizedFormula;
}

export function formatDiceProbability(value: number): string {
	const percent = value * 100;
	if (percent > 0 && percent < 0.001) return "<0.001%";
	if (percent >= 10) return `${percent.toFixed(1)}%`;
	if (percent >= 1) return `${percent.toFixed(2)}%`;
	return `${percent.toFixed(3)}%`;
}

export function getDiceProbabilityBarWidth(
	probability: number,
	maxProbability: number,
): number {
	return maxProbability > 0 ? (probability / maxProbability) * 100 : 0;
}

export interface DiceResultEntry extends DiceFormulaResult {
	context?: unknown;
}

export interface PendingDiceRoll {
	requestId: unknown;
	formula: unknown | null;
	context: unknown;
}

interface UnknownRecord {
	[key: string]: unknown;
}

function isRecord(value: unknown): value is UnknownRecord {
	return typeof value === "object" && value !== null;
}

export function isDicePanelShortcut(
	event: Pick<KeyboardEvent, "ctrlKey" | "metaKey" | "key">,
): boolean {
	const key = event.key.toLowerCase();
	return (event.ctrlKey || event.metaKey) && (key === "d" || key === "в");
}

export function readPendingDiceRoll(value: unknown): PendingDiceRoll | null {
	if (!isRecord(value) || !value.requestId) return null;

	const data = value.data;
	if (!data) {
		return { requestId: value.requestId, formula: null, context: null };
	}
	if (typeof data === "string") {
		return { requestId: value.requestId, formula: data, context: null };
	}
	if (!isRecord(data)) {
		return { requestId: value.requestId, formula: null, context: null };
	}

	return {
		requestId: value.requestId,
		formula: data.formula || data.value || "",
		context: data.context || null,
	};
}

export function isPlayerQuestionsRollContext(context: unknown): boolean {
	return isRecord(context) && context.type === "playerQuestions";
}

export function isSingleDieRoll(result: DiceResultEntry | null): boolean {
	return Boolean(
		/^1d\d+$/i.test(String(result?.formula || "").replace(/\s+/g, "")) &&
		result?.breakdown.length === 1 &&
		result.breakdown[0]?.max,
	);
}

export function getRechargeThreshold(
	result: DiceResultEntry | null,
): number | null {
	const context = isRecord(result?.context) ? result.context : null;
	return context?.type === "recharge"
		? Number(context.threshold) || 6
		: null;
}

export function getRechargeResultClass(
	result: DiceResultEntry | null,
	value: unknown = result?.total,
): "" | "DiceCalculator__rechargeSuccess" | "DiceCalculator__rechargeFailure" {
	const threshold = getRechargeThreshold(result);
	if (!threshold || !Number.isFinite(Number(value))) return "";
	return Number(value) >= threshold
		? "DiceCalculator__rechargeSuccess"
		: "DiceCalculator__rechargeFailure";
}

export function addDieToFormula(currentValue: string, sides: number): string {
	const currentInput = currentValue.trim();
	const dieRegex = new RegExp(`(?:(\\d+))?d${sides}(\\b)`, "i");
	const match = currentInput.match(dieRegex);

	if (match) {
		const currentCount = parseInt(match[1] || "1", 10);
		return currentInput.replace(dieRegex, `${currentCount + 1}d${sides}`);
	}

	const die = `1d${sides}`;
	if (currentInput === "" || /[+\-*/]$/.test(currentInput)) {
		return `${currentInput}${die}`;
	}
	return `${currentInput}+${die}`;
}

export function prependDiceHistory(
	history: DiceResultEntry[],
	entry: DiceResultEntry,
	limit = 10,
): DiceResultEntry[] {
	return [entry, ...history].slice(0, limit);
}

export function getCurrentDiceFormula(
	manualInput: string,
	lastResult: DiceResultEntry | null,
): string {
	return manualInput.trim() || lastResult?.formula || "";
}

export function getFullDiceBreakdownString(
	breakdown: DiceBreakdownEntry[],
): string {
	return breakdown
		.map((item, index) => {
			const isNegative = item.val < 0;
			const sign =
				index > 0 ? (isNegative ? " - " : " + ") : isNegative ? "-" : "";
			const value = Math.abs(item.val);
			return `${sign}${item.dropped ? `[${value}]` : value}`;
		})
		.join("");
}

export function getDiceBreakdownLabel(result: DiceResultEntry): string {
	return (
		result.expressionBreakdown ||
		getFullDiceBreakdownString(result.breakdown)
	);
}

export function createHistoryRollPayload(
	roll: DiceResultEntry,
): DiceRollPayload {
	return createRollDicePayload(roll.formula, roll.context);
}
