require("dotenv").config({
	path: require("path").join(__dirname, "..", ".env"),
});
const express = require("express");
const storage = require("./storage");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/api/export-all", async (req, res, next) => {
	try {
		const slugs = await storage.listCampaignSlugs();
		res.json(await Promise.all(slugs.map((s) => storage.exportCampaignBundle(s))));
	} catch (error) { next(error); }
});

app.post("/api/import-all", async (req, res, next) => {
	try {
		const bundles = Array.isArray(req.body) ? req.body : [req.body];
		for (const bundle of bundles) await storage.importCampaignBundle(bundle);
		res.status(201).json({ ok: true });
	} catch (error) { next(error); }
});

app.get("/api/health", async (_req, res) => {
	res.json({ ok: true });
});

app.use("/api/campaigns", require("./routes/campaigns"));
app.use("/api/campaigns/:slug/sessions", (req, res, next) => {
	req.campaignSlug = req.params.slug;
	next();
}, require("./routes/sessions"));
app.use("/api/bestiary", require("./routes/bestiary"));
app.use("/api/spells", require("./routes/spells"));
app.use("/api/ai", require("./routes/ai"));

app.use((err, _req, res, _next) => {
	let status = err.status || 500;
	let message = err.message || "Внутрішня помилка сервера.";
	if (err.code === "ENOENT") {
		status = 404;
		message = "Ресурс не знайдено (файл або папка відсутні).";
	} else if (err.code === "EACCES") {
		status = 403;
		message = "Доступ заборонено. Перевірте права доступу до папки data.";
	}
	res.status(status).json({
		error: message,
		status: status,
		code: err.code,
	});
});

storage.ensureDir(storage.CAMPAIGNS_DIR)
	.then(() => app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`)))
	.catch((error) => {
		console.error("Failed to initialize storage:", error);
		process.exit(1);
	});
