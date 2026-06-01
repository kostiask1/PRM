import { useEffect, useMemo, useState } from "react";
import { setLanguageAction, setUiSettingsAction } from "../../actions/app";
import { api } from "../../api";
import { lang } from "../../services/localization";
import { THEMES } from "../../services/uiSettings";
import { useAppDispatch, useAppSelector } from "../../store/appStore";
import "../../assets/components/SettingsModal.css";
import Button from "../form/Button";
import EditableField from "../form/EditableField";
import Select from "../form/Select";
import Switch from "../form/Switch";
import ColorThemeSwitcher from "../ColorThemeSwitcher";
import Notification from "../common/Notification";

const DEFAULT_IMAGE_PROMPT_BASE_PROMPT =
	"cinematic, photorealistic, ultra realistic, high detail, 8k, dramatic lighting, volumetric light, sharp focus, depth of field, film still, concept art";

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
	const storedImagePromptBasePrompt = useAppSelector(
		(state) =>
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
	const [
		campaignImagePromptBasePrompts,
		setCampaignImagePromptBasePrompts,
	] = useState(storedCampaignImagePromptBasePrompts);
	const [selectedCampaignSlug, setSelectedCampaignSlug] = useState(
		activeCampaignSlug || campaigns[0]?.slug || "",
	);
	const [promptStatus, setPromptStatus] = useState("idle");
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
		if (
			selectedCampaignSlug &&
			campaigns.some((campaign) => campaign.slug === selectedCampaignSlug)
		) {
			return;
		}
		setSelectedCampaignSlug(activeCampaignSlug || campaigns[0]?.slug || "");
	}, [activeCampaignSlug, campaigns, selectedCampaignSlug]);

	const selectedCampaignPrompt = useMemo(
		() => campaignAiBasePrompts[selectedCampaignSlug] || "",
		[campaignAiBasePrompts, selectedCampaignSlug],
	);
	const selectedCampaignImagePrompt = useMemo(
		() => campaignImagePromptBasePrompts[selectedCampaignSlug] || "",
		[campaignImagePromptBasePrompts, selectedCampaignSlug],
	);

	const patchSettings = async (payload) => {
		try {
			await api.updateSettings(payload);
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
			[selectedCampaignSlug]: value,
		}));
		setPromptStatus("idle");
	};

	const handleCampaignImagePromptChange = (value) => {
		setCampaignImagePromptBasePrompts((current) => ({
			...current,
			[selectedCampaignSlug]: value,
		}));
		setPromptStatus("idle");
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
			const saved = await api.updateSettings(payload);
			const nextUiSettings = {
				aiBasePrompt: saved.aiBasePrompt,
				imagePromptBasePrompt: saved.imagePromptBasePrompt,
				campaignAiBasePrompts: saved.campaignAiBasePrompts,
				campaignImagePromptBasePrompts:
					saved.campaignImagePromptBasePrompts,
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
						{lang.t("Global base prompt")}
					</span>
					<EditableField
						type="textarea"
						className="SettingsModal__promptField"
						value={aiBasePrompt}
						onChange={(event) => {
							setAiBasePrompt(event.target.value);
							setPromptStatus("idle");
						}}
						placeholder={lang.t(
							"Example: Keep answers concise, prefer dark fantasy tone, avoid comic relief...",
						)}
					/>
				</label>

				<label className="SettingsModal__field">
					<span className="SettingsModal__label">
						{lang.t("Image prompt base style")}
					</span>
					<div className="SettingsModal__hint">
						{lang.t(
							"These style instructions are added to every image prompt generation request.",
						)}
					</div>
					<EditableField
						type="textarea"
						className="SettingsModal__promptField"
						value={imagePromptBasePrompt}
						onChange={(event) => {
							setImagePromptBasePrompt(event.target.value);
							setPromptStatus("idle");
						}}
						placeholder={DEFAULT_IMAGE_PROMPT_BASE_PROMPT}
					/>
				</label>

				<label className="SettingsModal__field">
					<span className="SettingsModal__label">
						{lang.t("Campaign base prompt")}
					</span>
					<Select
						value={selectedCampaignSlug}
						onChange={(event) => setSelectedCampaignSlug(event.target.value)}
					>
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
						value={selectedCampaignPrompt}
						onChange={(event) => handleCampaignPromptChange(event.target.value)}
						placeholder={lang.t(
							"Example: This campaign is grounded, political, and low magic...",
						)}
						disabled={!selectedCampaignSlug}
					/>
				</label>

				<label className="SettingsModal__field">
					<span className="SettingsModal__label">
						{lang.t("Campaign image prompt style")}
					</span>
					<div className="SettingsModal__hint">
						{lang.t(
							"Used instead of the global image style for this campaign.",
						)}
					</div>
					<EditableField
						type="textarea"
						className="SettingsModal__promptField"
						value={selectedCampaignImagePrompt}
						onChange={(event) =>
							handleCampaignImagePromptChange(event.target.value)
						}
						placeholder={lang.t(
							"Example: gothic oil painting, muted colors, candlelight, worn parchment textures...",
						)}
						disabled={!selectedCampaignSlug}
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
