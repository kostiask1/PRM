import {
	useEffect,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
	type ReactNode,
	type RefObject,
} from "react";
import {
	Button,
	DraggableList,
	Modal,
	Notification,
	Panel,
	Tooltip,
} from "../../../shared/ui/index.js";
import { BestiaryBrowser as Bestiary } from "../../../widgets/bestiary-browser/index.js";
import {
	BestiaryAiModals,
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
import { AiResponseModal } from "../../../widgets/ai-response-modal/index.js";
import { MonsterEditorModal } from "../../../widgets/monster-editor-modal/index.js";
import { MonsterStatBlock } from "../../../widgets/monster-stat-block/index.js";
import { CharacterCard } from "../../../widgets/campaign-entity-card/index.js";
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
import {
	buildCreateEntityPayload,
	createCampaignEntity,
} from "../../../features/campaign-entity/index.js";

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
	type AiModelDescriptor,
} from "../../../features/ai/index.js";
import {
	getHistoryChangeSummary as getAiHistoryChangeSummary,
	getLocalizedDiffResourceState,
} from "../../../features/ai/index.js";
import { loadAiModelOptions } from "../../../features/ai/index.js";
import {
	createEmptyEncounterCharacterDraft as createEmptyCharacterDraft,
	applyEncounterGeneratedMonsterResult,
	applyEncounterMonsterRestoreResult,
	executeEncounterAiRestoreRequest,
	executeEncounterParticipantSelection,
	executeEncounterPlayerCreation,
	getAvailableEncounterCharacters,
	getEncounterGridProjection,
	getEncounterParticipantSelectionPlan,
	getEncounterMonsterRowStats,
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

const ENCOUNTER_CHARACTER_DEFAULTS: Record<string, unknown> = {
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
};
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
				<EncounterCurrentHpInput {...{ monster, instanceId, hpDrafts, view, onHpChange, onHpBlur }} maxHp={rowStats.maxHp} />
				<span className="muted">/</span>
				<EncounterMaxHpInput {...{ instanceId, view }} maxHp={rowStats.maxHp} />
			</div>
			<div className="EncounterMonsterRow__ac">{lang.t("AC")} {rowStats.ac}</div>
		</>
	);
}

function EncounterCurrentHpInput({ monster, instanceId, hpDrafts, view, onHpChange, onHpBlur, maxHp }: Omit<EncounterMonsterRowProps, "isDragging" | "selectedInstanceId" | "onSelect"> & { instanceId: string; maxHp: string | number }) {
	return (
		<input
			type="text"
			value={getEncounterHpInputDisplay(hpDrafts[instanceId], monster.currentHp)}
			onChange={(event) => onHpChange(instanceId, event.target.value)}
			onBlur={() => onHpBlur(monster)}
			onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
			onFocus={(event) => event.currentTarget.select()}
			onClick={(event) => { event.stopPropagation(); event.currentTarget.select(); }}
			className="EncounterMonsterRow__hpInput"
			style={{ color: view.getHpColor(toEncounterStatNumber(monster.currentHp), toEncounterStatNumber(maxHp)) }}
		/>
	);
}

function EncounterMaxHpInput({ instanceId, view, maxHp }: { instanceId: string; view: EncounterMonsterRowProps["view"]; maxHp: string | number }) {
	return (
		<Tooltip content={lang.t("Max HP")}>
			<input type="number" value={maxHp} onChange={(event) => view.updateMonsterMaxHp(instanceId, event.target.value)} onClick={(event) => event.stopPropagation()} className="EncounterMonsterRow__maxHpInput" />
		</Tooltip>
	);
}

function getEncounterHpInputDisplay(draft: string | undefined, currentHp: unknown): string {
	return draft === undefined ? String(currentHp ?? "") : draft;
}

