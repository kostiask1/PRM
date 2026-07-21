const { asText } = require("../../../ai/AiHistoryWriter");

const EXISTING_TARGET_OPERATIONS = new Set([
	"update",
	"delete",
	"updateNote",
	"deleteNote",
]);

const EXISTING_TARGET_FIELDS = ["id", "slug", "name", "targetClientId"];

function isObject(value) {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasExistingTarget(operation) {
	return EXISTING_TARGET_FIELDS.some((field) => asText(operation[field]));
}

function assignEncounterTarget(operation, targets) {
	const encounterId = targets.path?.encounter;
	if (encounterId) operation.id = encounterId;
}

function assignSceneTarget(operation, targets) {
	if (targets.sceneId) operation.id = targets.sceneId;
}

function assignCustomMonsterTarget(operation, targets) {
	if (!targets.customMonsterTarget) return;
	const id = asText(targets.customMonsterTarget.id);
	if (id) {
		operation.id = id;
		return;
	}
	const name = asText(targets.customMonsterTarget.name);
	if (name) operation.name = name;
}

const TARGET_COMMANDS = new Map([
	["encounter", assignEncounterTarget],
	["encounters", assignEncounterTarget],
	["scene", assignSceneTarget],
	["scenes", assignSceneTarget],
	["monster", assignCustomMonsterTarget],
	["custom-monster", assignCustomMonsterTarget],
	["custommonster", assignCustomMonsterTarget],
]);

function getTargetCommand(operation) {
	const op = asText(operation.op);
	const entity = asText(operation.entity).toLowerCase();
	if (!EXISTING_TARGET_OPERATIONS.has(op)) return null;
	if (hasExistingTarget(operation)) return null;
	return TARGET_COMMANDS.get(entity) || null;
}

function applyCurrentTarget(operation, targets) {
	if (!isObject(operation)) return;
	const command = getTargetCommand(operation);
	if (command) command(operation, targets);
}

function createCurrentTargets(path, sceneId, customMonsterTarget) {
	return {
		path,
		sceneId,
		customMonsterTarget,
	};
}

function fillCurrentTargetIds(
	generatedContent,
	{ path, sceneId, customMonsterTarget },
) {
	if (!Array.isArray(generatedContent?.operations)) return generatedContent;
	const targets = createCurrentTargets(path, sceneId, customMonsterTarget);
	for (const operation of generatedContent.operations) {
		applyCurrentTarget(operation, targets);
	}
	return generatedContent;
}

module.exports = { fillCurrentTargetIds };
