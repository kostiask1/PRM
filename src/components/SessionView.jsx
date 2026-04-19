import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../api";
import Icon from "./Icon";
import Button from "./Button";
import EditableField from "./EditableField";
import AiAssistantPanel from "./AiAssistantPanel";
import Panel from "./Panel";
import DraggableList from "./DraggableList";
import Modal from "./Modal";
import "../assets/components/SessionView.css";

const SCENE_SCHEMA = [
	{
		key: "summary",
		title: "Суть сцени",
		type: "textarea",
		placeholder: "Коротко опиши сцену...",
	},
	{
		key: "goal",
		title: "Мета гравців",
		type: "textarea",
		placeholder: "Чого персонажі хочуть досягти...",
	},
	{
		key: "stakes",
		title: "Ставки",
		type: "textarea",
		placeholder: "Що буде при успіху/провалі...",
	},
	{
		key: "location",
		title: "Локація",
		type: "textarea",
		placeholder: "Де це відбувається...",
	},
	{
		key: "clues",
		title: "Підказки",
		type: "textarea",
		placeholder: "Інформація, яку отримають гравці...",
	},
];

export default function SessionView({
	campaign,
	sessionId,
	onBack,
	onNavigate,
	onRefreshCampaigns,
	modal,
}) {
	const [session, setSession] = useState(null);
	const [isSaving, setIsSaving] = useState(false);
	const [isChecklistOpen, setIsChecklistOpen] = useState(false);
	const saveTimeout = useRef(null);

	const campaignSlug = campaign.slug;

	// Undo/Redo state
	const [undoStack, setUndoStack] = useState([]);
	const [redoStack, setRedoStack] = useState([]);
	const isUpdatingHistory = useRef(false); // Flag to prevent circular updates

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
				// Якщо після збереження змінився fileName (через ренейм), оновлюємо URL
				if (result && result.fileName !== sessionId) {
					onNavigate(campaignSlug, result.fileName, true);
					onRefreshCampaigns();
				}
			} catch (err) {
				console.error("Save failed", err);
			} finally {
				setIsSaving(false);
			}
		},
		[campaignSlug, sessionId, onNavigate, onRefreshCampaigns],
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
		if (undoStack.length === 0) return;

		const currentState = {
			data: session.data,
			completed: session.completed,
			completedAt: session.completedAt,
		};

		let tempStack = [...undoStack];
		let stateToRestore = null;

		// Шукаємо перший стан у черзі, який реально відрізняється від поточного
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
		if (redoStack.length === 0) return;

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
			// Завантажуємо дані лише якщо змінився ID сесії
			if (lastLoadedSessionIdRef.current === sessionId) return;

			try {
				const data = await api.getSession(campaignSlug, sessionId);

				let sessionNotes = data.data.notes || [];
				const lastNote = sessionNotes[sessionNotes.length - 1];
				if (sessionNotes.length === 0 || (lastNote && (lastNote.text?.trim() || lastNote.title?.trim()))) {
					sessionNotes.push({ id: Date.now(), title: "", text: "", collapsed: false });
				}
				data.data.notes = sessionNotes;

				setSession(data);

				setUndoStack([]);
				setRedoStack([]);
				lastLoadedSessionIdRef.current = sessionId;
			} catch (err) {
				console.error("Failed to load session", err);
			}
		};
		loadSession();
	}, [campaignSlug, sessionId]);

	useEffect(() => {
		const handleKeyDown = (e) => {
			if (e.key === "Backspace") {
				const isInput =
					e.target.tagName === "INPUT" ||
					e.target.tagName === "TEXTAREA" ||
					e.target.isContentEditable;
				if (!isInput) {
					e.preventDefault();
					onBack();
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
		return () => window.removeEventListener("keydown", handleKeyDown); // Removed autoResize from dependencies
	}, [onBack, handleUndo, handleRedo]);

	const updateSession = (updates, instant = false) => {
		setSession((prev) => {
			if (!isUpdatingHistory.current && prev) {
				const currentState = {
					data: prev.data,
					completed: prev.completed,
					completedAt: prev.completedAt,
				};

				// Перевіряємо, чи нові дані реально відрізняються від поточних
				const isDataChanged =
					updates.data &&
					JSON.stringify(updates.data) !== JSON.stringify(prev.data);
				const isStatusChanged =
					updates.completed !== undefined &&
					updates.completed !== prev.completed;

				// Записуємо в історію лише якщо це початок введення (таймер не активний) або миттєва дія
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
		const nextData = { ...session.data, [key]: value };
		updateSession({ data: nextData }, instant);
	};

	const addScene = () => {
		const scenes = session.data.scenes || [];
		updateData(
			"scenes",
			[...scenes, { id: Date.now(), texts: {}, collapsed: false }],
			true,
		);
	};

	const updateScene = (sceneId, field, value) => {
		const scenes = session.data.scenes.map((s) =>
			s.id === sceneId ? { ...s, texts: { ...s.texts, [field]: value } } : s,
		);
		updateData("scenes", scenes);
	};

	const toggleSceneCollapse = (sceneId) => {
		const scenes = session.data.scenes.map((s) =>
			s.id === sceneId ? { ...s, collapsed: !s.collapsed } : s,
		);
		updateData("scenes", scenes, true);
	};

	const handleOpenEncounter = async (scene) => {
		let encounterId = scene.encounterId;

		if (!encounterId) {
			const sceneIndex = session.data.scenes.findIndex(
				(s) => s.id === scene.id,
			);
			const name = await modal.prompt(
				"Нове зіткнення",
				"Введіть назву для бою:",
				`Бій у сцені ${sceneIndex + 1}`,
			);
			if (name === null) return;

			encounterId = Date.now().toString();
			const newEncounter = {
				id: encounterId,
				name: name || `Бій у сцені ${sceneIndex + 1}`,
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

			// Використовуємо прямий виклик API для очікування завершення операції
			await api.updateSession(campaignSlug, sessionId, {
				...session,
				data: nextData,
			});

			// Оновлюємо локальний стан, щоб уникнути стрибків при поверненні
			setSession((prev) => ({ ...prev, data: nextData }));
		}

		onNavigate(campaignSlug, sessionId, false, encounterId);
	};

	const removeScene = async (sceneId) => {
		const scene = session.data.scenes.find((s) => s.id === sceneId);
		if (!scene) return;

		// Перевіряємо, чи є в сцені будь-які дані (текст або бій)
		const hasTextData = Object.values(scene.texts || {}).some(
			(val) => val && val.trim() !== "",
		);
		const hasEncounter = !!scene.encounterId;

		// Запитуємо підтвердження лише якщо сцена не порожня
		if (hasTextData || hasEncounter) {
			const confirmed = await modal.confirm(
				"Видалення сцени",
				"Ви впевнені? Це також видалить пов'язане бойове зіткнення.",
			);
			if (!confirmed) return;
		}

		const nextData = { ...session.data };

		// Видаляємо пов'язаний encounter, якщо він існує
		if (scene.encounterId) {
			nextData.encounters = (nextData.encounters || []).filter(
				(e) => e.id.toString() !== scene.encounterId.toString(),
			);
		}

		// Видаляємо саму сцену
		nextData.scenes = (nextData.scenes || []).filter((s) => s.id !== sceneId);

		updateSession({ data: nextData }, true);
	};

	// Scene-specific NPC Management
	const handleAddNpcToScene = (sceneId) => {
		const scenes = session.data.scenes.map((s) => {
			if (s.id === sceneId) {
				const npcs = s.npcs || [];
				return {
					...s,
					npcs: [
						...npcs,
						{ id: Date.now(), name: "", description: "", collapsed: false },
					],
				};
			}
			return s;
		});
		updateData("scenes", scenes, true);
	};

	const handleUpdateNpcInScene = (sceneId, npcId, updates) => {
		const scenes = session.data.scenes.map((s) => {
			if (s.id === sceneId) {
				const npcs = (s.npcs || []).map((n) =>
					n.id === npcId ? { ...n, ...updates } : n,
				);
				return { ...s, npcs };
			}
			return s;
		});
		updateData("scenes", scenes);
	};

	const handleDeleteNpcFromScene = (sceneId, npcId) => {
		const scenes = session.data.scenes.map((s) => {
			if (s.id === sceneId) {
				const npcs = (s.npcs || []).filter((n) => n.id !== npcId);
				return { ...s, npcs };
			}
			return s;
		});
		updateData("scenes", scenes, true);
	};

	const handleReorderNpcsInScene = (sceneId, npcs) => {
		const scenes = session.data.scenes.map((s) =>
			s.id === sceneId ? { ...s, npcs } : s,
		);
		updateData("scenes", scenes);
	};

	// Notes Management
	const handleNoteTitleChange = (id, title) => {
		let notes = session.data.notes || [];
		let newNotes = notes.map((n) => (n.id === id ? { ...n, title } : n));

		const lastNote = newNotes[newNotes.length - 1];
		if (lastNote && (lastNote.text.trim() !== "" || lastNote.title?.trim() !== "")) {
			newNotes.push({
				id: Date.now(),
				title: "",
				text: "",
				collapsed: false,
			});
		}

		updateData("notes", newNotes);
	};

	const handleNoteChange = (id, text) => {
		let notes = session.data.notes || [];
		let newNotes = notes.map((n) => (n.id === id ? { ...n, text } : n));

		// Автоматичне додавання нової замітки, якщо остання заповнена
		const lastNote = newNotes[newNotes.length - 1];
		if (lastNote && (lastNote.text.trim() !== "" || lastNote.title?.trim() !== "")) {
			newNotes.push({
				id: Date.now(),
				title: "",
				text: "",
				collapsed: false,
			});
		}

		updateData("notes", newNotes);
	};

	const handleToggleNoteCollapse = (id) => {
		const notes = session.data.notes.map((n) =>
			n.id === id ? { ...n, collapsed: !n.collapsed } : n,
		);
		updateData("notes", notes, true);
	};

	const handleDeleteNote = (id) => {
		let newNotes = (session.data.notes || []).filter((n) => n.id !== id);

		// Гарантуємо, що список не буде порожнім
		if (newNotes.length === 0) {
			newNotes.push({ id: Date.now(), title: "", text: "", collapsed: false });
		}

		updateData("notes", newNotes, true);
	};

	const handleToggleSectionCollapse = (key) => {
		const isCollapsed = !!session.data[`is${key}Collapsed`];
		updateData(`is${key}Collapsed`, !isCollapsed, true);
	};

	const handleAiUpdate = (updatedSession) => {
		if (!session) return;

		// Зберігаємо стан ДО змін ШІ в історію
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

		// Перевіряємо замітки після оновлення від ШІ
		const last = updatedSession.data.notes ? updatedSession.data.notes[updatedSession.data.notes.length - 1] : null;
		if (
			updatedSession.data.notes &&
			(updatedSession.data.notes.length === 0 ||
				(last && (last.text?.trim() !== "" || last.title?.trim() !== "")))
		) {
			updatedSession.data.notes.push({ id: Date.now(), title: "", text: "", collapsed: false });
		}

		setSession(updatedSession);
		setTimeout(() => {
			isUpdatingHistory.current = false;
		}, 0);
	};
	if (!session) return null;

	const checklistItems = [
		{ id: "goal", label: "Визначити головну мету сесії", hasText: true },
		{ id: "conflict", label: "Сформулювати основний конфлікт", hasText: true },
		{
			id: "social",
			label: "Підготувати соціальну сцену",
			note: "Переговори, допит, суперечка.",
		},
		{
			id: "exploration",
			label: "Підготувати сцену дослідження",
			note: "Локація, загадка, пастка.",
		},
		{
			id: "combat",
			label: "Підготувати бій / сцену напруги",
			note: "Ризик і тиск.",
		},
	];

	const totalChecks = checklistItems.length;
	const completedChecks = checklistItems.filter(
		(item) => session.data[`${item.id}_check`],
	).length;
	const progress = Math.round((completedChecks / totalChecks) * 100);

	const handleRename = async () => {
		const name = await modal.prompt(
			"Перейменування",
			"Введіть нову назву сесії:",
			session.name,
		);
		if (name && name !== session.name) updateSession({ name }, true);
	};

	return (
		<Panel className="SessionView">
			<div className="Panel__header">
				<div className="SessionView__header">
					<div className="SessionView__titleGroup">
						<div className="SessionView__titleRow">
							<Button
								variant="ghost"
								size="small"
								onClick={onBack}
								icon="back"
								className="SessionView__backBtn"
							/>
							<h2 className="editable-title" onClick={handleRename}>
								{session.name}
							</h2>
						</div>
						<p className="muted">
							{isSaving ? "Зберігання..." : "Всі зміни збережено"}
						</p>
					</div>
				</div>
				<div className="SessionView__headerActions">
					<Button
						variant="ghost"
						size="small"
						icon="undo"
						onClick={handleUndo}
						disabled={undoStack.length === 0 || isSaving}
						title="Скасувати (Ctrl+Z)"
					/>
					<Button
						variant="ghost"
						size="small"
						icon="redo"
						onClick={handleRedo}
						disabled={redoStack.length === 0 || isSaving}
						title="Повторити (Ctrl+Y)"
					/>
					<Button
						variant={session.completed ? "primary" : ""}
						onClick={() =>
							updateSession({ completed: !session.completed }, true)
						}>
						{session.completed ? "Відновити" : "Завершити"}
					</Button>
					<Button
						variant="danger"
						icon="trash"
						onClick={async () => {
							if (
								await modal.confirm(
									"Видалення сесії",
									`Видалити сесію "${session.name}"?`,
								)
							) {
								await api.deleteSession(campaignSlug, sessionId);
								onBack();
								onRefreshCampaigns();
							}
						}}
					/>
				</div>
			</div>

			<div className="Panel__body">
				<div className="SessionView__todoList">
					<TodoSection
						title="Замітки"
						collapsed={!!session.data.isNotesCollapsed}
						onToggle={() => handleToggleSectionCollapse("Notes")}>
						{!session.data.isNotesCollapsed && (
							<DraggableList
								items={session.data.notes || []}
								className="SessionView__notes"
								onReorder={(notes) => updateData("notes", notes)}
								onDrop={() => triggerSave(session, true)}
								keyExtractor={(note) => note.id}
								renderItem={(note, isDragging, index) => (
									<div
										className={`note-card-simple ${note.collapsed ? "is-collapsed" : ""} ${isDragging ? "note-card-simple--dragging" : ""}`}>
										{/* notesArr потрібен для визначення довжини масиву заміток */}
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
												value={note.title || ""}
												onChange={(e) => handleNoteTitleChange(note.id, e.target.value)}
												placeholder="Нова замітка"
												className="note-card-simple__title"
											/>
											{index !== (session.data.notes || []).length - 1 && (
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
											)}
										</div>
										{!note.collapsed && (
											<div className="note-card-simple__content">
												<EditableField
													type="textarea"
													value={note.text}
													onChange={(e) =>
														handleNoteChange(note.id, e.target.value)
													}
													placeholder="Текст замітки..."
												/>
											</div>
										)}
									</div>
								)}
							/>
						)}
					</TodoSection>

					<TodoSection
						title="Сцени"
						action={
							<Button
								variant="primary"
								size="small"
								onClick={addScene}
								icon="plus"
								iconSize={16}>
								Додати
							</Button>
						}>
						<AiAssistantPanel
							sessionName={session.name}
							sessionData={session.data}
							campaignContext={{
								description: campaign.description,
								notes: campaign.notes,
							}}
							campaignSlug={campaignSlug}
							sessionId={sessionId}
							onInsertResult={handleAiUpdate}
							modal={modal}
						/>
						<DraggableList
							items={session.data.scenes || []}
							onReorder={(newScenes) => updateData("scenes", newScenes)}
							onDrop={() => triggerSave(session, true)}
							keyExtractor={(scene) => scene.id}
							renderItem={(scene) => {
								const idx = (session.data.scenes || []).findIndex(
									(s) => s.id === scene.id,
								);
								return (
									<SceneCard
										number={idx + 1}
										collapsed={scene.collapsed}
										onToggle={() => toggleSceneCollapse(scene.id)}
										onRemove={() => removeScene(scene.id)}
										onOpenEncounter={() => handleOpenEncounter(scene)}
										hasEncounter={!!scene.encounterId}
										encounterName={
											(session.data.encounters || []).find(
												(e) =>
													e.id?.toString() === scene.encounterId?.toString(),
											)?.name || "Без назви"
										}
										npcs={scene.npcs || []}
										onAddNpc={() => handleAddNpcToScene(scene.id)}
										onUpdateNpc={(npcId, updates) =>
											handleUpdateNpcInScene(scene.id, npcId, updates)
										}
										onDeleteNpc={(npcId) =>
											handleDeleteNpcFromScene(scene.id, npcId)
										}
										onReorderNpcs={(npcs) =>
											handleReorderNpcsInScene(scene.id, npcs)
										}
										onTriggerSave={() => triggerSave(session, true)}>
										{SCENE_SCHEMA.map((field) => (
											<div key={field.key} className="TodoItem__content">
												<div className="TodoItem__title">{field.title}</div>
												<EditableField
													type={field.type}
													value={scene.texts?.[field.key] || ""}
													onChange={(e) =>
														updateScene(scene.id, field.key, e.target.value)
													}
													placeholder={field.placeholder}
												/>
											</div>
										))}
									</SceneCard>
								);
							}}
						/>
					</TodoSection>

					<TodoSection title="Результат сесії">
						<div className="TodoItem__note">
							Запиши короткий підсумок того, що реально відбулося.
						</div>
						<EditableField
							type="textarea"
							className="field--result"
							placeholder="Підсумок того, що реально відбулося..."
							value={session.data.result_text || ""}
							onChange={(e) => updateData("result_text", e.target.value)}
						/>
					</TodoSection>
				</div>
			</div>

			{/* Модальне вікно з чеклістом */}
			{isChecklistOpen && (
				<Modal
					title="Чекліст підготовки"
					onCancel={() => setIsChecklistOpen(false)}
					showFooter={false}
					type="custom"
				>
					<div className="SessionView__checklistModal">
						<div className="SessionView__progressWrap" style={{ marginBottom: '20px', padding: '0 4px' }}>
							<div className="ProgressBar__label">
								<span>Прогрес підготовки</span>
								<span>{progress}%</span>
							</div>
							<div className="ProgressBar">
								<div
									className="ProgressBar__fill"
									style={{ width: `${progress}%` }}></div>
							</div>
						</div>
						{checklistItems.map((item) => (
							<TodoItem
								key={item.id}
								checked={!!session.data[`${item.id}_check`]}
								onChange={(val) => updateData(`${item.id}_check`, val, true)}
								title={item.label}
								note={item.note}>
								{item.hasText && (
									<EditableField
										type="textarea"
										value={session.data[`${item.id}_text`] || ""}
										onChange={(e) =>
											updateData(`${item.id}_text`, e.target.value)
										}
										placeholder="Додайте деталі..."
									/>
								)}
							</TodoItem>
						))}
					</div>
				</Modal>
			)}

			<button
				className="SessionView__checklistToggle"
				onClick={() => setIsChecklistOpen(true)}
				title="Чекліст підготовки"
			>
				<Icon name="list" size={28} />
				{progress < 100 && <span className="SessionView__checklistBadge" />}
			</button>
		</Panel>
	);
}

function TodoSection({ title, children, action }) {
	return (
		<section className="TodoSection">
			<div className="TodoSection__header">
				<h3>{title}</h3>
				{action}
			</div>
			{children && (
				<div className="TodoSection__body">{children}</div>
			)}
		</section>
	);
}

function TodoItem({ title, note, checked, onChange, children }) {
	return (
		<div className={`TodoItem ${checked ? "TodoItem--done" : ""}`}>
			<input
				type="checkbox"
				checked={checked}
				onChange={(e) => onChange(e.target.checked)}
			/>
			<div className="TodoItem__content">
				<div onClick={() => onChange(!checked)} className="TodoItem__trigger">
					{title && <div className="TodoItem__title">{title}</div>}
					{note && <div className="TodoItem__note">{note}</div>}
				</div>
				{children}
			</div>
		</div>
	);
}

function SceneCard({
	number,
	onRemove,
	collapsed,
	onToggle,
	onOpenEncounter,
	hasEncounter,
	encounterName,
	children,
	npcs,
	onAddNpc,
	onUpdateNpc,
	onDeleteNpc,
	onReorderNpcs,
	onTriggerSave,
}) {
	return (
		<div className="SceneCard">
			<div className="SceneCard__header" onClick={onToggle}>
				<div className="SceneCard__titleGroup">
					<div className="SceneCard__toggle">
						<Icon name="chevron" className={collapsed ? "Icon--rotated" : ""} />
					</div>
					<div className="SceneCard__title">Сцена {number}</div>
				</div>
				<div className="SceneCard__headerActions">
					<Button
						variant={hasEncounter ? "primary" : "ghost"}
						onClick={(e) => {
							e.stopPropagation();
							onOpenEncounter();
						}}
						title={
							hasEncounter ? "Відкрити зіткнення" : "Додати бойове зіткнення"
						}>
						<Icon
							name="swords"
							size={18}
							className="SceneCard__encounter-icon"
						/>
						<span className="SceneCard__encounter-name">
							{hasEncounter ? encounterName : "Додати бій"}
						</span>
					</Button>
					<Button
						variant="danger"
						icon="x"
						iconSize={16}
						onClick={(e) => {
							e.stopPropagation();
							onRemove();
						}}
					/>
				</div>
			</div>
			{!collapsed && (
				<>
					<div className="SceneCard__npcs-section">
						<div className="SceneCard__npcs-header">
							<h4>NPC та фракції</h4>
							<Button
								variant="ghost"
								size="small"
								icon="plus"
								onClick={onAddNpc}>
								Додати NPC
							</Button>
						</div>
						<DraggableList
							items={npcs}
							className="SessionView__npcs"
							onReorder={onReorderNpcs}
							onDrop={onTriggerSave}
							keyExtractor={(npc) => npc.id}
							renderItem={(npc, isNpcDragging) => (
								<div
									className={`character-card-simple ${npc.collapsed ? "is-collapsed" : ""} ${isNpcDragging ? "character-card-simple--dragging" : ""}`}>
									<div
										className="character-card-simple__header"
										onClick={() =>
											onUpdateNpc(npc.id, { collapsed: !npc.collapsed })
										}>
										<Button
											variant="ghost"
											size="small"
											icon="chevron"
											className={`character-card-simple__toggle ${npc.collapsed ? "is-rotated" : ""}`}
											onClick={() =>
												onUpdateNpc(npc.id, { collapsed: !npc.collapsed })
											}
										/>
										<EditableField
											value={npc.name}
											onChange={(e) =>
												onUpdateNpc(npc.id, { name: e.target.value })
											}
											placeholder="Ім'я NPC"
											className="character-card-simple__name"
										/>
										<Button
											variant="danger"
											icon="trash"
											size={14}
											onClick={(e) => {
												e.stopPropagation();
												onDeleteNpc(npc.id);
											}}
											title="Видалити"
										/>
									</div>
									{!npc.collapsed && (
										<div className="character-card-simple__content">
											<EditableField
												type="textarea"
												value={npc.description}
												onChange={(e) =>
													onUpdateNpc(npc.id, { description: e.target.value })
												}
												placeholder="Опис, мотивація..."
											/>
										</div>
									)}
								</div>
							)}
						/>
					</div>
					<div className="SceneCard__grid">{children}</div>
				</>
			)}
		</div>
	);
}
