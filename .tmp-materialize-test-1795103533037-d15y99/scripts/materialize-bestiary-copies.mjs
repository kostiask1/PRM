import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import bestiaryUtils from "../shared/bestiaryUtils.cjs";

const { applyArrayMod, clone, toArray } = bestiaryUtils;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, "..");
const BESTIARY_DIR = path.join(ROOT_DIR, "database", "bestiary");

const args = new Set(process.argv.slice(2));
const isDryRun = args.has("--dry-run") || args.has("--check");
const isVerbose = args.has("--verbose");

if (args.has("--help") || args.has("-h")) {
	console.log(`Usage: node scripts/materialize-bestiary-copies.mjs [--dry-run] [--verbose]

Replaces bestiary monsters that use _copy with fully materialized monster data.
The script updates JSON files in database/bestiary unless --dry-run is used.`);
	process.exit(0);
}

function normalizeSource(source) {
	return String(source || "")
		.trim()
		.toUpperCase();
}

function monsterKey(name, source) {
	return `${String(name || "")
		.trim()
		.toLowerCase()}|${normalizeSource(source)}`;
}

function readProperty(value, key) {
	if (value === null || value === undefined) return undefined;
	return value[key];
}

function firstFileSource(data) {
	const meta = readProperty(data, "_meta");
	const sources = readProperty(meta, "sources");
	const firstSource = readProperty(sources, 0);
	return readProperty(firstSource, "json");
}

function fileNameSource(fileName) {
	return path.parse(fileName).name.replace(/^bestiary-/i, "");
}

function getFileSource(fileName, data) {
	return normalizeSource(firstFileSource(data) || fileNameSource(fileName));
}

function resultsOrEmpty(data) {
	const results = readProperty(data, "results");
	if (results) return results;
	return [];
}

function getMonsterList(data) {
	if (Array.isArray(data)) return data;
	const monster = readProperty(data, "monster");
	if (monster) return monster;
	const monsters = readProperty(data, "monsters");
	if (monsters) return monsters;
	return resultsOrEmpty(data);
}

