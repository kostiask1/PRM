const {
	requireObject,
	validateOptionalNonEmptyString,
	validateOrderMap,
} = require("../../../http/requestSchemaUtils");

function validateSessionMutation(value, path = "body") {
	const issues = [];
	if (!requireObject(value, path, issues)) return issues;
	validateOptionalNonEmptyString(value.name, `${path}.name`, issues);
	if (
		value.data !== undefined &&
		!requireObject(value.data, `${path}.data`, issues)
	) {
		return issues;
	}
	return issues;
}

function validateSessionReorder(value, path = "body") {
	const issues = [];
	if (!requireObject(value, path, issues)) return issues;
	validateOrderMap(value.orders, `${path}.orders`, issues);
	return issues;
}

module.exports = {
	validateSessionMutation,
	validateSessionReorder,
};
