const express = require("express");
const router = express.Router();
const path = require("path");
const storage = require("../storage");

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
			const spells = Array.isArray(data)
				? data
				: data.spell || data.spells || data.results || [];
			results.push(
				...spells.filter(
					(s) =>
						(nameQuery ? s.name?.toLowerCase().includes(nameQuery) : true) &&
						(level !== undefined ? String(s.level) === String(level) : true) &&
						(schoolQuery ? s.school?.toLowerCase() === schoolQuery : true),
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
				const spells = Array.isArray(data)
					? data
					: data.spell || data.spells || data.results || [];
				results.push(
					...spells
						.filter(
							(s) =>
								(nameQuery
									? s.name?.toLowerCase().includes(nameQuery)
									: true) &&
								(level !== undefined
									? String(s.level) === String(level)
									: true) &&
								(schoolQuery
									? s.school?.toLowerCase() === schoolQuery
									: true),
						)
						.map((s) => ({ ...s, source: sourceKey })),
				);
			}
		}

		if (nameQuery) {
			results.sort((a, b) => {
				const nA = a.name?.toLowerCase() || "";
				const nB = b.name?.toLowerCase() || "";

				if (nA === nameQuery && nB !== nameQuery) return -1;
				if (nB === nameQuery && nA !== nameQuery) return 1;

				const startsA = nA.startsWith(nameQuery);
				const startsB = nB.startsWith(nameQuery);
				if (startsA && !startsB) return -1;
				if (startsB && !startsA) return 1;

				if (nA.length !== nB.length) return nA.length - nB.length;
				return nA.localeCompare(nB);
			});
		}

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
			const spells = Array.isArray(data)
				? data
				: data.spell || data.spells || data.results || [];
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
		const merged = [
			...conditionList.map((item) => ({ ...item, kind: "condition" })),
			...statusList.map((item) => ({ ...item, kind: "status" })),
		];
		const byName = new Map();

		for (const item of merged) {
			const name = String(item?.name || "").trim();
			if (!name) continue;
			const key = name.toLowerCase();
			const normalized = {
				name,
				kind: item?.kind || "condition",
				source: item?.source || null,
				page: item?.page || null,
				entries: item?.entries || [],
			};
			byName.set(key, pickPreferredRecord(byName.get(key), normalized));
		}

		const list = Array.from(byName.values()).sort((a, b) =>
			a.name.localeCompare(b.name),
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
		const byName = new Map();

		for (const item of diseaseList) {
			const name = String(item?.name || "").trim();
			if (!name) continue;
			const key = name.toLowerCase();
			const normalized = {
				name,
				kind: "disease",
				source: item?.source || null,
				page: item?.page || null,
				type: item?.type || null,
				entries: item?.entries || [],
			};
			byName.set(key, pickPreferredRecord(byName.get(key), normalized));
		}

		const list = Array.from(byName.values()).sort((a, b) =>
			a.name.localeCompare(b.name),
		);
		res.json(list);
	} catch (error) {
		next(error);
	}
});

router.get("/variantrules", async (_req, res, next) => {
	try {
		const variantRulesPath = path.join(
			__dirname,
			"..",
			"..",
			"database",
			"variantrules.json",
		);
		if (!(await storage.exists(variantRulesPath))) return res.json([]);

		const data = await storage.readJson(variantRulesPath);
		const list = Array.isArray(data?.variantrule) ? data.variantrule : [];
		const byName = new Map();

		for (const item of list) {
			const name = String(item?.name || "").trim();
			if (!name) continue;
			const key = name.toLowerCase();
			const normalized = {
				name,
				kind: "variantrule",
				source: item?.source || null,
				page: item?.page || null,
				ruleType: item?.ruleType || null,
				entries: item?.entries || [],
			};
			byName.set(key, pickPreferredRecord(byName.get(key), normalized));
		}

		const rules = Array.from(byName.values()).sort((a, b) =>
			a.name.localeCompare(b.name),
		);
		res.json(rules);
	} catch (error) {
		next(error);
	}
});

router.get("/skills", async (_req, res, next) => {
	try {
		const skillsPath = path.join(
			__dirname,
			"..",
			"..",
			"database",
			"skills.json",
		);
		if (!(await storage.exists(skillsPath))) return res.json([]);

		const data = await storage.readJson(skillsPath);
		const list = Array.isArray(data?.skill) ? data.skill : [];
		const byName = new Map();

		for (const item of list) {
			const name = String(item?.name || "").trim();
			if (!name) continue;
			const key = name.toLowerCase();
			const normalized = {
				name,
				kind: "skill",
				source: item?.source || null,
				page: item?.page || null,
				ability: item?.ability || null,
				entries: item?.entries || [],
			};
			byName.set(key, pickPreferredRecord(byName.get(key), normalized));
		}

		const skills = Array.from(byName.values()).sort((a, b) =>
			a.name.localeCompare(b.name),
		);
		res.json(skills);
	} catch (error) {
		next(error);
	}
});

router.get("/senses", async (_req, res, next) => {
	try {
		const sensesPath = path.join(
			__dirname,
			"..",
			"..",
			"database",
			"senses.json",
		);
		if (!(await storage.exists(sensesPath))) return res.json([]);

		const data = await storage.readJson(sensesPath);
		const list = Array.isArray(data?.sense) ? data.sense : [];
		const byName = new Map();

		for (const item of list) {
			const name = String(item?.name || "").trim();
			if (!name) continue;
			const key = name.toLowerCase();
			const normalized = {
				name,
				kind: "sense",
				source: item?.source || null,
				page: item?.page || null,
				entries: item?.entries || [],
			};
			byName.set(key, pickPreferredRecord(byName.get(key), normalized));
		}

		const senses = Array.from(byName.values()).sort((a, b) =>
			a.name.localeCompare(b.name),
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
			const list = Array.isArray(data)
				? data
				: data.spell || data.spells || data.results || [];
			if (sourceParam.toLowerCase() === "all") return res.json(list);

			const source = sourceParam.toUpperCase();
			return res.json(
				list.filter((spell) => spell.source?.toUpperCase() === source),
			);
		}

		const indexPath = path.join(storage.SPELLS_DIR, "index.json");
		const index = await storage.readJson(indexPath);
		const fileName = index[req.params.source];
		if (!fileName)
			return res.status(404).json({ error: "Джерело не знайдено." });
		const data = await storage.readJson(
			path.join(storage.SPELLS_DIR, fileName),
		);
		const list = Array.isArray(data)
			? data
			: data.spell || data.spells || data.results || [];
		res.json(list.map((s) => ({ ...s, source: req.params.source })));
	} catch (error) {
		next(error);
	}
});

module.exports = router;
