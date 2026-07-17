import { lang } from "../../../shared/lib/index.js";
import { formatSourceLabel } from "./sourceNames.ts";

export interface SpellMetaRecord extends Record<string, unknown> {
	level_int?: string | number;
	level?: string | number;
	school?: string;
	source?: string;
}

function getSpellLevelLabel(spell: SpellMetaRecord = {}): string {
	const level =
		spell.level_int !== undefined
			? spell.level_int
			: spell.level !== undefined
				? spell.level
				: "";
	if (level === 0 || String(level) === "0") return lang.t("Cantrip");
	return level !== "" ? lang.t("Level {level}", { level }) : "";
}

export function getSpellMeta(
	spell: SpellMetaRecord = {},
	separator = " - ",
): string {
	return [
		getSpellLevelLabel(spell),
		spell.school,
		formatSourceLabel(spell.source),
	]
		.filter(Boolean)
		.join(separator);
}
