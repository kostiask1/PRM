const {
	applyArrayMod,
	clone,
	normalizeCustomMonsterHpAverage,
	toArray,
} = require("../../../../shared/bestiaryUtils.cjs");
const {
	sortByNameQuery,
} = require("../../search/application/searchResults");

const CUSTOM_SOURCE = "CUSTOM";
const LEGENDARY_ARRAY_MODES = Object.freeze([
	"appendArr",
	"prependArr",
	"appendIfNotExistsArr",
	"insertArr",
	"replaceArr",
	"removeArr",
]);

const normalizeSource = (source) =>
	String(source || "")
		.trim()
		.toUpperCase();

const monsterNameKey = (monster) =>
	String(monster?.name || "")
		.trim()
		.toLowerCase();

const monsterId = (monster) => String(monster?.id || "").trim();

function findCustomMonsterIndex(monsters, identifier) {
	const target = String(identifier || "").trim();
	if (!target) return -1;
	const idIndex = monsters.findIndex((monster) => monsterId(monster) === target);
	if (idIndex >= 0) return idIndex;
	const key = target.toLowerCase();
	return monsters.findIndex((monster) => monsterNameKey(monster) === key);
}

function fail(message, status) {
	const error = new Error(message);
	error.status = status;
	throw error;
}

function normalizeReplacementMonsterName(monster) {
	return String(monster.name || "").trim();
}

function getReplacementMonsterImage(previousMonster) {
	return previousMonster?.imageUrl || null;
}

function applyReplacementMonsterImageFallback(nextMonster, previousMonster) {
	if (Object.prototype.hasOwnProperty.call(nextMonster, "imageUrl")) return;
	nextMonster.imageUrl = getReplacementMonsterImage(previousMonster);
}

function buildReplacementCustomMonster(previousMonster, rawMonster) {
	const nextMonster = clone(rawMonster);
	nextMonster.name = normalizeReplacementMonsterName(nextMonster);
	nextMonster.source = CUSTOM_SOURCE;
	applyReplacementMonsterImageFallback(nextMonster, previousMonster);
	return nextMonster;
}

function groupKey(name, source) {
	return `${String(name || "").trim().toLowerCase()}|${normalizeSource(source)}`;
}

function isLegendaryArrayMod(mod) {
	return LEGENDARY_ARRAY_MODES.includes(mod.mode);
}

function applyLegendarySetProp(target, mod) {
	target[mod.prop] = clone(mod.value);
}

function applyLegendaryObjectMod(target, property, mod) {
	if (isLegendaryArrayMod(mod)) {
		applyArrayMod(target, property, mod);
		return;
	}
	if (mod.mode === "setProp") applyLegendarySetProp(target, mod);
}

function applyLegendaryPropertyMod(target, property, mod) {
	if (mod === "remove") {
		delete target[property];
		return;
	}
	if (!mod || typeof mod !== "object") return;
	applyLegendaryObjectMod(target, property, mod);
}

function applyLegendaryPropertyMods(target, [property, rawMods]) {
	for (const mod of toArray(rawMods)) {
		applyLegendaryPropertyMod(target, property, mod);
	}
}

function applyLegendaryGroupMods(target, mods) {
	if (!mods || typeof mods !== "object") return;
	for (const entry of Object.entries(mods)) {
		applyLegendaryPropertyMods(target, entry);
	}
}

function requireAcyclicLegendaryGroup(currentKey, stack) {
	if (!stack.includes(currentKey)) return;
	throw new Error(
		`Circular legendary group _copy chain: ${[...stack, currentKey].join(" -> ")}`,
	);
}

function isDirectLegendaryGroup(group) {
	return !group._copy;
}

function cloneDirectLegendaryGroup(group, source) {
	return { ...clone(group), source: group.source || source };
}

function getLegendaryCopySource(group) {
	return normalizeSource(group._copy.source || group.source);
}

