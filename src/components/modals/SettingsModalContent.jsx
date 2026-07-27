import { useEffect, useMemo, useState } from "react";
import {
	setLanguageAction,
	setUiSettingsAction,
} from "../../entities/settings/model.js";
import { setCampaignsAction } from "../../entities/campaign/model.js";
import { settingsApi } from "../../entities/settings/api.js";
import { bestiaryApi } from "../../entities/bestiary/api.js";
import { campaignApi } from "../../entities/campaign/api.js";
import { spellApi } from "../../entities/spell/api.js";
import { lang, THEMES } from "../../shared/config/index.js";
import { useAppDispatch, useAppSelector } from "../../shared/lib/index.js";
import "../../assets/components/SettingsModal.css";
import Button from "../form/Button";
import EditableField from "../form/EditableField";
import MultiSelect from "../form/MultiSelect";
import Select from "../form/Select";
import Switch from "../form/Switch";
import ColorThemeSwitcher from "../ColorThemeSwitcher";
import Notification from "../common/Notification";
import { formatSourceLabel } from "../../utils/sourceNames";
import {
	getIgnoreSourcesListFromSelectedSources,
	getSelectedSourcesFromIgnoreList,
	normalizeIgnoreSourcesList,
} from "../../utils/sourceIgnore";

const DEFAULT_IMAGE_PROMPT_BASE_PROMPT =
	"cinematic, photorealistic, ultra realistic, high detail, 8k, dramatic lighting, volumetric light, sharp focus, depth of field, film still, concept art";
const GLOBAL_PROMPT_SCOPE = "__global__";

