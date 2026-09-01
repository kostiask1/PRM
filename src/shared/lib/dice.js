import { parseDiceExpressionTokens } from "./diceExpressionParser.js";

function normalizeFormula(input = "") {
	return String(input || "")
		.toLowerCase()
		.replace(/\s+/g, "");
}

function formatFormula(input = "") {
	return String(input || "")
		.trim()
		.replace(/\s+/g, "")
		.replace(/([()+*-])/g, " $1 ")
		.replace(/\(\s+/g, "(")
		.replace(/\s+\)/g, ")")
		.replace(/\s+/g, " ")
		.trim();
}

function createEmptyStats() {
	return {
		total: 0,
		average: 0,
		min: 0,
		max: 0,
		breakdown: [],
		expression: "0",
		precedence: 3,
		diceMap: {},
		d20Count: 0,
		lastD20Value: 0,
	};
}

function mergeDiceMap(target, source) {
	Object.entries(source || {}).forEach(([key, value]) => {
		target[key] = (target[key] || 0) + value;
	});
	return target;
}

function combineBreakdown(left, right) {
	return [...(left || []), ...(right || [])];
}

function applyBreakdownSign(breakdown, sign) {
	if (sign === 1) return breakdown || [];
	return (breakdown || []).map((entry) => ({
		...entry,
		val: entry.val * sign,
	}));
}

function addStats(left, right, sign = 1) {
	return {
		total: left.total + right.total * sign,
		average: left.average + right.average * sign,
		min: sign === 1 ? left.min + right.min : left.min - right.max,
		max: sign === 1 ? left.max + right.max : left.max - right.min,
		breakdown: combineBreakdown(
			left.breakdown,
			applyBreakdownSign(right.breakdown, sign),
		),
		expression: `${left.expression} ${sign === 1 ? "+" : "-"} ${right.expression}`,
		precedence: 1,
		diceMap: mergeDiceMap({ ...left.diceMap }, right.diceMap),
		d20Count: left.d20Count + right.d20Count,
		lastD20Value: right.d20Count ? right.lastD20Value : left.lastD20Value,
	};
}

function multiplyRange(left, right) {
	const values = [
		left.min * right.min,
		left.min * right.max,
		left.max * right.min,
		left.max * right.max,
	];
	return {
		min: Math.min(...values),
		max: Math.max(...values),
	};
}

function formatOperandExpression(stats, parentPrecedence) {
	if (!stats) return "0";
	return stats.precedence < parentPrecedence
		? `(${stats.expression})`
		: stats.expression;
}

function multiplyStats(left, right) {
	const range = multiplyRange(left, right);
	return {
		total: left.total * right.total,
		average: left.average * right.average,
		min: range.min,
		max: range.max,
		breakdown: combineBreakdown(left.breakdown, right.breakdown),
		expression: `${formatOperandExpression(left, 2)} * ${formatOperandExpression(right, 2)}`,
		precedence: 2,
		diceMap: mergeDiceMap({ ...left.diceMap }, right.diceMap),
		d20Count: left.d20Count + right.d20Count,
		lastD20Value: right.d20Count ? right.lastD20Value : left.lastD20Value,
	};
}

function collectDiceRolls(count, sides) {
	const rolls = [];
	for (let i = 0; i < count; i += 1) {
		const roll = Math.floor(Math.random() * sides) + 1;
		rolls.push({ val: roll, max: sides });
	}
	return rolls;
}

function applyD20Tracking(stats, rolls, sides, keepSuffix) {
	if (sides !== 20 || keepSuffix) return;
	stats.d20Count = rolls.length;
	stats.lastD20Value = rolls.length ? rolls[rolls.length - 1].val : 0;
}

function getKeptRollIndices(rolls, keepType, keepCount) {
	const indexed = rolls.map((roll, index) => ({
		val: roll.val,
		index,
	}));
	indexed.sort((left, right) =>
		keepType === "h" ? right.val - left.val : left.val - right.val,
	);
	return new Set(indexed.slice(0, keepCount).map((roll) => roll.index));
}

