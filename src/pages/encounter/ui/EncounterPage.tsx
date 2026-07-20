import {
	useEffect,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
	type ReactNode,
	type RefObject,
} from "react";
import { Button, Notification, Panel, Tooltip } from "../../../shared/ui/index.js";
import { Modal } from "../../../features/modal/index.js";
import { BestiaryBrowser as Bestiary } from "../../../widgets/bestiary-browser/index.js";
import {
	BestiaryAiModals,
	MonsterAiActionModal,
	buildMonsterAiRequestPayload,
	getFirstGeneratedMonster,
	getMonsterAiGenerationPlan,
	getMonsterAiRestoreScope,
	getMonsterFieldSavePlan,
	persistMonsterFieldSavePlan,
	type EncounterMonsterTarget,
	type MonsterAiEditMode,
	type MonsterAiAction,
} from "../../../features/ai-edit-monster/index.js";
import { AiResponseModal } from "../../../widgets/ai-response-modal/index.js";
import { MonsterEditorModal } from "../../../widgets/monster-editor-modal/index.js";
import { MonsterStatBlock } from "../../../widgets/monster-stat-block/index.js";
import { CharacterCard } from "../../../widgets/campaign-entity-card/index.js";
import { DraggableList } from "../../../shared/ui/index.js";
import useEncounterView from "../model/useEncounterView.ts";
import { classNames } from "../../../shared/lib/index.js";
import "../../../assets/components/EncounterView.css";
import { campaignApi } from "../../../entities/campaign/index.js";
import {
	bestiaryApi,
	type BestiaryMonster,
} from "../../../entities/bestiary/index.js";
import { aiApi } from "../../../features/ai/index.js";
import { settingsApi } from "../../../features/settings/index.js";
import { createCampaignEntity } from "../../../features/campaign-entity/index.js";

const api = { ...campaignApi, ...bestiaryApi, ...aiApi, ...settingsApi };
import {
	alert,
	refreshEntitiesAction,
	setUiSettingsAction,
} from "../../../shared/model/index.js";
import { lang } from "../../../shared/lib/index.js";
import { useAppDispatch, useAppSelector } from "../../../shared/model/index.js";
import { renderMentionText } from "../../../features/rich-content/index.js";
import {
	getEncounterCharacterDisplayName,
	hasMonsterHpFormula,
	isEncounterCharacterParticipant,
} from "../../../entities/encounter/index.js";
import {
	buildDiffResources,
	type AiHistoryEntry,
	type AiHistoryResource,
	type AiGenerationResult,
	type AiHistoryRestoreResult,
	type AiModelDescriptor,
} from "../../../features/ai/index.js";
import {
	addSourceMonsterImageToDraft,
	getFirstChangedMonster,
	getHistoryChangeSummary as getAiHistoryChangeSummary,
	getLocalizedDiffResourceState,
} from "../../../features/ai/index.js";
import { loadAiModelOptions } from "../../../features/ai/index.js";
import {
	createEmptyEncounterCharacterDraft as createEmptyCharacterDraft,
	getEncounterGridMonsterKey as getGridMonsterKey,
	getEncounterMonsterRowStats,
	isCustomBestiarySource as isCustomSource,
	resolveEncounterHpInputValue as resolveHpInputValue,
} from "../model/encounterPagePresentation.ts";
import type {
	EncounterViewModel,
	EncounterViewParticipant,
	EncounterViewSession,
} from "../model/contracts.ts";
import type {
	CampaignEntityRecord,
	CampaignRecord,
	CharacterData,
} from "../../../entities/campaign/index.js";

type EncounterDraftMode = "local" | "global";
type EncounterDisplayMode = "grid" | "single";
type FieldEditingMonster = {
	mode: MonsterAiEditMode;
	original: EncounterViewParticipant;
	monster: EncounterMonsterTarget;
};
type PlayerDraft = CharacterData & { firstName: string };
type RestoreMode = "apply" | "undo";
type RestoreOptions = { resourceIds?: string[] };

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

function applyGeneratedMonsterResult({
	data,
	sourceMonster,
	draftMode,
	targetInstanceId,
	onDraftMode,
	onDraftEntry,
	onMonsterUpdate,
}: {
	data: AiGenerationResult | null;
	sourceMonster: EncounterViewParticipant;
	draftMode: EncounterDraftMode;
	targetInstanceId: string | null;
	onDraftMode: (mode: EncounterDraftMode) => void;
	onDraftEntry: (entry: AiHistoryEntry | null) => void;
	onMonsterUpdate: (instanceId: string, monster: EncounterViewParticipant) => void;
}) {
	if (data?.draft && data.aiResponse) {
		onDraftMode(draftMode);
		onDraftEntry(addSourceMonsterImageToDraft(data.aiResponse, sourceMonster) || null);
		return;
	}
	if (!targetInstanceId) return;
	const monster = getFirstGeneratedMonster(data?.updated);
	if (monster) onMonsterUpdate(targetInstanceId, monster as EncounterViewParticipant);
}

