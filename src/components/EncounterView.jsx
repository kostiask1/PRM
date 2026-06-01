import { useEffect, useMemo, useRef, useState } from "react";
import Panel from "./common/Panel";
import Button from "./form/Button";
import Modal from "./common/Modal";
import Bestiary from "./Bestiary";
import AiAssistantPanel from "./ai/AiAssistantPanel";
import BestiaryAiDraftModal from "./bestiary/BestiaryAiDraftModal";
import MonsterAiActionModal from "./bestiary/MonsterAiActionModal";
import MonsterAiEditModal from "./bestiary/MonsterAiEditModal";
import MonsterStatBlock from "./MonsterStatBlock";
import CharacterCard from "./CharacterCard";
import Notification from "./common/Notification";
import DraggableList from "./common/DraggableList";
import useEncounterView from "../hooks/useEncounterView";
import Tooltip from "./common/Tooltip";
import classNames from "../utils/classNames";
import "../assets/components/EncounterView.css";
import { api } from "../api";
import {
	alert,
	refreshEntitiesAction,
	setUiSettingsAction,
} from "../actions/app";
import { lang } from "../services/localization";
import { useAppDispatch, useAppSelector } from "../store/appStore";
import { renderMentionText } from "../renderers/contentRenderer";
import {
	getCharacterDisplayName,
	hasMonsterHpFormula,
	isEncounterCharacterParticipant,
} from "../utils/encounters";
import {
	buildDiffResources,
	getDiffResourceState as getAiDiffResourceState,
} from "../utils/aiDiff";

function isCustomSource(source) {
	return String(source || "").toUpperCase() === "CUSTOM";
}

function getHistoryChangeSummary(entry) {
	const resources = Array.isArray(entry?.changes?.resources)
		? entry.changes.resources
		: [];
	const summary = entry?.changes?.summary || {};
	const total = Number(summary.total) || resources.length || 0;
	if (!total) return "";
	const parts = [];
	if (summary.added) parts.push(`+${summary.added}`);
	if (summary.deleted) parts.push(`-${summary.deleted}`);
	if (summary.modified) parts.push(`~${summary.modified}`);
	return `${lang.t("Changes")}: ${parts.length ? parts.join(" ") : total}`;
}

function getDiffResourceState(resource) {
	return getAiDiffResourceState(resource, {
		added: lang.t("Added"),
		deleted: lang.t("Deleted"),
		modified: lang.t("Modified"),
	});
}

function getFirstChangedMonster(entry, resourceIds = null) {
	const ids = Array.isArray(resourceIds)
		? new Set(resourceIds.map((id) => String(id || "")).filter(Boolean))
		: null;
	const resources = Array.isArray(entry?.changes?.resources)
		? entry.changes.resources
		: [];
	const resource = resources.find(
		(item) => item?.kind === "custom-monster" && (!ids || ids.has(item.id)),
	);
	return resource?.after || null;
}

function getGridMonsterKey(monster) {
	const baseName = String(monster?.originalBestiaryName || monster?.name || "")
		.trim()
		.toLowerCase();
	const source = String(monster?.source || "")
		.trim()
		.toLowerCase();
	if (!baseName) return String(monster?.instanceId || "");
	return `${baseName}|${source}`;
}

function createEmptyCharacterDraft() {
	const now = Date.now();
	return {
		id: `new-character-${now}`,
		firstName: "",
		lastName: "",
		race: "",
		class: "",
		level: 1,
		motivation: "",
		trait: "",
		notes: [{ id: now + 1, title: "", text: "", collapsed: false }],
		collapsed: false,
		isNotesCollapsed: false,
	};
}

function resolveHpInputValue(inputValue, previousHp) {
	const text = String(inputValue ?? "").trim();
	const previousValue = parseInt(previousHp, 10) || 0;
	const relativeMatch = text.match(/^([+-])\s*(\d+)$/);

	if (relativeMatch) {
		const delta = parseInt(relativeMatch[2], 10) || 0;
		return Math.max(
			0,
			relativeMatch[1] === "-" ? previousValue - delta : previousValue + delta,
		);
	}

	return Math.max(0, parseInt(text, 10) || 0);
}

