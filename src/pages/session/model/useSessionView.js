import { useCallback, useEffect, useRef, useState } from "react";

import {
	alert,
	confirm,
	prompt,
	refreshEntitiesAction,
	requestCampaignsReloadAction,
	setActiveSessionAction,
} from "../../../shared/model/index.js";
import { campaignApi } from "../../../entities/campaign/index.js";
import { sessionApi } from "../../../entities/session/index.js";
import {
	useCampaignEntityScopeMovement,
} from "../../../features/campaign-entity/index.js";
import { useEncounterCreation } from "../../../features/encounter-editor/index.js";
import {
	useSessionEditing,
	useSessionHistory,
	useSessionPersistence,
} from "../../../features/session-editor/index.js";

const api = { ...campaignApi, ...sessionApi };
import { idsEqual } from "../../../shared/lib/index.js";
import { shouldOpenInNewTabFromEvent } from "../../../shared/lib/index.js";
import {
	isHistoryShortcutEvent,
	shouldUseAppHistoryForEvent,
} from "../../../shared/lib/index.js";
import { navigateTo, useAppDispatch, useAppSelector } from "../../../shared/model/index.js";
import { lang } from "../../../shared/lib/index.js";

function stripInternalFields(entity = {}) {
	return Object.fromEntries(
		Object.entries(entity || {}).filter(([key]) => !key.startsWith("_")),
	);
}

function sessionEntityKey(type) {
	return type === "locations" ? "locations" : "npcs";
}

function normalizeSessionEntity(type, entity = {}) {
	const now = Date.now();
	const source = stripInternalFields(entity);
	if (type === "locations") {
		return {
			id: source.id || `session-locations-${now}`,
			name: source.name || source.title || "",
			description: source.description || "",
			notes: Array.isArray(source.notes) ? source.notes : [],
			imageUrl: source.imageUrl ?? null,
			collapsed: Boolean(source.collapsed),
			isNotesCollapsed: Boolean(source.isNotesCollapsed),
			...source,
			_aiIgnored: Boolean(entity._aiIgnored),
		};
	}
	return {
		id: source.id || `session-npc-${now}`,
		firstName: source.firstName || source.name || "",
		lastName: source.lastName || "",
		race: source.race || "",
		class: source.class || "",
		level: source.level === "" ? "" : source.level || 1,
		motivation: source.motivation || "",
		description: source.description || "",
		trait: source.trait || "",
		notes: Array.isArray(source.notes) ? source.notes : [],
		imageUrl: source.imageUrl ?? null,
		collapsed: Boolean(source.collapsed),
		isNotesCollapsed: Boolean(source.isNotesCollapsed),
		...source,
		_aiIgnored: Boolean(entity._aiIgnored),
	};
}

function normalizeSessionEntities(type, entities) {
	return (Array.isArray(entities) ? entities : []).map((entity) =>
		normalizeSessionEntity(type, entity),
	);
}

function getEntityDisplayName(type, entity = {}) {
	if (type === "locations") {
		return String(entity.name || entity.title || lang.t("Untitled")).trim();
	}
	const fullName = `${entity.firstName || ""} ${entity.lastName || ""}`.trim();
	return String(
		fullName || entity.name || entity.title || lang.t("Untitled"),
	).trim();
}