function toEncounterStatNumber(value: unknown): number {
	return Number(value) || 0;
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

function EncounterDetail(props: EncounterDetailProps) {
	return props.displayMode === "grid"
		? <EncounterGridDetail {...props} />
		: <EncounterSingleDetail {...props} />;
}

function EncounterGridDetail(props: EncounterDetailProps) {
	return (
		<div className="EncounterView__detailView EncounterView__detailView__grid">
			{props.gridMonsters.length > 0 ? (
				<div className="EncounterView__grid" style={{ "--encounter-grid-columns": props.gridColumns } as CSSProperties}>
					{props.gridMonsters.map((monster) => <EncounterGridMonster key={getParticipantInstanceId(monster)} monster={monster} props={props} />)}
				</div>
			) : <EncounterDetailEmptyState />}
		</div>
	);
}

function EncounterGridMonster({ monster, props }: { monster: EncounterViewParticipant; props: EncounterDetailProps }) {
	const instanceId = getParticipantInstanceId(monster);
	return (
		<div ref={(node) => props.setGridItemRef(instanceId, node)} className={classNames("EncounterView__gridItem", { is_selected: props.selectedGridInstanceId === instanceId, is_focused: props.focusedMonsterId === instanceId })}>
			<EncounterMonsterStatBlock monster={monster} props={props} layoutMode="grid" />
		</div>
	);
}

function EncounterSingleDetail(props: EncounterDetailProps) {
	return (
		<div className="EncounterView__detailView EncounterView__detailView__single">
			<EncounterSelectedDetail {...props} />
		</div>
	);
}

function EncounterSelectedDetail(props: EncounterDetailProps) {
	const selected = props.selectedInstance;
	if (!selected) return <EncounterDetailEmptyState />;
	if (isEncounterCharacterParticipant(selected)) {
		return <CharacterCard character={selected} campaignSlug={props.campaignSlug} type="characters" viewMode="modal" showDeleteButton={false} onChange={props.onCharacterChange(getParticipantInstanceId(selected))} />;
	}
	return <EncounterMonsterStatBlock monster={selected} props={props} />;
}

function EncounterMonsterStatBlock({ monster, props, layoutMode }: { monster: EncounterViewParticipant; props: EncounterDetailProps; layoutMode?: "grid" }) {
	return (
		<MonsterStatBlock
			monster={monster as BestiaryMonster}
			onAiAction={(value) => props.onAiAction(value as EncounterViewParticipant)}
			onFieldEdit={(value) => props.onFieldEdit(value as EncounterViewParticipant)}
			onTokenImageChange={(value, imageUrl) => props.onTokenImageChange(value as EncounterViewParticipant, imageUrl)}
			tokenUploadCampaignSlug={props.campaignSlug}
			tokenImageOverrideUrl={props.getMonsterImageOverride(monster)}
			layoutMode={layoutMode}
		/>
	);
}

function EncounterDetailEmptyState() {
	return <p className="muted">{lang.t("Select a monster from the list to see its stats.")}</p>;
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
			<EncounterHeaderIdentity view={view} averageTooltip={averageTooltip} maxTooltip={maxTooltip} weightedTooltip={weightedTooltip} />
			<EncounterHeaderActions {...{ view, displayMode, displayedMonsterCount, gridColumns, isActionsOpen, actionsRef, metricsTooltip, onToggleActions, onDisplayMode, onGridColumns }} />
		</div>
	);
}

function EncounterHeaderIdentity({
	view,
	averageTooltip,
	maxTooltip,
	weightedTooltip,
}: Pick<EncounterHeaderProps, "view" | "averageTooltip" | "maxTooltip" | "weightedTooltip">) {
	return (
		<div className="EncounterView__header">
			<Button variant="ghost" size={Button.SIZES.SMALL} onClick={view.handleBack} icon="back" className="SessionView__backBtn" />
			<Tooltip content={lang.t("Click to rename")}>
				<h2 className="editable_title" onClick={view.handleRename}>{renderMentionText(view.encounter?.name || "")}</h2>
			</Tooltip>
			<EncounterMetrics {...{ view, averageTooltip, maxTooltip, weightedTooltip }} />
		</div>
	);
}

