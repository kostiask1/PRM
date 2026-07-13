const AI_HISTORY_REPOSITORY_METHODS = Object.freeze([
	"list",
	"stats",
	"get",
	"add",
	"update",
	"delete",
	"clear",
]);

function createAiHistoryRepositoryPort(implementation = {}) {
	for (const method of AI_HISTORY_REPOSITORY_METHODS) {
		if (typeof implementation[method] !== "function") {
			throw new TypeError(`AI history repository requires ${method}().`);
		}
	}
	return Object.freeze(
		Object.fromEntries(
			AI_HISTORY_REPOSITORY_METHODS.map((method) => [
				method,
				implementation[method].bind(implementation),
			]),
		),
	);
}

module.exports = {
	AI_HISTORY_REPOSITORY_METHODS,
	createAiHistoryRepositoryPort,
};
