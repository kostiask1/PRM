const express = require("express");
const storage = require("../storage");
const {
	createSettingsCommands,
} = require("../modules/settings/application/settingsCommands");
const {
	createFileSettingsRepository,
} = require("../modules/settings/infrastructure/fileSettingsRepository");

const router = express.Router();
const settingsCommands = createSettingsCommands(
	createFileSettingsRepository(storage),
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

module.exports = router;
