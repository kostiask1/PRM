import {
	useEffect,
	useMemo,
	useRef,
	useState,
	type RefObject,
} from "react";
import {
	Button,
	DraggableList,
	Panel,
} from "../../../shared/ui/index.js";
import { BestiaryBrowser as Bestiary } from "../../../widgets/bestiary-browser/index.js";
import {
	MonsterAiActionModal,
	applyMonsterAiDraftSaveResult,
	buildMonsterAiRequestPayload,
	executeMonsterAiRequest,
	executeMonsterFieldSavePlan,
	getMonsterAiGenerationPlan,
	getMonsterAiDraftSavePlan,
	getMonsterAiRestoreRequestPlan,
	getMonsterFieldEditPlan,
	getMonsterFieldSavePlan,
	type EncounterMonsterTarget,
	type MonsterAiEditMode,
	type MonsterAiAction,
} from "../../../features/ai-edit-monster/index.js";
import { createAiResponseModalComponent } from "../../../widgets/ai-response-modal/index.js";
import { AiAssistantPanel } from "../../../widgets/ai-assistant/index.js";
import { createMonsterEditorModalComponent } from "../../../widgets/monster-editor-modal/index.js";
import { MonsterStatBlock } from "../../../widgets/monster-stat-block/index.js";
import { SpellsBrowser } from "../../../widgets/spells-browser/index.js";
import { createRulesReferenceModalContentComponent } from "../../../widgets/rules-reference-modal/index.js";
import {
	CharacterCard,
	LocationCard,
} from "../../../widgets/campaign-entity-card/index.js";
import useEncounterView from "../model/useEncounterView.ts";
import { useEncounterAiModelLoading } from "../model/useEncounterAiModelLoading.ts";
import { useEncounterGridFocus } from "../model/useEncounterGridFocus.ts";
import { useEncounterHpEditing } from "../model/useEncounterHpEditing.ts";
import { useEncounterPlayerCreation } from "../model/useEncounterPlayerCreation.ts";
import { useEncounterRequestCleanup } from "../model/useEncounterRequestCleanup.ts";
import "../../../assets/components/EncounterView.css";
import { campaignApi } from "../../../entities/campaign/index.js";
import {
	bestiaryApi,
	type BestiaryMonster,
} from "../../../entities/bestiary/index.js";
import { aiApi } from "../../../features/ai/index.js";
import { settingsApi } from "../../../features/settings/index.js";
import EncounterBestiaryAiModals from "./components/EncounterBestiaryAiModals.tsx";
import EncounterBestiaryOverlay from "./components/EncounterBestiaryOverlay.tsx";
import EncounterCharacterOverlays from "./components/EncounterCharacterOverlays.tsx";
import EncounterDetail from "./components/EncounterDetail.tsx";
import EncounterHeader from "./components/EncounterHeader.tsx";
import EncounterMonsterRow from "./components/EncounterMonsterRow.tsx";
import EncounterNotification from "./components/EncounterNotification.tsx";

const EncounterRulesReferenceContent =
	createRulesReferenceModalContentComponent({
		MonsterStatBlock,
		SpellsBrowser,
	});
const EncounterMonsterEditorModal = createMonsterEditorModalComponent({
	RulesReferenceContent: EncounterRulesReferenceContent,
});
const EncounterAiResponseModal = createAiResponseModalComponent({
	CharacterCard,
	LocationCard,
	MonsterStatBlock,
	MonsterEditorModal: EncounterMonsterEditorModal,
});

