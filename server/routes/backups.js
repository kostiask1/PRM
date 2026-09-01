const express = require("express");
const multer = require("multer");
const storage = require("../storage");
const { historyService } = require("../modules/history/runtime");
const {
	createBackupCommands,
	normalizeImportStrategy,
	parseArchivePayload,
	parseList,
} = require("../modules/backups/application/backupCommands");
const {
	createFileBackupRepository,
} = require("../modules/backups/infrastructure/fileBackupRepository");
const {
	validateCampaignArchiveEnvelope,
	validateCampaignBundleCollection,
	validatePartialArchiveBundle,
} = require("../modules/backups/http/archiveRequestSchemas");
const {
	assertValidRequest,
	createRequestValidationError,
	validateBody,
	validationIssue,
} = require("../http/requestValidation");

const router = express.Router();
const backupCommands = createBackupCommands(createFileBackupRepository(storage));
const archiveUpload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 200 * 1024 * 1024 },
});

function asciiFallbackFilename(filename) {
	return (
		String(filename || "download")
			.normalize("NFKD")
			.replace(/[\u0300-\u036f]/g, "")
			.replace(/[^\x20-\x7E]/g, "-")
			.replace(/[\\"]/g, "-")
			.replace(/\s+/g, " ")
			.replace(/-+/g, "-")
			.trim() || "download"
	);
}

function attachmentDisposition(filename) {
	const encoded = encodeURIComponent(String(filename || "download")).replace(
		/['()*]/g,
		(character) =>
			`%${character.charCodeAt(0).toString(16).toUpperCase()}`,
	);
	return `attachment; filename="${asciiFallbackFilename(filename)}"; filename*=UTF-8''${encoded}`;
}

function sendDownload(res, download) {
	res.setHeader("Content-Type", download.contentType);
	res.setHeader("Content-Disposition", attachmentDisposition(download.filename));
	res.send(download.buffer);
}

function readUploadedArchivePayload(req) {
	if (!req.file?.buffer) {
		throw createRequestValidationError(
			[
				validationIssue(
					"archive",
					"Archive file was not provided.",
					"required",
				),
			],
			"Invalid archive file.",
		);
	}

	try {
		return parseArchivePayload(req.file.buffer);
	} catch {
		throw createRequestValidationError(
			[
				validationIssue(
					"archive",
					"Archive must contain valid JSON or gzip-compressed JSON.",
					"invalid_archive",
				),
			],
			"Invalid archive file.",
		);
	}
}

function campaignBundlesFromImportPayload(payload) {
	if (Array.isArray(payload)) return payload;
	if (Array.isArray(payload?.campaigns)) return payload.campaigns;
	return payload?.meta || payload?.bundle?.meta ? [payload] : [];
}

async function findReplacedCampaignSlugs(payload, strategy) {
	if (strategy === "wipe_and_replace") {
		return storage.listExportableCampaignSlugs();
	}
	if (strategy !== "replace_by_id") return [];

	const slugs = [];
	for (const entry of campaignBundlesFromImportPayload(payload)) {
		const bundle = entry?.bundle || entry;
		const campaignId = bundle?.meta?.id;
		if (campaignId == null) continue;
		const slug = await storage.findCampaignSlugById(campaignId);
		if (slug) slugs.push(slug);
	}
	return [...new Set(slugs)];
}

async function resetImportedChangeHistory(payload, strategy) {
	const affectedCampaigns = await findReplacedCampaignSlugs(payload, strategy);
	await historyService.clearApplicationHistory();
	for (const slug of affectedCampaigns) {
		await historyService.clearCampaignHistory(slug);
	}
}

router.get("/export-all", async (_req, res, next) => {
	try {
		res.json(await backupCommands.exportAll());
	} catch (error) {
		next(error);
	}
});

router.get("/export-all/archive", async (_req, res, next) => {
	try {
		sendDownload(res, await backupCommands.exportAllArchive());
	} catch (error) {
		next(error);
	}
});

router.get("/campaigns/:slug/export/archive", async (req, res, next) => {
	try {
		sendDownload(
			res,
			await backupCommands.exportCampaignArchive({ slug: req.params.slug }),
		);
	} catch (error) {
		next(error);
	}
});

router.get("/campaigns/:slug/export/partial-archive", async (req, res, next) => {
	try {
		sendDownload(
			res,
			await backupCommands.exportPartialArchive({
				slug: req.params.slug,
				sections: req.query.sections,
			}),
		);
	} catch (error) {
		next(error);
	}
});

router.post(
	"/campaigns/:slug/import/partial-archive",
	archiveUpload.single("archive"),
	async (req, res, next) => {
		try {
			const parsed = readUploadedArchivePayload(req);
			const archiveBundle = Array.isArray(parsed?.campaigns)
				? parsed.campaigns[0]
				: parsed;
			const selectedSections = parseList(req.body?.sections);
			const validatedArchive = assertValidRequest(
				selectedSections.length > 0
					? {
							...archiveBundle,
							sections: selectedSections,
						}
					: archiveBundle,
				validatePartialArchiveBundle,
				"archive",
			);
			await historyService.clearApplicationHistory();
			await historyService.clearCampaignHistory(req.params.slug);
			const result = await backupCommands.importPartialArchive({
				slug: req.params.slug,
				payload: validatedArchive,
			});
			res.status(201).json(result);
		} catch (error) {
			next(error);
		}
	},
);

router.post(
	"/import-all",
	validateBody(validateCampaignBundleCollection),
	async (req, res, next) => {
		try {
			const strategy = normalizeImportStrategy(req.query.strategy);
			await resetImportedChangeHistory(req.validatedBody, strategy);
			const result = await backupCommands.importAll({
				payload: req.validatedBody,
				strategy,
			});
			res.status(201).json(result);
		} catch (error) {
			next(error);
		}
	},
);

router.post(
	"/import-archive",
	archiveUpload.single("archive"),
	async (req, res, next) => {
		try {
			const payload = assertValidRequest(
				readUploadedArchivePayload(req),
				validateCampaignArchiveEnvelope,
				"archive",
			);
			const mode = req.query.mode === "campaign" ? "campaign" : "all";
			const strategy =
				mode === "all"
					? normalizeImportStrategy(req.query.strategy)
					: "append";
			await resetImportedChangeHistory(payload, strategy);
			const result = await backupCommands.importArchive({
				payload,
				mode,
				strategy,
			});
			res.status(201).json(result);
		} catch (error) {
			next(error);
		}
	},
);

module.exports = router;
