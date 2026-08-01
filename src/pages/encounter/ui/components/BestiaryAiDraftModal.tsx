import type { BestiaryAiModalsSlotProps } from "../../../../widgets/bestiary-browser/index.js";

type BestiaryAiDraftModalProps = Pick<
	BestiaryAiModalsSlotProps,
	| "ResponseModal"
	| "aiDraftDiffResources"
	| "aiDraftResponseEntry"
	| "aiDraftResponseRef"
	| "getDiffResourceState"
	| "getHistoryChangeSummary"
	| "isRestoringAiResponse"
	| "onApplyDraft"
	| "onApplyDraftResource"
	| "onCancelDraft"
	| "onSaveDraftChanges"
	| "onUndoDraft"
	| "onUndoDraftResource"
>;

export default function BestiaryAiDraftModal({
	ResponseModal,
	aiDraftDiffResources,
	aiDraftResponseEntry,
	aiDraftResponseRef,
	getDiffResourceState,
	getHistoryChangeSummary,
	isRestoringAiResponse,
	onApplyDraft,
	onApplyDraftResource,
	onCancelDraft,
	onSaveDraftChanges,
	onUndoDraft,
	onUndoDraftResource,
}: BestiaryAiDraftModalProps) {
	if (!aiDraftResponseEntry) return null;

	return (
		<ResponseModal
			generatedPrompt={aiDraftResponseEntry.text}
			generatedPromptRef={aiDraftResponseRef}
			isGeneratedPromptCopied={false}
			isRestoringResponse={isRestoringAiResponse}
			markdownComponents={{}}
			onApply={(entry = aiDraftResponseEntry) =>
				entry ? onApplyDraft(entry) : undefined
			}
			onApplyResource={(entry = aiDraftResponseEntry, resourceIds) =>
				entry ? onApplyDraftResource(entry, resourceIds) : undefined
			}
			onCancel={onCancelDraft}
			onCopy={() => {}}
			onSaveDraftChanges={onSaveDraftChanges}
			onUndo={(entry = aiDraftResponseEntry) =>
				entry ? onUndoDraft(entry) : undefined
			}
			onUndoResource={(entry = aiDraftResponseEntry, resourceIds) =>
				entry ? onUndoDraftResource(entry, resourceIds) : undefined
			}
			selectedResponseDetails={[]}
			selectedResponseDiffResources={aiDraftDiffResources}
			selectedResponseEntry={aiDraftResponseEntry}
			selectedResponseHasChanges={aiDraftDiffResources.length > 0}
			getDiffResourceState={getDiffResourceState}
			getHistoryChangeSummary={(entry) =>
				entry ? getHistoryChangeSummary(entry) : ""
			}
		/>
	);
}
