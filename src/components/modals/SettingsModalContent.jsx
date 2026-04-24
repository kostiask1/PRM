import { setLanguageAction, setUiSettingsAction } from "../../actions/app";
import { api } from "../../api";
import { lang } from "../../services/localization";
import { THEMES } from "../../services/uiSettings";
import { useAppDispatch, useAppSelector } from "../../store/appStore";
import "../../assets/components/SettingsModal.css";
import Button from "../form/Button";
import Select from "../form/Select";
import Switch from "../form/Switch";
import ColorThemeSwitcher from "../ColorThemeSwitcher";

export default function SettingsModalContent({ onCancel }) {
	const dispatch = useAppDispatch();
	const currentLanguage = useAppSelector((state) => state.localization.language);
	const availableLanguages = useAppSelector(
		(state) => state.localization.availableLanguages,
	);
	const currentTheme = useAppSelector((state) => state.ui.theme);
	const simplifiedNotesEnabled = useAppSelector(
		(state) => state.ui.simplifiedNotes,
	);

	const patchSettings = async (payload) => {
		try {
			await api.updateSettings(payload);
		} catch (error) {
			console.error("Failed to save settings", error);
		}
	};

	const handleThemeToggle = () => {
		const nextTheme =
			currentTheme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
		dispatch(
			setUiSettingsAction({
				theme: nextTheme,
				simplifiedNotes: simplifiedNotesEnabled,
			}),
		);
		patchSettings({ theme: nextTheme });
	};

	const handleLanguageChange = (language) => {
		dispatch(setLanguageAction(language));
		patchSettings({ language });
	};

	const handleSimplifiedNotesChange = (enabled) => {
		dispatch(
			setUiSettingsAction({
				theme: currentTheme,
				simplifiedNotes: enabled,
			}),
		);
		patchSettings({ simplifiedNotes: enabled });
	};

	return (
		<div className="SettingsModal">
			<div className="SettingsModal__group">
				<h4 className="SettingsModal__title">{lang.t("General")}</h4>

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

				<Switch
					checked={simplifiedNotesEnabled}
					onChange={handleSimplifiedNotesChange}
					label={lang.t("Simplified notes mode")}
					description={lang.t(
						"Use plain text notes without title and markdown preview",
					)}
				/>
			</div>

			<div className="SettingsModal__actions">
				<Button variant="ghost" onClick={onCancel}>
					{lang.t("Close")}
				</Button>
			</div>
		</div>
	);
}
