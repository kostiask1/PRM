const storage = require("./storage");
const {
	coerceAiText: asText,
	sanitizeAiName: sanitizeMonsterName,
} = require("./ai/textUtils");
const { stripMentionBrackets } = require("../shared/bestiaryUtils.cjs");

function hasOwn(value, key) {
	return Boolean(
		value &&
		typeof value === "object" &&
		Object.prototype.hasOwnProperty.call(value, key),
	);
}

function normalizeMonsterSize(value) {
	const sizeMap = {
		tiny: "T",
		small: "S",
		medium: "M",
		large: "L",
		huge: "H",
		gargantuan: "G",
	};
	const values = Array.isArray(value) ? value : [value || "M"];
	const normalized = values
		.map((item) => {
			const text = asText(item);
			if (!text) return "";
			const upper = text.toUpperCase();
			return ["T", "S", "M", "L", "H", "G"].includes(upper)
				? upper
				: sizeMap[text.toLowerCase()] || "M";
		})
		.filter(Boolean);
	return normalized.length > 0 ? normalized : ["M"];
}

function normalizeMonsterNumber(value, fallback) {
	const parsed = Number.parseInt(String(value ?? fallback), 10);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeMonsterStringArray(value) {
	if (value === undefined || value === null || value === "") return [];
	return (Array.isArray(value) ? value : [value])
		.map((item) => asText(item))
		.filter(Boolean);
}

function normalizeMonsterCr(value) {
	if (value && typeof value === "object" && !Array.isArray(value)) {
		return value;
	}
	return asText(value) || "1";
}

function normalizeMonsterTypedObject(value) {
	if (value && typeof value === "object" && !Array.isArray(value)) {
		return value;
	}
	const text = asText(value).toLowerCase();
	return text || "monstrosity";
}

function normalizeMonsterAc(value) {
	if (Array.isArray(value) && value.length > 0) {
		return value
			.map((entry) => {
				if (entry && typeof entry === "object") {
					return {
						...entry,
						ac: normalizeMonsterNumber(entry.ac, 10),
					};
				}
				return { ac: normalizeMonsterNumber(entry, 10) };
			})
			.filter((entry) => Number.isFinite(entry.ac));
	}
	if (value && typeof value === "object") {
		return [{ ...value, ac: normalizeMonsterNumber(value.ac, 10) }];
	}
	return [{ ac: normalizeMonsterNumber(value, 10) }];
}

function normalizeMonsterHp(value) {
	if (value && typeof value === "object" && !Array.isArray(value)) {
		const next = { ...value };
		if (hasOwn(next, "average")) {
			next.average = normalizeMonsterNumber(next.average, 1);
		}
		return next;
	}
	return {
		average: normalizeMonsterNumber(value, 1),
		formula: "",
	};
}

function normalizeMonsterSpeed(value) {
	if (value && typeof value === "object" && !Array.isArray(value)) {
		return value;
	}
	const walk = normalizeMonsterNumber(value, 30);
	return { walk };
}

function normalizeMonsterEntry(entry) {
	if (typeof entry === "string") {
		const text = entry.trim();
		return text ? { name: "", entries: [text] } : null;
	}
	if (!entry || typeof entry !== "object") return null;
	const name = asText(entry.name || entry.title);
	const entries = Array.isArray(entry.entries)
		? entry.entries
		: entry.text || entry.description || entry.content
			? [String(entry.text || entry.description || entry.content)]
			: [];
	return {
		...entry,
		name,
		entries,
	};
}

function normalizeMonsterEntries(value) {
	return (Array.isArray(value) ? value : [])
		.map(normalizeMonsterEntry)
		.filter((entry) => entry && entry.entries.length > 0);
}

function copyMonsterObjectField(target, raw, key) {
	if (raw[key] && typeof raw[key] === "object") {
		target[key] = raw[key];
	}
}

function normalizeCustomMonster(raw) {
	if (!raw || typeof raw !== "object") return null;
	const name = sanitizeMonsterName(raw.name || raw.title);
	if (!name) return null;

	const monster = {
		id: asText(raw.id) || storage.createId(),
		name,
		source: storage.CUSTOM_BESTIARY_SOURCE || "CUSTOM",
		size: normalizeMonsterSize(raw.size),
		type: normalizeMonsterTypedObject(raw.type),
		alignment: normalizeMonsterStringArray(raw.alignment).length
			? normalizeMonsterStringArray(raw.alignment)
			: ["N"],
		ac: normalizeMonsterAc(raw.ac ?? raw.armor_class),
		hp: normalizeMonsterHp(raw.hp ?? raw.hit_points),
		speed: normalizeMonsterSpeed(raw.speed),
		str: normalizeMonsterNumber(raw.str ?? raw.strength, 10),
		dex: normalizeMonsterNumber(raw.dex ?? raw.dexterity, 10),
		con: normalizeMonsterNumber(raw.con ?? raw.constitution, 10),
		int: normalizeMonsterNumber(raw.int ?? raw.intelligence, 10),
		wis: normalizeMonsterNumber(raw.wis ?? raw.wisdom, 10),
		cha: normalizeMonsterNumber(raw.cha ?? raw.charisma, 10),
		cr: normalizeMonsterCr(raw.cr ?? raw.challenge_rating),
	};
	const imageUrl = asText(raw.imageUrl);
	if (imageUrl) monster.imageUrl = imageUrl;
	const originalBestiaryName = sanitizeMonsterName(raw.originalBestiaryName);
	if (originalBestiaryName) monster.originalBestiaryName = originalBestiaryName;

	for (const key of [
		"save",
		"skill",
		"spellcasting",
		"traitTags",
		"actionTags",
		"languageTags",
		"senseTags",
		"miscTags",
	]) {
		copyMonsterObjectField(monster, raw, key);
	}

	for (const key of [
		"senses",
		"languages",
		"resist",
		"immune",
		"vulnerable",
		"conditionImmune",
	]) {
		const values = normalizeMonsterStringArray(raw[key]);
		if (values.length > 0) monster[key] = values;
	}

	for (const key of ["trait", "action", "bonus", "reaction", "legendary"]) {
		const entries = normalizeMonsterEntries(raw[key]);
		if (entries.length > 0) monster[key] = entries;
	}

	return stripMentionBrackets(monster);
}

module.exports = {
	normalizeCustomMonster,
};