export default function SettingsModalContent({ onCancel }) {
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
	const campaigns = useAppSelector((state) => state.campaigns.items);
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
		(state) => state.ui.campaignAiBasePrompts || {},
	);
	const storedCampaignImagePromptBasePrompts = useAppSelector(
		(state) => state.ui.campaignImagePromptBasePrompts || {},
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
	const [campaignAiBasePrompts, setCampaignAiBasePrompts] = useState(
		storedCampaignAiBasePrompts,
	);
	const [campaignImagePromptBasePrompts, setCampaignImagePromptBasePrompts] =
		useState(storedCampaignImagePromptBasePrompts);
	const [ignoreSourcesList, setIgnoreSourcesList] = useState(
		storedIgnoreSourcesList,
	);
	const [campaignIgnoreSourcesLists, setCampaignIgnoreSourcesLists] = useState(
		{},
	);
	const [sourceOptions, setSourceOptions] = useState([]);
	const [selectedPromptScope, setSelectedPromptScope] = useState(
		activeCampaignSlug || GLOBAL_PROMPT_SCOPE,
	);
	const [selectedSourceScope, setSelectedSourceScope] = useState(
		activeCampaignSlug || GLOBAL_PROMPT_SCOPE,
	);
	const [promptStatus, setPromptStatus] = useState("idle");
	const [sourceStatus, setSourceStatus] = useState("idle");
	const [notification, setNotification] = useState(null);

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
		setCampaignIgnoreSourcesLists(
			Object.fromEntries(
				campaigns
					.filter((campaign) => Array.isArray(campaign.ignoreSourcesList))
					.map((campaign) => [
						campaign.slug,
						normalizeIgnoreSourcesList(campaign.ignoreSourcesList),
					]),
			),
		);
	}, [campaigns]);

	useEffect(() => {
		const loadSourceOptions = async () => {
			try {
				const [bestiarySources, spellSources] = await Promise.all([
					bestiaryApi.getSources(),
					spellApi.getSources(),
				]);
				const nextSources = Array.from(
					new Set([
						"CUSTOM",
						...(Array.isArray(bestiarySources) ? bestiarySources : []),
						...(Array.isArray(spellSources) ? spellSources : []),
					]),
				)
					.map((source) => String(source || "").trim())
					.filter(Boolean)
					.sort((a, b) => a.localeCompare(b));
				setSourceOptions(nextSources);
			} catch (error) {
				console.error("Failed to load content sources", error);
			}
		};
		loadSourceOptions();
	}, []);

	useEffect(() => {
		if (selectedPromptScope === GLOBAL_PROMPT_SCOPE) return;
		if (
			selectedPromptScope &&
			campaigns.some((campaign) => campaign.slug === selectedPromptScope)
		) {
			return;
		}
		setSelectedPromptScope(activeCampaignSlug || GLOBAL_PROMPT_SCOPE);
	}, [activeCampaignSlug, campaigns, selectedPromptScope]);

	useEffect(() => {
		if (selectedSourceScope === GLOBAL_PROMPT_SCOPE) return;
		if (
			selectedSourceScope &&
			campaigns.some((campaign) => campaign.slug === selectedSourceScope)
		) {
			return;
		}
		setSelectedSourceScope(activeCampaignSlug || GLOBAL_PROMPT_SCOPE);
	}, [activeCampaignSlug, campaigns, selectedSourceScope]);

	const isGlobalPromptScope = selectedPromptScope === GLOBAL_PROMPT_SCOPE;
	const isGlobalSourceScope = selectedSourceScope === GLOBAL_PROMPT_SCOPE;

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

	const patchSettings = async (payload) => {
		try {
			await settingsApi.update(payload);
		} catch (error) {
			console.error("Failed to save settings", error);
		}
	};

	const handleThemeToggle = () => {
		const nextTheme = currentTheme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
		dispatch(setUiSettingsAction({ theme: nextTheme }));
		patchSettings({ theme: nextTheme });
	};

	const handleLanguageChange = (language) => {
		dispatch(setLanguageAction(language));
		patchSettings({ language });
	};

	const handleSimplifiedNotesChange = (enabled) => {
		dispatch(setUiSettingsAction({ simplifiedNotes: enabled }));
		patchSettings({ simplifiedNotes: enabled });
	};

	const handleAutoApplyAiChangesChange = (enabled) => {
		dispatch(setUiSettingsAction({ autoApplyAiChanges: enabled }));
		patchSettings({ autoApplyAiChanges: enabled });
	};

	const handleUseSearchDebounceChange = (enabled) => {
		dispatch(setUiSettingsAction({ useSearchDebounce: enabled }));
		patchSettings({ useSearchDebounce: enabled });
	};

	const handleCampaignPromptChange = (value) => {
		setCampaignAiBasePrompts((current) => ({
			...current,
			[selectedPromptScope]: value,
		}));
		setPromptStatus("idle");
	};

	const handleCampaignImagePromptChange = (value) => {
		setCampaignImagePromptBasePrompts((current) => ({
			...current,
			[selectedPromptScope]: value,
		}));
		setPromptStatus("idle");
	};

	const handleSelectedBasePromptChange = (value) => {
		if (isGlobalPromptScope) {
			setAiBasePrompt(value);
		} else {
			handleCampaignPromptChange(value);
		}
		setPromptStatus("idle");
	};

	const handleSelectedImagePromptChange = (value) => {
		if (isGlobalPromptScope) {
			setImagePromptBasePrompt(value);
		} else {
			handleCampaignImagePromptChange(value);
		}
		setPromptStatus("idle");
	};

	const handleSelectedSourcesChange = (nextSelectedSources) => {
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
		const nextCampaignPrompts = Object.fromEntries(
			Object.entries(campaignAiBasePrompts)
				.map(([slug, prompt]) => [slug, String(prompt || "")])
				.filter(([slug, prompt]) => slug && prompt.trim()),
		);
		const nextCampaignImagePrompts = Object.fromEntries(
			Object.entries(campaignImagePromptBasePrompts)
				.map(([slug, prompt]) => [slug, String(prompt || "")])
				.filter(([slug, prompt]) => slug && prompt.trim()),
		);
		const payload = {
			aiBasePrompt,
			imagePromptBasePrompt,
			campaignAiBasePrompts: nextCampaignPrompts,
			campaignImagePromptBasePrompts: nextCampaignImagePrompts,
		};

		setPromptStatus("saving");
		try {
			const saved = await settingsApi.update(payload);
			const nextUiSettings = {
				aiBasePrompt: saved.aiBasePrompt,
				imagePromptBasePrompt: saved.imagePromptBasePrompt,
				campaignAiBasePrompts: saved.campaignAiBasePrompts,
				campaignImagePromptBasePrompts: saved.campaignImagePromptBasePrompts,
			};
			dispatch(setUiSettingsAction(nextUiSettings));
			setAiBasePrompt(nextUiSettings.aiBasePrompt || "");
			setImagePromptBasePrompt(
				nextUiSettings.imagePromptBasePrompt === undefined
					? DEFAULT_IMAGE_PROMPT_BASE_PROMPT
					: nextUiSettings.imagePromptBasePrompt,
			);
			setCampaignAiBasePrompts(nextUiSettings.campaignAiBasePrompts || {});
			setCampaignImagePromptBasePrompts(
				nextUiSettings.campaignImagePromptBasePrompts || {},
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
				const saved = await settingsApi.update({ ignoreSourcesList });
				dispatch(
					setUiSettingsAction({
						ignoreSourcesList: saved.ignoreSourcesList,
					}),
				);
				setIgnoreSourcesList(saved.ignoreSourcesList || []);
			} else if (selectedSourceScope) {
				await campaignApi.updateCampaign(selectedSourceScope, {
					ignoreSourcesList:
						campaignIgnoreSourcesLists[selectedSourceScope] || [],
				});
				const nextCampaigns = await campaignApi.listCampaigns();
				dispatch(setCampaignsAction(nextCampaigns));
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
						<option value={GLOBAL_PROMPT_SCOPE}>
							{lang.t("Global source settings")}
						</option>
						{campaigns.length === 0 && (
							<option value="">{lang.t("No campaigns")}</option>
						)}
						{campaigns.map((campaign) => (
							<option key={campaign.slug} value={campaign.slug}>
								{campaign.name}
							</option>
						))}
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
						<option value={GLOBAL_PROMPT_SCOPE}>
							{lang.t("Global base prompt")}
						</option>
						{campaigns.length === 0 && (
							<option value="">{lang.t("No campaigns")}</option>
						)}
						{campaigns.map((campaign) => (
							<option key={campaign.slug} value={campaign.slug}>
								{campaign.name}
							</option>
						))}
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
