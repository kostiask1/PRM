const fs = require("fs/promises");
const path = require("path");

function isRestoreArtifactName(name) {
	return /^\..+\.history-restore-[a-f0-9]+\.(stage|previous)$/.test(
		String(name || ""),
	);
}

async function getFileBytes(filePath) {
	try {
		const stats = await fs.stat(filePath);
		return stats.isFile() ? stats.size : 0;
	} catch (error) {
		if (error.code === "ENOENT") return 0;
		throw error;
	}
}

async function getDirectoryBytes(dirPath, { excludeTopLevel = null } = {}) {
	let entries;
	try {
		entries = await fs.readdir(dirPath, { withFileTypes: true });
	} catch (error) {
		if (error.code === "ENOENT") return 0;
		throw error;
	}

	let total = 0;
	for (const entry of entries) {
		if (excludeTopLevel?.has(entry.name)) continue;
		const entryPath = path.join(dirPath, entry.name);
		let stats;
		try {
			stats = await fs.lstat(entryPath);
		} catch (error) {
			if (error.code === "ENOENT") continue;
			throw error;
		}
		if (stats.isDirectory()) {
			total += await getDirectoryBytes(entryPath);
		} else if (stats.isFile()) {
			total += stats.size;
		}
	}
	return total;
}

function createFileStorageOverviewRepository(storage) {
	async function readAiHistoryMetric(slug) {
		const responses = await storage.readAiResponses(slug);
		const entryCount = Array.isArray(responses) ? responses.length : 0;
		if (entryCount === 0) {
			return { bytes: 0, entryCount: 0 };
		}
		const stats = await storage.getAiResponsesStorageStats(slug);
		return {
			bytes: Number(stats?.bytes) || 0,
			entryCount,
		};
	}

	async function readChangeHistoryEntryCount(filePath) {
		try {
			const doc = await storage.readJson(filePath);
			const pastCount = Array.isArray(doc?.past) ? doc.past.length : 0;
			const futureCount = Array.isArray(doc?.future) ? doc.future.length : 0;
			return pastCount + futureCount;
		} catch {
			return 0;
		}
	}

	async function readCampaignUndoRedoMetric(slug) {
		const historyFile = path.join(storage.campaignDir(slug), "_changeHistory.json");
		const pendingDir = path.join(
			storage.DATA_DIR,
			"_history-pending",
			path.basename(`campaign-${String(slug || "")}`),
		);
		const fileBytes = await getFileBytes(historyFile);
		const pendingBytes = await getDirectoryBytes(pendingDir);
		const entryCount =
			fileBytes > 0 ? await readChangeHistoryEntryCount(historyFile) : 0;
		return {
			bytes: fileBytes + pendingBytes,
			entryCount,
		};
	}

	async function readApplicationUndoRedoMetric(campaignSlugs) {
		const appHistoryFile = path.join(
			storage.DATA_DIR,
			"_applicationChangeHistory.json",
		);
		const tombstonesDir = path.join(storage.DATA_DIR, "_history-tombstones");
		const pendingRoot = path.join(storage.DATA_DIR, "_history-pending");
		const knownCampaignPending = new Set(
			campaignSlugs.map((slug) =>
				path.basename(`campaign-${String(slug || "")}`),
			),
		);
		const appFileBytes = await getFileBytes(appHistoryFile);
		const tombstonesBytes = await getDirectoryBytes(tombstonesDir);

		let appPendingBytes = 0;
		let pendingEntries = [];
		try {
			pendingEntries = await fs.readdir(pendingRoot, { withFileTypes: true });
		} catch (error) {
			if (error.code !== "ENOENT") throw error;
		}
		for (const entry of pendingEntries) {
			if (knownCampaignPending.has(entry.name)) continue;
			const entryPath = path.join(pendingRoot, entry.name);
			let stats;
			try {
				stats = await fs.lstat(entryPath);
			} catch (error) {
				if (error.code === "ENOENT") continue;
				throw error;
			}
			if (stats.isDirectory()) {
				appPendingBytes += await getDirectoryBytes(entryPath);
			} else if (stats.isFile()) {
				appPendingBytes += stats.size;
			}
		}

		const entryCount =
			appFileBytes > 0
				? await readChangeHistoryEntryCount(appHistoryFile)
				: 0;
		return {
			bytes: appFileBytes + tombstonesBytes + appPendingBytes,
			tombstonesBytes,
			entryCount,
		};
	}

	async function readStorageOverview() {
		const slugs = (await storage.listExportableCampaignSlugs()).filter(
			(slug) => !isRestoreArtifactName(slug),
		);

		const campaignsWithOrder = [];
		for (const slug of slugs) {
			const meta = await storage
				.readJson(storage.campaignMetaPath(slug))
				.catch(() => ({}));
			const contentBytes = await getDirectoryBytes(storage.campaignDir(slug), {
				excludeTopLevel: new Set(["_aiResponses.json", "_changeHistory.json"]),
			});
			const imagesBytes = await getDirectoryBytes(
				path.join(storage.IMAGES_DIR, slug),
			);
			const aiHistory = await readAiHistoryMetric(slug);
			const undoRedo = await readCampaignUndoRedoMetric(slug);
			const rawOrder = Number(meta?.order);
			campaignsWithOrder.push({
				slug,
				name: String(meta?.name || slug),
				order: Number.isFinite(rawOrder) ? rawOrder : 0,
				contentBytes,
				imagesBytes,
				aiHistory,
				undoRedo,
				totalBytes:
					contentBytes + imagesBytes + aiHistory.bytes + undoRedo.bytes,
			});
		}

		campaignsWithOrder.sort(
			(left, right) =>
				left.order - right.order || left.name.localeCompare(right.name),
		);

		const campaigns = campaignsWithOrder.map(
			({ order: _order, ...campaign }) => campaign,
		);

		const bestiaryAi = await readAiHistoryMetric("bestiary");
		const appUndoRedo = await readApplicationUndoRedoMetric(slugs);
		const totalImagesBytes = await getDirectoryBytes(storage.IMAGES_DIR);
		const generalImagesBytes = await getDirectoryBytes(
			path.join(storage.IMAGES_DIR, "general"),
		);

		const appDataFiles = [
			"custom-bestiary.json",
			"favorites.json",
			"settings.json",
			"_schema.json",
		];
		let appDataBytes = await getDirectoryBytes(
			path.join(storage.DATA_DIR, "_migration-backups"),
		);
		for (const fileName of appDataFiles) {
			appDataBytes += await getFileBytes(path.join(storage.DATA_DIR, fileName));
		}

		let contentBytes = 0;
		let campaignsAiBytes = 0;
		let campaignsAiCount = 0;
		let campaignsUndoBytes = 0;
		let campaignsUndoCount = 0;
		for (const campaign of campaigns) {
			contentBytes += campaign.contentBytes;
			campaignsAiBytes += campaign.aiHistory.bytes;
			campaignsAiCount += campaign.aiHistory.entryCount;
			campaignsUndoBytes += campaign.undoRedo.bytes;
			campaignsUndoCount += campaign.undoRedo.entryCount;
		}

		const aiHistory = {
			bytes: campaignsAiBytes + bestiaryAi.bytes,
			entryCount: campaignsAiCount + bestiaryAi.entryCount,
			campaignsBytes: campaignsAiBytes,
			campaignsEntryCount: campaignsAiCount,
			bestiaryBytes: bestiaryAi.bytes,
			bestiaryEntryCount: bestiaryAi.entryCount,
		};
		const undoRedo = {
			bytes: appUndoRedo.bytes + campaignsUndoBytes,
			entryCount: appUndoRedo.entryCount + campaignsUndoCount,
			applicationBytes: appUndoRedo.bytes,
			applicationEntryCount: appUndoRedo.entryCount,
			tombstonesBytes: appUndoRedo.tombstonesBytes,
			campaignsBytes: campaignsUndoBytes,
			campaignsEntryCount: campaignsUndoCount,
		};

		const project = {
			contentBytes,
			imagesBytes: totalImagesBytes,
			generalImagesBytes,
			appDataBytes,
			aiHistory,
			undoRedo,
			totalBytes:
				contentBytes +
				totalImagesBytes +
				appDataBytes +
				aiHistory.bytes +
				undoRedo.bytes,
		};

		return { project, campaigns };
	}

	async function campaignExists(slug) {
		return storage.exists(storage.campaignMetaPath(slug));
	}

	async function clearCampaignAiHistory(slug) {
		await storage.clearAiResponses(slug);
	}

	async function clearBestiaryAiHistory() {
		await storage.clearAiResponses("bestiary");
	}

	async function clearAllAiHistory() {
		await storage.clearAiResponses("bestiary");
		const slugs = (await storage.listExportableCampaignSlugs()).filter(
			(slug) => !isRestoreArtifactName(slug),
		);
		for (const slug of slugs) {
			await storage.clearAiResponses(slug);
		}
	}

	return Object.freeze({
		readStorageOverview,
		campaignExists,
		clearCampaignAiHistory,
		clearBestiaryAiHistory,
		clearAllAiHistory,
	});
}

module.exports = { createFileStorageOverviewRepository };
