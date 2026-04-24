import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
	alert,
	prompt,
	requestCampaignsReloadAction,
	requestDiceRollAction,
} from "../actions/app";
import { api } from "../api";
import { navigateTo, useAppDispatch, useAppSelector } from "../store/appStore";
import { lang } from "../services/localization";

function cloneEncounterSnapshot(value) {
	if (!value) return value;
	if (typeof structuredClone === "function") return structuredClone(value);
	return JSON.parse(JSON.stringify(value));
}

export default function useEncounterView({ campaign, sessionId, encounterId }) {
	const dispatch = useAppDispatch();
	const handleBack = useCallback(
		() => navigateTo(campaign.slug, sessionId),
		[campaign.slug, sessionId],
	);

	const [encounter, setEncounter] = useState(null);
	const [selectedInstance, setSelectedInstance] = useState(null);
	const [showBestiary, setShowBestiary] = useState(false);
	const [notification, setNotification] = useState(null);
	const [entityImageMap, setEntityImageMap] = useState(new Map());
	const [undoStack, setUndoStack] = useState([]);
	const [redoStack, setRedoStack] = useState([]);
	const [isSaving, setIsSaving] = useState(false);
	const diceRolledResult = useAppSelector((state) => state.dice.rolledResult);

	const saveTimeoutRef = useRef(null);
	const fileInputRef = useRef(null);
	const processedDiceResultIdRef = useRef(null);
	const encounterRef = useRef(null);
	const isUpdatingHistoryRef = useRef(false);
	const reorderStartRef = useRef(null);

	useEffect(() => {
		encounterRef.current = encounter;
	}, [encounter]);

	useEffect(() => {
		return () => {
			if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
		};
	}, []);

	useEffect(() => {
		const handleKeyDown = (e) => {
			if (document.querySelector(".Modal__overlay")) return;
			const isInput =
				e.target.tagName === "INPUT" ||
				e.target.tagName === "TEXTAREA" ||
				e.target.isContentEditable;

			if (e.key === "Escape" && showBestiary) {
				setShowBestiary(false);
			} else if (e.key === "Backspace" || e.key === "Escape") {
				if (!isInput) {
					e.preventDefault();
					if (showBestiary) {
						setShowBestiary(false);
					} else {
						handleBack();
					}
				}
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [showBestiary, handleBack]);

	useEffect(() => {
		let isMounted = true;
		const loadEncounter = async (retries = 3) => {
			try {
				const session = await api.getSession(campaign.slug, sessionId);
				if (!isMounted) return;

				const found = (session.data.encounters || []).find(
					(e) => e.id.toString() === encounterId.toString(),
				);

				if (!found && retries > 0) {
					setTimeout(() => loadEncounter(retries - 1), 300);
					return;
				}

				if (!found) {
					dispatch(
						alert({
							title: lang.t("Error"),
							message: lang.t("Encounter not found or data is still updating."),
						}),
					);
					handleBack();
					return;
				}

				setEncounter(found);
				setSelectedInstance(found.monsters?.[0] || null);
				setUndoStack([]);
				setRedoStack([]);
			} catch (err) {
				if (isMounted) console.error("Failed to load encounter", err);
			}
		};
		loadEncounter();
		return () => {
			isMounted = false;
		};
	}, [campaign.slug, sessionId, encounterId, dispatch, handleBack]);

	useEffect(() => {
		let isMounted = true;

		const normalizeName = (value) =>
			String(value || "")
				.trim()
				.toLowerCase()
				.replace(/\s+/g, " ");

		const getEntityNames = (entity) => {
			const firstName = String(entity?.firstName || "").trim();
			const lastName = String(entity?.lastName || "").trim();
			const fullName = `${firstName} ${lastName}`.trim();
			const fallbackName = String(entity?.name || "").trim();
			return Array.from(
				new Set(
					[fullName, fallbackName]
						.map((name) => normalizeName(name))
						.filter(Boolean),
				),
			);
		};

		const loadEntityImages = async () => {
			try {
				const [characters, npcs] = await Promise.all([
					api.getEntities(campaign.slug, "characters"),
					api.getEntities(campaign.slug, "npc"),
				]);

				if (!isMounted) return;

				const nextMap = new Map();
				[...(characters || []), ...(npcs || [])].forEach((entity) => {
					if (!entity?.imageUrl) return;
					getEntityNames(entity).forEach((name) => {
						if (!nextMap.has(name)) {
							nextMap.set(name, entity.imageUrl);
						}
					});
				});
				setEntityImageMap(nextMap);
			} catch (error) {
				if (isMounted) {
					console.error("Failed to load entity images for encounter", error);
				}
			}
		};

		loadEntityImages();
		return () => {
			isMounted = false;
		};
	}, [campaign.slug]);

	const getMonsterImageOverride = useCallback(
		(monster) => {
			const normalizedName = String(monster?.name || "")
				.trim()
				.toLowerCase()
				.replace(/\s+/g, " ");
			if (!normalizedName) return null;
			return entityImageMap.get(normalizedName) || null;
		},
		[entityImageMap],
	);

	const saveEncounterState = useCallback(
		(updatedEncounter, debounceMs = 0) => {
			if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
			setIsSaving(true);

			const performSave = async () => {
				try {
					const currentSession = await api.getSession(campaign.slug, sessionId);
					const updatedEncounters = (currentSession.data.encounters || []).map(
						(e) =>
							e.id.toString() === encounterId.toString() ? updatedEncounter : e,
					);

					await api.updateSession(campaign.slug, sessionId, {
						...currentSession,
						data: { ...currentSession.data, encounters: updatedEncounters },
					});
					dispatch(requestCampaignsReloadAction());
				} catch (err) {
					console.error("Failed to save encounter updates", err);
				} finally {
					setIsSaving(false);
				}
			};

			if (debounceMs > 0) {
				saveTimeoutRef.current = setTimeout(performSave, debounceMs);
			} else {
				performSave();
			}
		},
		[campaign.slug, sessionId, encounterId, dispatch],
	);

	const syncSelectedInstance = useCallback((nextEncounter, preferredId = null) => {
		setSelectedInstance((prev) => {
			if (!nextEncounter?.monsters?.length) return null;
			const targetId = preferredId || prev?.instanceId;
			if (!targetId) return nextEncounter.monsters[0];
			return (
				nextEncounter.monsters.find((m) => m.instanceId === targetId) ||
				nextEncounter.monsters[0]
			);
		});
	}, []);

	const applyEncounterUpdate = useCallback(
		(
			nextEncounter,
			{ saveDebounceMs = 0, pushUndo = true, persist = true, preferredId = null } = {},
		) => {
			if (!nextEncounter) return;
			const current = encounterRef.current;

			if (pushUndo && current && !isUpdatingHistoryRef.current) {
				setUndoStack((prev) => [...prev, cloneEncounterSnapshot(current)]);
				setRedoStack([]);
			}

			setEncounter(nextEncounter);
			syncSelectedInstance(nextEncounter, preferredId);

			if (persist) {
				saveEncounterState(nextEncounter, saveDebounceMs);
			}
		},
		[saveEncounterState, syncSelectedInstance],
	);

	const handleUndo = useCallback(() => {
		if (undoStack.length === 0) return;

		const current = encounterRef.current;
		const previous = undoStack[undoStack.length - 1];
		if (!previous) return;

		isUpdatingHistoryRef.current = true;
		setUndoStack((prev) => prev.slice(0, -1));
		if (current) {
			setRedoStack((prev) => [...prev, cloneEncounterSnapshot(current)]);
		}
		setEncounter(previous);
		syncSelectedInstance(previous);
		saveEncounterState(previous);
		setTimeout(() => {
			isUpdatingHistoryRef.current = false;
		}, 0);
	}, [undoStack, saveEncounterState, syncSelectedInstance]);

	const handleRedo = useCallback(() => {
		if (redoStack.length === 0) return;

		const current = encounterRef.current;
		const next = redoStack[redoStack.length - 1];
		if (!next) return;

		isUpdatingHistoryRef.current = true;
		setRedoStack((prev) => prev.slice(0, -1));
		if (current) {
			setUndoStack((prev) => [...prev, cloneEncounterSnapshot(current)]);
		}
		setEncounter(next);
		syncSelectedInstance(next);
		saveEncounterState(next);
		setTimeout(() => {
			isUpdatingHistoryRef.current = false;
		}, 0);
	}, [redoStack, saveEncounterState, syncSelectedInstance]);

	useEffect(() => {
		const handleHistoryShortcuts = (e) => {
			if (document.querySelector(".Modal__overlay")) return;

			const isInput =
				e.target.tagName === "INPUT" ||
				e.target.tagName === "TEXTAREA" ||
				e.target.isContentEditable;
			if (isInput) return;

			const isMod = e.ctrlKey || e.metaKey;
			const key = e.key.toLowerCase();

			if (isMod && (key === "z" || key === "я")) {
				e.preventDefault();
				if (e.shiftKey) {
					handleRedo();
				} else {
					handleUndo();
				}
				return;
			}

			if (isMod && (key === "y" || key === "н")) {
				e.preventDefault();
				handleRedo();
			}
		};

		window.addEventListener("keydown", handleHistoryShortcuts);
		return () => window.removeEventListener("keydown", handleHistoryShortcuts);
	}, [handleUndo, handleRedo]);

	const handleAiUpdate = useCallback(
		(updatedSession) => {
			if (!updatedSession) return;
			const sData = updatedSession.data || updatedSession;
			const found = (sData.encounters || []).find(
				(e) => e.id.toString() === encounterId.toString(),
			);
			if (found) {
				applyEncounterUpdate(found, { persist: false });
			}
			dispatch(requestCampaignsReloadAction());
		},
		[encounterId, dispatch, applyEncounterUpdate],
	);

	const handleAddMonster = useCallback(
		async (m) => {
			if (!encounter) return;

			const hpVal =
				typeof m.hp === "object" && m.hp?.average
					? m.hp.average
					: m.hit_points || 0;

			let acVal = m.armor_class || 0;
			if (Array.isArray(m.ac) && m.ac[0]) {
				const entry = m.ac[0];
				acVal = typeof entry === "object" ? entry.ac : entry;
			}

			const newMonster = {
				...m,
				instanceId: `inst-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
				originalBestiaryName: m.name,
				currentHp: hpVal,
				hit_points: hpVal,
				armor_class: acVal,
			};

			const updated = {
				...encounter,
				monsters: [...encounter.monsters, newMonster],
			};

			applyEncounterUpdate(updated);
			setNotification(
				lang.t("{name} added to encounter.", {
					name: m.name,
				}),
			);
		},
		[encounter, applyEncounterUpdate],
	);

	const removeMonster = useCallback(
		(instanceId) => {
			if (!encounter) return;
			const updated = {
				...encounter,
				monsters: encounter.monsters.filter((m) => m.instanceId !== instanceId),
			};
			applyEncounterUpdate(updated);
		},
		[encounter, applyEncounterUpdate],
	);

	const updateMonsterHp = useCallback(
		(instanceId, newHp) => {
			if (!encounter) return;
			const updatedMonsters = encounter.monsters.map((m) =>
				m.instanceId === instanceId
					? { ...m, currentHp: Math.max(0, parseInt(newHp, 10) || 0) }
					: m,
			);
			const updated = { ...encounter, monsters: updatedMonsters };
			applyEncounterUpdate(updated, {
				saveDebounceMs: 500,
				preferredId: instanceId,
			});
		},
		[encounter, applyEncounterUpdate],
	);

	const updateMonsterMaxHp = useCallback(
		(instanceId, newMaxHp) => {
			if (!encounter) return;
			const updatedMonsters = encounter.monsters.map((m) =>
				m.instanceId === instanceId
					? { ...m, hit_points: parseInt(newMaxHp, 10) || 0 }
					: m,
			);
			const updated = { ...encounter, monsters: updatedMonsters };
			applyEncounterUpdate(updated, {
				saveDebounceMs: 500,
				preferredId: instanceId,
			});
		},
		[encounter, applyEncounterUpdate],
	);

	const handleRename = useCallback(async () => {
		if (!encounter) return;
		const name = await dispatch(
			prompt({
				title: lang.t("Rename"),
				message: lang.t("Enter a new encounter name:"),
				defaultValue: encounter.name,
			}),
		);
		if (name && name !== encounter.name) {
			const updated = { ...encounter, name };
			applyEncounterUpdate(updated);
		}
	}, [encounter, applyEncounterUpdate, dispatch]);

	const handleRenameMonster = useCallback(
		async (instanceId, currentName) => {
			if (!encounter) return;
			const name = await dispatch(
				prompt({
					title: lang.t("Rename"),
					message: lang.t("Enter a new monster name:"),
					defaultValue: currentName,
				}),
			);
			if (name && name !== currentName) {
				const updatedMonsters = encounter.monsters.map((m) =>
					m.instanceId === instanceId ? { ...m, name } : m,
				);
				const updated = { ...encounter, monsters: updatedMonsters };
				applyEncounterUpdate(updated, { preferredId: instanceId });
			}
		},
		[encounter, applyEncounterUpdate, dispatch],
	);

	const handleExport = useCallback(() => {
		if (!encounter) return;
		const data = {
			name: encounter.name,
			monsters: encounter.monsters,
		};
		const filename = `encounter-${encounter.name.toLowerCase().replace(/\s+/g, "-")}.json`;
		const blob = new Blob([JSON.stringify(data, null, 2)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	}, [encounter]);

	const handleFileChange = useCallback(
		(e) => {
			if (!encounter) return;
			const file = e.target.files[0];
			if (!file) return;

			const reader = new FileReader();
			reader.onload = async (event) => {
				try {
					const imported = JSON.parse(event.target.result);
					if (!imported.monsters || !Array.isArray(imported.monsters)) {
						throw new Error(
							lang.t("Invalid file format (monster list is missing)"),
						);
					}

					const updated = {
						...encounter,
						name: imported.name || encounter.name,
						monsters: imported.monsters.map((m, idx) => ({
							...m,
							instanceId: `inst-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
						})),
					};

					applyEncounterUpdate(updated, { preferredId: updated.monsters[0]?.instanceId });
					setNotification(lang.t("Encounter imported successfully."));
				} catch (err) {
					dispatch(
						alert({ title: lang.t("Import error"), message: err.message }),
					);
				}
				e.target.value = "";
			};
			reader.readAsText(file);
		},
		[encounter, applyEncounterUpdate, dispatch],
	);

	const duplicateMonster = useCallback(
		(m) => {
			if (!encounter) return;
			const newMonster = {
				...m,
				instanceId: `inst-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
			};
			const index = encounter.monsters.findIndex(
				(item) => item.instanceId === m.instanceId,
			);
			const updatedMonsters = [...encounter.monsters];
			updatedMonsters.splice(index + 1, 0, newMonster);

			const updated = { ...encounter, monsters: updatedMonsters };
			applyEncounterUpdate(updated);
		},
		[encounter, applyEncounterUpdate],
	);

	const rollMonsterHp = useCallback(
		(instanceId) => {
			if (!encounter) return;

			const target = encounter.monsters.find(
				(monster) => monster.instanceId === instanceId,
			);
			if (!target) return;

			const hpFormula =
				(typeof target.hp === "object" && target.hp?.formula) ||
				target.hit_dice ||
				"";

			if (
				!String(hpFormula || "").trim() ||
				!/d/i.test(String(hpFormula || ""))
			) {
				setNotification(
					lang.t("No HP formula found for {name}.", { name: target.name }),
				);
				return;
			}
			dispatch(
				requestDiceRollAction({
					formula: hpFormula,
					context: {
						kind: "encounter_hp",
						campaignSlug: campaign.slug,
						sessionId: String(sessionId),
						encounterId: String(encounterId),
						instanceId,
					},
				}),
			);
		},
		[dispatch, encounter, campaign.slug, sessionId, encounterId],
	);

	useEffect(() => {
		const resultId = diceRolledResult?.resultId;
		if (!resultId || processedDiceResultIdRef.current === resultId) return;

		processedDiceResultIdRef.current = resultId;
		const result = diceRolledResult?.result;
		const context = diceRolledResult?.context;
		if (!result || !context) return;
		if (context.kind !== "encounter_hp") return;
		if (context.campaignSlug !== campaign.slug) return;
		if (String(context.sessionId) !== String(sessionId)) return;
		if (String(context.encounterId) !== String(encounterId)) return;

		const rolledHp = Math.max(1, Number(result.total) || 0);
		if (!rolledHp) return;

		if (!encounter) return;
		let updatedMonster = null;
		const updatedMonsters = encounter.monsters.map((monster) => {
			if (monster.instanceId !== context.instanceId) return monster;
			updatedMonster = {
				...monster,
				hit_points: rolledHp,
				currentHp: rolledHp,
			};
			return updatedMonster;
		});
		if (!updatedMonster) return;

		const updatedEncounter = { ...encounter, monsters: updatedMonsters };
		applyEncounterUpdate(updatedEncounter, { preferredId: context.instanceId });
	}, [
		campaign.slug,
		diceRolledResult,
		sessionId,
		encounterId,
		encounter,
		applyEncounterUpdate,
	]);

	const getHpColor = useCallback((current, max) => {
		const ratio = max > 0 ? Math.min(Math.max(0, current / max), 1) : 0;
		const hue = ratio * 120;
		return `hsl(${hue}, 80%, 60%)`;
	}, []);

	const averageInitiative = useMemo(() => {
		if (!encounter || encounter.monsters.length === 0) return 0;
		const total = encounter.monsters.reduce((sum, m) => {
			const dex = m.dex ?? m.dexterity ?? 10;
			const mod = Math.floor((dex - 10) / 2);
			return sum + 10.5 + mod;
		}, 0);
		const avg = total / encounter.monsters.length;
		return avg % 1 === 0 ? avg : avg.toFixed(1);
	}, [encounter]);

	const handleReorderMonsters = useCallback((newMonsters) => {
		if (!reorderStartRef.current && encounterRef.current) {
			reorderStartRef.current = cloneEncounterSnapshot(encounterRef.current);
		}
		setEncounter((prev) => (prev ? { ...prev, monsters: newMonsters } : prev));
		syncSelectedInstance(
			encounterRef.current
				? { ...encounterRef.current, monsters: newMonsters }
				: null,
		);
	}, [syncSelectedInstance]);

	const handleMonstersDrop = useCallback(() => {
		const current = encounterRef.current;
		if (!current) return;
		const start = reorderStartRef.current;
		reorderStartRef.current = null;

		if (
			start &&
			!isUpdatingHistoryRef.current &&
			JSON.stringify(start.monsters || []) !==
				JSON.stringify(current.monsters || [])
		) {
			setUndoStack((prev) => [...prev, start]);
			setRedoStack([]);
		}
		saveEncounterState(current);
	}, [saveEncounterState]);

	return {
		encounter,
		undoStack,
		redoStack,
		isSaving,
		selectedInstance,
		setSelectedInstance,
		showBestiary,
		setShowBestiary,
		notification,
		setNotification,
		fileInputRef,
		averageInitiative,
		handleFileChange,
		handleExport,
		handleRename,
		handleAddMonster,
		handleAiUpdate,
		removeMonster,
		updateMonsterHp,
		updateMonsterMaxHp,
		handleRenameMonster,
		duplicateMonster,
		rollMonsterHp,
		getHpColor,
		handleReorderMonsters,
		handleMonstersDrop,
		handleUndo,
		handleRedo,
		getMonsterImageOverride,
		handleBack,
	};
}
