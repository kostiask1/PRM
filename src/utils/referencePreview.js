import { api } from "../api.js";
import { loadConditionsMap, normalizeConditionName } from "./conditions.js";

const spellCache = new Map();

function normalizeSpellName(name) {
	return String(name || "")
		.split("|")[0]
		.trim()
		.toLowerCase();
}

function flattenText(value, acc = []) {
	if (!value) return acc;
	if (typeof value === "string") {
		acc.push(value);
		return acc;
	}
	if (Array.isArray(value)) {
		for (const item of value) flattenText(item, acc);
		return acc;
	}
	if (typeof value === "object") {
		if (value.name && typeof value.name === "string") acc.push(value.name);
		if (value.entry) flattenText(value.entry, acc);
		if (value.entries) flattenText(value.entries, acc);
		if (value.items) flattenText(value.items, acc);
	}
	return acc;
}

function stripTags(text) {
	return String(text || "")
		.replace(/\{@([^\s}]+)\s+([^|}]+)(?:\|[^}]*)?}/g, "$2")
		.replace(/\s+/g, " ")
		.trim();
}

export function buildPreviewText(content) {
	const joined = flattenText(content).map(stripTags).join(" ");
	if (!joined) return "";
	return joined;
}

function formatSpellTimeUnit(unit) {
	const normalized = String(unit || "").toLowerCase();
	const map = {
		action: "Дія",
		bonus: "Бонусна дія",
		"bonus action": "Бонусна дія",
		reaction: "Реакція",
		round: "Раунд",
		minute: "Хв",
		hour: "Год",
	};
	return map[normalized] || unit;
}

function formatSpellDistance(distance) {
	if (!distance) return "";
	const type = String(distance.type || "").toLowerCase();
	const amount = distance.amount;
	if (type === "feet") return amount ? `${amount} фт.` : "фт.";
	if (type === "miles") return amount ? `${amount} мил.` : "мил.";
	if (amount) return `${amount} ${distance.type}`;
	return String(distance.type || "");
}

function formatSpellRange(range) {
	if (!range) return "";
	const rangeType = String(range.type || "").toLowerCase();
	const distanceLabel = formatSpellDistance(range.distance);

	if (rangeType === "radius") {
		return distanceLabel ? `Радіус: ${distanceLabel}` : "Радіус";
	}

	if (rangeType === "sphere") {
		return distanceLabel ? `Сфера: ${distanceLabel}` : "Сфера";
	}

	if (rangeType === "cone") {
		return distanceLabel ? `Конус: ${distanceLabel}` : "Конус";
	}

	if (rangeType === "line") {
		return distanceLabel ? `Лінія: ${distanceLabel}` : "Лінія";
	}

	if (rangeType === "point") {
		return distanceLabel ? `Дистанція: ${distanceLabel}` : "Точка";
	}

	if (distanceLabel) return distanceLabel;
	return String(range.type || "");
}

export function buildSpellTooltipMeta(spell) {
	const parts = [];
	const spellLevel = Number(spell?.level);
	if (Number.isFinite(spellLevel)) {
		parts.push(spellLevel === 0 ? "Замовляння" : `${spellLevel}-й рівень`);
	}
	if (spell?.school) {
		parts.push(String(spell.school));
	}

	const firstTime = Array.isArray(spell?.time) ? spell.time[0] : null;
	if (firstTime?.unit) {
		parts.push(formatSpellTimeUnit(firstTime.unit));
	}

	const rangeLabel = formatSpellRange(spell?.range);
	if (rangeLabel) {
		parts.push(rangeLabel);
	}

	return parts.join(" • ");
}

export async function getSpellByName(name) {
	const key = normalizeSpellName(name);
	if (!key) return null;
	if (spellCache.has(key)) return spellCache.get(key);
	const results = await api.searchSpells({ name: key });
	const spell =
		results.find((item) => normalizeSpellName(item.name) === key) ||
		results[0] ||
		null;
	if (spell) spellCache.set(key, spell);
	return spell;
}

export async function getConditionByName(name) {
	const map = await loadConditionsMap();
	return map.get(normalizeConditionName(name)) || null;
}
