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
	renderAiResponseModal,
}) {
	if (!aiDraftResponseEntry || !renderAiResponseModal) return null;

	return renderAiResponseModal({
		generatedPrompt: aiDraftResponseEntry.text,
		generatedPromptRef: aiDraftResponseRef,
		isGeneratedPromptCopied: false,
		isRestoringResponse: isRestoringAiResponse,
		markdownComponents: {},
		onApply: (entry = aiDraftResponseEntry) => onApply(entry),
		onApplyResource: (entry = aiDraftResponseEntry, resourceIds) =>
			onApplyResource(entry, resourceIds),
		onCancel,
		onCopy: () => {},
		onSaveDraftChanges,
		onUndo: (entry = aiDraftResponseEntry) => onUndo(entry),
		onUndoResource: (entry = aiDraftResponseEntry, resourceIds) =>
			onUndoResource(entry, resourceIds),
		selectedResponseDetails: [],
		selectedResponseDiffResources: aiDraftDiffResources,
		selectedResponseEntry: aiDraftResponseEntry,
		selectedResponseHasChanges: aiDraftDiffResources.length > 0,
		getDiffResourceState,
		getHistoryChangeSummary,
	});
}
