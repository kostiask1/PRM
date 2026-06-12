import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, "..");
const DATABASE_DIR = path.join(ROOT_DIR, "database");
const BESTIARY_DIR = path.join(DATABASE_DIR, "bestiary");
const SPELLS_DIR = path.join(DATABASE_DIR, "spells");
const CONDITIONS_PATH = path.join(DATABASE_DIR, "conditions.json");
const DISEASES_PATH = path.join(DATABASE_DIR, "diseases.json");
const VARIANT_RULES_PATH = path.join(DATABASE_DIR, "variantrules.json");
const SKILLS_PATH = path.join(DATABASE_DIR, "skills.json");
const SENSES_PATH = path.join(DATABASE_DIR, "senses.json");
const SOURCES_PATH = path.join(DATABASE_DIR, "sources.json");
const BESTIARY_TOKENS_DIR = path.join(BESTIARY_DIR, "tokens");
const TMP_DIR = path.join(ROOT_DIR, ".tmp-5etools-update");
const CONDITION_PRUNE_KEYS = new Set([
	"page",
	"srd",
	"srd52",
	"basicRules2024",
	"basicRules",
	"source",
	"reprintedAs",
]);
const VARIANT_RULE_PRUNE_KEYS = new Set([
	"page",
	"srd",
	"srd52",
	"basicRules2024",
	"basicRules",
	"source",
	"reprintedAs",
]);
const SKILL_PRUNE_KEYS = new Set([
	"page",
	"srd",
	"srd52",
	"basicRules2024",
	"basicRules",
	"source",
	"reprintedAs",
]);
const SENSE_PRUNE_KEYS = new Set([
	"page",
	"srd",
	"srd52",
	"basicRules2024",
	"basicRules",
	"source",
	"reprintedAs",
]);
const VARIANT_RULE_NAMES_WITH_INLINE_OBJECTS_TO_REMOVE = new Set([
	"Customizing Ability Scores",
]);
const CUSTOMIZING_ABILITY_SCORES_POINT_BUY_LINK =
	"[Point Buy Calculator](https://redcap.press/character-creation?method=Point+Buy)";

const OWNER = "5etools-mirror-3";
const REPO = "5etools-src";
const IMG_OWNER = "5etools-mirror-3";
const IMG_REPO = "5etools-img";
const IMG_REF = "main";
const DEFAULT_REF = "main";
const args = new Set(process.argv.slice(2));
const isDryRun = args.has("--dry-run") || args.has("--check");
const keepSources = args.has("--keep-sources");
const isVerbose = args.has("--verbose");
const refArg = process.argv.find((arg) => arg.startsWith("--ref="));
const ref = refArg ? refArg.slice("--ref=".length) : DEFAULT_REF;

if (args.has("--help") || args.has("-h")) {
	console.log(`Usage: node scripts/update-5etools-data.mjs [--dry-run] [--keep-sources] [--verbose] [--ref=main]

Downloads spell and bestiary JSON from:
  https://github.com/${OWNER}/${REPO}/tree/${ref}/data/spells
  https://github.com/${OWNER}/${REPO}/tree/${ref}/data/bestiary
  https://github.com/${OWNER}/${REPO}/blob/${ref}/data/conditionsdiseases.json
  https://github.com/${OWNER}/${REPO}/blob/${ref}/data/variantrules.json
  https://github.com/${OWNER}/${REPO}/blob/${ref}/data/skills.json
  https://github.com/${OWNER}/${REPO}/blob/${ref}/data/senses.json
  https://github.com/${OWNER}/${REPO}/blob/${ref}/data/generated/gendata-nav-adventure-book-index.json
Downloads missing new bestiary tokens from:
  https://github.com/${IMG_OWNER}/${IMG_REPO}/tree/${IMG_REF}/bestiary/{source}

Excluded files: fluff, foundry/foundy, template.
After download, materializes bestiary _copy entries and rebuilds all.json files.`);
	process.exit(0);
}

