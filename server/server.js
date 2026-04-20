require("dotenv").config({
	path: require("path").join(__dirname, "..", ".env"),
});
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs/promises");
const storage = require("./storage");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/api/export-all", async (req, res, next) => {
	try {
		const slugs = await storage.listCampaignSlugs();
		res.json(
			await Promise.all(slugs.map((s) => storage.exportCampaignBundle(s))),
		);
	} catch (error) {
		next(error);
	}
});

app.post("/api/import-all", async (req, res, next) => {
	try {
		const bundles = Array.isArray(req.body) ? req.body : [req.body];
		for (const bundle of bundles) await storage.importCampaignBundle(bundle);
		res.status(201).json({ ok: true });
	} catch (error) {
		next(error);
	}
});

app.get("/api/health", async (_req, res) => {
	res.json({ ok: true });
});

// Image Upload Configuration
const upload = multer({
	storage: multer.diskStorage({
		destination: async (req, file, cb) => {
			const { slug, category } = req.params;
			const subcategory = req.body.subcategory || "";
			const dir = storage.campaignImagesDir(slug, category, subcategory);
			await storage.ensureDir(dir);
			cb(null, dir);
		},
		filename: (req, file, cb) => {
			// Виправлення кодування для кириличних назв файлів
			const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
			const ext = path.extname(originalName);
			const name = storage.sanitizeName(path.parse(originalName).name);
			cb(null, `${name}-${Date.now()}${ext}`);
		},
	}),
});

// Image Routes
app.get("/api/campaigns/:slug/images/:category", async (req, res, next) => {
	try {
		const images = await storage.listImages(
			req.params.slug, 
			req.params.category, 
			req.query.subcategory || "" // Виправлення: гарантуємо, що передається рядок, а не undefined
		);
		res.json(images);
	} catch (error) {
		next(error);
	}
});

app.post("/api/campaigns/:slug/images/:category", upload.single("image"), (req, res) => {
	const sub = req.body.subcategory ? `/${encodeURIComponent(req.body.subcategory)}` : "";
	const slug = encodeURIComponent(req.params.slug);
	const cat = encodeURIComponent(req.params.category);
	res.status(201).json({ 
		name: req.file.filename,
		url: `/api/images/${slug}/${cat}${sub}/${encodeURIComponent(req.file.filename)}` 
	});
});

app.get("/api/campaigns/:slug/images/:category/subcategories", async (req, res, next) => {
	try {
		const subs = await storage.listSubcategories(req.params.slug, req.params.category);
		res.json(subs);
	} catch (error) {
		next(error);
	}
});

app.post("/api/campaigns/:slug/images/:category/subcategories", async (req, res, next) => {
	try {
		const dir = storage.campaignImagesDir(req.params.slug, req.params.category, req.body.name);
		await storage.ensureDir(dir);
		res.status(201).json({ ok: true });
	} catch (error) {
		next(error);
	}
});

app.patch("/api/campaigns/:slug/images/:category/subcategories/:oldName", async (req, res, next) => {
	try {
		const { slug, category, oldName } = req.params;
		const { newName } = req.body;
		await storage.renameSubcategory(slug, category, oldName, newName);
		res.json({ ok: true });
	} catch (error) {
		next(error);
	}
});

app.post("/api/images/move", async (req, res, next) => {
	try {
		const results = await storage.moveImages(req.body.items, req.body.src, req.body.dest);
		res.json(results);
	} catch (error) {
		next(error);
	}
});

app.post("/api/images/delete", async (req, res, next) => {
	try {
		await storage.deleteImages(req.body.items, req.body.src);
		res.json({ ok: true });
		res.json(results);
	} catch (error) {
		next(error);
	}
});

app.use("/api/images", express.static(storage.IMAGES_DIR));

app.use("/api/campaigns", require("./routes/campaigns"));
app.use(
	"/api/campaigns/:slug/sessions",
	(req, res, next) => {
		req.campaignSlug = req.params.slug;
		next();
	},
	require("./routes/sessions"),
);
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

storage
	.ensureDir(storage.CAMPAIGNS_DIR)
	.then(() =>
		app.listen(PORT, () =>
			console.log(`Server running on http://localhost:${PORT}`),
		),
	)
	.catch((error) => {
		console.error("Failed to initialize storage:", error);
		process.exit(1);
	});
