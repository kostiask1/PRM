import {
	BestiaryBrowser as Bestiary,
} from "../../../../widgets/bestiary-browser/index.js";
import { createAiResponseModalComponent } from "../../../../widgets/ai-response-modal/index.js";
import { AiAssistantPanel } from "../../../../widgets/ai-assistant/index.js";
import { createMonsterEditorModalComponent } from "../../../../widgets/monster-editor-modal/index.js";
import { MonsterStatBlock } from "../../../../widgets/monster-stat-block/index.js";
import { SpellsBrowser } from "../../../../widgets/spells-browser/index.js";
import { createRulesReferenceModalContentComponent } from "../../../../widgets/rules-reference-modal/index.js";
import {
	CharacterCard,
	LocationCard,
} from "../../../../widgets/campaign-entity-card/index.js";
import type { BestiaryMonster } from "../../../../entities/bestiary/index.js";
import {
	getHistoryChangeSummary as getAiHistoryChangeSummary,
	getLocalizedDiffResourceState,
	type AiHistoryEntry,
	type AiHistoryResource,
} from "../../../../features/ai/index.js";
import { lang } from "../../../../shared/lib/index.js";
import type { EncounterViewParticipant } from "../../model/contracts.ts";
import type { useEncounterPageController } from "../../model/useEncounterPageController.ts";
import EncounterBestiaryAiModals from "./EncounterBestiaryAiModals.tsx";
import EncounterBestiaryOverlay from "./EncounterBestiaryOverlay.tsx";
import EncounterCharacterOverlays from "./EncounterCharacterOverlays.tsx";
import EncounterDetail from "./EncounterDetail.tsx";
import EncounterHeader from "./EncounterHeader.tsx";
import EncounterMonsterActionModals from "./EncounterMonsterActionModals.tsx";
import EncounterMonsterRow from "./EncounterMonsterRow.tsx";
import EncounterNotification from "./EncounterNotification.tsx";
import EncounterParticipantList from "./EncounterParticipantList.tsx";

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

interface Props {
	controller: ReturnType<typeof useEncounterPageController>;
}

function translate(...args: Parameters<typeof lang.t>) {
	return lang.t(...args);
}

function getHistoryChangeSummary(entry: AiHistoryEntry) {
	return getAiHistoryChangeSummary(entry, translate);
}

function getDiffResourceState(resource: AiHistoryResource) {
	return getLocalizedDiffResourceState(resource, translate);
}

