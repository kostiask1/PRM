const {
	validationIssue,
} = require("../../../http/requestValidation");
const {
	requireObject,
	validateOptionalNonEmptyString,
	validateOrderMap,
} = require("../../../http/requestSchemaUtils");

function validateCampaignCreate(value, path = "body") {
	const issues = [];
	if (!requireObject(value, path, issues)) return issues;
	validateOptionalNonEmptyString(value.name, `${path}.name`, issues);
	if (value.name === undefined) {
		issues.push(
			validationIssue(
				`${path}.name`,
				"Campaign name is required.",
				"required",
			),
		);
	}
	return issues;
}

function validateCampaignPatch(value, path = "body") {
	const issues = [];
	if (!requireObject(value, path, issues)) return issues;
	validateOptionalNonEmptyString(value.name, `${path}.name`, issues);
	return issues;
}

function validateEntityMove(value, path = "body") {
	const issues = [];
	requireObject(value, path, issues);
	return issues;
}

function validateReorderRequest(value, path = "body") {
	const issues = [];
	if (!requireObject(value, path, issues)) return issues;
	validateOrderMap(value.orders, `${path}.orders`, issues);
	return issues;
}

module.exports = {
	validateCampaignCreate,
	validateCampaignPatch,
	validateEntityMove,
	validateReorderRequest,
};
