const express = require("express");
const storage = require("../storage");

const router = express.Router();

router.get("/", async (_req, res, next) => {
	try {
		res.json(await storage.readSettings());
	} catch (error) {
		next(error);
	}
});

router.patch("/", async (req, res, next) => {
	try {
		res.json(await storage.updateSettings(req.body || {}));
	} catch (error) {
		next(error);
	}
});

module.exports = router;
