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

router.get("/export-all", async (_req, res, next) => {
	try {
		const slugs = await storage.listCampaignSlugs();
		res.json(
			await Promise.all(slugs.map((slug) => storage.exportCampaignBundle(slug))),
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
		const payload = {
			version: 2,
			scope: "all",
			exportedAt: new Date().toISOString(),
			campaigns,
		};
		const buffer = zlib.gzipSync(Buffer.from(JSON.stringify(payload), "utf8"));
		const date = new Date().toISOString().slice(0, 10);
		res.setHeader("Content-Type", "application/gzip");
		res.setHeader(
			"Content-Disposition",
			attachmentDisposition(`prm-full-backup-${date}.prma.gz`),
		);
		res.send(buffer);
	} catch (error) {
		next(error);
	}
});

router.get("/campaigns/:slug/export/archive", async (req, res, next) => {
	try {
		const payload = {
			version: 2,
			scope: "campaign",
			exportedAt: new Date().toISOString(),
			campaigns: [await storage.exportCampaignArchiveBundle(req.params.slug)],
		};
		const buffer = zlib.gzipSync(Buffer.from(JSON.stringify(payload), "utf8"));
		const date = new Date().toISOString().slice(0, 10);
		res.setHeader("Content-Type", "application/gzip");
		res.setHeader(
			"Content-Disposition",
			attachmentDisposition(`campaign-${req.params.slug}-${date}.prma.gz`),
		);
		res.send(buffer);
	} catch (error) {
		next(error);
	}
});

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
			if (!req.file?.buffer) {
				return res
					.status(400)
					.json({ error: "Файл архіву не передано." });
			}

			const mode = req.query.mode === "campaign" ? "campaign" : "all";
			const strategy = normalizeImportStrategy(req.query.strategy);
			const effectiveStrategy = mode === "all" ? strategy : "append";
			const parsed = parseArchivePayload(req.file.buffer);
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
