import "../../../assets/components/ColorThemeSwitcher.css";
import { lang } from "../../../shared/lib/index.js";
import {
	setUiSettingsAction,
	useAppDispatch,
	useAppSelector,
} from "../../../shared/model/index.js";
import { Icon, Tooltip } from "../../../shared/ui/index.js";
import {
	THEMES,
	getNextTheme,
	getThemeToggleIcon,
	settingsApi,
	type Theme,
} from "../index.js";

export interface ColorThemeSwitcherProps {
	theme?: Theme;
	onToggle?: (theme: Theme) => void;
}

export default function ColorThemeSwitcher({
	theme: controlledTheme,
	onToggle,
}: ColorThemeSwitcherProps) {
	const dispatch = useAppDispatch();
	const storeTheme = useAppSelector((state) => state.ui.theme);
	const currentTheme = controlledTheme || storeTheme;

	const handleToggle = () => {
		const nextTheme = getNextTheme(currentTheme);

		if (onToggle) {
			onToggle(nextTheme);
			return;
		}

		dispatch(setUiSettingsAction({ theme: nextTheme }));
		void settingsApi
			.updateSettings({ theme: nextTheme })
			.catch((error: unknown) =>
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
				<Icon name={getThemeToggleIcon(currentTheme)} size={20} />
			</button>
		</Tooltip>
	);
}
