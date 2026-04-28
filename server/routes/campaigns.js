const express = require("express");
const router = express.Router();
const fs = require("fs/promises");
const storage = require("../storage");

function validateEntityType(type, res) {
	if (storage.ENTITY_TYPES.includes(type)) return true;
	res.status(400).json({ error: "Невідомий тип сутності." });
	return false;
}

function getEntityDisplayName(entity, type) {
	if (type === "locations") {
		return String(entity?.name || entity?.title || "").trim();
	}
	const fullName = `${entity?.firstName || ""} ${entity?.lastName || ""}`.trim();
	return fullName || String(entity?.name || entity?.title || "").trim();
}

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
			notes: [
				{
					id: Date.now(),
					title: "",
					text: "",
					collapsed: false,
				},
			],
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

router.get("/:slug/entities/:type", async (req, res, next) => {
	try {
		if (!validateEntityType(req.params.type, res)) return;
		const entities = await storage.listEntities(
			req.params.slug,
			req.params.type,
		);
		res.json(entities);
	} catch (error) {
		next(error);
	}
});

router.post("/:slug/entities/:type", async (req, res, next) => {
	try {
		const { slug: campaignSlug, type } = req.params;
		if (!validateEntityType(type, res)) return;
		const isLocation = type === "locations";
		const name = storage.sanitizeName(
			isLocation ? req.body.name : req.body.firstName || req.body.name,
		);
		if (!name) {
			return res.status(400).json({ error: "Назва обов'язкова." });
		}
		const baseSlug = storage.campaignSlug(name);
		const entitySlug = await storage.ensureUniqueEntitySlug(
			campaignSlug,
			type,
			baseSlug,
		);
		const data = isLocation
			? {
					description: "",
					notes: [],
					imageUrl: null,
					collapsed: false,
					isNotesCollapsed: false,
					...req.body,
					id: storage.createId(),
					name: req.body.name || name,
				}
			: {
					firstName: req.body.firstName || name,
					lastName: req.body.lastName || "",
					race: req.body.race || "",
					class: req.body.class || "",
					level: req.body.level || 1,
					motivation: req.body.motivation || "",
					trait: req.body.trait || "",
					notes: [],
					...req.body,
					id: storage.createId(),
				};
		const saved = await storage.writeEntity(
			campaignSlug,
			type,
			entitySlug,
			data,
		);
		res.status(201).json(saved);
	} catch (error) {
		next(error);
	}
});

router.patch("/:slug/entities/:type/:entitySlug", async (req, res, next) => {
	try {
		const { slug: campaignSlug, type, entitySlug } = req.params;
		if (!validateEntityType(type, res)) return;
		const {
			_updateMentionReferences: updateMentionReferences,
			_mentionOldName: mentionOldName,
			...patch
		} = req.body || {};
		const current = await storage.readEntity(campaignSlug, type, entitySlug);
		const oldDisplayName =
			String(mentionOldName || "").trim() || getEntityDisplayName(current, type);
		const updated = {
			...current,
			...patch,
			updatedAt: new Date().toISOString(),
		};
		const saved = await storage.writeEntity(
			campaignSlug,
			type,
			entitySlug,
			updated,
		);
		if (updateMentionReferences) {
			const newDisplayName = getEntityDisplayName(saved, type);
			await storage.updateCampaignMentionReferences(
				campaignSlug,
				oldDisplayName,
				newDisplayName,
			);
		}
		res.json(await storage.readEntity(campaignSlug, type, saved.slug));
	} catch (error) {
		next(error);
	}
});

router.delete("/:slug/entities/:type/:entitySlug", async (req, res, next) => {
	try {
		const { slug: campaignSlug, type, entitySlug } = req.params;
		if (!validateEntityType(type, res)) return;
		await storage.deleteEntity(campaignSlug, type, entitySlug);
		res.status(204).send();
	} catch (error) {
		next(error);
	}
});

router.post("/:slug/entities/:type/:entitySlug/move", async (req, res, next) => {
	try {
		const { slug: campaignSlug, type, entitySlug } = req.params;
		const { targetType } = req.body || {};
		if (!validateEntityType(type, res)) return;
		if (!validateEntityType(targetType, res)) return;
		if (
			!(
				(type === "characters" && targetType === "npc") ||
				(type === "npc" && targetType === "characters")
			)
		) {
			res.status(400).json({
				error: "Entity can only be moved between characters and NPC.",
			});
			return;
		}
		const moved = await storage.moveEntity(
			campaignSlug,
			type,
			entitySlug,
			targetType,
		);
		res.json(moved);
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
