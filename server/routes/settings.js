const express = require("express");
const settingsRepository = require("../domains/settings/settingsRepository");

const router = express.Router();

router.get("/", async (_req, res, next) => {
	try {
		res.json(await settingsRepository.readSettings());
	} catch (error) {
		next(error);
	}
});

router.patch("/", async (req, res, next) => {
	try {
		res.json(await settingsRepository.updateSettings(req.body || {}));
	} catch (error) {
		next(error);
	}
});

module.exports = router;
