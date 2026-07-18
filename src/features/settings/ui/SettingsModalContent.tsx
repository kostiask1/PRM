import { useEffect, useMemo, useState } from "react";
import {
	setCampaignsAction,
	setLanguageAction,
	setUiSettingsAction,
} from "../../../shared/model/index.js";
import { campaignApi } from "../../../entities/campaign/index.js";
import { bestiaryApi } from "../../../entities/bestiary/index.js";
import { spellApi } from "../../../entities/spell/index.js";
import { getNextTheme, settingsApi } from "../index.js";
import { lang } from "../../../shared/lib/index.js";
import { THEMES } from "../index.js";
import { useAppDispatch, useAppSelector } from "../../../shared/model/index.js";
import "../../../assets/components/SettingsModal.css";
import {
	Button,
	MultiSelect,
	Notification,
	Select,
	Switch,
} from "../../../shared/ui/index.js";
import { EditableField } from "../../editor/ui/index.js";
import ColorThemeSwitcher from "./ColorThemeSwitcher.tsx";
import CampaignScopeOptions from "./CampaignScopeOptions.tsx";
import { formatSourceLabel } from "../../../entities/reference/index.js";
import {
	getIgnoreSourcesListFromSelectedSources,
	getSelectedSourcesFromIgnoreList,
	normalizeIgnoreSourcesList,
} from "../../../entities/reference/index.js";
import {
	DEFAULT_IMAGE_PROMPT_BASE_PROMPT,
	GLOBAL_SETTINGS_SCOPE,
	buildCampaignIgnoreSourcesMap,
	buildPromptSettingsPayload,
	mergeContentSourceOptions,
	normalizeSavedIgnoreSources,
	normalizeSavedPromptSettings,
	normalizeSettingsCampaigns,
	resolveSettingsScope,
	setSettingsPromptForScope,
	type CampaignIgnoreSourcesMap,
	type SettingsPromptMap,
	type SettingsSaveStatus,
} from "../model/settingsModal.ts";

export interface SettingsModalContentProps {
	onCancel: () => void;
}

