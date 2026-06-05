import BestiaryAiDraftModal from "./BestiaryAiDraftModal";
import MonsterAiEditModal from "./MonsterAiEditModal";

export default function BestiaryAiModals({
	aiDraftDiffResources,
	aiDraftResponseEntry,
	aiDraftResponseRef,
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
}) {
	return (
		<>
			<MonsterAiEditModal
				aiEditingMonster={aiEditingMonster}
				aiEditError={aiEditError}
				aiEditInstructions={aiEditInstructions}
				aiEditMode={aiEditMode}
				aiModels={aiModels}
				isAiEditingMonster={isAiEditingMonster}
				onCancel={onCancelEdit}
				onCancelRequest={onCancelEditRequest}
				onInstructionsChange={onInstructionsChange}
				onModelChange={onModelChange}
				onSave={onSaveEdit}
				selectedAiModel={selectedAiModel}
			/>
			<BestiaryAiDraftModal
				aiDraftDiffResources={aiDraftDiffResources}
				aiDraftResponseEntry={aiDraftResponseEntry}
				aiDraftResponseRef={aiDraftResponseRef}
				getDiffResourceState={getDiffResourceState}
				getHistoryChangeSummary={getHistoryChangeSummary}
				isRestoringAiResponse={isRestoringAiResponse}
				onApply={onApplyDraft}
				onApplyResource={onApplyDraftResource}
				onCancel={onCancelDraft}
				onSaveDraftChanges={onSaveDraftChanges}
				onUndo={onUndoDraft}
				onUndoResource={onUndoDraftResource}
			/>
		</>
	);
}
