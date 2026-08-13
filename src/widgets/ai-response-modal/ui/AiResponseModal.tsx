import { useState, type ReactNode } from "react";

import type { BestiaryMonster } from "../../../entities/bestiary/index.js";
import type {
	CharacterData,
	LocationData,
} from "../../../entities/campaign/index.js";
import type {
	AiResponseModalComponent,
	AiResponseModalProps,
} from "../../../features/ai/ui/index.js";
import { EditableField } from "../../../features/editor/ui/index.js";
import { createNoteCardComponent } from "../../../features/notes/ui/index.js";
import { renderMentionText } from "../../../features/entity-link/index.js";
import { classNames } from "../../../shared/lib/index.js";
import { formatSourceLabel } from "../../../entities/reference/index.js";
import { lang } from "../../../shared/lib/index.js";
import {
	buildCardHighlightFields,
	buildNoteHighlightFields,
	encounterMonsterStatsChanged,
	getCardEntityType,
	getEncounterParticipantEntries,
	getEncounterParticipantMeta as buildEncounterParticipantMeta,
	getEncounterParticipantName as buildEncounterParticipantName,
	getEncounterParticipants,
	getNoteDiffKey,
	getPreviewCardType,
	isEncounterResource,
	isNoteResource,
	isObjectSnapshot,
	isResourceApplied,
	isResourceUndone,
	snapshotsEqual,
	type CardHighlightFields,
	type PreviewResource,
	type SnapshotRecord,
} from "../model/aiResponseModal.ts";
import { useAiResponseDraftController } from "../model/useAiResponseDraftController.ts";
import AiResponseResourceActions from "./AiResponseResourceActions.tsx";
import AiResponseGenericDiff from "./AiResponseGenericDiff.tsx";
import AiResponseJsonDiff from "./AiResponseJsonDiff.tsx";
import AiResponseModalView from "./AiResponseModalView.tsx";
import {
	createAiResponseCreatureFieldEditing,
	type CreatureEditState,
} from "./aiResponseCreatureFieldEditing.ts";
import type { AiResponseModalCompositionSlots } from "./aiResponseModalComposition.ts";

const AiResponseNoteCard = createNoteCardComponent({
	EditableField,
	renderMentionText,
});

const getEncounterParticipantName = (participant = {}) =>
	buildEncounterParticipantName(participant, lang.t("Creature"));
const getEncounterParticipantMeta = (participant = {}) =>
	buildEncounterParticipantMeta(participant, formatSourceLabel);

interface EncounterMonsterEditOptions {
	resource: PreviewResource;
	participantKey: string;
}

type EncounterSide = "before" | "after";

const toBestiaryMonster = (snapshot: SnapshotRecord): BestiaryMonster => ({
	...snapshot,
	name: typeof snapshot.name === "string" ? snapshot.name : "",
});

const getCampaignSlug = (
	resource: PreviewResource,
	entryCampaign: unknown,
): string | null => {
	if (typeof resource.campaign === "string") return resource.campaign;
	return typeof entryCampaign === "string" ? entryCampaign : null;
};

interface AiResponseModalInternalProps
	extends AiResponseModalProps,
		AiResponseModalCompositionSlots {}

