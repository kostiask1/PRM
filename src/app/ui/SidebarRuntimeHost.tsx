import { useCallback, useMemo, type ReactNode } from "react";

import {
	SidebarRuntimeProvider,
	type SidebarRuntime,
} from "../../widgets/sidebar/index.js";
import {
	alert,
	requestDiceRollAction,
	requestRulesReferenceNavigationAction,
	setCampaignsAction,
	setLanguageAction,
	setUiSettingsAction,
} from "../../shared/model/index.js";
import {
	closeActiveModal,
	openModalRequest,
	useAppDispatch,
	useAppSelector,
} from "../model/index.js";

export default function SidebarRuntimeHost({
	children,
}: {
	children?: ReactNode;
}) {
	const dispatch = useAppDispatch();
	const {
		activeCampaignSlug,
		activeEncounterId,
		activeSessionFileName,
	} = useAppSelector((state) => state.navigation);
	const campaigns = useAppSelector((state) => state.campaigns.items);
	const { availableLanguages, language: currentLanguage } = useAppSelector(
		(state) => state.localization,
	);
	const {
		aiBasePrompt: storedAiBasePrompt,
		autoApplyAiChanges,
		campaignAiBasePrompts: storedCampaignAiBasePrompts,
		campaignImagePromptBasePrompts: storedCampaignImagePromptBasePrompts,
		ignoreSourcesList: storedIgnoreSourcesList,
		imagePromptBasePrompt: storedImagePromptBasePrompt,
		simplifiedNotes: simplifiedNotesEnabled,
		theme: currentTheme,
		useSearchDebounce,
	} = useAppSelector((state) => state.ui);
	const rolledResult = useAppSelector((state) => state.dice.rolledResult);
	const closeModal = useCallback<SidebarRuntime["closeModal"]>((value) => {
		closeActiveModal(value);
	}, []);
	const openModal = useCallback<SidebarRuntime["openModal"]>((config) => {
		return openModalRequest(config);
	}, []);
	const reportError = useCallback<SidebarRuntime["reportError"]>(
		(error) => {
			dispatch(alert(error));
		},
		[dispatch],
	);
	const requestDiceRoll = useCallback<SidebarRuntime["requestDiceRoll"]>(
		(request) => {
			dispatch(requestDiceRollAction(request));
		},
		[dispatch],
	);
	const requestRulesReferenceNavigation = useCallback<
		SidebarRuntime["requestRulesReferenceNavigation"]
	>(
		(tab, name, options) => {
			dispatch(requestRulesReferenceNavigationAction(tab, name, options));
		},
		[dispatch],
	);
	const setCampaigns = useCallback<SidebarRuntime["setCampaigns"]>(
		(nextCampaigns) => {
			dispatch(setCampaignsAction(nextCampaigns));
		},
		[dispatch],
	);
	const setLanguage = useCallback<SidebarRuntime["setLanguage"]>(
		(language) => {
			dispatch(setLanguageAction(language));
		},
		[dispatch],
	);
	const patchUiSettings = useCallback<SidebarRuntime["patchUiSettings"]>(
		(patch) => {
			dispatch(setUiSettingsAction(patch));
		},
		[dispatch],
	);
	const runtime = useMemo<SidebarRuntime>(
		() => ({
			activeCampaignSlug,
			activeEncounterId,
			activeSessionFileName,
			autoApplyAiChanges,
			availableLanguages,
			currentLanguage,
			currentTheme,
			patchUiSettings,
			rolledResult,
			setCampaigns,
			setLanguage,
			simplifiedNotesEnabled,
			storedAiBasePrompt,
			storedCampaignAiBasePrompts,
			storedCampaignImagePromptBasePrompts,
			storedCampaigns: campaigns,
			storedIgnoreSourcesList,
			storedImagePromptBasePrompt,
			useSearchDebounce,
			closeModal,
			openModal,
			reportError,
			requestDiceRoll,
			requestRulesReferenceNavigation,
		}),
		[
			activeCampaignSlug,
			activeEncounterId,
			activeSessionFileName,
			autoApplyAiChanges,
			availableLanguages,
			campaigns,
			closeModal,
			currentLanguage,
			currentTheme,
			openModal,
			patchUiSettings,
			reportError,
			requestDiceRoll,
			requestRulesReferenceNavigation,
			rolledResult,
			setCampaigns,
			setLanguage,
			simplifiedNotesEnabled,
			storedAiBasePrompt,
			storedCampaignAiBasePrompts,
			storedCampaignImagePromptBasePrompts,
			storedIgnoreSourcesList,
			storedImagePromptBasePrompt,
			useSearchDebounce,
		],
	);

	return (
		<SidebarRuntimeProvider runtime={runtime}>
			{children}
		</SidebarRuntimeProvider>
	);
}
