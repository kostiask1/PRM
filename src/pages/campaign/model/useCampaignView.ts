import {
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";

import { campaignApi } from "../../../entities/campaign/index.js";
import type {
	CampaignPartialArchiveSection,
} from "../../../entities/campaign/index.js";
import { sessionApi } from "../../../entities/session/index.js";
import type { SessionRecord } from "../../../entities/session/index.js";
import {
	useCampaignEntityCollection,
	useCampaignEntityOrdering,
	useCampaignEntityPersistence,
} from "../../../features/campaign-entity/index.js";

const api = { ...campaignApi, ...sessionApi };
import { sanitizeNotesForSave, upsertNoteById } from "../../../shared/lib/index.js";
import type { SharedNote } from "../../../shared/lib/index.js";
import { downloadBlob } from "../../../shared/lib/index.js";
import {
	addUndoSnapshot,
	clearRedoStack,
	createDistinctRedoTransition,
	createDistinctUndoTransition,
	isHistoryShortcutEvent,
	shouldUseAppHistoryForEvent,
} from "../../../shared/lib/index.js";
import { lang } from "../../../shared/lib/index.js";
import { getEntityDisplayName } from "../../../entities/campaign/index.js";
import {
	areHistoryStatesEqual,
	campaignHistoryPayload,
	cloneHistoryList,
	getLocationDisplayName,
	normalizeMentionName,
	replaceMentionsInValue,
	sanitizeEntityForSave,
	sanitizeLoadedEntity,
} from "../../../features/campaign/index.js";
import type {
	CampaignAiUpdateOptions,
	CampaignGraphNoteSave,
	CampaignHistoryState,
	CampaignPageCampaign,
	CampaignPageEntity,
	CampaignSessionDetail,
	CampaignSessionDetails,
	DescriptionChangeEvent,
	UseCampaignViewProps,
} from "./contracts.ts";
import { useCampaignPageRuntime } from "./CampaignPageRuntime.tsx";
import {
	getCampaignKeyboardAction,
	isCampaignEditableTarget,
} from "./campaignPagePresentation.ts";
import {
	applyCampaignGraphCampaignNoteSave,
	executeCampaignGraphSessionNoteSave,
	getCampaignGraphNoteSavePlan,
} from "./campaignGraphNoteSave.ts";
import type { CampaignGraphSessionNoteSavePlan } from "./campaignGraphNoteSave.ts";
import {
	executeCampaignAiEntityReload,
	executeCampaignDelete,
	executeCampaignImageCheck,
	executeCampaignRename,
	executeCampaignSessionCreation,
	executeCampaignSyncPlan,
	getCampaignAiUpdatePlan,
	getCampaignDeleteConfirmationConfig,
	getCampaignRenameErrorMessage,
	getCampaignRenamePlan,
	getCampaignSessionCreationErrorMessage,
	getCampaignSessionCreationPlan,
	getCampaignSyncPlan,
	getCampaignViewEntities,
	getCampaignViewStateProjection,
	type CampaignDeleteConfirmation,
} from "./campaignViewOrchestration.ts";

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function getCampaignKeyboardActionFromEvent(
	event: KeyboardEvent,
) {
	const target = event.target instanceof HTMLElement ? event.target : null;
	return getCampaignKeyboardAction({
		code: event.code,
		shiftKey: event.shiftKey,
		isHistoryShortcut: isHistoryShortcutEvent(event),
		shouldUseAppHistory: shouldUseAppHistoryForEvent(event),
		isEditableTarget: isCampaignEditableTarget(target),
	});
}

export default function useCampaignView(props: UseCampaignViewProps) {
	const { campaign } = props;
	const {
		entityRefreshVersion,
		navigateToCampaignList,
		navigateToRenamedCampaign,
		navigateToSession,
		requestCampaignReload,
		requestConfirmation,
		requestPrompt,
		showMessage,
		syncEvent,
	} = useCampaignPageRuntime();
	const initialCampaignState = getCampaignViewStateProjection(campaign);

	const [sessions, setSessions] = useState<SessionRecord[]>([]);
	const [sessionDetails, setSessionDetails] = useState<CampaignSessionDetails>({});
	const [isGraphDataLoading, setIsGraphDataLoading] = useState(false);
	const [graphDataError, setGraphDataError] = useState("");
	const isGraphDataLoadingRef = useRef(false);
	const sessionDetailsRef = useRef<CampaignSessionDetails>({});
	const [description, setDescription] = useState(initialCampaignState.description);
	const [notes, setNotes] = useState(initialCampaignState.notes);
	const [characters, setCharacters] = useState<CampaignPageEntity[]>(
		getCampaignViewEntities(campaign.characters),
	);
	const [npcs, setNpcs] = useState<CampaignPageEntity[]>([]);
	const [locations, setLocations] = useState<CampaignPageEntity[]>([]);
	const [isDescriptionCollapsed, setIsDescriptionCollapsed] = useState(
		initialCampaignState.isDescriptionCollapsed,
	);
	const [isNotesCollapsed, setIsNotesCollapsed] = useState(
		initialCampaignState.isNotesCollapsed,
	);
	const [isCharactersCollapsed, setIsCharactersCollapsed] = useState(
		initialCampaignState.isCharactersCollapsed,
	);
	const [isNpcsCollapsed, setIsNpcsCollapsed] = useState(
		initialCampaignState.isNpcsCollapsed,
	);
	const [isLocationsCollapsed, setIsLocationsCollapsed] = useState(
		initialCampaignState.isLocationsCollapsed,
	);
	const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
	const pendingCampaignUpdatesRef = useRef<Partial<CampaignPageCampaign> | null>(null);
	const isSavingRef = useRef(false);
	const [undoStack, setUndoStack] = useState<CampaignHistoryState[]>([]);
	const [redoStack, setRedoStack] = useState<CampaignHistoryState[]>([]);
	const isUpdatingHistory = useRef(false);
	const lastSlugRef = useRef(campaign.slug);
	const {
		clearSave: clearEntitySaveTimer,
		discardSaves: discardEntitySaveTimers,
		flushSaves: flushEntitySaves,
		scheduleSave: scheduleEntityUpdate,
	} = useCampaignEntityPersistence({
		campaignSlug: campaign.slug,
		sanitizeEntity: sanitizeEntityForSave,
	});

	const applyCampaignState = useCallback((nextCampaign: Partial<CampaignPageCampaign>) => {
		const nextState = getCampaignViewStateProjection(nextCampaign);
		setDescription(nextState.description);
		setNotes(nextState.notes);
		setIsDescriptionCollapsed(nextState.isDescriptionCollapsed);
		setIsNotesCollapsed(nextState.isNotesCollapsed);
		setIsCharactersCollapsed(nextState.isCharactersCollapsed);
		setIsNpcsCollapsed(nextState.isNpcsCollapsed);
		setIsLocationsCollapsed(nextState.isLocationsCollapsed);
	}, []);

	const discardCampaignSaveTimer = useCallback(() => {
		if (saveTimeout.current) {
			clearTimeout(saveTimeout.current);
			saveTimeout.current = null;
		}
		pendingCampaignUpdatesRef.current = null;
	}, []);

	const loadCharacters = useCallback(async () => {
		try {
			const data = await api.getEntities(campaign.slug, "characters");
			setCharacters((data || []).map(sanitizeLoadedEntity));
		} catch (err) {
			console.error("Failed to load characters", err);
		}
	}, [campaign.slug]);

	const loadNpcs = useCallback(async () => {
		try {
			const data = await api.getEntities(campaign.slug, "npc");
			setNpcs((data || []).map(sanitizeLoadedEntity));
		} catch (err) {
			console.error("Failed to load NPCs", err);
		}
	}, [campaign.slug]);

	const loadLocations = useCallback(async () => {
		try {
			const data = await api.getEntities(campaign.slug, "locations");
			setLocations((data || []).map(sanitizeLoadedEntity));
		} catch (err) {
			console.error("Failed to load locations", err);
		}
	}, [campaign.slug]);

	useEffect(() => {
		loadCharacters();
		loadNpcs();
		loadLocations();
	}, [loadCharacters, loadNpcs, loadLocations]);

	useEffect(() => {
		sessionDetailsRef.current = sessionDetails;
	}, [sessionDetails]);

	useEffect(() => {
		if (lastSlugRef.current !== campaign.slug) {
			applyCampaignState({
				description: campaign.description,
				notes: campaign.notes,
				isDescriptionCollapsed: campaign.isDescriptionCollapsed,
				isNotesCollapsed: campaign.isNotesCollapsed,
				isCharactersCollapsed: campaign.isCharactersCollapsed,
				isNpcsCollapsed: campaign.isNpcsCollapsed,
				isLocationsCollapsed: campaign.isLocationsCollapsed,
			});
			setSessionDetails({});
			sessionDetailsRef.current = {};
			setIsGraphDataLoading(false);
			isGraphDataLoadingRef.current = false;
			setGraphDataError("");
			setUndoStack([]);
			setRedoStack([]);
			lastSlugRef.current = campaign.slug;
		}
	}, [
		campaign.description,
		campaign.isCharactersCollapsed,
		campaign.isDescriptionCollapsed,
		campaign.isLocationsCollapsed,
		campaign.isNotesCollapsed,
		campaign.isNpcsCollapsed,
		campaign.notes,
		campaign.slug,
		applyCampaignState,
	]);

	useEffect(() => {
		if (lastSlugRef.current !== campaign.slug) return;
		if (isSavingRef.current || pendingCampaignUpdatesRef.current) return;

		applyCampaignState({
			description: campaign.description,
			notes: campaign.notes,
			isDescriptionCollapsed: campaign.isDescriptionCollapsed,
			isNotesCollapsed: campaign.isNotesCollapsed,
			isCharactersCollapsed: campaign.isCharactersCollapsed,
			isNpcsCollapsed: campaign.isNpcsCollapsed,
			isLocationsCollapsed: campaign.isLocationsCollapsed,
		});
	}, [
		campaign.description,
		campaign.isCharactersCollapsed,
		campaign.isDescriptionCollapsed,
		campaign.isLocationsCollapsed,
		campaign.isNotesCollapsed,
		campaign.isNpcsCollapsed,
		campaign.notes,
		campaign.slug,
		applyCampaignState,
	]);

	useEffect(() => {
		if (entityRefreshVersion === 0) return;
		loadCharacters();
		loadNpcs();
		loadLocations();
	}, [entityRefreshVersion, loadCharacters, loadNpcs, loadLocations]);

	const saveToServer = useCallback(
		async (updates: Partial<CampaignPageCampaign> | null) => {
			if (!updates) return;
			isSavingRef.current = true;
			try {
				await api.updateCampaign(campaign.slug, updates);
			} catch (err) {
				console.error("Failed to save campaign updates", err);
			} finally {
				isSavingRef.current = false;
			}
		},
		[campaign.slug],
	);

	const flushCampaignSave = useCallback(async () => {
		if (saveTimeout.current) {
			clearTimeout(saveTimeout.current);
			saveTimeout.current = null;
		}

		const updates = pendingCampaignUpdatesRef.current;
		pendingCampaignUpdatesRef.current = null;
		if (updates) await saveToServer(updates);
	}, [saveToServer]);

	const createHistoryState = useCallback(
		(): CampaignHistoryState => ({
			description,
			notes: cloneHistoryList(notes),
			characters: cloneHistoryList(characters),
			npcs: cloneHistoryList(npcs),
			locations: cloneHistoryList(locations),
			completed: campaign.completed,
			completedAt: campaign.completedAt,
		}),
		[
			description,
			notes,
			characters,
			npcs,
			locations,
			campaign.completed,
			campaign.completedAt,
		],
	);

	const restoreHistoryState = useCallback(
		async (state: CampaignHistoryState) => {
			discardEntitySaveTimers();
			discardCampaignSaveTimer();

			const nextNotes = cloneHistoryList<SharedNote>(state.notes);
			const nextCharacters = cloneHistoryList(state.characters);
			const nextNpcs = cloneHistoryList(state.npcs);
			const nextLocations = cloneHistoryList(state.locations);

			setDescription(state.description || "");
			setNotes(nextNotes);
			setCharacters(nextCharacters);
			setNpcs(nextNpcs);
			setLocations(nextLocations);

			await Promise.all([
				api.updateCampaign(campaign.slug, campaignHistoryPayload(state)),
				api.replaceEntities(campaign.slug, "characters", nextCharacters),
				api.replaceEntities(campaign.slug, "npc", nextNpcs),
				api.replaceEntities(campaign.slug, "locations", nextLocations),
			]);
		},
		[campaign.slug, discardCampaignSaveTimer, discardEntitySaveTimers],
	);

	const handleUndo = useCallback(async () => {
		if (undoStack.length === 0) return;

		const currentState = createHistoryState();
		const transition = createDistinctUndoTransition({
			undoStack,
			redoStack,
			current: currentState,
			isEqual: areHistoryStatesEqual,
		});

		if (transition.target) {
			isUpdatingHistory.current = true;
			setRedoStack(transition.redoStack);
			setUndoStack(transition.undoStack);

			try {
				await restoreHistoryState(transition.target);
			} catch (err) {
				console.error("Failed to restore campaign undo state", err);
				showMessage({
					title: lang.t("Error"),
					message: lang.t("Failed to update entity."),
				});
				loadCharacters();
				loadNpcs();
				loadLocations();
			} finally {
				isUpdatingHistory.current = false;
			}
		}
	}, [
		undoStack,
		redoStack,
		createHistoryState,
		restoreHistoryState,
		loadCharacters,
		loadNpcs,
		loadLocations,
		showMessage,
	]);

	const handleRedo = useCallback(async () => {
		if (redoStack.length === 0) return;

		const currentState = createHistoryState();
		const transition = createDistinctRedoTransition({
			undoStack,
			redoStack,
			current: currentState,
			isEqual: areHistoryStatesEqual,
		});

		if (transition.target) {
			isUpdatingHistory.current = true;
			setUndoStack(transition.undoStack);
			setRedoStack(transition.redoStack);

			try {
				await restoreHistoryState(transition.target);
			} catch (err) {
				console.error("Failed to restore campaign redo state", err);
				showMessage({
					title: lang.t("Error"),
					message: lang.t("Failed to update entity."),
				});
				loadCharacters();
				loadNpcs();
				loadLocations();
			} finally {
				isUpdatingHistory.current = false;
			}
		}
	}, [
		undoStack,
		redoStack,
		createHistoryState,
		restoreHistoryState,
		loadCharacters,
		loadNpcs,
		loadLocations,
		showMessage,
	]);

	const pushToUndo = useCallback(() => {
		if (!isUpdatingHistory.current) {
			setUndoStack((prev) => addUndoSnapshot(prev, createHistoryState()));
			setRedoStack(clearRedoStack());
		}
	}, [createHistoryState]);

	const triggerSave = useCallback(
		(updates: Partial<CampaignPageCampaign>) => {
			pendingCampaignUpdatesRef.current = {
				...(pendingCampaignUpdatesRef.current || {}),
				...updates,
			};
			if (saveTimeout.current) clearTimeout(saveTimeout.current);

			saveTimeout.current = setTimeout(async () => {
				saveTimeout.current = null;
				const pendingUpdates = pendingCampaignUpdatesRef.current;
				pendingCampaignUpdatesRef.current = null;
				saveToServer(pendingUpdates);
			}, 500);
		},
		[saveToServer],
	);

	const applyMentionRenameToLocalState = useCallback(
		(oldName: string, newName: string) => {
			if (
				!normalizeMentionName(oldName) ||
				!String(newName || "").trim() ||
				normalizeMentionName(oldName) === normalizeMentionName(newName)
			) {
				return;
			}

			setDescription((prev) => replaceMentionsInValue(prev, oldName, newName));
			setNotes((prev) => replaceMentionsInValue(prev, oldName, newName));
			setCharacters((prev) => replaceMentionsInValue(prev, oldName, newName));
			setNpcs((prev) => replaceMentionsInValue(prev, oldName, newName));
			setLocations((prev) => replaceMentionsInValue(prev, oldName, newName));
		},
		[],
	);

	const confirmMentionReferenceUpdate = useCallback(
		async (oldName: string, newName: string): Promise<boolean> => {
			if (
				!normalizeMentionName(oldName) ||
				!String(newName || "").trim() ||
				normalizeMentionName(oldName) === normalizeMentionName(newName)
			) {
				return true;
			}

			return Boolean(
				await requestConfirmation({
					title: lang.t("Update links?"),
					message: lang.t(
						'Update links in the project from "{oldName}" to "{newName}"?',
						{ oldName, newName },
					),
				}),
			);
		},
		[requestConfirmation],
	);
	const reportEntityWorkflowError = useCallback(
		(message: string, error: unknown) => {
			console.error(message, error);
			showMessage({
				title: lang.t("Error"),
				message: lang.t("Failed to update entity."),
			});
		},
		[showMessage],
	);
	const characterWorkflow = useCampaignEntityCollection({
		campaignSlug: campaign.slug,
		type: "characters",
		entities: characters,
		setEntities: setCharacters,
		getDisplayName: (entity) => getEntityDisplayName(entity, "characters"),
		sanitizeEntity: sanitizeEntityForSave,
		normalizeEntity: sanitizeLoadedEntity,
		scheduleSave: scheduleEntityUpdate,
		clearSave: clearEntitySaveTimer,
		confirmMentionUpdate: confirmMentionReferenceUpdate,
		applyMentionRename: applyMentionRenameToLocalState,
		reload: loadCharacters,
		pushUndo: pushToUndo,
		onError: reportEntityWorkflowError,
	});
	const npcWorkflow = useCampaignEntityCollection({
		campaignSlug: campaign.slug,
		type: "npc",
		entities: npcs,
		setEntities: setNpcs,
		getDisplayName: (entity) => getEntityDisplayName(entity, "npc"),
		sanitizeEntity: sanitizeEntityForSave,
		normalizeEntity: sanitizeLoadedEntity,
		scheduleSave: scheduleEntityUpdate,
		clearSave: clearEntitySaveTimer,
		confirmMentionUpdate: confirmMentionReferenceUpdate,
		applyMentionRename: applyMentionRenameToLocalState,
		reload: loadNpcs,
		pushUndo: pushToUndo,
		onError: reportEntityWorkflowError,
	});
	const locationWorkflow = useCampaignEntityCollection({
		campaignSlug: campaign.slug,
		type: "locations",
		entities: locations,
		setEntities: setLocations,
		getDisplayName: getLocationDisplayName,
		sanitizeEntity: sanitizeEntityForSave,
		normalizeEntity: sanitizeLoadedEntity,
		scheduleSave: scheduleEntityUpdate,
		clearSave: clearEntitySaveTimer,
		confirmMentionUpdate: confirmMentionReferenceUpdate,
		applyMentionRename: applyMentionRenameToLocalState,
		reload: loadLocations,
		pushUndo: pushToUndo,
		onError: reportEntityWorkflowError,
	});
	const {
		change: handleCharacterChange,
		remove: handleDeleteCharacter,
		rename: handleCharacterNameBlur,
		toggleCollapse: handleToggleCharacterCollapse,
	} = characterWorkflow;
	const {
		change: handleNpcChange,
		remove: handleNpcDelete,
		rename: handleNpcNameBlur,
		toggleCollapse: handleToggleNpcCollapse,
	} = npcWorkflow;
	const {
		change: handleLocationChange,
		remove: handleLocationDelete,
		rename: handleLocationNameBlur,
		toggleCollapse: handleToggleLocationCollapse,
	} = locationWorkflow;
	const reportReorderError = useCallback(
		(error: unknown, type: string) => {
			console.error(`Failed to reorder ${type}`, error);
			showMessage({
				title: lang.t("Error"),
				message: lang.t("Failed to update entity."),
			});
		},
		[showMessage],
	);
	const reportMoveError = useCallback(
		(error: unknown) => {
			console.error("Failed to move character entity", error);
			showMessage({
				title: lang.t("Error"),
				message: lang.t("Failed to move entity."),
			});
		},
		[showMessage],
	);
	const {
		finishTrackedReorder,
		moveBetweenCharacterTypes: handleCharacterTypeDrop,
		persistReorder: persistEntitiesReorder,
		reorderCharacters: handleCharactersReorder,
		reorderLocations: handleLocationsReorder,
		reorderNpcs: handleNpcsReorder,
	} = useCampaignEntityOrdering({
		campaignSlug: campaign.slug,
		characters,
		npcs,
		setCharacters,
		setNpcs,
		setLocations,
		sanitizeForSave: sanitizeEntityForSave,
		sanitizeLoaded: sanitizeLoadedEntity,
		clearPendingSave: clearEntitySaveTimer,
		reloadCharacters: loadCharacters,
		reloadNpcs: loadNpcs,
		reloadLocations: loadLocations,
		pushUndo: pushToUndo,
		onReorderError: reportReorderError,
		onMoveError: reportMoveError,
	});

	const handleDescriptionChange = (e: DescriptionChangeEvent) => {
		const val = e.target.value;
		if (!saveTimeout.current) pushToUndo();
		setDescription(val);
		triggerSave({ description: val });
	};

	const handleToggleNoteCollapse = (id: string | number) => {
		const newNotes = notes.map((n) =>
			n.id === id ? { ...n, collapsed: !n.collapsed } : n,
		);
		setNotes(newNotes);
		triggerSave({ notes: sanitizeNotesForSave(newNotes) });
	};

	const handleNoteTitleChange = (id: string | number, title: string) => {
		if (!saveTimeout.current) pushToUndo();
		const newNotes = upsertNoteById(notes, id, { title });

		setNotes(newNotes);
		triggerSave({ notes: sanitizeNotesForSave(newNotes) });
	};

	const handleNoteChange = (id: string | number, text: string) => {
		if (!saveTimeout.current) pushToUndo();
		const newNotes = upsertNoteById(notes, id, { text });

		setNotes(newNotes);
		triggerSave({ notes: sanitizeNotesForSave(newNotes) });
	};

	const handleDeleteNote = (id: string | number) => {
		pushToUndo();
		const newNotes = notes.filter((n) => n.id !== id);

		setNotes(newNotes);
		triggerSave({ notes: sanitizeNotesForSave(newNotes) });
	};

	const handleNotesReorder = (newNotes: SharedNote[]) => {
		if (!saveTimeout.current) pushToUndo();
		const sanitizedNotes = sanitizeNotesForSave(newNotes);
		setNotes(sanitizedNotes);
		triggerSave({ notes: sanitizedNotes });
	};


	const loadSessions = useCallback(async () => {
		try {
			const data = await api.listSessions(campaign.slug);
			setSessions(data || []);
		} catch (err) {
			console.error("Failed to load sessions", err);
		}
	}, [campaign.slug]);

	useEffect(() => {
		loadSessions();
	}, [loadSessions]);

	useEffect(() => {
		const plan = getCampaignSyncPlan(syncEvent, campaign.slug);
		executeCampaignSyncPlan(plan, {
			reloadEntities: () => {
			loadCharacters();
			loadNpcs();
			loadLocations();
			},
			reloadSessions: () => {
			loadSessions();
			setSessionDetails({});
			sessionDetailsRef.current = {};
			},
		});
	}, [
		campaign.slug,
		loadCharacters,
		loadLocations,
		loadNpcs,
		loadSessions,
		syncEvent,
	]);

	const loadSessionDetailsForGraph = useCallback(async () => {
		const missingSessions = sessions.filter(
			(session): session is SessionRecord & { fileName: string } =>
				Boolean(session?.fileName && !sessionDetails[session.fileName]),
		);
		if (missingSessions.length === 0 || isGraphDataLoadingRef.current) return;

		isGraphDataLoadingRef.current = true;
		setIsGraphDataLoading(true);
		setGraphDataError("");
		try {
			const loadedEntries: Array<[string, CampaignSessionDetail]> = await Promise.all(
				missingSessions.map(async (session) => [
					session.fileName,
					(await api.getSession(campaign.slug, session.fileName)) as CampaignSessionDetail,
				]),
			);
			setSessionDetails((prev) => ({
				...prev,
				...Object.fromEntries(loadedEntries),
			}));
			sessionDetailsRef.current = {
				...sessionDetailsRef.current,
				...Object.fromEntries(loadedEntries),
			};
		} catch (err) {
			console.error("Failed to load campaign graph session details", err);
			setGraphDataError(getErrorMessage(err) || lang.t("Failed to load sessions"));
		} finally {
			isGraphDataLoadingRef.current = false;
			setIsGraphDataLoading(false);
		}
	}, [campaign.slug, sessionDetails, sessions]);

	const handleCreateSession = async () => {
		const name = await requestPrompt({
			title: lang.t("New session"),
			message: lang.t("Enter a name or leave empty to use current date:"),
		});
		await executeCampaignSessionCreation({
			campaignSlug: campaign.slug,
			plan: getCampaignSessionCreationPlan(name),
			createSession: api.createSession,
			onCreated: (newSession) => {
				setSessions([...sessions, newSession]);
				navigateToSession(campaign.slug, newSession.fileName);
				requestCampaignReload();
			},
			onError: (error) =>
				showMessage({
					title: lang.t("Session creation error"),
					message: getCampaignSessionCreationErrorMessage(error, lang.t),
				}),
		});
	};

	const saveGraphSessionNote = useCallback(
		(plan: CampaignGraphSessionNoteSavePlan) => {
			void executeCampaignGraphSessionNoteSave({
				campaignSlug: campaign.slug,
				plan,
				currentSession: sessionDetailsRef.current[plan.fileName],
				updateSession: api.updateSession,
				onLocalUpdate: (fileName, nextSession) => {
					sessionDetailsRef.current = {
						...sessionDetailsRef.current,
						[fileName]: nextSession,
					};
					setSessionDetails(sessionDetailsRef.current);
				},
				onError: (error) => {
					console.error("Failed to save graph note edit", error);
					setGraphDataError(
						getErrorMessage(error) || lang.t("Failed to update entity."),
					);
				},
			});
		},
		[campaign.slug],
	);

	const handleGraphNoteSave = useCallback(
		(request: CampaignGraphNoteSave) => {
			const plan = getCampaignGraphNoteSavePlan(request);
			if (plan.kind === "none") return;

			if (plan.kind === "campaign-note") {
				if (!saveTimeout.current) pushToUndo();
				setNotes((prev) => {
					const next = applyCampaignGraphCampaignNoteSave(prev, plan);
					triggerSave({ notes: sanitizeNotesForSave(next) });
					return next;
				});
				return;
			}

			saveGraphSessionNote(plan);
		},
		[pushToUndo, saveGraphSessionNote, triggerSave],
	);

	const handleDeleteCampaign = async () => {
		const hasCampaignImages = await executeCampaignImageCheck({
			campaignSlug: campaign.slug,
			checkImages: api.campaignHasImages,
			onError: (error) => console.error("Failed to check campaign images", error),
		});
		const confirmationConfig = getCampaignDeleteConfirmationConfig(
			hasCampaignImages,
			lang.t,
		);
		const result = (await requestConfirmation(
			confirmationConfig,
		)) as CampaignDeleteConfirmation | null;
		await executeCampaignDelete({
			campaignSlug: campaign.slug,
			hasCampaignImages,
			confirmation: result,
			deleteCampaign: api.deleteCampaign,
			onDeleted: () => {
				navigateToCampaignList();
				requestCampaignReload();
			},
			onError: (error) =>
				showMessage({
					title: lang.t("Error"),
					message: lang.t("Failed to delete campaign: {error}", {
						error: getErrorMessage(error),
					}),
				}),
		});
	};

	const handleRename = async () => {
		const name = await requestPrompt({
			title: lang.t("Rename"),
			message: lang.t("Enter a new campaign name:"),
			defaultValue: campaign.name,
		});
		await executeCampaignRename({
			campaignSlug: campaign.slug,
			plan: getCampaignRenamePlan(name, campaign.name),
			renameCampaign: api.updateCampaign,
			onRenamed: (updated) => {
				requestCampaignReload();
				navigateToRenamedCampaign(updated.slug);
			},
			onError: (error) =>
				showMessage({
					title: lang.t("Error"),
					message: getCampaignRenameErrorMessage(error, lang.t),
				}),
		});
	};

	const handleDeleteSession = async (session: SessionRecord) => {
		if (!session.fileName) return;
		const fileName = session.fileName;
		if (
			!(await requestConfirmation({
				title: lang.t("Delete session"),
				message: lang.t('Do you really want to delete session "{name}"?', {
					name: session.name,
				}),
			}))
		)
			return;
		try {
			await api.deleteSession(campaign.slug, fileName);
			const data = await api.listSessions(campaign.slug);
			setSessions(data || []);
			setSessionDetails((prev) => {
				const next = { ...prev };
				delete next[fileName];
				return next;
			});
			requestCampaignReload();
		} catch (err) {
			showMessage({
				title: lang.t("Error"),
				message: lang.t("Failed to delete session: {error}", {
					error: getErrorMessage(err),
				}),
			});
		}
	};

	const handleExport = async () => {
		try {
			const blob = await api.exportCampaignArchive(campaign.slug);
			downloadBlob(
				blob,
				`campaign-${campaign.slug}-${new Date().toISOString().slice(0, 10)}.prma.gz`,
			);
		} catch (err) {
			showMessage({
				title: lang.t("Export error"),
				message: getErrorMessage(err),
			});
		}
	};

	const handleExportPartial = async (
		sections: CampaignPartialArchiveSection[] = [],
	) => {
		try {
			const blob = await api.exportCampaignPartialArchive(
				campaign.slug,
				sections,
			);
			downloadBlob(
				blob,
				`campaign-${campaign.slug}-partial-${new Date().toISOString().slice(0, 10)}.prma.gz`,
			);
		} catch (err) {
			showMessage({
				title: lang.t("Export error"),
				message: getErrorMessage(err),
			});
		}
	};

	const handleImportPartial = async (
		file: Blob,
		sections: CampaignPartialArchiveSection[] = [],
	) => {
		try {
			await api.importCampaignPartialArchive(campaign.slug, file, sections);
			await Promise.all([loadCharacters(), loadNpcs(), loadLocations()]);
			const sessionsData = await api.listSessions(campaign.slug);
			setSessions(sessionsData || []);
			setSessionDetails({});
			sessionDetailsRef.current = {};
			requestCampaignReload();
		} catch (err) {
			showMessage({
				title: lang.t("Import error"),
				message: getErrorMessage(err) || lang.t("Failed to import campaign"),
			});
		}
	};

	const handleSessionReorderDrop = useCallback(
		(nextSessions: SessionRecord[] = sessions) => {
			const orders: Record<string, number> = {};
			nextSessions.forEach((item, idx) => {
				if (item.fileName) orders[item.fileName] = idx;
			});
			api.reorderSessions(campaign.slug, orders);
		},
		[sessions, campaign.slug],
	);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const action = getCampaignKeyboardActionFromEvent(e);
			if (action === "none") return;
			e.preventDefault();
			const handlers = { undo: handleUndo, redo: handleRedo };
			handlers[action]();
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleUndo, handleRedo]);

	useEffect(() => {
		return () => {
			flushCampaignSave();
			flushEntitySaves();
		};
	}, [flushCampaignSave, flushEntitySaves]);

	const handleAiUpdate = async (
		updatedCampaign: Partial<CampaignPageCampaign> | null,
		options: CampaignAiUpdateOptions = {},
	) => {
		pushToUndo();
		const plan = getCampaignAiUpdatePlan(updatedCampaign, options);
		if (plan.campaignState) {
			setDescription(plan.campaignState.description);
			setNotes(plan.campaignState.notes);
		}
		await executeCampaignAiEntityReload({
			campaignSlug: campaign.slug,
			entityTypes: plan.entityTypes,
			getEntities: api.getEntities,
			normalizeEntity: sanitizeLoadedEntity,
			setEntities: {
				characters: setCharacters,
				npc: setNpcs,
				locations: setLocations,
			},
			onError: (error) => console.error("Failed to reload AI-updated entities", error),
		});
		requestCampaignReload();
	};

	return {
		sessions,
		setSessions,
		sessionDetails,
		isGraphDataLoading,
		graphDataError,
		loadSessionDetailsForGraph,
		handleGraphNoteSave,
		description,
		notes,
		setNotes,
		characters,
		setCharacters,
		npcs,
		setNpcs,
		locations,
		setLocations,
		isDescriptionCollapsed,
		setIsDescriptionCollapsed,
		isNotesCollapsed,
		setIsNotesCollapsed,
		isCharactersCollapsed,
		setIsCharactersCollapsed,
		isNpcsCollapsed,
		setIsNpcsCollapsed,
		isLocationsCollapsed,
		setIsLocationsCollapsed,
		undoStack,
		redoStack,
		handleUndo,
		handleRedo,
		triggerSave,
		handleDescriptionChange,
		handleToggleNoteCollapse,
		handleNoteTitleChange,
		handleNoteChange,
		handleDeleteNote,
		handleNotesReorder,
		handleCharactersReorder,
		handleNpcsReorder,
		handleLocationsReorder,
		persistEntitiesReorder,
		finishTrackedReorder,
		handleToggleCharacterCollapse,
		handleCharacterChange,
		handleCharacterNameBlur,
		handleDeleteCharacter,
		handleToggleNpcCollapse,
		handleNpcChange,
		handleNpcNameBlur,
		handleNpcDelete,
		handleCharacterTypeDrop,
		handleToggleLocationCollapse,
		handleLocationChange,
		handleLocationNameBlur,
		handleLocationDelete,
		handleCreateSession,
		handleDeleteCampaign,
		handleRename,
		handleDeleteSession,
		handleExport,
		handleExportPartial,
		handleImportPartial,
		handleAiUpdate,
		handleSessionReorderDrop,
	};
}
