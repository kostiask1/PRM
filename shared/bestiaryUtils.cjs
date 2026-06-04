function clone(value) {
	return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function toArray(value) {
	if (value === undefined || value === null) return [];
	return Array.isArray(value) ? value : [value];
}

function entryName(value) {
	if (value && typeof value === "object") {
		return value.name || value.id || value.title || "";
	}
	return value;
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

function appendUnique(targetList, items) {
	const seen = new Set(targetList.map((item) => JSON.stringify(item)));
	for (const item of items) {
		const key = JSON.stringify(item);
		if (seen.has(key)) continue;
		targetList.push(item);
		seen.add(key);
	}
}

function applyArrayMod(target, prop, mod) {
	const list = ensureArray(target, prop);
	const items = clone(toArray(mod.items));

	if (mod.mode === "appendArr") {
		list.push(...items);
		return;
	}
	if (mod.mode === "prependArr") {
		list.unshift(...items);
		return;
	}
	if (mod.mode === "appendIfNotExistsArr") {
		appendUnique(list, items);
		return;
	}
	if (mod.mode === "insertArr") {
		const index = Math.max(0, Math.min(Number(mod.index) || 0, list.length));
		list.splice(index, 0, ...items);
		return;
	}
	if (mod.mode === "replaceArr") {
		const next = [];
		for (const entry of list) {
			if (matchesEntry(entry, mod.replace)) next.push(...items);
			else next.push(entry);
		}
		target[prop] = next;
		return;
	}
	if (mod.mode === "removeArr") {
		const names = toArray(mod.names ?? mod.items);
		target[prop] = list.filter(
			(entry) => !names.some((name) => matchesEntry(entry, name)),
		);
	}
}

function calculateDiceFormulaAverage(input) {
	const clean = String(input || "")
		.toLowerCase()
		.replace(/\s+/g, "");
	if (!clean) return null;

	const parts = clean.replace(/-/g, "+-").split("+").filter(Boolean);
	if (parts.length === 0) return null;

	let average = 0;
	for (const part of parts) {
		const dieMatch = part.match(/^(\d+)?d(\d+)([hl]\d+)?$/i);
		if (dieMatch) {
			const count = Number.parseInt(dieMatch[1], 10) || 1;
			const sides = Number.parseInt(dieMatch[2], 10);
			const keepSuffix = dieMatch[3];
			if (!Number.isFinite(count) || !Number.isFinite(sides) || sides < 1) {
				return null;
			}
			const keepCount = keepSuffix
				? Math.min(Number.parseInt(keepSuffix.slice(1), 10), count)
				: count;
			if (!Number.isFinite(keepCount) || keepCount < 0) return null;
			average += keepCount * ((sides + 1) / 2);
			continue;
		}

		if (/^[+-]?\d+$/.test(part)) {
			average += Number.parseInt(part, 10);
			continue;
		}

		return null;
	}

	return Math.max(1, Math.floor(average));
}

function normalizeCustomMonsterHpAverage(monster) {
	if (!monster || typeof monster !== "object") return monster;
	if (
		!monster.hp ||
		typeof monster.hp !== "object" ||
		Array.isArray(monster.hp)
	) {
		return monster;
	}
	const average = calculateDiceFormulaAverage(monster.hp.formula);
	if (average === null) return monster;
	return {
		...monster,
		hp: {
			...monster.hp,
			average,
		},
	};
}

function stripMentionBrackets(value) {
	if (typeof value === "string") {
		return value.replace(/\[([^[\]]+)\]/g, "$1");
	}
	if (Array.isArray(value)) {
		return value.map(stripMentionBrackets);
	}
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([key, entryValue]) => [
				key,
				stripMentionBrackets(entryValue),
			]),
		);
	}
	return value;
}

module.exports = {
	applyArrayMod,
	calculateDiceFormulaAverage,
	clone,
	normalizeCustomMonsterHpAverage,
	stripMentionBrackets,
	toArray,
};
