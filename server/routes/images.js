const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs/promises");
const storage = require("../storage");

const router = express.Router();

const upload = multer({
	storage: multer.diskStorage({
		destination: async (req, _file, cb) => {
			const { slug, category } = req.params;
			const subcategory = req.body.subcategory || "";
			const dir = storage.campaignImagesDir(slug, category, subcategory);
			await storage.ensureDir(dir);
			cb(null, dir);
		},
		filename: (req, file, cb) => {
			const originalName = Buffer.from(file.originalname, "latin1").toString(
				"utf8",
			);
			const ext = path.extname(originalName);
			const baseName =
				storage.sanitizeName(path.parse(originalName).name) || "image";
			const dir = storage.campaignImagesDir(
				req.params.slug,
				req.params.category,
				req.body.subcategory || "",
			);

			const resolveFileName = async () => {
				let candidate = `${baseName}${ext}`;
				let counter = 2;
				while (true) {
					const candidatePath = path.join(dir, candidate);
					try {
						await fs.access(candidatePath);
						candidate = `${baseName}-${counter}${ext}`;
						counter += 1;
					} catch {
						return candidate;
					}
				}
			};

			resolveFileName()
				.then((name) => cb(null, name))
				.catch((err) => cb(err));
		},
	}),
});

router.get("/campaigns/:slug/images/:category", async (req, res, next) => {
	try {
		const images = await storage.listImages(
			req.params.slug,
			req.params.category,
			req.query.subcategory || "",
		);
		res.json(images);
	} catch (error) {
		next(error);
	}
});

router.get("/images/stats", async (req, res, next) => {
	try {
		res.json(
			await storage.getImageGalleryStorageStats({
				source: req.query.source || "general",
				category: req.query.category || "",
				subcategory: req.query.subcategory || "",
				categories: String(req.query.categories || "")
					.split(",")
					.map((category) => category.trim())
					.filter(Boolean),
			}),
		);
	} catch (error) {
		next(error);
	}
});

router.get("/images/bestiary-tokens", async (req, res, next) => {
	try {
		res.json(
			await storage.listBestiaryTokenAssets({
				subcategory: req.query.subcategory || "",
				search: req.query.search || "",
			}),
		);
	} catch (error) {
		next(error);
	}
});

router.post(
	"/campaigns/:slug/images/:category",
	upload.single("image"),
	(req, res) => {
		const sub = req.body.subcategory
			? `/${encodeURIComponent(req.body.subcategory)}`
			: "";
		const slug = encodeURIComponent(req.params.slug);
		const cat = encodeURIComponent(req.params.category);
		res.status(201).json({
			name: req.file.filename,
			url: `/api/images/${slug}/${cat}${sub}/${encodeURIComponent(req.file.filename)}`,
		});
	},
);

router.get(
	"/campaigns/:slug/images/:category/subcategories",
	async (req, res, next) => {
		try {
			const subs = await storage.listSubcategories(
				req.params.slug,
				req.params.category,
				req.query.subcategory || "",
			);
			res.json(subs);
		} catch (error) {
			next(error);
		}
	},
);

router.post(
	"/campaigns/:slug/images/:category/subcategories",
	async (req, res, next) => {
		try {
			const dir = storage.campaignImagesDir(
				req.params.slug,
				req.params.category,
				req.body.name,
			);
			await storage.ensureDir(dir);
			res.status(201).json({ ok: true });
		} catch (error) {
			next(error);
		}
	},
);

router.patch(
	"/campaigns/:slug/images/:category/rename",
	async (req, res, next) => {
		try {
			const { slug, category } = req.params;
			const { subcategory, oldName, newName } = req.body;
			res.json(
				await storage.renameImage(
					slug,
					category,
					subcategory,
					oldName,
					newName,
				),
			);
		} catch (error) {
			next(error);
		}
	},
);

router.patch(
	"/campaigns/:slug/images/:category/subcategories/:oldName",
	async (req, res, next) => {
		try {
			const { slug, category, oldName } = req.params;
			const { newName } = req.body;
			await storage.renameSubcategory(slug, category, oldName, newName);
			res.json({ ok: true });
		} catch (error) {
			next(error);
		}
	},
);

router.post("/images/move", async (req, res, next) => {
	try {
		const results = await storage.moveImages(
			req.body.items,
			req.body.src,
			req.body.dest,
		);
		res.json(results);
	} catch (error) {
		next(error);
	}
});

router.post("/images/delete", async (req, res, next) => {
	try {
		await storage.deleteImages(
			req.body.items,
			req.body.src,
			req.body.options || {},
		);
		res.json({ ok: true });
	} catch (error) {
		next(error);
	}
});

module.exports = router;