function formatDiceRollExpression(rolls) {
	return rolls
		.map((roll) => (roll.dropped ? `[${roll.val}]` : String(roll.val)))
		.join(" + ");
}

function projectKeptDiceStats(stats, rolls, sides, count, keepSuffix) {
	const keepType = keepSuffix[0].toLowerCase();
	const keepCount = Math.min(parseInt(keepSuffix.slice(1), 10), count);
	const keptIndices = getKeptRollIndices(rolls, keepType, keepCount);
	stats.min += keepCount;
	stats.max += keepCount * sides;

	rolls.forEach((roll, index) => {
		if (keptIndices.has(index)) {
				stats.total += roll.val;
				stats.average += (sides + 1) / 2;
		} else {
			roll.dropped = true;
		}
		stats.breakdown.push(roll);
	});
	stats.expression = formatDiceRollExpression(rolls);
	stats.precedence = keepCount > 1 ? 1 : 3;
	return stats;
}

function projectPlainDiceStats(stats, rolls, sides, count) {
	stats.min += count;
	stats.max += count * sides;
	rolls.forEach((roll) => {
		stats.total += roll.val;
		stats.average += (sides + 1) / 2;
		stats.breakdown.push(roll);
	});
	stats.expression = formatDiceRollExpression(rolls);
	stats.precedence = count > 1 ? 1 : 3;
	return stats;
}

function rollDiceTerm(count, sides, keepSuffix = "") {
	const stats = createEmptyStats();
	stats.diceMap[`${sides}${keepSuffix || ""}`] = count;
	const rolls = collectDiceRolls(count, sides);
	applyD20Tracking(stats, rolls, sides, keepSuffix);

	return keepSuffix
		? projectKeptDiceStats(stats, rolls, sides, count, keepSuffix)
		: projectPlainDiceStats(stats, rolls, sides, count);
}

function createNumberStats(value) {
	return {
		total: value,
		average: value,
		min: value,
		max: value,
		breakdown: [{ val: value, max: null }],
		expression: String(value),
		precedence: 3,
		diceMap: {},
		d20Count: 0,
		lastD20Value: 0,
	};
}

function readOperatorToken(input, index) {
	const value = input[index];
	if (!"()+-*".includes(value)) return null;
	return {
		token: { type: value, value },
		length: 1,
	};
}

function readDiceToken(input, index) {
	const match = input.slice(index).match(/^(\d*)d(\d+)([hl]\d+)?/i);
	if (!match) return null;
	return {
		token: {
			type: "dice",
			count: parseInt(match[1], 10) || 1,
			sides: parseInt(match[2], 10),
			keepSuffix: match[3] || "",
		},
		length: match[0].length,
	};
}

function readNumberToken(input, index) {
	const match = input.slice(index).match(/^\d+/);
	if (!match) return null;
	return {
		token: {
			type: "number",
			value: parseInt(match[0], 10),
		},
		length: match[0].length,
	};
}

function readNextToken(input, index) {
	return (
		readOperatorToken(input, index) ||
		readDiceToken(input, index) ||
		readNumberToken(input, index)
	);
}

function tokenize(input) {
	const tokens = [];
	let index = 0;
	while (index < input.length) {
		const read = readNextToken(input, index);
		if (!read) return null;
		tokens.push(read.token);
		index += read.length;
	}
	return tokens;
}

function createRollStatsValue(token) {
	if (token.type === "number") return createNumberStats(token.value);
	return rollDiceTerm(token.count, token.sides, token.keepSuffix);
}

function parseTokens(tokens) {
	return parseDiceExpressionTokens(tokens, {
		createValue: createRollStatsValue,
		negate: (value) =>
			multiplyStats(
				createNumberStats(-1),
				value || createEmptyStats(),
			),
		multiply: multiplyStats,
		add: addStats,
	});
}

function createConstantDistribution(value) {
	return new Map([[value, 1]]);
}

