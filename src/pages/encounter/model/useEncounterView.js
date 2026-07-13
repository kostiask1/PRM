import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
	alert,
	prompt,
	requestCampaignsReloadAction,
	requestDiceRollAction,
	setActiveEncounterAction,
	setActiveSessionAction,
} from "../../../shared/model/index.js";
import { campaignApi } from "../../../entities/campaign/index.js";
import { sessionApi } from "../../../entities/session/index.js";
import { bestiaryApi } from "../../../entities/bestiary/index.js";
import {
	useEncounterParticipantSynchronization,
	useEncounterPersistence,
} from "../../../features/encounter-editor/index.js";

const api = { ...campaignApi, ...sessionApi, ...bestiaryApi };
import { navigateTo, useAppDispatch, useAppSelector } from "../../../shared/model/index.js";
import { lang } from "../../../shared/lib/index.js";
import {
	createEncounterMonsterInstance,
	ensureEncounterMonsterId,
	createEncounterCharacterParticipant,
	getMonsterHpFormula,
	isEncounterCharacterParticipant,
} from "../../../entities/encounter/index.js";
import {
	addUndoSnapshot,
	clearRedoStack,
	createRedoTransition,
	createUndoTransition,
	isHistoryShortcutEvent,
	shouldUseAppHistoryForEvent,
} from "../../../shared/lib/index.js";

function cloneEncounterSnapshot(value) {
	if (!value) return value;
	if (typeof structuredClone === "function") return structuredClone(value);
	return JSON.parse(JSON.stringify(value));
}

function parseChallengeRating(monster) {
	const crValue = monster?.cr?.cr !== undefined ? monster.cr.cr : monster?.cr;
	if (typeof crValue === "number") return crValue;

	const crText = String(crValue || "0").trim();
	if (crText.includes("/")) {
		const [num, den] = crText.split("/").map(Number);
		return den ? num / den : 0;
	}

	return Number.parseFloat(crText) || 0;
}

function getExpectedInitiative(monster) {
	const dex = monster?.dex ?? monster?.dexterity ?? 10;
	const mod = Math.floor((Number(dex) - 10) / 2);
	return 10.5 + mod;
}

function formatInitiativeValue(value) {
	if (!Number.isFinite(value)) return 0;
	return value % 1 === 0 ? value : value.toFixed(1);
}

