const {
	validationIssue,
} = require("../../../http/requestValidation");
const {
	requireObject,
	validateOptionalNonEmptyString,
	validateOrderMap,
} = require("../../../http/requestSchemaUtils");

const MOVABLE_ENTITY_TYPES = ["characters", "npc"];

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
	if (!requireObject(value, path, issues)) return issues;
	if (!MOVABLE_ENTITY_TYPES.includes(value.targetType)) {
		issues.push(
			validationIssue(
				`${path}.targetType`,
				"targetType must be characters or npc.",
				"invalid_enum",
			),
		);
	}
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
