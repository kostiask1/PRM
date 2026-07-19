export {
	default as AiApiKeyPanel,
	type AiApiKeyPanelProps,
} from "./AiApiKeyPanel.tsx";
export {
	default as AiAttachmentControls,
	type AiAttachmentControlsProps,
} from "./AiAttachmentControls.tsx";
export {
	default as AiAssistantShell,
	type AiAssistantShellProps,
} from "./AiAssistantShell.tsx";
export {
	default as AiAssistantToolbar,
	type AiAssistantToolbarProps,
} from "./AiAssistantToolbar.tsx";
export {
	default as AiContextSettingsModal,
	type AiContextSettingsModalProps,
} from "./AiContextSettingsModal.tsx";
export {
	default as AiHistoryResponseDialog,
	type AiHistoryResponseDialogProps,
} from "./AiHistoryResponseDialog.tsx";
export {
	default as AiPromptComposer,
	type AiPromptComposerProps,
} from "./AiPromptComposer.tsx";
export {
	default as AiResponseHistory,
	type AiResponseHistoryProps,
} from "./AiResponseHistory.tsx";

export type { AiAttachmentStateSetter, AiUiAttachment } from "./types.ts";
export type {
	AiHistoryRestoreMode,
	AiHistoryRestoreOptions,
	AiResponseDetailRow,
	AiResponseHistoryEntry,
	AiResponseModalComponent,
	AiResponseModalProps,
} from "./responseModalContracts.ts";

export interface AiModelOption {
	name: string;
	displayName?: string;
}

export function renderAiModelOptions(
	models?: AiModelOption[] | null,
): import("react").ReactNode;
