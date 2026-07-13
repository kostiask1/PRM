import { useCallback, useEffect, useRef, useState } from "react";

import {
	alert,
	confirm,
	prompt,
	requestCampaignsReloadAction,
} from "../../../shared/model/index.js";
import { campaignApi } from "../../../entities/campaign/index.js";
import { sessionApi } from "../../../entities/session/index.js";
import {
	useCampaignEntityCollection,
	useCampaignEntityOrdering,
	useCampaignEntityPersistence,
} from "../../../features/campaign-entity/index.js";

const api = { ...campaignApi, ...sessionApi };
import { navigateTo, useAppDispatch, useAppSelector } from "../../../shared/model/index.js";
import { sanitizeNotesForSave, upsertNoteById } from "../../../shared/lib/index.js";
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
} from "../../../features/campaign/campaignStateUtils";

export default function useCampaignView(props) {
	const { campaign } = props;
	const dispatch = useAppDispatch();

	const [sessions, setSessions] = useState([]);
	const [sessionDetails, setSessionDetails] = useState({});
	const [isGraphDataLoading, setIsGraphDataLoading] = useState(false);
	const [graphDataError, setGraphDataError] = useState("");
	const isGraphDataLoadingRef = useRef(false);
	const sessionDetailsRef = useRef({});
	const [description, setDescription] = useState(campaign.description || "");
	const [notes, setNotes] = useState(campaign.notes || []);
	const [characters, setCharacters] = useState(campaign.characters || []);
	const [npcs, setNpcs] = useState([]);
	const [locations, setLocations] = useState([]);
	const [isDescriptionCollapsed, setIsDescriptionCollapsed] = useState(
		campaign.isDescriptionCollapsed || false,
	);
	const [isNotesCollapsed, setIsNotesCollapsed] = useState(
		campaign.isNotesCollapsed || false,
	);
	const [isCharactersCollapsed, setIsCharactersCollapsed] = useState(
		campaign.isCharactersCollapsed || false,
	);
	const [isNpcsCollapsed, setIsNpcsCollapsed] = useState(
		campaign.isNpcsCollapsed || false,
	);
	const [isLocationsCollapsed, setIsLocationsCollapsed] = useState(
		campaign.isLocationsCollapsed || false,
	);
	const saveTimeout = useRef(null);
	const pendingCampaignUpdatesRef = useRef(null);
	const isSavingRef = useRef(false);
	const [undoStack, setUndoStack] = useState([]);
	const [redoStack, setRedoStack] = useState([]);
	const isUpdatingHistory = useRef(false);
	const lastSlugRef = useRef(campaign.slug);
	const entityRefreshVersion = useAppSelector(
		(store) => store.entityRefreshVersion,
	);
	const syncEvent = useAppSelector((store) => store.sync.event);
	const {
		clearSave: clearEntitySaveTimer,
		discardSaves: discardEntitySaveTimers,
		flushSaves: flushEntitySaves,
		scheduleSave: scheduleEntityUpdate,
	} = useCampaignEntityPersistence({
		campaignSlug: campaign.slug,
		sanitizeEntity: sanitizeEntityForSave,
	});

	const applyCampaignState = useCallback((nextCampaign) => {
		setDescription(nextCampaign.description || "");
		setNotes(nextCampaign.notes || []);
		setIsDescriptionCollapsed(nextCampaign.isDescriptionCollapsed || false);
		setIsNotesCollapsed(nextCampaign.isNotesCollapsed || false);
		setIsCharactersCollapsed(nextCampaign.isCharactersCollapsed || false);
		setIsNpcsCollapsed(nextCampaign.isNpcsCollapsed || false);
		setIsLocationsCollapsed(nextCampaign.isLocationsCollapsed || false);
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
		async (updates) => {
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
		() => ({
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
		async (state) => {
			discardEntitySaveTimers();
			discardCampaignSaveTimer();

			const nextNotes = cloneHistoryList(state.notes);
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
				dispatch(
					alert({
						title: lang.t("Error"),
						message: lang.t("Failed to update entity."),
					}),
				);
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
		dispatch,
		loadCharacters,
		loadNpcs,
		loadLocations,
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
				dispatch(
					alert({
						title: lang.t("Error"),
						message: lang.t("Failed to update entity."),
					}),
				);
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
		dispatch,
		loadCharacters,
		loadNpcs,
		loadLocations,
	]);

	const pushToUndo = useCallback(() => {
		if (!isUpdatingHistory.current) {
			setUndoStack((prev) => addUndoSnapshot(prev, createHistoryState()));
			setRedoStack(clearRedoStack());
		}
	}, [createHistoryState]);

	const triggerSave = useCallback(
		(updates) => {
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


	const applyMentionRenameToLocalState = useCallback((oldName, newName) => {
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
	}, []);

	const confirmMentionReferenceUpdate = useCallback(
		async (oldName, newName) => {
			if (
				!normalizeMentionName(oldName) ||
				!String(newName || "").trim() ||
				normalizeMentionName(oldName) === normalizeMentionName(newName)
			) {
				return true;
			}

			return await dispatch(
				confirm({
					title: lang.t("Update links?"),
					message: lang.t(
						'Update links in the project from "{oldName}" to "{newName}"?',
						{ oldName, newName },
					),
				}),
			);
		},
		[dispatch],
	);
	const reportEntityWorkflowError = useCallback(
		(message, error) => {
			console.error(message, error);
			dispatch(
				alert({
					title: lang.t("Error"),
					message: lang.t("Failed to update entity."),
				}),
			);
		},
		[dispatch],
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
		(error, type) => {
			console.error(`Failed to reorder ${type}`, error);
			dispatch(
				alert({
					title: lang.t("Error"),
					message: lang.t("Failed to update entity."),
				}),
			);
		},
		[dispatch],
	);
	const reportMoveError = useCallback(
		(error) => {
			console.error("Failed to move character entity", error);
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

	const handleDescriptionChange = (e) => {
		const val = e.target.value;
		if (!saveTimeout.current) pushToUndo();
		setDescription(val);
		triggerSave({ description: val });
	};

	const handleToggleNoteCollapse = (id) => {
		const newNotes = notes.map((n) =>
			n.id === id ? { ...n, collapsed: !n.collapsed } : n,
		);
		setNotes(newNotes);
		triggerSave({ notes: sanitizeNotesForSave(newNotes) });
	};

	const handleNoteTitleChange = (id, title) => {
		if (!saveTimeout.current) pushToUndo();
		const newNotes = upsertNoteById(notes, id, { title });

		setNotes(newNotes);
		triggerSave({ notes: sanitizeNotesForSave(newNotes) });
	};

	const handleNoteChange = (id, text) => {
		if (!saveTimeout.current) pushToUndo();
		const newNotes = upsertNoteById(notes, id, { text });

		setNotes(newNotes);
		triggerSave({ notes: sanitizeNotesForSave(newNotes) });
	};

	const handleDeleteNote = (id) => {
		pushToUndo();
		const newNotes = notes.filter((n) => n.id !== id);

		setNotes(newNotes);
		triggerSave({ notes: sanitizeNotesForSave(newNotes) });
	};

	const handleNotesReorder = (newNotes) => {
		if (!saveTimeout.current) pushToUndo();
		const sanitizedNotes = sanitizeNotesForSave(newNotes);
		setNotes(sanitizedNotes);
		triggerSave({ notes: sanitizedNotes });
	};


	const loadSessions = useCallback(async () => {
		try {
			const data = await api.listSessions(campaign.slug);
			setSessions(data);
		} catch (err) {
			console.error("Failed to load sessions", err);
		}
	}, [campaign.slug]);

	useEffect(() => {
		loadSessions();
	}, [loadSessions]);

	useEffect(() => {
		if (!syncEvent?.version) return;
		const isRelevantCampaign =
			!syncEvent.campaignSlug || syncEvent.campaignSlug === campaign.slug;
		if (!isRelevantCampaign) return;

		if (["entities", "ai", "import", "images"].includes(syncEvent.resource)) {
			loadCharacters();
			loadNpcs();
			loadLocations();
		}
		if (["sessions", "ai", "import"].includes(syncEvent.resource)) {
			loadSessions();
			setSessionDetails({});
			sessionDetailsRef.current = {};
		}
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
			(session) => session?.fileName && !sessionDetails[session.fileName],
		);
		if (missingSessions.length === 0 || isGraphDataLoadingRef.current) return;

		isGraphDataLoadingRef.current = true;
		setIsGraphDataLoading(true);
		setGraphDataError("");
		try {
			const loadedEntries = await Promise.all(
				missingSessions.map(async (session) => [
					session.fileName,
					await api.getSession(campaign.slug, session.fileName),
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
			setGraphDataError(err.message || lang.t("Failed to load sessions"));
		} finally {
			isGraphDataLoadingRef.current = false;
			setIsGraphDataLoading(false);
		}
	}, [campaign.slug, sessionDetails, sessions]);

	const handleCreateSession = async () => {
		const name = await dispatch(
			prompt({
				title: lang.t("New session"),
				message: lang.t("Enter a name or leave empty to use current date:"),
			}),
		);
		if (name === null) return;
		try {
			const newSession = await api.createSession(campaign.slug, name);
			setSessions([...sessions, newSession]);
			navigateTo(campaign.slug, newSession.fileName);
			dispatch(requestCampaignsReloadAction());
		} catch (err) {
			dispatch(
				alert({
					title: lang.t("Session creation error"),
					message: err.status
						? `[${lang.t("Status")}: ${err.status}] ${err.message}`
						: err.message,
				}),
			);
		}
	};

	const saveGraphSessionDetail = useCallback(
		(fileName, updater) => {
			const current = sessionDetailsRef.current[fileName];
			if (!current) return;

			const next = JSON.parse(JSON.stringify(current));
			updater(next);

			sessionDetailsRef.current = {
				...sessionDetailsRef.current,
				[fileName]: next,
			};
			setSessionDetails(sessionDetailsRef.current);

			api
				.updateSession(campaign.slug, fileName, { data: next.data })
				.catch((err) => {
					console.error("Failed to save graph note edit", err);
					setGraphDataError(err.message || lang.t("Failed to update entity."));
				});
		},
		[campaign.slug],
	);

	const handleGraphNoteSave = useCallback(
		({ nodeType, fileName, sceneId, noteId, updates }) => {
			if (!noteId || !updates) return;

			if (nodeType === "campaign-note") {
				if (!saveTimeout.current) pushToUndo();
				setNotes((prev) => {
					const next = upsertNoteById(prev, noteId, updates);
					triggerSave({ notes: sanitizeNotesForSave(next) });
					return next;
				});
				return;
			}

			if (nodeType === "session-note" && fileName) {
				saveGraphSessionDetail(fileName, (session) => {
					session.data = session.data || {};
					session.data.notes = (session.data.notes || []).map((note) =>
						String(note.id) === String(noteId) ? { ...note, ...updates } : note,
					);
				});
				return;
			}

			if (nodeType === "scene-note" && fileName && sceneId) {
				saveGraphSessionDetail(fileName, (session) => {
					session.data = session.data || {};
					session.data.scenes = (session.data.scenes || []).map((scene) => {
						if (String(scene.id) !== String(sceneId)) return scene;
						return {
							...scene,
							notes: (scene.notes || []).map((note) =>
								String(note.id) === String(noteId)
									? { ...note, ...updates }
									: note,
							),
						};
					});
				});
			}
		},
		[pushToUndo, saveGraphSessionDetail, triggerSave],
	);

	const handleDeleteCampaign = async () => {
		let hasCampaignImages = true;
		try {
			const imageState = await api.campaignHasImages(campaign.slug);
			hasCampaignImages = Boolean(imageState?.hasImages);
		} catch (err) {
			console.error("Failed to check campaign images", err);
		}

		const confirmationConfig = hasCampaignImages
			? {
					title: lang.t("Delete campaign"),
					message: lang.t(
						"All sessions in this campaign will be permanently lost. Campaign images will be moved to General if this option is enabled; otherwise they will be deleted. Continue?",
					),
					checkboxLabel: lang.t("Move campaign images to General"),
					checkboxDefaultChecked: true,
					getConfirmValue: (_value, moveImagesToGeneral) => ({
						confirmed: true,
						moveImagesToGeneral: Boolean(moveImagesToGeneral),
					}),
				}
			: {
					title: lang.t("Delete campaign"),
					message: lang.t(
						"All sessions in this campaign will be permanently lost. Continue?",
					),
					getConfirmValue: () => ({
						confirmed: true,
						moveImagesToGeneral: false,
					}),
				};

		const result = await dispatch(confirm(confirmationConfig));
		if (!result?.confirmed) return;
		try {
			await api.deleteCampaign(campaign.slug, {
				moveImagesToGeneral:
					hasCampaignImages && Boolean(result.moveImagesToGeneral),
			});
			navigateTo(null);
			dispatch(requestCampaignsReloadAction());
		} catch (err) {
			dispatch(
				alert({
					title: lang.t("Error"),
					message: lang.t("Failed to delete campaign: {error}", {
						error: err.message,
					}),
				}),
			);
		}
	};

	const handleRename = async () => {
		const name = await dispatch(
			prompt({
				title: lang.t("Rename"),
				message: lang.t("Enter a new campaign name:"),
				defaultValue: campaign.name,
			}),
		);
		if (name && name !== campaign.name) {
			try {
				const updated = await api.updateCampaign(campaign.slug, { name });
				dispatch(requestCampaignsReloadAction());
				navigateTo(updated.slug, null, true);
			} catch (err) {
				dispatch(
					alert({
						title: lang.t("Error"),
						message: lang.t("Failed to rename campaign: {error}", {
							error: err.message,
						}),
					}),
				);
			}
		}
	};

	const handleDeleteSession = async (session) => {
		if (
			!(await dispatch(
				confirm({
					title: lang.t("Delete session"),
					message: lang.t('Do you really want to delete session "{name}"?', {
						name: session.name,
					}),
				}),
			))
		)
			return;
		try {
			await api.deleteSession(campaign.slug, session.fileName);
			const data = await api.listSessions(campaign.slug);
			setSessions(data);
			setSessionDetails((prev) => {
				const next = { ...prev };
				delete next[session.fileName];
				return next;
			});
			dispatch(requestCampaignsReloadAction());
		} catch (err) {
			dispatch(
				alert({
					title: lang.t("Error"),
					message: lang.t("Failed to delete session: {error}", {
						error: err.message,
					}),
				}),
			);
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
			dispatch(alert({ title: lang.t("Export error"), message: err.message }));
		}
	};

	const handleExportPartial = async (sections = []) => {
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
			dispatch(alert({ title: lang.t("Export error"), message: err.message }));
		}
	};

	const handleImportPartial = async (file, sections = []) => {
		try {
			await api.importCampaignPartialArchive(campaign.slug, file, sections);
			await Promise.all([loadCharacters(), loadNpcs(), loadLocations()]);
			const sessionsData = await api.listSessions(campaign.slug);
			setSessions(sessionsData);
			setSessionDetails({});
			sessionDetailsRef.current = {};
			dispatch(requestCampaignsReloadAction());
		} catch (err) {
			dispatch(
				alert({
					title: lang.t("Import error"),
					message: err.message || lang.t("Failed to import campaign"),
				}),
			);
		}
	};

	const handleSessionReorderDrop = useCallback(
		(nextSessions = sessions) => {
			const orders = {};
			nextSessions.forEach((item, idx) => {
				orders[item.fileName] = idx;
			});
			api.reorderSessions(campaign.slug, orders);
		},
		[sessions, campaign.slug],
	);

	useEffect(() => {
		const handleKeyDown = (e) => {
			const isInput =
				e.target.tagName === "INPUT" ||
				e.target.tagName === "TEXTAREA" ||
				e.target.isContentEditable;
			if (isInput && !shouldUseAppHistoryForEvent(e)) return;

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
	}, [handleUndo, handleRedo]);

	useEffect(() => {
		return () => {
			flushCampaignSave();
			flushEntitySaves();
		};
	}, [flushCampaignSave, flushEntitySaves]);

	const handleAiUpdate = async (updatedCampaign, options = {}) => {
		pushToUndo();
		if (updatedCampaign) {
			setDescription(updatedCampaign.description || "");
			setNotes(updatedCampaign.notes || []);
		}
		const entityTypes = Array.isArray(options.entityTypes)
			? options.entityTypes
			: ["characters", "npc", "locations"];
		if (entityTypes.length > 0) {
			try {
				await Promise.all(
					entityTypes.map(async (type) => {
						const entities = await api.getEntities(campaign.slug, type);
						const normalized = (entities || []).map(sanitizeLoadedEntity);
						if (type === "characters") setCharacters(normalized);
						if (type === "npc") setNpcs(normalized);
						if (type === "locations") setLocations(normalized);
					}),
				);
			} catch (err) {
				console.error("Failed to reload AI-updated entities", err);
			}
		}
		dispatch(requestCampaignsReloadAction());
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
