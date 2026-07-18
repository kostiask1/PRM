const express = require("express");
const router = express.Router();
const storage = require("../storage");
const {
	createCampaignEntityScopeCommands,
} = require("../modules/campaign/application/campaignEntityScopeCommands");
const {
	createFileCampaignEntityScopeRepository,
} = require("../modules/campaign/infrastructure/fileCampaignEntityScopeRepository");
const {
	createSceneEncounterCommand,
} = require("../modules/session/application/createSceneEncounter");
const {
	createUpdateEncounterCommand,
} = require("../modules/session/application/updateEncounter");
const {
	createAddEncounterMonsterCommand,
} = require("../modules/session/application/addEncounterMonster");
const {
	createSessionCommands,
} = require("../modules/session/application/sessionCommands");
const {
	createFileSessionRepository,
} = require("../modules/session/infrastructure/fileSessionRepository");

const entityScopeCommands = createCampaignEntityScopeCommands(
	createFileCampaignEntityScopeRepository(storage),
);
const sessionRepository = createFileSessionRepository(storage);
const createSceneEncounter = createSceneEncounterCommand(sessionRepository);
const updateEncounter = createUpdateEncounterCommand(sessionRepository);
const addEncounterMonster = createAddEncounterMonsterCommand(sessionRepository);
const sessionCommands = createSessionCommands(sessionRepository);

router.get("/", async (req, res, next) => {
	try {
		res.json(await sessionCommands.list({ campaignSlug: req.campaignSlug }));
	} catch (error) {
		next(error);
	}
});

router.post("/", async (req, res, next) => {
	try {
		res.status(201).json(
			await sessionCommands.create({
				campaignSlug: req.campaignSlug,
				payload: req.body,
			}),
		);
	} catch (error) {
		next(error);
	}
});

router.post("/:fileName/entities/:type/:entityId/move-scope", async (req, res, next) => {
	try {
		const result = await entityScopeCommands.move({
			campaignSlug: req.campaignSlug,
			fileName: req.params.fileName,
			type: req.params.type,
			entityId: req.params.entityId,
			entitySlug: req.body?.entitySlug,
			targetScope: req.body?.targetScope,
		});
		res.json(result);
	} catch (error) {
		next(error);
	}
});

router.post("/:fileName/scenes/:sceneId/encounters", async (req, res, next) => {
	try {
		const result = await createSceneEncounter({
			campaignSlug: req.campaignSlug,
			fileName: req.params.fileName,
			sceneId: req.params.sceneId,
			name: req.body?.name,
		});
		res.status(result.created ? 201 : 200).json(result);
	} catch (error) {
		next(error);
	}
});

router.patch("/:fileName/encounters/:encounterId", async (req, res, next) => {
	try {
		res.json(
			await updateEncounter({
				campaignSlug: req.campaignSlug,
				fileName: req.params.fileName,
				encounterId: req.params.encounterId,
				patch: req.body,
			}),
		);
	} catch (error) {
		next(error);
	}
});

router.post(
	"/:fileName/encounters/:encounterId/monsters",
	async (req, res, next) => {
		try {
			res.status(201).json(
				await addEncounterMonster({
					campaignSlug: req.campaignSlug,
					fileName: req.params.fileName,
					encounterId: req.params.encounterId,
					monster: req.body?.monster,
				}),
			);
		} catch (error) {
			next(error);
		}
	},
);

router.get("/:fileName", async (req, res, next) => {
	try {
		res.json(
			await sessionCommands.get({
				campaignSlug: req.campaignSlug,
				fileName: req.params.fileName,
			}),
		);
	} catch (error) {
		next(error);
	}
});

router.patch("/:fileName", async (req, res, next) => {
	try {
		res.json(
			await sessionCommands.update({
				campaignSlug: req.campaignSlug,
				fileName: req.params.fileName,
				patch: req.body,
			}),
		);
	} catch (error) {
		next(error);
	}
});

router.delete("/:fileName", async (req, res, next) => {
	try {
		await sessionCommands.remove({
			campaignSlug: req.campaignSlug,
			fileName: req.params.fileName,
		});
		res.status(204).send();
	} catch (error) {
		next(error);
	}
});

router.post("/reorder", async (req, res, next) => {
	try {
		res.json(
			await sessionCommands.reorder({
				campaignSlug: req.campaignSlug,
				orders: req.body?.orders,
			}),
		);
	} catch (error) {
		next(error);
	}
});

module.exports = router;
