import type { RefObject } from "react";

import type { AiHistoryResource } from "../api/aiApi.ts";
import type { DiffResource } from "../model/aiDiff.ts";
import type {
	AiHistoryRestoreMode,
	AiHistoryRestoreOptions,
	AiResponseHistoryEntry,
	AiResponseModalComponent,
	AiResponseModalProps,
} from "./responseModalContracts.ts";

export interface AiHistoryResponseDialogProps {
	ResponseModal: AiResponseModalComponent;
	generatedPrompt?: string;
	generatedPromptRef: RefObject<HTMLDivElement | null>;
	isGeneratedPromptCopied: boolean;
	isRestoringResponse: boolean;
	markdownComponents: Record<string, unknown>;
	onRestore: (
		entry: AiResponseHistoryEntry | null | undefined,
		mode: AiHistoryRestoreMode,
		options?: AiHistoryRestoreOptions,
	) => void | Promise<void>;
	onCancel: () => void;
	onCopy: () => void;
	onSaveDraftChanges: (
		entry: AiResponseHistoryEntry | null,
		resources: AiHistoryResource[],
	) => Promise<AiResponseHistoryEntry | null | undefined>;
	selectedResponseDetails: unknown[];
	selectedResponseDiffResources: DiffResource[];
	selectedResponseEntry: AiResponseHistoryEntry | null;
	selectedResponseHasChanges: boolean;
	getDiffResourceState: AiResponseModalProps["getDiffResourceState"];
	getHistoryChangeSummary: AiResponseModalProps["getHistoryChangeSummary"];
}

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
}: AiHistoryResponseDialogProps) {
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
