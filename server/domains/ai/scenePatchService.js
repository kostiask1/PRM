const crypto = require("crypto");
const { coerceAiText: asText } = require("../../ai/textUtils");
const contentNormalizer = require("./aiContentNormalizer");
const {
	getOperationTargetIdentity,
} = require("./entityOperationUtils");
const {
	getSessionEncounters,
} = require("./encounterPatchService");

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

function createScenePatchService({
	createId = () => crypto.randomUUID(),
	normalizeNotesPreservingExisting =
		contentNormalizer.normalizeNotesPreservingExisting,
	mergeAiIgnoredNotes = contentNormalizer.mergeAiIgnoredNotes,
	readSessionEncounters = getSessionEncounters,
	text = asText,
} = {}) {
	function hasOwn(value, key) {
		return Boolean(
			value &&
				typeof value === "object" &&
				Object.prototype.hasOwnProperty.call(value, key),
		);
	}

	function normalizeSceneTexts(rawScene = {}, existingTexts = {}) {
		const source =
			rawScene.texts && typeof rawScene.texts === "object"
				? rawScene.texts
				: rawScene;
		return {
			summary: hasOwn(source, "summary")
				? text(source.summary)
				: existingTexts?.summary || "",
			goal: hasOwn(source, "goal")
				? text(source.goal)
				: existingTexts?.goal || "",
			stakes: hasOwn(source, "stakes")
				? text(source.stakes)
				: existingTexts?.stakes || "",
			location: hasOwn(source, "location")
				? text(source.location)
				: existingTexts?.location || "",
		};
	}

	function hasSceneContent(scene = {}) {
		const texts = scene.texts || {};
		const hasTextContent = [
			"summary",
			"goal",
			"stakes",
			"location",
		].some((key) => text(texts?.[key]));
		return (
			hasTextContent ||
			(scene.notes || []).some((note) =>
				text(note?.title || note?.text),
			) ||
			(scene.npcs || []).some((npc) =>
				text(npc?.name || npc?.description),
			) ||
			Boolean(text(scene.encounterId) || text(scene.imageUrl))
		);
	}

	function normalizeSceneNpcs(npcs) {
		if (!Array.isArray(npcs)) return [];
		return npcs
			.map((npc) => {
				if (typeof npc === "string") {
					const name = text(npc);
					return name ? { name, description: "" } : null;
				}
				if (!npc || typeof npc !== "object") return null;
				const name = text(npc.name || npc.firstName);
				if (!name) return null;
				return {
					name,
					description: text(
						npc.description || npc.trait || "",
					),
				};
			})
			.filter(Boolean);
	}

	function resolveEncounterId(
		raw,
		clientIdMap,
		existingEncounterId = "",
	) {
		const direct = text(raw?.encounterId);
		if (direct) return direct;
		const clientId = text(raw?.encounterClientId);
		if (clientId) {
			const mapped = clientIdMap.get(clientId);
			if (mapped?.entity === "encounter") return mapped.id;
		}
		return existingEncounterId || "";
	}

	function normalizeScene(
		scene,
		existing,
		clientIdMap,
		{ simplifiedNotes = false } = {},
	) {
		const hasNotes = Array.isArray(scene.notes);
		const notesFromAi = hasNotes
			? mergeAiIgnoredNotes(
					existing?.notes || [],
					normalizeNotesPreservingExisting(
						scene.notes || [],
						existing?.notes || [],
						{ simplifiedNotes },
					),
				)
			: existing?.notes || [];
		const hasNpcs = Array.isArray(scene.npcs);

		return {
			id: existing?.id || createId(),
			texts: normalizeSceneTexts(
				scene,
				existing?.texts || {},
			),
			notes: hasNotes ? notesFromAi : existing?.notes || [],
			isNotesCollapsed: Boolean(existing?.isNotesCollapsed),
			npcs: hasNpcs
				? normalizeSceneNpcs(scene.npcs)
				: existing?.npcs || [],
			collapsed: Boolean(existing?.collapsed),
			encounterId: resolveEncounterId(
				scene,
				clientIdMap,
				existing?.encounterId,
			),
			imageUrl: existing?.imageUrl ?? scene.imageUrl ?? null,
		};
	}

	function getSessionScenes(sessionData) {
		sessionData.data = sessionData.data || {};
		if (!Array.isArray(sessionData.data.scenes)) {
			sessionData.data.scenes = [];
		}
		return sessionData.data.scenes;
	}

	function collectSceneEncounterClientIds(operations = []) {
		const ids = new Set();
		for (const operation of operations) {
			if (!operation || typeof operation !== "object") continue;
			const op = text(operation.op).toLowerCase();
			const entity = text(operation.entity).toLowerCase();
			if (!["create", "update"].includes(op)) continue;
			if (!["scene", "scenes"].includes(entity)) continue;
			const data = operationData(operation);
			const patch = operationPatch(operation);
			const encounterClientId = text(
				data.encounterClientId ||
					patch.encounterClientId,
			);
			if (encounterClientId) ids.add(encounterClientId);
		}
		return ids;
	}

	function queuePendingSceneEncounterLink(state, scene, raw) {
		const encounterClientId = text(raw?.encounterClientId);
		if (!encounterClientId || !scene?.id) return;
		state.pendingSceneEncounterLinks.push({
			sceneId: text(scene.id),
			encounterClientId,
		});
	}

	function resolvePendingSceneEncounterLinks(state) {
		const {
			sessionData,
			clientIdMap,
			pendingSceneEncounterLinks,
			warnings,
		} = state;
		if (
			!sessionData ||
			pendingSceneEncounterLinks.length === 0
		) {
			return false;
		}
		let changed = false;
		const scenes = getSessionScenes(sessionData);
		for (const link of pendingSceneEncounterLinks) {
			const mapped = clientIdMap.get(link.encounterClientId);
			if (mapped?.entity !== "encounter" || !mapped.id) {
				warnings.push(
					`Scene encounterClientId "${link.encounterClientId}" could not be resolved to a created encounter.`,
				);
				continue;
			}
			const scene = scenes.find(
				(item) => text(item.id) === link.sceneId,
			);
			if (!scene) continue;
			if (scene.encounterId !== mapped.id) {
				scene.encounterId = mapped.id;
				changed = true;
			}
		}
		return changed;
	}

	function removeCreatedUnlinkedEncounters(state) {
		const {
			sessionData,
			createdEncounterIds,
			warnings,
		} = state;
		if (!sessionData || createdEncounterIds.size === 0) {
			return false;
		}
		const scenes = getSessionScenes(sessionData);
		const linkedEncounterIds = new Set(
			scenes
				.map((scene) => text(scene.encounterId))
				.filter(Boolean),
		);
		const encounters = readSessionEncounters(sessionData);
		const nextEncounters = encounters.filter((encounter) => {
			const id = text(encounter.id);
			return (
				!createdEncounterIds.has(id) ||
				linkedEncounterIds.has(id)
			);
		});
		if (nextEncounters.length === encounters.length) return false;
		const removedCount =
			encounters.length - nextEncounters.length;
		sessionData.data.encounters = nextEncounters;
		warnings.push(
			`Removed ${removedCount} newly created encounter${
				removedCount === 1 ? "" : "s"
			} without a final scene link.`,
		);
		return true;
	}

	function finalizeSceneEncounterLinks(state) {
		const linksChanged =
			resolvePendingSceneEncounterLinks(state);
		const orphansRemoved =
			removeCreatedUnlinkedEncounters(state);
		return linksChanged || orphansRemoved;
	}

	function findScene(
		sessionData,
		operation,
		clientIdMap = null,
	) {
		const scenes = getSessionScenes(sessionData);
		const identity = getOperationTargetIdentity(
			operation,
			clientIdMap,
		);
		const id = text(identity.id);
		return (
			scenes.find((scene) => text(scene.id) === id) ||
			null
		);
	}

	function applySceneOperation(state, operation, options) {
		const {
			sessionData,
			clientIdMap,
			permissions,
			warnings,
		} = state;
		if (!sessionData) {
			warnings.push(
				`Skipped scene ${operation.op}; no session target.`,
			);
			return null;
		}
		const normalizedOp = text(operation.op).toLowerCase();
		const scenes = getSessionScenes(sessionData);

		if (normalizedOp === "delete") {
			const existing = findScene(
				sessionData,
				operation,
				clientIdMap,
			);
			if (!existing) return null;
			sessionData.data.scenes = scenes.filter(
				(scene) => scene !== existing,
			);
			return { type: "scene", deleted: existing };
		}

		if (normalizedOp === "create") {
			const data = operationData(operation);
			const safeData =
				permissions.allowEncounters === false
					? {
							...data,
							encounterId: "",
							encounterClientId: "",
						}
					: data;
			const saved = normalizeScene(
				safeData,
				null,
				clientIdMap,
				options,
			);
			if (!hasSceneContent(saved)) {
				warnings.push("Skipped empty scene create.");
				return null;
			}
			scenes.push(saved);
			queuePendingSceneEncounterLink(
				state,
				saved,
				safeData,
			);
			if (operation.clientId) {
				clientIdMap.set(text(operation.clientId), {
					entity: "scene",
					scope: "session",
					id: saved.id,
				});
			}
			return { type: "scene", saved };
		}

		if (normalizedOp === "update") {
			const existing = findScene(
				sessionData,
				operation,
				clientIdMap,
			);
			if (!existing) return null;
			const patch = operationPatch(operation);
			const raw = {
				...existing,
				...patch,
				texts: {
					...(existing.texts || {}),
					...(patch.texts &&
					typeof patch.texts === "object"
						? patch.texts
						: {}),
				},
				id: existing.id,
				imageUrl:
					existing.imageUrl ?? patch.imageUrl ?? null,
			};
			const safeRaw =
				permissions.allowEncounters === false
					? {
							...raw,
							encounterId:
								existing.encounterId || "",
						}
					: raw;
			const saved = normalizeScene(
				safeRaw,
				existing,
				clientIdMap,
				options,
			);
			const index = scenes.indexOf(existing);
			scenes[index] = saved;
			queuePendingSceneEncounterLink(
				state,
				saved,
				safeRaw,
			);
			return { type: "scene", saved };
		}

		return null;
	}

	return {
		applySceneOperation,
		collectSceneEncounterClientIds,
		finalizeSceneEncounterLinks,
		normalizeScene,
	};
}

const {
	applySceneOperation,
	collectSceneEncounterClientIds,
	finalizeSceneEncounterLinks,
} = createScenePatchService();

module.exports = {
	applySceneOperation,
	collectSceneEncounterClientIds,
	createScenePatchService,
	finalizeSceneEncounterLinks,
};
