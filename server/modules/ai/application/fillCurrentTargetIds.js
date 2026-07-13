const { asText } = require("../../../ai/AiHistoryWriter");

function isObject(value) {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function fillCurrentTargetIds(
	generatedContent,
	{ path, sceneId, customMonsterTarget },
) {
	if (!Array.isArray(generatedContent?.operations)) return generatedContent;
	for (const operation of generatedContent.operations) {
		if (!isObject(operation)) continue;
		const op = asText(operation.op);
		const entity = asText(operation.entity).toLowerCase();
		const needsExistingTarget = [
			"update",
			"delete",
			"updateNote",
			"deleteNote",
		].includes(op);
		if (!needsExistingTarget) continue;
		if (
			asText(operation.id) ||
			asText(operation.slug) ||
			asText(operation.name) ||
			asText(operation.targetClientId)
		) {
			continue;
		}
		if (["encounter", "encounters"].includes(entity) && path?.encounter) {
			operation.id = path.encounter;
		} else if (["scene", "scenes"].includes(entity) && sceneId) {
			operation.id = sceneId;
		} else if (
			["monster", "custom-monster", "custommonster"].includes(entity) &&
			customMonsterTarget
		) {
			if (asText(customMonsterTarget.id)) {
				operation.id = asText(customMonsterTarget.id);
			} else if (asText(customMonsterTarget.name)) {
				operation.name = asText(customMonsterTarget.name);
			}
		}
	}
	return generatedContent;
}

module.exports = { fillCurrentTargetIds };
