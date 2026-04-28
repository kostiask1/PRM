import { useCallback, useEffect, useRef, useState } from "react";

import {
	alert,
	confirm,
	prompt,
	requestCampaignsReloadAction,
} from "../actions/app";
import { api } from "../api";
import { navigateTo, useAppDispatch, useAppSelector } from "../store/appStore";
import { sanitizeNotesForSave, upsertNoteById } from "../utils/noteUtils";
import { downloadBlob } from "../utils/download";
import { lang } from "../services/localization";

const sanitizeEntityForSave = (entity) =>
	Object.fromEntries(
		Object.entries(entity || {}).filter(([key]) => !key.startsWith("_")),
	);

const sanitizeLoadedEntity = (entity) => sanitizeEntityForSave(entity);

const normalizeMentionName = (value) =>
	String(value || "")
		.trim()
		.replace(/\s+/g, " ")
		.toLowerCase();

const replaceBracketedMentionNames = (value, oldName, newName) => {
	if (typeof value !== "string") return value;
	const normalizedOldName = normalizeMentionName(oldName);
	const nextName = String(newName || "")
		.trim()
		.replace(/\s+/g, " ");
	if (!normalizedOldName || !nextName) return value;

	return value.replace(/\[([^[\]]+)\]/g, (fullMatch, rawName) => {
		if (normalizeMentionName(rawName) !== normalizedOldName) return fullMatch;
		return `[${nextName}]`;
	});
};

const replaceMentionsInValue = (value, oldName, newName) => {
	if (typeof value === "string") {
		return replaceBracketedMentionNames(value, oldName, newName);
	}
	if (Array.isArray(value)) {
		return value.map((item) => replaceMentionsInValue(item, oldName, newName));
	}
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([key, item]) => [
				key,
				replaceMentionsInValue(item, oldName, newName),
			]),
		);
	}
	return value;
};

const getCharacterDisplayName = (entity) =>
	`${entity?.firstName || ""} ${entity?.lastName || ""}`.trim() ||
	String(entity?.name || entity?.title || "").trim();

const getLocationDisplayName = (entity) =>
	String(entity?.name || entity?.title || "").trim();

const cloneHistoryList = (items) =>
	JSON.parse(JSON.stringify((items || []).map(sanitizeLoadedEntity)));

const areHistoryStatesEqual = (left, right) =>
	JSON.stringify(left) === JSON.stringify(right);

const campaignHistoryPayload = (state) => ({
	description: state.description || "",
	notes: sanitizeNotesForSave(state.notes || []),
	completed: Boolean(state.completed),
	completedAt: state.completedAt || null,
});

