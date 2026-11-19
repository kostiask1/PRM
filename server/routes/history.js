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

router.delete("/history", async (req, res, next) => {
	try {
		const scope = String(req.query?.scope || "application").trim();
		if (scope !== "application" && scope !== "all") {
			return res
				.status(400)
				.json({ error: "Invalid history cleanup scope." });
		}
		if (scope === "all") {
			await historyService.clearAllHistory();
		} else {
			await historyService.clearApplicationHistory();
		}
		res.json({
			cleared: true,
			scope,
			history: await historyService.getApplicationStatus(),
		});
	} catch (error) {
		next(error);
	}
});

module.exports = router;
