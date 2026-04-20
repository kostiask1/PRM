import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../api";
import Icon from "./Icon";
import Button from "./Button";
import EditableField from "./EditableField";
import AiAssistantPanel from "./AiAssistantPanel";
import Panel from "./Panel";
import DraggableList from "./DraggableList";
import Modal from "./Modal";
import NoteCard from "./NoteCard";
import CharacterCard from "./CharacterCard";
import Checkbox from "./Checkbox";
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
	const [npcToCreate, setNpcToCreate] = useState(null);
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
				if (
					sessionNotes.length === 0 ||
					(lastNote && (lastNote.text?.trim() || lastNote.title?.trim()))
				) {
					sessionNotes.push({
						id: Date.now(),
						title: "",
						text: "",
						collapsed: false,
					});
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
		console.log("value:", value);
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

	// Notes Management
	const handleOpenNpcCreate = () => {
		setNpcToCreate({
			id: Date.now(),
			firstName: "",
			lastName: "",
			race: "",
			class: "",
			level: 1,
			motivation: "",
			trait: "",
			notes: [{ id: Date.now() + 1, title: "", text: "", collapsed: false }],
			collapsed: false,
		});
	};

	const handleSaveNpc = async () => {
		if (!npcToCreate.firstName?.trim()) {
			modal.alert("Помилка", "Ім'я NPC обов'язкове для створення.");
			return;
		}

		try {
			await api.createEntity(campaignSlug, "npc", npcToCreate);
			setNpcToCreate(null);
			window.dispatchEvent(new CustomEvent("refresh-entities"));
		} catch (err) {
			console.error("Failed to create NPC", err);
		}
	};

	const handleNoteTitleChange = (id, title) => {
		let notes = session.data.notes || [];
		let newNotes = notes.map((n) => (n.id === id ? { ...n, title } : n));

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

		updateData("notes", newNotes);
	};

	const handleNoteChange = (id, text) => {
		let notes = session.data.notes || [];
		let newNotes = notes.map((n) => (n.id === id ? { ...n, text } : n));

		// Автоматичне додавання нової замітки, якщо остання заповнена
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
		const last = updatedSession.data.notes
			? updatedSession.data.notes[updatedSession.data.notes.length - 1]
			: null;
		if (
			updatedSession.data.notes &&
			(updatedSession.data.notes.length === 0 ||
				(last && (last.text?.trim() !== "" || last.title?.trim() !== "")))
		) {
			updatedSession.data.notes.push({
				id: Date.now(),
				title: "",
				text: "",
				collapsed: false,
			});
		}

		setSession(updatedSession);
		setTimeout(() => {
			isUpdatingHistory.current = false;
		}, 0);
	};
	if (!session) return null;

	const checklistItems = [
		{ id: "goal", label: "Визначити головну мету сесії" },
		{ id: "conflict", label: "Сформулювати основний конфлікт" },
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
									<NoteCard
										note={note}
										isLast={index === (session.data.notes || []).length - 1}
										isDragging={isDragging}
										onToggleCollapse={handleToggleNoteCollapse}
										onTitleChange={handleNoteTitleChange}
										onTextChange={handleNoteChange}
										onDelete={handleDeleteNote}
									/>
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
										handleOpenNpcCreate={handleOpenNpcCreate}
										hasEncounter={!!scene.encounterId}
										encounterName={
											(session.data.encounters || []).find(
												(e) =>
													e.id?.toString() === scene.encounterId?.toString(),
											)?.name || "Без назви"
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
					showFooter={false}>
					<div className="SessionView__checklistModal">
						<div className="SessionView__progressWrap">
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
								note={item.note}
							/>
						))}
					</div>
				</Modal>
			)}

			<button
				className="SessionView__checklistToggle"
				onClick={() => setIsChecklistOpen(true)}
				title="Чекліст підготовки">
				<Icon name="list" size={28} />
				{progress < 100 && <span className="SessionView__checklistBadge" />}
			</button>

			{npcToCreate && (
				<Modal
					title="Створити нового NPC"
					onCancel={() => setNpcToCreate(null)}
					onConfirm={handleSaveNpc}
					confirmLabel="Зберегти NPC">
					<CharacterCard
						character={npcToCreate}
						onChange={(id, updated) => setNpcToCreate(updated)}
						onDelete={() => setNpcToCreate(null)}
						onToggleCollapse={() => {}}
						campaignSlug={campaignSlug}
						modal={modal}
						type="npc"
					/>
				</Modal>
			)}
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
			{children && <div className="TodoSection__body">{children}</div>}
		</section>
	);
}

function TodoItem({ title, note, checked, onChange, children }) {
	return (
		<div className={`TodoItem ${checked ? "TodoItem--done" : ""}`}>
			<Checkbox
				checked={checked}
				onChange={onChange}
				label={
					<div className="TodoItem__content">
						<div className="TodoItem__trigger">
							{title && <div className="TodoItem__title">{title}</div>}
							{note && <div className="TodoItem__note">{note}</div>}
						</div>
						{children}
					</div>
				}
			/>
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
	handleOpenNpcCreate,
	children,
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
						variant="ghost"
						onClick={handleOpenNpcCreate}
						icon="plus"
						strokeWidth={2.5}>
						Створити NPC
					</Button>
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
			{!collapsed && <div className="SceneCard__grid">{children}</div>}
		</div>
	);
}
