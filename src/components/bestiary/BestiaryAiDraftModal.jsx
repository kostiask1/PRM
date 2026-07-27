import AiResponseModal from "../ai/AiResponseModal";

export default function BestiaryAiDraftModal({
	aiDraftDiffResources,
	aiDraftResponseEntry,
	aiDraftResponseRef,
	getDiffResourceState,
	getHistoryChangeSummary,
	isRestoringAiResponse,
	onApply,
	onApplyResource,
	onCancel,
	onSaveDraftChanges,
	onUndo,
	onUndoResource,
}) {
	if (!aiDraftResponseEntry) return null;

	return (
		<AiResponseModal
			generatedPrompt={aiDraftResponseEntry.text}
			generatedPromptRef={aiDraftResponseRef}
			isGeneratedPromptCopied={false}
			isRestoringResponse={isRestoringAiResponse}
			markdownComponents={{}}
			onApply={(entry = aiDraftResponseEntry) => onApply(entry)}
			onApplyResource={(entry = aiDraftResponseEntry, resourceIds) =>
				onApplyResource(entry, resourceIds)
			}
			onCancel={onCancel}
			onCopy={() => {}}
			onSaveDraftChanges={onSaveDraftChanges}
			onUndo={(entry = aiDraftResponseEntry) => onUndo(entry)}
			onUndoResource={(entry = aiDraftResponseEntry, resourceIds) =>
				onUndoResource(entry, resourceIds)
			}
			selectedResponseDetails={[]}
			selectedResponseDiffResources={aiDraftDiffResources}
			selectedResponseEntry={aiDraftResponseEntry}
			selectedResponseHasChanges={aiDraftDiffResources.length > 0}
			getDiffResourceState={getDiffResourceState}
			getHistoryChangeSummary={getHistoryChangeSummary}
		/>
	);
}
