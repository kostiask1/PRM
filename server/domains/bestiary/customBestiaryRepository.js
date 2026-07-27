const crypto = require("crypto");
const {
	calculateDiceFormulaAverage,
	stripMentionBrackets,
} = require("../../../shared/bestiaryUtils.cjs");
const {
	exists,
	readJson,
	writeJson,
} = require("../../infrastructure/jsonFileStore");
const {
	CUSTOM_BESTIARY_PATH,
	FAVORITES_PATH,
} = require("../../infrastructure/storagePaths");
const {
	addMonstersToIndex,
	buildMonsterIndex,
} = require("./bestiaryReferenceRepository");

const CUSTOM_BESTIARY_SOURCE = "CUSTOM";

function normalizeCustomBestiaryEntryList(value) {
	return (Array.isArray(value) ? value : [])
		.map((entry) => {
			if (typeof entry === "string") {
				const text = entry.trim();
				return text ? { name: "", entries: [text] } : null;
			}
			if (!entry || typeof entry !== "object") return null;
			const entries = Array.isArray(entry.entries)
				? entry.entries
				: entry.text || entry.description || entry.content
					? [
							String(
								entry.text ||
									entry.description ||
									entry.content,
							),
						]
					: [];
			return {
				...entry,
				name: String(entry.name || entry.title || "").trim(),
				entries,
			};
		})
		.filter((entry) => entry && entry.entries.length > 0);
}

function createCustomBestiaryRepository(overrides = {}) {
	const dependencies = {
		addMonstersToIndex,
		buildMonsterIndex,
		calculateDiceFormulaAverage,
		createId: () => crypto.randomUUID(),
		customBestiaryPath: CUSTOM_BESTIARY_PATH,
		exists,
		favoritesPath: FAVORITES_PATH,
		readJson,
		stripMentionBrackets,
		writeJson,
		...overrides,
	};

	async function readCustomBestiary() {
		if (!(await dependencies.exists(dependencies.customBestiaryPath))) {
			return { monster: [] };
		}
		const data = await dependencies.readJson(
			dependencies.customBestiaryPath,
		);
		const monsters = Array.isArray(data)
			? data
			: data?.monster || data?.monsters || data?.results || [];
		return {
			...(data && !Array.isArray(data) ? data : {}),
			monster: Array.isArray(monsters)
				? monsters.map((monster) => ({
						...monster,
						source: CUSTOM_BESTIARY_SOURCE,
					}))
				: [],
		};
	}

	async function readCustomBestiaryMonsters() {
		return (await readCustomBestiary()).monster;
	}

	function normalizeCustomBestiaryMonster(monster) {
		const next = dependencies.stripMentionBrackets({
			...monster,
			id: String(monster.id || dependencies.createId()),
			name: String(monster.name || monster.title || "").trim(),
			source: CUSTOM_BESTIARY_SOURCE,
		});
		if (
			next.hp &&
			typeof next.hp === "object" &&
			!Array.isArray(next.hp)
		) {
			next.hp = { ...next.hp };
			const average = dependencies.calculateDiceFormulaAverage(
				next.hp.formula,
			);
			if (average !== null) {
				next.hp.average = average;
			} else if (
				Object.prototype.hasOwnProperty.call(next.hp, "average")
			) {
				const parsed = Number.parseInt(String(next.hp.average), 10);
				next.hp.average = Number.isFinite(parsed)
					? Math.max(1, parsed)
					: 1;
			}
		}
		if (next.spellcasting && !Array.isArray(next.spellcasting)) {
			next.spellcasting = [next.spellcasting];
		}
		for (const key of [
			"trait",
			"action",
			"bonus",
			"reaction",
			"legendary",
		]) {
			if (next[key] === undefined) continue;
			const entries = normalizeCustomBestiaryEntryList(next[key]);
			if (entries.length > 0) next[key] = entries;
			else delete next[key];
		}
		return next;
	}

	async function writeCustomBestiaryMonsters(monsters) {
		const seenIds = new Set();
		const normalized = (Array.isArray(monsters) ? monsters : [])
			.filter((monster) => monster && typeof monster === "object")
			.map((monster) => {
				const normalizedMonster =
					normalizeCustomBestiaryMonster(monster);
				if (seenIds.has(normalizedMonster.id)) {
					normalizedMonster.id = dependencies.createId();
				}
				seenIds.add(normalizedMonster.id);
				return normalizedMonster;
			})
			.filter((monster) => monster.name)
			.sort((a, b) => String(a.name).localeCompare(String(b.name)));
		await dependencies.writeJson(dependencies.customBestiaryPath, {
			_meta: {
				sources: [
					{
						json: CUSTOM_BESTIARY_SOURCE,
						abbreviation: CUSTOM_BESTIARY_SOURCE,
						full: "Custom",
					},
				],
			},
			monster: normalized,
		});
		return normalized;
	}

	async function readFavorites() {
		if (!(await dependencies.exists(dependencies.favoritesPath))) return [];
		return dependencies.readJson(dependencies.favoritesPath);
	}

	async function writeFavorites(favorites) {
		await dependencies.writeJson(dependencies.favoritesPath, favorites);
	}

	async function getBestiaryIndex() {
		const index = await dependencies.buildMonsterIndex();
		dependencies.addMonstersToIndex(
			index,
			await readCustomBestiaryMonsters(),
			CUSTOM_BESTIARY_SOURCE,
		);
		return index;
	}

	return {
		getBestiaryIndex,
		normalizeCustomBestiaryMonster,
		readCustomBestiary,
		readCustomBestiaryMonsters,
		readFavorites,
		writeCustomBestiaryMonsters,
		writeFavorites,
	};
}

const customBestiaryRepository = createCustomBestiaryRepository();

module.exports = {
	CUSTOM_BESTIARY_SOURCE,
	...customBestiaryRepository,
	createCustomBestiaryRepository,
	normalizeCustomBestiaryEntryList,
};