function createMissingLegendaryGroupError(group, source) {
	return new Error(
		`Base legendary group not found for ${group.name} (${source}): ${group._copy.name}`,
	);
}

function requireLegendaryGroupBase(group, source, index) {
	const base = index.get(groupKey(group._copy.name, source));
	if (!base) throw createMissingLegendaryGroupError(group, source);
	return base;
}

function isLegendaryCopyMetadataKey(key) {
	return key === "_copy" || key === "_mod";
}

function overlayLegendaryGroup(resolved, group) {
	for (const [key, value] of Object.entries(group)) {
		if (isLegendaryCopyMetadataKey(key)) continue;
		resolved[key] = clone(value);
	}
}

function finalizeCopiedLegendaryGroup(resolved, group) {
	overlayLegendaryGroup(resolved, group);
	applyLegendaryGroupMods(resolved, group._copy._mod);
	delete resolved._copy;
	delete resolved._mod;
	return resolved;
}

function resolveLegendaryGroup(group, index, stack = []) {
	const source = normalizeSource(group.source);
	const currentKey = groupKey(group.name, source);
	requireAcyclicLegendaryGroup(currentKey, stack);
	if (isDirectLegendaryGroup(group))
		return cloneDirectLegendaryGroup(group, source);
	const copySource = getLegendaryCopySource(group);
	const base = requireLegendaryGroupBase(group, copySource, index);
	const resolved = resolveLegendaryGroup(base, index, [...stack, currentKey]);
	return finalizeCopiedLegendaryGroup(resolved, group);
}

function resolveLegendaryGroups(groups) {
	const index = new Map();
	for (const group of groups) {
		if (group?.name) index.set(groupKey(group.name, group.source), group);
	}
	return groups.map((group) => resolveLegendaryGroup(group, index));
}

function hasReplacementCustomMonster(payload) {
	return payload.monster && typeof payload.monster === "object";
}

function requireReplacementMonsterName(monster) {
	if (!monster.name) fail("Creature name is required.", 400);
}

function matchesOtherCustomMonsterName(
	monster,
	monsterIndex,
	targetIndex,
	nameKey,
) {
	if (monsterIndex === targetIndex) return false;
	return monsterNameKey(monster) === nameKey;
}

function requireUniqueCustomMonsterName(monsters, targetIndex, nameKey) {
	const duplicate = monsters.some((monster, monsterIndex) =>
		matchesOtherCustomMonsterName(
			monster,
			monsterIndex,
			targetIndex,
			nameKey,
		),
	);
	if (duplicate) fail("Custom creature with this name already exists.", 409);
}

function renameCustomFavorite(favorite, previousNameKey, nextName) {
	if (monsterNameKey(favorite) !== previousNameKey) return favorite;
	if (normalizeSource(favorite.source) !== CUSTOM_SOURCE) return favorite;
	return { ...favorite, name: nextName, source: CUSTOM_SOURCE };
}

async function persistCustomMonsterRename(
	repository,
	previousNameKey,
	nextNameKey,
	nextName,
) {
	if (nextNameKey === previousNameKey) return;
	const favorites = await repository.readFavorites();
	await repository.writeFavorites(
		favorites.map((favorite) =>
			renameCustomFavorite(favorite, previousNameKey, nextName),
		),
	);
}

function selectPersistedReplacement(updated, nextNameKey, fallback) {
	return (
		updated.find((monster) => monsterNameKey(monster) === nextNameKey) ||
		fallback
	);
}

async function replaceCustomMonster({
	repository,
	monsters,
	index,
	previous,
	previousNameKey,
	rawMonster,
}) {
	const next = buildReplacementCustomMonster(previous, rawMonster);
	requireReplacementMonsterName(next);
	const nextNameKey = monsterNameKey(next);
	requireUniqueCustomMonsterName(monsters, index, nextNameKey);
	monsters[index] = normalizeCustomMonsterHpAverage(next);
	const updated = await repository.writeCustomMonsters(monsters);
	await persistCustomMonsterRename(
		repository,
		previousNameKey,
		nextNameKey,
		next.name,
	);
	return selectPersistedReplacement(updated, nextNameKey, next);
}

