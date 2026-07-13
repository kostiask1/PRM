const express = require("express");
const multer = require("multer");
const storage = require("../storage");
const {
	createBackupCommands,
} = require("../modules/backups/application/backupCommands");
const {
	createFileBackupRepository,
} = require("../modules/backups/infrastructure/fileBackupRepository");

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
			res.status(201).json(
				await backupCommands.importPartialArchive({
					slug: req.params.slug,
					buffer: req.file?.buffer,
					sections: req.body?.sections,
				}),
			);
		} catch (error) {
			next(error);
		}
	},
);

router.post("/import-all", async (req, res, next) => {
	try {
		res.status(201).json(
			await backupCommands.importAll({
				payload: req.body,
				strategy: req.query.strategy,
			}),
		);
	} catch (error) {
		next(error);
	}
});

router.post(
	"/import-archive",
	archiveUpload.single("archive"),
	async (req, res, next) => {
		try {
			res.status(201).json(
				await backupCommands.importArchive({
					buffer: req.file?.buffer,
					mode: req.query.mode,
					strategy: req.query.strategy,
				}),
			);
		} catch (error) {
			next(error);
		}
	},
);

module.exports = router;