function EncounterHeaderActions(props: Omit<EncounterHeaderProps, "averageTooltip" | "maxTooltip" | "weightedTooltip">) {
	const { view, displayMode, displayedMonsterCount, gridColumns, isActionsOpen, actionsRef, metricsTooltip, onToggleActions, onDisplayMode, onGridColumns } = props;
	return (
		<div ref={actionsRef as RefObject<HTMLDivElement>} className={classNames("EncounterView__headerActions", { is_open: isActionsOpen })}>
			<Tooltip content={metricsTooltip} className="EncounterView__metricsTooltipTrigger">
				<Button variant="ghost" size={Button.SIZES.SMALL} icon="swords" aria-label={lang.t("Combat encounters")}>{view.encounter?.monsters.length || 0}</Button>
			</Tooltip>
			<Button variant="ghost" size={Button.SIZES.SMALL} icon="menu" className="EncounterView__headerActionsToggle" onClick={onToggleActions} title={lang.t("Encounter actions")} />
			<div className="EncounterView__headerActionsMenu">
				<EncounterViewModeControls {...{ displayMode, displayedMonsterCount, onDisplayMode }} />
				<EncounterGridColumnControls {...{ displayMode, gridColumns, onGridColumns }} />
				<EncounterHistoryControls view={view} />
				<input type="file" ref={view.fileInputRef as RefObject<HTMLInputElement>} style={{ display: "none" }} accept=".json" onChange={view.handleFileChange} />
				<Button variant="ghost" size={Button.SIZES.SMALL} icon="import" onClick={() => view.fileInputRef.current?.click()} title={lang.t("Import encounter")} />
				<Button variant="ghost" size={Button.SIZES.SMALL} icon="export" onClick={view.handleExport} title={lang.t("Export encounter")} />
			</div>
		</div>
	);
}

function EncounterViewModeControls({ displayMode, displayedMonsterCount, onDisplayMode }: Pick<EncounterHeaderProps, "displayMode" | "displayedMonsterCount" | "onDisplayMode">) {
	return (
		<div className="EncounterView__viewModeSwitch">
			<Button variant={displayMode === "single" ? "primary" : "ghost"} size={Button.SIZES.SMALL} icon="list" onClick={() => onDisplayMode("single")} title={lang.t("Preview")} />
			<Button variant={displayMode === "grid" ? "primary" : "ghost"} size={Button.SIZES.SMALL} icon="layers" onClick={() => onDisplayMode("grid")} disabled={displayedMonsterCount === 1} title={lang.t("All")} />
		</div>
	);
}

function EncounterGridColumnControls({ displayMode, gridColumns, onGridColumns }: Pick<EncounterHeaderProps, "displayMode" | "gridColumns" | "onGridColumns">) {
	if (displayMode !== "grid") return null;
	return (
		<div className="EncounterView__gridColumnsSwitch" aria-label={lang.t("Grid columns")}>
			{[1, 2, 3, 4].map((columns) => (
				<Button key={columns} variant={gridColumns === columns ? "primary" : "ghost"} size={Button.SIZES.SMALL} onClick={() => onGridColumns(columns)} title={lang.t("{count} columns", { count: columns })}>{columns}</Button>
			))}
		</div>
	);
}

function EncounterHistoryControls({ view }: Pick<EncounterHeaderProps, "view">) {
	return (
		<>
			<Button variant="ghost" size={Button.SIZES.SMALL} icon="undo" onClick={view.handleUndo} disabled={view.undoStack.length === 0 || view.isSaving} title={lang.t("Undo (Ctrl+Z)")} />
			<Button variant="ghost" size={Button.SIZES.SMALL} icon="redo" onClick={view.handleRedo} disabled={view.redoStack.length === 0 || view.isSaving} title={lang.t("Redo (Ctrl+Y)")} />
		</>
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
			<Bestiary
				ResponseModal={AiResponseModal}
				MonsterEditorModal={MonsterEditorModal}
				onAddMonster={(monster) => onAdd(monster as EncounterViewParticipant)}
			/>
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
	return (
		<>
			<EncounterCharacterPickerOverlay {...props} />
			<EncounterCharacterModalOverlay {...props} />
		</>
	);
}

function EncounterCharacterPickerOverlay(props: EncounterCharacterOverlaysProps) {
	if (!props.open) return null;
	return (
		<Modal onConfirm={() => {}} title={props.creating ? lang.t("New character") : lang.t("Choose player")} onCancel={props.onClosePicker} showFooter={false} type="custom">
			<div className="EncounterCharacterPicker">
				{props.creating ? <EncounterCharacterCreateForm {...props} /> : <EncounterCharacterList {...props} />}
			</div>
		</Modal>
	);
}

function EncounterCharacterCreateForm({ draft, submitting, campaignSlug, onDraft, onCreate, onReset }: EncounterCharacterOverlaysProps) {
	return (
		<div className="EncounterCharacterPicker__create">
			<CharacterCard character={draft} onChange={(_id, updated) => onDraft(updated as PlayerDraft)} onDelete={() => {}} onToggleCollapse={null} campaignSlug={campaignSlug} type="characters" viewMode="modal" showDeleteButton={false} showHeader={false} />
			<div className="EncounterCharacterPicker__createActions">
				<Button variant="primary" onClick={onCreate} disabled={submitting || !draft.firstName.trim()}>{lang.t("Create")}</Button>
				<Button variant="ghost" onClick={onReset} disabled={submitting}>{lang.t("Back")}</Button>
			</div>
		</div>
	);
}

function EncounterCharacterList({ available, allCharacters, onStartCreate, onAdd }: EncounterCharacterOverlaysProps) {
	return (
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
			)) : <EncounterCharacterEmptyState hasCharacters={allCharacters.length > 0} />}
		</>
	);
}

