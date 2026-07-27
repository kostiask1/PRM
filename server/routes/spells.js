const express = require("express");
const router = express.Router();
const referenceDataRepository = require("../domains/reference/referenceDataRepository");
const { sortByNameQuery } = require("./searchUtils");

router.get("/search", async (req, res, next) => {
	try {
		const { name, level, school } = req.query;
		const nameQuery = name?.toLowerCase() || "";
		const results = await referenceDataRepository.searchSpells({
			name,
			level,
			school,
		});
		sortByNameQuery(results, nameQuery);
		res.json(results);
	} catch (error) {
		next(error);
	}
});

router.get("/sources", async (req, res, next) => {
	try {
		res.json(await referenceDataRepository.listSpellSources());
	} catch (error) {
		next(error);
	}
});

router.get("/conditions", async (_req, res, next) => {
	try {
		res.json(await referenceDataRepository.listConditions());
	} catch (error) {
		next(error);
	}
});

router.get("/diseases", async (_req, res, next) => {
	try {
		res.json(await referenceDataRepository.listDiseases());
	} catch (error) {
		next(error);
	}
});

router.get("/variantrules", async (_req, res, next) => {
	try {
		res.json(await referenceDataRepository.listVariantRules());
	} catch (error) {
		next(error);
	}
});

router.get("/skills", async (_req, res, next) => {
	try {
		res.json(await referenceDataRepository.listSkills());
	} catch (error) {
		next(error);
	}
});

router.get("/senses", async (_req, res, next) => {
	try {
		res.json(await referenceDataRepository.listSenses());
	} catch (error) {
		next(error);
	}
});

router.get("/:source", async (req, res, next) => {
	try {
		const spells = await referenceDataRepository.getSpellsBySource(
			req.params.source,
		);
		if (!spells) return res.status(404).json({ error: "Source not found." });
		res.json(spells);
	} catch (error) {
		next(error);
	}
});

module.exports = router;
