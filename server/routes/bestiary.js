const express = require("express");
const router = express.Router();
const storage = require("../storage");
const {
	CUSTOM_SOURCE,
	buildReplacementCustomMonster,
	createBestiaryCommands,
	normalizeSource,
} = require("../modules/bestiary/application/bestiaryCommands");
const {
	createFileBestiaryRepository,
} = require("../modules/bestiary/infrastructure/fileBestiaryRepository");

const bestiaryCommands = createBestiaryCommands(
	createFileBestiaryRepository(storage),
);

function disableResponseCache(res) {
	res.set(
		"Cache-Control",
		"no-store, no-cache, must-revalidate, proxy-revalidate",
	);
	res.set("Pragma", "no-cache");
	res.set("Expires", "0");
	res.set("Surrogate-Control", "no-store");
}

router.get("/search", async (req, res, next) => {
	try {
		res.json(await bestiaryCommands.search(req.query));
	} catch (error) {
		next(error);
	}
});

router.get("/favorites", async (req, res, next) => {
	try {
		res.json(await bestiaryCommands.listFavorites());
	} catch (error) {
		next(error);
	}
});

router.post("/favorites/toggle", async (req, res, next) => {
	try {
		res.json(await bestiaryCommands.toggleFavorite(req.body || {}));
	} catch (error) {
		next(error);
	}
});

router.patch("/custom/:name", async (req, res, next) => {
	try {
		disableResponseCache(res);
		res.json(
			await bestiaryCommands.updateCustom({
				identifier: req.params.name,
				payload: req.body,
			}),
		);
	} catch (error) {
		next(error);
	}
});

router.put("/custom", async (req, res, next) => {
	try {
		disableResponseCache(res);
		res.json(
			await bestiaryCommands.replaceCustom({ monsters: req.body?.monsters }),
		);
	} catch (error) {
		next(error);
	}
});

router.delete("/custom/:name", async (req, res, next) => {
	try {
		disableResponseCache(res);
		res.json(
			await bestiaryCommands.deleteCustom({ identifier: req.params.name }),
		);
	} catch (error) {
		next(error);
	}
});

router.get("/sources", async (req, res, next) => {
	try {
		res.json(await bestiaryCommands.listSources());
	} catch (error) {
		next(error);
	}
});

router.get("/legendarygroups", async (req, res, next) => {
	try {
		res.json(await bestiaryCommands.listLegendaryGroups());
	} catch (error) {
		next(error);
	}
});

router.get("/:source", async (req, res, next) => {
	try {
		if (normalizeSource(req.params.source) === CUSTOM_SOURCE) {
			disableResponseCache(res);
		}
		res.json(await bestiaryCommands.getSource({ source: req.params.source }));
	} catch (error) {
		next(error);
	}
});

Object.defineProperty(router, "__test", {
	value: {
		buildReplacementCustomMonster,
	},
});

module.exports = router;
