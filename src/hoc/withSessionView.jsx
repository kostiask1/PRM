import { memo, useCallback, useEffect, useRef, useState } from "react";

import { api } from "../api";
import { useModal } from "../context/ModalContext";

export default function withSessionView(WrappedComponent) {
	const ComponentWithSessionView = memo(function ComponentWithSessionView(props) {
		const { campaign, sessionId, onBack, onNavigate, onRefreshCampaigns } =
			props;
		const modal = useModal();

		const [session, setSession] = useState(null);
		const [isSaving, setIsSaving] = useState(false);
		const [npcToCreate, setNpcToCreate] = useState(null);
		const [isChecklistOpen, setIsChecklistOpen] = useState(false);
		const saveTimeout = useRef(null);

		const campaignSlug = campaign.slug;
		const [undoStack, setUndoStack] = useState([]);
		const [redoStack, setRedoStack] = useState([]);
		const isUpdatingHistory = useRef(false);

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
			if (!session || undoStack.length === 0) return;

			const currentState = {
				data: session.data,
				completed: session.completed,
				completedAt: session.completedAt,
			};

			let tempStack = [...undoStack];
			let stateToRestore = null;

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
			if (!session || redoStack.length === 0) return;

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
				if (document.querySelector(".Modal__overlay")) return;

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
			return () => window.removeEventListener("keydown", handleKeyDown);
		}, [onBack, handleUndo, handleRedo]);

		const updateSession = (updates, instant = false) => {
			setSession((prev) => {
				if (!isUpdatingHistory.current && prev) {
					const currentState = {
						data: prev.data,
						completed: prev.completed,
						completedAt: prev.completedAt,
					};

					const isDataChanged =
						updates.data &&
						JSON.stringify(updates.data) !== JSON.stringify(prev.data);
					const isStatusChanged =
						updates.completed !== undefined &&
						updates.completed !== prev.completed;

					if ((isDataChanged || isStatusChanged) && (!saveTimeout.current || instant)) {
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
			if (!session) return;
			const nextData = { ...session.data, [key]: value };
			updateSession({ data: nextData }, instant);
		};

		const addScene = () => {
			if (!session) return;
			const scenes = session.data.scenes || [];
			updateData(
				"scenes",
				[...scenes, { id: Date.now(), texts: {}, collapsed: false }],
				true,
			);
		};

		const updateScene = (sceneId, field, value, isTopLevel = false) => {
			if (!session) return;
			const scenes = session.data.scenes.map((s) => {
				if (s.id !== sceneId) return s;
				if (isTopLevel) return { ...s, [field]: value };
				return { ...s, texts: { ...s.texts, [field]: value } };
			});
			updateData("scenes", scenes);
		};

		const toggleSceneCollapse = (sceneId) => {
			if (!session) return;
			const scenes = session.data.scenes.map((s) =>
				s.id === sceneId ? { ...s, collapsed: !s.collapsed } : s,
			);
			updateData("scenes", scenes, true);
		};

		const handleOpenEncounter = async (scene) => {
			if (!session) return;
			let encounterId = scene.encounterId;

			if (!encounterId) {
				const sceneIndex = session.data.scenes.findIndex((s) => s.id === scene.id);
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

				await api.updateSession(campaignSlug, sessionId, {
					...session,
					data: nextData,
				});

				setSession((prev) => ({ ...prev, data: nextData }));
			}

			onNavigate(campaignSlug, sessionId, false, encounterId);
		};

		const removeScene = async (sceneId) => {
			if (!session) return;
			const scene = session.data.scenes.find((s) => s.id === sceneId);
			if (!scene) return;

			const hasTextData = Object.values(scene.texts || {}).some(
				(val) => val && val.trim() !== "",
			);
			const hasEncounter = !!scene.encounterId;

			if (hasTextData || hasEncounter) {
				const confirmed = await modal.confirm(
					"Видалення сцени",
					"Ви впевнені? Це також видалить пов'язане бойове зіткнення.",
				);
				if (!confirmed) return;
			}

			const nextData = { ...session.data };

			if (scene.encounterId) {
				nextData.encounters = (nextData.encounters || []).filter(
					(e) => e.id.toString() !== scene.encounterId.toString(),
				);
			}

			nextData.scenes = (nextData.scenes || []).filter((s) => s.id !== sceneId);
			updateSession({ data: nextData }, true);
		};

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
			if (!npcToCreate?.firstName?.trim()) {
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
			if (!session) return;
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
			if (!session) return;
			let notes = session.data.notes || [];
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

			updateData("notes", newNotes);
		};

		const handleToggleNoteCollapse = (id) => {
			if (!session) return;
			const notes = session.data.notes.map((n) =>
				n.id === id ? { ...n, collapsed: !n.collapsed } : n,
			);
			updateData("notes", notes, true);
		};

		const handleDeleteNote = (id) => {
			if (!session) return;
			let newNotes = (session.data.notes || []).filter((n) => n.id !== id);

			if (newNotes.length === 0) {
				newNotes.push({ id: Date.now(), title: "", text: "", collapsed: false });
			}

			updateData("notes", newNotes, true);
		};

		const handleToggleSectionCollapse = (key) => {
			if (!session) return;
			const isCollapsed = !!session.data[`is${key}Collapsed`];
			updateData(`is${key}Collapsed`, !isCollapsed, true);
		};

		const handleAiUpdate = (updatedSession) => {
			if (!session) return;

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
			(item) => session?.data?.[`${item.id}_check`],
		).length;
		const progress = Math.round((completedChecks / totalChecks) * 100);

		const handleRename = async () => {
			if (!session) return;
			const name = await modal.prompt(
				"Перейменування",
				"Введіть нову назву сесії:",
				session.name,
			);
			if (name && name !== session.name) updateSession({ name }, true);
		};

		const handleDeleteSessionAndBack = async () => {
			if (!session) return;
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
		};

		return (
			<WrappedComponent
				{...props}
				session={session}
				isSaving={isSaving}
				npcToCreate={npcToCreate}
				setNpcToCreate={setNpcToCreate}
				isChecklistOpen={isChecklistOpen}
				setIsChecklistOpen={setIsChecklistOpen}
				undoStack={undoStack}
				redoStack={redoStack}
				campaignSlug={campaignSlug}
				triggerSave={triggerSave}
				handleUndo={handleUndo}
				handleRedo={handleRedo}
				updateSession={updateSession}
				updateData={updateData}
				addScene={addScene}
				updateScene={updateScene}
				toggleSceneCollapse={toggleSceneCollapse}
				handleOpenEncounter={handleOpenEncounter}
				removeScene={removeScene}
				handleOpenNpcCreate={handleOpenNpcCreate}
				handleSaveNpc={handleSaveNpc}
				handleNoteTitleChange={handleNoteTitleChange}
				handleNoteChange={handleNoteChange}
				handleToggleNoteCollapse={handleToggleNoteCollapse}
				handleDeleteNote={handleDeleteNote}
				handleToggleSectionCollapse={handleToggleSectionCollapse}
				handleAiUpdate={handleAiUpdate}
				checklistItems={checklistItems}
				progress={progress}
				handleRename={handleRename}
				handleDeleteSessionAndBack={handleDeleteSessionAndBack}
			/>
		);
	});

	ComponentWithSessionView.displayName = `withSessionView(${WrappedComponent.displayName || WrappedComponent.name || "Component"})`;

	return ComponentWithSessionView;
}