function normalizeCustomImageUrl(payload) {
	return payload.imageUrl === null
		? null
		: String(payload.imageUrl || "").trim();
}

function matchesPersistedImageMonster(
	monster,
	previousId,
	previousNameKey,
) {
	if (previousId && monsterId(monster) === previousId) return true;
	return monsterNameKey(monster) === previousNameKey;
}

function selectPersistedImageMonster(
	updated,
	previousId,
	previousNameKey,
	fallback,
) {
	return (
		updated.find((monster) =>
			matchesPersistedImageMonster(
				monster,
				previousId,
				previousNameKey,
			),
		) || fallback
	);
}

async function updateCustomMonsterImage({
	repository,
	monsters,
	index,
	previous,
	previousId,
	previousNameKey,
	payload,
}) {
	const imageUrl = normalizeCustomImageUrl(payload);
	monsters[index] = { ...previous, imageUrl: imageUrl || null };
	const updated = await repository.writeCustomMonsters(monsters);
	return selectPersistedImageMonster(
		updated,
		previousId,
		previousNameKey,
		monsters[index],
	);
}

function projectAllSourceMonster(monster) {
	return {
		...monster,
		source: normalizeSource(monster.source),
	};
}

async function readAllSourceMonsters(repository) {
	const all = await repository.readAllMonsters();
	return all.monsters.map(projectAllSourceMonster);
}

function projectDirectSourceMonster(monster, sourceData) {
	return {
		...monster,
		source: normalizeSource(monster.source || sourceData.fileSource),
	};
}

function projectDirectSourceMonsters(sourceData) {
	return sourceData.monsters.map((monster) =>
		projectDirectSourceMonster(monster, sourceData),
	);
}

function matchesNormalizedMonsterSource(monster, normalizedSource) {
	return normalizeSource(monster.source) === normalizedSource;
}

function projectFallbackSourceMonster(monster) {
	return {
		...monster,
		source: normalizeSource(monster.source),
	};
}

function projectFallbackSourceMonsters(monsters, normalizedSource) {
	return monsters
		.filter((monster) =>
			matchesNormalizedMonsterSource(monster, normalizedSource),
		)
		.map(projectFallbackSourceMonster);
}

async function readNamedSourceMonsters(repository, source, normalizedSource) {
	const sourceData = await repository.readSourceMonsters(source);
	if (sourceData) return projectDirectSourceMonsters(sourceData);
	const all = await repository.readAllMonsters();
	if (!all.exists) fail("Source not found.", 404);
	return projectFallbackSourceMonsters(all.monsters, normalizedSource);
}

function isAllBestiarySource(source) {
	return String(source).toLowerCase() === "all";
}

function matchesBestiarySearchName(monster, nameQuery) {
	if (!nameQuery) return true;
	return monster.name?.toLowerCase().includes(nameQuery);
}

function matchesBestiarySearchType(monster, typeQuery) {
	if (!typeQuery) return true;
	return JSON.stringify(monster.type || "").toLowerCase().includes(typeQuery);
}

function matchesBestiarySearch(monster, nameQuery, typeQuery) {
	const matchesName = matchesBestiarySearchName(monster, nameQuery);
	const matchesType = matchesBestiarySearchType(monster, typeQuery);
	return matchesName && matchesType;
}

function appendBestiarySearchResults(results, index, nameQuery, typeQuery) {
	for (const monster of index.values()) {
		if (matchesBestiarySearch(monster, nameQuery, typeQuery)) {
			results.push(monster);
		}
	}
}