function isJsonFile(name) {
	return name.toLowerCase().endsWith(".json");
}

function isExcludedDataFile(name) {
	const normalized = name.toLowerCase();
	return (
		normalized.includes("fluff") ||
		normalized.includes("foundry") ||
		normalized.includes("foundy") ||
		normalized.includes("template")
	);
}

function shouldKeepRemoteFile(name) {
	return isJsonFile(name) && !isExcludedDataFile(name);
}

async function exists(filePath) {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
}

async function fetchJson(url) {
	const response = await fetch(url, {
		headers: {
			Accept: "application/vnd.github+json",
			"User-Agent": "dnd-session-manager-data-updater",
		},
	});
	if (!response.ok) {
		throw new Error(
			`Failed to fetch ${url}: ${response.status} ${response.statusText}`,
		);
	}
	return response.json();
}

async function fetchText(url) {
	const response = await fetch(url, {
		headers: {
			"User-Agent": "dnd-session-manager-data-updater",
		},
	});
	if (!response.ok) {
		throw new Error(
			`Failed to download ${url}: ${response.status} ${response.statusText}`,
		);
	}
	return response.text();
}

async function fetchBinaryIfExists(url) {
	const response = await fetch(url, {
		headers: {
			"User-Agent": "dnd-session-manager-data-updater",
		},
	});
	if (response.status === 404) return null;
	if (!response.ok) {
		throw new Error(
			`Failed to download ${url}: ${response.status} ${response.statusText}`,
		);
	}
	return Buffer.from(await response.arrayBuffer());
}

async function listRemoteFiles(remotePath) {
	const url = new URL(
		`https://api.github.com/repos/${OWNER}/${REPO}/contents/${remotePath}`,
	);
	url.searchParams.set("ref", ref);
	const entries = await fetchJson(url.toString());
	if (!Array.isArray(entries)) {
		throw new Error(`Unexpected GitHub contents response for ${remotePath}`);
	}

	return entries
		.filter(
			(entry) => entry.type === "file" && shouldKeepRemoteFile(entry.name),
		)
		.map((entry) => ({
			name: entry.name,
			downloadUrl: entry.download_url,
		}))
		.sort((a, b) => a.name.localeCompare(b.name));
}

async function downloadFiles(remotePath, targetDir) {
	const files = await listRemoteFiles(remotePath);
	await fs.mkdir(targetDir, { recursive: true });

	for (const file of files) {
		if (!file.downloadUrl) {
			throw new Error(`Missing download URL for ${remotePath}/${file.name}`);
		}
		if (isVerbose) console.log(`download ${remotePath}/${file.name}`);
		const content = await fetchText(file.downloadUrl);
		JSON.parse(content);
		await fs.writeFile(
			path.join(targetDir, file.name),
			content.endsWith("\n") ? content : `${content}\n`,
			"utf8",
		);
	}

	return files.length;
}

async function downloadFile(remotePath, targetPath) {
	const url = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${ref}/${remotePath}`;
	if (isVerbose) console.log(`download ${remotePath}`);
	const content = await fetchText(url);
	JSON.parse(content);
	await fs.mkdir(path.dirname(targetPath), { recursive: true });
	await fs.writeFile(
		targetPath,
		content.endsWith("\n") ? content : `${content}\n`,
		"utf8",
	);
	return 1;
}

async function readJson(filePath) {
	return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function normalizeMonsterKey(monster) {
	const name = String(monster?.name || "").trim().toLowerCase();
	const source = String(monster?.source || "").trim().toUpperCase();
	return name && source ? `${name}|${source}` : "";
}

function isSafeTokenFileName(fileName) {
	return (
		fileName &&
		!/[<>:"/\\|?*\u0000-\u001F]/.test(fileName) &&
		!/[. ]$/.test(fileName)
	);
}

function getTokenFileName(monster) {
	const name = String(monster?.name || "").trim();
	return name ? `${name}.webp` : "";
}

function getTokenFilePath(monster) {
	return path.join(
		BESTIARY_TOKENS_DIR,
		String(monster?.source || "").trim(),
		getTokenFileName(monster),
	);
}

function getRemoteTokenUrl(monster) {
	const source = String(monster?.source || "").trim();
	const fileName = getTokenFileName(monster);
	return `https://raw.githubusercontent.com/${IMG_OWNER}/${IMG_REPO}/${IMG_REF}/bestiary/${encodeURIComponent(source)}/${encodeURIComponent(fileName)}`;
}

