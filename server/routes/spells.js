const express = require("express");
const router = express.Router();
const path = require("path");
const storage = require("../storage");
const { sortByNameQuery } = require("./searchUtils");

function getSourcePriority(source) {
	const normalized = String(source || "").toUpperCase();
	if (normalized === "XPHB" || normalized === "XDMG") return 3;
	if (normalized === "PHB" || normalized === "DMG") return 2;
	return 1;
}

function pickPreferredRecord(current, candidate) {
	if (!current) return candidate;
	const currentPriority = getSourcePriority(current.source);
	const candidatePriority = getSourcePriority(candidate.source);
	if (candidatePriority !== currentPriority) {
		return candidatePriority > currentPriority ? candidate : current;
	}
	return current;
}

function getSpellRecords(data) {
	return Array.isArray(data)
		? data
		: data.spell || data.spells || data.results || [];
}

function matchesSpellSearch(spell, { nameQuery, level, schoolQuery }) {
	return (
		(nameQuery ? spell.name?.toLowerCase().includes(nameQuery) : true) &&
		(level !== undefined ? String(spell.level) === String(level) : true) &&
		(schoolQuery ? spell.school?.toLowerCase() === schoolQuery : true)
	);
}

function databasePath(fileName) {
	return path.join(__dirname, "..", "..", "database", fileName);
}

function normalizeNamedReferenceRecords(items, kind, extraFields) {
	const byName = new Map();

	for (const item of Array.isArray(items) ? items : []) {
		const name = String(item?.name || "").trim();
		if (!name) continue;
		const key = name.toLowerCase();
		const normalized = {
			name,
			kind: item?.kind || kind,
			source: item?.source || null,
			page: item?.page || null,
			...(extraFields ? extraFields(item) : {}),
			entries: item?.entries || [],
		};
		byName.set(key, pickPreferredRecord(byName.get(key), normalized));
	}

	return Array.from(byName.values()).sort((a, b) =>
		a.name.localeCompare(b.name),
	);
}

async function readNamedReferenceRecords(fileName, listKey, kind, extraFields) {
	const filePath = databasePath(fileName);
	if (!(await storage.exists(filePath))) return [];

	const data = await storage.readJson(filePath);
	return normalizeNamedReferenceRecords(
		Array.isArray(data?.[listKey]) ? data[listKey] : [],
		kind,
		extraFields,
	);
}

router.get("/search", async (req, res, next) => {
	try {
		const { name, level, school } = req.query;
		const nameQuery = name?.toLowerCase() || "";
		const schoolQuery = school?.toLowerCase() || "";
		if (!(await storage.exists(storage.SPELLS_DIR))) return res.json([]);

		let results = [];
		const allPath = path.join(storage.SPELLS_DIR, "all.json");

		if (await storage.exists(allPath)) {
			const data = await storage.readJson(allPath);
			const spells = getSpellRecords(data);
			results.push(
				...spells.filter((spell) =>
					matchesSpellSearch(spell, { nameQuery, level, schoolQuery }),
				),
			);
		} else {
			const indexPath = path.join(storage.SPELLS_DIR, "index.json");
			if (!(await storage.exists(indexPath))) return res.json([]);

			const index = await storage.readJson(indexPath);
			for (const [sourceKey, fileName] of Object.entries(index)) {
				const data = await storage.readJson(
					path.join(storage.SPELLS_DIR, fileName),
				);
				const spells = getSpellRecords(data);
				results.push(
					...spells
						.filter((spell) =>
							matchesSpellSearch(spell, {
								nameQuery,
								level,
								schoolQuery,
							}),
						)
						.map((s) => ({ ...s, source: sourceKey })),
				);
			}
		}

		sortByNameQuery(results, nameQuery);

		res.json(results);
	} catch (error) {
		next(error);
	}
});

