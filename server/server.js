require("dotenv").config({
	path: require("path").join(__dirname, "..", ".env"),
});
const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const aiService = require("./aiService");

const app = express();
const PORT = process.env.PORT || 5000;

const ROOT_DIR = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const CAMPAIGNS_DIR = path.join(DATA_DIR, "campaigns");

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

function todayString() {
	return new Date().toISOString().slice(0, 10);
}

function createId() {
	return crypto.randomUUID();
}

function sanitizeName(name) {
	return String(name || "")
		.trim()
		.replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
		.replace(/\.+$/g, "")
		.replace(/\s+/g, " ")
		.slice(0, 120);
}

function campaignSlug(name) {
	return (
		sanitizeName(name)
			.toLowerCase()
			.normalize("NFKD")
			.replace(/[\u0300-\u036f]/g, "")
			.replace(/[^\p{L}\p{N}]+/gu, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 80) || `campaign-${Date.now()}`
	);
}

function sessionFileName(name) {
	const safe = sanitizeName(name);
	return `${safe || todayString()}.json`;
}

function campaignDir(slug) {
	return path.join(CAMPAIGNS_DIR, path.basename(slug));
}

function campaignMetaPath(slug) {
	return path.join(campaignDir(slug), "_campaign.json");
}

function sessionPath(slug, fileName) {
	return path.join(campaignDir(slug), "sessions", path.basename(fileName));
}

async function ensureDir(dirPath) {
	await fs.mkdir(dirPath, { recursive: true });
}

async function exists(filePath) {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
}

async function readJson(filePath) {
	const raw = await fs.readFile(filePath, "utf8");
	return JSON.parse(raw);
}

/**
 * Safe rename with retries for Windows/OneDrive environments
 */
async function renameWithRetry(oldPath, newPath, retries = 3, delay = 50) {
	for (let i = 0; i < retries; i++) {
		try {
			await fs.rename(oldPath, newPath);
			return;
		} catch (err) {
			const isLocked = ["EPERM", "EBUSY"].includes(err.code);
			if (isLocked && i < retries - 1) {
				await new Promise((resolve) => setTimeout(resolve, delay));
				continue;
			}
			throw err;
		}
	}
}

async function writeJson(filePath, value) {
	await ensureDir(path.dirname(filePath));
	const content = JSON.stringify(value, null, 2);
	await fs.writeFile(filePath, content, "utf8");
}

async function initStorage() {
	await ensureDir(CAMPAIGNS_DIR);
}

async function listCampaignSlugs() {
	const entries = await fs.readdir(CAMPAIGNS_DIR, { withFileTypes: true });
	return entries
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name);
}

async function readCampaign(slug) {
	return readJson(campaignMetaPath(slug));
}

async function readSession(slug, fileName) {
	return readJson(sessionPath(slug, fileName));
}

async function listSessions(slug) {
	const sessionsDir = path.join(campaignDir(slug), "sessions");
	await ensureDir(sessionsDir);

	const entries = await fs.readdir(sessionsDir, { withFileTypes: true });
	const files = entries
		.filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
		.map((entry) => entry.name)
		.sort();

	const sessionPromises = files.map(async (file) => {
		const data = await readSession(slug, file);
		return {
			id: data.id,
			name: data.name,
			fileName: file,
			createdAt: data.createdAt,
			updatedAt: data.updatedAt,
			completed: Boolean(data.completed),
			order: data.order || 0,
			completedAt: data.completedAt || null,
		};
	});

	const result = await Promise.all(sessionPromises);
	return result.sort(
		(a, b) =>
			(a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name, "uk"),
	);
}

async function listCampaignsDetailed() {
	const slugs = await listCampaignSlugs();

	const campaignPromises = slugs.map(async (slug) => {
		const meta = await readCampaign(slug);
		const sessions = await listSessions(slug);
		return {
			...meta,
			slug,
			sessionCount: sessions.length,
		};
	});

	const result = await Promise.all(campaignPromises);
	return result.sort(
		(a, b) =>
			(a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name, "uk"),
	);
}

async function exportCampaignBundle(slug) {
	const meta = await readCampaign(slug);
	const sessionFiles = await listSessions(slug);
	const sessions = await Promise.all(
		sessionFiles.map(async (s) => {
			const content = await readSession(slug, s.fileName);
			return { fileName: s.fileName, content };
		}),
	);
	return { meta, sessions };
}

