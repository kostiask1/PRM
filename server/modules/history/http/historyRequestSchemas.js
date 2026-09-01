const { validationIssue } = require("../../../http/requestValidation");
const { requireObject } = require("../../../http/requestSchemaUtils");

function validateHistoryRestoreRequest(value, path = "body") {
	const issues = [];
	if (!requireObject(value, path, issues)) return issues;
	if (value.expectedRevision === undefined) {
		issues.push(
			validationIssue(
				`${path}.expectedRevision`,
				"Expected history revision is required.",
				"required",
			),
		);
		return issues;
	}
	if (
		!Number.isSafeInteger(value.expectedRevision) ||
		value.expectedRevision < 0
	) {
		issues.push(
			validationIssue(
				`${path}.expectedRevision`,
				"Expected history revision must be a non-negative integer.",
				"invalid_revision",
			),
		);
	}
	return issues;
}

module.exports = { validateHistoryRestoreRequest };
