import { useCallback, useEffect, useRef, useState } from "react";

import { confirm, prompt, requestCampaignsReloadAction } from "../actions/app";
import { api } from "../api";
import {
	upsertNoteById,
} from "../utils/noteUtils";
import { idsEqual } from "../utils/id";
import { shouldOpenInNewTabFromEvent } from "../utils/navigation.js";
import { navigateTo, useAppDispatch } from "../store/appStore";
import { lang } from "../services/localization";

export default function useSessionView(props) {
	const { campaign, sessionId } = props;
	const dispatch = useAppDispatch();

	const [session, setSession] = useState(null);
	const [isSaving, setIsSaving] = useState(false);
	const [isChecklistOpen, setIsChecklistOpen] = useState(false);
	const saveTimeout = useRef(null);

	const campaignSlug = campaign.slug;
	const handleBack = useCallback(() => {
		navigateTo(campaignSlug, null);
	}, [campaignSlug]);
	const [undoStack, setUndoStack] = useState([]);
	const [redoStack, setRedoStack] = useState([]);
	const isUpdatingHistory = useRef(false);
	const normalizeSceneNotes = useCallback((scenes = []) => {
		return (scenes || []).map((scene) => {
			const notes = scene.notes || [];
			return {
				...scene,
				notes,
				isNotesCollapsed: !!scene.isNotesCollapsed,
			};
		});
	}, []);

	const saveToServer = useCallback(
		async (updatedSession) => {
			if (saveTimeout.current) clearTimeout(saveTimeout.current);
			saveTimeout.current = null;
			setIsSaving(true);
			try {
				const result = await api.updateSession(
					campaignSlug,
					sessionId,
					updatedSession,
				);
				if (result && result.fileName !== sessionId) {
					navigateTo(campaignSlug, result.fileName, true);
					dispatch(requestCampaignsReloadAction());
				}
			} catch (err) {
				console.error("Save failed", err);
			} finally {
				setIsSaving(false);
			}
		},
		[campaignSlug, sessionId, dispatch],
	);

	const triggerSave = useCallback(
		(updatedSession, instant = false) => {
			if (saveTimeout.current) clearTimeout(saveTimeout.current);

			if (instant) {
				saveTimeout.current = null;
				saveToServer(updatedSession);
			} else {
				setIsSaving(true);
				saveTimeout.current = setTimeout(() => {
					saveTimeout.current = null;
					saveToServer(updatedSession);
				}, 250);
			}
		},
		[saveToServer],
	);

	const handleUndo = useCallback(() => {
		if (!session || undoStack.length === 0) return;

		const currentState = {
			data: session.data,
			completed: session.completed,
			completedAt: session.completedAt,
		};

		let tempStack = [...undoStack];
		let stateToRestore = null;

		while (tempStack.length > 0) {
			const candidate = tempStack.pop();
			const isDifferent =
				JSON.stringify(candidate.data) !== JSON.stringify(currentState.data) ||
				candidate.completed !== currentState.completed;

			if (isDifferent) {
				stateToRestore = candidate;
				break;
			}
		}

		if (stateToRestore) {
			isUpdatingHistory.current = true;
			setRedoStack((prev) => [currentState, ...prev]);
			setUndoStack(tempStack);

			setSession((prev) => {
				const updated = {
					...prev,
					data: stateToRestore.data,
					completed: stateToRestore.completed,
					completedAt: stateToRestore.completedAt,
				};
				triggerSave(updated, true);
				return updated;
			});

			setTimeout(() => {
				isUpdatingHistory.current = false;
			}, 0);
		}
	}, [undoStack, session, triggerSave]);

	const handleRedo = useCallback(() => {
		if (!session || redoStack.length === 0) return;

		const currentState = {
			data: session.data,
			completed: session.completed,
			completedAt: session.completedAt,
		};

		let tempStack = [...redoStack];
		let stateToRestore = null;

		while (tempStack.length > 0) {
			const candidate = tempStack.shift();
			const isDifferent =
				JSON.stringify(candidate.data) !== JSON.stringify(currentState.data) ||
				candidate.completed !== currentState.completed;

			if (isDifferent) {
				stateToRestore = candidate;
				break;
			}
		}

		if (stateToRestore) {
			isUpdatingHistory.current = true;
			setUndoStack((prev) => [...prev, currentState]);
			setRedoStack(tempStack);

			setSession((prev) => {
				const updated = {
					...prev,
					data: stateToRestore.data,
					completed: stateToRestore.completed,
					completedAt: stateToRestore.completedAt,
				};
				triggerSave(updated, true);
				return updated;
			});

			setTimeout(() => {
				isUpdatingHistory.current = false;
			}, 0);
		}
	}, [redoStack, session, triggerSave]);

	const lastLoadedSessionIdRef = useRef(null);

	useEffect(() => {
		const loadSession = async () => {
			if (lastLoadedSessionIdRef.current === sessionId) return;

			try {
				const data = await api.getSession(campaignSlug, sessionId);

				data.data.notes = data.data.notes || [];
				data.data.scenes = normalizeSceneNotes(data.data.scenes || []);

				setSession(data);
				setUndoStack([]);
				setRedoStack([]);
				lastLoadedSessionIdRef.current = sessionId;
			} catch (err) {
				console.error("Failed to load session", err);
			}
		};
		loadSession();
	}, [campaignSlug, sessionId, normalizeSceneNotes]);

	useEffect(() => {
		const handleKeyDown = (e) => {
			if (document.querySelector(".Modal__overlay")) return;

			if (e.key === "Backspace" || e.key === "Escape") {
				const isInput =
					e.target.tagName === "INPUT" ||
					e.target.tagName === "TEXTAREA" ||
					e.target.isContentEditable;
				if (!isInput) {
					e.preventDefault();
					handleBack();
				}
			}

			const isMod = e.ctrlKey || e.metaKey;
			const key = e.key.toLowerCase();

			if (isMod && (key === "z" || key === "я")) {
				if (e.shiftKey) {
					e.preventDefault();
					handleRedo();
				} else {
					e.preventDefault();
					handleUndo();
				}
			} else if (isMod && (key === "y" || key === "н")) {
				e.preventDefault();
				handleRedo();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleBack, handleUndo, handleRedo]);

	const updateSession = (updates, instant = false) => {
		setSession((prev) => {
			if (!isUpdatingHistory.current && prev) {
				const currentState = {
					data: prev.data,
					completed: prev.completed,
					completedAt: prev.completedAt,
				};

				const isDataChanged =
					updates.data &&
					JSON.stringify(updates.data) !== JSON.stringify(prev.data);
				const isStatusChanged =
					updates.completed !== undefined &&
					updates.completed !== prev.completed;

				if (
					(isDataChanged || isStatusChanged) &&
					(!saveTimeout.current || instant)
				) {
					setUndoStack((currentStack) => [...currentStack, currentState]);
					setRedoStack([]);
				}
			}

			const next = { ...prev, ...updates };
			triggerSave(next, instant);
			return next;
		});
	};

	const updateData = (key, value, instant = false) => {
		if (!session) return;
		const nextData = { ...session.data, [key]: value };
		updateSession({ data: nextData }, instant);
	};

	const addScene = () => {
		if (!session) return;
		const scenes = session.data.scenes || [];
		updateData(
			"scenes",
			[
				...scenes,
				{
					id: Date.now(),
					texts: {},
					collapsed: false,
					isNotesCollapsed: false,
					notes: [],
				},
			],
			true,
		);
	};

	const updateScene = (sceneId, field, value, isTopLevel = false) => {
		if (!session) return;
		const scenes = session.data.scenes.map((s) => {
			if (s.id !== sceneId) return s;
			if (isTopLevel) return { ...s, [field]: value };
			return { ...s, texts: { ...s.texts, [field]: value } };
		});
		updateData("scenes", scenes);
	};

	const toggleSceneCollapse = (sceneId) => {
		if (!session) return;
		const scenes = session.data.scenes.map((s) =>
			s.id === sceneId ? { ...s, collapsed: !s.collapsed } : s,
		);
		updateData("scenes", scenes, true);
	};

	const handleOpenEncounter = async (scene, event = null) => {
		if (!session) return;
		let encounterId = scene.encounterId;
		const openInNewTab = shouldOpenInNewTabFromEvent(event);

		if (!encounterId) {
			const sceneIndex = session.data.scenes.findIndex(
				(s) => s.id === scene.id,
			);
			const name = await dispatch(
				prompt({
					title: lang.t("New encounter"),
					message: lang.t("Enter encounter name:"),
					defaultValue: lang.t("Encounter in scene {number}", {
						number: sceneIndex + 1,
					}),
				}),
			);
			if (name === null) return;

			encounterId = Date.now().toString();
			const newEncounter = {
				id: encounterId,
				name:
					name ||
					lang.t("Encounter in scene {number}", { number: sceneIndex + 1 }),
				monsters: [],
			};

			const currentEncounters = session.data.encounters || [];
			const updatedScenes = session.data.scenes.map((s) =>
				s.id === scene.id ? { ...s, encounterId } : s,
			);

			const nextData = {
				...session.data,
				encounters: [...currentEncounters, newEncounter],
				scenes: updatedScenes,
			};

			await api.updateSession(campaignSlug, sessionId, {
				...session,
				data: nextData,
			});

			setSession((prev) => ({ ...prev, data: nextData }));
		}

		navigateTo(campaignSlug, sessionId, false, encounterId, openInNewTab);
	};

	const removeScene = async (sceneId) => {
		if (!session) return;
		const scene = session.data.scenes.find((s) => s.id === sceneId);
		if (!scene) return;

		const hasTextData = Object.values(scene.texts || {}).some(
			(val) => val && val.trim() !== "",
		);
		const hasEncounter = !!scene.encounterId;

		if (hasTextData || hasEncounter) {
			const confirmed = await dispatch(
				confirm({
					title: lang.t("Delete scene"),
					message: lang.t(
						"Are you sure? This will also delete the linked combat encounter.",
					),
				}),
			);
			if (!confirmed) return;
		}

		const nextData = { ...session.data };

		if (scene.encounterId) {
			nextData.encounters = (nextData.encounters || []).filter(
				(e) => !idsEqual(e.id, scene.encounterId),
			);
		}

		nextData.scenes = (nextData.scenes || []).filter((s) => s.id !== sceneId);
		updateSession({ data: nextData }, true);
	};

	const handleNoteTitleChange = (id, title) => {
		if (!session) return;
		const notes = session.data.notes || [];
		const newNotes = upsertNoteById(notes, id, { title });

		updateData("notes", newNotes);
	};

	const handleNoteChange = (id, text) => {
		if (!session) return;
		const notes = session.data.notes || [];
		const newNotes = upsertNoteById(notes, id, { text });

		updateData("notes", newNotes);
	};

	const handleToggleNoteCollapse = (id) => {
		if (!session) return;
		const notes = session.data.notes.map((n) =>
			n.id === id ? { ...n, collapsed: !n.collapsed } : n,
		);
		updateData("notes", notes, true);
	};

	const handleDeleteNote = (id) => {
		if (!session) return;
		const newNotes = (session.data.notes || []).filter((n) => n.id !== id);

		updateData("notes", newNotes, true);
	};

	const updateSceneById = (sceneId, updater, instant = false) => {
		if (!session) return;
		const scenes = (session.data.scenes || []).map((scene) =>
			scene.id === sceneId ? updater(scene) : scene,
		);
		updateData("scenes", scenes, instant);
	};

	const handleToggleSceneNotesCollapse = (sceneId) => {
		updateSceneById(
			sceneId,
			(scene) => ({ ...scene, isNotesCollapsed: !scene.isNotesCollapsed }),
			true,
		);
	};

	const handleSceneNoteTitleChange = (sceneId, noteId, title) => {
		updateSceneById(sceneId, (scene) => {
			const notes = upsertNoteById(scene.notes || [], noteId, { title });
			return { ...scene, notes };
		});
	};

	const handleSceneNoteChange = (sceneId, noteId, text) => {
		updateSceneById(sceneId, (scene) => {
			const notes = upsertNoteById(scene.notes || [], noteId, { text });
			return { ...scene, notes };
		});
	};

	const handleSceneToggleNoteCollapse = (sceneId, noteId) => {
		updateSceneById(
			sceneId,
			(scene) => ({
				...scene,
				notes: (scene.notes || []).map((note) =>
					note.id === noteId ? { ...note, collapsed: !note.collapsed } : note,
				),
			}),
			true,
		);
	};

	const handleSceneDeleteNote = (sceneId, noteId) => {
		updateSceneById(
			sceneId,
			(scene) => {
				const notes = (scene.notes || []).filter((note) => note.id !== noteId);
				return { ...scene, notes };
			},
			true,
		);
	};

	const handleToggleSectionCollapse = (key) => {
		if (!session) return;
		const isCollapsed = !!session.data[`is${key}Collapsed`];
		updateData(`is${key}Collapsed`, !isCollapsed, true);
	};

	const handleAiUpdate = (updatedSession) => {
		if (!session) return;

		setUndoStack((prev) => [
			...prev,
			{
				data: session.data,
				completed: session.completed,
				completedAt: session.completedAt,
			},
		]);
		setRedoStack([]);

		isUpdatingHistory.current = true;

		updatedSession.data.notes = updatedSession.data.notes || [];
		updatedSession.data.scenes = normalizeSceneNotes(
			updatedSession.data.scenes || [],
		);

		setSession(updatedSession);
		setTimeout(() => {
			isUpdatingHistory.current = false;
		}, 0);
	};

	const checklistItems = [
		{ id: "goal", label: lang.t("Define the main session goal") },
		{ id: "conflict", label: lang.t("Formulate the main conflict") },
		{
			id: "social",
			label: lang.t("Prepare a social scene"),
			note: lang.t("Negotiation, interrogation, argument."),
		},
		{
			id: "exploration",
			label: lang.t("Prepare an exploration scene"),
			note: lang.t("Location, puzzle, trap."),
		},
		{
			id: "combat",
			label: lang.t("Prepare a combat / tension scene"),
			note: lang.t("Risk and pressure."),
		},
	];

	const totalChecks = checklistItems.length;
	const completedChecks = checklistItems.filter(
		(item) => session?.data?.[`${item.id}_check`],
	).length;
	const progress = Math.round((completedChecks / totalChecks) * 100);

	const handleRename = async () => {
		if (!session) return;
		const name = await dispatch(
			prompt({
				title: lang.t("Rename"),
				message: lang.t("Enter a new session name:"),
				defaultValue: session.name,
			}),
		);
		if (name && name !== session.name) updateSession({ name }, true);
	};

	const handleDeleteSessionAndBack = async () => {
		if (!session) return;
		if (
			await dispatch(
				confirm({
					title: lang.t("Delete session"),
					message: lang.t('Delete session "{name}"?', {
						name: session.name,
					}),
				}),
			)
		) {
			await api.deleteSession(campaignSlug, sessionId);
			handleBack();
			dispatch(requestCampaignsReloadAction());
		}
	};

	return {
		session,
		isSaving,
		isChecklistOpen,
		setIsChecklistOpen,
		undoStack,
		redoStack,
		campaignSlug,
		triggerSave,
		handleUndo,
		handleRedo,
		updateSession,
		updateData,
		addScene,
		updateScene,
		toggleSceneCollapse,
		handleOpenEncounter,
		removeScene,
		handleNoteTitleChange,
		handleNoteChange,
		handleToggleNoteCollapse,
		handleDeleteNote,
		handleToggleSceneNotesCollapse,
		handleSceneNoteTitleChange,
		handleSceneNoteChange,
		handleSceneToggleNoteCollapse,
		handleSceneDeleteNote,
		handleToggleSectionCollapse,
		handleAiUpdate,
		checklistItems,
		progress,
		handleBack,
		handleRename,
		handleDeleteSessionAndBack,
	};
}
