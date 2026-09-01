function createSettingsCommands(repository) {
	return {
		get() {
			return repository.read();
		},
		update({ patch = {} }) {
			const safePatch =
				patch && typeof patch === "object" && !Array.isArray(patch) ? patch : {};
			return repository.update(safePatch);
		},
	};
}

module.exports = { createSettingsCommands };
