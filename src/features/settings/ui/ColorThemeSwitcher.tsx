import "../../../assets/components/ColorThemeSwitcher.css";
import { lang } from "../../../shared/lib/index.js";
import { Icon, Tooltip } from "../../../shared/ui/index.js";
import {
	THEMES,
	getNextTheme,
	getThemeToggleIcon,
	type Theme,
} from "../model/theme.ts";

export interface ColorThemeSwitcherProps {
	theme: Theme;
	onToggle: (theme: Theme) => void;
}

export default function ColorThemeSwitcher({
	theme: currentTheme,
	onToggle,
}: ColorThemeSwitcherProps) {
	const handleToggle = () => {
		const nextTheme = getNextTheme(currentTheme);
		onToggle(nextTheme);
	};

	return (
		<Tooltip
			content={
				currentTheme === THEMES.LIGHT
					? lang.t("Switch to dark theme")
					: lang.t("Switch to light theme")
			}
		>
			<button type="button" className="ColorThemeSwitcher" aria-label={currentTheme === THEMES.LIGHT ? lang.t("Switch to dark theme") : lang.t("Switch to light theme")} onClick={handleToggle}>
				<Icon name={getThemeToggleIcon(currentTheme)} size={20} />
			</button>
		</Tooltip>
	);
}
