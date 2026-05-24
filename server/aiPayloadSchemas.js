const ALLOWED_OPS = new Set([
	"create",
	"update",
	"delete",
	"appendNote",
	"updateNote",
	"deleteNote",
	"moveScope",
]);

const ALLOWED_ENTITIES = new Set([
	"campaign",
	"session",
	"character",
	"characters",
	"npc",
	"npcs",
	"location",
	"locations",
	"faction",
	"factions",
	"scene",
	"scenes",
	"encounter",
	"encounters",
	"monster",
	"custom-monster",
	"customMonster",
]);

function isObject(value) {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasText(value) {
	return String(value || "").trim().length > 0;
}

function addError(errors, path, message) {
	errors.push({ path, message });
}

function normalizedEntityName(entity) {
	const value = String(entity || "");
	if (["npc", "npcs"].includes(value)) return "npc";
	if (["location", "locations", "faction", "factions"].includes(value)) {
		return "location";
	}
	return value;
}

function requiresExplicitEntityScope(operation, options = {}) {
	if (!options.requireExplicitEntityScope) return false;
	if (operation.op === "moveScope") return false;
	return ["npc", "location"].includes(normalizedEntityName(operation.entity));
}

function validateOperation(operation, index, errors, options = {}) {
	const path = `operations[${index}]`;
	if (!isObject(operation)) {
		addError(errors, path, "must be an object");
		return;
	}
	const entity = String(operation.entity || "");
	const isImplicitCampaignUpdate =
		operation.op === "update" && entity === "campaign";

	if (!ALLOWED_OPS.has(operation.op)) {
		addError(
			errors,
			`${path}.op`,
			`must be one of: ${[...ALLOWED_OPS].join(", ")}`,
		);
	}
	if (!ALLOWED_ENTITIES.has(operation.entity)) {
		addError(
			errors,
			`${path}.entity`,
			`must be one of: ${[...ALLOWED_ENTITIES].join(", ")}`,
		);
	}

	if (
		["update", "delete"].includes(operation.op) &&
		!isImplicitCampaignUpdate &&
		!hasText(operation.id) &&
		!hasText(operation.slug) &&
		!hasText(operation.name) &&
		!hasText(operation.targetClientId)
	) {
		addError(
			errors,
			path,
			"must identify an existing target by id, slug, or name",
		);
	}
	if (
		operation.op === "create" &&
		!isObject(operation.data) &&
		!isObject(operation.value)
	) {
		addError(errors, `${path}.data`, "must be an object for create operations");
	}
	if (
		operation.op === "update" &&
		!isObject(operation.patch) &&
		!isObject(operation.data)
	) {
		addError(
			errors,
			`${path}.patch`,
			"must be an object for update operations",
		);
	}
	if (
		operation.op === "appendNote" &&
		!isObject(operation.note) &&
		!isObject(operation.data) &&
		typeof operation.note !== "string"
	) {
		addError(errors, `${path}.note`, "must be a note object or string");
	}
	if (
		["updateNote", "deleteNote"].includes(operation.op) &&
		!hasText(operation.noteId)
	) {
		addError(errors, `${path}.noteId`, "is required for note updates/deletes");
	}
	if (operation.op === "moveScope") {
		if (
			!hasText(operation.id) &&
			!hasText(operation.slug) &&
			!hasText(operation.name) &&
			!hasText(operation.targetClientId)
		) {
			addError(
				errors,
				path,
				"must identify an existing target by id, slug, name, or targetClientId",
			);
		}
		if (!["campaign", "session"].includes(operation.from)) {
			addError(errors, `${path}.from`, "must be campaign or session");
		}
		if (!["campaign", "session"].includes(operation.to)) {
			addError(errors, `${path}.to`, "must be campaign or session");
		}
	}
	if (
		requiresExplicitEntityScope(operation, options) &&
		operation.scope === undefined
	) {
		addError(errors, `${path}.scope`, "is required in mixed entity scope mode");
	}
	if (
		operation.scope !== undefined &&
		!["campaign", "session"].includes(operation.scope)
	) {
		addError(errors, `${path}.scope`, "must be campaign or session");
	}
}

function validateAiGeneratedContent(payload, options = {}) {
	const errors = [];
	if (!isObject(payload)) {
		return {
			valid: false,
			errors: [{ path: "$", message: "must be an object" }],
		};
	}

	if (payload.version !== 2) {
		addError(errors, "version", "must be 2");
	}
	if (!Array.isArray(payload.operations)) {
		addError(errors, "operations", "must be an array");
	} else if (
		options.requireOperations === true &&
		payload.operations.length === 0
	) {
		addError(errors, "operations", "must not be empty");
	} else {
		payload.operations.forEach((operation, index) =>
			validateOperation(operation, index, errors, options),
		);
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}

function assertAiGeneratedContentContract(payload, options = {}) {
	const result = validateAiGeneratedContent(payload, options);
	if (result.valid) return result;

	const error = new Error(
		`AI response does not match expected operations schema: ${result.errors
			.map((entry) => `${entry.path} ${entry.message}`)
			.join("; ")}`,
	);
	error.status = 400;
	error.details = result.errors;
	throw error;
}

module.exports = {
	assertAiGeneratedContentContract,
	validateAiGeneratedContent,
};
