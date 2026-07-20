import { useEffect, useMemo, useState } from "react";
import { campaignApi } from "../../../entities/campaign/index.js";
import { bestiaryApi } from "../../../entities/bestiary/index.js";
import { spellApi } from "../../../entities/spell/index.js";
import {
	getIgnoreSourcesListFromSelectedSources,
	getSelectedSourcesFromIgnoreList,
	normalizeIgnoreSourcesList,
} from "../../../entities/reference/index.js";
import { lang } from "../../../shared/lib/index.js";
import {
	setCampaignsAction,
	setLanguageAction,
	setUiSettingsAction,
	useAppDispatch,
	useAppSelector,
} from "../../../shared/model/index.js";
import { settingsApi } from "../api/settingsApi.ts";
import {
	DEFAULT_IMAGE_PROMPT_BASE_PROMPT,
	GLOBAL_SETTINGS_SCOPE,
	buildCampaignIgnoreSourcesMap,
	buildPromptSettingsPayload,
	mergeContentSourceOptions,
	normalizeSavedIgnoreSources,
	normalizeSavedPromptSettings,
	normalizeSettingsCampaigns,
	resolveSelectedPromptSettings,
	resolveSelectedSourceSettings,
	resolveSettingsScope,
	setCampaignIgnoreSourcesForScope,
	setSettingsPromptForScope,
	type CampaignIgnoreSourcesMap,
	type SettingsPromptMap,
	type SettingsSaveStatus,
} from "../model/settingsModal.ts";
import { getNextTheme } from "../model/theme.ts";
import type { SettingsModalViewProps } from "./SettingsModalView.tsx";

function useSettingsScopeRecovery(options: {
	selectedScope: string;
	setSelectedScope: (scope: string) => void;
	activeCampaignSlug: string | null;
	campaigns: ReturnType<typeof normalizeSettingsCampaigns>;
}): void {
	const { selectedScope, setSelectedScope, activeCampaignSlug, campaigns } =
		options;
	useEffect(() => {
		const nextScope = resolveSettingsScope(
			selectedScope,
			activeCampaignSlug,
			campaigns,
		);
		if (nextScope !== selectedScope) setSelectedScope(nextScope);
	}, [activeCampaignSlug, campaigns, selectedScope, setSelectedScope]);
}

