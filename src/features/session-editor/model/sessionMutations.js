import { sanitizeNotesForSave, upsertNoteById } from "../../../shared/lib/index.js";

export const createEmptyScene = (id = Date.now()) => ({
	id,
	texts: {},
	collapsed: false,
	isNotesCollapsed: false,
	notes: [],
});

export const addScene = (data = {}, scene = createEmptyScene()) => ({
	...data,
	scenes: [...(data.scenes || []), scene],
});

export const updateSceneById = (data = {}, sceneId, updater) => ({
	...data,
	scenes: (data.scenes || []).map((scene) =>
		scene.id === sceneId ? updater(scene) : scene,
	),
});

export const updateSceneField = (
	data,
	sceneId,
	field,
	value,
	isTopLevel = false,
) =>
	updateSceneById(data, sceneId, (scene) =>
		isTopLevel
			? { ...scene, [field]: value }
			: { ...scene, texts: { ...scene.texts, [field]: value } },
	);

export const toggleSceneCollapse = (data, sceneId) =>
	updateSceneById(data, sceneId, (scene) => ({
		...scene,
		collapsed: !scene.collapsed,
	}));

export const sceneRequiresDeleteConfirmation = (scene = {}) =>
	Boolean(scene.encounterId) ||
	Object.values(scene.texts || {}).some(
		(value) => typeof value === "string" && value.trim() !== "",
	);

export const removeScene = (data = {}, sceneId) => {
	const scene = (data.scenes || []).find((item) => item.id === sceneId);
	if (!scene) return data;
	return {
		...data,
		encounters: scene.encounterId
			? (data.encounters || []).filter(
					(encounter) => String(encounter.id) !== String(scene.encounterId),
				)
			: data.encounters,
		scenes: (data.scenes || []).filter((item) => item.id !== sceneId),
	};
};

export const updateSessionNote = (data = {}, noteId, patch) => ({
	...data,
	notes: upsertNoteById(data.notes || [], noteId, patch),
});

export const toggleSessionNoteCollapse = (data = {}, noteId) => ({
	...data,
	notes: (data.notes || []).map((note) =>
		note.id === noteId ? { ...note, collapsed: !note.collapsed } : note,
	),
});

export const deleteSessionNote = (data = {}, noteId) => ({
	...data,
	notes: (data.notes || []).filter((note) => note.id !== noteId),
});

export const updateSceneNote = (data, sceneId, noteId, patch) =>
	updateSceneById(data, sceneId, (scene) => ({
		...scene,
		notes: upsertNoteById(scene.notes || [], noteId, patch),
	}));

export const reorderSceneNotes = (data, sceneId, notes) =>
	updateSceneById(data, sceneId, (scene) => ({
		...scene,
		notes: sanitizeNotesForSave(notes),
	}));

export const toggleSceneNoteCollapse = (data, sceneId, noteId) =>
	updateSceneById(data, sceneId, (scene) => ({
		...scene,
		notes: (scene.notes || []).map((note) =>
			note.id === noteId ? { ...note, collapsed: !note.collapsed } : note,
		),
	}));

export const deleteSceneNote = (data, sceneId, noteId) =>
	updateSceneById(data, sceneId, (scene) => ({
		...scene,
		notes: (scene.notes || []).filter((note) => note.id !== noteId),
	}));

export const toggleSessionSection = (data = {}, key) => {
	const property = `is${key}Collapsed`;
	return { ...data, [property]: !data[property] };
};
