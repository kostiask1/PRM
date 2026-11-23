const DESTRUCTIVE_OPS = new Set(["delete", "deletenote"]);
const MAX_PREVIEW_CHARS = 6000;
const SESSION_REQUIRED_ENTITIES = new Set([
	"session",
	"scene",
	"scenes",
	"encounter",
	"encounters",
	"encounter-creature",
]);

function isObject(value) {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asText(value) {
	return String(value ?? "").trim();
}

function hasOwn(value, key) {
	return Boolean(
		value &&
		typeof value === "object" &&
		Object.prototype.hasOwnProperty.call(value, key),
	);
}

function isUkrainianLanguage(language) {
	return String(language ?? "uk").trim().toLowerCase().startsWith("uk");
}

function isSessionCreateOperation(op) {
	if (!isObject(op)) return false;
	const opName = asText(op.op).toLowerCase();
	const entity = asText(op.entity).toLowerCase();
	return opName === "create" && (entity === "session" || entity === "sessions");
}

function hasCreateSessionOperation(operations = []) {
	return (Array.isArray(operations) ? operations : []).some(
		isSessionCreateOperation,
	);
}

function collectReferencedClientIds(operations = []) {
	const refs = [];
	for (const op of Array.isArray(operations) ? operations : []) {
		if (!isObject(op)) continue;
		const targetClientId = asText(op.targetClientId);
		const ownerClientId = asText(op.ownerClientId);
		const sessionClientId = asText(op.sessionClientId);
		const dataSessionClientId = asText(op.data?.sessionClientId);
		const dataEncounterClientId = asText(op.data?.encounterClientId);
		const patchEncounterClientId = asText(op.patch?.encounterClientId);
		if (targetClientId) refs.push(targetClientId);
		if (ownerClientId) refs.push(ownerClientId);
		if (sessionClientId) refs.push(sessionClientId);
		if (dataSessionClientId) refs.push(dataSessionClientId);
		if (dataEncounterClientId) refs.push(dataEncounterClientId);
		if (patchEncounterClientId) refs.push(patchEncounterClientId);
	}
	return refs;
}

/**
 * Merges action cards whose operations share clientId / targetClientId / encounterClientId / session links.
 */
function mergeDependentRawActions(rawActions = []) {
	const valid = (Array.isArray(rawActions) ? rawActions : []).filter(
		(raw) => isObject(raw) && Array.isArray(raw.operations) && raw.operations.length > 0,
	);
	if (valid.length <= 1) return valid;

	const definedIn = new Map();
	valid.forEach((raw, idx) => {
		for (const op of raw.operations) {
			const cid = asText(op?.clientId);
			if (cid && !definedIn.has(cid)) {
				definedIn.set(cid, idx);
			}
		}
	});

	const parent = valid.map((_, idx) => idx);
	const find = (x) => {
		let cur = x;
		while (parent[cur] !== cur) {
			parent[cur] = parent[parent[cur]];
			cur = parent[cur];
		}
		return cur;
	};
	const union = (a, b) => {
		const ra = find(a);
		const rb = find(b);
		if (ra !== rb) {
			const minRoot = Math.min(ra, rb);
			const maxRoot = Math.max(ra, rb);
			parent[maxRoot] = minRoot;
		}
	};

	valid.forEach((raw, idx) => {
		for (const ref of collectReferencedClientIds(raw.operations)) {
			if (definedIn.has(ref)) {
				union(idx, definedIn.get(ref));
			}
		}
	});

	const createSessionIdx = valid.findIndex((raw) =>
		hasCreateSessionOperation(raw.operations),
	);
	if (createSessionIdx >= 0) {
		valid.forEach((raw, idx) => {
			if (
				idx !== createSessionIdx &&
				!hasCreateSessionOperation(raw.operations) &&
				operationsRequireSession(raw.operations)
			) {
				union(createSessionIdx, idx);
			}
		});
	}

	const groups = new Map();
	valid.forEach((raw, idx) => {
		const root = find(idx);
		if (!groups.has(root)) groups.set(root, []);
		groups.get(root).push(raw);
	});

	const merged = [];
	for (const group of groups.values()) {
		if (group.length === 1) {
			merged.push(group[0]);
		} else {
			const primary =
				group.find((item) => hasCreateSessionOperation(item.operations)) ||
				group[0];
			merged.push({
				...primary,
				kind: group.some((item) => asText(item.kind) === "diff") ? "diff" : primary.kind,
				operations: group.flatMap((item) => item.operations),
			});
		}
	}
	return merged;
}

function operationsRequireSession(operations = []) {
	if (!Array.isArray(operations)) return false;
	return operations.some((op) => {
		if (!isObject(op)) return false;
		const entity = asText(op.entity).toLowerCase();
		const scope = asText(op.scope).toLowerCase();
		const opName = asText(op.op).toLowerCase();
		if (SESSION_REQUIRED_ENTITIES.has(entity)) return true;
		if (scope === "session") return true;
		if (
			opName === "movescope" &&
			(asText(op.from).toLowerCase() === "session" ||
				asText(op.to).toLowerCase() === "session")
		) {
			return true;
		}
		return false;
	});
}

function expandEncounterMonsters(monsters) {
	if (!Array.isArray(monsters)) return monsters;
	const expanded = [];
	for (const entry of monsters) {
		if (!isObject(entry)) {
			expanded.push(entry);
			continue;
		}
		const rawCount = entry.count ?? entry.quantity;
		const parsedCount = Number(rawCount);
		const cleanEntry = { ...entry };
		delete cleanEntry.count;
		delete cleanEntry.quantity;
		if (Number.isInteger(parsedCount) && parsedCount >= 2 && parsedCount <= 12) {
			const customName = asText(cleanEntry.name);
			for (let idx = 0; idx < parsedCount; idx += 1) {
				expanded.push({
					...cleanEntry,
					...(customName ? { name: `${customName} ${idx + 1}` } : {}),
				});
			}
		} else {
			expanded.push(cleanEntry);
		}
	}
	return expanded;
}

function stripClientIdCopy(item) {
	if (!isObject(item)) return item;
	const copy = { ...item };
	delete copy.clientId;
	return copy;
}

function collectNestedList(rootSource, nestedData, key) {
	const items = [];
	if (Array.isArray(nestedData?.[key])) {
		items.push(...nestedData[key]);
		delete nestedData[key];
	}
	if (Array.isArray(rootSource?.[key])) {
		items.push(...rootSource[key]);
		delete rootSource[key];
	}
	return items;
}

function unpackSessionCreateOperation(op, isUk = true) {
	op.entity = "session";
	delete op.scope;
	if (!isObject(op.data) && isObject(op.value)) {
		op.data = { ...op.value };
	}
	if (!isObject(op.data)) {
		op.data = {};
	}
	const rootSource = op.data;
	const nestedData = isObject(rootSource.data) ? rootSource.data : null;
	if (nestedData && hasOwn(nestedData, "result_text") && !hasOwn(rootSource, "result_text")) {
		rootSource.result_text = nestedData.result_text;
	}
	const unpacked = [];
	const descText = asText(
		rootSource.description ||
			rootSource.summary ||
			nestedData?.description ||
			nestedData?.summary,
	);
	delete rootSource.description;
	delete rootSource.summary;
	if (nestedData) {
		delete nestedData.description;
		delete nestedData.summary;
	}
	if (descText) {
		unpacked.push({
			op: "appendNote",
			entity: "session",
			note: { title: isUk ? "Опис сесії" : "Session description", text: descText },
		});
	}
	for (const noteItem of collectNestedList(rootSource, nestedData, "notes")) {
		if (typeof noteItem === "string" || isObject(noteItem)) {
			unpacked.push({ op: "appendNote", entity: "session", note: noteItem });
		}
	}
	for (const charItem of collectNestedList(rootSource, nestedData, "characters")) {
		if (!isObject(charItem)) continue;
		const cid = asText(charItem.clientId);
		unpacked.push({
			op: "create",
			entity: "character",
			scope: "campaign",
			...(cid ? { clientId: cid } : {}),
			data: stripClientIdCopy(charItem),
		});
	}
	for (const npcItem of collectNestedList(rootSource, nestedData, "npcs")) {
		if (!isObject(npcItem)) continue;
		const cid = asText(npcItem.clientId);
		unpacked.push({
			op: "create",
			entity: "npc",
			scope: "session",
			...(cid ? { clientId: cid } : {}),
			data: stripClientIdCopy(npcItem),
		});
	}
	for (const locItem of collectNestedList(rootSource, nestedData, "locations")) {
		if (!isObject(locItem)) continue;
		const cid = asText(locItem.clientId);
		unpacked.push({
			op: "create",
			entity: "location",
			scope: "session",
			...(cid ? { clientId: cid } : {}),
			data: stripClientIdCopy(locItem),
		});
	}
	for (const encItem of collectNestedList(rootSource, nestedData, "encounters")) {
		if (!isObject(encItem)) continue;
		const cid = asText(encItem.clientId);
		unpacked.push({
			op: "create",
			entity: "encounter",
			scope: "session",
			...(cid ? { clientId: cid } : {}),
			data: stripClientIdCopy(encItem),
		});
	}
	for (const sceneItem of collectNestedList(rootSource, nestedData, "scenes")) {
		if (!isObject(sceneItem)) continue;
		const cid = asText(sceneItem.clientId);
		unpacked.push({
			op: "create",
			entity: "scene",
			scope: "session",
			...(cid ? { clientId: cid } : {}),
			data: stripClientIdCopy(sceneItem),
		});
	}
	if (nestedData) {
		delete rootSource.data;
	}
	return unpacked;
}

function normalizeActionOperationsForExecution(
	operations,
	{ sessionData = null, sceneId = null, language = "uk" } = {},
) {
	const isUk = isUkrainianLanguage(language);
	const rawCloned = (Array.isArray(operations) ? operations : []).map((op) =>
		isObject(op) ? JSON.parse(JSON.stringify(op)) : op,
	);
	const hoistedSessionOps = [];
	const remainingOps = [];
	for (const op of rawCloned) {
		if (!isObject(op)) {
			remainingOps.push(op);
			continue;
		}
		const opName = asText(op.op).toLowerCase();
		if (asText(op.entity).toLowerCase() === "sessions") {
			op.entity = "session";
		}
		const entity = asText(op.entity).toLowerCase();
		if (entity === "session" && opName === "update") {
			const hasIdentity = Boolean(
				asText(op.id) ||
					asText(op.slug) ||
					asText(op.name) ||
					asText(op.targetClientId),
			);
			if (!hasIdentity && (sessionData?.id || sessionData?.name)) {
				op.id = sessionData.id || sessionData.name;
			}
		}
		if (isSessionCreateOperation(op)) {
			hoistedSessionOps.push(op, ...unpackSessionCreateOperation(op, isUk));
		} else {
			remainingOps.push(op);
		}
	}
	const cloned = [...hoistedSessionOps, ...remainingOps];
	const usedClientIds = new Set(
		cloned.map((op) => asText(op?.clientId)).filter(Boolean),
	);
	const allocateClientId = (prefix) => {
		let idx = 1;
		while (usedClientIds.has(`${prefix}-${idx}`)) {
			idx += 1;
		}
		const id = `${prefix}-${idx}`;
		usedClientIds.add(id);
		return id;
	};

	cloned.forEach((op) => {
		if (!isObject(op)) return;
		const opName = asText(op.op).toLowerCase();
		const entity = asText(op.entity).toLowerCase();

		if (entity === "scene" || entity === "scenes") {
			if (asText(op.scope).toLowerCase() === "campaign") {
				op.scope = "session";
			}
			if (opName === "create") {
				if (!isObject(op.data) && isObject(op.value)) {
					op.data = { ...op.value };
				}
				if (isObject(op.data)) {
					const texts = isObject(op.data.texts) ? { ...op.data.texts } : {};
					const fallbackSummary = asText(
						texts.summary ||
							op.data.summary ||
							op.data.description ||
							op.data.title ||
							op.data.name,
					);
					if (fallbackSummary && !asText(texts.summary)) {
						texts.summary = fallbackSummary;
					}
					if (!asText(texts.goal) && asText(op.data.goal)) {
						texts.goal = asText(op.data.goal);
					}
					if (!asText(texts.stakes) && asText(op.data.stakes)) {
						texts.stakes = asText(op.data.stakes);
					}
					if (!asText(texts.location) && asText(op.data.location)) {
						texts.location = asText(op.data.location);
					}
					op.data = { ...op.data, texts };
				}
			}
			return;
		}

		if (entity === "encounter" || entity === "encounters") {
			if (opName === "create") {
				op.scope = "session";
				if (!isObject(op.data) && isObject(op.value)) {
					op.data = { ...op.value };
				}
				if (!isObject(op.data)) {
					op.data = {};
				}
				if (Array.isArray(op.data.monsters)) {
					op.data.monsters = expandEncounterMonsters(op.data.monsters);
				}
				if (!asText(op.clientId)) {
					op.clientId = allocateClientId("enc-auto");
				}
			} else if (opName === "update") {
				if (isObject(op.patch) && Array.isArray(op.patch.monsters)) {
					op.patch.monsters = expandEncounterMonsters(op.patch.monsters);
				}
				if (isObject(op.data) && Array.isArray(op.data.monsters)) {
					op.data.monsters = expandEncounterMonsters(op.data.monsters);
				}
			}
		}
	});

	const linkedEncounterClientIds = new Set();
	for (const op of cloned) {
		if (!isObject(op)) continue;
		const opName = asText(op.op).toLowerCase();
		const entity = asText(op.entity).toLowerCase();
		if ((entity === "scene" || entity === "scenes") && (opName === "create" || opName === "update")) {
			const refId = asText(op.data?.encounterClientId || op.patch?.encounterClientId);
			if (refId) linkedEncounterClientIds.add(refId);
		}
	}

	const existingScenes = Array.isArray(sessionData?.data?.scenes) ? sessionData.data.scenes : [];
	const targetSceneId =
		sceneId !== undefined && sceneId !== null && sceneId !== "" ? String(sceneId) : "";
	const existingTargetScene = targetSceneId
		? existingScenes.find((s) => String(s?.id ?? "") === targetSceneId) || null
		: null;
	let canUseExistingTargetScene =
		Boolean(existingTargetScene && !asText(existingTargetScene.encounterId)) &&
		!cloned.some((op) => {
			if (!isObject(op)) return false;
			const opEntity = asText(op.entity).toLowerCase();
			return (
				asText(op.op).toLowerCase() === "update" &&
				(opEntity === "scene" || opEntity === "scenes") &&
				String(op.id ?? "") === targetSceneId &&
				Boolean(asText(op.patch?.encounterClientId || op.data?.encounterClientId))
			);
		});

	const createdEncounters = cloned.filter((op) => {
		if (!isObject(op)) return false;
		const opEntity = asText(op.entity).toLowerCase();
		return (
			asText(op.op).toLowerCase() === "create" &&
			(opEntity === "encounter" || opEntity === "encounters")
		);
	});

	for (const encOp of createdEncounters) {
		const cid = asText(encOp.clientId);
		if (!cid || linkedEncounterClientIds.has(cid)) continue;
		linkedEncounterClientIds.add(cid);

		const unlinkedCreatedSceneOp = cloned.find((op) => {
			if (!isObject(op)) return false;
			const opEntity = asText(op.entity).toLowerCase();
			return (
				asText(op.op).toLowerCase() === "create" &&
				(opEntity === "scene" || opEntity === "scenes") &&
				isObject(op.data) &&
				!asText(op.data.encounterClientId || op.data.encounterId)
			);
		});

		if (unlinkedCreatedSceneOp) {
			unlinkedCreatedSceneOp.data.encounterClientId = cid;
		} else if (canUseExistingTargetScene) {
			canUseExistingTargetScene = false;
			cloned.push({
				op: "update",
				entity: "scene",
				scope: "session",
				id: targetSceneId,
				patch: { encounterClientId: cid },
			});
		} else {
			const encData = isObject(encOp.data) ? encOp.data : {};
			let sceneCid = `scene-${cid}`;
			if (usedClientIds.has(sceneCid)) {
				sceneCid = allocateClientId("scene-auto");
			} else {
				usedClientIds.add(sceneCid);
			}
			cloned.push({
				op: "create",
				entity: "scene",
				scope: "session",
				clientId: sceneCid,
				data: {
					texts: {
						summary:
							asText(encData.description || encData.summary || encData.name) ||
							(isUk ? "Бойова сутичка" : "Combat encounter"),
						goal: asText(encData.goal),
						stakes: asText(encData.stakes),
						location: asText(encData.location),
					},
					encounterClientId: cid,
				},
			});
		}
	}

	return cloned;
}

/**
 * Checks whether any operation in a card deletes entities or notes.
 */
function isDestructiveOperationList(operations) {
	if (!Array.isArray(operations)) return false;
	return operations.some((op) => DESTRUCTIVE_OPS.has(asText(op?.op).toLowerCase()));
}

function truncatePreviewText(text, isUk = true) {
	const value = String(text || "");
	if (value.length <= MAX_PREVIEW_CHARS) return value;
	return `${value.slice(0, MAX_PREVIEW_CHARS)}\n... (${isUk ? "скорочено" : "truncated"})`;
}

function serializePreviewObject(value) {
	if (value === null || value === undefined) return "—";
	if (typeof value === "string") return value || "—";
	return JSON.stringify(value, null, 2);
}

function projectSessionDiffFields(beforeSession = {}, afterSession = {}) {
	const beforeObj = isObject(beforeSession) ? beforeSession : {};
	const afterObj = isObject(afterSession) ? afterSession : {};
	const beforeData = isObject(beforeObj.data) ? beforeObj.data : {};
	const afterData = isObject(afterObj.data) ? afterObj.data : {};
	const beforeOut = {};
	const afterOut = {};

	if (beforeObj.name !== afterObj.name) {
		beforeOut.name = beforeObj.name ?? "";
		afterOut.name = afterObj.name ?? "";
	}

	for (const key of ["notes", "scenes", "npcs", "locations", "encounters"]) {
		const prevVal = beforeData[key] ?? [];
		const nextVal = afterData[key] ?? [];
		if (JSON.stringify(prevVal) === JSON.stringify(nextVal)) continue;

		if (Array.isArray(prevVal) && Array.isArray(nextVal)) {
			const prevMap = new Map(prevVal.map((item, idx) => [String(item?.id ?? idx), item]));
			const nextMap = new Map(nextVal.map((item, idx) => [String(item?.id ?? idx), item]));
			const changedPrev = [];
			const changedNext = [];
			for (const id of new Set([...prevMap.keys(), ...nextMap.keys()])) {
				const p = prevMap.get(id);
				const n = nextMap.get(id);
				if (JSON.stringify(p ?? null) !== JSON.stringify(n ?? null)) {
					if (p !== undefined) changedPrev.push(p);
					if (n !== undefined) changedNext.push(n);
				}
			}
			if (changedPrev.length > 0 || changedNext.length > 0) {
				beforeOut[key] = changedPrev;
				afterOut[key] = changedNext;
			}
		} else {
			beforeOut[key] = prevVal;
			afterOut[key] = nextVal;
		}
	}

	return { before: beforeOut, after: afterOut };
}

function projectObjectChangedFields(beforeVal, afterVal) {
	if (!isObject(beforeVal) || !isObject(afterVal)) {
		return { before: beforeVal, after: afterVal };
	}
	const beforeOut = {};
	const afterOut = {};
	for (const key of new Set([...Object.keys(beforeVal), ...Object.keys(afterVal)])) {
		if (key.startsWith("_")) continue;
		if (JSON.stringify(beforeVal[key] ?? null) !== JSON.stringify(afterVal[key] ?? null)) {
			if (beforeVal[key] !== undefined) beforeOut[key] = beforeVal[key];
			if (afterVal[key] !== undefined) afterOut[key] = afterVal[key];
		}
	}
	return { before: beforeOut, after: afterOut };
}

function formatSingleResourceDiff(resource) {
	if (resource.kind === "session") {
		if (!resource.before || !resource.after) {
			return { before: resource.before, after: resource.after };
		}
		return projectSessionDiffFields(resource.before, resource.after);
	}
	return projectObjectChangedFields(resource.before, resource.after);
}

const COLLECTION_STAT_LABELS = {
	note: { ukSingular: "нотатка", ukPlural: "нотатки", enSingular: "note", enPlural: "notes" },
	scene: { ukSingular: "сцена", ukPlural: "сцени", enSingular: "scene", enPlural: "scenes" },
	session_npc: { ukSingular: "NPC (сесія)", ukPlural: "NPC (сесія)", enSingular: "NPC (session)", enPlural: "NPC (session)" },
	session_location: {
		ukSingular: "локація (сесія)",
		ukPlural: "локації (сесія)",
		enSingular: "location (session)",
		enPlural: "locations (session)",
	},
	encounter: { ukSingular: "бій", ukPlural: "бої", enSingular: "encounter", enPlural: "encounters" },
};

function countCollectionChanges(prevArr = [], nextArr = [], kind, isUk, stats) {
	const prev = Array.isArray(prevArr) ? prevArr : [];
	const next = Array.isArray(nextArr) ? nextArr : [];
	if (JSON.stringify(prev) === JSON.stringify(next)) return;

	const prevIds = new Set(prev.map((item) => String(item?.id ?? JSON.stringify(item))));
	const nextIds = new Set(next.map((item) => String(item?.id ?? JSON.stringify(item))));

	let added = 0;
	let removed = 0;
	let modified = 0;

	for (const item of next) {
		const key = String(item?.id ?? JSON.stringify(item));
		if (!prevIds.has(key)) {
			added += 1;
		} else {
			const prevItem = prev.find((p) => String(p?.id ?? JSON.stringify(p)) === key);
			if (JSON.stringify(prevItem) !== JSON.stringify(item)) modified += 1;
		}
	}
	for (const key of prevIds) {
		if (!nextIds.has(key)) removed += 1;
	}

	const labels = COLLECTION_STAT_LABELS[kind] || COLLECTION_STAT_LABELS.note;
	const singularLabel = isUk ? labels.ukSingular : labels.enSingular;
	const pluralLabel = isUk ? labels.ukPlural : labels.enPlural;

	if (added > 0) {
		stats.push({
			label: pluralLabel,
			value: `+${added} ${added === 1 ? singularLabel : pluralLabel}`,
			type: "added",
			kind,
			op: "added",
			count: added,
		});
	}
	if (modified > 0) {
		stats.push({
			label: pluralLabel,
			value: `~${modified} ${modified === 1 ? singularLabel : pluralLabel}`,
			type: "changed",
			kind,
			op: "changed",
			count: modified,
		});
	}
	if (removed > 0) {
		stats.push({
			label: pluralLabel,
			value: `-${removed} ${removed === 1 ? singularLabel : pluralLabel}`,
			type: "info",
			kind,
			op: "removed",
			count: removed,
		});
	}
}

function collectEntityStat(resource, isUk, stats) {
	const entityConfig = {
		characters: { kind: "character", uk: "Персонаж", en: "Character" },
		npc: { kind: "npc", uk: "NPC", en: "NPC" },
		locations: { kind: "location", uk: "Локація", en: "Location" },
	};
	const entry = entityConfig[resource.type] || {
		kind: "entity",
		uk: "Сутність",
		en: "Entity",
	};
	const label = isUk ? entry.uk : entry.en;
	const valueLabel =
		isUk || entry.kind === "npc" ? label : label.toLowerCase();
	if (resource.before === null || resource.before === undefined) {
		stats.push({
			label,
			value: `+1 ${valueLabel}`,
			type: "added",
			kind: entry.kind,
			op: "added",
			count: 1,
		});
	} else if (resource.after === null || resource.after === undefined) {
		stats.push({
			label,
			value: `-1 ${valueLabel}`,
			type: "info",
			kind: entry.kind,
			op: "removed",
			count: 1,
		});
	} else {
		stats.push({
			label,
			value: `~1 ${valueLabel}`,
			type: "changed",
			kind: entry.kind,
			op: "changed",
			count: 1,
		});
	}
}

function collectResourceStats(resource, isUk, stats) {
	if (resource.kind === "entity") {
		collectEntityStat(resource, isUk, stats);
		return;
	}
	if (resource.kind === "custom-monster" || resource.kind === "custom-bestiary") {
		const isNew = resource.before === null || resource.before === undefined;
		const isDeleted = resource.after === null || resource.after === undefined;
		const monsterWord = isUk ? "монстр" : "monster";
		stats.push({
			label: isUk ? "Монстр" : "Monster",
			value: isNew ? `+1 ${monsterWord}` : isDeleted ? `-1 ${monsterWord}` : `~1 ${monsterWord}`,
			type: isNew ? "added" : isDeleted ? "info" : "changed",
			kind: "monster",
			op: isNew ? "added" : isDeleted ? "removed" : "changed",
			count: 1,
		});
		return;
	}
	if (resource.kind === "campaign") {
		const prevDesc = String(resource.before?.description || "").trim();
		const nextDesc = String(resource.after?.description || "").trim();
		if (prevDesc !== nextDesc) {
			const wordsDelta =
				nextDesc.split(/\s+/).filter(Boolean).length -
				prevDesc.split(/\s+/).filter(Boolean).length;
			const wordsUnit = isUk ? "слів" : "words";
			stats.push({
				label: isUk ? "Опис" : "Description",
				value:
					wordsDelta >= 0
						? `+${wordsDelta} ${wordsUnit}`
						: `${wordsDelta} ${wordsUnit}`,
				type: "changed",
				kind: "words",
				delta: wordsDelta,
			});
		}
		countCollectionChanges(resource.before?.notes, resource.after?.notes, "note", isUk, stats);
		return;
	}
	if (resource.kind === "session") {
		const isNewSession =
			resource.before === null || resource.before === undefined;
		const isDeletedSession =
			resource.after === null || resource.after === undefined;
		const sessionLabel = isUk ? "Сесія" : "Session";
		const sessionWord = isUk ? "сесія" : "session";
		if (isNewSession) {
			stats.push({
				label: sessionLabel,
				value: `+1 ${sessionWord}`,
				type: "added",
				kind: "session",
				op: "added",
				count: 1,
			});
		} else if (isDeletedSession) {
			stats.push({
				label: sessionLabel,
				value: `-1 ${sessionWord}`,
				type: "info",
				kind: "session",
				op: "removed",
				count: 1,
			});
		}
		const bData = resource.before?.data || {};
		const aData = resource.after?.data || {};
		countCollectionChanges(bData.scenes, aData.scenes, "scene", isUk, stats);
		countCollectionChanges(bData.notes, aData.notes, "note", isUk, stats);
		countCollectionChanges(bData.npcs, aData.npcs, "session_npc", isUk, stats);
		countCollectionChanges(bData.locations, aData.locations, "session_location", isUk, stats);
		countCollectionChanges(bData.encounters, aData.encounters, "encounter", isUk, stats);
	}
}

/**
 * Formats diff resources into concise readable before/after previews and badge stats.
 */
function formatDiffResourcesForPreview(resources = [], language = "uk") {
	const isUk = isUkrainianLanguage(language);
	const safeResources = Array.isArray(resources) ? resources : [];
	const stats = [];
	const beforeSections = [];
	const afterSections = [];

	for (const resource of safeResources) {
		collectResourceStats(resource, isUk, stats);
		const projected = formatSingleResourceDiff(resource);
		const header = resource.label || resource.name || resource.id || resource.kind;
		beforeSections.push(`[${header}]\n${serializePreviewObject(projected.before)}`);
		afterSections.push(`[${header}]\n${serializePreviewObject(projected.after)}`);
	}

	return {
		stats: stats.slice(0, 6),
		diffSnippet: {
			before: truncatePreviewText(beforeSections.join("\n\n"), isUk),
			after: truncatePreviewText(afterSections.join("\n\n"), isUk),
		},
	};
}

function extractChangedEntityTypes(resources = []) {
	const types = new Set();
	for (const resource of Array.isArray(resources) ? resources : []) {
		if (resource?.kind === "entity" && resource.type) {
			types.add(resource.type);
		}
	}
	return Array.from(types);
}

function buildActionHistoryPath(campaignSlug, sessionFileName, encounterId) {
	return {
		campaign: campaignSlug,
		...(sessionFileName ? { session: sessionFileName } : {}),
		...(encounterId !== undefined && encounterId !== null && encounterId !== ""
			? { encounter: encounterId }
			: {}),
	};
}

function buildActionHistoryContext({
	payload,
	responsePath,
	modelName,
	language,
	title,
	sceneId,
	simplifiedNotes,
	historyWriter,
}) {
	const requestSnapshot = historyWriter.buildRequestSnapshot({
		type: "chat-action",
		modelName,
		userInstructions: title,
		path: responsePath,
		sceneId,
		parseAIResponse: true,
		shouldParseAIResponse: true,
		generateCharacters: true,
		generateNpcs: true,
		generateLocations: true,
		generateEncounters: true,
		generateCustomMonsters: true,
		editEncounterCreatures: Boolean(responsePath.encounter),
		entityScope: responsePath.session ? "mixed" : "campaign",
		language,
		simplifiedNotes,
	});
	return {
		payload,
		path: responsePath,
		type: "chat-action",
		modelName,
		responseLanguage: language,
		historyUserInstructions: title,
		requestSnapshot,
	};
}

function buildGeneratedOperationPayload({
	operations,
	responsePath,
	sceneId,
	mentionCandidateNames,
	fillCurrentTargetIds,
	applyMentionsToGeneratedContent,
}) {
	const payload = {
		version: 2,
		operations: JSON.parse(JSON.stringify(operations)),
	};
	fillCurrentTargetIds(payload, {
		path: responsePath,
		sceneId,
		customMonsterTarget: null,
	});
	if (Array.isArray(mentionCandidateNames) && mentionCandidateNames.length > 0) {
		applyMentionsToGeneratedContent(payload, mentionCandidateNames);
	}
	return payload;
}

const FULL_PERMISSIONS = Object.freeze({
	allowCharacters: true,
	allowNpcs: true,
	allowLocations: true,
	allowEncounters: true,
	allowCustomMonsters: true,
	allowEncounterCreatureEditing: true,
});

/**
 * Simulates pending action cards in draft mode or applies non-destructive cards when autoApply is enabled.
 */
async function prepareChatActionCards(
	{
		storage,
		applyAiOperations,
		historyWriter,
		buildCustomMonsterChangeResources,
		fillCurrentTargetIds,
		applyMentionsToGeneratedContent,
		validateAiGeneratedContent,
		createId = storage.createId,
	},
	{
		rawActions = [],
		campaignSlug,
		sessionFileName = "",
		encounterId = null,
		sceneId = null,
		modelName = "",
		language = "uk",
		simplifiedNotes = false,
		autoApply = false,
		mutationPermission = "diff_only",
		mentionCandidateNames = [],
	},
) {
	const actionCards = [];
	const appliedActionIds = [];
	const changedEntityTypesSet = new Set();
	const warnings = [];
	let lastUpdated = null;
	let cachedSessions = null;

	const mergedRawActions = mergeDependentRawActions(rawActions);

	for (const raw of mergedRawActions) {
		if (!isObject(raw) || !Array.isArray(raw.operations) || raw.operations.length === 0) {
			continue;
		}

		const createsNewSession = hasCreateSessionOperation(raw.operations);
		let effectiveSessionFileName = createsNewSession ? "" : asText(sessionFileName);
		const effectiveEncounterId = createsNewSession ? null : encounterId;
		const effectiveSceneId = createsNewSession ? null : sceneId;

		if (
			!createsNewSession &&
			!effectiveSessionFileName &&
			campaignSlug !== "bestiary" &&
			operationsRequireSession(raw.operations)
		) {
			if (!cachedSessions) {
				cachedSessions =
					typeof storage.listSessions === "function"
						? await storage.listSessions(campaignSlug).catch(() => [])
						: [];
			}
			if (Array.isArray(cachedSessions) && cachedSessions.length > 0) {
				const lastSession = cachedSessions[cachedSessions.length - 1];
				effectiveSessionFileName = asText(lastSession?.fileName);
			}
			if (!effectiveSessionFileName) {
				warnings.push(
					isUkrainianLanguage(language)
						? "У кампанії ще немає жодної сесії — спочатку створіть сесію, щоб додати сцену або сутичку."
						: "This campaign has no sessions yet — create a session first to add a scene or encounter.",
				);
				continue;
			}
		}

		const preApplyResponsePath = buildActionHistoryPath(
			campaignSlug,
			effectiveSessionFileName,
			effectiveEncounterId,
		);
		const targetSessionData =
			!createsNewSession &&
			effectiveSessionFileName &&
			campaignSlug !== "bestiary" &&
			typeof storage.readSession === "function"
				? await storage.readSession(campaignSlug, effectiveSessionFileName).catch(() => null)
				: null;
		const normalizedOperations = normalizeActionOperationsForExecution(raw.operations, {
			sessionData: targetSessionData,
			sceneId: effectiveSceneId,
			language,
		});

		const generatedPayload = buildGeneratedOperationPayload({
			operations: normalizedOperations,
			responsePath: preApplyResponsePath,
			sceneId: effectiveSceneId,
			mentionCandidateNames,
			fillCurrentTargetIds,
			applyMentionsToGeneratedContent,
		});
		const validation = validateAiGeneratedContent(generatedPayload, {
			type: "campaign",
			requireExplicitEntityScope: false,
		});
		if (!validation.valid || generatedPayload.operations.length === 0) {
			if (!validation.valid && Array.isArray(validation.errors) && validation.errors.length > 0) {
				const reason = validation.errors
					.slice(0, 2)
					.map((err) => `${err.path || "op"}: ${err.message}`)
					.join("; ");
				warnings.push(
					isUkrainianLanguage(language)
						? `Операції відхилено валідацією (${reason}).`
						: `Operations rejected by validation (${reason}).`,
				);
			}
			continue;
		}

		const isUk = isUkrainianLanguage(language);
		const cardId = `act-${createId()}`;
		const title = asText(raw.title) || (isUk ? "Дія асистента" : "Assistant action");
		const beforeApplyBundle =
			campaignSlug === "bestiary"
				? { meta: { slug: "bestiary", name: "Bestiary" }, sessions: [], entities: {}, aiResponses: [] }
				: await storage.exportCampaignBundle(campaignSlug);
		const applied = await applyAiOperations({
			payload: generatedPayload,
			campaignSlug,
			sessionFile: effectiveSessionFileName || null,
			encounterId: effectiveEncounterId ?? null,
			entityScope:
				campaignSlug === "bestiary"
					? "custom-bestiary"
					: createsNewSession || effectiveSessionFileName
						? "mixed"
						: "campaign",
			simplifiedNotes: Boolean(simplifiedNotes),
			permissions: FULL_PERMISSIONS,
		});
		const resolvedSessionFileName = asText(
			applied.createdSessionFile || effectiveSessionFileName,
		);
		const cardResponsePath = buildActionHistoryPath(
			campaignSlug,
			resolvedSessionFileName,
			effectiveEncounterId,
		);
		const extraChangeResources = applied.customBestiaryChange?.hasChanges
			? buildCustomMonsterChangeResources(
					applied.customBestiaryChange.before,
					applied.customBestiaryChange.after,
				)
			: [];
		const shouldAutoApply =
			(Boolean(autoApply) || mutationPermission === "direct_mutation") &&
			!isDestructiveOperationList(generatedPayload.operations);
		const historyContext = buildActionHistoryContext({
			payload: generatedPayload,
			responsePath: cardResponsePath,
			modelName,
			language,
			title,
			sceneId: effectiveSceneId,
			simplifiedNotes,
			historyWriter,
		});

		const aiResponse = shouldAutoApply
			? await historyWriter.saveParsed({
					beforeApplyBundle,
					generatedContent: generatedPayload,
					path: cardResponsePath,
					type: "chat-action",
					modelName,
					language,
					userInstructions: title,
					requestSnapshot: historyContext.requestSnapshot,
					retryPayload: generatedPayload,
					extraChangeResources,
				})
			: await historyWriter.saveDraftParsed({
					beforeApplyBundle,
					generatedContent: generatedPayload,
					path: cardResponsePath,
					type: "chat-action",
					modelName,
					language,
					userInstructions: title,
					requestSnapshot: historyContext.requestSnapshot,
					retryPayload: generatedPayload,
					extraChangeResources,
				});

		const resources = aiResponse?.changes?.resources || [];
		if (resources.length === 0) {
			if (Array.isArray(applied.warnings) && applied.warnings.length > 0) {
				warnings.push(...applied.warnings);
			} else {
				warnings.push(
					isUk
						? `Дія «${title}» не внесла змін у кампанію.`
						: `Action "${title}" made no changes to the campaign.`,
				);
			}
			continue;
		}

		const cardSessionFileName =
			createsNewSession && !shouldAutoApply ? "" : resolvedSessionFileName;
		const preview = formatDiffResourcesForPreview(resources, language);
		const card = {
			id: cardId,
			type: raw.kind === "atomic" ? "atomic" : "diff",
			title,
			...(raw.subtitle ? { subtitle: asText(raw.subtitle) } : {}),
			...(raw.description ? { description: asText(raw.description) } : {}),
			...(raw.targetEntity ? { targetEntity: asText(raw.targetEntity) } : {}),
			...(raw.targetType ? { targetType: asText(raw.targetType) } : {}),
			...(cardSessionFileName ? { targetSessionFileName: cardSessionFileName } : {}),
			...(preview.stats.length > 0 ? { stats: preview.stats } : {}),
			status: shouldAutoApply ? "applied" : "pending",
			diffSnippet: preview.diffSnippet,
			diffResources: resources,
			operations: generatedPayload.operations,
			...(aiResponse?.id ? { aiResponseId: String(aiResponse.id) } : {}),
			...(shouldAutoApply ? { appliedAt: Date.now() } : {}),
		};

		actionCards.push(card);
		if (shouldAutoApply) {
			appliedActionIds.push(cardId);
			if (applied.updated) lastUpdated = applied.updated;
			for (const t of extractChangedEntityTypes(resources)) {
				changedEntityTypesSet.add(t);
			}
		}
	}

	return {
		actionCards,
		updated: lastUpdated,
		appliedActionIds,
		changedEntityTypes: Array.from(changedEntityTypesSet),
		warnings,
	};
}

/**
 * Applies a pending or undone chat action card to the live campaign state and records undoable AI history.
 */
async function applyChatActionCard(
	{
		storage,
		applyAiOperations,
		historyWriter,
		buildCustomMonsterChangeResources,
		validateAiGeneratedContent,
		restoreAiResponseSnapshot,
	},
	{
		actionCard,
		campaignSlug,
		sessionFileName = "",
		encounterId = null,
		sceneId = null,
		modelName = "",
		language = "uk",
		simplifiedNotes = false,
		useDraftSnapshot = false,
	},
) {
	if (
		useDraftSnapshot &&
		actionCard?.aiResponseId &&
		typeof restoreAiResponseSnapshot === "function"
	) {
		const responses = await storage.readAiResponses(campaignSlug);
		const entry = (Array.isArray(responses) ? responses : []).find(
			(item) => String(item?.id ?? "") === String(actionCard.aiResponseId),
		);
		if (entry) {
			const restored = await restoreAiResponseSnapshot(entry, "after");
			const resources =
				restored?.response?.changes?.resources ||
				entry?.changes?.resources ||
				[];
			const preview = formatDiffResourcesForPreview(resources);
			const nextCard = {
				...actionCard,
				status: "applied",
				appliedAt: Date.now(),
				...(entry?.path?.session
					? { targetSessionFileName: String(entry.path.session) }
					: {}),
				...(entry?.id ? { aiResponseId: String(entry.id) } : {}),
				...(preview.stats.length > 0 ? { stats: preview.stats } : {}),
				...(resources.length > 0
					? { diffSnippet: preview.diffSnippet, diffResources: resources }
					: {}),
			};
			return {
				actionCard: nextCard,
				updated: restored?.updated || null,
				aiResponse: restored?.response || entry,
				changedEntityTypes: extractChangedEntityTypes(resources),
			};
		}
	}

	if (!Array.isArray(actionCard?.operations) || actionCard.operations.length === 0) {
		const error = new Error("Action card has no executable operations.");
		error.status = 400;
		throw error;
	}

	const createsNewSession = hasCreateSessionOperation(actionCard.operations);
	const effectiveSessionFileName = createsNewSession
		? ""
		: asText(actionCard?.targetSessionFileName || sessionFileName);
	const effectiveEncounterId = createsNewSession ? null : encounterId;
	const effectiveSceneId = createsNewSession ? null : sceneId;
	const targetSessionData =
		!createsNewSession &&
		effectiveSessionFileName &&
		campaignSlug !== "bestiary" &&
		typeof storage.readSession === "function"
			? await storage.readSession(campaignSlug, effectiveSessionFileName).catch(() => null)
			: null;
	const normalizedOperations = normalizeActionOperationsForExecution(actionCard.operations, {
		sessionData: targetSessionData,
		sceneId: effectiveSceneId,
		language,
	});
	const payload = {
		version: 2,
		operations: normalizedOperations,
	};
	const validation = validateAiGeneratedContent(payload, {
		type: "campaign",
		requireExplicitEntityScope: false,
	});
	if (!validation.valid) {
		const error = new Error("Action operations are invalid.");
		error.status = 400;
		error.details = validation.errors;
		throw error;
	}

	const beforeApplyBundle =
		campaignSlug === "bestiary"
			? { meta: { slug: "bestiary", name: "Bestiary" }, sessions: [], entities: {}, aiResponses: [] }
			: await storage.exportCampaignBundle(campaignSlug);
	const applied = await applyAiOperations({
		payload,
		campaignSlug,
		sessionFile: effectiveSessionFileName || null,
		encounterId: effectiveEncounterId ?? null,
		entityScope:
			campaignSlug === "bestiary"
				? "custom-bestiary"
				: createsNewSession || effectiveSessionFileName
					? "mixed"
					: "campaign",
		simplifiedNotes: Boolean(simplifiedNotes),
		permissions: FULL_PERMISSIONS,
	});
	const finalSessionFileName = asText(
		applied.createdSessionFile || effectiveSessionFileName,
	);
	const responsePath = buildActionHistoryPath(
		campaignSlug,
		finalSessionFileName,
		effectiveEncounterId,
	);
	const extraChangeResources = applied.customBestiaryChange?.hasChanges
		? buildCustomMonsterChangeResources(
				applied.customBestiaryChange.before,
				applied.customBestiaryChange.after,
			)
		: [];
	const fallbackActionTitle = isUkrainianLanguage(language)
		? "Дія асистента"
		: "Assistant action";
	const historyContext = buildActionHistoryContext({
		payload,
		responsePath,
		modelName,
		language,
		title: actionCard.title || fallbackActionTitle,
		sceneId: effectiveSceneId,
		simplifiedNotes,
		historyWriter,
	});
	const aiResponse = await historyWriter.saveParsed({
		beforeApplyBundle,
		generatedContent: payload,
		path: responsePath,
		type: "chat-action",
		modelName,
		language,
		userInstructions: actionCard.title || fallbackActionTitle,
		requestSnapshot: historyContext.requestSnapshot,
		retryPayload: payload,
		extraChangeResources,
	});
	const resources = aiResponse?.changes?.resources || [];
	const preview = formatDiffResourcesForPreview(resources, language);
	const nextCard = {
		...actionCard,
		status: "applied",
		appliedAt: Date.now(),
		...(finalSessionFileName ? { targetSessionFileName: finalSessionFileName } : {}),
		...(aiResponse?.id ? { aiResponseId: String(aiResponse.id) } : {}),
		...(preview.stats.length > 0 ? { stats: preview.stats } : {}),
		...(resources.length > 0
			? { diffSnippet: preview.diffSnippet, diffResources: resources }
			: {}),
	};

	return {
		actionCard: nextCard,
		updated: applied.updated || null,
		aiResponse,
		changedEntityTypes: extractChangedEntityTypes(resources),
	};
}

/**
 * Undoes a previously applied chat action card via its linked AI history snapshot.
 */
async function undoChatActionCard(
	{ storage, restoreAiResponseSnapshot },
	{ actionCard, campaignSlug },
) {
	const responseId = asText(actionCard?.aiResponseId);
	if (!responseId) {
		const error = new Error("Action card has no linked AI history record to undo.");
		error.status = 400;
		throw error;
	}
	const responses = await storage.readAiResponses(campaignSlug);
	const entry = (Array.isArray(responses) ? responses : []).find(
		(item) => String(item?.id ?? "") === responseId,
	);
	if (!entry) {
		const error = new Error("AI history entry for this action was not found.");
		error.status = 404;
		throw error;
	}
	const restored = await restoreAiResponseSnapshot(entry, "before");
	const nextCard = {
		...actionCard,
		status: "undone",
		appliedAt: null,
	};
	return {
		actionCard: nextCard,
		updated: restored?.updated || null,
		aiResponse: restored?.response || null,
		changedEntityTypes: extractChangedEntityTypes(entry?.changes?.resources),
	};
}

module.exports = {
	isDestructiveOperationList,
	formatDiffResourcesForPreview,
	prepareChatActionCards,
	applyChatActionCard,
	undoChatActionCard,
};