function applyMonsterRestoreResult({
	result,
	fallbackEntry,
	draftMode,
	mode,
	resourceIds,
	targetInstanceId,
	onEntry,
	onLocalUpdate,
	onMonsterUpdate,
}: {
	result: AiHistoryRestoreResult | null;
	fallbackEntry: AiHistoryEntry;
	draftMode: EncounterDraftMode;
	mode: RestoreMode;
	resourceIds?: string[];
	targetInstanceId: string | null;
	onEntry: (entry: AiHistoryEntry) => void;
	onLocalUpdate: (session: EncounterViewSession) => void;
	onMonsterUpdate: (instanceId: string, monster: EncounterViewParticipant) => void;
}) {
	const entry = result?.response || fallbackEntry;
	onEntry(entry);
	if (draftMode === "local") {
		if (result?.updated) onLocalUpdate(result.updated as EncounterViewSession);
		return;
	}
	if (mode === "undo" || !targetInstanceId) return;
	const monster = getFirstChangedMonster(entry, resourceIds);
	if (monster) onMonsterUpdate(targetInstanceId, monster as EncounterViewParticipant);
}

function getAiEditFailureMessage(error: unknown): string | null {
	if (error instanceof Error) {
		return error.name === "AbortError" ? null : error.message;
	}
	return lang.t("Unknown error");
}

interface EncounterMonsterRowProps {
	monster: EncounterViewParticipant;
	isDragging: boolean;
	hpDrafts: Record<string, string>;
	selectedInstanceId?: string;
	view: Pick<
		EncounterViewModel,
		| "getHpColor"
		| "updateMonsterMaxHp"
		| "rollMonsterHp"
		| "duplicateMonster"
		| "removeMonster"
	>;
	onSelect: (monster: EncounterViewParticipant) => void;
	onHpChange: (instanceId: string, value: string) => void;
	onHpBlur: (monster: EncounterViewParticipant) => void;
}

function EncounterMonsterCombatStats({
	monster,
	instanceId,
	hpDrafts,
	view,
	onHpChange,
	onHpBlur,
}: Omit<EncounterMonsterRowProps, "isDragging" | "selectedInstanceId" | "onSelect"> & {
	instanceId: string;
}) {
	const rowStats = getEncounterMonsterRowStats(monster);
	return (
		<>
			<div className="EncounterMonsterRow__hp">
				<input
					type="text"
					value={hpDrafts[instanceId] ?? String(monster.currentHp ?? "")}
					onChange={(event) => onHpChange(instanceId, event.target.value)}
					onBlur={() => onHpBlur(monster)}
					onKeyDown={(event) => {
						if (event.key === "Enter") event.currentTarget.blur();
					}}
					onFocus={(event) => event.currentTarget.select()}
					onClick={(event) => {
						event.stopPropagation();
						event.currentTarget.select();
					}}
					className="EncounterMonsterRow__hpInput"
					style={{
						color: view.getHpColor(
							Number(monster.currentHp) || 0,
							Number(rowStats.maxHp) || 0,
						),
					}}
				/>
				<span className="muted">/</span>
				<Tooltip content={lang.t("Max HP")}>
					<input
						type="number"
						value={rowStats.maxHp}
						onChange={(event) =>
							view.updateMonsterMaxHp(instanceId, event.target.value)
						}
						onClick={(event) => event.stopPropagation()}
						className="EncounterMonsterRow__maxHpInput"
					/>
				</Tooltip>
			</div>
			<div className="EncounterMonsterRow__ac">
				{lang.t("AC")} {rowStats.ac}
			</div>
		</>
	);
}

