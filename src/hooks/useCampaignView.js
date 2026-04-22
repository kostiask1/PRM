import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "../api";
import { useModal } from "../context/ModalContext";
import {
	appendTrailingEmptyNote,
	ensureAtLeastOneNote,
} from "../utils/noteUtils";
import { downloadBlob } from "../utils/download";

const sanitizeEntityForSave = (entity) =>
	Object.fromEntries(
		Object.entries(entity || {}).filter(([key]) => !key.startsWith("_")),
	);

export default function useCampaignView(props) {
		const { campaign, onSelectSession, onNavigate, onRefreshCampaigns } =
			props;
		const modal = useModal();

		const [sessions, setSessions] = useState([]);
		const [description, setDescription] = useState(campaign.description || "");
		const [notes, setNotes] = useState(campaign.notes || []);
		const [characters, setCharacters] = useState(campaign.characters || []);
		const [npcs, setNpcs] = useState([]);
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
		const saveTimeout = useRef(null);
		const entitySaveTimeoutsRef = useRef({});
		const isSavingRef = useRef(false);
		const [undoStack, setUndoStack] = useState([]);
		const [redoStack, setRedoStack] = useState([]);
		const isUpdatingHistory = useRef(false);
		const lastSlugRef = useRef(campaign.slug);

		const loadCharacters = useCallback(async () => {
			try {
				const data = await api.getEntities(campaign.slug, "characters");
				setCharacters(data);
			} catch (err) {
				console.error("Failed to load characters", err);
			}
		}, [campaign.slug]);

		const loadNpcs = useCallback(async () => {
			try {
				const data = await api.getEntities(campaign.slug, "npc");
				setNpcs(data);
			} catch (err) {
				console.error("Failed to load NPCs", err);
			}
		}, [campaign.slug]);

		useEffect(() => {
			loadCharacters();
			loadNpcs();
		}, []);

		useEffect(() => {
			if (lastSlugRef.current !== campaign.slug) {
				setDescription(campaign.description || "");
				setNotes(appendTrailingEmptyNote(campaign.notes || []));
				setIsDescriptionCollapsed(campaign.isDescriptionCollapsed || false);
				setIsNotesCollapsed(campaign.isNotesCollapsed || false);
				setIsCharactersCollapsed(campaign.isCharactersCollapsed || false);
				setUndoStack([]);
				setRedoStack([]);
				lastSlugRef.current = campaign.slug;
				loadCharacters();
			}
		}, [campaign.slug]);

		useEffect(() => {
			window.addEventListener("refresh-entities", loadCharacters);
			return () => window.removeEventListener("refresh-entities", loadCharacters);
		}, [loadCharacters]);

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

		const handleUndo = useCallback(() => {
			if (undoStack.length === 0) return;

			const currentState = {
				description,
				notes,
				characters,
				completed: campaign.completed,
				completedAt: campaign.completedAt,
			};

			let tempStack = [...undoStack];
			let stateToRestore = null;

			while (tempStack.length > 0) {
				const candidate = tempStack.pop();
				const isDifferent =
					JSON.stringify(candidate.description) !==
						JSON.stringify(currentState.description) ||
					JSON.stringify(candidate.notes) !== JSON.stringify(currentState.notes) ||
					JSON.stringify(candidate.characters) !==
						JSON.stringify(currentState.characters) ||
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

				setDescription(stateToRestore.description);
				setNotes(stateToRestore.notes);
				setCharacters(stateToRestore.characters);
				saveToServer(stateToRestore);

				setTimeout(() => {
					isUpdatingHistory.current = false;
				}, 0);
			}
		}, [
			undoStack,
			description,
			notes,
			characters,
			saveToServer,
			campaign.completed,
			campaign.completedAt,
		]);

		const handleRedo = useCallback(() => {
			if (redoStack.length === 0) return;

			const currentState = {
				description,
				notes,
				characters,
				completed: campaign.completed,
				completedAt: campaign.completedAt,
			};

			let tempStack = [...redoStack];
			let stateToRestore = null;

			while (tempStack.length > 0) {
				const candidate = tempStack.shift();
				const isDifferent =
					JSON.stringify(candidate.description) !==
						JSON.stringify(currentState.description) ||
					JSON.stringify(candidate.notes) !== JSON.stringify(currentState.notes) ||
					JSON.stringify(candidate.characters) !==
						JSON.stringify(currentState.characters) ||
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

				setDescription(stateToRestore.description);
				setNotes(stateToRestore.notes);
				setCharacters(stateToRestore.characters);
				saveToServer(stateToRestore);

				setTimeout(() => {
					isUpdatingHistory.current = false;
				}, 0);
			}
		}, [
			redoStack,
			description,
			notes,
			characters,
			saveToServer,
			campaign.completed,
			campaign.completedAt,
		]);

		const pushToUndo = useCallback(() => {
			if (!isUpdatingHistory.current) {
				setUndoStack((prev) => [
					...prev,
					{
						description,
						notes,
						characters,
						completed: campaign.completed,
						completedAt: campaign.completedAt,
					},
				]);
				setRedoStack([]);
			}
		}, [
			description,
			notes,
			campaign.completed,
			campaign.completedAt,
			characters,
		]);

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

		const clearEntitySaveTimers = useCallback(() => {
			Object.values(entitySaveTimeoutsRef.current).forEach((timer) =>
				clearTimeout(timer),
			);
			entitySaveTimeoutsRef.current = {};
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
			triggerSave({ notes: newNotes });
		};

		const handleNoteTitleChange = (id, title) => {
			if (!saveTimeout.current) pushToUndo();
			let newNotes = notes.map((n) => (n.id === id ? { ...n, title } : n));

			newNotes = appendTrailingEmptyNote(newNotes);

			setNotes(newNotes);
			triggerSave({ notes: newNotes });
		};

		const handleNoteChange = (id, text) => {
			if (!saveTimeout.current) pushToUndo();
			let newNotes = notes.map((n) => (n.id === id ? { ...n, text } : n));

			newNotes = appendTrailingEmptyNote(newNotes);

			setNotes(newNotes);
			triggerSave({ notes: newNotes });
		};

		const handleDeleteNote = (id) => {
			pushToUndo();
			let newNotes = notes.filter((n) => n.id !== id);
			newNotes = ensureAtLeastOneNote(newNotes);

			setNotes(newNotes);
			triggerSave({ notes: newNotes });
		};

		const handleAddCharacter = async () => {
			const newChar = {
				firstName: "",
				lastName: "",
				race: "",
				class: "",
				level: 1,
				motivation: "",
				trait: "",
				notes: [{ id: Date.now() + 1, title: "", text: "", collapsed: false }],
				collapsed: false,
			};
			const tempId = `temp-character-${Date.now()}`;
			const draft = {
				...newChar,
				id: tempId,
				slug: tempId,
				_isNew: true,
				_isPending: true,
			};
			setCharacters((prev) => [...prev, draft]);
			try {
				const saved = await api.createEntity(campaign.slug, "characters", newChar);
				setCharacters((prev) => {
					const local = prev.find((c) => c.id === tempId);
					if (!local) return prev;
					const merged = {
						...saved,
						...local,
						id: saved.id,
						slug: saved.slug,
						_isPending: false,
						_isNew: true,
					};
					scheduleEntityUpdate("characters", merged);
					return prev.map((c) => (c.id === tempId ? merged : c));
				});
			} catch (err) {
				console.error("Failed to create character", err);
				setCharacters((prev) => prev.filter((c) => c.id !== tempId));
			}
		};

		const handleToggleCharacterCollapse = (id) => {
			const newCharacters = characters.map((c) =>
				c.id === id ? { ...c, collapsed: !c.collapsed } : c,
			);
			setCharacters(newCharacters);
			triggerSave({ characters: newCharacters });
		};

		const handleCharacterChange = async (id, updatedChar) => {
			setCharacters((prev) => prev.map((c) => (c.id === id ? updatedChar : c)));
			if (updatedChar._isPending) return;
			scheduleEntityUpdate("characters", updatedChar);
		};

		const handleDeleteCharacter = async (id) => {
			const char = characters.find((c) => c.id === id);
			if (!char) return;
			await api.deleteEntity(campaign.slug, "characters", char.slug);
			setCharacters((prev) => prev.filter((c) => c.id !== id));
		};

		const handleAddNpc = async () => {
			const newNpc = {
				firstName: "",
				lastName: "",
				race: "",
				class: "",
				level: 1,
				motivation: "",
				trait: "",
				notes: [{ id: Date.now() + 1, title: "", text: "", collapsed: false }],
				collapsed: false,
			};
			const tempId = `temp-npc-${Date.now()}`;
			const draft = {
				...newNpc,
				id: tempId,
				slug: tempId,
				_isNew: true,
				_isPending: true,
			};
			setNpcs((prev) => [...prev, draft]);
			try {
				const saved = await api.createEntity(campaign.slug, "npc", newNpc);
				setNpcs((prev) => {
					const local = prev.find((n) => n.id === tempId);
					if (!local) return prev;
					const merged = {
						...saved,
						...local,
						id: saved.id,
						slug: saved.slug,
						_isPending: false,
						_isNew: true,
					};
					scheduleEntityUpdate("npc", merged);
					return prev.map((n) => (n.id === tempId ? merged : n));
				});
			} catch (err) {
				console.error("Failed to create NPC", err);
				setNpcs((prev) => prev.filter((n) => n.id !== tempId));
			}
		};

		const handleToggleNpcCollapse = (id) => {
			const next = npcs.map((n) =>
				n.id === id ? { ...n, collapsed: !n.collapsed } : n,
			);
			setNpcs(next);
		};

		const handleNpcChange = async (id, updatedNpc) => {
			setNpcs((prev) => prev.map((n) => (n.id === id ? updatedNpc : n)));
			if (updatedNpc._isPending) return;
			scheduleEntityUpdate("npc", updatedNpc);
		};

		const handleNpcDelete = async (id) => {
			const npc = npcs.find((n) => n.id === id);
			if (!npc) return;
			await api.deleteEntity(campaign.slug, "npc", npc.slug);
			setNpcs((prev) => prev.filter((n) => n.id !== id));
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
			const name = await modal.prompt(
				"Нова сесія",
				"Введіть назву або залиште порожнім для поточної дати:",
			);
			if (name === null) return;
			try {
				const newSession = await api.createSession(campaign.slug, name);
				setSessions([...sessions, newSession]);
				onSelectSession(newSession.fileName);
				onRefreshCampaigns();
			} catch (err) {
				modal.alert("Помилка створення сесії", err.message, err.status);
			}
		};

		const handleDeleteCampaign = async () => {
			if (
				!(await modal.confirm(
					"Видалення кампанії",
					"Усі сесії цієї кампанії будуть втрачені назавжди. Продовжити?",
				))
			)
				return;
			try {
				await api.deleteCampaign(campaign.slug);
				onNavigate(null);
				onRefreshCampaigns();
			} catch (err) {
				modal.alert("Помилка", "Не вдалося видалити кампанію" + " " + err.message);
			}
		};

		const handleRename = async () => {
			const name = await modal.prompt(
				"Перейменування",
				"Вкажіть нову назву кампанії:",
				campaign.name,
			);
			if (name && name !== campaign.name) {
				try {
					const updated = await api.updateCampaign(campaign.slug, { name });
					await onRefreshCampaigns();
					onNavigate(updated.slug, null, true);
				} catch (err) {
					modal.alert(
						"Помилка",
						"Не вдалося перейменувати кампанію" + " " + err.message,
					);
				}
			}
		};

		const handleDeleteSession = async (session) => {
			if (
				!(await modal.confirm(
					"Видалення сесії",
					`Ви дійсно хочете видалити сесію "${session.name}"?`,
				))
			)
				return;
			try {
				await api.deleteSession(campaign.slug, session.fileName);
				const data = await api.listSessions(campaign.slug);
				setSessions(data);
				onRefreshCampaigns();
			} catch (err) {
				modal.alert("Помилка", "Не вдалося видалити сесію" + " " + err.message);
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
					const confirmUpdate = await modal.confirm(
						"Оновлення дати",
						`Сесія вже була завершена ${prevLabel}. Оновити дату завершення на сьогодні?`,
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
					modal.alert("Помилка експорту", err.message);
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

		const handleAiUpdate = (updatedCampaign) => {
			pushToUndo();
			if (updatedCampaign) {
				setDescription(updatedCampaign.description || "");
				setNotes(appendTrailingEmptyNote(updatedCampaign.notes || []));
				setCharacters(updatedCampaign.characters || []);
			}
			onRefreshCampaigns();
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
		isDescriptionCollapsed,
		setIsDescriptionCollapsed,
		isNotesCollapsed,
		setIsNotesCollapsed,
		isCharactersCollapsed,
		setIsCharactersCollapsed,
		isNpcsCollapsed,
		setIsNpcsCollapsed,
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
		handleAddCharacter,
		handleToggleCharacterCollapse,
		handleCharacterChange,
		handleDeleteCharacter,
		handleAddNpc,
		handleToggleNpcCollapse,
		handleNpcChange,
		handleNpcDelete,
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
