const {
	createSessionRepositoryPort,
} = require("../application/ports/sessionRepository");
const fs = require("fs/promises");

function createFileSessionRepository(storage) {
	return createSessionRepositoryPort({
		exists: (campaignSlug, fileName) =>
			storage.exists(storage.sessionPath(campaignSlug, fileName)),
		list: (campaignSlug) => storage.listSessions(campaignSlug),
		read: (campaignSlug, fileName) => storage.readSession(campaignSlug, fileName),
		write: async (campaignSlug, fileName, session) => {
			await storage.writeJson(storage.sessionPath(campaignSlug, fileName), session);
			return { ...session, fileName };
		},
		remove: (campaignSlug, fileName) =>
			fs.rm(storage.sessionPath(campaignSlug, fileName), { force: true }),
		rename: (campaignSlug, oldFileName, newFileName) =>
			storage.renameWithRetry(
				storage.sessionPath(campaignSlug, oldFileName),
				storage.sessionPath(campaignSlug, newFileName),
			),
		createId: () => storage.createId(),
		sanitizeName: (name) => storage.sanitizeName(name),
		createDefault: (name) => storage.makeDefaultSessionData(name),
		ensureUniqueFile: (...args) => storage.ensureUniqueSessionFile(...args),
	});
}

module.exports = { createFileSessionRepository };
