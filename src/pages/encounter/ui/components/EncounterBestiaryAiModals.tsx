import type { BestiaryAiModalsSlotProps } from "../../../../widgets/bestiary-browser/index.js";

import BestiaryAiDraftModal from "./BestiaryAiDraftModal.tsx";
import MonsterAiEditModal from "./MonsterAiEditModal.tsx";

export default function EncounterBestiaryAiModals({
	ResponseModal,
	aiDraftDiffResources,
	aiDraftResponseEntry,
	aiDraftResponseRef,
	aiEditAttachedFiles,
	aiEditAttachedImages,
	aiEditingMonster,
	aiEditError,
	aiEditInstructions,
	aiEditMode,
	aiModels,
	getDiffResourceState,
	getHistoryChangeSummary,
	isAiEditingMonster,
	isRestoringAiResponse,
	onApplyDraft,
	onApplyDraftResource,
	onCancelDraft,
	onCancelEdit,
	onCancelEditRequest,
	onInstructionsChange,
	onModelChange,
	onSaveDraftChanges,
	onSaveEdit,
	onUndoDraft,
	onUndoDraftResource,
	selectedAiModel,
	setAiEditAttachedFiles,
	setAiEditAttachedImages,
}: BestiaryAiModalsSlotProps) {
	return (
		<>
			<MonsterAiEditModal
				aiEditAttachedFiles={aiEditAttachedFiles}
				aiEditAttachedImages={aiEditAttachedImages}
				aiEditingMonster={aiEditingMonster}
				aiEditError={aiEditError}
				aiEditInstructions={aiEditInstructions}
				aiEditMode={aiEditMode}
				aiModels={aiModels}
				isAiEditingMonster={isAiEditingMonster}
				onCancelEdit={onCancelEdit}
				onCancelEditRequest={onCancelEditRequest}
				onInstructionsChange={onInstructionsChange}
				onModelChange={onModelChange}
				onSaveEdit={onSaveEdit}
				selectedAiModel={selectedAiModel}
				setAiEditAttachedFiles={setAiEditAttachedFiles}
				setAiEditAttachedImages={setAiEditAttachedImages}
			/>
			<BestiaryAiDraftModal
				ResponseModal={ResponseModal}
				aiDraftDiffResources={aiDraftDiffResources}
				aiDraftResponseEntry={aiDraftResponseEntry}
				aiDraftResponseRef={aiDraftResponseRef}
				getDiffResourceState={getDiffResourceState}
				getHistoryChangeSummary={getHistoryChangeSummary}
				isRestoringAiResponse={isRestoringAiResponse}
				onApplyDraft={onApplyDraft}
				onApplyDraftResource={onApplyDraftResource}
				onCancelDraft={onCancelDraft}
				onSaveDraftChanges={onSaveDraftChanges}
				onUndoDraft={onUndoDraft}
				onUndoDraftResource={onUndoDraftResource}
			/>
		</>
	);
}
