import type { RefObject } from "react";

import type {
	AiHistoryEntry,
	AiHistoryResource,
	DiffResource,
} from "../../ai/index.js";
import type {
	AiResponseHistoryEntry,
	AiResponseModalComponent,
	AiResponseModalProps,
} from "../../ai/ui/index.js";

export type AiDraftHistoryEntry = AiResponseHistoryEntry;

type RestoreDraft = (
	entry: AiDraftHistoryEntry,
	resourceIds?: string[],
) => void | Promise<void>;

export interface BestiaryAiDraftModalProps {
	ResponseModal: AiResponseModalComponent;
	aiDraftDiffResources: DiffResource[];
	aiDraftResponseEntry?: AiDraftHistoryEntry | null;
	aiDraftResponseRef: RefObject<HTMLDivElement | null>;
	getDiffResourceState: (resource: AiHistoryResource) => string;
	getHistoryChangeSummary: (entry: AiHistoryEntry) => string;
	isRestoringAiResponse: boolean;
	onApply: RestoreDraft;
	onApplyResource: RestoreDraft;
	onCancel: () => void;
	onSaveDraftChanges: AiResponseModalProps["onSaveDraftChanges"];
	onUndo: RestoreDraft;
	onUndoResource: RestoreDraft;
}

export default function BestiaryAiDraftModal({
	ResponseModal,
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
				entry ? onApply(entry) : undefined
			}
			onApplyResource={(entry = aiDraftResponseEntry, resourceIds) =>
				entry ? onApplyResource(entry, resourceIds) : undefined
			}
			onCancel={onCancel}
			onCopy={() => {}}
			onSaveDraftChanges={onSaveDraftChanges}
			onUndo={(entry = aiDraftResponseEntry) =>
				entry ? onUndo(entry) : undefined
			}
			onUndoResource={(entry = aiDraftResponseEntry, resourceIds) =>
				entry ? onUndoResource(entry, resourceIds) : undefined
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
