const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const {
	ensureDir,
	exists,
	readJson,
	renameWithRetry,
	writeJson,
} = require("../../infrastructure/jsonFileStore");
const {
	campaignDir,
	sanitizeName,
	sessionFileName,
	sessionPath,
	todayString,
} = require("../../infrastructure/storagePaths");

function createSessionRepository(overrides = {}) {
	const dependencies = {
		campaignDir,
		createId: () => crypto.randomUUID(),
		ensureDir,
		exists,
		now: () => new Date(),
		readDir: fs.readdir,
		readJson,
		removeFile: (filePath) => fs.rm(filePath, { force: true }),
		renameWithRetry,
		sanitizeName,
		sessionFileName,
		sessionPath,
		stat: fs.stat,
		todayString,
		writeJson,
		...overrides,
	};

	function makeDefaultSessionData(name) {
		return {
			id: dependencies.createId(),
			name: dependencies.sanitizeName(name) || dependencies.todayString(),
			order: 0,
			createdAt: dependencies.now().toISOString(),
			data: {},
		};
	}

	async function readSession(slug, fileName) {
		return dependencies.readJson(dependencies.sessionPath(slug, fileName));
	}

	async function sessionExists(slug, fileName) {
		return dependencies.exists(dependencies.sessionPath(slug, fileName));
	}

	async function listSessions(slug) {
		const sessionsDir = path.join(dependencies.campaignDir(slug), "sessions");
		await dependencies.ensureDir(sessionsDir);
		const entries = await dependencies.readDir(sessionsDir, {
			withFileTypes: true,
		});
		const files = [];
		for (const entry of entries) {
			if (!entry.name.endsWith(".json")) continue;
			if (entry.isFile()) {
				files.push(entry.name);
			} else if (entry.isSymbolicLink()) {
				const stats = await dependencies
					.stat(path.join(sessionsDir, entry.name))
					.catch(() => null);
				if (stats?.isFile()) files.push(entry.name);
			}
		}
		files.sort();

		const sessions = await Promise.all(
			files.map(async (fileName) => {
				const data = await readSession(slug, fileName);
				return {
					id: data.id,
					name: data.name,
					fileName,
					createdAt: data.createdAt,
					order: data.order || 0,
				};
			}),
		);
		return sessions.sort(
			(a, b) =>
				(a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name),
		);
	}

	async function ensureUniqueSessionFile(
		slug,
		desiredName,
		ignoreFileName = null,
	) {
		const parsed = path.parse(dependencies.sessionFileName(desiredName));
		let fileName = `${parsed.name}${parsed.ext || ".json"}`;
		let counter = 2;
		while (true) {
			const taken = await dependencies.exists(
				dependencies.sessionPath(slug, fileName),
			);
			if (!taken || fileName === ignoreFileName) return fileName;
			fileName = `${parsed.name}-${counter}.json`;
			counter += 1;
		}
	}

	async function createSession(slug, input = {}) {
		const sessions = await listSessions(slug);
		const maxOrder = sessions.reduce(
			(max, session) => Math.max(max, session.order || 0),
			-1,
		);
		const baseName =
			dependencies.sanitizeName(input.name) || dependencies.todayString();
		const session = makeDefaultSessionData(baseName);
		session.order = maxOrder + 1;
		if (input.data && typeof input.data === "object") {
			session.data = input.data;
		}
		const fileName = await ensureUniqueSessionFile(slug, session.name);
		await dependencies.writeJson(
			dependencies.sessionPath(slug, fileName),
			session,
		);
		return { ...session, fileName };
	}

	async function updateSession(slug, fileName, patch = {}) {
		const current = await readSession(slug, fileName);
		const nextName = patch.name
			? dependencies.sanitizeName(patch.name)
			: current.name;
		if (!nextName) return null;

		const nextFileName = await ensureUniqueSessionFile(
			slug,
			nextName,
			fileName,
		);
		const updated = {
			...current,
			...patch,
			name: nextName,
			id: current.id,
		};
		if (nextFileName !== fileName) {
			await dependencies.renameWithRetry(
				dependencies.sessionPath(slug, fileName),
				dependencies.sessionPath(slug, nextFileName),
			);
		}
		await dependencies.writeJson(
			dependencies.sessionPath(slug, nextFileName),
			updated,
		);
		return { ...updated, fileName: nextFileName };
	}

	async function deleteSession(slug, fileName) {
		await dependencies.removeFile(dependencies.sessionPath(slug, fileName));
	}

	async function reorderSessions(slug, orders = {}) {
		for (const [fileName, order] of Object.entries(orders)) {
			const session = await readSession(slug, fileName);
			session.order = order;
			await dependencies.writeJson(
				dependencies.sessionPath(slug, fileName),
				session,
			);
		}
	}

	return {
		createSession,
		deleteSession,
		ensureUniqueSessionFile,
		listSessions,
		makeDefaultSessionData,
		readSession,
		reorderSessions,
		sessionExists,
		updateSession,
	};
}

const sessionRepository = createSessionRepository();

module.exports = {
	...sessionRepository,
	createSessionRepository,
};
