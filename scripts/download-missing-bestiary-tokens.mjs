import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { getNewMonsters } from "./update-5etools-data-policies.mjs";
import { create5eToolsUpdater } from "./update-5etools-data-runtime.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, "..");
const BESTIARY_DIR = path.join(ROOT_DIR, "database", "bestiary");
const IMAGE_OWNER = "5etools-mirror-3";
const IMAGE_REPO = "5etools-img";
const IMAGE_REF = "main";
const args = new Set(process.argv.slice(2));

function printHelp() {
	console.log(`Usage: node scripts/download-missing-bestiary-tokens.mjs [--verbose]

Downloads locally missing monster tokens from:
  https://github.com/${IMAGE_OWNER}/${IMAGE_REPO}/tree/${IMAGE_REF}/bestiary/tokens

Existing token files are preserved. Monsters without a remote token are reported
as missing and do not cause the command to fail.`);
}

async function run() {
	if (args.has("--help") || args.has("-h")) {
		printHelp();
		return;
	}

	const updater = create5eToolsUpdater({
		fs,
		path,
		fetchImpl: fetch,
		consoleRef: console,
		config: {
			bestiaryDir: BESTIARY_DIR,
			bestiaryTokensDir: path.join(BESTIARY_DIR, "tokens"),
			imageOwner: IMAGE_OWNER,
			imageRepo: IMAGE_REPO,
			imageRef: IMAGE_REF,
			isVerbose: args.has("--verbose"),
		},
	});
	const monsters = getNewMonsters(
		new Set(),
		await updater.collectCurrentBestiaryMonsters(),
	);
	const result = await updater.downloadMissingNewBestiaryTokens(monsters);

	console.log(
		`Done: checked ${monsters.length} monsters; existing tokens: ${result.existing}; downloaded: ${result.downloaded}; missing remotely or failed: ${result.missing}; skipped: ${result.skipped}.`,
	);
}

run().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
