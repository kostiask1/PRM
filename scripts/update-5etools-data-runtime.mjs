import {
	appendLocalExhaustion,
	collectMonstersFromBestiaryData,
	ensureTrailingNewline,
	getLocalExhaustionEntries,
	getNewMonsters,
	getTokenFileName,
	isJsonDirectoryFile,
	isSafeTokenFileName,
	normalizeConditionsData,
	normalizeDiseasesData,
	normalizeMonsterKey,
	normalizeRemoteFileEntries,
	normalizeSensesData,
	normalizeSkillsData,
	normalizeSourceEntries,
	normalizeVariantRulesData,
} from "./update-5etools-data-policies.mjs";

function requireRemoteFileUrl(remotePath, file) {
	if (file.downloadUrl) return file.downloadUrl;
	throw new Error(`Missing download URL for ${remotePath}/${file.name}`);
}

function createTokenResult() {
	return { downloaded: 0, missing: 0, skipped: 0 };
}

function getUpdateTempPaths(path, config) {
	return {
		bestiary: path.join(config.tmpDir, "bestiary"),
		spells: path.join(config.tmpDir, "spells"),
		conditions: path.join(config.tmpDir, "conditionsdiseases.json"),
		variantRules: path.join(config.tmpDir, "variantrules.json"),
		skills: path.join(config.tmpDir, "skills.json"),
		senses: path.join(config.tmpDir, "senses.json"),
		sources: path.join(
			config.tmpDir,
			"gendata-nav-adventure-book-index.json",
		),
	};
}

