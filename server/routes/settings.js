const express = require("express");
const storage = require("../storage");
const {
	createSettingsCommands,
} = require("../modules/settings/application/settingsCommands");
const {
	createFileSettingsRepository,
} = require("../modules/settings/infrastructure/fileSettingsRepository");
const {
	createStorageOverviewCommands,
} = require("../modules/settings/application/storageOverviewCommands");
const {
	createFileStorageOverviewRepository,
} = require("../modules/settings/infrastructure/fileStorageOverviewRepository");

const router = express.Router();
const settingsCommands = createSettingsCommands(
	createFileSettingsRepository(storage),
);
const storageOverviewCommands = createStorageOverviewCommands(
	createFileStorageOverviewRepository(storage),
);

router.get("/", async (_req, res, next) => {
	try {
		res.json(await settingsCommands.get());
	} catch (error) {
		next(error);
	}
});

router.patch("/", async (req, res, next) => {
	try {
		res.json(await settingsCommands.update({ patch: req.body }));
	} catch (error) {
		next(error);
	}
});

router.get("/storage", async (_req, res, next) => {
	try {
		res.json(await storageOverviewCommands.getOverview());
	} catch (error) {
		next(error);
	}
});

router.delete("/storage/ai-history", async (req, res, next) => {
	try {
		res.json(
			await storageOverviewCommands.clearAiHistory({
				scope: req.query?.scope ?? req.body?.scope,
				campaignSlug:
					req.query?.campaign ??
					req.body?.campaignSlug ??
					req.body?.campaign,
			}),
		);
	} catch (error) {
		next(error);
	}
});

module.exports = router;
