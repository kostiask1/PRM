import {
	type ChangeEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

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
import type { EncounterUpdateResult } from "../../../entities/session/index.js";
import { bestiaryApi } from "../../../entities/bestiary/index.js";
import {
	useEncounterParticipantSynchronization,
	useEncounterPersistence,
	type EncounterEditorState,
} from "../../../features/encounter-editor/index.js";

const api = { ...campaignApi, ...sessionApi, ...bestiaryApi };
import { navigateTo, useAppDispatch, useAppSelector } from "../../../shared/model/index.js";
import { lang } from "../../../shared/lib/index.js";
import {
	createEncounterMonsterInstance,
	ensureEncounterMonsterId,
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

import type {
	EncounterSyncEvent,
	EncounterUpdateOptions,
	EncounterViewModel,
	EncounterViewParticipant,
	EncounterViewSession,
	EncounterViewState,
	InitiativeStats,
	MonsterAiUpdateOptions,
} from "./contracts.ts";
import { calculateInitiativeStats } from "./encounterViewMetrics.ts";
import {
	executeEncounterDiceProcessing,
	executeEncounterHistoryAction,
	executeEncounterLoadPlan,
	executeEncounterMonsterDropPlan,
	executeEncounterNavigationAction,
	executeEncounterUpdatePlan,
	getEncounterAddCharacterPlan,
	getEncounterLoadPlan,
	getEncounterHistoryAction,
	getEncounterMonsterDropPlan,
	getEncounterNavigationAction,
	getEncounterRenamePlan,
	getEncounterSessionEncounters,
	getEncounterUpdatePlan,
	getSelectedEncounterParticipant,
	isEncounterEditableTarget,
	parseEncounterImport,
	replaceEncounterMonsterFromAi,
	shouldReloadEncounterFromSync,
} from "./encounterPagePresentation.ts";

interface ActiveCampaign {
	slug: string;
}

interface EncounterDiceResult {
	resultId?: string | number;
	result?: { total?: unknown };
	context?: {
		kind?: string;
		campaignSlug?: string;
		sessionId?: string;
		encounterId?: string;
		instanceId?: string;
	};
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function cloneEncounterSnapshot<T>(value: T): T {
	if (!value) return value;
	if (typeof structuredClone === "function") return structuredClone(value);
	return JSON.parse(JSON.stringify(value));
}

function getEncounterKeyboardInput(event: KeyboardEvent, showBestiary: boolean) {
	const target = event.target instanceof HTMLElement ? event.target : null;
	return {
		key: event.key,
		code: event.code,
		shiftKey: event.shiftKey,
		isEditableTarget: isEncounterEditableTarget(target),
		isHistoryShortcut: isHistoryShortcutEvent(event),
		shouldUseAppHistory: shouldUseAppHistoryForEvent(event),
		showBestiary,
	};
}

export default function useEncounterView(): EncounterViewModel {
	const dispatch = useAppDispatch();
	const campaign = useAppSelector(
		(state) => state.active.campaign,
	) as ActiveCampaign;
	const { activeSessionFileName, activeEncounterId } = useAppSelector(
		(state) => state.navigation,
	);
	const syncEvent = useAppSelector(
		(state) => state.sync.event,
	) as EncounterSyncEvent | null;
	const sessionId = activeSessionFileName || "";
	const encounterId = activeEncounterId ?? "";
	const handleBack = useCallback(
		() => navigateTo(campaign.slug, sessionId),
		[campaign.slug, sessionId],
	);

	const [encounter, setEncounter] = useState<EncounterViewState | null>(null);
	const [selectedInstance, setSelectedInstance] =
		useState<EncounterViewParticipant | null>(null);
	const [showBestiary, setShowBestiary] = useState(false);
	const [showCharacterPicker, setShowCharacterPicker] = useState(false);
	const [notification, setNotification] = useState<string | null>(null);
	const [undoStack, setUndoStack] = useState<EncounterViewState[]>([]);
	const [redoStack, setRedoStack] = useState<EncounterViewState[]>([]);
	const diceRolledResult = useAppSelector(
		(state) => state.dice.rolledResult,
	) as EncounterDiceResult | null;
	const storeTheme = useAppSelector((state) => state.ui.theme);

	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const processedDiceResultIdRef = useRef<string | number | null>(null);
	const encounterRef = useRef<EncounterViewState | null>(null);
	const isUpdatingHistoryRef = useRef(false);
	const reorderStartRef = useRef<EncounterViewState | null>(null);
	const handleEncounterSaved = useCallback(
		(result: EncounterUpdateResult) => {
			dispatch(setActiveSessionAction(result.session));
			dispatch(requestCampaignsReloadAction());
		},
		[dispatch],
	);
	const reportEncounterSaveError = useCallback((error: unknown) => {
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
		const handleKeyDown = (e: KeyboardEvent) => {
			if (document.querySelector(".Modal__overlay")) return;
			executeEncounterNavigationAction(
				getEncounterNavigationAction(getEncounterKeyboardInput(e, showBestiary)),
				{
					onHandled: () => e.preventDefault(),
					onCloseBestiary: () => setShowBestiary(false),
					onBack: handleBack,
				},
			);
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [showBestiary, handleBack]);

	const loadEncounter = useCallback(
		async ({ retries = 3, resetHistory = true } = {}) => {
			try {
				const session = await api.getSession(campaign.slug, sessionId);
				dispatch(setActiveSessionAction(session));
				executeEncounterLoadPlan(
					getEncounterLoadPlan(session, encounterId, retries, resetHistory),
					{
						onRetry: (nextRetries, shouldResetHistory) => {
							setTimeout(() => loadEncounter({
								retries: nextRetries,
								resetHistory: shouldResetHistory,
							}), 300);
						},
						onNotFound: () => {
							dispatch(alert({
								title: lang.t("Error"),
								message: lang.t("Encounter not found or data is still updating."),
							}));
							handleBack();
						},
						onLoaded: (found, selected, shouldResetHistory) => {
							setEncounter(found);
							setSelectedInstance(selected);
							if (shouldResetHistory) {
								setUndoStack([]);
								setRedoStack([]);
							}
						},
					},
				);
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
		if (
			shouldReloadEncounterFromSync(
				syncEvent,
				campaign.slug,
				sessionId,
				hasPendingSave(),
			)
		) {
			loadEncounter({ resetHistory: false });
		}
	}, [campaign.slug, hasPendingSave, loadEncounter, sessionId, syncEvent]);

	const syncSelectedInstance = useCallback(
		(nextEncounter: EncounterViewState | null, preferredId: string | null = null) => {
			setSelectedInstance((prev) => {
				return getSelectedEncounterParticipant(
					nextEncounter,
					preferredId,
					prev?.instanceId,
				);
			});
		},
		[],
	);

	const applyEncounterUpdate = useCallback(
		(
			nextEncounter: EncounterEditorState | null,
			options: EncounterUpdateOptions = {},
		) => {
			executeEncounterUpdatePlan(
				getEncounterUpdatePlan(
					nextEncounter,
					encounterRef.current,
					options,
					isUpdatingHistoryRef.current,
				),
				{
					recordUndo: (snapshot) => {
						setUndoStack((prev) =>
							addUndoSnapshot(prev, snapshot, cloneEncounterSnapshot),
						);
						setRedoStack(clearRedoStack());
					},
					setEncounter,
					syncSelected: syncSelectedInstance,
					persist: saveEncounterState,
				},
			);
		},
		[saveEncounterState, syncSelectedInstance],
	);

	const reportParticipantSyncError = useCallback((error: unknown, operation: string) => {
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
		const handleHistoryShortcuts = (e: KeyboardEvent) => {
			if (document.querySelector(".Modal__overlay")) return;
			executeEncounterHistoryAction(
				getEncounterHistoryAction(getEncounterKeyboardInput(e, showBestiary)),
				{
					onHandled: () => e.preventDefault(),
					onUndo: handleUndo,
					onRedo: handleRedo,
				},
			);
		};

		window.addEventListener("keydown", handleHistoryShortcuts);
		return () => window.removeEventListener("keydown", handleHistoryShortcuts);
	}, [handleUndo, handleRedo, showBestiary]);

	const handleAiUpdate = useCallback(
		(updatedSession: EncounterViewSession | null) => {
			if (!updatedSession) return;
			const sData = updatedSession.data || updatedSession;
			const found = getEncounterSessionEncounters({ data: sData }).find(
					(e) => String(e.id ?? "") === String(encounterId),
			);
			if (found) {
				applyEncounterUpdate(found, { persist: false });
			}
			dispatch(requestCampaignsReloadAction());
		},
		[encounterId, dispatch, applyEncounterUpdate],
	);

	const handleAddMonster = useCallback(
		async (m: EncounterViewParticipant) => {
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
		(character: import("../../../entities/campaign/index.js").CampaignEntityRecord) => {
			const plan = getEncounterAddCharacterPlan(encounter, character);
			if (!plan) return;
			applyEncounterUpdate(plan.encounter, {
				preferredId: plan.preferredId,
			});
			setShowCharacterPicker(false);
			setNotification(
				lang.t("{name} added to encounter.", {
					name: plan.displayName,
				}),
			);
		},
		[encounter, applyEncounterUpdate],
	);

	const removeMonster = useCallback(
		(instanceId: string) => {
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
		(instanceId: string, newHp: string | number) => {
			if (!encounter) return;
			const updatedMonsters = encounter.monsters.map((m) =>
				m.instanceId === instanceId
					? { ...m, currentHp: Math.max(0, parseInt(String(newHp), 10) || 0) }
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
		(instanceId: string, newMaxHp: string | number) => {
			if (!encounter) return;
			const updatedMonsters = encounter.monsters.map((m) =>
				m.instanceId === instanceId
					? { ...m, hit_points: parseInt(String(newMaxHp), 10) || 0 }
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
		(instanceId: string, imageUrl: string | null) => {
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
		(
			instanceId: string,
			nextMonster: EncounterViewParticipant,
			options: MonsterAiUpdateOptions = {},
		) => {
			if (!encounter || !nextMonster) return;
			const updated = replaceEncounterMonsterFromAi(
				encounter,
				instanceId,
				nextMonster,
				options,
			);
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
		const plan = getEncounterRenamePlan(encounter, name);
		if (plan) applyEncounterUpdate(plan.encounter);
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
		(e: ChangeEvent<HTMLInputElement>) => {
			if (!encounter) return;
			const file = e.target.files?.[0];
			if (!file) return;

			const reader = new FileReader();
			reader.onload = async (event: ProgressEvent<FileReader>) => {
				try {
					const updated = parseEncounterImport(event.target?.result, encounter, {
						invalidFileMessage: lang.t("Invalid file format"),
						missingMonstersMessage: lang.t(
							"Invalid file format (monster list is missing)",
						),
					});

					applyEncounterUpdate(updated, {
						preferredId: updated.monsters[0]?.instanceId,
					});
					setNotification(lang.t("Encounter imported successfully."));
				} catch (err) {
					dispatch(
						alert({ title: lang.t("Import error"), message: getErrorMessage(err) }),
					);
				}
				e.target.value = "";
			};
			reader.readAsText(file);
		},
		[encounter, applyEncounterUpdate, dispatch],
	);

	const duplicateMonster = useCallback(
		(m: EncounterViewParticipant) => {
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
		(instanceId: string, updatedCharacter: Record<string, unknown>) => {
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
		(instanceId: string) => {
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
		executeEncounterDiceProcessing({
			resultId: diceRolledResult?.resultId,
			processedResultId: processedDiceResultIdRef.current,
			result: diceRolledResult?.result,
			context: diceRolledResult?.context,
			campaignSlug: campaign.slug,
			sessionId: String(sessionId),
			encounterId: String(encounterId),
			encounter,
		}, {
			onProcessed: (resultId) => {
				processedDiceResultIdRef.current = resultId;
			},
			onUpdate: (update) => applyEncounterUpdate(update.encounter, {
				preferredId: update.preferredId,
			}),
		});
	}, [
		campaign.slug,
		diceRolledResult,
		sessionId,
		encounterId,
		encounter,
		applyEncounterUpdate,
	]);

	const getHpColor = useCallback(
		(current: number, max: number) => {
			const ratio = max > 0 ? Math.min(Math.max(0, current / max), 1) : 0;
			const hue = ratio * 110;
			return `hsl(${hue}, 80%, ${storeTheme === "dark" ? "60" : "43"}%)`;
		},
		[storeTheme],
	);

	const initiativeStats = useMemo<InitiativeStats>(
		() => calculateInitiativeStats(encounter?.monsters || []),
		[encounter],
	);

	const handleReorderMonsters = useCallback(
		(newMonsters: EncounterViewParticipant[]) => {
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
		(nextMonsters: EncounterViewParticipant[] | null = null) => {
			executeEncounterMonsterDropPlan(
				getEncounterMonsterDropPlan({
					nextMonsters,
					currentEncounter: encounterRef.current,
					reorderStart: reorderStartRef.current,
					isUpdatingHistory: isUpdatingHistoryRef.current,
				}),
				{
					clearReorderStart: () => {
						reorderStartRef.current = null;
					},
					recordUndo: (snapshot) => {
						setUndoStack((prev) => [...prev, snapshot]);
						setRedoStack([]);
					},
					persist: saveEncounterState,
				},
			);
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
