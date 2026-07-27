const express = require("express");
const multer = require("multer");
const zlib = require("zlib");
const archiveExportService = require("../domains/archive/archiveExportService");
const archiveImportService = require("../domains/archive/archiveImportService");
const {
	campaignBundlesFromEnvelope,
	validateCampaignArchiveEnvelope,
	validateCampaignBundleCollection,
	validatePartialArchiveBundle,
} = require("../domains/archive/archiveRequestSchemas");
const campaignRepository = require("../domains/campaign/campaignRepository");
const {
	assertValidRequest,
	createRequestValidationError,
	validateBody,
	validationIssue,
} = require("../http/requestValidation");

const router = express.Router();

const archiveUpload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 200 * 1024 * 1024 },
});

function parseArchivePayload(buffer) {
	const isGzip =
		buffer?.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
	const raw = isGzip ? zlib.gunzipSync(buffer) : buffer;
	return JSON.parse(raw.toString("utf8"));
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

function normalizeImportStrategy(strategy) {
	const value = String(strategy || "append").toLowerCase();
	if (["append", "replace_by_id", "wipe_and_replace"].includes(value)) {
		return value;
	}
	return "append";
}

function asciiFallbackFilename(filename) {
	const cleaned = String(filename || "download")
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^\x20-\x7E]/g, "-")
		.replace(/[\\"]/g, "-")
		.replace(/\s+/g, " ")
		.replace(/-+/g, "-")
		.trim();
	return cleaned || "download";
}

function encodeHeaderFilename(filename) {
	return encodeURIComponent(String(filename || "download")).replace(
		/['()*]/g,
		(char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
	);
}

function attachmentDisposition(filename) {
	const fallback = asciiFallbackFilename(filename);
	return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeHeaderFilename(filename)}`;
}

function sendArchive(res, payload, filename) {
	const buffer = zlib.gzipSync(Buffer.from(JSON.stringify(payload), "utf8"));
	res.setHeader("Content-Type", "application/gzip");
	res.setHeader("Content-Disposition", attachmentDisposition(filename));
	res.send(buffer);
}

function sendDatedArchive(res, payload, getFilename) {
	const date = new Date().toISOString().slice(0, 10);
	sendArchive(res, payload, getFilename(date));
}

function buildArchivePayload(scope, campaigns) {
	return {
		version: 2,
		scope,
		exportedAt: new Date().toISOString(),
		campaigns,
	};
}

router.get("/export-all", async (_req, res, next) => {
	try {
		const slugs = await campaignRepository.listCampaignSlugs();
		res.json(
			await Promise.all(
				slugs.map((slug) =>
					archiveExportService.exportCampaignBundle(slug),
				),
			),
		);
	} catch (error) {
		next(error);
	}
});

router.get("/export-all/archive", async (_req, res, next) => {
	try {
		const slugs = await campaignRepository.listCampaignSlugs();
		const campaigns = await Promise.all(
			slugs.map((slug) =>
				archiveExportService.exportCampaignArchiveBundle(slug),
			),
		);
		const payload = buildArchivePayload("all", campaigns);
		sendDatedArchive(
			res,
			payload,
			(date) => `prm-full-backup-${date}.prma.gz`,
		);
	} catch (error) {
		next(error);
	}
});

router.get("/campaigns/:slug/export/archive", async (req, res, next) => {
	try {
		const payload = buildArchivePayload("campaign", [
			await archiveExportService.exportCampaignArchiveBundle(
				req.params.slug,
			),
		]);
		sendDatedArchive(
			res,
			payload,
			(date) => `campaign-${req.params.slug}-${date}.prma.gz`,
		);
	} catch (error) {
		next(error);
	}
});

router.get(
	"/campaigns/:slug/export/partial-archive",
	async (req, res, next) => {
		try {
			const sections = String(req.query.sections || "")
				.split(",")
				.map((section) => section.trim())
				.filter(Boolean);
			const payload =
				await archiveExportService.exportCampaignPartialArchiveBundle(
				req.params.slug,
				sections,
			);
			sendDatedArchive(
				res,
				payload,
				(date) => `campaign-${req.params.slug}-partial-${date}.prma.gz`,
			);
		} catch (error) {
			next(error);
		}
	},
);

router.post(
	"/campaigns/:slug/import/partial-archive",
	archiveUpload.single("archive"),
		async (req, res, next) => {
		try {
			const parsed = readUploadedArchivePayload(req);
			const archiveBundle = Array.isArray(parsed?.campaigns)
				? parsed.campaigns[0]
				: parsed;
			const selectedSections = String(req.body?.sections || "")
				.split(",")
				.map((section) => section.trim())
				.filter(Boolean);
			const validatedArchive = assertValidRequest(
				selectedSections.length > 0
					? { ...archiveBundle, sections: selectedSections }
					: archiveBundle,
				validatePartialArchiveBundle,
				"archive",
			);
			res
				.status(201)
				.json(
					await archiveImportService.importCampaignPartialArchiveBundle(
						req.params.slug,
						validatedArchive,
					),
				);
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
		const bundles = Array.isArray(req.validatedBody)
			? req.validatedBody
			: [req.validatedBody];
		if (strategy === "wipe_and_replace") {
			await archiveImportService.clearAllCampaignData();
		}
		for (const bundle of bundles) {
			if (strategy === "replace_by_id") {
				const existingSlug = await archiveImportService.findCampaignSlugById(
					bundle?.meta?.id,
				);
				if (existingSlug) {
					await archiveImportService.importCampaignBundle(bundle, {
						forcedSlug: existingSlug,
						replaceExisting: true,
					});
					continue;
				}
			}
			await archiveImportService.importCampaignBundle(bundle);
		}
		res.status(201).json({ ok: true, imported: bundles.length, strategy });
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
			const mode = req.query.mode === "campaign" ? "campaign" : "all";
			const strategy = normalizeImportStrategy(req.query.strategy);
			const effectiveStrategy = mode === "all" ? strategy : "append";
			const parsed = assertValidRequest(
				readUploadedArchivePayload(req),
				validateCampaignArchiveEnvelope,
				"archive",
			);
			const campaigns = campaignBundlesFromEnvelope(parsed);
			const selected = mode === "campaign" ? campaigns.slice(0, 1) : campaigns;

			if (effectiveStrategy === "wipe_and_replace") {
				await archiveImportService.clearAllCampaignData();
			}

			for (const archiveBundle of selected) {
				await archiveImportService.importCampaignArchiveBundleWithStrategy(
					archiveBundle,
					effectiveStrategy,
				);
			}

			res.status(201).json({
				ok: true,
				imported: selected.length,
				strategy: effectiveStrategy,
			});
		} catch (error) {
			next(error);
		}
	},
);

module.exports = router;