const api = { ...campaignApi, ...bestiaryApi, ...aiApi, ...settingsApi };
import { lang } from "../../../shared/lib/index.js";
import {
	isEncounterCharacterParticipant,
} from "../../../entities/encounter/index.js";
import {
	buildDiffResources,
	type AiHistoryEntry,
	type AiHistoryResource,
	type AiModelDescriptor,
} from "../../../features/ai/index.js";
import {
	getHistoryChangeSummary as getAiHistoryChangeSummary,
	getLocalizedDiffResourceState,
} from "../../../features/ai/index.js";
import {
	applyEncounterGeneratedMonsterResult,
	applyEncounterMonsterRestoreResult,
	executeEncounterAiRestoreRequest,
	executeEncounterParticipantSelection,
	getAvailableEncounterCharacters,
	getEncounterGridProjection,
	getEncounterParticipantSelectionPlan,
	isCustomBestiarySource as isCustomSource,
	resolveEncounterHpInputValue as resolveHpInputValue,
} from "../model/encounterPagePresentation.ts";
import type {
	EncounterViewModel,
	EncounterViewParticipant,
} from "../model/contracts.ts";
import type {
	CampaignEntityRecord,
	CampaignRecord,
	CharacterData,
} from "../../../entities/campaign/index.js";
import { useEncounterPageRuntime } from "../model/EncounterPageRuntime.tsx";

type EncounterDraftMode = "local" | "global";
type EncounterDisplayMode = "grid" | "single";
type FieldEditingMonster = {
	mode: MonsterAiEditMode;
	original: EncounterViewParticipant;
	monster: EncounterMonsterTarget;
};
type RestoreMode = "apply" | "undo";
type RestoreOptions = { resourceIds?: string[] };

const EMPTY_ENCOUNTER_PARTICIPANTS: EncounterViewParticipant[] = [];
const EMPTY_CAMPAIGN_ENTITIES: CampaignEntityRecord[] = [];

function translate(...args: Parameters<typeof lang.t>) {
	return lang.t(...args);
}

function getHistoryChangeSummary(entry: AiHistoryEntry) {
	return getAiHistoryChangeSummary(entry, translate);
}

function getDiffResourceState(resource: AiHistoryResource) {
	return getLocalizedDiffResourceState(resource, translate);
}

function getParticipantInstanceId(participant: EncounterViewParticipant): string {
	return String(participant.instanceId || participant.id || "");
}

function getEncounterDisplayMode(value: unknown): EncounterDisplayMode {
	return value === "single" ? "single" : "grid";
}

function getEncounterGridColumns(value: unknown): number {
	return Number(value) || 2;
}

function getSelectedGridId(
	selected: EncounterViewParticipant | null,
	representatives: Map<string, string>,
): string | null {
	if (!selected) return null;
	const instanceId = getParticipantInstanceId(selected);
	return representatives.get(instanceId) || instanceId;
}

function getEncounterLayout(
	displayMode: EncounterDisplayMode,
	gridColumns: number,
	monsterCount: number,
) {
	return {
		displayMode: monsterCount === 1 ? "single" as const : displayMode,
		gridColumns: Math.max(1, Math.min(gridColumns, monsterCount || 1)),
	};
}

function getOptionalParticipantId(
	participant: EncounterViewParticipant | null,
): string | undefined {
	return participant ? getParticipantInstanceId(participant) : undefined;
}

function getOptionalMonsterSource(
	participant: EncounterViewParticipant | null,
): unknown {
	return participant ? participant.source : undefined;
}

function getEditingMonster(
	editing: FieldEditingMonster | null,
): EncounterMonsterTarget | null {
	return editing ? editing.monster : null;
}

function getEncounterViewParticipants(
	view: EncounterViewModel,
): EncounterViewParticipant[] {
	return view.encounter?.monsters || EMPTY_ENCOUNTER_PARTICIPANTS;
}

function getEncounterViewPlayerCharacters(
	view: EncounterViewModel,
): CampaignEntityRecord[] {
	return view.playerCharacters || EMPTY_CAMPAIGN_ENTITIES;
}

function useEncounterHeaderDismissal(
	isOpen: boolean,
	actionsRef: RefObject<HTMLDivElement | null>,
	onClose: () => void,
) {
	useEffect(() => {
		if (!isOpen) return undefined;
		const handlePointerDown = (event: PointerEvent) => {
			if (!actionsRef.current?.contains(event.target as Node)) onClose();
		};
		document.addEventListener("pointerdown", handlePointerDown);
		return () => document.removeEventListener("pointerdown", handlePointerDown);
	}, [isOpen, onClose]);
}

