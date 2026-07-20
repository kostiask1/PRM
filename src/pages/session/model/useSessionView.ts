import {
	type Dispatch,
	type MouseEvent,
	type SetStateAction,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";

import {
	alert,
	confirm,
	prompt,
	refreshEntitiesAction,
	requestCampaignsReloadAction,
	setActiveSessionAction,
} from "../../../shared/model/index.js";
import { campaignApi } from "../../../entities/campaign/index.js";
import type { CampaignEntityRecord } from "../../../entities/campaign/index.js";
import { sessionApi } from "../../../entities/session/index.js";
import type { SessionRecord } from "../../../entities/session/index.js";
import {
	useCampaignEntityScopeMovement,
	type CampaignEntitySession,
} from "../../../features/campaign-entity/index.js";
import {
	useEncounterCreation,
	type EncounterCreationSession,
	type EncounterScene,
} from "../../../features/encounter-editor/index.js";
import {
	useSessionEditing,
	useSessionHistory,
	useSessionPersistence,
	type SessionResourceId,
	type SessionScene,
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
import {
	getSessionEntityDisplayName,
	normalizeSessionEntities,
	normalizeSessionEntity,
	sessionEntityKey,
} from "./sessionEntityModel.ts";
import type {
	SessionChecklistItem,
	SessionLoadOptions,
	SessionPageSession,
	SessionSyncEvent,
} from "./contracts.ts";
import {
	getSessionKeyboardAction,
	getSessionSyncAction,
} from "./sessionPagePresentation.ts";

interface ActiveCampaign {
	slug: string;
}

type SessionUpdate = Partial<SessionPageSession>;
type SessionEntityUpdater = (
	entities: import("./sessionEntityModel.ts").SessionPageEntity[],
) => import("./sessionEntityModel.ts").SessionPageEntity[];

function getKeyboardActionFromEvent(event: KeyboardEvent) {
	const target = event.target instanceof HTMLElement ? event.target : null;
	return getSessionKeyboardAction({
		key: event.key,
		code: event.code,
		shiftKey: event.shiftKey,
		isHistoryShortcut: isHistoryShortcutEvent(event),
		shouldUseAppHistory: shouldUseAppHistoryForEvent(event),
		isEditableTarget:
			target?.tagName === "INPUT" ||
			target?.tagName === "TEXTAREA" ||
			Boolean(target?.isContentEditable),
	});
}

export default function useSessionView() {
	const dispatch = useAppDispatch();
	const campaign = useAppSelector(
		(state) => state.active.campaign,
	) as ActiveCampaign;
	const sessionId = useAppSelector(
		(state) => state.navigation.activeSessionFileName,
	) || "";
	const syncEvent = useAppSelector(
		(state) => state.sync.event,
	) as SessionSyncEvent | null;

	const [session, setSession] = useState<SessionPageSession | null>(null);
	const [isChecklistOpen, setIsChecklistOpen] = useState(false);

	const campaignSlug = campaign.slug;
	const handleBack = useCallback(() => {
		navigateTo(campaignSlug, null);
	}, [campaignSlug]);
	const handleSessionRenamed = useCallback(
		(result: SessionRecord) => {
			navigateTo(campaignSlug, result.fileName, true);
			dispatch(requestCampaignsReloadAction());
		},
		[campaignSlug, dispatch],
	);
	const reportSessionSaveError = useCallback((error: unknown) => {
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
	const normalizeSceneNotes = useCallback((scenes: SessionScene[] = []) => {
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
		(nextSession: unknown): SessionPageSession => {
			const source =
				nextSession && typeof nextSession === "object"
					? (nextSession as SessionPageSession)
					: {};
			if (!source.data) return source;
			return {
				...source,
				data: {
					...source.data,
					notes: source.data.notes || [],
					scenes: normalizeSceneNotes(source.data.scenes || []),
					npcs: normalizeSessionEntities("npc", source.data.npcs),
					locations: normalizeSessionEntities(
						"locations",
						source.data.locations,
					),
				},
			};
		},
		[normalizeSceneNotes],
	);
	const setScopeSession = useCallback<
		Dispatch<
			SetStateAction<CampaignEntitySession | SessionRecord | null>
		>
	>((value) => {
		setSession((current) => {
			const next =
				typeof value === "function" ? value(current) : value;
			return next ? normalizeLoadedSession(next) : null;
		});
	}, [normalizeLoadedSession]);
	const setEncounterSession = useCallback<
		Dispatch<
			SetStateAction<EncounterCreationSession | SessionRecord | null>
		>
	>((value) => {
		setSession((current) => {
			const next =
				typeof value === "function" ? value(current) : value;
			return next ? normalizeLoadedSession(next) : null;
		});
	}, [normalizeLoadedSession]);

	const lastLoadedSessionIdRef = useRef<string | null>(null);

	const loadSession = useCallback(
		async ({ force = false }: SessionLoadOptions = {}) => {
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
		const action = getSessionSyncAction(
			syncEvent,
			campaignSlug,
			sessionId,
			hasPendingSave(),
		);
		if (action === "discard-and-reload") {
			discardPendingSessionSave();
			loadSession({ force: true });
			return;
		}
		if (action === "reload") loadSession({ force: true });
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
		const handleKeyDown = (e: KeyboardEvent) => {
			if (document.querySelector(".Modal__overlay")) return;
			const action = getKeyboardActionFromEvent(e);
			if (action === "none") return;
			e.preventDefault();
			const handlers = { back: handleBack, undo: handleUndo, redo: handleRedo };
			handlers[action]();
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleBack, handleUndo, handleRedo]);

	const updateSession = (updates: SessionUpdate, instant = false): void => {
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

	const updateData = (key: string, value: unknown, instant = false): void => {
		if (!session) return;
		const nextData = { ...session.data, [key]: value };
		updateSession({ data: nextData }, instant);
	};

	const updateSessionEntityList = (
		type: import("./sessionEntityModel.ts").SessionEntityType,
		updater: SessionEntityUpdater,
		instant = false,
	): void => {
		if (!session) return;
		const key = sessionEntityKey(type);
		const current = normalizeSessionEntities(type, session.data?.[key]);
		const next = updater(current);
		updateData(key, normalizeSessionEntities(type, next), instant);
	};

	const handleCreateSessionEntity = async (
		type: import("./sessionEntityModel.ts").SessionEntityType,
		payload: Record<string, unknown>,
	): Promise<void> => {
		updateSessionEntityList(
			type,
			(current) => [...current, normalizeSessionEntity(type, payload)],
			true,
		);
	};

	const handleSessionEntityChange = (
		type: import("./sessionEntityModel.ts").SessionEntityType,
		id: string | number | undefined,
		updatedEntity: Record<string, unknown>,
	): void => {
		if (id == null) return;
		updateSessionEntityList(type, (current) =>
			current.map((entity) =>
				idsEqual(entity.id, id)
					? normalizeSessionEntity(type, updatedEntity)
					: entity,
			),
		);
	};

	const handleSessionEntityDelete = (
		type: import("./sessionEntityModel.ts").SessionEntityType,
		id: string | number | undefined,
	): void => {
		if (id == null) return;
		updateSessionEntityList(
			type,
			(current) => current.filter((entity) => !idsEqual(entity.id, id)),
			true,
		);
	};

	const handleSessionEntityToggleCollapse = (
		type: import("./sessionEntityModel.ts").SessionEntityType,
		id: string | number | undefined,
	): void => {
		if (id == null) return;
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

	const handleSessionEntitiesReorder = (
		type: import("./sessionEntityModel.ts").SessionEntityType,
		nextEntities: import("./sessionEntityModel.ts").SessionPageEntity[],
	): void => {
		updateData(
			sessionEntityKey(type),
			normalizeSessionEntities(type, nextEntities),
		);
	};

	const confirmScopeMove = useCallback(
		async (
			targetScope: "campaign" | "session",
			type: string,
			entity: CampaignEntityRecord,
		): Promise<boolean> => {
			const name = getSessionEntityDisplayName(
				type === "locations" ? "locations" : "npc",
				entity,
				lang.t("Untitled"),
			);
			return Boolean(await dispatch(
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
			));
		},
		[dispatch],
	);
	const handleScopeMoveComplete = useCallback(() => {
		dispatch(refreshEntitiesAction());
		dispatch(requestCampaignsReloadAction());
	}, [dispatch]);
	const handleScopeMoveError = useCallback(
		(error: unknown, operation: string) => {
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
		setSession: setScopeSession,
		confirmMove: confirmScopeMove,
		flushPendingSave,
		onMoved: handleScopeMoveComplete,
		onError: handleScopeMoveError,
	});

	const confirmSceneRemoval = useCallback(
		async (): Promise<boolean> =>
			Boolean(await dispatch(
				confirm({
					title: lang.t("Delete scene"),
					message: lang.t(
						"Are you sure? This will also delete the linked combat encounter.",
					),
				}),
			)),
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
		async (_scene: EncounterScene, sceneIndex: number): Promise<string | null> => {
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
			return value === null
				? null
				: typeof value === "string" && value
					? value
					: fallbackName;
		},
		[dispatch],
	);
	const navigateToEncounter = useCallback(
		(
			encounterId: string | number,
			{ fileName, openInNewTab }: { fileName: string; openInNewTab: boolean },
		) =>
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
		(error: unknown) => {
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
		setSession: setEncounterSession,
		flushPendingSave,
		requestEncounterName,
		navigateToEncounter,
		onError: reportEncounterCreationError,
	});
	const handleOpenEncounter = (
		scene: EncounterScene,
		event: MouseEvent | null = null,
	) =>
		openEncounter(scene, {
			openInNewTab: shouldOpenInNewTabFromEvent(event),
		});

	const handleNoteTitleChange = (id: SessionResourceId, title: string) =>
		changeSessionNote(id, { title });
	const handleNoteChange = (id: SessionResourceId, text: string) =>
		changeSessionNote(id, { text });
	const handleToggleNoteCollapse = toggleSessionNoteCollapse;
	const handleDeleteNote = deleteSessionNote;
	const handleToggleSceneNotesCollapse = toggleSceneNotesCollapse;
	const handleSceneNoteTitleChange = (
		sceneId: SessionResourceId,
		noteId: SessionResourceId,
		title: string,
	) =>
		changeSceneNote(sceneId, noteId, { title });
	const handleSceneNoteChange = (
		sceneId: SessionResourceId,
		noteId: SessionResourceId,
		text: string,
	) =>
		changeSceneNote(sceneId, noteId, { text });
	const handleSceneNotesReorder = reorderSceneNotes;
	const handleSceneToggleNoteCollapse = toggleSceneNoteCollapse;
	const handleSceneDeleteNote = deleteSceneNote;
	const handleToggleSectionCollapse = toggleSectionCollapse;

	const handleAiUpdate = useCallback((updatedSession: unknown) => {
		replaceFromExternalUpdate(updatedSession, {
			discardPendingSave: discardPendingSessionSave,
			normalizeSession: normalizeLoadedSession,
		});
	}, [
		discardPendingSessionSave,
		normalizeLoadedSession,
		replaceFromExternalUpdate,
	]);

	const checklistItems: SessionChecklistItem[] = [
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
		if (typeof name === "string" && name && name !== session.name) {
			updateSession({ name }, true);
		}
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
		handleCreateSessionNpc: (payload: Record<string, unknown>) =>
			handleCreateSessionEntity("npc", payload),
		handleCreateSessionLocation: (payload: Record<string, unknown>) =>
			handleCreateSessionEntity("locations", payload),
		handleSessionNpcChange: (id: string | number | undefined, updatedEntity: Record<string, unknown>) =>
			handleSessionEntityChange("npc", id, updatedEntity),
		handleSessionLocationChange: (id: string | number | undefined, updatedEntity: Record<string, unknown>) =>
			handleSessionEntityChange("locations", id, updatedEntity),
		handleSessionNpcDelete: (id: string | number | undefined) => handleSessionEntityDelete("npc", id),
		handleSessionLocationDelete: (id: string | number | undefined) =>
			handleSessionEntityDelete("locations", id),
		handleSessionNpcToggleCollapse: (id: string | number | undefined) =>
			handleSessionEntityToggleCollapse("npc", id),
		handleSessionLocationToggleCollapse: (id: string | number | undefined) =>
			handleSessionEntityToggleCollapse("locations", id),
		handleSessionNpcsReorder: (nextEntities: import("./sessionEntityModel.ts").SessionPageEntity[]) =>
			handleSessionEntitiesReorder("npc", nextEntities),
		handleSessionLocationsReorder: (nextEntities: import("./sessionEntityModel.ts").SessionPageEntity[]) =>
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