export function useSettingsModalController(
	onCancel: () => void,
): SettingsModalViewProps {
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
	const campaigns = useMemo(
		() => normalizeSettingsCampaigns(storedCampaigns),
		[storedCampaigns],
	);
	const activeCampaignSlug = useAppSelector(
		(state) => state.navigation.activeCampaignSlug,
	);
	const storedAiBasePrompt = useAppSelector(
		(state) => state.ui.aiBasePrompt || "",
	);
	const storedImagePromptBasePrompt = useAppSelector((state) =>
		state.ui.imagePromptBasePrompt === undefined
			? DEFAULT_IMAGE_PROMPT_BASE_PROMPT
			: state.ui.imagePromptBasePrompt,
	);
	const storedCampaignAiBasePrompts = useAppSelector(
		(state) => state.ui.campaignAiBasePrompts,
	);
	const storedCampaignImagePromptBasePrompts = useAppSelector(
		(state) => state.ui.campaignImagePromptBasePrompts,
	);
	const storedIgnoreSourcesList = useAppSelector(
		(state) => state.ui.ignoreSourcesList || [],
	);
	const autoApplyAiChanges = useAppSelector(
		(state) => state.ui.autoApplyAiChanges !== false,
	);
	const useSearchDebounce = useAppSelector(
		(state) => state.ui.useSearchDebounce !== false,
	);
	const [aiBasePrompt, setAiBasePrompt] = useState(storedAiBasePrompt);
	const [imagePromptBasePrompt, setImagePromptBasePrompt] = useState(
		storedImagePromptBasePrompt,
	);
	const [campaignAiBasePrompts, setCampaignAiBasePrompts] =
		useState<SettingsPromptMap>(storedCampaignAiBasePrompts);
	const [campaignImagePromptBasePrompts, setCampaignImagePromptBasePrompts] =
		useState<SettingsPromptMap>(storedCampaignImagePromptBasePrompts);
	const [ignoreSourcesList, setIgnoreSourcesList] = useState(
		storedIgnoreSourcesList,
	);
	const [campaignIgnoreSourcesLists, setCampaignIgnoreSourcesLists] =
		useState<CampaignIgnoreSourcesMap>({});
	const [sourceOptions, setSourceOptions] = useState<string[]>([]);
	const [selectedPromptScope, setSelectedPromptScope] = useState(
		activeCampaignSlug || GLOBAL_SETTINGS_SCOPE,
	);
	const [selectedSourceScope, setSelectedSourceScope] = useState(
		activeCampaignSlug || GLOBAL_SETTINGS_SCOPE,
	);
	const [promptStatus, setPromptStatus] =
		useState<SettingsSaveStatus>("idle");
	const [sourceStatus, setSourceStatus] =
		useState<SettingsSaveStatus>("idle");
	const [notification, setNotification] = useState<string | null>(null);

	useEffect(() => setAiBasePrompt(storedAiBasePrompt), [storedAiBasePrompt]);
	useEffect(
		() => setImagePromptBasePrompt(storedImagePromptBasePrompt),
		[storedImagePromptBasePrompt],
	);
	useEffect(
		() => setCampaignAiBasePrompts(storedCampaignAiBasePrompts),
		[storedCampaignAiBasePrompts],
	);
	useEffect(
		() =>
			setCampaignImagePromptBasePrompts(
				storedCampaignImagePromptBasePrompts,
			),
		[storedCampaignImagePromptBasePrompts],
	);
	useEffect(
		() => setIgnoreSourcesList(storedIgnoreSourcesList),
		[storedIgnoreSourcesList],
	);
	useEffect(
		() => setCampaignIgnoreSourcesLists(buildCampaignIgnoreSourcesMap(campaigns)),
		[campaigns],
	);
	useEffect(() => {
		const loadSourceOptions = async () => {
			try {
				const [bestiarySources, spellSources] = await Promise.all([
					bestiaryApi.getBestiarySources(),
					spellApi.getSpellSources(),
				]);
				setSourceOptions(
					mergeContentSourceOptions(bestiarySources, spellSources),
				);
			} catch (error) {
				console.error("Failed to load content sources", error);
			}
		};
		loadSourceOptions();
	}, []);

	useSettingsScopeRecovery({
		selectedScope: selectedPromptScope,
		setSelectedScope: setSelectedPromptScope,
		activeCampaignSlug,
		campaigns,
	});
	useSettingsScopeRecovery({
		selectedScope: selectedSourceScope,
		setSelectedScope: setSelectedSourceScope,
		activeCampaignSlug,
		campaigns,
	});

	const promptSelection = resolveSelectedPromptSettings({
		scope: selectedPromptScope,
		aiBasePrompt,
		imagePromptBasePrompt,
		campaignAiBasePrompts,
		campaignImagePromptBasePrompts,
	});
	const sourceSelection = resolveSelectedSourceSettings({
		scope: selectedSourceScope,
		ignoreSourcesList,
		campaignIgnoreSourcesLists,
	});
	const selectedSources = useMemo(
		() =>
			getSelectedSourcesFromIgnoreList(
				sourceOptions,
				sourceSelection.ignoreSourcesList,
			),
		[sourceOptions, sourceSelection.ignoreSourcesList],
	);

	const patchSettings = async (payload: Record<string, unknown>) => {
		try {
			await settingsApi.updateSettings(payload);
		} catch (error) {
			console.error("Failed to save settings", error);
		}
	};
	const handleThemeToggle = () => {
		const nextTheme = getNextTheme(currentTheme);
		dispatch(setUiSettingsAction({ theme: nextTheme }));
		patchSettings({ theme: nextTheme });
	};
	const handleLanguageChange = (language: string) => {
		dispatch(setLanguageAction(language));
		patchSettings({ language });
	};
	const handleSimplifiedNotesChange = (enabled: boolean) => {
		dispatch(setUiSettingsAction({ simplifiedNotes: enabled }));
		patchSettings({ simplifiedNotes: enabled });
	};
	const handleAutoApplyAiChangesChange = (enabled: boolean) => {
		dispatch(setUiSettingsAction({ autoApplyAiChanges: enabled }));
		patchSettings({ autoApplyAiChanges: enabled });
	};
	const handleUseSearchDebounceChange = (enabled: boolean) => {
		dispatch(setUiSettingsAction({ useSearchDebounce: enabled }));
		patchSettings({ useSearchDebounce: enabled });
	};
	const handleSelectedBasePromptChange = (value: string) => {
		if (promptSelection.isGlobalScope) setAiBasePrompt(value);
		else {
			setCampaignAiBasePrompts((current) =>
				setSettingsPromptForScope(current, selectedPromptScope, value),
			);
		}
		setPromptStatus("idle");
	};
	const handleSelectedImagePromptChange = (value: string) => {
		if (promptSelection.isGlobalScope) setImagePromptBasePrompt(value);
		else {
			setCampaignImagePromptBasePrompts((current) =>
				setSettingsPromptForScope(current, selectedPromptScope, value),
			);
		}
		setPromptStatus("idle");
	};
	const handleSelectedSourcesChange = (nextSelectedSources: string[]) => {
		const nextIgnoreSourcesList = getIgnoreSourcesListFromSelectedSources(
			sourceOptions,
			nextSelectedSources,
		);
		if (sourceSelection.isGlobalScope) {
			setIgnoreSourcesList(nextIgnoreSourcesList);
		} else {
			setCampaignIgnoreSourcesLists((current) =>
				setCampaignIgnoreSourcesForScope(
					current,
					selectedSourceScope,
					nextIgnoreSourcesList,
				),
			);
		}
		setSourceStatus("idle");
	};
	const handleCopyGlobalSourcesToCampaign = () => {
		if (sourceSelection.isGlobalScope || !selectedSourceScope) return;
		setCampaignIgnoreSourcesLists((current) =>
			setCampaignIgnoreSourcesForScope(
				current,
				selectedSourceScope,
				normalizeIgnoreSourcesList(ignoreSourcesList),
			),
		);
		setSourceStatus("idle");
	};
	const handleSavePrompts = async () => {
		const payload = buildPromptSettingsPayload({
			aiBasePrompt,
			imagePromptBasePrompt,
			campaignAiBasePrompts,
			campaignImagePromptBasePrompts,
		});
		setPromptStatus("saving");
		try {
			const saved = await settingsApi.updateSettings(payload);
			if (!saved) throw new Error("Settings response is empty");
			const nextUiSettings = normalizeSavedPromptSettings(saved);
			dispatch(setUiSettingsAction(nextUiSettings));
			setAiBasePrompt(nextUiSettings.aiBasePrompt);
			setImagePromptBasePrompt(nextUiSettings.imagePromptBasePrompt);
			setCampaignAiBasePrompts(nextUiSettings.campaignAiBasePrompts);
			setCampaignImagePromptBasePrompts(
				nextUiSettings.campaignImagePromptBasePrompts,
			);
			setPromptStatus("idle");
			setNotification(lang.t("Prompts saved"));
		} catch (error) {
			console.error("Failed to save AI base prompts", error);
			setPromptStatus("idle");
			setNotification(lang.t("Failed to save prompts"));
		}
	};
	const handleSaveSources = async () => {
		setSourceStatus("saving");
		try {
			if (sourceSelection.isGlobalScope) {
				const saved = await settingsApi.updateSettings({ ignoreSourcesList });
				if (!saved) throw new Error("Settings response is empty");
				const savedIgnoreSourcesList = normalizeSavedIgnoreSources(saved);
				dispatch(
					setUiSettingsAction({ ignoreSourcesList: savedIgnoreSourcesList }),
				);
				setIgnoreSourcesList(savedIgnoreSourcesList);
			} else if (selectedSourceScope) {
				await campaignApi.updateCampaign(selectedSourceScope, {
					ignoreSourcesList:
						campaignIgnoreSourcesLists[selectedSourceScope] || [],
				});
				const nextCampaigns = await campaignApi.listCampaigns();
				dispatch(setCampaignsAction(normalizeSettingsCampaigns(nextCampaigns)));
			}
			setSourceStatus("idle");
			setNotification(lang.t("Source settings saved"));
		} catch (error) {
			console.error("Failed to save source settings", error);
			setSourceStatus("idle");
			setNotification(lang.t("Failed to save source settings"));
		}
	};

	return {
		notification,
		onNotificationClose: () => setNotification(null),
		onCancel,
		general: {
			currentTheme,
			currentLanguage,
			availableLanguages,
			simplifiedNotesEnabled,
			useSearchDebounce,
			onThemeToggle: handleThemeToggle,
			onLanguageChange: handleLanguageChange,
			onSimplifiedNotesChange: handleSimplifiedNotesChange,
			onUseSearchDebounceChange: handleUseSearchDebounceChange,
		},
		sources: {
			campaigns,
			selectedScope: selectedSourceScope,
			isGlobalScope: sourceSelection.isGlobalScope,
			status: sourceStatus,
			options: sourceOptions,
			selectedSources,
			onScopeChange: setSelectedSourceScope,
			onSelectedSourcesChange: handleSelectedSourcesChange,
			onCopyGlobal: handleCopyGlobalSourcesToCampaign,
			onSave: handleSaveSources,
		},
		ai: {
			campaigns,
			selectedScope: selectedPromptScope,
			isGlobalScope: promptSelection.isGlobalScope,
			status: promptStatus,
			autoApplyAiChanges,
			basePrompt: promptSelection.basePrompt,
			imagePrompt: promptSelection.imagePrompt,
			onScopeChange: setSelectedPromptScope,
			onAutoApplyAiChangesChange: handleAutoApplyAiChangesChange,
			onBasePromptChange: handleSelectedBasePromptChange,
			onImagePromptChange: handleSelectedImagePromptChange,
			onSave: handleSavePrompts,
		},
	};
}