export default function EncounterPageContent({ controller }: Props) {
	const {
		aiDraft,
		aiDraftDiffResources,
		aiDraftResponseRef,
		aiEditor,
		aiGeneration,
		availablePlayerCharacters,
		characterModal,
		displaySettings,
		effectiveDisplayMode,
		effectiveGridColumns,
		focusedMonsterId,
		getParticipantInstanceId,
		gridColumns,
		gridMonsters,
		headerActionsRef,
		hpEditing,
		isHeaderActionsOpen,
		monsterAiAction,
		monsterFieldEditing,
		monsterInteractions,
		playerCreation,
		renderContext,
		selectedGridInstanceId,
		selectedParticipantId,
		setGridItemRef,
		toggleHeaderActions,
		view,
	} = controller;

	if (!renderContext) return null;
	const { campaign, encounter } = renderContext;

	return (
		<>
			<EncounterHeader
				view={view}
				displayMode={effectiveDisplayMode}
				displayedMonsterCount={gridMonsters.length}
				gridColumns={gridColumns}
				isActionsOpen={isHeaderActionsOpen}
				actionsRef={headerActionsRef}
				onToggleActions={toggleHeaderActions}
				onDisplayMode={displaySettings.updateViewMode}
				onGridColumns={displaySettings.updateGridColumns}
			/>
			<div className="Panel__body EncounterView__body">
				<div className="EncounterView__main">
					<EncounterParticipantList
						monsters={encounter.monsters}
						onOpenBestiary={() => view.setShowBestiary(true)}
						onOpenCharacterPicker={() => view.setShowCharacterPicker(true)}
						onReorder={view.handleReorderMonsters}
						onDrop={view.handleMonstersDrop}
						renderRow={(monster, isDragging) => (
							<EncounterMonsterRow
								monster={monster}
								isDragging={isDragging}
								hpDrafts={hpEditing.drafts}
								selectedInstanceId={selectedParticipantId}
								view={view}
								onSelect={monsterInteractions.select}
								onHpChange={hpEditing.onChange}
								onHpBlur={hpEditing.onBlur}
								getParticipantInstanceId={getParticipantInstanceId}
							/>
						)}
					/>

					<EncounterDetail
						displayMode={effectiveDisplayMode}
						gridMonsters={gridMonsters}
						gridColumns={effectiveGridColumns}
						selectedInstance={view.selectedInstance}
						selectedGridInstanceId={selectedGridInstanceId}
						focusedMonsterId={focusedMonsterId}
						campaignSlug={campaign.slug}
						getParticipantInstanceId={getParticipantInstanceId}
						setGridItemRef={setGridItemRef}
						onAiAction={monsterAiAction.openAction}
						onFieldEdit={monsterFieldEditing.openAction}
						onTokenImageChange={monsterInteractions.updateTokenImage}
						onCharacterChange={characterModal.getOnChange}
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
				modalCharacter={characterModal.value}
				campaignSlug={campaign.slug}
				onClosePicker={playerCreation.closePicker}
				onDraft={playerCreation.setDraft}
				onCreate={playerCreation.submit}
				onReset={playerCreation.reset}
				onStartCreate={playerCreation.start}
				onAdd={view.handleAddCharacter}
				onCloseCharacter={characterModal.close}
				getModalCharacterOnChange={(character) =>
					characterModal.getOnChange(getParticipantInstanceId(character))
				}
			/>

			<EncounterMonsterActionModals
				aiActionMonster={monsterAiAction.actionMonster}
				fieldActionMonster={monsterFieldEditing.actionMonster}
				onAiCancel={monsterAiAction.closeAction}
				onAiChoose={monsterAiAction.chooseAction}
				onFieldCancel={monsterFieldEditing.closeAction}
				onFieldChoose={monsterFieldEditing.chooseAction}
			/>
			<EncounterBestiaryAiModals
				ResponseModal={EncounterAiResponseModal}
				aiDraftDiffResources={aiDraftDiffResources}
				aiDraftResponseEntry={aiDraft.entry}
				aiDraftResponseRef={aiDraftResponseRef}
				aiEditingMonster={aiEditor.editingMonster as BestiaryMonster | null}
				aiEditError={aiEditor.error}
				aiEditInstructions={aiEditor.instructions}
				aiEditMode={aiEditor.mode}
				aiModels={aiEditor.models}
				getDiffResourceState={getDiffResourceState}
				getHistoryChangeSummary={getHistoryChangeSummary}
				isAiEditingMonster={aiEditor.isEditing}
				isRestoringAiResponse={aiDraft.isRestoring}
				onApplyDraft={(entry) => aiDraft.restore(entry, "apply")}
				onApplyDraftResource={(entry, resourceIds) =>
					aiDraft.restore(entry, "apply", { resourceIds })
				}
				onCancelDraft={aiDraft.close}
				onCancelEdit={aiEditor.close}
				onCancelEditRequest={aiGeneration.cancel}
				onInstructionsChange={aiEditor.setInstructions}
				onModelChange={aiEditor.setSelectedModel}
				onSaveDraftChanges={aiDraft.save}
				onSaveEdit={aiGeneration.save}
				onUndoDraft={(entry) => aiDraft.restore(entry, "undo")}
				onUndoDraftResource={(entry, resourceIds) =>
					aiDraft.restore(entry, "undo", { resourceIds })
				}
				selectedAiModel={aiEditor.selectedModel}
			/>
			<EncounterMonsterEditorModal
				editingMonster={monsterFieldEditing.editingMonster}
				onCancel={monsterFieldEditing.closeEditor}
				onSave={monsterFieldEditing.save}
				title={lang.t("Edit encounter creature")}
			/>

			<EncounterNotification
				message={view.notification}
				onClose={() => view.setNotification(null)}
			/>
		</>
	);
}
