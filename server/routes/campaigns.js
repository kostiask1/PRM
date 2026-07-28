const express = require("express");
const router = express.Router();
const storage = require("../storage");
const {
	CAMPAIGN_ENTITY_TYPES,
	createCampaignEntityCommands,
} = require("../modules/campaign/application/campaignEntityCommands");
const {
	createFileCampaignEntityRepository,
} = require("../modules/campaign/infrastructure/fileCampaignEntityRepository");
const {
	createCampaignCommands,
} = require("../modules/campaign/application/campaignCommands");
const {
	createFileCampaignRepository,
} = require("../modules/campaign/infrastructure/fileCampaignRepository");
const {
	validateCampaignCreate,
	validateCampaignPatch,
	validateEntityMove,
	validateReorderRequest,
} = require("../modules/campaign/http/campaignRequestSchemas");
const {
	validateBody,
} = require("../http/requestValidation");

const campaignEntityRepository = createFileCampaignEntityRepository(storage);
const campaignEntityCommands = createCampaignEntityCommands(
	campaignEntityRepository,
);
const campaignCommands = createCampaignCommands(
	createFileCampaignRepository(storage),
);
const validateEntityMoveBody = validateBody(validateEntityMove);

function validateEntityMoveRequest(req, _res, next) {
	if (CAMPAIGN_ENTITY_TYPES.includes(req.params.type)) {
		validateEntityMoveBody(req, _res, next);
		return;
	}
	const error = new Error("Unknown entity type.");
	error.status = 400;
	next(error);
}

router.get("/", async (req, res, next) => {
	try {
		res.json(await campaignCommands.list());
	} catch (error) {
		next(error);
	}
});

router.post(
	"/",
	validateBody(validateCampaignCreate),
	async (req, res, next) => {
		try {
			res
				.status(201)
				.json(
					await campaignCommands.create({
						payload: req.validatedBody,
					}),
				);
		} catch (error) {
			next(error);
		}
	},
);

router.patch(
	"/:slug",
	validateBody(validateCampaignPatch),
	async (req, res, next) => {
		try {
			res.json(
				await campaignCommands.update({
					slug: req.params.slug,
					patch: req.validatedBody,
				}),
			);
		} catch (error) {
			next(error);
		}
	},
);

router.delete("/:slug", async (req, res, next) => {
	try {
		await campaignCommands.remove({
			slug: req.params.slug,
			moveImagesToGeneral: Boolean(req.body?.moveImagesToGeneral),
		});
		res.status(204).send();
	} catch (error) {
		next(error);
	}
});

router.get("/:slug/has-images", async (req, res, next) => {
	try {
		res.json(await campaignCommands.getImageStatus({ slug: req.params.slug }));
	} catch (error) {
		next(error);
	}
});

router.get("/:slug/export", async (req, res, next) => {
	try {
		res.json(await campaignCommands.export({ slug: req.params.slug }));
	} catch (error) {
		next(error);
	}
});

router.get("/:slug/entities/:type", async (req, res, next) => {
	try {
		res.json(
			await campaignEntityCommands.list({
				campaignSlug: req.params.slug,
				type: req.params.type,
			}),
		);
	} catch (error) {
		next(error);
	}
});

router.post("/:slug/entities/:type", async (req, res, next) => {
	try {
		res.status(201).json(
			await campaignEntityCommands.create({
				campaignSlug: req.params.slug,
				type: req.params.type,
				payload: req.body,
			}),
		);
	} catch (error) {
		next(error);
	}
});

router.put("/:slug/entities/:type", async (req, res, next) => {
	try {
		const { slug: campaignSlug, type } = req.params;
		res.json(
			await campaignEntityCommands.replaceAll({
				campaignSlug,
				type,
				entities: req.body?.entities,
			}),
		);
	} catch (error) {
		next(error);
	}
});

router.patch("/:slug/entities/:type/:entitySlug", async (req, res, next) => {
	try {
		res.json(
			await campaignEntityCommands.update({
				campaignSlug: req.params.slug,
				type: req.params.type,
				entitySlug: req.params.entitySlug,
				payload: req.body,
			}),
		);
	} catch (error) {
		next(error);
	}
});

router.delete("/:slug/entities/:type/:entitySlug", async (req, res, next) => {
	try {
		await campaignEntityCommands.delete({
			campaignSlug: req.params.slug,
			type: req.params.type,
			entitySlug: req.params.entitySlug,
		});
		res.status(204).send();
	} catch (error) {
		next(error);
	}
});

router.post(
	"/:slug/entities/:type/:entitySlug/move",
	validateEntityMoveRequest,
	async (req, res, next) => {
		try {
			const { slug: campaignSlug, type, entitySlug } = req.params;
			const { targetType } = req.validatedBody;
			res.json(
				await campaignEntityCommands.moveBetweenCharacterTypes({
					campaignSlug,
					type,
					entitySlug,
					targetType,
				}),
			);
		} catch (error) {
			next(error);
		}
	},
);

router.post(
	"/reorder",
	validateBody(validateReorderRequest),
	async (req, res, next) => {
		try {
			res.json(
				await campaignCommands.reorder({
					orders: req.validatedBody.orders,
				}),
			);
		} catch (error) {
			next(error);
		}
	},
);

module.exports = router;
