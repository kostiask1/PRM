function isValueToken(token) {
	return token?.type === "number" || token?.type === "dice";
}

export function parseDiceExpressionTokens(tokens, operations) {
	let index = 0;

	function peek() {
		return tokens[index];
	}

	function consume(type) {
		if (peek()?.type !== type) return null;
		index += 1;
		return tokens[index - 1];
	}

	function parseUnaryPrimary() {
		if (consume("+")) {
			return { matched: true, value: parsePrimary() };
		}
		if (consume("-")) {
			return {
				matched: true,
				value: operations.negate(parsePrimary()),
			};
		}
		return { matched: false, value: null };
	}

	function parseParenthesizedPrimary() {
		if (!consume("(")) return { matched: false, value: null };
		const value = parseExpression();
		if (!consume(")")) return { matched: true, value: null };
		return { matched: true, value };
	}

	function parsePrimary() {
		const unary = parseUnaryPrimary();
		if (unary.matched) return unary.value;

		const current = peek();
		if (isValueToken(current)) {
			index += 1;
			return operations.createValue(current);
		}

		const parenthesized = parseParenthesizedPrimary();
		return parenthesized.matched ? parenthesized.value : null;
	}

	function parseMultiplication() {
		let left = parsePrimary();
		if (!left) return null;

		while (consume("*")) {
			const right = parsePrimary();
			if (!right) return null;
			left = operations.multiply(left, right);
			if (!left) return null;
		}

		return left;
	}

	function consumeAdditiveSign() {
		if (consume("+")) return 1;
		if (consume("-")) return -1;
		return 0;
	}

	function parseExpression() {
		let left = parseMultiplication();
		if (!left) return null;

		let sign = consumeAdditiveSign();
		while (sign) {
			const right = parseMultiplication();
			if (!right) return null;
			left = operations.add(left, right, sign);
			if (!left) return null;
			sign = consumeAdditiveSign();
		}

		return left;
	}

	const result = parseExpression();
	return result && index === tokens.length ? result : null;
}
