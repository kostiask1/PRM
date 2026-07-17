import { useCallback } from "react";
import type { SharedNote } from "../../../shared/lib/index.js";
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
	type SessionEditorData,
	type SessionEditorSession,
	type SessionResourceId,
	type SessionScene,
} from "./sessionMutations.ts";

type UpdateSession = (
	updates: Partial<SessionEditorSession>,
	instant?: boolean,
) => void;

interface SessionEditingOptions {
	session: SessionEditorSession | null;
	updateSession: UpdateSession;
	confirmSceneRemoval: (scene: SessionScene) => boolean | Promise<boolean>;
}

export interface SessionEditing {
	addScene: () => void;
	changeSceneNote: (
		sceneId: SessionResourceId,
		noteId: SessionResourceId,
		patch: Partial<SharedNote>,
	) => void;
	changeSessionNote: (
		noteId: SessionResourceId,
		patch: Partial<SharedNote>,
	) => void;
	deleteSceneNote: (
		sceneId: SessionResourceId,
		noteId: SessionResourceId,
	) => void;
	deleteSessionNote: (noteId: SessionResourceId) => void;
	removeScene: (sceneId: SessionResourceId) => Promise<void>;
	reorderSceneNotes: (
		sceneId: SessionResourceId,
		notes: SharedNote[],
	) => void;
	toggleSceneCollapse: (sceneId: SessionResourceId) => void;
	toggleSceneNoteCollapse: (
		sceneId: SessionResourceId,
		noteId: SessionResourceId,
	) => void;
	toggleSceneNotesCollapse: (sceneId: SessionResourceId) => void;
	toggleSectionCollapse: (key: string) => void;
	toggleSessionNoteCollapse: (noteId: SessionResourceId) => void;
	updateScene: (
		sceneId: SessionResourceId,
		field: string,
		value: unknown,
		isTopLevel?: boolean,
	) => void;
}

export function useSessionEditing({
	session,
	updateSession,
	confirmSceneRemoval,
}: SessionEditingOptions): SessionEditing {
	const changeData = useCallback(
		(updater: (data: SessionEditorData) => SessionEditorData, instant = false) => {
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
