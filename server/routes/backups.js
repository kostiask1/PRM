const express = require("express");
const multer = require("multer");
const zlib = require("zlib");
const storage = require("../storage");

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

function readUploadedArchivePayload(req, res) {
	if (!req.file?.buffer) {
		res.status(400).json({ error: "Archive file was not provided." });
		return null;
	}
	return parseArchivePayload(req.file.buffer);
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
		const slugs = await storage.listCampaignSlugs();
		res.json(
			await Promise.all(
				slugs.map((slug) => storage.exportCampaignBundle(slug)),
			),
		);
	} catch (error) {
		next(error);
	}
});

router.get("/export-all/archive", async (_req, res, next) => {
	try {
		const slugs = await storage.listCampaignSlugs();
		const campaigns = await Promise.all(
			slugs.map((slug) => storage.exportCampaignArchiveBundle(slug)),
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
			await storage.exportCampaignArchiveBundle(req.params.slug),
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
			const payload = await storage.exportCampaignPartialArchiveBundle(
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
			const parsed = readUploadedArchivePayload(req, res);
			if (!parsed) return;
			const archiveBundle = Array.isArray(parsed?.campaigns)
				? parsed.campaigns[0]
				: parsed;
			const selectedSections = String(req.body?.sections || "")
				.split(",")
				.map((section) => section.trim())
				.filter(Boolean);
			res
				.status(201)
				.json(
					await storage.importCampaignPartialArchiveBundle(
						req.params.slug,
						selectedSections.length > 0
							? { ...archiveBundle, sections: selectedSections }
							: archiveBundle,
					),
				);
		} catch (error) {
			next(error);
		}
	},
);

router.post("/import-all", async (req, res, next) => {
	try {
		const strategy = normalizeImportStrategy(req.query.strategy);
		const bundles = Array.isArray(req.body) ? req.body : [req.body];
		if (strategy === "wipe_and_replace") {
			await storage.clearAllCampaignData();
		}
		for (const bundle of bundles) {
			if (strategy === "replace_by_id") {
				const existingSlug = await storage.findCampaignSlugById(
					bundle?.meta?.id,
				);
				if (existingSlug) {
					await storage.importCampaignBundle(bundle, {
						forcedSlug: existingSlug,
						replaceExisting: true,
					});
					continue;
				}
			}
			await storage.importCampaignBundle(bundle);
		}
		res.status(201).json({ ok: true, imported: bundles.length, strategy });
	} catch (error) {
		next(error);
	}
});

router.post(
	"/import-archive",
	archiveUpload.single("archive"),
	async (req, res, next) => {
		try {
			const mode = req.query.mode === "campaign" ? "campaign" : "all";
			const strategy = normalizeImportStrategy(req.query.strategy);
			const effectiveStrategy = mode === "all" ? strategy : "append";
			const parsed = readUploadedArchivePayload(req, res);
			if (!parsed) return;
			const campaigns = Array.isArray(parsed)
				? parsed
				: Array.isArray(parsed?.campaigns)
					? parsed.campaigns
					: [parsed];
			const selected = mode === "campaign" ? campaigns.slice(0, 1) : campaigns;

			if (effectiveStrategy === "wipe_and_replace") {
				await storage.clearAllCampaignData();
			}

			for (const archiveBundle of selected) {
				await storage.importCampaignArchiveBundleWithStrategy(
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