function AiResponseModal({
	CharacterCard,
	LocationCard,
	MonsterStatBlock,
	MonsterEditorModal,
	generatedPrompt,
	generatedPromptRef,
	isGeneratedPromptCopied,
	isRestoringResponse,
	markdownComponents,
	onApply,
	onApplyResource,
	onCancel,
	onCopy,
	onSaveDraftChanges,
	onUndo,
	onUndoResource,
	selectedResponseDetails,
	selectedResponseDiffResources,
	selectedResponseEntry,
	selectedResponseHasChanges,
	getDiffResourceState,
	getHistoryChangeSummary,
}: AiResponseModalInternalProps) {
	const [fieldEditingCreature, setFieldEditingCreature] =
		useState<CreatureEditState | null>(null);
	const {
		apply: handleApply,
		applyResource: handleApplyResource,
		diffViewMode,
		draftEdits,
		draftError,
		draftResources,
		isDraft,
		resolvePreviewResource: getEditedPreviewResource,
		setDiffViewMode,
		undoResource: handleUndoResource,
		updateDraftResourceAfter,
		updateDraftText,
	} = useAiResponseDraftController({
		selectedResponseEntry,
		onApply,
		onApplyResource,
		onSaveDraftChanges,
		onUndoResource,
		invalidDraftMessage: lang.t("Invalid draft changes"),
		emptyDraftMessage: lang.t("Draft value cannot be empty."),
	});

	if (!generatedPrompt) return null;

	const noop = () => {};
	const renderResourceActions = (resource: PreviewResource) => (
		<AiResponseResourceActions
			resource={resource}
			isDraft={isDraft}
			isRestoringResponse={isRestoringResponse}
			onApply={handleApplyResource}
			onUndo={handleUndoResource}
		/>
	);
	const getPreviewResourceClassName = (
		resource: PreviewResource,
		...extraClassNames: Array<string | false | null | undefined>
	) =>
		classNames(
			"AiAssistant__preview_resource",
			...extraClassNames,
			resource.before === null && "is_added",
			resource.after === null && "is_removed",
			isResourceApplied(resource) && "is_applied",
			isResourceUndone(resource) && "is_undone",
		);
	const renderPreviewResourceHeader = (
		resource: PreviewResource,
		label: ReactNode = resource.label,
	) => (
		<div className="AiAssistant__preview_resource_header">
			<span>{label || resource.label}</span>
			<div className="AiAssistant__preview_resource_actions">
				<span>{getDiffResourceState(resource)}</span>
				{renderResourceActions(resource)}
			</div>
		</div>
	);
	const {
		closeCreatureFieldEdit,
		openCreatureFieldEdit,
		saveCreatureFieldEdit,
	} = createAiResponseCreatureFieldEditing({
		fieldEditingCreature,
		setFieldEditingCreature,
		isDraft,
		resolvePreviewResource: getEditedPreviewResource,
		updateDraftResourceAfter,
		toBestiaryMonster,
	});
	const renderNoteCard = (
		resource: PreviewResource,
		note: unknown,
		editable = false,
		highlightFields: readonly string[] | null = null,
	) => {
		if (!isObjectSnapshot(note)) return null;
		const campaignSlug = getCampaignSlug(
			resource,
			selectedResponseEntry?.path?.campaign,
		);
		const normalizedNote = {
			id:
				typeof note.id === "string" || typeof note.id === "number"
					? note.id
					: "preview-note",
			title: typeof note.title === "string" ? note.title : "",
			text: typeof note.text === "string" ? note.text : "",
			collapsed: Boolean(note.collapsed),
		};
		return (
			<AiResponseNoteCard
				note={normalizedNote}
				isLast={false}
				campaignSlug={campaignSlug}
				onToggleCollapse={noop}
				onTitleChange={
					editable
						? (_id, title) =>
								updateDraftResourceAfter(resource, { ...note, title })
						: noop
				}
				onTextChange={
					editable
						? (_id, text) =>
								updateDraftResourceAfter(resource, { ...note, text })
						: noop
				}
				onDelete={noop}
				highlightFields={highlightFields}
			/>
		);
	};

	const renderEntityCard = (
		resource: PreviewResource,
		snapshot: unknown,
		editable = false,
		highlightFields: CardHighlightFields | null = null,
	) => {
		const cardType = getPreviewCardType(resource);
		if (!cardType || !isObjectSnapshot(snapshot)) return null;
		const campaignSlug = getCampaignSlug(
			resource,
			selectedResponseEntry?.path?.campaign,
		);
		if (cardType === "monster") {
			return (
				<MonsterStatBlock
					monster={toBestiaryMonster(snapshot)}
					showFavoriteAction={false}
					allowTokenUpload={false}
					onFieldEdit={
						editable
							? (monster) => openCreatureFieldEdit(resource, monster)
							: undefined
					}
					searchHighlight=""
					highlightFields={highlightFields}
				/>
			);
		}
		if (cardType === "location") {
			return (
				<LocationCard
					location={snapshot as LocationData}
					campaignSlug={campaignSlug}
					onChange={
						editable
							? (_id, next) => updateDraftResourceAfter(resource, next)
							: noop
					}
					onNameBlur={noop}
					onDelete={noop}
					onReorderDrop={noop}
					showDeleteButton={false}
					highlightFields={highlightFields}
				/>
			);
		}
		return (
			<CharacterCard
				character={snapshot as CharacterData}
				campaignSlug={campaignSlug}
				type={getCardEntityType(resource)}
				onChange={
					editable
						? (_id, next) => updateDraftResourceAfter(resource, next)
						: noop
				}
				onNameBlur={noop}
				onDelete={noop}
				onReorderDrop={noop}
				showDeleteButton={false}
				highlightFields={highlightFields}
			/>
		);
	};

	const renderEncounterParticipantList = (
		snapshot: unknown,
		counterpartSnapshot: unknown,
		side: EncounterSide,
	) => {
		const entries = getEncounterParticipantEntries(
			getEncounterParticipants(snapshot),
		);
		const counterpartEntries = getEncounterParticipantEntries(
			getEncounterParticipants(counterpartSnapshot),
		);
		const counterpartByKey = new Map(
			counterpartEntries.map((entry) => [entry.key, entry.participant]),
		);

		if (entries.length === 0) {
			return (
				<div className="AiAssistant__encounter_empty">
					{lang.t("No creatures in encounter.")}
				</div>
			);
		}

		return (
			<ol className="AiAssistant__encounter_list">
				{entries.map(({ key, participant, index }) => {
					const counterpart = counterpartByKey.get(key);
					const isMissing = !counterpart;
					const isChanged =
						counterpart && !snapshotsEqual(participant, counterpart);
					return (
						<li
							key={`${side}-${key}-${index}`}
							className={classNames(
								"AiAssistant__encounter_item",
								side === "before" && isMissing && "is_removed",
								side === "after" && isMissing && "is_added",
								isChanged && "is_modified",
							)}
						>
							<span className="AiAssistant__encounter_item_name">
								{getEncounterParticipantName(participant)}
							</span>
							{getEncounterParticipantMeta(participant) && (
								<span className="AiAssistant__encounter_item_meta">
									{getEncounterParticipantMeta(participant)}
								</span>
							)}
						</li>
					);
				})}
			</ol>
		);
	};

	const renderEncounterMonsterCard = (
		participant: unknown,
		className: string,
		highlightFields: CardHighlightFields | null = null,
		editOptions: EncounterMonsterEditOptions | null = null,
	) => {
		if (!isObjectSnapshot(participant)) return null;
		return (
			<div
				className={classNames(
					"AiAssistant__preview_card_surface",
					"AiAssistant__encounter_monster_surface",
					className,
				)}
			>
				<MonsterStatBlock
					monster={toBestiaryMonster(participant)}
					showFavoriteAction={false}
					allowTokenUpload={false}
					onFieldEdit={
						editOptions
							? (monster) =>
									openCreatureFieldEdit(editOptions.resource, monster, {
										mode: "encounter-participant",
										participantKey: editOptions.participantKey,
									})
							: undefined
					}
					searchHighlight=""
					highlightFields={highlightFields}
				/>
			</div>
		);
	};

	const isChangedEncounterMonster = (
		before: SnapshotRecord | null,
		after: SnapshotRecord | null,
	): boolean => {
		if (before?.participantType === "character") return false;
		if (after?.participantType === "character") return false;
		return !before || !after || encounterMonsterStatsChanged(before, after);
	};

	const renderSingleEncounterMonsterChange = (
		resource: PreviewResource,
		key: string,
		before: SnapshotRecord | null,
		after: SnapshotRecord | null,
	) => {
		const participant = before || after;
		const isAdded = !before;
		const editOptions =
			isAdded && isDraft && !isResourceApplied(resource)
				? { resource, participantKey: key }
				: null;
		const highlightFields = isAdded
			? buildCardHighlightFields({ before: {}, after })
			: null;
		return (
			<div key={`${resource.id}-${key}`} className="AiAssistant__preview_card_stack">
				<div className="AiAssistant__preview_card_frame">
					<div className="AiAssistant__preview_column_title">
						{getEncounterParticipantName(participant || {})} /{
						isAdded ? lang.t("New") : lang.t("Deleted")
					}
					</div>
					{renderEncounterMonsterCard(
						participant,
						isAdded ? "is_added" : "is_removed",
						highlightFields,
						editOptions,
					)}
				</div>
			</div>
		);
	};

	const renderPairedEncounterMonsterChange = (
		resource: PreviewResource,
		key: string,
		before: SnapshotRecord,
		after: SnapshotRecord,
	) => {
		const label = getEncounterParticipantName(after);
		const highlightFields = buildCardHighlightFields({ before, after });
		const editOptions =
			isDraft && !isResourceApplied(resource)
				? { resource, participantKey: key }
				: null;
		return (
			<div key={`${resource.id}-${key}`} className="AiAssistant__preview_card_columns">
				<div className="AiAssistant__preview_card_frame">
					<div className="AiAssistant__preview_column_title">
						{label} / {lang.t("Before")}
					</div>
					{renderEncounterMonsterCard(before, "is_before", highlightFields)}
				</div>
				<div className="AiAssistant__preview_card_frame">
					<div className="AiAssistant__preview_column_title">
						{label} / {lang.t("After")}
					</div>
					{renderEncounterMonsterCard(after, "is_after", highlightFields, editOptions)}
				</div>
			</div>
		);
	};

	const renderEncounterMonsterChange = (
		resource: PreviewResource,
		key: string,
		before: SnapshotRecord | null,
		after: SnapshotRecord | null,
	) =>
		before && after
			? renderPairedEncounterMonsterChange(resource, key, before, after)
			: renderSingleEncounterMonsterChange(resource, key, before, after);

	const renderEncounterMonsterChanges = (resource: PreviewResource) => {
		const beforeEntries = getEncounterParticipantEntries(
			getEncounterParticipants(resource.before),
		);
		const afterEntries = getEncounterParticipantEntries(
			getEncounterParticipants(resource.after),
		);
		const beforeByKey = new Map(
			beforeEntries.map((entry) => [entry.key, entry.participant]),
		);
		const afterByKey = new Map(
			afterEntries.map((entry) => [entry.key, entry.participant]),
		);
		const changedKeys = [
			...new Set([...beforeByKey.keys(), ...afterByKey.keys()]),
		].filter((key) =>
			isChangedEncounterMonster(
				beforeByKey.get(key) || null,
				afterByKey.get(key) || null,
			),
		);

		if (changedKeys.length === 0) return null;

		return (
			<div className="AiAssistant__encounter_monsters">
				<div className="AiAssistant__preview_column_title">
					{lang.t("Creature changes")}
				</div>
				{changedKeys.map((key) =>
					renderEncounterMonsterChange(
						resource,
						key,
						beforeByKey.get(key) || null,
						afterByKey.get(key) || null,
					),
				)}
			</div>
		);
	};

	const renderEncounterSide = (
		snapshot: unknown,
		counterpart: unknown,
		side: EncounterSide,
		label: string,
	) => {
		if (snapshot === null) return null;
		return (
			<div className="AiAssistant__preview_card_frame">
				<div className="AiAssistant__preview_column_title">{label}</div>
				<div className={`AiAssistant__encounter_panel is_${side}`}>
					{renderEncounterParticipantList(snapshot, counterpart, side)}
				</div>
			</div>
		);
	};

	const renderEncounterDiff = (resource: PreviewResource) => {
		resource = getEditedPreviewResource(resource);
		const before = resource.before || null;
		const after = resource.after || null;
		const title = String(
			(isObjectSnapshot(after) ? after.name : "") ||
				(isObjectSnapshot(before) ? before.name : "") ||
				resource.label ||
				"",
		).trim();

		return (
			<div
				key={resource.id}
				className={getPreviewResourceClassName(
					resource,
					"AiAssistant__preview_resource_encounter",
				)}
			>
				{renderPreviewResourceHeader(resource, title)}
				<div className="AiAssistant__preview_card_columns AiAssistant__encounter_columns">
					{renderEncounterSide(before, after, "before", lang.t("Before"))}
					{renderEncounterSide(
						after,
						before,
						"after",
						before === null ? lang.t("New") : lang.t("After"),
					)}
				</div>
				{renderEncounterMonsterChanges(resource)}
			</div>
		);
	};

	const renderSingleNoteDiff = (resource: PreviewResource, isNew: boolean) => (
		<div className="AiAssistant__preview_card_stack">
			<div className="AiAssistant__preview_card_frame">
				<div className="AiAssistant__preview_column_title">
					{isNew ? lang.t("New") : lang.t("Deleted")}
				</div>
				<div
					className={classNames(
						"AiAssistant__preview_note_surface",
						isDraft && isNew && "is_editable",
					)}
				>
					{renderNoteCard(
						resource,
						isNew ? resource.after : resource.before,
						isDraft && isNew && !isResourceApplied(resource),
						isNew ? ["title", "text"] : null,
					)}
				</div>
			</div>
		</div>
	);

	const renderChangedNoteDiff = (resource: PreviewResource) => {
		const highlightFields = buildNoteHighlightFields(resource);
		return (
			<div className="AiAssistant__preview_card_columns">
				<div className="AiAssistant__preview_card_frame">
					<div className="AiAssistant__preview_column_title">{lang.t("Before")}</div>
					<div className="AiAssistant__preview_note_surface is_before">
						{renderNoteCard(resource, resource.before, false, highlightFields)}
					</div>
				</div>
				<div className="AiAssistant__preview_card_frame">
					<div className="AiAssistant__preview_column_title">{lang.t("After")}</div>
					<div
						className={classNames(
							"AiAssistant__preview_note_surface is_after",
							isDraft && "is_editable",
						)}
					>
						{renderNoteCard(
							resource,
							resource.after,
							isDraft && !isResourceApplied(resource),
							highlightFields,
						)}
					</div>
				</div>
			</div>
		);
	};

	const renderNoteCardDiff = (resource: PreviewResource) => {
		resource = getEditedPreviewResource(resource);
		const isNew = resource.before === null;
		const isDeleted = resource.after === null;
		return (
			<div
				key={resource.id}
				className={getPreviewResourceClassName(
					resource,
					"AiAssistant__preview_resource_notes",
				)}
			>
				{renderPreviewResourceHeader(resource)}
				{isNew || isDeleted
					? renderSingleNoteDiff(resource, isNew)
					: renderChangedNoteDiff(resource)}
			</div>
		);
	};

	const renderNoteArrayDiff = (
		resource: PreviewResource,
		beforeNotes: unknown,
		afterNotes: unknown,
	) => {
		const beforeList = Array.isArray(beforeNotes) ? beforeNotes : [];
		const afterList = Array.isArray(afterNotes) ? afterNotes : [];
		const beforeByKey = new Map(
			beforeList.map((note, index) => [getNoteDiffKey(note, index), note]),
		);
		const afterByKey = new Map(
			afterList.map((note, index) => [getNoteDiffKey(note, index), note]),
		);
		const keys = [
			...new Set([...beforeByKey.keys(), ...afterByKey.keys()]),
		].filter(
			(key) => !snapshotsEqual(beforeByKey.get(key), afterByKey.get(key)),
		);
		return (
			<div className="AiAssistant__preview_note_list">
				{keys.map((key, index) => {
					const before = beforeByKey.get(key) ?? null;
					const after = afterByKey.get(key) ?? null;
					const listIndex = afterList.findIndex(
						(note, noteIndex) => getNoteDiffKey(note, noteIndex) === key,
					);
					return renderNoteCardDiff({
						...resource,
						parentResourceId: resource.id,
						id: `${resource.id}:note:${key}`,
						label: `${resource.label} / ${lang.t("Note")} ${index + 1}`,
						before,
						after,
						listIndex: listIndex >= 0 ? listIndex : null,
					});
				})}
			</div>
		);
	};

	const renderSingleCardResourceDiff = (
		resource: PreviewResource,
		isNew: boolean,
	) => {
		const snapshot = isNew ? resource.after : resource.before;
		return (
				<div className="AiAssistant__preview_card_stack">
					<div className="AiAssistant__preview_card_frame">
						<div className="AiAssistant__preview_column_title">
							{isNew ? lang.t("New") : lang.t("Deleted")}
						</div>
						<div
							className={classNames(
								"AiAssistant__preview_card_surface",
								isDraft && isNew && "is_editable",
							)}
						>
							{renderEntityCard(
								resource,
								snapshot,
								isDraft && isNew && !isResourceApplied(resource),
								isNew ? buildCardHighlightFields({ before: {}, after: snapshot }) : null,
							)}
						</div>
					</div>
				</div>
			);
	};

	const renderChangedCardResourceDiff = (resource: PreviewResource) => {
		const highlightFields = buildCardHighlightFields(resource);
		return (
			<div className="AiAssistant__preview_card_columns">
				<div className="AiAssistant__preview_card_frame">
					<div className="AiAssistant__preview_column_title">{lang.t("Before")}</div>
					<div className="AiAssistant__preview_card_surface is_before">
						{renderEntityCard(resource, resource.before, false, highlightFields)}
					</div>
				</div>
				<div className="AiAssistant__preview_card_frame">
					<div className="AiAssistant__preview_column_title">{lang.t("After")}</div>
					<div
						className={classNames(
							"AiAssistant__preview_card_surface is_after",
							isDraft && "is_editable",
						)}
					>
						{renderEntityCard(
							resource,
							resource.after,
							isDraft && !isResourceApplied(resource),
							highlightFields,
						)}
					</div>
				</div>
			</div>
		);
	};

	const renderCardResourceDiff = (resource: PreviewResource) => {
		const isNew = resource.before === null;
		return isNew || resource.after === null
			? renderSingleCardResourceDiff(resource, isNew)
			: renderChangedCardResourceDiff(resource);
	};

	const renderPreviewResource = (resource: PreviewResource) => {
		resource = getEditedPreviewResource(resource);
		const cardType = getPreviewCardType(resource);
		if (isEncounterResource(resource)) return renderEncounterDiff(resource);
		if (isNoteResource(resource)) return renderNoteCardDiff(resource);
		if (cardType) {
			return (
				<div
					key={resource.id}
					className={getPreviewResourceClassName(
						resource,
						"AiAssistant__preview_resource_cards",
					)}
				>
					{renderPreviewResourceHeader(resource)}
					{renderCardResourceDiff(resource)}
				</div>
			);
		}
		return (
			<AiResponseGenericDiff
				key={resource.id}
				resource={resource}
				getPreviewResourceClassName={getPreviewResourceClassName}
				renderPreviewResourceHeader={renderPreviewResourceHeader}
				renderNoteArrayDiff={renderNoteArrayDiff}
			/>
		);
	};

	return (
		<>
			<AiResponseModalView
				generatedPrompt={generatedPrompt}
				generatedPromptRef={generatedPromptRef}
				isGeneratedPromptCopied={isGeneratedPromptCopied}
				isRestoringResponse={isRestoringResponse}
				markdownComponents={markdownComponents}
				onApply={handleApply}
				onCancel={onCancel}
				onCopy={onCopy}
				onUndo={() => onUndo()}
				selectedResponseDetails={selectedResponseDetails}
				selectedResponseEntry={selectedResponseEntry}
				selectedResponseHasChanges={selectedResponseHasChanges}
				isDraft={isDraft}
				viewMode={diffViewMode}
				setViewMode={setDiffViewMode}
				draftError={draftError}
				resources={draftResources}
				draftEdits={draftEdits}
				getDiffResourceState={getDiffResourceState}
				getHistoryChangeSummary={getHistoryChangeSummary}
				renderResourceActions={renderResourceActions}
				updateDraftText={updateDraftText}
				preview={
					<div className="AiAssistant__preview_diff">
						{selectedResponseDiffResources.map(renderPreviewResource)}
					</div>
				}
				jsonDiff={
					<AiResponseJsonDiff
						resources={selectedResponseDiffResources}
						getDiffResourceState={getDiffResourceState}
					/>
				}
			/>
			<MonsterEditorModal
				editingMonster={fieldEditingCreature?.monster || null}
				onCancel={closeCreatureFieldEdit}
				onSave={saveCreatureFieldEdit}
			/>
		</>
	);
}

export function createAiResponseModalComponent({
	CharacterCard,
	LocationCard,
	MonsterStatBlock,
	MonsterEditorModal,
}: AiResponseModalCompositionSlots): AiResponseModalComponent {
	function ConfiguredAiResponseModal(props: AiResponseModalProps) {
		return (
			<AiResponseModal
				{...props}
				CharacterCard={CharacterCard}
				LocationCard={LocationCard}
				MonsterStatBlock={MonsterStatBlock}
				MonsterEditorModal={MonsterEditorModal}
			/>
		);
	}

	return ConfiguredAiResponseModal;
}
