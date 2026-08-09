import { createElement, useMemo } from "react";
import { EditableField } from "../../../features/editor/ui/index.js";
import {
	createSettingsModalContentComponent,
	type SettingsModalContentProps,
	type SettingsModalRuntime,
} from "../../../features/settings/ui/index.js";
import {
	setCampaignsAction,
	setLanguageAction,
	setUiSettingsAction,
	useAppDispatch,
	useAppSelector,
} from "../../../shared/model/index.js";

const SidebarConfiguredSettingsModalContent =
	createSettingsModalContentComponent({ EditableField });

function useSidebarSettingsModalRuntime(): SettingsModalRuntime {
	const dispatch = useAppDispatch();
	const currentLanguage = useAppSelector(
		(state) => state.localization.language,
	);
	const availableLanguages = useAppSelector(
		(state) => state.localization.availableLanguages,
	);
	const currentTheme = useAppSelector((state) => state.ui.theme);
	const simplifiedNotesEnabled = useAppSelector(
		(state) => state.ui.simplifiedNotes,
	);
	const storedCampaigns = useAppSelector((state) => state.campaigns.items);
	const activeCampaignSlug = useAppSelector(
		(state) => state.navigation.activeCampaignSlug,
	);
	const storedAiBasePrompt = useAppSelector(
		(state) => state.ui.aiBasePrompt,
	);
	const storedImagePromptBasePrompt = useAppSelector(
		(state) => state.ui.imagePromptBasePrompt,
	);
	const storedCampaignAiBasePrompts = useAppSelector(
		(state) => state.ui.campaignAiBasePrompts,
	);
	const storedCampaignImagePromptBasePrompts = useAppSelector(
		(state) => state.ui.campaignImagePromptBasePrompts,
	);
	const storedIgnoreSourcesList = useAppSelector(
		(state) => state.ui.ignoreSourcesList,
	);
	const autoApplyAiChanges = useAppSelector(
		(state) => state.ui.autoApplyAiChanges,
	);
	const useSearchDebounce = useAppSelector(
		(state) => state.ui.useSearchDebounce,
	);

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
			setLanguage(language) {
				dispatch(setLanguageAction(language));
			},
			patchUiSettings(patch) {
				dispatch(setUiSettingsAction(patch));
			},
			setCampaigns(campaigns) {
				dispatch(setCampaignsAction(campaigns));
			},
		}),
		[
			dispatch,
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