function collectMonstersFromBestiaryData(data) {
	const monsters = Array.isArray(data)
		? data
		: Array.isArray(data?.monster)
			? data.monster
			: [];
	return monsters.filter((monster) => normalizeMonsterKey(monster));
}

async function collectMonstersFromJsonFiles(dir) {
	if (!(await exists(dir))) return [];
	const entries = await fs.readdir(dir, { withFileTypes: true });
	const monsters = [];
	for (const entry of entries) {
		if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".json"))
			continue;
		const data = await readJson(path.join(dir, entry.name));
		monsters.push(...collectMonstersFromBestiaryData(data));
	}
	return monsters;
}

async function collectCurrentBestiaryMonsterKeys() {
	const allPath = path.join(BESTIARY_DIR, "all.json");
	if (await exists(allPath)) {
		return new Set(
			collectMonstersFromBestiaryData(await readJson(allPath)).map(
				normalizeMonsterKey,
			),
		);
	}
	return new Set(
		(await collectMonstersFromJsonFiles(BESTIARY_DIR)).map(normalizeMonsterKey),
	);
}

function getNewMonsters(currentKeys, monsters = []) {
	const seen = new Set();
	const result = [];
	for (const monster of monsters) {
		const key = normalizeMonsterKey(monster);
		if (!key || currentKeys.has(key) || seen.has(key)) continue;
		seen.add(key);
		result.push(monster);
	}
	return result;
}

async function downloadMissingNewBestiaryTokens(newMonsters = []) {
	let downloaded = 0;
	let missing = 0;
	let skipped = 0;

	for (const monster of newMonsters) {
		const fileName = getTokenFileName(monster);
		if (!isSafeTokenFileName(fileName)) {
			skipped += 1;
			console.warn(
				`skip token: unsafe local filename for ${monster.name} (${monster.source})`,
			);
			continue;
		}

		const targetPath = getTokenFilePath(monster);
		if (await exists(targetPath)) continue;

		try {
			const content = await fetchBinaryIfExists(getRemoteTokenUrl(monster));
			if (!content) {
				missing += 1;
				if (isVerbose) {
					console.log(`missing token ${monster.source}/${fileName}`);
				}
				continue;
			}

			await fs.mkdir(path.dirname(targetPath), { recursive: true });
			await fs.writeFile(targetPath, content);
			downloaded += 1;
			if (isVerbose) console.log(`download token ${monster.source}/${fileName}`);
		} catch (error) {
			missing += 1;
			console.warn(
				`failed token ${monster.source}/${fileName}: ${error.message}`,
			);
		}
	}

	return { downloaded, missing, skipped };
}

function getLocalExhaustionEntries(currentConditions) {
	const conditions = Array.isArray(currentConditions?.condition)
		? currentConditions.condition
		: [];
	return conditions.filter(
		(entry) => String(entry?.name || "").toLowerCase() === "exhaustion",
	);
}

function conditionKey(entry) {
	return `${String(entry?.name || "")
		.trim()
		.toLowerCase()}|${String(entry?.source || "")
		.trim()
		.toUpperCase()}`;
}

function conditionNameKey(entry) {
	return String(entry?.name || "")
		.trim()
		.toLowerCase();
}

function getSourcePriority(source) {
	const normalized = String(source || "").toUpperCase();
	if (normalized === "XPHB" || normalized === "XDMG") return 3;
	if (normalized === "PHB" || normalized === "DMG") return 2;
	return 1;
}

