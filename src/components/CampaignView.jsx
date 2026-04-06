import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "../api";

import AiAssistantPanel from "./AiAssistantPanel";
import Button from "./Button";
import EditableField from "./EditableField";
import ListCard from "./ListCard";
import Panel from "./Panel";
import StatusBadge from "./StatusBadge";
import DraggableList from "./DraggableList";
import "../assets/components/CampaignView.css";

export default function CampaignView({
	campaign,
	onSelectSession,
	onNavigate,
	onRefreshCampaigns,
	modal,
}) {
	const [sessions, setSessions] = useState([]);

	// Локальний стан для сюжету та заміток
	const [description, setDescription] = useState(campaign.description || "");
	const [notes, setNotes] = useState(campaign.notes || []);
	const [characters, setCharacters] = useState(campaign.characters || []); // NEW: State for characters
	const [isDescriptionCollapsed, setIsDescriptionCollapsed] = useState(
		campaign.isDescriptionCollapsed || false,
	);
	const [isNotesCollapsed, setIsNotesCollapsed] = useState(
		campaign.isNotesCollapsed || false,
	);
	const [isCharactersCollapsed, setIsCharactersCollapsed] = useState(
		campaign.isCharactersCollapsed || false,
	); // NEW: State for characters collapse
	const saveTimeout = useRef(null);
	const isSavingRef = useRef(false);

	// Undo/Redo state
	const [undoStack, setUndoStack] = useState([]);
	const [redoStack, setRedoStack] = useState([]);
	const isUpdatingHistory = useRef(false);
	const lastSlugRef = useRef(campaign.slug);

	// Синхронізація при зміні кампанії
	useEffect(() => {
		// Оновлюємо локальний стан лише якщо перейшли в іншу кампанію
		if (lastSlugRef.current !== campaign.slug) {
			setDescription(campaign.description || "");
			setNotes(campaign.notes || []);
			setCharacters(campaign.characters || []); // NEW: Reset characters state
			setIsDescriptionCollapsed(campaign.isDescriptionCollapsed || false);
			setIsNotesCollapsed(campaign.isNotesCollapsed || false);
			setIsCharactersCollapsed(campaign.isCharactersCollapsed || false);
			setUndoStack([]);
			setRedoStack([]);
			lastSlugRef.current = campaign.slug;
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [campaign.slug]); // Прибираємо description та notes з залежностей, щоб уникнути "підтягування"

	const saveToServer = useCallback(
		async (updates) => {
			isSavingRef.current = true;
			try {
				await api.updateCampaign(campaign.slug, updates);
				// Прибираємо onRefreshCampaigns() для звичайного оновлення контенту,
				// щоб уникнути зайвих ререндерів зверху вниз.
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
			characters, // NEW: Include characters in undo state
			completed: campaign.completed, // Keep existing fields
			completedAt: campaign.completedAt,
		};

		let tempStack = [...undoStack];
		let stateToRestore = null;

		while (tempStack.length > 0) {
			const candidate = tempStack.pop();
			// Check for differences in description, notes, characters, and completed status
			const isDifferent =
				JSON.stringify(candidate.description) !==
					JSON.stringify(currentState.description) ||
				JSON.stringify(candidate.notes) !==
					JSON.stringify(currentState.notes) ||
				JSON.stringify(candidate.characters) !==
					JSON.stringify(currentState.characters) || // NEW: Check characters
				candidate.completed !== currentState.completed; // Keep existing check

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
			setCharacters(stateToRestore.characters); // NEW: Restore characters
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
			characters, // NEW: Include characters in redo state
			completed: campaign.completed, // Keep existing fields
			completedAt: campaign.completedAt,
		};

		let tempStack = [...redoStack];
		let stateToRestore = null;

		while (tempStack.length > 0) {
			const candidate = tempStack.shift();
			const isDifferent =
				JSON.stringify(candidate.description) !==
					JSON.stringify(currentState.description) || // Keep existing check
				JSON.stringify(candidate.notes) !==
					JSON.stringify(currentState.notes) ||
				JSON.stringify(candidate.characters) !==
					JSON.stringify(currentState.characters) || // NEW: Check characters
				candidate.completed !== currentState.completed; // Keep existing check

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
		// Робимо snapshot лише перед початком введення тексту
		if (!saveTimeout.current) pushToUndo();
		setDescription(val);
		triggerSave({ description: val });
	};

	const handleAddNote = () => {
		pushToUndo();
		const newNotes = [...notes, { id: Date.now(), text: "", collapsed: false }];
		setNotes(newNotes);
		triggerSave({ notes: newNotes });
	};

	const handleToggleNoteCollapse = (id) => {
		// Згортання нотаток зазвичай не потребує Undo, але для консистентності можна додати
		const newNotes = notes.map((n) =>
			n.id === id ? { ...n, collapsed: !n.collapsed } : n,
		);
		setNotes(newNotes);
		triggerSave({ notes: newNotes });
	};

	const handleNoteChange = (id, text) => {
		if (!saveTimeout.current) pushToUndo();
		const newNotes = notes.map((n) => (n.id === id ? { ...n, text } : n));
		setNotes(newNotes);
		triggerSave({ notes: newNotes });
	};

	const handleDeleteNote = (id) => {
		pushToUndo();
		const newNotes = notes.filter((n) => n.id !== id);
		setNotes(newNotes);
		triggerSave({ notes: newNotes });
	};

	// NEW: Character management handlers
	const handleAddCharacter = () => {
		pushToUndo();
		const newCharacters = [
			...characters,
			{ id: Date.now(), name: "", description: "", collapsed: false },
		];
		setCharacters(newCharacters);
		triggerSave({ characters: newCharacters });
	};

	const handleToggleCharacterCollapse = (id) => {
		// Згортання персонажів зазвичай не потребує Undo, але для консистентності можна додати
		const newCharacters = characters.map((c) =>
			c.id === id ? { ...c, collapsed: !c.collapsed } : c,
		);
		setCharacters(newCharacters);
		triggerSave({ characters: newCharacters });
	};

	const handleCharacterNameChange = (id, name) => {
		pushToUndo();
		if (!saveTimeout.current) pushToUndo(); // Робимо snapshot лише перед початком введення тексту
		const newCharacters = characters.map((c) =>
			c.id === id ? { ...c, name } : c,
		);
		setCharacters(newCharacters);
		triggerSave({ characters: newCharacters });
	};

	const handleCharacterDescriptionChange = (id, description) => {
		pushToUndo();
		if (!saveTimeout.current) pushToUndo(); // Робимо snapshot лише перед початком введення тексту
		const newCharacters = characters.map((c) =>
			c.id === id ? { ...c, description } : c,
		);
		setCharacters(newCharacters);
		triggerSave({ characters: newCharacters });
	};

	const handleDeleteCharacter = (id) => {
		pushToUndo();
		const newCharacters = characters.filter((c) => c.id !== id);
		setCharacters(newCharacters);
		triggerSave({ characters: newCharacters });
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
			onNavigate(null); // Повертаємось на головну
			onRefreshCampaigns();
		} catch (err) {
			modal.alert(
				"Помилка",
				"Не вдалося видалити кампанію" + " " + err.message,
			);
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
				await onRefreshCampaigns(); // Спочатку оновлюємо список кампаній
				onNavigate(updated.slug, null, true); // Потім переходимо за новим посиланням
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
		// Зберігаємо стан ДО змін ШІ в історію
		pushToUndo();
		if (updatedCampaign) {
			setDescription(updatedCampaign.description || "");
			setNotes(updatedCampaign.notes || []);
			setCharacters(updatedCampaign.characters || []); // NEW: Update characters from AI
		}
		onRefreshCampaigns();
	};

	return (
		<Panel className="CampaignView">
			<div className="Panel__header">
				<div>
					<h2
						className="editable-title"
						onClick={handleRename}
						title="Натисни, щоб перейменувати">
						{campaign.name}
					</h2>
					<p className="muted">
						Створено: {new Date(campaign.createdAt).toLocaleDateString()}
					</p>
				</div>
				<div className="CampaignView__headerActions">
					<Button
						variant="ghost"
						size="small"
						icon="undo"
						onClick={handleUndo}
						disabled={undoStack.length === 0}
						title="Скасувати (Ctrl+Z)"
					/>
					<Button
						variant="ghost"
						size="small"
						icon="redo"
						onClick={handleRedo}
						disabled={redoStack.length === 0}
						title="Повторити (Ctrl+Y)"
					/>
					<Button onClick={handleExport} icon="export">
						Експорт
					</Button>
					<Button
						variant="danger"
						icon="trash"
						onClick={handleDeleteCampaign}
						title="Видалити кампанію"
					/>
				</div>
			</div>
			<div className="Panel__body">
				<div className="CampaignView__section">
					<div className="section-row">
						<div
							className="section-title-group"
							onClick={() => {
								const next = !isDescriptionCollapsed;
								setIsDescriptionCollapsed(next);
								triggerSave({ isDescriptionCollapsed: next });
							}}>
							<Button
								variant="ghost"
								size="small"
								icon="chevron"
								className={`section-collapse-toggle ${isDescriptionCollapsed ? "is-rotated" : ""}`}
								onClick={(e) => {
									e.stopPropagation();
									const next = !isDescriptionCollapsed;
									setIsDescriptionCollapsed(next);
									triggerSave({ isDescriptionCollapsed: next });
								}}
							/>
							<h3>Сюжет кампанії</h3>
						</div>
					</div>
					{!isDescriptionCollapsed && (
						<EditableField
							type="textarea"
							placeholder="Опишіть основну лінію сюжету, ключові події та цілі..."
							value={description}
							onChange={handleDescriptionChange}
						/>
					)}
				</div>

				<div className="CampaignView__section">
					<div className="section-row">
						<div
							className="section-title-group"
							onClick={() => {
								const next = !isNotesCollapsed;
								setIsNotesCollapsed(next);
								triggerSave({ isNotesCollapsed: next });
							}}>
							<Button
								variant="ghost"
								size="small"
								icon="chevron"
								className={`section-collapse-toggle ${isNotesCollapsed ? "is-rotated" : ""}`}
								onClick={(e) => {
									e.stopPropagation();
									const next = !isNotesCollapsed;
									setIsNotesCollapsed(next);
									triggerSave({ isNotesCollapsed: next });
								}}
							/>
							<h3>Замітки</h3>
						</div>
						{!isNotesCollapsed && (
							<Button
								variant="primary"
								size="small"
								onClick={handleAddNote}
								icon="plus"
								strokeWidth={2.5}>
								Нова замітка
							</Button>
						)}
					</div>
					{!isNotesCollapsed && (
						<DraggableList
							items={notes}
							className="CampaignView__notes"
							onReorder={setNotes}
							onDrop={() => triggerSave({ notes })}
							keyExtractor={(note) => note.id}
							renderItem={(note, isDragging) => (
								<div
									className={`note-card-simple ${note.collapsed ? "is-collapsed" : ""} ${isDragging ? "note-card-simple--dragging" : ""}`}>
									<div
										className="note-card-simple__header"
										onClick={() => handleToggleNoteCollapse(note.id)}>
										<Button
											variant="ghost"
											size="small"
											icon="chevron"
											className={`note-card-simple__toggle ${note.collapsed ? "is-rotated" : ""}`}
											onClick={() => handleToggleNoteCollapse(note.id)}
										/>
										<EditableField
											value={note.text.split("\n")[0]}
											onChange={(e) => {
												const lines = note.text.split("\n");
												lines[0] = e.target.value;
												handleNoteChange(note.id, lines.join("\n"));
											}}
											placeholder="Нова замітка"
											className="note-card-simple__title"
										/>
										<Button
											variant="danger"
											icon="trash"
											size={14}
											onClick={(e) => {
												e.stopPropagation();
												handleDeleteNote(note.id);
											}}
											title="Видалити замітку"
										/>
									</div>
									{!note.collapsed && (
										<EditableField
											type="textarea"
											value={note.text}
											onChange={(e) =>
												handleNoteChange(note.id, e.target.value)
											}
											placeholder="Текст замітки..."
										/>
									)}
								</div>
							)}
						/>
					)}
				</div>

				{/* Characters Section */}
				<div className="CampaignView__section">
					<div className="section-row">
						<div
							className="section-title-group"
							onClick={() => {
								const next = !isCharactersCollapsed;
								setIsCharactersCollapsed(next);
								triggerSave({ isCharactersCollapsed: next });
							}}>
							<Button
								variant="ghost"
								size="small"
								icon="chevron"
								className={`section-collapse-toggle ${isCharactersCollapsed ? "is-rotated" : ""}`}
								onClick={(e) => {
									e.stopPropagation();
									const next = !isCharactersCollapsed;
									setIsCharactersCollapsed(next);
									triggerSave({ isCharactersCollapsed: next });
								}}
							/>
							<h3>Персонажі</h3>
						</div>
						{!isCharactersCollapsed && (
							<Button
								variant="primary"
								size="small"
								onClick={handleAddCharacter}
								icon="plus"
								strokeWidth={2.5}>
								Новий персонаж
							</Button>
						)}
					</div>
					{!isCharactersCollapsed && (
						<DraggableList
							items={characters}
							className="CampaignView__characters"
							onReorder={setCharacters}
							onDrop={() => triggerSave({ characters })}
							keyExtractor={(char) => char.id}
							renderItem={(character, isDragging) => (
								<div
									className={`character-card-simple ${character.collapsed ? "is-collapsed" : ""} ${isDragging ? "character-card-simple--dragging" : ""}`}>
									<div
										className="character-card-simple__header"
										onClick={(e) => e.stopPropagation()}>
										<Button
											variant="ghost"
											size="small"
											icon="chevron"
											className={`character-card-simple__toggle ${character.collapsed ? "is-rotated" : ""}`}
											onClick={() =>
												handleToggleCharacterCollapse(character.id)
											}
										/>
										<EditableField
											value={character.name}
											onChange={(e) =>
												handleCharacterNameChange(character.id, e.target.value)
											}
											placeholder="Ім'я персонажа"
											className="character-card-simple__name"
										/>
										<Button
											variant="danger"
											icon="trash"
											size={14}
											onClick={(e) => {
												e.stopPropagation();
												handleDeleteCharacter(character.id);
											}}
											title="Видалити персонажа"
										/>
									</div>
									{!character.collapsed && (
										<EditableField
											type="textarea"
											value={character.description}
											onChange={(e) =>
												handleCharacterDescriptionChange(
													character.id,
													e.target.value,
												)
											}
											placeholder="Опис персонажа..."
										/>
									)}
								</div>
							)}
						/>
					)}
				</div>

				<div className="CampaignView__section">
					<AiAssistantPanel
						sessionName={campaign.name}
						sessionData={{
							...campaign,
							description,
							notes,
							characters,
						}}
						campaignSlug={campaign.slug}
						sessionId={null}
						onInsertResult={handleAiUpdate}
						modal={modal}
					/>
				</div>

				<div className="section-row">
					<h3>Сесії</h3>
				</div>
				<div className="CampaignView__sessions">
					<DraggableList
						items={sessions}
						onReorder={setSessions}
						onDrop={() => {
							const orders = {};
							sessions.forEach((item, idx) => {
								orders[item.fileName] = idx;
							});
							api.reorderSessions(campaign.slug, orders);
						}}
						keyExtractor={(session) => session.fileName}
						renderItem={(session, isDragging) => (
							<ListCard
								href={`/campaign/${encodeURIComponent(campaign.slug)}/session/${encodeURIComponent(session.fileName)}`}
								dragging={isDragging}
								onClick={() => onSelectSession(session.fileName)}
								actions={
									<>
										<StatusBadge
											completed={session.completed}
											onClick={() => handleToggleSessionStatus(session)}
											type="session"
										/>
										<Button
											variant="danger"
											icon="trash"
											size={16}
											onClick={(e) => {
												e.stopPropagation();
												handleDeleteSession(session);
											}}
											title="Видалити сесію"
										/>
									</>
								}>
								<div className="ListCard__title">{session.name}</div>
								<div className="ListCard__meta">
									Оновлено: {new Date(session.updatedAt).toLocaleDateString()}
								</div>
							</ListCard>
						)}
					/>
					<Button
						variant="create"
						onClick={handleCreateSession}
						icon="plus"
						strokeWidth={2.5}>
						Нова сесія
					</Button>
				</div>
			</div>{" "}
			{/* Цей закриваючий div належить до Panel__body, який неявно є дітьми компонента Panel */}
		</Panel>
	);
}
