const customBestiaryRepository = require("../bestiary/customBestiaryRepository");
const { normalizeCustomMonster } = require("../../aiCustomMonsterService");
const { coerceAiText: asText } = require("../../ai/textUtils");

const CUSTOM_MONSTER_ENTITIES = new Set([
	"monster",
	"custom-monster",
	"custommonster",
]);

function operationData(operation) {
	if (operation.data && typeof operation.data === "object") {
		return operation.data;
	}
	if (operation.value && typeof operation.value === "object") {
		return operation.value;
	}
	if (operation.patch && typeof operation.patch === "object") {
		return operation.patch;
	}
	return {};
}

function operationPatch(operation) {
	if (operation.patch && typeof operation.patch === "object") {
		return operation.patch;
	}
	if (operation.data && typeof operation.data === "object") {
		return operation.data;
	}
	return {};
}

function createCustomMonsterPatchService({
	repository = customBestiaryRepository,
	normalizeMonster = normalizeCustomMonster,
	text = asText,
} = {}) {
	function isCustomMonsterOperation(operation) {
		return CUSTOM_MONSTER_ENTITIES.has(
			text(operation?.entity).toLowerCase(),
		);
	}

	async function applyCustomMonsterOperations(operations) {
		let existing = await repository.readCustomBestiaryMonsters();
		if (existing.some((monster) => !text(monster?.id))) {
			existing = await repository.writeCustomBestiaryMonsters(existing);
		}

		let next = [...existing];
		const changedMonsters = [];
		let hasChanges = false;

		for (const operation of operations) {
			if (!isCustomMonsterOperation(operation)) continue;

			const op = text(operation.op).toLowerCase();
			const targetId = text(operation.id || operation.targetId);
			const name = text(
				operation.name || operation.targetName || operation.id,
			);
			const index = next.findIndex((monster) => {
				if (targetId && text(monster.id) === targetId) return true;
				return (
					name &&
					text(monster.name).toLowerCase() === name.toLowerCase()
				);
			});

			if (op === "delete") {
				if (index >= 0) {
					next.splice(index, 1);
					hasChanges = true;
				}
				continue;
			}

			if (op === "create") {
				const data = { ...operationData(operation) };
				delete data.id;
				const normalized = normalizeMonster(data);
				if (!normalized) continue;
				next = next.filter(
					(monster) =>
						text(monster.name).toLowerCase() !==
						text(normalized.name).toLowerCase(),
				);
				next.push(normalized);
				changedMonsters.push(normalized);
				hasChanges = true;
				continue;
			}

			if (op === "update") {
				if (index < 0) continue;
				const patch = operationPatch(operation);
				const normalized = normalizeMonster({
					...next[index],
					...patch,
					id: next[index].id,
					name: patch.name || next[index].name,
				});
				if (!normalized) continue;
				next[index] = normalized;
				changedMonsters.push(normalized);
				hasChanges = true;
			}
		}

		const after = await repository.writeCustomBestiaryMonsters(next);
		return { before: existing, after, changedMonsters, hasChanges };
	}

	return {
		applyCustomMonsterOperations,
		isCustomMonsterOperation,
	};
}

const {
	applyCustomMonsterOperations,
	isCustomMonsterOperation,
} = createCustomMonsterPatchService();

module.exports = {
	applyCustomMonsterOperations,
	createCustomMonsterPatchService,
	isCustomMonsterOperation,
};