export function create5eToolsUpdater({
	fs,
	path,
	spawnSync,
	fetchImpl,
	processRef,
	consoleRef,
	config,
}) {
	async function exists(filePath) {
		try {
			await fs.access(filePath);
			return true;
		} catch {
			return false;
		}
	}

	async function fetchJson(url) {
		const response = await fetchImpl(url, {
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
		const response = await fetchImpl(url, {
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
		const response = await fetchImpl(url, {
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
			`https://api.github.com/repos/${config.owner}/${config.repo}/contents/${remotePath}`,
		);
		url.searchParams.set("ref", config.ref);
		const entries = await fetchJson(url.toString());
		if (!Array.isArray(entries)) {
			throw new Error(
				`Unexpected GitHub contents response for ${remotePath}`,
			);
		}
		return normalizeRemoteFileEntries(entries);
	}

	async function downloadRemoteDataFile(remotePath, targetDir, file) {
		const downloadUrl = requireRemoteFileUrl(remotePath, file);
		if (config.isVerbose) {
			consoleRef.log(`download ${remotePath}/${file.name}`);
		}
		const content = await fetchText(downloadUrl);
		JSON.parse(content);
		await fs.writeFile(
			path.join(targetDir, file.name),
			ensureTrailingNewline(content),
			"utf8",
		);
	}

	async function downloadFiles(remotePath, targetDir) {
		const files = await listRemoteFiles(remotePath);
		await fs.mkdir(targetDir, { recursive: true });
		for (const file of files) {
			await downloadRemoteDataFile(remotePath, targetDir, file);
		}
		return files.length;
	}

	async function downloadFile(remotePath, targetPath) {
		const url = `https://raw.githubusercontent.com/${config.owner}/${config.repo}/${config.ref}/${remotePath}`;
		if (config.isVerbose) consoleRef.log(`download ${remotePath}`);
		const content = await fetchText(url);
		JSON.parse(content);
		await fs.mkdir(path.dirname(targetPath), { recursive: true });
		await fs.writeFile(
			targetPath,
			ensureTrailingNewline(content),
			"utf8",
		);
		return 1;
	}

	async function readJson(filePath) {
		return JSON.parse(await fs.readFile(filePath, "utf8"));
	}

	function getTokenFilePath(monster) {
		return path.join(
			config.bestiaryTokensDir,
			String(monster?.source || "").trim(),
			getTokenFileName(monster),
		);
	}

	function getRemoteTokenUrl(monster) {
		const source = String(monster?.source || "").trim();
		const fileName = getTokenFileName(monster);
		return `https://raw.githubusercontent.com/${config.imageOwner}/${config.imageRepo}/${config.imageRef}/bestiary/${encodeURIComponent(source)}/${encodeURIComponent(fileName)}`;
	}

	async function appendMonstersFromJsonEntry(dir, entry, monsters) {
		if (!isJsonDirectoryFile(entry)) return;
		const data = await readJson(path.join(dir, entry.name));
		monsters.push(...collectMonstersFromBestiaryData(data));
	}

	async function collectMonstersFromJsonFiles(dir) {
		if (!(await exists(dir))) return [];
		const entries = await fs.readdir(dir, { withFileTypes: true });
		const monsters = [];
		for (const entry of entries) {
			await appendMonstersFromJsonEntry(dir, entry, monsters);
		}
		return monsters;
	}

	async function collectCurrentBestiaryMonsterKeys() {
		const allPath = path.join(config.bestiaryDir, "all.json");
		if (await exists(allPath)) {
			return new Set(
				collectMonstersFromBestiaryData(await readJson(allPath)).map(
					normalizeMonsterKey,
				),
			);
		}
		return new Set(
			(await collectMonstersFromJsonFiles(config.bestiaryDir)).map(
				normalizeMonsterKey,
			),
		);
	}

	function recordUnsafeToken(result, monster) {
		result.skipped += 1;
		consoleRef.warn(
			`skip token: unsafe local filename for ${monster.name} (${monster.source})`,
		);
	}

	async function attemptTokenDownload(
		result,
		monster,
		fileName,
		targetPath,
	) {
		try {
			const content = await fetchBinaryIfExists(
				getRemoteTokenUrl(monster),
			);
			if (!content) {
				recordMissingToken(result, monster, fileName);
				return;
			}
			await writeDownloadedToken(
				result,
				monster,
				fileName,
				targetPath,
				content,
			);
		} catch (error) {
			recordFailedToken(result, monster, fileName, error);
		}
	}

	function recordMissingToken(result, monster, fileName) {
		result.missing += 1;
		if (config.isVerbose) {
			consoleRef.log(`missing token ${monster.source}/${fileName}`);
		}
	}

	function recordFailedToken(result, monster, fileName, error) {
		result.missing += 1;
		consoleRef.warn(
			`failed token ${monster.source}/${fileName}: ${error.message}`,
		);
	}

	async function writeDownloadedToken(
		result,
		monster,
		fileName,
		targetPath,
		content,
	) {
		await fs.mkdir(path.dirname(targetPath), { recursive: true });
		await fs.writeFile(targetPath, content);
		result.downloaded += 1;
		if (config.isVerbose) {
			consoleRef.log(`download token ${monster.source}/${fileName}`);
		}
	}

	async function processMonsterToken(result, monster) {
		const fileName = getTokenFileName(monster);
		if (!isSafeTokenFileName(fileName)) {
			recordUnsafeToken(result, monster);
			return;
		}
		const targetPath = getTokenFilePath(monster);
		if (await exists(targetPath)) return;
		await attemptTokenDownload(result, monster, fileName, targetPath);
	}

	async function downloadMissingNewBestiaryTokens(newMonsters = []) {
		const result = createTokenResult();
		for (const monster of newMonsters) {
			await processMonsterToken(result, monster);
		}
		return result;
	}

	async function readCurrentConditions() {
		return (await exists(config.conditionsPath))
			? readJson(config.conditionsPath)
			: null;
	}

	async function writeJson(targetPath, value) {
		await fs.writeFile(
			targetPath,
			`${JSON.stringify(value, null, 2)}\n`,
			"utf8",
		);
	}

	async function writeConditionsWithLocalExhaustion(downloadedPath) {
		const downloaded = await readJson(downloadedPath);
		const current = await readCurrentConditions();
		const localExhaustion = getLocalExhaustionEntries(current);
		appendLocalExhaustion(downloaded, localExhaustion);
		await writeJson(
			config.conditionsPath,
			normalizeConditionsData(downloaded),
		);
		await writeJson(
			config.diseasesPath,
			normalizeDiseasesData(downloaded),
		);
		return localExhaustion.length;
	}

	async function writeVariantRules(downloadedPath) {
		const normalized = normalizeVariantRulesData(
			await readJson(downloadedPath),
		);
		await writeJson(config.variantRulesPath, normalized);
		return normalized.variantrule.length;
	}

	async function writeSkills(downloadedPath) {
		const normalized = normalizeSkillsData(await readJson(downloadedPath));
		await writeJson(config.skillsPath, normalized);
		return normalized.skill.length;
	}

	async function writeSenses(downloadedPath) {
		const normalized = normalizeSensesData(await readJson(downloadedPath));
		await writeJson(config.sensesPath, normalized);
		return normalized.sense.length;
	}

	async function writeSources(downloadedPath) {
		const normalized = normalizeSourceEntries(
			await readJson(downloadedPath),
		);
		await fs.mkdir(path.dirname(config.sourcesPath), { recursive: true });
		await writeJson(config.sourcesPath, normalized);
		return normalized.length;
	}

	async function removeJsonEntry(dir, entry) {
		if (!isJsonDirectoryFile(entry)) return;
		await fs.rm(path.join(dir, entry.name));
	}

	async function removeJsonFiles(dir) {
		if (!(await exists(dir))) return;
		const entries = await fs.readdir(dir, { withFileTypes: true });
		for (const entry of entries) await removeJsonEntry(dir, entry);
	}

	async function copyJsonEntry(fromDir, toDir, entry) {
		if (!isJsonDirectoryFile(entry)) return;
		await fs.copyFile(
			path.join(fromDir, entry.name),
			path.join(toDir, entry.name),
		);
	}

	async function copyJsonFiles(fromDir, toDir) {
		await fs.mkdir(toDir, { recursive: true });
		const entries = await fs.readdir(fromDir, { withFileTypes: true });
		for (const entry of entries) {
			await copyJsonEntry(fromDir, toDir, entry);
		}
	}

	function runNodeScript(scriptPath, scriptArgs = []) {
		const result = spawnSync(
			processRef.execPath,
			[scriptPath, ...scriptArgs],
			{
				cwd: config.rootDir,
				stdio: "inherit",
				env: processRef.env,
			},
		);
		if (result.status !== 0) {
			throw new Error(
				`${path.basename(scriptPath)} failed with exit code ${result.status}`,
			);
		}
	}

	async function cleanupUnneededSupportFiles() {
		if (config.keepSources || config.isDryRun) return;
		await Promise.all([
			fs.rm(path.join(config.bestiaryDir, "index.json"), {
				force: true,
			}),
			fs.rm(path.join(config.spellsDir, "index.json"), { force: true }),
		]);
	}

	function logDownloadSummary(bestiaryCount, spellCount) {
		consoleRef.log(
			`${config.isDryRun ? "Dry run" : "Downloaded"}: ${bestiaryCount} bestiary JSON files, ${spellCount} spell JSON files, conditionsdiseases.json, variantrules.json, skills.json, senses.json, and gendata-nav-adventure-book-index.json from ${config.owner}/${config.repo}@${config.ref}.`,
		);
	}

	async function downloadUpdateInputs(tempPaths) {
		await fs.rm(config.tmpDir, { recursive: true, force: true });
		const [bestiaryCount, spellCount] = await Promise.all([
			downloadFiles("data/bestiary", tempPaths.bestiary),
			downloadFiles("data/spells", tempPaths.spells),
			downloadFile(
				"data/conditionsdiseases.json",
				tempPaths.conditions,
			),
			downloadFile("data/variantrules.json", tempPaths.variantRules),
			downloadFile("data/skills.json", tempPaths.skills),
			downloadFile("data/senses.json", tempPaths.senses),
			downloadFile(
				"data/generated/gendata-nav-adventure-book-index.json",
				tempPaths.sources,
			),
		]);
		logDownloadSummary(bestiaryCount, spellCount);
	}

	async function collectNewMonsters(tempPaths) {
		const currentKeys = await collectCurrentBestiaryMonsterKeys();
		const downloadedMonsters = await collectMonstersFromJsonFiles(
			tempPaths.bestiary,
		);
		return getNewMonsters(currentKeys, downloadedMonsters);
	}

	async function replaceDownloadedJson(tempPaths) {
		await Promise.all([
			removeJsonFiles(config.bestiaryDir),
			removeJsonFiles(config.spellsDir),
		]);
		await Promise.all([
			copyJsonFiles(tempPaths.bestiary, config.bestiaryDir),
			copyJsonFiles(tempPaths.spells, config.spellsDir),
		]);
	}

	async function writeReferenceData(tempPaths) {
		await writeConditionsWithLocalExhaustion(tempPaths.conditions);
		await writeVariantRules(tempPaths.variantRules);
		await writeSkills(tempPaths.skills);
		await writeSenses(tempPaths.senses);
		return writeSources(tempPaths.sources);
	}

	function runDatabasePostProcessing() {
		runNodeScript(path.join("scripts", "materialize-bestiary-copies.mjs"));
		runNodeScript(
			path.join("scripts", "build-database-bundles.mjs"),
			[config.keepSources ? "" : "--delete-sources"].filter(Boolean),
		);
	}

	function logCompletion(sourcesCount, newMonsters, tokenResult) {
		consoleRef.log(
			`Done: 5etools data updated. Wrote ${sourcesCount} sources. New monsters: ${newMonsters.length}; tokens downloaded: ${tokenResult.downloaded}; missing: ${tokenResult.missing}; skipped: ${tokenResult.skipped}.`,
		);
	}

	async function applyDownloadedUpdate(tempPaths) {
		const newMonsters = await collectNewMonsters(tempPaths);
		await replaceDownloadedJson(tempPaths);
		const sourcesCount = await writeReferenceData(tempPaths);
		const tokenResult =
			await downloadMissingNewBestiaryTokens(newMonsters);
		await fs.rm(config.tmpDir, { recursive: true, force: true });
		runDatabasePostProcessing();
		await cleanupUnneededSupportFiles();
		logCompletion(sourcesCount, newMonsters, tokenResult);
	}

	async function run() {
		const tempPaths = getUpdateTempPaths(path, config);
		await downloadUpdateInputs(tempPaths);
		if (config.isDryRun) {
			await fs.rm(config.tmpDir, { recursive: true, force: true });
			return;
		}
		await applyDownloadedUpdate(tempPaths);
	}

	async function cleanupTemp() {
		await fs.rm(config.tmpDir, { recursive: true, force: true });
	}

	return Object.freeze({
		cleanupTemp,
		collectCurrentBestiaryMonsterKeys,
		collectMonstersFromJsonFiles,
		copyJsonFiles,
		downloadFile,
		downloadFiles,
		downloadMissingNewBestiaryTokens,
		removeJsonFiles,
		run,
		runNodeScript,
		writeConditionsWithLocalExhaustion,
		writeSenses,
		writeSkills,
		writeSources,
		writeVariantRules,
	});
}
