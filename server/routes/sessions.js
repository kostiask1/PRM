const express = require("express");
const router = express.Router();
const sessionRepository = require("../domains/session/sessionRepository");
const {
	validateSessionMutation,
	validateSessionReorder,
} = require("../domains/session/sessionRequestSchemas");
const {
	validateBody,
} = require("../http/requestValidation");

async function ensureSessionExists(campaignSlug, fileName, res) {
	if (await sessionRepository.sessionExists(campaignSlug, fileName)) return true;
	res.status(404).json({ error: "Session not found." });
	return false;
}

router.get("/", async (req, res, next) => {
	try {
		const sessions = await sessionRepository.listSessions(req.campaignSlug);
		res.json(sessions);
	} catch (error) {
		next(error);
	}
});

router.post("/", validateBody(validateSessionMutation), async (req, res, next) => {
	try {
		const session = await sessionRepository.createSession(
			req.campaignSlug,
			req.validatedBody,
		);
		res.status(201).json(session);
	} catch (error) {
		next(error);
	}
});

router.get("/:fileName", async (req, res, next) => {
	try {
		const exists = await ensureSessionExists(
			req.campaignSlug,
			req.params.fileName,
			res,
		);
		if (!exists) return;
		const session = await sessionRepository.readSession(
			req.campaignSlug,
			req.params.fileName,
		);
		res.json({ ...session, fileName: req.params.fileName });
	} catch (error) {
		next(error);
	}
});

router.patch(
	"/:fileName",
	validateBody(validateSessionMutation),
	async (req, res, next) => {
	try {
		const { campaignSlug: slug } = req;
		const { fileName } = req.params;
		if (!(await ensureSessionExists(slug, fileName, res))) return;
		const updated = await sessionRepository.updateSession(
			slug,
			fileName,
			req.validatedBody,
		);
		res.json(updated);
	} catch (error) {
		next(error);
	}
	},
);

router.delete("/:fileName", async (req, res, next) => {
	try {
		const exists = await ensureSessionExists(
			req.campaignSlug,
			req.params.fileName,
			res,
		);
		if (!exists) return;
		await sessionRepository.deleteSession(
			req.campaignSlug,
			req.params.fileName,
		);
		res.status(204).send();
	} catch (error) {
		next(error);
	}
});

router.post(
	"/reorder",
	validateBody(validateSessionReorder),
	async (req, res, next) => {
	try {
		await sessionRepository.reorderSessions(
			req.campaignSlug,
			req.validatedBody.orders,
		);
		res.json({ ok: true });
	} catch (error) {
		next(error);
	}
	},
);

module.exports = router;
