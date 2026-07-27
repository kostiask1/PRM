const express = require("express");
const multer = require("multer");
const path = require("path");
const imageAssetRepository = require("../domains/image/imageAssetRepository");
const imageGalleryReadService = require("../domains/image/imageGalleryReadService");
const { sanitizeName } = require("../infrastructure/storagePaths");

const router = express.Router();

function parseImageGalleryQuery(query, defaultSource = "") {
	return {
		source: query.source || defaultSource,
		category: query.category || "",
		subcategory: query.subcategory || "",
		categories: String(query.categories || "")
			.split(",")
			.map((category) => category.trim())
			.filter(Boolean),
		ignoreSourcesList: String(query.ignoreSources || "")
			.split(",")
			.map((source) => source.trim())
			.filter(Boolean),
	};
}

const upload = multer({
	storage: multer.diskStorage({
		destination: async (req, _file, cb) => {
			const { slug, category } = req.params;
			const subcategory = req.body.subcategory || "";
			await imageAssetRepository.createSubcategory(
				slug,
				category,
				subcategory,
			);
			cb(
				null,
				imageAssetRepository.imageDirectory(
					slug,
					category,
					subcategory,
				),
			);
		},
		filename: (req, file, cb) => {
			const originalName = Buffer.from(file.originalname, "latin1").toString(
				"utf8",
			);
			const ext = path.extname(originalName);
			const baseName = sanitizeName(path.parse(originalName).name) || "image";
			imageAssetRepository
				.ensureUniqueImageFileName(
					req.params.slug,
					req.params.category,
					req.body.subcategory || "",
					baseName,
					ext,
				)
				.then((name) => cb(null, name))
				.catch((err) => cb(err));
		},
	}),
});

router.get("/campaigns/:slug/images/:category", async (req, res, next) => {
	try {
		const images = await imageAssetRepository.listImages(
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
			await imageGalleryReadService.getImageGalleryStorageStats({
				...parseImageGalleryQuery(req.query, "general"),
			}),
		);
	} catch (error) {
		next(error);
	}
});

router.get("/images/bestiary-tokens", async (req, res, next) => {
	try {
		res.json(
			await imageGalleryReadService.listBestiaryTokenAssets({
				subcategory: req.query.subcategory || "",
				search: req.query.search || "",
				recursive: req.query.recursive === "1",
				ignoreSourcesList: String(req.query.ignoreSources || "")
					.split(",")
					.map((source) => source.trim())
					.filter(Boolean),
			}),
		);
	} catch (error) {
		next(error);
	}
});

router.get("/images/search", async (req, res, next) => {
	try {
		res.json(
			await imageGalleryReadService.searchImageGalleryAssets({
				search: req.query.search || "",
				...parseImageGalleryQuery(req.query),
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
			const subs = await imageAssetRepository.listSubcategories(
				req.params.slug,
				req.params.category,
				req.query.subcategory || "",
				{ includeMeta: req.query.includeMeta === "1" },
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
			await imageAssetRepository.createSubcategory(
				req.params.slug,
				req.params.category,
				req.body.name,
			);
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
				await imageAssetRepository.renameImage(
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
			await imageAssetRepository.renameSubcategory(
				slug,
				category,
				oldName,
				newName,
			);
			res.json({ ok: true });
		} catch (error) {
			next(error);
		}
	},
);

router.post("/images/move", async (req, res, next) => {
	try {
		const results = await imageAssetRepository.moveImages(
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
		await imageAssetRepository.deleteImages(
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
