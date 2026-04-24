export const THEMES = Object.freeze({
	LIGHT: "light",
	DARK: "dark",
});

export function normalizeTheme(theme) {
	return theme === THEMES.DARK ? THEMES.DARK : THEMES.LIGHT;
}

export function applyTheme(theme) {
	if (typeof document === "undefined") return;
	document.documentElement.setAttribute("data-theme", normalizeTheme(theme));
}
