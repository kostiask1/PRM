import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, "..");
const BESTIARY_DIR = path.join(ROOT_DIR, "database", "bestiary");
const SPELLS_DIR = path.join(ROOT_DIR, "database", "spells");
const BESTIARY_BUNDLE_PATH = path.join(BESTIARY_DIR, "all.json");
const SPELLS_BUNDLE_PATH = path.join(SPELLS_DIR, "all.json");

const args = new Set(process.argv.slice(2));
const isDryRun = args.has("--dry-run") || args.has("--check");
const shouldDeleteSources = args.has("--delete-sources");

const BESTIARY_FIELDS = new Set([
	"name",
	"source",
	"size",
	"type",
	"alignment",
	"ac",
	"hp",
	"speed",
	"str",
	"dex",
	"con",
	"int",
	"wis",
	"cha",
	"save",
	"skill",
	"languages",
	"cr",
	"trait",
	"bonus",
	"action",
	"reaction",
	"legendary",
	"lairActions",
	"regionalEffects",
	"legendaryGroup",
	"spellcasting",
	"spell_list",
	"senses",
	"vulnerable",
	"resist",
	"immune",
	"conditionImmune",
	"desc",
	"originalBestiaryName",
]);

const SPELL_FIELDS = new Set([
	"name",
	"source",
	"page",
	"classes",
	"level",
	"school",
	"time",
	"range",
	"components",
	"duration",
	"entries",
	"entriesHigherLevel",
]);

if (args.has("--help") || args.has("-h")) {
	console.log(`Usage: node scripts/build-database-bundles.mjs [--dry-run] [--delete-sources]

Combines monster and spell source files into:
  database/bestiary/all.json
  database/spells/all.json

Use --delete-sources to remove merged source JSON files after all.json files are written.`);
	process.exit(0);
}

function normalizeSource(source) {
	return String(source || "").trim().toUpperCase();
}

function getList(data, keys) {
	if (Array.isArray(data)) return data;
	for (const key of keys) {
		if (Array.isArray(data?.[key])) return data[key];
	}
	return [];
}

function getBestiaryFileSource(fileName, data) {
	return normalizeSource(
		data?._meta?.sources?.[0]?.json ||
			path.parse(fileName).name.replace(/^bestiary-/i, ""),
	);
}

function sortByNameAndSource(a, b) {
	return (
		String(a.name || "").localeCompare(String(b.name || "")) ||
		String(a.source || "").localeCompare(String(b.source || ""))
	);
}

function pickFields(value, fields) {
	return Object.fromEntries(
		Object.entries(value || {}).filter(([key]) => fields.has(key)),
	);
}

function getSpellClassInfo(spellSources, spell) {
	const spellName = String(spell.name || "").split("|")[0];
	const sourceKey = Object.keys(spellSources).find(
		(key) => key.toUpperCase() === String(spell.source || "").toUpperCase(),
	);
	const sourceSpells = sourceKey ? spellSources[sourceKey] : null;
	const info = sourceSpells?.[spellName];
	if (!info) return [];

	const classes = new Set();
	for (const entry of [...(info.class || []), ...(info.classVariant || [])]) {
		if (entry?.name) classes.add(entry.name);
	}
	return [...classes].sort((a, b) => a.localeCompare(b));
}

function enrichSpell(spell, spellSources) {
	const classes = getSpellClassInfo(spellSources, spell);
	return pickFields(
		{
			...spell,
			classes,
		},
		SPELL_FIELDS,
	);
}

async function readJson(filePath) {
	return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function exists(filePath) {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
}

async function writeBundle(filePath, list) {
	if (isDryRun) return;
	await fs.writeFile(filePath, `${JSON.stringify(list, null, 2)}\n`, "utf8");
}

async function buildBestiaryBundle() {
	const entries = await fs.readdir(BESTIARY_DIR, { withFileTypes: true });
	const monsters = [];
	const sourceFiles = [];

	for (const entry of entries) {
		const name = entry.name.toLowerCase();
		if (
			!entry.isFile() ||
			!name.endsWith(".json") ||
			name === "all.json" ||
			name === "index.json" ||
			name === "legendarygroups.json"
		) {
			continue;
		}

		const filePath = path.join(BESTIARY_DIR, entry.name);
		sourceFiles.push(filePath);
		const data = await readJson(filePath);
		const fileSource = getBestiaryFileSource(entry.name, data);
		monsters.push(
			...getList(data, ["monster", "monsters", "results"]).map((monster) =>
				pickFields(
					{
						...monster,
						source: normalizeSource(monster.source || fileSource),
					},
					BESTIARY_FIELDS,
				),
			),
		);
	}

	if (monsters.length === 0 && (await exists(BESTIARY_BUNDLE_PATH))) {
		monsters.push(...(await readJson(BESTIARY_BUNDLE_PATH)));
	}

	monsters.sort(sortByNameAndSource);
	await writeBundle(BESTIARY_BUNDLE_PATH, monsters);
	return { count: monsters.length, sourceFiles };
}

async function buildSpellsBundle() {
	const indexPath = path.join(SPELLS_DIR, "index.json");
	const index = (await exists(indexPath)) ? await readJson(indexPath) : {};
	const spellSourcesPath = path.join(SPELLS_DIR, "sources.json");
	const spellSources = (await exists(spellSourcesPath))
		? await readJson(spellSourcesPath)
		: {};
	const spells = [];
	const sourceFiles = [];

	for (const [source, fileName] of Object.entries(index)) {
		const filePath = path.join(SPELLS_DIR, fileName);
		sourceFiles.push(filePath);
		if (!(await exists(filePath))) continue;

		const data = await readJson(filePath);
		spells.push(
			...getList(data, ["spell", "spells", "results"]).map((spell) =>
				enrichSpell(
					{
						...spell,
						source,
					},
					spellSources,
				),
			),
		);
	}

	if (spells.length === 0 && (await exists(SPELLS_BUNDLE_PATH))) {
		spells.push(
			...(await readJson(SPELLS_BUNDLE_PATH)).map((spell) =>
				enrichSpell(spell, spellSources),
			),
		);
	}

	spells.sort(sortByNameAndSource);
	await writeBundle(SPELLS_BUNDLE_PATH, spells);
	return { count: spells.length, sourceFiles };
}

async function deleteSourceFiles(files) {
	if (!shouldDeleteSources) return 0;

	let affected = 0;
	for (const filePath of files) {
		if (!(await exists(filePath))) continue;
		if (isDryRun) {
			affected += 1;
			continue;
		}
		await fs.rm(filePath);
		affected += 1;
	}
	return affected;
}

async function main() {
	const [bestiaryResult, spellsResult] = await Promise.all([
		buildBestiaryBundle(),
		buildSpellsBundle(),
	]);
	const monsterCount = bestiaryResult.count;
	const spellCount = spellsResult.count;

	let deletedCount = 0;
	if (shouldDeleteSources) {
		if (monsterCount === 0 || spellCount === 0) {
			throw new Error("Refusing to delete source files because a bundle is empty.");
		}

		deletedCount += await deleteSourceFiles([
			...bestiaryResult.sourceFiles,
			...spellsResult.sourceFiles,
		]);
	}

	console.log(
		`${isDryRun ? "Dry run" : "Done"}: bundled ${monsterCount} monsters and ${spellCount} spells.`,
	);
	if (shouldDeleteSources) {
		console.log(
			`${isDryRun ? "Dry run" : "Done"}: deleted ${deletedCount} merged source files.`,
		);
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
