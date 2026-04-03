const express = require("express");
const router = express.Router();
const fs = require("fs/promises");
const storage = require("../storage");

router.get("/", async (req, res, next) => {
	try {
		const campaigns = await storage.listCampaignsDetailed();
		res.json(campaigns);
	} catch (error) {
		next(error);
	}
});

router.post("/", async (req, res, next) => {
	try {
		const name = storage.sanitizeName(req.body?.name);
		if (!name)
			return res.status(400).json({ error: "Назва кампанії обов’язкова." });
		const slug = await storage.ensureUniqueCampaignSlug(
			storage.campaignSlug(name),
		);
		const now = new Date().toISOString();
		const meta = {
			id: storage.createId(),
			slug,
			name,
			completed: false,
			completedAt: null,
			order: 0,
			createdAt: now,
			updatedAt: now,
		};
		await storage.ensureDir(
			require("path").join(storage.campaignDir(slug), "sessions"),
		);
		await storage.writeJson(storage.campaignMetaPath(slug), meta);
		res.status(201).json(meta);
	} catch (error) {
		next(error);
	}
});

router.patch("/:slug", async (req, res, next) => {
	try {
		const oldSlug = req.params.slug;
		if (!(await storage.exists(storage.campaignMetaPath(oldSlug)))) {
			return res.status(404).json({ error: "Кампанію не знайдено." });
		}
		const current = await storage.readCampaign(oldSlug);
		const nextName = req.body?.name
			? storage.sanitizeName(req.body.name)
			: current.name;
		if (!nextName)
			return res
				.status(400)
				.json({ error: "Назва кампанії не може бути порожньою." });

		const nextSlug = await storage.ensureUniqueCampaignSlug(
			storage.campaignSlug(nextName),
			oldSlug,
		);
		if (nextSlug !== oldSlug) {
			await storage.renameWithRetry(
				storage.campaignDir(oldSlug),
				storage.campaignDir(nextSlug),
			);
		}
		const updated = {
			...current,
			...req.body,
			slug: nextSlug,
			name: nextName,
			updatedAt: new Date().toISOString(),
		};
		await storage.writeJson(storage.campaignMetaPath(nextSlug), updated);
		res.json(updated);
	} catch (error) {
		next(error);
	}
});

router.delete("/:slug", async (req, res, next) => {
	try {
		const slug = req.params.slug;
		const dir = storage.campaignDir(slug);
		if (!(await storage.exists(dir)))
			return res.status(404).json({ error: "Кампанію не знайдено." });
		await fs.rm(dir, { recursive: true, force: true });
		res.status(204).send();
	} catch (error) {
		next(error);
	}
});

router.get("/:slug/export", async (req, res, next) => {
	try {
		res.json(await storage.exportCampaignBundle(req.params.slug));
	} catch (error) {
		next(error);
	}
});

router.post("/reorder", async (req, res, next) => {
	try {
		const { orders } = req.body;
		for (const slug of Object.keys(orders)) {
			if (await storage.exists(storage.campaignMetaPath(slug))) {
				const meta = await storage.readCampaign(slug);
				meta.order = orders[slug];
				await storage.writeJson(storage.campaignMetaPath(slug), meta);
			}
		}
		res.json({ ok: true });
	} catch (error) {
		next(error);
	}
});

module.exports = router;
