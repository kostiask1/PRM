const express = require("express");
const multer = require("multer");
const storage = require("../storage");
const {
	createImageCommands,
} = require("../modules/images/application/imageCommands");
const {
	createFileImageRepository,
} = require("../modules/images/infrastructure/fileImageRepository");

const router = express.Router();
const imageRepository = createFileImageRepository(storage);
const imageCommands = createImageCommands(imageRepository);

const upload = multer({
	storage: multer.diskStorage({
		destination: async (req, _file, cb) => {
			try {
				cb(
					null,
					await imageRepository.ensureUploadDirectory({
						slug: req.params.slug,
						category: req.params.category,
						subcategory: req.body.subcategory || "",
					}),
				);
			} catch (error) {
				cb(error);
			}
		},
		filename: (req, file, cb) => {
			imageRepository
				.resolveUploadFileName(
					{
						slug: req.params.slug,
						category: req.params.category,
						subcategory: req.body.subcategory || "",
					},
					file.originalname,
				)
				.then((name) => cb(null, name))
				.catch((err) => cb(err));
		},
	}),
});

router.get("/campaigns/:slug/images/:category", async (req, res, next) => {
	try {
		res.json(
			await imageCommands.list({
				slug: req.params.slug,
				category: req.params.category,
				subcategory: req.query.subcategory,
			}),
		);
	} catch (error) {
		next(error);
	}
});

router.get("/images/stats", async (req, res, next) => {
	try {
		res.json(await imageCommands.stats({ query: req.query }));
	} catch (error) {
		next(error);
	}
});

router.get("/images/bestiary-tokens", async (req, res, next) => {
	try {
		res.json(await imageCommands.listBestiaryTokens({ query: req.query }));
	} catch (error) {
		next(error);
	}
});

router.get("/images/search", async (req, res, next) => {
	try {
		res.json(await imageCommands.search({ query: req.query }));
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
			res.json(
				await imageCommands.listSubcategories({
					slug: req.params.slug,
					category: req.params.category,
					query: req.query,
				}),
			);
		} catch (error) {
			next(error);
		}
	},
);

router.post(
	"/campaigns/:slug/images/:category/subcategories",
	async (req, res, next) => {
		try {
			res.status(201).json(
				await imageCommands.createSubcategory({
					slug: req.params.slug,
					category: req.params.category,
					name: req.body.name,
				}),
			);
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
			res.json(
				await imageCommands.renameImage({
					slug,
					category,
					payload: req.body,
				}),
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
			res.json(
				await imageCommands.renameSubcategory({
					slug,
					category,
					oldName,
					newName,
				}),
			);
		} catch (error) {
			next(error);
		}
	},
);

router.post("/images/move", async (req, res, next) => {
	try {
		res.json(await imageCommands.move(req.body));
	} catch (error) {
		next(error);
	}
});

router.post("/images/delete", async (req, res, next) => {
	try {
		res.json(await imageCommands.delete(req.body));
	} catch (error) {
		next(error);
	}
});

module.exports = router;