function mergeDistributionEntry(distribution, value, probability) {
	distribution.set(value, (distribution.get(value) || 0) + probability);
}

function addDistributions(left, right, sign = 1, maxStates = 20000) {
	const result = new Map();
	for (const [leftValue, leftProbability] of left) {
		for (const [rightValue, rightProbability] of right) {
			mergeDistributionEntry(
				result,
				leftValue + rightValue * sign,
				leftProbability * rightProbability,
			);
			if (result.size > maxStates) return null;
		}
	}
	return result;
}

function multiplyDistributions(left, right, maxStates = 20000) {
	const result = new Map();
	for (const [leftValue, leftProbability] of left) {
		for (const [rightValue, rightProbability] of right) {
			mergeDistributionEntry(
				result,
				leftValue * rightValue,
				leftProbability * rightProbability,
			);
			if (result.size > maxStates) return null;
		}
	}
	return result;
}

function createPlainDiceDistribution(count, sides, maxStates = 20000) {
	let distribution = createConstantDistribution(0);
	const singleDie = new Map(
		Array.from({ length: sides }, (_, index) => [index + 1, 1 / sides]),
	);

	for (let index = 0; index < count; index += 1) {
		distribution = addDistributions(distribution, singleDie, 1, maxStates);
		if (!distribution) return null;
	}

	return distribution;
}

function createKeptDiceDistribution(
	count,
	sides,
	keepSuffix,
	maxRollCombinations = 200000,
) {
	const keepType = keepSuffix[0]?.toLowerCase();
	const keepCount = Math.min(parseInt(keepSuffix.slice(1), 10), count);
	const totalCombinations = sides ** count;
	if (
		!["h", "l"].includes(keepType) ||
		!Number.isFinite(totalCombinations) ||
		totalCombinations > maxRollCombinations
	) {
		return null;
	}

	const outcomes = new Map();
	const rolls = [];

	function visit(depth) {
		if (depth === count) {
			const ordered = [...rolls].sort((a, b) =>
				keepType === "h" ? b - a : a - b,
			);
			const total = ordered
				.slice(0, keepCount)
				.reduce((sum, value) => sum + value, 0);
			mergeDistributionEntry(outcomes, total, 1 / totalCombinations);
			return;
		}

		for (let value = 1; value <= sides; value += 1) {
			rolls.push(value);
			visit(depth + 1);
			rolls.pop();
		}
	}

	visit(0);
	return outcomes;
}

function createDistributionValue(
	token,
	{ maxStates, maxRollCombinations },
) {
	if (token.type === "number") {
		return createConstantDistribution(token.value);
	}
	if (token.keepSuffix) {
		return createKeptDiceDistribution(
			token.count,
			token.sides,
			token.keepSuffix,
			maxRollCombinations,
		);
	}
	return createPlainDiceDistribution(token.count, token.sides, maxStates);
}

function parseDistributionTokens(tokens, options = {}) {
	const maxStates = options.maxStates || 20000;
	const maxRollCombinations = options.maxRollCombinations || 200000;
	const limits = { maxStates, maxRollCombinations };
	return parseDiceExpressionTokens(tokens, {
		createValue: (token) => createDistributionValue(token, limits),
		negate: (value) =>
			value
				? multiplyDistributions(
						createConstantDistribution(-1),
						value,
						maxStates,
					)
				: null,
		multiply: (left, right) =>
			multiplyDistributions(left, right, maxStates),
		add: (left, right, sign) =>
			addDistributions(left, right, sign, maxStates),
	});
}

function createProbabilityDistributionRequest(input) {
	const normalizedFormula = normalizeFormula(input);
	if (!normalizedFormula) return null;
	const tokens = tokenize(normalizedFormula);
	return tokens ? { input, tokens } : null;
}

function evaluateProbabilityDistribution(request, options) {
	return parseDistributionTokens(request.tokens, options);
}

