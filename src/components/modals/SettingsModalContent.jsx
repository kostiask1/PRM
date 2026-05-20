import { useEffect, useMemo, useState } from "react";
import { setLanguageAction, setUiSettingsAction } from "../../actions/app";
import { api } from "../../api";
import { lang } from "../../services/localization";
import { THEMES } from "../../services/uiSettings";
import { useAppDispatch, useAppSelector } from "../../store/appStore";
import "../../assets/components/SettingsModal.css";
import Button from "../form/Button";
import Input from "../form/Input";
import Select from "../form/Select";
import Switch from "../form/Switch";
import ColorThemeSwitcher from "../ColorThemeSwitcher";

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
	const storedCampaignAiBasePrompts = useAppSelector(
		(state) => state.ui.campaignAiBasePrompts || {},
	);
	const [aiBasePrompt, setAiBasePrompt] = useState(storedAiBasePrompt);
	const [campaignAiBasePrompts, setCampaignAiBasePrompts] = useState(
		storedCampaignAiBasePrompts,
	);
	const [selectedCampaignSlug, setSelectedCampaignSlug] = useState(
		activeCampaignSlug || campaigns[0]?.slug || "",
	);
	const [promptStatus, setPromptStatus] = useState("idle");

	useEffect(() => {
		setAiBasePrompt(storedAiBasePrompt);
	}, [storedAiBasePrompt]);

	useEffect(() => {
		setCampaignAiBasePrompts(storedCampaignAiBasePrompts);
	}, [storedCampaignAiBasePrompts]);

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

	const handleCampaignPromptChange = (value) => {
		setCampaignAiBasePrompts((current) => ({
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
		const payload = {
			aiBasePrompt,
			campaignAiBasePrompts: nextCampaignPrompts,
		};

		setPromptStatus("saving");
		try {
			const saved = await api.updateSettings(payload);
			const nextUiSettings = {
				aiBasePrompt: saved.aiBasePrompt,
				campaignAiBasePrompts: saved.campaignAiBasePrompts,
			};
			dispatch(setUiSettingsAction(nextUiSettings));
			setAiBasePrompt(nextUiSettings.aiBasePrompt || "");
			setCampaignAiBasePrompts(nextUiSettings.campaignAiBasePrompts || {});
			setPromptStatus("saved");
		} catch (error) {
			console.error("Failed to save AI base prompts", error);
			setPromptStatus("error");
		}
	};

	return (
		<div className="SettingsModal">
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
			</div>

			<div className="SettingsModal__group">
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
					<Input
						type="textarea"
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
					<Input
						type="textarea"
						value={selectedCampaignPrompt}
						onChange={(event) => handleCampaignPromptChange(event.target.value)}
						placeholder={lang.t(
							"Example: This campaign is grounded, political, and low magic...",
						)}
						disabled={!selectedCampaignSlug}
					/>
				</label>
				{promptStatus === "saved" && (
					<div className="SettingsModal__status">
						{lang.t("Prompts saved")}
					</div>
				)}
				{promptStatus === "error" && (
					<div className="SettingsModal__status SettingsModal__status_error">
						{lang.t("Failed to save prompts")}
					</div>
				)}
			</div>

			<div className="SettingsModal__actions">
				<Button variant="ghost" onClick={onCancel}>
					{lang.t("Close")}
				</Button>
			</div>
		</div>
	);
}
