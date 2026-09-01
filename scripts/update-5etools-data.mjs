import { spawnSync } from "child_process";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import {
	getUpdaterHelpText,
	parseUpdaterArgs,
} from "./update-5etools-data-policies.mjs";
import { create5eToolsUpdater } from "./update-5etools-data-runtime.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, "..");
const DATABASE_DIR = path.join(ROOT_DIR, "database");
const BESTIARY_DIR = path.join(DATABASE_DIR, "bestiary");
const SPELLS_DIR = path.join(DATABASE_DIR, "spells");
const OWNER = "5etools-mirror-3";
const REPO = "5etools-src";
const IMG_OWNER = "5etools-mirror-3";
const IMG_REPO = "5etools-img";
const IMG_REF = "main";
const DEFAULT_REF = "main";
const options = parseUpdaterArgs(process.argv, DEFAULT_REF);

if (options.help) {
	console.log(
		getUpdaterHelpText({
			owner: OWNER,
			repo: REPO,
			imageOwner: IMG_OWNER,
			imageRepo: IMG_REPO,
			imageRef: IMG_REF,
			ref: options.ref,
		}),
	);
	process.exit(0);
}

const updater = create5eToolsUpdater({
	fs,
	path,
	spawnSync,
	fetchImpl: fetch,
	processRef: process,
	consoleRef: console,
	config: {
		rootDir: ROOT_DIR,
		databaseDir: DATABASE_DIR,
		bestiaryDir: BESTIARY_DIR,
		spellsDir: SPELLS_DIR,
		conditionsPath: path.join(DATABASE_DIR, "conditions.json"),
		diseasesPath: path.join(DATABASE_DIR, "diseases.json"),
		variantRulesPath: path.join(DATABASE_DIR, "variantrules.json"),
		skillsPath: path.join(DATABASE_DIR, "skills.json"),
		sensesPath: path.join(DATABASE_DIR, "senses.json"),
		sourcesPath: path.join(DATABASE_DIR, "sources.json"),
		bestiaryTokensDir: path.join(BESTIARY_DIR, "tokens"),
		tmpDir: path.join(ROOT_DIR, ".tmp-5etools-update"),
		owner: OWNER,
		repo: REPO,
		imageOwner: IMG_OWNER,
		imageRepo: IMG_REPO,
		imageRef: IMG_REF,
		ref: options.ref,
		isDryRun: options.isDryRun,
		keepSources: options.keepSources,
		isVerbose: options.isVerbose,
	},
});

updater.run().catch(async (error) => {
	await updater.cleanupTemp().catch(() => {});
	console.error(error);
	process.exit(1);
});
