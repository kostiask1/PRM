import { memo, useCallback, useEffect, useRef, useState } from "react";

import { api } from "../api";

export default function withCampaignView(WrappedComponent) {
	const ComponentWithCampaignView = memo(function ComponentWithCampaignView(
		props,
	) {
		const { campaign, onSelectSession, onNavigate, onRefreshCampaigns, modal } =
			props;

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
				let initialNotes = campaign.notes || [];

				const last = initialNotes[initialNotes.length - 1];
				if (
					initialNotes.length === 0 ||
					(last && (last.text?.trim() || last.title?.trim()))
				) {
					initialNotes.push({
						id: Date.now(),
						title: "",
						text: "",
						collapsed: false,
					});
				}
				setNotes(initialNotes);
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

			const lastNote = newNotes[newNotes.length - 1];
			if (
				lastNote &&
				(lastNote.text.trim() !== "" || lastNote.title?.trim() !== "")
			) {
				newNotes.push({ id: Date.now(), title: "", text: "", collapsed: false });
			}

			setNotes(newNotes);
			triggerSave({ notes: newNotes });
		};

		const handleNoteChange = (id, text) => {
			if (!saveTimeout.current) pushToUndo();
			let newNotes = notes.map((n) => (n.id === id ? { ...n, text } : n));

			const lastNote = newNotes[newNotes.length - 1];
			if (
				lastNote &&
				(lastNote.text.trim() !== "" || lastNote.title?.trim() !== "")
			) {
				newNotes.push({
					id: Date.now(),
					title: "",
					text: "",
					collapsed: false,
				});
			}

			setNotes(newNotes);
			triggerSave({ notes: newNotes });
		};

		const handleDeleteNote = (id) => {
			pushToUndo();
			let newNotes = notes.filter((n) => n.id !== id);

			if (newNotes.length === 0) {
				newNotes.push({ id: Date.now(), title: "", text: "", collapsed: false });
			}

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
			try {
				const saved = await api.createEntity(campaign.slug, "characters", newChar);
				setCharacters([...characters, { ...saved, _isNew: true }]);
			} catch (err) {
				console.error("Failed to create character", err);
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

			if (saveTimeout.current) clearTimeout(saveTimeout.current);
			saveTimeout.current = setTimeout(() => {
				api.updateEntity(campaign.slug, "characters", updatedChar.slug, updatedChar);
			}, 500);
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
			try {
				const saved = await api.createEntity(campaign.slug, "npc", newNpc);
				setNpcs([...npcs, { ...saved, _isNew: true }]);
			} catch (err) {
				console.error("Failed to create NPC", err);
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

			if (saveTimeout.current) clearTimeout(saveTimeout.current);
			saveTimeout.current = setTimeout(() => {
				api.updateEntity(campaign.slug, "npc", updatedNpc.slug, updatedNpc);
			}, 500);
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
				const bundle = await api.exportCampaign(campaign.slug);
				const blob = new Blob([JSON.stringify(bundle, null, 2)], {
					type: "application/json",
				});
				const url = URL.createObjectURL(blob);
				const a = document.createElement("a");
				a.href = url;
				a.download = `campaign-${campaign.slug}.json`;
				a.click();
				URL.revokeObjectURL(url);
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

		const handleAiUpdate = (updatedCampaign) => {
			pushToUndo();
			if (updatedCampaign) {
				setDescription(updatedCampaign.description || "");
				let newNotes = updatedCampaign.notes || [];
				const last = newNotes[newNotes.length - 1];
				if (
					newNotes.length === 0 ||
					(last && (last.text?.trim() !== "" || last.title?.trim() !== ""))
				) {
					newNotes.push({
						id: Date.now(),
						title: "",
						text: "",
						collapsed: false,
					});
				}
				setNotes(newNotes);
				setCharacters(updatedCampaign.characters || []);
			}
			onRefreshCampaigns();
		};

		return (
			<WrappedComponent
				{...props}
				sessions={sessions}
				setSessions={setSessions}
				description={description}
				notes={notes}
				setNotes={setNotes}
				characters={characters}
				setCharacters={setCharacters}
				npcs={npcs}
				setNpcs={setNpcs}
				isDescriptionCollapsed={isDescriptionCollapsed}
				setIsDescriptionCollapsed={setIsDescriptionCollapsed}
				isNotesCollapsed={isNotesCollapsed}
				setIsNotesCollapsed={setIsNotesCollapsed}
				isCharactersCollapsed={isCharactersCollapsed}
				setIsCharactersCollapsed={setIsCharactersCollapsed}
				isNpcsCollapsed={isNpcsCollapsed}
				setIsNpcsCollapsed={setIsNpcsCollapsed}
				undoStack={undoStack}
				redoStack={redoStack}
				handleUndo={handleUndo}
				handleRedo={handleRedo}
				triggerSave={triggerSave}
				handleDescriptionChange={handleDescriptionChange}
				handleToggleNoteCollapse={handleToggleNoteCollapse}
				handleNoteTitleChange={handleNoteTitleChange}
				handleNoteChange={handleNoteChange}
				handleDeleteNote={handleDeleteNote}
				handleAddCharacter={handleAddCharacter}
				handleToggleCharacterCollapse={handleToggleCharacterCollapse}
				handleCharacterChange={handleCharacterChange}
				handleDeleteCharacter={handleDeleteCharacter}
				handleAddNpc={handleAddNpc}
				handleToggleNpcCollapse={handleToggleNpcCollapse}
				handleNpcChange={handleNpcChange}
				handleNpcDelete={handleNpcDelete}
				handleCreateSession={handleCreateSession}
				handleDeleteCampaign={handleDeleteCampaign}
				handleRename={handleRename}
				handleDeleteSession={handleDeleteSession}
				handleToggleSessionStatus={handleToggleSessionStatus}
				handleExport={handleExport}
				handleAiUpdate={handleAiUpdate}
				handleSessionReorderDrop={handleSessionReorderDrop}
			/>
		);
	});

	ComponentWithCampaignView.displayName = `withCampaignView(${WrappedComponent.displayName || WrappedComponent.name || "Component"})`;

	return ComponentWithCampaignView;
}
