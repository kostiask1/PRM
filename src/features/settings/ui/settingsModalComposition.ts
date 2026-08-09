import type { ReactElement } from "react";
import type { SettingsPromptMap } from "../model/settingsModal.ts";
import type { Theme } from "../model/theme.ts";

export interface SettingsModalUiPatch extends Record<string, unknown> {
	theme?: Theme;
	simplifiedNotes?: boolean;
	aiBasePrompt?: string;
	imagePromptBasePrompt?: string;
	campaignAiBasePrompts?: SettingsPromptMap;
	campaignImagePromptBasePrompts?: SettingsPromptMap;
	ignoreSourcesList?: string[];
	autoApplyAiChanges?: boolean;
	useSearchDebounce?: boolean;
}

export interface SettingsModalRuntime {
	currentLanguage: string;
	availableLanguages: string[];
	currentTheme: Theme;
	simplifiedNotesEnabled: boolean;
	storedCampaigns: unknown[];
	activeCampaignSlug: string | null;
	storedAiBasePrompt: string | undefined;
	storedImagePromptBasePrompt: string | undefined;
	storedCampaignAiBasePrompts: SettingsPromptMap;
	storedCampaignImagePromptBasePrompts: SettingsPromptMap;
	storedIgnoreSourcesList: string[] | undefined;
	autoApplyAiChanges: boolean | undefined;
	useSearchDebounce: boolean | undefined;
	setLanguage(language: string): void;
	patchUiSettings(patch: SettingsModalUiPatch): void;
	setCampaigns(campaigns: unknown[]): void;
}

export interface SettingsModalContentProps {
	onCancel: () => void;
	runtime: SettingsModalRuntime;
}

export interface SettingsModalEditableFieldChangeEvent {
	target: { value: string };
}

export interface SettingsModalEditableFieldSlotProps {
	type: "textarea";
	className: string;
	value: string;
	onChange: (event: SettingsModalEditableFieldChangeEvent) => void;
	placeholder: string;
	disabled: boolean;
}

export type SettingsModalEditableFieldSlot = (
	props: SettingsModalEditableFieldSlotProps,
) => ReactElement | null;

export interface SettingsModalCompositionSlots {
	EditableField: SettingsModalEditableFieldSlot;
}

export type SettingsModalContentComponent = (
	props: SettingsModalContentProps,
) => ReactElement | null;