function pickPreferredCondition(current, candidate) {
	if (!current) return candidate;
	if (candidate?.basicRules2024 && !current?.basicRules2024) return candidate;
	if (!candidate?.basicRules2024 && current?.basicRules2024) return current;

	const currentPriority = getSourcePriority(current?.source);
	const candidatePriority = getSourcePriority(candidate?.source);
	if (candidatePriority !== currentPriority) {
		return candidatePriority > currentPriority ? candidate : current;
	}
	return current;
}

function dedupeConditionsByName(items = []) {
	const byName = new Map();
	for (const item of items) {
		const key = conditionNameKey(item);
		if (!key) continue;
		byName.set(key, pickPreferredCondition(byName.get(key), item));
	}
	return [...byName.values()].sort((a, b) =>
		String(a.name || "").localeCompare(String(b.name || "")),
	);
}

function pruneConditionMeta(item) {
	if (!item || typeof item !== "object") return item;
	return Object.fromEntries(
		Object.entries(item).filter(([key]) => !CONDITION_PRUNE_KEYS.has(key)),
	);
}

function pruneVariantRuleMeta(item) {
	if (!item || typeof item !== "object") return item;
	return Object.fromEntries(
		Object.entries(item).filter(([key]) => !VARIANT_RULE_PRUNE_KEYS.has(key)),
	);
}

function removeInlineObjects(value) {
	if (Array.isArray(value)) {
		return value
			.filter((item) => item?.type !== "inline")
			.map((item) => removeInlineObjects(item));
	}

	if (!value || typeof value !== "object") return value;

	return Object.fromEntries(
		Object.entries(value).map(([key, itemValue]) => [
			key,
			removeInlineObjects(itemValue),
		]),
	);
}

function addCustomizingAbilityScoresLink(rule) {
	if (!Array.isArray(rule?.entries)) return rule;
	const hasPointBuyLink = rule.entries.some((entry) =>
		String(entry || "").includes("https://redcap.press/character-creation"),
	);
	if (hasPointBuyLink) return rule;

	return {
		...rule,
		entries: [...rule.entries, CUSTOMIZING_ABILITY_SCORES_POINT_BUY_LINK],
	};
}

function normalizeVariantRule(item) {
	const pruned = pruneVariantRuleMeta(item);
	if (
		VARIANT_RULE_NAMES_WITH_INLINE_OBJECTS_TO_REMOVE.has(
			String(pruned?.name || ""),
		)
	) {
		return addCustomizingAbilityScoresLink(removeInlineObjects(pruned));
	}
	return pruned;
}

function pruneSkillMeta(item) {
	if (!item || typeof item !== "object") return item;
	return Object.fromEntries(
		Object.entries(item).filter(([key]) => !SKILL_PRUNE_KEYS.has(key)),
	);
}

function pruneSenseMeta(item) {
	if (!item || typeof item !== "object") return item;
	return Object.fromEntries(
		Object.entries(item).filter(([key]) => !SENSE_PRUNE_KEYS.has(key)),
	);
}

function normalizeConditionsData(data) {
	return {
		condition: dedupeConditionsByName(data.condition || []).map(
			pruneConditionMeta,
		),
		status: dedupeConditionsByName(data.status || []).map(pruneConditionMeta),
	};
}

function normalizeDiseasesData(data) {
	return {
		disease: dedupeConditionsByName(data.disease || []).map(pruneConditionMeta),
	};
}

function normalizeSourceEntries(data) {
	const seen = new Set();
	const result = [];
	const sections = [data?.adventure, data?.book];

	for (const section of sections) {
		if (!Array.isArray(section)) continue;

		for (const item of section) {
			const name = String(item?.name || "").trim();
			const source = String(item?.source || "").trim();
			if (!name || !source) continue;

			const key = `${name.toLowerCase()}|${source.toUpperCase()}`;
			if (seen.has(key)) continue;
			seen.add(key);
			result.push({ name, source });
		}
	}

	return result.sort((a, b) => a.name.localeCompare(b.name));
}