router.get("/sources", async (req, res, next) => {
	try {
		const allPath = path.join(storage.SPELLS_DIR, "all.json");
		if (await storage.exists(allPath)) {
			const data = await storage.readJson(allPath);
			const spells = getSpellRecords(data);
			const sources = [
				...new Set(spells.map((spell) => spell.source).filter(Boolean)),
			].sort((a, b) => a.localeCompare(b));
			return res.json(sources);
		}

		const indexPath = path.join(storage.SPELLS_DIR, "index.json");
		if (!(await storage.exists(indexPath))) return res.json([]);
		const index = await storage.readJson(indexPath);
		res.json(Object.keys(index));
	} catch (error) {
		next(error);
	}
});

router.get("/conditions", async (_req, res, next) => {
	try {
		const conditionsPath = path.join(
			__dirname,
			"..",
			"..",
			"database",
			"conditions.json",
		);
		if (!(await storage.exists(conditionsPath))) return res.json([]);

		const data = await storage.readJson(conditionsPath);
		const conditionList = Array.isArray(data?.condition) ? data.condition : [];
		const statusList = Array.isArray(data?.status) ? data.status : [];
		const list = normalizeNamedReferenceRecords(
			[
				...conditionList.map((item) => ({ ...item, kind: "condition" })),
				...statusList.map((item) => ({ ...item, kind: "status" })),
			],
			"condition",
		);
		res.json(list);
	} catch (error) {
		next(error);
	}
});

router.get("/diseases", async (_req, res, next) => {
	try {
		const diseasesPath = path.join(
			__dirname,
			"..",
			"..",
			"database",
			"diseases.json",
		);
		const conditionsPath = path.join(
			__dirname,
			"..",
			"..",
			"database",
			"conditions.json",
		);
		if (
			!(await storage.exists(diseasesPath)) &&
			!(await storage.exists(conditionsPath))
		)
			return res.json([]);

		const data = (await storage.exists(diseasesPath))
			? await storage.readJson(diseasesPath)
			: await storage.readJson(conditionsPath);
		const diseaseList = Array.isArray(data?.disease) ? data.disease : [];
		const list = normalizeNamedReferenceRecords(
			diseaseList,
			"disease",
			(item) => ({ type: item?.type || null }),
		);
		res.json(list);
	} catch (error) {
		next(error);
	}
});

router.get("/variantrules", async (_req, res, next) => {
	try {
		const rules = await readNamedReferenceRecords(
			"variantrules.json",
			"variantrule",
			"variantrule",
			(item) => ({ ruleType: item?.ruleType || null }),
		);
		res.json(rules);
	} catch (error) {
		next(error);
	}
});

router.get("/skills", async (_req, res, next) => {
	try {
		const skills = await readNamedReferenceRecords(
			"skills.json",
			"skill",
			"skill",
			(item) => ({ ability: item?.ability || null }),
		);
		res.json(skills);
	} catch (error) {
		next(error);
	}
});

router.get("/senses", async (_req, res, next) => {
	try {
		const senses = await readNamedReferenceRecords(
			"senses.json",
			"sense",
			"sense",
		);
		res.json(senses);
	} catch (error) {
		next(error);
	}
});

router.get("/:source", async (req, res, next) => {
	try {
		const sourceParam = String(req.params.source);
		const allPath = path.join(storage.SPELLS_DIR, "all.json");
		if (await storage.exists(allPath)) {
			const data = await storage.readJson(allPath);
			const list = getSpellRecords(data);
			if (sourceParam.toLowerCase() === "all") return res.json(list);

			const source = sourceParam.toUpperCase();
			return res.json(
				list.filter((spell) => spell.source?.toUpperCase() === source),
			);
		}

		const indexPath = path.join(storage.SPELLS_DIR, "index.json");
		const index = await storage.readJson(indexPath);
		const fileName = index[req.params.source];
		if (!fileName) return res.status(404).json({ error: "Source not found." });
		const data = await storage.readJson(
			path.join(storage.SPELLS_DIR, fileName),
		);
		const list = getSpellRecords(data);
		res.json(list.map((s) => ({ ...s, source: req.params.source })));
	} catch (error) {
		next(error);
	}
});

module.exports = router;
