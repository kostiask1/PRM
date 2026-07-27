const crypto = require("crypto");
const { coerceAiText: asText } = require("../../ai/textUtils");
const campaignEntityGateway = require("./campaignEntityGateway");
const {
	entityTypeFromOperation,
	findByIdentity,
	getOperationTargetIdentity,
	getSessionEntityList,
	operationScope,
} = require("./entityOperationUtils");

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

function createNotePatchService({
	createId = () => crypto.randomUUID(),
	entityGateway = campaignEntityGateway,
	text = asText,
} = {}) {
	function normalizeNote(note, { simplifiedNotes = false } = {}) {
		if (typeof note === "string") {
			return {
				id: createId(),
				title: "",
				text: note.trim(),
				collapsed: false,
			};
		}
		if (!note || typeof note !== "object") return null;

		return {
			id: note.id || createId(),
			title: simplifiedNotes ? "" : text(note.title || note.name),
			text: String(note.text ?? note.description ?? note.content ?? ""),
			collapsed: Boolean(note.collapsed),
		};
	}

	function getNoteList(target) {
		if (!Array.isArray(target.notes)) target.notes = [];
		return target.notes;
	}

	function appendNote(target, note, options) {
		const normalized = normalizeNote(note, options);
		if (!normalized) return null;
		getNoteList(target).push(normalized);
		return normalized;
	}

	function updateNote(target, noteId, patch = {}, options) {
		const notes = getNoteList(target);
		const index = notes.findIndex(
			(note) => text(note?.id) === text(noteId),
		);
		if (index < 0) return null;
		const normalized = normalizeNote(
			{ ...notes[index], ...patch, id: notes[index].id },
			options,
		);
		if (!normalized) return null;
		notes[index] = {
			...notes[index],
			...normalized,
			id: notes[index].id,
		};
		return notes[index];
	}

	function deleteNote(target, noteId) {
		const notes = getNoteList(target);
		const index = notes.findIndex(
			(note) => text(note?.id) === text(noteId),
		);
		if (index < 0) return null;
		const [deleted] = notes.splice(index, 1);
		return deleted;
	}

	function findScene(sessionData, operation, clientIdMap) {
		sessionData.data = sessionData.data || {};
		if (!Array.isArray(sessionData.data.scenes)) {
			sessionData.data.scenes = [];
		}
		const identity = getOperationTargetIdentity(operation, clientIdMap);
		const id = text(identity.id);
		return (
			sessionData.data.scenes.find(
				(scene) => text(scene.id) === id,
			) || null
		);
	}

	function getNotesTarget(state, operation) {
		const entity = text(operation.entity).toLowerCase();
		if (entity === "campaign") return state.campaignMeta;
		if (entity === "session") return state.sessionData?.data || null;
		if (entity === "scene") {
			return state.sessionData
				? findScene(
						state.sessionData,
						operation,
						state.clientIdMap,
					)
				: null;
		}

		const type = entityTypeFromOperation(entity);
		if (!type) return null;
		const scope = operationScope(
			operation,
			type === "characters" ? "campaign" : state.defaultEntityScope,
			state.clientIdMap,
		);
		if (scope === "session" && type !== "characters") {
			if (!state.sessionData) return null;
			return findByIdentity(
				getSessionEntityList(state.sessionData, type),
				getOperationTargetIdentity(operation, state.clientIdMap),
				type,
			);
		}
		return (
			state.campaignEntityCache.get(type)?.find((item) =>
				Boolean(
					findByIdentity(
						[item],
						getOperationTargetIdentity(
							operation,
							state.clientIdMap,
						),
						type,
					),
				),
			) || null
		);
	}

	async function ensureCampaignEntityCache(state, type) {
		if (!state.campaignEntityCache.has(type)) {
			state.campaignEntityCache.set(
				type,
				await entityGateway.readCampaignEntityList(
					state.campaignSlug,
					type,
				),
			);
		}
		return state.campaignEntityCache.get(type);
	}

	async function applyNoteOperation(state, operation, options) {
		const entity = text(operation.entity).toLowerCase();
		const type = entityTypeFromOperation(entity);
		if (type) await ensureCampaignEntityCache(state, type);
		const target = getNotesTarget(state, operation);
		if (!target) return null;

		const normalizedOp = text(operation.op).toLowerCase();
		const scope = type
			? operationScope(
					operation,
					type === "characters"
						? "campaign"
						: state.defaultEntityScope,
					state.clientIdMap,
				)
			: "";
		let result = null;
		if (normalizedOp === "appendnote") {
			result = appendNote(
				target,
				operation.note || operationData(operation),
				options,
			);
		} else if (normalizedOp === "updatenote") {
			result = updateNote(
				target,
				operation.noteId || operation.id,
				operation.patch || operation.note || operationData(operation),
				options,
			);
		} else if (normalizedOp === "deletenote") {
			result = deleteNote(
				target,
				operation.noteId || operation.id,
			);
		}

		if (result && type && scope !== "session") {
			const saved = await entityGateway.writeCampaignEntity(
				state.campaignSlug,
				type,
				target,
				target,
			);
			const cached = state.campaignEntityCache.get(type) || [];
			const index = cached.findIndex((item) => item === target);
			if (index >= 0) cached[index] = saved;
		}
		return result;
	}

	return {
		applyNoteOperation,
		normalizeNote,
	};
}

const {
	applyNoteOperation,
	normalizeNote,
} = createNotePatchService();

module.exports = {
	applyNoteOperation,
	createNotePatchService,
	normalizeNote,
};
