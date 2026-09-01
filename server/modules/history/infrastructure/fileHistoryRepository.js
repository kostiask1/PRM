const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { promisify } = require("util");
const zlib = require("zlib");
const {
	normalizeHistory,
} = require("../application/historyStack");

const APPLICATION_HISTORY_FILE = "_applicationChangeHistory.json";
const CAMPAIGN_HISTORY_FILE = "_changeHistory.json";
const TOMBSTONE_DIRECTORY = "_history-tombstones";
const PENDING_DIRECTORY = "_history-pending";
const TREE_ARCHIVE_VERSION = 1;
const TREE_RESOURCES = new Set([
	"campaign-directory",
	"campaign-images",
	"general-images",
]);
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

function createConflict(message) {
	const error = new Error(message);
	error.status = 409;
	return error;
}

function compareTreeEntries(left, right) {
	if (left.path < right.path) return -1;
	if (left.path > right.path) return 1;
	return 0;
}

function updateFingerprintPart(hash, value) {
	const buffer = Buffer.isBuffer(value) ? value : Buffer.from(String(value), "utf8");
	hash.update(String(buffer.length));
	hash.update(":");
	hash.update(buffer);
	hash.update(";");
}

function fingerprintTreeEntries(entries) {
	const hash = crypto.createHash("sha256");
	updateFingerprintPart(hash, `history-tree-v${TREE_ARCHIVE_VERSION}`);
	for (const entry of entries) {
		updateFingerprintPart(hash, entry.type);
		updateFingerprintPart(hash, entry.path);
		if (entry.type === "file") {
			updateFingerprintPart(hash, Buffer.from(entry.data, "base64"));
		} else if (entry.type === "symlink") {
			updateFingerprintPart(hash, Buffer.from(entry.target, "base64"));
		}
	}
	return hash.digest("hex");
}

