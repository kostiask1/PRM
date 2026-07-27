const crypto = require("crypto");
const customBestiaryRepository = require("../bestiary/customBestiaryRepository");
const { coerceAiText: asText } = require("../../ai/textUtils");

function getSessionEncounters(sessionData) {
	sessionData.data = sessionData.data || {};
	if (!Array.isArray(sessionData.data.encounters)) {
		sessionData.data.encounters = [];
	}
	return sessionData.data.encounters;
}

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

function createEncounterPatchService({
	getBestiaryIndex = customBestiaryRepository.getBestiaryIndex,
	createId = () => crypto.randomUUID(),
	createInstanceId = () =>
		`inst-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
	text = asText,
} = {}) {
	function buildMonsterInstance(monster, bestiaryIndex) {
		const monsterName = text(monster?.monsterName || monster?.name);
		if (!monsterName) return null;

		let foundBase = null;
		const searchKey = monsterName.toLowerCase();
		for (const [key, data] of bestiaryIndex.entries()) {
			if (key.startsWith(`${searchKey}|`)) {
				foundBase = data;
				break;
			}
		}

		const resolved = foundBase || null;
		const instance = {
			...(resolved || {}),
			id: text(monster?.id) || text(resolved?.id) || createId(),
			instanceId: createInstanceId(),
			name: text(monster?.name) || (resolved ? resolved.name : monsterName),
			originalBestiaryName: resolved ? resolved.name : monsterName,
			source: resolved ? resolved.source : text(monster?.source) || "Unknown",
		};

		if (resolved) {
			const hpValue =
				typeof resolved.hp === "object"
					? resolved.hp.average || 0
					: resolved.hit_points || 0;
			instance.currentHp = hpValue;
			instance.hit_points = hpValue;

			let armorClass = resolved.armor_class || 0;
			if (Array.isArray(resolved.ac) && resolved.ac[0]) {
				const entry = resolved.ac[0];
				armorClass = typeof entry === "object" ? entry.ac || 0 : entry;
			}
			instance.armor_class = armorClass;
		} else {
			instance.currentHp = 0;
			instance.hit_points = 0;
			instance.armor_class = 0;
		}

		return instance;
	}

	function normalizeEncounter(rawEncounter, bestiaryIndex, fallbackName) {
		const monsters = (
			Array.isArray(rawEncounter?.monsters) ? rawEncounter.monsters : []
		)
			.map((monster) => buildMonsterInstance(monster, bestiaryIndex))
			.filter(Boolean);

		return {
			name: text(rawEncounter?.name) || fallbackName,
			monsters,
		};
	}

	async function applyEncounterOperation(state, operation) {
		const {
			sessionData,
			clientIdMap,
			permissions,
			warnings,
			linkedEncounterClientIds,
		} = state;
		if (!sessionData) {
			warnings.push(`Skipped encounter ${operation.op}; no session target.`);
			return null;
		}
		if (permissions.allowEncounters === false) {
			warnings.push(
				`Skipped encounter ${operation.op}; encounter generation disabled.`,
			);
			return null;
		}

		const encounters = getSessionEncounters(sessionData);
		const id = text(operation.id || operation.targetId || state.encounterId);
		const existing = id
			? encounters.find((encounter) => text(encounter.id) === id)
			: null;
		const normalizedOp = text(operation.op).toLowerCase();
		const bestiaryIndex = await getBestiaryIndex();

		if (normalizedOp === "delete") {
			if (!existing) return null;
			sessionData.data.encounters = encounters.filter(
				(encounter) => encounter !== existing,
			);
			return { type: "encounter", deleted: existing };
		}

		if (normalizedOp === "create") {
			const clientId = text(operation.clientId);
			const rawData = operationData(operation);
			const fallbackName = `Encounter ${encounters.length + 1}`;
			const encounterName = text(rawData.name) || fallbackName;
			if (!clientId) {
				warnings.push(
					`Skipped encounter create "${encounterName}"; new encounters must use clientId and be linked from a scene with encounterClientId.`,
				);
				return null;
			}
			if (!linkedEncounterClientIds.has(clientId)) {
				warnings.push(
					`Skipped encounter create "${encounterName}" without matching scene encounterClientId "${clientId}".`,
				);
				return null;
			}
			const normalized = normalizeEncounter(
				rawData,
				bestiaryIndex,
				fallbackName,
			);
			const saved = {
				id: createId(),
				name: normalized.name,
				monsters: normalized.monsters,
			};
			encounters.push(saved);
			state.createdEncounterIds.add(saved.id);
			clientIdMap.set(clientId, {
				entity: "encounter",
				scope: "session",
				id: saved.id,
			});
			return { type: "encounter", saved };
		}

		if (normalizedOp === "update") {
			if (!existing) return null;
			const patch = operationPatch(operation);
			const normalized = normalizeEncounter(
				{
					name: Object.prototype.hasOwnProperty.call(patch, "name")
						? patch.name
						: existing.name,
					monsters: Array.isArray(patch.monsters)
						? patch.monsters
						: existing.monsters || [],
				},
				bestiaryIndex,
				existing.name || "Encounter",
			);
			existing.name = normalized.name;
			existing.monsters = normalized.monsters;
			return { type: "encounter", saved: existing };
		}

		return null;
	}

	return {
		applyEncounterOperation,
		buildMonsterInstance,
		normalizeEncounter,
	};
}

const { applyEncounterOperation } = createEncounterPatchService();

module.exports = {
	applyEncounterOperation,
	createEncounterPatchService,
	getSessionEncounters,
};
