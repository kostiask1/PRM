import { setUiSettingsAction } from "../actions/app";
import { api } from "../api";
import { lang } from "../services/localization";
import { THEMES } from "../services/uiSettings";
import { useAppDispatch, useAppSelector } from "../store/appStore";
import "../assets/components/ColorThemeSwitcher.css";
import Icon from "./common/Icon";
import Tooltip from "./common/Tooltip";

export default function ColorThemeSwitcher({ theme: controlledTheme, onToggle }) {
	const dispatch = useAppDispatch();
	const storeTheme = useAppSelector((state) => state.ui.theme);
	const currentTheme = controlledTheme || storeTheme;

	const handleToggle = () => {
		const nextTheme =
			currentTheme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;

		if (typeof onToggle === "function") {
			onToggle(nextTheme);
			return;
		}

		dispatch(setUiSettingsAction({ theme: nextTheme }));
		api.updateSettings({ theme: nextTheme }).catch((error) =>
			console.error("Failed to save theme setting", error),
		);
	};

	return (
		<Tooltip
			content={
				currentTheme === THEMES.LIGHT
					? lang.t("Switch to dark theme")
					: lang.t("Switch to light theme")
			}
		>
			<button className="ColorThemeSwitcher" onClick={handleToggle}>
				<Icon name={currentTheme === THEMES.LIGHT ? "moon" : "sun"} size={20} />
			</button>
		</Tooltip>
	);
}
