import type { ComponentType, RefObject } from "react";

import type {
	AiHistoryEntry,
	AiHistoryResource,
} from "../api/aiApi.ts";
import type { DiffResource } from "../model/aiDiff.ts";

export interface AiResponseHistoryEntry extends AiHistoryEntry {
	text?: string;
}

export interface AiResponseModalProps {
	generatedPrompt?: string;
	generatedPromptRef: RefObject<HTMLDivElement | null>;
	isGeneratedPromptCopied: boolean;
	isRestoringResponse: boolean;
	markdownComponents: Record<string, unknown>;
	onApply: (
		entry?: AiResponseHistoryEntry | null,
	) => void | Promise<void>;
	onApplyResource: (
		entry: AiResponseHistoryEntry | null | undefined,
		resourceIds: string[],
	) => void | Promise<void>;
	onCancel: () => void;
	onCopy: () => void;
	onSaveDraftChanges: (
		resources: AiHistoryResource[],
	) => Promise<AiResponseHistoryEntry | null | undefined>;
	onUndo: (
		entry?: AiResponseHistoryEntry | null,
	) => void | Promise<void>;
	onUndoResource: (
		entry: AiResponseHistoryEntry | null | undefined,
		resourceIds: string[],
	) => void | Promise<void>;
	selectedResponseDetails: unknown[];
	selectedResponseDiffResources: DiffResource[];
	selectedResponseEntry: AiResponseHistoryEntry | null;
	selectedResponseHasChanges: boolean;
	getDiffResourceState: (resource: AiHistoryResource) => string;
	getHistoryChangeSummary: (
		entry: AiHistoryEntry | null | undefined,
	) => string;
}

export type AiResponseModalComponent = ComponentType<AiResponseModalProps>;

export type AiHistoryRestoreMode = "apply" | "undo";

export interface AiHistoryRestoreOptions {
	resourceIds?: string[];
}
