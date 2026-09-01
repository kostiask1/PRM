const express = require("express");
const { historyService } = require("../modules/history/runtime");
const { validateBody } = require("../http/requestValidation");
const {
	validateHistoryRestoreRequest,
} = require("../modules/history/http/historyRequestSchemas");

const router = express.Router();

router.get("/history", async (_req, res, next) => {
	try {
		res.json(await historyService.getApplicationStatus());
	} catch (error) {
		next(error);
	}
});

router.post("/history/undo", validateBody(validateHistoryRestoreRequest), async (req, res, next) => {
	try {
		res.json(
			await historyService.applyApplicationHistory(
				"undo",
				req.validatedBody.expectedRevision,
			),
		);
	} catch (error) {
		next(error);
	}
});

router.post("/history/redo", validateBody(validateHistoryRestoreRequest), async (req, res, next) => {
	try {
		res.json(
			await historyService.applyApplicationHistory(
				"redo",
				req.validatedBody.expectedRevision,
			),
		);
	} catch (error) {
		next(error);
	}
});

module.exports = router;
