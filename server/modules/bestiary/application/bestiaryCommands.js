const {
	applyArrayMod,
	clone,
	normalizeCustomMonsterHpAverage,
	toArray,
} = require("../../../../shared/bestiaryUtils.cjs");
const { sortByNameQuery } = require("../../../routes/searchUtils");

const CUSTOM_SOURCE = "CUSTOM";

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

function buildReplacementCustomMonster(previousMonster, rawMonster) {
	const nextMonster = clone(rawMonster);
	nextMonster.name = String(nextMonster.name || "").trim();
	nextMonster.source = CUSTOM_SOURCE;
	if (!Object.prototype.hasOwnProperty.call(nextMonster, "imageUrl")) {
		nextMonster.imageUrl = previousMonster?.imageUrl || null;
	}
	return nextMonster;
}

function groupKey(name, source) {
	return `${String(name || "").trim().toLowerCase()}|${normalizeSource(source)}`;
}

function applyLegendaryGroupMods(target, mods) {
	if (!mods || typeof mods !== "object") return;
	for (const [property, rawMods] of Object.entries(mods)) {
		for (const mod of toArray(rawMods)) {
			if (mod === "remove") {
				delete target[property];
				continue;
			}
			if (!mod || typeof mod !== "object") continue;
			if (
				[
					"appendArr",
					"prependArr",
					"appendIfNotExistsArr",
					"insertArr",
					"replaceArr",
					"removeArr",
				].includes(mod.mode)
			) {
				applyArrayMod(target, property, mod);
			} else if (mod.mode === "setProp") {
				target[mod.prop] = clone(mod.value);
			}
		}
	}
}

function resolveLegendaryGroup(group, index, stack = []) {
	const source = normalizeSource(group.source);
	const currentKey = groupKey(group.name, source);
	if (stack.includes(currentKey)) {
		throw new Error(
			`Circular legendary group _copy chain: ${[...stack, currentKey].join(" -> ")}`,
		);
	}
	if (!group._copy) return { ...clone(group), source: group.source || source };
	const copySource = normalizeSource(group._copy.source || group.source);
	const base = index.get(groupKey(group._copy.name, copySource));
	if (!base) {
		throw new Error(
			`Base legendary group not found for ${group.name} (${source}): ${group._copy.name}`,
		);
	}
	const resolved = resolveLegendaryGroup(base, index, [...stack, currentKey]);
	for (const [key, value] of Object.entries(group)) {
		if (key === "_copy" || key === "_mod") continue;
		resolved[key] = clone(value);
	}
	applyLegendaryGroupMods(resolved, group._copy._mod);
	delete resolved._copy;
	delete resolved._mod;
	return resolved;
}

function resolveLegendaryGroups(groups) {
	const index = new Map();
	for (const group of groups) {
		if (group?.name) index.set(groupKey(group.name, group.source), group);
	}
	return groups.map((group) => resolveLegendaryGroup(group, index));
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
			if (String(source).toLowerCase() === "all") {
				const all = await repository.readAllMonsters();
				return all.monsters.map((monster) => ({
					...monster,
					source: normalizeSource(monster.source),
				}));
			}
			if (normalizedSource === CUSTOM_SOURCE) return listCustom();
			const sourceData = await repository.readSourceMonsters(source);
			if (sourceData) {
				return sourceData.monsters.map((monster) => ({
					...monster,
					source: normalizeSource(monster.source || sourceData.fileSource),
				}));
			}
			const all = await repository.readAllMonsters();
			if (!all.exists) fail("Source not found.", 404);
			return all.monsters
				.filter((monster) => normalizeSource(monster.source) === normalizedSource)
				.map((monster) => ({
					...monster,
					source: normalizeSource(monster.source),
				}));
		},

		listCustom,
		async search({ name = "", type = "" }) {
			const nameQuery = String(name).toLowerCase();
			const typeQuery = String(type).toLowerCase();
			const results = [];
			for (const monster of (await repository.getIndex()).values()) {
				const matchesName = nameQuery
					? monster.name?.toLowerCase().includes(nameQuery)
					: true;
				const matchesType = typeQuery
					? JSON.stringify(monster.type || "").toLowerCase().includes(typeQuery)
					: true;
				if (matchesName && matchesType) results.push(monster);
			}
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
			if (payload.monster && typeof payload.monster === "object") {
				const next = buildReplacementCustomMonster(previous, payload.monster);
				if (!next.name) fail("Creature name is required.", 400);
				const nextNameKey = monsterNameKey(next);
				if (
					monsters.some(
						(monster, monsterIndex) =>
							monsterIndex !== index && monsterNameKey(monster) === nextNameKey,
					)
				) {
					fail("Custom creature with this name already exists.", 409);
				}
				monsters[index] = normalizeCustomMonsterHpAverage(next);
				const updated = await repository.writeCustomMonsters(monsters);
				if (nextNameKey !== previousNameKey) {
					const favorites = await repository.readFavorites();
					await repository.writeFavorites(
						favorites.map((favorite) =>
							monsterNameKey(favorite) === previousNameKey &&
							normalizeSource(favorite.source) === CUSTOM_SOURCE
								? { ...favorite, name: next.name, source: CUSTOM_SOURCE }
								: favorite,
						),
					);
				}
				return updated.find((monster) => monsterNameKey(monster) === nextNameKey) || next;
			}

			const imageUrl =
				payload.imageUrl === null ? null : String(payload.imageUrl || "").trim();
			monsters[index] = { ...previous, imageUrl: imageUrl || null };
			const updated = await repository.writeCustomMonsters(monsters);
			return (
				updated.find(
					(monster) =>
						(previousId && monsterId(monster) === previousId) ||
						monsterNameKey(monster) === previousNameKey,
				) || monsters[index]
			);
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
