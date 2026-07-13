const {
	createSettingsRepositoryPort,
} = require("../application/ports/settingsRepository");

function createFileSettingsRepository(storage) {
	return createSettingsRepositoryPort({
		read: () => storage.readSettings(),
		update: (patch) => storage.updateSettings(patch),
	});
}

module.exports = { createFileSettingsRepository };
