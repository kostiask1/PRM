function getSpellLookupName(spell) {
	return String(spell.name || "").split("|")[0];
}

function getSpellLookupSource(spell) {
	return String(spell.source || "").toUpperCase();
}

function findSpellSourceKey(spellSources, spell) {
	return Object.keys(spellSources).find(
		(key) => key.toUpperCase() === getSpellLookupSource(spell),
	);
}

function getSpellSourceMap(spellSources, sourceKey) {
	return sourceKey ? spellSources[sourceKey] : null;
}

function findSpellInfo(spellSources, spell) {
	const spellName = getSpellLookupName(spell);
	const sourceKey = findSpellSourceKey(spellSources, spell);
	const sourceSpells = getSpellSourceMap(spellSources, sourceKey);
	return sourceSpells?.[spellName];
}

function getSpellClassEntries(info) {
	return [...(info.class || []), ...(info.classVariant || [])];
}

function addSpellClassName(classes, entry) {
	if (entry?.name) classes.add(entry.name);
}

function collectSpellClassNames(info) {
	const classes = new Set();
	for (const entry of getSpellClassEntries(info)) {
		addSpellClassName(classes, entry);
	}
	return classes;
}

function compareSpellClassNames(a, b) {
	return a.localeCompare(b);
}

export function getSpellClassInfo(spellSources, spell) {
	const info = findSpellInfo(spellSources, spell);
	if (!info) return [];
	return [...collectSpellClassNames(info)].sort(compareSpellClassNames);
}
