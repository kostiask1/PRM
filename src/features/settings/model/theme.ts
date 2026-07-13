export const THEMES = Object.freeze({
	LIGHT: "light",
	DARK: "dark",
});

export type Theme = (typeof THEMES)[keyof typeof THEMES];

function normalizeTheme(theme: unknown): Theme {
	return theme === THEMES.DARK ? THEMES.DARK : THEMES.LIGHT;
}

export function applyTheme(theme: unknown): void {
	if (typeof document === "undefined") return;
	document.documentElement.setAttribute("data-theme", normalizeTheme(theme));
}