function EncounterMonsterRowActions({
	monster,
	instanceId,
	isCharacter,
	view,
}: {
	monster: EncounterViewParticipant;
	instanceId: string;
	isCharacter: boolean;
	view: EncounterMonsterRowProps["view"];
}) {
	return (
		<div className="EncounterMonsterRow__actions">
			{!isCharacter && hasMonsterHpFormula(monster) && (
				<Button
					variant="ghost"
					size={Button.SIZES.SMALL}
					icon="dice"
					className="EncounterMonsterRow__action"
					onClick={(event) => {
						event.stopPropagation();
						view.rollMonsterHp(instanceId);
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
					onClick={(event) => {
						event.stopPropagation();
						view.duplicateMonster(monster);
					}}
					title={lang.t("Duplicate")}
				/>
			)}
			<Button
				variant="danger"
				size={Button.SIZES.SMALL}
				icon="x"
				className="EncounterMonsterRow__action"
				onClick={(event) => {
					event.stopPropagation();
					view.removeMonster(instanceId);
				}}
				title={lang.t("Delete")}
			/>
		</div>
	);
}

function EncounterMonsterRow({
	monster,
	isDragging,
	hpDrafts,
	selectedInstanceId,
	view,
	onSelect,
	onHpChange,
	onHpBlur,
}: EncounterMonsterRowProps) {
	const instanceId = getParticipantInstanceId(monster);
	const isCharacter = isEncounterCharacterParticipant(monster);
	const displayName = isCharacter
		? getEncounterCharacterDisplayName(monster)
		: String(monster.name);

	return (
		<div
			className={classNames("EncounterMonsterRow", {
				EncounterMonsterRow__character: isCharacter,
				is_active: selectedInstanceId === instanceId,
				is_dragging: isDragging,
			})}
			onClick={() => onSelect(monster)}
		>
			<div className="EncounterMonsterRow__content">
				<div className="EncounterMonsterRow__name">
					{renderMentionText(displayName)}
				</div>
				<div className="EncounterMonsterRow__stats">
					{isCharacter ? (
						<div className="EncounterMonsterRow__playerBadge">{lang.t("Player")}</div>
					) : (
						<EncounterMonsterCombatStats
							monster={monster}
							instanceId={instanceId}
							hpDrafts={hpDrafts}
							view={view}
							onHpChange={onHpChange}
							onHpBlur={onHpBlur}
						/>
					)}
					<EncounterMonsterRowActions
						monster={monster}
						instanceId={instanceId}
						isCharacter={isCharacter}
						view={view}
					/>
				</div>
			</div>
		</div>
	);
}

interface EncounterDetailProps {
	displayMode: EncounterDisplayMode;
	gridMonsters: EncounterViewParticipant[];
	gridColumns: number;
	selectedInstance: EncounterViewParticipant | null;
	selectedGridInstanceId: string | null;
	focusedMonsterId: string | null;
	campaignSlug: string;
	setGridItemRef: (instanceId: string, node: HTMLDivElement | null) => void;
	onAiAction: (monster: EncounterViewParticipant) => void;
	onFieldEdit: (monster: EncounterViewParticipant) => void;
	onTokenImageChange: (
		monster: EncounterViewParticipant,
		imageUrl: string | null,
	) => void;
	onCharacterChange: (
		instanceId: string,
	) => (
		id: string | number | undefined,
		character: CharacterData,
	) => void;
	getMonsterImageOverride: EncounterViewModel["getMonsterImageOverride"];
}

function EncounterDetail({
	displayMode,
	gridMonsters,
	gridColumns,
	selectedInstance,
	selectedGridInstanceId,
	focusedMonsterId,
	campaignSlug,
	setGridItemRef,
	onAiAction,
	onFieldEdit,
	onTokenImageChange,
	onCharacterChange,
	getMonsterImageOverride,
}: EncounterDetailProps) {
	if (displayMode === "grid") {
		return (
			<div className="EncounterView__detailView EncounterView__detailView__grid">
				{gridMonsters.length > 0 ? (
					<div
						className="EncounterView__grid"
						style={
							{ "--encounter-grid-columns": gridColumns } as CSSProperties
						}
					>
						{gridMonsters.map((monster) => {
							const instanceId = getParticipantInstanceId(monster);
							return (
								<div
									key={instanceId}
									ref={(node) => setGridItemRef(instanceId, node)}
									className={classNames("EncounterView__gridItem", {
										is_selected: selectedGridInstanceId === instanceId,
										is_focused: focusedMonsterId === instanceId,
									})}
								>
									<MonsterStatBlock
										monster={monster as BestiaryMonster}
										onAiAction={(value) => onAiAction(value as EncounterViewParticipant)}
										onFieldEdit={(value) => onFieldEdit(value as EncounterViewParticipant)}
										onTokenImageChange={(value, imageUrl) =>
											onTokenImageChange(value as EncounterViewParticipant, imageUrl)
										}
										tokenUploadCampaignSlug={campaignSlug}
										tokenImageOverrideUrl={getMonsterImageOverride(monster)}
										layoutMode="grid"
									/>
								</div>
							);
						})}
					</div>
				) : (
					<p className="muted">{lang.t("Select a monster from the list to see its stats.")}</p>
				)}
			</div>
		);
	}

	return (
		<div className="EncounterView__detailView EncounterView__detailView__single">
			{selectedInstance ? (
				isEncounterCharacterParticipant(selectedInstance) ? (
					<CharacterCard
						character={selectedInstance}
						campaignSlug={campaignSlug}
						type="characters"
						viewMode="modal"
						showDeleteButton={false}
						onChange={onCharacterChange(getParticipantInstanceId(selectedInstance))}
					/>
				) : (
					<MonsterStatBlock
						monster={selectedInstance as BestiaryMonster}
						onAiAction={(value) => onAiAction(value as EncounterViewParticipant)}
						onFieldEdit={(value) => onFieldEdit(value as EncounterViewParticipant)}
						onTokenImageChange={(value, imageUrl) =>
							onTokenImageChange(value as EncounterViewParticipant, imageUrl)
						}
						tokenUploadCampaignSlug={campaignSlug}
						tokenImageOverrideUrl={getMonsterImageOverride(selectedInstance)}
					/>
				)
			) : (
				<p className="muted">{lang.t("Select a monster from the list to see its stats.")}</p>
			)}
		</div>
	);
}

interface EncounterHeaderProps {
	view: EncounterViewModel;
	displayMode: EncounterDisplayMode;
	displayedMonsterCount: number;
	gridColumns: number;
	isActionsOpen: boolean;
	actionsRef: RefObject<HTMLDivElement | null>;
	averageTooltip: ReactNode;
	maxTooltip: ReactNode;
	weightedTooltip: ReactNode;
	metricsTooltip: ReactNode;
	onToggleActions: () => void;
	onDisplayMode: (mode: EncounterDisplayMode) => void;
	onGridColumns: (columns: number) => void;
}

function EncounterMetrics({
	view,
	averageTooltip,
	maxTooltip,
	weightedTooltip,
}: Pick<
	EncounterHeaderProps,
	"view" | "averageTooltip" | "maxTooltip" | "weightedTooltip"
>) {
	const participantCount = view.encounter?.monsters.length || 0;
	const metrics: Array<[ReactNode, ReactNode, ReactNode, string]> = [
		[lang.t("Avg initiative"), view.initiativeStats.average, averageTooltip, ""],
		[lang.t("Max initiative"), view.initiativeStats.max, maxTooltip, ""],
		[
			lang.t("CR-weighted avg initiative"),
			view.initiativeStats.weightedAverage,
			weightedTooltip,
			" EncounterViewMetric__accent",
		],
	];
	return (
		<div className="EncounterView__metrics">
			<div className="EncounterViewMetric">
				<span className="EncounterViewMetric__label">{lang.t("Participants")}</span>
				<span className="EncounterViewMetric__value">{participantCount}</span>
			</div>
			{participantCount > 0 &&
				metrics.map(([label, value, content, modifier]) => (
					<div className={`EncounterViewMetric${modifier}`} key={String(label)}>
						<Tooltip content={content} className="EncounterViewMetric__tooltip">
							<span className="EncounterViewMetric__label">{label}</span>
							<span className="EncounterViewMetric__value">{value}</span>
						</Tooltip>
					</div>
				))}
		</div>
	);
}

function EncounterHeader({
	view,
	displayMode,
	displayedMonsterCount,
	gridColumns,
	isActionsOpen,
	actionsRef,
	averageTooltip,
	maxTooltip,
	weightedTooltip,
	metricsTooltip,
	onToggleActions,
	onDisplayMode,
	onGridColumns,
}: EncounterHeaderProps) {
	return (
		<div className="Panel__header">
			<div className="EncounterView__header">
				<Button variant="ghost" size={Button.SIZES.SMALL} onClick={view.handleBack} icon="back" className="SessionView__backBtn" />
				<Tooltip content={lang.t("Click to rename")}>
					<h2 className="editable_title" onClick={view.handleRename}>
						{renderMentionText(view.encounter?.name || "")}
					</h2>
				</Tooltip>
				<EncounterMetrics
					view={view}
					averageTooltip={averageTooltip}
					maxTooltip={maxTooltip}
					weightedTooltip={weightedTooltip}
				/>
			</div>
			<div ref={actionsRef as RefObject<HTMLDivElement>} className={classNames("EncounterView__headerActions", { is_open: isActionsOpen })}>
				<Tooltip content={metricsTooltip} className="EncounterView__metricsTooltipTrigger">
					<Button variant="ghost" size={Button.SIZES.SMALL} icon="swords" aria-label={lang.t("Combat encounters")}>{view.encounter?.monsters.length || 0}</Button>
				</Tooltip>
				<Button variant="ghost" size={Button.SIZES.SMALL} icon="menu" className="EncounterView__headerActionsToggle" onClick={onToggleActions} title={lang.t("Encounter actions")} />
				<div className="EncounterView__headerActionsMenu">
					<div className="EncounterView__viewModeSwitch">
						<Button variant={displayMode === "single" ? "primary" : "ghost"} size={Button.SIZES.SMALL} icon="list" onClick={() => onDisplayMode("single")} title={lang.t("Preview")} />
						<Button variant={displayMode === "grid" ? "primary" : "ghost"} size={Button.SIZES.SMALL} icon="layers" onClick={() => onDisplayMode("grid")} disabled={displayedMonsterCount === 1} title={lang.t("All")} />
					</div>
					{displayMode === "grid" && (
						<div className="EncounterView__gridColumnsSwitch" aria-label={lang.t("Grid columns")}>
							{[1, 2, 3, 4].map((columns) => (
								<Button key={columns} variant={gridColumns === columns ? "primary" : "ghost"} size={Button.SIZES.SMALL} onClick={() => onGridColumns(columns)} title={lang.t("{count} columns", { count: columns })}>{columns}</Button>
							))}
						</div>
					)}
					<Button variant="ghost" size={Button.SIZES.SMALL} icon="undo" onClick={view.handleUndo} disabled={view.undoStack.length === 0 || view.isSaving} title={lang.t("Undo (Ctrl+Z)")} />
					<Button variant="ghost" size={Button.SIZES.SMALL} icon="redo" onClick={view.handleRedo} disabled={view.redoStack.length === 0 || view.isSaving} title={lang.t("Redo (Ctrl+Y)")} />
					<input type="file" ref={view.fileInputRef as RefObject<HTMLInputElement>} style={{ display: "none" }} accept=".json" onChange={view.handleFileChange} />
					<Button variant="ghost" size={Button.SIZES.SMALL} icon="import" onClick={() => view.fileInputRef.current?.click()} title={lang.t("Import encounter")} />
					<Button variant="ghost" size={Button.SIZES.SMALL} icon="export" onClick={view.handleExport} title={lang.t("Export encounter")} />
				</div>
			</div>
		</div>
	);
}

function EncounterBestiaryOverlay({
	open,
	onClose,
	onAdd,
}: {
	open: boolean;
	onClose: () => void;
	onAdd: EncounterViewModel["handleAddMonster"];
}) {
	if (!open) return null;
	return (
		<Modal onConfirm={() => {}} title={lang.t("Choose monster")} onCancel={onClose} showFooter={false} type="custom">
			<Bestiary onAddMonster={(monster) => onAdd(monster as EncounterViewParticipant)} />
		</Modal>
	);
}

interface EncounterCharacterOverlaysProps {
	open: boolean;
	creating: boolean;
	submitting: boolean;
	draft: PlayerDraft;
	available: CampaignEntityRecord[];
	allCharacters: CampaignEntityRecord[];
	modalCharacter: EncounterViewParticipant | null;
	campaignSlug: string;
	onClosePicker: () => void;
	onDraft: (draft: PlayerDraft) => void;
	onCreate: () => void;
	onReset: () => void;
	onStartCreate: () => void;
	onAdd: (character: CampaignEntityRecord) => void;
	onCloseCharacter: () => void;
	onCharacterChange: EncounterDetailProps["onCharacterChange"];
}

function EncounterCharacterOverlays(props: EncounterCharacterOverlaysProps) {
	const {
		open,
		creating,
		submitting,
		draft,
		available,
		allCharacters,
		modalCharacter,
		campaignSlug,
		onClosePicker,
		onDraft,
		onCreate,
		onReset,
		onStartCreate,
		onAdd,
		onCloseCharacter,
		onCharacterChange,
	} = props;
	return (
		<>
			{open && (
				<Modal onConfirm={() => {}} title={creating ? lang.t("New character") : lang.t("Choose player")} onCancel={onClosePicker} showFooter={false} type="custom">
					<div className="EncounterCharacterPicker">
						{creating ? (
							<div className="EncounterCharacterPicker__create">
								<CharacterCard character={draft} onChange={(_id, updated) => onDraft(updated as PlayerDraft)} onDelete={() => {}} onToggleCollapse={null} campaignSlug={campaignSlug} type="characters" viewMode="modal" showDeleteButton={false} showHeader={false} />
								<div className="EncounterCharacterPicker__createActions">
									<Button variant="primary" onClick={onCreate} disabled={submitting || !draft.firstName.trim()}>{lang.t("Create")}</Button>
									<Button variant="ghost" onClick={onReset} disabled={submitting}>{lang.t("Back")}</Button>
								</div>
							</div>
						) : (
							<>
								<Button variant="create" icon="plus" onClick={onStartCreate} className="EncounterCharacterPicker__createBtn">{lang.t("New character")}</Button>
								{available.length > 0 ? available.map((character) => (
									<button type="button" key={String(character.id || character.slug)} className="EncounterCharacterPicker__item" onClick={() => onAdd(character)}>
										<span className="EncounterCharacterPicker__name">{getEncounterCharacterDisplayName(character)}</span>
										<span className="EncounterCharacterPicker__meta">
											{[character.race, character.class].filter(Boolean).join(" • ")}
											{character.level ? ` • ${lang.t("Lvl. {level}", { level: character.level })}` : ""}
										</span>
									</button>
								)) : (
									<p className="muted">{allCharacters.length > 0 ? lang.t("All player characters are already in encounter.") : lang.t("No player characters found.")}</p>
								)}
							</>
						)}
					</div>
				</Modal>
			)}
			{modalCharacter && (
				<Modal onConfirm={() => {}} title={getEncounterCharacterDisplayName(modalCharacter)} onCancel={onCloseCharacter} showFooter={false} type="custom">
					<CharacterCard character={modalCharacter} campaignSlug={campaignSlug} type="characters" viewMode="modal" showDeleteButton={false} onChange={onCharacterChange(getParticipantInstanceId(modalCharacter))} />
				</Modal>
			)}
		</>
	);
}

function EncounterNotification({
	message,
	onClose,
}: {
	message: string | null;
	onClose: () => void;
}) {
	return message ? <Notification message={message} onClose={onClose} /> : null;
}


function EncounterView() {
	const campaign = useAppSelector(
		(state) => state.active.campaign as CampaignRecord | null,
	);
	const sessionId = useAppSelector(
		(state) => state.navigation.activeSessionFileName,
	);
	const currentLanguage = useAppSelector(
		(state) => state.localization.language,
	);
	const dispatch = useAppDispatch();
	const displayMode = useAppSelector((state) =>
		getEncounterDisplayMode(state.ui.encounterViewMode),
	);
	const gridColumns = useAppSelector((state) =>
		getEncounterGridColumns(state.ui.encounterGridColumns),
	);
	const [focusedMonsterId, setFocusedMonsterId] = useState<string | null>(null);
	const [modalCharacter, setModalCharacter] =
		useState<EncounterViewParticipant | null>(null);
	const [isCreatingPlayer, setIsCreatingPlayer] = useState(false);
	const [playerDraft, setPlayerDraft] = useState<PlayerDraft>(() =>
		createEmptyCharacterDraft() as PlayerDraft,
	);
	const [isPlayerSubmitting, setIsPlayerSubmitting] = useState(false);
	const [hpDrafts, setHpDrafts] = useState<Record<string, string>>({});
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
	const gridItemRefs = useRef(new Map<string, HTMLDivElement>());
	const focusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const headerActionsRef = useRef<HTMLDivElement | null>(null);
	const [isHeaderActionsOpen, setIsHeaderActionsOpen] = useState(false);
	const view = useEncounterView();

	const { gridMonsters, gridRepresentativeByInstanceId } = useMemo(() => {
		const uniqueMonsters: EncounterViewParticipant[] = [];
		const representativeByKey = new Map<string, string>();
		const representativeByInstanceId = new Map<string, string>();

		(view.encounter?.monsters || [])
			.filter((monster) => !isEncounterCharacterParticipant(monster))
			.forEach((monster) => {
				const key = getGridMonsterKey(monster);
				const instanceId = getParticipantInstanceId(monster);
				let representativeId = representativeByKey.get(key);

				if (!representativeId) {
					representativeId = instanceId;
					representativeByKey.set(key, representativeId);
					uniqueMonsters.push(monster);
				}

				representativeByInstanceId.set(instanceId, representativeId);
			});

		return {
			gridMonsters: uniqueMonsters,
			gridRepresentativeByInstanceId: representativeByInstanceId,
		};
	}, [view.encounter?.monsters]);

	const selectedGridInstanceId = getSelectedGridId(
		view.selectedInstance,
		gridRepresentativeByInstanceId,
	);
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

		const handlePointerDown = (event: PointerEvent) => {
			if (headerActionsRef.current?.contains(event.target as Node)) return;
			setIsHeaderActionsOpen(false);
		};

		document.addEventListener("pointerdown", handlePointerDown);
		return () => {
			document.removeEventListener("pointerdown", handlePointerDown);
		};
	}, [isHeaderActionsOpen]);

	useEffect(() => {
		if (!aiEditingMonster || aiModels.length > 0) return;
		loadAiModelOptions({
			setAiModels,
			setSelectedAiModel,
			onError: (error) => {
				console.error("Failed to load AI models", error);
				setAiEditError(
					error instanceof Error
						? error.message
						: lang.t("Failed to connect to AI."),
				);
			},
		});
	}, [aiEditingMonster, aiModels.length]);

	if (!view.encounter || !campaign || !sessionId) {
		return (
			<Panel className="EncounterView">
				<div className="Panel__body">{lang.t("Loading...")}</div>
			</Panel>
		);
	}

	const setGridItemRef = (instanceId: string, node: HTMLDivElement | null) => {
		if (node) {
			gridItemRefs.current.set(instanceId, node);
		} else {
			gridItemRefs.current.delete(instanceId);
		}
	};

	const focusMonsterInGrid = (instanceId: string) => {
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

	const handleSelectMonster = (monster: EncounterViewParticipant) => {
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
			focusMonsterInGrid(getParticipantInstanceId(monster));
		}
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
		if (action === "image-prompt") return;
		const mode = action;
		if (!editActionMonster) return;
		const target = editActionMonster;
		setEditActionMonster(null);
		const baseMonster =
			mode === "create-based"
				? {
						...target,
						name: target.name || lang.t("Creature"),
						source: "CUSTOM",
					}
				: target;
		setFieldEditingMonster({ mode, original: target, monster: baseMonster });
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
		if (plan.kind === "invalid") return;
		if (plan.kind === "local") {
			view.updateMonsterFromAi(plan.instanceId, plan.monster, {
				localOverride: true,
				preserveCurrentHp: false,
			});
			closeEditMonsterFields();
			return;
		}

		try {
			const updatedMonster = await persistMonsterFieldSavePlan(
				plan,
				api,
				lang.t("Custom creature with this name already exists."),
			);
			dispatch(refreshEntitiesAction());
			view.updateMonsterFromAi(plan.instanceId, updatedMonster as EncounterViewParticipant, {
				preserveCurrentHp: false,
			});
			closeEditMonsterFields();
		} catch (error) {
			dispatch(
				alert({
					title: lang.t("Error"),
					message: error instanceof Error ? error.message : lang.t("Unknown error"),
				}),
			);
		}
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
		try {
			const data = await api.generateAi(
				buildMonsterAiRequestPayload({
					plan,
					modelName: selectedAiModel,
					campaignSlug: campaign.slug,
					sessionId,
					encounterId: view.encounter?.id,
					monster: aiEditingMonster,
					targetInstanceId: aiTargetInstanceId,
					language: currentLanguage,
				}),
				{ signal: controller.signal },
			);
			applyGeneratedMonsterResult({
				data,
				sourceMonster: aiEditingMonster,
				draftMode: plan.draftMode,
				targetInstanceId: aiTargetInstanceId,
				onDraftMode: setAiDraftMode,
				onDraftEntry: setAiDraftResponseEntry,
				onMonsterUpdate: view.updateMonsterFromAi,
			});
			setAiEditingMonster(null);
			setAiEditMode("edit");
			setAiEditInstructions("");
		} catch (error) {
			const message = getAiEditFailureMessage(error);
			if (message) setAiEditError(message);
		} finally {
			if (aiEditControllerRef.current === controller) {
				aiEditControllerRef.current = null;
			}
			setIsAiEditingMonster(false);
		}
	};

	const saveAiDraftResponseChanges = async (
		resources: Array<Pick<AiHistoryResource, "id" | "after">>,
	) => {
		if (!aiDraftResponseEntry?.id) return null;
		if (aiDraftMode === "local") {
			const updatedEntry = await api.updateAiResponse(
				campaign.slug,
				aiDraftResponseEntry.id,
				{
					resources,
				},
			);
			setAiDraftResponseEntry(updatedEntry);
			return updatedEntry;
		}
		const updatedEntry = await api.updateAiResponse(
			"bestiary",
			aiDraftResponseEntry.id,
			{
				resources,
			},
		);
		if (updatedEntry) {
			setAiDraftResponseEntry(updatedEntry);
		}
		return updatedEntry;
	};

	const restoreAiDraftResponse = async (
		entry: AiHistoryEntry | null = aiDraftResponseEntry,
		mode: RestoreMode = "apply",
		options: RestoreOptions = {},
	) => {
		if (!entry?.id || isRestoringAiResponse) return;
		setIsRestoringAiResponse(true);
		try {
			const scope = getMonsterAiRestoreScope(aiDraftMode, campaign.slug);
			const restore = mode === "undo" ? api.undoAiResponse : api.applyAiResponse;
			const result = await restore(scope, entry.id, {
				resourceIds: options.resourceIds,
			});
			applyMonsterRestoreResult({
				result,
				fallbackEntry: entry,
				draftMode: aiDraftMode,
				mode,
				resourceIds: options.resourceIds,
				targetInstanceId: aiTargetInstanceId,
				onEntry: setAiDraftResponseEntry,
				onLocalUpdate: view.handleAiUpdate,
				onMonsterUpdate: view.updateMonsterFromAi,
			});
		} catch (error) {
			dispatch(
				alert({
					title: lang.t("AI history error"),
					message: error instanceof Error ? error.message : lang.t("Unknown error"),
				}),
			);
		} finally {
			setIsRestoringAiResponse(false);
		}
	};

	const closeAiDraftResponse = () => {
		if (isRestoringAiResponse) return;
		setAiDraftResponseEntry(null);
		setAiDraftMode("global");
	};

	const handleHpInputChange = (instanceId: string, value: string) => {
		setHpDrafts((current) => ({
			...current,
			[instanceId]: value,
		}));
	};

	const handleHpInputBlur = (monster: EncounterViewParticipant) => {
		const instanceId = getParticipantInstanceId(monster);
		const draftValue = hpDrafts[instanceId];
		if (draftValue === undefined) return;

		view.updateMonsterHp(
			instanceId,
			resolveHpInputValue(draftValue, monster.currentHp),
		);
		setHpDrafts((current) => {
			const next = { ...current };
			delete next[instanceId];
			return next;
		});
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
		dispatch(setUiSettingsAction({ encounterViewMode: nextMode }));
		api.updateSettings({ encounterViewMode: nextMode }).catch((error) => {
			console.error("Failed to save encounter view mode setting", error);
		});
	};

	const updateEncounterGridColumns = (columns: number) => {
		const nextColumns = Math.min(4, Math.max(1, Number(columns) || 2));
		dispatch(setUiSettingsAction({ encounterGridColumns: nextColumns }));
		api.updateSettings({ encounterGridColumns: nextColumns }).catch((error) => {
			console.error("Failed to save encounter grid columns setting", error);
		});
	};

	const resetPlayerCreateForm = () => {
		setIsCreatingPlayer(false);
		setPlayerDraft(createEmptyCharacterDraft() as PlayerDraft);
	};

	const closeCharacterPicker = () => {
		if (isPlayerSubmitting) return;
		resetPlayerCreateForm();
		view.setShowCharacterPicker(false);
	};

	const startCreatePlayer = () => {
		setPlayerDraft(createEmptyCharacterDraft() as PlayerDraft);
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

		const payload: Record<string, unknown> = {
			firstName: "",
			lastName: "",
			race: "",
			class: "",
			level: 1,
			motivation: "",
			description: "",
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
			const created = await createCampaignEntity(
				campaign.slug,
				"characters",
				payload,
			);
			dispatch(refreshEntitiesAction());
			if (!created) throw new Error("Entity creation returned no result");
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
	const encounterMetricsTooltip = (
		<div className="EncounterView__metricsTooltip">
			<div className="Tooltip__title">{lang.t("Combat encounters")}</div>
			<div className="EncounterView__metricsTooltipList">
				<div className="EncounterView__metricsTooltipRow">
					<span>{lang.t("Participants")}</span>
					<strong>{view.encounter.monsters.length}</strong>
				</div>
				{view.encounter.monsters.length > 0 && (
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
							items={view.encounter.monsters}
							onReorder={view.handleReorderMonsters}
							onDrop={view.handleMonstersDrop}
							keyExtractor={(m) => m.instanceId || String(m.id || m.name || "")}
							renderItem={(monster, isDragging) => (
								<EncounterMonsterRow
									monster={monster}
									isDragging={isDragging}
									hpDrafts={hpDrafts}
									selectedInstanceId={getOptionalParticipantId(view.selectedInstance)}
									view={view}
									onSelect={handleSelectMonster}
									onHpChange={handleHpInputChange}
									onHpBlur={handleHpInputBlur}
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
						campaignSlug={campaign.slug}
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
			/>

			<EncounterCharacterOverlays
				open={view.showCharacterPicker}
				creating={isCreatingPlayer}
				submitting={isPlayerSubmitting}
				draft={playerDraft}
				available={availablePlayerCharacters}
				allCharacters={view.playerCharacters}
				modalCharacter={modalCharacter}
				campaignSlug={campaign.slug}
				onClosePicker={closeCharacterPicker}
				onDraft={setPlayerDraft}
				onCreate={handleCreatePlayer}
				onReset={resetPlayerCreateForm}
				onStartCreate={startCreatePlayer}
				onAdd={view.handleAddCharacter}
				onCloseCharacter={() => setModalCharacter(null)}
				onCharacterChange={handleCharacterChange}
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
			<BestiaryAiModals
				ResponseModal={AiResponseModal}
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
			<MonsterEditorModal
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

export default EncounterView;
