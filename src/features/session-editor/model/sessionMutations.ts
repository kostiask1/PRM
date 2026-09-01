import {
	sanitizeNotesForSave,
	upsertNoteById,
	type SharedNote,
} from "../../../shared/lib/index.js";

export type SessionResourceId = string | number;

export interface SessionEncounter extends Record<string, unknown> {
	id: SessionResourceId;
}

export interface SessionScene extends Record<string, unknown> {
	id: SessionResourceId;
	texts: Record<string, unknown>;
	collapsed: boolean;
	isNotesCollapsed: boolean;
	notes: SharedNote[];
	encounterId?: SessionResourceId | null;
}

export interface SessionEditorData extends Record<string, unknown> {
	scenes?: SessionScene[];
	encounters?: SessionEncounter[];
	notes?: SharedNote[];
}

export interface SessionEditorSession extends Record<string, unknown> {
	id?: SessionResourceId;
	fileName?: string;
	name?: string;
	data?: SessionEditorData;
}

export const createEmptyScene = (
	id: SessionResourceId = Date.now(),
): SessionScene => ({
	id,
	texts: {},
	collapsed: false,
	isNotesCollapsed: false,
	notes: [],
});

export const addScene = (
	data: SessionEditorData = {},
	scene: SessionScene = createEmptyScene(),
): SessionEditorData => ({
	...data,
	scenes: [...(data.scenes || []), scene],
});

export const updateSceneById = (
	data: SessionEditorData = {},
	sceneId: SessionResourceId,
	updater: (scene: SessionScene) => SessionScene,
): SessionEditorData => ({
	...data,
	scenes: (data.scenes || []).map((scene) =>
		scene.id === sceneId ? updater(scene) : scene,
	),
});

export const updateSceneField = (
	data: SessionEditorData,
	sceneId: SessionResourceId,
	field: string,
	value: unknown,
	isTopLevel = false,
): SessionEditorData =>
	updateSceneById(data, sceneId, (scene) =>
		isTopLevel
			? { ...scene, [field]: value }
			: { ...scene, texts: { ...scene.texts, [field]: value } },
	);

export const toggleSceneCollapse = (
	data: SessionEditorData,
	sceneId: SessionResourceId,
): SessionEditorData =>
	updateSceneById(data, sceneId, (scene) => ({
		...scene,
		collapsed: !scene.collapsed,
	}));

export const sceneRequiresDeleteConfirmation = (
	scene: Partial<SessionScene> = {},
): boolean =>
	Boolean(scene.encounterId) ||
	Object.values(scene.texts || {}).some(
		(value) => typeof value === "string" && value.trim() !== "",
	);

export const removeScene = (
	data: SessionEditorData = {},
	sceneId: SessionResourceId,
): SessionEditorData => {
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

export const updateSessionNote = (
	data: SessionEditorData = {},
	noteId: SessionResourceId,
	patch: Partial<SharedNote>,
): SessionEditorData => ({
	...data,
	notes: upsertNoteById(data.notes || [], noteId, patch),
});

export const toggleSessionNoteCollapse = (
	data: SessionEditorData = {},
	noteId: SessionResourceId,
): SessionEditorData => ({
	...data,
	notes: (data.notes || []).map((note) =>
		note.id === noteId ? { ...note, collapsed: !note.collapsed } : note,
	),
});

export const deleteSessionNote = (
	data: SessionEditorData = {},
	noteId: SessionResourceId,
): SessionEditorData => ({
	...data,
	notes: (data.notes || []).filter((note) => note.id !== noteId),
});

export const updateSceneNote = (
	data: SessionEditorData,
	sceneId: SessionResourceId,
	noteId: SessionResourceId,
	patch: Partial<SharedNote>,
): SessionEditorData =>
	updateSceneById(data, sceneId, (scene) => ({
		...scene,
		notes: upsertNoteById(scene.notes || [], noteId, patch),
	}));

export const reorderSceneNotes = (
	data: SessionEditorData,
	sceneId: SessionResourceId,
	notes: SharedNote[],
): SessionEditorData =>
	updateSceneById(data, sceneId, (scene) => ({
		...scene,
		notes: sanitizeNotesForSave(notes),
	}));

export const toggleSceneNoteCollapse = (
	data: SessionEditorData,
	sceneId: SessionResourceId,
	noteId: SessionResourceId,
): SessionEditorData =>
	updateSceneById(data, sceneId, (scene) => ({
		...scene,
		notes: (scene.notes || []).map((note) =>
			note.id === noteId ? { ...note, collapsed: !note.collapsed } : note,
		),
	}));

export const deleteSceneNote = (
	data: SessionEditorData,
	sceneId: SessionResourceId,
	noteId: SessionResourceId,
): SessionEditorData =>
	updateSceneById(data, sceneId, (scene) => ({
		...scene,
		notes: (scene.notes || []).filter((note) => note.id !== noteId),
	}));

export const toggleSessionSection = (
	data: SessionEditorData = {},
	key: string,
): SessionEditorData => {
	const property = `is${key}Collapsed`;
	return { ...data, [property]: !data[property] };
};
