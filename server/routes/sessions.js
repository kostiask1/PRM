const express = require("express");
const router = express.Router();
const storage = require("../storage");

router.get("/", async (req, res, next) => {
	try {
		const sessions = await storage.listSessions(req.campaignSlug);
		res.json(sessions);
	} catch (error) {
		next(error);
	}
});

router.post("/", async (req, res, next) => {
	try {
		const slug = req.campaignSlug;
		const existingSessions = await storage.listSessions(slug);
		const maxOrder = existingSessions.reduce(
			(max, s) => Math.max(max, s.order || 0),
			-1,
		);

		const baseName =
			storage.sanitizeName(req.body?.name) ||
			new Date().toISOString().slice(0, 10);
		const session = storage.makeDefaultSessionData(baseName);
		session.order = maxOrder + 1;
		const fileName = await storage.ensureUniqueSessionFile(slug, session.name);

		if (req.body?.data && typeof req.body.data === "object")
			session.data = req.body.data;
		await storage.writeJson(storage.sessionPath(slug, fileName), session);

		res.status(201).json({ ...session, fileName });
	} catch (error) {
		next(error);
	}
});

router.get("/:fileName", async (req, res, next) => {
	try {
		const fullPath = storage.sessionPath(req.campaignSlug, req.params.fileName);
		if (!(await storage.exists(fullPath)))
			return res.status(404).json({ error: "Сесію не знайдено." });
		const session = await storage.readJson(fullPath);
		res.json({ ...session, fileName: req.params.fileName });
	} catch (error) {
		next(error);
	}
});

router.patch("/:fileName", async (req, res, next) => {
	try {
		const { campaignSlug: slug } = req;
		const { fileName } = req.params;
		const fullPath = storage.sessionPath(slug, fileName);
		if (!(await storage.exists(fullPath)))
			return res.status(404).json({ error: "Сесію не знайдено." });

		const current = await storage.readJson(fullPath);
		const nextName = req.body?.name
			? storage.sanitizeName(req.body.name)
			: current.name;
		if (!nextName)
			return res.status(400).json({ error: "Назва не може бути порожньою." });

		const nextFileName = await storage.ensureUniqueSessionFile(
			slug,
			nextName,
			fileName,
		);
		const updated = {
			...current,
			...req.body,
			name: nextName,
			updatedAt: new Date().toISOString(),
		};

		if (nextFileName !== fileName) {
			await storage.renameWithRetry(
				fullPath,
				storage.sessionPath(slug, nextFileName),
			);
		}

		await storage.writeJson(storage.sessionPath(slug, nextFileName), updated);
		res.json({ ...updated, fileName: nextFileName });
	} catch (error) {
		next(error);
	}
});

router.delete("/:fileName", async (req, res, next) => {
	try {
		const fullPath = storage.sessionPath(req.campaignSlug, req.params.fileName);
		if (!(await storage.exists(fullPath)))
			return res.status(404).json({ error: "Сесію не знайдено." });
		await require("fs/promises").rm(fullPath, { force: true });
		res.status(204).send();
	} catch (error) {
		next(error);
	}
});

router.post("/reorder", async (req, res, next) => {
	try {
		const { campaignSlug: slug } = req;
		const { orders } = req.body;
		for (const fileName of Object.keys(orders)) {
			const session = await storage.readJson(
				storage.sessionPath(slug, fileName),
			);
			session.order = orders[fileName];
			await storage.writeJson(storage.sessionPath(slug, fileName), session);
		}
		res.json({ ok: true });
	} catch (error) {
		next(error);
	}
});

module.exports = router;
