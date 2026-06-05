import { lang } from "../services/localization";
import { formatSourceLabel } from "./sourceNames.js";

function getSpellLevelLabel(spell = {}) {
	const level =
		spell.level_int !== undefined
			? spell.level_int
			: spell.level !== undefined
				? spell.level
				: "";
	if (level === 0 || String(level) === "0") return lang.t("Cantrip");
	return level !== "" ? lang.t("Level {level}", { level }) : "";
}

export function getSpellMeta(spell = {}, separator = " - ") {
	return [
		getSpellLevelLabel(spell),
		spell.school,
		formatSourceLabel(spell.source),
	]
		.filter(Boolean)
		.join(separator);
}
