import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

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

function clone(value) {
	return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function normalizeSource(source) {
	return String(source || "").trim().toUpperCase();
}

function monsterKey(name, source) {
	return `${String(name || "").trim().toLowerCase()}|${normalizeSource(source)}`;
}

function getFileSource(fileName, data) {
	return normalizeSource(
		data?._meta?.sources?.[0]?.json ||
			path.parse(fileName).name.replace(/^bestiary-/i, ""),
	);
}

function getMonsterList(data) {
	if (Array.isArray(data)) return data;
	return data?.monster || data?.monsters || data?.results || [];
}

function toArray(value) {
	if (value === undefined || value === null) return [];
	return Array.isArray(value) ? value : [value];
}

function escapeRegExp(value) {
	return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceTextInValue(value, mod) {
	if (value === undefined || value === null) return value;
	const replace = String(mod.replace ?? "");
	if (!replace) return value;

	const regex = new RegExp(escapeRegExp(replace), mod.flags || "g");
	const serialized = JSON.stringify(value);
	return JSON.parse(serialized.replace(regex, mod.with ?? ""));
}

function entryName(value) {
	if (value && typeof value === "object") {
		return value.name || value.id || value.title || "";
	}
	return value;
}

function matchesEntry(value, expected) {
	return String(entryName(value)).toLowerCase() === String(expected).toLowerCase();
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

function getPrimarySpellcasting(target) {
	if (!Array.isArray(target.spellcasting)) target.spellcasting = [];
	if (!target.spellcasting[0]) target.spellcasting[0] = { name: "Spellcasting" };
	return target.spellcasting[0];
}

function addSpells(target, mod) {
	const block = getPrimarySpellcasting(target);

	if (mod.will) {
		if (!Array.isArray(block.will)) block.will = [];
		block.will.push(...clone(toArray(mod.will)));
	}

	if (mod.daily) {
		if (!block.daily || typeof block.daily !== "object") block.daily = {};
		for (const [key, spells] of Object.entries(mod.daily)) {
			if (!Array.isArray(block.daily[key])) block.daily[key] = [];
			block.daily[key].push(...clone(toArray(spells)));
		}
	}

	if (mod.spells) {
		if (!block.spells || typeof block.spells !== "object") block.spells = {};
		for (const [level, spellInfo] of Object.entries(mod.spells)) {
			if (!block.spells[level] || typeof block.spells[level] !== "object") {
				block.spells[level] = {};
			}
			if (!Array.isArray(block.spells[level].spells)) {
				block.spells[level].spells = [];
			}
			if (spellInfo && typeof spellInfo === "object" && !Array.isArray(spellInfo)) {
				for (const [key, value] of Object.entries(spellInfo)) {
					if (key === "spells") continue;
					block.spells[level][key] = clone(value);
				}
				block.spells[level].spells.push(...clone(toArray(spellInfo.spells)));
			} else {
				block.spells[level].spells.push(...clone(toArray(spellInfo)));
			}
		}
	}
}

function replaceInList(list, replacements) {
	if (!Array.isArray(list)) return;
	for (const replacement of replacements) {
		const replace = replacement?.replace;
		if (!replace) continue;
		for (let i = 0; i < list.length; i += 1) {
			if (String(list[i]) === String(replace)) list[i] = replacement.with;
		}
	}
}

function replaceSpells(target, mod) {
	const blocks = Array.isArray(target.spellcasting) ? target.spellcasting : [];
	for (const block of blocks) {
		if (mod.will) replaceInList(block.will, toArray(mod.will));
		if (mod.daily && block.daily) {
			for (const [key, replacements] of Object.entries(mod.daily)) {
				replaceInList(block.daily[key], toArray(replacements));
			}
		}
		if (mod.spells && block.spells) {
			for (const [level, replacements] of Object.entries(mod.spells)) {
				replaceInList(block.spells[level]?.spells, toArray(replacements));
			}
		}
	}
}

function removeFromList(list, items) {
	if (!Array.isArray(list)) return;
	const removeSet = new Set(toArray(items).map((item) => String(item)));
	for (let i = list.length - 1; i >= 0; i -= 1) {
		if (removeSet.has(String(list[i]))) list.splice(i, 1);
	}
}

function removeSpells(target, mod) {
	const blocks = Array.isArray(target.spellcasting) ? target.spellcasting : [];
	for (const block of blocks) {
		if (mod.will) removeFromList(block.will, mod.will);
		if (mod.daily && block.daily) {
			for (const [key, spells] of Object.entries(mod.daily)) {
				removeFromList(block.daily[key], spells);
			}
		}
		if (mod.spells && block.spells) {
			for (const [level, spells] of Object.entries(mod.spells)) {
				removeFromList(block.spells[level]?.spells, spells);
			}
		}
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

function applyMod(target, prop, mod, warnings, context) {
	if (mod === "remove") {
		delete target[prop];
		return;
	}
	if (!mod || typeof mod !== "object") {
		warnings.push(`${context}: unsupported mod ${JSON.stringify(mod)} on ${prop}`);
		return;
	}

	switch (mod.mode) {
		case "replaceTxt": {
			if (Array.isArray(mod.props)) {
				for (const targetProp of mod.props) {
					target[targetProp] = replaceTextInValue(target[targetProp], mod);
				}
			} else if (prop === "*") {
				const replaced = replaceTextInValue(target, mod);
				Object.keys(target).forEach((key) => delete target[key]);
				Object.assign(target, replaced);
			} else {
				target[prop] = replaceTextInValue(target[prop], mod);
			}
			return;
		}
		case "appendArr":
		case "prependArr":
		case "appendIfNotExistsArr":
		case "insertArr":
		case "replaceArr":
		case "removeArr":
			applyArrayMod(target, prop, mod);
			return;
		case "setProp":
			target[mod.prop] = clone(mod.value);
			return;
		case "addSkills":
			target.skill = { ...(target.skill || {}), ...clone(mod.skills || {}) };
			return;
		case "addSpells":
			addSpells(target, mod);
			return;
		case "replaceSpells":
			replaceSpells(target, mod);
			return;
		case "removeSpells":
			removeSpells(target, mod);
			return;
		default:
			warnings.push(`${context}: unsupported mode "${mod.mode}" on ${prop}`);
	}
}

function applyCopyMods(target, mods, warnings, context) {
	if (!mods || typeof mods !== "object") return;
	for (const [prop, rawMods] of Object.entries(mods)) {
		for (const mod of toArray(rawMods)) {
			applyMod(target, prop, mod, warnings, context);
		}
	}
}

function findBaseMonster(copy, fallbackSource, index) {
	const baseSource = normalizeSource(copy.source || fallbackSource);
	const exact = index.get(monsterKey(copy.name, baseSource));
	if (exact) return exact;

	const prefix = `${String(copy.name || "").trim().toLowerCase()}|`;
	for (const [key, entry] of index.entries()) {
		if (key.startsWith(prefix)) return entry;
	}
	return null;
}

function resolveMonster(monster, fileSource, index, warnings, stack = []) {
	const monsterSource = normalizeSource(monster.source || fileSource);
	const currentKey = monsterKey(monster.name, monsterSource);

	if (stack.includes(currentKey)) {
		throw new Error(`Circular _copy chain: ${[...stack, currentKey].join(" -> ")}`);
	}

	if (!monster._copy) {
		const resolved = clone(monster);
		if (!resolved.source) resolved.source = monsterSource;
		return resolved;
	}

	const baseEntry = findBaseMonster(monster._copy, monsterSource, index);
	if (!baseEntry) {
		throw new Error(
			`Base monster not found for ${monster.name} (${monsterSource}): ${monster._copy.name}`,
		);
	}

	const resolved = resolveMonster(
		baseEntry.monster,
		baseEntry.fileSource,
		index,
		warnings,
		[...stack, currentKey],
	);

	for (const [key, value] of Object.entries(monster)) {
		if (key === "_copy" || key === "_mod") continue;
		resolved[key] = clone(value);
	}
	if (!resolved.source) resolved.source = monsterSource;

	applyCopyMods(
		resolved,
		monster._copy._mod,
		warnings,
		`${monster.name} (${monsterSource})`,
	);

	delete resolved._copy;
	delete resolved._mod;
	return resolved;
}

async function loadBestiaryFiles() {
	const entries = await fs.readdir(BESTIARY_DIR, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		const name = entry.name.toLowerCase();
		if (
			!entry.isFile() ||
			!name.endsWith(".json") ||
			name === "legendarygroups.json" ||
			name === "index.json"
		) {
			continue;
		}

		const filePath = path.join(BESTIARY_DIR, entry.name);
		const data = JSON.parse(await fs.readFile(filePath, "utf8"));
		files.push({
			name: entry.name,
			path: filePath,
			data,
			fileSource: getFileSource(entry.name, data),
			monsters: getMonsterList(data),
		});
	}

	return files;
}

function buildIndex(files) {
	const index = new Map();
	for (const file of files) {
		for (const monster of file.monsters) {
			if (!monster?.name) continue;
			const source = normalizeSource(monster.source || file.fileSource);
			index.set(monsterKey(monster.name, source), {
				monster,
				fileSource: file.fileSource,
			});
		}
	}
	return index;
}

async function main() {
	const files = await loadBestiaryFiles();
	const index = buildIndex(files);
	const warnings = [];
	let changedFiles = 0;
	let materializedMonsters = 0;

	for (const file of files) {
		let changed = false;
		for (let i = 0; i < file.monsters.length; i += 1) {
			const monster = file.monsters[i];
			if (!monster?._copy) continue;

			const resolved = resolveMonster(
				monster,
				file.fileSource,
				index,
				warnings,
			);
			file.monsters[i] = resolved;
			index.set(monsterKey(resolved.name, resolved.source || file.fileSource), {
				monster: resolved,
				fileSource: file.fileSource,
			});
			changed = true;
			materializedMonsters += 1;

			if (isVerbose) {
				console.log(`materialized ${resolved.name} (${resolved.source})`);
			}
		}

		if (changed) {
			changedFiles += 1;
			if (!isDryRun) {
				await fs.writeFile(file.path, `${JSON.stringify(file.data, null, 2)}\n`, "utf8");
			}
		}
	}

	for (const warning of warnings) console.warn(`Warning: ${warning}`);

	console.log(
		`${isDryRun ? "Dry run" : "Done"}: materialized ${materializedMonsters} monsters in ${changedFiles} files.`,
	);
	if (warnings.length > 0) {
		console.log(`Warnings: ${warnings.length}`);
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