function projectProbabilityOutcomes(distribution) {
	return [...distribution.entries()]
		.map(([value, probability]) => ({ value, probability }))
		.sort((a, b) => a.value - b.value);
}

function getMaximumOutcomeProbability(outcomes) {
	return outcomes.reduce(
		(max, outcome) => Math.max(max, outcome.probability),
		0,
	);
}

function getProbabilityWeightedAverage(outcomes) {
	return outcomes.reduce(
		(sum, outcome) => sum + outcome.value * outcome.probability,
		0,
	);
}

function getOutcomeValue(outcomes, index) {
	const outcome = outcomes[index];
	return outcome ? outcome.value : 0;
}

function summarizeProbabilityOutcomes(outcomes) {
	return {
		maxProbability: getMaximumOutcomeProbability(outcomes),
		average: getProbabilityWeightedAverage(outcomes),
		min: getOutcomeValue(outcomes, 0),
		max: getOutcomeValue(outcomes, outcomes.length - 1),
	};
}

function createProbabilityDistributionResult(request, distribution) {
	const outcomes = projectProbabilityOutcomes(distribution);
	const summary = summarizeProbabilityOutcomes(outcomes);

	return {
		formula: formatFormula(request.input),
		outcomes,
		...summary,
	};
}

export function getDiceProbabilityDistribution(input, options = {}) {
	const request = createProbabilityDistributionRequest(input);
	if (!request) return null;
	const distribution = evaluateProbabilityDistribution(request, options);
	return distribution
		? createProbabilityDistributionResult(request, distribution)
		: null;
}

function getLegacyFormula(stats) {
	const formulaParts = [];
	Object.keys(stats.diceMap)
		.sort((a, b) => parseInt(b, 10) - parseInt(a, 10))
		.forEach((key) => {
			formulaParts.push(`${stats.diceMap[key]}d${key}`);
		});

	const modifierSum = (stats.breakdown || [])
		.filter((entry) => entry.max === null)
		.reduce((sum, entry) => sum + entry.val, 0);

	if (modifierSum !== 0) {
		formulaParts.push(modifierSum);
	}

	return formulaParts.join(" + ").replace(/\+\s-/g, "- ");
}

function createInvalidDiceFormulaResult() {
	return {
		id: Date.now(),
		formula: "",
		breakdown: [],
		total: 0,
		average: 0,
		min: 0,
		max: 0,
		isCritical: false,
	};
}

function parseRollStats(cleanFormula) {
	const tokens = tokenize(cleanFormula);
	return tokens ? parseTokens(tokens) : null;
}

function getDiceCriticalState(stats) {
	const isCriticalValue =
		stats.lastD20Value === 1 || stats.lastD20Value === 20;
	const isCritical = stats.d20Count === 1 && isCriticalValue;
	return {
		isCritical,
		total: isCritical ? stats.lastD20Value : stats.total,
	};
}

function getDiceFormulaPresentation(input, cleanFormula, stats) {
	const hasAdvancedOperators = /[()*]/.test(cleanFormula);
	return {
		formula: hasAdvancedOperators ? formatFormula(input) : getLegacyFormula(stats),
		expressionBreakdown: hasAdvancedOperators ? stats.expression : "",
	};
}

function createDiceFormulaResult(input, cleanFormula, stats) {
	const critical = getDiceCriticalState(stats);
	const presentation = getDiceFormulaPresentation(input, cleanFormula, stats);
	return {
		id: Date.now(),
		formula: presentation.formula,
		breakdown: stats.breakdown,
		expressionBreakdown: presentation.expressionBreakdown,
		total: critical.total,
		average: Math.floor(stats.average),
		min: stats.min,
		max: stats.max,
		isCritical: critical.isCritical,
	};
}

export function rollDiceFormula(input) {
	const cleanStr = normalizeFormula(input);
	if (!cleanStr) return null;
	const stats = parseRollStats(cleanStr);
	return stats
		? createDiceFormulaResult(input, cleanStr, stats)
		: createInvalidDiceFormulaResult();
}
