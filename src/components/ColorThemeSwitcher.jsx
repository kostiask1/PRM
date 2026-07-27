import { setUiSettingsAction } from "../entities/settings/model.js";
import { settingsApi } from "../entities/settings/api.js";
import { lang, THEMES } from "../shared/config/index.js";
import { useAppDispatch, useAppSelector } from "../shared/lib/index.js";
import "../assets/components/ColorThemeSwitcher.css";
import Icon from "./common/Icon";
import Tooltip from "./common/Tooltip";

export default function ColorThemeSwitcher({
	theme: controlledTheme,
	onToggle,
}) {
	const dispatch = useAppDispatch();
	const storeTheme = useAppSelector((state) => state.ui.theme);
	const currentTheme = controlledTheme || storeTheme;

	const handleToggle = () => {
		const nextTheme = currentTheme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;

		if (typeof onToggle === "function") {
			onToggle(nextTheme);
			return;
		}

		dispatch(setUiSettingsAction({ theme: nextTheme }));
		settingsApi
			.update({ theme: nextTheme })
			.catch((error) => console.error("Failed to save theme setting", error));
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
