function clone(value) {
	return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function toArray(value) {
	if (value === undefined || value === null) return [];
	return Array.isArray(value) ? value : [value];
}

function isEntryNameRecord(value) {
	return Boolean(value && typeof value === "object");
}

function getEntryRecordName(value) {
	const name = value.name;
	if (name) return name;
	const id = value.id;
	if (id) return id;
	return value.title || "";
}

function entryName(value) {
	return isEntryNameRecord(value) ? getEntryRecordName(value) : value;
}

function matchesEntry(value, expected) {
	return (
		String(entryName(value)).toLowerCase() === String(expected).toLowerCase()
	);
}

function ensureArray(target, prop) {
	if (!Array.isArray(target[prop])) target[prop] = [];
	return target[prop];
}

function getJsonValueKey(value) {
	return JSON.stringify(value);
}

function appendUnique(targetList, items) {
	const seen = new Set(targetList.map(getJsonValueKey));
	for (const item of items) {
		const key = getJsonValueKey(item);
		if (seen.has(key)) continue;
		targetList.push(item);
		seen.add(key);
	}
}

function appendArrayModItems({ list, items }) {
	list.push(...items);
}

function prependArrayModItems({ list, items }) {
	list.unshift(...items);
}

function appendUniqueArrayModItems({ list, items }) {
	appendUnique(list, items);
}

function getArrayModInsertionIndex(mod, list) {
	return Math.max(0, Math.min(Number(mod.index) || 0, list.length));
}

function insertArrayModItems({ list, items, mod }) {
	const index = getArrayModInsertionIndex(mod, list);
	list.splice(index, 0, ...items);
}

function appendArrayModReplacement(next, entry, items, mod) {
	if (matchesEntry(entry, mod.replace)) {
		next.push(...items);
		return;
	}
	next.push(entry);
}

function replaceArrayModItems({ target, prop, list, items, mod }) {
	const next = [];
	for (const entry of list) {
		appendArrayModReplacement(next, entry, items, mod);
	}
	target[prop] = next;
}

function getArrayModRemovalNames(mod) {
	return toArray(mod.names ?? mod.items);
}

function isArrayModEntryRemoved(entry, names) {
	return names.some((name) => matchesEntry(entry, name));
}

function removeArrayModItems({ target, prop, list, mod }) {
	const names = getArrayModRemovalNames(mod);
	target[prop] = list.filter(
		(entry) => !isArrayModEntryRemoved(entry, names),
	);
}

const ARRAY_MOD_HANDLERS = Object.freeze([
	{ mode: "appendArr", apply: appendArrayModItems },
	{ mode: "prependArr", apply: prependArrayModItems },
	{ mode: "appendIfNotExistsArr", apply: appendUniqueArrayModItems },
	{ mode: "insertArr", apply: insertArrayModItems },
	{ mode: "replaceArr", apply: replaceArrayModItems },
	{ mode: "removeArr", apply: removeArrayModItems },
]);

function findArrayModHandler(mod) {
	return ARRAY_MOD_HANDLERS.find((handler) => mod.mode === handler.mode);
}

function applyArrayMod(target, prop, mod) {
	const list = ensureArray(target, prop);
	const items = clone(toArray(mod.items));
	const handler = findArrayModHandler(mod);
	if (!handler) return;
	handler.apply({ target, prop, list, items, mod });
}

function normalizeDiceFormulaInput(input) {
	return String(input || "")
		.toLowerCase()
		.replace(/\s+/g, "");
}

function getDiceFormulaParts(cleanFormula) {
	return cleanFormula.replace(/-/g, "+-").split("+").filter(Boolean);
}

function getDieFormulaMatch(part) {
	return part.match(/^(\d+)?d(\d+)([hl]\d+)?$/i);
}

function getDieFormulaCount(dieMatch) {
	return Number.parseInt(dieMatch[1], 10) || 1;
}

function getDieFormulaSides(dieMatch) {
	return Number.parseInt(dieMatch[2], 10);
}

function hasValidDieFormulaDimensions(count, sides) {
	return (
		Number.isFinite(count) &&
		Number.isFinite(sides) &&
		sides >= 1
	);
}

function getDieFormulaKeepCount(dieMatch, count) {
	const keepSuffix = dieMatch[3];
	return keepSuffix
		? Math.min(Number.parseInt(keepSuffix.slice(1), 10), count)
		: count;
}

function isValidDieFormulaKeepCount(keepCount) {
	return Number.isFinite(keepCount) && keepCount >= 0;
}

function getDieFormulaAverage(dieMatch) {
	const count = getDieFormulaCount(dieMatch);
	const sides = getDieFormulaSides(dieMatch);
	if (!hasValidDieFormulaDimensions(count, sides)) return null;
	const keepCount = getDieFormulaKeepCount(dieMatch, count);
	if (!isValidDieFormulaKeepCount(keepCount)) return null;
	return keepCount * ((sides + 1) / 2);
}

function isIntegerFormulaPart(part) {
	return /^[+-]?\d+$/.test(part);
}

function getDiceFormulaPartAverage(part) {
	const dieMatch = getDieFormulaMatch(part);
	if (dieMatch) return getDieFormulaAverage(dieMatch);
	if (isIntegerFormulaPart(part)) return Number.parseInt(part, 10);
	return null;
}

function getFinalDiceFormulaAverage(average) {
	return Math.max(1, Math.floor(average));
}

function accumulateDiceFormulaAverage(parts) {
	let average = 0;
	for (const part of parts) {
		const partAverage = getDiceFormulaPartAverage(part);
		if (partAverage === null) return null;
		average += partAverage;
	}
	return average;
}

function calculateDiceFormulaAverage(input) {
	const clean = normalizeDiceFormulaInput(input);
	if (!clean) return null;
	const parts = getDiceFormulaParts(clean);
	if (parts.length === 0) return null;
	const average = accumulateDiceFormulaAverage(parts);
	if (average === null) return null;
	return getFinalDiceFormulaAverage(average);
}

function isCustomMonsterRecord(monster) {
	return Boolean(monster && typeof monster === "object");
}

function hasObjectCustomMonsterHp(monster) {
	if (!monster.hp) return false;
	if (typeof monster.hp !== "object") return false;
	return !Array.isArray(monster.hp);
}

function hasNormalizableCustomMonsterHp(monster) {
	if (!isCustomMonsterRecord(monster)) return false;
	return hasObjectCustomMonsterHp(monster);
}

function getCustomMonsterHpFormulaAverage(monster) {
	const average = calculateDiceFormulaAverage(monster.hp.formula);
	return average;
}

function applyCustomMonsterHpAverage(monster, average) {
	return {
		...monster,
		hp: {
			...monster.hp,
			average,
		},
	};
}

function normalizeCustomMonsterHpAverage(monster) {
	if (!hasNormalizableCustomMonsterHp(monster)) return monster;
	const average = getCustomMonsterHpFormulaAverage(monster);
	if (average === null) return monster;
	return applyCustomMonsterHpAverage(monster, average);
}

function getObjectMentionBracketValueKind(value) {
	if (value && typeof value === "object") return "object";
	return "other";
}

function getMentionBracketValueKind(value) {
	if (typeof value === "string") return "string";
	if (Array.isArray(value)) return "array";
	return getObjectMentionBracketValueKind(value);
}

function stripStringMentionBrackets(value) {
	return value.replace(/\[([^[\]]+)\]/g, "$1");
}

function stripArrayMentionBrackets(value) {
	return value.map(stripMentionBrackets);
}

function stripObjectMentionBracketEntry([key, entryValue]) {
	return [key, stripMentionBrackets(entryValue)];
}

function stripObjectMentionBrackets(value) {
	return Object.fromEntries(
		Object.entries(value).map(stripObjectMentionBracketEntry),
	);
}

function preserveMentionBracketValue(value) {
	return value;
}

const MENTION_BRACKET_HANDLERS = Object.freeze({
	string: stripStringMentionBrackets,
	array: stripArrayMentionBrackets,
	object: stripObjectMentionBrackets,
	other: preserveMentionBracketValue,
});

function stripMentionBrackets(value) {
	return MENTION_BRACKET_HANDLERS[getMentionBracketValueKind(value)](value);
}

module.exports = {
	applyArrayMod,
	calculateDiceFormulaAverage,
	clone,
	normalizeCustomMonsterHpAverage,
	stripMentionBrackets,
	toArray,
};