function escapeRegExp(value) {
	return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function nullishFallback(value, fallback) {
	if (value === null || value === undefined) return fallback;
	return value;
}

function replacementFlags(mod) {
	return mod.flags || "g";
}

function replaceTextInValue(value, mod) {
	if (value === undefined || value === null) return value;
	const replace = String(nullishFallback(mod.replace, ""));
	if (!replace) return value;

	const regex = new RegExp(escapeRegExp(replace), replacementFlags(mod));
	const serialized = JSON.stringify(value);
	const replacement = nullishFallback(mod.with, "");
	return JSON.parse(serialized.replace(regex, replacement));
}

function getPrimarySpellcasting(target) {
	if (!Array.isArray(target.spellcasting)) target.spellcasting = [];
	if (!target.spellcasting[0])
		target.spellcasting[0] = { name: "Spellcasting" };
	return target.spellcasting[0];
}

function appendClonedValues(list, values) {
	list.push(...clone(toArray(values)));
}

function getObjectBucket(owner, key) {
	if (!owner[key] || typeof owner[key] !== "object") owner[key] = {};
	return owner[key];
}

function addAtWillSpells(block, spells) {
	if (!spells) return;
	if (!Array.isArray(block.will)) block.will = [];
	appendClonedValues(block.will, spells);
}

function addDailySpellBucket(daily, key, spells) {
	if (!Array.isArray(daily[key])) daily[key] = [];
	appendClonedValues(daily[key], spells);
}

function addDailySpells(block, dailySpells) {
	if (!dailySpells) return;
	const daily = getObjectBucket(block, "daily");
	for (const [key, spells] of Object.entries(dailySpells)) {
		addDailySpellBucket(daily, key, spells);
	}
}

function isSpellInfoRecord(spellInfo) {
	if (!spellInfo || typeof spellInfo !== "object") return false;
	return !Array.isArray(spellInfo);
}

function copySpellLevelMetadata(levelBlock, spellInfo) {
	for (const [key, value] of Object.entries(spellInfo)) {
		if (key === "spells") continue;
		levelBlock[key] = clone(value);
	}
}

function addSpellLevel(spells, level, spellInfo) {
	const levelBlock = getObjectBucket(spells, level);
	if (!Array.isArray(levelBlock.spells)) levelBlock.spells = [];
	if (isSpellInfoRecord(spellInfo)) {
		copySpellLevelMetadata(levelBlock, spellInfo);
		appendClonedValues(levelBlock.spells, spellInfo.spells);
		return;
	}
	appendClonedValues(levelBlock.spells, spellInfo);
}

function addLeveledSpells(block, leveledSpells) {
	if (!leveledSpells) return;
	const spells = getObjectBucket(block, "spells");
	for (const [level, spellInfo] of Object.entries(leveledSpells)) {
		addSpellLevel(spells, level, spellInfo);
	}
}

function addSpells(target, mod) {
	const block = getPrimarySpellcasting(target);
	addAtWillSpells(block, mod.will);
	addDailySpells(block, mod.daily);
	addLeveledSpells(block, mod.spells);
}

function replacementSource(replacement) {
	if (replacement === null || replacement === undefined) return undefined;
	return replacement.replace;
}

function applyListReplacement(list, replacement) {
	const replace = replacementSource(replacement);
	if (!replace) return;
	for (let index = 0; index < list.length; index += 1) {
		if (String(list[index]) === String(replace)) {
			list[index] = replacement.with;
		}
	}
}

function replaceInList(list, replacements) {
	if (!Array.isArray(list)) return;
	for (const replacement of replacements) {
		applyListReplacement(list, replacement);
	}
}

function replaceDailySpells(block, dailySpells) {
	if (!dailySpells || !block.daily) return;
	for (const [key, replacements] of Object.entries(dailySpells)) {
		replaceInList(block.daily[key], toArray(replacements));
	}
}

function spellLevelList(block, level) {
	const levelBlock = block.spells[level];
	if (!levelBlock) return undefined;
	return levelBlock.spells;
}

function replaceLeveledSpells(block, leveledSpells) {
	if (!leveledSpells) return;
	if (!block.spells) return;
	for (const [level, replacements] of Object.entries(leveledSpells)) {
		replaceInList(spellLevelList(block, level), toArray(replacements));
	}
}

function replaceSpellBlock(block, mod) {
	if (mod.will) replaceInList(block.will, toArray(mod.will));
	replaceDailySpells(block, mod.daily);
	replaceLeveledSpells(block, mod.spells);
}

function getSpellcastingBlocks(target) {
	return Array.isArray(target.spellcasting) ? target.spellcasting : [];
}

function replaceSpells(target, mod) {
	for (const block of getSpellcastingBlocks(target)) {
		replaceSpellBlock(block, mod);
	}
}

function removeFromList(list, items) {
	if (!Array.isArray(list)) return;
	const removeSet = new Set(toArray(items).map((item) => String(item)));
	for (let i = list.length - 1; i >= 0; i -= 1) {
		if (removeSet.has(String(list[i]))) list.splice(i, 1);
	}
}

function removeDailySpells(block, dailySpells) {
	if (!dailySpells || !block.daily) return;
	for (const [key, spells] of Object.entries(dailySpells)) {
		removeFromList(block.daily[key], spells);
	}
}

function removeLeveledSpells(block, leveledSpells) {
	if (!leveledSpells) return;
	if (!block.spells) return;
	for (const [level, spells] of Object.entries(leveledSpells)) {
		removeFromList(spellLevelList(block, level), spells);
	}
}

function removeSpellBlock(block, mod) {
	if (mod.will) removeFromList(block.will, mod.will);
	removeDailySpells(block, mod.daily);
	removeLeveledSpells(block, mod.spells);
}

function removeSpells(target, mod) {
	for (const block of getSpellcastingBlocks(target)) {
		removeSpellBlock(block, mod);
	}
}

function clearTarget(target) {
	for (const key of Object.keys(target)) delete target[key];
}

function applyReplaceTextCommand({ target, prop, mod }) {
	if (Array.isArray(mod.props)) {
		for (const targetProp of mod.props) {
			target[targetProp] = replaceTextInValue(target[targetProp], mod);
		}
		return;
	}
	if (prop === "*") {
		const replaced = replaceTextInValue(target, mod);
		clearTarget(target);
		Object.assign(target, replaced);
		return;
	}
	target[prop] = replaceTextInValue(target[prop], mod);
}

function applyArrayCommand({ target, prop, mod }) {
	applyArrayMod(target, prop, mod);
}

function applySetPropertyCommand({ target, mod }) {
	target[mod.prop] = clone(mod.value);
}

function applyAddSkillsCommand({ target, mod }) {
	target.skill = { ...(target.skill || {}), ...clone(mod.skills || {}) };
}

function applyAddSpellsCommand({ target, mod }) {
	addSpells(target, mod);
}

function applyReplaceSpellsCommand({ target, mod }) {
	replaceSpells(target, mod);
}

function applyRemoveSpellsCommand({ target, mod }) {
	removeSpells(target, mod);
}

const MOD_COMMANDS = new Map([
	["replaceTxt", applyReplaceTextCommand],
	["appendArr", applyArrayCommand],
	["prependArr", applyArrayCommand],
	["appendIfNotExistsArr", applyArrayCommand],
	["insertArr", applyArrayCommand],
	["replaceArr", applyArrayCommand],
	["removeArr", applyArrayCommand],
	["setProp", applySetPropertyCommand],
	["addSkills", applyAddSkillsCommand],
	["addSpells", applyAddSpellsCommand],
	["replaceSpells", applyReplaceSpellsCommand],
	["removeSpells", applyRemoveSpellsCommand],
]);

function unsupportedModWarning(context, prop, mod) {
	return `${context}: unsupported mod ${JSON.stringify(mod)} on ${prop}`;
}

function unsupportedModeWarning(context, prop, mode) {
	return `${context}: unsupported mode "${mode}" on ${prop}`;
}

function isModObject(mod) {
	if (!mod) return false;
	return typeof mod === "object";
}

function applyMod(target, prop, mod, warnings, context) {
	if (mod === "remove") {
		delete target[prop];
		return;
	}
	if (!isModObject(mod)) {
		warnings.push(unsupportedModWarning(context, prop, mod));
		return;
	}
	const command = MOD_COMMANDS.get(mod.mode);
	if (!command) {
		warnings.push(unsupportedModeWarning(context, prop, mod.mode));
		return;
	}
	command({ target, prop, mod });
}

function isCopyModMap(mods) {
	if (!mods) return false;
	return typeof mods === "object";
}

function applyCopyMods(target, mods, warnings, context) {
	if (!isCopyModMap(mods)) return;
	for (const [prop, rawMods] of Object.entries(mods)) {
		for (const mod of toArray(rawMods)) {
			applyMod(target, prop, mod, warnings, context);
		}
	}
}

function copyBaseSource(copy, fallbackSource) {
	return normalizeSource(readProperty(copy, "source") || fallbackSource);
}

function copyNamePrefix(copy) {
	return `${String(readProperty(copy, "name") || "")
		.trim()
		.toLowerCase()}|`;
}

function findFirstBaseByPrefix(index, prefix) {
	for (const [key, entry] of index.entries()) {
		if (key.startsWith(prefix)) return entry;
	}
	return null;
}

function findBaseMonster(copy, fallbackSource, index) {
	const baseSource = copyBaseSource(copy, fallbackSource);
	const exact = index.get(monsterKey(readProperty(copy, "name"), baseSource));
	if (exact) return exact;
	return findFirstBaseByPrefix(index, copyNamePrefix(copy));
}

function getMonsterSource(monster, fileSource) {
	return normalizeSource(readProperty(monster, "source") || fileSource);
}

function assertNoCopyCycle(stack, currentKey) {
	if (!stack.includes(currentKey)) return;
	throw new Error(
		`Circular _copy chain: ${[...stack, currentKey].join(" -> ")}`,
	);
}

function clonePlainMonster(monster, monsterSource) {
	const resolved = clone(monster);
	if (!resolved.source) resolved.source = monsterSource;
	return resolved;
}

function requireBaseMonster(monster, monsterSource, index) {
	const copy = readProperty(monster, "_copy");
	const baseEntry = findBaseMonster(copy, monsterSource, index);
	if (baseEntry) return baseEntry;
	throw new Error(
		`Base monster not found for ${readProperty(monster, "name")} (${monsterSource}): ${readProperty(copy, "name")}`,
	);
}

const COPY_CONTROL_FIELDS = new Set(["_copy", "_mod"]);

function overlayCopiedMonster(resolved, monster) {
	for (const [key, value] of Object.entries(monster)) {
		if (COPY_CONTROL_FIELDS.has(key)) continue;
		resolved[key] = clone(value);
	}
}

function fillResolvedSource(resolved, monsterSource) {
	if (!resolved.source) resolved.source = monsterSource;
}

function applyMonsterCopyMods(resolved, monster, monsterSource, warnings) {
	const copy = readProperty(monster, "_copy");
	applyCopyMods(
		resolved,
		readProperty(copy, "_mod"),
		warnings,
		`${readProperty(monster, "name")} (${monsterSource})`,
	);
}

function forceCopiedMonsterName(resolved, monster) {
	const name = readProperty(monster, "name");
	if (name) resolved.name = clone(name);
}

function removeCopyControlFields(resolved) {
	delete resolved._copy;
	delete resolved._mod;
}

function resolveCopiedMonster(
	monster,
	monsterSource,
	currentKey,
	index,
	warnings,
	stack,
) {
	const baseEntry = requireBaseMonster(monster, monsterSource, index);
	const resolved = resolveMonster(
		baseEntry.monster,
		baseEntry.fileSource,
		index,
		warnings,
		[...stack, currentKey],
	);
	overlayCopiedMonster(resolved, monster);
	fillResolvedSource(resolved, monsterSource);
	applyMonsterCopyMods(resolved, monster, monsterSource, warnings);
	forceCopiedMonsterName(resolved, monster);
	removeCopyControlFields(resolved);
	return resolved;
}

function resolveMonster(monster, fileSource, index, warnings, stack = []) {
	const monsterSource = getMonsterSource(monster, fileSource);
	const currentKey = monsterKey(readProperty(monster, "name"), monsterSource);
	assertNoCopyCycle(stack, currentKey);
	if (!readProperty(monster, "_copy")) {
		return clonePlainMonster(monster, monsterSource);
	}
	return resolveCopiedMonster(
		monster,
		monsterSource,
		currentKey,
		index,
		warnings,
		stack,
	);
}

const EXCLUDED_BESTIARY_FILES = new Set([
	"all.json",
	"legendarygroups.json",
	"index.json",
]);

function isBestiaryDataFile(entry) {
	if (!entry.isFile()) return false;
	const name = entry.name.toLowerCase();
	if (!name.endsWith(".json")) return false;
	return !EXCLUDED_BESTIARY_FILES.has(name);
}

async function loadBestiaryFile(entry) {
	const filePath = path.join(BESTIARY_DIR, entry.name);
	const data = JSON.parse(await fs.readFile(filePath, "utf8"));
	return {
		name: entry.name,
		path: filePath,
		data,
		fileSource: getFileSource(entry.name, data),
		monsters: getMonsterList(data),
	};
}

async function loadBestiaryFiles() {
	const entries = await fs.readdir(BESTIARY_DIR, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		if (!isBestiaryDataFile(entry)) continue;
		files.push(await loadBestiaryFile(entry));
	}
	return files;
}

function indexMonster(index, file, monster) {
	const name = readProperty(monster, "name");
	if (!name) return;
	const source = normalizeSource(
		readProperty(monster, "source") || file.fileSource,
	);
	index.set(monsterKey(name, source), {
		monster,
		fileSource: file.fileSource,
	});
}

function buildIndex(files) {
	const index = new Map();
	for (const file of files) {
		for (const monster of file.monsters) indexMonster(index, file, monster);
	}
	return index;
}

function createMaterializationContext(files) {
	return {
		index: buildIndex(files),
		warnings: [],
		changedFiles: 0,
		materializedMonsters: 0,
	};
}

function hasMonsterCopy(monster) {
	return Boolean(readProperty(monster, "_copy"));
}

function updateMaterializedMonsterIndex(context, file, resolved) {
	const source = readProperty(resolved, "source") || file.fileSource;
	context.index.set(monsterKey(readProperty(resolved, "name"), source), {
		monster: resolved,
		fileSource: file.fileSource,
	});
}

function reportMaterializedMonster(resolved) {
	if (!isVerbose) return;
	console.log(
		`materialized ${readProperty(resolved, "name")} (${readProperty(resolved, "source")})`,
	);
}

function materializeMonsterAt(context, file, index) {
	const monster = file.monsters[index];
	if (!hasMonsterCopy(monster)) return false;
	const resolved = resolveMonster(
		monster,
		file.fileSource,
		context.index,
		context.warnings,
	);
	file.monsters[index] = resolved;
	updateMaterializedMonsterIndex(context, file, resolved);
	context.materializedMonsters += 1;
	reportMaterializedMonster(resolved);
	return true;
}

async function persistMaterializedFile(file) {
	if (isDryRun) return;
	await fs.writeFile(
		file.path,
		`${JSON.stringify(file.data, null, 2)}\n`,
		"utf8",
	);
}

async function materializeBestiaryFile(context, file) {
	let changed = false;
	for (let index = 0; index < file.monsters.length; index += 1) {
		if (materializeMonsterAt(context, file, index)) changed = true;
	}
	if (!changed) return;
	context.changedFiles += 1;
	await persistMaterializedFile(file);
}

function reportMaterializationWarnings(warnings) {
	for (const warning of warnings) console.warn(`Warning: ${warning}`);
}

function materializationSummary(context) {
	const prefix = isDryRun ? "Dry run" : "Done";
	return `${prefix}: materialized ${context.materializedMonsters} monsters in ${context.changedFiles} files.`;
}

function reportMaterializationSummary(context) {
	console.log(materializationSummary(context));
	if (context.warnings.length > 0) {
		console.log(`Warnings: ${context.warnings.length}`);
	}
}

async function main() {
	const files = await loadBestiaryFiles();
	const context = createMaterializationContext(files);
	for (const file of files) await materializeBestiaryFile(context, file);
	reportMaterializationWarnings(context.warnings);
	reportMaterializationSummary(context);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