async function writeConditionsWithLocalExhaustion(downloadedPath) {
	const downloaded = await readJson(downloadedPath);
	const current = (await exists(CONDITIONS_PATH))
		? await readJson(CONDITIONS_PATH)
		: null;
	const localExhaustion = getLocalExhaustionEntries(current);

	if (localExhaustion.length > 0) {
		if (!Array.isArray(downloaded.condition)) downloaded.condition = [];
		const existing = new Set(downloaded.condition.map(conditionKey));

		for (const entry of localExhaustion) {
			const key = conditionKey(entry);
			if (existing.has(key)) continue;
			downloaded.condition.push(entry);
			existing.add(key);
		}
	}

	const normalized = normalizeConditionsData(downloaded);
	const normalizedDiseases = normalizeDiseasesData(downloaded);
	await fs.writeFile(
		CONDITIONS_PATH,
		`${JSON.stringify(normalized, null, 2)}\n`,
		"utf8",
	);
	await fs.writeFile(
		DISEASES_PATH,
		`${JSON.stringify(normalizedDiseases, null, 2)}\n`,
		"utf8",
	);
	return localExhaustion.length;
}

async function writeVariantRules(downloadedPath) {
	const downloaded = await readJson(downloadedPath);
	const normalized = {
		variantrule: dedupeConditionsByName(downloaded.variantrule || []).map(
			normalizeVariantRule,
		),
	};
	await fs.writeFile(
		VARIANT_RULES_PATH,
		`${JSON.stringify(normalized, null, 2)}\n`,
		"utf8",
	);
	return normalized.variantrule.length;
}

async function writeSkills(downloadedPath) {
	const downloaded = await readJson(downloadedPath);
	const normalized = {
		skill: dedupeConditionsByName(downloaded.skill || []).map(pruneSkillMeta),
	};
	await fs.writeFile(
		SKILLS_PATH,
		`${JSON.stringify(normalized, null, 2)}\n`,
		"utf8",
	);
	return normalized.skill.length;
}

async function writeSenses(downloadedPath) {
	const downloaded = await readJson(downloadedPath);
	const normalized = {
		sense: dedupeConditionsByName(downloaded.sense || []).map(pruneSenseMeta),
	};
	await fs.writeFile(
		SENSES_PATH,
		`${JSON.stringify(normalized, null, 2)}\n`,
		"utf8",
	);
	return normalized.sense.length;
}

async function writeSources(downloadedPath) {
	const downloaded = await readJson(downloadedPath);
	const normalized = normalizeSourceEntries(downloaded);
	await fs.mkdir(path.dirname(SOURCES_PATH), { recursive: true });
	await fs.writeFile(
		SOURCES_PATH,
		`${JSON.stringify(normalized, null, 2)}\n`,
		"utf8",
	);
	return normalized.length;
}

async function removeJsonFiles(dir) {
	if (!(await exists(dir))) return;
	const entries = await fs.readdir(dir, { withFileTypes: true });
	for (const entry of entries) {
		if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
			await fs.rm(path.join(dir, entry.name));
		}
	}
}

async function copyJsonFiles(fromDir, toDir) {
	await fs.mkdir(toDir, { recursive: true });
	const entries = await fs.readdir(fromDir, { withFileTypes: true });
	for (const entry of entries) {
		if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".json"))
			continue;
		await fs.copyFile(
			path.join(fromDir, entry.name),
			path.join(toDir, entry.name),
		);
	}
}

function runNodeScript(scriptPath, scriptArgs = []) {
	const result = spawnSync(process.execPath, [scriptPath, ...scriptArgs], {
		cwd: ROOT_DIR,
		stdio: "inherit",
		env: process.env,
	});
	if (result.status !== 0) {
		throw new Error(
			`${path.basename(scriptPath)} failed with exit code ${result.status}`,
		);
	}
}