export default function useCampaignView(props) {
	const { campaign } = props;
	const dispatch = useAppDispatch();

	const [sessions, setSessions] = useState([]);
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
	const entitySaveTimeoutsRef = useRef({});
	const isSavingRef = useRef(false);
	const [undoStack, setUndoStack] = useState([]);
	const [redoStack, setRedoStack] = useState([]);
	const isUpdatingHistory = useRef(false);
	const lastSlugRef = useRef(campaign.slug);
	const entityRefreshVersion = useAppSelector(
		(store) => store.entityRefreshVersion,
	);

	const clearEntitySaveTimers = useCallback(() => {
		Object.values(entitySaveTimeoutsRef.current).forEach((timer) =>
			clearTimeout(timer),
		);
		entitySaveTimeoutsRef.current = {};
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
		if (lastSlugRef.current !== campaign.slug) {
			setDescription(campaign.description || "");
			setNotes(campaign.notes || []);
			setIsDescriptionCollapsed(campaign.isDescriptionCollapsed || false);
			setIsNotesCollapsed(campaign.isNotesCollapsed || false);
			setIsCharactersCollapsed(campaign.isCharactersCollapsed || false);
			setIsNpcsCollapsed(campaign.isNpcsCollapsed || false);
			setIsLocationsCollapsed(campaign.isLocationsCollapsed || false);
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
	]);

	useEffect(() => {
		if (entityRefreshVersion === 0) return;
		loadCharacters();
		loadNpcs();
		loadLocations();
	}, [entityRefreshVersion, loadCharacters, loadNpcs, loadLocations]);

	const saveToServer = useCallback(
		async (updates) => {
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
			clearEntitySaveTimers();
			if (saveTimeout.current) {
				clearTimeout(saveTimeout.current);
				saveTimeout.current = null;
			}

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
		[campaign.slug, clearEntitySaveTimers],
	);

	const handleUndo = useCallback(async () => {
		if (undoStack.length === 0) return;

		const currentState = createHistoryState();
		let tempStack = [...undoStack];
		let stateToRestore = null;

		while (tempStack.length > 0) {
			const candidate = tempStack.pop();
			if (!areHistoryStatesEqual(candidate, currentState)) {
				stateToRestore = candidate;
				break;
			}
		}

		if (stateToRestore) {
			isUpdatingHistory.current = true;
			setRedoStack((prev) => [currentState, ...prev]);
			setUndoStack(tempStack);

			try {
				await restoreHistoryState(stateToRestore);
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
		let tempStack = [...redoStack];
		let stateToRestore = null;

		while (tempStack.length > 0) {
			const candidate = tempStack.shift();
			if (!areHistoryStatesEqual(candidate, currentState)) {
				stateToRestore = candidate;
				break;
			}
		}

		if (stateToRestore) {
			isUpdatingHistory.current = true;
			setUndoStack((prev) => [...prev, currentState]);
			setRedoStack(tempStack);

			try {
				await restoreHistoryState(stateToRestore);
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
			setUndoStack((prev) => [...prev, createHistoryState()]);
			setRedoStack([]);
		}
	}, [createHistoryState]);

	const triggerSave = useCallback(
		(updates) => {
			if (saveTimeout.current) clearTimeout(saveTimeout.current);

			saveTimeout.current = setTimeout(async () => {
				saveTimeout.current = null;
				saveToServer(updates);
			}, 500);
		},
		[saveToServer],
	);

	const clearEntitySaveTimer = useCallback((type, id) => {
		const key = `${type}:${id}`;
		if (entitySaveTimeoutsRef.current[key]) {
			clearTimeout(entitySaveTimeoutsRef.current[key]);
			delete entitySaveTimeoutsRef.current[key];
		}
	}, []);

	const scheduleEntityUpdate = useCallback(
		(type, entity) => {
			if (!entity?.slug || entity._isPending) return;
			const key = `${type}:${entity.id}`;
			const currentTimer = entitySaveTimeoutsRef.current[key];
			if (currentTimer) clearTimeout(currentTimer);

			entitySaveTimeoutsRef.current[key] = setTimeout(async () => {
				try {
					await api.updateEntity(
						campaign.slug,
						type,
						entity.slug,
						sanitizeEntityForSave(entity),
					);
				} catch (err) {
					console.error(`Failed to update ${type} entity`, err);
				} finally {
					delete entitySaveTimeoutsRef.current[key];
				}
			}, 500);
		},
		[campaign.slug],
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

	const handleToggleCharacterCollapse = (id) => {
		const newCharacters = characters.map((c) =>
			c.id === id ? { ...c, collapsed: !c.collapsed } : c,
		);
		setCharacters(newCharacters);
		const updatedCharacter = newCharacters.find(
			(character) => character.id === id,
		);
		if (updatedCharacter) scheduleEntityUpdate("characters", updatedCharacter);
	};

	const handleCharacterChange = async (id, updatedChar) => {
		setCharacters((prev) => prev.map((c) => (c.id === id ? updatedChar : c)));
		if (updatedChar._isPending) return;
		scheduleEntityUpdate("characters", updatedChar);
	};

	const handleCharacterNameBlur = async (id, updatedChar, oldName, newName) => {
		const entity = characters.find((c) => c.id === id) || updatedChar;
		if (!entity?.slug || entity._isPending) return true;
		const shouldUpdateMentions = await confirmMentionReferenceUpdate(
			oldName,
			newName,
		);
		if (!shouldUpdateMentions) return false;
		clearEntitySaveTimer("characters", id);
		try {
			const saved = sanitizeLoadedEntity(
				await api.updateEntity(campaign.slug, "characters", entity.slug, {
					...sanitizeEntityForSave(entity),
					_updateMentionReferences: true,
					_mentionOldName: oldName,
				}),
			);
			setCharacters((prev) => prev.map((c) => (c.id === id ? saved : c)));
			applyMentionRenameToLocalState(oldName, getCharacterDisplayName(saved));
		} catch (err) {
			console.error("Failed to finish character editing", err);
			dispatch(
				alert({
					title: lang.t("Error"),
					message: lang.t("Failed to update entity."),
				}),
			);
			loadCharacters();
			return false;
		}
		return true;
	};

	const handleDeleteCharacter = async (id) => {
		const char = characters.find((c) => c.id === id);
		if (!char) return;
		await api.deleteEntity(campaign.slug, "characters", char.slug);
		setCharacters((prev) => prev.filter((c) => c.id !== id));
	};

	const handleToggleNpcCollapse = (id) => {
		const next = npcs.map((n) =>
			n.id === id ? { ...n, collapsed: !n.collapsed } : n,
		);
		setNpcs(next);
		const updatedNpc = next.find((npc) => npc.id === id);
		if (updatedNpc) scheduleEntityUpdate("npc", updatedNpc);
	};

	const handleNpcChange = async (id, updatedNpc) => {
		setNpcs((prev) => prev.map((n) => (n.id === id ? updatedNpc : n)));
		if (updatedNpc._isPending) return;
		scheduleEntityUpdate("npc", updatedNpc);
	};

	const handleNpcNameBlur = async (id, updatedNpc, oldName, newName) => {
		const entity = npcs.find((n) => n.id === id) || updatedNpc;
		if (!entity?.slug || entity._isPending) return true;
		const shouldUpdateMentions = await confirmMentionReferenceUpdate(
			oldName,
			newName,
		);
		if (!shouldUpdateMentions) return false;
		clearEntitySaveTimer("npc", id);
		try {
			const saved = sanitizeLoadedEntity(
				await api.updateEntity(campaign.slug, "npc", entity.slug, {
					...sanitizeEntityForSave(entity),
					_updateMentionReferences: true,
					_mentionOldName: oldName,
				}),
			);
			setNpcs((prev) => prev.map((n) => (n.id === id ? saved : n)));
			applyMentionRenameToLocalState(oldName, getCharacterDisplayName(saved));
		} catch (err) {
			console.error("Failed to finish NPC editing", err);
			dispatch(
				alert({
					title: lang.t("Error"),
					message: lang.t("Failed to update entity."),
				}),
			);
			loadNpcs();
			return false;
		}
		return true;
	};

	const handleNpcDelete = async (id) => {
		const npc = npcs.find((n) => n.id === id);
		if (!npc) return;
		await api.deleteEntity(campaign.slug, "npc", npc.slug);
		setNpcs((prev) => prev.filter((n) => n.id !== id));
	};

	const handleCharacterTypeDrop = async ({ sourceType, targetType, id }) => {
		if (
			!id ||
			sourceType === targetType ||
			!["characters", "npc"].includes(sourceType) ||
			!["characters", "npc"].includes(targetType)
		) {
			return;
		}

		const sourceList = sourceType === "characters" ? characters : npcs;
		const entity = sourceList.find((item) => item.id === id);
		if (!entity?.slug) return;

		clearEntitySaveTimer(sourceType, id);
		try {
			await api.updateEntity(
				campaign.slug,
				sourceType,
				entity.slug,
				sanitizeEntityForSave(entity),
			);
			const moved = sanitizeLoadedEntity(
				await api.moveEntity(
					campaign.slug,
					sourceType,
					entity.slug,
					targetType,
				),
			);

			if (sourceType === "characters") {
				setCharacters((prev) => prev.filter((item) => item.id !== id));
				setNpcs((prev) => [...prev, moved]);
				return;
			}
			setNpcs((prev) => prev.filter((item) => item.id !== id));
			setCharacters((prev) => [...prev, moved]);
		} catch (err) {
			console.error("Failed to move character entity", err);
			dispatch(
				alert({
					title: lang.t("Error"),
					message: lang.t("Failed to move entity."),
				}),
			);
			loadCharacters();
			loadNpcs();
		}
	};

	const handleToggleLocationCollapse = (id) => {
		const next = locations.map((location) =>
			location.id === id
				? { ...location, collapsed: !location.collapsed }
				: location,
		);
		setLocations(next);
		const updatedLocation = next.find((location) => location.id === id);
		if (updatedLocation) scheduleEntityUpdate("locations", updatedLocation);
	};

	const handleLocationChange = async (id, updatedLocation) => {
		setLocations((prev) =>
			prev.map((location) => (location.id === id ? updatedLocation : location)),
		);
		if (updatedLocation._isPending) return;
		scheduleEntityUpdate("locations", updatedLocation);
	};

	const handleLocationNameBlur = async (
		id,
		updatedLocation,
		oldName,
		newName,
	) => {
		const entity =
			locations.find((location) => location.id === id) || updatedLocation;
		if (!entity?.slug || entity._isPending) return true;
		const shouldUpdateMentions = await confirmMentionReferenceUpdate(
			oldName,
			newName,
		);
		if (!shouldUpdateMentions) return false;
		clearEntitySaveTimer("locations", id);
		try {
			const saved = sanitizeLoadedEntity(
				await api.updateEntity(campaign.slug, "locations", entity.slug, {
					...sanitizeEntityForSave(entity),
					_updateMentionReferences: true,
					_mentionOldName: oldName,
				}),
			);
			setLocations((prev) =>
				prev.map((location) => (location.id === id ? saved : location)),
			);
			applyMentionRenameToLocalState(oldName, getLocationDisplayName(saved));
		} catch (err) {
			console.error("Failed to finish location editing", err);
			dispatch(
				alert({
					title: lang.t("Error"),
					message: lang.t("Failed to update entity."),
				}),
			);
			loadLocations();
			return false;
		}
		return true;
	};

	const handleLocationDelete = async (id) => {
		const location = locations.find((item) => item.id === id);
		if (!location) return;
		await api.deleteEntity(campaign.slug, "locations", location.slug);
		setLocations((prev) => prev.filter((item) => item.id !== id));
	};

	useEffect(() => {
		const loadSessions = async () => {
			try {
				const data = await api.listSessions(campaign.slug);
				setSessions(data);
			} catch (err) {
				console.error("Failed to load sessions", err);
			}
		};
		loadSessions();
	}, [campaign.slug]);

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

	const handleDeleteCampaign = async () => {
		if (
			!(await dispatch(
				confirm({
					title: lang.t("Delete campaign"),
					message: lang.t(
						"All sessions in this campaign will be permanently lost. Continue?",
					),
				}),
			))
		)
			return;
		try {
			await api.deleteCampaign(campaign.slug);
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

	const handleToggleSessionStatus = async (session) => {
		const isCompleting = !session.completed;
		let completedAt = session.completedAt;

		if (isCompleting) {
			const now = new Date().toISOString();
			const todayLabel = new Date().toLocaleDateString();
			const prevLabel = completedAt
				? new Date(completedAt).toLocaleDateString()
				: null;

			if (completedAt && todayLabel !== prevLabel) {
				const confirmUpdate = await dispatch(
					confirm({
						title: lang.t("Update date"),
						message: lang.t(
							"Session was already completed on {date}. Update completion date to today?",
							{ date: prevLabel },
						),
					}),
				);
				if (confirmUpdate) completedAt = now;
			} else {
				completedAt = now;
			}
		}

		try {
			await api.updateSession(campaign.slug, session.fileName, {
				completed: isCompleting,
				completedAt,
			});
			const data = await api.listSessions(campaign.slug);
			setSessions(data);
		} catch (err) {
			console.error("Failed to toggle session status", err);
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

	const handleSessionReorderDrop = useCallback(() => {
		const orders = {};
		sessions.forEach((item, idx) => {
			orders[item.fileName] = idx;
		});
		api.reorderSessions(campaign.slug, orders);
	}, [sessions, campaign.slug]);

	useEffect(() => {
		const handleKeyDown = (e) => {
			const isMod = e.ctrlKey || e.metaKey;
			const key = e.key.toLowerCase();

			if (isMod && key === "z") {
				if (e.shiftKey) {
					e.preventDefault();
					handleRedo();
				} else {
					e.preventDefault();
					handleUndo();
				}
			} else if (isMod && key === "y") {
				e.preventDefault();
				handleRedo();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleUndo, handleRedo]);

	useEffect(() => {
		return () => {
			if (saveTimeout.current) {
				clearTimeout(saveTimeout.current);
				saveTimeout.current = null;
			}
			clearEntitySaveTimers();
		};
	}, [clearEntitySaveTimers]);

	const handleAiUpdate = async (updatedCampaign) => {
		pushToUndo();
		if (updatedCampaign) {
			setDescription(updatedCampaign.description || "");
			setNotes(updatedCampaign.notes || []);
		}
		try {
			const [nextCharacters, nextNpcs, nextLocations] = await Promise.all([
				api.getEntities(campaign.slug, "characters"),
				api.getEntities(campaign.slug, "npc"),
				api.getEntities(campaign.slug, "locations"),
			]);
			setCharacters((nextCharacters || []).map(sanitizeLoadedEntity));
			setNpcs((nextNpcs || []).map(sanitizeLoadedEntity));
			setLocations((nextLocations || []).map(sanitizeLoadedEntity));
		} catch (err) {
			console.error("Failed to reload AI-updated entities", err);
		}
		dispatch(requestCampaignsReloadAction());
	};

	return {
		sessions,
		setSessions,
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
		handleToggleSessionStatus,
		handleExport,
		handleAiUpdate,
		handleSessionReorderDrop,
	};
}
