import { useCallback } from "react";

import {
	addScene,
	createEmptyScene,
	deleteSceneNote,
	deleteSessionNote,
	removeScene,
	reorderSceneNotes,
	sceneRequiresDeleteConfirmation,
	toggleSceneCollapse,
	toggleSceneNoteCollapse,
	toggleSessionNoteCollapse,
	toggleSessionSection,
	updateSceneById,
	updateSceneField,
	updateSceneNote,
	updateSessionNote,
} from "./sessionMutations.js";

export function useSessionEditing({ session, updateSession, confirmSceneRemoval }) {
	const changeData = useCallback(
		(updater, instant = false) => {
			if (!session) return;
			updateSession({ data: updater(session.data || {}) }, instant);
		},
		[session, updateSession],
	);

	return {
		addScene: () =>
			changeData((data) => addScene(data, createEmptyScene()), true),
		updateScene: (sceneId, field, value, isTopLevel = false) =>
			changeData((data) =>
				updateSceneField(data, sceneId, field, value, isTopLevel),
			),
		toggleSceneCollapse: (sceneId) =>
			changeData((data) => toggleSceneCollapse(data, sceneId), true),
		removeScene: async (sceneId) => {
			if (!session) return;
			const scene = (session.data?.scenes || []).find(
				(item) => item.id === sceneId,
			);
			if (!scene) return;
			if (
				sceneRequiresDeleteConfirmation(scene) &&
				!(await confirmSceneRemoval(scene))
			) {
				return;
			}
			changeData((data) => removeScene(data, sceneId), true);
		},
		changeSessionNote: (noteId, patch) =>
			changeData((data) => updateSessionNote(data, noteId, patch)),
		toggleSessionNoteCollapse: (noteId) =>
			changeData((data) => toggleSessionNoteCollapse(data, noteId), true),
		deleteSessionNote: (noteId) =>
			changeData((data) => deleteSessionNote(data, noteId), true),
		toggleSceneNotesCollapse: (sceneId) =>
			changeData(
				(data) =>
					updateSceneById(data, sceneId, (scene) => ({
						...scene,
						isNotesCollapsed: !scene.isNotesCollapsed,
					})),
				true,
			),
		changeSceneNote: (sceneId, noteId, patch) =>
			changeData((data) => updateSceneNote(data, sceneId, noteId, patch)),
		reorderSceneNotes: (sceneId, notes) =>
			changeData((data) => reorderSceneNotes(data, sceneId, notes)),
		toggleSceneNoteCollapse: (sceneId, noteId) =>
			changeData(
				(data) => toggleSceneNoteCollapse(data, sceneId, noteId),
				true,
			),
		deleteSceneNote: (sceneId, noteId) =>
			changeData((data) => deleteSceneNote(data, sceneId, noteId), true),
		toggleSectionCollapse: (key) =>
			changeData((data) => toggleSessionSection(data, key), true),
	};
}
