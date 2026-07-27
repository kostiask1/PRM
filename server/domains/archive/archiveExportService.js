const fs = require("fs/promises");
const path = require("path");
const {
	exists,
} = require("../../infrastructure/jsonFileStore");
const {
	IMAGES_DIR,
} = require("../../infrastructure/storagePaths");
const {
	readAiResponses,
} = require("../ai/aiResponseRepository");
const {
	readCampaign,
} = require("../campaign/campaignRepository");
const {
	ENTITY_TYPES,
	listEntities,
} = require("../entity/entityRepository");
const {
	listSessions,
	readSession,
} = require("../session/sessionRepository");
const {
	normalizePartialArchiveSections,
} = require("./archiveSections");

function createArchiveExportService(overrides = {}) {
	const dependencies = {
		exists,
		imagesDir: IMAGES_DIR,
		listEntities,
		listSessions,
		readAiResponses,
		readCampaign,
		readDir: fs.readdir,
		readFile: fs.readFile,
		readSession,
		...overrides,
	};

	async function exportCampaignBundle(slug) {
		const meta = await dependencies.readCampaign(slug);
		const sessions = await Promise.all(
			(await dependencies.listSessions(slug)).map(async (session) => ({
				fileName: session.fileName,
				content: await dependencies.readSession(
					slug,
					session.fileName,
				),
			})),
		);
		const entities = Object.fromEntries(
			await Promise.all(
				ENTITY_TYPES.map(async (type) => [
					type,
					await dependencies.listEntities(slug, type),
				]),
			),
		);
		const aiResponses = await dependencies.readAiResponses(slug);
		return { meta, sessions, entities, aiResponses };
	}

	async function listCampaignImagesForArchive(slug) {
		const root = path.join(
			dependencies.imagesDir,
			path.basename(String(slug || "")),
		);
		if (!(await dependencies.exists(root))) return [];
		const files = [];
		const walk = async (directoryPath) => {
			const entries = await dependencies.readDir(directoryPath, {
				withFileTypes: true,
			});
			for (const entry of entries) {
				const fullPath = path.join(directoryPath, entry.name);
				if (entry.isDirectory()) {
					await walk(fullPath);
				} else if (entry.isFile()) {
					files.push({
						relativePath: path
							.relative(root, fullPath)
							.split(path.sep)
							.join("/"),
						base64: (
							await dependencies.readFile(fullPath)
						).toString("base64"),
					});
				}
			}
		};
		await walk(root);
		return files;
	}

	async function exportCampaignArchiveBundle(slug) {
		return {
			bundle: await exportCampaignBundle(slug),
			images: await listCampaignImagesForArchive(slug),
		};
	}

	async function exportCampaignPartialArchiveBundle(slug, sections = []) {
		const selected = normalizePartialArchiveSections(sections);
		const meta = await dependencies.readCampaign(slug);
		const bundle = { meta, sessions: [], entities: {}, aiResponses: [] };
		if (selected.includes("sessions")) {
			bundle.sessions = await Promise.all(
				(await dependencies.listSessions(slug)).map(
					async (session) => ({
						fileName: session.fileName,
						content: await dependencies.readSession(
							slug,
							session.fileName,
						),
					}),
				),
			);
		}
		if (selected.includes("npc")) {
			bundle.entities.npc = await dependencies.listEntities(slug, "npc");
		}
		if (selected.includes("locations")) {
			bundle.entities.locations = await dependencies.listEntities(
				slug,
				"locations",
			);
		}
		if (selected.includes("aiHistory")) {
			bundle.aiResponses = await dependencies.readAiResponses(slug);
		}
		return {
			version: 2,
			scope: "campaign-partial",
			sourceSlug: slug,
			sourceName: meta.name,
			sections: selected,
			bundle,
			images: selected.includes("images")
				? await listCampaignImagesForArchive(slug)
				: [],
		};
	}

	return {
		exportCampaignArchiveBundle,
		exportCampaignBundle,
		exportCampaignPartialArchiveBundle,
		listCampaignImagesForArchive,
	};
}

const archiveExportService = createArchiveExportService();

module.exports = {
	...archiveExportService,
	createArchiveExportService,
};