function EncounterCharacterEmptyState({ hasCharacters }: { hasCharacters: boolean }) {
	return <p className="muted">{hasCharacters ? lang.t("All player characters are already in encounter.") : lang.t("No player characters found.")}</p>;
}

function EncounterCharacterModalOverlay({ modalCharacter, campaignSlug, onCloseCharacter, onCharacterChange }: EncounterCharacterOverlaysProps) {
	if (!modalCharacter) return null;
	return (
		<Modal onConfirm={() => {}} title={getEncounterCharacterDisplayName(modalCharacter)} onCancel={onCloseCharacter} showFooter={false} type="custom">
			<CharacterCard character={modalCharacter} campaignSlug={campaignSlug} type="characters" viewMode="modal" showDeleteButton={false} onChange={onCharacterChange(getParticipantInstanceId(modalCharacter))} />
		</Modal>
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

function useEncounterRequestCleanup(
	focusTimeoutRef: RefObject<ReturnType<typeof setTimeout> | null>,
	aiEditControllerRef: RefObject<AbortController | null>,
) {
	useEffect(() => () => {
		if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current);
		aiEditControllerRef.current?.abort();
	}, []);
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

function useEncounterAiModelLoading({
	aiEditingMonster,
	aiModelCount,
	onModels,
	onSelectedModel,
	onError,
}: {
	aiEditingMonster: EncounterViewParticipant | null;
	aiModelCount: number;
	onModels: (models: AiModelDescriptor[]) => void;
	onSelectedModel: (updater: (current: string) => string) => void;
	onError: (error: unknown) => void;
}) {
	useEffect(() => {
		if (!aiEditingMonster || aiModelCount > 0) return;
		loadAiModelOptions({ setAiModels: onModels, setSelectedAiModel: onSelectedModel, onError });
	}, [aiEditingMonster, aiModelCount]);
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
				onRefresh: () => dispatch(refreshEntitiesAction()),
				onClose: closeEditMonsterFields,
				onError: (error) => dispatch(
				alert({
					title: lang.t("Error"),
					message: error instanceof Error ? error.message : lang.t("Unknown error"),
				}),
				),
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
			onError: (error) => dispatch(
				alert({
					title: lang.t("AI history error"),
					message: error instanceof Error ? error.message : lang.t("Unknown error"),
				}),
			),
			onComplete: () => setIsRestoringAiResponse(false),
		});
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
		const payload = buildCreateEntityPayload(ENCOUNTER_CHARACTER_DEFAULTS, playerDraft);
		setIsPlayerSubmitting(true);
		await executeEncounterPlayerCreation({
			request: () => createCampaignEntity(
				activeCampaign.slug,
				"characters",
				payload as CampaignEntityRecord,
			),
			onRefresh: () => dispatch(refreshEntitiesAction()),
			onAdd: view.handleAddCharacter,
			onReset: resetPlayerCreateForm,
			onError: (error) => {
			console.error("Failed to create player from encounter", error);
			dispatch(
				alert({
					title: lang.t("Error"),
					message: lang.t("Failed to create entity."),
				}),
			);
			},
			onComplete: () => setIsPlayerSubmitting(false),
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
						campaignSlug={activeCampaign.slug}
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
				campaignSlug={activeCampaign.slug}
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
