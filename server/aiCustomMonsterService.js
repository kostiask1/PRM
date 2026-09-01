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

function isMonsterObjectValue(value) {
	return Boolean(value && typeof value === "object");
}

function isMonsterRecordValue(value) {
	return isMonsterObjectValue(value) && !Array.isArray(value);
}

function isEmptyMonsterStringListValue(value) {
	return value === undefined || value === null || value === "";
}

function getMonsterStringListSource(value) {
	return Array.isArray(value) ? value : [value];
}

function normalizeMonsterStringArray(value) {
	if (isEmptyMonsterStringListValue(value)) return [];
	return getMonsterStringListSource(value)
		.map((item) => asText(item))
		.filter(Boolean);
}

function normalizeMonsterCr(value) {
	if (isMonsterRecordValue(value)) return value;
	return asText(value) || "1";
}

function normalizeMonsterTypedObject(value) {
	if (isMonsterRecordValue(value)) return value;
	const text = asText(value).toLowerCase();
	return text || "monstrosity";
}

function normalizeMonsterAcEntry(entry) {
	if (isMonsterObjectValue(entry)) {
		return {
			...entry,
			ac: normalizeMonsterNumber(entry.ac, 10),
		};
	}
	return { ac: normalizeMonsterNumber(entry, 10) };
}

function normalizeMonsterAcArray(value) {
	return value
		.map(normalizeMonsterAcEntry)
		.filter((entry) => Number.isFinite(entry.ac));
}

function normalizeMonsterAc(value) {
	if (Array.isArray(value) && value.length > 0) {
		return normalizeMonsterAcArray(value);
	}
	if (isMonsterObjectValue(value)) {
		return [{ ...value, ac: normalizeMonsterNumber(value.ac, 10) }];
	}
	return [{ ac: normalizeMonsterNumber(value, 10) }];
}

function normalizeMonsterHpRecord(value) {
	const next = { ...value };
	if (hasOwn(next, "average")) {
		next.average = normalizeMonsterNumber(next.average, 1);
	}
	return next;
}

function normalizeMonsterHp(value) {
	if (isMonsterRecordValue(value)) return normalizeMonsterHpRecord(value);
	return {
		average: normalizeMonsterNumber(value, 1),
		formula: "",
	};
}

function normalizeMonsterSpeed(value) {
	if (isMonsterRecordValue(value)) return value;
	const walk = normalizeMonsterNumber(value, 30);
	return { walk };
}

function normalizeMonsterStringEntry(entry) {
	const text = entry.trim();
	return text ? { name: "", entries: [text] } : null;
}

function getMonsterEntryContent(entry) {
	return entry.text || entry.description || entry.content;
}

function normalizeMonsterEntryValues(entry) {
	if (Array.isArray(entry.entries)) return entry.entries;
	const content = getMonsterEntryContent(entry);
	return content ? [String(content)] : [];
}

function normalizeMonsterObjectEntry(entry) {
	const name = asText(entry.name || entry.title);
	return {
		...entry,
		name,
		entries: normalizeMonsterEntryValues(entry),
	};
}

