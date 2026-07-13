export default function AiHistoryResponseDialog({
	ResponseModal,
	generatedPrompt,
	generatedPromptRef,
	isGeneratedPromptCopied,
	isRestoringResponse,
	markdownComponents,
	onRestore,
	onCancel,
	onCopy,
	onSaveDraftChanges,
	selectedResponseDetails,
	selectedResponseDiffResources,
	selectedResponseEntry,
	selectedResponseHasChanges,
	getDiffResourceState,
	getHistoryChangeSummary,
}) {
	return (
		<ResponseModal
			generatedPrompt={generatedPrompt}
			generatedPromptRef={generatedPromptRef}
			isGeneratedPromptCopied={isGeneratedPromptCopied}
			isRestoringResponse={isRestoringResponse}
			markdownComponents={markdownComponents}
			onApply={(entry = selectedResponseEntry) => onRestore(entry, "apply")}
			onApplyResource={(entry = selectedResponseEntry, resourceIds) =>
				onRestore(entry, "apply", { resourceIds })
			}
			onCancel={onCancel}
			onCopy={onCopy}
			onSaveDraftChanges={(resources) =>
				onSaveDraftChanges(selectedResponseEntry, resources)
			}
			onUndo={() => onRestore(selectedResponseEntry, "undo")}
			onUndoResource={(entry = selectedResponseEntry, resourceIds) =>
				onRestore(entry, "undo", { resourceIds })
			}
			selectedResponseDetails={selectedResponseDetails}
			selectedResponseDiffResources={selectedResponseDiffResources}
			selectedResponseEntry={selectedResponseEntry}
			selectedResponseHasChanges={selectedResponseHasChanges}
			getDiffResourceState={getDiffResourceState}
			getHistoryChangeSummary={getHistoryChangeSummary}
		/>
	);
}
