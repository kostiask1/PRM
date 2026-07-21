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

const TARGET_IDENTITY_KEYS = Object.freeze([
	"id",
	"slug",
	"name",
	"targetClientId",
]);
const TARGETED_OPERATION_NAMES = new Set(["update", "delete"]);
const NOTE_MUTATION_NAMES = new Set(["updateNote", "deleteNote"]);
const ENTITY_SCOPES = new Set(["campaign", "session"]);

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

function hasTargetIdentity(operation) {
	return TARGET_IDENTITY_KEYS.some((key) => hasText(operation[key]));
}

function isImplicitCampaignUpdate(operation, entity) {
	return operation.op === "update" && entity === "campaign";
}

function createOperationValidationContext(
	operation,
	index,
	errors,
	options,
) {
	const entity = String(operation.entity || "");
	return {
		operation,
		path: `operations[${index}]`,
		errors,
		options,
		entity,
		implicitCampaignUpdate: isImplicitCampaignUpdate(operation, entity),
	};
}

function validateAllowedOperation(context) {
	if (ALLOWED_OPS.has(context.operation.op)) return;
	addError(
		context.errors,
		`${context.path}.op`,
		`must be one of: ${[...ALLOWED_OPS].join(", ")}`,
	);
}

function validateAllowedEntity(context) {
	if (ALLOWED_ENTITIES.has(context.operation.entity)) return;
	addError(
		context.errors,
		`${context.path}.entity`,
		`must be one of: ${[...ALLOWED_ENTITIES].join(", ")}`,
	);
}

function validateExistingTargetIdentity(context) {
	if (!TARGETED_OPERATION_NAMES.has(context.operation.op)) return;
	if (context.implicitCampaignUpdate || hasTargetIdentity(context.operation)) {
		return;
	}
	addError(
		context.errors,
		context.path,
		"must identify an existing target by id, slug, or name",
	);
}

function validateCreatePayload(context) {
	if (context.operation.op !== "create") return;
	if (isObject(context.operation.data) || isObject(context.operation.value)) {
		return;
	}
	addError(
		context.errors,
		`${context.path}.data`,
		"must be an object for create operations",
	);
}

function validateUpdatePayload(context) {
	if (context.operation.op !== "update") return;
	if (isObject(context.operation.patch) || isObject(context.operation.data)) {
		return;
	}
	addError(
		context.errors,
		`${context.path}.patch`,
		"must be an object for update operations",
	);
}

function validateAppendNotePayload(context) {
	if (context.operation.op !== "appendNote") return;
	if (
		isObject(context.operation.note) ||
		isObject(context.operation.data) ||
		typeof context.operation.note === "string"
	) {
		return;
	}
	addError(
		context.errors,
		`${context.path}.note`,
		"must be a note object or string",
	);
}

function validateNoteMutationIdentity(context) {
	if (!NOTE_MUTATION_NAMES.has(context.operation.op)) return;
	if (hasText(context.operation.noteId)) return;
	addError(
		context.errors,
		`${context.path}.noteId`,
		"is required for note updates/deletes",
	);
}

function isMoveScopeOperation(context) {
	return context.operation.op === "moveScope";
}

function validateMoveScopeTarget(context) {
	if (!isMoveScopeOperation(context) || hasTargetIdentity(context.operation)) {
		return;
	}
	addError(
		context.errors,
		context.path,
		"must identify an existing target by id, slug, name, or targetClientId",
	);
}

function validateMoveScopeFrom(context) {
	if (!isMoveScopeOperation(context)) return;
	if (ENTITY_SCOPES.has(context.operation.from)) return;
	addError(context.errors, `${context.path}.from`, "must be campaign or session");
}

function validateMoveScopeTo(context) {
	if (!isMoveScopeOperation(context)) return;
	if (ENTITY_SCOPES.has(context.operation.to)) return;
	addError(context.errors, `${context.path}.to`, "must be campaign or session");
}

function validateRequiredEntityScope(context) {
	if (!requiresExplicitEntityScope(context.operation, context.options)) return;
	if (context.operation.scope !== undefined) return;
	addError(
		context.errors,
		`${context.path}.scope`,
		"is required in mixed entity scope mode",
	);
}

function validateSuppliedEntityScope(context) {
	if (context.operation.scope === undefined) return;
	if (ENTITY_SCOPES.has(context.operation.scope)) return;
	addError(
		context.errors,
		`${context.path}.scope`,
		"must be campaign or session",
	);
}

const OPERATION_VALIDATORS = Object.freeze([
	validateAllowedOperation,
	validateAllowedEntity,
	validateExistingTargetIdentity,
	validateCreatePayload,
	validateUpdatePayload,
	validateAppendNotePayload,
	validateNoteMutationIdentity,
	validateMoveScopeTarget,
	validateMoveScopeFrom,
	validateMoveScopeTo,
	validateRequiredEntityScope,
	validateSuppliedEntityScope,
]);

function validateOperation(operation, index, errors, options = {}) {
	const path = `operations[${index}]`;
	if (!isObject(operation)) {
		addError(errors, path, "must be an object");
		return;
	}
	const context = createOperationValidationContext(
		operation,
		index,
		errors,
		options,
	);
	for (const validate of OPERATION_VALIDATORS) validate(context);
}

function invalidPayloadResult() {
	return {
		valid: false,
		errors: [{ path: "$", message: "must be an object" }],
	};
}

function validatePayloadVersion(payload, errors) {
	if (payload.version !== 2) addError(errors, "version", "must be 2");
}

function validateOperations(operations, errors, options) {
	operations.forEach((operation, index) =>
		validateOperation(operation, index, errors, options),
	);
}

function validatePayloadOperations(payload, errors, options) {
	if (!Array.isArray(payload.operations)) {
		addError(errors, "operations", "must be an array");
		return;
	}
	if (options.requireOperations === true && payload.operations.length === 0) {
		addError(errors, "operations", "must not be empty");
		return;
	}
	validateOperations(payload.operations, errors, options);
}

function validationResult(errors) {
	return {
		valid: errors.length === 0,
		errors,
	};
}

function validateAiGeneratedContent(payload, options = {}) {
	if (!isObject(payload)) return invalidPayloadResult();
	const errors = [];
	validatePayloadVersion(payload, errors);
	validatePayloadOperations(payload, errors, options);
	return validationResult(errors);
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
