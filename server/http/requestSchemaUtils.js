const {
	validationIssue,
} = require("./requestValidation");

function isPlainObject(value) {
	return Boolean(
		value &&
			typeof value === "object" &&
			!Array.isArray(value),
	);
}

function requireObject(value, path, issues) {
	if (isPlainObject(value)) return true;
	issues.push(
		validationIssue(
			path,
			"Expected an object.",
			"invalid_type",
		),
	);
	return false;
}

function validateOptionalNonEmptyString(value, path, issues) {
	if (value === undefined) return;
	if (typeof value === "string" && value.trim()) return;
	issues.push(
		validationIssue(
			path,
			"Expected a non-empty string.",
			"invalid_string",
		),
	);
}

function validateOrderMap(value, path, issues) {
	if (!requireObject(value, path, issues)) return;
	for (const [key, order] of Object.entries(value)) {
		if (
			typeof order !== "number" ||
			!Number.isInteger(order) ||
			order < 0
		) {
			issues.push(
				validationIssue(
					`${path}.${key}`,
					"Order must be a non-negative integer.",
					"invalid_order",
				),
			);
		}
	}
}

module.exports = {
	isPlainObject,
	requireObject,
	validateOptionalNonEmptyString,
	validateOrderMap,
};