function normalizeMonsterEntry(entry) {
	if (typeof entry === "string") return normalizeMonsterStringEntry(entry);
	return isMonsterObjectValue(entry) ? normalizeMonsterObjectEntry(entry) : null;
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

const CUSTOM_MONSTER_OBJECT_FIELDS = Object.freeze([
	"save",
	"skill",
	"spellcasting",
	"traitTags",
	"actionTags",
	"languageTags",
	"senseTags",
	"miscTags",
]);
const CUSTOM_MONSTER_STRING_LIST_FIELDS = Object.freeze([
	"senses",
	"languages",
	"resist",
	"immune",
	"vulnerable",
	"conditionImmune",
]);
const CUSTOM_MONSTER_ENTRY_FIELDS = Object.freeze([
	"trait",
	"action",
	"bonus",
	"reaction",
	"legendary",
]);

function isCustomMonsterInput(raw) {
	return Boolean(raw && typeof raw === "object");
}

function getCustomMonsterName(raw) {
	return sanitizeMonsterName(raw.name || raw.title);
}

function getCustomMonsterId(raw) {
	return asText(raw.id) || storage.createId();
}

function getCustomMonsterSource() {
	return storage.CUSTOM_BESTIARY_SOURCE || "CUSTOM";
}

function getCanonicalMonsterValue(canonical, alias) {
	return canonical ?? alias;
}

function normalizeMonsterAlignment(raw) {
	const firstPass = normalizeMonsterStringArray(raw.alignment);
	return firstPass.length > 0
		? normalizeMonsterStringArray(raw.alignment)
		: ["N"];
}

function createCustomMonsterBase(raw, name) {
	return {
		id: getCustomMonsterId(raw),
		name,
		source: getCustomMonsterSource(),
		size: normalizeMonsterSize(raw.size),
		type: normalizeMonsterTypedObject(raw.type),
		alignment: normalizeMonsterAlignment(raw),
		ac: normalizeMonsterAc(
			getCanonicalMonsterValue(raw.ac, raw.armor_class),
		),
		hp: normalizeMonsterHp(
			getCanonicalMonsterValue(raw.hp, raw.hit_points),
		),
		speed: normalizeMonsterSpeed(raw.speed),
		str: normalizeMonsterNumber(
			getCanonicalMonsterValue(raw.str, raw.strength),
			10,
		),
		dex: normalizeMonsterNumber(
			getCanonicalMonsterValue(raw.dex, raw.dexterity),
			10,
		),
		con: normalizeMonsterNumber(
			getCanonicalMonsterValue(raw.con, raw.constitution),
			10,
		),
		int: normalizeMonsterNumber(
			getCanonicalMonsterValue(raw.int, raw.intelligence),
			10,
		),
		wis: normalizeMonsterNumber(
			getCanonicalMonsterValue(raw.wis, raw.wisdom),
			10,
		),
		cha: normalizeMonsterNumber(
			getCanonicalMonsterValue(raw.cha, raw.charisma),
			10,
		),
		cr: normalizeMonsterCr(
			getCanonicalMonsterValue(raw.cr, raw.challenge_rating),
		),
	};
}

function projectCustomMonsterIdentity(monster, raw) {
	const imageUrl = asText(raw.imageUrl);
	if (imageUrl) monster.imageUrl = imageUrl;
	const originalBestiaryName = sanitizeMonsterName(raw.originalBestiaryName);
	if (originalBestiaryName) monster.originalBestiaryName = originalBestiaryName;
}

function projectCustomMonsterObjectFields(monster, raw) {
	for (const key of CUSTOM_MONSTER_OBJECT_FIELDS) {
		copyMonsterObjectField(monster, raw, key);
	}
}

function projectCustomMonsterStringLists(monster, raw) {
	for (const key of CUSTOM_MONSTER_STRING_LIST_FIELDS) {
		const values = normalizeMonsterStringArray(raw[key]);
		if (values.length > 0) monster[key] = values;
	}
}

function projectCustomMonsterEntries(monster, raw) {
	for (const key of CUSTOM_MONSTER_ENTRY_FIELDS) {
		const entries = normalizeMonsterEntries(raw[key]);
		if (entries.length > 0) monster[key] = entries;
	}
}

const CUSTOM_MONSTER_PROJECTORS = Object.freeze([
	projectCustomMonsterIdentity,
	projectCustomMonsterObjectFields,
	projectCustomMonsterStringLists,
	projectCustomMonsterEntries,
]);

function normalizeCustomMonster(raw) {
	if (!isCustomMonsterInput(raw)) return null;
	const name = getCustomMonsterName(raw);
	if (!name) return null;
	const monster = createCustomMonsterBase(raw, name);
	for (const project of CUSTOM_MONSTER_PROJECTORS) project(monster, raw);

	return stripMentionBrackets(monster);
}

module.exports = {
	normalizeCustomMonster,
};
