import { useState, useEffect } from "react";
import Icon from "./common/Icon";
import Tooltip from "./common/Tooltip";
import "../assets/components/ColorThemeSwitcher.css";

const THEME_STORAGE_KEY = "app-theme";

export default function ColorThemeSwitcher() {
	const [theme, setTheme] = useState(() => {
		// Ініціалізація теми: спочатку з localStorage, потім з системних налаштувань
		const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
		if (storedTheme) {
			return storedTheme;
		}
		// Перевірка системних налаштувань
		return window.matchMedia("(prefers-color-scheme: dark)").matches
			? "dark"
			: "light";
	});

	useEffect(() => {
		// Застосування теми до кореневого елемента документа та збереження в localStorage
		document.documentElement.setAttribute("data-theme", theme);
		localStorage.setItem(THEME_STORAGE_KEY, theme);
	}, [theme]);

	useEffect(() => {
		// Слухач для зміни системної теми
		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
		const handleChange = (e) => {
			// Оновлюємо тему, тільки якщо користувач не обрав її вручну (тобто немає в localStorage)
			if (!localStorage.getItem(THEME_STORAGE_KEY)) {
				setTheme(e.matches ? "dark" : "light");
			}
		};
		mediaQuery.addEventListener("change", handleChange);
		return () => mediaQuery.removeEventListener("change", handleChange);
	}, []);

	const toggleTheme = () => {
		setTheme((prevTheme) => (prevTheme === "light" ? "dark" : "light"));
	};

	return (
		<Tooltip
			content={
				theme === "light"
					? "Перемкнути на темну тему"
					: "Перемкнути на світлу тему"
			}
		>
			<button className="ColorThemeSwitcher" onClick={toggleTheme}>
				<Icon name={theme === "light" ? "moon" : "sun"} size={20} />
			</button>
		</Tooltip>
	);
}