function EncounterView() {
	const {
		activeCampaign: runtimeCampaign,
		activeSessionFileName: sessionId,
		currentLanguage,
		encounterGridColumns,
		encounterViewMode,
		patchUiSettings,
		refreshEntities,
		showMessage,
	} = useEncounterPageRuntime();
	const campaign = runtimeCampaign as CampaignRecord | null;
	const displayMode = getEncounterDisplayMode(encounterViewMode);
	const gridColumns = getEncounterGridColumns(encounterGridColumns);
	const [modalCharacter, setModalCharacter] =
		useState<EncounterViewParticipant | null>(null);
	const [aiActionMonster, setAiActionMonster] =
		useState<EncounterViewParticipant | null>(null);
	const [aiEditingMonster, setAiEditingMonster] =
		useState<EncounterViewParticipant | null>(null);
	const [aiEditMode, setAiEditMode] = useState<MonsterAiEditMode>("edit");
	const [aiEditInstructions, setAiEditInstructions] = useState("");
	const [aiEditError, setAiEditError] = useState("");
	const [isAiEditingMonster, setIsAiEditingMonster] = useState(false);
	const [aiModels, setAiModels] = useState<AiModelDescriptor[]>([]);
	const [selectedAiModel, setSelectedAiModel] = useState("");
	const [aiDraftResponseEntry, setAiDraftResponseEntry] =
		useState<AiHistoryEntry | null>(null);
	const [aiDraftMode, setAiDraftMode] =
		useState<EncounterDraftMode>("global");
	const [isRestoringAiResponse, setIsRestoringAiResponse] = useState(false);
	const [aiTargetInstanceId, setAiTargetInstanceId] = useState<string | null>(null);
	const [fieldEditingMonster, setFieldEditingMonster] =
		useState<FieldEditingMonster | null>(null);
	const [editActionMonster, setEditActionMonster] =
		useState<EncounterViewParticipant | null>(null);
	const aiDraftResponseRef = useRef<HTMLDivElement | null>(null);
	const aiEditControllerRef = useRef<AbortController | null>(null);
	const headerActionsRef = useRef<HTMLDivElement | null>(null);
	const [isHeaderActionsOpen, setIsHeaderActionsOpen] = useState(false);
	const view = useEncounterView();
	const encounterParticipants = getEncounterViewParticipants(view);
	const playerCharacters = getEncounterViewPlayerCharacters(view);

	const { gridMonsters, gridRepresentativeByInstanceId } = useMemo(() => {
		const projection = getEncounterGridProjection(encounterParticipants);
		return {
			gridMonsters: projection.monsters,
			gridRepresentativeByInstanceId: projection.representativeByInstanceId,
		};
	}, [encounterParticipants]);

	const selectedGridInstanceId = getSelectedGridId(
		view.selectedInstance,
		gridRepresentativeByInstanceId,
	);
	const {
		focusTimeoutRef,
		focusedMonsterId,
		focusMonsterInGrid,
		setGridItemRef,
	} = useEncounterGridFocus(gridRepresentativeByInstanceId);
	const aiDraftDiffResources = useMemo(
		() =>
			buildDiffResources(aiDraftResponseEntry, {
					added: lang.t("Added"),
					deleted: lang.t("Deleted"),
					modified: lang.t("Modified"),
			}),
		[aiDraftResponseEntry],
	);
	const displayedMonsterCount = gridMonsters.length;
	const {
		displayMode: effectiveDisplayMode,
		gridColumns: effectiveGridColumns,
	} = getEncounterLayout(displayMode, gridColumns, displayedMonsterCount);
	const availablePlayerCharacters = useMemo(
		() => getAvailableEncounterCharacters(
			encounterParticipants,
			playerCharacters,
		),
		[encounterParticipants, playerCharacters],
	);
	const playerCreation = useEncounterPlayerCreation({
		campaignSlug: campaign?.slug || "",
		onAdd: view.handleAddCharacter,
		onClosePicker: () => view.setShowCharacterPicker(false),
		refreshEntities,
		showMessage,
		messages: {
			errorTitle: lang.t("Error"),
			missingName: lang.t("Name is required to create an entry."),
			failedCreation: lang.t("Failed to create entity."),
		},
	});
	const hpEditing = useEncounterHpEditing({
	getInstanceId: getParticipantInstanceId,
	onUpdate: view.updateMonsterHp,
	});

	useEncounterRequestCleanup(focusTimeoutRef, aiEditControllerRef);
	useEncounterHeaderDismissal(isHeaderActionsOpen, headerActionsRef, () => setIsHeaderActionsOpen(false));
	useEncounterAiModelLoading({
		aiEditingMonster,
		aiModelCount: aiModels.length,
		onModels: setAiModels,
		onSelectedModel: setSelectedAiModel,
		onError: (error) => {
			console.error("Failed to load AI models", error);
			setAiEditError(error instanceof Error ? error.message : lang.t("Failed to connect to AI."));
		},
	});

	const renderContext = getEncounterRenderContext(view, campaign, sessionId);
	if (!renderContext) return <EncounterLoading />;
	const { campaign: activeCampaign, sessionId: activeSessionId, encounter } = renderContext;

	const handleSelectMonster = (monster: EncounterViewParticipant) => {
		executeEncounterParticipantSelection(
			getEncounterParticipantSelectionPlan(
				monster,
				view.selectedInstance?.instanceId,
				effectiveDisplayMode,
			),
			{
				onOpenCharacter: setModalCharacter,
				onSelect: view.setSelectedInstance,
				onFocus: focusMonsterInGrid,
			},
		);
	};

	const handleMonsterAiAction = (monster: EncounterViewParticipant) => {
		if (!monster?.name) return;
		setAiTargetInstanceId(monster.instanceId || null);
		setAiActionMonster(monster);
	};

	const handleMonsterTokenImageChange = (
		monster: EncounterViewParticipant,
		imageUrl: string | null,
	) => {
		if (!monster?.instanceId) return;
		view.updateMonsterImage(monster.instanceId, imageUrl);
	};

	const openEditMonsterAction = (monster: EncounterViewParticipant) => {
		if (!monster?.instanceId || isEncounterCharacterParticipant(monster))
			return;
		setEditActionMonster(monster);
	};

	const closeEditMonsterAction = () => {
		setEditActionMonster(null);
	};

	const chooseEditMonsterAction = (action: MonsterAiAction) => {
		const plan = getMonsterFieldEditPlan(action, editActionMonster, lang.t("Creature"));
		if (plan.kind === "none") return;
		setEditActionMonster(null);
		setFieldEditingMonster({
			mode: plan.mode,
			original: plan.original as EncounterViewParticipant,
			monster: plan.monster,
		});
	};

	const closeEditMonsterFields = () => {
		setFieldEditingMonster(null);
	};

	const saveEditedMonsterFields = async (draftMonster: BestiaryMonster) => {
		if (!fieldEditingMonster) return;
		const plan = getMonsterFieldSavePlan(
			fieldEditingMonster.mode,
			fieldEditingMonster.original,
			draftMonster,
		);
		await executeMonsterFieldSavePlan(
			plan,
			api,
			lang.t("Custom creature with this name already exists."),
			{
				onLocal: (instanceId, monster) => view.updateMonsterFromAi(
					instanceId,
					monster as EncounterViewParticipant,
					{ localOverride: true, preserveCurrentHp: false },
				),
				onPersistent: (instanceId, monster) => view.updateMonsterFromAi(
					instanceId,
					monster as EncounterViewParticipant,
					{ preserveCurrentHp: false },
				),
				onRefresh: refreshEntities,
				onClose: closeEditMonsterFields,
				onError: (error) => showMessage({
					title: lang.t("Error"),
					message: error instanceof Error ? error.message : lang.t("Unknown error"),
				}),
			},
		);
	};

	const closeMonsterAiAction = () => {
		if (isAiEditingMonster) return;
		setAiActionMonster(null);
	};

	const chooseMonsterAiAction = (action: MonsterAiAction) => {
		if (action === "image-prompt") return;
		const mode = action;
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
		const plan = getMonsterAiGenerationPlan(
			aiEditMode,
			aiEditInstructions,
			aiEditingMonster,
			lang.t,
		);
		if (plan.validationError) {
			setAiEditError(plan.validationError);
			return;
		}

		setIsAiEditingMonster(true);
		setAiEditError("");
		const controller = new AbortController();
		aiEditControllerRef.current = controller;
		await executeMonsterAiRequest(controller, {
			request: (signal) => api.generateAi(
				buildMonsterAiRequestPayload({
					plan,
					modelName: selectedAiModel,
					campaignSlug: activeCampaign.slug,
					sessionId: activeSessionId,
					encounterId: encounter.id,
					monster: aiEditingMonster,
					targetInstanceId: aiTargetInstanceId,
					language: currentLanguage,
				}),
				{ signal },
			),
			onResult: (data) => {
				applyEncounterGeneratedMonsterResult(data, aiEditingMonster, plan.draftMode, aiTargetInstanceId, {
					onDraftMode: setAiDraftMode,
					onDraftEntry: setAiDraftResponseEntry,
					onMonsterUpdate: view.updateMonsterFromAi,
				});
				setAiEditingMonster(null);
				setAiEditMode("edit");
				setAiEditInstructions("");
			},
			onError: setAiEditError,
			onComplete: () => {
				if (aiEditControllerRef.current === controller) aiEditControllerRef.current = null;
				setIsAiEditingMonster(false);
			},
		});
	};

	const saveAiDraftResponseChanges = async (
		resources: Array<Pick<AiHistoryResource, "id" | "after">>,
	) => {
		const plan = getMonsterAiDraftSavePlan(
			aiDraftResponseEntry?.id,
			aiDraftMode,
			activeCampaign.slug,
			resources,
		);
		if (!plan) return null;
		const updatedEntry = await api.updateAiResponse(
			plan.scope,
			plan.entryId,
			{ resources: plan.resources },
		);
		return applyMonsterAiDraftSaveResult(plan, updatedEntry, setAiDraftResponseEntry);
	};

	const restoreAiDraftResponse = async (
		entry: AiHistoryEntry | null = aiDraftResponseEntry,
		mode: RestoreMode = "apply",
		options: RestoreOptions = {},
	) => {
		const plan = getMonsterAiRestoreRequestPlan(
			entry?.id,
			isRestoringAiResponse,
			aiDraftMode,
			activeCampaign.slug,
			mode,
			options.resourceIds,
		);
		if (!plan || !entry) return;
		setIsRestoringAiResponse(true);
		const restore = {
			apply: api.applyAiResponse,
			undo: api.undoAiResponse,
		}[plan.action];
		await executeEncounterAiRestoreRequest({
			request: () => restore(plan.scope, plan.entryId, { resourceIds: plan.resourceIds }),
			onResult: (result) => applyEncounterMonsterRestoreResult(
				result,
				entry,
				aiDraftMode,
				plan.action,
				plan.resourceIds,
				aiTargetInstanceId,
				{
					onEntry: setAiDraftResponseEntry,
					onLocalUpdate: view.handleAiUpdate,
					onMonsterUpdate: view.updateMonsterFromAi,
				},
			),
			onError: (error) => showMessage({
					title: lang.t("AI history error"),
					message: error instanceof Error ? error.message : lang.t("Unknown error"),
			}),
			onComplete: () => setIsRestoringAiResponse(false),
		});
	};

	const closeAiDraftResponse = () => {
		if (isRestoringAiResponse) return;
		setAiDraftResponseEntry(null);
		setAiDraftMode("global");
	};


	const handleCharacterChange =
		(instanceId: string) => (
			_characterId: string | number | undefined,
			nextCharacter: CharacterData,
		) => {
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

	const updateEncounterViewMode = (mode: EncounterDisplayMode) => {
		const nextMode = mode === "grid" ? "grid" : "single";
		patchUiSettings({ encounterViewMode: nextMode });
		api.updateSettings({ encounterViewMode: nextMode }).catch((error) => {
			console.error("Failed to save encounter view mode setting", error);
		});
	};

	const updateEncounterGridColumns = (columns: number) => {
		const nextColumns = Math.min(4, Math.max(1, Number(columns) || 2));
		patchUiSettings({ encounterGridColumns: nextColumns });
		api.updateSettings({ encounterGridColumns: nextColumns }).catch((error) => {
			console.error("Failed to save encounter grid columns setting", error);
		});
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
	const encounterMetricsTooltip = (
		<div className="EncounterView__metricsTooltip">
			<div className="Tooltip__title">{lang.t("Combat encounters")}</div>
			<div className="EncounterView__metricsTooltipList">
				<div className="EncounterView__metricsTooltipRow">
					<span>{lang.t("Participants")}</span>
					<strong>{encounter.monsters.length}</strong>
				</div>
				{encounter.monsters.length > 0 && (
					<>
						<div className="EncounterView__metricsTooltipRow">
							<span>{lang.t("Avg initiative")}</span>
							<strong>{view.initiativeStats.average}</strong>
						</div>
						<div className="EncounterView__metricsTooltipRow">
							<span>{lang.t("Max initiative")}</span>
							<strong>{view.initiativeStats.max}</strong>
						</div>
						<div className="EncounterView__metricsTooltipRow">
							<span>{lang.t("CR-weighted avg initiative")}</span>
							<strong>{view.initiativeStats.weightedAverage}</strong>
						</div>
					</>
				)}
			</div>
		</div>
	);

	return (
		<Panel className="EncounterView">
			<EncounterHeader
				view={view}
				displayMode={effectiveDisplayMode}
				displayedMonsterCount={displayedMonsterCount}
				gridColumns={gridColumns}
				isActionsOpen={isHeaderActionsOpen}
				actionsRef={headerActionsRef}
				averageTooltip={averageInitiativeTooltip}
				maxTooltip={maxInitiativeTooltip}
				weightedTooltip={weightedInitiativeTooltip}
				metricsTooltip={encounterMetricsTooltip}
				onToggleActions={() => setIsHeaderActionsOpen((value) => !value)}
				onDisplayMode={updateEncounterViewMode}
				onGridColumns={updateEncounterGridColumns}
			/>
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
							items={encounter.monsters}
							onReorder={view.handleReorderMonsters}
							onDrop={view.handleMonstersDrop}
							keyExtractor={(m) => m.instanceId || String(m.id || m.name || "")}
							renderItem={(monster, isDragging) => (
								<EncounterMonsterRow
									monster={monster}
									isDragging={isDragging}
								hpDrafts={hpEditing.drafts}
									selectedInstanceId={getOptionalParticipantId(view.selectedInstance)}
									view={view}
									onSelect={handleSelectMonster}
								onHpChange={hpEditing.onChange}
								onHpBlur={hpEditing.onBlur}
									getParticipantInstanceId={getParticipantInstanceId}
								/>
							)}
						/>
					</div>

					<EncounterDetail
						displayMode={effectiveDisplayMode}
						gridMonsters={gridMonsters}
						gridColumns={effectiveGridColumns}
						selectedInstance={view.selectedInstance}
						selectedGridInstanceId={selectedGridInstanceId}
						focusedMonsterId={focusedMonsterId}
						campaignSlug={activeCampaign.slug}
						getParticipantInstanceId={getParticipantInstanceId}
						setGridItemRef={setGridItemRef}
						onAiAction={handleMonsterAiAction}
						onFieldEdit={openEditMonsterAction}
						onTokenImageChange={handleMonsterTokenImageChange}
						onCharacterChange={handleCharacterChange}
						getMonsterImageOverride={view.getMonsterImageOverride}
					/>
				</div>
			</div>

			<EncounterBestiaryOverlay
				open={view.showBestiary}
				onClose={() => view.setShowBestiary(false)}
				onAdd={view.handleAddMonster}
				renderBestiary={(onAdd) => (
					<Bestiary
						BestiaryAiModals={EncounterBestiaryAiModals}
						AiAssistantPanel={AiAssistantPanel}
						MonsterStatBlock={MonsterStatBlock}
						ResponseModal={EncounterAiResponseModal}
						MonsterEditorModal={EncounterMonsterEditorModal}
						onAddMonster={(monster) => onAdd(monster as EncounterViewParticipant)}
						/>
				)}
			/>

			<EncounterCharacterOverlays
				open={view.showCharacterPicker}
				creating={playerCreation.creating}
				submitting={playerCreation.submitting}
				draft={playerCreation.draft}
				available={availablePlayerCharacters}
				allCharacters={view.playerCharacters}
				modalCharacter={modalCharacter}
				campaignSlug={activeCampaign.slug}
				onClosePicker={playerCreation.closePicker}
				onDraft={playerCreation.setDraft}
				onCreate={playerCreation.submit}
				onReset={playerCreation.reset}
				onStartCreate={playerCreation.start}
				onAdd={view.handleAddCharacter}
				onCloseCharacter={() => setModalCharacter(null)}
				getModalCharacterOnChange={(character) =>
					handleCharacterChange(getParticipantInstanceId(character))
				}
			/>

			<MonsterAiActionModal
				aiActionMonster={aiActionMonster as BestiaryMonster | null}
				showLocalEdit={true}
				showGlobalEdit={isCustomSource(getOptionalMonsterSource(aiActionMonster))}
				targetLabel={lang.t("Encounter creature")}
				onCancel={closeMonsterAiAction}
				onChoose={chooseMonsterAiAction}
			/>
			<MonsterAiActionModal
				aiActionMonster={editActionMonster as BestiaryMonster | null}
				showLocalEdit={true}
				showGlobalEdit={isCustomSource(getOptionalMonsterSource(editActionMonster))}
				targetLabel={lang.t("Encounter creature")}
				title={lang.t("Edit creature")}
				actionIcon="edit"
				onCancel={closeEditMonsterAction}
				onChoose={chooseEditMonsterAction}
			/>
			<EncounterBestiaryAiModals
				ResponseModal={EncounterAiResponseModal}
				aiDraftDiffResources={aiDraftDiffResources}
				aiDraftResponseEntry={aiDraftResponseEntry}
				aiDraftResponseRef={aiDraftResponseRef}
				aiEditingMonster={aiEditingMonster as BestiaryMonster | null}
				aiEditError={aiEditError}
				aiEditInstructions={aiEditInstructions}
				aiEditMode={aiEditMode}
				aiModels={aiModels}
				getDiffResourceState={getDiffResourceState}
				getHistoryChangeSummary={getHistoryChangeSummary}
				isAiEditingMonster={isAiEditingMonster}
				isRestoringAiResponse={isRestoringAiResponse}
				onApplyDraft={(entry) => restoreAiDraftResponse(entry, "apply")}
				onApplyDraftResource={(entry, resourceIds) =>
					restoreAiDraftResponse(entry, "apply", { resourceIds })
				}
				onCancelDraft={closeAiDraftResponse}
				onCancelEdit={closeAiEditCustomMonster}
				onCancelEditRequest={cancelAiEditCustomMonsterRequest}
				onInstructionsChange={setAiEditInstructions}
				onModelChange={setSelectedAiModel}
				onSaveDraftChanges={saveAiDraftResponseChanges}
				onSaveEdit={saveAiEditedCustomMonster}
				onUndoDraft={(entry) => restoreAiDraftResponse(entry, "undo")}
				onUndoDraftResource={(entry, resourceIds) =>
					restoreAiDraftResponse(entry, "undo", { resourceIds })
				}
				selectedAiModel={selectedAiModel}
			/>
			<EncounterMonsterEditorModal
				editingMonster={getEditingMonster(fieldEditingMonster)}
				onCancel={closeEditMonsterFields}
				onSave={saveEditedMonsterFields}
				title={lang.t("Edit encounter creature")}
			/>

			<EncounterNotification
				message={view.notification}
				onClose={() => view.setNotification(null)}
			/>
		</Panel>
	);
}

function EncounterLoading() {
	return (
		<Panel className="EncounterView">
			<div className="Panel__body">{lang.t("Loading...")}</div>
		</Panel>
	);
}

function getEncounterRenderContext(
	view: EncounterViewModel,
	campaign: CampaignRecord | null,
	sessionId: string | null,
) {
	if (!view.encounter || !campaign || !sessionId) return null;
	return { encounter: view.encounter, campaign, sessionId };
}

export default EncounterView;