function createFileHistoryRepository(storage) {
	const applicationPath = () =>
		path.join(storage.DATA_DIR, APPLICATION_HISTORY_FILE);
	const campaignPath = (slug) =>
		path.join(storage.campaignDir(slug), CAMPAIGN_HISTORY_FILE);
	const tombstoneRoot = () => path.join(storage.DATA_DIR, TOMBSTONE_DIRECTORY);
	const tombstonePath = (transactionId, key) =>
		path.join(
			tombstoneRoot(),
			path.basename(String(transactionId || "unknown")),
			`${path.basename(String(key || "campaign"))}.json.gz`,
		);
	const pendingRoot = () => path.join(storage.DATA_DIR, PENDING_DIRECTORY);
	const pendingPath = (scopeKey, transactionId) =>
		path.join(
			pendingRoot(),
			path.basename(String(scopeKey || "application")),
			`${path.basename(String(transactionId || "unknown"))}.json.gz`,
		);
	const pendingTreeRoot = (scopeKey, transactionId) =>
		path.join(
			pendingRoot(),
			path.basename(String(scopeKey || "application")),
			`${path.basename(String(transactionId || "unknown"))}.trees`,
		);
	const pendingTreePath = (scopeKey, transactionId, key) =>
		path.join(
			pendingTreeRoot(scopeKey, transactionId),
			`${path.basename(String(key || "tree"))}.tree.json.gz`,
		);
	const treeTombstonePath = (transactionId, key) =>
		path.join(
			tombstoneRoot(),
			path.basename(String(transactionId || "unknown")),
			`${path.basename(String(key || "tree"))}.tree.json.gz`,
		);

	function normalizeTreeLocation(location) {
		const resource = String(location?.resource || "");
		if (!TREE_RESOURCES.has(resource)) {
			throw createConflict("History tree resource type is unsupported.");
		}
		if (resource === "general-images") return { resource };
		const rawSlug = String(location?.campaignSlug || "");
		const campaignSlug = path.basename(rawSlug);
		if (!campaignSlug || campaignSlug !== rawSlug) {
			throw createConflict("History tree resource has an invalid campaign slug.");
		}
		return { resource, campaignSlug };
	}

	function treeRootPath(location) {
		const normalized = normalizeTreeLocation(location);
		if (normalized.resource === "campaign-directory") {
			return storage.campaignDir(normalized.campaignSlug);
		}
		if (normalized.resource === "campaign-images") {
			return path.join(storage.IMAGES_DIR, normalized.campaignSlug);
		}
		return path.join(storage.IMAGES_DIR, "general");
	}

	function shouldIgnoreTreeEntry(location, relativePath) {
		return (
			location.resource === "campaign-directory" &&
			relativePath === CAMPAIGN_HISTORY_FILE
		);
	}

	async function readAt(filePath) {
		if (!(await storage.exists(filePath))) return normalizeHistory(null);
		try {
			return normalizeHistory(await storage.readJson(filePath));
		} catch (error) {
			if (error instanceof SyntaxError || error.code === "ENOENT") {
				return normalizeHistory(null);
			}
			throw error;
		}
	}

	function serializedFingerprint(serialized) {
		return crypto.createHash("sha256").update(serialized).digest("hex");
	}

	async function writeCompressed(filePath, value) {
		const serialized = JSON.stringify(value);
		await storage.ensureDir(path.dirname(filePath));
		const compressed = await gzip(Buffer.from(serialized, "utf8"));
		const temporaryPath = path.join(
			path.dirname(filePath),
			`.${path.basename(filePath)}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`,
		);
		try {
			await fs.writeFile(temporaryPath, compressed);
			await storage.renameWithRetry(temporaryPath, filePath);
		} catch (error) {
			await fs.rm(temporaryPath, { force: true }).catch(() => {});
			throw error;
		}
		return serializedFingerprint(serialized);
	}

	async function readCompressed(filePath, expectedFingerprint) {
		try {
			const serialized = (await gunzip(await fs.readFile(filePath))).toString(
				"utf8",
			);
			if (
				expectedFingerprint &&
				serializedFingerprint(serialized) !== expectedFingerprint
			) {
				throw createConflict("History recovery snapshot is corrupted.");
			}
			return JSON.parse(serialized);
		} catch (error) {
			if (
				error instanceof SyntaxError ||
				["ENOENT", "Z_DATA_ERROR", "Z_BUF_ERROR", "Z_MEM_ERROR"].includes(
					error.code,
				)
			) {
				throw createConflict("History recovery snapshot is missing or corrupted.");
			}
			throw error;
		}
	}

	async function readDirectoryEntries(directory) {
		try {
			return await fs.readdir(directory);
		} catch (error) {
			if (error.code === "ENOENT") return [];
			throw error;
		}
	}

	async function readTreeEntries(location, rootPath) {
		const entries = [];

		async function visit(absolutePath, relativePath) {
			let stats;
			try {
				stats = await fs.lstat(absolutePath);
			} catch (error) {
				if (!relativePath && error.code === "ENOENT") return false;
				throw error;
			}

			if (stats.isDirectory()) {
				entries.push({ path: relativePath, type: "directory" });
				const names = await fs.readdir(absolutePath);
				names.sort();
				for (const name of names) {
					const childPath = relativePath
						? `${relativePath}/${name}`
						: name;
					if (shouldIgnoreTreeEntry(location, childPath)) continue;
					await visit(path.join(absolutePath, name), childPath);
				}
				return true;
			}

			if (stats.isFile()) {
				entries.push({
					path: relativePath,
					type: "file",
					data: (await fs.readFile(absolutePath)).toString("base64"),
				});
				return true;
			}

			if (stats.isSymbolicLink()) {
				entries.push({
					path: relativePath,
					type: "symlink",
					target: (await fs.readlink(absolutePath, { encoding: "buffer" })).toString(
						"base64",
					),
				});
				return true;
			}

			throw createConflict(
				`History cannot snapshot unsupported filesystem entry: ${relativePath || "."}.`,
			);
		}

		const exists = await visit(rootPath, "");
		return exists ? entries.sort(compareTreeEntries) : null;
	}

	async function createTreeArchive(location) {
		const normalizedLocation = normalizeTreeLocation(location);
		const entries = await readTreeEntries(
			normalizedLocation,
			treeRootPath(normalizedLocation),
		);
		if (!entries) {
			return {
				version: TREE_ARCHIVE_VERSION,
				location: normalizedLocation,
				exists: false,
				fingerprint: null,
				entries: [],
			};
		}
		return {
			version: TREE_ARCHIVE_VERSION,
			location: normalizedLocation,
			exists: true,
			fingerprint: fingerprintTreeEntries(entries),
			entries,
		};
	}

	function validateRelativeTreePath(relativePath) {
		if (relativePath === "") return [];
		if (typeof relativePath !== "string" || relativePath.includes("\\")) {
			throw createConflict("History tree snapshot has an invalid path.");
		}
		const parts = relativePath.split("/");
		if (
			parts.some(
				(part) =>
					!part || part === "." || part === ".." || path.basename(part) !== part,
			)
		) {
			throw createConflict("History tree snapshot has an invalid path.");
		}
		return parts;
	}

	function validateTreeArchive(value, expectedReference = null) {
		if (!value || value.version !== TREE_ARCHIVE_VERSION) {
			throw createConflict("History tree snapshot has an unsupported version.");
		}
		const location = normalizeTreeLocation(value.location);
		if (!value.exists) {
			if (value.fingerprint !== null || value.entries?.length) {
				throw createConflict("History tree snapshot is corrupted.");
			}
			return {
				version: TREE_ARCHIVE_VERSION,
				location,
				exists: false,
				fingerprint: null,
				entries: [],
			};
		}
		if (!Array.isArray(value.entries) || !value.entries.length) {
			throw createConflict("History tree snapshot is corrupted.");
		}

		const seenPaths = new Set();
		const entries = value.entries.map((entry) => {
			if (!entry || !["directory", "file", "symlink"].includes(entry.type)) {
				throw createConflict("History tree snapshot has an invalid entry.");
			}
			validateRelativeTreePath(entry.path);
			if (seenPaths.has(entry.path)) {
				throw createConflict("History tree snapshot contains duplicate paths.");
			}
			seenPaths.add(entry.path);
			if (entry.type === "file") {
				if (typeof entry.data !== "string") {
					throw createConflict("History tree snapshot has invalid file data.");
				}
				return { path: entry.path, type: entry.type, data: entry.data };
			}
			if (entry.type === "symlink") {
				if (typeof entry.target !== "string") {
					throw createConflict("History tree snapshot has an invalid link target.");
				}
				return { path: entry.path, type: entry.type, target: entry.target };
			}
			return { path: entry.path, type: entry.type };
		});
		entries.sort(compareTreeEntries);
		if (!seenPaths.has("")) {
			throw createConflict("History tree snapshot has no root entry.");
		}
		const rootEntry = entries.find((entry) => entry.path === "");
		if (rootEntry.type !== "directory" && entries.length !== 1) {
			throw createConflict("History tree snapshot root cannot contain children.");
		}
		const fingerprint = fingerprintTreeEntries(entries);
		if (
			fingerprint !== value.fingerprint ||
			(expectedReference?.fingerprint &&
				fingerprint !== expectedReference.fingerprint)
		) {
			throw createConflict("History tree snapshot is corrupted.");
		}
		return {
			version: TREE_ARCHIVE_VERSION,
			location,
			exists: true,
			fingerprint,
			entries,
		};
	}

	async function writeTreeArchive(filePath, archive) {
		await writeCompressed(filePath, archive);
		return archive.fingerprint;
	}

	function pendingTreeReference(reference, key) {
		return {
			scopeKey: path.basename(String(reference?.scopeKey || "application")),
			transactionId: path.basename(
				String(reference?.transactionId || "unknown"),
			),
			key: path.basename(String(key || "tree")),
		};
	}

	function getTreeReferencePath(reference) {
		if (reference?.kind === "pending-tree") {
			const pending = reference.pendingReference || reference;
			return pendingTreePath(
				pending.scopeKey,
				pending.transactionId,
				pending.key,
			);
		}
		if (reference?.kind === "tree-tombstone") {
			return treeTombstonePath(reference.transactionId, reference.key);
		}
		throw createConflict("History tree snapshot reference is invalid.");
	}

	async function readReferencedTreeArchive(reference) {
		if (!reference?.exists) {
			if (reference?.fingerprint !== null) {
				throw createConflict("History tree snapshot reference is corrupted.");
			}
			return {
				version: TREE_ARCHIVE_VERSION,
				location: normalizeTreeLocation(reference.location),
				exists: false,
				fingerprint: null,
				entries: [],
			};
		}
		let value;
		try {
			value = await readCompressed(getTreeReferencePath(reference));
		} catch (error) {
			if (["ENOENT", "Z_DATA_ERROR", "Z_BUF_ERROR"].includes(error.code)) {
				throw createConflict("History tree snapshot is missing or corrupted.");
			}
			throw error;
		}
		return validateTreeArchive(value, reference);
	}

	function restoreArtifactPaths(rootPath, restoreToken) {
		const token = crypto
			.createHash("sha256")
			.update(String(restoreToken || "history-restore"))
			.digest("hex")
			.slice(0, 20);
		const baseName = path.basename(rootPath);
		return {
			stagePath: path.join(
				path.dirname(rootPath),
				`.${baseName}.history-restore-${token}.stage`,
			),
			backupPath: path.join(
				path.dirname(rootPath),
				`.${baseName}.history-restore-${token}.previous`,
			),
		};
	}

	async function materializeTreeArchive(archive, destinationPath) {
		await fs.rm(destinationPath, { recursive: true, force: true });
		if (!archive?.exists) return;
		const rootEntry = archive.entries.find((entry) => entry.path === "");
		if (rootEntry.type === "directory") {
			await fs.mkdir(destinationPath, { recursive: true });
		} else if (rootEntry.type === "file") {
			await storage.ensureDir(path.dirname(destinationPath));
			await fs.writeFile(destinationPath, Buffer.from(rootEntry.data, "base64"));
			return;
		} else {
			await storage.ensureDir(path.dirname(destinationPath));
			await fs.symlink(
				Buffer.from(rootEntry.target, "base64").toString("utf8"),
				destinationPath,
			);
			return;
		}

		for (const entry of archive.entries) {
			if (!entry.path) continue;
			const parts = validateRelativeTreePath(entry.path);
			const entryPath = path.join(destinationPath, ...parts);
			const resolvedEntry = path.resolve(entryPath);
			const resolvedRoot = path.resolve(destinationPath);
			if (
				!resolvedEntry.startsWith(`${resolvedRoot}${path.sep}`)
			) {
				throw createConflict("History tree snapshot path escaped its root.");
			}
			if (entry.type === "directory") {
				await fs.mkdir(entryPath, { recursive: true });
				continue;
			}
			await storage.ensureDir(path.dirname(entryPath));
			if (entry.type === "file") {
				await fs.writeFile(entryPath, Buffer.from(entry.data, "base64"));
			} else {
				await fs.symlink(
					Buffer.from(entry.target, "base64").toString("utf8"),
					entryPath,
				);
			}
		}
	}

	async function copyCampaignHistoryIfPresent(
		location,
		sourceRoot,
		destinationRoot,
	) {
		if (location.resource !== "campaign-directory") return;
		const source = path.join(sourceRoot, CAMPAIGN_HISTORY_FILE);
		if (!(await storage.exists(source))) return;
		await storage.ensureDir(destinationRoot);
		await fs.copyFile(source, path.join(destinationRoot, CAMPAIGN_HISTORY_FILE));
	}

	async function writeCampaignHistoryToTree(
		location,
		destinationRoot,
		history,
	) {
		if (
			location.resource !== "campaign-directory" ||
			history === undefined ||
			!(await storage.exists(destinationRoot))
		) {
			return;
		}
		await storage.writeJson(
			path.join(destinationRoot, CAMPAIGN_HISTORY_FILE),
			normalizeHistory(history),
		);
	}

	async function currentTreeMatches(location, archive) {
		const current = await createTreeArchive(location);
		return (
			current.exists === archive.exists &&
			current.fingerprint === archive.fingerprint
		);
	}

	async function replaceTree(
		location,
		archive,
		restoreToken,
		campaignHistory = undefined,
	) {
		const normalizedLocation = normalizeTreeLocation(location);
		const rootPath = treeRootPath(normalizedLocation);
		const { stagePath, backupPath } = restoreArtifactPaths(
			rootPath,
			restoreToken,
		);

		if (await currentTreeMatches(normalizedLocation, archive)) {
			if (archive.exists) {
				await writeCampaignHistoryToTree(
					normalizedLocation,
					rootPath,
					campaignHistory,
				);
			}
			await fs.rm(stagePath, { recursive: true, force: true });
			await fs.rm(backupPath, { recursive: true, force: true });
			return {
				exists: archive.exists,
				fingerprint: archive.fingerprint,
			};
		}

		await materializeTreeArchive(archive, stagePath);
		if (archive.exists) {
			const historySource = (await storage.exists(rootPath))
				? rootPath
				: backupPath;
			await copyCampaignHistoryIfPresent(
				normalizedLocation,
				historySource,
				stagePath,
			);
			await writeCampaignHistoryToTree(
				normalizedLocation,
				stagePath,
				campaignHistory,
			);
		}

		const rootExists = await storage.exists(rootPath);
		const backupExists = await storage.exists(backupPath);
		if (rootExists && backupExists) {
			throw createConflict("History restore has conflicting recovery state.");
		}
		if (rootExists) {
			await storage.renameWithRetry(rootPath, backupPath);
		}

		try {
			if (archive.exists) {
				await storage.renameWithRetry(stagePath, rootPath);
			}
			await fs.rm(backupPath, { recursive: true, force: true });
		} catch (error) {
			if (
				!(await storage.exists(rootPath)) &&
				(await storage.exists(backupPath))
			) {
				await storage.renameWithRetry(backupPath, rootPath).catch(() => {});
			}
			throw error;
		} finally {
			await fs.rm(stagePath, { recursive: true, force: true }).catch(() => {});
		}

		const restored = await createTreeArchive(normalizedLocation);
		if (
			restored.exists !== archive.exists ||
			restored.fingerprint !== archive.fingerprint
		) {
			throw createConflict("History tree restore did not reproduce its snapshot.");
		}
		return {
			exists: restored.exists,
			fingerprint: restored.fingerprint,
		};
	}

	async function replaceLifecycleTree(
		expectedLocation,
		targetLocation,
		archive,
		restoreToken,
		campaignHistory = undefined,
	) {
		if (!expectedLocation) {
			return replaceTree(
				targetLocation,
				archive,
				restoreToken,
				campaignHistory,
			);
		}
		if (!targetLocation) {
			return replaceTree(
				expectedLocation,
				{
					version: TREE_ARCHIVE_VERSION,
					location: normalizeTreeLocation(expectedLocation),
					exists: false,
					fingerprint: null,
					entries: [],
				},
				restoreToken,
			);
		}
		const expected = normalizeTreeLocation(expectedLocation);
		const target = normalizeTreeLocation(targetLocation);
		if (expected.resource !== target.resource) {
			throw createConflict("History cannot restore a lifecycle tree across kinds.");
		}
		const expectedRoot = treeRootPath(expected);
		const targetRoot = treeRootPath(target);
		if (expectedRoot === targetRoot) {
			return replaceTree(
				target,
				archive,
				restoreToken,
				campaignHistory,
			);
		}

		const { stagePath } = restoreArtifactPaths(targetRoot, restoreToken);
		const { backupPath } = restoreArtifactPaths(expectedRoot, restoreToken);
		const targetMatches = await currentTreeMatches(target, archive);
		const expectedExists = await storage.exists(expectedRoot);
		if (targetMatches && !expectedExists) {
			if (archive.exists) {
				await writeCampaignHistoryToTree(
					target,
					targetRoot,
					campaignHistory,
				);
			}
			await fs.rm(stagePath, { recursive: true, force: true });
			await fs.rm(backupPath, { recursive: true, force: true });
			return {
				exists: archive.exists,
				fingerprint: archive.fingerprint,
			};
		}
		if (targetMatches && expectedExists) {
			throw createConflict("History lifecycle restore found both source and target.");
		}
		if (await storage.exists(targetRoot)) {
			throw createConflict("History lifecycle restore target is occupied.");
		}

		await materializeTreeArchive(archive, stagePath);
		if (archive.exists) {
			const historySource = expectedExists ? expectedRoot : backupPath;
			await copyCampaignHistoryIfPresent(target, historySource, stagePath);
			await writeCampaignHistoryToTree(
				target,
				stagePath,
				campaignHistory,
			);
		}

		const backupExists = await storage.exists(backupPath);
		if (expectedExists && backupExists) {
			throw createConflict("History lifecycle restore has conflicting recovery state.");
		}
		if (expectedExists) {
			await storage.renameWithRetry(expectedRoot, backupPath);
		}

		try {
			if (archive.exists) {
				await storage.renameWithRetry(stagePath, targetRoot);
			}
			await fs.rm(backupPath, { recursive: true, force: true });
		} catch (error) {
			if (
				!(await storage.exists(expectedRoot)) &&
				(await storage.exists(backupPath)) &&
				!(await storage.exists(targetRoot))
			) {
				await storage
					.renameWithRetry(backupPath, expectedRoot)
					.catch(() => {});
			}
			throw error;
		} finally {
			await fs.rm(stagePath, { recursive: true, force: true }).catch(() => {});
		}

		const restored = await createTreeArchive(target);
		if (
			restored.exists !== archive.exists ||
			restored.fingerprint !== archive.fingerprint
		) {
			throw createConflict("History lifecycle restore did not reproduce its snapshot.");
		}
		return {
			exists: restored.exists,
			fingerprint: restored.fingerprint,
		};
	}

	async function listLifecycleRoots() {
		const locations = [];
		const campaignsRoot = storage.CAMPAIGNS_DIR || path.dirname(
			storage.campaignDir("__history_root_probe__"),
		);
		const ignoredRestoreArtifact = (name) =>
			/^\..+\.history-restore-[a-f0-9]+\.(stage|previous)$/.test(name);
		for (const name of (await readDirectoryEntries(campaignsRoot)).sort()) {
			if (ignoredRestoreArtifact(name)) continue;
			const location = { resource: "campaign-directory", campaignSlug: name };
			if (await storage.exists(treeRootPath(location))) locations.push(location);
		}
		for (const name of (await readDirectoryEntries(storage.IMAGES_DIR)).sort()) {
			if (ignoredRestoreArtifact(name)) continue;
			if (name === "general") {
				locations.push({ resource: "general-images" });
				continue;
			}
			const location = { resource: "campaign-images", campaignSlug: name };
			if (await storage.exists(treeRootPath(location))) locations.push(location);
		}
		return locations;
	}

	async function readTreeState(location) {
		const archive = await createTreeArchive(location);
		return {
			exists: archive.exists,
			fingerprint: archive.fingerprint,
		};
	}

	async function writePendingTree(reference, key, location) {
		const pendingReference = pendingTreeReference(reference, key);
		const archive = await createTreeArchive(location);
		if (archive.exists) {
			await writeTreeArchive(
				pendingTreePath(
					pendingReference.scopeKey,
					pendingReference.transactionId,
					pendingReference.key,
				),
				archive,
			);
		}
		return {
			kind: "pending-tree",
			location: archive.location,
			exists: archive.exists,
			fingerprint: archive.fingerprint,
			pendingReference,
		};
	}

	async function promotePendingTree(
		reference,
		pendingTree,
		transactionId,
		key,
	) {
		const expectedPending = pendingTreeReference(
			reference,
			pendingTree?.pendingReference?.key,
		);
		const actualPending = pendingTree?.pendingReference;
		if (
			!actualPending ||
			expectedPending.scopeKey !== actualPending.scopeKey ||
			expectedPending.transactionId !== actualPending.transactionId ||
			expectedPending.key !== actualPending.key
		) {
			throw createConflict("History pending tree reference does not match.");
		}
		const archive = await readReferencedTreeArchive(pendingTree);
		const tombstoneReference = {
			kind: "tree-tombstone",
			transactionId: path.basename(String(transactionId || "unknown")),
			key: path.basename(String(key || "tree")),
			location: archive.location,
			exists: archive.exists,
			fingerprint: archive.fingerprint,
		};
		if (archive.exists) {
			await writeTreeArchive(
				treeTombstonePath(
					tombstoneReference.transactionId,
					tombstoneReference.key,
				),
				archive,
			);
		}
		return tombstoneReference;
	}

	async function writeLiveTreeTombstone(transactionId, key, location) {
		const archive = await createTreeArchive(location);
		const reference = {
			kind: "tree-tombstone",
			transactionId: path.basename(String(transactionId || "unknown")),
			key: path.basename(String(key || "tree")),
			location: archive.location,
			exists: archive.exists,
			fingerprint: archive.fingerprint,
		};
		if (archive.exists) {
			await writeTreeArchive(
				treeTombstonePath(reference.transactionId, reference.key),
				archive,
			);
		}
		return reference;
	}

	async function readTreeTombstone(reference) {
		const archive = await readReferencedTreeArchive(reference);
		return {
			exists: archive.exists,
			fingerprint: archive.fingerprint,
		};
	}

	async function restoreTree(location, targetReference, restoreToken) {
		const archive = targetReference
			? await readReferencedTreeArchive(targetReference)
			: {
					version: TREE_ARCHIVE_VERSION,
					location: normalizeTreeLocation(location),
					exists: false,
					fingerprint: null,
					entries: [],
				};
		return replaceTree(location, archive, restoreToken);
	}

	async function restoreLifecycleTree(
		expectedLocation,
		targetLocation,
		targetReference,
		restoreToken,
		campaignHistory = undefined,
	) {
		const archive = targetReference
			? await readReferencedTreeArchive(targetReference)
			: {
					version: TREE_ARCHIVE_VERSION,
					location: normalizeTreeLocation(
						targetLocation || expectedLocation,
					),
					exists: false,
					fingerprint: null,
					entries: [],
				};
		return replaceLifecycleTree(
			expectedLocation,
			targetLocation,
			archive,
			restoreToken,
			campaignHistory,
		);
	}

	function safeEntityType(value) {
		const type = String(value || "");
		if (!storage.ENTITY_TYPES.includes(type)) {
			const error = new Error("History resource has an invalid entity type.");
			error.status = 409;
			throw error;
		}
		return type;
	}

	function resourcePath(location) {
		if (!location) return null;
		const campaignSlug = path.basename(String(location.campaignSlug || ""));
		if (!campaignSlug) {
			const error = new Error("History resource has no campaign slug.");
			error.status = 409;
			throw error;
		}
		if (location.resource === "campaign-meta") {
			return storage.campaignMetaPath(campaignSlug);
		}
		if (location.resource === "session") {
			return storage.sessionPath(
				campaignSlug,
				path.basename(String(location.fileName || "")),
			);
		}
		if (location.resource === "entity") {
			return path.join(
				storage.campaignDir(campaignSlug),
				safeEntityType(location.entityType),
				path.basename(String(location.entitySlug || "")),
				"info.json",
			);
		}
		if (location.resource === "ai-history") {
			return storage.campaignAiResponsesPath(campaignSlug);
		}
		const error = new Error("History resource type is unsupported.");
		error.status = 409;
		throw error;
	}

	async function readResource(location) {
		if (!location) return undefined;
		const filePath = resourcePath(location);
		if (!(await storage.exists(filePath))) return undefined;
		return storage.readJson(filePath);
	}

	async function writeResource(location, value) {
		if (location.resource === "entity") {
			return storage.writeEntity(
				path.basename(String(location.campaignSlug || "")),
				safeEntityType(location.entityType),
				path.basename(String(location.entitySlug || "")),
				value,
			);
		}
		if (location.resource === "ai-history") {
			return storage.writeAiResponses(
				path.basename(String(location.campaignSlug || "")),
				value,
			);
		}
		await storage.writeJson(resourcePath(location), value);
		return value;
	}

	async function removeResource(location) {
		if (!location) return;
		if (location.resource === "entity") {
			await storage.deleteEntity(
				path.basename(String(location.campaignSlug || "")),
				safeEntityType(location.entityType),
				path.basename(String(location.entitySlug || "")),
			);
			return;
		}
		await fs.rm(resourcePath(location), { force: true });
	}

	async function moveResource(source, target) {
		const sourcePath = resourcePath(source);
		const targetPath = resourcePath(target);
		if (sourcePath === targetPath) return;
		if (source.resource !== target.resource) {
			const error = new Error("History cannot move a resource between kinds.");
			error.status = 409;
			throw error;
		}
		if (source.resource === "entity") {
			await storage.ensureDir(path.dirname(path.dirname(targetPath)));
			await storage.renameWithRetry(path.dirname(sourcePath), path.dirname(targetPath));
			return;
		}
		if (source.resource === "session") {
			await storage.ensureDir(path.dirname(targetPath));
			await storage.renameWithRetry(sourcePath, targetPath);
			return;
		}
		const error = new Error("History resource location cannot be changed directly.");
		error.status = 409;
		throw error;
	}

	async function removePendingSnapshot(reference) {
		const filePath = pendingPath(reference?.scopeKey, reference?.transactionId);
		await fs.rm(filePath, { force: true });
		await fs.rm(
			pendingTreeRoot(reference?.scopeKey, reference?.transactionId),
			{ recursive: true, force: true },
		);
		await fs.rmdir(path.dirname(filePath)).catch((error) => {
			if (!["ENOENT", "ENOTEMPTY"].includes(error.code)) throw error;
		});
		await fs.rmdir(pendingRoot()).catch((error) => {
			if (!["ENOENT", "ENOTEMPTY"].includes(error.code)) throw error;
		});
	}

	return Object.freeze({
		applicationPath,
		campaignPath,
		readApplication: () => readAt(applicationPath()),
		writeApplication: (history) =>
			storage.writeJson(applicationPath(), normalizeHistory(history)),
		readCampaign: (slug) => readAt(campaignPath(slug)),
		writeCampaign: (slug, history) =>
			storage.writeJson(campaignPath(slug), normalizeHistory(history)),
		removeCampaign: async (slug) => {
			await fs.rm(campaignPath(slug), { force: true });
			await fs.rm(
				path.join(
					pendingRoot(),
					path.basename(`campaign-${String(slug || "")}`),
				),
				{ recursive: true, force: true },
			);
		},
		removeApplication: async () => {
			await fs.rm(applicationPath(), { force: true });
			await fs.rm(tombstoneRoot(), { recursive: true, force: true });
			await fs.rm(path.join(pendingRoot(), "application"), {
				recursive: true,
				force: true,
			});
		},
		writeTombstone: (transactionId, key, value) =>
			writeCompressed(tombstonePath(transactionId, key), value),
		readTombstone: (transactionId, key, fingerprint) =>
			readCompressed(tombstonePath(transactionId, key), fingerprint),
		removeTombstones: (transactionId) =>
			fs.rm(
				path.join(tombstoneRoot(), path.basename(String(transactionId || ""))),
				{ recursive: true, force: true },
			),
		writePendingSnapshot: async (scopeKey, transactionId, value) => {
			const fingerprint = await writeCompressed(
				pendingPath(scopeKey, transactionId),
				value,
			);
			return {
				scopeKey: path.basename(String(scopeKey || "application")),
				transactionId: path.basename(String(transactionId || "unknown")),
				fingerprint,
			};
		},
		readPendingSnapshot: (reference) =>
			readCompressed(
				pendingPath(reference?.scopeKey, reference?.transactionId),
				reference?.fingerprint,
			),
		removePendingSnapshot,
		listLifecycleRoots,
		readTreeState,
		writePendingTree,
		promotePendingTree,
		writeLiveTreeTombstone,
		readTreeTombstone,
		restoreTree,
		restoreLifecycleTree,
		readResource,
		writeResource,
		removeResource,
		moveResource,
		resourceExists: async (location) => {
			if (!location) return false;
			const filePath = resourcePath(location);
			return storage.exists(
				location.resource === "entity" ? path.dirname(filePath) : filePath,
			);
		},
	});
}

module.exports = {
	APPLICATION_HISTORY_FILE,
	CAMPAIGN_HISTORY_FILE,
	PENDING_DIRECTORY,
	TOMBSTONE_DIRECTORY,
	createFileHistoryRepository,
};