async function importCampaignBundle(bundle) {
	const { meta, sessions } = bundle;
	if (!meta || !meta.name) throw new Error("Невірний формат бандла");

	const slug = await ensureUniqueCampaignSlug(campaignSlug(meta.name));
	const now = new Date().toISOString();

	const newMeta = {
		...meta,
		slug,
		createdAt: meta.createdAt || now,
		updatedAt: now,
	};

	await ensureDir(path.join(campaignDir(slug), "sessions"));
	await writeJson(campaignMetaPath(slug), newMeta);

	for (const session of sessions) {
		const fileName = await ensureUniqueSessionFile(slug, session.content.name);
		await writeJson(sessionPath(slug, fileName), {
			...session.content,
			updatedAt: now,
		});
	}
	return newMeta;
}

app.get("/api/export-all", async (req, res, next) => {
	try {
		const slugs = await listCampaignSlugs();
		const data = await Promise.all(
			slugs.map((slug) => exportCampaignBundle(slug)),
		);
		res.json(data);
	} catch (error) {
		next(error);
	}
});

app.post("/api/import-all", async (req, res, next) => {
	try {
		const bundles = Array.isArray(req.body) ? req.body : [req.body];
		for (const bundle of bundles) {
			await importCampaignBundle(bundle);
		}
		res.status(201).json({ ok: true });
	} catch (error) {
		next(error);
	}
});

app.post("/api/campaigns/reorder", async (req, res, next) => {
	try {
		const { orders } = req.body; // { slug: order, ... }
		for (const slug of Object.keys(orders)) {
			if (await exists(campaignMetaPath(slug))) {
				const meta = await readCampaign(slug);
				meta.order = orders[slug];
				await writeJson(campaignMetaPath(slug), meta);
			}
		}
		res.json({ ok: true });
	} catch (error) {
		next(error);
	}
});

app.post("/api/campaigns/:slug/sessions/reorder", async (req, res, next) => {
	try {
		const { slug } = req.params;
		const { orders } = req.body; // { fileName: order, ... }
		for (const fileName of Object.keys(orders)) {
			const session = await readJson(sessionPath(slug, fileName));
			session.order = orders[fileName];
			await writeJson(sessionPath(slug, fileName), session);
		}
		res.json({ ok: true });
	} catch (error) {
		next(error);
	}
});

async function ensureUniqueCampaignSlug(baseSlug, ignoreSlug = null) {
	let slug = baseSlug;
	let counter = 2;
	while (true) {
		const dir = campaignDir(slug);
		const taken = await exists(dir);
		if (!taken || slug === ignoreSlug) return slug;
		slug = `${baseSlug}-${counter}`;
		counter += 1;
	}
}

async function ensureUniqueSessionFile(
	slug,
	desiredName,
	ignoreFileName = null,
) {
	const parsed = path.parse(sessionFileName(desiredName));
	let fileName = `${parsed.name}${parsed.ext || ".json"}`;
	let counter = 2;

	while (true) {
		const fullPath = sessionPath(slug, fileName);
		const taken = await exists(fullPath);
		if (!taken || fileName === ignoreFileName) {
			return fileName;
		}
		fileName = `${parsed.name}-${counter}.json`;
		counter += 1;
	}
}

function makeDefaultSessionData(name) {
	return {
		id: createId(),
		name: sanitizeName(name) || todayString(),
		completed: false,
		order: 0,
		completedAt: null,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		data: {},
	};
}

app.get("/api/health", async (_req, res) => {
	res.json({ ok: true });
});

app.get("/api/campaigns", async (_req, res, next) => {
	try {
		const campaigns = await listCampaignsDetailed();
		res.json(campaigns);
	} catch (error) {
		next(error);
	}
});

app.post("/api/campaigns", async (req, res, next) => {
	try {
		const name = sanitizeName(req.body?.name);
		if (!name) {
			return res.status(400).json({ error: "Назва кампанії обов’язкова." });
		}

		const slug = await ensureUniqueCampaignSlug(campaignSlug(name));
		const now = new Date().toISOString();
		const meta = {
			id: createId(),
			slug,
			name,
			completed: false,
			completedAt: null,
			order: 0,
			createdAt: now,
			updatedAt: now,
		};

		await ensureDir(path.join(campaignDir(slug), "sessions"));
		await writeJson(campaignMetaPath(slug), meta);

		res.status(201).json(meta);
	} catch (error) {
		next(error);
	}
});

