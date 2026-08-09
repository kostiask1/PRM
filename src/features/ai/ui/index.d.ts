export {
	default as AiApiKeyPanel,
	type AiApiKeyPanelProps,
} from "./AiApiKeyPanel.tsx";
export {
	createAiAttachmentControlsComponent,
} from "./AiAttachmentControls.tsx";
export type {
	AiAttachmentControlsComponent,
	AiAttachmentControlsCompositionSlots,
	AiAttachmentControlsProps,
	AiAttachmentGalleryImage,
	AiAttachmentGallerySlot,
	AiAttachmentGallerySlotProps,
} from "./aiAttachmentComposition.ts";
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
	createAiPromptComposerComponent,
} from "./AiPromptComposer.tsx";
export type {
	AiPromptComposerComponent,
	AiPromptComposerCompositionSlots,
	AiPromptComposerEditableFieldChangeEvent,
	AiPromptComposerEditableFieldSlot,
	AiPromptComposerEditableFieldSlotProps,
	AiPromptComposerProps,
} from "./aiPromptComposition.ts";
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
