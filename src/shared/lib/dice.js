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

function rollDiceTerm(count, sides, keepSuffix = "") {
	const stats = createEmptyStats();
	const groupKey = `${sides}${keepSuffix || ""}`;
	stats.diceMap[groupKey] = count;

	const currentRolls = [];
	for (let i = 0; i < count; i += 1) {
		const roll = Math.floor(Math.random() * sides) + 1;
		currentRolls.push({ val: roll, max: sides });

		if (sides === 20 && !keepSuffix) {
			stats.d20Count += 1;
			stats.lastD20Value = roll;
		}
	}

	if (keepSuffix) {
		const type = keepSuffix[0].toLowerCase();
		const keepCount = Math.min(parseInt(keepSuffix.slice(1), 10), count);
		stats.min += keepCount;
		stats.max += keepCount * sides;
		const indexed = currentRolls.map((roll, idx) => ({
			val: roll.val,
			idx,
		}));
		indexed.sort((a, b) => (type === "h" ? b.val - a.val : a.val - b.val));
		const keptIndices = new Set(
			indexed.slice(0, keepCount).map((roll) => roll.idx),
		);

		currentRolls.forEach((roll, idx) => {
			if (keptIndices.has(idx)) {
				stats.total += roll.val;
				stats.average += (sides + 1) / 2;
			} else {
				roll.dropped = true;
			}
			stats.breakdown.push(roll);
		});
		stats.expression = currentRolls
			.map((roll) => (roll.dropped ? `[${roll.val}]` : String(roll.val)))
			.join(" + ");
		stats.precedence = keepCount > 1 ? 1 : 3;
		return stats;
	}

	stats.min += count;
	stats.max += count * sides;
	currentRolls.forEach((roll) => {
		stats.total += roll.val;
		stats.average += (sides + 1) / 2;
		stats.breakdown.push(roll);
	});
	stats.expression = currentRolls.map((roll) => String(roll.val)).join(" + ");
	stats.precedence = count > 1 ? 1 : 3;
	return stats;
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

function tokenize(input) {
	const tokens = [];
	let index = 0;

	while (index < input.length) {
		const current = input[index];

		if ("()+-*".includes(current)) {
			tokens.push({ type: current, value: current });
			index += 1;
			continue;
		}

		const diceMatch = input.slice(index).match(/^(\d*)d(\d+)([hl]\d+)?/i);
		if (diceMatch) {
			tokens.push({
				type: "dice",
				count: parseInt(diceMatch[1], 10) || 1,
				sides: parseInt(diceMatch[2], 10),
				keepSuffix: diceMatch[3] || "",
			});
			index += diceMatch[0].length;
			continue;
		}

		const numberMatch = input.slice(index).match(/^\d+/);
		if (numberMatch) {
			tokens.push({
				type: "number",
				value: parseInt(numberMatch[0], 10),
			});
			index += numberMatch[0].length;
			continue;
		}

		return null;
	}

	return tokens;
}

function parseTokens(tokens) {
	let index = 0;

	function peek() {
		return tokens[index];
	}

	function consume(type) {
		if (peek()?.type !== type) return null;
		index += 1;
		return tokens[index - 1];
	}

	function parsePrimary() {
		if (consume("+")) return parsePrimary();
		if (consume("-")) {
			return multiplyStats(
				createNumberStats(-1),
				parsePrimary() || createEmptyStats(),
			);
		}

		const current = peek();
		if (!current) return null;

		if (current.type === "number") {
			index += 1;
			return createNumberStats(current.value);
		}

		if (current.type === "dice") {
			index += 1;
			return rollDiceTerm(current.count, current.sides, current.keepSuffix);
		}

		if (consume("(")) {
			const expression = parseExpression();
			if (!consume(")")) return null;
			return expression;
		}

		return null;
	}

	function parseMultiplication() {
		let left = parsePrimary();
		if (!left) return null;

		while (consume("*")) {
			const right = parsePrimary();
			if (!right) return null;
			left = multiplyStats(left, right);
		}

		return left;
	}

	function parseExpression() {
		let left = parseMultiplication();
		if (!left) return null;

		while (true) {
			if (consume("+")) {
				const right = parseMultiplication();
				if (!right) return null;
				left = addStats(left, right, 1);
				continue;
			}
			if (consume("-")) {
				const right = parseMultiplication();
				if (!right) return null;
				left = addStats(left, right, -1);
				continue;
			}
			break;
		}

		return left;
	}

	const result = parseExpression();
	if (!result || index !== tokens.length) return null;
	return result;
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

function parseDistributionTokens(tokens, options = {}) {
	const maxStates = options.maxStates || 20000;
	const maxRollCombinations = options.maxRollCombinations || 200000;
	let index = 0;

	function peek() {
		return tokens[index];
	}

	function consume(type) {
		if (peek()?.type !== type) return null;
		index += 1;
		return tokens[index - 1];
	}

	function parsePrimary() {
		if (consume("+")) return parsePrimary();
		if (consume("-")) {
			const expression = parsePrimary();
			if (!expression) return null;
			return multiplyDistributions(
				createConstantDistribution(-1),
				expression,
				maxStates,
			);
		}

		const current = peek();
		if (!current) return null;

		if (current.type === "number") {
			index += 1;
			return createConstantDistribution(current.value);
		}

		if (current.type === "dice") {
			index += 1;
			if (current.keepSuffix) {
				return createKeptDiceDistribution(
					current.count,
					current.sides,
					current.keepSuffix,
					maxRollCombinations,
				);
			}
			return createPlainDiceDistribution(current.count, current.sides, maxStates);
		}

		if (consume("(")) {
			const expression = parseExpression();
			if (!consume(")")) return null;
			return expression;
		}

		return null;
	}

	function parseMultiplication() {
		let left = parsePrimary();
		if (!left) return null;

		while (consume("*")) {
			const right = parsePrimary();
			if (!right) return null;
			left = multiplyDistributions(left, right, maxStates);
			if (!left) return null;
		}

		return left;
	}

	function parseExpression() {
		let left = parseMultiplication();
		if (!left) return null;

		while (true) {
			if (consume("+")) {
				const right = parseMultiplication();
				if (!right) return null;
				left = addDistributions(left, right, 1, maxStates);
				if (!left) return null;
				continue;
			}
			if (consume("-")) {
				const right = parseMultiplication();
				if (!right) return null;
				left = addDistributions(left, right, -1, maxStates);
				if (!left) return null;
				continue;
			}
			break;
		}

		return left;
	}

	const distribution = parseExpression();
	if (!distribution || index !== tokens.length) return null;
	return distribution;
}

export function getDiceProbabilityDistribution(input, options = {}) {
	const cleanStr = normalizeFormula(input);
	if (!cleanStr) return null;

	const tokens = tokenize(cleanStr);
	if (!tokens) return null;

	const distribution = parseDistributionTokens(tokens, options);
	if (!distribution) return null;

	const outcomes = [...distribution.entries()]
		.map(([value, probability]) => ({ value, probability }))
		.sort((a, b) => a.value - b.value);
	const maxProbability = outcomes.reduce(
		(max, outcome) => Math.max(max, outcome.probability),
		0,
	);
	const average = outcomes.reduce(
		(sum, outcome) => sum + outcome.value * outcome.probability,
		0,
	);

	return {
		formula: formatFormula(input),
		outcomes,
		maxProbability,
		average,
		min: outcomes[0]?.value ?? 0,
		max: outcomes[outcomes.length - 1]?.value ?? 0,
	};
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

export function rollDiceFormula(input) {
	const cleanStr = normalizeFormula(input);
	if (!cleanStr) return null;

	const tokens = tokenize(cleanStr);
	if (!tokens) {
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

	const stats = parseTokens(tokens);
	if (!stats) {
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

	const hasAdvancedOperators = /[()*]/.test(cleanStr);
	const isCritical =
		stats.d20Count === 1 &&
		(stats.lastD20Value === 1 || stats.lastD20Value === 20);
	const finalTotal = isCritical ? stats.lastD20Value : stats.total;

	return {
		id: Date.now(),
		formula: hasAdvancedOperators
			? formatFormula(input)
			: getLegacyFormula(stats),
		breakdown: stats.breakdown,
		expressionBreakdown: hasAdvancedOperators ? stats.expression : "",
		total: finalTotal,
		average: Math.floor(stats.average),
		min: stats.min,
		max: stats.max,
		isCritical,
	};
}