export default function useSessionView() {
	const dispatch = useAppDispatch();
	const campaign = useAppSelector((state) => state.active.campaign);
	const sessionId = useAppSelector(
		(state) => state.navigation.activeSessionFileName,
	);
	const syncEvent = useAppSelector((state) => state.sync.event);

	const [session, setSession] = useState(null);
	const [isChecklistOpen, setIsChecklistOpen] = useState(false);

	const campaignSlug = campaign.slug;
	const handleBack = useCallback(() => {
		navigateTo(campaignSlug, null);
	}, [campaignSlug]);
	const handleSessionRenamed = useCallback(
		(result) => {
			navigateTo(campaignSlug, result.fileName, true);
			dispatch(requestCampaignsReloadAction());
		},
		[campaignSlug, dispatch],
	);
	const reportSessionSaveError = useCallback((error) => {
		console.error("Save failed", error);
	}, []);
	const {
		discardPendingSave: discardPendingSessionSave,
		flushPendingSave,
		hasPendingSave,
		isSaving,
		scheduleSave: triggerSave,
	} = useSessionPersistence({
		campaignSlug,
		sessionId,
		onSessionRenamed: handleSessionRenamed,
		onSaveError: reportSessionSaveError,
	});
	const {
		handleRedo,
		handleUndo,
		recordDataChange,
		redoStack,
		replaceFromExternalUpdate,
		resetHistory,
		undoStack,
	} = useSessionHistory({ session, setSession, scheduleSave: triggerSave });
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
	const normalizeLoadedSession = useCallback(
		(nextSession) => {
			if (!nextSession?.data) return nextSession;
			return {
				...nextSession,
				data: {
					...nextSession.data,
					notes: nextSession.data.notes || [],
					scenes: normalizeSceneNotes(nextSession.data.scenes || []),
					npcs: normalizeSessionEntities("npc", nextSession.data.npcs),
					locations: normalizeSessionEntities(
						"locations",
						nextSession.data.locations,
					),
				},
			};
		},
		[normalizeSceneNotes],
	);

	const lastLoadedSessionIdRef = useRef(null);

	const loadSession = useCallback(
		async ({ force = false } = {}) => {
			const routeKey = `${campaignSlug}:${sessionId}`;
			if (!force && lastLoadedSessionIdRef.current === routeKey) return;

			try {
				const data = normalizeLoadedSession(
					await api.getSession(campaignSlug, sessionId),
				);

				setSession(data);
				resetHistory();
				lastLoadedSessionIdRef.current = routeKey;
			} catch (err) {
				console.error("Failed to load session", err);
			}
		},
		[campaignSlug, sessionId, normalizeLoadedSession, resetHistory],
	);

	useEffect(() => {
		loadSession();
	}, [loadSession]);

	useEffect(() => {
		if (!syncEvent?.version) return;
		if (syncEvent.campaignSlug && syncEvent.campaignSlug !== campaignSlug) {
			return;
		}
		if (
			syncEvent.sessionFileName &&
			String(syncEvent.sessionFileName) !== String(sessionId)
		) {
			return;
		}
		if (
			!["sessions", "ai", "import", "entities", "images"].includes(
				syncEvent.resource,
			)
		) {
			return;
		}
		if (syncEvent.resource === "ai") {
			discardPendingSessionSave();
			loadSession({ force: true });
			return;
		}
		if (hasPendingSave()) return;

		loadSession({ force: true });
	}, [
		campaignSlug,
		discardPendingSessionSave,
		hasPendingSave,
		loadSession,
		sessionId,
		syncEvent,
	]);

	useEffect(() => {
		dispatch(setActiveSessionAction(session));
	}, [dispatch, session]);

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

			if (
				isHistoryShortcutEvent(e) &&
				(e.target.tagName === "INPUT" ||
					e.target.tagName === "TEXTAREA" ||
					e.target.isContentEditable) &&
				!shouldUseAppHistoryForEvent(e)
			) {
				return;
			}

			if (isHistoryShortcutEvent(e) && e.code === "KeyZ") {
				if (e.shiftKey) {
					e.preventDefault();
					handleRedo();
				} else {
					e.preventDefault();
					handleUndo();
				}
			} else if (isHistoryShortcutEvent(e) && e.code === "KeyY") {
				e.preventDefault();
				handleRedo();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleBack, handleUndo, handleRedo]);

	const updateSession = (updates, instant = false) => {
		setSession((prev) => {
			if (prev && updates.data) {
				recordDataChange(prev.data, updates.data, {
					hasPendingSave: hasPendingSave(),
					instant,
				});
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

	const updateSessionEntityList = (type, updater, instant = false) => {
		if (!session) return;
		const key = sessionEntityKey(type);
		const current = normalizeSessionEntities(type, session.data[key]);
		const next = updater(current);
		updateData(key, normalizeSessionEntities(type, next), instant);
	};

	const handleCreateSessionEntity = async (type, payload) => {
		updateSessionEntityList(
			type,
			(current) => [...current, normalizeSessionEntity(type, payload)],
			true,
		);
	};

	const handleSessionEntityChange = (type, id, updatedEntity) => {
		updateSessionEntityList(type, (current) =>
			current.map((entity) =>
				idsEqual(entity.id, id)
					? normalizeSessionEntity(type, updatedEntity)
					: entity,
			),
		);
	};

	const handleSessionEntityDelete = (type, id) => {
		updateSessionEntityList(
			type,
			(current) => current.filter((entity) => !idsEqual(entity.id, id)),
			true,
		);
	};

	const handleSessionEntityToggleCollapse = (type, id) => {
		updateSessionEntityList(
			type,
			(current) =>
				current.map((entity) =>
					idsEqual(entity.id, id)
						? { ...entity, collapsed: !entity.collapsed }
						: entity,
				),
			true,
		);
	};

	const handleSessionEntitiesReorder = (type, nextEntities) => {
		updateData(
			sessionEntityKey(type),
			normalizeSessionEntities(type, nextEntities),
		);
	};

	const confirmScopeMove = useCallback(
		(targetScope, type, entity) => {
			const name = getEntityDisplayName(type, entity);
			return dispatch(
				confirm({
					title:
						targetScope === "session"
							? lang.t("Move to session")
							: lang.t("Move to campaign"),
					message:
						targetScope === "session"
							? lang.t('Move "{name}" to this session?', { name })
							: lang.t('Move "{name}" to campaign scope?', { name }),
				}),
			);
		},
		[dispatch],
	);
	const handleScopeMoveComplete = useCallback(() => {
		dispatch(refreshEntitiesAction());
		dispatch(requestCampaignsReloadAction());
	}, [dispatch]);
	const handleScopeMoveError = useCallback(
		(error, operation) => {
			console.error(`Failed campaign entity scope operation: ${operation}`, error);
			if (operation === "load") return;
			dispatch(
				alert({
					title: lang.t("Error"),
					message: lang.t("Failed to move entity."),
				}),
			);
		},
		[dispatch],
	);
	const {
		closeScopeImportModal,
		moveCampaignEntityToSession,
		moveSessionEntityToCampaign,
		openCampaignScopeImport,
		scopeImportModal,
	} = useCampaignEntityScopeMovement({
		campaignSlug,
		session,
		setSession,
		confirmMove: confirmScopeMove,
		flushPendingSave,
		onMoved: handleScopeMoveComplete,
		onError: handleScopeMoveError,
	});

	const confirmSceneRemoval = useCallback(
		() =>
			dispatch(
				confirm({
					title: lang.t("Delete scene"),
					message: lang.t(
						"Are you sure? This will also delete the linked combat encounter.",
					),
				}),
			),
		[dispatch],
	);
	const {
		addScene,
		changeSceneNote,
		changeSessionNote,
		deleteSceneNote,
		deleteSessionNote,
		removeScene,
		reorderSceneNotes,
		toggleSceneCollapse,
		toggleSceneNoteCollapse,
		toggleSceneNotesCollapse,
		toggleSectionCollapse,
		toggleSessionNoteCollapse,
		updateScene,
	} = useSessionEditing({ session, updateSession, confirmSceneRemoval });

	const requestEncounterName = useCallback(
		async (_scene, sceneIndex) => {
			const fallbackName = lang.t("Encounter in scene {number}", {
				number: sceneIndex + 1,
			});
			const value = await dispatch(
				prompt({
					title: lang.t("New encounter"),
					message: lang.t("Enter encounter name:"),
					defaultValue: fallbackName,
				}),
			);
			return value === null ? null : value || fallbackName;
		},
		[dispatch],
	);
	const navigateToEncounter = useCallback(
		(encounterId, { fileName, openInNewTab }) =>
			navigateTo(
				campaignSlug,
				fileName,
				false,
				encounterId,
				openInNewTab,
			),
		[campaignSlug],
	);
	const reportEncounterCreationError = useCallback(
		(error) => {
			console.error("Failed to create encounter", error);
			dispatch(
				alert({
					title: lang.t("Error"),
					message: lang.t("Failed to update session."),
				}),
			);
		},
		[dispatch],
	);
	const openEncounter = useEncounterCreation({
		campaignSlug,
		session,
		sessionId,
		setSession,
		flushPendingSave,
		requestEncounterName,
		navigateToEncounter,
		onError: reportEncounterCreationError,
	});
	const handleOpenEncounter = (scene, event = null) =>
		openEncounter(scene, {
			openInNewTab: shouldOpenInNewTabFromEvent(event),
		});

	const handleNoteTitleChange = (id, title) =>
		changeSessionNote(id, { title });
	const handleNoteChange = (id, text) => changeSessionNote(id, { text });
	const handleToggleNoteCollapse = toggleSessionNoteCollapse;
	const handleDeleteNote = deleteSessionNote;
	const handleToggleSceneNotesCollapse = toggleSceneNotesCollapse;
	const handleSceneNoteTitleChange = (sceneId, noteId, title) =>
		changeSceneNote(sceneId, noteId, { title });
	const handleSceneNoteChange = (sceneId, noteId, text) =>
		changeSceneNote(sceneId, noteId, { text });
	const handleSceneNotesReorder = reorderSceneNotes;
	const handleSceneToggleNoteCollapse = toggleSceneNoteCollapse;
	const handleSceneDeleteNote = deleteSceneNote;
	const handleToggleSectionCollapse = toggleSectionCollapse;

	const handleAiUpdate = useCallback((updatedSession) => {
		replaceFromExternalUpdate(updatedSession, {
			discardPendingSave: discardPendingSessionSave,
			normalizeSession: normalizeLoadedSession,
		});
	}, [
		discardPendingSessionSave,
		normalizeLoadedSession,
		replaceFromExternalUpdate,
	]);

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
		sessionNpcs: normalizeSessionEntities("npc", session?.data?.npcs),
		sessionLocations: normalizeSessionEntities(
			"locations",
			session?.data?.locations,
		),
		scopeImportModal,
		isSaving,
		isChecklistOpen,
		setIsChecklistOpen,
		undoStack,
		redoStack,
		campaignSlug,
		triggerSave,
		flushPendingSave,
		handleUndo,
		handleRedo,
		updateSession,
		updateData,
		handleCreateSessionNpc: (payload) =>
			handleCreateSessionEntity("npc", payload),
		handleCreateSessionLocation: (payload) =>
			handleCreateSessionEntity("locations", payload),
		handleSessionNpcChange: (id, updatedEntity) =>
			handleSessionEntityChange("npc", id, updatedEntity),
		handleSessionLocationChange: (id, updatedEntity) =>
			handleSessionEntityChange("locations", id, updatedEntity),
		handleSessionNpcDelete: (id) => handleSessionEntityDelete("npc", id),
		handleSessionLocationDelete: (id) =>
			handleSessionEntityDelete("locations", id),
		handleSessionNpcToggleCollapse: (id) =>
			handleSessionEntityToggleCollapse("npc", id),
		handleSessionLocationToggleCollapse: (id) =>
			handleSessionEntityToggleCollapse("locations", id),
		handleSessionNpcsReorder: (nextEntities) =>
			handleSessionEntitiesReorder("npc", nextEntities),
		handleSessionLocationsReorder: (nextEntities) =>
			handleSessionEntitiesReorder("locations", nextEntities),
		openCampaignScopeImport,
		closeScopeImportModal,
		moveCampaignEntityToSession,
		moveSessionEntityToCampaign,
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
		handleSceneNotesReorder,
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