export default function useEncounterView() {
	const dispatch = useAppDispatch();
	const campaign = useAppSelector((state) => state.active.campaign);
	const { activeSessionFileName, activeEncounterId } = useAppSelector(
		(state) => state.navigation,
	);
	const syncEvent = useAppSelector((state) => state.sync.event);
	const sessionId = activeSessionFileName;
	const encounterId = activeEncounterId;
	const handleBack = useCallback(
		() => navigateTo(campaign.slug, sessionId),
		[campaign.slug, sessionId],
	);

	const [encounter, setEncounter] = useState(null);
	const [selectedInstance, setSelectedInstance] = useState(null);
	const [showBestiary, setShowBestiary] = useState(false);
	const [showCharacterPicker, setShowCharacterPicker] = useState(false);
	const [notification, setNotification] = useState(null);
	const [undoStack, setUndoStack] = useState([]);
	const [redoStack, setRedoStack] = useState([]);
	const diceRolledResult = useAppSelector((state) => state.dice.rolledResult);
	const storeTheme = useAppSelector((state) => state.ui.theme);

	const fileInputRef = useRef(null);
	const processedDiceResultIdRef = useRef(null);
	const encounterRef = useRef(null);
	const isUpdatingHistoryRef = useRef(false);
	const reorderStartRef = useRef(null);
	const handleEncounterSaved = useCallback(
		(result) => {
			dispatch(setActiveSessionAction(result.session));
			dispatch(requestCampaignsReloadAction());
		},
		[dispatch],
	);
	const reportEncounterSaveError = useCallback((error) => {
		console.error("Failed to save encounter updates", error);
	}, []);
	const {
		hasPendingSave,
		isSaving,
		scheduleSave: saveEncounterState,
	} = useEncounterPersistence({
		campaignSlug: campaign.slug,
		sessionId,
		encounterId,
		onSaved: handleEncounterSaved,
		onError: reportEncounterSaveError,
	});

	useEffect(() => {
		encounterRef.current = encounter;
	}, [encounter]);

	useEffect(() => {
		dispatch(setActiveEncounterAction(encounter));
	}, [dispatch, encounter]);

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

	const loadEncounter = useCallback(
		async ({ retries = 3, resetHistory = true } = {}) => {
			try {
				const session = await api.getSession(campaign.slug, sessionId);
				dispatch(setActiveSessionAction(session));

				const found = (session.data.encounters || []).find(
					(e) => e.id.toString() === encounterId.toString(),
				);

				if (!found && retries > 0) {
					setTimeout(
						() => loadEncounter({ retries: retries - 1, resetHistory }),
						300,
					);
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
				if (resetHistory) {
					setUndoStack([]);
					setRedoStack([]);
				}
			} catch (err) {
				console.error("Failed to load encounter", err);
			}
		},
		[campaign.slug, dispatch, encounterId, handleBack, sessionId],
	);

	useEffect(() => {
		loadEncounter();
	}, [loadEncounter]);

	useEffect(() => {
		if (!syncEvent?.version) return;
		if (syncEvent.campaignSlug && syncEvent.campaignSlug !== campaign.slug) {
			return;
		}
		if (
			syncEvent.sessionFileName &&
			String(syncEvent.sessionFileName) !== String(sessionId)
		) {
			return;
		}
		if (!["sessions", "ai", "import"].includes(syncEvent.resource)) return;
		if (hasPendingSave()) return;

		loadEncounter({ resetHistory: false });
	}, [campaign.slug, hasPendingSave, loadEncounter, sessionId, syncEvent]);

	const syncSelectedInstance = useCallback(
		(nextEncounter, preferredId = null) => {
			setSelectedInstance((prev) => {
				if (!nextEncounter?.monsters?.length) return null;
				const targetId = preferredId || prev?.instanceId;
				if (!targetId) return nextEncounter.monsters[0];
				return (
					nextEncounter.monsters.find((m) => m.instanceId === targetId) ||
					nextEncounter.monsters[0]
				);
			});
		},
		[],
	);

	const applyEncounterUpdate = useCallback(
		(
			nextEncounter,
			{
				saveDebounceMs = 0,
				pushUndo = true,
				persist = true,
				preferredId = null,
			} = {},
		) => {
			if (!nextEncounter) return;
			const current = encounterRef.current;

			if (pushUndo && current && !isUpdatingHistoryRef.current) {
				setUndoStack((prev) =>
					addUndoSnapshot(prev, current, cloneEncounterSnapshot),
				);
				setRedoStack(clearRedoStack());
			}

			setEncounter(nextEncounter);
			syncSelectedInstance(nextEncounter, preferredId);

			if (persist) {
				saveEncounterState(nextEncounter, saveDebounceMs);
			}
		},
		[saveEncounterState, syncSelectedInstance],
	);

	const reportParticipantSyncError = useCallback((error, operation) => {
		console.error(`Failed encounter participant operation: ${operation}`, error);
	}, []);
	const { getMonsterImageOverride, playerCharacters } =
		useEncounterParticipantSynchronization({
			campaignSlug: campaign.slug,
			encounter,
			selectedInstanceId: selectedInstance?.instanceId,
			applyEncounterUpdate,
			hasPendingSave,
			syncEvent,
			onError: reportParticipantSyncError,
		});

	const handleUndo = useCallback(() => {
		if (undoStack.length === 0) return;

		const current = encounterRef.current;
		const transition = createUndoTransition({
			undoStack,
			redoStack,
			current,
			clone: cloneEncounterSnapshot,
		});
		if (!transition.target) return;

		isUpdatingHistoryRef.current = true;
		setUndoStack(transition.undoStack);
		setRedoStack(transition.redoStack);
		setEncounter(transition.target);
		syncSelectedInstance(transition.target);
		saveEncounterState(transition.target);
		setTimeout(() => {
			isUpdatingHistoryRef.current = false;
		}, 0);
	}, [undoStack, redoStack, saveEncounterState, syncSelectedInstance]);

	const handleRedo = useCallback(() => {
		if (redoStack.length === 0) return;

		const current = encounterRef.current;
		const transition = createRedoTransition({
			undoStack,
			redoStack,
			current,
			clone: cloneEncounterSnapshot,
		});
		if (!transition.target) return;

		isUpdatingHistoryRef.current = true;
		setRedoStack(transition.redoStack);
		setUndoStack(transition.undoStack);
		setEncounter(transition.target);
		syncSelectedInstance(transition.target);
		saveEncounterState(transition.target);
		setTimeout(() => {
			isUpdatingHistoryRef.current = false;
		}, 0);
	}, [undoStack, redoStack, saveEncounterState, syncSelectedInstance]);

	useEffect(() => {
		const handleHistoryShortcuts = (e) => {
			if (document.querySelector(".Modal__overlay")) return;

			const isInput =
				e.target.tagName === "INPUT" ||
				e.target.tagName === "TEXTAREA" ||
				e.target.isContentEditable;
			if (isInput && !shouldUseAppHistoryForEvent(e)) return;

			if (isHistoryShortcutEvent(e) && e.code === "KeyZ") {
				e.preventDefault();
				if (e.shiftKey) {
					handleRedo();
				} else {
					handleUndo();
				}
				return;
			}

			if (isHistoryShortcutEvent(e) && e.code === "KeyY") {
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

			const updated = {
				...encounter,
				monsters: [
					...(encounter.monsters || []),
					createEncounterMonsterInstance(m),
				],
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

	const handleAddCharacter = useCallback(
		(character) => {
			if (!encounter) return;

			const participant = createEncounterCharacterParticipant(character);
			const updated = {
				...encounter,
				monsters: [...(encounter.monsters || []), participant],
			};

			applyEncounterUpdate(updated, { preferredId: participant.instanceId });
			setShowCharacterPicker(false);
			setNotification(
				lang.t("{name} added to encounter.", {
					name: participant.name,
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

	const updateMonsterImage = useCallback(
		(instanceId, imageUrl) => {
			if (!encounter) return;
			const updatedMonsters = encounter.monsters.map((monster) =>
				monster.instanceId === instanceId
					? {
							...monster,
							imageUrl: imageUrl || "",
							_localOverride: true,
						}
					: monster,
			);
			const updated = { ...encounter, monsters: updatedMonsters };
			applyEncounterUpdate(updated, { preferredId: instanceId });
		},
		[encounter, applyEncounterUpdate],
	);

	const updateMonsterFromAi = useCallback(
		(instanceId, nextMonster, options = {}) => {
			if (!encounter || !nextMonster) return;
			const updatedMonsters = encounter.monsters.map((monster) => {
				if (monster.instanceId !== instanceId) return monster;
				const nextMaxHp =
					parseInt(nextMonster.hit_points ?? nextMonster.hp?.average, 10) ||
					parseInt(monster.hit_points, 10) ||
					0;
				const parsedCurrentHp =
					options.preserveCurrentHp === false &&
					nextMonster.currentHp !== undefined
						? parseInt(nextMonster.currentHp, 10)
						: monster.currentHp;
				const nextCurrentHp = Number.isFinite(parsedCurrentHp)
					? parsedCurrentHp
					: nextMaxHp;
				return {
					...ensureEncounterMonsterId(nextMonster),
					instanceId,
					...(options.localOverride
						? {
								source: monster.source,
								originalBestiaryName:
									monster.originalBestiaryName ||
									nextMonster.originalBestiaryName ||
									nextMonster.name,
							}
						: {}),
					...(options.localOverride ? { _localOverride: true } : {}),
					currentHp: Math.min(nextCurrentHp, nextMaxHp),
					hit_points: nextMaxHp,
				};
			});
			const updated = { ...encounter, monsters: updatedMonsters };
			applyEncounterUpdate(updated, { preferredId: instanceId });
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
						monsters: imported.monsters.map((m, idx) =>
							ensureEncounterMonsterId({
								...m,
								instanceId: `inst-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
							}),
						),
					};

					applyEncounterUpdate(updated, {
						preferredId: updated.monsters[0]?.instanceId,
					});
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
			if (isEncounterCharacterParticipant(m)) return;
			const newMonster = {
				...ensureEncounterMonsterId(m),
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

	const updateEncounterCharacter = useCallback(
		(instanceId, updatedCharacter) => {
			if (!encounter) return;
			const updatedMonsters = encounter.monsters.map((entry) =>
				entry.instanceId === instanceId
					? {
							...entry,
							...updatedCharacter,
							participantType: "character",
							instanceId,
						}
					: entry,
			);
			const updated = { ...encounter, monsters: updatedMonsters };
			applyEncounterUpdate(updated, {
				saveDebounceMs: 500,
				preferredId: instanceId,
			});
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

			const hpFormula = getMonsterHpFormula(target);

			if (!hpFormula) {
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

	const getHpColor = useCallback(
		(current, max) => {
			const ratio = max > 0 ? Math.min(Math.max(0, current / max), 1) : 0;
			const hue = ratio * 110;
			return `hsl(${hue}, 80%, ${storeTheme === "dark" ? "60" : "43"}%)`;
		},
		[storeTheme],
	);

	const initiativeStats = useMemo(() => {
		const monsters = encounter?.monsters || [];
		if (monsters.length === 0) {
			return {
				average: 0,
				max: 0,
				weightedAverage: 0,
			};
		}

		let total = 0;
		let max = -Infinity;
		let weightedTotal = 0;
		let totalWeight = 0;

		monsters.forEach((monster) => {
			const initiative = getExpectedInitiative(monster);
			const weight = Math.max(0, parseChallengeRating(monster)) + 1;

			total += initiative;
			max = Math.max(max, initiative);
			weightedTotal += initiative * weight;
			totalWeight += weight;
		});

		return {
			average: formatInitiativeValue(total / monsters.length),
			max: formatInitiativeValue(max),
			weightedAverage: formatInitiativeValue(weightedTotal / totalWeight),
		};
	}, [encounter]);

	const handleReorderMonsters = useCallback(
		(newMonsters) => {
			if (!reorderStartRef.current && encounterRef.current) {
				reorderStartRef.current = cloneEncounterSnapshot(encounterRef.current);
			}
			setEncounter((prev) =>
				prev ? { ...prev, monsters: newMonsters } : prev,
			);
			syncSelectedInstance(
				encounterRef.current
					? { ...encounterRef.current, monsters: newMonsters }
					: null,
			);
		},
		[syncSelectedInstance],
	);

	const handleMonstersDrop = useCallback(
		(nextMonsters = null) => {
			const current = nextMonsters
				? { ...encounterRef.current, monsters: nextMonsters }
				: encounterRef.current;
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
		},
		[saveEncounterState],
	);

	return {
		encounter,
		undoStack,
		redoStack,
		isSaving,
		selectedInstance,
		setSelectedInstance,
		showBestiary,
		setShowBestiary,
		showCharacterPicker,
		setShowCharacterPicker,
		playerCharacters,
		notification,
		setNotification,
		fileInputRef,
		averageInitiative: initiativeStats.average,
		initiativeStats,
		handleFileChange,
		handleExport,
		handleRename,
		handleAddMonster,
		handleAddCharacter,
		updateEncounterCharacter,
		handleAiUpdate,
		removeMonster,
		updateMonsterHp,
		updateMonsterMaxHp,
		updateMonsterImage,
		updateMonsterFromAi,
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