function EncounterView() {
	const campaign = useAppSelector((state) => state.active.campaign);
	const sessionId = useAppSelector(
		(state) => state.navigation.activeSessionFileName,
	);
	const currentLanguage = useAppSelector(
		(state) => state.localization.language,
	);
	const dispatch = useAppDispatch();
	const displayMode = useAppSelector(
		(state) => state.ui.encounterViewMode || "grid",
	);
	const gridColumns = useAppSelector(
		(state) => state.ui.encounterGridColumns || 2,
	);
	const [focusedMonsterId, setFocusedMonsterId] = useState(null);
	const [modalCharacter, setModalCharacter] = useState(null);
	const [isCreatingPlayer, setIsCreatingPlayer] = useState(false);
	const [playerDraft, setPlayerDraft] = useState(() =>
		createEmptyCharacterDraft(),
	);
	const [isPlayerSubmitting, setIsPlayerSubmitting] = useState(false);
	const [hpDrafts, setHpDrafts] = useState({});
	const [aiActionMonster, setAiActionMonster] = useState(null);
	const [aiEditingMonster, setAiEditingMonster] = useState(null);
	const [aiEditMode, setAiEditMode] = useState("edit");
	const [aiEditInstructions, setAiEditInstructions] = useState("");
	const [aiEditError, setAiEditError] = useState("");
	const [isAiEditingMonster, setIsAiEditingMonster] = useState(false);
	const [aiModels, setAiModels] = useState([]);
	const [selectedAiModel, setSelectedAiModel] = useState("");
	const [aiDraftResponseEntry, setAiDraftResponseEntry] = useState(null);
	const [isRestoringAiResponse, setIsRestoringAiResponse] = useState(false);
	const [aiTargetInstanceId, setAiTargetInstanceId] = useState(null);
	const aiDraftResponseRef = useRef(null);
	const aiEditControllerRef = useRef(null);
	const gridItemRefs = useRef(new Map());
	const focusTimeoutRef = useRef(null);
	const headerActionsRef = useRef(null);
	const [isHeaderActionsOpen, setIsHeaderActionsOpen] = useState(false);
	const view = useEncounterView();

	const { gridMonsters, gridRepresentativeByInstanceId } = useMemo(() => {
		const uniqueMonsters = [];
		const representativeByKey = new Map();
		const representativeByInstanceId = new Map();

		(view.encounter?.monsters || [])
			.filter((monster) => !isEncounterCharacterParticipant(monster))
			.forEach((monster) => {
				const key = getGridMonsterKey(monster);
				let representativeId = representativeByKey.get(key);

				if (!representativeId) {
					representativeId = monster.instanceId;
					representativeByKey.set(key, representativeId);
					uniqueMonsters.push(monster);
				}

				representativeByInstanceId.set(monster.instanceId, representativeId);
			});

		return {
			gridMonsters: uniqueMonsters,
			gridRepresentativeByInstanceId: representativeByInstanceId,
		};
	}, [view.encounter?.monsters]);

	const selectedGridInstanceId = view.selectedInstance
		? gridRepresentativeByInstanceId.get(view.selectedInstance.instanceId) ||
			view.selectedInstance.instanceId
		: null;
	const aiDraftDiffResources = useMemo(
		() =>
			buildDiffResources(aiDraftResponseEntry, {
				labels: {
					added: lang.t("Added"),
					deleted: lang.t("Deleted"),
					modified: lang.t("Modified"),
				},
			}),
		[aiDraftResponseEntry],
	);
	const displayedMonsterCount = gridMonsters.length;
	const effectiveDisplayMode =
		displayedMonsterCount === 1 ? "single" : displayMode;
	const effectiveGridColumns = Math.max(
		1,
		Math.min(gridColumns, gridMonsters.length || 1),
	);
	const availablePlayerCharacters = useMemo(() => {
		const addedIds = new Set(
			(view.encounter?.monsters || [])
				.filter(isEncounterCharacterParticipant)
				.map((entry) => String(entry.originalCharacterId || entry.id || "")),
		);

		return (view.playerCharacters || []).filter((character) => {
			const id = String(character.id || "");
			return !id || !addedIds.has(id);
		});
	}, [view.encounter?.monsters, view.playerCharacters]);

	useEffect(() => {
		return () => {
			if (focusTimeoutRef.current) {
				clearTimeout(focusTimeoutRef.current);
			}
			aiEditControllerRef.current?.abort();
		};
	}, []);

	useEffect(() => {
		if (!isHeaderActionsOpen) return undefined;

		const handlePointerDown = (event) => {
			if (headerActionsRef.current?.contains(event.target)) return;
			setIsHeaderActionsOpen(false);
		};

		document.addEventListener("pointerdown", handlePointerDown);
		return () => {
			document.removeEventListener("pointerdown", handlePointerDown);
		};
	}, [isHeaderActionsOpen]);

	useEffect(() => {
		if (!aiEditingMonster || aiModels.length > 0) return;
		api
			.listAiModels()
			.then((result) => {
				const models = Array.isArray(result?.models) ? result.models : [];
				setAiModels(models);
				setSelectedAiModel(
					(current) => current || result?.defaultModel || models[0]?.name || "",
				);
			})
			.catch((error) => {
				console.error("Failed to load AI models", error);
				setAiEditError(error.message || lang.t("Failed to connect to AI."));
			});
	}, [aiEditingMonster, aiModels.length]);

	if (!view.encounter) {
		return (
			<Panel className="EncounterView">
				<div className="Panel__body">{lang.t("Loading...")}</div>
			</Panel>
		);
	}

	const setGridItemRef = (instanceId, node) => {
		if (node) {
			gridItemRefs.current.set(instanceId, node);
		} else {
			gridItemRefs.current.delete(instanceId);
		}
	};

	const focusMonsterInGrid = (instanceId) => {
		const representativeId =
			gridRepresentativeByInstanceId.get(instanceId) || instanceId;
		const node = gridItemRefs.current.get(representativeId);
		if (node) {
			node.scrollIntoView({ behavior: "auto", block: "center" });
		}
		setFocusedMonsterId(representativeId);
		if (focusTimeoutRef.current) {
			clearTimeout(focusTimeoutRef.current);
		}
		focusTimeoutRef.current = setTimeout(() => {
			setFocusedMonsterId((current) =>
				current === representativeId ? null : current,
			);
		}, 1800);
	};

	const handleSelectMonster = (monster) => {
		if (isEncounterCharacterParticipant(monster)) {
			if (view.selectedInstance?.instanceId === monster.instanceId) {
				setModalCharacter(monster);
				return;
			}
			view.setSelectedInstance(monster);
			return;
		}
		view.setSelectedInstance(monster);
		if (effectiveDisplayMode === "grid") {
			focusMonsterInGrid(monster.instanceId);
		}
	};

	const handleRenameMonster = (monster) => {
		view.handleRenameMonster(monster.instanceId, monster.name);
	};

	const handleMonsterAiAction = (monster) => {
		if (!monster?.name) return;
		setAiTargetInstanceId(monster.instanceId || null);
		if (isCustomSource(monster.source)) {
			setAiActionMonster(monster);
			return;
		}
		setAiEditMode("create-based");
		setAiEditingMonster(monster);
		setAiEditInstructions("");
		setAiEditError("");
	};

	const closeMonsterAiAction = () => {
		if (isAiEditingMonster) return;
		setAiActionMonster(null);
	};

	const chooseMonsterAiAction = (mode) => {
		if (!aiActionMonster) return;
		const target = aiActionMonster;
		setAiActionMonster(null);
		setAiEditMode(mode);
		setAiEditingMonster(target);
		setAiEditInstructions("");
		setAiEditError("");
	};

	const closeAiEditCustomMonster = () => {
		if (isAiEditingMonster) return;
		setAiEditingMonster(null);
		setAiEditMode("edit");
		setAiEditInstructions("");
		setAiEditError("");
	};

	const cancelAiEditCustomMonsterRequest = () => {
		aiEditControllerRef.current?.abort();
	};

	const saveAiEditedCustomMonster = async () => {
		if (!aiEditingMonster?.name) return;
		const instructions = aiEditInstructions.trim();
		const isCreateBasedMode = aiEditMode === "create-based";
		if (!instructions && !isCreateBasedMode) {
			setAiEditError(lang.t("Describe what to change."));
			return;
		}
		const finalInstructions = isCreateBasedMode
			? [
					lang.t(
						"Create a new custom creature based on the selected creature. Do not change the selected creature.",
					),
					instructions,
				]
					.filter(Boolean)
					.join("\n\n")
			: instructions;

		setIsAiEditingMonster(true);
		setAiEditError("");
		const controller = new AbortController();
		aiEditControllerRef.current = controller;
		try {
			const data = await api.generateAi({
				type: "custom-monster",
				modelName: selectedAiModel || undefined,
				userInstructions: finalInstructions,
				path: {
					campaign: campaign.slug,
					session: sessionId,
					encounter: view.encounter?.id,
				},
				customMonsterTarget: aiEditingMonster,
				customMonsterMode: aiEditMode,
				parseAIResponse: true,
				generateCharacters: false,
				generateNpcs: false,
				generateLocations: false,
				generateEncounters: false,
				entityScope: "custom-bestiary",
				contextConfig: null,
				language: currentLanguage,
			}, { signal: controller.signal });
			if (data.draft && data.aiResponse) {
				setAiDraftResponseEntry(data.aiResponse);
			} else if (data.updated?.monsters?.length && aiTargetInstanceId) {
				view.updateMonsterFromAi(aiTargetInstanceId, data.updated.monsters[0]);
			}
			setAiEditingMonster(null);
			setAiEditMode("edit");
			setAiEditInstructions("");
		} catch (error) {
			if (error.name !== "AbortError") {
				setAiEditError(error.message || lang.t("Unknown error"));
			}
		} finally {
			if (aiEditControllerRef.current === controller) {
				aiEditControllerRef.current = null;
			}
			setIsAiEditingMonster(false);
		}
	};

	const saveAiDraftResponseChanges = async (resources) => {
		if (!aiDraftResponseEntry?.id) return null;
		const updatedEntry = await api.updateAiResponse("bestiary", aiDraftResponseEntry.id, {
			resources,
		});
		if (updatedEntry) {
			setAiDraftResponseEntry(updatedEntry);
		}
		return updatedEntry;
	};

	const restoreAiDraftResponse = async (
		entry = aiDraftResponseEntry,
		mode = "apply",
		options = {},
	) => {
		if (!entry?.id || isRestoringAiResponse) return;
		setIsRestoringAiResponse(true);
		try {
			const result =
				mode === "undo"
					? await api.undoAiResponse("bestiary", entry.id, {
							resourceIds: options.resourceIds,
						})
					: await api.applyAiResponse("bestiary", entry.id, {
							resourceIds: options.resourceIds,
						});
			const nextEntry = result?.response || entry;
			setAiDraftResponseEntry(nextEntry);
			const nextMonster = getFirstChangedMonster(nextEntry, options.resourceIds);
			if (mode !== "undo" && nextMonster && aiTargetInstanceId) {
				view.updateMonsterFromAi(aiTargetInstanceId, nextMonster);
			}
		} catch (error) {
			dispatch(
				alert({
					title: lang.t("AI history error"),
					message: error.message || lang.t("Unknown error"),
				}),
			);
		} finally {
			setIsRestoringAiResponse(false);
		}
	};

	const closeAiDraftResponse = () => {
		if (isRestoringAiResponse) return;
		setAiDraftResponseEntry(null);
	};

	const handleHpInputChange = (instanceId, value) => {
		setHpDrafts((current) => ({
			...current,
			[instanceId]: value,
		}));
	};

	const handleHpInputBlur = (monster) => {
		const draftValue = hpDrafts[monster.instanceId];
		if (draftValue === undefined) return;

		view.updateMonsterHp(
			monster.instanceId,
			resolveHpInputValue(draftValue, monster.currentHp),
		);
		setHpDrafts((current) => {
			const next = { ...current };
			delete next[monster.instanceId];
			return next;
		});
	};

	const handleCharacterChange =
		(instanceId) => (_characterId, nextCharacter) => {
			view.updateEncounterCharacter(instanceId, nextCharacter);
			setModalCharacter((current) =>
				current?.instanceId === instanceId
					? {
							...current,
							...nextCharacter,
							participantType: "character",
							instanceId,
						}
					: current,
			);
		};

	const updateEncounterViewMode = (mode) => {
		const nextMode = mode === "grid" ? "grid" : "single";
		dispatch(setUiSettingsAction({ encounterViewMode: nextMode }));
		api.updateSettings({ encounterViewMode: nextMode }).catch((error) => {
			console.error("Failed to save encounter view mode setting", error);
		});
	};

	const updateEncounterGridColumns = (columns) => {
		const nextColumns = Math.min(4, Math.max(1, Number(columns) || 2));
		dispatch(setUiSettingsAction({ encounterGridColumns: nextColumns }));
		api.updateSettings({ encounterGridColumns: nextColumns }).catch((error) => {
			console.error("Failed to save encounter grid columns setting", error);
		});
	};

	const resetPlayerCreateForm = () => {
		setIsCreatingPlayer(false);
		setPlayerDraft(createEmptyCharacterDraft());
	};

	const closeCharacterPicker = () => {
		if (isPlayerSubmitting) return;
		resetPlayerCreateForm();
		view.setShowCharacterPicker(false);
	};

	const startCreatePlayer = () => {
		setPlayerDraft(createEmptyCharacterDraft());
		setIsCreatingPlayer(true);
	};

	const handleCreatePlayer = async () => {
		if (!playerDraft.firstName?.trim()) {
			dispatch(
				alert({
					title: lang.t("Error"),
					message: lang.t("Name is required to create an entry."),
				}),
			);
			return;
		}

		const payload = {
			firstName: "",
			lastName: "",
			race: "",
			class: "",
			level: 1,
			motivation: "",
			trait: "",
			notes: [],
			collapsed: false,
			isNotesCollapsed: false,
			...Object.fromEntries(
				Object.entries(playerDraft || {}).filter(
					([key]) => !key.startsWith("_"),
				),
			),
		};
		delete payload.id;
		delete payload.slug;
		delete payload.createdAt;

		setIsPlayerSubmitting(true);
		try {
			const created = await api.createEntity(
				campaign.slug,
				"characters",
				payload,
			);
			dispatch(refreshEntitiesAction());
			view.handleAddCharacter(created);
			resetPlayerCreateForm();
		} catch (error) {
			console.error("Failed to create player from encounter", error);
			dispatch(
				alert({
					title: lang.t("Error"),
					message: lang.t("Failed to create entity."),
				}),
			);
		} finally {
			setIsPlayerSubmitting(false);
		}
	};

	const averageInitiativeTooltip = (
		<div>
			<div className="Tooltip__title">{lang.t("Avg initiative")}</div>
			<div className="Tooltip__text">
				{lang.t(
					"Expected initiative for each participant is 10.5 + Dexterity modifier. Arithmetic average across all participants. Best for regular encounters with roughly equal threats.",
				)}
			</div>
		</div>
	);
	const maxInitiativeTooltip = (
		<div>
			<div className="Tooltip__title">{lang.t("Max initiative")}</div>
			<div className="Tooltip__text">
				{lang.t(
					"Expected initiative is calculated as 10.5 + Dexterity modifier for each participant, then the highest value is shown. Best for deadly encounters with a BBEG.",
				)}
			</div>
		</div>
	);
	const weightedInitiativeTooltip = (
		<div>
			<div className="Tooltip__title">
				{lang.t("CR-weighted avg initiative")}
			</div>
			<div className="Tooltip__text">
				{lang.t(
					"Each participant's expected initiative is multiplied by CR + 1, then divided by the sum of those weights. Best for balanced battles with a boss.",
				)}
			</div>
		</div>
	);

	return (
		<Panel className="EncounterView">
			<div className="Panel__header">
				<div className="EncounterView__header">
					<Button
						variant="ghost"
						size={Button.SIZES.SMALL}
						onClick={view.handleBack}
						icon="back"
						className="SessionView__backBtn"
					/>
					<Tooltip content={lang.t("Click to rename")}>
						<h2 className="editable_title" onClick={view.handleRename}>
							{renderMentionText(view.encounter.name)}
						</h2>
					</Tooltip>
					<div className="EncounterView__metrics">
						<div className="EncounterViewMetric">
							<span className="EncounterViewMetric__label">
								{lang.t("Participants")}
							</span>
							<span className="EncounterViewMetric__value">
								{view.encounter.monsters.length}
							</span>
						</div>
						{view.encounter.monsters.length > 0 && (
							<>
								<div className="EncounterViewMetric">
									<Tooltip
										content={averageInitiativeTooltip}
										className="EncounterViewMetric__tooltip"
									>
										<span className="EncounterViewMetric__label">
											{lang.t("Avg initiative")}
										</span>
										<span className="EncounterViewMetric__value">
											{view.initiativeStats.average}
										</span>
									</Tooltip>
								</div>
								<div className="EncounterViewMetric">
									<Tooltip
										content={maxInitiativeTooltip}
										className="EncounterViewMetric__tooltip"
									>
										<span className="EncounterViewMetric__label">
											{lang.t("Max initiative")}
										</span>
										<span className="EncounterViewMetric__value">
											{view.initiativeStats.max}
										</span>
									</Tooltip>
								</div>
								<div className="EncounterViewMetric EncounterViewMetric__accent">
									<Tooltip
										content={weightedInitiativeTooltip}
										className="EncounterViewMetric__tooltip"
									>
										<span className="EncounterViewMetric__label">
											{lang.t("CR-weighted avg initiative")}
										</span>
										<span className="EncounterViewMetric__value">
											{view.initiativeStats.weightedAverage}
										</span>
									</Tooltip>
								</div>
							</>
						)}
					</div>
				</div>
				<div
					ref={headerActionsRef}
					className={classNames("EncounterView__headerActions", {
						is_open: isHeaderActionsOpen,
					})}
				>
					<Button
						variant="ghost"
						size={Button.SIZES.SMALL}
						icon="menu"
						className="EncounterView__headerActionsToggle"
						onClick={() => setIsHeaderActionsOpen((value) => !value)}
						title={lang.t("Encounter actions")}
					/>
					<div className="EncounterView__headerActionsMenu">
						<div className="EncounterView__viewModeSwitch">
							<Button
								variant={
									effectiveDisplayMode === "single" ? "primary" : "ghost"
								}
								size={Button.SIZES.SMALL}
								icon="list"
								onClick={() => updateEncounterViewMode("single")}
								title={lang.t("Preview")}
							/>
							<Button
								variant={effectiveDisplayMode === "grid" ? "primary" : "ghost"}
								size={Button.SIZES.SMALL}
								icon="layers"
								onClick={() => updateEncounterViewMode("grid")}
								disabled={displayedMonsterCount === 1}
								title={lang.t("All")}
							/>
						</div>
						{effectiveDisplayMode === "grid" && (
							<div
								className="EncounterView__gridColumnsSwitch"
								aria-label={lang.t("Grid columns")}
							>
								{[1, 2, 3, 4].map((columns) => (
									<Button
										key={columns}
										variant={gridColumns === columns ? "primary" : "ghost"}
										size={Button.SIZES.SMALL}
										onClick={() => updateEncounterGridColumns(columns)}
										title={lang.t("{count} columns", { count: columns })}
									>
										{columns}
									</Button>
								))}
							</div>
						)}
						<Button
							variant="ghost"
							size={Button.SIZES.SMALL}
							icon="undo"
							onClick={view.handleUndo}
							disabled={view.undoStack.length === 0 || view.isSaving}
							title={lang.t("Undo (Ctrl+Z)")}
						/>
						<Button
							variant="ghost"
							size={Button.SIZES.SMALL}
							icon="redo"
							onClick={view.handleRedo}
							disabled={view.redoStack.length === 0 || view.isSaving}
							title={lang.t("Redo (Ctrl+Y)")}
						/>
						<input
							type="file"
							ref={view.fileInputRef}
							style={{ display: "none" }}
							accept=".json"
							onChange={view.handleFileChange}
						/>
						<Button
							variant="ghost"
							size={Button.SIZES.SMALL}
							icon="import"
							onClick={() => view.fileInputRef.current?.click()}
							title={lang.t("Import encounter")}
						/>
						<Button
							variant="ghost"
							size={Button.SIZES.SMALL}
							icon="export"
							onClick={view.handleExport}
							title={lang.t("Export encounter")}
						/>
					</div>
				</div>
			</div>
			<div className="Panel__body EncounterView__body">
				<div className="EncounterView__main">
					<div className="EncounterView__list">
						<div className="EncounterView__addActions">
							<Button
								variant="create"
								onClick={() => view.setShowBestiary(true)}
								icon="plus"
								className="EncounterView__addBtn"
							>
								{lang.t("Add monster")}
							</Button>
							<Button
								variant="ghost"
								onClick={() => view.setShowCharacterPicker(true)}
								icon="user"
								className="EncounterView__addBtn"
							>
								{lang.t("Add player")}
							</Button>
						</div>

						<DraggableList
							items={view.encounter.monsters}
							onReorder={view.handleReorderMonsters}
							onDrop={view.handleMonstersDrop}
							keyExtractor={(m) => m.instanceId}
							renderItem={(m, isDragging) => {
								const isCharacter = isEncounterCharacterParticipant(m);
								const displayName = isCharacter
									? getCharacterDisplayName(m)
									: String(m.name);

								return (
									<div
										className={classNames("EncounterMonsterRow", {
											EncounterMonsterRow__character: isCharacter,
											is_active:
												view.selectedInstance?.instanceId === m.instanceId,
											is_dragging: isDragging,
										})}
										onClick={() => handleSelectMonster(m)}
									>
										<div className="EncounterMonsterRow__content">
											{isCharacter ? (
												<div className="EncounterMonsterRow__name">
													{renderMentionText(displayName)}
												</div>
											) : (
												<div className="EncounterMonsterRow__name">
													{renderMentionText(displayName)}
												</div>
											)}
											<div className="EncounterMonsterRow__stats">
												{isCharacter ? (
													<div className="EncounterMonsterRow__playerBadge">
														{lang.t("Player")}
													</div>
												) : (
													<>
														<div className="EncounterMonsterRow__hp">
															<input
																type="text"
																value={hpDrafts[m.instanceId] ?? m.currentHp}
																onChange={(e) =>
																	handleHpInputChange(
																		m.instanceId,
																		e.target.value,
																	)
																}
																onBlur={() => handleHpInputBlur(m)}
																onKeyDown={(e) => {
																	if (e.key === "Enter") {
																		e.currentTarget.blur();
																	}
																}}
																onFocus={(e) => e.currentTarget.select()}
																onClick={(e) => {
																	e.stopPropagation();
																	e.currentTarget.select();
																}}
																className="EncounterMonsterRow__hpInput"
																style={{
																	color: view.getHpColor(
																		m.currentHp,
																		m.hit_points,
																	),
																}}
															/>
															<span className="muted">/</span>
															<Tooltip content={lang.t("Max HP")}>
																<input
																	type="number"
																	value={m.hit_points}
																	onChange={(e) =>
																		view.updateMonsterMaxHp(
																			m.instanceId,
																			e.target.value,
																		)
																	}
																	onClick={(e) => e.stopPropagation()}
																	className="EncounterMonsterRow__maxHpInput"
																/>
															</Tooltip>
														</div>
														<div className="EncounterMonsterRow__ac">
															{lang.t("AC")} {m.armor_class}
														</div>
													</>
												)}
												<div className="EncounterMonsterRow__actions">
													{!isCharacter && hasMonsterHpFormula(m) && (
														<Button
															variant="ghost"
															size={Button.SIZES.SMALL}
															icon="dice"
															className="EncounterMonsterRow__action"
															onClick={(e) => {
																e.stopPropagation();
																view.rollMonsterHp(m.instanceId);
															}}
															title={lang.t("Roll HP by formula")}
														/>
													)}
													{!isCharacter && (
														<Button
															variant="ghost"
															size={Button.SIZES.SMALL}
															icon="plus"
															className="EncounterMonsterRow__action"
															onClick={(e) => {
																e.stopPropagation();
																view.duplicateMonster(m);
															}}
															title={lang.t("Duplicate")}
														/>
													)}
													<Button
														variant="danger"
														size={Button.SIZES.SMALL}
														icon="x"
														className="EncounterMonsterRow__action"
														onClick={(e) => {
															e.stopPropagation();
															view.removeMonster(m.instanceId);
														}}
														title={lang.t("Delete")}
													/>
												</div>
											</div>
										</div>
									</div>
								);
							}}
						/>
					</div>

					<div
						className={classNames("EncounterView__detailView", {
							EncounterView__detailView__grid: effectiveDisplayMode === "grid",
							EncounterView__detailView__single:
								effectiveDisplayMode !== "grid",
						})}
					>
						{effectiveDisplayMode === "grid" ? (
							gridMonsters.length > 0 ? (
								<div
									className="EncounterView__grid"
									style={{ "--encounter-grid-columns": effectiveGridColumns }}
								>
									{gridMonsters.map((monster) => (
										<div
											key={monster.instanceId}
											ref={(node) => setGridItemRef(monster.instanceId, node)}
											className={classNames("EncounterView__gridItem", {
												is_selected:
													selectedGridInstanceId === monster.instanceId,
												is_focused: focusedMonsterId === monster.instanceId,
											})}
										>
											<MonsterStatBlock
												monster={monster}
												onNameRename={handleRenameMonster}
												onAiAction={handleMonsterAiAction}
												tokenImageOverrideUrl={view.getMonsterImageOverride(
													monster,
												)}
												layoutMode="grid"
											/>
										</div>
									))}
								</div>
							) : (
								<p className="muted">
									{lang.t("Select a monster from the list to see its stats.")}
								</p>
							)
						) : (
							<>
								{view.selectedInstance ? (
									isEncounterCharacterParticipant(view.selectedInstance) ? (
										<CharacterCard
											character={view.selectedInstance}
											campaignSlug={campaign.slug}
											type="characters"
											viewMode="modal"
											showDeleteButton={false}
											onChange={handleCharacterChange(
												view.selectedInstance.instanceId,
											)}
										/>
									) : (
										<MonsterStatBlock
											monster={view.selectedInstance}
											onNameRename={handleRenameMonster}
											onAiAction={handleMonsterAiAction}
											tokenImageOverrideUrl={view.getMonsterImageOverride(
												view.selectedInstance,
											)}
										/>
									)
								) : (
									<p className="muted">
										{lang.t("Select a monster from the list to see its stats.")}
									</p>
								)}
							</>
						)}
					</div>
				</div>
				<AiAssistantPanel
					sessionData={view.encounter}
					campaignContext={{
						description: campaign.description,
						notes: campaign.notes,
					}}
					onInsertResult={view.handleAiUpdate}
				/>
			</div>

			{view.showBestiary && (
				<Modal
					title={lang.t("Choose monster")}
					onCancel={() => view.setShowBestiary(false)}
					showFooter={false}
					type="custom"
				>
					<Bestiary onAddMonster={view.handleAddMonster} isEmbedded={true} />
				</Modal>
			)}

			{view.showCharacterPicker && (
				<Modal
					title={
						isCreatingPlayer ? lang.t("New character") : lang.t("Choose player")
					}
					onCancel={closeCharacterPicker}
					showFooter={false}
					type="custom"
				>
					<div className="EncounterCharacterPicker">
						{isCreatingPlayer ? (
							<div className="EncounterCharacterPicker__create">
								<CharacterCard
									character={playerDraft}
									onChange={(_id, updated) => setPlayerDraft(updated)}
									onDelete={() => {}}
									onToggleCollapse={null}
									campaignSlug={campaign.slug}
									type="characters"
									viewMode="modal"
									showDeleteButton={false}
									showHeader={false}
								/>
								<div className="EncounterCharacterPicker__createActions">
									<Button
										variant="primary"
										onClick={handleCreatePlayer}
										disabled={
											isPlayerSubmitting || !playerDraft.firstName?.trim()
										}
									>
										{lang.t("Create")}
									</Button>
									<Button
										variant="ghost"
										onClick={resetPlayerCreateForm}
										disabled={isPlayerSubmitting}
									>
										{lang.t("Back")}
									</Button>
								</div>
							</div>
						) : (
							<>
								<Button
									variant="create"
									icon="plus"
									onClick={startCreatePlayer}
									className="EncounterCharacterPicker__createBtn"
								>
									{lang.t("New character")}
								</Button>
								{availablePlayerCharacters.length > 0 ? (
									availablePlayerCharacters.map((character) => (
										<button
											type="button"
											key={character.id || character.slug}
											className="EncounterCharacterPicker__item"
											onClick={() => view.handleAddCharacter(character)}
										>
											<span className="EncounterCharacterPicker__name">
												{getCharacterDisplayName(character)}
											</span>
											<span className="EncounterCharacterPicker__meta">
												{[character.race, character.class]
													.filter(Boolean)
													.join(" • ")}
												{character.level
													? ` • ${lang.t("Lvl. {level}", {
															level: character.level,
														})}`
													: ""}
											</span>
										</button>
									))
								) : (
									<p className="muted">
										{view.playerCharacters.length > 0
											? lang.t(
													"All player characters are already in encounter.",
												)
											: lang.t("No player characters found.")}
									</p>
								)}
							</>
						)}
					</div>
				</Modal>
			)}

			{modalCharacter && (
				<Modal
					title={getCharacterDisplayName(modalCharacter)}
					onCancel={() => setModalCharacter(null)}
					showFooter={false}
					type="custom"
				>
					<CharacterCard
						character={modalCharacter}
						campaignSlug={campaign.slug}
						type="characters"
						viewMode="modal"
						showDeleteButton={false}
						onChange={handleCharacterChange(modalCharacter.instanceId)}
					/>
				</Modal>
			)}

			<MonsterAiActionModal
				aiActionMonster={aiActionMonster}
				onCancel={closeMonsterAiAction}
				onChoose={chooseMonsterAiAction}
			/>
			<MonsterAiEditModal
				aiEditingMonster={aiEditingMonster}
				aiEditError={aiEditError}
				aiEditInstructions={aiEditInstructions}
				aiEditMode={aiEditMode}
				aiModels={aiModels}
				isAiEditingMonster={isAiEditingMonster}
				onCancel={closeAiEditCustomMonster}
				onCancelRequest={cancelAiEditCustomMonsterRequest}
				onInstructionsChange={setAiEditInstructions}
				onModelChange={setSelectedAiModel}
				onSave={saveAiEditedCustomMonster}
				selectedAiModel={selectedAiModel}
			/>
			<BestiaryAiDraftModal
				aiDraftDiffResources={aiDraftDiffResources}
				aiDraftResponseEntry={aiDraftResponseEntry}
				aiDraftResponseRef={aiDraftResponseRef}
				getDiffResourceState={getDiffResourceState}
				getHistoryChangeSummary={getHistoryChangeSummary}
				isRestoringAiResponse={isRestoringAiResponse}
				onApply={(entry) => restoreAiDraftResponse(entry, "apply")}
				onApplyResource={(entry, resourceIds) =>
					restoreAiDraftResponse(entry, "apply", { resourceIds })
				}
				onCancel={closeAiDraftResponse}
				onSaveDraftChanges={saveAiDraftResponseChanges}
				onUndo={(entry) => restoreAiDraftResponse(entry, "undo")}
				onUndoResource={(entry, resourceIds) =>
					restoreAiDraftResponse(entry, "undo", { resourceIds })
				}
			/>

			{view.notification && (
				<Notification
					message={view.notification}
					onClose={() => view.setNotification(null)}
				/>
			)}
		</Panel>
	);
}

export { EncounterView };
export default EncounterView;