app.patch("/api/campaigns/:slug", async (req, res, next) => {
	try {
		const oldSlug = req.params.slug;
		const metaPath = campaignMetaPath(oldSlug);
		if (!(await exists(metaPath))) {
			return res.status(404).json({ error: "Кампанію не знайдено." });
		}

		const current = await readCampaign(oldSlug);
		const nextName = req.body?.name
			? sanitizeName(req.body.name)
			: current.name;
		const completed =
			typeof req.body?.completed === "boolean"
				? req.body.completed
				: current.completed;
		const completedAt =
			req.body?.completedAt !== undefined
				? req.body.completedAt
				: current.completedAt;

		if (!nextName) {
			return res
				.status(400)
				.json({ error: "Назва кампанії не може бути порожньою." });
		}

		// Робимо логіку ідентичною до сесій
		const nextSlug = await ensureUniqueCampaignSlug(
			campaignSlug(nextName),
			oldSlug,
		);

		if (nextSlug !== oldSlug) {
			await renameWithRetry(campaignDir(oldSlug), campaignDir(nextSlug));
		}

		const updated = {
			...current,
			...req.body,
			slug: nextSlug,
			name: nextName,
			completed,
			completedAt,
			updatedAt: new Date().toISOString(),
		};

		await writeJson(campaignMetaPath(nextSlug), updated);
		res.json(updated);
	} catch (error) {
		next(error);
	}
});

app.get("/api/campaigns/:slug/export", async (req, res, next) => {
	try {
		const slug = req.params.slug;
		const bundle = await exportCampaignBundle(slug);
		res.json(bundle);
	} catch (error) {
		next(error);
	}
});

app.delete("/api/campaigns/:slug", async (req, res, next) => {
	try {
		const slug = req.params.slug;
		const dir = campaignDir(slug);
		if (!(await exists(dir))) {
			return res.status(404).json({ error: "Кампанію не знайдено." });
		}

		await fs.rm(dir, { recursive: true, force: true });
		res.status(204).send();
	} catch (error) {
		next(error);
	}
});

app.get("/api/campaigns/:slug/sessions", async (req, res, next) => {
	try {
		const slug = req.params.slug;
		if (!(await exists(campaignMetaPath(slug)))) {
			return res.status(404).json({ error: "Кампанію не знайдено." });
		}

		const sessions = await listSessions(slug);
		res.json(sessions);
	} catch (error) {
		next(error);
	}
});

app.post("/api/campaigns/:slug/sessions", async (req, res, next) => {
	try {
		const slug = req.params.slug;
		if (!(await exists(campaignMetaPath(slug)))) {
			return res.status(404).json({ error: "Кампанію не знайдено." });
		}

		const existingSessions = await listSessions(slug);
		const maxOrder = existingSessions.reduce(
			(max, s) => Math.max(max, s.order || 0),
			-1,
		);

		const baseName = sanitizeName(req.body?.name) || todayString();
		const session = makeDefaultSessionData(baseName);
		session.order = maxOrder + 1;
		const fileName = await ensureUniqueSessionFile(slug, session.name);

		if (req.body?.data && typeof req.body.data === "object") {
			session.data = req.body.data;
		}

		await writeJson(sessionPath(slug, fileName), session);

		res.status(201).json({
			id: session.id,
			name: session.name,
			fileName,
			createdAt: session.createdAt,
			updatedAt: session.updatedAt,
			completed: session.completed,
			order: session.order,
			completedAt: session.completedAt || null,
		});
	} catch (error) {
		next(error);
	}
});

app.get("/api/campaigns/:slug/sessions/:fileName", async (req, res, next) => {
	try {
		const { slug, fileName } = req.params;
		const fullPath = sessionPath(slug, fileName);
		if (!(await exists(fullPath))) {
			return res.status(404).json({ error: "Сесію не знайдено." });
		}

		const session = await readJson(fullPath);
		res.json({ ...session, fileName });
	} catch (error) {
		next(error);
	}
});

app.patch("/api/campaigns/:slug/sessions/:fileName", async (req, res, next) => {
	try {
		const { slug, fileName } = req.params;
		const fullPath = sessionPath(slug, fileName);
		if (!(await exists(fullPath))) {
			return res.status(404).json({ error: "Сесію не знайдено." });
		}

		const current = await readJson(fullPath);
		const nextName = req.body?.name
			? sanitizeName(req.body.name)
			: current.name;
		const nextCompleted =
			typeof req.body?.completed === "boolean"
				? req.body.completed
				: current.completed;
		const nextCompletedAt =
			req.body?.completedAt !== undefined
				? req.body.completedAt
				: current.completedAt;
		const nextData =
			req.body?.data && typeof req.body.data === "object"
				? req.body.data
				: current.data;

		if (!nextName) {
			return res
				.status(400)
				.json({ error: "Назва сесії не може бути порожньою." });
		}

		const nextFileName = await ensureUniqueSessionFile(
			slug,
			nextName,
			fileName,
		);
		const updated = {
			...current,
			name: nextName,
			completed: nextCompleted,
			completedAt: nextCompletedAt,
			updatedAt: new Date().toISOString(),
			data: nextData,
		};

		if (nextFileName !== fileName) {
			await renameWithRetry(fullPath, sessionPath(slug, nextFileName));
		}

		await writeJson(sessionPath(slug, nextFileName), updated);

		res.json({
			...updated,
			fileName: nextFileName,
		});
	} catch (error) {
		next(error);
	}
});

