const express = require("express");
const storage = require("../storage");
const {
	createReferenceCommands,
} = require("../modules/reference/application/referenceCommands");
const {
	createFileReferenceRepository,
} = require("../modules/reference/infrastructure/fileReferenceRepository");

const router = express.Router();
const referenceCommands = createReferenceCommands(
	createFileReferenceRepository(storage),
);

router.get("/search", async (req, res, next) => {
	try {
		res.json(await referenceCommands.searchSpells(req.query));
	} catch (error) {
		next(error);
	}
});

router.get("/sources", async (_req, res, next) => {
	try {
		res.json(await referenceCommands.listSpellSources());
	} catch (error) {
		next(error);
	}
});

router.get("/conditions", async (_req, res, next) => {
	try {
		res.json(await referenceCommands.listConditions());
	} catch (error) {
		next(error);
	}
});

router.get("/diseases", async (_req, res, next) => {
	try {
		res.json(await referenceCommands.listDiseases());
	} catch (error) {
		next(error);
	}
});

router.get("/variantrules", async (_req, res, next) => {
	try {
		res.json(await referenceCommands.listVariantRules());
	} catch (error) {
		next(error);
	}
});

router.get("/skills", async (_req, res, next) => {
	try {
		res.json(await referenceCommands.listSkills());
	} catch (error) {
		next(error);
	}
});

router.get("/senses", async (_req, res, next) => {
	try {
		res.json(await referenceCommands.listSenses());
	} catch (error) {
		next(error);
	}
});

router.get("/:source", async (req, res, next) => {
	try {
		res.json(
			await referenceCommands.getSpellSource({ source: req.params.source }),
		);
	} catch (error) {
		next(error);
	}
});

module.exports = router;
