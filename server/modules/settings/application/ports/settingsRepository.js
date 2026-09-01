const REQUIRED_METHODS = Object.freeze(["read", "update"]);

function createSettingsRepositoryPort(implementation = {}) {
	for (const method of REQUIRED_METHODS) {
		if (typeof implementation[method] !== "function") {
			throw new TypeError(`Settings repository requires ${method}().`);
		}
	}
	return Object.freeze(
		Object.fromEntries(
			REQUIRED_METHODS.map((method) => [
				method,
				implementation[method].bind(implementation),
			]),
		),
	);
}

module.exports = { createSettingsRepositoryPort };
