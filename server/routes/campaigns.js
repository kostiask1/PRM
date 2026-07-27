const express = require("express");
const router = express.Router();
const archiveExportService = require("../domains/archive/archiveExportService");
const campaignRepository = require("../domains/campaign/campaignRepository");
const {
	validateCampaignCreate,
	validateCampaignPatch,
	validateEntityMove,
	validateReorderRequest,
} = require("../domains/campaign/campaignRequestSchemas");
const campaignLifecycleService = require("../domains/campaign/campaignLifecycleService");
const entityRepository = require("../domains/entity/entityRepository");
const imageAssetRepository = require("../domains/image/imageAssetRepository");
const {
	replaceImageSlugReferences,
} = require("../domains/image/imageReferenceService");
const {
	normalizeSourceList,
} = require("../domains/settings/settingsRepository");
const {
	campaignSlug,
	sanitizeName,
} = require("../infrastructure/storagePaths");
const {
	validateBody,
} = require("../http/requestValidation");

function validateEntityType(type, res) {
	if (entityRepository.ENTITY_TYPES.includes(type)) return true;
	res.status(400).json({ error: "Unknown entity type." });
	return false;
}

router.get("/", async (req, res, next) => {
	try {
		const campaigns = await campaignRepository.listCampaignsDetailed();
		res.json(campaigns);
	} catch (error) {
		next(error);
	}
});

router.post("/", validateBody(validateCampaignCreate), async (req, res, next) => {
	try {
		const campaign = await campaignRepository.createCampaign(
			req.validatedBody,
		);
		res.status(201).json(campaign);
	} catch (error) {
		next(error);
	}
});

router.patch(
	"/:slug",
	validateBody(validateCampaignPatch),
	async (req, res, next) => {
	try {
		const oldSlug = req.params.slug;
		if (!(await campaignRepository.campaignExists(oldSlug))) {
			return res.status(404).json({ error: "Campaign not found." });
		}
		const current = await campaignRepository.readCampaign(oldSlug);
		const nextName = req.validatedBody.name
			? sanitizeName(req.validatedBody.name)
			: current.name;

		const nextSlug = await campaignRepository.ensureUniqueCampaignSlug(
			campaignSlug(nextName),
			oldSlug,
		);
		if (nextSlug !== oldSlug) {
			await campaignLifecycleService.renameCampaignData(oldSlug, nextSlug);
		}
		let updated = {
			...current,
			...req.validatedBody,
			slug: nextSlug,
			name: nextName,
		};
		updated = replaceImageSlugReferences(updated, oldSlug, nextSlug);
		if (
			Object.prototype.hasOwnProperty.call(
				req.validatedBody,
				"ignoreSourcesList",
			)
		) {
			updated.ignoreSourcesList = normalizeSourceList(
				req.validatedBody.ignoreSourcesList,
			);
		}
		await campaignRepository.writeCampaign(nextSlug, updated);
		res.json(updated);
	} catch (error) {
		next(error);
	}
	},
);

router.delete("/:slug", async (req, res, next) => {
	try {
		const slug = req.params.slug;
		if (!(await campaignRepository.campaignExists(slug)))
			return res.status(404).json({ error: "Campaign not found." });
		await campaignLifecycleService.deleteCampaignData(slug, {
			moveImagesToGeneral: Boolean(req.body?.moveImagesToGeneral),
		});
		res.status(204).send();
	} catch (error) {
		next(error);
	}
});

router.get("/:slug/has-images", async (req, res, next) => {
	try {
		res.json({
			hasImages: await imageAssetRepository.campaignHasImages(
				req.params.slug,
			),
		});
	} catch (error) {
		next(error);
	}
});

router.get("/:slug/export", async (req, res, next) => {
	try {
		res.json(await archiveExportService.exportCampaignBundle(req.params.slug));
	} catch (error) {
		next(error);
	}
});

router.get("/:slug/entities/:type", async (req, res, next) => {
	try {
		if (!validateEntityType(req.params.type, res)) return;
		const entities = await entityRepository.listEntities(
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
		const saved = await entityRepository.createEntity(
			campaignSlug,
			type,
			req.body,
		);
		if (!saved) {
			return res.status(400).json({ error: "Name is required." });
		}
		res.status(201).json(saved);
	} catch (error) {
		next(error);
	}
});

router.put("/:slug/entities/:type", async (req, res, next) => {
	try {
		const { slug: campaignSlug, type } = req.params;
		if (!validateEntityType(type, res)) return;
		res.json(
			await entityRepository.replaceEntities(
				campaignSlug,
				type,
				req.body?.entities,
			),
		);
	} catch (error) {
		next(error);
	}
});

router.patch("/:slug/entities/:type/:entitySlug", async (req, res, next) => {
	try {
		const { slug: campaignSlug, type, entitySlug } = req.params;
		if (!validateEntityType(type, res)) return;
		res.json(
			await entityRepository.updateEntity(
				campaignSlug,
				type,
				entitySlug,
				req.body,
			),
		);
	} catch (error) {
		next(error);
	}
});

router.delete("/:slug/entities/:type/:entitySlug", async (req, res, next) => {
	try {
		const { slug: campaignSlug, type, entitySlug } = req.params;
		if (!validateEntityType(type, res)) return;
		await entityRepository.deleteEntity(campaignSlug, type, entitySlug);
		res.status(204).send();
	} catch (error) {
		next(error);
	}
});

router.post(
	"/:slug/entities/:type/:entitySlug/move",
	validateBody(validateEntityMove),
	async (req, res, next) => {
		try {
			const { slug: campaignSlug, type, entitySlug } = req.params;
			const { targetType } = req.validatedBody;
			if (!validateEntityType(type, res)) return;
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
			const moved = await entityRepository.moveEntity(
				campaignSlug,
				type,
				entitySlug,
				targetType,
			);
			res.json(moved);
		} catch (error) {
			next(error);
		}
	},
);

router.post("/reorder", validateBody(validateReorderRequest), async (req, res, next) => {
	try {
		await campaignRepository.reorderCampaigns(
			req.validatedBody.orders,
		);
		res.json({ ok: true });
	} catch (error) {
		next(error);
	}
});

module.exports = router;
