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
const TMP_DIR = path.join(ROOT_DIR, ".tmp-5etools-update");

const OWNER = "5etools-mirror-3";
const REPO = "5etools-src";
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
			"Accept": "application/vnd.github+json",
			"User-Agent": "dnd-session-manager-data-updater",
		},
	});
	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
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
		throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
	}
	return response.text();
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
		.filter((entry) => entry.type === "file" && shouldKeepRemoteFile(entry.name))
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
		await fs.writeFile(path.join(targetDir, file.name), content.endsWith("\n") ? content : `${content}\n`, "utf8");
	}

	return files.length;
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
		if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".json")) continue;
		await fs.copyFile(path.join(fromDir, entry.name), path.join(toDir, entry.name));
	}
}

function runNodeScript(scriptPath, scriptArgs = []) {
	const result = spawnSync(
		process.execPath,
		[scriptPath, ...scriptArgs],
		{
			cwd: ROOT_DIR,
			stdio: "inherit",
			env: process.env,
		},
	);
	if (result.status !== 0) {
		throw new Error(`${path.basename(scriptPath)} failed with exit code ${result.status}`);
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

	await fs.rm(TMP_DIR, { recursive: true, force: true });
	const [bestiaryCount, spellCount] = await Promise.all([
		downloadFiles("data/bestiary", tmpBestiaryDir),
		downloadFiles("data/spells", tmpSpellsDir),
	]);

	console.log(
		`${isDryRun ? "Dry run" : "Downloaded"}: ${bestiaryCount} bestiary JSON files and ${spellCount} spell JSON files from ${OWNER}/${REPO}@${ref}.`,
	);

	if (isDryRun) {
		await fs.rm(TMP_DIR, { recursive: true, force: true });
		return;
	}

	await Promise.all([removeJsonFiles(BESTIARY_DIR), removeJsonFiles(SPELLS_DIR)]);
	await Promise.all([
		copyJsonFiles(tmpBestiaryDir, BESTIARY_DIR),
		copyJsonFiles(tmpSpellsDir, SPELLS_DIR),
	]);
	await fs.rm(TMP_DIR, { recursive: true, force: true });

	runNodeScript(path.join("scripts", "materialize-bestiary-copies.mjs"));
	runNodeScript(path.join("scripts", "build-database-bundles.mjs"), [
		keepSources ? "" : "--delete-sources",
	].filter(Boolean));
	await cleanupUnneededSupportFiles();

	console.log("Done: 5etools data updated.");
}

main().catch(async (error) => {
	await fs.rm(TMP_DIR, { recursive: true, force: true }).catch(() => {});
	console.error(error);
	process.exit(1);
});