function createBestiaryCommands(repository) {
	async function requireCustomTarget(identifier) {
		if (!String(identifier || "").trim()) {
			fail("Creature name is required.", 400);
		}
		const monsters = await repository.readCustomMonsters();
		const index = findCustomMonsterIndex(monsters, identifier);
		if (index < 0) fail("Custom creature not found.", 404);
		return { monsters, index };
	}
	async function listCustom() {
		return (await repository.readCustomMonsters()).map((monster) => ({
			...monster,
			source: CUSTOM_SOURCE,
		}));
	}

	return {
		async listSources() {
			const all = await repository.readAllMonsters();
			const sources = all.exists
				? all.monsters.map((monster) => monster.source).filter(Boolean)
				: await repository.listSourceFiles();
			return [...new Set([...sources, CUSTOM_SOURCE])].sort((left, right) =>
				left.localeCompare(right),
			);
		},

		async listLegendaryGroups() {
			return resolveLegendaryGroups(await repository.readLegendaryGroups());
		},

		async getSource({ source }) {
			const normalizedSource = normalizeSource(source);
			if (isAllBestiarySource(source))
				return readAllSourceMonsters(repository);
			if (normalizedSource === CUSTOM_SOURCE) return listCustom();
			return readNamedSourceMonsters(
				repository,
				source,
				normalizedSource,
			);
		},

		listCustom,
		async search({ name = "", type = "" }) {
			const nameQuery = String(name).toLowerCase();
			const typeQuery = String(type).toLowerCase();
			const results = [];
			appendBestiarySearchResults(
				results,
				await repository.getIndex(),
				nameQuery,
				typeQuery,
			);
			sortByNameQuery(results, nameQuery);
			return results;
		},

		async listFavorites() {
			return (await repository.readFavorites()).map((favorite) => ({
				...favorite,
				source: normalizeSource(favorite.source),
			}));
		},

		async toggleFavorite({ name, source }) {
			const normalizedSource = normalizeSource(source);
			const favorites = await repository.readFavorites();
			const index = favorites.findIndex(
				(favorite) =>
					favorite.name === name &&
					normalizeSource(favorite.source) === normalizedSource,
			);
			if (index >= 0) favorites.splice(index, 1);
			else favorites.push({ name, source: normalizedSource });
			await repository.writeFavorites(favorites);
			return favorites;
		},

		async updateCustom({ identifier, payload = {} }) {
			const { monsters, index } = await requireCustomTarget(identifier);
			const previous = monsters[index];
			const previousNameKey = monsterNameKey(previous);
			const previousId = monsterId(previous);
			if (hasReplacementCustomMonster(payload)) {
				return replaceCustomMonster({
					repository,
					monsters,
					index,
					previous,
					previousNameKey,
					rawMonster: payload.monster,
				});
			}
			return updateCustomMonsterImage({
				repository,
				monsters,
				index,
				previous,
				previousId,
				previousNameKey,
				payload,
			});
		},

		async replaceCustom({ monsters = [] }) {
			const normalized = (Array.isArray(monsters) ? monsters : [])
				.filter((monster) => monster && typeof monster === "object")
				.map((monster) => ({
					...monster,
					name: String(monster.name || "").trim(),
					source: CUSTOM_SOURCE,
				}))
				.filter((monster) => monster.name);
			return repository.writeCustomMonsters(normalized);
		},

		async deleteCustom({ identifier }) {
			const { monsters, index } = await requireCustomTarget(identifier);
			const nameKey = monsterNameKey(monsters[index]);
			const updated = await repository.writeCustomMonsters(
				monsters.filter((_monster, monsterIndex) => monsterIndex !== index),
			);
			const favorites = await repository.readFavorites();
			const nextFavorites = favorites.filter(
				(favorite) =>
					!(monsterNameKey(favorite) === nameKey &&
						normalizeSource(favorite.source) === CUSTOM_SOURCE),
			);
			if (nextFavorites.length !== favorites.length) {
				await repository.writeFavorites(nextFavorites);
			}
			return updated;
		},
	};
}

module.exports = {
	CUSTOM_SOURCE,
	buildReplacementCustomMonster,
	createBestiaryCommands,
	findCustomMonsterIndex,
	normalizeSource,
	resolveLegendaryGroups,
};