app.delete(
	"/api/campaigns/:slug/sessions/:fileName",
	async (req, res, next) => {
		try {
			const { slug, fileName } = req.params;
			const fullPath = sessionPath(slug, fileName);
			if (!(await exists(fullPath))) {
				return res.status(404).json({ error: "Сесію не знайдено." });
			}

			await fs.rm(fullPath, { force: true });
			res.status(204).send();
		} catch (error) {
			next(error);
		}
	},
);

app.post("/api/ai/generate", async (req, res, next) => {
	try {
		const {
			type,
			userInstructions,
			path,
			sceneId,
			parseAIResponse,
			useSessionsResults,
		} = req.body;
		const campaign = await readCampaign(path.campaign);
		const session = await readSession(path.campaign, path.session).catch(
			() => null,
		);

		if (!process.env.GEMINI_API_KEY) {
			return res
				.status(500)
				.json({ error: "GEMINI_API_KEY не налаштовано на сервері." });
		}

		let results;

		if (useSessionsResults) {
			const sessionFiles = await listSessions(path.campaign);
			const sessions = await Promise.all(
				sessionFiles.map(async (s) => {
					const content = await readSession(path.campaign, s.fileName);
					return content;
				}),
			);

			results = sessions
				.sort((a, b) => a.order - b.order)
				.map((session) => ({
					result: session.data.result_text,
					session: session.name,
				}));
		}

		const generatedContent = await aiService.generateContent({
			type,
			session,
			campaign,
			userInstructions,
			sceneId,
			parseAIResponse,
			results,
		});

		if (generatedContent.error) {
			return res.status(500).json({
				error: generatedContent.error,
				raw_response: generatedContent.raw_response,
			});
		}

		if (!parseAIResponse) {
			return res.json({
				prompt: generatedContent,
			});
		}

		let updatedObject = null;

		// Автоматичний запис в БД
		if (campaign) {
			if (session) {
				// Оновлення СЕСІЇ
				const fullPath = sessionPath(path.campaign, path.session);

				if (await exists(fullPath)) {
					const session = await readJson(fullPath);
					const data = session.data || {};

					// Логіка інтеграції залежно від типу
					if (generatedContent.scenes) {
						const newScenes = generatedContent.scenes.map((s, idx) => {
							const existingScene = session.data?.scenes?.[idx] || {};

							return {
								id:
									existingScene?.id ||
									Date.now() + +(Math.random() * 100000).toFixed(),
								texts: s.texts,
								npcs: s.npcs,
								collapsed: existingScene?.collapsed || false,
								encounterId: existingScene?.encounterId || "",
							};
						});

						data.scenes = newScenes;
					}

					session.data = data;
					session.updatedAt = new Date().toISOString();

					await writeJson(fullPath, session);
					updatedObject = { ...session, fileName: path.session };
				}
			} else {
				const metaPath = campaignMetaPath(path.campaign);

				if (await exists(metaPath)) {
					const meta = await readJson(metaPath);

					// Оновлюємо лише опис та замітки, ігноруючи сторонні поля (наприклад, scenes)
					if (generatedContent.description) {
						meta.description = generatedContent.description;
					}

					if (Array.isArray(generatedContent.notes)) {
						// Перетворюємо масив рядків від ШІ у внутрішній формат заміток
						meta.notes = generatedContent.notes.map((text) => ({
							id: Date.now() + +(Math.random() * 100000).toFixed(),
							text: text,
							collapsed: false,
						}));
					}

					if (Array.isArray(generatedContent.characters)) {
						// Перетворюємо масив рядків від ШІ у внутрішній формат персонажів
						meta.characters = generatedContent.characters.map((character) => ({
							id: Date.now() + +(Math.random() * 100000).toFixed(),
							name: character.name,
							description: character.description,
							collapsed: false,
						}));
					}

					meta.updatedAt = new Date().toISOString();
					await writeJson(metaPath, meta);
					updatedObject = meta;
				}
			}
		}

		res.json({
			generated: generatedContent,
			updated: updatedObject,
		});
	} catch (error) {
		next(error);
	}
});

app.use((err, _req, res, _next) => {
	console.error(`[Error] ${err.stack || err.message}`);

	let status = err.status || 500;
	let message = err.message || "Внутрішня помилка сервера.";

	// Мапінг системних помилок Node.js
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
initStorage()
	.then(() => {
		app.listen(PORT, () => {
			console.log(`Server running on http://localhost:${PORT}`);
			console.log(`Campaign data directory: ${CAMPAIGNS_DIR}`);
		});
	})
	.catch((error) => {
		console.error("Failed to initialize storage:", error);
		process.exit(1);
	});
