const {
	validationIssue,
} = require("../../../http/requestValidation");
const {
	isPlainObject,
	requireObject,
} = require("../../../http/requestSchemaUtils");

const ENTITY_TYPES = ["characters", "npc", "locations"];
const PARTIAL_ARCHIVE_SECTIONS = Object.freeze([
	"sessions",
	"npc",
	"locations",
	"images",
	"aiHistory",
]);

function validateOptionalArray(value, path, issues) {
	if (value === undefined) return true;
	if (Array.isArray(value)) return true;
	issues.push(
		validationIssue(
			path,
			"Expected an array.",
			"invalid_type",
		),
	);
	return false;
}

function validateObjectArray(value, path, issues) {
	if (!validateOptionalArray(value, path, issues)) return;
	if (value === undefined) return;
	value.forEach((item, index) => {
		requireObject(item, `${path}[${index}]`, issues);
	});
}

function validateCampaignBundle(value, path = "body") {
	const issues = [];
	if (!requireObject(value, path, issues)) return issues;

	if (!requireObject(value.meta, `${path}.meta`, issues)) {
		return issues;
	}
	if (
		typeof value.meta.name !== "string" ||
		!value.meta.name.trim()
	) {
		issues.push(
			validationIssue(
				`${path}.meta.name`,
				"Campaign name is required.",
				"required",
			),
		);
	}

	validateObjectArray(value.sessions, `${path}.sessions`, issues);
	if (Array.isArray(value.sessions)) {
		value.sessions.forEach((session, index) => {
			if (
				session?.content !== undefined &&
				!isPlainObject(session.content)
			) {
				issues.push(
					validationIssue(
						`${path}.sessions[${index}].content`,
						"Expected an object.",
						"invalid_type",
					),
				);
			}
		});
	}

	if (
		value.entities !== undefined &&
		!requireObject(value.entities, `${path}.entities`, issues)
	) {
		return issues;
	}
	if (isPlainObject(value.entities)) {
		for (const type of ENTITY_TYPES) {
			validateObjectArray(
				value.entities[type],
				`${path}.entities.${type}`,
				issues,
			);
		}
	}
	validateObjectArray(
		value.aiResponses,
		`${path}.aiResponses`,
		issues,
	);
	return issues;
}

function validateArchiveImages(value, path, issues) {
	validateOptionalArray(value, path, issues);
}

function validateCampaignArchiveBundle(value, path = "archive") {
	const issues = [];
	if (!requireObject(value, path, issues)) return issues;
	const bundle = isPlainObject(value.bundle) ? value.bundle : value;
	issues.push(
		...validateCampaignBundle(
			bundle,
			isPlainObject(value.bundle) ? `${path}.bundle` : path,
		),
	);
	if (isPlainObject(value.bundle) || value.images !== undefined) {
		validateArchiveImages(value.images, `${path}.images`, issues);
	}
	return issues;
}

function campaignBundlesFromEnvelope(value) {
	if (Array.isArray(value)) return value;
	if (Array.isArray(value?.campaigns)) return value.campaigns;
	return [value];
}

function validateCampaignBundleCollection(value, path = "body") {
	const bundles = Array.isArray(value) ? value : [value];
	if (bundles.length === 0) {
		return [
			validationIssue(
				path,
				"At least one campaign bundle is required.",
				"min_items",
			),
		];
	}
	return bundles.flatMap((bundle, index) =>
		validateCampaignBundle(
			bundle,
			Array.isArray(value) ? `${path}[${index}]` : path,
		),
	);
}

function validateCampaignArchiveEnvelope(value, path = "archive") {
	const campaigns = campaignBundlesFromEnvelope(value);
	if (campaigns.length === 0) {
		return [
			validationIssue(
				path,
				"At least one campaign archive is required.",
				"min_items",
			),
		];
	}
	return campaigns.flatMap((bundle, index) =>
		validateCampaignArchiveBundle(
			bundle,
			campaigns.length > 1
				? `${path}.campaigns[${index}]`
				: path,
		),
	);
}

function validatePartialArchiveBundle(value, path = "archive") {
	const issues = [];
	if (!requireObject(value, path, issues)) return issues;
	if (!requireObject(value.bundle, `${path}.bundle`, issues)) {
		return issues;
	}
	issues.push(
		...validateCampaignBundle(value.bundle, `${path}.bundle`),
	);
	if (!Array.isArray(value.sections) || value.sections.length === 0) {
		issues.push(
			validationIssue(
				`${path}.sections`,
				"At least one partial archive section is required.",
				"min_items",
			),
		);
	} else {
		value.sections.forEach((section, index) => {
			if (!PARTIAL_ARCHIVE_SECTIONS.includes(section)) {
				issues.push(
					validationIssue(
						`${path}.sections[${index}]`,
						`Unknown partial archive section: ${section}.`,
						"invalid_enum",
					),
				);
			}
		});
	}
	validateArchiveImages(value.images, `${path}.images`, issues);
	return issues;
}

module.exports = {
	validateCampaignArchiveEnvelope,
	validateCampaignBundleCollection,
	validatePartialArchiveBundle,
};