async function cleanupUnneededSupportFiles() {
	if (keepSources || isDryRun) return;

	await Promise.all([
		fs.rm(path.join(BESTIARY_DIR, "index.json"), { force: true }),
		fs.rm(path.join(SPELLS_DIR, "index.json"), { force: true }),
	]);
}

async function main() {
	const tmpBestiaryDir = path.join(TMP_DIR, "bestiary");
	const tmpSpellsDir = path.join(TMP_DIR, "spells");
	const tmpConditionsPath = path.join(TMP_DIR, "conditionsdiseases.json");
	const tmpVariantRulesPath = path.join(TMP_DIR, "variantrules.json");
	const tmpSkillsPath = path.join(TMP_DIR, "skills.json");
	const tmpSensesPath = path.join(TMP_DIR, "senses.json");
	const tmpSourcesPath = path.join(
		TMP_DIR,
		"gendata-nav-adventure-book-index.json",
	);

	await fs.rm(TMP_DIR, { recursive: true, force: true });
	const [bestiaryCount, spellCount] = await Promise.all([
		downloadFiles("data/bestiary", tmpBestiaryDir),
		downloadFiles("data/spells", tmpSpellsDir),
		downloadFile("data/conditionsdiseases.json", tmpConditionsPath),
		downloadFile("data/variantrules.json", tmpVariantRulesPath),
		downloadFile("data/skills.json", tmpSkillsPath),
		downloadFile("data/senses.json", tmpSensesPath),
		downloadFile(
			"data/generated/gendata-nav-adventure-book-index.json",
			tmpSourcesPath,
		),
	]);

	console.log(
		`${isDryRun ? "Dry run" : "Downloaded"}: ${bestiaryCount} bestiary JSON files, ${spellCount} spell JSON files, conditionsdiseases.json, variantrules.json, skills.json, senses.json, and gendata-nav-adventure-book-index.json from ${OWNER}/${REPO}@${ref}.`,
	);

	if (isDryRun) {
		await fs.rm(TMP_DIR, { recursive: true, force: true });
		return;
	}

	const currentMonsterKeys = await collectCurrentBestiaryMonsterKeys();
	const downloadedMonsters = await collectMonstersFromJsonFiles(tmpBestiaryDir);
	const newMonsters = getNewMonsters(currentMonsterKeys, downloadedMonsters);

	await Promise.all([
		removeJsonFiles(BESTIARY_DIR),
		removeJsonFiles(SPELLS_DIR),
	]);
	await Promise.all([
		copyJsonFiles(tmpBestiaryDir, BESTIARY_DIR),
		copyJsonFiles(tmpSpellsDir, SPELLS_DIR),
	]);
	await writeConditionsWithLocalExhaustion(tmpConditionsPath);
	await writeVariantRules(tmpVariantRulesPath);
	await writeSkills(tmpSkillsPath);
	await writeSenses(tmpSensesPath);
	const sourcesCount = await writeSources(tmpSourcesPath);
	const tokenResult = await downloadMissingNewBestiaryTokens(newMonsters);
	await fs.rm(TMP_DIR, { recursive: true, force: true });

	runNodeScript(path.join("scripts", "materialize-bestiary-copies.mjs"));
	runNodeScript(
		path.join("scripts", "build-database-bundles.mjs"),
		[keepSources ? "" : "--delete-sources"].filter(Boolean),
	);
	await cleanupUnneededSupportFiles();

	console.log(
		`Done: 5etools data updated. Wrote ${sourcesCount} sources. New monsters: ${newMonsters.length}; tokens downloaded: ${tokenResult.downloaded}; missing: ${tokenResult.missing}; skipped: ${tokenResult.skipped}.`,
	);
}

main().catch(async (error) => {
	await fs.rm(TMP_DIR, { recursive: true, force: true }).catch(() => {});
	console.error(error);
	process.exit(1);
});