export default function SettingsModalContent({
	onCancel,
}: SettingsModalContentProps) {
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

	useEffect(() => {
		setAiBasePrompt(storedAiBasePrompt);
	}, [storedAiBasePrompt]);

	useEffect(() => {
		setImagePromptBasePrompt(storedImagePromptBasePrompt);
	}, [storedImagePromptBasePrompt]);

	useEffect(() => {
		setCampaignAiBasePrompts(storedCampaignAiBasePrompts);
	}, [storedCampaignAiBasePrompts]);

	useEffect(() => {
		setCampaignImagePromptBasePrompts(storedCampaignImagePromptBasePrompts);
	}, [storedCampaignImagePromptBasePrompts]);

	useEffect(() => {
		setIgnoreSourcesList(storedIgnoreSourcesList);
	}, [storedIgnoreSourcesList]);

	useEffect(() => {
		setCampaignIgnoreSourcesLists(buildCampaignIgnoreSourcesMap(campaigns));
	}, [campaigns]);

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

	useEffect(() => {
		const nextScope = resolveSettingsScope(
			selectedPromptScope,
			activeCampaignSlug,
			campaigns,
		);
		if (nextScope !== selectedPromptScope) setSelectedPromptScope(nextScope);
	}, [activeCampaignSlug, campaigns, selectedPromptScope]);

	useEffect(() => {
		const nextScope = resolveSettingsScope(
			selectedSourceScope,
			activeCampaignSlug,
			campaigns,
		);
		if (nextScope !== selectedSourceScope) setSelectedSourceScope(nextScope);
	}, [activeCampaignSlug, campaigns, selectedSourceScope]);

	const isGlobalPromptScope = selectedPromptScope === GLOBAL_SETTINGS_SCOPE;
	const isGlobalSourceScope = selectedSourceScope === GLOBAL_SETTINGS_SCOPE;

	const selectedCampaignPrompt = useMemo(
		() => campaignAiBasePrompts[selectedPromptScope] || "",
		[campaignAiBasePrompts, selectedPromptScope],
	);
	const selectedCampaignImagePrompt = useMemo(
		() => campaignImagePromptBasePrompts[selectedPromptScope] || "",
		[campaignImagePromptBasePrompts, selectedPromptScope],
	);
	const selectedBasePrompt = isGlobalPromptScope
		? aiBasePrompt
		: selectedCampaignPrompt;
	const selectedImagePrompt = isGlobalPromptScope
		? imagePromptBasePrompt
		: selectedCampaignImagePrompt;
	const selectedIgnoreSourcesList = isGlobalSourceScope
		? ignoreSourcesList
		: campaignIgnoreSourcesLists[selectedSourceScope] || ignoreSourcesList;
	const selectedSources = useMemo(
		() =>
			getSelectedSourcesFromIgnoreList(sourceOptions, selectedIgnoreSourcesList),
		[sourceOptions, selectedIgnoreSourcesList],
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

	const handleCampaignPromptChange = (value: string) => {
		setCampaignAiBasePrompts((current) =>
			setSettingsPromptForScope(current, selectedPromptScope, value),
		);
		setPromptStatus("idle");
	};

	const handleCampaignImagePromptChange = (value: string) => {
		setCampaignImagePromptBasePrompts((current) =>
			setSettingsPromptForScope(current, selectedPromptScope, value),
		);
		setPromptStatus("idle");
	};

	const handleSelectedBasePromptChange = (value: string) => {
		if (isGlobalPromptScope) {
			setAiBasePrompt(value);
		} else {
			handleCampaignPromptChange(value);
		}
		setPromptStatus("idle");
	};

	const handleSelectedImagePromptChange = (value: string) => {
		if (isGlobalPromptScope) {
			setImagePromptBasePrompt(value);
		} else {
			handleCampaignImagePromptChange(value);
		}
		setPromptStatus("idle");
	};

	const handleSelectedSourcesChange = (nextSelectedSources: string[]) => {
		const nextIgnoreSourcesList = getIgnoreSourcesListFromSelectedSources(
			sourceOptions,
			nextSelectedSources,
		);
		if (isGlobalSourceScope) {
			setIgnoreSourcesList(nextIgnoreSourcesList);
		} else {
			setCampaignIgnoreSourcesLists((current) => ({
				...current,
				[selectedSourceScope]: nextIgnoreSourcesList,
			}));
		}
		setSourceStatus("idle");
	};

	const handleCopyGlobalSourcesToCampaign = () => {
		if (isGlobalSourceScope || !selectedSourceScope) return;
		setCampaignIgnoreSourcesLists((current) => ({
			...current,
			[selectedSourceScope]: normalizeIgnoreSourcesList(ignoreSourcesList),
		}));
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
			if (isGlobalSourceScope) {
				const saved = await settingsApi.updateSettings({ ignoreSourcesList });
				if (!saved) throw new Error("Settings response is empty");
				const savedIgnoreSourcesList = normalizeSavedIgnoreSources(saved);
				dispatch(
					setUiSettingsAction({
						ignoreSourcesList: savedIgnoreSourcesList,
					}),
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

	return (
		<div className="SettingsModal">
			{notification && (
				<Notification
					message={notification}
					onClose={() => setNotification(null)}
				/>
			)}
			<div className="SettingsModal__group">
				<div className="SettingsModal__themeRow">
					<div className="SettingsModal__themeInfo">
						<div className="SettingsModal__label">{lang.t("Theme")}</div>
						<div className="SettingsModal__hint">
							{currentTheme === THEMES.DARK
								? lang.t("Switch to light theme")
								: lang.t("Switch to dark theme")}
						</div>
					</div>
					<ColorThemeSwitcher
						theme={currentTheme}
						onToggle={() => handleThemeToggle()}
					/>
				</div>

				<div className="SettingsModal__lang">
					<label className="SettingsModal__label">{lang.t("Language")}</label>
					<Select
						value={currentLanguage}
						onChange={(event) => handleLanguageChange(event.target.value)}
					>
						{availableLanguages.map((languageCode) => (
							<option key={languageCode} value={languageCode}>
								{languageCode === "uk"
									? lang.t("Ukrainian")
									: languageCode === "en"
										? lang.t("English")
										: languageCode.toUpperCase()}
							</option>
						))}
					</Select>
				</div>

				<Switch
					checked={simplifiedNotesEnabled}
					onChange={handleSimplifiedNotesChange}
					label={lang.t("Simplified notes mode")}
					description={lang.t(
						"Use plain text notes without title and markdown preview",
					)}
				/>
				<Switch
					checked={useSearchDebounce}
					onChange={handleUseSearchDebounceChange}
					label={lang.t("Use search debounce")}
					description={lang.t(
						"When disabled, search results update immediately while typing.",
					)}
				/>
			</div>

			<div className="SettingsModal__group SettingsModal__section">
				<div className="SettingsModal__promptHeader">
					<div>
						<div className="SettingsModal__label">
							{lang.t("Content sources")}
						</div>
						<div className="SettingsModal__hint">
							{lang.t(
								"Unchecked sources are hidden in Bestiary, Spells, and official tokens.",
							)}
						</div>
					</div>
					<Button
						variant="primary"
						onClick={handleSaveSources}
						disabled={sourceStatus === "saving"}
					>
						{sourceStatus === "saving"
							? lang.t("Saving...")
							: lang.t("Save sources")}
					</Button>
				</div>

				<div className="SettingsModal__field">
					<span className="SettingsModal__label">
						{lang.t("Visible sources")}
					</span>
					<Select
						value={selectedSourceScope}
						onChange={(event) => setSelectedSourceScope(event.target.value)}
					>
						<option value={GLOBAL_SETTINGS_SCOPE}>
							{lang.t("Global source settings")}
						</option>
						<CampaignScopeOptions campaigns={campaigns} />
					</Select>
					<div className="SettingsModal__sourceRow">
						<MultiSelect
							className="SettingsModal__sourceSelect"
							value={selectedSources}
							onChange={handleSelectedSourcesChange}
							optionClickMode="toggle"
							disabled={!isGlobalSourceScope && !selectedSourceScope}
							placeholder={lang.t("Sources")}
							allSelectedLabel={lang.t("All sources")}
							noneSelectedLabel={lang.t("No sources")}
							selectAllLabel={lang.t("Select all")}
							clearLabel={lang.t("Clear")}
							dropdownMinWidth={520}
							options={sourceOptions.map((source) => ({
								value: source,
								label:
									source === "CUSTOM"
										? lang.t("Custom creatures")
										: formatSourceLabel(source),
							}))}
						/>
						{!isGlobalSourceScope && selectedSourceScope && (
							<div className="SettingsModal__inlineActions">
								<Button
									variant="ghost"
									size={Button.SIZES.SMALL}
									onClick={handleCopyGlobalSourcesToCampaign}
								>
									{lang.t("Copy global settings")}
								</Button>
							</div>
						)}
					</div>
				</div>
			</div>

			<div className="SettingsModal__group SettingsModal__section SettingsModal__section_ai">
				<div className="SettingsModal__sectionHeader">
					<h3>{lang.t("AI settings")}</h3>
				</div>
				<Switch
					checked={autoApplyAiChanges}
					onChange={handleAutoApplyAiChangesChange}
					label={lang.t("Apply parsed AI changes automatically")}
					description={lang.t(
						"When disabled, parsed AI responses are saved as drafts for review before applying.",
					)}
				/>
				<div className="SettingsModal__promptHeader">
					<div>
						<div className="SettingsModal__label">
							{lang.t("AI base prompt")}
						</div>
						<div className="SettingsModal__hint">
							{lang.t(
								"These instructions are added to every future AI request.",
							)}
						</div>
					</div>
					<Button
						variant="primary"
						onClick={handleSavePrompts}
						disabled={promptStatus === "saving"}
					>
						{promptStatus === "saving"
							? lang.t("Saving...")
							: lang.t("Save prompts")}
					</Button>
				</div>

				<label className="SettingsModal__field">
					<span className="SettingsModal__label">
						{lang.t("AI base prompt")}
					</span>
					<Select
						value={selectedPromptScope}
						onChange={(event) => setSelectedPromptScope(event.target.value)}
					>
						<option value={GLOBAL_SETTINGS_SCOPE}>
							{lang.t("Global base prompt")}
						</option>
						<CampaignScopeOptions campaigns={campaigns} />
					</Select>
					<EditableField
						type="textarea"
						className="SettingsModal__promptField"
						value={selectedBasePrompt}
						onChange={(event) =>
							handleSelectedBasePromptChange(event.target.value)
						}
						placeholder={
							isGlobalPromptScope
								? lang.t(
										"Example: Keep answers concise, prefer dark fantasy tone, avoid comic relief...",
									)
								: lang.t(
										"Example: This campaign is grounded, political, and low magic...",
									)
						}
						disabled={!isGlobalPromptScope && !selectedPromptScope}
					/>
				</label>

				<label className="SettingsModal__field">
					<span className="SettingsModal__label">
						{lang.t("Image prompt base style")}
					</span>
					<div className="SettingsModal__hint">
						{isGlobalPromptScope
							? lang.t(
									"These style instructions are added to every image prompt generation request.",
								)
							: lang.t(
									"Used instead of the global image style for this campaign.",
								)}
					</div>
					<EditableField
						type="textarea"
						className="SettingsModal__promptField"
						value={selectedImagePrompt}
						onChange={(event) =>
							handleSelectedImagePromptChange(event.target.value)
						}
						placeholder={
							isGlobalPromptScope
								? DEFAULT_IMAGE_PROMPT_BASE_PROMPT
								: lang.t(
										"Example: gothic oil painting, muted colors, candlelight, worn parchment textures...",
									)
						}
						disabled={!isGlobalPromptScope && !selectedPromptScope}
					/>
				</label>
			</div>

			<div className="SettingsModal__actions">
				<Button variant="ghost" onClick={onCancel}>
					{lang.t("Close")}
				</Button>
			</div>
		</div>
	);
}
