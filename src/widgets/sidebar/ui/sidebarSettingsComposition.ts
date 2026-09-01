import { createElement, useMemo } from "react";
import { EditableField } from "../../../features/editor/ui/index.js";
import {
	createSettingsModalContentComponent,
	type SettingsModalContentProps,
	type SettingsModalRuntime,
} from "../../../features/settings/ui/index.js";
import { useSidebarRuntime } from "./SidebarRuntime.tsx";

const SidebarConfiguredSettingsModalContent =
	createSettingsModalContentComponent({ EditableField });

function useSidebarSettingsModalRuntime(): SettingsModalRuntime {
	const {
		activeCampaignSlug,
		autoApplyAiChanges,
		availableLanguages,
		currentLanguage,
		currentTheme,
		patchUiSettings,
		setCampaigns,
		setLanguage,
		simplifiedNotesEnabled,
		storedAiBasePrompt,
		storedCampaignAiBasePrompts,
		storedCampaignImagePromptBasePrompts,
		storedCampaigns,
		storedIgnoreSourcesList,
		storedImagePromptBasePrompt,
		useSearchDebounce,
	} = useSidebarRuntime();

	return useMemo<SettingsModalRuntime>(
		() => ({
			currentLanguage,
			availableLanguages,
			currentTheme,
			simplifiedNotesEnabled,
			storedCampaigns,
			activeCampaignSlug,
			storedAiBasePrompt,
			storedImagePromptBasePrompt,
			storedCampaignAiBasePrompts,
			storedCampaignImagePromptBasePrompts,
			storedIgnoreSourcesList,
			autoApplyAiChanges,
			useSearchDebounce,
			setLanguage,
			patchUiSettings,
			setCampaigns,
		}),
		[
			currentLanguage,
			availableLanguages,
			currentTheme,
			simplifiedNotesEnabled,
			storedCampaigns,
			activeCampaignSlug,
			storedAiBasePrompt,
			storedImagePromptBasePrompt,
			storedCampaignAiBasePrompts,
			storedCampaignImagePromptBasePrompts,
			storedIgnoreSourcesList,
			autoApplyAiChanges,
			useSearchDebounce,
			setLanguage,
			patchUiSettings,
			setCampaigns,
		],
	);
}

export function SidebarSettingsModalContent({
	onCancel,
}: Omit<SettingsModalContentProps, "runtime">) {
	const runtime = useSidebarSettingsModalRuntime();
	return createElement(SidebarConfiguredSettingsModalContent, {
		onCancel,
		runtime,
	});
}
